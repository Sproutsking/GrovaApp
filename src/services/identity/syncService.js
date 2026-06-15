import { supabase } from "../config/supabase";

class SyncService {
  // enqueue a sync job for a user's profile changes
  async enqueueSync(userId, changeSet = {}) {
    const job = {
      profile_id: userId,
      change_set: changeSet,
      status: "pending",
      attempts: 0,
      scheduled_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("sync_jobs").insert(job).select().single();
    if (error) throw error;
    return data;
  }

  // lightweight status query
  async getJobsForProfile(userId) {
    const { data, error } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  }
}

const syncService = new SyncService();
export default syncService;
