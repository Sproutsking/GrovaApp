// Bank payouts are submitted immediately; reward level controls eligibility
// and request caps, not payout priority.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, RefreshCw, Info, ArrowUpToLine, Layers,
  Building2, Bitcoin, Mail, Shield, Eye, EyeOff, Loader,
  TrendingDown, Lock, Unlock,
} from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import {
  queueWithdrawal,
  getWithdrawalHistory,
  subscribeToWithdrawals,
  requiresPin,
  retryWithdrawalPayout,
  verifyWithdrawalPin,
  getDailyWithdrawalUsage,
  getWithdrawalPreview,
  validateDestination,
  epToNGN,
  epToUSD,
  getWithdrawRate,
  MIN_WITHDRAWAL_EP,
  PIN_REQUIRED_EP,
} from "../../../services/wallet/withdrawServiceV2";

const METHODS = [
  { id: "bank",   label: "Bank",   Icon: Building2, available: true },
  { id: "crypto", label: "Crypto", Icon: Bitcoin,   available: false },
  { id: "paypal", label: "PayPal", Icon: Mail,      available: false },
];

const STATUS_MAP = {
  queued:     { color:"#60a5fa", bg:"rgba(96,165,250,.12)",  border:"rgba(96,165,250,.3)",  label:"Queued",     Ic: Clock        },
  batched:    { color:"#fbbf24", bg:"rgba(251,191,36,.12)",  border:"rgba(251,191,36,.3)",  label:"Batched",    Ic: Layers       },
  processing: { color:"#a3e635", bg:"rgba(163,230,53,.12)",  border:"rgba(163,230,53,.3)",  label:"Processing", Ic: RefreshCw    },
  completed:  { color:"#4ade80", bg:"rgba(74,222,128,.12)",  border:"rgba(74,222,128,.3)",  label:"Paid ✓",     Ic: CheckCircle2 },
  cancelled:  { color:"rgba(255,255,255,.35)", bg:"rgba(255,255,255,.06)", border:"rgba(255,255,255,.15)", label:"Cancelled", Ic: XCircle },
  failed:     { color:"#f87171", bg:"rgba(248,113,113,.12)", border:"rgba(248,113,113,.3)", label:"Failed",     Ic: XCircle      },
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
@keyframes wd-in    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
@keyframes wd-spin  { to{transform:rotate(360deg)} }
@keyframes wd-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes wd-skel  { 0%,100%{opacity:.5} 50%{opacity:.18} }
@keyframes wd-toast { 0%{opacity:0;transform:translateY(10px)} 10%,88%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes wd-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
* { box-sizing:border-box }

.wd { font-family:'Inter',sans-serif; color:rgba(255,255,255,.9); padding:0 clamp(12px, 2vw, 20px) 48px; animation:wd-in .3s ease both; -webkit-font-smoothing:antialiased }

/* HEADER */
.wd-hdr { display:flex; align-items:center; gap:12px; padding:8px 0 14px; position:sticky; top:0; z-index:20; background:rgba(5,6,8,.97); backdrop-filter:blur(24px); border-bottom:1px solid rgba(255,255,255,.06); margin-bottom:20px }
.wd-back { width:32px; height:32px; border-radius:8px; flex-shrink:0; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgba(255,255,255,.45); transition:all .2s }
.wd-back:hover { border-color:#a3e635; color:#a3e635 }
.wd-htitle { font-size:calc((15px) + 1px); font-weight:700; letter-spacing:-.3px }
.wd-hsub   { font-size:calc((10px) + 1px); color:rgba(255,255,255,.3); margin-top:1px; font-family:'JetBrains Mono',monospace }
.wd-spill  { margin-left:auto; display:flex; align-items:center; gap:6px; padding:4px 10px; border-radius:20px; border:1px solid; font-size:calc((10px) + 1px); font-weight:600 }
.wd-sdot   { width:6px; height:6px; border-radius:50%; animation:wd-pulse 2s ease infinite }

/* HERO */
.wd-hero { background:linear-gradient(135deg,rgba(163,230,53,.09) 0%,rgba(163,230,53,.03) 100%); border:1px solid rgba(163,230,53,.15); border-radius:20px; padding:24px; margin-bottom:14px; position:relative; overflow:hidden }
.wd-hero::before { content:''; position:absolute; top:-50px; right:-50px; width:140px; height:140px; border-radius:50%; background:rgba(163,230,53,.05); pointer-events:none }
.wd-hlabel { font-size:calc((10px) + 1px); font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:rgba(163,230,53,.55); margin-bottom:8px; font-family:'JetBrains Mono',monospace }
.wd-hamt   { display:flex; align-items:baseline; gap:8px; margin-bottom:4px }
.wd-hnum   { font-size:calc((46px) + 1px); font-weight:900; color:#fff; letter-spacing:-2.5px; font-variant-numeric:tabular-nums; line-height:1 }
.wd-hunit  { font-size:calc((16px) + 1px); font-weight:700; color:#a3e635 }
.wd-husd   { font-size:calc((12px) + 1px); color:rgba(255,255,255,.3); font-family:'JetBrains Mono',monospace }
.wd-hdiv   { height:1px; background:rgba(255,255,255,.06); margin:16px 0 }
.wd-hgrid  { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px }
.wd-hslbl  { font-size:calc((9px) + 1px); color:rgba(255,255,255,.3); text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px; font-family:'JetBrains Mono',monospace }
.wd-hsval  { font-size:calc((13px) + 1px); font-weight:700; font-variant-numeric:tabular-nums }
.wd-bar    { height:3px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden; margin-top:6px }
.wd-barf   { height:100%; border-radius:3px; transition:width .5s ease }

/* ── TIER CARDS — redesigned ── */
/* Three cards side by side. Each card has:
   - A small tier badge (T1/T2/T3) pinned to the top-right corner
   - A large fee % as the centrepiece
   - A thin divider
   - Range  |  ETA  on one line at the bottom */
.wd-tiers  { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px }
.wd-tc {
  position:relative;
  padding:16px 12px 12px;
  border-radius:14px; border:1.5px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.02);
  text-align:center; transition:all .25s; overflow:hidden;
}
.wd-tc.on { transform:translateY(-2px) }
.wd-tc::after {
  content:''; position:absolute; inset:0; border-radius:13px;
  background:radial-gradient(circle at 50% 0%, var(--tc-glow,transparent) 0%, transparent 70%);
  pointer-events:none; transition:opacity .3s;
}
/* Corner badge — positioned top-right */
.wd-tc-badge {
  position:absolute; top:8px; right:8px;
  font-size:calc((8px) + 1px); font-weight:800; letter-spacing:.06em; text-transform:uppercase;
  padding:2px 6px; border-radius:6px; border:1px solid;
  font-family:'JetBrains Mono',monospace; line-height:1.4;
}
/* Icon — top-centre, small */
.wd-tc-icon { font-size:calc((13px) + 1px); margin-bottom:6px; display:block }
/* Fee percentage — the main number */
.wd-tc-pct  { font-size:calc((32px) + 1px); font-weight:900; letter-spacing:-1.5px; line-height:1; margin-bottom:2px }
.wd-tc-fee  { font-size:calc((9px) + 1px); font-weight:600; opacity:.5; text-transform:uppercase; letter-spacing:.08em; margin-bottom:10px }
/* Thin divider inside card */
.wd-tc-div  { height:1px; background:rgba(255,255,255,.07); margin:0 -4px 10px }
/* Bottom row: range and ETA */
.wd-tc-bot  { display:flex; align-items:center; justify-content:space-between; gap:4px }
.wd-tc-range{ font-size:calc((8px) + 1px); opacity:.4; font-family:'JetBrains Mono',monospace }
.wd-tc-eta  { font-size:calc((9px) + 1px); font-weight:700; opacity:.65 }

/* CARD */
.wd-card  { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:18px; margin-bottom:12px }
.wd-clbl  { font-size:calc((9px) + 1px); font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.3); margin-bottom:14px; font-family:'JetBrains Mono',monospace }

/* AMOUNT INPUT */
.wd-amtwrap { display:flex; align-items:center; background:rgba(0,0,0,.3); border:1.5px solid rgba(255,255,255,.1); border-radius:12px; padding:14px 16px; transition:border-color .2s }
.wd-amtwrap:focus-within { border-color:rgba(163,230,53,.5) }
.wd-amtwrap.err { border-color:rgba(248,113,113,.5); animation:wd-shake .35s ease }
.wd-amtinp { flex:1; background:none; border:none; outline:none; font-family:'JetBrains Mono',monospace; font-size:calc((28px) + 1px); font-weight:700; color:#fff; letter-spacing:-.03em; min-width:0 }
.wd-amtinp::placeholder { color:rgba(255,255,255,.12); font-size:calc((20px) + 1px) }
.wd-amtunit { font-size:calc((14px) + 1px); font-weight:700; color:#a3e635; flex-shrink:0 }
.wd-amtrow  { display:flex; align-items:center; justify-content:space-between; margin-top:10px }
.wd-maxbtn  { display:inline-flex; align-items:center; gap:4px; font-size:calc((10px) + 1px); font-weight:600; color:rgba(163,230,53,.65); background:rgba(163,230,53,.08); border:1px solid rgba(163,230,53,.15); border-radius:6px; padding:4px 8px; cursor:pointer; font-family:'Inter',sans-serif; transition:all .15s }
.wd-maxbtn:hover { color:#a3e635; background:rgba(163,230,53,.12) }
.wd-inerr  { font-size:calc((11px) + 1px); color:#f87171; display:flex; align-items:center; gap:5px }

/* BREAKDOWN */
.wd-brkdn  { margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,.06) }
.wd-brow   { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px }
.wd-brow:last-child { margin:0; padding-top:10px; border-top:1px dashed rgba(255,255,255,.08); margin-top:2px }
.wd-bkey   { font-size:calc((12px) + 1px); color:rgba(255,255,255,.4) }
.wd-bval   { font-size:calc((12px) + 1px); font-weight:600; font-variant-numeric:tabular-nums; color:rgba(255,255,255,.8) }
.wd-bval.g { color:#a3e635; font-size:calc((16px) + 1px); font-weight:800 }
.wd-bval.y { color:#fbbf24 }
.wd-bval.b { color:#60a5fa; font-family:'JetBrains Mono',monospace; font-size:calc((11px) + 1px) }
.wd-bbadge { font-size:calc((9px) + 1px); font-weight:700; padding:2px 6px; border-radius:4px; margin-left:6px }

/* METHOD TABS */
.wd-methods { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:14px }
.wd-method  { display:flex; align-items:center; justify-content:center; gap:7px; padding:10px 6px; border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.02); font-family:'Inter',sans-serif; transition:all .2s }
.wd-method:hover { border-color:rgba(255,255,255,.14); background:rgba(255,255,255,.05) }
.wd-method:disabled { opacity:.4; cursor:not-allowed }
.wd-method:disabled:hover { border-color:rgba(255,255,255,.07); background:rgba(255,255,255,.02) }
.wd-method.on { border-color:rgba(163,230,53,.4); background:rgba(163,230,53,.08) }
.wd-mico    { flex-shrink:0; color:rgba(255,255,255,.3) }
.wd-method.on .wd-mico { color:#a3e635 }
.wd-mlbl    { font-size:calc((11px) + 1px); font-weight:600; color:rgba(255,255,255,.4); text-transform:uppercase; letter-spacing:.06em }
.wd-method.on .wd-mlbl { color:#a3e635 }

/* FIELDS */
.wd-field  { margin-bottom:11px }
.wd-field:last-of-type { margin-bottom:0 }
.wd-flbl   { display:block; font-size:calc((9px) + 1px); font-weight:700; color:rgba(255,255,255,.3); text-transform:uppercase; letter-spacing:.1em; margin-bottom:6px; font-family:'JetBrains Mono',monospace }
.wd-fin    { width:100%; background:rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.09); border-radius:10px; padding:10px 13px; color:rgba(255,255,255,.85); font-size:calc((13px) + 1px); font-family:'JetBrains Mono',monospace; outline:none; transition:border-color .2s }
.wd-fin::placeholder { color:rgba(255,255,255,.18) }
.wd-fin:focus { border-color:rgba(163,230,53,.35) }
.wd-fnote  { font-size:calc((10px) + 1px); color:rgba(255,255,255,.22); margin-top:10px; padding:8px 12px; border-radius:8px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06); line-height:1.65; font-family:'JetBrains Mono',monospace }

/* PIN */
.wd-pincard { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:18px; margin-bottom:12px }
.wd-pinh    { display:flex; align-items:center; gap:8px; margin-bottom:4px }
.wd-pintit  { font-size:calc((13px) + 1px); font-weight:700 }
.wd-pinsub  { font-size:calc((10px) + 1px); color:rgba(255,255,255,.3); font-family:'JetBrains Mono',monospace; margin-bottom:14px }
.wd-pinrow  { display:flex; align-items:center; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:12px 14px }
.wd-pininp  { flex:1; background:none; border:none; outline:none; font-family:'JetBrains Mono',monospace; font-size:calc((22px) + 1px); font-weight:700; color:#fff; letter-spacing:.25em }
.wd-pininp::placeholder { letter-spacing:normal; font-size:calc((13px) + 1px); color:rgba(255,255,255,.18) }
.wd-pintgl  { background:none; border:none; cursor:pointer; color:rgba(255,255,255,.25); display:flex; transition:color .15s }
.wd-pintgl:hover { color:rgba(255,255,255,.6) }
.wd-pinbtn  { width:100%; margin-top:10px; padding:11px; border-radius:10px; border:none; cursor:pointer; font-family:'Inter',sans-serif; font-size:calc((12px) + 1px); font-weight:700; display:flex; align-items:center; justify-content:center; gap:7px; transition:all .2s }
.wd-pinbtn.ok  { background:rgba(163,230,53,.12); color:#a3e635; border:1px solid rgba(163,230,53,.25) }
.wd-pinbtn.ok:hover { background:rgba(163,230,53,.18) }
.wd-pinbtn.off { background:rgba(255,255,255,.04); color:rgba(255,255,255,.2); cursor:not-allowed }

/* ALERTS */
.wd-err     { display:flex; align-items:flex-start; gap:8px; padding:11px 13px; border-radius:10px; font-size:calc((12px) + 1px); line-height:1.6; margin-bottom:12px; background:rgba(248,113,113,.07); border:1px solid rgba(248,113,113,.2); color:#fca5a5 }
.wd-syswarn { display:flex; align-items:flex-start; gap:8px; padding:10px 13px; border-radius:10px; font-size:calc((12px) + 1px); line-height:1.6; margin-bottom:12px; background:rgba(251,191,36,.06); border:1px solid rgba(251,191,36,.18); color:#fcd34d }

/* SUBMIT */
.wd-submit  { width:100%; padding:16px 24px; border-radius:14px; border:none; font-family:'Inter',sans-serif; font-size:calc((15px) + 1px); font-weight:800; cursor:pointer; transition:all .25s; letter-spacing:-.2px; display:flex; align-items:center; justify-content:center; gap:8px }
.wd-submit.ok   { background:linear-gradient(135deg,#a3e635 0%,#65a30d 100%); color:#0a1200; box-shadow:0 8px 32px rgba(163,230,53,.25) }
.wd-submit.ok:hover  { transform:translateY(-2px); box-shadow:0 14px 40px rgba(163,230,53,.35) }
.wd-submit.ok:active { transform:translateY(0) }
.wd-submit.off  { background:rgba(255,255,255,.06); color:rgba(255,255,255,.2); cursor:not-allowed }
.wd-submit.busy { background:rgba(255,255,255,.06); color:rgba(255,255,255,.3); cursor:not-allowed }

/* INFO */
.wd-info { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border-radius:12px; margin-top:12px; background:rgba(96,165,250,.04); border:1px solid rgba(96,165,250,.12); font-size:calc((11px) + 1px); color:rgba(96,165,250,.7); line-height:1.65; font-family:'JetBrains Mono',monospace }

/* HISTORY */
.wd-hcard  { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:18px; margin-top:14px }
.wd-hhd    { display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none }
.wd-hhlbl  { font-size:calc((10px) + 1px); font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.3); font-family:'JetBrains Mono',monospace }
.wd-hhcnt  { font-size:calc((9px) + 1px); font-weight:700; padding:2px 7px; border-radius:10px; background:rgba(163,230,53,.1); color:#a3e635; margin-left:8px }
.wd-hrow   { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05) }
.wd-hrow:last-child { border-bottom:none }
.wd-hico   { width:36px; height:36px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center }
.wd-chip   { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:20px; font-size:calc((8px) + 1px); font-weight:700; letter-spacing:.06em; text-transform:uppercase; border:1px solid; white-space:nowrap }
.wd-retry  { font-size:calc((9px) + 1px); font-weight:600; color:rgba(163,230,53,.7); cursor:pointer; background:none; border:none; font-family:'Inter',sans-serif; padding:2px 0; transition:color .15s }
.wd-retry:hover { color:#a3e635 }

.wd-skel   { background:rgba(255,255,255,.06); border-radius:8px; animation:wd-skel 1.5s ease infinite }

/* TOAST */
.wd-toast  { position:fixed; bottom:24px; left:16px; right:16px; z-index:9999; padding:13px 16px; border-radius:13px; backdrop-filter:blur(20px); display:flex; align-items:center; gap:10px; animation:wd-toast 5s ease forwards; font-size:calc((12px) + 1px); font-weight:600; line-height:1.5; box-shadow:0 16px 48px rgba(0,0,0,.7) }
.wd-toast.ok  { background:rgba(52,211,153,.12); border:1px solid rgba(52,211,153,.3); color:#6ee7b7 }
.wd-toast.err { background:rgba(248,113,113,.12); border:1px solid rgba(248,113,113,.3); color:#fca5a5 }
.wd-spin   { animation:wd-spin 1s linear infinite }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtEP  = n  => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUSD = ep => `≈ $${(Number(ep || 0) / 100).toFixed(2)}`;
const ago    = iso => {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ── Status Chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const c = STATUS_MAP[status] || STATUS_MAP.queued;
  const Ic = c.Ic;
  return (
    <span className="wd-chip" style={{ color: c.color, background: c.bg, borderColor: c.border }}>
      <Ic size={7} /> {c.label}
    </span>
  );
}

// ── Breakdown ─────────────────────────────────────────────────────────────────
function Breakdown({ preview, method }) {
  if (!preview) return null;
  const rate  = getWithdrawRate();
  return (
    <div className="wd-brkdn">
      <div className="wd-brow">
        <span className="wd-bkey">Amount</span>
        <span className="wd-bval">{fmtEP(preview.grossEP)} EP</span>
      </div>
      <div className="wd-brow">
        <span className="wd-bkey">
          Platform fee
          <span className="wd-bbadge" style={{ color: "#fbbf24", background: "rgba(251,191,36,.12)" }}>
            {preview.feePct}%
          </span>
        </span>
        <span className="wd-bval y">−{fmtEP(preview.feeAmount)} EP</span>
      </div>
      <div className="wd-brow">
        <span className="wd-bkey" style={{ fontWeight:600, color:"rgba(255,255,255,.65)" }}>You receive</span>
        <div style={{ textAlign:"right" }}>
          <div className="wd-bval g">{fmtEP(preview.netEp)} EP</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.3)", marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>
            {method === "bank"
              ? `≈ ₦${epToNGN(preview.netEp, rate).toLocaleString()}`
              : `≈ $${epToUSD(preview.netEp).toFixed(2)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Destination Form ──────────────────────────────────────────────────────────
function DestForm({ method, onMethodChange, fields, setFields }) {
  const set = (k, v) => setFields(p => ({ ...p, [k]: v }));
  const inp = (key, ph, extra = {}) => (
    <input className="wd-fin" value={fields[key] || ""} placeholder={ph}
      onChange={e => set(key, e.target.value)} {...extra} />
  );
  return (
    <div className="wd-card">
      <div className="wd-clbl">Destination</div>
      <div className="wd-methods">
        {METHODS.map(({ id, label, Icon, available }) => (
          <button
            key={id}
            type="button"
            className={`wd-method${method === id ? " on" : ""}`}
            onClick={() => available && onMethodChange(id)}
            disabled={!available}
            aria-label={available ? label : `${label}, coming soon`}
          >
            <span className="wd-mico"><Icon size={14} /></span>
            <span className="wd-mlbl">{available ? label : `${label} · Soon`}</span>
          </button>
        ))}
      </div>
      {method === "bank" && <>
        <div className="wd-field"><span className="wd-flbl">Bank Name</span>{inp("bank","GTBank, Opay, Access, Zenith, UBA…")}</div>
        <div className="wd-field"><span className="wd-flbl">Account Number (10 digits)</span>{inp("accountNumber","0123456789",{inputMode:"numeric",maxLength:10})}</div>
        <div className="wd-field"><span className="wd-flbl">Account Name</span>{inp("accountName","Full name as on your bank account")}</div>
        <div className="wd-fnote">💳 Nigerian accounts only · Paid via Paystack Transfer</div>
      </>}
      {method === "crypto" && <>
        <div className="wd-field"><span className="wd-flbl">Network / Chain</span>{inp("network","Ethereum, BSC, Tron, Solana, Polygon…")}</div>
        <div className="wd-field"><span className="wd-flbl">Token</span>{inp("token","USDT, USDC, ETH, BNB, SOL…")}</div>
        <div className="wd-field"><span className="wd-flbl">Wallet Address</span>{inp("walletAddress","0x… or T… or addr1…")}</div>
        <div className="wd-field"><span className="wd-flbl">Memo / Tag (optional)</span>{inp("memo","Required for some exchanges")}</div>
        <div className="wd-fnote">⛓ 100 EP = $1.00 USD · Sent in your requested token · Irreversible</div>
      </>}
      {method === "paypal" && <>
        <div className="wd-field"><span className="wd-flbl">PayPal Email</span>{inp("email","you@example.com",{type:"email"})}</div>
        <div className="wd-field"><span className="wd-flbl">Full Name (on PayPal)</span>{inp("fullName","Your full legal name")}</div>
      </>}
      {method === "bank" && (
        <div className="wd-fnote">Crypto and PayPal payouts are not available yet. Bank payouts use Paystack.</div>
      )}
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────
function HistRow({ item, onRetry }) {
  const color    = item.status === "completed" ? "#4ade80" : item.status === "failed" ? "#f87171" : "#a3e635";
  const M        = METHODS.find(d => d.id === item.destination_type);
  const DestIcon = M ? M.Icon : Building2;
  const canRetry = item.status === "processing" && item.metadata?.payout_state === "ready";
  return (
    <div className="wd-hrow">
      <div className="wd-hico" style={{ background:`${color}12`, border:`1px solid ${color}20` }}>
        <TrendingDown size={14} color={color} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,.8)" }}>Withdrawal</span>
          <StatusChip status={item.status} />
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,.3)", display:"flex", gap:5, fontFamily:"'JetBrains Mono',monospace", alignItems:"center" }}>
          <span style={{ display:"flex", alignItems:"center", gap:3 }}><DestIcon size={10}/> {item.destination_type}</span>
          <span>·</span><span>{ago(item.requested_at)}</span>
        </div>
        {canRetry && <button className="wd-retry" onClick={() => onRetry(item.id)}>Retry payout initiation</button>}
        {item.metadata?.payout_state === "reconciliation_required" && (
          <div style={{ marginTop:5, color:"#fbbf24", fontSize:10 }}>
            Payout status is being reconciled. Do not submit a duplicate request.
          </div>
        )}
        {item.metadata?.payout_state === "initiating" && (
          <div style={{ marginTop:5, color:"#fbbf24", fontSize:10 }}>
            Payout initiation is in progress. Do not submit a duplicate request.
          </div>
        )}
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#f87171", fontVariantNumeric:"tabular-nums" }}>
          −{fmtEP(item.ep_amount)} EP
        </div>
        <div style={{ fontSize:11, color:"#a3e635", marginTop:1, fontFamily:"'JetBrains Mono',monospace" }}>
          {fmtEP(item.net_ep)} net
        </div>
        {item.destination_type === "bank" && item.status === "completed" && (
          <div style={{ fontSize:10, color:"rgba(255,255,255,.25)", fontFamily:"'JetBrains Mono',monospace" }}>
            ₦{Number(item.netNGN ?? epToNGN(item.net_ep)).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WithdrawTab({ userId, balance, setActiveTab }) {
  const [epBalance,   setEpBalance]   = useState(Math.floor(balance?.points ?? 0));
  const [dailyUsage,  setDailyUsage]  = useState(null);
  const [policyError, setPolicyError] = useState(null);

  const [amount,      setAmount]      = useState("");
  const [method,      setMethod]      = useState("bank");
  const [fields,      setFields]      = useState({});

  const [pin,         setPin]         = useState("");
  const [showPin,     setShowPin]     = useState(false);
  const [pinOk,       setPinOk]       = useState(false);
  const [pinChecking, setPinChecking] = useState(false);

  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);
  const [amtErr,      setAmtErr]      = useState(false);
  const [toast,       setToast]       = useState(null);

  const [history,     setHistory]     = useState([]);
  const [historyError,setHistoryError]= useState(null);
  const [histLoading, setHistLoading] = useState(true);
  const [showHist,    setShowHist]    = useState(false);
  const idempotencyKeyRef = useRef(null);

  const amtNum     = parseFloat(amount) || 0;
  const preview    = useMemo(
    () => getWithdrawalPreview(amtNum, method, dailyUsage?.feePct),
    [amtNum, method, dailyUsage?.feePct],
  );
  const needsPin   = requiresPin(amtNum);

  useEffect(() => { setEpBalance(Math.floor(balance?.points ?? 0)); }, [balance?.points]);

  const handleMethodChange = useCallback((m) => {
    setMethod(m); setFields({}); setError(null); setPinOk(false);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!userId) return;
    const { data, error: balanceError } = await supabase
      .from("wallets")
      .select("engagement_points")
      .eq("user_id", userId)
      .maybeSingle();
    if (balanceError) {
      setError(`Withdrawal may be recorded, but the balance could not be refreshed: ${balanceError.message}`);
      return;
    }
    if (data) setEpBalance(Math.floor(data.engagement_points || 0));
  }, [userId]);

  const loadDailyUsage = useCallback(async () => {
    if (!userId) return;
    try {
      setDailyUsage(await getDailyWithdrawalUsage(userId));
      setPolicyError(null);
    } catch (e) {
      setDailyUsage(null);
      setPolicyError(e.message || "Withdrawal limits are temporarily unavailable.");
    }
  }, [userId]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setHistLoading(true);
    try {
      setHistory(await getWithdrawalHistory(userId, 10));
      setHistoryError(null);
    } catch (e) {
      setHistoryError(e.message || "Could not load withdrawal history.");
    } finally {
      setHistLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadHistory(); loadDailyUsage(); }, [loadHistory, loadDailyUsage]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToWithdrawals(userId, async () => {
      await loadHistory();
      await loadDailyUsage();
      await refreshBalance();
    });
  }, [userId, loadHistory, loadDailyUsage, refreshBalance]);

  const validation = useMemo(() => {
    if (policyError) return { ok: false, msg: policyError };
    if (!dailyUsage) return { ok: false, msg: "Loading withdrawal limits…" };
    if (!dailyUsage.eligible) return { ok: false, msg: "Reach Silver reward level to withdraw." };
    if (!Number.isSafeInteger(amtNum)) return { ok: false, msg: "Enter a whole EP amount." };
    if (!amtNum || amtNum < MIN_WITHDRAWAL_EP)
      return { ok: false, msg: `Min ${MIN_WITHDRAWAL_EP} EP` };
    if (amtNum > epBalance)
      return { ok: false, msg: "Insufficient EP balance" };
    if (!preview)
      return { ok: false, msg: "Invalid amount" };
    if (amtNum > dailyUsage.maxPerRequest)
      return { ok: false, msg: `Per-request limit: ${dailyUsage.maxPerRequest.toLocaleString()} EP` };
    if (amtNum > dailyUsage.remaining)
      return { ok: false, msg: `Daily limit: ${dailyUsage.remaining.toLocaleString()} EP remaining` };
    const destErr = validateDestination(method, fields);
    if (destErr) return { ok: false, msg: destErr };
    if (needsPin && !pinOk) return { ok: false, msg: "PIN required" };
    return { ok: true, msg: null };
  }, [amtNum, epBalance, preview, dailyUsage, method, fields, needsPin, pinOk, policyError]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5500);
  };

  const handleVerifyPin = async () => {
    if (!pin || pin.length < 4) return;
    setPinChecking(true); setError(null);
    try {
      await verifyWithdrawalPin(userId, pin);
      setPinOk(true); showToast("ok", "PIN verified ✓");
    } catch (e) {
      setError(e.message || "Incorrect PIN");
    } finally { setPinChecking(false); }
  };

  const handleSubmit = async () => {
    if (!validation.ok || submitting) {
      setAmtErr(true); setTimeout(() => setAmtErr(false), 400); return;
    }
    setSubmitting(true); setError(null);
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const result = await queueWithdrawal({
        userId,
        epAmount: amtNum,
        method,
        fields,
        pin: pinOk ? pin : null,
        idempotencyKey: idempotencyKeyRef.current,
      });
      idempotencyKeyRef.current = null;
      setAmount(""); setFields({}); setPin(""); setPinOk(false);
      const val = `₦${Number(result.netNGN).toLocaleString()}`;
      showToast(result.refunded ? "err" : result.payoutWarning ? "err" : "ok", result.refunded
        ? `Payout could not be started; ${fmtEP(result.grossEP)} EP has been refunded. ${result.payoutWarning}`
        : result.payoutWarning
        ? `Request recorded; payout needs attention. ${result.payoutWarning}`
        : `Withdrawal submitted: ${fmtEP(result.netEp)} EP → ${val}`);
      setShowHist(true);
      await loadHistory();
      await loadDailyUsage();
      await refreshBalance();
    } catch (e) {
      setError(e.message || "Withdrawal failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  const handleRetry = async (id) => {
    try {
      await retryWithdrawalPayout(id);
      showToast("ok", "Payout initiation submitted. Check the withdrawal status below.");
    } catch (e) {
      showToast("err", e.message || "Payout retry failed.");
    } finally {
      await loadHistory();
      await loadDailyUsage();
      await refreshBalance();
    }
  };

  const btnCls  = !validation.ok ? "off" : submitting ? "busy" : "ok";

  return (
    <div className="wd">
      <style>{CSS}</style>

      {/* Header */}
      <div className="wd-hdr">
        <button className="wd-back" onClick={() => setActiveTab?.("overview")}><ArrowLeft size={14}/></button>
        <div>
          <div className="wd-htitle">Withdraw EP</div>
          <div className="wd-hsub">Bank payout · Paystack</div>
        </div>
      </div>

      {/* Hero Balance */}
      <div className="wd-hero">
        <div className="wd-hlabel">Available Balance</div>
        <div className="wd-hamt">
          <div className="wd-hnum">{fmtEP(epBalance)}</div>
          <div className="wd-hunit">EP</div>
        </div>
        <div className="wd-husd">{fmtUSD(epBalance)}</div>
        {dailyUsage && (
          <>
            <div className="wd-hdiv" />
            <div className="wd-hgrid">
              <div>
                <div className="wd-hslbl">Used today</div>
                <div className="wd-hsval" style={{ color: dailyUsage.pct > 80 ? "#f87171" : "rgba(255,255,255,.7)" }}>
                  {fmtEP(dailyUsage.used)} EP
                </div>
                <div className="wd-bar">
                  <div className="wd-barf" style={{
                    width:`${dailyUsage.pct}%`,
                    background: dailyUsage.pct > 80
                      ? "linear-gradient(90deg,#f87171,#ef4444)"
                      : "linear-gradient(90deg,#a3e635,#65a30d)",
                  }}/>
                </div>
              </div>
              <div>
                <div className="wd-hslbl">Remaining</div>
                <div className="wd-hsval" style={{ color:"#a3e635" }}>{fmtEP(dailyUsage.remaining)} EP</div>
              </div>
              <div>
                <div className="wd-hslbl">Daily limit</div>
                <div className="wd-hsval" style={{ color:"rgba(255,255,255,.4)" }}>{fmtEP(dailyUsage.limit)} EP</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Amount */}
      <div className="wd-card">
        <div className="wd-clbl">Withdrawal Amount</div>
        <div className={`wd-amtwrap${amtErr ? " err" : ""}`}>
          <input className="wd-amtinp" type="number" min={MIN_WITHDRAWAL_EP} step="1"
            value={amount} placeholder={`Min ${MIN_WITHDRAWAL_EP} EP`}
            onChange={e => { setAmount(e.target.value); setError(null); setPinOk(false); }}/>
          <span className="wd-amtunit">EP</span>
        </div>
        {dailyUsage && (
          <div className="wd-fnote">
            {dailyUsage.rewardLevel[0].toUpperCase() + dailyUsage.rewardLevel.slice(1)} reward level ·
            max {fmtEP(dailyUsage.maxPerRequest)} EP per request · {dailyUsage.feePct}% flat fee
          </div>
        )}
        {policyError && <div className="wd-err"><AlertTriangle size={13}/>{policyError}</div>}
        <div className="wd-amtrow">
          <button className="wd-maxbtn" onClick={() => setAmount(String(Math.floor(epBalance)))}>
            <ArrowUpToLine size={9}/> Max {fmtEP(epBalance)} EP
          </button>
          {amtNum > 0 && amtNum < MIN_WITHDRAWAL_EP && (
            <span className="wd-inerr"><AlertTriangle size={11}/> Min {MIN_WITHDRAWAL_EP} EP</span>
          )}
          {amtNum > epBalance && amtNum >= MIN_WITHDRAWAL_EP && (
            <span className="wd-inerr"><AlertTriangle size={11}/> Exceeds balance</span>
          )}
          {dailyUsage && amtNum > dailyUsage.maxPerRequest && (
            <span className="wd-inerr"><AlertTriangle size={11}/> Per-request limit {fmtEP(dailyUsage.maxPerRequest)} EP</span>
          )}
          {dailyUsage && amtNum <= dailyUsage.maxPerRequest && amtNum > dailyUsage.remaining && (
            <span className="wd-inerr"><AlertTriangle size={11}/> Daily limit {fmtEP(dailyUsage.remaining)} EP remaining</span>
          )}
        </div>
        <Breakdown preview={preview} method={method}/>
      </div>

      {/* Destination */}
      <DestForm method={method} onMethodChange={handleMethodChange} fields={fields} setFields={setFields}/>

      {/* PIN */}
      {needsPin && (
        <div className="wd-pincard">
          <div className="wd-pinh">
            {pinOk ? <Unlock size={14} color="#4ade80"/> : <Lock size={14} color="#fbbf24"/>}
            <span className="wd-pintit" style={{ color: pinOk ? "#4ade80" : undefined }}>
              {pinOk ? "PIN Verified ✓" : "Withdrawal PIN"}
            </span>
          </div>
          <div className="wd-pinsub">Required for withdrawals of {PIN_REQUIRED_EP.toLocaleString()} EP or more.</div>
          {!pinOk && (
            <>
              <div className="wd-pinrow">
                <input className="wd-pininp" type={showPin?"text":"password"} inputMode="numeric"
                  maxLength={12} placeholder="Enter your PIN" value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g,""))}
                  onKeyDown={e => e.key==="Enter" && handleVerifyPin()}/>
                <button className="wd-pintgl" onClick={() => setShowPin(v=>!v)}>
                  {showPin ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              <button className={`wd-pinbtn ${pinChecking || pin.length<4 ? "off":"ok"}`}
                onClick={handleVerifyPin} disabled={pinChecking || pin.length<4}>
                {pinChecking
                  ? <><Loader size={13} className="wd-spin"/> Verifying…</>
                  : <><Shield size={13}/> Verify PIN</>}
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="wd-err">
          <AlertTriangle size={13} style={{ flexShrink:0, marginTop:1 }}/> {error}
        </div>
      )}

      <button className={`wd-submit ${btnCls}`} onClick={handleSubmit} disabled={!validation.ok || submitting}>
        {submitting
          ? <><Loader size={15} className="wd-spin"/> Processing…</>
          : <><ArrowUpToLine size={15}/> {preview && amtNum >= MIN_WITHDRAWAL_EP ? `Withdraw ${fmtEP(amtNum)} EP` : "Withdraw EP"}</>
        }
      </button>

      <div className="wd-info">
        <Info size={13} style={{ flexShrink:0, marginTop:1 }}/>
        <span>Eligible bank withdrawals are submitted for payout immediately. Your reward level sets eligibility and the per-request limit; no account receives payout priority.</span>
      </div>

      {/* History */}
      <div className="wd-hcard">
        <div className="wd-hhd" onClick={() => setShowHist(v=>!v)}>
          <div style={{ display:"flex", alignItems:"center" }}>
            <span className="wd-hhlbl">Recent Withdrawals</span>
            {history.length > 0 && <span className="wd-hhcnt">{history.length}</span>}
          </div>
          <ChevronDown size={14} color="rgba(255,255,255,.25)"
            style={{ transition:"transform .2s", transform: showHist ? "rotate(180deg)" : "rotate(0deg)" }}/>
        </div>
        {showHist && (
          <div style={{ marginTop:14 }}>
            {histLoading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[1,2,3].map(i => <div key={i} className="wd-skel" style={{ height:52 }}/>)}
              </div>
            ) : historyError ? (
              <div className="wd-err"><AlertTriangle size={13}/>{historyError}</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign:"center", padding:"28px 0", color:"rgba(255,255,255,.2)" }}>
                <TrendingDown size={28} style={{ margin:"0 auto 10px", display:"block", opacity:.3 }}/>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>No withdrawals yet</div>
                <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>Your history will appear here</div>
              </div>
            ) : (
              <>
                {history.map(item => <HistRow key={item.id} item={item} onRetry={handleRetry}/>)}
                <div style={{ textAlign:"center", marginTop:12 }}>
                  <button onClick={() => { loadHistory(); loadDailyUsage(); }}
                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"1px solid rgba(255,255,255,.09)", background:"transparent", color:"rgba(255,255,255,.35)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
                    <RefreshCw size={10}/> Refresh
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className={`wd-toast ${toast.type}`}>
          {toast.type==="ok" ? <CheckCircle2 size={14} style={{flexShrink:0}}/> : <AlertTriangle size={14} style={{flexShrink:0}}/>}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}