import { supabase } from "../config/supabase";
import syncService from "./syncService";

class IdentityService {
  // Reads the canonical profile (source of truth)
  async getProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  // Update SOT profile and enqueue a sync job
  async updateProfile(userId, changes, actor = userId) {
    // ensure we update identity_version_timestamp
    const payload = {
      ...changes,
      identity_version_timestamp: new Date().toISOString(),
      updated_by: actor,
    };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId);
    if (error) throw error;

    // enqueue deterministic sync job for all connected platforms
    await syncService.enqueueSync(userId, payload);
    return true;
  }
}

const identityService = new IdentityService();
export default identityService;
