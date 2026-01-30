import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import LikeModel from "../../models/LikeModel";
import SaveModel from "../../models/SaveModel";
import { useToast } from "../../contexts/ToastContext";

const FullScreenReactionPanel = ({
  content,
  currentUser,
  onComment,
  onShare,
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(content.likes || 0);
  const [isLiking, setIsLiking] = useState(false);
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

    if (isLiking) return;

    try {
      setIsLiking(true);

      const result = await LikeModel.toggleLike(
        content.type,
        content.id,
        currentUser.id,
      );

      setLiked(result.liked);
      setLikeCount(result.newCount);

      if (result.liked) {
        showToast("success", "Liked!", "+1 EP earned");
      }
    } catch (error) {
      console.error("Like error:", error);
      showToast("error", "Failed to like");
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = (e) => {
    e.stopPropagation();
    if (onComment) {
      onComment(content);
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    if (onShare) {
      onShare(content);
    }
  };

  const handleSave = async (e) => {
    e.stopPropagation();

    if (!currentUser?.id) {
      showToast("warning", "Please login to save");
      return;
    }

    try {
      const result = await SaveModel.saveContent(
        content.type,
        content.id,
        currentUser.id,
      );
      setSaved(result.saved);

      showToast("success", result.saved ? "Saved!" : "Removed from saved");
    } catch (error) {
      console.error("Save error:", error);
      showToast("error", "Failed to save");
    }
  };

  const formatNumber = (num) => {
    if (!num || num === 0) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <div className="fullscreen-reactions">
        <div className="fs-action-wrapper">
          <button
            className={`fs-action-btn ${liked ? "active" : ""}`}
            onClick={handleLike}
            disabled={isLiking}
          >
            <Heart
              size={24}
              fill={liked ? "#ef4444" : "none"}
              color={liked ? "#ef4444" : "#ffffff"}
            />
          </button>
          {likeCount > 0 && (
            <span className="action-count">{formatNumber(likeCount)}</span>
          )}
        </div>

        <div className="fs-action-wrapper">
          <button className="fs-action-btn" onClick={handleComment}>
            <MessageCircle size={24} color="#ffffff" />
          </button>
          {content.comments_count > 0 && (
            <span className="action-count">
              {formatNumber(content.comments_count)}
            </span>
          )}
        </div>

        <div className="fs-action-wrapper">
          <button
            className={`fs-action-btn ${saved ? "active" : ""}`}
            onClick={handleSave}
          >
            <Bookmark
              size={24}
              fill={saved ? "#fbbf24" : "none"}
              color={saved ? "#fbbf24" : "#ffffff"}
            />
          </button>
        </div>

        <div className="fs-action-wrapper">
          <button className="fs-action-btn" onClick={handleShare}>
            <Share2 size={24} color="#ffffff" />
          </button>
          {content.shares > 0 && (
            <span className="action-count">{formatNumber(content.shares)}</span>
          )}
        </div>
      </div>

      <style jsx>{`
        .fullscreen-reactions {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .fs-action-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .fs-action-btn {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .fs-action-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.05);
        }

        .fs-action-btn:active {
          transform: scale(0.95);
        }

        .fs-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-count {
          font-size: 11px;
          font-weight: 700;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
          line-height: 1;
        }

        @media (max-width: 768px) {
          .fullscreen-reactions {
            gap: 18px;
          }

          .fs-action-wrapper {
            gap: 5px;
          }

          .fs-action-btn {
            width: 44px;
            height: 44px;
          }

          .fs-action-btn svg {
            width: 22px;
            height: 22px;
          }

          .action-count {
            font-size: 10px;
          }
        }
      `}</style>
    </>
  );
};

export default FullScreenReactionPanel;
