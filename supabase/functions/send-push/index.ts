// ============================================================================
// supabase/functions/send-push/index.ts  — XEEVIA v2
// ============================================================================
// Called by DB triggers (via pg_net) for every notification event.
//
// Notification model:
//   INCOMING  → others acted on your content  (like, comment, follow, etc.)
//   CREATOR   → a creator you follow posted   (new_post, new_story, new_reel)
//   FEEDBACK  → your own important actions    (story_unlocked_by_you, milestone, payment)
//
// Self-action filter is enforced in DB triggers before this is called.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ── VAPID config (set in Supabase Dashboard → Functions → Secrets) ──────────
const VAPID_PUBLIC_KEY        = Deno.env.get("VAPID_PUBLIC_KEY")        ?? "";
const VAPID_PRIVATE_KEY       = Deno.env.get("VAPID_PRIVATE_KEY")       ?? "";
const VAPID_SUBJECT           = Deno.env.get("VAPID_SUBJECT")           ?? "mailto:support@xeevia.com";
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")            ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type":                 "application/json",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface PushPayload {
  recipient_user_id: string;
  actor_user_id?:    string | null;
  type:              string;
  message:           string;
  entity_id?:        string | null;
  metadata?:         Record<string, unknown>;
}

interface PushSubscriptionRecord {
  id:         string;
  endpoint:   string;
  p256dh:     string;
  auth:       string;
  user_agent?: string;
}

// ── VAPID helpers (identical to v1) ─────────────────────────────────────────
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function buildVapidAuthHeader(endpoint: string): Promise<string> {
  const url       = new URL(endpoint);
  const audience  = `${url.protocol}//${url.hostname}`;
  const header    = { typ: "JWT", alg: "ES256" };
  const now       = Math.floor(Date.now() / 1000);
  const payload   = { aud: audience, exp: now + 12 * 3600, sub: VAPID_SUBJECT };

  const headerB64  = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = Uint8Array.from(
    atob(VAPID_PRIVATE_KEY.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"],
  );

  const signature    = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `vapid t=${headerB64}.${payloadB64}.${signatureB64}, k=${VAPID_PUBLIC_KEY}`;
}

async function encryptPayload(
  subscription: { p256dh: string; auth: string },
  payload: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: CryptoKey }> {
  const p256dhBytes = Uint8Array.from(
    atob(subscription.p256dh.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0),
  );
  const authBytes = Uint8Array.from(
    atob(subscription.auth.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0),
  );

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"],
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw", p256dhBytes, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey }, serverKeyPair.privateKey, 256,
  );

  const salt             = crypto.getRandomValues(new Uint8Array(16));
  const serverPublicKeyRaw = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey);

  const prkKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]);
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prk = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authBytes, info: authInfo }, prkKey, 256);

  const serverPubKeyBytes = new Uint8Array(serverPublicKeyRaw);
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    0x41, ...serverPubKeyBytes, 0x41, ...p256dhBytes,
  ]);

  const prkKey2 = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]);
  const aesKey  = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfo },
    prkKey2, { name: "AES-GCM", length: 128 }, false, ["encrypt"],
  );

  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: nonce\0"),
    0x41, ...serverPubKeyBytes, 0x41, ...p256dhBytes,
  ]);
  const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, prkKey2, 96);
  const nonce     = new Uint8Array(nonceBits);

  const payloadBytes  = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 2);

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload);

  return { body: new Uint8Array(encrypted), salt, serverPublicKey: serverKeyPair.publicKey };
}

async function sendWebPush(
  sub: PushSubscriptionRecord,
  notificationPayload: string,
): Promise<{ success: boolean; shouldRemove: boolean }> {
  try {
    const vapidAuth = await buildVapidAuthHeader(sub.endpoint);
    const { body, salt, serverPublicKey } = await encryptPayload({ p256dh: sub.p256dh, auth: sub.auth }, notificationPayload);

    const serverPubKeyRaw = await crypto.subtle.exportKey("raw", serverPublicKey);
    const serverPubKeyB64 = base64UrlEncode(new Uint8Array(serverPubKeyRaw));
    const saltB64         = base64UrlEncode(salt);

    const response = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization:    vapidAuth,
        "Content-Type":   "application/octet-stream",
        "Content-Encoding": "aesgcm",
        Encryption:       `salt=${saltB64}`,
        "Crypto-Key":     `dh=${serverPubKeyB64};vapid`,
        TTL:              "86400",
      },
      body,
    });

    if (response.ok || response.status === 201) return { success: true,  shouldRemove: false };
    if (response.status === 410 || response.status === 404) return { success: false, shouldRemove: true };
    if (response.status === 429) return { success: false, shouldRemove: false };

    console.error(`Push failed ${response.status}: ${await response.text()}`);
    return { success: false, shouldRemove: false };
  } catch (err) {
    console.error("sendWebPush error:", err);
    return { success: false, shouldRemove: false };
  }
}

// ── Notification copy + URL routing ─────────────────────────────────────────
function getNotificationUrl(type: string, entityId?: string | null, actorId?: string | null): string {
  switch (type) {
    case "like":
    case "comment":
    case "comment_reply":
    case "share":
    case "new_post":        return entityId ? `/post/${entityId}`    : "/";
    case "new_reel":        return entityId ? `/reel/${entityId}`    : "/";
    case "new_story":
    case "story_unlocked_by_you":
    case "unlock":          return entityId ? `/story/${entityId}`   : "/";
    case "follow":
    case "profile_view":    return actorId  ? `/profile/${actorId}`  : "/";
    case "milestone_followers":
    case "payment_confirmed": return "/account";
    case "mention":         return entityId ? `/post/${entityId}`    : "/";
    default:                return "/";
  }
}

function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    like:                   "❤️",
    comment:                "💬",
    comment_reply:          "↩️",
    follow:                 "👤",
    profile_view:           "👁️",
    unlock:                 "🔓",
    share:                  "🔁",
    new_post:               "📝",
    new_story:              "📖",
    new_reel:               "🎬",
    story_unlocked_by_you:  "✅",
    milestone_followers:    "🎉",
    payment_confirmed:      "💳",
    mention:                "📣",
  };
  return icons[type] || "🔔";
}

function getNotificationActions(type: string): Array<{ action: string; title: string }> {
  switch (type) {
    case "follow":
      return [{ action: "view", title: "View Profile" }, { action: "dismiss", title: "Dismiss" }];
    case "new_post":
    case "new_reel":
    case "new_story":
      return [{ action: "view", title: "View Now" }, { action: "dismiss", title: "Later" }];
    case "milestone_followers":
      return [{ action: "view", title: "View Profile" }, { action: "dismiss", title: "OK" }];
    default:
      return [{ action: "view", title: "View" }, { action: "dismiss", title: "Dismiss" }];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured in Supabase secrets");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: PushPayload = await req.json();
    const { recipient_user_id, actor_user_id, type, message, entity_id, metadata = {} } = body;

    if (!recipient_user_id || !type || !message) {
      return new Response(
        JSON.stringify({ error: "recipient_user_id, type, and message are required" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // ── Get actor info ────────────────────────────────────────────────────
    let actorName   = "Someone";
    let actorAvatar: string | null = null;

    if (actor_user_id && actor_user_id !== recipient_user_id) {
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_id")
        .eq("id", actor_user_id)
        .single();

      if (actorProfile) {
        actorName   = actorProfile.full_name || actorProfile.username || "Someone";
        actorAvatar = actorProfile.avatar_id || null;
      }
    }

    // ── Check recipient is active ─────────────────────────────────────────
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("preferences, account_status")
      .eq("id", recipient_user_id)
      .single();

    if (recipientProfile?.account_status !== "active") {
      return new Response(JSON.stringify({ sent: 0, reason: "recipient_inactive" }), { headers: CORS_HEADERS });
    }

    // ── Check global preference flags on the recipient's profile ─────────
    const prefs = recipientProfile?.preferences || {};
    const prefMap: Record<string, string> = {
      like:                   "notify_likes",
      comment:                "notify_comments",
      comment_reply:          "notify_comments",
      follow:                 "notify_followers",
      share:                  "notify_shares",
      unlock:                 "notify_unlocks",
      profile_view:           "notify_profile_visits",
      // Creator-notify types don't map to global prefs (they use notification_preferences table)
    };

    const globalPrefKey = prefMap[type];
    if (globalPrefKey && prefs[globalPrefKey] === false) {
      return new Response(JSON.stringify({ sent: 0, reason: "preference_disabled" }), { headers: CORS_HEADERS });
    }

    // ── Get push subscriptions ────────────────────────────────────────────
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_agent")
      .eq("user_id", recipient_user_id)
      .eq("is_active", true);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { headers: CORS_HEADERS });
    }

    // ── Build notification payload ────────────────────────────────────────
    const icon    = getNotificationIcon(type);
    const titlePrefix = type.startsWith("milestone") || type.startsWith("story_unlocked") || type.startsWith("payment")
      ? "Xeevia"
      : (actorName || "Xeevia");

    const notificationPayload = JSON.stringify({
      title: `${icon} ${titlePrefix}`,
      body:  message,
      icon:  "/logo192.png",
      badge: "/logo192.png",
      tag:   `${type}-${entity_id || Date.now()}`,
      timestamp: Date.now(),
      requireInteraction: ["follow", "milestone_followers", "payment_confirmed"].includes(type),
      vibrate: type === "milestone_followers" ? [200, 100, 200, 100, 200] : [200, 100, 200],
      actions: getNotificationActions(type),
      data: {
        type,
        entity_id:       entity_id    || null,
        actor_user_id:   actor_user_id || null,
        actor_name:      actorName,
        actor_avatar:    actorAvatar,
        url:             getNotificationUrl(type, entity_id, actor_user_id),
        timestamp:       Date.now(),
        ...metadata,
      },
    });

    // ── Send to all subscriptions in parallel ─────────────────────────────
    const results  = await Promise.allSettled(
      subscriptions.map((sub) => sendWebPush(sub, notificationPayload)),
    );

    let sentCount  = 0;
    const toRemove: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value.success)     sentCount++;
        if (result.value.shouldRemove) toRemove.push(subscriptions[index].id);
      }
    });

    // Clean up expired subscriptions
    if (toRemove.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", toRemove);
    }

    console.log(`✅ Push [${type}] → ${sentCount}/${subscriptions.length} for ${recipient_user_id}`);

    return new Response(
      JSON.stringify({ sent: sentCount, total: subscriptions.length, failed: subscriptions.length - sentCount, cleaned: toRemove.length }),
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});