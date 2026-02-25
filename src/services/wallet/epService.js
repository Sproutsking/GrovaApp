// src/services/wallet/epService.js
// ════════════════════════════════════════════════════════════════
// Engagement Points (EP) Service
// EP is the internal platform currency:
//   - Minted: on deposit (1 EP per ₦1), post likes/shares/comments/gifts
//   - Burned: on every transaction (1–10 EP depending on weight)
//   - Cannot be withdrawn externally
//   - Used in PayWave (1 EP = ₦1 internally)
//   - Swappable to XEV internally at platform rate
// ════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// EP award amounts by engagement type
export const EP_AWARDS = {
  post_like_received: 1,
  post_comment_received: 2,
  post_share_received: 3,
  post_view: 0.1,
  story_unlock: 5,
  reel_like_received: 1,
  reel_share_received: 3,
  gift_received_small: 10, // small gift
  gift_received_medium: 25, // medium gift
  gift_received_large: 50, // large gift
  follow_received: 2,
  deposit_per_ngn: 1, // 1 EP per ₦1 deposited
  daily_login: 5,
  referral: 20,
};

export const epService = {
  // ── Get EP balance ────────────────────────────────────────────
  async getBalance(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("engagement_points")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.engagement_points || 0;
  },

  // ── Get EP dashboard (daily/weekly/monthly stats) ─────────────
  async getDashboard(userId) {
    const { data, error } = await supabase
      .from("ep_dashboard")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Award EP for engagement (called by interaction services) ──
  async awardForEngagement(userId, engagementType, metadata = {}) {
    const epAmount = EP_AWARDS[engagementType];
    if (!epAmount || epAmount <= 0) return null;

    const { data, error } = await supabase.rpc("credit_ep", {
      p_user_id: userId,
      p_amount: epAmount,
      p_reason: engagementType,
      p_metadata: metadata,
    });

    if (error) {
      console.error("EP award error:", error);
      return null;
    }

    return { awarded: epAmount, total: data };
  },

  // ── Award EP for post likes ───────────────────────────────────
  async awardForLike(contentOwnerId, contentType = "post") {
    return this.awardForEngagement(
      contentOwnerId,
      `${contentType}_like_received`,
    );
  },

  // ── Award EP for comments ─────────────────────────────────────
  async awardForComment(contentOwnerId, contentType = "post") {
    return this.awardForEngagement(
      contentOwnerId,
      `${contentType}_comment_received`,
    );
  },

  // ── Award EP for shares ───────────────────────────────────────
  async awardForShare(contentOwnerId, contentType = "post") {
    return this.awardForEngagement(
      contentOwnerId,
      `${contentType}_share_received`,
    );
  },

  // ── Award EP for story unlock ─────────────────────────────────
  async awardForStoryUnlock(storyOwnerId) {
    return this.awardForEngagement(storyOwnerId, "story_unlock");
  },

  // ── Award EP for gifts ────────────────────────────────────────
  async awardForGift(recipientId, giftTier = "small") {
    return this.awardForEngagement(recipientId, `gift_received_${giftTier}`);
  },

  // ── Mint EP on deposit ────────────────────────────────────────
  async mintOnDeposit(userId, ngnAmount) {
    const epToMint = Math.floor(ngnAmount * EP_AWARDS.deposit_per_ngn);
    if (epToMint <= 0) return null;

    const { data, error } = await supabase.rpc("credit_ep", {
      p_user_id: userId,
      p_amount: epToMint,
      p_reason: "deposit_mint",
      p_metadata: { ngn_amount: ngnAmount },
    });

    if (error) throw error;
    return { minted: epToMint, total: data };
  },

  // ── Burn EP for transaction ───────────────────────────────────
  async burnForTransaction(userId, burnAmount, reason = "transaction") {
    const { data, error } = await supabase.rpc("burn_ep", {
      p_user_id: userId,
      p_amount: burnAmount,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // ── Get EP transaction history ────────────────────────────────
  async getHistory(userId, limit = 30) {
    const { data, error } = await supabase
      .from("ep_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ── Subscribe to EP changes (real-time) ───────────────────────
  subscribeToEP(userId, callback) {
    const channel = supabase
      .channel(`ep:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ep_transactions",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const ep = await this.getBalance(userId);
          callback(ep);
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

export default epService;
