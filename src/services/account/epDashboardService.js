// src/services/account/epDashboardService.js
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import cacheService from '../shared/cacheService';

class EPDashboardService {
  // Get complete EP dashboard
  async getEPDashboard(userId) {
    try {
      const cacheKey = `ep_dashboard:${userId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('ep_dashboard')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Create dashboard if doesn't exist
        if (error.code === 'PGRST116') {
          return await this.createEPDashboard(userId);
        }
        throw error;
      }

      cacheService.set(cacheKey, data, 30000); // 30 sec cache
      return data;
    } catch (error) {
      throw handleError(error, 'getEPDashboard');
    }
  }

  // Create EP dashboard
  async createEPDashboard(userId) {
    try {
      const { data, error } = await supabase
        .from('ep_dashboard')
        .insert({ user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleError(error, 'createEPDashboard');
    }
  }

  // Get EP by date range
  async getEPByDateRange(userId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('ep_transactions')
        .select('amount, source, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Aggregate by date
      const dailyEP = {};
      data.forEach(transaction => {
        const date = new Date(transaction.created_at).toISOString().split('T')[0];
        if (!dailyEP[date]) {
          dailyEP[date] = { total: 0, likes: 0, comments: 0, shares: 0 };
        }
        dailyEP[date].total += transaction.amount;
        dailyEP[date][transaction.source] = (dailyEP[date][transaction.source] || 0) + transaction.amount;
      });

      return dailyEP;
    } catch (error) {
      throw handleError(error, 'getEPByDateRange');
    }
  }

  // Get EP growth chart data
  async getEPGrowthChart(userId, period = 'daily') {
    try {
      const now = new Date();
      let startDate;
      let groupBy;

      switch (period) {
        case 'daily':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          groupBy = 'day';
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // Last 12 weeks
          groupBy = 'week';
          break;
        case 'monthly':
          startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // Last 12 months
          groupBy = 'month';
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
      }

      const { data, error } = await supabase.rpc('get_ep_growth_chart', {
        p_user_id: userId,
        p_start_date: startDate.toISOString(),
        p_group_by: groupBy
      });

      if (error) throw error;

      return data;
    } catch (error) {
      throw handleError(error, 'getEPGrowthChart');
    }
  }

  // Get EP sources breakdown
  async getEPSourcesBreakdown(userId) {
    try {
      const { data, error } = await supabase.rpc('get_ep_sources_breakdown', {
        p_user_id: userId
      });

      if (error) throw error;

      return {
        likes: data.find(s => s.source === 'like')?.total || 0,
        comments: data.find(s => s.source === 'comment')?.total || 0,
        shares: data.find(s => s.source === 'share')?.total || 0,
        comment_likes: data.find(s => s.source === 'comment_like')?.total || 0
      };
    } catch (error) {
      throw handleError(error, 'getEPSourcesBreakdown');
    }
  }

  // Reset period EP (called by cron job)
  async resetPeriodEP() {
    try {
      const now = new Date();
      
      // Reset daily EP (every 24 hours)
      await supabase
        .from('ep_dashboard')
        .update({ 
          daily_ep: 0,
          last_reset_daily: now.toISOString()
        })
        .lt('last_reset_daily', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

      // Reset weekly EP (every 7 days)
      await supabase
        .from('ep_dashboard')
        .update({ 
          weekly_ep: 0,
          last_reset_weekly: now.toISOString()
        })
        .lt('last_reset_weekly', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Reset monthly EP (every 30 days)
      await supabase
        .from('ep_dashboard')
        .update({ 
          monthly_ep: 0,
          last_reset_monthly: now.toISOString()
        })
        .lt('last_reset_monthly', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Reset annual EP (every 365 days)
      await supabase
        .from('ep_dashboard')
        .update({ 
          annual_ep: 0,
          last_reset_annual: now.toISOString()
        })
        .lt('last_reset_annual', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString());

      return { success: true };
    } catch (error) {
      throw handleError(error, 'resetPeriodEP');
    }
  }

  // Update EP dashboard after earning
  async updateEPDashboard(userId, amount) {
    try {
      const { error } = await supabase.rpc('update_ep_dashboard', {
        p_user_id: userId,
        p_amount: amount
      });

      if (error) throw error;

      cacheService.invalidate(`ep_dashboard:${userId}`);
      return { success: true };
    } catch (error) {
      throw handleError(error, 'updateEPDashboard');
    }
  }
}

export default new EPDashboardService();