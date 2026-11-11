// src/services/wallet/withdrawService.js
// ════════════════════════════════════════════════════════════════════════════
// Legacy withdrawal exports delegate new requests to withdrawServiceV2.
// Historical records remain readable; payout state changes use the atomic
// settlement flow.
// ════════════════════════════════════════════════════════════════════════════

import { supabase }                          from "../config/supabase";
import { computeWithdrawalFee }              from "./epService";
import { getLiveUSDNGN, getCachedUSDNGN }    from "./depositFundService";
import {
  queueWithdrawal as secureQueueWithdrawal,
  MIN_WITHDRAWAL_EP as SECURE_MIN_WITHDRAWAL_EP,
  PIN_REQUIRED_EP as SECURE_PIN_REQUIRED_EP,
} from "./withdrawServiceV2";

// ── Constants ─────────────────────────────────────────────────────────────────
export const MIN_WITHDRAWAL_EP  = SECURE_MIN_WITHDRAWAL_EP;
export const PIN_REQUIRED_EP    = SECURE_PIN_REQUIRED_EP;
export const MAX_DAILY_EP       = 50_000;
export const WITHDRAWAL_METHODS = ["bank"];
export const DEFAULT_NGN_RATE   = 1366;

// ── NGN rate cache ────────────────────────────────────────────────────────────
let _ngnRate = getCachedUSDNGN() || DEFAULT_NGN_RATE;

export async function refreshWithdrawRate() {
  try {
    const live = await getLiveUSDNGN();
    if (live && live >= 100) _ngnRate = live;
  } catch { /* keep cached */ }
  return _ngnRate;
}

export function getWithdrawRate() {
  return _ngnRate || DEFAULT_NGN_RATE;
}

// ── Conversions ───────────────────────────────────────────────────────────────
export function epToNGN(epAmount, ngnRate = null) {
  const rate = (ngnRate && ngnRate >= 100) ? ngnRate : getWithdrawRate();
  return Math.round((parseFloat(epAmount) / 100) * rate);
}

export function epToUSD(epAmount) {
  return parseFloat((parseFloat(epAmount) / 100).toFixed(4));
}

// ── Fee preview ───────────────────────────────────────────────────────────────
export function getWithdrawalPreview(epAmount, method = "bank", ngnRate = null) {
  const amount = parseFloat(epAmount) || 0;
  if (amount <= 0) return null;

  const fee = computeWithdrawalFee(amount);
  if (!fee) return null;

  const rate = (ngnRate && ngnRate >= 100) ? ngnRate : getWithdrawRate();

  return {
    ...fee,
    method,
    grossEP: amount,
    ngnRate: rate,
    netNGN:  epToNGN(fee.netEp, rate),
    netUSD:  epToUSD(fee.netEp),
  };
}

// ── Destination validation ────────────────────────────────────────────────────
export function validateDestination(method, fields) {
  switch (method) {
    case "bank":
      if (!fields.bank?.trim())          return "Please enter your bank name";
      if (!fields.accountNumber?.trim()) return "Please enter your account number";
      if (!fields.accountName?.trim())   return "Please enter your account name";
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

// ── Main queue + initiate function ────────────────────────────────────────────
export async function queueWithdrawal(params) {
  return secureQueueWithdrawal({
    ...params,
    idempotencyKey: params.idempotencyKey || crypto.randomUUID(),
  });
}

// ── History ───────────────────────────────────────────────────────────────────
export async function getWithdrawalHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from("withdrawal_queue")
    .select(`
      id, ep_amount, processing_tier, fee_pct, fee_amount, net_ep,
      status, destination_type, requested_at, estimated_at,
      processed_at, system_state_at_submit, error_msg, metadata
    `)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rate = getWithdrawRate();
  return (data || []).map(row => ({
    ...row,
    netNGN: epToNGN(row.net_ep, rate),
    netUSD: epToUSD(row.net_ep),
  }));
}

// ── Real-time subscription ────────────────────────────────────────────────────
export function subscribeToWithdrawals(userId, onUpdate) {
  const ch = supabase
    .channel(`withdrawal_live:${userId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "withdrawal_queue",
      filter: `user_id=eq.${userId}`,
    }, (payload) => { if (payload.new) onUpdate(payload.new); })
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── Cancel ────────────────────────────────────────────────────────────────────
export async function cancelWithdrawal() {
  throw new Error("Bank payouts are submitted immediately and cannot be cancelled online.");
}

// ── PIN ───────────────────────────────────────────────────────────────────────
export function requiresPin(epAmount) {
  return parseFloat(epAmount) >= PIN_REQUIRED_EP;
}

export async function verifyWithdrawalPin(userId, pin) {
  const { data, error } = await supabase.rpc("verify_withdrawal_pin", {
    p_user_id: userId, p_pin: pin,
  });
  if (error)          throw new Error(error.message || "PIN verification failed");
  if (!data?.success)  throw new Error(data?.error  || "Incorrect PIN");
  return true;
}

// ── Daily usage ───────────────────────────────────────────────────────────────
export async function getDailyWithdrawalUsage(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("withdrawal_queue")
    .select("ep_amount")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .neq("status", "failed")
    .gte("requested_at", today.toISOString());

  if (error) return { used: 0, remaining: MAX_DAILY_EP, limit: MAX_DAILY_EP, pct: 0 };

  const used = (data || []).reduce((s, r) => s + parseFloat(r.ep_amount || 0), 0);
  return {
    used,
    remaining: Math.max(0, MAX_DAILY_EP - used),
    limit:     MAX_DAILY_EP,
    pct:       Math.min(100, (used / MAX_DAILY_EP) * 100),
  };
}

export default {
  queueWithdrawal, getWithdrawalHistory, subscribeToWithdrawals,
  cancelWithdrawal, requiresPin, verifyWithdrawalPin, getDailyWithdrawalUsage,
  getWithdrawalPreview, validateDestination, epToNGN, epToUSD,
  getWithdrawRate, refreshWithdrawRate,
  MIN_WITHDRAWAL_EP, PIN_REQUIRED_EP, MAX_DAILY_EP, DEFAULT_NGN_RATE,
};