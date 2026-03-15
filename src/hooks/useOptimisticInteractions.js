// =============================================================================
// src/hooks/useOptimisticInteractions.js
// =============================================================================
// Single hook that drives ALL optimistic interactions: like, comment, share,
// save, view. Used by ReactionPanel and any component that needs interaction
// state.
//
// Design principles (Meta / X / Instagram model):
//   - Instant UI response (apply before network call)
//   - Rollback on failure with user-visible error
//   - Server reconciliation: sync real counts when fresh data arrives
//   - EP deduction happens optimistically then verified server-side
//   - No duplicate inflight requests (idempotent guard)
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../services/config/supabase";
import optimisticStore from "../stores/optimisticStore";
import LikeModel from "../models/LikeModel";

const EP_COSTS = {
  like: 2,
  comment: 4,
  share: 10,
  comment_like: 0.5,
  reply: 2,
};

// ── EP helpers ────────────────────────────────────────────────────────────────
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
    /* silent — awards are best-effort */
  }
}

// ── Session-scoped view deduplication (never count own, once per session) ─────
const viewedThisSession = new Set();

function trackView(contentType, contentId, userId, onViewCounted) {
  const key = `${contentType}:${contentId}`;
  if (viewedThisSession.has(key)) return null;

  const timer = setTimeout(async () => {
    if (viewedThisSession.has(key)) return;
    viewedThisSession.add(key);
    try {
      const tableMap = { post: "posts", reel: "reels", story: "stories" };
      const table = tableMap[contentType];
      if (!table) return;

      const { data: row } = await supabase
        .from(table)
        .select("views, user_id")
        .eq("id", contentId)
        .single();

      if (!row || row.user_id === userId) return; // never own views

      await supabase
        .from(table)
        .update({ views: (row.views || 0) + 1 })
        .eq("id", contentId);

      if (onViewCounted) onViewCounted((row.views || 0) + 1);
    } catch {
      /* silent */
    }
  }, 3000); // 3s dwell = intentional view

  return () => clearTimeout(timer);
}

// ── Main Hook ─────────────────────────────────────────────────────────────────
export function useOptimisticInteractions(content, currentUser) {
  const contentType = content?.type || "post";
  const contentId = content?.id;
  const userId = currentUser?.id;

  // ── Local state — optimistic values ───────────────────────────────────────
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(content?.likes || 0);
  const [commentCount, setCommentCount] = useState(
    content?.comments_count || 0,
  );
  const [shareCount, setShareCount] = useState(content?.shares || 0);
  const [viewCount, setViewCount] = useState(content?.views || 0);
  const [saved, setSaved] = useState(false);
  const [epError, setEpError] = useState(null);
  const [isLiking, setIsLiking] = useState(false);

  const epErrTimer = useRef(null);
  const viewCleanup = useRef(null);
  const mountedRef = useRef(true);

  const showEpError = useCallback((msg) => {
    setEpError(msg);
    clearTimeout(epErrTimer.current);
    epErrTimer.current = setTimeout(() => {
      if (mountedRef.current) setEpError(null);
    }, 3000);
  }, []);

  // ── Mount: load like/save state + start view timer ─────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (!userId || !contentId) return;

    // Check optimistic store first (instant, no network)
    const cachedLike = optimisticStore.getLikeState(
      contentType,
      contentId,
      userId,
    );

    if (cachedLike !== null) {
      setLiked(cachedLike);
    } else {
      // Fetch from DB in background
      LikeModel.checkIfLiked(contentType, contentId, userId)
        .then((v) => {
          if (!mountedRef.current) return;
          optimisticStore.setLikeState(contentType, contentId, userId, v);
          setLiked(v);
        })
        .catch(() => {});
    }

    // Check saved state
    checkSavedState(contentType, contentId, userId)
      .then((v) => {
        if (mountedRef.current) setSaved(v);
      })
      .catch(() => {});

    // Start view tracking (3s dwell, deduped per session)
    viewCleanup.current = trackView(
      contentType,
      contentId,
      userId,
      (newCount) => {
        if (mountedRef.current) setViewCount(newCount);
      },
    );

    return () => {
      mountedRef.current = false;
      if (viewCleanup.current) viewCleanup.current();
    };
  }, [contentId, contentType, userId]);

  // ── Sync counts when parent re-renders with fresh DB data ──────────────────
  useEffect(() => {
    setLikeCount(content?.likes ?? 0);
  }, [content?.likes]);

  useEffect(() => {
    setCommentCount(content?.comments_count ?? 0);
  }, [content?.comments_count]);

  useEffect(() => {
    setShareCount(content?.shares ?? 0);
  }, [content?.shares]);

  useEffect(() => {
    setViewCount(content?.views ?? 0);
  }, [content?.views]);

  // ── LIKE — fully optimistic with EP guard ──────────────────────────────────
  const handleLike = useCallback(async () => {
    if (!userId || isLiking) return;

    const inflightKey = `like:${contentType}:${contentId}:${userId}`;
    if (optimisticStore.isInflight(inflightKey)) return;

    setIsLiking(true);
    optimisticStore.setInflight(inflightKey);

    if (liked) {
      // UNLIKE — instant, free, no EP
      const prevCount = likeCount;
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      optimisticStore.setLikeState(contentType, contentId, userId, false);

      try {
        await LikeModel.toggleLike(contentType, contentId, userId);
      } catch {
        // Rollback
        setLiked(true);
        setLikeCount(prevCount);
        optimisticStore.setLikeState(contentType, contentId, userId, true);
      } finally {
        setIsLiking(false);
        optimisticStore.clearInflight(inflightKey);
      }
      return;
    }

    // LIKE — check EP balance
    const balance = await optimisticStore.getEPBalance(userId, supabase);
    if (balance < EP_COSTS.like) {
      showEpError(`Need ${EP_COSTS.like} EP to like`);
      setIsLiking(false);
      optimisticStore.clearInflight(inflightKey);
      return;
    }

    // Apply optimistically
    const prevCount = likeCount;
    setLiked(true);
    setLikeCount((c) => c + 1);
    optimisticStore.setLikeState(contentType, contentId, userId, true);
    optimisticStore.adjustEPBalance(-EP_COSTS.like);

    try {
      const epOk = await deductEP(userId, EP_COSTS.like, `like_${contentType}`);
      if (!epOk) {
        // EP deduction failed — rollback
        setLiked(false);
        setLikeCount(prevCount);
        optimisticStore.setLikeState(contentType, contentId, userId, false);
        optimisticStore.invalidateEPCache();
        showEpError(`Need ${EP_COSTS.like} EP to like`);
        return;
      }

      // Award creator EP (fire-and-forget)
      if (content?.user_id && content.user_id !== userId) {
        const fee = content?.profiles?.is_pro ? 0.08 : 0.18;
        awardEP(content.user_id, EP_COSTS.like * (1 - fee), "received_like");
      }

      await LikeModel.toggleLike(contentType, contentId, userId);
    } catch {
      // Network failure — rollback
      setLiked(false);
      setLikeCount(prevCount);
      optimisticStore.setLikeState(contentType, contentId, userId, false);
      optimisticStore.invalidateEPCache();
      showEpError("Failed to like. Please try again.");
    } finally {
      setIsLiking(false);
      optimisticStore.clearInflight(inflightKey);
    }
  }, [
    userId,
    isLiking,
    liked,
    likeCount,
    contentType,
    contentId,
    content,
    showEpError,
  ]);

  // ── COMMENT COUNT UPDATE — called by CommentModal after successful post ─────
  const onCommentPosted = useCallback((delta = 1) => {
    setCommentCount((c) => Math.max(0, c + delta));
  }, []);

  // ── SHARE — optimistic count bump ─────────────────────────────────────────
  const onShareRecorded = useCallback(() => {
    setShareCount((c) => c + 1);
  }, []);

  const onShareFailed = useCallback(() => {
    setShareCount((c) => Math.max(0, c - 1));
  }, []);

  // ── SAVE ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!userId) return;

    if (saved) {
      setSaved(false);
      try {
        await unsaveContent(contentType, contentId, userId);
      } catch {
        setSaved(true);
      }
      return false; // signal: was saved, now unsaved
    }
    return true; // signal: open save folder modal
  }, [userId, saved, contentType, contentId]);

  const onSaveConfirmed = useCallback(() => {
    setSaved(true);
  }, []);

  return {
    // State
    liked,
    likeCount,
    commentCount,
    shareCount,
    viewCount,
    saved,
    epError,
    isLiking,
    // Actions
    handleLike,
    onCommentPosted,
    onShareRecorded,
    onShareFailed,
    handleSave,
    onSaveConfirmed,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

async function unsaveContent(contentType, contentId, userId) {
  const { error } = await supabase
    .from("saved_content")
    .delete()
    .eq("user_id", userId)
    .eq("content_type", contentType)
    .eq("content_id", contentId);
  if (error) throw error;
}

export { EP_COSTS };
export default useOptimisticInteractions;
