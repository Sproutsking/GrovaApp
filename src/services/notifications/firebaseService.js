// ============================================================================
// src/services/notifications/firebaseService.js — Firebase Cloud Messaging
// ============================================================================
// Firebase integration for push notifications on native mobile apps and web.
// Uses Firebase Cloud Messaging (FCM) for token-based delivery via v1 API.
//
// Configuration:
//   REACT_APP_FIREBASE_API_KEY
//   REACT_APP_FIREBASE_PROJECT_ID
//   REACT_APP_FIREBASE_SENDER_ID
//   REACT_APP_FIREBASE_APP_ID
//   REACT_APP_FIREBASE_MESSAGING_VAPID_KEY
//
// CRITICAL: Do NOT remove Firebase integration without understanding the
// push notification system. This is the PRIMARY notification delivery method.
// ============================================================================

const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  senderId: process.env.REACT_APP_FIREBASE_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
};

const VAPID_KEY = process.env.REACT_APP_FIREBASE_MESSAGING_VAPID_KEY || "";

let _messaging = null;
let _initialized = false;
let _initPromise = null;
let _lastUserId = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function isSupported() {
  return (
    isBrowser() &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "firebase" in window
  );
}

async function waitForFirebaseSDK(timeoutMs = 15000) {
  if (!isBrowser()) return null;

  if (typeof window?.firebase !== "undefined") {
    return window.firebase;
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (typeof window?.firebase !== "undefined") {
        clearInterval(interval);
        resolve(window.firebase);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 250);
  });
}

function getFirebaseApp() {
  if (!isBrowser()) return null;
  try {
    return window?.firebase?.app?.();
  } catch {
    return null;
  }
}

function getMessaging() {
  if (_messaging) return _messaging;
  try {
    const firebase = window?.firebase;
    const app = getFirebaseApp();
    if (firebase?.messaging && app) {
      _messaging = firebase.messaging(app);
      return _messaging;
    }
  } catch (err) {
    console.debug("[Firebase] getMessaging failed:", err);
  }
  return null;
}

async function _readFcmTokenFromSdk() {
  try {
    const messaging = getMessaging();
    if (!messaging) return null;

    // For web: use getToken() with VAPID key
    if (typeof messaging.getToken === "function" && VAPID_KEY) {
      try {
        const token = await messaging.getToken({ vapidKey: VAPID_KEY });
        if (token) return token;
      } catch (err) {
        console.debug("[Firebase] getToken failed:", err);
      }
    }

    return null;
  } catch (err) {
    console.error("[Firebase] _readFcmTokenFromSdk failed:", err);
    return null;
  }
}

async function _waitForFcmToken(userId = null, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;

  while (Date.now() < deadline) {
    lastValue = await getFcmToken(userId);
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return lastValue;
}

async function _ensureInitialized(userId = null) {
  if (!isSupported()) return false;

  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    console.warn(
      "[Firebase] Missing REACT_APP_FIREBASE_* config; skipping initialization"
    );
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
      const firebase = await waitForFirebaseSDK();
      if (!firebase) {
        console.warn("[Firebase] SDK not available on this runtime");
        return false;
      }

      // Initialize Firebase app
      try {
        const app = firebase.app?.();
        if (!app) {
          console.warn("[Firebase] App not initialized");
          return false;
        }
      } catch {
        // App may already be initialized, continue
      }

      // Get messaging instance
      const messaging = getMessaging();
      if (!messaging) {
        console.warn("[Firebase] Messaging not available");
        return false;
      }

      if (userId) {
        _lastUserId = userId;
        // Store userId for analytics/identification if needed
        try {
          if (typeof messaging.setAnalyticsUserId === "function") {
            await messaging.setAnalyticsUserId(userId);
          }
        } catch (err) {
          console.debug("[Firebase] setAnalyticsUserId failed:", err);
        }
      }

      _initialized = true;
      return true;
    } catch (err) {
      console.error("[Firebase] Initialization failed:", err);
      return false;
    }
  })();

  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

export async function initializeFirebase(userId = null) {
  return _ensureInitialized(userId);
}

export async function requestPermission(userId = null) {
  if (!isSupported()) return false;

  const initialized = await _ensureInitialized(userId);
  if (!initialized) return false;

  try {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const result = await Notification.requestPermission();
    return result === "granted";
  } catch (err) {
    console.error("[Firebase] Permission prompt failed:", err);
    return false;
  }
}

export async function enablePushNotifications(userId = null) {
  const granted = await requestPermission(userId);
  if (!granted) return false;

  await _ensureInitialized(userId);
  const token = await _waitForFcmToken(userId);

  if (!token) {
    console.warn("[Firebase] Permission granted but no FCM token generated");
    return false;
  }

  if (typeof window !== "undefined") {
    window.__firebaseDebug = async () => {
      const messaging = getMessaging();
      const state = {
        initialized: _initialized,
        permission: Notification.permission,
        fcmToken: await getFcmToken(userId),
        sdkReady: Boolean(messaging),
        vapidKey: Boolean(VAPID_KEY),
      };
      console.table([state]);
      return state;
    };
  }

  return true;
}

export async function getFcmToken(userId = null) {
  if (!isSupported()) return null;

  const initialized = await _ensureInitialized(userId);
  if (!initialized) return null;

  try {
    return (await _readFcmTokenFromSdk()) || null;
  } catch (err) {
    console.error("[Firebase] getFcmToken failed:", err);
    return null;
  }
}

export async function subscribe(userId = null) {
  return enablePushNotifications(userId);
}

export async function unsubscribe(userId = null) {
  if (!isSupported()) return false;

  try {
    const messaging = getMessaging();
    if (messaging && typeof messaging.deleteToken === "function") {
      const token = await messaging.getToken?.({ vapidKey: VAPID_KEY }).catch(() => null);
      if (token && typeof messaging.deleteToken === "function") {
        await messaging.deleteToken(token);
      }
    }

    if (userId) {
      _lastUserId = null;
    }
    return true;
  } catch (err) {
    console.error("[Firebase] Unsubscribe failed:", err);
    return false;
  }
}

export async function isSubscribed() {
  if (!isSupported()) return false;
  if (!(_initialized || (await _ensureInitialized()))) return false;
  return Notification.permission === "granted";
}

export async function onMessageReceived(callback) {
  if (!isSupported()) return () => {};

  const messaging = getMessaging();
  if (!messaging || typeof messaging.onMessage !== "function") {
    return () => {};
  }

  try {
    return messaging.onMessage((payload) => {
      console.log("[Firebase] Message received in foreground:", payload);
      callback(payload);
    });
  } catch (err) {
    console.error("[Firebase] onMessageReceived setup failed:", err);
    return () => {};
  }
}

export { isSupported as isFirebaseSupported };

export default {
  initializeFirebase,
  requestPermission,
  enablePushNotifications,
  getFcmToken,
  subscribe,
  unsubscribe,
  isSubscribed,
  isSupported,
  onMessageReceived,
};
