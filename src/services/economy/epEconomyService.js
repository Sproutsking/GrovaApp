// src/services/economy/epEconomyService.js
// ============================================================================
// EP ECONOMY SERVICE — Single source of truth for all EP movements
//
// RATE STRUCTURE (must match the SQL constants exactly)
// ──────────────────────────────────────────────────────
//   EP_PER_USD           = 100    $1 = 100 EP  (core platform rate)
//   PLATFORM_NGN_PER_USD = 100    $1 = ₦100   (Xeevia internal dollar rate)
//
//   Derived:
//     ₦1   = floor(1/100 * 100)   = 1 EP
//     ₦100 = $1                   = 100 EP
//     ₦250 = $2.50                = 250 EP
//
//   PayWave internal transfers: 1 EP = ₦1 (same derived rate, simplified)
//   XEV price: ₦2.50 = $0.025 per XEV (pre-launch)
//
// ENGAGEMENT DISTRIBUTION
// ────────────────────────
//   Platform fee   20% of cost  → platform_revenue
//   Distributable  80% of cost  → content owner(s)
//
//   Direct engagement on post / reel / story:
//     100% of distributable → content owner
//
//   Engagement on a COMMENT (like or reply):
//     50% of distributable → comment owner
//     50% of distributable → original post owner  ← chain reaction
//
//   Self-engagement: action is allowed, zero EP moves
//
// BALANCE AUTHORITY
// ──────────────────
//   wallets.engagement_points   — authoritative (all writes go here)
//   profiles.engagement_points  — mirror (kept in sync by DB triggers)
//
// CACHING
// ────────
//   Balance cached per-user for 30 s to minimise DB reads.
//   Call invalidateEPCache(userId) right after any known mutation.
// ============================================================================

import { supabase } from '../config/supabase';

// ── Rate constants (must mirror the SQL DECLARE constants exactly) ───────────

/** $1 = 100 EP  (core platform rate) */
export const EP_PER_USD = 100;

/**
 * Xeevia internal dollar rate: $1 = ₦100
 * This is NOT the real USD/NGN market rate — it is the platform's own
 * internal exchange rate used to denominate EP in dollar terms.
 */
export const PLATFORM_NGN_PER_USD = 100;

/**
 * Derived: ₦1 = 1 EP
 * Computed from EP_PER_USD / PLATFORM_NGN_PER_USD = 100/100 = 1
 * Use this whenever you need to show the NGN equivalent to the user.
 */
export const EP_PER_NGN = EP_PER_USD / PLATFORM_NGN_PER_USD; // 1

/** PayWave internal transfer rate: 1 EP = ₦1 */
export const PAYWAVE_NGN_PER_EP = 1;

/** XEV pre-launch price in NGN */
export const XEV_TO_NGN = 2.5;

// ── Engagement EP costs ───────────────────────────────────────────────────────
export const EP_COSTS = Object.freeze({
  like:    2,
  comment: 4,
  reply:   4,
  share:   10,
});

// ── Economy metadata (for UI tooltips, docs, etc.) ───────────────────────────
export const ECONOMY = Object.freeze({
  EP_PER_USD,
  PLATFORM_NGN_PER_USD,
  EP_PER_NGN,
  XEV_TO_NGN,
  PAYWAVE_NGN_PER_EP,
  PLATFORM_FEE_PCT:     0.20,
  COMMENT_SPLIT_PCT:    0.50,
  SIGNUP_BONUS_EP:      50,
  DAILY_LOGIN_BONUS_EP: 5,
});

// ── 30-second in-memory balance cache ────────────────────────────────────────
const _cache = new Map(); // userId → { balance: number, at: number }

function _getCached(userId) {
  const entry = _cache.get(userId);
  if (entry && Date.now() - entry.at < 30_000) return entry.balance;
  return null;
}

function _setCache(userId, balance) {
  _cache.set(userId, { balance: Number(balance), at: Date.now() });
}

/**
 * Invalidate the cached EP balance for a user.
 * Call this immediately after any operation that changes their EP.
 */
export function invalidateEPCache(userId) {
  _cache.delete(userId);
}


// =============================================================================
//  BALANCE READS
// =============================================================================

/**
 * Get a user's current EP balance.
 * Returns from the 30-second cache when available; otherwise queries wallets table.
 *
 * @param   {string} userId
 * @returns {Promise<number>}
 */
export async function getEPBalance(userId) {
  const cached = _getCached(userId);
  if (cached !== null) return cached;

  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('engagement_points')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    const balance = Number(data?.engagement_points ?? 0);
    _setCache(userId, balance);
    return balance;
  } catch (err) {
    console.error('[epEconomyService] getEPBalance error:', err.message);
    return 0;
  }
}

/**
 * Check whether a user can afford a specific engagement type.
 * Uses the 30-second cache — does not hit the DB on every button render.
 *
 * @param   {string} userId
 * @param   {string} engagementType  'like' | 'comment' | 'reply' | 'share'
 * @returns {Promise<boolean>}
 */
export async function canAffordEngagement(userId, engagementType) {
  const cost = EP_COSTS[engagementType] ?? 0;
  if (cost === 0) return true;
  const balance = await getEPBalance(userId);
  return balance >= cost;
}

/**
 * Convert an NGN amount to how many EP it would yield on deposit.
 * Follows the dollar basis: NGN → USD at platform rate → EP.
 *
 * @param   {number} ngnAmount
 * @returns {number}  EP that would be credited (integer, floored)
 */
export function calcEPFromNGN(ngnAmount) {
  const usdEquiv = ngnAmount / PLATFORM_NGN_PER_USD;
  return Math.floor(usdEquiv * EP_PER_USD);
}

/**
 * Convert a USD amount to EP.
 *
 * @param   {number} usdAmount
 * @returns {number}
 */
export function calcEPFromUSD(usdAmount) {
  return Math.floor(usdAmount * EP_PER_USD);
}


// =============================================================================
//  CORE: processEngagement
// =============================================================================

/**
 * Process the full EP economy for one engagement action.
 *
 * Delegates to the `process_engagement_ep` Postgres function which is
 * fully atomic inside a single transaction:
 *   • Debits actor EP
 *   • Credits direct content owner
 *   • Credits original post owner when engaging on a comment (chain reaction)
 *   • Records platform revenue
 *   • Writes wallet_history rows (triggers ep_dashboard sync automatically)
 *   • Writes ep_transactions log row
 *
 * @param {Object} params
 * @param {string} params.actorId        UUID of the acting user
 * @param {string} params.contentType    'post' | 'reel' | 'story' | 'comment'
 * @param {string} params.contentId      UUID of the content being engaged with
 * @param {string} params.engagementType 'like' | 'comment' | 'reply' | 'share'
 *
 * @returns {Promise<{
 *   success:           boolean,
 *   epCost:            number,
 *   selfEngagement?:   boolean,
 *   platformFee?:      number,
 *   directOwnerShare?: number,
 *   postOwnerShare?:   number,
 *   splitApplied?:     boolean,
 *   error?:            string,
 *   balance?:          number,
 *   required?:         number,
 * }>}
 */
export async function processEngagement({
  actorId,
  contentType,
  contentId,
  engagementType,
}) {
  const epCost = EP_COSTS[engagementType] ?? 0;

  if (epCost <= 0) {
    return { success: true, epCost: 0, free: true };
  }

  // Optimistically evict cache so next read returns a fresh value
  invalidateEPCache(actorId);

  try {
    const { data, error } = await supabase.rpc('process_engagement_ep', {
      p_actor_id:        actorId,
      p_content_type:    contentType,
      p_content_id:      contentId,
      p_engagement_type: engagementType,
      p_ep_cost:         epCost,
    });

    if (error) throw error;

    const result = data ?? {};

    if (!result.success) {
      // Domain error (insufficient EP, deleted content, etc.)
      // Re-populate cache from DB so UI shows real balance
      const freshBalance = await getEPBalance(actorId);
      _setCache(actorId, freshBalance);

      return {
        success:  false,
        epCost,
        error:    result.error   ?? 'EP processing failed.',
        balance:  result.balance  != null ? Number(result.balance)  : undefined,
        required: result.required != null ? Number(result.required) : undefined,
      };
    }

    if (!result.self_engagement) {
      // Update cache with estimated new balance (avoids an extra DB round-trip)
      const cached = _getCached(actorId);
      if (cached !== null) {
        _setCache(actorId, Math.max(0, cached - epCost));
      }
    }

    return {
      success:          true,
      epCost,
      selfEngagement:   result.self_engagement    ?? false,
      platformFee:      Number(result.platform_fee       ?? 0),
      distributable:    Number(result.distributable       ?? 0),
      directOwnerShare: Number(result.direct_owner_share ?? 0),
      postOwnerShare:   Number(result.post_owner_share   ?? 0),
      splitApplied:     result.split_applied             ?? false,
    };

  } catch (err) {
    console.error('[epEconomyService] processEngagement error:', err.message);
    // Restore cache from DB
    const freshBalance = await getEPBalance(actorId);
    _setCache(actorId, freshBalance);

    return { success: false, epCost, error: err.message };
  }
}


// =============================================================================
//  EP GRANTS  (deposits, daily login, signup)
// =============================================================================

/**
 * Grant EP for a confirmed payment/deposit.
 *
 * Rate: $1 = 100 EP at platform rate $1 = ₦100
 *   e.g. deposit ₦500 → $5 → 500 EP
 *
 * Idempotent via paymentId guard in the DB function.
 *
 * @param {string}      userId
 * @param {number}      ngnAmount   Amount deposited in NGN
 * @param {string|null} paymentId   UUID from the payments table (idempotency key)
 * @returns {Promise<{
 *   success:        boolean,
 *   ep_granted?:    number,
 *   usd_equivalent?:number,
 *   balance?:       number,
 *   already_processed?: boolean,
 *   error?:         string,
 * }>}
 */
export async function grantDepositEP(userId, ngnAmount, paymentId = null) {
  invalidateEPCache(userId);

  try {
    const { data, error } = await supabase.rpc('grant_deposit_ep', {
      p_user_id:    userId,
      p_ngn_amount: ngnAmount,
      p_payment_id: paymentId,
    });

    if (error) throw error;

    const result = data ?? {};
    if (result.success && result.balance != null) {
      _setCache(userId, Number(result.balance));
    } else {
      // Re-read balance from DB on failure
      await getEPBalance(userId);
    }

    return result;
  } catch (err) {
    console.error('[epEconomyService] grantDepositEP error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Grant 5 EP for today's daily login.
 * Idempotent — safe to call on every auth state change.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   success:        boolean,
 *   ep_granted?:    number,
 *   balance?:       number,
 *   already_claimed?: boolean,
 *   error?:         string,
 * }>}
 */
export async function grantLoginEP(userId) {
  invalidateEPCache(userId);

  try {
    const { data, error } = await supabase.rpc('grant_login_ep', {
      p_user_id: userId,
    });

    if (error) throw error;

    const result = data ?? {};
    if (result.success && result.balance != null) {
      _setCache(userId, Number(result.balance));
    }
    return result;
  } catch (err) {
    console.error('[epEconomyService] grantLoginEP error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Grant 50 EP one-time signup bonus.
 * Idempotent — safe to call during onboarding even if already granted.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   success:        boolean,
 *   ep_granted?:    number,
 *   balance?:       number,
 *   already_granted?: boolean,
 *   error?:         string,
 * }>}
 */
export async function grantSignupEP(userId) {
  invalidateEPCache(userId);

  try {
    const { data, error } = await supabase.rpc('grant_signup_ep', {
      p_user_id: userId,
    });

    if (error) throw error;

    const result = data ?? {};
    if (result.success && result.balance != null) {
      _setCache(userId, Number(result.balance));
    }
    return result;
  } catch (err) {
    console.error('[epEconomyService] grantSignupEP error:', err.message);
    return { success: false, error: err.message };
  }
}


// =============================================================================
//  UI HELPERS
// =============================================================================

/**
 * Returns a full breakdown of how EP is distributed for a given engagement.
 * Use this to power "where does my EP go?" tooltips / info modals.
 *
 * @param {string} contentType    'post' | 'reel' | 'story' | 'comment'
 * @param {string} engagementType 'like' | 'comment' | 'reply' | 'share'
 * @returns {{
 *   cost:              number,
 *   platformFee:       number,
 *   distributable:     number,
 *   contentOwnerShare: number,
 *   postOwnerShare:    number,
 *   splitApplied:      boolean,
 *   lines:             string[]
 * }}
 */
export function getDistributionBreakdown(contentType, engagementType) {
  const cost          = EP_COSTS[engagementType] ?? 0;
  const fee           = +(cost * ECONOMY.PLATFORM_FEE_PCT).toFixed(2);
  const distributable = +(cost - fee).toFixed(2);
  const isComment     = contentType === 'comment';

  const contentOwnerShare = isComment
    ? +(distributable * ECONOMY.COMMENT_SPLIT_PCT).toFixed(2)
    : distributable;
  const postOwnerShare = isComment
    ? +(distributable - contentOwnerShare).toFixed(2)
    : 0;

  const lines = [
    `You spend: ${cost} EP`,
    `Platform fee (20%): ${fee} EP`,
    isComment
      ? `Comment owner receives: ${contentOwnerShare} EP (40% of total)`
      : `Creator receives: ${contentOwnerShare} EP (80% of total)`,
    ...(isComment
      ? [`Post owner receives: ${postOwnerShare} EP (40% of total) ← chain reaction`]
      : []),
  ];

  return {
    cost,
    platformFee:       fee,
    distributable,
    contentOwnerShare,
    postOwnerShare,
    splitApplied:      isComment,
    lines,
  };
}

/**
 * Format an EP amount as its NGN equivalent string for display.
 * Uses the derived rate: 1 EP = ₦1 (PAYWAVE_NGN_PER_EP)
 *
 * @param   {number}  ep
 * @param   {boolean} showSymbol  Whether to prepend ₦
 * @returns {string}
 */
export function epToNGNDisplay(ep, showSymbol = true) {
  const ngn = ep * PAYWAVE_NGN_PER_EP;
  const formatted = ngn.toLocaleString('en-NG', { maximumFractionDigits: 2 });
  return showSymbol ? `₦${formatted}` : formatted;
}

/**
 * Format an EP amount as its USD equivalent string for display.
 * Uses: 1 EP = $0.01  (EP_PER_USD = 100, so 1 EP = $1/100)
 *
 * @param   {number}  ep
 * @param   {boolean} showSymbol
 * @returns {string}
 */
export function epToUSDDisplay(ep, showSymbol = true) {
  const usd = ep / EP_PER_USD;
  const formatted = usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return showSymbol ? `$${formatted}` : formatted;
}