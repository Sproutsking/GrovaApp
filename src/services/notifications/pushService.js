// ============================================================================
// src/services/notifications/pushService.js — v16 FIREBASE FCM INTEGRATION
// ============================================================================
// Refactored for Firebase Cloud Messaging (FCM) as the primary push provider.
// Maintains backward compatibility with legacy VAPID-based browser push.
// Service worker bridge and deep-link routing preserved exactly.
// ============================================================================

import { supabase } from "../config/supabase";
import {
  enablePushNotifications as enableFirebase,
  getFcmToken as getFirebaseFcmToken,
  initializeFirebase,
  isFirebaseConfigured,
  isFirebaseSupported,
  requestPermission as requestFirebasePermission,
  unsubscribe as unsubscribeFirebase,
} from "./firebaseService";

// ── Edge function invoker ───────────────────────────────────────────────────
async function _invoke(body, functionName = "send-push-fcm") {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      console.error(
        "[Push] Edge fn error:",
        error.message || JSON.stringify(error),
      );
      return false;
    }
    if (data?.sent === 0) {
      console.warn("[Push] Edge function delivered no notifications:", data);
      return false;
    }
    return data?.sent > 0 || data?.ok === true;
  } catch (err) {
    console.error("[Push] _invoke threw:", err.message);
    return false;
  }
}

// ── Tiny event bus ────────────────────────────────────────────────────────────
class EventBus {
  constructor() {
    this._map = new Map();
  }
  on(event, fn) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(fn);
    return () => this._map.get(event)?.delete(fn);
  }
  emit(event, data) {
    this._map.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[Push] bus handler threw:", e);
      }
    });
  }
}

// ── VAPID key → Uint8Array (for legacy support) ────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

function getVapidKey() {
  const k = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  if (!k) {
    console.debug("[Push] Legacy VAPID config missing");
    return null;
  }
  if (k.length < 80) {
    console.debug("[Push] Legacy VAPID config looks incomplete");
    return null;
  }
  return k;
}

// ── Module state ──────────────────────────────────────────────────────────────
const _bus = new EventBus();
let _userId = null;
let _started = false;
let _subscribing = false;
let _bridgeAttached = false;
let _visibilityListenerAdded = false;

// ── SW registration ───────────────────────────────────────────────────────────
async function _getReg() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

// ── SW ↔ App message bridge ───────────────────────────────────────────────────
function _attachBridge() {
  if (_bridgeAttached || !("serviceWorker" in navigator)) return;
  _bridgeAttached = true;

  navigator.serviceWorker.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg?.type) return;

    switch (msg.type) {
      case "PUSH_RECEIVED":
        _bus.emit("push_received", msg.payload);
        if (msg.payload?.data?.type === "incoming_call") {
          _bus.emit("incoming_call_push", msg.payload.data);
        }
        break;

      case "NOTIFICATION_CLICKED":
        _bus.emit("notification_clicked", { url: msg.url, data: msg.data });
        break;

      case "CALL_ACCEPTED_FROM_NOTIFICATION":
        _bus.emit("call_accepted_from_notification", msg.data);
        break;

      case "CALL_DECLINED_FROM_NOTIFICATION":
        _bus.emit("call_declined_from_notification", msg.data);
        break;

      case "PENDING_PAYLOADS":
        if (Array.isArray(msg.payloads)) {
          msg.payloads.forEach((p) => {
            _bus.emit("push_received", p);
            if (p?.data?.type === "incoming_call") {
              _bus.emit("incoming_call_push", p.data);
            }
          });
        }
        break;

      case "SW_UPDATED":
        _bus.emit("sw_updated", { version: msg.version });
        break;

      case "SW_NAVIGATE":
        if (msg.url)
          _bus.emit("notification_clicked", { url: msg.url, data: {} });
        break;

      case "SW_POISON_PILL_RELOAD":
        window.location.reload();
        break;

      default:
        break;
    }
  });

  // Drain any payloads that arrived while the app was closed
  navigator.serviceWorker.ready
    .then(() => {
      setTimeout(() => {
        try {
          navigator.serviceWorker.controller?.postMessage({
            type: "GET_PENDING_PAYLOADS",
          });
        } catch (_) {}
      }, 800);
    })
    .catch(() => {});

  // Re-drain after a SW update
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    setTimeout(() => {
      try {
        navigator.serviceWorker.controller?.postMessage({
          type: "GET_PENDING_PAYLOADS",
        });
      } catch (_) {}
    }, 1000);
  });
}

// ── Resubscribe if subscription disappears ────────────────────────────────────
function _attachVisibilityCheck() {
  if (_visibilityListenerAdded) return;
  _visibilityListenerAdded = true;
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (!_userId || Notification.permission !== "granted") return;
    const reg = await _getReg();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (!sub) {
      console.log("[Push] Subscription missing on focus — re-subscribing");
      _doSubscribe(_userId);
    }
  });
}

// ── Save FCM token to Supabase ──────────────────────────────────────────────
async function _saveFcmToken(fcmToken) {
  if (!fcmToken) {
    throw new Error("FCM token is required");
  }

  const { error } = await supabase.rpc("register_fcm_push_subscription", {
    p_fcm_token: fcmToken,
    p_user_agent: navigator.userAgent.slice(0, 500),
  });

  if (error) {
    throw new Error(`Could not save this device's push subscription: ${error.message}`);
  }
}

// ── Save legacy VAPID subscription to Supabase ──────────────────────────────
async function _saveLegacySubscription(userId, subscription) {
  const json = subscription?.toJSON?.();
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    throw new Error("Subscription missing endpoint, p256dh, or auth");
  }

  const record = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    provider: "legacy",
    user_agent: navigator.userAgent.slice(0, 500),
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", json.endpoint)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not check the existing push subscription: ${lookupError.message}`);
  }

  const { data: saved, error: saveError } = existing
    ? await supabase
        .from("push_subscriptions")
        .update(record)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle()
    : await supabase.from("push_subscriptions").insert(record).select("id").maybeSingle();

  if (saveError) {
    throw new Error(`Could not save the push subscription: ${saveError.message}`);
  }
  if (!saved) throw new Error("The push subscription was not persisted");
}

async function _saveWithRetry(userId, data, attempt = 0) {
  const delays = [500, 1500, 3000];
  try {
    if (data?.fcmToken) {
      await _saveFcmToken(data.fcmToken);
    } else {
      await _saveLegacySubscription(userId, data);
    }
  } catch (err) {
    if (attempt < delays.length) {
      console.warn(
        `[Push] Save attempt ${attempt + 1} failed. Retry in ${delays[attempt] / 1000}s`
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
      return _saveWithRetry(userId, data, attempt + 1);
    }
    console.error("[Push] All push-subscription save attempts failed:", err.message);
    throw err;
  }
}

// ── Core subscribe ────────────────────────────────────────────────────────────
async function _doSubscribe(userId) {
  if (_subscribing) return null;
  _subscribing = true;

  try {
    // Try Firebase FCM first (primary for mobile)
    if (isFirebaseSupported() && (await initializeFirebase(userId))) {
      const granted = await requestFirebasePermission(userId);
      if (!granted) {
        console.warn("[Push] Firebase permission not granted");
        return null;
      }

      const ok = await enableFirebase(userId);
      if (!ok) {
        console.warn("[Push] Firebase enrollment unavailable — trying legacy push");
      }

      if (ok) {
        let fcmToken = await getFirebaseFcmToken(userId);
        if (!fcmToken) {
          // Wait for token
          for (let attempt = 0; attempt < 6; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            fcmToken = await getFirebaseFcmToken(userId);
            if (fcmToken) break;
          }
        }
        if (fcmToken) {
          await _saveWithRetry(userId, { fcmToken });
          console.log("[Push] ✅ Firebase FCM subscription registered");
          return { provider: "fcm", fcmToken };
        }
      }
      console.warn("[Push] Firebase token unavailable after registration — trying legacy push");
    }

    // Fallback to legacy VAPID
    const vapidKey = getVapidKey();
    if (!vapidKey) return null;

    const reg = await _getReg();
    if (!reg) {
      console.error("[Push] No SW registration");
      return null;
    }

    let sub = await reg.pushManager.getSubscription().catch(() => null);

    if (sub) {
      const existingKey = sub.options?.applicationServerKey;
      if (existingKey) {
        const currentKeyBytes = urlBase64ToUint8Array(vapidKey);
        const existingKeyBytes = new Uint8Array(existingKey);
        const keyChanged =
          currentKeyBytes.length !== existingKeyBytes.length ||
          currentKeyBytes.some((b, i) => b !== existingKeyBytes[i]);
        if (keyChanged) {
          console.warn("[Push] VAPID key changed — unsubscribing");
          await sub.unsubscribe().catch(() => {});
          sub = null;
        }
      }
    }

    if (sub) {
      await _saveWithRetry(userId, sub);
      console.log("[Push] ✅ Reused existing subscription");
      return sub;
    }

    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await _saveWithRetry(userId, sub);
    console.log("[Push] ✅ New subscription created");
    return sub;
  } catch (err) {
    if (err.name === "NotAllowedError") {
      console.warn("[Push] Permission denied");
      return null;
    }
    if (err.name === "InvalidStateError") {
      console.warn("[Push] SW not yet active");
      const reg = await _getReg().catch(() => null);
      if (reg?.installing) {
        await new Promise((resolve) => {
          const worker = reg.installing || reg.waiting;
          if (!worker) {
            resolve();
            return;
          }
          worker.addEventListener("statechange", function handler() {
            if (worker.state === "activated") {
              worker.removeEventListener("statechange", handler);
              resolve();
            }
          });
          setTimeout(resolve, 8000);
        });
        _subscribing = false;
        return _doSubscribe(userId);
      }
      setTimeout(() => {
        _subscribing = false;
        _doSubscribe(userId);
      }, 5000);
      return null;
    }
    console.error("[Push] ❌ _doSubscribe threw:", err.message);
    return null;
  } finally {
    _subscribing = false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================
export const pushService = {
  attachBridgeEarly() {
    _attachBridge();
  },

  on(event, fn) {
    return _bus.on(event, fn);
  },
  _emit(event, data) {
    _bus.emit(event, data);
  },

  isSupported() {
    return (
      isFirebaseSupported() ||
      ("Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window)
    );
  },

  getPermission() {
    return this.isSupported() ? Notification.permission : "denied";
  },

  async isSubscribed() {
    try {
      if (!this.isSupported()) return false;
      const reg = await _getReg();
      return !!(await reg?.pushManager.getSubscription());
    } catch {
      return false;
    }
  },

  async getProvider(userId) {
    if (isFirebaseSupported()) await initializeFirebase(userId || _userId);
    if (isFirebaseConfigured()) return "fcm";
    return getVapidKey() ? "legacy" : "none";
  },

  async requestPermission() {
    try {
      if (!this.isSupported()) return false;
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      return (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  },

  async enablePushNotifications(userId) {
    const uid = userId || _userId;
    if (!uid || !this.isSupported()) return false;
    const granted = await this.requestPermission();
    if (!granted) return false;
    const sub = await _doSubscribe(uid);
    if (sub) {
      try {
        window.dispatchEvent(new CustomEvent("push:permission_granted"));
      } catch {}
    }
    return !!sub;
  },

  async subscribe(userId) {
    return _doSubscribe(userId || _userId);
  },

  async unsubscribe(userId) {
    const uid = userId || _userId;
    if (!uid) throw new Error("User ID is required to unsubscribe");
    try {
      if (isFirebaseSupported() && isFirebaseConfigured()) {
        const token = await getFirebaseFcmToken(uid);
        if (!token) {
          throw new Error("Could not identify this device's FCM subscription");
        }

        const { error } = await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("user_id", uid)
          .eq("provider", "fcm")
          .eq("fcm_token", token);
        if (error) throw error;

        const removed = await unsubscribeFirebase(uid);
        if (!removed) throw new Error("Firebase could not unsubscribe this device");

        console.log("[Push] Unsubscribed this device from Firebase FCM");
        return;
      }

      const reg = await _getReg();
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub && !(await sub.unsubscribe())) {
        throw new Error("The browser could not unsubscribe this device");
      }
      if (uid && endpoint) {
        const { error } = await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("user_id", uid)
          .eq("provider", "legacy")
          .eq("endpoint", endpoint);
        if (error) throw error;
      }
      console.log("[Push] Unsubscribed this device");
    } catch (err) {
      console.error("[Push] Unsubscribe failed:", err);
      throw err;
    }
  },

  async sendPushToUser({
    recipientUserId,
    actorUserId = null,
    type = "general",
    title = "Xeevia",
    message = "",
    entityId = null,
    metadata = {},
  }) {
    if (!recipientUserId) return false;

    if (
      _userId &&
      actorUserId &&
      _userId === actorUserId &&
      recipientUserId === actorUserId
    ) {
      return false;
    }

    return _invoke(
      {
        recipient_user_id: recipientUserId,
        actor_user_id: actorUserId,
        type,
        title,
        message,
        entity_id: entityId,
        metadata,
      },
      "send-push-fcm"
    );
  },

  async testNotification() {
    if (!this.isSupported() || Notification.permission !== "granted") {
      console.warn("[Push] Cannot test — permission not granted");
      return false;
    }
    const reg = await _getReg();
    if (!reg) return false;
    await reg.showNotification("✅ Push Notifications Active", {
      body: "Xeevia push notifications are working!",
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: `test_${Date.now()}`,
      vibrate: [200, 100, 200],
      data: { url: "/", type: "test", deeplink_path: "/" },
    });
    return true;
  },

  clearBadge() {
    try {
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
    } catch (_) {}
  },

  async start(userId) {
    if (!this.isSupported()) {
      console.log("[Push] Not supported in this browser");
      return;
    }
    _userId = userId;
    _started = true;

    await initializeFirebase(userId);

    _attachBridge();
    _attachVisibilityCheck();

    const perm = this.getPermission();
    if (perm === "granted") {
      if (!navigator.onLine) {
        console.log("[Push] Offline at start — will subscribe when online");
        const onOnline = () => {
          window.removeEventListener("online", onOnline);
          _doSubscribe(userId).catch(() => {});
        };
        window.addEventListener("online", onOnline);
        return;
      }

      const sub = await _doSubscribe(userId);
      if (!sub) {
        setTimeout(() => _doSubscribe(userId).catch(() => {}), 8000);
      }
    } else if (perm === "default") {
      console.log(
        "[Push] Permission not yet granted.\n" +
          "Listen for 'push:needs_permission' and call:\n" +
          "  pushService.enablePushNotifications(userId)"
      );
      try {
        window.dispatchEvent(
          new CustomEvent("push:needs_permission", { detail: { userId } })
        );
      } catch {}
    } else {
      console.log("[Push] Permission blocked — enable in browser settings");
    }
  },

  getStatus() {
    return {
      started: _started,
      userId: _userId,
      permission: this.getPermission(),
      supported: this.isSupported(),
      firebaseConfigured: isFirebaseConfigured(),
    };
  },
};

export default pushService;
