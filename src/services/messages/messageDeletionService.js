import { supabase } from "../config/supabase";

const isSupportedKind = (kind) => ["direct", "group", "community"].includes(kind);

const messageDeletionService = {
  async getHiddenMessageIds(kind, conversationId) {
    if (!isSupportedKind(kind) || !conversationId) throw new Error("A valid conversation is required.");
    const { data, error } = await supabase.rpc("get_hidden_chat_message_ids", {
      p_message_kind: kind,
      p_conversation_id: String(conversationId),
    });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Could not load hidden messages.");
    return data.map(String);
  },

  async submit(kind, conversationId, messageIds, action) {
    if (!isSupportedKind(kind) || !conversationId || !Array.isArray(messageIds) || !messageIds.length) {
      throw new Error("Select at least one message to continue.");
    }
    if (!["for_me", "everyone", "request"].includes(action)) throw new Error("Invalid deletion action.");
    const { data, error } = await supabase.rpc("submit_chat_message_deletion", {
      p_message_kind: kind,
      p_conversation_id: String(conversationId),
      p_message_ids: messageIds,
      p_action: action,
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.deleted_ids)) throw new Error("The deletion request returned an invalid response.");
    return {
      deletedIds: data.deleted_ids.map(String),
      requestedCount: Number(data.requested_count) || 0,
      hiddenCount: Number(data.hidden_count) || 0,
      batchId: data.batch_id || null,
    };
  },

  async getPendingRequests(kind, conversationId) {
    if (!isSupportedKind(kind) || !conversationId) throw new Error("A valid conversation is required.");
    const { data, error } = await supabase.rpc("get_pending_message_delete_requests", {
      p_message_kind: kind,
      p_conversation_id: String(conversationId),
    });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Could not load deletion requests.");
    return data;
  },

  async respond(batchId, accept) {
    if (!batchId || typeof accept !== "boolean") throw new Error("A deletion request response is required.");
    const { data, error } = await supabase.rpc("respond_to_message_delete_request", {
      p_batch_id: batchId,
      p_accept: accept,
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.deleted_ids)) throw new Error("The deletion response returned an invalid result.");
    return data.deleted_ids.map(String);
  },

  subscribeToRequests(userId, onChange) {
    if (!userId || typeof onChange !== "function") throw new Error("A user and request handler are required.");
    return supabase
      .channel(`message-delete-requests:${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_delete_requests",
        filter: `author_id=eq.${userId}`,
      }, onChange)
      .subscribe();
  },

  removeSubscription(channel) {
    if (channel) return supabase.removeChannel(channel);
    return Promise.resolve();
  },
};

export default messageDeletionService;
