import { supabase } from "../config/supabase";

const adCampaignService = {
  async getWallet(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("engagement_points")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return Number(data?.engagement_points || 0);
  },

  async listCampaigns(userId) {
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select("id,name,objective,budget_ep,escrow_ep,status,audience_definition,starts_at,ends_at,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createCampaign({ name, objective, budgetEp, audienceDefinition, startsAt, endsAt }) {
    const { data, error } = await supabase.rpc("create_ad_campaign", {
      p_name: name,
      p_objective: objective,
      p_budget_ep: Number(budgetEp),
      p_audience_definition: audienceDefinition || {},
      p_starts_at: startsAt || null,
      p_ends_at: endsAt || null,
    });
    if (error) throw error;
    return data;
  },

  async getCreatorPreferences(userId) {
    const { data, error } = await supabase
      .from("ad_creator_preferences")
      .select("enabled,topics")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data || { enabled: false, topics: [] };
  },

  async saveCreatorPreferences(enabled, topics) {
    const { error } = await supabase.rpc("save_ad_creator_preferences", {
      p_enabled: enabled,
      p_topics: topics,
    });
    if (error) throw error;
  },

  async listCreatorOffers() {
    const { data, error } = await supabase.rpc("list_creator_ad_offers");
    if (error) throw error;
    return data || [];
  },

  async respondToOffer(offerId, accept) {
    const { error } = await supabase.rpc("respond_to_ad_offer", {
      p_offer_id: offerId,
      p_accept: accept,
    });
    if (error) throw error;
  },

  async recordEvent(campaignId, creatorId, eventType) {
    const { data, error } = await supabase.rpc("record_ad_campaign_event", {
      p_campaign_id: campaignId,
      p_creator_id: creatorId,
      p_event_type: eventType,
    });
    if (error) throw error;
    return data;
  },

  async setViewerControl(campaignId, action, reason = null) {
    const { error } = await supabase.rpc("set_ad_viewer_control", {
      p_campaign_id: campaignId,
      p_action: action,
      p_reason: reason,
    });
    if (error) throw error;
  },

  async getSponsoredAds(limit = 3) {
    const { data, error } = await supabase.rpc("get_sponsored_ads_for_feed", { p_limit: limit });
    if (error) throw error;
    return data || [];
  },

  async settleCampaign(campaignId, close = false) {
    const { data, error } = await supabase.rpc("settle_ad_campaign", {
      p_campaign_id: campaignId,
      p_close: close,
    });
    if (error) throw error;
    return data;
  },

  async getCampaignReport(campaignId) {
    const { data, error } = await supabase.rpc("get_ad_campaign_report", {
      p_campaign_id: campaignId,
    });
    if (error) throw error;
    return data;
  },
};

export default adCampaignService;
