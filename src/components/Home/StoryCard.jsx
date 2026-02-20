// ============================================================================
// src/components/Home/StoryCard.jsx - PREMIUM STORYTELLING DESIGN (FIXED)
// ============================================================================

import React, { useState } from "react";
import { Lock, BookOpen, Eye, Clock, Sparkles } from "lucide-react";
import ProfilePreview from "../Shared/ProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";

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

  const isOwnStory = story.user_id === currentUser?.id;
  const isLocked = story.unlock_cost > 0 && !story.unlocked && !isOwnStory;
  const isFree = story.unlock_cost === 0;

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

  const handleUnlockOrRead = () => {
    if (isLocked) {
      onUnlock(story);
    } else if (onOpenFull) {
      onOpenFull(story);
    }
  };

  // Calculate estimated reading time (assuming 200 words per minute)
  const getReadingTime = () => {
    if (!story.full_content) return "5 min";
    const wordCount = story.full_content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    return `${minutes} min read`;
  };

  return (
    <>
      <div className="story-card-premium">
        {/* Hero Cover Section */}
        <div className="story-hero" onClick={handleUnlockOrRead}>
          {coverImageUrl ? (
            <>
              <img
                src={coverImageUrl}
                alt={story.title}
                className="story-hero-image"
              />
              <div className="story-hero-gradient" />
            </>
          ) : (
            <div className="story-hero-placeholder">
              <BookOpen size={60} className="hero-icon" />
            </div>
          )}

          {/* Category Badge */}
          <div className="story-category-floating">
            <Sparkles size={14} />
            <span>{story.category}</span>
          </div>

          {/* Lock Badge - Only show if story costs money */}
          {isLocked && (
            <div className="story-lock-floating">
              <Lock size={16} />
              <span>Premium Story</span>
            </div>
          )}

          {/* Reading Time Badge - Show for free/unlocked stories */}
          {!isLocked && (
            <div className="story-time-badge">
              <Clock size={14} />
              <span>{getReadingTime()}</span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="story-content-section">
          {/* Author Header with Action Button */}
          <div className="story-author-header">
            <ProfilePreview
              profile={profile}
              onClick={onAuthorClick}
              size="small"
            />

            {/* Unlock/Read Button - Compact Design */}
            {isLocked ? (
              <button
                className="story-action-btn unlock-compact"
                onClick={handleUnlockOrRead}
              >
                <Lock size={14} />
                <span>{story.unlock_cost} GT</span>
              </button>
            ) : (
              <button
                className="story-action-btn read-compact"
                onClick={handleUnlockOrRead}
              >
                <BookOpen size={14} />
                <span>Read</span>
              </button>
            )}
          </div>

          {/* Title */}
          <h2 className="story-title-premium" onClick={handleUnlockOrRead}>
            {story.title}
          </h2>

          {/* Preview Text with 2-line limit */}
          <div className="story-preview-container">
            <p className="story-preview-text">
              <ParsedText
                text={story.preview}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
            </p>

            {/* View Stats - Compact */}
            <div className="story-stats-compact">
              <div className="stat-compact">
                <Eye size={12} />
                <span>{story.views?.toLocaleString() || 0}</span>
              </div>
              <div className="stat-compact">
                <Clock size={12} />
                <span>{getReadingTime()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="story-footer-premium">
          <ReactionPanel
            content={{ ...story, type: "story" }}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
          />
        </div>
      </div>

      {showComments && (
        <CommentModal
          content={{ ...story, type: "story" }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={window.innerWidth <= 768}
        />
      )}

      {showShare && (
        <ShareModal
          content={{ ...story, type: "story" }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
};

export default StoryCard;
