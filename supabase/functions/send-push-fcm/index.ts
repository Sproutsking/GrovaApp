// ============================================================================
// supabase/functions/send-push-fcm/index.ts — Firebase Cloud Messaging v1 API
// ============================================================================
// Firebase Cloud Messaging integration for native mobile push notifications.
// Uses FCM v1 HTTP API (deprecated Basic API has been sunset).
//
// Environment variables required:
//   FIREBASE_PROJECT_ID
//   FIREBASE_PRIVATE_KEY (from service account JSON)
//   FIREBASE_CLIENT_EMAIL (from service account JSON)
//
// Payload shape:
//   {
//     recipient_user_id: string,
//     actor_user_id?: string,
//     type: string (like, comment, follow, incoming_call, dm, etc.),
//     title?: string,
//     message?: string,
//     entity_id?: string,
//     metadata?: { callId, conversation_id, ... },
//     data?: { url, deeplink_path, ... }
//   }
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-info",
  ].join(", "),
};

// ── Firebase config ───────────────────────────────────────────────────────
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY") ?? "";
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Firebase JWT generation ──────────────────────────────────────────────────
// Create OAuth 2.0 access token for FCM API using service account
async function getFirebaseAccessToken(): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour

  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat,
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const signature = await signJwt(
    `${headerB64}.${payloadB64}`,
    FIREBASE_PRIVATE_KEY,
  );

  const jwt = `${headerB64}.${payloadB64}.${signature}`;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[FCM] Token fetch failed:", res.status, text);
      throw new Error(`FCM token fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  } catch (err) {
    console.error("[FCM] getFirebaseAccessToken error:", err);
    throw err;
  }
}

// ── RSA-SHA256 JWT signing ────────────────────────────────────────────────────
async function signJwt(payload: string, privateKeyPem: string): Promise<string> {
  // Import private key (PKCS8 format expected from Firebase service account)
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(
      privateKeyPem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\n/g, ""),
    ),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(payload),
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ── Notification builders ─────────────────────────────────────────────────────
function buildTitle(type: string, d: Record<string, unknown>): string {
  const caller = String(d?.callerName ?? d?.caller_name ?? "Someone");
  const sender = String(d?.senderName ?? d?.actorName ?? "Someone");
  const map: Record<string, string> = {
    incoming_call: `📞 ${caller} is calling`,
    dm: sender,
    like: "New like on your post",
    comment: "New comment on your post",
    comment_reply: "New reply to your comment",
    follow: "New follower",
    mention: "You were mentioned",
    new_post: "New post from someone you follow",
    new_reel: "New reel from someone you follow",
    new_story: "New story from someone you follow",
    milestone_followers: "🎉 Milestone reached!",
    payment_confirmed: "💳 Payment confirmed",
    transfer_received: "💰 Money received",
    transfer_sent: "📤 Transfer sent",
    profile_view: "Someone viewed your profile",
    unlock: "Your story was unlocked",
  };
  return map[type] ?? "Xeevia";
}

function buildDeepLink(
  type: string,
  entityId: string | null,
  d: Record<string, unknown>,
): string {
  if (d?.url) return String(d.url);
  if (d?.deeplink_path) return String(d.deeplink_path);

  switch (type) {
    case "incoming_call":
    case "dm":
      return "/messages";
    case "like":
    case "comment":
    case "comment_reply":
    case "mention":
    case "new_post":
    case "share":
      return entityId ? `/post/${entityId}` : "/";
    case "new_reel":
      return entityId ? `/reel/${entityId}` : "/";
    case "new_story":
    case "unlock":
      return entityId ? `/story/${entityId}` : "/";
    case "follow":
    case "profile_view": {
      const aid = String(d?.actorId ?? d?.actor_id ?? "");
      return aid ? `/profile/${aid}` : "/";
    }
    case "payment_confirmed":
    case "milestone_followers":
    case "transfer_received":
    case "transfer_sent":
      return "/account";
    default:
      return "/";
  }
}

function getDedupTtlMs(type: string): number | null {
  if (type === "incoming_call" || type === "dm") return null;
  if (
    ["like", "comment", "comment_reply", "follow", "mention", "profile_view"].includes(type)
  )
    return 10 * 60 * 1000;
  return 30 * 60 * 1000;
}

// ── FCM push payload builder ──────────────────────────────────────────────────
// FCM v1 API uses this structure:
// {
//   "message": {
//     "token": "...",
//     "notification": { "title": "...", "body": "..." },
//     "data": { "key": "value", ... },
//     "android": { "priority": "high", "ttl": "..." },
//     "webpush": { "fcmOptions": { "link": "..." } }
//   }
// }
function buildFcmMessage(params: {
  token: string;
  type: string;
  title: string;
  body: string;
  deeplink: string;
  notifId: string;
  entityId: string | null;
  actorUserId: string | null;
  merged: Record<string, unknown>;
  isCall: boolean;
}): Record<string, unknown> {
  const {
    token,
    type,
    title,
    body,
    deeplink,
    notifId,
    entityId,
    actorUserId,
    merged,
    isCall,
  } = params;

  // Data payload (flat, JSON-serializable strings only)
  const data: Record<string, string> = {
    type,
    deeplink_path: deeplink,
    notification_id: notifId,
    entity_id: entityId ?? "",
    actor_user_id: actorUserId ?? "",
    conversation_id: (merged.conversation_id as string) ?? "",
    call_id: (merged.call_id as string) || (merged.callId as string) || "",
    caller_name: (merged.caller_name as string) || (merged.callerName as string) || "",
    caller_avatar_id:
      (merged.caller_avatar_id as string) || (merged.callerAvatarId as string) || "",
    message: (merged.message as string) ?? "",
    sender_name: (merged.senderName as string) ?? "",
  };

  return {
    message: {
      token,
      notification: {
        title,
        body,
        image: "/logo192.png",
      },
      data,
      // Android-specific options
      android: {
        priority: isCall || type === "dm" ? "high" : "normal",
        ttl: isCall ? "30s" : type === "dm" ? "86400s" : "259200s",
        notification: {
          click_action: deeplink,
          sound: "default",
          channel_id: isCall ? "calls" : "notifications",
          priority: isCall || type === "dm" ? "max" : "high",
        },
      },
      // Web push options (for web version if any)
      webpush: {
        fcmOptions: {
          link: `https://app.xeevia.com${deeplink}`,
        },
        notification: {
          title,
          body,
          icon: "/logo192.png",
          badge: "/logo192.png",
          click_action: `https://app.xeevia.com${deeplink}`,
        },
      },
      // Apple-specific options
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: "default",
            "custom-data": {
              deeplink_path: deeplink,
              notification_id: notifId,
            },
          },
        },
      },
    },
  };
}

// ── Send single FCM notification ──────────────────────────────────────────────
async function sendFcmNotification(
  token: string,
  message: Record<string, unknown>,
  accessToken: string,
): Promise<{ ok: boolean; status: number; expired: boolean; body: string }> {
  try {
    const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("[FCM] Send failed:", res.status, bodyText.slice(0, 240));

      // 400 with "NOT_FOUND" typically means the token is invalid/expired
      const isExpired = res.status === 400 && bodyText.includes("NOT_FOUND");
      return { ok: false, status: res.status, expired: isExpired, body: bodyText };
    }

    return { ok: true, status: res.status, expired: false, body: bodyText };
  } catch (err) {
    console.error("[FCM] sendFcmNotification error:", err);
    return { ok: false, status: 0, expired: false, body: String(err) };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Health check
  if (req.method === "GET") {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
      return json(
        {
          ok: false,
          error: "Firebase credentials not configured",
          required: [
            "FIREBASE_PROJECT_ID",
            "FIREBASE_PRIVATE_KEY",
            "FIREBASE_CLIENT_EMAIL",
          ],
        },
        500,
      );
    }
    return json({
      ok: true,
      message: "FCM delivery is configured",
      project_id: FIREBASE_PROJECT_ID,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Health / test via POST
  if (body?.health === true || body?.test === true) {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
      return json(
        {
          ok: false,
          error: "Firebase credentials not configured",
        },
        500,
      );
    }
    return json({ ok: true, message: "FCM delivery is configured" });
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    console.error("[FCM] Firebase credentials not configured");
    return json(
      {
        error: "Firebase credentials missing in Edge Function secrets",
        required: [
          "FIREBASE_PROJECT_ID",
          "FIREBASE_PRIVATE_KEY",
          "FIREBASE_CLIENT_EMAIL",
        ],
      },
      500,
    );
  }

  const {
    recipient_user_id,
    actor_user_id,
    type = "general",
    title: titleOverride,
    message: messageOverride,
    entity_id: entityId = null,
    metadata = {} as Record<string, unknown>,
    data: extraData = {} as Record<string, unknown>,
  } = body;

  if (!recipient_user_id) return json({ error: "recipient_user_id is required" }, 400);

  // Self-notification guard
  const socialTypes = [
    "like",
    "comment",
    "comment_reply",
    "follow",
    "mention",
    "profile_view",
    "new_post",
    "new_reel",
    "new_story",
    "share",
    "unlock",
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
      String(entityId || "none"),
      String(recipient_user_id),
    ]
      .join(":")
      .slice(0, 500);

    const { error: insertErr } = await supa
      .from("notification_dedup")
      .insert({
        dedup_key: dedupKey,
        expires_at: new Date(Date.now() + dedupTtlMs).toISOString(),
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        console.log(`[FCM] Duplicate blocked: ${dedupKey}`);
        return json({ sent: 0, reason: "duplicate_prevented" });
      }
      console.warn("[FCM] Dedup insert error (non-blocking):", insertErr.message);
    }

    // Async cleanup
    supa
      .from("notification_dedup")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .catch(() => {});
  }

  // ── Fetch FCM tokens ───────────────────────────────────────────────────────
  const { data: subs, error: subErr } = await supa
    .from("push_subscriptions")
    .select("id, fcm_token")
    .eq("user_id", recipient_user_id)
    .eq("provider", "fcm")
    .eq("is_active", true);

  if (subErr) {
    console.error("[FCM] DB error fetching subscriptions:", subErr.message);
    return json({ error: subErr.message }, 500);
  }

  if (!subs || subs.length === 0) {
    console.log(`[FCM] No active FCM subscriptions for user ${recipient_user_id}`);
    return json({ sent: 0, reason: "no_active_subscriptions" });
  }

  console.log(`[FCM] type=${type} recipients=${subs.length} user=${recipient_user_id}`);

  // ── Build payload ──────────────────────────────────────────────────────────
  const merged = {
    ...(metadata as object),
    ...(extraData as object),
  } as Record<string, unknown>;

  const notifId = String(merged.notification_id ?? `${type}_${Date.now()}`);
  const isCall = type === "incoming_call";

  const notifTitle = String(
    titleOverride ?? buildTitle(type as string, merged),
  );
  const notifBody = String(
    messageOverride ??
      (isCall
        ? `${String(merged.callerName ?? merged.caller_name ?? "Someone")} is calling`
        : String(merged.message ?? "")),
  );

  const deeplink = buildDeepLink(type as string, entityId as string | null, merged);

  // ── Get Firebase access token ──────────────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await getFirebaseAccessToken();
  } catch (err) {
    console.error("[FCM] Failed to get access token:", err);
    return json({ error: "Failed to authenticate with Firebase" }, 500);
  }

  // ── Send to all FCM tokens ────────────────────────────────────────────────
  const results = await Promise.allSettled(
    (subs as { id: string; fcm_token: string }[]).map((s) =>
      sendFcmNotification(
        s.fcm_token,
        buildFcmMessage({
          token: s.fcm_token,
          type: type as string,
          title: notifTitle,
          body: notifBody,
          deeplink,
          notifId,
          entityId: entityId as string | null,
          actorUserId: actor_user_id as string | null,
          merged,
          isCall,
        }),
        accessToken,
      ),
    ),
  );

  let sent = 0;
  const expiredIds: string[] = [];
  const errors: string[] = [];

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

  // ── Clean up expired tokens ────────────────────────────────────────────────
  if (expiredIds.length > 0) {
    await supa
      .from("push_subscriptions")
      .update({ is_active: false })
      .in("id", expiredIds)
      .catch((e) => console.warn("[FCM] Deactivate error:", e));
  }

  if (errors.length > 0) {
    console.error("[FCM] Errors:", errors.join(" | "));
  }

  console.log(
    `[FCM] Result: sent=${sent}/${subs.length} | expired=${expiredIds.length} | errors=${errors.length}`,
  );

  return json({
    sent,
    total: subs.length,
    expired: expiredIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
