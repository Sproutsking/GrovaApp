// ============================================================================
// src/services/notifications/pushService.js — v6 CRA-FIXED
// ============================================================================
// CHANGE v6:
//  Removed import.meta.env.VITE_* (that's Vite-only).
//  Uses process.env.REACT_APP_VAPID_PUBLIC_KEY instead (CRA convention).
//  Add this to your .env file (NOT .env.local):
//    REACT_APP_VAPID_PUBLIC_KEY=<your full VAPID_PUBLIC_KEY from Supabase secrets>
//
//  All existing P-1 through P-8 fixes preserved exactly.
// ============================================================================

import { supabase } from "../config/supabase";

// ✅ CRA uses process.env.REACT_APP_* — add to your .env file
// REACT_APP_VAPID_PUBLIC_KEY=<paste your full key from Supabase secrets here>
const VAPID_PUBLIC_KEY =
  process.env.REACT_APP_VAPID_PUBLIC_KEY ||
  ""; // ← If blank, paste your full key directly here as a string fallback

// ── Typed event bus ────────────────────────────────────────────────────────────
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

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

const _bus     = new EventBus();
let   _reg     = null;
let   _started = false;
let   _userId  = null;

// [P-1] Bridge set up at module evaluation — before start() is ever called
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

export const pushService = {
  on(event, fn)      { return _bus.on(event, fn); },
  _emit(event, data) { _bus.emit(event, data); },

  isSupported() {
    return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  },

  getPermission() {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  },

  async requestPermission() {
    try {
      if (!this.isSupported()) return false;
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch { return false; }
  },

  async subscribe(userId) {
    try {
      if (!userId || !this.isSupported()) return null;
      if (!VAPID_PUBLIC_KEY) {
        console.warn("[Push] VAPID_PUBLIC_KEY not set. Add REACT_APP_VAPID_PUBLIC_KEY to your .env file.");
        return null;
      }
      const registration = _reg || (await navigator.serviceWorker.ready);
      let subscription   = await registration.pushManager.getSubscription();
      if (subscription) {
        await this._saveWithRetry(userId, subscription);
        return subscription;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await this._saveWithRetry(userId, subscription);
      console.log("[Push] ✅ Subscription created");
      return subscription;
    } catch (error) {
      console.error("[Push] ❌ Subscribe failed:", error);
      return null;
    }
  },

  async _saveWithRetry(userId, subscription, attempt = 0) {
    try {
      await this.savePushSubscription(userId, subscription);
    } catch (err) {
      if (attempt === 0) {
        console.warn("[Push] Save failed, retrying in 5s...", err);
        await new Promise(r => setTimeout(r, 5000));
        return this._saveWithRetry(userId, subscription, 1);
      }
      console.error("[Push] ❌ Save permanently failed:", err);
    }
  },

  async savePushSubscription(userId, subscription) {
    const json = subscription.toJSON();
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
      { onConflict: "user_id,endpoint", ignoreDuplicates: false }
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
        if (userId) {
          await supabase.from("push_subscriptions")
            .update({ is_active: false })
            .eq("user_id", userId)
            .eq("endpoint", subscription.endpoint);
        }
      }
    } catch (error) { console.error("[Push] ❌ Unsubscribe error:", error); }
  },

  async testNotification() {
    try {
      if (!this.isSupported() || Notification.permission !== "granted") return;
      const registration = _reg || (await navigator.serviceWorker.ready);
      await registration.showNotification("Test Notification", {
        body: "This is a test notification from Xeevia",
        icon: "/logo192.png", badge: "/logo192.png",
        tag: `test_${Date.now()}`, vibrate: [200, 100, 200],
      });
    } catch (error) { console.error("[Push] ❌ Test notification failed:", error); }
  },

  async start(userId) {
    if (!this.isSupported()) return;
    if (_started && _userId === userId) return;
    _started = true;
    _userId  = userId;
    try {
      _reg = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/", updateViaCache: "none",
      });
      console.log("[Push] SW registered:", _reg.scope);
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
        }, 8_000);
      }
    } catch (err) { console.error("[Push] start error:", err); }
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