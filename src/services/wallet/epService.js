// src/services/wallet/epService.js
// ════════════════════════════════════════════════════════════════
// Engagement Points (EP) Service — COMPLETE IMPLEMENTATION
//
// CANONICAL EXCHANGE RATES:
//   1 USD  = 100 EP
//   1 $XEV = 10 EP
//   1 $XEV = $0.10 USD
//
// EP IS THE INTERNAL ECONOMY CURRENCY:
//   - EP is minted on NGN deposit  (1 EP per ₦1)
//   - EP is minted on USD deposit  (100 EP per $1)
//   - EP is minted on XEV purchase (10 EP per 1 XEV)
//   - EP is burned on every send transaction (burn table)
//   - EP is transferred on social actions (3-way split):
//       Actor  → pays EP cost
//       Author → receives EP reward
//       Platform wallet → receives protocol fee (10%)
//   - EP cannot be withdrawn externally
//   - EP is used in PayWave (1 EP = ₦1 internally)
//   - EP is swappable to $XEV at platform rate (10 EP = 1 XEV)
//
// SOCIAL ACTION FLOW (ATOMIC via RPC):
//   User A likes User B's post →
//     debit  User A:        1 EP  (cost to engage)
//     credit User B:        1 EP  (content reward)
//     credit Platform:      0.1 EP (protocol fee — 10%)
//   All three happen in ONE database transaction.
//   If User A has < 1.1 EP the action is blocked.
// ════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import { EP_PER_USD, EP_PER_XEV, USD_PER_XEV } from "../../models/WalletModel";

// ── Platform treasury wallet user ID ─────────────────────────────
const PLATFORM_WALLET_USER_ID =
  process.env.REACT_APP_PLATFORM_WALLET_USER_ID ||
  "00000000-0000-0000-0000-000000000001";

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
  // ── Deposit minting rates (CORRECTED) ──────────────────────────
  // 1 USD  = 100 EP  →  per-unit rates:
  deposit_per_ngn:           1,    // 1 EP per ₦1   (NGN peg: 1 EP = ₦1)
  deposit_per_usd:           EP_PER_USD,   // 100 EP per $1
  deposit_per_xev:           EP_PER_XEV,   // 10 EP per 1 XEV
  // ── Platform-funded ────────────────────────────────────────────
  daily_login:               5,
  referral:                  20,
};

// ── EP burn table for wallet SEND operations ─────────────────────
// Denominated in XEV amount being sent.
// Social actions use a flat 10% protocol fee instead.
export const EP_BURN_TABLE = [
  { maxXev: 1,        burn: 0.5 },
  { maxXev: 5,        burn: 2   },
  { maxXev: 20,       burn: 5   },
  { maxXev: Infinity, burn: 10  },
];

/**
 * Compute EP burn for a XEV send.
 * @param {number} xevAmount - Amount being sent in XEV
 * @returns {number} EP to burn
 */
export function computeEPBurn(xevAmount) {
  const x = parseFloat(xevAmount) || 0;
  for (const row of EP_BURN_TABLE) {
    if (x < row.maxXev) return row.burn;
  }
  return 10;
}

// ── Swap rate ─────────────────────────────────────────────────────
/**
 * EP ↔ XEV swap at canonical rate.
 * @param {"ep_to_xev"|"xev_to_ep"} direction
 * @param {number} amount
 * @returns {number}
 */
export function computeSwapAmount(direction, amount) {
  const a = parseFloat(amount) || 0;
  if (direction === "ep_to_xev") return a / EP_PER_XEV;  // 10 EP → 1 XEV
  if (direction === "xev_to_ep") return a * EP_PER_XEV;  // 1 XEV → 10 EP
  return 0;
}

// ── EP mint amounts for deposits ──────────────────────────────────
/**
 * How many EP to mint for a deposit.
 * @param {"NGN"|"USD"|"USDT"|"XEV"} currency
 * @param {number} amount
 * @returns {number}
 */
export function computeEPMint(currency, amount) {
  const a = parseFloat(amount) || 0;
  switch (currency) {
    case "NGN":  return Math.floor(a * EP_AWARDS.deposit_per_ngn);  // 1 EP/₦1
    case "USD":
    case "USDT": return Math.floor(a * EP_AWARDS.deposit_per_usd);  // 100 EP/$1
    case "XEV":  return Math.floor(a * EP_AWARDS.deposit_per_xev);  // 10 EP/XEV
    default:     return 0;
  }
}

// ── USD display value of EP ───────────────────────────────────────
export function epToUsd(ep)  { return parseFloat(ep) / EP_PER_USD; }
export function epToXev(ep)  { return parseFloat(ep) / EP_PER_XEV; }
export function xevToUsd(xev){ return parseFloat(xev) * USD_PER_XEV; }

// ─────────────────────────────────────────────────────────────────
// CORE: 3-WAY EP TRANSFER (social action economics)
// ─────────────────────────────────────────────────────────────────
async function _transferEPWithFee({
  fromUserId,
  toUserId,
  epAmount,
  reason,
  metadata = {},
}) {
  if (!fromUserId || !toUserId) return { success: false, error: "Missing user IDs" };
  if (fromUserId === toUserId)  return { success: false, error: "Cannot transfer to self" };

  const fee = parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));

  const { data, error } = await supabase.rpc("transfer_ep_with_fee", {
    p_from_user_id:     fromUserId,
    p_to_user_id:       toUserId,
    p_platform_user_id: PLATFORM_WALLET_USER_ID,
    p_amount:           epAmount,
    p_fee:              fee,
    p_reason:           reason,
    p_metadata:         JSON.stringify(metadata),
  });

  if (error) {
    console.error("[epService] transfer_ep_with_fee error:", error);
    return { success: false, error: error.message };
  }

  return data || { success: true, fee };
}

// ─────────────────────────────────────────────────────────────────
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

  // ── Get EP dashboard ──────────────────────────────────────────
  async getDashboard(userId) {
    const { data, error } = await supabase
      .from("ep_dashboard")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
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

  // ─────────────────────────────────────────────────────────────
  // SOCIAL ACTION TRANSFERS
  // ─────────────────────────────────────────────────────────────

  async awardForLike(fromUserId, contentOwnerId, contentType = "post", contentId = null) {
    const epAmount = EP_AWARDS[`${contentType}_like_received`] ?? 1;
    return _transferEPWithFee({
      fromUserId, toUserId: contentOwnerId, epAmount,
      reason: `${contentType}_like`,
      metadata: { content_type: contentType, content_id: contentId, action: "like" },
    });
  },

  async awardForComment(fromUserId, contentOwnerId, contentType = "post", contentId = null) {
    const epAmount = EP_AWARDS[`${contentType}_comment_received`] ?? 2;
    return _transferEPWithFee({
      fromUserId, toUserId: contentOwnerId, epAmount,
      reason: `${contentType}_comment`,
      metadata: { content_type: contentType, content_id: contentId, action: "comment" },
    });
  },

  async awardForShare(fromUserId, contentOwnerId, contentType = "post", contentId = null) {
    const epAmount = EP_AWARDS[`${contentType}_share_received`] ?? 3;
    return _transferEPWithFee({
      fromUserId, toUserId: contentOwnerId, epAmount,
      reason: `${contentType}_share`,
      metadata: { content_type: contentType, content_id: contentId, action: "share" },
    });
  },

  async awardForStoryUnlock(fromUserId, storyOwnerId, storyId = null, unlockCost = null) {
    const epAmount = unlockCost ?? EP_AWARDS.story_unlock;
    return _transferEPWithFee({
      fromUserId, toUserId: storyOwnerId, epAmount,
      reason: "story_unlock",
      metadata: { story_id: storyId, action: "unlock" },
    });
  },

  // Gifts: direct credit to recipient only (XEV purchase funds the cost)
  async awardForGift(recipientId, giftTier = "small", senderId = null) {
    const epAmount = EP_AWARDS[`gift_received_${giftTier}`] ?? 10;
    return this._directCreditEP(recipientId, epAmount, `gift_received_${giftTier}`, {
      sender_id: senderId, gift_tier: giftTier,
    });
  },

  // Follow: platform-funded
  async awardForFollow(followedUserId, followerId = null) {
    return this._directCreditEP(followedUserId, EP_AWARDS.follow_received, "follow_received", {
      follower_id: followerId,
    });
  },

  async awardDailyLogin(userId) {
    return this._directCreditEP(userId, EP_AWARDS.daily_login, "daily_login", {});
  },

  async awardReferral(userId, referredUserId = null) {
    return this._directCreditEP(userId, EP_AWARDS.referral, "referral", {
      referred_user_id: referredUserId,
    });
  },

  // ── Mint EP on deposit ────────────────────────────────────────
  // Correctly uses currency-aware minting rates.
  async mintOnDeposit(userId, amount, currency = "NGN") {
    const epToMint = computeEPMint(currency, amount);
    if (epToMint <= 0) return null;
    return this._directCreditEP(userId, epToMint, "deposit_mint", {
      amount, currency,
      // Log the rates used for auditability
      rate_used: currency === "NGN"
        ? "1 EP/₦1"
        : currency === "XEV"
        ? `${EP_PER_XEV} EP/XEV`
        : `${EP_PER_USD} EP/$1`,
    });
  },

  // ── Burn EP for wallet send ───────────────────────────────────
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

  // ── Direct credit (platform-funded) ──────────────────────────
  async _directCreditEP(userId, epAmount, reason, metadata = {}) {
    const { data, error } = await supabase.rpc("credit_ep", {
      p_user_id:  userId,
      p_amount:   epAmount,
      p_reason:   reason,
      p_metadata: JSON.stringify(metadata),
    });

    if (error) {
      console.error("[epService] credit_ep error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, awarded: epAmount, total: data };
  },

  // ── Affordability check ───────────────────────────────────────
  async checkCanAfford(userId, epAmount) {
    const fee      = parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));
    const required = epAmount + fee;
    const available = await this.getBalance(userId);
    return { canAfford: available >= required, required, available, fee };
  },

  // ── Real-time EP subscription ─────────────────────────────────
  subscribeToEP(userId, callback) {
    const channel = supabase
      .channel(`ep:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new?.engagement_points !== undefined) {
            callback(payload.new.engagement_points);
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // ── Rate accessors ────────────────────────────────────────────
  getProtocolFeeRate() { return PROTOCOL_FEE_RATE; },
  getProtocolFee(epAmount) {
    return parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));
  },

  // ── Conversion helpers (re-exported for convenience) ──────────
  epToUsd,
  epToXev,
  xevToUsd,
  computeEPBurn,
  computeEPMint,
  computeSwapAmount,
  EP_PER_USD,
  EP_PER_XEV,
  USD_PER_XEV,
};

export default epService;