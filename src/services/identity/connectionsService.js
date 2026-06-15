import { supabase } from "../config/supabase";

class ConnectionsService {
  async listConnections(userId) {
    const { data, error } = await supabase
      .from("connections")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return data || [];
  }

  async getConnection(connectionId) {
    const { data, error } = await supabase
      .from("connections")
      .select("*")
      .eq("id", connectionId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async upsertConnection(connection) {
    const { data, error } = await supabase
      .from("connections")
      .upsert(connection, { onConflict: ["provider","platform_user_id","user_id"] })
      .select();
    if (error) throw error;
    return data;
  }

  // NOTE: token encryption/secure storage handled by backend/edge function.
  async markAuthStatus(connectionId, status) {
    const { error } = await supabase
      .from("connections")
      .update({ auth_status: status })
      .eq("id", connectionId);
    if (error) throw error;
    return true;
  }
}

const connectionsService = new ConnectionsService();
export default connectionsService;
