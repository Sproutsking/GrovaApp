// src/components/Home/ReelsTab.jsx — v2 INSTANT + LOAD MORE + SPECIFIC REEL NAV
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT'S NEW:
//
// [INSTANT-1]  24 reels rendered initially (up from no limit but now with
//              a proper virtual window of ±12 around the anchor reel).
//              Placeholder cards are colored gradients — never black.
//
// [INSTANT-2]  Thumbnail preloading runs at module level. All thumbnails
//              for the visible window are preloaded as Image() objects
//              before the first reel card mounts.
//
// [INSTANT-3]  IntersectionObserver on each reel card tracks the anchor.
//              Preloading fires in rAF synchronously before next paint.
//
// [MORE-1]     ScrollSentinel at 2000px rootMargin fires onLoadMore so
//              the parent (HomeView) can fetch more reels. ReelsTab also
//              accepts hasMore + isLoadingMore + onLoadMore props.
//
// [NAV-1]      scrollToReel(reelId) method exposed via ref so
//              FeedPipelines ReelThumb can scroll to the specific reel
//              when the user clicks it from within the post feed.
//
// [BANNER]     NewReelBanner portal only fires when isActive === true.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useCallback, useRef, useEffect, useImperativeHandle,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUp, Play } from "lucide-react";
import ReelCard       from "./ReelCard";
import FullScreenReels from "./FullScreenReels";
import SectionHeader from "../Shared/SectionHeader";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ─── Connection profile ───────────────────────────────────────────────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData || false;
const IS_SLOW = _save || _ect === "slow-2g" || _ect === "2g";
const IS_MID  = _ect === "3g";

const RENDER_RADIUS   = IS_SLOW ? 8 : IS_MID ? 12 : 16;
const PRELOAD_WINDOW  = IS_SLOW ? 6 : IS_MID ? 12 : 20;
const PLACEHOLDER_H   = 520;

// ─── Placeholder gradients ────────────────────────────────────────────────────
const REEL_GRADIENTS = [
  "linear-gradient(145deg,#0a001a,#1a0535)",
  "linear-gradient(145deg,#000d1a,#001535)",
  "linear-gradient(145deg,#1a000a,#2e0015)",
  "linear-gradient(145deg,#001a0a,#002e15)",
  "linear-gradient(145deg,#1a1000,#2e1a00)",
  "linear-gradient(145deg,#001010,#001a1a)",
];
function getReelGradient(reel) {
  const seed = (reel?.user_id || reel?.id || "x")
    .split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return REEL_GRADIENTS[seed % REEL_GRADIENTS.length];
}

// ─── Thumbnail preload engine ─────────────────────────────────────────────────
const _preloaded = new Set();
function preloadReelThumbs(reels, anchorIdx = 0) {
  if (!reels?.length) return;
  const start = Math.max(0, anchorIdx - 4);
  const end   = Math.min(reels.length - 1, anchorIdx + PRELOAD_WINDOW);
  for (let i = start; i <= end; i++) {
    const r = reels[i];
    if (!r) continue;
    const thumbId = r.thumbnail_id || r.video_id;
    if (!thumbId) continue;
    try {
      const url = r.thumbnail_id
        ? mediaUrlService.getImageUrl(thumbId, { width: 400, quality: "auto:good", format: "webp" })
        : mediaUrlService.getVideoThumbnail(thumbId, { width: 400, height: 711 });
      if (url && !_preloaded.has(url)) {
        _preloaded.add(url);
        const img = new Image();
        img.fetchPriority = i <= anchorIdx + 4 ? "high" : "low";
        img.src = url;
      }
    } catch {}
  }
}

// ─── New-reel banner ──────────────────────────────────────────────────────────
function getMeasuredSafeTop() {
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

const NewReelBanner = ({ count, onShow, isActive }) => {
  const [topPx, setTopPx] = useState(() => getMeasuredSafeTop());
  useEffect(() => {
    const id  = requestAnimationFrame(() => setTopPx(getMeasuredSafeTop()));
    const onR = () => setTopPx(getMeasuredSafeTop());
    window.addEventListener("resize", onR, { passive: true });
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onR); };
  }, []);
  if (!isActive || !count) return null;
  return ReactDOM.createPortal(
    <>
      <button className="rlb-pill" style={{ top: topPx }} onClick={onShow}>
        <ArrowUp size={13} />
        {count} new reel{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .rlb-pill{position:fixed;left:50%;transform:translateX(-50%);z-index:9999;display:inline-flex;align-items:center;gap:7px;padding:9px 22px;border-radius:999px;background:rgba(168,85,247,0.97);border:1px solid rgba(255,255,255,0.22);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;box-shadow:0 6px 30px rgba(168,85,247,0.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:rlbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;}
        .rlb-pill:hover{background:rgba(147,64,226,1);transform:translateX(-50%) scale(1.04);}
        .rlb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes rlbIn{from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
      `}</style>
    </>,
    document.body,
  );
};

// ─── Placeholder card ─────────────────────────────────────────────────────────
const ReelPlaceholder = React.memo(({ reel, height }) => (
  <div style={{
    width:        "100%",
    height:       height || PLACEHOLDER_H,
    background:   getReelGradient(reel),
    borderRadius: 16,
    marginBottom: 0,
    flexShrink:   0,
    contain:      "strict",
  }} aria-hidden="true" />
));
ReelPlaceholder.displayName = "ReelPlaceholder";

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
    }, { rootMargin: "2000px", threshold: 0 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);
  return <div ref={ref} style={{ height: 4, width: "100%", flexShrink: 0 }} aria-hidden="true" />;
};

// ─── EndOfReels ───────────────────────────────────────────────────────────────
const EndOfReels = () => (
  <div style={{
    display:"flex", alignItems:"center", gap:12,
    padding:"28px 20px",
    color:"rgba(255,255,255,0.2)", fontSize:12, fontWeight:600,
    letterSpacing:"0.05em", textTransform:"uppercase",
  }}>
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
    You've seen all reels
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// VirtualReelGrid — renders ±RENDER_RADIUS reels, placeholders outside
// ═══════════════════════════════════════════════════════════════════════════════
const VirtualReelGrid = React.memo(({
  reels,
  currentUser,
  onAuthorClick,
  onActionMenu,
  onOpenFullScreen,
  onSoundClick,
  onHashtagClick,
  onMentionClick,
  onAnchorChange,
  cardRefs,
}) => {
  const [anchorIndex, setAnchorIndex] = useState(0);
  const heightMap  = useRef({});
  const wrapperMap = useRef({});
  const ioRef      = useRef(null);
  const roMap      = useRef({});

  useEffect(() => { onAnchorChange?.(anchorIndex); }, [anchorIndex, onAnchorChange]);

  useEffect(() => {
    ioRef.current?.disconnect();
    ioRef.current = new IntersectionObserver(entries => {
      let best = null, bestTop = Infinity;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const top = entry.boundingClientRect.top;
        const idx = Number(entry.target.dataset.rlidx);
        if (!isNaN(idx) && top < bestTop) { bestTop = top; best = idx; }
      }
      if (best !== null) setAnchorIndex(prev => Math.abs(prev - best) >= 1 ? best : prev);
    }, { rootMargin: "400px 0px 400px 0px", threshold: 0 });

    Object.values(wrapperMap.current).forEach(el => { if (el) ioRef.current.observe(el); });
    return () => ioRef.current?.disconnect();
  }, [reels.length]); // eslint-disable-line

  useEffect(() => () => { Object.values(roMap.current).forEach(ro => ro.disconnect()); }, []);

  const makeRef = useCallback((index) => (el) => {
    roMap.current[index]?.disconnect();
    delete roMap.current[index];
    wrapperMap.current[index] = el;
    // Expose for scrollToReel
    if (cardRefs) cardRefs.current[index] = el;
    if (!el) return;
    el.dataset.rlidx = index;
    ioRef.current?.observe(el);
    const ro = new ResizeObserver(([e]) => {
      const h = Math.round(e.contentRect.height);
      if (h > 0) heightMap.current[index] = h;
    });
    ro.observe(el);
    roMap.current[index] = ro;
  }, [cardRefs]);

  const renderStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const renderEnd   = Math.min(reels.length - 1, anchorIndex + RENDER_RADIUS);

  return (
    <div className="reels-vgrid">
      {reels.map((reel, index) => {
        const inWindow = index >= renderStart && index <= renderEnd;
        return inWindow ? (
          <div ref={makeRef(index)} key={reel.id} className="reels-vgrid-item">
            <ReelCard
              key={reel.id}
              reel={reel}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
              onOpenFullScreen={() => onOpenFullScreen(index)}
              onSoundClick={onSoundClick}
              onHashtagClick={onHashtagClick}
              onMentionClick={onMentionClick}
              index={index}
            />
          </div>
        ) : (
          <div ref={makeRef(index)} key={reel.id} className="reels-vgrid-item">
            <ReelPlaceholder reel={reel} height={heightMap.current[index]} />
          </div>
        );
      })}
      <style>{`
        .reels-vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px;padding:0;max-width:1400px;margin:0 auto;}
        .reels-vgrid-item{width:100%;}
        @media(max-width:1280px){.reels-vgrid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;}}
        @media(max-width:1024px){.reels-vgrid{grid-template-columns:repeat(2,1fr);gap:16px;padding:0;}}
        @media(max-width:768px){.reels-vgrid{grid-template-columns:1fr;gap:0;padding:0;}}
      `}</style>
    </div>
  );
});
VirtualReelGrid.displayName = "VirtualReelGrid";

// ═══════════════════════════════════════════════════════════════════════════════
// ReelsTab — main export
// ═══════════════════════════════════════════════════════════════════════════════
const ReelsTab = React.forwardRef(function ReelsTab({
  reels: initialReels,
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  onSoundClick,
  onHashtagClick,
  onMentionClick,
  isActive      = false,
  hasMore       = false,
  isLoadingMore = false,
  onLoadMore,
}, ref) {
  const [showFullScreen,  setShowFullScreen]  = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [isDesktop,       setIsDesktop]       = useState(window.innerWidth >= 1024);
  const [pendingCount,    setPendingCount]     = useState(0);
  const [localReels,      setLocalReels]       = useState(
    () => (initialReels || []).filter(r => !r.deleted_at),
  );

  const pendingRef   = useRef([]);
  const cardRefs     = useRef({});
  const loadingRef   = useRef(false);
  const anchorRef    = useRef(0);
  const fortyFired   = useRef(false);
  const seventyFired = useRef(false);

  useEffect(() => {
    setLocalReels((initialReels || []).filter(r => !r.deleted_at));
  }, [initialReels]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // [INSTANT-2] Preload thumbnails for first 24 reels immediately, and when list changes
  useEffect(() => {
    if (localReels.length) preloadReelThumbs(localReels, 0);
  }, [localReels.length]);

  // Preload around anchor on scroll
  const handleAnchorChange = useCallback((idx) => {
    anchorRef.current = idx;
    requestAnimationFrame(() => preloadReelThumbs(localReels, idx));

    // Load more at 40% and 70%
    if (!hasMore || loadingRef.current || isLoadingMore || !onLoadMore) return;
    const fortyMark   = Math.floor(localReels.length * 0.4);
    const seventyMark = Math.floor(localReels.length * 0.7);
    if (idx >= fortyMark && !fortyFired.current) {
      fortyFired.current = true; loadingRef.current = true; onLoadMore();
    } else if (idx >= seventyMark && !seventyFired.current) {
      seventyFired.current = true;
      if (!loadingRef.current) { loadingRef.current = true; onLoadMore(); }
    }
  }, [localReels, hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (!isLoadingMore) { loadingRef.current = false; fortyFired.current = false; seventyFired.current = false; }
  }, [isLoadingMore]);

  // New reel via window event
  useEffect(() => {
    const handler = (e) => {
      const reel = e.detail?.reel;
      if (!reel) return;
      if (isActive) {
        setLocalReels(prev => prev.some(r => r.id === reel.id) ? prev : [reel, ...prev]);
        preloadReelThumbs([reel], 0);
      } else {
        if (!pendingRef.current.some(r => r.id === reel.id)) {
          pendingRef.current = [reel, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
        }
      }
    };
    window.addEventListener("grova:newReel", handler);
    return () => window.removeEventListener("grova:newReel", handler);
  }, [isActive]);

  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = [];
    setPendingCount(0);
    setLocalReels(prev => {
      const ids = new Set(prev.map(r => r.id));
      return [...toAdd.filter(r => !ids.has(r.id)), ...prev];
    });
    const el = document.querySelector(".main-content-desktop, .main-content-mobile");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // [NAV-1] Expose scrollToReel via ref
  useImperativeHandle(ref, () => ({
    scrollToReel: (reelId) => {
      const idx = localReels.findIndex(r => r.id === reelId);
      if (idx === -1) return;
      const el = cardRefs.current[idx];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Also open fullscreen on that reel for best experience
        setTimeout(() => {
          setFullScreenIndex(idx);
          setShowFullScreen(true);
        }, 400);
      }
    },
    prependReel: (reel) => {
      setLocalReels(prev => prev.some(r => r.id === reel.id) ? prev : [reel, ...prev]);
    },
  }));

  const handleOpenFullScreen = useCallback((index) => {
    setFullScreenIndex(index);
    setShowFullScreen(true);
    if (!isDesktop) document.body.style.overflow = "hidden";
  }, [isDesktop]);

  const handleCloseFullScreen = useCallback(() => {
    setShowFullScreen(false);
    if (!isDesktop) document.body.style.overflow = "";
  }, [isDesktop]);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && !loadingRef.current && hasMore && onLoadMore) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  if (!localReels || localReels.length === 0) {
    return (
      <>
        <NewReelBanner count={pendingCount} onShow={flushPending} isActive={isActive} />
        <div className="empty-reels">
          <div className="empty-reels-icon">🎬</div>
          <p>No reels to display</p>
          <span>Start creating amazing content!</span>
          <style>{`.empty-reels{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;text-align:center;gap:16px;}.empty-reels-icon{font-size:64px;opacity:0.3;}.empty-reels p{color:#a3a3a3;font-size:18px;font-weight:600;margin:0;}.empty-reels span{color:#737373;font-size:14px;}`}</style>
        </div>
      </>
    );
  }

  return (
    <>
      <NewReelBanner count={pendingCount} onShow={flushPending} isActive={isActive} />

      {!showFullScreen && (
        <>
          <SectionHeader icon={Play} title="Reels" subtitle="Watch the latest short videos" />
          <VirtualReelGrid
            reels={localReels}
            currentUser={currentUser}
            onAuthorClick={onAuthorClick}
            onActionMenu={onActionMenu}
            onOpenFullScreen={handleOpenFullScreen}
            onSoundClick={onSoundClick}
            onHashtagClick={onHashtagClick}
            onMentionClick={onMentionClick}
            onAnchorChange={handleAnchorChange}
            cardRefs={cardRefs}
          />
          <ScrollSentinel onVisible={handleSentinel} disabled={!hasMore || isLoadingMore} />
          {!hasMore && localReels.length > 0 && <EndOfReels />}
          {isLoadingMore && (
            <div style={{ display:"flex", justifyContent:"center", padding:"20px", color:"rgba(255,255,255,0.3)", fontSize:12 }}>
              <div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.08)", borderTopColor:"rgba(168,85,247,0.6)", borderRadius:"50%", animation:"rlSpin 0.8s linear infinite" }} />
              <style>{`@keyframes rlSpin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
        </>
      )}

      {showFullScreen && (
        <FullScreenReels
          reels={localReels}
          initialIndex={fullScreenIndex}
          currentUser={currentUser}
          onClose={handleCloseFullScreen}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onSoundClick={onSoundClick}
        />
      )}
    </>
  );
});

export default ReelsTab;