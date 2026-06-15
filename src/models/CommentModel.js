// ============================================================================
// src/models/CommentModel.js — v2 PUSH NOTIFICATIONS ADDED
// ============================================================================
// CHANGES vs v1:
//   [PUSH-1] addComment() sends push to content owner when a top-level comment
//            is added. Never pushes if commenter === owner.
//   [PUSH-2] addComment() sends push to parent comment author when a reply
//            is added. Never pushes if replier === parent author.
//   All v1 threading logic preserved exactly.
// ============================================================================

import { supabase } from '../services/config/supabase';
import { handleError } from '../services/shared/errorHandler';
import mediaUrlService from '../services/shared/mediaUrlService';
import pushService from '../services/notifications/pushService';

// ── Push helper — never throws ────────────────────────────────────────────────
async function _sendPush(params) {
  try { await pushService.sendPushToUser(params); } catch (e) {
    console.warn("[CommentModel] push failed (non-fatal):", e?.message);
  }
}

class CommentModel {

  // ==================== ADD COMMENT/REPLY ====================
  // [PUSH-1] Pushes to content owner on new top-level comment
  // [PUSH-2] Pushes to parent comment author on reply
  async addComment(contentType, contentId, userId, text, parentId = null) {
    try {
      if (!text || !text.trim()) throw new Error('Comment text is required');
      if (!userId) throw new Error('User must be logged in to comment');

      const contentField = this.getContentField(contentType);

      const { data: newComment, error: insertError } = await supabase
        .from('comments')
        .insert({
          user_id:       userId,
          [contentField]: contentId,
          parent_id:     parentId,
          text:          text.trim(),
          created_at:    new Date().toISOString(),
        })
        .select(`
          *,
          profiles:user_id (
            id, full_name, username, avatar_id, verified
          )
        `)
        .single();

      if (insertError) throw insertError;

      // Increment comment count only for top-level comments
      if (!parentId) {
        await this.incrementCommentCount(contentType, contentId);
      }

      // ── Fetch commenter name for push ─────────────────────────────────────
      const commenterName =
        newComment.profiles?.full_name ||
        newComment.profiles?.username  ||
        "Someone";

      const contentUrl = `/${contentType === 'post' ? 'post' : contentType === 'reel' ? 'reel' : 'story'}/${contentId}`;

      if (!parentId) {
        // [PUSH-1] Top-level comment → push to content owner
        const contentTable = this.getContentTable(contentType);
        const { data: contentRow } = await supabase
          .from(contentTable)
          .select("user_id")
          .eq("id", contentId)
          .single();

        if (contentRow && contentRow.user_id !== userId) {
          _sendPush({
            recipientUserId: contentRow.user_id,
            actorUserId:     userId,
            type:            "comment",
            title:           "New comment",
            message:         `${commenterName} commented: ${text.trim().slice(0, 80)}`,
            entityId:        contentId,
            metadata: {
              notification_id: `comment_${newComment.id}`,
              actorName:       commenterName,
              url:             contentUrl,
            },
          });
        }
      } else {
        // [PUSH-2] Reply → push to parent comment author
        const { data: parentComment } = await supabase
          .from("comments")
          .select("user_id")
          .eq("id", parentId)
          .single();

        if (parentComment && parentComment.user_id !== userId) {
          _sendPush({
            recipientUserId: parentComment.user_id,
            actorUserId:     userId,
            type:            "comment_reply",
            title:           "New reply",
            message:         `${commenterName} replied: ${text.trim().slice(0, 80)}`,
            entityId:        contentId,
            metadata: {
              notification_id: `reply_${newComment.id}`,
              actorName:       commenterName,
              url:             contentUrl,
            },
          });
        }
      }

      return this.formatComment(newComment);
    } catch (error) {
      throw handleError(error, 'Add comment failed');
    }
  }

  // ==================== GET COMMENTS ====================
  async getComments(contentType, contentId) {
    try {
      const contentField = this.getContentField(contentType);

      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            id, full_name, username, avatar_id, verified
          )
        `)
        .eq(contentField, contentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const comments = data || [];
      const commentMap = new Map();
      const topLevel = [];

      comments.forEach(comment => {
        const formatted = this.formatComment(comment);
        formatted.replies = [];
        commentMap.set(comment.id, formatted);
      });

      comments.forEach(comment => {
        const formatted = commentMap.get(comment.id);
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) parent.replies.push(formatted);
        } else {
          topLevel.push(formatted);
        }
      });

      topLevel.forEach(comment => { this.calculateReplyCounts(comment); });

      return topLevel;
    } catch (error) {
      throw handleError(error, 'Get comments failed');
    }
  }

  // ==================== CALCULATE REPLY COUNTS ====================
  calculateReplyCounts(comment) {
    let totalReplies = comment.replies?.length || 0;
    comment.replies?.forEach(reply => {
      this.calculateReplyCounts(reply);
      totalReplies += reply.totalReplies || 0;
    });
    comment.totalReplies  = totalReplies;
    comment.directReplies = comment.replies?.length || 0;
    return totalReplies;
  }

  // ==================== GET SINGLE COMMENT ====================
  async getComment(commentId) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`*, profiles:user_id (id, full_name, username, avatar_id, verified)`)
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
  async updateComment(commentId, userId, newText) {
    try {
      if (!newText || !newText.trim()) throw new Error('Comment text is required');

      const { data: comment } = await supabase
        .from('comments').select('user_id').eq('id', commentId).single();
      if (comment?.user_id !== userId) throw new Error('You can only edit your own comments');

      const { data, error } = await supabase
        .from('comments')
        .update({ text: newText.trim(), updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return this.formatComment(data);
    } catch (error) {
      throw handleError(error, 'Update comment failed');
    }
  }

  // ==================== DELETE COMMENT ====================
  async deleteComment(commentId, userId, contentType, contentId) {
    try {
      const { data: comment } = await supabase
        .from('comments').select('user_id, parent_id').eq('id', commentId).single();
      if (comment?.user_id !== userId) throw new Error('You can only delete your own comments');

      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;

      if (!comment.parent_id) {
        await this.decrementCommentCount(contentType, contentId);
      }

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
        .from(table).select('comments_count').eq('id', contentId).single();
      const newCount = (current?.comments_count || 0) + 1;
      await supabase.from(table).update({ comments_count: newCount }).eq('id', contentId);
    } catch (error) {
      console.error('Failed to increment comment count:', error);
    }
  }

  // ==================== DECREMENT COMMENT COUNT ====================
  async decrementCommentCount(contentType, contentId) {
    try {
      const table = this.getContentTable(contentType);
      const { data: current } = await supabase
        .from(table).select('comments_count').eq('id', contentId).single();
      const newCount = Math.max(0, (current?.comments_count || 0) - 1);
      await supabase.from(table).update({ comments_count: newCount }).eq('id', contentId);
    } catch (error) {
      console.error('Failed to decrement comment count:', error);
    }
  }

  // ==================== FORMAT COMMENT ====================
  formatComment(comment) {
    if (!comment) return null;
    const profile = comment.profiles || {};
    return {
      id:           comment.id,
      userId:       comment.user_id,
      author:       profile.full_name || 'Unknown User',
      username:     profile.username  || 'unknown',
      avatar:       profile.avatar_id
        ? mediaUrlService.getAvatarUrl(profile.avatar_id, 128)
        : null,
      verified:     profile.verified || false,
      text:         comment.text,
      likes:        comment.likes || 0,
      parentId:     comment.parent_id,
      createdAt:    comment.created_at,
      updatedAt:    comment.updated_at,
      timeAgo:      this.getTimeAgo(comment.created_at),
      replies:      [],
      totalReplies: 0,
      directReplies: 0,
    };
  }

  // ==================== HELPER METHODS ====================
  getContentField(contentType) {
    return { post: 'post_id', reel: 'reel_id', story: 'story_id' }[contentType] || 'post_id';
  }

  getContentTable(contentType) {
    return { post: 'posts', reel: 'reels', story: 'stories' }[contentType] || 'posts';
  }

  getTimeAgo(timestamp) {
    const now      = new Date();
    const past     = new Date(timestamp);
    const diffMs   = now - past;
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);

    if (diffMins  < 1)  return 'Just now';
    if (diffMins  < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays  < 7)  return `${diffDays}d ago`;
    return past.toLocaleDateString();
  }
}

const commentModel = new CommentModel();
export default commentModel;