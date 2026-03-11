// src/components/Modals/CommentModal.jsx
// Full comment sheet — bottom drawer on mobile, centered on desktop.
// Calls onCommentPosted() after every successful comment so ReactionPanel
// can update the count without a re-fetch.
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { X, Send, Heart, CornerDownRight, ChevronDown } from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function fetchComments(contentType, contentId) {
  const table =
    contentType === "reel"
      ? "reel_comments"
      : contentType === "story"
        ? "story_comments"
        : "comments";

  const { data, error } = await supabase
    .from(table)
    .select(
      `
      id, content, created_at, parent_id, user_id,
      profiles:user_id ( id, username, full_name, avatar_url )
    `,
    )
    .eq("content_id", contentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function postComment(
  contentType,
  contentId,
  userId,
  text,
  parentId = null,
) {
  const table =
    contentType === "reel"
      ? "reel_comments"
      : contentType === "story"
        ? "story_comments"
        : "comments";

  const payload = {
    content_id: contentId,
    content_type: contentType,
    user_id: userId,
    content: text.trim(),
    parent_id: parentId || null,
  };

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select(
      `
      id, content, created_at, parent_id, user_id,
      profiles:user_id ( id, username, full_name, avatar_url )
    `,
    )
    .single();

  if (error) throw error;

  // Increment comments_count on the parent content row (fire-and-forget)
  const contentTable =
    contentType === "reel"
      ? "reels"
      : contentType === "story"
        ? "stories"
        : "posts";
  supabase
    .rpc("increment_comments_count", {
      p_table: contentTable,
      p_id: contentId,
    })
    .then(({ error: rpcErr }) => {
      if (rpcErr) {
        // Fallback: manual increment if RPC doesn't exist
        supabase
          .from(contentTable)
          .select("comments_count")
          .eq("id", contentId)
          .single()
          .then(({ data: row }) => {
            if (row) {
              supabase
                .from(contentTable)
                .update({ comments_count: (row.comments_count || 0) + 1 })
                .eq("id", contentId);
            }
          });
      }
    });

  return data;
}

async function toggleCommentLike(commentId, userId) {
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("comment_likes").delete().eq("id", existing.id);
    return false;
  } else {
    await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: userId });
    return true;
  }
}

async function fetchCommentLikes(userId, commentIds) {
  if (!commentIds.length) return new Set();
  const { data } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", userId)
    .in("comment_id", commentIds);
  return new Set((data || []).map((r) => r.comment_id));
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ user, size = 34 }) => {
  const initials = (user?.full_name || user?.username || "?")[0].toUpperCase();
  return user?.avatar_url ? (
    <img
      src={user.avatar_url}
      alt={user.username}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.07)",
      }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #84cc16, #22d3ee)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "#0a0a0a",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

// ─── Single comment row ───────────────────────────────────────────────────────
const CommentRow = ({
  comment,
  currentUserId,
  onReply,
  liked,
  onToggleLike,
  isReply = false,
}) => {
  const [localLiked, setLocalLiked] = useState(liked);
  const [likeCount, setLikeCount] = useState(comment.like_count || 0);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    setLocalLiked(liked);
  }, [liked]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const nowLiked = !localLiked;
    setLocalLiked(nowLiked);
    setLikeCount((c) => c + (nowLiked ? 1 : -1));
    try {
      await toggleCommentLike(comment.id, currentUserId);
    } catch {
      setLocalLiked(!nowLiked);
      setLikeCount((c) => c + (nowLiked ? -1 : 1));
    } finally {
      setLiking(false);
    }
    if (onToggleLike) onToggleLike(comment.id, nowLiked);
  };

  const profile = comment.profiles;

  return (
    <div className={`cm-comment${isReply ? " cm-reply" : ""}`}>
      <Avatar user={profile} size={isReply ? 28 : 34} />
      <div className="cm-comment-body">
        <div className="cm-comment-bubble">
          <span className="cm-username">{profile?.username || "user"}</span>
          <span className="cm-text">{comment.content}</span>
        </div>
        <div className="cm-comment-meta">
          <span className="cm-time">{timeAgo(comment.created_at)}</span>
          {!isReply && (
            <button
              className="cm-meta-btn"
              onClick={() => onReply && onReply(comment)}
            >
              Reply
            </button>
          )}
          <button
            className={`cm-meta-btn cm-like-btn${localLiked ? " cm-like-btn-active" : ""}`}
            onClick={handleLike}
          >
            <Heart
              size={11}
              fill={localLiked ? "#ef4444" : "none"}
              color={localLiked ? "#ef4444" : "#525252"}
            />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const CommentModal = ({
  content,
  currentUser,
  onClose,
  onCommentPosted, // ← called after every successful comment post
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [likedIds, setLikedIds] = useState(new Set());
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // ── Load comments ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchComments(content.type, content.id)
      .then(async (rows) => {
        if (!mounted) return;
        setComments(rows);
        if (currentUser?.id && rows.length) {
          const ids = rows.map((r) => r.id);
          const liked = await fetchCommentLikes(currentUser.id, ids);
          if (mounted) setLikedIds(liked);
        }
      })
      .catch((err) => {
        console.error("fetchComments error:", err);
        if (mounted) setError("Couldn't load comments.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [content.id, content.type, currentUser?.id]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting || !currentUser?.id) return;
    setSubmitting(true);

    // Optimistic comment object
    const optimistic = {
      id: `opt-${Date.now()}`,
      content: trimmed,
      created_at: new Date().toISOString(),
      parent_id: replyTo?.id || null,
      user_id: currentUser.id,
      like_count: 0,
      profiles: {
        id: currentUser.id,
        username:
          currentUser.user_metadata?.username ||
          currentUser.email?.split("@")[0] ||
          "you",
        full_name: currentUser.user_metadata?.full_name || "",
        avatar_url: currentUser.user_metadata?.avatar_url || null,
      },
    };

    // Push optimistically
    setComments((prev) => [...prev, optimistic]);
    setText("");
    setReplyTo(null);

    // Scroll to bottom
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);

    try {
      const saved = await postComment(
        content.type,
        content.id,
        currentUser.id,
        trimmed,
        replyTo?.id || null,
      );
      // Replace optimistic entry with real DB row
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? saved : c)),
      );
      // ← Tell ReactionPanel the count went up
      if (onCommentPosted) onCommentPosted();
    } catch (err) {
      console.error("postComment error:", err);
      // Rollback
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setText(trimmed);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, currentUser, content, replyTo, onCommentPosted]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Build threaded view (top-level + replies inline) ───────────────────────
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap = {};
  for (const c of comments) {
    if (c.parent_id) {
      if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
      repliesMap[c.parent_id].push(c);
    }
  }

  const totalCount = comments.length;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return ReactDOM.createPortal(
    <div className="cm-overlay" onClick={handleOverlayClick}>
      <div className="cm-sheet">
        {/* Drag handle */}
        <div className="cm-handle" />

        {/* Header */}
        <div className="cm-header">
          <span className="cm-title">
            Comments
            {totalCount > 0 && (
              <span className="cm-count-badge">{totalCount}</span>
            )}
          </span>
          <button className="cm-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {/* Comment list */}
        <div className="cm-list" ref={listRef}>
          {loading ? (
            <div className="cm-skeletons">
              {[1, 2, 3].map((i) => (
                <div key={i} className="cm-skeleton-row">
                  <div className="cm-skel-avatar" />
                  <div className="cm-skel-lines">
                    <div className="cm-skel-line cm-skel-short" />
                    <div className="cm-skel-line cm-skel-long" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="cm-empty cm-error">{error}</div>
          ) : topLevel.length === 0 ? (
            <div className="cm-empty">
              <span className="cm-empty-icon">💬</span>
              <span>No comments yet. Be the first.</span>
            </div>
          ) : (
            topLevel.map((comment) => {
              const replies = repliesMap[comment.id] || [];
              return (
                <div key={comment.id} className="cm-thread">
                  <CommentRow
                    comment={comment}
                    currentUserId={currentUser?.id}
                    liked={likedIds.has(comment.id)}
                    onToggleLike={(id, state) => {
                      setLikedIds((prev) => {
                        const next = new Set(prev);
                        state ? next.add(id) : next.delete(id);
                        return next;
                      });
                    }}
                    onReply={(c) => {
                      setReplyTo({
                        id: c.id,
                        username: c.profiles?.username || "user",
                      });
                      inputRef.current?.focus();
                    }}
                  />
                  {replies.length > 0 && (
                    <div className="cm-replies">
                      {replies.map((reply) => (
                        <CommentRow
                          key={reply.id}
                          comment={reply}
                          currentUserId={currentUser?.id}
                          liked={likedIds.has(reply.id)}
                          onToggleLike={(id, state) => {
                            setLikedIds((prev) => {
                              const next = new Set(prev);
                              state ? next.add(id) : next.delete(id);
                              return next;
                            });
                          }}
                          isReply
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input area */}
        <div className="cm-input-area">
          {replyTo && (
            <div className="cm-reply-banner">
              <CornerDownRight size={13} color="#84cc16" />
              <span>
                Replying to <strong>@{replyTo.username}</strong>
              </span>
              <button
                className="cm-reply-clear"
                onClick={() => setReplyTo(null)}
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="cm-input-row">
            <Avatar
              user={currentUser?.user_metadata || { username: "you" }}
              size={32}
            />
            <div className="cm-input-box">
              <textarea
                ref={inputRef}
                className="cm-textarea"
                placeholder={
                  replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…"
                }
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  // Auto-grow
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 96) + "px";
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={500}
              />
              <button
                className={`cm-send-btn${text.trim() && !submitting ? " cm-send-btn-active" : ""}`}
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                aria-label="Post comment"
              >
                {submitting ? <span className="cm-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cm-overlay {
          position: fixed; inset: 0; z-index: 99991;
          background: rgba(0,0,0,0.72);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: flex-end; justify-content: center;
          animation: cmFadeIn 0.18s ease;
        }
        @keyframes cmFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .cm-sheet {
          width: 100%; max-width: 520px;
          background: #111113;
          border-radius: 24px 24px 0 0;
          border: 1px solid rgba(255,255,255,0.08); border-bottom: none;
          display: flex; flex-direction: column;
          max-height: 85vh; overflow: hidden;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          animation: cmSlideUp 0.3s cubic-bezier(0.32,0.72,0,1);
        }
        @keyframes cmSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (min-width: 560px) {
          .cm-sheet { border-radius: 24px; margin-bottom: 24px; max-height: 80vh; }
        }

        .cm-handle {
          width: 36px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.12);
          align-self: center; margin: 10px auto 0; flex-shrink: 0;
        }

        .cm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
        }
        .cm-title {
          font-size: 16px; font-weight: 700; color: #f5f5f5;
          letter-spacing: -0.3px; display: flex; align-items: center; gap: 8px;
        }
        .cm-count-badge {
          font-size: 12px; font-weight: 700; color: #84cc16;
          background: rgba(132,204,22,0.12);
          padding: 2px 8px; border-radius: 20px;
        }
        .cm-close {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.06); border: none;
          color: #a3a3a3; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .cm-close:hover { background: rgba(255,255,255,0.12); color: #f5f5f5; }

        /* List */
        .cm-list {
          flex: 1; overflow-y: auto; padding: 12px 16px 8px;
          display: flex; flex-direction: column; gap: 2px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .cm-list::-webkit-scrollbar { width: 4px; }
        .cm-list::-webkit-scrollbar-track { background: transparent; }
        .cm-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        /* Skeleton */
        .cm-skeletons { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; }
        .cm-skeleton-row { display: flex; gap: 10px; align-items: flex-start; }
        .cm-skel-avatar {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,0.06);
          animation: cmSkel 1.4s infinite;
        }
        .cm-skel-lines { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .cm-skel-line {
          height: 12px; border-radius: 6px;
          background: linear-gradient(90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: cmSkel 1.4s infinite;
        }
        .cm-skel-short { width: 35%; }
        .cm-skel-long  { width: 75%; }
        @keyframes cmSkel {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Empty */
        .cm-empty {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 40px 20px; color: #525252; font-size: 14px; font-weight: 500;
          text-align: center;
        }
        .cm-empty-icon { font-size: 28px; }
        .cm-error { color: #f87171; }

        /* Thread */
        .cm-thread { display: flex; flex-direction: column; gap: 0; margin-bottom: 6px; }
        .cm-replies { display: flex; flex-direction: column; gap: 2px; margin-left: 44px; margin-top: 2px; }

        /* Comment row */
        .cm-comment {
          display: flex; gap: 10px; padding: 8px 6px; border-radius: 14px;
          transition: background 0.15s;
        }
        .cm-comment:hover { background: rgba(255,255,255,0.03); }
        .cm-reply { padding: 6px 6px; }

        .cm-comment-body { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }

        .cm-comment-bubble {
          display: flex; flex-direction: column; gap: 2px;
        }
        .cm-username {
          font-size: 12px; font-weight: 700; color: #a3a3a3;
        }
        .cm-text {
          font-size: 14px; color: #e5e5e5; line-height: 1.45;
          word-break: break-word;
        }
        .cm-reply .cm-text { font-size: 13px; }

        .cm-comment-meta {
          display: flex; align-items: center; gap: 12px;
        }
        .cm-time { font-size: 11px; color: #525252; font-weight: 500; }
        .cm-meta-btn {
          font-size: 11px; font-weight: 700; color: #525252;
          background: none; border: none; cursor: pointer; padding: 0;
          transition: color 0.15s; display: flex; align-items: center; gap: 3px;
        }
        .cm-meta-btn:hover { color: #a3a3a3; }
        .cm-like-btn-active { color: #ef4444 !important; }

        /* Input area */
        .cm-input-area {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 10px 16px 14px; flex-shrink: 0;
          display: flex; flex-direction: column; gap: 8px;
          background: #111113;
        }

        .cm-reply-banner {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 10px; border-radius: 8px;
          background: rgba(132,204,22,0.07);
          border: 1px solid rgba(132,204,22,0.15);
          font-size: 12px; color: #a3a3a3;
        }
        .cm-reply-banner strong { color: #84cc16; font-weight: 700; }
        .cm-reply-clear {
          margin-left: auto; background: none; border: none;
          color: #525252; cursor: pointer;
          display: flex; align-items: center;
          transition: color 0.15s;
        }
        .cm-reply-clear:hover { color: #a3a3a3; }

        .cm-input-row { display: flex; align-items: flex-end; gap: 10px; }

        .cm-input-box {
          flex: 1; display: flex; align-items: flex-end;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px; padding: 8px 8px 8px 14px;
          gap: 6px; transition: border-color 0.15s;
        }
        .cm-input-box:focus-within { border-color: rgba(132,204,22,0.35); }

        .cm-textarea {
          flex: 1; background: none; border: none; outline: none;
          color: #e5e5e5; font-size: 14px; line-height: 1.45; resize: none;
          min-height: 22px; max-height: 96px; padding: 0;
          font-family: inherit;
        }
        .cm-textarea::placeholder { color: #525252; }

        .cm-send-btn {
          width: 32px; height: 32px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.06); color: #525252;
          display: flex; align-items: center; justify-content: center;
          cursor: default; flex-shrink: 0;
          transition: background 0.15s, color 0.15s, transform 0.1s;
        }
        .cm-send-btn-active {
          background: #84cc16 !important; color: #0a0a0a !important; cursor: pointer;
        }
        .cm-send-btn-active:hover { background: #a3e635 !important; }
        .cm-send-btn-active:active { transform: scale(0.9); }

        .cm-spin {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.25);
          border-top-color: #0a0a0a;
          display: inline-block;
          animation: cmSpin 0.65s linear infinite;
        }
        @keyframes cmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body,
  );
};

export default CommentModal;
