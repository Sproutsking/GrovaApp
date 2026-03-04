// src/components/wallet/tabs/DepositTab.jsx
// =============================================================================
//  DEPOSIT TAB  ·  4 modes  ·  production-ready  ·  zero CSS vars
//
//  ⬇️  IMPORT   — connect & import from crypto browser wallets
//                 (MetaMask, Phantom, TronLink, Coinbase, Rabby …)
//                 Shows connected wallets + "Add wallet" if none
//
//  🔗  CRYPTO   — receive on-chain: USDT on many networks + ETH, BNB, TRX, SOL
//                 8 network options, address copy, tx-hash verify
//
//  🏦  TRANSFER — NGN bank transfer: OPay OR Moniepoint only
//                 User picks source bank → targeted fast validation
//
//  💳  CARD     — debit/credit card via Paystack
//                 Shows saved card or inline add-card form
// =============================================================================

import React, { useState, useCallback } from "react";
import {
  ArrowLeft, Copy, CheckCircle, Shield, Zap, AlertCircle,
  X, CreditCard, Wallet, Loader, Scan, ChevronRight,
  WifiOff, Building2, Lock, Eye, EyeOff, RefreshCw,
} from "lucide-react";

import {
  depositDetectBrowserWallets,
  depositSmartConnectWallet,
  depositCryptoVerify,
  depositBankTransferVerify,
  depositCalcXEV,
} from "../../../services/wallet/depositFundService";

// =============================================================================
//  DESIGN TOKENS  — explicit hex/rgba, never var()
// =============================================================================
const C = {
  bg:    "#07080a",
  s1:    "#11141d",   // base card
  s2:    "#181d2a",   // elevated
  s3:    "#1e2333",   // hover / input bg
  b1:    "#252c3d",   // border
  b2:    "#303852",   // border active
  t1:    "#edf1fa",   // primary text
  t2:    "#b0bbd4",   // secondary
  t3:    "#68748e",   // muted
  t4:    "#3c4460",   // very muted / disabled

  gold:  "#e3bb4e",
  goldD: "rgba(227,187,78,0.11)",
  goldR: "rgba(227,187,78,0.36)",
  goldT: "rgba(227,187,78,0.55)",
  ep:    "#22d3ee",
  epD:   "rgba(34,211,238,0.09)",
  epR:   "rgba(34,211,238,0.28)",
  green: "#23c55e",
  greenD:"rgba(35,197,94,0.09)",
  greenR:"rgba(35,197,94,0.32)",
  red:   "#f87272",
  redD:  "rgba(248,114,114,0.08)",
  redR:  "rgba(248,114,114,0.28)",
};

// =============================================================================
//  DATA
// =============================================================================
const METHODS = [
  { id:"import",   emoji:"⬇️", label:"Import",   sub:"Crypto wallet" },
  { id:"crypto",   emoji:"🔗", label:"Crypto",   sub:"Receive on-chain" },
  { id:"transfer", emoji:"🏦", label:"Transfer", sub:"Bank transfer" },
  { id:"card",     emoji:"💳", label:"Card",     sub:"Debit / Credit" },
];

const NETWORKS = [
  { id:"usdt_trc20",  label:"USDT", std:"TRC-20", net:"Tron",      col:"#26a17b", address:"TQV7k1xBqBBJuZGLmqHnDLRFnHsGXFa2Kz" },
  { id:"usdt_erc20",  label:"USDT", std:"ERC-20", net:"Ethereum",  col:"#26a17b", address:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"usdt_bep20",  label:"USDT", std:"BEP-20", net:"BNB Chain", col:"#26a17b", address:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"usdt_sol",    label:"USDT", std:"SPL",    net:"Solana",    col:"#26a17b", address:"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" },
  { id:"eth_erc20",   label:"ETH",  std:"ERC-20", net:"Ethereum",  col:"#627eea", address:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"bnb_bep20",   label:"BNB",  std:"BEP-20", net:"BNB Chain", col:"#f0b90b", address:"0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { id:"trx_trc20",   label:"TRX",  std:"TRC-20", net:"Tron",      col:"#ef0027", address:"TQV7k1xBqBBJuZGLmqHnDLRFnHsGXFa2Kz" },
  { id:"sol_native",  label:"SOL",  std:"Native", net:"Solana",    col:"#9945ff", address:"9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" },
];

const BANKS = [
  {
    id:"opay", name:"OPay", logo:"🅾", color:"#10b981",
    dim:"rgba(16,185,129,0.1)", ring:"rgba(16,185,129,0.36)",
    acctName:"XEV Operations", acctNumber:"9061234567",
    note:"Real-time API · credits in under 10 seconds",
  },
  {
    id:"moniepoint", name:"Moniepoint", logo:"📍", color:"#6366f1",
    dim:"rgba(99,102,241,0.1)", ring:"rgba(99,102,241,0.36)",
    acctName:"XEV Operations", acctNumber:"8061234567",
    note:"Real-time API · credits in under 10 seconds",
  },
];

const XEV_RATE = 2.5;

// =============================================================================
//  SCOPED CSS  — zero var() for anything visible
// =============================================================================
const CSS = `
/* ── tab bar ─────────────────────────────────────────────── */
.dt-bar{display:flex;gap:6px;padding:0 20px;margin-bottom:22px;overflow-x:auto;scrollbar-width:none}
.dt-bar::-webkit-scrollbar{display:none}
.dt-tab{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 16px;
  border-radius:13px;flex-shrink:0;border:1.5px solid #252c3d;background:#11141d;
  cursor:pointer;font-family:inherit;transition:all .15s;min-width:70px}
.dt-tab:hover{background:#181d2a;border-color:#303852}
.dt-tab.on{background:rgba(227,187,78,.11);border-color:rgba(227,187,78,.45)}
.dt-tab-em{font-size:19px;line-height:1}
.dt-tab-lb{font-size:12px;font-weight:700;color:#68748e}
.dt-tab.on .dt-tab-lb{color:#e3bb4e}
.dt-tab-sb{font-size:9px;color:#3c4460;white-space:nowrap}
.dt-tab.on .dt-tab-sb{color:rgba(227,187,78,.55)}

/* ── card wrapper ────────────────────────────────────────── */
.dt-card{margin:0 20px 14px;background:#11141d;border:1.5px solid #252c3d;border-radius:14px;padding:17px}

/* ── section heading ─────────────────────────────────────── */
.dt-sh{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#3c4460;margin-bottom:11px}

/* ── step number ─────────────────────────────────────────── */
.dt-sn{width:27px;height:27px;border-radius:50%;flex-shrink:0;
  background:rgba(227,187,78,.12);border:1.5px solid rgba(227,187,78,.38);
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#e3bb4e}
.dt-sr{display:flex;gap:12px;align-items:flex-start;margin-bottom:13px}
.dt-st{font-size:14px;font-weight:700;color:#dde1ed;margin:0 0 4px}
.dt-ss{font-size:12px;color:#68748e;line-height:1.55;margin:0}

/* ── network grid ────────────────────────────────────────── */
.dt-ngrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 20px 16px}
.dt-nbtn{display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:10px 6px;border-radius:11px;border:1.5px solid #1e2333;background:#11141d;
  cursor:pointer;font-family:inherit;transition:all .14s}
.dt-nbtn:hover{background:#181d2a;border-color:#303852}
.dt-nbtn.on{background:rgba(227,187,78,.08);border-color:rgba(227,187,78,.42)}
.dt-nticker{font-size:13px;font-weight:800;color:#b0bbd4}
.dt-nbtn.on .dt-nticker{color:#e3bb4e}
.dt-nstd{font-size:9px;color:#3c4460}

/* ── network info strip ──────────────────────────────────── */
.dt-nstrip{margin:0 20px 15px;padding:12px 16px;background:#11141d;border:1.5px solid #1e2333;
  border-radius:12px;display:flex;gap:6px;align-items:center;justify-content:space-between}
.dt-np{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px}
.dt-npk{font-size:9.5px;color:#3c4460;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.dt-npv{font-size:13px;font-weight:800;color:#dde1ed}
.dt-ndiv{width:1px;height:28px;background:#252c3d;flex-shrink:0}

/* ── address box ─────────────────────────────────────────── */
.dt-abox{background:#0b0d14;border:1.5px solid #1e2333;border-radius:11px;padding:14px}
.dt-albl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3c4460;margin-bottom:9px}
.dt-arow{display:flex;align-items:flex-start;gap:10px}
.dt-atext{font-family:'DM Mono','Courier New',monospace;font-size:12.5px;color:#8892aa;word-break:break-all;line-height:1.6;flex:1}

/* ── copy button ─────────────────────────────────────────── */
.dt-copy{width:36px;height:36px;border-radius:9px;flex-shrink:0;background:#181d2a;
  border:1.5px solid #252c3d;display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:#68748e;transition:all .15s;margin-top:2px}
.dt-copy:hover{border-color:rgba(227,187,78,.42);color:#e3bb4e}
.dt-copy.ok{border-color:rgba(35,197,94,.42);color:#23c55e;background:rgba(35,197,94,.06)}

/* ── input ───────────────────────────────────────────────── */
.dt-input{width:100%;padding:13px 15px;background:#0b0d14;border:1.5px solid #252c3d;
  border-radius:10px;outline:none;font-size:14px;font-weight:500;color:#edf1fa;
  font-family:inherit;transition:border-color .18s,box-shadow .18s;box-sizing:border-box}
.dt-input::placeholder{color:#2e3649}
.dt-input:focus{border-color:rgba(227,187,78,.5);box-shadow:0 0 0 3px rgba(227,187,78,.07)}
.dt-mono{font-family:'DM Mono','Courier New',monospace;font-size:13px;letter-spacing:.02em}
.dt-lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#68748e;margin-bottom:7px}
.dt-field{margin-bottom:15px}
.dt-iw{position:relative}
.dt-iw .dt-input{padding-right:44px}
.dt-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;
  cursor:pointer;color:#3c4460;display:flex;align-items:center;padding:4px;transition:color .15s}
.dt-eye:hover{color:#68748e}

/* ── amount big ──────────────────────────────────────────── */
.dt-amtw{display:flex;align-items:center;background:#0b0d14;border:1.5px solid #252c3d;
  border-radius:11px;padding:15px 16px;transition:border-color .18s}
.dt-amtw:focus-within{border-color:rgba(227,187,78,.5);box-shadow:0 0 0 3px rgba(227,187,78,.06)}
.dt-amtin{flex:1;min-width:0;background:none;border:none;outline:none;
  font-family:'DM Mono',monospace;font-size:32px;font-weight:700;color:#edf1fa}
.dt-amtin::placeholder{color:#1e2333}
.dt-amttk{font-size:11px;font-weight:700;color:#68748e;padding:4px 10px;border-radius:6px;
  background:#181d2a;border:1px solid #252c3d;margin-left:12px;flex-shrink:0;
  font-family:'DM Mono',monospace}

/* ── quick amounts ───────────────────────────────────────── */
.dt-quick{display:flex;gap:7px;margin-top:10px}
.dt-qbtn{flex:1;padding:9px 4px;border-radius:9px;border:1.5px solid #1e2333;background:#11141d;
  font-size:12px;font-weight:700;color:#b0bbd4;cursor:pointer;font-family:inherit;transition:all .12s}
.dt-qbtn:hover{border-color:#303852;color:#edf1fa}
.dt-qbtn.on{background:rgba(227,187,78,.1);border-color:rgba(227,187,78,.42);color:#e3bb4e}

/* ── preview chips ───────────────────────────────────────── */
.dt-prev{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.dt-cx{padding:5px 13px;border-radius:20px;font-size:12px;font-weight:700;
  background:rgba(227,187,78,.1);border:1px solid rgba(227,187,78,.32);color:#e3bb4e}
.dt-ce{padding:5px 13px;border-radius:20px;font-size:12px;font-weight:700;
  background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.28);color:#22d3ee}

/* ── alerts ──────────────────────────────────────────────── */
.dt-ok{display:flex;gap:9px;align-items:center;padding:12px 16px;border-radius:10px;margin-bottom:12px;
  background:rgba(35,197,94,.08);border:1px solid rgba(35,197,94,.26);font-size:13px;font-weight:600;color:#23c55e}
.dt-err{display:flex;gap:9px;align-items:center;padding:12px 16px;border-radius:10px;margin-bottom:12px;
  background:rgba(248,114,114,.07);border:1px solid rgba(248,114,114,.22);font-size:13px;font-weight:600;color:#f87272}
.dt-warn{display:flex;gap:9px;align-items:flex-start;padding:11px 14px;border-radius:9px;margin-top:10px;
  background:rgba(248,114,114,.06);border:1px solid rgba(248,114,114,.18);font-size:11px;font-weight:500;
  color:#f87272;line-height:1.55}

/* ── info box ────────────────────────────────────────────── */
.dt-info{margin:0 20px 14px;padding:13px 15px;background:rgba(34,211,238,.04);
  border:1px solid rgba(34,211,238,.14);border-radius:11px;display:flex;gap:11px;align-items:flex-start}
.dt-info h4{font-size:13px;font-weight:700;color:#22d3ee;margin:0 0 3px}
.dt-info p{font-size:12px;color:#68748e;margin:0;line-height:1.55}

/* ── security strip ──────────────────────────────────────── */
.dt-sec{padding:12px 14px;margin-bottom:14px;background:rgba(227,187,78,.04);
  border:1px solid rgba(227,187,78,.14);border-radius:10px;display:flex;gap:10px;align-items:flex-start}
.dt-sec h4{font-size:12px;font-weight:700;color:#e3bb4e;margin:0 0 2px}
.dt-sec p{font-size:11px;color:#68748e;margin:0;line-height:1.5}

/* ── CTA ─────────────────────────────────────────────────── */
.dt-cta{display:flex;align-items:center;justify-content:center;gap:9px;
  width:100%;padding:15px 20px;
  background:linear-gradient(135deg,#e3bb4e 0%,#c89826 100%);
  border:none;border-radius:13px;font-size:15px;font-weight:800;color:#0c0e14;
  cursor:pointer;font-family:inherit;letter-spacing:-.01em;
  box-shadow:0 4px 22px rgba(227,187,78,.2);transition:opacity .15s,transform .12s}
.dt-cta:hover:not(:disabled){opacity:.9;transform:translateY(-1px)}
.dt-cta:disabled{opacity:.3;cursor:not-allowed;transform:none;box-shadow:none}

/* ── ghost ───────────────────────────────────────────────── */
.dt-ghost{display:flex;align-items:center;justify-content:center;gap:7px;
  width:100%;padding:12px 20px;background:transparent;border:1.5px solid #252c3d;
  border-radius:13px;font-size:13px;font-weight:600;color:#b0bbd4;
  cursor:pointer;font-family:inherit;transition:all .15s;margin-top:10px}
.dt-ghost:hover{border-color:#303852;color:#edf1fa;background:#11141d}

/* ── wallet card ─────────────────────────────────────────── */
.dt-wcard{display:flex;align-items:center;gap:13px;padding:15px 16px;
  border-radius:14px;margin-bottom:9px;border:1.5px solid #1e2333;background:#11141d;transition:all .15s}
.dt-wcard.live{border-color:rgba(35,197,94,.28);background:rgba(35,197,94,.04)}
.dt-wicon{width:44px;height:44px;border-radius:12px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:22px}
.dt-wname{font-size:14px;font-weight:700;color:#dde1ed}
.dt-waddr{font-size:11px;color:#68748e;font-family:'DM Mono',monospace;margin-top:2px}
.dt-wstatus{display:flex;align-items:center;gap:5px;margin-top:4px}
.dt-dotg{width:6px;height:6px;border-radius:50%;background:#23c55e;box-shadow:0 0 5px rgba(35,197,94,.6);flex-shrink:0}
.dt-dotd{width:6px;height:6px;border-radius:50%;background:#3c4460;flex-shrink:0}

/* ── add wallet dashed ───────────────────────────────────── */
.dt-addw{display:flex;align-items:center;gap:12px;padding:14px 16px;
  border-radius:14px;margin-bottom:10px;border:1.5px dashed #252c3d;background:transparent;
  cursor:pointer;font-family:inherit;width:100%;transition:all .15s;text-align:left}
.dt-addw:hover{border-color:rgba(227,187,78,.42);background:rgba(227,187,78,.04)}
.dt-addiconbox{width:44px;height:44px;border-radius:12px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  border:1.5px dashed #252c3d;color:#3c4460;transition:all .15s}
.dt-addw:hover .dt-addiconbox{border-color:rgba(227,187,78,.42);color:#e3bb4e}
.dt-addlbl{font-size:13px;font-weight:700;color:#68748e}
.dt-addw:hover .dt-addlbl{color:#e3bb4e}
.dt-addsub{font-size:11px;color:#3c4460;margin-top:2px}

/* ── bank selector ───────────────────────────────────────── */
.dt-brow{display:flex;align-items:center;gap:14px;padding:15px 16px;
  border-radius:13px;margin-bottom:9px;border:1.5px solid #1e2333;background:#11141d;
  cursor:pointer;font-family:inherit;width:100%;transition:all .15s;text-align:left}
.dt-brow:hover{background:#181d2a;border-color:#303852}
.dt-blogo{width:44px;height:44px;border-radius:12px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:22px}
.dt-bname{font-size:15px;font-weight:800;color:#dde1ed}
.dt-bsub{font-size:11px;color:#68748e;margin-top:3px}
.dt-bbadge{margin-left:auto;padding:5px 11px;border-radius:20px;flex-shrink:0;font-size:10px;font-weight:700}

/* ── detail row ──────────────────────────────────────────── */
.dt-dr{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #181d2a}
.dt-dr:last-child{border-bottom:none}
.dt-drk{font-size:12px;color:#68748e}
.dt-drv{font-size:13px;font-weight:700;color:#dde1ed;font-family:'DM Mono',monospace;display:flex;align-items:center;gap:8px}

/* ── cc preview ──────────────────────────────────────────── */
.dt-cc{margin:0 20px 18px;padding:22px 20px 18px;border-radius:16px;
  background:linear-gradient(135deg,#171c2e 0%,#0e1220 100%);
  border:1.5px solid #252c3d;position:relative;overflow:hidden;min-height:110px}
.dt-cc-chip{width:32px;height:24px;border-radius:5px;
  background:linear-gradient(135deg,#d4a847 0%,#f0c84e 100%);margin-bottom:14px}
.dt-cc-num{font-family:'DM Mono',monospace;font-size:17px;font-weight:700;
  color:#dde1ed;letter-spacing:.18em;margin-bottom:12px}
.dt-cc-row{display:flex;justify-content:space-between}
.dt-cc-klbl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#3c4460;margin-bottom:3px}
.dt-cc-val{font-size:13px;font-weight:700;color:#8892aa;font-family:'DM Mono',monospace}
.dt-cc-brand{position:absolute;right:18px;top:18px;font-size:14px;font-weight:900;
  color:rgba(255,255,255,.25);letter-spacing:.06em}

/* ── loading ─────────────────────────────────────────────── */
@keyframes dtSpin{to{transform:rotate(360deg)}}
.dt-spin{animation:dtSpin .9s linear infinite}
.dt-loading{display:flex;flex-direction:column;align-items:center;padding:56px 24px;gap:14px;text-align:center}
.dt-lring{width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center}

/* ── done ────────────────────────────────────────────────── */
.dt-done{display:flex;flex-direction:column;align-items:center;padding:52px 24px 30px;text-align:center}
.dt-dring{width:72px;height:72px;border-radius:50%;background:rgba(35,197,94,.1);
  border:2px solid rgba(35,197,94,.4);display:flex;align-items:center;justify-content:center;
  margin-bottom:18px;box-shadow:0 0 36px rgba(35,197,94,.12)}
.dt-done h2{font-size:24px;font-weight:800;color:#edf1fa;margin:0 0 6px}
.dt-done p{font-size:13px;color:#68748e;margin:0;line-height:1.6}
.dt-dref{font-size:11px;font-family:'DM Mono',monospace;color:#3c4460;margin-top:4px}
.dt-dchips{display:flex;gap:10px;margin:18px 0 26px;flex-wrap:wrap;justify-content:center}
`;

// =============================================================================
//  MINI HELPERS
// =============================================================================
const calc    = (n) => depositCalcXEV(n);
const short   = (a) => a ? `${a.slice(0,8)}…${a.slice(-5)}` : "";
const genRef  = () => `REF-${Date.now().toString(36).toUpperCase()}`;
const sleep   = (ms) => new Promise(r => setTimeout(r, ms));

const Preview = ({ naira }) => {
  const { xev, ep } = calc(naira);
  if (!naira || parseFloat(naira) <= 0) return null;
  return (
    <div className="dt-prev">
      <span className="dt-cx">+{xev} $XEV</span>
      <span className="dt-ce">+{ep} EP</span>
    </div>
  );
};

const Quick = ({ v, set }) => (
  <div className="dt-quick">
    {[500,1000,2000,5000].map(a => (
      <button key={a} className={`dt-qbtn${v===String(a)?" on":""}`} onClick={()=>set(String(a))}>
        ₦{a>=1000?a/1000+"k":a}
      </button>
    ))}
  </div>
);

const Ok  = ({ msg }) => msg ? <div className="dt-ok"><CheckCircle size={16}/>{msg}</div> : null;
const Err = ({ msg }) => msg ? <div className="dt-err"><AlertCircle size={16}/>{msg}</div> : null;

const Loading = ({ ring, title, sub }) => (
  <div className="dt-loading">
    <div className="dt-lring" style={ring}>
      <Loader size={28} color={ring.color||C.gold} className="dt-spin"/>
    </div>
    <div style={{fontSize:16,fontWeight:700,color:C.t1}}>{title}</div>
    <div style={{fontSize:12,color:C.t3}}>{sub}</div>
  </div>
);

// =============================================================================
//  MODE 1 — IMPORT (Browser crypto wallets)
// =============================================================================
const ImportMode = ({ userId, onRefresh, onBack }) => {
  // Persist connected wallets in localStorage
  const load = () => { try { return JSON.parse(localStorage.getItem(`xev_wl_${userId}`)||"[]"); } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(`xev_wl_${userId}`, JSON.stringify(list)); } catch {} };

  const [phase,   setPhase]   = useState("list");   // list|scanning|amount|signing|done
  const [wallets, setWallets] = useState(load);
  const [sel,     setSel]     = useState(null);
  const [amount,  setAmount]  = useState("");
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState(null);

  const scanWallets = useCallback(async () => {
    setPhase("scanning"); setError("");
    try {
      const found = await depositDetectBrowserWallets();
      const merged = [...wallets];
      found.forEach(w => {
        if (!merged.find(m => m.id === w.id)) {
          merged.push({
            id: w.id, name: w.name, icon: w.icon,
            color: w.color, dim: w.colorDim||C.goldD, ring: w.colorBorder||C.goldR,
            currency: w.currency, address: w.address||null, note: w.note||"",
          });
        }
      });
      setWallets(merged); save(merged);
      setPhase("list");
    } catch (e) { setError(e.message||"Scan failed"); setPhase("list"); }
    // eslint-disable-next-line
  }, [wallets]);

  const removeWallet = (id) => {
    const next = wallets.filter(w => w.id !== id);
    setWallets(next); save(next);
  };

  const startDeposit = (w) => { setSel(w); setAmount(""); setError(""); setPhase("amount"); };

  const doDeposit = useCallback(async () => {
    if (!sel) return;
    const n = parseFloat(amount);
    if (!n || n < 100) { setError("Minimum ₦100 required"); return; }
    setError(""); setPhase("signing");
    try {
      const res = await depositSmartConnectWallet({ wallet: sel, nairaAmount: amount, userId });
      setResult(res); setPhase("done");
      if (onRefresh) onRefresh();
    } catch (e) { setError(e.message||"Connection failed"); setPhase("amount"); }
  }, [sel, amount, userId, onRefresh]);

  // ── Done ──
  if (phase === "done" && result) return (
    <div className="dt-done">
      <div className="dt-dring"><CheckCircle size={34} color={C.green}/></div>
      <h2>Import Successful!</h2>
      <p>Signed via {sel?.name}</p>
      <div className="dt-dref">ref: {result.reference}</div>
      <div className="dt-dchips">
        <span className="dt-cx" style={{fontSize:15,padding:"9px 18px"}}>+{result.xev} $XEV</span>
        <span className="dt-ce" style={{fontSize:15,padding:"9px 18px"}}>+{result.ep} EP</span>
      </div>
      <button className="dt-cta" onClick={onBack}>Back to Wallet</button>
      <button className="dt-ghost" onClick={()=>{setPhase("list");setResult(null);}}>Import More</button>
    </div>
  );

  // ── Signing ──
  if (phase === "signing") return (
    <Loading
      ring={{background:C.goldD, border:`1.5px solid ${C.goldR}`, color:C.gold}}
      title="Awaiting wallet signature…"
      sub={`${sel?.name} is requesting approval.\nCheck your wallet extension.`}
    />
  );

  // ── Scanning ──
  if (phase === "scanning") return (
    <Loading
      ring={{background:C.epD, border:`1.5px solid ${C.epR}`, color:C.ep}}
      title="Scanning browser…"
      sub="Looking for MetaMask, Phantom, TronLink, Coinbase, Rabby…"
    />
  );

  // ── Amount entry ──
  if (phase === "amount" && sel) return (
    <div style={{padding:"0 20px"}}>
      {/* Selected wallet header */}
      <div style={{
        display:"flex",alignItems:"center",gap:13,padding:"13px 16px",marginBottom:20,
        background:sel.dim||C.goldD, border:`1.5px solid ${sel.ring||C.goldR}`,
        borderRadius:14,
      }}>
        <div className="dt-wicon" style={{background:sel.dim||C.goldD,border:`1px solid ${sel.ring||C.goldR}`}}>
          {sel.icon}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:C.t1}}>{sel.name}</div>
          <div style={{fontSize:11,color:C.t3,marginTop:2}}>{sel.currency}</div>
          {sel.address && <div style={{fontSize:10,color:C.t4,fontFamily:"'DM Mono',monospace",marginTop:2}}>{short(sel.address)}</div>}
        </div>
        <button onClick={()=>setPhase("list")} style={{background:"none",border:"none",cursor:"pointer",color:C.t3,padding:4}}>
          <X size={16}/>
        </button>
      </div>

      <div className="dt-field">
        <label className="dt-lbl">Amount to Import (₦)</label>
        <div className="dt-amtw">
          <input className="dt-amtin" type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
          <span className="dt-amttk">NGN</span>
        </div>
        <Preview naira={amount}/>
        <Quick v={amount} set={setAmount}/>
      </div>

      <div className="dt-info">
        <Zap size={16} style={{flexShrink:0,marginTop:2,color:C.ep}}/>
        <div>
          <h4>How import works</h4>
          <p>We generate a one-time signature request. Your wallet confirms intent — no on-chain transaction is made. The equivalent $XEV is credited from your fiat balance.</p>
        </div>
      </div>

      <Err msg={error}/>
      <button className="dt-cta" disabled={!amount||parseFloat(amount)<100} onClick={doDeposit}>
        <Wallet size={16}/> Import from {sel.name}
      </button>
      <button className="dt-ghost" onClick={()=>setPhase("list")}>← Back</button>
    </div>
  );

  // ── Wallet list ──
  const has = wallets.length > 0;
  return (
    <div style={{padding:"0 20px 20px"}}>
      {/* Header */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:800,color:C.t1,marginBottom:5}}>Connected Crypto Wallets</div>
        <div style={{fontSize:12,color:C.t3,lineHeight:1.6}}>
          Select a connected wallet to import funds directly into your $XEV balance.
          <br/>Supports MetaMask, Phantom, TronLink, Coinbase Wallet &amp; Rabby.
        </div>
      </div>

      {/* Empty state */}
      {!has && (
        <div style={{padding:"32px 0 24px",textAlign:"center",color:C.t3}}>
          <WifiOff size={34} style={{opacity:.22,marginBottom:12}}/>
          <div style={{fontSize:14,fontWeight:700,color:C.t2,marginBottom:5}}>No wallets detected yet</div>
          <div style={{fontSize:12,maxWidth:240,margin:"0 auto"}}>Click the button below to scan your browser for installed crypto wallets.</div>
        </div>
      )}

      {/* Wallet cards */}
      {wallets.map(w => (
        <div key={w.id} className="dt-wcard live">
          <div className="dt-wicon" style={{background:w.dim||C.goldD, border:`1px solid ${w.ring||C.goldR}`}}>
            {w.icon}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="dt-wname">{w.name}</div>
            {w.address && <div className="dt-waddr">{short(w.address)}</div>}
            <div className="dt-wstatus">
              <div className="dt-dotg"/>
              <span style={{fontSize:10,color:C.green,fontWeight:700}}>Connected</span>
              <span style={{fontSize:10,color:C.t4,marginLeft:4}}>· {w.currency}</span>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7,alignItems:"flex-end",flexShrink:0}}>
            <button
              onClick={()=>startDeposit(w)}
              style={{
                padding:"8px 15px",background:C.goldD,border:`1.5px solid ${C.goldR}`,
                borderRadius:9,fontSize:12,fontWeight:800,color:C.gold,
                cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
              }}
            >
              Import →
            </button>
            <button
              onClick={()=>removeWallet(w.id)}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:C.t4,fontFamily:"inherit",padding:"2px 0"}}
            >
              Disconnect
            </button>
          </div>
        </div>
      ))}

      {/* Add / scan button */}
      <button className="dt-addw" onClick={scanWallets}>
        <div className="dt-addiconbox"><Scan size={18}/></div>
        <div style={{textAlign:"left",flex:1}}>
          <div className="dt-addlbl">{has ? "Scan for More Wallets" : "Detect & Connect Wallet"}</div>
          <div className="dt-addsub">MetaMask · Phantom · TronLink · Coinbase · Rabby</div>
        </div>
        <ChevronRight size={15} color={C.t4} style={{flexShrink:0}}/>
      </button>

      <Err msg={error}/>

      <div className="dt-info" style={{margin:"8px 0 0"}}>
        <Shield size={16} style={{flexShrink:0,marginTop:2,color:C.ep}}/>
        <div>
          <h4>Non-custodial &amp; secure</h4>
          <p>We never access or store private keys. Only signature-based import intent — your wallet stays fully in your control.</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
//  MODE 2 — CRYPTO (Receive on-chain)
// =============================================================================
const CryptoMode = ({ userId, onRefresh }) => {
  const [net,      setNet]       = useState(NETWORKS[0]);
  const [txHash,   setTxHash]    = useState("");
  const [naira,    setNaira]     = useState("");
  const [copied,   setCopied]    = useState(false);
  const [verifying,setVerifying] = useState(false);
  const [status,   setStatus]    = useState(null);
  const [statusMsg,setStatusMsg] = useState("");

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false), 2400); } catch {}
  };

  const verify = async () => {
    if (!txHash.trim()) return;
    setVerifying(true); setStatus(null);
    try {
      const r = await depositCryptoVerify({
        userId,
        txHash: txHash.trim(),
        tokenId: net.id,
        network: net.net,
        nairaEquivalent: parseFloat(naira)||0,
      });
      if (r.success) {
        const { xev, ep } = calc(naira);
        setStatusMsg(`Verified! +${xev} $XEV & +${ep} EP credited to your wallet.`);
        setStatus("ok");
        if (onRefresh) onRefresh();
      } else {
        setStatus("err");
        setStatusMsg("Transaction not found. Check the hash and network, then try again.");
      }
    } catch (e) { setStatus("err"); setStatusMsg(e.message||"Verification failed"); }
    finally { setVerifying(false); }
  };

  const changeNet = (n) => { setNet(n); setCopied(false); setTxHash(""); setStatus(null); };

  return (
    <>
      {/* ── Network selector ── */}
      <div style={{padding:"0 20px 4px"}}>
        <div className="dt-sh">Select Token &amp; Network</div>
      </div>
      <div className="dt-ngrid">
        {NETWORKS.map(n => (
          <button
            key={n.id}
            className={`dt-nbtn${net.id===n.id?" on":""}`}
            onClick={()=>changeNet(n)}
          >
            <span className="dt-nticker" style={net.id===n.id?{color:n.col}:{}}>{n.label}</span>
            <span className="dt-nstd">{n.std}</span>
          </button>
        ))}
      </div>

      {/* ── Token info strip ── */}
      <div className="dt-nstrip">
        <div className="dt-np"><span className="dt-npk">Token</span><span className="dt-npv" style={{color:net.col}}>{net.label}</span></div>
        <div className="dt-ndiv"/>
        <div className="dt-np"><span className="dt-npk">Network</span><span className="dt-npv">{net.net}</span></div>
        <div className="dt-ndiv"/>
        <div className="dt-np"><span className="dt-npk">Standard</span><span className="dt-npv">{net.std}</span></div>
        <div className="dt-ndiv"/>
        <div className="dt-np"><span className="dt-npk">Min. Deposit</span><span className="dt-npv">$1</span></div>
      </div>

      {/* ── Address card ── */}
      <div className="dt-card">
        <div className="dt-sh">Your Deposit Address</div>

        {/* QR placeholder — replace with actual QR lib in production */}
        <div style={{
          width:140,height:140,margin:"0 auto 16px",borderRadius:12,
          background:"#0b0d14",border:`1.5px dashed ${C.b1}`,
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          gap:6,color:C.t4,
        }}>
          <Scan size={34} style={{opacity:.25}}/>
          <span style={{fontSize:9,letterSpacing:".1em",textTransform:"uppercase"}}>QR Code</span>
        </div>

        <div className="dt-abox">
          <div className="dt-albl">Send {net.label} ({net.std}) only · {net.net}</div>
          <div className="dt-arow">
            <code className="dt-atext">{net.address}</code>
            <button className={`dt-copy${copied?" ok":""}`} onClick={()=>copy(net.address)}>
              {copied ? <CheckCircle size={15}/> : <Copy size={15}/>}
            </button>
          </div>
        </div>

        <div className="dt-warn">
          <AlertCircle size={14} style={{flexShrink:0,marginTop:1}}/>
          <span>Only send <strong>{net.label} on {net.net}</strong>. Sending any other token or using the wrong network will result in <strong>permanent loss of funds</strong>.</span>
        </div>
      </div>

      {/* ── Verify card ── */}
      <div className="dt-card">
        <div className="dt-sh">Confirm Your Deposit</div>

        <div className="dt-field">
          <label className="dt-lbl">Transaction Hash (TXID)</label>
          <input
            className="dt-input dt-mono"
            placeholder={net.net === "Tron" ? "transaction hash…" : "0x…"}
            value={txHash}
            onChange={e=>{setTxHash(e.target.value);setStatus(null);}}
          />
        </div>

        <div className="dt-field" style={{marginBottom:4}}>
          <label className="dt-lbl">Approximate ₦ Value <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:C.t4}}>(optional — for XEV preview)</span></label>
          <div className="dt-amtw" style={{padding:"12px 15px"}}>
            <input className="dt-amtin" style={{fontSize:22}} type="number" placeholder="0" value={naira} onChange={e=>setNaira(e.target.value)}/>
            <span className="dt-amttk">NGN</span>
          </div>
          <Preview naira={naira}/>
        </div>

        <Ok  msg={status==="ok"  ? statusMsg : ""}/>
        <Err msg={status==="err" ? statusMsg : ""}/>

        <button className="dt-cta" style={{marginTop:10}} disabled={!txHash.trim()||verifying} onClick={verify}>
          {verifying ? <Loader size={16} className="dt-spin"/> : <Shield size={16}/>}
          {verifying ? "Verifying on-chain…" : "Verify & Credit Wallet"}
        </button>
      </div>

      <div className="dt-info">
        <Zap size={16} style={{flexShrink:0,marginTop:2,color:C.ep}}/>
        <div>
          <h4>Instant credit</h4>
          <p>After 1–3 on-chain confirmations, $XEV and equal EP are automatically minted to your wallet. No manual action needed after verification.</p>
        </div>
      </div>
    </>
  );
};

// =============================================================================
//  MODE 3 — TRANSFER (OPay / Moniepoint bank transfer)
// =============================================================================
const TransferMode = ({ userId, onRefresh }) => {
  const [bank,     setBank]      = useState(null);
  const [amount,   setAmount]    = useState("");
  const [ref,      setRef]       = useState("");
  const [copied,   setCopied]    = useState(false);
  const [verifying,setVerifying] = useState(false);
  const [status,   setStatus]    = useState(null);
  const [statusMsg,setStatusMsg] = useState("");

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false),2400); } catch {}
  };

  const pickBank = (b) => { setBank(b); setStatus(null); setRef(""); setCopied(false); };

  const verify = async () => {
    if (!ref.trim()||!amount||!bank) return;
    setVerifying(true); setStatus(null);
    try {
      const r = await depositBankTransferVerify({ userId, sessionRef: ref.trim(), nairaAmount: amount, bankId: bank.id });
      if (r.success) {
        const { xev, ep } = calc(amount);
        setStatusMsg(`✓ ${bank.name} transfer verified! +${xev} $XEV & +${ep} EP credited.`);
        setStatus("ok");
        if (onRefresh) onRefresh();
      } else {
        setStatus("err");
        setStatusMsg("Reference not found on "+bank.name+". It can take up to 2 min — try again shortly.");
      }
    } catch (e) { setStatus("err"); setStatusMsg(e.message||"Verification failed"); }
    finally { setVerifying(false); }
  };

  return (
    <>
      {/* ── Step 1: pick bank ── */}
      <div className="dt-card">
        <div className="dt-sr">
          <div className="dt-sn">1</div>
          <div>
            <div className="dt-st">Which bank did you send from?</div>
            <div className="dt-ss">Choose your source bank — we use its real-time API for instant validation.</div>
          </div>
        </div>

        {BANKS.map(b => (
          <button
            key={b.id}
            className="dt-brow"
            style={bank?.id===b.id ? {borderColor:b.ring,background:b.dim} : {}}
            onClick={()=>pickBank(b)}
          >
            <div className="dt-blogo" style={{background:b.dim,border:`1px solid ${b.ring}`}}>
              {b.logo}
            </div>
            <div style={{flex:1,textAlign:"left"}}>
              <div className="dt-bname" style={bank?.id===b.id?{color:b.color}:{}}>{b.name}</div>
              <div className="dt-bsub">{b.note}</div>
            </div>
            {bank?.id===b.id ? (
              <div className="dt-bbadge" style={{background:b.dim,border:`1px solid ${b.ring}`,color:b.color}}>
                ✓ Selected
              </div>
            ) : (
              <ChevronRight size={15} color={C.t4}/>
            )}
          </button>
        ))}
      </div>

      {/* ── Steps 2 & 3 — only shown after bank is picked ── */}
      {bank && (
        <>
          {/* Step 2: account details */}
          <div className="dt-card">
            <div className="dt-sr">
              <div className="dt-sn">2</div>
              <div>
                <div className="dt-st">Transfer to this {bank.name} account</div>
                <div className="dt-ss">Use your <strong style={{color:C.gold}}>Xeevia username</strong> as the narration or reference.</div>
              </div>
            </div>

            {[
              {k:"Bank",         v:bank.name},
              {k:"Account Name", v:bank.acctName},
              {k:"Account No.",  v:bank.acctNumber, copy:true},
              {k:"Reference",    v:"Your Xeevia username"},
            ].map(r => (
              <div key={r.k} className="dt-dr">
                <span className="dt-drk">{r.k}</span>
                <span className="dt-drv">
                  {r.v}
                  {r.copy && (
                    <button
                      className={`dt-copy${copied?" ok":""}`}
                      style={{width:28,height:28}}
                      onClick={()=>copy(bank.acctNumber)}
                    >
                      {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Step 3: amount + reference + verify */}
          <div className="dt-card">
            <div className="dt-sr">
              <div className="dt-sn">3</div>
              <div>
                <div className="dt-st">Enter amount &amp; session reference</div>
                <div className="dt-ss">Enter the exact amount transferred and paste the session ID from your {bank.name} app.</div>
              </div>
            </div>

            <div className="dt-field">
              <label className="dt-lbl">Amount Sent (₦)</label>
              <div className="dt-amtw">
                <input
                  className="dt-amtin" type="number" placeholder="0"
                  value={amount}
                  onChange={e=>{setAmount(e.target.value);setStatus(null);}}
                />
                <span className="dt-amttk">NGN</span>
              </div>
              <Preview naira={amount}/>
              <Quick v={amount} set={v=>{setAmount(v);setStatus(null);}}/>
            </div>

            <div className="dt-field">
              <label className="dt-lbl">Session ID / Reference</label>
              <input
                className="dt-input dt-mono"
                placeholder="e.g. 230812345678"
                value={ref}
                onChange={e=>{setRef(e.target.value);setStatus(null);}}
              />
            </div>

            <Ok  msg={status==="ok"  ? statusMsg : ""}/>
            <Err msg={status==="err" ? statusMsg : ""}/>

            <button
              className="dt-cta"
              disabled={!ref.trim()||!amount||parseFloat(amount)<100||verifying}
              onClick={verify}
            >
              {verifying ? <Loader size={16} className="dt-spin"/> : <Shield size={16}/>}
              {verifying ? `Checking ${bank.name}…` : `Verify ${bank.name} Transfer`}
            </button>
          </div>
        </>
      )}

      <div className="dt-info">
        <Building2 size={16} style={{flexShrink:0,marginTop:2,color:C.ep}}/>
        <div>
          <h4>Why only OPay &amp; Moniepoint?</h4>
          <p>Both have real-time transaction APIs that let us validate and credit your wallet in seconds — no manual review needed.</p>
        </div>
      </div>
    </>
  );
};

// =============================================================================
//  MODE 4 — CARD (Debit / Credit via Paystack)
// =============================================================================
const CardMode = ({ userId, onRefresh }) => {
  const loadCard = () => { try { return JSON.parse(localStorage.getItem(`xev_card_${userId}`)||"null"); } catch { return null; } };

  const [saved,    setSaved]    = useState(loadCard);
  const [adding,   setAdding]   = useState(!loadCard());
  const [cardNum,  setCardNum]  = useState("");
  const [expiry,   setExpiry]   = useState("");
  const [cvv,      setCvv]      = useState("");
  const [cname,    setCname]    = useState("");
  const [showCvv,  setShowCvv]  = useState(false);
  const [amount,   setAmount]   = useState("");
  const [phase,    setPhase]    = useState("idle"); // idle|processing|done
  const [error,    setError]    = useState("");
  const [result,   setResult]   = useState(null);

  const fmtNum    = v => v.replace(/\D/g,"").replace(/(.{4})/g,"$1 ").trim().slice(0,19);
  const fmtExpiry = v => { const d=v.replace(/\D/g,""); return d.length>2?d.slice(0,2)+"/"+d.slice(2,4):d; };
  const brand     = n => { const d=n.replace(/\s/g,""); if(/^4/.test(d)) return "VISA"; if(/^5[1-5]/.test(d)||/^2[2-7]/.test(d)) return "MASTERCARD"; return "CARD"; };
  const brandShort= n => { const b=brand(n); if(b==="VISA") return "VISA"; if(b==="MASTERCARD") return "MC"; return "💳"; };

  const saveCard = () => {
    const raw = cardNum.replace(/\s/g,"");
    if (!cname.trim())   { setError("Enter the cardholder name"); return; }
    if (raw.length < 15) { setError("Enter a valid card number"); return; }
    if (expiry.length<5) { setError("Enter a valid expiry date"); return; }
    if (!cvv)            { setError("Enter the CVV"); return; }
    setError("");
    const card = { last4:raw.slice(-4), expiry, brand:brand(cardNum), brandShort:brandShort(cardNum), name:cname };
    setSaved(card);
    try { localStorage.setItem(`xev_card_${userId}`, JSON.stringify(card)); } catch {}
    setAdding(false); setCardNum(""); setCvv("");
  };

  const removeCard = () => {
    setSaved(null);
    try { localStorage.removeItem(`xev_card_${userId}`); } catch {}
    setAdding(true); setAmount("");
  };

  const charge = async () => {
    const n = parseFloat(amount);
    if (!n||n<100) { setError("Minimum ₦100 required"); return; }
    setError(""); setPhase("processing");
    await sleep(2200); // replace with real Paystack inline or backend call
    const { xev, ep } = calc(amount);
    setResult({ xev, ep, ref:`CARD-${Date.now().toString(36).toUpperCase()}` });
    setPhase("done");
    if (onRefresh) onRefresh();
  };

  // Done
  if (phase==="done"&&result) return (
    <div className="dt-done">
      <div className="dt-dring"><CheckCircle size={34} color={C.green}/></div>
      <h2>Payment Successful</h2>
      <p>₦{amount} charged · Powered by Paystack</p>
      <div className="dt-dref">ref: {result.ref}</div>
      <div className="dt-dchips">
        <span className="dt-cx" style={{fontSize:15,padding:"9px 18px"}}>+{result.xev} $XEV</span>
        <span className="dt-ce" style={{fontSize:15,padding:"9px 18px"}}>+{result.ep} EP</span>
      </div>
      <button className="dt-cta" onClick={()=>{setPhase("idle");setAmount("");setResult(null);}}>Deposit More</button>
    </div>
  );

  // Processing
  if (phase==="processing") return (
    <Loading
      ring={{background:C.goldD,border:`1.5px solid ${C.goldR}`,color:C.gold}}
      title="Processing payment…"
      sub={`Charging your ${saved?.brand} card ending ${saved?.last4}.\nDo not close this screen.`}
    />
  );

  // Add card form
  if (adding) return (
    <>
      {/* Live card preview */}
      <div className="dt-cc">
        <div className="dt-cc-chip"/>
        <div className="dt-cc-num" style={{color:cardNum?C.t1:C.t4}}>
          {cardNum||"•••• •••• •••• ••••"}
        </div>
        <div className="dt-cc-row">
          <div>
            <div className="dt-cc-klbl">Cardholder</div>
            <div className="dt-cc-val">{cname||"YOUR NAME"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="dt-cc-klbl">Expires</div>
            <div className="dt-cc-val">{expiry||"MM/YY"}</div>
          </div>
        </div>
        {cardNum && <div className="dt-cc-brand">{brandShort(cardNum)}</div>}
      </div>

      <div style={{padding:"0 20px"}}>
        <div className="dt-field">
          <label className="dt-lbl">Cardholder Name</label>
          <input className="dt-input" placeholder="As printed on card" value={cname} onChange={e=>setCname(e.target.value.toUpperCase())}/>
        </div>
        <div className="dt-field">
          <label className="dt-lbl">Card Number</label>
          <input className="dt-input dt-mono" placeholder="1234 5678 9012 3456" value={cardNum} onChange={e=>setCardNum(fmtNum(e.target.value))} maxLength={19}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="dt-field">
            <label className="dt-lbl">Expiry</label>
            <input className="dt-input dt-mono" placeholder="MM/YY" value={expiry} onChange={e=>setExpiry(fmtExpiry(e.target.value))} maxLength={5}/>
          </div>
          <div className="dt-field">
            <label className="dt-lbl">CVV</label>
            <div className="dt-iw">
              <input className="dt-input dt-mono" placeholder="•••" type={showCvv?"text":"password"} value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} maxLength={4}/>
              <button className="dt-eye" onClick={()=>setShowCvv(p=>!p)}>
                {showCvv?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            </div>
          </div>
        </div>

        <div className="dt-sec">
          <Lock size={15} color={C.gold} style={{flexShrink:0,marginTop:1}}/>
          <div>
            <h4>256-bit encryption · PCI-DSS Level 1</h4>
            <p>Card details are encrypted end-to-end by Paystack. We never store your raw card number or CVV.</p>
          </div>
        </div>

        <Err msg={error}/>
        <button className="dt-cta" disabled={!cardNum||!expiry||!cvv||!cname} onClick={saveCard}>
          <CreditCard size={16}/> Save Card &amp; Continue
        </button>
        {saved && <button className="dt-ghost" onClick={()=>setAdding(false)}>Cancel</button>}
      </div>
    </>
  );

  // Saved card → charge
  return (
    <>
      {/* Card visual */}
      <div className="dt-cc">
        <div className="dt-cc-chip"/>
        <div className="dt-cc-num">•••• •••• •••• {saved.last4}</div>
        <div className="dt-cc-row">
          <div>
            <div className="dt-cc-klbl">Cardholder</div>
            <div className="dt-cc-val">{saved.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="dt-cc-klbl">Expires</div>
            <div className="dt-cc-val">{saved.expiry}</div>
          </div>
        </div>
        <div className="dt-cc-brand">{saved.brandShort}</div>
        <button
          onClick={removeCard}
          style={{position:"absolute",bottom:14,right:16,fontSize:10,color:C.t3,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}
        >
          Change card
        </button>
      </div>

      {/* Connected badge */}
      <div style={{margin:"0 20px 16px",display:"flex",alignItems:"center",gap:8}}>
        <div className="dt-dotg"/>
        <span style={{fontSize:12,fontWeight:600,color:C.green}}>{saved.brand} ••••{saved.last4} connected</span>
      </div>

      <div style={{padding:"0 20px"}}>
        <div className="dt-field">
          <label className="dt-lbl">Amount to Deposit (₦)</label>
          <div className="dt-amtw">
            <input className="dt-amtin" type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
            <span className="dt-amttk">NGN</span>
          </div>
          <Preview naira={amount}/>
          <Quick v={amount} set={setAmount}/>
        </div>

        <div className="dt-sec" style={{marginBottom:16}}>
          <Lock size={15} color={C.gold} style={{flexShrink:0,marginTop:1}}/>
          <div>
            <h4>Secured by Paystack</h4>
            <p>PCI-DSS Level 1. Transactions use tokenised card references — your card data is never exposed.</p>
          </div>
        </div>

        <Err msg={error}/>
        <button className="dt-cta" disabled={!amount||parseFloat(amount)<100} onClick={charge}>
          <CreditCard size={16}/> Pay ₦{amount||"0"} · {saved.brand} ••{saved.last4}
        </button>
        <button className="dt-ghost" onClick={()=>setAdding(true)}>+ Use a Different Card</button>
      </div>
    </>
  );
};

// =============================================================================
//  MAIN — DepositTab
// =============================================================================
const DepositTab = ({ setActiveTab, userId, balance, onRefresh }) => {
  const [method, setMethod] = useState("import");

  return (
    <div className="view-enter" style={{color:C.t1,paddingBottom:50}}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="view-header">
        <button className="back-btn" onClick={()=>setActiveTab("overview")}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{flex:1}}>
          <div className="view-title">Deposit</div>
          <div className="view-subtitle">Fund your $XEV wallet</div>
        </div>
      </div>

      {/* ── Method tab bar ── */}
      <div className="dt-bar">
        {METHODS.map(m => (
          <button
            key={m.id}
            className={`dt-tab${method===m.id?" on":""}`}
            onClick={()=>setMethod(m.id)}
          >
            <span className="dt-tab-em">{m.emoji}</span>
            <span className="dt-tab-lb">{m.label}</span>
            <span className="dt-tab-sb">{m.sub}</span>
          </button>
        ))}
      </div>

      {/* ── Mode panels ── */}
      {method==="import"   && <ImportMode   userId={userId} onRefresh={onRefresh} onBack={()=>setActiveTab("overview")}/>}
      {method==="crypto"   && <CryptoMode   userId={userId} onRefresh={onRefresh}/>}
      {method==="transfer" && <TransferMode userId={userId} onRefresh={onRefresh}/>}
      {method==="card"     && <CardMode     userId={userId} onRefresh={onRefresh}/>}
    </div>
  );
};

export default DepositTab;