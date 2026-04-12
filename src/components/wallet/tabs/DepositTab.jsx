// src/components/wallet/tabs/DepositTab.jsx
// ═══════════════════════════════════════════════════════════════════════════
//  DEPOSIT TAB  ·  v4  ·  Ultra-tight premium dark fintech UI
//
//  CHANGES FROM v3:
//   • Dual conversion input — left = ₦ local, right = EP or $XEV
//     Typing either side live-converts the other. No EP↔XEV mixing.
//   • Currency sub-labels moved BELOW the toggle (not crammed inside buttons)
//   • Method buttons are a horizontal ROW — no unnecessary height
//   • All method icons replaced with proper SVGs (card, download, chain)
//   • Outer shell padding removed — zero edge padding pressing component
//   • EP mode: ₦ ↔ EP conversion  |  XEV mode: ₦ ↔ $XEV conversion
//   • Quick amount buttons drive left (₦) input and auto-convert right
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Copy, CheckCircle, Shield, AlertCircle,
  X, Loader, Scan, ChevronRight, WifiOff, ArrowRight,
} from "lucide-react";
import { useAuth } from "../../Auth/AuthContext";
import {
  depositDetectBrowserWallets,
  depositSmartImport,
  depositCryptoVerify,
  depositPaystackOpen,
  getLiveUSDNGN,
  getCachedUSDNGN,
  MIN_DEPOSIT,
} from "../../../services/wallet/depositFundService";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  bg:    "#07080a",
  s1:    "#0d0f15",
  s2:    "#12151e",
  b1:    "#1c2030",
  b2:    "#252c3d",
  t1:    "#edf1fa",
  t2:    "#8c96b0",
  t3:    "#464f68",
  t4:    "#2a3044",
  gold:  "#e3bb4e",
  goldA: "rgba(227,187,78,0.12)",
  goldB: "rgba(227,187,78,0.35)",
  ep:    "#22d3ee",
  epA:   "rgba(34,211,238,0.1)",
  epB:   "rgba(34,211,238,0.3)",
  green: "#22c55e",
  red:   "#f87171",
  redA:  "rgba(248,113,113,0.08)",
  indigo:"#6366f1",
  teal:  "#10b981",
};

// ─── Networks ─────────────────────────────────────────────────────────────────
const NETWORKS = [
  { id:"usdt_trc20", label:"USDT", std:"TRC-20", net:"Tron",     col:"#26a17b", addr:"TQV7k1xBqBBJuZGLmqHnDLRFnHsGXFa2Kz" },
  { id:"usdt_erc20", label:"USDT", std:"ERC-20", net:"Ethereum", col:"#26a17b", addr:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"usdt_bep20", label:"USDT", std:"BEP-20", net:"BNB",      col:"#26a17b", addr:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"usdt_sol",   label:"USDT", std:"SPL",    net:"Solana",   col:"#26a17b", addr:"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" },
  { id:"eth",        label:"ETH",  std:"ERC-20", net:"Ethereum", col:"#627eea", addr:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"bnb",        label:"BNB",  std:"BEP-20", net:"BNB",      col:"#f0b90b", addr:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"trx",        label:"TRX",  std:"TRC-20", net:"Tron",     col:"#ef0027", addr:"TQV7k1xBqBBJuZGLmqHnDLRFnHsGXFa2Kz" },
  { id:"sol",        label:"SOL",  std:"Native", net:"Solana",   col:"#9945ff", addr:"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" },
];

// ─── SVG Icons (proper fintech icons, no emoji) ────────────────────────────────
const IconCard = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

const IconDownload = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconChain = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
);

const IconBuilding = ({ size = 17, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="11" rx="1"/>
    <path d="M3 10l9-7 9 7"/>
    <line x1="12" y1="10" x2="12" y2="21"/>
    <line x1="7" y1="10" x2="7" y2="21"/>
    <line x1="17" y1="10" x2="17" y2="21"/>
  </svg>
);

const IconScan = ({ size = 15, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');

@keyframes xSpin { to { transform: rotate(360deg); } }
.x-spin { animation: xSpin .8s linear infinite; }

@keyframes xFade { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
.x-fade { animation: xFade .22s ease both; }

@keyframes ratePulse { 0%,100%{opacity:1}50%{opacity:.4} }

/* ── shell: zero outer padding, fills container edge-to-edge ── */
.dt4-shell {
  color: ${T.t1};
  padding-bottom: 40px;
  font-family: 'Syne', sans-serif;
  /* NO horizontal padding on shell itself */
}

/* ── top bar ── */
.dt4-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px 8px;
  border-bottom: 1px solid ${T.b1};
}
.dt4-back {
  width: 30px; height: 30px; border-radius: 8px;
  border: 1px solid ${T.b1}; background: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${T.t2}; flex-shrink: 0;
  transition: border-color .15s, color .15s;
}
.dt4-back:hover { border-color: ${T.b2}; color: ${T.t1}; }
.dt4-bar-title { font-size: 13px; font-weight: 800; color: ${T.t1}; letter-spacing: .02em; }
.dt4-bar-sub { font-size: 10px; color: ${T.t3}; margin-top: 1px; font-family: 'DM Mono', monospace; }
.dt4-bal-chip {
  margin-left: auto; padding: 4px 10px; border-radius: 6px;
  background: ${T.goldA}; border: 1px solid ${T.goldB};
  font-size: 11px; font-weight: 800; color: ${T.gold};
  font-family: 'DM Mono', monospace; white-space: nowrap;
}

/* ── rate strip ── */
.dt4-rate {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 14px;
  background: ${T.s1}; border-bottom: 1px solid ${T.b1};
  font-family: 'DM Mono', monospace; font-size: 10px; color: ${T.t3};
}
.dt4-rate-dot {
  width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
}
.dt4-rate-dot.live {
  background: ${T.green}; box-shadow: 0 0 4px ${T.green};
  animation: ratePulse 1.8s ease-in-out infinite;
}
.dt4-rate-dot.stale { background: ${T.t3}; }
.dt4-rate-val { color: ${T.t2}; font-weight: 500; }

/* ── currency toggle ── */
.dt4-cur-wrap {
  margin: 10px 14px 0;
}
.dt4-cur {
  display: flex;
  background: ${T.s1}; border: 1px solid ${T.b1};
  border-radius: 10px; padding: 3px; gap: 3px; position: relative;
}
.dt4-cur-pill {
  position: absolute; top: 3px; bottom: 3px;
  border-radius: 8px; transition: left .2s cubic-bezier(.4,0,.2,1), width .2s;
  pointer-events: none; z-index: 0;
}
.dt4-cur-btn {
  flex: 1; padding: 8px 0; border-radius: 8px; border: none;
  font-size: 12px; font-weight: 800; cursor: pointer;
  font-family: 'Syne', sans-serif; letter-spacing: .02em;
  transition: color .18s; position: relative; z-index: 1;
  background: transparent;
}
.dt4-cur-btn.off { color: ${T.t3}; }
.dt4-cur-btn.on  { color: #07080a; }
/* Sub-label line BELOW the toggle, outside the button */
.dt4-cur-sub-line {
  font-size: 10px; font-family: 'DM Mono', monospace;
  color: ${T.t3}; text-align: center; margin-top: 5px;
  line-height: 1.4;
}

/* ── method row — horizontal, compact ── */
.dt4-methods {
  display: flex; gap: 4px; padding: 10px 14px 0;
}
.dt4-meth {
  flex: 1;
  display: flex; flex-direction: row; align-items: center;
  justify-content: center; gap: 7px;
  padding: 9px 8px; border-radius: 9px;
  border: 1px solid ${T.b1}; background: none;
  cursor: pointer; font-family: 'Syne', sans-serif;
  transition: all .14s;
}
.dt4-meth:hover { background: ${T.s1}; border-color: ${T.b2}; }
.dt4-meth.on { background: ${T.goldA}; border-color: ${T.goldB}; }
.dt4-meth-icon {
  width: 18px; height: 18px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  color: ${T.t3};
}
.dt4-meth.on .dt4-meth-icon { color: ${T.gold}; }
.dt4-meth-lbl { font-size: 11px; font-weight: 800; color: ${T.t3}; letter-spacing: .04em; }
.dt4-meth.on .dt4-meth-lbl { color: ${T.gold}; }

/* ── divider ── */
.dt4-div { height: 1px; background: ${T.b1}; margin: 10px 14px 0; }

/* ══════════════════════════════════════════
   DUAL CONVERSION INPUT
══════════════════════════════════════════ */
.dt4-dual-wrap { padding: 12px 14px 0; display: flex; flex-direction: column; gap: 8px; }

.dt4-dual-row {
  display: flex; align-items: stretch; gap: 8px;
}

.dt4-dual-box {
  flex: 1; min-width: 0;
  padding: 10px 12px 8px;
  border: 1px solid ${T.b1}; border-radius: 10px;
  background: ${T.s1};
  transition: border-color .18s;
  display: flex; flex-direction: column; gap: 4px;
}
.dt4-dual-box:focus-within { border-color: ${T.goldB}; }

.dt4-dual-label {
  font-size: 9px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: ${T.t3};
  font-family: 'Syne', sans-serif;
}

.dt4-dual-inner { display: flex; align-items: baseline; gap: 4px; }

.dt4-dual-sym {
  font-size: 14px; font-weight: 800; color: ${T.t3};
  font-family: 'DM Mono', monospace; flex-shrink: 0; line-height: 1;
}

.dt4-dual-input {
  flex: 1; background: none; border: none; outline: none;
  font-family: 'DM Mono', monospace; font-size: 26px;
  font-weight: 500; color: ${T.t1}; min-width: 0;
  letter-spacing: -.02em; width: 100%;
}
.dt4-dual-input::placeholder { color: ${T.t4}; }

.dt4-dual-cur {
  font-size: 10px; font-weight: 800; color: ${T.t3};
  font-family: 'Syne', sans-serif; letter-spacing: .06em;
}

/* arrow between boxes */
.dt4-dual-arrow {
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; width: 24px;
}
.dt4-dual-arrow-circle {
  width: 22px; height: 22px; border-radius: 50%;
  background: ${T.b1}; border: 1px solid ${T.b2};
  display: flex; align-items: center; justify-content: center;
  color: ${T.t3};
}

/* ── quick amounts ── */
.dt4-quick { display: flex; gap: 4px; }
.dt4-q {
  flex: 1; padding: 6px 0; border-radius: 7px;
  border: 1px solid ${T.b1}; background: none;
  font-size: 11px; font-weight: 800; color: ${T.t3};
  cursor: pointer; font-family: 'DM Mono', monospace;
  transition: all .12s;
}
.dt4-q:hover { border-color: ${T.b2}; color: ${T.t2}; }
.dt4-q.on { background: ${T.goldA}; border-color: ${T.goldB}; color: ${T.gold}; }

/* ── pay action buttons ── */
.dt4-actions { padding: 10px 14px 0; display: flex; flex-direction: column; gap: 5px; }

.dt4-pay-btn {
  display: flex; align-items: center; gap: 11px;
  padding: 11px 14px; border-radius: 11px;
  border: 1px solid ${T.b2}; background: ${T.s1};
  cursor: pointer; font-family: 'Syne', sans-serif;
  width: 100%; text-align: left; transition: all .15s;
}
.dt4-pay-btn:hover:not(:disabled) {
  background: ${T.s2}; border-color: ${T.b2};
  transform: translateY(-1px);
}
.dt4-pay-btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }
.dt4-pay-btn.loading { opacity: .6; pointer-events: none; }

.dt4-pay-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.dt4-pay-name { font-size: 13px; font-weight: 800; color: ${T.t1}; }
.dt4-pay-sub { font-size: 10px; color: ${T.t3}; margin-top: 2px; font-family: 'DM Mono', monospace; }
.dt4-pay-badge {
  margin-left: auto; padding: 3px 9px; border-radius: 20px;
  font-size: 9px; font-weight: 800; flex-shrink: 0;
  font-family: 'DM Mono', monospace; letter-spacing: .06em;
}

/* ── primary CTA ── */
.dt4-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, ${T.gold} 0%, #c89826 100%);
  border: none; border-radius: 11px;
  font-size: 14px; font-weight: 800; color: #0a0b0e;
  cursor: pointer; font-family: 'Syne', sans-serif;
  letter-spacing: .02em;
  box-shadow: 0 4px 20px rgba(227,187,78,.18);
  transition: opacity .15s, transform .12s;
}
.dt4-cta:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
.dt4-cta:disabled { opacity: .25; cursor: not-allowed; transform: none; box-shadow: none; }

.dt4-ghost {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 10px;
  border: 1px solid ${T.b1}; background: none; border-radius: 11px;
  font-size: 12px; font-weight: 800; color: ${T.t2};
  cursor: pointer; font-family: 'Syne', sans-serif;
  transition: all .15s; margin-top: 5px;
}
.dt4-ghost:hover { border-color: ${T.b2}; color: ${T.t1}; background: ${T.s1}; }

/* ── alerts ── */
.dt4-ok {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 12px; border-radius: 9px; margin: 8px 14px 0;
  background: rgba(34,197,94,.07); border: 1px solid rgba(34,197,94,.2);
  font-size: 12px; font-weight: 600; color: ${T.green}; line-height: 1.5;
}
.dt4-err {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 12px; border-radius: 9px; margin: 8px 14px 0;
  background: rgba(248,113,113,.07); border: 1px solid rgba(248,113,113,.2);
  font-size: 12px; font-weight: 600; color: ${T.red}; line-height: 1.5;
}

/* ── info strip ── */
.dt4-info {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 9px 12px; margin: 10px 14px 0;
  background: rgba(34,211,238,.04);
  border: 1px solid rgba(34,211,238,.1); border-radius: 9px;
}
.dt4-info h5 { font-size: 11px; font-weight: 800; color: ${T.ep}; margin: 0 0 2px; }
.dt4-info p  { font-size: 10.5px; color: ${T.t3}; margin: 0; line-height: 1.55; }

/* ── warn ── */
.dt4-warn {
  display: flex; gap: 7px; align-items: flex-start;
  padding: 7px 10px; margin-top: 7px;
  background: rgba(248,113,113,.05);
  border: 1px solid rgba(248,113,113,.15); border-radius: 8px;
  font-size: 10.5px; color: ${T.red}; line-height: 1.5;
}

/* ── sections (receive / import inner) ── */
.dt4-section { padding: 0 14px; margin-top: 10px; }
.dt4-label {
  font-size: 9.5px; font-weight: 800; letter-spacing: .08em;
  text-transform: uppercase; color: ${T.t3}; margin-bottom: 6px; display: block;
  font-family: 'Syne', sans-serif;
}
.dt4-input {
  width: 100%; padding: 10px 12px;
  background: ${T.s1}; border: 1px solid ${T.b1}; border-radius: 8px;
  font-size: 13px; color: ${T.t1}; font-family: 'DM Mono', monospace;
  outline: none; box-sizing: border-box; transition: border-color .15s;
}
.dt4-input::placeholder { color: ${T.t4}; }
.dt4-input:focus { border-color: ${T.goldB}; }

/* ── network grid ── */
.dt4-ngrid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
  padding: 0 14px; margin-top: 10px;
}
.dt4-nbtn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 8px 4px; border-radius: 8px;
  border: 1px solid ${T.b1}; background: none;
  cursor: pointer; font-family: 'Syne', sans-serif; transition: all .12s;
}
.dt4-nbtn:hover { background: ${T.s1}; border-color: ${T.b2}; }
.dt4-nbtn.on { background: ${T.goldA}; border-color: ${T.goldB}; }
.dt4-nbtn-tk { font-size: 11px; font-weight: 800; color: ${T.t2}; }
.dt4-nbtn.on .dt4-nbtn-tk { color: ${T.gold}; }
.dt4-nbtn-std { font-size: 8px; color: ${T.t3}; }

/* ── address box ── */
.dt4-addr {
  margin: 8px 14px 0;
  background: ${T.s1}; border: 1px solid ${T.b1}; border-radius: 9px;
  padding: 10px 12px;
}
.dt4-addr-row { display: flex; align-items: flex-start; gap: 8px; }
.dt4-addr-text {
  font-family: 'DM Mono', monospace; font-size: 11px; color: ${T.t2};
  word-break: break-all; line-height: 1.6; flex: 1;
}
.dt4-copy-btn {
  width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
  background: ${T.b1}; border: 1px solid ${T.b2};
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${T.t3}; transition: all .14s; margin-top: 1px;
}
.dt4-copy-btn:hover { border-color: ${T.goldB}; color: ${T.gold}; }
.dt4-copy-btn.ok { border-color: rgba(34,197,94,.4); color: ${T.green}; }

/* ── net strip ── */
.dt4-nstrip {
  display: flex; margin: 6px 14px 0;
  background: ${T.s1}; border: 1px solid ${T.b1}; border-radius: 8px;
  overflow: hidden;
}
.dt4-np {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 6px 4px; border-right: 1px solid ${T.b1};
}
.dt4-np:last-child { border-right: none; }
.dt4-npk { font-size: 8px; color: ${T.t4}; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-family: 'Syne', sans-serif; }
.dt4-npv { font-size: 11px; font-weight: 800; color: ${T.t1}; font-family: 'DM Mono', monospace; }

/* ── wallet cards ── */
.dt4-wcard {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 9px; margin-bottom: 5px;
  border: 1px solid rgba(34,197,94,.25); background: rgba(34,197,94,.03);
}
.dt4-wicon {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.dt4-wimport {
  padding: 6px 12px; border-radius: 7px; font-size: 11px; font-weight: 800;
  color: ${T.gold}; background: ${T.goldA}; border: 1px solid ${T.goldB};
  cursor: pointer; font-family: 'Syne', sans-serif; transition: all .12s;
}
.dt4-wimport:hover { background: rgba(227,187,78,.18); }
.dt4-wremove {
  font-size: 9px; color: ${T.t4}; cursor: pointer; background: none;
  border: none; font-family: 'DM Mono', monospace; display: block;
  margin-top: 3px; text-align: right; transition: color .12s;
}
.dt4-wremove:hover { color: ${T.red}; }

/* ── scan btn ── */
.dt4-scan-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 12px; border-radius: 9px;
  border: 1px dashed ${T.b2}; background: none;
  cursor: pointer; font-family: 'Syne', sans-serif;
  text-align: left; transition: all .15s; margin-top: 4px;
}
.dt4-scan-btn:hover { border-color: ${T.goldB}; background: ${T.goldA}; }

/* ── done screen ── */
.dt4-done {
  display: flex; flex-direction: column; align-items: center;
  padding: 36px 20px 24px; text-align: center; animation: xFade .3s ease;
}
.dt4-done-ring {
  width: 60px; height: 60px; border-radius: 50%;
  background: rgba(34,197,94,.1); border: 1.5px solid rgba(34,197,94,.35);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px; box-shadow: 0 0 28px rgba(34,197,94,.1);
}
.dt4-done h2 { font-size: 20px; font-weight: 800; color: ${T.t1}; margin: 0 0 5px; }
.dt4-done p  { font-size: 12px; color: ${T.t3}; margin: 0; line-height: 1.6; }
.dt4-done-ref { font-size: 10px; font-family: 'DM Mono', monospace; color: ${T.t4}; margin-top: 3px; }
.dt4-done-chip {
  padding: 8px 20px; border-radius: 20px; font-size: 14px;
  font-weight: 800; font-family: 'DM Mono', monospace;
  border: 1px solid; margin: 14px 0 20px;
}

/* ── loading screen ── */
.dt4-loading {
  display: flex; flex-direction: column; align-items: center;
  padding: 48px 20px; gap: 12px; text-align: center;
}
.dt4-loading-ring {
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
`;

// ─── Conversion helpers ────────────────────────────────────────────────────────
// EP: ₦1 = 1 EP  (since 1 USD = 100 EP, and rate gives USD/NGN)
// XEV: ₦2.50 = 1 XEV
function nairaToEP(naira, rate)  { return Math.round((parseFloat(naira) / rate) * 100); }
function epToNaira(ep, rate)     { return Math.round((parseFloat(ep) / 100) * rate); }
function nairaToXEV(naira)       { return +(parseFloat(naira) / 2.5).toFixed(2); }
function xevToNaira(xev)         { return Math.round(parseFloat(xev) * 2.5); }

// ─── Shared mini components ────────────────────────────────────────────────────
const Ok = ({ msg }) => msg ? (
  <div className="dt4-ok">
    <CheckCircle size={14} style={{flexShrink:0,marginTop:1}}/>{msg}
  </div>
) : null;

const Err = ({ msg }) => msg ? (
  <div className="dt4-err">
    <AlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>{msg}
  </div>
) : null;

const SpinScreen = ({ ring, title, sub }) => (
  <div className="dt4-loading">
    <div className="dt4-loading-ring" style={ring}>
      <Loader size={24} color={ring.color || T.gold} className="x-spin"/>
    </div>
    <div style={{fontSize:14,fontWeight:800,color:T.t1}}>{title}</div>
    {sub && <div style={{fontSize:11,color:T.t3,whiteSpace:"pre-line"}}>{sub}</div>}
  </div>
);

// ─── Live rate hook ────────────────────────────────────────────────────────────
function useRate() {
  const [rate, setRate] = useState(getCachedUSDNGN());
  const [live, setLive] = useState(false);
  useEffect(() => {
    getLiveUSDNGN().then(r => { setRate(r); setLive(true); }).catch(() => {});
  }, []);
  return { rate, live };
}

// ─── Currency Toggle ───────────────────────────────────────────────────────────
function CurrencyToggle({ value, onChange, rate }) {
  const isEP = value === "EP";
  const colEP  = `linear-gradient(135deg,${T.ep},#0ea5e9)`;
  const colXEV = `linear-gradient(135deg,${T.gold},#c89826)`;
  const subLine = isEP
    ? `1 USD = 100 EP · ₦${rate.toLocaleString(undefined,{maximumFractionDigits:0})} = 100 EP`
    : `₦2.50 = 1 $XEV · 1 USD ≈ ${Math.round(rate / 2.5).toLocaleString()} XEV`;

  return (
    <div className="dt4-cur-wrap">
      <div className="dt4-cur">
        <div className="dt4-cur-pill" style={{
          left: isEP ? "3px" : "calc(50% + 1.5px)",
          width: "calc(50% - 4.5px)",
          background: isEP ? colEP : colXEV,
        }}/>
        <button className={`dt4-cur-btn ${isEP ? "on" : "off"}`} onClick={() => onChange("EP")}>
          ⚡ EP
        </button>
        <button className={`dt4-cur-btn ${!isEP ? "on" : "off"}`} onClick={() => onChange("XEV")}>
          🪙 $XEV
        </button>
      </div>
      <div className="dt4-cur-sub-line">{subLine}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DUAL CONVERSION INPUT
//  Left = ₦ (local), Right = EP or $XEV
//  Typing either side converts the other in real-time
// ═══════════════════════════════════════════════════════════════════════════
function DualInput({ currency, rate, onNairaChange }) {
  const [leftVal,  setLeftVal]  = useState("");
  const [rightVal, setRightVal] = useState("");
  const [activeQ,  setActiveQ]  = useState(null);
  const updatingRef = useRef(false);

  const isEP = currency === "EP";
  const rightColor = isEP ? T.ep : T.gold;
  const rightLabel = isEP ? "You Get (EP)" : "You Get ($XEV)";
  const rightSym   = isEP ? "⚡" : "🪙";
  const rightCur   = isEP ? "EP" : "$XEV";

  // When currency switches, recompute right from current left
  useEffect(() => {
    if (!leftVal) { setRightVal(""); return; }
    const n = parseFloat(leftVal);
    if (!n) return;
    setRightVal(isEP ? String(nairaToEP(n, rate)) : String(nairaToXEV(n)));
  }, [currency, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeft = (v) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setLeftVal(v);
    setActiveQ(null);
    const n = parseFloat(v);
    if (v === "" || !n) {
      setRightVal("");
    } else {
      setRightVal(isEP ? String(nairaToEP(n, rate)) : String(nairaToXEV(n)));
    }
    if (onNairaChange) onNairaChange(v);
    updatingRef.current = false;
  };

  const handleRight = (v) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setRightVal(v);
    setActiveQ(null);
    const n = parseFloat(v);
    if (v === "" || !n) {
      setLeftVal("");
      if (onNairaChange) onNairaChange("");
    } else {
      const naira = isEP ? String(epToNaira(n, rate)) : String(xevToNaira(n));
      setLeftVal(naira);
      if (onNairaChange) onNairaChange(naira);
    }
    updatingRef.current = false;
  };

  const setQuick = (amt) => {
    setActiveQ(amt);
    handleLeft(String(amt));
  };

  return (
    <div className="dt4-dual-wrap">
      <div className="dt4-dual-row">
        {/* LEFT — Naira */}
        <div className="dt4-dual-box">
          <div className="dt4-dual-label">You Pay (₦)</div>
          <div className="dt4-dual-inner">
            <span className="dt4-dual-sym">₦</span>
            <input
              className="dt4-dual-input"
              type="number"
              placeholder="0"
              value={leftVal}
              onChange={e => handleLeft(e.target.value)}
            />
          </div>
          <div className="dt4-dual-cur">NGN</div>
        </div>

        {/* ARROW */}
        <div className="dt4-dual-arrow">
          <div className="dt4-dual-arrow-circle">
            <ArrowRight size={11} color={T.t3}/>
          </div>
        </div>

        {/* RIGHT — EP or $XEV */}
        <div className="dt4-dual-box">
          <div className="dt4-dual-label">{rightLabel}</div>
          <div className="dt4-dual-inner">
            <span className="dt4-dual-sym" style={{color: rightColor}}>{rightSym}</span>
            <input
              className="dt4-dual-input"
              type="number"
              placeholder="0"
              value={rightVal}
              onChange={e => handleRight(e.target.value)}
              style={{color: rightColor}}
            />
          </div>
          <div className="dt4-dual-cur" style={{color: rightColor}}>{rightCur}</div>
        </div>
      </div>

      {/* QUICK AMOUNTS */}
      <div className="dt4-quick">
        {[500, 1000, 2000, 5000].map(a => (
          <button
            key={a}
            className={`dt4-q${activeQ === a ? " on" : ""}`}
            onClick={() => setQuick(a)}
          >
            ₦{a >= 1000 ? `${a / 1000}k` : a}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODE 1 — PAY (Paystack)
// ═══════════════════════════════════════════════════════════════════════════
function PayMode({ userId, email, currency, onRefresh, onBack, rate }) {
  const [naira,   setNaira]   = useState("");
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);

  const open = async (channel) => {
    const n = parseFloat(naira);
    if (!n || n < MIN_DEPOSIT) { setError(`Minimum ₦${MIN_DEPOSIT}`); return; }
    setError(""); setLoading(channel);
    try {
      const res = await depositPaystackOpen({
        userId, email, nairaAmount: naira, channel, currency,
        onCancel: () => setLoading(null),
      });
      setResult(res);
      if (onRefresh) onRefresh();
    } catch (e) {
      if (!e.cancelled) setError(e.message || "Payment failed");
    } finally { setLoading(null); }
  };

  const col  = currency === "XEV" ? T.gold : T.ep;
  const colA = currency === "XEV" ? T.goldA : T.epA;
  const colB = currency === "XEV" ? T.goldB : T.epB;
  const creditLabel = currency === "XEV" ? "$XEV" : "EP";

  if (result) return (
    <div className="dt4-done">
      <div className="dt4-done-ring"><CheckCircle size={28} color={T.green}/></div>
      <h2>Payment Initiated</h2>
      <p>₦{parseFloat(naira).toLocaleString()} via Paystack<br/>
        Your balance updates once confirmed.</p>
      <div className="dt4-done-ref">ref: {result.reference}</div>
      <div className="dt4-done-chip" style={{color:col,borderColor:colB,background:colA}}>
        +{result.credit} {result.label || creditLabel}
      </div>
      <button className="dt4-cta" onClick={() => { setResult(null); setNaira(""); }}>Add More</button>
      <button className="dt4-ghost" onClick={onBack}>Back to Wallet</button>
    </div>
  );

  const canPay = !!naira && parseFloat(naira) >= MIN_DEPOSIT;

  return (
    <>
      <DualInput currency={currency} rate={rate} onNairaChange={setNaira}/>

      <Err msg={error}/>

      <div className="dt4-actions">
        {/* Card */}
        <button
          className={`dt4-pay-btn${loading === "card" ? " loading" : ""}`}
          onClick={() => open("card")}
          disabled={!!loading || !canPay}
        >
          <div className="dt4-pay-icon" style={{background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.28)"}}>
            {loading === "card"
              ? <Loader size={17} color={T.indigo} className="x-spin"/>
              : <IconCard size={17} color={T.indigo}/>}
          </div>
          <div style={{flex:1}}>
            <div className="dt4-pay-name">Pay with Card</div>
            <div className="dt4-pay-sub">Visa · Mastercard · Verve · All cards</div>
          </div>
          <div className="dt4-pay-badge"
            style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.25)",color:T.indigo}}>
            {loading === "card" ? "OPENING" : "INSTANT"}
          </div>
        </button>

        {/* Bank transfer */}
        <button
          className={`dt4-pay-btn${loading === "bank_transfer" ? " loading" : ""}`}
          onClick={() => open("bank_transfer")}
          disabled={!!loading || !canPay}
        >
          <div className="dt4-pay-icon" style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)"}}>
            {loading === "bank_transfer"
              ? <Loader size={17} color={T.teal} className="x-spin"/>
              : <IconBuilding size={17} color={T.teal}/>}
          </div>
          <div style={{flex:1}}>
            <div className="dt4-pay-name">Bank Transfer</div>
            <div className="dt4-pay-sub">Any Nigerian bank · Virtual account</div>
          </div>
          <div className="dt4-pay-badge"
            style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.22)",color:T.teal}}>
            {loading === "bank_transfer" ? "OPENING" : "REAL-TIME"}
          </div>
        </button>
      </div>

      <div className="dt4-info">
        <Shield size={13} style={{flexShrink:0,marginTop:2,color:T.ep}}/>
        <div>
          <h5>Secured by Paystack</h5>
          <p>PCI-DSS Level 1. Paystack handles the entire payment. Your {currency} is credited automatically after webhook confirmation.</p>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODE 2 — IMPORT (browser wallet)
// ═══════════════════════════════════════════════════════════════════════════
function ImportMode({ userId, currency, onRefresh, onBack, rate }) {
  const KEY  = `xev_wl_${userId}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} };

  const [phase,   setPhase]   = useState("list");
  const [wallets, setWallets] = useState(load);
  const [sel,     setSel]     = useState(null);
  const [naira,   setNaira]   = useState("");
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);

  const scan = useCallback(async () => {
    setPhase("scanning"); setError("");
    try {
      const found  = await depositDetectBrowserWallets();
      const merged = [...wallets];
      found.forEach(w => { if (!merged.find(m => m.id === w.id)) merged.push(w); });
      setWallets(merged); save(merged);
    } catch (e) { setError(e.message); }
    setPhase("list");
  }, [wallets]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (id) => { const n = wallets.filter(w => w.id !== id); setWallets(n); save(n); };

  const doImport = useCallback(async () => {
    if (!sel) return;
    const n = parseFloat(naira);
    if (!n || n < MIN_DEPOSIT) { setError(`Minimum ₦${MIN_DEPOSIT}`); return; }
    setError(""); setPhase("signing");
    try {
      const res = await depositSmartImport({ wallet: sel, nairaAmount: naira, userId, currency });
      setResult(res); setPhase("done");
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message || "Import failed");
      setPhase("amount");
    }
  }, [sel, naira, userId, currency, onRefresh]);

  const col  = currency === "XEV" ? T.gold : T.ep;
  const colA = currency === "XEV" ? T.goldA : T.epA;
  const colB = currency === "XEV" ? T.goldB : T.epB;

  if (phase === "done" && result) return (
    <div className="dt4-done">
      <div className="dt4-done-ring"><CheckCircle size={28} color={T.green}/></div>
      <h2>Import Done!</h2>
      <p>Signed via {sel?.name}</p>
      <div className="dt4-done-ref">ref: {result.reference}</div>
      <div className="dt4-done-chip" style={{color:col,borderColor:colB,background:colA}}>
        +{result.credit} {result.label}
      </div>
      <button className="dt4-cta" onClick={onBack}>Back to Wallet</button>
      <button className="dt4-ghost" onClick={() => { setPhase("list"); setResult(null); }}>Import More</button>
    </div>
  );

  if (phase === "signing") return (
    <SpinScreen
      ring={{background:T.goldA,border:`1px solid ${T.goldB}`,color:T.gold}}
      title="Awaiting signature…"
      sub={`${sel?.name} is showing a request.\nCheck your wallet extension.`}
    />
  );

  if (phase === "scanning") return (
    <SpinScreen
      ring={{background:T.epA,border:`1px solid ${T.epB}`,color:T.ep}}
      title="Scanning browser…"
      sub="MetaMask · Phantom · TronLink · Coinbase · Rabby"
    />
  );

  if (phase === "amount" && sel) return (
    <>
      {/* Selected wallet row */}
      <div style={{
        display:"flex",alignItems:"center",gap:10,
        padding:"10px 12px",margin:"10px 14px 0",
        background:`${sel.color}0f`,border:`1px solid ${sel.color}40`,borderRadius:9,
      }}>
        <div className="dt4-wicon" style={{background:`${sel.color}18`,fontSize:20}}>{sel.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:800,color:T.t1}}>{sel.name}</div>
          <div style={{fontSize:10,color:T.t3,fontFamily:"'DM Mono',monospace"}}>{sel.currency}</div>
        </div>
        <button onClick={() => setPhase("list")} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,display:"flex"}}>
          <X size={14}/>
        </button>
      </div>

      <DualInput currency={currency} rate={rate} onNairaChange={setNaira}/>

      <Err msg={error}/>

      <div className="dt4-actions">
        <button className="dt4-cta"
          disabled={!naira || parseFloat(naira) < MIN_DEPOSIT}
          onClick={doImport}>
          <IconDownload size={15} color="#0a0b0e"/> Import from {sel.name}
        </button>
        <button className="dt4-ghost" onClick={() => setPhase("list")}>← Back</button>
      </div>
    </>
  );

  return (
    <div className="dt4-section" style={{paddingBottom:8}}>
      <div style={{fontSize:12,fontWeight:800,color:T.t1,marginBottom:4,marginTop:2}}>Connected Wallets</div>
      <div style={{fontSize:11,color:T.t3,marginBottom:10,fontFamily:"'DM Mono',monospace"}}>
        Select → enter amount → sign once → {currency} credited instantly
      </div>

      {!wallets.length && (
        <div style={{padding:"24px 0 16px",textAlign:"center",color:T.t3}}>
          <WifiOff size={28} style={{opacity:.2,marginBottom:8,display:"block",margin:"0 auto 8px"}}/>
          <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:3}}>No wallets detected</div>
          <div style={{fontSize:11}}>Scan your browser below</div>
        </div>
      )}

      {wallets.map(w => (
        <div key={w.id} className="dt4-wcard">
          <div className="dt4-wicon" style={{background:`${w.color}18`,border:`1px solid ${w.color}35`}}>
            {w.icon}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:800,color:T.t1}}>{w.name}</div>
            <div style={{fontSize:9,color:T.green,fontWeight:700,display:"flex",alignItems:"center",gap:4,marginTop:2,fontFamily:"'DM Mono',monospace"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:T.green,flexShrink:0}}/>
              {w.currency}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
            <button className="dt4-wimport"
              onClick={() => { setSel(w); setNaira(""); setError(""); setPhase("amount"); }}>
              Import →
            </button>
            <button className="dt4-wremove" onClick={() => remove(w.id)}>remove</button>
          </div>
        </div>
      ))}

      <button className="dt4-scan-btn" onClick={scan}>
        <div style={{width:32,height:32,borderRadius:8,border:`1px dashed ${T.b2}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:T.t3}}>
          <IconScan size={15} color={T.t3}/>
        </div>
        <div style={{textAlign:"left",flex:1}}>
          <div style={{fontSize:12,fontWeight:800,color:T.t2}}>{wallets.length ? "Scan for More" : "Detect Wallets"}</div>
          <div style={{fontSize:10,color:T.t4,marginTop:1,fontFamily:"'DM Mono',monospace"}}>MetaMask · Phantom · TronLink · Coinbase</div>
        </div>
        <ChevronRight size={13} color={T.t4}/>
      </button>

      <Err msg={error}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODE 3 — RECEIVE (on-chain)
// ═══════════════════════════════════════════════════════════════════════════
function ReceiveMode({ userId, currency, onRefresh, rate }) {
  const [net,       setNet]       = useState(NETWORKS[0]);
  const [txHash,    setTxHash]    = useState("");
  const [naira,     setNaira]     = useState("");
  const [copied,    setCopied]    = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status,    setStatus]    = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const verify = async () => {
    if (!txHash.trim()) return;
    setVerifying(true); setStatus(null);
    try {
      const r = await depositCryptoVerify({
        userId, txHash: txHash.trim(), tokenId: net.id,
        network: net.net, nairaEquivalent: parseFloat(naira) || 0, currency,
      });
      if (r.success) {
        const amount = currency === "XEV"
          ? nairaToXEV(parseFloat(naira) || 0)
          : nairaToEP(parseFloat(naira) || 0, rate);
        setStatusMsg(`Verified! +${amount} ${currency} credited.`);
        setStatus("ok");
        if (onRefresh) onRefresh();
      } else {
        setStatus("err"); setStatusMsg("Transaction not found. Verify hash and network.");
      }
    } catch (e) { setStatus("err"); setStatusMsg(e.message); }
    finally { setVerifying(false); }
  };

  return (
    <>
      {/* Network grid */}
      <div className="dt4-ngrid" style={{marginTop:10}}>
        {NETWORKS.map(n => (
          <button key={n.id}
            className={`dt4-nbtn${net.id === n.id ? " on" : ""}`}
            onClick={() => { setNet(n); setCopied(false); setTxHash(""); setStatus(null); }}>
            <span className="dt4-nbtn-tk" style={net.id === n.id ? {color:n.col} : {}}>{n.label}</span>
            <span className="dt4-nbtn-std">{n.std}</span>
          </button>
        ))}
      </div>

      {/* Network strip */}
      <div className="dt4-nstrip">
        {[["Token",net.label],["Net",net.net],["Std",net.std],["Min","$1"]].map(([k,v]) => (
          <div key={k} className="dt4-np">
            <span className="dt4-npk">{k}</span>
            <span className="dt4-npv" style={k==="Token"?{color:net.col}:{}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Address */}
      <div className="dt4-addr">
        <div style={{fontSize:9,color:T.t4,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:7,fontFamily:"'Syne',sans-serif"}}>
          Send {net.label} ({net.std}) · {net.net} only
        </div>
        <div className="dt4-addr-row">
          <code className="dt4-addr-text">{net.addr}</code>
          <button className={`dt4-copy-btn${copied?" ok":""}`} onClick={() => copy(net.addr)}>
            {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
          </button>
        </div>
        <div className="dt4-warn">
          <AlertCircle size={12} style={{flexShrink:0,marginTop:1}}/>
          <span>Only send <strong>{net.label} on {net.net}</strong>. Wrong network = <strong>permanent loss</strong>.</span>
        </div>
      </div>

      {/* Verify */}
      <div className="dt4-section" style={{marginTop:10}}>
        <label className="dt4-label">Transaction Hash (TXID)</label>
        <input className="dt4-input" placeholder={net.net === "Tron" ? "transaction hash…" : "0x…"}
          value={txHash} onChange={e => { setTxHash(e.target.value); setStatus(null); }}/>

        <label className="dt4-label" style={{marginTop:8}}>₦ Value (for EP / $XEV preview)</label>
        <div style={{position:"relative"}}>
          <span style={{
            position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",
            fontSize:13,fontWeight:800,color:T.t3,fontFamily:"'DM Mono',monospace",pointerEvents:"none",
          }}>₦</span>
          <input className="dt4-input" style={{paddingLeft:22}} type="number"
            placeholder="0" value={naira} onChange={e => setNaira(e.target.value)}/>
        </div>

        {naira && (
          <div style={{fontSize:11,color:T.t3,fontFamily:"'DM Mono',monospace",marginTop:6}}>
            {currency === "XEV"
              ? `₦${parseFloat(naira).toLocaleString()} → +${nairaToXEV(parseFloat(naira))} $XEV`
              : `₦${parseFloat(naira).toLocaleString()} → +${nairaToEP(parseFloat(naira), rate)} EP`}
          </div>
        )}

        {status === "ok"  && <Ok  msg={statusMsg}/>}
        {status === "err" && <Err msg={statusMsg}/>}
      </div>

      <div className="dt4-actions">
        <button className="dt4-cta" disabled={!txHash.trim() || verifying} onClick={verify}>
          {verifying ? <Loader size={15} className="x-spin"/> : <Shield size={15}/>}
          {verifying ? "Verifying…" : "Verify & Credit Wallet"}
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN — DepositTab
// ═══════════════════════════════════════════════════════════════════════════
const METHODS = [
  { id:"pay",     icon: <IconCard size={16}/>,     label:"PAY"     },
  { id:"import",  icon: <IconDownload size={16}/>, label:"IMPORT"  },
  { id:"receive", icon: <IconChain size={16}/>,    label:"RECEIVE" },
];

const DepositTab = ({ setActiveTab, userId, balance, onRefresh }) => {
  const { user } = useAuth() || {};
  const [method,   setMethod]   = useState("pay");
  const [currency, setCurrency] = useState("EP");
  const { rate, live } = useRate();

  const email      = user?.email || "";
  const xevBalance = balance?.tokens ?? 0;

  return (
    <div className="dt4-shell x-fade">
      <style>{CSS}</style>

      {/* ── Top bar ── */}
      <div className="dt4-bar">
        <button className="dt4-back" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={14}/>
        </button>
        <div style={{flex:1}}>
          <div className="dt4-bar-title">Add Funds</div>
          <div className="dt4-bar-sub">Xeevia Wallet</div>
        </div>
        <div className="dt4-bal-chip">
          {xevBalance.toLocaleString(undefined, {maximumFractionDigits:4})} XEV
        </div>
      </div>

      {/* ── Live rate strip ── */}
      <div className="dt4-rate">
        <div className={`dt4-rate-dot ${live ? "live" : "stale"}`}/>
        <span>1 USD</span>
        <span style={{color:T.t4}}>=</span>
        <span className="dt4-rate-val">₦{rate.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
        <span style={{color:T.t4}}>·</span>
        <span>100 EP</span>
        <span style={{color:T.t4,marginLeft:"auto"}}>{live ? "live" : "cached"}</span>
      </div>

      {/* ── Currency toggle (sub-label outside buttons) ── */}
      <CurrencyToggle value={currency} onChange={setCurrency} rate={rate}/>

      {/* ── Method tabs — horizontal row ── */}
      <div className="dt4-methods">
        {METHODS.map(m => (
          <button
            key={m.id}
            className={`dt4-meth${method === m.id ? " on" : ""}`}
            onClick={() => setMethod(m.id)}
          >
            <span className="dt4-meth-icon">{m.icon}</span>
            <span className="dt4-meth-lbl">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="dt4-div"/>

      {/* ── Panels ── */}
      {method === "pay" && (
        <PayMode
          userId={userId} email={email} currency={currency}
          onRefresh={onRefresh} onBack={() => setActiveTab("overview")} rate={rate}
        />
      )}
      {method === "import" && (
        <ImportMode
          userId={userId} currency={currency}
          onRefresh={onRefresh} onBack={() => setActiveTab("overview")} rate={rate}
        />
      )}
      {method === "receive" && (
        <ReceiveMode userId={userId} currency={currency} onRefresh={onRefresh} rate={rate}/>
      )}
    </div>
  );
};

export default DepositTab;