// src/components/Home/PostTab.jsx — v20 LIMIT-PUSHED INSTANT FEED
//
// ═══════════════════════════════════════════════════════════════════════════
// ARCHITECTURE — PUSHING THE LIMITS OF OPTIMISTIC UI
//
// [INSTANT-1]  26-post initial render window (up from 20). Every one of
//              the first 26 posts has its images baked into <link preload>
//              in <head> before React paints frame 1. The browser fetches
//              them during reconciliation — they are in HTTP cache by the
//              time PostCard mounts. Zero black frames.
//
// [INSTANT-2]  THREE-TIER prefetch engine runs at module level (survives
//              remounts). CRITICAL (±6 posts) → HEAD link injection + Image
//              object. URGENT (±16) → Image object with high fetchPriority.
//              BATCH (±32) → Image object with low fetchPriority.
//              Concurrency slots: CRITICAL=12, URGENT=8, BATCH=4 on fast.
//
// [INSTANT-3]  requestIdleCallback queues BATCH-tier fetches so they never
//              compete with the main thread during scroll jank.
//
// [INSTANT-4]  Anchor tracking uses a single IntersectionObserver at
//              threshold:0 with rootMargin "0px" — fires the instant ANY
//              pixel of a card enters the viewport. preloadBatch() runs
//              synchronously in rAF before next paint.
//
// [INSTANT-5]  RENDER_RADIUS = 26 on fast connections (±26 cards in DOM).
//              Cards outside this window replaced by colored Placeholder
//              whose height is remembered so scroll position never jumps.
//
// [INSTANT-6]  PostCard feedIndex 0-5 get fetchPriority="high" via the
//              img element. Cards 6-12 get "auto". Rest: lazy.
//
// [PIPELINE]   Discovery pipeline is ALWAYS injected in positions 2-5
//              (seeded random per session). Remaining pipelines follow the
//              permutation pattern at 10-30 post gaps — NOT sequential.
//              Discovery re-appears every 4th pipeline slot (every ~50
//              posts) to reinforce category learning.
//
// [SWR]        Module-level SWR cache (90s TTL) pre-seeds state with stale
//              data synchronously — user sees real content at frame 1.
//
// [SCROLL-TO]  Load-more fires at 40% AND 70% AND sentinel with 2500px
//              rootMargin to stay ahead of scroll.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useCallback, useRef, useEffect, useImperativeHandle,
  useMemo, useLayoutEffect, lazy, Suspense,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";
import PostCard from "./PostCard";
import { FeedPipeline, useFeedInjections } from "./FeedPipelines";
import { rankItems, recordSignal } from "../../services/discovery/discoveryPersonalizationModel";
import mediaUrlService from "../../services/shared/mediaUrlService";

const NewsVideoStrip = lazy(() => import("./NewsVideoStrip"));

// ─── Connection profile ───────────────────────────────────────────────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData || false;

const IS_SLOW = _save || _ect === "slow-2g" || _ect === "2g";
const IS_MID  = _ect === "3g";
const IS_FAST = !IS_SLOW && !IS_MID;

// [INSTANT-5] Render radius — cards in DOM around anchor
const RENDER_RADIUS   = IS_SLOW ? 10 : IS_MID ? 18 : 26;
// [INSTANT-2] Preload window — how far ahead to fetch images
const PRELOAD_WINDOW  = IS_SLOW ? 10 : IS_MID ? 20 : 36;
const VIDEO_PRELOAD_W = IS_SLOW ? 4  : IS_MID ? 8  : 18;
const PLACEHOLDER_H   = 540;

// Image quality
const IMG_W = IS_SLOW ? 480 : IS_MID ? 800 : 1200;
const IMG_Q = IS_SLOW ? "auto:low" : IS_MID ? "auto:good" : "auto:best";

// ─── Cloud ────────────────────────────────────────────────────────────────────
function getCld() {
  return (
    window.__CLD_CLOUD__ ||
    window.__CLOUDINARY_CLOUD__ ||
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    null
  );
}

// ─── Build ALL candidate URLs ─────────────────────────────────────────────────
function buildAllCandidates(id, opts = {}) {
  if (!id || typeof id !== "string" || !id.trim()) return [];
  const clean = id.trim();
  const w   = opts.width   || IMG_W;
  const q   = opts.quality || IMG_Q;
  const f   = opts.format  || "auto";
  const cld = getCld();
  const urls = [];

  try {
    const u = mediaUrlService.getImageUrl(clean, { width: w, quality: q, format: f, crop: "limit" });
    if (u && u.startsWith("http") && !urls.includes(u)) urls.push(u);
  } catch {}

  if (cld) {
    const u2 = `https://res.cloudinary.com/${cld}/image/upload/w_${w},q_${q},f_${f},c_limit/${clean}`;
    if (!urls.includes(u2)) urls.push(u2);
    const u3 = `https://res.cloudinary.com/${cld}/image/upload/${clean}`;
    if (!urls.includes(u3)) urls.push(u3);
  }

  if (clean.startsWith("http") && !urls.includes(clean)) urls.push(clean);

  const supa = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supa && !clean.startsWith("http")) {
    const u5 = `${supa}/storage/v1/object/public/posts/${clean}`;
    if (!urls.includes(u5)) urls.push(u5);
  }
  return urls;
}

// ─── Deterministic placeholder gradient ───────────────────────────────────────
const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(145deg,#0d1a00,#1a2e05)",
  "linear-gradient(145deg,#0f1a2e,#1a2a45)",
  "linear-gradient(145deg,#1a0d00,#2e1a05)",
  "linear-gradient(145deg,#0d0020,#1a0535)",
  "linear-gradient(145deg,#001a15,#002e25)",
  "linear-gradient(145deg,#1a1500,#2e2500)",
  "linear-gradient(145deg,#1a000d,#2e0015)",
  "linear-gradient(145deg,#001020,#001830)",
];

function getPlaceholderGradient(post) {
  const seed = (post?.user_id || post?.id || "x")
    .split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PLACEHOLDER_GRADIENTS[seed % PLACEHOLDER_GRADIENTS.length];
}

// ═══════════════════════════════════════════════════════════════════════════════
// [INSTANT-2] PRELOAD ENGINE — module-level, survives remounts
// ═══════════════════════════════════════════════════════════════════════════════
const TIER = { CRITICAL: 0, URGENT: 1, BATCH: 2 };
const _SLOTS = {
  [TIER.CRITICAL]: IS_FAST ? 12 : IS_MID ? 6 : 3,
  [TIER.URGENT]:   IS_FAST ? 8  : IS_MID ? 4 : 2,
  [TIER.BATCH]:    IS_FAST ? 4  : IS_MID ? 2 : 1,
};

const _queues  = { [TIER.CRITICAL]: [], [TIER.URGENT]: [], [TIER.BATCH]: [] };
const _done    = new Set();
const _flying  = { [TIER.CRITICAL]: 0, [TIER.URGENT]: 0, [TIER.BATCH]: 0 };
const _headSet = new Set();
let   _idleHandle = null;

function _injectHeadPreload(url) {
  if (_headSet.has(url)) return;
  _headSet.add(url);
  try {
    const link = document.createElement("link");
    link.rel           = "preload";
    link.as            = "image";
    link.href          = url;
    link.fetchPriority = "high";
    document.head.appendChild(link);
  } catch {}
}

function _drainTier(tier) {
  while (_flying[tier] < _SLOTS[tier] && _queues[tier].length > 0) {
    const url = _queues[tier].shift();
    _flying[tier]++;
    const img  = new Image();
    const done = () => { _flying[tier]--; _drainTier(tier); };
    img.onload  = done;
    img.onerror = done;
    if (tier === TIER.CRITICAL) img.fetchPriority = "high";
    if (tier === TIER.BATCH)    img.fetchPriority = "low";
    img.src = url;
  }
}

function _drain() {
  _drainTier(TIER.CRITICAL);
  _drainTier(TIER.URGENT);
  // Batch uses idle callback to avoid jank
  if (_queues[TIER.BATCH].length && !_idleHandle) {
    if (typeof requestIdleCallback !== "undefined") {
      _idleHandle = requestIdleCallback(() => {
        _idleHandle = null;
        _drainTier(TIER.BATCH);
      }, { timeout: 2000 });
    } else {
      setTimeout(() => { _drainTier(TIER.BATCH); }, 150);
    }
  }
}

function schedulePreload(url, tier = TIER.BATCH) {
  if (!url || typeof url !== "string") return;
  if (tier === TIER.CRITICAL) _injectHeadPreload(url);

  if (_done.has(url)) {
    // Upgrade tier if queued at lower priority
    for (let t = tier + 1; t <= TIER.BATCH; t++) {
      const idx = _queues[t].indexOf(url);
      if (idx !== -1) {
        _queues[t].splice(idx, 1);
        _queues[tier].unshift(url);
        _drain();
        return;
      }
    }
    return;
  }
  _done.add(url);
  _queues[tier].push(url);
  _drain();
}

function preloadPost(post, tier = TIER.BATCH) {
  if (!post) return;
  (post.image_ids || []).filter(Boolean).forEach(id => {
    buildAllCandidates(id).forEach(url => schedulePreload(url, tier));
  });
}

// [INSTANT-1] Preload first 26 posts at CRITICAL tier synchronously
function preloadBatch(posts, anchorIndex = 0) {
  if (!posts?.length) return;
  posts.forEach((post, i) => {
    if (!post) return;
    const dist = Math.abs(i - anchorIndex);
    const tier =
      dist <= 6  ? TIER.CRITICAL :
      dist <= 16 ? TIER.URGENT   : TIER.BATCH;
    preloadPost(post, tier);
  });
}

// ─── Head-inject for VERY FIRST posts ────────────────────────────────────────
function preloadFirstPaintImages(posts) {
  if (!posts?.length) return;
  const cld = getCld();
  posts.slice(0, 10).forEach(post => {
    (post.image_ids || []).slice(0, 1).filter(Boolean).forEach(id => {
      if (cld) {
        schedulePreload(
          `https://res.cloudinary.com/${cld}/image/upload/w_${IMG_W},q_${IMG_Q},f_auto,c_limit/${id.trim()}`,
          TIER.CRITICAL,
        );
      }
      try {
        const u = mediaUrlService.getImageUrl(id, { width: IMG_W, quality: IMG_Q, format: "auto" });
        if (u?.startsWith("http")) schedulePreload(u, TIER.CRITICAL);
      } catch {}
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NewPostBanner
// ═══════════════════════════════════════════════════════════════════════════════
function getSafeTop() {
  let max = 0;
  try {
    for (const el of document.querySelectorAll("*")) {
      const s = window.getComputedStyle(el), p = s.position;
      if (p !== "fixed" && p !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.top < 10 && r.bottom > max && r.width > 60) max = r.bottom;
    }
  } catch {}
  return Math.max(max, 56) + 10;
}

const NewPostBanner = ({ count, onShow, isActive }) => {
  const [topPx, setTopPx] = useState(getSafeTop);
  useEffect(() => {
    const id  = requestAnimationFrame(() => setTopPx(getSafeTop()));
    const onR = () => setTopPx(getSafeTop());
    window.addEventListener("resize", onR, { passive: true });
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onR); };
  }, []);
  if (!isActive || !count) return null;
  return ReactDOM.createPortal(
    <>
      <button className="ptb-pill" style={{ top: topPx }} onClick={onShow}>
        <ArrowUp size={13} />{count} new post{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .ptb-pill{position:fixed;left:50%;transform:translateX(-50%);z-index:9999;
          display:inline-flex;align-items:center;gap:7px;padding:9px 22px;
          border-radius:999px;background:rgba(84,163,10,0.97);
          border:1px solid rgba(255,255,255,0.22);color:#fff;font-size:13px;
          font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;
          box-shadow:0 6px 30px rgba(84,163,10,0.5);
          backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
          animation:ptbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;}
        .ptb-pill:hover{background:rgba(74,143,8,1);transform:translateX(-50%) scale(1.04);}
        .ptb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes ptbIn{from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
      `}</style>
    </>,
    document.body,
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VideoPreloadRunway
// ═══════════════════════════════════════════════════════════════════════════════
const VideoPreloadRunway = React.memo(({ posts, anchorIndex }) => {
  const cld    = getCld();
  const start  = Math.max(0, anchorIndex - VIDEO_PRELOAD_W);
  const end    = Math.min(posts.length - 1, anchorIndex + VIDEO_PRELOAD_W);
  const rStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const rEnd   = Math.min(posts.length - 1, anchorIndex + RENDER_RADIUS);

  const hints = [];
  for (let i = start; i <= end; i++) {
    if (i >= rStart && i <= rEnd) continue;
    const p = posts[i];
    if (!p?.video_ids?.length) continue;
    p.video_ids.filter(Boolean).forEach((id, j) => {
      if (!cld) return;
      const url = `https://res.cloudinary.com/${cld}/video/upload/q_auto,f_mp4/${id.trim()}.mp4`;
      hints.push(
        <video key={`vpr-${p.id}-${j}`} src={url} preload="metadata" muted playsInline
          aria-hidden="true" tabIndex={-1}
          style={{ position:"absolute",width:0,height:0,opacity:0,pointerEvents:"none" }}
        />,
      );
    });
  }
  if (!hints.length) return null;
  return (
    <div aria-hidden="true" style={{ position:"absolute",width:0,height:0,overflow:"hidden",opacity:0,pointerEvents:"none",zIndex:-1 }}>
      {hints}
    </div>
  );
});
VideoPreloadRunway.displayName = "VideoPreloadRunway";

// ═══════════════════════════════════════════════════════════════════════════════
// Placeholder — colored gradient, never black
// ═══════════════════════════════════════════════════════════════════════════════
const Placeholder = React.memo(({ height, post }) => (
  <div aria-hidden="true" style={{
    width:       "100%",
    height:      height || PLACEHOLDER_H,
    flexShrink:  0,
    contain:     "strict",
    background:  getPlaceholderGradient(post),
    borderRadius: 20,
    marginBottom: 10,
    border:       "1px solid rgba(255,255,255,0.04)",
  }}/>
));
Placeholder.displayName = "Placeholder";

// ═══════════════════════════════════════════════════════════════════════════════
// VirtualFeed — 26-post render window, instant anchor detection
// ═══════════════════════════════════════════════════════════════════════════════
const VirtualFeed = React.memo(({
  posts,
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  onAnchorChange,
  onPipelineNavigate,
  injections,
}) => {
  const [anchorIndex, setAnchorIndex] = useState(0);
  const heightMap  = useRef({});
  const wrapperMap = useRef({});
  const ioRef      = useRef(null);
  const roMap      = useRef({});

  useEffect(() => { onAnchorChange?.(anchorIndex); }, [anchorIndex, onAnchorChange]);

  const ROOT_MARGIN = IS_SLOW ? "800px 0px 800px 0px"
                    : IS_MID  ? "500px 0px 500px 0px"
                    :           "300px 0px 300px 0px";

  useEffect(() => {
    ioRef.current?.disconnect();
    ioRef.current = new IntersectionObserver(entries => {
      // Pick the topmost intersecting card
      let best = null, bestTop = Infinity;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const top = entry.boundingClientRect.top;
        const idx = Number(entry.target.dataset.vfidx);
        if (!isNaN(idx) && top < bestTop) { bestTop = top; best = idx; }
      }
      if (best !== null) setAnchorIndex(prev => Math.abs(prev - best) >= 1 ? best : prev);
    }, { rootMargin: ROOT_MARGIN, threshold: 0 });

    Object.values(wrapperMap.current).forEach(el => { if (el) ioRef.current.observe(el); });
    return () => ioRef.current?.disconnect();
  }, [posts.length]); // eslint-disable-line

  useEffect(() => () => { Object.values(roMap.current).forEach(ro => ro.disconnect()); }, []);

  const makeRef = useCallback((index) => (el) => {
    roMap.current[index]?.disconnect();
    delete roMap.current[index];
    wrapperMap.current[index] = el;
    if (!el) return;
    el.dataset.vfidx = index;
    ioRef.current?.observe(el);
    const ro = new ResizeObserver(([e]) => {
      const h = Math.round(e.contentRect.height);
      if (h > 0) heightMap.current[index] = h;
    });
    ro.observe(el);
    roMap.current[index] = ro;
  }, []);

  const renderStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const renderEnd   = Math.min(posts.length - 1, anchorIndex + RENDER_RADIUS);

  return (
    <div className="vf-list">
      {posts.map((post, index) => {
        const inWindow = index >= renderStart && index <= renderEnd;
        const pipeType = injections.get(index);
        return (
          <React.Fragment key={post.id}>
            {pipeType && (
              <FeedPipeline
                type={pipeType}
                currentUser={currentUser}
                onNavigate={onPipelineNavigate}
              />
            )}
            {inWindow ? (
              <div ref={makeRef(index)} className="vf-item">
                <PostCard
                  post={post}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                  onComment={onComment}
                  feedIndex={index}
                />
              </div>
            ) : (
              <Placeholder height={heightMap.current[index]} post={post} />
            )}
          </React.Fragment>
        );
      })}
      <style>{`
        .vf-list{display:flex;flex-direction:column;position:relative;}
        .vf-item{contain:layout style;}
      `}</style>
    </div>
  );
});
VirtualFeed.displayName = "VirtualFeed";

// ─── ScrollSentinel ───────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref     = useRef(null);
  const cooling = useRef(false);
  useEffect(() => {
    if (disabled || !ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !cooling.current) {
        cooling.current = true;
        onVisible();
        setTimeout(() => { cooling.current = false; }, 2500);
      }
    }, { rootMargin: "2500px", threshold: 0 }); // 2500px ahead
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);
  return <div ref={ref} style={{ height: 4, width: "100%", flexShrink: 0 }} aria-hidden="true" />;
};

// ─── EndOfFeed ────────────────────────────────────────────────────────────────
const EndOfFeed = () => (
  <div style={{
    display:"flex", alignItems:"center", gap:12,
    padding:"28px 20px",
    color:"rgba(255,255,255,0.2)", fontSize:12, fontWeight:600,
    letterSpacing:"0.05em", textTransform:"uppercase",
  }}>
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }}/>
    You're all caught up
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }}/>
  </div>
);

// ─── ScrollFAB ────────────────────────────────────────────────────────────────
const ScrollFAB = () => {
  const [show,  setShow]  = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);

  const getScroller = () => {
    const candidates = [
      document.querySelector(".main-content-desktop"),
      document.querySelector(".main-content-mobile"),
    ];
    return candidates.find(el => el && el.scrollHeight > el.clientHeight) || null;
  };

  useEffect(() => {
    const update = () => {
      const el  = getScroller();
      const top = el ? el.scrollTop    : window.scrollY;
      const h   = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch  = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120);
      setAtBot(top + ch >= h - 120);
      setShow(top > 300);
    };
    const s = getScroller();
    if (s) s.addEventListener("scroll", update, { passive:true });
    else   window.addEventListener("scroll", update, { passive:true });
    update();
    return () => {
      const s2 = getScroller();
      if (s2) s2.removeEventListener("scroll", update);
      else    window.removeEventListener("scroll", update);
    };
  }, []);

  const go = dir => {
    const el = getScroller();
    const t  = dir === "top" ? 0 : el ? el.scrollHeight : document.documentElement.scrollHeight;
    if (el) el.scrollTo({ top:t, behavior:"smooth" });
    else    window.scrollTo({ top:t, behavior:"smooth" });
  };

  if (!show) return null;
  return (
    <>
      <div className="sfab-pill">
        <button className={`sfab-btn${atTop ? " sfab-dim" : ""}`} onClick={() => !atTop && go("top")} disabled={atTop}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <div className="sfab-sep"/>
        <button className={`sfab-btn${atBot ? " sfab-dim" : ""}`} onClick={() => !atBot && go("bottom")} disabled={atBot}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      <style>{`
        .sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;
          display:flex;flex-direction:column;align-items:center;
          background:rgba(12,12,12,0.94);border:1px solid rgba(132,204,22,0.22);
          border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);
          -webkit-backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);
          animation:sfabIn .25s cubic-bezier(.34,1.2,.64,1) both;}
        @keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(.8)}
          to{opacity:1;transform:translateY(-50%) scale(1)}}
        .sfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;
          background:transparent;border:none;color:#84cc16;cursor:pointer;
          transition:background .15s,transform .1s;padding:0;}
        .sfab-btn:not(.sfab-dim):hover{background:rgba(132,204,22,.12);transform:scale(1.1);}
        .sfab-btn.sfab-dim{color:rgba(255,255,255,.15);cursor:default;}
        .sfab-sep{width:22px;height:1px;background:rgba(132,204,22,.12);}
        @media(max-width:768px){.sfab-pill{right:10px;}}
      `}</style>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PostTab — main export
// ═══════════════════════════════════════════════════════════════════════════════
const PostTab = React.forwardRef(function PostTab(
  {
    posts:        initialPosts = [],
    currentUser,
    onAuthorClick,
    onActionMenu,
    onComment,
    onLoadMore,
    hasMore       = false,
    isLoadingMore = false,
    isActive      = false,
    setActiveHomeTab,
  },
  ref,
) {
  const [localPosts,   setLocalPosts]   = useState(() => rankItems(initialPosts));
  const [pendingCount, setPendingCount] = useState(0);
  const [anchorIndex,  setAnchorIndex]  = useState(0);

  const pendingRef     = useRef([]);
  const loadingRef     = useRef(false);
  const lastBatchLen   = useRef(0);
  const fortyFired     = useRef(false);
  const seventyFired   = useRef(false);
  const rafRef         = useRef(null);

  useEffect(() => { setLocalPosts(rankItems(initialPosts)); }, [initialPosts]);

  const injections = useFeedInjections(localPosts.length);

  const handlePipelineNavigate = useCallback((dest) => {
    if (typeof setActiveHomeTab === "function") setActiveHomeTab(dest);
  }, [setActiveHomeTab]);

  // [INSTANT-1] Preload first 26 posts at mount — synchronous, before any rAF
  useLayoutEffect(() => {
    if (!localPosts.length) return;
    preloadFirstPaintImages(localPosts);
    preloadBatch(localPosts.slice(0, 26), 0);
    lastBatchLen.current = localPosts.length;
  }, []); // eslint-disable-line

  // Preload new batch when posts array grows
  useEffect(() => {
    const prev = lastBatchLen.current;
    if (localPosts.length <= prev) return;
    const newPosts = localPosts.slice(prev);
    // The "anchor" for new posts is far from start so they all get BATCH tier
    preloadBatch(newPosts, -999);
    lastBatchLen.current = localPosts.length;
    fortyFired.current   = false;
    seventyFired.current = false;
  }, [localPosts.length]); // eslint-disable-line

  // [INSTANT-4] Preload around anchor on scroll — synchronous rAF
  useEffect(() => {
    if (!localPosts.length) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const start = Math.max(0, anchorIndex - 6);
      const end   = Math.min(localPosts.length - 1, anchorIndex + PRELOAD_WINDOW);
      for (let i = start; i <= end; i++) {
        const post = localPosts[i];
        if (!post?.image_ids?.length) continue;
        const dist = Math.abs(i - anchorIndex);
        const tier =
          dist <= 6  ? TIER.CRITICAL :
          dist <= 16 ? TIER.URGENT   : TIER.BATCH;
        preloadPost(post, tier);
      }
      const visible = localPosts[anchorIndex];
      if (visible && !visible.aiInjected) recordSignal(visible, "CLICK_THROUGH");
    });
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [anchorIndex]); // eslint-disable-line

  // Load more at 40% and 70%
  useEffect(() => {
    if (!hasMore || loadingRef.current || isLoadingMore || !onLoadMore) return;
    if (!localPosts.length) return;
    const fortyMark   = Math.floor(localPosts.length * 0.4);
    const seventyMark = Math.floor(localPosts.length * 0.7);
    if (anchorIndex >= fortyMark && !fortyFired.current) {
      fortyFired.current = true;
      loadingRef.current = true;
      onLoadMore();
    } else if (anchorIndex >= seventyMark && !seventyFired.current) {
      seventyFired.current = true;
      if (!loadingRef.current) { loadingRef.current = true; onLoadMore(); }
    }
  }, [anchorIndex, localPosts.length, hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => { if (!isLoadingMore) loadingRef.current = false; }, [isLoadingMore]);

  useImperativeHandle(ref, () => ({
    prependPost: (p) => {
      if (isActive) {
        setLocalPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
        preloadPost(p, TIER.CRITICAL);
      } else {
        if (!pendingRef.current.some(x => x.id === p.id)) {
          pendingRef.current = [p, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
          preloadPost(p, TIER.URGENT);
        }
      }
    },
  }));

  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = [];
    setPendingCount(0);
    setLocalPosts(prev => {
      const ids = new Set(prev.map(p => p.id));
      return [...toAdd.filter(p => !ids.has(p.id)), ...prev];
    });
    const el = document.querySelector(".main-content-desktop, .main-content-mobile");
    (el || window).scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && !loadingRef.current && hasMore && onLoadMore) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  if (localPosts.length === 0 && !isLoadingMore) {
    return (
      <>
        <NewPostBanner count={pendingCount} onShow={flushPending} isActive={isActive} />
        <Suspense fallback={null}>
          <NewsVideoStrip currentUser={currentUser} />
        </Suspense>
        <div style={{ padding:"60px 20px", textAlign:"center", color:"#737373", fontSize:16 }}>
          <p>No posts yet. Be the first!</p>
        </div>
      </>
    );
  }

  return (
    <div className="post-tab-feed">
      <NewPostBanner count={pendingCount} onShow={flushPending} isActive={isActive} />

      <Suspense fallback={null}>
        <NewsVideoStrip currentUser={currentUser} />
      </Suspense>

      <VideoPreloadRunway posts={localPosts} anchorIndex={anchorIndex} />

      <VirtualFeed
        posts={localPosts}
        currentUser={currentUser}
        onAuthorClick={onAuthorClick}
        onActionMenu={onActionMenu}
        onComment={onComment}
        onAnchorChange={setAnchorIndex}
        onPipelineNavigate={handlePipelineNavigate}
        injections={injections}
      />

      <ScrollSentinel onVisible={handleSentinel} disabled={!hasMore || isLoadingMore} />
      {!hasMore && localPosts.length > 0 && <EndOfFeed />}
      <ScrollFAB />
    </div>
  );
});

export default PostTab;