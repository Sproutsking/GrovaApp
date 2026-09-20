import { supabase } from "../config/supabase";
import { getPlatformCapabilities } from "./platformCapabilities";

export const SOCIAL_PROVIDERS = [
  { id: "xeevia", label: "Xeevia", ready: true },
  { id: "x", label: "X", ready: true },
  { id: "facebook", label: "Facebook", ready: true },
  { id: "instagram", label: "Instagram", ready: true },
  { id: "tiktok", label: "TikTok", ready: true },
  { id: "discord", label: "Discord", ready: true },
  { id: "youtube", label: "YouTube", ready: true },
  { id: "twitch", label: "Twitch", ready: true },
  { id: "snapchat", label: "Snapchat", ready: true },
];

const socialUpdatesService = {
  async listConnections(communityId) {
    const { data, error } = await supabase.from("community_social_connections").select("*").eq("community_id", communityId).order("created_at");
    if (error) throw error;
    return data || [];
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
