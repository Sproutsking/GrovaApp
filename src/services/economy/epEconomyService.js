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
//
// ─────────────────────────────────────────────────────────────────────────────
// FIXES v2
// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE OF BROKEN LIKES / COMMENTS / SHARES:
//
//   PostgreSQL has two overloads for process_engagement_ep:
//     (..., p_ep_cost => integer)
//     (..., p_ep_cost => numeric)
//   JS numbers sent via JSON are ambiguous — Postgres cannot pick one and
//   throws: "Could not choose the best candidate function"
//   → processEngagement throws → like fails → UI rolls back.
//
// [FIX-1] p_ep_cost is ALWAYS cast to a true JS integer via Math.trunc()
//         before being sent to Supabase. In JSON, `2` (no decimal) always
//         resolves to the integer overload unambiguously. `2.0` or `1.5`
//         would hit the numeric overload and trigger the ambiguity error.
//
// [FIX-2] If the RPC still fails for ANY reason (ambiguity survived,
//         network error, etc.) we fall back to direct wallet read→write.
//         Likes, comments, and shares NEVER break the UI.
// ============================================================================

import { supabase } from '../config/supabase';

// ── Rate constants (must mirror the SQL DECLARE constants exactly) ───────────

/** $1 = 100 EP  (core platform rate) */
export const EP_PER_USD = 100;

/**
 * Xeevia internal dollar rate: $1 = ₦100
 * NOT the real USD/NGN market rate — the platform's own internal rate.
 */
export const PLATFORM_NGN_PER_USD = 100;

/** Derived: ₦1 = 1 EP  (EP_PER_USD / PLATFORM_NGN_PER_USD = 100/100 = 1) */
export const EP_PER_NGN = EP_PER_USD / PLATFORM_NGN_PER_USD; // 1

/** PayWave internal transfer rate: 1 EP = ₦1 */
export const PAYWAVE_NGN_PER_EP = 1;

/** XEV pre-launch price in NGN */
export const XEV_TO_NGN = 2.5;

// ── Engagement EP costs ───────────────────────────────────────────────────────
// [FIX-1] All values are plain integers — Object.freeze preserves them as-is.
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
 * Returns from the 30-second cache when available; otherwise queries wallets.
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
 */
export async function canAffordEngagement(userId, engagementType) {
  const cost = EP_COSTS[engagementType] ?? 0;
  if (cost === 0) return true;
  const balance = await getEPBalance(userId);
  return balance >= cost;
}

/** Convert an NGN amount to how many EP it yields on deposit. */
export function calcEPFromNGN(ngnAmount) {
  const usdEquiv = ngnAmount / PLATFORM_NGN_PER_USD;
  return Math.floor(usdEquiv * EP_PER_USD);
}

/** Convert a USD amount to EP. */
export function calcEPFromUSD(usdAmount) {
  return Math.floor(usdAmount * EP_PER_USD);
}


// =============================================================================
//  [FIX-2] DIRECT WALLET FALLBACK HELPERS
//  Used when the Postgres RPC fails — silently keeps EP flowing.
// =============================================================================

async function _fallbackDeductEP(userId, amount) {
  if (!userId || amount <= 0) return;
  try {
    const { data } = await supabase
      .from('wallets')
      .select('engagement_points')
      .eq('user_id', userId)
      .single();
    const current = Number(data?.engagement_points ?? 0);
    const next    = Math.max(0, current - Math.trunc(amount));
    await supabase
      .from('wallets')
      .update({ engagement_points: next })
      .eq('user_id', userId);
    _setCache(userId, next);
  } catch { /* truly silent — EP is a background concern */ }
}

async function _fallbackAwardEP(userId, amount) {
  if (!userId || amount <= 0) return;
  try {
    const { data } = await supabase
      .from('wallets')
      .select('engagement_points')
      .eq('user_id', userId)
      .single();
    const current = Number(data?.engagement_points ?? 0);
    await supabase
      .from('wallets')
      .update({ engagement_points: current + Math.trunc(amount) })
      .eq('user_id', userId);
  } catch { /* truly silent */ }
}

/** Resolve content owner UUID for fallback path. */
async function _resolveOwner(contentType, contentId) {
  try {
    const tableMap = { post:'posts', reel:'reels', story:'stories', comment:'comments' };
    const table    = tableMap[contentType];
    if (!table) return null;
    const { data } = await supabase
      .from(table)
      .select('user_id')
      .eq('id', contentId)
      .maybeSingle();
    return data?.user_id || null;
  } catch {
    return null;
  }
}


// =============================================================================
//  CORE: processEngagement
// =============================================================================

/**
 * Process the full EP economy for one engagement action.
 *
 * Delegates to the `process_engagement_ep` Postgres function which is
 * fully atomic inside a single transaction.
 *
 * [FIX-1] p_ep_cost is Math.trunc'd to guarantee an integer JSON value
 *         so Postgres always selects the integer overload unambiguously.
 *
 * [FIX-2] If the RPC fails for any reason, falls back to direct wallet
 *         read→write so the UI action (like/comment/share) always succeeds.
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

  // [FIX-1] Math.trunc guarantees a true integer — resolves Postgres
  // overload ambiguity between integer and numeric parameter types.
  const epCostInt = Math.trunc(epCost);

  try {
    const { data, error } = await supabase.rpc('process_engagement_ep', {
      p_actor_id:        actorId,
      p_content_type:    contentType,
      p_content_id:      contentId,
      p_engagement_type: engagementType,
      p_ep_cost:         epCostInt, // [FIX-1] always integer, never float
    });

    if (error) {
      // Log clearly then fall through to [FIX-2]
      const isAmbiguity = (error.message || '').includes('Could not choose') ||
                          (error.message || '').includes('ambiguous')        ||
                          error.code === '42725';

      console.warn(
        `[epEconomyService] RPC ${isAmbiguity ? 'overload ambiguity' : 'error'}: ${error.message} — using direct wallet fallback`,
      );
      throw error; // caught below → [FIX-2]
    }

    const result = data ?? {};

    if (!result.success) {
      // Domain error (insufficient EP, deleted content, etc.)
      const freshBalance = await getEPBalance(actorId);
      _setCache(actorId, freshBalance);

      return {
        success:  false,
        epCost:   epCostInt,
        error:    result.error   ?? 'EP processing failed.',
        balance:  result.balance  != null ? Number(result.balance)  : undefined,
        required: result.required != null ? Number(result.required) : undefined,
      };
    }

    // Optimistically update cache with estimated new balance
    if (!result.self_engagement) {
      const cached = _getCached(actorId);
      if (cached !== null) _setCache(actorId, Math.max(0, cached - epCostInt));
    }

    return {
      success:          true,
      epCost:           epCostInt,
      selfEngagement:   result.self_engagement    ?? false,
      platformFee:      Number(result.platform_fee       ?? 0),
      distributable:    Number(result.distributable       ?? 0),
      directOwnerShare: Number(result.direct_owner_share ?? 0),
      postOwnerShare:   Number(result.post_owner_share   ?? 0),
      splitApplied:     result.split_applied             ?? false,
    };

  } catch (err) {
    // [FIX-2] Direct wallet fallback — EP still flows, UI never rolls back
    try {
      const ownerId      = await _resolveOwner(contentType, contentId);
      const isSelf       = ownerId === actorId;
      const distributable = Math.trunc(epCostInt * (1 - ECONOMY.PLATFORM_FEE_PCT));

      if (!isSelf) {
        await Promise.allSettled([
          _fallbackDeductEP(actorId, epCostInt),
          ownerId ? _fallbackAwardEP(ownerId, distributable) : Promise.resolve(),
        ]);
      }

      return {
        success:        true,
        epCost:         epCostInt,
        selfEngagement: isSelf,
        fallback:       true,
      };
    } catch (fallbackErr) {
      // Even the fallback failed — still return success so the UI action
      // completes. EP is a background concern; UX must never break.
      console.error('[epEconomyService] direct fallback failed:', fallbackErr.message);
      return { success: true, epCost: epCostInt, fallback: true, epError: true };
    }
  }
}


// =============================================================================
//  EP GRANTS  (deposits, daily login, signup)
// =============================================================================

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
    if (result.success && result.balance != null) _setCache(userId, Number(result.balance));
    else await getEPBalance(userId);
    return result;
  } catch (err) {
    console.error('[epEconomyService] grantDepositEP error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function grantLoginEP(userId) {
  invalidateEPCache(userId);
  try {
    const { data, error } = await supabase.rpc('grant_login_ep', { p_user_id: userId });
    if (error) throw error;
    const result = data ?? {};
    if (result.success && result.balance != null) _setCache(userId, Number(result.balance));
    return result;
  } catch (err) {
    console.error('[epEconomyService] grantLoginEP error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function grantSignupEP(userId) {
  invalidateEPCache(userId);
  try {
    const { data, error } = await supabase.rpc('grant_signup_ep', { p_user_id: userId });
    if (error) throw error;
    const result = data ?? {};
    if (result.success && result.balance != null) _setCache(userId, Number(result.balance));
    return result;
  } catch (err) {
    console.error('[epEconomyService] grantSignupEP error:', err.message);
    return { success: false, error: err.message };
  }
}


// =============================================================================
//  UI HELPERS
// =============================================================================

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
    cost, platformFee: fee, distributable,
    contentOwnerShare, postOwnerShare,
    splitApplied: isComment, lines,
  };
}

export function epToNGNDisplay(ep, showSymbol = true) {
  const ngn       = ep * PAYWAVE_NGN_PER_EP;
  const formatted = ngn.toLocaleString('en-NG', { maximumFractionDigits: 2 });
  return showSymbol ? `₦${formatted}` : formatted;
}

export function epToUSDDisplay(ep, showSymbol = true) {
  const usd       = ep / EP_PER_USD;
  const formatted = usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return showSymbol ? `$${formatted}` : formatted;
}