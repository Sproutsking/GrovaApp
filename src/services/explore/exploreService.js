// ============================================================================
// src/services/explore/exploreService.js - COMPLETE ENHANCED
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import mediaUrlService from '../shared/mediaUrlService';
import cacheService from '../shared/cacheService';

class ExploreService {
  
  // ==================== UNIVERSAL SEARCH ====================
  
  async searchAll(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      
      if (!query || query.trim().length < 2) {
        return {
          stories: [],
          posts: [],
          reels: [],
          users: [],
          tags: []
        };
      }

      const searchTerm = query.trim().toLowerCase();
      const cacheKey = `search:all:${searchTerm}:${category || 'all'}`;
      
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Search results from cache');
        return cached;
      }

      console.log('🔍 Searching for:', searchTerm);

      // Search all content types in parallel
      const [stories, posts, reels, users, tags] = await Promise.all([
        this.searchStories(searchTerm, { category, limit: 10 }),
        this.searchPosts(searchTerm, { category, limit: 10 }),
        this.searchReels(searchTerm, { category, limit: 10 }),
        this.searchUsers(searchTerm, { limit: 10 }),
        this.searchTags(searchTerm, { limit: 10 })
      ]);

      const results = {
        stories,
        posts,
        reels,
        users,
        tags,
        query: searchTerm,
        totalResults: stories.length + posts.length + reels.length + users.length
      };

      // Cache results for 2 minutes
      cacheService.set(cacheKey, results, 120000);
      
      console.log('✅ Search complete:', {
        stories: stories.length,
        posts: posts.length,
        reels: reels.length,
        users: users.length,
        tags: tags.length
      });

      return results;

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw handleError(error, 'Search');
    }
  }

  // ==================== SEARCH STORIES ====================
  
  async searchStories(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      
      let queryBuilder = supabase
        .from('stories')
        .select(`
          *,
          profiles!inner (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null);

      // Search in title and preview
      if (query) {
        queryBuilder = queryBuilder.or(
          `title.ilike.%${query}%,preview.ilike.%${query}%`
        );
      }

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(story => this.formatStory(story));

    } catch (error) {
      console.error('❌ Story search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH POSTS ====================
  
  async searchPosts(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      
      let queryBuilder = supabase
        .from('posts')
        .select(`
          *,
          profiles!inner (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null);

      if (query) {
        queryBuilder = queryBuilder.ilike('content', `%${query}%`);
      }

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(post => this.formatPost(post));

    } catch (error) {
      console.error('❌ Post search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH REELS ====================
  
  async searchReels(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      
      let queryBuilder = supabase
        .from('reels')
        .select(`
          *,
          profiles!inner (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null);

      if (query) {
        queryBuilder = queryBuilder.or(
          `caption.ilike.%${query}%,music.ilike.%${query}%`
        );
      }

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(reel => this.formatReel(reel));

    } catch (error) {
      console.error('❌ Reel search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH USERS ====================
  
  async searchUsers(query, filters = {}) {
    try {
      const { limit = 20 } = filters;
      
      if (!query || query.trim().length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_id, verified, bio')
        .is('deleted_at', null)
        .or(
          `full_name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`
        )
        .limit(limit);

      if (error) throw error;

      return (data || []).map(user => ({
        id: user.id,
        name: user.full_name,
        username: user.username,
        avatar: user.avatar_id 
          ? mediaUrlService.getAvatarUrl(user.avatar_id)
          : user.full_name?.[0] || 'U',
        verified: user.verified || false,
        bio: user.bio,
        type: 'user'
      }));

    } catch (error) {
      console.error('❌ User search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH TAGS ====================
  
  async searchTags(query, filters = {}) {
    try {
      const { limit = 10 } = filters;
      
      if (!query || query.trim().length < 2) return [];

      // Search for hashtags in content
      const searchTerm = query.startsWith('#') ? query : `#${query}`;
      
      const [postTags, reelTags, storyTags] = await Promise.all([
        this.extractTagsFromPosts(searchTerm, limit),
        this.extractTagsFromReels(searchTerm, limit),
        this.extractTagsFromStories(searchTerm, limit)
      ]);

      // Combine and deduplicate
      const allTags = [...postTags, ...reelTags, ...storyTags];
      const uniqueTags = Array.from(new Set(allTags));
      
      return uniqueTags.slice(0, limit).map(tag => ({
        tag,
        count: allTags.filter(t => t === tag).length,
        type: 'tag'
      }));

    } catch (error) {
      console.error('❌ Tag search failed:', error);
      return [];
    }
  }

  // ==================== EXTRACT TAGS FROM CONTENT ====================
  
  async extractTagsFromPosts(query, limit = 10) {
    try {
      const { data } = await supabase
        .from('posts')
        .select('content')
        .ilike('content', `%${query}%`)
        .is('deleted_at', null)
        .limit(limit);

      return this.extractHashtags(data?.map(p => p.content).join(' ') || '');
    } catch {
      return [];
    }
  }

  async extractTagsFromReels(query, limit = 10) {
    try {
      const { data } = await supabase
        .from('reels')
        .select('caption')
        .ilike('caption', `%${query}%`)
        .is('deleted_at', null)
        .limit(limit);

      return this.extractHashtags(data?.map(r => r.caption).join(' ') || '');
    } catch {
      return [];
    }
  }

  async extractTagsFromStories(query, limit = 10) {
    try {
      const { data } = await supabase
        .from('stories')
        .select('preview')
        .ilike('preview', `%${query}%`)
        .is('deleted_at', null)
        .limit(limit);

      return this.extractHashtags(data?.map(s => s.preview).join(' ') || '');
    } catch {
      return [];
    }
  }

  extractHashtags(text) {
    if (!text) return [];
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex) || [];
    return Array.from(new Set(matches.map(tag => tag.toLowerCase())));
  }

  // ==================== GET TRENDING CONTENT ====================
  
  async getTrending(contentType = 'all', limit = 20) {
    try {
      const cacheKey = `trending:${contentType}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let results = {};

      if (contentType === 'all' || contentType === 'stories') {
        const stories = await this.getTrendingStories(limit);
        results.stories = stories;
      }

      if (contentType === 'all' || contentType === 'posts') {
        const posts = await this.getTrendingPosts(limit);
        results.posts = posts;
      }

      if (contentType === 'all' || contentType === 'reels') {
        const reels = await this.getTrendingReels(limit);
        results.reels = reels;
      }

      cacheService.set(cacheKey, results, 300000); // 5 min cache
      return results;

    } catch (error) {
      throw handleError(error, 'Get trending content');
    }
  }

  async getTrendingStories(limit = 20) {
    const { data } = await supabase
      .from('stories')
      .select(`
        *,
        profiles!inner (
          id,
          full_name,
          username,
          avatar_id,
          verified
        )
      `)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('views', { ascending: false })
      .limit(limit);

    return (data || []).map(s => this.formatStory(s));
  }

  async getTrendingPosts(limit = 20) {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!inner (
          id,
          full_name,
          username,
          avatar_id,
          verified
        )
      `)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('likes', { ascending: false })
      .limit(limit);

    return (data || []).map(p => this.formatPost(p));
  }

  async getTrendingReels(limit = 20) {
    const { data } = await supabase
      .from('reels')
      .select(`
        *,
        profiles!inner (
          id,
          full_name,
          username,
          avatar_id,
          verified
        )
      `)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('views', { ascending: false })
      .limit(limit);

    return (data || []).map(r => this.formatReel(r));
  }

  // ==================== GET STORIES ====================
  
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
        `)
        .is('deleted_at', null);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formattedStories = (data || []).map(story => this.formatStory(story));

      cacheService.set(cacheKey, formattedStories, 60000);
      return formattedStories;
    } catch (error) {
      throw handleError(error, 'Failed to fetch stories');
    }
  }

  // ==================== FORMAT METHODS ====================
  
  formatStory(story) {
    return {
      id: story.id,
      type: 'story',
      userId: story.user_id,
      author: story.profiles?.full_name || 'Unknown',
      username: story.profiles?.username || '@unknown',
      avatar: story.profiles?.avatar_id 
        ? mediaUrlService.getAvatarUrl(story.profiles.avatar_id)
        : story.profiles?.full_name?.[0] || 'U',
      verified: story.profiles?.verified || false,
      timeAgo: this.getTimeAgo(story.created_at),
      title: story.title,
      preview: story.preview,
      coverImage: story.cover_image_id 
        ? mediaUrlService.getImageUrl(story.cover_image_id)
        : null,
      category: story.category,
      unlockCost: story.unlock_cost || 0,
      maxAccesses: story.max_accesses,
      currentAccesses: story.current_accesses,
      likes: story.likes || 0,
      comments: story.comments_count || 0,
      views: story.views || 0,
      createdAt: story.created_at
    };
  }

  formatPost(post) {
    return {
      id: post.id,
      type: 'post',
      userId: post.user_id,
      author: post.profiles?.full_name || 'Unknown',
      username: post.profiles?.username || '@unknown',
      avatar: post.profiles?.avatar_id 
        ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id)
        : post.profiles?.full_name?.[0] || 'U',
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

  formatReel(reel) {
    return {
      id: reel.id,
      type: 'reel',
      userId: reel.user_id,
      author: reel.profiles?.full_name || 'Unknown',
      username: reel.profiles?.username || '@unknown',
      avatar: reel.profiles?.avatar_id 
        ? mediaUrlService.getAvatarUrl(reel.profiles.avatar_id)
        : reel.profiles?.full_name?.[0] || 'U',
      verified: reel.profiles?.verified || false,
      videoUrl: reel.video_id 
        ? mediaUrlService.getVideoUrl(reel.video_id)
        : null,
      thumbnailUrl: reel.thumbnail_id 
        ? mediaUrlService.getImageUrl(reel.thumbnail_id)
        : null,
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

  // ==================== HELPER METHODS ====================
  
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

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export default new ExploreService();