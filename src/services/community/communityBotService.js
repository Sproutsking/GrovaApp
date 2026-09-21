import { supabase } from "../config/supabase";

const communityBotService = {
  async listIntegrations(communityId) {
    const [{ data: integrations, error: integrationsError }, { data: destinations, error: destinationsError }] = await Promise.all([
      supabase.from("community_bot_integrations").select("*").eq("community_id", communityId).order("provider"),
      supabase.from("community_bot_destinations").select("*").eq("community_id", communityId).order("display_name"),
    ]);
    if (integrationsError) throw integrationsError;
    if (destinationsError) throw destinationsError;
    return { integrations: integrations || [], destinations: destinations || [] };
  },

  async saveIntegration({ communityId, userId, provider, status = "pending", config = {} }) {
    const { data, error } = await supabase.from("community_bot_integrations").upsert({
      community_id: communityId,
      connected_by: userId,
      provider,
      status,
      config,
      updated_at: new Date().toISOString(),
    }, { onConflict: "community_id,provider" }).select().single();
    if (error) throw error;
    return data;
  },

  async saveDestination({ communityId, integrationId, provider, externalId, parentExternalId = null, displayName, destinationType = "channel" }) {
    const { data, error } = await supabase.from("community_bot_destinations").upsert({
      community_id: communityId,
      integration_id: integrationId,
      provider,
      external_id: externalId.trim(),
      parent_external_id: parentExternalId?.trim() || null,
      display_name: displayName.trim(),
      destination_type: destinationType,
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "integration_id,external_id" }).select().single();
    if (error) throw error;
    return data;
  },

  async toggleDestination(id, enabled) {
    const { error } = await supabase.from("community_bot_destinations").update({ enabled, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },

  async removeDestination(id) {
    const { error } = await supabase.from("community_bot_destinations").delete().eq("id", id);
    if (error) throw error;
  },

  async checkBot(provider, communityId) {
    const { data, error } = await supabase.functions.invoke("community-bot", { body: { action: "check", provider, communityId } });
    if (error) throw error;
    return data;
  },
};

export default communityBotService;
