// src/services/discovery/discoveryPersonalizationModel.js — v3 ULTRA-ADDICTIVE
//
// ALGORITHM OVERVIEW:
// ─────────────────────────────────────────────────────────────────────────────
// THREE-PHASE RANKING ENGINE:
//   Phase 1: Unseen items → newest-first (guaranteed fresh content on open)
//   Phase 2: Seen items   → affinity-ranked with decay (personalization)
//   Phase 3: Diversity injection every 6 slots (prevents filter bubbles,
//             introduces new categories that might hook the user)
//
// ADDICTION MECHANICS:
//   • Variable-ratio reward: every 7th item is a "surprise" from a
//     high-engagement category the user hasn't explored yet → dopamine spike
//   • Recency boost: items published in last 24h get +20 score bonus
//   • Streak detection: if user watches 3+ items from same category,
//     next item is deliberately from a different high-score category
//     to reset novelty → prevents boredom
//   • Cold-start: new users see highest-engagementScore items first
//     across the widest category mix (no preferences yet = max variety)
//   • Session context: night → calm/eerie/wonder; morning → wild/intense
//
// SIGNAL WEIGHTS:
//   WATCH_COMPLETE +15 | WATCH_HALF +8 | WATCH_QUARTER +4 | PAUSE +3
//   REPLAY +12 | LIKE +10 | SAVE +18 | SHARE +14 | COMMENT +9
//   CLICK_THROUGH +6 | SKIP -5 | HIDE -20 | MUTE_AND_SKIP -8
//
// DECAY: 14-day half-life (exponential). Fresh signals dominate, old ones fade.
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_KEY    = "xv_pm_v3";
const SEEN_KEY       = "xv_seen_v3";
const SESSION_KEY    = "xv_sess_v3";
const HALF_LIFE_MS   = 14 * 24 * 60 * 60 * 1000; // 14 days
const DECAY          = Math.log(2) / HALF_LIFE_MS;
const MAX_SEEN       = 3000;
const RECENCY_BONUS  = 20;   // added for items < 24h old
const RECENCY_WINDOW = 24 * 60 * 60 * 1000;
const SURPRISE_EVERY = 7;    // inject "surprise" category item every N slots
const STREAK_BREAK   = 3;    // after N same-cat views, force category switch

// ─── Signal weights ───────────────────────────────────────────────────────────
export const SIGNAL = {
  WATCH_COMPLETE:  15,
  WATCH_HALF:       8,
  WATCH_QUARTER:    4,
  PAUSE:            3,
  REPLAY:          12,
  LIKE:            10,
  INTEREST:        20,
  SAVE:            18,
  SHARE:           14,
  COMMENT:          9,
  CLICK_THROUGH:    6,
  SKIP:            -5,
  HIDE:           -20,
  MUTE_AND_SKIP:   -8,
};

// ─── Category affinity tier (used in cold-start ordering) ────────────────────
// Higher = more inherently engaging based on platform data
export const CATEGORY_ENGAGEMENT_BASE = {
  "Horror & Strange":   98,
  "Bioluminescence":    97,
  "Aurora":             96,
  "Deep Sea":           95,
  "Volcano":            94,
  "Predator":           93,
  "Cyclone":            92,
  "Wildlife":           91,
  "Birds":              90,
  "Caves":              89,
  "Space & Earth":      88,
  "Fungi":              87,
  "Night Nature":       86,
  "Storms":             85,
  "Abandoned":          84,
  "Macro Wildlife":     83,
  "Mountains":          82,
  "Aerial Earth":       81,
  "Ocean":              80,
  "Jungle":             79,
  "Extreme Nature":     78,
  "Survival":           77,
  "Desert":             76,
  "Waterfalls":         75,
  "Rain":               74,
  "Snow":               73,
  "Relaxation":         70,
};

// ─── Mood → categories mapping ────────────────────────────────────────────────
export const MOOD_CATEGORIES = {
  calm:         ["Ocean","Waterfalls","Rain","Relaxation","Snow","Aurora","Bioluminescence"],
  intense:      ["Predator","Storms","Extreme Nature","Survival","Volcano","Cyclone","Horror & Strange"],
  motivational: ["Predator","Birds","Mountains","Aerial Earth","Wildlife","Survival"],
  night:        ["Night Nature","Ocean","Space & Earth","Bioluminescence","Aurora","Caves","Abandoned"],
  curious:      ["Macro Wildlife","Jungle","Birds","Desert","Fungi","Caves","Deep Sea","Bioluminescence"],
  cinematic:    ["Aerial Earth","Mountains","Space & Earth","Ocean","Abandoned","Aurora"],
  eerie:        ["Horror & Strange","Caves","Abandoned","Night Nature","Deep Sea","Fungi"],
  wonder:       ["Bioluminescence","Aurora","Space & Earth","Deep Sea","Fungi","Caves"],
};

// ─── Persistence helpers ──────────────────────────────────────────────────────
const _emptyProfile = () => ({
  categories:   {},
  tags:         {},
  moods:        {},
  interactions: 0,
  streak:       { cat: null, count: 0 },
  createdAt:    Date.now(),
  updatedAt:    Date.now(),
});

const _emptySeen = () => ({
  post: [], reel: [], story: [], news: [], discovery: [],
});

const _emptySession = () => ({
  startedAt:    Date.now(),
  itemsViewed:  0,
  categoriesSeen: [],
  lastCategory: null,
});

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || _emptyProfile(); }
  catch { return _emptyProfile(); }
}
function saveProfile(p) {
  try { p.updatedAt = Date.now(); localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
  catch {}
}
function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || _emptySeen(); }
  catch { return _emptySeen(); }
}
function saveSeen(s) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); }
  catch {}
}
function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (!s || Date.now() - s.startedAt > 4 * 60 * 60 * 1000) return _emptySession();
    return s;
  } catch { return _emptySession(); }
}
function saveSession(s) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  catch {}
}

// ─── Seen-set helpers ─────────────────────────────────────────────────────────
function getSeenSet(type = "discovery") {
  const s = loadSeen();
  return new Set(s[type] || []);
}

export function markAsSeen(id, type = "discovery") {
  if (!id) return;
  const s   = loadSeen();
  const arr = s[type] || [];
  if (arr.includes(id)) return;
  arr.unshift(id);
  if (arr.length > MAX_SEEN) arr.splice(MAX_SEEN);
  s[type] = arr;
  saveSeen(s);
}

// ─── Affinity scoring ─────────────────────────────────────────────────────────
const decayed  = (score, ts) => score * Math.exp(-DECAY * (Date.now() - ts));
const getScore = (map, k)    => { const e = map[k]; return e ? decayed(e.score, e.lastUpdated) : 0; };
const addScore = (map, k, d) => {
  const c = getScore(map, k);
  map[k] = { score: Math.max(-60, Math.min(300, c + d)), lastUpdated: Date.now() };
};

function affinityScore(item, profile) {
  const cat  = (item.category || item.type || "general").toLowerCase();
  const mood = (item.mood || "").toLowerCase();
  const tags = Array.isArray(item.tags || item.hashtags) ? (item.tags || item.hashtags) : [];
  const eng  = item.engagementScore || item.likes || 0;

  // Category affinity (50%)
  let s = getScore(profile.categories, cat) * 0.5;

  // Mood affinity (20%)
  if (mood) s += getScore(profile.moods, mood) * 0.2;

  // Tag affinity (15%)
  if (tags.length) {
    const ts = tags.map(t => getScore(profile.tags, String(t).toLowerCase().replace(/^#/, "")));
    s += (ts.reduce((a, b) => a + b, 0) / ts.length) * 0.15;
  }

  // Engagement base score (10%)
  s += Math.min(eng / 100, 1) * 10;

  // Base category engagement (5%) — cold start
  const baseCat = item.category || "";
  s += ((CATEGORY_ENGAGEMENT_BASE[baseCat] || 70) / 100) * 5;

  // Recency bonus
  if (item.created_at) {
    const age = Date.now() - new Date(item.created_at).getTime();
    if (age < RECENCY_WINDOW) s += RECENCY_BONUS * (1 - age / RECENCY_WINDOW);
  }

  return Math.max(0, Math.min(200, s));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record engagement signal, update session, update streak.
 */
export function recordSignal(content, signalKey) {
  if (!content || !signalKey) return;
  const delta = SIGNAL[signalKey] ?? 0;

  // Always mark seen
  if (content.id) markAsSeen(content.id, "discovery");

  // Update session
  const sess = loadSession();
  sess.itemsViewed++;
  sess.lastCategory = content.category || null;
  if (content.category && !sess.categoriesSeen.includes(content.category)) {
    sess.categoriesSeen.push(content.category);
  }
  saveSession(sess);

  if (delta === 0) return;

  // Update profile
  const p = loadProfile();
  p.interactions++;

  const cat = (content.category || content.type || "general").toLowerCase();
  addScore(p.categories, cat, delta);

  if (content.mood) addScore(p.moods, content.mood.toLowerCase(), delta);

  const tags = content.tags || content.hashtags || [];
  (Array.isArray(tags) ? tags : []).forEach(t => {
    if (t) addScore(p.tags, String(t).toLowerCase().replace(/^#/, ""), delta);
  });

  // Streak tracking (positive signals only)
  if (delta > 0) {
    if (p.streak.cat === cat) {
      p.streak.count++;
    } else {
      p.streak = { cat, count: 1 };
    }
  }

  saveProfile(p);
}

/**
 * THREE-PHASE ranking with addiction mechanics.
 *
 * Phase 1 — unseen items, newest-first
 * Phase 2 — seen items, affinity-ranked
 * Phase 3 — diversity / surprise injection
 */
export function rankItems(items, contentType = "discovery") {
  if (!items?.length) return [];

  const seenSet = getSeenSet(contentType);
  const profile = loadProfile();
  const sess    = loadSession();
  const unseen  = [];
  const seen    = [];

  for (const item of items) {
    if (!item?.id) continue;
    seenSet.has(item.id) ? seen.push(item) : unseen.push(item);
  }

  // Phase 1: newest-first for unseen
  unseen.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : (CATEGORY_ENGAGEMENT_BASE[a.category] || 70);
    const tb = b.created_at ? new Date(b.created_at).getTime() : (CATEGORY_ENGAGEMENT_BASE[b.category] || 70);
    return tb - ta;
  });

  // Phase 2: affinity-ranked seen
  const scoredSeen = seen
    .map(item => ({ item, score: affinityScore(item, profile) }))
    .sort((a, b) => b.score - a.score);

  // Build output with diversity injection
  const result  = [];
  const catCounts = {};
  let seenIdx   = 0;
  let surprisePool = [...seen].filter(i => {
    // Surprise pool = items from categories user hasn't seen this session
    return !sess.categoriesSeen.includes(i.category);
  }).sort((a, b) => (CATEGORY_ENGAGEMENT_BASE[b.category] || 70) - (CATEGORY_ENGAGEMENT_BASE[a.category] || 70));

  // Streak breaker: if user is on a streak, prepare alt-category items
  const onStreak = profile.streak.count >= STREAK_BREAK;
  const streakCat = onStreak ? profile.streak.cat : null;

  // Combine unseen + scored seen into stream
  const stream = [
    ...unseen,
    ...scoredSeen.map(s => s.item),
  ];

  for (let i = 0; i < stream.length; i++) {
    const item = stream[i];
    const cat  = item.category || "general";
    catCounts[cat] = (catCounts[cat] || 0) + 1;

    // Every SURPRISE_EVERY slots, inject a surprise item
    if ((result.length + 1) % SURPRISE_EVERY === 0 && surprisePool.length > 0) {
      const surprise = surprisePool.shift();
      if (surprise && !result.some(r => r.id === surprise.id)) {
        result.push(surprise);
      }
    }

    // Streak breaker: if same category, try to swap in something different
    if (onStreak && cat === streakCat && seenIdx < scoredSeen.length) {
      const alt = scoredSeen.find(s => s.item.category !== streakCat && !result.some(r => r.id === s.item.id));
      if (alt) {
        result.push(alt.item);
        seenIdx++;
        continue;
      }
    }

    if (!result.some(r => r.id === item.id)) {
      result.push(item);
    }
  }

  return result;
}

export function scoreItem(item) {
  return affinityScore(item, loadProfile());
}

export function getTopCategories(n = 5) {
  const p = loadProfile();
  return Object.entries(p.categories)
    .map(([cat, e]) => ({ cat, score: decayed(e.score, e.lastUpdated) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.cat);
}

export function getSessionContext() {
  const h    = new Date().getHours();
  const sess = loadSession();
  return {
    isNight:          h >= 21 || h < 6,
    isMorning:        h >= 6 && h < 10,
    isAfternoon:      h >= 10 && h < 17,
    topCategories:    getTopCategories(3),
    sessionItems:     sess.itemsViewed,
    sessionCats:      sess.categoriesSeen,
    onStreak:         loadProfile().streak.count >= STREAK_BREAK,
  };
}

export function getUnexploredCategories(allCategories) {
  const p = loadProfile();
  const explored = new Set(Object.keys(p.categories));
  return allCategories.filter(c => !explored.has(c.toLowerCase()));
}

export function resetProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SEEN_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function exportProfile() {
  return { profile: loadProfile(), seen: loadSeen(), session: loadSession() };
}

export default {
  recordSignal, markAsSeen, rankItems, scoreItem,
  getTopCategories, getSessionContext, getUnexploredCategories,
  resetProfile, exportProfile, SIGNAL, MOOD_CATEGORIES, CATEGORY_ENGAGEMENT_BASE,
};