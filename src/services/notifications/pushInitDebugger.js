// ============================================================================
// src/services/notifications/pushInitDebugger.js
// ============================================================================
// Enhanced debugging for push notification initialization

import { pushService } from "./pushService";
import { isOneSignalConfigured } from "./onesignalService";

const debugLog = [];

function log(msg, data = null) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  debugLog.push({ msg, data, time: Date.now() });
  console.log(`[PushDebug] ${entry}`, data || "");
  window.__pushDebugLog = debugLog;
}

export const pushInitDebugger = {
  init() {
    log("Push debugger initialized");

    // Check configuration
    log("Checking push configuration...");
    log(`OneSignal configured: ${isOneSignalConfigured()}`);
    log(`Notification API supported: ${'Notification' in window}`);
    log(`Service Worker supported: ${'serviceWorker' in navigator}`);
    log(`Push Manager supported: ${'PushManager' in window}`);
    log(`Current permission: ${Notification.permission}`);
    log(`Browser online: ${navigator.onLine}`);

    // Monitor pushService
    const originalStart = pushService.start.bind(pushService);
    pushService.start = async function(userId) {
      log(`pushService.start called with userId: ${userId}`);
      try {
        const result = await originalStart(userId);
        log(`pushService.start completed`, result);
        return result;
      } catch (e) {
        log(`pushService.start ERROR: ${e.message}`, e);
        throw e;
      }
    };

    // Monitor subscription
    const originalSubscribe = pushService.subscribe.bind(pushService);
    pushService.subscribe = async function(userId) {
      log(`pushService.subscribe called with userId: ${userId}`);
      try {
        const result = await originalSubscribe(userId);
        log(`pushService.subscribe completed`, result);
        return result;
      } catch (e) {
        log(`pushService.subscribe ERROR: ${e.message}`, e);
        throw e;
      }
    };

    // Monitor enable
    const originalEnable = pushService.enablePushNotifications.bind(pushService);
    pushService.enablePushNotifications = async function(userId) {
      log(`pushService.enablePushNotifications called with userId: ${userId}`);
      try {
        const result = await originalEnable(userId);
        log(`pushService.enablePushNotifications completed`, result);
        return result;
      } catch (e) {
        log(`pushService.enablePushNotifications ERROR: ${e.message}`, e);
        throw e;
      }
    };

    // Listen for push events
    window.addEventListener("push:needs_permission", (e) => {
      log("Event: push:needs_permission", e.detail);
    });

    // Monitor OneSignal SDK
    if (typeof window.OneSignal !== 'undefined') {
      log("OneSignal SDK detected");
      setTimeout(() => {
        window.OneSignal?.getDeviceState?.().then(state => {
          log("OneSignal device state", state);
        }).catch(e => {
          log(`OneSignal getDeviceState error: ${e.message}`);
        });
      }, 1000);
    } else {
      log("OneSignal SDK NOT detected");
    }
  },

  getReport() {
    return {
      logs: debugLog,
      config: {
        oneSignalConfigured: isOneSignalConfigured(),
        notificationSupported: 'Notification' in window,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        pushManagerSupported: 'PushManager' in window,
        permission: Notification.permission,
        online: navigator.onLine,
      },
      state: {
        timestamp: Date.now(),
      },
    };
  },

  exportReport() {
    const report = this.getReport();
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `push-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
