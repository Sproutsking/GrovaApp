// src/services/home/engagementService.js
import supabase from '../config/supabase';
import { handleError } from '../shared/errorHandler';

const EP_RATES = {
  LIKE: 1,
  COMMENT: 2,
  SHARE: 10,
  COMMENT_LIKE: 0.5,
  COMMENT_REPLY: 1
};

const PLATFORM_FEES = {
  PRO_USER: 0.08,  // 8%
  FREE_USER: 0.18  // 18%
};

const COMMENT_REVENUE_SPLIT = 0.40; // 40% to commenter

class EngagementService {

  // Like a post/reel/story
  async likeContent(contentType, contentId, userId) {
    try {
      const table = `${contentType}_likes`;
      
      // Check if already liked
      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq(`${contentType}_id`, contentId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Unlike
        await supabase
          .from(table)
          .delete()
          .eq('id', existing.id);

        // Decrement count
        await this.updateEngagementCount(contentType, contentId, 'likes', -1);

        return { liked: false, success: true };
      } else {
        // Like
        await supabase
          .from(table)
          .insert({
            [`${contentType}_id`]: contentId,
            user_id: userId,
            created_at: new Date().toISOString()
          });

        // Increment count
        await this.updateEngagementCount(contentType, contentId, 'likes', 1);

        // Award EP to content owner
        await this.awardEngagementPoints(contentType, contentId, userId, 'like');

        return { liked: true, success: true };
      }

    } catch (error) {
      throw handleError(error, 'Failed to like content');
    }
  }

  // Like a comment
  async likeComment(commentId, userId) {
    try {
      // Check if already liked
      const { data: existing } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existing.id);

        // Update comment likes count
        await supabase.rpc('decrement_comment_likes', { comment_id: commentId });

        return { liked: false, success: true };
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: userId,
            created_at: new Date().toISOString()
          });

        // Update comment likes count
        await supabase.rpc('increment_comment_likes', { comment_id: commentId });

        // Award EP (split between commenter and post owner)
        await this.awardCommentLikePoints(commentId, userId);

        return { liked: true, success: true };
      }

    } catch (error) {
      throw handleError(error, 'Failed to like comment');
    }
  }

  // Share content
  async shareContent(contentType, contentId, userId, shareType = 'profile') {
    try {
      // Record share
      await supabase
        .from('shares')
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          share_type: shareType,
          created_at: new Date().toISOString()
        });

      // Increment share count
      await this.updateEngagementCount(contentType, contentId, 'shares', 1);

      // Award EP
      await this.awardEngagementPoints(contentType, contentId, userId, 'share');

      return { success: true };

    } catch (error) {
      throw handleError(error, 'Failed to share content');
    }
  }

  // Update engagement count
  async updateEngagementCount(contentType, contentId, field, increment) {
    try {
      const { data: current } = await supabase
        .from(`${contentType}s`)
        .select(field)
        .eq('id', contentId)
        .single();

      const newValue = Math.max(0, (current?.[field] || 0) + increment);

      await supabase
        .from(`${contentType}s`)
        .update({ [field]: newValue })
        .eq('id', contentId);

    } catch (error) {
      console.error('Failed to update engagement count:', error);
    }
  }

  // Award engagement points
  async awardEngagementPoints(contentType, contentId, engagingUserId, actionType) {
    try {
      // Get content owner
      const { data: content } = await supabase
        .from(`${contentType}s`)
        .select('user_id')
        .eq('id', contentId)
        .single();

      if (!content || content.user_id === engagingUserId) {
        // Don't award EP for own content
        return;
      }

      const ownerId = content.user_id;

      // Calculate EP based on action
      let epAmount = 0;
      switch (actionType) {
        case 'like':
          epAmount = EP_RATES.LIKE;
          break;
        case 'comment':
          epAmount = EP_RATES.COMMENT;
          break;
        case 'share':
          epAmount = EP_RATES.SHARE;
          break;
        default:
          epAmount = 1;
      }

      // Check if user is pro
      const { data: owner } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', ownerId)
        .single();

      const isPro = owner?.is_pro || false;

      // Calculate platform fee
      const platformFee = isPro ? PLATFORM_FEES.PRO_USER : PLATFORM_FEES.FREE_USER;
      const netEP = epAmount * (1 - platformFee);
      const platformEP = epAmount * platformFee;

      // Award EP to content owner
      await this.incrementUserEP(ownerId, netEP);

      // Record platform fee
      await this.recordPlatformRevenue(platformEP, ownerId, actionType);

      // Update EP dashboard
      await this.updateEPDashboard(ownerId, netEP);

      return { success: true, epAwarded: netEP };

    } catch (error) {
      console.error('Failed to award EP:', error);
    }
  }

  // Award EP for comment likes (split revenue)
  async awardCommentLikePoints(commentId, likingUserId) {
    try {
      // Get comment details
      const { data: comment } = await supabase
        .from('comments')
        .select('user_id, post_id, reel_id, story_id')
        .eq('id', commentId)
        .single();

      if (!comment || comment.user_id === likingUserId) return;

      const commenterId = comment.user_id;

      // Get content owner
      let contentOwnerId = null;
      if (comment.post_id) {
        const { data } = await supabase.from('posts').select('user_id').eq('id', comment.post_id).single();
        contentOwnerId = data?.user_id;
      } else if (comment.reel_id) {
        const { data } = await supabase.from('reels').select('user_id').eq('id', comment.reel_id).single();
        contentOwnerId = data?.user_id;
      } else if (comment.story_id) {
        const { data } = await supabase.from('stories').select('user_id').eq('id', comment.story_id).single();
        contentOwnerId = data?.user_id;
      }

      if (!contentOwnerId) return;

      const totalEP = EP_RATES.COMMENT_LIKE;

      // Split: 40% to commenter, 60% to content owner
      const commenterEP = totalEP * COMMENT_REVENUE_SPLIT;
      const ownerEP = totalEP * (1 - COMMENT_REVENUE_SPLIT);

      // Get pro status for both users
      const { data: users } = await supabase
        .from('profiles')
        .select('id, is_pro')
        .in('id', [commenterId, contentOwnerId]);

      const commenterPro = users?.find(u => u.id === commenterId)?.is_pro || false;
      const ownerPro = users?.find(u => u.id === contentOwnerId)?.is_pro || false;

      // Apply platform fees
      const commenterFee = commenterPro ? PLATFORM_FEES.PRO_USER : PLATFORM_FEES.FREE_USER;
      const ownerFee = ownerPro ? PLATFORM_FEES.PRO_USER : PLATFORM_FEES.FREE_USER;

      const commenterNet = commenterEP * (1 - commenterFee);
      const ownerNet = ownerEP * (1 - ownerFee);

      // Award EP
      await this.incrementUserEP(commenterId, commenterNet);
      await this.incrementUserEP(contentOwnerId, ownerNet);

      // Update dashboards
      await this.updateEPDashboard(commenterId, commenterNet);
      await this.updateEPDashboard(contentOwnerId, ownerNet);

      // Record platform fees
      await this.recordPlatformRevenue(commenterEP * commenterFee, commenterId, 'comment_like');
      await this.recordPlatformRevenue(ownerEP * ownerFee, contentOwnerId, 'comment_like');

    } catch (error) {
      console.error('Failed to award comment like EP:', error);
    }
  }

  // Increment user EP
  async incrementUserEP(userId, amount) {
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('engagement_points')
        .eq('user_id', userId)
        .single();

      const newAmount = (wallet?.engagement_points || 0) + amount;

      await supabase
        .from('wallets')
        .update({ engagement_points: newAmount })
        .eq('user_id', userId);

    } catch (error) {
      console.error('Failed to increment EP:', error);
    }
  }

  // Update EP dashboard
  async updateEPDashboard(userId, epAmount) {
    try {
      const { data: dashboard } = await supabase
        .from('ep_dashboard')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!dashboard) {
        // Create dashboard
        await supabase.from('ep_dashboard').insert({
          user_id: userId,
          total_ep_earned: epAmount,
          daily_ep: epAmount,
          weekly_ep: epAmount,
          monthly_ep: epAmount,
          annual_ep: epAmount
        });
      } else {
        // Update dashboard
        await supabase
          .from('ep_dashboard')
          .update({
            total_ep_earned: dashboard.total_ep_earned + epAmount,
            daily_ep: dashboard.daily_ep + epAmount,
            weekly_ep: dashboard.weekly_ep + epAmount,
            monthly_ep: dashboard.monthly_ep + epAmount,
            annual_ep: dashboard.annual_ep + epAmount
          })
          .eq('user_id', userId);
      }

    } catch (error) {
      console.error('Failed to update EP dashboard:', error);
    }
  }

  // Record platform revenue
  async recordPlatformRevenue(amount, userId, source) {
    try {
      await supabase.from('platform_revenue').insert({
        amount,
        user_id: userId,
        source,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to record platform revenue:', error);
    }
  }
}

export default new EngagementService();