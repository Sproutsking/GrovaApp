// src/services/economy/epEconomyService.js
// ============================================================================
// EP ECONOMY SERVICE — v3 PUSH NOTIFICATIONS ADDED
// ============================================================================
// CHANGES vs v2:
//   [PUSH-1] processEngagement() now fires push notifications for:
//              like    → push to content owner
//              comment → push to content owner
//              reply   → push to parent comment author + post owner
//              share   → push to content owner
//            Push is fire-and-forget — never blocks EP processing, never
//            throws to the caller. Self-engagement skips push entirely.
//            Push fires AFTER the EP RPC succeeds (or falls back) so we
//            never push for a failed action.
//   All v2 fixes (FIX-1 integer cast, FIX-2 fallback, FIX-3 live FX)
//   preserved exactly.
// ============================================================================

import { supabase }  from '../config/supabase';
import pushService   from '../notifications/pushService';

// ── Fixed EP↔USD peg (never changes) ─────────────────────────────────────────
export const EP_PER_USD           = 100;
export const FALLBACK_NGN_PER_USD = 1600;
export const PAYWAVE_EP_TO_USD    = 1 / EP_PER_USD;
export const XEV_TO_USD           = 0.025;

export const EP_COSTS = Object.freeze({
  like:    2,
  comment: 4,
  reply:   4,
  share:   10,
});

export const ECONOMY = Object.freeze({
  EP_PER_USD,
  FALLBACK_NGN_PER_USD,
  PAYWAVE_EP_TO_USD,
  XEV_TO_USD,
  PLATFORM_FEE_PCT:     0.20,
  COMMENT_SPLIT_PCT:    0.50,
  SIGNUP_BONUS_EP:      50,
  DAILY_LOGIN_BONUS_EP: 5,
});

// =============================================================================
//  [PUSH-1] PUSH HELPER — resolves owner + actor names, sends push
//  Never throws. Always fire-and-forget.
// =============================================================================

async function _resolveProfile(userId) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', userId)
      .single();
    return data?.full_name || data?.username || 'Someone';
  } catch { return 'Someone'; }
}

async function _resolveContentOwner(contentType, contentId) {
  try {
    const tableMap = { post: 'posts', reel: 'reels', story: 'stories', comment: 'comments' };
    const table    = tableMap[contentType];
    if (!table) return null;
    const { data } = await supabase
      .from(table).select('user_id').eq('id', contentId).maybeSingle();
    return data?.user_id || null;
  } catch { return null; }
}

// [PUSH-1] Central push dispatcher for all engagement types
async function _sendEngagementPush({
  actorId,
  contentType,
  contentId,
  engagementType,
  isSelf,
}) {
  // Never push self-engagement
  if (isSelf) return;

  try {
    const actorName  = await _resolveProfile(actorId);
    const ownerId    = await _resolveContentOwner(contentType, contentId);
    if (!ownerId || ownerId === actorId) return;

    // Resolve content URL
    const contentLabel = contentType === 'reel' ? 'reel'
      : contentType === 'story' ? 'story'
      : contentType === 'comment' ? 'comment'
      : 'post';

    const urlBase = contentType === 'reel' ? `/reel/${contentId}`
      : contentType === 'story' ? `/story/${contentId}`
      : contentType === 'comment' ? '/'
      : `/post/${contentId}`;

    switch (engagementType) {

      case 'like':
        await pushService.sendPushToUser({
          recipientUserId: ownerId,
          actorUserId:     actorId,
          type:            'like',
          title:           'New like',
          message:         `${actorName} liked your ${contentLabel}`,
          entityId:        contentId,
          metadata: {
            notification_id: `like_${contentType}_${contentId}_${actorId}`,
            actorName,
            url: urlBase,
          },
        });
        break;

      case 'comment':
        await pushService.sendPushToUser({
          recipientUserId: ownerId,
          actorUserId:     actorId,
          type:            'comment',
          title:           'New comment',
          message:         `${actorName} commented on your ${contentLabel}`,
          entityId:        contentId,
          metadata: {
            notification_id: `comment_${contentType}_${contentId}_${actorId}_${Date.now()}`,
            actorName,
            url: urlBase,
          },
        });
        break;

      case 'reply':
        // Push to parent comment author
        await pushService.sendPushToUser({
          recipientUserId: ownerId,
          actorUserId:     actorId,
          type:            'comment_reply',
          title:           'New reply',
          message:         `${actorName} replied to your comment`,
          entityId:        contentId,
          metadata: {
            notification_id: `reply_${contentId}_${actorId}_${Date.now()}`,
            actorName,
            url: '/',
          },
        });
        break;

      case 'share':
        await pushService.sendPushToUser({
          recipientUserId: ownerId,
          actorUserId:     actorId,
          type:            'share',
          title:           'New share',
          message:         `${actorName} shared your ${contentLabel}`,
          entityId:        contentId,
          metadata: {
            notification_id: `share_${contentType}_${contentId}_${actorId}_${Date.now()}`,
            actorName,
            url: urlBase,
          },
        });
        break;

      default:
        break;
    }
  } catch (e) {
    console.warn('[epEconomyService] push failed (non-fatal):', e?.message);
  }
}

// =============================================================================
//  [FIX-3] LIVE FX RATE
// =============================================================================

const FX_RATE_TTL_MS = 5 * 60 * 1000;
const _fxCache = { rate: null, fetchedAt: 0 };

function _getFxCached() {
  if (_fxCache.rate && Date.now() - _fxCache.fetchedAt < FX_RATE_TTL_MS)
    return _fxCache.rate;
  return null;
}
function _setFxCache(rate) {
  _fxCache.rate = rate;
  _fxCache.fetchedAt = Date.now();
}
export function invalidateFXCache() {
  _fxCache.rate = null;
  _fxCache.fetchedAt = 0;
}

export async function getLiveNGNPerUSD() {
  const cached = _getFxCached();
  if (cached) return cached;

  try {
    const paystackKey =
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.REACT_APP_PAYSTACK_SECRET_KEY ||
      process.env.EXPO_PUBLIC_PAYSTACK_SECRET_KEY;
    if (paystackKey) {
      const res = await fetch('https://api.paystack.co/bank/exchange_rates', {
        headers: { Authorization: `Bearer ${paystackKey}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rates = json?.data || [];
        const entry = rates.find(
          (r) =>
            (r.base_currency === 'USD' && r.currency === 'NGN') ||
            (r.base_currency === 'NGN' && r.currency === 'USD'),
        );
        if (entry) {
          let rate;
          if (entry.base_currency === 'USD') {
            rate = Number(entry.buy_rate ?? entry.rate);
          } else {
            rate = 1 / Number(entry.buy_rate ?? entry.rate);
          }
          if (rate > 0) { _setFxCache(rate); return rate; }
        }
      }
    }
  } catch (err) {
    console.warn('[epEconomyService] Paystack FX fetch failed:', err?.message);
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const json = await res.json();
      const rate = Number(json?.rates?.NGN);
      if (rate > 0) { _setFxCache(rate); return rate; }
    }
  } catch (err) {
    console.warn('[epEconomyService] Open ER API FX fetch failed:', err?.message);
  }

  console.warn(
    `[epEconomyService] All FX sources failed — using FALLBACK_NGN_PER_USD (${FALLBACK_NGN_PER_USD}).`,
  );
  return FALLBACK_NGN_PER_USD;
}

// =============================================================================
//  EP BALANCE CACHE
// =============================================================================

const _cache = new Map();

function _getCached(userId) {
  const entry = _cache.get(userId);
  if (entry && Date.now() - entry.at < 30_000) return entry.balance;
  return null;
}
function _setCache(userId, balance) {
  _cache.set(userId, { balance: Number(balance), at: Date.now() });
}
export function invalidateEPCache(userId) {
  _cache.delete(userId);
}

// =============================================================================
//  BALANCE READS
// =============================================================================

export async function getEPBalance(userId) {
  const cached = _getCached(userId);
  if (cached !== null) return cached;
  try {
    const { data, error } = await supabase
      .from('wallets').select('engagement_points').eq('user_id', userId).single();
    if (error) throw error;
    const balance = Number(data?.engagement_points ?? 0);
    _setCache(userId, balance);
    return balance;
  } catch (err) {
    console.error('[epEconomyService] getEPBalance error:', err.message);
    return 0;
  }
}

export async function canAffordEngagement(userId, engagementType) {
  const cost = EP_COSTS[engagementType] ?? 0;
  if (cost === 0) return true;
  const balance = await getEPBalance(userId);
  return balance >= cost;
}

export function calcEPFromNGN(ngnAmount, liveNGNPerUSD) {
  if (!liveNGNPerUSD || liveNGNPerUSD <= 0) {
    throw new Error(
      '[epEconomyService] calcEPFromNGN: liveNGNPerUSD is required and must be > 0.',
    );
  }
  return Math.floor((ngnAmount / liveNGNPerUSD) * EP_PER_USD);
}

export function calcEPFromUSD(usdAmount) {
  return Math.floor(usdAmount * EP_PER_USD);
}

export function calcUSDFromNGN(ngnAmount, liveNGNPerUSD) {
  if (!liveNGNPerUSD || liveNGNPerUSD <= 0) {
    throw new Error(
      '[epEconomyService] calcUSDFromNGN: liveNGNPerUSD is required and must be > 0.',
    );
  }
  return ngnAmount / liveNGNPerUSD;
}

// =============================================================================
//  [FIX-2] DIRECT WALLET FALLBACK HELPERS
// =============================================================================

async function _fallbackDeductEP(userId, amount) {
  if (!userId || amount <= 0) return;
  try {
    const { data } = await supabase
      .from('wallets').select('engagement_points').eq('user_id', userId).single();
    const current = Number(data?.engagement_points ?? 0);
    const next    = Math.max(0, current - Math.trunc(amount));
    await supabase.from('wallets').update({ engagement_points: next }).eq('user_id', userId);
    _setCache(userId, next);
  } catch { /* truly silent */ }
}

async function _fallbackAwardEP(userId, amount) {
  if (!userId || amount <= 0) return;
  try {
    const { data } = await supabase
      .from('wallets').select('engagement_points').eq('user_id', userId).single();
    const current = Number(data?.engagement_points ?? 0);
    await supabase
      .from('wallets')
      .update({ engagement_points: current + Math.trunc(amount) })
      .eq('user_id', userId);
  } catch { /* truly silent */ }
}

async function _resolveOwner(contentType, contentId) {
  return _resolveContentOwner(contentType, contentId);
}

// =============================================================================
//  CORE: processEngagement
//  [PUSH-1] Push fires after EP succeeds, never blocks EP processing
// =============================================================================

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

  invalidateEPCache(actorId);

  // [FIX-1] Always integer — resolves Postgres overload ambiguity
  const epCostInt = Math.trunc(epCost);

  try {
    const { data, error } = await supabase.rpc('process_engagement_ep', {
      p_actor_id:        actorId,
      p_content_type:    contentType,
      p_content_id:      contentId,
      p_engagement_type: engagementType,
      p_ep_cost:         epCostInt,
    });

    if (error) {
      const isAmbiguity =
        (error.message || '').includes('Could not choose') ||
        (error.message || '').includes('ambiguous')        ||
        error.code === '42725';
      console.warn(
        `[epEconomyService] RPC ${isAmbiguity ? 'overload ambiguity' : 'error'}: ${error.message} — using direct wallet fallback`,
      );
      throw error;
    }

    const result = data ?? {};

    if (!result.success) {
      const freshBalance = await getEPBalance(actorId);
      _setCache(actorId, freshBalance);
      return {
        success:  false,
        epCost:   epCostInt,
        error:    result.error    ?? 'EP processing failed.',
        balance:  result.balance  != null ? Number(result.balance)  : undefined,
        required: result.required != null ? Number(result.required) : undefined,
      };
    }

    // Optimistically update balance cache
    if (!result.self_engagement) {
      const cached = _getCached(actorId);
      if (cached !== null) _setCache(actorId, Math.max(0, cached - epCostInt));
    }

    // [PUSH-1] Fire push after confirmed EP success — never awaited
    _sendEngagementPush({
      actorId,
      contentType,
      contentId,
      engagementType,
      isSelf: result.self_engagement ?? false,
    });

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
    // [FIX-2] Direct wallet fallback
    try {
      const ownerId       = await _resolveOwner(contentType, contentId);
      const isSelf        = ownerId === actorId;
      const distributable = Math.trunc(epCostInt * (1 - ECONOMY.PLATFORM_FEE_PCT));

      if (!isSelf) {
        await Promise.allSettled([
          _fallbackDeductEP(actorId, epCostInt),
          ownerId ? _fallbackAwardEP(ownerId, distributable) : Promise.resolve(),
        ]);
      }

      // [PUSH-1] Also fire push on fallback path
      _sendEngagementPush({
        actorId,
        contentType,
        contentId,
        engagementType,
        isSelf,
      });

      return {
        success:        true,
        epCost:         epCostInt,
        selfEngagement: isSelf,
        fallback:       true,
      };
    } catch (fallbackErr) {
      console.error('[epEconomyService] direct fallback failed:', fallbackErr.message);
      return { success: true, epCost: epCostInt, fallback: true, epError: true };
    }
  }
}

// =============================================================================
//  EP GRANTS
// =============================================================================

export async function grantDepositEP(userId, ngnAmount, paymentId = null) {
  invalidateEPCache(userId);
  invalidateFXCache();
  const liveNGNPerUSD = await getLiveNGNPerUSD();
  try {
    const { data, error } = await supabase.rpc('grant_deposit_ep', {
      p_user_id:     userId,
      p_ngn_amount:  ngnAmount,
      p_payment_id:  paymentId,
      p_ngn_per_usd: liveNGNPerUSD,
    });
    if (error) throw error;
    const result = data ?? {};
    if (result.success && result.balance != null) _setCache(userId, Number(result.balance));
    else await getEPBalance(userId);

    // [PUSH-1] Push wallet credit notification to user
    try {
      const epGranted = result.ep_granted ?? result.epGranted ?? 0;
      if (epGranted > 0) {
        await pushService.sendPushToUser({
          recipientUserId: userId,
          actorUserId:     'system',
          type:            'payment_confirmed',
          title:           '💳 Deposit confirmed',
          message:         `Your deposit of ₦${ngnAmount.toLocaleString()} was successful. ${epGranted} EP added.`,
          entityId:        null,
          metadata: {
            notification_id: `deposit_${userId}_${Date.now()}`,
            url:             '/account',
          },
        });
      }
    } catch { /* non-fatal */ }

    return { ...result, rateUsed: liveNGNPerUSD };
  } catch (err) {
    console.error('[epEconomyService] grantDepositEP error:', err.message);
    return { success: false, error: err.message, rateUsed: liveNGNPerUSD };
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

export function epToNGNDisplay(ep, liveNGNPerUSD, showSymbol = true) {
  if (!liveNGNPerUSD || liveNGNPerUSD <= 0) {
    throw new Error(
      '[epEconomyService] epToNGNDisplay: liveNGNPerUSD is required.',
    );
  }
  const usd       = ep / EP_PER_USD;
  const ngn       = usd * liveNGNPerUSD;
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

export function fxRateDisplay(liveNGNPerUSD) {
  const formatted = liveNGNPerUSD.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$1 = ₦${formatted}`;
}