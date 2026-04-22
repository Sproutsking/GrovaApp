// ============================================================================
// supabase/functions/send-push/index.ts — v4 CORS + VAPID FIXED
// ============================================================================
// FIX [CORS-1]: Added x-client-info to allowed headers. This header is
//   automatically added by the Supabase JS SDK and was being blocked
//   by CORS preflight — causing EVERY push call to fail with ERR_FAILED.
// FIX [CORS-2]: Authorization header added explicitly for SDK calls.
// All prior encryption/VAPID/payload logic preserved exactly.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS — MUST include x-client-info (sent by Supabase JS SDK) ──────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-info",
  ].join(", "),
};

// ── VAPID config (stored in Supabase Edge Function Secrets) ──────────────────
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT     = "mailto:support@xeevia.com";

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const raw = atob(pad);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── Import VAPID private key — handles BOTH PKCS8 DER and raw 32-byte formats ─
async function importVapidPrivateKey(): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(VAPID_PRIVATE_KEY);

  // PKCS8 DER starts with 0x30 (SEQUENCE tag)
  if (raw[0] === 0x30) {
    return crypto.subtle.importKey(
      "pkcs8",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  }

  // Raw 32-byte scalar — wrap in PKCS8
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + raw.length);
  pkcs8.set(pkcs8Header);
  pkcs8.set(raw, pkcs8Header.length);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(audience: string): Promise<string> {
  const enc = (obj: object) =>
    uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(obj)));

  const header  = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await importVapidPrivateKey();
  const sig  = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(sig))}`;
}

async function hkdf(
  ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number,
): Promise<Uint8Array> {
  const km   = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    km, length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  sub: { p256dh: string; auth: string },
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const plain = new TextEncoder().encode(plaintext);
  const salt  = crypto.getRandomValues(new Uint8Array(16));

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const serverPublicKeyExported = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw", base64urlToUint8Array(sub.p256dh),
    { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeyPair.privateKey, 256,
  );

  const authKey  = base64urlToUint8Array(sub.auth);
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikm = await hkdf(new Uint8Array(sharedBits), authKey, concat(authInfo, new Uint8Array([1])), 32);

  const p256dh = base64urlToUint8Array(sub.p256dh);
  const keyInfo = concat(
    new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    new Uint8Array([0]),
    new TextEncoder().encode("P-256\0"),
    new Uint8Array([0, 65]), serverPublicKeyExported,
    new Uint8Array([0, 65]), p256dh,
    new Uint8Array([1]),
  );
  const nonceInfo = concat(
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    new Uint8Array([0]),
    new TextEncoder().encode("P-256\0"),
    new Uint8Array([0, 65]), serverPublicKeyExported,
    new Uint8Array([0, 65]), p256dh,
    new Uint8Array([1]),
  );

  const contentKey   = await hkdf(ikm, salt, keyInfo, 16);
  const contentNonce = await hkdf(ikm, salt, nonceInfo, 12);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"],
  );
  const padded     = concat(new Uint8Array([0, 0]), plain);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: contentNonce }, cryptoKey, padded),
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyExported };
}

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  opts: { ttl?: number; urgency?: string } = {},
): Promise<{ ok: boolean; status: number; expired: boolean }> {
  try {
    const url      = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt      = await buildVapidJwt(audience);
    const ttl      = opts.ttl     ?? 86400;
    const urgency  = opts.urgency ?? "normal";

    const { ciphertext, salt, serverPublicKey } = await encryptPayload(sub, payloadStr);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type":     "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "TTL":              String(ttl),
        "Urgency":          urgency,
        "Authorization":    `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        "Encryption":       `salt=${uint8ArrayToBase64url(salt)}`,
        "Crypto-Key":       `dh=${uint8ArrayToBase64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      },
      body: ciphertext,
    });

    const expired = res.status === 410 || res.status === 404;
    if (!res.ok && !expired) {
      console.error(`[send-push] ${res.status}:`, await res.text().catch(() => ""));
    }
    return { ok: res.ok, status: res.status, expired };
  } catch (err) {
    console.error("[send-push] sendPush error:", err);
    return { ok: false, status: 0, expired: false };
  }
}

// ── Notification builders ─────────────────────────────────────────────────────
function buildTitle(type: string, d: Record<string, unknown>): string {
  const caller = String(d?.callerName ?? d?.caller_name ?? "Someone");
  const sender = String(d?.senderName ?? d?.actorName  ?? "Someone");
  const map: Record<string, string> = {
    incoming_call:       `📞 ${caller} is calling`,
    dm:                  sender,
    like:                "New like on your post",
    comment:             "New comment on your post",
    comment_reply:       "New reply to your comment",
    follow:              "New follower",
    mention:             "You were mentioned",
    new_post:            "New post from someone you follow",
    new_reel:            "New reel from someone you follow",
    new_story:           "New story from someone you follow",
    milestone_followers: "🎉 Milestone reached!",
    payment_confirmed:   "💳 Payment confirmed",
    transfer_received:   "💰 Money received",
    transfer_sent:       "📤 Transfer sent",
  };
  return map[type] ?? "Xeevia";
}

function buildUrl(type: string, entityId: string | null, d: Record<string, unknown>): string {
  if (d?.url) return String(d.url);
  if (type === "incoming_call" || type === "dm") return "/messages";
  if (["like","comment","comment_reply","mention","new_post","share"].includes(type))
    return entityId ? `/post/${entityId}` : "/";
  if (type === "new_reel")  return entityId ? `/reel/${entityId}`  : "/";
  if (type === "new_story") return entityId ? `/story/${entityId}` : "/";
  if (type === "follow" || type === "profile_view") {
    const aid = String(d?.actorId ?? d?.actor_id ?? "");
    return aid ? `/profile/${aid}` : "/";
  }
  return "/";
}

function buildTag(type: string, notifId: string, d: Record<string, unknown>): string {
  if (type === "incoming_call") return `call_${String(d?.callId ?? d?.call_id ?? notifId)}`;
  if (type === "dm")            return `dm_${String(d?.conversation_id ?? notifId)}`;
  return `notif_${notifId}`;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // ── VAPID guard ───────────────────────────────────────────────────────────
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[send-push] VAPID keys not configured in Supabase secrets");
    return json({ error: "VAPID keys not configured" }, 500);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const {
      recipient_user_id,
      actor_user_id,
      type       = "general",
      title:      titleOverride,
      message:    messageOverride,
      entity_id:  entityId  = null,
      metadata              = {},
      data:       extraData = {},
    } = body;

    if (!recipient_user_id) return json({ error: "recipient_user_id is required" }, 400);

    // Never push to self
    if (
      actor_user_id &&
      actor_user_id === recipient_user_id &&
      !["payment_confirmed", "transfer_received", "transfer_sent"].includes(type)
    ) {
      return json({ sent: 0, reason: "self_notification_skipped" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Fetch subscriptions ─────────────────────────────────────────────────
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipient_user_id)
      .eq("is_active", true);

    if (subErr) {
      console.error("[send-push] DB error:", subErr);
      return json({ error: subErr.message }, 500);
    }
    if (!subs || subs.length === 0) {
      return json({ sent: 0, reason: "no_active_subscriptions" });
    }

    // ── Build payload ───────────────────────────────────────────────────────
    const merged  = { ...metadata, ...extraData };
    const notifId = String(merged.notification_id ?? `${type}_${Date.now()}`);
    const isCall  = type === "incoming_call";

    const notifTitle = titleOverride ?? buildTitle(type, merged);
    const notifBody  = messageOverride ?? (isCall
      ? `${String(merged.callerName ?? merged.caller_name ?? "Someone")} is calling — tap to answer`
      : "");
    const notifUrl   = buildUrl(type, entityId, merged);
    const notifTag   = buildTag(type, notifId, merged);

    const urgency = isCall || type === "dm" ? "high" : "normal";
    const ttl     = isCall ? 30 : type === "dm" ? 86400 : 259200;

    const pushPayload = JSON.stringify({
      title:              notifTitle,
      body:               notifBody,
      icon:               "/logo192.png",
      badge:              "/logo192.png",
      vibrate:            isCall ? [500, 100, 500, 100, 500] : [200, 100, 200],
      requireInteraction: isCall,
      renotify:           true,
      tag:                notifTag,
      actions: isCall
        ? [{ action: "accept",  title: "✅ Accept"  },
           { action: "decline", title: "❌ Decline" }]
        : [{ action: "view",    title: "View"    },
           { action: "dismiss", title: "Dismiss" }],
      data: {
        url:              notifUrl,
        type,
        entity_id:        entityId ?? null,
        notification_id:  notifId,
        conversation_id:  String(merged.conversation_id ?? ""),
        call_id:          String(merged.callId ?? merged.call_id ?? ""),
        caller_name:      String(merged.callerName  ?? merged.caller_name  ?? ""),
        call_type:        String(merged.callType    ?? merged.call_type    ?? ""),
        caller_avatar_id: String(merged.callerAvatarId ?? merged.callerAvId ?? ""),
        ...merged,
      },
    });

    console.log(`[send-push] type=${type} → ${subs.length} sub(s) for ${recipient_user_id}`);

    // ── Send ────────────────────────────────────────────────────────────────
    const results = await Promise.allSettled(
      subs.map(s =>
        sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, pushPayload, { ttl, urgency })
      )
    );

    let sent = 0;
    const expiredIds: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        if (r.value.ok) sent++;
        else if (r.value.expired) expiredIds.push(subs[i].id);
      }
    }

    // Deactivate expired subscriptions
    if (expiredIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("id", expiredIds);
    }

    console.log(`[send-push] sent=${sent}/${subs.length}`);
    return json({ sent, total: subs.length, type });
  } catch (err) {
    console.error("[send-push] Fatal:", err);
    return json({ error: String(err) }, 500);
  }
});