// src/services/account/profileService.js — FIXED v2
//
// BUGS FIXED:
//
//  BUG 1: getProfile() used .single() on profiles AND wallets.
//  .single() throws PGRST116 when row is missing or RLS blocks it.
//  For new Google OAuth users, wallet row may not exist yet.
//  FIX: Both queries use .maybeSingle() + graceful null handling.
//
//  BUG 2: getProfile() threw "Profile not found" error which crashed
//  the entire account tab for any user whose profile was still being created.
//  FIX: Returns a safe default object instead of throwing.
//
//  BUG 3: getProfileStats() was fire-and-forget on errors — this was fine,
//  but it didn't handle the case where data was null (not just empty array).
//  FIX: Added null guards on every .data access.

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import mediaUrlService from "../shared/mediaUrlService";

class ProfileService {
  async getProfile(userId) {
    try {
      console.log("📊 ProfileService: Loading profile for user:", userId);

      // FIX: maybeSingle() — never throws on missing row or RLS block
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(); // ← was .single() — threw PGRST116

      if (profileError) {
        console.warn(
          "⚠️ ProfileService: Profile query error:",
          profileError.message,
        );
        // Return a safe stub — don't throw, let the UI render with defaults
        return this._defaultProfile(userId);
      }

      if (!profileData) {
        console.warn("⚠️ ProfileService: No profile row for user:", userId);
        return this._defaultProfile(userId);
      }

      // FIX: maybeSingle() on wallet — wallet row may not exist for new OAuth users
      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(); // ← was .single() — crashed for users with no wallet row

      // Stats — all parallel, all graceful
      const stats = await this.getProfileStats(userId);

      // Avatar URL
      const avatarUrl = profileData.avatar_id
        ? mediaUrlService.getAvatarUrl(profileData.avatar_id, 400)
        : null;

      console.log("✅ ProfileService: Profile loaded:", {
        id: profileData.id,
        fullName: profileData.full_name,
        username: profileData.username,
      });

      return {
        id: profileData.id,
        fullName: profileData.full_name || "Xeevia User",
        username: profileData.username || "user",
        email: profileData.email,
        bio: profileData.bio || "",
        avatar: avatarUrl,
        avatarId: profileData.avatar_id,
        verified: profileData.verified || false,
        isPro: profileData.is_pro || false,
        createdAt: profileData.created_at,
        wallet: {
          grovaTokens: walletData?.grova_tokens ?? 0,
          engagementPoints: walletData?.engagement_points ?? 0,
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
      console.error("❌ ProfileService: Failed to fetch profile:", error);
      // Never throw — return safe defaults so UI doesn't crash
      return this._defaultProfile(userId);
    }
  }

  /** Safe default when profile row is missing or query fails */
  _defaultProfile(userId) {
    return {
      id: userId,
      fullName: "Xeevia User",
      username: "user",
      email: null,
      bio: "",
      avatar: null,
      avatarId: null,
      verified: false,
      isPro: false,
      createdAt: new Date().toISOString(),
      wallet: { grovaTokens: 0, engagementPoints: 0 },
      stats: {
        totalContent: 0,
        totalPosts: 0,
        totalReels: 0,
        totalStories: 0,
        totalViews: 0,
        totalComments: 0,
      },
    };
  }

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

      if (posts.status === "fulfilled" && Array.isArray(posts.value.data)) {
        posts.value.data.forEach((p) => {
          totalViews += p.views || 0;
          totalComments += p.comments_count || 0;
        });
      }
      if (reels.status === "fulfilled" && Array.isArray(reels.value.data)) {
        reels.value.data.forEach((r) => {
          totalViews += r.views || 0;
          totalComments += r.comments_count || 0;
        });
      }
      if (stories.status === "fulfilled" && Array.isArray(stories.value.data)) {
        stories.value.data.forEach((s) => {
          totalViews += s.views || 0;
          totalComments += s.comments_count || 0;
        });
      }

      return {
        totalPosts: posts.status === "fulfilled" ? (posts.value.count ?? 0) : 0,
        totalReels: reels.status === "fulfilled" ? (reels.value.count ?? 0) : 0,
        totalStories:
          stories.status === "fulfilled" ? (stories.value.count ?? 0) : 0,
        totalViews,
        totalComments,
      };
    } catch (error) {
      console.error("⚠️ ProfileService: Stats fetch error:", error);
      return {
        totalPosts: 0,
        totalReels: 0,
        totalStories: 0,
        totalViews: 0,
        totalComments: 0,
      };
    }
  }

  async updateProfile(userId, updates) {
    try {
      console.log("📝 ProfileService: Updating profile:", userId);

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

      if (error) throw error;
      console.log("✅ ProfileService: Profile updated");
      return data;
    } catch (error) {
      throw handleError(error, "Failed to update profile");
    }
  }

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
          username: profile?.username || "unknown",
          avatar: profile?.avatar_id
            ? mediaUrlService.getAvatarUrl(profile.avatar_id, 200)
            : null,
          verified: profile?.verified || false,
          totalEarnings: creator.total_ep_earned || 0,
        };
      });
    } catch (error) {
      console.error("⚠️ ProfileService: Elite creators fetch error:", error);
      return [];
    }
  }

  async getUserContent(userId, type = "all") {
    try {
      const fetches = [];

      if (type === "all" || type === "posts") {
        fetches.push(
          supabase
            .from("posts")
            .select("*")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .then(({ data }) =>
              (data || []).map((p) => ({ ...p, type: "post" })),
            ),
        );
      }
      if (type === "all" || type === "reels") {
        fetches.push(
          supabase
            .from("reels")
            .select("*")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .then(({ data }) =>
              (data || []).map((r) => ({ ...r, type: "reel" })),
            ),
        );
      }
      if (type === "all" || type === "stories") {
        fetches.push(
          supabase
            .from("stories")
            .select("*")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .then(({ data }) =>
              (data || []).map((s) => ({ ...s, type: "story" })),
            ),
        );
      }

      const results = await Promise.allSettled(fetches);
      const content = results.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );

      if (type === "all") {
        content.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      return content;
    } catch (error) {
      console.error("⚠️ ProfileService: getUserContent error:", error);
      return [];
    }
  }
}

const profileService = new ProfileService();
export default profileService;
