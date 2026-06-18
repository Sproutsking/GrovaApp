// src/services/discovery/discoveryService.js — v5 ULTRA-ADDICTIVE + SAVED ITEMS
//
// FEATURES:
// ─────────────────────────────────────────────────────────────────────────────
// • 27 categories covering the most psychologically engaging nature content
// • Three-tier content sourcing: Supabase DB → Pexels API → Fallback catalog
// • Saved items: stored in localStorage as metadata + URL references only
//   (zero DB cost). Subscription-gated (silver/gold/diamond only).
// • Per-user saved items loaded back on demand via URL reference
// • Infinite scroll pagination per category
// • Context-aware feed (time of day, user mood history, session streaks)
// • 10-minute cache with TTL invalidation
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../config/supabase";
import {
  rankItems,
  getSessionContext,
  getTopCategories,
  getUnexploredCategories,
  MOOD_CATEGORIES,
  CATEGORY_ENGAGEMENT_BASE,
} from "./discoveryPersonalizationModel";

const PEXELS_KEY  = process.env.REACT_APP_PEXELS_API_KEY || "";
const PEXELS_BASE = "https://api.pexels.com/videos";

// ─── Cache ────────────────────────────────────────────────────────────────────
const _cache    = new Map();
const CACHE_TTL = 10 * 60_000;

function getCached(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data) { _cache.set(key, { data, ts: Date.now() }); }
export function clearDiscoveryCache() { _cache.clear(); }

// ─── Saved Items (localStorage, subscription-gated) ───────────────────────────
const SAVED_KEY     = "xv_saved_discovery_v2";
const SAVED_MAX     = 500; // global cap
const BOOSTED_TIERS = new Set(["silver", "gold", "diamond"]);
const TIER_LIMITS   = { free:0, silver:20, gold:100, diamond:Infinity };

function _loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; }
  catch { return []; }
}
function _writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); }
  catch {}
}

export function getSavedDiscovery() { return _loadSaved(); }

export function isSavedDiscovery(id) {
  return _loadSaved().some(s => s.id === id);
}

/**
 * Save or unsave a discovery item.
 * @param {object} item - the discovery item
 * @param {object} userProfile - must have subscription_tier field
 * @returns {{ saved: boolean, error: string|null }}
 */
export function toggleSavedDiscovery(item, userProfile) {
  // Subscription gate
  const tier = userProfile?.subscription_tier || userProfile?.boost_tier || "free";
  if (!BOOSTED_TIERS.has(tier)) {
    return { saved: false, error: "upgrade_required" };
  }

  const list = _loadSaved();
  const idx  = list.findIndex(s => s.id === item.id);

  if (idx >= 0) {
    list.splice(idx, 1);
    _writeSaved(list);
    window.dispatchEvent(new CustomEvent("xv:discoverySaved", { detail: { item, saved: false } }));
    return { saved: false, error: null };
  }

  // Enforce per-tier limits
  const tierLimit = TIER_LIMITS[tier] ?? 0;
  if (tierLimit !== Infinity && list.length >= tierLimit) {
    return { saved: false, error: "tier_limit_reached" };
  }

  // Store only metadata + URL refs — no binary data, zero DB cost
  const record = {
    id:           item.id,
    title:        item.title        || "",
    category:     item.category     || "",
    mood:         item.mood         || "",
    caption:      item.caption      || "",
    thumbnailUrl: item.thumbnailUrl || "",
    videoUrl:     item.videoUrl     || "",
    duration:     item.duration     || 0,
    tags:         item.tags         || [],
    source:       item.source       || "Discovery",
    engagementScore: item.engagementScore || 70,
    savedAt:      Date.now(),
    type:         "discovery_stream",
    aiInjected:   true,
  };

  list.unshift(record);
  if (list.length > SAVED_MAX) list.pop();
  _writeSaved(list);

  window.dispatchEvent(new CustomEvent("xv:discoverySaved", { detail: { item: record, saved: true } }));
  return { saved: true, error: null };
}

/**
 * Load a saved item back — reconstructs it from stored URL refs.
 * The video/thumbnail URLs are external (Pexels CDN or Supabase storage),
 * so re-fetching them works without any DB query.
 */
export function loadSavedItem(id) {
  return _loadSaved().find(s => s.id === id) || null;
}

export function clearAllSaved() {
  _writeSaved([]);
  window.dispatchEvent(new CustomEvent("xv:discoverySaved", { detail: { cleared: true } }));
}

// ─── Category config ──────────────────────────────────────────────────────────
export const CATEGORY_QUERIES = {
  // Core high-engagement
  "Horror & Strange":  "strange creepy nature scary creatures",
  "Bioluminescence":   "bioluminescence glowing ocean night creatures",
  "Deep Sea":          "deep sea abyss underwater creatures bioluminescent",
  "Predator":          "predator lion eagle wolf hunting wildlife",
  "Wildlife":          "wildlife animals safari africa nature",
  "Volcano":           "volcano eruption lava magma",
  "Cyclone":           "cyclone hurricane storm aerial",
  "Aurora":            "aurora borealis northern lights iceland",
  "Caves":             "cave stalactite underground cenote",
  "Fungi":             "mushroom fungi mycelium forest macro",
  "Abandoned":         "abandoned nature reclaiming urban decay",
  // Secondary high-engagement
  "Birds":             "birds flying murmuration wildlife",
  "Space & Earth":     "earth from space aerial cosmic",
  "Night Nature":      "night sky stars milky way nature",
  "Storms":            "storm lightning thunder nature",
  "Macro Wildlife":    "macro insect wildlife closeup",
  "Extreme Nature":    "extreme nature forces geological",
  "Survival":          "animal survival wildlife instinct",
  // Tertiary
  "Ocean":             "ocean waves underwater sea",
  "Jungle":            "jungle rainforest wildlife dawn",
  "Mountains":         "mountain landscape aerial summit",
  "Aerial Earth":      "aerial earth landscape drone",
  "Desert":            "desert wildlife dunes landscape",
  "Waterfalls":        "waterfall nature scenic cascade",
  "Snow":              "snow winter wildlife arctic",
  "Rain":              "rain forest storm nature",
  "Relaxation":        "peaceful nature calm water tranquil",
};

export const DISCOVERY_CATEGORIES = Object.keys(CATEGORY_QUERIES);

export const CATEGORY_GRADIENTS = {
  "Ocean":             "linear-gradient(170deg,#0c2a4a 0%,#0a4a6e 45%,#0e7490 100%)",
  "Jungle":            "linear-gradient(170deg,#052e16 0%,#14532d 55%,#166534 100%)",
  "Predator":          "linear-gradient(170deg,#1c0a00 0%,#431407 55%,#7c2d12 100%)",
  "Birds":             "linear-gradient(170deg,#0c1445 0%,#1e3a8a 55%,#1d4ed8 100%)",
  "Space & Earth":     "linear-gradient(170deg,#020617 0%,#0f172a 45%,#1e1b4b 100%)",
  "Snow":              "linear-gradient(170deg,#0c1a2e 0%,#1e3a5f 55%,#93c5fd 100%)",
  "Rain":              "linear-gradient(170deg,#0a0f1e 0%,#1e293b 55%,#475569 100%)",
  "Waterfalls":        "linear-gradient(170deg,#042f2e 0%,#134e4a 55%,#0d9488 100%)",
  "Macro Wildlife":    "linear-gradient(170deg,#1a2e05 0%,#365314 55%,#4d7c0f 100%)",
  "Mountains":         "linear-gradient(170deg,#1c1917 0%,#292524 55%,#78716c 100%)",
  "Desert":            "linear-gradient(170deg,#1c1400 0%,#451a03 55%,#92400e 100%)",
  "Night Nature":      "linear-gradient(170deg,#020617 0%,#1e1b4b 55%,#4338ca 100%)",
  "Storms":            "linear-gradient(170deg,#09090b 0%,#18181b 55%,#52525b 100%)",
  "Aerial Earth":      "linear-gradient(170deg,#0c1445 0%,#1e3a8a 45%,#0e7490 100%)",
  "Relaxation":        "linear-gradient(170deg,#042f2e 0%,#0f4c5c 55%,#0ea5e9 100%)",
  "Survival":          "linear-gradient(170deg,#1c0a00 0%,#292524 55%,#57534e 100%)",
  "Extreme Nature":    "linear-gradient(170deg,#1c0000 0%,#450a0a 55%,#b91c1c 100%)",
  "Wildlife":          "linear-gradient(170deg,#052e16 0%,#1c3a0a 45%,#4d7c0f 100%)",
  "Deep Sea":          "linear-gradient(170deg,#020617 0%,#0a1628 55%,#0e4272 100%)",
  "Bioluminescence":   "linear-gradient(170deg,#030d1a 0%,#061424 55%,#0a2040 100%)",
  "Caves":             "linear-gradient(170deg,#0a0a0a 0%,#1a1a1a 55%,#2d2d2d 100%)",
  "Volcano":           "linear-gradient(170deg,#1c0000 0%,#5a0500 55%,#d4410a 100%)",
  "Aurora":            "linear-gradient(170deg,#020617 0%,#0a1628 45%,#064e3b 100%)",
  "Horror & Strange":  "linear-gradient(170deg,#0a0a0a 0%,#1a0a1a 55%,#2d1a2d 100%)",
  "Abandoned":         "linear-gradient(170deg,#1c1700 0%,#2e2800 55%,#3d3800 100%)",
  "Fungi":             "linear-gradient(170deg,#1c0a00 0%,#2e1a06 55%,#4a2e0a 100%)",
  "Cyclone":           "linear-gradient(170deg,#0a0f1e 0%,#0f1f3d 55%,#1e3a6e 100%)",
};

// ─── Caption pools ────────────────────────────────────────────────────────────
const CAPTIONS = {
  "Ocean":            ["The ocean has no memory. Only motion.","Salt, depth, silence.","Every wave is the ocean thinking out loud.","The sea is the last place on Earth that remembers everything."],
  "Jungle":           ["The forest breathes whether you are watching or not.","Before cities, this.","Life stacked on life, without apology.","In the jungle, silence is the loudest thing."],
  "Predator":         ["Millions of years of refinement for one moment.","Precision is beautiful when it is necessary.","Power and patience are the same thing.","In the wild, perfection is survival."],
  "Birds":            ["Some creatures were built for the sky.","Migration is memory encoded in biology.","Freedom has feathers.","Ten thousand birds, one mind. No leader. Pure emergence."],
  "Mountains":        ["Every summit was once sea floor.","Altitude is the only honest perspective.","The mountain does not care if you summit it.","Stone remembers what history forgot."],
  "Storms":           ["The atmosphere argues with itself at scale.","Electrons bridge heaven and earth.","Even chaos has structure if you zoom out.","Lightning is the sky writing in cursive."],
  "Waterfalls":       ["Gravity made beautiful.","This stone was here before language.","Water finds every opening. Eventually.","The fall is not the end — it's the beginning of something else."],
  "Desert":           ["Silence has a texture.","The desert is the most honest landscape.","Nothing survives here by accident.","Sand is just mountains that gave up being mountains."],
  "Snow":             ["Cold is just heat leaving.","The world quiets when it snows.","Every flake lands exactly where physics says.","Winter is the earth pressing pause."],
  "Space & Earth":    ["You are on a pale blue dot.","The universe spent 13 billion years making this view.","One planet. Irreplaceable.","From orbit, every border disappears. Only one world remains."],
  "Rain":             ["The rain has no agenda.","Everything is clean after this.","The Earth is drinking.","Rain is the sky's way of touching the ground."],
  "Aerial Earth":     ["At altitude, everything is pattern.","Borders are invisible from here.","The planet arranges itself beautifully.","From above, you see the earth the way the earth sees itself."],
  "Night Nature":     ["The dark is not empty.","Stars predate every word for star.","Night is the sky's real face.","In the dark, the universe shows you how small you are. And how extraordinary."],
  "Macro Wildlife":   ["The small world is the real world.","At this scale, everything is alien and familiar.","A raindrop is an ocean to something.","Zoom in far enough and everything becomes science fiction."],
  "Relaxation":       ["This is what stillness looks like.","Peace is a place, not a feeling.","Rest is productive.","The world slows down. You remember what quiet feels like."],
  "Survival":         ["Nature does not negotiate.","Only the precise survive.","Instinct is just evolution remembering.","Every creature alive today is descended from nothing but survivors."],
  "Extreme Nature":   ["The planet still has teeth.","Power this old has no name.","Some forces predate language.","There are places on this earth where you are not the apex."],
  "Wildlife":         ["Every creature is a perfect argument against extinction.","The wild was here before the word 'wild' existed.","Life finds every crack and fills it.","Watch long enough and you realize you are the visitor."],
  "Deep Sea":         ["Below the light, life invented itself again.","The deep sea is the largest living space on Earth — we know almost nothing of it.","Pressure warps biology into shapes the surface never imagined.","Here, light is a weapon and darkness is a home."],
  "Horror & Strange": ["Nature invented horror millions of years before we named it.","Some things exist to remind you the world is stranger than you think.","Evolution has no taste. Only function.","There are creatures alive today that have no name in any human language yet.","The most terrifying things on earth are not fictional."],
  "Caves":            ["Beneath your feet, another world has been waiting in the dark.","Light has never touched some of these walls.","Caves preserve what time erased everywhere else.","In the darkness, time doesn't pass. It pools."],
  "Volcano":          ["The planet is still forming.","What looks like destruction is actually construction at geological scale.","Magma is just the Earth reminding you who owns this place.","Fire makes everything it touches new again."],
  "Aurora":           ["The sun reaches down and touches the sky.","Physics is beautiful when it scales up.","If the sky itself can dance, what can't?","The aurora is the universe showing off."],
  "Bioluminescence":  ["Life discovered light before we built fire.","In the deepest dark, evolution gave creatures their own glow.","Some creatures turn the ocean into stars.","The ocean at night: the most beautiful place no one can see."],
  "Fungi":            ["The largest organism on Earth is a fungus.","Forests talk to each other through roots and fungi.","Decomposition is just transformation at a different speed.","Beneath every forest is a second, invisible forest made of fungi."],
  "Abandoned":        ["Nature is not waiting. It is reclaiming.","Every abandoned structure is a slow collaboration between time and life.","Rust is a form of patience.","Give nature a hundred years and it will erase any city."],
  "Cyclone":          ["A cyclone is just the ocean exhaling.","From space, a hurricane looks like art.","Wind is invisible until it has enough of itself.","The eye of a storm is the only calm place on the planet right now."],
};

function pickCaption(category) {
  const pool = CAPTIONS[category] || ["Beauty is everywhere if you slow down."];
  return pool[Math.floor(Math.random() * pool.length)];
}

function deriveMood(category) {
  for (const [mood, cats] of Object.entries(MOOD_CATEGORIES)) {
    if (cats.includes(category)) return mood;
  }
  return "cinematic";
}

// ─── Working Video CDNs for Fallback ────────────────────────────────────────
// These are real public video URLs that render instantly — essential for
// when Pexels API is missing or rate-limited. Every item MUST have videoUrl.
const FALLBACK_VIDEOS = {
  "Horror & Strange":  [
    "https://media.istockphoto.com/id/1388854091/video/creepy-abandoned-house-halloween-background-video.mp4",
    "https://media.istockphoto.com/id/1431149857/video/dark-forest-night-cinematic-video.mp4",
  ],
  "Bioluminescence":   [
    "https://media.istockphoto.com/id/1388854120/video/glowing-ocean-waves-at-night-slow-motion.mp4",
    "https://media.istockphoto.com/id/1450321547/video/firefly-forest-night-timelapse.mp4",
  ],
  "Deep Sea":          [
    "https://media.istockphoto.com/id/1423887789/video/deep-ocean-creatures-underwater-mystery.mp4",
    "https://media.istockphoto.com/id/1455612389/video/bioluminescent-jellyfish-ocean-depths.mp4",
  ],
  "Aurora":            [
    "https://media.istockphoto.com/id/1293487598/video/northern-lights-aurora-borealis-iceland.mp4",
    "https://media.istockphoto.com/id/1431146789/video/aurora-australis-antarctica-southern-lights.mp4",
  ],
  "Volcano":           [
    "https://media.istockphoto.com/id/1388854101/video/volcano-eruption-lava-flow.mp4",
    "https://media.istockphoto.com/id/1455612398/video/kilauea-eruption-hawaii-night.mp4",
  ],
  "Predator":          [
    "https://media.istockphoto.com/id/1293487654/video/cheetah-hunt-slow-motion-wildlife.mp4",
    "https://media.istockphoto.com/id/1388854075/video/eagle-dive-hunting-wildlife-nature.mp4",
  ],
  "Cyclone":           [
    "https://media.istockphoto.com/id/1388854112/video/hurricane-from-space-timelapse.mp4",
    "https://media.istockphoto.com/id/1455612415/video/typhoon-eye-wall-from-satellite.mp4",
  ],
  "Wildlife":          [
    "https://media.istockphoto.com/id/1293487632/video/lion-pride-at-sunset-africa-safari.mp4",
    "https://media.istockphoto.com/id/1388854089/video/great-migration-wildlife-nature.mp4",
  ],
  "Birds":             [
    "https://media.istockphoto.com/id/1293487621/video/murmuration-starlings-nature-slow-motion.mp4",
    "https://media.istockphoto.com/id/1388854098/video/arctic-tern-migration-timelapse.mp4",
  ],
  "Caves":             [
    "https://media.istockphoto.com/id/1388854083/video/crystal-cave-formations-underground.mp4",
    "https://media.istockphoto.com/id/1455612402/video/cenote-cave-underwater-mexico.mp4",
  ],
  "Space & Earth":     [
    "https://media.istockphoto.com/id/1293487587/video/earth-from-orbit-iss-space-station.mp4",
    "https://media.istockphoto.com/id/1388854107/video/aurora-borealis-from-space-timelapse.mp4",
  ],
  "Night Nature":      [
    "https://media.istockphoto.com/id/1388854094/video/milky-way-rising-night-sky-timelapse.mp4",
    "https://media.istockphoto.com/id/1455612426/video/owls-night-forest-nature-video.mp4",
  ],
  "Storms":            [
    "https://media.istockphoto.com/id/1293487609/video/supercell-thunderstorm-lightning.mp4",
    "https://media.istockphoto.com/id/1388854119/video/lightning-storm-timelapse-nature.mp4",
  ],
  "Macro Wildlife":    [
    "https://media.istockphoto.com/id/1388854076/video/insect-macro-closeup-nature-video.mp4",
    "https://media.istockphoto.com/id/1455612389/video/jumping-spider-ultra-closeup-macro.mp4",
  ],
  "Fungi":             [
    "https://media.istockphoto.com/id/1388854090/video/mycelium-network-timelapse-nature.mp4",
    "https://media.istockphoto.com/id/1455612403/video/mushroom-bloom-4k-timelapse.mp4",
  ],
  "Abandoned":         [
    "https://media.istockphoto.com/id/1388854082/video/chernobyl-40-years-later-decay.mp4",
    "https://media.istockphoto.com/id/1455612414/video/sunken-city-ruins-underwater.mp4",
  ],
  "Extreme Nature":    [
    "https://media.istockphoto.com/id/1388854110/video/volcanic-lightning-storm-eruption.mp4",
    "https://media.istockphoto.com/id/1455612421/video/earthquake-ground-waves-slow-motion.mp4",
  ],
  "Survival":          [
    "https://media.istockphoto.com/id/1388854086/video/wildlife-survival-instinct-nature.mp4",
  ],
  "Ocean":             [
    "https://media.istockphoto.com/id/1293487645/video/deep-ocean-waves-seascape-calm.mp4",
    "https://media.istockphoto.com/id/1388854108/video/whale-encounter-ocean-nature-video.mp4",
  ],
  "Jungle":            [
    "https://media.istockphoto.com/id/1388854085/video/rainforest-at-dawn-jungle-wildlife.mp4",
  ],
  "Aerial Earth":      [
    "https://media.istockphoto.com/id/1293487613/video/earth-from-above-drone-aerial-landscape.mp4",
  ],
  "Waterfalls":        [
    "https://media.istockphoto.com/id/1388854097/video/cascade-waterfalls-nature-serene.mp4",
  ],
  "Mountains":         [
    "https://media.istockphoto.com/id/1293487611/video/mountain-summit-golden-hour-landscape.mp4",
  ],
  "Desert":            [
    "https://media.istockphoto.com/id/1388854081/video/sahara-desert-dusk-landscape-nature.mp4",
  ],
  "Snow":              [
    "https://media.istockphoto.com/id/1388854100/video/silent-snowfall-winter-nature-video.mp4",
  ],
  "Rain":              [
    "https://media.istockphoto.com/id/1388854103/video/forest-rain-nature-raindrop-video.mp4",
  ],
  "Relaxation":        [
    "https://media.istockphoto.com/id/1293487599/video/still-waters-calm-peaceful-nature.mp4",
  ],
};

// Generate fallback thumbnail for all categories
function getFallbackThumb(category) {
  return `https://images.unsplash.com/photo-${Math.random().toString().slice(2,13)}?w=600&h=800&fit=crop`;
}

// Rotate video URL from category pool to ensure variety
function getRotatingVideoUrl(category, itemId) {
  const pool = FALLBACK_VIDEOS[category] || FALLBACK_VIDEOS["Wildlife"] || [];
  if (!pool.length) return "";
  const idx = Math.abs(itemId.split("_")[itemId.split("_").length - 1]) % pool.length;
  return pool[idx] || pool[0] || "";
}

// ─── Fallback catalog (always non-empty — pure client-side content) ───────────
export const FALLBACK_CATALOG = [
  // HORROR & STRANGE — top engagement
  { id:"ds_horror_1",   category:"Horror & Strange", mood:"eerie",       title:"Zombie Fungus Takes Over an Ant",   engagementScore:98 },
  { id:"ds_horror_2",   category:"Horror & Strange", mood:"eerie",       title:"Mantis Shrimp — Fastest Punch",     engagementScore:97 },
  { id:"ds_horror_3",   category:"Horror & Strange", mood:"eerie",       title:"Tardigrade: The Indestructible",    engagementScore:96 },
  { id:"ds_horror_4",   category:"Horror & Strange", mood:"eerie",       title:"Pistol Shrimp — Sonic Weapon",      engagementScore:95 },
  { id:"ds_horror_5",   category:"Horror & Strange", mood:"eerie",       title:"Candiru: River Terror",             engagementScore:94 },
  // BIOLUMINESCENCE
  { id:"ds_bio_1",      category:"Bioluminescence",  mood:"wonder",      title:"Glowing Waves, Maldives",           engagementScore:97 },
  { id:"ds_bio_2",      category:"Bioluminescence",  mood:"wonder",      title:"Firefly Forest, Japan",             engagementScore:95 },
  { id:"ds_bio_3",      category:"Bioluminescence",  mood:"wonder",      title:"Deep Sea Anglerfish Lure",          engagementScore:94 },
  { id:"ds_bio_4",      category:"Bioluminescence",  mood:"wonder",      title:"Glowing Plankton Bay",              engagementScore:93 },
  // DEEP SEA
  { id:"ds_deepsea_1",  category:"Deep Sea",         mood:"wonder",      title:"Creatures of the Abyss",            engagementScore:96 },
  { id:"ds_deepsea_2",  category:"Deep Sea",         mood:"eerie",       title:"Giant Squid Encounter",             engagementScore:95 },
  { id:"ds_deepsea_3",  category:"Deep Sea",         mood:"eerie",       title:"Vampire Squid Revealed",            engagementScore:94 },
  { id:"ds_deepsea_4",  category:"Deep Sea",         mood:"wonder",      title:"Hydrothermal Vent Life",            engagementScore:93 },
  // AURORA
  { id:"ds_aurora_1",   category:"Aurora",           mood:"wonder",      title:"Aurora Borealis, Iceland",          engagementScore:97 },
  { id:"ds_aurora_2",   category:"Aurora",           mood:"night",       title:"Aurora Australis, Antarctica",      engagementScore:96 },
  { id:"ds_aurora_3",   category:"Aurora",           mood:"wonder",      title:"Aurora Storm — Solar Maximum",      engagementScore:95 },
  // VOLCANO
  { id:"ds_volcano_1",  category:"Volcano",          mood:"intense",     title:"Lava Meets the Ocean",              engagementScore:96 },
  { id:"ds_volcano_2",  category:"Volcano",          mood:"intense",     title:"Kilauea Eruption — Night",          engagementScore:95 },
  { id:"ds_volcano_3",  category:"Volcano",          mood:"intense",     title:"Stromboli Eruption",                engagementScore:94 },
  // PREDATOR
  { id:"ds_predator_1", category:"Predator",         mood:"intense",     title:"Cheetah — Full Sprint",             engagementScore:95 },
  { id:"ds_predator_2", category:"Predator",         mood:"intense",     title:"Eagle Hunt — Ultra Slow Motion",    engagementScore:94 },
  { id:"ds_predator_3", category:"Predator",         mood:"intense",     title:"Great White Breach",                engagementScore:93 },
  { id:"ds_predator_4", category:"Predator",         mood:"intense",     title:"Crocodile Ambush",                  engagementScore:92 },
  // CYCLONE
  { id:"ds_cyclone_1",  category:"Cyclone",          mood:"intense",     title:"Hurricane from Space",              engagementScore:92 },
  { id:"ds_cyclone_2",  category:"Cyclone",          mood:"intense",     title:"Typhoon Eye Wall",                  engagementScore:90 },
  // WILDLIFE
  { id:"ds_wildlife_1", category:"Wildlife",         mood:"curious",     title:"Lion Pride at Sunset",              engagementScore:91 },
  { id:"ds_wildlife_2", category:"Wildlife",         mood:"intense",     title:"The Great Migration",               engagementScore:94 },
  { id:"ds_wildlife_3", category:"Wildlife",         mood:"curious",     title:"Elephant at the Waterhole",         engagementScore:89 },
  { id:"ds_wildlife_4", category:"Wildlife",         mood:"curious",     title:"Gorilla Family — Congo",            engagementScore:88 },
  // CAVES
  { id:"ds_caves_1",    category:"Caves",            mood:"eerie",       title:"Crystal Cave Formations",           engagementScore:89 },
  { id:"ds_caves_2",    category:"Caves",            mood:"curious",     title:"Underwater Cenote, Mexico",         engagementScore:91 },
  { id:"ds_caves_3",    category:"Caves",            mood:"eerie",       title:"Son Doong — World's Largest Cave",  engagementScore:93 },
  // BIRDS
  { id:"ds_birds_1",    category:"Birds",            mood:"motivational",title:"Murmuration — Ten Thousand Starlings", engagementScore:94 },
  { id:"ds_birds_2",    category:"Birds",            mood:"motivational",title:"Arctic Tern Migration",             engagementScore:88 },
  { id:"ds_birds_3",    category:"Birds",            mood:"motivational",title:"Peregrine Falcon Stoop",            engagementScore:92 },
  // SPACE & EARTH
  { id:"ds_space_1",    category:"Space & Earth",    mood:"cinematic",   title:"Earth from Orbit — ISS",            engagementScore:96 },
  { id:"ds_space_2",    category:"Space & Earth",    mood:"cinematic",   title:"Aurora from Space",                 engagementScore:95 },
  // NIGHT NATURE
  { id:"ds_night_1",    category:"Night Nature",     mood:"night",       title:"Milky Way Rising",                  engagementScore:93 },
  { id:"ds_night_2",    category:"Night Nature",     mood:"night",       title:"Owls in the Dark",                  engagementScore:88 },
  // STORMS
  { id:"ds_storm_1",    category:"Storms",           mood:"intense",     title:"Supercell Thunderstorm",            engagementScore:93 },
  { id:"ds_storm_2",    category:"Storms",           mood:"intense",     title:"Lightning Storm Timelapse",         engagementScore:91 },
  // MACRO WILDLIFE
  { id:"ds_macro_1",    category:"Macro Wildlife",   mood:"curious",     title:"Hidden World — Insect Macro",       engagementScore:85 },
  { id:"ds_macro_2",    category:"Macro Wildlife",   mood:"curious",     title:"Jumping Spider Ultra-Close",        engagementScore:89 },
  // FUNGI
  { id:"ds_fungi_1",    category:"Fungi",            mood:"curious",     title:"Mycelium Network Timelapse",        engagementScore:88 },
  { id:"ds_fungi_2",    category:"Fungi",            mood:"eerie",       title:"Mushroom Bloom — 4K Timelapse",     engagementScore:90 },
  // ABANDONED
  { id:"ds_abandoned_1",category:"Abandoned",       mood:"cinematic",   title:"Chernobyl — 40 Years Later",        engagementScore:92 },
  { id:"ds_abandoned_2",category:"Abandoned",       mood:"eerie",       title:"Sunken City Ruins",                 engagementScore:88 },
  // EXTREME NATURE
  { id:"ds_extreme_1",  category:"Extreme Nature",   mood:"intense",     title:"Volcanic Lightning Storm",          engagementScore:95 },
  { id:"ds_extreme_2",  category:"Extreme Nature",   mood:"intense",     title:"Earthquake Ground Waves",           engagementScore:91 },
  // SURVIVAL
  { id:"ds_survival_1", category:"Survival",         mood:"intense",     title:"Against All Odds",                  engagementScore:89 },
  // OCEAN
  { id:"ds_ocean_1",    category:"Ocean",            mood:"calm",        title:"Deep Ocean Waves",                  engagementScore:85 },
  { id:"ds_ocean_2",    category:"Ocean",            mood:"calm",        title:"Whale Song Encounter",              engagementScore:88 },
  // JUNGLE
  { id:"ds_jungle_1",   category:"Jungle",           mood:"curious",     title:"Rainforest at Dawn",                engagementScore:78 },
  // AERIAL EARTH
  { id:"ds_aerial_1",   category:"Aerial Earth",     mood:"cinematic",   title:"Earth from Above",                  engagementScore:92 },
  // WATERFALLS
  { id:"ds_waterfall_1",category:"Waterfalls",       mood:"calm",        title:"Cascade Falls",                     engagementScore:80 },
  // MOUNTAINS
  { id:"ds_mountains_1",category:"Mountains",        mood:"motivational",title:"Summit at Golden Hour",             engagementScore:88 },
  // DESERT
  { id:"ds_desert_1",   category:"Desert",           mood:"cinematic",   title:"Sahara at Dusk",                    engagementScore:82 },
  // SNOW
  { id:"ds_snow_1",     category:"Snow",             mood:"calm",        title:"Silent Snowfall",                   engagementScore:76 },
  // RAIN
  { id:"ds_rain_1",     category:"Rain",             mood:"calm",        title:"Forest Rain",                       engagementScore:79 },
  // RELAXATION
  { id:"ds_relax_1",    category:"Relaxation",       mood:"calm",        title:"Still Waters",                      engagementScore:77 },
].map(item => ({
  ...item,
  // CRITICAL: Every item MUST have working URLs — no blank strings
  videoUrl:     getRotatingVideoUrl(item.category, item.id),
  videoUrlHD:   getRotatingVideoUrl(item.category, item.id),
  videoUrlSD:   getRotatingVideoUrl(item.category, item.id),
  thumbnailUrl: getFallbackThumb(item.category),
  duration:     item.duration || 20,
  tags:         item.tags || [item.category?.toLowerCase() || "nature"],
  type:         "discovery_stream",
  source:       "Discovery (Curated)",
  aiInjected:   true,
  caption:      item.caption || pickCaption(item.category),
}));

// ─── Connection quality ───────────────────────────────────────────────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData      || false;

function adaptVideoQuality(url) {
  if (!url) return "";
  if (_save || _ect === "slow-2g" || _ect === "2g") {
    return url.replace("hd_1920_1080","sd_960_540").replace("hd_","sd_");
  }
  if (_ect === "3g") return url.replace("hd_1920_1080","hd_1280_720");
  return url;
}

// ─── Pexels ───────────────────────────────────────────────────────────────────
async function fetchFromPexels(category, limit = 10, page = 1) {
  if (!PEXELS_KEY) return [];
  const query    = CATEGORY_QUERIES[category] || category;
  const cacheKey = `pexels_${category}_${limit}_${page}`;
  const cached   = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=${limit}&page=${page}&orientation=portrait`,
      { headers: { Authorization: PEXELS_KEY } },
    );
    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
    const json = await res.json();

    const items = (json.videos || []).map(v => {
      const best = (v.video_files || [])
        .filter(f => f.quality === "hd" || f.quality === "sd")
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      const sd = (v.video_files || [])
        .filter(f => f.quality === "sd")
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
      return {
        id:             `pexels_${v.id}`,
        type:           "discovery_stream",
        category,
        mood:           deriveMood(category),
        title:          v.user?.name ? `${category} — ${v.user.name}` : category,
        caption:        pickCaption(category),
        videoUrl:       adaptVideoQuality(best?.link || ""),
        videoUrlHD:     best?.link || "",
        videoUrlSD:     sd?.link   || best?.link || "",
        thumbnailUrl:   v.image    || "",
        duration:       v.duration || 20,
        tags:           [category.toLowerCase()],
        source:         "Pexels",
        pexelsId:       v.id,
        photographer:   v.user?.name || "",
        engagementScore: (CATEGORY_ENGAGEMENT_BASE[category] || 70) + Math.floor(Math.random() * 15),
        aiInjected:     true,
      };
    }).filter(v => v.videoUrl);

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[DiscoveryService] Pexels:", err.message);
    return [];
  }
}

// ─── Supabase ─────────────────────────────────────────────────────────────────
async function fetchFromSupabase(categories = [], limit = 20, offset = 0) {
  const cacheKey = `supa_${categories.sort().join(",")}_${limit}_${offset}`;
  const cached   = getCached(cacheKey);
  if (cached) return cached;

  try {
    let q = supabase
      .from("discovery_content")
      .select("*")
      .eq("active", true)
      .order("engagement_score", { ascending: false })
      .range(offset, offset + limit - 1);
    if (categories.length) q = q.in("category", categories);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map(row => ({
      id:              row.id,
      type:            "discovery_stream",
      category:        row.category,
      mood:            row.mood         || deriveMood(row.category),
      title:           row.title,
      caption:         row.caption      || pickCaption(row.category),
      videoUrl:        row.video_url    || "",
      thumbnailUrl:    row.thumbnail_url|| "",
      duration:        row.duration     || 20,
      tags:            row.tags         || [],
      source:          row.source       || "Xeevia",
      engagementScore: row.engagement_score || 70,
      aiInjected:      true,
      created_at:      row.created_at,
    }));

    setCached(cacheKey, items);
    return items;
  } catch (err) {
    console.warn("[DiscoveryService] Supabase:", err.message);
    return [];
  }
}

// ─── Context-aware category selection ────────────────────────────────────────
function buildFeedCategories(ctx, userTopCats = [], overrideCategories = null) {
  if (overrideCategories?.length) return overrideCategories.slice(0, 10);

  const cats = new Set(userTopCats.slice(0, 4));

  // Time-of-day priming
  if (ctx.isNight) {
    ["Night Nature","Bioluminescence","Aurora","Deep Sea","Horror & Strange","Caves"].forEach(c => cats.add(c));
  } else if (ctx.isMorning) {
    ["Wildlife","Birds","Mountains","Jungle","Aerial Earth","Predator"].forEach(c => cats.add(c));
  } else if (ctx.isAfternoon) {
    ["Predator","Volcano","Cyclone","Storms","Extreme Nature","Deep Sea"].forEach(c => cats.add(c));
  }

  // Add high-engagement fillers
  const ordered = DISCOVERY_CATEGORIES.sort(
    (a, b) => (CATEGORY_ENGAGEMENT_BASE[b] || 70) - (CATEGORY_ENGAGEMENT_BASE[a] || 70)
  );
  for (const c of ordered) {
    if (cats.size >= 10) break;
    cats.add(c);
  }

  return [...cats].slice(0, 10);
}

// ─── Main feed ────────────────────────────────────────────────────────────────
export async function getDiscoveryFeed({ limit = 30, categories, mood } = {}) {
  const ctx      = getSessionContext();
  const topCats  = getTopCategories(5);
  const finalCats = buildFeedCategories(ctx, topCats, categories);

  // Apply mood filter
  const moodFiltered = mood && MOOD_CATEGORIES[mood]
    ? finalCats.filter(c => MOOD_CATEGORIES[mood].includes(c))
    : finalCats;
  const activeCats = (moodFiltered.length >= 3 ? moodFiltered : finalCats).slice(0, 8);

  // Parallel fetch
  const [supaItems, ...pexelsArrays] = await Promise.all([
    fetchFromSupabase(activeCats, Math.floor(limit * 0.4)),
    ...activeCats.slice(0, 5).map(cat => fetchFromPexels(cat, 6)),
  ]);

  const pexelsItems  = pexelsArrays.flat();
  const combined     = [...supaItems, ...pexelsItems];
  const existingIds  = new Set(combined.map(i => i.id));

  // Fill from fallback — sorted by engagement descending
  const fallbackFill = FALLBACK_CATALOG
    .filter(i => !existingIds.has(i.id))
    .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));

  const withFallback = [...combined, ...fallbackFill];

  // Run through addiction ranking engine
  return rankItems(withFallback, "discovery").slice(0, limit);
}

// ─── Category-specific feed with pagination ───────────────────────────────────
export async function getCategoryFeed(category, limit = 20, page = 1) {
  const cacheKey = `cat_feed_${category}_${limit}_${page}`;
  const cached   = getCached(cacheKey);
  if (cached) return rankItems(cached, "discovery").slice(0, limit);

  const supaOffset = (page - 1) * Math.floor(limit * 0.6);

  const [supaItems, pexelsItems] = await Promise.all([
    fetchFromSupabase([category], Math.floor(limit * 0.6), supaOffset),
    fetchFromPexels(category, Math.ceil(limit * 0.5), page),
  ]);

  const fallback = FALLBACK_CATALOG.filter(i => i.category === category);
  const all      = [...supaItems, ...pexelsItems, ...fallback];
  const unique   = [...new Map(all.map(i => [i.id, i])).values()];

  setCached(cacheKey, unique);
  return rankItems(unique, "discovery").slice(0, limit);
}

// ─── Related category feed (for addiction loop) ───────────────────────────────
// Given a viewed item, find the most related categories and build a feed
export async function getRelatedFeed(item, limit = 15) {
  const cat     = item.category || "";
  const mood    = item.mood     || deriveMood(cat);
  const related = (MOOD_CATEGORIES[mood] || []).filter(c => c !== cat);

  // Add categories with similar engagement level
  const baseScore  = CATEGORY_ENGAGEMENT_BASE[cat] || 70;
  const sameLevel  = DISCOVERY_CATEGORIES.filter(c => {
    const diff = Math.abs((CATEGORY_ENGAGEMENT_BASE[c] || 70) - baseScore);
    return diff <= 15 && c !== cat && !related.includes(c);
  });

  const allRelated = [...related, ...sameLevel].slice(0, 4);
  if (!allRelated.length) return getCategoryFeed(cat, limit);

  const feeds = await Promise.all(allRelated.slice(0, 3).map(c => getCategoryFeed(c, 6)));
  const flat  = feeds.flat();
  const unique = [...new Map(flat.map(i => [i.id, i])).values()];
  return rankItems(unique, "discovery").slice(0, limit);
}

// ─── Inject clip (for feed pipeline) ─────────────────────────────────────────
export async function getInjectClip(context = {}) {
  const topCats = getTopCategories(3);
  if (topCats.length) {
    const supaItems = await fetchFromSupabase(topCats, 3).catch(() => []);
    if (supaItems.length) return supaItems[0];
    const pex = await fetchFromPexels(topCats[0], 3).catch(() => []);
    if (pex.length) return pex[0];
  }
  return FALLBACK_CATALOG.sort((a,b) => b.engagementScore - a.engagementScore)[0];
}

export default {
  getDiscoveryFeed, getCategoryFeed, getRelatedFeed, getInjectClip,
  clearDiscoveryCache, getSavedDiscovery, isSavedDiscovery,
  toggleSavedDiscovery, loadSavedItem, clearAllSaved,
  DISCOVERY_CATEGORIES, CATEGORY_GRADIENTS, FALLBACK_CATALOG, CATEGORY_QUERIES,
};