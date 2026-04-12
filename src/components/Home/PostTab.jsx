// ============================================================================
// src/components/Home/PostTab.jsx  — v7
//
// Simplified: no news injection. PostTab is pure user posts.
// News has its own dedicated NewsTab with category filters.
// Scroll FAB, infinite scroll sentinel, and prependPost ref all intact.
// ============================================================================

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
} from "react";
import PostCard from "./PostCard";
import NewsVideoStrip from "./NewsVideoStrip";

// ── Scroll Sentinel ───────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null);
  const cooling = useRef(false);

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
      { rootMargin: "400px", threshold: 0 },
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

// ── Loading / End ─────────────────────────────────────────────────────────────
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
          border: "2px solid rgba(132,204,22,0.2)",
          borderTopColor: "#84cc16",
          borderRadius: "50%",
          animation: "ptSpin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      Loading more…
    </div>
    <style>{`@keyframes ptSpin{to{transform:rotate(360deg)}}`}</style>
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
    const candidates = [
      document.querySelector(".main-content-desktop"),
      document.querySelector(".main-content-mobile"),
    ];
    for (const el of candidates) {
      if (el && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  };

  useEffect(() => {
    const update = () => {
      const el = getScroller();
      const top = el ? el.scrollTop : window.scrollY;
      const height = el
        ? el.scrollHeight
        : document.documentElement.scrollHeight;
      const client = el ? el.clientHeight : window.innerHeight;
      setAtTop(top < 120);
      setAtBottom(top + client >= height - 120);
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
    const target =
      dir === "top"
        ? 0
        : el
          ? el.scrollHeight
          : document.documentElement.scrollHeight;
    if (el) el.scrollTo({ top: target, behavior: "smooth" });
    else window.scrollTo({ top: target, behavior: "smooth" });
  };

  if (!show) return null;

  return (
    <>
      <div className="sfab-pill">
        <button
          className={`sfab-btn${atTop ? " sfab-dim" : ""}`}
          onClick={() => !atTop && scrollTo("top")}
          disabled={atTop}
          title="Back to top"
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
          title="Scroll to bottom"
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
        .sfab-pill{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:7900;display:flex;flex-direction:column;align-items:center;background:rgba(12,12,12,0.94);border:1px solid rgba(132,204,22,0.22);border-radius:14px;overflow:hidden;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:sfabIn 0.25s cubic-bezier(0.34,1.2,0.64,1) both;}
        @keyframes sfabIn{from{opacity:0;transform:translateY(-50%) scale(0.8)}to{opacity:1;transform:translateY(-50%) scale(1)}}
        .sfab-btn{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#84cc16;cursor:pointer;transition:background 0.15s,transform 0.1s;padding:0;}
        .sfab-btn:not(.sfab-dim):hover{background:rgba(132,204,22,0.12);transform:scale(1.1);}
        .sfab-btn.sfab-dim{color:rgba(255,255,255,0.15);cursor:default;}
        .sfab-sep{width:22px;height:1px;background:rgba(132,204,22,0.12);}
        @media(max-width:768px){.sfab-pill{right:10px;}}
      `}</style>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PostTab — pure user posts
// ══════════════════════════════════════════════════════════════════════════════
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
  },
  ref,
) {
  const [localPosts, setLocalPosts] = useState(initialPosts);

  useEffect(() => {
    setLocalPosts(initialPosts);
  }, [initialPosts]);

  useImperativeHandle(ref, () => ({
    prependPost: (p) =>
      setLocalPosts((prev) =>
        prev.some((x) => x.id === p.id) ? prev : [p, ...prev],
      ),
  }));

  const handlePostUpdate = useCallback((updated) => {
    setLocalPosts((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }, []);

  const handlePostDelete = useCallback((id) => {
    setLocalPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  if (localPosts.length === 0 && !isLoadingMore) {
    return (
      <>
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
      {/* News video strip always at top */}
      <NewsVideoStrip currentUser={currentUser} />

      {localPosts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onComment={onComment}
          onPostUpdate={handlePostUpdate}
          onPostDelete={handlePostDelete}
        />
      ))}

      <ScrollSentinel
        onVisible={handleSentinel}
        disabled={!hasMore || isLoadingMore}
      />
      {isLoadingMore && <LoadingMore />}
      {!hasMore && localPosts.length > 0 && <EndOfFeed />}
      <ScrollFAB />
    </div>
  );
});

export default PostTab;
