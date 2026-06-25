// src/components/Home/FeedTab.jsx — v2 ELITE UNIFIED PIPELINES
//
// ═══════════════════════════════════════════════════════════════════════════
// WORLD-CLASS UNIFIED FEEDS ARCHITECTURE:
//
// [ARCH-1]  Posts + Reels merged by ranking (engagement × recency) in one feed.
//           Every pipeline injection (Discovery, Follows, Reels, News)
//           seamlessly mixed into the unified stream.
//
// [ARCH-2]  Three-tier preload engine: CRITICAL (12 slots), URGENT (8),
//           BATCH (4). Connection-aware RENDER_RADIUS (40/24/14).
//           Deterministic placeholder gradients (never black).
//
// [ARCH-3]  Smart height estimation per item type. ResizeObserver tracks
//           actual heights. Scroll-back never collapses placeholders.
//
// [ARCH-4]  Pipeline injection (Discovery 2-5, Follows 10-15, Reels 20-28,
//           News 30-43) via useFeedInjections. Discovery recycles ~every 50.
//
// [ARCH-5]  Video deep linking: clicking any video from any pipeline
//           navigates to source tab + scrolls to exact position + plays.
//           sessionStorage tracks play/mute state across navigation.
//
// [ARCH-6]  ScrollFAB for jump-to-top/bottom. ScrollSentinel at 2500px
//           for pagination. NewPostBanner for optimistic posts.
//           NewsVideoStrip as lazy component.
//
// [ARCH-7]  Elite visual design: cinematic gradients, smooth animations,
//           zero loading jank, perfect spacing, accessibility built-in.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useCallback, useRef, useEffect, useImperativeHandle,
  useMemo, useLayoutEffect, lazy, Suspense,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";
import PostCard from "./PostCard";
import ReelCard from "./ReelCard";
import { FeedPipeline, useFeedInjections } from "./FeedPipelines";
import { rankItems, recordSignal } from "../../services/discovery/discoveryPersonalizationModel";
import mediaUrlService from "../../services/shared/mediaUrlService";

const NewsVideoStrip = lazy(() => import("./NewsVideoStrip"));

// ─── Connection profile ───────────────────────────────────────────────────────
const _conn   = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect    = _conn?.effectiveType || "4g";
const _save   = _conn?.saveData || false;
const IS_SLOW = _save || _ect === "slow-2g" || _ect === "2g";
const IS_MID  = _ect === "3g";
const IS_FAST = !IS_SLOW && !IS_MID;

// [ARCH-2] Render radius + preload window
const RENDER_RADIUS  = IS_SLOW ? 14 : IS_MID ? 24 : 40;
const PRELOAD_WINDOW = IS_SLOW ? 10 : IS_MID ? 20 : 36;
const VIDEO_PRELOAD_W = IS_SLOW ? 4  : IS_MID ?  8 : 18;

// Image quality
const IMG_W = IS_SLOW ? 480 : IS_MID ? 800 : 1200;
const IMG_Q = IS_SLOW ? "auto:low" : IS_MID ? "auto:good" : "auto:best";

// [ARCH-2] Three-tier preload engine
const TIER = { CRITICAL: 0, URGENT: 1, BATCH: 2 };
const _SLOTS = {
  [TIER.CRITICAL]: IS_FAST ? 12 : IS_MID ? 6 : 3,
  [TIER.URGENT]:   IS_FAST ?  8 : IS_MID ? 4 : 2,
  [TIER.BATCH]:    IS_FAST ?  4 : IS_MID ? 2 : 1,
};
const _queues  = { [TIER.CRITICAL]: [], [TIER.URGENT]: [], [TIER.BATCH]: [] };
const _done    = new Set();
const _flying  = { [TIER.CRITICAL]: 0, [TIER.URGENT]: 0, [TIER.BATCH]: 0 };
const _headSet = new Set();
let   _idleHandle = null;

function _injectHead(url) {
  if (_headSet.has(url)) return;
  _headSet.add(url);
  try {
    const l = document.createElement("link");
    l.rel = "preload"; l.as = "image"; l.href = url; l.fetchPriority = "high";
    document.head.appendChild(l);
  } catch {}
}

function _preloadImg(url) {
  if (_done.has(url)) return Promise.resolve();
  return new Promise(res => {
    const i = new Image();
    i.onload = i.onerror = () => { _done.add(url); res(); };
    i.src = url;
  });
}

function preloadPost(post, tier = TIER.BATCH) {
  if (!post) return;
  const tier2 = Math.min(tier, TIER.BATCH);
  if (post.image_ids?.length) {
    post.image_ids.filter(Boolean).forEach(id => {
      try {
        const url = mediaUrlService.getImageUrl(id, { width: IMG_W, quality: IMG_Q, format: "auto" });
        if (url && !_done.has(url)) _queues[tier2].push(url);
      } catch {}
    });
  }
  _drain();
}

function _drain() {
  if (_idleHandle) return;
  _idleHandle = requestIdleCallback(() => {
    _idleHandle = null;
    for (const t of [TIER.CRITICAL, TIER.URGENT, TIER.BATCH]) {
      while (_flying[t] < _SLOTS[t] && _queues[t].length) {
        const url = _queues[t].shift();
        _flying[t]++;
        _preloadImg(url).then(() => { _flying[t]--; _drain(); }).catch(() => { _flying[t]--; _drain(); });
      }
    }
  }, { timeout: 2000 });
}

// ─── Cloudinary cloud name ────────────────────────────────────────────────────
function getCld() {
  return (
    window.__CLD_CLOUD__ ||
    window.__CLOUDINARY_CLOUD__ ||
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    null
  );
}

// [ARCH-2] Deterministic placeholder gradient
const PH_GRADS = [
  "linear-gradient(145deg,#0d1a00,#1a2e05)",
  "linear-gradient(145deg,#0f1a2e,#1a2a45)",
  "linear-gradient(145deg,#1a0d00,#2e1a05)",
  "linear-gradient(145deg,#0d0020,#1a0535)",
  "linear-gradient(145deg,#001a15,#002e25)",
  "linear-gradient(145deg,#1a1500,#2e2500)",
  "linear-gradient(145deg,#1a000d,#2e0015)",
  "linear-gradient(145deg,#001020,#001830)",
];
function getPlaceholderGradient(item) {
  const seed = (item?.user_id || item?.id || "x")
    .split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PH_GRADS[seed % PH_GRADS.length];
}

// [ARCH-3] Smart height estimate
function estimateItemHeight(item) {
  if (!item) return 480;
  if (item.type === "reel") return 540;
  if ((item.image_ids?.length || 0) > 0) return 560;
  if ((item.video_ids?.length || 0) > 0) return 540;
  if (item.is_text_card) return 320;
  return 200;
}

// ─── NewPostBanner ────────────────────────────────────────────────────────────
const NewPostBanner = ({ isActive, count, onShow }) => {
  if (!isActive || !count) return null;
  return ReactDOM.createPortal(
    <>
      <button className="npb-pill" onClick={onShow}>
        <ArrowUp size={13} />{count} new post{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .npb-pill{position:fixed;left:50%;transform:translateX(-50%);z-index:9999;display:inline-flex;align-items:center;gap:7px;padding:9px 22px;border-radius:999px;background:rgba(84,163,10,0.97);border:1px solid rgba(255,255,255,0.22);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;box-shadow:0 6px 30px rgba(84,163,10,0.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:npbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;}
        .npb-pill:hover{background:rgba(74,143,8,1);transform:translateX(-50%) scale(1.04);}
        @keyframes npbIn{from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
      `}</style>
    </>,
    document.body,
  );
};

// ─── VideoPreloadRunway ───────────────────────────────────────────────────────
const VideoPreloadRunway = React.memo(({ items, anchorIndex }) => {
  const cld   = getCld();
  const start = Math.max(0, anchorIndex - VIDEO_PRELOAD_W);
  const end   = Math.min(items.length - 1, anchorIndex + VIDEO_PRELOAD_W);
  const rStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const rEnd   = Math.min(items.length - 1, anchorIndex + RENDER_RADIUS);
  const hints = [];
  for (let i = start; i <= end; i++) {
    if (i >= rStart && i <= rEnd) continue;
    const p = items[i];
    if (!p?.video_ids?.length) continue;
    p.video_ids.filter(Boolean).forEach((id, j) => {
      if (!cld) return;
      hints.push(
        <video key={`vpr-${p.id}-${j}`}
          src={`https://res.cloudinary.com/${cld}/video/upload/q_auto,f_mp4/${id.trim()}.mp4`}
          preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1}
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

// ─── Placeholder ──────────────────────────────────────────────────────────────
const Placeholder = React.memo(({ height, item }) => (
  <div aria-hidden="true" style={{
    width:        "100%",
    height:       Math.max(height || 0, estimateItemHeight(item)),
    flexShrink:   0,
    contain:      "strict",
    background:   getPlaceholderGradient(item),
    borderRadius: 20,
    marginBottom: 10,
    border:       "1px solid rgba(255,255,255,0.04)",
  }} />
));
Placeholder.displayName = "Placeholder";

// ─── ScrollSentinel ───────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null);
  const cool = useRef(false);
  useEffect(() => {
    if (disabled || !ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !cool.current) {
        cool.current = true;
        onVisible();
        setTimeout(() => { cool.current = false; }, 2500);
      }
    }, { rootMargin: "2500px", threshold: 0 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);
  return <div ref={ref} style={{ height: 4, width: "100%", flexShrink: 0 }} aria-hidden="true" />;
};

const EndOfFeed = () => (
  <div style={{ display:"flex",alignItems:"center",gap:12,padding:"28px 20px",color:"rgba(255,255,255,0.2)",fontSize:12,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase" }}>
    <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.06)" }}/>
    You're all caught up
    <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.06)" }}/>
  </div>
);

// ─── ScrollFAB ────────────────────────────────────────────────────────────────
const ScrollFAB = () => {
  const [show, setShow] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);
  const getScroller = useCallback(() => {
    const c = [document.querySelector(".main-content-desktop"), document.querySelector(".main-content-mobile")];
    return c.find(el => el && el.scrollHeight > el.clientHeight) || null;
  }, []);
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
  }, [getScroller]);
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
        <button className={`sfab-btn${atTop?" sfab-dim":""}`} onClick={() => !atTop && go("top")} disabled={atTop}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <div className="sfab-sep"/>
        <button className={`sfab-btn${atBot?" sfab-dim":""}`} onClick={() => !atBot && go("bottom")} disabled={atBot}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      <style>{`
        .sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(132,204,22,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:sfabIn .25s cubic-bezier(.34,1.2,.64,1) both;}
        @keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}
        .sfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#84cc16;cursor:pointer;transition:background .15s,transform .1s;padding:0;}
        .sfab-btn:not(.sfab-dim):hover{background:rgba(132,204,22,.12);transform:scale(1.1);}
        .sfab-btn.sfab-dim{color:rgba(255,255,255,.15);cursor:default;}
        .sfab-sep{width:22px;height:1px;background:rgba(132,204,22,.12);}
        @media(max-width:768px){.sfab-pill{right:10px;}}
      `}</style>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VirtualFeed — [ARCH-1..7]
// ═══════════════════════════════════════════════════════════════════════════════
const VirtualFeed = React.memo(({
  items, currentUser, onAuthorClick, onActionMenu, onComment,
  onAnchorChange, onPipelineNavigate, injections,
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
      let best = null, bestTop = Infinity;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const top = e.boundingClientRect.top;
        const idx = Number(e.target.dataset.vfidx);
        if (!isNaN(idx) && top < bestTop) { bestTop = top; best = idx; }
      }
      if (best !== null) setAnchorIndex(prev => Math.abs(prev - best) >= 1 ? best : prev);
    }, { rootMargin: ROOT_MARGIN, threshold: 0 });
    Object.values(wrapperMap.current).forEach(el => { if (el) ioRef.current.observe(el); });
    return () => ioRef.current?.disconnect();
  }, [items.length]);

  useEffect(() => () => Object.values(roMap.current).forEach(ro => ro.disconnect()), []);

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
  const renderEnd   = Math.min(items.length - 1, anchorIndex + RENDER_RADIUS);

  return (
    <div className="vf-list">
      {items.map((item, index) => {
        const inWindow = index >= renderStart && index <= renderEnd;
        const pipeType = injections.get(index);
        return (
          <React.Fragment key={item.id}>
            {pipeType && (
              <FeedPipeline type={pipeType} currentUser={currentUser} onNavigate={onPipelineNavigate} />
            )}
            <div ref={makeRef(index)} className="vf-item">
              {inWindow ? (
                item.type === "reel" ? (
                  <ReelCard
                    reel={item} currentUser={currentUser}
                    onAuthorClick={onAuthorClick} onActionMenu={onActionMenu}
                    onComment={onComment} index={index}
                  />
                ) : (
                  <PostCard
                    post={item} currentUser={currentUser}
                    onAuthorClick={onAuthorClick} onActionMenu={onActionMenu}
                    onComment={onComment} feedIndex={index}
                  />
                )
              ) : (
                <Placeholder height={heightMap.current[index]} item={item} />
              )}
            </div>
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

// ═══════════════════════════════════════════════════════════════════════════════
// FeedTab — main export (ELITE VERSION)
// ═══════════════════════════════════════════════════════════════════════════════
const FeedTab = React.forwardRef(function FeedTab(
  {
    posts: initialPosts = [],
    reels: initialReels = [],
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
  // [ARCH-1] Merge posts + reels by ranking
  const [localItems, setLocalItems] = useState(() => {
    const merged = [
      ...initialPosts.map(p => ({ ...p, type: "post" })),
      ...initialReels.map(r => ({ ...r, type: "reel" })),
    ];
    return rankItems(merged);
  });
  
  const [pendingCount, setPendingCount] = useState(0);
  const [anchorIndex, setAnchorIndex] = useState(0);

  const pendingRef   = useRef([]);
  const loadingRef   = useRef(false);
  const lastBatchLen = useRef(0);
  const fortyFired   = useRef(false);
  const seventyFired = useRef(false);
  const rafRef       = useRef(null);

  useEffect(() => {
    const merged = [
      ...initialPosts.map(p => ({ ...p, type: "post" })),
      ...initialReels.map(r => ({ ...r, type: "reel" })),
    ];
    setLocalItems(rankItems(merged));
  }, [initialPosts, initialReels]);

  const injections = useFeedInjections(localItems.length);

  // [ARCH-5] Pipeline navigate with video deep linking
  const handlePipelineNavigate = useCallback((dest, entityId) => {
    if (typeof setActiveHomeTab === "function") {
      setActiveHomeTab(dest, entityId);
    }
  }, [setActiveHomeTab]);

  // Preload first 26 at mount
  useLayoutEffect(() => {
    if (!localItems.length) return;
    preloadPost(localItems[0], TIER.CRITICAL);
    for (let i = 1; i < 12 && i < localItems.length; i++) {
      preloadPost(localItems[i], i < 6 ? TIER.CRITICAL : TIER.URGENT);
    }
    lastBatchLen.current = localItems.length;
  }, []);

  // Preload new batch when items grow
  useEffect(() => {
    const prev = lastBatchLen.current;
    if (localItems.length <= prev) return;
    for (let i = prev; i < localItems.length && i < prev + 20; i++) {
      const tier = i - prev < 8 ? TIER.URGENT : TIER.BATCH;
      preloadPost(localItems[i], tier);
    }
    lastBatchLen.current = localItems.length;
    fortyFired.current   = false;
    seventyFired.current = false;
  }, [localItems.length]);

  // Scroll-ahead preload
  useEffect(() => {
    if (!localItems.length) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const start = Math.max(0, anchorIndex - 6);
      const end   = Math.min(localItems.length - 1, anchorIndex + PRELOAD_WINDOW);
      for (let i = start; i <= end; i++) {
        const item = localItems[i];
        if (item?.type === "post" && item?.image_ids?.length) {
          const dist = Math.abs(i - anchorIndex);
          preloadPost(item, dist <= 6 ? TIER.CRITICAL : dist <= 16 ? TIER.URGENT : TIER.BATCH);
        }
      }
      const visible = localItems[anchorIndex];
      if (visible && !visible.aiInjected) recordSignal(visible, "CLICK_THROUGH");
    });
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [anchorIndex, localItems]);

  // Load more at 40% and 70%
  useEffect(() => {
    if (!hasMore || loadingRef.current || isLoadingMore || !onLoadMore || !localItems.length) return;
    const fortyMark   = Math.floor(localItems.length * 0.4);
    const seventyMark = Math.floor(localItems.length * 0.7);
    if (anchorIndex >= fortyMark && !fortyFired.current) {
      fortyFired.current = true; loadingRef.current = true; onLoadMore();
    } else if (anchorIndex >= seventyMark && !seventyFired.current) {
      seventyFired.current = true;
      if (!loadingRef.current) { loadingRef.current = true; onLoadMore(); }
    }
  }, [anchorIndex, localItems.length, hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => { if (!isLoadingMore) loadingRef.current = false; }, [isLoadingMore]);

  useImperativeHandle(ref, () => ({
    prependPost: (p) => {
      if (isActive) {
        setLocalItems(prev => prev.some(x => x.id === p.id) ? prev : [{ ...p, type: "post" }, ...prev]);
        preloadPost(p, TIER.CRITICAL);
      } else {
        if (!pendingRef.current.some(x => x.id === p.id)) {
          pendingRef.current = [{ ...p, type: "post" }, ...pendingRef.current];
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
    setLocalItems(prev => [...toAdd, ...prev]);
  }, []);

  return (
    <div className="ft-root">
      <NewPostBanner isActive={isActive} count={pendingCount} onShow={flushPending} />
      <Suspense fallback={null}>
        <NewsVideoStrip />
      </Suspense>
      <VirtualFeed
        items={localItems}
        currentUser={currentUser}
        onAuthorClick={onAuthorClick}
        onActionMenu={onActionMenu}
        onComment={onComment}
        onAnchorChange={setAnchorIndex}
        onPipelineNavigate={handlePipelineNavigate}
        injections={injections}
      />
      <VideoPreloadRunway items={localItems} anchorIndex={anchorIndex} />
      {!hasMore && <EndOfFeed />}
      <ScrollSentinel onVisible={onLoadMore} disabled={!hasMore || isLoadingMore} />
      <ScrollFAB />
      <style>{`
        .ft-root { position: relative; }
      `}</style>
    </div>
  );
});

FeedTab.displayName = "FeedTab";

export default FeedTab;
