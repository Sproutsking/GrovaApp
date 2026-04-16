// ============================================================================
// src/components/Home/NewsTab.jsx  — v10  LIVE-FIRST ARCHITECTURE
//
// STRUCTURE:
//  [L1] LIVE SECTION — articles published < 20 min ago, sorted A-Z by
//       source_name. Shown as prominent breaking-news cards at the top.
//       Ticks every 15s — when an article ages out of 20-min window it
//       automatically slides down to the LATEST section on next tick.
//  [L2] LATEST SECTION — all articles older than 20 min + all videos,
//       sorted purely by published_at DESC (newest first).
//  [L3] Category filter applies to BOTH sections simultaneously.
//  [L4] Polling every 30s. Realtime INSERT subscription. Visibility refetch.
//  [L5] clearAllCooldowns() on mount + force-fetch. DB pre-load first.
//  [L6] New article banner with count.
//  [L7] useRelTime in live cards ticks every 15s — no immortal timestamps.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import {
  Globe,
  Bitcoin,
  MapPin,
  Newspaper,
  ArrowUp,
  RefreshCw,
  Radio,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import {
  fetchAndStoreNews,
  loadArticlesFromDB,
  clearAllCooldowns,
} from "../../services/news/clientNewsFetcher";
import { useRelTime, isLiveArticle } from "./NewsCard";
import NewsCard from "./NewsCard";
import VideoCard from "./VideoCard";

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: null, label: "All", Icon: Newspaper },
  { id: "global", label: "Global", Icon: Globe },
  { id: "africa", label: "Africa", Icon: MapPin },
  { id: "crypto", label: "Crypto", Icon: Bitcoin },
];

// ── YouTube channels for in-tab video feed ────────────────────────────────────
const YT_CHANNELS = [
  { id: "UCnUYZLuoy1rq1aVMwx4aTzw", name: "BBC News", category: "global" },
  { id: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News", category: "global" },
  { id: "UCNye-wNBqNL5ZzHSJdde7RA", name: "Al Jazeera", category: "global" },
  { id: "UCQfwfsi5VrQ8yKZ-UWmAEFg", name: "France 24", category: "global" },
  { id: "UC7fWeaHhqgM4Ry-RMpM2YYw", name: "TRT World", category: "global" },
  { id: "UC-7dRiGmmKOUkBu-gKVQf2g", name: "Sky News", category: "global" },
  { id: "UCIdojUGDCXFLiGTEMeL5kxQ", name: "CGTN", category: "global" },
  { id: "UCupvZG-5ko_eiXAupbDfxWw", name: "CNN", category: "global" },
  { id: "UCVSNOxehfALut52-3bfvSHg", name: "VOA News", category: "global" },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters", category: "global" },
  { id: "UCJXGnHCHApDirWSmAZ0uxkQ", name: "Arise News", category: "africa" },
  { id: "UCCjyq_K1Pd2QkMOoAc73yqA", name: "Channels TV", category: "africa" },
  { id: "UCG9_Hz8tMHdM5i5EzQpSPaQ", name: "Africa News", category: "africa" },
  { id: "UCrbatV49TNrqfoPLEJqJiuw", name: "CoinDesk TV", category: "crypto" },
  { id: "UCAl9Ld79qaZxp9JzEOwd3aA", name: "Bankless", category: "crypto" },
];

const YT_THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
const YT_CACHE = "nt_yt_v10";
const YT_TTL = 5 * 60_000;

async function fetchAllVideos(bust = false) {
  if (!bust) {
    try {
      const c = JSON.parse(sessionStorage.getItem(YT_CACHE) || "null");
      if (c && Date.now() - c.at < YT_TTL) return c.videos;
    } catch {
      /* ignore */
    }
  }
  const proxies = [
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  const results = await Promise.allSettled(
    YT_CHANNELS.map(async (ch) => {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;
      try {
        const xml = await Promise.any(
          proxies.map(async (makeProxy) => {
            const res = await fetch(makeProxy(feedUrl), {
              signal: AbortSignal.timeout(8_000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get("content-type") || "";
            const txt = ct.includes("json")
              ? (await res.json())?.contents || ""
              : await res.text();
            if (!txt || txt.length < 100) throw new Error("empty");
            return txt;
          }),
        );
        const items = [];
        const seen = new Set();
        const re = /<entry>([\s\S]*?)<\/entry>/gi;
        let m;
        while ((m = re.exec(xml)) !== null) {
          const blk = m[1];
          const vidId = (
            blk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || ""
          ).trim();
          if (!vidId || seen.has(vidId)) continue;
          seen.add(vidId);
          const raw =
            blk.match(
              /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
            )?.[1] || "";
          const title = raw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
          if (!title) continue;
          const pub = blk.match(/<published>([^<]+)<\/published>/i)?.[1] || "";
          const ms = pub ? new Date(pub).getTime() : Date.now();
          if (Date.now() - ms > 14 * 86_400_000) continue;
          items.push({
            _type: "video",
            id: `yt_${vidId}`,
            videoId: vidId,
            title,
            channelName: ch.name,
            category: ch.category,
            thumbnail: YT_THUMB(vidId),
            image_url: YT_THUMB(vidId),
            published_at: pub
              ? new Date(pub).toISOString()
              : new Date().toISOString(),
          });
          if (items.length >= 6) break;
        }
        return items;
      } catch {
        return [];
      }
    }),
  );
  const videos = [];
  const seen = new Set();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const v of r.value) {
        if (!seen.has(v.videoId)) {
          seen.add(v.videoId);
          videos.push(v);
        }
      }
    }
  }
  videos.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const result = videos.slice(0, 60);
  try {
    sessionStorage.setItem(
      YT_CACHE,
      JSON.stringify({ at: Date.now(), videos: result }),
    );
  } catch {
    /* ignore */
  }
  return result;
}

// ── [L1] Build LIVE feed — articles < 20 min, A-Z by source ──────────────────
const LIVE_MS = 20 * 60_000;

function buildLiveFeed(articles, category) {
  const now = Date.now();
  return articles
    .filter((a) => {
      if (a._type !== "article") return false;
      if (category && (a.category || "").toLowerCase() !== category)
        return false;
      const ts = new Date(a.published_at).getTime();
      return !isNaN(ts) && now - ts < LIVE_MS;
    })
    .sort((a, b) => (a.source_name || "").localeCompare(b.source_name || ""));
}

// ── [L2] Build LATEST feed — everything else, newest first ───────────────────
function buildLatestFeed(articles, videos, category, liveIds) {
  const fArt = articles.filter((a) => {
    if (liveIds.has(a.id)) return false;
    if (category && (a.category || "").toLowerCase() !== category) return false;
    return true;
  });
  const fVid = category
    ? videos.filter((v) => v.category === category)
    : videos;
  const combined = [...fArt, ...fVid];
  combined.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  return combined;
}

// ── Live card component (compact, for LIVE section) ──────────────────────────
const LiveNewsCard = ({ article, onClick }) => {
  const ts = useRelTime(article.published_at);
  const live = isLiveArticle(article.published_at);

  // Favicon
  const [favOk, setFavOk] = useState(true);
  let domain = null;
  try {
    domain = new URL(
      article.source_url || article.article_url || "",
    ).hostname.replace(/^www\./, "");
  } catch {}
  const favUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : null;

  return (
    <button className="lnc-card" onClick={() => onClick(article)}>
      <div className="lnc-left">
        <div className="lnc-source-row">
          {favUrl && favOk ? (
            <img
              src={favUrl}
              alt=""
              className="lnc-fav"
              onError={() => setFavOk(false)}
            />
          ) : (
            <span className="lnc-fav-fallback">
              {(article.source_name || "N")[0].toUpperCase()}
            </span>
          )}
          <span className="lnc-source">{article.source_name}</span>
          {ts && <span className="lnc-ts">{ts}</span>}
        </div>
        <p className="lnc-title">{article.title}</p>
      </div>
      <div className={`lnc-dot-wrap${live ? " lnc-dot-live" : ""}`}>
        <span className="lnc-indicator" />
      </div>
    </button>
  );
};

// ── LiveSection header + cards ────────────────────────────────────────────────
const LiveSection = ({ articles, onArticleClick }) => {
  // Re-evaluate liveness every 15s so cards auto-move to LATEST when they age out
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  if (!articles.length) return null;

  return (
    <div className="nt-live-section">
      <div className="nt-live-header">
        <div className="nt-live-pill">
          <span className="nt-live-pulse" />
          <Radio size={11} />
          LIVE NOW
        </div>
        <span className="nt-live-sub">
          {articles.length} breaking · sorted A–Z by source
        </span>
      </div>
      <div className="nt-live-cards">
        {articles.map((a) => (
          <LiveNewsCard key={a.id} article={a} onClick={onArticleClick} />
        ))}
      </div>
    </div>
  );
};

// ── ScrollSentinel ────────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null);
  const cool = useRef(false);
  useEffect(() => {
    if (!ref.current || disabled) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !cool.current) {
          cool.current = true;
          onVisible();
          setTimeout(() => {
            cool.current = false;
          }, 2000);
        }
      },
      { rootMargin: "500px", threshold: 0 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);
  return (
    <div ref={ref} style={{ height: 4, flexShrink: 0 }} aria-hidden="true" />
  );
};

const LoadingMore = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "24px 16px",
      color: "rgba(255,255,255,0.32)",
      fontSize: 13,
      fontWeight: 600,
    }}
  >
    <div
      style={{
        width: 17,
        height: 17,
        border: "2px solid rgba(59,130,246,0.18)",
        borderTopColor: "#60a5fa",
        borderRadius: "50%",
        animation: "ntSpin .8s linear infinite",
      }}
    />
    Loading more…
    <style>{`@keyframes ntSpin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const EndOfFeed = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "28px 20px",
      color: "rgba(255,255,255,0.18)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    }}
  >
    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
    You're all caught up
    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
  </div>
);

const SkeletonCard = ({ tall }) => (
  <div
    style={{
      margin: "0 0 2px",
      background: "rgba(255,255,255,0.025)",
      borderRadius: 16,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        padding: "12px 14px 8px",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(255,255,255,0.07)",
          animation: "ntSkel 1.4s ease-in-out infinite",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: 12,
            borderRadius: 6,
            background: "rgba(255,255,255,0.07)",
            marginBottom: 6,
            width: "65%",
            animation: "ntSkel 1.4s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 10,
            borderRadius: 5,
            background: "rgba(255,255,255,0.04)",
            width: "40%",
            animation: "ntSkel 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
    <div
      style={{
        height: tall ? 220 : 190,
        background: "rgba(255,255,255,0.055)",
        animation: "ntSkel 1.4s ease-in-out infinite",
      }}
    />
    <div style={{ padding: "10px 14px 12px" }}>
      <div
        style={{
          height: 13,
          borderRadius: 7,
          background: "rgba(255,255,255,0.055)",
          marginBottom: 7,
          width: "88%",
          animation: "ntSkel 1.4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: 11,
          borderRadius: 6,
          background: "rgba(255,255,255,0.035)",
          width: "55%",
          animation: "ntSkel 1.4s ease-in-out infinite",
        }}
      />
    </div>
    <style>{`@keyframes ntSkel{0%,100%{opacity:.55}50%{opacity:.18}}`}</style>
  </div>
);

const NewBanner = ({ count, onShow }) => {
  if (!count) return null;
  return (
    <>
      <button className="nt-banner" onClick={onShow}>
        <ArrowUp size={12} />
        {count} new article{count !== 1 ? "s" : ""}
      </button>
      <style>{`.nt-banner{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:8000;display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:999px;background:rgba(59,130,246,0.95);border:1px solid rgba(255,255,255,0.18);color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 4px 24px rgba(59,130,246,0.42);animation:ntBIn .3s cubic-bezier(0.34,1.2,0.64,1) both;font-family:inherit;}.nt-banner:hover{background:rgba(37,99,235,1);transform:translateX(-50%) scale(1.04);}@keyframes ntBIn{from{opacity:0;transform:translateX(-50%) translateY(-14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </>
  );
};

const ScrollFAB = () => {
  const [show, setShow] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);
  const getS = () => {
    for (const s of [".main-content-desktop", ".main-content-mobile"]) {
      const el = document.querySelector(s);
      if (el && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  };
  useEffect(() => {
    const upd = () => {
      const el = getS(),
        top = el ? el.scrollTop : window.scrollY;
      const sh = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120);
      setAtBot(top + ch >= sh - 120);
      setShow(top > 300);
    };
    const s = getS();
    if (s) s.addEventListener("scroll", upd, { passive: true });
    else window.addEventListener("scroll", upd, { passive: true });
    upd();
    return () => {
      const s2 = getS();
      if (s2) s2.removeEventListener("scroll", upd);
      else window.removeEventListener("scroll", upd);
    };
  }, []); // eslint-disable-line
  const go = (dir) => {
    const el = getS(),
      t =
        dir === "top"
          ? 0
          : el
            ? el.scrollHeight
            : document.documentElement.scrollHeight;
    if (el) el.scrollTo({ top: t, behavior: "smooth" });
    else window.scrollTo({ top: t, behavior: "smooth" });
  };
  if (!show) return null;
  return (
    <>
      <div className="sfab-pill">
        <button
          className={`sfab-btn${atTop ? " sfab-dim" : ""}`}
          onClick={() => !atTop && go("top")}
          disabled={atTop}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <div className="sfab-sep" />
        <button
          className={`sfab-btn${atBot ? " sfab-dim" : ""}`}
          onClick={() => !atBot && go("bottom")}
          disabled={atBot}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <style>{`.sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(132,204,22,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:sfabIn .25s cubic-bezier(0.34,1.2,0.64,1) both;}@keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(0.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}.sfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#84cc16;cursor:pointer;transition:background .15s,transform .1s;padding:0;}.sfab-btn:not(.sfab-dim):hover{background:rgba(132,204,22,0.12);transform:scale(1.1);}.sfab-btn.sfab-dim{color:rgba(255,255,255,0.15);cursor:default;}.sfab-sep{width:22px;height:1px;background:rgba(132,204,22,0.12);}@media(max-width:768px){.sfab-pill{right:10px;}}`}</style>
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// NewsTab
// ════════════════════════════════════════════════════════════════════════════
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
  const [articles, setArticles] = useState(() =>
    initialNews.map((a) => ({ ...a, _type: "article" })),
  );
  const [videos, setVideos] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [pending, setPending] = useState([]);
  const [freshIds, setFreshIds] = useState(new Set());
  const [fetching, setFetching] = useState(false);
  const [initialDone, setInitialDone] = useState(initialNews.length > 0);
  const [fullscreenArticle, setFullscreenArticle] = useState(null);

  // [L1] Force live section to re-evaluate every 15s
  const [liveTick, setLiveTick] = useState(0);

  const fetchingRef = useRef(false);
  const filterRef = useRef(null);
  const pollRef = useRef(null);
  const vidRef = useRef(null);
  const liveRef = useRef(null);

  useImperativeHandle(ref, () => ({
    prependNews: (items) =>
      setArticles((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        return [
          ...items
            .filter((n) => !ids.has(n.id))
            .map((a) => ({ ...a, _type: "article" })),
          ...prev,
        ];
      }),
  }));

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const doFetch = useCallback(async (force = false) => {
    if (fetchingRef.current && !force) return;
    fetchingRef.current = true;
    setFetching(true);
    try {
      await fetchAndStoreNews({ category: filterRef.current, force });
      const data = await loadArticlesFromDB(filterRef.current, 80);
      if (data.length) {
        setArticles(data);
        setInitialDone(true);
      }
    } catch (e) {
      console.warn("[NewsTab] fetch:", e);
    } finally {
      fetchingRef.current = false;
      setFetching(false);
      setInitialDone(true);
    }
  }, []);

  // ── [L5] On mount: nuke cooldowns → DB fast-load → force-fetch ─────────────
  useEffect(() => {
    clearAllCooldowns();
    filterRef.current = null;

    // 1. DB instant load (milliseconds)
    loadArticlesFromDB(null, 80).then((data) => {
      if (data.length) {
        setArticles(data);
        setInitialDone(true);
      }
    });

    // 2. Force-fetch fresh RSS
    doFetch(true);

    // 3. Videos
    fetchAllVideos(true)
      .then(setVideos)
      .catch(() => {});
  }, []); // eslint-disable-line — once on mount

  // ── [L4] Poll every 30s ────────────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(() => doFetch(false), 30_000);
    return () => clearInterval(pollRef.current);
  }, [doFetch]);

  // ── Video auto-refresh every 8 min ─────────────────────────────────────────
  useEffect(() => {
    vidRef.current = setInterval(
      () =>
        fetchAllVideos(true)
          .then(setVideos)
          .catch(() => {}),
      8 * 60_000,
    );
    return () => clearInterval(vidRef.current);
  }, []);

  // ── [L1] Live section ticks every 15s ──────────────────────────────────────
  useEffect(() => {
    liveRef.current = setInterval(() => setLiveTick((n) => n + 1), 15_000);
    return () => clearInterval(liveRef.current);
  }, []);

  // ── [L4] Visibility refetch ─────────────────────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") doFetch(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [doFetch]);

  // ── Realtime Supabase subscription ─────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel(`nt_rt_${activeFilter || "all"}_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "news_posts" },
        (payload) => {
          const row = payload.new;
          if (!row?.is_active) return;
          if (activeFilter && row.category?.toLowerCase() !== activeFilter)
            return;
          setArticles((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            setPending((q) =>
              q.some((n) => n.id === row.id)
                ? q
                : [{ ...row, _type: "article" }, ...q],
            );
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeFilter]);

  // Flush pending banner
  const flushPending = useCallback(() => {
    if (!pending.length) return;
    setArticles((prev) => {
      const ids = new Set(prev.map((n) => n.id));
      const toAdd = pending.filter((n) => !ids.has(n.id));
      if (!toAdd.length) return prev;
      setFreshIds(new Set(toAdd.map((n) => n.id)));
      setTimeout(() => setFreshIds(new Set()), 2000);
      return [...toAdd, ...prev];
    });
    setPending([]);
    const s =
      document.querySelector(".main-content-desktop") ||
      document.querySelector(".main-content-mobile");
    if (s) s.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pending]);

  // ── [L3] Filter change ─────────────────────────────────────────────────────
  const handleFilter = useCallback(async (id) => {
    setActiveFilter(id);
    filterRef.current = id;
    setPending([]);
    fetchingRef.current = true;
    setFetching(true);
    try {
      await fetchAndStoreNews({ category: id });
      const data = await loadArticlesFromDB(id, 80);
      if (data.length) setArticles(data);
    } catch {
      /* ignore */
    }
    fetchingRef.current = false;
    setFetching(false);
  }, []);

  // ── Manual refresh ─────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (fetchingRef.current) return;
    clearAllCooldowns();
    setPending([]);
    await doFetch(true);
    fetchAllVideos(true)
      .then(setVideos)
      .catch(() => {});
  }, [doFetch]);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  // ── [L1] Build feeds (re-runs every liveTick) ─────────────────────────────
  const liveFeed = buildLiveFeed(articles, activeFilter);
  const liveIds = new Set(liveFeed.map((a) => a.id)); // eslint-disable-line
  const latestFeed = buildLatestFeed(articles, videos, activeFilter, liveIds);

  return (
    <div className="nt-root">
      <NewBanner count={pending.length} onShow={flushPending} />

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="nt-bar">
        {CATEGORIES.map(({ id, label, Icon }) => (
          <button
            key={String(id)}
            className={`nt-chip${activeFilter === id ? " nt-chip--on" : ""}`}
            onClick={() => handleFilter(id)}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
        <button
          className={`nt-ref${fetching ? " nt-ref--spin" : ""}`}
          onClick={handleRefresh}
          disabled={fetching}
          title="Refresh now"
        >
          <RefreshCw size={13} />
        </button>
        {fetching && <span className="nt-dot" />}
      </div>

      {/* ── Skeleton ──────────────────────────────────────────────────────── */}
      {!initialDone &&
        [1, 2, 3, 4].map((i) => <SkeletonCard key={i} tall={i % 2 === 0} />)}

      {initialDone && (
        <>
          {/* ── [L1] LIVE SECTION ─────────────────────────────────────────── */}
          <LiveSection
            articles={liveFeed}
            onArticleClick={setFullscreenArticle}
          />

          {/* ── LATEST section header ─────────────────────────────────────── */}
          {latestFeed.length > 0 && (
            <div className="nt-latest-header">
              <div className="nt-latest-line" />
              <span className="nt-latest-label">
                <Newspaper size={11} /> LATEST NEWS
              </span>
              <div className="nt-latest-line" />
            </div>
          )}

          {/* ── [L2] LATEST FEED — articles + videos chronological ────────── */}
          {latestFeed.map((item) => {
            const isNew = freshIds.has(item.id);
            if (item._type === "video") {
              return (
                <div
                  key={item.id || item.videoId}
                  className={isNew ? "nt-item-new" : undefined}
                  style={{ padding: "0 0 2px" }}
                >
                  <VideoCard video={item} />
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className={isNew ? "nt-item-new" : undefined}
                style={{ padding: "0 0 2px" }}
              >
                <NewsCard post={item} currentUser={currentUser} />
              </div>
            );
          })}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {liveFeed.length === 0 && latestFeed.length === 0 && (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <Newspaper
                size={36}
                style={{ opacity: 0.15, marginBottom: 12, color: "#fff" }}
              />
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                Fetching {activeFilter ? `${activeFilter} ` : ""}news from 80+
                sources…
              </p>
              <button
                onClick={handleRefresh}
                style={{
                  marginTop: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  color: "#60a5fa",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <RefreshCw size={12} /> Fetch now
              </button>
            </div>
          )}
        </>
      )}

      <ScrollSentinel
        onVisible={handleSentinel}
        disabled={!hasMore || isLoadingMore}
      />
      {isLoadingMore && <LoadingMore />}
      {!hasMore && latestFeed.length > 0 && <EndOfFeed />}
      <ScrollFAB />

      {/* ── Fullscreen reader from live card click ─────────────────────────── */}
      {fullscreenArticle && (
        <NewsCard
          post={fullscreenArticle}
          currentUser={currentUser}
          _forceOpen
          onClose={() => setFullscreenArticle(null)}
        />
      )}

      <style>{NT_CSS + LNC_CSS}</style>
    </div>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const NT_CSS = `
.nt-root{width:100%;}

/* Filter bar */
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

/* Live section */
.nt-live-section{margin:0;border-bottom:1px solid rgba(255,255,255,0.05);}
.nt-live-header{display:flex;align-items:center;gap:10px;padding:10px 14px 6px;}
.nt-live-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);font-size:10px;font-weight:900;color:#fca5a5;letter-spacing:0.07em;text-transform:uppercase;flex-shrink:0;animation:ntLiveGlow 2.5s ease-in-out infinite;}
@keyframes ntLiveGlow{0%,100%{box-shadow:0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 14px rgba(239,68,68,0.3)}}
.nt-live-pulse{width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:ncPulse 1.8s ease-in-out infinite;}
@keyframes ncPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
.nt-live-sub{font-size:10.5px;color:rgba(255,255,255,0.25);font-weight:600;}
.nt-live-cards{display:flex;flex-direction:column;gap:0;}

/* Latest section header */
.nt-latest-header{display:flex;align-items:center;gap:12px;padding:14px 14px 8px;}
.nt-latest-line{flex:1;height:1px;background:rgba(255,255,255,0.06);}
.nt-latest-label{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:rgba(255,255,255,0.22);letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;flex-shrink:0;}

/* New item animation */
.nt-item-new{animation:ntSlide .4s cubic-bezier(0.34,1.2,0.64,1) both;}
@keyframes ntSlide{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
`;

// ── Live news card styles ─────────────────────────────────────────────────────
const LNC_CSS = `
.lnc-card{width:100%;display:flex;align-items:center;gap:12px;padding:11px 14px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;text-align:left;font-family:inherit;transition:background 0.15s;justify-content:space-between;}
.lnc-card:hover{background:rgba(239,68,68,0.04);}
.lnc-card:last-child{border-bottom:none;}
.lnc-left{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0;}
.lnc-source-row{display:flex;align-items:center;gap:6px;}
.lnc-fav{width:16px;height:16px;border-radius:4px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,0.1);}
.lnc-fav-fallback{width:16px;height:16px;border-radius:4px;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:#60a5fa;flex-shrink:0;}
.lnc-source{font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;}
.lnc-ts{font-size:10px;color:rgba(255,255,255,0.22);margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums;flex-shrink:0;}
.lnc-title{font-size:13px;font-weight:700;color:rgba(255,255,255,0.82);line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
.lnc-dot-wrap{width:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.lnc-indicator{width:7px;height:7px;border-radius:50%;background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.3);display:block;}
.lnc-dot-live .lnc-indicator{background:rgba(239,68,68,0.6);border-color:#ef4444;animation:ncPulse 1.8s ease-in-out infinite;}
`;

export default NewsTab;
