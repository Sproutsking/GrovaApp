// ============================================================================
// src/services/messages/dmMessageService.js — v3 DM-PUSH
// ============================================================================
//
// CHANGES vs v2:
//   • After a message is persisted to DB, _triggerDmPush() is called.
//     It looks up the recipient from conversationState, then calls the
//     send-push Supabase edge function with type: "dm".
//   • The edge function handles the rest: VAPID encryption, subscription
//     lookup, OS notification (app backgrounded) or PUSH_RECEIVED bridge
//     (app focused → InAppNotificationToast shows a DM toast).
//   • Push is best-effort and non-blocking — a push failure never affects
//     the message send result.
//
// Everything else is identical to v2.
// ============================================================================

import { supabase } from "../config/supabase";
import conversationState from "./ConversationStateManager";

class DMMessageService {
  constructor() {
    this.conversationChannels = new Map();
    this.listChannel = null;
    this.userId = null;
    this.pendingMessages = new Map(); // tempId → optimistic message
    this._seenBroadcastIds = new Set(); // dedup broadcast message ids
  }

  async init(userId) {
    this.userId = userId;
    await this.loadConversations();
  }

  // =========================================================================
  // CONVERSATIONS
  // =========================================================================

  async loadConversations() {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          `
          *,
          user1:profiles!conversations_user1_id_fkey(id, full_name, username, avatar_id, verified),
          user2:profiles!conversations_user2_id_fkey(id, full_name, username, avatar_id, verified)
        `,
        )
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUser =
            conv.user1_id === this.userId ? conv.user2 : conv.user1;
          const [{ data: lastMsg }, { data: unreadData }] = await Promise.all([
            supabase
              .from("messages")
              .select("*")
              .eq("conversation_id", conv.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase.rpc("get_conversation_unread_count", {
              p_conversation_id: conv.id,
              p_user_id: this.userId,
            }),
          ]);
          return {
            ...conv,
            otherUser,
            lastMessage: lastMsg,
            unreadCount: unreadData || 0,
          };
        }),
      );

      conversationState.initConversations(enriched);
      return enriched;
    } catch (error) {
      console.error("❌ Load conversations error:", error);
      return [];
    }
  }

  async createConversation(user1Id, user2Id) {
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select(
          `
          *,
          user1:profiles!conversations_user1_id_fkey(*),
          user2:profiles!conversations_user2_id_fkey(*)
        `,
        )
        .or(
          `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`,
        )
        .maybeSingle();

      if (existing) return existing;

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ user1_id: user1Id, user2_id: user2Id })
        .select(
          `
          *,
          user1:profiles!conversations_user1_id_fkey(*),
          user2:profiles!conversations_user2_id_fkey(*)
        `,
        )
        .single();

      if (error) throw error;
      return newConv;
    } catch (error) {
      console.error("❌ Create conversation error:", error);
      throw error;
    }
  }

  // =========================================================================
  // MESSAGES
  // =========================================================================

  async loadMessages(conversationId) {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      conversationState.initMessages(conversationId, data || []);
      return data || [];
    } catch (error) {
      console.error("❌ Load messages error:", error);
      return [];
    }
  }

  async sendMessage(conversationId, content, senderId) {
    if (!content?.trim() || !conversationId || !senderId) return null;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Optimistic UI injection (instant)
    const optimisticMessage = {
      id: tempId,
      _tempId: tempId,
      _optimistic: true,
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      read: false,
      delivered: false,
    };
    conversationState.addMessage(conversationId, optimisticMessage);
    this.pendingMessages.set(tempId, optimisticMessage);

    // Mark tempId as seen so the broadcast echo doesn't double-add it
    this._seenBroadcastIds.add(tempId);
    setTimeout(() => this._seenBroadcastIds.delete(tempId), 15_000);

    // 2. Broadcast to other user's client (instant)
    const channel = this.conversationChannels.get(
      `conversation:${conversationId}`,
    );
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "new_message",
        payload: {
          tempId,
          conversation_id: conversationId,
          sender_id: senderId,
          content: content.trim(),
          created_at: optimisticMessage.created_at,
        },
      });
    }

    try {
      // 3. Persist to DB (async)
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: content.trim(),
          delivered: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic with real message
      const current = conversationState.getMessages(conversationId);
      const updated = current.map((m) =>
        m._tempId === tempId ? { ...data, _replaced: true } : m,
      );
      conversationState.state.messagesByConversation.set(
        conversationId,
        updated,
      );
      conversationState.state.messageStatusById.set(data.id, "delivered");
      conversationState.emit();

      this.pendingMessages.delete(tempId);

      // Update conversation metadata
      supabase
        .from("conversations")
        .update({ last_message_at: data.created_at })
        .eq("id", conversationId)
        .then();

      // Broadcast real id so recipient can replace their temp entry
      if (channel) {
        channel.send({
          type: "broadcast",
          event: "message_confirmed",
          payload: { tempId, realId: data.id, created_at: data.created_at },
        });
      }

      // 4. Trigger push to recipient — best-effort, never blocks
      this._triggerDmPush(conversationId, senderId, content.trim());

      return data;
    } catch (error) {
      console.error("❌ [SEND] DB insert failed:", error);
      const current = conversationState.getMessages(conversationId);
      const updated = current.map((m) =>
        m._tempId === tempId ? { ...m, _failed: true } : m,
      );
      conversationState.state.messagesByConversation.set(
        conversationId,
        updated,
      );
      conversationState.emit();
      this.pendingMessages.delete(tempId);
      throw error;
    }
  }

  // =========================================================================
  // DM PUSH NOTIFICATION (internal)
  // =========================================================================

  async _triggerDmPush(conversationId, senderId, content) {
    try {
      const conv = conversationState.getConversation(conversationId);
      if (!conv) return;

      const recipientId =
        conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
      if (!recipientId || recipientId === senderId) return;

      const senderProfile =
        conv.user1_id === senderId ? conv.user1 : conv.user2;
      const senderName =
        senderProfile?.full_name || senderProfile?.username || "Someone";

      await supabase.functions.invoke("send-push", {
        body: {
          recipient_user_id: recipientId,
          actor_user_id: senderId,
          type: "dm",
          message: content.slice(0, 100),
          entity_id: conversationId,
          metadata: {
            conversation_id: conversationId,
            notification_id: `dm_${conversationId}_${Date.now()}`,
          },
          data: {
            url: "/messages",
            type: "dm",
            conversation_id: conversationId,
          },
        },
      });
    } catch (err) {
      // Non-fatal — message was already delivered successfully
      console.warn("[DMMessageService] Push trigger failed:", err);
    }
  }

  async markRead(conversationId, userId) {
    try {
      conversationState.clearUnread(conversationId);
      const { error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
        p_user_id: userId,
      });
      if (error) throw error;
      const channel = this.conversationChannels.get(
        `conversation:${conversationId}`,
      );
      if (channel) {
        channel.send({
          type: "broadcast",
          event: "message_read",
          payload: {
            conversation_id: conversationId,
            user_id: userId,
            read_at: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("❌ [READ] Mark read error:", error);
    }
  }

  // =========================================================================
  // REALTIME — CONVERSATION CHANNEL
  // =========================================================================

  subscribeToConversation(conversationId, callbacks = {}) {
    const channelKey = `conversation:${conversationId}`;
    if (this.conversationChannels.has(channelKey)) {
      return () => {};
    }

    const channel = supabase
      .channel(channelKey, {
        config: { broadcast: { self: true } },
      })

      // ── New message broadcast (PRIMARY delivery) ──────────────────────────
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        // Skip if we sent this (optimistic already in state)
        if (
          payload.sender_id === this.userId &&
          this._seenBroadcastIds.has(payload.tempId)
        ) {
          return;
        }

        // Dedup by tempId to prevent double-add from self=true echo
        if (this._seenBroadcastIds.has(payload.tempId)) return;
        this._seenBroadcastIds.add(payload.tempId);
        setTimeout(() => this._seenBroadcastIds.delete(payload.tempId), 15_000);

        const message = {
          id: payload.tempId || `temp_${Date.now()}`,
          conversation_id: payload.conversation_id,
          sender_id: payload.sender_id,
          content: payload.content,
          created_at: payload.created_at,
          delivered: true,
          read: false,
        };

        conversationState.addMessage(conversationId, message);

        if (
          !conversationState.isActive(conversationId) &&
          payload.sender_id !== this.userId
        ) {
          conversationState.incrementUnread(conversationId, payload.sender_id);
        }

        callbacks.onMessage?.(message);
      })

      // ── Message confirmed (tempId → real UUID) ───────────────────────────
      .on("broadcast", { event: "message_confirmed" }, ({ payload }) => {
        const current = conversationState.getMessages(conversationId);
        const updated = current.map((m) =>
          m.id === payload.tempId || m._tempId === payload.tempId
            ? {
                ...m,
                id: payload.realId,
                _tempId: undefined,
                _optimistic: false,
              }
            : m,
        );
        conversationState.state.messagesByConversation.set(
          conversationId,
          updated,
        );
        conversationState.emit();
      })

      // ── Read receipts ─────────────────────────────────────────────────────
      .on("broadcast", { event: "message_read" }, ({ payload }) => {
        if (payload.user_id !== this.userId) {
          conversationState.markAllRead(conversationId);
          callbacks.onRead?.(payload.user_id);
        }
      })

      // ── Typing indicators ─────────────────────────────────────────────────
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== this.userId) {
          callbacks.onTyping?.(
            payload.userId,
            payload.isTyping,
            payload.userName,
          );
        }
      })

      .subscribe((status) => {
        console.log(`🔌 [SUBSCRIBE] ${channelKey}:`, status);
      });

    this.conversationChannels.set(channelKey, channel);

    return () => {
      supabase.removeChannel(channel);
      this.conversationChannels.delete(channelKey);
    };
  }

  // =========================================================================
  // REALTIME — CONVERSATION LIST CHANNEL
  // =========================================================================
  //
  // NOTE: postgres_changes on "messages" and "message_reads" tables are
  // intentionally NOT subscribed here. Message delivery is handled solely
  // via the broadcast channel in subscribeToConversation(). The only thing
  // watched here is conversation metadata (last_message_at) for list sorting.
  //
  subscribeToConversationList() {
    if (this.listChannel) return () => {};

    this.listChannel = supabase
      .channel(`conversation_list:${this.userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `user1_id=eq.${this.userId}`,
        },
        (payload) => {
          conversationState.updateConversation(payload.new.id, {
            last_message_at: payload.new.last_message_at,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `user2_id=eq.${this.userId}`,
        },
        (payload) => {
          conversationState.updateConversation(payload.new.id, {
            last_message_at: payload.new.last_message_at,
          });
        },
      )
      .subscribe();

    return () => {
      if (this.listChannel) {
        supabase.removeChannel(this.listChannel);
        this.listChannel = null;
      }
    };
  }

  // =========================================================================
  // TYPING
  // =========================================================================

  sendTyping(conversationId, isTyping, userName) {
    const channel = this.conversationChannels.get(
      `conversation:${conversationId}`,
    );
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { conversationId, userId: this.userId, isTyping, userName },
      });
    }
  }

  /**
   * Backward-compat stub — typing is handled inside the conversation channel
   * via the "typing" broadcast event and the onTyping callback in
   * subscribeToConversation(). This method exists so any component that calls
   * dmMessageService.subscribeTyping() doesn't crash.
   */
  subscribeTyping(conversationId, callback) {
    return () => {};
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  cleanup() {
    this.conversationChannels.forEach((ch) => supabase.removeChannel(ch));
    this.conversationChannels.clear();
    if (this.listChannel) {
      supabase.removeChannel(this.listChannel);
      this.listChannel = null;
    }
    this.pendingMessages.clear();
    this._seenBroadcastIds.clear();
  }
}

export default new DMMessageService();
