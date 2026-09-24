import { supabase } from "../config/supabase";

function normalizeVerificationData(invoice) {
  const result = invoice || { configured: false };
  return result;
}

const verificationService = {
  async getPanel(communityId) {
    try {
      const { data, error } = await supabase.rpc("get_verification_panel", { p_community_id: communityId });
      if (error) {
        if (error.message && /does not exist|function/i.test(error.message)) {
          const { data: toolRow, error: rowError } = await supabase
            .from("community_tool_settings")
            .select("config")
            .eq("community_id", communityId)
            .eq("tool_type", "verification")
            .maybeSingle();
          if (rowError) throw rowError;
          return normalizeVerificationData(toolRow?.config || { configured: false });
        }
        throw error;
      }
      return normalizeVerificationData(data || { configured: false });
    } catch (error) {
      console.error("Verification panel load failed:", error);
      throw error;
    }
  },

  async complete(communityId, method, payload = {}) {
    try {
      const { data, error } = await supabase.rpc("complete_community_verification", {
        p_community_id: communityId,
        p_method: method,
        p_answer: payload?.answer ?? null,
        p_accepted: Boolean(payload?.accepted),
      });
      if (error) throw error;
      return data || { success: false, error: "Verification failed." };
    } catch (error) {
      console.error("Verification completion failed:", error);
      throw error;
    }
  },
};

export default verificationService;
