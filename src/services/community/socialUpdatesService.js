import { supabase } from "../config/supabase";

export const SOCIAL_PROVIDERS = [
  { id: "xeevia", label: "Xeevia", ready: true },
  { id: "x", label: "X", ready: false },
  { id: "facebook", label: "Facebook", ready: false },
  { id: "instagram", label: "Instagram", ready: false },
  { id: "tiktok", label: "TikTok", ready: false },
  { id: "discord", label: "Discord", ready: false },
];

const socialUpdatesService = {
  async listConnections(communityId) {
    const { data, error } = await supabase.from("community_social_connections").select("*").eq("community_id", communityId).order("created_at");
    if (error) throw error;
    return data || [];
  },
  async listPosts(channelId) {
    const { data, error } = await supabase.from("community_external_posts").select("*").eq("channel_id", channelId).order("published_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async connectXeevia(communityId, userId) {
    const { data, error } = await supabase.from("community_social_connections").upsert({ community_id: communityId, connected_by: userId, provider: "xeevia", provider_account_id: userId, display_name: "Xeevia account", status: "active", scopes: ["internal:posts"], updated_at: new Date().toISOString() }, { onConflict: "community_id,provider,provider_account_id" }).select().single();
    if (error) throw error;
    return data;
  },
};

export default socialUpdatesService;
