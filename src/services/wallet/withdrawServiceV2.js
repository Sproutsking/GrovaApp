// src/services/wallet/withdrawServiceV2.js
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL SERVICE V2 — Smart Queueing & Tier-Based Limits
//
// KEY IMPROVEMENTS:
// • NO queueing for normal operation (immediate processing)
// • Queueing ONLY when system detects genuine congestion
// • Tier-based withdrawal limits (silver/gold/diamond)
// • Comprehensive spam/rate protection
// • Robust error handling with automatic retries
// • Full audit trail and real-time status updates
//
// USER EXPERIENCE:
// ✓ Fast processing for most users (milliseconds)
// ✓ No "queued" status for normal withdrawals
// ✓ Clear tier limits + daily tracking
// ✓ Spam protection with helpful cooldown messages
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import { computeWithdrawalFee as computeWithdrawalFeeEP } from "./epService";
import {
  TIER_CONFIG,
  MIN_WITHDRAWAL_USD,
  MIN_WITHDRAWAL_EP as MODEL_MIN_WITHDRAWAL_EP,
  PIN_REQUIRED_EP as MODEL_PIN_REQUIRED_EP,
  getSystemState,
  validateTierLimits,
  checkRateLimit,
  getDailyStats,
  computeWithdrawalFee,
  getWithdrawalPreview as getWithdrawalPreviewModel,
} from "../../models/WithdrawalModel";
import { getLiveUSDNGN, getCachedUSDNGN } from "./depositFundService";

export const MIN_WITHDRAWAL_EP = MODEL_MIN_WITHDRAWAL_EP;
export const PIN_REQUIRED_EP = MODEL_PIN_REQUIRED_EP;

// ── NGN rate cache ───────────────────────────────────────────────────────────
let _ngnRate = getCachedUSDNGN() || 1500;
export const MAX_DAILY_EP = 50_000;

// ── Withdrawal preview helpers for the current EP-based UI ───────────────────
export function getWithdrawalPreview(epAmount, method = "bank") {
  const amount = parseFloat(epAmount) || 0;
  if (amount <= 0) return null;
  const fee = computeWithdrawalFeeEP(amount);
  if (!fee) return null;
  const rate = getWithdrawRate();
  return {
    ...fee,
    method,
    grossEP: amount,
    netEp: fee.netEp,
    netNGN: epToNGN(fee.netEp, rate),
    netUSD: epToUSD(fee.netEp),
  };
}

export function epToNGN(epAmount, ngnRate = null) {
  const rate = ngnRate && ngnRate >= 100 ? ngnRate : getWithdrawRate();
  return Math.round((parseFloat(epAmount) / 100) * rate);
}

export function epToUSD(epAmount) {
  return parseFloat((parseFloat(epAmount) / 100).toFixed(4));
}

export async function queueWithdrawal({ userId, epAmount, method, fields, pin = null }) {
  const usdAmount = parseFloat(epAmount) / 100;
  return await initiateWithdrawal({ userId, usdAmount, method, fields, pin });
}

export async function refreshWithdrawRate() {
  try {
    const live = await getLiveUSDNGN();
    if (live && live >= 100) _ngnRate = live;
  } catch { /* keep cached */ }
  return _ngnRate || 1500;
}

export function getWithdrawRate() {
  return _ngnRate || 1500;
}

// ── Destination validation ────────────────────────────────────────────────────
export function validateDestination(method, fields) {
  switch (method) {
    case "bank":
      if (!fields.bank?.trim()) return "Please enter your bank name";
      if (!fields.accountNumber?.trim()) return "Please enter your account number";
      if (!fields.accountName?.trim()) return "Please enter your account name";
      if (!/^\d{10}$/.test(fields.accountNumber.trim()))
        return "Account number must be 10 digits (NUBAN)";
      return null;
    case "crypto":
      if (!fields.network?.trim()) return "Please enter the network / chain";
      if (!fields.token?.trim()) return "Please enter the token";
      if (!fields.walletAddress?.trim()) return "Please enter your wallet address";
      if (fields.walletAddress.trim().length < 10)
        return "Wallet address too short";
      return null;
    case "paypal":
      if (!fields.email?.trim()) return "Please enter your PayPal email";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
        return "Please enter a valid PayPal email address";
      return null;
    default:
      return "Unknown withdrawal method";
  }
}

// ── Main withdrawal function (SMART QUEUEING) ─────────────────────────────────
/**
 * Process a withdrawal with intelligent queueing:
 * • If system is healthy: PROCESS IMMEDIATELY
 * • If system is congested: QUEUE for later processing
 * • All requests are validated against tier limits & spam protection
 */
export async function initiateWithdrawal({
  userId,
  usdAmount,
  method,
  fields,
  pin = null,
}) {
  const amount = parseFloat(usdAmount) || 0;

  // ── Basic validation ──────────────────────────────────────────────────────
  if (amount < MIN_WITHDRAWAL_USD) {
    throw new Error(`Minimum withdrawal is $${MIN_WITHDRAWAL_USD} USD`);
  }

  const destError = validateDestination(method, fields);
  if (destError) throw new Error(destError);

  // ── Fetch user tier ───────────────────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("subscription_tier, boost_tier")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr || !profile) {
    throw new Error("Could not fetch user profile");
  }

  const tier = profile.subscription_tier || profile.boost_tier || "free";

  // ── Validate tier ─────────────────────────────────────────────────────────
  const tierStats = await getDailyStats(supabase, userId);
  const tierCheck = validateTierLimits(tier, amount, tierStats);
  if (!tierCheck.valid) throw new Error(tierCheck.error);

  // ── Check rate limits (spam protection) ────────────────────────────────────
  const rateCheck = await checkRateLimit(supabase, userId, tier);
  if (!rateCheck.allowed) throw new Error(rateCheck.error);

  // ── Compute fee & refresh NGN rate ────────────────────────────────────────
  const rate = await refreshWithdrawRate();
  const fee = computeWithdrawalFee(amount, tier);

  // Build destination info
  let destinationInfo = {};
  switch (method) {
    case "bank":
      destinationInfo = {
        bank: fields.bank.trim(),
        account_number: fields.accountNumber.trim(),
        account_name: fields.accountName.trim(),
        bank_code: fields.bankCode?.trim() || null,
      };
      break;
    case "crypto":
      destinationInfo = {
        network: fields.network.trim(),
        token: fields.token.trim().toUpperCase(),
        wallet_address: fields.walletAddress.trim(),
        memo: fields.memo?.trim() || null,
      };
      break;
    case "paypal":
      destinationInfo = {
        email: fields.email.trim().toLowerCase(),
        full_name: fields.fullName?.trim() || null,
      };
      break;
  }

  // ── Detect system state (SMART QUEUEING DECISION) ─────────────────────────
  const systemState = await getSystemState(supabase);
  const shouldQueue = systemState.shouldQueue;

  // Determine initial status
  const initialStatus = shouldQueue ? "queued" : "processing";

  // ── Insert withdrawal record ────────────────────────────────────────────────
  const { data: withdrawal, error: insertErr } = await supabase
    .from("withdrawal_queue")
    .insert({
      user_id: userId,
      ep_amount: fee.netEP,
      usd_amount: fee.grossUSD,
      processing_tier: tier,
      fee_pct: fee.feePercent,
      fee_ep: fee.feeEP,
      net_ep: fee.netEP,
      status: initialStatus,
      destination_type: method,
      destination_info: destinationInfo,
      pin_verified: pin ? true : false,
      ngn_rate: rate,
      metadata: {
        source: "mobile_app",
        system_state: systemState,
        fee_breakdown: fee,
      },
    })
    .select()
    .single();

  if (insertErr || !withdrawal) {
    throw new Error("Failed to create withdrawal request");
  }

  // ── If system is healthy: process immediately ─────────────────────────────
  if (!shouldQueue && method === "bank") {
    try {
      // Call edge function to initiate Paystack transfer
      const { data: fnData, error: fnError } =
        await supabase.functions.invoke("withdraw-paystack-init", {
          body: { withdrawal_id: withdrawal.id },
        });

      if (fnError) {
        console.warn("[withdrawV2] Paystack init failed, will retry via trigger:", fnError);
        // Withdrawal is safely stored; trigger will retry or admin can process
      } else {
        console.log("[withdrawV2] Paystack initiated successfully:", fnData);
      }
    } catch (e) {
      console.warn("[withdrawV2] Edge function error:", e);
      // Non-fatal: DB trigger will handle it
    }
  }

  // ── Format response ───────────────────────────────────────────────────────
  const tierConfig = TIER_CONFIG[tier];
  return {
    id: withdrawal.id,
    status: initialStatus,
    tier,
    ...fee,
    ngnRate: rate,
    netNGN: Math.round((fee.netUSD / 100) * rate * 100) / 100,
    estimatedHours: tierConfig.estimatedHours,
    systemWasHealthy: !shouldQueue,
    message: shouldQueue
      ? "Your withdrawal is queued due to high system traffic. It will be processed soon."
      : "Your withdrawal is being processed.",
    dailyRemaining: tierConfig.maxDaily - tierStats.dailyUsed,
    dailyCount: tierStats.dailyCount,
    requestedAt: withdrawal.requested_at,
  };
}

// ── Get withdrawal history ────────────────────────────────────────────────────
export async function getWithdrawalHistory(userId, limit = 30) {
  const { data, error } = await supabase
    .from("withdrawal_queue")
    .select(`
      id, ep_amount, usd_amount, processing_tier, fee_pct, fee_ep, net_ep,
      status, destination_type, destination_info,
      requested_at, estimated_at, processed_at,
      error_msg, metadata
    `)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rate = getWithdrawRate();
  return (data || []).map(row => ({
    ...row,
    netNGN: Math.round((row.net_ep / 100) * rate),
  }));
}

// ── Real-time subscription ────────────────────────────────────────────────────
export function subscribeToWithdrawals(userId, onUpdate) {
  const ch = supabase
    .channel(`withdrawal_live:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "withdrawal_queue",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(ch);
}

// ── Cancel withdrawal ─────────────────────────────────────────────────────────
export async function cancelWithdrawal(withdrawalId, userId) {
  const { data, error } = await supabase.rpc("cancel_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message || "Cancel failed");
  if (data?.success === false) throw new Error(data?.error || "Cannot cancel");

  return data;
}

// ── PIN verification ──────────────────────────────────────────────────────────
export function requiresPin(epAmount) {
  return parseFloat(epAmount) >= PIN_REQUIRED_EP;
}

export async function verifyWithdrawalPin(userId, pin) {
  const { data, error } = await supabase.rpc("verify_withdrawal_pin", {
    p_user_id: userId,
    p_pin: pin,
  });

  if (error) throw new Error(error.message || "PIN verification failed");
  if (!data?.success) throw new Error(data?.error || "Incorrect PIN");

  return true;
}

// ── Get withdrawal preview ────────────────────────────────────────────────────
export async function getPreview(userId, tier, usdAmount) {
  try {
    return await getWithdrawalPreviewModel(supabase, userId, tier, usdAmount, getWithdrawRate());
  } catch (e) {
    console.error("[withdrawV2] Preview error:", e);
    throw new Error("Could not generate preview");
  }
}

export async function getDailyWithdrawalUsage(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, boost_tier")
      .eq("id", userId)
      .maybeSingle();

    const tier = profile?.subscription_tier || profile?.boost_tier || "silver";
    const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.silver;
    const limitEp = tierConfig.maxDaily === Infinity
      ? Number.MAX_SAFE_INTEGER
      : Math.round(tierConfig.maxDaily * 100);

    const { data, error } = await supabase
      .from("withdrawal_queue")
      .select("ep_amount")
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .neq("status", "failed")
      .gte("requested_at", today.toISOString());

    if (error) {
      return { used: 0, remaining: limitEp, limit: limitEp, pct: 0 };
    }

    const used = (data || []).reduce((sum, row) => sum + parseFloat(row.ep_amount || 0), 0);
    const remaining = limitEp === Number.MAX_SAFE_INTEGER ? limitEp : Math.max(0, limitEp - used);
    const pct = limitEp === Number.MAX_SAFE_INTEGER
      ? 0
      : Math.min(100, (used / limitEp) * 100);

    return { used, remaining, limit: limitEp, pct };
  } catch (e) {
    console.error("[withdrawV2] Daily usage error:", e);
    return { used: 0, remaining: MAX_DAILY_EP, limit: MAX_DAILY_EP, pct: 0 };
  }
}

// ── Daily stats ───────────────────────────────────────────────────────────────
export async function getUserWithdrawalStats(userId) {
  const stats = await getDailyStats(supabase, userId);
  const rate = getWithdrawRate();

  return {
    dailyUsedUSD: stats.dailyUsed,
    dailyUsedEP: Math.round(stats.dailyUsed * 100),
    dailyPendingUSD: stats.dailyPending,
    dailyPendingEP: Math.round(stats.dailyPending * 100),
    dailyCount: stats.dailyCount,
    totalRequestedUSD: stats.totalRequested,
    totalRequestedEP: Math.round(stats.totalRequested * 100),
  };
}

export default {
  initiateWithdrawal,
  queueWithdrawal,
  getWithdrawalHistory,
  subscribeToWithdrawals,
  cancelWithdrawal,
  requiresPin,
  verifyWithdrawalPin,
  getPreview,
  getDailyWithdrawalUsage,
  getUserWithdrawalStats,
  getWithdrawRate,
  refreshWithdrawRate,
  MIN_WITHDRAWAL_USD,
  MIN_WITHDRAWAL_EP,
  PIN_REQUIRED_EP,
  MAX_DAILY_EP,
};
