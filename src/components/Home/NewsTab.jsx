// ============================================================================
// src/components/Home/NewsTab.jsx  — v3  REALTIME MODEL
//
// CHANGES vs v2:
//  [RT1] Supabase Realtime subscription — articles arrive INSTANTLY when the
//        server cron inserts them. No polling required.
//  [RT2] "X new articles" floating banner (Twitter/X style). Tapping it
//        prepends the new articles with a slide-in animation.
//  [RT3] Smooth item entry animation (slide up) for newly prepended articles.
//  [RT4] Falls back to 30s polling if Realtime channel can't connect.
//  [IMP] Category filter NOW correctly re-subscribes when changed, so the
//        realtime stream respects the active filter.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import { Globe, Bitcoin, MapPin, Newspaper, ArrowUp } from "lucide-react";
import NewsCard from "./NewsCard";
import newsService from "../../services/news/newsService";

// ── Category filter chips ─────────────────────────────────────────────────────
const CATEGORIES = [
  { id: null, label: "All", Icon: Newspaper },
  { id: "global", label: "Global", Icon: Globe },
  { id: "africa", label: "Africa", Icon: MapPin },
  { id: "crypto", label: "Crypto", Icon: Bitcoin },
];

// ── Scroll sentinel ───────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null);
  const cooling = useRef(false);
  useEffect(() => {
    if (!ref.current || disabled) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !cooling.current) {
          cooling.current = true;
          onVisible();
          setTimeout(() => {
            cooling.current = false;
          }, 2000);
        }
      },
      { rootMargin: "500px", threshold: 0 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);
  return (
    <div
      ref={ref}
      style={{ height: 4, width: "100%", flexShrink: 0 }}
      aria-hidden="true"
    />
  );
};

// ── Loading / end indicators ──────────────────────────────────────────────────
const LoadingMore = () => (
  <>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "24px 16px",
        color: "rgba(255,255,255,0.35)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          border: "2px solid rgba(59,130,246,0.2)",
          borderTopColor: "#60a5fa",
          borderRadius: "50%",
          animation: "ntSpin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      Loading more news…
    </div>
    <style>{`@keyframes ntSpin{to{transform:rotate(360deg)}}`}</style>
  </>
);

const EndOfFeed = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "28px 20px",
      color: "rgba(255,255,255,0.2)",
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

// ── Floating scroll FAB ───────────────────────────────────────────────────────
const ScrollFAB = () => {
  const [show, setShow] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  const getScroller = () => {
    for (const sel of [".main-content-desktop", ".main-content-mobile"]) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  };

  useEffect(() => {
    const update = () => {
      const el = getScroller();
      const top = el ? el.scrollTop : window.scrollY;
      const sh = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120);
      setAtBottom(top + ch >= sh - 120);
      setShow(top > 300);
    };
    const s = getScroller();
    if (s) s.addEventListener("scroll", update, { passive: true });
    else window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      const s2 = getScroller();
      if (s2) s2.removeEventListener("scroll", update);
      else window.removeEventListener("scroll", update);
    };
  }, []);

  const scrollTo = (dir) => {
    const el = getScroller();
    const t =
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
          onClick={() => !atTop && scrollTo("top")}
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
          className={`sfab-btn${atBottom ? " sfab-dim" : ""}`}
          onClick={() => !atBottom && scrollTo("bottom")}
          disabled={atBottom}
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
      <style>{`
        .sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(59,130,246,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:sfabIn 0.25s cubic-bezier(0.34,1.2,0.64,1) both;}
        @keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(0.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}
        .sfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#60a5fa;cursor:pointer;transition:background 0.15s,transform 0.1s;padding:0;}
        .sfab-btn:not(.sfab-dim):hover{background:rgba(59,130,246,0.12);transform:scale(1.1);}
        .sfab-btn.sfab-dim{color:rgba(255,255,255,0.15);cursor:default;}
        .sfab-sep{width:22px;height:1px;background:rgba(59,130,246,0.12);}
        @media(max-width:768px){.sfab-pill{right:10px;}}
      `}</style>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// [RT2] New-articles banner — Twitter/X style floating pill
// ══════════════════════════════════════════════════════════════════════════════
const NewArticlesBanner = ({ count, onShow }) => {
  if (count === 0) return null;
  return (
    <>
      <button className="nt-new-banner" onClick={onShow}>
        <ArrowUp size={13} />
        {count} new article{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .nt-new-banner{
          position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:8000;
          display:inline-flex;align-items:center;gap:6px;
          padding:8px 18px;border-radius:999px;
          background:rgba(59,130,246,0.92);
          border:1px solid rgba(255,255,255,0.2);
          color:#fff;font-size:13px;font-weight:700;
          cursor:pointer;white-space:nowrap;
          box-shadow:0 4px 20px rgba(59,130,246,0.4);
          animation:ntBannerIn 0.35s cubic-bezier(0.34,1.2,0.64,1) both;
          transition:background 0.15s,transform 0.1s;
          font-family:inherit;
        }
        .nt-new-banner:hover{background:rgba(37,99,235,0.96);transform:translateX(-50%) scale(1.04);}
        .nt-new-banner:active{transform:translateX(-50%) scale(0.97);}
        @keyframes ntBannerIn{
          from{opacity:0;transform:translateX(-50%) translateY(-16px) scale(0.9)}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
        }
      `}</style>
    </>
  );
};

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
  const [localNews, setLocalNews] = useState(initialNews);
  const [activeFilter, setActiveFilter] = useState(null);

  // [RT2] Queue of articles that arrived via Realtime but not yet shown
  const [pendingItems, setPendingItems] = useState([]);
  // [RT3] Set of IDs that were just prepended (for entry animation)
  const [freshIds, setFreshIds] = useState(new Set());

  useEffect(() => {
    setLocalNews(initialNews);
  }, [initialNews]);

  useImperativeHandle(ref, () => ({
    prependNews: (items) =>
      setLocalNews((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        return [...items.filter((n) => !ids.has(n.id)), ...prev];
      }),
  }));

  // ── [RT1] Realtime subscription — re-runs when activeFilter changes ─────────
  useEffect(() => {
    const stopRealtime = newsService.startRealtime(
      (newItems) => {
        setLocalNews((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const truly = newItems.filter((n) => !existingIds.has(n.id));
          if (!truly.length) return prev;

          // Filter to match current activeFilter
          const matching = activeFilter
            ? truly.filter(
                (n) => (n.category || "").toLowerCase() === activeFilter,
              )
            : truly;

          if (!matching.length) return prev;

          // [RT2] Queue them for the banner — don't immediately prepend
          setPendingItems((q) => {
            const qIds = new Set(q.map((n) => n.id));
            return [...q, ...matching.filter((n) => !qIds.has(n.id))];
          });

          return prev; // don't change feed yet — user decides via banner
        });
      },
      { category: activeFilter },
    );

    return () => stopRealtime();
  }, [activeFilter]); // re-subscribe when filter changes

  // ── [RT2] User taps banner → prepend queued articles ──────────────────────
  const flushPending = useCallback(() => {
    if (!pendingItems.length) return;

    setLocalNews((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const toAdd = pendingItems.filter((n) => !existingIds.has(n.id));
      if (!toAdd.length) return prev;

      // [RT3] Mark as fresh for animation
      setFreshIds(new Set(toAdd.map((n) => n.id)));
      setTimeout(() => setFreshIds(new Set()), 1200); // clear after anim

      return [...toAdd, ...prev];
    });

    setPendingItems([]);

    // Scroll to top to see new articles
    const scroller =
      document.querySelector(".main-content-desktop") ||
      document.querySelector(".main-content-mobile");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pendingItems]);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  // Client-side category filter
  const filtered = activeFilter
    ? localNews.filter((n) => (n.category || "").toLowerCase() === activeFilter)
    : localNews;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (localNews.length === 0 && !isLoadingMore) {
    return (
      <div
        style={{ padding: "60px 20px", textAlign: "center", color: "#737373" }}
      >
        <Newspaper size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 16, fontWeight: 600 }}>No news yet</p>
        <p style={{ fontSize: 13, marginTop: 4, color: "#555" }}>
          News articles will appear here within minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="news-tab-feed">
      {/* [RT2] New articles banner */}
      <NewArticlesBanner count={pendingItems.length} onShow={flushPending} />

      {/* Category filter chips */}
      <div className="nt-filter-row">
        {CATEGORIES.map(({ id, label, Icon }) => (
          <button
            key={String(id)}
            className={`nt-chip${activeFilter === id ? " nt-chip--active" : ""}`}
            onClick={() => {
              setActiveFilter(id);
              setPendingItems([]); // clear pending when switching filter
            }}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* News cards */}
      {filtered.map((item) => (
        <div
          key={`news-${item.id}`}
          className={freshIds.has(item.id) ? "nt-item-fresh" : undefined}
        >
          <NewsCard post={item} />
        </div>
      ))}

      {filtered.length === 0 && activeFilter && (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "#555",
            fontSize: 14,
          }}
        >
          No {activeFilter} news at the moment.
        </div>
      )}

      <ScrollSentinel
        onVisible={handleSentinel}
        disabled={!hasMore || isLoadingMore}
      />
      {isLoadingMore && <LoadingMore />}
      {!hasMore && filtered.length > 0 && <EndOfFeed />}
      <ScrollFAB />

      <style>{NT_CSS}</style>
    </div>
  );
});

const NT_CSS = `
.news-tab-feed { width: 100%; }

/* [RT3] Entry animation for freshly prepended articles */
@keyframes ntSlideIn {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.nt-item-fresh {
  animation: ntSlideIn 0.45s cubic-bezier(0.34,1.2,0.64,1) both;
}

/* Filter chips */
.nt-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  overflow-x: auto;
  scrollbar-width: none;
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(10,10,10,0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.nt-filter-row::-webkit-scrollbar { display: none; }

.nt-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.45);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: all 0.18s;
  flex-shrink: 0;
}
.nt-chip:hover {
  background: rgba(59,130,246,0.08);
  border-color: rgba(59,130,246,0.25);
  color: #60a5fa;
}
.nt-chip--active {
  background: rgba(59,130,246,0.12);
  border-color: rgba(59,130,246,0.35);
  color: #60a5fa;
  box-shadow: 0 0 12px rgba(59,130,246,0.12);
}
`;

export default NewsTab;
