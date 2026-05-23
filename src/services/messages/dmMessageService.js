// ============================================================================
// src/services/messages/dmMessageService.js — v9 WITH PUSH FIXED
// ============================================================================
// CHANGES vs v8:
//   [PUSH-1] _triggerDmPush() now passes actorUserId: senderId correctly.
//            Without this, the edge function's self-notification guard could
//            misfire — recipient_user_id matched actor_user_id=null for social
//            types, and some pushes were silently blocked.
//   [PUSH-2] _triggerDmPush() passes metadata flat (no nested `data` key).
//            pushService.sendPushToUser() handles the correct shape.
//   All v8 realtime fixes preserved exactly.
// ============================================================================

import { supabase } from "../config/supabase";
import conversationState from "./ConversationStateManager";
import pushService from "../notifications/pushService";

class DMMessageService {
  constructor() {
    this.conversationChannels = new Map();
    this.channelReady = new Map();
    this.listChannel = null;
    this.userId = null;
    this.pendingMessages = new Map();
    this._seenBroadcastIds = new Set();
  }

  async init(userId) {
    this.userId = userId;
    await this.loadConversations();
  }

  // ── Safe broadcast helper ─────────────────────────────────────────────────
  _sendBroadcast(channel, event, payload, retried = false) {
    if (!channel) return;
    const channelKey = channel.topic;
    const ready = this.channelReady.get(channelKey);
    if (!ready && !retried) {
      setTimeout(
        () => this._sendBroadcast(channel, event, payload, true),
        1000,
      );
      return;
    }
    channel.send({ type: "broadcast", event, payload }).catch((err) => {
      console.warn("[DM] broadcast warn:", err?.message || err);
    });
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
      console.error("❌ [DM] Load conversations error:", error);
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
          `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),` +
            `and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`,
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
      console.error("❌ [DM] Create conversation error:", error);
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
        .select("*, reply_to_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      conversationState.initMessages(conversationId, data || []);
      return data || [];
    } catch (error) {
      console.error("❌ [DM] Load messages error:", error);
      return [];
    }
  }

  async sendMessage(conversationId, content, senderId, replyToId = null) {
    if (!content?.trim() || !conversationId || !senderId) return null;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Optimistic UI update
    const optimisticMessage = {
      id: tempId,
      _tempId: tempId,
      _optimistic: true,
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      reply_to_id: replyToId || null,
      created_at: new Date().toISOString(),
      read: false,
      delivered: false,
    };
    conversationState.addMessage(conversationId, optimisticMessage);
    this.pendingMessages.set(tempId, optimisticMessage);
    this._seenBroadcastIds.add(tempId);
    setTimeout(() => this._seenBroadcastIds.delete(tempId), 30_000);

    // 2. Broadcast to recipient via Realtime (for when they're online)
    const channel = this.conversationChannels.get(
      `conversation:${conversationId}`,
    );
    this._sendBroadcast(channel, "new_message", {
      tempId,
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      reply_to_id: replyToId || null,
      created_at: optimisticMessage.created_at,
    });

    try {
      // 3. Persist to DB
      const insertData = {
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim(),
        delivered: false,
        read: false,
      };
      if (replyToId) insertData.reply_to_id = replyToId;

      const { data, error } = await supabase
        .from("messages")
        .insert(insertData)
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
      conversationState.state.messageStatusById.set(data.id, "sent");
      conversationState.emit();
      this.pendingMessages.delete(tempId);

      // Update conversation last_message_at
      supabase
        .from("conversations")
        .update({ last_message_at: data.created_at })
        .eq("id", conversationId)
        .then();

      // Broadcast real ID
      this._sendBroadcast(channel, "message_confirmed", {
        tempId,
        realId: data.id,
        created_at: data.created_at,
      });

      // Trigger push AFTER successful DB insert — never on optimistic
      this._triggerDmPush(conversationId, senderId, content.trim());

      return data;
    } catch (error) {
      console.error("❌ [DM] DB insert failed:", error);
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

  async markDelivered(messageId) {
    try {
      await supabase
        .from("messages")
        .update({ delivered: true })
        .eq("id", messageId)
        .eq("delivered", false);
    } catch (err) {
      console.warn("[DM] markDelivered:", err);
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
      this._sendBroadcast(channel, "message_read", {
        conversation_id: conversationId,
        user_id: userId,
        read_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ [DM] Mark read error:", error);
    }
  }

  // =========================================================================
  // PUSH — [PUSH-1][PUSH-2] actorUserId added, metadata flat
  // =========================================================================
  async _triggerDmPush(conversationId, senderId, content) {
    try {
      const conv = conversationState.getConversation(conversationId);
      if (!conv) return;

      const recipientId =
        conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
      if (!recipientId || recipientId === senderId) return;

      // Resolve sender display name from conversation data
      const senderProfile =
        conv.user1_id === senderId ? conv.user1 : conv.user2;
      const senderName =
        senderProfile?.full_name || senderProfile?.username || "Someone";
      const notifId = `dm_${conversationId}_${Date.now()}`;

      await pushService.sendPushToUser({
        recipientUserId: recipientId,
        actorUserId: senderId, // [PUSH-1] was missing — caused self-notif misfires
        type: "dm",
        title: senderName,
        message: content.slice(0, 200),
        entityId: conversationId,
        metadata: {
          // [PUSH-2] flat — no nested data key
          url: "/messages",
          conversation_id: conversationId,
          notification_id: notifId,
          senderName,
        },
      });
    } catch (err) {
      // Never throw — push failure must not break message sending
      console.warn(
        "[DM] Push trigger failed (non-fatal):",
        err?.message || err,
      );
    }
  }

  // =========================================================================
  // REALTIME
  // =========================================================================

  subscribeToConversation(conversationId, callbacks = {}) {
    const channelKey = `conversation:${conversationId}`;
    if (this.conversationChannels.has(channelKey)) return () => {};

    const channel = supabase
      .channel(channelKey, {
        config: { broadcast: { self: false, ack: false } },
      })
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (this._seenBroadcastIds.has(payload.tempId)) return;
        this._seenBroadcastIds.add(payload.tempId);
        setTimeout(() => this._seenBroadcastIds.delete(payload.tempId), 30_000);

        const message = {
          id: payload.tempId || `temp_${Date.now()}`,
          conversation_id: payload.conversation_id,
          sender_id: payload.sender_id,
          content: payload.content,
          reply_to_id: payload.reply_to_id || null,
          created_at: payload.created_at,
          delivered: false,
          read: false,
        };

        conversationState.addMessage(conversationId, message);

        if (
          !conversationState.isActive(conversationId) &&
          payload.sender_id !== this.userId
        ) {
          conversationState.incrementUnread(conversationId, payload.sender_id);
        }

        if (payload.sender_id !== this.userId && payload.tempId) {
          this._sendBroadcast(channel, "message_delivered", {
            tempId: payload.tempId,
            conversation_id: conversationId,
            recipient_id: this.userId,
          });
        }

        callbacks.onMessage?.(message);
      })
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
      .on("broadcast", { event: "message_delivered" }, ({ payload }) => {
        if (payload.recipient_id === this.userId) return;
        const msgs = conversationState.getMessages(conversationId);
        const msg = msgs.find(
          (m) => m.id === payload.tempId || m._tempId === payload.tempId,
        );
        if (msg?.id && !msg._tempId) {
          this.markDelivered(msg.id);
          conversationState.state.messageStatusById?.set(msg.id, "delivered");
        }
        callbacks.onDelivered?.(payload.tempId);
      })
      .on("broadcast", { event: "message_read" }, ({ payload }) => {
        if (payload.user_id !== this.userId) {
          conversationState.markAllRead(conversationId);
          callbacks.onRead?.(payload.user_id);
        }
      })
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
        console.log(`🔌 [DM] ${channelKey}: ${status}`);
        this.channelReady.set(channelKey, status === "SUBSCRIBED");
      });

    this.conversationChannels.set(channelKey, channel);
    return () => {
      supabase.removeChannel(channel);
      this.conversationChannels.delete(channelKey);
      this.channelReady.delete(channelKey);
    };
  }

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
    this._sendBroadcast(channel, "typing", {
      conversationId,
      userId: this.userId,
      isTyping,
      userName,
    });
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  cleanup() {
    this.conversationChannels.forEach((ch) => supabase.removeChannel(ch));
    this.conversationChannels.clear();
    this.channelReady.clear();
    if (this.listChannel) {
      supabase.removeChannel(this.listChannel);
      this.listChannel = null;
    }
    this.pendingMessages.clear();
    this._seenBroadcastIds.clear();
  }
}

export default new DMMessageService();
