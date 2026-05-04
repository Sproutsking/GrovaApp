// src/components/Admin/sections/LiquiditySection.jsx
// ============================================================================
// ADMIN — LIQUIDITY ENGINE PANEL
//
// Full admin control surface for the Xeevia Liquidity Engine:
//   • Live system state badge (Healthy / Warning / Critical)
//   • Key metrics: ratio, outstanding EP, net flow, velocity, queue length
//   • 24h ratio sparkline chart (pure CSS + SVG)
//   • Fee tier configuration (tier1/2/3 fee %, thresholds)
//   • System state thresholds (warning / critical ratio)
//   • Liquidity injection form
//   • Release batched withdrawals button
//   • Snapshot history table (last 10)
//   • Real-time live subscription
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
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;
const fmtNum = (n) => Number(n || 0).toLocaleString();
function timeAgo(iso) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (d < 1) return "just now";
  if (d < 60) return `${d}m ago`;
  return `${Math.floor(d / 60)}h ago`;
}

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
      {/* Fill */}
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#sparkGrad)" />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last dot */}
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
      {/* State dot */}
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

      {/* Time */}
      <div style={{ fontSize: 11, color: C.muted, flexShrink: 0, width: 70 }}>
        {timeAgo(snap.snapshot_at)}
      </div>

      {/* Ratio bar */}
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

      {/* Net flow */}
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

      {/* Queue */}
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

  // Config edit state
  const [cfg, setCfg] = useState({});
  const [savingCfg, setSavingCfg] = useState(false);

  // Injection state
  const [injectAmt, setInjectAmt] = useState("");
  const [injectReason, setInjectReason] = useState("");
  const [injecting, setInjecting] = useState(false);

  // Batch release state
  const [releasing, setReleasing] = useState(false);

  // Queue stats
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
            .select("status,processing_tier,ep_amount");
          if (!data) return null;
          const queued = data.filter((r) => r.status === "queued").length;
          const batched = data.filter((r) => r.status === "batched").length;
          const totalEP = data
            .filter((r) => ["queued", "batched"].includes(r.status))
            .reduce((s, r) => s + Number(r.ep_amount || 0), 0);
          const byTier = { 1: 0, 2: 0, 3: 0 };
          data.forEach((r) => {
            if (byTier[r.processing_tier] !== undefined)
              byTier[r.processing_tier]++;
          });
          return { queued, batched, totalEP, byTier };
        })(),
      ]);

      setDashboard(dash);
      setHistory(hist);
      setQueueStats(qStats);

      // Initialise config edit state
      if (dash?.config) {
        setCfg({
          warning_threshold: dash.config.warning_threshold,
          critical_threshold: dash.config.critical_threshold,
          tier1_max_ep: dash.config.tier1_max_ep,
          tier2_max_ep: dash.config.tier2_max_ep,
          tier1_fee_pct: dash.config.tier1_fee_pct,
          tier2_fee_pct: dash.config.tier2_fee_pct,
          tier3_fee_pct: dash.config.tier3_fee_pct,
          ecosystem_fee_pct: dash.config.ecosystem_fee_pct,
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
          warning_threshold: parseFloat(cfg.warning_threshold),
          critical_threshold: parseFloat(cfg.critical_threshold),
          tier1_max_ep: parseFloat(cfg.tier1_max_ep),
          tier2_max_ep: parseFloat(cfg.tier2_max_ep),
          tier1_fee_pct: parseFloat(cfg.tier1_fee_pct),
          tier2_fee_pct: parseFloat(cfg.tier2_fee_pct),
          tier3_fee_pct: parseFloat(cfg.tier3_fee_pct),
          ecosystem_fee_pct: parseFloat(cfg.ecosystem_fee_pct),
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
      const { data, error } = await supabase
        .from("withdrawal_queue")
        .update({ status: "queued" })
        .eq("status", "batched")
        .select("id");

      if (error) throw new Error(error.message);
      showToast(
        `✓ Released ${(data || []).length} batched withdrawals to queue`,
      );
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
            {/* Live indicator */}
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
            Monitor EP liquidity health · Control withdrawal tiers · Inject
            liquidity
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

      {/* ── State banner ── */}
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
            sub="Available / Outstanding"
            color={stCfg.color}
          />
          <MetricCard
            icon={Zap}
            label="Outstanding EP"
            value={fmtEP(snap.outstanding_ep)}
            sub="All user wallets"
            color={C.info}
          />
          <MetricCard
            icon={TrendingUp}
            label="Net Flow (7d)"
            value={`${Number(snap.net_flow_ep) >= 0 ? "+" : ""}${fmtEP(snap.net_flow_ep)}`}
            sub="Deposits − Withdrawals"
            color={Number(snap.net_flow_ep) >= 0 ? C.success : C.danger}
          />
          <MetricCard
            icon={Activity}
            label="Withdrawal Vel."
            value={fmtEP(snap.withdrawal_velocity_24h)}
            sub="EP withdrawn / 24h"
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
          {/* Sparkline card */}
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
            {/* Threshold markers */}
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
                  label: "Healthy threshold",
                  val: dashboard?.config?.warning_threshold || 0.3,
                  color: C.success,
                },
                {
                  label: "Warning threshold",
                  val: dashboard?.config?.critical_threshold || 0.15,
                  color: C.warn,
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

          {/* Withdrawal queue breakdown */}
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
                  marginBottom: 14,
                }}
              >
                Withdrawal Queue
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                }}
              >
                {[
                  { label: "Queued", value: queueStats.queued, color: C.info },
                  {
                    label: "Batched",
                    value: queueStats.batched,
                    color: C.warn,
                  },
                  {
                    label: "Tier 1",
                    value: queueStats.byTier[1],
                    color: "#f87171",
                  },
                  {
                    label: "Tier 2",
                    value: queueStats.byTier[2],
                    color: "#fbbf24",
                  },
                  {
                    label: "Tier 3",
                    value: queueStats.byTier[3],
                    color: "#34d399",
                  },
                  {
                    label: "Total EP Pending",
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

              {/* Release batch button */}
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

          {/* Engagement flow */}
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
                likes/comments/shares. This EP stays in the ecosystem and
                supports liquidity. Net flow (7d):{" "}
                <strong
                  style={{
                    color: Number(snap.net_flow_ep) >= 0 ? C.success : C.danger,
                  }}
                >
                  {Number(snap.net_flow_ep) >= 0 ? "+" : ""}
                  {fmtEP(snap.net_flow_ep)} EP
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CONTROLS TAB
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "controls" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Fee config */}
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
              Fee Configuration
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 18 }}>
              Withdrawal tier fees and ecosystem fee
            </div>

            <ConfigField
              label="Ecosystem fee (all EP transactions)"
              value={cfg.ecosystem_fee_pct || ""}
              onChange={(v) => setCfg((p) => ({ ...p, ecosystem_fee_pct: v }))}
              suffix="%"
              note="Flat 2% recommended"
            />
            <div
              style={{ height: 1, background: "#1a1a1a", margin: "14px 0" }}
            />
            <ConfigField
              label="Tier 1 max EP (lower bound for Tier 2)"
              value={cfg.tier1_max_ep || ""}
              onChange={(v) => setCfg((p) => ({ ...p, tier1_max_ep: v }))}
              suffix="EP"
              note="Default: 1,000"
            />
            <ConfigField
              label="Tier 2 max EP (lower bound for Tier 3)"
              value={cfg.tier2_max_ep || ""}
              onChange={(v) => setCfg((p) => ({ ...p, tier2_max_ep: v }))}
              suffix="EP"
              note="Default: 10,000"
            />
            <div
              style={{ height: 1, background: "#1a1a1a", margin: "14px 0" }}
            />
            <ConfigField
              label="Tier 1 fee (100–1,000 EP) · Lowest priority"
              value={cfg.tier1_fee_pct || ""}
              onChange={(v) => setCfg((p) => ({ ...p, tier1_fee_pct: v }))}
              suffix="%"
              note="Default: 4%"
            />
            <ConfigField
              label="Tier 2 fee (1,001–10,000 EP) · Normal priority"
              value={cfg.tier2_fee_pct || ""}
              onChange={(v) => setCfg((p) => ({ ...p, tier2_fee_pct: v }))}
              suffix="%"
              note="Default: 3%"
            />
            <ConfigField
              label="Tier 3 fee (10,001+ EP) · Highest priority"
              value={cfg.tier3_fee_pct || ""}
              onChange={(v) => setCfg((p) => ({ ...p, tier3_fee_pct: v }))}
              suffix="%"
              note="Default: 2%"
            />
          </div>

          {/* Threshold config + inject */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Threshold config */}
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
                value={cfg.warning_threshold || ""}
                onChange={(v) =>
                  setCfg((p) => ({ ...p, warning_threshold: v }))
                }
                note="Default: 0.30 (30%)"
              />
              <ConfigField
                label="Critical threshold (ratio below → CRITICAL)"
                value={cfg.critical_threshold || ""}
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

            {/* Save button */}
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

            {/* Liquidity injection */}
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
                Credit EP to the reserve treasury. This increases
                available_liquidity_ep and improves the system state ratio.
              </div>

              <ConfigField
                label="EP Amount to inject"
                value={injectAmt}
                onChange={setInjectAmt}
                suffix="EP"
                note="Min 100 EP"
              />
              <div className="wd-field" style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.muted,
                    marginBottom: 6,
                  }}
                >
                  Reason / notes
                </div>
                <input
                  value={injectReason}
                  onChange={(e) => setInjectReason(e.target.value)}
                  placeholder="e.g. Liquidity rebalancing Q1…"
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
                disabled={injecting || !injectAmt}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 11,
                  border: "none",
                  background:
                    injecting || !injectAmt
                      ? "#1a1a1a"
                      : `linear-gradient(135deg, ${C.success}, #059669)`,
                  color: injecting || !injectAmt ? "#333" : "#001a0d",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: injecting || !injectAmt ? "not-allowed" : "pointer",
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
              {/* Column headers */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "8px 16px",
                  borderBottom: "1px solid #111",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#333",
                    textTransform: "uppercase",
                    width: 8,
                  }}
                />
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
              {history.slice(0, 50).map((snap, i) => (
                <HistoryRow key={snap.id || i} snap={snap} />
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
