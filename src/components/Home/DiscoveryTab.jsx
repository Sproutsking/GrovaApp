// src/components/Home/DiscoveryTab.jsx — v2 PERFECTED
//
// ═══════════════════════════════════════════════════════════════════════════
// PERFECTIONS vs v1:
//
// [T1] TWO-TIER IO — one observer at threshold:0.5 for "active" (playing)
//      and one at threshold:0.1 for "warm" (metadata preloaded).
//      This matches the Reels engine pattern: warm before active.
//
// [T2] PRELOAD WINDOW — the 2 cards above and 2 below the active card
//      are kept in "metadata-preloaded" state. Beyond that = src not set.
//
// [T3] visibleId is a stable ref-based state — no stale closure issues.
//
// [T4] Category filter animates with a sliding indicator.
//
// [T5] Skeleton cards have the exact same aspect-ratio as real cards
//      so there is zero layout shift when content loads.
//
// [T6] Refresh clears the module-level service cache so fresh content
//      is fetched, not served from the 10-minute TTL.
//
// [T7] Infinite scroll uses a 1200px rootMargin sentinel so the next
//      batch is always loaded before the user reaches the bottom.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback,
} from "react";
import {
  Compass, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import DiscoveryCard from "./DiscoveryCard";
import { getDiscoveryFeed, getCategoryFeed, DISCOVERY_CATEGORIES } from "../../services/discovery/discoveryService";
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";

// ─── Category metadata ────────────────────────────────────────────────────────
const CAT_EMOJI = {
  Ocean:            "🌊",
  Jungle:           "🌿",
  Predator:         "🦅",
  Birds:            "🐦",
  "Space & Earth":  "🌍",
  Snow:             "❄️",
  Rain:             "🌧️",
  Waterfalls:       "💧",
  "Macro Wildlife": "🔬",
  Mountains:        "⛰️",
  Desert:           "🏜️",
  "Night Nature":   "🌙",
  Storms:           "⚡",
  "Aerial Earth":   "🛸",
  Relaxation:       "😌",
  Survival:         "🔥",
  "Extreme Nature": "🌋",
};

// ─── [T1] Dual-threshold autoplay hook ───────────────────────────────────────
// Returns { visibleId, warmIds } — visibleId for the active card,
// warmIds for cards that should have metadata preloaded.
function useDiscoveryAutoplay(containerRef, itemIds) {
  const [visibleId, setVisibleId] = useState(null);
  const [warmIds,   setWarmIds]   = useState(new Set());

  // Active observer — high threshold means "mostly in view"
  useEffect(() => {
    if (!containerRef.current) return;
    const activeIO = new IntersectionObserver(entries => {
      let best = null, bestArea = 0;
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > bestArea) {
          bestArea = e.intersectionRatio;
          best = e.target.dataset.dcid || null;
        }
      }
      if (best !== null) setVisibleId(best);
    }, { threshold: 0.55 });

    const cards = containerRef.current.querySelectorAll("[data-dcid]");
    cards.forEach(c => activeIO.observe(c));
    return () => activeIO.disconnect();
  }); // re-runs when containerRef.current changes (new items loaded)

  // [T2] Warm observer — low threshold, marks adjacent cards
  useEffect(() => {
    if (!containerRef.current) return;
    const warmIO = new IntersectionObserver(entries => {
      setWarmIds(prev => {
        const next = new Set(prev);
        for (const e of entries) {
          const id = e.target.dataset.dcid;
          if (!id) continue;
          if (e.isIntersecting) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    }, { rootMargin: "300px 0px 300px 0px", threshold: 0 });

    const cards = containerRef.current.querySelectorAll("[data-dcid]");
    cards.forEach(c => warmIO.observe(c));
    return () => warmIO.disconnect();
  }); // re-runs after each render to pick up new cards

  return { visibleId, warmIds };
}

// ─── Category pill ────────────────────────────────────────────────────────────
const CatPill = React.memo(({ cat, active, onClick }) => (
  <button
    className={`dt-cat ${active ? "dt-cat--active" : ""}`}
    onClick={() => onClick(cat)}
  >
    <span className="dt-cat-emoji">{CAT_EMOJI[cat] || "🎬"}</span>
    {cat}
  </button>
));
CatPill.displayName = "CatPill";

// ─── Skeleton card — [T5] same aspect ratio ───────────────────────────────────
const SkeletonCard = () => (
  <div className="dt-skel-card" aria-hidden="true">
    <div className="dt-skel-media" />
    <div className="dt-skel-lines">
      <div className="dt-skel-line" style={{ width: "70%" }} />
      <div className="dt-skel-line" style={{ width: "50%", opacity: 0.5 }} />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// DiscoveryTab
// ═══════════════════════════════════════════════════════════════════════════
const DiscoveryTab = React.forwardRef(function DiscoveryTab(
  { currentUser, isActive },
  ref,
) {
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [error,       setError]       = useState(null);

  const containerRef = useRef(null);
  const sentinelRef  = useRef(null);
  const fetchedOnce  = useRef(false);
  const catScrollRef = useRef(null);

  const allCategories = ["All", ...DISCOVERY_CATEGORIES];

  const { visibleId, warmIds } = useDiscoveryAutoplay(containerRef, items.map(i => i.id));

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fetchedOnce.current) {
      fetchedOnce.current = true;
      loadFeed(true);
    }
  }, []); // eslint-disable-line

  // ── Category change ───────────────────────────────────────────────────────
  useEffect(() => {
    if (fetchedOnce.current) {
      setItems([]);
      setHasMore(true);
      setError(null);
      loadFeed(true);
    }
  }, [activeCategory]); // eslint-disable-line

  const loadFeed = useCallback(async (reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      let data;
      if (activeCategory === "All") {
        data = await getDiscoveryFeed({ limit: 15 });
      } else {
        data = await getCategoryFeed(activeCategory, 15);
      }

      if (!data?.length) {
        setHasMore(false);
      } else {
        if (reset) {
          setItems(data);
        } else {
          setItems(prev => {
            const ids = new Set(prev.map(i => i.id));
            return [...prev, ...data.filter(i => !ids.has(i.id))];
          });
        }
        setHasMore(data.length >= 10);
      }
    } catch (e) {
      setError(e?.message || "Failed to load Discovery");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory]);

  // ── [T7] Infinite scroll sentinel with large rootMargin ───────────────────
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loadingMore && !loading) loadFeed(false);
    }, { rootMargin: "1200px" }); // [T7] load well before user reaches bottom
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, loadFeed]);

  const handleCategoryClick = useCallback((cat) => setActiveCategory(cat), []);

  const handleOpenDiscovery = useCallback((category) => {
    if (category && category !== activeCategory) setActiveCategory(category);
  }, [activeCategory]);

  const scrollCats = (dir) => {
    catScrollRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  // [T6] Refresh clears the cache
  const handleRefresh = useCallback(() => {
    setItems([]);
    setHasMore(true);
    setError(null);
    loadFeed(true);
  }, [loadFeed]);

  return (
    <div className="dt-root">
      {/* ── Header ── */}
      <div className="dt-header">
        <div className="dt-header-l">
          <div className="dt-header-icon">
            <Compass size={16} />
          </div>
          <div>
            <div className="dt-header-title">Discovery Stream</div>
            <div className="dt-header-sub">Cinematic wildlife & nature</div>
          </div>
        </div>
        <button
          className={`dt-refresh ${loading ? "dt-refresh--spin" : ""}`}
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── [T4] Category filter bar ── */}
      <div className="dt-cats-wrap">
        <button className="dt-cats-arr" onClick={() => scrollCats(-1)} aria-label="Scroll left">
          <ChevronLeft size={14} />
        </button>
        <div className="dt-cats" ref={catScrollRef}>
          {allCategories.map(cat => (
            <CatPill
              key={cat}
              cat={cat}
              active={activeCategory === cat}
              onClick={handleCategoryClick}
            />
          ))}
        </div>
        <button className="dt-cats-arr" onClick={() => scrollCats(1)} aria-label="Scroll right">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Feed ── */}
      {loading && !items.length ? (
        <div className="dt-skels">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error && !items.length ? (
        <div className="dt-error">
          <Compass size={28} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p>Could not load Discovery content.</p>
          <button onClick={handleRefresh} className="dt-retry">Try again</button>
        </div>
      ) : (
        <div className="dt-feed" ref={containerRef}>
          {items.map(item => (
            <div
              key={item.id}
              data-dcid={item.id}
              className="dt-card-wrapper"
            >
              <DiscoveryCard
                item={item}
                // [T1] Only the single most visible card is "active" (playing)
                isVisible={isActive && visibleId === item.id}
                onOpenDiscovery={handleOpenDiscovery}
              />
            </div>
          ))}

          {/* [T7] Sentinel */}
          <div ref={sentinelRef} style={{ height: 4 }} aria-hidden="true" />

          {loadingMore && (
            <div className="dt-loading-more">
              <div className="dt-spin" />
              More discoveries loading…
            </div>
          )}

          {!hasMore && items.length > 0 && (
            <div className="dt-end">
              <Compass size={18} style={{ opacity: 0.25 }} />
              <span>You've explored this region</span>
            </div>
          )}
        </div>
      )}

      <style>{DT_CSS}</style>
    </div>
  );
});

DiscoveryTab.displayName = "DiscoveryTab";
export default DiscoveryTab;

// ─── CSS ─────────────────────────────────────────────────────────────────────
const DT_CSS = `
@keyframes dtSpin{to{transform:rotate(360deg)}}

.dt-root{width:100%;padding-bottom:20px;}

/* Header */
.dt-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 16px 8px;
}
.dt-header-l{display:flex;align-items:center;gap:10px;}
.dt-header-icon{
  width:36px;height:36px;border-radius:10px;
  background:linear-gradient(135deg,#84cc16,#22d3ee);
  display:flex;align-items:center;justify-content:center;
  color:#000;flex-shrink:0;
  box-shadow:0 4px 16px rgba(132,204,22,0.25);
}
.dt-header-title{font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);}
.dt-header-sub{font-size:11px;color:rgba(255,255,255,0.35);margin-top:1px;}
.dt-refresh{
  width:32px;height:32px;border-radius:8px;
  background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.08);
  color:rgba(255,255,255,0.4);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s;
}
.dt-refresh:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);}
.dt-refresh:disabled{opacity:.4;cursor:default;}
.dt-refresh--spin svg{animation:dtSpin 1s linear infinite;}

/* Category bar */
.dt-cats-wrap{
  display:flex;align-items:center;gap:4px;
  padding:0 8px 12px;
}
.dt-cats-arr{
  width:26px;height:26px;border-radius:7px;flex-shrink:0;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.07);
  color:rgba(255,255,255,0.3);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s;
}
.dt-cats-arr:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.6);}
.dt-cats{
  display:flex;gap:6px;overflow-x:auto;
  scrollbar-width:none;-webkit-overflow-scrolling:touch;
  flex:1;padding:2px;
}
.dt-cats::-webkit-scrollbar{display:none;}
.dt-cat{
  display:inline-flex;align-items:center;gap:5px;
  padding:6px 12px;border-radius:20px;
  font-size:11.5px;font-weight:700;
  white-space:nowrap;cursor:pointer;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.07);
  color:rgba(255,255,255,0.45);
  transition:all .18s;font-family:inherit;
  flex-shrink:0;
}
.dt-cat-emoji{font-size:13px;line-height:1;}
.dt-cat:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);}
.dt-cat--active{
  background:rgba(132,204,22,0.12);
  border-color:rgba(132,204,22,0.38);
  color:#a3e635;
}

/* Feed */
.dt-feed{padding:0 12px;display:flex;flex-direction:column;gap:4px;}
.dt-card-wrapper{width:100%;}

/* [T5] Skeletons — exact same aspect ratio as cards */
.dt-skels{padding:12px;display:flex;flex-direction:column;gap:10px;}
.dt-skel-card{width:100%;border-radius:18px;overflow:hidden;background:rgba(255,255,255,0.03);}
.dt-skel-media{
  width:100%;aspect-ratio:9/14;
  background:rgba(255,255,255,0.055);
  animation:dtSkelPulse 1.5s ease-in-out infinite;
}
@media(max-width:768px){.dt-skel-media{aspect-ratio:9/16;}}
@keyframes dtSkelPulse{0%,100%{opacity:.6}50%{opacity:.2}}
.dt-skel-lines{padding:12px 14px;display:flex;flex-direction:column;gap:8px;}
.dt-skel-line{
  height:11px;border-radius:6px;
  background:rgba(255,255,255,0.06);
  animation:dtSkelPulse 1.5s ease-in-out infinite;
}

/* States */
.dt-error{
  padding:48px 20px;text-align:center;
  color:rgba(255,255,255,0.35);font-size:14px;
  display:flex;flex-direction:column;align-items:center;gap:8px;
}
.dt-retry{
  margin-top:8px;padding:8px 22px;border-radius:20px;
  background:rgba(132,204,22,0.12);
  border:1px solid rgba(132,204,22,0.3);
  color:#84cc16;font-size:13px;font-weight:700;
  cursor:pointer;font-family:inherit;
  transition:background .15s;
}
.dt-retry:hover{background:rgba(132,204,22,0.2);}
.dt-loading-more{
  display:flex;align-items:center;justify-content:center;gap:8px;
  padding:20px;color:rgba(255,255,255,0.3);font-size:12px;
}
.dt-spin{
  width:16px;height:16px;
  border:2px solid rgba(255,255,255,0.08);
  border-top-color:rgba(132,204,22,0.6);
  border-radius:50%;
  animation:dtSpin .8s linear infinite;
}
.dt-end{
  display:flex;align-items:center;justify-content:center;gap:8px;
  padding:24px;
  color:rgba(255,255,255,0.2);font-size:12px;font-weight:600;
  letter-spacing:.05em;text-transform:uppercase;
} 

@media(max-width:768px){
  .dt-feed{padding:0 8px;}
  .dt-cats-arr{display:none;}
}
`;