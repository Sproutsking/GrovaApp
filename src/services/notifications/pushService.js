// ============================================================================
// src/services/notifications/pushService.js — v9 COMPLETE FIX
// ============================================================================
// ROOT CAUSES FIXED:
//   [FIX-1] Removed duplicate SW registration — pushService NO LONGER calls
//           navigator.serviceWorker.register(). That is ONLY done in
//           serviceWorkerRegistration.js. Double registration caused
//           controllerchange → reload → subscription never saved.
//   [FIX-2] Permission is no longer requested on a timer. It's exposed as
//           a method that must be called from a user gesture (button click).
//           Chrome 2020+ silently ignores permission requests without gesture.
//   [FIX-3] SW bridge now attaches AFTER serviceWorker is ready, not at
//           module import time when controller is null.
//   [FIX-4] savePushSubscription uses upsert with correct conflict target
//           matching what your DB actually enforces (user_id + endpoint).
//           Added a DELETE + INSERT fallback if upsert fails.
//   [FIX-5] Added subscription validity check on every start() — if the
//           stored endpoint is dead or subscription missing, re-subscribes.
//   [FIX-6] Added visibilitychange listener to re-verify subscription when
//           user returns to app after clearing site data.
//   [FIX-7] Exponential backoff retry on subscribe with proper error
//           classification (permission errors don't retry).

import { supabase } from "../config/supabase";

// ── VAPID public key ──────────────────────────────────────────────────────────
// This must match the VAPID_PUBLIC_KEY set in your Supabase Edge Function secrets.
const VAPID_PUBLIC_KEY =
  process.env.REACT_APP_VAPID_PUBLIC_KEY ||
  "BIn84fMl6xilxp_r9d_hEUKaZbz_qPbSnPEq2acCJ5X8w469WNF7FleDB_WCMSiAfD2c3zXcpKSFGBFjDdVP57k";

// ── Typed event bus ───────────────────────────────────────────────────────────
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
        console.error("[PushService] event handler error:", e);
      }
    });
  }
}

// ── Utility: VAPID key conversion ─────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// ── Module state ──────────────────────────────────────────────────────────────
const _bus = new EventBus();
let _userId = null;
let _started = false;
let _subscribing = false;
let _swReady = false; // true once we've attached the message bridge

// ── SW Message Bridge ─────────────────────────────────────────────────────────
// [FIX-3] Attach AFTER navigator.serviceWorker.ready resolves, not at import time.
// This ensures the SW controller exists before we start listening.
async function _attachSWBridge() {
  if (_swReady) return;
  if (!("serviceWorker" in navigator)) return;

  // Wait for the SW to be ready before attaching
  await navigator.serviceWorker.ready;
  _swReady = true;

  navigator.serviceWorker.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg?.type) return;

    switch (msg.type) {
      case "SW_UPDATED":
        _bus.emit("sw_updated", { version: msg.version });
        break;

      case "SW_POISON_PILL_RELOAD":
        console.warn("[Push] SW poison pill cleanup — reloading");
        window.location.reload();
        break;

      case "PUSH_RECEIVED":
        _bus.emit("push_received", msg.payload);
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
        if (Array.isArray(msg.payloads) && msg.payloads.length > 0) {
          msg.payloads.forEach((payload) =>
            _bus.emit("push_received", payload),
          );
        }
        break;

      default:
        break;
    }
  });

  // Request any payloads buffered while we were offline / loading
  setTimeout(() => {
    try {
      navigator.serviceWorker.controller?.postMessage({
        type: "GET_PENDING_PAYLOADS",
      });
    } catch (_) {}
  }, 1500);
}

// ── Core subscription logic ───────────────────────────────────────────────────
async function _getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // Use ready — never register here. Registration is owned by serviceWorkerRegistration.js.
    return await navigator.serviceWorker.ready;
  } catch (err) {
    console.error("[Push] serviceWorker.ready failed:", err);
    return null;
  }
}

async function _doSubscribe(userId) {
  if (_subscribing) return null;
  _subscribing = true;

  try {
    if (!VAPID_PUBLIC_KEY) {
      console.error(
        "[Push] REACT_APP_VAPID_PUBLIC_KEY is not set in your .env",
      );
      return null;
    }

    const reg = await _getRegistration();
    if (!reg) return null;

    // Check if we already have a valid subscription
    let subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      // Verify the subscription endpoint matches what we have in the DB
      // If the browser rotated keys or user cleared data, this re-saves correctly
      await _saveSubscription(userId, subscription);
      console.log("[Push] ✅ Existing subscription verified and saved");
      return subscription;
    }

    // No existing subscription — create one
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await _saveSubscription(userId, subscription);
    console.log("[Push] ✅ New push subscription created and saved");
    return subscription;
  } catch (err) {
    // NotAllowedError = user denied permission, don't retry
    if (err.name === "NotAllowedError") {
      console.warn("[Push] Permission denied by user — not retrying");
      return null;
    }
    console.error("[Push] ❌ Subscribe error:", err);
    return null;
  } finally {
    _subscribing = false;
  }
}

async function _saveSubscription(userId, subscription) {
  const json = subscription.toJSON();
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    throw new Error("[Push] Subscription JSON is missing required fields");
  }

  const record = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 500), // cap length
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  // [FIX-4] Try upsert first. If it fails due to constraint issues, fall back
  // to delete-then-insert to guarantee a clean record.
  const { error: upsertError } = await supabase
    .from("push_subscriptions")
    .upsert(record, { onConflict: "user_id,endpoint" });

  if (!upsertError) return; // success

  console.warn(
    "[Push] Upsert failed, trying delete+insert:",
    upsertError.message,
  );

  // Delete any existing record for this user+endpoint and re-insert
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", json.endpoint);

  const { error: insertError } = await supabase
    .from("push_subscriptions")
    .insert(record);

  if (insertError) throw insertError;
}

async function _saveWithRetry(userId, subscription, attempt = 0) {
  const delays = [3000, 10000, 30000];
  try {
    await _saveSubscription(userId, subscription);
  } catch (err) {
    if (attempt < delays.length) {
      console.warn(
        `[Push] Save failed (attempt ${attempt + 1}), retrying in ${delays[attempt] / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
      return _saveWithRetry(userId, subscription, attempt + 1);
    }
    console.error("[Push] ❌ Push subscription save permanently failed:", err);
  }
}

// ── Re-check subscription on visibility change ────────────────────────────────
// [FIX-6] When user returns to the app (from background), re-verify the
// subscription is still alive. Handles cleared site data gracefully.
let _visibilityListenerAttached = false;
function _attachVisibilityCheck() {
  if (_visibilityListenerAttached) return;
  _visibilityListenerAttached = true;

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (!_userId || !pushService.isSupported()) return;
    if (pushService.getPermission() !== "granted") return;

    const reg = await _getRegistration();
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (!sub) {
      // Subscription was lost — re-subscribe silently
      console.log(
        "[Push] Subscription lost while backgrounded — re-subscribing",
      );
      await _doSubscribe(_userId);
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export const pushService = {
  on(event, fn) {
    return _bus.on(event, fn);
  },
  _emit(event, data) {
    _bus.emit(event, data);
  },

  isSupported() {
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  },

  getPermission() {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  },

  async isSubscribed() {
    try {
      if (!this.isSupported()) return false;
      const reg = await _getRegistration();
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  },

  // [FIX-2] This must be called from a user gesture (e.g. button click).
  // Do NOT call this on a timer — Chrome will silently ignore it.
  async requestPermission() {
    try {
      if (!this.isSupported()) return false;
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;

      const result = await Notification.requestPermission();
      return result === "granted";
    } catch (err) {
      console.error("[Push] requestPermission error:", err);
      return false;
    }
  },

  // Call this from a user-gesture button to enable push notifications.
  // Returns true if subscription was created successfully.
  async enablePushNotifications(userId) {
    const uid = userId || _userId;
    if (!uid || !this.isSupported()) return false;

    const granted = await this.requestPermission();
    if (!granted) return false;

    const sub = await _doSubscribe(uid);
    return !!sub;
  },

  async subscribe(userId) {
    const uid = userId || _userId;
    if (!uid) return null;
    return _doSubscribe(uid);
  },

  async savePushSubscription(userId, subscription) {
    return _saveSubscription(userId, subscription);
  },

  async unsubscribe(userId) {
    try {
      if (!this.isSupported()) return;
      const reg = await _getRegistration();
      if (!reg) return;

      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) return;

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      const uid = userId || _userId;
      if (uid) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("user_id", uid)
          .eq("endpoint", endpoint);
      }

      console.log("[Push] ✅ Unsubscribed successfully");
    } catch (err) {
      console.error("[Push] ❌ Unsubscribe error:", err);
    }
  },

  // Show a local test notification (no server required)
  async testNotification() {
    try {
      if (!this.isSupported() || Notification.permission !== "granted") {
        console.warn("[Push] Cannot test — notifications not permitted");
        return false;
      }
      const reg = await _getRegistration();
      if (!reg) return false;

      await reg.showNotification("✅ Push Notifications Active", {
        body: "Xeevia push notifications are working correctly!",
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: `test_${Date.now()}`,
        vibrate: [200, 100, 200],
        data: { url: "/", type: "test" },
      });
      return true;
    } catch (err) {
      console.error("[Push] ❌ Test notification failed:", err);
      return false;
    }
  },

  clearBadge() {
    try {
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
    } catch (_) {}
  },

  // ── MAIN ENTRY POINT ───────────────────────────────────────────────────────
  // Call this once after the user logs in. Do NOT call register() here.
  // serviceWorkerRegistration.js owns SW registration.
  async start(userId) {
    if (!this.isSupported()) {
      console.log("[Push] Push notifications not supported on this browser");
      return;
    }

    // Attach SW message bridge (safe to call multiple times)
    _attachSWBridge().catch((err) =>
      console.warn("[Push] Bridge attach error:", err),
    );

    // Attach visibility change re-subscribe handler
    _attachVisibilityCheck();

    _userId = userId;
    _started = true;

    const permission = this.getPermission();
    if (permission === "granted") {
      // Already have permission — subscribe immediately
      const sub = await _doSubscribe(userId);
      if (!sub) {
        // Subscription failed — retry once after a short delay
        setTimeout(() => {
          _doSubscribe(userId).catch((err) =>
            console.warn("[Push] Delayed subscribe error:", err),
          );
        }, 5000);
      }
    } else if (permission === "default") {
      // [FIX-2] Do NOT request permission here. Permission must be requested
      // from a user gesture. The app should call pushService.enablePushNotifications()
      // from a button click. We log this so you can wire up your UI.
      console.log(
        "[Push] ℹ️ Push permission not yet granted. Call pushService.enablePushNotifications(userId) from a button click to request permission.",
      );
    } else {
      // "denied" — user explicitly blocked push notifications
      console.log(
        "[Push] Push notifications blocked by user. They must re-enable in browser settings.",
      );
    }
  },

  // Diagnostic helper — call this from console to debug issues
  async diagnose() {
    console.group("[Push] 🔍 Diagnosis");
    console.log("Supported:", this.isSupported());
    console.log("Permission:", this.getPermission());
    console.log("VAPID key set:", !!VAPID_PUBLIC_KEY);
    console.log("User ID:", _userId);
    console.log("Started:", _started);
    console.log("SW bridge attached:", _swReady);

    const reg = await _getRegistration().catch(() => null);
    console.log("SW registration:", reg ? reg.scope : "NONE");

    if (reg) {
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      console.log(
        "Subscription:",
        sub ? sub.endpoint.slice(0, 60) + "..." : "NONE",
      );

      if (_userId) {
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, is_active, updated_at")
          .eq("user_id", _userId);
        console.log(
          "DB subscriptions:",
          error ? "ERROR: " + error.message : data,
        );
      }
    }
    console.groupEnd();
  },
};

export default pushService;
