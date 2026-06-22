// src/services/explore/cultureService.js — CULTURE DISCOVERY SERVICE
//
// ═══════════════════════════════════════════════════════════════════════════
// SERVICE: Manages Africa-first culture category discovery
//
// [CULT-1]  getCategories() — fetch all 20 culture categories
// [CULT-2]  getCategoryContent(categoryId, offset) — posts/reels/stories for category
// [CULT-3]  tagContentToCulture(contentType, contentId, categoryId) — map content
// [CULT-4]  getUserPreferences(userId) — load culture preferences
// [CULT-5]  updateUserPreferences(userId, categories, regionFocus) — save prefs
// [CULT-6]  getTrendingContent(period) — trending by period
// [CULT-7]  Real-time subscriptions to culture_engagement
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";

class CultureService {
  // ── [CULT-1] GET ALL CULTURE CATEGORIES ─────────────────────────────────
  async getCategories(filters = {}) {
    try {
      const { region = null, onlyActive = true } = filters;
      const cacheKey = `culture:categories:${region || "all"}:${onlyActive}`;

      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from("culture_categories")
        .select("id, name, emoji, slug, description, region, order_index, total_posts, total_views, engagement_score")
        .order("order_index", { ascending: true });

      if (onlyActive) query = query.eq("is_active", true);
      if (region) query = query.eq("region", region);

      const { data, error } = await query;

      if (error) {
        console.error("[CultureService] getCategories error:", error.message);
        return [];
      }

      const result = data || [];
      cacheService.set(cacheKey, result, 300000); // 5 min cache
      return result;
    } catch (error) {
      console.error("[CultureService] getCategories exception:", error.message);
      return [];
    }
  }

  // ── [CULT-2] GET CATEGORY CONTENT (Posts + Reels + Stories) ─────────────
  async getCategoryContent(categoryId, offset = 0, limit = 20) {
    try {
      if (!categoryId) return { posts: [], reels: [], stories: [] };

      const cacheKey = `culture:content:${categoryId}:${offset}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      // If an edge function URL is configured, prefer it (server-side does heavier joins)
      const EDGE_URL = process.env.REACT_APP_CULTURE_EDGE_URL || null;
      if (EDGE_URL) {
        try {
          const url = `${EDGE_URL.replace(/\/$/, '')}/content?category=${encodeURIComponent(categoryId)}&offset=${offset}&limit=${limit}`;
          const res = await fetch(url, { method: "GET", credentials: "include" });
          if (res.ok) {
            const payload = await res.json();
            cacheService.set(cacheKey, payload, 180000);
            return payload;
          }
        } catch (e) {
          console.error("[CultureService] edge fallback failed:", e.message);
        }
      }

      // Fetch culture_content mappings for this category
      const { data: mappings, error: mapError } = await supabase
        .from("culture_content")
        .select(`
          id, content_type, content_id, user_id,
          featured, featured_at, engagement_boost
        `)
        .eq("category_id", categoryId)
        .order("featured_at", { ascending: false, nullsLast: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (mapError) {
        console.error("[CultureService] getCategoryContent mappings error:", mapError.message);
        return { posts: [], reels: [], stories: [] };
      }

      if (!mappings || mappings.length === 0) {
        return { posts: [], reels: [], stories: [] };
      }

      // Group by content type & collect IDs
      const postIds = [];
      const reelIds = [];
      const storyIds = [];

      mappings.forEach(m => {
        if (m.content_type === "post") postIds.push(m.content_id);
        else if (m.content_type === "reel") reelIds.push(m.content_id);
        else if (m.content_type === "story") storyIds.push(m.content_id);
      });

      // Fetch actual content items in parallel
      const [postsResult, reelsResult, storiesResult] = await Promise.all([
        postIds.length > 0 ? this._getPostsByIds(postIds) : Promise.resolve([]),
        reelIds.length > 0 ? this._getReelsByIds(reelIds) : Promise.resolve([]),
        storyIds.length > 0 ? this._getStoriesByIds(storyIds) : Promise.resolve([]),
      ]);

      const result = {
        posts: postsResult,
        reels: reelsResult,
        stories: storiesResult,
      };

      cacheService.set(cacheKey, result, 180000); // 3 min cache
      return result;
    } catch (error) {
      console.error("[CultureService] getCategoryContent exception:", error.message);
      return { posts: [], reels: [], stories: [] };
    }
  }

  // ── Helper: Fetch posts by IDs ──────────────────────────────────────────
  async _getPostsByIds(postIds) {
    try {
      const { data } = await supabase
        .from("posts")
        .select(`
          id, user_id, content, image_ids, video_ids, category,
          likes, comments_count, shares, views, created_at,
          profiles:user_id(id, full_name, username, avatar_id, verified)
        `)
        .in("id", postIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data || [];
    } catch (e) {
      console.error("[CultureService] _getPostsByIds error:", e.message);
      return [];
    }
  }

  // ── Helper: Fetch reels by IDs ──────────────────────────────────────────
  async _getReelsByIds(reelIds) {
    try {
      const { data } = await supabase
        .from("reels")
        .select(`
          id, user_id, video_id, caption, category, duration,
          likes, comments_count, shares, views, created_at,
          profiles:user_id(id, full_name, username, avatar_id, verified)
        `)
        .in("id", reelIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data || [];
    } catch (e) {
      console.error("[CultureService] _getReelsByIds error:", e.message);
      return [];
    }
  }

  // ── Helper: Fetch stories by IDs ────────────────────────────────────────
  async _getStoriesByIds(storyIds) {
    try {
      const { data } = await supabase
        .from("stories")
        .select(`
          id, user_id, title, content, media_ids, category,
          likes, views, created_at,
          profiles:user_id(id, full_name, username, avatar_id, verified)
        `)
        .in("id", storyIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data || [];
    } catch (e) {
      console.error("[CultureService] _getStoriesByIds error:", e.message);
      return [];
    }
  }

  // ── [CULT-3] TAG CONTENT TO CULTURE CATEGORY ────────────────────────────
  async tagContentToCulture(contentType, contentId, categoryId, userId) {
    try {
      // Check if already tagged
      const { data: existing } = await supabase
        .from("culture_content")
        .select("id")
        .eq("content_type", contentType)
        .eq("content_id", contentId)
        .eq("category_id", categoryId)
        .maybeSingle();

      if (existing) return { success: true, alreadyExists: true };

      // Insert new tagging
      const { data, error } = await supabase
        .from("culture_content")
        .insert({
          content_type: contentType,
          content_id: contentId,
          category_id: categoryId,
          user_id: userId,
          engagement_boost: 1.0,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[CultureService] tagContentToCulture error:", error.message);
        throw error;
      }

      cacheService.invalidate("culture:content");
      return { success: true, id: data.id };
    } catch (error) {
      console.error("[CultureService] tagContentToCulture exception:", error.message);
      throw handleError(error, "Failed to tag content to culture category");
    }
  }

  // ── [CULT-4] GET USER CULTURE PREFERENCES ───────────────────────────────
  async getUserPreferences(userId) {
    try {
      if (!userId) return null;

      const cacheKey = `culture:preferences:${userId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("user_culture_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[CultureService] getUserPreferences error:", error.message);
        return null;
      }

      cacheService.set(cacheKey, data, 600000); // 10 min cache
      return data;
    } catch (error) {
      console.error("[CultureService] getUserPreferences exception:", error.message);
      return null;
    }
  }

  // ── [CULT-5] UPDATE USER CULTURE PREFERENCES ────────────────────────────
  async updateUserPreferences(userId, categoryIds = [], regionFocus = "both", discoverTrending = true) {
    try {
      if (!userId) throw new Error("userId is required");

      // Try to update existing, or insert if not exists
      const { data: existing } = await supabase
        .from("user_culture_preferences")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let result;
      if (existing) {
        // Update
        result = await supabase
          .from("user_culture_preferences")
          .update({
            categories: categoryIds,
            region_focus: regionFocus,
            discover_trending: discoverTrending,
            last_updated: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select()
          .single();
      } else {
        // Insert
        result = await supabase
          .from("user_culture_preferences")
          .insert({
            user_id: userId,
            categories: categoryIds,
            region_focus: regionFocus,
            discover_trending: discoverTrending,
          })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      cacheService.invalidate(`culture:preferences:${userId}`);
      return result.data;
    } catch (error) {
      console.error("[CultureService] updateUserPreferences error:", error.message);
      throw handleError(error, "Failed to update culture preferences");
    }
  }

  // ── [CULT-6] GET TRENDING CULTURE CONTENT ───────────────────────────────
  async getTrendingContent(period = "week", limit = 20) {
    try {
      const cacheKey = `culture:trending:${period}:${limit}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("culture_trending")
        .select(`
          id, category_id, content_type, content_id, rank, score,
          culture_categories:category_id(id, name, emoji)
        `)
        .eq("period", period)
        .order("rank", { ascending: true })
        .limit(limit);

      if (error) {
        console.error("[CultureService] getTrendingContent error:", error.message);
        return [];
      }

      const result = data || [];
      cacheService.set(cacheKey, result, 300000); // 5 min cache
      return result;
    } catch (error) {
      console.error("[CultureService] getTrendingContent exception:", error.message);
      return [];
    }
  }

  // ── [CULT-7] TRACK ENGAGEMENT ───────────────────────────────────────────
  async trackEngagement(userId, contentId, categoryId, action = "view") {
    try {
      if (!userId || !contentId || !categoryId) return;

      // Optimistic insertion — don't wait for response
      supabase
        .from("culture_engagement")
        .insert({
          user_id: userId,
          content_id: contentId,
          category_id: categoryId,
          action: action, // "view", "like", "share", "save", "comment"
          weight: action === "like" ? 5 : action === "share" ? 3 : 1,
        })
        .then(() => {
          cacheService.invalidate("culture:trending");
          cacheService.invalidate(`culture:content:${categoryId}`);
        })
        .catch(e => console.error("[CultureService] trackEngagement error:", e.message));
    } catch (error) {
      console.error("[CultureService] trackEngagement exception:", error.message);
    }
  }

  // ── [CULT-7] SUBSCRIBE TO CULTURE ENGAGEMENT (Real-time) ────────────────
  subscribeToEngagement(categoryId, callback) {
    try {
      const subscription = supabase
        .channel(`culture:engagement:${categoryId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "culture_engagement", filter: `category_id=eq.${categoryId}` },
          (payload) => {
            callback?.(payload);
            cacheService.invalidate("culture:trending");
          }
        )
        .subscribe();

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error("[CultureService] subscribeToEngagement error:", error.message);
      return () => {};
    }
  }

  // ── Invalidate all culture caches ───────────────────────────────────────
  invalidateCache() {
    cacheService.invalidate("culture:");
  }
}

const cultureService = new CultureService();
export default cultureService;
