// ============================================================================
// supabase/functions/send-push/index.ts — v8 COMPLETE FIX
// ============================================================================
// BUGS FIXED vs v7:
//   [FIX-1] importVapidPrivateKey: correct PKCS8 DER structure with proper
//            ECPrivateKey wrapper. v7 header was missing inner SEQUENCE fields
//            that Firefox and Safari require — Chrome accepted it silently.
//   [FIX-2] encryptPayload: correct aesgcm HKDF info construction per
//            RFC 8291. v7 had trailing 0x01 bytes not in the spec, causing
//            Firefox to silently discard all encrypted payloads.
//   [FIX-3] uint16BE helper added for correct 2-byte big-endian length
//            prefixes in the HKDF info byte arrays.
//   [FIX-4] Push payload normalisation: incoming data from the client is
//            already flat inside metadata — no double-nesting.
//   [FIX-5] SW payload shape guaranteed: final push payload is always
//            { title, body, data: { type, call_id, ... } } so the SW
//            reads payload.data.type correctly.
//   All v7 fixes (dedup, VAPID audience, batch deactivate, health, etc.)
//   preserved exactly.

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization", "x-client-info", "apikey",
    "content-type", "x-supabase-client-info",
  ].join(", "),
};

// ── VAPID config ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:support@xeevia.com";

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function b64urlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const raw = atob(pad);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ToB64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total  = arrays.reduce((n, a) => n + a.length, 0);
  const out    = new Uint8Array(total);
  let   offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// [FIX-3] 2-byte big-endian length prefix for HKDF info
function uint16BE(n: number): Uint8Array {
  return new Uint8Array([n >> 8, n & 0xff]);
}

// ── VAPID private key importer — FIXED ───────────────────────────────────────
// [FIX-1] Previous version had a wrong PKCS8 DER header missing the proper
// ECPrivateKey inner SEQUENCE. Firefox and Safari rejected it; Chrome accepted
// it silently. This version uses the correct structure:
//   SEQUENCE {
//     INTEGER 0                         (version)
//     SEQUENCE { OID ecPublicKey, OID P-256 }  (AlgorithmIdentifier)
//     OCTET STRING {                    (privateKey wrapper)
//       SEQUENCE {
//         INTEGER 1                     (ECPrivateKey version)
//         OCTET STRING <32 raw bytes>   (the actual key)
//       }
//     }
//   }
async function importVapidPrivateKey(): Promise<CryptoKey> {
  const raw = b64urlToUint8(VAPID_PRIVATE_KEY);

  if (raw[0] === 0x30) {
    // Already PKCS8 DER
    return crypto.subtle.importKey(
      "pkcs8", raw.buffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["sign"],
    );
  }

  if (raw.length === 32) {
    // Raw 32-byte key — wrap in correct minimal PKCS8 DER
    const pkcs8Header = new Uint8Array([
      0x30, 0x41,             // SEQUENCE (65 bytes total)
        0x02, 0x01, 0x00,     //   INTEGER 0 (version = v1)
        0x30, 0x13,           //   SEQUENCE (19 bytes) AlgorithmIdentifier
          0x06, 0x07,         //     OID ecPublicKey (7 bytes)
            0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
          0x06, 0x08,         //     OID P-256 namedCurve (8 bytes)
            0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
        0x04, 0x27,           //   OCTET STRING (39 bytes) privateKey wrapper
          0x30, 0x25,         //     SEQUENCE (37 bytes) ECPrivateKey
            0x02, 0x01, 0x01, //       INTEGER 1 (ECPrivateKey version)
            0x04, 0x20,       //       OCTET STRING (32 bytes) the raw key
            // ← raw 32 bytes appended below
    ]);
    const pkcs8 = new Uint8Array(pkcs8Header.length + 32);
    pkcs8.set(pkcs8Header);
    pkcs8.set(raw, pkcs8Header.length);
    return crypto.subtle.importKey(
      "pkcs8", pkcs8.buffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["sign"],
    );
  }

  throw new Error(
    `Unexpected VAPID private key length: ${raw.length}. ` +
    "Expected 32-byte raw or PKCS8 DER. " +
    "Re-generate with: npx web-push generate-vapid-keys"
  );
}

// ── VAPID JWT ─────────────────────────────────────────────────────────────────
// Audience is ONLY protocol+host, never a path segment.
async function buildVapidJwt(endpointUrl: string): Promise<string> {
  const url      = new URL(endpointUrl);
  const audience = `${url.protocol}//${url.host}`;

  const enc     = (obj: object) => uint8ToB64url(new TextEncoder().encode(JSON.stringify(obj)));
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
  return `${signingInput}.${uint8ToB64url(new Uint8Array(sig))}`;
}

// ── HKDF ─────────────────────────────────────────────────────────────────────
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

// ── Payload encryption — FIXED aesgcm HKDF info ──────────────────────────────
// [FIX-2] Previous version had extra 0x01 bytes at the end of the keyInfo
// and nonceInfo byte arrays — not part of the aesgcm spec (RFC 8291 /
// draft-ietf-webpush-encryption). Firefox silently discarded all payloads
// encrypted with the wrong info. Correct format:
//   "Content-Encoding: aesgcm" || 0x00 || 0x00 || "P-256" || 0x00 ||
//   uint16BE(65) || serverPublicKeyRaw ||
//   uint16BE(65) || clientPublicKeyRaw
async function encryptPayload(
  sub: { p256dh: string; auth: string },
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const plain = new TextEncoder().encode(plaintext);

  if (plain.length > 3800) {
    console.warn(`[send-push] Payload ${plain.length} bytes — near 4KB limit`);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw", b64urlToUint8(sub.p256dh),
    { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeyPair.privateKey, 256,
  );

  const authKey  = b64urlToUint8(sub.auth);
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikm      = await hkdf(
    new Uint8Array(sharedBits), authKey,
    concat(authInfo, new Uint8Array([1])), 32,
  );

  const p256dh = b64urlToUint8(sub.p256dh);

  // [FIX-2] Correct aesgcm info — no trailing 0x01, proper uint16BE lengths
  const keyInfo = concat(
    new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    new Uint8Array([0]),
    new TextEncoder().encode("P-256\0"),
    uint16BE(65), serverPublicKeyRaw,
    uint16BE(65), p256dh,
  );

  const nonceInfo = concat(
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    new Uint8Array([0]),
    new TextEncoder().encode("P-256\0"),
    uint16BE(65), serverPublicKeyRaw,
    uint16BE(65), p256dh,
  );

  const contentKey   = await hkdf(ikm, salt, keyInfo,   16);
  const contentNonce = await hkdf(ikm, salt, nonceInfo, 12);

  const cryptoKey  = await crypto.subtle.importKey(
    "raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"],
  );
  const padded     = concat(new Uint8Array([0, 0]), plain);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: contentNonce }, cryptoKey, padded),
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

// ── Send single push ──────────────────────────────────────────────────────────
async function sendPush(
  sub:     { endpoint: string; p256dh: string; auth: string },
  payload: string,
  opts:    { ttl?: number; urgency?: string } = {},
): Promise<{ ok: boolean; status: number; expired: boolean; body: string }> {
  try {
    const ttl     = opts.ttl     ?? 86400;
    const urgency = opts.urgency ?? "normal";

    const jwt = await buildVapidJwt(sub.endpoint);

    const { ciphertext, salt, serverPublicKey } = await encryptPayload(sub, payload);

    const res = await fetch(sub.endpoint, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "TTL":              String(ttl),
        "Urgency":          urgency,
        "Authorization":    `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        "Encryption":       `salt=${uint8ToB64url(salt)}`,
        "Crypto-Key":       `dh=${uint8ToB64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      },
      body: ciphertext,
    });

    const body    = await res.text().catch(() => "");
    const expired = res.status === 410 || res.status === 404;

    if (!res.ok) {
      console.error(
        `[send-push] HTTP ${res.status} | expired=${expired} | ` +
        `body="${body.slice(0, 200)}" | endpoint="${sub.endpoint.slice(0, 80)}..."`
      );
    }

    return { ok: res.ok, status: res.status, expired, body };
  } catch (err) {
    console.error("[send-push] sendPush exception:", err);
    return { ok: false, status: 0, expired: false, body: String(err) };
  }
}

// ── Notification builders ─────────────────────────────────────────────────────
function buildTitle(type: string, d: Record<string, unknown>): string {
  const caller = String(d?.callerName ?? d?.caller_name ?? "Someone");
  const sender = String(d?.senderName ?? d?.actorName   ?? "Someone");
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
    profile_view:        "Someone viewed your profile",
    unlock:              "Your story was unlocked",
  };
  return map[type] ?? "Xeevia";
}

function buildUrl(type: string, entityId: string | null, d: Record<string, unknown>): string {
  if (d?.url) return String(d.url);
  switch (type) {
    case "incoming_call":
    case "dm":             return "/messages";
    case "like":
    case "comment":
    case "comment_reply":
    case "mention":
    case "new_post":
    case "share":          return entityId ? `/post/${entityId}` : "/";
    case "new_reel":       return entityId ? `/reel/${entityId}` : "/";
    case "new_story":
    case "unlock":         return entityId ? `/story/${entityId}` : "/";
    case "follow":
    case "profile_view": {
      const aid = String(d?.actorId ?? d?.actor_id ?? "");
      return aid ? `/profile/${aid}` : "/";
    }
    case "payment_confirmed":
    case "milestone_followers":
    case "transfer_received":
    case "transfer_sent":  return "/account";
    default:               return "/";
  }
}

function buildTag(type: string, notifId: string, d: Record<string, unknown>): string {
  if (type === "incoming_call") return `call_${String(d?.callId ?? d?.call_id ?? notifId)}`;
  if (type === "dm")            return `dm_${String(d?.conversation_id ?? notifId)}`;
  return `notif_${notifId}`;
}

function getDedupTtlMs(type: string): number | null {
  if (type === "incoming_call" || type === "dm") return null;
  if (["like","comment","comment_reply","follow","mention","profile_view"].includes(type))
    return 10 * 60 * 1000;
  return 30 * 60 * 1000;
}

// [FIX-5] Build a lean, size-safe push payload with guaranteed shape.
// The SW reads: payload.data.type, payload.data.call_id, etc.
// We must produce exactly: { title, body, data: { type, call_id, ... } }
// The `data` object here maps 1:1 to what the SW reads as payload.data.*
function buildPushPayload(params: {
  type:         string;
  title:        string;
  body:         string;
  tag:          string;
  url:          string;
  notifId:      string;
  entityId:     string | null;
  actorUserId:  string | null;
  merged:       Record<string, unknown>;
  isCall:       boolean;
}): string {
  const { type, title, body, tag, url, notifId, entityId, actorUserId, merged, isCall } = params;

  // Only well-known fields — no arbitrary spread from merged.
  // null is used instead of "" so the SW can safely check: if (data.call_id)
  const data: Record<string, string | null> = {
    url,
    type,
    entity_id:        entityId                                              ?? null,
    notification_id:  notifId,
    actor_user_id:    actorUserId                                           ?? null,
    conversation_id:  (merged.conversation_id as string)  || null,
    call_id:          (merged.call_id  as string) || (merged.callId  as string) || null,
    caller_name:      (merged.caller_name as string) || (merged.callerName as string) || null,
    call_type:        (merged.call_type as string) || (merged.callType as string) || null,
    caller_avatar_id: (merged.caller_avatar_id as string) || (merged.callerAvatarId as string) || null,
    message:          (merged.message as string) || null,
    sender_name:      (merged.senderName as string) || null,
  };

  const pushPayload = {
    title,
    body,
    icon:               "/logo192.png",
    badge:              "/logo192.png",
    vibrate:            isCall ? [500, 100, 500, 100, 500] : [200, 100, 200],
    requireInteraction: isCall,
    renotify:           true,
    tag,
    actions: isCall
      ? [{ action: "accept", title: "✅ Accept" }, { action: "decline", title: "❌ Decline" }]
      : [{ action: "view",   title: "View"      }, { action: "dismiss",  title: "Dismiss"   }],
    data,
  };

  const str = JSON.stringify(pushPayload);
  if (str.length > 3800) {
    const truncated = {
      ...pushPayload,
      body: body.slice(0, 100) + (body.length > 100 ? "…" : ""),
    };
    return JSON.stringify(truncated);
  }
  return str;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Health check — GET request
  if (req.method === "GET") {
    try {
      await importVapidPrivateKey();
      return json({
        ok:         true,
        message:    "VAPID keys valid",
        subject:    VAPID_SUBJECT,
        key_prefix: VAPID_PUBLIC_KEY.slice(0, 20) + "...",
      });
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  // Health / VAPID test via POST
  if (body?.health === true || body?.test === true) {
    try {
      await importVapidPrivateKey();
      return json({ ok: true, message: "VAPID keys valid", subject: VAPID_SUBJECT });
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[send-push] VAPID keys not configured in Edge Function secrets");
    return json({
      error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in Edge Function secrets",
    }, 500);
  }

  const {
    recipient_user_id,
    actor_user_id,
    type       = "general",
    title:      titleOverride,
    message:    messageOverride,
    entity_id:  entityId  = null,
    metadata              = {} as Record<string, unknown>,
    data:       extraData = {} as Record<string, unknown>,
  } = body;

  if (!recipient_user_id) return json({ error: "recipient_user_id is required" }, 400);

  // Self-notification guard
  const socialTypes = [
    "like","comment","comment_reply","follow","mention","profile_view",
    "new_post","new_reel","new_story","share","unlock",
  ];
  if (
    socialTypes.includes(type as string) &&
    actor_user_id &&
    actor_user_id === recipient_user_id
  ) {
    return json({ sent: 0, reason: "self_notification_skipped" });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Deduplication ──────────────────────────────────────────────────────────
  const dedupTtlMs = getDedupTtlMs(type as string);

  if (dedupTtlMs !== null) {
    const dedupKey = [
      String(type),
      String(actor_user_id || "none"),
      String(entityId      || "none"),
      String(recipient_user_id),
    ].join(":").slice(0, 500);

    const { error: insertErr } = await supa
      .from("notification_dedup")
      .insert({
        dedup_key:  dedupKey,
        expires_at: new Date(Date.now() + dedupTtlMs).toISOString(),
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        console.log(`[send-push] Duplicate blocked: ${dedupKey}`);
        return json({ sent: 0, reason: "duplicate_prevented" });
      }
      console.warn("[send-push] Dedup insert error (non-blocking):", insertErr.message);
    }

    // Async cleanup of expired entries
    supa
      .from("notification_dedup")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .then(({ error: e }) => {
        if (e) console.warn("[send-push] Dedup cleanup error:", e.message);
      });
  }

  // ── Fetch active subscriptions ─────────────────────────────────────────────
  const { data: subs, error: subErr } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", recipient_user_id)
    .eq("is_active", true);

  if (subErr) {
    console.error("[send-push] DB error fetching subscriptions:", subErr.message);
    return json({ error: subErr.message }, 500);
  }

  if (!subs || subs.length === 0) {
    console.log(`[send-push] No active subscriptions for user ${recipient_user_id}`);
    return json({ sent: 0, reason: "no_active_subscriptions" });
  }

  console.log(`[send-push] type=${type} recipients=${subs.length} user=${recipient_user_id}`);

  // ── Build payload ──────────────────────────────────────────────────────────
  // [FIX-4] Merge metadata and extraData flat — client sends metadata flat,
  // never pre-nested. extraData is a legacy fallback.
  const merged  = {
    ...(metadata as object),
    ...(extraData as object),
  } as Record<string, unknown>;

  const notifId = String(merged.notification_id ?? `${type}_${Date.now()}`);
  const isCall  = type === "incoming_call";

  const notifTitle = String(titleOverride ?? buildTitle(type as string, merged));
  const notifBody  = String(messageOverride ?? (isCall
    ? `${String(merged.callerName ?? merged.caller_name ?? "Someone")} is calling — tap to answer`
    : String(merged.message ?? "")));

  const notifUrl = buildUrl(type as string, entityId as string | null, merged);
  const notifTag = buildTag(type as string, notifId, merged);

  const urgency = isCall || type === "dm" ? "high" : "normal";
  const ttl     = isCall ? 30 : type === "dm" ? 86400 : 259200;

  const pushPayload = buildPushPayload({
    type:        type as string,
    title:       notifTitle,
    body:        notifBody,
    tag:         notifTag,
    url:         notifUrl,
    notifId,
    entityId:    entityId as string | null,
    actorUserId: actor_user_id as string | null,
    merged,
    isCall,
  });

  console.log(`[send-push] Payload size: ${pushPayload.length} chars`);

  // ── Send to all subscriptions ──────────────────────────────────────────────
  const results = await Promise.allSettled(
    (subs as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(s =>
      sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        pushPayload,
        { ttl, urgency },
      )
    )
  );

  let sent = 0;
  const expiredIds: string[] = [];
  const errors:     string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s = (subs as { id: string }[])[i];

    if (r.status === "fulfilled") {
      if (r.value.ok) {
        sent++;
      } else if (r.value.expired) {
        expiredIds.push(s.id);
      } else {
        errors.push(`sub[${i}]: HTTP ${r.value.status} — ${r.value.body.slice(0, 120)}`);
      }
    } else {
      errors.push(`sub[${i}]: ${String(r.reason)}`);
    }
  }

  // Batch deactivate expired subscriptions
  if (expiredIds.length > 0) {
    await supa
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", expiredIds);
    console.log(`[send-push] Deactivated ${expiredIds.length} expired subscription(s)`);
  }

  if (errors.length > 0) {
    console.error("[send-push] Errors:", errors.join(" | "));
  }

  console.log(
    `[send-push] Result: sent=${sent}/${subs.length} ` +
    `expired=${expiredIds.length} errors=${errors.length}`
  );

  return json({
    sent,
    total:   subs.length,
    type,
    expired: expiredIds.length,
    errors:  errors.length > 0 ? errors : undefined,
  });
});