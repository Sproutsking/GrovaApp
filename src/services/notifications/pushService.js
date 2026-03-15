// ============================================================================
// src/services/notifications/pushService.js — v3 DEDUP-SAFE
// ============================================================================
//
// KEY FIXES vs v2:
//   [1] _bridgeSWMessages now handles PUSH_RECEIVED from SW correctly.
//       SW posts PUSH_RECEIVED when app is focused → we fire "push_received"
//       typed event → InAppNotificationToast reacts.
//       SW posts NOTIFICATION_CLICKED when OS notif is tapped → we fire
//       "notification_clicked" → App navigates.
//   [2] "push_received" and "new_notification" are now SEPARATE events:
//       - "new_notification"  comes from notificationService realtime INSERT
//         → for ALL notification types (social, system, paywave, wallet)
//       - "push_received"     comes from SW bridge
//         → for PUSH notifications when app is focused (could be DM or notif)
//       InAppNotificationToast should listen to BOTH but deduplicate by id.
//   [3] subscribe() / on() / _bridgeSWMessages guard is preserved.
//   [4] start() is unchanged — called once from App.jsx.
// ============================================================================

import { supabase } from "../config/supabase";

const VAPID_PUBLIC_KEY =
  "BDJaPrUsqOthnp1Fvl2UdaEnU7ZhK-Fok-M2s4QH-sGdlnfwG5NaYFxVMplz93uQQ2pXhn1RYfMqLVVfCnA0Z5o";

// ── Tiny typed event bus ──────────────────────────────────────────────────────
class EventBus {
  constructor() { this._map = new Map(); }
  on(event, fn) {
    if (!this._map.has(event)) this._map.set(event, new Set());
    this._map.get(event).add(fn);
    return () => this._map.get(event)?.delete(fn);
  }
  emit(event, data) {
    this._map.get(event)?.forEach((fn) => { try { fn(data); } catch {} });
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

const _bus        = new EventBus();
let   _reg        = null;
let   _swListener = false;

export const pushService = {
  on(event, fn)       { return _bus.on(event, fn); },
  _emit(event, data)  { _bus.emit(event, data); },

  // =========================================================================
  // CORE API
  // =========================================================================

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
    try {
      if (!userId || !this.isSupported()) return null;
      const registration = _reg || (await navigator.serviceWorker.ready);
      let subscription   = await registration.pushManager.getSubscription();
      if (subscription) {
        await this.savePushSubscription(userId, subscription);
        return subscription;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await this.savePushSubscription(userId, subscription);
      console.log("✅ Push subscription created");
      return subscription;
    } catch (error) {
      console.error("❌ Failed to subscribe to push:", error);
      return null;
    }
  },

  async savePushSubscription(userId, subscription) {
    try {
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
        { onConflict: "user_id,endpoint", ignoreDuplicates: false },
      );
      if (error) throw error;
    } catch (error) {
      console.error("❌ Save subscription error:", error);
      throw error;
    }
  },

  async unsubscribe(userId) {
    try {
      if (!this.isSupported()) return;
      const registration = _reg || (await navigator.serviceWorker.ready);
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        if (userId) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("user_id", userId)
            .eq("endpoint", subscription.endpoint);
        }
      }
    } catch (error) {
      console.error("❌ Unsubscribe error:", error);
    }
  },

  async testNotification() {
    try {
      if (!this.isSupported() || Notification.permission !== "granted") return;
      const registration = _reg || (await navigator.serviceWorker.ready);
      await registration.showNotification("Test Notification", {
        body:    "This is a test notification from Xeevia",
        icon:    "/logo192.png",
        badge:   "/logo192.png",
        tag:     "test",
        vibrate: [200, 100, 200],
      });
    } catch (error) {
      console.error("❌ Test notification failed:", error);
    }
  },

  // =========================================================================
  // FULL INITIALIZATION (called once from App.jsx after auth)
  // =========================================================================

  async start(userId) {
    if (!this.isSupported()) return;
    try {
      _reg = await navigator.serviceWorker.register("/service-worker.js", {
        scope:          "/",
        updateViaCache: "none",
      });
      console.log("[Push] SW registered:", _reg.scope);
      this._watchForUpdates(_reg);
      this._bridgeSWMessages();
      const perm = this.getPermission();
      if (perm === "granted") {
        await this.subscribe(userId);
      } else if (perm === "default") {
        setTimeout(async () => {
          const granted = await this.requestPermission();
          if (granted) await this.subscribe(userId);
        }, 5_000);
      }
    } catch (err) {
      console.error("[Push] start error:", err);
    }
  },

  /**
   * Tell SW to clear the Android app-icon badge.
   * Called when the notification sidebar opens.
   */
  clearBadge() {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
  },

  // =========================================================================
  // INTERNAL
  // =========================================================================

  _watchForUpdates(reg) {
    if (!reg) return;
    if (reg.waiting) this._emit("sw_update_available", { registration: reg });
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          this._emit("sw_update_available", { registration: reg });
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

  /**
   * Bridge SW → app messages.
   *
   * PUSH_RECEIVED:
   *   SW detected push while app was focused → no OS notif was shown.
   *   We emit "push_received" so InAppNotificationToast can display it.
   *   This is intentionally SEPARATE from "new_notification" (Supabase realtime)
   *   so the toast can deduplicate: if "new_notification" already fired for the
   *   same notification id, "push_received" is a no-op (handled in toast).
   *
   * NOTIFICATION_CLICKED:
   *   User tapped an OS notification → navigate in-app.
   *
   * SW_UPDATED:
   *   New SW activated.
   */
  _bridgeSWMessages() {
    if (_swListener) return;
    _swListener = true;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg?.type) return;
      switch (msg.type) {
        case "SW_UPDATED":
          this._emit("sw_updated", { version: msg.version });
          break;
        case "PUSH_RECEIVED":
          // App was focused; SW handed the payload to us instead of OS popup
          this._emit("push_received", msg.payload);
          break;
        case "NOTIFICATION_CLICKED":
          // OS notification tapped while app was backgrounded
          this._emit("notification_clicked", { url: msg.url, data: msg.data });
          break;
        default:
          break;
      }
    });
  },
};

export default pushService;