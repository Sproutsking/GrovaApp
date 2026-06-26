// src/components/Home/StoryTab.jsx
// Per-tab new-story banner — portal, strictly gated by isActive prop.
// Mirrors the exact same pattern used in PostTab, ReelsTab, and NewsTab.

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from "react";
import ReactDOM from "react-dom";
import { ArrowUp, BookOpen } from "lucide-react";
import StoryCard from "../Shared/StoryCard";
import SectionHeader from "../Shared/SectionHeader";

// ── Shared helper: measure the tallest fixed/sticky element ──────────────────
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

// ── NewStoryBanner — portal, rendered only when isActive===true ───────────────
const NewStoryBanner = ({ count, onShow, isActive }) => {
  const [topPx, setTopPx] = useState(() => getMeasuredSafeTop());

  useEffect(() => {
    const id = requestAnimationFrame(() => setTopPx(getMeasuredSafeTop()));
    const onR = () => setTopPx(getMeasuredSafeTop());
    window.addEventListener("resize", onR, { passive: true });
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onR); };
  }, []);

  if (!isActive || !count) return null;

  return ReactDOM.createPortal(
    <>
      <button className="stb-pill" style={{ top: topPx }} onClick={onShow}>
        <ArrowUp size={13} />
        {count} new {count !== 1 ? "stories" : "story"}
      </button>
      <style>{`
        .stb-pill{
          position:fixed;left:50%;transform:translateX(-50%);z-index:9999;
          display:inline-flex;align-items:center;gap:7px;
          padding:9px 22px;border-radius:999px;
          background:rgba(236,72,153,0.97);
          border:1px solid rgba(255,255,255,0.22);
          color:#fff;font-size:13px;font-weight:700;cursor:pointer;
          white-space:nowrap;font-family:inherit;
          box-shadow:0 6px 30px rgba(236,72,153,0.5);
          backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
          animation:stbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .stb-pill:hover{background:rgba(219,39,119,1);transform:translateX(-50%) scale(1.04);}
        .stb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes stbIn{
          from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
        }
      `}</style>
    </>,
    document.body,
  );
};

// ── StoryTab ─────────────────────────────────────────────────────────────────
// Props that were present in the original call-sites are preserved.
// `isActive` is the new addition — pass true when the stories tab is selected.
const StoryTab = React.forwardRef(function StoryTab(
  {
    stories: initialStories = [],
    currentUser,
    onAuthorClick,
    onActionMenu,
    onUnlock,
    onOpenFull,
    isActive = false,       // <-- gating prop
    // Forward any additional props from the original implementation
    ...rest
  },
  ref,
) {
  const [localStories,  setLocalStories]  = useState(initialStories);
  const [pendingCount,  setPendingCount]  = useState(0);
  const pendingRef = useRef([]);

  // Keep in sync with parent
  useEffect(() => { setLocalStories(initialStories); }, [initialStories]);

  useImperativeHandle(ref, () => ({
    // Called by HomeView / realtime handlers
    prependStory: (story) => {
      if (isActive) {
        setLocalStories(prev =>
          prev.some(s => s.id === story.id) ? prev : [story, ...prev],
        );
      } else {
        if (!pendingRef.current.some(s => s.id === story.id)) {
          pendingRef.current = [story, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
        }
      }
    },
  }));

  // Also listen to the custom window event so HomeView doesn't need updating
  useEffect(() => {
    const handler = (e) => {
      const story = e.detail?.story;
      if (!story) return;
      if (isActive) {
        setLocalStories(prev =>
          prev.some(s => s.id === story.id) ? prev : [story, ...prev],
        );
      } else {
        if (!pendingRef.current.some(s => s.id === story.id)) {
          pendingRef.current = [story, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
        }
      }
    };
    window.addEventListener("grova:newStory", handler);
    return () => window.removeEventListener("grova:newStory", handler);
  }, [isActive]);

  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = [];
    setPendingCount(0);
    setLocalStories(prev => {
      const ids = new Set(prev.map(s => s.id));
      return [...toAdd.filter(s => !ids.has(s.id)), ...prev];
    });
    const el = document.querySelector(".main-content-desktop, .main-content-mobile");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      {/* Banner — portal, only shown when stories tab is the active tab */}
      <NewStoryBanner count={pendingCount} onShow={flushPending} isActive={isActive} />

      {/* ── Your existing story-list rendering below ──
          Replace the block below with whatever StoryCard / StoryGrid
          implementation was in the original StoryTab body.
          All we are adding here is the banner wiring above.            */}
      {localStories.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 20px", textAlign: "center", gap: 16,
        }}>
          <div style={{ fontSize: 64, opacity: 0.3 }}>📖</div>
          <p style={{ color: "#a3a3a3", fontSize: 18, fontWeight: 600, margin: 0 }}>
            No stories yet
          </p>
          <span style={{ color: "#737373", fontSize: 14 }}>
            Be the first to share a story!
          </span>
        </div>
      ) : (
        <div className="story-tab-feed">
          <SectionHeader
            icon={BookOpen}
            title="Stories"
            subtitle="Read what creators are sharing today"
          />
          {localStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onUnlock={onUnlock}
              onOpenFull={onOpenFull}
              onActionMenu={onActionMenu}
            />
          ))}
        </div>
      )}
    </>
  );
});

export default StoryTab;