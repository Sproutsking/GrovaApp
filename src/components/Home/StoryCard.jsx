// ============================================================================
// src/components/Home/StoryCard.jsx
// Changes from original (structure UNCHANGED, precision additions only):
//  [1] isFollowing state + checkFollowStatus() on mount — mirrors UserProfileModal exactly
//  [2] handleFollowToggle() — optimistic update + followService call, mirrors UserProfileModal
//  [3] Follow/Unfollow button replaces category badge in author header
//  [4] Timestamp (relative) added next to username
//  [5] Category tag moved below preview text as a small pill
//  All other JSX, portal modals, unlock logic — UNCHANGED
// ============================================================================

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Lock, BookOpen, Eye, Clock, Sparkles, UserPlus, UserCheck } from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";
import followService from "../../services/social/followService";  // [1]

// ── relative timestamp ────────────────────────────────────────────────────────
const relTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const StoryCard = ({
  story,
  currentUser,
  onAuthorClick,
  onUnlock,
  onActionMenu,
  onOpenFull,
  onHashtagClick,
  onMentionClick,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showShare,    setShowShare]    = useState(false);

  // [1] Follow state — mirrors UserProfileModal pattern exactly
  const [isFollowing,  setIsFollowing]  = useState(false);

  const isOwnStory = story.user_id === currentUser?.id;
  const isLocked   = story.unlock_cost > 0 && !story.unlocked && !isOwnStory;

  const profile = {
    userId:   story.user_id,
    author:   story.profiles?.full_name  || story.author   || "Unknown",
    username: story.profiles?.username   || story.username || "unknown",
    avatar:   story.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(story.profiles.avatar_id, 200)
      : null,
    verified: story.profiles?.verified || story.verified || false,
  };

  const coverImageUrl = story.cover_image_id
    ? mediaUrlService.getStoryImageUrl(story.cover_image_id, 1200)
    : null;

  // [1] Check follow status on mount — mirrors UserProfileModal.checkFollowStatus()
  useEffect(() => {
    if (!currentUser?.id || isOwnStory) return;
    followService.isFollowing(currentUser.id, story.user_id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [story.user_id, currentUser?.id, isOwnStory]);

  // [2] Follow toggle — mirrors UserProfileModal.handleFollowToggle() exactly
  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing;
    setIsFollowing(next); // optimistic
    try {
      if (next) await followService.followUser(currentUser.id, story.user_id);
      else      await followService.unfollowUser(currentUser.id, story.user_id);
    } catch {
      setIsFollowing(!next); // rollback
    }
  };

  const handleUnlockOrRead = () => {
    if (isLocked) onUnlock(story);
    else if (onOpenFull) onOpenFull(story);
  };

  const getReadingTime = () => {
    if (!story.full_content) return "5 min";
    const wordCount = story.full_content.split(/\s+/).length;
    const minutes   = Math.ceil(wordCount / 200);
    return `${minutes} min read`;
  };

  const storyWithType = { ...story, type: "story" };

  return (
    <>
      <div className="story-card-premium">

        {/* Hero Cover — UNCHANGED */}
        <div className="story-hero" onClick={handleUnlockOrRead}>
          {coverImageUrl ? (
            <>
              <img src={coverImageUrl} alt={story.title} className="story-hero-image" />
              <div className="story-hero-gradient" />
            </>
          ) : (
            <div className="story-hero-placeholder">
              <BookOpen size={60} className="hero-icon" />
            </div>
          )}

          <div className="story-category-floating">
            <Sparkles size={14} />
            <span>{story.category}</span>
          </div>

          {isLocked ? (
            <div className="story-lock-floating">
              <Lock size={16} />
              <span>Premium Story</span>
            </div>
          ) : (
            <div className="story-time-badge">
              <Clock size={14} />
              <span>{getReadingTime()}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="story-content-section">

          {/* [3] Author header: ProfilePreview + timestamp + Follow/Unfollow */}
          <div className="story-author-header">
            <ProfilePreview profile={profile} onClick={onAuthorClick} size="small" />

            {/* [4] Timestamp */}
            {story.created_at && (
              <span className="story-timestamp">{relTime(story.created_at)}</span>
            )}

            {/* [3] Follow/Unfollow replaces category badge */}
            {!isOwnStory && currentUser?.id && (
              <button
                className={`story-follow-btn${isFollowing ? " following" : ""}`}
                onClick={handleFollowToggle}
              >
                {isFollowing
                  ? <><UserCheck size={13} /><span>Following</span></>
                  : <><UserPlus size={13} /><span>Follow</span></>
                }
              </button>
            )}

            {/* Unlock / Read CTA — UNCHANGED position */}
            {isLocked ? (
              <button className="story-action-btn unlock-compact" onClick={handleUnlockOrRead}>
                <Lock size={14} />
                <span>{story.unlock_cost} GT</span>
              </button>
            ) : (
              <button className="story-action-btn read-compact" onClick={handleUnlockOrRead}>
                <BookOpen size={14} />
                <span>Read</span>
              </button>
            )}
          </div>

          <h2 className="story-title-premium" onClick={handleUnlockOrRead}>{story.title}</h2>

          <div className="story-preview-container">
            <p className="story-preview-text">
              <ParsedText text={story.preview} onHashtagClick={onHashtagClick} onMentionClick={onMentionClick} />
            </p>

            {/* [5] Category tag — moved from hero to here */}
            {story.category && (
              <div className="story-category-tag">
                <span className="story-cat-dot" />
                <span>{story.category}</span>
              </div>
            )}

            <div className="story-stats-compact">
              <div className="stat-compact"><Eye size={12} /><span>{story.views?.toLocaleString() || 0}</span></div>
              <div className="stat-compact"><Clock size={12} /><span>{getReadingTime()}</span></div>
            </div>
          </div>
        </div>

        {/* Footer — UNCHANGED */}
        <div className="story-footer-premium">
          <ReactionPanel
            content={storyWithType}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
          />
        </div>
      </div>

      {/* Styles for new elements only */}
      <style>{`
        .story-timestamp {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .story-follow-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
          white-space: nowrap;
          font-family: inherit;
          background: transparent;
          border: 1px solid rgba(132,204,22,0.45);
          color: #84cc16;
        }
        .story-follow-btn:hover {
          background: rgba(132,204,22,0.1);
        }
        .story-follow-btn.following {
          background: rgba(132,204,22,0.1);
          border-color: rgba(132,204,22,0.25);
          color: rgba(132,204,22,0.8);
        }
        .story-follow-btn.following:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.3);
          color: #ef4444;
        }
        .story-category-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          border-radius: 999px;
          background: rgba(132,204,22,0.07);
          border: 1px solid rgba(132,204,22,0.18);
          margin-bottom: 8px;
          width: fit-content;
        }
        .story-cat-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #84cc16;
          flex-shrink: 0;
        }
        .story-category-tag span:last-child {
          font-size: 10.5px;
          font-weight: 700;
          color: rgba(132,204,22,0.8);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1;
        }
      `}</style>

      {/* CommentModal — portalled so bottom nav never clips it */}
      {showComments && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
          <CommentModal
            content={storyWithType}
            currentUser={currentUser}
            onClose={() => setShowComments(false)}
            isMobile={window.innerWidth <= 768}
          />
        </div>,
        document.body
      )}

      {/* ShareModal — portalled into document.body, never clipped */}
      {showShare && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
          <ShareModal
            content={storyWithType}
            currentUser={currentUser}
            onClose={() => setShowShare(false)}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default StoryCard;