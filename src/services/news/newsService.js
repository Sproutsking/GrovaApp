// ============================================================================
// src/services/news/newsService.js  — v4
//
// KEY CHANGE: On first load, immediately calls the Supabase Edge Function
// to trigger a fresh RSS fetch. This ensures articles are never stale even
// if the user opens the app right before the 3-min cron fires.
//
// Flow:
//   1. getNewsPosts()  → read existing articles from DB (instant)
//   2. triggerFetch()  → call edge function to fetch new RSS (background)
//   3. startRealtime() → WebSocket for instant push as new rows land
// ============================================================================

import { supabase } from "../config/supabase";

const NEWS_DEFAULT_LIMIT = 40;
const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/news-fetcher`;
const EDGE_FN_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function normalise(row) {
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

let _channel = null;
let _pollCb = null;
let _latestTs = null;
let _failures = 0;
let _fetchLock = false;

const newsService = {
  async getNewsPosts({
    limit = NEWS_DEFAULT_LIMIT,
    category = null,
    offset = 0,
  } = {}) {
    try {
      const rows = await queryNews({ limit, category, offset });
      const items = rows.map(normalise);
      if (items.length > 0 && offset === 0) {
        const ts = items[0].published_at;
        if (!_latestTs || ts > _latestTs) _latestTs = ts;
      }
      return items;
    } catch (err) {
      console.error("[newsService] getNewsPosts:", err.message);
      return [];
    }
  },

  // Fires the Edge Function → fetches RSS → upserts → Realtime pushes to client
  async triggerFetch({ category = null } = {}) {
    if (_fetchLock) return null;
    _fetchLock = true;
    try {
      const body = category ? JSON.stringify({ category }) : "{}";
      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${EDGE_FN_KEY}`,
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log(
        `[newsService] triggerFetch: ${data.inserted} new in ${data.elapsed_s}s`,
      );
      return data;
    } catch (err) {
      console.warn("[newsService] triggerFetch:", err.message);
      return null;
    } finally {
      _fetchLock = false;
    }
  },

  startRealtime(callback, { category = null } = {}) {
    this.stopAll();
    _pollCb = callback;
    _failures = 0;

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
          const item = normalise(row);
          if (!_latestTs || item.published_at > _latestTs)
            _latestTs = item.published_at;
          console.log(`[newsService] ⚡ "${row.title?.slice(0, 55)}"`);
          callback([item]);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[newsService] ✓ Realtime connected");
          _failures = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          _failures++;
          if (_failures < 3)
            setTimeout(() => this.startRealtime(callback, { category }), 5_000);
        }
      });

    return () => this.stopAll();
  },

  async refresh({ limit = NEWS_DEFAULT_LIMIT, category = null } = {}) {
    this.triggerFetch({ category });
    try {
      return (await queryNews({ limit, category })).map(normalise);
    } catch {
      return [];
    }
  },

  stopAll() {
    if (_channel) {
      supabase.removeChannel(_channel);
      _channel = null;
    }
    _pollCb = null;
    _failures = 0;
  },

  stopPolling() {
    this.stopAll();
  },
  getStatus() {
    return { latestSeen: _latestTs };
  },
};

export default newsService;
