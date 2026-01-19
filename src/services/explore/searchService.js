// src/services/explore/searchService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import mediaUrlService from '../shared/mediaUrlService';

class SearchService {
  // Search all content
  async searchContent(query, filters = {}) {
    try {
      const { contentType, category, limit = 20 } = filters;

      if (!contentType || contentType === 'all') {
        // Search across all content types
        const [posts, reels, stories] = await Promise.all([
          this.searchPosts(query, limit),
          this.searchReels(query, limit),
          this.searchStories(query, limit)
        ]);

        return {
          posts: posts.slice(0, 5),
          reels: reels.slice(0, 5),
          stories: stories.slice(0, 10)
        };
      }

      // Search specific content type
      switch (contentType) {
        case 'post':
          return { posts: await this.searchPosts(query, limit, category) };
        case 'reel':
          return { reels: await this.searchReels(query, limit, category) };
        case 'story':
          return { stories: await this.searchStories(query, limit, category) };
        default:
          return {};
      }
    } catch (error) {
      throw handleError(error, 'searchContent');
    }
  }

  // Search posts
  async searchPosts(query, limit = 20, category = null) {
    try {
      let q = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url,
            verified
          )
        `)
        .textSearch('content', query);

      if (category) q = q.eq('category', category);

      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return mediaUrlService.sanitizeBatch(data);
    } catch (error) {
      throw handleError(error, 'searchPosts');
    }
  }

  // Search reels
  async searchReels(query, limit = 20, category = null) {
    try {
      let q = supabase
        .from('reels')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url,
            verified
          )
        `)
        .textSearch('caption', query);

      if (category) q = q.eq('category', category);

      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return mediaUrlService.sanitizeBatch(data);
    } catch (error) {
      throw handleError(error, 'searchReels');
    }
  }

  // Search stories
  async searchStories(query, limit = 20, category = null) {
    try {
      let q = supabase
        .from('stories')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_url,
            verified
          )
        `)
        .or(`title.ilike.%${query}%,preview.ilike.%${query}%`);

      if (category) q = q.eq('category', category);

      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return mediaUrlService.sanitizeBatch(data);
    } catch (error) {
      throw handleError(error, 'searchStories');
    }
  }

  // Search users
  async searchUsers(query, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, verified, bio')
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;

      return mediaUrlService.sanitizeBatch(data);
    } catch (error) {
      throw handleError(error, 'searchUsers');
    }
  }
}

export default new SearchService();