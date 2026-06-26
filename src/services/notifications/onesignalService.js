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

      if (typeof OneSignal?.init === "function") {
        await OneSignal.init(options);
      } else {
        console.warn("[OneSignal] SDK init method not available");
        return false;
      }

      if (userId) {
        _lastUserId = userId;
        if (typeof OneSignal?.setExternalUserId === "function") {
          await OneSignal.setExternalUserId(userId);
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

    if (typeof OneSignal?.showSlidedownPrompt === "function") {
      OneSignal.showSlidedownPrompt();
    } else if (typeof OneSignal?.showNativePrompt === "function") {
      OneSignal.showNativePrompt();
    } else if (typeof OneSignal?.Notifications?.requestPermission === "function") {
      await OneSignal.Notifications.requestPermission();
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
    return Notification.permission === "granted";
  } catch (err) {
    console.error("[OneSignal] Permission prompt failed:", err);
    return false;
  }
}

export async function enablePushNotifications(userId = null) {
  const granted = await requestPermission(userId);
  if (!granted) return false;
  await _ensureInitialized(userId);
  return true;
}

export async function getPlayerId(userId = null) {
  if (!isSupported()) return null;
  const initialized = await _ensureInitialized(userId);
  if (!initialized) return null;
  try {
    if (typeof OneSignal?.getUserId === "function") {
      return (await OneSignal.getUserId()) || null;
    }
    return null;
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
    if (typeof OneSignal?.logout === "function") {
      await OneSignal.logout();
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
