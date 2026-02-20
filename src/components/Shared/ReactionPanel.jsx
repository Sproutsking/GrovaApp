// src/components/Reactions/ReactionPanel.jsx
// EP costs: Like=2, Comment=4, Share=10
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Heart, MessageCircle, Share2, Eye, Bookmark } from "lucide-react";
import LikeModel from "../../models/LikeModel";
import SaveModel from "../../models/SaveModel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import { supabase } from "../../services/config/supabase";

const EP_COSTS = { like: 2, comment: 4, share: 10 };

async function deductEP(userId, amount, reason) {
  const { data } = await supabase.rpc("deduct_ep", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  return !!data;
}

async function awardEP(userId, amount, reason) {
  await supabase.rpc("award_ep", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
}

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
  const [epError, setEpError] = useState(null);

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
    if (!currentUser?.id) return;

    // If already liked — unlike is free (refund EP)
    if (liked) {
      const wasLiked = liked;
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      LikeModel.toggleLike(content.type, content.id, currentUser.id).catch(
        () => {
          setLiked(wasLiked);
          setLikeCount((c) => c + 1);
        },
      );
      return;
    }

    // Deduct EP before liking
    const ok = await deductEP(
      currentUser.id,
      EP_COSTS.like,
      `like_${content.type}`,
    );
    if (!ok) {
      showEpError(`Need ${EP_COSTS.like} EP to like`);
      return;
    }

    setLiked(true);
    setLikeCount((c) => c + 1);

    // Award EP to content owner
    if (content.user_id && content.user_id !== currentUser.id) {
      const isPro = content.profiles?.is_pro || false;
      const fee = isPro ? 0.08 : 0.18;
      const net = EP_COSTS.like * (1 - fee);
      awardEP(content.user_id, net, "received_like");
    }

    LikeModel.toggleLike(content.type, content.id, currentUser.id).catch(() => {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    });
  };

  const handleComment = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      setShowComments(true);
      return;
    }
    // EP deducted when comment is actually submitted (inside CommentModal)
    setShowComments(true);
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) {
      setShowShareModal(true);
      return;
    }
    setShowShareModal(true);
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
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#18181b",
            border: "1px solid rgba(239,68,68,.4)",
            color: "#f87171",
            padding: "8px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 9999,
            whiteSpace: "nowrap",
          }}
        >
          ⚡ {epError}
        </div>
      )}

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
          <span>{fmt(likeCount)}</span>
          <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>
            ·{EP_COSTS.like}EP
          </span>
        </button>

        <button className="reaction-btn" onClick={handleComment}>
          <MessageCircle size={18} />
          <span>{fmt(content.comments_count || 0)}</span>
          <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>
            ·{EP_COSTS.comment}EP
          </span>
        </button>

        <button className="reaction-btn" onClick={handleShare}>
          <Share2 size={18} />
          <span>{fmt(content.shares || 0)}</span>
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
            <span>{fmt(content.views || 0)}</span>
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
        }
        .reaction-panel-horizontal {
          gap: 8px;
        }
        .reaction-panel-vertical {
          flex-direction: column;
          gap: 8px;
        }
        .reaction-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 10px;
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
            padding: 8px 8px;
            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default ReactionPanel;
