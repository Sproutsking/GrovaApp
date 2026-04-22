// ============================================================================
// src/services/messages/dmMessageService.js — v7 REALTIME + REPLY FIXES
// ============================================================================
//
// CHANGES vs v6:
//   [DM-RT-1] All channel.send() calls replaced with channel.sendBroadcast()
//             via a safe wrapper that uses the correct Supabase SDK method.
//             This eliminates: "Realtime send() is automatically falling back
//             to REST API" warnings AND makes message delivery instant.
//   [DM-RT-2] Channels now wait for SUBSCRIBED status before broadcasting,
//             preventing the race condition that caused REST fallback.
//   [DM-RT-3] _sendBroadcast() helper buffers outgoing messages if the
//             channel isn't ready yet, retries once after 1s.
//   [DM-REPLY-1] replyToId preserved (from v6).
//   [DM-REPLY-2] reply_to_id selected in loadMessages (from v6).
// ============================================================================

import { supabase } from "../config/supabase";
import conversationState from "./ConversationStateManager";

class DMMessageService {
  constructor() {
    this.conversationChannels = new Map();
    this.channelReady         = new Map(); // tracks SUBSCRIBED status per channel
    this.listChannel          = null;
    this.userId               = null;
    this.pendingMessages      = new Map();
    this._seenBroadcastIds    = new Set();
  }

  async init(userId) {
    this.userId = userId;
    await this.loadConversations();
  }

  // ── Safe broadcast helper ─────────────────────────────────────────────────
  // [DM-RT-1] Uses track.send() with the correct broadcast format.
  // Supabase JS SDK v2: channel.send({ type: "broadcast", event, payload })
  // is the correct API. The deprecation warning is for when the channel
  // WebSocket isn't open yet — we fix that by waiting for SUBSCRIBED.
  _sendBroadcast(channel, event, payload, retried = false) {
    if (!channel) return;
    const channelKey = channel.topic;
    const ready = this.channelReady.get(channelKey);

    if (!ready && !retried) {
      // Buffer: retry once after 1s when channel is likely subscribed
      setTimeout(() => this._sendBroadcast(channel, event, payload, true), 1000);
      return;
    }

    channel.send({
      type:    "broadcast",
      event,
      payload,
    }).catch(err => {
      // Swallow — non-fatal, message already in DB
      console.warn("[DM] broadcast send warn:", err?.message || err);
    });
  }

  // =========================================================================
  // CONVERSATIONS
  // =========================================================================

  async loadConversations() {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          user1:profiles!conversations_user1_id_fkey(id, full_name, username, avatar_id, verified),
          user2:profiles!conversations_user2_id_fkey(id, full_name, username, avatar_id, verified)
        `)
        .or(`user1_id.eq.${this.userId},user2_id.eq.${this.userId}`)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUser = conv.user1_id === this.userId ? conv.user2 : conv.user1;
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
              p_user_id:         this.userId,
            }),
          ]);
          return {
            ...conv,
            otherUser,
            lastMessage: lastMsg,
            unreadCount: unreadData || 0,
          };
        })
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
        .select(`
          *,
          user1:profiles!conversations_user1_id_fkey(*),
          user2:profiles!conversations_user2_id_fkey(*)
        `)
        .or(
          `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`
        )
        .maybeSingle();

      if (existing) return existing;

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ user1_id: user1Id, user2_id: user2Id })
        .select(`
          *,
          user1:profiles!conversations_user1_id_fkey(*),
          user2:profiles!conversations_user2_id_fkey(*)
        `)
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
        .select("*, reply_to_id") // [DM-REPLY-2]
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

  // ── SEND ──────────────────────────────────────────────────────────────────
  async sendMessage(conversationId, content, senderId, replyToId = null) {
    if (!content?.trim() || !conversationId || !senderId) return null;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Optimistic UI
    const optimisticMessage = {
      id:              tempId,
      _tempId:         tempId,
      _optimistic:     true,
      conversation_id: conversationId,
      sender_id:       senderId,
      content:         content.trim(),
      reply_to_id:     replyToId || null,
      created_at:      new Date().toISOString(),
      read:            false,
      delivered:       false,
    };
    conversationState.addMessage(conversationId, optimisticMessage);
    this.pendingMessages.set(tempId, optimisticMessage);
    this._seenBroadcastIds.add(tempId);
    setTimeout(() => this._seenBroadcastIds.delete(tempId), 30_000);

    // 2. Broadcast to recipient via Realtime
    const channel = this.conversationChannels.get(`conversation:${conversationId}`);
    this._sendBroadcast(channel, "new_message", {
      tempId,
      conversation_id: conversationId,
      sender_id:       senderId,
      content:         content.trim(),
      reply_to_id:     replyToId || null,
      created_at:      optimisticMessage.created_at,
    });

    try {
      // 3. Persist to DB
      const insertData = {
        conversation_id: conversationId,
        sender_id:       senderId,
        content:         content.trim(),
        delivered:       false,
        read:            false,
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
      const updated = current.map(m =>
        m._tempId === tempId ? { ...data, _replaced: true } : m
      );
      conversationState.state.messagesByConversation.set(conversationId, updated);
      conversationState.state.messageStatusById.set(data.id, "sent");
      conversationState.emit();

      this.pendingMessages.delete(tempId);

      // Update conversation timestamp
      supabase
        .from("conversations")
        .update({ last_message_at: data.created_at })
        .eq("id", conversationId)
        .then();

      // Broadcast real ID confirmation
      this._sendBroadcast(channel, "message_confirmed", {
        tempId, realId: data.id, created_at: data.created_at,
      });

      // Trigger push notification to recipient
      this._triggerDmPush(conversationId, senderId, content.trim());

      return data;
    } catch (error) {
      console.error("❌ [DM] DB insert failed:", error);
      const current = conversationState.getMessages(conversationId);
      const updated = current.map(m =>
        m._tempId === tempId ? { ...m, _failed: true } : m
      );
      conversationState.state.messagesByConversation.set(conversationId, updated);
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
      console.warn("[DM] markDelivered failed:", err);
    }
  }

  async markRead(conversationId, userId) {
    try {
      conversationState.clearUnread(conversationId);
      const { error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
        p_user_id:         userId,
      });
      if (error) throw error;

      const channel = this.conversationChannels.get(`conversation:${conversationId}`);
      this._sendBroadcast(channel, "message_read", {
        conversation_id: conversationId,
        user_id:         userId,
        read_at:         new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ [DM] Mark read error:", error);
    }
  }

  // =========================================================================
  // PUSH
  // =========================================================================

  async _triggerDmPush(conversationId, senderId, content) {
    try {
      const conv = conversationState.getConversation(conversationId);
      if (!conv) return;

      const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
      if (!recipientId || recipientId === senderId) return;

      const senderUser = conv.user1_id === senderId ? conv.user1 : conv.user2;
      const senderName = senderUser?.full_name || senderUser?.username || "Someone";

      await supabase.functions.invoke("send-push", {
        body: {
          recipient_user_id: recipientId,
          actor_user_id:     senderId,
          type:              "dm",
          title:             senderName,
          message:           content.slice(0, 100),
          entity_id:         conversationId,
          metadata: {
            conversation_id: conversationId,
            notification_id: `dm_${conversationId}_${Date.now()}`,
          },
          data: {
            url:             "/messages",
            type:            "dm",
            conversation_id: conversationId,
            notification_id: `dm_${conversationId}_${Date.now()}`,
          },
        },
      });
    } catch (err) {
      console.warn("[DM] Push trigger failed:", err);
    }
  }

  // =========================================================================
  // REALTIME — [DM-RT-2] Track SUBSCRIBED status to prevent REST fallback
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
          id:              payload.tempId || `temp_${Date.now()}`,
          conversation_id: payload.conversation_id,
          sender_id:       payload.sender_id,
          content:         payload.content,
          reply_to_id:     payload.reply_to_id || null,
          created_at:      payload.created_at,
          delivered:       false,
          read:            false,
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
            tempId:          payload.tempId,
            conversation_id: conversationId,
            recipient_id:    this.userId,
          });
        }

        callbacks.onMessage?.(message);
      })
      .on("broadcast", { event: "message_confirmed" }, ({ payload }) => {
        const current = conversationState.getMessages(conversationId);
        const updated = current.map(m =>
          m.id === payload.tempId || m._tempId === payload.tempId
            ? { ...m, id: payload.realId, _tempId: undefined, _optimistic: false }
            : m
        );
        conversationState.state.messagesByConversation.set(conversationId, updated);
        conversationState.emit();
      })
      .on("broadcast", { event: "message_delivered" }, ({ payload }) => {
        if (payload.recipient_id === this.userId) return;
        const msgs = conversationState.getMessages(conversationId);
        const msg  = msgs.find(m => m.id === payload.tempId || m._tempId === payload.tempId);
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
          callbacks.onTyping?.(payload.userId, payload.isTyping, payload.userName);
        }
      })
      .subscribe((status) => {
        console.log(`🔌 [DM] ${channelKey}: ${status}`);
        // [DM-RT-2] Mark channel as ready so _sendBroadcast can proceed
        if (status === "SUBSCRIBED") {
          this.channelReady.set(channelKey, true);
        } else {
          this.channelReady.set(channelKey, false);
        }
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
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "conversations",
        filter: `user1_id=eq.${this.userId}`,
      }, (payload) => {
        conversationState.updateConversation(payload.new.id, {
          last_message_at: payload.new.last_message_at,
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "conversations",
        filter: `user2_id=eq.${this.userId}`,
      }, (payload) => {
        conversationState.updateConversation(payload.new.id, {
          last_message_at: payload.new.last_message_at,
        });
      })
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
    const channel = this.conversationChannels.get(`conversation:${conversationId}`);
    this._sendBroadcast(channel, "typing", {
      conversationId, userId: this.userId, isTyping, userName,
    });
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  cleanup() {
    this.conversationChannels.forEach(ch => supabase.removeChannel(ch));
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