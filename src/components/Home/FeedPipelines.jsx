// src/components/Home/FeedPipelines.jsx — v6 PRECISION INJECTION
//
// ═══════════════════════════════════════════════════════════════════════════
// INJECTION LAYOUT (guaranteed, every session):
//
//  SLOT 0 → DISCOVERY   at post index  2 – 5   (seeded per session)
//  SLOT 1 → FOLLOWS     at post index 10 – 15  (gap  5–10 after Discovery)
//  SLOT 2 → REELS       at post index 20 – 28  (gap 10–13 after Follows)
//  SLOT 3 → NEWS        at post index 30 – 43  (gap 10–15 after Reels)
//  SLOT 4 → DISCOVERY   at post index 50 – 60  (re-appears every 4th slot)
//  SLOT 5+→ cycle FOLLOWS / REELS / NEWS        (gap 10–20 each)
//
// Gap formula per typeIdx:
//   ti === 0          → firstPos seed (2–5)        handled before loop
//   ti === 1          → FOLLOWS:  gap  5–10
//   ti === 2          → REELS:    gap 10–13
//   ti === 3          → NEWS:     gap 10–15
//   ti % 4 === 0      → DISCOVERY re-slot: gap 45–55
//   ti  >  3          → cycle:    gap 10–20
//
// All v5 logic preserved exactly:
//   • module-level 5-min cache
//   • seeded LCG / Fisher-Yates session shuffle
//   • AbortController guards on every fetch
//   • DISC-2 requestIdleCallback for video-src assignment
//   • NEWS-1 lazy NewsVideoStrip bridge
//   • REEL-1 onNavigate("reels", reelId)
//   • D6-fix PipelineShell scroll arrows via stripRef
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  Users, Film, Newspaper, Compass, UserPlus, Check, Play,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase }                    from "../../services/config/supabase";
import mediaUrlService                 from "../../services/shared/mediaUrlService";
import reelService                     from "../../services/home/reelService";
import followService                   from "../../services/social/followService";
import { getDiscoveryFeed }            from "../../services/discovery/discoveryService";
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

// ─── Session seed — stable within session, different across sessions ──────────
const _SESSION_SEED = Math.floor(Math.random() * 2147483646) + 1;

// ═══════════════════════════════════════════════════════════════════════════════
// useFeedInjections — PRECISION LAYOUT
//
// Returns a Map<postIndex → pipelineType> that PostTab reads when rendering
// the virtual feed. The map is built incrementally as postCount grows.
// ═══════════════════════════════════════════════════════════════════════════════
export function useFeedInjections(postCount) {
  const mapRef     = useRef(new Map());
  const cursorRef  = useRef(0);   // last placed injection position
  const typeIdxRef = useRef(0);   // how many injections placed so far

  // Session-stable pipeline order:
  //   [DISCOVERY, FOLLOWS, …shuffled rest…]
  //   DISCOVERY is always first (slot 0 placed manually).
  //   FOLLOWS is always second (slot 1).
  //   REELS / NEWS are shuffled for variety across sessions.
  const sessionOrder = useMemo(() => {
    const rng  = makeLCG(_SESSION_SEED);
    const rest = [PIPELINE.REELS, PIPELINE.NEWS];
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [PIPELINE.DISCOVERY, PIPELINE.FOLLOWS, ...rest];
    // length === 4  →  sessionOrder[ti % 4]
  }, []); // stable for the entire browser session

  useMemo(() => {
    if (postCount < 2) return;
    const rng = makeLCG(_SESSION_SEED ^ postCount);

    // ── SLOT 0: Discovery seeded at position 2–5 ─────────────────────────
    if (cursorRef.current === 0 && postCount >= 6) {
      const firstPos = 2 + Math.floor(makeLCG(_SESSION_SEED)() * 4); // 2,3,4,5
      if (!mapRef.current.has(firstPos)) {
        mapRef.current.set(firstPos, PIPELINE.DISCOVERY);
        cursorRef.current  = firstPos;
        typeIdxRef.current = 1; // next slot → FOLLOWS
      }
    }

    // ── SLOTS 1+: place subsequent pipelines ─────────────────────────────
    while (cursorRef.current < postCount) {
      const ti = typeIdxRef.current;

      // ── Gap calculation ──────────────────────────────────────────────
      let gap;
      if (ti % 4 === 0) {
        // Re-discovery: every 4th slot, ~50–60 posts after previous
        gap = 45 + Math.floor(rng() * 11); // 45–55
      } else if (ti === 1) {
        // FOLLOWS: land at index 10–15 (Discovery was at 2–5 → gap 5–10)
        gap = 5 + Math.floor(rng() * 6);   // 5–10
      } else if (ti === 2) {
        // REELS: land at index 20–28 (Follows was at 10–15 → gap 10–13)
        gap = 10 + Math.floor(rng() * 4);  // 10–13
      } else if (ti === 3) {
        // NEWS: land at index 30–43 (Reels was at 20–28 → gap 10–15)
        gap = 10 + Math.floor(rng() * 6);  // 10–15
      } else {
        // Cycle (ti > 3): keep feed breathing with 10–20 post gaps
        gap = 10 + Math.floor(rng() * 11); // 10–20
      }

      const candidate = cursorRef.current + gap;
      if (candidate >= postCount) break;

      // Collision guard — don't land within ±3 of an existing injection
      let pos = candidate;
      const clash = [...mapRef.current.keys()].some(k => Math.abs(k - pos) < 3);
      if (clash) pos += 3;
      if (pos >= postCount) break;

      if (!mapRef.current.has(pos)) {
        const type = sessionOrder[ti % sessionOrder.length];
        mapRef.current.set(pos, type);
        typeIdxRef.current++;
        cursorRef.current = pos;
      } else {
        // Position already taken — nudge cursor and retry same slot
        cursorRef.current += 1;
      }
    }
  }, [postCount, sessionOrder]);

  return mapRef.current;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PipelineShell — scroll arrows target strip via ref (D6-fix)
// ═══════════════════════════════════════════════════════════════════════════════
const PipelineShell = ({ Icon, label, badge, badgeBg, accentColor, children, stripRef }) => {
  const scroll = useCallback((dir) => {
    if (stripRef?.current)
      stripRef.current.scrollBy({ left: dir * 220, behavior: "smooth" });
  }, [stripRef]);

  return (
    <div className="fp-shell">
      <div className="fp-hdr">
        <div className="fp-hdr-l">
          <div
            className="fp-hdr-icon"
            style={accentColor ? { background: accentColor } : undefined}
          >
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
      <div className="fp-strip" ref={stripRef}>
        {children}
      </div>
      <style>{FP_CSS}</style>
    </div>
  );
};

const Skel = ({ w, h }) => (
  <div className="fp-skel" style={{ width: w, minWidth: w, height: h }} aria-hidden />
);

// Shows empty-state only after a short delay so skeleton never flashes
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
// [PIPELINE-FOLLOWS] — "People you might know"
// ═══════════════════════════════════════════════════════════════════════════════
const FollowCard = React.memo(({ user, currentUserId }) => {
  const [btnState, setBtnState] = useState("idle");

  const avatarUrl = user.avatar_id
    ? mediaUrlService.getAvatarUrl(user.avatar_id, 160)
    : null;

  const initials = (user.full_name || user.username || "?")
    .split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (!currentUserId || btnState !== "idle") return;
    setBtnState("pending");
    try {
      await followService.followUser(currentUserId, user.id);
      setBtnState("done");
    } catch {
      setBtnState("idle");
    }
  }, [currentUserId, user.id, btnState]);

  return (
    <div className="fp-fc">
      <div className="fp-fc-cover">
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="fp-fc-img" loading="lazy" decoding="async" />
          : <div className="fp-fc-initials">{initials}</div>}
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
          className={`fp-fc-btn ${btnState === "done" ? "fp-fc-btn--done" : ""}`}
          onClick={handleFollow}
          disabled={btnState !== "idle"}
        >
          {btnState === "done"   ? <><Check size={11} /> Following</>
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
        // Degree-2 suggestions (friends-of-friends)
        const { data: mine } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id)
          .limit(40);
        if (cancelled) return;

        const myIds = (mine || []).map(f => f.following_id);
        let suggestions = [];

        if (myIds.length > 0) {
          const excl = [currentUser.id, ...myIds].join(",");
          const { data: deg2 } = await supabase
            .from("follows")
            .select(
              "following_id, profiles!follows_following_id_fkey(id,full_name,username,avatar_id,verified)",
            )
            .in("follower_id", myIds.slice(0, 15))
            .not("following_id", "in", `(${excl})`)
            .limit(60);
          if (cancelled) return;

          const mutMap = new Map();
          (deg2 || []).forEach(r => {
            if (r.following_id)
              mutMap.set(r.following_id, (mutMap.get(r.following_id) || 0) + 1);
          });
          const seen = new Set();
          suggestions = (deg2 || [])
            .filter(r => r.profiles && !seen.has(r.following_id) && seen.add(r.following_id))
            .map(r => ({ ...r.profiles, mutual_count: mutMap.get(r.following_id) || 0 }))
            .sort((a, b) => b.mutual_count - a.mutual_count)
            .slice(0, 15);
        }

        // Fallback: popular accounts if suggestions are thin
        if (suggestions.length < 6) {
          const excl2 =
            [currentUser.id, ...suggestions.map(u => u.id)].join(",") || currentUser.id;
          const { data: pop } = await supabase
            .from("profiles")
            .select("id,full_name,username,avatar_id,verified")
            .is("deleted_at", null)
            .eq("account_status", "active")
            .not("id", "in", `(${excl2})`)
            .order("created_at", { ascending: false })
            .limit(12);
          if (cancelled) return;
          suggestions = [
            ...suggestions,
            ...(pop || []).map(u => ({ ...u, mutual_count: 0 })),
          ];
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
        ? [1, 2, 3, 4, 5].map(i => <Skel key={i} w={148} h={218} />)
        : users.map(u => <FollowCard key={u.id} user={u} currentUserId={currentUser?.id} />)}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-REELS] — REEL-1: clicking navigates to that specific reel
// ═══════════════════════════════════════════════════════════════════════════════
const ReelThumb = React.memo(({ reel, onNavigate }) => {
  const [loaded, setLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const thumbUrl = (() => {
    if (reel.thumbnail_id)
      return mediaUrlService.getImageUrl(reel.thumbnail_id, {
        width: 220, height: 320, crop: "fill",
        gravity: "auto", quality: "auto:good", format: "webp",
      });
    if (reel.video_id)
      return mediaUrlService.getVideoThumbnail(reel.video_id, { width: 220, height: 320, time: "0" });
    return null;
  })();

  const fmt = n =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
    : String(n || 0);

  const handleClick = useCallback(() => {
    if (onNavigate) onNavigate("reels", reel.id);
  }, [onNavigate, reel.id]);

  return (
    <button className="fp-rt" onClick={handleClick} aria-label={reel.caption || "Reel"}>
      <div className="fp-rt-wrap">
        {!imgErr && thumbUrl ? (
          <img
            src={thumbUrl} alt="" className="fp-rt-img" loading="lazy" decoding="async"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.18s" }}
            onLoad={() => setLoaded(true)}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="fp-rt-noimg">
            <Play size={22} fill="rgba(255,255,255,0.35)" color="rgba(255,255,255,0.35)" />
          </div>
        )}
        <div className="fp-rt-grad" />
        <div className="fp-rt-play"><Play size={14} fill="#fff" color="#fff" /></div>
        {reel.views > 0 && <div className="fp-rt-views">{fmt(reel.views)}</div>}
        {reel.duration > 0 && (
          <div className="fp-rt-dur">
            {Math.floor(reel.duration / 60)}:{String(Math.floor(reel.duration % 60)).padStart(2, "0")}
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
        const result = rankItems(
          items.sort((a, b) => (b.views || 0) - (a.views || 0)),
        ).slice(0, 16);
        setCached(PIPELINE.REELS, result);
        setReels(result);
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
      Icon={Film}
      label="Trending Reels"
      badge="HOT"
      badgeBg="rgba(168,85,247,0.85)"
      stripRef={stripRef}
    >
      {loading
        ? [1, 2, 3, 4, 5].map(i => <Skel key={i} w={120} h={190} />)
        : reels.map(r => <ReelThumb key={r.id} reel={r} onNavigate={onNavigate} />)}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-NEWS] — NEWS-1: compact NewsVideoStrip (lazy, single fetch)
// ═══════════════════════════════════════════════════════════════════════════════
const LazyNewsVideoStrip = React.lazy(() => import("./NewsVideoStrip"));

export const NewsPipeline = () => (
  <div className="fp-news-bridge">
    <div className="fp-news-label">
      <div
        className="fp-hdr-icon"
        style={{
          background: "rgba(239,68,68,0.8)",
          width: 26, height: 26, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", flexShrink: 0,
        }}
      >
        <Newspaper size={13} />
      </div>
      <span className="fp-hdr-label">Breaking Now</span>
      <span className="fp-badge" style={{ background: "rgba(239,68,68,0.85)" }}>LIVE</span>
    </div>
    <React.Suspense
      fallback={
        <div style={{
          height: 180,
          background: "rgba(255,255,255,0.03)",
          margin: "4px 0",
          borderRadius: 12,
        }} />
      }
    >
      <LazyNewsVideoStrip />
    </React.Suspense>
    <style>{`
      .fp-news-bridge{
        width:100%;overflow:hidden;
        background:rgba(255,255,255,0.018);
        border-top:1px solid rgba(255,255,255,0.05);
        border-bottom:1px solid rgba(255,255,255,0.05);
        margin:6px 0;
      }
      .fp-news-label{
        display:flex;align-items:center;gap:8px;
        padding:10px 14px 2px;
      }
    `}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// [PIPELINE-DISCOVERY] — DISC-1: 18 clips, affinity-sorted strip
// ═══════════════════════════════════════════════════════════════════════════════
const MOOD_GRAD = {
  calm:         "linear-gradient(90deg,#0ea5e9,#06b6d4)",
  intense:      "linear-gradient(90deg,#ef4444,#f97316)",
  motivational: "linear-gradient(90deg,#f59e0b,#eab308)",
  cinematic:    "linear-gradient(90deg,#e879f9,#a78bfa)",
  curious:      "linear-gradient(90deg,#10b981,#84cc16)",
  night:        "linear-gradient(90deg,#6366f1,#8b5cf6)",
};
const DEFAULT_GRAD = "linear-gradient(90deg,#84cc16,#22d3ee)";

const DiscoveryThumb = React.memo(({ clip, onNavigate }) => {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbErr,    setThumbErr]    = useState(false);
  const [isHovered,   setIsHovered]   = useState(false);
  const videoRef   = useRef(null);
  const hoverTimer = useRef(null);
  const grad       = MOOD_GRAD[clip.mood] || DEFAULT_GRAD;

  // DISC-2: assign video src only during idle time — never blocks main thread
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const el = videoRef.current;
    if (el && clip.videoUrl) {
      const assign = () => {
        if (!el.src) el.src = clip.videoUrl;
        hoverTimer.current = setTimeout(() => { el.play().catch(() => {}); }, 120);
      };
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(assign, { timeout: 300 })
        : assign();
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
      <div className="fp-dc-mood-bar" style={{ background: grad }} />
      <div className="fp-dc-wrap">
        {clip.videoUrl && (
          <video
            ref={videoRef}
            muted playsInline loop preload="none"
            className={`fp-dc-video${isHovered ? " fp-dc-video--show" : ""}`}
          />
        )}
        {!thumbErr && clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl} alt={clip.title}
            className="fp-dc-img" loading="lazy" decoding="async"
            style={{ opacity: thumbLoaded ? 1 : 0, transition: "opacity 0.2s" }}
            onLoad={() => setThumbLoaded(true)}
            onError={() => setThumbErr(true)}
          />
        ) : (
          <div className="fp-dc-noimg" style={{ background: `${grad}44` }} />
        )}
        <div className="fp-dc-grad" />
        <div className={`fp-dc-play-ring${isHovered ? " fp-dc-play-ring--show" : ""}`}>
          <Play size={16} fill="#fff" color="#fff" />
        </div>
        <div className="fp-dc-cat">{clip.category}</div>
        <div className="fp-dc-mood-chip" style={{ background: grad }}>
          {clip.mood || "cinematic"}
        </div>
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
        // DISC-1: fetch 18 then sort by user's category affinity
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
          return (b.engagementScore || 0) - (a.engagementScore || 0);
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
      Icon={Compass}
      label="Discovery Stream"
      badge="LIVE"
      badgeBg="linear-gradient(90deg,rgba(132,204,22,0.9),rgba(34,211,238,0.9))"
      accentColor="linear-gradient(135deg,#84cc16,#22d3ee)"
      stripRef={stripRef}
    >
      {loading
        ? [1, 2, 3, 4, 5, 6].map(i => <Skel key={i} w={158} h={224} />)
        : clips.map(c => <DiscoveryThumb key={c.id} clip={c} onNavigate={onNavigate} />)}
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FeedPipeline — top-level dispatcher used by PostTab
// ═══════════════════════════════════════════════════════════════════════════════
export const FeedPipeline = ({ type, currentUser, onNavigate }) => {
  switch (type) {
    case PIPELINE.FOLLOWS:   return <FollowsPipeline  currentUser={currentUser} />;
    case PIPELINE.REELS:     return <ReelsPipeline    onNavigate={onNavigate} />;
    case PIPELINE.NEWS:      return <NewsPipeline      onNavigate={onNavigate} />;
    case PIPELINE.DISCOVERY: return <DiscoveryPipeline onNavigate={onNavigate} />;
    default:                 return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS — all v5 styles preserved, zero changes
// ═══════════════════════════════════════════════════════════════════════════════
const FP_CSS = `
/* ── Shell ─────────────────────────────────────────────────────────────── */
.fp-shell{
  width:100%;
  background:rgba(255,255,255,0.018);
  border-top:1px solid rgba(255,255,255,0.05);
  border-bottom:1px solid rgba(255,255,255,0.05);
  margin:6px 0;
  overflow:hidden;
}
.fp-hdr{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 14px 6px;
}
.fp-hdr-l{display:flex;align-items:center;gap:8px;}
.fp-hdr-icon{
  width:26px;height:26px;border-radius:8px;
  background:rgba(255,255,255,0.055);
  border:1px solid rgba(255,255,255,0.08);
  display:flex;align-items:center;justify-content:center;
  color:#000;flex-shrink:0;
}
.fp-hdr-label{
  font-size:11.5px;font-weight:800;
  color:rgba(255,255,255,0.5);
  letter-spacing:.05em;text-transform:uppercase;
}
.fp-badge{
  font-size:8.5px;font-weight:900;
  letter-spacing:.07em;
  padding:2px 8px;border-radius:999px;color:#fff;
}
.fp-hdr-r{display:flex;gap:4px;}
.fp-arr{
  width:24px;height:24px;border-radius:7px;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.07);
  color:rgba(255,255,255,0.28);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s;
}
.fp-arr:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.6);}
.fp-strip{
  display:flex;align-items:flex-start;gap:10px;
  padding:4px 14px 14px;
  overflow-x:auto;
  scroll-snap-type:x mandatory;
  scrollbar-width:none;
  -webkit-overflow-scrolling:touch;
}
.fp-strip::-webkit-scrollbar{display:none;}
@keyframes fpSkel{0%,100%{opacity:.55}50%{opacity:.18}}
.fp-skel{
  border-radius:14px;flex-shrink:0;
  scroll-snap-align:start;
  background:rgba(255,255,255,0.06);
  animation:fpSkel 1.5s ease-in-out infinite;
}

/* ── Follow cards ─────────────────────────────────────────────────────── */
.fp-fc{
  width:148px;min-width:148px;
  display:flex;flex-direction:column;
  background:rgba(255,255,255,0.03);
  border:1px solid rgba(255,255,255,0.07);
  border-radius:14px;overflow:hidden;
  flex-shrink:0;scroll-snap-align:start;
  transition:border-color .2s,transform .2s;
}
.fp-fc:hover{border-color:rgba(132,204,22,0.2);transform:translateY(-2px);}
.fp-fc-cover{
  position:relative;width:100%;height:120px;
  background:linear-gradient(135deg,rgba(132,204,22,0.12),rgba(0,0,0,0.4));
  overflow:hidden;flex-shrink:0;
}
.fp-fc-img{width:100%;height:100%;object-fit:cover;display:block;}
.fp-fc-initials{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  font-size:32px;font-weight:800;color:rgba(132,204,22,0.85);
}
.fp-fc-tick{
  position:absolute;bottom:6px;right:6px;
  width:18px;height:18px;background:#3b82f6;
  border-radius:50%;border:2px solid #080808;
  display:flex;align-items:center;justify-content:center;
  font-size:9px;color:#fff;font-weight:900;
}
.fp-fc-body{padding:10px 10px 12px;display:flex;flex-direction:column;gap:4px;}
.fp-fc-name{
  font-size:12.5px;font-weight:700;
  color:rgba(255,255,255,0.85);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.fp-fc-user{
  font-size:10px;color:rgba(255,255,255,0.3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.fp-fc-mutual{font-size:10px;color:rgba(132,204,22,0.65);font-weight:600;}
.fp-fc-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:4px;
  padding:6px 0;border-radius:8px;
  font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;
  background:rgba(132,204,22,0.12);
  border:1px solid rgba(132,204,22,0.28);
  color:#a3e635;width:100%;
  transition:all .18s;margin-top:4px;
}
.fp-fc-btn:hover:not(:disabled){
  background:rgba(132,204,22,0.22);
  border-color:rgba(132,204,22,0.5);
}
.fp-fc-btn--done{
  background:rgba(255,255,255,0.05);
  border-color:rgba(255,255,255,0.1);
  color:rgba(255,255,255,0.4);
}
.fp-fc-btn:disabled{opacity:.6;cursor:default;}
@keyframes fpSpin{to{transform:rotate(360deg)}}
.fp-fc-spin{
  width:12px;height:12px;
  border:2px solid rgba(132,204,22,0.2);
  border-top-color:#84cc16;
  border-radius:50%;
  animation:fpSpin .7s linear infinite;
}

/* ── Reel thumbs ──────────────────────────────────────────────────────── */
.fp-rt{
  width:118px;min-width:118px;
  display:flex;flex-direction:column;gap:6px;
  background:transparent;border:none;padding:0;
  cursor:pointer;text-align:left;
  scroll-snap-align:start;flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
  transition:transform .18s;
}
.fp-rt:hover{transform:scale(1.04);}
.fp-rt:active{transform:scale(0.97);}
.fp-rt-wrap{
  position:relative;width:118px;height:188px;
  border-radius:12px;overflow:hidden;
  background:#0a0a0a;
  border:1px solid rgba(255,255,255,0.07);
}
.fp-rt:hover .fp-rt-wrap{border-color:rgba(168,85,247,0.3);}
.fp-rt-img{width:100%;height:100%;object-fit:cover;display:block;}
.fp-rt-noimg{
  width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#1a0a2e,#0d0014);
}
.fp-rt-grad{
  position:absolute;inset:0;
  background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.82) 100%);
  pointer-events:none;
}
.fp-rt-play{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  width:34px;height:34px;border-radius:50%;
  background:rgba(0,0,0,0.55);
  border:1.5px solid rgba(255,255,255,0.4);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(6px);
  opacity:0;transition:opacity .2s;
}
.fp-rt:hover .fp-rt-play{opacity:1;}
.fp-rt-views{
  position:absolute;bottom:6px;left:7px;
  font-size:9px;font-weight:700;
  color:rgba(255,255,255,0.7);
  text-shadow:0 1px 4px rgba(0,0,0,0.8);
}
.fp-rt-dur{
  position:absolute;bottom:6px;right:7px;
  font-size:9px;font-weight:700;
  color:rgba(255,255,255,0.7);
  background:rgba(0,0,0,0.6);
  padding:1px 5px;border-radius:4px;
}
.fp-rt-cap{
  font-size:11px;font-weight:700;
  color:rgba(255,255,255,0.62);
  line-height:1.4;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;padding:0 2px;
}

/* ── Discovery cards ──────────────────────────────────────────────────── */
.fp-dc{
  width:158px;min-width:158px;
  display:flex;flex-direction:column;gap:0;
  background:transparent;border:none;padding:0;
  cursor:pointer;text-align:left;
  scroll-snap-align:start;flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
  transition:transform .22s cubic-bezier(.34,1.2,.64,1);
}
.fp-dc:hover{transform:scale(1.03);}
.fp-dc:active{transform:scale(0.97);}
.fp-dc-mood-bar{width:100%;height:3px;border-radius:3px 3px 0 0;flex-shrink:0;}
.fp-dc-wrap{
  position:relative;width:158px;height:224px;
  border-radius:0 0 14px 14px;overflow:hidden;
  background:#0a0a0a;
  border:1px solid rgba(255,255,255,0.07);
  border-top:none;
}
.fp-dc:hover .fp-dc-wrap{border-color:rgba(132,204,22,0.22);}
.fp-dc-video{
  position:absolute;inset:0;
  width:100%;height:100%;object-fit:cover;
  display:block;opacity:0;
  transition:opacity .3s ease;z-index:2;
}
.fp-dc-video--show{opacity:1;}
.fp-dc-img{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:cover;display:block;z-index:1;
}
.fp-dc-noimg{position:absolute;inset:0;z-index:1;}
.fp-dc-grad{
  position:absolute;inset:0;z-index:3;
  background:linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.88) 100%);
  pointer-events:none;
}
.fp-dc-play-ring{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  width:38px;height:38px;border-radius:50%;
  background:rgba(0,0,0,0.55);
  border:1.5px solid rgba(255,255,255,0.35);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(8px);z-index:4;
  opacity:0;transition:opacity .2s ease;
  pointer-events:none;
}
.fp-dc-play-ring--show{opacity:1;}
.fp-dc-cat{
  position:absolute;bottom:28px;left:8px;z-index:4;
  font-size:8.5px;font-weight:800;
  color:rgba(255,255,255,0.55);
  letter-spacing:.07em;text-transform:uppercase;
  text-shadow:0 1px 4px rgba(0,0,0,0.9);
}
.fp-dc-mood-chip{
  position:absolute;bottom:8px;right:7px;z-index:4;
  font-size:7.5px;font-weight:900;
  letter-spacing:.06em;text-transform:uppercase;
  color:#fff;padding:2px 6px;border-radius:4px;opacity:0.85;
}
.fp-dc-title{
  font-size:11px;font-weight:700;
  color:rgba(255,255,255,0.65);
  line-height:1.4;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;padding:6px 2px 0;
}

/* ── Responsive ───────────────────────────────────────────────────────── */
@media(max-width:768px){
  .fp-strip{padding:4px 12px 12px;gap:9px;}
  .fp-hdr{padding:8px 12px 5px;}
  .fp-arr{display:none;}
  .fp-dc{width:148px;min-width:148px;}
  .fp-dc-wrap{width:148px;height:210px;}
}
`;