// ============================================================================
// src/services/news/newsRealtime.js  — v4  SCHEMA-AWARE, COMPLETE
//
// KEY FACTS about news_posts schema (no is_video column):
//   id           uuid (PK, always present in DB rows)
//   url_hash     text UNIQUE (always present, computed from article URL)
//   published_at timestamp
//   is_active    boolean
//
// DEDUP STRATEGY:
//   DB rows  → key = url_hash (every DB row has url_hash UNIQUE)
//   RSS rows → key = url_hash (computed from normalized URL)
//   Both use url_hash as canonical key — perfect dedup, no duplicates.
//
// LIVE DETECTION (precise):
//   "live"  = title has live keyword AND published < 4h ago
//             OR published < 3 minutes ago (just started)
//   "ended" = title has live keyword AND published >= 4h ago
//   "none"  = everything else
//
// DELIVERY:
//   [D1] Supabase Realtime INSERT → instant push (~200ms after DB write)
//   [D2] RSS polling: ALL sources on cold boot, priority every 30s, others rotate 60s
//   [D3] YouTube RSS every 3 minutes
//   [D4] Live stream check every 90 seconds
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
  if (age < 0)             return TIER.RECENT;
  if (age < 5 * 60_000)   return TIER.BREAKING;
  if (age < 60 * 60_000)  return TIER.FRESH;
  if (age < MAX_AGE_MS)   return TIER.RECENT;
  return TIER.ARCHIVE;
}

export function detectLiveStatus(title = "", publishedAt = "") {
  const liveRe = /\blive\s*(stream|now|coverage|feed|broadcast)?\b/i;
  const age    = publishedAt ? Date.now() - new Date(publishedAt).getTime() : Infinity;
  if (age < 3 * 60_000) return "live";
  if (liveRe.test(title) && age < 4 * 3_600_000) return "live";
  if (liveRe.test(title) && age >= 4 * 3_600_000) return "ended";
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

// ── CORS proxy race ───────────────────────────────────────────────────────────
const PROXIES = [
  (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function fetchXml(url) {
  try {
    return await Promise.any(PROXIES.map(async (p) => {
      const res = await fetch(p(url), {
        signal: AbortSignal.timeout(9_000),
        headers: { Accept: "application/json, application/xml, text/xml, */*" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      const txt = ct.includes("json") ? (await res.json())?.contents || "" : await res.text();
      if (!txt || txt.length < 100 || (!txt.includes("<item") && !txt.includes("<entry"))) {
        throw new Error("empty");
      }
      return txt;
    }));
  } catch { return null; }
}

function tagVal(block, ...names) {
  for (const n of names) {
    const re = new RegExp(`<${n}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${n}>`, "i");
    const m = block.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function stripHtml(h = "") {
  return h
    .replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&hellip;/gi, "…").replace(/\s+/g, " ").trim();
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
    if (u && u.startsWith("http") && u.length > 20 && !u.includes("1x1")) return u;
  }
  return null;
}

function extractDate(block, articleUrl = "") {
  const fields = [
    /< *pubDate[^>]*>([^<]+)<\/pubDate>/i,
    /< *published[^>]*>([^<]+)<\/published>/i,
    /< *updated[^>]*>([^<]+)<\/updated>/i,
    /< *dc:date[^>]*>([^<]+)<\/dc:date>/i,
    /< *date[^>]*>([^<]+)<\/date>/i,
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

async function parseSource(xml, source) {
  const now = Date.now();
  const cutoff = now - MAX_AGE_MS;
  const re = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
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

    const hash = await quickHash(normUrl(articleUrl));
    const liveStatus = detectLiveStatus(title, published_at);

    results.push({
      title, description,
      image_url: extractImg(block),
      source_name: source.name,
      source_url: source.url,
      article_url: articleUrl,
      category: source.category,
      region: source.region ?? null,
      asset_tag: source.category === "crypto" ? assetTag(`${title} ${description || ""}`) : null,
      url_hash: hash,
      published_at,
      is_active: true,
      liveStatus,
      tier: liveStatus === "live" ? TIER.LIVE : getTier(published_at),
    });
  }
  return results;
}

// ── YouTube channels ──────────────────────────────────────────────────────────
const YT_CHANNELS = [
  { id: "UCnUYZLuoy1rq1aVMwx4aTzw", name: "BBC News",     category: "global" },
  { id: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News",      category: "global" },
  { id: "UCNye-wNBqNL5ZzHSJdde7RA", name: "Al Jazeera",   category: "global" },
  { id: "UCQfwfsi5VrQ8yKZ-UWmAEFg", name: "France 24",    category: "global" },
  { id: "UC7fWeaHhqgM4Ry-RMpM2YYw", name: "TRT World",    category: "global" },
  { id: "UC-7dRiGmmKOUkBu-gKVQf2g", name: "Sky News",     category: "global" },
  { id: "UCIdojUGDCXFLiGTEMeL5kxQ", name: "CGTN",         category: "global" },
  { id: "UCIALMKvObZNtJ6AmdCLP7Lg", name: "Bloomberg TV", category: "global" },
  { id: "UCupvZG-5ko_eiXAupbDfxWw", name: "CNN",          category: "global" },
  { id: "UCVSNOxehfALut52-3bfvSHg", name: "VOA News",     category: "global" },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters",      category: "global" },
  { id: "UC8nNHDCBk5RoUg10L-Lktjg", name: "AP",           category: "global" },
  { id: "UCJXGnHCHApDirWSmAZ0uxkQ", name: "Arise News",   category: "africa" },
  { id: "UCCjyq_K1Pd2QkMOoAc73yqA", name: "Channels TV",  category: "africa" },
  { id: "UCG9_Hz8tMHdM5i5EzQpSPaQ", name: "Africa News",  category: "africa" },
  { id: "UCrbatV49TNrqfoPLEJqJiuw", name: "CoinDesk TV",  category: "crypto" },
  { id: "UCAl9Ld79qaZxp9JzEOwd3aA", name: "Bankless",     category: "crypto" },
];

// Live stream channels — fetch their latest video to get real current stream ID
export const LIVE_CHANNELS = [
  { channelId: "UCNye-wNBqNL5ZzHSJdde7RA", channelName: "Al Jazeera", category: "global" },
  { channelId: "UCknLrEdhRCp1aegoMqRaCZg", channelName: "DW News",    category: "global" },
  { channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg", channelName: "France 24",  category: "global" },
  { channelId: "UC7fWeaHhqgM4Ry-RMpM2YYw", channelName: "TRT World",  category: "global" },
  { channelId: "UC-7dRiGmmKOUkBu-gKVQf2g", channelName: "Sky News",   category: "global" },
  { channelId: "UCJXGnHCHApDirWSmAZ0uxkQ", channelName: "Arise News", category: "africa" },
];

function isRealVideoId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
}

const YT_THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

async function fetchYtChannel(ch) {
  const xml = await fetchXml(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`);
  if (!xml) return [];
  const items = []; const seen = new Set();
  const re = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const blk = m[1];
    const vidId = (blk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || "").trim();
    if (!vidId || !isRealVideoId(vidId) || seen.has(vidId)) continue;
    seen.add(vidId);
    const raw = blk.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
    const title = raw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (!title) continue;
    const pub = blk.match(/<published>([^<]+)<\/published>/i)?.[1] || "";
    const ms = pub ? new Date(pub).getTime() : Date.now();
    if (Date.now() - ms > 7 * 86_400_000) continue;
    const published_at = pub ? new Date(pub).toISOString() : new Date().toISOString();
    const liveStatus = detectLiveStatus(title, published_at);
    items.push({
      _type: "video",
      id: `yt_${vidId}`,
      videoId: vidId,
      title,
      channelName: ch.name,
      category: ch.category,
      image_url: YT_THUMB(vidId),
      thumbnail: YT_THUMB(vidId),
      published_at,
      liveStatus,
      isLiveBroadcast: liveStatus === "live",
      tier: liveStatus === "live" ? TIER.LIVE : getTier(published_at),
    });
    if (items.length >= 8) break;
  }
  return items;
}

async function fetchLiveChannelLatest(ch) {
  const xml = await fetchXml(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`);
  if (!xml) return null;
  const re = /<entry>([\s\S]*?)<\/entry>/i;
  const m = xml.match(re);
  if (!m) return null;
  const blk = m[1];
  const vidId = (blk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || "").trim();
  if (!vidId || !isRealVideoId(vidId)) return null;
  const raw = blk.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || "";
  const title = raw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  const pub = blk.match(/<published>([^<]+)<\/published>/i)?.[1] || "";
  const published_at = pub ? new Date(pub).toISOString() : new Date().toISOString();
  const liveStatus = detectLiveStatus(title, published_at);
  return {
    _type: "video",
    id: `yt_live_${vidId}`,
    videoId: vidId,
    title: liveStatus === "live" ? title : `${ch.channelName} — Latest`,
    channelName: ch.channelName,
    category: ch.category,
    image_url: YT_THUMB(vidId),
    thumbnail: YT_THUMB(vidId),
    published_at,
    liveStatus,
    isLiveBroadcast: liveStatus === "live",
    tier: liveStatus === "live" ? TIER.LIVE : getTier(published_at),
  };
}

async function upsertArticles(items) {
  if (!items.length) return;
  const dbItems = items.map(({ tier, liveStatus, ...rest }) => rest);
  try {
    await supabase.from("news_posts").upsert(dbItems, { onConflict: "url_hash", ignoreDuplicates: true });
  } catch { /* ignore */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// NewsRealtimeEngine — singleton
// ══════════════════════════════════════════════════════════════════════════════
class NewsRealtimeEngine {
  constructor() {
    this._listeners  = {};
    this._seenHashes = new Set();
    this._seenVids   = new Set();
    this._intervals  = [];
    this._rtChannel  = null;
    this._running    = false;
    this._bucketIdx  = 0;

    this._prio = (RSS_SOURCES || []).filter((s) =>
      ["BBC News","Al Jazeera","Reuters","AP News","CNN World","CoinDesk",
       "CoinTelegraph","Premium Times","Channels TV","Business Day NG",
       "Punch Nigeria","Daily Nation Kenya","The Guardian","Sky News",
       "Bloomberg TV","DW News","VOA News","Deutsche Welle"].includes(s.name)
    );
    this._other = (RSS_SOURCES || []).filter((s) => !this._prio.includes(s));
    this._buckets = [];
    for (let i = 0; i < this._other.length; i += 12) {
      this._buckets.push(this._other.slice(i, i + 12));
    }
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(cb);
    return () => this._listeners[event]?.delete(cb);
  }

  _emit(event, data) {
    this._listeners[event]?.forEach((cb) => { try { cb(data); } catch { /* ignore */ } });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._startRealtime();
    this._fetchAllSources();
    this._intervals.push(setInterval(() => this._fetchBucket(this._prio), 30_000));
    this._intervals.push(setInterval(() => {
      if (!this._buckets.length) return;
      this._bucketIdx = (this._bucketIdx + 1) % this._buckets.length;
      this._fetchBucket(this._buckets[this._bucketIdx]);
    }, 60_000));
    this._fetchAllVideos();
    this._intervals.push(setInterval(() => this._fetchAllVideos(), 3 * 60_000));
    this._checkLiveChannels();
    this._intervals.push(setInterval(() => this._checkLiveChannels(), 90_000));
  }

  stop() {
    this._running = false;
    this._intervals.forEach(clearInterval);
    this._intervals = [];
    if (this._rtChannel) {
      try { supabase.removeChannel(this._rtChannel); } catch { /* ignore */ }
      this._rtChannel = null;
    }
  }

  _startRealtime() {
    this._rtChannel = supabase
      .channel(`nre_v4_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_posts" }, (payload) => {
        const row = payload.new;
        if (!row?.is_active) return;
        if (!row.url_hash || this._seenHashes.has(row.url_hash)) return;
        this._seenHashes.add(row.url_hash);
        const liveStatus = detectLiveStatus(row.title || "", row.published_at || "");
        this._emit("newArticles", [{
          ...row,
          liveStatus,
          tier: liveStatus === "live" ? TIER.LIVE : getTier(row.published_at),
        }]);
      })
      .subscribe();
  }

  async _fetchAllSources() {
    if (!this._running) return;
    const all = [...this._prio, ...this._other];
    const results = await Promise.allSettled(all.map((s) => this._fetchOne(s)));
    const fresh = [];
    for (const r of results) {
      if (r.status === "fulfilled") fresh.push(...r.value);
    }
    if (fresh.length) {
      this._emit("newArticles", fresh);
      upsertArticles(fresh).catch(() => {});
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
    const xml = await fetchXml(source.url);
    if (!xml) return [];
    const items = await parseSource(xml, source);
    const fresh = [];
    for (const item of items) {
      if (!this._seenHashes.has(item.url_hash)) {
        this._seenHashes.add(item.url_hash);
        fresh.push(item);
      }
    }
    return fresh;
  }

  async _fetchAllVideos() {
    if (!this._running) return;
    const results = await Promise.allSettled(YT_CHANNELS.map(fetchYtChannel));
    const fresh = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const v of r.value) {
        if (!this._seenVids.has(v.videoId)) { this._seenVids.add(v.videoId); fresh.push(v); }
      }
    }
    if (fresh.length) this._emit("newVideos", fresh);
  }

  async _checkLiveChannels() {
    if (!this._running) return;
    const results = await Promise.allSettled(LIVE_CHANNELS.map(fetchLiveChannelLatest));
    const vids = [];
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      vids.push(r.value);
    }
    if (vids.length) {
      this._emit("newVideos", vids);
      const live = vids.filter((v) => v.isLiveBroadcast);
      if (live.length) this._emit("liveDetected", live);
    }
  }

  seedSeen(articles = [], videos = []) {
    articles.forEach((a) => { if (a.url_hash) this._seenHashes.add(a.url_hash); });
    videos.forEach((v) => { if (v.videoId) this._seenVids.add(v.videoId); });
  }

  get prioritySources() { return this._prio; }
}

let _engine = null;
export function getNewsEngine() {
  if (!_engine) _engine = new NewsRealtimeEngine();
  return _engine;
}