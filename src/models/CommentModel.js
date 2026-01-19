// ============================================================================
// src/models/CommentModel.js - UNIFIED COMMENT SYSTEM WITH THREADING
// ============================================================================

import { supabase } from '../services/config/supabase';
import { handleError } from '../services/shared/errorHandler';
import mediaUrlService from '../services/shared/mediaUrlService';

/**
 * CommentModel - Handles ALL comment operations with threading support
 * Features:
 * - Top-level comments
 * - Nested replies (unlimited depth)
 * - Reply threading (show "10 people replied")
 * - Comment likes
 * - Comment editing & deletion
 */
class CommentModel {
  
  // ==================== ADD COMMENT/REPLY ====================
  
  /**
   * Add a comment or reply
   * @param {string} contentType - 'post' | 'reel' | 'story'
   * @param {string} contentId - ID of the content
   * @param {string} userId - ID of the user commenting
   * @param {string} text - Comment text
   * @param {string|null} parentId - Parent comment ID for replies
   * @returns {Promise<Object>} - New comment with user data
   */
  async addComment(contentType, contentId, userId, text, parentId = null) {
    try {
      if (!text || !text.trim()) {
        throw new Error('Comment text is required');
      }

      if (!userId) {
        throw new Error('User must be logged in to comment');
      }

      const contentField = this.getContentField(contentType);

      // Insert comment
      const { data: newComment, error: insertError } = await supabase
        .from('comments')
        .insert({
          user_id: userId,
          [contentField]: contentId,
          parent_id: parentId,
          text: text.trim(),
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .single();

      if (insertError) throw insertError;

      // Increment comment count ONLY for top-level comments
      if (!parentId) {
        await this.incrementCommentCount(contentType, contentId);
      }

      console.log(`✅ ${parentId ? 'Reply' : 'Comment'} added`);

      return this.formatComment(newComment);

    } catch (error) {
      throw handleError(error, 'Add comment failed');
    }
  }

  // ==================== GET COMMENTS ====================
  
  /**
   * Get all comments for content with threading
   * @param {string} contentType 
   * @param {string} contentId 
   * @returns {Promise<Array>} - Comments with nested replies
   */
  async getComments(contentType, contentId) {
    try {
      const contentField = this.getContentField(contentType);

      // Get ALL comments (both top-level and replies) in one query
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq(contentField, contentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Build comment tree
      const comments = data || [];
      const commentMap = new Map();
      const topLevel = [];

      // First pass: create map of all comments
      comments.forEach(comment => {
        const formatted = this.formatComment(comment);
        formatted.replies = [];
        commentMap.set(comment.id, formatted);
      });

      // Second pass: build tree structure
      comments.forEach(comment => {
        const formatted = commentMap.get(comment.id);
        
        if (comment.parent_id) {
          // This is a reply - add to parent's replies array
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies.push(formatted);
          }
        } else {
          // This is a top-level comment
          topLevel.push(formatted);
        }
      });

      // Third pass: calculate reply counts for each comment
      topLevel.forEach(comment => {
        this.calculateReplyCounts(comment);
      });

      return topLevel;

    } catch (error) {
      throw handleError(error, 'Get comments failed');
    }
  }

  // ==================== CALCULATE REPLY COUNTS ====================
  
  /**
   * Recursively calculate total reply count for a comment
   */
  calculateReplyCounts(comment) {
    let totalReplies = comment.replies?.length || 0;
    
    comment.replies?.forEach(reply => {
      this.calculateReplyCounts(reply);
      totalReplies += reply.totalReplies || 0;
    });

    comment.totalReplies = totalReplies;
    comment.directReplies = comment.replies?.length || 0;
    
    return totalReplies;
  }

  // ==================== GET SINGLE COMMENT ====================
  
  /**
   * Get a single comment by ID
   */
  async getComment(commentId) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq('id', commentId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      return this.formatComment(data);

    } catch (error) {
      throw handleError(error, 'Get comment failed');
    }
  }

  // ==================== UPDATE COMMENT ====================
  
  /**
   * Update comment text
   */
  async updateComment(commentId, userId, newText) {
    try {
      if (!newText || !newText.trim()) {
        throw new Error('Comment text is required');
      }

      // Verify ownership
      const { data: comment } = await supabase
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (comment?.user_id !== userId) {
        throw new Error('You can only edit your own comments');
      }

      // Update comment
      const { data, error } = await supabase
        .from('comments')
        .update({
          text: newText.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Comment updated');
      return this.formatComment(data);

    } catch (error) {
      throw handleError(error, 'Update comment failed');
    }
  }

  // ==================== DELETE COMMENT ====================
  
  /**
   * Soft delete comment
   */
  async deleteComment(commentId, userId, contentType, contentId) {
    try {
      // Verify ownership
      const { data: comment } = await supabase
        .from('comments')
        .select('user_id, parent_id')
        .eq('id', commentId)
        .single();

      if (comment?.user_id !== userId) {
        throw new Error('You can only delete your own comments');
      }

      // Soft delete
      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;

      // Decrement count ONLY for top-level comments
      if (!comment.parent_id) {
        await this.decrementCommentCount(contentType, contentId);
      }

      console.log('✅ Comment deleted');
      return { success: true };

    } catch (error) {
      throw handleError(error, 'Delete comment failed');
    }
  }

  // ==================== INCREMENT COMMENT COUNT ====================
  
  async incrementCommentCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      const { data: current } = await supabase
        .from(table)
        .select('comments_count')
        .eq('id', contentId)
        .single();

      const newCount = (current?.comments_count || 0) + 1;

      await supabase
        .from(table)
        .update({ comments_count: newCount })
        .eq('id', contentId);

    } catch (error) {
      console.error('Failed to increment comment count:', error);
    }
  }

  // ==================== DECREMENT COMMENT COUNT ====================
  
  async decrementCommentCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      
      const { data: current } = await supabase
        .from(table)
        .select('comments_count')
        .eq('id', contentId)
        .single();

      const newCount = Math.max(0, (current?.comments_count || 0) - 1);

      await supabase
        .from(table)
        .update({ comments_count: newCount })
        .eq('id', contentId);

    } catch (error) {
      console.error('Failed to decrement comment count:', error);
    }
  }

  // ==================== FORMAT COMMENT ====================
  
  formatComment(comment) {
    if (!comment) return null;

    const profile = comment.profiles || {};

    return {
      id: comment.id,
      userId: comment.user_id,
      author: profile.full_name || 'Unknown User',
      username: profile.username || 'unknown',
      avatar: profile.avatar_id 
        ? mediaUrlService.getAvatarUrl(profile.avatar_id, 128) 
        : null,
      verified: profile.verified || false,
      text: comment.text,
      likes: comment.likes || 0,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      timeAgo: this.getTimeAgo(comment.created_at),
      replies: [], // Will be populated in getComments
      totalReplies: 0,
      directReplies: 0
    };
  }

  // ==================== HELPER METHODS ====================
  
  getContentField(contentType) {
    const fields = {
      post: 'post_id',
      reel: 'reel_id',
      story: 'story_id'
    };
    return fields[contentType] || 'post_id';
  }

  getContentTable(contentType) {
    const tables = {
      post: 'posts',
      reel: 'reels',
      story: 'stories'
    };
    return tables[contentType] || 'posts';
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
}

const commentModel = new CommentModel(); 

export default commentModel;