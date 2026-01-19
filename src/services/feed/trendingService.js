// src/services/feed/trendingService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

class TrendingService {

  // Get trending hashtags from posts and reels
  async getTrendingHashtags(limit = 10) {
    try {
      // Get all posts and reels from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [postsResult, reelsResult] = await Promise.allSettled([
        supabase
          .from('posts')
          .select('content')
          .is('deleted_at', null)
          .gte('created_at', sevenDaysAgo.toISOString()),
        supabase
          .from('reels')
          .select('caption')
          .is('deleted_at', null)
          .gte('created_at', sevenDaysAgo.toISOString())
      ]);

      const hashtagCounts = {};

      // Extract hashtags from posts
      if (postsResult.status === 'fulfilled' && postsResult.value.data) {
        postsResult.value.data.forEach(post => {
          if (post.content) {
            const hashtags = this.extractHashtags(post.content);
            hashtags.forEach(tag => {
              hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
            });
          }
        });
      }

      // Extract hashtags from reels
      if (reelsResult.status === 'fulfilled' && reelsResult.value.data) {
        reelsResult.value.data.forEach(reel => {
          if (reel.caption) {
            const hashtags = this.extractHashtags(reel.caption);
            hashtags.forEach(tag => {
              hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
            });
          }
        });
      }

      // Sort by count and return top hashtags
      const trending = Object.entries(hashtagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return trending;

    } catch (error) {
      console.error('Failed to get trending hashtags:', error);
      return [];
    }
  }

  // Get trending searches (most searched categories)
  async getTrendingCategories(limit = 5) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get story categories with most views in last 7 days
      const { data, error } = await supabase
        .from('stories')
        .select('category, views')
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      const categoryCounts = {};

      (data || []).forEach(story => {
        const category = story.category || 'General';
        categoryCounts[category] = (categoryCounts[category] || 0) + (story.views || 0);
      });

      const trending = Object.entries(categoryCounts)
        .map(([category, views]) => ({ category, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);

      return trending;

    } catch (error) {
      console.error('Failed to get trending categories:', error);
      return [];
    }
  }

  // Get trending content (most engaged in last 7 days)
  async getTrendingContent(contentType = 'post', limit = 10) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const contentTable = `${contentType}s`;

      const { data, error } = await supabase
        .from(contentTable)
        .select(`
          *,
          profiles!inner (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('views', { ascending: false })
        .order('likes', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Failed to get trending content:', error);
      return [];
    }
  }

  // Get top creators (most engagement in last 30 days)
  async getTopCreators(limit = 10) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('ep_dashboard')
        .select(`
          user_id,
          monthly_ep,
          profiles!inner (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .order('monthly_ep', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((creator, index) => ({
        rank: index + 1,
        userId: creator.user_id,
        name: creator.profiles?.full_name || 'Unknown',
        username: creator.profiles?.username || '@unknown',
        avatar: creator.profiles?.avatar_id || creator.profiles?.full_name?.[0] || 'U',
        verified: creator.profiles?.verified || false,
        monthlyEP: creator.monthly_ep || 0
      }));

    } catch (error) {
      console.error('Failed to get top creators:', error);
      return [];
    }
  }

  // Search by hashtag
  async searchByHashtag(hashtag, contentType = 'post', limit = 50) {
    try {
      const contentTable = `${contentType}s`;
      const searchTerm = `%#${hashtag.replace('#', '')}%`;

      let query = supabase
        .from(contentTable)
        .select(`
          *,
          profiles!inner (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null);

      if (contentType === 'post') {
        query = query.ilike('content', searchTerm);
      } else if (contentType === 'reel') {
        query = query.ilike('caption', searchTerm);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Failed to search by hashtag:', error);
      return [];
    }
  }

  // Helper: Extract hashtags from text
  extractHashtags(text) {
    if (!text) return [];
    
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = text.match(hashtagRegex) || [];
    
    return matches
      .map(tag => tag.toLowerCase())
      .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
  }

  // Get trending topics (combination of hashtags and categories)
  async getTrendingTopics(limit = 15) {
    try {
      const [hashtags, categories] = await Promise.all([
        this.getTrendingHashtags(10),
        this.getTrendingCategories(5)
      ]);

      const topics = [
        ...hashtags.map(h => ({
          type: 'hashtag',
          label: h.tag,
          count: h.count
        })),
        ...categories.map(c => ({
          type: 'category',
          label: c.category,
          count: c.views
        }))
      ];

      return topics.slice(0, limit);

    } catch (error) {
      console.error('Failed to get trending topics:', error);
      return [];
    }
  }

  // Get personalized recommendations based on user activity
  async getRecommendations(userId, contentType = 'post', limit = 20) {
    try {
      // Get user's liked content categories
      const likeTable = `${contentType}_likes`;
      const contentTable = `${contentType}s`;

      const { data: likedContent, error: likeError } = await supabase
        .from(likeTable)
        .select(`
          ${contentType}_id,
          ${contentTable}:${contentType}_id (
            category
          )
        `)
        .eq('user_id', userId)
        .limit(50);

      if (likeError) throw likeError;

      // Extract preferred categories
      const categoryPreferences = {};
      (likedContent || []).forEach(like => {
        const content = like[contentTable];
        if (content?.category) {
          categoryPreferences[content.category] = 
            (categoryPreferences[content.category] || 0) + 1;
        }
      });

      // Get top preferred category
      const topCategory = Object.entries(categoryPreferences)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      // Fetch content from preferred category
      let query = supabase
        .from(contentTable)
        .select(`
          *,
          profiles!inner (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null)
        .neq('user_id', userId);

      if (topCategory) {
        query = query.eq('category', topCategory);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Failed to get recommendations:', error);
      return [];
    }
  }
}

export default new TrendingService();