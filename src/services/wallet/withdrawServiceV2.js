// src/services/wallet/withdrawServiceV2.js
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL SERVICE V2 — Server-authoritative bank withdrawals
//
// The server enforces reward-level eligibility, limits, fees, FX, PIN, and
// atomic wallet accounting. Only bank payouts are currently supported.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import {
  MIN_WITHDRAWAL_USD,
  MIN_WITHDRAWAL_EP as MODEL_MIN_WITHDRAWAL_EP,
  PIN_REQUIRED_EP as MODEL_PIN_REQUIRED_EP,
  getDailyStats,
} from "../../models/WithdrawalModel";
import { getCachedUSDNGN } from "./depositFundService";

export const MIN_WITHDRAWAL_EP = MODEL_MIN_WITHDRAWAL_EP;
export const PIN_REQUIRED_EP = MODEL_PIN_REQUIRED_EP;

// ── NGN rate cache ───────────────────────────────────────────────────────────
let _ngnRate = getCachedUSDNGN() || 1366;
export const MAX_DAILY_EP = 50_000;

// ── Withdrawal preview helpers for the current EP-based UI ───────────────────
export function getWithdrawalPreview(epAmount, method = "bank", feePct = 2) {
  const amount = parseFloat(epAmount) || 0;
  if (amount <= 0) return null;
  const grossEP = Math.floor(amount);
  const normalizedFeePct = Number.isFinite(Number(feePct)) && Number(feePct) >= 0 && Number(feePct) <= 25
    ? Number(feePct)
    : 2;
  const feeAmount = Math.round(grossEP * normalizedFeePct / 100);
  const netEp = grossEP - feeAmount;
  const rate = getWithdrawRate();
  return {
    method,
    grossEP,
    feeAmount,
    feePct: normalizedFeePct,
    netEp,
    netNGN: epToNGN(netEp, rate),
    netUSD: epToUSD(netEp),
  };
}

export function epToNGN(epAmount, ngnRate = null) {
  const rate = ngnRate && ngnRate >= 100 ? ngnRate : getWithdrawRate();
  return Math.round((parseFloat(epAmount) / 100) * rate);
}

export function epToUSD(epAmount) {
  return parseFloat((parseFloat(epAmount) / 100).toFixed(4));
}

export async function queueWithdrawal({ userId, epAmount, method, fields, pin = null, idempotencyKey }) {
  const amount = Number(epAmount);
  if (!Number.isSafeInteger(amount)) throw new Error("Enter a whole EP amount.");
  const usdAmount = amount / 100;
  return await initiateWithdrawal({ userId, usdAmount, method, fields, pin, idempotencyKey });
}

export async function refreshWithdrawRate() {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "paywall_config")
    .maybeSingle();
  if (error) throw new Error(`Could not load withdrawal exchange rate: ${error.message}`);
  const configuredRate = Number(data?.value?.ngn_rate);
  if (!Number.isFinite(configuredRate) || configuredRate < 100 || configuredRate > 1_000_000) {
    throw new Error("Withdrawal exchange rate is unavailable.");
  }
  _ngnRate = configuredRate;
  return _ngnRate;
}

export function getWithdrawRate() {
  return _ngnRate || 1366;
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
    case "paypal":
      return "Crypto and PayPal withdrawals are not available yet.";
    default:
      return "Unknown withdrawal method";
  }
}

// ── Main withdrawal function ─────────────────────────────────────────────────
export async function initiateWithdrawal({
  userId,
  usdAmount,
  method,
  fields,
  pin = null,
  idempotencyKey,
}) {
  const amount = Number(usdAmount);
  const epAmount = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_USD || !Number.isSafeInteger(epAmount)) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_EP} EP`);
  }
  if (method !== "bank") {
    throw new Error("Only bank withdrawals are currently available.");
  }
  const destError = validateDestination(method, fields);
  if (destError) throw new Error(destError);

  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError) throw new Error(`Could not verify your account: ${sessionError.message}`);
  if (!sessionData.user || sessionData.user.id !== userId) {
    throw new Error("Your session does not match the withdrawal account.");
  }

  const destinationInfo = {
    method: "bank",
    bank: fields.bank.trim(),
    account_number: fields.accountNumber.trim(),
    account_name: fields.accountName.trim(),
    bank_code: fields.bankCode?.trim() || null,
  };
  const requestKey = idempotencyKey || crypto.randomUUID();
  const { data, error } = await supabase.rpc("initiate_direct_withdrawal", {
    p_idempotency_key: requestKey,
    p_ep_amount: epAmount,
    p_destination_info: destinationInfo,
    p_pin: pin || null,
  });
  if (error) throw new Error(error.message || "Withdrawal request failed.");
  if (!data?.success) throw new Error(data?.error || "Withdrawal request was rejected.");

  let payoutWarning = null;
  let payoutStatus = data.status;
  let refunded = data.refunded === true;
  const alreadyCreated = data.already_created === true;
  if (refunded) payoutStatus = "failed";
  const shouldInitiatePayout = !refunded && (!alreadyCreated || data.payout_state === "ready");
  if (alreadyCreated && !refunded && !shouldInitiatePayout) {
    if (["initiating", "reconciliation_required"].includes(data.payout_state)) {
      payoutWarning = "Payout status is being reconciled. Your balance remains reserved.";
    } else if (payoutStatus !== "completed" && data.payout_state !== "submitted" && data.payout_state !== "settled") {
      payoutWarning = "The existing withdrawal was not resubmitted. Check its current payout status.";
    }
  }
  if (shouldInitiatePayout) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "withdraw-paystack-init",
        { body: { withdrawal_id: data.id } },
      );
      if (fnError) {
        payoutWarning = fnData?.error || fnError.message || "Payout initiation is delayed; your withdrawal is recorded.";
      } else if (!fnData?.success) {
        payoutWarning = fnData?.error || "Payout initiation is delayed; your withdrawal is recorded.";
      }
      if (["processing", "completed", "failed"].includes(fnData?.withdrawal_status)) {
        payoutStatus = fnData.withdrawal_status;
      }
      if (fnData?.refunded === true) {
        refunded = true;
        payoutStatus = "failed";
      }
    } catch (e) {
      payoutWarning = e instanceof Error
        ? `Payout initiation is delayed: ${e.message}`
        : "Payout initiation is delayed; your withdrawal is recorded.";
    }
  }

  const netEp = Number(data.net_ep);
  const rate = Number(data.ngn_rate) || getWithdrawRate();
  return {
    id: data.id,
    transactionId: data.transaction_id,
    status: payoutStatus,
    tier: data.processing_tier,
    grossEP: Number(data.ep_amount),
    feeEP: Number(data.fee_ep),
    feePct: Number(data.fee_pct),
    netEp,
    ngnRate: rate,
    netNGN: Number(data.net_ngn),
    netUSD: epToUSD(netEp),
    payoutWarning,
    refunded,
    message: refunded
      ? "Payout failed; your EP has been returned."
      : payoutStatus === "completed"
        ? "Your bank payout is complete."
        : payoutStatus === "failed"
          ? "Your bank payout failed. Check its final refund status in withdrawal history."
      : payoutWarning
        ? "Your request is recorded and awaiting payout processing."
        : "Your bank payout is processing.",
    alreadyCreated,
    method,
  };
}

// ── Get withdrawal history ────────────────────────────────────────────────────
export async function getWithdrawalHistory(userId, limit = 30) {
  const { data, error } = await supabase
    .from("withdrawal_queue")
    .select(`
      id, ep_amount, usd_amount, processing_tier, fee_pct, fee_ep, net_ep,
      status, destination_type, destination_info,
      ngn_rate, requested_at, estimated_at, processed_at,
      error_msg, metadata
    `)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map(row => ({
    ...row,
    netNGN: Math.round(
      (Number(row.net_ep) / 100) *
      (Number.isFinite(Number(row.ngn_rate)) && Number(row.ngn_rate) >= 100
        ? Number(row.ngn_rate)
        : getWithdrawRate())
    ),
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
export async function cancelWithdrawal() {
  throw new Error("Bank payouts are submitted immediately and cannot be cancelled online.");
}

export async function retryWithdrawalPayout(withdrawalId) {
  const { data, error } = await supabase.functions.invoke("withdraw-paystack-init", {
    body: { withdrawal_id: withdrawalId },
  });
  if (error) throw new Error(data?.error || error.message || "Could not retry payout initiation.");
  if (!data?.success) throw new Error(data?.error || "Payout is not ready to retry.");
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
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError) throw new Error(`Could not verify your account: ${sessionError.message}`);
  if (!sessionData.user || sessionData.user.id !== userId) {
    throw new Error("Your session does not match the withdrawal account.");
  }
  const { data: policy, error } = await supabase.rpc("get_withdrawal_policy");
  if (error) throw new Error(`Could not load withdrawal policy: ${error.message}`);
  const configuredRate = Number(policy?.ngn_rate);
  if (Number.isFinite(configuredRate) && configuredRate >= 100) _ngnRate = configuredRate;
  const preview = getWithdrawalPreview(Number(usdAmount) * 100, "bank", policy?.fee_pct);
  return preview
    ? { ...preview, rewardLevel: policy?.reward_level || tier || "none" }
    : null;
}

export async function getDailyWithdrawalUsage(userId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [{ data: policy, error: policyError }, { data, error }] = await Promise.all([
    supabase.rpc("get_withdrawal_policy"),
    supabase
      .from("withdrawal_queue")
      .select("ep_amount")
      .eq("user_id", userId)
      .not("status", "in", '("cancelled","failed")')
      .gte("requested_at", today.toISOString()),
  ]);
  if (policyError) throw new Error(`Could not load withdrawal policy: ${policyError.message}`);
  if (error) throw new Error(`Could not load withdrawal history: ${error.message}`);

  const configuredRate = Number(policy?.ngn_rate);
  if (Number.isFinite(configuredRate) && configuredRate >= 100) _ngnRate = configuredRate;
  const limit = Number(policy?.daily_limit_ep);
  const maxPerRequest = Number(policy?.max_per_request_ep);
  const feePct = Number(policy?.fee_pct);
  if (!Number.isFinite(limit) || limit <= 0 ||
      !Number.isFinite(maxPerRequest) || maxPerRequest < 0 ||
      !Number.isFinite(feePct) || feePct < 0 || feePct > 25) {
    throw new Error("Withdrawal policy returned invalid limits or fees.");
  }
  const used = (data || []).reduce((sum, row) => sum + Number(row.ep_amount || 0), 0);
  return {
    used,
    remaining: Math.max(0, limit - used),
    limit,
    pct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
    rewardLevel: policy?.reward_level || "none",
    eligible: policy?.eligible === true,
    maxPerRequest,
    feePct,
    ngnRate: Number(policy?.ngn_rate),
  };
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
  retryWithdrawalPayout,
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
