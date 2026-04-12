// ============================================================================
// src/components/Home/FullScreenPostView.jsx
//
// GROUND-UP REWRITE — clean stacking, no z-index wars
// Updated to support news articles — when newsArticleUrl is provided:
//   • Shows the news image (newsImageUrl) above the content
//   • Replaces reaction panel with a "Visit full article" button in footer
//   • No comments/share for news (read-only)
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, ChevronLeft, ExternalLink } from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel  from "../Shared/ReactionPanel";
import CommentModal   from "../Modals/CommentModal";
import ShareModal     from "../Modals/ShareModal";
import ParsedText     from "../Shared/ParsedText";

// ── Breakpoint ────────────────────────────────────────────────────────────────
const isMobileWidth = () => window.innerWidth <= 768;

// ── Body scroll lock ──────────────────────────────────────────────────────────
let lockCount = 0;
const lockScroll = () => {
  lockCount++;
  if (lockCount === 1) {
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow:hidden;position:fixed;top:-${scrollY}px;left:0;right:0;`;
    document.body.dataset.scrollY = scrollY;
  }
};
const unlockScroll = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const scrollY = parseInt(document.body.dataset.scrollY || "0");
    document.body.style.cssText = "";
    window.scrollTo(0, scrollY);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// FullScreenPostView
// ═════════════════════════════════════════════════════════════════════════════
const FullScreenPostView = ({
  post,
  profile,
  onClose,
  currentUser,
  // News-specific props (optional)
  newsArticleUrl = null,
  newsImageUrl   = null,
}) => {
  const [mobile,        setMobile]        = useState(isMobileWidth);
  const [showComments,  setShowComments]  = useState(false);
  const [showShare,     setShowShare]     = useState(false);
  const [commentSlideX, setCommentSlideX] = useState(0);

  const isNews = Boolean(newsArticleUrl || post?._isNews);

  const touchStartX = useRef(null);
  const isDragging  = useRef(false);
  const sidebarRef  = useRef(null);

  useEffect(() => {
    const onResize = () => setMobile(isMobileWidth());
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    lockScroll();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleTouchStart = useCallback((e) => {
    if (!mobile) return;
    const touch = e.touches[0];
    if (showComments || touch.clientX > window.innerWidth * 0.8) {
      touchStartX.current = touch.clientX;
      isDragging.current  = true;
    }
  }, [mobile, showComments]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current || touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    if (delta < 0) setCommentSlideX(Math.max(delta, -400));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    if (showComments) {
      if (commentSlideX < -80) { setShowComments(false); setCommentSlideX(0); }
      else                      { setCommentSlideX(0); }
    } else {
      if (commentSlideX < -40) { setShowComments(true);  setCommentSlideX(0); }
      else                      { setCommentSlideX(0); }
    }
    isDragging.current  = false;
    touchStartX.current = null;
  }, [showComments, commentSlideX]);

  // ── Shared content ─────────────────────────────────────────────────────
  // Determine effective image URL (news passes newsImageUrl; posts use their own)
  const heroImageUrl = newsImageUrl || null;

  const postContent = (
    <>
      <div className="fspv-header">
        <ProfilePreview profile={profile} size="medium" />
        <button className="fspv-close-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="fspv-body">
        {/* News hero image */}
        {heroImageUrl && (
          <div className="fspv-news-hero">
            <img src={heroImageUrl} alt="Article" className="fspv-news-hero-img" loading="lazy" />
          </div>
        )}

        <ParsedText text={post.content} />
      </div>

      <div className="fspv-footer">
        {isNews ? (
          /* News footer: "Visit full article" CTA */
          <a
            href={newsArticleUrl || post._articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fspv-news-cta"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
            Visit full article on source
          </a>
        ) : (
          <ReactionPanel
            content={{ ...post, type: "post" }}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
          />
        )}
      </div>
    </>
  );

  // ── Portal ─────────────────────────────────────────────────────────────
  const modal = (() => {
    if (!mobile) {
      return (
        <div className="fspv-root" role="dialog" aria-modal="true">
          <div className="fspv-backdrop" onClick={onClose} />
          <div
            className={`fspv-desktop-card${!isNews && showComments ? " with-comments" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fspv-desktop-post">{postContent}</div>

            {!isNews && showComments && (
              <div className="fspv-desktop-comments">
                <div className="fspv-comments-header">
                  <span>Comments</span>
                  <button className="fspv-comments-close-btn" onClick={() => setShowComments(false)} aria-label="Close comments">
                    <X size={15} />
                  </button>
                </div>
                <div className="fspv-comments-body">
                  <CommentModal
                    content={{ ...post, type: "post" }}
                    currentUser={currentUser}
                    onClose={() => setShowComments(false)}
                    embedded={true}
                  />
                </div>
              </div>
            )}
          </div>

          {!isNews && showShare && (
            <ShareModal
              content={{ ...post, type: "post" }}
              currentUser={currentUser}
              onClose={() => setShowShare(false)}
            />
          )}
        </div>
      );
    }

    return (
      <div
        className="fspv-root fspv-mobile"
        role="dialog"
        aria-modal="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="fspv-mobile-card" onClick={(e) => e.stopPropagation()}>
          {postContent}
        </div>

        {!isNews && (
          <div
            ref={sidebarRef}
            className={`fspv-mobile-sidebar${showComments ? " open" : ""}`}
            style={{
              transform: showComments
                ? `translateX(${commentSlideX}px)`
                : `translateX(calc(100% + ${commentSlideX}px))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fspv-comments-header">
              <button className="fspv-mobile-back-btn" onClick={() => setShowComments(false)}>
                <ChevronLeft size={15} /><span>Back</span>
              </button>
              <span className="fspv-comments-title">Comments</span>
            </div>
            <div className="fspv-comments-body">
              {showComments && (
                <CommentModal
                  content={{ ...post, type: "post" }}
                  currentUser={currentUser}
                  onClose={() => setShowComments(false)}
                  embedded={true}
                />
              )}
            </div>
          </div>
        )}

        {!isNews && showShare && (
          <ShareModal
            content={{ ...post, type: "post" }}
            currentUser={currentUser}
            onClose={() => setShowShare(false)}
          />
        )}
      </div>
    );
  })();

  return ReactDOM.createPortal(
    <>{modal}<style>{CSS}</style></>,
    document.body
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// CSS
// ═════════════════════════════════════════════════════════════════════════════
const CSS = `
.fspv-root {
  isolation: isolate;
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fspv-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: fspvFadeIn 0.2s ease both;
}
.fspv-desktop-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: row;
  width: min(820px, 90vw);
  max-height: 90vh;
  border-radius: 20px;
  overflow: hidden;
  background: #0f0f0f;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(132,204,22,0.06);
  animation: fspvSlideUp 0.25s cubic-bezier(0.34,1.2,0.64,1) both;
  transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
}
.fspv-desktop-card.with-comments { width: min(1120px, 94vw); }
.fspv-desktop-post { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.fspv-desktop-comments {
  width:320px; flex-shrink:0; border-left:1px solid rgba(255,255,255,0.07);
  display:flex; flex-direction:column; background:#111;
  animation:fspvSlideRight 0.22s cubic-bezier(0.34,1.1,0.64,1) both; overflow:hidden;
}
.fspv-mobile {
  align-items: stretch;
  justify-content: flex-start;
  background: #000;
  animation: fspvFadeIn 0.18s ease both;
}
.fspv-mobile-card {
  flex:1; display:flex; flex-direction:column; background:#000; overflow:hidden; min-width:0;
}
.fspv-mobile-sidebar {
  position:absolute; top:0; right:0; bottom:0; width:min(100%,400px);
  background:#141414; border-left:1px solid rgba(132,204,22,0.15);
  display:flex; flex-direction:column;
  transform:translateX(100%);
  transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
.fspv-mobile-sidebar.open { transform:translateX(0) !important; }

/* ── News hero image ─────────────────────────────────────────────────────── */
.fspv-news-hero {
  width:100%; max-height:260px; overflow:hidden; flex-shrink:0;
}
.fspv-news-hero-img {
  width:100%; height:260px; object-fit:cover; display:block;
}

/* ── News footer CTA ─────────────────────────────────────────────────────── */
.fspv-news-cta {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  width:100%; padding:10px 16px;
  border-radius:10px;
  background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.3);
  color:#84cc16; font-size:13px; font-weight:700; font-family:inherit;
  text-decoration:none;
  transition:background 0.15s,border-color 0.15s,transform 0.1s;
}
.fspv-news-cta:hover {
  background:rgba(132,204,22,0.18); border-color:rgba(132,204,22,0.5);
  transform:translateY(-1px);
}

.fspv-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px; border-bottom:1px solid rgba(132,204,22,0.1);
  flex-shrink:0; background:inherit;
}
.fspv-close-btn {
  width:38px; height:38px; border-radius:50%;
  background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
  color:rgba(255,255,255,0.65); display:flex; align-items:center; justify-content:center;
  cursor:pointer; flex-shrink:0; transition:background 0.18s,border-color 0.18s,color 0.18s,transform 0.18s;
}
.fspv-close-btn:hover {
  background:rgba(132,204,22,0.13); border-color:rgba(132,204,22,0.35); color:#84cc16; transform:scale(1.05);
}
.fspv-body {
  flex:1; overflow-y:auto; padding:20px 22px; color:#f0f0f0; font-size:17px; line-height:1.85;
  scrollbar-width:thin; scrollbar-color:rgba(132,204,22,0.4) rgba(255,255,255,0.03);
}
.fspv-body::-webkit-scrollbar { width:5px; }
.fspv-body::-webkit-scrollbar-track { background:rgba(255,255,255,0.02); }
.fspv-body::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.4); border-radius:3px; }
.fspv-footer {
  padding:12px 16px; border-top:1px solid rgba(132,204,22,0.08); flex-shrink:0;
}
.fspv-comments-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:13px 16px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0;
}
.fspv-comments-title { font-size:14px; font-weight:700; color:#e0e0e0; }
.fspv-comments-close-btn {
  width:28px; height:28px; border-radius:7px; background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.1); color:#777;
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  transition:background 0.15s,border-color 0.15s,color 0.15s;
}
.fspv-comments-close-btn:hover { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.3); color:#ef4444; }
.fspv-comments-body { flex:1; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(132,204,22,0.3) transparent; }
.fspv-comments-body::-webkit-scrollbar { width:4px; }
.fspv-comments-body::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.3); border-radius:3px; }
.fspv-mobile-back-btn {
  display:flex; align-items:center; gap:4px; background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#888;
  font-size:12px; font-weight:600; padding:5px 10px; cursor:pointer; font-family:inherit;
  transition:background 0.15s,color 0.15s;
}
.fspv-mobile-back-btn:hover { background:rgba(132,204,22,0.08); color:#84cc16; }
.fspv-mobile .fspv-header {
  position:sticky; top:0; z-index:2;
  background:rgba(0,0,0,0.9); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  padding:12px 14px;
}
.fspv-mobile .fspv-footer {
  position:sticky; bottom:0;
  background:rgba(0,0,0,0.9); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  padding:12px 14px;
}
@keyframes fspvFadeIn { from{opacity:0} to{opacity:1} }
@keyframes fspvSlideUp { from{opacity:0;transform:translateY(20px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes fspvSlideRight { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
`;

export default FullScreenPostView;