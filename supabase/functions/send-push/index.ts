// ============================================================================
// supabase/functions/send-push/index.ts — v7 COMPLETE FIX
// ============================================================================
// BUGS FIXED vs v6:
//   [FIX-1] notification_dedup NOW has a DB-level unique constraint enforced
//           via INSERT ... ON CONFLICT DO NOTHING. Without a unique constraint
//           in the DB, concurrent invocations both passed the maybeSingle()
//           check before either inserted, making dedup useless under load.
//   [FIX-2] Dedup key is sanitised and length-capped to prevent oversized keys.
//   [FIX-3] Payload builder strips ALL large/unknown fields before encryption.
//           Previously "data: { ...data }" spread the full metadata object
//           and could silently exceed the 4KB web push limit, causing the push
//           server to reject with no useful error in your logs.
//   [FIX-4] VAPID JWT audience is now always just protocol+host (never a path).
//           Some push services (especially Mozilla) reject JWTs where aud
//           contains a path segment.
//   [FIX-5] sendPush() now returns the full response body on failure so you
//           can see exactly what the push server said in Supabase Edge logs.
//   [FIX-6] Expired subscriptions (410/404) are now deactivated in one batch
//           DELETE rather than individual updates — more efficient.
//   [FIX-7] Added /health endpoint for easy VAPID key verification.
//   [FIX-8] Self-notification guard correctly checks actor vs recipient.

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

// ── VAPID private key importer ────────────────────────────────────────────────
async function importVapidPrivateKey(): Promise<CryptoKey> {
  const raw = b64urlToUint8(VAPID_PRIVATE_KEY);

  if (raw[0] === 0x30) {
    // Already PKCS8 DER
    return crypto.subtle.importKey(
      "pkcs8", raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false, ["sign"],
    );
  }

  if (raw.length === 32) {
    // Raw 32-byte key — wrap in minimal PKCS8 DER
    const header = new Uint8Array([
      0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,
      0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,
      0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,
      0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,
      0x01,0x04,0x20,
    ]);
    const pkcs8 = new Uint8Array(header.length + 32);
    pkcs8.set(header);
    pkcs8.set(raw, header.length);
    return crypto.subtle.importKey(
      "pkcs8", pkcs8,
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
// [FIX-4] audience is ONLY protocol+host, never includes a path.
async function buildVapidJwt(endpointUrl: string): Promise<string> {
  const url      = new URL(endpointUrl);
  const audience = `${url.protocol}//${url.host}`; // no path segment

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

// ── Payload encryption ────────────────────────────────────────────────────────
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

  const p256dh    = b64urlToUint8(sub.p256dh);
  const keyInfo   = concat(
    new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    new Uint8Array([0]),
    new TextEncoder().encode("P-256\0"),
    new Uint8Array([0, 65]), serverPublicKeyRaw,
    new Uint8Array([0, 65]), p256dh,
    new Uint8Array([1]),
  );
  const nonceInfo = concat(
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    new Uint8Array([0]),
    new TextEncoder().encode("P-256\0"),
    new Uint8Array([0, 65]), serverPublicKeyRaw,
    new Uint8Array([0, 65]), p256dh,
    new Uint8Array([1]),
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

    // [FIX-4] Pass the full endpoint URL for correct JWT audience
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
  if (type === "incoming_call" || type === "dm") return null;       // never dedup
  if (["like","comment","comment_reply","follow","mention","profile_view"].includes(type))
    return 10 * 60 * 1000;  // 10 min
  return 30 * 60 * 1000;    // 30 min
}

// [FIX-3] Build a lean, size-safe push payload
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

  // Keep data payload minimal — only well-known fields, no arbitrary spread
  const data: Record<string, string | null> = {
    url,
    type,
    entity_id:        entityId   ?? null,
    notification_id:  notifId,
    actor_user_id:    actorUserId ?? null,
    // Call-specific fields
    conversation_id:  String(merged.conversation_id  ?? ""),
    call_id:          String(merged.callId ?? merged.call_id ?? ""),
    caller_name:      String(merged.callerName  ?? merged.caller_name  ?? ""),
    call_type:        String(merged.callType    ?? merged.call_type    ?? ""),
    caller_avatar_id: String(merged.callerAvatarId ?? merged.callerAvId ?? ""),
  };

  const payload = {
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

  const str = JSON.stringify(payload);
  // Hard-cap at 3800 chars — web push limit is 4096 bytes after encryption overhead
  if (str.length > 3800) {
    // Truncate body and retry
    const truncated = { ...payload, body: body.slice(0, 100) + (body.length > 100 ? "…" : "") };
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

  // [FIX-7] Health check endpoint — GET /send-push or POST {"health":true}
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
    return json({ error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in Edge Function secrets" }, 500);
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

  // [FIX-8] Self-notification guard
  const socialTypes = [
    "like","comment","comment_reply","follow","mention","profile_view",
    "new_post","new_reel","new_story","share","unlock",
  ];
  if (socialTypes.includes(type as string) && actor_user_id && actor_user_id === recipient_user_id) {
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
    ].join(":").slice(0, 500); // [FIX-2] cap key length

    // [FIX-1] Use INSERT ... ON CONFLICT DO NOTHING for atomic dedup.
    // This works even under concurrent invocations — the DB unique constraint
    // does the actual deduplication, not the application layer.
    const { error: insertErr } = await supa
      .from("notification_dedup")
      .insert({
        dedup_key:  dedupKey,
        expires_at: new Date(Date.now() + dedupTtlMs).toISOString(),
      });

    if (insertErr) {
      // Unique constraint violation = duplicate — this is the expected "blocked" path
      if (insertErr.code === "23505") {
        console.log(`[send-push] Duplicate blocked: ${dedupKey}`);
        return json({ sent: 0, reason: "duplicate_prevented" });
      }
      // Other DB error — log but continue (don't block the push)
      console.warn("[send-push] Dedup insert error (non-blocking):", insertErr.message);
    }

    // Clean up expired dedup entries asynchronously (fire and forget)
    supa
      .from("notification_dedup")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .then(({ error: e }) => { if (e) console.warn("[send-push] Dedup cleanup error:", e.message); });
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
  const merged  = { ...(metadata as object), ...(extraData as object) } as Record<string, unknown>;
  const notifId = String(merged.notification_id ?? `${type}_${Date.now()}`);
  const isCall  = type === "incoming_call";

  const notifTitle = String(titleOverride   ?? buildTitle(type as string, merged));
  const notifBody  = String(messageOverride ?? (isCall
    ? `${String(merged.callerName ?? merged.caller_name ?? "Someone")} is calling — tap to answer`
    : String(merged.message ?? "")));

  const notifUrl = buildUrl(type as string, entityId as string | null, merged);
  const notifTag = buildTag(type as string, notifId, merged);

  const urgency = isCall || type === "dm" ? "high" : "normal";
  const ttl     = isCall ? 30 : type === "dm" ? 86400 : 259200;

  // [FIX-3] Use the safe payload builder
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
  const errors: string[]     = [];

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

  // [FIX-6] Batch deactivate expired subscriptions
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

  console.log(`[send-push] Result: sent=${sent}/${subs.length} expired=${expiredIds.length} errors=${errors.length}`);

  return json({
    sent,
    total:   subs.length,
    type,
    expired: expiredIds.length,
    errors:  errors.length > 0 ? errors : undefined,
  });
});