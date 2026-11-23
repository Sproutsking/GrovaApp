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
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  inspectVapidKeyPair,
  sendWebPush,
  validateVapidKeyPair,
} from "../_shared/webPush.ts";

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

    const data = (await res.json()) as { access_token?: unknown };
    if (typeof data.access_token !== "string" || !data.access_token) {
      throw new Error("OAuth response did not contain an access token");
    }
    return data.access_token;
  } catch (err) {
    console.error("[FCM] getFirebaseAccessToken error:", err);
    throw err;
  }
}

// ── RSA-SHA256 JWT signing ────────────────────────────────────────────────────
async function signJwt(payload: string, privateKeyPem: string): Promise<string> {
  const pemBody = privateKeyPem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (character) => character.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
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

function buildBody(type: string, d: Record<string, unknown>): string {
  const actor = cleanText(d.actorName ?? "Someone", 80) || "Someone";
  switch (type) {
    case "incoming_call":
      return `${cleanText(d.callerName ?? actor, 80) || "Someone"} is calling you`;
    case "dm":
    case "payment_confirmed":
      return cleanText(d.message, 500);
    case "like":
      return `${actor} liked your content`;
    case "comment":
      return `${actor} commented on your content`;
    case "comment_reply":
      return `${actor} replied to your comment`;
    case "follow":
      return `${actor} started following you`;
    case "share":
      return `${actor} shared your content`;
    case "unlock":
      return `${actor} unlocked your story`;
    default:
      return "";
  }
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

function normalizeDeepLink(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const url = new URL(value, "https://app.xeevia.com");
    if (url.origin !== "https://app.xeevia.com") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getDedupTtlMs(type: string): number | null {
  if (type === "dm") return null;
  if (type === "call_cancelled") return null;
  if (type === "incoming_call") return 30 * 1000;
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

  if (type === "call_cancelled") {
    return {
      message: {
        token,
        data,
        android: { priority: "high", ttl: "60s" },
        webpush: { headers: { TTL: "60" } },
        apns: { payload: { aps: { "content-available": 1 } } },
      },
    };
  }

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

const EVENT_FRESHNESS_MS = 5 * 60 * 1000;

async function hasRecentRow(
    query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
    label: string,
): Promise<unknown | null> {
    const { data, error } = await query;
    if (error) {
      console.error(`[FCM] Could not verify ${label}:`, error.message);
      return null;
    }
    return data ?? null;
}

async function contentOwnerMatches(
    supa: SupabaseClient<any, "public", "public">,
    table: string,
    entityId: string,
    recipientId: string,
): Promise<boolean> {
    const { data, error } = await supa
      .from(table)
      .select("user_id")
      .eq("id", entityId)
      .maybeSingle();
    if (error) {
      console.error(`[FCM] Could not verify owner for ${table}:`, error.message);
      return false;
    }
    return data?.user_id === recipientId;
}

async function authorizePushEvent(
    supa: SupabaseClient<any, "public", "public">,
    input: {
      actorId: string;
      recipientId: string;
      type: string;
      entityId: string | null;
      metadata: Record<string, unknown>;
    },
): Promise<boolean> {
    const { actorId, recipientId, type, entityId, metadata } = input;
    const recentAfter = new Date(Date.now() - EVENT_FRESHNESS_MS).toISOString();

    if (type === "payment_confirmed" && entityId && actorId === recipientId) {
      return Boolean(
        await hasRecentRow(
          supa
            .from("payments")
            .select("id")
            .eq("id", entityId)
            .eq("user_id", actorId)
            .eq("status", "completed")
            .gte("created_at", recentAfter)
            .limit(1)
            .maybeSingle(),
          "completed-payment event",
        ),
      );
    }
    if (type === "follow") {
      return Boolean(
        await hasRecentRow(
          supa
            .from("follows")
            .select("id")
            .eq("follower_id", actorId)
            .eq("following_id", recipientId)
            .gte("created_at", recentAfter)
            .limit(1)
            .maybeSingle(),
          "follow event",
        ),
      );
    }

    if (type === "profile_view") {
      return Boolean(
        await hasRecentRow(
          supa
            .from("profile_views")
            .select("id")
            .eq("profile_id", recipientId)
            .eq("viewer_id", actorId)
            .gte("viewed_at", recentAfter)
            .limit(1)
            .maybeSingle(),
          "profile-view event",
        ),
      );
    }

    if (type === "like" && entityId) {
      const contentTypes = [
        { table: "posts", likes: "post_likes", foreignKey: "post_id" },
        { table: "reels", likes: "reel_likes", foreignKey: "reel_id" },
        { table: "stories", likes: "story_likes", foreignKey: "story_id" },
      ];
      for (const content of contentTypes) {
        if (!(await contentOwnerMatches(supa, content.table, entityId, recipientId))) continue;
        return Boolean(
          await hasRecentRow(
            supa
              .from(content.likes)
              .select("id")
              .eq(content.foreignKey, entityId)
              .eq("user_id", actorId)
              .gte("created_at", recentAfter)
              .limit(1)
              .maybeSingle(),
            "like event",
          ),
        );
      }
      return false;
    }

    if ((type === "comment" || type === "comment_reply") && entityId) {
      const contentTypes = [
        { table: "posts", foreignKey: "post_id" },
        { table: "reels", foreignKey: "reel_id" },
        { table: "stories", foreignKey: "story_id" },
      ];
      for (const content of contentTypes) {
        let commentQuery = supa
          .from("comments")
          .select("id, parent_id")
          .eq("user_id", actorId)
          .eq(content.foreignKey, entityId)
          .gte("created_at", recentAfter);
        commentQuery = type === "comment"
          ? commentQuery.is("parent_id", null)
          : commentQuery.not("parent_id", "is", null);
        const { data: comment, error } = await commentQuery.limit(1).maybeSingle();
        if (error) {
          console.error("[FCM] Could not verify comment event:", error.message);
          return false;
        }
        if (!comment) continue;

        if (type === "comment" && comment.parent_id === null) {
          return contentOwnerMatches(supa, content.table, entityId, recipientId);
        }
        if (type === "comment_reply" && comment.parent_id) {
          const { data: parent, error: parentError } = await supa
            .from("comments")
            .select("user_id, post_id, reel_id, story_id")
            .eq("id", comment.parent_id)
            .maybeSingle();
          if (parentError) {
            console.error("[FCM] Could not verify reply recipient:", parentError.message);
            return false;
          }
          const parentContentId = content.foreignKey === "post_id"
            ? parent?.post_id
            : content.foreignKey === "reel_id"
            ? parent?.reel_id
            : parent?.story_id;
          return (
            parent?.user_id === recipientId &&
            parentContentId === entityId
          );
        }
      }
      return false;
    }

    if (type === "share" && entityId) {
      const contentTypes = [
        { type: "post", table: "posts" },
        { type: "reel", table: "reels" },
        { type: "story", table: "stories" },
      ];
      for (const content of contentTypes) {
        if (!(await contentOwnerMatches(supa, content.table, entityId, recipientId))) continue;
        return Boolean(
          await hasRecentRow(
            supa
              .from("shares")
              .select("id")
              .eq("user_id", actorId)
              .eq("content_type", content.type)
              .eq("content_id", entityId)
              .gte("created_at", recentAfter)
              .limit(1)
              .maybeSingle(),
            "share event",
          ),
        );
      }
      return false;
    }

    if (type === "unlock" && entityId) {
      if (!(await contentOwnerMatches(supa, "stories", entityId, recipientId))) return false;
      return Boolean(
        await hasRecentRow(
          supa
            .from("unlocked_stories")
            .select("id")
            .eq("user_id", actorId)
            .eq("story_id", entityId)
            .gte("created_at", recentAfter)
            .limit(1)
            .maybeSingle(),
          "story unlock event",
        ),
      );
    }

    if (type === "dm" && entityId) {
      const message = await hasRecentRow(
        supa
          .from("messages")
          .select("id")
          .eq("conversation_id", entityId)
          .eq("sender_id", actorId)
          .gte("created_at", recentAfter)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        "direct-message event",
      );
      if (!message) return false;

      const { data: conversation, error } = await supa
        .from("conversations")
        .select("user1_id, user2_id")
        .eq("id", entityId)
        .maybeSingle();
      if (error) {
        console.error("[FCM] Could not verify conversation:", error.message);
        return false;
      }
      return (
        (conversation?.user1_id === actorId && conversation?.user2_id === recipientId) ||
        (conversation?.user2_id === actorId && conversation?.user1_id === recipientId)
      );
    }

    if (type === "incoming_call") {
      const callId = String(entityId || metadata.callId || metadata.call_id || "");
      if (!callId) return false;
      const call = await hasRecentRow(
        supa
          .from("active_calls")
          .select("callee_ids")
          .eq("id", callId)
          .eq("caller_id", actorId)
          .eq("status", "ringing")
          .gte("created_at", recentAfter)
          .maybeSingle(),
        "incoming-call event",
      ) as { callee_ids?: string[] } | null;
      return Array.isArray(call?.callee_ids) && call.callee_ids.includes(recipientId);
    }

    if (type === "call_cancelled") {
      const callId = String(entityId || metadata.callId || metadata.call_id || "");
      if (!callId) return false;
      const call = await hasRecentRow(
        supa
          .from("active_calls")
          .select("caller_id, callee_ids, status, ended_at")
          .eq("id", callId)
          .in("status", ["ended", "declined", "no_answer", "cancelled"])
          .gte("ended_at", recentAfter)
          .maybeSingle(),
        "call-cancellation event",
      ) as { caller_id?: string; callee_ids?: string[] } | null;
      const participants = [call?.caller_id, ...(call?.callee_ids || [])];
      return participants.includes(actorId)
        && participants.includes(recipientId)
        && actorId !== recipientId;
    }

    return false;
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
    const fcmConfigured = Boolean(
      FIREBASE_PROJECT_ID && FIREBASE_PRIVATE_KEY && FIREBASE_CLIENT_EMAIL,
    );
    const vapidKeyStatus = await inspectVapidKeyPair(
      Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
      Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
    );
    const legacyConfigured = vapidKeyStatus.publicKeyValid
      && vapidKeyStatus.privateKeyParses
      && vapidKeyStatus.keysMatch;
    const providers = { fcm: fcmConfigured, legacyWebPush: legacyConfigured };
    const ok = fcmConfigured || legacyConfigured;
    return json({
      ok,
      message: ok
        ? "At least one push provider is configured"
        : "No push provider credentials are configured",
      providers,
      legacyKeyCheck: {
        publicKeyValid: vapidKeyStatus.publicKeyValid,
        privateKeyParses: vapidKeyStatus.privateKeyParses,
        keysMatch: vapidKeyStatus.keysMatch,
      },
      ...(fcmConfigured ? { project_id: FIREBASE_PROJECT_ID } : {}),
    }, ok ? 200 : 503);
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

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[FCM] Supabase authentication configuration is incomplete");
    return json({ error: "Authentication unavailable" }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const supa = createClient(supabaseUrl, serviceRoleKey);

  // This admin-only probe validates both providers without sending a push.
  if (body?.health === true || body?.test === true) {
    const { data: profile, error: profileError } = await supa
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("[FCM] Could not verify health-check role:", profileError.message);
      return json({ error: "Could not verify access" }, 503);
    }
    if (profile?.is_admin !== true) return json({ error: "Forbidden" }, 403);

    let firebaseAuth = false;
    if (FIREBASE_PROJECT_ID && FIREBASE_PRIVATE_KEY && FIREBASE_CLIENT_EMAIL) {
      try {
        await getFirebaseAccessToken();
        firebaseAuth = true;
      } catch (err) {
        console.error("[FCM] Service-account health check failed:", err);
      }
    }
    const vapidPairValid = await validateVapidKeyPair(
      Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
      Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
    );
    const providers = { fcm: firebaseAuth, legacyWebPush: vapidPairValid };
    const ok = firebaseAuth && vapidPairValid;
    return json({
      ok,
      message: ok
        ? "FCM and legacy Web Push credentials validated; no push was sent"
        : "One or more push provider credentials failed validation",
      providers,
    }, ok ? 200 : 503);
  }

  const recipientUserId = typeof body.recipient_user_id === "string"
    ? body.recipient_user_id
    : "";
  const actorUserId = typeof body.actor_user_id === "string"
    ? body.actor_user_id
    : "";
  const type = typeof body.type === "string" ? body.type : "general";
  const titleOverride = body.title;
  const messageOverride = body.message;
  const entityId = typeof body.entity_id === "string" ? body.entity_id : null;
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : {};
  const extraData = body.data && typeof body.data === "object" && !Array.isArray(body.data)
    ? body.data as Record<string, unknown>
    : {};

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(recipientUserId)) {
    return json({ error: "A valid recipient_user_id is required" }, 400);
  }
  if (actorUserId !== user.id) {
    return json({ error: "actor_user_id must match the authenticated user" }, 403);
  }

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
    socialTypes.includes(type) &&
    actorUserId === recipientUserId
  ) {
    return json({ sent: 0, reason: "self_notification_skipped" });
  }

  const eventIsAuthorized = await authorizePushEvent(supa, {
    actorId: user.id,
    recipientId: recipientUserId,
    type,
    entityId,
    metadata,
  });
  if (!eventIsAuthorized) {
    return json({ error: "No matching authorized notification event" }, 403);
  }

  const preferenceByType: Record<string, string> = {
    profile_view: "notify_profile_visits",
    comment: "notify_comments",
    comment_reply: "notify_comments",
    mention: "notify_comments",
    like: "notify_likes",
    share: "notify_shares",
    follow: "notify_followers",
    milestone_followers: "notify_followers",
    new_post: "notify_followers",
    new_reel: "notify_followers",
    new_story: "notify_followers",
    unlock: "notify_unlocks",
    dm: "notify_messages",
    incoming_call: "notify_calls",
    payment_confirmed: "notify_payments",
    transfer_received: "notify_payments",
    transfer_sent: "notify_payments",
  };
  const preferenceKey = preferenceByType[type];
  if (preferenceKey && type !== "call_cancelled") {
    const { data: recipientProfile, error: preferencesError } = await supa
      .from("profiles")
      .select("preferences")
      .eq("id", recipientUserId)
      .maybeSingle();
    if (preferencesError) {
      console.error("[FCM] Could not verify recipient notification preferences:", preferencesError.message);
      return json({ error: "Could not verify notification preferences" }, 503);
    }
    if (recipientProfile?.preferences?.[preferenceKey] !== true) {
      return json({ sent: 0, reason: "notification_disabled" });
    }
  }

  const { data: actorProfile, error: profileError } = await supa
    .from("profiles")
    .select("full_name, username, avatar_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("[FCM] Could not resolve notification actor:", profileError.message);
    return json({ error: "Could not prepare notification" }, 503);
  }
  const actorName = cleanText(
    actorProfile?.full_name || actorProfile?.username || "Someone",
    80,
  ) || "Someone";

  // ── Fetch active FCM and legacy Web Push subscriptions ─────────────────────
  const { data: subs, error: subErr } = await supa
    .from("push_subscriptions")
    .select("id, provider, fcm_token, endpoint, p256dh, auth")
    .eq("user_id", recipientUserId)
    .in("provider", ["fcm", "legacy"])
    .eq("is_active", true);

  if (subErr) {
    console.error("[FCM] DB error fetching subscriptions:", subErr.message);
    return json({ error: subErr.message }, 500);
  }

  if (!subs || subs.length === 0) {
    console.log(`[Push] No active push subscriptions for user ${recipientUserId}`);
    return json({ sent: 0, reason: "no_active_subscriptions" });
  }

  const fcmSubs = subs.filter((sub) =>
    sub.provider === "fcm" && typeof sub.fcm_token === "string" && sub.fcm_token.length > 0
  );
  const legacySubs = subs.filter((sub) =>
    sub.provider === "legacy"
    && typeof sub.endpoint === "string"
    && typeof sub.p256dh === "string"
    && typeof sub.auth === "string"
  );
  const errors: string[] = [];

  if (fcmSubs.length + legacySubs.length === 0) {
    console.warn("[Push] Active subscription rows have no usable delivery credentials");
    return json({ sent: 0, reason: "no_usable_subscriptions" });
  }

  console.log(
    `[Push] type=${type} fcm=${fcmSubs.length} legacy=${legacySubs.length} user=${recipientUserId}`,
  );

  // ── Build payload ──────────────────────────────────────────────────────────
  const merged: Record<string, unknown> = {
    ...metadata,
    ...extraData,
    actorName,
    senderName: actorName,
    callerName: actorName,
    actorId: user.id,
    actor_id: user.id,
    caller_name: actorName,
    caller_avatar_id: actorProfile?.avatar_id || "",
  };

  if (type === "dm") {
    const { data: latestMessage, error: messageError } = await supa
      .from("messages")
      .select("content")
      .eq("conversation_id", entityId)
      .eq("sender_id", user.id)
      .gte("created_at", new Date(Date.now() - EVENT_FRESHNESS_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (messageError) {
      console.error("[FCM] Could not resolve direct-message preview:", messageError.message);
      return json({ error: "Could not prepare notification" }, 503);
    }
    if (!latestMessage) return json({ error: "No matching direct message" }, 403);
    merged.message = latestMessage.content;
    merged.conversation_id = entityId;
  } else if (type === "incoming_call") {
    merged.callId = entityId;
    merged.call_id = entityId;
  } else if (type === "payment_confirmed" && messageOverride != null) {
    merged.message = messageOverride;
  }

  const notifId =
    cleanText(merged.notification_id ?? `${type}_${Date.now()}`, 128) ||
    `${type}_${Date.now()}`;
  const isCall = type === "incoming_call";

  const notifTitle = cleanText(
    type === "payment_confirmed" ? titleOverride ?? buildTitle(type, merged) : buildTitle(type, merged),
    100,
  );
  const notifBody = buildBody(type, merged);

  const deeplink = normalizeDeepLink(buildDeepLink(type, entityId, merged));

  const legacyData: Record<string, string> = {
    url: deeplink,
    deeplink_path: deeplink,
    type,
    notification_id: notifId,
    entity_id: entityId ?? "",
    actor_user_id: actorUserId,
    conversation_id: String(merged.conversation_id ?? ""),
    call_id: String(merged.call_id || merged.callId || ""),
    call_type: String(merged.call_type || merged.callType || "audio"),
    caller_name: String(merged.caller_name || merged.callerName || ""),
    caller_avatar_id: String(merged.caller_avatar_id || merged.callerAvatarId || ""),
    message: String(merged.message ?? ""),
    sender_name: String(merged.senderName ?? ""),
  };
  const legacyTag = type === "incoming_call"
    ? `call_${legacyData.call_id || notifId}`
    : type === "dm"
    ? `dm_${legacyData.conversation_id || notifId}`
    : `notif_${notifId}`;
  const legacyPayload = JSON.stringify({
    title: notifTitle,
    body: notifBody,
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag: legacyTag,
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [500, 100, 500, 100, 500] : [200, 100, 200],
    actions: isCall
      ? [{ action: "accept", title: "✅ Accept" }, { action: "decline", title: "❌ Decline" }]
      : [{ action: "view", title: "View" }, { action: "dismiss", title: "Dismiss" }],
    data: legacyData,
  });

  let firebaseAccessToken: string | null = null;
  if (fcmSubs.length > 0) {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
      errors.push("FCM credentials are not configured");
    } else {
      try {
        firebaseAccessToken = await getFirebaseAccessToken();
      } catch (err) {
        console.error("[FCM] Failed to get access token:", err);
        errors.push("Firebase authentication failed");
      }
    }
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@xeevia.com";
  const legacyConfigured = legacySubs.length > 0 && await validateVapidKeyPair(
    vapidPublicKey,
    vapidPrivateKey,
  );
  if (legacySubs.length > 0 && !legacyConfigured) {
    errors.push("Legacy Web Push credentials are not configured");
  }

  if (!firebaseAccessToken && !(legacySubs.length > 0 && legacyConfigured)) {
    return json({
      error: errors.join("; ") || "No configured delivery provider",
    }, 503);
  }

  // Reserve only after at least one authorized delivery path is available.
  const dedupTtlMs = getDedupTtlMs(type);
  if (dedupTtlMs !== null) {
    const dedupKey = [
      type,
      actorUserId,
      String(entityId || "none"),
      recipientUserId,
    ]
      .join(":")
      .slice(0, 500);

    const { error: insertErr } = await supa
      .from("notification_dedup")
      .insert({
        dedup_key: dedupKey,
        expires_at: new Date(Date.now() + dedupTtlMs).toISOString(),
      });

    if (insertErr?.code === "23505") {
      return json({ sent: 0, reason: "duplicate_prevented" });
    }
    if (insertErr) {
      console.error("[FCM] Could not reserve notification delivery:", insertErr.message);
      return json({ error: "Could not verify notification delivery status" }, 503);
    }

    const { error: dedupCleanupError } = await supa
      .from("notification_dedup")
      .delete()
      .lt("expires_at", new Date().toISOString());
    if (dedupCleanupError) {
      console.warn("[FCM] Dedup cleanup failed:", dedupCleanupError.message);
    }
  }

  const deliveries: Array<{
    subscriptionId: string;
    send: Promise<{ ok: boolean; status: number; expired: boolean; body: string }>;
  }> = [];
  if (firebaseAccessToken) {
    for (const sub of fcmSubs) {
      deliveries.push({
        subscriptionId: sub.id,
        send: sendFcmNotification(
          sub.fcm_token,
          buildFcmMessage({
            token: sub.fcm_token,
            type,
            title: notifTitle,
            body: notifBody,
            deeplink,
            notifId,
            entityId,
            actorUserId,
            merged,
            isCall,
          }),
          firebaseAccessToken,
        ),
      });
    }
  }
  if (legacyConfigured) {
    for (const sub of legacySubs) {
      deliveries.push({
        subscriptionId: sub.id,
        send: sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          legacyPayload,
          {
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject,
            ttl: isCall ? 30 : type === "dm" ? 86400 : 259200,
            urgency: isCall || type === "dm" ? "high" : "normal",
          },
        ),
      });
    }
  }

  const results = await Promise.allSettled(deliveries.map((delivery) => delivery.send));
  let sent = 0;
  const expiredIds: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const subscriptionId = deliveries[i].subscriptionId;

    if (r.status === "fulfilled") {
      if (r.value.ok) {
        sent++;
      } else if (r.value.expired) {
        expiredIds.push(subscriptionId);
      } else {
        errors.push(`sub[${i}]: HTTP ${r.value.status} — ${r.value.body.slice(0, 120)}`);
      }
    } else {
      errors.push(`sub[${i}]: ${String(r.reason)}`);
    }
  }

  // ── Clean up expired tokens ────────────────────────────────────────────────
  if (expiredIds.length > 0) {
    const { error: deactivateError } = await supa
      .from("push_subscriptions")
      .update({ is_active: false })
      .in("id", expiredIds);
    if (deactivateError) {
      console.warn("[FCM] Could not deactivate expired tokens:", deactivateError.message);
    }
  }

  if (errors.length > 0) {
    console.error("[FCM] Errors:", errors.join(" | "));
  }

  console.log(
    `[Push] Result: sent=${sent}/${deliveries.length} | expired=${expiredIds.length} | errors=${errors.length}`,
  );

  return json({
    sent,
    total: deliveries.length,
    providers: {
      fcm: fcmSubs.length,
      legacy: legacySubs.length,
    },
    expired: expiredIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
