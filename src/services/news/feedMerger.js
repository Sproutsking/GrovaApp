// ============================================================================
// services/news/feedMerger.js
// Merges user-generated posts with news posts into a single unified feed.
//
// Merge strategy:
//   • Inject 1 news post after every NEWS_INTERVAL user posts
//   • News posts are ordered by published_at DESC (freshest first)
//   • Seen news IDs are tracked to prevent repetition per request
//   • The unified feed preserves the original user post ordering
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS, used server-side only
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Config ───────────────────────────────────────────────────────────────────
const NEWS_INTERVAL = 5;       // Inject 1 news post every N user posts
const NEWS_MAX      = 20;      // Max news posts to fetch per request
const NEWS_MAX_AGE_HOURS = 48; // Only show news from the last 48 hours

// ── Fetch fresh news from the database ──────────────────────────────────────
export async function fetchNewsForFeed({
  category   = null,  // Filter by category (global | africa | crypto | null = all)
  limit      = NEWS_MAX,
  excludeIds = [],    // Already-shown news IDs to skip
} = {}) {
  const cutoff = new Date(
    Date.now() - NEWS_MAX_AGE_HOURS * 3_600_000
  ).toISOString();

  let query = supabase
    .from("news_posts")
    .select("*")
    .eq("is_active", true)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category)        query = query.eq("category", category);
  if (excludeIds.length) query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await query;
  if (error) {
    console.error("[FeedMerger] fetchNewsForFeed error:", error.message);
    return [];
  }
  return (data ?? []).map(normaliseNewsPost);
}

// ── Normalise a news_posts row to look like a post card item ─────────────────
function normaliseNewsPost(row) {
  return {
    ...row,
    // Flag so PostTab / PostCard can render it differently
    _type:      "news",
    // Mirror the user-post field names that PostCard already reads
    content:    row.description,
    // Fake user_id so follow/action buttons are hidden
    user_id:    "system-news",
    created_at: row.published_at,
    // Synthetic profile for ProfilePreview
    profiles: {
      full_name: row.source_name,
      username:  slugify(row.source_name),
      verified:  true,
      avatar_id: null,
    },
    // Reaction counts (news is read-only — hide interaction buttons)
    likes:          0,
    comments_count: 0,
    shares:         0,
    views:          0,
  };
}

function slugify(str = "") {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── MAIN EXPORT — merge user posts + news into a single feed ─────────────────
/**
 * mergeFeed(userPosts, options)
 *
 * @param {object[]} userPosts   Array of user-generated post objects
 * @param {object}   options
 *   @param {string}   options.category   Optional news category filter
 *   @param {string[]} options.seenNews   IDs of news already shown (pagination)
 *
 * @returns {{ feed: object[], seenNewsIds: string[] }}
 *   feed        — merged array ready to render
 *   seenNewsIds — updated list of news IDs now included (pass to next page)
 */
export async function mergeFeed(userPosts = [], {
  category  = null,
  seenNews  = [],
} = {}) {
  // Determine how many news slots we need
  const newsSlots = Math.floor(userPosts.length / NEWS_INTERVAL);
  if (newsSlots === 0) return { feed: userPosts, seenNewsIds: seenNews };

  // Fetch exactly what we need (+ small buffer for filtering)
  const news = await fetchNewsForFeed({
    category,
    limit:      Math.min(newsSlots + 3, NEWS_MAX),
    excludeIds: seenNews,
  });

  if (!news.length) return { feed: userPosts, seenNewsIds: seenNews };

  const merged       = [];
  let   newsIdx      = 0;
  const usedNewsIds  = [...seenNews];

  for (let i = 0; i < userPosts.length; i++) {
    merged.push(userPosts[i]);

    // After every NEWS_INTERVAL posts, insert a news card
    const isSlot = (i + 1) % NEWS_INTERVAL === 0;
    if (isSlot && newsIdx < news.length) {
      merged.push(news[newsIdx]);
      usedNewsIds.push(news[newsIdx].id);
      newsIdx++;
    }
  }

  return { feed: merged, seenNewsIds: usedNewsIds };
}