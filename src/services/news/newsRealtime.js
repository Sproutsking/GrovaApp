// ============================================================================
// src/services/news/newsRealtime.js  — v7  ACCURATE + INSTANT
//
// KEY FIXES:
//  [F1] Pending count is ACCURATE — we track url_hashes already in the feed.
//       When engine emits articles, we check against _inFeedHashes before
//       adding to pendingRef. No more "300 pending" that disappear on flush.
//
//  [F2] _inFeedHashes is a Set exposed on the engine so NewsTab can seed it
//       after DB load. This ensures the engine never double-counts articles
//       already visible in the feed.
//
//  [F3] RSS via allorigins (no 422). YouTube via rss2json (no 404).
//
//  [F4] Cold boot batches ALL sources but emits each batch immediately
//       as it completes — not waiting for all to finish. Articles appear
//       progressively within seconds.
//
//  [F5] Nigeria first-class: Premium Times, Punch, Channels TV, Vanguard,
//       Business Day NG, The Cable, Daily Trust, Guardian Nigeria, Tribune,
//       Sahara Reporters, ThisDay, New Telegraph all in 30s priority bucket.
// ============================================================================

import { supabase } from "../config/supabase";
import { RSS_SOURCES } from "./clientNewsFetcher";

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
  const age    = publishedAt
    ? Date.now() - new Date(publishedAt).getTime()
    : Infinity;
  if (age < 3 * 60_000)                              return "live";
  if (liveRe.test(title) && age < 4 * 3_600_000)    return "live";
  if (liveRe.test(title) && age >= 4 * 3_600_000)   return "ended";
  return "none";
}

export function articleKey(a) {
  return a.url_hash || a.id || "";
}

export function filterByAge(articles) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return articles.filter((a) => {
    if (!a.published_at) return true;
    return new Date(a.published_at).getTime() > cutoff;
  });
}

// ── RSS fetch — allorigins primary, corsproxy fallback ────────────────────────
async function fetchRss(url) {
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (res.ok) {
      const j   = await res.json();
      const txt = j?.contents || "";
      if (txt.length > 300 && (txt.includes("<item") || txt.includes("<entry")))
        return txt;
    }
  } catch { /* try fallback */ }

  try {
    const res = await fetch(
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (res.ok) {
      const txt = await res.text();
      if (txt.length > 300 && (txt.includes("<item") || txt.includes("<entry")))
        return txt;
    }
  } catch { /* all failed */ }

  return null;
}

// ── YouTube fetch — rss2json only ─────────────────────────────────────────────
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
  } catch { /* try fallback */ }

  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(ytUrl)}`,
      { signal: AbortSignal.timeout(14_000) }
    );
    if (res.ok) {
      const j   = await res.json();
      const txt = j?.contents || "";
      if (txt.length > 200 && txt.includes("<entry"))
        return { type: "xml", data: txt };
    }
  } catch { /* all failed */ }

  return null;
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function tagVal(block, ...names) {
  for (const n of names) {
    const re = new RegExp(
      `<${n}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${n}>`, "i"
    );
    const m = block.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function stripHtml(h = "") {
  return h
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/\s+/g, " ").trim();
}

function extractImg(block) {
  const pats = [
    /media:content[^>]+url=["']([^"']+)["']/i,
    /media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /enclosure[^>]+url=["'](https?:\/\/[^"']+)["']/i,
    /<img[^>]+src=["'](https?:\/\/[^"']{20,})["']/i,
    /(https?:\/\/[^\s"'<>]{20,}\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/i,
  ];
  for (const re of pats) {
    const u = (block.match(re) || [])[1];
    if (u && u.startsWith("http") && u.length > 20 && !u.includes("1x1"))
      return u;
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

const ASSETS = [
  "BTC","ETH","SOL","BNB","XRP","ADA","DOGE","AVAX",
  "MATIC","LINK","UNI","TON","PEPE","SHIB","USDT","USDC",
];
function assetTag(t = "") {
  const up = t.toUpperCase();
  return ASSETS.find((a) => new RegExp(`\\b${a}\\b`).test(up)) ?? null;
}

async function quickHash(str) {
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  }
}

function normUrl(raw = "") {
  try {
    const u = new URL(raw.trim());
    ["utm_source","utm_medium","utm_campaign","ref","fbclid","gclid"]
      .forEach((k) => u.searchParams.delete(k));
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

    const rawDesc = tagVal(
      block, "content:encoded", "content", "summary", "description"
    );
    const description = stripHtml(rawDesc)
      .replace(/Read more[.:…]*$/i, "")
      .replace(/Continue reading[.:…]*$/i, "")
      .replace(/The post .+ appeared first on .+\.$/, "")
      .trim().slice(0, 600) || null;

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
      asset_tag:   source.category === "crypto"
        ? assetTag(`${title} ${description || ""}`) : null,
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

  const items = [];
  const seen  = new Set();

  if (result.type === "json") {
    for (const it of result.data.items || []) {
      const vidId = (it.link || "").match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1] || "";
      if (!vidId || !isRealVideoId(vidId) || seen.has(vidId)) continue;
      seen.add(vidId);
      const title = (it.title || "").trim();
      if (!title) continue;
      const pub  = it.pubDate || "";
      const ms   = pub ? new Date(pub).getTime() : Date.now();
      if (Date.now() - ms > 7 * 86_400_000) continue;
      const published_at = pub ? new Date(pub).toISOString() : new Date().toISOString();
      const liveStatus   = detectLiveStatus(title, published_at);
      items.push({
        _type: "video", id: `yt_${vidId}`, videoId: vidId,
        title, channelName: ch.name, category: ch.category,
        image_url:  it.thumbnail || YT_THUMB(vidId),
        thumbnail:  it.thumbnail || YT_THUMB(vidId),
        published_at, liveStatus,
        isLiveBroadcast: liveStatus === "live",
        tier: liveStatus === "live" ? TIER.LIVE : getTier(published_at),
      });
      if (items.length >= 8) break;
    }
  } else {
    const re = /<entry>([\s\S]*?)<\/entry>/gi;
    let m;
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
        _type: "video", id: `yt_${vidId}`, videoId: vidId,
        title, channelName: ch.name, category: ch.category,
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
    await supabase
      .from("news_posts")
      .upsert(dbItems, { onConflict: "url_hash", ignoreDuplicates: true });
  } catch { /* silent */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// NewsRealtimeEngine — singleton
// ══════════════════════════════════════════════════════════════════════════════
class NewsRealtimeEngine {
  constructor() {
    this._listeners  = {};
    this._seenHashes = new Set(); // hashes emitted to listeners this session
    this._seenVids   = new Set();
    this._intervals  = [];
    this._rtChannel  = null;
    this._running    = false;
    this._bucketIdx  = 0;

    // [F1] Track hashes currently IN the feed so we count pending accurately
    // NewsTab seeds this after DB load via seedInFeed()
    this._inFeedHashes = new Set();

    this._prio = (RSS_SOURCES || []).filter((s) =>
      [
        "BBC News","Al Jazeera","Reuters","AP News","CNN World",
        "Sky News","DW News","VOA News","France 24","Bloomberg",
        "The Guardian","Associated Press",
        "CoinDesk","CoinTelegraph","Decrypt",
        // Nigeria — first-class
        "Premium Times","Channels TV","Business Day NG","Punch Nigeria",
        "Vanguard Nigeria","The Cable","Daily Trust","Tribune Nigeria",
        "Sahara Reporters","ThisDay Nigeria","Guardian Nigeria",
        "New Telegraph NG","Daily Post Nigeria",
        // Africa
        "Daily Nation Kenya","News24","Africa News",
      ].includes(s.name)
    );

    this._other = (RSS_SOURCES || []).filter((s) => !this._prio.includes(s));
    this._buckets = [];
    for (let i = 0; i < this._other.length; i += 10) {
      this._buckets.push(this._other.slice(i, i + 10));
    }
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(cb);
    return () => this._listeners[event]?.delete(cb);
  }

  _emit(event, data) {
    this._listeners[event]?.forEach((cb) => {
      try { cb(data); } catch { /* silent */ }
    });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._startRealtime();
    this._fetchAllSources(); // immediate cold boot
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
      .channel(`nre_v7_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "news_posts" },
        (payload) => {
          const row = payload.new;
          if (!row?.is_active) return;
          if (!row.url_hash || this._seenHashes.has(row.url_hash)) return;
          this._seenHashes.add(row.url_hash);
          const liveStatus = detectLiveStatus(row.title || "", row.published_at || "");
          this._emit("newArticles", [{
            ...row, liveStatus,
            tier: liveStatus === "live" ? TIER.LIVE : getTier(row.published_at),
          }]);
        }
      )
      .subscribe();
  }

  // [F4] Emit each batch as it completes — don't wait for all
  async _fetchAllSources() {
    if (!this._running) return;
    const all = [...this._prio, ...this._other];
    const BATCH = 15;
    for (let i = 0; i < all.length; i += BATCH) {
      if (!this._running) break;
      const results = await Promise.allSettled(
        all.slice(i, i + BATCH).map((s) => this._fetchOne(s))
      );
      const fresh = [];
      for (const r of results) {
        if (r.status === "fulfilled") fresh.push(...r.value);
      }
      if (fresh.length) {
        this._emit("newArticles", fresh);
        upsertArticles(fresh).catch(() => {});
      }
      if (i + BATCH < all.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  async _fetchBucket(sources) {
    if (!this._running) return;
    const results = await Promise.allSettled(sources.map((s) => this._fetchOne(s)));
    const fresh = [];
    for (const r of results) {
      if (r.status === "fulfilled") fresh.push(...r.value);
    }
    if (fresh.length) {
      this._emit("newArticles", fresh);
      upsertArticles(fresh).catch(() => {});
    }
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
    const fresh   = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const v of r.value) {
        if (!this._seenVids.has(v.videoId)) {
          this._seenVids.add(v.videoId);
          fresh.push(v);
        } else if (v.isLiveBroadcast) {
          fresh.push(v); // re-emit to update live status
        }
      }
    }
    if (fresh.length) {
      this._emit("newVideos", fresh);
      const live = fresh.filter((v) => v.isLiveBroadcast);
      if (live.length) this._emit("liveDetected", live);
    }
  }

  // Seed seen hashes from DB articles already loaded (prevents re-emit)
  seedSeen(articles = [], videos = []) {
    articles.forEach((a) => { if (a.url_hash) this._seenHashes.add(a.url_hash); });
    videos.forEach((v) => { if (v.videoId) this._seenVids.add(v.videoId); });
  }

  // [F1][F2] Seed in-feed hashes so pending count is accurate
  seedInFeed(articles = []) {
    articles.forEach((a) => { if (a.url_hash) this._inFeedHashes.add(a.url_hash); });
  }

  // Check if an article is truly new (not already in the feed)
  isNewForFeed(urlHash) {
    return !this._inFeedHashes.has(urlHash);
  }

  // Mark articles as now in feed (called after flush)
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