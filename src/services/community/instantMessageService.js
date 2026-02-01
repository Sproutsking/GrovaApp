// src/services/community/instantMessageService.js
import { supabase } from "../config/supabase";

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== "string") return null;
  if (avatarId.startsWith("http://") || avatarId.startsWith("https://"))
    return avatarId;
  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarId);
  return data?.publicUrl || null;
}

/**
 * INSTANT MESSAGE SERVICE
 * Zero-latency message delivery with optimistic updates
 */
class InstantMessageService {
  constructor() {
    this.subscriptions = new Map();
    this.typingChannel = null;
    this.typingTimeouts = new Map();
  }

  /**
   * SEND MESSAGE INSTANTLY - Appears in UI immediately, syncs in background
   */
  async sendMessageInstant(channelId, userId, content, currentUser) {
    // 1. CREATE COMPLETE OPTIMISTIC MESSAGE
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      channel_id: channelId,
      user_id: userId,
      content: content.trim(),
      reply_to_id: null,
      attachments: [],
      reactions: {},
      edited: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,

      // COMPLETE USER DATA - This fixes the missing sender info issue
      user: {
        id: userId,
        user_id: userId,
        username: currentUser?.username || "You",
        full_name: currentUser?.full_name || "You",
        avatar_id: currentUser?.avatar_id || null,
        avatar: currentUser?.avatar || getAvatarUrl(currentUser?.avatar_id),
        verified: currentUser?.verified || false,
      },

      role: null, // Will be populated after sync

      // Status flags
      _optimistic: true,
      _syncing: false,
      _error: null,
    };

    // 2. SYNC TO SERVER IN BACKGROUND
    try {
      // Get community_id
      const { data: channelData } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      if (!channelData) throw new Error("Channel not found");

      // Insert message
      const { data: serverMessage, error: insertError } = await supabase
        .from("community_messages")
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content.trim(),
          reply_to_id: null,
          attachments: [],
        })
        .select(
          `
          *,
          user:user_id(
            id,
            username,
            full_name,
            avatar_id,
            verified
          )
        `,
        )
        .single();

      if (insertError) throw insertError;

      // Get user's role
      const { data: memberData } = await supabase
        .from("community_members")
        .select(`role:role_id(name)`)
        .eq("community_id", channelData.community_id)
        .eq("user_id", userId)
        .single();

      // Return synced message with full data
      return {
        ...serverMessage,
        user: {
          ...serverMessage.user,
          avatar: getAvatarUrl(serverMessage.user.avatar_id),
        },
        role: memberData?.role?.name || null,
        tempId: tempId,
        _optimistic: false,
        _syncing: false,
      };
    } catch (error) {
      console.error("Message sync error:", error);
      throw error;
    }
  }

  /**
   * LOAD MESSAGES with complete user data
   */
  async loadMessages(channelId, limit = 100) {
    try {
      // Get community_id
      const { data: channelData } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      if (!channelData) throw new Error("Channel not found");

      // Fetch messages with user data
      const { data: messages, error } = await supabase
        .from("community_messages")
        .select(
          `
          *,
          user:user_id(
            id,
            username,
            full_name,
            avatar_id,
            verified
          )
        `,
        )
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!messages || messages.length === 0) return [];

      // Get all user IDs
      const userIds = [
        ...new Set(messages.map((m) => m.user_id).filter(Boolean)),
      ];

      // Fetch roles
      const { data: memberData } = await supabase
        .from("community_members")
        .select(
          `
          user_id,
          role:role_id(name)
        `,
        )
        .eq("community_id", channelData.community_id)
        .in("user_id", userIds);

      // Create role map
      const roleMap = {};
      if (memberData) {
        memberData.forEach((member) => {
          if (member.role) {
            roleMap[member.user_id] = member.role.name;
          }
        });
      }

      // Transform messages with complete data
      return messages
        .filter((msg) => msg.user)
        .map((msg) => ({
          ...msg,
          user: {
            ...msg.user,
            avatar: getAvatarUrl(msg.user.avatar_id),
          },
          role: roleMap[msg.user_id] || null,
        }))
        .reverse();
    } catch (error) {
      console.error("Error loading messages:", error);
      throw error;
    }
  }

  /**
   * Edit message
   */
  async editMessage(messageId, userId, newContent) {
    const { data, error } = await supabase
      .from("community_messages")
      .update({
        content: newContent.trim(),
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId, userId, communityId) {
    const { error } = await supabase
      .from("community_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);

    if (error) throw error;
    return true;
  }

  /**
   * Subscribe to new messages
   */
  subscribeToMessages(channelId, callback) {
    const channelKey = `channel:${channelId}`;

    if (this.subscriptions.has(channelKey)) {
      this.subscriptions.get(channelKey).unsubscribe();
    }

    const subscription = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          try {
            // Fetch full message with user data
            const { data: messageData } = await supabase
              .from("community_messages")
              .select(
                `
                *,
                user:user_id(
                  id,
                  username,
                  full_name,
                  avatar_id,
                  verified
                )
              `,
              )
              .eq("id", payload.new.id)
              .single();

            if (messageData) {
              // Get community_id for role
              const { data: channelData } = await supabase
                .from("community_channels")
                .select("community_id")
                .eq("id", channelId)
                .single();

              if (channelData) {
                // Get role
                const { data: memberData } = await supabase
                  .from("community_members")
                  .select(`role:role_id(name)`)
                  .eq("community_id", channelData.community_id)
                  .eq("user_id", messageData.user_id)
                  .single();

                const fullMessage = {
                  ...messageData,
                  user: {
                    ...messageData.user,
                    avatar: getAvatarUrl(messageData.user.avatar_id),
                  },
                  role: memberData?.role?.name || null,
                };

                callback(fullMessage);
              }
            }
          } catch (error) {
            console.error("Subscription error:", error);
          }
        },
      )
      .subscribe();

    this.subscriptions.set(channelKey, subscription);

    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(channelKey);
    };
  }

  /**
   * Typing indicators
   */
  async startTyping(channelId, userId, userName) {
    try {
      if (!this.typingChannel) {
        this.typingChannel = supabase.channel(`typing:${channelId}`);
      }
      await this.typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, userName, typing: true },
      });
    } catch (error) {
      console.error("Typing error:", error);
    }
  }

  async stopTyping(channelId, userId) {
    try {
      if (this.typingChannel) {
        await this.typingChannel.send({
          type: "broadcast",
          event: "typing",
          payload: { userId, typing: false },
        });
      }
    } catch (error) {
      console.error("Stop typing error:", error);
    }
  }

  subscribeToTyping(channelId, callback) {
    const typingUsers = new Map();

    const channel = supabase
      .channel(`typing:${channelId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, userName, typing } = payload.payload;

        if (typing) {
          typingUsers.set(userId, userName);

          if (this.typingTimeouts.has(userId)) {
            clearTimeout(this.typingTimeouts.get(userId));
          }

          const timeout = setTimeout(() => {
            typingUsers.delete(userId);
            callback(Array.from(typingUsers.values()));
          }, 3000);

          this.typingTimeouts.set(userId, timeout);
        } else {
          typingUsers.delete(userId);
          if (this.typingTimeouts.has(userId)) {
            clearTimeout(this.typingTimeouts.get(userId));
            this.typingTimeouts.delete(userId);
          }
        }

        callback(Array.from(typingUsers.values()));
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      typingUsers.clear();
      this.typingTimeouts.forEach((timeout) => clearTimeout(timeout));
      this.typingTimeouts.clear();
    };
  }

  cleanup() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.typingTimeouts.clear();
    if (this.typingChannel) {
      this.typingChannel.unsubscribe();
      this.typingChannel = null;
    }
  }
}

export default new InstantMessageService();
