// src/components/Home/FeedPipelines.jsx — v8 PERFECT
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS FIXED vs v6:
//
// [FIX-1] NEVER-BLACK CARDS — removed background:#0a0a0a from .fp-dc-wrap
//         and .fp-rt-wrap. Every card now has a per-category/per-reel
//         cinematic gradient as the base layer. Thumbnails fade in OVER it.
//         Even if the network fails, the card is always visually filled.
//
// [FIX-2] AVATAR FALLBACK — FollowCard tries getImageUrl first (which
//         exists on all mediaUrlService builds), falls back to initials
//         rendered over a deterministic gradient. Never a black square.
//
// [FIX-3] REEL THUMBNAIL FALLBACK — ReelThumb now has a gradient base
//         that is always visible. Category label shows on gradient when
//         no image loads. Image fades in over it.
//
// [FIX-4] NAVIGATION — handlePipelineNavigate in PostTab was dropping
//         entityId. Fixed here: onNavigate("reels", reel.id) flows
//         correctly. Discovery cards navigate to "discovery" which
//         HomeView now maps to the DiscoveryTab if it exists.
//
// [FIX-5] CATEGORY_GRADIENTS defined locally — no external import needed.
//         Each Discovery card background is a rich cinematic gradient
//         derived from its category. No dependency on discoveryService.
//
// INJECTION LAYOUT (unchanged, correct):
//   Discovery → 2–5 | Follows → 10–15 | Reels → 20–28 | News → 30–43
//   Discovery re-appears every 4th slot (~50 posts). Cycles 10–20 apart.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  Users, Film, Newspaper, Compass, UserPlus, Check, Play,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase }      from "../../services/config/supabase";
import mediaUrlService   from "../../services/shared/mediaUrlService";
import reelService       from "../../services/home/reelService";
import followService     from "../../services/social/followService";
import { getDiscoveryFeed } from "../../services/discovery/discoveryService";
import { rankItems, getTopCategories } from "../../services/discovery/discoveryPersonalizationModel";

// ─── Pipeline type constants ──────────────────────────────────────────────────
export const PIPELINE = {
  FOLLOWS:   "follows",
  REELS:     "reels",
  NEWS:      "news",
  DISCOVERY: "discovery",
};

// ─── Module-level cache (5 min TTL) ──────────────────────────────────────────
const _cache    = new Map();
const CACHE_TTL = 5 * 60_000;
function getCached(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data) { _cache.set(key, { data, ts: Date.now() }); }

// ─── Seeded LCG RNG ──────────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = Math.max(1, seed | 0);
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const _SESSION_SEED = Math.floor(Math.random() * 2147483646) + 1;

// ─── [FIX-5] Per-category cinematic gradients (self-contained) ───────────────
const CATEGORY_GRADIENTS = {
  "Ocean":            "linear-gradient(160deg,#0c2a4a 0%,#0a4a6e 40%,#0e7490 100%)",
  "Jungle":           "linear-gradient(160deg,#052e16 0%,#14532d 50%,#166534 100%)",
  "Predator":         "linear-gradient(160deg,#1c0a00 0%,#431407 50%,#7c2d12 100%)",
  "Birds":            "linear-gradient(160deg,#0c1445 0%,#1e3a8a 50%,#1d4ed8 100%)",
  "Space & Earth":    "linear-gradient(160deg,#020617 0%,#0f172a 40%,#1e1b4b 100%)",
  "Snow":             "linear-gradient(160deg,#0c1a2e 0%,#1e3a5f 50%,#e2e8f0 100%)",
  "Rain":             "linear-gradient(160deg,#0a0f1e 0%,#1e293b 50%,#334155 100%)",
  "Waterfalls":       "linear-gradient(160deg,#042f2e 0%,#134e4a 50%,#0d9488 100%)",
  "Macro Wildlife":   "linear-gradient(160deg,#1a2e05 0%,#365314 50%,#4d7c0f 100%)",
  "Mountains":        "linear-gradient(160deg,#1c1917 0%,#292524 50%,#78716c 100%)",
  "Desert":           "linear-gradient(160deg,#1c1400 0%,#451a03 50%,#92400e 100%)",
  "Night Nature":     "linear-gradient(160deg,#020617 0%,#1e1b4b 50%,#312e81 100%)",
  "Storms":           "linear-gradient(160deg,#09090b 0%,#18181b 50%,#3f3f46 100%)",
  "Aerial Earth":     "linear-gradient(160deg,#0c1445 0%,#1e3a8a 40%,#0e7490 100%)",
  "Relaxation":       "linear-gradient(160deg,#042f2e 0%,#0f4c5c 50%,#0ea5e9 100%)",
  "Survival":         "linear-gradient(160deg,#1c0a00 0%,#292524 50%,#57534e 100%)",
  "Extreme Nature":   "linear-gradient(160deg,#1c0000 0%,#450a0a 50%,#b91c1c 100%)",
};
const DEFAULT_CATEGORY_GRAD = "linear-gradient(160deg,#0a0a14,#1a1a2e)";

// ─── Pipeline reel thumbnail preloader ──────────────────────────────────────
const _pipelineReelThumbsPreloaded = new Set();
function preloadPipelineReelThumbs(reels) {
  if (!reels?.length) return;
  reels.forEach((reel, i) => {
    const thumbId = reel.thumbnail_id || reel.video_id;
    if (!thumbId) return;
    const cacheKey = `p_thumb_${thumbId}`;
    if (_pipelineReelThumbsPreloaded.has(cacheKey)) return;
    _pipelineReelThumbsPreloaded.add(cacheKey);
    try {
      const url = reel.thumbnail_id
        ? mediaUrlService.getImageUrl(thumbId, { width: 240, quality: "auto:good", format: "webp" })
        : mediaUrlService.getVideoThumbnail(thumbId, { width: 240, height: 355 });
      if (url) {
        const img = new Image();
        img.fetchPriority = i < 3 ? "high" : "low";
        img.src = url;
      }
    } catch {}
  });
}

// ─── Per-reel category gradients ─────────────────────────────────────────────
const REEL_CAT_GRADIENTS = {
  Entertainment: "linear-gradient(160deg,#1a0a2e,#4c1d95)",
  Gaming:        "linear-gradient(160deg,#0c1445,#1d4ed8)",
  Sports:        "linear-gradient(160deg,#052e16,#166534)",
  Music:         "linear-gradient(160deg,#1c0a00,#7c2d12)",
  Comedy:        "linear-gradient(160deg,#1c1400,#92400e)",
  Education:     "linear-gradient(160deg,#0c2a4a,#0e7490)",
  Fashion:       "linear-gradient(160deg,#4a044e,#a21caf)",
  Food:          "linear-gradient(160deg,#1c0a00,#b45309)",
  Travel:        "linear-gradient(160deg,#0c1445,#0ea5e9)",
  General:       "linear-gradient(160deg,#1c1917,#44403c)",
};
function reelGrad(cat) { return REEL_CAT_GRADIENTS[cat] || REEL_CAT_GRADIENTS.General; }

// ─── Deterministic avatar gradient ───────────────────────────────────────────
const AVATAR_GRADS = [
  "linear-gradient(135deg,#1a4731,#166534)",
  "linear-gradient(135deg,#1e3a5f,#1d4ed8)",
  "linear-gradient(135deg,#3b0764,#7e22ce)",
  "linear-gradient(135deg,#431407,#b45309)",
  "linear-gradient(135deg,#0f4c5c,#0e7490)",
  "linear-gradient(135deg,#1c1917,#57534e)",
  "linear-gradient(135deg,#4a044e,#a21caf)",
  "linear-gradient(135deg,#052e16,#15803d)",
];
function avatarGrad(str = "") {
  const seed = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADS[seed % AVATAR_GRADS.length];
}

// ─── Safe avatar URL ──────────────────────────────────────────────────────────
function safeAvatarUrl(avatarId) {
  if (!avatarId) return null;
  try {
    if (typeof mediaUrlService.getImageUrl === "function")
      return mediaUrlService.getImageUrl(avatarId, { width: 160, height: 160, crop: "fill", gravity: "face" });
    if (typeof mediaUrlService.getAvatarUrl === "function")
      return mediaUrlService.getAvatarUrl(avatarId, 160);
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// useFeedInjections — PRECISION LAYOUT
// Discovery 2-5 | Follows 10-15 | Reels 20-28 | News 30-43 | cycle 10-20
// ═══════════════════════════════════════════════════════════════════════════════
export function useFeedInjections(postCount) {
  const mapRef     = useRef(new Map());
  const cursorRef  = useRef(0);
  const typeIdxRef = useRef(0);

  const sessionOrder = useMemo(() => {
    const rng  = makeLCG(_SESSION_SEED);
    const rest = [PIPELINE.REELS, PIPELINE.NEWS];
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [PIPELINE.DISCOVERY, PIPELINE.FOLLOWS, ...rest];
  }, []);

  useMemo(() => {
    if (postCount < 2) return;
    const rng = makeLCG(_SESSION_SEED ^ postCount);

    // SLOT 0: Discovery at 2-5
    if (cursorRef.current === 0 && postCount >= 6) {
      const firstPos = 2 + Math.floor(makeLCG(_SESSION_SEED)() * 4);
      if (!mapRef.current.has(firstPos)) {
        mapRef.current.set(firstPos, PIPELINE.DISCOVERY);
        cursorRef.current  = firstPos;
        typeIdxRef.current = 1;
      }
    }

    while (cursorRef.current < postCount) {
      const ti = typeIdxRef.current;
      let gap;
      if      (ti % 4 === 0) gap = 45 + Math.floor(rng() * 11); // re-Discovery ~50
      else if (ti === 1)      gap =  5 + Math.floor(rng() *  6); // Follows 10-15
      else if (ti === 2)      gap = 10 + Math.floor(rng() *  4); // Reels 20-28
      else if (ti === 3)      gap = 10 + Math.floor(rng() *  6); // News 30-43
      else                    gap = 10 + Math.floor(rng() * 11); // cycle 10-20

      const candidate = cursorRef.current + gap;
      if (candidate >= postCount) break;

      let pos = candidate;
      const clash = [...mapRef.current.keys()].some(k => Math.abs(k - pos) < 3);
      if (clash) pos += 3;
      if (pos >= postCount) break;

      if (!mapRef.current.has(pos)) {
        mapRef.current.set(pos, sessionOrder[ti % sessionOrder.length]);
        typeIdxRef.current++;
        cursorRef.current = pos;
      } else {
        cursorRef.current += 1;
      }
    }
  }, [postCount, sessionOrder]);

  return mapRef.current;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PipelineShell
// ═══════════════════════════════════════════════════════════════════════════════
const PipelineShell = ({ Icon, label, badge, badgeBg, accentColor, children, stripRef }) => {
  const scroll = useCallback((dir) => {
    stripRef?.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  }, [stripRef]);

  return (
    <div className="fp-shell">
      <div className="fp-hdr">
        <div className="fp-hdr-l">
          <div className="fp-hdr-icon" style={accentColor ? { background: accentColor } : undefined}>
            <Icon size={13} />
          </div>
          <span className="fp-hdr-label">{label}</span>
          {badge && (
            <span className="fp-badge" style={{ background: badgeBg || "rgba(239,68,68,0.18)" }}>
              {badge}
            </span>
          )}
        </div>
        <div className="fp-hdr-r">
          <button className="fp-arr" onClick={() => scroll(-1)} aria-label="Scroll left">
            <ChevronLeft size={14} />
          </button>
          <button className="fp-arr" onClick={() => scroll(1)} aria-label="Scroll right">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="fp-strip" ref={stripRef}>{children}</div>
      <style>{FP_CSS}</style>
    </div>
  );
};

// Skeleton — tinted, never black
const Skel = ({ w, h, tint = "rgba(255,255,255,0.06)" }) => (
  <div className="fp-skel" style={{ width: w, minWidth: w, height: h, background: tint }} aria-hidden />
);

function useDeferredEmpty(loading, length, delay = 400) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setReady(true), delay);
      return () => clearTimeout(t);
    }
    setReady(false);
  }, [loading, delay]);
  return ready && length === 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-FOLLOWS]
// ═══════════════════════════════════════════════════════════════════════════════
const FollowCard = React.memo(({ user, currentUserId }) => {
  const [btnState,  setBtnState]  = useState("idle");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const avatarUrl = safeAvatarUrl(user.avatar_id);
  const initials  = (user.full_name || user.username || "?")
    .split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
  const grad = avatarGrad(user.username || user.id || "");

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (!currentUserId || btnState !== "idle") return;
    setBtnState("pending");
    try {
      await followService.followUser(currentUserId, user.id);
      setBtnState("done");
    } catch { setBtnState("idle"); }
  }, [currentUserId, user.id, btnState]);

  const showImg = avatarUrl && !imgFailed;

  return (
    <div className="fp-fc">
      {/* Cover: gradient always as base, image fades over it */}
      <div className="fp-fc-cover" style={{ background: grad }}>
        {showImg && (
          <img
            src={avatarUrl} alt="" className="fp-fc-img" loading="lazy" decoding="async"
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.22s" }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        )}
        <div
          className="fp-fc-initials"
          style={{ opacity: (imgLoaded && showImg) ? 0 : 1, transition: "opacity 0.22s" }}
        >
          {initials}
        </div>
        {user.verified && <span className="fp-fc-tick">✓</span>}
      </div>
      <div className="fp-fc-body">
        <div className="fp-fc-name">{user.full_name || user.username}</div>
        <div className="fp-fc-user">@{user.username}</div>
        {user.mutual_count > 0 && (
          <div className="fp-fc-mutual">
            {user.mutual_count} mutual{user.mutual_count !== 1 ? "s" : ""}
          </div>
        )}
        <button
          className={`fp-fc-btn${btnState === "done" ? " fp-fc-btn--done" : ""}`}
          onClick={handleFollow}
          disabled={btnState !== "idle"}
        >
          {btnState === "done"    ? <><Check size={11} /> Following</>
           : btnState === "pending" ? <span className="fp-fc-spin" />
           : <><UserPlus size={11} /> Follow</>}
        </button>
      </div>
    </div>
  );
});
FollowCard.displayName = "FollowCard";

export const FollowsPipeline = ({ currentUser }) => {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const stripRef   = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    const cached = getCached(PIPELINE.FOLLOWS);
    if (cached) { setUsers(cached); setLoading(false); return; }

    (async () => {
      try {
        const { data: mine } = await supabase
          .from("follows").select("following_id")
          .eq("follower_id", currentUser.id).limit(40);
        if (cancelled) return;
        const myIds = (mine || []).map(f => f.following_id);
        let suggestions = [];

        if (myIds.length > 0) {
          const excl = [currentUser.id, ...myIds].join(",");
          const { data: deg2 } = await supabase
            .from("follows")
            .select("following_id, profiles!follows_following_id_fkey(id,full_name,username,avatar_id,verified)")
            .in("follower_id", myIds.slice(0, 15))
            .not("following_id", "in", `(${excl})`).limit(60);
          if (cancelled) return;
          const mutMap = new Map();
          (deg2 || []).forEach(r => {
            if (r.following_id) mutMap.set(r.following_id, (mutMap.get(r.following_id) || 0) + 1);
          });
          const seen = new Set();
          suggestions = (deg2 || [])
            .filter(r => r.profiles && !seen.has(r.following_id) && seen.add(r.following_id))
            .map(r => ({ ...r.profiles, mutual_count: mutMap.get(r.following_id) || 0 }))
            .sort((a, b) => b.mutual_count - a.mutual_count).slice(0, 15);
        }

        if (suggestions.length < 6) {
          const excl2 = [currentUser.id, ...suggestions.map(u => u.id)].join(",") || currentUser.id;
          const { data: pop } = await supabase.from("profiles")
            .select("id,full_name,username,avatar_id,verified")
            .is("deleted_at", null).eq("account_status", "active")
            .not("id", "in", `(${excl2})`).order("created_at", { ascending: false }).limit(12);
          if (cancelled) return;
          suggestions = [...suggestions, ...(pop || []).map(u => ({ ...u, mutual_count: 0 }))];
        }

        const result = suggestions.slice(0, 12);
        setCached(PIPELINE.FOLLOWS, result);
        if (!cancelled) setUsers(result);
      } catch {
        if (!cancelled) { setUsers([]); fetchedRef.current = false; }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const isEmpty = useDeferredEmpty(loading, users.length);
  if (isEmpty) return null;

  return (
    <PipelineShell Icon={Users} label="People you might know" stripRef={stripRef}>
      {loading
        ? [1,2,3,4,5].map(i => <Skel key={i} w={148} h={218} tint="rgba(132,204,22,0.07)" />)
        : users.map(u => <FollowCard key={u.id} user={u} currentUserId={currentUser?.id} />)}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-REELS] — [FIX-3] gradient base, thumbnail fades over it
// ═══════════════════════════════════════════════════════════════════════════════
const ReelThumb = React.memo(({ reel, onNavigate }) => {
  const [loaded, setLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const thumbUrl = (() => {
    try {
      if (reel.thumbnail_id)
        return mediaUrlService.getImageUrl(reel.thumbnail_id, {
          width: 220, height: 320, crop: "fill", gravity: "auto",
          quality: "auto:good", format: "webp",
        });
      if (reel.video_id && typeof mediaUrlService.getVideoThumbnail === "function")
        return mediaUrlService.getVideoThumbnail(reel.video_id, { width: 220, height: 320, time: "0" });
    } catch {}
    return null;
  })();

  const fmt = n =>
    n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n || 0);

  const handleClick = useCallback(() => {
    if (onNavigate) onNavigate("reels", reel.id);
  }, [onNavigate, reel.id]);

  const grad = reelGrad(reel.category);

  return (
    <button className="fp-rt" onClick={handleClick} aria-label={reel.caption || "Reel"}>
      {/* [FIX-3] gradient always shows as base */}
      <div className="fp-rt-wrap" style={{ background: grad }}>
        {thumbUrl && !imgErr && (
          <img
            src={thumbUrl} alt="" className="fp-rt-img" loading="lazy" decoding="async"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.22s" }}
            onLoad={() => setLoaded(true)}
            onError={() => setImgErr(true)}
          />
        )}
        <div className="fp-rt-grad" />
        <div className="fp-rt-play"><Play size={14} fill="#fff" color="#fff" /></div>
        {/* Category label visible when no thumb yet */}
        {(!loaded || imgErr) && (
          <div className="fp-rt-cat-lbl">{reel.category || "Reel"}</div>
        )}
        {reel.views > 0 && <div className="fp-rt-views">{fmt(reel.views)}</div>}
        {reel.duration > 0 && (
          <div className="fp-rt-dur">
            {Math.floor(reel.duration/60)}:{String(Math.floor(reel.duration%60)).padStart(2,"0")}
          </div>
        )}
      </div>
      <div className="fp-rt-cap">{reel.caption || reel.category || "Trending"}</div>
    </button>
  );
});
ReelThumb.displayName = "ReelThumb";

export const ReelsPipeline = ({ onNavigate }) => {
  const [reels,   setReels]   = useState([]);
  const [loading, setLoading] = useState(true);
  const stripRef   = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    const cached = getCached(PIPELINE.REELS);
    if (cached) { setReels(cached); setLoading(false); return; }

    (async () => {
      try {
        const data   = await reelService.getReels({ limit: 24 });
        if (cancelled) return;
        const items  = Array.isArray(data) ? data : [];
        const result = rankItems(items.sort((a,b) => (b.views||0)-(a.views||0))).slice(0, 16);
        setCached(PIPELINE.REELS, result);
        setReels(result);
        // Preload reel thumbnails ahead of user click
        preloadPipelineReelThumbs(result);
      } catch {
        if (!cancelled) { setReels([]); fetchedRef.current = false; }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isEmpty = useDeferredEmpty(loading, reels.length);
  if (isEmpty) return null;

  return (
    <PipelineShell
      Icon={Film} label="Trending Reels"
      badge="HOT" badgeBg="rgba(168,85,247,0.85)"
      stripRef={stripRef}
    >
      {loading
        ? [1,2,3,4,5].map(i => <Skel key={i} w={120} h={190} tint="rgba(168,85,247,0.07)" />)
        : reels.map(r => <ReelThumb key={r.id} reel={r} onNavigate={onNavigate} />)}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-NEWS] — lazy NewsVideoStrip, single fetch
// ═══════════════════════════════════════════════════════════════════════════════
const LazyNewsVideoStrip = React.lazy(() => import("./NewsVideoStrip"));

export const NewsPipeline = () => (
  <div className="fp-news-bridge">
    <div className="fp-news-label">
      <div className="fp-hdr-icon" style={{
        background:"rgba(239,68,68,0.8)",width:26,height:26,borderRadius:8,
        display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0,
      }}>
        <Newspaper size={13} />
      </div>
      <span className="fp-hdr-label">Breaking Now</span>
      <span className="fp-badge" style={{ background:"rgba(239,68,68,0.85)" }}>LIVE</span>
    </div>
    <React.Suspense fallback={
      <div style={{ height:180, background:"rgba(239,68,68,0.04)", margin:"4px 0", borderRadius:12 }} />
    }>
      <LazyNewsVideoStrip />
    </React.Suspense>
    <style>{`.fp-news-bridge{width:100%;overflow:hidden;background:rgba(255,255,255,0.018);border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);margin:6px 0;}.fp-news-label{display:flex;align-items:center;gap:8px;padding:10px 14px 2px;}`}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-DISCOVERY] — [FIX-1][FIX-5] gradient base, shimmer, title on card
// ═══════════════════════════════════════════════════════════════════════════════
const MOOD_GRAD = {
  calm:         "linear-gradient(90deg,#0ea5e9,#06b6d4)",
  intense:      "linear-gradient(90deg,#ef4444,#f97316)",
  motivational: "linear-gradient(90deg,#f59e0b,#eab308)",
  cinematic:    "linear-gradient(90deg,#e879f9,#a78bfa)",
  curious:      "linear-gradient(90deg,#10b981,#84cc16)",
  night:        "linear-gradient(90deg,#6366f1,#8b5cf6)",
};
const DEFAULT_MOOD_GRAD = "linear-gradient(90deg,#84cc16,#22d3ee)";

const DiscoveryThumb = React.memo(({ clip, onNavigate }) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbErr,    setThumbErr]    = useState(false);
  const [isHovered,   setIsHovered]   = useState(false);
  const videoRef   = useRef(null);
  const hoverTimer = useRef(null);

  const moodGrad = MOOD_GRAD[clip.mood] || DEFAULT_MOOD_GRAD;
  const bgGrad   = CATEGORY_GRADIENTS[clip.category] || DEFAULT_CATEGORY_GRAD;
  const hasThumb = !!(clip.thumbnailUrl && !thumbErr);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const el = videoRef.current;
    if (el && clip.videoUrl) {
      const assign = () => {
        if (!el.src) el.src = clip.videoUrl;
        hoverTimer.current = setTimeout(() => { el.play().catch(() => {}); }, 120);
      };
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(assign, { timeout: 300 }) : assign();
    }
  }, [clip.videoUrl]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    clearTimeout(hoverTimer.current);
    const el = videoRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
  }, []);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return (
    <button
      className="fp-dc"
      onClick={() => onNavigate?.("discovery", clip.category)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      aria-label={clip.title}
    >
      {/* Mood accent bar at top */}
      <div className="fp-dc-mood-bar" style={{ background: moodGrad }} />

      <div className="fp-dc-wrap">
        {/* [FIX-1] GRADIENT BASE — always rendered, no z-index fighting */}
        <div className="fp-dc-bg" style={{ background: bgGrad }} />

        {/* Shimmer while no thumb loaded */}
        {!hasThumb && <div className="fp-dc-shimmer" />}

        {/* Video on hover */}
        {clip.videoUrl && (
          <video
            ref={videoRef} muted playsInline loop preload="none"
            className={`fp-dc-video${isHovered ? " fp-dc-video--on" : ""}`}
          />
        )}

        {/* Thumbnail fades in over gradient */}
        {clip.thumbnailUrl && (
          <img
            src={clip.thumbnailUrl} alt={clip.title}
            className="fp-dc-img" loading="lazy" decoding="async"
            style={{ opacity: (thumbLoaded && !thumbErr) ? 1 : 0, transition: "opacity 0.25s" }}
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbErr(true)}
          />
        )}

        {/* Cinematic bottom gradient */}
        <div className="fp-dc-overlay" />

        {/* Play ring on hover */}
        <div className={`fp-dc-play-ring${isHovered ? " fp-dc-play-ring--on" : ""}`}>
          <Play size={16} fill="#fff" color="#fff" />
        </div>

        {/* Category + mood — always visible on gradient */}
        <div className="fp-dc-cat">{clip.category}</div>
        <div className="fp-dc-mood-chip" style={{ background: moodGrad }}>
          {clip.mood || "cinematic"}
        </div>

        {/* Title shown on gradient when no thumbnail */}
        {!hasThumb && (
          <div className="fp-dc-gradient-title">{clip.title}</div>
        )}
      </div>

      <div className="fp-dc-title">{clip.title}</div>
    </button>
  );
});
DiscoveryThumb.displayName = "DiscoveryThumb";

export const DiscoveryPipeline = ({ onNavigate }) => {
  const [clips,   setClips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const stripRef   = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    const cached = getCached(PIPELINE.DISCOVERY);
    if (cached) { setClips(cached); setLoading(false); return; }

    (async () => {
      try {
        const data    = await getDiscoveryFeed({ limit: 18 });
        if (cancelled) return;
        const topCats = getTopCategories(5);
        const ranked  = Array.isArray(data) ? data : [];
        const sorted  = [...ranked].sort((a, b) => {
          const ai = topCats.indexOf((a.category || "").toLowerCase());
          const bi = topCats.indexOf((b.category || "").toLowerCase());
          const aS = ai === -1 ? 999 : ai;
          const bS = bi === -1 ? 999 : bi;
          if (aS !== bS) return aS - bS;
          return (b.engagementScore||0) - (a.engagementScore||0);
        });
        const result = sorted.slice(0, 16);
        setCached(PIPELINE.DISCOVERY, result);
        if (!cancelled) setClips(result);
      } catch {
        if (!cancelled) { setClips([]); fetchedRef.current = false; }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isEmpty = useDeferredEmpty(loading, clips.length);
  if (isEmpty) return null;

  return (
    <PipelineShell
      Icon={Compass} label="Discovery Stream"
      badge="LIVE"
      badgeBg="linear-gradient(90deg,rgba(132,204,22,0.9),rgba(34,211,238,0.9))"
      accentColor="linear-gradient(135deg,#84cc16,#22d3ee)"
      stripRef={stripRef}
    >
      {loading
        ? [1,2,3,4,5,6].map(i => <Skel key={i} w={158} h={224} tint="rgba(132,204,22,0.06)" />)
        : clips.map(c => <DiscoveryThumb key={c.id} clip={c} onNavigate={onNavigate} />)}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FeedPipeline — dispatcher
// ═══════════════════════════════════════════════════════════════════════════════
export const FeedPipeline = ({ type, currentUser, onNavigate }) => {
  switch (type) {
    case PIPELINE.FOLLOWS:   return <FollowsPipeline  currentUser={currentUser} />;
    case PIPELINE.REELS:     return <ReelsPipeline    onNavigate={onNavigate} />;
    case PIPELINE.NEWS:      return <NewsPipeline />;
    case PIPELINE.DISCOVERY: return <DiscoveryPipeline onNavigate={onNavigate} />;
    default:                 return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════
const FP_CSS = `
/* Shell */
.fp-shell{width:100%;background:rgba(255,255,255,0.018);border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);margin:6px 0;overflow:hidden;}
.fp-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 6px;}
.fp-hdr-l{display:flex;align-items:center;gap:8px;}
.fp-hdr-icon{width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;color:#000;flex-shrink:0;}
.fp-hdr-label{font-size:11.5px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:.05em;text-transform:uppercase;}
.fp-badge{font-size:8.5px;font-weight:900;letter-spacing:.07em;padding:2px 8px;border-radius:999px;color:#fff;}
.fp-hdr-r{display:flex;gap:4px;}
.fp-arr{width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.28);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.fp-arr:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.6);}
.fp-strip{display:flex;align-items:flex-start;gap:10px;padding:4px 14px 14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.fp-strip::-webkit-scrollbar{display:none;}
@keyframes fpSkel{0%,100%{opacity:.7}50%{opacity:.3}}
.fp-skel{border-radius:14px;flex-shrink:0;scroll-snap-align:start;animation:fpSkel 1.5s ease-in-out infinite;}

/* Follow cards */
.fp-fc{width:148px;min-width:148px;display:flex;flex-direction:column;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;flex-shrink:0;scroll-snap-align:start;transition:border-color .2s,transform .2s;}
.fp-fc:hover{border-color:rgba(132,204,22,0.2);transform:translateY(-2px);}
.fp-fc-cover{position:relative;width:100%;height:120px;overflow:hidden;flex-shrink:0;}
.fp-fc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:2;}
.fp-fc-initials{position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:rgba(255,255,255,0.9);z-index:1;}
.fp-fc-tick{position:absolute;bottom:6px;right:6px;width:18px;height:18px;background:#3b82f6;border-radius:50%;border:2px solid #080808;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:900;z-index:3;}
.fp-fc-body{padding:10px 10px 12px;display:flex;flex-direction:column;gap:4px;}
.fp-fc-name{font-size:12.5px;font-weight:700;color:rgba(255,255,255,0.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fp-fc-user{font-size:10px;color:rgba(255,255,255,0.3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fp-fc-mutual{font-size:10px;color:rgba(132,204,22,0.65);font-weight:600;}
.fp-fc-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:6px 0;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:rgba(132,204,22,0.12);border:1px solid rgba(132,204,22,0.28);color:#a3e635;width:100%;transition:all .18s;margin-top:4px;}
.fp-fc-btn:hover:not(:disabled){background:rgba(132,204,22,0.22);border-color:rgba(132,204,22,0.5);}
.fp-fc-btn--done{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);}
.fp-fc-btn:disabled{opacity:.6;cursor:default;}
@keyframes fpSpin{to{transform:rotate(360deg)}}
.fp-fc-spin{width:12px;height:12px;border:2px solid rgba(132,204,22,0.2);border-top-color:#84cc16;border-radius:50%;animation:fpSpin .7s linear infinite;}

/* Reel thumbs */
.fp-rt{width:118px;min-width:118px;display:flex;flex-direction:column;gap:6px;background:transparent;border:none;padding:0;cursor:pointer;text-align:left;scroll-snap-align:start;flex-shrink:0;-webkit-tap-highlight-color:transparent;transition:transform .18s;}
.fp-rt:hover{transform:scale(1.04);}
.fp-rt:active{transform:scale(0.97);}
/* [FIX-3] no background:#0a0a0a — gradient set inline */
.fp-rt-wrap{position:relative;width:118px;height:188px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);}
.fp-rt:hover .fp-rt-wrap{border-color:rgba(168,85,247,0.3);}
.fp-rt-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:1;}
.fp-rt-cat-lbl{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:800;color:rgba(255,255,255,0.7);text-align:center;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 1px 4px rgba(0,0,0,0.8);pointer-events:none;padding:0 8px;z-index:2;}
.fp-rt-grad{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.82) 100%);pointer-events:none;}
.fp-rt-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.55);border:1.5px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);opacity:0;transition:opacity .2s;z-index:3;}
.fp-rt:hover .fp-rt-play{opacity:1;}
.fp-rt-views{position:absolute;bottom:6px;left:7px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);text-shadow:0 1px 4px rgba(0,0,0,0.8);z-index:3;}
.fp-rt-dur{position:absolute;bottom:6px;right:7px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.6);padding:1px 5px;border-radius:4px;z-index:3;}
.fp-rt-cap{font-size:11px;font-weight:700;color:rgba(255,255,255,0.62);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding:0 2px;}

/* Discovery cards */
.fp-dc{width:158px;min-width:158px;display:flex;flex-direction:column;gap:0;background:transparent;border:none;padding:0;cursor:pointer;text-align:left;scroll-snap-align:start;flex-shrink:0;-webkit-tap-highlight-color:transparent;transition:transform .22s cubic-bezier(.34,1.2,.64,1);}
.fp-dc:hover{transform:scale(1.03);}
.fp-dc:active{transform:scale(0.97);}
.fp-dc-mood-bar{width:100%;height:3px;border-radius:3px 3px 0 0;flex-shrink:0;}
/* [FIX-1] no background:#0a0a0a — transparent so gradient base shows */
.fp-dc-wrap{position:relative;width:158px;height:224px;border-radius:0 0 14px 14px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);border-top:none;background:transparent;}
.fp-dc:hover .fp-dc-wrap{border-color:rgba(132,204,22,0.22);}
/* Gradient base — always the bottom layer */
.fp-dc-bg{position:absolute;inset:0;}
/* Shimmer animation while loading */
@keyframes fpShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
.fp-dc-shimmer{position:absolute;inset:0;overflow:hidden;}
.fp-dc-shimmer::after{content:"";position:absolute;top:0;left:0;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent);animation:fpShimmer 1.8s ease-in-out infinite;}
.fp-dc-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .3s ease;z-index:2;}
.fp-dc-video--on{opacity:1;}
.fp-dc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:1;}
.fp-dc-overlay{position:absolute;inset:0;z-index:3;background:linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,transparent 30%,rgba(0,0,0,0.85) 100%);pointer-events:none;}
.fp-dc-play-ring{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.55);border:1.5px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);z-index:4;opacity:0;transition:opacity .2s ease;pointer-events:none;}
.fp-dc-play-ring--on{opacity:1;}
.fp-dc-cat{position:absolute;bottom:28px;left:8px;z-index:4;font-size:8.5px;font-weight:800;color:rgba(255,255,255,0.65);letter-spacing:.07em;text-transform:uppercase;text-shadow:0 1px 4px rgba(0,0,0,0.9);}
.fp-dc-mood-chip{position:absolute;bottom:8px;right:7px;z-index:4;font-size:7.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#fff;padding:2px 6px;border-radius:4px;opacity:0.88;}
.fp-dc-gradient-title{position:absolute;bottom:46px;left:8px;right:8px;z-index:4;font-size:12px;font-weight:700;color:rgba(255,255,255,0.88);line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,0.95);}
.fp-dc-title{font-size:11px;font-weight:700;color:rgba(255,255,255,0.65);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding:6px 2px 0;}

@media(max-width:768px){
  .fp-strip{padding:4px 12px 12px;gap:9px;}
  .fp-hdr{padding:8px 12px 5px;}
  .fp-arr{display:none;}
  .fp-dc{width:148px;min-width:148px;}
  .fp-dc-wrap{width:148px;height:210px;}
}
`;