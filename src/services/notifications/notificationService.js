// ============================================================================
// src/services/notifications/notificationService.js - ENHANCED WITH REAL-TIME
// ============================================================================

import { supabase } from "../config/supabase";
import mediaUrlService from "../shared/mediaUrlService";

class NotificationService {
  constructor() {
    this.cachedNotifications = null;
    this.lastFetch = null;
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Get all notifications for a user with proper data enrichment
   */
  async getNotifications(userId, limit = 50, forceRefresh = false) {
    try {
      // Use cache if available and not forcing refresh
      if (
        !forceRefresh &&
        this.cachedNotifications &&
        this.lastFetch &&
        Date.now() - this.lastFetch < this.cacheTimeout
      ) {
        console.log("📬 Using cached notifications");
        return this.cachedNotifications;
      }

      console.log("📬 Fetching fresh notifications for user:", userId);

      // Get user preferences to filter notifications
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

      const preferences = profile?.preferences || {};
      const notifications = [];

      // 1. Fetch LIKES notifications
      if (preferences.notify_likes !== false) {
        await this.fetchLikeNotifications(userId, notifications);
      }

      // 2. Fetch COMMENTS notifications
      if (preferences.notify_comments !== false) {
        await this.fetchCommentNotifications(userId, notifications);
      }

      // 3. Fetch FOLLOWERS notifications
      if (preferences.notify_followers !== false) {
        await this.fetchFollowerNotifications(userId, notifications);
      }

      // 4. Fetch UNLOCKS notifications
      if (preferences.notify_unlocks !== false) {
        await this.fetchUnlockNotifications(userId, notifications);
      }

      // 5. Fetch SHARES notifications
      if (preferences.notify_shares !== false) {
        await this.fetchShareNotifications(userId, notifications);
      }

      // Sort by date and limit
      const sortedNotifications = notifications
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);

      // Cache the results
      this.cachedNotifications = sortedNotifications;
      this.lastFetch = Date.now();

      console.log(
        "✅ Fetched",
        sortedNotifications.length,
        "notifications for user",
      );

      return sortedNotifications;
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      return [];
    }
  }

  /**
   * Fetch like notifications for posts, reels, and stories
   */
  async fetchLikeNotifications(userId, notifications) {
    try {
      // Post likes
      const { data: postLikes } = await supabase
        .from("post_likes")
        .select(
          `
          id,
          created_at,
          user_id,
          post_id,
          profiles!post_likes_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          ),
          posts!post_likes_post_id_fkey (
            id,
            user_id,
            content,
            image_ids
          )
        `,
        )
        .eq("posts.user_id", userId)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (postLikes) {
        postLikes.forEach((like) => {
          if (like.profiles && like.posts) {
            notifications.push({
              id: `like-post-${like.id}`,
              type: "like",
              contentType: "post",
              actor: {
                id: like.profiles.id,
                name: like.profiles.full_name,
                username: like.profiles.username,
                avatar: like.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(like.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: like.profiles.verified,
              },
              content: {
                id: like.posts.id,
                preview: like.posts.content?.substring(0, 100) || "your post",
              },
              createdAt: like.created_at,
              read: false,
            });
          }
        });
      }

      // Reel likes
      const { data: reelLikes } = await supabase
        .from("reel_likes")
        .select(
          `
          id,
          created_at,
          user_id,
          reel_id,
          profiles!reel_likes_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          ),
          reels!reel_likes_reel_id_fkey (
            id,
            user_id,
            caption
          )
        `,
        )
        .eq("reels.user_id", userId)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (reelLikes) {
        reelLikes.forEach((like) => {
          if (like.profiles && like.reels) {
            notifications.push({
              id: `like-reel-${like.id}`,
              type: "like",
              contentType: "reel",
              actor: {
                id: like.profiles.id,
                name: like.profiles.full_name,
                username: like.profiles.username,
                avatar: like.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(like.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: like.profiles.verified,
              },
              content: {
                id: like.reels.id,
                preview: like.reels.caption?.substring(0, 100) || "your reel",
              },
              createdAt: like.created_at,
              read: false,
            });
          }
        });
      }

      // Story likes
      const { data: storyLikes } = await supabase
        .from("story_likes")
        .select(
          `
          id,
          created_at,
          user_id,
          story_id,
          profiles!story_likes_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          ),
          stories!story_likes_story_id_fkey (
            id,
            user_id,
            title
          )
        `,
        )
        .eq("stories.user_id", userId)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (storyLikes) {
        storyLikes.forEach((like) => {
          if (like.profiles && like.stories) {
            notifications.push({
              id: `like-story-${like.id}`,
              type: "like",
              contentType: "story",
              actor: {
                id: like.profiles.id,
                name: like.profiles.full_name,
                username: like.profiles.username,
                avatar: like.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(like.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: like.profiles.verified,
              },
              content: {
                id: like.stories.id,
                preview: like.stories.title,
              },
              createdAt: like.created_at,
              read: false,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching like notifications:", error);
    }
  }

  /**
   * Fetch comment notifications
   */
  async fetchCommentNotifications(userId, notifications) {
    try {
      // Get all comments
      const { data: comments } = await supabase
        .from("comments")
        .select(
          `
          id,
          created_at,
          user_id,
          text,
          post_id,
          reel_id,
          story_id,
          profiles!comments_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .neq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (comments) {
        // Check ownership in batches for better performance
        const postIds = comments
          .filter((c) => c.post_id)
          .map((c) => c.post_id);
        const reelIds = comments
          .filter((c) => c.reel_id)
          .map((c) => c.reel_id);
        const storyIds = comments
          .filter((c) => c.story_id)
          .map((c) => c.story_id);

        const [posts, reels, stories] = await Promise.all([
          postIds.length > 0
            ? supabase
                .from("posts")
                .select("id, user_id, content")
                .in("id", postIds)
                .eq("user_id", userId)
            : { data: [] },
          reelIds.length > 0
            ? supabase
                .from("reels")
                .select("id, user_id, caption")
                .in("id", reelIds)
                .eq("user_id", userId)
            : { data: [] },
          storyIds.length > 0
            ? supabase
                .from("stories")
                .select("id, user_id, title")
                .in("id", storyIds)
                .eq("user_id", userId)
            : { data: [] },
        ]);

        const ownedPosts = new Map(posts.data?.map((p) => [p.id, p]) || []);
        const ownedReels = new Map(reels.data?.map((r) => [r.id, r]) || []);
        const ownedStories = new Map(stories.data?.map((s) => [s.id, s]) || []);

        comments.forEach((comment) => {
          if (!comment.profiles) return;

          let contentType = null;
          let contentId = null;
          let contentPreview = null;

          if (comment.post_id && ownedPosts.has(comment.post_id)) {
            const post = ownedPosts.get(comment.post_id);
            contentType = "post";
            contentId = post.id;
            contentPreview = comment.text.substring(0, 100);
          } else if (comment.reel_id && ownedReels.has(comment.reel_id)) {
            const reel = ownedReels.get(comment.reel_id);
            contentType = "reel";
            contentId = reel.id;
            contentPreview = comment.text.substring(0, 100);
          } else if (comment.story_id && ownedStories.has(comment.story_id)) {
            const story = ownedStories.get(comment.story_id);
            contentType = "story";
            contentId = story.id;
            contentPreview = comment.text.substring(0, 100);
          }

          if (contentType) {
            notifications.push({
              id: `comment-${comment.id}`,
              type: "comment",
              contentType: contentType,
              actor: {
                id: comment.profiles.id,
                name: comment.profiles.full_name,
                username: comment.profiles.username,
                avatar: comment.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(comment.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: comment.profiles.verified,
              },
              content: {
                id: contentId,
                preview: contentPreview,
              },
              createdAt: comment.created_at,
              read: false,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching comment notifications:", error);
    }
  }

  /**
   * Fetch follower notifications
   */
  async fetchFollowerNotifications(userId, notifications) {
    try {
      const { data: followers } = await supabase
        .from("follows")
        .select(
          `
          id,
          created_at,
          follower_id,
          profiles!follows_follower_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (followers) {
        followers.forEach((follow) => {
          if (follow.profiles) {
            notifications.push({
              id: `follow-${follow.id}`,
              type: "follow",
              contentType: null,
              actor: {
                id: follow.profiles.id,
                name: follow.profiles.full_name,
                username: follow.profiles.username,
                avatar: follow.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(follow.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: follow.profiles.verified,
              },
              content: null,
              createdAt: follow.created_at,
              read: false,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching follower notifications:", error);
    }
  }

  /**
   * Fetch unlock notifications
   */
  async fetchUnlockNotifications(userId, notifications) {
    try {
      const { data: unlocks } = await supabase
        .from("unlocked_stories")
        .select(
          `
          id,
          created_at,
          user_id,
          story_id,
          profiles!unlocked_stories_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          ),
          stories!unlocked_stories_story_id_fkey (
            id,
            user_id,
            title
          )
        `,
        )
        .eq("stories.user_id", userId)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (unlocks) {
        unlocks.forEach((unlock) => {
          if (unlock.profiles && unlock.stories) {
            notifications.push({
              id: `unlock-${unlock.id}`,
              type: "unlock",
              contentType: "story",
              actor: {
                id: unlock.profiles.id,
                name: unlock.profiles.full_name,
                username: unlock.profiles.username,
                avatar: unlock.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(unlock.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: unlock.profiles.verified,
              },
              content: {
                id: unlock.stories.id,
                preview: unlock.stories.title,
              },
              createdAt: unlock.created_at,
              read: false,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching unlock notifications:", error);
    }
  }

  /**
   * Fetch share notifications
   */
  async fetchShareNotifications(userId, notifications) {
    try {
      const { data: shares } = await supabase
        .from("shares")
        .select(
          `
          id,
          created_at,
          user_id,
          content_type,
          content_id,
          profiles!shares_user_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (shares) {
        // Check ownership for shares
        for (const share of shares) {
          if (!share.profiles) continue;

          let isOwner = false;
          let contentPreview = null;

          if (share.content_type === "post") {
            const { data: post } = await supabase
              .from("posts")
              .select("user_id, content")
              .eq("id", share.content_id)
              .single();

            if (post && post.user_id === userId) {
              isOwner = true;
              contentPreview = post.content?.substring(0, 100) || "your post";
            }
          } else if (share.content_type === "reel") {
            const { data: reel } = await supabase
              .from("reels")
              .select("user_id, caption")
              .eq("id", share.content_id)
              .single();

            if (reel && reel.user_id === userId) {
              isOwner = true;
              contentPreview = reel.caption?.substring(0, 100) || "your reel";
            }
          } else if (share.content_type === "story") {
            const { data: story } = await supabase
              .from("stories")
              .select("user_id, title")
              .eq("id", share.content_id)
              .single();

            if (story && story.user_id === userId) {
              isOwner = true;
              contentPreview = story.title;
            }
          }

          if (isOwner) {
            notifications.push({
              id: `share-${share.id}`,
              type: "share",
              contentType: share.content_type,
              actor: {
                id: share.profiles.id,
                name: share.profiles.full_name,
                username: share.profiles.username,
                avatar: share.profiles.avatar_id
                  ? mediaUrlService.getImageUrl(share.profiles.avatar_id, {
                      width: 100,
                      height: 100,
                    })
                  : null,
                verified: share.profiles.verified,
              },
              content: {
                id: share.content_id,
                preview: contentPreview,
              },
              createdAt: share.created_at,
              read: false,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching share notifications:", error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    try {
      const notifications = await this.getNotifications(userId, 100);
      const count = notifications.filter((n) => !n.read).length;
      console.log(`🔔 Unread count for user ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  /**
   * Clear cache to force refresh
   */
  clearCache() {
    this.cachedNotifications = null;
    this.lastFetch = null;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    // Placeholder for future implementation with proper read tracking table
    console.log("Marking notification as read:", notificationId);
    return true;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    // Placeholder for future implementation with proper read tracking table
    console.log("Marking all notifications as read for user:", userId);
    this.clearCache();
    return true;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId) {
    // Placeholder for future implementation
    console.log("Deleting notification:", notificationId);
    this.clearCache();
    return true;
  }
}

const notificationService = new NotificationService();

export default notificationService;