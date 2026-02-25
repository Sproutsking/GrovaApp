// ============================================================================
// src/services/explore/exploreService.js - ULTIMATE SEARCH ENGINE
// Integrates TagModel for user-name search, mentions, and author content
// ============================================================================

import { supabase } from "../config/supabase";
import { handleError } from "../shared/errorHandler";
import cacheService from "../shared/cacheService";
import tagModel, { detectTagType, TAG_TYPE } from "../../models/TagModel";

class ExploreService {
  // ══════════════════════════════════════════════════════════════════════
  // SELECT BUILDERS — full DB-row shape with reaction state
  // ══════════════════════════════════════════════════════════════════════

  _postSelect(currentUserId) {
    return `
      id, user_id, content,
      image_ids, image_metadata,
      video_ids, video_metadata,
      is_text_card, text_card_metadata, card_caption,
      category, likes, comments_count, shares, views, created_at, updated_at,
      profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
      ${currentUserId ? "post_likes!left(id, user_id)" : "post_likes!left(id)"}
    `;
  }

  _reelSelect(currentUserId) {
    return `
      id, user_id,
      video_id, video_metadata, thumbnail_id,
      caption, music, category, duration,
      likes, comments_count, shares, views, created_at,
      profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
      ${currentUserId ? "reel_likes!left(id, user_id)" : "reel_likes!left(id)"}
    `;
  }

  _storySelect(currentUserId) {
    return `
      id, user_id,
      title, preview, full_content,
      cover_image_id, cover_image_metadata,
      category, unlock_cost, max_accesses, current_accesses,
      likes, comments_count, views, created_at,
      profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
      ${currentUserId ? "story_likes!left(id, user_id)" : "story_likes!left(id)"},
      ${currentUserId ? "unlocked_stories!left(id, user_id)" : "unlocked_stories!left(id)"}
    `;
  }

  // ══════════════════════════════════════════════════════════════════════
  // UNIVERSAL SEARCH
  // ══════════════════════════════════════════════════════════════════════

  async searchAll(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;

      if (!query || query.trim().length < 2) {
        return {
          stories: [],
          posts: [],
          reels: [],
          users: [],
          tags: [],
          mentions: [],
          userContext: null,
        };
      }

      const searchTerm = query.trim();
      const tagType = detectTagType(searchTerm);
      const cacheKey = `search:all:${searchTerm.toLowerCase()}:${category || "all"}:${currentUserId || "anon"}`;

      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      let results = {
        stories: [],
        posts: [],
        reels: [],
        users: [],
        tags: [],
        mentions: [],
        userContext: null,
        query: searchTerm,
        searchType: tagType,
      };

      if (tagType === TAG_TYPE.HASHTAG) {
        // ── Hashtag search ──────────────────────────────────────────────
        const [tags, posts, reels, stories] = await Promise.all([
          this.searchTags(searchTerm, { limit: 15 }),
          this.searchPostsByHashtag(
            searchTerm,
            { category, limit: 15 },
            currentUserId,
          ),
          this.searchReelsByHashtag(
            searchTerm,
            { category, limit: 15 },
            currentUserId,
          ),
          this.searchStoriesByHashtag(
            searchTerm,
            { category, limit: 10 },
            currentUserId,
          ),
        ]);
        results = { ...results, tags, posts, reels, stories };
      } else if (tagType === TAG_TYPE.MENTION) {
        // ── @mention search ─────────────────────────────────────────────
        const [users, posts, reels, stories] = await Promise.all([
          this.searchUsersByMention(searchTerm, { limit: 15 }),
          this.searchPostsByMention(
            searchTerm,
            { category, limit: 15 },
            currentUserId,
          ),
          this.searchReelsByMention(
            searchTerm,
            { category, limit: 15 },
            currentUserId,
          ),
          this.searchStoriesByMention(
            searchTerm,
            { category, limit: 10 },
            currentUserId,
          ),
        ]);
        results = { ...results, users, posts, reels, stories, mentions: users };

        // Enrich with user context (content mentioning the top matched user)
        if (users.length > 0) {
          const top = users[0];
          results.userContext = await this._buildUserContext(
            top,
            currentUserId,
          );
        }
      } else {
        // ── General / name search ───────────────────────────────────────
        const [stories, posts, reels, users, tags] = await Promise.all([
          this.searchStories(
            searchTerm,
            { category, limit: 12 },
            currentUserId,
          ),
          this.searchPosts(searchTerm, { category, limit: 12 }, currentUserId),
          this.searchReels(searchTerm, { category, limit: 12 }, currentUserId),
          this.searchUsers(searchTerm, { limit: 12 }),
          this.searchTags(searchTerm, { limit: 10 }),
        ]);
        results = { ...results, stories, posts, reels, users, tags };

        // ── KEY EXTENSION: if we found real users, show their world ─────
        if (users.length > 0) {
          const top = users[0];
          results.userContext = await this._buildUserContext(
            top,
            currentUserId,
          );
        }
      }

      results.totalResults =
        (results.stories?.length || 0) +
        (results.posts?.length || 0) +
        (results.reels?.length || 0) +
        (results.users?.length || 0) +
        (results.tags?.length || 0);

      cacheService.set(cacheKey, results, 60000);
      return results;
    } catch (error) {
      console.error("❌ searchAll failed:", error);
      throw handleError(error, "Search");
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // USER CONTEXT BUILDER
  // When a real user is found, we pull:
  //   • content they authored
  //   • content that mentions them by @username or their real name
  // ══════════════════════════════════════════════════════════════════════

  async _buildUserContext(userRow, currentUserId) {
    try {
      const [mentionData, authorData] = await Promise.all([
        tagModel.getContentMentioningUser(
          userRow.username,
          userRow.full_name,
          10,
          currentUserId,
        ),
        tagModel.getContentByUser(userRow.id, 10, currentUserId),
      ]);

      const totalMentions =
        (mentionData.mentionedInPosts?.length || 0) +
        (mentionData.mentionedInReels?.length || 0) +
        (mentionData.mentionedInStories?.length || 0);

      const totalAuthored =
        (authorData.posts?.length || 0) +
        (authorData.reels?.length || 0) +
        (authorData.stories?.length || 0);

      return {
        resolvedUser: userRow,
        // content other people posted ABOUT / MENTIONING this user
        mentionedInPosts: mentionData.mentionedInPosts || [],
        mentionedInReels: mentionData.mentionedInReels || [],
        mentionedInStories: mentionData.mentionedInStories || [],
        totalMentions,
        // content the user themselves created
        byUser: {
          posts: authorData.posts || [],
          reels: authorData.reels || [],
          stories: authorData.stories || [],
        },
        totalAuthored,
      };
    } catch (err) {
      console.error("_buildUserContext error:", err);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // POSTS
  // ══════════════════════════════════════════════════════════════════════

  async searchPosts(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, "");

      let q = supabase
        .from("posts")
        .select(this._postSelect(currentUserId))
        .is("deleted_at", null)
        .ilike("content", `%${cleanQuery}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) q = q.eq("post_likes.user_id", currentUserId);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Post search failed:", error);
      return [];
    }
  }

  async searchPostsByHashtag(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const hashtag = query.startsWith("#") ? query : `#${query}`;

      let q = supabase
        .from("posts")
        .select(this._postSelect(currentUserId))
        .is("deleted_at", null)
        .ilike("content", `%${hashtag}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) q = q.eq("post_likes.user_id", currentUserId);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Post hashtag search failed:", error);
      return [];
    }
  }

  async searchPostsByMention(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const mention = query.startsWith("@") ? query : `@${query}`;

      let q = supabase
        .from("posts")
        .select(this._postSelect(currentUserId))
        .is("deleted_at", null)
        .ilike("content", `%${mention}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) q = q.eq("post_likes.user_id", currentUserId);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Post mention search failed:", error);
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // REELS
  // ══════════════════════════════════════════════════════════════════════

  async searchReels(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, "");

      let q = supabase
        .from("reels")
        .select(this._reelSelect(currentUserId))
        .is("deleted_at", null)
        .or(`caption.ilike.%${cleanQuery}%,music.ilike.%${cleanQuery}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) q = q.eq("reel_likes.user_id", currentUserId);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Reel search failed:", error);
      return [];
    }
  }

  async searchReelsByHashtag(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const hashtag = query.startsWith("#") ? query : `#${query}`;

      let q = supabase
        .from("reels")
        .select(this._reelSelect(currentUserId))
        .is("deleted_at", null)
        .ilike("caption", `%${hashtag}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) q = q.eq("reel_likes.user_id", currentUserId);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Reel hashtag search failed:", error);
      return [];
    }
  }

  async searchReelsByMention(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const mention = query.startsWith("@") ? query : `@${query}`;

      let q = supabase
        .from("reels")
        .select(this._reelSelect(currentUserId))
        .is("deleted_at", null)
        .ilike("caption", `%${mention}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) q = q.eq("reel_likes.user_id", currentUserId);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Reel mention search failed:", error);
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // STORIES
  // ══════════════════════════════════════════════════════════════════════

  async searchStories(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, "");

      let q = supabase
        .from("stories")
        .select(this._storySelect(currentUserId))
        .is("deleted_at", null)
        .or(
          `title.ilike.%${cleanQuery}%,preview.ilike.%${cleanQuery}%,full_content.ilike.%${cleanQuery}%`,
        );

      if (category) q = q.eq("category", category);
      if (currentUserId) {
        q = q.eq("story_likes.user_id", currentUserId);
        q = q.eq("unlocked_stories.user_id", currentUserId);
      }

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Story search failed:", error);
      return [];
    }
  }

  async searchStoriesByHashtag(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const hashtag = query.startsWith("#") ? query : `#${query}`;

      let q = supabase
        .from("stories")
        .select(this._storySelect(currentUserId))
        .is("deleted_at", null)
        .or(`preview.ilike.%${hashtag}%,full_content.ilike.%${hashtag}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) {
        q = q.eq("story_likes.user_id", currentUserId);
        q = q.eq("unlocked_stories.user_id", currentUserId);
      }

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Story hashtag search failed:", error);
      return [];
    }
  }

  async searchStoriesByMention(query, filters = {}, currentUserId = null) {
    try {
      const { category, limit = 20 } = filters;
      const mention = query.startsWith("@") ? query : `@${query}`;

      let q = supabase
        .from("stories")
        .select(this._storySelect(currentUserId))
        .is("deleted_at", null)
        .ilike("preview", `%${mention}%`);

      if (category) q = q.eq("category", category);
      if (currentUserId) {
        q = q.eq("story_likes.user_id", currentUserId);
        q = q.eq("unlocked_stories.user_id", currentUserId);
      }

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Story mention search failed:", error);
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════════════════════════════

  async searchUsers(query, filters = {}) {
    try {
      const { limit = 20 } = filters;
      const cleanQuery = query.replace(/^[@#]/, "").trim();
      if (cleanQuery.length < 2) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_id, avatar_metadata, verified, bio",
        )
        .is("deleted_at", null)
        .or(
          `full_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%,bio.ilike.%${cleanQuery}%`,
        )
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ User search failed:", error);
      return [];
    }
  }

  async searchUsersByMention(query, filters = {}) {
    try {
      const { limit = 20 } = filters;
      const username = query.replace("@", "").trim();
      if (username.length < 2) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_id, avatar_metadata, verified, bio",
        )
        .is("deleted_at", null)
        .ilike("username", `%${username}%`)
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ User mention search failed:", error);
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAGS
  // ══════════════════════════════════════════════════════════════════════

  async searchTags(query, filters = {}) {
    try {
      const { limit = 15 } = filters;
      const hashtag = query.startsWith("#")
        ? query.toLowerCase()
        : `#${query.toLowerCase()}`;
      if (hashtag.length < 3) return [];

      const [postTags, reelTags, storyTags] = await Promise.all([
        this._extractTagsFromPosts(hashtag, limit * 2),
        this._extractTagsFromReels(hashtag, limit * 2),
        this._extractTagsFromStories(hashtag, limit * 2),
      ]);

      const tagCounts = {};
      [...postTags, ...reelTags, ...storyTags].forEach((tag) => {
        const t = tag.toLowerCase();
        if (t.includes(hashtag.toLowerCase())) {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      });

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count, type: "tag" }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error("❌ Tag search failed:", error);
      return [];
    }
  }

  async _extractTagsFromPosts(query, limit = 20) {
    try {
      const { data } = await supabase
        .from("posts")
        .select("content")
        .ilike("content", `%${query}%`)
        .is("deleted_at", null)
        .limit(limit);
      return this._extractHashtags(data?.map((p) => p.content).join(" ") || "");
    } catch {
      return [];
    }
  }

  async _extractTagsFromReels(query, limit = 20) {
    try {
      const { data } = await supabase
        .from("reels")
        .select("caption")
        .ilike("caption", `%${query}%`)
        .is("deleted_at", null)
        .limit(limit);
      return this._extractHashtags(data?.map((r) => r.caption).join(" ") || "");
    } catch {
      return [];
    }
  }

  async _extractTagsFromStories(query, limit = 20) {
    try {
      const { data } = await supabase
        .from("stories")
        .select("preview")
        .ilike("preview", `%${query}%`)
        .is("deleted_at", null)
        .limit(limit);
      return this._extractHashtags(data?.map((s) => s.preview).join(" ") || "");
    } catch {
      return [];
    }
  }

  _extractHashtags(text) {
    if (!text) return [];
    const matches = text.match(/#[\w]+/g) || [];
    return Array.from(new Set(matches.map((t) => t.toLowerCase())));
  }

  // ══════════════════════════════════════════════════════════════════════
  // TRENDING
  // ══════════════════════════════════════════════════════════════════════

  async getTrending(contentType = "all", limit = 20, currentUserId = null) {
    try {
      const cacheKey = `trending:${contentType}:${limit}:${currentUserId || "anon"}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;

      const results = {};
      const since = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      if (contentType === "all" || contentType === "stories") {
        const { data } = await supabase
          .from("stories")
          .select(this._storySelect(currentUserId))
          .is("deleted_at", null)
          .gte("created_at", since)
          .order("views", { ascending: false })
          .limit(limit);
        results.stories = data || [];
      }

      if (contentType === "all" || contentType === "posts") {
        const { data } = await supabase
          .from("posts")
          .select(this._postSelect(currentUserId))
          .is("deleted_at", null)
          .gte("created_at", since)
          .order("likes", { ascending: false })
          .limit(limit);
        results.posts = data || [];
      }

      if (contentType === "all" || contentType === "reels") {
        const { data } = await supabase
          .from("reels")
          .select(this._reelSelect(currentUserId))
          .is("deleted_at", null)
          .gte("created_at", since)
          .order("views", { ascending: false })
          .limit(limit);
        results.reels = data || [];
      }

      cacheService.set(cacheKey, results, 300000);
      return results;
    } catch (error) {
      throw handleError(error, "Get trending content");
    }
  }
}

export default new ExploreService();
