// src/components/Auth/PaywallGate.jsx — v25 PRODUCTION FINAL
// ─────────────────────────────────────────────────────────────────────────────
//  BASED ON v24 (paywall logic untouched) + v23 split-screen brand panel
//  CHANGES vs v24:
//  [1] LAYOUT — Desktop: split-screen (50% brand left / 50% paywall right)
//               Mobile: stacked with header, same as v23 mobile layout
//  [2] BRAND PANEL — Full redesign: richer SVG network graph, animated nodes,
//      feature grid, testimonial quote, member counter, tech stack badges
//  [3] MOBILE HEADER — Compact hero with gradient title, tagline
//  [4] SUCCESS SCREEN — Updated to full-screen centered (same as v24)
//  [5] All v24 paywall logic, invite system, slide architecture UNTOUCHED
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { isPaidProfile } from "../../services/auth/paymentGate";
import {
  supabase,
  fetchPaymentProducts,
  fetchInviteCodeDetails,
  verifyWeb3Payment,
  requestWalletPayment,
  requestSolanaPayment,
  requestCardanoPayment,
  detectAvailableWallet,
  detectSolanaWallet,
  detectCardanoWallet,
  connectWallet,
  connectSolanaWallet,
  connectCardanoWalletCIP30,
  saveConnectedWallet,
  activateFreeCode,
  clearIdempotencyKey,
} from "../../services/auth/paymentService";

// ── Chain registries ──────────────────────────────────────────────────────────
const EVM_CHAINS = [
  { id:"polygon",   label:"Polygon",     emoji:"💜", fee:"~$0.01", chainId:137,   color:"#8b5cf6",
    tokens:[{symbol:"USDT",address:"0xc2132d05d31c914a87c6611c10748aeb04b58e8f",decimals:6},{symbol:"USDC",address:"0x2791bca1f2de4661ed88a30c99a7a9449aa84174",decimals:6}]},
  { id:"base",      label:"Base",        emoji:"🔵", fee:"~$0.01", chainId:8453,  color:"#3b82f6",
    tokens:[{symbol:"USDC",address:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",decimals:6},{symbol:"USDT",address:"0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",decimals:6}]},
  { id:"arbitrum",  label:"Arbitrum",    emoji:"🔷", fee:"~$0.02", chainId:42161, color:"#06b6d4",
    tokens:[{symbol:"USDT",address:"0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",decimals:6},{symbol:"USDC",address:"0xaf88d065e77c8cc2239327c5edb3a432268e5831",decimals:6}]},
  { id:"optimism",  label:"Optimism",    emoji:"🔴", fee:"~$0.01", chainId:10,    color:"#ef4444",
    tokens:[{symbol:"USDT",address:"0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",decimals:6},{symbol:"USDC",address:"0x0b2c639c533813f4aa9d7837caf62653d097ff85",decimals:6}]},
  { id:"ethereum",  label:"Ethereum",    emoji:"⬡",  fee:"~$2-5",  chainId:1,     color:"#a78bfa",
    tokens:[{symbol:"USDT",address:"0xdac17f958d2ee523a2206206994597c13d831ec7",decimals:6},{symbol:"USDC",address:"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",decimals:6}]},
  { id:"bnb",       label:"BNB Chain",   emoji:"🟡", fee:"~$0.05", chainId:56,    color:"#eab308",
    tokens:[{symbol:"USDT",address:"0x55d398326f99059ff775485246999027b3197955",decimals:18},{symbol:"USDC",address:"0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",decimals:18}]},
  { id:"avalanche", label:"Avalanche C", emoji:"🔺", fee:"~$0.05", chainId:43114, color:"#e84142",
    tokens:[{symbol:"USDT",address:"0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",decimals:6},{symbol:"USDC",address:"0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",decimals:6}]},
  { id:"zksync",    label:"zkSync Era",  emoji:"⚡", fee:"~$0.01", chainId:324,   color:"#60a5fa",
    tokens:[{symbol:"USDT",address:"0x493257fd37edb34451f62edf8d2a0c418852ba4c",decimals:6},{symbol:"USDC",address:"0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4",decimals:6}]},
];

const SOL_TOKENS = [
  { symbol:"USDC", address:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals:6 },
  { symbol:"USDT", address:"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals:6 },
];

// ── Price resolver ────────────────────────────────────────────────────────────
function resolvePrice(invite, fallback = 4) {
  const fb = (typeof fallback === "number" && !isNaN(fallback)) ? fallback : 4;
  if (!invite) return fb;
  const po = invite.price_override;
  if (po != null && !isNaN(Number(po))) return Number(po);
  const meta = invite?.metadata ?? {};
  if (meta.entry_price_cents != null && !isNaN(Number(meta.entry_price_cents))) return Number(meta.entry_price_cents) / 100;
  const ep = invite.entry_price;
  if (ep != null && !isNaN(Number(ep))) return Number(ep);
  return fb;
}

const fmt = n => (typeof n === "number" && !isNaN(n)) ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)) : "—";
const mono = { fontFamily: "'JetBrains Mono', monospace" };

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&family=Syne:wght@700;800;900&display=swap');

  @keyframes xvSpin    { to { transform: rotate(360deg); } }
  @keyframes xvFadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes xvFadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes xvPop     { 0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)} }
  @keyframes xvGlow    { 0%,100%{box-shadow:0 0 10px rgba(163,230,53,.15)}50%{box-shadow:0 0 24px rgba(163,230,53,.45)} }
  @keyframes xvSlide   { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes xvModalIn { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes xvCodeIn  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes xvNodeP   { 0%,100%{opacity:.35;r:3} 50%{opacity:.9;r:5.5} }
  @keyframes xvDash    { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
  @keyframes xvFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes xvShimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes xvPulseRing { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.2);opacity:0} }

  * { box-sizing:border-box; }
  .xv { font-family:'Inter',-apple-system,sans-serif; -webkit-font-smoothing:antialiased; }
  .xv ::-webkit-scrollbar { width:3px }
  .xv ::-webkit-scrollbar-thumb { background:#252525; border-radius:2px }

  /* ── Brand panel ── */
  .xv-brand {
    width:50%;
    flex-shrink:0;
    background:#050505;
    border-right:1px solid #0f0f0f;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
    padding:52px 54px;
    position:relative;
    overflow:hidden;
  }
  .xv-brand-noise {
    position:absolute;
    inset:0;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events:none;
    z-index:0;
    opacity:.6;
  }
  .xv-brand-gradient {
    position:absolute;
    bottom:-120px;
    left:-80px;
    width:500px;
    height:500px;
    border-radius:50%;
    background:radial-gradient(circle,rgba(163,230,53,.06) 0%,transparent 65%);
    pointer-events:none;
    z-index:0;
  }
  .xv-brand-gradient-top {
    position:absolute;
    top:-100px;
    right:-60px;
    width:380px;
    height:380px;
    border-radius:50%;
    background:radial-gradient(circle,rgba(163,230,53,.04) 0%,transparent 65%);
    pointer-events:none;
    z-index:0;
  }

  /* ── Feature grid ── */
  .xv-feat-grid {
    display:grid;
    grid-template-columns:1fr 1fr 1fr;
    gap:8px;
    margin-bottom:32px;
  }
  .xv-feat-card {
    background:#0b0b0b;
    border:1px solid #161616;
    border-radius:12px;
    padding:12px 13px;
    transition:border-color .2s;
  }
  .xv-feat-card:hover { border-color:#242424; }

  /* ── Member avatars ── */
  .xv-avatar-stack {
    display:flex;
    align-items:center;
  }
  .xv-avatar {
    width:32px;
    height:32px;
    border-radius:50%;
    border:2px solid #050505;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:11px;
    font-weight:800;
    color:#040a00;
    flex-shrink:0;
    transition:transform .2s;
  }
  .xv-avatar:hover { transform:translateY(-3px); z-index:10!important; }

  /* ── Shimmer text ── */
  .xv-shimmer {
    background: linear-gradient(90deg, #a3e635 0%, #d4fc72 30%, #65a30d 50%, #d4fc72 70%, #a3e635 100%);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:xvShimmer 4s linear infinite;
  }

  /* ── Tech badge ── */
  .xv-tech-badge {
    display:inline-flex;
    align-items:center;
    gap:5px;
    font-size:9px;
    font-weight:700;
    letter-spacing:1px;
    text-transform:uppercase;
    color:#222;
    background:#0e0e0e;
    border:1px solid #191919;
    border-radius:20px;
    padding:4px 10px;
  }

  /* ── Paywall side ── */
  .xv-paywall-side {
    width:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    background:#080808;
  }
  .xv-paywall-scroll {
    width:100%;
    max-width:510px;
    padding:46px 52px;
    overflow-y:auto;
    max-height:100vh;
    animation:xvSlide .45s ease;
  }

  /* ── Mobile ── */
  .xv-mobile-header {
    padding:28px 24px 20px;
    border-bottom:1px solid #0e0e0e;
    text-align:center;
    background:#050505;
    position:relative;
    overflow:hidden;
  }
  .xv-mobile-header::after {
    content:'';
    position:absolute;
    bottom:-60px;
    left:50%;
    transform:translateX(-50%);
    width:300px;
    height:120px;
    background:radial-gradient(ellipse,rgba(163,230,53,.08) 0%,transparent 70%);
    pointer-events:none;
  }

  /* ── Buttons ── */
  .xv-btn-lime {
    width:100%; padding:16px 24px; border-radius:14px; border:none;
    background:linear-gradient(135deg,#a3e635 0%,#84cc16 55%,#65a30d 100%);
    color:#061000; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:0 4px 22px rgba(163,230,53,.35),inset 0 1px 0 rgba(255,255,255,.12);
    transition:transform .15s,box-shadow .15s,filter .15s; position:relative; overflow:hidden;
  }
  .xv-btn-lime::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.1),transparent 50%);pointer-events:none}
  .xv-btn-lime:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 32px rgba(163,230,53,.5),inset 0 1px 0 rgba(255,255,255,.14)}
  .xv-btn-lime:active:not(:disabled){transform:none}
  .xv-btn-lime:disabled{background:#1c1c1c;color:#333;cursor:not-allowed;box-shadow:none;filter:none}

  .xv-btn-sol {
    width:100%; padding:16px 24px; border-radius:14px; border:none;
    background:linear-gradient(135deg,#9945ff 0%,#7c3aed 100%);
    color:#fff; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:0 4px 22px rgba(153,69,255,.35); transition:transform .15s,box-shadow .15s;
  }
  .xv-btn-sol:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 32px rgba(153,69,255,.5)}
  .xv-btn-sol:disabled{background:#1c1c1c;color:#333;cursor:not-allowed;box-shadow:none}

  .xv-btn-ada {
    width:100%; padding:16px 24px; border-radius:14px; border:none;
    background:linear-gradient(135deg,#0033ad 0%,#0057ff 100%);
    color:#fff; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:0 4px 22px rgba(0,51,173,.35); transition:transform .15s,box-shadow .15s;
  }
  .xv-btn-ada:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,51,173,.5)}
  .xv-btn-ada:disabled{background:#1c1c1c;color:#333;cursor:not-allowed;box-shadow:none}

  .xv-btn-outline {
    width:100%; padding:12px 18px; border-radius:12px;
    border:1.5px solid rgba(163,230,53,.3); background:rgba(163,230,53,.05);
    color:#a3e635; font-weight:700; font-size:13px; cursor:pointer; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:8px; transition:all .15s;
  }
  .xv-btn-outline:hover:not(:disabled){border-color:rgba(163,230,53,.5);background:rgba(163,230,53,.09);transform:translateY(-1px)}
  .xv-btn-outline:disabled{opacity:.3;cursor:not-allowed}

  .xv-btn-danger{width:100%;padding:12px;border-radius:11px;border:1.5px solid rgba(239,68,68,.28);background:rgba(239,68,68,.05);color:#f87171;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .15s}
  .xv-btn-danger:hover{border-color:rgba(239,68,68,.45);background:rgba(239,68,68,.09)}

  .xv-seg{display:flex;background:#0e0e0e;border:1.5px solid #1e1e1e;border-radius:12px;padding:3px;gap:3px;margin-bottom:16px}
  .xv-seg-btn{flex:1;padding:9px 8px;border-radius:9px;border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .18s;background:transparent;color:#444}
  .xv-seg-btn.on{background:#181818;color:#e8e8e8;box-shadow:0 1px 4px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04);border:1px solid #2a2a2a}
  .xv-seg-btn.on.smart{color:#a3e635}
  .xv-seg-btn.on.manual{color:#94a3b8}
  .xv-seg-btn:not(.on):hover{color:#888}

  .xv-tabs{display:flex;gap:3px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:4px;margin-bottom:20px}
  .xv-tab{flex:1;padding:11px 6px;border-radius:10px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-weight:700;font-size:12px;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:5px}
  .xv-tab.on{background:rgba(163,230,53,.1);color:#d4fc72;box-shadow:inset 0 0 0 1.5px rgba(163,230,53,.28)}
  .xv-tab.off{color:#444}
  .xv-tab.off:hover{color:#777;background:rgba(255,255,255,.03)}
  .xv-tab.soon{color:#555}
  .xv-tab.soon:hover{color:#888;background:rgba(245,158,11,.04)}

  .xv-select-wrap{position:relative}
  .xv-select-wrap::after{content:'▾';position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#555;font-size:13px;pointer-events:none}
  .xv-chain-sel{width:100%;appearance:none;-webkit-appearance:none;background:#141414;border:1.5px solid #252525;border-radius:12px;color:#e8e8e8;font-family:inherit;font-size:13px;font-weight:600;padding:12px 38px 12px 14px;cursor:pointer;outline:none;transition:border-color .15s}
  .xv-chain-sel:focus{border-color:rgba(163,230,53,.4)}
  .xv-chain-sel option{background:#141414;color:#e8e8e8}

  .xv-token-row{display:flex;gap:8px}
  .xv-token-btn{flex:1;padding:10px;border-radius:10px;border:1.5px solid #222;background:#141414;color:#777;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;transition:all .15s;text-align:center}
  .xv-token-btn.on{border-color:rgba(163,230,53,.45);background:rgba(163,230,53,.08);color:#d4fc72}
  .xv-token-btn:not(.on):hover{border-color:#333;color:#aaa}

  .xv-input{width:100%;background:#141414;border:1.5px solid #232323;border-radius:11px;padding:13px 15px;color:#f0f0f0;font-family:'JetBrains Mono',monospace;font-size:12px;transition:border-color .15s,box-shadow .15s;caret-color:#a3e635;outline:none}
  .xv-input::placeholder{color:#333}
  .xv-input:focus{border-color:rgba(163,230,53,.4);box-shadow:0 0 0 3px rgba(163,230,53,.06)}
  .xv-input.ok{border-color:rgba(163,230,53,.32)}
  .xv-input.err{border-color:rgba(239,68,68,.32)}

  .xv-card{background:#141414;border:1px solid #1e1e1e;border-radius:16px;padding:20px}
  .xv-dot{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;transition:all .3s}
  .xv-dot.done{background:rgba(163,230,53,.16);border:1.5px solid #a3e635;color:#a3e635}
  .xv-dot.act{background:rgba(163,230,53,.08);border:1.5px solid rgba(163,230,53,.45);color:#a3e635;animation:xvGlow 2s ease-in-out infinite}
  .xv-dot.idle{background:#181818;border:1.5px solid #252525;color:#333}

  .xv-hero-dots{display:flex;gap:6px;justify-content:center;margin-top:14px}
  .xv-hero-dot{height:6px;border-radius:3px;transition:all .3s;cursor:pointer;background:#2a2a2a}

  .xv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);animation:xvFadeIn .2s}
  .xv-modal{background:#0d0d0d;border:1px solid rgba(245,158,11,.25);border-radius:20px;padding:36px 32px;max-width:400px;width:100%;text-align:center;animation:xvModalIn .3s cubic-bezier(.23,1,.32,1)}

  @media (max-width:768px) {
    .xv-brand { display:none!important; }
    .xv-paywall-side { width:100%!important; }
    .xv-paywall-scroll { padding:24px 20px 64px!important; max-width:100%!important; }
  }
`;

// ── Primitives ────────────────────────────────────────────────────────────────
const Spin = ({ size = 18, color = "#a3e635" }) => (
  <div style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", border: `2px solid rgba(163,230,53,.12)`, borderTopColor: color, animation: "xvSpin .6s linear infinite" }} />
);
const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "#444", marginBottom: 8 }}>{children}</div>
);
const ErrBox = ({ msg }) => {
  if (!msg) return null;
  const isSrv = /server config|contact support/i.test(msg);
  return (
    <div style={{ background: isSrv ? "rgba(245,158,11,.07)" : "rgba(239,68,68,.07)", border: `1px solid ${isSrv ? "rgba(245,158,11,.28)" : "rgba(239,68,68,.22)"}`, borderRadius: 11, padding: "11px 14px", display: "flex", alignItems: "flex-start", gap: 10, animation: "xvFadeIn .2s" }}>
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{isSrv ? "🔧" : "⚠️"}</span>
      <span style={{ fontSize: 12.5, color: isSrv ? "#fcd34d" : "#fca5a5", lineHeight: 1.65 }}>{msg}</span>
    </div>
  );
};
const InfoBox = ({ icon, children }) => (
  <div style={{ background: "rgba(163,230,53,.04)", border: "1px solid rgba(163,230,53,.1)", borderRadius: 11, padding: "10px 13px", display: "flex", gap: 9, alignItems: "flex-start" }}>
    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: 11.5, color: "#666", lineHeight: 1.65 }}>{children}</span>
  </div>
);
const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
    <div style={{ flex: 1, height: 1, background: "#181818" }} />
    {label && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2.5px", color: "#222", textTransform: "uppercase" }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: "#181818" }} />
  </div>
);
const StepRow = ({ step, active, label, sub }) => {
  const state = active > step ? "done" : active === step ? "act" : "idle";
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", opacity: state === "idle" ? .28 : 1, transition: "opacity .3s" }}>
      <div className={`xv-dot ${state}`}>{state === "done" ? "✓" : state === "act" ? <Spin size={12} color="#a3e635" /> : step}</div>
      <div style={{ paddingTop: 5 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: state === "idle" ? "#333" : "#e4e4e4" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
};
const WalletBadge = ({ wallet, accentColor = "#a3e635" }) => {
  if (!wallet) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111", border: "1px solid #1e1e1e", borderRadius: 11, padding: "10px 14px" }}>
      <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: wallet.connected ? accentColor : "#2a2a2a", boxShadow: wallet.connected ? `0 0 8px ${accentColor}90` : "none", transition: "all .3s" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#d8d8d8" }}>{wallet.label}</div>
        {wallet.address && <div style={{ fontSize: 10, color: "#333", ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}</div>}
      </div>
      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: wallet.connected ? accentColor : "#333", background: wallet.connected ? `${accentColor}15` : "#1a1a1a", border: `1px solid ${wallet.connected ? `${accentColor}30` : "#222"}`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>
        {wallet.connected ? "Connected" : "Detected"}
      </span>
    </div>
  );
};
const ModeControl = ({ isManual, onChange }) => (
  <div className="xv-seg">
    <button className={`xv-seg-btn smart ${!isManual ? "on" : ""}`} onClick={() => isManual && onChange(false)}>
      <span>✨</span> Smart Pay
      {!isManual && <span style={{ fontSize: 9, background: "rgba(163,230,53,.15)", color: "#a3e635", border: "1px solid rgba(163,230,53,.25)", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>ON</span>}
    </button>
    <button className={`xv-seg-btn manual ${isManual ? "on" : ""}`} onClick={() => !isManual && onChange(true)}>
      <span>🔧</span> Manual
      {isManual && <span style={{ fontSize: 9, background: "rgba(148,163,184,.12)", color: "#94a3b8", border: "1px solid rgba(148,163,184,.2)", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>ON</span>}
    </button>
  </div>
);
const ChainDropdown = ({ selected, onChange, chains }) => (
  <div>
    <Label>Network</Label>
    <div className="xv-select-wrap">
      <select className="xv-chain-sel" value={selected.id} onChange={e => { const c = chains.find(x => x.id === e.target.value); if (c) onChange(c); }}>
        {chains.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label} — {c.fee}</option>)}
      </select>
    </div>
    <div style={{ marginTop: 6, height: 2, borderRadius: 1, background: `linear-gradient(90deg,${selected.color}80,${selected.color})`, transition: "background .3s" }} />
  </div>
);
const TokenRow = ({ tokens, selected, onChange }) => (
  <div>
    <Label>Token</Label>
    <div className="xv-token-row">
      {tokens.map(t => (
        <button key={t.symbol} className={`xv-token-btn ${selected?.symbol === t.symbol ? "on" : ""}`} onClick={() => onChange(t)}>{t.symbol}</button>
      ))}
    </div>
  </div>
);
const CopyAddress = ({ label, address, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { if (!address) return; navigator.clipboard.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); onCopy?.(); };
  if (!address) return <div style={{ background: "#110900", border: "1px solid rgba(245,158,11,.22)", borderRadius: 11, padding: "11px 13px", fontSize: 12, color: "#fbbf24" }}>⚠️ {label} treasury wallet not configured. Contact support.</div>;
  return (
    <div onClick={copy} style={{ background: "#111", border: `1.5px solid ${copied ? "rgba(163,230,53,.38)" : "#222"}`, borderRadius: 11, padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, transition: "border-color .2s" }}>
      <span style={{ fontSize: 11, color: "#c8f56a", ...mono, wordBreak: "break-all", lineHeight: 1.5 }}>{address}</span>
      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: copied ? "#a3e635" : "#444", background: copied ? "rgba(163,230,53,.08)" : "#1a1a1a", border: `1px solid ${copied ? "rgba(163,230,53,.22)" : "#282828"}`, borderRadius: 7, padding: "5px 10px", whiteSpace: "nowrap" }}>{copied ? "✓ Copied" : "Copy"}</span>
    </div>
  );
};

// ── Paystack Coming Soon Modal ────────────────────────────────────────────────
function PaystackSoonModal({ onClose }) {
  return (
    <div className="xv-overlay" onClick={onClose}>
      <div className="xv-modal" onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "3px", color: "#b45309", textTransform: "uppercase", marginBottom: 12 }}>Coming Soon</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 12px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>Card & Bank Payment</h2>
        <p style={{ fontSize: 13, color: "#555", lineHeight: 1.8, margin: "0 0 28px" }}>
          Finalising Paystack integration — cards, bank transfers, and mobile money.<br />
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>Join our community to get access instantly.</span>
        </p>
        <a href="https://chat.whatsapp.com/IH3TJof1nRx3sRU9Inm2jr?mode=gi_t" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "16px 20px", borderRadius: 14, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 22px rgba(37,211,102,.35)", marginBottom: 12, transition: "all .15s" }}>
          💬 Join WhatsApp Group
        </a>
        <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 11, border: "1px solid #222", background: "transparent", color: "#444", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// ── Brand Panel (left side) ───────────────────────────────────────────────────
function BrandPanel({ memberCount }) {
  const AVATARS = [
    { initials: "KA", color: "#a3e635" },
    { initials: "ZM", color: "#84cc16" },
    { initials: "TF", color: "#65a30d" },
    { initials: "OB", color: "#d4fc72" },
  ];
  const FEATURES = [
    { n: "01", icon: "🔒", title: "Private & Yours", sub: "Your data, your rules" },
    { n: "02", icon: "⚡", title: "300 EP on join",  sub: "Instant reward" },
    { n: "03", icon: "♾️", title: "Lifetime access", sub: "No renewals ever" },
  ];

  return (
    <div className="xv-brand">
      <div className="xv-brand-noise" />
      <div className="xv-brand-gradient" />
      <div className="xv-brand-gradient-top" />

      {/* Animated network SVG */}
      <svg
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .18, pointerEvents: "none", zIndex: 0 }}
        viewBox="0 0 600 700"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="ng25" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a3e635" stopOpacity=".95" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </radialGradient>
          <filter id="glow25">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Edges */}
        {[
          "M110,160 L275,255","M275,255 L450,185","M275,255 L295,415",
          "M295,415 L155,475","M295,415 L465,495","M450,185 L530,305",
          "M530,305 L465,495","M155,475 L75,580","M465,495 L545,595",
          "M110,160 L75,75","M450,185 L530,95","M295,415 L370,530",
          "M275,255 L160,330","M160,330 L75,580",
        ].map((d, i) => (
          <path key={i} d={d} stroke="rgba(163,230,53,.5)" strokeWidth="1" fill="none"
            strokeDasharray="6 12"
            style={{ animation: `xvDash ${3.5 + i * .3}s linear infinite`, animationDelay: `${i * .25}s` }}
          />
        ))}
        {/* Nodes */}
        {[
          [110,160,4.5],[275,255,6.5],[450,185,4],[295,415,5.5],
          [155,475,3.5],[465,495,5],[530,305,4],[75,580,3],[545,595,3],
          [75,75,3.5],[530,95,3.5],[370,530,4],[160,330,4],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="url(#ng25)" filter="url(#glow25)"
            style={{ animation: `xvNodeP ${2.2 + i * .38}s ease-in-out infinite`, animationDelay: `${i * .21}s` }}
          />
        ))}
      </svg>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#a3e635,#65a30d)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#040a00", fontFamily: "'Syne', sans-serif" }}>X</span>
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 900, letterSpacing: "5px", color: "#1c3a08", textTransform: "uppercase" }}>XEEVIA</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(34px, 3.4vw, 52px)", fontWeight: 900, lineHeight: 1.06, letterSpacing: "-2px", margin: "0 0 18px", color: "#fff" }}>
          Your social life,<br />
          <span className="xv-shimmer">renewed.</span>
        </h1>

        {/* Subtext */}
        <p style={{ fontSize: 13.5, color: "#2e2e2e", lineHeight: 1.85, maxWidth: 370, margin: "0 0 32px" }}>
          A private social experience built for people who want more — real connections, genuine community, and a platform that actually belongs to you.
        </p>

        {/* Feature grid */}
        <div className="xv-feat-grid" style={{ marginBottom: 32 }}>
          {FEATURES.map(({ n, icon, title, sub }) => (
            <div key={n} className="xv-feat-card">
              <div style={{ fontSize: 18, marginBottom: 7 }}>{icon}</div>
              <div style={{ fontSize: 9, color: "#1d1d1d", fontWeight: 800, letterSpacing: "1.2px", marginBottom: 5 }}>{n}</div>
              <div style={{ fontSize: 11, color: "#b0e060", fontWeight: 700, lineHeight: 1.35, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 10, color: "#242424", lineHeight: 1.4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div style={{ borderLeft: "2px solid #161616", paddingLeft: 16, marginBottom: 0 }}>
          <p style={{ color: "#222", fontSize: 12, lineHeight: 1.85, fontStyle: "italic", margin: 0 }}>
            "The next social protocol won't be owned by a company.<br />
            It'll be owned by the people who showed up first."
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid #0f0f0f", paddingTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* Member stack */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="xv-avatar-stack">
            {AVATARS.map((av, i) => (
              <div key={i} className="xv-avatar"
                style={{ background: av.color, marginLeft: i > 0 ? -10 : 0, zIndex: AVATARS.length - i }}>
                {av.initials}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#b0e060", letterSpacing: "-0.5px", fontFamily: "'Syne', sans-serif" }}>
              {memberCount > 0 ? memberCount.toLocaleString() : "—"}
            </div>
            <div style={{ fontSize: 10, color: "#1e1e1e", fontWeight: 600 }}>members joined</div>
          </div>
        </div>

        {/* Tech badges */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <div style={{ display: "flex", gap: 5 }}>
            <span className="xv-tech-badge">⛓ Web3</span>
            <span className="xv-tech-badge">🔐 Supabase</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <span className="xv-tech-badge">🏦 Paystack</span>
            <span className="xv-tech-badge">✓ On-chain</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Header ─────────────────────────────────────────────────────────────
function MobileHeader() {
  return (
    <div className="xv-mobile-header">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#a3e635,#65a30d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: "#040a00", fontFamily: "'Syne', sans-serif" }}>X</span>
        </div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: "4px", color: "#1c3a08", textTransform: "uppercase" }}>XEEVIA</span>
      </div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: "-1px", color: "#fff", lineHeight: 1.2, marginBottom: 6 }}>
        Your social life,{" "}
        <span style={{ background: "linear-gradient(135deg,#d4fc72,#65a30d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>renewed.</span>
      </div>
      <div style={{ fontSize: 11, color: "#1e1e1e", letterSpacing: "2.5px", textTransform: "uppercase", fontWeight: 700 }}>Private · Social · Yours</div>
    </div>
  );
}

// ── Price Hero ────────────────────────────────────────────────────────────────
// SLIDE RULES (strict — no exceptions):
//   Slide 0: PUBLIC PRICE  — always shown; shows discounted price if non-wl invite active
//   Slide 1: WHITELIST ENTRY — only if invite.type === "whitelist" AND not full
//   Slide 2: WAITLIST — only if invite.type === "whitelist" AND is_full
function PriceHero({ productPrice, inviteDetails, loading }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [priceKey, setPriceKey] = useState(0);
  const prevPrice = useRef(null);

  const publicPrice = productPrice ?? 4;

  const isWhitelistInvite = inviteDetails && (
    inviteDetails.type === "whitelist" ||
    inviteDetails.metadata?.invite_type === "whitelist"
  );
  const isFull = isWhitelistInvite && inviteDetails?.is_full;
  const invitePrice = isWhitelistInvite ? resolvePrice(inviteDetails, publicPrice) : publicPrice;
  const isFree = isWhitelistInvite && invitePrice === 0;

  const nonWlDiscount = inviteDetails && !isWhitelistInvite ? resolvePrice(inviteDetails, publicPrice) : null;
  const slide0Price = nonWlDiscount != null ? nonWlDiscount : publicPrice;
  const slide0Note = nonWlDiscount != null ? "exclusive invite price" : "one-time · instant activation";

  const slides = [];
  slides.push({
    id: "public",
    badge: "PUBLIC PRICE",
    badgeColor: "#a3e635", badgeBg: "rgba(163,230,53,.1)", badgeBorder: "rgba(163,230,53,.25)",
    price: slide0Price, accent: "#a3e635", note: slide0Note, epLabel: "300 EP",
  });

  if (isWhitelistInvite && !isFull) {
    slides.push(isFree
      ? { id: "whitelist", badge: "FREE ACCESS", badgeColor: "#a3e635", badgeBg: "rgba(163,230,53,.1)", badgeBorder: "rgba(163,230,53,.25)", price: 0, accent: "#a3e635", note: "whitelisted · no payment needed", epLabel: "500 EP" }
      : { id: "whitelist", badge: "WHITELIST ENTRY", badgeColor: "#f59e0b", badgeBg: "rgba(245,158,11,.1)", badgeBorder: "rgba(245,158,11,.25)", price: invitePrice, accent: "#f59e0b", note: "whitelist · exclusive entry price", epLabel: "500 EP" }
    );
  }

  if (isWhitelistInvite && isFull) {
    slides.push({ id: "waitlist", badge: "WAITLIST", badgeColor: "#38bdf8", badgeBg: "rgba(56,189,248,.08)", badgeBorder: "rgba(56,189,248,.22)", price: invitePrice, accent: "#38bdf8", note: "hold your spot · pay when promoted", epLabel: "200 EP" });
  }

  useEffect(() => {
    if (isWhitelistInvite && slides.length > 1) setSlideIdx(slides.length - 1);
    else setSlideIdx(0);
  // eslint-disable-next-line
  }, [inviteDetails?.id, isWhitelistInvite]);

  const si = Math.min(slideIdx, slides.length - 1);
  const s = slides[si];
  const activePrice = s?.price ?? publicPrice;
  useEffect(() => {
    if (prevPrice.current !== null && prevPrice.current !== activePrice) setPriceKey(k => k + 1);
    prevPrice.current = activePrice;
  }, [activePrice]);

  if (loading) return <div className="xv-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 36, marginBottom: 20 }}><Spin size={24} /></div>;

  return (
    <div className="xv-card" style={{ marginBottom: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle,${s.accent}40 0%,transparent 70%)`, pointerEvents: "none", transition: "background .5s" }} />
      <div key={s.id} style={{ position: "relative", zIndex: 1, animation: "xvSlide .35s cubic-bezier(.23,1,.32,1)" }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 800, letterSpacing: "2.2px", textTransform: "uppercase", color: s.badgeColor, background: s.badgeBg, border: `1px solid ${s.badgeBorder}`, borderRadius: 20, padding: "4px 12px" }}>{s.badge}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div key={priceKey} style={{ display: "flex", alignItems: "baseline", gap: 4, animation: priceKey > 0 ? "xvPop .3s ease" : "none" }}>
              {s.price !== 0 && <span style={{ fontSize: 26, color: "#444", fontWeight: 600 }}>$</span>}
              <span style={{ fontSize: 60, fontWeight: 900, color: s.price === 0 ? "#a3e635" : "#fff", letterSpacing: "-4px", lineHeight: 1, transition: "color .4s" }}>
                {s.price === 0 ? "FREE" : fmt(s.price)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#3a3a3a", fontWeight: 600, marginTop: 5 }}>{s.note}</div>
          </div>
          <div style={{ background: "#111", border: `1px solid ${s.accent}20`, borderRadius: 12, padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.accent, letterSpacing: "-1px", lineHeight: 1 }}>{s.epLabel}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#333", letterSpacing: "1px", textTransform: "uppercase", marginTop: 3 }}>instant reward</div>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: "#333" }}>Early access slots</span>
            <span style={{ fontSize: 11, color: s.accent, fontWeight: 700 }}>73% claimed</span>
          </div>
          <div style={{ height: 4, background: "#1a1a1a", borderRadius: 3 }}>
            <div style={{ width: "73%", height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${s.accent}88,${s.accent})`, boxShadow: `0 0 10px ${s.accent}50`, transition: "all .5s" }} />
          </div>
        </div>
      </div>
      {slides.length > 1 && (
        <div className="xv-hero-dots">
          {slides.map((sl, i) => (
            <div key={sl.id} onClick={() => setSlideIdx(i)} className="xv-hero-dot" style={{ width: i === si ? 18 : 6, background: i === si ? sl.accent : "#2a2a2a" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Smart EVM Panel ───────────────────────────────────────────────────────────
function SmartEVM({ product, effectivePrice, onSuccess, userId }) {
  const [chain, setChain] = useState(EVM_CHAINS[0]);
  const [token, setToken] = useState(EVM_CHAINS[0].tokens[0]);
  const [wallet, setWallet] = useState(null);
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    detectAvailableWallet().then(w => { if (mounted.current) setWallet(w); }).catch(() => {});
    return () => { mounted.current = false; };
  }, []);

  const changeChain = useCallback(c => { setChain(c); setToken(c.tokens[0]); setErr(""); setStep(0); }, []);

  const pay = useCallback(async () => {
    if (busy || !wallet || !product) return;
    setErr(""); setBusy(true); setStep(1); setStepMsg("Connecting…");
    try {
      const r = await requestWalletPayment({
        productId: product.id, amountUSD: effectivePrice, chainId: chain.chainId,
        chainName: chain.id, tokenAddress: token.address, tokenDecimals: token.decimals,
        onStep: s => {
          if (!mounted.current) return;
          setStepMsg(s.message);
          if (s.type === "connecting" || s.type === "switching_chain") setStep(1);
          else if (s.type === "sending") setStep(2);
          else if (s.type === "sent") { setStep(3); setTxHash(s.txHash); }
          else if (s.type === "confirming") setStep(3);
        },
      });
      if (!mounted.current) return;
      if (r.success) {
        if (wallet.address && userId) await saveConnectedWallet(userId, "EVM", wallet.address, wallet.label);
        setStep(4); onSuccess?.(r);
      } else if (r.pending) { setErr(r.message); setStep(0); }
    } catch (e) {
      if (!mounted.current) return;
      setErr(e?.message ?? "Payment failed."); setStep(0);
    } finally { if (mounted.current) setBusy(false); }
  }, [busy, wallet, product, effectivePrice, chain, token, onSuccess, userId]);

  const idle = step === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "xvFadeIn .2s" }}>
      {wallet ? <WalletBadge wallet={wallet} /> : (
        <div style={{ background: "#110c00", border: "1px solid rgba(245,158,11,.22)", borderRadius: 11, padding: "12px 14px", display: "flex", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📦</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 3 }}>No wallet detected</div>
            <div style={{ fontSize: 11, color: "#6b5022", lineHeight: 1.65 }}>Install MetaMask, Coinbase, or Trust Wallet. Or switch to <strong style={{ color: "#94a3b8" }}>Manual</strong>.</div>
          </div>
        </div>
      )}
      {idle && <><ChainDropdown selected={chain} onChange={changeChain} chains={EVM_CHAINS} /><TokenRow tokens={chain.tokens} selected={token} onChange={setToken} /></>}
      {!idle && (
        <div className="xv-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepRow step={1} active={step} label="Connect wallet" sub="Approve in your extension" />
          <StepRow step={2} active={step} label="Sign transaction" sub={`$${fmt(effectivePrice)} ${token.symbol} on ${chain.label}`} />
          <StepRow step={3} active={step} label="Blockchain confirmation" sub={txHash ? `TX: ${txHash.slice(0, 14)}…` : "Waiting for confirmation"} />
          <StepRow step={4} active={step} label="Account activated ✓" sub="Welcome to Xeevia!" />
          {stepMsg && <div style={{ fontSize: 11, color: "#a3e635", fontStyle: "italic", textAlign: "center", paddingTop: 4 }}>{stepMsg}</div>}
        </div>
      )}
      <ErrBox msg={err} />
      {idle
        ? <button className="xv-btn-lime" onClick={pay} disabled={!wallet || !product || busy}>
          {wallet ? <>{wallet.label} → Pay ${fmt(effectivePrice)} {token.symbol}</> : "Install a wallet to continue"}
        </button>
        : step < 4 && <button className="xv-btn-danger" onClick={() => { setBusy(false); setStep(0); setStepMsg(""); }}>Cancel payment</button>
      }
    </div>
  );
}

// ── Manual EVM Panel ──────────────────────────────────────────────────────────
function ManualEVM({ effectivePrice, onVerify, loading, error, reset }) {
  const [chain, setChain] = useState(EVM_CHAINS[0]);
  const [wallet, setWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET ?? "";
  const okTx = /^0x[0-9a-fA-F]{64}$/.test(txHash);
  const okWal = /^0x[0-9a-fA-F]{40}$/.test(wallet);
  const can = okTx && okWal && !!treasury && !loading;

  const autoFill = async () => {
    setFilling(true);
    try { const a = await connectWallet("EVM"); setWallet(a); reset(); }
    catch (e) { alert(e.message); }
    finally { setFilling(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "xvFadeIn .2s" }}>
      <ChainDropdown selected={chain} onChange={c => { setChain(c); reset(); }} chains={EVM_CHAINS} />
      <div>
        <Label>Step 1 — Send ${fmt(effectivePrice)} USDT/USDC to</Label>
        <CopyAddress address={treasury} label="EVM" />
      </div>
      <div>
        <Label>Step 2 — Your sending wallet address</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className={`xv-input ${wallet ? (okWal ? "ok" : "err") : ""}`} value={wallet} onChange={e => { setWallet(e.target.value.trim()); reset(); }} placeholder="0x… wallet address" style={{ flex: 1 }} />
          <button className="xv-btn-outline" onClick={autoFill} disabled={filling} style={{ width: "auto", padding: "0 14px", flexShrink: 0, whiteSpace: "nowrap", fontSize: 12 }}>
            {filling ? <Spin size={13} /> : "🦊 Auto-fill"}
          </button>
        </div>
        {wallet && !okWal && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Must be a valid 0x address</div>}
      </div>
      <div>
        <Label>Step 3 — Transaction hash</Label>
        <input className={`xv-input ${txHash ? (okTx ? "ok" : "err") : ""}`} value={txHash} onChange={e => { setTxHash(e.target.value.trim()); reset(); }} placeholder="0x… tx hash (66 characters)" />
        {txHash && !okTx && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Must be 0x + 64 hex characters</div>}
      </div>
      <InfoBox icon="🔒">Your wallet and amount are verified directly on-chain. No one can fake this.</InfoBox>
      <ErrBox msg={error} />
      <button className="xv-btn-lime" onClick={() => can && onVerify({ chainType: chain.ecosystem ?? "EVM", chain: chain.id, txHash: txHash.trim(), claimedSenderWallet: wallet.trim() })} disabled={!can}>
        {loading ? <><Spin size={16} color="#061000" />Verifying on blockchain…</> : "Verify & Activate Account →"}
      </button>
    </div>
  );
}

// ── EVM Panel ─────────────────────────────────────────────────────────────────
function EVMPanel({ product, effectivePrice, onSmartSuccess, onVerify, loading, error, reset, userId }) {
  const [isManual, setIsManual] = useState(false);
  return (
    <div>
      <ModeControl isManual={isManual} onChange={setIsManual} />
      {isManual
        ? <ManualEVM effectivePrice={effectivePrice} onVerify={onVerify} loading={loading} error={error} reset={reset} />
        : <SmartEVM product={product} effectivePrice={effectivePrice} onSuccess={onSmartSuccess} userId={userId} />
      }
    </div>
  );
}

// ── Smart Solana Panel ────────────────────────────────────────────────────────
function SmartSolana({ effectivePrice, onSuccess, userId, product }) {
  const [detWallet, setDetWallet] = useState(null);
  const [detecting, setDetecting] = useState(true);
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [token, setToken] = useState(SOL_TOKENS[0]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    detectSolanaWallet().then(w => { if (mounted.current) { setDetWallet(w); setDetecting(false); } }).catch(() => { if (mounted.current) setDetecting(false); });
    return () => { mounted.current = false; };
  }, []);

  const pay = useCallback(async () => {
    if (busy) return;
    setErr(""); setBusy(true); setStep(1); setStepMsg("Connecting Solana wallet…");
    try {
      const r = await requestSolanaPayment({
        productId: product.id, amountUSD: effectivePrice, tokenSymbol: token.symbol,
        onStep: s => {
          if (!mounted.current) return;
          setStepMsg(s.message);
          if (s.type === "connecting") setStep(1);
          else if (s.type === "sending") setStep(2);
          else if (s.type === "sent") setStep(3);
          else if (s.type === "confirming") setStep(3);
        },
      });
      if (!mounted.current) return;
      if (r.success) {
        const addr = detWallet?.address;
        if (addr && userId) await saveConnectedWallet(userId, "SOLANA", addr, detWallet?.label ?? "Solana Wallet");
        setStep(4); onSuccess?.(r);
      }
    } catch (e) {
      if (!mounted.current) return;
      const msg = e?.message ?? "Payment failed.";
      setErr(msg.includes("Manual") || msg.includes("library") ? msg + " Use Manual mode below." : msg);
      setStep(0);
    } finally { if (mounted.current) setBusy(false); }
  }, [busy, product, effectivePrice, token, onSuccess, userId, detWallet]);

  const idle = step === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "xvFadeIn .2s" }}>
      {detecting
        ? <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "#555", fontSize: 13 }}><Spin size={14} color="#9945ff" /> Detecting Solana wallets…</div>
        : detWallet
          ? <WalletBadge wallet={{ ...detWallet, connected: !!detWallet.address }} accentColor="#9945ff" />
          : <div style={{ background: "rgba(153,69,255,.06)", border: "1px solid rgba(153,69,255,.2)", borderRadius: 11, padding: "12px 14px", display: "flex", gap: 10 }}>
            <span style={{ fontSize: 16 }}>◎</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 3 }}>No Solana wallet detected</div>
              <div style={{ fontSize: 11, color: "#5b4d7a", lineHeight: 1.65 }}>Install Phantom, Solflare, or Backpack then refresh. Or use <strong style={{ color: "#94a3b8" }}>Manual</strong>.</div>
            </div>
          </div>
      }
      {idle && <TokenRow tokens={SOL_TOKENS} selected={token} onChange={setToken} />}
      {!idle && (
        <div className="xv-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepRow step={1} active={step} label="Connect Solana wallet" sub="Approve in Phantom / Solflare / Backpack" />
          <StepRow step={2} active={step} label="Build & sign transaction" sub={`$${fmt(effectivePrice)} ${token.symbol} on Solana`} />
          <StepRow step={3} active={step} label="Broadcast & confirm" sub="Submitting to Solana network" />
          <StepRow step={4} active={step} label="Account activated ✓" sub="Welcome to Xeevia!" />
          {stepMsg && <div style={{ fontSize: 11, color: "#9945ff", fontStyle: "italic", textAlign: "center", paddingTop: 4 }}>{stepMsg}</div>}
        </div>
      )}
      <ErrBox msg={err} />
      {idle
        ? <button className="xv-btn-sol" onClick={pay} disabled={!product || busy || detecting}>
          {detWallet ? `${detWallet.label} → Pay $${fmt(effectivePrice)} ${token.symbol}` : detecting ? "Detecting wallet…" : "Connect Solana Wallet"}
        </button>
        : step < 4 && <button className="xv-btn-danger" onClick={() => { setBusy(false); setStep(0); setStepMsg(""); }}>Cancel</button>
      }
    </div>
  );
}

// ── Manual Solana Panel ───────────────────────────────────────────────────────
function ManualSolana({ effectivePrice, onVerify, loading, error, reset, userId }) {
  const [wallet, setWallet] = useState("");
  const [txSig, setTxSig] = useState("");
  const [token, setToken] = useState(SOL_TOKENS[0]);
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET_SOL ?? "";
  const okSig = /^[1-9A-HJ-NP-Za-km-z]{87,90}$/.test(txSig);
  const okWal = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
  const can = okSig && okWal && !!treasury && !loading;

  const autoFill = async () => {
    setFilling(true);
    try { const a = await connectWallet("SOLANA"); setWallet(a); if (userId) await saveConnectedWallet(userId, "SOLANA", a, "Solana Wallet"); reset(); }
    catch (e) { alert(e.message); }
    finally { setFilling(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "xvFadeIn .2s" }}>
      <TokenRow tokens={SOL_TOKENS} selected={token} onChange={setToken} />
      <div>
        <Label>Step 1 — Send ${fmt(effectivePrice)} {token.symbol} to</Label>
        <CopyAddress address={treasury} label="SOL" />
      </div>
      <div>
        <Label>Step 2 — Your Solana wallet address</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className={`xv-input ${wallet ? (okWal ? "ok" : "err") : ""}`} value={wallet} onChange={e => { setWallet(e.target.value.trim()); reset(); }} placeholder="Solana address (base58)" style={{ flex: 1 }} />
          <button className="xv-btn-outline" onClick={autoFill} disabled={filling} style={{ width: "auto", padding: "0 14px", flexShrink: 0, whiteSpace: "nowrap", fontSize: 12 }}>
            {filling ? <Spin size={13} /> : "◎ Auto-fill"}
          </button>
        </div>
        {wallet && !okWal && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Enter a valid base58 Solana address</div>}
      </div>
      <div>
        <Label>Step 3 — Transaction signature</Label>
        <input className={`xv-input ${txSig ? (okSig ? "ok" : "err") : ""}`} value={txSig} onChange={e => { setTxSig(e.target.value.trim()); reset(); }} placeholder="Transaction signature (87–90 chars)" />
        {txSig && !okSig && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Enter a valid Solana transaction signature</div>}
      </div>
      <ErrBox msg={error} />
      <button className="xv-btn-lime" onClick={() => can && onVerify({ chainType: "SOLANA", chain: "solana", txHash: txSig.trim(), claimedSenderWallet: wallet.trim() })} disabled={!can}>
        {loading ? <><Spin size={16} color="#061000" />Verifying…</> : "Verify Solana Payment →"}
      </button>
    </div>
  );
}

// ── Solana Panel ──────────────────────────────────────────────────────────────
function SolanaPanel({ product, effectivePrice, onSmartSuccess, onVerify, loading, error, reset, userId }) {
  const [isManual, setIsManual] = useState(false);
  return (
    <div>
      <ModeControl isManual={isManual} onChange={setIsManual} />
      {isManual
        ? <ManualSolana effectivePrice={effectivePrice} onVerify={onVerify} loading={loading} error={error} reset={reset} userId={userId} />
        : <SmartSolana effectivePrice={effectivePrice} onSuccess={onSmartSuccess} userId={userId} product={product} />
      }
    </div>
  );
}

// ── Smart Cardano Panel ───────────────────────────────────────────────────────
function SmartCardano({ effectivePrice, onSuccess, userId, product }) {
  const [detWallet, setDetWallet] = useState(null);
  const [detecting, setDetecting] = useState(true);
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    detectCardanoWallet().then(w => { if (mounted.current) { setDetWallet(w); setDetecting(false); } }).catch(() => { if (mounted.current) setDetecting(false); });
    return () => { mounted.current = false; };
  }, []);

  const pay = useCallback(async () => {
    if (busy) return;
    setErr(""); setBusy(true); setStep(1); setStepMsg("Connecting Cardano wallet…");
    try {
      const r = await requestCardanoPayment({
        productId: product.id, amountUSD: effectivePrice,
        onStep: s => {
          if (!mounted.current) return;
          setStepMsg(s.message);
          if (s.type === "connecting") setStep(1);
          else if (s.type === "sending") setStep(2);
          else if (s.type === "confirming") setStep(3);
        },
      });
      if (!mounted.current) return;
      if (r.success) {
        const addr = detWallet?.address;
        if (addr && userId) await saveConnectedWallet(userId, "CARDANO", addr, detWallet?.label ?? "Cardano Wallet");
        setStep(4); onSuccess?.(r);
      }
    } catch (e) {
      if (!mounted.current) return;
      const msg = e?.message ?? "Payment failed.";
      setErr(msg.includes("Manual") ? msg : msg + " If issue persists, try Manual mode.");
      setStep(0);
    } finally { if (mounted.current) setBusy(false); }
  }, [busy, product, effectivePrice, onSuccess, userId, detWallet]);

  const idle = step === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "xvFadeIn .2s" }}>
      {detecting
        ? <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "#555", fontSize: 13 }}><Spin size={14} color="#0057ff" /> Detecting Cardano wallets…</div>
        : detWallet
          ? <WalletBadge wallet={{ ...detWallet, connected: !!detWallet.address }} accentColor="#0057ff" />
          : <div style={{ background: "rgba(0,51,173,.06)", border: "1px solid rgba(0,51,173,.2)", borderRadius: 11, padding: "12px 14px", display: "flex", gap: 10 }}>
            <span style={{ fontSize: 16 }}>🔵</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 3 }}>No Cardano wallet detected</div>
              <div style={{ fontSize: 11, color: "#334d6b", lineHeight: 1.65 }}>Install Nami, Eternl, Flint, Lace, or Yoroi then refresh. Or use <strong style={{ color: "#94a3b8" }}>Manual</strong>.</div>
            </div>
          </div>
      }
      {!idle && (
        <div className="xv-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepRow step={1} active={step} label="Connect Cardano wallet" sub="Approve in Nami / Eternl / Flint / Lace" />
          <StepRow step={2} active={step} label="Build & sign transaction" sub={`~$${fmt(effectivePrice)} ADA equivalent`} />
          <StepRow step={3} active={step} label="Submit & verify" sub="Checking on Cardano chain" />
          <StepRow step={4} active={step} label="Account activated ✓" sub="Welcome to Xeevia!" />
          {stepMsg && <div style={{ fontSize: 11, color: "#0057ff", fontStyle: "italic", textAlign: "center", paddingTop: 4 }}>{stepMsg}</div>}
        </div>
      )}
      <ErrBox msg={err} />
      {idle
        ? <button className="xv-btn-ada" onClick={pay} disabled={!product || busy || detecting}>
          {detWallet ? `${detWallet.label} → Pay $${fmt(effectivePrice)} ADA` : detecting ? "Detecting wallet…" : "Connect Cardano Wallet"}
        </button>
        : step < 4 && <button className="xv-btn-danger" onClick={() => { setBusy(false); setStep(0); setStepMsg(""); }}>Cancel</button>
      }
    </div>
  );
}

// ── Manual Cardano Panel ──────────────────────────────────────────────────────
function ManualCardano({ effectivePrice, onVerify, loading, error, reset, userId }) {
  const [wallet, setWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET_ADA ?? "";
  const okTx = /^[0-9a-fA-F]{64}$/.test(txHash);
  const okWal = wallet.length >= 59 && (wallet.startsWith("addr1") || wallet.startsWith("addr_test1"));
  const can = okTx && okWal && !!treasury && !loading;

  const autoFill = async () => {
    setFilling(true);
    try { const a = await connectWallet("CARDANO"); setWallet(a); if (userId) await saveConnectedWallet(userId, "CARDANO", a, "Cardano Wallet"); reset(); }
    catch (e) { alert(e.message); }
    finally { setFilling(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "xvFadeIn .2s" }}>
      <div style={{ background: "rgba(0,51,173,.06)", border: "1px solid rgba(0,51,173,.2)", borderRadius: 12, padding: "11px 14px", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 18 }}>🔵</span>
        <span style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>Send <strong style={{ color: "#a3e635" }}>${fmt(effectivePrice)} ADA equivalent</strong>. ADA/USD rate is fetched at verification time.</span>
      </div>
      <div>
        <Label>Step 1 — Send to this Cardano address</Label>
        <CopyAddress address={treasury} label="ADA" />
      </div>
      <div>
        <Label>Step 2 — Your Cardano address (addr1…)</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className={`xv-input ${wallet ? (okWal ? "ok" : "err") : ""}`} value={wallet} onChange={e => { setWallet(e.target.value.trim()); reset(); }} placeholder="addr1… (Shelley address)" style={{ flex: 1 }} />
          <button className="xv-btn-outline" onClick={autoFill} disabled={filling} style={{ width: "auto", padding: "0 14px", flexShrink: 0, whiteSpace: "nowrap", fontSize: 12 }}>
            {filling ? <Spin size={13} /> : "🔵 Auto-fill"}
          </button>
        </div>
        {wallet && !okWal && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Must be a valid Shelley address starting with addr1</div>}
      </div>
      <div>
        <Label>Step 3 — Transaction ID (TxHash)</Label>
        <input className={`xv-input ${txHash ? (okTx ? "ok" : "err") : ""}`} value={txHash} onChange={e => { setTxHash(e.target.value.trim()); reset(); }} placeholder="64-character transaction ID" />
        {txHash && !okTx && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>Must be exactly 64 hex characters</div>}
      </div>
      <InfoBox icon="ℹ️">Send ~2% extra to account for ADA price movement between send and verify.</InfoBox>
      <ErrBox msg={error} />
      <button className="xv-btn-lime" onClick={() => can && onVerify({ chainType: "CARDANO", chain: "cardano", txHash: txHash.trim(), claimedSenderWallet: wallet.trim() })} disabled={!can}>
        {loading ? <><Spin size={16} color="#061000" />Verifying…</> : "Verify Cardano Payment →"}
      </button>
    </div>
  );
}

// ── Cardano Panel ─────────────────────────────────────────────────────────────
function CardanoPanel({ product, effectivePrice, onSmartSuccess, onVerify, loading, error, reset, userId }) {
  const [isManual, setIsManual] = useState(false);
  return (
    <div>
      <ModeControl isManual={isManual} onChange={setIsManual} />
      {isManual
        ? <ManualCardano effectivePrice={effectivePrice} onVerify={onVerify} loading={loading} error={error} reset={reset} userId={userId} />
        : <SmartCardano effectivePrice={effectivePrice} onSuccess={onSmartSuccess} userId={userId} product={product} />
      }
    </div>
  );
}

// ── Waitlist Join ─────────────────────────────────────────────────────────────
function WaitlistJoin({ inviteDetails, userId, onJoined }) {
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const join = async () => {
    if (!okEmail || joining) return;
    setJoining(true); setErr("");
    try {
      const { error } = await supabase.from("waitlist_entries").insert({ invite_code_id: inviteDetails.id, user_id: userId ?? null, email: email.trim(), code: inviteDetails.code });
      if (error) setErr(error.code === "23505" ? "You're already on this waitlist!" : error.message ?? "Failed to join waitlist.");
      else { setDone(true); onJoined?.(); }
    } catch (e) { setErr(e?.message ?? "Failed."); }
    finally { setJoining(false); }
  };

  if (done) return (
    <div style={{ background: "rgba(56,189,248,.06)", border: "1px solid rgba(56,189,248,.22)", borderRadius: 14, padding: 20, textAlign: "center", animation: "xvFadeUp .3s" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#38bdf8", marginBottom: 6 }}>You're on the waitlist!</div>
      <div style={{ fontSize: 12, color: "#444", lineHeight: 1.75 }}>We'll notify <strong style={{ color: "#d8d8d8" }}>{email}</strong> when a spot opens.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "rgba(56,189,248,.06)", border: "1px solid rgba(56,189,248,.2)", borderRadius: 14, padding: "16px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#38bdf8", marginBottom: 6 }}>This whitelist is full</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.75 }}>Join the waitlist and we'll notify you when a spot opens.</div>
      </div>
      <div>
        <Label>Your email address</Label>
        <input className={`xv-input ${email ? (okEmail ? "ok" : "err") : ""}`} type="email" value={email} onChange={e => setEmail(e.target.value.trim())} onKeyDown={e => e.key === "Enter" && join()} placeholder="you@example.com" />
      </div>
      <ErrBox msg={err} />
      <button className="xv-btn-lime" onClick={join} disabled={!okEmail || joining} style={{ background: "linear-gradient(135deg,#38bdf8 0%,#0ea5e9 100%)", color: "#001a26", boxShadow: "0 4px 22px rgba(56,189,248,.35)" }}>
        {joining ? <><Spin size={16} color="#001a26" />Joining…</> : "Join Waitlist →"}
      </button>
    </div>
  );
}

// ── Invite Code Section ───────────────────────────────────────────────────────
function InviteCodeSection({ code, setCode, codeErr, codeOk, codeLoad, onApply, inviteDetails, onClear, effectivePrice }) {
  const isWhitelist = inviteDetails && (inviteDetails.type === "whitelist" || inviteDetails.metadata?.invite_type === "whitelist");
  const isFull = inviteDetails?.is_full;
  const isFree = effectivePrice === 0;

  let typeLabel = "INVITE";
  if (isWhitelist && isFull) typeLabel = "WAITLIST";
  else if (isWhitelist) typeLabel = "WHITELIST";
  else if (isFree) typeLabel = "FREE";

  const accentColor = (isWhitelist && isFull) ? "#38bdf8" : isFree ? "#a3e635" : "#f59e0b";
  const accentBg    = (isWhitelist && isFull) ? "rgba(56,189,248,.05)"  : isFree ? "rgba(163,230,53,.05)"  : "rgba(245,158,11,.05)";
  const accentBdr   = (isWhitelist && isFull) ? "rgba(56,189,248,.22)"  : isFree ? "rgba(163,230,53,.22)"  : "rgba(245,158,11,.22)";

  return (
    <div style={{ marginTop: 20 }}>
      <Divider label="or use a code" />
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input
          className={`xv-input ${codeOk ? "ok" : codeErr ? "err" : ""}`}
          value={code} onChange={e => setCode(e.target.value.toUpperCase().trim())}
          onKeyDown={e => e.key === "Enter" && onApply()}
          placeholder="Whitelist or invite code"
          style={{ flex: 1, letterSpacing: "2px", fontWeight: 600, textTransform: "uppercase" }}
        />
        <button className="xv-btn-outline" onClick={onApply} disabled={codeLoad || !code.trim()} style={{ width: "auto", padding: "0 18px", flexShrink: 0, fontSize: 13, whiteSpace: "nowrap" }}>
          {codeLoad ? <Spin size={14} /> : codeOk ? "✓ Applied" : "Apply"}
        </button>
      </div>
      {codeErr && !codeOk && <div style={{ marginTop: 10 }}><ErrBox msg={codeErr} /></div>}
      {inviteDetails && (
        <div style={{ marginTop: 14, background: accentBg, border: `1.5px solid ${accentBdr}`, borderRadius: 12, padding: "13px 15px", animation: "xvCodeIn .3s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: accentColor, background: accentBg, border: `1px solid ${accentBdr}`, borderRadius: 20, padding: "3px 10px" }}>
                  {typeLabel}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e0", ...mono, letterSpacing: "1.5px" }}>{inviteDetails.code}</span>
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                {isWhitelist && isFull ? "Whitelist is full — you'll be added to the waitlist."
                  : isFree ? "🎉 Free access applied — no payment needed!"
                  : isWhitelist ? `Whitelist price locked at $${fmt(effectivePrice)}`
                  : `Price locked at $${fmt(effectivePrice)}`
                }
              </div>
            </div>
            <button onClick={onClear} style={{ background: "transparent", border: "1px solid #252525", borderRadius: 8, color: "#444", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "5px 8px", flexShrink: 0, fontFamily: "inherit", transition: "all .15s" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ profile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080808", padding: "20px", animation: "xvFadeUp .5s" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(163,230,53,.12)", border: "2px solid rgba(163,230,53,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20, animation: "xvGlow 2s ease-in-out infinite" }}>✓</div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 8px", letterSpacing: "-1px" }}>You're in!</h1>
      <p style={{ fontSize: 15, color: "#444", margin: "0 0 24px" }}>Account activated. Welcome to Xeevia.</p>
      <button onClick={() => window.location.reload()} className="xv-btn-lime" style={{ maxWidth: 240 }}>Enter Xeevia →</button>
    </div>
  );
}

// ── Paywall Right Column ──────────────────────────────────────────────────────
function PaywallColumn({
  product, productLoading, tab, setTab,
  verifyLoading, verifyError, setVerifyError,
  inviteDetails, effectivePrice, isFreeWhitelist, isWaitlisted,
  code, setCode, codeLoad, codeErr, codeOk,
  applyCode, clearInvite,
  handleSmartSuccess, handleVerify, resetError,
  handleFreeActivation, userId,
  onPaystackClick,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "3px", color: "#183008", textTransform: "uppercase", marginBottom: 18 }}>
        Complete Access
      </div>

      {/* Price Hero */}
      <PriceHero productPrice={product?.amount_usd ?? 4} inviteDetails={inviteDetails} loading={productLoading} />

      {/* Payment area */}
      {isWaitlisted ? (
        <WaitlistJoin inviteDetails={inviteDetails} userId={userId} onJoined={() => {}} />
      ) : isFreeWhitelist ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "rgba(163,230,53,.05)", border: "1px solid rgba(163,230,53,.2)", borderRadius: 14, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🎁</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#a3e635", marginBottom: 6 }}>Whitelist access — free!</div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.75 }}>Your whitelist code gives you free access. Click below to activate instantly.</div>
          </div>
          <ErrBox msg={verifyError} />
          <button className="xv-btn-lime" onClick={handleFreeActivation} disabled={verifyLoading}
            style={{ background: "linear-gradient(135deg,#a3e635 0%,#22c55e 100%)", boxShadow: "0 4px 22px rgba(34,197,94,.35)" }}>
            {verifyLoading ? <><Spin size={16} color="#061000" />Activating…</> : "🎉 Activate Free Access →"}
          </button>
        </div>
      ) : (
        <>
          <div className="xv-tabs">
            {[
              { id: "evm",      icon: "🔗", label: "EVM" },
              { id: "solana",   icon: "◎",  label: "Solana" },
              { id: "cardano",  icon: "🔵", label: "Cardano" },
              { id: "paystack", icon: "🏦", label: "Card/Bank", soon: true },
            ].map(t => (
              <button key={t.id} className={`xv-tab ${tab === t.id ? "on" : t.soon ? "soon" : "off"}`}
                onClick={() => t.soon ? onPaystackClick() : setTab(t.id)}>
                <span>{t.icon}</span>{t.label}
                {t.soon && <span style={{ fontSize: 8, background: "rgba(245,158,11,.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.25)", borderRadius: 4, padding: "1px 4px", fontWeight: 800 }}>SOON</span>}
              </button>
            ))}
          </div>
          <div key={tab} style={{ animation: "xvFadeIn .2s" }}>
            {tab === "evm" && (
              <EVMPanel product={product} effectivePrice={effectivePrice}
                onSmartSuccess={handleSmartSuccess} onVerify={handleVerify}
                loading={verifyLoading} error={verifyError} reset={resetError} userId={userId} />
            )}
            {tab === "solana" && (
              <SolanaPanel product={product} effectivePrice={effectivePrice}
                onSmartSuccess={handleSmartSuccess} onVerify={handleVerify}
                loading={verifyLoading} error={verifyError} reset={resetError} userId={userId} />
            )}
            {tab === "cardano" && (
              <CardanoPanel product={product} effectivePrice={effectivePrice}
                onSmartSuccess={handleSmartSuccess} onVerify={handleVerify}
                loading={verifyLoading} error={verifyError} reset={resetError} userId={userId} />
            )}
          </div>
        </>
      )}

      {/* Invite code section */}
      <InviteCodeSection
        code={code} setCode={setCode}
        codeErr={codeErr} codeOk={codeOk} codeLoad={codeLoad}
        onApply={applyCode} inviteDetails={inviteDetails}
        onClear={clearInvite} effectivePrice={effectivePrice}
      />

      {/* Footer */}
      <div style={{ marginTop: 28, textAlign: "center", fontSize: 11, color: "#2a2a2a", lineHeight: 1.8 }}>
        Payments are processed on-chain · Verified on the blockchain<br />
        <span style={{ color: "#222" }}>Questions? </span>
        <a href="https://chat.whatsapp.com/IH3TJof1nRx3sRU9Inm2jr?mode=gi_t" target="_blank" rel="noopener noreferrer" style={{ color: "#333", fontWeight: 600, textDecoration: "underline" }}>Join our support group</a>
      </div>
    </div>
  );
}

// ── Main PaywallGate ──────────────────────────────────────────────────────────
export default function PaywallGate({ children }) {
  const { profile, loading: authLoading, refreshProfile } = useAuth();
  const [product, setProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(true);
  const [tab, setTab] = useState("evm");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPaystackSoon, setShowPaystackSoon] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);

  // Invite code
  const [code, setCode] = useState("");
  const [codeLoad, setCodeLoad] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [codeOk, setCodeOk] = useState(false);
  const [inviteDetails, setInviteDetails] = useState(null);
  const inviteRef = useRef(inviteDetails);
  inviteRef.current = inviteDetails;

  const userId = profile?.id ?? null;
  const mounted = useRef(true);

  // ── Resize listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Load product + member count + URL code ─────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    setProductLoading(true);
    fetchPaymentProducts()
      .then(prods => { if (mounted.current) setProduct(prods[0] ?? null); })
      .catch(() => {})
      .finally(() => { if (mounted.current) setProductLoading(false); });

    // Member count
    supabase.from("profiles").select("*", { count: "exact", head: true })
      .then(({ count }) => { if (mounted.current && count) setMemberCount(count); })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) { setCode(urlCode.toUpperCase().trim()); setTimeout(() => applyCode(urlCode.toUpperCase().trim()), 400); }

    return () => { mounted.current = false; };
  // eslint-disable-next-line
  }, []);

  // ── Realtime: product price changes ───────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("paywall-product-sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payment_products" }, async () => {
        try { const prods = await fetchPaymentProducts(); setProduct(prods[0] ?? null); } catch { /* non-fatal */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Realtime: invite code price changes ────────────────────────────────────
  useEffect(() => {
    if (!inviteDetails?.id) return;
    const channel = supabase
      .channel(`paywall-invite-sync-${inviteDetails.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "invite_codes", filter: `id=eq.${inviteDetails.id}` },
        async () => {
          try {
            const fresh = await fetchInviteCodeDetails(inviteRef.current?.code ?? "");
            if (fresh) setInviteDetails(fresh);
          } catch { /* non-fatal */ }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [inviteDetails?.id]);

  // Effective price
  const productPrice = product?.amount_usd ?? 4;
  const effectivePrice = inviteDetails ? resolvePrice(inviteDetails, productPrice) : productPrice;
  const isFree = effectivePrice === 0;

  const isWhitelistInvite = inviteDetails && (
    inviteDetails.type === "whitelist" ||
    inviteDetails.metadata?.invite_type === "whitelist"
  );
  const isWaitlisted = isWhitelistInvite && inviteDetails?.is_full && inviteDetails?.enable_waitlist !== false;
  const isFreeWhitelist = isWhitelistInvite && isFree;

  // ── Apply invite code ─────────────────────────────────────────────────────
  const applyCode = useCallback(async (codeVal) => {
    const val = (codeVal ?? code).trim().toUpperCase();
    if (!val) return;
    setCodeLoad(true); setCodeErr(""); setCodeOk(false);
    try {
      const details = await fetchInviteCodeDetails(val);
      if (!details) { setCodeErr("Code not found or invalid."); return; }
      if (details.is_expired) { setCodeErr("This code has expired."); return; }
      if (details.status !== "active") { setCodeErr("This code is no longer active."); return; }
      setInviteDetails(details); setCodeOk(true); setCodeErr("");
    } catch (e) { setCodeErr(e?.message ?? "Failed to validate code."); }
    finally { setCodeLoad(false); }
  }, [code]);

  const clearInvite = useCallback(() => { setInviteDetails(null); setCode(""); setCodeOk(false); setCodeErr(""); }, []);

  // ── Verify web3 manual payment ────────────────────────────────────────────
  const handleVerify = useCallback(async (params) => {
    setVerifyLoading(true); setVerifyError("");
    try {
      await verifyWeb3Payment({
        ...params,
        productId: product?.id,
        amountOverrideUSD: effectivePrice,
        inviteCodeId: inviteDetails?.id,
      });
      clearIdempotencyKey();
      await refreshProfile?.();
      setSuccess(true);
    } catch (e) {
      setVerifyError(e?.message ?? "Verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  }, [product, effectivePrice, inviteDetails, refreshProfile]);

  const handleSmartSuccess = useCallback(async () => {
    clearIdempotencyKey();
    await refreshProfile?.();
    setSuccess(true);
  }, [refreshProfile]);

  const resetError = useCallback(() => setVerifyError(""), []);

  const handleFreeActivation = async () => {
    if (!isFreeWhitelist || !inviteDetails) return;
    setVerifyLoading(true); setVerifyError("");
    try {
      await activateFreeCode({ inviteCodeId: inviteDetails.id, productId: product?.id });
      clearIdempotencyKey();
      await refreshProfile?.();
      setSuccess(true);
    } catch (e) {
      setVerifyError(e?.message ?? "Activation failed.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Guard: loading ─────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080808" }}>
      <style>{STYLES}</style>
      <Spin size={28} />
    </div>
  );
  if (!authLoading && profile && isPaidProfile(profile) && !success) return children;
  if (success) return <><style>{STYLES}</style><SuccessScreen profile={profile} /></>;

  // ── Shared paywall props ──────────────────────────────────────────────────
  const paywallProps = {
    product, productLoading, tab, setTab,
    verifyLoading, verifyError, setVerifyError,
    inviteDetails, effectivePrice, isFreeWhitelist, isWaitlisted,
    code, setCode, codeLoad, codeErr, codeOk,
    applyCode: () => applyCode(), clearInvite,
    handleSmartSuccess, handleVerify, resetError,
    handleFreeActivation, userId,
    onPaystackClick: () => setShowPaystackSoon(true),
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="xv">

        {/* ── Mobile layout ── */}
        {isMobile ? (
          <div style={{ width: "100%", minHeight: "100dvh", background: "#080808", overflowY: "auto" }}>
            <MobileHeader />
            <div style={{ padding: "24px 20px 64px" }}>
              <PaywallColumn {...paywallProps} />
            </div>
          </div>
        ) : (
          /* ── Desktop split-screen ── */
          <div style={{ width: "100vw", height: "100vh", display: "flex", position: "fixed", inset: 0, zIndex: 1, overflow: "hidden", background: "#050505" }}>

            {/* Left: Brand panel */}
            <BrandPanel memberCount={memberCount} />

            {/* Right: Paywall */}
            <div className="xv-paywall-side">
              <div className="xv-paywall-scroll">
                <PaywallColumn {...paywallProps} />
              </div>
            </div>
          </div>
        )}

      </div>
      {showPaystackSoon && <PaystackSoonModal onClose={() => setShowPaystackSoon(false)} />}
    </>
  );
}