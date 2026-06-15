// ============================================================================
// src/models/LikeModel.js — v2 PUSH NOTIFICATIONS ADDED
// ============================================================================
// CHANGES vs v1:
//   [PUSH-1] toggleLike() sends push to content owner when liked.
//            Does NOT push on unlike. Does NOT push if liker === owner.
//            Push is sent AFTER the DB operation succeeds (never optimistic).
//   All v1 cache + optimistic logic preserved exactly.
// ============================================================================

import { supabase } from "../services/config/supabase";
import { handleError } from "../services/shared/errorHandler";
import pushService from "../services/notifications/pushService";

// ── Push helper — never throws ────────────────────────────────────────────────
async function _sendPush(params) {
  try { await pushService.sendPushToUser(params); } catch (e) {
    console.warn("[LikeModel] push failed (non-fatal):", e?.message);
  }
}

// ── Fetch content owner ───────────────────────────────────────────────────────
async function _getContentOwner(table, contentId) {
  try {
    const { data } = await supabase
      .from(table).select("user_id").eq("id", contentId).single();
    return data?.user_id || null;
  } catch { return null; }
}

class LikeModel {
  constructor() {
    this.likeCache      = new Map();
    this.pendingUpdates = new Map();
  }

  // [PUSH-1] toggleLike sends push to content owner on like
  async toggleLike(contentType, contentId, userId) {
    try {
      if (!userId) throw new Error("User must be logged in to like");

      const table        = this.getLikeTable(contentType);
      const contentField = this.getContentField(contentType);
      const cacheKey     = `${contentType}-${contentId}-${userId}`;

      let existingLike = this.likeCache.get(cacheKey);
      if (existingLike === undefined) {
        const { data } = await supabase
          .from(table).select("id")
          .eq(contentField, contentId).eq("user_id", userId).maybeSingle();
        existingLike = data;
        this.likeCache.set(cacheKey, existingLike);
      }

      const wasLiked = !!existingLike;
      const newLiked = !wasLiked;

      this.likeCache.set(cacheKey, newLiked ? { id: "pending" } : null);

      this.queueUpdate(async () => {
        if (newLiked) {
          const { data, error } = await supabase
            .from(table)
            .insert({ [contentField]: contentId, user_id: userId, created_at: new Date().toISOString() })
            .select("id").single();

          if (!error) {
            this.likeCache.set(cacheKey, data);
            this.incrementLikeCount(contentType, contentId);

            // [PUSH-1] Push to content owner after successful DB insert
            const contentTable = this.getContentTable(contentType);
            const ownerId = await _getContentOwner(contentTable, contentId);

            if (ownerId && ownerId !== userId) {
              const { data: liker } = await supabase
                .from("profiles").select("full_name, username").eq("id", userId).single();
              const likerName = liker?.full_name || liker?.username || "Someone";
              const contentPath = contentType === "post"
                ? `/post/${contentId}`
                : contentType === "reel"
                ? `/reel/${contentId}`
                : `/story/${contentId}`;

              _sendPush({
                recipientUserId: ownerId,
                actorUserId:     userId,
                type:            "like",
                title:           "New like",
                message:         `${likerName} liked your ${contentType}`,
                entityId:        contentId,
                metadata: {
                  notification_id: `like_${contentType}_${contentId}_${userId}`,
                  actorName:       likerName,
                  url:             contentPath,
                },
              });
            }
          }
        } else {
          await supabase
            .from(table).delete()
            .eq(contentField, contentId).eq("user_id", userId);
          this.decrementLikeCount(contentType, contentId);
        }
      });

      const currentCount = await this.getUpdatedLikeCount(contentType, contentId);
      const newCount = newLiked
        ? currentCount + 1
        : Math.max(0, currentCount - 1);

      return { liked: newLiked, newCount, success: true };
    } catch (error) {
      throw handleError(error, "Toggle like failed");
    }
  }

  queueUpdate(updateFn) {
    const id = Date.now() + Math.random();
    this.pendingUpdates.set(id, updateFn);
    setTimeout(async () => {
      const fn = this.pendingUpdates.get(id);
      if (fn) {
        try { await fn(); } catch (err) { console.error("Background like update failed:", err); }
        this.pendingUpdates.delete(id);
      }
    }, 0);
  }

  async likeContent(table, contentField, contentId, userId, contentType) {
    const { error } = await supabase.from(table).insert({
      [contentField]: contentId, user_id: userId, created_at: new Date().toISOString(),
    });
    if (error) throw error;
    await this.incrementLikeCount(contentType, contentId);
  }

  async unlikeContent(table, likeId, contentType, contentId) {
    const { error } = await supabase.from(table).delete().eq("id", likeId);
    if (error) throw error;
    await this.decrementLikeCount(contentType, contentId);
  }

  async incrementLikeCount(contentType, contentId) {
    const table = this.getContentTable(contentType);
    await supabase.rpc("increment_likes", { table_name: table, content_id: contentId });
  }

  async decrementLikeCount(contentType, contentId) {
    const table = this.getContentTable(contentType);
    await supabase.rpc("decrement_likes", { table_name: table, content_id: contentId });
  }

  async getUpdatedLikeCount(contentType, contentId) {
    const table = this.getContentTable(contentType);
    const { data } = await supabase.from(table).select("likes").eq("id", contentId).single();
    return data?.likes || 0;
  }

  async checkIfLiked(contentType, contentId, userId) {
    if (!userId) return false;
    const cacheKey = `${contentType}-${contentId}-${userId}`;
    const cached = this.likeCache.get(cacheKey);
    if (cached !== undefined) return !!cached;

    const table        = this.getLikeTable(contentType);
    const contentField = this.getContentField(contentType);
    const { data } = await supabase
      .from(table).select("id")
      .eq(contentField, contentId).eq("user_id", userId).maybeSingle();
    this.likeCache.set(cacheKey, data);
    return !!data;
  }

  async getLikesList(contentType, contentId, limit = 50) {
    const table        = this.getLikeTable(contentType);
    const contentField = this.getContentField(contentType);
    const { data, error } = await supabase
      .from(table)
      .select(`id, user_id, created_at, profiles:user_id (id, full_name, username, avatar_id, verified)`)
      .eq(contentField, contentId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async batchCheckLikes(contentType, contentIds, userId) {
    if (!userId || !contentIds.length) return {};
    const table        = this.getLikeTable(contentType);
    const contentField = this.getContentField(contentType);
    const { data } = await supabase
      .from(table).select(contentField)
      .eq("user_id", userId).in(contentField, contentIds);

    const likedMap = {};
    contentIds.forEach((id) => { likedMap[id] = false; });
    data?.forEach((item) => {
      const id = item[contentField];
      likedMap[id] = true;
      this.likeCache.set(`${contentType}-${id}-${userId}`, { id: item.id });
    });
    return likedMap;
  }

  getLikeTable(contentType) {
    return { post: "post_likes", reel: "reel_likes", story: "story_likes", comment: "comment_likes" }[contentType] || "post_likes";
  }

  getContentField(contentType) {
    return { post: "post_id", reel: "reel_id", story: "story_id", comment: "comment_id" }[contentType] || "post_id";
  }

  getContentTable(contentType) {
    return { post: "posts", reel: "reels", story: "stories", comment: "comments" }[contentType] || "posts";
  }
}

const likeModel = new LikeModel();
export default likeModel;