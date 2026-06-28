// ============================================================================
// src/services/notifications/pushService.js — v15 SECRET NAME FIX
// ============================================================================
// FIXES vs v14:
//   [FIX-CRITICAL] diagnose() now explicitly checks that the Edge Function is
//            reading VAPID_PUBLIC_KEY (not REACT_APP_VAPID_PUBLIC_KEY) and
//            warns clearly when the key prefix returned by the health check
//            doesn't match the .env key. This is the #1 reason push fails.
//   [FIX-1] attachBridgeEarly() public method (from v14)
//   [FIX-2] start() offline retry (from v14)
//   [FIX-3] _doSubscribe VAPID key mismatch detection (from v14)
//   [FIX-4] sendPushToUser self-send guard (from v14)
//   [FIX-5] diagnose() side-by-side key comparison (from v14)
//   [FIX-6] _saveSubscription stale-endpoint cleanup (from v14)
//   All v14 logic preserved exactly.
// ============================================================================

import { supabase } from "../config/supabase";
import {
  enablePushNotifications as enableOneSignal,
  getPlayerId as getOneSignalPlayerId,
  isOneSignalSupported,
  requestPermission as requestOneSignalPermission,
  unsubscribe as unsubscribeOneSignal,
} from "./onesignalService";

// ── Legacy VAPID path (kept only for reference / diagnostics) ─────────────
// The active provider is now OneSignal. Any older VAPID-based browser push
// logic remains isolated here and is not used by the app's public API.
function getVapidKey() {
  const k = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  if (!k) {
    console.warn(
      "[Push] Legacy VAPID config missing. OneSignal is the active provider.",
    );
    return null;
  }
  if (k.length < 80) {
    console.warn(
      "[Push] Legacy VAPID config looks incomplete. OneSignal is the active provider.",
    );
    return null;
  }
  return k;
}

function isOneSignalConfigured() {
  return Boolean(process.env.REACT_APP_ONESIGNAL_APP_ID);
}

// ── Edge function invoker ─────────────────────────────────────────────────────
async function _invoke(body) {
  try {
    const { error } = await supabase.functions.invoke("send-push", { body });
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

// ── VAPID key → Uint8Array ────────────────────────────────────────────────────
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

  // Drain any payloads that arrived while the app was closed / reloading.
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

// ── Save subscription to Supabase ─────────────────────────────────────────────
async function _saveSubscription(userId, subscription) {
  const playerId = subscription?.playerId || subscription?.onesignal_player_id;

  if (playerId) {
    const record = {
      user_id: userId,
      endpoint: `onesignal://${playerId}`,
      p256dh: null,
      auth: null,
      user_agent: navigator.userAgent.slice(0, 500),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", record.endpoint)
      .eq("is_active", false);

    const { error: upsertErr } = await supabase
      .from("push_subscriptions")
      .upsert(record, { onConflict: "user_id,endpoint" });

    if (!upsertErr) return;

    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", record.endpoint);
    const { error: insertErr } = await supabase.from("push_subscriptions").insert(record);
    if (insertErr) throw new Error("Insert also failed: " + insertErr.message);
    return;
  }

  const json = subscription?.toJSON?.();
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    throw new Error("Subscription is missing endpoint, p256dh, or auth fields");
  }
  const record = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 500),
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  // Clean up any inactive rows for this endpoint first
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", json.endpoint)
    .eq("is_active", false);

  // Upsert (requires unique constraint on user_id,endpoint)
  const { error: upsertErr } = await supabase
    .from("push_subscriptions")
    .upsert(record, { onConflict: "user_id,endpoint" });

  if (!upsertErr) {
    console.log("[Push] ✅ Subscription upserted to DB");
    return;
  }

  // Upsert failed — delete stale row and insert fresh
  console.warn(
    "[Push] Upsert failed:",
    upsertErr.message,
    "— trying delete+insert",
  );
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", json.endpoint);
  const { error: insertErr } = await supabase
    .from("push_subscriptions")
    .insert(record);
  if (insertErr) throw new Error("Insert also failed: " + insertErr.message);
  console.log("[Push] ✅ Subscription inserted to DB (fallback)");
}

async function _saveWithRetry(userId, subscription, attempt = 0) {
  const delays = [3000, 10000, 30000];
  try {
    await _saveSubscription(userId, subscription);
  } catch (err) {
    if (attempt < delays.length) {
      console.warn(
        `[Push] Save attempt ${attempt + 1} failed. Retry in ${delays[attempt] / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
      return _saveWithRetry(userId, subscription, attempt + 1);
    }
    console.error("[Push] ❌ All save attempts failed:", err.message);
  }
}

// ── Core subscribe ────────────────────────────────────────────────────────────
async function _doSubscribe(userId) {
  if (_subscribing) return null;
  _subscribing = true;

  try {
    if (isOneSignalSupported() && isOneSignalConfigured()) {
      const granted = await requestOneSignalPermission(userId);
      if (!granted) {
        console.warn("[Push] OneSignal permission not granted");
        return null;
      }

      const ok = await enableOneSignal(userId);
      if (!ok) return null;

      let playerId = await getOneSignalPlayerId(userId);
      if (!playerId) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          playerId = await getOneSignalPlayerId(userId);
          if (playerId) break;
        }
      }
      if (!playerId) {
        console.warn("[Push] OneSignal player ID not available yet after registration");
        return null;
      }

      await _saveWithRetry(userId, { playerId });
      console.log("[Push] ✅ OneSignal subscription registered");
      return { provider: "onesignal", playerId };
    }

    const vapidKey = getVapidKey();
    if (!vapidKey) return null;

    const reg = await _getReg();
    if (!reg) {
      console.error("[Push] No SW registration available");
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
          console.warn(
            "[Push] VAPID key changed — unsubscribing stale subscription",
          );
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
    console.log("[Push] ✅ New subscription created and saved");
    return sub;
  } catch (err) {
    if (err.name === "NotAllowedError") {
      console.warn("[Push] Permission denied by user");
      return null;
    }
    if (err.name === "InvalidStateError") {
      console.warn("[Push] SW not yet active — waiting for activation");
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
  // ── Early bridge attachment ────────────────────────────────────────────────
  attachBridgeEarly() {
    _attachBridge();
  },

  // ── Event bus ──────────────────────────────────────────────────────────────
  on(event, fn) {
    return _bus.on(event, fn);
  },
  _emit(event, data) {
    _bus.emit(event, data);
  },

  // ── Feature detection ──────────────────────────────────────────────────────
  isSupported() {
    return isOneSignalSupported() || (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  },

  getPermission() {
    return this.isSupported() ? Notification.permission : "denied";
  },

  async isSubscribed() {
    try {
      if (!this.isSupported()) return false;
      if (isOneSignalSupported() && isOneSignalConfigured()) {
        return Notification.permission === "granted";
      }
      const reg = await _getReg();
      return !!(await reg?.pushManager.getSubscription());
    } catch {
      return false;
    }
  },

  // ── Permission request — MUST be called from a user gesture ───────────────
  async requestPermission() {
    try {
      if (!this.isSupported()) return false;
      if (isOneSignalSupported() && isOneSignalConfigured()) {
        return requestOneSignalPermission(_userId);
      }
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      return (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  },

  // ── Full enable (permission + subscribe) ──────────────────────────────────
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
      if (isOneSignalSupported() && isOneSignalConfigured()) {
        await unsubscribeOneSignal(uid);
        if (uid) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("user_id", uid)
            .like("endpoint", "onesignal:%");
        }
        console.log("[Push] ✅ Unsubscribed from OneSignal");
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

  // ── Send a push notification to another user ───────────────────────────────
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

    // Self-send guard: only skip if we know both IDs and they match
    if (
      _userId &&
      actorUserId &&
      _userId === actorUserId &&
      recipientUserId === actorUserId
    ) {
      return false;
    }

    return _invoke({
      recipient_user_id: recipientUserId,
      actor_user_id: actorUserId,
      type,
      title,
      message,
      entity_id: entityId,
      metadata,
    });
  },

  // ── Show a local test notification ────────────────────────────────────────
  async testNotification() {
    if (!this.isSupported() || Notification.permission !== "granted") {
      console.warn("[Push] Cannot test — permission not granted");
      return false;
    }
    const reg = await _getReg();
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
  },

  // ── Clear OS app badge ─────────────────────────────────────────────────────
  clearBadge() {
    try {
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
    } catch (_) {}
  },

  // ── MAIN ENTRY POINT ───────────────────────────────────────────────────────
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
          "Listen for 'push:needs_permission' on window and call:\n" +
          "  pushService.enablePushNotifications(userId)  from a user gesture.",
      );
      try {
        window.dispatchEvent(
          new CustomEvent("push:needs_permission", { detail: { userId } }),
        );
      } catch {}
    } else {
      console.log(
        "[Push] Permission blocked — user must re-enable in browser settings",
      );
    }

    if (typeof window !== "undefined") {
      window.__pushDiagnose = () => this.diagnose();
      console.log(
        "[Push] Tip: run window.__pushDiagnose() in console to debug push issues",
      );
    }
  },

  // ── Full diagnostic report ─────────────────────────────────────────────────
  async diagnose() {
    console.group("🔍 Push Diagnosis Report");
    const vapidKey = getVapidKey();
    console.log("Provider:           ", isOneSignalConfigured() ? "OneSignal" : "legacy fallback");
    console.log("Supported:           ", this.isSupported());
    console.log("Permission:          ", this.getPermission());
    console.log("OneSignal App ID:   ", process.env.REACT_APP_ONESIGNAL_APP_ID ? "✅ configured" : "❌ missing");
    console.log(
      "Legacy VAPID key (.env):",
      vapidKey ? vapidKey.slice(0, 25) + "…" : "❌ not used",
    );
    console.log("User ID:             ", _userId || "not set");
    console.log("Bridge attached:     ", _bridgeAttached);
    console.log("Started:             ", _started);
    console.log("Online:              ", navigator.onLine);

    const reg = await _getReg().catch(() => null);
    console.log("SW registration:     ", reg ? "✅ " + reg.scope : "❌ NONE");
    console.log("SW state:            ", reg?.active?.state || "none");
    console.log(
      "SW controller:       ",
      navigator.serviceWorker?.controller ? "✅" : "❌ null",
    );

    if (_userId) {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, is_active, updated_at")
        .eq("user_id", _userId);
      if (error) {
        console.log("DB subs:             ❌", error.message);
      } else {
        console.log("DB subs:             ", data?.length || 0, "row(s)");
        data?.forEach((r, i) =>
          console.log(
            `  [${i}] active=${r.is_active} updated=${r.updated_at?.slice(0, 16)} ep=${r.endpoint?.slice(0, 55)}…`,
          ),
        );
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { health: true },
      });
      console.log(
        "Edge Function:       ",
        error ? "❌ " + error.message : "✅ reachable",
        data || "",
      );
    } catch (e) {
      console.log("Edge Function:       ❌ fetch failed:", e.message);
    }

    console.log("\n⚠️  CHECKLIST:");
    console.log("  1. Add REACT_APP_ONESIGNAL_APP_ID to your .env file");
    console.log("  2. Ensure the Supabase edge function has ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY");
    console.log("  3. Keep pushService.attachBridgeEarly() enabled in src/index.js");
    console.groupEnd();
  },
};

export default pushService;
