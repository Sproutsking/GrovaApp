import { supabase } from "../config/supabase";
import MessageModel from "../../models/MessageModel";

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== "string") return null;
  if (avatarId.startsWith("http://") || avatarId.startsWith("https://"))
    return avatarId;
  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarId);
  return data?.publicUrl || null;
}

class MessageService {
  constructor() {
    this.subscriptions = new Map();
    this.optimisticMessages = new Map();
    this.messageCache = new Map();
  }

  /**
   * Fetch messages with complete user data - OPTIMIZED
   */
  async fetchMessages(channelId, options = {}) {
    const { limit = 100 } = options;

    try {
      // Get community_id from channel
      const { data: channelData } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      if (!channelData) throw new Error("Channel not found");

      // Fetch messages with user data in ONE query
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
            avatar_metadata,
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

      // Get user IDs for role lookup
      const userIds = [
        ...new Set(messages.map((m) => m.user_id).filter(Boolean)),
      ];

      // Fetch roles in ONE query
      const { data: memberData } = await supabase
        .from("community_members")
        .select(
          `
          user_id,
          role:role_id(name, color)
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

      // Transform messages with avatar URLs
      const transformedMessages = messages
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

      // Cache messages
      transformedMessages.forEach((msg) => {
        this.messageCache.set(msg.id, msg);
      });

      return MessageModel.fromAPIArray(transformedMessages);
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      return [];
    }
  }

  /**
   * Send message with INSTANT optimistic update
   */
  async sendMessage(channelId, userId, content, currentUser, options = {}) {
    try {
      // Validate
      const validation = MessageModel.validate(content);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { replyToId = null, attachments = [] } = options;

      // Create optimistic message for INSTANT display
      const optimisticMessage = MessageModel.createOptimistic(
        channelId,
        userId,
        content,
        currentUser,
        { replyToId, attachments, role: options.role },
      );

      // Store optimistic message
      this.optimisticMessages.set(optimisticMessage.tempId, optimisticMessage);

      // Return optimistic message immediately
      const optimisticReturn = optimisticMessage.toJSON();

      // Send to backend in background
      this.sendToBackend(channelId, userId, content, optimisticMessage.tempId, {
        replyToId,
        attachments,
      }).catch((error) => {
        console.error("Background send failed:", error);
        // Remove optimistic message on failure
        this.optimisticMessages.delete(optimisticMessage.tempId);
      });

      return optimisticReturn;
    } catch (error) {
      console.error("Error creating optimistic message:", error);
      throw error;
    }
  }

  /**
   * Send to backend (background operation)
   */
  async sendToBackend(channelId, userId, content, tempId, options = {}) {
    try {
      // Get community_id
      const { data: channelData } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      // Insert message
      const { data: messageData, error: insertError } = await supabase
        .from("community_messages")
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content.trim(),
          reply_to_id: options.replyToId || null,
          attachments: options.attachments || [],
        })
        .select(
          `
          *,
          user:user_id(
            id,
            username,
            full_name,
            avatar_id,
            avatar_metadata,
            verified
          )
        `,
        )
        .single();

      if (insertError) throw insertError;

      // Get role
      const { data: memberData } = await supabase
        .from("community_members")
        .select(`role:role_id(name)`)
        .eq("community_id", channelData.community_id)
        .eq("user_id", userId)
        .single();

      // Remove optimistic message
      this.optimisticMessages.delete(tempId);

      // Return real message
      const realMessage = {
        ...messageData,
        user: {
          ...messageData.user,
          avatar: getAvatarUrl(messageData.user.avatar_id),
        },
        role: memberData?.role?.name || null,
        tempId,
      };

      // Cache real message
      this.messageCache.set(realMessage.id, realMessage);

      return realMessage;
    } catch (error) {
      console.error("Backend send error:", error);
      throw error;
    }
  }

  /**
   * Edit message
   */
  async editMessage(messageId, userId, newContent) {
    try {
      const validation = MessageModel.validate(newContent);
      if (!validation.valid) throw new Error(validation.error);

      // Check ownership
      const { data: existing } = await supabase
        .from("community_messages")
        .select("user_id, channel_id")
        .eq("id", messageId)
        .single();

      if (existing.user_id !== userId) {
        throw new Error("Unauthorized");
      }

      // Update
      const { data: messageData, error } = await supabase
        .from("community_messages")
        .update({
          content: newContent.trim(),
          edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .select(
          `
          *,
          user:user_id(
            id,
            username,
            full_name,
            avatar_id,
            avatar_metadata,
            verified
          )
        `,
        )
        .single();

      if (error) throw error;

      // Get community and role
      const { data: channelData } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", existing.channel_id)
        .single();

      const { data: memberData } = await supabase
        .from("community_members")
        .select(`role:role_id(name)`)
        .eq("community_id", channelData.community_id)
        .eq("user_id", userId)
        .single();

      const transformed = {
        ...messageData,
        user: {
          ...messageData.user,
          avatar: getAvatarUrl(messageData.user.avatar_id),
        },
        role: memberData?.role?.name || null,
      };

      // Update cache
      this.messageCache.set(transformed.id, transformed);

      return MessageModel.fromAPI(transformed);
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId, userId, communityId = null) {
    try {
      const { data: message } = await supabase
        .from("community_messages")
        .select("user_id, channel_id")
        .eq("id", messageId)
        .single();

      const isOwner = message.user_id === userId;

      if (!isOwner) {
        let targetCommunityId = communityId;
        if (!targetCommunityId) {
          const { data: channelData } = await supabase
            .from("community_channels")
            .select("community_id")
            .eq("id", message.channel_id)
            .single();
          targetCommunityId = channelData?.community_id;
        }

        if (targetCommunityId) {
          const { data: memberData } = await supabase
            .from("community_members")
            .select(`role:role_id(permissions)`)
            .eq("community_id", targetCommunityId)
            .eq("user_id", userId)
            .single();

          const hasPermission =
            memberData?.role?.permissions?.administrator === true ||
            memberData?.role?.permissions?.manageMessages === true;

          if (!hasPermission) throw new Error("Unauthorized");
        } else {
          throw new Error("Unauthorized");
        }
      }

      const { error } = await supabase
        .from("community_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) throw error;

      // Remove from cache
      this.messageCache.delete(messageId);

      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Reaction management
   */
  async addReaction(messageId, userId, emoji) {
    try {
      const { data: message } = await supabase
        .from("community_messages")
        .select("reactions")
        .eq("id", messageId)
        .single();

      const reactions = message.reactions || {};

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
      const { data: message } = await supabase
        .from("community_messages")
        .select("reactions")
        .eq("id", messageId)
        .single();

      const reactions = message.reactions || {};

      if (reactions[emoji] && reactions[emoji].users.includes(userId)) {
        reactions[emoji].count--;
        reactions[emoji].users = reactions[emoji].users.filter(
          (id) => id !== userId,
        );

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

  /**
   * Subscribe to new messages
   */
  subscribeToMessages(channelId, callback) {
    const subscription = supabase
      .channel(`channel:${channelId}`)
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
            // Skip if this is our optimistic message
            const isOptimistic = Array.from(
              this.optimisticMessages.values(),
            ).some(
              (opt) =>
                opt.userId === payload.new.user_id &&
                opt.content === payload.new.content &&
                Date.now() - new Date(opt.createdAt).getTime() < 5000,
            );

            if (isOptimistic) {
              // Match optimistic with real
              const optimistic = Array.from(
                this.optimisticMessages.values(),
              ).find(
                (opt) =>
                  opt.userId === payload.new.user_id &&
                  opt.content === payload.new.content,
              );

              if (optimistic) {
                this.optimisticMessages.delete(optimistic.tempId);
              }
            }

            // Fetch full message
            const { data: channelData } = await supabase
              .from("community_channels")
              .select("community_id")
              .eq("id", channelId)
              .single();

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
                  avatar_metadata,
                  verified
                )
              `,
              )
              .eq("id", payload.new.id)
              .single();

            if (messageData && channelData) {
              const { data: memberData } = await supabase
                .from("community_members")
                .select(`role:role_id(name)`)
                .eq("community_id", channelData.community_id)
                .eq("user_id", messageData.user_id)
                .single();

              const transformed = {
                ...messageData,
                user: {
                  ...messageData.user,
                  avatar: getAvatarUrl(messageData.user.avatar_id),
                },
                role: memberData?.role?.name || null,
              };

              // Cache message
              this.messageCache.set(transformed.id, transformed);

              callback(MessageModel.fromAPI(transformed));
            }
          } catch (error) {
            console.error("Subscription error:", error);
          }
        },
      )
      .subscribe();

    this.subscriptions.set(channelId, subscription);

    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(channelId);
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.optimisticMessages.clear();
    this.messageCache.clear();
  }
}

export default new MessageService();
