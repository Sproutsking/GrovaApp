// ============================================================================
// src/services/home/storyService.js - FIXED DATABASE QUERY
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import cacheService from '../shared/cacheService';

class StoryService {
  
  // ==================== CREATE STORY - FIXED ====================
  
  async createStory(storyData) {
    try {
      console.log('📖 Creating story with data:', storyData);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('You must be logged in to create a story');
      }

      const newStory = {
        user_id: user.id,
        title: storyData.title,
        preview: storyData.preview,
        full_content: storyData.fullContent,
        cover_image_id: storyData.coverImageId || null,
        cover_image_metadata: storyData.coverImageMetadata || {},
        category: storyData.category || 'Folklore',
        unlock_cost: storyData.unlockCost || 0,
        max_accesses: storyData.maxAccesses === -1 ? 999999 : (storyData.maxAccesses || 1000)
      };

      console.log('💾 Inserting story to database:', newStory);

      // FIXED: Removed 'shares' from select - it doesn't exist in the table
      const { data, error } = await supabase
        .from('stories')
        .insert([newStory])
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
        console.error('❌ Story insert error:', error);
        throw error;
      }

      cacheService.invalidatePattern('stories');
      
      console.log('✅ Story created successfully:', data);
      return data;

    } catch (error) {
      console.error('❌ Create story error:', error);
      throw handleError(error, 'Failed to create story');
    }
  }

  // ==================== GET STORIES ====================
  
  async getStories(filters = {}, offset = 0, limit = 20) {
    try {
      const {
        userId = null,
        category = null
      } = filters;

      const cacheKey = `stories:${userId || 'all'}:${category || 'all'}:${offset}:${limit}`;
      
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log('📦 Stories loaded from cache');
        return cached;
      }

      let query = supabase
        .from('stories')
        .select(`
          id,
          user_id,
          title,
          preview,
          cover_image_id,
          cover_image_metadata,
          category,
          unlock_cost,
          max_accesses,
          current_accesses,
          likes,
          comments_count,
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
        console.error('Stories fetch error:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} stories`);

      cacheService.set(cacheKey, data, 300000);
      return data || [];

    } catch (error) {
      console.error('[Failed to fetch stories]', error);
      throw handleError(error, 'Failed to fetch stories');
    }
  }

  // ==================== GET SINGLE STORY ====================
  
  async getStory(storyId) {
    try {
      const cacheKey = `story:${storyId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('stories')
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
        .eq('id', storyId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      cacheService.set(cacheKey, data, 300000);
      return data;

    } catch (error) {
      throw handleError(error, 'Failed to fetch story');
    }
  }

  // ==================== UPDATE STORY ====================
  
  async updateStory(storyId, updates) {
    try {
      const { data, error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .select()
        .single();

      if (error) throw error;

      cacheService.invalidate(`story:${storyId}`);
      cacheService.invalidatePattern('stories');

      return data;

    } catch (error) {
      throw handleError(error, 'Failed to update story');
    }
  }

  // ==================== DELETE STORY ====================
  
  async deleteStory(storyId) {
    try {
      console.log('🗑️ Deleting story:', storyId);

      const { error } = await supabase
        .from('stories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', storyId);

      if (error) throw error;

      cacheService.invalidate(`story:${storyId}`);
      cacheService.invalidatePattern('stories');

      console.log('✅ Story deleted successfully');
      return { success: true };

    } catch (error) {
      throw handleError(error, 'Failed to delete story');
    }
  }

  // ==================== UNLOCK STORY ====================
  
  async unlockStory(storyId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      const { data: unlocked } = await supabase
        .from('unlocked_stories')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (unlocked) {
        return { alreadyUnlocked: true };
      }

      const story = await this.getStory(storyId);
      
      if (!story) {
        throw new Error('Story not found');
      }

      if (story.max_accesses !== 999999 && story.current_accesses >= story.max_accesses) {
        throw new Error('Story has reached maximum accesses');
      }

      const { error: unlockError } = await supabase
        .from('unlocked_stories')
        .insert([{ story_id: storyId, user_id: user.id }]);

      if (unlockError) throw unlockError;

      if (story.max_accesses !== 999999) {
        await supabase
          .from('stories')
          .update({ current_accesses: story.current_accesses + 1 })
          .eq('id', storyId);
      }

      cacheService.invalidate(`story:${storyId}`);
      
      return { success: true, fullContent: story.full_content };

    } catch (error) {
      throw handleError(error, 'Failed to unlock story');
    }
  }

  // ==================== CHECK IF UNLOCKED ====================
  
  async isStoryUnlocked(storyId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('unlocked_stories')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .maybeSingle();

      return !!data;

    } catch (error) {
      console.error('Failed to check unlock status:', error);
      return false;
    }
  }

  // ==================== TOGGLE LIKE ====================
  
  async toggleLike(storyId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      const { data: existingLike } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingLike) {
        await supabase
          .from('story_likes')
          .delete()
          .eq('id', existingLike.id);

        await supabase.rpc('decrement_story_likes', { story_id: storyId });
        
        return { liked: false };
      } else {
        await supabase
          .from('story_likes')
          .insert([{ story_id: storyId, user_id: user.id }]);

        await supabase.rpc('increment_story_likes', { story_id: storyId });
        
        return { liked: true };
      }

    } catch (error) {
      throw handleError(error, 'Failed to toggle like');
    }
  }

  // ==================== INCREMENT VIEWS ====================
  
  async incrementViews(storyId) {
    try {
      await supabase.rpc('increment_story_views', { story_id: storyId });
    } catch (error) {
      console.error('Failed to increment views:', error);
    }
  }
}

const storyService = new StoryService();
export default storyService;