// src/components/Home/DiscoveryTab.jsx — v4 ULTRA-ADDICTIVE ALGORITHM
//
// FEATURES:
// ─────────────────────────────────────────────────────────────────────────────
// [T1] IntersectionObserver drives isVisible on each card (accurate autoplay)
// [T2] Full-screen overlay via DiscoveryFullScreen
// [T3] 27 categories — ordered by engagement score
// [T4] Saved panel — shows subscriber's saved items, reloads from URL refs
// [T5] Infinite scroll — loads more as user scrolls (keeps them in feed)
// [T6] Related feed — after watching, "More like this" section auto-loads
// [T7] Subscription save gate — lock icon + upgrade nudge for free users
// [T8] Session-context priming — time-of-day affects initial category mix
// [T9] Category pill scroll with arrow buttons
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  Compass, RefreshCw, ChevronLeft, ChevronRight,
  Bookmark, Zap, TrendingUp,
} from "lucide-react";
import DiscoveryCard from "./DiscoveryCard";
import DiscoveryFullScreen from "./DiscoveryFullScreen";
import {
  getDiscoveryFeed,
  getCategoryFeed,
  getRelatedFeed,
  getSavedDiscovery,
  DISCOVERY_CATEGORIES,
} from "../../services/discovery/discoveryService";
import { recordSignal, getSessionContext } from "../../services/discovery/discoveryPersonalizationModel";
import DiscoveryInterestPrompt from "./DiscoveryInterestPrompt";

// ─── Category display config ──────────────────────────────────────────────────
// Ordered roughly by engagement/addictiveness
const ORDERED_CATEGORIES = [
  "All", "Saved",
  "Horror & Strange", "Bioluminescence", "Deep Sea", "Aurora",
  "Volcano", "Predator", "Cyclone", "Wildlife", "Birds", "Caves",
  "Space & Earth", "Fungi", "Night Nature", "Storms", "Abandoned",
  "Macro Wildlife", "Mountains", "Aerial Earth", "Ocean", "Jungle",
  "Extreme Nature", "Survival", "Desert", "Waterfalls", "Snow",
  "Rain", "Relaxation",
];

const CAT_EMOJI = {
  "Horror & Strange":  "👁️",
  "Bioluminescence":   "✨",
  "Deep Sea":          "🦑",
  "Aurora":            "🌌",
  "Volcano":           "🌋",
  "Predator":          "🦅",
  "Cyclone":           "🌀",
  "Wildlife":          "🦁",
  "Birds":             "🐦",
  "Caves":             "🦇",
  "Space & Earth":     "🌍",
  "Fungi":             "🍄",
  "Night Nature":      "🌙",
  "Storms":            "⚡",
  "Abandoned":         "🏚️",
  "Macro Wildlife":    "🔬",
  "Mountains":         "⛰️",
  "Aerial Earth":      "🛸",
  "Ocean":             "🌊",
  "Jungle":            "🌿",
  "Extreme Nature":    "💥",
  "Survival":          "🔥",
  "Desert":            "🏜️",
  "Waterfalls":        "💧",
  "Snow":              "❄️",
  "Rain":              "🌧️",
  "Relaxation":        "😌",
};

// ─── Autoplay hook — IntersectionObserver ─────────────────────────────────────
function useAutoplay(containerRef, itemCount) {
  const [visibleId, setVisibleId] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const io = new IntersectionObserver(entries => {
      let best = null, bestRatio = 0;
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best      = e.target.dataset.dcid || null;
        }
      }
      if (best !== null) setVisibleId(best);
    }, { threshold: [0.3, 0.5, 0.7] });

    const cards = containerRef.current.querySelectorAll("[data-dcid]");
    cards.forEach(c => io.observe(c));
    return () => io.disconnect();
  }); // intentionally re-runs after render to pick up new cards

  return visibleId;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="dt-skel-card" aria-hidden>
    <div className="dt-skel-media" />
    <div className="dt-skel-lines">
      <div className="dt-skel-line" style={{ width:"70%" }} />
      <div className="dt-skel-line" style={{ width:"50%",opacity:.5 }} />
    </div>
  </div>
);

// ─── Category pill ────────────────────────────────────────────────────────────
const CatPill = React.memo(({ cat, active, onClick }) => (
  <button className={`dt-cat${active ? " dt-cat--active" : ""}`} onClick={() => onClick(cat)}>
    {cat === "Saved"
      ? <Bookmark size={12} />
      : <span className="dt-cat-emoji">{CAT_EMOJI[cat] || "🎬"}</span>}
    {cat}
  </button>
));
CatPill.displayName = "CatPill";

// ═══════════════════════════════════════════════════════════════════════════════
// DiscoveryTab
// ═══════════════════════════════════════════════════════════════════════════════
const DiscoveryTab = React.forwardRef(function DiscoveryTab(
  { currentUser, isActive, initialCategory = "All" },
  _ref,
) {
  const [items,          setItems]          = useState([]);
  const [relatedItems,   setRelatedItems]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [hasMore,        setHasMore]        = useState(true);
  const [activeCategory, setActiveCategory] = useState(initialCategory || "All");
  const [error,          setError]          = useState(null);
  const [fullScreenItem, setFullScreenItem] = useState(null);
  const [fullScreenIdx,  setFullScreenIdx]  = useState(0);
  const [savedItems,     setSavedItems]     = useState(() => getSavedDiscovery());
  const [lastWatched,    setLastWatched]    = useState(null);
  const [showRelated,    setShowRelated]    = useState(false);
  const [promptItem,     setPromptItem]     = useState(null);

  const containerRef  = useRef(null);
  const sentinelRef   = useRef(null);
  const catScrollRef  = useRef(null);
  const fetchedOnce   = useRef(false);
  const pageRef       = useRef(1);
  const mountedRef    = useRef(true);

  const visibleId = useAutoplay(containerRef, items.length);

  // Track last watched for related feed
  useEffect(() => {
    if (!visibleId) return;
    const it = items.find(i => i.id === visibleId);
    if (it) setLastWatched(it);
  }, [visibleId, items]);

  // Listen for save events (update saved panel)
  useEffect(() => {
    const onSave = () => setSavedItems(getSavedDiscovery());
    window.addEventListener("xv:discoverySaved", onSave);
    return () => window.removeEventListener("xv:discoverySaved", onSave);
  }, []);

  // Listen for user interest events from cards (show bottom prompt)
  useEffect(() => {
    const onInterest = (e) => {
      try {
        const it = e?.detail?.item;
        if (it && mountedRef.current) setPromptItem(it);
      } catch {}
    };
    window.addEventListener("xv:discoveryInterest", onInterest);
    return () => window.removeEventListener("xv:discoveryInterest", onInterest);
  }, []);

  // Initial load
  useEffect(() => {
    if (!fetchedOnce.current) { fetchedOnce.current = true; loadFeed(true); }
  }, []); // eslint-disable-line

  // Category switch
  useEffect(() => {
    if (fetchedOnce.current) {
      setItems([]); setRelatedItems([]); setHasMore(true);
      setError(null); setShowRelated(false);
      pageRef.current = 1;
      loadFeed(true);
    }
  }, [activeCategory]); // eslint-disable-line

  // Update category when discovery navigation requests a specific filter
  useEffect(() => {
    if (!initialCategory || initialCategory === activeCategory) return;
    setActiveCategory(initialCategory);
    setItems([]); setRelatedItems([]); setHasMore(true);
    setError(null); setShowRelated(false);
    pageRef.current = 1;
    loadFeed(true);
  }, [initialCategory]); // eslint-disable-line

  // Related feed — load after user watches a clip
  useEffect(() => {
    if (!lastWatched || activeCategory !== "All") return;
    const t = setTimeout(async () => {
      try {
        const rel = await getRelatedFeed(lastWatched, 10);
        if (!mountedRef.current) return;
        const existIds = new Set(items.map(i => i.id));
        const filtered = rel.filter(i => !existIds.has(i.id));
        if (filtered.length > 0) {
          setRelatedItems(filtered);
          setShowRelated(true);
        }
      } catch {}
    }, 8000); // load related after 8s of watching
    return () => clearTimeout(t);
  }, [lastWatched]); // eslint-disable-line

  const loadFeed = useCallback(async (reset = false) => {
    if (activeCategory === "Saved") {
      setItems(getSavedDiscovery());
      setLoading(false); setHasMore(false);
      return;
    }

    reset ? setLoading(true) : setLoadingMore(true);
    setError(null);

    const page  = reset ? 1 : pageRef.current;
    const limit = 12;

    try {
      let data;
      if (activeCategory === "All") {
        data = await getDiscoveryFeed({ limit, page });
      } else {
        data = await getCategoryFeed(activeCategory, limit, page);
      }

      if (!mountedRef.current) return;

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
        setHasMore(data.length >= limit);
        pageRef.current = page + 1;
      }
    } catch (e) {
      if (mountedRef.current) setError(e?.message || "Failed to load Discovery");
    } finally {
      if (mountedRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [activeCategory]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || activeCategory === "Saved") return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loadingMore && !loading) loadFeed(false);
    }, { rootMargin: "1000px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, loadFeed, activeCategory]);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const handleCategoryClick = useCallback(cat => {
    setActiveCategory(cat);
    setShowRelated(false);
  }, []);

  const handleOpenFullScreen = useCallback(item => {
    const displayItems = activeCategory === "Saved" ? savedItems : items;
    const idx = displayItems.findIndex(i => i.id === item.id);
    setFullScreenIdx(idx >= 0 ? idx : 0);
    setFullScreenItem(item);
  }, [items, savedItems, activeCategory]);

  const displayItems = activeCategory === "Saved" ? savedItems : items;

  const handleFullScreenNext = useCallback(() => {
    const pool = activeCategory === "Saved" ? savedItems : items;
    const next = Math.min(fullScreenIdx + 1, pool.length - 1);
    setFullScreenIdx(next); setFullScreenItem(pool[next]);
  }, [fullScreenIdx, items, savedItems, activeCategory]);

  const handleFullScreenPrev = useCallback(() => {
    const pool = activeCategory === "Saved" ? savedItems : items;
    const prev = Math.max(fullScreenIdx - 1, 0);
    setFullScreenIdx(prev); setFullScreenItem(pool[prev]);
  }, [fullScreenIdx, items, savedItems, activeCategory]);

  const handleRefresh = useCallback(() => {
    setItems([]); setRelatedItems([]); setHasMore(true);
    setError(null); setShowRelated(false);
    pageRef.current = 1;
    loadFeed(true);
  }, [loadFeed]);

  const scrollCats = (dir) => {
    catScrollRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  // Session context pill
  const ctx = useMemo(() => getSessionContext(), []);
  const moodHint = ctx.isNight ? "🌙 Night Mode" : ctx.isMorning ? "🌅 Morning Mix" : null;

  return (
    <div className="dt-root">
      {/* Header */}
      <div className="dt-header">
        <div className="dt-header-l">
          <div className="dt-header-icon"><Compass size={16} /></div>
          <div>
            <div className="dt-header-title">
              Discovery
              {moodHint && <span className="dt-mood-hint">{moodHint}</span>}
            </div>
            <div className="dt-header-sub">Nature · Wildlife · The Unexplained</div>
          </div>
        </div>
        <button
          className={`dt-refresh${loading ? " dt-refresh--spin" : ""}`}
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Category filter bar */}
      <div className="dt-cats-wrap">
        <button className="dt-cats-arr" onClick={() => scrollCats(-1)} aria-label="Scroll left">
          <ChevronLeft size={14} />
        </button>
        <div className="dt-cats" ref={catScrollRef}>
          {ORDERED_CATEGORIES.map(cat => (
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

      {/* Saved empty state */}
      {activeCategory === "Saved" && savedItems.length === 0 && (
        <div className="dt-saved-empty">
          <Bookmark size={32} style={{ opacity:.2 }} />
          <p>No saved clips yet</p>
          <span>Silver, Gold or Diamond plan members can save any clip to watch again</span>
        </div>
      )}

      {/* Feed */}
      {loading && !displayItems.length ? (
        <div className="dt-skels">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error && !displayItems.length ? (
        <div className="dt-error">
          <Compass size={28} style={{ opacity:.2,marginBottom:12 }} />
          <p>Could not load Discovery content.</p>
          <button onClick={handleRefresh} className="dt-retry">Try again</button>
        </div>
      ) : (
        <div className="dt-feed" ref={containerRef}>
          {displayItems.map(item => (
            <div key={item.id} data-dcid={item.id} className="dt-card-wrapper">
              <DiscoveryCard
                item={item}
                isVisible={isActive && visibleId === item.id}
                onOpenDiscovery={handleCategoryClick}
                onOpenFullScreen={handleOpenFullScreen}
                currentUser={currentUser}
              />
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height:4 }} aria-hidden />

          {loadingMore && (
            <div className="dt-loading-more">
              <div className="dt-spin" />
              More discoveries loading…
            </div>
          )}

          {!hasMore && displayItems.length > 0 && activeCategory !== "Saved" && (
            <div className="dt-end">
              <Compass size={18} style={{ opacity:.25 }} />
              <span>You've explored this region</span>
            </div>
          )}

          {/* Related feed section */}
          {showRelated && relatedItems.length > 0 && activeCategory === "All" && (
            <>
              <div className="dt-related-header">
                <TrendingUp size={14} />
                <span>More like what you watched</span>
              </div>
              {relatedItems.map(item => (
                <div key={`rel_${item.id}`} data-dcid={`rel_${item.id}`} className="dt-card-wrapper">
                  <DiscoveryCard
                    item={item}
                    isVisible={isActive && visibleId === `rel_${item.id}`}
                    onOpenDiscovery={handleCategoryClick}
                    onOpenFullScreen={handleOpenFullScreen}
                    currentUser={currentUser}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Full-screen overlay */}
      {promptItem && (
        <DiscoveryInterestPrompt
          item={promptItem}
          onClose={() => setPromptItem(null)}
        />
      )}

      {fullScreenItem && (
        <DiscoveryFullScreen
          item={fullScreenItem}
          currentUser={currentUser}
          onClose={() => setFullScreenItem(null)}
          onNext={fullScreenIdx < displayItems.length - 1 ? handleFullScreenNext : null}
          onPrev={fullScreenIdx > 0 ? handleFullScreenPrev : null}
        />
      )}

      <style>{DT_CSS}</style>
    </div>
  );
});

DiscoveryTab.displayName = "DiscoveryTab";
export default DiscoveryTab;

const DT_CSS = `
@keyframes dtSpin{to{transform:rotate(360deg)}}
@keyframes dtSkelPulse{0%,100%{opacity:.6}50%{opacity:.18}}

.dt-root{width:100%;padding-bottom:24px;}

.dt-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 16px 8px;
}
.dt-header-l{display:flex;align-items:center;gap:10px;}
.dt-header-icon{
  width:36px;height:36px;border-radius:10px;
  background:linear-gradient(135deg,#84cc16,#22d3ee);
  display:flex;align-items:center;justify-content:center;
  color:#000;flex-shrink:0;box-shadow:0 4px 16px rgba(132,204,22,0.28);
}
.dt-header-title{
  font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);
  display:flex;align-items:center;gap:8px;
}
.dt-mood-hint{
  font-size:10px;font-weight:700;
  background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.1);
  padding:2px 8px;border-radius:10px;
  color:rgba(255,255,255,0.45);
}
.dt-header-sub{font-size:11px;color:rgba(255,255,255,0.32);margin-top:2px;}

.dt-refresh{
  width:32px;height:32px;border-radius:8px;
  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
  color:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s;
}
.dt-refresh:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);}
.dt-refresh:disabled{opacity:.4;cursor:default;}
.dt-refresh--spin svg{animation:dtSpin 1s linear infinite;}

.dt-cats-wrap{display:flex;align-items:center;gap:4px;padding:0 8px 12px;}
.dt-cats-arr{
  width:26px;height:26px;border-radius:7px;flex-shrink:0;
  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
  color:rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s;
}
.dt-cats-arr:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.6);}
.dt-cats{
  display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;
  -webkit-overflow-scrolling:touch;flex:1;padding:2px;
}
.dt-cats::-webkit-scrollbar{display:none;}
.dt-cat{
  display:inline-flex;align-items:center;gap:5px;padding:6px 12px;
  border-radius:20px;font-size:11.5px;font-weight:700;white-space:nowrap;
  cursor:pointer;background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.07);
  color:rgba(255,255,255,0.45);transition:all .18s;
  font-family:inherit;flex-shrink:0;
}
.dt-cat-emoji{font-size:13px;line-height:1;}
.dt-cat:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);}
.dt-cat--active{background:rgba(132,204,22,0.12);border-color:rgba(132,204,22,0.38);color:#a3e635;}

.dt-feed{padding:0 12px;display:flex;flex-direction:column;gap:4px;}
@media(max-width:768px){.dt-feed{padding:0 8px;}}
.dt-card-wrapper{width:100%;}

.dt-skels{padding:12px;display:flex;flex-direction:column;gap:10px;}
.dt-skel-card{width:100%;border-radius:18px;overflow:hidden;background:rgba(255,255,255,0.03);}
.dt-skel-media{
  width:100%;aspect-ratio:9/14;
  background:rgba(255,255,255,0.055);
  animation:dtSkelPulse 1.5s ease-in-out infinite;
}
@media(max-width:768px){.dt-skel-media{aspect-ratio:9/16;}}
.dt-skel-lines{padding:12px 14px;display:flex;flex-direction:column;gap:8px;}
.dt-skel-line{
  height:11px;border-radius:6px;
  background:rgba(255,255,255,0.06);
  animation:dtSkelPulse 1.5s ease-in-out infinite;
}

.dt-error{
  padding:48px 20px;text-align:center;
  color:rgba(255,255,255,0.35);font-size:14px;
  display:flex;flex-direction:column;align-items:center;gap:8px;
}
.dt-retry{
  margin-top:8px;padding:8px 22px;border-radius:20px;
  background:rgba(132,204,22,0.12);border:1px solid rgba(132,204,22,0.3);
  color:#84cc16;font-size:13px;font-weight:700;
  cursor:pointer;font-family:inherit;transition:background .15s;
}
.dt-retry:hover{background:rgba(132,204,22,0.2);}

.dt-loading-more{
  display:flex;align-items:center;justify-content:center;gap:8px;
  padding:20px;color:rgba(255,255,255,0.3);font-size:12px;
}
.dt-spin{
  width:16px;height:16px;border:2px solid rgba(255,255,255,0.08);
  border-top-color:rgba(132,204,22,0.6);border-radius:50%;
  animation:dtSpin .8s linear infinite;
}
.dt-end{
  display:flex;align-items:center;justify-content:center;gap:8px;
  padding:24px;color:rgba(255,255,255,0.2);
  font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
}

.dt-saved-empty{
  padding:60px 20px;text-align:center;color:rgba(255,255,255,0.3);
  display:flex;flex-direction:column;align-items:center;gap:12px;
}
.dt-saved-empty p{font-size:15px;font-weight:700;color:rgba(255,255,255,0.5);margin:0;}
.dt-saved-empty span{font-size:12px;color:rgba(255,255,255,0.22);max-width:260px;line-height:1.6;}

.dt-related-header{
  display:flex;align-items:center;gap:8px;
  padding:16px 0 12px;
  color:rgba(255,255,255,0.5);font-size:12px;font-weight:700;
  letter-spacing:.04em;text-transform:uppercase;
}
.dt-related-header svg{color:rgba(132,204,22,0.7);}

@media(max-width:768px){
  .dt-cats-arr{display:none;}
}
`;