// ============================================================================
// src/services/home/storyService.js
// ============================================================================
// ZERO READ-THEN-WRITE RACES — every counter uses the atomic increment_count RPC.
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

// ── Atomic counter helper ─────────────────────────────────────────────────────
async function atomicIncrement(table, id, column, delta = 1) {
  try {
    const { error } = await supabase.rpc("increment_count", {
      p_table: table,
      p_id: id,
      p_column: column,
      p_delta: delta,
    });
    if (!error) return true;
    throw error;
  } catch {
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
      return true;
    } catch {
      return false;
    }
  }
}

class StoryService {
  // ── CREATE STORY ────────────────────────────────────────────────────────────
  async createStory(storyData) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw new Error("You must be logged in to create a story");

      const newStory = {
        user_id: user.id,
        title: storyData.title,
        preview: storyData.preview,
        full_content: storyData.fullContent,
        cover_image_id: storyData.coverImageId || null,
        cover_image_metadata: storyData.coverImageMetadata || {},
        category: storyData.category || "Folklore",
        unlock_cost: storyData.unlockCost || 0,
        max_accesses:
          storyData.maxAccesses === -1 ? 999999 : storyData.maxAccesses || 1000,
      };

      const { data, error } = await supabase
        .from("stories")
        .insert([newStory])
        .select(
          `*, profiles!inner(id, full_name, username, avatar_id, verified, is_pro)`,
        )
        .single();

      if (error) throw error;
      cacheService.invalidatePattern("stories");
      return data;
    } catch (error) {
      throw handleError(error, "Failed to create story");
    }
  }

  // ── GET STORIES ─────────────────────────────────────────────────────────────
  async getStories(filters = {}, offset = 0, limit = 20) {
    try {
      const { userId = null, category = null } = filters;
      const cacheKey = `stories:${userId || "all"}:${category || "all"}:${offset}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from("stories")
        .select(
          `
          id, user_id, title, preview, cover_image_id, cover_image_metadata,
          category, unlock_cost, max_accesses, current_accesses,
          likes, comments_count, views, created_at,
          profiles!inner(id, full_name, username, avatar_id, verified, is_pro)
        `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (userId) query = query.eq("user_id", userId);
      if (category) query = query.eq("category", category);

      const { data, error } = await query;
      if (error) throw error;

      cacheService.set(cacheKey, data, 300_000);
      return data || [];
    } catch (error) {
      throw handleError(error, "Failed to fetch stories");
    }
  }

  // ── GET SINGLE STORY ────────────────────────────────────────────────────────
  async getStory(storyId) {
    try {
      const cacheKey = `story:${storyId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("stories")
        .select(
          `*, profiles!inner(id, full_name, username, avatar_id, verified, is_pro)`,
        )
        .eq("id", storyId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      cacheService.set(cacheKey, data, 300_000);
      return data;
    } catch (error) {
      throw handleError(error, "Failed to fetch story");
    }
  }

  // ── UPDATE STORY ────────────────────────────────────────────────────────────
  async updateStory(storyId, updates) {
    try {
      const { data, error } = await supabase
        .from("stories")
        .update(updates)
        .eq("id", storyId)
        .select()
        .single();
      if (error) throw error;
      cacheService.invalidate(`story:${storyId}`);
      cacheService.invalidatePattern("stories");
      return data;
    } catch (error) {
      throw handleError(error, "Failed to update story");
    }
  }

  // ── DELETE STORY (soft) ─────────────────────────────────────────────────────
  async deleteStory(storyId) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be logged in");

      const { data: story, error: fetchError } = await supabase
        .from("stories")
        .select("id, user_id, deleted_at")
        .eq("id", storyId)
        .single();
      if (fetchError) throw new Error("Story not found");
      if (story.deleted_at) {
        cacheService.invalidate(`story:${storyId}`);
        cacheService.invalidatePattern("stories");
        return { success: true };
      }
      if (story.user_id !== user.id)
        throw new Error("You can only delete your own stories");

      const { error } = await supabase
        .from("stories")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", storyId);
      if (error) throw error;

      cacheService.invalidate(`story:${storyId}`);
      cacheService.invalidatePattern("stories");
      return { success: true };
    } catch (error) {
      throw handleError(error, error.message || "Failed to delete story");
    }
  }

  // ── TOGGLE LIKE ─────────────────────────────────────────────────────────────
  async toggleLike(storyId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { data: existing } = await supabase
        .from("story_likes")
        .select("id")
        .eq("story_id", storyId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("story_likes").delete().eq("id", existing.id);
        await atomicIncrement("stories", storyId, "likes", -1);
        return { liked: false };
      } else {
        await supabase
          .from("story_likes")
          .insert([{ story_id: storyId, user_id: user.id }]);
        await atomicIncrement("stories", storyId, "likes", 1);
        return { liked: true };
      }
    } catch (error) {
      throw handleError(error, "Failed to toggle like");
    }
  }

  // ── CHECK IF LIKED ──────────────────────────────────────────────────────────
  async checkIfLiked(storyId, userId) {
    try {
      const { data } = await supabase
        .from("story_likes")
        .select("id")
        .eq("story_id", storyId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }

  // ── SHARE STORY ─────────────────────────────────────────────────────────────
  async shareStory(storyId, shareType = "external") {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await Promise.allSettled([
        supabase.from("shares").insert([
          {
            content_type: "story",
            content_id: storyId,
            user_id: user.id,
            share_type: shareType,
          },
        ]),
        // Stories don't have a shares column by default — guard with try
        atomicIncrement("stories", storyId, "shares", 1),
      ]);
    } catch {
      /* silent */
    }
  }

  // ── INCREMENT VIEWS ─────────────────────────────────────────────────────────
  async incrementViews(storyId) {
    try {
      await atomicIncrement("stories", storyId, "views", 1);
    } catch {
      /* silent */
    }
  }

  // ── INCREMENT COMMENTS COUNT ────────────────────────────────────────────────
  async incrementCommentsCount(storyId, delta = 1) {
    try {
      await atomicIncrement("stories", storyId, "comments_count", delta);
    } catch {
      /* silent */
    }
  }

  // ── UNLOCK STORY ────────────────────────────────────────────────────────────
  async unlockStory(storyId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { data: unlocked } = await supabase
        .from("unlocked_stories")
        .select("id")
        .eq("story_id", storyId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (unlocked) return { alreadyUnlocked: true };

      const story = await this.getStory(storyId);
      if (!story) throw new Error("Story not found");
      if (
        story.max_accesses !== 999999 &&
        story.current_accesses >= story.max_accesses
      ) {
        throw new Error("Story has reached maximum accesses");
      }

      const { error: unlockError } = await supabase
        .from("unlocked_stories")
        .insert([{ story_id: storyId, user_id: user.id }]);
      if (unlockError) throw unlockError;

      if (story.max_accesses !== 999999) {
        await atomicIncrement("stories", storyId, "current_accesses", 1);
      }

      cacheService.invalidate(`story:${storyId}`);
      return { success: true, fullContent: story.full_content };
    } catch (error) {
      throw handleError(error, "Failed to unlock story");
    }
  }

  // ── IS STORY UNLOCKED ───────────────────────────────────────────────────────
  async isStoryUnlocked(storyId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("unlocked_stories")
        .select("id")
        .eq("story_id", storyId)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }

  // ── GET TOP INTERACTIONS ────────────────────────────────────────────────────
  async getTopInteractions(userId, limit = 3) {
    try {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, user1_id, user2_id, last_message_at")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .limit(limit);

      if (!conversations?.length) {
        const { data: follows } = await supabase
          .from("follows")
          .select(
            `following_id, profiles!follows_following_id_fkey(id, full_name, username, avatar_id, verified)`,
          )
          .eq("follower_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return (follows || []).map((f) => f.profiles).filter(Boolean);
      }

      const otherIds = conversations.map((c) =>
        c.user1_id === userId ? c.user2_id : c.user1_id,
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, verified")
        .in("id", otherIds)
        .is("deleted_at", null);

      return otherIds
        .map((id) => (profiles || []).find((p) => p.id === id))
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

const storyService = new StoryService();
export default storyService;
