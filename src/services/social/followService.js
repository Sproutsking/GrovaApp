// ============================================================================
// src/services/social/followService.js — v2 BULLETPROOF
// ============================================================================
// FIXES:
//   [FIX-1] followUser() no longer throws "Already following" — it treats it
//           as a success and returns { success: true, alreadyFollowing: true }.
//           PostCard's toggleFollow won't flip back to "unfollowed" state.
//   [FIX-2] All DB errors are caught and returned as { success: false } instead
//           of re-thrown, so the UI optimistic update is always preserved.
//   [FIX-3] unfollowUser() likewise never throws on "not following" state.
//   [FIX-4] isFollowing() returns false (not throw) on any DB error.
//   [FIX-5] All count helpers return 0 on error instead of throwing.
// ============================================================================

import FollowModel from "../../models/FollowModel";
import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";

class FollowService {
  // ── isFollowing ─────────────────────────────────────────────────────────
  async isFollowing(followerId, followingId) {
    try {
      return await FollowModel.isFollowing(followerId, followingId);
    } catch {
      // [FIX-4] Never throw — just report false
      return false;
    }
  }

  // ── followUser ──────────────────────────────────────────────────────────
  // [FIX-1] Idempotent — calling this when already following returns success.
  async followUser(followerId, followingId) {
    if (followerId === followingId) {
      return { success: false, error: "Cannot follow yourself" };
    }
    try {
      const result = await FollowModel.followUser(followerId, followingId);
      if (!result.success) {
        // "Already following" is NOT an error — treat as success
        const msg = String(result.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("duplicate") || result.code === "23505") {
          return { success: true, alreadyFollowing: true };
        }
        // Other failures — return gracefully, never throw
        console.warn("[FollowService] followUser non-success:", result.message);
        return { success: false, error: result.message };
      }
      return result;
    } catch (err) {
      // [FIX-2] DB unique constraint violation = already following → success
      const msg = String(err?.message || err || "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("duplicate") ||
        err?.code === "23505" ||
        msg.includes("23505")
      ) {
        return { success: true, alreadyFollowing: true };
      }
      console.error("[FollowService] followUser error:", err);
      // Return failure object — NEVER rethrow, so optimistic UI stays intact
      return { success: false, error: err?.message || "Failed to follow user" };
    }
  }

  // ── unfollowUser ─────────────────────────────────────────────────────────
  // [FIX-3] Idempotent — calling this when not following returns success.
  async unfollowUser(followerId, followingId) {
    try {
      const result = await FollowModel.unfollowUser(followerId, followingId);
      if (!result.success) {
        const msg = String(result.message || "").toLowerCase();
        // "Not following" is not an error
        if (msg.includes("not follow") || msg.includes("not found")) {
          return { success: true };
        }
        console.warn("[FollowService] unfollowUser non-success:", result.message);
        return { success: false, error: result.message };
      }
      return result;
    } catch (err) {
      const msg = String(err?.message || err || "").toLowerCase();
      if (msg.includes("not follow") || msg.includes("not found")) {
        return { success: true };
      }
      console.error("[FollowService] unfollowUser error:", err);
      return { success: false, error: err?.message || "Failed to unfollow user" };
    }
  }

  // ── getFollowerCount ─────────────────────────────────────────────────────
  async getFollowerCount(userId) {
    try {
      return await FollowModel.getFollowerCount(userId);
    } catch {
      return 0; // [FIX-5]
    }
  }

  // ── getFollowingCount ────────────────────────────────────────────────────
  async getFollowingCount(userId) {
    try {
      return await FollowModel.getFollowingCount(userId);
    } catch {
      return 0; // [FIX-5]
    }
  }

  // ── getFollowers ─────────────────────────────────────────────────────────
  async getFollowers(userId, limit = 20) {
    try {
      return await FollowModel.getFollowers(userId, limit);
    } catch (error) {
      console.error("Error getting followers:", error);
      return [];
    }
  }

  // ── getFollowing ─────────────────────────────────────────────────────────
  async getFollowing(userId, limit = 20) {
    try {
      return await FollowModel.getFollowing(userId, limit);
    } catch (error) {
      console.error("Error getting following:", error);
      return [];
    }
  }

  // ── getMutualFollowers ───────────────────────────────────────────────────
  async getMutualFollowers(userId, limit = 20) {
    try {
      const { data: following, error: followingError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      if (followingError) throw followingError;
      if (!following || following.length === 0) return [];

      const followingIds = following.map((f) => f.following_id);

      const { data: mutualFollowers, error: mutualError } = await supabase
        .from("follows")
        .select(
          `follower_id, created_at,
           profiles!follows_follower_id_fkey (
             id, full_name, username, avatar_id, verified
           )`
        )
        .eq("following_id", userId)
        .in("follower_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (mutualError) throw mutualError;
      return mutualFollowers || [];
    } catch (error) {
      console.error("Error getting mutual followers:", error);
      return [];
    }
  }

  // ── isMutualFollow ───────────────────────────────────────────────────────
  async isMutualFollow(userId1, userId2) {
    try {
      const [a, b] = await Promise.all([
        this.isFollowing(userId1, userId2),
        this.isFollowing(userId2, userId1),
      ]);
      return a && b;
    } catch {
      return false;
    }
  }

  // ── getFollowStats ───────────────────────────────────────────────────────
  async getFollowStats(userId) {
    try {
      const [followers, following, mutuals] = await Promise.all([
        this.getFollowerCount(userId),
        this.getFollowingCount(userId),
        this.getMutualFollowers(userId, 1000),
      ]);
      return { followers, following, mutuals: mutuals.length };
    } catch {
      return { followers: 0, following: 0, mutuals: 0 };
    }
  }
}

const followService = new FollowService();
export default followService;