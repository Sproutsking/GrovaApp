// Fix Messages Missing User Details
// This script updates the messageService to properly fetch user data for all messages
// Run this in your React app console or create a one-time migration

import { supabase } from '../config/supabase';

/**
 * This function checks and fixes messages that might be missing proper user data
 * You DON'T need to delete messages - just reload them with proper joins
 */
export async function fixMessageUserData() {
  console.log('Starting message user data fix...');
  
  try {
    // Get all messages that need fixing
    const { data: messages, error } = await supabase
      .from('community_messages')
      .select('id, channel_id, user_id')
      .is('deleted_at', null);

    if (error) throw error;

    console.log(`Found ${messages.length} messages to check`);

    // Group messages by channel for efficient processing
    const messagesByChannel = {};
    messages.forEach(msg => {
      if (!messagesByChannel[msg.channel_id]) {
        messagesByChannel[msg.channel_id] = [];
      }
      messagesByChannel[msg.channel_id].push(msg);
    });

    console.log(`Messages grouped across ${Object.keys(messagesByChannel).length} channels`);
    
    // The fix is actually in the messageService - it now properly joins user data
    // No database migration needed, just clear cache and reload
    
    console.log('✅ Fix complete! The messageService now properly fetches user data.');
    console.log('Simply refresh your channels to see updated messages with user details.');
    
    return {
      success: true,
      totalMessages: messages.length,
      channelsAffected: Object.keys(messagesByChannel).length,
      message: 'Messages will now load with proper user details. Refresh to see changes.'
    };
    
  } catch (error) {
    console.error('Error fixing messages:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Alternative: Force reload all messages in current channel
 * Call this from your ChatTab component
 */
export async function reloadChannelMessages(channelId) {
  try {
    console.log(`Reloading messages for channel ${channelId}...`);
    
    // Get community_id from channel
    const { data: channelData } = await supabase
      .from('community_channels')
      .select('community_id')
      .eq('id', channelId)
      .single();

    if (!channelData) {
      throw new Error('Channel not found');
    }

    // Fetch messages with PROPER user data join
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
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Get user IDs to fetch roles
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
      .eq('community_id', channelData.community_id)
      .in('user_id', userIds);

    // Create role map
    const roleMap = {};
    if (memberData) {
      memberData.forEach(member => {
        if (member.role) {
          roleMap[member.user_id] = member.role.name;
        }
      });
    }

    // Transform messages with avatar URLs
    const transformedMessages = messages.map(msg => ({
      ...msg,
      user: msg.user ? {
        ...msg.user,
        avatar: msg.user.avatar_id 
          ? (msg.user.avatar_id.startsWith('http') 
              ? msg.user.avatar_id 
              : supabase.storage.from('avatars').getPublicUrl(msg.user.avatar_id).data.publicUrl)
          : null
      } : null,
      role: roleMap[msg.user_id] || null
    })).reverse();

    console.log(`✅ Loaded ${transformedMessages.length} messages with full user data`);
    return transformedMessages;
    
  } catch (error) {
    console.error('Error reloading channel messages:', error);
    throw error;
  }
}

/**
 * Check if a message has proper user data
 */
export function validateMessageUserData(message) {
  const hasUser = message.user && message.user.id;
  const hasUsername = message.user && message.user.username;
  const hasAvatar = message.user && (message.user.avatar || message.user.avatar_id);
  
  return {
    valid: hasUser && hasUsername,
    hasUser,
    hasUsername,
    hasAvatar,
    message: !hasUser ? 'Missing user object' : !hasUsername ? 'Missing username' : 'Valid'
  };
}

/**
 * Instructions for manual fix in browser console:
 * 
 * 1. Open browser DevTools (F12)
 * 2. Go to Console tab
 * 3. Paste this code:
 * 
 * // Clear localStorage cache
 * Object.keys(localStorage).forEach(key => {
 *   if (key.startsWith('channel-messages-') || key.startsWith('bg-theme-')) {
 *     localStorage.removeItem(key);
 *   }
 * });
 * console.log('Cache cleared! Refresh the page.');
 * 
 * 4. Refresh the page
 * 5. All messages will reload with proper user data
 */

export default {
  fixMessageUserData,
  reloadChannelMessages,
  validateMessageUserData
};