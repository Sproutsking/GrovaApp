// ============================================================================
// src/services/notifications/pushService.js
// ============================================================================
// Production-ready push service.
//
// ── Real service API (preserved exactly) ────────────────────────────────────
//   pushService.isSupported()
//   pushService.getPermission()
//   pushService.requestPermission()
//   pushService.subscribe(userId)           → creates/refreshes subscription
//   pushService.savePushSubscription(userId, sub)
//   pushService.unsubscribe(userId)
//   pushService.testNotification()
//
// ── New additions (non-breaking) ─────────────────────────────────────────────
//   pushService.start(userId)              → full init: SW reg + sub + listeners
//   pushService.on(event, fn)              → typed event bus (returns unsub fn)
//   pushService.clearBadge()              → tell SW to clear Android app-icon badge
//
//   Events emitted:
//     "push_received"         → payload: NotificationPayload  (app was focused)
//     "notification_clicked"  → payload: { url, data }        (OS notif tapped)
//     "sw_update_available"   → payload: { registration }     (new SW waiting)
//
// ── Protocol ─────────────────────────────────────────────────────────────────
//   App FOCUSED   → SW posts PUSH_RECEIVED  → in-app toast only  (no OS popup)
//   App BACKGROUND → SW shows OS notification → on click, SW posts NOTIFICATION_CLICKED
//
// ── Key detail ───────────────────────────────────────────────────────────────
//   ONLY incoming notifications trigger toasts.
//   Never for actions the current user takes on others' content.
//   The server/edge-function is responsible for this filter — we just display.
// ============================================================================

import { supabase } from "../config/supabase";

const VAPID_PUBLIC_KEY =
  "BDJaPrUsqOthnp1Fvl2UdaEnU7ZhK-Fok-M2s4QH-sGdlnfwG5NaYFxVMplz93uQQ2pXhn1RYfMqLVVfCnA0Z5o";

// ─── Tiny typed event bus ────────────────────────────────────────────────────
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
      } catch {}
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

// ─── Module-level state ───────────────────────────────────────────────────────
const _bus = new EventBus();
let _reg = null; // cached ServiceWorkerRegistration
let _swListener = false; // guard against double-adding the message listener

// ─── Service ──────────────────────────────────────────────────────────────────
export const pushService = {
  // ── Event bus ──────────────────────────────────────────────────────────────
  on(event, fn) {
    return _bus.on(event, fn);
  },
  _emit(event, data) {
    _bus.emit(event, data);
  },

  // =========================================================================
  // REAL SERVICE API (preserved exactly)
  // =========================================================================

  /**
   * Check if push notifications are supported in this browser.
   */
  isSupported() {
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  },

  /**
   * Get current notification permission status.
   */
  getPermission() {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  },

  /**
   * Request notification permission from user.
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      if (!this.isSupported()) {
        console.log("❌ Push notifications not supported");
        return false;
      }
      const permission = await Notification.requestPermission();
      console.log("🔔 Notification permission:", permission);
      return permission === "granted";
    } catch (error) {
      console.error("❌ Permission request failed:", error);
      return false;
    }
  },

  /**
   * Subscribe user to push notifications.
   * Reuses existing subscription if present, otherwise creates new one.
   * @param {string} userId
   * @returns {Promise<PushSubscription|null>}
   */
  async subscribe(userId) {
    try {
      if (!userId) {
        console.error("❌ No userId provided for subscription");
        return null;
      }
      if (!this.isSupported()) {
        console.log("❌ Push not supported, skipping subscription");
        return null;
      }

      const registration = _reg || (await navigator.serviceWorker.ready);

      // Reuse existing subscription
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log("📱 Existing push subscription found");
        await this.savePushSubscription(userId, subscription);
        return subscription;
      }

      // Create new subscription
      console.log("📱 Creating new push subscription…");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await this.savePushSubscription(userId, subscription);
      console.log("✅ Push subscription created and saved");
      return subscription;
    } catch (error) {
      console.error("❌ Failed to subscribe to push:", error);
      return null; // don't throw — non-fatal
    }
  },

  /**
   * Save push subscription to database.
   * Upserts on (user_id, endpoint) conflict.
   * @param {string} userId
   * @param {PushSubscription} subscription
   */
  async savePushSubscription(userId, subscription) {
    try {
      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint", ignoreDuplicates: false },
      );
      if (error) {
        console.error("❌ Failed to save subscription:", error);
        throw error;
      }
      console.log("✅ Push subscription saved to database");
    } catch (error) {
      console.error("❌ Save subscription error:", error);
      throw error;
    }
  },

  /**
   * Unsubscribe user from push notifications.
   * Marks DB record as inactive.
   * @param {string} [userId]
   */
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
        console.log("✅ Push subscription removed");
      }
    } catch (error) {
      console.error("❌ Failed to unsubscribe:", error);
      // Don't throw — non-fatal
    }
  },

  /**
   * Show a test notification (dev/debug only).
   */
  async testNotification() {
    try {
      if (!this.isSupported()) {
        alert("Push notifications not supported");
        return;
      }
      if (Notification.permission !== "granted") {
        alert("Please grant notification permission first");
        return;
      }
      const registration = _reg || (await navigator.serviceWorker.ready);
      await registration.showNotification("Test Notification", {
        body: "This is a test notification from Xeevia",
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: "test",
        vibrate: [200, 100, 200],
      });
      console.log("✅ Test notification shown");
    } catch (error) {
      console.error("❌ Test notification failed:", error);
      alert("Failed to show test notification");
    }
  },

  // =========================================================================
  // NEW ADDITIONS (non-breaking)
  // =========================================================================

  /**
   * Full initialization — SW registration + update watcher + SW message bridge
   * + push subscription (after permission check).
   *
   * Called once from App.jsx after auth is confirmed.
   * @param {string} userId
   */
  async start(userId) {
    if (!this.isSupported()) return;

    try {
      // Register service worker
      _reg = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
        updateViaCache: "none",
      });
      console.log("[Push] SW registered:", _reg.scope);

      this._watchForUpdates(_reg);
      this._bridgeSWMessages();

      // Handle push subscription based on current permission
      const perm = this.getPermission();
      if (perm === "granted") {
        await this.subscribe(userId);
      } else if (perm === "default") {
        // Delay permission request so it doesn't interrupt onboarding
        setTimeout(async () => {
          const granted = await this.requestPermission();
          if (granted) await this.subscribe(userId);
        }, 5_000);
      }
      // perm === "denied" → do nothing, user has explicitly blocked
    } catch (err) {
      console.error("[Push] start error:", err);
    }
  },

  /**
   * Tell the SW to clear the Android app-icon badge.
   * Called when the notification sidebar opens.
   */
  clearBadge() {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
  },

  // =========================================================================
  // INTERNAL
  // =========================================================================

  /** Watch for SW updates — emit "sw_update_available" when new SW is waiting. */
  _watchForUpdates(reg) {
    if (!reg) return;

    // Already has a waiting SW (e.g. page was hard-reloaded)
    if (reg.waiting) {
      this._emit("sw_update_available", { registration: reg });
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          this._emit("sw_update_available", { registration: reg });
        }
      });
    });

    // When the new SW activates → reload so users get the fresh app
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  },

  /**
   * Bridge SW → app messages.
   * SW posts PUSH_RECEIVED / NOTIFICATION_CLICKED / SW_UPDATED
   * → pushService re-emits as typed events.
   * Guard ensures listener is added only once.
   */
  _bridgeSWMessages() {
    if (_swListener) return;
    _swListener = true;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg?.type) return;

      switch (msg.type) {
        // SW activated a new version
        case "SW_UPDATED":
          this._emit("sw_updated", { version: msg.version });
          break;

        // Push arrived while app was focused → show in-app toast, no OS popup
        case "PUSH_RECEIVED":
          this._emit("push_received", msg.payload);
          break;

        // User tapped an OS notification → navigate in-app
        case "NOTIFICATION_CLICKED":
          this._emit("notification_clicked", { url: msg.url, data: msg.data });
          break;

        default:
          break;
      }
    });
  },
};

export default pushService;
