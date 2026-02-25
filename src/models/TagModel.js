// ============================================================================
// src/models/TagModel.js
// Platform Tag Model — handles hashtags, mention-tags, and user-name tags
// ============================================================================

import { supabase } from "../services/config/supabase";

// ─── Tag type constants ───────────────────────────────────────────────────────
export const TAG_TYPE = {
  HASHTAG: "hashtag", // #storytelling
  MENTION: "mention", // @username
  NAME: "name", // plain text match against a real user's name
};

// ─── Content source constants ─────────────────────────────────────────────────
export const TAG_SOURCE = {
  POST: "post",
  REEL: "reel",
  STORY: "story",
};

// ─── Regex helpers ────────────────────────────────────────────────────────────
const HASHTAG_REGEX = /#([\w\u00C0-\u024F]+)/g; // unicode-safe
const MENTION_REGEX = /@([\w]+)/g;

/**
 * Extracts every #tag from a string.
 * Returns lowercase deduplicated array e.g. ['#folklore', '#life']
 */
export function extractHashtags(text = "") {
  const found = [];
  let m;
  while ((m = HASHTAG_REGEX.exec(text)) !== null) {
    found.push(`#${m[1].toLowerCase()}`);
  }
  return [...new Set(found)];
}

/**
 * Extracts every @mention from a string.
 * Returns lowercase deduplicated array e.g. ['@john', '@jane']
 */
export function extractMentions(text = "") {
  const found = [];
  let m;
  while ((m = MENTION_REGEX.exec(text)) !== null) {
    found.push(`@${m[1].toLowerCase()}`);
  }
  return [...new Set(found)];
}

/**
 * Extracts both hashtags and mentions from a string.
 */
export function extractAllTags(text = "") {
  return {
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
  };
}

/**
 * Normalises a raw search query into a clean tag string.
 * "folklore"  →  "#folklore"
 * "#folklore" →  "#folklore"
 * "@john"     →  "@john"
 * "john"      →  (kept as-is for name search)
 */
export function normaliseTag(raw = "") {
  const t = raw.trim();
  if (t.startsWith("#") || t.startsWith("@")) return t.toLowerCase();
  return t.toLowerCase();
}

/**
 * Detects what kind of search a query represents.
 */
export function detectTagType(query = "") {
  const t = query.trim();
  if (t.startsWith("#")) return TAG_TYPE.HASHTAG;
  if (t.startsWith("@")) return TAG_TYPE.MENTION;
  return TAG_TYPE.NAME;
}

// ─── TagModel class ───────────────────────────────────────────────────────────

class TagModel {
  // ── Internal: extract tag rows from a body of text ────────────────────────

  _parseTagRows(text = "", sourceType, sourceId, authorId) {
    const { hashtags, mentions } = extractAllTags(text);
    const rows = [];

    hashtags.forEach((tag) => {
      rows.push({
        tag,
        tag_type: TAG_TYPE.HASHTAG,
        source_type: sourceType,
        source_id: sourceId,
        author_id: authorId,
        created_at: new Date().toISOString(),
      });
    });

    mentions.forEach((mention) => {
      rows.push({
        tag: mention,
        tag_type: TAG_TYPE.MENTION,
        source_type: sourceType,
        source_id: sourceId,
        author_id: authorId,
        created_at: new Date().toISOString(),
      });
    });

    return rows;
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAG AGGREGATION  (build counts from raw content — no dedicated table)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Counts how many times `tag` (e.g. "#folklore" or "@username") appears
   * across posts, reels, and stories.
   */
  async getTagCount(tag) {
    const t = tag.toLowerCase();
    try {
      const [posts, reels, stories] = await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact" })
          .ilike("content", `%${t}%`)
          .is("deleted_at", null),
        supabase
          .from("reels")
          .select("id", { count: "exact" })
          .ilike("caption", `%${t}%`)
          .is("deleted_at", null),
        supabase
          .from("stories")
          .select("id", { count: "exact" })
          .or(`preview.ilike.%${t}%,full_content.ilike.%${t}%`)
          .is("deleted_at", null),
      ]);
      return (posts.count || 0) + (reels.count || 0) + (stories.count || 0);
    } catch {
      return 0;
    }
  }

  /**
   * Returns a ranked list of tags matching a partial query.
   * Each result: { tag, tag_type, count }
   */
  async searchTags(partialQuery = "", limit = 20) {
    const q = partialQuery.toLowerCase().trim();
    const isH = q.startsWith("#");
    const isM = q.startsWith("@");
    const raw = q.replace(/^[#@]/, "");

    if (raw.length < 1) return [];

    try {
      // Fetch matching text from all three tables in parallel
      const [postRows, reelRows, storyRows] = await Promise.all([
        supabase
          .from("posts")
          .select("content")
          .ilike("content", `%${q}%`)
          .is("deleted_at", null)
          .limit(limit * 3),
        supabase
          .from("reels")
          .select("caption")
          .ilike("caption", `%${q}%`)
          .is("deleted_at", null)
          .limit(limit * 3),
        supabase
          .from("stories")
          .select("preview")
          .or(`preview.ilike.%${q}%`)
          .is("deleted_at", null)
          .limit(limit * 3),
      ]);

      const allText = [
        ...(postRows.data || []).map((r) => r.content || ""),
        ...(reelRows.data || []).map((r) => r.caption || ""),
        ...(storyRows.data || []).map((r) => r.preview || ""),
      ].join(" ");

      const counts = {};

      if (!isM) {
        // Count hashtags
        const htags = extractHashtags(allText);
        htags.forEach((tag) => {
          if (tag.includes(raw)) counts[tag] = (counts[tag] || 0) + 1;
        });
      }

      if (!isH) {
        // Count mentions
        const mentions = extractMentions(allText);
        mentions.forEach((tag) => {
          if (tag.includes(raw)) counts[tag] = (counts[tag] || 0) + 1;
        });
      }

      return Object.entries(counts)
        .map(([tag, count]) => ({
          tag,
          tag_type: tag.startsWith("#") ? TAG_TYPE.HASHTAG : TAG_TYPE.MENTION,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (err) {
      console.error("TagModel.searchTags error:", err);
      return [];
    }
  }

  /**
   * Returns trending hashtags over the past `days` days.
   */
  async getTrendingHashtags(limit = 10, days = 7) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    try {
      const [postRows, reelRows, storyRows] = await Promise.all([
        supabase
          .from("posts")
          .select("content")
          .gte("created_at", since)
          .is("deleted_at", null)
          .limit(200),
        supabase
          .from("reels")
          .select("caption")
          .gte("created_at", since)
          .is("deleted_at", null)
          .limit(200),
        supabase
          .from("stories")
          .select("preview")
          .gte("created_at", since)
          .is("deleted_at", null)
          .limit(200),
      ]);

      const allText = [
        ...(postRows.data || []).map((r) => r.content || ""),
        ...(reelRows.data || []).map((r) => r.caption || ""),
        ...(storyRows.data || []).map((r) => r.preview || ""),
      ].join(" ");

      const counts = {};
      extractHashtags(allText).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([tag, count]) => ({ tag, tag_type: TAG_TYPE.HASHTAG, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (err) {
      console.error("TagModel.getTrendingHashtags error:", err);
      return [];
    }
  }

  /**
   * Returns trending @mentions over the past `days` days.
   */
  async getTrendingMentions(limit = 10, days = 7) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    try {
      const [postRows, reelRows] = await Promise.all([
        supabase
          .from("posts")
          .select("content")
          .gte("created_at", since)
          .is("deleted_at", null)
          .limit(200),
        supabase
          .from("reels")
          .select("caption")
          .gte("created_at", since)
          .is("deleted_at", null)
          .limit(200),
      ]);

      const allText = [
        ...(postRows.data || []).map((r) => r.content || ""),
        ...(reelRows.data || []).map((r) => r.caption || ""),
      ].join(" ");

      const counts = {};
      extractMentions(allText).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([tag, count]) => ({ tag, tag_type: TAG_TYPE.MENTION, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (err) {
      console.error("TagModel.getTrendingMentions error:", err);
      return [];
    }
  }

  /**
   * Full trending call — returns both hashtags and mentions together.
   */
  async getTrending(limit = 10, days = 7) {
    const [hashtags, mentions] = await Promise.all([
      this.getTrendingHashtags(Math.ceil(limit * 0.7), days),
      this.getTrendingMentions(Math.ceil(limit * 0.3), days),
    ]);
    return { hashtags, mentions };
  }

  // ══════════════════════════════════════════════════════════════════════
  // USER-CENTRIC TAG QUERIES
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Given a user's username and/or full_name, returns all content where
   * they are mentioned (@username) or their name appears in text.
   *
   * Returns { mentionedInPosts, mentionedInReels, mentionedInStories }
   */
  async getContentMentioningUser(
    username,
    fullName,
    limit = 20,
    currentUserId = null,
  ) {
    const mention = `@${username.toLowerCase().replace("@", "")}`;
    const nameTerm = fullName?.toLowerCase() || "";

    const orClause = nameTerm
      ? `content.ilike.%${mention}%,content.ilike.%${nameTerm}%`
      : `content.ilike.%${mention}%`;

    const reelOrClause = nameTerm
      ? `caption.ilike.%${mention}%,caption.ilike.%${nameTerm}%`
      : `caption.ilike.%${mention}%`;

    const storyOrClause = nameTerm
      ? `preview.ilike.%${mention}%,preview.ilike.%${nameTerm}%`
      : `preview.ilike.%${mention}%`;

    const likePostFilter = currentUserId
      ? `post_likes!left(id, user_id)`
      : `post_likes!left(id)`;
    const likeReelFilter = currentUserId
      ? `reel_likes!left(id, user_id)`
      : `reel_likes!left(id)`;
    const likeStoryFilter = currentUserId
      ? `story_likes!left(id, user_id)`
      : `story_likes!left(id)`;
    const unlockedFilter = currentUserId
      ? `unlocked_stories!left(id, user_id)`
      : `unlocked_stories!left(id)`;

    try {
      const [posts, reels, stories] = await Promise.all([
        supabase
          .from("posts")
          .select(
            `id, user_id, content, image_ids, image_metadata, video_ids, video_metadata,
                   is_text_card, text_card_metadata, card_caption, category,
                   likes, comments_count, shares, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likePostFilter}`,
          )
          .is("deleted_at", null)
          .or(orClause)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data)
              r.data.forEach(
                (p) =>
                  (p.post_likes = (p.post_likes || []).filter(
                    (l) => l.user_id === currentUserId,
                  )),
              );
            return r.data || [];
          }),

        supabase
          .from("reels")
          .select(
            `id, user_id, video_id, video_metadata, thumbnail_id,
                   caption, music, category, duration,
                   likes, comments_count, shares, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likeReelFilter}`,
          )
          .is("deleted_at", null)
          .or(reelOrClause)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data)
              r.data.forEach(
                (rl) =>
                  (rl.reel_likes = (rl.reel_likes || []).filter(
                    (l) => l.user_id === currentUserId,
                  )),
              );
            return r.data || [];
          }),

        supabase
          .from("stories")
          .select(
            `id, user_id, title, preview, cover_image_id, cover_image_metadata,
                   category, unlock_cost, max_accesses, current_accesses,
                   likes, comments_count, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likeStoryFilter}, ${unlockedFilter}`,
          )
          .is("deleted_at", null)
          .or(storyOrClause)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data) {
              r.data.forEach((s) => {
                s.story_likes = (s.story_likes || []).filter(
                  (l) => l.user_id === currentUserId,
                );
                s.unlocked_stories = (s.unlocked_stories || []).filter(
                  (l) => l.user_id === currentUserId,
                );
              });
            }
            return r.data || [];
          }),
      ]);

      return {
        mentionedInPosts: posts,
        mentionedInReels: reels,
        mentionedInStories: stories,
      };
    } catch (err) {
      console.error("TagModel.getContentMentioningUser error:", err);
      return {
        mentionedInPosts: [],
        mentionedInReels: [],
        mentionedInStories: [],
      };
    }
  }

  /**
   * Returns all posts/reels/stories AUTHORED by a given userId.
   * Full DB-row shape — ready to pass straight to PostCard / ReelCard / StoryCard.
   */
  async getContentByUser(userId, limit = 20, currentUserId = null) {
    const likePostFilter = currentUserId
      ? `post_likes!left(id, user_id)`
      : `post_likes!left(id)`;
    const likeReelFilter = currentUserId
      ? `reel_likes!left(id, user_id)`
      : `reel_likes!left(id)`;
    const likeStoryFilter = currentUserId
      ? `story_likes!left(id, user_id)`
      : `story_likes!left(id)`;
    const unlockedFilter = currentUserId
      ? `unlocked_stories!left(id, user_id)`
      : `unlocked_stories!left(id)`;

    try {
      const [posts, reels, stories] = await Promise.all([
        supabase
          .from("posts")
          .select(
            `id, user_id, content, image_ids, image_metadata, video_ids, video_metadata,
                   is_text_card, text_card_metadata, card_caption, category,
                   likes, comments_count, shares, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likePostFilter}`,
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data)
              r.data.forEach(
                (p) =>
                  (p.post_likes = (p.post_likes || []).filter(
                    (l) => l.user_id === currentUserId,
                  )),
              );
            return r.data || [];
          }),

        supabase
          .from("reels")
          .select(
            `id, user_id, video_id, video_metadata, thumbnail_id,
                   caption, music, category, duration,
                   likes, comments_count, shares, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likeReelFilter}`,
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data)
              r.data.forEach(
                (rl) =>
                  (rl.reel_likes = (rl.reel_likes || []).filter(
                    (l) => l.user_id === currentUserId,
                  )),
              );
            return r.data || [];
          }),

        supabase
          .from("stories")
          .select(
            `id, user_id, title, preview, cover_image_id, cover_image_metadata,
                   category, unlock_cost, max_accesses, current_accesses,
                   likes, comments_count, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likeStoryFilter}, ${unlockedFilter}`,
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data) {
              r.data.forEach((s) => {
                s.story_likes = (s.story_likes || []).filter(
                  (l) => l.user_id === currentUserId,
                );
                s.unlocked_stories = (s.unlocked_stories || []).filter(
                  (l) => l.user_id === currentUserId,
                );
              });
            }
            return r.data || [];
          }),
      ]);

      return { posts, reels, stories };
    } catch (err) {
      console.error("TagModel.getContentByUser error:", err);
      return { posts: [], reels: [], stories: [] };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // HASHTAG CONTENT FEED
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Fetch all content containing a specific hashtag, with full media + reaction state.
   * Returns { posts, reels, stories }
   */
  async getContentForHashtag(hashtag, limit = 20, currentUserId = null) {
    const tag = hashtag.startsWith("#")
      ? hashtag.toLowerCase()
      : `#${hashtag.toLowerCase()}`;

    const likePostFilter = currentUserId
      ? `post_likes!left(id, user_id)`
      : `post_likes!left(id)`;
    const likeReelFilter = currentUserId
      ? `reel_likes!left(id, user_id)`
      : `reel_likes!left(id)`;
    const likeStoryFilter = currentUserId
      ? `story_likes!left(id, user_id)`
      : `story_likes!left(id)`;
    const unlockedFilter = currentUserId
      ? `unlocked_stories!left(id, user_id)`
      : `unlocked_stories!left(id)`;

    try {
      const [posts, reels, stories] = await Promise.all([
        supabase
          .from("posts")
          .select(
            `id, user_id, content, image_ids, image_metadata, video_ids, video_metadata,
                   is_text_card, text_card_metadata, card_caption, category,
                   likes, comments_count, shares, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likePostFilter}`,
          )
          .is("deleted_at", null)
          .ilike("content", `%${tag}%`)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data)
              r.data.forEach(
                (p) =>
                  (p.post_likes = (p.post_likes || []).filter(
                    (l) => l.user_id === currentUserId,
                  )),
              );
            return r.data || [];
          }),

        supabase
          .from("reels")
          .select(
            `id, user_id, video_id, video_metadata, thumbnail_id,
                   caption, music, category, duration,
                   likes, comments_count, shares, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likeReelFilter}`,
          )
          .is("deleted_at", null)
          .ilike("caption", `%${tag}%`)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data)
              r.data.forEach(
                (rl) =>
                  (rl.reel_likes = (rl.reel_likes || []).filter(
                    (l) => l.user_id === currentUserId,
                  )),
              );
            return r.data || [];
          }),

        supabase
          .from("stories")
          .select(
            `id, user_id, title, preview, cover_image_id, cover_image_metadata,
                   category, unlock_cost, max_accesses, current_accesses,
                   likes, comments_count, views, created_at,
                   profiles:user_id(id, full_name, username, avatar_id, avatar_metadata, verified),
                   ${likeStoryFilter}, ${unlockedFilter}`,
          )
          .is("deleted_at", null)
          .or(`preview.ilike.%${tag}%,full_content.ilike.%${tag}%`)
          .order("created_at", { ascending: false })
          .limit(limit)
          .then((r) => {
            if (currentUserId && r.data) {
              r.data.forEach((s) => {
                s.story_likes = (s.story_likes || []).filter(
                  (l) => l.user_id === currentUserId,
                );
                s.unlocked_stories = (s.unlocked_stories || []).filter(
                  (l) => l.user_id === currentUserId,
                );
              });
            }
            return r.data || [];
          }),
      ]);

      return {
        posts,
        reels,
        stories,
        tag,
        count: posts.length + reels.length + stories.length,
      };
    } catch (err) {
      console.error("TagModel.getContentForHashtag error:", err);
      return { posts: [], reels: [], stories: [], tag, count: 0 };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // UTILITY
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Given raw text, returns a rendered version with clickable tag spans.
   * Suitable for dangerouslySetInnerHTML or a ParsedText component.
   */
  renderTagsAsHtml(text = "") {
    return text
      .replace(
        /#([\w\u00C0-\u024F]+)/g,
        '<span class="tag-hashtag" data-tag="#$1">#$1</span>',
      )
      .replace(
        /@([\w]+)/g,
        '<span class="tag-mention" data-mention="@$1">@$1</span>',
      );
  }

  /**
   * Splits text into segments — text nodes and tag nodes.
   * Perfect for React rendering without dangerouslySetInnerHTML.
   *
   * Returns: Array<{ type: 'text'|'hashtag'|'mention', value: string }>
   */
  parseTextSegments(text = "") {
    const segments = [];
    const pattern = /(#[\w\u00C0-\u024F]+|@[\w]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: text.slice(lastIndex, match.index),
        });
      }
      const val = match[0];
      segments.push({
        type: val.startsWith("#") ? "hashtag" : "mention",
        value: val,
      });
      lastIndex = match.index + val.length;
    }

    if (lastIndex < text.length) {
      segments.push({ type: "text", value: text.slice(lastIndex) });
    }

    return segments;
  }
}

// Export singleton
export const tagModel = new TagModel();
export default tagModel;
