// src/services/account/dashboardService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import mediaUrlService from '../shared/mediaUrlService';
import cacheService from '../shared/cacheService';

class DashboardService {
  
  // Get user dashboard overview
  async getDashboardOverview(userId) {
    try {
      const cacheKey = `dashboard:${userId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      // Fetch all data in parallel
      const [epData, contentStats, walletData, recentActivity] = await Promise.allSettled([
        this.getEPData(userId),
        this.getContentStats(userId),
        this.getWalletData(userId),
        this.getRecentActivity(userId)
      ]);

      const overview = {
        ep: epData.status === 'fulfilled' ? epData.value : null,
        content: contentStats.status === 'fulfilled' ? contentStats.value : null,
        wallet: walletData.status === 'fulfilled' ? walletData.value : null,
        activity: recentActivity.status === 'fulfilled' ? recentActivity.value : []
      };

      cacheService.set(cacheKey, overview, 60000); // Cache for 1 minute
      return overview;

    } catch (error) {
      throw handleError(error, 'Failed to fetch dashboard overview');
    }
  }

  // Get EP data
  async getEPData(userId) {
    try {
      const { data, error } = await supabase
        .from('ep_dashboard')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no EP dashboard exists, create one
        if (error.code === 'PGRST116') {
          const { data: newData } = await supabase
            .from('ep_dashboard')
            .insert({ user_id: userId })
            .select()
            .single();
          return newData;
        }
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Failed to get EP data:', error);
      return {
        total_ep_earned: 0,
        daily_ep: 0,
        weekly_ep: 0,
        monthly_ep: 0,
        annual_ep: 0
      };
    }
  }

  // Get content stats
  async getContentStats(userId) {
    try {
      const [posts, reels, stories] = await Promise.allSettled([
        supabase
          .from('posts')
          .select('likes, comments_count, shares, views', { count: 'exact' })
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('reels')
          .select('likes, comments_count, shares, views', { count: 'exact' })
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('stories')
          .select('likes, comments_count, views', { count: 'exact' })
          .eq('user_id', userId)
          .is('deleted_at', null)
      ]);

      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalViews = 0;

      // Sum posts
      if (posts.status === 'fulfilled' && posts.value.data) {
        posts.value.data.forEach(p => {
          totalLikes += p.likes || 0;
          totalComments += p.comments_count || 0;
          totalShares += p.shares || 0;
          totalViews += p.views || 0;
        });
      }

      // Sum reels
      if (reels.status === 'fulfilled' && reels.value.data) {
        reels.value.data.forEach(r => {
          totalLikes += r.likes || 0;
          totalComments += r.comments_count || 0;
          totalShares += r.shares || 0;
          totalViews += r.views || 0;
        });
      }

      // Sum stories
      if (stories.status === 'fulfilled' && stories.value.data) {
        stories.value.data.forEach(s => {
          totalLikes += s.likes || 0;
          totalComments += s.comments_count || 0;
          totalViews += s.views || 0;
        });
      }

      return {
        totalPosts: posts.status === 'fulfilled' ? posts.value.count || 0 : 0,
        totalReels: reels.status === 'fulfilled' ? reels.value.count || 0 : 0,
        totalStories: stories.status === 'fulfilled' ? stories.value.count || 0 : 0,
        totalLikes,
        totalComments,
        totalShares,
        totalViews
      };

    } catch (error) {
      console.error('Failed to get content stats:', error);
      return {
        totalPosts: 0,
        totalReels: 0,
        totalStories: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0
      };
    }
  }

  // Get wallet data
  async getWalletData(userId) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return {
        grovaTokens: data.grova_tokens || 0,
        engagementPoints: data.engagement_points || 0
      };

    } catch (error) {
      console.error('Failed to get wallet data:', error);
      return {
        grovaTokens: 0,
        engagementPoints: 0
      };
    }
  }

  // Get recent activity
  async getRecentActivity(userId) {
    try {
      // Get recent transactions
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return data.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        createdAt: t.created_at,
        isIncoming: t.to_user_id === userId
      }));

    } catch (error) {
      console.error('Failed to get recent activity:', error);
      return [];
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(userId, period = '30d') {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get content created in period
      const [posts, reels, stories] = await Promise.allSettled([
        supabase
          .from('posts')
          .select('created_at, likes, views')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null),
        supabase
          .from('reels')
          .select('created_at, likes, views')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null),
        supabase
          .from('stories')
          .select('created_at, likes, views')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .is('deleted_at', null)
      ]);

      const allContent = [
        ...(posts.status === 'fulfilled' ? posts.value.data || [] : []),
        ...(reels.status === 'fulfilled' ? reels.value.data || [] : []),
        ...(stories.status === 'fulfilled' ? stories.value.data || [] : [])
      ];

      // Group by date
      const dailyMetrics = {};
      allContent.forEach(content => {
        const date = new Date(content.created_at).toISOString().split('T')[0];
        if (!dailyMetrics[date]) {
          dailyMetrics[date] = { count: 0, likes: 0, views: 0 };
        }
        dailyMetrics[date].count++;
        dailyMetrics[date].likes += content.likes || 0;
        dailyMetrics[date].views += content.views || 0;
      });

      return {
        totalContent: allContent.length,
        dailyMetrics,
        period
      };

    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {
        totalContent: 0,
        dailyMetrics: {},
        period
      };
    }
  }

  // Get top performing content
  async getTopPerformingContent(userId, limit = 5) {
    try {
      const [topPosts, topReels, topStories] = await Promise.allSettled([
        supabase
          .from('posts')
          .select('id, content, images, likes, views, created_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('views', { ascending: false })
          .limit(limit),
        supabase
          .from('reels')
          .select('id, caption, thumbnail_url, likes, views, created_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('views', { ascending: false })
          .limit(limit),
        supabase
          .from('stories')
          .select('id, title, cover_image, likes, views, created_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('views', { ascending: false })
          .limit(limit)
      ]);

      return {
        posts: topPosts.status === 'fulfilled' ? topPosts.value.data || [] : [],
        reels: topReels.status === 'fulfilled' ? topReels.value.data || [] : [],
        stories: topStories.status === 'fulfilled' ? topStories.value.data || [] : []
      };

    } catch (error) {
      console.error('Failed to get top performing content:', error);
      return {
        posts: [],
        reels: [],
        stories: []
      };
    }
  }
}

export default new DashboardService();