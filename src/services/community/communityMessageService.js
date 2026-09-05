// services/community/communityMessageService.js - FIXED AVATAR ISSUE + DELETE
import { supabase } from "../config/supabase";
import communityState from "./CommunityStateManager";

class CommunityMessageService {
  constructor() {
    this.channelSubscriptions = new Map();
    this.typingSubscriptions = new Map();
    this.userId = null;
    this.pendingMessages = new Map();
    this.messageIdCounter = 0;
  }

  async init(userId) {
    this.userId = userId;
  }

  async loadMessages(channelId) {
    try {
      console.log(`📥 Loading messages for channel ${channelId}`);
      const { data, error } = await supabase
        .from("community_messages")
        .select(`
          *,
          user:user_id(
            id,
            username,
            full_name,
            avatar_id,
            avatar_metadata,
            verified,
            subscription_tier,
            boost_selections
          )
        `)
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const messages = (data || []).map(msg => ({
        ...msg,
        user: msg.user || {
          id: msg.user_id,
          username: "Unknown",
          full_name: "Unknown User",
          avatar_id: null,
          avatar_metadata: null,
          verified: false
        }
      }));

      console.log(`✅ Loaded ${messages.length} messages`);
      communityState.initMessages(channelId, messages);
      return messages;
    } catch (error) {
      console.error("❌ Load messages error:", error);
      return [];
    }
  }

  async sendMessage(channelId, userId, content, options = {}) {
    const tempId = `temp_${Date.now()}_${this.messageIdCounter++}`;
    const currentUser = options.user || options.currentUser;

    if (!currentUser) {
      console.error("❌ No user data provided to sendMessage");
      throw new Error("User data is required");
    }

    try {
      const userObject = {
        id: userId,
        username: currentUser.username || "Unknown",
        full_name: currentUser.full_name || currentUser.fullName || "Unknown User",
        avatar_id: currentUser.avatar_id || null,
        avatar_metadata: currentUser.avatar_metadata || null,
        verified: currentUser.verified || false,
        subscription_tier: currentUser.subscription_tier || currentUser.subscriptionTier || null,
        boost_selections: currentUser.boost_selections || currentUser.boostSelections || {}
      };

      const optimisticMessage = {
        id: tempId,
        tempId,
        _tempId: tempId,
        channel_id: channelId,
        user_id: userId,
        content,
        reply_to_id: options.reply_to_id || null,
        created_at: new Date().toISOString(),
        user: userObject,
        reactions: {},
        edited: false,
        _optimistic: true
      };

      communityState.addMessage(channelId, optimisticMessage);
      this.pendingMessages.set(tempId, optimisticMessage);

      const channel = supabase.channel(`channel:${channelId}`);
      await channel.send({
        type: "broadcast",
        event: "new_message",
        payload: optimisticMessage
      });

      return await this.saveToDatabase(channelId, userId, content, tempId, userObject, options.reply_to_id);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      this.pendingMessages.delete(tempId);
      communityState.removeMessage(channelId, tempId);
      throw error;
    }
  }

  async saveToDatabase(channelId, userId, content, tempId, userObject, replyToId = null) {
    try {
      const { data, error } = await supabase.rpc("send_community_message", {
        p_channel_id: channelId,
        p_user_id: userId,
        p_content: content,
        p_reply_to_id: replyToId || null,
      });

      if (error) {
        console.error("❌ [DB] Insert failed:", error);
        this.pendingMessages.delete(tempId);
        communityState.removeMessage(channelId, tempId);
        throw error;
      }

      const realMessage = {
        ...data,
        user: data.user || userObject
      };

      communityState.replaceMessage(channelId, tempId, realMessage);
      this.pendingMessages.delete(tempId);

      return realMessage;
    } catch (error) {
      console.error("❌ Database save error:", error);
      this.pendingMessages.delete(tempId);
      throw error;
    }
  }

  subscribeToChannel(channelId, callbackOrOptions) {
    const callback = typeof callbackOrOptions === 'function'
      ? callbackOrOptions
      : callbackOrOptions?.onMessage || (() => {});
    return this.subscribeToMessages(channelId, callback);
  }

  subscribeToMessages(channelId, callback) {
    const channelKey = `channel:${channelId}`;

    if (this.channelSubscriptions.has(channelKey)) {
      return this.channelSubscriptions.get(channelKey).unsubscribe;
    }

    const channel = supabase
      .channel(channelKey)
      .on("broadcast", { event: "new_message" }, (payload) => {
        if (this.pendingMessages.has(payload.payload.tempId) ||
            this.pendingMessages.has(payload.payload._tempId)) {
          return;
        }
        if (payload.payload.user) {
          communityState.addMessage(channelId, payload.payload);
          callback(payload.payload);
        } else {
          this.fetchUserForMessage(payload.payload).then(enrichedMsg => {
            communityState.addMessage(channelId, enrichedMsg);
            callback(enrichedMsg);
          });
        }
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "community_messages",
        filter: `channel_id=eq.${channelId}`
      }, async (payload) => {
        const { data } = await supabase
          .from("community_messages")
          .select(`
            *,
            user:user_id(
              id, username, full_name, avatar_id, avatar_metadata, verified
            )
          `)
          .eq("id", payload.new.id)
          .single();

        if (data) {
          communityState.addMessage(channelId, data);
          callback(data);
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "community_messages",
        filter: `channel_id=eq.${channelId}`
      }, (payload) => {
        if (payload.new?.deleted_at) {
          communityState.removeMessage(channelId, payload.new.id);
          callback({ ...payload.new, _deleted: true });
        }
      })
      .subscribe();

    const unsubscribe = () => {
      channel.unsubscribe();
      this.channelSubscriptions.delete(channelKey);
    };

    this.channelSubscriptions.set(channelKey, { channel, unsubscribe });
    return unsubscribe;
  }

  async fetchUserForMessage(message) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_id, avatar_metadata, verified")
        .eq("id", message.user_id)
        .single();

      return {
        ...message,
        user: data || {
          id: message.user_id,
          username: "Unknown",
          full_name: "Unknown User",
          avatar_id: null,
          avatar_metadata: null,
          verified: false
        }
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      return message;
    }
  }

  async editMessage(messageId, userId, newContent) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .update({
          content: newContent.trim(),
          edited: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", messageId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  // ── FIXED: only an actual RPC error means failure. The old code treated
  // a falsy `data` return (void RPC, or a RETURNING clause the client
  // never sees) as failure and threw even when the delete succeeded
  // server-side — that was the entire "can't delete my own messages" bug.
  async deleteMessage(messageId, userId, communityId) {
    if (!messageId || !userId) {
      throw new Error("Message and user are required to delete a message.");
    }
    const { data, error } = await supabase.rpc("delete_community_message", {
      p_message_id: messageId,
    });
    if (error) {
      const rpcMissing = error.code === "PGRST202" || error.code === "42883" || /delete_community_message|function.*does not exist/i.test(error.message || "");
      if (!rpcMissing) throw error;

      // Older deployments may not have migration 032 yet. Keep the UI usable
      // while the soft-delete RPC is being deployed, scoped to the author.
      const { data: fallback, error: fallbackError } = await supabase
        .from("community_messages")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (fallbackError) throw fallbackError;
      if (!fallback) throw new Error("This message was already deleted or you do not have permission to delete it.");
      return true;
    }
    if (data === false) {
      throw new Error("This message was already deleted or you do not have permission to delete it.");
    }
    return true;
  }

  async wipeChannel(channelId) {
    if (!channelId) throw new Error("Channel is required");
    const { error } = await supabase
      .from("community_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .is("deleted_at", null);

    if (error) throw error;
    communityState.initMessages(channelId, []);
    return true;
  }

  async addReaction(messageId, userId, emoji) {
    try {
      const { data: msg } = await supabase
        .from("community_messages")
        .select("reactions")
        .eq("id", messageId)
        .single();

      const reactions = msg?.reactions || {};
      if (!reactions[emoji]) reactions[emoji] = { count: 0, users: [] };
      if (!reactions[emoji].users.includes(userId)) {
        reactions[emoji].count++;
        reactions[emoji].users.push(userId);
      }

      const { error } = await supabase
        .from("community_messages")
        .update({ reactions })
        .eq("id", messageId);

      if (error) throw error;
      return reactions;
    } catch (error) {
      console.error("Error adding reaction:", error);
      throw error;
    }
  }

  async removeReaction(messageId, userId, emoji) {
    try {
      const { data: msg } = await supabase
        .from("community_messages")
        .select("reactions")
        .eq("id", messageId)
        .single();

      const reactions = msg?.reactions || {};
      if (reactions[emoji] && reactions[emoji].users.includes(userId)) {
        reactions[emoji].count--;
        reactions[emoji].users = reactions[emoji].users.filter(id => id !== userId);
        if (reactions[emoji].count === 0) delete reactions[emoji];
      }

      const { error } = await supabase
        .from("community_messages")
        .update({ reactions })
        .eq("id", messageId);

      if (error) throw error;
      return reactions;
    } catch (error) {
      console.error("Error removing reaction:", error);
      throw error;
    }
  }

  subscribeToTyping(channelId, callback) {
    const typingKey = `typing:${channelId}`;
    if (this.typingSubscriptions.has(typingKey)) {
      return this.typingSubscriptions.get(typingKey).unsubscribe;
    }

    const typingUsers = new Map();
    const typingTimeouts = new Map();

    const channel = supabase
      .channel(typingKey)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, userName, typing } = payload.payload;
        if (userId === this.userId) return;

        if (typing) {
          typingUsers.set(userId, { userId, userName });
          if (typingTimeouts.has(userId)) clearTimeout(typingTimeouts.get(userId));
          const timeout = setTimeout(() => {
            typingUsers.delete(userId);
            const current = Array.from(typingUsers.values());
            communityState.setTyping(channelId, current);
            callback(current);
          }, 3000);
          typingTimeouts.set(userId, timeout);
        } else {
          typingUsers.delete(userId);
          if (typingTimeouts.has(userId)) {
            clearTimeout(typingTimeouts.get(userId));
            typingTimeouts.delete(userId);
          }
        }

        const current = Array.from(typingUsers.values());
        communityState.setTyping(channelId, current);
        callback(current);
      })
      .subscribe();

    const unsubscribe = () => {
      channel.unsubscribe();
      typingTimeouts.forEach(timeout => clearTimeout(timeout));
      typingTimeouts.clear();
      typingUsers.clear();
      this.typingSubscriptions.delete(typingKey);
    };

    this.typingSubscriptions.set(typingKey, { channel, unsubscribe });
    return unsubscribe;
  }

  async sendTyping(channelId, isTyping, userName) {
    try {
      const channel = supabase.channel(`typing:${channelId}`);
      await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: this.userId,
          userName: userName || "Unknown",
          typing: isTyping
        }
      });
    } catch (error) {
      console.error("Error sending typing indicator:", error);
    }
  }

  cleanup() {
    this.channelSubscriptions.forEach(({ channel }) => channel.unsubscribe());
    this.channelSubscriptions.clear();
    this.typingSubscriptions.forEach(({ channel }) => channel.unsubscribe());
    this.typingSubscriptions.clear();
    this.pendingMessages.clear();
  }
}

export default new CommunityMessageService();