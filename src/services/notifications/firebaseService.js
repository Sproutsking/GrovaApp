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

import { supabase } from "../config/supabase";

function hasMeaningfulEnv(value) {
  if (typeof value !== "string") return false;
  const cleaned = value.trim();
  if (!cleaned) return false;
  const lowered = cleaned.toLowerCase();
  return ![
    "placeholder",
    "replace_me",
    "your_firebase",
    "your-project-id",
    "example",
    "test",
    "dummy",
    "changeme",
    "<add-your"
  ].some((token) => lowered.includes(token));
}

let FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
};

let VAPID_KEY = process.env.REACT_APP_FIREBASE_MESSAGING_VAPID_KEY || "";

let _messaging = null;
let _initialized = false;
let _initPromise = null;
let _firebaseSDKPromise = null;
let _configPromise = null;
let _configLoaded = false;
let _lastUserId = null;
let _lastError = null;

function hasFirebaseConfig() {
  return (
    hasMeaningfulEnv(FIREBASE_CONFIG.apiKey) &&
    hasMeaningfulEnv(FIREBASE_CONFIG.projectId) &&
    hasMeaningfulEnv(FIREBASE_CONFIG.messagingSenderId) &&
    hasMeaningfulEnv(FIREBASE_CONFIG.appId) &&
    hasMeaningfulEnv(VAPID_KEY)
  );
}

async function loadFirebaseConfig() {
  if (_configLoaded) return hasFirebaseConfig();
  if (_configPromise) return _configPromise;

  _configPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-push-config", {
        body: {},
      });

      if (error) {
        throw new Error(error.message || "Could not load Firebase configuration");
      }

      const config = data?.firebase;
      const vapidKey = data?.vapidKey;
      if (
        !hasMeaningfulEnv(config?.apiKey) ||
        !hasMeaningfulEnv(config?.projectId) ||
        !hasMeaningfulEnv(config?.messagingSenderId) ||
        !hasMeaningfulEnv(config?.appId) ||
        !hasMeaningfulEnv(vapidKey)
      ) {
        throw new Error("Firebase public configuration is incomplete");
      }

      FIREBASE_CONFIG = {
        apiKey: config.apiKey,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      };
      VAPID_KEY = vapidKey;
      _configLoaded = true;
      _lastError = null;
      return true;
    } catch (err) {
      _lastError = err?.message || String(err);
      console.error("[Firebase] Public configuration could not be loaded:", _lastError);
      return false;
    } finally {
      _configPromise = null;
    }
  })();

  return _configPromise;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isSupported() {
  return (
    isBrowser() &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

function loadFirebaseScript(id, src, isReady) {
  if (isReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
    }

    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      if (isReady()) {
        resolve();
      } else {
        script.remove();
        reject(new Error(`Firebase SDK script loaded without expected API: ${id}`));
      }
    };
    const handleError = () => {
      cleanup();
      script.remove();
      reject(new Error(`Failed to load Firebase SDK script: ${src}`));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  });
}

async function waitForFirebaseSDK() {
  if (!isBrowser()) return null;

  if (typeof window?.firebase?.messaging === "function") {
    return window.firebase;
  }

  if (!_firebaseSDKPromise) {
    _firebaseSDKPromise = (async () => {
      await loadFirebaseScript(
        "xv-firebase-app-sdk",
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
        () => typeof window?.firebase?.initializeApp === "function",
      );
      await loadFirebaseScript(
        "xv-firebase-messaging-sdk",
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
        () => typeof window?.firebase?.messaging === "function",
      );
      return window.firebase;
    })().catch((error) => {
      _firebaseSDKPromise = null;
      throw error;
    });
  }

  return _firebaseSDKPromise;
}

function getFirebaseApp() {
  if (!isBrowser()) return null;
  try {
    const firebase = window?.firebase;
    if (!firebase?.initializeApp) return null;

    const existingApp = firebase.apps?.find((app) => app.name === "[DEFAULT]");
    if (existingApp) {
      const options = existingApp.options || {};
      if (
        options.projectId !== FIREBASE_CONFIG.projectId ||
        options.messagingSenderId !== FIREBASE_CONFIG.messagingSenderId ||
        options.appId !== FIREBASE_CONFIG.appId
      ) {
        _lastError = "An existing Firebase app uses a different project configuration";
        console.error("[Firebase]", _lastError);
        return null;
      }
      return existingApp;
    }

    return firebase.initializeApp(FIREBASE_CONFIG);
  } catch (err) {
    _lastError = err?.message || String(err);
    console.error("[Firebase] initializeApp failed:", _lastError);
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

function installFirebaseDebug(userId = null) {
  if (!isBrowser()) return;
  window.__firebaseDebug = async () => {
    const messaging = getMessaging();
    const state = {
      initialized: _initialized,
      permission: Notification.permission,
      fcmToken: await getFcmToken(userId),
      sdkReady: Boolean(window.firebase),
      messagingReady: Boolean(messaging),
      vapidKey: Boolean(VAPID_KEY),
      config: {
        projectId: Boolean(FIREBASE_CONFIG.projectId),
        senderId: Boolean(FIREBASE_CONFIG.messagingSenderId),
        appId: Boolean(FIREBASE_CONFIG.appId),
      },
      serviceWorker: "serviceWorker" in navigator,
      lastError: _lastError,
    };
    console.table([state]);
    return state;
  };
}

async function _readFcmTokenFromSdk() {
  try {
    const messaging = getMessaging();
    if (!messaging) return null;

    // For web: use getToken() with VAPID key
    if (typeof messaging.getToken === "function") {
      try {
        const serviceWorkerRegistration = await navigator.serviceWorker.ready;
        const token = await messaging.getToken({
          ...(VAPID_KEY ? { vapidKey: VAPID_KEY } : {}),
          serviceWorkerRegistration,
        });
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

  if (!(await loadFirebaseConfig())) {
    installFirebaseDebug(userId);
    return false;
  }
  installFirebaseDebug(userId);

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

      // Initialize Firebase app if the compat SDK has not initialized one yet.
      const app = getFirebaseApp();
      if (!app) {
        _lastError = "Firebase app initialization returned no app";
        console.warn("[Firebase] App initialization failed");
        return false;
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
      _lastError = null;
      return true;
    } catch (err) {
      _lastError = err?.message || String(err);
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

  installFirebaseDebug(userId);
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
      const token = await messaging.getToken?.(
        VAPID_KEY ? { vapidKey: VAPID_KEY } : undefined,
      ).catch(() => null);
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

export function isFirebaseConfigured() {
  return _configLoaded && hasFirebaseConfig();
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
  isFirebaseConfigured,
  requestPermission,
  enablePushNotifications,
  getFcmToken,
  subscribe,
  unsubscribe,
  isSubscribed,
  isSupported,
  onMessageReceived,
};