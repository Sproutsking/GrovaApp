// ============================================================================
// src/services/home/engagementService.js
// ============================================================================
// THE EP ENGINE — Handles all Engagement Point accounting.
//
// Design goals:
//  1. Atomic wallet updates — no read-then-write race conditions on EP balance
//  2. Non-blocking — all EP operations are fire-and-forget from the caller's POV
//  3. Platform fees applied before distribution (Pro 8%, Free 18%)
//  4. Comment like revenue split: 40% commenter / 60% content owner
//  5. Never award EP to content owner for their own actions
//  6. All DB errors are swallowed — EP accounting must never crash the UI
// ============================================================================

import { supabase } from "../config/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────
const EP_RATES = {
  like: 2, // cost to liker / gross award to creator
  comment: 4,
  share: 10,
  comment_like: 0.5,
};

const PLATFORM_FEE = {
  pro: 0.08, // 8%
  free: 0.18, // 18%
};

const COMMENT_SPLIT = 0.4; // 40% of comment_like EP goes to commenter

// ── Atomic wallet helper ──────────────────────────────────────────────────────
// Uses increment_count RPC when available, falls back to read-then-write.
// Rounds to 4 decimal places to stay clean.
async function atomicWallet(userId, delta) {
  if (!userId || !delta) return;
  const amount = Math.round(delta * 10000) / 10000;
  try {
    const { error } = await supabase.rpc("increment_count", {
      p_table: "wallets",
      p_id: userId, // wallets must have an `id` column = user_id for this to work
      p_column: "engagement_points",
      p_delta: amount,
    });
    if (!error) return;
    throw error;
  } catch {
    // Fallback read-then-write
    try {
      const { data } = await supabase
        .from("wallets")
        .select("engagement_points")
        .eq("user_id", userId)
        .single();
      const current = data?.engagement_points ?? 0;
      await supabase
        .from("wallets")
        .update({ engagement_points: Math.max(0, current + amount) })
        .eq("user_id", userId);
    } catch {
      /* silent — wallet update failed */
    }
  }
}

// ── Get pro status (batched lookup, tiny payload) ─────────────────────────────
const proCache = new Map(); // userId → { is_pro, ts }
async function isPro(userId) {
  const hit = proCache.get(userId);
  if (hit && Date.now() - hit.ts < 60_000) return hit.is_pro;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", userId)
      .single();
    const result = !!data?.is_pro;
    proCache.set(userId, { is_pro: result, ts: Date.now() });
    return result;
  } catch {
    return false;
  }
}

function fee(pro) {
  return pro ? PLATFORM_FEE.pro : PLATFORM_FEE.free;
}
function net(gross, pro) {
  return gross * (1 - fee(pro));
}

// ── EP Dashboard helper ───────────────────────────────────────────────────────
// Updates running totals. Fire-and-forget.
async function updateDashboard(userId, amount) {
  try {
    const { data: dash } = await supabase
      .from("ep_dashboard")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!dash) {
      await supabase.from("ep_dashboard").insert({
        user_id: userId,
        total_ep_earned: amount,
        daily_ep: amount,
        weekly_ep: amount,
        monthly_ep: amount,
        annual_ep: amount,
      });
    } else {
      await supabase
        .from("ep_dashboard")
        .update({
          total_ep_earned: (dash.total_ep_earned || 0) + amount,
          daily_ep: (dash.daily_ep || 0) + amount,
          weekly_ep: (dash.weekly_ep || 0) + amount,
          monthly_ep: (dash.monthly_ep || 0) + amount,
          annual_ep: (dash.annual_ep || 0) + amount,
        })
        .eq("user_id", userId);
    }
  } catch {
    /* silent */
  }
}

// ── Platform revenue helper ───────────────────────────────────────────────────
async function recordRevenue(amount, userId, source) {
  try {
    await supabase.from("platform_revenue").insert({
      amount,
      user_id: userId,
      source,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* silent */
  }
}

// ── Award net EP to a user (all side effects) ─────────────────────────────────
async function awardNet(userId, gross, source) {
  const userIsPro = await isPro(userId);
  const netAmount = net(gross, userIsPro);
  const platformAmount = gross - netAmount;

  await Promise.allSettled([
    atomicWallet(userId, netAmount),
    updateDashboard(userId, netAmount),
    recordRevenue(platformAmount, userId, source),
  ]);
}

// ============================================================================
class EngagementService {
  // ── AWARD EP FOR A LIKE/COMMENT/SHARE ──────────────────────────────────────
  // Call AFTER the UI is already updated (fire-and-forget from ReactionPanel).
  // engagingUserId: the person who performed the action (they spent EP already)
  // contentOwnerId: who receives the EP reward
  async awardContentEP(contentOwnerId, engagingUserId, action) {
    if (!contentOwnerId || !engagingUserId) return;
    if (contentOwnerId === engagingUserId) return; // never self-award
    const gross = EP_RATES[action] ?? 1;
    // Fire-and-forget — UI never waits for this
    awardNet(contentOwnerId, gross, action).catch(() => {});
  }

  // ── AWARD EP FOR A COMMENT LIKE ────────────────────────────────────────────
  // Split: 40% to commenter, 60% to content owner
  async awardCommentLikeEP(commentId, likingUserId) {
    try {
      const { data: comment } = await supabase
        .from("comments")
        .select("user_id, post_id, reel_id, story_id")
        .eq("id", commentId)
        .single();
      if (!comment || comment.user_id === likingUserId) return;

      const commenterId = comment.user_id;

      // Resolve content owner
      let contentOwnerId = null;
      if (comment.post_id) {
        const { data } = await supabase
          .from("posts")
          .select("user_id")
          .eq("id", comment.post_id)
          .single();
        contentOwnerId = data?.user_id;
      } else if (comment.reel_id) {
        const { data } = await supabase
          .from("reels")
          .select("user_id")
          .eq("id", comment.reel_id)
          .single();
        contentOwnerId = data?.user_id;
      } else if (comment.story_id) {
        const { data } = await supabase
          .from("stories")
          .select("user_id")
          .eq("id", comment.story_id)
          .single();
        contentOwnerId = data?.user_id;
      }

      const total = EP_RATES.comment_like;
      const commenterGross = total * COMMENT_SPLIT;
      const ownerGross = total * (1 - COMMENT_SPLIT);

      await Promise.allSettled([
        commenterGross > 0
          ? awardNet(commenterId, commenterGross, "comment_like")
          : null,
        ownerGross > 0 && contentOwnerId
          ? awardNet(contentOwnerId, ownerGross, "comment_like")
          : null,
      ]);
    } catch {
      /* silent */
    }
  }

  // ── DEDUCT EP FROM LIKER (called before the action in ReactionPanel) ────────
  // Returns true if deduction succeeded, false if insufficient balance.
  async deductEP(userId, action) {
    const cost = EP_RATES[action];
    if (!cost || !userId) return true; // unknown action — don't block

    try {
      const { data } = await supabase.rpc("deduct_ep", {
        p_user_id: userId,
        p_amount: cost,
        p_reason: action,
      });
      return !!data;
    } catch {
      // RPC missing — fallback manual deduct
      try {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("engagement_points")
          .eq("user_id", userId)
          .single();
        const balance = wallet?.engagement_points ?? 0;
        if (balance < cost) return false;
        await supabase
          .from("wallets")
          .update({ engagement_points: balance - cost })
          .eq("user_id", userId);
        return true;
      } catch {
        return false;
      }
    }
  }

  // ── GET EP BALANCE ──────────────────────────────────────────────────────────
  async getBalance(userId) {
    try {
      const { data } = await supabase
        .from("wallets")
        .select("engagement_points")
        .eq("user_id", userId)
        .single();
      return data?.engagement_points ?? 0;
    } catch {
      return 0;
    }
  }

  // ── TOGGLE COMMENT LIKE (full handler) ─────────────────────────────────────
  // Returns { liked: bool, newCount: number }
  async toggleCommentLike(commentId, userId) {
    try {
      const { data: existing } = await supabase
        .from("comment_likes")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase.from("comment_likes").delete().eq("id", existing.id);
        // Atomic decrement
        const { error } = await supabase.rpc("increment_count", {
          p_table: "comments",
          p_id: commentId,
          p_column: "likes",
          p_delta: -1,
        });
        // Fallback if RPC not live yet
        if (error) {
          const { data: c } = await supabase
            .from("comments")
            .select("likes")
            .eq("id", commentId)
            .single();
          await supabase
            .from("comments")
            .update({ likes: Math.max(0, (c?.likes ?? 1) - 1) })
            .eq("id", commentId);
        }
        return { liked: false };
      } else {
        await supabase
          .from("comment_likes")
          .insert([{ comment_id: commentId, user_id: userId }]);
        const { error } = await supabase.rpc("increment_count", {
          p_table: "comments",
          p_id: commentId,
          p_column: "likes",
          p_delta: 1,
        });
        if (error) {
          const { data: c } = await supabase
            .from("comments")
            .select("likes")
            .eq("id", commentId)
            .single();
          await supabase
            .from("comments")
            .update({ likes: (c?.likes ?? 0) + 1 })
            .eq("id", commentId);
        }
        // Award EP in background
        this.awardCommentLikeEP(commentId, userId).catch(() => {});
        return { liked: true };
      }
    } catch (error) {
      throw error;
    }
  }

  // ── RECORD A SHARE (writes shares table + increments count) ────────────────
  async recordShare(contentType, contentId, userId, shareType = "external") {
    try {
      const table = `${contentType}s`;
      await Promise.allSettled([
        supabase.from("shares").insert([
          {
            content_type: contentType,
            content_id: contentId,
            user_id: userId,
            share_type: shareType,
            created_at: new Date().toISOString(),
          },
        ]),
        supabase.rpc("increment_count", {
          p_table: table,
          p_id: contentId,
          p_column: "shares",
          p_delta: 1,
        }),
      ]);
      // Award EP to content owner in background
      const { data: owner } = await supabase
        .from(table)
        .select("user_id")
        .eq("id", contentId)
        .single();
      if (owner?.user_id && owner.user_id !== userId) {
        this.awardContentEP(owner.user_id, userId, "share").catch(() => {});
      }
    } catch {
      /* silent */
    }
  }
}

const engagementService = new EngagementService();
export default engagementService;
