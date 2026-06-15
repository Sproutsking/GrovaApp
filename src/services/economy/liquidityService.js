// src/services/economy/liquidityService.js
// ════════════════════════════════════════════════════════════════════════════
// Xeevia Liquidity Service — EP Economy Health Monitor
//
// PURPOSE:
//   Tracks the health of the EP withdrawal pool in real-time.
//   Drives the system-state banner in WithdrawTab and gates withdrawal
//   behaviour across the platform (batching, fee adjustments, alerts).
//
// SYSTEM STATES:
//   healthy   — Liquidity ratio >= 0.60. All tiers process on schedule.
//   warning   — Ratio 0.30–0.59. Tier 1 may be delayed; Tier 2/3 normal.
//   critical  — Ratio < 0.30. All withdrawals batched until recovery.
//
// ARCHITECTURE:
//   • Reads from `liquidity_snapshots` Supabase table (append-only log).
//   • Real-time Postgres subscription pushes state changes instantly.
//   • In-memory cache avoids redundant DB reads within the same session.
//   • Polling fallback activates if the Realtime channel errors out.
//   • Admin helpers: setSystemState(), recordSnapshot() for cron jobs.
//
// DB TABLE SCHEMA (run once in Supabase SQL editor):
// ─────────────────────────────────────────────────────────────────────────────
//   CREATE TABLE IF NOT EXISTS liquidity_snapshots (
//     id                BIGSERIAL PRIMARY KEY,
//     system_state      TEXT NOT NULL DEFAULT 'healthy'
//                         CHECK (system_state IN ('healthy','warning','critical')),
//     liquidity_ratio   NUMERIC(6,4),        -- 0.0000 – 1.0000
//     pool_balance_ep   NUMERIC(18,4),        -- current EP pool balance
//     pending_ep        NUMERIC(18,4),        -- total EP queued for withdrawal
//     total_supply_ep   NUMERIC(18,4),        -- total EP in circulation
//     notes             TEXT,
//     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
//   -- Index for fast "latest snapshot" queries
//   CREATE INDEX IF NOT EXISTS idx_liq_snaps_created
//     ON liquidity_snapshots (created_at DESC);
//
//   -- RLS: only service role can INSERT; anon/auth can SELECT
//   ALTER TABLE liquidity_snapshots ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "public read" ON liquidity_snapshots
//     FOR SELECT USING (true);
//   CREATE POLICY "service insert" ON liquidity_snapshots
//     FOR INSERT WITH CHECK (auth.role() = 'service_role');
// ─────────────────────────────────────────────────────────────────────────────
//
// EXPORTS:
//   SYSTEM_STATE_CONFIG   — display config for each state (color, copy, icon)
//   LIQUIDITY_THRESHOLDS  — numeric thresholds used to derive state from ratio
//   deriveStateFromRatio  — standalone helper
//   liquidityService      — default export (all service methods)
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────
export const LIQUIDITY_THRESHOLDS = {
  HEALTHY: 0.6, // ratio >= 0.60 → healthy
  WARNING: 0.3, // ratio 0.30–0.59 → warning
  // ratio < 0.30 → critical
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM STATE DISPLAY CONFIG
// Consumed by StateBanner in WithdrawTab and any other system-state UI.
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
      "Low liquidity — withdrawals are batched and will release automatically on recovery",
    icon: "🚨",
    color: "#f87171",
    bg: "rgba(248,113,113,0.06)",
    border: "rgba(248,113,113,0.22)",
    tierImpact: {
      1: "Batched — awaiting recovery",
      2: "Batched — awaiting recovery",
      3: "May still process — subject to available pool",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE
// Prevents redundant DB reads when multiple components mount simultaneously.
// ─────────────────────────────────────────────────────────────────────────────
const _cache = {
  snapshot: null,
  fetchedAt: 0,
  ttlMs: 30_000, // re-fetch after 30 s even without a realtime push
};

function _isCacheValid() {
  return (
    _cache.snapshot !== null && Date.now() - _cache.fetchedAt < _cache.ttlMs
  );
}

function _setCache(snapshot) {
  _cache.snapshot = snapshot;
  _cache.fetchedAt = Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a raw DB row into a safe typed object. */
function _normalise(row) {
  if (!row) return null;
  const valid = ["healthy", "warning", "critical"];
  return {
    ...row,
    system_state: valid.includes(row.system_state)
      ? row.system_state
      : "healthy",
    liquidity_ratio:
      row.liquidity_ratio != null ? Number(row.liquidity_ratio) : null,
    pool_balance_ep:
      row.pool_balance_ep != null ? Number(row.pool_balance_ep) : null,
    pending_ep: row.pending_ep != null ? Number(row.pending_ep) : null,
    total_supply_ep:
      row.total_supply_ep != null ? Number(row.total_supply_ep) : null,
  };
}

/**
 * Derive system state from a raw liquidity ratio.
 * Exported as a standalone so cron jobs / edge functions can use it
 * without importing the full service.
 */
export function deriveStateFromRatio(ratio) {
  const r = parseFloat(ratio) || 0;
  if (r >= LIQUIDITY_THRESHOLDS.HEALTHY) return "healthy";
  if (r >= LIQUIDITY_THRESHOLDS.WARNING) return "warning";
  return "critical";
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING FALLBACK
// Activates when the Realtime channel reports CHANNEL_ERROR.
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
      const snap = await liquidityService.getLatestSnapshot({
        forceRefresh: true,
      });
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
  // ── READ ──────────────────────────────────────────────────────────────────

  /**
   * Fetch the most recent liquidity snapshot.
   *
   * Results are cached for `_cache.ttlMs` ms to prevent redundant reads.
   * Returns null (never throws) — callers fall back to "healthy" state.
   *
   * @param {{ forceRefresh?: boolean }} [opts]
   * @returns {Promise<{
   *   system_state:    "healthy"|"warning"|"critical",
   *   liquidity_ratio: number|null,
   *   pool_balance_ep: number|null,
   *   pending_ep:      number|null,
   *   total_supply_ep: number|null,
   *   created_at:      string,
   * } | null>}
   */
  async getLatestSnapshot({ forceRefresh = false } = {}) {
    if (!forceRefresh && _isCacheValid()) {
      return _cache.snapshot;
    }

    try {
      const { data, error } = await supabase
        .from("liquidity_snapshots")
        .select(
          "id,system_state,liquidity_ratio,pool_balance_ep,pending_ep,total_supply_ep,notes,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // Table doesn't exist yet — not an error during initial deploy
        if (error.code === "42P01") {
          console.info(
            "[liquidityService] liquidity_snapshots table not found — defaulting to healthy",
          );
        } else {
          console.warn("[liquidityService] getLatestSnapshot:", error.message);
        }
        return null;
      }

      const snap = _normalise(data);
      if (snap) _setCache(snap);
      return snap;
    } catch (err) {
      console.warn("[liquidityService] getLatestSnapshot threw:", err?.message);
      return null;
    }
  },

  /**
   * Quick helper: get only the state string.
   * Falls back to "healthy" — UI never breaks.
   *
   * @returns {Promise<"healthy"|"warning"|"critical">}
   */
  async getSystemState() {
    const snap = await this.getLatestSnapshot();
    return snap?.system_state ?? "healthy";
  },

  /**
   * Fetch the last N snapshots — used by admin dashboards / charts.
   *
   * @param {number} [limit=50]
   * @returns {Promise<Array>}
   */
  async getHistory(limit = 50) {
    try {
      const { data, error } = await supabase
        .from("liquidity_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[liquidityService] getHistory:", error.message);
        return [];
      }
      return (data || []).map(_normalise).filter(Boolean);
    } catch (err) {
      console.warn("[liquidityService] getHistory threw:", err?.message);
      return [];
    }
  },

  // ── REALTIME ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to real-time liquidity state changes.
   *
   * • Immediately primes the callback with the current snapshot.
   * • Then fires on every INSERT/UPDATE to `liquidity_snapshots`.
   * • Falls back to 15-second polling if Realtime channel errors out.
   *
   * Usage in WithdrawTab:
   *   const unsub = liquidityService.subscribeLiquidity((snap) => {
   *     setSystemState(snap?.system_state ?? "healthy");
   *   });
   *   return unsub; // cleanup in useEffect
   *
   * @param {(snapshot: object|null) => void} callback
   * @returns {() => void} unsubscribe function
   */
  subscribeLiquidity(callback) {
    let destroyed = false;

    // Prime with current state immediately (non-blocking)
    this.getLatestSnapshot().then((snap) => {
      if (!destroyed && snap) callback(snap);
    });

    const channel = supabase
      .channel("liquidity_snapshots:monitor")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "liquidity_snapshots",
        },
        (payload) => {
          if (destroyed) return;
          const snap = _normalise(payload?.new ?? null);
          if (snap) {
            _setCache(snap);
            callback(snap);
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "[liquidityService] Realtime error — activating polling fallback",
          );
          _startPolling((snap) => {
            if (!destroyed) callback(snap);
          });
        } else if (status === "SUBSCRIBED") {
          _stopPolling(); // realtime is live, polling not needed
        }
      });

    return () => {
      destroyed = true;
      _stopPolling();
      supabase.removeChannel(channel);
    };
  },

  // ── WRITE (admin / server-side / edge functions) ──────────────────────────

  /**
   * Manually override the system state.
   * Inserts a new snapshot row — realtime propagates it to all clients.
   *
   * @param {"healthy"|"warning"|"critical"} state
   * @param {{
   *   liquidity_ratio?: number,
   *   pool_balance_ep?: number,
   *   pending_ep?:      number,
   *   total_supply_ep?: number,
   *   notes?:           string,
   * }} [meta]
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async setSystemState(state, meta = {}) {
    const valid = ["healthy", "warning", "critical"];
    if (!valid.includes(state)) {
      return { success: false, error: `Invalid state: "${state}"` };
    }

    try {
      const { error } = await supabase
        .from("liquidity_snapshots")
        .insert({ system_state: state, ...meta });

      if (error) {
        console.error("[liquidityService] setSystemState:", error.message);
        return { success: false, error: error.message };
      }

      // Bust cache so next read is fresh
      _cache.snapshot = null;
      _cache.fetchedAt = 0;
      return { success: true };
    } catch (err) {
      console.error("[liquidityService] setSystemState threw:", err?.message);
      return { success: false, error: err?.message };
    }
  },

  /**
   * Record a full computed snapshot from a cron job / edge function.
   * Automatically derives `system_state` from `liquidity_ratio` unless
   * explicitly provided.
   *
   * Example from a Supabase Edge Function:
   *   await liquidityService.recordSnapshot({
   *     pool_balance_ep: 4_200_000,
   *     pending_ep:      1_800_000,
   *     total_supply_ep: 10_000_000,
   *   });
   *   // → ratio = 4.2M / (4.2M + 1.8M) = 0.70 → "healthy"
   *
   * @param {{
   *   pool_balance_ep:  number,
   *   pending_ep:       number,
   *   total_supply_ep?: number,
   *   system_state?:    "healthy"|"warning"|"critical",
   *   notes?:           string,
   * }} data
   * @returns {Promise<{ success: boolean, state?: string, ratio?: number, error?: string }>}
   */
  async recordSnapshot(data) {
    const {
      pool_balance_ep,
      pending_ep,
      total_supply_ep,
      system_state: explicitState,
      notes,
    } = data;

    // ratio = pool / (pool + pending)
    const denom = (pool_balance_ep || 0) + (pending_ep || 0);
    const ratio = denom > 0 ? (pool_balance_ep || 0) / denom : 1;
    const state = explicitState || deriveStateFromRatio(ratio);

    const row = {
      system_state: state,
      liquidity_ratio: parseFloat(ratio.toFixed(4)),
      pool_balance_ep: pool_balance_ep ?? null,
      pending_ep: pending_ep ?? null,
      total_supply_ep: total_supply_ep ?? null,
      notes: notes ?? null,
    };

    try {
      const { error } = await supabase.from("liquidity_snapshots").insert(row);

      if (error) {
        console.error("[liquidityService] recordSnapshot:", error.message);
        return { success: false, error: error.message };
      }

      _cache.snapshot = null;
      _cache.fetchedAt = 0;
      return { success: true, state, ratio };
    } catch (err) {
      console.error("[liquidityService] recordSnapshot threw:", err?.message);
      return { success: false, error: err?.message };
    }
  },

  // ── BUSINESS LOGIC HELPERS ────────────────────────────────────────────────

  /**
   * Returns true if a withdrawal should be batched given the current state.
   * Tier 3 (10,001+ EP) bypasses batching in critical state — high-value
   * withdrawals are prioritised for platform trust and reputation.
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
   * Used to update the ETA shown in WithdrawTab when state degrades.
   *
   *   healthy  →  1x (base)
   *   warning  →  1.5x
   *   critical →  3x
   *
   * @param {"healthy"|"warning"|"critical"} state
   * @param {number} baseHours  — base hours from the tier definition
   * @returns {number}
   */
  adjustedProcessingHours(state, baseHours) {
    const multipliers = { healthy: 1, warning: 1.5, critical: 3 };
    return Math.ceil(baseHours * (multipliers[state] ?? 1));
  },

  /**
   * Invalidate the in-memory cache.
   * Call after a successful withdrawal submission so the next read is fresh.
   */
  bustCache() {
    _cache.snapshot = null;
    _cache.fetchedAt = 0;
  },

  // ── RE-EXPORTS ─────────────────────────────────────────────────────────────
  deriveStateFromRatio,
  SYSTEM_STATE_CONFIG,
  LIQUIDITY_THRESHOLDS,
};

export default liquidityService;
