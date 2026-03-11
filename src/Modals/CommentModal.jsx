// src/components/Modals/CommentModal.jsx
// No toast — EP deducted on submit — threading — no import errors
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Heart,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import CommentModel from "../../models/CommentModel";
import LikeModel from "../../models/LikeModel";
import { supabase } from "../../services/config/supabase";

const EP_COSTS = { comment: 4, comment_like: 0.5, reply: 2 };

async function deductEP(userId, amount, reason) {
  if (!userId) return false;
  const { data } = await supabase.rpc("deduct_ep", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  return !!data;
}
async function awardEP(userId, amount, reason) {
  if (!userId) return;
  await supabase.rpc("award_ep", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
}

// ── Comment Item ──────────────────────────────────────────────────────────
const CommentItem = ({
  comment,
  contentType,
  currentUser,
  onReply,
  level = 0,
  maxLevel = 3,
}) => {
  const [showReplies, setShowReplies] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const [epErr, setEpErr] = useState(null);

  useEffect(() => {
    if (currentUser?.id) {
      LikeModel.checkIfLiked("comment", comment.id, currentUser.id).then(
        setLiked,
      );
    }
  }, [comment.id]);

  const showErr = (m) => {
    setEpErr(m);
    setTimeout(() => setEpErr(null), 2500);
  };

  const handleLikeComment = async () => {
    if (!currentUser?.id) return;

    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      LikeModel.toggleLike("comment", comment.id, currentUser.id).catch(() => {
        setLiked(true);
        setLikeCount((c) => c + 1);
      });
      return;
    }

    const ok = await deductEP(
      currentUser.id,
      EP_COSTS.comment_like,
      "comment_like",
    );
    if (!ok) {
      showErr(`Need ${EP_COSTS.comment_like} EP`);
      return;
    }
    setLiked(true);
    setLikeCount((c) => c + 1);
    if (comment.user_id && comment.user_id !== currentUser.id)
      awardEP(
        comment.user_id,
        EP_COSTS.comment_like * 0.82,
        "received_comment_like",
      );
    LikeModel.toggleLike("comment", comment.id, currentUser.id).catch(() => {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    });
  };

  const hasReplies = comment.replies?.length > 0;
  const canNest = level < maxLevel;

  return (
    <div className="comment-thread" style={{ marginLeft: `${level * 18}px` }}>
      {epErr && (
        <div style={{ color: "#f87171", fontSize: 11, marginBottom: 4 }}>
          ⚡ {epErr}
        </div>
      )}
      <div className="comment-item">
        <div className="comment-avatar">
          {comment.avatar ? (
            <img src={comment.avatar} alt={comment.author} />
          ) : (
            <span>{comment.author?.charAt(0) || "U"}</span>
          )}
        </div>
        <div className="comment-content">
          <div className="comment-header">
            <span className="comment-author">{comment.author}</span>
            <span className="comment-time">{comment.timeAgo}</span>
          </div>
          <p className="comment-text">{comment.text}</p>
          <div className="comment-actions">
            <button
              className={`comment-action ${liked ? "active" : ""}`}
              onClick={handleLikeComment}
            >
              <Heart size={13} fill={liked ? "#ef4444" : "none"} />
              {likeCount > 0 && <span>{likeCount}</span>}
              <span style={{ color: "rgba(200,245,66,.5)", fontSize: 10 }}>
                {EP_COSTS.comment_like}EP
              </span>
            </button>
            <button className="comment-action" onClick={() => onReply(comment)}>
              <MessageCircle size={13} />
              <span>Reply</span>
              <span style={{ color: "rgba(200,245,66,.5)", fontSize: 10 }}>
                {EP_COSTS.reply}EP
              </span>
            </button>
            {hasReplies && (
              <button
                className="comment-action"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <ChevronUp size={13} />
                ) : (
                  <ChevronDown size={13} />
                )}
                <span>
                  {comment.totalReplies}{" "}
                  {comment.totalReplies === 1 ? "reply" : "replies"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
      {hasReplies && showReplies && canNest && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              contentType={contentType}
              currentUser={currentUser}
              onReply={onReply}
              level={level + 1}
              maxLevel={maxLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────────
const CommentModal = ({ content, onClose, currentUser, isMobile = false }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [epErr, setEpErr] = useState(null);

  useEffect(() => {
    loadComments();
  }, [content.id]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const fetched = await CommentModel.getComments(content.type, content.id);
      setComments(fetched);
    } catch (e) {
      console.error("Failed to load comments:", e);
    } finally {
      setLoading(false);
    }
  };

  const showErr = (m) => {
    setEpErr(m);
    setTimeout(() => setEpErr(null), 3000);
  };

  const handleAddComment = async () => {
    if (!currentUser?.id) return;
    if (!newComment.trim()) return;
    if (submitting) return;

    const cost = replyTo ? EP_COSTS.reply : EP_COSTS.comment;
    const ok = await deductEP(
      currentUser.id,
      cost,
      replyTo ? "reply_comment" : "add_comment",
    );
    if (!ok) {
      showErr(`Need ${cost} EP to ${replyTo ? "reply" : "comment"}`);
      return;
    }

    setSubmitting(true);
    try {
      await CommentModel.addComment(
        content.type,
        content.id,
        currentUser.id,
        newComment,
        replyTo?.id || null,
      );
      // Award EP to content owner
      if (content.user_id && content.user_id !== currentUser.id) {
        awardEP(content.user_id, cost * 0.82, "received_comment");
      }
      await loadComments();
      setNewComment("");
      setReplyTo(null);
    } catch (e) {
      console.error("Failed to add comment:", e);
      showErr("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = [...comments].sort((a, b) =>
    sortBy === "popular" ? (b.likes || 0) - (a.likes || 0) : 0,
  );

  return (
    <>
      <div className="comment-modal-overlay" onClick={onClose}>
        <div
          className={`comment-modal ${isMobile ? "comment-modal-mobile" : "comment-modal-desktop"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="comment-modal-header">
            <div className="comment-modal-title">
              <h3>Comments</h3>
              <span className="comment-count">{comments.length}</span>
            </div>
            <button className="comment-close-btn" onClick={onClose}>
              <X size={22} />
            </button>
          </div>

          <div className="comment-sort-bar">
            <button
              className={`sort-btn ${sortBy === "recent" ? "active" : ""}`}
              onClick={() => setSortBy("recent")}
            >
              Recent
            </button>
            <button
              className={`sort-btn ${sortBy === "popular" ? "active" : ""}`}
              onClick={() => setSortBy("popular")}
            >
              Popular
            </button>
          </div>

          <div className="comments-list">
            {loading ? (
              <div className="comments-loading">Loading comments...</div>
            ) : sorted.length === 0 ? (
              <div className="no-comments">
                <MessageCircle size={44} />
                <p>No comments yet</p>
                <span>
                  Be first — costs {EP_COSTS.comment} EP, earns the creator more
                </span>
              </div>
            ) : (
              sorted.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  contentType={content.type}
                  currentUser={currentUser}
                  onReply={setReplyTo}
                />
              ))
            )}
          </div>

          <div className="comment-input-area">
            {epErr && (
              <div
                style={{
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.22)",
                  borderRadius: 8,
                  color: "#f87171",
                  fontSize: 12,
                  padding: "8px 12px",
                  marginBottom: 8,
                }}
              >
                ⚡ {epErr}
              </div>
            )}
            {replyTo && (
              <div className="reply-indicator">
                <span>
                  Replying to {replyTo.author} · {EP_COSTS.reply} EP
                </span>
                <button onClick={() => setReplyTo(null)}>
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="comment-input-wrapper">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={
                  replyTo
                    ? `Reply to ${replyTo.author}... (${EP_COSTS.reply} EP)`
                    : `Add a comment... (${EP_COSTS.comment} EP)`
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                rows={isMobile ? 2 : 1}
                disabled={submitting}
              />
              <button
                className="send-btn"
                onClick={handleAddComment}
                disabled={!newComment.trim() || submitting}
              >
                <Send size={18} />
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#52525b",
                marginTop: 5,
                paddingLeft: 2,
              }}
            >
              {replyTo ? `${EP_COSTS.reply} EP` : `${EP_COSTS.comment} EP`} ·
              Creator earns 82%
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .comment-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .comment-modal {
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .comment-modal-desktop {
          width: 580px;
          max-height: 80vh;
        }
        .comment-modal-mobile {
          width: 100%;
          height: 100vh;
          border-radius: 0;
        }
        .comment-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          background: rgba(132, 204, 22, 0.04);
        }
        .comment-modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .comment-modal-title h3 {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        .comment-count {
          padding: 2px 8px;
          background: rgba(132, 204, 22, 0.18);
          border-radius: 12px;
          font-size: 12px;
          color: #84cc16;
          font-weight: 600;
        }
        .comment-close-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }
        .comment-close-btn:hover {
          color: #84cc16;
        }
        .comment-sort-bar {
          display: flex;
          gap: 8px;
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .sort-btn {
          padding: 5px 14px;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #737373;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sort-btn.active {
          background: rgba(132, 204, 22, 0.18);
          border-color: #84cc16;
          color: #84cc16;
        }
        .comments-list {
          flex: 1;
          overflow-y: auto;
          padding: 14px 20px;
        }
        .comments-list::-webkit-scrollbar {
          width: 5px;
        }
        .comments-list::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.25);
          border-radius: 3px;
        }
        .comments-loading,
        .no-comments {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 36px 20px;
          color: #737373;
          text-align: center;
          gap: 10px;
        }
        .comment-thread {
          margin-bottom: 14px;
        }
        .comment-item {
          display: flex;
          gap: 10px;
          padding: 10px 0;
        }
        .comment-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
          overflow: hidden;
        }
        .comment-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .comment-content {
          flex: 1;
          min-width: 0;
        }
        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 3px;
        }
        .comment-author {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }
        .comment-time {
          font-size: 11px;
          color: #737373;
        }
        .comment-text {
          font-size: 13px;
          color: #e5e5e5;
          margin: 0 0 7px;
          line-height: 1.45;
          word-wrap: break-word;
        }
        .comment-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .comment-action {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: #737373;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
          padding: 0;
        }
        .comment-action:hover,
        .comment-action.active {
          color: #84cc16;
        }
        .comment-replies {
          margin-top: 6px;
        }
        .comment-input-area {
          padding: 14px 20px;
          border-top: 1px solid rgba(132, 204, 22, 0.2);
        }
        .reply-indicator {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 7px 11px;
          background: rgba(132, 204, 22, 0.08);
          border-radius: 8px;
          margin-bottom: 7px;
          font-size: 12px;
          color: #84cc16;
        }
        .reply-indicator button {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 3px;
        }
        .comment-input-wrapper {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }
        .comment-input-wrapper textarea {
          flex: 1;
          padding: 11px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          color: #fff;
          font-size: 13px;
          resize: none;
          font-family: inherit;
        }
        .comment-input-wrapper textarea:focus {
          outline: none;
          border-color: #84cc16;
        }
        .comment-input-wrapper textarea:disabled {
          opacity: 0.5;
        }
        .send-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #84cc16, #65a30d);
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .send-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default CommentModal;
