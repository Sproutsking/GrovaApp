// ============================================================================
// src/services/explore/exploreService.js - ULTIMATE SEARCH ENGINE
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import mediaUrlService from '../shared/mediaUrlService';
import cacheService from '../shared/cacheService';

class ExploreService {
  
  // ==================== UNIVERSAL ULTIMATE SEARCH ====================
  
  async searchAll(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      
      if (!query || query.trim().length < 2) {
        return {
          stories: [],
          posts: [],
          reels: [],
          users: [],
          tags: [],
          mentions: []
        };
      }

      const searchTerm = query.trim().toLowerCase();
      const cacheKey = `search:all:${searchTerm}:${category || 'all'}`;
      
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Search results from cache');
        return cached;
      }

      console.log('🔍 Ultimate Search for:', searchTerm);

      // Detect search type
      const searchType = this.detectSearchType(searchTerm);
      
      let results = {
        stories: [],
        posts: [],
        reels: [],
        users: [],
        tags: [],
        mentions: [],
        query: searchTerm,
        searchType
      };

      if (searchType === 'hashtag') {
        // Prioritize hashtag search
        const [tags, posts, reels, stories] = await Promise.all([
          this.searchTags(searchTerm, { limit: 15 }),
          this.searchPostsByHashtag(searchTerm, { category, limit: 15 }),
          this.searchReelsByHashtag(searchTerm, { category, limit: 15 }),
          this.searchStoriesByHashtag(searchTerm, { category, limit: 10 })
        ]);
        results = { ...results, tags, posts, reels, stories };
      } 
      else if (searchType === 'mention') {
        // Prioritize user search
        const [users, posts, reels, stories] = await Promise.all([
          this.searchUsersByMention(searchTerm, { limit: 15 }),
          this.searchPostsByMention(searchTerm, { category, limit: 15 }),
          this.searchReelsByMention(searchTerm, { category, limit: 15 }),
          this.searchStoriesByMention(searchTerm, { category, limit: 10 })
        ]);
        results = { ...results, users, posts, reels, stories };
        results.mentions = users; // Duplicate for mentions section
      }
      else {
        // General search across everything
        const [stories, posts, reels, users, tags] = await Promise.all([
          this.searchStories(searchTerm, { category, limit: 12 }),
          this.searchPosts(searchTerm, { category, limit: 12 }),
          this.searchReels(searchTerm, { category, limit: 12 }),
          this.searchUsers(searchTerm, { limit: 12 }),
          this.searchTags(searchTerm, { limit: 10 })
        ]);
        results = { ...results, stories, posts, reels, users, tags };
      }

      results.totalResults = (results.stories?.length || 0) + 
                            (results.posts?.length || 0) + 
                            (results.reels?.length || 0) + 
                            (results.users?.length || 0) +
                            (results.tags?.length || 0);

      // Cache results for 2 minutes
      cacheService.set(cacheKey, results, 120000);
      
      console.log('✅ Ultimate Search complete:', {
        type: searchType,
        stories: results.stories?.length || 0,
        posts: results.posts?.length || 0,
        reels: results.reels?.length || 0,
        users: results.users?.length || 0,
        tags: results.tags?.length || 0,
        total: results.totalResults
      });

      return results;

    } catch (error) {
      console.error('❌ Ultimate Search failed:', error);
      throw handleError(error, 'Search');
    }
  }

  // ==================== DETECT SEARCH TYPE ====================
  
  detectSearchType(query) {
    const trimmed = query.trim();
    if (trimmed.startsWith('#')) return 'hashtag';
    if (trimmed.startsWith('@')) return 'mention';
    return 'general';
  }

  // ==================== SEARCH STORIES ====================
  
  async searchStories(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, '');
      
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

      // Search in title, preview, and full_content
      queryBuilder = queryBuilder.or(
        `title.ilike.%${cleanQuery}%,preview.ilike.%${cleanQuery}%,full_content.ilike.%${cleanQuery}%`
      );

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

  async searchStoriesByHashtag(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const hashtag = query.startsWith('#') ? query : `#${query}`;
      
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
        .is('deleted_at', null)
        .or(
          `preview.ilike.%${hashtag}%,full_content.ilike.%${hashtag}%`
        );

      if (category) queryBuilder = queryBuilder.eq('category', category);

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(story => this.formatStory(story));
    } catch (error) {
      console.error('❌ Story hashtag search failed:', error);
      return [];
    }
  }

  async searchStoriesByMention(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const mention = query.startsWith('@') ? query : `@${query}`;
      const username = mention.replace('@', '');
      
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
        .is('deleted_at', null)
        .or(
          `preview.ilike.%${mention}%,full_content.ilike.%${mention}%,profiles.username.ilike.%${username}%`
        );

      if (category) queryBuilder = queryBuilder.eq('category', category);

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(story => this.formatStory(story));
    } catch (error) {
      console.error('❌ Story mention search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH POSTS ====================
  
  async searchPosts(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, '');
      
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
        .is('deleted_at', null)
        .ilike('content', `%${cleanQuery}%`);

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

  async searchPostsByHashtag(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const hashtag = query.startsWith('#') ? query : `#${query}`;
      
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
        .is('deleted_at', null)
        .ilike('content', `%${hashtag}%`);

      if (category) queryBuilder = queryBuilder.eq('category', category);

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(post => this.formatPost(post));
    } catch (error) {
      console.error('❌ Post hashtag search failed:', error);
      return [];
    }
  }

  async searchPostsByMention(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const mention = query.startsWith('@') ? query : `@${query}`;
      const username = mention.replace('@', '');
      
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
        .is('deleted_at', null)
        .or(
          `content.ilike.%${mention}%,profiles.username.ilike.%${username}%`
        );

      if (category) queryBuilder = queryBuilder.eq('category', category);

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(post => this.formatPost(post));
    } catch (error) {
      console.error('❌ Post mention search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH REELS ====================
  
  async searchReels(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, '');
      
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
        .is('deleted_at', null)
        .or(
          `caption.ilike.%${cleanQuery}%,music.ilike.%${cleanQuery}%`
        );

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

  async searchReelsByHashtag(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const hashtag = query.startsWith('#') ? query : `#${query}`;
      
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
        .is('deleted_at', null)
        .ilike('caption', `%${hashtag}%`);

      if (category) queryBuilder = queryBuilder.eq('category', category);

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(reel => this.formatReel(reel));
    } catch (error) {
      console.error('❌ Reel hashtag search failed:', error);
      return [];
    }
  }

  async searchReelsByMention(query, filters = {}) {
    try {
      const { category, limit = 20 } = filters;
      const mention = query.startsWith('@') ? query : `@${query}`;
      const username = mention.replace('@', '');
      
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
        .is('deleted_at', null)
        .or(
          `caption.ilike.%${mention}%,profiles.username.ilike.%${username}%`
        );

      if (category) queryBuilder = queryBuilder.eq('category', category);

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(reel => this.formatReel(reel));
    } catch (error) {
      console.error('❌ Reel mention search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH USERS ====================
  
  async searchUsers(query, filters = {}) {
    try {
      const { limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, '').trim();
      
      if (cleanQuery.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_id, verified, bio')
        .is('deleted_at', null)
        .or(
          `full_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%,bio.ilike.%${cleanQuery}%`
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

  async searchUsersByMention(query, filters = {}) {
    try {
      const { limit = 20 } = filters;
      const username = query.replace('@', '').trim();
      
      if (username.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_id, verified, bio')
        .is('deleted_at', null)
        .ilike('username', `%${username}%`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map(user => ({
        id: user.id,
        name: user.full_name,
        username: `@${user.username}`,
        avatar: user.avatar_id 
          ? mediaUrlService.getAvatarUrl(user.avatar_id)
          : user.full_name?.[0] || 'U',
        verified: user.verified || false,
        bio: user.bio,
        type: 'mention'
      }));

    } catch (error) {
      console.error('❌ User mention search failed:', error);
      return [];
    }
  }

  // ==================== SEARCH TAGS ====================
  
  async searchTags(query, filters = {}) {
    try {
      const { limit = 15 } = filters;
      const hashtag = query.startsWith('#') ? query.toLowerCase() : `#${query.toLowerCase()}`;
      
      if (hashtag.length < 3) return [];

      // Search across all content containing this hashtag
      const [postTags, reelTags, storyTags] = await Promise.all([
        this.extractTagsFromPosts(hashtag, limit * 2),
        this.extractTagsFromReels(hashtag, limit * 2),
        this.extractTagsFromStories(hashtag, limit * 2)
      ]);

      // Combine and count occurrences
      const allTags = [...postTags, ...reelTags, ...storyTags];
      const tagCounts = {};
      
      allTags.forEach(tag => {
        const lowerTag = tag.toLowerCase();
        if (lowerTag.includes(hashtag.toLowerCase())) {
          tagCounts[lowerTag] = (tagCounts[lowerTag] || 0) + 1;
        }
      });

      // Convert to array and sort by count
      const results = Object.entries(tagCounts)
        .map(([tag, count]) => ({
          tag,
          count,
          type: 'tag'
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return results;

    } catch (error) {
      console.error('❌ Tag search failed:', error);
      return [];
    }
  }

  // ==================== EXTRACT TAGS FROM CONTENT ====================
  
  async extractTagsFromPosts(query, limit = 20) {
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

  async extractTagsFromReels(query, limit = 20) {
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

  async extractTagsFromStories(query, limit = 20) {
    try {
      const { data } = await supabase
        .from('stories')
        .select('preview, full_content')
        .or(`preview.ilike.%${query}%,full_content.ilike.%${query}%`)
        .is('deleted_at', null)
        .limit(limit);

      const text = data?.map(s => `${s.preview} ${s.full_content}`).join(' ') || '';
      return this.extractHashtags(text);
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