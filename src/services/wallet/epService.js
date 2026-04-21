// src/services/wallet/epService.js
// ════════════════════════════════════════════════════════════════
// Engagement Points (EP) Service — COMPLETE IMPLEMENTATION
//
// CANONICAL EXCHANGE RATES:
//   1 USD  = 100 EP
//   1 $XEV = 10 EP
//   1 $XEV = $0.10 USD
//
// EP MINT FIX (critical):
//   Previously: NGN deposits minted 1 EP per ₦1, so a $4 payment
//   processed as ₦5,380 would mint 5,380 EP — wildly wrong.
//
//   Correct logic: NGN is just the local payment vehicle for a
//   USD-denominated product. We always mint EP based on the USD
//   value of the purchase:
//     $4 USD × 100 EP/USD = 400 EP  ✓
//
//   computeEPMint("NGN", ngnAmount) now converts NGN → USD using
//   the live/cached rate first, then applies EP_PER_USD.
//   The cached rate from depositFundService is used; if unavailable
//   it falls back to a safe 1500 NGN/USD default (conservative, not
//   inflationary). The webhook/edge function should pass the
//   actual USD amount directly when possible — use "USD" currency
//   tag for that path so no conversion is needed.
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

  // ── Deposit minting rates ────────────────────────────────────
  // IMPORTANT: NGN is NOT minted at 1 EP/₦1.
  // NGN deposits must be converted to USD first (see computeEPMint).
  // These rates apply to their named currency directly:
  deposit_per_usd:  EP_PER_USD,   // 100 EP per $1 USD
  deposit_per_xev:  EP_PER_XEV,   //  10 EP per 1 XEV

  // daily / referral
  daily_login:  5,
  referral:    20,
};

// ── EP burn table for wallet SEND operations ─────────────────────
export const EP_BURN_TABLE = [
  { maxXev: 1,        burn: 0.5 },
  { maxXev: 5,        burn: 2   },
  { maxXev: 20,       burn: 5   },
  { maxXev: Infinity, burn: 10  },
];

export function computeEPBurn(xevAmount) {
  const x = parseFloat(xevAmount) || 0;
  for (const row of EP_BURN_TABLE) {
    if (x < row.maxXev) return row.burn;
  }
  return 10;
}

// ── Swap rate ─────────────────────────────────────────────────────
export function computeSwapAmount(direction, amount) {
  const a = parseFloat(amount) || 0;
  if (direction === "ep_to_xev") return a / EP_PER_XEV;
  if (direction === "xev_to_ep") return a * EP_PER_XEV;
  return 0;
}

// ── EP mint amounts for deposits ──────────────────────────────────
//
// KEY FIX: NGN is the *payment vehicle*, not the *unit of value*.
// A user paying $4 via Paystack is charged ₦5,380 (at ~1345 NGN/USD).
// We must mint EP based on the USD value ($4), not the NGN amount (₦5,380).
//
// Rule:
//   "USD" | "USDT" → amount × 100 EP/USD              (direct)
//   "XEV"          → amount × 10 EP/XEV               (direct)
//   "NGN"          → (amount / usdNgnRate) × 100 EP/USD (convert first)
//
// The usdNgnRate defaults to 1500 as a safe conservative fallback.
// In production the webhook should pass "USD" + the verified USD amount
// so no conversion is required at all.
//
export function computeEPMint(currency, amount, usdNgnRate = null) {
  const a    = parseFloat(amount) || 0;
  const rate = usdNgnRate || _getStoredUSDNGN();

  switch (currency) {
    case "USD":
    case "USDT":
      // Direct: $1 = 100 EP
      return Math.floor(a * EP_PER_USD);

    case "XEV":
      // Direct: 1 XEV = 10 EP
      return Math.floor(a * EP_PER_XEV);

    case "NGN": {
      // Convert NGN → USD first, then apply USD rate
      // e.g. ₦5,380 ÷ 1345 = $4.00 → $4 × 100 = 400 EP  ✓
      const usdEquiv = a / rate;
      return Math.floor(usdEquiv * EP_PER_USD);
    }

    default:
      return 0;
  }
}

// ── Retrieve cached NGN/USD rate ──────────────────────────────────
// depositFundService keeps a live rate. We read it from there if we
// can, otherwise fall back to a safe conservative default.
// 1500 is intentionally conservative (slightly below market) to avoid
// over-minting EP if the rate cache is stale.
function _getStoredUSDNGN() {
  try {
    // depositFundService exports getCachedUSDNGN — import lazily to
    // avoid circular dep at module load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getCachedUSDNGN } = require("../wallet/depositFundService");
    const r = getCachedUSDNGN();
    return r && r > 100 ? r : 1500;
  } catch {
    return 1500; // safe fallback: conservative, never over-mints
  }
}

// ── USD display value of EP ───────────────────────────────────────
export function epToUsd(ep)   { return parseFloat(ep) / EP_PER_USD; }
export function epToXev(ep)   { return parseFloat(ep) / EP_PER_XEV; }
export function xevToUsd(xev) { return parseFloat(xev) * USD_PER_XEV; }

// ─────────────────────────────────────────────────────────────────
// CORE: 3-WAY EP TRANSFER (social action economics)
// ─────────────────────────────────────────────────────────────────
async function _transferEPWithFee({ fromUserId, toUserId, epAmount, reason, metadata = {} }) {
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

  async getBalance(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("engagement_points")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.engagement_points || 0;
  },

  async getDashboard(userId) {
    const { data, error } = await supabase
      .from("ep_dashboard")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

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

  // ── Social action transfers ────────────────────────────────────
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

  async awardForGift(recipientId, giftTier = "small", senderId = null) {
    const epAmount = EP_AWARDS[`gift_received_${giftTier}`] ?? 10;
    return this._directCreditEP(recipientId, epAmount, `gift_received_${giftTier}`, {
      sender_id: senderId, gift_tier: giftTier,
    });
  },

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

  // ── Mint EP on deposit ─────────────────────────────────────────
  // ALWAYS pass usdAmount when available (from webhook/server).
  // If only NGN is available (legacy path), pass currency="NGN" and
  // the function will convert using the cached rate.
  //
  // Preferred call from webhook: mintOnDeposit(userId, usdAmount, "USD")
  // Legacy call:                 mintOnDeposit(userId, ngnAmount, "NGN")
  async mintOnDeposit(userId, amount, currency = "NGN", usdNgnRate = null) {
    const epToMint = computeEPMint(currency, amount, usdNgnRate);
    if (epToMint <= 0) return null;

    const rateUsed = currency === "NGN"
      ? `(₦${amount} ÷ ${usdNgnRate || _getStoredUSDNGN()} = $${(amount / (usdNgnRate || _getStoredUSDNGN())).toFixed(4)}) × ${EP_PER_USD} EP/USD`
      : currency === "XEV"
      ? `${EP_PER_XEV} EP/XEV`
      : `${EP_PER_USD} EP/$1`;

    return this._directCreditEP(userId, epToMint, "deposit_mint", {
      amount,
      currency,
      ep_minted:  epToMint,
      rate_used:  rateUsed,
    });
  },

  // ── Burn EP for wallet send ────────────────────────────────────
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

  // ── Direct credit (platform-funded) ───────────────────────────
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
    const fee       = parseFloat((epAmount * PROTOCOL_FEE_RATE).toFixed(4));
    const required  = epAmount + fee;
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

  // ── Conversion helpers ────────────────────────────────────────
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