// ============================================================================
// src/services/notifications/pushService.js — v8 FINAL
// ============================================================================
// Built directly on your original v7 code you shared earlier.
// Only minor improvements: better error handling, consistent userId storage, and safer subscribe guard.
// No major rewrites — your logic preserved.

import { supabase } from "../config/supabase";

// ── VAPID key ─────────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY =
  process.env.REACT_APP_VAPID_PUBLIC_KEY ||
  "BIn84fMl6xilxp_r9d_hEUKaZbz_qPbSnPEq2acCJ5X8w469WNF7FleDB_WCMSiAfD2c3zXcpKSFGBFjDdVP57k";

// ── Typed event bus (your original) ───────────────────────────────────────────
class EventBus {
  constructor() { this._map = new Map(); }
  on(event, fn) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(fn);
    return () => this._map.get(event)?.delete(fn);
  }
  emit(event, data) {
    this._map.get(event)?.forEach(fn => {
      try { fn(data); } catch (e) { console.error("[PushService] handler error:", e); }
    });
  }
}

// ── Utility: convert VAPID public key to Uint8Array (your original) ───────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// ── Module state (your original + small safety) ───────────────────────────────
const _bus        = new EventBus();
let   _reg        = null;
let   _started    = false;
let   _userId     = null;
let   _subscribing = false;

// ── Bridge setup (your exact code) ───────────────────────────────────────────
_setupSWBridge();

function _setupSWBridge() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg?.type) return;
    switch (msg.type) {
      case "SW_UPDATED":
        _bus.emit("sw_updated", { version: msg.version });
        break;
      case "SW_POISON_PILL_RELOAD":
        console.warn("[Push] SW poison pill — reloading");
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
          msg.payloads.forEach(payload => { _bus.emit("push_received", payload); });
        }
        break;
      default:
        break;
    }
  });
}

// ── Public API ───────────────────────────────────────────────────────────────
export const pushService = {
  on(event, fn)      { return _bus.on(event, fn); },
  _emit(event, data) { _bus.emit(event, data); },

  isSupported() {
    return (
      "Notification"     in window &&
      "serviceWorker"    in navigator &&
      "PushManager"      in window
    );
  },

  getPermission() {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  },

  async isSubscribed() {
    try {
      if (!this.isSupported()) return false;
      const registration = _reg || (await navigator.serviceWorker.ready);
      const sub = await registration.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  },

  async requestPermission() {
    try {
      if (!this.isSupported()) return false;
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch {
      return false;
    }
  },

  async subscribe(userId) {
    if (_subscribing) return null;
    try {
      if (!userId || !this.isSupported()) return null;
      if (!VAPID_PUBLIC_KEY) {
        console.warn("[Push] VAPID_PUBLIC_KEY not set");
        return null;
      }

      _subscribing = true;
      if (userId) _userId = userId;

      const registration = _reg || (await navigator.serviceWorker.ready);

      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await this._saveWithRetry(userId, subscription);
        console.log("[Push] ✅ Existing subscription saved");
        return subscription;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await this._saveWithRetry(userId, subscription);
      console.log("[Push] ✅ New subscription created and saved");
      return subscription;
    } catch (error) {
      console.error("[Push] ❌ Subscribe failed:", error);
      return null;
    } finally {
      _subscribing = false;
    }
  },

  async _saveWithRetry(userId, subscription, attempt = 0) {
    const delays = [5000, 15000, 45000];
    try {
      await this.savePushSubscription(userId, subscription);
    } catch (err) {
      if (attempt < delays.length) {
        console.warn(`[Push] Save failed, retrying in ${delays[attempt] / 1000}s…`, err);
        await new Promise(r => setTimeout(r, delays[attempt]));
        return this._saveWithRetry(userId, subscription, attempt + 1);
      }
      console.error("[Push] ❌ Save permanently failed after all retries:", err);
    }
  },

  async savePushSubscription(userId, subscription) {
    const json = subscription.toJSON();
    if (!json?.keys?.p256dh || !json?.keys?.auth) {
      throw new Error("[Push] Subscription missing keys — cannot save");
    }
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id:    userId,
        endpoint:   json.endpoint,
        p256dh:     json.keys.p256dh,
        auth:       json.keys.auth,
        user_agent: navigator.userAgent,
        is_active:  true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );
    if (error) throw error;
  },

  async unsubscribe(userId) {
    try {
      if (!this.isSupported()) return;
      const registration = _reg || (await navigator.serviceWorker.ready);
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        const uid = userId || _userId;
        if (uid) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("user_id", uid)
            .eq("endpoint", subscription.endpoint);
        }
        console.log("[Push] ✅ Unsubscribed");
      }
    } catch (error) {
      console.error("[Push] ❌ Unsubscribe error:", error);
    }
  },

  async testNotification() {
    try {
      if (!this.isSupported() || Notification.permission !== "granted") return;
      const registration = _reg || (await navigator.serviceWorker.ready);
      await registration.showNotification("✅ Test Notification", {
        body:    "Push notifications are working correctly on Xeevia!",
        icon:    "/logo192.png",
        badge:   "/logo192.png",
        tag:     `test_${Date.now()}`,
        vibrate: [200, 100, 200],
        data:    { url: "/", type: "test" },
      });
    } catch (error) {
      console.error("[Push] ❌ Test notification failed:", error);
    }
  },

  async start(userId) {
    if (!this.isSupported()) {
      console.log("[Push] Push not supported on this browser/device");
      return;
    }
    if (_started && _userId === userId) return;

    _started = true;
    _userId  = userId;

    try {
      _reg = await navigator.serviceWorker.register("/service-worker.js", {
        scope:          "/",
        updateViaCache: "none",
      });
      console.log("[Push] ✅ SW registered:", _reg.scope);

      this._watchForUpdates(_reg);

      setTimeout(() => {
        navigator.serviceWorker.controller?.postMessage({ type: "GET_PENDING_PAYLOADS" });
      }, 1500);

      const perm = this.getPermission();
      if (perm === "granted") {
        await this.subscribe(userId);
      } else if (perm === "default") {
        setTimeout(async () => {
          const granted = await this.requestPermission();
          if (granted) await this.subscribe(userId);
        }, 8000);
      } else {
        console.log("[Push] Permission denied — push notifications disabled");
      }
    } catch (err) {
      console.error("[Push] start error:", err);
    }
  },

  clearBadge() {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
  },

  _watchForUpdates(reg) {
    if (!reg) return;
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          _bus.emit("sw_update_available", { registration: reg });
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  },
};

export default pushService;