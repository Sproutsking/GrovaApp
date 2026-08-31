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
  isFirebaseSupported,
  requestPermission as requestFirebasePermission,
  unsubscribe as unsubscribeFirebase,
} from "./firebaseService";

// ── Firebase config check ───────────────────────────────────────────────────
function isFirebaseConfigured() {
  return Boolean(
    process.env.REACT_APP_FIREBASE_PROJECT_ID &&
    process.env.REACT_APP_FIREBASE_SENDER_ID
  );
}

// ── Edge function invoker ───────────────────────────────────────────────────
async function _invoke(body, functionName = "send-push-fcm") {
  try {
    const { error } = await supabase.functions.invoke(functionName, { body });
    if (error) {
      console.error(
        "[Push] Edge fn error:",
        error.message || JSON.stringify(error),
      );
      return false;
    }
    return true;
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
async function _saveFcmToken(userId, fcmToken) {
  if (!fcmToken) {
    throw new Error("FCM token is required");
  }

  const record = {
    user_id: userId,
    fcm_token: fcmToken,
    provider: "fcm",
    user_agent: navigator.userAgent.slice(0, 500),
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  // Clean up any inactive rows for this token first
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("fcm_token", fcmToken)
    .eq("is_active", false)
    .catch(() => {});

  // Upsert
  const { error: upsertErr } = await supabase
    .from("push_subscriptions")
    .upsert(record, { onConflict: "user_id,fcm_token" });

  if (!upsertErr) {
    console.log("[Push] ✅ FCM token saved to DB");
    return;
  }

  // Upsert failed — try delete+insert
  console.warn("[Push] Upsert failed:", upsertErr.message, "— trying delete+insert");
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("fcm_token", fcmToken)
    .catch(() => {});
  const { error: insertErr } = await supabase
    .from("push_subscriptions")
    .insert(record);
  if (insertErr) throw new Error("Insert also failed: " + insertErr.message);
  console.log("[Push] ✅ FCM token inserted to DB (fallback)");
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

  // Clean up inactive rows
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", json.endpoint)
    .eq("is_active", false)
    .catch(() => {});

  const { error: upsertErr } = await supabase
    .from("push_subscriptions")
    .upsert(record, { onConflict: "user_id,endpoint" });

  if (!upsertErr) {
    console.log("[Push] ✅ Legacy subscription saved");
    return;
  }

  console.warn("[Push] Upsert failed — trying delete+insert");
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", json.endpoint)
    .catch(() => {});
  const { error: insertErr } = await supabase
    .from("push_subscriptions")
    .insert(record);
  if (insertErr) throw new Error("Insert also failed: " + insertErr.message);
  console.log("[Push] ✅ Legacy subscription inserted (fallback)");
}

async function _saveWithRetry(userId, data, attempt = 0) {
  const delays = [3000, 10000, 30000];
  try {
    if (data?.fcmToken) {
      await _saveFcmToken(userId, data.fcmToken);
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
    console.error("[Push] ❌ All save attempts failed:", err.message);
  }
}

// ── Core subscribe ────────────────────────────────────────────────────────────
async function _doSubscribe(userId) {
  if (_subscribing) return null;
  _subscribing = true;

  try {
    // Try Firebase FCM first (primary for mobile)
    if (isFirebaseSupported() && isFirebaseConfigured()) {
      const granted = await requestFirebasePermission(userId);
      if (!granted) {
        console.warn("[Push] Firebase permission not granted");
        return null;
      }

      const ok = await enableFirebase(userId);
      if (!ok) return null;

      let fcmToken = await getFirebaseFcmToken(userId);
      if (!fcmToken) {
        // Wait for token
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          fcmToken = await getFirebaseFcmToken(userId);
          if (fcmToken) break;
        }
      }
      if (!fcmToken) {
        console.warn("[Push] Firebase token not available after registration");
        return null;
      }

      await _saveWithRetry(userId, { fcmToken });
      console.log("[Push] ✅ Firebase FCM subscription registered");
      return { provider: "fcm", fcmToken };
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
    try {
      const uid = userId || _userId;
      if (isFirebaseSupported() && isFirebaseConfigured()) {
        await unsubscribeFirebase(uid);
        if (uid) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("user_id", uid)
            .eq("provider", "fcm");
        }
        console.log("[Push] ✅ Unsubscribed from Firebase FCM");
        return;
      }

      const reg = await _getReg();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      if (uid) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("user_id", uid)
          .eq("endpoint", endpoint);
      }
      console.log("[Push] ✅ Unsubscribed");
    } catch (err) {
      console.error("[Push] unsubscribe error:", err);
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
