// =============================================================================
// src/services/news/newsService.js
//
// Fetches LIVE news from the news_posts Supabase table.
// NO mock data — real articles only.
//
// Boot flow:
//   1. Query news_posts for recent articles
//   2. If the table is empty (cron hasn't run yet), call the Edge Function
//      directly so articles are fetched immediately — no wait needed
//   3. Re-query and return the fresh results
//
// Requires:
//   • SQL migration:  sql/001_news_posts.sql
//   • Edge function:  supabase/functions/fetch-news/index.ts  (deployed)
//   • REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env
// =============================================================================

import { supabase } from "../config/supabase";

const NEWS_MAX_AGE_HOURS = 48;
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? process.env.REACT_APP_SUPABASE_URL}/functions/v1/fetch-news`;
const ANON_KEY    =  import.meta.env.VITE_SUPABASE_ANON_KEY ?? process.env.REACT_APP_SUPABASE_ANON_KEY ?? "";

// ── Normalise a news_posts row into the shape NewsCard/PostTab expects ────────
function normalise(row) {
  return {
    ...row,
    _type:      "news",
    content:    row.description || "",
    user_id:    "system-news",
    created_at: row.published_at,
    profiles: {
      full_name: row.source_name,
      username:  (row.source_name || "news").toLowerCase().replace(/\s+/g, "-"),
      verified:  true,
      avatar_id: null,
    },
    likes: 0, comments_count: 0, shares: 0, views: 0,
  };
}

// ── Query news_posts ──────────────────────────────────────────────────────────
async function queryNews({ limit = 12, category = null } = {}) {
  const cutoff = new Date(Date.now() - NEWS_MAX_AGE_HOURS * 3_600_000).toISOString();

  let q = supabase
    .from("news_posts")
    .select("*")
    .eq("is_active", true)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category) q = q.eq("category", category);

  const { data, error } = await q;

  if (error) {
    // Table hasn't been migrated yet — throw so caller knows
    throw new Error(`news_posts query failed: ${error.message}`);
  }

  return data ?? [];
}

// ── Trigger the Edge Function to fetch fresh news ─────────────────────────────
async function triggerEdgeFunction() {
  try {
    const res = await fetch(EDGE_FN_URL, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type":  "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Edge function returned ${res.status}`);
    const json = await res.json();
    console.log("[newsService] Edge function result:", json);
    return true;
  } catch (err) {
    console.warn("[newsService] Edge function trigger failed:", err.message);
    return false;
  }
}

// ── Singleton: only one trigger in-flight at a time ──────────────────────────
let _triggerPromise: Promise<boolean> | null = null;

// ── Main service ──────────────────────────────────────────────────────────────
const newsService = {
  /**
   * getNewsPosts({ limit, category })
   *
   * Returns live articles from news_posts.
   * If the table is empty, fires the edge function once to populate it,
   * then re-queries.  Never returns mock data.
   */
  async getNewsPosts({ limit = 12, category = null } = {}) {
    // 1. Try to get news from DB
    let rows = [];
    try {
      rows = await queryNews({ limit, category });
    } catch (err) {
      console.error("[newsService] Query error:", err.message);
      // Table not migrated — return empty, don't block the feed
      return [];
    }

    // 2. Table exists but is empty — trigger the edge function once
    if (rows.length === 0) {
      if (!_triggerPromise) {
        _triggerPromise = triggerEdgeFunction().finally(() => {
          // Reset after 60 s so repeated empty-checks can re-trigger if needed
          setTimeout(() => { _triggerPromise = null; }, 60_000);
        });
      }

      // Wait for the fetch to complete (max 30 s already inside triggerEdgeFunction)
      await _triggerPromise;

      // Re-query now that news should be populated
      try {
        rows = await queryNews({ limit, category });
      } catch {
        return [];
      }
    }

    return rows.map(normalise);
  },

  /**
   * Manually trigger a fresh fetch (e.g. pull-to-refresh).
   * Fires the edge function and returns the updated articles.
   */
  async refresh({ limit = 12, category = null } = {}) {
    await triggerEdgeFunction();
    try {
      const rows = await queryNews({ limit, category });
      return rows.map(normalise);
    } catch {
      return [];
    }
  },
};

export default newsService;