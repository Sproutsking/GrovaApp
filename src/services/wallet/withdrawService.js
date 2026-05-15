// src/services/wallet/withdrawService.js
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL SERVICE — Complete Implementation
//
// Handles all three withdrawal methods:
//   1. PAYSTACK  — Bank transfer via Paystack Transfer API
//   2. CRYPTO    — On-chain withdrawal queue (manual broadcast)
//   3. PAYPAL    — PayPal payout queue (manual disbursement)
//
// ECONOMY:
//   1 USD = 100 EP  →  EP ÷ 100 = USD
//   1 USD = NGN_RATE (live)
//
// WITHDRAWAL TIERS (mirrors epService.js):
//   Tier 1: 100–1,000 EP  →  4% fee, ~72h
//   Tier 2: 1,001–10,000  →  3% fee, ~24h
//   Tier 3: 10,001+        →  2% fee, ~2h
//
// FLOW:
//   1. Client calls queueWithdrawal()
//   2. This calls the Supabase RPC queue_withdrawal
//   3. RPC debits wallet atomically, inserts withdrawal_queue row
//   4. For Paystack: edge fn triggered by DB webhook or cron
//   5. For crypto/PayPal: admin processes from dashboard
//
// SECURITY:
//   - Amount validated server-side via RPC
//   - Destination info encrypted at rest (handled by RLS)
//   - Rate limiting via check_withdrawal_rate_limit RPC
//   - PIN verification for amounts >= PIN_REQUIRED_THRESHOLD
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import { computeWithdrawalFee } from "./epService";
import { getLiveUSDNGN, getCachedUSDNGN } from "./depositFundService";

// ── Constants ─────────────────────────────────────────────────────────────────
export const MIN_WITHDRAWAL_EP  = 100;
export const PIN_REQUIRED_EP    = 500;      // PIN required at or above this
export const MAX_DAILY_EP       = 50_000;   // Daily limit per user
export const WITHDRAWAL_METHODS = ["bank", "crypto", "paypal"];
export const DEFAULT_NGN_RATE   = 1500;     // Fallback if live rate unavailable

// ── Live rate cache ───────────────────────────────────────────────────────────
// FIX: getCachedUSDNGN() may return null/undefined/0 on startup — always
// fall back to DEFAULT_NGN_RATE so epToNGN never silently returns 0.
let _ngnRate = getCachedUSDNGN() || DEFAULT_NGN_RATE;

export async function refreshWithdrawRate() {
  try {
    const live = await getLiveUSDNGN();
    if (live && live >= 100) _ngnRate = live;
  } catch {
    // Keep last good cached value
  }
  return _ngnRate;
}

export function getWithdrawRate() {
  return _ngnRate || DEFAULT_NGN_RATE;
}

// ── EP → NGN conversion ───────────────────────────────────────────────────────
export function epToNGN(epAmount, ngnRate = null) {
  const rate = (ngnRate && ngnRate >= 100) ? ngnRate : getWithdrawRate();
  const usd  = parseFloat(epAmount) / 100;   // 100 EP = $1
  return Math.round(usd * rate);             // $1 × rate = NGN
}

// ── EP → USD conversion ──────────────────────────────────────────────────────
export function epToUSD(epAmount) {
  return parseFloat((parseFloat(epAmount) / 100).toFixed(4));
}

// ── Fee preview ───────────────────────────────────────────────────────────────
export function getWithdrawalPreview(epAmount, method = "bank", ngnRate = null) {
  const amount = parseFloat(epAmount) || 0;
  if (amount <= 0) return null;

  const fee = computeWithdrawalFee(amount);
  if (!fee) return null;

  const rate   = (ngnRate && ngnRate >= 100) ? ngnRate : getWithdrawRate();
  const netNGN = epToNGN(fee.netEp, rate);
  const netUSD = epToUSD(fee.netEp);

  return {
    ...fee,
    method,
    grossEP: amount,
    ngnRate: rate,
    netNGN,
    netUSD,
    display: {
      gross:  `${amount.toLocaleString()} EP`,
      fee:    `${fee.feeAmount} EP (${fee.feePct}%)`,
      net:    `${fee.netEp.toLocaleString()} EP`,
      netNGN: method === "bank"  ? `₦${netNGN.toLocaleString()}` : null,
      netUSD: method !== "bank"  ? `$${netUSD.toFixed(2)} USD`   : null,
      time:   fee.estimatedHours >= 24
                ? `~${fee.estimatedHours / 24}d`
                : `~${fee.estimatedHours}h`,
    },
  };
}

// ── Validate destination fields ───────────────────────────────────────────────
export function validateDestination(method, fields) {
  switch (method) {
    case "bank":
      if (!fields.bank?.trim())           return "Please enter your bank name";
      if (!fields.accountNumber?.trim())  return "Please enter your account number";
      if (!fields.accountName?.trim())    return "Please enter your account name";
      if (!/^\d{10}$/.test(fields.accountNumber.trim())) {
        return "Account number must be 10 digits (NUBAN)";
      }
      return null;

    case "crypto":
      if (!fields.network?.trim())        return "Please enter the network / chain";
      if (!fields.token?.trim())          return "Please enter the token (USDT, ETH…)";
      if (!fields.walletAddress?.trim())  return "Please enter your wallet address";
      if (fields.walletAddress.trim().length < 10) return "Wallet address too short";
      return null;

    case "paypal":
      if (!fields.email?.trim())          return "Please enter your PayPal email";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
        return "Please enter a valid PayPal email address";
      }
      return null;

    default:
      return "Unknown withdrawal method";
  }
}

// ── Main queue function ───────────────────────────────────────────────────────
// Calls queue_withdrawal RPC which:
//   1. Validates balance
//   2. Debits wallet atomically
//   3. Inserts withdrawal_queue row
//   4. Returns { success, id, tier, net_ep, system_state, estimated_at }
export async function queueWithdrawal({ userId, epAmount, method, fields, pin = null }) {
  const amount = parseFloat(epAmount) || 0;

  if (amount < MIN_WITHDRAWAL_EP) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_EP} EP`);
  }

  const destError = validateDestination(method, fields);
  if (destError) throw new Error(destError);

  const fee = computeWithdrawalFee(amount);
  if (!fee) throw new Error("Could not compute withdrawal fee");

  // Get live rate for metadata
  const ngnRate = await refreshWithdrawRate();

  // Build sanitized destination info
  let destinationInfo = {};
  switch (method) {
    case "bank":
      destinationInfo = {
        bank:           fields.bank.trim(),
        account_number: fields.accountNumber.trim(),
        account_name:   fields.accountName.trim(),
        bank_code:      fields.bankCode?.trim() || null,
      };
      break;
    case "crypto":
      destinationInfo = {
        network:        fields.network.trim(),
        token:          fields.token.trim().toUpperCase(),
        wallet_address: fields.walletAddress.trim(),
        memo:           fields.memo?.trim() || null,
      };
      break;
    case "paypal":
      destinationInfo = {
        email:     fields.email.trim().toLowerCase(),
        full_name: fields.fullName?.trim() || null,
      };
      break;
  }

  const { data, error } = await supabase.rpc("queue_withdrawal", {
    p_user_id:          userId,
    p_ep_amount:        amount,
    p_destination_type: method,
    p_destination_info: destinationInfo,
    p_pin:              pin || null,
    p_ngn_rate:         ngnRate,
  });

  if (error)                   throw new Error(error.message || "Withdrawal failed");
  if (data?.success === false)  throw new Error(data?.error  || "Withdrawal rejected by server");

  const preview = getWithdrawalPreview(amount, method, ngnRate);

  return {
    id:          data?.id,
    tier:        data?.tier        || fee.tier,
    netEp:       data?.net_ep      || fee.netEp,
    netNGN:      epToNGN(data?.net_ep || fee.netEp, ngnRate),
    netUSD:      epToUSD(data?.net_ep || fee.netEp),
    systemState: data?.system_state || "healthy",
    estimatedAt: data?.estimated_at,
    batched:     data?.batched     === true,
    preview,
    method,
    reference:   data?.reference   || null,
  };
}

// ── Fetch withdrawal history ──────────────────────────────────────────────────
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

// ── Subscribe to withdrawal updates ──────────────────────────────────────────
export function subscribeToWithdrawals(userId, onUpdate) {
  const ch = supabase
    .channel(`withdrawal_live:${userId}`)
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "withdrawal_queue",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(ch);
}

// ── Cancel a queued withdrawal ────────────────────────────────────────────────
// Only allowed if status = "queued" or "batched"
export async function cancelWithdrawal(withdrawalId, userId) {
  const { data, error } = await supabase.rpc("cancel_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_user_id:       userId,
  });
  if (error)                   throw new Error(error.message || "Cancel failed");
  if (data?.success === false)  throw new Error(data?.error  || "Cannot cancel this withdrawal");
  return data;
}

// ── Check PIN requirement ─────────────────────────────────────────────────────
export function requiresPin(epAmount) {
  return parseFloat(epAmount) >= PIN_REQUIRED_EP;
}

// ── Verify withdrawal PIN ─────────────────────────────────────────────────────
export async function verifyWithdrawalPin(userId, pin) {
  const { data, error } = await supabase.rpc("verify_withdrawal_pin", {
    p_user_id: userId,
    p_pin:     pin,
  });
  if (error)         throw new Error(error.message || "PIN verification failed");
  if (!data?.success) throw new Error(data?.error   || "Incorrect PIN");
  return true;
}

// ── Get daily withdrawal usage ────────────────────────────────────────────────
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
  queueWithdrawal,
  getWithdrawalHistory,
  subscribeToWithdrawals,
  cancelWithdrawal,
  requiresPin,
  verifyWithdrawalPin,
  getDailyWithdrawalUsage,
  getWithdrawalPreview,
  validateDestination,
  epToNGN,
  epToUSD,
  getWithdrawRate,
  refreshWithdrawRate,
  MIN_WITHDRAWAL_EP,
  PIN_REQUIRED_EP,
  MAX_DAILY_EP,
  DEFAULT_NGN_RATE,
};