// ============================================================================
// src/services/news/clientNewsFetcher.js  — v9  PARALLEL BLAST
//
// ARCHITECTURE:
//  [P1] Promise.any() races ALL proxies simultaneously — first valid XML wins.
//       No more sequential timeout waterfalls that take 40s and silently fail.
//  [P2] 80+ RSS sources spanning Africa (Nigeria, Kenya, SA, pan-Africa),
//       Global (US, UK, EU, Asia, Middle East), Crypto.
//  [P3] Date extraction tries 8 different fields + URL date pattern.
//       NO fallback to Date.now() — articles with no parseable date get
//       published_at = now - 2h so they appear as "2h ago" not "just now".
//  [P4] 30s cooldown (down from 90s) for near-realtime freshness.
//  [P5] clearAllCooldowns() nukes every legacy key format on import.
//  [P6] fetchAndStoreNews() returns { items, inserted, errors } — items are
//       the raw parsed articles so NewsTab can display them before DB confirms.
// ============================================================================

import { supabase } from "../config/supabase";

// ── CORS proxies — ALL fired in parallel, first valid XML wins ────────────────
const PROXIES = [
  (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
  (u) => u, // direct fetch — works for CORS-enabled RSS feeds
];

// ── 80+ RSS Sources ───────────────────────────────────────────────────────────
export const RSS_SOURCES = [
  // ── GLOBAL / INTERNATIONAL ──────────────────────────────────────────────────
  {
    name: "Associated Press",
    url: "https://feeds.apnews.com/rss/apf-topnews",
    category: "global",
    region: "us",
  },
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
    region: "uk",
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
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
    name: "Euronews",
    url: "https://www.euronews.com/rss",
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
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    category: "global",
    region: "us",
  },
  {
    name: "Reuters",
    url: "https://feeds.reuters.com/reuters/topNews",
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
    name: "The Guardian",
    url: "https://www.theguardian.com/world/rss",
    category: "global",
    region: "uk",
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
    name: "TRT World",
    url: "https://www.trtworld.com/rss",
    category: "global",
    region: "international",
  },
  {
    name: "VOA News",
    url: "https://www.voanews.com/api/zmoqmeepiq",
    category: "global",
    region: "us",
  },
  {
    name: "Newsweek",
    url: "https://www.newsweek.com/rss",
    category: "global",
    region: "us",
  },
  {
    name: "Politico",
    url: "https://www.politico.com/rss/politicopicks.xml",
    category: "global",
    region: "us",
  },
  {
    name: "RFI English",
    url: "https://www.rfi.fr/en/rss",
    category: "global",
    region: "international",
  },
  {
    name: "NHK World",
    url: "https://www3.nhk.or.jp/nhkworld/en/news/feeds/",
    category: "global",
    region: "asia",
  },
  {
    name: "CNN World",
    url: "http://rss.cnn.com/rss/edition_world.rss",
    category: "global",
    region: "us",
  },
  {
    name: "NBC News",
    url: "http://feeds.nbcnews.com/nbcnews/public/news",
    category: "global",
    region: "us",
  },
  {
    name: "CBC Canada",
    url: "https://www.cbc.ca/cmlink/rss-world",
    category: "global",
    region: "canada",
  },
  {
    name: "CGTN Global",
    url: "https://www.cgtn.com/subscribe/rss/section/world.xml",
    category: "global",
    region: "international",
  },

  // ── AFRICA — NIGERIA ────────────────────────────────────────────────────────
  {
    name: "Business Day NG",
    url: "https://businessday.ng/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Channels TV",
    url: "https://www.channelstv.com/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Daily Post Nigeria",
    url: "https://dailypost.ng/feed/",
    category: "africa",
    region: "nigeria",
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
  {
    name: "Premium Times",
    url: "https://www.premiumtimesng.com/feed",
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
    name: "Sahara Reporters",
    url: "https://saharareporters.com/feed",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "The Cable",
    url: "https://www.thecable.ng/feed",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "ThisDay Nigeria",
    url: "https://www.thisdaylive.com/feed/",
    category: "africa",
    region: "nigeria",
  },
  {
    name: "Tribune Nigeria",
    url: "https://tribuneonlineng.com/feed/",
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
    name: "New Telegraph NG",
    url: "https://www.newtelegraphng.com/feed/",
    category: "africa",
    region: "nigeria",
  },

  // ── AFRICA — EAST AFRICA ────────────────────────────────────────────────────
  {
    name: "Daily Nation Kenya",
    url: "https://nation.africa/kenya/rss.xml",
    category: "africa",
    region: "kenya",
  },
  {
    name: "The East African",
    url: "https://www.theeastafrican.co.ke/rss.xml",
    category: "africa",
    region: "africa",
  },
  {
    name: "Standard Kenya",
    url: "https://www.standardmedia.co.ke/rss/all",
    category: "africa",
    region: "kenya",
  },
  {
    name: "Monitor Uganda",
    url: "https://www.monitor.co.ug/rss.xml",
    category: "africa",
    region: "africa",
  },

  // ── AFRICA — SOUTHERN AFRICA ────────────────────────────────────────────────
  {
    name: "Daily Maverick",
    url: "https://www.dailymaverick.co.za/feed/",
    category: "africa",
    region: "south-africa",
  },
  {
    name: "News24",
    url: "https://feeds.news24.com/articles/news24/TopStories/rss",
    category: "africa",
    region: "south-africa",
  },
  {
    name: "The Citizen SA",
    url: "https://www.citizen.co.za/feed/",
    category: "africa",
    region: "south-africa",
  },
  {
    name: "IOL South Africa",
    url: "https://www.iol.co.za/rss",
    category: "africa",
    region: "south-africa",
  },

  // ── AFRICA — WEST AFRICA ────────────────────────────────────────────────────
  {
    name: "Ghana Web",
    url: "https://www.ghanaweb.com/GhanaHomePage/NewsArchive/rssfeed.xml",
    category: "africa",
    region: "africa",
  },
  {
    name: "Joy Online Ghana",
    url: "https://www.myjoyonline.com/feed/",
    category: "africa",
    region: "africa",
  },

  // ── AFRICA — PAN-AFRICA ─────────────────────────────────────────────────────
  {
    name: "Africa News",
    url: "https://www.africanews.com/feed/rss",
    category: "africa",
    region: "africa",
  },
  {
    name: "The Africa Report",
    url: "https://www.theafricareport.com/feed/",
    category: "africa",
    region: "africa",
  },
  {
    name: "AllAfrica",
    url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf",
    category: "africa",
    region: "africa",
  },
  {
    name: "African Arguments",
    url: "https://africanarguments.org/feed/",
    category: "africa",
    region: "africa",
  },

  // ── ASIA ────────────────────────────────────────────────────────────────────
  {
    name: "Channel NewsAsia",
    url: "https://www.channelnewsasia.com/rssfeeds/8395986",
    category: "global",
    region: "asia",
  },
  {
    name: "Hindustan Times",
    url: "https://www.hindustantimes.com/feeds/rss/world/rssfeed.xml",
    category: "global",
    region: "asia",
  },
  {
    name: "Japan Times",
    url: "https://www.japantimes.co.jp/feed/",
    category: "global",
    region: "asia",
  },
  {
    name: "NDTV World",
    url: "https://feeds.feedburner.com/ndtvnews-world-news",
    category: "global",
    region: "asia",
  },
  {
    name: "South China Morning Post",
    url: "https://www.scmp.com/rss/91/feed",
    category: "global",
    region: "asia",
  },
  {
    name: "Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms",
    category: "global",
    region: "asia",
  },

  // ── MIDDLE EAST ─────────────────────────────────────────────────────────────
  {
    name: "Al Arabiya English",
    url: "https://english.alarabiya.net/tools/rss",
    category: "global",
    region: "middleeast",
  },
  {
    name: "Arab News",
    url: "https://www.arabnews.com/rss.xml",
    category: "global",
    region: "middleeast",
  },

  // ── TECH & BUSINESS ─────────────────────────────────────────────────────────
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "global",
    region: "us",
  },
  {
    name: "Business Insider",
    url: "https://feeds.businessinsider.com/~r/businessinsider/~3/",
    category: "global",
    region: "us",
  },
  {
    name: "MIT Tech Review",
    url: "https://www.technologyreview.com/feed/",
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
    name: "ZDNet",
    url: "https://www.zdnet.com/news/rss.xml",
    category: "global",
    region: "us",
  },

  // ── CRYPTO ──────────────────────────────────────────────────────────────────
  {
    name: "AMBCrypto",
    url: "https://ambcrypto.com/feed/",
    category: "crypto",
    region: null,
  },
  {
    name: "BeInCrypto",
    url: "https://beincrypto.com/feed/",
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
    name: "CryptoBriefing",
    url: "https://cryptobriefing.com/feed/",
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
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    category: "crypto",
    region: null,
  },
  {
    name: "NewsBTC",
    url: "https://www.newsbtc.com/feed/",
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
    name: "U.Today",
    url: "https://u.today/rss",
    category: "crypto",
    region: null,
  },
];

// ── Cooldown constants ────────────────────────────────────────────────────────
const LOCK_PREFIX = "cnf9_src_";
const COOLDOWN_MS = 30_000; // 30 seconds — near-realtime
const NUKE_PREFIXES = [
  "nvs_fetch_lock_",
  "cnf_lock_",
  "cnf7_lock_",
  "cnf8_src_",
  "nt_yt_",
  "nvs_yt_",
];

// ── [P5] Nuke all old keys on module load ─────────────────────────────────────
(function nukeOld() {
  try {
    const kill = [];
    for (const k of Object.keys(sessionStorage)) {
      if (NUKE_PREFIXES.some((p) => k.startsWith(p))) {
        kill.push(k);
        continue;
      }
      if (k.startsWith(LOCK_PREFIX)) {
        const ts = parseInt(sessionStorage.getItem(k) || "0");
        if (Date.now() - ts > COOLDOWN_MS) kill.push(k);
      }
    }
    kill.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
})();

export function clearAllCooldowns() {
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (
        k.startsWith(LOCK_PREFIX) ||
        NUKE_PREFIXES.some((p) => k.startsWith(p))
      ) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

function lockKey(url) {
  return LOCK_PREFIX + url.replace(/[^a-z0-9]/gi, "").slice(-30);
}
function isCooling(url) {
  try {
    return (
      Date.now() - parseInt(sessionStorage.getItem(lockKey(url)) || "0") <
      COOLDOWN_MS
    );
  } catch {
    return false;
  }
}
function setCooldown(url) {
  try {
    sessionStorage.setItem(lockKey(url), String(Date.now()));
  } catch {
    /* ignore */
  }
}

// ── [P1] Parallel proxy race — Promise.any picks first valid XML ───────────────
async function fetchXml(url) {
  try {
    const xml = await Promise.any(
      PROXIES.map(async (makeProxy) => {
        const res = await fetch(makeProxy(url), {
          signal: AbortSignal.timeout(10_000),
          headers: {
            Accept: "application/json, application/xml, text/xml, */*",
            "Cache-Control": "no-cache",
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        const txt = ct.includes("json")
          ? (await res.json())?.contents || ""
          : await res.text();
        if (!txt || txt.length < 100) throw new Error("empty");
        if (!txt.includes("<item") && !txt.includes("<entry"))
          throw new Error("no items");
        return txt;
      }),
    );
    return xml;
  } catch {
    return null;
  }
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function tagVal(block, ...names) {
  for (const name of names) {
    const re = new RegExp(
      `<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${name}>`,
      "i",
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

function cleanDesc(raw = "") {
  return (
    stripHtml(raw)
      .replace(/Read more[.:…]*$/i, "")
      .replace(/Continue reading[.:…]*$/i, "")
      .replace(/The post .+ appeared first on .+\.$/, "")
      .trim()
      .slice(0, 600) || null
  );
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
    /enclosure[^>]+url=["'](https?:\/\/[^"']+)["']/i,
    /<img[^>]+src=["'](https?:\/\/[^"']{20,})["']/i,
    /(https?:\/\/[^\s"'<>]{20,}\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?)/i,
  ];
  for (const re of pats) {
    const u = sanitiseImg((block.match(re) || [])[1]);
    if (u) return u;
  }
  return null;
}

// ── [P3] Robust date extraction — 8 fields + URL pattern ─────────────────────
function extractDate(block, articleUrl = "") {
  // Try 8 standard date fields in order of reliability
  const dateFields = [
    /< *pubDate[^>]*>([^<]+)<\/pubDate>/i,
    /< *published[^>]*>([^<]+)<\/published>/i,
    /< *updated[^>]*>([^<]+)<\/updated>/i,
    /< *dc:date[^>]*>([^<]+)<\/dc:date>/i,
    /< *date[^>]*>([^<]+)<\/date>/i,
    /< *lastBuildDate[^>]*>([^<]+)<\/lastBuildDate>/i,
    /< *atom:updated[^>]*>([^<]+)<\/atom:updated>/i,
    /< *modified[^>]*>([^<]+)<\/modified>/i,
  ];
  for (const re of dateFields) {
    const m = block.match(re);
    if (!m) continue;
    const ts = new Date(m[1].trim()).getTime();
    if (!isNaN(ts) && ts > 0 && ts < Date.now() + 3_600_000) return ts;
  }
  // Try URL date pattern: /YYYY/MM/DD/ or /YYYY-MM-DD
  const urlDate = articleUrl.match(
    /\/(20\d{2})[\/\-](\d{2})[\/\-](\d{2})[\/\-]/,
  );
  if (urlDate) {
    const ts = new Date(
      `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}T12:00:00Z`,
    ).getTime();
    if (!isNaN(ts)) return ts;
  }
  return null;
}

const ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "MATIC",
  "DOT",
  "ATOM",
  "LINK",
  "UNI",
  "NEAR",
  "APT",
  "ARB",
  "OP",
  "TON",
  "TRX",
  "PEPE",
  "SHIB",
  "WIF",
  "BONK",
  "USDT",
  "USDC",
  "LTC",
];
function assetTag(text = "") {
  const up = text.toUpperCase();
  return ASSETS.find((a) => new RegExp(`\\b${a}\\b`).test(up)) ?? null;
}

async function quickHash(str) {
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str),
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  }
}

function normaliseUrl(raw = "") {
  try {
    const u = new URL(raw.trim());
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "ref",
      "fbclid",
      "gclid",
    ].forEach((k) => u.searchParams.delete(k));
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.hash = "";
    return u.href.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

// ── Parse all <item> / <entry> blocks from raw XML ───────────────────────────
async function parseItems(xml, source) {
  const now = Date.now();
  const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const results = [];
  let m;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    // Title
    const title = stripHtml(tagVal(block, "title")).slice(0, 300);
    if (!title || title.length < 12) continue;

    // URL
    let articleUrl = "";
    const hrefM = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (hrefM) articleUrl = hrefM[1].trim();
    else articleUrl = tagVal(block, "link", "guid").trim();
    if (!articleUrl.startsWith("http")) continue;

    // Description
    const rawDesc = tagVal(
      block,
      "content:encoded",
      "content",
      "summary",
      "description",
    );
    const description = cleanDesc(rawDesc);

    // [P3] Date — no fallback to Date.now() for "just now" immortal timestamps
    const ts = extractDate(block, articleUrl);
    let published_at;
    if (ts === null) {
      // Unknown date → place 2h ago so it's "recent" but NOT "live"
      published_at = new Date(now - 2 * 3_600_000).toISOString();
    } else {
      if (ts > now + 3_600_000) continue; // impossible future
      if (now - ts > 30 * 86_400_000) continue; // older than 30 days — skip
      published_at = new Date(ts).toISOString();
    }

    const image_url = extractImg(block);
    const url_hash = await quickHash(normaliseUrl(articleUrl));

    results.push({
      title,
      description,
      image_url,
      source_name: source.name,
      source_url: source.url,
      article_url: articleUrl,
      category: source.category,
      region: source.region ?? null,
      asset_tag:
        source.category === "crypto"
          ? assetTag(`${title} ${description || ""}`)
          : null,
      url_hash,
      published_at,
      is_active: true,
      is_video: false,
      video_id: null,
    });
  }
  return results;
}

// ── Upsert batch to Supabase ──────────────────────────────────────────────────
async function upsert(items) {
  if (!items.length) return 0;
  let inserted = 0;
  for (let i = 0; i < items.length; i += 40) {
    const { error } = await supabase
      .from("news_posts")
      .upsert(items.slice(i, i + 40), {
        onConflict: "url_hash",
        ignoreDuplicates: true,
      });
    if (error) console.warn("[clientFetcher] upsert:", error.message);
    else inserted += Math.min(40, items.length - i);
  }
  return inserted;
}

// ── Fetch one source ──────────────────────────────────────────────────────────
async function fetchSource(source, force = false) {
  if (!force && isCooling(source.url)) return [];
  const xml = await fetchXml(source.url);
  if (!xml) {
    console.warn(`[clientFetcher] no XML: ${source.name}`);
    return [];
  }
  setCooldown(source.url);
  const items = await parseItems(xml, source);
  if (items.length) console.log(`✓ ${source.name} — ${items.length} items`);
  return items;
}

// ── Load articles directly from DB ────────────────────────────────────────────
export async function loadArticlesFromDB(category = null, limit = 80) {
  let q = supabase
    .from("news_posts")
    .select("*")
    .eq("is_active", true)
    .eq("is_video", false)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) console.warn("[clientFetcher] DB read:", error.message);
  return (data || []).map((a) => ({ ...a, _type: "article" }));
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchAndStoreNews({
  category = null,
  force = false,
} = {}) {
  if (force) clearAllCooldowns();

  const sources = category
    ? RSS_SOURCES.filter((s) => s.category === category)
    : RSS_SOURCES;
  const allItems = [];
  const errors = [];
  const seen = new Set();
  const BATCH = 12; // [P1] More sources per batch — proxies are parallel now

  for (let i = 0; i < sources.length; i += BATCH) {
    const batch = sources.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((s) => fetchSource(s, force)),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        for (const item of r.value) {
          if (!seen.has(item.url_hash)) {
            seen.add(item.url_hash);
            allItems.push(item);
          }
        }
      } else {
        errors.push(`${batch[j].name}: ${r.reason?.message}`);
      }
    }
  }

  allItems.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const inserted = await upsert(allItems);
  console.log(
    `[clientFetcher] ${allItems.length} unique, ${inserted} upserted, ${errors.length} errors`,
  );
  return { items: allItems, inserted, errors };
}

export async function fetchAndStoreCategory(category) {
  return fetchAndStoreNews({ category, force: false });
}
