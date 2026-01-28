// ============================================================================
// src/services/notifications/notificationService.js - FIXED WITH READ TRACKING
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

class NotificationService {
  
  constructor() {
    this.STORAGE_KEY = 'grova_read_notifications';
  }

  // ==================== GET READ NOTIFICATION IDS FROM STORAGE ====================
  
  getReadNotifications(userId) {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  // ==================== SAVE READ NOTIFICATION IDS TO STORAGE ====================
  
  saveReadNotifications(userId, readIds) {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${userId}`, JSON.stringify(readIds));
    } catch (error) {
      console.error('Failed to save read notifications:', error);
    }
  }

  // ==================== CHECK USER PREFERENCES ====================
  
  async getUserPreferences(userId) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      // DEFAULT TO ALL OFF - USER MUST ENABLE
      return profile?.preferences || {
        notify_likes: false,
        notify_comments: false,
        notify_shares: false,
        notify_unlocks: false,
        notify_followers: false,
        notify_profile_visits: false
      };
    } catch (error) {
      console.error('Failed to get preferences:', error);
      return {
        notify_likes: false,
        notify_comments: false,
        notify_shares: false,
        notify_unlocks: false,
        notify_followers: false,
        notify_profile_visits: false
      };
    }
  }

  // ==================== GET NOTIFICATIONS ====================
  
  async getNotifications(userId, limit = 100) {
    try {
      console.log('📬 Loading notifications for user:', userId);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const notifications = [];
      
      // Get user preferences
      const prefs = await this.getUserPreferences(userId);
      console.log('📋 User notification preferences:', prefs);

      // Get read notification IDs
      const readIds = this.getReadNotifications(userId);

      // === LIKES ON POSTS ===
      if (prefs.notify_likes) {
        const { data: postLikes } = await supabase
          .from('post_likes')
          .select(`
            id,
            created_at,
            user_id,
            post_id,
            profiles:user_id (full_name, username, avatar_id, verified),
            posts:post_id (user_id, content)
          `)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        (postLikes || []).forEach(like => {
          if (like.posts?.user_id === userId && like.user_id !== userId) {
            const notifId = `like-post-${like.id}`;
            notifications.push({
              id: notifId,
              type: 'like',
              contentType: 'post',
              user: {
                id: like.user_id,
                name: like.profiles?.full_name || 'Someone',
                username: like.profiles?.username || 'user',
                avatar: like.profiles?.avatar_id,
                verified: like.profiles?.verified || false
              },
              action: 'liked your post',
              content: like.posts?.content?.substring(0, 50) || 'your post',
              contentId: like.post_id,
              timestamp: new Date(like.created_at).getTime(),
              read: readIds.includes(notifId)
            });
          }
        });
      }

      // === LIKES ON REELS ===
      if (prefs.notify_likes) {
        const { data: reelLikes } = await supabase
          .from('reel_likes')
          .select(`
            id,
            created_at,
            user_id,
            reel_id,
            profiles:user_id (full_name, username, avatar_id, verified),
            reels:reel_id (user_id, caption)
          `)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        (reelLikes || []).forEach(like => {
          if (like.reels?.user_id === userId && like.user_id !== userId) {
            const notifId = `like-reel-${like.id}`;
            notifications.push({
              id: notifId,
              type: 'like',
              contentType: 'reel',
              user: {
                id: like.user_id,
                name: like.profiles?.full_name || 'Someone',
                username: like.profiles?.username || 'user',
                avatar: like.profiles?.avatar_id,
                verified: like.profiles?.verified || false
              },
              action: 'liked your reel',
              content: like.reels?.caption?.substring(0, 50) || 'your reel',
              contentId: like.reel_id,
              timestamp: new Date(like.created_at).getTime(),
              read: readIds.includes(notifId)
            });
          }
        });
      }

      // === LIKES ON STORIES ===
      if (prefs.notify_likes) {
        const { data: storyLikes } = await supabase
          .from('story_likes')
          .select(`
            id,
            created_at,
            user_id,
            story_id,
            profiles:user_id (full_name, username, avatar_id, verified),
            stories:story_id (user_id, title)
          `)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        (storyLikes || []).forEach(like => {
          if (like.stories?.user_id === userId && like.user_id !== userId) {
            const notifId = `like-story-${like.id}`;
            notifications.push({
              id: notifId,
              type: 'like',
              contentType: 'story',
              user: {
                id: like.user_id,
                name: like.profiles?.full_name || 'Someone',
                username: like.profiles?.username || 'user',
                avatar: like.profiles?.avatar_id,
                verified: like.profiles?.verified || false
              },
              action: 'liked your story',
              content: like.stories?.title?.substring(0, 50) || 'your story',
              contentId: like.story_id,
              timestamp: new Date(like.created_at).getTime(),
              read: readIds.includes(notifId)
            });
          }
        });
      }

      // === COMMENTS ===
      if (prefs.notify_comments) {
        const { data: comments } = await supabase
          .from('comments')
          .select(`
            id,
            text,
            created_at,
            user_id,
            post_id,
            reel_id,
            story_id,
            profiles:user_id (full_name, username, avatar_id, verified)
          `)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        for (const comment of comments || []) {
          if (comment.user_id === userId) continue;

          let isOwner = false;
          let contentType = '';
          let contentPreview = '';
          let contentId = null;

          if (comment.post_id) {
            const { data: post } = await supabase
              .from('posts')
              .select('user_id, content')
              .eq('id', comment.post_id)
              .single();
            
            if (post?.user_id === userId) {
              isOwner = true;
              contentType = 'post';
              contentPreview = post.content?.substring(0, 50) || '';
              contentId = comment.post_id;
            }
          } else if (comment.reel_id) {
            const { data: reel } = await supabase
              .from('reels')
              .select('user_id, caption')
              .eq('id', comment.reel_id)
              .single();
            
            if (reel?.user_id === userId) {
              isOwner = true;
              contentType = 'reel';
              contentPreview = reel.caption?.substring(0, 50) || '';
              contentId = comment.reel_id;
            }
          } else if (comment.story_id) {
            const { data: story } = await supabase
              .from('stories')
              .select('user_id, title')
              .eq('id', comment.story_id)
              .single();
            
            if (story?.user_id === userId) {
              isOwner = true;
              contentType = 'story';
              contentPreview = story.title?.substring(0, 50) || '';
              contentId = comment.story_id;
            }
          }

          if (isOwner) {
            const notifId = `comment-${comment.id}`;
            notifications.push({
              id: notifId,
              type: 'comment',
              contentType,
              user: {
                id: comment.user_id,
                name: comment.profiles?.full_name || 'Someone',
                username: comment.profiles?.username || 'user',
                avatar: comment.profiles?.avatar_id,
                verified: comment.profiles?.verified || false
              },
              action: `commented on your ${contentType}`,
              content: `"${comment.text?.substring(0, 50)}..."`,
              contentId,
              timestamp: new Date(comment.created_at).getTime(),
              read: readIds.includes(notifId)
            });
          }
        }
      }

      // === STORY UNLOCKS ===
      if (prefs.notify_unlocks) {
        const { data: unlocks } = await supabase
          .from('unlocked_stories')
          .select(`
            id,
            created_at,
            user_id,
            story_id,
            profiles:user_id (full_name, username, avatar_id, verified),
            stories:story_id (user_id, title, unlock_cost)
          `)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        (unlocks || []).forEach(unlock => {
          if (unlock.stories?.user_id === userId && unlock.user_id !== userId) {
            const notifId = `unlock-${unlock.id}`;
            notifications.push({
              id: notifId,
              type: 'unlock',
              contentType: 'story',
              user: {
                id: unlock.user_id,
                name: unlock.profiles?.full_name || 'Someone',
                username: unlock.profiles?.username || 'user',
                avatar: unlock.profiles?.avatar_id,
                verified: unlock.profiles?.verified || false
              },
              action: 'unlocked your story',
              content: unlock.stories?.title || 'your story',
              contentId: unlock.story_id,
              earned: unlock.stories?.unlock_cost || 0,
              timestamp: new Date(unlock.created_at).getTime(),
              read: readIds.includes(notifId)
            });
          }
        });
      }

      // === SHARES ===
      if (prefs.notify_shares) {
        const { data: shares } = await supabase
          .from('shares')
          .select(`
            id,
            created_at,
            user_id,
            content_type,
            content_id,
            share_type,
            profiles:user_id (full_name, username, avatar_id, verified)
          `)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit);

        for (const share of shares || []) {
          if (share.user_id === userId) continue;

          let isOwner = false;
          let contentPreview = '';

          const tableName = `${share.content_type}s`;
          const { data: content } = await supabase
            .from(tableName)
            .select('user_id, content, caption, title')
            .eq('id', share.content_id)
            .single();

          if (content?.user_id === userId) {
            isOwner = true;
            contentPreview = content.content || content.caption || content.title || '';
          }

          if (isOwner) {
            const notifId = `share-${share.id}`;
            notifications.push({
              id: notifId,
              type: 'share',
              contentType: share.content_type,
              user: {
                id: share.user_id,
                name: share.profiles?.full_name || 'Someone',
                username: share.profiles?.username || 'user',
                avatar: share.profiles?.avatar_id,
                verified: share.profiles?.verified || false
              },
              action: `shared your ${share.content_type}`,
              content: contentPreview.substring(0, 50),
              contentId: share.content_id,
              timestamp: new Date(share.created_at).getTime(),
              read: readIds.includes(notifId)
            });
          }
        }
      }

      // Sort by timestamp (newest first)
      notifications.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`✅ Loaded ${notifications.length} notifications (${notifications.filter(n => !n.read).length} unread)`);
      return notifications;

    } catch (error) {
      console.error('❌ Failed to load notifications:', error);
      throw handleError(error, 'Failed to load notifications');
    }
  }

  // ==================== GET UNREAD COUNT ====================
  
  async getUnreadCount(userId) {
    try {
      const notifications = await this.getNotifications(userId);
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  // ==================== MARK AS READ ====================
  
  async markAsRead(notificationId, userId) {
    try {
      const readIds = this.getReadNotifications(userId);
      if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
        this.saveReadNotifications(userId, readIds);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to mark as read:', error);
      return { success: false };
    }
  }

  // ==================== MARK ALL AS READ ====================
  
  async markAllAsRead(userId) {
    try {
      const notifications = await this.getNotifications(userId);
      const allIds = notifications.map(n => n.id);
      this.saveReadNotifications(userId, allIds);
      return { success: true };
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      return { success: false };
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;