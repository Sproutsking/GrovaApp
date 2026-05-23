// src/services/wallet/withdrawService.js
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL SERVICE
//
// KEY ARCHITECTURAL CHANGE vs previous versions:
//   For bank withdrawals, after the queue_withdrawal RPC succeeds, this
//   service immediately calls the withdraw-paystack-init edge function via
//   supabase.functions.invoke(). This means Paystack is called directly
//   from the client session — no pg_net DB config required, no ALTER DATABASE
//   setup, no separate cron needed.
//
//   The DB trigger (trg_paystack_init_on_insert) remains as a safety net for
//   batched withdrawals that get unblocked later by an admin.
//
// REQUIRED SETUP (once, in Supabase dashboard):
//   1. Deploy edge functions:
//      supabase functions deploy withdraw-paystack-init
//      supabase functions deploy withdraw-paystack-webhook
//   2. Set secret: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
//   3. Register webhook URL in Paystack Dashboard → Settings → Webhooks:
//      https://YOUR_REF.supabase.co/functions/v1/withdraw-paystack-webhook
//
// ECONOMY:  1 USD = 100 EP  |  1 USD = NGN_RATE (live)
// TIERS:    T1: 100-1k EP → 4% fee, ~72h
//           T2: 1k-10k EP → 3% fee, ~24h
//           T3: 10k+ EP   → 2% fee, ~2h
// ════════════════════════════════════════════════════════════════════════════

import { supabase }                          from "../config/supabase";
import { computeWithdrawalFee }              from "./epService";
import { getLiveUSDNGN, getCachedUSDNGN }    from "./depositFundService";

// ── Constants ─────────────────────────────────────────────────────────────────
export const MIN_WITHDRAWAL_EP  = 100;
export const PIN_REQUIRED_EP    = 500;
export const MAX_DAILY_EP       = 50_000;
export const WITHDRAWAL_METHODS = ["bank", "crypto", "paypal"];
export const DEFAULT_NGN_RATE   = 1500;

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
      if (!fields.network?.trim())       return "Please enter the network / chain";
      if (!fields.token?.trim())         return "Please enter the token";
      if (!fields.walletAddress?.trim()) return "Please enter your wallet address";
      if (fields.walletAddress.trim().length < 10) return "Wallet address too short";
      return null;
    case "paypal":
      if (!fields.email?.trim())         return "Please enter your PayPal email";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
        return "Please enter a valid PayPal email address";
      return null;
    default:
      return "Unknown withdrawal method";
  }
}

// ── Main queue + initiate function ────────────────────────────────────────────
export async function queueWithdrawal({ userId, epAmount, method, fields, pin = null }) {
  const amount = parseFloat(epAmount) || 0;

  if (amount < MIN_WITHDRAWAL_EP)
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_EP} EP`);

  const destError = validateDestination(method, fields);
  if (destError) throw new Error(destError);

  const fee = computeWithdrawalFee(amount);
  if (!fee) throw new Error("Could not compute withdrawal fee");

  const ngnRate = await refreshWithdrawRate();

  // Build sanitised destination info
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

  // ── Step 1: Atomic queue + EP debit via RPC ────────────────────────────────
  const { data, error } = await supabase.rpc("queue_withdrawal", {
    p_user_id:          userId,
    p_ep_amount:        amount,
    p_destination_type: method,
    p_destination_info: destinationInfo,
    p_pin:              pin || null,
    p_ngn_rate:         ngnRate,
  });

  if (error)                   throw new Error(error.message  || "Withdrawal failed");
  if (data?.success === false)  throw new Error(data?.error   || "Withdrawal rejected by server");

  const result = {
    id:          data?.id,
    tier:        data?.tier        || fee.tier,
    netEp:       data?.net_ep      || fee.netEp,
    netNGN:      epToNGN(data?.net_ep || fee.netEp, ngnRate),
    netUSD:      epToUSD(data?.net_ep || fee.netEp),
    systemState: data?.system_state || "healthy",
    estimatedAt: data?.estimated_at,
    batched:     data?.batched     === true,
    preview:     getWithdrawalPreview(amount, method, ngnRate),
    method,
  };

  // ── Step 2: Immediately call Paystack for bank withdrawals ─────────────────
  // This is the key fix: we call the edge function directly from the client
  // right after queuing. No pg_net DB config needed. The user's JWT is sent
  // automatically by supabase.functions.invoke().
  //
  // Skip if: method is not bank, or withdrawal was batched (system is critical
  // — Paystack won't be called until admin unblocks).
  if (method === "bank" && !result.batched && result.id) {
    try {
      const { error: fnError } = await supabase.functions.invoke(
        "withdraw-paystack-init",
        { body: { withdrawal_id: result.id } }
      );
      if (fnError) {
        // Non-fatal: the DB trigger will retry, or admin can process manually.
        // Log but don't throw — the withdrawal is safely queued and EP is debited.
        console.warn("[withdrawService] Paystack init warning:", fnError.message);
      }
    } catch (e) {
      // Also non-fatal: network error or function not yet deployed.
      // Withdrawal row exists with status = 'queued'. Admin can process it.
      console.warn("[withdrawService] Could not auto-initiate Paystack:", e);
    }
  }

  return result;
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
export async function cancelWithdrawal(withdrawalId, userId) {
  const { data, error } = await supabase.rpc("cancel_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_user_id:       userId,
  });
  if (error)                   throw new Error(error.message || "Cancel failed");
  if (data?.success === false)  throw new Error(data?.error  || "Cannot cancel this withdrawal");
  return data;
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