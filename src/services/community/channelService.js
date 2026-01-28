// src/services/community/channelService.js
import { supabase } from '../config/supabase';

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== 'string') return '/default-avatar.png';
  if (avatarId.startsWith('http://') || avatarId.startsWith('https://')) return avatarId;
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarId);
  return data?.publicUrl || '/default-avatar.png';
}

class ChannelService {
  // Fetch channels for a community
  async fetchChannels(communityId) {
    try {
      const { data, error } = await supabase
        .from('community_channels')
        .select('*')
        .eq('community_id', communityId)
        .is('deleted_at', null)
        .order('position', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw error;
    }
  }

  // Create a new channel
  async createChannel(channelData, communityId) {
    try {
      const { data, error } = await supabase
        .from('community_channels')
        .insert({
          community_id: communityId,
          name: channelData.name,
          icon: channelData.icon || '💬',
          description: channelData.description,
          type: channelData.type || 'text',
          is_private: channelData.isPrivate || false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  }

  // Update channel
  async updateChannel(channelId, updates) {
    try {
      const { data, error } = await supabase
        .from('community_channels')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', channelId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating channel:', error);
      throw error;
    }
  }

  // Delete channel (soft delete)
  async deleteChannel(channelId) {
    try {
      const { error } = await supabase
        .from('community_channels')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', channelId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting channel:', error);
      throw error;
    }
  }

  // Fetch messages for a channel - FIXED QUERY
  async fetchMessages(channelId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('community_messages')
        .select(`
          *,
          user:profiles!community_messages_user_id_fkey(id, username, full_name, avatar_id, verified)
        `)
        .eq('channel_id', channelId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Fetch messages error:', error);
        throw error;
      }

      // Transform avatars and reverse to chronological order
      const messages = (data || []).map(msg => ({
        ...msg,
        user: msg.user ? {
          ...msg.user,
          avatar: getAvatarUrl(msg.user.avatar_id)
        } : null
      })).reverse();

      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Send a message - FIXED
  async sendMessage(channelId, userId, content, attachments = []) {
    try {
      console.log('Sending message:', { channelId, userId, content });

      const { data, error } = await supabase
        .from('community_messages')
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content.trim(),
          attachments: attachments
        })
        .select(`
          *,
          user:profiles!community_messages_user_id_fkey(id, username, full_name, avatar_id, verified)
        `)
        .single();

      if (error) {
        console.error('Send message error:', error);
        throw error;
      }

      // Transform avatar
      return {
        ...data,
        user: data.user ? {
          ...data.user,
          avatar: getAvatarUrl(data.user.avatar_id)
        } : null
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Add reaction to message
  async addReaction(messageId, emoji) {
    try {
      const { data: message, error: fetchError } = await supabase
        .from('community_messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const reactions = message.reactions || {};
      reactions[emoji] = (reactions[emoji] || 0) + 1;

      const { error } = await supabase
        .from('community_messages')
        .update({ reactions })
        .eq('id', messageId);

      if (error) throw error;
      return reactions;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Update message
  async updateMessage(messageId, content) {
    try {
      const { data, error } = await supabase
        .from('community_messages')
        .update({ 
          content: content.trim(), 
          edited: true,
          updated_at: new Date().toISOString() 
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }

  // Delete message (soft delete)
  async deleteMessage(messageId) {
    try {
      const { error } = await supabase
        .from('community_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Subscribe to new messages - FIXED
  subscribeToMessages(channelId, callback) {
    const subscription = supabase
      .channel(`channel:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          try {
            // Fetch full message with user data
            const { data } = await supabase
              .from('community_messages')
              .select(`
                *,
                user:profiles!community_messages_user_id_fkey(id, username, full_name, avatar_id, verified)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              const transformedData = {
                ...data,
                user: data.user ? {
                  ...data.user,
                  avatar: getAvatarUrl(data.user.avatar_id)
                } : null
              };
              callback(transformedData);
            }
          } catch (error) {
            console.error('Error in subscription:', error);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

export default new ChannelService();