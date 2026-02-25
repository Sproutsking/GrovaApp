// ============================================================================
// supabase/functions/send-push/index.ts
// PRODUCTION-READY PUSH NOTIFICATION EDGE FUNCTION
//
// Called by:
//   1. DB triggers (via pg_net) when a notification is inserted
//   2. Client-side notificationService (for testing/admin)
//
// What it does:
//   1. Looks up all active push subscriptions for the recipient
//   2. Sends web push to each subscription
//   3. Cleans up expired/invalid subscriptions
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ---------------------------------------------------------------------------
// VAPID config (set these in Supabase Dashboard → Functions → Secrets)
// ---------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@grova.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PushPayload {
  recipient_user_id: string;
  actor_user_id?: string | null;
  type: string;
  message: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

// ---------------------------------------------------------------------------
// Utility: Base64URL encode (Deno-compatible)
// ---------------------------------------------------------------------------
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// Build VAPID Authorization header
// ---------------------------------------------------------------------------
async function buildVapidAuthHeader(endpoint: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.hostname}`;

  // Build JWT header + payload
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const headerB64 = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const payloadB64 = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import VAPID private key
  const privateKeyBytes = Uint8Array.from(
    atob(VAPID_PRIVATE_KEY.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signingInput}.${signatureB64}`;

  return `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;
}

// ---------------------------------------------------------------------------
// Encrypt payload using Web Push encryption (RFC 8291)
// ---------------------------------------------------------------------------
async function encryptPayload(
  subscription: { p256dh: string; auth: string },
  payload: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: CryptoKey }> {
  const p256dhBytes = Uint8Array.from(
    atob(subscription.p256dh.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const authBytes = Uint8Array.from(
    atob(subscription.auth.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );

  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    p256dhBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeyPair.privateKey,
    256,
  );

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Export server public key (raw)
  const serverPublicKeyRaw = await crypto.subtle.exportKey(
    "raw",
    serverKeyPair.publicKey,
  );

  // HKDF PRK
  const prkKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveKey", "deriveBits"],
  );

  // Auth secret HKDF
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prk = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: authBytes,
      info: authInfo,
    },
    prkKey,
    256,
  );

  // Key HKDF
  const serverPubKeyBytes = new Uint8Array(serverPublicKeyRaw);
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    0x41, // "A" for P-256
    ...serverPubKeyBytes,
    0x41,
    ...p256dhBytes,
  ]);

  const prkKey2 = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HKDF" },
    false,
    ["deriveKey", "deriveBits"],
  );

  const aesKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfo },
    prkKey2,
    { name: "AES-GCM", length: 128 },
    false,
    ["encrypt"],
  );

  // Nonce
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: nonce\0"),
    0x41,
    ...serverPubKeyBytes,
    0x41,
    ...p256dhBytes,
  ]);

  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prkKey2,
    96,
  );
  const nonce = new Uint8Array(nonceBits);

  // Encrypt
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 2); // 2 bytes of zero padding length

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPayload,
  );

  return {
    body: new Uint8Array(encrypted),
    salt,
    serverPublicKey: serverKeyPair.publicKey,
  };
}

// ---------------------------------------------------------------------------
// Send a single push notification
// ---------------------------------------------------------------------------
async function sendWebPush(
  sub: PushSubscriptionRecord,
  notificationPayload: string,
): Promise<{ success: boolean; shouldRemove: boolean }> {
  try {
    const vapidAuth = await buildVapidAuthHeader(sub.endpoint);

    const { body, salt, serverPublicKey } = await encryptPayload(
      { p256dh: sub.p256dh, auth: sub.auth },
      notificationPayload,
    );

    const serverPubKeyRaw = await crypto.subtle.exportKey(
      "raw",
      serverPublicKey,
    );
    const serverPubKeyB64 = base64UrlEncode(new Uint8Array(serverPubKeyRaw));
    const saltB64 = base64UrlEncode(salt);

    const response = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuth,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        Encryption: `salt=${saltB64}`,
        "Crypto-Key": `dh=${serverPubKeyB64};vapid`,
        TTL: "86400", // 24 hours
      },
      body,
    });

    // 201 = success, 410/404 = subscription gone
    if (response.ok || response.status === 201) {
      return { success: true, shouldRemove: false };
    }

    if (response.status === 410 || response.status === 404) {
      // Subscription expired/unsubscribed
      return { success: false, shouldRemove: true };
    }

    if (response.status === 429) {
      // Rate limited — don't remove
      console.warn(
        `⚠️ Rate limited for endpoint: ${sub.endpoint.substring(0, 50)}...`,
      );
      return { success: false, shouldRemove: false };
    }

    console.error(`Push failed ${response.status}: ${await response.text()}`);
    return { success: false, shouldRemove: false };
  } catch (err) {
    console.error("sendWebPush error:", err);
    return { success: false, shouldRemove: false };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    // Validate env
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: PushPayload = await req.json();
    const {
      recipient_user_id,
      actor_user_id,
      type,
      message,
      entity_id,
      metadata = {},
    } = body;

    if (!recipient_user_id || !type || !message) {
      return new Response(
        JSON.stringify({
          error: "recipient_user_id, type, and message are required",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Get actor info
    let actorName = "Someone";
    let actorAvatar: string | null = null;

    if (actor_user_id) {
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("full_name, avatar_id")
        .eq("id", actor_user_id)
        .single();

      if (actorProfile) {
        actorName = actorProfile.full_name || "Someone";
        actorAvatar = actorProfile.avatar_id || null;
      }
    }

    // Check recipient's notification preferences
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("preferences, account_status")
      .eq("id", recipient_user_id)
      .single();

    // Don't push to suspended/deactivated accounts
    if (recipientProfile?.account_status !== "active") {
      return new Response(
        JSON.stringify({ sent: 0, reason: "recipient_inactive" }),
        { headers: CORS_HEADERS },
      );
    }

    const prefs = recipientProfile?.preferences || {};

    // Check preference flags
    const prefMap: Record<string, string> = {
      like: "notify_likes",
      comment: "notify_comments",
      follow: "notify_followers",
      share: "notify_shares",
      unlock: "notify_unlocks",
      profile_view: "notify_profile_visits",
    };

    const prefKey = prefMap[type];
    if (prefKey && prefs[prefKey] === false) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "preference_disabled" }),
        { headers: CORS_HEADERS },
      );
    }

    // Get all active push subscriptions for the recipient
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_agent")
      .eq("user_id", recipient_user_id)
      .eq("is_active", true);

    if (subError) {
      console.error("Failed to fetch subscriptions:", subError);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "no_subscriptions" }),
        { headers: CORS_HEADERS },
      );
    }

    // Build notification payload
    const notificationPayload = JSON.stringify({
      title: "Grova",
      body: message,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: `${type}-${entity_id || Date.now()}`,
      timestamp: Date.now(),
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: {
        type,
        entity_id: entity_id || null,
        actor_user_id: actor_user_id || null,
        actor_name: actorName,
        actor_avatar: actorAvatar,
        url: getNotificationUrl(type, entity_id),
        timestamp: Date.now(),
        ...metadata,
      },
    });

    // Send to all subscriptions in parallel
    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendWebPush(sub, notificationPayload)),
    );

    let sentCount = 0;
    const toRemove: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value.success) sentCount++;
        if (result.value.shouldRemove) toRemove.push(subscriptions[index].id);
      }
    });

    // Clean up expired subscriptions
    if (toRemove.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", toRemove);

      console.log(`🧹 Removed ${toRemove.length} expired subscriptions`);
    }

    console.log(
      `✅ Push sent: ${sentCount}/${subscriptions.length} for user ${recipient_user_id}`,
    );

    return new Response(
      JSON.stringify({
        sent: sentCount,
        total: subscriptions.length,
        failed: subscriptions.length - sentCount,
        cleaned: toRemove.length,
      }),
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});

// ---------------------------------------------------------------------------
// URL routing for notification types
// ---------------------------------------------------------------------------
function getNotificationUrl(type: string, entityId?: string | null): string {
  switch (type) {
    case "like":
    case "comment":
    case "share":
      return entityId ? `/post/${entityId}` : "/";
    case "follow":
    case "profile_view":
      return entityId ? `/profile/${entityId}` : "/";
    case "unlock":
      return entityId ? `/story/${entityId}` : "/";
    default:
      return "/";
  }
}
