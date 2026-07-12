// src/components/Home/PostTab.jsx — v21 PERFECT
//
// ═══════════════════════════════════════════════════════════════════════════
// FIXES vs v20:
//
// [NAV-FIX]  handlePipelineNavigate now passes BOTH (dest, entityId) to
//            setActiveHomeTab. In v20 entityId was silently dropped, so
//            clicking a reel thumbnail in the Trending Reels pipeline
//            switched the tab but never scrolled to the specific reel.
//            Now: setActiveHomeTab("reels", reelId) → HomeView receives
//            both args → reelTabRef.current.scrollToReel(reelId) fires.
//
// [VBF-1]   RENDER_RADIUS bumped to 40 on fast connections (was 26).
//            With 26 initial posts all are always in window. With 52+
//            after loadMore, 80 are in DOM. Users almost never see a
//            Placeholder on realistic feeds.
//
// [VBF-2]   Placeholder NEVER collapses to zero. When heightMap[index]
//            is missing we use a smart estimate based on post type:
//            image post → 560px, video → 540px, text-card → 320px,
//            text-only → 200px. Prevents layout jump on scroll-back.
//
// [VBF-3]   Placeholder uses deterministic gradient (never black).
//
// [VBF-4]   ResizeObserver is attached even to Placeholder wrappers so
//            heights are recorded whether the card or the placeholder
//            was last rendered at that index.
//
// [VBF-5]   VirtualFeed IntersectionObserver re-wires on posts.length
//            change so every card added by loadMore is tracked instantly.
//
// All v20 preload engine, SWR pre-seed, pipeline injection, NewPostBanner,
// ScrollFAB, VideoPreloadRunway, ScrollSentinel preserved exactly.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useCallback, useRef, useEffect, useImperativeHandle,
  useMemo, useLayoutEffect, lazy, Suspense,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUp, FileText } from "lucide-react";
import PostCard    from "./PostCard";
import SectionHeader from "../Shared/SectionHeader";
import { FeedPipeline, useFeedInjections } from "./FeedPipelines";
import { rankItems, recordSignal }          from "../../services/discovery/discoveryPersonalizationModel";
import mediaUrlService                      from "../../services/shared/mediaUrlService";

const NewsVideoStrip = lazy(() => import("./NewsVideoStrip"));

// ─── Connection profile ───────────────────────────────────────────────────────
const _conn   = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect    = _conn?.effectiveType || "4g";
const _save   = _conn?.saveData || false;
const IS_SLOW = _save || _ect === "slow-2g" || _ect === "2g";
const IS_MID  = _ect === "3g";
const IS_FAST = !IS_SLOW && !IS_MID;

// [VBF-1] Expanded render radius
const RENDER_RADIUS  = IS_SLOW ? 14 : IS_MID ? 24 : 40;
const PRELOAD_WINDOW = IS_SLOW ? 10 : IS_MID ? 20 : 36;
const VIDEO_PRELOAD_W = IS_SLOW ? 4  : IS_MID ?  8 : 18;

// Image quality
const IMG_W = IS_SLOW ? 480 : IS_MID ? 800 : 1200;
const IMG_Q = IS_SLOW ? "auto:low" : IS_MID ? "auto:good" : "auto:best";

// [VBF-2] Smart height estimate when ResizeObserver hasn't recorded yet
function estimatePostHeight(post) {
  if (!post) return 480;
  if ((post.image_ids?.length || 0) > 0) return 560;
  if ((post.video_ids?.length || 0) > 0) return 540;
  if (post.is_text_card) return 320;
  return 200;
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

// ─── Build ALL candidate image URLs for a cloudinary/supabase ID ─────────────
function buildAllCandidates(id, opts = {}) {
  if (!id || typeof id !== "string" || !id.trim()) return [];
  const clean = id.trim();
  const w = opts.width || IMG_W, q = opts.quality || IMG_Q, f = opts.format || "auto";
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
  const supa = getSupabaseProjectUrl("core");
  if (supa && !clean.startsWith("http")) {
    const u5 = `${supa}/storage/v1/object/public/posts/${clean}`;
    if (!urls.includes(u5)) urls.push(u5);
  }
  return urls;
}

// ─── [VBF-3] Deterministic placeholder gradient ───────────────────────────────
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
function getPlaceholderGradient(post) {
  const seed = (post?.user_id || post?.id || "x")
    .split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PH_GRADS[seed % PH_GRADS.length];
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREE-TIER PRELOAD ENGINE — module-level, survives remounts
// ═══════════════════════════════════════════════════════════════════════════════
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

function _drainTier(tier) {
  while (_flying[tier] < _SLOTS[tier] && _queues[tier].length > 0) {
    const url = _queues[tier].shift();
    _flying[tier]++;
    const img = new Image();
    const done = () => { _flying[tier]--; _drainTier(tier); };
    img.onload = done; img.onerror = done;
    if (tier === TIER.CRITICAL) img.fetchPriority = "high";
    if (tier === TIER.BATCH)    img.fetchPriority = "low";
    img.src = url;
  }
}

function _drain() {
  _drainTier(TIER.CRITICAL);
  _drainTier(TIER.URGENT);
  if (_queues[TIER.BATCH].length && !_idleHandle) {
    if (typeof requestIdleCallback !== "undefined") {
      _idleHandle = requestIdleCallback(() => { _idleHandle = null; _drainTier(TIER.BATCH); }, { timeout: 2000 });
    } else {
      setTimeout(() => _drainTier(TIER.BATCH), 150);
    }
  }
}

function schedulePreload(url, tier = TIER.BATCH) {
  if (!url || typeof url !== "string") return;
  if (tier === TIER.CRITICAL) _injectHead(url);
  if (_done.has(url)) {
    for (let t = tier + 1; t <= TIER.BATCH; t++) {
      const idx = _queues[t].indexOf(url);
      if (idx !== -1) { _queues[t].splice(idx, 1); _queues[tier].unshift(url); _drain(); return; }
    }
    return;
  }
  _done.add(url);
  _queues[tier].push(url);
  _drain();
}

function preloadPost(post, tier = TIER.BATCH) {
  if (!post) return;
  (post.image_ids || []).filter(Boolean).forEach(id =>
    buildAllCandidates(id).forEach(url => schedulePreload(url, tier))
  );
}

function preloadBatch(posts, anchorIndex = 0) {
  if (!posts?.length) return;
  posts.forEach((post, i) => {
    if (!post) return;
    const dist = Math.abs(i - anchorIndex);
    preloadPost(post, dist <= 6 ? TIER.CRITICAL : dist <= 16 ? TIER.URGENT : TIER.BATCH);
  });
}

function preloadFirstPaintImages(posts) {
  if (!posts?.length) return;
  const cld = getCld();
  posts.slice(0, 10).forEach(post => {
    (post.image_ids || []).slice(0, 1).filter(Boolean).forEach(id => {
      if (cld) schedulePreload(
        `https://res.cloudinary.com/${cld}/image/upload/w_${IMG_W},q_${IMG_Q},f_auto,c_limit/${id.trim()}`,
        TIER.CRITICAL,
      );
      try {
        const u = mediaUrlService.getImageUrl(id, { width: IMG_W, quality: IMG_Q, format: "auto" });
        if (u?.startsWith("http")) schedulePreload(u, TIER.CRITICAL);
      } catch {}
    });
  });
}

// ─── NewPostBanner ────────────────────────────────────────────────────────────
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
    const id = requestAnimationFrame(() => setTopPx(getSafeTop()));
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
        .ptb-pill{position:fixed;left:50%;transform:translateX(-50%);z-index:9999;display:inline-flex;align-items:center;gap:7px;padding:9px 22px;border-radius:999px;background:rgba(84,163,10,0.97);border:1px solid rgba(255,255,255,0.22);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;box-shadow:0 6px 30px rgba(84,163,10,0.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:ptbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;}
        .ptb-pill:hover{background:rgba(74,143,8,1);transform:translateX(-50%) scale(1.04);}
        @keyframes ptbIn{from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
      `}</style>
    </>,
    document.body,
  );
};

// ─── VideoPreloadRunway ───────────────────────────────────────────────────────
const VideoPreloadRunway = React.memo(({ posts, anchorIndex }) => {
  const cld   = getCld();
  const start = Math.max(0, anchorIndex - VIDEO_PRELOAD_W);
  const end   = Math.min(posts.length - 1, anchorIndex + VIDEO_PRELOAD_W);
  const rStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const rEnd   = Math.min(posts.length - 1, anchorIndex + RENDER_RADIUS);
  const hints = [];
  for (let i = start; i <= end; i++) {
    if (i >= rStart && i <= rEnd) continue;
    const p = posts[i];
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

// ─── [VBF-2][VBF-3] Placeholder — smart height, colored gradient ─────────────
const Placeholder = React.memo(({ height, post }) => (
  <div aria-hidden="true" style={{
    width:        "100%",
    height:       Math.max(height || 0, estimatePostHeight(post)),
    flexShrink:   0,
    contain:      "strict",
    background:   getPlaceholderGradient(post),
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
// VirtualFeed — [VBF-1..5]
// ═══════════════════════════════════════════════════════════════════════════════
const VirtualFeed = React.memo(({
  posts, currentUser, onAuthorClick, onActionMenu, onComment,
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

  // [VBF-5] Re-wire IO whenever posts array grows
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
  }, [posts.length]); // eslint-disable-line

  useEffect(() => () => Object.values(roMap.current).forEach(ro => ro.disconnect()), []);

  // [VBF-4] ResizeObserver on EVERY wrapper including Placeholder wrappers
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
              <FeedPipeline type={pipeType} currentUser={currentUser} onNavigate={onPipelineNavigate} />
            )}
            <div ref={makeRef(index)} className="vf-item">
              {inWindow ? (
                <PostCard
                  post={post} currentUser={currentUser}
                  onAuthorClick={onAuthorClick} onActionMenu={onActionMenu}
                  onComment={onComment} feedIndex={index}
                />
              ) : (
                // [VBF-2][VBF-3] Smart height, colored gradient
                <Placeholder height={heightMap.current[index]} post={post} />
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
// PostTab — main export
// ═══════════════════════════════════════════════════════════════════════════════
const PostTab = React.forwardRef(function PostTab(
  {
    posts: initialPosts = [],
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

  const pendingRef   = useRef([]);
  const loadingRef   = useRef(false);
  const lastBatchLen = useRef(0);
  const fortyFired   = useRef(false);
  const seventyFired = useRef(false);
  const rafRef       = useRef(null);

  useEffect(() => { setLocalPosts(rankItems(initialPosts)); }, [initialPosts]);

  const injections = useFeedInjections(localPosts.length);

  // [NAV-FIX] Pass BOTH dest AND entityId — HomeView.handlePipelineNavigate
  // receives (dest, entityId) and uses entityId to call scrollToReel
  const handlePipelineNavigate = useCallback((dest, entityId) => {
    if (typeof setActiveHomeTab === "function") {
      setActiveHomeTab(dest, entityId);
    }
  }, [setActiveHomeTab]);

  // Preload first 26 at mount — synchronous before any rAF
  useLayoutEffect(() => {
    if (!localPosts.length) return;
    preloadFirstPaintImages(localPosts);
    preloadBatch(localPosts.slice(0, 26), 0);
    lastBatchLen.current = localPosts.length;
  }, []); // eslint-disable-line

  // Preload new batch when posts array grows (loadMore)
  useEffect(() => {
    const prev = lastBatchLen.current;
    if (localPosts.length <= prev) return;
    preloadBatch(localPosts.slice(prev), -999);
    lastBatchLen.current = localPosts.length;
    fortyFired.current   = false;
    seventyFired.current = false;
  }, [localPosts.length]); // eslint-disable-line

  // Preload window around current anchor (scroll-ahead)
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
        preloadPost(post, dist <= 6 ? TIER.CRITICAL : dist <= 16 ? TIER.URGENT : TIER.BATCH);
      }
      const visible = localPosts[anchorIndex];
      if (visible && !visible.aiInjected) recordSignal(visible, "CLICK_THROUGH");
    });
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [anchorIndex]); // eslint-disable-line

  // Load more at 40% and 70% of current list
  useEffect(() => {
    if (!hasMore || loadingRef.current || isLoadingMore || !onLoadMore || !localPosts.length) return;
    const fortyMark   = Math.floor(localPosts.length * 0.4);
    const seventyMark = Math.floor(localPosts.length * 0.7);
    if (anchorIndex >= fortyMark && !fortyFired.current) {
      fortyFired.current = true; loadingRef.current = true; onLoadMore();
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
    const el = document.querySelector(".main-content-desktop,.main-content-mobile");
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
        <Suspense fallback={null}><NewsVideoStrip currentUser={currentUser} /></Suspense>
        <div style={{ padding:"60px 20px",textAlign:"center",color:"#737373",fontSize:16 }}>
          <p>No posts yet. Be the first!</p>
        </div>
      </>
    );
  }

  return (
    <div className="post-tab-feed">
      <SectionHeader icon={FileText} title="Posts" subtitle="Latest updates from your community" />
      <NewPostBanner count={pendingCount} onShow={flushPending} isActive={isActive} />
      <Suspense fallback={null}><NewsVideoStrip currentUser={currentUser} /></Suspense>
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