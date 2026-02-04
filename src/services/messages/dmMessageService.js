// services/messages/dmMessageService.js - REALTIME-FIRST PERFECTION
import { supabase } from "../config/supabase";
import conversationState from "./ConversationStateManager";

class DMMessageService {
  constructor() {
    this.conversationChannels = new Map(); // conversation:{id} channels
    this.listChannel = null; // Global list subscription
    this.userId = null;
    this.pendingMessages = new Map(); // Track optimistic messages by tempId
  }

  async init(userId) {
    this.userId = userId;
    await this.loadConversations();
  }

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

          // Get last message and unread count in parallel
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
        })
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
      console.error("❌ Create conversation error:", error);
      throw error;
    }
  }

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

  async sendMessage(conversationId, senderId, content) {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    // 1️⃣ OPTIMISTIC UI INJECTION (INSTANT)
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

    // Add to state INSTANTLY
    conversationState.addMessage(conversationId, optimisticMessage);
    this.pendingMessages.set(tempId, optimisticMessage);

    console.log("🚀 [SEND] Optimistic message added:", tempId);

    // 2️⃣ REALTIME BROADCAST (INSTANT)
    const channel = this.conversationChannels.get(`conversation:${conversationId}`);
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
      console.log("📡 [SEND] Broadcast sent to channel");
    }

    try {
      // 3️⃣ DATABASE PERSISTENCE (ASYNC)
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

      console.log("✅ [SEND] DB insert successful:", data.id);

      // Replace optimistic with real message
      const currentMessages = conversationState.getMessages(conversationId);
      const updated = currentMessages.map((m) =>
        m._tempId === tempId ? { ...data, _replaced: true } : m
      );

      conversationState.state.messagesByConversation.set(conversationId, updated);
      conversationState.state.messageStatusById.set(data.id, "delivered");
      conversationState.emit();

      this.pendingMessages.delete(tempId);

      // Update conversation timestamp
      supabase
        .from("conversations")
        .update({ last_message_at: data.created_at })
        .eq("id", conversationId)
        .then();

      // Broadcast the real message ID
      if (channel) {
        channel.send({
          type: "broadcast",
          event: "message_confirmed",
          payload: {
            tempId,
            realId: data.id,
            created_at: data.created_at,
          },
        });
      }

      return data;
    } catch (error) {
      console.error("❌ [SEND] DB insert failed:", error);
      
      // Mark as failed
      const currentMessages = conversationState.getMessages(conversationId);
      const updated = currentMessages.map((m) =>
        m._tempId === tempId ? { ...m, _failed: true } : m
      );
      conversationState.state.messagesByConversation.set(conversationId, updated);
      conversationState.emit();

      this.pendingMessages.delete(tempId);
      throw error;
    }
  }

  async markRead(conversationId, userId) {
    try {
      // Optimistically clear unread (INSTANT)
      conversationState.clearUnread(conversationId);

      // Update DB (async)
      const { error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
        p_user_id: userId,
      });

      if (error) throw error;

      // Broadcast read receipt
      const channel = this.conversationChannels.get(`conversation:${conversationId}`);
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

      console.log("✅ [READ] Marked conversation as read");
    } catch (error) {
      console.error("❌ [READ] Mark read error:", error);
    }
  }

  // REALTIME CHANNEL MANAGEMENT
  subscribeToConversation(conversationId, callbacks = {}) {
    const channelKey = `conversation:${conversationId}`;
    
    if (this.conversationChannels.has(channelKey)) {
      console.log("⚠️ Already subscribed to", channelKey);
      return () => {};
    }

    console.log("🔌 [SUBSCRIBE] Joining channel:", channelKey);

    const channel = supabase
      .channel(channelKey, {
        config: {
          broadcast: { self: true }, // Important: see own messages for confirmation
        },
      })
      // ✅ NEW MESSAGE BROADCAST (PRIMARY MESSAGE DELIVERY)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        console.log("📨 [RECEIVE] new_message broadcast:", payload);

        // Skip if this is our own optimistic message
        if (payload.sender_id === this.userId && this.pendingMessages.has(payload.tempId)) {
          console.log("⏭️ Skipping own optimistic message");
          return;
        }

        const message = {
          id: payload.tempId || `temp_${Date.now()}`,
          conversation_id: payload.conversation_id,
          sender_id: payload.sender_id,
          content: payload.content,
          created_at: payload.created_at,
          delivered: true,
          read: false,
        };

        // Add to state INSTANTLY
        conversationState.addMessage(conversationId, message);

        // Increment unread if not active
        if (!conversationState.isActive(conversationId) && payload.sender_id !== this.userId) {
          conversationState.incrementUnread(conversationId, payload.sender_id);
        }

        callbacks.onMessage?.(message);
      })
      // ✅ MESSAGE CONFIRMATION (TEMP ID → REAL ID)
      .on("broadcast", { event: "message_confirmed" }, ({ payload }) => {
        console.log("✅ [CONFIRM] Message confirmed:", payload);

        const currentMessages = conversationState.getMessages(conversationId);
        const updated = currentMessages.map((m) =>
          m.id === payload.tempId || m._tempId === payload.tempId
            ? { ...m, id: payload.realId, _tempId: undefined, _optimistic: false }
            : m
        );

        conversationState.state.messagesByConversation.set(conversationId, updated);
        conversationState.emit();
      })
      // ✅ READ RECEIPTS
      .on("broadcast", { event: "message_read" }, ({ payload }) => {
        console.log("👁️ [READ] Read receipt received:", payload);

        if (payload.user_id !== this.userId) {
          conversationState.markAllRead(conversationId);
          callbacks.onRead?.(payload.user_id);
        }
      })
      // ✅ TYPING INDICATORS
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== this.userId) {
          callbacks.onTyping?.(payload.userId, payload.isTyping, payload.userName);
        }
      })
      .subscribe((status) => {
        console.log(`🔌 [SUBSCRIBE] Channel ${channelKey} status:`, status);
      });

    this.conversationChannels.set(channelKey, channel);

    return () => {
      console.log("🔌 [UNSUBSCRIBE] Leaving channel:", channelKey);
      supabase.removeChannel(channel);
      this.conversationChannels.delete(channelKey);
    };
  }

  subscribeToConversationList() {
    if (this.listChannel) {
      console.log("⚠️ Already subscribed to list");
      return () => {};
    }

    console.log("🔌 [LIST] Subscribing to conversation list");

    this.listChannel = supabase
      .channel(`conversation_list:${this.userId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      // Listen to DB changes for reconciliation only
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          console.log("🗄️ [LIST] DB insert detected:", msg.id);

          // Check if this message is for a conversation we care about
          const { data: conv } = await supabase
            .from("conversations")
            .select("id, user1_id, user2_id")
            .eq("id", msg.conversation_id)
            .maybeSingle();

          if (!conv || (conv.user1_id !== this.userId && conv.user2_id !== this.userId)) {
            return;
          }

          // Update conversation list metadata
          conversationState.updateConversation(msg.conversation_id, {
            lastMessage: msg,
            last_message_at: msg.created_at,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        async (payload) => {
          const { message_id, user_id } = payload.new;

          if (user_id === this.userId) {
            // Get conversation for this message
            const { data: message } = await supabase
              .from("messages")
              .select("conversation_id")
              .eq("id", message_id)
              .maybeSingle();

            if (message) {
              // Recalculate unread count from DB
              const { data: unreadCount } = await supabase.rpc("get_conversation_unread_count", {
                p_conversation_id: message.conversation_id,
                p_user_id: this.userId,
              });

              conversationState.updateConversation(message.conversation_id, {
                unreadCount: unreadCount || 0,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (this.listChannel) {
        supabase.removeChannel(this.listChannel);
        this.listChannel = null;
      }
    };
  }

  // TYPING INDICATOR
  sendTyping(conversationId, isTyping, userName) {
    const channel = this.conversationChannels.get(`conversation:${conversationId}`);
    if (channel) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          conversationId,
          userId: this.userId,
          isTyping,
          userName,
        },
      });
    }
  }

  subscribeTyping(conversationId, callback) {
    // Typing is handled by conversation channel subscription
    // This method exists for backward compatibility
    return () => {};
  }

  cleanup() {
    console.log("🧹 Cleaning up all channels");
    
    // Unsubscribe from all conversation channels
    this.conversationChannels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.conversationChannels.clear();

    // Unsubscribe from list channel
    if (this.listChannel) {
      supabase.removeChannel(this.listChannel);
      this.listChannel = null;
    }

    this.pendingMessages.clear();
  }
}

export default new DMMessageService();