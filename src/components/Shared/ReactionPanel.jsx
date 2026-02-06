import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Heart, MessageCircle, Share2, Eye, Bookmark } from "lucide-react";
import LikeModel from "../../models/LikeModel";
import SaveModel from "../../models/SaveModel";
import { useToast } from "../../contexts/ToastContext";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";

const ReactionPanel = ({
  content,
  currentUser,
  layout = "horizontal",
  showSave = true,
  showViews = true,
  className = "",
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(content.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (currentUser?.id) {
      checkLikedStatus();
      checkSavedStatus();
    }
  }, [content.id, currentUser?.id]);

  const checkLikedStatus = async () => {
    const isLiked = await LikeModel.checkIfLiked(
      content.type,
      content.id,
      currentUser.id,
    );
    setLiked(isLiked);
  };

  const checkSavedStatus = async () => {
    const isSaved = await SaveModel.checkIfSaved(
      content.type,
      content.id,
      currentUser.id,
    );
    setSaved(isSaved);
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      showToast("warning", "Please login to like");
      return;
    }

    // OPTIMISTIC UPDATE - instant UI feedback
    const wasLiked = liked;
    const previousCount = likeCount;

    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);

    if (!wasLiked) {
      showToast("success", "Liked!", "+1 EP earned");
    }

    // Background sync - no blocking
    LikeModel.toggleLike(content.type, content.id, currentUser.id)
      .then((result) => {
        // Update with server result if different
        if (result.liked !== !wasLiked) {
          setLiked(result.liked);
        }
        if (result.newCount !== previousCount + (wasLiked ? -1 : 1)) {
          setLikeCount(result.newCount);
        }
      })
      .catch((error) => {
        // Rollback on error
        setLiked(wasLiked);
        setLikeCount(previousCount);
        showToast("error", "Failed to like");
      });
  };

  const handleComment = (e) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    setShowShareModal(true);
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      showToast("warning", "Please login to save");
      return;
    }

    // OPTIMISTIC UPDATE
    const wasSaved = saved;
    setSaved(!saved);
    showToast("success", !wasSaved ? "Saved!" : "Removed from saved");

    // Background sync
    SaveModel.saveContent(content.type, content.id, currentUser.id).catch(
      (error) => {
        setSaved(wasSaved);
        showToast("error", "Failed to save");
      },
    );
  };

  const formatNumber = (num) => {
    if (!num || num === 0) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <div className={`reaction-panel reaction-panel-${layout} ${className}`}>
        <button
          className={`reaction-btn ${liked ? "reaction-btn-active" : ""}`}
          onClick={handleLike}
        >
          <Heart
            size={18}
            fill={liked ? "#ef4444" : "none"}
            color={liked ? "#ef4444" : "#e5e5e5"}
          />
          <span>{formatNumber(likeCount)}</span>
        </button>

        <button className="reaction-btn" onClick={handleComment}>
          <MessageCircle size={18} />
          <span>{formatNumber(content.comments_count || 0)}</span>
        </button>

        <button className="reaction-btn" onClick={handleShare}>
          <Share2 size={18} />
          <span>{formatNumber(content.shares || 0)}</span>
        </button>

        {showSave && (
          <button
            className={`reaction-btn ${saved ? "reaction-btn-active" : ""}`}
            onClick={handleSave}
          >
            <Bookmark
              size={18}
              fill={saved ? "#fbbf24" : "none"}
              color={saved ? "#fbbf24" : "#e5e5e5"}
            />
          </button>
        )}

        {showViews && (
          <span className="reaction-stat">
            <Eye size={18} />
            <span>{formatNumber(content.views || 0)}</span>
          </span>
        )}
      </div>

      {showComments &&
        ReactDOM.createPortal(
          <CommentModal
            content={content}
            currentUser={currentUser}
            onClose={() => setShowComments(false)}
            isMobile={window.innerWidth <= 768}
          />,
          document.body,
        )}

      {showShareModal &&
        ReactDOM.createPortal(
          <ShareModal
            content={content}
            currentUser={currentUser}
            onClose={() => setShowShareModal(false)}
          />,
          document.body,
        )}

      <style jsx>{`
        .reaction-panel {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          margin-top: 6px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.015)
          );
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
        }

        .reaction-panel-horizontal {
          gap: 10px;
        }
        .reaction-panel-vertical {
          flex-direction: column;
          gap: 8px;
        }

        .reaction-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 12px;
          border-radius: 12px;
          background: transparent;
          border: none;
          color: #d4d4d4;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .reaction-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          opacity: 0;
          transform: scale(0.92);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: -1;
        }

        .reaction-btn:active {
          transform: scale(0.94);
        }

        .reaction-btn:active::before {
          opacity: 1;
          transform: scale(1);
        }

        .reaction-btn-active {
          color: #84cc16;
        }

        .reaction-btn-active::before {
          opacity: 1;
          background: radial-gradient(
            circle at top,
            rgba(132, 204, 22, 0.25),
            rgba(132, 204, 22, 0.1)
          );
          box-shadow:
            inset 0 0 0 1px rgba(132, 204, 22, 0.4),
            0 4px 14px rgba(132, 204, 22, 0.25);
        }

        .reaction-btn svg {
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .reaction-btn:active svg {
          transform: scale(1.15);
        }

        .reaction-btn-active svg {
          transform: scale(1.1);
        }

        .reaction-btn span {
          font-variant-numeric: tabular-nums;
          opacity: 0.85;
        }

        .reaction-stat {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 10px;
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 600;
          opacity: 0.7;
        }

        .reaction-panel-horizontal > :nth-child(1),
        .reaction-panel-horizontal > :nth-child(2),
        .reaction-panel-horizontal > :nth-child(3) {
          flex: 1;
          justify-content: center;
        }

        .reaction-panel-horizontal > :last-child {
          margin-left: auto;
        }

        @media (max-width: 768px) {
          .reaction-panel {
            padding: 6px 8px;
          }

          .reaction-btn {
            padding: 8px 10px;
            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default ReactionPanel;
