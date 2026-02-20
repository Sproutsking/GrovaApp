// ============================================================================
// src/services/notifications/pushService.js - PRODUCTION-READY PUSH SERVICE
// ============================================================================

import { supabase } from "../config/supabase";

const VAPID_PUBLIC_KEY =
  "BDJaPrUsqOthnp1Fvl2UdaEnU7ZhK-Fok-M2s4QH-sGdlnfwG5NaYFxVMplz93uQQ2pXhn1RYfMqLVVfCnA0Z5o";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  /**
   * Check if push notifications are supported
   */
  isSupported() {
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  },

  /**
   * Get current notification permission status
   */
  getPermission() {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  },

  /**
   * Request notification permission from user
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
   * Subscribe user to push notifications
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

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      console.log("✅ Service worker ready");

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        console.log("📱 Existing push subscription found");
        await this.savePushSubscription(userId, subscription);
        return subscription;
      }

      // Create new subscription
      console.log("📱 Creating new push subscription...");
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await this.savePushSubscription(userId, subscription);
      console.log("✅ Push subscription created and saved");
      return subscription;
    } catch (error) {
      console.error("❌ Failed to subscribe to push:", error);
      // Don't throw - just log and continue
      return null;
    }
  },

  /**
   * Save push subscription to database
   */
  async savePushSubscription(userId, subscription) {
    try {
      const subscriptionJson = subscription.toJSON();

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          user_agent: navigator.userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
          ignoreDuplicates: false,
        },
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
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId) {
    try {
      if (!this.isSupported()) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
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
      // Don't throw - just log
    }
  },

  /**
   * Test push notification (for debugging)
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

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Test Notification", {
        body: "This is a test notification from Grova",
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
};
