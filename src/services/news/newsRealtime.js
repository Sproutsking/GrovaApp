// ============================================================================
// src/services/news/newsRealtime.js  — v9  TRULY INSTANT
//
// THE FUNDAMENTAL FIX:
//  Previous versions called _runPrefetch() at module load, but this module
//  is only imported when NewsTab.jsx mounts — which only happens when the
//  user CLICKS the News tab. So "prefetch at import" was actually
//  "fetch when tab is clicked" — no improvement at all.
//
//  The real fix: newsService.js (imported by HomeView on app boot) calls
//  triggerNewsPrefetch() explicitly. HomeView mounts immediately when the
//  app opens. The DB query fires before the user has even seen the Posts tab.
//  By the time they click News, data is ready.
//
// ARCHITECTURE:
//  [P1] triggerNewsPrefetch() — called by newsService.js on init. Safe to
//       call multiple times (idempotent). Returns the promise.
//
//  [P2] getPrefetchedArticles() — synchronous check + async fallback.
//       If prefetch resolved → returns {sync: data, promise: null}.
//       If still pending → returns {sync: null, promise: <in-flight>}.
//       NewsTab uses this to show data instantly or await the promise.
//
//  [P3] bustAndRefetch() — for manual refresh, busts cache and re-runs.
//
//  [P4] ACCURATE PENDING COUNT — _inFeedHashes tracks visible articles.
//       Only hashes NOT in _inFeedHashes count as "new" for the banner.
//
//  [P5] Nigeria first-class — same 30s poll as BBC/Reuters/AP.
//
//  [P6] firstBatch logic REMOVED from engine. Engine emits all new articles.
//       NewsTab decides what goes directly in vs. what goes to pending banner.
// ============================================================================

import { supabase } from "../config/supabase";
import { RSS_SOURCES } from "./clientNewsFetcher";

// ── Constants ─────────────────────────────────────────────────────────────────
export const MAX_AGE_DAYS = 3;
export const MAX_AGE_MS   = MAX_AGE_DAYS * 24 * 3600 * 1000;

export const TIER = {
  LIVE:     0,
  BREAKING: 1,
  FRESH:    2,
  RECENT:   3,
  ARCHIVE:  4,
};

export function getTier(publishedAt, isLiveNow = false) {
  if (isLiveNow) return TIER.LIVE;
  if (!publishedAt) return TIER.RECENT;
  const age = Date.now() - new Date(publishedAt).getTime();
  if (age < 0)            return TIER.RECENT;
  if (age < 5 * 60_000)  return TIER.BREAKING;
  if (age < 60 * 60_000) return TIER.FRESH;
  if (age < MAX_AGE_MS)  return TIER.RECENT;
  return TIER.ARCHIVE;
}

export function detectLiveStatus(title = "", publishedAt = "") {
  const liveRe = /\blive\s*(stream|now|coverage|feed|broadcast)?\b/i;
  const age    = publishedAt ? Date.now() - new Date(publishedAt).getTime() : Infinity;
  if (age < 3 * 60_000)                           return "live";
  if (liveRe.test(title) && age < 4 * 3_600_000) return "live";
  if (liveRe.test(title) && age >= 4 * 3_600_000)return "ended";
  return "none";
}

export function articleKey(a) { return a.url_hash || a.id || ""; }

export function filterByAge(articles) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return articles.filter((a) => {
    if (!a.published_at) return true;
    return new Date(a.published_at).getTime() > cutoff;
  });
}

// ── [P1] Pre-fetch system — called externally by newsService.js ───────────────
function _decorateRow(r) {
  const liveStatus = detectLiveStatus(r.title || "", r.published_at || "");
  return { ...r, liveStatus, tier: liveStatus === "live" ? TIER.LIVE : getTier(r.published_at) };
}

let _prefetchPromise = null;
let _prefetchResult  = null;
let _prefetchTs      = 0;
const _PREFETCH_TTL  = 5 * 60_000;

function _runPrefetch() {
  _prefetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("news_posts")
        .select(
          "id,title,description,image_url,source_name,source_url," +
          "article_url,category,region,asset_tag,url_hash,published_at,is_active"
        )
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) return [];
      const rows = filterByAge(data || []).map(_decorateRow);
      _prefetchResult = rows;
      _prefetchTs     = Date.now();
      return rows;
    } catch { return []; }
  })();
  return _prefetchPromise;
}

// [P1] Called by newsService.js on init — safe to call multiple times
export function triggerNewsPrefetch() {
  if (_prefetchResult && Date.now() - _prefetchTs < _PREFETCH_TTL) {
    return Promise.resolve(_prefetchResult);
  }
  return _prefetchPromise || _runPrefetch();
}

// [P2] Called by NewsTab — sync if ready, promise if not
export function getPrefetchedArticles() {
  if (_prefetchResult && Date.now() - _prefetchTs < _PREFETCH_TTL) {
    return { sync: _prefetchResult, promise: null };
  }
  const p = _prefetchPromise || _runPrefetch();
  return { sync: null, promise: p };
}

// [P3] Bust + re-fetch for manual refresh
export function bustAndRefetch() {
  _prefetchResult = null;
  _prefetchTs     = 0;
  return _runPrefetch();
}

// ── Shared fetch helper — direct first, Supabase proxy only as fallback
async function fetchText(url, timeout = 12_000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: "application/xml, text/xml, text/html, */*",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchRss(url) {
  const candidates = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(url)}`,
  ];
  for (const candidate of candidates) {
    try {
      const txt = await fetchText(candidate, 12_000);
      if (txt.length > 300 && (txt.includes("<item") || txt.includes("<entry"))) return txt;
    } catch {
      /* try next fallback */
    }
  }
  return null;
}

// ── YouTube fetch — rss2json primary ─────────────────────────────────────────
async function fetchYtRss(channelId) {
  const ytUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  try {
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(ytUrl)}&count=10`,
      { signal: AbortSignal.timeout(14_000) }
    );
    if (res.ok) {
      const j = await res.json();
      if (j?.status === "ok" && j?.items?.length) return { type: "json", data: j };
    }
  } catch {
    /* fallback */
  }

  const candidates = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(ytUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(ytUrl)}`,
    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/proxy-fetch?url=${encodeURIComponent(ytUrl)}`,
  ];
  for (const candidate of candidates) {
    try {
      const txt = await fetchText(candidate, 14_000);
      if (txt && txt.includes("<entry")) return { type: "xml", data: txt };
    } catch {
      /* try next fallback */
    }
  }
  return null;
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function tagVal(block, ...names) {
  for (const n of names) {
    const re = new RegExp(`<${n}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${n}>`, "i");
    const m  = block.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function stripHtml(h = "") {
  return h
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&#8230;/gi, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitiseImg(url) {
  if (!url || typeof url !== "string") return null;
  const t = url.trim();
  if (!t.startsWith("http")) return null;
  const l = t.toLowerCase();
  if (
    l.includes("1x1") ||
    l.includes("pixel") ||
    l.includes("spacer") ||
    l.endsWith(".svg") ||
    t.length < 20
  )
    return null;
  return t;
}

function extractImg(block) {
  const pats = [
    /media:content[^>]+url=["']([^"']+)["']/i,
    /media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /enclosure[^>]+url=["'](https?:\/\/[^"]+)["']/i,
    /<img[^>]+src=["'](https?:\/\/[^"']{20,})["']/i,
    /(https?:\/\/[^\s"'<>]{20,}\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)/i,
  ];
  for (const re of pats) {
    const u = sanitiseImg((block.match(re) || [])[1]);
    if (u) return u;
  }
  return null;
}

function extractDate(block, articleUrl = "") {
  const fields = [
    /< *pubDate[^>]*>([^<]+)<\/pubDate>/i,
    /< *published[^>]*>([^<]+)<\/published>/i,
    /< *updated[^>]*>([^<]+)<\/updated>/i,
    /< *dc:date[^>]*>([^<]+)<\/dc:date>/i,
  ];
  for (const re of fields) {
    const m = block.match(re);
    if (!m) continue;
    const ts = new Date(m[1].trim()).getTime();
    if (!isNaN(ts) && ts > 0 && ts < Date.now() + 3_600_000) return ts;
  }
  const ud = articleUrl.match(/\/(20\d{2})[\/\-](\d{2})[\/\-](\d{2})[\/\-]/);
  if (ud) {
    const ts = new Date(`${ud[1]}-${ud[2]}-${ud[3]}T12:00:00Z`).getTime();
    if (!isNaN(ts)) return ts;
  }
  return null;
}

const ASSETS = ["BTC","ETH","SOL","BNB","XRP","ADA","DOGE","AVAX","MATIC","LINK","UNI","TON","PEPE","SHIB","USDT","USDC"];
function assetTag(t = "") {
  const up = t.toUpperCase();
  return ASSETS.find((a) => new RegExp(`\\b${a}\\b`).test(up)) ?? null;
}

async function quickHash(str) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  }
}

function normUrl(raw = "") {
  try {
    const u = new URL(raw.trim());
    ["utm_source","utm_medium","utm_campaign","ref","fbclid","gclid"].forEach((k) => u.searchParams.delete(k));
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.hash = "";
    return u.href.toLowerCase();
  } catch { return raw.trim().toLowerCase(); }
}

async function parseRssXml(xml, source) {
  const now    = Date.now();
  const cutoff = now - MAX_AGE_MS;
  const re     = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(tagVal(block, "title")).slice(0, 300);
    if (!title || title.length < 12) continue;
    let articleUrl = "";
    const hrefM = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (hrefM) articleUrl = hrefM[1].trim();
    else articleUrl = tagVal(block, "link", "guid").trim();
    if (!articleUrl.startsWith("http")) continue;
    const rawDesc = tagVal(block, "content:encoded", "content", "summary", "description");
    const description = stripHtml(rawDesc)
      .replace(/Read more[.:…]*$/i, "").replace(/Continue reading[.:…]*$/i, "")
      .replace(/The post .+ appeared first on .+\.$/, "").trim().slice(0, 600) || null;
    const ts = extractDate(block, articleUrl);
    let published_at;
    if (ts === null) {
      published_at = new Date(now - 2 * 3_600_000).toISOString();
    } else {
      if (ts > now + 3_600_000) continue;
      if (ts < cutoff) continue;
      published_at = new Date(ts).toISOString();
    }
    const hash       = await quickHash(normUrl(articleUrl));
    const liveStatus = detectLiveStatus(title, published_at);
    results.push({
      title, description,
      image_url:   extractImg(block),
      source_name: source.name,
      source_url:  source.url,
      article_url: articleUrl,
      category:    source.category,
      region:      source.region ?? null,
      asset_tag:   source.category === "crypto" ? assetTag(`${title} ${description || ""}`) : null,
      url_hash:    hash,
      published_at,
      is_active:   true,
      liveStatus,
      tier:        liveStatus === "live" ? TIER.LIVE : getTier(published_at),
    });
  }
  return results;
}

// ── YouTube channels ──────────────────────────────────────────────────────────
export const YT_CHANNELS = [
  { id: "UCnUYZLuoy1rq1aVMwx4aTzw", name: "BBC News",    category: "global" },
  { id: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News",     category: "global" },
  { id: "UCNye-wNBqNL5ZzHSJdde7RA", name: "Al Jazeera",  category: "global" },
  { id: "UCQfwfsi5VrQ8yKZ-UWmAEFg", name: "France 24",   category: "global" },
  { id: "UC7fWeaHhqgM4Ry-RMpM2YYw", name: "TRT World",   category: "global" },
  { id: "UC-7dRiGmmKOUkBu-gKVQf2g", name: "Sky News",    category: "global" },
  { id: "UCupvZG-5ko_eiXAupbDfxWw", name: "CNN",         category: "global" },
  { id: "UCVSNOxehfALut52-3bfvSHg", name: "VOA News",    category: "global" },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters",     category: "global" },
  { id: "UC8nNHDCBk5RoUg10L-Lktjg", name: "AP",          category: "global" },
  // Nigeria & Africa — first-class
  { id: "UCJXGnHCHApDirWSmAZ0uxkQ", name: "Arise News",  category: "africa" },
  { id: "UCCjyq_K1Pd2QkMOoAc73yqA", name: "Channels TV", category: "africa" },
  { id: "UCG9_Hz8tMHdM5i5EzQpSPaQ", name: "Africa News", category: "africa" },
  { id: "UCHpSbMCDGjYrfp_eGa09yhA", name: "TVC News",    category: "africa" },
  // Crypto
  { id: "UCrbatV49TNrqfoPLEJqJiuw", name: "CoinDesk TV", category: "crypto" },
  { id: "UCAl9Ld79qaZxp9JzEOwd3aA", name: "Bankless",    category: "crypto" },
];
export const LIVE_CHANNELS = YT_CHANNELS;

function isRealVideoId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}
const YT_THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

async function fetchYtChannel(ch) {
  const result = await fetchYtRss(ch.id);
  if (!result) return [];
  const items = [], seen = new Set();
  if (result.type === "json") {
    for (const it of result.data.items || []) {
      const vidId = (it.link || "").match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] || "";
      if (!vidId || !isRealVideoId(vidId) || seen.has(vidId)) continue;
      seen.add(vidId);
      const title = (it.title || "").trim();
      if (!title) continue;
      const pub = it.pubDate || "";
      const ms  = pub ? new Date(pub).getTime() : Date.now();
      if (Date.now() - ms > 7 * 86_400_000) continue;
      const published_at = pub ? new Date(pub).toISOString() : new Date().toISOString();
      const liveStatus   = detectLiveStatus(title, published_at);
      items.push({
        _type: "video", id: `yt_${vidId}`, videoId: vidId, title,
        channelName: ch.name, category: ch.category,
        image_url: it.thumbnail || YT_THUMB(vidId),
        thumbnail: it.thumbnail || YT_THUMB(vidId),
        published_at, liveStatus,
        isLiveBroadcast: liveStatus === "live",
        tier: liveStatus === "live" ? TIER.LIVE : getTier(published_at),
      });
      if (items.length >= 8) break;
    }
  } else {
    const re = /<entry>([\s\S]*?)<\/entry>/gi; let m;
    while ((m = re.exec(result.data)) !== null) {
      const blk   = m[1];
      const vidId = (blk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || "").trim();
      if (!vidId || !isRealVideoId(vidId) || seen.has(vidId)) continue;
      seen.add(vidId);
      const raw   = blk.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
      const title = raw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (!title) continue;
      const pub  = blk.match(/<published>([^<]+)<\/published>/i)?.[1] || "";
      const ms   = pub ? new Date(pub).getTime() : Date.now();
      if (Date.now() - ms > 7 * 86_400_000) continue;
      const published_at = pub ? new Date(pub).toISOString() : new Date().toISOString();
      const liveStatus   = detectLiveStatus(title, published_at);
      items.push({
        _type: "video", id: `yt_${vidId}`, videoId: vidId, title,
        channelName: ch.name, category: ch.category,
        image_url: YT_THUMB(vidId), thumbnail: YT_THUMB(vidId),
        published_at, liveStatus,
        isLiveBroadcast: liveStatus === "live",
        tier: liveStatus === "live" ? TIER.LIVE : getTier(published_at),
      });
      if (items.length >= 8) break;
    }
  }
  return items;
}

async function upsertArticles(items) {
  if (!items.length) return;
  const dbItems = items.map(({ tier, liveStatus, _type, ...rest }) => rest);
  try {
    await supabase.from("news_posts").upsert(dbItems, { onConflict: "url_hash", ignoreDuplicates: true });
  } catch { /* silent */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// NewsRealtimeEngine — singleton
// ══════════════════════════════════════════════════════════════════════════════
class NewsRealtimeEngine {
  constructor() {
    this._listeners    = {};
    this._seenHashes   = new Set();
    this._seenVids     = new Set();
    this._inFeedHashes = new Set(); // [P4] tracks visible articles
    this._intervals    = [];
    this._rtChannel    = null;
    this._running      = false;
    this._bucketIdx    = 0;

    // [P5] Nigeria + global in 30s priority bucket
    this._prio = (RSS_SOURCES || []).filter((s) =>
      [
        "BBC News","Al Jazeera","Reuters","AP News","CNN World","Sky News",
        "DW News","VOA News","France 24","Bloomberg","The Guardian","Associated Press",
        "CoinDesk","CoinTelegraph","Decrypt",
        // Nigeria — first-class
        "Premium Times","Channels TV","Business Day NG","Punch Nigeria",
        "Vanguard Nigeria","The Cable","Daily Trust","Tribune Nigeria",
        "Sahara Reporters","ThisDay Nigeria","Guardian Nigeria",
        "New Telegraph NG","Daily Post Nigeria",
        // Africa
        "Daily Nation Kenya","News24","Africa News","The Africa Report",
      ].includes(s.name)
    );
    this._other   = (RSS_SOURCES || []).filter((s) => !this._prio.includes(s));
    this._buckets = [];
    for (let i = 0; i < this._other.length; i += 10) this._buckets.push(this._other.slice(i, i + 10));
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(cb);
    return () => this._listeners[event]?.delete(cb);
  }

  _emit(event, data) {
    this._listeners[event]?.forEach((cb) => { try { cb(data); } catch { /* silent */ } });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._startRealtime();
    this._fetchAllSources();
    this._intervals.push(setInterval(() => this._fetchBucket(this._prio), 30_000));
    if (this._buckets.length) {
      this._intervals.push(setInterval(() => {
        this._bucketIdx = (this._bucketIdx + 1) % this._buckets.length;
        this._fetchBucket(this._buckets[this._bucketIdx]);
      }, 60_000));
    }
    this._fetchAllVideos();
    this._intervals.push(setInterval(() => this._fetchAllVideos(), 4 * 60_000));
  }

  stop() {
    this._running = false;
    this._intervals.forEach(clearInterval);
    this._intervals = [];
    if (this._rtChannel) {
      try { supabase.removeChannel(this._rtChannel); } catch { /* silent */ }
      this._rtChannel = null;
    }
  }

  _startRealtime() {
    this._rtChannel = supabase
      .channel(`nre_v9_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_posts" }, (payload) => {
        const row = payload.new;
        if (!row?.is_active || !row.url_hash || this._seenHashes.has(row.url_hash)) return;
        this._seenHashes.add(row.url_hash);
        const liveStatus = detectLiveStatus(row.title || "", row.published_at || "");
        this._emit("newArticles", [{
          ...row, liveStatus,
          tier: liveStatus === "live" ? TIER.LIVE : getTier(row.published_at),
        }]);
      })
      .subscribe();
  }

  async _fetchAllSources() {
    if (!this._running) return;
    const all = [...this._prio, ...this._other];
    const BATCH = 15;
    for (let i = 0; i < all.length; i += BATCH) {
      if (!this._running) break;
      const results = await Promise.allSettled(all.slice(i, i + BATCH).map((s) => this._fetchOne(s)));
      const fresh = [];
      for (const r of results) { if (r.status === "fulfilled") fresh.push(...r.value); }
      if (fresh.length) { this._emit("newArticles", fresh); upsertArticles(fresh).catch(() => {}); }
      if (i + BATCH < all.length) await new Promise((r) => setTimeout(r, 500));
    }
  }

  async _fetchBucket(sources) {
    if (!this._running) return;
    const results = await Promise.allSettled(sources.map((s) => this._fetchOne(s)));
    const fresh = [];
    for (const r of results) { if (r.status === "fulfilled") fresh.push(...r.value); }
    if (fresh.length) { this._emit("newArticles", fresh); upsertArticles(fresh).catch(() => {}); }
  }

  async _fetchOne(source) {
    try {
      const xml = await fetchRss(source.url);
      if (!xml) return [];
      const items = await parseRssXml(xml, source);
      const fresh = [];
      for (const item of items) {
        if (!this._seenHashes.has(item.url_hash)) {
          this._seenHashes.add(item.url_hash);
          fresh.push(item);
        }
      }
      return fresh;
    } catch { return []; }
  }

  async _fetchAllVideos() {
    if (!this._running) return;
    const results = await Promise.allSettled(YT_CHANNELS.map(fetchYtChannel));
    const fresh = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const v of r.value) {
        if (!this._seenVids.has(v.videoId)) { this._seenVids.add(v.videoId); fresh.push(v); }
        else if (v.isLiveBroadcast) fresh.push(v);
      }
    }
    if (fresh.length) {
      this._emit("newVideos", fresh);
      const live = fresh.filter((v) => v.isLiveBroadcast);
      if (live.length) this._emit("liveDetected", live);
    }
  }

  seedSeen(articles = [], videos = []) {
    articles.forEach((a) => { if (a.url_hash) this._seenHashes.add(a.url_hash); });
    videos.forEach((v) => { if (v.videoId) this._seenVids.add(v.videoId); });
  }

  // [P4] In-feed tracking for accurate pending count
  seedInFeed(articles = []) {
    articles.forEach((a) => { if (a.url_hash) this._inFeedHashes.add(a.url_hash); });
  }
  isNewForFeed(hash) { return !this._inFeedHashes.has(hash); }
  markInFeed(articles = []) {
    articles.forEach((a) => { if (a.url_hash) this._inFeedHashes.add(a.url_hash); });
  }

  get prioritySources() { return this._prio; }
}

let _engine = null;
export function getNewsEngine() {
  if (!_engine) _engine = new NewsRealtimeEngine();
  return _engine;
}