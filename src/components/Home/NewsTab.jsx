// ============================================================================
// src/components/Home/NewsTab.jsx  — v12  ALL ARTICLES RENDER
//
// ROOT CAUSE FIX: mergeArticles keys EXCLUSIVELY on url_hash.
// Every DB row has url_hash (UNIQUE). Every RSS item has url_hash.
// Perfect dedup, no loss, all articles render.
//
// SPACING: 6px marginBottom on every card wrapper.
// LIVE: detectLiveStatus() — "live" | "ended" | "none".
// RETENTION: filterByAge() — MAX_AGE_DAYS (3 days) client-side.
// ScrollFAB: identical to PostTab.
// ============================================================================

import React, {
  useState, useEffect, useRef, useCallback, useImperativeHandle,
} from "react";
import {
  Globe, Bitcoin, MapPin, Newspaper, ArrowUp, RefreshCw, Zap,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import {
  getNewsEngine, LIVE_CHANNELS, TIER, getTier,
  detectLiveStatus, articleKey, filterByAge,
} from "../../services/news/newsRealtime";
import NewsCard from "./NewsCard";
import VideoCard from "./VideoCard";

const CATEGORIES = [
  { id: null,     label: "All",    Icon: Newspaper },
  { id: "global", label: "Global", Icon: Globe     },
  { id: "africa", label: "Africa", Icon: MapPin    },
  { id: "crypto", label: "Crypto", Icon: Bitcoin   },
];

// ── Safe DB load — no is_video filter (column doesn't exist in schema) ────────
async function loadFromDB(category) {
  try {
    let q = supabase
      .from("news_posts")
      .select("id, title, description, image_url, source_name, source_url, article_url, category, region, asset_tag, url_hash, published_at, is_active")
      .eq("is_active", true)
      .order("published_at", { ascending: false })
      .limit(200);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) { console.warn("[NewsTab] DB:", error.message); return []; }
    return filterByAge(data || []).map((r) => {
      const liveStatus = detectLiveStatus(r.title || "", r.published_at || "");
      return { ...r, liveStatus, tier: liveStatus === "live" ? TIER.LIVE : getTier(r.published_at) };
    });
  } catch (e) {
    console.warn("[NewsTab] loadFromDB:", e);
    return [];
  }
}

// ── Merge by url_hash — canonical key for both DB rows and RSS items ──────────
function mergeArticles(existing, incoming) {
  const map = new Map();
  for (const a of existing) {
    const k = articleKey(a); if (k) map.set(k, a);
  }
  for (const a of incoming) {
    const k = articleKey(a); if (!k) continue;
    const prev = map.get(k);
    if (!prev || (a.tier ?? TIER.ARCHIVE) <= (prev.tier ?? TIER.ARCHIVE)) map.set(k, a);
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

// ── ScrollFAB ─────────────────────────────────────────────────────────────────
const ScrollFAB = () => {
  const [show, setShow]   = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);
  const getS = () => {
    for (const sel of [".main-content-desktop", ".main-content-mobile"]) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  };
  useEffect(() => {
    const upd = () => {
      const el = getS(), top = el ? el.scrollTop : window.scrollY;
      const sh = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120); setAtBot(top + ch >= sh - 120); setShow(top > 300);
    };
    const s = getS();
    if (s) s.addEventListener("scroll", upd, { passive: true });
    else   window.addEventListener("scroll", upd, { passive: true });
    upd();
    return () => {
      const s2 = getS();
      if (s2) s2.removeEventListener("scroll", upd);
      else    window.removeEventListener("scroll", upd);
    };
  }, []);
  const go = (dir) => {
    const el = getS();
    const t = dir === "top" ? 0 : el ? el.scrollHeight : document.documentElement.scrollHeight;
    if (el) el.scrollTo({ top: t, behavior: "smooth" });
    else    window.scrollTo({ top: t, behavior: "smooth" });
  };
  if (!show) return null;
  return (
    <>
      <div className="ntsfab-pill">
        <button className={`ntsfab-btn${atTop ? " ntsfab-dim" : ""}`} onClick={() => !atTop && go("top")} disabled={atTop}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
        </button>
        <div className="ntsfab-sep" />
        <button className={`ntsfab-btn${atBot ? " ntsfab-dim" : ""}`} onClick={() => !atBot && go("bottom")} disabled={atBot}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>
      <style>{`
        .ntsfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(59,130,246,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:ntsfabIn .25s cubic-bezier(0.34,1.2,0.64,1) both;}
        @keyframes ntsfabIn{from{opacity:0;transform:translateY(-50%) scale(0.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}
        .ntsfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#60a5fa;cursor:pointer;transition:background .15s,transform .1s;padding:0;}
        .ntsfab-btn:not(.ntsfab-dim):hover{background:rgba(59,130,246,0.12);transform:scale(1.1);}
        .ntsfab-btn.ntsfab-dim{color:rgba(255,255,255,0.15);cursor:default;}
        .ntsfab-sep{width:22px;height:1px;background:rgba(59,130,246,0.12);}
        @media(max-width:768px){.ntsfab-pill{right:10px;}}
      `}</style>
    </>
  );
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null); const cool = useRef(false);
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
  return <div ref={ref} style={{ height: 4, flexShrink: 0 }} aria-hidden="true" />;
};

const LoadingMore = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"24px 16px", color:"rgba(255,255,255,0.32)", fontSize:13, fontWeight:600 }}>
    <div style={{ width:17, height:17, border:"2px solid rgba(59,130,246,0.18)", borderTopColor:"#60a5fa", borderRadius:"50%", animation:"ntSpin .8s linear infinite" }} />
    Loading more…<style>{`@keyframes ntSpin{to{transform:rotate(360deg)}}`}</style>
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

const NewBanner = ({ count, onShow }) => {
  if (!count) return null;
  return (
    <>
      <button className="nt-banner" onClick={onShow}>
        <ArrowUp size={12} /> {count} new article{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .nt-banner{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:8000;display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:999px;background:rgba(59,130,246,0.95);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 4px 24px rgba(59,130,246,0.42);animation:ntBIn .3s cubic-bezier(0.34,1.2,0.64,1) both;font-family:inherit;}
        .nt-banner:hover{background:rgba(37,99,235,1);transform:translateX(-50%) scale(1.04);}
        @keyframes ntBIn{from{opacity:0;transform:translateX(-50%) translateY(-14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>
    </>
  );
};

const BreakingWrapper = ({ post, currentUser }) => (
  <div style={{ marginBottom: 6 }}>
    <div className="ntbrk-bar">
      <Zap size={11} />BREAKING NEWS
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
    hasMore = false,
    isLoadingMore = false,
    onLoadMore,
    currentUser,
  },
  ref,
) {
  const [articles,     setArticles]     = useState(() =>
    filterByAge(initialNews.map((a) => ({
      ...a,
      liveStatus: detectLiveStatus(a.title || "", a.published_at || ""),
      tier: getTier(a.published_at),
    })))
  );
  const [videos,       setVideos]       = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [fetching,     setFetching]     = useState(false);
  const [initialDone,  setInitialDone]  = useState(initialNews.length > 0);
  const pendingRef = useRef([]);

  useImperativeHandle(ref, () => ({
    prependNews: (items) =>
      setArticles((prev) => mergeArticles(prev, items.map((a) => ({
        ...a,
        liveStatus: detectLiveStatus(a.title || "", a.published_at || ""),
        tier: getTier(a.published_at),
      })))),
  }));

  // Cold start
  useEffect(() => {
    (async () => {
      const data = await loadFromDB(null);
      if (data.length) {
        setArticles(data);
        setInitialDone(true);
        getNewsEngine().seedSeen(data, []);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start engine and wire events
  useEffect(() => {
    const engine = getNewsEngine();
    engine.start();
    setFetching(true);
    const initTimer = setTimeout(() => { setInitialDone(true); setFetching(false); }, 4_000);
    let firstBatch = false;

    const unsubArt = engine.on("newArticles", (items) => {
      setInitialDone(true); setFetching(false);
      const filtered = activeFilter
        ? items.filter((a) => (a.category || "").toLowerCase() === activeFilter)
        : items;
      if (!filtered.length) return;
      const urgent    = filtered.filter((a) => (a.tier ?? TIER.RECENT) <= TIER.BREAKING);
      const nonUrgent = filtered.filter((a) => (a.tier ?? TIER.RECENT) > TIER.BREAKING);
      if (urgent.length) setArticles((prev) => mergeArticles(prev, urgent));
      if (!firstBatch) {
        firstBatch = true;
        setArticles((prev) => mergeArticles(prev, nonUrgent));
      } else {
        pendingRef.current = [...nonUrgent, ...pendingRef.current];
        setPendingCount(pendingRef.current.length);
      }
    });

    const unsubVid = engine.on("newVideos", (items) => {
      setVideos((prev) => mergeVideos(prev, items));
    });

    const unsubLive = engine.on("liveDetected", (streams) => {
      setVideos((prev) => mergeVideos(prev, streams));
    });

    // Seed live channels — only show after engine fetches real video IDs
    // No placeholder videos with channel IDs (they produce broken thumbnails)

    return () => {
      unsubArt(); unsubVid(); unsubLive();
      clearTimeout(initTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload on filter change
  useEffect(() => {
    (async () => {
      setFetching(true);
      const data = await loadFromDB(activeFilter);
      if (data.length) setArticles(data);
      setFetching(false);
    })();
  }, [activeFilter]);

  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = []; setPendingCount(0);
    setArticles((prev) => mergeArticles(prev, toAdd));
    const s = document.querySelector(".main-content-desktop") || document.querySelector(".main-content-mobile");
    if (s) s.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleRefresh = useCallback(async () => {
    if (fetching) return;
    setFetching(true);
    pendingRef.current = []; setPendingCount(0);
    const engine = getNewsEngine();
    engine._fetchAllSources();
    engine._fetchAllVideos();
    const data = await loadFromDB(activeFilter);
    if (data.length) setArticles(data);
    setFetching(false);
  }, [fetching, activeFilter]);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  const buildFeed = useCallback(() => {
    const cat    = activeFilter;
    const fArt   = cat ? articles.filter((a) => (a.category || "").toLowerCase() === cat) : articles;
    const fVid   = cat ? videos.filter((v) => v.category === cat) : videos;
    const liveVid    = fVid.filter((v) => v.isLiveBroadcast || v.tier === TIER.LIVE);
    const regularVid = fVid.filter((v) => !v.isLiveBroadcast && v.tier !== TIER.LIVE);
    const breaking = fArt.filter((a) => a.tier === TIER.BREAKING);
    const fresh    = fArt.filter((a) => a.tier === TIER.FRESH);
    const rest     = fArt.filter((a) => a.tier >= TIER.RECENT);
    const feed = [...liveVid, ...breaking, ...fresh];
    let vi = 0;
    for (let i = 0; i < rest.length; i++) {
      if (i % 4 === 0 && vi < regularVid.length) { feed.push(regularVid[vi]); vi++; }
      feed.push(rest[i]);
    }
    while (vi < regularVid.length && vi < 8) { feed.push(regularVid[vi]); vi++; }
    return feed;
  }, [articles, videos, activeFilter]);

  const feed          = buildFeed();
  const allFeedVideos = feed.filter((f) => f._type === "video");

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
          <p style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.3)" }}>
            No {activeFilter ? activeFilter + " " : ""}news yet.
          </p>
          <button onClick={handleRefresh} style={{ marginTop:14, display:"inline-flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:999, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.25)", color:"#60a5fa", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
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