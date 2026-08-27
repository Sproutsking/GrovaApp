import { supabase } from "../config/supabase";

const channelNotificationService = {
  async get(channelId, userId) {
    const { data } = await supabase.from("channel_notification_preferences").select("mode, unread_count, last_read_at").eq("channel_id", channelId).eq("user_id", userId).maybeSingle();
    return data || { mode: "all", unread_count: 0, last_read_at: null };
  },
  async setMode(channelId, userId, mode) {
    const { data, error } = await supabase.from("channel_notification_preferences").upsert({ channel_id: channelId, user_id: userId, mode, updated_at: new Date().toISOString() }, { onConflict: "user_id,channel_id" }).select().single();
    if (error) throw error;
    return data;
  },
  async markRead(channelId) {
    const { error } = await supabase.rpc("mark_channel_read", { p_channel_id: channelId });
    if (error) throw error;
  },
};

export default channelNotificationService;
