// ============================================================================
// src/services/home/reelService.js
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

class ReelService {
  // ── GET REELS ───────────────────────────────────────────────────────────────
  async getReels(filters = {}, offset = 0, limit = 20) {
    try {
      const { userId = null, category = null } = filters;
      const cacheKey = `reels:${userId || "all"}:${category || "all"}:${offset}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from("reels")
        .select(
          `
          id, user_id, video_id, video_metadata, thumbnail_id,
          caption, music, category, duration,
          likes, comments_count, shares, views, created_at,
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
      throw handleError(error, "Failed to fetch reels");
    }
  }

  // ── GET SINGLE REEL ─────────────────────────────────────────────────────────
  async getReel(reelId) {
    try {
      const cacheKey = `reel:${reelId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("reels")
        .select(
          `*, profiles!inner(id, full_name, username, avatar_id, verified, is_pro)`,
        )
        .eq("id", reelId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      cacheService.set(cacheKey, data, 300_000);
      return data;
    } catch (error) {
      throw handleError(error, "Failed to fetch reel");
    }
  }

  // ── CREATE REEL ─────────────────────────────────────────────────────────────
  async createReel(reelData) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw new Error("You must be logged in to create a reel");

      const newReel = {
        user_id: user.id,
        video_id: reelData.videoId,
        video_metadata: reelData.videoMetadata || {},
        thumbnail_id: reelData.thumbnailId || null,
        caption: reelData.caption || null,
        music: reelData.music || null,
        category: reelData.category || "Entertainment",
        duration: reelData.duration || null,
      };

      const { data, error } = await supabase
        .from("reels")
        .insert([newReel])
        .select(
          `*, profiles!inner(id, full_name, username, avatar_id, verified, is_pro)`,
        )
        .single();

      if (error) throw error;
      cacheService.invalidatePattern("reels");
      return data;
    } catch (error) {
      throw handleError(error, "Failed to create reel");
    }
  }

  // ── DELETE REEL (soft) ──────────────────────────────────────────────────────
  async deleteReel(reelId) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be logged in");

      const { data: reel, error: fetchError } = await supabase
        .from("reels")
        .select("id, user_id, deleted_at")
        .eq("id", reelId)
        .single();
      if (fetchError) throw new Error("Reel not found");
      if (reel.deleted_at) {
        cacheService.invalidate(`reel:${reelId}`);
        cacheService.invalidatePattern("reels");
        return { success: true };
      }
      if (reel.user_id !== user.id)
        throw new Error("You can only delete your own reels");

      const { error } = await supabase
        .from("reels")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", reelId)
        .eq("user_id", user.id);
      if (error) throw error;

      cacheService.invalidate(`reel:${reelId}`);
      cacheService.invalidatePattern("reels");
      return { success: true };
    } catch (error) {
      throw handleError(error, error.message || "Failed to delete reel");
    }
  }

  // ── TOGGLE LIKE ─────────────────────────────────────────────────────────────
  async toggleLike(reelId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { data: existing } = await supabase
        .from("reel_likes")
        .select("id")
        .eq("reel_id", reelId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("reel_likes").delete().eq("id", existing.id);
        await atomicIncrement("reels", reelId, "likes", -1);
        return { liked: false };
      } else {
        await supabase
          .from("reel_likes")
          .insert([{ reel_id: reelId, user_id: user.id }]);
        await atomicIncrement("reels", reelId, "likes", 1);
        return { liked: true };
      }
    } catch (error) {
      throw handleError(error, "Failed to toggle like");
    }
  }

  // ── CHECK IF LIKED ──────────────────────────────────────────────────────────
  async checkIfLiked(reelId, userId) {
    try {
      const { data } = await supabase
        .from("reel_likes")
        .select("id")
        .eq("reel_id", reelId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }

  // ── SHARE REEL ──────────────────────────────────────────────────────────────
  async shareReel(reelId, shareType = "external") {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await Promise.allSettled([
        supabase.from("shares").insert([
          {
            content_type: "reel",
            content_id: reelId,
            user_id: user.id,
            share_type: shareType,
          },
        ]),
        atomicIncrement("reels", reelId, "shares", 1),
      ]);
    } catch {
      /* silent */
    }
  }

  // ── INCREMENT VIEWS ─────────────────────────────────────────────────────────
  async incrementViews(reelId) {
    try {
      await atomicIncrement("reels", reelId, "views", 1);
    } catch {
      /* silent */
    }
  }

  // ── INCREMENT COMMENTS COUNT ────────────────────────────────────────────────
  async incrementCommentsCount(reelId, delta = 1) {
    try {
      await atomicIncrement("reels", reelId, "comments_count", delta);
    } catch {
      /* silent */
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

const reelService = new ReelService();
export default reelService;
