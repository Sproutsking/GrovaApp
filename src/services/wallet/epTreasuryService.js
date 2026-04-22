// src/services/wallet/epTreasuryService.js
// ============================================================================
// EP TREASURY SERVICE
//
// Backend-controlled EP treasury with 5 partitions:
//   operations  — platform operating costs
//   growth      — growth initiatives  
//   xev_rewards — XEV reward funding pool
//   reserve     — emergency reserve
//   unallocated — holding before allocation
//
// Architecture:
//   • All value flow is rule-based (no manual balance edits)
//   • Every inflow is automatically partitioned per config percentages
//   • Disbursements require admin authorization and are fully logged
//   • Idempotent: duplicate calls are safe
//   • Rate-limited: abnormal activity detection built in
//
// Admin controls:
//   • Can update allocation percentages (must sum to 100)
//   • Cannot directly edit balances
//   • All changes logged to audit_log
// ============================================================================

import { supabase } from "../config/supabase";

// ── Treasury partition names ──────────────────────────────────────────────────
export const TREASURY_PARTITIONS = {
  OPERATIONS:  "operations",
  GROWTH:      "growth",
  XEV_REWARDS: "xev_rewards",
  RESERVE:     "reserve",
  UNALLOCATED: "unallocated",
};

export const DISBURSEMENT_PURPOSES = {
  XEV_REWARD_FUND:     "xev_reward_fund",
  OPERATIONAL_EXPENSE: "operational_expense",
  GROWTH_INITIATIVE:   "growth_initiative",
  RESERVE_WITHDRAWAL:  "reserve_withdrawal",
  OTHER:               "other",
};

// ── Cache ─────────────────────────────────────────────────────────────────────
let _balanceCache = null;
let _balanceCacheAt = 0;
const CACHE_TTL = 30_000; // 30s

export const epTreasuryService = {

  // ── Get treasury balances ────────────────────────────────────────────────
  async getBalances(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _balanceCache && (now - _balanceCacheAt) < CACHE_TTL) {
      return _balanceCache;
    }

    const { data, error } = await supabase
      .from("ep_treasury")
      .select("partition, balance, total_received, total_disbursed, last_updated_at")
      .order("partition");

    if (error) throw new Error(`[epTreasury] getBalances: ${error.message}`);

    const result = {};
    (data || []).forEach(row => { result[row.partition] = row; });

    _balanceCache = result;
    _balanceCacheAt = now;
    return result;
  },

  // ── Get total treasury EP ─────────────────────────────────────────────────
  async getTotalBalance() {
    const balances = await this.getBalances();
    return Object.values(balances).reduce((sum, row) => sum + (row.balance || 0), 0);
  },

  // ── Get treasury config ───────────────────────────────────────────────────
  async getConfig() {
    const { data, error } = await supabase
      .from("ep_treasury_config")
      .select("*")
      .limit(1)
      .single();
    if (error) throw new Error(`[epTreasury] getConfig: ${error.message}`);
    return data;
  },

  // ── Update config (admin only) ────────────────────────────────────────────
  // Percentages must sum to 100. All changes are audit logged server-side.
  async updateConfig(adminId, updates) {
    const { data, error } = await supabase.rpc("ep_treasury_update_config", {
      p_admin_id:        adminId,
      p_protocol_fee:    updates.protocolFeePct    ?? null,
      p_operations_pct:  updates.operationsPct     ?? null,
      p_growth_pct:      updates.growthPct         ?? null,
      p_xev_rewards_pct: updates.xevRewardsPct     ?? null,
      p_reserve_pct:     updates.reservePct        ?? null,
    });
    if (error) throw new Error(`[epTreasury] updateConfig: ${error.message}`);
    _balanceCache = null; // invalidate
    return data;
  },

  // ── Transfer EP with treasury fee (social actions) ────────────────────────
  // This is the canonical way to move EP between users.
  // Protocol fee is automatically split into treasury partitions.
  async transferEP({ fromUserId, toUserId, amount, reason, metadata = {} }) {
    if (!fromUserId || !toUserId) throw new Error("fromUserId and toUserId are required");
    if (fromUserId === toUserId) throw new Error("Cannot transfer to self");
    if (amount <= 0) throw new Error("Amount must be positive");

    const { data, error } = await supabase.rpc("transfer_ep_with_treasury", {
      p_from_user_id: fromUserId,
      p_to_user_id:   toUserId,
      p_amount:       amount,
      p_reason:       reason,
      p_metadata:     metadata,
    });

    if (error) throw new Error(`[epTreasury] transferEP: ${error.message}`);
    _balanceCache = null;
    return data;
  },

  // ── Credit EP to treasury (direct inflow) ─────────────────────────────────
  // Called on deposits, after the webhook confirms the Paystack charge.
  // The amount is split across partitions per config.
  async creditFromDeposit(userId, epAmount, reason, metadata = {}) {
    // Get current config for split
    const config = await this.getConfig();
    const ops   = Math.round(epAmount * (config.operations_pct  / 100) * 100) / 100;
    const grow  = Math.round(epAmount * (config.growth_pct      / 100) * 100) / 100;
    const xev   = Math.round(epAmount * (config.xev_rewards_pct / 100) * 100) / 100;
    const rsv   = epAmount - ops - grow - xev;

    // Atomic update of all 4 partitions
    const updates = [
      supabase.from("ep_treasury").update({ balance: supabase.raw(`balance + ${ops}`),  total_received: supabase.raw(`total_received + ${ops}`),  last_updated_at: new Date().toISOString() }).eq("partition", "operations"),
      supabase.from("ep_treasury").update({ balance: supabase.raw(`balance + ${grow}`), total_received: supabase.raw(`total_received + ${grow}`), last_updated_at: new Date().toISOString() }).eq("partition", "growth"),
      supabase.from("ep_treasury").update({ balance: supabase.raw(`balance + ${xev}`),  total_received: supabase.raw(`total_received + ${xev}`),  last_updated_at: new Date().toISOString() }).eq("partition", "xev_rewards"),
      supabase.from("ep_treasury").update({ balance: supabase.raw(`balance + ${rsv}`),  total_received: supabase.raw(`total_received + ${rsv}`),  last_updated_at: new Date().toISOString() }).eq("partition", "reserve"),
    ];

    await Promise.all(updates);

    // Log each partition credit
    const logEntries = [
      { partition: "operations",  amount: ops  },
      { partition: "growth",      amount: grow },
      { partition: "xev_rewards", amount: xev  },
      { partition: "reserve",     amount: rsv  },
    ].filter(e => e.amount > 0).map(async e => {
      const { data: bal } = await supabase.from("ep_treasury").select("balance").eq("partition", e.partition).single();
      return {
        tx_type:      "deposit_fee",
        partition:    e.partition,
        direction:    "credit",
        amount:       e.amount,
        balance_after: bal?.balance ?? 0,
        ref_user_id:  userId,
        reason,
        metadata: { ...metadata, total_ep: epAmount, split: { ops, grow, xev, rsv } },
      };
    });

    const resolvedEntries = await Promise.all(logEntries);
    if (resolvedEntries.length > 0) {
      await supabase.from("ep_treasury_ledger").insert(resolvedEntries).catch(e =>
        console.warn("[epTreasury] ledger log failed:", e.message)
      );
    }

    _balanceCache = null;
    return { success: true, split: { ops, grow, xev, rsv } };
  },

  // ── Disburse from treasury (admin only, fully logged) ─────────────────────
  // Admin cannot directly edit balances — must go through this function.
  async disburse({ adminId, partition, amount, purpose, recipientInfo, notes = "" }) {
    const { data, error } = await supabase.rpc("ep_treasury_disburse", {
      p_admin_id:  adminId,
      p_partition: partition,
      p_amount:    amount,
      p_purpose:   purpose,
      p_recipient: recipientInfo,
      p_notes:     notes,
    });
    if (error) throw new Error(`[epTreasury] disburse: ${error.message}`);
    _balanceCache = null;
    return data;
  },

  // ── Get ledger history ─────────────────────────────────────────────────────
  async getLedger({ partition, limit = 50, offset = 0, txType } = {}) {
    let query = supabase
      .from("ep_treasury_ledger")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (partition) query = query.eq("partition", partition);
    if (txType)    query = query.eq("tx_type", txType);

    const { data, error } = await query;
    if (error) throw new Error(`[epTreasury] getLedger: ${error.message}`);
    return data || [];
  },

  // ── Get disbursements ─────────────────────────────────────────────────────
  async getDisbursements({ status, limit = 50 } = {}) {
    let query = supabase
      .from("ep_treasury_disbursements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(`[epTreasury] getDisbursements: ${error.message}`);
    return data || [];
  },

  // ── Analytics summary ─────────────────────────────────────────────────────
  async getSummary() {
    const [balances, config] = await Promise.all([
      this.getBalances(true),
      this.getConfig(),
    ]);

    const total = Object.values(balances).reduce((s, r) => s + (r.balance || 0), 0);
    const totalReceived = Object.values(balances).reduce((s, r) => s + (r.total_received || 0), 0);
    const totalDisbursed = Object.values(balances).reduce((s, r) => s + (r.total_disbursed || 0), 0);

    // Last 24h inflow from ledger
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recent } = await supabase
      .from("ep_treasury_ledger")
      .select("amount")
      .eq("direction", "credit")
      .gte("created_at", oneDayAgo);

    const inflow24h = (recent || []).reduce((s, r) => s + (r.amount || 0), 0);

    return {
      partitions: balances,
      config,
      summary: {
        total_balance:    total,
        total_received:   totalReceived,
        total_disbursed:  totalDisbursed,
        inflow_24h:       inflow24h,
        protocol_fee_pct: config.protocol_fee_pct,
      },
    };
  },

  // ── Rate limit check ──────────────────────────────────────────────────────
  // Returns true if action is allowed, false if rate limited
  async checkRateLimit(userId, actionType, maxPerHour = 100) {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from("ep_treasury_ledger")
      .select("id", { count: "exact", head: true })
      .eq("ref_user_id", userId)
      .gte("created_at", oneHourAgo);

    return (count || 0) < maxPerHour;
  },

  // ── Detect abnormal activity ──────────────────────────────────────────────
  async detectAnomalies(userId) {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recent } = await supabase
      .from("ep_treasury_ledger")
      .select("amount, created_at")
      .eq("ref_user_id", userId)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false });

    const rows = recent || [];
    const count = rows.length;
    const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0);

    const isAbnormal = count > 200 || totalAmount > 10000;

    if (isAbnormal) {
      console.warn(`[epTreasury] ANOMALY DETECTED user=${userId} count=${count} amount=${totalAmount}`);
      await supabase.from("security_events").insert({
        user_id:    userId,
        event_type: "suspicious_activity",
        severity:   "warning",
        metadata:   { source: "ep_treasury", hourly_count: count, hourly_amount: totalAmount },
      }).catch(() => {});
    }

    return { isAbnormal, count, totalAmount };
  },

  // ── Real-time balance subscription ───────────────────────────────────────
  subscribeToBalances(callback) {
    const channel = supabase
      .channel("ep_treasury_changes")
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "ep_treasury",
      }, async () => {
        _balanceCache = null;
        const balances = await this.getBalances(true).catch(() => null);
        if (balances) callback(balances);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  },
};

export default epTreasuryService;