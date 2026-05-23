// ============================================================================
// src/services/social/followService.js — v3 PUSH NOTIFICATIONS ADDED
// ============================================================================
// CHANGES vs v2:
//   [PUSH-1] followUser() sends a push notification to the followed user
//            immediately after a successful follow. Fire-and-forget — never
//            blocks the follow operation or throws to the caller.
//            Push is sent here (service layer) not in FollowModel so that
//            both PostCard and ReelCard get push for free via this service.
//   All v2 bulletproof fixes (FIX-1 through FIX-5) preserved exactly.
// ============================================================================

import FollowModel   from "../../models/FollowModel";
import { supabase }  from "../config/supabase";
import pushService   from "../notifications/pushService";

// ── Push helper — never throws ────────────────────────────────────────────────
async function _sendFollowPush(followerId, followingId) {
  try {
    const { data: follower } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", followerId)
      .single();

    const followerName = follower?.full_name || follower?.username || "Someone";

    await pushService.sendPushToUser({
      recipientUserId: followingId,
      actorUserId:     followerId,
      type:            "follow",
      title:           "New follower",
      message:         `${followerName} started following you`,
      entityId:        null,
      metadata: {
        notification_id: `follow_${followerId}_${followingId}`,
        actorName:       followerName,
        actor_id:        followerId,
        url:             `/profile/${followerId}`,
      },
    });
  } catch (e) {
    console.warn("[FollowService] push failed (non-fatal):", e?.message);
  }
}

class FollowService {
  // ── isFollowing ─────────────────────────────────────────────────────────
  async isFollowing(followerId, followingId) {
    try {
      return await FollowModel.isFollowing(followerId, followingId);
    } catch {
      return false;
    }
  }

  // ── followUser ──────────────────────────────────────────────────────────
  // [PUSH-1] Sends push to followed user on success
  async followUser(followerId, followingId) {
    if (followerId === followingId) {
      return { success: false, error: "Cannot follow yourself" };
    }
    try {
      const result = await FollowModel.followUser(followerId, followingId);
      if (!result.success) {
        const msg = String(result.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("duplicate") || result.code === "23505") {
          return { success: true, alreadyFollowing: true };
        }
        console.warn("[FollowService] followUser non-success:", result.message);
        return { success: false, error: result.message };
      }

      // [PUSH-1] Fire push after confirmed success — never awaited
      _sendFollowPush(followerId, followingId);

      return result;
    } catch (err) {
      const msg = String(err?.message || err || "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("duplicate") ||
        err?.code === "23505" ||
        msg.includes("23505")
      ) {
        // Still send push even on duplicate — user did follow
        _sendFollowPush(followerId, followingId);
        return { success: true, alreadyFollowing: true };
      }
      console.error("[FollowService] followUser error:", err);
      return { success: false, error: err?.message || "Failed to follow user" };
    }
  }

  // ── unfollowUser ─────────────────────────────────────────────────────────
  async unfollowUser(followerId, followingId) {
    try {
      const result = await FollowModel.unfollowUser(followerId, followingId);
      if (!result.success) {
        const msg = String(result.message || "").toLowerCase();
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
    try { return await FollowModel.getFollowerCount(userId); } catch { return 0; }
  }

  // ── getFollowingCount ────────────────────────────────────────────────────
  async getFollowingCount(userId) {
    try { return await FollowModel.getFollowingCount(userId); } catch { return 0; }
  }

  // ── getFollowers ─────────────────────────────────────────────────────────
  async getFollowers(userId, limit = 20) {
    try { return await FollowModel.getFollowers(userId, limit); }
    catch (error) { console.error("Error getting followers:", error); return []; }
  }

  // ── getFollowing ─────────────────────────────────────────────────────────
  async getFollowing(userId, limit = 20) {
    try { return await FollowModel.getFollowing(userId, limit); }
    catch (error) { console.error("Error getting following:", error); return []; }
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
    } catch { return false; }
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