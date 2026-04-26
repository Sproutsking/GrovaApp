// ============================================================================
// src/components/Home/NewsTab.jsx  — v15  INSTANT + ACCURATE
//
// FIXES:
//  [T1] INSTANT TAB SWITCH — DB results cached in module-level var.
//       Second visit to News tab shows content immediately (no spinner).
//
//  [T2] NO DOUBLE-FIRE — activeFilter effect used to have no guard,
//       firing on mount AND on change. Now it only fires on change (uses
//       a mounted ref to skip the initial render).
//
//  [T3] ACCURATE PENDING COUNT — after DB load, we call engine.seedInFeed()
//       so the engine knows which hashes are already visible. Engine then
//       only counts truly NEW articles in pendingRef, not duplicates.
//
//  [T4] ALWAYS SHOWS — initialDone flips true after DB resolves OR after
//       5s timeout. Feed never stays blank if DB is slow.
//
//  [T5] BANNER SAFE POSITION — measures header bottom after mount, updates
//       on resize. Portal to document.body prevents overflow clipping.
//
//  [T6] BREAKING articles go straight into feed (no banner). Non-urgent
//       queue behind banner. firstBatchRef as useRef (survives re-renders).
// ============================================================================

import React, {
  useState, useEffect, useRef, useCallback,
  useImperativeHandle, useMemo,
} from "react";
import ReactDOM from "react-dom";
import {
  Globe, Bitcoin, MapPin, Newspaper, ArrowUp, RefreshCw, Zap,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import {
  getNewsEngine, TIER, getTier,
  detectLiveStatus, articleKey, filterByAge,
} from "../../services/news/newsRealtime";
import NewsCard from "./NewsCard";
import VideoCard from "./VideoCard";

// ── [T1] Module-level cache — survives tab switches ───────────────────────────
let _cachedArticles  = null;
let _cachedVideos    = [];
let _cacheTimestamp  = 0;
const CACHE_TTL_MS   = 5 * 60_000; // 5 minutes

function getCached() {
  if (_cachedArticles && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    return { articles: _cachedArticles, videos: _cachedVideos };
  }
  return null;
}

function setCache(articles, videos = []) {
  _cachedArticles  = articles;
  _cachedVideos    = videos;
  _cacheTimestamp  = Date.now();
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: null,     label: "All",    Icon: Newspaper },
  { id: "global", label: "Global", Icon: Globe     },
  { id: "africa", label: "Africa", Icon: MapPin    },
  { id: "crypto", label: "Crypto", Icon: Bitcoin   },
];

// ── DB query with cancellation ────────────────────────────────────────────────
function makeDbQuery(category) {
  let cancelled = false;
  const promise = (async () => {
    try {
      let q = supabase
        .from("news_posts")
        .select([
          "id","title","description","image_url","source_name",
          "source_url","article_url","category","region","asset_tag",
          "url_hash","published_at","is_active",
        ].join(","))
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(200);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (cancelled || error) return [];
      return filterByAge(data || []).map((r) => {
        const liveStatus = detectLiveStatus(r.title || "", r.published_at || "");
        return {
          ...r, liveStatus,
          tier: liveStatus === "live" ? TIER.LIVE : getTier(r.published_at),
        };
      });
    } catch { return []; }
  })();
  return { promise, cancel: () => { cancelled = true; } };
}

// ── Merge helpers — url_hash as canonical key ─────────────────────────────────
function mergeArticles(existing, incoming) {
  const map = new Map();
  for (const a of existing) {
    const k = articleKey(a);
    if (k) map.set(k, a);
  }
  for (const a of incoming) {
    const k = articleKey(a);
    if (!k) continue;
    const prev = map.get(k);
    if (!prev || (a.tier ?? TIER.ARCHIVE) <= (prev.tier ?? TIER.ARCHIVE)) {
      map.set(k, a);
    }
  }
  return filterByAge(Array.from(map.values())).sort((a, b) => {
    const ta = a.tier ?? TIER.ARCHIVE, tb = b.tier ?? TIER.ARCHIVE;
    if (ta !== tb) return ta - tb;
    return new Date(b.published_at) - new Date(a.published_at);
  });
}

function mergeVideos(existing, incoming) {
  const map = new Map(existing.map((v) => [v.videoId, v]));
  for (const v of incoming) {
    const prev = map.get(v.videoId);
    if (!prev || v.isLiveBroadcast || (v.tier ?? TIER.ARCHIVE) < (prev.tier ?? TIER.ARCHIVE)) {
      map.set(v.videoId, v);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => {
      const ta = a.tier ?? TIER.RECENT, tb = b.tier ?? TIER.RECENT;
      if (ta !== tb) return ta - tb;
      return new Date(b.published_at) - new Date(a.published_at);
    })
    .slice(0, 100);
}

// ── [T5] New articles banner — portal, measured header position ───────────────
const NewBanner = ({ count, onShow }) => {
  const [topPx, setTopPx] = useState(68);

  useEffect(() => {
    const measure = () => {
      const selectors = [
        ".mobile-header", ".desktop-header", "header",
        ".app-header", ".top-bar", "[class*='Header']", "nav",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const b = el.getBoundingClientRect().bottom;
          if (b > 0) { setTopPx(Math.round(b) + 8); return; }
        }
      }
      setTopPx(68);
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!count) return null;

  return ReactDOM.createPortal(
    <>
      <button className="ntb-pill" style={{ top: topPx }} onClick={onShow}>
        <ArrowUp size={13} />
        {count} new article{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .ntb-pill{
          position:fixed; left:50%; transform:translateX(-50%);
          z-index:9999;
          display:inline-flex; align-items:center; gap:7px;
          padding:9px 22px; border-radius:999px;
          background:rgba(37,99,235,0.97);
          border:1px solid rgba(255,255,255,0.22);
          color:#fff; font-size:13px; font-weight:700;
          cursor:pointer; white-space:nowrap; font-family:inherit;
          box-shadow:0 6px 30px rgba(37,99,235,0.5);
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
          animation:ntbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .ntb-pill:hover{background:rgba(29,78,216,1);transform:translateX(-50%) scale(1.04);}
        .ntb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes ntbIn{
          from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
        }
      `}</style>
    </>,
    document.body,
  );
};

// ── ScrollFAB ─────────────────────────────────────────────────────────────────
const ScrollFAB = () => {
  const [show,  setShow]  = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);

  const getS = useCallback(() => {
    for (const sel of [".main-content-desktop", ".main-content-mobile"]) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  }, []);

  useEffect(() => {
    const upd = () => {
      const el = getS(), top = el ? el.scrollTop : window.scrollY;
      const sh = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120); setAtBot(top + ch >= sh - 120); setShow(top > 300);
    };
    const target = getS() || window;
    target.addEventListener("scroll", upd, { passive: true });
    upd();
    return () => target.removeEventListener("scroll", upd);
  }, [getS]);

  const go = (dir) => {
    const el = getS();
    const t  = dir === "top" ? 0 : el ? el.scrollHeight : document.documentElement.scrollHeight;
    if (el) el.scrollTo({ top: t, behavior: "smooth" });
    else    window.scrollTo({ top: t, behavior: "smooth" });
  };

  if (!show) return null;
  return (
    <>
      <div className="ntfab-pill">
        <button className={`ntfab-btn${atTop ? " ntfab-dim" : ""}`}
          onClick={() => !atTop && go("top")} disabled={atTop}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <div className="ntfab-sep" />
        <button className={`ntfab-btn${atBot ? " ntfab-dim" : ""}`}
          onClick={() => !atBot && go("bottom")} disabled={atBot}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <style>{`
        .ntfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(59,130,246,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:ntfabIn .25s cubic-bezier(0.34,1.2,0.64,1) both;}
        @keyframes ntfabIn{from{opacity:0;transform:translateY(-50%) scale(0.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}
        .ntfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#60a5fa;cursor:pointer;transition:background .15s,transform .1s;padding:0;}
        .ntfab-btn:not(.ntfab-dim):hover{background:rgba(59,130,246,0.12);transform:scale(1.1);}
        .ntfab-btn.ntfab-dim{color:rgba(255,255,255,0.15);cursor:default;}
        .ntfab-sep{width:22px;height:1px;background:rgba(59,130,246,0.12);}
        @media(max-width:768px){.ntfab-pill{right:10px;}}
      `}</style>
    </>
  );
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null), cool = useRef(false);
  useEffect(() => {
    if (!ref.current || disabled) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !cool.current) {
        cool.current = true; onVisible();
        setTimeout(() => { cool.current = false; }, 2000);
      }
    }, { rootMargin: "500px", threshold: 0 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);
  return <div ref={ref} style={{ height: 4 }} aria-hidden="true" />;
};

const LoadingMore = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"24px 16px", color:"rgba(255,255,255,0.32)", fontSize:13, fontWeight:600 }}>
    <div style={{ width:17, height:17, border:"2px solid rgba(59,130,246,0.18)", borderTopColor:"#60a5fa", borderRadius:"50%", animation:"ntSpin .8s linear infinite" }} />
    Loading more…
    <style>{`@keyframes ntSpin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const EndOfFeed = () => (
  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"28px 20px", color:"rgba(255,255,255,0.18)", fontSize:12, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" }}>
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
    You're all caught up
    <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
  </div>
);

const SkeletonCard = ({ tall }) => (
  <div style={{ margin:"0 0 6px", background:"rgba(255,255,255,0.025)", overflow:"hidden", borderRadius:4 }}>
    <div style={{ height:tall ? 240 : 210, background:"rgba(255,255,255,0.055)", animation:"ntSkel 1.4s ease-in-out infinite" }} />
    <div style={{ padding:"12px 14px" }}>
      <div style={{ height:13, borderRadius:7, background:"rgba(255,255,255,0.055)", marginBottom:8, width:"82%", animation:"ntSkel 1.4s ease-in-out infinite" }} />
      <div style={{ height:11, borderRadius:6, background:"rgba(255,255,255,0.035)", width:"55%", animation:"ntSkel 1.4s ease-in-out infinite" }} />
    </div>
    <style>{`@keyframes ntSkel{0%,100%{opacity:.55}50%{opacity:.18}}`}</style>
  </div>
);

const BreakingWrapper = ({ post, currentUser }) => (
  <div style={{ marginBottom: 6 }}>
    <div className="ntbrk-bar">
      <Zap size={11} /> BREAKING NEWS
      <span className="ntbrk-src">{post.source_name}</span>
    </div>
    <NewsCard post={post} currentUser={currentUser} />
    <style>{`
      .ntbrk-bar{display:flex;align-items:center;gap:6px;padding:5px 14px;background:rgba(239,68,68,0.12);border-bottom:1px solid rgba(239,68,68,0.2);font-size:10px;font-weight:900;color:#f87171;letter-spacing:.08em;animation:ntbrkP 2s ease-in-out infinite;}
      @keyframes ntbrkP{0%,100%{background:rgba(239,68,68,0.12)}50%{background:rgba(239,68,68,0.22)}}
      .ntbrk-src{margin-left:auto;font-size:9px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0;}
    `}</style>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// NewsTab
// ══════════════════════════════════════════════════════════════════════════════
const NewsTab = React.forwardRef(function NewsTab(
  {
    newsPosts: initialNews = [],
    hasMore       = false,
    isLoadingMore = false,
    onLoadMore,
    currentUser,
  },
  ref,
) {
  // [T1] Start from cache if available — instant render on tab switch
  const cached = getCached();
  const [articles,     setArticles]     = useState(() => {
    if (cached) return cached.articles;
    return filterByAge(initialNews.map((a) => ({
      ...a,
      liveStatus: detectLiveStatus(a.title || "", a.published_at || ""),
      tier: getTier(a.published_at),
    })));
  });
  const [videos,       setVideos]       = useState(() => cached?.videos || []);
  const [activeFilter, setActiveFilter] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [fetching,     setFetching]     = useState(!cached);
  const [initialDone,  setInitialDone]  = useState(!!cached || initialNews.length > 0);

  // Refs — all survive re-renders
  const firstBatchRef   = useRef(false);
  const pendingRef      = useRef([]);    // queued non-urgent articles
  const cancelDbRef     = useRef(null);
  const filterMountRef  = useRef(false); // [T2] skip initial filter effect fire

  useImperativeHandle(ref, () => ({
    prependNews: (items) =>
      setArticles((prev) => mergeArticles(prev, items.map((a) => ({
        ...a,
        liveStatus: detectLiveStatus(a.title || "", a.published_at || ""),
        tier: getTier(a.published_at),
      })))),
  }));

  // ── [T1] Cold start — DB load, skip if cache is fresh ─────────────────────
  useEffect(() => {
    if (getCached()) {
      // Already have fresh data — just start engine, don't re-fetch DB
      setInitialDone(true);
      setFetching(false);
      return;
    }

    setFetching(true);
    const { promise, cancel } = makeDbQuery(null);
    cancelDbRef.current = cancel;

    promise.then((data) => {
      setFetching(false);
      setInitialDone(true);
      if (data.length) {
        const engine = getNewsEngine();
        engine.seedSeen(data, []);
        engine.seedInFeed(data);    // [T3] accurate pending count
        setArticles(data);
        setCache(data, []);
      }
    });

    return () => cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start engine + wire events ───────────────────────────────────────────────
  useEffect(() => {
    const engine = getNewsEngine();
    engine.start();

    // [T4] Safety — show content after 5s even if DB is empty
    const initTimer = setTimeout(() => setInitialDone(true), 5_000);

    const unsubArt = engine.on("newArticles", (items) => {
      setInitialDone(true);

      const filtered = activeFilter
        ? items.filter((a) => (a.category || "").toLowerCase() === activeFilter)
        : items;
      if (!filtered.length) return;

      // BREAKING + LIVE → always straight into feed
      const urgent    = filtered.filter((a) => (a.tier ?? TIER.RECENT) <= TIER.BREAKING);
      const nonUrgent = filtered.filter((a) => (a.tier ?? TIER.RECENT) > TIER.BREAKING);

      if (urgent.length) {
        engine.markInFeed(urgent);
        setArticles((prev) => {
          const merged = mergeArticles(prev, urgent);
          setCache(merged, _cachedVideos);
          return merged;
        });
      }

      if (!firstBatchRef.current) {
        // [T6] First engine batch fills feed directly (no banner)
        firstBatchRef.current = true;
        if (nonUrgent.length) {
          engine.markInFeed(nonUrgent);
          setArticles((prev) => {
            const merged = mergeArticles(prev, nonUrgent);
            setCache(merged, _cachedVideos);
            return merged;
          });
        }
      } else {
        // [T3] Only count articles truly new to the feed
        const trulyNew = nonUrgent.filter((a) => engine.isNewForFeed(a.url_hash || a.id || ""));
        if (trulyNew.length) {
          pendingRef.current = [...trulyNew, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
        }
      }
    });

    const unsubVid = engine.on("newVideos", (items) => {
      setVideos((prev) => {
        const merged = mergeVideos(prev, items);
        setCache(_cachedArticles || [], merged);
        return merged;
      });
    });

    const unsubLive = engine.on("liveDetected", (streams) => {
      setVideos((prev) => {
        const merged = mergeVideos(prev, streams);
        setCache(_cachedArticles || [], merged);
        return merged;
      });
    });

    return () => {
      unsubArt(); unsubVid(); unsubLive();
      clearTimeout(initTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── [T2] Reload on filter change — skip initial mount fire ────────────────
  useEffect(() => {
    if (!filterMountRef.current) {
      filterMountRef.current = true;
      return;
    }
    if (cancelDbRef.current) cancelDbRef.current();
    setFetching(true);
    const { promise, cancel } = makeDbQuery(activeFilter);
    cancelDbRef.current = cancel;
    promise.then((data) => {
      setFetching(false);
      if (data.length) setArticles(data);
    });
    return () => cancel();
  }, [activeFilter]);

  // ── Flush pending ─────────────────────────────────────────────────────────
  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = [];
    setPendingCount(0);
    const engine = getNewsEngine();
    engine.markInFeed(toAdd);
    setArticles((prev) => {
      const merged = mergeArticles(prev, toAdd);
      setCache(merged, _cachedVideos);
      return merged;
    });
    const s = document.querySelector(".main-content-desktop, .main-content-mobile");
    if (s) s.scrollTo({ top: 0, behavior: "smooth" });
    else   window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (fetching) return;
    setFetching(true);
    pendingRef.current  = [];
    setPendingCount(0);
    firstBatchRef.current = false;
    _cachedArticles = null; // bust cache

    if (cancelDbRef.current) cancelDbRef.current();
    const { promise, cancel } = makeDbQuery(activeFilter);
    cancelDbRef.current = cancel;

    const engine = getNewsEngine();
    engine._fetchAllSources?.();
    engine._fetchAllVideos?.();

    const data = await promise;
    if (data.length) {
      engine.seedInFeed(data);
      setArticles(data);
      setCache(data, _cachedVideos);
    }
    setFetching(false);
  }, [fetching, activeFilter]);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  // ── Build tier-ordered feed ───────────────────────────────────────────────
  const feed = useMemo(() => {
    const cat    = activeFilter;
    const fArt   = cat ? articles.filter((a) => (a.category || "").toLowerCase() === cat) : articles;
    const fVid   = cat ? videos.filter((v) => v.category === cat) : videos;

    const liveVid    = fVid.filter((v) => v.isLiveBroadcast || v.tier === TIER.LIVE);
    const regularVid = fVid.filter((v) => !v.isLiveBroadcast && v.tier !== TIER.LIVE);
    const breaking   = fArt.filter((a) => a.tier === TIER.BREAKING);
    const fresh      = fArt.filter((a) => a.tier === TIER.FRESH);
    const rest       = fArt.filter((a) => a.tier >= TIER.RECENT);

    const result = [...liveVid, ...breaking, ...fresh];
    let vi = 0;
    for (let i = 0; i < rest.length; i++) {
      if (i % 4 === 0 && vi < regularVid.length) { result.push(regularVid[vi]); vi++; }
      result.push(rest[i]);
    }
    while (vi < regularVid.length && vi < 8) { result.push(regularVid[vi]); vi++; }
    return result;
  }, [articles, videos, activeFilter]);

  const allFeedVideos = useMemo(() => feed.filter((f) => f._type === "video"), [feed]);

  return (
    <div className="nt-root">
      <NewBanner count={pendingCount} onShow={flushPending} />

      <div className="nt-bar">
        {CATEGORIES.map(({ id, label, Icon }) => (
          <button key={String(id)}
            className={`nt-chip${activeFilter === id ? " nt-chip--on" : ""}`}
            onClick={() => setActiveFilter(id)}>
            <Icon size={11} />{label}
          </button>
        ))}
        <button className={`nt-ref${fetching ? " nt-ref--spin" : ""}`}
          onClick={handleRefresh} disabled={fetching} title="Refresh">
          <RefreshCw size={13} />
        </button>
        {fetching && <span className="nt-dot" />}
      </div>

      {!initialDone && [1,2,3,4].map((i) => <SkeletonCard key={i} tall={i % 2 === 0} />)}

      {initialDone && feed.map((item) => {
        if (item._type === "video") {
          return (
            <div key={item.videoId} style={{ marginBottom: 6 }}>
              <VideoCard video={item} allVideos={allFeedVideos} />
            </div>
          );
        }
        if (item.tier === TIER.BREAKING) {
          return <BreakingWrapper key={articleKey(item)} post={item} currentUser={currentUser} />;
        }
        return (
          <div key={articleKey(item)} style={{ marginBottom: 6 }}>
            <NewsCard post={item} currentUser={currentUser} />
          </div>
        );
      })}

      {initialDone && feed.length === 0 && (
        <div style={{ padding:"48px 20px", textAlign:"center" }}>
          <Newspaper size={36} style={{ opacity:0.15, marginBottom:12, color:"#fff" }} />
          <p style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.3)", margin:"0 0 14px" }}>
            No {activeFilter ? activeFilter + " " : ""}news yet.
          </p>
          <button onClick={handleRefresh} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:999, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.25)", color:"#60a5fa", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      )}

      <ScrollSentinel onVisible={handleSentinel} disabled={!hasMore || isLoadingMore} />
      {isLoadingMore && <LoadingMore />}
      {!hasMore && feed.length > 0 && <EndOfFeed />}
      <ScrollFAB />

      <style>{NT_CSS}</style>
    </div>
  );
});

const NT_CSS = `
.nt-root{width:100%;}
.nt-bar{display:flex;align-items:center;gap:7px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);overflow-x:auto;scrollbar-width:none;position:sticky;top:0;z-index:50;background:rgba(8,8,8,0.98);backdrop-filter:blur(16px);}
.nt-bar::-webkit-scrollbar{display:none;}
.nt-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.4);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .18s;flex-shrink:0;}
.nt-chip:hover{background:rgba(59,130,246,0.08);border-color:rgba(59,130,246,0.24);color:#60a5fa;}
.nt-chip--on{background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.34);color:#60a5fa;box-shadow:0 0 12px rgba(59,130,246,0.1);}
.nt-ref{margin-left:auto;flex-shrink:0;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.32);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.nt-ref:hover{background:rgba(59,130,246,0.1);color:#60a5fa;border-color:rgba(59,130,246,0.24);}
.nt-ref:disabled{cursor:default;}
@keyframes ntRS{to{transform:rotate(360deg)}}
.nt-ref--spin svg{animation:ntRS .8s linear infinite;}
.nt-dot{width:6px;height:6px;border-radius:50%;background:#60a5fa;flex-shrink:0;animation:ntDP 1s ease-in-out infinite;}
@keyframes ntDP{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.28;transform:scale(.55)}}
`;

export default NewsTab;