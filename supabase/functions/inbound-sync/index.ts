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

const sourcePath = (connection: Record<string, unknown>) => String(connection.source_url || connection.platform_user_id || "");

const fetchJson = async (url: string, init: RequestInit = {}) => {
  const response = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Inbound provider returned ${response.status}`);
  return response.json();
};

async function fetchYouTube(connection: Record<string, unknown>) {
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");
  let channelId = String(connection.platform_user_id || "").match(/[A-Za-z0-9_-]{20,}/)?.[0];
  if (!channelId) {
    const query = sourceHandle(sourcePath(connection));
    if (query) {
      const lookup = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ key: apiKey, part: "snippet", q: query, type: "channel", maxResults: "1" })}`);
      channelId = lookup.items?.[0]?.snippet?.channelId;
    }
  }
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

async function fetchXeevia(connection: Record<string, unknown>) {
  const userId = String(connection.provider_account_id || "");
  if (!userId) throw new Error("Xeevia requires a connected account");
  const { data, error } = await supabase.from("posts").select("id,user_id,content,created_at,image_ids,video_ids").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(25);
  if (error) throw error;
  return (data || []).map((item: any) => ({ external_id: item.id, activity_type: "post", status: "published", author_name: userId, content: item.content, media: { image_ids: item.image_ids, video_ids: item.video_ids }, permalink: null, published_at: item.created_at, raw_payload: item }));
}

async function fetchX(connection: Record<string, unknown>) {
  const token = String(connection.__access_token || "");
  const username = sourceHandle(sourcePath(connection));
  if (!token || !username) throw new Error("X requires an OAuth token and public username");
  const user = await fetchJson(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await fetchJson(`https://api.x.com/2/users/${user.data.id}/tweets?${new URLSearchParams({ max_results: "25", "tweet.fields": "created_at,attachments", expansions: "attachments.media_keys", "media.fields": "url,preview_image_url" })}`, { headers: { Authorization: `Bearer ${token}` } });
  return (payload.data || []).map((item: any) => ({ external_id: item.id, activity_type: "post", status: "published", author_name: username, content: item.text, permalink: `https://x.com/${username}/status/${item.id}`, published_at: item.created_at, raw_payload: item }));
}

async function fetchFacebook(connection: Record<string, unknown>) {
  const token = String(connection.__access_token || "");
  const target = sourceHandle(sourcePath(connection));
  if (!token || !target) throw new Error("Facebook requires an OAuth token and page/profile link");
  const payload = await fetchJson(`https://graph.facebook.com/v21.0/${encodeURIComponent(target)}/posts?${new URLSearchParams({ access_token: token, fields: "id,message,created_time,permalink_url,full_picture", limit: "25" })}`);
  return (payload.data || []).map((item: any) => ({ external_id: item.id, activity_type: "post", status: "published", author_name: target, content: item.message, media: { image: item.full_picture }, permalink: item.permalink_url, published_at: item.created_time, raw_payload: item }));
}

async function fetchInstagram(connection: Record<string, unknown>) {
  const token = String(connection.__access_token || "");
  const target = String(connection.platform_user_id || "");
  if (!token || !target || /^https?:\/\//i.test(target)) throw new Error("Instagram requires an OAuth-linked professional account");
  const payload = await fetchJson(`https://graph.facebook.com/v21.0/${encodeURIComponent(target)}/media?${new URLSearchParams({ access_token: token, fields: "id,caption,media_type,media_url,permalink,timestamp", limit: "25" })}`);
  return (payload.data || []).map((item: any) => ({ external_id: item.id, activity_type: item.media_type === "VIDEO" ? "video" : "post", status: "published", content: item.caption, media: { url: item.media_url }, permalink: item.permalink, published_at: item.timestamp, raw_payload: item }));
}

async function fetchLinkedIn(connection: Record<string, unknown>) {
  const token = String(connection.__access_token || "");
  const author = String(connection.platform_user_id || "");
  if (!token || !author) throw new Error("LinkedIn requires an OAuth-linked account");
  const payload = await fetchJson(`https://api.linkedin.com/rest/posts?${new URLSearchParams({ q: "author", author: author.startsWith("urn:") ? author : `urn:li:person:${author}`, count: "25", sortBy: "LAST_MODIFIED" })}`, { headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": "202501", "X-Restli-Protocol-Version": "2.0.0" } });
  return (payload.elements || []).map((item: any) => ({ external_id: item.id, activity_type: "post", status: "published", content: item.commentary, permalink: item.id ? `https://www.linkedin.com/feed/update/${item.id}` : null, published_at: item.created?.time ? new Date(item.created.time).toISOString() : null, raw_payload: item }));
}

async function fetchGitHub(connection: Record<string, unknown>) {
  const handle = sourceHandle(sourcePath(connection));
  if (!handle) throw new Error("GitHub requires a public profile link");
  const payload = await fetchJson(`https://api.github.com/users/${encodeURIComponent(handle)}/events/public`, { headers: { "User-Agent": "Xeevia-community-sync" } });
  return (payload || []).map((item: any) => ({ external_id: item.id, activity_type: "post", status: "published", author_name: item.actor?.display_login || handle, title: item.repo?.name, content: item.type, permalink: item.repo?.name ? `https://github.com/${item.repo.name}` : `https://github.com/${handle}`, published_at: item.created_at, raw_payload: item }));
}

async function fetchReddit(connection: Record<string, unknown>) {
  const value = sourcePath(connection);
  const match = value.match(/reddit\.com\/(?:user|u)\/([^/]+)/i);
  if (!match) throw new Error("Reddit requires a public user profile link");
  const payload = await fetchJson(`https://www.reddit.com/user/${encodeURIComponent(match[1])}/submitted.json?limit=25`, { headers: { "User-Agent": "Xeevia-community-sync/1.0" } });
  return (payload.data?.children || []).map((item: any) => { const post = item.data || {}; return { external_id: post.id, activity_type: "post", status: "published", author_name: post.author, title: post.title, content: post.selftext, permalink: `https://www.reddit.com${post.permalink}`, published_at: new Date(post.created_utc * 1000).toISOString(), raw_payload: post }; });
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
  if (connection.provider === "xeevia") return fetchXeevia(connection);
  if (connection.provider === "x") return fetchX(connection);
  if (connection.provider === "facebook") return fetchFacebook(connection);
  if (connection.provider === "instagram") return fetchInstagram(connection);
  if (connection.provider === "youtube") return fetchYouTube(connection);
  if (connection.provider === "twitch") return fetchTwitch(connection);
  if (connection.provider === "linkedin") return fetchLinkedIn(connection);
  if (connection.provider === "github") return fetchGitHub(connection);
  if (connection.provider === "reddit") return fetchReddit(connection);
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
