// ============================================================================
// src/models/LikeModel.js - UNIFIED LIKE SYSTEM
// ============================================================================

import { supabase } from '../services/config/supabase';
import { handleError } from '../services/shared/errorHandler';

/**
 * LikeModel - Handles ALL like operations across the platform
 * Supports: posts, reels, stories, comments, replies
 */
class LikeModel {
  
  // ==================== LIKE/UNLIKE CONTENT ====================
  
  /**
   * Toggle like on any content type
   * @param {string} contentType - 'post' | 'reel' | 'story' | 'comment'
   * @param {string} contentId - ID of the content
   * @param {string} userId - ID of the user liking
   * @returns {Promise<{liked: boolean, newCount: number}>}
   */
  async toggleLike(contentType, contentId, userId) {
    try {
      if (!userId) {
        throw new Error('User must be logged in to like');
      }

      const table = this.getLikeTable(contentType);
      const contentField = this.getContentField(contentType);

      // Check if already liked
      const { data: existingLike } = await supabase
        .from(table)
        .select('id')
        .eq(contentField, contentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingLike) {
        // UNLIKE
        await this.unlikeContent(table, existingLike.id, contentType, contentId);
        
        const newCount = await this.getUpdatedLikeCount(contentType, contentId);
        
        return { 
          liked: false, 
          newCount,
          success: true 
        };
      } else {
        // LIKE
        await this.likeContent(table, contentField, contentId, userId, contentType);
        
        const newCount = await this.getUpdatedLikeCount(contentType, contentId);
        
        return { 
          liked: true, 
          newCount,
          success: true 
        };
      }

    } catch (error) {
      throw handleError(error, 'Toggle like failed');
    }
  }

  // ==================== LIKE CONTENT ====================
  
  async likeContent(table, contentField, contentId, userId, contentType) {
    try {
      // Insert like record
      const { error: insertError } = await supabase
        .from(table)
        .insert({
          [contentField]: contentId,
          user_id: userId,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Increment like count
      await this.incrementLikeCount(contentType, contentId);

      console.log(`✅ ${contentType} liked`);

    } catch (error) {
      throw handleError(error, 'Like content failed');
    }
  }

  // ==================== UNLIKE CONTENT ====================
  
  async unlikeContent(table, likeId, contentType, contentId) {
    try {
      // Delete like record
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', likeId);

      if (deleteError) throw deleteError;

      // Decrement like count
      await this.decrementLikeCount(contentType, contentId);

      console.log(`✅ ${contentType} unliked`);

    } catch (error) {
      throw handleError(error, 'Unlike content failed');
    }
  }

  // ==================== INCREMENT LIKE COUNT ====================
  
  async incrementLikeCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      // Get current count
      const { data: current } = await supabase
        .from(table)
        .select('likes')
        .eq('id', contentId)
        .single();

      const newCount = (current?.likes || 0) + 1;

      // Update count
      await supabase
        .from(table)
        .update({ likes: newCount })
        .eq('id', contentId);

    } catch (error) {
      console.error('Failed to increment like count:', error);
    }
  }

  // ==================== DECREMENT LIKE COUNT ====================
  
  async decrementLikeCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      // Get current count
      const { data: current } = await supabase
        .from(table)
        .select('likes')
        .eq('id', contentId)
        .single();

      const newCount = Math.max(0, (current?.likes || 0) - 1);

      // Update count
      await supabase
        .from(table)
        .update({ likes: newCount })
        .eq('id', contentId);

    } catch (error) {
      console.error('Failed to decrement like count:', error);
    }
  }

  // ==================== GET UPDATED LIKE COUNT ====================
  
  async getUpdatedLikeCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      const { data } = await supabase
        .from(table)
        .select('likes')
        .eq('id', contentId)
        .single();

      return data?.likes || 0;

    } catch (error) {
      console.error('Failed to get like count:', error);
      return 0;
    }
  }

  // ==================== CHECK IF LIKED ====================
  
  /**
   * Check if user has liked content
   * @param {string} contentType 
   * @param {string} contentId 
   * @param {string} userId 
   * @returns {Promise<boolean>}
   */
  async checkIfLiked(contentType, contentId, userId) {
    try {
      if (!userId) return false;

      const table = this.getLikeTable(contentType);
      const contentField = this.getContentField(contentType);

      const { data } = await supabase
        .from(table)
        .select('id')
        .eq(contentField, contentId)
        .eq('user_id', userId)
        .maybeSingle();

      return !!data;

    } catch (error) {
      console.error('Check liked status error:', error);
      return false;
    }
  }

  // ==================== GET LIKES LIST ====================
  
  /**
   * Get list of users who liked content
   * @param {string} contentType 
   * @param {string} contentId 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getLikesList(contentType, contentId, limit = 50) {
    try {
      const table = this.getLikeTable(contentType);
      const contentField = this.getContentField(contentType);

      const { data, error } = await supabase
        .from(table)
        .select(`
          id,
          user_id,
          created_at,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq(contentField, contentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      throw handleError(error, 'Get likes list failed');
    }
  }

  // ==================== BATCH CHECK LIKES ====================
  
  /**
   * Check multiple content items for like status
   * @param {string} contentType 
   * @param {Array<string>} contentIds 
   * @param {string} userId 
   * @returns {Promise<Object>} - Map of contentId -> boolean
   */
  async batchCheckLikes(contentType, contentIds, userId) {
    try {
      if (!userId || !contentIds.length) return {};

      const table = this.getLikeTable(contentType);
      const contentField = this.getContentField(contentType);

      const { data } = await supabase
        .from(table)
        .select(contentField)
        .eq('user_id', userId)
        .in(contentField, contentIds);

      const likedMap = {};
      contentIds.forEach(id => likedMap[id] = false);
      
      data?.forEach(item => {
        likedMap[item[contentField]] = true;
      });

      return likedMap;

    } catch (error) {
      console.error('Batch check likes error:', error);
      return {};
    }
  }

  // ==================== HELPER METHODS ====================
  
  getLikeTable(contentType) {
    const tables = {
      post: 'post_likes',
      reel: 'reel_likes',
      story: 'story_likes',
      comment: 'comment_likes'
    };
    return tables[contentType] || 'post_likes';
  }

  getContentField(contentType) {
    const fields = {
      post: 'post_id',
      reel: 'reel_id',
      story: 'story_id',
      comment: 'comment_id'
    };
    return fields[contentType] || 'post_id';
  }

  getContentTable(contentType) {
    const tables = {
      post: 'posts',
      reel: 'reels',
      story: 'stories',
      comment: 'comments'
    };
    return tables[contentType] || 'posts';
  }
}

const likeModel = new LikeModel(); 

export default likeModel;