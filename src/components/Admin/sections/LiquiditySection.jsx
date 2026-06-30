// src/components/Admin/sections/LiquiditySection.jsx
// ============================================================================
// ADMIN — LIQUIDITY ENGINE PANEL  (v2 — rebuilt against real schema/rules)
//
// CHANGES vs v1:
//   • Controls tab fully replaced. The old per-tier fee model
//     (tier1/2/3_fee_pct, tier1/2_max_ep, ecosystem_fee_pct) does not match
//     the confirmed business rules and has been removed entirely:
//       - Platform fee is a SINGLE flat rate (default 2%), burned on every
//         withdrawal — not three separate tier fees.
//       - Withdrawal limits are gated by profiles.reward_level (silver/
//         gold/diamond), expressed in USD, converted to EP via the
//         ep_per_usd peg (default 100) — not raw EP cutoffs.
//   • Queue breakdown now labels tiers by their reward-level meaning
//     ("Tier 1 · Silver", "Tier 2 · Gold", "Tier 3 · Diamond") instead of
//     showing opaque tier numbers.
//   • Everything else (sparkline, metric cards, state banner, history,
//     injection form, snapshot/refresh buttons) is unchanged — those were
//     already correctly designed; only the data contract underneath them
//     was broken, which liquidityService.js v2 now fixes.
// ============================================================================
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Zap,
  Layers,
  Clock,
  DollarSign,
  BarChart3,
  Shield,
  Settings,
  ArrowUpToLine,
  Info,
} from "lucide-react";
import { C } from "../AdminUI.jsx";
import liquidityService, {
  SYSTEM_STATE_CONFIG,
} from "../../../services/economy/liquidityService";
import { supabase } from "../../../services/config/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtEP = (n) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtUSD = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;
const fmtNum = (n) => Number(n || 0).toLocaleString();
function timeAgo(iso) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (d < 1) return "just now";
  if (d < 60) return `${d}m ago`;
  return `${Math.floor(d / 60)}h ago`;
}

const TIER_LABELS = {
  1: "Tier 1 · Silver",
  2: "Tier 2 · Gold",
  3: "Tier 3 · Diamond",
};
const TIER_COLORS = { 1: "#f87171", 2: "#fbbf24", 3: "#34d399" };

// ── Sparkline chart ───────────────────────────────────────────────────────────
function Sparkline({ data, color, h = 48, w = 220 }) {
  if (!data || data.length < 2)
    return (
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontSize: 11,
        }}
      >
        Collecting data…
      </div>
    );

  const ratios = data.map((d) => Number(d.liquidity_ratio || 0));
  const min = Math.min(...ratios);
  const max = Math.max(...ratios, 0.01);
  const range = max - min || 0.01;

  const points = ratios
    .map((r, i) => {
      const x = (i / (ratios.length - 1)) * w;
      const y = h - ((r - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", height: h, overflow: "visible" }}
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#sparkGrad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={((ratios.length - 1) / (ratios.length - 1)) * w}
        cy={h - ((ratios[ratios.length - 1] - min) / range) * h}
        r="3"
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

// ── Stat metric card ──────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div
      style={{
        background: "#0f0f0f",
        border: `1px solid #1d1d1d`,
        borderRadius: 14,
        padding: "16px 16px 12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `${color}12`,
          border: `1px solid ${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Icon size={13} color={color} />
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: C.text,
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// ── State banner ──────────────────────────────────────────────────────────────
function StateBanner({ state }) {
  const cfg = SYSTEM_STATE_CONFIG[state] || SYSTEM_STATE_CONFIG.healthy;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderRadius: 16,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 10px ${cfg.color}`,
          animation: "liqPulse 2s ease infinite",
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>
          {cfg.icon} System {cfg.label}
        </div>
        <div
          style={{ fontSize: 11, color: cfg.color, opacity: 0.8, marginTop: 2 }}
        >
          {cfg.description}
        </div>
      </div>
      <div
        style={{
          padding: "4px 12px",
          borderRadius: 20,
          background: `${cfg.color}18`,
          border: `1px solid ${cfg.color}33`,
          fontSize: 10,
          fontWeight: 800,
          color: cfg.color,
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        {state}
      </div>
    </div>
  );
}

// ── Config field ──────────────────────────────────────────────────────────────
function ConfigField({
  label,
  value,
  onChange,
  type = "number",
  suffix = "",
  note,
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>
          {label}
        </span>
        {note && <span style={{ fontSize: 9, color: C.muted }}>{note}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            background: "#0c0c0c",
            border: "1px solid #252525",
            borderRadius: 9,
            padding: "9px 12px",
            color: C.text,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            transition: "border-color .15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = `${C.accent}44`)}
          onBlur={(e) => (e.target.style.borderColor = "#252525")}
        />
        {suffix && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.muted,
              flexShrink: 0,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({ snap }) {
  const state = snap.system_state || "healthy";
  const cfg = SYSTEM_STATE_CONFIG[state] || SYSTEM_STATE_CONFIG.healthy;
  const ratio = Number(snap.liquidity_ratio || 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 16px",
        borderBottom: "1px solid #0e0e0e",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.color}`,
        }}
      />
      <div style={{ fontSize: 11, color: C.muted, flexShrink: 0, width: 70 }}>
        {timeAgo(snap.snapshot_at)}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}>
            {(ratio * 100).toFixed(1)}%
          </span>
          <span style={{ fontSize: 9, color: C.muted }}>{state}</span>
        </div>
        <div
          style={{
            height: 4,
            background: "#1a1a1a",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, ratio * 100)}%`,
              background: cfg.color,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, fontSize: 11 }}>
        <div
          style={{
            color: Number(snap.net_flow_ep) >= 0 ? C.success : C.danger,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Number(snap.net_flow_ep) >= 0 ? "+" : ""}
          {fmtEP(snap.net_flow_ep)} EP
        </div>
        <div style={{ fontSize: 9, color: C.muted }}>net flow</div>
      </div>
      <div style={{ width: 36, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
          {snap.queue_length || 0}
        </div>
        <div style={{ fontSize: 8, color: C.muted }}>queue</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function LiquiditySection({ adminData }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState(null);

  // Config edit state — field names now match the REAL liquidity_config
  // schema: ep_per_usd, platform_fee_pct, silver/gold/diamond_max_usd,
  // warning_threshold, critical_threshold. No more tier1/2/3_fee_pct.
  const [cfg, setCfg] = useState({});
  const [savingCfg, setSavingCfg] = useState(false);

  const [injectAmt, setInjectAmt] = useState("");
  const [injectReason, setInjectReason] = useState("");
  const [injecting, setInjecting] = useState(false);

  const [releasing, setReleasing] = useState(false);

  const [queueStats, setQueueStats] = useState(null);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load dashboard ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, hist, qStats] = await Promise.all([
        liquidityService.getLiquidityDashboard(),
        liquidityService.getSnapshotHistory({ hours: 24, limit: 48 }),
        (async () => {
          const { data } = await supabase
            .from("withdrawal_queue")
            .select("status,processing_tier,net_ep");
          if (!data) return null;
          const queued = data.filter((r) => r.status === "queued").length;
          const batched = data.filter((r) => r.status === "batched").length;
          const totalEP = data
            .filter((r) => ["queued", "batched"].includes(r.status))
            .reduce((s, r) => s + Number(r.net_ep || 0), 0);
          const byTier = { 1: 0, 2: 0, 3: 0 };
          data.forEach((r) => {
            if (
              byTier[r.processing_tier] !== undefined &&
              ["queued", "batched"].includes(r.status)
            )
              byTier[r.processing_tier]++;
          });
          return { queued, batched, totalEP, byTier };
        })(),
      ]);

      setDashboard(dash);
      setHistory(hist);
      setQueueStats(qStats);

      // Initialise config edit state with the REAL field names
      if (dash?.config) {
        setCfg({
          ep_per_usd: dash.config.ep_per_usd,
          platform_fee_pct: dash.config.platform_fee_pct,
          silver_max_usd: dash.config.silver_max_usd,
          gold_max_usd: dash.config.gold_max_usd,
          diamond_max_usd: dash.config.diamond_max_usd,
          warning_threshold: dash.config.warning_threshold,
          critical_threshold: dash.config.critical_threshold,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = liquidityService.subscribeLiquidity((snap) => {
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              snapshot: snap,
              stateConfig: SYSTEM_STATE_CONFIG[snap.system_state],
            }
          : prev,
      );
      setHistory((prev) => [snap, ...prev.slice(0, 47)]);
    });
    return unsub;
  }, []);

  // ── Trigger snapshot ────────────────────────────────────────────────────────
  const handleSnapshot = async () => {
    try {
      await liquidityService.triggerSnapshot(
        adminData?.user_id || adminData?.id,
      );
      await load();
      showToast("✓ Snapshot recorded");
    } catch (e) {
      showToast(e.message, false);
    }
  };

  // ── Save config ─────────────────────────────────────────────────────────────
  const handleSaveCfg = async () => {
    setSavingCfg(true);
    try {
      await liquidityService.updateLiquidityConfig(
        adminData?.user_id || adminData?.id,
        {
          ep_per_usd: parseFloat(cfg.ep_per_usd),
          platform_fee_pct: parseFloat(cfg.platform_fee_pct),
          silver_max_usd: parseFloat(cfg.silver_max_usd),
          gold_max_usd: parseFloat(cfg.gold_max_usd),
          diamond_max_usd: parseFloat(cfg.diamond_max_usd),
          warning_threshold: parseFloat(cfg.warning_threshold),
          critical_threshold: parseFloat(cfg.critical_threshold),
        },
      );
      showToast("✓ Config saved");
      await load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setSavingCfg(false);
    }
  };

  // ── Inject liquidity ────────────────────────────────────────────────────────
  const handleInject = async () => {
    const amount = parseFloat(injectAmt);
    if (!amount || amount <= 0)
      return showToast("Enter a valid EP amount", false);
    setInjecting(true);
    try {
      await liquidityService.injectLiquidity({
        adminId: adminData?.user_id || adminData?.id,
        epAmount: amount,
        reason: injectReason || "admin_injection",
        notes: injectReason,
      });
      setInjectAmt("");
      setInjectReason("");
      showToast(
        `✓ Injected ${amount.toLocaleString()} EP into reserve treasury`,
      );
      await load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setInjecting(false);
    }
  };

  // ── Release batch ───────────────────────────────────────────────────────────
  const handleReleaseBatch = async () => {
    setReleasing(true);
    try {
      const { released } = await liquidityService.releaseBatchedWithdrawals();
      showToast(`✓ Released ${released} batched withdrawals to queue`);
      await load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setReleasing(false);
    }
  };

  // ── Snap ────────────────────────────────────────────────────────────────────
  const snap = dashboard?.snapshot;
  const state = snap?.system_state || "healthy";
  const stCfg = SYSTEM_STATE_CONFIG[state] || SYSTEM_STATE_CONFIG.healthy;
  const ratio = Number(snap?.liquidity_ratio || 0);
  const epPerUsd = Number(dashboard?.config?.ep_per_usd) || 100;

  // Live EP equivalents for the reward-level limits, recalculated as the
  // admin edits cfg fields so they see the EP impact immediately.
  const liveLimitsEP = {
    silver: (parseFloat(cfg.silver_max_usd) || 0) * (parseFloat(cfg.ep_per_usd) || epPerUsd),
    gold: (parseFloat(cfg.gold_max_usd) || 0) * (parseFloat(cfg.ep_per_usd) || epPerUsd),
    diamond: (parseFloat(cfg.diamond_max_usd) || 0) * (parseFloat(cfg.ep_per_usd) || epPerUsd),
  };

  const TABS = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "controls", label: "Controls", icon: "⚙️" },
    { id: "history", label: "History", icon: "📋" },
  ];

  return (
    <div>
      <style>{`
        @keyframes liqPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes liqFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${stCfg.color}18`,
                border: `1px solid ${stCfg.color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              💧
            </div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: C.text,
                margin: 0,
                letterSpacing: -0.5,
              }}
            >
              Liquidity Engine
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 8,
                background: `${C.accent}08`,
                border: `1px solid ${C.accent}18`,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: C.accent,
                  animation: "liqPulse 2s ease infinite",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: C.accent,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Live
              </span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Every EP is backed by real deposits · 1 USD = {epPerUsd} EP · Flat{" "}
            {fmtPct((dashboard?.config?.platform_fee_pct || 2) / 100)} burn fee
            on withdrawals
          </p>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button
            onClick={handleSnapshot}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 13px",
              borderRadius: 10,
              border: "1px solid #252525",
              background: "transparent",
              color: C.muted,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Activity size={12} /> Snapshot
          </button>
          <button
            onClick={load}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 13px",
              borderRadius: 10,
              border: "1px solid #252525",
              background: "transparent",
              color: C.muted,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 20,
            background: "rgba(248,113,113,.06)",
            border: "1px solid rgba(248,113,113,.2)",
            fontSize: 12,
            color: C.danger,
          }}
        >
          {error}
        </div>
      )}

      {!loading && (
        <div style={{ marginBottom: 20 }}>
          <StateBanner state={state} />
        </div>
      )}

      {/* ── Metrics grid ── */}
      {snap && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <MetricCard
            icon={BarChart3}
            label="Liquidity Ratio"
            value={`${(ratio * 100).toFixed(1)}%`}
            sub="Reserve / Outstanding EP"
            color={stCfg.color}
          />
          <MetricCard
            icon={Zap}
            label="Outstanding EP"
            value={fmtEP(snap.outstanding_ep)}
            sub={`≈ ${fmtUSD(snap.outstanding_ep / epPerUsd)} liability`}
            color={C.info}
          />
          <MetricCard
            icon={TrendingUp}
            label="Net Flow (7d)"
            value={`${Number(snap.net_flow_ep) >= 0 ? "+" : ""}${fmtEP(snap.net_flow_ep)}`}
            sub="Backed deposits − payouts"
            color={Number(snap.net_flow_ep) >= 0 ? C.success : C.danger}
          />
          <MetricCard
            icon={Activity}
            label="Withdrawal Vel."
            value={fmtEP(snap.withdrawal_velocity_24h)}
            sub="Net EP paid out / 24h"
            color={C.warn}
          />
          <MetricCard
            icon={Layers}
            label="Queue Length"
            value={fmtNum(snap.queue_length)}
            sub={`${queueStats?.batched || 0} batched`}
            color={snap.queue_length > 50 ? C.danger : C.accent}
          />
        </div>
      )}

      {/* ── Tabs ── */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid #1a1a1a",
          marginBottom: 20,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: "9px 9px 0 0",
              border: "none",
              borderBottom:
                activeTab === t.id
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
              background: "transparent",
              color: activeTab === t.id ? C.accent : C.muted,
              fontWeight: activeTab === t.id ? 800 : 600,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .15s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "#0f0f0f",
              border: "1px solid #1d1d1d",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                  Liquidity Ratio · Last 24h
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  {history.length} snapshots recorded
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontSize: 20, fontWeight: 900, color: stCfg.color }}
                >
                  {(ratio * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 9, color: C.muted }}>current</div>
              </div>
            </div>
            <Sparkline data={history} color={stCfg.color} />
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid #111",
              }}
            >
              {[
                {
                  label: "Warning below",
                  val: dashboard?.config?.warning_threshold ?? 0.3,
                  color: C.warn,
                },
                {
                  label: "Critical below",
                  val: dashboard?.config?.critical_threshold ?? 0.15,
                  color: C.danger,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 2,
                      background: m.color,
                      borderRadius: 1,
                    }}
                  />
                  <span style={{ fontSize: 10, color: C.muted }}>
                    {m.label}:{" "}
                    <strong style={{ color: m.color }}>
                      {(m.val * 100).toFixed(0)}%
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Withdrawal queue breakdown — now labeled by reward level */}
          {queueStats && (
            <div
              style={{
                background: "#0f0f0f",
                border: "1px solid #1d1d1d",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                Withdrawal Queue
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>
                Tier is derived from each user's reward level at request time
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {[1, 2, 3].map((tier) => (
                  <div
                    key={tier}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #141414",
                      borderRadius: 10,
                      padding: "10px 12px",
                      borderTop: `3px solid ${TIER_COLORS[tier]}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: 4,
                      }}
                    >
                      {TIER_LABELS[tier]}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: TIER_COLORS[tier],
                      }}
                    >
                      {queueStats.byTier[tier] || 0}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                {[
                  { label: "Queued", value: queueStats.queued, color: C.info },
                  { label: "Batched", value: queueStats.batched, color: C.warn },
                  {
                    label: "Net EP Pending",
                    value: fmtEP(queueStats.totalEP) + " EP",
                    color: C.accent,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #141414",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: 4,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{ fontSize: 16, fontWeight: 900, color: s.color }}
                    >
                      {typeof s.value === "number"
                        ? s.value.toLocaleString()
                        : s.value}
                    </div>
                  </div>
                ))}
              </div>

              {queueStats.batched > 0 && (
                <button
                  onClick={handleReleaseBatch}
                  disabled={releasing}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: "11px",
                    borderRadius: 11,
                    border: "none",
                    background: releasing
                      ? "#1a1a1a"
                      : `linear-gradient(135deg, ${C.warn}, #d97706)`,
                    color: releasing ? "#333" : "#0a0600",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: releasing ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <Layers size={13} />
                  {releasing
                    ? "Releasing…"
                    : `Release ${queueStats.batched} Batched Withdrawals`}
                </button>
              )}
            </div>
          )}

          {/* Engagement flow + backing explainer */}
          {snap && (
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(96,165,250,.04)",
                border: "1px solid rgba(96,165,250,.14)",
              }}
            >
              <Info
                size={14}
                color={C.info}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ fontSize: 11, color: "#3a5a7a", lineHeight: 1.7 }}>
                <strong style={{ color: C.info }}>
                  Engagement flow (24h):
                </strong>{" "}
                {fmtEP(snap.engagement_flow_24h)} EP spent on
                likes/comments/shares — stays in the ecosystem, doesn't draw
                on the reserve. Net flow (7d):{" "}
                <strong
                  style={{
                    color: Number(snap.net_flow_ep) >= 0 ? C.success : C.danger,
                  }}
                >
                  {Number(snap.net_flow_ep) >= 0 ? "+" : ""}
                  {fmtEP(snap.net_flow_ep)} EP
                </strong>{" "}
                · Every EP minted is backed by a real deposit — the ratio
                falls only when unbacked EP (bonuses, invite grants) is
                issued or withdrawals outpace new deposits.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CONTROLS TAB — rebuilt around the real model
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "controls" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Withdrawal limits + flat fee */}
          <div
            style={{
              background: "#0f0f0f",
              border: "1px solid #1d1d1d",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: C.text,
                marginBottom: 4,
              }}
            >
              Withdrawal Limits & Fee
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 18 }}>
              Limits are gated by reward level (silver/gold/diamond), not raw
              EP cutoffs. A single flat fee is burned on every withdrawal.
            </div>

            <ConfigField
              label="EP per USD (mint/redeem peg)"
              value={cfg.ep_per_usd ?? ""}
              onChange={(v) => setCfg((p) => ({ ...p, ep_per_usd: v }))}
              suffix="EP / $1"
              note="Default: 100"
            />
            <ConfigField
              label="Platform fee (burned, not routed to treasury)"
              value={cfg.platform_fee_pct ?? ""}
              onChange={(v) => setCfg((p) => ({ ...p, platform_fee_pct: v }))}
              suffix="%"
              note="Default: 2% flat, all tiers"
            />
            <div
              style={{ height: 1, background: "#1a1a1a", margin: "14px 0" }}
            />
            <ConfigField
              label="Silver max withdrawal (per request)"
              value={cfg.silver_max_usd ?? ""}
              onChange={(v) => setCfg((p) => ({ ...p, silver_max_usd: v }))}
              suffix="USD"
              note={`≈ ${fmtEP(liveLimitsEP.silver)} EP`}
            />
            <ConfigField
              label="Gold max withdrawal (per request)"
              value={cfg.gold_max_usd ?? ""}
              onChange={(v) => setCfg((p) => ({ ...p, gold_max_usd: v }))}
              suffix="USD"
              note={`≈ ${fmtEP(liveLimitsEP.gold)} EP`}
            />
            <ConfigField
              label="Diamond max withdrawal (per request)"
              value={cfg.diamond_max_usd ?? ""}
              onChange={(v) => setCfg((p) => ({ ...p, diamond_max_usd: v }))}
              suffix="USD"
              note={`≈ ${fmtEP(liveLimitsEP.diamond)} EP`}
            />

            <div
              style={{
                padding: "10px 13px",
                borderRadius: 10,
                background: "rgba(52,211,153,.04)",
                border: "1px solid rgba(52,211,153,.14)",
                fontSize: 10,
                color: "#5a8a72",
                lineHeight: 1.65,
                marginTop: 8,
              }}
            >
              <strong style={{ color: C.success }}>Diamond priority:</strong>{" "}
              Tier 3 (Diamond) withdrawals continue processing even during a
              Critical liquidity state — Tier 1/2 are batched until recovery.
            </div>
          </div>

          {/* Threshold config + inject */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "#0f0f0f",
                border: "1px solid #1d1d1d",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                State Thresholds
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 18 }}>
                Liquidity ratio thresholds for system state transitions
              </div>

              <ConfigField
                label="Warning threshold (ratio below → WARNING)"
                value={cfg.warning_threshold ?? ""}
                onChange={(v) =>
                  setCfg((p) => ({ ...p, warning_threshold: v }))
                }
                note="Default: 0.30 (30%)"
              />
              <ConfigField
                label="Critical threshold (ratio below → CRITICAL)"
                value={cfg.critical_threshold ?? ""}
                onChange={(v) =>
                  setCfg((p) => ({ ...p, critical_threshold: v }))
                }
                note="Default: 0.15 (15%)"
              />

              <div
                style={{
                  padding: "10px 13px",
                  borderRadius: 10,
                  background: "rgba(96,165,250,.04)",
                  border: "1px solid rgba(96,165,250,.14)",
                  fontSize: 10,
                  color: "#3a5a7a",
                  lineHeight: 1.65,
                  marginBottom: 16,
                }}
              >
                <strong style={{ color: C.info }}>Current ratio:</strong>{" "}
                {(ratio * 100).toFixed(1)}% → State:{" "}
                <strong style={{ color: stCfg.color }}>
                  {stCfg.icon} {state}
                </strong>
              </div>
            </div>

            <button
              onClick={handleSaveCfg}
              disabled={savingCfg}
              style={{
                padding: "13px",
                borderRadius: 12,
                border: "none",
                background: savingCfg
                  ? "#1a1a1a"
                  : `linear-gradient(135deg, ${C.accent}, #65a30d)`,
                color: savingCfg ? "#333" : "#051000",
                fontWeight: 800,
                fontSize: 13,
                cursor: savingCfg ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <Settings size={14} />
              {savingCfg ? "Saving…" : "Save Configuration"}
            </button>

            <div
              style={{
                background: "#0f0f0f",
                border: "1px solid #1d1d1d",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                💉 Inject Liquidity
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>
                Manually credits the reserve. This EP is unbacked unless you
                separately record a matching real-world transfer — use only
                for emergency stabilization.
              </div>

              <ConfigField
                label="EP Amount to inject"
                value={injectAmt}
                onChange={setInjectAmt}
                suffix="EP"
                note={`≈ ${fmtUSD((parseFloat(injectAmt) || 0) / epPerUsd)}`}
              />
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.muted,
                    marginBottom: 6,
                  }}
                >
                  Reason / notes (required)
                </div>
                <input
                  value={injectReason}
                  onChange={(e) => setInjectReason(e.target.value)}
                  placeholder="e.g. Emergency stabilization, Q1 promo backing…"
                  style={{
                    width: "100%",
                    background: "#0c0c0c",
                    border: "1px solid #252525",
                    borderRadius: 9,
                    padding: "9px 12px",
                    color: C.text,
                    fontSize: 12,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = `${C.accent}44`)
                  }
                  onBlur={(e) => (e.target.style.borderColor = "#252525")}
                />
              </div>

              <button
                onClick={handleInject}
                disabled={injecting || !injectAmt || !injectReason.trim()}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 11,
                  border: "none",
                  background:
                    injecting || !injectAmt || !injectReason.trim()
                      ? "#1a1a1a"
                      : `linear-gradient(135deg, ${C.success}, #059669)`,
                  color:
                    injecting || !injectAmt || !injectReason.trim()
                      ? "#333"
                      : "#001a0d",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor:
                    injecting || !injectAmt || !injectReason.trim()
                      ? "not-allowed"
                      : "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <Zap size={13} />
                {injecting ? "Injecting…" : "Inject Liquidity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HISTORY TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div
          style={{
            background: "#0f0f0f",
            border: "1px solid #1d1d1d",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #181818",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
              Snapshot History · Last 24h
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
              {Object.entries(SYSTEM_STATE_CONFIG).map(([key, val]) => (
                <span
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: val.color,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ color: C.muted }}>{val.label}</span>
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading…
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                No snapshots yet — click "Snapshot" to record one
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "8px 16px",
                  borderBottom: "1px solid #111",
                }}
              >
                <div style={{ width: 8 }} />
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#333",
                    textTransform: "uppercase",
                    width: 70,
                  }}
                >
                  TIME
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#333",
                    textTransform: "uppercase",
                    flex: 1,
                  }}
                >
                  RATIO
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#333",
                    textTransform: "uppercase",
                    width: 80,
                  }}
                >
                  NET FLOW
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#333",
                    textTransform: "uppercase",
                    width: 36,
                  }}
                >
                  QUEUE
                </div>
              </div>
              {history.slice(0, 50).map((s, i) => (
                <HistoryRow key={s.id || i} snap={s} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 10800,
            padding: "13px 20px",
            borderRadius: 14,
            background: toast.ok
              ? "rgba(52,211,153,.08)"
              : "rgba(248,113,113,.08)",
            border: `1px solid ${toast.ok ? "rgba(52,211,153,.3)" : "rgba(248,113,113,.3)"}`,
            fontSize: 12,
            fontWeight: 700,
            color: toast.ok ? C.success : C.danger,
            boxShadow: "0 8px 32px rgba(0,0,0,.7)",
            animation: "liqFadeUp .3s ease both",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: 380,
          }}
        >
          {toast.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}