// services/community/communityMessageService.js - FIXED AVATAR ISSUE
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
            verified
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
      // Build complete user object with avatar
      const userObject = {
        id: userId,
        username: currentUser.username || "Unknown",
        full_name: currentUser.full_name || currentUser.fullName || "Unknown User",
        avatar_id: currentUser.avatar_id || null,
        avatar_metadata: currentUser.avatar_metadata || null,
        verified: currentUser.verified || false
      };

      console.log(`🚀 [SEND] Complete user object:`, userObject);

      // Create optimistic message with full user data
      const optimisticMessage = {
        id: tempId,
        tempId,
        _tempId: tempId,
        channel_id: channelId,
        user_id: userId,
        content,
        created_at: new Date().toISOString(),
        user: userObject,  // Full user object included
        reactions: {},
        edited: false,
        _optimistic: true
      };

      // Add to state immediately
      communityState.addMessage(channelId, optimisticMessage);
      this.pendingMessages.set(tempId, optimisticMessage);

      console.log(`✅ [SEND] Optimistic message added with avatar:`, userObject.avatar_id);

      // Broadcast to other users with full user data
      const channel = supabase.channel(`channel:${channelId}`);
      await channel.send({
        type: "broadcast",
        event: "new_message",
        payload: optimisticMessage  // Send complete message with user object
      });
      console.log(`📡 [SEND] Broadcast sent with user data`);

      // Save to database (async) - pass userObject for fallback
      this.saveToDatabase(channelId, userId, content, tempId, userObject);

      return optimisticMessage;
    } catch (error) {
      console.error("❌ Error sending message:", error);
      this.pendingMessages.delete(tempId);
      communityState.removeMessage(channelId, tempId);
      throw error;
    }
  }

  async saveToDatabase(channelId, userId, content, tempId, userObject) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content.trim()
        })
        .select(`
          *,
          user:user_id(
            id,
            username,
            full_name,
            avatar_id,
            avatar_metadata,
            verified
          )
        `)
        .single();

      if (error) {
        console.error("❌ [DB] Insert failed:", error);
        this.pendingMessages.delete(tempId);
        communityState.removeMessage(channelId, tempId);
        throw error;
      }

      console.log(`✅ [DB] Saved, replacing temp ${tempId} with ${data.id}`);
      
      // Use DB user data if available, otherwise fallback to userObject
      const realMessage = {
        ...data,
        user: data.user || userObject
      };

      console.log(`✅ [DB] Real message user data:`, realMessage.user);

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
      console.log(`⚠️ Already subscribed to ${channelKey}`);
      return this.channelSubscriptions.get(channelKey).unsubscribe;
    }

    console.log(`🔌 [SUBSCRIBE] Joining channel: ${channelKey}`);

    const channel = supabase
      .channel(channelKey)
      .on("broadcast", { event: "new_message" }, (payload) => {
        console.log("📨 [BROADCAST] Received:", payload.payload);
        
        // Skip own optimistic messages
        if (this.pendingMessages.has(payload.payload.tempId) || 
            this.pendingMessages.has(payload.payload._tempId)) {
          console.log("⏭️ Skipping own optimistic message");
          return;
        }

        // Ensure user data is present in broadcast
        if (payload.payload.user) {
          console.log("✅ [BROADCAST] User data present:", payload.payload.user.avatar_id);
          communityState.addMessage(channelId, payload.payload);
          callback(payload.payload);
        } else {
          console.warn("⚠️ [BROADCAST] Missing user data, fetching...");
          // Fetch user data if missing
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
        console.log("📨 [DB INSERT] Received:", payload.new.id);
        
        // Fetch full message with user data
        const { data } = await supabase
          .from("community_messages")
          .select(`
            *,
            user:user_id(
              id,
              username,
              full_name,
              avatar_id,
              avatar_metadata,
              verified
            )
          `)
          .eq("id", payload.new.id)
          .single();

        if (data) {
          console.log("✅ [DB INSERT] User data loaded:", data.user?.avatar_id);
          communityState.addMessage(channelId, data);
          callback(data);
        }
      })
      .subscribe((status) => {
        console.log(`🔌 Channel ${channelKey} status:`, status);
      });

    const unsubscribe = () => {
      console.log(`🔌 [UNSUBSCRIBE] Leaving ${channelKey}`);
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

  async deleteMessage(messageId, userId, communityId) {
    try {
      const { error } = await supabase
        .from("community_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  async addReaction(messageId, userId, emoji) {
    try {
      const { data: msg } = await supabase
        .from("community_messages")
        .select("reactions")
        .eq("id", messageId)
        .single();

      const reactions = msg?.reactions || {};
      
      if (!reactions[emoji]) {
        reactions[emoji] = { count: 0, users: [] };
      }

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

        if (reactions[emoji].count === 0) {
          delete reactions[emoji];
        }
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

          if (typingTimeouts.has(userId)) {
            clearTimeout(typingTimeouts.get(userId));
          }

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