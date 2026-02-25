// ============================================================================
// src/services/explore/tagService.js
// Platform Tag Service — wraps TagModel with caching and error handling
// ============================================================================

import tagModel, {
  TAG_TYPE,
  detectTagType,
  normaliseTag,
} from "../../models/TagModel";
import cacheService from "../shared/cacheService";
import { handleError } from "../shared/errorHandler";

class TagService {
  // ══════════════════════════════════════════════════════════════════════
  // SEARCH
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Smart tag search — automatically routes to hashtag, mention, or name search.
   * Returns { type, tags, users, userContent }
   */
  async search(rawQuery, currentUserId = null) {
    const query = normaliseTag(rawQuery);
    const type = detectTagType(query);

    const cacheKey = `tag:search:${query}:${currentUserId || "anon"}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    let result = { type, query, tags: [], users: [], userContent: null };

    try {
      if (type === TAG_TYPE.HASHTAG) {
        result.tags = await tagModel.searchTags(query, 20);
      } else if (type === TAG_TYPE.MENTION) {
        // Find users whose username matches the @handle
        const { supabase } = await import("../config/supabase");
        const handle = query.replace("@", "");
        const { data } = await supabase
          .from("profiles")
          .select(
            "id, full_name, username, avatar_id, avatar_metadata, verified, bio",
          )
          .is("deleted_at", null)
          .ilike("username", `%${handle}%`)
          .limit(10);

        result.users = data || [];

        // Also fetch content that mentions these users
        if (result.users.length > 0) {
          const topUser = result.users[0];
          result.userContent = await tagModel.getContentMentioningUser(
            topUser.username,
            topUser.full_name,
            10,
            currentUserId,
          );
        }
      } else {
        // Plain name search — find users by full_name OR username
        const { supabase } = await import("../config/supabase");
        const { data } = await supabase
          .from("profiles")
          .select(
            "id, full_name, username, avatar_id, avatar_metadata, verified, bio",
          )
          .is("deleted_at", null)
          .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
          .limit(10);

        result.users = data || [];

        // For any matched user, fetch content mentioning OR authored by them
        if (result.users.length > 0) {
          const topUser = result.users[0];
          const [mentionData, authorData] = await Promise.all([
            tagModel.getContentMentioningUser(
              topUser.username,
              topUser.full_name,
              8,
              currentUserId,
            ),
            tagModel.getContentByUser(topUser.id, 8, currentUserId),
          ]);
          result.userContent = {
            ...mentionData,
            byUser: authorData,
            resolvedUser: topUser,
          };
        }

        // Also search tags that contain this name
        result.tags = await tagModel.searchTags(`#${query}`, 10);
      }

      cacheService.set(cacheKey, result, 60000);
      return result;
    } catch (err) {
      console.error("TagService.search error:", err);
      throw handleError(err, "Tag search");
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // TRENDING
  // ══════════════════════════════════════════════════════════════════════

  async getTrending(limit = 10, days = 7) {
    const cacheKey = `tag:trending:${limit}:${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await tagModel.getTrending(limit, days);
      cacheService.set(cacheKey, result, 300000); // 5 min
      return result;
    } catch (err) {
      console.error("TagService.getTrending error:", err);
      return { hashtags: [], mentions: [] };
    }
  }

  async getTrendingHashtags(limit = 10, days = 7) {
    const cacheKey = `tag:trending:hashtags:${limit}:${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await tagModel.getTrendingHashtags(limit, days);
      cacheService.set(cacheKey, result, 300000);
      return result;
    } catch (err) {
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // HASHTAG FEED
  // ══════════════════════════════════════════════════════════════════════

  async getHashtagFeed(hashtag, limit = 20, currentUserId = null) {
    const tag = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
    const cacheKey = `tag:feed:${tag}:${limit}:${currentUserId || "anon"}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await tagModel.getContentForHashtag(
        tag,
        limit,
        currentUserId,
      );
      cacheService.set(cacheKey, result, 60000);
      return result;
    } catch (err) {
      console.error("TagService.getHashtagFeed error:", err);
      return { posts: [], reels: [], stories: [], tag, count: 0 };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // USER TAG CONTENT
  // ══════════════════════════════════════════════════════════════════════

  /**
   * All content mentioning a specific user (by @username or name).
   */
  async getMentionsOfUser(
    username,
    fullName,
    limit = 20,
    currentUserId = null,
  ) {
    const cacheKey = `tag:mentions:${username}:${currentUserId || "anon"}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await tagModel.getContentMentioningUser(
        username,
        fullName,
        limit,
        currentUserId,
      );
      cacheService.set(cacheKey, result, 60000);
      return result;
    } catch (err) {
      console.error("TagService.getMentionsOfUser error:", err);
      return {
        mentionedInPosts: [],
        mentionedInReels: [],
        mentionedInStories: [],
      };
    }
  }

  /**
   * All content authored by a specific user.
   */
  async getContentByUser(userId, limit = 20, currentUserId = null) {
    const cacheKey = `tag:by-user:${userId}:${currentUserId || "anon"}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await tagModel.getContentByUser(
        userId,
        limit,
        currentUserId,
      );
      cacheService.set(cacheKey, result, 60000);
      return result;
    } catch (err) {
      console.error("TagService.getContentByUser error:", err);
      return { posts: [], reels: [], stories: [] };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // PARSING UTILITIES (pass-throughs)
  // ══════════════════════════════════════════════════════════════════════

  parseTextSegments(text) {
    return tagModel.parseTextSegments(text);
  }

  renderTagsAsHtml(text) {
    return tagModel.renderTagsAsHtml(text);
  }

  detectType(query) {
    return detectTagType(query);
  }
}

export const tagService = new TagService();
export default tagService;
