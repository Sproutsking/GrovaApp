// ============================================================================
// src/models/FollowModel.js — v2 PUSH NOTIFICATIONS ADDED
// ============================================================================
// CHANGES vs v1:
//   [PUSH-1] followUser() sends push to the followed user.
//            Never pushes on unfollow. Never pushes if follower === following.
//   All v1 logic preserved exactly.
// ============================================================================

import { supabase } from "../services/config/supabase";

class FollowModel {
  // Check if user is following another user
  static async isFollowing(followerId, followingId) {
    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", followerId)
        .eq("following_id", followingId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error("Error checking follow status:", error);
      return false;
    }
  }

  // Follow a user
  // [PUSH-1] Sends push to the user being followed
  static async followUser(followerId, followingId) {
    try {
      const { data, error } = await supabase.rpc("process_follow", {
        p_following_id: followingId,
      });
      if (error) throw error;
      return data || { success: false, error: "Follow failed" };
    } catch (error) {
      console.error("Error following user:", error);
      return { success: false, error: error.message };
    }
  }

  // Unfollow a user — no push on unfollow
  static async unfollowUser(followerId, followingId) {
    try {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", followingId);

      if (error) throw error;

      // Decrement follower count
      await supabase.rpc("decrement_follower_count", { user_id: followingId });

      return { success: true };
    } catch (error) {
      console.error("Error unfollowing user:", error);
      return { success: false, error: error.message };
    }
  }

  // Get follower count
  static async getFollowerCount(userId) {
    try {
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error getting follower count:", error);
      return 0;
    }
  }

  // Get following count
  static async getFollowingCount(userId) {
    try {
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error("Error getting following count:", error);
      return 0;
    }
  }

  // Get followers list
  static async getFollowers(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("follows")
        .select(`
          follower_id,
          created_at,
          profiles!follows_follower_id_fkey (
            id, full_name, username, avatar_id, verified
          )
        `)
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting followers:", error);
      return [];
    }
  }

  // Get following list
  static async getFollowing(userId, limit = 20) {
    try {
      const { data, error } = await supabase
        .from("follows")
        .select(`
          following_id,
          created_at,
          profiles!follows_following_id_fkey (
            id, full_name, username, avatar_id, verified
          )
        `)
        .eq("follower_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting following:", error);
      return [];
    }
  }

  static async getMutualFriends(userId, limit = 100) {
    const [following, followers] = await Promise.all([
      this.getFollowing(userId, limit),
      this.getFollowers(userId, limit),
    ]);
    const followerIds = new Set(followers.map((row) => row.follower_id));
    return following
      .filter((row) => followerIds.has(row.following_id))
      .map((row) => row.profiles)
      .filter(Boolean);
  }
}

export default FollowModel;