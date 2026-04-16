// ============================================================================
// src/services/news/newsService.js  — v6
//
// [FIX] _normalise is now properly exported so NewsTab can call it when
//       doing direct DB reads via supabase client.
// [FIX] startRealtime() returns an UNSUBSCRIBE FUNCTION (not void) so
//       NewsTab can call rtUnsubRef.current() to clean up.
// [FIX] stopAll() also clears the module-level channel ref properly.
// ============================================================================

import { supabase } from "../config/supabase";

const NEWS_DEFAULT_LIMIT = 40;

// ── Normalise DB row → component-ready object ─────────────────────────────────
export function normaliseNewsRow(row) {
  return {
    ...row,
    _type: "news",
    content: row.description || "",
    user_id: "system-news",
    created_at: row.published_at,
    profiles: {
      full_name: row.source_name,
      username: (row.source_name || "news")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
      verified: true,
      avatar_id: null,
    },
    likes: 0,
    comments_count: 0,
    shares: 0,
    views: 0,
  };
}

// ── DB query ──────────────────────────────────────────────────────────────────
async function queryNews({
  limit = NEWS_DEFAULT_LIMIT,
  category = null,
  offset = 0,
} = {}) {
  let q = supabase
    .from("news_posts")
    .select("*")
    .eq("is_active", true)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new Error(`news_posts: ${error.message}`);
  return data ?? [];
}

// ── Module-level realtime state ───────────────────────────────────────────────
let _channel = null;
let _failures = 0;
let _retryTimer = null;

const newsService = {
  // Expose normalise for components that do direct DB reads
  _normalise: normaliseNewsRow,

  // ── Read ────────────────────────────────────────────────────────────────────
  async getNewsPosts({
    limit = NEWS_DEFAULT_LIMIT,
    category = null,
    offset = 0,
  } = {}) {
    try {
      const rows = await queryNews({ limit, category, offset });
      return rows.map(normaliseNewsRow);
    } catch (err) {
      console.error("[newsService] getNewsPosts:", err.message);
      return [];
    }
  },

  async refresh({ limit = NEWS_DEFAULT_LIMIT, category = null } = {}) {
    try {
      return (await queryNews({ limit, category })).map(normaliseNewsRow);
    } catch {
      return [];
    }
  },

  // ── Realtime ────────────────────────────────────────────────────────────────
  /**
   * startRealtime(callback, { category })
   *
   * Subscribes to INSERT events on news_posts.
   * Returns an UNSUBSCRIBE FUNCTION — call it to clean up.
   *
   * callback receives an array of normalised news items.
   */
  startRealtime(callback, { category = null } = {}) {
    // Clean up any existing subscription first
    this.stopAll();
    _failures = 0;

    const setupChannel = () => {
      _channel = supabase
        .channel(`news_rt_${category || "all"}_${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "news_posts" },
          (payload) => {
            const row = payload.new;
            if (!row?.is_active) return;
            if (
              category &&
              row.category?.toLowerCase() !== category.toLowerCase()
            )
              return;
            try {
              callback([normaliseNewsRow(row)]);
            } catch {}
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("[newsService] Realtime ✓");
            _failures = 0;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            _failures++;
            console.warn(
              `[newsService] Realtime ${status} (attempt ${_failures})`,
            );
            if (_failures < 4) {
              _retryTimer = setTimeout(() => setupChannel(), 5_000 * _failures);
            }
          }
        });
    };

    setupChannel();

    // Return unsubscribe function
    return () => this.stopAll();
  },

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  stopAll() {
    if (_retryTimer) {
      clearTimeout(_retryTimer);
      _retryTimer = null;
    }
    if (_channel) {
      try {
        supabase.removeChannel(_channel);
      } catch {}
      _channel = null;
    }
    _failures = 0;
  },

  // Legacy alias
  stopPolling() {
    this.stopAll();
  },
};

export default newsService;
