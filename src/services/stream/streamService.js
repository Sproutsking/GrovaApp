// src/services/stream/streamService.js
// ============================================================================
// STREAMING SERVICE — LiveKit abstraction layer
// ============================================================================
//
// Architecture:
//   Frontend  ──►  streamService  ──►  Supabase Edge Function  ──►  LiveKit
//                                 └──►  Supabase DB (sessions, usage, viewers)
//
// LiveKit credentials NEVER touch the frontend.
// All token generation happens in the Edge Function (see /supabase/functions/stream/).
//
// To wire LiveKit:
//   1. Deploy the Edge Function (see EDGE_FUNCTION_TEMPLATE below)
//   2. Set secrets: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
//   3. Set REACT_APP_SUPABASE_STREAM_FUNCTION_URL in your .env
// ============================================================================

import { supabase } from "../config/supabase";

// ── Config ────────────────────────────────────────────────────────────────────
// CRA uses process.env.REACT_APP_* (not import.meta.env.VITE_*)
const STREAM_FUNCTION_URL =
  process.env.REACT_APP_SUPABASE_STREAM_FUNCTION_URL ||
  `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/stream`;

// Heartbeat interval (ms) — host pings every 30s to stay "live"
const HEARTBEAT_INTERVAL = 30_000;

// Viewer presence ping interval (ms)
const VIEWER_PING_INTERVAL = 20_000;

// Auto-end grace period — if heartbeat stops, backend ends session after 90s
// This constant is informational; enforcement is server-side
export const HEARTBEAT_TIMEOUT_MS = 90_000;

// ── Types (JSDoc) ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} StreamSession
 * @property {string}  id
 * @property {string}  user_id
 * @property {string}  title
 * @property {string}  category
 * @property {'video'|'audio'} mode
 * @property {string}  quality_preset
 * @property {boolean} is_private
 * @property {boolean} is_recording
 * @property {string}  livekit_room
 * @property {'pending'|'live'|'ended'|'failed'} status
 * @property {string}  started_at
 * @property {string|null} ended_at
 * @property {number}  peak_viewers
 * @property {number}  total_likes
 */

/**
 * @typedef {Object} StartStreamResult
 * @property {StreamSession} session
 * @property {string}        livekitToken   — short-lived JWT for LiveKit SDK
 * @property {string}        livekitUrl     — wss://... LiveKit server URL
 * @property {number}        minutesRemaining
 */

/**
 * @typedef {Object} UsageInfo
 * @property {number} minutesUsed
 * @property {number} minutesLimit
 * @property {number} minutesRemaining
 * @property {boolean} canRecord
 * @property {string}  maxQuality
 */

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Call the Supabase Edge Function with auth header.
 * Falls back gracefully if the function isn't deployed yet (dev mode).
 */
async function callEdgeFunction(action, payload = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  try {
    const res = await fetch(STREAM_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, ...payload }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Edge function error: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    // If edge function isn't deployed, return a mock token for dev
    if (
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError")
    ) {
      console.warn(
        "[streamService] Edge function unreachable — using mock mode",
      );
      return _mockEdgeResponse(action, payload);
    }
    throw err;
  }
}

/** Mock responses for local dev without a deployed edge function */
function _mockEdgeResponse(action, payload) {
  if (action === "start") {
    return {
      livekitToken: "mock-token-" + Date.now(),
      livekitUrl: "wss://mock.livekit.cloud",
      roomName: payload.roomName || "mock-room-" + Date.now(),
    };
  }
  return { success: true };
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

const streamService = {
  // ── Usage & limits ──────────────────────────────────────────────────────────

  /**
   * Get current monthly usage + limits for a user.
   * Computed dynamically — never stored as "remaining".
   * @param {string} userId
   * @returns {Promise<UsageInfo>}
   */
  async getUsage(userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    const tier = profile?.subscription_tier || "free";

    const { data: limits } = await supabase
      .from("stream_tier_limits")
      .select("*")
      .eq("tier", tier)
      .single();

    const minutesLimit = limits?.minutes_per_month ?? 60;
    const canRecord = limits?.can_record ?? false;
    const maxQuality = limits?.max_quality ?? "medium";

    const { data: usageData } = await supabase.rpc("get_stream_monthly_usage", {
      p_user_id: userId,
    });

    const minutesUsed = usageData ?? 0;
    const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);

    return {
      minutesUsed,
      minutesLimit,
      minutesRemaining,
      canRecord,
      maxQuality,
      tier,
    };
  },

  // ── Session lifecycle ───────────────────────────────────────────────────────

  /**
   * Pre-validate before showing the Go Live button.
   * Returns { canStream, reason, usage }
   */
  async preCheck(userId) {
    try {
      const usage = await streamService.getUsage(userId);
      if (usage.minutesRemaining <= 0) {
        return { canStream: false, reason: "monthly_limit_reached", usage };
      }
      if (usage.minutesRemaining < 5) {
        return { canStream: true, reason: "low_minutes", usage };
      }
      return { canStream: true, reason: null, usage };
    } catch (e) {
      return { canStream: false, reason: "check_failed", usage: null };
    }
  },

  /**
   * Step 1: Create the session record in Supabase (status = 'pending').
   * Step 2: Call edge function to get LiveKit token.
   * Step 3: Update session to status = 'live'.
   *
   * @param {string} userId
   * @param {{ title, category, mode, qualityPreset, isPrivate, isRecording }} opts
   * @returns {Promise<StartStreamResult>}
   */
  async startSession(userId, opts) {
    const {
      title,
      category = "General",
      mode = "video",
      qualityPreset = "high",
      isPrivate = false,
      isRecording = false,
    } = opts;

    const { canStream, reason, usage } = await streamService.preCheck(userId);
    if (!canStream)
      throw new Error(
        reason === "monthly_limit_reached"
          ? "You've used all your streaming minutes this month. Upgrade to get more."
          : "Unable to start stream. Please try again.",
      );

    const roomName = `xeevia-${userId.slice(0, 8)}-${Date.now()}`;

    const { data: session, error: insertErr } = await supabase
      .from("live_sessions")
      .insert({
        user_id: userId,
        title,
        category,
        mode,
        quality_preset: qualityPreset,
        is_private: isPrivate,
        is_recording: isRecording && (usage?.canRecord ?? false),
        livekit_room: roomName,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr)
      throw new Error("Failed to create session: " + insertErr.message);

    let livekitToken, livekitUrl;
    try {
      const result = await callEdgeFunction("start", {
        roomName,
        userId,
        userName: opts.userName || "host",
        isHost: true,
      });
      livekitToken = result.livekitToken;
      livekitUrl = result.livekitUrl;
    } catch (e) {
      await supabase
        .from("live_sessions")
        .update({ status: "failed" })
        .eq("id", session.id);
      throw e;
    }

    const { data: liveSession } = await supabase
      .from("live_sessions")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", session.id)
      .select()
      .single();

    return {
      session: liveSession,
      livekitToken,
      livekitUrl,
      minutesRemaining: usage.minutesRemaining,
    };
  },

  /**
   * End a stream. Calculates duration, writes usage log, updates session.
   * @param {string} sessionId
   * @param {string} userId
   * @param {{ peakViewers, totalLikes, cfStreamUid, cfPlaybackUrl }} meta
   */
  async endSession(sessionId, userId, meta = {}) {
    const now = new Date().toISOString();

    const { data: session } = await supabase
      .from("live_sessions")
      .select("started_at, is_recording, status")
      .eq("id", sessionId)
      .single();

    if (!session || session.status === "ended") return;

    const startedAt = session.started_at
      ? new Date(session.started_at)
      : new Date();
    const durationMs = new Date() - startedAt;
    const minutesUsed = Math.max(1, Math.ceil(durationMs / 60_000));

    try {
      await callEdgeFunction("end", { sessionId, userId });
    } catch {
      /* non-fatal */
    }

    await supabase
      .from("live_sessions")
      .update({
        status: "ended",
        ended_at: now,
        peak_viewers: meta.peakViewers ?? 0,
        total_likes: meta.totalLikes ?? 0,
        cf_stream_uid: meta.cfStreamUid ?? null,
        cf_playback_url: meta.cfPlaybackUrl ?? null,
      })
      .eq("id", sessionId);

    await supabase.from("stream_usage_logs").insert({
      user_id: userId,
      session_id: sessionId,
      minutes_used: minutesUsed,
      was_recording: session.is_recording ?? false,
      peak_viewers: meta.peakViewers ?? 0,
      ep_earned: Math.floor((meta.totalLikes ?? 0) * 0.1 + minutesUsed * 2),
    });

    return { minutesUsed };
  },

  // ── Heartbeat ────────────────────────────────────────────────────────────────

  /**
   * Start sending heartbeats for a live session.
   * Returns a cleanup function — call it when stream ends.
   * @param {string} sessionId
   * @returns {() => void} cleanup
   */
  startHeartbeat(sessionId) {
    const ping = async () => {
      await supabase
        .from("live_sessions")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("id", sessionId);
    };
    ping();
    const iv = setInterval(ping, HEARTBEAT_INTERVAL);
    return () => clearInterval(iv);
  },

  // ── Viewer presence ──────────────────────────────────────────────────────────

  /**
   * Join a stream as a viewer (upserts presence row).
   * Returns cleanup function.
   * @param {string} sessionId
   * @param {string} userId
   * @returns {() => void} cleanup
   */
  joinAsViewer(sessionId, userId) {
    const ping = async () => {
      await supabase.from("stream_viewers").upsert(
        {
          session_id: sessionId,
          user_id: userId,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "session_id,user_id" },
      );
    };
    ping();
    const iv = setInterval(ping, VIEWER_PING_INTERVAL);
    return () => clearInterval(iv);
  },

  /**
   * Get viewer token for joining a stream as audience.
   * @param {string} roomName
   * @param {string} userId
   * @param {string} userName
   */
  async getViewerToken(roomName, userId, userName) {
    const result = await callEdgeFunction("join", {
      roomName,
      userId,
      userName,
      isHost: false,
    });
    return { livekitToken: result.livekitToken, livekitUrl: result.livekitUrl };
  },

  // ── Queries ──────────────────────────────────────────────────────────────────

  /**
   * Get all currently live public sessions with streamer profile info.
   */
  async getLiveSessions({ limit = 20 } = {}) {
    const { data, error } = await supabase
      .from("live_sessions")
      .select(
        `
        id, title, category, mode, peak_viewers, total_likes,
        started_at, livekit_room, is_private,
        profiles:user_id (
          id, full_name, username, avatar_id, verified
        )
      `,
      )
      .eq("status", "live")
      .eq("is_private", false)
      .order("peak_viewers", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single live session by ID (for joining).
   */
  async getSession(sessionId) {
    const { data, error } = await supabase
      .from("live_sessions")
      .select(
        `
        *,
        profiles:user_id (id, full_name, username, avatar_id, verified)
      `,
      )
      .eq("id", sessionId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Real-time subscription to live session list changes.
   * @param {(sessions: StreamSession[]) => void} callback
   * @returns {() => void} cleanup
   */
  subscribeToLiveSessions(callback) {
    const channel = supabase
      .channel("live_sessions_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_sessions",
          filter: "status=eq.live",
        },
        async () => {
          try {
            const sessions = await streamService.getLiveSessions();
            callback(sessions);
          } catch {
            /* silent */
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  /**
   * Real-time subscription to viewer count for a specific session.
   * @param {string} sessionId
   * @param {(count: number) => void} callback
   * @returns {() => void} cleanup
   */
  subscribeToViewerCount(sessionId, callback) {
    const channel = supabase
      .channel(`viewers_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stream_viewers",
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          const { data } = await supabase.rpc("get_live_viewer_count", {
            p_session_id: sessionId,
          });
          callback(data ?? 0);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },
};

export default streamService;

// ============================================================================
// EDGE FUNCTION TEMPLATE
// ============================================================================
// Deploy to: /supabase/functions/stream/index.ts
// Set secrets: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
//
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { AccessToken } from "npm:livekit-server-sdk@1.2.7";
//
// serve(async (req) => {
//   const { action, roomName, userId, userName, isHost } = await req.json();
//
//   const LIVEKIT_URL     = Deno.env.get("LIVEKIT_URL")!;
//   const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!;
//   const LIVEKIT_SECRET  = Deno.env.get("LIVEKIT_API_SECRET")!;
//
//   if (action === "start" || action === "join") {
//     const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
//       identity: userId,
//       name: userName,
//       ttl: "4h",
//     });
//     at.addGrant({
//       roomJoin: true,
//       room: roomName,
//       canPublish: isHost,
//       canSubscribe: true,
//       canPublishData: true,
//     });
//     return new Response(
//       JSON.stringify({ livekitToken: await at.toJwt(), livekitUrl: LIVEKIT_URL }),
//       { headers: { "Content-Type": "application/json" } }
//     );
//   }
//
//   if (action === "end") {
//     return new Response(JSON.stringify({ success: true }));
//   }
//
//   return new Response("Unknown action", { status: 400 });
// });
// ============================================================================
