// ============================================================================
// src/services/social/followService.js - OPTIMIZED WITH INSTANT UI UPDATES
// ============================================================================

import FollowModel from "../../models/FollowModel";
import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";

class FollowService {
  async isFollowing(followerId, followingId) {
    try {
      return await FollowModel.isFollowing(followerId, followingId);
    } catch (error) {
      throw handleError(error, "Failed to check follow status");
    }
  }

  async followUser(followerId, followingId) {
    try {
      if (followerId === followingId) {
        throw new Error("Cannot follow yourself");
      }

      const result = await FollowModel.followUser(followerId, followingId);

      if (!result.success) {
        throw new Error(result.message || "Failed to follow user");
      }

      return result;
    } catch (error) {
      throw handleError(error, "Failed to follow user");
    }
  }

  async unfollowUser(followerId, followingId) {
    try {
      const result = await FollowModel.unfollowUser(followerId, followingId);

      if (!result.success) {
        throw new Error("Failed to unfollow user");
      }

      return result;
    } catch (error) {
      throw handleError(error, "Failed to unfollow user");
    }
  }

  async getFollowerCount(userId) {
    try {
      return await FollowModel.getFollowerCount(userId);
    } catch (error) {
      console.error("Error getting follower count:", error);
      return 0;
    }
  }

  async getFollowingCount(userId) {
    try {
      return await FollowModel.getFollowingCount(userId);
    } catch (error) {
      console.error("Error getting following count:", error);
      return 0;
    }
  }

  async getFollowers(userId, limit = 20) {
    try {
      return await FollowModel.getFollowers(userId, limit);
    } catch (error) {
      console.error("Error getting followers:", error);
      return [];
    }
  }

  async getFollowing(userId, limit = 20) {
    try {
      return await FollowModel.getFollowing(userId, limit);
    } catch (error) {
      console.error("Error getting following:", error);
      return [];
    }
  }

  async getMutualFollowers(userId, limit = 20) {
    try {
      const { data: following, error: followingError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      if (followingError) throw followingError;

      if (!following || following.length === 0) {
        return [];
      }

      const followingIds = following.map((f) => f.following_id);

      const { data: mutualFollowers, error: mutualError } = await supabase
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

  async isMutualFollow(userId1, userId2) {
    try {
      const [user1FollowsUser2, user2FollowsUser1] = await Promise.all([
        this.isFollowing(userId1, userId2),
        this.isFollowing(userId2, userId1),
      ]);

      return user1FollowsUser2 && user2FollowsUser1;
    } catch (error) {
      console.error("Error checking mutual follow:", error);
      return false;
    }
  }

  async getFollowStats(userId) {
    try {
      const [followers, following, mutuals] = await Promise.all([
        this.getFollowerCount(userId),
        this.getFollowingCount(userId),
        this.getMutualFollowers(userId, 1000),
      ]);

      return {
        followers,
        following,
        mutuals: mutuals.length,
      };
    } catch (error) {
      console.error("Error getting follow stats:", error);
      return {
        followers: 0,
        following: 0,
        mutuals: 0,
      };
    }
  }
}

const followService = new FollowService();

export default followService;
