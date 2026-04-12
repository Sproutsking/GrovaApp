// ============================================================================
// src/services/news/newsFetcher.js  — v4  VIDEO + ARTICLE FEEDS
//
// KEY CHANGES vs v3:
//  [YT1] Added 16 YouTube channel RSS feeds as dedicated video sources.
//        YouTube publishes public Atom feeds (no API key required):
//        https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
//        These are fetched server-side by the cron — no CORS issues.
//  [YT2] Video rows are stored in news_posts with is_video=true and
//        video_id=<youtubeVideoId>. article_url = youtube watch URL.
//        image_url = YouTube hqdefault thumbnail.
//  [YT3] YouTube Atom feed parser added — completely separate from RSS parser.
//  [YT4] VIDEO_SOURCES list kept separate from NEWS_SOURCES for clarity.
//        runVideoFetchCycle() exported for independent cron scheduling.
//  [YT5] Video dedup key = video_id (not url_hash) to prevent re-insertion
//        of the same video from multiple runs.
//  [R1–R7] All previous article reliability improvements retained.
// ============================================================================

import Parser from "rss-parser";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ── Supabase service-role client ──────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ── Config ────────────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 8_000;

const USER_AGENTS = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (compatible; XeeviaNewsBot/4.0; +https://xeevia.com/bot)",
  "feedparser/6.0 (+https://feedparser.readthedocs.io/en/latest/)",
];
const pickUA = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// ── rss-parser instance ───────────────────────────────────────────────────────
const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": pickUA(),
    Accept:
      "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
  },
  customFields: {
    feed: [
      ["image", "feedImage"],
      ["logo", "feedLogo"],
    ],
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["media:group", "mediaGroup"],
      ["enclosure", "enclosure"],
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "creator"],
      ["yt:videoId", "ytVideoId"],
      ["yt:channelId", "ytChannelId"],
      ["media:description", "mediaDescription"],
    ],
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// ARTICLE SOURCES — 38 verified RSS outlets
// ══════════════════════════════════════════════════════════════════════════════
export const NEWS_SOURCES = [
  // ── GLOBAL ─────────────────────────────────────────────────────────────────
  {
    name: "BBC News",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
    category: "global",
    region: "uk",
  },
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "global",
    region: "international",
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    category: "global",
    region: "international",
  },
  {
    name: "France 24",
    url: "https://www.france24.com/en/rss",
    category: "global",
    region: "international",
  },
  {
    name: "Deutsche Welle",
    url: "https://rss.dw.com/rdf/rss-en-all",
    category: "global",
    region: "international",
  },
  {
    name: "The Guardian",
    url: "https://www.theguardian.com/world/rss",
    category: "global",
    region: "uk",
  },
  {
    name: "AP News",
    url: "https://feeds.apnews.com/rss/apf-topnews",
    category: "global",
    region: "us",
  },
  {
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    category: "global",
    region: "us",
  },
  {
    name: "CNN World",
    url: "http://rss.cnn.com/rss/edition_world.rss",
    category: "global",
    region: "us",
  },
  {
    name: "Sky News",
    url: "https://feeds.skynews.com/feeds/rss/world.xml",
    category: "global",
    region: "uk",
  },
  {
    name: "Euronews",
    url: "https://www.euronews.com/rss?format=mrss&level=theme&name=news",
    category: "global",
    region: "international",
  },
  {
    name: "The Independent",
    url: "https://www.independent.co.uk/news/world/rss",
    category: "global",
    region: "uk",
  },
  {
    name: "Time",
    url: "https://time.com/feed/",
    category: "global",
    region: "us",
  },
  {
    name: "Politico",
    url: "https://www.politico.com/rss/politicopicks.xml",
    category: "global",
    region: "us",
  },
  // ── AFRICA ─────────────────────────────────────────────────────────────────
  {
    name: "The Africa Report",
    url: "https://www.theafricareport.com/feed/",
    category: "africa",
    region: "africa",
  },
  {
    name: "Premium Times",
    url: "https://www.premiumtimesng.com/feed",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Business Day NG",
    url: "https://businessday.ng/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Punch Nigeria",
    url: "https://punchng.com/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Vanguard Nigeria",
    url: "https://www.vanguardngr.com/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Daily Nation Kenya",
    url: "https://nation.africa/kenya/rss.xml",
    category: "africa",
    region: "kenya",
  },
  {
    name: "The Citizen SA",
    url: "https://www.citizen.co.za/feed/",
    category: "africa",
    region: "south-africa",
  },
  {
    name: "Africa News",
    url: "https://www.africanews.com/feed/rss",
    category: "africa",
    region: "africa",
  },
  {
    name: "Daily Trust",
    url: "https://dailytrust.com/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Guardian Nigeria",
    url: "https://guardian.ng/feed/",
    category: "africa",
    region: "nigeria",
  },
  // ── BUSINESS & TECH ────────────────────────────────────────────────────────
  {
    name: "Business Insider",
    url: "https://feeds.businessinsider.com/~r/businessinsider/~3/",
    category: "global",
    region: "us",
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    category: "global",
    region: "us",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    category: "global",
    region: "us",
  },
  {
    name: "Wired",
    url: "https://www.wired.com/feed/rss",
    category: "global",
    region: "us",
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "global",
    region: "us",
  },
  {
    name: "MIT Tech Review",
    url: "https://www.technologyreview.com/feed/",
    category: "global",
    region: "us",
  },
  // ── CRYPTO ─────────────────────────────────────────────────────────────────
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    category: "crypto",
    region: null,
  },
  {
    name: "CoinTelegraph",
    url: "https://cointelegraph.com/rss",
    category: "crypto",
    region: null,
  },
  {
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    category: "crypto",
    region: null,
  },
  {
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    category: "crypto",
    region: null,
  },
  {
    name: "CryptoSlate",
    url: "https://cryptoslate.com/feed/",
    category: "crypto",
    region: null,
  },
  {
    name: "Bitcoin Magazine",
    url: "https://bitcoinmagazine.com/.rss/full/",
    category: "crypto",
    region: null,
  },
  {
    name: "Blockworks",
    url: "https://blockworks.co/feed",
    category: "crypto",
    region: null,
  },
  {
    name: "BeInCrypto",
    url: "https://beincrypto.com/feed/",
    category: "crypto",
    region: null,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// [YT1] VIDEO SOURCES — YouTube channel Atom feeds (no API key needed)
//       Format: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
// ══════════════════════════════════════════════════════════════════════════════
export const VIDEO_SOURCES = [
  // ── GLOBAL VIDEO NEWS ──────────────────────────────────────────────────────
  {
    name: "Al Jazeera English",
    channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg",
    category: "global",
  },
  {
    name: "BBC News",
    channelId: "UC16niRr50-MSBwiO3Me4ReA",
    category: "global",
  },
  {
    name: "DW News",
    channelId: "UCknLrEdhRCp1aegoMqRaCZg",
    category: "global",
  },
  {
    name: "France 24 English",
    channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg",
    category: "global",
  },
  {
    name: "Reuters",
    channelId: "UChqUTb7kYRX8-EiaN3XFrSQ",
    category: "global",
  },
  {
    name: "Associated Press",
    channelId: "UC8nNHDCBk5RoUg10L-Lktjg",
    category: "global",
  },
  {
    name: "Sky News",
    channelId: "UCoMdktPbSTixAyNGwb-UYkQ",
    category: "global",
  },
  {
    name: "Euronews",
    channelId: "UCQiMOCcqyN9EzWxMCWFXTkA",
    category: "global",
  },
  {
    name: "TRT World",
    channelId: "UC7fWeaHhqgM4Ry-RMpM2YYw",
    category: "global",
  },
  {
    name: "VOA News",
    channelId: "UCVSNOxehfALut52-3bfvSHg",
    category: "global",
  },
  {
    name: "NHK World",
    channelId: "UCCLMKrsq2YjBjKFzfnEWGdQ",
    category: "global",
  },
  { name: "CGTN", channelId: "UCHGMJPtXMTGFPMiozOCQNzA", category: "global" },
  { name: "CNN", channelId: "UCupvZG-5ko_eiXAupbDfxWw", category: "global" },
  // ── AFRICA VIDEO NEWS ──────────────────────────────────────────────────────
  {
    name: "Channels TV Nigeria",
    channelId: "UCIUEiQeYGt5OdEWR9TRsong",
    category: "africa",
  },
  {
    name: "Africa News",
    channelId: "UCG9_Hz8tMHdM5i5EzQpSPaQ",
    category: "africa",
  },
  {
    name: "NTA Nigeria",
    channelId: "UCU6HGAmN_-5sFqSfnVn-Nyg",
    category: "africa",
  },
  // ── CRYPTO VIDEO NEWS ──────────────────────────────────────────────────────
  {
    name: "CoinDesk TV",
    channelId: "UCrbatV49TNrqfoPLEJqJiuw",
    category: "crypto",
  },
  {
    name: "Decrypt Media",
    channelId: "UCJb9YP9K3XuSv8UNUxEyT_Q",
    category: "crypto",
  },
  {
    name: "Bankless",
    channelId: "UCAl9Ld79qaZxp9JzEOwd3aA",
    category: "crypto",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Circuit breaker (shared for both article + video sources)
// ══════════════════════════════════════════════════════════════════════════════
const _circuitBreaker = new Map();

function isCircuitOpen(key) {
  const cb = _circuitBreaker.get(key);
  if (!cb) return false;
  if (cb.until && Date.now() < cb.until) return true;
  if (cb.until && Date.now() >= cb.until) {
    _circuitBreaker.delete(key);
    return false;
  }
  return false;
}

function recordFailure(key) {
  const cb = _circuitBreaker.get(key) || { failures: 0, until: null };
  cb.failures += 1;
  if (cb.failures >= 3) {
    cb.until = Date.now() + 30 * 60_000;
    console.warn(`[NewsFetcher] Circuit open for ${key} (30 min cooldown)`);
  }
  _circuitBreaker.set(key, cb);
}

function recordSuccess(key) {
  _circuitBreaker.delete(key);
}

// ══════════════════════════════════════════════════════════════════════════════
// Article helpers (unchanged from v3)
// ══════════════════════════════════════════════════════════════════════════════
const ASSET_TOKENS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "DOT",
  "ATOM",
  "LTC",
  "BCH",
  "XLM",
  "TRX",
  "ETC",
  "XMR",
  "MATIC",
  "ARB",
  "OP",
  "LINK",
  "UNI",
  "AAVE",
  "CRV",
  "MKR",
  "COMP",
  "NEAR",
  "APT",
  "SUI",
  "SEI",
  "INJ",
  "PYTH",
  "TIA",
  "JUP",
  "WIF",
  "BONK",
  "PEPE",
  "FLOKI",
  "SHIB",
  "TON",
  "ICP",
  "FIL",
  "GRT",
  "LDO",
  "FTM",
  "ALGO",
  "HBAR",
  "SAND",
  "MANA",
  "AXS",
  "USDT",
  "USDC",
  "DAI",
  "STETH",
  "WBTC",
  "GMX",
  "PERP",
  "THETA",
  "FLOW",
  "VET",
];

function extractAssetTag(text = "") {
  const upper = text.toUpperCase();
  return ASSET_TOKENS.find((a) => new RegExp(`\\b${a}\\b`).test(upper)) ?? null;
}

function stripHtml(html = "") {
  return html
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
    .replace(/\[…\]|\[…\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(raw = "") {
  let t = stripHtml(raw).slice(0, 700);
  t = t
    .replace(/Read more[.:…]*$/i, "")
    .replace(/Continue reading[.:…]*$/i, "")
    .replace(/Click here to read more[.:…]*/i, "")
    .replace(/The post .+ appeared first on .+\.$/, "")
    .trim();
  return t || null;
}

function sanitiseImageUrl(url) {
  if (!url || typeof url !== "string") return null;
  const t = url.trim();
  if (!t.startsWith("http")) return null;
  const low = t.toLowerCase();
  if (
    low.includes("pixel.gif") ||
    low.includes("1x1") ||
    low.includes("spacer") ||
    low.includes("doubleclick") ||
    low.includes("googlesyndication") ||
    low.endsWith(".svg") ||
    t.length < 20
  )
    return null;
  return t;
}

function extractImage(item) {
  const fromMedia =
    sanitiseImageUrl(item.mediaContent?.["$"]?.url) ??
    sanitiseImageUrl(item.mediaThumbnail?.["$"]?.url) ??
    sanitiseImageUrl(item.mediaGroup?.["media:content"]?.[0]?.["$"]?.url) ??
    sanitiseImageUrl(item.enclosure?.url) ??
    sanitiseImageUrl(item["media:content"]?.["$"]?.url) ??
    null;
  if (fromMedia) return fromMedia;

  const encoded = item.contentEncoded || item.content || item.summary || "";
  if (!encoded) return null;

  const og =
    encoded.match(
      /property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']{20,})["']/i,
    ) ||
    encoded.match(
      /content=["'](https?:\/\/[^"']{20,})["'][^>]+property=["']og:image["']/i,
    );
  if (og) {
    const u = sanitiseImageUrl(og[1]);
    if (u) return u;
  }

  const tw = encoded.match(
    /twitter:image["'][^>]+content=["'](https?:\/\/[^"']{20,})["']/i,
  );
  if (tw) {
    const u = sanitiseImageUrl(tw[1]);
    if (u) return u;
  }

  const imgs = [
    ...encoded.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']{20,})["'][^>]*/gi),
  ];
  for (const m of imgs) {
    const u = sanitiseImageUrl(m[1]);
    if (!u) continue;
    const wm = m[0].match(/width=["']?(\d+)["']?/i);
    if (wm && parseInt(wm[1]) < 200) continue;
    return u;
  }
  if (imgs.length > 0) {
    const u = sanitiseImageUrl(imgs[0][1]);
    if (u) return u;
  }

  const anySrc = encoded.match(
    /src=["'](https?:\/\/[^"']{30,}\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)/i,
  );
  if (anySrc) return sanitiseImageUrl(anySrc[1]);
  return null;
}

const STRIP_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "source",
  "via",
  "fbclid",
  "gclid",
  "cid",
  "mc_cid",
  "mc_eid",
  "s",
  "WT.mc_id",
  "ICID",
  "ncid",
  "taid",
];

function normaliseUrl(rawUrl = "") {
  try {
    const u = new URL(rawUrl.trim());
    STRIP_PARAMS.forEach((k) => u.searchParams.delete(k));
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.hash = "";
    return u.href.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function urlHash(url = "") {
  return crypto.createHash("sha256").update(normaliseUrl(url)).digest("hex");
}

function isReadable(title = "") {
  if (title.length < 15) return false;
  if (/^\[.*\]$/.test(title.trim())) return false;
  if (/^advertisement$/i.test(title.trim())) return false;
  return true;
}

// ── Normalise one RSS item → DB article row ───────────────────────────────────
function normaliseArticleItem(item, source) {
  const articleUrl = (item.link || item.guid || "").trim();
  if (!articleUrl.startsWith("http")) return null;

  const title = stripHtml(item.title || "").slice(0, 300);
  if (!title || !isReadable(title)) return null;

  const description = cleanDescription(
    item.contentSnippet ||
      item.content ||
      item.summary ||
      item.description ||
      item.contentEncoded ||
      "",
  );

  let published_at;
  try {
    published_at = new Date(
      item.pubDate ?? item.isoDate ?? Date.now(),
    ).toISOString();
    const ms = new Date(published_at).getTime();
    const now = Date.now();
    if (ms > now + 3_600_000) return null;
    if (now - ms > 7 * 86_400_000) return null;
  } catch {
    published_at = new Date().toISOString();
  }

  return {
    title,
    description,
    image_url: extractImage(item),
    source_name: source.name,
    source_url: source.url,
    article_url: articleUrl,
    category: source.category,
    region: source.region ?? null,
    asset_tag:
      source.category === "crypto"
        ? extractAssetTag(`${title} ${description || ""}`)
        : null,
    url_hash: urlHash(normaliseUrl(articleUrl)),
    published_at,
    is_active: true,
    is_video: false,
    video_id: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// [YT3] YouTube Atom feed parser
// ══════════════════════════════════════════════════════════════════════════════
function decodeXmlEntities(str = "") {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function parseYouTubeAtom(xml, source) {
  const items = [];
  const entryRx = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;

  while ((m = entryRx.exec(xml)) !== null) {
    const block = m[1];

    // Extract video ID
    const videoId = (block.match(
      /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/,
    ) || block.match(/watch\?v=([A-Za-z0-9_-]{11})/))?.[1];
    if (!videoId) continue;

    const title = decodeXmlEntities(
      (block.match(/<title>([^<]+)<\/title>/) || [])[1] || "",
    );
    if (!title || title.length < 10) continue;

    // Skip live streams — they don't embed as cleanly
    if (/\blive\s*(stream|now|coverage)\b/i.test(title)) continue;

    const published =
      (block.match(/<published>([^<]+)<\/published>/) || [])[1] ||
      new Date().toISOString();

    let published_at;
    try {
      published_at = new Date(published).toISOString();
      const ms = new Date(published_at).getTime();
      const now = Date.now();
      if (ms > now + 3_600_000) continue; // future
      if (now - ms > 3 * 86_400_000) continue; // older than 3 days for video
    } catch {
      published_at = new Date().toISOString();
    }

    const description = decodeXmlEntities(
      (block.match(/<media:description>([\s\S]*?)<\/media:description>/) ||
        [])[1] || "",
    ).slice(0, 400);

    // YouTube hqdefault thumbnail — always available, no API key
    const thumbnailFromFeed =
      (block.match(/<media:thumbnail[^>]+url="([^"]+)"/) || [])[1] || null;
    const image_url =
      thumbnailFromFeed || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const article_url = `https://www.youtube.com/watch?v=${videoId}`;

    items.push({
      title: title.slice(0, 300),
      description: description || null,
      image_url,
      source_name: source.name,
      source_url: `https://www.youtube.com/channel/${source.channelId}`,
      article_url,
      category: source.category,
      region: null,
      asset_tag:
        source.category === "crypto"
          ? extractAssetTag(`${title} ${description}`)
          : null,
      // [YT2] url_hash keyed on video ID so it's stable across runs
      url_hash: urlHash(`youtube:${videoId}`),
      published_at,
      is_active: true,
      is_video: true,
      video_id: videoId,
    });
  }
  return items;
}

// ── Fetch one YouTube channel ─────────────────────────────────────────────────
async function fetchYouTubeChannel(source) {
  const key = `yt:${source.channelId}`;
  if (isCircuitOpen(key)) {
    return {
      source: source.name,
      items: [],
      error: "circuit open",
      skipped: true,
    };
  }

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  const t0 = Date.now();

  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": pickUA(),
        Accept: "application/atom+xml, application/xml, text/xml, */*",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const items = parseYouTubeAtom(xml, source).slice(0, 8); // max 8 videos per channel per run

    recordSuccess(key);
    console.log(
      `  ✓ [YT] ${source.name} — ${items.length} videos (${Date.now() - t0}ms)`,
    );
    return { source: source.name, items, error: null };
  } catch (err) {
    recordFailure(key);
    console.error(
      `  ✗ [YT] ${source.name}: ${err.message} (${Date.now() - t0}ms)`,
    );
    return { source: source.name, items: [], error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Article fetch pipeline (unchanged from v3)
// ══════════════════════════════════════════════════════════════════════════════
async function fetchWithFallback(source) {
  try {
    const feed = await Promise.race([
      parser.parseURL(source.url),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), FETCH_TIMEOUT_MS),
      ),
    ]);
    return (feed.items || [])
      .map((item) => normaliseArticleItem(item, source))
      .filter(Boolean);
  } catch (primaryErr) {
    try {
      const res = await fetch(source.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": pickUA(),
          Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const feed = await parser.parseString(xml);
      return (feed.items || [])
        .map((item) => normaliseArticleItem(item, source))
        .filter(Boolean);
    } catch (fallbackErr) {
      throw new Error(
        `Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`,
      );
    }
  }
}

async function fetchArticleSource(source) {
  const key = source.url;
  if (isCircuitOpen(key)) {
    return {
      source: source.name,
      items: [],
      error: "circuit open",
      skipped: true,
    };
  }
  const t0 = Date.now();
  try {
    const items = await fetchWithFallback(source);
    recordSuccess(key);
    console.log(
      `  ✓ ${source.name} — ${items.length} items (${Date.now() - t0}ms)`,
    );
    return { source: source.name, items, error: null };
  } catch (err) {
    recordFailure(key);
    console.error(`  ✗ ${source.name}: ${err.message} (${Date.now() - t0}ms)`);
    return { source: source.name, items: [], error: err.message };
  }
}

async function runConcurrent(tasks, fetchFn, concurrency = 8) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = await Promise.allSettled(
      tasks.slice(i, i + concurrency).map((t) => fetchFn(t)),
    );
    results.push(
      ...batch.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { source: "unknown", items: [], error: r.reason?.message },
      ),
    );
  }
  return results;
}

// ── Batch upsert (shared) ─────────────────────────────────────────────────────
async function batchInsert(items) {
  if (!items.length) return 0;
  let total = 0;
  const BATCH = 50;
  for (let i = 0; i < items.length; i += BATCH) {
    const { error, count } = await supabase
      .from("news_posts")
      .upsert(items.slice(i, i + BATCH), {
        onConflict: "url_hash",
        ignoreDuplicates: true,
        count: "estimated",
      });
    if (error) console.error("[NewsFetcher] upsert error:", error.message);
    else total += count ?? 0;
  }
  return total;
}

async function logFetch(
  sourceName,
  found,
  inserted,
  error = null,
  isVideo = false,
) {
  await supabase
    .from("news_fetch_log")
    .insert({
      source_name: sourceName,
      articles_found: found,
      articles_inserted: inserted,
      error_message: error,
    })
    .catch(() => {});
}

async function purgeOldArticles(days = 7) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await supabase
    .from("news_posts")
    .delete()
    .lt("published_at", cutoff)
    .eq("is_video", false);
}

async function purgeOldVideos(days = 3) {
  // Videos go stale faster — purge after 3 days
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  await supabase
    .from("news_posts")
    .delete()
    .lt("published_at", cutoff)
    .eq("is_video", true);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * runNewsFetchCycle(sources?)
 * Fetches article RSS sources and inserts into news_posts (is_video=false).
 */
export async function runNewsFetchCycle(sources = NEWS_SOURCES) {
  const t0 = Date.now();
  const active = sources.filter((s) => !isCircuitOpen(s.url));
  console.log(
    `[NewsFetcher] ─── Article cycle: ${active.length}/${sources.length} active ───`,
  );

  const results = await runConcurrent(active, fetchArticleSource, 8);

  const seen = new Set();
  const unique = [];

  for (const { source, items, error } of results) {
    const deduped = items.filter((item) => {
      if (seen.has(item.url_hash)) return false;
      seen.add(item.url_hash);
      return true;
    });
    const inserted = await batchInsert(deduped);
    await logFetch(source, items.length, inserted, error, false);
    unique.push(...deduped);
  }

  if (sources.length >= NEWS_SOURCES.length * 0.8) {
    await purgeOldArticles(7);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[NewsFetcher] ─── Article done in ${elapsed}s — ${unique.length} unique ───`,
  );
  return unique.length;
}

/**
 * [YT4] runVideoFetchCycle(sources?)
 * Fetches YouTube channel RSS feeds and inserts into news_posts (is_video=true).
 * Run this on a separate, more frequent schedule (e.g. every 15 min).
 */
export async function runVideoFetchCycle(sources = VIDEO_SOURCES) {
  const t0 = Date.now();
  const active = sources.filter((s) => !isCircuitOpen(`yt:${s.channelId}`));
  console.log(
    `[NewsFetcher] ─── Video cycle: ${active.length}/${sources.length} channels ───`,
  );

  const results = await runConcurrent(active, fetchYouTubeChannel, 8);

  const seen = new Set();
  const unique = [];

  for (const { source, items, error } of results) {
    const deduped = items.filter((item) => {
      if (seen.has(item.url_hash)) return false;
      seen.add(item.url_hash);
      return true;
    });
    const inserted = await batchInsert(deduped);
    await logFetch(source, items.length, inserted, error, true);
    unique.push(...deduped);
  }

  await purgeOldVideos(3);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[NewsFetcher] ─── Video done in ${elapsed}s — ${unique.length} unique videos ───`,
  );
  return unique.length;
}
