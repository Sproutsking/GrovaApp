import { supabase } from "../config/supabase";
import { getPlatformCapabilities } from "./platformCapabilities";

export const SOCIAL_PROVIDERS = [
  { id: "xeevia", label: "Xeevia", ready: true },
  { id: "x", label: "X", ready: true },
  { id: "facebook", label: "Facebook", ready: true },
  { id: "instagram", label: "Instagram", ready: true },
  { id: "tiktok", label: "TikTok", ready: true },
  { id: "youtube", label: "YouTube", ready: true },
  { id: "twitch", label: "Twitch", ready: true },
  { id: "kick", label: "Kick", ready: false },
];

const socialUpdatesService = {
  async listConnections(communityId) {
    const { data, error } = await supabase.from("community_social_connections").select("*").eq("community_id", communityId).order("created_at");
    if (error) throw error;
    return data || [];
  },
  async saveProfileConnection({ communityId, userId, provider, profileUrl }) {
    let parsed;
    try { parsed = new URL(profileUrl); } catch { throw new Error("Enter a valid public profile URL."); }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Enter a valid public profile URL.");
    const capabilities = getPlatformCapabilities(provider);
    if (!capabilities) throw new Error("Choose a supported platform.");
    const { data, error } = await supabase.from("community_social_connections").upsert({
      community_id: communityId,
      connected_by: userId,
      provider,
      provider_account_id: parsed.toString(),
      display_name: parsed.hostname.replace(/^www\./, ""),
      source_url: parsed.toString(),
      status: "active",
      scopes: ["profile_link"],
      capabilities: { inboundReady: capabilities.inboundReady, canDetectLive: capabilities.canDetectLive, source: "profile_link" },
      updated_at: new Date().toISOString(),
    }, { onConflict: "community_id,provider,provider_account_id" }).select().single();
    if (error) throw error;
    return data;
  },
  async connectLinkedSource({ communityId, userId, provider, providerAccountId }) {
    const { data, error } = await supabase.from("community_social_connections").upsert({
      community_id: communityId,
      connected_by: userId,
      provider,
      provider_account_id: providerAccountId,
      display_name: provider,
      status: "active",
      scopes: ["identity_link"],
      updated_at: new Date().toISOString(),
    }, { onConflict: "community_id,provider,provider_account_id" }).select().single();
    if (error) throw error;
    return data;
  },
  async listPosts(channelId) {
    let { data, error } = await supabase.from("community_external_activities").select("*").eq("channel_id", channelId).order("published_at", { ascending: false });
    if (error?.code === "42P01") {
      const legacy = await supabase.from("community_external_posts").select("*").eq("channel_id", channelId).order("published_at", { ascending: false });
      data = legacy.data;
      error = legacy.error;
    }
    if (error) throw error;
    return (data || []).map((activity) => ({
      ...activity,
      external_post_id: activity.external_id,
      content: activity.content || activity.title,
    }));
  },
  async listRouting(communityId) {
    const { data, error } = await supabase
      .from("community_channel_sources")
      .select("*, connection:community_social_connections(*)")
      .eq("community_id", communityId)
      .order("created_at");
    if (error) throw error;
    return data || [];
  },
  async listLiveActivities(communityId) {
    const { data, error } = await supabase
      .from("community_external_activities")
      .select("*")
      .eq("community_id", communityId)
      .eq("activity_type", "live")
      .eq("status", "live")
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async listRecentSyncRuns(communityId) {
    const { data, error } = await supabase.from("community_sync_runs")
      .select("*, connection:community_social_connections(provider, display_name)")
      .eq("community_id", communityId).order("started_at", { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
  },
  async saveRouting({ communityId, channelId, connectionId, contentTypes = ["post", "video", "live"], includeInLiveFeed = false }) {
    const { data: connection, error: connectionError } = await supabase
      .from("community_social_connections")
      .select("provider")
      .eq("id", connectionId)
      .single();
    if (connectionError) throw connectionError;
    const capabilities = getPlatformCapabilities(connection.provider);
    const acceptedTypes = contentTypes.filter((type) => type !== "live" || capabilities?.canDetectLive);
    const { data, error } = await supabase.from("community_channel_sources").upsert({
      community_id: communityId,
      channel_id: channelId,
      connection_id: connectionId,
      content_types: acceptedTypes,
      include_in_live_feed: Boolean(includeInLiveFeed && capabilities?.canDetectLive),
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "channel_id,connection_id" }).select("*, connection:community_social_connections(*)").single();
    if (error) throw error;
    return data;
  },
  async removeRouting(routingId) {
    const { error } = await supabase.from("community_channel_sources").delete().eq("id", routingId);
    if (error) throw error;
  },
  async requestSync(communityId, connectionId = null) {
    const { data, error } = await supabase.functions.invoke("inbound-sync", {
      body: { communityId, connectionId, mode: "manual" },
    });
    if (error) throw error;
    return data;
  },
  async connectXeevia(communityId, userId) {
    const { data, error } = await supabase.from("community_social_connections").upsert({ community_id: communityId, connected_by: userId, provider: "xeevia", provider_account_id: userId, display_name: "Xeevia account", status: "active", scopes: ["internal:posts"], updated_at: new Date().toISOString() }, { onConflict: "community_id,provider,provider_account_id" }).select().single();
    if (error) throw error;
    return data;
  },
};

export default socialUpdatesService;
