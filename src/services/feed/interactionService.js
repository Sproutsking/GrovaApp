// src/services/feed/interactionService.js - FIXED VERSION
import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

class InteractionService {
  constructor() {
    // Track liked items in memory to prevent double-counting
    this.likedItems = new Map();
  }

  // ==================== LIKES ====================
  
  async toggleLike(contentType, contentId, userId) {
    try {
      const tableName = `${contentType}_likes`;
      const contentTable = `${contentType}s`;
      const cacheKey = `${contentType}_${contentId}_${userId}`;
      
      // Check cache first
      const cachedStatus = this.likedItems.get(cacheKey);
      
      // Check if already liked in database
      const { data: existing, error: checkError } = await supabase
        .from(tableName)
        .select('id')
        .eq(`${contentType}_id`, contentId)
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const isCurrentlyLiked = !!existing;

      if (isCurrentlyLiked) {
        // Unlike
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', existing.id);

        if (deleteError) throw deleteError;

        // Decrement likes count safely
        const { data: currentContent } = await supabase
          .from(contentTable)
          .select('likes')
          .eq('id', contentId)
          .single();

        const currentLikes = currentContent?.likes || 0;
        const newLikes = Math.max(0, currentLikes - 1);

        await supabase
          .from(contentTable)
          .update({ likes: newLikes })
          .eq('id', contentId);

        // Update cache
        this.likedItems.set(cacheKey, false);

        return { liked: false, newCount: newLikes };
      } else {
        // Like
        const { error: insertError } = await supabase
          .from(tableName)
          .insert({
            [`${contentType}_id`]: contentId,
            user_id: userId,
            created_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        // Increment likes count safely
        const { data: currentContent } = await supabase
          .from(contentTable)
          .select('likes')
          .eq('id', contentId)
          .single();

        const currentLikes = currentContent?.likes || 0;
        const newLikes = currentLikes + 1;

        await supabase
          .from(contentTable)
          .update({ likes: newLikes })
          .eq('id', contentId);

        // Update cache
        this.likedItems.set(cacheKey, true);

        return { liked: true, newCount: newLikes };
      }
    } catch (error) {
      throw handleError(error, 'Failed to toggle like');
    }
  }

  async checkIfLiked(contentType, contentId, userId) {
    try {
      const cacheKey = `${contentType}_${contentId}_${userId}`;
      
      // Check cache first
      if (this.likedItems.has(cacheKey)) {
        return this.likedItems.get(cacheKey);
      }

      const tableName = `${contentType}_likes`;
      
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .eq(`${contentType}_id`, contentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const isLiked = !!data;
      this.likedItems.set(cacheKey, isLiked);
      
      return isLiked;
    } catch (error) {
      console.error('Check liked error:', error);
      return false;
    }
  }

  // ==================== COMMENTS ====================
  
  async addComment(contentType, contentId, userId, text, parentId = null) {
    try {
      const contentTable = `${contentType}s`;
      
      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Comment text cannot be empty');
      }

      if (text.trim().length > 1000) {
        throw new Error('Comment is too long (max 1000 characters)');
      }

      // Insert comment
      const { data: comment, error: insertError } = await supabase
        .from('comments')
        .insert({
          user_id: userId,
          [`${contentType}_id`]: contentId,
          parent_id: parentId,
          text: text.trim(),
          likes: 0,
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .single();

      if (insertError) throw insertError;

      // Increment comments count only for parent comments
      if (!parentId) {
        const { data: currentContent } = await supabase
          .from(contentTable)
          .select('comments_count')
          .eq('id', contentId)
          .single();

        const currentCount = currentContent?.comments_count || 0;
        const newCount = currentCount + 1;

        await supabase
          .from(contentTable)
          .update({ comments_count: newCount })
          .eq('id', contentId);
      }

      return this.formatComment(comment);
    } catch (error) {
      throw handleError(error, 'Failed to add comment');
    }
  }

  async getComments(contentType, contentId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq(`${contentType}_id`, contentId)
        .is('deleted_at', null)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(comment => this.formatComment(comment));
    } catch (error) {
      throw handleError(error, 'Failed to fetch comments');
    }
  }

  async getReplies(commentId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq('parent_id', commentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(comment => this.formatComment(comment));
    } catch (error) {
      throw handleError(error, 'Failed to fetch replies');
    }
  }

  async toggleCommentLike(commentId, userId) {
    try {
      // Check if already liked
      const { data: existing, error: checkError } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existing.id);

        // Decrement likes
        const { data: comment } = await supabase
          .from('comments')
          .select('likes')
          .eq('id', commentId)
          .single();

        const currentLikes = comment?.likes || 0;
        const newLikes = Math.max(0, currentLikes - 1);

        await supabase
          .from('comments')
          .update({ likes: newLikes })
          .eq('id', commentId);

        return { liked: false, newCount: newLikes };
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: userId,
            created_at: new Date().toISOString()
          });

        // Increment likes
        const { data: comment } = await supabase
          .from('comments')
          .select('likes')
          .eq('id', commentId)
          .single();

        const currentLikes = comment?.likes || 0;
        const newLikes = currentLikes + 1;

        await supabase
          .from('comments')
          .update({ likes: newLikes })
          .eq('id', commentId);

        return { liked: true, newCount: newLikes };
      }
    } catch (error) {
      throw handleError(error, 'Failed to toggle comment like');
    }
  }

  async deleteComment(commentId, userId) {
    try {
      // Verify ownership
      const { data: comment } = await supabase
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (!comment || comment.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      // Soft delete
      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      throw handleError(error, 'Failed to delete comment');
    }
  }

  // ==================== SHARES ====================
  
  async shareContent(contentType, contentId, userId, shareType = 'profile') {
    try {
      const contentTable = `${contentType}s`;
      
      // Insert share record
      const { error: insertError } = await supabase
        .from('shares')
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          share_type: shareType,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Increment shares count safely
      const { data: currentContent } = await supabase
        .from(contentTable)
        .select('shares')
        .eq('id', contentId)
        .single();

      const currentShares = currentContent?.shares || 0;
      const newShares = currentShares + 1;

      await supabase
        .from(contentTable)
        .update({ shares: newShares })
        .eq('id', contentId);

      return { success: true, newCount: newShares };
    } catch (error) {
      throw handleError(error, 'Failed to share content');
    }
  }

  // ==================== VIEWS ====================
  
  async recordView(contentType, contentId, userId) {
    try {
      const contentTable = `${contentType}s`;
      const viewKey = `view_${contentType}_${contentId}_${userId || 'anon'}`;
      
      // Check if user has already viewed this content (using sessionStorage)
      const hasViewed = sessionStorage.getItem(viewKey);
      
      if (hasViewed) {
        return { success: true, alreadyViewed: true };
      }

      // Increment views count safely
      const { data: currentContent } = await supabase
        .from(contentTable)
        .select('views')
        .eq('id', contentId)
        .single();

      const currentViews = currentContent?.views || 0;
      const newViews = currentViews + 1;

      const { error } = await supabase
        .from(contentTable)
        .update({ views: newViews })
        .eq('id', contentId);

      if (error) throw error;

      // Mark as viewed in sessionStorage
      sessionStorage.setItem(viewKey, 'true');

      return { success: true, alreadyViewed: false, newCount: newViews };
    } catch (error) {
      console.error('Record view error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SAVED CONTENT ====================
  
  async toggleSave(contentType, contentId, userId, folder = 'Favorites') {
    try {
      // Check if already saved
      const { data: existing, error: checkError } = await supabase
        .from('saved_content')
        .select('id')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        // Unsave
        const { error: deleteError } = await supabase
          .from('saved_content')
          .delete()
          .eq('id', existing.id);

        if (deleteError) throw deleteError;

        return { saved: false };
      } else {
        // Save
        const { error: insertError } = await supabase
          .from('saved_content')
          .insert({
            user_id: userId,
            content_type: contentType,
            content_id: contentId,
            folder,
            created_at: new Date().toISOString()
          });

        if (insertError) throw insertError;

        return { saved: true };
      }
    } catch (error) {
      throw handleError(error, 'Failed to toggle save');
    }
  }

  async checkIfSaved(contentType, contentId, userId) {
    try {
      const { data, error } = await supabase
        .from('saved_content')
        .select('id')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Check saved error:', error);
      return false;
    }
  }

  // ==================== FORMATTING ====================
  
  formatComment(comment) {
    return {
      id: comment.id,
      userId: comment.user_id,
      author: comment.profiles?.full_name || 'Unknown',
      username: comment.profiles?.username || '@unknown',
      avatar: comment.profiles?.avatar_id || comment.profiles?.full_name?.[0] || 'U',
      verified: comment.profiles?.verified || false,
      text: comment.text,
      likes: comment.likes || 0,
      parentId: comment.parent_id,
      timeAgo: this.getTimeAgo(comment.created_at),
      createdAt: comment.created_at
    };
  }

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

  // Clear cache
  clearCache() {
    this.likedItems.clear();
  }
}

export default new InteractionService();