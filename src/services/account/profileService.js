// src/services/account/profileService.js - COMPLETE WITH CLOUDINARY SUPPORT
import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import mediaUrlService from "../shared/mediaUrlService";

class ProfileService {
  // Get user profile
  async getProfile(userId) {
    try {
      console.log("📊 Loading profile for user:", userId);

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        throw new Error("Profile not found");
      }

      // Get wallet data
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (walletError) {
        console.error("Wallet fetch error:", walletError);
      }

      // Get content stats
      const stats = await this.getProfileStats(userId);

      // Generate avatar URL from Cloudinary
      const avatarUrl = profileData.avatar_id
        ? mediaUrlService.getAvatarUrl(profileData.avatar_id, 400)
        : null;

      console.log("✅ Profile loaded:", {
        id: profileData.id,
        fullName: profileData.full_name,
        username: profileData.username,
        avatarId: profileData.avatar_id,
        avatar: avatarUrl,
      });

      return {
        id: profileData.id,
        fullName: profileData.full_name,
        username: profileData.username,
        email: profileData.email,
        bio: profileData.bio || "",
        avatar: avatarUrl,
        avatarId: profileData.avatar_id,
        verified: profileData.verified || false,
        isPro: profileData.is_pro || false,
        createdAt: profileData.created_at,
        wallet: {
          grovaTokens: walletData?.grova_tokens || 0,
          engagementPoints: walletData?.engagement_points || 0,
        },
        stats: {
          totalContent:
            stats.totalPosts + stats.totalReels + stats.totalStories,
          totalPosts: stats.totalPosts,
          totalReels: stats.totalReels,
          totalStories: stats.totalStories,
          totalViews: stats.totalViews,
          totalComments: stats.totalComments,
        },
      };
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      throw handleError(error, "Failed to fetch profile");
    }
  }

  // Get profile stats
  async getProfileStats(userId) {
    try {
      const [posts, reels, stories] = await Promise.allSettled([
        supabase
          .from("posts")
          .select("likes, comments_count, shares, views", { count: "exact" })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("reels")
          .select("likes, comments_count, shares, views", { count: "exact" })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("stories")
          .select("likes, comments_count, views", { count: "exact" })
          .eq("user_id", userId)
          .is("deleted_at", null),
      ]);

      let totalViews = 0;
      let totalComments = 0;

      // Sum up posts
      if (posts.status === "fulfilled" && posts.value.data) {
        posts.value.data.forEach((p) => {
          totalViews += p.views || 0;
          totalComments += p.comments_count || 0;
        });
      }

      // Sum up reels
      if (reels.status === "fulfilled" && reels.value.data) {
        reels.value.data.forEach((r) => {
          totalViews += r.views || 0;
          totalComments += r.comments_count || 0;
        });
      }

      // Sum up stories
      if (stories.status === "fulfilled" && stories.value.data) {
        stories.value.data.forEach((s) => {
          totalViews += s.views || 0;
          totalComments += s.comments_count || 0;
        });
      }

      return {
        totalPosts: posts.status === "fulfilled" ? posts.value.count || 0 : 0,
        totalReels: reels.status === "fulfilled" ? reels.value.count || 0 : 0,
        totalStories:
          stories.status === "fulfilled" ? stories.value.count || 0 : 0,
        totalViews,
        totalComments,
      };
    } catch (error) {
      console.error("Failed to get profile stats:", error);
      return {
        totalPosts: 0,
        totalReels: 0,
        totalStories: 0,
        totalViews: 0,
        totalComments: 0,
      };
    }
  }

  // Update profile
  async updateProfile(userId, updates) {
    try {
      console.log("📝 Updating profile:", userId, updates);

      const allowedFields = ["full_name", "username", "bio", "avatar_id"];
      const filteredUpdates = {};

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("profiles")
        .update(filteredUpdates)
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        console.error("❌ Update error:", error);
        throw error;
      }

      console.log("✅ Profile updated successfully");
      return data;
    } catch (error) {
      console.error("❌ Update failed:", error);
      throw handleError(error, "Failed to update profile");
    }
  }

  // Get elite creators
  async getEliteCreators() {
    try {
      const { data, error } = await supabase
        .from("ep_dashboard")
        .select(
          `
          user_id,
          total_ep_earned,
          profiles!inner (
            full_name,
            username,
            avatar_id,
            verified
          )
        `,
        )
        .order("total_ep_earned", { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map((creator, index) => {
        const profile = creator.profiles;
        return {
          rank: index + 1,
          userId: creator.user_id,
          name: profile?.full_name || "Unknown User",
          username: profile?.username || "@unknown",
          avatar: profile?.avatar_id
            ? mediaUrlService.getAvatarUrl(profile.avatar_id, 200)
            : null,
          verified: profile?.verified || false,
          totalEarnings: creator.total_ep_earned || 0,
        };
      });
    } catch (error) {
      console.error("Failed to get elite creators:", error);
      return [];
    }
  }

  // Get user's content (posts, reels, stories)
  async getUserContent(userId, type = "all") {
    try {
      const content = [];

      if (type === "all" || type === "posts") {
        const { data: posts } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (posts) content.push(...posts.map((p) => ({ ...p, type: "post" })));
      }

      if (type === "all" || type === "reels") {
        const { data: reels } = await supabase
          .from("reels")
          .select("*")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (reels) content.push(...reels.map((r) => ({ ...r, type: "reel" })));
      }

      if (type === "all" || type === "stories") {
        const { data: stories } = await supabase
          .from("stories")
          .select("*")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (stories)
          content.push(...stories.map((s) => ({ ...s, type: "story" })));
      }

      // Sort by created_at if getting all
      if (type === "all") {
        content.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      return content;
    } catch (error) {
      console.error("Failed to get user content:", error);
      return [];
    }
  }
}

const profileService = new ProfileService();

export default profileService;
