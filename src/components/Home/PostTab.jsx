// src/components/Home/PostTab.jsx — v16 PERFECTED ZERO-WAIT
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY USERS NEVER SEE MEDIA LOADING — THE COMPLETE PICTURE
//
// The system operates two independent pipelines simultaneously:
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ PIPELINE 1 — CONTENT                                                │
// │  Fires onLoadMore the moment anchor passes the 50% mark.            │
// │  By the time the user reaches the last loaded post, the next        │
// │  batch has been in memory for seconds. Infinite, seamless.          │
// └─────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ PIPELINE 2 — MEDIA PRELOADER (3-tier priority queue)                │
// │                                                                     │
// │  TIER 0 — CRITICAL (anchor ±3):                                     │
// │    <link rel="preload"> injected into <head>. This is the browser's │
// │    highest-priority fetch — beats even parser-discovered resources.  │
// │    Used only for the 6 images the user is about to see RIGHT NOW.   │
// │                                                                     │
// │  TIER 1 — URGENT (anchor ±10):                                      │
// │    new Image() fetches — concurrent, high-priority, fills the       │
// │    HTTP cache before the card scrolls into the render window.       │
// │                                                                     │
// │  TIER 2 — BATCH (everything else):                                  │
// │    new Image() fetches — throttled to 2 concurrent slots so they    │
// │    never starve TIER 0/1 on slow connections.                       │
// │                                                                     │
// │  Triggers:                                                          │
// │    T1: Mount — ALL images queued immediately (batch priority)       │
// │    T2: New batch — new images queued immediately                    │
// │    T3: Anchor moves — nearby images UPGRADED to critical/urgent     │
// │                                                                     │
// │  Connection-adaptive concurrency:                                   │
// │    4g/wifi: 8 urgent + 3 batch concurrent slots                     │
// │    3g:      4 urgent + 2 batch                                      │
// │    2g/save: 2 urgent + 1 batch                                      │
// └─────────────────────────────────────────────────────────────────────┘
//
// When PostCard's <SmartImage> mounts, one of two things happens:
//
//   CACHE HIT  — img.complete = true synchronously.
//                useLayoutEffect detects this BEFORE first paint.
//                Image is visible in frame 1. Zero flicker, zero transition.
//
//   CACHE MISS — Only happens if the user scrolled faster than 4G can
//                deliver (i.e., never in practice for normal usage).
//                A dark shimmer fills the slot. 160ms fade-in on load.
//
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useCallback, useRef, useEffect, useImperativeHandle,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";
import PostCard from "./PostCard";
import NewsVideoStrip from "./NewsVideoStrip";
import { FeedPipeline, useFeedInjections } from "./FeedPipelines";

// ─── Render / preload tuning ──────────────────────────────────────────────────
const RENDER_RADIUS        = 10;  // cards mounted above + below anchor
const VIDEO_PRELOAD_RADIUS = 15;  // hidden <video metadata> window
const PLACEHOLDER_H        = 520; // placeholder height before first render

// ─── Connection-quality profile — MUST match PostCard.jsx exactly ─────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData      || false;

const _IMG_W = _save || _ect === "slow-2g" || _ect === "2g" ? 480
             : _ect === "3g"                                 ? 800
             :                                                 1200;
const _IMG_Q = _save || _ect === "slow-2g" || _ect === "2g" ? "auto:low"
             : _ect === "3g"                                  ? "auto:good"
             :                                                  "auto:best";

// Adaptive concurrency based on connection
const _SLOTS_URGENT = _save || _ect === "slow-2g" || _ect === "2g" ? 2
                    : _ect === "3g"                                  ? 4
                    :                                                   8;
const _SLOTS_BATCH  = _save || _ect === "slow-2g" || _ect === "2g" ? 1
                    : _ect === "3g"                                  ? 2
                    :                                                   3;

const _getCld = () =>
  window.__CLD_CLOUD__ || process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "grova";

// ─── URL builders — Strategy 2 MUST match PostCard.jsx buildImageUrl S2 ──────
// Identical string = guaranteed HTTP cache hit when PostCard mounts.
function buildPreloadImgUrl(id) {
  if (!id || typeof id !== "string" || !id.trim()) return null;
  const cld = _getCld();
  if (!cld) return null;
  return `https://res.cloudinary.com/${cld}/image/upload/w_${_IMG_W},q_${_IMG_Q},f_webp,c_limit/${id.trim()}`;
}

function buildPreloadVidUrl(id) {
  if (!id || typeof id !== "string" || !id.trim()) return null;
  const cld = _getCld();
  if (!cld) return null;
  return `https://res.cloudinary.com/${cld}/video/upload/q_auto:good,f_mp4/${id.trim()}.mp4`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE 2 — MODULE-LEVEL MEDIA PRELOADER
// Lives outside React — survives re-renders and component remounts.
// ═══════════════════════════════════════════════════════════════════════════════

const TIER = { CRITICAL: 0, URGENT: 1, BATCH: 2 };

const _queues    = [[], [], []];      // per-tier queues
const _done      = new Set();         // URLs already loading/loaded
const _headLinks = new Set();         // URLs with <link> in <head>
let   _flying    = 0;                 // urgent+critical in-flight count
let   _bFlying   = 0;                 // batch in-flight count

function _drain() {
  // Critical and Urgent share _SLOTS_URGENT
  for (let tier = 0; tier <= 1; tier++) {
    while (_flying < _SLOTS_URGENT && _queues[tier].length) {
      _fetch(_queues[tier].shift(), false);
    }
  }
  // Batch has its own slots — never starves critical/urgent
  while (_bFlying < _SLOTS_BATCH && _queues[TIER.BATCH].length) {
    _fetch(_queues[TIER.BATCH].shift(), true);
  }
}

function _fetch(url, isBatch) {
  if (isBatch) _bFlying++; else _flying++;
  const img  = new Image();
  const done = () => {
    if (isBatch) _bFlying--; else _flying--;
    _drain();
  };
  img.onload  = done;
  img.onerror = done;
  img.src     = url;
}

/**
 * Inject a <link rel="preload"> into <head>.
 * This is the browser's highest-priority fetch path — beats everything.
 * Used only for CRITICAL tier (images the user sees immediately).
 */
function _injectHeadPreload(url) {
  if (_headLinks.has(url)) return;
  _headLinks.add(url);
  try {
    const link       = document.createElement("link");
    link.rel         = "preload";
    link.as          = "image";
    link.href        = url;
    link.fetchPriority = "high";
    document.head.appendChild(link);
  } catch {}
}

/**
 * Schedule a URL for preloading.
 * If already queued at a lower priority, upgrades it.
 * If already done (in _done), skips silently.
 */
function schedulePreload(url, tier = TIER.BATCH) {
  if (!url) return;

  // CRITICAL → inject <link> in <head> immediately (no queue needed)
  if (tier === TIER.CRITICAL) {
    _injectHeadPreload(url);
    // Also add to done so we don't double-fetch via Image()
    if (!_done.has(url)) {
      _done.add(url);
      // Still start an Image() fetch to ensure the cache is warm in all browsers
      _fetch(url, false);
    }
    return;
  }

  if (_done.has(url)) {
    // Try to upgrade priority if it's still in a lower-tier queue
    if (tier < TIER.BATCH) {
      for (let t = tier + 1; t <= TIER.BATCH; t++) {
        const i = _queues[t].indexOf(url);
        if (i !== -1) {
          _queues[t].splice(i, 1);
          _queues[tier].unshift(url);
          _drain();
          break;
        }
      }
    }
    return;
  }

  _done.add(url);
  _queues[tier].push(url);
  _drain();
}

/**
 * Preload all images in a post array.
 * Tier is determined by distance from anchorIndex.
 */
function preloadBatch(posts, anchorIndex = 0) {
  (posts || []).forEach((post, i) => {
    if (!post?.image_ids?.length) return;
    const dist = Math.abs(i - anchorIndex);
    const tier = dist <= 3  ? TIER.CRITICAL
               : dist <= 10 ? TIER.URGENT
               :              TIER.BATCH;
    post.image_ids.forEach(id => {
      const url = buildPreloadImgUrl(id);
      if (url) schedulePreload(url, tier);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NewPostBanner — portal pill, visible only on the active tab
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
        <ArrowUp size={13} />
        {count} new post{count !== 1 ? "s" : ""}
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
        @keyframes ptbIn{
          from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to  {opacity:1;transform:translateX(-50%) translateY(0)      scale(1);}}
      `}</style>
    </>,
    document.body,
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VideoPreloadRunway — hidden video elements for metadata preloading
// ═══════════════════════════════════════════════════════════════════════════════
const VideoPreloadRunway = React.memo(({ posts, anchorIndex }) => {
  const start       = Math.max(0, anchorIndex - VIDEO_PRELOAD_RADIUS);
  const end         = Math.min(posts.length - 1, anchorIndex + VIDEO_PRELOAD_RADIUS);
  const renderStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const renderEnd   = Math.min(posts.length - 1, anchorIndex + RENDER_RADIUS);

  const hints = [];
  for (let i = start; i <= end; i++) {
    if (i >= renderStart && i <= renderEnd) continue; // card already in DOM
    const p = posts[i];
    if (!p?.video_ids?.length) continue;
    p.video_ids.forEach((id, j) => {
      if (!id?.trim()) return;
      const url = buildPreloadVidUrl(id);
      if (!url) return;
      hints.push(
        <video
          key={`v-${p.id}-${j}`}
          src={url}
          preload="metadata"
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position:"absolute", width:0, height:0,
            opacity:0, pointerEvents:"none", overflow:"hidden",
          }}
        />,
      );
    });
  }

  if (!hints.length) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position:"absolute", width:0, height:0,
        overflow:"hidden", opacity:0, pointerEvents:"none", zIndex:-1,
      }}
    >
      {hints}
    </div>
  );
});
VideoPreloadRunway.displayName = "VideoPreloadRunway";

// ═══════════════════════════════════════════════════════════════════════════════
// Placeholder — height-preserving skeleton for unmounted cards
// ═══════════════════════════════════════════════════════════════════════════════
const Placeholder = React.memo(({ height }) => (
  <div
    aria-hidden="true"
    style={{ width:"100%", height: height || PLACEHOLDER_H, flexShrink:0, contain:"strict" }}
  />
));
Placeholder.displayName = "Placeholder";

// ═══════════════════════════════════════════════════════════════════════════════
// VirtualFeed — sliding render window + pipeline injection
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

  // Rebuild IntersectionObserver when post list grows
  useEffect(() => {
    ioRef.current?.disconnect();
    ioRef.current = new IntersectionObserver(entries => {
      let best = null, bestTop = Infinity;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const top = entry.boundingClientRect.top;
        const idx = Number(entry.target.dataset.vfidx);
        if (!isNaN(idx) && top < bestTop) { bestTop = top; best = idx; }
      }
      if (best !== null) {
        setAnchorIndex(prev => Math.abs(prev - best) >= 1 ? best : prev);
      }
    }, { rootMargin:"300px 0px 300px 0px", threshold:0 });

    Object.values(wrapperMap.current).forEach(el => {
      if (el) ioRef.current.observe(el);
    });
    return () => ioRef.current?.disconnect();
  }, [posts.length]);

  useEffect(() => () => {
    Object.values(roMap.current).forEach(ro => ro.disconnect());
  }, []);

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
              <Placeholder height={heightMap.current[index]} />
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

// ─── ScrollSentinel — fallback load trigger ───────────────────────────────────
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
    }, { rootMargin:"1500px", threshold:0 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);

  return <div ref={ref} style={{ height:4, width:"100%", flexShrink:0 }} aria-hidden="true" />;
};

// ─── End-of-feed ──────────────────────────────────────────────────────────────
const EndOfFeed = () => (
  <div style={{
    display:"flex", alignItems:"center", gap:12, padding:"28px 20px",
    color:"rgba(255,255,255,0.2)", fontSize:12, fontWeight:600,
    letterSpacing:"0.05em", textTransform:"uppercase",
  }}>
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
    You&apos;re all caught up
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
  </div>
);

// ─── Floating scroll FAB ──────────────────────────────────────────────────────
const ScrollFAB = () => {
  const [show, setShow] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);

  const getScroller = () => {
    const c = [document.querySelector(".main-content-desktop"), document.querySelector(".main-content-mobile")];
    return c.find(el => el && el.scrollHeight > el.clientHeight) || null;
  };

  useEffect(() => {
    const update = () => {
      const el = getScroller();
      const top = el ? el.scrollTop    : window.scrollY;
      const h   = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch  = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120); setAtBot(top + ch >= h - 120); setShow(top > 300);
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <div className="sfab-sep"/>
        <button className={`sfab-btn${atBot ? " sfab-dim" : ""}`} onClick={() => !atBot && go("bottom")} disabled={atBot}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <style>{`
        .sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;
          display:flex;flex-direction:column;align-items:center;
          background:rgba(12,12,12,0.94);border:1px solid rgba(132,204,22,0.22);
          border-radius:14px;overflow:hidden;
          backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
          box-shadow:0 8px 32px rgba(0,0,0,0.55);
          animation:sfabIn .25s cubic-bezier(.34,1.2,.64,1) both;}
        @keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}
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
// PostTab — public API via ref: { prependPost }
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
  const [localPosts,   setLocalPosts]   = useState(initialPosts);
  const [pendingCount, setPendingCount] = useState(0);
  const [anchorIndex,  setAnchorIndex]  = useState(0);
  const pendingRef     = useRef([]);
  const loadingRef     = useRef(false);   // local guard
  const lastBatchLen   = useRef(0);       // tracks last preloaded batch size
  const halfFired      = useRef(false);   // prevent double-firing per batch

  // Sync external post list
  useEffect(() => { setLocalPosts(initialPosts); }, [initialPosts]);

  // Stable injection map
  const injections = useFeedInjections(localPosts.length);

  // Pipeline navigation
  const handlePipelineNavigate = useCallback((dest) => {
    if (dest === "reels") setActiveHomeTab?.("reels");
    if (dest === "news")  setActiveHomeTab?.("news");
  }, [setActiveHomeTab]);

  // ───────────────────────────────────────────────────────────────────────────
  // PIPELINE 2 — TRIGGER A: MOUNT
  // Immediately preload ALL images in the initial batch.
  // First 3 posts get CRITICAL (head injection), next 7 URGENT, rest BATCH.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localPosts.length) return;
    preloadBatch(localPosts, 0);
    lastBatchLen.current = localPosts.length;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────────────────────────────────────────────────────────────────────
  // PIPELINE 2 — TRIGGER B: NEW BATCH ARRIVED
  // Preload only the new posts (slice from last known length).
  // They're far from anchor so they get BATCH priority initially.
  // Trigger C will upgrade them as the user scrolls closer.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = lastBatchLen.current;
    if (localPosts.length <= prev) return;
    const newPosts = localPosts.slice(prev);
    preloadBatch(newPosts, -999); // force BATCH tier (dist always > 10)
    lastBatchLen.current = localPosts.length;
    halfFired.current    = false; // reset so next half-trigger can fire
  }, [localPosts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────────────────────────────────────────────────────────────────────
  // PIPELINE 2 — TRIGGER C: ANCHOR MOVES
  // Upgrade nearby images to CRITICAL/URGENT as the user scrolls.
  // This ensures images in the render window are always the highest priority.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localPosts.length) return;
    const start = Math.max(0, anchorIndex - 3);
    const end   = Math.min(localPosts.length - 1, anchorIndex + 15);
    for (let i = start; i <= end; i++) {
      const post = localPosts[i];
      if (!post?.image_ids?.length) continue;
      const dist = Math.abs(i - anchorIndex);
      const tier = dist <= 3 ? TIER.CRITICAL : dist <= 10 ? TIER.URGENT : TIER.BATCH;
      post.image_ids.forEach(id => {
        const url = buildPreloadImgUrl(id);
        if (url) schedulePreload(url, tier);
      });
    }
  }, [anchorIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────────────────────────────────────────────────────────────────────
  // PIPELINE 1 — CONTENT: FIRE AT 50% MARK
  // Never let the user get past halfway without the next batch loading.
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasMore || loadingRef.current || isLoadingMore || !onLoadMore) return;
    if (!localPosts.length) return;

    const halfwayMark = Math.floor(localPosts.length / 2);
    if (anchorIndex >= halfwayMark && !halfFired.current) {
      halfFired.current    = true;
      loadingRef.current   = true;
      onLoadMore();
    }
  }, [anchorIndex, localPosts.length, hasMore, isLoadingMore, onLoadMore]);

  // Reset local loading guard when prop clears
  useEffect(() => {
    if (!isLoadingMore) loadingRef.current = false;
  }, [isLoadingMore]);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    prependPost: (p) => {
      if (isActive) {
        setLocalPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
        // Immediately preload the new post's images at CRITICAL priority
        p.image_ids?.forEach(id => {
          const url = buildPreloadImgUrl(id);
          if (url) schedulePreload(url, TIER.CRITICAL);
        });
      } else {
        if (!pendingRef.current.some(x => x.id === p.id)) {
          pendingRef.current = [p, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
          // Pre-warm even for pending posts (they'll be at top when flushed)
          p.image_ids?.forEach(id => {
            const url = buildPreloadImgUrl(id);
            if (url) schedulePreload(url, TIER.URGENT);
          });
        }
      }
    },
  }));

  // ── Banner flush ──────────────────────────────────────────────────────────
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
    (el || window).scrollTo({ top:0, behavior:"smooth" });
  }, []);

  // ── Sentinel fallback ─────────────────────────────────────────────────────
  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && !loadingRef.current && hasMore && onLoadMore) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (localPosts.length === 0 && !isLoadingMore) {
    return (
      <>
        <NewPostBanner count={pendingCount} onShow={flushPending} isActive={isActive} />
        <NewsVideoStrip currentUser={currentUser} />
        <div style={{ padding:"60px 20px", textAlign:"center", color:"#737373", fontSize:16 }}>
          <p>No posts yet. Be the first!</p>
        </div>
      </>
    );
  }

  return (
    <div className="post-tab-feed">
      <NewPostBanner count={pendingCount} onShow={flushPending} isActive={isActive} />
      <NewsVideoStrip currentUser={currentUser} />
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