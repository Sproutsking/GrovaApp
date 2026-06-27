// ============================================================================
// src/services/notifications/onesignalService.js
// ============================================================================
// Lightweight OneSignal wrapper that preserves the app's existing pushService
// API while moving delivery to OneSignal. The older VAPID path remains in
// pushService.js but is no longer used by the public methods.

import OneSignal from "react-onesignal";

const ONESIGNAL_APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID || "";
const ONESIGNAL_SAFARI_WEB_ID = process.env.REACT_APP_ONESIGNAL_SAFARI_WEB_ID || "";

let _initPromise = null;
let _initialized = false;
let _lastUserId = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function isSupported() {
  return isBrowser() && "Notification" in window && "serviceWorker" in navigator;
}

function getOneSignalApi() {
  if (!isBrowser()) return null;
  if (typeof window?.OneSignal !== "undefined") return window.OneSignal;
  return OneSignal;
}

async function _readPlayerIdFromSdk() {
  const api = getOneSignalApi();
  if (!api) return null;

  try {
    if (typeof api?.getUserId === "function") {
      const id = await api.getUserId();
      if (id) return id;
    }
  } catch (err) {
    console.debug("[OneSignal] getUserId probe failed:", err);
  }

  try {
    if (typeof api?.getDeviceState === "function") {
      const state = await api.getDeviceState();
      const id = state?.userId || state?.user_id || state?.pushToken || null;
      if (id) return id;
    }
  } catch (err) {
    console.debug("[OneSignal] getDeviceState probe failed:", err);
  }

  try {
    if (typeof api?.User?.PushSubscription?.id === "function") {
      const id = await api.User.PushSubscription.id();
      if (id) return id;
    }
  } catch (err) {
    console.debug("[OneSignal] PushSubscription.id probe failed:", err);
  }

  try {
    if (typeof api?.getSubscription === "function") {
      const sub = await api.getSubscription();
      const id = sub?.id || sub?.subscriptionId || sub?.onesignal_id || null;
      if (id) return id;
    }
  } catch (err) {
    console.debug("[OneSignal] getSubscription probe failed:", err);
  }

  return null;
}

async function _waitForPlayerId(userId = null, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;

  while (Date.now() < deadline) {
    lastValue = await getPlayerId(userId);
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return lastValue;
}

async function _registerForPushNotifications(api) {
  if (!api) return false;

  try {
    if (typeof api?.registerForPushNotifications === "function") {
      await api.registerForPushNotifications();
      return true;
    }
  } catch (err) {
    console.debug("[OneSignal] registerForPushNotifications failed:", err);
  }

  try {
    if (typeof api?.push === "function") {
      await new Promise((resolve) => {
        api.push(() => {
          if (typeof api.registerForPushNotifications === "function") {
            api.registerForPushNotifications();
          }
          resolve();
        });
      });
      return true;
    }
  } catch (err) {
    console.debug("[OneSignal] queued registration failed:", err);
  }

  return false;
}

async function _ensureInitialized(userId = null) {
  if (!isSupported()) return false;
  if (!ONESIGNAL_APP_ID) {
    console.warn("[OneSignal] Missing REACT_APP_ONESIGNAL_APP_ID; skipping initialization");
    return false;
  }
  if (_initialized && (!userId || _lastUserId === userId)) {
    return true;
  }
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = (async () => {
    try {
      const options = {
        appId: ONESIGNAL_APP_ID,
        safari_web_id: ONESIGNAL_SAFARI_WEB_ID || undefined,
        allowLocalhostAsSecureOrigin: true,
        autoRegister: false,
        notifyButton: { enable: false },
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "/OneSignalSDKWorker.js",
      };

      const api = getOneSignalApi();
      if (!api) {
        console.warn("[OneSignal] SDK not available on this runtime");
        return false;
      }

      if (typeof api?.init === "function") {
        await api.init(options);
      } else {
        console.warn("[OneSignal] SDK init method not available");
        return false;
      }

      if (userId) {
        _lastUserId = userId;
        if (typeof api?.setExternalUserId === "function") {
          await api.setExternalUserId(userId);
        }
      }

      _initialized = true;
      return true;
    } catch (err) {
      console.error("[OneSignal] Initialization failed:", err);
      return false;
    }
  })();

  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

export async function initializeOneSignal(userId = null) {
  return _ensureInitialized(userId);
}

export async function requestPermission(userId = null) {
  if (!isSupported()) return false;
  const initialized = await _ensureInitialized(userId);
  if (!initialized) return false;

  try {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const api = getOneSignalApi();
    if (typeof api?.showSlidedownPrompt === "function") {
      api.showSlidedownPrompt();
    } else if (typeof api?.showNativePrompt === "function") {
      api.showNativePrompt();
    } else if (typeof api?.Notifications?.requestPermission === "function") {
      await api.Notifications.requestPermission();
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (Notification.permission === "granted") {
      await _registerForPushNotifications(api);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[OneSignal] Permission prompt failed:", err);
    return false;
  }
}

export async function enablePushNotifications(userId = null) {
  const granted = await requestPermission(userId);
  if (!granted) return false;
  await _ensureInitialized(userId);
  const playerId = await _waitForPlayerId(userId);
  if (!playerId) {
    console.warn("[OneSignal] Permission was granted but no player ID was created");
    return false;
  }

  if (typeof window !== "undefined") {
    window.__onesignalDebug = async () => {
      const api = getOneSignalApi();
      const state = {
        appIdConfigured: Boolean(ONESIGNAL_APP_ID),
        initialized: _initialized,
        permission: Notification.permission,
        playerId: await getPlayerId(userId),
        sdkReady: Boolean(api && typeof api.getUserId === "function"),
      };
      console.table([state]);
      return state;
    };
  }

  return true;
}

export async function getPlayerId(userId = null) {
  if (!isSupported()) return null;
  const initialized = await _ensureInitialized(userId);
  if (!initialized) return null;
  try {
    return (await _readPlayerIdFromSdk()) || null;
  } catch (err) {
    console.error("[OneSignal] getPlayerId failed:", err);
    return null;
  }
}

export async function subscribe(userId = null) {
  return enablePushNotifications(userId);
}

export async function unsubscribe(userId = null) {
  if (!isSupported()) return false;
  try {
    const api = getOneSignalApi();
    if (typeof api?.logout === "function") {
      await api.logout();
    }
    if (userId) {
      _lastUserId = null;
    }
    return true;
  } catch (err) {
    console.error("[OneSignal] Unsubscribe failed:", err);
    return false;
  }
}

export async function isSubscribed() {
  if (!isSupported()) return false;
  if (!(_initialized || (await _ensureInitialized()))) return false;
  return Notification.permission === "granted";
}

export { isSupported as isOneSignalSupported };

export default {
  initializeOneSignal,
  requestPermission,
  enablePushNotifications,
  getPlayerId,
  subscribe,
  unsubscribe,
  isSubscribed,
  isSupported,
};
