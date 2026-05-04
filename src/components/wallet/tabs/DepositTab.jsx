// src/components/wallet/tabs/DepositTab.jsx  v8
// ════════════════════════════════════════════════════════════════════════════
// FIXES v8:
//  • userId always sourced from useAuth() — never undefined when opening Paystack
//  • edge function receives userId explicitly in the body (belt+suspenders)
//  • DualInput: YOU GET no longer cut off — stacks to column on narrow screens,
//    uses responsive font scaling on medium screens
//  • ALL tabs fill WalletView properly — removed hard min-height: 100vh
//    that was causing overflow/scroll issues inside the wallet container
//  • Rate ticker and design preserved exactly
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Shield,
  AlertCircle,
  X,
  Loader,
  ChevronRight,
  WifiOff,
  ArrowRight,
  Zap,
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

// ── Platform palette ──────────────────────────────────────────────────────────
const T = {
  bg: "#080808",
  s1: "#0e0e0e",
  s2: "#141414",
  s3: "#1a1a1a",
  b1: "#1f1f1f",
  b2: "#2a2a2a",
  b3: "#333333",
  t1: "#f0f0f0",
  t2: "#8a8a8a",
  t3: "#555555",
  t4: "#333333",
  lime: "#aaff00",
  limeD: "#88cc00",
  limeA: "rgba(170,255,0,0.08)",
  limeB: "rgba(170,255,0,0.18)",
  limeT: "rgba(170,255,0,0.04)",
  green: "#22c55e",
  red: "#f87171",
  blue: "#3b82f6",
  amber: "#f59e0b",
};

const TREASURY = {
  evm:
    process.env.REACT_APP_TREASURY_WALLET ||
    "0x62438e737C597250516798F175265E0edF446616",
  sol:
    process.env.REACT_APP_TREASURY_WALLET_SOL ||
    "9KjmVg5UasBxNoVn9f2BFW7n6Mnhdg8GGFF5QuCX2PpS",
  ada:
    process.env.REACT_APP_TREASURY_WALLET_ADA ||
    "addr1q8zkkwvsfrhjz3l80hvqcs93wtwy99rarz8lfmtllfhxu5zcjne5v0hv4kep395qczzcysmhxxm23zueeczxhhkgjntsplwdgf",
};

const NETWORKS = [
  {
    id: "usdt_trc20",
    label: "USDT",
    std: "TRC-20",
    net: "Tron",
    col: "#26a17b",
    addr: TREASURY.sol,
  },
  {
    id: "usdt_erc20",
    label: "USDT",
    std: "ERC-20",
    net: "Ethereum",
    col: "#26a17b",
    addr: TREASURY.evm,
  },
  {
    id: "usdt_bep20",
    label: "USDT",
    std: "BEP-20",
    net: "BNB",
    col: "#26a17b",
    addr: TREASURY.evm,
  },
  {
    id: "usdt_sol",
    label: "USDT",
    std: "SPL",
    net: "Solana",
    col: "#26a17b",
    addr: TREASURY.sol,
  },
  {
    id: "eth",
    label: "ETH",
    std: "ERC-20",
    net: "Ethereum",
    col: "#627eea",
    addr: TREASURY.evm,
  },
  {
    id: "bnb",
    label: "BNB",
    std: "BEP-20",
    net: "BNB",
    col: "#f0b90b",
    addr: TREASURY.evm,
  },
  {
    id: "trx",
    label: "TRX",
    std: "TRC-20",
    net: "Tron",
    col: "#ef0027",
    addr: TREASURY.sol,
  },
  {
    id: "sol",
    label: "SOL",
    std: "Native",
    net: "Solana",
    col: "#9945ff",
    addr: TREASURY.sol,
  },
  {
    id: "ada",
    label: "ADA",
    std: "Native",
    net: "Cardano",
    col: "#0033ad",
    addr: TREASURY.ada,
  },
];

// ── Icon helpers ──────────────────────────────────────────────────────────────
const IconCard = ({ s = 16, c = "currentColor" }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke={c}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);
const IconDownload = ({ s = 16, c = "currentColor" }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke={c}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconChain = ({ s = 16, c = "currentColor" }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke={c}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);
const IconBank = ({ s = 17, c = "currentColor" }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke={c}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="10" width="18" height="11" rx="1" />
    <path d="M3 10l9-7 9 7" />
    <line x1="12" y1="10" x2="12" y2="21" />
    <line x1="7" y1="10" x2="7" y2="21" />
    <line x1="17" y1="10" x2="17" y2="21" />
  </svg>
);

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Barlow:wght@400;600;700;900&display=swap');

@keyframes xSpin  { to { transform: rotate(360deg) } }
@keyframes xFade  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
@keyframes pulse  { 0%,100% { opacity:1 } 50% { opacity:.3 } }
@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }

.x-spin { animation: xSpin .7s linear infinite }
.x-fade { animation: xFade .2s ease both }

.d-shell {
  font-family: 'Barlow', sans-serif;
  color: ${T.t1};
  background: ${T.bg};
  /* FIXED: no min-height:100vh — fills wallet container without overflow */
  padding-bottom: 32px;
}

.d-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 12px;
  border-bottom: 1px solid ${T.b1};
  background: ${T.bg};
  position: sticky;
  top: 0;
  z-index: 10;
  margin-bottom: 4px;
}
.d-back {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: 1px solid ${T.b2};
  background: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${T.t2};
  transition: border-color .15s, color .15s;
  flex-shrink: 0;
}
.d-back:hover { border-color: ${T.lime}55; color: ${T.lime} }
.d-header-title { font-size: 13px; font-weight: 700; color: ${T.t1}; letter-spacing: .06em; text-transform: uppercase }
.d-header-sub   { font-size: 10px; color: ${T.t3}; font-family: 'IBM Plex Mono', monospace; margin-top: 1px }
.d-bal-chip {
  margin-left: auto;
  padding: 5px 12px;
  border-radius: 6px;
  background: ${T.limeA};
  border: 1px solid ${T.limeB};
  font-size: 12px; font-weight: 700;
  color: ${T.lime};
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: .04em;
}

.d-ticker {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid ${T.b1};
  margin-bottom: 4px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px; color: ${T.t3};
  overflow: hidden;
}
.d-ticker-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.d-ticker-dot.live  { background: ${T.lime}; box-shadow: 0 0 6px ${T.lime}; animation: pulse 2s ease infinite }
.d-ticker-dot.stale { background: ${T.t3} }
.d-ticker-val { color: ${T.t1}; font-weight: 600 }
.d-ticker-sep { color: ${T.b3}; margin: 0 2px }

.d-cur-wrap { padding: 10px 0 0 }
.d-cur {
  display: grid; grid-template-columns: 1fr 1fr;
  background: ${T.s1};
  border: 1px solid ${T.b1};
  border-radius: 10px;
  padding: 3px; gap: 3px;
  position: relative;
}
.d-cur-pill {
  position: absolute; top: 3px; bottom: 3px;
  border-radius: 8px;
  transition: left .2s cubic-bezier(.4,0,.2,1), background .2s;
  pointer-events: none; z-index: 0;
}
.d-cur-btn {
  flex: 1; padding: 9px 0;
  border-radius: 8px; border: none;
  font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Barlow', sans-serif;
  letter-spacing: .06em; text-transform: uppercase;
  transition: color .15s; position: relative; z-index: 1;
  background: transparent;
}
.d-cur-btn.off { color: ${T.t3} }
.d-cur-btn.on  { color: ${T.bg} }
.d-cur-hint {
  font-size: 10px; font-family: 'IBM Plex Mono', monospace;
  color: ${T.t3}; text-align: center;
  margin-top: 6px; line-height: 1.5;
}

.d-methods {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 6px; padding: 12px 0 0;
}
.d-meth {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 10px 6px;
  border-radius: 10px; border: 1px solid ${T.b1};
  background: none; cursor: pointer; font-family: 'Barlow', sans-serif;
  transition: all .14s;
}
.d-meth:hover { background: ${T.s1}; border-color: ${T.b2} }
.d-meth.on { background: ${T.limeA}; border-color: ${T.limeB}; }
.d-meth-icon { color: ${T.t3}; display: flex; align-items: center; justify-content: center }
.d-meth.on .d-meth-icon { color: ${T.lime} }
.d-meth-lbl { font-size: 10px; font-weight: 700; color: ${T.t3}; letter-spacing: .08em; text-transform: uppercase }
.d-meth.on .d-meth-lbl { color: ${T.lime} }
.d-divider { height: 1px; background: ${T.b1}; margin: 12px 0 0 }

/* ── DUAL INPUT: row on wide, column on narrow ─────────────────────────── */
.d-inputs {
  padding: 24px 0 0;
  display: flex; flex-direction: column; gap: 10px;
}
.d-inputs-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: 6px;
}
/* Stack to column when container is too narrow for the row layout */
@media (max-width: 520px) {
  .d-inputs-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .d-arrow-wrap {
    display: none !important;
  }
  .d-field:last-child {
    margin-top: 8px;
  }
}
.d-field { position: relative }
.d-field-label {
  position: absolute; top: -18px; left: 0;
  font-size: 9px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase;
  color: ${T.t3}; font-family: 'IBM Plex Mono', monospace;
  pointer-events: none; white-space: nowrap;
}
.d-field-box {
  width: 100%; display: flex; align-items: center;
  padding: 10px 10px;
  border: 1px solid ${T.b1};
  border-radius: 10px;
  background: ${T.s1};
  box-sizing: border-box;
  min-height: 52px;
  transition: border-color .15s;
}
.d-field-box:focus-within { border-color: ${T.limeB} }
.d-field-box.active { border-color: ${T.limeB}; background: ${T.limeT} }
.d-field-num {
  flex: 1; min-width: 0;
  background: none; border: none; outline: none;
  font-family: 'IBM Plex Mono', monospace;
  font-size: clamp(16px, 4vw, 24px);
  font-weight: 500;
  color: ${T.t1}; letter-spacing: -.02em;
}
.d-field-num::placeholder { color: ${T.t4} }
.d-field-tag {
  flex-shrink: 0; margin-left: 6px;
  font-size: 9px; font-weight: 700;
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: .08em;
  padding: 3px 6px; border-radius: 4px;
  border: 1px solid ${T.b2};
  background: ${T.s2};
  color: ${T.t3};
  white-space: nowrap;
}
.d-arrow-wrap { display: flex; align-items: center; justify-content: center; margin-bottom: 2px; }
.d-arrow-circle {
  width: 24px; height: 24px; border-radius: 50%;
  background: ${T.s2}; border: 1px solid ${T.b2};
  display: flex; align-items: center; justify-content: center;
  color: ${T.t3};
}

.d-quick { display: flex; gap: 4px }
.d-q {
  flex: 1; padding: 7px 0;
  border-radius: 7px; border: 1px solid ${T.b1};
  background: none; font-size: 11px; font-weight: 700;
  color: ${T.t3}; cursor: pointer;
  font-family: 'IBM Plex Mono', monospace;
  transition: all .12s; letter-spacing: .02em;
}
.d-q:hover { border-color: ${T.b2}; color: ${T.t2} }
.d-q.on { background: ${T.limeA}; border-color: ${T.limeB}; color: ${T.lime} }

.d-ok  { display:flex; align-items:flex-start; gap:8px; padding:9px 12px; border-radius:8px; margin:8px 0 0; background:rgba(34,197,94,.07); border:1px solid rgba(34,197,94,.2); font-size:12px; font-weight:600; color:${T.green}; line-height:1.5; font-family:'Barlow',sans-serif }
.d-err { display:flex; align-items:flex-start; gap:8px; padding:9px 12px; border-radius:8px; margin:8px 0 0; background:rgba(248,113,113,.07); border:1px solid rgba(248,113,113,.2); font-size:12px; font-weight:600; color:${T.red}; line-height:1.5; font-family:'Barlow',sans-serif }

.d-actions { padding: 12px 0 0; display: flex; flex-direction: column; gap: 6px }
.d-pay-btn {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border-radius: 10px; border: 1px solid ${T.b1};
  background: ${T.s1}; cursor: pointer;
  font-family: 'Barlow', sans-serif;
  width: 100%; text-align: left;
  transition: all .14s;
}
.d-pay-btn:hover:not(:disabled) { background: ${T.s2}; border-color: ${T.b2}; transform: translateY(-1px) }
.d-pay-btn:disabled { opacity: .3; cursor: not-allowed }
.d-pay-btn.loading { opacity: .6; pointer-events: none }
.d-pay-icon {
  width: 38px; height: 38px; border-radius: 10px;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.d-pay-name  { font-size: 13px; font-weight: 700; color: ${T.t1} }
.d-pay-sub   { font-size: 10px; color: ${T.t3}; margin-top: 2px; font-family: 'IBM Plex Mono', monospace }
.d-pay-badge {
  margin-left: auto; padding: 3px 9px; border-radius: 4px;
  font-size: 9px; font-weight: 700; flex-shrink: 0;
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: .06em; text-transform: uppercase;
}

.d-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 14px;
  background: ${T.lime};
  border: none; border-radius: 10px;
  font-size: 13px; font-weight: 700;
  color: ${T.bg}; cursor: pointer;
  font-family: 'Barlow', sans-serif;
  letter-spacing: .06em; text-transform: uppercase;
  box-shadow: 0 0 28px rgba(170,255,0,.14);
  transition: opacity .15s, transform .12s, box-shadow .15s;
}
.d-cta:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); box-shadow: 0 0 36px rgba(170,255,0,.22) }
.d-cta:disabled { opacity: .2; cursor: not-allowed; transform: none; box-shadow: none }

.d-ghost {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 11px;
  border: 1px solid ${T.b1}; background: none;
  border-radius: 10px; font-size: 12px; font-weight: 700;
  color: ${T.t2}; cursor: pointer;
  font-family: 'Barlow', sans-serif;
  transition: all .15s; margin-top: 5px;
  text-transform: uppercase; letter-spacing: .04em;
}
.d-ghost:hover { border-color: ${T.b2}; color: ${T.t1}; background: ${T.s1} }

.d-security {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 10px 12px; margin: 12px 0 0;
  background: ${T.limeT};
  border: 1px solid ${T.limeB}22;
  border-radius: 8px;
}
.d-security h5 { font-size: 11px; font-weight: 700; color: ${T.lime}; margin: 0 0 2px; letter-spacing: .04em }
.d-security p  { font-size: 10.5px; color: ${T.t3}; margin: 0; line-height: 1.55; font-family: 'IBM Plex Mono', monospace }

.d-ngrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 0; margin-top: 12px }
.d-nbtn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 4px;
  border-radius: 8px; border: 1px solid ${T.b1};
  background: none; cursor: pointer; font-family: 'Barlow', sans-serif;
  transition: all .12s;
}
.d-nbtn:hover { background: ${T.s1}; border-color: ${T.b2} }
.d-nbtn.on { background: ${T.limeA}; border-color: ${T.limeB} }
.d-nbtn-tk { font-size: 11px; font-weight: 700; color: ${T.t2} }
.d-nbtn.on .d-nbtn-tk { color: ${T.lime} }
.d-nbtn-std { font-size: 8px; color: ${T.t3}; font-family: 'IBM Plex Mono', monospace }

.d-addr {
  margin: 8px 0 0;
  background: ${T.s1}; border: 1px solid ${T.b1};
  border-radius: 10px; padding: 12px;
}
.d-addr-label { font-size: 9px; color: ${T.t4}; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; font-family: 'IBM Plex Mono', monospace }
.d-addr-row { display: flex; align-items: flex-start; gap: 8px }
.d-addr-text { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: ${T.t2}; word-break: break-all; line-height: 1.6; flex: 1 }
.d-copy-btn {
  width: 32px; height: 32px; border-radius: 7px; flex-shrink: 0;
  background: ${T.s2}; border: 1px solid ${T.b2};
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: ${T.t3}; transition: all .14s; margin-top: 1px;
}
.d-copy-btn:hover { border-color: ${T.limeB}; color: ${T.lime} }
.d-copy-btn.ok { border-color: rgba(34,197,94,.4); color: ${T.green} }
.d-net-strip {
  display: flex; margin: 6px 0 0;
  background: ${T.s1}; border: 1px solid ${T.b1};
  border-radius: 8px; overflow: hidden;
}
.d-np { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 7px 4px; border-right: 1px solid ${T.b1} }
.d-np:last-child { border-right: none }
.d-npk { font-size: 8px; color: ${T.t4}; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-family: 'Barlow', sans-serif }
.d-npv { font-size: 11px; font-weight: 700; color: ${T.t1}; font-family: 'IBM Plex Mono', monospace }
.d-warn {
  display: flex; gap: 7px; align-items: flex-start;
  padding: 7px 10px; margin-top: 8px;
  background: rgba(248,113,113,.05); border: 1px solid rgba(248,113,113,.15);
  border-radius: 7px; font-size: 10.5px; color: ${T.red}; line-height: 1.5;
  font-family: 'IBM Plex Mono', monospace;
}

.d-section { padding: 0; margin-top: 12px }
.d-label { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: ${T.t3}; margin-bottom: 7px; display: block; font-family: 'IBM Plex Mono', monospace }
.d-input {
  width: 100%; padding: 10px 12px;
  background: ${T.s1}; border: 1px solid ${T.b1};
  border-radius: 8px; font-size: 13px; color: ${T.t1};
  font-family: 'IBM Plex Mono', monospace;
  outline: none; box-sizing: border-box; transition: border-color .15s;
}
.d-input::placeholder { color: ${T.t4} }
.d-input:focus { border-color: ${T.limeB} }

.d-wcard {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 9px; margin-bottom: 5px;
  border: 1px solid rgba(34,197,94,.18); background: rgba(34,197,94,.025);
}
.d-wicon { width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px }
.d-wimport {
  padding: 6px 12px; border-radius: 7px; font-size: 11px; font-weight: 700;
  color: ${T.lime}; background: ${T.limeA}; border: 1px solid ${T.limeB};
  cursor: pointer; font-family: 'Barlow', sans-serif;
  transition: all .12s; text-transform: uppercase; letter-spacing: .04em;
}
.d-wimport:hover { background: ${T.limeB} }
.d-wremove { font-size: 9px; color: ${T.t4}; cursor: pointer; background: none; border: none; font-family: 'IBM Plex Mono', monospace; display: block; margin-top: 3px; text-align: right; transition: color .12s }
.d-wremove:hover { color: ${T.red} }
.d-scan-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 12px;
  border-radius: 9px; border: 1px dashed ${T.b2};
  background: none; cursor: pointer; font-family: 'Barlow', sans-serif;
  text-align: left; transition: all .15s; margin-top: 4px;
}
.d-scan-btn:hover { border-color: ${T.limeB}; background: ${T.limeT} }

.d-done {
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 20px 28px; text-align: center;
  animation: xFade .3s ease;
}
.d-done-ring {
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(170,255,0,.08); border: 1px solid ${T.limeB};
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 0 36px rgba(170,255,0,.1);
}
.d-done h2 { font-size: 22px; font-weight: 900; color: ${T.t1}; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .02em }
.d-done p { font-size: 12px; color: ${T.t3}; margin: 0; line-height: 1.7; font-family: 'IBM Plex Mono', monospace }
.d-done-ref { font-size: 10px; font-family: 'IBM Plex Mono', monospace; color: ${T.t4}; margin-top: 4px }
.d-done-chip {
  padding: 8px 22px; border-radius: 6px; font-size: 18px; font-weight: 700;
  font-family: 'IBM Plex Mono', monospace; border: 1px solid ${T.limeB};
  color: ${T.lime}; background: ${T.limeA}; margin: 16px 0 22px;
  letter-spacing: .02em;
}

.d-loading {
  display: flex; flex-direction: column; align-items: center;
  padding: 52px 20px; gap: 14px; text-align: center;
}
.d-loading-ring {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}

/* Session error badge */
.d-session-err {
  margin: 8px 0 0; padding: 8px 12px;
  border-radius: 8px; background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.25);
  font-size: 11px; color: #f87171; font-family: monospace;
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function nairaToEP(n, rate) {
  return Math.floor((parseFloat(n) / rate) * 100);
}
function epToNaira(ep, rate) {
  return Math.round((parseFloat(ep) / 100) * rate);
}
function nairaToXEV(n) {
  return +(parseFloat(n) / 2.5).toFixed(2);
}
function xevToNaira(xev) {
  return Math.round(parseFloat(xev) * 2.5);
}

const Ok = ({ msg }) =>
  msg ? (
    <div className="d-ok">
      <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      {msg}
    </div>
  ) : null;
const Err = ({ msg }) =>
  msg ? (
    <div className="d-err">
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      {msg}
    </div>
  ) : null;

const SpinScreen = ({ color, title, sub }) => (
  <div className="d-loading">
    <div
      className="d-loading-ring"
      style={{ background: `${color}12`, border: `1px solid ${color}40` }}
    >
      <Loader size={24} color={color} className="x-spin" />
    </div>
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: T.t1,
        textTransform: "uppercase",
        letterSpacing: ".04em",
      }}
    >
      {title}
    </div>
    {sub && (
      <div
        style={{
          fontSize: 11,
          color: T.t3,
          whiteSpace: "pre-line",
          fontFamily: "'IBM Plex Mono',monospace",
        }}
      >
        {sub}
      </div>
    )}
  </div>
);

function useRate() {
  const [rate, setRate] = useState(getCachedUSDNGN());
  const [live, setLive] = useState(false);
  useEffect(() => {
    getLiveUSDNGN()
      .then((r) => {
        setRate(r);
        setLive(true);
      })
      .catch(() => {});
  }, []);
  return { rate, live };
}

// ── Currency Toggle ───────────────────────────────────────────────────────────
function CurrencyToggle({ value, onChange, rate }) {
  const isEP = value === "EP";
  const hint = isEP
    ? `1 USD = 100 EP · ₦${rate.toLocaleString(undefined, { maximumFractionDigits: 0 })} ≈ 100 EP`
    : `₦2.50 = 1 $XEV · 10 EP = 1 $XEV`;
  return (
    <div className="d-cur-wrap">
      <div className="d-cur">
        <div
          className="d-cur-pill"
          style={{
            left: isEP ? "3px" : "calc(50% + 1.5px)",
            width: "calc(50% - 4.5px)",
            background: T.lime,
          }}
        />
        <button
          className={`d-cur-btn ${isEP ? "on" : "off"}`}
          onClick={() => onChange("EP")}
        >
          ⚡ EP
        </button>
        <button
          className={`d-cur-btn ${!isEP ? "on" : "off"}`}
          onClick={() => onChange("XEV")}
        >
          ◈ $XEV
        </button>
      </div>
      <div className="d-cur-hint">{hint}</div>
    </div>
  );
}

// ── Dual Input ────────────────────────────────────────────────────────────────
// FIXED: stacks to column on narrow screens via CSS media query
function DualInput({ currency, rate, onNairaChange }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [activeQ, setActiveQ] = useState(null);
  const busy = useRef(false);
  const isEP = currency === "EP";
  const rightColor = T.lime;

  useEffect(() => {
    if (!left) {
      setRight("");
      return;
    }
    const n = parseFloat(left);
    if (!n) return;
    setRight(isEP ? String(nairaToEP(n, rate)) : String(nairaToXEV(n)));
  }, [currency, rate]); // eslint-disable-line

  const handleLeft = (v) => {
    if (busy.current) return;
    busy.current = true;
    setLeft(v);
    setActiveQ(null);
    const n = parseFloat(v);
    setRight(
      v === "" || !n
        ? ""
        : isEP
          ? String(nairaToEP(n, rate))
          : String(nairaToXEV(n)),
    );
    if (onNairaChange) onNairaChange(v);
    busy.current = false;
  };

  const handleRight = (v) => {
    if (busy.current) return;
    busy.current = true;
    setRight(v);
    setActiveQ(null);
    const n = parseFloat(v);
    if (v === "" || !n) {
      setLeft("");
      if (onNairaChange) onNairaChange("");
    } else {
      const naira = isEP ? String(epToNaira(n, rate)) : String(xevToNaira(n));
      setLeft(naira);
      if (onNairaChange) onNairaChange(naira);
    }
    busy.current = false;
  };

  const quick = (a) => {
    setActiveQ(a);
    handleLeft(String(a));
  };

  return (
    <div className="d-inputs">
      <div className="d-inputs-row">
        <div className="d-field">
          <div className="d-field-label">You Pay</div>
          <div className="d-field-box">
            <input
              className="d-field-num"
              type="number"
              placeholder="0"
              value={left}
              onChange={(e) => handleLeft(e.target.value)}
            />
            <span className="d-field-tag">NGN</span>
          </div>
        </div>
        <div className="d-arrow-wrap">
          <div className="d-arrow-circle">
            <ArrowRight size={11} color={T.t3} />
          </div>
        </div>
        <div className="d-field">
          <div className="d-field-label">You Get</div>
          <div className={`d-field-box${left ? " active" : ""}`}>
            <input
              className="d-field-num"
              type="number"
              placeholder="0"
              value={right}
              onChange={(e) => handleRight(e.target.value)}
              style={{ color: rightColor }}
            />
            <span
              className="d-field-tag"
              style={{
                color: rightColor,
                borderColor: `${rightColor}30`,
                background: `${rightColor}0a`,
              }}
            >
              {isEP ? "EP" : "XEV"}
            </span>
          </div>
        </div>
      </div>
      <div className="d-quick">
        {[500, 1000, 2000, 5000].map((a) => (
          <button
            key={a}
            className={`d-q${activeQ === a ? " on" : ""}`}
            onClick={() => quick(a)}
          >
            ₦{a >= 1000 ? `${a / 1000}k` : a}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── PAY mode ──────────────────────────────────────────────────────────────────
function PayMode({
  resolvedUserId,
  resolvedEmail,
  currency,
  onRefresh,
  onBack,
  rate,
}) {
  const [naira, setNaira] = useState("");
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const open = async (channel) => {
    const n = parseFloat(naira);
    if (!n || n < MIN_DEPOSIT) {
      setError(`Minimum ₦${MIN_DEPOSIT}`);
      return;
    }

    if (!resolvedUserId) {
      setError("Session not found — please sign out and sign back in.");
      return;
    }
    if (!resolvedEmail) {
      setError("Email not found — please update your profile.");
      return;
    }

    setError("");
    setLoading(channel);
    try {
      const res = await depositPaystackOpen({
        userId: resolvedUserId,
        email: resolvedEmail,
        nairaAmount: naira,
        channel,
        currency,
        onCancel: () => setLoading(null),
      });
      setResult(res);
      if (onRefresh) onRefresh();
    } catch (e) {
      if (!e.cancelled) setError(e.message || "Payment failed");
    } finally {
      setLoading(null);
    }
  };

  if (result)
    return (
      <div className="d-done">
        <div className="d-done-ring">
          <Zap size={28} color={T.lime} fill={T.lime} />
        </div>
        <h2>Payment Sent</h2>
        <p>
          ₦{parseFloat(naira).toLocaleString()} via Paystack
          <br />
          Balance updates after webhook confirmation.
        </p>
        <div className="d-done-ref">ref: {result.reference}</div>
        <div className="d-done-chip">
          +{result.credit}{" "}
          {result.label || (currency === "XEV" ? "$XEV" : "EP")}
        </div>
        <button
          className="d-cta"
          onClick={() => {
            setResult(null);
            setNaira("");
          }}
        >
          Add More
        </button>
        <button className="d-ghost" onClick={onBack}>
          Back to Wallet
        </button>
      </div>
    );

  const canPay = !!naira && parseFloat(naira) >= MIN_DEPOSIT;

  return (
    <>
      <DualInput currency={currency} rate={rate} onNairaChange={setNaira} />
      <Err msg={error} />
      <div className="d-actions">
        {/* Card */}
        <button
          className={`d-pay-btn${loading === "card" ? " loading" : ""}`}
          onClick={() => open("card")}
          disabled={!!loading || !canPay}
        >
          <div
            className="d-pay-icon"
            style={{
              background: "rgba(59,130,246,.1)",
              border: `1px solid rgba(59,130,246,.25)`,
            }}
          >
            {loading === "card" ? (
              <Loader size={17} color={T.blue} className="x-spin" />
            ) : (
              <IconCard s={17} c={T.blue} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="d-pay-name">Pay with Card</div>
            <div className="d-pay-sub">
              Visa · Mastercard · Verve · All cards
            </div>
          </div>
          <div
            className="d-pay-badge"
            style={{
              background: "rgba(59,130,246,.1)",
              border: "1px solid rgba(59,130,246,.22)",
              color: T.blue,
            }}
          >
            {loading === "card" ? "OPENING" : "INSTANT"}
          </div>
        </button>
        {/* Bank transfer */}
        <button
          className={`d-pay-btn${loading === "bank_transfer" ? " loading" : ""}`}
          onClick={() => open("bank_transfer")}
          disabled={!!loading || !canPay}
        >
          <div
            className="d-pay-icon"
            style={{ background: `${T.limeA}`, border: `1px solid ${T.limeB}` }}
          >
            {loading === "bank_transfer" ? (
              <Loader size={17} color={T.lime} className="x-spin" />
            ) : (
              <IconBank s={17} c={T.lime} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div className="d-pay-name">Bank Transfer</div>
            <div className="d-pay-sub">Any Nigerian bank · Virtual account</div>
          </div>
          <div
            className="d-pay-badge"
            style={{
              background: T.limeA,
              border: `1px solid ${T.limeB}`,
              color: T.lime,
            }}
          >
            {loading === "bank_transfer" ? "OPENING" : "REAL-TIME"}
          </div>
        </button>
      </div>
      <div className="d-security">
        <Shield
          size={14}
          style={{ flexShrink: 0, marginTop: 2, color: T.lime }}
        />
        <div>
          <h5>Secured by Paystack · PCI-DSS Level 1</h5>
          <p>
            Your {currency} is credited automatically after webhook
            verification. We never store card details.
          </p>
        </div>
      </div>
    </>
  );
}

// ── IMPORT mode ───────────────────────────────────────────────────────────────
function ImportMode({
  resolvedUserId,
  resolvedEmail,
  currency,
  onRefresh,
  onBack,
  rate,
}) {
  const KEY = `xev_wl_${resolvedUserId}`;
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  };
  const save = (l) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(l));
    } catch {}
  };

  const [phase, setPhase] = useState("list");
  const [wallets, setWallets] = useState(load);
  const [sel, setSel] = useState(null);
  const [naira, setNaira] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const scan = useCallback(async () => {
    setPhase("scanning");
    setError("");
    try {
      const found = await depositDetectBrowserWallets();
      const merged = [...wallets];
      found.forEach((w) => {
        if (!merged.find((m) => m.id === w.id)) merged.push(w);
      });
      setWallets(merged);
      save(merged);
    } catch (e) {
      setError(e.message);
    }
    setPhase("list");
  }, [wallets]); // eslint-disable-line

  const remove = (id) => {
    const n = wallets.filter((w) => w.id !== id);
    setWallets(n);
    save(n);
  };

  const doImport = useCallback(async () => {
    if (!sel) return;
    const n = parseFloat(naira);
    if (!n || n < MIN_DEPOSIT) {
      setError(`Minimum ₦${MIN_DEPOSIT}`);
      return;
    }
    setError("");
    setPhase("signing");
    try {
      const res = await depositSmartImport({
        wallet: sel,
        nairaAmount: naira,
        userId: resolvedUserId,
        email: resolvedEmail,
        currency,
      });
      setResult(res);
      setPhase("done");
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message || "Import failed");
      setPhase("amount");
    }
  }, [sel, naira, resolvedUserId, resolvedEmail, currency, onRefresh]); // eslint-disable-line

  if (phase === "done" && result)
    return (
      <div className="d-done">
        <div className="d-done-ring">
          <Zap size={28} color={T.lime} fill={T.lime} />
        </div>
        <h2>Imported!</h2>
        <p>Signed via {sel?.name}</p>
        <div className="d-done-ref">ref: {result.reference}</div>
        <div className="d-done-chip">
          +{result.credit} {result.label}
        </div>
        <button className="d-cta" onClick={onBack}>
          Back to Wallet
        </button>
        <button
          className="d-ghost"
          onClick={() => {
            setPhase("list");
            setResult(null);
          }}
        >
          Import More
        </button>
      </div>
    );

  if (phase === "signing")
    return (
      <SpinScreen
        color={T.lime}
        title="Awaiting signature…"
        sub={`${sel?.name} is requesting approval.\nCheck your wallet extension.`}
      />
    );
  if (phase === "scanning")
    return (
      <SpinScreen
        color={T.blue}
        title="Scanning browser…"
        sub="MetaMask · Phantom · TronLink · Coinbase · Rabby"
      />
    );

  if (phase === "amount" && sel)
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            margin: "12px 0 0",
            background: `${sel.color}0c`,
            border: `1px solid ${sel.color}35`,
            borderRadius: 10,
          }}
        >
          <div
            className="d-wicon"
            style={{
              background: `${sel.color}15`,
              border: `1px solid ${sel.color}30`,
            }}
          >
            {sel.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>
              {sel.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: T.t3,
                fontFamily: "'IBM Plex Mono',monospace",
              }}
            >
              {sel.currency}
            </div>
          </div>
          <button
            onClick={() => setPhase("list")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.t3,
              display: "flex",
            }}
          >
            <X size={14} />
          </button>
        </div>
        <DualInput currency={currency} rate={rate} onNairaChange={setNaira} />
        <Err msg={error} />
        <div className="d-actions">
          <button
            className="d-cta"
            disabled={!naira || parseFloat(naira) < MIN_DEPOSIT}
            onClick={doImport}
          >
            <IconDownload s={15} c={T.bg} /> Import from {sel.name}
          </button>
          <button className="d-ghost" onClick={() => setPhase("list")}>
            ← Back
          </button>
        </div>
      </>
    );

  return (
    <div className="d-section">
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: T.t1,
          marginBottom: 4,
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        Connected Wallets
      </div>
      <div
        style={{
          fontSize: 10,
          color: T.t3,
          marginBottom: 12,
          fontFamily: "'IBM Plex Mono',monospace",
        }}
      >
        Select → enter amount → sign once → {currency} credited instantly
      </div>
      {!wallets.length && (
        <div
          style={{ padding: "24px 0 16px", textAlign: "center", color: T.t3 }}
        >
          <WifiOff
            size={28}
            style={{
              opacity: 0.18,
              marginBottom: 8,
              display: "block",
              margin: "0 auto 8px",
            }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.t2,
              marginBottom: 3,
            }}
          >
            No wallets detected
          </div>
          <div
            style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }}
          >
            Scan your browser below
          </div>
        </div>
      )}
      {wallets.map((w) => (
        <div key={w.id} className="d-wcard">
          <div
            className="d-wicon"
            style={{
              background: `${w.color}14`,
              border: `1px solid ${w.color}30`,
            }}
          >
            {w.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>
              {w.name}
            </div>
            <div
              style={{
                fontSize: 9,
                color: T.green,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
                fontFamily: "'IBM Plex Mono',monospace",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: T.green,
                  flexShrink: 0,
                }}
              />
              {w.currency}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <button
              className="d-wimport"
              onClick={() => {
                setSel(w);
                setNaira("");
                setError("");
                setPhase("amount");
              }}
            >
              Import →
            </button>
            <button className="d-wremove" onClick={() => remove(w.id)}>
              remove
            </button>
          </div>
        </div>
      ))}
      <button className="d-scan-btn" onClick={scan}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: `1px dashed ${T.b2}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: T.t3,
          }}
        >
          <svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.t2,
              textTransform: "uppercase",
              letterSpacing: ".04em",
            }}
          >
            {wallets.length ? "Scan for More" : "Detect Wallets"}
          </div>
          <div
            style={{
              fontSize: 10,
              color: T.t4,
              marginTop: 1,
              fontFamily: "'IBM Plex Mono',monospace",
            }}
          >
            MetaMask · Phantom · TronLink · Coinbase
          </div>
        </div>
        <ChevronRight size={13} color={T.t4} />
      </button>
      <Err msg={error} />
    </div>
  );
}

// ── RECEIVE mode ──────────────────────────────────────────────────────────────
function ReceiveMode({ resolvedUserId, currency, onRefresh, rate }) {
  const [net, setNet] = useState(NETWORKS[0]);
  const [txHash, setTxHash] = useState("");
  const [naira, setNaira] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const verify = async () => {
    if (!txHash.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await depositCryptoVerify({
        userId: resolvedUserId,
        txHash: txHash.trim(),
        tokenId: net.id,
        network: net.net,
        nairaEquivalent: parseFloat(naira) || 0,
        currency,
      });
      if (r.success) {
        const amt =
          currency === "XEV"
            ? nairaToXEV(parseFloat(naira) || 0)
            : nairaToEP(parseFloat(naira) || 0, rate);
        setStatusMsg(`Verified! +${amt} ${currency} credited.`);
        setStatus("ok");
        if (onRefresh) onRefresh();
      } else {
        setStatus("err");
        setStatusMsg("Transaction not found. Check hash and network.");
      }
    } catch (e) {
      setStatus("err");
      setStatusMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="d-ngrid">
        {NETWORKS.map((n) => (
          <button
            key={n.id}
            className={`d-nbtn${net.id === n.id ? " on" : ""}`}
            onClick={() => {
              setNet(n);
              setCopied(false);
              setTxHash("");
              setStatus(null);
            }}
          >
            <span
              className="d-nbtn-tk"
              style={net.id === n.id ? { color: n.col } : {}}
            >
              {n.label}
            </span>
            <span className="d-nbtn-std">{n.std}</span>
          </button>
        ))}
      </div>

      <div className="d-net-strip">
        {[
          ["Token", net.label],
          ["Network", net.net],
          ["Std", net.std],
          ["Min", "$1"],
        ].map(([k, v]) => (
          <div key={k} className="d-np">
            <span className="d-npk">{k}</span>
            <span
              className="d-npv"
              style={k === "Token" ? { color: net.col } : {}}
            >
              {v}
            </span>
          </div>
        ))}
      </div>

      <div className="d-addr">
        <div className="d-addr-label">
          Send {net.label} ({net.std}) on {net.net} only
        </div>
        <div className="d-addr-row">
          <code className="d-addr-text">{net.addr}</code>
          <button
            className={`d-copy-btn${copied ? " ok" : ""}`}
            onClick={() => copy(net.addr)}
          >
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
          </button>
        </div>
        <div className="d-warn">
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Only send{" "}
            <strong>
              {net.label} on {net.net}
            </strong>
            . Wrong network = <strong>permanent loss.</strong>
          </span>
        </div>
      </div>

      <div className="d-section">
        <label className="d-label">Transaction hash (TXID)</label>
        <input
          className="d-input"
          placeholder={net.net === "Tron" ? "transaction hash…" : "0x…"}
          value={txHash}
          onChange={(e) => {
            setTxHash(e.target.value);
            setStatus(null);
          }}
        />
        <label className="d-label" style={{ marginTop: 10 }}>
          ₦ equivalent (for preview)
        </label>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 13,
              fontWeight: 700,
              color: T.t3,
              fontFamily: "'IBM Plex Mono',monospace",
              pointerEvents: "none",
            }}
          >
            ₦
          </span>
          <input
            className="d-input"
            style={{ paddingLeft: 22 }}
            type="number"
            placeholder="0"
            value={naira}
            onChange={(e) => setNaira(e.target.value)}
          />
        </div>
        {naira && (
          <div
            style={{
              fontSize: 11,
              color: T.t3,
              fontFamily: "'IBM Plex Mono',monospace",
              marginTop: 6,
            }}
          >
            {currency === "XEV"
              ? `₦${parseFloat(naira).toLocaleString()} → +${nairaToXEV(parseFloat(naira))} $XEV`
              : `₦${parseFloat(naira).toLocaleString()} → +${nairaToEP(parseFloat(naira), rate)} EP`}
          </div>
        )}
        {status === "ok" && <Ok msg={statusMsg} />}
        {status === "err" && <Err msg={statusMsg} />}
      </div>

      <div className="d-actions">
        <button
          className="d-cta"
          disabled={!txHash.trim() || busy}
          onClick={verify}
        >
          {busy ? (
            <Loader size={15} className="x-spin" />
          ) : (
            <Shield size={15} color={T.bg} />
          )}
          {busy ? "Verifying…" : "Verify & Credit Wallet"}
        </button>
      </div>
    </>
  );
}

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────
const METHODS = [
  { id: "pay", icon: <IconCard s={16} />, label: "Pay" },
  { id: "import", icon: <IconDownload s={16} />, label: "Import" },
  { id: "receive", icon: <IconChain s={16} />, label: "Receive" },
];

const DepositTab = ({
  setActiveTab,
  userId: userIdProp,
  balance,
  onRefresh,
}) => {
  // ── ALWAYS resolve userId and email from auth context first ─────────────
  const { user, profile } = useAuth() || {};

  const resolvedUserId = user?.id || userIdProp || "";
  const resolvedEmail = profile?.email || user?.email || "";

  const [method, setMethod] = useState("pay");
  const [currency, setCurrency] = useState("EP");
  const { rate, live } = useRate();

  const xevBalance = balance?.tokens ?? 0;

  return (
    <div className="d-shell x-fade">
      <style>{CSS}</style>

      {/* Header with back button */}
      <div className="d-header">
        <button className="d-back" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="d-header-title">Add Funds</div>
          <div className="d-header-sub">Xeevia Wallet</div>
        </div>
        <div className="d-bal-chip">
          {xevBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
          XEV
        </div>
      </div>

      {/* Session error if no userId */}
      {!resolvedUserId && (
        <div className="d-session-err">
          ⚠ Session not detected — please sign out and sign back in.
        </div>
      )}

      {/* Live rate ticker */}
      <div className="d-ticker">
        <div className={`d-ticker-dot ${live ? "live" : "stale"}`} />
        <span>1 USD</span>
        <span className="d-ticker-sep">=</span>
        <span className="d-ticker-val">
          ₦{rate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="d-ticker-sep">·</span>
        <span className="d-ticker-val">100 EP</span>
        <span style={{ marginLeft: "auto", color: T.t4 }}>
          {live ? "live" : "cached"}
        </span>
      </div>

      {/* Currency toggle */}
      <CurrencyToggle value={currency} onChange={setCurrency} rate={rate} />

      {/* Method tabs */}
      <div className="d-methods">
        {METHODS.map((m) => (
          <button
            key={m.id}
            className={`d-meth${method === m.id ? " on" : ""}`}
            onClick={() => setMethod(m.id)}
          >
            <span className="d-meth-icon">{m.icon}</span>
            <span className="d-meth-lbl">{m.label}</span>
          </button>
        ))}
      </div>
      <div className="d-divider" />

      {method === "pay" && (
        <PayMode
          resolvedUserId={resolvedUserId}
          resolvedEmail={resolvedEmail}
          currency={currency}
          onRefresh={onRefresh}
          onBack={() => setActiveTab("overview")}
          rate={rate}
        />
      )}
      {method === "import" && (
        <ImportMode
          resolvedUserId={resolvedUserId}
          resolvedEmail={resolvedEmail}
          currency={currency}
          onRefresh={onRefresh}
          onBack={() => setActiveTab("overview")}
          rate={rate}
        />
      )}
      {method === "receive" && (
        <ReceiveMode
          resolvedUserId={resolvedUserId}
          currency={currency}
          onRefresh={onRefresh}
          rate={rate}
        />
      )}
    </div>
  );
};

export default DepositTab;
