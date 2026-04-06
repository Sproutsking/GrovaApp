// src/components/Reactions/ReactionPanel.jsx
// ============================================================================
// REACTION PANEL — Fully optimistic UI with atomic EP economy
//
// EP FLOW PER ACTION:
//   Like on post/reel/story:
//     processEngagement(contentType='post|reel|story', type='like')
//     + toggleLike in DB  (both run in parallel for speed)
//
//   Comment on post/reel/story:
//     CommentModal handles submit → calls processEngagement(type='comment')
//     with contentType = post|reel|story, contentId = original content
//
//   Reply to a comment:
//     CommentModal handles submit → calls processEngagement(type='reply')
//     with contentType = 'comment', contentId = parent comment ID
//     (DB function resolves post owner automatically — chain reaction fires)
//
//   Share:
//     processEngagement(contentType, type='share') fires in background
//     Count bumped optimistically; rolled back if EP insufficient
//
//   Save: no EP cost, no processEngagement call
//
// SELF-ENGAGEMENT:
//   processEngagement returns { selfEngagement: true } — the like/share is
//   still recorded in the DB but no EP moves in either direction.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Heart, MessageCircle, Share2, Eye, Bookmark } from 'lucide-react';
import LikeModel from '../../models/LikeModel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import SaveFolderModal from '../Modals/SaveFolderModal';
import { supabase } from '../../services/config/supabase';
import {
  processEngagement,
  canAffordEngagement,
  getEPBalance,
  invalidateEPCache,
  EP_COSTS,
  getDistributionBreakdown,
} from '../../services/economy/epEconomyService';

// ── Number formatter ──────────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── View tracking: 3 s dwell, once per session, never own views ───────────────
const _viewedThisSession = new Set();

function startViewTimer(contentType, contentId, userId) {
  const key = `${contentType}:${contentId}`;
  if (_viewedThisSession.has(key)) return null;

  const timer = setTimeout(async () => {
    if (_viewedThisSession.has(key)) return;
    _viewedThisSession.add(key);
    try {
      const tableMap = { post: 'posts', reel: 'reels', story: 'stories' };
      const table    = tableMap[contentType];
      if (!table) return;

      const { data: row } = await supabase
        .from(table)
        .select('views, user_id')
        .eq('id', contentId)
        .single();

      if (!row || row.user_id === userId) return; // never count own view
      await supabase
        .from(table)
        .update({ views: (row.views || 0) + 1 })
        .eq('id', contentId);
    } catch {
      /* silent — view tracking must never disrupt the UI */
    }
  }, 3_000);

  return () => clearTimeout(timer);
}

// ── Saved-content helpers ─────────────────────────────────────────────────────
async function checkSaved(contentType, contentId, userId) {
  try {
    const { data } = await supabase
      .from('saved_content')
      .select('id')
      .eq('user_id',      userId)
      .eq('content_type', contentType)
      .eq('content_id',   contentId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function removeSaved(contentType, contentId, userId) {
  const { error } = await supabase
    .from('saved_content')
    .delete()
    .eq('user_id',      userId)
    .eq('content_type', contentType)
    .eq('content_id',   contentId);
  if (error) throw error;
}

// =============================================================================
const ReactionPanel = ({
  content,          // { id, type, user_id, likes, comments_count, shares, views }
  currentUser,      // { id, username }
  layout    = 'horizontal',
  showSave  = true,
  showViews = true,
  compact   = false,
  className = '',
  onComment,        // optional: open custom comment UI instead of built-in modal
  onShare,          // optional: open custom share UI instead of built-in modal
  onCommented,      // (updatedContent) → notify parent of comment count change
  onContentUpdate,  // (updatedContent) → generic parent patch
}) => {
  const [liked,          setLiked]          = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [likeCount,      setLikeCount]      = useState(content.likes          ?? 0);
  const [commentCount,   setCommentCount]   = useState(content.comments_count ?? 0);
  const [shareCount,     setShareCount]     = useState(content.shares         ?? 0);
  const [viewCount,      setViewCount]      = useState(content.views          ?? 0);
  const [showComments,   setShowComments]   = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSaveModal,  setShowSaveModal]  = useState(false);
  const [epError,        setEpError]        = useState(null);
  const [isLiking,       setIsLiking]       = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);

  const likeRef     = useRef(null);
  const saveRef     = useRef(null);
  const epErrTimer  = useRef(null);
  const viewCleanup = useRef(null);

  // ── Mount: resolve liked/saved, start view timer ──────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    let mounted = true;

    LikeModel.checkIfLiked(content.type, content.id, currentUser.id)
      .then(v  => { if (mounted) setLiked(v); })
      .catch(() => {});

    checkSaved(content.type, content.id, currentUser.id)
      .then(v  => { if (mounted) setSaved(v); })
      .catch(() => {});

    viewCleanup.current = startViewTimer(content.type, content.id, currentUser.id);

    return () => {
      mounted = false;
      if (viewCleanup.current) viewCleanup.current();
    };
  }, [content.id, content.type, currentUser?.id]);

  // ── Sync counts when parent re-renders with fresh DB data ─────────────────
  useEffect(() => { setLikeCount(content.likes          ?? 0); }, [content.likes]);
  useEffect(() => { setCommentCount(content.comments_count ?? 0); }, [content.comments_count]);
  useEffect(() => { setShareCount(content.shares         ?? 0); }, [content.shares]);
  useEffect(() => { setViewCount(content.views           ?? 0); }, [content.views]);

  // ── EP error toast (auto-dismisses after 3 s) ─────────────────────────────
  const showEpError = useCallback((msg) => {
    setEpError(msg);
    clearTimeout(epErrTimer.current);
    epErrTimer.current = setTimeout(() => setEpError(null), 3_000);
  }, []);

  // ── Ripple pop animation ──────────────────────────────────────────────────
  const ripple = (ref) => {
    if (!ref.current) return;
    ref.current.classList.remove('rp-pop');
    void ref.current.offsetWidth;
    ref.current.classList.add('rp-pop');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LIKE
  // ══════════════════════════════════════════════════════════════════════════
  const handleLike = useCallback(async (e) => {
    e.stopPropagation();
    if (!currentUser?.id || isLiking) return;
    setIsLiking(true);

    // ── Unlike: no EP cost, just remove the like ─────────────────────────
    if (liked) {
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));

      LikeModel.toggleLike(content.type, content.id, currentUser.id)
        .catch(() => {
          // Rollback
          setLiked(true);
          setLikeCount(c => c + 1);
        })
        .finally(() => setIsLiking(false));
      return;
    }

    // ── Like: pre-flight EP check (uses 30 s cache, no extra DB hit) ─────
    const affordable = await canAffordEngagement(currentUser.id, 'like');
    if (!affordable) {
      showEpError(`Need ${EP_COSTS.like} EP to like.`);
      setIsLiking(false);
      return;
    }

    // Optimistic UI
    setLiked(true);
    setLikeCount(c => c + 1);

    // Run EP deduction + DB like-toggle in parallel for maximum speed
    const [epResult, likeErr] = await Promise.all([
      processEngagement({
        actorId:        currentUser.id,
        contentType:    content.type,
        contentId:      content.id,
        engagementType: 'like',
      }),
      LikeModel.toggleLike(content.type, content.id, currentUser.id)
        .then(() => null)
        .catch(err => err),
    ]);

    const epFailed   = !epResult.success && !epResult.selfEngagement;
    const likeFailed = likeErr !== null;

    if (epFailed || likeFailed) {
      // Full rollback
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
      invalidateEPCache(currentUser.id);

      if (epFailed) {
        showEpError(epResult.error ?? `Need ${EP_COSTS.like} EP to like.`);
      } else {
        showEpError('Like failed. Please try again.');
      }
    }

    setIsLiking(false);
  }, [currentUser?.id, liked, isLiking, content, showEpError]);

  // ══════════════════════════════════════════════════════════════════════════
  // COMMENT
  // CommentModal is responsible for calling processEngagement on submit:
  //   top-level comment → contentType = content.type, type = 'comment'
  //   reply             → contentType = 'comment',    type = 'reply', contentId = parentCommentId
  // It calls back via onCommentPosted(delta, meta) when done.
  // ══════════════════════════════════════════════════════════════════════════
  const handleComment = useCallback((e) => {
    e.stopPropagation();
    if (onComment) {
      onComment(content);
    } else {
      setShowComments(true);
    }
  }, [onComment, content]);

  /**
   * Called by CommentModal:
   *   delta = +1 on successful post, -1 on rollback
   *   meta  = { isReply: boolean, parentCommentId?: string }
   *
   * EP is processed here (not inside the modal) so this component stays in
   * control of all EP side-effects and rollback logic.
   */
  const handleCommentPosted = useCallback(async (delta, meta = {}) => {
    // Update local count and bubble to parent
    setCommentCount(c => {
      const next    = Math.max(0, c + delta);
      const updated = { ...content, comments_count: next };
      if (onCommented)     onCommented(updated);
      if (onContentUpdate) onContentUpdate(updated);
      return next;
    });

    // Only process EP on a successful post (delta === +1)
    if (delta !== 1 || !currentUser?.id) return;

    const { isReply, parentCommentId } = meta;

    const epResult = await processEngagement({
      actorId:        currentUser.id,
      contentType:    isReply ? 'comment'      : content.type,
      contentId:      isReply ? parentCommentId : content.id,
      engagementType: isReply ? 'reply'         : 'comment',
    });

    if (!epResult.success && !epResult.selfEngagement) {
      // EP failed after comment was recorded — show info toast (don't undo comment)
      showEpError(epResult.error ?? `Need ${EP_COSTS.comment} EP to comment.`);
    }
  }, [content, currentUser?.id, onCommented, onContentUpdate, showEpError]);

  // ══════════════════════════════════════════════════════════════════════════
  // SHARE
  // ══════════════════════════════════════════════════════════════════════════
  const handleShare = useCallback(async (e) => {
    e.stopPropagation();

    // Optimistic count bump immediately
    setShareCount(c => c + 1);

    if (onShare) {
      onShare(content);
    } else {
      setShowShareModal(true);
    }

    if (!currentUser?.id) return;

    // EP processing runs in background — non-blocking for UX
    processEngagement({
      actorId:        currentUser.id,
      contentType:    content.type,
      contentId:      content.id,
      engagementType: 'share',
    }).then(result => {
      if (!result.success && !result.selfEngagement && !result.free) {
        // Roll back count if EP was genuinely insufficient
        setShareCount(c => Math.max(0, c - 1));
        showEpError(result.error ?? `Need ${EP_COSTS.share} EP to share.`);
      }
    });
  }, [currentUser?.id, content, onShare, showEpError]);

  // ══════════════════════════════════════════════════════════════════════════
  // SAVE  (no EP cost)
  // ══════════════════════════════════════════════════════════════════════════
  const handleSave = useCallback(async (e) => {
    e.stopPropagation();
    if (!currentUser?.id || isSaving) return;

    if (saved) {
      setIsSaving(true);
      setSaved(false);
      removeSaved(content.type, content.id, currentUser.id)
        .catch(() => setSaved(true))
        .finally(() => setIsSaving(false));
    } else {
      setShowSaveModal(true);
    }
  }, [currentUser?.id, saved, isSaving, content]);

  // ── Build like tooltip from distribution breakdown ────────────────────────
  const likeBreakdown = getDistributionBreakdown(content.type, 'like');
  const likeTooltip   = likeBreakdown.lines.join(' · ');

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* EP error toast */}
      {epError && (
        <div className="rp-ep-toast" role="alert">
          <span style={{ color: '#f87171', marginRight: 6 }}>⚡</span>
          {epError}
        </div>
      )}

      <div
        className={[
          'rp-panel',
          `rp-panel--${layout}`,
          compact   ? 'rp-panel--compact' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        {/* ── LIKE ── */}
        <button
          ref={likeRef}
          className={`rp-btn${liked ? ' rp-btn--liked' : ''}`}
          onClick={e => { ripple(likeRef); handleLike(e); }}
          disabled={isLiking}
          aria-label={liked ? 'Unlike' : `Like · costs ${EP_COSTS.like} EP`}
          title={likeTooltip}
        >
          <Heart
            size={compact ? 16 : 18}
            fill={liked ? '#ef4444' : 'none'}
            color={liked ? '#ef4444' : '#a3a3a3'}
            className={liked ? 'rp-heart-beat' : ''}
          />
          <span className="rp-count">{fmt(likeCount)}</span>
          {!compact && <span className="rp-ep-label">·{EP_COSTS.like}EP</span>}
        </button>

        {/* ── COMMENT ── */}
        <button
          className="rp-btn"
          onClick={handleComment}
          aria-label={`Comment · costs ${EP_COSTS.comment} EP`}
          title={`Commenting costs ${EP_COSTS.comment} EP`}
        >
          <MessageCircle size={compact ? 16 : 18} color="#a3a3a3" />
          <span className="rp-count">{fmt(commentCount)}</span>
          {!compact && <span className="rp-ep-label">·{EP_COSTS.comment}EP</span>}
        </button>

        {/* ── SHARE ── */}
        <button
          className="rp-btn"
          onClick={handleShare}
          aria-label={`Share · costs ${EP_COSTS.share} EP`}
          title={`Sharing costs ${EP_COSTS.share} EP`}
        >
          <Share2 size={compact ? 16 : 18} color="#a3a3a3" />
          <span className="rp-count">{fmt(shareCount)}</span>
          {!compact && <span className="rp-ep-label">·{EP_COSTS.share}EP</span>}
        </button>

        {/* ── SAVE (no EP cost) ── */}
        {showSave && (
          <button
            ref={saveRef}
            className={`rp-btn${saved ? ' rp-btn--saved' : ''}`}
            onClick={e => { ripple(saveRef); handleSave(e); }}
            disabled={isSaving}
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            <Bookmark
              size={compact ? 16 : 18}
              fill={saved  ? '#fbbf24' : 'none'}
              color={saved ? '#fbbf24' : '#a3a3a3'}
            />
          </button>
        )}

        {/* ── VIEWS (display only) ── */}
        {showViews && (
          <span className="rp-stat" aria-label={`${viewCount} views`}>
            <Eye size={compact ? 14 : 16} color="#525252" />
            <span>{fmt(viewCount)}</span>
          </span>
        )}
      </div>

      {/* ── Portalled modals ── */}
      {showComments && ReactDOM.createPortal(
        <CommentModal
          content={content}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={typeof window !== 'undefined' && window.innerWidth <= 768}
          onCommentPosted={handleCommentPosted}
        />,
        document.body,
      )}

      {showShareModal && ReactDOM.createPortal(
        <ShareModal
          content={content}
          currentUser={currentUser}
          onClose={() => setShowShareModal(false)}
          onShared={() => { /* count already bumped optimistically */ }}
        />,
        document.body,
      )}

      {showSaveModal && ReactDOM.createPortal(
        <SaveFolderModal
          content={content}
          currentUser={currentUser}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => { setSaved(true); setShowSaveModal(false); }}
        />,
        document.body,
      )}

      <style>{`
        .rp-panel {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          margin-top: 4px;
          gap: 2px;
        }
        .rp-panel--horizontal { flex-direction: row; }
        .rp-panel--vertical   { flex-direction: column; gap: 8px; }
        .rp-panel--compact    { padding: 4px 8px; }

        .rp-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 10px;
          border-radius: 12px;
          background: transparent;
          border: none;
          color: #a3a3a3;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.15s, background 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          outline: none;
          flex: 1;
          justify-content: center;
        }
        .rp-panel--compact .rp-btn { padding: 5px 8px; font-size: 12px; border-radius: 10px; }
        .rp-btn:hover:not(:disabled)  { background: rgba(255,255,255,0.06); color: #e5e5e5; }
        .rp-btn:active:not(:disabled) { transform: scale(0.93); }
        .rp-btn:disabled { opacity: 0.6; cursor: default; }

        .rp-btn--liked { color: #ef4444 !important; }
        .rp-btn--liked:hover { background: rgba(239,68,68,0.08) !important; }
        .rp-btn--saved { color: #fbbf24 !important; }
        .rp-btn--saved:hover { background: rgba(251,191,36,0.08) !important; }

        .rp-pop svg {
          animation: rpBtnPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes rpBtnPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.35); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1.1); }
        }

        .rp-heart-beat {
          animation: rpHeartBeat 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes rpHeartBeat {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.4); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1.1); }
        }

        .rp-count {
          font-variant-numeric: tabular-nums;
          min-width: 18px;
          text-align: left;
          transition: all 0.15s;
        }
        .rp-ep-label {
          font-size: 10px;
          opacity: 0.42;
          margin-left: 1px;
          font-weight: 500;
        }

        .rp-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 10px;
          color: #525252;
          font-size: 12px;
          font-weight: 600;
          flex: 0 0 auto;
        }

        .rp-ep-toast {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: #18181b;
          border: 1px solid rgba(239,68,68,0.4);
          color: rgba(255,255,255,0.82);
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          z-index: 99999;
          white-space: nowrap;
          pointer-events: none;
          animation: rpToastIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes rpToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1); }
        }

        .rp-panel--horizontal > .rp-btn:nth-child(1),
        .rp-panel--horizontal > .rp-btn:nth-child(2),
        .rp-panel--horizontal > .rp-btn:nth-child(3) { flex: 1; }
        .rp-panel--horizontal > .rp-btn--saved,
        .rp-panel--horizontal > .rp-stat { flex: 0 0 auto; }

        @media (max-width: 768px) {
          .rp-panel { padding: 5px 6px; }
          .rp-btn   { padding: 7px 6px; font-size: 12px; }
        }
      `}</style>
    </>
  );
};

export default ReactionPanel;