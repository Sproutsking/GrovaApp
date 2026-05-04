// src/components/Home/PostTab.jsx
//
// ═══════════════════════════════════════════════════════════════════════════
// VIRTUAL FEED WITH PRELOAD RUNWAY — zero loading states
// ───────────────────────────────────────────────────────────────────────────
//
// [RENDER WINDOW]   Only posts within ±RENDER_RADIUS (5) of the current
//                   anchor index are mounted in the DOM. Everything outside
//                   is a height-preserving <Placeholder>. Scroll position
//                   never jumps because placeholders use measured heights.
//
// [PRELOAD RUNWAY]  Posts within ±PRELOAD_RADIUS (20) of the anchor get
//                   invisible browser hints:
//                     • Images  → <link rel="preload" as="image" fetchpriority="low">
//                     • Videos  → <video preload="metadata" style="display:none">
//                   Media lands in the browser cache before PostCard mounts
//                   → user sees ZERO loading spinners on any media.
//
// [FETCH TRIGGER]   The next server page is requested when the anchor comes
//                   within FETCH_AHEAD (10) posts of the list tail — well
//                   before the user reaches the bottom. A scroll sentinel
//                   acts as a secondary fallback.
//
// [BANNER]          Real-time new posts queue in pendingRef. The green pill
//                   appears only when isActive===true (this tab is selected).
//
// [ANCHOR TRACKING] An IntersectionObserver on each rendered card wrapper
//                   detects which card is at/near the viewport top and updates
//                   anchorIndex, re-slicing the render + preload windows.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
} from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";
import PostCard from "./PostCard";
import NewsVideoStrip from "./NewsVideoStrip";

// ─── Tuning ──────────────────────────────────────────────────────────────────
const RENDER_RADIUS = 5; // cards rendered either side of anchor
const PRELOAD_RADIUS = 20; // media hints either side of anchor
const FETCH_AHEAD = 10; // fetch next page when this close to list tail
const PLACEHOLDER_H = 520; // fallback card height estimate (px)

// Cloudinary cloud name — reads a global set by your app init or falls back.
const CLD = () => window.__CLD_CLOUD__ || "grova";

// ═══════════════════════════════════════════════════════════════════════════
// NewPostBanner
// ═══════════════════════════════════════════════════════════════════════════
function getMeasuredSafeTop() {
  let max = 0;
  try {
    for (const el of document.querySelectorAll("*")) {
      const s = window.getComputedStyle(el),
        p = s.position;
      if (p !== "fixed" && p !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.top < 10 && r.bottom > max && r.width > 60) max = r.bottom;
    }
  } catch {}
  return Math.max(max, 56) + 10;
}

const NewPostBanner = ({ count, onShow, isActive }) => {
  const [topPx, setTopPx] = useState(getMeasuredSafeTop);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTopPx(getMeasuredSafeTop()));
    const onR = () => setTopPx(getMeasuredSafeTop());
    window.addEventListener("resize", onR, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onR);
    };
  }, []);

  if (!isActive || !count) return null;
  return ReactDOM.createPortal(
    <>
      <button className="ptb-pill" style={{ top: topPx }} onClick={onShow}>
        <ArrowUp size={13} />
        {count} new post{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .ptb-pill{
          position:fixed;left:50%;transform:translateX(-50%);z-index:9999;
          display:inline-flex;align-items:center;gap:7px;
          padding:9px 22px;border-radius:999px;
          background:rgba(84,163,10,0.97);
          border:1px solid rgba(255,255,255,0.22);
          color:#fff;font-size:13px;font-weight:700;cursor:pointer;
          white-space:nowrap;font-family:inherit;
          box-shadow:0 6px 30px rgba(84,163,10,0.5);
          backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
          animation:ptbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .ptb-pill:hover{background:rgba(74,143,8,1);transform:translateX(-50%) scale(1.04);}
        .ptb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes ptbIn{
          from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
        }
      `}</style>
    </>,
    document.body,
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PreloadRunway
// Renders invisible browser hints for media in the preload window but
// outside the render window (rendered cards already load themselves).
// ═══════════════════════════════════════════════════════════════════════════
const PreloadRunway = React.memo(({ posts, anchorIndex }) => {
  const preloadStart = Math.max(0, anchorIndex - PRELOAD_RADIUS);
  const preloadEnd = Math.min(posts.length - 1, anchorIndex + PRELOAD_RADIUS);
  const renderStart = Math.max(0, anchorIndex - RENDER_RADIUS);
  const renderEnd = Math.min(posts.length - 1, anchorIndex + RENDER_RADIUS);

  const hints = [];
  for (let i = preloadStart; i <= preloadEnd; i++) {
    if (i >= renderStart && i <= renderEnd) continue; // already mounted
    const p = posts[i];
    if (!p) continue;

    // Image hints
    p.image_ids?.forEach((id, j) => {
      if (!id?.trim()) return;
      hints.push(
        <link
          key={`img-${p.id}-${j}`}
          rel="preload"
          as="image"
          href={`https://res.cloudinary.com/${CLD()}/image/upload/w_800,q_auto:good,f_webp,c_limit/${id}`}
          // React passes unknown props through to DOM on <link>
          // eslint-disable-next-line react/no-unknown-property
          fetchpriority="low"
        />,
      );
    });

    // Video metadata hints
    // preload="metadata" fetches only the first ~256 KB (duration, dimensions,
    // first frame). When PostCard mounts it continues from where this left off.
    p.video_ids?.forEach((id, j) => {
      if (!id?.trim()) return;
      const url = `https://res.cloudinary.com/${CLD()}/video/upload/q_auto:good,f_mp4/${id}.mp4`;
      hints.push(
        <video
          key={`vid-${p.id}-${j}`}
          src={url}
          preload="metadata"
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        />,
      );
    });
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {hints}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Placeholder — height-preserving stand-in for unmounted cards
// ═══════════════════════════════════════════════════════════════════════════
const Placeholder = React.memo(({ height }) => (
  <div
    aria-hidden="true"
    style={{
      width: "100%",
      height: height || PLACEHOLDER_H,
      flexShrink: 0,
      contain: "strict",
    }}
  />
));

// ═══════════════════════════════════════════════════════════════════════════
// VirtualFeed — sliding render window with height measurement
// ═══════════════════════════════════════════════════════════════════════════
const VirtualFeed = React.memo(
  ({
    posts,
    currentUser,
    onAuthorClick,
    onActionMenu,
    onComment,
    onAnchorChange,
  }) => {
    const [anchorIndex, setAnchorIndex] = useState(0);
    const heightMap = useRef({}); // index → measured height (px)
    const wrapperMap = useRef({}); // index → DOM wrapper node
    const ioRef = useRef(null); // IntersectionObserver
    const roMap = useRef({}); // index → ResizeObserver

    // Notify parent whenever anchor moves
    useEffect(() => {
      onAnchorChange?.(anchorIndex);
    }, [anchorIndex, onAnchorChange]);

    // Rebuild IntersectionObserver when list grows
    useEffect(() => {
      ioRef.current?.disconnect();

      ioRef.current = new IntersectionObserver(
        (entries) => {
          let best = null,
            bestTop = Infinity;
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const top = entry.boundingClientRect.top;
            const idx = Number(entry.target.dataset.vfidx);
            if (!isNaN(idx) && top < bestTop) {
              bestTop = top;
              best = idx;
            }
          });
          if (best !== null) {
            setAnchorIndex((prev) =>
              Math.abs(prev - best) >= 1 ? best : prev,
            );
          }
        },
        {
          // Large margin: anchor updates before card enters the visible viewport
          rootMargin: "250px 0px 250px 0px",
          threshold: 0,
        },
      );

      Object.values(wrapperMap.current).forEach((el) => {
        if (el) ioRef.current.observe(el);
      });

      return () => ioRef.current?.disconnect();
    }, [posts.length]);

    // Cleanup ResizeObservers on full unmount
    useEffect(
      () => () => {
        Object.values(roMap.current).forEach((ro) => ro.disconnect());
      },
      [],
    );

    // Stable callback-ref factory for card wrappers
    const makeRef = useCallback(
      (index) => (el) => {
        // Disconnect previous observers for this slot
        roMap.current[index]?.disconnect();
        delete roMap.current[index];

        wrapperMap.current[index] = el;
        if (!el) return;

        el.dataset.vfidx = index;
        if (ioRef.current) ioRef.current.observe(el);

        const ro = new ResizeObserver(([entry]) => {
          const h = Math.round(entry.contentRect.height);
          if (h > 0) heightMap.current[index] = h;
        });
        ro.observe(el);
        roMap.current[index] = ro;
      },
      [],
    );

    const renderStart = Math.max(0, anchorIndex - RENDER_RADIUS);
    const renderEnd = Math.min(posts.length - 1, anchorIndex + RENDER_RADIUS);

    return (
      <div className="vf-list">
        {posts.map((post, index) => {
          const inWindow = index >= renderStart && index <= renderEnd;
          if (!inWindow) {
            return (
              <Placeholder key={post.id} height={heightMap.current[index]} />
            );
          }
          return (
            <div key={post.id} ref={makeRef(index)} className="vf-item">
              <PostCard
                post={post}
                currentUser={currentUser}
                onAuthorClick={onAuthorClick}
                onActionMenu={onActionMenu}
                onComment={onComment}
                feedIndex={index}
              />
            </div>
          );
        })}
        <style>{`
        .vf-list{display:flex;flex-direction:column;position:relative;}
        .vf-item{contain:layout style;}
      `}</style>
      </div>
    );
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// ScrollSentinel — fallback fetch trigger
// ═══════════════════════════════════════════════════════════════════════════
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null),
    cooling = useRef(false);
  useEffect(() => {
    if (disabled || !ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !cooling.current) {
          cooling.current = true;
          onVisible();
          setTimeout(() => {
            cooling.current = false;
          }, 2000);
        }
      },
      { rootMargin: "1200px", threshold: 0 },
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

// ═══════════════════════════════════════════════════════════════════════════
// EndOfFeed
// ═══════════════════════════════════════════════════════════════════════════
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
    You&apos;re all caught up
    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// ScrollFAB
// ═══════════════════════════════════════════════════════════════════════════
const ScrollFAB = () => {
  const [show, setShow] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBot, setAtBot] = useState(false);
  const getS = () => {
    const c = [
      document.querySelector(".main-content-desktop"),
      document.querySelector(".main-content-mobile"),
    ];
    return c.find((el) => el && el.scrollHeight > el.clientHeight) || null;
  };
  useEffect(() => {
    const u = () => {
      const el = getS();
      const top = el ? el.scrollTop : window.scrollY;
      const h = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const ch = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120);
      setAtBot(top + ch >= h - 120);
      setShow(top > 300);
    };
    const s = getS();
    if (s) s.addEventListener("scroll", u, { passive: true });
    else window.addEventListener("scroll", u, { passive: true });
    u();
    return () => {
      const s2 = getS();
      if (s2) s2.removeEventListener("scroll", u);
      else window.removeEventListener("scroll", u);
    };
  }, []);
  const go = (dir) => {
    const el = getS();
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
      <style>{`.sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(132,204,22,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:sfabIn .25s cubic-bezier(.34,1.2,.64,1) both;}@keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}.sfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#84cc16;cursor:pointer;transition:background .15s,transform .1s;padding:0;}.sfab-btn:not(.sfab-dim):hover{background:rgba(132,204,22,.12);transform:scale(1.1);}.sfab-btn.sfab-dim{color:rgba(255,255,255,.15);cursor:default;}.sfab-sep{width:22px;height:1px;background:rgba(132,204,22,.12);}@media(max-width:768px){.sfab-pill{right:10px;}}`}</style>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PostTab — public API
// Ref exposes: { prependPost(post) }
// ═══════════════════════════════════════════════════════════════════════════
const PostTab = React.forwardRef(function PostTab(
  {
    posts: initialPosts = [],
    currentUser,
    onAuthorClick,
    onActionMenu,
    onComment,
    onLoadMore,
    hasMore = false,
    isLoadingMore = false,
    isActive = false,
  },
  ref,
) {
  const [localPosts, setLocalPosts] = useState(initialPosts);
  const [pendingCount, setPendingCount] = useState(0);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const pendingRef = useRef([]);

  useEffect(() => {
    setLocalPosts(initialPosts);
  }, [initialPosts]);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    prependPost: (p) => {
      if (isActive) {
        setLocalPosts((prev) =>
          prev.some((x) => x.id === p.id) ? prev : [p, ...prev],
        );
      } else {
        if (!pendingRef.current.some((x) => x.id === p.id)) {
          pendingRef.current = [p, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
        }
      }
    },
  }));

  // ── Banner flush ──────────────────────────────────────────────────────────
  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = [];
    setPendingCount(0);
    setLocalPosts((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      return [...toAdd.filter((p) => !ids.has(p.id)), ...prev];
    });
    const el = document.querySelector(
      ".main-content-desktop, .main-content-mobile",
    );
    (el || window).scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Proactive fetch — fires before user reaches the end ───────────────────
  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;
    if (localPosts.length - anchorIndex <= FETCH_AHEAD) {
      onLoadMore();
    }
  }, [anchorIndex, localPosts.length, hasMore, isLoadingMore, onLoadMore]);

  // ── Fallback sentinel ─────────────────────────────────────────────────────
  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (localPosts.length === 0 && !isLoadingMore) {
    return (
      <>
        <NewPostBanner
          count={pendingCount}
          onShow={flushPending}
          isActive={isActive}
        />
        <NewsVideoStrip currentUser={currentUser} />
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "#737373",
            fontSize: 16,
          }}
        >
          <p>No posts yet. Be the first!</p>
        </div>
      </>
    );
  }

  return (
    <div className="post-tab-feed">
      {/* Real-time new-posts banner — portal, visible only when tab is active */}
      <NewPostBanner
        count={pendingCount}
        onShow={flushPending}
        isActive={isActive}
      />

      {/* Horizontal news / video strip */}
      <NewsVideoStrip currentUser={currentUser} />

      {/* Invisible preload hints for ±20 posts around the current position */}
      <PreloadRunway posts={localPosts} anchorIndex={anchorIndex} />

      {/* Virtualised feed: only ±5 cards are in the DOM at any moment */}
      <VirtualFeed
        posts={localPosts}
        currentUser={currentUser}
        onAuthorClick={onAuthorClick}
        onActionMenu={onActionMenu}
        onComment={onComment}
        onAnchorChange={setAnchorIndex}
      />

      {/* Fallback fetch sentinel — 1200px below viewport */}
      <ScrollSentinel
        onVisible={handleSentinel}
        disabled={!hasMore || isLoadingMore}
      />

      {/* No loading spinner anywhere — fetch is always ahead of the user */}

      {!hasMore && localPosts.length > 0 && <EndOfFeed />}
      <ScrollFAB />
    </div>
  );
});

export default PostTab;
