// src/services/explore/exploreService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import mediaUrlService from '../shared/mediaUrlService';
import cacheService from '../shared/cacheService';

class ExploreService {
  
  // Get stories for explore page
  async getStories(category = null, limit = 50) {
    try {
      const cacheKey = `explore:stories:${category || 'all'}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formattedStories = (data || []).map(story => this.formatStory(story));

      cacheService.set(cacheKey, formattedStories, 60000); // 1 min cache
      return formattedStories;
    } catch (error) {
      throw handleError(error, 'Failed to fetch stories');
    }
  }

  // Get posts for explore
  async getPosts(category = null, limit = 50) {
    try {
      const cacheKey = `explore:posts:${category || 'all'}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formattedPosts = (data || []).map(post => this.formatPost(post));

      cacheService.set(cacheKey, formattedPosts, 60000);
      return formattedPosts;
    } catch (error) {
      throw handleError(error, 'Failed to fetch posts');
    }
  }

  // Get reels for explore
  async getReels(category = null, limit = 50) {
    try {
      const cacheKey = `explore:reels:${category || 'all'}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('reels')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formattedReels = (data || []).map(reel => this.formatReel(reel));

      cacheService.set(cacheKey, formattedReels, 60000);
      return formattedReels;
    } catch (error) {
      throw handleError(error, 'Failed to fetch reels');
    }
  }

  // Format story
  formatStory(story) {
    return {
      id: story.id,
      type: 'story',
      userId: story.user_id,
      author: story.profiles?.full_name || 'Unknown',
      username: story.profiles?.username || '@unknown',
      avatar: story.profiles?.avatar_id ? mediaUrlService.getImageUrl(story.profiles.avatar_id) : null,
      verified: story.profiles?.verified || false,
      timeAgo: this.getTimeAgo(story.created_at),
      title: story.title,
      preview: story.preview,
      fullContent: story.full_content,
      coverImage: story.cover_image_id ? mediaUrlService.getImageUrl(story.cover_image_id) : null,
      category: story.category,
      unlockCost: story.unlock_cost,
      maxAccesses: story.max_accesses,
      currentAccesses: story.current_accesses,
      unlocked: false,
      likes: story.likes || 0,
      comments: story.comments_count || 0,
      views: story.views || 0,
      createdAt: story.created_at
    };
  }

  // Format post
  formatPost(post) {
    return {
      id: post.id,
      type: 'post',
      userId: post.user_id,
      author: post.profiles?.full_name || 'Unknown',
      username: post.profiles?.username || '@unknown',
      avatar: post.profiles?.avatar_id ? mediaUrlService.getImageUrl(post.profiles.avatar_id) : null,
      verified: post.profiles?.verified || false,
      timeAgo: this.getTimeAgo(post.created_at),
      content: post.content,
      images: post.image_ids?.map(id => mediaUrlService.getImageUrl(id)) || [],
      category: post.category,
      likes: post.likes || 0,
      comments: post.comments_count || 0,
      shares: post.shares || 0,
      views: post.views || 0,
      createdAt: post.created_at
    };
  }

  // Format reel
  formatReel(reel) {
    return {
      id: reel.id,
      type: 'reel',
      userId: reel.user_id,
      author: reel.profiles?.full_name || 'Unknown',
      username: reel.profiles?.username || '@unknown',
      avatar: reel.profiles?.avatar_id ? mediaUrlService.getImageUrl(reel.profiles.avatar_id) : null,
      verified: reel.profiles?.verified || false,
      videoUrl: mediaUrlService.getVideoUrl(reel.video_id),
      thumbnailUrl: reel.thumbnail_id ? mediaUrlService.getImageUrl(reel.thumbnail_id) : null,
      caption: reel.caption,
      music: reel.music || 'Original Audio',
      category: reel.category,
      duration: this.formatDuration(reel.duration),
      likes: reel.likes || 0,
      comments: reel.comments_count || 0,
      shares: reel.shares || 0,
      views: reel.views || 0,
      createdAt: reel.created_at
    };
  }

  // Helper: Get time ago
  getTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  }

  // Helper: Format duration
  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export default new ExploreService();