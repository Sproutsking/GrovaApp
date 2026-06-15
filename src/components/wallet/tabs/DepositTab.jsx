// src/components/wallet/tabs/DepositTab.jsx  v9 — REDESIGN
// ════════════════════════════════════════════════════════════════════════════
// Stunning dark-glass redesign. Keeps all v8 logic intact:
//  • userId from useAuth() — never undefined
//  • DualInput stacks on narrow screens
//  • Rate live ticker
//  • EP / XEV toggle
//  • PAY (Paystack card + bank), IMPORT (wallet sign), RECEIVE (crypto address)
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Copy, CheckCircle, Shield, AlertCircle,
  X, Loader, ChevronRight, WifiOff, Zap, ArrowRight,
  CreditCard, Building2, Wallet, RefreshCw, TrendingUp,
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

// ── Treasury addresses ────────────────────────────────────────────────────────
const TREASURY = {
  evm: process.env.REACT_APP_TREASURY_WALLET || "0x62438e737C597250516798F175265E0edF446616",
  sol: process.env.REACT_APP_TREASURY_WALLET_SOL || "9KjmVg5UasBxNoVn9f2BFW7n6Mnhdg8GGFF5QuCX2PpS",
  ada: process.env.REACT_APP_TREASURY_WALLET_ADA || "addr1q8zkkwvsfrhjz3l80hvqcs93wtwy99rarz8lfmtllfhxu5zcjne5v0hv4kep395qczzcysmhxxm23zueeczxhhkgjntsplwdgf",
};

const NETWORKS = [
  { id: "usdt_trc20", label: "USDT", std: "TRC-20", net: "Tron",     col: "#26a17b", addr: TREASURY.sol },
  { id: "usdt_erc20", label: "USDT", std: "ERC-20", net: "Ethereum", col: "#26a17b", addr: TREASURY.evm },
  { id: "usdt_bep20", label: "USDT", std: "BEP-20", net: "BNB",      col: "#26a17b", addr: TREASURY.evm },
  { id: "usdt_sol",   label: "USDT", std: "SPL",    net: "Solana",   col: "#26a17b", addr: TREASURY.sol },
  { id: "eth",        label: "ETH",  std: "ERC-20", net: "Ethereum", col: "#627eea", addr: TREASURY.evm },
  { id: "bnb",        label: "BNB",  std: "BEP-20", net: "BNB",      col: "#f0b90b", addr: TREASURY.evm },
  { id: "sol",        label: "SOL",  std: "Native", net: "Solana",   col: "#9945ff", addr: TREASURY.sol },
  { id: "ada",        label: "ADA",  std: "Native", net: "Cardano",  col: "#0033ad", addr: TREASURY.ada },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

@keyframes dt-fade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes dt-spin  { to{transform:rotate(360deg)} }
@keyframes dt-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes dt-glow  { 0%,100%{box-shadow:0 0 20px rgba(163,230,53,.15)} 50%{box-shadow:0 0 40px rgba(163,230,53,.35)} }
@keyframes dt-ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes dt-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

.dt-shell {
  font-family: 'Syne', sans-serif;
  color: rgba(255,255,255,.92);
  background: transparent;
  padding-bottom: 40px;
  animation: dt-fade .3s ease both;
}

/* ── HEADER ── */
.dt-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0 16px;
  border-bottom: 1px solid rgba(255,255,255,.05);
  margin-bottom: 8px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(7,8,10,.97);
  backdrop-filter: blur(20px);
}
.dt-back {
  width: 34px; height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,.5);
  transition: all .2s; flex-shrink: 0;
}
.dt-back:hover { border-color: rgba(163,230,53,.4); color: #a3e635; }
.dt-header-info { flex: 1 }
.dt-header-title { font-size: 14px; font-weight: 800; color: rgba(255,255,255,.9); letter-spacing: -.2px }
.dt-header-sub   { font-size: 10px; color: rgba(255,255,255,.3); font-family: 'JetBrains Mono', monospace; margin-top: 1px }
.dt-xev-chip {
  padding: 6px 13px; border-radius: 8px;
  background: rgba(163,230,53,.08);
  border: 1px solid rgba(163,230,53,.2);
  font-size: 11px; font-weight: 700;
  color: #a3e635;
  font-family: 'JetBrains Mono', monospace;
}

/* ── RATE TICKER ── */
.dt-ticker-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px;
  background: rgba(255,255,255,.025);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
  position: relative;
}
.dt-ticker-dot {
  width: 6px; height: 6px;
  border-radius: 50%; flex-shrink: 0;
}
.dt-ticker-dot.live  { background: #a3e635; animation: dt-pulse 2s ease infinite; box-shadow: 0 0 8px #a3e635 }
.dt-ticker-dot.stale { background: rgba(255,255,255,.2) }
.dt-ticker-content {
  display: flex; align-items: center; gap: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; color: rgba(255,255,255,.4);
  flex: 1;
}
.dt-ticker-hl { color: rgba(255,255,255,.85); font-weight: 600 }
.dt-ticker-sep { color: rgba(255,255,255,.15) }
.dt-ticker-live-tag {
  margin-left: auto; font-size: 9px; font-weight: 700;
  color: #a3e635; text-transform: uppercase; letter-spacing: .1em; flex-shrink: 0;
}

/* ── CURRENCY TOGGLE ── */
.dt-cur-wrap { margin-bottom: 16px }
.dt-cur-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px; padding: 4px; gap: 4px;
  position: relative;
}
.dt-cur-btn {
  padding: 10px 0; border-radius: 9px;
  border: none; background: none;
  font-family: 'Syne', sans-serif;
  font-size: 12px; font-weight: 700;
  cursor: pointer;
  transition: all .2s;
  position: relative; z-index: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.dt-cur-btn.off { color: rgba(255,255,255,.35) }
.dt-cur-btn.on  { color: #0a0a0a; background: #a3e635; border-radius: 9px; }
.dt-cur-hint {
  text-align: center;
  font-size: 10px; color: rgba(255,255,255,.3);
  font-family: 'JetBrains Mono', monospace;
  margin-top: 8px;
}

/* ── METHOD TABS ── */
.dt-methods {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 6px; margin-bottom: 4px;
}
.dt-meth {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px;
  border-radius: 12px;
  border: 1.5px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03);
  cursor: pointer; font-family: 'Syne', sans-serif;
  transition: all .2s;
}
.dt-meth:hover { border-color: rgba(163,230,53,.25); background: rgba(163,230,53,.04) }
.dt-meth.on {
  border-color: rgba(163,230,53,.4);
  background: rgba(163,230,53,.07);
}
.dt-meth-icon { color: rgba(255,255,255,.3); display: flex; align-items: center }
.dt-meth.on .dt-meth-icon { color: #a3e635 }
.dt-meth-lbl { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .1em }
.dt-meth.on .dt-meth-lbl { color: #a3e635 }

.dt-divider { height: 1px; background: rgba(255,255,255,.05); margin: 16px 0 }

/* ── DUAL INPUT ── */
.dt-inputs { padding: 4px 0; display: flex; flex-direction: column; gap: 12px }
.dt-input-row {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: end; gap: 8px;
}
@media(max-width:480px) {
  .dt-input-row { grid-template-columns: 1fr; gap: 0 }
  .dt-arrow-sep  { display: none !important }
  .dt-field:last-child { margin-top: 10px }
}
.dt-field { position: relative }
.dt-field-label {
  font-size: 9px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(255,255,255,.3);
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 8px; display: block;
}
.dt-field-box {
  display: flex; align-items: center;
  background: rgba(255,255,255,.04);
  border: 1.5px solid rgba(255,255,255,.09);
  border-radius: 12px;
  padding: 13px 14px;
  transition: border-color .2s, background .2s;
  box-sizing: border-box; width: 100%;
}
.dt-field-box:focus-within {
  border-color: rgba(163,230,53,.4);
  background: rgba(163,230,53,.03);
}
.dt-field-box.active {
  border-color: rgba(163,230,53,.35);
  background: rgba(163,230,53,.04);
}
.dt-field-num {
  flex: 1; min-width: 0; background: none; border: none; outline: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(15px,3.5vw,22px);
  font-weight: 600; color: rgba(255,255,255,.9);
  letter-spacing: -.02em;
}
.dt-field-num::placeholder { color: rgba(255,255,255,.15) }
.dt-field-tag {
  flex-shrink: 0; margin-left: 8px;
  font-size: 9px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: .1em; text-transform: uppercase;
  padding: 4px 8px; border-radius: 5px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.4);
  white-space: nowrap;
}
.dt-field-tag.accent {
  color: #a3e635;
  border-color: rgba(163,230,53,.3);
  background: rgba(163,230,53,.08);
}
.dt-arrow-sep {
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 2px; flex-shrink: 0;
}
.dt-arrow-circle {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,.3);
}

/* ── QUICK AMOUNTS ── */
.dt-quick { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px }
.dt-q {
  padding: 8px 0; border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03);
  font-size: 11px; font-weight: 700;
  color: rgba(255,255,255,.35);
  cursor: pointer; font-family: 'JetBrains Mono', monospace;
  transition: all .15s; text-align: center;
}
.dt-q:hover { border-color: rgba(163,230,53,.25); color: rgba(163,230,53,.7) }
.dt-q.on    { background: rgba(163,230,53,.1); border-color: rgba(163,230,53,.4); color: #a3e635 }

/* ── ALERT BOXES ── */
.dt-ok  { display:flex; align-items:flex-start; gap:8px; padding:10px 13px; border-radius:10px; margin:10px 0 0; background:rgba(52,211,153,.07); border:1px solid rgba(52,211,153,.2); font-size:12px; font-weight:600; color:#34d399; line-height:1.5 }
.dt-err { display:flex; align-items:flex-start; gap:8px; padding:10px 13px; border-radius:10px; margin:10px 0 0; background:rgba(248,113,113,.07); border:1px solid rgba(248,113,113,.2); font-size:12px; font-weight:600; color:#f87171; line-height:1.5 }

/* ── PAYMENT BUTTONS ── */
.dt-pay-cards { display: flex; flex-direction: column; gap: 10px; padding: 16px 0 0 }
.dt-pay-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  background: rgba(255,255,255,.03);
  border: 1.5px solid rgba(255,255,255,.08);
  border-radius: 14px;
  cursor: pointer; width: 100%;
  font-family: 'Syne', sans-serif;
  transition: all .2s; text-align: left;
}
.dt-pay-card:hover:not(:disabled) {
  border-color: rgba(255,255,255,.16);
  background: rgba(255,255,255,.055);
  transform: translateY(-1px);
}
.dt-pay-card:disabled { opacity: .3; cursor: not-allowed }
.dt-pay-card.loading  { opacity: .6; pointer-events: none }
.dt-pay-icon {
  width: 42px; height: 42px; border-radius: 12px;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.dt-pay-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.9) }
.dt-pay-sub  { font-size: 10px; color: rgba(255,255,255,.35); margin-top: 2px; font-family: 'JetBrains Mono', monospace }
.dt-pay-badge {
  margin-left: auto; padding: 4px 10px; border-radius: 5px;
  font-size: 9px; font-weight: 700; flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: .08em; text-transform: uppercase;
}

/* ── CTA BUTTON ── */
.dt-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 15px;
  background: #a3e635; border: none; border-radius: 12px;
  font-size: 13px; font-weight: 800;
  color: #070809; cursor: pointer;
  font-family: 'Syne', sans-serif;
  letter-spacing: -.2px;
  box-shadow: 0 8px 32px rgba(163,230,53,.25);
  transition: all .2s;
}
.dt-cta:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); box-shadow: 0 12px 40px rgba(163,230,53,.35) }
.dt-cta:disabled { opacity: .2; cursor: not-allowed; transform: none; box-shadow: none }

.dt-ghost {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 11px;
  border: 1.5px solid rgba(255,255,255,.09); background: none;
  border-radius: 12px; font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,.4); cursor: pointer;
  font-family: 'Syne', sans-serif;
  transition: all .15s; margin-top: 8px;
}
.dt-ghost:hover { border-color: rgba(255,255,255,.16); color: rgba(255,255,255,.7) }

/* ── SECURITY NOTE ── */
.dt-sec {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 12px 14px; margin-top: 14px;
  background: rgba(163,230,53,.04);
  border: 1px solid rgba(163,230,53,.12);
  border-radius: 12px;
}
.dt-sec-title { font-size: 11px; font-weight: 700; color: rgba(163,230,53,.8); margin-bottom: 2px }
.dt-sec-body  { font-size: 10px; color: rgba(255,255,255,.35); line-height: 1.6; font-family: 'JetBrains Mono', monospace }

/* ── SUCCESS SCREEN ── */
.dt-done {
  display: flex; flex-direction: column; align-items: center;
  padding: 48px 20px 32px; text-align: center;
  animation: dt-fade .4s ease;
}
.dt-done-ring {
  width: 72px; height: 72px; border-radius: 50%;
  background: rgba(163,230,53,.08);
  border: 1px solid rgba(163,230,53,.25);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px;
  animation: dt-glow 2.5s ease infinite;
}
.dt-done h2  { font-size: 24px; font-weight: 800; color: rgba(255,255,255,.95); margin: 0 0 8px; letter-spacing: -.5px }
.dt-done p   { font-size: 12px; color: rgba(255,255,255,.4); margin: 0; line-height: 1.7; font-family: 'JetBrains Mono', monospace }
.dt-done-ref { font-size: 9px; font-family: 'JetBrains Mono', monospace; color: rgba(255,255,255,.2); margin-top: 5px }
.dt-done-chip {
  padding: 10px 24px; border-radius: 8px;
  font-size: 20px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  border: 1px solid rgba(163,230,53,.3);
  color: #a3e635; background: rgba(163,230,53,.08);
  margin: 20px 0 28px; letter-spacing: -.02em;
}

/* ── LOADING SCREEN ── */
.dt-loading {
  display: flex; flex-direction: column; align-items: center;
  padding: 60px 20px; gap: 16px; text-align: center;
}
.dt-loading-ring {
  width: 60px; height: 60px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.dt-loading-title { font-size: 14px; font-weight: 700; letter-spacing: -.2px; color: rgba(255,255,255,.9) }
.dt-loading-sub   { font-size: 11px; color: rgba(255,255,255,.3); font-family: 'JetBrains Mono', monospace; white-space: pre-line }

/* ── WALLET CARDS (Import) ── */
.dt-wcard {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 12px; margin-bottom: 8px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03);
  transition: all .2s;
}
.dt-wcard:hover { border-color: rgba(255,255,255,.14); background: rgba(255,255,255,.05) }
.dt-wicon { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 19px }
.dt-wimport {
  padding: 7px 14px; border-radius: 8px;
  font-size: 11px; font-weight: 700;
  color: #a3e635; background: rgba(163,230,53,.1);
  border: 1px solid rgba(163,230,53,.25);
  cursor: pointer; font-family: 'Syne', sans-serif;
  transition: all .15s; text-transform: uppercase; letter-spacing: .06em;
}
.dt-wimport:hover { background: rgba(163,230,53,.18) }
.dt-wremove {
  font-size: 9px; color: rgba(255,255,255,.2); cursor: pointer;
  background: none; border: none;
  font-family: 'JetBrains Mono', monospace;
  display: block; margin-top: 4px; text-align: right;
  transition: color .12s;
}
.dt-wremove:hover { color: #f87171 }
.dt-scan-btn {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 12px 14px;
  border-radius: 12px; border: 1.5px dashed rgba(255,255,255,.1);
  background: none; cursor: pointer; font-family: 'Syne', sans-serif;
  text-align: left; transition: all .15s; margin-top: 6px;
}
.dt-scan-btn:hover { border-color: rgba(163,230,53,.3); background: rgba(163,230,53,.03) }

/* ── CRYPTO RECEIVE ── */
.dt-ngrid { display: grid; grid-template-columns: repeat(4,1fr); gap: 5px; margin: 12px 0 }
.dt-nbtn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 9px 4px; border-radius: 10px;
  border: 1.5px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.025);
  cursor: pointer; font-family: 'Syne', sans-serif;
  transition: all .15s;
}
.dt-nbtn:hover { border-color: rgba(255,255,255,.14); background: rgba(255,255,255,.05) }
.dt-nbtn.on { background: rgba(163,230,53,.07); border-color: rgba(163,230,53,.3) }
.dt-nbtn-tk  { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.5) }
.dt-nbtn.on .dt-nbtn-tk { color: #a3e635 }
.dt-nbtn-std { font-size: 8px; color: rgba(255,255,255,.25); font-family: 'JetBrains Mono', monospace }

.dt-net-info {
  display: flex; gap: 0;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px; overflow: hidden; margin-bottom: 12px;
}
.dt-np {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 6px; border-right: 1px solid rgba(255,255,255,.06);
}
.dt-np:last-child { border-right: none }
.dt-npk { font-size: 8px; color: rgba(255,255,255,.25); font-weight: 700; text-transform: uppercase; letter-spacing: .1em; font-family: 'Syne', sans-serif }
.dt-npv { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.8); font-family: 'JetBrains Mono', monospace }

.dt-addr-box {
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px; padding: 14px; margin-bottom: 12px;
}
.dt-addr-label { font-size: 9px; color: rgba(255,255,255,.25); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 10px; font-family: 'JetBrains Mono', monospace }
.dt-addr-row   { display: flex; align-items: flex-start; gap: 10px }
.dt-addr-text  { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: rgba(255,255,255,.6); word-break: break-all; line-height: 1.65; flex: 1 }
.dt-copy-btn {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,.35);
  transition: all .15s; margin-top: 1px;
}
.dt-copy-btn:hover  { border-color: rgba(163,230,53,.35); color: #a3e635 }
.dt-copy-btn.copied { border-color: rgba(52,211,153,.35); color: #34d399 }

.dt-addr-warn {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 8px 12px; margin-top: 10px;
  background: rgba(248,113,113,.05); border: 1px solid rgba(248,113,113,.15);
  border-radius: 8px; font-size: 10.5px; color: rgba(248,113,113,.8); line-height: 1.55;
  font-family: 'JetBrains Mono', monospace;
}

/* ── TEXT INPUTS ── */
.dt-label { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.3); margin-bottom: 7px; display: block; font-family: 'JetBrains Mono', monospace }
.dt-input {
  width: 100%; padding: 11px 13px;
  background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.09);
  border-radius: 10px; font-size: 12.5px; color: rgba(255,255,255,.85);
  font-family: 'JetBrains Mono', monospace;
  outline: none; box-sizing: border-box; transition: border-color .2s;
}
.dt-input::placeholder { color: rgba(255,255,255,.2) }
.dt-input:focus { border-color: rgba(163,230,53,.35) }

.dt-section { margin-top: 14px }
.dt-spin { animation: dt-spin .7s linear infinite }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function nairaToEP(n, rate)  { return Math.floor((parseFloat(n) / rate) * 100) }
function epToNaira(ep, rate) { return Math.round((parseFloat(ep) / 100) * rate) }
function nairaToXEV(n)       { return +(parseFloat(n) / 2.5).toFixed(2) }
function xevToNaira(xev)     { return Math.round(parseFloat(xev) * 2.5) }

const AlertOk  = ({ msg }) => msg ? <div className="dt-ok"><CheckCircle size={14} style={{flexShrink:0,marginTop:1}}/>{msg}</div> : null;
const AlertErr = ({ msg }) => msg ? <div className="dt-err"><AlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>{msg}</div> : null;

const SpinScreen = ({ color, title, sub }) => (
  <div className="dt-loading">
    <div className="dt-loading-ring" style={{background:`${color}12`,border:`1px solid ${color}30`}}>
      <Loader size={22} color={color} className="dt-spin"/>
    </div>
    <div className="dt-loading-title">{title}</div>
    {sub && <div className="dt-loading-sub">{sub}</div>}
  </div>
);

function useRate() {
  const [rate, setRate] = useState(getCachedUSDNGN());
  const [live, setLive] = useState(false);
  useEffect(() => {
    getLiveUSDNGN().then(r => { setRate(r); setLive(true) }).catch(() => {});
  }, []);
  return { rate, live };
}

// ── Dual Input ────────────────────────────────────────────────────────────────
function DualInput({ currency, rate, onNairaChange }) {
  const [left,    setLeft]    = useState("");
  const [right,   setRight]   = useState("");
  const [activeQ, setActiveQ] = useState(null);
  const busy = useRef(false);
  const isEP = currency === "EP";

  useEffect(() => {
    if (!left) { setRight(""); return; }
    const n = parseFloat(left);
    if (!n) return;
    setRight(isEP ? String(nairaToEP(n, rate)) : String(nairaToXEV(n)));
  }, [currency, rate]); // eslint-disable-line

  const handleLeft = (v) => {
    if (busy.current) return;
    busy.current = true;
    setLeft(v); setActiveQ(null);
    const n = parseFloat(v);
    setRight(v === "" || !n ? "" : isEP ? String(nairaToEP(n, rate)) : String(nairaToXEV(n)));
    if (onNairaChange) onNairaChange(v);
    busy.current = false;
  };

  const handleRight = (v) => {
    if (busy.current) return;
    busy.current = true;
    setRight(v); setActiveQ(null);
    const n = parseFloat(v);
    if (v === "" || !n) {
      setLeft(""); if (onNairaChange) onNairaChange("");
    } else {
      const naira = isEP ? String(epToNaira(n, rate)) : String(xevToNaira(n));
      setLeft(naira); if (onNairaChange) onNairaChange(naira);
    }
    busy.current = false;
  };

  const quick = (a) => { setActiveQ(a); handleLeft(String(a)); };

  return (
    <div className="dt-inputs">
      <div className="dt-input-row">
        <div className="dt-field">
          <span className="dt-field-label">You Pay</span>
          <div className="dt-field-box">
            <input className="dt-field-num" type="number" placeholder="0" value={left}
              onChange={e => handleLeft(e.target.value)}/>
            <span className="dt-field-tag">NGN</span>
          </div>
        </div>
        <div className="dt-arrow-sep">
          <div className="dt-arrow-circle"><ArrowRight size={11}/></div>
        </div>
        <div className="dt-field">
          <span className="dt-field-label">You Get</span>
          <div className={`dt-field-box${left ? " active" : ""}`}>
            <input className="dt-field-num" type="number" placeholder="0" value={right}
              onChange={e => handleRight(e.target.value)}
              style={{color: left ? "#a3e635" : undefined}}/>
            <span className={`dt-field-tag${left ? " accent" : ""}`}>{isEP ? "EP" : "XEV"}</span>
          </div>
        </div>
      </div>
      <div className="dt-quick">
        {[500,1000,2000,5000].map(a => (
          <button key={a} className={`dt-q${activeQ===a?" on":""}`} onClick={() => quick(a)}>
            ₦{a>=1000?`${a/1000}k`:a}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── PAY mode ──────────────────────────────────────────────────────────────────
function PayMode({ resolvedUserId, resolvedEmail, currency, onRefresh, onBack, rate }) {
  const [naira,   setNaira]   = useState("");
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);

  const open = async (channel) => {
    const n = parseFloat(naira);
    if (!n || n < MIN_DEPOSIT) { setError(`Minimum ₦${MIN_DEPOSIT}`); return; }
    if (!resolvedUserId) { setError("Session not found — please sign out and sign back in."); return; }
    if (!resolvedEmail)  { setError("Email not found — please update your profile."); return; }
    setError(""); setLoading(channel);
    try {
      const res = await depositPaystackOpen({ userId: resolvedUserId, email: resolvedEmail, nairaAmount: naira, channel, currency, onCancel: () => setLoading(null) });
      setResult(res); if (onRefresh) onRefresh();
    } catch (e) {
      if (!e.cancelled) setError(e.message || "Payment failed");
    } finally { setLoading(null); }
  };

  if (result) return (
    <div className="dt-done">
      <div className="dt-done-ring"><Zap size={30} color="#a3e635" fill="#a3e635"/></div>
      <h2>Payment Sent</h2>
      <p>₦{parseFloat(naira).toLocaleString()} via Paystack<br/>Balance updates after webhook confirmation.</p>
      <div className="dt-done-ref">ref: {result.reference}</div>
      <div className="dt-done-chip">+{result.credit} {result.label || (currency==="XEV"?"$XEV":"EP")}</div>
      <button className="dt-cta" onClick={()=>{setResult(null);setNaira("");}}>Deposit More</button>
      <button className="dt-ghost" onClick={onBack}>Back to Wallet</button>
    </div>
  );

  const canPay = !!naira && parseFloat(naira) >= MIN_DEPOSIT;

  return (
    <>
      <DualInput currency={currency} rate={rate} onNairaChange={setNaira}/>
      <AlertErr msg={error}/>
      <div className="dt-pay-cards">
        {/* Card */}
        <button className={`dt-pay-card${loading==="card"?" loading":""}`}
          onClick={() => open("card")} disabled={!!loading || !canPay}>
          <div className="dt-pay-icon" style={{background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.2)"}}>
            {loading==="card" ? <Loader size={18} color="#3b82f6" className="dt-spin"/> : <CreditCard size={18} color="#3b82f6"/>}
          </div>
          <div style={{flex:1}}>
            <div className="dt-pay-name">Pay with Card</div>
            <div className="dt-pay-sub">Visa · Mastercard · Verve · All cards</div>
          </div>
          <span className="dt-pay-badge" style={{background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.2)",color:"#3b82f6"}}>
            {loading==="card"?"OPENING":"INSTANT"}
          </span>
        </button>
        {/* Bank */}
        <button className={`dt-pay-card${loading==="bank_transfer"?" loading":""}`}
          onClick={() => open("bank_transfer")} disabled={!!loading || !canPay}>
          <div className="dt-pay-icon" style={{background:"rgba(163,230,53,.08)",border:"1px solid rgba(163,230,53,.18)"}}>
            {loading==="bank_transfer" ? <Loader size={18} color="#a3e635" className="dt-spin"/> : <Building2 size={18} color="#a3e635"/>}
          </div>
          <div style={{flex:1}}>
            <div className="dt-pay-name">Bank Transfer</div>
            <div className="dt-pay-sub">Any Nigerian bank · Virtual account</div>
          </div>
          <span className="dt-pay-badge" style={{background:"rgba(163,230,53,.08)",border:"1px solid rgba(163,230,53,.2)",color:"#a3e635"}}>
            {loading==="bank_transfer"?"OPENING":"REAL-TIME"}
          </span>
        </button>
      </div>
      <div className="dt-sec">
        <Shield size={14} style={{flexShrink:0,marginTop:2,color:"#a3e635"}}/>
        <div>
          <div className="dt-sec-title">Secured by Paystack · PCI-DSS Level 1</div>
          <div className="dt-sec-body">{currency} credited automatically after webhook verification. We never store card details.</div>
        </div>
      </div>
    </>
  );
}

// ── IMPORT mode ───────────────────────────────────────────────────────────────
function ImportMode({ resolvedUserId, resolvedEmail, currency, onRefresh, onBack, rate }) {
  const KEY  = `xev_wl_${resolvedUserId}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)||"[]") } catch { return [] } };
  const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)) } catch {} };

  const [phase,   setPhase]   = useState("list");
  const [wallets, setWallets] = useState(load);
  const [sel,     setSel]     = useState(null);
  const [naira,   setNaira]   = useState("");
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);

  const scan = useCallback(async () => {
    setPhase("scanning"); setError("");
    try {
      const found = await depositDetectBrowserWallets();
      const merged = [...wallets];
      found.forEach(w => { if (!merged.find(m => m.id===w.id)) merged.push(w); });
      setWallets(merged); save(merged);
    } catch (e) { setError(e.message); }
    setPhase("list");
  }, [wallets]); // eslint-disable-line

  const remove = (id) => { const n = wallets.filter(w => w.id!==id); setWallets(n); save(n); };

  const doImport = useCallback(async () => {
    if (!sel) return;
    const n = parseFloat(naira);
    if (!n || n < MIN_DEPOSIT) { setError(`Minimum ₦${MIN_DEPOSIT}`); return; }
    setError(""); setPhase("signing");
    try {
      const res = await depositSmartImport({ wallet:sel, nairaAmount:naira, userId:resolvedUserId, email:resolvedEmail, currency });
      setResult(res); setPhase("done"); if (onRefresh) onRefresh();
    } catch (e) { setError(e.message||"Import failed"); setPhase("amount"); }
  }, [sel, naira, resolvedUserId, resolvedEmail, currency, onRefresh]); // eslint-disable-line

  if (phase==="done"&&result) return (
    <div className="dt-done">
      <div className="dt-done-ring"><Zap size={30} color="#a3e635" fill="#a3e635"/></div>
      <h2>Imported!</h2>
      <p>Signed via {sel?.name}</p>
      <div className="dt-done-ref">ref: {result.reference}</div>
      <div className="dt-done-chip">+{result.credit} {result.label}</div>
      <button className="dt-cta" onClick={onBack}>Back to Wallet</button>
      <button className="dt-ghost" onClick={()=>{setPhase("list");setResult(null);}}>Import More</button>
    </div>
  );
  if (phase==="signing") return <SpinScreen color="#a3e635" title="Awaiting signature…" sub={`${sel?.name} is requesting approval.\nCheck your wallet extension.`}/>;
  if (phase==="scanning") return <SpinScreen color="#3b82f6" title="Scanning browser…" sub="MetaMask · Phantom · TronLink · Coinbase · Rabby"/>;

  if (phase==="amount"&&sel) return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",margin:"14px 0 0",
        background:`${sel.color}0a`,border:`1px solid ${sel.color}2a`,borderRadius:12}}>
        <div className="dt-wicon" style={{background:`${sel.color}14`,border:`1px solid ${sel.color}25`}}>{sel.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.9)"}}>{sel.name}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'JetBrains Mono',monospace"}}>{sel.currency}</div>
        </div>
        <button onClick={()=>setPhase("list")} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.3)",display:"flex"}}>
          <X size={15}/>
        </button>
      </div>
      <DualInput currency={currency} rate={rate} onNairaChange={setNaira}/>
      <AlertErr msg={error}/>
      <div style={{paddingTop:14,display:"flex",flexDirection:"column",gap:8}}>
        <button className="dt-cta" disabled={!naira||parseFloat(naira)<MIN_DEPOSIT} onClick={doImport}>
          Import from {sel.name}
        </button>
        <button className="dt-ghost" onClick={()=>setPhase("list")}>← Back</button>
      </div>
    </>
  );

  return (
    <div className="dt-section">
      <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.7)",marginBottom:4,textTransform:"uppercase",letterSpacing:".04em"}}>Connected Wallets</div>
      <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:14,fontFamily:"'JetBrains Mono',monospace"}}>
        Select → enter amount → sign once → {currency} credited instantly
      </div>
      {!wallets.length && (
        <div style={{padding:"28px 0 18px",textAlign:"center",color:"rgba(255,255,255,.3)"}}>
          <WifiOff size={30} style={{opacity:.15,marginBottom:10,display:"block",margin:"0 auto 10px"}}/>
          <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.4)",marginBottom:3}}>No wallets detected</div>
          <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>Scan your browser below</div>
        </div>
      )}
      {wallets.map(w => (
        <div key={w.id} className="dt-wcard">
          <div className="dt-wicon" style={{background:`${w.color}14`,border:`1px solid ${w.color}25`}}>{w.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.88)"}}>{w.name}</div>
            <div style={{fontSize:9,color:"#34d399",fontWeight:700,display:"flex",alignItems:"center",gap:4,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#34d399",flexShrink:0}}/>
              {w.currency}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
            <button className="dt-wimport" onClick={()=>{setSel(w);setNaira("");setError("");setPhase("amount");}}>Import →</button>
            <button className="dt-wremove" onClick={()=>remove(w.id)}>remove</button>
          </div>
        </div>
      ))}
      <button className="dt-scan-btn" onClick={scan}>
        <div style={{width:36,height:36,borderRadius:9,border:"1.5px dashed rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"rgba(255,255,255,.3)"}}>
          <RefreshCw size={14}/>
        </div>
        <div style={{flex:1,textAlign:"left"}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".04em"}}>
            {wallets.length?"Scan for More":"Detect Wallets"}
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:1,fontFamily:"'JetBrains Mono',monospace"}}>MetaMask · Phantom · TronLink · Coinbase</div>
        </div>
        <ChevronRight size={13} color="rgba(255,255,255,.2)"/>
      </button>
      <AlertErr msg={error}/>
    </div>
  );
}

// ── RECEIVE mode ──────────────────────────────────────────────────────────────
function ReceiveMode({ resolvedUserId, currency, onRefresh, rate }) {
  const [net,      setNet]      = useState(NETWORKS[0]);
  const [txHash,   setTxHash]   = useState("");
  const [naira,    setNaira]    = useState("");
  const [copied,   setCopied]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [status,   setStatus]   = useState(null);
  const [statusMsg,setStatusMsg]= useState("");

  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {}
  };

  const verify = async () => {
    if (!txHash.trim()) return;
    setBusy(true); setStatus(null);
    try {
      const r = await depositCryptoVerify({ userId:resolvedUserId, txHash:txHash.trim(), tokenId:net.id, network:net.net, nairaEquivalent:parseFloat(naira)||0, currency });
      if (r.success) {
        const amt = currency==="XEV" ? nairaToXEV(parseFloat(naira)||0) : nairaToEP(parseFloat(naira)||0,rate);
        setStatusMsg(`Verified! +${amt} ${currency} credited.`); setStatus("ok");
        if (onRefresh) onRefresh();
      } else { setStatus("err"); setStatusMsg("Transaction not found. Check hash and network."); }
    } catch(e) { setStatus("err"); setStatusMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="dt-ngrid">
        {NETWORKS.map(n => (
          <button key={n.id} className={`dt-nbtn${net.id===n.id?" on":""}`}
            onClick={()=>{setNet(n);setCopied(false);setTxHash("");setStatus(null);}}>
            <span className="dt-nbtn-tk" style={net.id===n.id?{color:n.col}:{}}>{n.label}</span>
            <span className="dt-nbtn-std">{n.std}</span>
          </button>
        ))}
      </div>

      <div className="dt-net-info">
        {[["Token",net.label],["Network",net.net],["Std",net.std],["Min","$1"]].map(([k,v])=>(
          <div key={k} className="dt-np">
            <span className="dt-npk">{k}</span>
            <span className="dt-npv" style={k==="Token"?{color:net.col}:{}}>{v}</span>
          </div>
        ))}
      </div>

      <div className="dt-addr-box">
        <div className="dt-addr-label">Send {net.label} ({net.std}) on {net.net} only</div>
        <div className="dt-addr-row">
          <code className="dt-addr-text">{net.addr}</code>
          <button className={`dt-copy-btn${copied?" copied":""}`} onClick={()=>copy(net.addr)}>
            {copied ? <CheckCircle size={14}/> : <Copy size={14}/>}
          </button>
        </div>
        <div className="dt-addr-warn">
          <AlertCircle size={12} style={{flexShrink:0,marginTop:1}}/>
          <span>Only send <strong>{net.label} on {net.net}</strong>. Wrong network = <strong>permanent loss.</strong></span>
        </div>
      </div>

      <div className="dt-section">
        <label className="dt-label">Transaction Hash (TXID)</label>
        <input className="dt-input" placeholder={net.net==="Tron"?"transaction hash…":"0x…"}
          value={txHash} onChange={e=>{setTxHash(e.target.value);setStatus(null);}}/>
        <label className="dt-label" style={{marginTop:12}}>₦ Equivalent (for preview)</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:13,fontWeight:700,color:"rgba(255,255,255,.3)",fontFamily:"'JetBrains Mono',monospace",pointerEvents:"none"}}>₦</span>
          <input className="dt-input" style={{paddingLeft:24}} type="number" placeholder="0"
            value={naira} onChange={e=>setNaira(e.target.value)}/>
        </div>
        {naira && (
          <div style={{fontSize:11,color:"rgba(255,255,255,.3)",fontFamily:"'JetBrains Mono',monospace",marginTop:7}}>
            {currency==="XEV"
              ? `₦${parseFloat(naira).toLocaleString()} → +${nairaToXEV(parseFloat(naira))} $XEV`
              : `₦${parseFloat(naira).toLocaleString()} → +${nairaToEP(parseFloat(naira),rate)} EP`}
          </div>
        )}
        <AlertOk  msg={status==="ok"  ? statusMsg : ""}/>
        <AlertErr msg={status==="err" ? statusMsg : ""}/>
      </div>

      <div style={{paddingTop:16}}>
        <button className="dt-cta" disabled={!txHash.trim()||busy} onClick={verify}>
          {busy ? <Loader size={15} className="dt-spin"/> : <Shield size={15} color="#070809"/>}
          {busy ? "Verifying…" : "Verify & Credit Wallet"}
        </button>
      </div>
    </>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
const METHODS = [
  { id:"pay",     icon:<CreditCard size={16}/>,  label:"Pay"     },
  { id:"import",  icon:<Wallet size={16}/>,      label:"Import"  },
  { id:"receive", icon:<TrendingUp size={16}/>,  label:"Receive" },
];

export default function DepositTab({ setActiveTab, userId: userIdProp, balance, onRefresh }) {
  const { user, profile } = useAuth() || {};
  const resolvedUserId = user?.id || userIdProp || "";
  const resolvedEmail  = profile?.email || user?.email || "";
  const [method,   setMethod]   = useState("pay");
  const [currency, setCurrency] = useState("EP");
  const { rate, live } = useRate();
  const xevBalance = balance?.tokens ?? 0;

  return (
    <div className="dt-shell">
      <style>{CSS}</style>

      {/* Header */}
      <div className="dt-header">
        <button className="dt-back" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={15}/>
        </button>
        <div className="dt-header-info">
          <div className="dt-header-title">Add Funds</div>
          <div className="dt-header-sub">Xeevia Wallet · Secure Deposit</div>
        </div>
        <div className="dt-xev-chip">{xevBalance.toLocaleString(undefined,{maximumFractionDigits:4})} XEV</div>
      </div>

      {/* Session warning */}
      {!resolvedUserId && (
        <div style={{margin:"8px 0 12px",padding:"9px 13px",borderRadius:9,background:"rgba(248,113,113,.07)",border:"1px solid rgba(248,113,113,.2)",fontSize:11,color:"#f87171",fontFamily:"'JetBrains Mono',monospace"}}>
          ⚠ Session not detected — please sign out and sign back in.
        </div>
      )}

      {/* Rate ticker */}
      <div className="dt-ticker-bar">
        <div className={`dt-ticker-dot ${live?"live":"stale"}`}/>
        <div className="dt-ticker-content">
          <span>1 USD</span>
          <span className="dt-ticker-sep">·</span>
          <span className="dt-ticker-hl">₦{rate.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
          <span className="dt-ticker-sep">·</span>
          <span className="dt-ticker-hl">100 EP</span>
          <span className="dt-ticker-sep">·</span>
          <span>₦2.50 = 1 XEV</span>
        </div>
        <span className="dt-ticker-live-tag">{live?"live":"cached"}</span>
      </div>

      {/* Currency toggle */}
      <div className="dt-cur-wrap">
        <div className="dt-cur-grid">
          <button className={`dt-cur-btn ${currency==="EP"?"on":"off"}`} onClick={()=>setCurrency("EP")}>
            ⚡ EP
          </button>
          <button className={`dt-cur-btn ${currency==="XEV"?"on":"off"}`} onClick={()=>setCurrency("XEV")}>
            ◈ $XEV
          </button>
        </div>
        <div className="dt-cur-hint">
          {currency==="EP"
            ? `$1 = 100 EP · ₦${rate.toLocaleString(undefined,{maximumFractionDigits:0})} ≈ 100 EP`
            : `₦2.50 = 1 $XEV · 10 EP = 1 $XEV`}
        </div>
      </div>

      {/* Method tabs */}
      <div className="dt-methods">
        {METHODS.map(m => (
          <button key={m.id} className={`dt-meth${method===m.id?" on":""}`} onClick={()=>setMethod(m.id)}>
            <span className="dt-meth-icon">{m.icon}</span>
            <span className="dt-meth-lbl">{m.label}</span>
          </button>
        ))}
      </div>
      <div className="dt-divider"/>

      {method==="pay"     && <PayMode     resolvedUserId={resolvedUserId} resolvedEmail={resolvedEmail} currency={currency} onRefresh={onRefresh} onBack={()=>setActiveTab("overview")} rate={rate}/>}
      {method==="import"  && <ImportMode  resolvedUserId={resolvedUserId} resolvedEmail={resolvedEmail} currency={currency} onRefresh={onRefresh} onBack={()=>setActiveTab("overview")} rate={rate}/>}
      {method==="receive" && <ReceiveMode resolvedUserId={resolvedUserId} currency={currency} onRefresh={onRefresh} rate={rate}/>}
    </div>
  );
}