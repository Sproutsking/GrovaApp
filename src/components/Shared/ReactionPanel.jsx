// src/components/Reactions/ReactionPanel.jsx
// FULLY OPTIMISTIC — every action is instant. Background sync with rollback.
// EP costs: Like=2, Comment=4, Share=10
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Heart, MessageCircle, Share2, Eye, Bookmark } from "lucide-react";
import LikeModel from "../../models/LikeModel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import SaveFolderModal from "../Modals/SaveFolderModal";
import { supabase } from "../../services/config/supabase";

const EP_COSTS = { like: 2, comment: 4, share: 10 };

// ── EP helpers (fire-and-forget) ──────────────────────────────────────────────
async function deductEP(userId, amount, reason) {
  try {
    const { data } = await supabase.rpc("deduct_ep", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    });
    return !!data;
  } catch {
    return false;
  }
}
async function awardEP(userId, amount, reason) {
  try {
    await supabase.rpc("award_ep", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    });
  } catch {
    /* silent */
  }
}

// ── EP balance cache (30s TTL) ────────────────────────────────────────────────
const epCache = { balance: null, fetched: 0 };
async function getEPBalance(userId) {
  const now = Date.now();
  if (epCache.balance !== null && now - epCache.fetched < 30_000)
    return epCache.balance;
  try {
    const { data } = await supabase
      .from("wallets")
      .select("engagement_points")
      .eq("user_id", userId)
      .single();
    epCache.balance = data?.engagement_points ?? 0;
    epCache.fetched = now;
    return epCache.balance;
  } catch {
    return 0;
  }
}
function invalidateEPCache() {
  epCache.balance = null;
}

// ── Format numbers ────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

// ── Check saved state ─────────────────────────────────────────────────────────
async function checkSavedState(contentType, contentId, userId) {
  try {
    const { data } = await supabase
      .from("saved_content")
      .select("id")
      .eq("user_id", userId)
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

// ── Unsave ────────────────────────────────────────────────────────────────────
async function unsaveContent(contentType, contentId, userId) {
  const { error } = await supabase
    .from("saved_content")
    .delete()
    .eq("user_id", userId)
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  if (error) throw error;
}

// ── Fair views model ──────────────────────────────────────────────────────────
// Rules:
//  1. Never count own views
//  2. Count only after 3s of dwell time (not just a scroll-past)
//  3. Count once per session per piece of content (in-memory Set)
//  4. Fire-and-forget — never blocks UI
const viewedThisSession = new Set();

function trackView(contentType, contentId, userId) {
  const key = `${contentType}:${contentId}`;
  if (viewedThisSession.has(key)) return null; // already counted this session

  const timer = setTimeout(async () => {
    if (viewedThisSession.has(key)) return;
    viewedThisSession.add(key);
    try {
      const table =
        contentType === "post"
          ? "posts"
          : contentType === "reel"
            ? "reels"
            : "stories";
      const { data: row } = await supabase
        .from(table)
        .select("views, user_id")
        .eq("id", contentId)
        .single();
      if (!row) return;
      if (row.user_id === userId) return; // rule 1: never own views
      await supabase
        .from(table)
        .update({ views: (row.views || 0) + 1 })
        .eq("id", contentId);
    } catch {
      /* silent */
    }
  }, 3000); // rule 2: 3s dwell

  return () => clearTimeout(timer);
}

// ── Main component ────────────────────────────────────────────────────────────
const ReactionPanel = ({
  content,
  currentUser,
  layout = "horizontal",
  showSave = true,
  showViews = true,
  compact = false,
  className = "",
  onComment,
  onShare,
  onCommented, // callback(updatedContent) — parent can update comment count in feed
  onContentUpdate, // callback(updatedContent) — generic patch to parent feed item
}) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(content.likes || 0);
  const [commentCount, setCommentCount] = useState(content.comments_count || 0);
  const [shareCount, setShareCount] = useState(content.shares || 0);
  const [viewCount, setViewCount] = useState(content.views || 0);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSaveFolderModal, setShowSaveFolderModal] = useState(false);
  const [epError, setEpError] = useState(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const likeRef = useRef(null);
  const saveRef = useRef(null);
  const epErrTimer = useRef(null);
  const viewCleanup = useRef(null);

  // ── Mount: check liked/saved, start view timer ────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    let mounted = true;

    LikeModel.checkIfLiked(content.type, content.id, currentUser.id)
      .then((v) => {
        if (mounted) setLiked(v);
      })
      .catch(() => {});

    checkSavedState(content.type, content.id, currentUser.id)
      .then((v) => {
        if (mounted) setSaved(v);
      })
      .catch(() => {});

    viewCleanup.current = trackView(content.type, content.id, currentUser.id);

    return () => {
      mounted = false;
      if (viewCleanup.current) viewCleanup.current();
    };
  }, [content.id, content.type, currentUser?.id]);

  // Sync counts when parent re-renders with fresh DB data
  useEffect(() => {
    setLikeCount(content.likes || 0);
    setCommentCount(content.comments_count || 0);
    setShareCount(content.shares || 0);
    setViewCount(content.views || 0);
  }, [content.likes, content.comments_count, content.shares, content.views]);

  const showEpError = useCallback((msg) => {
    setEpError(msg);
    clearTimeout(epErrTimer.current);
    epErrTimer.current = setTimeout(() => setEpError(null), 3000);
  }, []);

  // ── LIKE — fully optimistic ───────────────────────────────────────────────
  const handleLike = useCallback(
    async (e) => {
      e.stopPropagation();
      if (!currentUser?.id || isLiking) return;
      setIsLiking(true);

      if (liked) {
        // UNLIKE — instant, free
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
        LikeModel.toggleLike(content.type, content.id, currentUser.id)
          .catch(() => {
            setLiked(true);
            setLikeCount((c) => c + 1);
          })
          .finally(() => setIsLiking(false));
        return;
      }

      // LIKE — check EP
      const balance = await getEPBalance(currentUser.id);
      if (balance < EP_COSTS.like) {
        showEpError(`Need ${EP_COSTS.like} EP to like`);
        setIsLiking(false);
        return;
      }

      setLiked(true);
      setLikeCount((c) => c + 1);
      invalidateEPCache();

      const epOk = await deductEP(
        currentUser.id,
        EP_COSTS.like,
        `like_${content.type}`,
      );
      if (!epOk) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
        showEpError(`Need ${EP_COSTS.like} EP to like`);
        setIsLiking(false);
        return;
      }

      if (content.user_id && content.user_id !== currentUser.id) {
        const fee = content.profiles?.is_pro ? 0.08 : 0.18;
        awardEP(content.user_id, EP_COSTS.like * (1 - fee), "received_like");
      }

      LikeModel.toggleLike(content.type, content.id, currentUser.id)
        .catch(() => {
          setLiked(false);
          setLikeCount((c) => Math.max(0, c - 1));
        })
        .finally(() => setIsLiking(false));
    },
    [currentUser?.id, liked, isLiking, content, showEpError],
  );

  // ── COMMENT ───────────────────────────────────────────────────────────────
  const handleComment = useCallback(
    (e) => {
      e.stopPropagation();
      if (onComment) {
        onComment(content);
      } else {
        setShowComments(true);
      }
    },
    [onComment, content],
  );

  // Called by CommentModal: delta=+1 on post, delta=-1 on rollback
  const handleCommentPosted = useCallback(
    (delta = 1) => {
      setCommentCount((c) => {
        const next = Math.max(0, c + delta);
        const updated = { ...content, comments_count: next };
        if (onCommented) onCommented(updated);
        if (onContentUpdate) onContentUpdate(updated);
        return next;
      });
    },
    [content, onCommented, onContentUpdate],
  );

  // ── SHARE ─────────────────────────────────────────────────────────────────
  const handleShare = useCallback(
    (e) => {
      e.stopPropagation();
      setShareCount((c) => c + 1);
      if (onShare) {
        onShare(content);
      } else {
        setShowShareModal(true);
      }
    },
    [onShare, content],
  );

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (e) => {
      e.stopPropagation();
      if (!currentUser?.id || isSaving) return;

      if (saved) {
        setIsSaving(true);
        setSaved(false);
        try {
          await unsaveContent(content.type, content.id, currentUser.id);
        } catch {
          setSaved(true);
        } finally {
          setIsSaving(false);
        }
      } else {
        setShowSaveFolderModal(true);
      }
    },
    [currentUser?.id, saved, isSaving, content],
  );

  const triggerRipple = (ref) => {
    if (!ref.current) return;
    ref.current.classList.remove("btn-pop");
    void ref.current.offsetWidth;
    ref.current.classList.add("btn-pop");
  };

  return (
    <>
      {epError && <div className="ep-error-toast">⚡ {epError}</div>}

      <div
        className={`reaction-panel reaction-panel-${layout}${compact ? " reaction-panel-compact" : ""} ${className}`}
      >
        {/* LIKE */}
        <button
          ref={likeRef}
          className={`reaction-btn${liked ? " reaction-btn-liked" : ""}`}
          onClick={(e) => {
            triggerRipple(likeRef);
            handleLike(e);
          }}
          aria-label={liked ? "Unlike" : "Like"}
          disabled={isLiking}
        >
          <Heart
            size={compact ? 16 : 18}
            fill={liked ? "#ef4444" : "none"}
            color={liked ? "#ef4444" : "#a3a3a3"}
            className={liked ? "heart-beat" : ""}
          />
          <span className="reaction-count">{fmt(likeCount)}</span>
          {!compact && <span className="ep-label">·{EP_COSTS.like}EP</span>}
        </button>

        {/* COMMENT */}
        <button
          className="reaction-btn"
          onClick={handleComment}
          aria-label="Comment"
        >
          <MessageCircle size={compact ? 16 : 18} color="#a3a3a3" />
          <span className="reaction-count">{fmt(commentCount)}</span>
          {!compact && <span className="ep-label">·{EP_COSTS.comment}EP</span>}
        </button>

        {/* SHARE */}
        <button
          className="reaction-btn"
          onClick={handleShare}
          aria-label="Share"
        >
          <Share2 size={compact ? 16 : 18} color="#a3a3a3" />
          <span className="reaction-count">{fmt(shareCount)}</span>
        </button>

        {/* SAVE */}
        {showSave && (
          <button
            ref={saveRef}
            className={`reaction-btn${saved ? " reaction-btn-saved" : ""}`}
            onClick={(e) => {
              triggerRipple(saveRef);
              handleSave(e);
            }}
            aria-label={saved ? "Unsave" : "Save"}
            disabled={isSaving}
          >
            <Bookmark
              size={compact ? 16 : 18}
              fill={saved ? "#fbbf24" : "none"}
              color={saved ? "#fbbf24" : "#a3a3a3"}
            />
          </button>
        )}

        {/* VIEWS */}
        {showViews && (
          <span className="reaction-stat">
            <Eye size={compact ? 14 : 16} color="#525252" />
            <span>{fmt(viewCount)}</span>
          </span>
        )}
      </div>

      {/* ── Portalled modals ────────────────────────────────────────────── */}
      {showComments &&
        ReactDOM.createPortal(
          <CommentModal
            content={content}
            currentUser={currentUser}
            onClose={() => setShowComments(false)}
            isMobile={window.innerWidth <= 768}
            onCommentPosted={handleCommentPosted}
          />,
          document.body,
        )}

      {showShareModal &&
        ReactDOM.createPortal(
          <ShareModal
            content={content}
            currentUser={currentUser}
            onClose={() => {
              setShowShareModal(false);
              setShareCount((c) => Math.max(0, c - 1));
            }}
            onShared={() => {
              /* count already bumped */
            }}
          />,
          document.body,
        )}

      {showSaveFolderModal &&
        ReactDOM.createPortal(
          <SaveFolderModal
            content={content}
            currentUser={currentUser}
            onClose={() => setShowSaveFolderModal(false)}
            onSaved={() => {
              setSaved(true);
              setShowSaveFolderModal(false);
            }}
          />,
          document.body,
        )}

      <style>{`
        .ep-error-toast {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background: #18181b; border: 1px solid rgba(239,68,68,.4); color: #f87171;
          padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
          z-index: 99999; white-space: nowrap;
          animation: toastIn 0.2s cubic-bezier(0.34,1.56,0.64,1); pointer-events: none;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .reaction-panel {
          width: 100%; display: flex; align-items: center;
          justify-content: space-between; padding: 6px 10px; margin-top: 4px; gap: 2px;
        }
        .reaction-panel-horizontal { flex-direction: row; }
        .reaction-panel-vertical   { flex-direction: column; gap: 8px; }
        .reaction-panel-compact    { padding: 4px 8px; }
        .reaction-btn {
          position: relative; display: flex; align-items: center; gap: 5px;
          padding: 7px 10px; border-radius: 12px; background: transparent; border: none;
          color: #a3a3a3; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent; touch-action: manipulation;
          outline: none; flex: 1; justify-content: center;
        }
        .reaction-panel-compact .reaction-btn { padding: 5px 8px; font-size: 12px; border-radius: 10px; }
        .reaction-btn:hover { background: rgba(255,255,255,0.06); color: #e5e5e5; }
        .reaction-btn:active { transform: scale(0.93); }
        .reaction-btn:disabled { opacity: 0.7; cursor: default; }
        .reaction-btn-liked { color: #ef4444 !important; }
        .reaction-btn-liked:hover { background: rgba(239,68,68,0.08) !important; }
        .reaction-btn-saved { color: #fbbf24 !important; }
        .reaction-btn-saved:hover { background: rgba(251,191,36,0.08) !important; }
        .btn-pop svg { animation: btnPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes btnPop {
          0% { transform: scale(1); } 40% { transform: scale(1.35); }
          70% { transform: scale(0.9); } 100% { transform: scale(1.1); }
        }
        .heart-beat { animation: heartBeat 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes heartBeat {
          0% { transform: scale(1); } 30% { transform: scale(1.4); }
          60% { transform: scale(0.95); } 100% { transform: scale(1.1); }
        }
        .reaction-count { font-variant-numeric: tabular-nums; min-width: 18px; text-align: left; transition: all 0.15s ease; }
        .ep-label { font-size: 10px; opacity: 0.45; margin-left: 1px; font-weight: 500; }
        .reaction-stat { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 10px; color: #525252; font-size: 12px; font-weight: 600; }
        .reaction-panel-horizontal > .reaction-btn:nth-child(1),
        .reaction-panel-horizontal > .reaction-btn:nth-child(2),
        .reaction-panel-horizontal > .reaction-btn:nth-child(3) { flex: 1; }
        .reaction-panel-horizontal > .reaction-btn.reaction-btn-saved,
        .reaction-panel-horizontal > .reaction-stat { flex: 0 0 auto; }
        @media (max-width: 768px) {
          .reaction-panel { padding: 5px 6px; }
          .reaction-btn { padding: 7px 6px; font-size: 12px; }
        }
      `}</style>
    </>
  );
};

export default ReactionPanel;
