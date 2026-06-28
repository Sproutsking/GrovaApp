import React, { useState } from "react";
import { Lock, MoreVertical, Sparkles, Eye } from "lucide-react";
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
  const isLocked = story.unlock_cost > 0 && !story.unlocked;

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
    ? mediaUrlService.getStoryImageUrl(story.cover_image_id, 800)
    : null;

  const handleMenu = (e) => {
    e.stopPropagation();
    if (onActionMenu) {
      onActionMenu(e, { ...story, type: "story" }, isOwnStory);
    }
  };

  const handleUnlockOrRead = () => {
    if (isLocked) {
      if (onUnlock) onUnlock(story);
    } else {
      if (onOpenFull) onOpenFull(story);
    }
  };

  return (
    <>
      <div className="story-card">
        <div className="story-header">
          <ProfilePreview
            profile={profile}
            onClick={onAuthorClick}
            size="medium"
          />

          <div className="header-actions">
            <span className="category-tag">
              <Sparkles size={11} />
              {story.category}
            </span>
            <button className="menu-btn" onClick={handleMenu}>
              <MoreVertical size={17} />
            </button>
          </div>
        </div>

        {coverImageUrl && (
          <div className="story-cover" onClick={handleUnlockOrRead}>
            <img src={coverImageUrl} alt={story.title} className="cover-img" />
            <div className="cover-gradient" />
            {isLocked && (
              <div className="lock-badge">
                <Lock size={14} />
                <span>Premium</span>
              </div>
            )}
          </div>
        )}

        <div className="story-body">
          <h2 className="story-title" onClick={handleUnlockOrRead}>
            {story.title}
          </h2>

          <div className="story-preview-wrapper">
            <p className="story-preview">
              <ParsedText
                text={story.preview}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
              <span className="preview-fade" />
            </p>

            <button
              className={`inline-action-btn ${isLocked ? "locked" : "unlocked"}`}
              onClick={handleUnlockOrRead}
            >
              {isLocked ? (
                <>
                  <Lock size={13} />
                  <span>Unlock for {story.unlock_cost} XEV</span>
                </>
              ) : (
                <>
                  <Eye size={13} />
                  <span>Read Full Story</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="story-footer">
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

      <style>{`
        .story-card {
          border-radius: 28px;
          overflow: hidden;
          background: radial-gradient(circle at top left, rgba(132,204,22,0.18), transparent 25%),
                      linear-gradient(180deg, rgba(10,10,10,0.96), rgba(15,15,15,0.95));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 60px rgba(0,0,0,0.18);
          transition: transform 0.24s ease, border-color 0.24s ease;
        }
        .story-card:hover {
          transform: translateY(-2px);
          border-color: rgba(132,204,22,0.28);
        }
        .story-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px 0;
          gap: 12px;
        }
        .story-cover {
          position: relative;
          cursor: pointer;
          height: 320px;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, rgba(18,18,18,0.88), rgba(8,8,8,0.95));
        }
        .story-cover:hover .cover-img {
          transform: scale(1.04);
        }
        .cover-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .cover-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.9));
        }
        .lock-badge {
          position: absolute;
          left: 18px;
          top: 18px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(15,23,42,0.86);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f8fafc;
          font-size: 13px;
          font-weight: 700;
          backdrop-filter: blur(8px);
        }
        .story-body {
          padding: 24px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .story-title {
          font-size: 1.65rem;
          line-height: 1.08;
          margin: 0;
          color: #f8fafc;
          letter-spacing: -0.03em;
          cursor: pointer;
          max-width: 100%;
        }
        .story-preview-wrapper {
          position: relative;
          min-height: 110px;
        }
        .story-preview {
          margin: 0;
          color: rgba(255,255,255,0.78);
          font-size: 0.98rem;
          line-height: 1.75;
          max-height: 7.8rem;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }
        .preview-fade {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 48px;
          background: linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,0.92));
          pointer-events: none;
        }
        .inline-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          border-radius: 999px;
          padding: 13px 18px;
          font-size: 0.96rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
          white-space: nowrap;
        }
        .inline-action-btn:hover {
          transform: translateY(-1px);
        }
        .inline-action-btn.locked {
          color: #fef9c3;
          background: linear-gradient(135deg, rgba(219,39,119,0.1), rgba(132,204,22,0.18));
          box-shadow: 0 18px 40px rgba(132,204,22,0.12);
        }
        .inline-action-btn.unlocked {
          color: #d4d4d8;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .story-footer {
          padding: 0 20px 20px;
        }
        .story-header .category-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(132,204,22,0.12);
          color: #d4f89f;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .menu-btn {
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
          color: #e5e7eb;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .menu-btn:hover {
          background: rgba(255,255,255,0.12);
        }
        @media (max-width: 640px) {
          .story-card {
            border-radius: 22px;
          }
          .story-cover {
            height: 260px;
          }
          .story-body {
            padding: 18px 16px 18px;
          }
          .story-title {
            font-size: 1.35rem;
          }
          .story-preview-wrapper {
            min-height: 90px;
          }
        }
      `}</style>
    </>
  );
};

export default StoryCard;
