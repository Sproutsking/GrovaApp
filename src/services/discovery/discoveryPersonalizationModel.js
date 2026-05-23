// src/services/discovery/discoveryPersonalizationModel.js — v2 RECENCY-FIRST
//
// TWO-PHASE MODEL:
//   Phase 1: Unseen items → newest-first (always fills the top of the feed)
//   Phase 2: Seen items   → affinity ranked (personalization after fresh content)
//
// When a user opens the app they always see new content first.
// Personalization only activates after all fresh content is exhausted.
//
// Signal weights (for Phase 2 affinity scoring):
//   WATCH_COMPLETE +12 | WATCH_HALF +6 | PAUSE +3 | REPLAY +8
//   LIKE +10 | SAVE +15 | SHARE +12 | COMMENT +8 | CLICK_THROUGH +5
//   SKIP -4 | HIDE -15

const PROFILE_KEY  = "xv_pm_v2";
const SEEN_KEY     = "xv_seen_v2";
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DECAY        = Math.log(2) / HALF_LIFE_MS;
const MAX_SEEN     = 2000; // cap per content type

export const SIGNAL = {
  WATCH_COMPLETE: 12, WATCH_HALF: 6, PAUSE: 3, REPLAY: 8,
  LIKE: 10, SAVE: 15, SHARE: 12, COMMENT: 8, CLICK_THROUGH: 5,
  SKIP: -4, HIDE: -15,
};

// ─── Persistence ──────────────────────────────────────────────────────────────
const _emptyProfile = () => ({ categories: {}, tags: {}, moods: {}, interactions: 0, createdAt: Date.now(), updatedAt: Date.now() });
const _emptySeen    = () => ({ post: [], reel: [], story: [], news: [], discovery: [] });

function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || _emptyProfile(); } catch { return _emptyProfile(); } }
function saveProfile(p) { try { p.updatedAt = Date.now(); localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {} }
function loadSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || _emptySeen(); } catch { return _emptySeen(); } }
function saveSeen(s) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch {} }

// ─── Seen-set management ──────────────────────────────────────────────────────
function getSeenSet(type) { const s = loadSeen(); return new Set(s[type] || []); }

export function markAsSeen(id, type = "post") {
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
const addScore = (map, k, d) => { const c = getScore(map, k); map[k] = { score: Math.max(-50, Math.min(200, c + d)), lastUpdated: Date.now() }; };

function affinityScore(item, profile) {
  const cat  = (item.category || item.type || "general").toLowerCase();
  const mood = (item.mood || "").toLowerCase();
  const tags = Array.isArray(item.tags || item.hashtags) ? (item.tags || item.hashtags) : [];
  const eng  = item.engagementScore || item.likes || 0;

  let s = getScore(profile.categories, cat) * 0.5;
  if (mood) s += getScore(profile.moods, mood) * 0.2;
  if (tags.length) {
    const ts = tags.map(t => getScore(profile.tags, String(t).toLowerCase().replace(/^#/, "")));
    s += (ts.reduce((a, b) => a + b, 0) / ts.length) * 0.2;
  }
  s += Math.min(eng / 100, 1) * 10;
  return Math.max(0, Math.min(100, s));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record engagement signal and mark item as seen.
 */
export function recordSignal(content, signalKey) {
  if (!content || !signalKey) return;
  const delta = SIGNAL[signalKey] ?? 0;
  if (content.id) markAsSeen(content.id, content.type || "post");
  if (delta === 0) return;

  const p = loadProfile();
  p.interactions++;
  addScore(p.categories, (content.category || content.type || "general").toLowerCase(), delta);
  if (content.mood) addScore(p.moods, content.mood.toLowerCase(), delta);
  const tags = content.tags || content.hashtags || [];
  (Array.isArray(tags) ? tags : []).forEach(t => { if (t) addScore(p.tags, String(t).toLowerCase().replace(/^#/, ""), delta); });
  saveProfile(p);
}

/**
 * Two-phase ranking:
 *   Phase 1 — unseen, sorted newest-first
 *   Phase 2 — seen, sorted by affinity (with diversity injection every 8 slots)
 */
export function rankItems(items, contentType = "post") {
  if (!items?.length) return [];
  const seenSet = getSeenSet(contentType);
  const profile = loadProfile();
  const unseen  = [];
  const seen    = [];

  for (const item of items) {
    if (!item?.id) continue;
    seenSet.has(item.id) ? seen.push(item) : unseen.push(item);
  }

  // Phase 1: newest first
  unseen.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  // Phase 2: affinity ranked
  const scored = seen.map(item => ({ item, score: affinityScore(item, profile) })).sort((a, b) => b.score - a.score);
  const lowPool = scored.filter(s => s.score < 15).map(s => s.item);
  let lp = 0;

  const result = [...unseen];
  scored.forEach((s, i) => {
    result.push(s.item);
    if ((i + 1) % 8 === 0 && lp < lowPool.length) {
      const c = lowPool[lp++];
      if (c && !result.some(r => r.id === c.id)) result.push(c);
    }
  });

  return result;
}

export function scoreItem(item) { return affinityScore(item, loadProfile()); }

export function getTopCategories(n = 5) {
  const p = loadProfile();
  return Object.entries(p.categories)
    .map(([cat, e]) => ({ cat, score: decayed(e.score, e.lastUpdated) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map(x => x.cat);
}

export function getSessionContext() {
  const h = new Date().getHours();
  return { isNight: h >= 21 || h < 6, isMorning: h >= 6 && h < 10, topCategories: getTopCategories(3) };
}

export function resetProfile() { try { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(SEEN_KEY); } catch {} }
export function exportProfile() { return { profile: loadProfile(), seen: loadSeen() }; }

export default { recordSignal, markAsSeen, rankItems, scoreItem, getTopCategories, getSessionContext, resetProfile, exportProfile, SIGNAL };