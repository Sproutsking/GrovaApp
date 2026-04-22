// ============================================================================
// api/feed.js  —  Combined feed endpoint
//
// GET /api/feed
//   Query params:
//     limit      (default 20)  — number of user posts to fetch
//     offset     (default 0)   — pagination offset
//     category   (optional)    — news category filter
//     seenNews   (optional)    — comma-separated news IDs already shown
//     tab        (optional)    — "posts" | "reels" | "stories"
//
// Works as an Express route or a Next.js API route.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { mergeFeed }    from "../services/news/feedMerger.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Helper: fetch user-generated posts ──────────────────────────────────────
async function fetchUserPosts({ limit = 20, offset = 0, userId = null } = {}) {
  let query = supabase
    .from("posts")
    .select(`
      *,
      profiles:user_id (
        full_name, username, avatar_id, verified
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Route handler ─────────────────────────────────────────────────────────────
// Express:  router.get("/api/feed", feedHandler);
// Next.js:  export default feedHandler;
export async function feedHandler(req, res) {
  try {
    const {
      limit    = 20,
      offset   = 0,
      category = null,
      seenNews = "",
      tab      = "posts",
    } = req.query;

    // Only inject news into the posts tab
    if (tab !== "posts") {
      return res.status(400).json({ error: "News injection only applies to posts tab." });
    }

    const seenNewsIds = seenNews
      ? seenNews.split(",").filter(Boolean)
      : [];

    // 1. Fetch user posts
    const userPosts = await fetchUserPosts({
      limit:  parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    // 2. Merge with news
    const { feed, seenNewsIds: updatedSeenIds } = await mergeFeed(userPosts, {
      category:  category || null,
      seenNews:  seenNewsIds,
    });

    return res.status(200).json({
      feed,
      meta: {
        total:         feed.length,
        userPostCount: userPosts.length,
        newsPostCount: feed.length - userPosts.length,
        seenNewsIds:   updatedSeenIds,
        offset:        parseInt(offset, 10),
        limit:         parseInt(limit, 10),
      },
    });
  } catch (err) {
    console.error("[FeedAPI] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch feed." });
  }
}

// ── Admin: manually trigger news fetch ──────────────────────────────────────
export async function triggerFetchHandler(req, res) {
  // Protect with a secret header in production
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { triggerManualFetch } = await import("../services/news/newsCron.js");
  const result = await triggerManualFetch();
  return res.status(200).json(result);
}