import { supabase } from "../services/config/supabase";
import { handleError } from "../services/shared/errorHandler";

class LikeModel {
  constructor() {
    this.likeCache = new Map();
    this.pendingUpdates = new Map();
  }

  async toggleLike(contentType, contentId, userId) {
    try {
      if (!userId) throw new Error("User must be logged in to like");

      const table = this.getLikeTable(contentType);
      const contentField = this.getContentField(contentType);
      const cacheKey = `${contentType}-${contentId}-${userId}`;

      // Check cache first
      let existingLike = this.likeCache.get(cacheKey);

      if (existingLike === undefined) {
        const { data } = await supabase
          .from(table)
          .select("id")
          .eq(contentField, contentId)
          .eq("user_id", userId)
          .maybeSingle();

        existingLike = data;
        this.likeCache.set(cacheKey, existingLike);
      }

      const wasLiked = !!existingLike;
      const newLiked = !wasLiked;

      // Update cache immediately
      this.likeCache.set(cacheKey, newLiked ? { id: "pending" } : null);

      // Queue background update
      this.queueUpdate(async () => {
        if (newLiked) {
          const { data, error } = await supabase
            .from(table)
            .insert({
              [contentField]: contentId,
              user_id: userId,
              created_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (!error) {
            this.likeCache.set(cacheKey, data);
            this.incrementLikeCount(contentType, contentId);
          }
        } else {
          await supabase
            .from(table)
            .delete()
            .eq(contentField, contentId)
            .eq("user_id", userId);

          this.decrementLikeCount(contentType, contentId);
        }
      });

      // Return optimistic result
      const currentCount = await this.getUpdatedLikeCount(
        contentType,
        contentId,
      );
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
        try {
          await fn();
        } catch (err) {
          console.error("Background like update failed:", err);
        }
        this.pendingUpdates.delete(id);
      }
    }, 0);
  }

  async likeContent(table, contentField, contentId, userId, contentType) {
    const { error } = await supabase.from(table).insert({
      [contentField]: contentId,
      user_id: userId,
      created_at: new Date().toISOString(),
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
    await supabase.rpc("increment_likes", {
      table_name: table,
      content_id: contentId,
    });
  }

  async decrementLikeCount(contentType, contentId) {
    const table = this.getContentTable(contentType);
    await supabase.rpc("decrement_likes", {
      table_name: table,
      content_id: contentId,
    });
  }

  async getUpdatedLikeCount(contentType, contentId) {
    const table = this.getContentTable(contentType);
    const { data } = await supabase
      .from(table)
      .select("likes")
      .eq("id", contentId)
      .single();

    return data?.likes || 0;
  }

  async checkIfLiked(contentType, contentId, userId) {
    if (!userId) return false;

    const cacheKey = `${contentType}-${contentId}-${userId}`;
    const cached = this.likeCache.get(cacheKey);

    if (cached !== undefined) {
      return !!cached;
    }

    const table = this.getLikeTable(contentType);
    const contentField = this.getContentField(contentType);

    const { data } = await supabase
      .from(table)
      .select("id")
      .eq(contentField, contentId)
      .eq("user_id", userId)
      .maybeSingle();

    this.likeCache.set(cacheKey, data);
    return !!data;
  }

  async getLikesList(contentType, contentId, limit = 50) {
    const table = this.getLikeTable(contentType);
    const contentField = this.getContentField(contentType);

    const { data, error } = await supabase
      .from(table)
      .select(
        `
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
      `,
      )
      .eq(contentField, contentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async batchCheckLikes(contentType, contentIds, userId) {
    if (!userId || !contentIds.length) return {};

    const table = this.getLikeTable(contentType);
    const contentField = this.getContentField(contentType);

    const { data } = await supabase
      .from(table)
      .select(contentField)
      .eq("user_id", userId)
      .in(contentField, contentIds);

    const likedMap = {};
    contentIds.forEach((id) => {
      const cacheKey = `${contentType}-${id}-${userId}`;
      likedMap[id] = false;
    });

    data?.forEach((item) => {
      const id = item[contentField];
      likedMap[id] = true;
      const cacheKey = `${contentType}-${id}-${userId}`;
      this.likeCache.set(cacheKey, { id: item.id });
    });

    return likedMap;
  }

  getLikeTable(contentType) {
    const tables = {
      post: "post_likes",
      reel: "reel_likes",
      story: "story_likes",
      comment: "comment_likes",
    };
    return tables[contentType] || "post_likes";
  }

  getContentField(contentType) {
    const fields = {
      post: "post_id",
      reel: "reel_id",
      story: "story_id",
      comment: "comment_id",
    };
    return fields[contentType] || "post_id";
  }

  getContentTable(contentType) {
    const tables = {
      post: "posts",
      reel: "reels",
      story: "stories",
      comment: "comments",
    };
    return tables[contentType] || "posts";
  }
}

const likeModel = new LikeModel();
export default likeModel;
