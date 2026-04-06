// src/services/wallet/epService.js
// ════════════════════════════════════════════════════════════════
// Engagement Points (EP) Service — COMPLETE IMPLEMENTATION
//
// EP IS THE INTERNAL ECONOMY CURRENCY:
//   - EP is minted on deposit (1 EP per ₦1) and on engagement
//   - EP is burned on every send transaction (burn table)
//   - EP is transferred on social actions (3-way split):
//       Liker  → pays EP cost
//       Author → receives EP reward
//       Platform wallet → receives protocol fee
//   - EP cannot be withdrawn externally
//   - EP is used in PayWave (1 EP = ₦1 internally)
//   - EP is swappable to $XEV at platform rate
//
// SOCIAL ACTION FLOW (ATOMIC via RPC):
//   User A likes User B's post →
//     debit  User A:        1 EP  (cost to engage)
//     credit User B:        1 EP  (content reward)
//     credit Platform:      0.1 EP (protocol fee — 10%)
//   All three happen in ONE database transaction.
//   If User A has < 1.1 EP the action is blocked.
//
// PLATFORM WALLET:
//   Set PLATFORM_WALLET_USER_ID to your platform's admin/treasury
//   user UUID in platform_settings or as an env constant below.
//   The wallet must exist in the `wallets` table.
// ════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// ── Platform treasury wallet user ID ─────────────────────────────
// This is the UUID of your platform's treasury profile in `profiles`.
// Set this to your actual platform admin UUID.
// You can also fetch it dynamically from platform_settings:
//   SELECT value->>'platform_wallet_user_id' FROM platform_settings WHERE key = 'treasury'
const PLATFORM_WALLET_USER_ID =
  process.env.REACT_APP_PLATFORM_WALLET_USER_ID ||
  "00000000-0000-0000-0000-000000000001"; // replace with real UUID

// ── Protocol fee rate (10% of EP transferred) ────────────────────
const PROTOCOL_FEE_RATE = 0.1;

// ── EP award amounts by engagement type ──────────────────────────
// These are what the CONTENT OWNER receives.
// The LIKER/COMMENTER/SHARER pays this amount + protocol fee.
export const EP_AWARDS = {
  post_like_received:        1,
  post_comment_received:     2,
  post_share_received:       3,
  post_view:                 0.1,
  story_unlock:              5,
  reel_like_received:        1,
  reel_comment_received:     2,
  reel_share_received:       3,
  gift_received_small:       10,
  gift_received_medium:      25,
  gift_received_large:       50,
  follow_received:           2,
  deposit_per_ngn:           1,   // 1 EP per ₦1 deposited
  daily_login:               5,
  referral:                  20,
};

// ── EP burn table (for XEV sends — NOT social actions) ───────────
// Social actions have their own fixed protocol fee (10%).
// This burn table applies only to wallet send operations.
export const EP_BURN_TABLE = [
  { max: 100,   burn: 0.5 },
  { max: 500,   burn: 2   },
  { max: 2000,  burn: 5   },
  { max: Infinity, burn: 10 },
];

export function computeEPBurn(epAmount) {
  const a = parseFloat(epAmount) || 0;
  for (const row of EP_BURN_TABLE) {
    if (a < row.max) return row.burn;
  }
  return 10;
}

// ─────────────────────────────────────────────────────────────────
// CORE: 3-WAY EP TRANSFER (social action economics)
// Calls the `transfer_ep_with_fee` Postgres RPC which does this
// ATOMICALLY in a single transaction:
//   1. Debit fromUserId  (engagement cost + protocol fee)
//   2. Credit toUserId   (content reward)
//   3. Credit platform   (protocol fee)
//   4. Write wallet_history for all three parties
//   5. Write ep_transactions for both users
// ─────────────────────────────────────────────────────────────────
async function _transferEPWithFee({
  fromUserId,
  toUserId,
  epAmount,
  reason,
  metadata = {},
}) {
  if (!fromUserId || !toUserId) return { success: false, error: "Missing user IDs" };
  if (fromUserId === toUserId) return { success: false, error: "Cannot transfer to self" };

  const fee = parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));

  const { data, error } = await supabase.rpc("transfer_ep_with_fee", {
    p_from_user_id:      fromUserId,
    p_to_user_id:        toUserId,
    p_platform_user_id:  PLATFORM_WALLET_USER_ID,
    p_amount:            epAmount,
    p_fee:               fee,
    p_reason:            reason,
    p_metadata:          JSON.stringify(metadata),
  });

  if (error) {
    console.error("[epService] transfer_ep_with_fee error:", error);
    return { success: false, error: error.message };
  }

  return data || { success: true, fee };
}

// ─────────────────────────────────────────────────────────────────
export const epService = {

  // ── Get EP balance ───────────────────────────────────────────────
  async getBalance(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("engagement_points")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.engagement_points || 0;
  },

  // ── Get EP dashboard ─────────────────────────────────────────────
  async getDashboard(userId) {
    const { data, error } = await supabase
      .from("ep_dashboard")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Get EP transaction history ───────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────
  // SOCIAL ACTION TRANSFERS
  // Each method debits the ACTOR and credits the CONTENT OWNER.
  // The platform fee is collected automatically inside the RPC.
  // fromUserId = the person performing the action (liker, commenter…)
  // contentOwnerId = the person who created the content
  // ─────────────────────────────────────────────────────────────────

  // ── Like ─────────────────────────────────────────────────────────
  async awardForLike(fromUserId, contentOwnerId, contentType = "post", contentId = null) {
    const epAmount = EP_AWARDS[`${contentType}_like_received`] ?? 1;
    return _transferEPWithFee({
      fromUserId,
      toUserId: contentOwnerId,
      epAmount,
      reason: `${contentType}_like`,
      metadata: { content_type: contentType, content_id: contentId, action: "like" },
    });
  },

  // ── Comment ──────────────────────────────────────────────────────
  async awardForComment(fromUserId, contentOwnerId, contentType = "post", contentId = null) {
    const epAmount = EP_AWARDS[`${contentType}_comment_received`] ?? 2;
    return _transferEPWithFee({
      fromUserId,
      toUserId: contentOwnerId,
      epAmount,
      reason: `${contentType}_comment`,
      metadata: { content_type: contentType, content_id: contentId, action: "comment" },
    });
  },

  // ── Share ────────────────────────────────────────────────────────
  async awardForShare(fromUserId, contentOwnerId, contentType = "post", contentId = null) {
    const epAmount = EP_AWARDS[`${contentType}_share_received`] ?? 3;
    return _transferEPWithFee({
      fromUserId,
      toUserId: contentOwnerId,
      epAmount,
      reason: `${contentType}_share`,
      metadata: { content_type: contentType, content_id: contentId, action: "share" },
    });
  },

  // ── Story unlock ─────────────────────────────────────────────────
  // The unlocker pays; the story author receives minus platform fee.
  async awardForStoryUnlock(fromUserId, storyOwnerId, storyId = null, unlockCost = null) {
    const epAmount = unlockCost ?? EP_AWARDS.story_unlock;
    return _transferEPWithFee({
      fromUserId,
      toUserId: storyOwnerId,
      epAmount,
      reason: "story_unlock",
      metadata: { story_id: storyId, action: "unlock" },
    });
  },

  // ── Gift (one-directional — no debit from sender here,
  //    gifts are funded separately via XEV purchase flow)
  //    This just credits the recipient EP after gift purchase.
  async awardForGift(recipientId, giftTier = "small", senderId = null) {
    const epAmount = EP_AWARDS[`gift_received_${giftTier}`] ?? 10;
    // Gifts credit the recipient only — the cost is already
    // handled by the XEV purchase; we do a direct credit here.
    return this._directCreditEP(recipientId, epAmount, `gift_received_${giftTier}`, {
      sender_id: senderId,
      gift_tier: giftTier,
    });
  },

  // ── Follow ───────────────────────────────────────────────────────
  // Follow is free for the follower — the platform grants EP to
  // the followed user (platform-funded, not user-funded).
  async awardForFollow(followedUserId, followerId = null) {
    const epAmount = EP_AWARDS.follow_received;
    return this._directCreditEP(followedUserId, epAmount, "follow_received", {
      follower_id: followerId,
    });
  },

  // ── Daily login ──────────────────────────────────────────────────
  // Platform-funded. Direct credit from platform treasury.
  async awardDailyLogin(userId) {
    return this._directCreditEP(userId, EP_AWARDS.daily_login, "daily_login", {});
  },

  // ── Referral bonus ───────────────────────────────────────────────
  async awardReferral(userId, referredUserId = null) {
    return this._directCreditEP(userId, EP_AWARDS.referral, "referral", {
      referred_user_id: referredUserId,
    });
  },

  // ── Mint EP on NGN deposit ────────────────────────────────────────
  // 1 EP per ₦1 deposited. Platform-funded credit.
  async mintOnDeposit(userId, ngnAmount) {
    const epToMint = Math.floor(ngnAmount * EP_AWARDS.deposit_per_ngn);
    if (epToMint <= 0) return null;
    return this._directCreditEP(userId, epToMint, "deposit_mint", {
      ngn_amount: ngnAmount,
    });
  },

  // ── Burn EP for wallet send transaction ───────────────────────────
  // Called by walletService when sending XEV or EP.
  // Burns go to the platform treasury wallet.
  async burnForTransaction(userId, burnAmount, reason = "tx_burn") {
    if (burnAmount <= 0) return { success: true, burned: 0 };

    const { data, error } = await supabase.rpc("burn_ep", {
      p_user_id:          userId,
      p_amount:           burnAmount,
      p_platform_user_id: PLATFORM_WALLET_USER_ID,
      p_reason:           reason,
    });

    if (error) {
      console.error("[epService] burn_ep error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, burned: burnAmount, data };
  },

  // ─────────────────────────────────────────────────────────────────
  // INTERNAL: Direct credit (platform-funded, no sender debit)
  // Used for follows, logins, referrals, gifts
  // ─────────────────────────────────────────────────────────────────
  async _directCreditEP(userId, epAmount, reason, metadata = {}) {
    const { data, error } = await supabase.rpc("credit_ep", {
      p_user_id: userId,
      p_amount:  epAmount,
      p_reason:  reason,
      p_metadata: JSON.stringify(metadata),
    });

    if (error) {
      console.error("[epService] credit_ep error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, awarded: epAmount, total: data };
  },

  // ── Check if user can afford a social action ──────────────────────
  // Returns { canAfford: bool, required: number, available: number }
  async checkCanAfford(userId, epAmount) {
    const fee = parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));
    const required = epAmount + fee;
    const available = await this.getBalance(userId);
    return {
      canAfford: available >= required,
      required,
      available,
      fee,
    };
  },

  // ── Real-time EP subscription ─────────────────────────────────────
  subscribeToEP(userId, callback) {
    const channel = supabase
      .channel(`ep:${userId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new?.engagement_points !== undefined) {
            callback(payload.new.engagement_points);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  // ── Protocol fee rate accessor ────────────────────────────────────
  getProtocolFeeRate() {
    return PROTOCOL_FEE_RATE;
  },

  getProtocolFee(epAmount) {
    return parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));
  },
};

export default epService;