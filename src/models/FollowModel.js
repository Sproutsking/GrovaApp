// ============================================================================
// src/models/FollowModel.js - FOLLOW/UNFOLLOW MODEL
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
  static async followUser(followerId, followingId) {
    try {
      // Check if already following
      const isAlreadyFollowing = await this.isFollowing(
        followerId,
        followingId,
      );
      if (isAlreadyFollowing) {
        return { success: false, message: "Already following" };
      }

      // Create follow relationship
      const { data, error } = await supabase
        .from("follows")
        .insert({
          follower_id: followerId,
          following_id: followingId,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment follower count
      await supabase.rpc("increment_follower_count", { user_id: followingId });

      // Award EP for following
      await supabase.rpc("award_ep", {
        p_user_id: followerId,
        p_amount: 5,
        p_reason: "followed_user",
      });

      return { success: true, data };
    } catch (error) {
      console.error("Error following user:", error);
      return { success: false, error: error.message };
    }
  }

  // Unfollow a user
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
        .select(
          `
          follower_id,
          created_at,
          profiles!follows_follower_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
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
        .select(
          `
          following_id,
          created_at,
          profiles!follows_following_id_fkey (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
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
}

export default FollowModel;
