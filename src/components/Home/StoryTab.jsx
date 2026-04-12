// ============================================================================
// src/components/Home/StoryTab.jsx
//
// Full rebuild. Renders StoryCard components in a scrollable feed.
// Double-tap to like is handled in StoryCard.
// FullStoryView is launched from StoryCard (not here).
//
// Props:
//   stories      — array of story objects from HomeView
//   currentUser  — current auth user
//   onAuthorClick, onActionMenu, onComment, onLike, onUnlock
//   onLoadMore, hasMore, isLoadingMore — pagination from HomeView
// ============================================================================

import React, { useRef, useCallback, useImperativeHandle } from "react";
import StoryCard from "./StoryCard";

// ── Scroll Sentinel ───────────────────────────────────────────────────────────
const ScrollSentinel = ({ onVisible, disabled }) => {
  const ref     = useRef(null);
  const cooling = useRef(false);
  const { useEffect } = React;

  useEffect(() => {
    if (disabled || !ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !cooling.current) {
        cooling.current = true;
        onVisible();
        setTimeout(() => { cooling.current = false; }, 2000);
      }
    }, { rootMargin:"400px", threshold:0 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [disabled, onVisible]);

  return <div ref={ref} style={{ height:4, flexShrink:0 }} aria-hidden="true"/>;
};

const EndOfFeed = () => (
  <div style={{ display:"flex",alignItems:"center",gap:12,padding:"28px 20px",color:"rgba(255,255,255,0.2)",fontSize:12,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase" }}>
    <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.06)" }}/>
    All stories read
    <div style={{ flex:1,height:1,background:"rgba(255,255,255,0.06)" }}/>
  </div>
);

const LoadingMore = () => (
  <>
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"24px 16px",color:"rgba(255,255,255,0.35)",fontSize:13,fontWeight:600 }}>
      <div style={{ width:18,height:18,border:"2px solid rgba(132,204,22,0.2)",borderTopColor:"#84cc16",borderRadius:"50%",animation:"stSpin 0.8s linear infinite",flexShrink:0 }}/>
      Loading stories…
    </div>
    <style>{`@keyframes stSpin{to{transform:rotate(360deg)}}`}</style>
  </>
);

// ══════════════════════════════════════════════════════════════════════════════
const StoryTab = React.forwardRef(function StoryTab(
  {
    stories=[],
    currentUser,
    onAuthorClick,
    onActionMenu,
    onComment,
    onLike,
    onUnlock,
    onLoadMore,
    hasMore=false,
    isLoadingMore=false,
  },
  ref
) {
  useImperativeHandle(ref, () => ({
    // No external imperative actions needed currently
  }));

  const handleSentinel = useCallback(() => {
    if (!isLoadingMore && hasMore && onLoadMore) onLoadMore();
  }, [isLoadingMore, hasMore, onLoadMore]);

  if (stories.length === 0 && !isLoadingMore) {
    return (
      <div style={{ padding:"60px 20px",textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:15 }}>
        <p style={{ fontSize:36,marginBottom:12 }}>📖</p>
        <p style={{ fontWeight:700,fontSize:17,color:"rgba(255,255,255,0.5)",marginBottom:6 }}>No stories yet</p>
        <p style={{ fontSize:14,lineHeight:1.7 }}>Be the first to share your story — daily life, folklore, or fiction. Inspire someone today.</p>
      </div>
    );
  }

  return (
    <div className="story-tab-feed">
      {stories.map(story => (
        <StoryCard
          key={story.id}
          story={story}
          currentUser={currentUser}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onComment={onComment}
          onLike={onLike}
          onUnlock={onUnlock}
        />
      ))}

      <ScrollSentinel onVisible={handleSentinel} disabled={!hasMore||isLoadingMore}/>
      {isLoadingMore && <LoadingMore/>}
      {!hasMore && stories.length > 0 && <EndOfFeed/>}
    </div>
  );
});

export default StoryTab;