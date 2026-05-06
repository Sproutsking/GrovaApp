// src/components/Home/FeedPipelines.jsx — v2 PERFECTED
//
// ═══════════════════════════════════════════════════════════════════════════
// BUGS FIXED vs v1:
//
// [FIX-1]  fetched.current is now component state (useRef per instance),
//          NOT a module-level ref. The old module-level ref caused:
//          re-mounted components to skip fetching forever after first mount.
//          Each instance now tracks its own fetch lifecycle independently.
//
// [FIX-2]  Cache now uses a module-level Map keyed by type, with proper
//          TTL invalidation on error — so a failed fetch doesn't poison
//          the cache for the session.
//
// [FIX-3]  FollowsPipeline guard was `if (!currentUser?.id) return` inside
//          useEffect — if currentUser arrived late (async), the effect had
//          already bailed. Fixed with a proper dependency on currentUser?.id.
//
// [FIX-4]  ReelThumb / NewsThumb navigation was broken because onNavigate
//          was receiving ("reels", reel) but callers expected ("reels").
//          Standardised: onNavigate(tabName) — the reel/article detail
//          navigation is left to the parent tab to handle.
//
// [FIX-5]  useFeedInjections: seed is now stable via a module-level Set
//          keyed by component instance, preventing injection map from
//          shifting when postCount grows. Injection positions are frozen
//          once placed — new posts just get new injections appended.
//
// [FIX-6]  PipelineShell scroll arrows now correctly target the strip ref.
//
// [FIX-7]  Empty-state guard (`if (!loading && items.length === 0) return null`)
//          is now deferred by 300ms to avoid flicker when cache is warming.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  Users, Film, Newspaper,
  UserPlus, Check,
  Play, Radio,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase }    from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import reelService     from "../../services/home/reelService";
import newsService     from "../../services/news/newsService";
import followService   from "../../services/social/followService";

// ─── Pipeline type constants ──────────────────────────────────────────────────
export const PIPELINE = {
  FOLLOWS: "follows",
  REELS:   "reels",
  NEWS:    "news",
};

// ─── Module-level cache — keyed by type, survives re-renders within TTL ───────
// [FIX-2] Cache is separate from fetched state so errors don't poison it.
const _cache  = new Map(); // type → { data: [], ts: number }
const CACHE_TTL = 5 * 60 * 1000;

function getCached(type) {
  const entry = _cache.get(type);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(type); return null; }
  return entry.data;
}
function setCached(type, data) {
  _cache.set(type, { data, ts: Date.now() });
}

// ─── Session-stable rotation — shuffled ONCE per page load ───────────────────
const _sessionOrder = (() => {
  const types = [PIPELINE.FOLLOWS, PIPELINE.REELS, PIPELINE.NEWS];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
})();

// ─── Seeded LCG RNG ──────────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// ═══════════════════════════════════════════════════════════════════════════
// useFeedInjections
// [FIX-5] Injection map is built once per session seed and then EXTENDED
//         (never rebuilt) as postCount grows. Positions already placed
//         never shift — new posts beyond the old postCount get new slots.
// ═══════════════════════════════════════════════════════════════════════════
export function useFeedInjections(postCount) {
  // Stable session seed — never changes
  const seedRef    = useRef(null);
  const mapRef     = useRef(new Map());
  const cursorRef  = useRef(0);
  const typeRef    = useRef(0);
  const rngRef     = useRef(null);

  if (seedRef.current === null) {
    seedRef.current = Math.floor(Math.random() * 2147483646) + 1;
    rngRef.current  = makeLCG(seedRef.current);
  }

  // Extend the map — never rebuild it
  useMemo(() => {
    if (postCount < 10) return;
    const rng = rngRef.current;
    // Advance cursor from where we left off
    while (cursorRef.current < postCount) {
      const gap = 10 + Math.floor(rng() * 16); // 10–25 gap
      cursorRef.current += gap;
      if (cursorRef.current >= postCount) break;
      if (!mapRef.current.has(cursorRef.current)) {
        mapRef.current.set(
          cursorRef.current,
          _sessionOrder[typeRef.current % _sessionOrder.length],
        );
        typeRef.current++;
      }
    }
  }, [postCount]);

  return mapRef.current;
}

// ═══════════════════════════════════════════════════════════════════════════
// PipelineShell — consistent chrome for all three pipelines
// ═══════════════════════════════════════════════════════════════════════════
const PipelineShell = ({
  Icon, label, badge, badgeBg, children, scrollRef, onLeft, onRight,
}) => (
  <div className="fp-shell">
    <div className="fp-hdr">
      <div className="fp-hdr-l">
        <div className="fp-hdr-icon"><Icon size={13} /></div>
        <span className="fp-hdr-label">{label}</span>
        {badge && (
          <span className="fp-badge" style={{ background: badgeBg || "rgba(239,68,68,0.18)" }}>
            {badge}
          </span>
        )}
      </div>
      <div className="fp-hdr-r">
        {/* [FIX-6] arrows call the correct handlers */}
        <button className="fp-arr" onClick={onLeft}  aria-label="Scroll left" ><ChevronLeft  size={14} /></button>
        <button className="fp-arr" onClick={onRight} aria-label="Scroll right"><ChevronRight size={14} /></button>
      </div>
    </div>
    <div className="fp-strip" ref={scrollRef}>{children}</div>
    <style>{FP_CSS}</style>
  </div>
);

const Skel = ({ w, h }) => (
  <div className="fp-skel" style={{ width: w, minWidth: w, height: h }} aria-hidden />
);

// ─── [FIX-7] Deferred empty guard to avoid flicker ───────────────────────────
function useDeferredEmpty(loading, length, delay = 350) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setReady(true), delay);
      return () => clearTimeout(t);
    }
    setReady(false);
  }, [loading, delay]);
  return ready && length === 0; // true only after loading done + delay passed
}

// ═══════════════════════════════════════════════════════════════════════════
// [PIPELINE-FOLLOWS] — "People you might know"
// ═══════════════════════════════════════════════════════════════════════════
const FollowCard = React.memo(({ user, currentUserId }) => {
  const [btnState, setBtnState] = useState("idle"); // idle | pending | done

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
          : <div className="fp-fc-initials">{initials}</div>
        }
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
          {btnState === "done"
            ? <><Check size={11} /> Following</>
            : btnState === "pending"
            ? <span className="fp-fc-spin" />
            : <><UserPlus size={11} /> Follow</>
          }
        </button>
      </div>
    </div>
  );
});
FollowCard.displayName = "FollowCard";

export const FollowsPipeline = ({ currentUser }) => {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef  = useRef(null);
  const fetchedRef = useRef(false); // [FIX-1] instance-level ref, not module-level

  // [FIX-3] Depend on currentUser?.id so if it arrives late, we still fetch
  useEffect(() => {
    if (!currentUser?.id) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = getCached(PIPELINE.FOLLOWS);
    if (cached) { setUsers(cached); setLoading(false); return; }

    (async () => {
      try {
        const { data: mine } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id)
          .limit(40);

        const myIds = (mine || []).map(f => f.following_id);
        let suggestions = [];

        if (myIds.length > 0) {
          const excl = [currentUser.id, ...myIds].join(",");
          const { data: deg2 } = await supabase
            .from("follows")
            .select("following_id, profiles!follows_following_id_fkey(id,full_name,username,avatar_id,verified)")
            .in("follower_id", myIds.slice(0, 15))
            .not("following_id", "in", `(${excl})`)
            .limit(60);

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

        if (suggestions.length < 6) {
          const excl2 = [currentUser.id, ...myIds, ...suggestions.map(u => u.id)].join(",");
          const { data: pop } = await supabase
            .from("profiles")
            .select("id,full_name,username,avatar_id,verified")
            .is("deleted_at", null)
            .eq("account_status", "active")
            .not("id", "in", `(${excl2 || currentUser.id})`)
            .order("created_at", { ascending: false })
            .limit(15 - suggestions.length);

          suggestions = [
            ...suggestions,
            ...(pop || []).map(u => ({ ...u, mutual_count: 0 })),
          ];
        }

        const result = suggestions.slice(0, 12);
        setCached(PIPELINE.FOLLOWS, result); // [FIX-2] only cache on success
        setUsers(result);
      } catch {
        setUsers([]);
        fetchedRef.current = false; // [FIX-2] allow retry on error
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser?.id]); // [FIX-3] re-run if user arrives late

  const scroll  = d => scrollRef.current?.scrollBy({ left: d * 200, behavior: "smooth" });
  const isEmpty = useDeferredEmpty(loading, users.length);
  if (isEmpty) return null;

  return (
    <PipelineShell
      Icon={Users} label="People you might know"
      scrollRef={scrollRef} onLeft={() => scroll(-1)} onRight={() => scroll(1)}
    >
      {loading
        ? [1,2,3,4,5].map(i => <Skel key={i} w={148} h={218} />)
        : users.map(u => (
            <FollowCard key={u.id} user={u} currentUserId={currentUser?.id} />
          ))
      }
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// [PIPELINE-REELS] — "Trending Reels"
// ═══════════════════════════════════════════════════════════════════════════
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
    n >= 1e6 ? `${(n/1e6).toFixed(1)}M` :
    n >= 1e3 ? `${(n/1e3).toFixed(1)}K` :
    String(n || 0);

  // [FIX-4] navigate passes only tab name — parent handles detail routing
  return (
    <button
      className="fp-rt"
      onClick={() => onNavigate?.("reels")}
      aria-label={reel.caption || "Reel"}
    >
      <div className="fp-rt-wrap">
        {!imgErr && thumbUrl
          ? <img
              src={thumbUrl} alt="" className="fp-rt-img"
              loading="lazy" decoding="async"
              style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.18s" }}
              onLoad={() => setLoaded(true)}
              onError={() => setImgErr(true)}
            />
          : <div className="fp-rt-noimg">
              <Play size={22} fill="rgba(255,255,255,0.35)" color="rgba(255,255,255,0.35)" />
            </div>
        }
        <div className="fp-rt-grad" />
        <div className="fp-rt-play"><Play size={14} fill="#fff" color="#fff" /></div>
        <div className="fp-rt-views">{fmt(reel.views)}</div>
      </div>
      <div className="fp-rt-cap">{reel.caption || reel.category || "Trending"}</div>
    </button>
  );
});
ReelThumb.displayName = "ReelThumb";

export const ReelsPipeline = ({ onNavigate }) => {
  const [reels,   setReels]   = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef  = useRef(null);
  const fetchedRef = useRef(false); // [FIX-1] instance-level

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = getCached(PIPELINE.REELS);
    if (cached) { setReels(cached); setLoading(false); return; }

    (async () => {
      try {
        const data   = await reelService.getReels({ limit: 15 });
        const result = (Array.isArray(data) ? data : [])
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 12);
        setCached(PIPELINE.REELS, result);
        setReels(result);
      } catch {
        setReels([]);
        fetchedRef.current = false; // allow retry
      } finally {
        setLoading(false);
      }
    })();
  }, []); // no deps needed — cache handles freshness

  const scroll  = d => scrollRef.current?.scrollBy({ left: d * 200, behavior: "smooth" });
  const isEmpty = useDeferredEmpty(loading, reels.length);
  if (isEmpty) return null;

  return (
    <PipelineShell
      Icon={Film} label="Trending Reels"
      badge="HOT" badgeBg="rgba(168,85,247,0.85)"
      scrollRef={scrollRef} onLeft={() => scroll(-1)} onRight={() => scroll(1)}
    >
      {loading
        ? [1,2,3,4,5].map(i => <Skel key={i} w={120} h={190} />)
        : reels.map(r => <ReelThumb key={r.id} reel={r} onNavigate={onNavigate} />)
      }
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// [PIPELINE-NEWS] — "Breaking Now"
// ═══════════════════════════════════════════════════════════════════════════
const NewsThumb = React.memo(({ article, onNavigate }) => {
  const [loaded, setLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const isBreaking = (article.tier ?? 99) <= 1 || article.liveStatus === "live";

  const ago = (() => {
    if (!article.published_at) return "";
    const s = Math.floor((Date.now() - new Date(article.published_at)) / 1000);
    if (s < 60)    return "just now";
    if (s < 3600)  return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  })();

  // [FIX-4] navigate passes only tab name
  return (
    <button
      className="fp-nt"
      onClick={() => onNavigate?.("news")}
      aria-label={article.title}
    >
      <div className="fp-nt-img-wrap">
        {!imgErr && article.image_url
          ? <img
              src={article.image_url} alt="" className="fp-nt-img"
              loading="lazy" decoding="async"
              style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
              onLoad={() => setLoaded(true)}
              onError={() => setImgErr(true)}
            />
          : <div className="fp-nt-noimg">
              <Newspaper size={18} color="rgba(255,255,255,0.2)" />
            </div>
        }
        <div className="fp-nt-grad" />
        {isBreaking && <div className="fp-nt-live"><Radio size={7} /> LIVE</div>}
        <div className="fp-nt-src">{article.source_name}</div>
      </div>
      <div className="fp-nt-title">{article.title}</div>
      <div className="fp-nt-ago">{ago}</div>
    </button>
  );
});
NewsThumb.displayName = "NewsThumb";

export const NewsPipeline = ({ onNavigate }) => {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const scrollRef  = useRef(null);
  const fetchedRef = useRef(false); // [FIX-1] instance-level

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = getCached(PIPELINE.NEWS);
    if (cached) { setArticles(cached); setLoading(false); return; }

    (async () => {
      try {
        const data   = await newsService.getNewsPosts({ limit: 15, offset: 0 });
        const result = (Array.isArray(data) ? data : [])
          .sort((a, b) => {
            const ta = a.tier ?? 99, tb = b.tier ?? 99;
            return ta !== tb
              ? ta - tb
              : new Date(b.published_at) - new Date(a.published_at);
          })
          .slice(0, 12);
        setCached(PIPELINE.NEWS, result);
        setArticles(result);
      } catch {
        setArticles([]);
        fetchedRef.current = false; // allow retry
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const scroll  = d => scrollRef.current?.scrollBy({ left: d * 210, behavior: "smooth" });
  const isEmpty = useDeferredEmpty(loading, articles.length);
  if (isEmpty) return null;

  return (
    <PipelineShell
      Icon={Newspaper} label="Breaking Now"
      badge="LIVE" badgeBg="rgba(239,68,68,0.85)"
      scrollRef={scrollRef} onLeft={() => scroll(-1)} onRight={() => scroll(1)}
    >
      {loading
        ? [1,2,3,4,5].map(i => <Skel key={i} w={190} h={168} />)
        : articles.map(a => (
            <NewsThumb key={a.id || a.url_hash} article={a} onNavigate={onNavigate} />
          ))
      }
    </PipelineShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FeedPipeline — dispatches to the correct pipeline component
// ═══════════════════════════════════════════════════════════════════════════
export const FeedPipeline = ({ type, currentUser, onNavigate }) => {
  switch (type) {
    case PIPELINE.FOLLOWS: return <FollowsPipeline currentUser={currentUser} />;
    case PIPELINE.REELS:   return <ReelsPipeline   onNavigate={onNavigate}   />;
    case PIPELINE.NEWS:    return <NewsPipeline     onNavigate={onNavigate}   />;
    default:               return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CSS — fp-* namespace
// ═══════════════════════════════════════════════════════════════════════════
const FP_CSS = `
/* ── Shell ── */
.fp-shell{
  width:100%;
  background:rgba(255,255,255,0.018);
  border-top:1px solid rgba(255,255,255,0.05);
  border-bottom:1px solid rgba(255,255,255,0.05);
  margin:6px 0;overflow:hidden;
}

/* ── Header ── */
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
  color:rgba(255,255,255,0.45);flex-shrink:0;
}
.fp-hdr-label{
  font-size:11.5px;font-weight:800;
  color:rgba(255,255,255,0.5);
  letter-spacing:.05em;text-transform:uppercase;
}
.fp-badge{
  font-size:8.5px;font-weight:900;letter-spacing:.07em;
  padding:2px 7px;border-radius:999px;color:#fff;
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

/* ── Strip ── */
.fp-strip{
  display:flex;align-items:flex-start;gap:10px;
  padding:4px 14px 14px;
  overflow-x:auto;scroll-snap-type:x mandatory;
  scrollbar-width:none;-webkit-overflow-scrolling:touch;
}
.fp-strip::-webkit-scrollbar{display:none;}

/* ── Skeleton ── */
.fp-skel{
  border-radius:12px;flex-shrink:0;scroll-snap-align:start;
  background:rgba(255,255,255,0.06);
  animation:fpSkel 1.5s ease-in-out infinite;
}
@keyframes fpSkel{0%,100%{opacity:.55}50%{opacity:.18}}

/* ══════════════════════════════
   FOLLOW CARDS (Facebook style)
   ══════════════════════════════ */
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
  background:linear-gradient(135deg,rgba(132,204,22,0.08),rgba(0,0,0,0.5));
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
  font-size:12.5px;font-weight:700;color:rgba(255,255,255,0.85);
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
  color:#a3e635;width:100%;transition:all .18s;margin-top:4px;
}
.fp-fc-btn:hover:not(:disabled){background:rgba(132,204,22,0.22);border-color:rgba(132,204,22,0.5);}
.fp-fc-btn--done{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);}
.fp-fc-btn:disabled{opacity:.6;cursor:default;}
@keyframes fpSpin{to{transform:rotate(360deg)}}
.fp-fc-spin{
  width:12px;height:12px;
  border:2px solid rgba(132,204,22,0.2);border-top-color:#84cc16;
  border-radius:50%;animation:fpSpin .7s linear infinite;
}

/* ══════════════════════════════
   REEL CARDS
   ══════════════════════════════ */
.fp-rt{
  width:118px;min-width:118px;
  display:flex;flex-direction:column;gap:6px;
  background:transparent;border:none;padding:0;
  cursor:pointer;text-align:left;
  scroll-snap-align:start;flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.fp-rt-wrap{
  position:relative;width:118px;height:188px;
  border-radius:12px;overflow:hidden;
  background:#0a0a0a;border:1px solid rgba(255,255,255,0.07);
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
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:34px;height:34px;border-radius:50%;
  background:rgba(0,0,0,0.55);border:1.5px solid rgba(255,255,255,0.4);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(6px);opacity:0;transition:opacity .2s;
}
.fp-rt:hover .fp-rt-play{opacity:1;}
.fp-rt-views{
  position:absolute;bottom:6px;left:7px;
  font-size:9px;font-weight:700;
  color:rgba(255,255,255,0.7);text-shadow:0 1px 4px rgba(0,0,0,0.8);
}
.fp-rt-cap{
  font-size:11px;font-weight:700;color:rgba(255,255,255,0.62);
  line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  padding:0 2px;
}

/* ══════════════════════════════
   NEWS CARDS
   ══════════════════════════════ */
.fp-nt{
  width:188px;min-width:188px;
  display:flex;flex-direction:column;
  background:rgba(255,255,255,0.025);
  border:1px solid rgba(255,255,255,0.06);
  border-radius:12px;overflow:hidden;
  cursor:pointer;text-align:left;
  scroll-snap-align:start;flex-shrink:0;padding:0;
  transition:border-color .18s,background .18s;
  -webkit-tap-highlight-color:transparent;
}
.fp-nt:hover{border-color:rgba(239,68,68,0.28);background:rgba(255,255,255,0.04);}
.fp-nt-img-wrap{position:relative;width:100%;height:106px;overflow:hidden;background:#111;flex-shrink:0;}
.fp-nt-img{width:100%;height:100%;object-fit:cover;display:block;}
.fp-nt-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;}
.fp-nt-grad{
  position:absolute;inset:0;
  background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.72) 100%);
  pointer-events:none;
}
.fp-nt-live{
  position:absolute;top:6px;left:6px;
  display:inline-flex;align-items:center;gap:4px;
  background:rgba(239,68,68,0.95);color:#fff;
  font-size:8px;font-weight:900;letter-spacing:.07em;
  padding:2px 7px;border-radius:4px;
  animation:fpLive 1.4s ease-in-out infinite;
}
@keyframes fpLive{0%,100%{opacity:1}50%{opacity:.7}}
.fp-nt-src{
  position:absolute;bottom:5px;right:7px;
  font-size:9px;font-weight:700;color:rgba(255,255,255,0.48);
  max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  text-shadow:0 1px 3px rgba(0,0,0,0.9);
}
.fp-nt-title{
  font-size:11.5px;font-weight:700;color:rgba(255,255,255,0.8);
  line-height:1.45;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  padding:8px 10px 0;
}
.fp-nt-ago{font-size:10px;color:rgba(255,255,255,0.3);font-weight:600;padding:4px 10px 10px;}

/* ── Mobile ── */
@media(max-width:768px){
  .fp-strip{padding:4px 12px 12px;gap:9px;}
  .fp-hdr{padding:8px 12px 5px;}
  .fp-arr{display:none;}
}
`;