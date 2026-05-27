// src/services/discovery/discoveryService.js — v3 GRADIENT-FIRST
//
// ═══════════════════════════════════════════════════════════════════════════
// CHANGES vs v1:
//
// [S1] FALLBACK_CATALOG — all Pexels direct CDN URLs removed (they return
//      403 Forbidden when hotlinked from a browser). Every fallback item
//      has videoUrl:"" and thumbnailUrl:"". DiscoveryCard and DiscoveryThumb
//      both render a cinematic category gradient when these are empty.
//      The cards are always visually filled — never black, never broken.
//
// [S2] CATEGORY_GRADIENTS exported — DiscoveryCard imports this map so
//      the exact same gradient used in the pipeline strip and in the full
//      card view are identical. One source of truth.
//
// [S3] fetchFromPexels — only runs when REACT_APP_PEXELS_API_KEY is set.
//      When the key is present the API returns proper video URLs that work.
//      When absent, skips silently and falls back to Supabase + catalog.
//
// [S4] fetchFromSupabase — primary source for real Cloudinary-hosted clips
//      uploaded via the Admin panel to the discovery_content table.
//
// [S5] getDiscoveryFeed — parallel fetch from all sources, deduplicates,
//      merges fallback catalog for any missing slots, personalises via
//      rankItems from discoveryPersonalizationModel.
//
// [S6] getCategoryFeed — same pattern, filtered to one category.
//      Used by DiscoveryTab category pills.
//
// [S7] getInjectClip — single best clip for inline feed injection context.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import {
  rankItems,
  getSessionContext,
  getTopCategories,
} from "./discoveryPersonalizationModel";

// ─── Pexels (only when API key is set) ───────────────────────────────────────
const PEXELS_KEY  = process.env.REACT_APP_PEXELS_API_KEY || "";
const PEXELS_BASE = "https://api.pexels.com/videos";

// ─── Module-level cache (10 min TTL) ─────────────────────────────────────────
const _cache    = new Map();
const CACHE_TTL = 10 * 60_000;

function getCached(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data) { _cache.set(key, { data, ts: Date.now() }); }

// ─── [S2] Category → Pexels search query ─────────────────────────────────────
const CATEGORY_QUERIES = {
  "Ocean":            "ocean waves underwater",
  "Jungle":           "jungle rainforest wildlife",
  "Predator":         "lion eagle wolf hunting",
  "Birds":            "birds flying wildlife",
  "Space & Earth":    "earth from space aerial",
  "Snow":             "snow winter wildlife",
  "Rain":             "rain forest storm",
  "Waterfalls":       "waterfall nature scenic",
  "Macro Wildlife":   "macro insect wildlife closeup",
  "Mountains":        "mountain landscape aerial",
  "Desert":           "desert wildlife landscape",
  "Night Nature":     "night sky stars nature",
  "Storms":           "storm lightning nature",
  "Aerial Earth":     "aerial earth landscape drone",
  "Relaxation":       "peaceful nature calm water",
  "Survival":         "animal survival wildlife",
  "Extreme Nature":   "extreme nature volcano lava",
};

export const DISCOVERY_CATEGORIES = Object.keys(CATEGORY_QUERIES);

// ─── [S2] Cinematic gradient per category — exported for card components ─────
export const CATEGORY_GRADIENTS = {
  "Ocean":            "linear-gradient(170deg,#0c2a4a 0%,#0a4a6e 45%,#0e7490 100%)",
  "Jungle":           "linear-gradient(170deg,#052e16 0%,#14532d 55%,#166534 100%)",
  "Predator":         "linear-gradient(170deg,#1c0a00 0%,#431407 55%,#7c2d12 100%)",
  "Birds":            "linear-gradient(170deg,#0c1445 0%,#1e3a8a 55%,#1d4ed8 100%)",
  "Space & Earth":    "linear-gradient(170deg,#020617 0%,#0f172a 45%,#1e1b4b 100%)",
  "Snow":             "linear-gradient(170deg,#0c1a2e 0%,#1e3a5f 55%,#93c5fd 100%)",
  "Rain":             "linear-gradient(170deg,#0a0f1e 0%,#1e293b 55%,#475569 100%)",
  "Waterfalls":       "linear-gradient(170deg,#042f2e 0%,#134e4a 55%,#0d9488 100%)",
  "Macro Wildlife":   "linear-gradient(170deg,#1a2e05 0%,#365314 55%,#4d7c0f 100%)",
  "Mountains":        "linear-gradient(170deg,#1c1917 0%,#292524 55%,#78716c 100%)",
  "Desert":           "linear-gradient(170deg,#1c1400 0%,#451a03 55%,#92400e 100%)",
  "Night Nature":     "linear-gradient(170deg,#020617 0%,#1e1b4b 55%,#4338ca 100%)",
  "Storms":           "linear-gradient(170deg,#09090b 0%,#18181b 55%,#52525b 100%)",
  "Aerial Earth":     "linear-gradient(170deg,#0c1445 0%,#1e3a8a 45%,#0e7490 100%)",
  "Relaxation":       "linear-gradient(170deg,#042f2e 0%,#0f4c5c 55%,#0ea5e9 100%)",
  "Survival":         "linear-gradient(170deg,#1c0a00 0%,#292524 55%,#57534e 100%)",
  "Extreme Nature":   "linear-gradient(170deg,#1c0000 0%,#450a0a 55%,#b91c1c 100%)",
};

// ─── Mood → category affinity ─────────────────────────────────────────────────
const MOOD_CATEGORIES = {
  calm:         ["Ocean","Waterfalls","Rain","Relaxation","Snow"],
  intense:      ["Predator","Storms","Extreme Nature","Survival"],
  motivational: ["Predator","Birds","Mountains","Aerial Earth"],
  night:        ["Night Nature","Ocean","Space & Earth"],
  curious:      ["Macro Wildlife","Jungle","Birds","Desert"],
  cinematic:    ["Aerial Earth","Mountains","Space & Earth","Ocean"],
};

// ─── [S1] FALLBACK CATALOG — gradient-first, no broken CDN URLs ──────────────
// videoUrl and thumbnailUrl are intentionally empty.
// DiscoveryThumb and DiscoveryCard both render CATEGORY_GRADIENTS when empty.
// Real content comes from Supabase discovery_content (your Cloudinary clips).
export const FALLBACK_CATALOG = [
  { id:"ds_ocean_1",    type:"discovery_stream", category:"Ocean",          mood:"calm",
    title:"Deep Ocean Waves",
    caption:"The ocean breathes in slow, endless rhythm — time moves differently at sea.",
    videoUrl:"", thumbnailUrl:"", duration:30,
    tags:["ocean","waves","calm","nature"], source:"Discovery", engagementScore:85, aiInjected:true },
  { id:"ds_jungle_1",   type:"discovery_stream", category:"Jungle",         mood:"curious",
    title:"Rainforest at Dawn",
    caption:"Before the world wakes, the forest already hums with ancient intelligence.",
    videoUrl:"", thumbnailUrl:"", duration:20,
    tags:["jungle","forest","dawn","wildlife"], source:"Discovery", engagementScore:78, aiInjected:true },
  { id:"ds_aerial_1",   type:"discovery_stream", category:"Aerial Earth",   mood:"cinematic",
    title:"Earth from Above",
    caption:"From this altitude, borders disappear. Only the planet remains.",
    videoUrl:"", thumbnailUrl:"", duration:25,
    tags:["aerial","landscape","earth","cinematic"], source:"Discovery", engagementScore:92, aiInjected:true },
  { id:"ds_waterfall_1",type:"discovery_stream", category:"Waterfalls",     mood:"calm",
    title:"Cascade Falls",
    caption:"Water has carved these stones for ten thousand years. You are watching history move.",
    videoUrl:"", thumbnailUrl:"", duration:18,
    tags:["waterfall","nature","water","peaceful"], source:"Discovery", engagementScore:80, aiInjected:true },
  { id:"ds_mountains_1",type:"discovery_stream", category:"Mountains",      mood:"motivational",
    title:"Summit at Golden Hour",
    caption:"Every peak looks impossible from the valley. Every valley looks small from the peak.",
    videoUrl:"", thumbnailUrl:"", duration:22,
    tags:["mountains","summit","golden hour","inspire"], source:"Discovery", engagementScore:88, aiInjected:true },
  { id:"ds_storm_1",    type:"discovery_stream", category:"Storms",         mood:"intense",
    title:"Electric Storm",
    caption:"Lightning cracks the sky open — nature's raw, unfiltered power.",
    videoUrl:"", thumbnailUrl:"", duration:15,
    tags:["storm","lightning","nature","dramatic"], source:"Discovery", engagementScore:91, aiInjected:true },
  { id:"ds_birds_1",    type:"discovery_stream", category:"Birds",          mood:"motivational",
    title:"Murmuration",
    caption:"Ten thousand birds, one mind. Collective intelligence made visible.",
    videoUrl:"", thumbnailUrl:"", duration:28,
    tags:["birds","murmuration","flock","nature"], source:"Discovery", engagementScore:94, aiInjected:true },
  { id:"ds_desert_1",   type:"discovery_stream", category:"Desert",         mood:"cinematic",
    title:"Sahara at Dusk",
    caption:"The desert is not empty. It is the most honest landscape on Earth.",
    videoUrl:"", thumbnailUrl:"", duration:20,
    tags:["desert","dusk","sand","cinematic"], source:"Discovery", engagementScore:82, aiInjected:true },
  { id:"ds_snow_1",     type:"discovery_stream", category:"Snow",           mood:"calm",
    title:"Silent Snowfall",
    caption:"Snow muffles the world into something close to peace.",
    videoUrl:"", thumbnailUrl:"", duration:16,
    tags:["snow","winter","calm","silent"], source:"Discovery", engagementScore:76, aiInjected:true },
  { id:"ds_space_1",    type:"discovery_stream", category:"Space & Earth",  mood:"cinematic",
    title:"Earth from Orbit",
    caption:"You are on a rock hurtling through space at 67,000 mph. Look how beautiful it is.",
    videoUrl:"", thumbnailUrl:"", duration:35,
    tags:["space","earth","orbit","awe"], source:"Discovery", engagementScore:96, aiInjected:true },
  { id:"ds_rain_1",     type:"discovery_stream", category:"Rain",           mood:"calm",
    title:"Forest Rain",
    caption:"Rain doesn't apologise for disrupting the day. It just falls.",
    videoUrl:"", thumbnailUrl:"", duration:24,
    tags:["rain","forest","peaceful","nature"], source:"Discovery", engagementScore:79, aiInjected:true },
  { id:"ds_predator_1", type:"discovery_stream", category:"Predator",       mood:"intense",
    title:"Eagle Hunt",
    caption:"A hundred million years of evolution, compressed into one perfect strike.",
    videoUrl:"", thumbnailUrl:"", duration:12,
    tags:["eagle","predator","hunt","power"], source:"Discovery", engagementScore:90, aiInjected:true },
  { id:"ds_night_1",    type:"discovery_stream", category:"Night Nature",   mood:"night",
    title:"Milky Way Rising",
    caption:"Every star you see tonight is a sun. Most have planets. Some have life.",
    videoUrl:"", thumbnailUrl:"", duration:30,
    tags:["night","stars","milky way","cosmos"], source:"Discovery", engagementScore:93, aiInjected:true },
  { id:"ds_macro_1",    type:"discovery_stream", category:"Macro Wildlife", mood:"curious",
    title:"Hidden World",
    caption:"A raindrop is an ocean to the creatures living in it.",
    videoUrl:"", thumbnailUrl:"", duration:20,
    tags:["macro","insect","micro","nature"], source:"Discovery", engagementScore:83, aiInjected:true },
  { id:"ds_relax_1",    type:"discovery_stream", category:"Relaxation",     mood:"calm",
    title:"Still Waters",
    caption:"This is what peace looks like when it has nowhere to be.",
    videoUrl:"", thumbnailUrl:"", duration:40,
    tags:["calm","water","peace","still"], source:"Discovery", engagementScore:77, aiInjected:true },
  { id:"ds_survival_1", type:"discovery_stream", category:"Survival",       mood:"intense",
    title:"Against All Odds",
    caption:"Nature does not negotiate. It only selects.",
    videoUrl:"", thumbnailUrl:"", duration:18,
    tags:["survival","wildlife","instinct","nature"], source:"Discovery", engagementScore:89, aiInjected:true },
  { id:"ds_extreme_1",  type:"discovery_stream", category:"Extreme Nature", mood:"intense",
    title:"Volcanic Force",
    caption:"The planet still has teeth. Some forces predate language.",
    videoUrl:"", thumbnailUrl:"", duration:22,
    tags:["volcano","lava","extreme","nature"], source:"Discovery", engagementScore:92, aiInjected:true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deriveMood(category) {
  for (const [mood, cats] of Object.entries(MOOD_CATEGORIES)) {
    if (cats.includes(category)) return mood;
  }
  return "cinematic";
}

const CAPTIONS = {
  "Ocean":           ["The ocean has no memory. Only motion.","Salt, depth, silence.","Every wave is the ocean thinking out loud."],
  "Jungle":          ["The forest breathes whether you are watching or not.","Before cities, this.","Life stacked on life, without apology."],
  "Predator":        ["Millions of years of refinement for one moment.","Precision is beautiful when it is necessary.","Power and patience are the same thing."],
  "Birds":           ["Some creatures were built for the sky.","Migration is memory encoded in biology.","Freedom has feathers."],
  "Mountains":       ["Every summit was once sea floor.","Altitude is the only honest perspective.","The mountain does not care if you summit it."],
  "Storms":          ["The atmosphere argues with itself at scale.","Electrons bridge heaven and earth.","Even chaos has structure if you zoom out."],
  "Waterfalls":      ["Gravity made beautiful.","This stone was here before language.","Water finds every opening. Eventually."],
  "Desert":          ["Silence has a texture.","The desert is the most honest landscape.","Nothing survives here by accident."],
  "Snow":            ["Cold is just heat leaving.","The world quiets when it snows.","Every flake lands exactly where physics says."],
  "Space & Earth":   ["You are on a pale blue dot.","The universe spent 13 billion years making this view.","One planet. Irreplaceable."],
  "Rain":            ["The rain has no agenda.","Everything is clean after this.","The Earth is drinking."],
  "Aerial Earth":    ["At altitude, everything is pattern.","Borders are invisible from here.","The planet arranges itself beautifully."],
  "Night Nature":    ["The dark is not empty.","Stars predate every word for star.","Night is the sky's real face."],
  "Macro Wildlife":  ["The small world is the real world.","At this scale, everything is alien and familiar.","A raindrop is an ocean to something."],
  "Relaxation":      ["This is what stillness looks like.","Peace is a place, not a feeling.","Rest is productive."],
  "Survival":        ["Nature does not negotiate.","Only the precise survive.","Instinct is just evolution remembering."],
  "Extreme Nature":  ["The planet still has teeth.","Power this old has no name.","Some forces predate language."],
};

function pickCaption(category) {
  const pool = CAPTIONS[category] || ["Beauty is everywhere if you slow down."];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── [S3] Fetch from Pexels API (only when key is present) ───────────────────
async function fetchFromPexels(category, limit = 8) {
  if (!PEXELS_KEY) return [];
  const query    = CATEGORY_QUERIES[category] || category;
  const cacheKey = `pexels_${category}_${limit}`;
  const cached   = getCached(cacheKey);
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
        id:             `pexels_${v.id}`,
        type:           "discovery_stream",
        category,
        mood:           deriveMood(category),
        title:          v.user?.name ? `${category} — ${v.user.name}` : category,
        caption:        pickCaption(category),
        videoUrl:       best?.link || "",
        thumbnailUrl:   v.image   || "",
        duration:       v.duration || 20,
        tags:           [category.toLowerCase(), query.split(" ")[0]],
        source:         "Pexels",
        engagementScore: 70 + Math.floor(Math.random() * 25),
        aiInjected:     true,
      };
    }).filter(v => v.videoUrl);

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[DiscoveryService] Pexels error:", err.message);
    return [];
  }
}

// ─── [S4] Fetch from Supabase discovery_content ───────────────────────────────
async function fetchFromSupabase(categories = [], limit = 20) {
  const cacheKey = `supa_${categories.sort().join(",")}_${limit}`;
  const cached   = getCached(cacheKey);
  if (cached) return cached;

  try {
    let q = supabase
      .from("discovery_content")
      .select("*")
      .eq("active", true)
      .order("engagement_score", { ascending: false })
      .limit(limit);

    if (categories.length) q = q.in("category", categories);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map(row => ({
      id:              row.id,
      type:            "discovery_stream",
      category:        row.category,
      mood:            row.mood || deriveMood(row.category),
      title:           row.title,
      caption:         row.caption || pickCaption(row.category),
      videoUrl:        row.video_url     || "",
      thumbnailUrl:    row.thumbnail_url || "",
      duration:        row.duration      || 20,
      tags:            row.tags          || [],
      source:          row.source        || "Xeevia",
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

// ─── Context-driven category selection ───────────────────────────────────────
function selectCategoriesForContext(ctx, userTopCats = []) {
  const cats = new Set(userTopCats);
  if (ctx.isNight) {
    ["Night Nature","Ocean","Rain","Snow"].forEach(c => cats.add(c));
  } else if (ctx.isMorning) {
    ["Birds","Mountains","Jungle","Aerial Earth"].forEach(c => cats.add(c));
  }
  while (cats.size < 6) {
    cats.add(DISCOVERY_CATEGORIES[Math.floor(Math.random() * DISCOVERY_CATEGORIES.length)]);
  }
  return [...cats].slice(0, 8);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * [S5] Get a personalised discovery feed.
 * Priority: Supabase (your Cloudinary clips) → Pexels (when key set) → FALLBACK_CATALOG
 */
export async function getDiscoveryFeed({ limit = 30, categories, mood } = {}) {
  const ctx        = getSessionContext();
  const topCats    = getTopCategories(5);
  const activeCats = categories || selectCategoriesForContext(ctx, topCats);
  const moodCats   = mood ? (MOOD_CATEGORIES[mood] || activeCats) : activeCats;
  const finalCats  = moodCats.slice(0, 8);

  const [supaItems, ...pexelsArrays] = await Promise.all([
    fetchFromSupabase(finalCats, Math.floor(limit * 0.5)),
    ...finalCats.slice(0, 4).map(cat => fetchFromPexels(cat, 5)),
  ]);

  const pexelsItems  = pexelsArrays.flat();
  const all          = [...supaItems, ...pexelsItems];
  const ids          = new Set(all.map(i => i.id));

  // Fill remaining slots from fallback catalog
  const withFallback = [
    ...all,
    ...FALLBACK_CATALOG.filter(i => !ids.has(i.id)),
  ];

  // Personalise: user's top categories first, then by engagement score
  const ranked = [...withFallback].sort((a, b) => {
    const ai = topCats.indexOf((a.category || "").toLowerCase());
    const bi = topCats.indexOf((b.category || "").toLowerCase());
    const aS = ai === -1 ? 999 : ai;
    const bS = bi === -1 ? 999 : bi;
    if (aS !== bS) return aS - bS;
    return (b.engagementScore || 0) - (a.engagementScore || 0);
  });

  return rankItems(ranked).slice(0, limit);
}

/**
 * [S7] Get single best clip for inline feed injection.
 */
export async function getInjectClip(context = {}) {
  const ctx  = getSessionContext();
  const pool = context.lowActivity
    ? FALLBACK_CATALOG.filter(c => ["Ocean","Rain","Relaxation","Snow"].includes(c.category))
    : FALLBACK_CATALOG;

  // Try Supabase first for real content
  const topCats = getTopCategories(3);
  if (topCats.length) {
    const supaItems = await fetchFromSupabase(topCats, 3).catch(() => []);
    if (supaItems.length) return supaItems[0];
  }

  return rankItems(pool)[0] || FALLBACK_CATALOG[0];
}

/**
 * [S6] Get clips for a specific category page (DiscoveryTab category pills).
 */
export async function getCategoryFeed(category, limit = 20) {
  const cacheKey = `cat_${category}_${limit}`;
  const cached   = getCached(cacheKey);
  if (cached) return rankItems(cached).slice(0, limit);

  const [supaItems, pexelsItems] = await Promise.all([
    fetchFromSupabase([category], Math.floor(limit * 0.6)),
    fetchFromPexels(category, Math.ceil(limit * 0.4)),
  ]);

  const fallback = FALLBACK_CATALOG.filter(i => i.category === category);
  const all      = [...supaItems, ...pexelsItems, ...fallback];
  const unique   = [...new Map(all.map(i => [i.id, i])).values()];

  setCached(cacheKey, unique);
  return rankItems(unique).slice(0, limit);
}

export default {
  getDiscoveryFeed,
  getInjectClip,
  getCategoryFeed,
  DISCOVERY_CATEGORIES,
  CATEGORY_GRADIENTS,
  FALLBACK_CATALOG,
};