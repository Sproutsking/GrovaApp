// ============================================================================
// src/services/home/storyService.js - FIXED WITH SHARE + TOP INTERACTIONS
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';
import cacheService from '../shared/cacheService';

class StoryService {

  async createStory(storyData) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('You must be logged in to create a story');

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

      const { data, error } = await supabase
        .from('stories')
        .insert([newStory])
        .select(`
          *,
          profiles!inner(id, full_name, username, avatar_id, verified)
        `)
        .single();

      if (error) throw error;
      cacheService.invalidatePattern('stories');
      return data;
    } catch (error) {
      throw handleError(error, 'Failed to create story');
    }
  }

  async getStories(filters = {}, offset = 0, limit = 20) {
    try {
      const { userId = null, category = null } = filters;
      const cacheKey = `stories:${userId || 'all'}:${category || 'all'}:${offset}:${limit}`;

      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('stories')
        .select(`
          id, user_id, title, preview, cover_image_id, cover_image_metadata,
          category, unlock_cost, max_accesses, current_accesses,
          likes, comments_count, views, created_at,
          profiles!inner(id, full_name, username, avatar_id, verified)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (userId && typeof userId === 'string') query = query.eq('user_id', userId);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;

      cacheService.set(cacheKey, data, 300000);
      return data || [];
    } catch (error) {
      throw handleError(error, 'Failed to fetch stories');
    }
  }

  async getStory(storyId) {
    try {
      const cacheKey = `story:${storyId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('stories')
        .select(`*, profiles!inner(id, full_name, username, avatar_id, verified)`)
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

  async deleteStory(storyId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('You must be logged in to delete a story');

      const { data: story, error: fetchError } = await supabase
        .from('stories')
        .select('id, user_id, deleted_at')
        .eq('id', storyId)
        .single();

      if (fetchError) throw new Error('Story not found');

      if (story.deleted_at) {
        cacheService.invalidate(`story:${storyId}`);
        cacheService.invalidatePattern('stories');
        return { success: true };
      }

      if (story.user_id !== user.id) throw new Error('You can only delete your own stories');

      const { error } = await supabase
        .from('stories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', storyId);

      if (error) throw error;
      cacheService.invalidate(`story:${storyId}`);
      cacheService.invalidatePattern('stories');
      return { success: true };
    } catch (error) {
      throw handleError(error, error.message || 'Failed to delete story');
    }
  }

  // ==================== SHARE STORY ====================

  async shareStory(storyId, shareType = 'external') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('shares').insert([{
        content_type: 'story',
        content_id: storyId,
        user_id: user.id,
        share_type: shareType,
      }]);
    } catch (error) {
      console.error('Failed to record share:', error);
    }
  }

  // ==================== GET TOP INTERACTIONS ====================

  async getTopInteractions(userId, limit = 3) {
    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id, last_message_at')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .limit(limit);

      if (!conversations?.length) {
        const { data: follows } = await supabase
          .from('follows')
          .select(`following_id, profiles!follows_following_id_fkey(id, full_name, username, avatar_id, verified)`)
          .eq('follower_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);
        return (follows || []).map(f => f.profiles).filter(Boolean);
      }

      const otherUserIds = conversations.map(c =>
        c.user1_id === userId ? c.user2_id : c.user1_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_id, verified')
        .in('id', otherUserIds)
        .is('deleted_at', null);

      return otherUserIds
        .map(id => (profiles || []).find(p => p.id === id))
        .filter(Boolean);
    } catch (error) {
      console.error('Failed to get top interactions:', error);
      return [];
    }
  }

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

      if (unlocked) return { alreadyUnlocked: true };

      const story = await this.getStory(storyId);
      if (!story) throw new Error('Story not found');

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
    } catch {
      return false;
    }
  }

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
        await supabase.from('story_likes').delete().eq('id', existingLike.id);
        const { data: story } = await supabase.from('stories').select('likes').eq('id', storyId).single();
        if (story) await supabase.from('stories').update({ likes: Math.max(0, (story.likes || 1) - 1) }).eq('id', storyId);
        return { liked: false };
      } else {
        await supabase.from('story_likes').insert([{ story_id: storyId, user_id: user.id }]);
        const { data: story } = await supabase.from('stories').select('likes').eq('id', storyId).single();
        if (story) await supabase.from('stories').update({ likes: (story.likes || 0) + 1 }).eq('id', storyId);
        return { liked: true };
      }
    } catch (error) {
      throw handleError(error, 'Failed to toggle like');
    }
  }

  async incrementViews(storyId) {
    try {
      const { data: story } = await supabase.from('stories').select('views').eq('id', storyId).single();
      if (story) await supabase.from('stories').update({ views: (story.views || 0) + 1 }).eq('id', storyId);
    } catch (error) {
      console.error('Failed to increment views:', error);
    }
  }
}

const storyService = new StoryService();
export default storyService;