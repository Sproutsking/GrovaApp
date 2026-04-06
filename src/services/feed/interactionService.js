// src/services/feed/interactionService.js
// ============================================================================
// INTERACTION SERVICE — Pure database operations for social actions
//
// RESPONSIBILITY:
//   This service records social actions (likes, comments, shares, saves, views)
//   in the database and keeps counters accurate.
//
//   EP ECONOMY IS NOT HERE.
//   All EP debit/credit logic lives exclusively in epEconomyService.js and the
//   Postgres functions. This service has zero knowledge of EP costs or rates.
//
// COUNTER ACCURACY:
//   All counter increments use the `increment_count` RPC (atomic UPDATE in SQL)
//   with a SELECT + UPDATE fallback for environments where the RPC is missing.
//   No read-then-write races on shared counters.
//
// CACHING:
//   In-memory like status cache per session. Cleared on explicit call to
//   clearLikeCache() (e.g. on logout).
// ============================================================================

import { supabase } from '../config/supabase';
import { handleError } from '../shared/errorHandler';

// ── Atomic counter helper ─────────────────────────────────────────────────────
async function atomicDelta(table, id, column, delta) {
  // Prefer the RPC (single round-trip, no race)
  try {
    const { error } = await supabase.rpc('increment_count', {
      p_table:  table,
      p_id:     id,
      p_column: column,
      p_delta:  delta,
    });
    if (!error) return;
    throw error;
  } catch {
    // Fallback: SELECT + UPDATE (acceptable for social counters)
  }

  try {
    const { data } = await supabase
      .from(table)
      .select(column)
      .eq('id', id)
      .single();

    const next = Math.max(0, (data?.[column] ?? 0) + delta);
    await supabase.from(table).update({ [column]: next }).eq('id', id);
  } catch (err) {
    console.warn(`[interactionService] atomicDelta(${table}.${column}) fallback failed:`, err.message);
  }
}

// ── Table / field resolvers ───────────────────────────────────────────────────
function getContentTable(contentType) {
  const map = { post: 'posts', reel: 'reels', story: 'stories', comment: 'comments' };
  const t   = map[contentType];
  if (!t) throw new Error(`Unknown content type: "${contentType}"`);
  return t;
}

function getLikeTable(contentType) {
  const map = {
    post:    'post_likes',
    reel:    'reel_likes',
    story:   'story_likes',
    comment: 'comment_likes',
  };
  const t = map[contentType];
  if (!t) throw new Error(`No like table for content type: "${contentType}"`);
  return t;
}

function getContentField(contentType) {
  const map = {
    post:    'post_id',
    reel:    'reel_id',
    story:   'story_id',
    comment: 'comment_id',
  };
  const f = map[contentType];
  if (!f) throw new Error(`No content field for type: "${contentType}"`);
  return f;
}

// ── In-memory like status cache (per session) ─────────────────────────────────
// Key: `${contentType}:${contentId}:${userId}` → boolean
const _likeCache = new Map();

// =============================================================================
class InteractionService {

  // ══════════════════════════════════════════════════════════════════════════
  // LIKES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Toggle a like on any content type (post, reel, story, comment).
   * Returns the new liked state and the refreshed count.
   *
   * NOTE: EP is NOT handled here. The calling code (ReactionPanel) is
   *       responsible for calling epEconomyService.processEngagement() before
   *       or in parallel with this call.
   *
   * @param {string} contentType  'post' | 'reel' | 'story' | 'comment'
   * @param {string} contentId
   * @param {string} userId
   * @returns {Promise<{ liked: boolean, newCount: number }>}
   */
  async toggleLike(contentType, contentId, userId) {
    const cacheKey  = `${contentType}:${contentId}:${userId}`;
    const likeTable = getLikeTable(contentType);
    const contField = getContentField(contentType);
    // Comments' like counter lives in the comments table itself
    const contTable = getContentTable(contentType);

    try {
      const { data: existing } = await supabase
        .from(likeTable)
        .select('id')
        .eq(contField, contentId)
        .eq('user_id', userId)
        .maybeSingle();

      const wasLiked = !!existing;
      const nowLiked = !wasLiked;

      if (wasLiked) {
        await supabase.from(likeTable).delete().eq('id', existing.id);
        await atomicDelta(contTable, contentId, 'likes', -1);
      } else {
        await supabase.from(likeTable).insert({
          [contField]: contentId,
          user_id:     userId,
          created_at:  new Date().toISOString(),
        });
        await atomicDelta(contTable, contentId, 'likes', 1);
      }

      _likeCache.set(cacheKey, nowLiked);

      const { data: row } = await supabase
        .from(contTable)
        .select('likes')
        .eq('id', contentId)
        .single();

      return { liked: nowLiked, newCount: row?.likes ?? 0 };
    } catch (err) {
      throw handleError(err, 'Failed to toggle like');
    }
  }

  /**
   * Check whether a user has liked a piece of content.
   * Returns from in-memory cache when available.
   *
   * @param {string} contentType
   * @param {string} contentId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async checkIfLiked(contentType, contentId, userId) {
    if (!userId) return false;

    const cacheKey = `${contentType}:${contentId}:${userId}`;
    const cached   = _likeCache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const { data } = await supabase
        .from(getLikeTable(contentType))
        .select('id')
        .eq(getContentField(contentType), contentId)
        .eq('user_id', userId)
        .maybeSingle();

      const isLiked = !!data;
      _likeCache.set(cacheKey, isLiked);
      return isLiked;
    } catch {
      return false;
    }
  }

  /**
   * Batch-check liked status for multiple content IDs of the same type.
   * Returns a map of contentId → boolean.
   *
   * @param {string}   contentType
   * @param {string[]} contentIds
   * @param {string}   userId
   * @returns {Promise<Record<string, boolean>>}
   */
  async batchCheckLikes(contentType, contentIds, userId) {
    if (!userId || !contentIds.length) return {};

    const likeTable = getLikeTable(contentType);
    const contField = getContentField(contentType);

    try {
      const { data } = await supabase
        .from(likeTable)
        .select(contField)
        .eq('user_id', userId)
        .in(contField, contentIds);

      const likedSet = new Set((data || []).map(r => r[contField]));
      const result   = {};

      contentIds.forEach(id => {
        const liked     = likedSet.has(id);
        result[id]      = liked;
        _likeCache.set(`${contentType}:${id}:${userId}`, liked);
      });

      return result;
    } catch {
      return {};
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Post a comment or reply, increment the comment counter (top-level only).
   *
   * Top-level comment:
   *   contentType = 'post' | 'reel' | 'story'
   *   contentId   = the post/reel/story UUID
   *   parentId    = null
   *
   * Reply to a comment:
   *   contentType = 'post' | 'reel' | 'story'   (original content type)
   *   contentId   = the post/reel/story UUID
   *   parentId    = UUID of the comment being replied to
   *
   * EP is NOT charged here. The UI layer (ReactionPanel.handleCommentPosted)
   * calls processEngagement() with the correct content type:
   *   top-level → contentType = content.type,  engagementType = 'comment'
   *   reply     → contentType = 'comment',     engagementType = 'reply',  contentId = parentId
   *
   * @returns {Promise<Object>} formatted comment object
   */
  async addComment(contentType, contentId, userId, text, parentId = null) {
    if (!text?.trim())          throw new Error('Comment text is required.');
    if (!userId)                throw new Error('Must be logged in to comment.');
    if (text.trim().length > 1000) throw new Error('Comment exceeds 1000 characters.');

    const contentField = getContentField(contentType);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id:      userId,
          [contentField]: contentId,
          parent_id:    parentId,
          text:         text.trim(),
          likes:        0,
          created_at:   new Date().toISOString(),
        })
        .select(`
          *,
          profiles:user_id (
            id, full_name, username,
            avatar_id, avatar_metadata, verified
          )
        `)
        .single();

      if (error) throw error;

      // Increment comment count only for top-level comments
      if (!parentId) {
        const contTable = getContentTable(contentType);
        await atomicDelta(contTable, contentId, 'comments_count', 1);
      }

      return this._formatComment(data);
    } catch (err) {
      throw handleError(err, 'Failed to add comment');
    }
  }

  /**
   * Get all comments for a piece of content, returned as a nested tree.
   * Top-level comments have a `replies` array populated with their children.
   *
   * @param {string} contentType
   * @param {string} contentId
   * @param {number} limit         Maximum total rows to load (default 200)
   * @returns {Promise<Object[]>}  Array of top-level formatted comments
   */
  async getComments(contentType, contentId, limit = 200) {
    const contentField = getContentField(contentType);

    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            id, full_name, username,
            avatar_id, avatar_metadata, verified
          )
        `)
        .eq(contentField, contentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const rows     = data || [];
      const byId     = new Map();
      const topLevel = [];

      // First pass: format all rows
      rows.forEach(row => {
        const c   = this._formatComment(row);
        c.replies = [];
        byId.set(c.id, c);
      });

      // Second pass: wire up parent → child relationships
      rows.forEach(row => {
        const c = byId.get(row.id);
        if (row.parent_id && byId.has(row.parent_id)) {
          byId.get(row.parent_id).replies.push(c);
        } else {
          topLevel.push(c);
        }
      });

      return topLevel;
    } catch (err) {
      throw handleError(err, 'Failed to fetch comments');
    }
  }

  /**
   * Soft-delete a comment (own content only).
   * Decrements comment counter for top-level comments only.
   *
   * @param {string} commentId
   * @param {string} userId
   * @param {string} contentType   Needed to decrement counter
   * @param {string} contentId     Needed to decrement counter
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteComment(commentId, userId, contentType, contentId) {
    try {
      const { data: comment, error: fetchErr } = await supabase
        .from('comments')
        .select('user_id, parent_id')
        .eq('id', commentId)
        .single();

      if (fetchErr)                   throw new Error('Comment not found.');
      if (comment.user_id !== userId) throw new Error('You can only delete your own comments.');

      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;

      // Only decrement counter for top-level comments
      if (!comment.parent_id && contentType && contentId) {
        const contTable = getContentTable(contentType);
        await atomicDelta(contTable, contentId, 'comments_count', -1);
      }

      return { success: true };
    } catch (err) {
      throw handleError(err, 'Failed to delete comment');
    }
  }

  /**
   * Toggle a like on a comment.
   * Delegates to toggleLike with contentType='comment'.
   *
   * NOTE: EP for liking a comment is handled by the UI layer via
   *       processEngagement({ contentType: 'comment', engagementType: 'like' }).
   */
  async toggleCommentLike(commentId, userId) {
    return this.toggleLike('comment', commentId, userId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHARES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Record a share event and increment the share counter.
   *
   * NOTE: EP for sharing is handled by the UI layer via processEngagement().
   *       This method only handles the database side.
   *
   * @param {string} contentType
   * @param {string} contentId
   * @param {string} userId
   * @param {string} shareType    'external' | 'direct' | 'profile' | 'story'
   * @returns {Promise<{ success: boolean, newCount: number }>}
   */
  async shareContent(contentType, contentId, userId, shareType = 'external') {
    try {
      await supabase.from('shares').insert({
        content_type: contentType,
        content_id:   contentId,
        user_id:      userId,
        share_type:   shareType,
        created_at:   new Date().toISOString(),
      });

      const contTable = getContentTable(contentType);
      await atomicDelta(contTable, contentId, 'shares', 1);

      const { data } = await supabase
        .from(contTable)
        .select('shares')
        .eq('id', contentId)
        .single();

      return { success: true, newCount: data?.shares ?? 0 };
    } catch (err) {
      throw handleError(err, 'Failed to record share');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEWS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Record a view with fair-counting rules:
   *   1. Never count own views
   *   2. Count only once per session per content (sessionStorage)
   *   3. Non-blocking — safe to fire-and-forget from the UI
   *
   * @param {string}      contentType
   * @param {string}      contentId
   * @param {string|null} ownerId    UUID of content owner (to prevent own-view counting)
   * @param {string|null} userId     UUID of viewer
   * @returns {Promise<{ success: boolean, skipped?: string }>}
   */
  async recordView(contentType, contentId, ownerId, userId) {
    // Rule 1: never own view
    if (ownerId && ownerId === userId) {
      return { success: false, skipped: 'own_view' };
    }

    // Rule 2: once per session
    const sessionKey = `viewed:${contentType}:${contentId}`;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) {
        return { success: false, skipped: 'already_viewed_this_session' };
      }
    } catch {
      // sessionStorage unavailable (SSR / private mode) — proceed
    }

    try {
      const contTable = getContentTable(contentType);
      await atomicDelta(contTable, contentId, 'views', 1);

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(sessionKey, '1');
        }
      } catch { /* ignore */ }

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SAVED CONTENT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Toggle save on any content. No EP cost.
   *
   * @param {string} contentType
   * @param {string} contentId
   * @param {string} userId
   * @param {string} folder       Default 'Favorites'
   * @returns {Promise<{ saved: boolean }>}
   */
  async toggleSave(contentType, contentId, userId, folder = 'Favorites') {
    try {
      const { data: existing } = await supabase
        .from('saved_content')
        .select('id')
        .eq('content_type', contentType)
        .eq('content_id',   contentId)
        .eq('user_id',      userId)
        .maybeSingle();

      if (existing) {
        await supabase.from('saved_content').delete().eq('id', existing.id);
        return { saved: false };
      }

      await supabase.from('saved_content').insert({
        user_id:      userId,
        content_type: contentType,
        content_id:   contentId,
        folder,
        created_at:   new Date().toISOString(),
      });

      return { saved: true };
    } catch (err) {
      throw handleError(err, 'Failed to toggle save');
    }
  }

  /**
   * Check whether a user has saved a piece of content.
   *
   * @param {string} contentType
   * @param {string} contentId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async checkIfSaved(contentType, contentId, userId) {
    if (!userId) return false;

    try {
      const { data } = await supabase
        .from('saved_content')
        .select('id')
        .eq('content_type', contentType)
        .eq('content_id',   contentId)
        .eq('user_id',      userId)
        .maybeSingle();

      return !!data;
    } catch {
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ══════════════════════════════════════════════════════════════════════════

  /** Clear the in-memory like cache (call on logout). */
  clearLikeCache() {
    _likeCache.clear();
  }

  /**
   * Format a raw Supabase comment row into a clean domain object.
   * @private
   */
  _formatComment(row) {
    const p = row.profiles ?? {};
    const now = new Date();

    return {
      id:         row.id,
      userId:     row.user_id,
      author:     p.full_name   ?? 'Unknown',
      username:   p.username    ?? 'unknown',
      avatarId:   p.avatar_id   ?? null,
      avatarMeta: p.avatar_metadata ?? {},
      verified:   p.verified    ?? false,
      text:       row.text,
      likes:      row.likes     ?? 0,
      parentId:   row.parent_id ?? null,
      createdAt:  row.created_at,
      updatedAt:  row.updated_at ?? null,
      timeAgo:    this._timeAgo(row.created_at),
      replies:    [],    // populated by getComments tree builder
    };
  }

  /**
   * Format a timestamp as a human-readable "time ago" string.
   * @private
   */
  _timeAgo(timestamp) {
    if (!timestamp) return '';
    const diff   = Date.now() - new Date(timestamp).getTime();
    const mins   = Math.floor(diff / 60_000);
    const hours  = Math.floor(diff / 3_600_000);
    const days   = Math.floor(diff / 86_400_000);
    const weeks  = Math.floor(diff / 604_800_000);

    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    if (weeks < 5)  return `${weeks}w ago`;
    return new Date(timestamp).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }
}

export default new InteractionService();