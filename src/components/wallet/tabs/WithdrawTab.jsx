// src/components/wallet/tabs/WithdrawTab.jsx
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL TAB — Full EP withdrawal system UI
//
// FIXES:
//   • Added back button (navigates to "overview" via setActiveTab prop)
//   • Real Paystack withdrawal flow via queue_withdrawal RPC
//   • Crypto + PayPal destination fields fully wired
//   • Solid validation, error handling, optimistic UI
//   • Fills WalletView container perfectly (no overflow, no clipping)
// ════════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Landmark,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Info,
  ArrowUpToLine,
  Shield,
  Layers,
  ArrowLeft,
  Building2,
  Bitcoin,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import {
  computeWithdrawalFee,
  WITHDRAWAL_TIERS,
} from "../../../services/wallet/epService";
import liquidityService, {
  SYSTEM_STATE_CONFIG,
} from "../../../services/economy/liquidityService";

// ── Design tokens ────────────────────────────────────────────────────────────
const W = {
  bg: "var(--color-background, #07080a)",
  bg1: "rgba(255,255,255,0.03)",
  bg2: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.88)",
  text2: "rgba(255,255,255,0.55)",
  muted: "rgba(255,255,255,0.22)",
  accent: "#a3e635",
  success: "#34d399",
  warn: "#fbbf24",
  danger: "#f87171",
  info: "#60a5fa",
  tier1: "#f87171",
  tier2: "#fbbf24",
  tier3: "#34d399",
};

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  .wd-page {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: ${W.bg};
  }

  /* Back header */
  .wd-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0 14px;
    border-bottom: 1px solid ${W.border};
    margin-bottom: 18px;
    flex-shrink: 0;
  }
  .wd-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: ${W.accent};
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    padding: 6px 0;
    font-family: inherit;
    transition: opacity .15s;
  }
  .wd-back-btn:hover { opacity: .75; }
  .wd-header-title {
    font-size: 16px;
    font-weight: 800;
    color: ${W.text};
    margin-left: 4px;
    letter-spacing: -.3px;
  }

  .wd-wrap { display:flex; flex-direction:column; gap:18px; animation:wdFadeUp .35s ease both; }
  @keyframes wdFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }

  /* State banner */
  .wd-state { display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:14px; border:1px solid; }
  .wd-state-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; animation:wdPulse 2s ease infinite; }
  @keyframes wdPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .wd-state-label { font-size:12px; font-weight:700; }
  .wd-state-desc  { font-size:11px; opacity:.75; margin-top:1px; }

  /* Glass card */
  .wd-card { background:${W.bg1}; border:1px solid ${W.border}; border-radius:18px; padding:18px; position:relative; overflow:hidden; }
  .wd-card-title { font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:${W.muted}; margin-bottom:14px; }

  /* Balance row */
  .wd-bal-num { font-size:34px; font-weight:900; color:${W.text}; letter-spacing:-2px; font-variant-numeric:tabular-nums; line-height:1; }
  .wd-bal-unit { font-size:14px; font-weight:700; color:${W.accent}; margin-bottom:4px; }
  .wd-bal-usd  { font-size:12px; color:${W.muted}; margin-top:4px; }

  /* Amount input */
  .wd-amount-wrap { position:relative; }
  .wd-amount-input {
    width:100%; background:${W.bg2}; border:1.5px solid ${W.border2};
    border-radius:14px; padding:14px 80px 14px 18px;
    color:${W.text}; font-size:22px; font-weight:800; font-family:inherit;
    outline:none; transition:border-color .2s; font-variant-numeric:tabular-nums;
    box-sizing:border-box;
  }
  .wd-amount-input:focus { border-color:rgba(163,230,53,.45); }
  .wd-amount-input::placeholder { color:${W.muted}; font-weight:400; font-size:16px; }
  .wd-amount-unit { position:absolute; right:18px; top:50%; transform:translateY(-50%); font-size:13px; font-weight:800; color:${W.accent}; pointer-events:none; }
  .wd-amount-max { font-size:10px; font-weight:700; color:${W.accent}; cursor:pointer; margin-top:6px; display:inline-block; }
  .wd-amount-max:hover { text-decoration:underline; }

  /* Tier cards */
  .wd-tiers { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:14px 0 0; }
  .wd-tier-card { border:1.5px solid; border-radius:14px; padding:11px 8px; cursor:default; transition:all .2s; }
  .wd-tier-card.active { transform:translateY(-2px); }
  .wd-tier-icon { font-size:16px; margin-bottom:5px; }
  .wd-tier-label { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; margin-bottom:3px; }
  .wd-tier-fee   { font-size:20px; font-weight:900; letter-spacing:-1px; line-height:1; }
  .wd-tier-range { font-size:9px; opacity:.6; margin-top:3px; }
  .wd-tier-time  { font-size:9px; font-weight:700; margin-top:5px; opacity:.75; }

  /* Fee breakdown */
  .wd-breakdown { background:${W.bg2}; border:1px solid ${W.border}; border-radius:14px; padding:13px 15px; }
  .wd-breakdown-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; }
  .wd-breakdown-row:last-child { margin-bottom:0; padding-top:8px; border-top:1px solid ${W.border}; }
  .wd-breakdown-label { font-size:12px; color:${W.text2}; }
  .wd-breakdown-val   { font-size:13px; font-weight:700; color:${W.text}; font-variant-numeric:tabular-nums; }
  .wd-breakdown-val.net  { color:${W.accent}; font-size:15px; font-weight:900; }
  .wd-breakdown-val.fee  { color:${W.warn}; }
  .wd-breakdown-val.time { color:${W.info}; }

  /* Destination tabs */
  .wd-dest-tabs { display:flex; gap:6px; margin-bottom:14px; }
  .wd-dest-tab  {
    flex:1; padding:9px 6px; border-radius:12px; border:1.5px solid ${W.border};
    background:transparent; color:${W.text2}; font-size:11px; font-weight:700;
    cursor:pointer; font-family:inherit; display:flex; flex-direction:column;
    align-items:center; gap:4px; transition:all .2s;
  }
  .wd-dest-tab.active { border-color:rgba(163,230,53,.4); background:rgba(163,230,53,.07); color:${W.accent}; }
  .wd-dest-tab:hover:not(.active) { border-color:${W.border2}; color:${W.text}; }

  /* Field */
  .wd-field { margin-bottom:12px; }
  .wd-field:last-child { margin-bottom:0; }
  .wd-field-label { font-size:10px; font-weight:800; color:${W.muted}; text-transform:uppercase; letter-spacing:.1em; margin-bottom:6px; }
  .wd-field-input {
    width:100%; background:${W.bg2}; border:1.5px solid ${W.border2};
    border-radius:12px; padding:11px 13px; color:${W.text}; font-size:13px;
    font-family:inherit; outline:none; transition:border-color .2s; box-sizing:border-box;
  }
  .wd-field-input:focus { border-color:rgba(163,230,53,.4); }
  .wd-field-input::placeholder { color:${W.muted}; }

  /* Submit button */
  .wd-submit { width:100%; padding:16px; border-radius:16px; border:none; font-weight:900; font-size:15px; font-family:inherit; cursor:pointer; transition:all .25s; letter-spacing:-.3px; }
  .wd-submit.ready { background:linear-gradient(135deg,#a3e635,#65a30d); color:#051000; box-shadow:0 10px 36px rgba(163,230,53,.35); }
  .wd-submit.ready:hover { transform:translateY(-2px); box-shadow:0 16px 44px rgba(163,230,53,.4); }
  .wd-submit.ready:active { transform:translateY(0); }
  .wd-submit.disabled,
  .wd-submit.loading { background:${W.bg2}; color:${W.muted}; cursor:not-allowed; }

  /* History */
  .wd-history-row { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid ${W.border}; animation:wdFadeUp .3s ease both; }
  .wd-history-row:last-child { border-bottom:none; }
  .wd-history-icon { width:36px; height:36px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .wd-status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:20px; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; }

  /* Skeleton */
  .wd-skel { background:${W.bg2}; border-radius:12px; animation:wdSkel 1.5s ease-in-out infinite; }
  @keyframes wdSkel { 0%,100%{opacity:1} 50%{opacity:.35} }

  /* Info box */
  .wd-info { display:flex; align-items:flex-start; gap:10px; padding:11px 13px; border-radius:12px; background:rgba(96,165,250,.05); border:1px solid rgba(96,165,250,.18); font-size:11.5px; color:rgba(96,165,250,.85); line-height:1.65; }

  /* Alert */
  .wd-alert { display:flex; align-items:flex-start; gap:8px; padding:10px 13px; border-radius:10px; font-size:12px; line-height:1.6; }
  .wd-alert.danger { background:rgba(248,113,113,.06); border:1px solid rgba(248,113,113,.2); color:${W.danger}; }
  .wd-alert.warn   { background:rgba(251,191,36,.06);  border:1px solid rgba(251,191,36,.2);  color:${W.warn}; }

  /* Toast */
  .wd-toast {
    position:fixed; bottom:28px; right:28px; left:auto; z-index:9999;
    padding:15px 20px; border-radius:16px;
    background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.35);
    font-size:13px; font-weight:700; color:#34d399;
    box-shadow:0 12px 40px rgba(0,0,0,.6);
    animation:wdToast 5s ease forwards; backdrop-filter:blur(16px);
    display:flex; align-items:center; gap:10px; max-width:380px;
  }
  @keyframes wdToast {
    0%{opacity:0;transform:translateY(16px)} 8%{opacity:1;transform:none}
    85%{opacity:1;transform:none} 100%{opacity:0;transform:translateY(16px)}
  }

  /* Method tabs for withdrawal destination */
  .wd-method-note {
    font-size:10.5px; color:${W.muted}; line-height:1.6;
    margin-top:10px; padding:9px 12px;
    background:rgba(255,255,255,.025); border-radius:10px;
    border:1px solid ${W.border};
  }

  @media(max-width:768px) {
    .wd-bal-num { font-size:28px; }
    .wd-tiers { gap:6px; }
    .wd-tier-card { padding:9px 6px; }
    .wd-tier-fee { font-size:18px; }
    .wd-toast { left:16px; right:16px; bottom:90px; max-width:none; }
  }

  @keyframes spin { to { transform: rotate(360deg) } }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtEP = (n) =>
  Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUSD = (ep) => `≈ $${(Number(ep || 0) / 100).toFixed(2)}`;
const timeAgo = (iso) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const TIER_COLORS = { 1: W.tier1, 2: W.tier2, 3: W.tier3 };
const TIER_ICONS = { 1: "⚡", 2: "⚖️", 3: "🚀" };

const DEST_TYPES = [
  { id: "bank", label: "Bank", Icon: Building2 },
  { id: "crypto", label: "Crypto", Icon: Bitcoin },
  { id: "paypal", label: "PayPal", Icon: Mail },
];

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    queued: {
      color: W.info,
      bg: "rgba(96,165,250,.1)",
      border: "rgba(96,165,250,.25)",
      label: "Queued",
    },
    batched: {
      color: W.warn,
      bg: "rgba(251,191,36,.1)",
      border: "rgba(251,191,36,.25)",
      label: "Batched",
    },
    processing: {
      color: W.accent,
      bg: "rgba(163,230,53,.1)",
      border: "rgba(163,230,53,.25)",
      label: "Processing",
    },
    completed: {
      color: W.success,
      bg: "rgba(52,211,153,.1)",
      border: "rgba(52,211,153,.25)",
      label: "Paid",
    },
    cancelled: {
      color: W.muted,
      bg: "rgba(255,255,255,.05)",
      border: "rgba(255,255,255,.12)",
      label: "Cancelled",
    },
    failed: {
      color: W.danger,
      bg: "rgba(248,113,113,.1)",
      border: "rgba(248,113,113,.25)",
      label: "Failed",
    },
  };
  const c = map[status] || map.queued;
  return (
    <span
      className="wd-status-badge"
      style={{
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {status === "queued" && <Clock size={7} />}
      {status === "batched" && <Layers size={7} />}
      {status === "completed" && <CheckCircle2 size={7} />}
      {status === "failed" && <XCircle size={7} />}
      {status === "cancelled" && <XCircle size={7} />}
      {status === "processing" && <RefreshCw size={7} />}
      {c.label}
    </span>
  );
}

// ── State Banner ──────────────────────────────────────────────────────────────
function StateBanner({ state, loading }) {
  if (loading)
    return <div className="wd-skel" style={{ height: 52, borderRadius: 14 }} />;
  const cfg = SYSTEM_STATE_CONFIG[state] || SYSTEM_STATE_CONFIG.healthy;
  return (
    <div
      className="wd-state"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div
        className="wd-state-dot"
        style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }}
      />
      <div style={{ flex: 1 }}>
        <div className="wd-state-label" style={{ color: cfg.color }}>
          {cfg.icon} System {cfg.label}
        </div>
        <div className="wd-state-desc" style={{ color: cfg.color }}>
          {cfg.description}
        </div>
      </div>
      {state === "critical" && (
        <AlertTriangle size={15} color={cfg.color} style={{ flexShrink: 0 }} />
      )}
    </div>
  );
}

// ── Tier Cards ────────────────────────────────────────────────────────────────
function TierCards({ activeTier }) {
  return (
    <div className="wd-tiers">
      {WITHDRAWAL_TIERS.map((t) => {
        const color = TIER_COLORS[t.tier];
        const isActive = activeTier === t.tier;
        return (
          <div
            key={t.tier}
            className={`wd-tier-card${isActive ? " active" : ""}`}
            style={{
              borderColor: isActive ? color + "66" : color + "22",
              background: isActive ? color + "12" : color + "06",
              boxShadow: isActive ? `0 4px 20px ${color}18` : "none",
            }}
          >
            <div className="wd-tier-icon">{TIER_ICONS[t.tier]}</div>
            <div className="wd-tier-label" style={{ color }}>
              Tier {t.tier}
            </div>
            <div className="wd-tier-fee" style={{ color }}>
              {t.feePct}%
            </div>
            <div className="wd-tier-range" style={{ color }}>
              {t.minEp.toLocaleString()}–
              {t.maxEp === Infinity ? "∞" : t.maxEp.toLocaleString()} EP
            </div>
            <div className="wd-tier-time" style={{ color }}>
              ~
              {t.estimatedHours >= 24
                ? `${t.estimatedHours / 24}d`
                : `${t.estimatedHours}h`}{" "}
              est.
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fee Breakdown ─────────────────────────────────────────────────────────────
function FeeBreakdown({ feeInfo }) {
  if (!feeInfo) return null;
  const color = TIER_COLORS[feeInfo.tier];
  return (
    <div className="wd-breakdown" style={{ borderColor: color + "22" }}>
      <div className="wd-breakdown-row">
        <span className="wd-breakdown-label">Withdrawal amount</span>
        <span className="wd-breakdown-val">{fmtEP(feeInfo.epAmount)} EP</span>
      </div>
      <div className="wd-breakdown-row">
        <span className="wd-breakdown-label">
          Processing fee{" "}
          <span style={{ fontSize: 10, color, fontWeight: 800 }}>
            Tier {feeInfo.tier} · {feeInfo.feePct}%
          </span>
        </span>
        <span className="wd-breakdown-val fee">
          −{fmtEP(feeInfo.feeAmount)} EP
        </span>
      </div>
      <div className="wd-breakdown-row">
        <span
          className="wd-breakdown-label"
          style={{ fontWeight: 700, color: W.text }}
        >
          You receive
        </span>
        <span className="wd-breakdown-val net">{fmtEP(feeInfo.netEp)} EP</span>
      </div>
      <div className="wd-breakdown-row" style={{ marginTop: 4 }}>
        <span className="wd-breakdown-label">Estimated processing</span>
        <span className="wd-breakdown-val time">
          <Clock
            size={10}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 4,
            }}
          />
          {feeInfo.estimatedHours >= 24
            ? `~${feeInfo.estimatedHours / 24} day${feeInfo.estimatedHours / 24 > 1 ? "s" : ""}`
            : `~${feeInfo.estimatedHours} hour${feeInfo.estimatedHours > 1 ? "s" : ""}`}
        </span>
      </div>
    </div>
  );
}

// ── Destination Form ──────────────────────────────────────────────────────────
function DestinationForm({ destType, setDestType, fields, setFields }) {
  const update = (key, val) => setFields((prev) => ({ ...prev, [key]: val }));
  const fp = (key, placeholder, opts = {}) => ({
    className: "wd-field-input",
    value: fields[key] || "",
    placeholder,
    onChange: (e) => update(key, e.target.value),
    onFocus: (e) => (e.target.style.borderColor = "rgba(163,230,53,.45)"),
    onBlur: (e) => (e.target.style.borderColor = "rgba(255,255,255,.10)"),
    ...opts,
  });

  return (
    <div>
      <div className="wd-card-title">Destination</div>
      <div className="wd-dest-tabs">
        {DEST_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`wd-dest-tab${destType === id ? " active" : ""}`}
            onClick={() => setDestType(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {destType === "bank" && (
        <>
          <div className="wd-field">
            <div className="wd-field-label">Bank Name</div>
            <input {...fp("bank", "e.g. GTBank, Access Bank, Zenith…")} />
          </div>
          <div className="wd-field">
            <div className="wd-field-label">Account Number</div>
            <input
              {...fp("accountNumber", "0123456789", {
                inputMode: "numeric",
                maxLength: 20,
              })}
            />
          </div>
          <div className="wd-field">
            <div className="wd-field-label">Account Name</div>
            <input {...fp("accountName", "Full name as on account")} />
          </div>
          <div className="wd-method-note">
            💳 Bank transfers are processed via Paystack. Funds arrive in your
            local bank account in the estimated timeframe.
          </div>
        </>
      )}

      {destType === "crypto" && (
        <>
          <div className="wd-field">
            <div className="wd-field-label">Network / Chain</div>
            <input {...fp("network", "e.g. Ethereum, BSC, Solana, Tron…")} />
          </div>
          <div className="wd-field">
            <div className="wd-field-label">Token</div>
            <input {...fp("token", "e.g. USDT, ETH, BNB, SOL…")} />
          </div>
          <div className="wd-field">
            <div className="wd-field-label">Wallet Address</div>
            <input {...fp("walletAddress", "0x… or sol1… or addr1…")} />
          </div>
          <div className="wd-method-note">
            ⛓ Crypto withdrawals are converted at market rate and sent on-chain.
            Double-check network and address — transfers are irreversible.
          </div>
        </>
      )}

      {destType === "paypal" && (
        <>
          <div className="wd-field">
            <div className="wd-field-label">PayPal Email</div>
            <input {...fp("email", "you@email.com", { type: "email" })} />
          </div>
          <div className="wd-field">
            <div className="wd-field-label">Full Name (on PayPal)</div>
            <input {...fp("paypalName", "Your full name")} />
          </div>
          <div className="wd-method-note">
            🅿 PayPal withdrawals are processed manually and credited to your
            PayPal balance in USD equivalent.
          </div>
        </>
      )}
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────
function HistoryRow({ item, idx }) {
  const color = TIER_COLORS[item.processing_tier] || W.info;
  const dest = item.destination_type || "bank";
  const DestIcon = DEST_TYPES.find((d) => d.id === dest)?.Icon || Building2;

  return (
    <div className="wd-history-row" style={{ animationDelay: `${idx * 40}ms` }}>
      <div
        className="wd-history-icon"
        style={{ background: color + "12", border: `1px solid ${color}22` }}
      >
        <Landmark size={15} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: W.text }}>
            Withdrawal
          </span>
          <StatusBadge status={item.status} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color,
              padding: "2px 6px",
              borderRadius: 6,
              background: color + "12",
            }}
          >
            T{item.processing_tier}
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            color: W.text2,
            marginTop: 3,
            display: "flex",
            gap: 7,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <DestIcon size={9} /> {dest}
          </span>
          <span>·</span>
          <span>{timeAgo(item.requested_at)}</span>
          {item.estimated_at && item.status === "queued" && (
            <>
              <span>·</span>
              <span style={{ color: W.info }}>
                <Clock
                  size={8}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />
                {" est. "}
                {new Date(item.estimated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: W.danger,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          −{fmtEP(item.ep_amount)} EP
        </div>
        <div style={{ fontSize: 10, color: W.success, marginTop: 1 }}>
          net {fmtEP(item.net_ep)} EP
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WithdrawTab({ userId, balance, setActiveTab }) {
  const [systemState, setSystemState] = useState("healthy");
  const [stateLoading, setStateLoading] = useState(true);
  const [epBalance, setEpBalance] = useState(Math.floor(balance?.points ?? 0));
  const [amount, setAmount] = useState("");
  const [destType, setDestType] = useState("bank");
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const amountNum = parseFloat(amount.replace(/,/g, "")) || 0;
  const feeRaw = computeWithdrawalFee(amountNum);
  const feeInfo = feeRaw ? { ...feeRaw, epAmount: amountNum } : null;
  const activeTier = feeInfo?.tier ?? null;

  // Sync balance from prop
  useEffect(() => {
    setEpBalance(Math.floor(balance?.points ?? 0));
  }, [balance?.points]);

  // Load system state
  useEffect(() => {
    setStateLoading(true);
    liquidityService
      .getLatestSnapshot()
      .then((snap) => setSystemState(snap?.system_state ?? "healthy"))
      .catch(() => setSystemState("healthy"))
      .finally(() => setStateLoading(false));
    const unsub = liquidityService.subscribeLiquidity((snap) => {
      setSystemState(snap?.system_state ?? "healthy");
    });
    return unsub;
  }, []);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setHistLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("withdrawal_queue")
        .select(
          "id,ep_amount,processing_tier,fee_pct,fee_amount,net_ep,status,destination_type,requested_at,estimated_at,processed_at,system_state_at_submit",
        )
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(10);
      if (!err) setHistory(data || []);
    } catch {}
    setHistLoading(false);
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Real-time history updates
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`withdrawal_updates:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawal_queue",
          filter: `user_id=eq.${userId}`,
        },
        () => loadHistory(),
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId, loadHistory]);

  // Validation
  const validate = useMemo(() => {
    if (!amountNum || amountNum < 100)
      return { ok: false, msg: "Minimum withdrawal is 100 EP" };
    if (amountNum > epBalance)
      return { ok: false, msg: "Insufficient EP balance" };
    if (!feeInfo) return { ok: false, msg: "Invalid amount" };

    if (destType === "bank") {
      if (!fields.bank?.trim())
        return { ok: false, msg: "Please enter your bank name" };
      if (!fields.accountNumber?.trim())
        return { ok: false, msg: "Please enter your account number" };
      if (!fields.accountName?.trim())
        return { ok: false, msg: "Please enter your account name" };
    }
    if (destType === "crypto") {
      if (!fields.network?.trim())
        return { ok: false, msg: "Please enter the network/chain" };
      if (!fields.walletAddress?.trim())
        return { ok: false, msg: "Please enter your wallet address" };
    }
    if (destType === "paypal") {
      if (!fields.email?.trim())
        return { ok: false, msg: "Please enter your PayPal email" };
    }
    return { ok: true, msg: null };
  }, [amountNum, epBalance, feeInfo, destType, fields]);

  // Submit
  const handleSubmit = async () => {
    if (!validate.ok || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("queue_withdrawal", {
        p_user_id: userId,
        p_ep_amount: amountNum,
        p_destination_type: destType,
        p_destination_info: fields,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (data?.success === false)
        throw new Error(data?.error || "Withdrawal failed");

      setAmount("");
      setFields({});

      const isBatched = data?.system_state === "critical";
      setToast(
        isBatched
          ? "⏳ Withdrawal batched — system is in Critical state. Will process automatically on recovery."
          : `✅ Withdrawal queued! Tier ${data?.tier} · Est. ~${feeInfo?.estimatedHours}h · Net: ${fmtEP(data?.net_ep || feeInfo?.netEp)} EP`,
      );
      setTimeout(() => setToast(null), 5500);

      await loadHistory();
      const { data: w } = await supabase
        .from("wallets")
        .select("engagement_points")
        .eq("user_id", userId)
        .maybeSingle();
      if (w) setEpBalance(Math.floor(w.engagement_points || 0));

      setShowHistory(true);
    } catch (e) {
      setError(e.message || "Withdrawal failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMax = () => {
    const safeMax = Math.floor(epBalance);
    if (safeMax >= 100) setAmount(safeMax.toString());
  };

  const btnClass =
    !validate.ok || submitting
      ? submitting
        ? "loading"
        : "disabled"
      : "ready";
  const btnLabel = submitting
    ? "Submitting…"
    : !feeInfo && amountNum > 0
      ? "Amount too low (min 100 EP)"
      : validate.ok
        ? `Withdraw ${fmtEP(amountNum)} EP`
        : "Withdraw EP";

  return (
    <div className="wd-page view-enter">
      <style>{CSS}</style>

      {/* ── Back header ── */}
      <div className="wd-header">
        <button
          className="wd-back-btn"
          onClick={() => setActiveTab?.("overview")}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="wd-header-title">Withdraw EP</div>
      </div>

      <div className="wd-wrap">
        {/* System state */}
        <StateBanner state={systemState} loading={stateLoading} />

        {/* Balance */}
        <div className="wd-card">
          <div className="wd-card-title">Available to Withdraw</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div>
              <div className="wd-bal-num">{fmtEP(epBalance)}</div>
              <div className="wd-bal-usd">{fmtUSD(epBalance)}</div>
            </div>
            <div className="wd-bal-unit">EP</div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${W.border}`,
            }}
          >
            {WITHDRAWAL_TIERS.map((t) => (
              <div key={t.tier} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: TIER_COLORS[t.tier],
                  }}
                >
                  {t.feePct}% fee
                </div>
                <div style={{ fontSize: 9, color: W.muted, marginTop: 1 }}>
                  {t.estimatedHours >= 24
                    ? `${t.estimatedHours / 24}d`
                    : `${t.estimatedHours}h`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Amount + fee calculator */}
        <div className="wd-card">
          <div className="wd-card-title">Withdrawal Amount</div>
          <div className="wd-amount-wrap">
            <input
              className="wd-amount-input"
              type="number"
              min="100"
              step="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder="Enter EP amount (min 100)"
            />
            <span className="wd-amount-unit">EP</span>
          </div>
          <span className="wd-amount-max" onClick={handleMax}>
            Max: {fmtEP(epBalance)} EP
          </span>
          <TierCards activeTier={activeTier} />
          {feeInfo && (
            <div style={{ marginTop: 12 }}>
              <FeeBreakdown feeInfo={feeInfo} />
            </div>
          )}

          {amountNum > 0 && amountNum < 100 && (
            <div className="wd-alert danger" style={{ marginTop: 12 }}>
              <AlertTriangle
                size={13}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              Minimum withdrawal is 100 EP
            </div>
          )}
          {amountNum > epBalance && amountNum >= 100 && (
            <div className="wd-alert danger" style={{ marginTop: 12 }}>
              <AlertTriangle
                size={13}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              Amount exceeds your EP balance
            </div>
          )}
          {systemState === "critical" && amountNum >= 100 && (
            <div className="wd-alert warn" style={{ marginTop: 12 }}>
              <AlertTriangle
                size={13}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>
                System is in <strong>Critical</strong> state — your withdrawal
                will be batched and released automatically when liquidity
                recovers.
              </span>
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="wd-card">
          <DestinationForm
            destType={destType}
            setDestType={setDestType}
            fields={fields}
            setFields={setFields}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="wd-alert danger">
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className={`wd-submit ${btnClass}`}
          onClick={handleSubmit}
          disabled={!validate.ok || submitting}
        >
          {submitting ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <RefreshCw
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Submitting…
            </span>
          ) : (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
              }}
            >
              <ArrowUpToLine size={15} />
              {btnLabel}
            </span>
          )}
        </button>

        {/* Info */}
        <div className="wd-info">
          <Info
            size={14}
            style={{ flexShrink: 0, marginTop: 1, color: W.info }}
          />
          <span>
            EP withdrawals are processed by priority tier. Higher amounts get
            lower fees and faster processing. All withdrawals are subject to
            review for security.
          </span>
        </div>

        {/* Tier legend */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 14,
            borderRadius: 14,
            background: W.bg1,
            border: `1px solid ${W.border}`,
          }}
        >
          {WITHDRAWAL_TIERS.map((t) => {
            const color = TIER_COLORS[t.tier];
            return (
              <div
                key={t.tier}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: color + "12",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  {TIER_ICONS[t.tier]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color }}>
                    Tier {t.tier} — {t.feePct}% fee
                  </div>
                  <div style={{ fontSize: 9, color: W.muted }}>
                    {t.minEp.toLocaleString()}
                    {t.maxEp === Infinity
                      ? "+"
                      : `–${t.maxEp.toLocaleString()}`}
                    {" EP · ~"}
                    {t.estimatedHours >= 24
                      ? `${t.estimatedHours / 24}d`
                      : `${t.estimatedHours}h`}
                    {" processing · Priority "}
                    {"★".repeat(t.tier)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color,
                    padding: "3px 9px",
                    borderRadius: 8,
                    background: color + "10",
                  }}
                >
                  {t.feePct}%
                </div>
              </div>
            );
          })}
        </div>

        {/* History */}
        <div className="wd-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => setShowHistory((v) => !v)}
          >
            <div className="wd-card-title" style={{ marginBottom: 0 }}>
              Recent Withdrawals
              {history.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 10,
                    background: "rgba(163,230,53,.1)",
                    color: W.accent,
                  }}
                >
                  {history.length}
                </span>
              )}
            </div>
            <ChevronRight
              size={15}
              color={W.muted}
              style={{
                transition: "transform .2s",
                transform: showHistory ? "rotate(90deg)" : "rotate(0deg)",
              }}
            />
          </div>

          {showHistory && (
            <div style={{ marginTop: 13 }}>
              {histLoading ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 9 }}
                >
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="wd-skel" style={{ height: 54 }} />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0" }}>
                  <Landmark
                    size={28}
                    color={W.muted}
                    style={{ opacity: 0.3, margin: "0 auto 10px" }}
                  />
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: W.muted,
                      marginBottom: 3,
                    }}
                  >
                    No withdrawals yet
                  </div>
                  <div style={{ fontSize: 11, color: W.muted }}>
                    Your withdrawal history will appear here
                  </div>
                </div>
              ) : (
                <>
                  {history.map((item, idx) => (
                    <HistoryRow key={item.id} item={item} idx={idx} />
                  ))}
                  <button
                    onClick={loadHistory}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      margin: "11px auto 0",
                      padding: "6px 14px",
                      borderRadius: 9,
                      border: `1px solid ${W.border2}`,
                      background: "transparent",
                      color: W.text2,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = W.text)}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = W.text2)
                    }
                  >
                    <RefreshCw size={10} /> Refresh
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="wd-toast">
          <Shield size={15} color={W.success} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, lineHeight: 1.5 }}>{toast}</span>
        </div>
      )}
    </div>
  );
}
