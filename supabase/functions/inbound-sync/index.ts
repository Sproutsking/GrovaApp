import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const sourceHandle = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.pathname.split("/").filter(Boolean).pop() || null;
  } catch {
    return value.replace(/^@/, "").split("/").filter(Boolean).pop() || null;
  }
};

async function fetchYouTube(connection: Record<string, unknown>) {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");
  const channelId = String(connection.platform_user_id || "").match(/[A-Za-z0-9_-]{20,}/)?.[0];
  if (!channelId) return [];
  const params = new URLSearchParams({ key: apiKey, part: "snippet", channelId, order: "date", type: "video", maxResults: "25" });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
  const payload = await response.json();
  return (payload.items || []).map((item: any) => ({
    external_id: item.id?.videoId,
    activity_type: item.snippet?.liveBroadcastContent === "live" ? "live" : "video",
    status: item.snippet?.liveBroadcastContent === "live" ? "live" : "published",
    author_name: item.snippet?.channelTitle,
    title: item.snippet?.title,
    content: item.snippet?.description,
    media: { thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url },
    permalink: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    published_at: item.snippet?.publishedAt,
    raw_payload: item,
  })).filter((item: any) => item.external_id);
}

async function fetchTwitch(connection: Record<string, unknown>) {
  const clientId = Deno.env.get("TWITCH_CLIENT_ID");
  const token = String(connection.__access_token || "");
  const login = sourceHandle(String(connection.platform_user_id || ""));
  if (!clientId || !token || !login) throw new Error("Twitch client credentials or OAuth token are not configured");
  const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, { headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Twitch API returned ${response.status}`);
  const payload = await response.json();
  return (payload.data || []).map((stream: any) => ({
    external_id: stream.id,
    activity_type: "live",
    status: "live",
    author_name: stream.user_name,
    title: stream.title,
    content: stream.game_name,
    media: { thumbnail: stream.thumbnail_url, viewer_count: stream.viewer_count },
    permalink: `https://www.twitch.tv/${login}`,
    starts_at: stream.started_at,
    published_at: stream.started_at,
    raw_payload: stream,
  }));
}

async function fetchActivities(connection: Record<string, unknown>) {
  if (connection.provider === "youtube") return fetchYouTube(connection);
  if (connection.provider === "twitch") return fetchTwitch(connection);
  throw new Error(`${connection.provider} inbound adapter is not configured yet`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const communityId = body.communityId || null;
    const connectionId = body.connectionId || null;
    let query = supabase.from("community_channel_sources").select("*, connection:community_social_connections(*)").eq("enabled", true);
    if (communityId) query = query.eq("community_id", communityId);
    if (connectionId) query = query.eq("connection_id", connectionId);
    const { data: routes, error: routeError } = await query;
    if (routeError) throw routeError;

    const results = [];
    for (const route of routes || []) {
      const connection = { ...(route.connection || {}) };
      const { data: token } = await supabase.from("tokens").select("encrypted_token, expires_at").eq("connection_id", connection.id).eq("revoked", false).maybeSingle();
      if (token && (!token.expires_at || new Date(token.expires_at).getTime() > Date.now())) connection.__access_token = token.encrypted_token;
      const { data: run, error: runError } = await supabase.from("community_sync_runs").insert({ community_id: route.community_id, connection_id: route.connection_id, status: "running" }).select().single();
      if (runError) throw runError;
      try {
        const activities = await fetchActivities(connection);
        const allowed = new Set(route.content_types || ["post", "video", "live"]);
        const filtered = activities.filter((activity: any) => allowed.has(activity.activity_type));
        let written = 0;
        for (const activity of filtered) {
          const { error: activityError } = await supabase.from("community_external_activities").upsert({
            community_id: route.community_id,
            channel_id: route.channel_id,
            connection_id: route.connection_id,
            provider: connection.provider,
            ...activity,
            updated_at: new Date().toISOString(),
          }, { onConflict: "connection_id,external_id,activity_type" });
          if (!activityError) written += 1;
        }
        await supabase.from("community_channel_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", route.id);
        await supabase.from("community_social_connections").update({ last_synced_at: new Date().toISOString(), status: "active" }).eq("id", route.connection_id);
        await supabase.from("community_sync_runs").update({ status: "succeeded", items_seen: activities.length, items_written: written, finished_at: new Date().toISOString() }).eq("id", run.id);
        results.push({ connectionId: route.connection_id, status: "succeeded", itemsSeen: activities.length, itemsWritten: written });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabase.from("community_sync_runs").update({ status: "failed", error_message: message, finished_at: new Date().toISOString() }).eq("id", run.id);
        await supabase.from("community_social_connections").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", route.connection_id);
        results.push({ connectionId: route.connection_id, status: "failed", error: message });
      }
    }
    return json({ ok: true, results });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
