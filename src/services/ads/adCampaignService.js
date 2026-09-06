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
};

export default adCampaignService;
