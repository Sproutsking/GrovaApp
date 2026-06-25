import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Heart, MessageCircle, Send, Share2, MoreVertical } from "lucide-react";
import CommentModel from "../../models/CommentModel";
import LikeModel from "../../models/LikeModel";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import "../../styles/PostFullScreen.css";

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

// ── Comment Item Component ──────────────────────────────────────────────────
const CommentThread = ({
  comment,
  contentType,
  currentUser,
  onReply,
  level = 0,
  maxLevel = 3,
}) => {
  const [showReplies, setShowReplies] = useState(level === 0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const [replyCount, setReplyCount] = useState(comment.reply_count || 0);
  const [epErr, setEpErr] = useState(null);

  useEffect(() => {
    if (currentUser?.id) {
      LikeModel.checkIfLiked("comment", comment.id, currentUser.id).then(
        setLiked
      );
    }
  }, [comment.id, currentUser]);

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
      "comment_like"
    );
    if (!ok) {
      setEpErr("Not enough EP to like");
      setTimeout(() => setEpErr(null), 2500);
      return;
    }

    setLiked(true);
    setLikeCount((c) => c + 1);
    LikeModel.toggleLike("comment", comment.id, currentUser.id).catch(() => {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      awardEP(
        currentUser.id,
        EP_COSTS.comment_like,
        "comment_like_refund"
      );
    });
  };

  return (
    <div className={`pfs-comment-thread level-${level}`}>
      <div className="pfs-comment-item">
        {/* Author info */}
        <div className="pfs-comment-author">
          <img
            src={
              comment.profiles?.avatar_id
                ? mediaUrlService.getAvatarUrl(comment.profiles.avatar_id, 48)
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`
            }
            alt={comment.profiles?.username}
            className="pfs-comment-avatar"
          />
          <div className="pfs-comment-author-info">
            <div className="pfs-comment-author-name">
              {comment.profiles?.full_name || "Unknown"}
            </div>
            <div className="pfs-comment-author-handle">
              @{comment.profiles?.username || "unknown"}
            </div>
          </div>
        </div>

        {/* Comment text */}
        <div className="pfs-comment-text">{comment.text}</div>

        {/* Error */}
        {epErr && <div className="pfs-error-msg">{epErr}</div>}

        {/* Comment actions */}
        <div className="pfs-comment-actions">
          <button
            className={`pfs-action-btn ${liked ? "active" : ""}`}
            onClick={handleLikeComment}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            <span>{likeCount > 0 ? likeCount : ""}</span>
          </button>
          <button
            className="pfs-action-btn"
            onClick={() => onReply?.(comment.id)}
          >
            <MessageCircle size={16} />
            <span>{replyCount > 0 ? replyCount : ""}</span>
          </button>
        </div>

        {/* Replies */}
        {replyCount > 0 && level < maxLevel && (
          <button
            className="pfs-show-replies"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? "Hide" : "Show"} {replyCount} replies
          </button>
        )}
      </div>

      {showReplies &&
        comment.replies?.map((reply) => (
          <CommentThread
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
  );
};

// ── Post Full Screen Modal ──────────────────────────────────────────────────
const PostFullScreen = ({ post, currentUser, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [epErr, setEpErr] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      try {
        const loaded = await CommentModel.getComments("post", post.id);
        setComments(loaded);
      } catch (err) {
        console.error("Error loading comments:", err);
      } finally {
        setIsLoadingComments(false);
      }
    };

    loadComments();
  }, [post.id]);

  // Check if liked
  useEffect(() => {
    if (currentUser?.id) {
      LikeModel.checkIfLiked("post", post.id, currentUser.id).then(setLiked);
    }
  }, [post.id, currentUser]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleLikePost = async () => {
    if (!currentUser?.id) return;

    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      LikeModel.toggleLike("post", post.id, currentUser.id).catch(() => {
        setLiked(true);
        setLikeCount((c) => c + 1);
      });
      return;
    }

    setLiked(true);
    setLikeCount((c) => c + 1);
    LikeModel.toggleLike("post", post.id, currentUser.id).catch(() => {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    });
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser?.id) return;

    const ok = await deductEP(currentUser.id, EP_COSTS.comment, "comment");
    if (!ok) {
      setEpErr("Not enough EP to comment");
      setTimeout(() => setEpErr(null), 2500);
      return;
    }

    try {
      const newCommentObj = await CommentModel.createComment(
        currentUser.id,
        post.id,
        newComment,
        "post",
        replyingTo
      );

      if (replyingTo) {
        // Add reply to parent comment
        setComments(
          comments.map((c) =>
            c.id === replyingTo
              ? { ...c, replies: [...(c.replies || []), newCommentObj] }
              : c
          )
        );
      } else {
        setComments([newCommentObj, ...comments]);
      }

      setNewComment("");
      setReplyingTo(null);
    } catch (err) {
      console.error("Error posting comment:", err);
      awardEP(currentUser.id, EP_COSTS.comment, "comment_refund");
      setEpErr("Failed to post comment");
      setTimeout(() => setEpErr(null), 2500);
    }
  };

  return (
    <div className="post-fullscreen-overlay" onClick={onClose}>
      <div
        className="post-fullscreen-container"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="pfs-close-btn" onClick={onClose} aria-label="Close">
          <X size={24} />
        </button>

        <div className="pfs-content">
          {/* Main post section */}
          <div className="pfs-main-post">
            {/* Post author */}
            <div className="pfs-post-author">
              <img
                src={
                  post.profiles?.avatar_id
                    ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 56)
                    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_id}`
                }
                alt={post.profiles?.username}
                className="pfs-post-avatar"
              />
              <div className="pfs-post-author-info">
                <div className="pfs-post-author-name">
                  {post.profiles?.full_name || "Unknown"}
                </div>
                <div className="pfs-post-author-handle">
                  @{post.profiles?.username || "unknown"}
                </div>
              </div>
              <button className="pfs-menu-btn">
                <MoreVertical size={16} />
              </button>
            </div>

            {/* Post text */}
            <div className="pfs-post-text">{post.text}</div>

            {/* Post media */}
            {post.images && post.images.length > 0 && (
              <div className="pfs-post-media">
                {post.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={mediaUrlService.getImageUrl(img, {
                      quality: "auto",
                      format: "webp",
                    })}
                    alt={`Post media ${idx + 1}`}
                    className="pfs-post-image"
                  />
                ))}
              </div>
            )}

            {/* Post metadata */}
            <div className="pfs-post-meta">
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
            </div>

            {/* Post stats */}
            <div className="pfs-post-stats">
              <div className="pfs-stat">
                <span className="pfs-stat-count">{likeCount}</span>
                <span className="pfs-stat-label">Likes</span>
              </div>
              <div className="pfs-stat">
                <span className="pfs-stat-count">{comments.length}</span>
                <span className="pfs-stat-label">Comments</span>
              </div>
              <div className="pfs-stat">
                <span className="pfs-stat-count">{post.shares || 0}</span>
                <span className="pfs-stat-label">Shares</span>
              </div>
            </div>

            {/* Post actions */}
            <div className="pfs-post-actions">
              <button
                className={`pfs-action-btn ${liked ? "active" : ""}`}
                onClick={handleLikePost}
              >
                <Heart
                  size={18}
                  fill={liked ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              </button>
              <button className="pfs-action-btn">
                <MessageCircle size={18} strokeWidth={1.5} />
              </button>
              <button className="pfs-action-btn">
                <Share2 size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Comments section */}
          <div className="pfs-comments-section">
            <div className="pfs-comments-header">
              <h3>Replies</h3>
            </div>

            {/* Reply composer */}
            {currentUser && (
              <div className="pfs-reply-composer">
                <img
                  src={
                    currentUser.avatar_id
                      ? mediaUrlService.getAvatarUrl(currentUser.avatar_id, 40)
                      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`
                  }
                  alt={currentUser.username}
                  className="pfs-composer-avatar"
                />
                <div className="pfs-composer-input-group">
                  {replyingTo && (
                    <div className="pfs-replying-to">
                      Replying to comment{" "}
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="pfs-cancel-reply"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="pfs-input-wrapper">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Add a reply..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="pfs-composer-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          handleSubmitComment();
                        }
                      }}
                    />
                    <button
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim()}
                      className="pfs-submit-btn"
                      title="Send (Ctrl+Enter)"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
                {epErr && <div className="pfs-error-msg">{epErr}</div>}
              </div>
            )}

            {/* Comments list */}
            <div className="pfs-comments-list">
              {isLoadingComments ? (
                <div className="pfs-loading">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="pfs-no-comments">
                  No replies yet. Be the first!
                </div>
              ) : (
                comments.map((comment) => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    contentType="post"
                    currentUser={currentUser}
                    onReply={(id) => setReplyingTo(id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .post-fullscreen-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9998;
          padding: 20px;
          backdrop-filter: blur(4px);
        }

        .post-fullscreen-container {
          position: relative;
          background: var(--bg);
          border: 1px solid var(--accent-border);
          border-radius: 16px;
          width: 100%;
          max-width: 800px;
          height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
        }

        .pfs-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .pfs-close-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          border-color: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .pfs-content {
          display: flex;
          flex-direction: row;
          height: 100%;
          overflow: hidden;
        }

        .pfs-main-post {
          flex: 0 0 45%;
          border-right: 1px solid var(--border);
          padding: 32px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }

        .pfs-post-author {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .pfs-post-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .pfs-post-author-info {
          flex: 1;
        }

        .pfs-post-author-name {
          font-weight: 600;
          font-size: 16px;
          color: var(--text);
        }

        .pfs-post-author-handle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .pfs-menu-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .pfs-menu-btn:hover {
          color: var(--accent);
        }

        .pfs-post-text {
          font-size: 18px;
          line-height: 1.6;
          color: var(--text);
          margin-bottom: 20px;
          word-wrap: break-word;
        }

        .pfs-post-media {
          margin-bottom: 20px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface);
        }

        .pfs-post-image {
          width: 100%;
          height: auto;
          display: block;
          max-height: 400px;
          object-fit: cover;
        }

        .pfs-post-meta {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .pfs-post-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .pfs-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pfs-stat-count {
          font-weight: 600;
          font-size: 15px;
          color: var(--text);
        }

        .pfs-stat-label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .pfs-post-actions {
          display: flex;
          gap: 20px;
          justify-content: space-around;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .pfs-action-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px;
          transition: color 0.2s;
          font-size: 13px;
        }

        .pfs-action-btn:hover {
          color: var(--accent);
        }

        .pfs-action-btn.active {
          color: #e74c3c;
        }

        .pfs-comments-section {
          flex: 0 0 55%;
          padding: 32px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .pfs-comments-header {
          margin-bottom: 20px;
        }

        .pfs-comments-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
          margin: 0;
        }

        .pfs-reply-composer {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .pfs-composer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .pfs-composer-input-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pfs-replying-to {
          font-size: 12px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .pfs-cancel-reply {
          background: transparent;
          border: none;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
          font-size: 14px;
        }

        .pfs-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .pfs-composer-input {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--surface-border);
          border-radius: 20px;
          padding: 10px 16px;
          color: var(--text);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .pfs-composer-input:focus {
          border-color: var(--accent-border-strong);
        }

        .pfs-submit-btn {
          background: var(--accent);
          border: none;
          color: var(--accent-contrast);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .pfs-submit-btn:hover:not(:disabled) {
          background: var(--accent-strong);
          transform: scale(1.05);
        }

        .pfs-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pfs-error-msg {
          font-size: 12px;
          color: #e74c3c;
          padding: 0 4px;
        }

        .pfs-comments-list {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          display: flex;
          flex-direction: column;
        }

        .pfs-loading,
        .pfs-no-comments {
          text-align: center;
          color: var(--text-secondary);
          padding: 40px 20px;
          font-size: 14px;
        }

        .pfs-comment-thread {
          margin-bottom: 16px;
        }

        .level-1 {
          margin-left: 24px;
        }

        .level-2 {
          margin-left: 48px;
        }

        .level-3 {
          margin-left: 72px;
        }

        .pfs-comment-item {
          padding: 12px 0;
          border-bottom: 1px solid var(--surface-border);
        }

        .pfs-comment-author {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .pfs-comment-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .pfs-comment-author-info {
          flex: 1;
          min-width: 0;
        }

        .pfs-comment-author-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text);
          display: inline;
        }

        .pfs-comment-author-handle {
          font-size: 13px;
          color: var(--text-secondary);
          display: inline;
          margin-left: 4px;
        }

        .pfs-comment-text {
          font-size: 14px;
          line-height: 1.5;
          color: var(--text);
          margin-bottom: 8px;
          word-wrap: break-word;
        }

        .pfs-comment-actions {
          display: flex;
          gap: 20px;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .pfs-show-replies {
          background: transparent;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 0;
          margin-top: 4px;
          transition: color 0.2s;
        }

        .pfs-show-replies:hover {
          color: var(--accent-strong);
          text-decoration: underline;
        }

        /* Smooth scrollbar styling */
        .pfs-main-post::-webkit-scrollbar,
        .pfs-comments-list::-webkit-scrollbar {
          width: 6px;
        }

        .pfs-main-post::-webkit-scrollbar-track,
        .pfs-comments-list::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }

        .pfs-main-post::-webkit-scrollbar-thumb,
        .pfs-comments-list::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
          transition: background 0.3s ease;
        }

        .pfs-main-post::-webkit-scrollbar-thumb:hover,
        .pfs-comments-list::-webkit-scrollbar-thumb:hover {
          background: rgba(132, 204, 22, 0.5);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .post-fullscreen-overlay {
            padding: 0;
          }

          .post-fullscreen-container {
            max-width: 100%;
            height: 100vh;
            border-radius: 0;
            border: none;
          }

          .pfs-content {
            flex-direction: column;
          }

          .pfs-main-post {
            flex: 0 0 auto;
            border-right: none;
            border-bottom: 1px solid var(--border);
            max-height: 40vh;
            padding: 20px;
          }

          .pfs-comments-section {
            flex: 1;
            padding: 20px;
          }

          .pfs-post-author {
            margin-bottom: 12px;
          }

          .pfs-post-text {
            font-size: 16px;
            margin-bottom: 12px;
          }

          .pfs-close-btn {
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
          }

          .level-1,
          .level-2,
          .level-3 {
            margin-left: 0;
          }

          .pfs-comment-avatar {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>
    </div>
  );
};

export default PostFullScreen;
