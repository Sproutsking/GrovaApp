// src/components/Reactions/FullScreenReactionPanel.jsx
// EP costs: Like=2 per action
import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import LikeModel from "../../models/LikeModel";
import SaveModel from "../../models/SaveModel";
import { invalidateEPCache, processEngagement } from "../../services/economy/epEconomyService";
import LikeBurst from "./LikeBurst";

const EP_COSTS = { like: 2, comment: 4, share: 10 };

const FullScreenReactionPanel = ({
  content,
  currentUser,
  onComment,
  onShare,
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(content.likes || 0);
  const [epError, setEpError] = useState(null);
  const [likeBurst, setLikeBurst] = useState(null);
  const [isLiking, setIsLiking] = useState(false);
  const burstId = React.useRef(0);

  const burstLike = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const hasPointer = Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && (event.clientX !== 0 || event.clientY !== 0);
    burstId.current += 1;
    setLikeBurst({ id: burstId.current, x: hasPointer ? event.clientX : rect.left + rect.width / 2, y: hasPointer ? event.clientY : rect.top + rect.height / 2 });
  };

  useEffect(() => {
    if (currentUser?.id) {
      LikeModel.checkIfLiked(content.type, content.id, currentUser.id).then(
        setLiked,
      );
      SaveModel.checkIfSaved?.(content.type, content.id, currentUser.id)
        .then(setSaved)
        .catch(() => {});
    }
  }, [content.id, currentUser?.id]);

  const showEpError = (msg) => {
    setEpError(msg);
    setTimeout(() => setEpError(null), 3000);
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id || isLiking) return;
    setIsLiking(true);

    if (liked) {
      burstLike(e);
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      try {
        const result = await LikeModel.toggleLike(content.type, content.id, currentUser.id);
        if (typeof result.newCount === "number") setLikeCount(result.newCount);
      } catch {
          setLiked(true);
          setLikeCount((c) => c + 1);
      } finally {
        setIsLiking(false);
      }
      return;
    }

    burstLike(e);
    setLiked(true);
    setLikeCount((c) => c + 1);
    let persistedLike = false;
    try {
      const likeResult = await LikeModel.toggleLike(content.type, content.id, currentUser.id, { notify: false });
      persistedLike = likeResult.liked;
      const epResult = await processEngagement({
        actorId: currentUser.id,
        contentType: content.type,
        contentId: content.id,
        engagementType: "like",
      });
      if (!epResult.success && !epResult.selfEngagement) {
        await LikeModel.toggleLike(content.type, content.id, currentUser.id, { notify: false });
        persistedLike = false;
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
        invalidateEPCache(currentUser.id);
        showEpError(epResult.error || `Need ${EP_COSTS.like} EP to like`);
        return;
      }
      if (typeof likeResult.newCount === "number") setLikeCount(likeResult.newCount);
    } catch (error) {
      if (persistedLike) {
        try {
          const rollback = await LikeModel.toggleLike(content.type, content.id, currentUser.id, { notify: false });
          setLiked(false);
          if (typeof rollback.newCount === "number") setLikeCount(rollback.newCount);
          invalidateEPCache(currentUser.id);
          showEpError(error?.message || "Like failed. Please try again.");
          return;
        } catch {
          setLiked(true);
          showEpError("The like was saved, but could not be rolled back. Refresh to sync.");
          return;
        }
      }
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      invalidateEPCache(currentUser.id);
      showEpError(error?.message || "Like failed. Please try again.");
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const wasSaved = saved;
    setSaved(!saved);
    SaveModel.saveContent(content.type, content.id, currentUser.id).catch(() =>
      setSaved(wasSaved),
    );
  };

  const fmt = (n) => {
    if (!n) return "0";
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
  };

  return (
    <>
      {epError && (
        <div
          style={{
            position: "fixed",
            bottom: 120,
            right: 16,
            background: "#18181b",
            border: "1px solid rgba(239,68,68,.4)",
            color: "#f87171",
            padding: "8px 14px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 9999,
          }}
        >
          ⚡ {epError}
        </div>
      )}
      {likeBurst && <LikeBurst key={likeBurst.id} x={likeBurst.x} y={likeBurst.y} onDone={() => setLikeBurst(null)} />}
      <div className="fullscreen-reactions">
        <div className="fs-action-wrapper">
          <button
            className={`fs-action-btn ${liked ? "active" : ""}`}
            onClick={handleLike}
          >
            <Heart
              size={24}
              fill={liked ? "#ef4444" : "none"}
              color={liked ? "#ef4444" : "#ffffff"}
            />
          </button>
          {likeCount > 0 && (
            <span className="action-count">{fmt(likeCount)}</span>
          )}
          <span className="action-ep">{EP_COSTS.like}EP</span>
        </div>

        <div className="fs-action-wrapper">
          <button
            className="fs-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onComment?.(content);
            }}
          >
            <MessageCircle size={24} color="#ffffff" />
          </button>
          {content.comments_count > 0 && (
            <span className="action-count">{fmt(content.comments_count)}</span>
          )}
          <span className="action-ep">{EP_COSTS.comment}EP</span>
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
          <button
            className="fs-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onShare?.(content);
            }}
          >
            <Share2 size={24} color="#ffffff" />
          </button>
          {content.shares > 0 && (
            <span className="action-count">{fmt(content.shares)}</span>
          )}
        </div>
      </div>

      <style jsx>{`
        .fullscreen-reactions {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .fs-action-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }
        .fs-action-btn {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .fs-action-btn:active {
          transform: scale(0.92);
          background: rgba(0, 0, 0, 0.8);
        }
        .action-count {
          font-size: 10px;
          font-weight: 700;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
          line-height: 1;
        }
        .action-ep {
          font-size: 9px;
          color: rgba(200, 245, 66, 0.7);
          font-weight: 700;
          line-height: 1;
        }
        @media (max-width: 768px) {
          .fullscreen-reactions {
            gap: 14px;
          }
          .fs-action-btn {
            width: 42px;
            height: 42px;
          }
          .fs-action-btn svg {
            width: 21px;
            height: 21px;
          }
          .action-count {
            font-size: 9px;
          }
        }
      `}</style>
    </>
  );
};

export default FullScreenReactionPanel;
