// src/services/economy/liquidityService.js
// ════════════════════════════════════════════════════════════════════════════
// Xeevia Liquidity Service — EP Economy Health Monitor & Withdrawal Engine
// ════════════════════════════════════════════════════════════════════════════
//
// CORE PRINCIPLE (confirmed business rule):
//   Every EP in circulation must be backed by a real cash deposit.
//   EP is minted 1:1 against completed payments at the rate EP_PER_USD (100).
//   available_liquidity_ep tracks cumulative backed EP minus EP actually
//   paid out on withdrawal (net of the platform fee burn). It is NOT a
//   percentage skim of revenue. ep_treasury_config's reserve_pct/
//   operations_pct/etc. is a SEPARATE concern — it governs how the
//   platform's own revenue (commissions, transaction fees) is split
//   internally — and is intentionally untouched by this service.
//
// KEY FORMULAS:
//   outstanding_ep         = SUM(profiles.engagement_points)
//                             — total liability if every user withdrew now
//   available_liquidity_ep = SUM(ep_transactions.amount WHERE type='purchase_grant')
//                             − SUM(net_ep paid out via completed withdrawals)
//                             + SUM(liquidity_injections.ep_amount)
//                             − SUM(refunded purchase_grant amounts)
//   liquidity_ratio         = available_liquidity_ep / outstanding_ep
//
// WHY THE RATIO MOVES:
//   • purchase_grant (deposit) → neutral (both sides rise together)
//   • invite_grant / bonus_grant (unbacked EP) → ratio drops (outstanding
//     rises, reserve doesn't)
//   • withdrawal → ratio drops slightly (reserve pays out net_ep, which is
//     less than the gross EP removed from outstanding, so the burn softens
//     but does not reverse the drop)
//   • admin injection → ratio rises (reserve rises, outstanding unchanged)
//     — this is explicitly UNBACKED unless the admin records a matching
//     real-world transfer separately; the UI must say so clearly.
//
// WITHDRAWAL TIERS (confirmed business rule):
//   Gated by profiles.reward_level, NOT subscription_tier.
//   At EP_PER_USD = 100 (1 USD = 100 EP):
//     none    → not eligible to withdraw
//     silver  → up to $1,000  =  100,000 EP per request, processing_tier 1
//     gold    → up to $10,000 = 1,000,000 EP per request, processing_tier 2
//     diamond → up to $50,000 = 5,000,000 EP per request, processing_tier 3
//   Platform fee: flat 2% on every withdrawal, BURNED (destroyed, not
//   routed to treasury) — for ecosystem stability. net_ep = ep_amount * 0.98.
//
// SYSTEM STATES (driven by liquidity_ratio, thresholds configurable):
//   healthy   — ratio >= warning_threshold (default 0.30)
//   warning   — critical_threshold <= ratio < warning_threshold (default 0.15–0.30)
//   critical  — ratio < critical_threshold (default 0.15). Tier 1/2
//               withdrawals are batched until recovery; Tier 3 still
//               processes (high-value, protects platform trust).
//
// REQUIRED SCHEMA: see schema.sql shipped alongside this service —
//   liquidity_config, withdrawal_queue, liquidity_snapshots (extended),
//   liquidity_injections. All additive; no existing tables are modified.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — fallbacks only. Real values always come from liquidity_config;
// these are used only if the config row is ever unreachable (defensive).
// ─────────────────────────────────────────────────────────────────────────────
export const LIQUIDITY_THRESHOLDS = {
  HEALTHY: 0.3, // ratio >= 0.30 → healthy (matches default warning_threshold)
  WARNING: 0.15, // ratio 0.15–0.29 → warning (matches default critical_threshold)
  // ratio < 0.15 → critical
};

const FALLBACK_CONFIG = {
  ep_per_usd: 100,
  platform_fee_pct: 2,
  silver_max_usd: 1000,
  gold_max_usd: 10000,
  diamond_max_usd: 50000,
  warning_threshold: 0.3,
  critical_threshold: 0.15,
};

const REWARD_LEVEL_TIER = { none: 0, silver: 1, gold: 2, diamond: 3 };

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM STATE DISPLAY CONFIG
// Consumed by StateBanner in LiquiditySection.jsx and WithdrawTab.
// ─────────────────────────────────────────────────────────────────────────────
export const SYSTEM_STATE_CONFIG = {
  healthy: {
    label: "Healthy",
    description: "All systems operational — withdrawals processing on schedule",
    icon: "✅",
    color: "#34d399",
    bg: "rgba(52,211,153,0.06)",
    border: "rgba(52,211,153,0.20)",
    tierImpact: {
      1: "Normal — ~72h",
      2: "Normal — ~24h",
      3: "Normal — ~2h",
    },
  },
  warning: {
    label: "Warning",
    description: "Elevated withdrawal demand — Tier 1 may experience delays",
    icon: "⚠️",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.06)",
    border: "rgba(251,191,36,0.20)",
    tierImpact: {
      1: "Delayed — up to 5 days",
      2: "Slight delay — ~36h",
      3: "Priority — ~4h",
    },
  },
  critical: {
    label: "Critical",
    description:
      "Low liquidity — Tier 1/2 withdrawals are batched and will release automatically on recovery. Tier 3 continues processing.",
    icon: "🚨",
    color: "#f87171",
    bg: "rgba(248,113,113,0.06)",
    border: "rgba(248,113,113,0.22)",
    tierImpact: {
      1: "Batched — awaiting recovery",
      2: "Batched — awaiting recovery",
      3: "Still processing — subject to available pool",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE — dashboard + config, short TTL to keep admin view fresh
// without hammering the DB on every render.
// ─────────────────────────────────────────────────────────────────────────────
const _cache = {
  config: null,
  configFetchedAt: 0,
  snapshot: null,
  snapshotFetchedAt: 0,
  ttlMs: 30_000,
};

function _isFresh(ts) {
  return ts > 0 && Date.now() - ts < _cache.ttlMs;
}

function _bustAllCache() {
  _cache.config = null;
  _cache.configFetchedAt = 0;
  _cache.snapshot = null;
  _cache.snapshotFetchedAt = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _normaliseSnapshot(row) {
  if (!row) return null;
  const valid = ["healthy", "warning", "critical"];
  return {
    ...row,
    system_state: valid.includes(row.system_state) ? row.system_state : "healthy",
    liquidity_ratio: row.liquidity_ratio != null ? Number(row.liquidity_ratio) : 0,
    outstanding_ep: row.outstanding_ep != null ? Number(row.outstanding_ep) : 0,
    available_liquidity_ep:
      row.available_liquidity_ep != null ? Number(row.available_liquidity_ep) : 0,
    net_flow_ep: row.net_flow_ep != null ? Number(row.net_flow_ep) : 0,
    withdrawal_velocity_24h:
      row.withdrawal_velocity_24h != null ? Number(row.withdrawal_velocity_24h) : 0,
    engagement_flow_24h:
      row.engagement_flow_24h != null ? Number(row.engagement_flow_24h) : 0,
    queue_length: row.queue_length != null ? Number(row.queue_length) : 0,
  };
}

/**
 * Derive system state from a raw liquidity ratio against given thresholds.
 * Exported standalone so cron jobs / edge functions can use it without
 * importing the full service.
 */
export function deriveStateFromRatio(ratio, thresholds = FALLBACK_CONFIG) {
  const r = parseFloat(ratio) || 0;
  const warning = thresholds.warning_threshold ?? FALLBACK_CONFIG.warning_threshold;
  const critical = thresholds.critical_threshold ?? FALLBACK_CONFIG.critical_threshold;
  if (r >= warning) return "healthy";
  if (r >= critical) return "warning";
  return "critical";
}

/**
 * Resolve a user's max withdrawal (in EP) and processing tier from their
 * reward_level, using live config. Returns null maxEp for 'none' (not
 * eligible).
 */
function _limitsForRewardLevel(rewardLevel, cfg) {
  const epPerUsd = Number(cfg.ep_per_usd) || FALLBACK_CONFIG.ep_per_usd;
  switch (rewardLevel) {
    case "silver":
      return {
        maxEp: Number(cfg.silver_max_usd ?? FALLBACK_CONFIG.silver_max_usd) * epPerUsd,
        tier: 1,
      };
    case "gold":
      return {
        maxEp: Number(cfg.gold_max_usd ?? FALLBACK_CONFIG.gold_max_usd) * epPerUsd,
        tier: 2,
      };
    case "diamond":
      return {
        maxEp: Number(cfg.diamond_max_usd ?? FALLBACK_CONFIG.diamond_max_usd) * epPerUsd,
        tier: 3,
      };
    default:
      return { maxEp: 0, tier: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING FALLBACK — activates when the Realtime channel reports CHANNEL_ERROR.
// ─────────────────────────────────────────────────────────────────────────────
let _pollInterval = null;

function _startPolling(onUpdate, intervalMs = 15_000) {
  if (_pollInterval) return;
  console.info(
    "[liquidityService] Realtime unavailable — polling every",
    intervalMs / 1000,
    "s",
  );
  _pollInterval = setInterval(async () => {
    try {
      const snap = await liquidityService.getLatestSnapshot({ forceRefresh: true });
      if (snap) onUpdate(snap);
    } catch {
      // silent — retry on next tick
    }
  }, intervalMs);
}

function _stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIQUIDITY SERVICE
// ─────────────────────────────────────────────────────────────────────────────
const liquidityService = {
  // ── CONFIG ───────────────────────────────────────────────────────────────

  /**
   * Fetch the singleton liquidity_config row. Falls back to hardcoded
   * defaults (never throws) so the UI always has numbers to render.
   */
  async getConfig({ forceRefresh = false } = {}) {
    if (!forceRefresh && _isFresh(_cache.configFetchedAt) && _cache.config) {
      return _cache.config;
    }
    try {
      const { data, error } = await supabase
        .from("liquidity_config")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();

      if (error || !data) {
        if (error) console.warn("[liquidityService] getConfig:", error.message);
        return { ...FALLBACK_CONFIG };
      }
      _cache.config = data;
      _cache.configFetchedAt = Date.now();
      return data;
    } catch (err) {
      console.warn("[liquidityService] getConfig threw:", err?.message);
      return { ...FALLBACK_CONFIG };
    }
  },

  /**
   * Update the liquidity_config singleton row (admin only — call from the
   * admin dashboard, which should be gated by permission checks upstream).
   */
  async updateLiquidityConfig(adminId, updates) {
    const allowedKeys = [
      "ep_per_usd",
      "platform_fee_pct",
      "silver_max_usd",
      "gold_max_usd",
      "diamond_max_usd",
      "warning_threshold",
      "critical_threshold",
    ];
    const payload = {};
    for (const key of allowedKeys) {
      if (updates[key] !== undefined && updates[key] !== null && !Number.isNaN(updates[key])) {
        payload[key] = Number(updates[key]);
      }
    }
    if (Object.keys(payload).length === 0) {
      throw new Error("No valid config fields provided.");
    }
    if (
      payload.critical_threshold !== undefined &&
      payload.warning_threshold !== undefined &&
      payload.critical_threshold >= payload.warning_threshold
    ) {
      throw new Error("Critical threshold must be lower than warning threshold.");
    }

    const { error } = await supabase
      .from("liquidity_config")
      .update({
        ...payload,
        updated_by: adminId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true);

    if (error) throw new Error(error.message);
    _bustAllCache();
    return { success: true };
  },

  // ── READ: CORE METRICS ───────────────────────────────────────────────────

  /**
   * Compute the live outstanding_ep (total EP liability across all users).
   */
  async getOutstandingEP() {
    try {
      const { data, error } = await supabase.rpc("sum_engagement_points");
      if (!error && data != null) return Number(data) || 0;
    } catch {
      // RPC may not exist — fall through to client-side aggregation
    }
    // Fallback: paginate profiles.engagement_points and sum client-side.
    // Acceptable for admin dashboard read frequency; for very large user
    // bases, prefer creating the sum_engagement_points() Postgres function
    // (SELECT COALESCE(SUM(engagement_points),0) FROM profiles WHERE deleted_at IS NULL)
    // for a single round trip.
    let total = 0;
    let from = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from("profiles")
        .select("engagement_points")
        .is("deleted_at", null)
        .range(from, from + pageSize - 1);
      if (error) {
        console.warn("[liquidityService] getOutstandingEP fallback:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      total += data.reduce((s, r) => s + (Number(r.engagement_points) || 0), 0);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return total;
  },

  /**
   * Compute the live available_liquidity_ep (reserve backing withdrawals).
   * = backed grants (purchase_grant) − net EP paid out on completed
   *   withdrawals + admin injections − refunded backed grants.
   */
  async getAvailableLiquidityEP() {
    try {
      const [
        { data: grants, error: grantsErr },
        { data: refunds, error: refundsErr },
        { data: completedWithdrawals, error: wErr },
        { data: injections, error: injErr },
      ] = await Promise.all([
        supabase.from("ep_transactions").select("amount").eq("type", "purchase_grant"),
        supabase.from("ep_transactions").select("amount").eq("type", "refund"),
        supabase.from("withdrawal_queue").select("net_ep").eq("status", "completed"),
        supabase.from("liquidity_injections").select("ep_amount"),
      ]);

      if (grantsErr) throw grantsErr;
      if (refundsErr) throw refundsErr;
      if (wErr) throw wErr;
      if (injErr) throw injErr;

      const sum = (arr, field) => (arr || []).reduce((s, r) => s + (Number(r[field]) || 0), 0);

      const backed = sum(grants, "amount");
      const refunded = sum(refunds, "amount"); // refunds reduce backing (the deposit is reversed)
      const paidOut = sum(completedWithdrawals, "net_ep");
      const injected = sum(injections, "ep_amount");

      return Math.max(0, backed - refunded - paidOut + injected);
    } catch (err) {
      console.warn("[liquidityService] getAvailableLiquidityEP:", err?.message);
      return 0;
    }
  },

  /**
   * Net flow over a trailing window (default 7 days): backed deposits minus
   * EP actually paid out via completed withdrawals, in EP.
   */
  async getNetFlowEP(days = 7) {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [{ data: grants, error: gErr }, { data: withdrawals, error: wErr }] =
        await Promise.all([
          supabase
            .from("ep_transactions")
            .select("amount")
            .eq("type", "purchase_grant")
            .gte("created_at", since),
          supabase
            .from("withdrawal_queue")
            .select("net_ep")
            .eq("status", "completed")
            .gte("completed_at", since),
        ]);
      if (gErr) throw gErr;
      if (wErr) throw wErr;
      const sum = (arr, field) => (arr || []).reduce((s, r) => s + (Number(r[field]) || 0), 0);
      return sum(grants, "amount") - sum(withdrawals, "net_ep");
    } catch (err) {
      console.warn("[liquidityService] getNetFlowEP:", err?.message);
      return 0;
    }
  },

  /**
   * EP withdrawn (net, actually paid out) in the trailing 24h.
   */
  async getWithdrawalVelocity24h() {
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("withdrawal_queue")
        .select("net_ep")
        .eq("status", "completed")
        .gte("completed_at", since);
      if (error) throw error;
      return (data || []).reduce((s, r) => s + (Number(r.net_ep) || 0), 0);
    } catch (err) {
      console.warn("[liquidityService] getWithdrawalVelocity24h:", err?.message);
      return 0;
    }
  },

  /**
   * EP spent on engagement actions (likes/comments/shares/unlocks) in the
   * trailing 24h — sourced from ep_transactions type='spend'.
   */
  async getEngagementFlow24h() {
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("ep_transactions")
        .select("amount")
        .eq("type", "spend")
        .gte("created_at", since);
      if (error) throw error;
      return (data || []).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
    } catch (err) {
      console.warn("[liquidityService] getEngagementFlow24h:", err?.message);
      return 0;
    }
  },

  /**
   * Current withdrawal_queue length (queued + batched, not yet completed).
   */
  async getQueueLength() {
    try {
      const { count, error } = await supabase
        .from("withdrawal_queue")
        .select("*", { count: "exact", head: true })
        .in("status", ["queued", "batched", "processing"]);
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.warn("[liquidityService] getQueueLength:", err?.message);
      return 0;
    }
  },

  /**
   * Compute a fresh, full snapshot object from live data WITHOUT writing it
   * to the DB. Used by getLiquidityDashboard() for an always-current view
   * even between recorded snapshots.
   */
  async computeLiveSnapshot() {
    const cfg = await this.getConfig();
    const [outstanding, available, netFlow, velocity, engagementFlow, queueLength] =
      await Promise.all([
        this.getOutstandingEP(),
        this.getAvailableLiquidityEP(),
        this.getNetFlowEP(7),
        this.getWithdrawalVelocity24h(),
        this.getEngagementFlow24h(),
        this.getQueueLength(),
      ]);

    const ratio = outstanding > 0 ? available / outstanding : 1;
    const state = deriveStateFromRatio(ratio, cfg);

    return _normaliseSnapshot({
      system_state: state,
      liquidity_ratio: ratio,
      outstanding_ep: outstanding,
      available_liquidity_ep: available,
      net_flow_ep: netFlow,
      withdrawal_velocity_24h: velocity,
      engagement_flow_24h: engagementFlow,
      queue_length: queueLength,
      snapshot_at: new Date().toISOString(),
    });
  },

  /**
   * Fetch the most recently RECORDED snapshot (from liquidity_snapshots).
   * Cached briefly. Returns null (never throws) — callers fall back to
   * "healthy" state.
   */
  async getLatestSnapshot({ forceRefresh = false } = {}) {
    if (!forceRefresh && _isFresh(_cache.snapshotFetchedAt) && _cache.snapshot) {
      return _cache.snapshot;
    }
    try {
      const { data, error } = await supabase
        .from("liquidity_snapshots")
        .select("*")
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === "42P01") {
          console.info(
            "[liquidityService] liquidity_snapshots table not found — defaulting to healthy",
          );
        } else {
          console.warn("[liquidityService] getLatestSnapshot:", error.message);
        }
        return null;
      }
      const snap = _normaliseSnapshot(data);
      if (snap) {
        _cache.snapshot = snap;
        _cache.snapshotFetchedAt = Date.now();
      }
      return snap;
    } catch (err) {
      console.warn("[liquidityService] getLatestSnapshot threw:", err?.message);
      return null;
    }
  },

  /**
   * Quick helper: get only the state string. Falls back to "healthy".
   */
  async getSystemState() {
    const snap = await this.getLatestSnapshot();
    return snap?.system_state ?? "healthy";
  },

  /**
   * Fetch recorded snapshot history for charts. `hours` filters by recency;
   * `limit` caps row count. Matches the signature LiquiditySection.jsx
   * actually calls: getSnapshotHistory({ hours, limit }).
   */
  async getSnapshotHistory({ hours = 24, limit = 48 } = {}) {
    try {
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("liquidity_snapshots")
        .select("*")
        .gte("snapshot_at", since)
        .order("snapshot_at", { ascending: true })
        .limit(limit);

      if (error) {
        console.warn("[liquidityService] getSnapshotHistory:", error.message);
        return [];
      }
      return (data || []).map(_normaliseSnapshot).filter(Boolean);
    } catch (err) {
      console.warn("[liquidityService] getSnapshotHistory threw:", err?.message);
      return [];
    }
  },

  /**
   * THE method LiquiditySection.jsx actually calls on mount.
   * Returns everything the admin UI needs in one shot:
   *   { snapshot, config, stateConfig }
   * `snapshot` is the live-computed view (always current), not just the
   * last recorded row — so the dashboard never looks stale between cron
   * snapshots.
   */
  async getLiquidityDashboard() {
    const [config, snapshot] = await Promise.all([
      this.getConfig(),
      this.computeLiveSnapshot(),
    ]);
    return {
      snapshot,
      config,
      stateConfig: SYSTEM_STATE_CONFIG[snapshot.system_state] || SYSTEM_STATE_CONFIG.healthy,
    };
  },

  // ── REALTIME ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to real-time liquidity state changes via the recorded
   * snapshots table. Primes immediately with the current live-computed
   * snapshot, then listens for new recorded rows (e.g. from a cron job or
   * admin-triggered snapshot). Falls back to polling if Realtime errors.
   *
   * @param {(snapshot: object|null) => void} callback
   * @returns {() => void} unsubscribe function
   */
  subscribeLiquidity(callback) {
    let destroyed = false;

    this.computeLiveSnapshot().then((snap) => {
      if (!destroyed && snap) callback(snap);
    });

    const channel = supabase
      .channel("liquidity_snapshots:monitor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "liquidity_snapshots" },
        (payload) => {
          if (destroyed) return;
          const snap = _normaliseSnapshot(payload?.new ?? null);
          if (snap) {
            _cache.snapshot = snap;
            _cache.snapshotFetchedAt = Date.now();
            callback(snap);
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[liquidityService] Realtime error — activating polling fallback");
          _startPolling((snap) => {
            if (!destroyed) callback(snap);
          });
        } else if (status === "SUBSCRIBED") {
          _stopPolling();
        }
      });

    return () => {
      destroyed = true;
      _stopPolling();
      supabase.removeChannel(channel);
    };
  },

  // ── WRITE: SNAPSHOTS ──────────────────────────────────────────────────────

  /**
   * Compute a live snapshot RIGHT NOW and persist it to liquidity_snapshots.
   * This is what the admin "Snapshot" button calls (triggerSnapshot).
   *
   * @param {string} adminId — who triggered it (for audit trail)
   */
  async triggerSnapshot(adminId) {
    const snap = await this.computeLiveSnapshot();
    const row = {
      system_state: snap.system_state,
      liquidity_ratio: parseFloat(snap.liquidity_ratio.toFixed(6)),
      outstanding_ep: snap.outstanding_ep,
      available_liquidity_ep: snap.available_liquidity_ep,
      net_flow_ep: snap.net_flow_ep,
      withdrawal_velocity_24h: snap.withdrawal_velocity_24h,
      engagement_flow_24h: snap.engagement_flow_24h,
      queue_length: snap.queue_length,
      taken_by: adminId || null,
    };

    const { data, error } = await supabase
      .from("liquidity_snapshots")
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);
    _bustAllCache();
    return _normaliseSnapshot(data);
  },

  /**
   * Record a snapshot from a cron job / edge function with pre-computed
   * figures (no live DB aggregation needed server-side if the caller
   * already has the numbers). Kept for backward compatibility with
   * existing automation.
   */
  async recordSnapshot(data) {
    const cfg = await this.getConfig();
    const {
      outstanding_ep = 0,
      available_liquidity_ep = 0,
      net_flow_ep = 0,
      withdrawal_velocity_24h = 0,
      engagement_flow_24h = 0,
      queue_length = 0,
      system_state: explicitState,
      notes,
      taken_by,
    } = data;

    const ratio = outstanding_ep > 0 ? available_liquidity_ep / outstanding_ep : 1;
    const state = explicitState || deriveStateFromRatio(ratio, cfg);

    const row = {
      system_state: state,
      liquidity_ratio: parseFloat(ratio.toFixed(6)),
      outstanding_ep,
      available_liquidity_ep,
      net_flow_ep,
      withdrawal_velocity_24h,
      engagement_flow_24h,
      queue_length,
      notes: notes ?? null,
      taken_by: taken_by ?? null,
    };

    try {
      const { error } = await supabase.from("liquidity_snapshots").insert(row);
      if (error) {
        console.error("[liquidityService] recordSnapshot:", error.message);
        return { success: false, error: error.message };
      }
      _bustAllCache();
      return { success: true, state, ratio };
    } catch (err) {
      console.error("[liquidityService] recordSnapshot threw:", err?.message);
      return { success: false, error: err?.message };
    }
  },

  // ── WRITE: ADMIN LIQUIDITY INJECTION ──────────────────────────────────────

  /**
   * Admin-initiated manual reserve top-up. This is explicitly UNBACKED
   * unless the admin has separately arranged a matching real-world
   * transfer — it directly raises available_liquidity_ep (and therefore
   * the ratio) without touching outstanding_ep.
   *
   * @param {{ adminId: string, epAmount: number, reason: string, notes?: string }} params
   */
  async injectLiquidity({ adminId, epAmount, reason, notes }) {
    const amount = Number(epAmount);
    if (!amount || amount <= 0) {
      throw new Error("Enter a valid EP amount to inject.");
    }
    if (!reason || !reason.trim()) {
      throw new Error("A reason is required for liquidity injections.");
    }
    if (!adminId) {
      throw new Error("Missing admin identity for this action.");
    }

    const { error } = await supabase.from("liquidity_injections").insert({
      admin_id: adminId,
      ep_amount: amount,
      reason,
      notes: notes ?? null,
    });

    if (error) throw new Error(error.message);
    _bustAllCache();
    return { success: true, amount };
  },

  // ── WRITE: WITHDRAWAL QUEUE ───────────────────────────────────────────────

  /**
   * Submit a withdrawal request on behalf of a user. Validates against
   * their reward_level limit, computes the 2% burn fee, derives the
   * processing tier, and — if the system is currently critical — batches
   * tier 1/2 requests immediately (tier 3 still queues normally).
   *
   * @param {{ userId: string, epAmount: number, destination?: string }} params
   */
  async requestWithdrawal({ userId, epAmount, destination }) {
    const amount = Number(epAmount);
    if (!amount || amount <= 0) {
      throw new Error("Enter a valid EP amount to withdraw.");
    }
    if (!userId) {
      throw new Error("Missing user identity for this withdrawal.");
    }

    const [cfg, { data: profile, error: profileErr }] = await Promise.all([
      this.getConfig(),
      supabase
        .from("profiles")
        .select("reward_level, engagement_points")
        .eq("id", userId)
        .single(),
    ]);
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) throw new Error("User profile not found.");

    const rewardLevel = profile.reward_level || "none";
    const { maxEp, tier } = _limitsForRewardLevel(rewardLevel, cfg);

    if (!tier) {
      throw new Error(
        "This account is not yet eligible to withdraw. Reach Silver reward level or higher first.",
      );
    }
    if (amount > maxEp) {
      throw new Error(
        `Amount exceeds your ${rewardLevel} limit of ${maxEp.toLocaleString()} EP per request.`,
      );
    }
    if (amount > Number(profile.engagement_points || 0)) {
      throw new Error("Insufficient EP balance for this withdrawal.");
    }

    const feePct = Number(cfg.platform_fee_pct ?? FALLBACK_CONFIG.platform_fee_pct) / 100;
    const feeEp = Math.round(amount * feePct * 100) / 100; // cents-equivalent precision
    const netEp = amount - feeEp;

    // Determine batching: critical state batches tier 1/2 immediately.
    const liveSnap = await this.computeLiveSnapshot();
    const shouldBatch = this.shouldBatch(liveSnap.system_state, tier);

    const { data, error } = await supabase
      .from("withdrawal_queue")
      .insert({
        user_id: userId,
        ep_amount: amount,
        fee_ep: feeEp,
        net_ep: netEp,
        reward_level_at_request: rewardLevel,
        processing_tier: tier,
        status: shouldBatch ? "batched" : "queued",
        destination: destination ?? null,
        batched_at: shouldBatch ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Admin action: release all currently-batched withdrawals back to the
   * normal queue (e.g. once liquidity has recovered). Matches what the
   * "Release Batched Withdrawals" button calls.
   */
  async releaseBatchedWithdrawals() {
    const { data, error } = await supabase
      .from("withdrawal_queue")
      .update({ status: "queued", released_at: new Date().toISOString() })
      .eq("status", "batched")
      .select("id");

    if (error) throw new Error(error.message);
    return { released: (data || []).length };
  },

  /**
   * Admin/worker action: mark a queued withdrawal as completed once the
   * payout has actually happened. This is what should debit
   * available_liquidity_ep (via getAvailableLiquidityEP's live aggregation
   * — no separate ledger mutation needed, since that function already
   * subtracts completed net_ep on every read).
   */
  async completeWithdrawal(withdrawalId, transactionId) {
    const { data, error } = await supabase
      .from("withdrawal_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        transaction_id: transactionId ?? null,
      })
      .eq("id", withdrawalId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    _bustAllCache();
    return data;
  },

  /**
   * Admin/worker action: mark a queued withdrawal as failed (e.g. payout
   * provider error), with a reason for the audit trail.
   */
  async failWithdrawal(withdrawalId, reason) {
    const { data, error } = await supabase
      .from("withdrawal_queue")
      .update({ status: "failed", failed_reason: reason || "Unknown error" })
      .eq("id", withdrawalId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // ── BUSINESS LOGIC HELPERS ────────────────────────────────────────────────

  /**
   * Returns true if a withdrawal should be batched given the current state.
   * Tier 3 (diamond, highest reward level) bypasses batching even in
   * critical state — high-value withdrawals are prioritised for platform
   * trust and reputation, per confirmed business rule.
   *
   * @param {"healthy"|"warning"|"critical"} state
   * @param {number} tier  1 | 2 | 3
   * @returns {boolean}
   */
  shouldBatch(state, tier) {
    return state === "critical" && tier < 3;
  },

  /**
   * Returns adjusted estimated processing hours based on system state.
   *   healthy  →  1x (base)
   *   warning  →  1.5x
   *   critical →  3x
   */
  adjustedProcessingHours(state, baseHours) {
    const multipliers = { healthy: 1, warning: 1.5, critical: 3 };
    return Math.ceil(baseHours * (multipliers[state] ?? 1));
  },

  /**
   * Resolve a user's withdrawal limit and tier from their reward_level.
   * Exposed for use in WithdrawTab to show the user their own limit.
   */
  async getUserWithdrawalLimit(rewardLevel) {
    const cfg = await this.getConfig();
    return _limitsForRewardLevel(rewardLevel, cfg);
  },

  /** Invalidate the in-memory cache. */
  bustCache() {
    _bustAllCache();
  },

  // ── RE-EXPORTS ─────────────────────────────────────────────────────────────
  deriveStateFromRatio,
  SYSTEM_STATE_CONFIG,
  LIQUIDITY_THRESHOLDS,
};

export default liquidityService;