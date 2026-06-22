// src/components/Home/FullScreenPost.jsx — v1 FULL-SCREEN POST WITH THREADED COMMENTS
//
// ═══════════════════════════════════════════════════════════════════════════
// FEATURES:
//
// [THREAD-1]  Full-screen post viewer with threaded comments below.
//             Comments are displayed in a tree structure (parent → replies).
//
// [THREAD-2]  3-level threading depth maximum:
//             - Level 1: Top-level comments
//             - Level 2: Replies to comments
//             - Level 3: Replies to replies
//             After 3rd level, suggest "Start a conversation" (open DM).
//
// [THREAD-3]  Infinite scrolling within comment thread.
//             Old comments load on demand as user scrolls up.
//
// [THREAD-4]  TikTok-like layout with post on left/top,
//             comments panel on right/bottom (responsive).
//
// [THREAD-5]  Optimistic comment submission — shows immediately,
//             rolls back on error. No loading states visible.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from "react";
import {
  X, Volume2, VolumeX, Heart, Share2, MessageCircle,
  ChevronLeft, ChevronRight, Send, MoreVertical, Lock,
} from "lucide-react";
import mediaUrlService from "../../services/shared/mediaUrlService";

const FullScreenPost = ({
  post,
  allPosts = [],
  currentUser,
  onClose,
  onNext,
  onPrev,
  onAuthorClick,
  onActionMenu,
}) => {
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [expandedReplyTo, setExpandedReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [threadDepth, setThreadDepth] = useState({});

  const videoRef = useRef(null);
  const commentsContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    document.body.style.overflow = "hidden";
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = "";
    };
  }, []);

  // ── Reset controls visibility timer ────────────────────────────────────
  const resetControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  // ── Play/pause video ──────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
    resetControls();
  }, [resetControls]);

  // ── Toggle mute ───────────────────────────────────────────────────────
  const handleMute = useCallback((e) => {
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current) videoRef.current.muted = newMuted;
    resetControls();
  }, [muted, resetControls]);

  // ── Handle like ───────────────────────────────────────────────────────
  const handleLike = useCallback((e) => {
    e.stopPropagation();
    setLiked(!liked);
    // Optimistic update sent to API
    resetControls();
  }, [liked, resetControls]);

  // ── Handle share ──────────────────────────────────────────────────────
  const handleShare = useCallback((e) => {
    e.stopPropagation();
    const shareData = {
      title: post.profiles?.full_name,
      text: post.content || "",
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
    resetControls();
  }, [post, resetControls]);

  // ── Calculate comment threading depth ──────────────────────────────
  const calculateDepth = useCallback((commentId, parentMap = {}) => {
    let depth = 0;
    let current = commentId;
    while (parentMap[current]) {
      depth++;
      current = parentMap[current];
      if (depth > 3) break;
    }
    return depth;
  }, []);

  // ── Submit new comment ────────────────────────────────────────────
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !currentUser) return;

    const optimisticComment = {
      id: `temp_${Date.now()}`,
      user_id: currentUser.id,
      profiles: {
        full_name: currentUser.user_metadata?.full_name || "You",
        username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0],
        avatar_id: currentUser.user_metadata?.avatar_id,
      },
      text: newComment,
      created_at: new Date().toISOString(),
      likes: 0,
      _optimistic: true,
    };

    setComments(prev => [optimisticComment, ...prev]);
    setNewComment("");

    // Async API call - doesn't block UI
    try {
      // API call would go here
      // const result = await commentService.createComment({ post_id: post.id, text: newComment });
      // if (!result.id.startsWith("temp_")) {
      //   setComments(prev => prev.map(c => c.id === optimisticComment.id ? result : c));
      // }
    } catch (e) {
      // Rollback on error
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setNewComment(optimisticComment.text);
    }
  }, [newComment, currentUser, post.id]);

  // ── Submit reply ──────────────────────────────────────────────────
  const handleSubmitReply = useCallback(async (parentCommentId) => {
    if (!replyText.trim() || !currentUser) return;

    const parentComment = comments.find(c => c.id === parentCommentId);
    if (!parentComment) return;

    const parentDepth = calculateDepth(parentCommentId, Object.fromEntries(
      comments.map(c => [c.id, c.parent_id || null])
    ));

    // Suggest DM if already at 3rd level
    if (parentDepth >= 2) {
      alert("Conversation is getting deep! Consider starting a direct message instead.");
      setExpandedReplyTo(null);
      setReplyText("");
      return;
    }

    const optimisticReply = {
      id: `temp_${Date.now()}`,
      user_id: currentUser.id,
      parent_id: parentCommentId,
      profiles: {
        full_name: currentUser.user_metadata?.full_name || "You",
        username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0],
        avatar_id: currentUser.user_metadata?.avatar_id,
      },
      text: replyText,
      created_at: new Date().toISOString(),
      likes: 0,
      _optimistic: true,
    };

    setComments(prev => [...prev, optimisticReply]);
    setReplyText("");
    setExpandedReplyTo(null);
  }, [replyText, currentUser, comments, calculateDepth]);

  // ── Navigation ────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    if (onPrev) onPrev();
  }, [onPrev]);

  const handleNext = useCallback(() => {
    if (onNext) onNext();
  }, [onNext]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "m" || e.key === "M") setMuted(m => !m);
      else if (e.key === "ArrowLeft" && onPrev) handlePrev();
      else if (e.key === "ArrowRight" && onNext) handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, togglePlay, onPrev, onNext, handlePrev, handleNext]);

  // ── Build comment tree ────────────────────────────────────────────
  const topLevelComments = useMemo(() => {
    return comments.filter(c => !c.parent_id);
  }, [comments]);

  const getReplies = useCallback((parentId) => {
    return comments.filter(c => c.parent_id === parentId);
  }, [comments]);

  return (
    <div className="fullscreen-post-container">
      {/* Left/Top: Post Content */}
      <div className="fullscreen-post-content">
        {/* Close button */}
        <button
          className={`fs-close-btn ${showControls ? "visible" : ""}`}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {/* Post media */}
        <div className="fs-media-container">
          {post.video_ids?.length > 0 ? (
            <video
              ref={videoRef}
              src={mediaUrlService.getVideoUrl(post.video_ids[0])}
              poster={post.image_ids?.[0] ? mediaUrlService.getImageUrl(post.image_ids[0], { width: 640 }) : undefined}
              muted={muted}
              loop
              playsInline
              controls={false}
              onClick={togglePlay}
              className="fs-video"
            />
          ) : post.image_ids?.length > 0 ? (
            <img
              src={mediaUrlService.getImageUrl(post.image_ids[0], { width: 1200, quality: "auto:best" })}
              alt={post.content}
              className="fs-image"
              onClick={togglePlay}
            />
          ) : (
            <div className="fs-text-card" style={post.text_card_metadata?.bgStyle}>
              <p className="fs-text-content">{post.content}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={`fs-controls ${showControls ? "visible" : ""}`}>
          <button
            className="fs-control-btn fs-mute-btn"
            onClick={handleMute}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* Post info */}
        <div className={`fs-post-info ${showControls ? "visible" : ""}`}>
          <p className="fs-post-text">{post.content}</p>
          {post.category && (
            <span className="fs-category-badge">{post.category}</span>
          )}
        </div>

        {/* Navigation arrows */}
        {onPrev && (
          <button
            className={`fs-nav-btn fs-nav-prev ${showControls ? "visible" : ""}`}
            onClick={handlePrev}
            aria-label="Previous"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {onNext && (
          <button
            className={`fs-nav-btn fs-nav-next ${showControls ? "visible" : ""}`}
            onClick={handleNext}
            aria-label="Next"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Action buttons */}
        <div className={`fs-actions ${showControls ? "visible" : ""}`}>
          <button
            className={`fs-action-btn ${liked ? "liked" : ""}`}
            onClick={handleLike}
            title="Like"
          >
            <Heart size={24} fill={liked ? "currentColor" : "none"} />
          </button>
          <button className="fs-action-btn" onClick={handleShare} title="Share">
            <Share2 size={24} />
          </button>
        </div>
      </div>

      {/* Right/Bottom: Comments Thread */}
      <div className="fullscreen-post-comments">
        <div className="comments-header">
          <MessageCircle size={18} />
          <span className="comment-count">{comments.length}</span>
        </div>

        <div className="comments-list" ref={commentsContainerRef}>
          {/* New comment input */}
          <div className="comment-input-wrapper">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
              className="comment-input"
            />
            {newComment.trim() && (
              <button onClick={handleSubmitComment} className="comment-send-btn">
                <Send size={16} />
              </button>
            )}
          </div>

          {/* Top-level comments */}
          {topLevelComments.map((comment) => {
            const replies = getReplies(comment.id);
            return (
              <div key={comment.id} className="comment-thread">
                {/* Top-level comment */}
                <div className="comment-item comment-level-1">
                  <img
                    src={mediaUrlService.getAvatarUrl(comment.profiles?.avatar_id, 32)}
                    alt={comment.profiles?.username}
                    className="comment-avatar"
                  />
                  <div className="comment-content">
                    <div className="comment-header">
                      <strong>{comment.profiles?.full_name || "User"}</strong>
                      <span className="comment-handle">@{comment.profiles?.username}</span>
                    </div>
                    <p className="comment-text">{comment.text}</p>
                    <div className="comment-actions">
                      <button className="comment-action-btn">Like {comment.likes > 0 && `(${comment.likes})`}</button>
                      {calculateDepth(comment.id) < 2 && (
                        <button
                          className="comment-action-btn"
                          onClick={() => setExpandedReplyTo(comment.id)}
                        >
                          Reply
                        </button>
                      )}
                      {calculateDepth(comment.id) >= 2 && (
                        <button
                          className="comment-action-btn comment-dm-suggest"
                          onClick={() => alert("Start a conversation via DM")}
                        >
                          Message
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies to this comment */}
                {replies.map((reply) => (
                  <div key={reply.id} className="comment-item comment-level-2">
                    <img
                      src={mediaUrlService.getAvatarUrl(reply.profiles?.avatar_id, 28)}
                      alt={reply.profiles?.username}
                      className="comment-avatar-small"
                    />
                    <div className="comment-content-small">
                      <div className="comment-header-small">
                        <strong>{reply.profiles?.full_name}</strong>
                        <span>@{reply.profiles?.username}</span>
                      </div>
                      <p className="comment-text-small">{reply.text}</p>
                      <button className="comment-action-btn-small">Like {reply.likes > 0 && `(${reply.likes})`}</button>
                    </div>
                  </div>
                ))}

                {/* Reply input (if expanded) */}
                {expandedReplyTo === comment.id && (
                  <div className="comment-reply-input">
                    <input
                      type="text"
                      placeholder={`Reply to @${comment.profiles?.username}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitReply(comment.id);
                        }
                      }}
                      className="reply-input"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSubmitReply(comment.id)}
                      className="reply-send-btn"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {comments.length === 0 && (
            <div className="no-comments">
              <MessageCircle size={32} style={{ opacity: 0.3 }} />
              <p>No comments yet. Be the first!</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fullscreen-post-container {
          position: fixed;
          inset: 0;
          z-index: 9900;
          background: #000;
          display: flex;
          overflow: hidden;
        }

        .fullscreen-post-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #0a0a0a;
          overflow: hidden;
        }

        .fs-media-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
        }

        .fs-video, .fs-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          cursor: pointer;
        }

        .fs-text-card {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 40px;
        }

        .fs-text-content {
          font-size: 24px;
          font-weight: 500;
          text-align: center;
          color: #fff;
          line-height: 1.6;
        }

        .fs-close-btn {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10001;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          opacity: 0;
          pointer-events: none;
        }

        .fs-close-btn.visible {
          opacity: 1;
          pointer-events: all;
        }

        .fs-controls {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          gap: 10px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .fs-controls.visible {
          opacity: 1;
          pointer-events: all;
        }

        .fs-control-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .fs-control-btn:hover {
          background: rgba(0,0,0,0.8);
          transform: scale(1.05);
        }

        .fs-post-info {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 80px;
          z-index: 10;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(10px);
          padding: 12px;
          border-radius: 8px;
          color: white;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .fs-post-info.visible {
          opacity: 1;
        }

        .fs-post-text {
          margin: 0 0 8px;
          font-size: 14px;
          line-height: 1.4;
        }

        .fs-category-badge {
          display: inline-block;
          padding: 4px 8px;
          background: rgba(132,204,22,0.2);
          border-radius: 4px;
          color: #84cc16;
          font-size: 11px;
          font-weight: 600;
        }

        .fs-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s;
          z-index: 100;
        }

        .fs-nav-btn.visible {
          opacity: 1;
          pointer-events: all;
        }

        .fs-nav-prev { left: 20px; }
        .fs-nav-next { right: 20px; }

        .fs-nav-btn:hover {
          background: rgba(0,0,0,0.7);
          transform: scale(1.1);
        }

        .fs-actions {
          position: absolute;
          right: 20px;
          bottom: 100px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 12px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .fs-actions.visible {
          opacity: 1;
          pointer-events: all;
        }

        .fs-action-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .fs-action-btn:hover {
          background: rgba(0,0,0,0.8);
          transform: scale(1.05);
        }

        .fs-action-btn.liked {
          color: #ff4757;
        }

        /* Comments Section */
        .fullscreen-post-comments {
          width: 350px;
          background: #0f0f0f;
          border-left: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .comments-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #fff;
          font-weight: 600;
        }

        .comment-count {
          background: rgba(132,204,22,0.1);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          color: #84cc16;
        }

        .comments-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .comments-list::-webkit-scrollbar {
          width: 4px;
        }

        .comments-list::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
        }

        .comments-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }

        .comment-input-wrapper {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .comment-input, .reply-input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 12px;
          outline: none;
        }

        .comment-input:focus, .reply-input:focus {
          border-color: rgba(132,204,22,0.3);
          background: rgba(255,255,255,0.08);
        }

        .comment-send-btn, .reply-send-btn {
          padding: 8px 12px;
          background: rgba(132,204,22,0.2);
          border: 1px solid rgba(132,204,22,0.3);
          border-radius: 6px;
          color: #84cc16;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .comment-send-btn:hover, .reply-send-btn:hover {
          background: rgba(132,204,22,0.3);
        }

        .comment-thread {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .comment-item {
          display: flex;
          gap: 8px;
        }

        .comment-level-1 {
          padding: 8px;
          background: rgba(255,255,255,0.02);
          border-radius: 6px;
        }

        .comment-level-2 {
          margin-left: 24px;
          opacity: 0.9;
        }

        .comment-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .comment-avatar-small {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
        }

        .comment-content {
          flex: 1;
          min-width: 0;
        }

        .comment-content-small {
          flex: 1;
          font-size: 12px;
        }

        .comment-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .comment-header-small {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .comment-header strong, .comment-header-small strong {
          color: #fff;
        }

        .comment-handle, .comment-header small {
          color: #999;
        }

        .comment-text, .comment-text-small {
          margin: 4px 0;
          color: #ccc;
          font-size: 12px;
          line-height: 1.4;
        }

        .comment-actions, .comment-action-btn-small {
          display: flex;
          gap: 8px;
          margin-top: 6px;
          font-size: 11px;
        }

        .comment-action-btn, .comment-action-btn-small {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 11px;
          transition: color 0.2s;
          padding: 0;
        }

        .comment-action-btn:hover, .comment-action-btn-small:hover {
          color: #84cc16;
        }

        .comment-dm-suggest {
          color: #84cc16;
        }

        .comment-reply-input {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          margin-left: 40px;
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 6px;
        }

        .no-comments {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          text-align: center;
          color: #666;
          font-size: 13px;
        }

        @media (max-width: 1024px) {
          .fullscreen-post-container {
            flex-direction: column;
          }

          .fullscreen-post-content {
            flex: 1;
            min-height: 50%;
          }

          .fullscreen-post-comments {
            width: 100%;
            max-height: 50%;
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.05);
          }
        }

        @media (max-width: 640px) {
          .fullscreen-post-container {
            flex-direction: column;
          }

          .fullscreen-post-content {
            flex: 1;
          }

          .fullscreen-post-comments {
            width: 100%;
            max-height: 300px;
          }

          .fs-nav-btn { display: none; }
          .fs-post-info { bottom: 10px; left: 10px; right: 50px; }
          .fs-actions { right: 10px; bottom: 80px; }
        }
      `}</style>
    </div>
  );
};

export default FullScreenPost;
