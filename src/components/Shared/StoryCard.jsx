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
          border-radius: 16px;
          overflow: hidden;
          background: linear-gradient(145deg, rgba(25,31,21,0.98), rgba(14,18,14,0.98));
          border: 1px solid rgba(132,204,22,0.16);
          box-shadow: 0 8px 26px rgba(0,0,0,0.2);
          margin-bottom: 14px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .story-card:hover {
          border-color: rgba(132,204,22,0.34);
          box-shadow: 0 14px 34px rgba(0,0,0,0.28);
        }
        .story-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px 12px;
          gap: 12px;
        }
        .story-cover {
          position: relative;
          cursor: pointer;
          height: 272px;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(79,174,124,0.12), rgba(8,12,8,0.96));
        }
        .story-cover:hover .cover-img {
          transform: scale(1.04);
        }
        .cover-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s ease;
        }
        .cover-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(5,8,5,0.08), rgba(5,8,5,0.18) 42%, rgba(5,8,5,0.92));
        }
        .lock-badge {
          position: absolute;
          left: 20px;
          top: 20px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          border-radius: 999px;
          background: rgba(201,162,39,0.16);
          border: 1px solid rgba(201,162,39,0.42);
          color: #e9c95c;
          font-size: 12px;
          font-weight: 700;
          backdrop-filter: blur(12px);
        }
        .story-body {
          padding: 20px 22px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .story-title {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 1.55rem;
          line-height: 1.18;
          margin: 0;
          color: #f8fafc;
          letter-spacing: 0;
          cursor: pointer;
          max-width: 100%;
        }
        .story-preview-wrapper {
          position: relative;
          min-height: 0;
        }
        .story-preview {
          margin: 0;
          color: rgba(226,232,220,0.72);
          font-size: 0.93rem;
          line-height: 1.65;
          max-height: 3.1rem;
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
          height: 34px;
          background: linear-gradient(180deg, rgba(14,18,14,0), rgba(14,18,14,0.98));
          pointer-events: none;
        }
        .inline-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          border-radius: 8px;
          padding: 9px 13px;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
          white-space: nowrap;
        }
        .inline-action-btn:hover {
          transform: translateY(-1px);
        }
        .inline-action-btn.locked {
          color: #e9c95c;
          background: rgba(201,162,39,0.12);
          border: 1px solid rgba(201,162,39,0.3);
          box-shadow: none;
        }
        .inline-action-btn.unlocked {
          color: #d4d4d8;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .story-footer {
          padding: 0 22px 14px;
          border-top: 1px solid rgba(132,204,22,0.1);
        }
        .story-footer .rp-panel {
          margin-top: 0;
          padding: 0;
          gap: 4px;
          min-height: 34px;
        }
        .story-footer .rp-btn,
        .story-footer .rp-stat {
          min-height: 32px;
          padding: 5px 8px;
          border-radius: 7px;
          font-size: 12px;
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
            border-radius: 0;
            margin-bottom: 1px;
            border-left: none;
            border-right: none;
          }
          .story-header {
            padding: 16px 16px 10px;
          }
          .story-cover {
            height: 228px;
          }
          .story-body {
            padding: 18px 16px 18px;
          }
          .story-title {
            font-size: 1.3rem;
          }
          .story-preview-wrapper {
            min-height: 0;
          }
          .story-footer {
            padding: 10px 14px 8px;
          }
          .story-footer .rp-btn,
          .story-footer .rp-stat {
            padding-left: 5px;
            padding-right: 5px;
            font-size: 11px;
          }
        }
      `}</style>
    </>
  );
};

export default StoryCard;
