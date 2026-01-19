// ============================================================================
// src/services/home/reelService.js - COMPLETE FIXED
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import cacheService from '../shared/cacheService';

class ReelService {
  
  // ==================== GET REELS ====================
  
  async getReels(filters = {}, offset = 0, limit = 20) {
    try {
      const {
        userId = null,
        category = null
      } = filters;

      const cacheKey = `reels:${userId || 'all'}:${category || 'all'}:${offset}:${limit}`;
      
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Reels loaded from cache');
        return cached;
      }

      let query = supabase
        .from('reels')
        .select(`
          id,
          user_id,
          video_id,
          video_metadata,
          thumbnail_id,
          caption,
          music,
          category,
          duration,
          likes,
          comments_count,
          shares,
          views,
          created_at,
          profiles!inner(
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (userId && typeof userId === 'string') {
        query = query.eq('user_id', userId);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Reels fetch error:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} reels`);

      cacheService.set(cacheKey, data, 300000);
      return data || [];

    } catch (error) {
      console.error('❌ Failed to fetch reels:', error);
      throw handleError(error, 'Failed to fetch reels');
    }
  }

  // ==================== GET SINGLE REEL ====================
  
  async getReel(reelId) {
    try {
      const cacheKey = `reel:${reelId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('reels')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq('id', reelId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      cacheService.set(cacheKey, data, 300000);
      return data;

    } catch (error) {
      throw handleError(error, 'Failed to fetch reel');
    }
  }

  // ==================== CREATE REEL ====================
  
  async createReel(reelData) {
    try {
      console.log('🎬 Creating reel with data:', reelData);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('You must be logged in to create a reel');
      }

      const newReel = {
        user_id: user.id,
        video_id: reelData.videoId,
        video_metadata: reelData.videoMetadata || {},
        thumbnail_id: reelData.thumbnailId || null,
        caption: reelData.caption || null,
        music: reelData.music || null,
        category: reelData.category || 'Entertainment',
        duration: reelData.duration || null
      };

      console.log('📝 Inserting reel:', newReel);

      const { data, error } = await supabase
        .from('reels')
        .insert([newReel])
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .single();

      if (error) {
        console.error('❌ Reel insert error:', error);
        throw error;
      }

      cacheService.invalidatePattern('reels');
      
      console.log('✅ Reel created successfully:', data);
      return data;

    } catch (error) {
      console.error('❌ Failed to create reel:', error);
      throw handleError(error, 'Failed to create reel');
    }
  }

  // ==================== DELETE REEL ====================
  
  async deleteReel(reelId) {
    try {
      console.log('🗑️ Deleting reel:', reelId);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('You must be logged in to delete a reel');
      }

      // Verify ownership
      const { data: reel, error: fetchError } = await supabase
        .from('reels')
        .select('user_id')
        .eq('id', reelId)
        .single();

      if (fetchError) {
        console.error('❌ Failed to fetch reel:', fetchError);
        throw new Error('Reel not found');
      }

      if (reel.user_id !== user.id) {
        throw new Error('You can only delete your own reels');
      }

      // Soft delete
      const { error } = await supabase
        .from('reels')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', reelId);

      if (error) {
        console.error('❌ Delete error:', error);
        throw error;
      }

      // Clear ALL reel-related cache
      cacheService.invalidate(`reel:${reelId}`);
      cacheService.invalidatePattern('reels');
      console.log('🗑️ Cleared all reel cache');

      console.log('✅ Reel deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Delete failed:', error);
      throw handleError(error, 'Failed to delete reel');
    }
  }

  // ==================== TOGGLE LIKE ====================
  
  async toggleLike(reelId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      const { data: existingLike } = await supabase
        .from('reel_likes')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingLike) {
        // Unlike
        const { error: deleteError } = await supabase
          .from('reel_likes')
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) throw deleteError;

        // Decrement likes count manually
        const { data: reel } = await supabase
          .from('reels')
          .select('likes')
          .eq('id', reelId)
          .single();

        if (reel) {
          await supabase
            .from('reels')
            .update({ likes: Math.max(0, (reel.likes || 1) - 1) })
            .eq('id', reelId);
        }
        
        return { liked: false };
      } else {
        // Like
        const { error: insertError } = await supabase
          .from('reel_likes')
          .insert([{ reel_id: reelId, user_id: user.id }]);

        if (insertError) throw insertError;

        // Increment likes count manually
        const { data: reel } = await supabase
          .from('reels')
          .select('likes')
          .eq('id', reelId)
          .single();

        if (reel) {
          await supabase
            .from('reels')
            .update({ likes: (reel.likes || 0) + 1 })
            .eq('id', reelId);
        }
        
        return { liked: true };
      }

    } catch (error) {
      console.error('❌ Toggle like error:', error);
      throw handleError(error, 'Failed to toggle like');
    }
  }

  // ==================== INCREMENT VIEWS ====================
  
  async incrementViews(reelId) {
    try {
      const { data: reel } = await supabase
        .from('reels')
        .select('views')
        .eq('id', reelId)
        .single();

      if (reel) {
        await supabase
          .from('reels')
          .update({ views: (reel.views || 0) + 1 })
          .eq('id', reelId);
      }
    } catch (error) {
      console.error('❌ Failed to increment views:', error);
    }
  }

  // ==================== INCREMENT SHARES ====================
  
  async incrementShares(reelId) {
    try {
      const { data: reel } = await supabase
        .from('reels')
        .select('shares')
        .eq('id', reelId)
        .single();

      if (reel) {
        await supabase
          .from('reels')
          .update({ shares: (reel.shares || 0) + 1 })
          .eq('id', reelId);
      }
    } catch (error) {
      console.error('❌ Failed to increment shares:', error);
    }
  }
}

const reelService = new ReelService(); 

export default reelService;