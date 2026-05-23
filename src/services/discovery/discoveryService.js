// src/services/discovery/discoveryService.js
//
// ═══════════════════════════════════════════════════════════════════════════
// XEEVIA DISCOVERY SERVICE — v1
//
// Delivers cinematic wildlife, nature, and atmospheric clips for the
// Discovery Stream and Discovery Tab.
//
// ─── Data sources (priority order) ───────────────────────────────────────
//
//  1. Supabase `discovery_content` table  — curated, admin-uploaded clips
//  2. Pexels Videos API                   — free, high-quality nature videos
//  3. Hardcoded curated fallback catalog  — always available offline
//
// ─── Intelligent injection logic ─────────────────────────────────────────
//
//  • getDiscoveryFeed(options)  — returns ranked, context-aware clip list
//  • getInjectClip(context)     — returns single best clip for inline inject
//  • Categories, moods, and tags flow through PersonalizationModel
//
// ─── Caching ─────────────────────────────────────────────────────────────
//
//  Module-level Map cache, 10-minute TTL per category bucket.
//  Offline fallback to hardcoded catalog always available.
//
// ═══════════════════════════════════════════════════════════════════════════

import { supabase }  from "../config/supabase";
import { rankItems, getSessionContext, getTopCategories } from "./discoveryPersonalizationModel";

// ─── Pexels config ────────────────────────────────────────────────────────────
const PEXELS_KEY = process.env.REACT_APP_PEXELS_API_KEY || "";
const PEXELS_BASE = "https://api.pexels.com/videos";

// ─── Module-level cache ───────────────────────────────────────────────────────
const _cache  = new Map(); // key → { data, ts }
const CACHE_TTL = 10 * 60 * 1000;

function getCached(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data) { _cache.set(key, { data, ts: Date.now() }); }

// ─── Category → Pexels search query map ──────────────────────────────────────
const CATEGORY_QUERIES = {
  Ocean:          "ocean waves underwater",
  Jungle:         "jungle rainforest wildlife",
  Predator:       "lion eagle wolf hunting",
  Birds:          "birds flying wildlife",
  "Space & Earth": "earth from space aerial",
  Snow:           "snow winter wildlife",
  Rain:           "rain forest storm",
  Waterfalls:     "waterfall nature scenic",
  "Macro Wildlife": "macro insect wildlife closeup",
  Mountains:      "mountain landscape aerial",
  Desert:         "desert wildlife landscape",
  "Night Nature": "night sky stars nature",
  Storms:         "storm lightning nature",
  "Aerial Earth": "aerial earth landscape drone",
  Relaxation:     "peaceful nature calm water",
  Survival:       "animal survival wildlife",
  "Extreme Nature": "extreme nature volcano lava",
};

export const DISCOVERY_CATEGORIES = Object.keys(CATEGORY_QUERIES);

// ─── Mood → categories map ────────────────────────────────────────────────────
const MOOD_CATEGORIES = {
  calm:       ["Ocean", "Waterfalls", "Rain", "Relaxation", "Snow"],
  intense:    ["Predator", "Storms", "Extreme Nature", "Survival"],
  motivational: ["Predator", "Birds", "Mountains", "Aerial Earth"],
  night:      ["Night Nature", "Ocean", "Space & Earth"],
  curious:    ["Macro Wildlife", "Jungle", "Birds", "Desert"],
  cinematic:  ["Aerial Earth", "Mountains", "Space & Earth", "Ocean"],
};

// ─── Hardcoded fallback catalog (Pexels public CDN — no key needed) ───────────
// These are real Pexels video IDs with verified URLs.
const FALLBACK_CATALOG = [
  {
    id: "ds_ocean_1",
    type: "discovery_stream",
    category: "Ocean",
    mood: "calm",
    title: "Deep Ocean Waves",
    caption: "The ocean breathes in slow, endless rhythm — a reminder that time moves differently at sea.",
    videoUrl: "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/1093662/pictures/preview-0.jpg",
    duration: 30,
    tags: ["ocean", "waves", "calm", "nature"],
    source: "Pexels",
    engagementScore: 85,
    aiInjected: true,
  },
  {
    id: "ds_jungle_1",
    type: "discovery_stream",
    category: "Jungle",
    mood: "curious",
    title: "Rainforest at Dawn",
    caption: "Before the world wakes, the forest already hums with ancient intelligence.",
    videoUrl: "https://videos.pexels.com/video-files/3105977/3105977-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3105977/pictures/preview-0.jpg",
    duration: 20,
    tags: ["jungle", "forest", "dawn", "wildlife"],
    source: "Pexels",
    engagementScore: 78,
    aiInjected: true,
  },
  {
    id: "ds_aerial_1",
    type: "discovery_stream",
    category: "Aerial Earth",
    mood: "cinematic",
    title: "Earth from Above",
    caption: "From this altitude, borders disappear. Only the planet remains.",
    videoUrl: "https://videos.pexels.com/video-files/2169880/2169880-hd_1920_1080_30fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/2169880/pictures/preview-0.jpg",
    duration: 25,
    tags: ["aerial", "landscape", "earth", "cinematic"],
    source: "Pexels",
    engagementScore: 92,
    aiInjected: true,
  },
  {
    id: "ds_waterfall_1",
    type: "discovery_stream",
    category: "Waterfalls",
    mood: "calm",
    title: "Cascade Falls",
    caption: "Water has carved these stones for ten thousand years. You are watching history move.",
    videoUrl: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/1448735/pictures/preview-0.jpg",
    duration: 18,
    tags: ["waterfall", "nature", "water", "peaceful"],
    source: "Pexels",
    engagementScore: 80,
    aiInjected: true,
  },
  {
    id: "ds_mountains_1",
    type: "discovery_stream",
    category: "Mountains",
    mood: "motivational",
    title: "Summit at Golden Hour",
    caption: "Every peak looks impossible from the valley. Every valley looks small from the peak.",
    videoUrl: "https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3571264/pictures/preview-0.jpg",
    duration: 22,
    tags: ["mountains", "summit", "golden hour", "inspire"],
    source: "Pexels",
    engagementScore: 88,
    aiInjected: true,
  },
  {
    id: "ds_storm_1",
    type: "discovery_stream",
    category: "Storms",
    mood: "intense",
    title: "Electric Storm",
    caption: "Lightning cracks the sky open — nature's raw, unfiltered power.",
    videoUrl: "https://videos.pexels.com/video-files/3945079/3945079-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3945079/pictures/preview-0.jpg",
    duration: 15,
    tags: ["storm", "lightning", "nature", "dramatic"],
    source: "Pexels",
    engagementScore: 91,
    aiInjected: true,
  },
  {
    id: "ds_birds_1",
    type: "discovery_stream",
    category: "Birds",
    mood: "motivational",
    title: "Murmuration",
    caption: "Ten thousand birds, one mind. Collective intelligence made visible.",
    videoUrl: "https://videos.pexels.com/video-files/3255364/3255364-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3255364/pictures/preview-0.jpg",
    duration: 28,
    tags: ["birds", "murmuration", "flock", "nature"],
    source: "Pexels",
    engagementScore: 94,
    aiInjected: true,
  },
  {
    id: "ds_desert_1",
    type: "discovery_stream",
    category: "Desert",
    mood: "cinematic",
    title: "Sahara at Dusk",
    caption: "The desert is not empty. It is the most honest landscape on Earth.",
    videoUrl: "https://videos.pexels.com/video-files/2098428/2098428-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/2098428/pictures/preview-0.jpg",
    duration: 20,
    tags: ["desert", "dusk", "sand", "cinematic"],
    source: "Pexels",
    engagementScore: 82,
    aiInjected: true,
  },
  {
    id: "ds_snow_1",
    type: "discovery_stream",
    category: "Snow",
    mood: "calm",
    title: "Silent Snowfall",
    caption: "Snow muffles the world into something close to peace.",
    videoUrl: "https://videos.pexels.com/video-files/3735698/3735698-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3735698/pictures/preview-0.jpg",
    duration: 16,
    tags: ["snow", "winter", "calm", "silent"],
    source: "Pexels",
    engagementScore: 76,
    aiInjected: true,
  },
  {
    id: "ds_space_1",
    type: "discovery_stream",
    category: "Space & Earth",
    mood: "cinematic",
    title: "Earth from Orbit",
    caption: "You are on a rock hurtling through space at 67,000 mph. Look how beautiful it is.",
    videoUrl: "https://videos.pexels.com/video-files/3697093/3697093-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3697093/pictures/preview-0.jpg",
    duration: 35,
    tags: ["space", "earth", "orbit", "awe"],
    source: "Pexels",
    engagementScore: 96,
    aiInjected: true,
  },
  {
    id: "ds_rain_1",
    type: "discovery_stream",
    category: "Rain",
    mood: "calm",
    title: "Forest Rain",
    caption: "Rain doesn't apologise for disrupting the day. It just falls.",
    videoUrl: "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3045163/pictures/preview-0.jpg",
    duration: 24,
    tags: ["rain", "forest", "peaceful", "nature"],
    source: "Pexels",
    engagementScore: 79,
    aiInjected: true,
  },
  {
    id: "ds_predator_1",
    type: "discovery_stream",
    category: "Predator",
    mood: "intense",
    title: "Eagle Hunt",
    caption: "A hundred million years of evolution, compressed into one perfect strike.",
    videoUrl: "https://videos.pexels.com/video-files/3734773/3734773-hd_1920_1080_25fps.mp4",
    thumbnailUrl: "https://images.pexels.com/videos/3734773/pictures/preview-0.jpg",
    duration: 12,
    tags: ["eagle", "predator", "hunt", "power"],
    source: "Pexels",
    engagementScore: 90,
    aiInjected: true,
  },
];

// ─── Fetch from Pexels API ────────────────────────────────────────────────────
async function fetchFromPexels(category, limit = 10) {
  if (!PEXELS_KEY) return [];
  const query = CATEGORY_QUERIES[category] || category;
  const cacheKey = `pexels_${category}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=portrait`,
      { headers: { Authorization: PEXELS_KEY } },
    );
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const json = await res.json();

    const items = (json.videos || []).map(v => {
      const best = (v.video_files || [])
        .filter(f => f.quality === "hd" || f.quality === "sd")
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      return {
        id:           `pexels_${v.id}`,
        type:         "discovery_stream",
        category,
        mood:         deriveMood(category),
        title:        v.user?.name ? `${category} — ${v.user.name}` : category,
        caption:      pickCaption(category),
        videoUrl:     best?.link || "",
        thumbnailUrl: v.image || "",
        duration:     v.duration || 20,
        tags:         [category.toLowerCase(), query.split(" ")[0]],
        source:       "Pexels",
        engagementScore: 70 + Math.floor(Math.random() * 25),
        aiInjected:   true,
      };
    }).filter(v => v.videoUrl);

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[DiscoveryService] Pexels error:", err.message);
    return [];
  }
}

// ─── Fetch from Supabase discovery_content table ──────────────────────────────
async function fetchFromSupabase(categories = [], limit = 20) {
  const cacheKey = `supa_${categories.join(",")}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    let q = supabase
      .from("discovery_content")
      .select("*")
      .eq("active", true)
      .order("engagement_score", { ascending: false })
      .limit(limit);

    if (categories.length) {
      q = q.in("category", categories);
    }

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map(row => ({
      id:              row.id,
      type:            "discovery_stream",
      category:        row.category,
      mood:            row.mood || deriveMood(row.category),
      title:           row.title,
      caption:         row.caption || "",
      videoUrl:        row.video_url,
      thumbnailUrl:    row.thumbnail_url || "",
      duration:        row.duration || 20,
      tags:            row.tags || [],
      source:          row.source || "Xeevia",
      engagementScore: row.engagement_score || 70,
      aiInjected:      true,
    }));

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[DiscoveryService] Supabase error:", err.message);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deriveMood(category) {
  for (const [mood, cats] of Object.entries(MOOD_CATEGORIES)) {
    if (cats.includes(category)) return mood;
  }
  return "cinematic";
}

const CAPTIONS = {
  Ocean:           ["The ocean has no memory. Only motion.", "Salt, depth, silence.", "Every wave is the ocean thinking out loud."],
  Jungle:          ["The forest breathes whether you are watching or not.", "Before cities, this.", "Life stacked on life, without apology."],
  Predator:        ["Millions of years of refinement for one moment.", "Precision is beautiful when it is necessary.", "Power and patience are the same thing."],
  Birds:           ["Some creatures were built for the sky.", "Migration is memory encoded in biology.", "Freedom has feathers."],
  Mountains:       ["Every summit was once sea floor.", "Altitude is the only honest perspective.", "The mountain does not care if you summit it."],
  Storms:          ["The atmosphere argues with itself at scale.", "Electrons bridge heaven and earth.", "Even chaos has structure if you zoom out."],
  Waterfalls:      ["Gravity made beautiful.", "This stone was here before language.", "Water finds every opening. Eventually."],
  Desert:          ["Silence has a texture.", "The desert is the most honest landscape.", "Nothing survives here by accident."],
  Snow:            ["Cold is just heat leaving.", "The world quiets when it snows.", "Every flake lands exactly where physics says it must."],
  "Space & Earth": ["You are on a pale blue dot.", "The universe spent 13 billion years making this view.", "One planet. Irreplaceable."],
  Rain:            ["The rain has no agenda.", "Everything is clean after this.", "The Earth is drinking."],
  Aerial:          ["At altitude, everything is pattern.", "Borders are invisible from here.", "The planet arranges itself beautifully."],
};

function pickCaption(category) {
  const pool = CAPTIONS[category] || ["Beauty is everywhere if you slow down."];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Context-driven category selection ───────────────────────────────────────
function selectCategoriesForContext(ctx, userTopCats = []) {
  const cats = new Set(userTopCats);

  if (ctx.isNight) {
    ["Night Nature", "Ocean", "Rain", "Snow"].forEach(c => cats.add(c));
  } else if (ctx.isMorning) {
    ["Birds", "Mountains", "Jungle", "Aerial Earth"].forEach(c => cats.add(c));
  }

  // Always ensure some variety
  const allCats = DISCOVERY_CATEGORIES;
  while (cats.size < 6) {
    cats.add(allCats[Math.floor(Math.random() * allCats.length)]);
  }

  return [...cats].slice(0, 8);
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a personalized discovery feed.
 *
 * @param {object}   opts
 * @param {number}   opts.limit       — total items to return (default 30)
 * @param {string[]} opts.categories  — force specific categories
 * @param {string}   opts.mood        — force mood filter
 * @returns {Promise<object[]>}
 */
export async function getDiscoveryFeed({ limit = 30, categories, mood } = {}) {
  const ctx         = getSessionContext();
  const topCats     = getTopCategories(5);
  const activeCats  = categories || selectCategoriesForContext(ctx, topCats);

  // Filter by mood if specified
  const moodCats = mood ? (MOOD_CATEGORIES[mood] || activeCats) : activeCats;
  const finalCats = moodCats.slice(0, 8);

  // Fetch from all sources in parallel
  const [supaItems, ...pexelsArrays] = await Promise.all([
    fetchFromSupabase(finalCats, Math.floor(limit * 0.4)),
    ...finalCats.slice(0, 4).map(cat => fetchFromPexels(cat, 5)),
  ]);

  const pexelsItems = pexelsArrays.flat();

  // Merge, deduplicate, add fallback
  const all = [...supaItems, ...pexelsItems];
  const ids  = new Set(all.map(i => i.id));
  const withFallback = [
    ...all,
    ...FALLBACK_CATALOG.filter(i => !ids.has(i.id)),
  ];

  // Personalize ranking and return
  return rankItems(withFallback).slice(0, limit);
}

/**
 * Get a single best clip for inline feed injection.
 * Selects based on session context + personalization.
 *
 * @param {object} context  — { recentCategories, scrollSpeed, lowActivity }
 * @returns {object} single discovery item
 */
export async function getInjectClip(context = {}) {
  const ctx  = getSessionContext();
  const pool = context.lowActivity
    ? FALLBACK_CATALOG.filter(c => ["Ocean", "Rain", "Relaxation", "Snow"].includes(c.category))
    : FALLBACK_CATALOG;

  const ranked = rankItems(pool);
  return ranked[0] || FALLBACK_CATALOG[0];
}

/**
 * Get clips for a specific category page.
 */
export async function getCategoryFeed(category, limit = 20) {
  const cacheKey = `cat_${category}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return rankItems(cached).slice(0, limit);

  const [supaItems, pexelsItems] = await Promise.all([
    fetchFromSupabase([category], Math.floor(limit * 0.5)),
    fetchFromPexels(category, Math.ceil(limit * 0.5)),
  ]);

  const all = [...supaItems, ...pexelsItems,
    ...FALLBACK_CATALOG.filter(i => i.category === category)];
  const unique = [...new Map(all.map(i => [i.id, i])).values()];

  setCached(cacheKey, unique);
  return rankItems(unique).slice(0, limit);
}

export default {
  getDiscoveryFeed,
  getInjectClip,
  getCategoryFeed,
  DISCOVERY_CATEGORIES,
  FALLBACK_CATALOG,
};