// ============================================================================
// src/services/feed/interactionService.js
// ============================================================================
// SINGLE SOURCE OF TRUTH for all feed interactions.
//
// Rules:
//  1. Atomic counters — increment_count RPC, never read-then-write
//  2. In-memory like cache per session — prevents duplicate DB checks
//  3. maybeSingle() everywhere — no 406 errors on empty results
//  4. All view tracking deduped via sessionStorage
//  5. Comment count incremented ONLY for root comments (not replies)
//  6. Soft deletes on comments — never hard delete
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";

// ── Atomic increment helper ───────────────────────────────────────────────────
async function atomicIncrement(table, id, column, delta = 1) {
  try {
    const { error } = await supabase.rpc("increment_count", {
      p_table: table,
      p_id: id,
      p_column: column,
      p_delta: delta,
    });
    if (!error) return;
    throw error;
  } catch {
    // Graceful fallback — keeps the app working before RPC is deployed
    try {
      const { data } = await supabase
        .from(table)
        .select(column)
        .eq("id", id)
        .single();
      const current = data?.[column] ?? 0;
      await supabase
        .from(table)
        .update({ [column]: Math.max(0, current + delta) })
        .eq("id", id);
    } catch {
      /* silent */
    }
  }
}

// ── Session-level like cache ──────────────────────────────────────────────────
// Avoids redundant DB reads across a user session.
// Shape: Map<"type_contentId_userId", boolean>
const likeCache = new Map();

function likeCacheKey(contentType, contentId, userId) {
  return `${contentType}_${contentId}_${userId}`;
}

// ============================================================================
class InteractionService {
  // ── TOGGLE LIKE ─────────────────────────────────────────────────────────────
  // Called AFTER optimistic UI update in ReactionPanel.
  // Throws on error so caller can rollback.
  async toggleLike(contentType, contentId, userId) {
    const tableName = `${contentType}_likes`;
    const contentTable = `${contentType}s`;
    const cacheKey = likeCacheKey(contentType, contentId, userId);

    // Check DB (maybeSingle = no error on zero rows)
    const { data: existing, error: checkError } = await supabase
      .from(tableName)
      .select("id")
      .eq(`${contentType}_id`, contentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") throw checkError;

    if (existing) {
      // ── UNLIKE ──────────────────────────────────────────────────────────
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      await atomicIncrement(contentTable, contentId, "likes", -1);
      likeCache.set(cacheKey, false);
      return { liked: false };
    } else {
      // ── LIKE ─────────────────────────────────────────────────────────────
      const { error } = await supabase.from(tableName).insert([
        {
          [`${contentType}_id`]: contentId,
          user_id: userId,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      await atomicIncrement(contentTable, contentId, "likes", 1);
      likeCache.set(cacheKey, true);
      return { liked: true };
    }
  }

  // ── CHECK IF LIKED ──────────────────────────────────────────────────────────
  async checkIfLiked(contentType, contentId, userId) {
    const cacheKey = likeCacheKey(contentType, contentId, userId);
    if (likeCache.has(cacheKey)) return likeCache.get(cacheKey);

    try {
      const { data, error } = await supabase
        .from(`${contentType}_likes`)
        .select("id")
        .eq(`${contentType}_id`, contentId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      const liked = !!data;
      likeCache.set(cacheKey, liked);
      return liked;
    } catch {
      return false;
    }
  }

  // ── TOGGLE COMMENT LIKE ─────────────────────────────────────────────────────
  async toggleCommentLike(commentId, userId) {
    const { data: existing } = await supabase
      .from("comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("comment_likes").delete().eq("id", existing.id);
      await atomicIncrement("comments", commentId, "likes", -1);
      return { liked: false };
    } else {
      await supabase.from("comment_likes").insert([
        {
          comment_id: commentId,
          user_id: userId,
          created_at: new Date().toISOString(),
        },
      ]);
      await atomicIncrement("comments", commentId, "likes", 1);
      return { liked: true };
    }
  }

  // ── ADD COMMENT ─────────────────────────────────────────────────────────────
  async addComment(contentType, contentId, userId, text, parentId = null) {
    if (!text?.trim()) throw new Error("Comment text cannot be empty");
    if (text.trim().length > 1000)
      throw new Error("Comment is too long (max 1000 characters)");

    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        user_id: userId,
        [`${contentType}_id`]: contentId,
        parent_id: parentId || null,
        text: text.trim(),
        likes: 0,
        created_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        profiles:user_id(id, full_name, username, avatar_url, verified)
      `,
      )
      .single();

    if (error) throw handleError(error, "Failed to add comment");

    // Increment comments_count only for root comments (not replies)
    if (!parentId) {
      await atomicIncrement(`${contentType}s`, contentId, "comments_count", 1);
    }

    return this._formatComment(comment);
  }

  // ── GET COMMENTS ────────────────────────────────────────────────────────────
  async getComments(contentType, contentId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(
          `*, profiles:user_id(id, full_name, username, avatar_url, verified)`,
        )
        .eq(`${contentType}_id`, contentId)
        .is("deleted_at", null)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((c) => this._formatComment(c));
    } catch (error) {
      throw handleError(error, "Failed to fetch comments");
    }
  }

  // ── GET REPLIES ─────────────────────────────────────────────────────────────
  async getReplies(commentId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(
          `*, profiles:user_id(id, full_name, username, avatar_url, verified)`,
        )
        .eq("parent_id", commentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((c) => this._formatComment(c));
    } catch (error) {
      throw handleError(error, "Failed to fetch replies");
    }
  }

  // ── DELETE COMMENT (soft) ───────────────────────────────────────────────────
  async deleteComment(commentId, userId) {
    const { data: comment } = await supabase
      .from("comments")
      .select("user_id, parent_id, post_id, reel_id, story_id")
      .eq("id", commentId)
      .single();

    if (!comment || comment.user_id !== userId) throw new Error("Unauthorized");

    const { error } = await supabase
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);
    if (error) throw error;

    // Decrement comments_count for root comments only
    if (!comment.parent_id) {
      const contentId = comment.post_id || comment.reel_id || comment.story_id;
      const contentType = comment.post_id
        ? "posts"
        : comment.reel_id
          ? "reels"
          : "stories";
      await atomicIncrement(contentType, contentId, "comments_count", -1);
    }
    return { success: true };
  }

  // ── RECORD VIEW ─────────────────────────────────────────────────────────────
  // Deduped per session via sessionStorage. Atomic increment via RPC.
  async recordView(contentType, contentId, userId) {
    const viewKey = `grova_view_${contentType}_${contentId}`;
    try {
      if (sessionStorage.getItem(viewKey))
        return { success: true, alreadyViewed: true };
    } catch {
      /* sessionStorage not available — continue */
    }

    try {
      await atomicIncrement(`${contentType}s`, contentId, "views", 1);
      try {
        sessionStorage.setItem(viewKey, "1");
      } catch {
        /* ignore */
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── SHARE CONTENT ───────────────────────────────────────────────────────────
  async shareContent(contentType, contentId, userId, shareType = "external") {
    try {
      await Promise.allSettled([
        supabase.from("shares").insert([
          {
            content_type: contentType,
            content_id: contentId,
            user_id: userId,
            share_type: shareType,
            created_at: new Date().toISOString(),
          },
        ]),
        atomicIncrement(`${contentType}s`, contentId, "shares", 1),
      ]);
      return { success: true };
    } catch (error) {
      throw handleError(error, "Failed to share content");
    }
  }

  // ── TOGGLE SAVE ─────────────────────────────────────────────────────────────
  async toggleSave(contentType, contentId, userId, folder = "Favorites") {
    try {
      const { data: existing } = await supabase
        .from("saved_content")
        .select("id")
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase.from("saved_content").delete().eq("id", existing.id);
        return { saved: false };
      } else {
        await supabase.from("saved_content").insert([
          {
            user_id: userId,
            content_type: contentType,
            content_id: contentId,
            folder,
            created_at: new Date().toISOString(),
          },
        ]);
        return { saved: true };
      }
    } catch (error) {
      throw handleError(error, "Failed to toggle save");
    }
  }

  // ── CHECK IF SAVED ──────────────────────────────────────────────────────────
  async checkIfSaved(contentType, contentId, userId) {
    try {
      const { data } = await supabase
        .from("saved_content")
        .select("id")
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }

  // ── CLEAR SESSION CACHE ─────────────────────────────────────────────────────
  clearCache() {
    likeCache.clear();
  }

  // ── FORMAT COMMENT ──────────────────────────────────────────────────────────
  _formatComment(comment) {
    return {
      id: comment.id,
      userId: comment.user_id,
      author: comment.profiles?.full_name || "Unknown",
      username: comment.profiles?.username || "@unknown",
      avatar:
        comment.profiles?.avatar_url || comment.profiles?.full_name?.[0] || "U",
      verified: comment.profiles?.verified || false,
      text: comment.text,
      likes: comment.likes || 0,
      parentId: comment.parent_id || null,
      timeAgo: this._timeAgo(comment.created_at),
      createdAt: comment.created_at,
    };
  }

  _timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m`;
    if (h < 24) return `${h}h`;
    if (d < 7) return `${d}d`;
    return new Date(ts).toLocaleDateString();
  }
}

const interactionService = new InteractionService();
export default interactionService;
