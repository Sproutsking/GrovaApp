// ============================================================================
// src/services/messages/communityMessageService.js - COMMUNITY MESSAGING
// ============================================================================

import { supabase } from "../../config/supabaseClient";

class CommunityMessageService {
  // ========================================================================
  // CHANNEL MANAGEMENT
  // ========================================================================

  async getChannels(communityId, userId) {
    try {
      const { data: membership } = await supabase
        .from("community_members")
        .select("role_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .single();

      if (!membership) {
        throw new Error("Not a member of this community");
      }

      const { data, error } = await supabase
        .from("community_channels")
        .select(
          `
          *,
          category:community_channel_categories(id, name, position)
        `,
        )
        .eq("community_id", communityId)
        .order("position", { ascending: true });

      if (error) throw error;

      const channelsWithUnread = await Promise.all(
        (data || []).map(async (channel) => {
          const { count } = await supabase
            .from("community_messages")
            .select("*", { count: "exact", head: true })
            .eq("channel_id", channel.id)
            .gt("created_at", membership.last_read_at || "1970-01-01");

          const { data: lastMsg } = await supabase
            .from("community_messages")
            .select(
              "content, created_at, author:profiles!community_messages_author_id_fkey(full_name)",
            )
            .eq("channel_id", channel.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...channel,
            unreadCount: count || 0,
            lastMessage: lastMsg,
          };
        }),
      );

      return channelsWithUnread;
    } catch (error) {
      console.error("Error fetching channels:", error);
      throw error;
    }
  }

  async createChannel(communityId, name, description, type = "text") {
    try {
      const { data, error } = await supabase
        .from("community_channels")
        .insert({
          community_id: communityId,
          name,
          description,
          type,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating channel:", error);
      throw error;
    }
  }

  // ========================================================================
  // MESSAGE MANAGEMENT
  // ========================================================================

  async getMessages(channelId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .select(
          `
          *,
          author:profiles!community_messages_author_id_fkey(
            id, 
            full_name, 
            username, 
            avatar_id, 
            verified
          ),
          reactions:community_message_reactions(
            id,
            emoji,
            user_id,
            user:profiles!community_message_reactions_user_id_fkey(full_name, username)
          ),
          attachments:community_message_attachments(*),
          replies:community_messages!parent_message_id(
            id,
            content,
            created_at,
            author:profiles!community_messages_author_id_fkey(full_name, avatar_id)
          )
        `,
        )
        .eq("channel_id", channelId)
        .is("parent_message_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).reverse();
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  async sendMessage(
    channelId,
    authorId,
    content,
    parentMessageId = null,
    attachments = [],
  ) {
    try {
      const optimisticId = `temp_${Date.now()}`;
      const optimisticMessage = {
        id: optimisticId,
        channel_id: channelId,
        author_id: authorId,
        content,
        parent_message_id: parentMessageId,
        created_at: new Date().toISOString(),
        pending: true,
        reactions: [],
        attachments: [],
        replies: [],
      };

      const insertPromise = supabase
        .from("community_messages")
        .insert({
          channel_id: channelId,
          author_id: authorId,
          content,
          parent_message_id: parentMessageId,
        })
        .select(
          `
          *,
          author:profiles!community_messages_author_id_fkey(id, full_name, username, avatar_id, verified)
        `,
        )
        .single()
        .then(async ({ data: message, error: msgError }) => {
          if (msgError) throw msgError;

          if (attachments.length > 0 && message) {
            const attachmentPromises = attachments.map((att) =>
              supabase.from("community_message_attachments").insert({
                message_id: message.id,
                file_url: att.url,
                file_type: att.type,
                file_size: att.size,
              }),
            );
            await Promise.all(attachmentPromises);
          }

          const updateChannelPromise = supabase
            .from("community_channels")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", channelId);

          await updateChannelPromise;

          return message;
        });

      insertPromise.catch((error) => {
        console.error("Background send failed:", error);
      });

      return optimisticMessage;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async editMessage(messageId, newContent) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .update({
          content: newContent,
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  async deleteMessage(messageId) {
    try {
      const { error } = await supabase
        .from("community_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  async pinMessage(messageId, channelId) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .update({ pinned: true, pinned_at: new Date().toISOString() })
        .eq("id", messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error pinning message:", error);
      throw error;
    }
  }

  async unpinMessage(messageId) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .update({ pinned: false, pinned_at: null })
        .eq("id", messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error unpinning message:", error);
      throw error;
    }
  }

  // ========================================================================
  // REACTIONS
  // ========================================================================

  async reactToMessage(messageId, userId, emoji) {
    try {
      const { data: existing } = await supabase
        .from("community_message_reactions")
        .select("*")
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("community_message_reactions")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        return { action: "removed" };
      }

      const { error } = await supabase
        .from("community_message_reactions")
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });

      if (error) throw error;
      return { action: "added" };
    } catch (error) {
      console.error("Error reacting to message:", error);
      throw error;
    }
  }

  // ========================================================================
  // THREADS (REPLIES)
  // ========================================================================

  async getReplies(parentMessageId) {
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .select(
          `
          *,
          author:profiles!community_messages_author_id_fkey(id, full_name, username, avatar_id, verified)
        `,
        )
        .eq("parent_message_id", parentMessageId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching replies:", error);
      throw error;
    }
  }

  // ========================================================================
  // MENTIONS & NOTIFICATIONS
  // ========================================================================

  async getMentions(userId, communityId) {
    try {
      const { data, error } = await supabase
        .from("community_mentions")
        .select(
          `
          *,
          message:community_messages(
            *,
            author:profiles!community_messages_author_id_fkey(full_name, avatar_id),
            channel:community_channels(id, name)
          )
        `,
        )
        .eq("user_id", userId)
        .eq("message.channel.community_id", communityId)
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching mentions:", error);
      throw error;
    }
  }

  async markMentionAsRead(mentionId) {
    try {
      const { error } = await supabase
        .from("community_mentions")
        .update({ read: true })
        .eq("id", mentionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error marking mention as read:", error);
      throw error;
    }
  }

  // ========================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ========================================================================

  subscribeToChannel(channelId, callback) {
    const channel = supabase
      .channel(`community-channel:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data } = await supabase
              .from("community_messages")
              .select(
                `
                *,
                author:profiles!community_messages_author_id_fkey(id, full_name, username, avatar_id, verified),
                reactions:community_message_reactions(*)
              `,
              )
              .eq("id", payload.new.id)
              .single();

            callback({ type: "INSERT", message: data });
          } else if (payload.eventType === "UPDATE") {
            callback({ type: "UPDATE", message: payload.new });
          } else if (payload.eventType === "DELETE") {
            callback({ type: "DELETE", messageId: payload.old.id });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  subscribeToReactions(messageId, callback) {
    const channel = supabase
      .channel(`message-reactions:${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        (payload) => {
          callback(payload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ========================================================================
  // MEMBER PERMISSIONS
  // ========================================================================

  async canUserPostInChannel(userId, channelId) {
    try {
      const { data: channel } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      if (!channel) return false;

      const { data: member } = await supabase
        .from("community_members")
        .select(
          `
          role_id,
          role:community_roles(can_send_messages, can_manage_messages)
        `,
        )
        .eq("community_id", channel.community_id)
        .eq("user_id", userId)
        .single();

      return member?.role?.can_send_messages || false;
    } catch (error) {
      console.error("Error checking permissions:", error);
      return false;
    }
  }

  async canUserManageMessages(userId, channelId) {
    try {
      const { data: channel } = await supabase
        .from("community_channels")
        .select("community_id")
        .eq("id", channelId)
        .single();

      if (!channel) return false;

      const { data: member } = await supabase
        .from("community_members")
        .select(
          `
          role_id,
          role:community_roles(can_manage_messages)
        `,
        )
        .eq("community_id", channel.community_id)
        .eq("user_id", userId)
        .single();

      return member?.role?.can_manage_messages || false;
    } catch (error) {
      console.error("Error checking permissions:", error);
      return false;
    }
  }

  // ========================================================================
  // TYPING INDICATORS
  // ========================================================================

  async setTyping(channelId, userId, isTyping) {
    const channel = supabase.channel(`typing:${channelId}`);

    if (isTyping) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, isTyping: true },
      });
    } else {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, isTyping: false },
      });
    }
  }

  subscribeToTyping(channelId, callback) {
    const channel = supabase
      .channel(`typing:${channelId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        callback(payload.payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export default new CommunityMessageService();
