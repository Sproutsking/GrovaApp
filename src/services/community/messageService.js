// src/services/community/messageService.js
import { supabase } from '../config/supabase';
import MessageModel from '../../models/MessageModel';

function getAvatarUrl(avatarId) {
  if (!avatarId || typeof avatarId !== 'string') {
    return null;
  }
  if (avatarId.startsWith('http://') || avatarId.startsWith('https://')) {
    return avatarId;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarId);
  return data?.publicUrl || null;
}

class MessageService {
  constructor() {
    this.activeSubscriptions = new Map();
    this.typingTimeouts = new Map();
    this.typingChannel = null;
  }

  /**
   * Fetch messages with proper user profile and community role
   */
  async fetchMessages(channelId, options = {}) {
    try {
      const { 
        limit = 100, // Increased for better UX
        before = null, 
        after = null 
      } = options;

      // First, get the community_id from the channel
      const { data: channelData } = await supabase
        .from('community_channels')
        .select('community_id')
        .eq('id', channelId)
        .single();

      if (!channelData) {
        throw new Error('Channel not found');
      }

      const communityId = channelData.community_id;

      let query = supabase
        .from('community_messages')
        .select(`
          *,
          user:profiles!community_messages_user_id_fkey(
            id, 
            username, 
            full_name, 
            avatar_id, 
            verified
          )
        `)
        .eq('channel_id', channelId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }
      if (after) {
        query = query.gt('created_at', after);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      // Now fetch member roles for all users in these messages
      const userIds = [...new Set(messages.map(m => m.user_id))];
      
      const { data: memberData } = await supabase
        .from('community_members')
        .select(`
          user_id,
          role:community_roles!community_members_role_id_fkey(
            name,
            color,
            position
          )
        `)
        .eq('community_id', communityId)
        .in('user_id', userIds);

      // Create a map of user_id -> role
      const roleMap = {};
      if (memberData) {
        memberData.forEach(member => {
          if (member.role) {
            roleMap[member.user_id] = member.role.name;
          }
        });
      }

      // Transform messages with proper avatar URLs and roles
      const transformedMessages = (messages || []).map(msg => ({
        ...msg,
        user: msg.user ? {
          ...msg.user,
          avatar_id: msg.user.avatar_id,
          avatar: getAvatarUrl(msg.user.avatar_id)
        } : null,
        role: roleMap[msg.user_id] || null
      })).reverse();

      return MessageModel.fromAPIArray(transformedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Send a message with optimistic updates
   */
  async sendMessage(channelId, userId, content, options = {}) {
    try {
      const { 
        replyToId = null, 
        attachments = [] 
      } = options;

      // Validate content
      const validation = MessageModel.validate(content);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get community_id from channel
      const { data: channelData } = await supabase
        .from('community_channels')
        .select('community_id')
        .eq('id', channelId)
        .single();

      if (!channelData) {
        throw new Error('Channel not found');
      }

      // Insert message
      const { data: messageData, error: insertError } = await supabase
        .from('community_messages')
        .insert({
          channel_id: channelId,
          user_id: userId,
          content: content.trim(),
          reply_to_id: replyToId,
          attachments: attachments
        })
        .select(`
          *,
          user:profiles!community_messages_user_id_fkey(
            id, 
            username, 
            full_name, 
            avatar_id, 
            verified
          )
        `)
        .single();

      if (insertError) throw insertError;

      // Get user's role in this community
      const { data: memberData } = await supabase
        .from('community_members')
        .select(`
          role:community_roles!community_members_role_id_fkey(name)
        `)
        .eq('community_id', channelData.community_id)
        .eq('user_id', userId)
        .single();

      // Transform data
      const transformedData = {
        ...messageData,
        user: messageData.user ? {
          ...messageData.user,
          avatar_id: messageData.user.avatar_id,
          avatar: getAvatarUrl(messageData.user.avatar_id)
        } : null,
        role: memberData?.role?.name || null
      };

      return MessageModel.fromAPI(transformedData);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Edit message
   */
  async editMessage(messageId, userId, newContent) {
    try {
      const validation = MessageModel.validate(newContent);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Check ownership
      const { data: existing, error: fetchError } = await supabase
        .from('community_messages')
        .select('user_id, channel_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;
      if (existing.user_id !== userId) {
        throw new Error('Unauthorized: You can only edit your own messages');
      }

      // Get community_id
      const { data: channelData } = await supabase
        .from('community_channels')
        .select('community_id')
        .eq('id', existing.channel_id)
        .single();

      // Update message
      const { data: messageData, error } = await supabase
        .from('community_messages')
        .update({ 
          content: newContent.trim(),
          edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select(`
          *,
          user:profiles!community_messages_user_id_fkey(
            id, 
            username, 
            full_name, 
            avatar_id, 
            verified
          )
        `)
        .single();

      if (error) throw error;

      // Get role
      const { data: memberData } = await supabase
        .from('community_members')
        .select(`
          role:community_roles!community_members_role_id_fkey(name)
        `)
        .eq('community_id', channelData.community_id)
        .eq('user_id', userId)
        .single();

      const transformedData = {
        ...messageData,
        user: messageData.user ? {
          ...messageData.user,
          avatar_id: messageData.user.avatar_id,
          avatar: getAvatarUrl(messageData.user.avatar_id)
        } : null,
        role: memberData?.role?.name || null
      };

      return MessageModel.fromAPI(transformedData);
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId, userId, hasPermission = false) {
    try {
      // Check ownership or permission
      const { data: existing, error: fetchError } = await supabase
        .from('community_messages')
        .select('user_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;
      
      if (existing.user_id !== userId && !hasPermission) {
        throw new Error('Unauthorized: Insufficient permissions to delete this message');
      }

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

  /**
   * Add reaction to message
   */
  async addReaction(messageId, userId, emoji) {
    try {
      const { data: message, error: fetchError } = await supabase
        .from('community_messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const reactions = message.reactions || {};
      
      if (!reactions[emoji]) {
        reactions[emoji] = { count: 0, users: [] };
      }

      if (!reactions[emoji].users.includes(userId)) {
        reactions[emoji].count++;
        reactions[emoji].users.push(userId);
      }

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

  /**
   * Remove reaction from message
   */
  async removeReaction(messageId, userId, emoji) {
    try {
      const { data: message, error: fetchError } = await supabase
        .from('community_messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const reactions = message.reactions || {};

      if (reactions[emoji] && reactions[emoji].users.includes(userId)) {
        reactions[emoji].count--;
        reactions[emoji].users = reactions[emoji].users.filter(id => id !== userId);

        if (reactions[emoji].count === 0) {
          delete reactions[emoji];
        }
      }

      const { error } = await supabase
        .from('community_messages')
        .update({ reactions })
        .eq('id', messageId);

      if (error) throw error;
      return reactions;
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  }

  /**
   * Start typing indicator
   */
  async startTyping(channelId, userId, userName) {
    try {
      if (!this.typingChannel) {
        this.typingChannel = supabase.channel(`typing:${channelId}`);
      }

      await this.typingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, userName, typing: true }
      });
    } catch (error) {
      console.error('Error broadcasting typing:', error);
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(channelId, userId) {
    try {
      if (this.typingChannel) {
        await this.typingChannel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId, typing: false }
        });
      }
    } catch (error) {
      console.error('Error stopping typing:', error);
    }
  }

  /**
   * Subscribe to typing indicators
   */
  subscribeToTyping(channelId, callback) {
    const typingUsers = new Map();
    
    const channel = supabase
      .channel(`typing:${channelId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, userName, typing } = payload.payload;
        
        if (typing) {
          typingUsers.set(userId, userName);
          
          // Clear existing timeout
          if (this.typingTimeouts.has(userId)) {
            clearTimeout(this.typingTimeouts.get(userId));
          }
          
          // Auto-remove after 3 seconds
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
      this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
      this.typingTimeouts.clear();
    };
  }

  /**
   * Subscribe to new messages with proper data structure
   */
  subscribeToMessages(channelId, callback) {
    const channelKey = `channel:${channelId}`;
    
    if (this.activeSubscriptions.has(channelKey)) {
      this.activeSubscriptions.get(channelKey)();
    }

    const subscription = supabase
      .channel(channelKey)
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
            // Get community_id
            const { data: channelData } = await supabase
              .from('community_channels')
              .select('community_id')
              .eq('id', channelId)
              .single();

            // Fetch full message with user data
            const { data: messageData } = await supabase
              .from('community_messages')
              .select(`
                *,
                user:profiles!community_messages_user_id_fkey(
                  id, 
                  username, 
                  full_name, 
                  avatar_id, 
                  verified
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (messageData && channelData) {
              // Get user's role
              const { data: memberData } = await supabase
                .from('community_members')
                .select(`
                  role:community_roles!community_members_role_id_fkey(name)
                `)
                .eq('community_id', channelData.community_id)
                .eq('user_id', messageData.user_id)
                .single();

              const transformedData = {
                ...messageData,
                user: messageData.user ? {
                  ...messageData.user,
                  avatar_id: messageData.user.avatar_id,
                  avatar: getAvatarUrl(messageData.user.avatar_id)
                } : null,
                role: memberData?.role?.name || null
              };

              callback(MessageModel.fromAPI(transformedData));
            }
          } catch (error) {
            console.error('Error in message subscription:', error);
          }
        }
      )
      .subscribe();

    const unsubscribe = () => {
      subscription.unsubscribe();
      this.activeSubscriptions.delete(channelKey);
    };

    this.activeSubscriptions.set(channelKey, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to message updates (edits, deletes, reactions)
   */
  subscribeToMessageUpdates(channelId, callback) {
    const channelKey = `channel-updates:${channelId}`;

    const subscription = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'community_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }

  /**
   * Search messages in channel
   */
  async searchMessages(channelId, query, limit = 50) {
    try {
      // Get community_id
      const { data: channelData } = await supabase
        .from('community_channels')
        .select('community_id')
        .eq('id', channelId)
        .single();

      const { data: messages, error } = await supabase
        .from('community_messages')
        .select(`
          *,
          user:profiles!community_messages_user_id_fkey(
            id, 
            username, 
            full_name, 
            avatar_id, 
            verified
          )
        `)
        .eq('channel_id', channelId)
        .is('deleted_at', null)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Get roles for all users
      const userIds = [...new Set(messages.map(m => m.user_id))];
      
      const { data: memberData } = await supabase
        .from('community_members')
        .select(`
          user_id,
          role:community_roles!community_members_role_id_fkey(name)
        `)
        .eq('community_id', channelData.community_id)
        .in('user_id', userIds);

      const roleMap = {};
      if (memberData) {
        memberData.forEach(member => {
          if (member.role) {
            roleMap[member.user_id] = member.role.name;
          }
        });
      }

      const transformedMessages = (messages || []).map(msg => ({
        ...msg,
        user: msg.user ? {
          ...msg.user,
          avatar_id: msg.user.avatar_id,
          avatar: getAvatarUrl(msg.user.avatar_id)
        } : null,
        role: roleMap[msg.user_id] || null
      }));

      return MessageModel.fromAPIArray(transformedMessages);
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup() {
    this.activeSubscriptions.forEach(unsubscribe => unsubscribe());
    this.activeSubscriptions.clear();
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
    if (this.typingChannel) {
      this.typingChannel.unsubscribe();
      this.typingChannel = null;
    }
  }
}

export default new MessageService();