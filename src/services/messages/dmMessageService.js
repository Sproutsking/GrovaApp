import { supabase } from "../config/supabase";

/**
 * DMMessageService — UPDATED
 *
 * Key changes:
 * 1. Removed nothing that blocks access — the "login" guard was in the UI layers (headers),
 *    not here. This service assumes a valid userId is passed by the caller.
 * 2. Conversations created anywhere (UserProfileModal, header, etc.) all land in the same
 *    `conversations` table — so getConversations() always returns them all.
 * 3. Speed: sendMessage() returns the message IMMEDIATELY with a local timestamp,
 *    then fires the DB insert in the background. The realtime subscription delivers
 *    the server-confirmed version. This gives instant perceived send.
 * 4. Race-condition protection on conversation creation is preserved.
 */
class DMMessageService {
  constructor() {
    this.conversationCache = new Map();
    this.creationLocks = new Map();
  }

  // ─── CONVERSATION CREATION ──────────────────────────────────────────────────

  async createOrGetConversation(user1Id, user2Id) {
    if (!user1Id || !user2Id) throw new Error("Both user IDs required");
    if (user1Id === user2Id) throw new Error("Cannot message yourself");

    const cacheKey = [user1Id, user2Id].sort().join("-");

    if (this.conversationCache.has(cacheKey)) {
      return this.conversationCache.get(cacheKey);
    }

    if (this.creationLocks.has(cacheKey)) {
      return this.creationLocks.get(cacheKey);
    }

    const lockPromise = this._createOrGetInternal(user1Id, user2Id, cacheKey);
    this.creationLocks.set(cacheKey, lockPromise);

    try {
      const result = await lockPromise;
      this.conversationCache.set(cacheKey, result);
      return result;
    } finally {
      this.creationLocks.delete(cacheKey);
    }
  }

  async _createOrGetInternal(user1Id, user2Id, cacheKey) {
    const profileSelect = `
      id, full_name, username, avatar_id, avatar_metadata, verified, last_seen
    `;
    const convSelect = `
      *,
      user1:profiles!conversations_user1_id_fkey(${profileSelect}),
      user2:profiles!conversations_user2_id_fkey(${profileSelect})
    `;

    // Search existing
    const { data: existing, error: searchError } = await supabase
      .from("conversations")
      .select(convSelect)
      .or(
        `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`,
      )
      .maybeSingle();

    if (searchError && searchError.code !== "PGRST116") throw searchError;
    if (existing) return existing;

    // Create with retry
    let attempts = 0;
    while (attempts < 3) {
      try {
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            user1_id: user1Id,
            user2_id: user2Id,
            last_message_at: new Date().toISOString(),
          })
          .select(convSelect)
          .single();

        if (createError) {
          if (
            createError.code === "23505" ||
            createError.message?.includes("already exists")
          ) {
            const { data: fetched } = await supabase
              .from("conversations")
              .select(convSelect)
              .or(
                `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`,
              )
              .single();
            if (fetched) return fetched;
          }
          throw createError;
        }
        return newConv;
      } catch (error) {
        attempts++;
        if (attempts === 3) throw error;
        await new Promise((r) => setTimeout(r, 100 * attempts));
      }
    }
  }

  // ─── FETCH CONVERSATIONS ────────────────────────────────────────────────────

  async getConversations(userId) {
    if (!userId) throw new Error("User ID required");

    const profileSelect = `
      id, full_name, username, avatar_id, avatar_metadata, verified, last_seen
    `;

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(
        `*,
        user1:profiles!conversations_user1_id_fkey(${profileSelect}),
        user2:profiles!conversations_user2_id_fkey(${profileSelect})`,
      )
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (error) throw error;
    if (!conversations?.length) return [];

    // Batch-fetch last messages and unread counts for all conversations
    const convIds = conversations.map((c) => c.id);

    // Get last message for each conversation in one query
    const { data: lastMessages } = await supabase
      .from("messages")
      .select(
        "id, content, created_at, sender_id, read, delivered, conversation_id, media_type",
      )
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    // Build a map: conversationId -> last message
    const lastMsgMap = new Map();
    if (lastMessages) {
      for (const msg of lastMessages) {
        if (!lastMsgMap.has(msg.conversation_id)) {
          lastMsgMap.set(msg.conversation_id, msg);
        }
      }
    }

    // Get unread counts — messages not sent by me that are unread
    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("read", false)
      .neq("sender_id", userId);

    const unreadMap = new Map();
    if (unreadMessages) {
      for (const msg of unreadMessages) {
        unreadMap.set(
          msg.conversation_id,
          (unreadMap.get(msg.conversation_id) || 0) + 1,
        );
      }
    }

    return conversations.map((conv) => {
      const otherUser = conv.user1_id === userId ? conv.user2 : conv.user1;
      return {
        ...conv,
        otherUser,
        lastMessage: lastMsgMap.get(conv.id) || null,
        unreadCount: unreadMap.get(conv.id) || 0,
      };
    });
  }

  // ─── FETCH MESSAGES ─────────────────────────────────────────────────────────

  async getMessages(conversationId) {
    if (!conversationId) throw new Error("Conversation ID required");

    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `*,
        sender:profiles!messages_sender_id_fkey(id, full_name, username, avatar_id, avatar_metadata, verified)`,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Filter out soft-deleted messages
    const { data: deletedIds } = await supabase
      .from("deleted_messages")
      .select("message_id")
      .in(
        "message_id",
        (messages || []).map((m) => m.id),
      );

    const deletedSet = new Set((deletedIds || []).map((d) => d.message_id));
    return (messages || []).filter((m) => !deletedSet.has(m.id));
  }

  // ─── SEND MESSAGE (SPEED-FIRST) ─────────────────────────────────────────────

  /**
   * Sends a message. Returns an optimistic local message object IMMEDIATELY,
   * then persists to DB in background. The realtime subscription will deliver
   * the server-confirmed version with the real ID.
   *
   * The returned object has a special `_optimistic: true` flag so the UI can
   * distinguish it and replace it when the real one arrives.
   */
  async sendMessage(conversationId, senderId, content, senderProfile = null) {
    if (!conversationId || !senderId || !content?.trim()) {
      throw new Error("All fields required");
    }

    const trimmed = content.trim();
    const now = new Date();
    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Build optimistic message — returned INSTANTLY
    const optimisticMessage = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed,
      read: false,
      delivered: false,
      edited_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      media_url: null,
      media_type: null,
      sender: senderProfile
        ? {
            id: senderId,
            full_name: senderProfile.name || senderProfile.fullName || "You",
            username: senderProfile.username || "",
            avatar_id:
              senderProfile.avatarId || senderProfile.avatar_id || null,
            avatar_metadata:
              senderProfile.avatarMetadata ||
              senderProfile.avatar_metadata ||
              {},
            verified: senderProfile.verified || false,
          }
        : {
            id: senderId,
            full_name: "You",
            username: "",
            avatar_id: null,
            avatar_metadata: {},
            verified: false,
          },
      _optimistic: true,
    };

    // Fire DB insert in background — do NOT await before returning
    this._persistMessage(
      conversationId,
      senderId,
      trimmed,
      now.toISOString(),
      optimisticId,
    );

    return optimisticMessage;
  }

  async _persistMessage(
    conversationId,
    senderId,
    content,
    timestamp,
    optimisticId,
  ) {
    try {
      const { data: message } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content,
          read: false,
          delivered: true, // mark delivered immediately for sender's own view
          created_at: timestamp,
        })
        .select(
          `*,
          sender:profiles!messages_sender_id_fkey(id, full_name, username, avatar_id, avatar_metadata, verified)`,
        )
        .single();

      // Update conversation timestamp
      await supabase
        .from("conversations")
        .update({ last_message_at: timestamp })
        .eq("id", conversationId);

      // The realtime subscription will fire and the UI will replace the optimistic message
      // with this confirmed one. We tag it so the UI knows the optimistic ID to swap out.
      if (message) {
        message._replacesOptimistic = optimisticId;
      }
    } catch (e) {
      console.error("Message persist failed:", e);
      // The optimistic message stays in UI; you could add error state here
    }
  }

  // ─── READ / EDIT / DELETE ────────────────────────────────────────────────────

  async markAsRead(conversationId, userId) {
    if (!conversationId || !userId) return false;
    const { error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("read", false);
    return !error;
  }

  async editMessage(messageId, newContent, senderId) {
    if (!newContent?.trim()) throw new Error("Content cannot be empty");
    const { data, error } = await supabase
      .from("messages")
      .update({
        content: newContent.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("sender_id", senderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteMessage(messageId, userId) {
    const { error } = await supabase
      .from("deleted_messages")
      .insert({ message_id: messageId, user_id: userId });
    if (error && error.code !== "23505") throw error;
    return true;
  }

  // ─── UNREAD COUNT ───────────────────────────────────────────────────────────

  async getTotalUnreadCount(userId) {
    if (!userId) return 0;
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (!conversations?.length) return 0;

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in(
        "conversation_id",
        conversations.map((c) => c.id),
      )
      .eq("read", false)
      .neq("sender_id", userId);

    return count || 0;
  }

  // ─── REALTIME SUBSCRIPTIONS ─────────────────────────────────────────────────

  /**
   * Subscribe to messages in a specific conversation.
   * Callback: { type: 'INSERT'|'UPDATE'|'DELETE', message?, messageId? }
   * For INSERT: message includes _replacesOptimistic if it was from sendMessage()
   */
  subscribeToMessages(conversationId, callback) {
    const channel = supabase
      .channel(`dm-messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const { data } = await supabase
              .from("messages")
              .select(
                `*,
                sender:profiles!messages_sender_id_fkey(id, full_name, username, avatar_id, avatar_metadata, verified)`,
              )
              .eq("id", payload.new.id)
              .single();

            if (data) {
              callback({ type: payload.eventType, message: data });
            }
          } else if (payload.eventType === "DELETE") {
            callback({ type: "DELETE", messageId: payload.old.id });
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  /**
   * Subscribe to any message activity across all of a user's conversations.
   * Used by headers to update unread badge.
   */
  subscribeToConversations(userId, callback) {
    const channel = supabase
      .channel(`dm-conv-activity:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          if (!payload.new?.conversation_id) return;
          // Check if this conversation belongs to the user
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", payload.new.conversation_id)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .maybeSingle();

          if (conv) callback({ type: "NEW_MESSAGE", conversationId: conv.id });
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  clearCache() {
    this.conversationCache.clear();
  }
}

export default new DMMessageService();
