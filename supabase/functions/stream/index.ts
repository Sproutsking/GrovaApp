// supabase/functions/stream/index.ts
// ============================================================================
// LiveKit token generation Edge Function for Xeevia streaming
// Handles: start (host), join (viewer), end (cleanup)
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken } from "npm:livekit-server-sdk@1.2.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
    const LIVEKIT_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_SECRET = Deno.env.get("LIVEKIT_API_SECRET");

    if (!LIVEKIT_URL || !LIVEKIT_KEY || !LIVEKIT_SECRET) {
      return new Response(
        JSON.stringify({
          error: "LiveKit credentials not configured in Supabase secrets",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const { action, roomName, userId, userName, isHost } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── START (host goes live) or JOIN (viewer watches) ─────────────────────
    if (action === "start" || action === "join") {
      if (!roomName || !userId) {
        return new Response(
          JSON.stringify({ error: "roomName and userId are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const at = new AccessToken(LIVEKIT_KEY, LIVEKIT_SECRET, {
        identity: userId,
        name: userName || userId,
        ttl: "4h",
      });

      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: isHost === true, // only host publishes video/audio
        canSubscribe: true, // everyone can receive
        canPublishData: true, // allows chat/data messages
      });

      const token = await at.toJwt();

      return new Response(
        JSON.stringify({
          livekitToken: token,
          livekitUrl: LIVEKIT_URL,
          roomName,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── END (host ends stream) ───────────────────────────────────────────────
    if (action === "end") {
      // LiveKit rooms auto-close when all publishers leave.
      // This action is a hook for any cleanup you want to add later
      // (e.g. trigger Cloudflare recording finalization).
      return new Response(
        JSON.stringify({ success: true, message: "Stream ended" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Unknown action ───────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Stream function error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
