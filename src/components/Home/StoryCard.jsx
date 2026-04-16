// ============================================================================
// src/components/Home/StoryCard.jsx  — v3
//
// GESTURE ENGINE:
//   Stories are text/image content — no video.
//   • Double tap = heart burst + like (instant)
//   • Single tap = no-op (onSingleTap not passed)
//   • The "Read" / "Unlock" buttons use stopPropagation
// ============================================================================

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  Lock,
  BookOpen,
  Eye,
  Clock,
  Sparkles,
  UserPlus,
  UserCheck,
  TrendingUp,
  Heart,
  Gift,
} from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";
import followService from "../../services/social/followService";
import storyService from "../../services/home/storyService";
import DoubleTapHeart from "../Shared/DoubleTapHeart";

const relTime = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d`;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
  const [showShare, setShowShare] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(story.likes || 0);
  const [imgErr, setImgErr] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isOwnStory = story.user_id === currentUser?.id;
  const isLocked = story.unlock_cost > 0 && !story.unlocked && !isOwnStory;
  const isPremium = story.unlock_cost > 0;
  const isFree = !isPremium;

  const profile = {
    userId: story.user_id,
    author: story.profiles?.full_name || story.author || "Unknown",
    username: story.profiles?.username || story.username || "unknown",
    avatar: story.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(story.profiles.avatar_id, 200)
      : null,
    verified: story.profiles?.verified || story.verified || false,
  };

  const coverImageUrl = story.cover_image_id
    ? mediaUrlService.getStoryImageUrl(story.cover_image_id, 1200)
    : null;

  const getReadingTime = () => {
    const text = story.full_content || story.preview || "";
    return `${Math.max(1, Math.ceil(text.split(/\s+/).length / 200))} min`;
  };

  const getWordCount = () => {
    const text = story.full_content || story.preview || "";
    const wc = text.split(/\s+/).filter(Boolean).length;
    return wc > 1000 ? `${(wc / 1000).toFixed(1)}k` : wc;
  };

  useEffect(() => {
    if (!currentUser?.id || isOwnStory) return;
    followService
      .isFollowing(currentUser.id, story.user_id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [story.user_id, currentUser?.id, isOwnStory]); // eslint-disable-line

  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      if (next) await followService.followUser(currentUser.id, story.user_id);
      else await followService.unfollowUser(currentUser.id, story.user_id);
    } catch {
      setIsFollowing(!next);
    }
  };

  // Double-tap like — stories have no video so no single-tap conflict
  const handleDoubleTapLike = async () => {
    if (!currentUser?.id || liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    try {
      await storyService.toggleLike(story.id);
    } catch {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    }
  };

  const handleUnlockOrRead = (e) => {
    e?.stopPropagation();
    if (isLocked) onUnlock?.(story);
    else onOpenFull?.(story);
  };

  const storyWT = { ...story, type: "story", likes: likeCount };

  return (
    <>
      {/*
        Stories are text/image only — no onSingleTap needed.
        Double tap = heart burst, instantly.
      */}
      <DoubleTapHeart
        contentId={story.id}
        contentType="story"
        onLike={handleDoubleTapLike}
        alreadyLiked={liked}
      >
        <div className="story-card-premium">
          {/* HERO */}
          <div
            className="story-hero"
            onClick={handleUnlockOrRead}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleUnlockOrRead(e)}
          >
            {coverImageUrl && !imgErr ? (
              <>
                <img
                  src={coverImageUrl}
                  alt={story.title}
                  className="story-hero-image"
                  onError={() => setImgErr(true)}
                  loading="lazy"
                />
                <div className="story-hero-gradient" />
              </>
            ) : (
              <div className="story-hero-placeholder">
                <BookOpen size={60} className="hero-icon" />
                <div className="story-hero-orb story-hero-orb--1" />
                <div className="story-hero-orb story-hero-orb--2" />
                <div className="story-hero-orb story-hero-orb--3" />
              </div>
            )}

            <div className="story-category-floating">
              <Sparkles size={12} />
              <span>{story.category || "Story"}</span>
            </div>

            {isLocked ? (
              <div className="story-lock-floating">
                <Lock size={14} />
                <span>Premium · {story.unlock_cost} GT</span>
              </div>
            ) : (
              <div className="story-time-badge">
                <Clock size={12} />
                <span>{getReadingTime()} read</span>
              </div>
            )}
            {isPremium && isOwnStory && (
              <div className="story-earn-badge">
                <TrendingUp size={11} />
                <span>Earn {story.unlock_cost} GT/read</span>
              </div>
            )}
            {isFree && (
              <div className="story-free-badge">
                <Gift size={11} />
                <span>Free</span>
              </div>
            )}
          </div>

          {/* CONTENT */}
          <div className="story-content-section">
            <div className="story-author-header">
              <ProfilePreview
                profile={profile}
                onClick={onAuthorClick}
                size="small"
              />
              {story.created_at && (
                <span className="story-timestamp">
                  {relTime(story.created_at)}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {!isOwnStory && currentUser?.id && (
                <button
                  className={`story-follow-btn${isFollowing ? " following" : ""}`}
                  onClick={handleFollowToggle}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={12} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={12} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
              {isLocked ? (
                <button
                  className="story-action-btn unlock-compact"
                  onClick={handleUnlockOrRead}
                >
                  <Lock size={13} />
                  <span>{story.unlock_cost} GT</span>
                </button>
              ) : (
                <button
                  className="story-action-btn read-compact"
                  onClick={handleUnlockOrRead}
                >
                  <BookOpen size={13} />
                  <span>Read</span>
                </button>
              )}
            </div>

            <h2 className="story-title-premium" onClick={handleUnlockOrRead}>
              {story.title}
            </h2>

            <div className="story-preview-container">
              <div
                className={`story-preview-text${expanded ? " expanded" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                <ParsedText
                  text={story.preview || ""}
                  onHashtagClick={onHashtagClick}
                  onMentionClick={onMentionClick}
                />
                {!expanded && story.preview && story.preview.length > 120 && (
                  <span className="story-preview-more"> ...more</span>
                )}
              </div>

              {story.category && (
                <div className="story-category-tag">
                  <span className="story-cat-dot" />
                  <span>{story.category}</span>
                </div>
              )}

              <div className="story-stats-compact">
                <div className="stat-compact">
                  <Eye size={11} />
                  <span>{(story.views || 0).toLocaleString()}</span>
                </div>
                <div className="stat-compact">
                  <Clock size={11} />
                  <span>{getReadingTime()}</span>
                </div>
                <div className="stat-compact">
                  <BookOpen size={11} />
                  <span>{getWordCount()} words</span>
                </div>
                {isPremium && (
                  <div className="stat-compact stat-compact--earn">
                    <TrendingUp size={11} />
                    <span>{story.unlock_cost} GT</span>
                  </div>
                )}
              </div>

              {isFree && story.preview && story.preview.length > 60 && (
                <div className="story-inspire-callout">
                  <Heart size={12} style={{ color: "#ec4899" }} />
                  <span>Free story — shared to inspire</span>
                </div>
              )}
            </div>
          </div>

          <div className="story-footer-premium">
            <ReactionPanel
              content={storyWT}
              currentUser={currentUser}
              onComment={() => setShowComments(true)}
              onShare={() => setShowShare(true)}
              layout="horizontal"
            />
          </div>
        </div>
      </DoubleTapHeart>

      {showComments &&
        ReactDOM.createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
            <CommentModal
              content={storyWT}
              currentUser={currentUser}
              onClose={() => setShowComments(false)}
              isMobile={window.innerWidth <= 768}
            />
          </div>,
          document.body,
        )}
      {showShare &&
        ReactDOM.createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
            <ShareModal
              content={storyWT}
              currentUser={currentUser}
              onClose={() => setShowShare(false)}
            />
          </div>,
          document.body,
        )}

      <style>{STORY_CSS}</style>
    </>
  );
};

const STORY_CSS = `
.story-card-premium{background:var(--card-bg,#111);border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden;position:relative;transition:border-color 0.2s,box-shadow 0.2s;}
.story-card-premium::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#84cc16,#a78bfa,#ec4899);opacity:0.7;z-index:1;}
.story-card-premium:hover{border-color:rgba(132,204,22,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.3);}
@media(max-width:768px){.story-card-premium{border-radius:0!important;border-left:none;border-right:none;}}
.story-hero{position:relative;width:100%;height:220px;overflow:hidden;background:#0a0a0a;cursor:pointer;}
.story-hero-image{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.4s ease;}
.story-card-premium:hover .story-hero-image{transform:scale(1.03);}
.story-hero-gradient{position:absolute;bottom:0;left:0;right:0;height:65%;background:linear-gradient(to top,#0a0a0a 0%,rgba(10,10,10,0.6) 60%,transparent 100%);}
.story-hero-placeholder{width:100%;height:100%;background:linear-gradient(135deg,#0f1a0a,#0a0a1a,#1a0a1a);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.hero-icon{color:rgba(132,204,22,0.2);z-index:1;}
.story-hero-orb{position:absolute;border-radius:50%;animation:stOrbFloat 6s ease-in-out infinite;}
.story-hero-orb--1{width:80px;height:80px;background:radial-gradient(circle,rgba(132,204,22,0.15),transparent);top:20%;left:15%;}
.story-hero-orb--2{width:120px;height:120px;background:radial-gradient(circle,rgba(167,139,250,0.1),transparent);bottom:20%;right:20%;animation-delay:2s;}
.story-hero-orb--3{width:60px;height:60px;background:radial-gradient(circle,rgba(236,72,153,0.1),transparent);top:50%;right:35%;animation-delay:4s;}
@keyframes stOrbFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-12px) scale(1.05)}}
.story-category-floating{position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);border:1px solid rgba(132,204,22,0.35);font-size:10px;font-weight:800;color:#84cc16;text-transform:uppercase;letter-spacing:0.06em;}
.story-lock-floating{position:absolute;top:12px;right:12px;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);border:1px solid rgba(251,191,36,0.4);font-size:10px;font-weight:800;color:#fbbf24;}
.story-time-badge{position:absolute;top:12px;right:12px;display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);}
.story-earn-badge{position:absolute;bottom:12px;left:12px;display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);border:1px solid rgba(132,204,22,0.4);font-size:10px;font-weight:800;color:#84cc16;}
.story-free-badge{position:absolute;bottom:12px;right:12px;display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;background:rgba(236,72,153,0.15);backdrop-filter:blur(8px);border:1px solid rgba(236,72,153,0.4);font-size:10px;font-weight:800;color:#f472b6;}
.story-content-section{padding:14px 16px 10px;}
.story-author-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.story-timestamp{font-size:11px;color:rgba(255,255,255,0.35);font-weight:500;white-space:nowrap;flex-shrink:0;}
.story-follow-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;font-family:inherit;background:transparent;border:1px solid rgba(132,204,22,0.45);color:#84cc16;transition:all 0.2s;}
.story-follow-btn:hover{background:rgba(132,204,22,0.1);}
.story-follow-btn.following{background:rgba(132,204,22,0.08);border-color:rgba(132,204,22,0.22);color:rgba(132,204,22,0.75);}
.story-follow-btn.following:hover{background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.3);color:#ef4444;}
.story-action-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;font-family:inherit;transition:all 0.15s;}
.story-action-btn.unlock-compact{background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.35);color:#fbbf24;}
.story-action-btn.unlock-compact:hover{background:rgba(251,191,36,0.2);transform:translateY(-1px);}
.story-action-btn.read-compact{background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.35);color:#84cc16;}
.story-action-btn.read-compact:hover{background:rgba(132,204,22,0.2);transform:translateY(-1px);}
.story-title-premium{font-size:16px;font-weight:900;color:#f5f5f5;line-height:1.35;margin:0 0 10px;cursor:pointer;word-break:break-word;transition:color 0.15s;}
.story-title-premium:hover{color:#84cc16;}
.story-preview-text{font-size:13.5px;color:rgba(255,255,255,0.65);line-height:1.65;margin:0 0 8px;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;transition:color 0.15s;}
.story-preview-text.expanded{display:block;-webkit-line-clamp:unset;}
.story-preview-text:hover{color:rgba(255,255,255,0.8);}
.story-preview-more{color:rgba(132,204,22,0.7);font-weight:700;font-size:12.5px;}
.story-category-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px 3px 7px;border-radius:999px;background:rgba(132,204,22,0.07);border:1px solid rgba(132,204,22,0.18);margin-bottom:8px;width:fit-content;}
.story-cat-dot{width:5px;height:5px;border-radius:50%;background:#84cc16;flex-shrink:0;}
.story-category-tag span:last-child{font-size:10px;font-weight:700;color:rgba(132,204,22,0.8);letter-spacing:0.04em;text-transform:uppercase;}
.story-stats-compact{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.stat-compact{display:flex;align-items:center;gap:4px;font-size:11px;color:rgba(255,255,255,0.3);font-weight:600;}
.stat-compact--earn{color:rgba(132,204,22,0.7);}
.stat-compact--earn svg{color:#84cc16;}
.story-inspire-callout{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:8px;margin-top:4px;background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.15);font-size:11.5px;color:rgba(236,72,153,0.8);font-weight:600;}
.story-footer-premium{padding:8px 14px 12px;border-top:1px solid rgba(255,255,255,0.05);}
`;

export default StoryCard;
