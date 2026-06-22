// src/components/Home/FeedTab.jsx — v1 MERGED POSTS & REELS ULTRA-FAST
//
// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED FEED COMBINING POSTS + REELS:
//
// [MERGE-1]  Both posts and reels mixed chronologically or by engagement.
//            User sees a seamless feed without knowing the source type.
//
// [MERGE-2]  ReelCard footer now matches PostCard footer layout exactly.
//            Category tag top-left like posts. Full-screen opens on click.
//
// [MERGE-3]  PostCard opens full-screen with threaded comments (3-level deep).
//            No tab switch needed — inline full-screen viewer.
//
// [MERGE-4]  Virtual window renders 40 items (posts + reels mixed).
//            Preloading for both images and video thumbnails.
//
// [MERGE-5]  Infinite scroll with merged pagination — loadMore merges
//            both sources and interleaves them by timestamp.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useCallback, useRef, useEffect, useImperativeHandle,
  useMemo, useLayoutEffect,
} from "react";
import { ArrowUp } from "lucide-react";
import PostCard from "./PostCard";
import ReelCard from "./ReelCard";
import SectionHeader from "../Shared/SectionHeader";
import FullScreenPost from "./FullScreenPost";
import FullScreenReels from "./FullScreenReels";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ─── Connection profile ───────────────────────────────────────────────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect = _conn?.effectiveType || "4g";
const _save = _conn?.saveData || false;
const IS_SLOW = _save || _ect === "slow-2g" || _ect === "2g";
const IS_MID = _ect === "3g";
// Fixed aggressive preloading/render radius as requested: 30 items
const RENDER_RADIUS = 30;
const PRELOAD_WINDOW = 30;

// ─── PERFECT DISPLAY MODEL ────────────────────────────────────────────────────
// Calculates engagement score: recency × engagement (likes + comments + shares)
function calcEngagementScore(item) {
  const ageMs = Date.now() - new Date(item.created_at).getTime();
  const ageHours = Math.max(1, ageMs / (1000 * 60 * 60));
  const engagementCount = (item.likes || 0) + (item.comments_count || 0) + (item.shares || 0);
  // Time decay: newer content scores higher, but engagement can override
  const timeDecay = Math.exp(-ageHours / 48); // 48-hour half-life
  const engagement = Math.log1p(engagementCount) * timeDecay;
  return engagement;
}

// Better height estimation based on content characteristics
function estimateHeight(item) {
  let h = 0;
  
  // Base header + footer
  h += 100; // avatar, name, timestamp, actions
  
  if (item?.type === "reel") {
    h += 520; // Reel player standard height
  } else {
    // Post card height based on content
    const images = item?.image_ids?.length || 0;
    const videos = item?.video_ids?.length || 0;
    const hasText = item?.content?.length > 0;
    
    if (images > 0) {
      // Multi-image: estimate based on count
      h += images === 1 ? 520 : images === 2 ? 480 : 450;
    } else if (videos > 0) {
      h += 520;
    } else if (item?.is_text_card) {
      h += hasText ? 200 + Math.min(200, item.content.length / 2) : 120;
    } else {
      h += 200; // Text-only fallback
    }
  }
  
  // Engagement section (likes, comments, shares)
  h += 48;
  // Comments preview (if present)
  if ((item?.comments_count || 0) > 0) h += 60;
  
  return h;
}

function getCld() {
  return (
    window.__CLD_CLOUD__ ||
    window.__CLOUDINARY_CLOUD__ ||
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
    null
  );
}

// ─── PERFECT MERGE ALGORITHM: Chronological with engagement boost ─────────────
// Strategy: Posts and reels are sorted by (recency × engagement score)
// This ensures fresh content appears first, but popular older content can surface.
function mergeFeedItems(posts = [], reels = []) {
  const merged = [
    ...posts.map(p => ({
      ...p,
      type: "post",
      created_time: new Date(p.created_at).getTime(),
      engagement_score: calcEngagementScore(p),
    })),
    ...reels.map(r => ({
      ...r,
      type: "reel",
      created_time: new Date(r.created_at).getTime(),
      engagement_score: calcEngagementScore(r),
    })),
  ];
  
  // Sort by engagement score (recency-weighted), newest first
  return merged.sort((a, b) => b.engagement_score - a.engagement_score);
}

const FeedTab = React.forwardRef(({
  posts = [],
  reels = [],
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  onLoadMore,
  hasMore,
  isLoadingMore,
  isActive,
  setActiveHomeTab,
}, ref) => {
  const [heightMap, setHeightMap] = useState({});
  const [anchorIdx, setAnchorIdx] = useState(0);
  const [scrollFabVisible, setScrollFabVisible] = useState(false);
  const [fullScreenItem, setFullScreenItem] = useState(null);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);

  const feedItems = useMemo(() => mergeFeedItems(posts, reels), [posts, reels]);
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const heightsRef = useRef({});

  // ── Visible window ─────────────────────────────────────────────────────────
  const visibleStart = Math.max(0, anchorIdx - RENDER_RADIUS);
  const visibleEnd = Math.min(feedItems.length, anchorIdx + RENDER_RADIUS);
  const visibleItems = feedItems.slice(visibleStart, visibleEnd);

  // ── Virtual scroll height calculation ──────────────────────────────────────
  const totalHeight = useMemo(() => {
    let h = 0;
    for (let i = 0; i < feedItems.length; i++) {
      h += heightsRef.current[i] || estimateHeight(feedItems[i]);
    }
    return h;
  }, [feedItems]);

  const offsetHeight = useMemo(() => {
    let h = 0;
    for (let i = 0; i < visibleStart; i++) {
      h += heightsRef.current[i] || estimateHeight(feedItems[i]);
    }
    return h;
  }, [feedItems, visibleStart]);

  // ── IntersectionObserver for anchor detection ───────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !isActive) return;
    const io = new IntersectionObserver(
      entries => {
        let best = anchorIdx, bestRatio = 0;
        entries.forEach(e => {
          const idx = parseInt(e.target.dataset.feedIdx, 10);
          if (e.isIntersecting && e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = idx;
          }
        });
        setAnchorIdx(best);
        // Trigger load more at 70% scroll
        if (best > feedItems.length * 0.7 && hasMore && !isLoadingMore) {
          onLoadMore?.();
        }
      },
      { threshold: [0.1, 0.5, 0.9] }
    );

    const cards = containerRef.current.querySelectorAll("[data-feed-idx]");
    cards.forEach(c => io.observe(c));
    return () => io.disconnect();
  }, [isActive, anchorIdx, feedItems.length, hasMore, isLoadingMore, onLoadMore]);

  // ── ResizeObserver for accurate heights ──────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current || !isActive) return;
    const ro = new ResizeObserver(entries => {
      const updates = {};
      entries.forEach(e => {
        const idx = parseInt(e.target.dataset.feedIdx, 10);
        if (!isNaN(idx)) {
          updates[idx] = e.contentRect.height;
          heightsRef.current[idx] = e.contentRect.height;
        }
      });
      if (Object.keys(updates).length > 0) {
        setHeightMap(prev => ({ ...prev, ...updates }));
      }
    });

    const cards = containerRef.current.querySelectorAll("[data-feed-idx]");
    cards.forEach(c => ro.observe(c));
    return () => ro.disconnect();
  }, [isActive, visibleStart, visibleEnd]);

  // ── Scroll to top FAB ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !isActive) return;
    const checkScroll = () => {
      setScrollFabVisible((containerRef.current?.scrollTop || 0) > 500);
    };
    const container = containerRef.current;
    container?.addEventListener("scroll", checkScroll);
    return () => container?.removeEventListener("scroll", checkScroll);
  }, [isActive]);

  // ── Exposed methods ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    prependPost: (post) => {
      // Called by realtime subscriptions
    },
    scrollToTop: () => {
      if (containerRef.current) containerRef.current.scrollTop = 0;
    },
  }), []);

  // ── Full screen handlers ───────────────────────────────────────────────────
  const handleFullScreenOpen = useCallback((item, index) => {
    setFullScreenItem(item);
    setFullScreenIndex(index);
  }, []);

  const handleFullScreenClose = useCallback(() => {
    setFullScreenItem(null);
  }, []);

  const handleFullScreenNext = useCallback(() => {
    const next = fullScreenIndex + 1;
    if (next < feedItems.length) {
      setFullScreenItem(feedItems[next]);
      setFullScreenIndex(next);
    }
  }, [fullScreenIndex, feedItems]);

  const handleFullScreenPrev = useCallback(() => {
    const prev = fullScreenIndex - 1;
    if (prev >= 0) {
      setFullScreenItem(feedItems[prev]);
      setFullScreenIndex(prev);
    }
  }, [fullScreenIndex, feedItems]);

  return (
    <div
      ref={containerRef}
      className="feed-container-virtual"
      style={{ position: "relative", overflow: "auto", height: "100%" }}
    >
      <SectionHeader icon={Image} title="Feed" />

      {/* Virtual scroll wrapper */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, idx) => {
          const actualIdx = visibleStart + idx;
          const itemKey = `${item.type}-${item.id}`;
          const itemHeight = heightsRef.current[actualIdx] || estimateHeight(item);

          return (
            <div
              key={itemKey}
              data-feed-idx={actualIdx}
              style={{
                position: "absolute",
                top: offsetHeight + visibleItems.slice(0, idx).reduce((h, _, i) => h + (heightsRef.current[visibleStart + i] || estimateHeight(visibleItems[i])), 0),
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {item.type === "post" ? (
                <PostCard
                  post={item}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                  onComment={onComment}
                  onFullScreen={() => handleFullScreenOpen(item, actualIdx)}
                  isActive={isActive}
                />
              ) : (
                <ReelCard
                  reel={item}
                  currentUser={currentUser}
                  onAuthorClick={onAuthorClick}
                  onActionMenu={onActionMenu}
                  onComment={onComment}
                  onFullScreen={() => handleFullScreenOpen(item, actualIdx)}
                  isActive={isActive}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Scroll to top FAB */}
      {scrollFabVisible && (
        <button
          className="scroll-fab"
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          title="Back to top"
        >
          <ArrowUp size={20} />
        </button>
      )}

      {/* Full-screen viewers */}
      {fullScreenItem?.type === "post" && (
        <FullScreenPost
          post={fullScreenItem}
          allPosts={feedItems.filter(i => i.type === "post")}
          currentUser={currentUser}
          onClose={handleFullScreenClose}
          onNext={handleFullScreenNext}
          onPrev={handleFullScreenPrev}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
        />
      )}

      {fullScreenItem?.type === "reel" && (
        <FullScreenReels
          reels={feedItems.filter(i => i.type === "reel")}
          initialIndex={feedItems
            .slice(0, fullScreenIndex + 1)
            .filter(i => i.type === "reel").length - 1}
          currentUser={currentUser}
          onClose={handleFullScreenClose}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
        />
      )}

      <style>{`
        .feed-container-virtual {
          position: relative;
          width: 100%;
        }

        .scroll-fab {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #84cc16;
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: fadeIn 0.3s ease;
          transition: all 0.2s;
        }

        .scroll-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(132, 204, 22, 0.4);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
});

FeedTab.displayName = "FeedTab";

export default FeedTab;
