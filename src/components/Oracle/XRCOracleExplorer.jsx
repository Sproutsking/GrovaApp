// src/components/Oracle/XRCOracleExplorer.jsx
// ═══════════════════════════════════════════════════════════════════════════
// THE XRC ORACLE — MASTER EDITION v3
// Header: cinematic mission-control banner with stream identity + live stats
// Search: floating command terminal below header, isolated & dramatic
// Mobile: fully stacked, touch-optimized, every detail preserved
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X, Search, Loader, ArrowLeft, Copy, Check,
  Clock, Link2, Zap, Activity, Shield, CheckCircle,
  AlertTriangle, RefreshCw, ChevronRight, Database,
  TrendingUp, Eye, Hash, GitBranch, Layers, Radio,
  Cpu, Hexagon, Triangle,
} from "lucide-react";
import { STREAM_REGISTRY, listStreams } from "../../services/xrc/streamRegistry";

// ── Stream visual identity ─────────────────────────────────────────────────
const SV = {
  XTRC: { color:"#f59e0b", glow:"rgba(245,158,11,.4)",  dim:"rgba(245,158,11,.06)", glyph:"◈", label:"Transaction" },
  XERC: { color:"#22d3ee", glow:"rgba(34,211,238,.4)",  dim:"rgba(34,211,238,.06)", glyph:"◉", label:"Engagement"  },
  XARC: { color:"#e2e8f0", glow:"rgba(226,232,240,.35)",dim:"rgba(226,232,240,.04)",glyph:"◎", label:"Account"     },
  XCRC: { color:"#84cc16", glow:"rgba(132,204,22,.4)",  dim:"rgba(132,204,22,.06)", glyph:"◆", label:"Content"     },
  XPRC: { color:"#f43f5e", glow:"rgba(244,63,94,.4)",   dim:"rgba(244,63,94,.06)",  glyph:"◇", label:"Permission"  },
  XSRC: { color:"#94a3b8", glow:"rgba(148,163,184,.35)",dim:"rgba(148,163,184,.04)",glyph:"○", label:"System"      },
  XWRC: { color:"#fb923c", glow:"rgba(251,146,60,.4)",  dim:"rgba(251,146,60,.06)", glyph:"◐", label:"Wallet"      },
};
const sv = (s) => SV[s] || SV.XSRC;

const trunc = (s, n=8) => s ? `${s.slice(0,n)}…${s.slice(-4)}` : "—";
const fmtAgo = (ms) => {
  if (!ms) return "—";
  const d = Date.now() - (typeof ms === "string" ? new Date(ms).getTime() : Number(ms));
  if (d < 5000) return "just now";
  if (d < 60000) return `${Math.floor(d/1000)}s ago`;
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return `${Math.floor(d/86400000)}d ago`;
};
const fmtFull = (ms) => {
  if (!ms) return "—";
  return new Date(typeof ms === "string" ? ms : Number(ms))
    .toLocaleString("en-US", { month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
};

const EVENT_LABELS = {
  post_created:"Post Published", post_deleted:"Post Removed", reel_created:"Reel Published",
  story_created:"Story Published", story_unlocked:"Story Unlocked", post_liked:"Post Liked",
  post_unliked:"Post Unliked", comment_added:"Comment Added", comment_deleted:"Comment Deleted",
  content_shared:"Content Shared", token_transfer:"Token Transfer", wallet_deposit:"Wallet Deposit",
  wallet_withdrawal:"Wallet Withdrawal", account_created:"Account Created", profile_updated:"Profile Updated",
  follow_added:"User Followed", follow_removed:"Unfollowed", role_assigned:"Role Assigned",
  staking_started:"Staking Started", staking_withdrawn:"Stake Withdrawn",
};
const EVENT_ICONS = {
  post_created:"📝", post_deleted:"🗑", reel_created:"🎬", story_created:"📖",
  story_unlocked:"🔓", post_liked:"❤️", comment_added:"💬", content_shared:"↗️",
  token_transfer:"💸", wallet_deposit:"⬆️", wallet_withdrawal:"⬇️", account_created:"👤",
  profile_updated:"✏️", role_assigned:"🔐", staking_started:"🔒", follow_added:"➕",
};
const humanEvent = (p) => EVENT_LABELS[p?.event] || (p?.event?.replace(/_/g," ") || "Event");
const eventIcon  = (p) => EVENT_ICONS[p?.event] || "◎";

const CopyBtn = ({ text }) => {
  const [c, setC] = useState(false);
  return (
    <button className="xo3-cp" onClick={e => {
      e.stopPropagation();
      navigator.clipboard?.writeText(text).then(() => { setC(true); setTimeout(() => setC(false), 1400); });
    }}>
      {c ? <Check size={10} color="#84cc16"/> : <Copy size={10}/>}
    </button>
  );
};

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Syne:wght@400;600;700;800;900&display=swap');

@keyframes xo3-fi   { from{opacity:0}to{opacity:1} }
@keyframes xo3-su   { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none} }
@keyframes xo3-sl   { from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none} }
@keyframes xo3-pop  { 0%{opacity:0;transform:scale(.88) translateY(8px)}100%{opacity:1;transform:none} }
@keyframes xo3-spin { to{transform:rotate(360deg)} }
@keyframes xo3-pls  { 0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.9);opacity:0} }
@keyframes xo3-glw  { 0%,100%{opacity:.5}50%{opacity:1} }
@keyframes xo3-scan { 0%{top:-40%}100%{top:130%} }
@keyframes xo3-flow { 0%{transform:translateY(-100%)}100%{transform:translateY(200%)} }
@keyframes xo3-orb1 { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
@keyframes xo3-orb2 { from{transform:rotate(180deg)}to{transform:rotate(-180deg)} }
@keyframes xo3-blink{ 0%,100%{opacity:1}50%{opacity:.15} }
@keyframes xo3-ticker{ 0%{transform:translateX(0)}100%{transform:translateX(-50%)} }
@keyframes xo3-breathe{ 0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.7;transform:scale(1.03)} }
@keyframes xo3-rise { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
@keyframes xo3-shimmer {
  0%{background-position:200% center}
  100%{background-position:-200% center}
}
@keyframes xo3-bar {
  0%{width:0%}100%{width:var(--bw,60%)}
}

* { box-sizing: border-box; }

.xo3-root {
  position: fixed; inset: 0; z-index: 100000;
  background: #020406;
  font-family: 'Syne', sans-serif;
  display: flex; flex-direction: column;
  overflow: hidden; animation: xo3-fi .18s ease;
  color: #e8edf5;
}

/* ── TOPOGRAPHIC BG ── */
.xo3-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
}
.xo3-bg::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 55% 40% at 12% 18%, rgba(132,204,22,.07) 0%, transparent 60%),
    radial-gradient(ellipse 45% 35% at 88% 78%, rgba(34,211,238,.05) 0%, transparent 55%),
    radial-gradient(ellipse 35% 30% at 50% 48%, rgba(245,158,11,.03) 0%, transparent 50%);
}
.xo3-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(132,204,22,.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(132,204,22,.022) 1px, transparent 1px);
  background-size: 52px 52px;
}
.xo3-grid-accent {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(132,204,22,.008) 1px, transparent 1px),
    linear-gradient(90deg, rgba(132,204,22,.008) 1px, transparent 1px);
  background-size: 13px 13px;
}

/* ══════════════════════════════════════════════
   HEADER — MISSION CONTROL BANNER
══════════════════════════════════════════════ */
.xo3-header {
  position: relative; z-index: 10; flex-shrink: 0;
  background: rgba(2,4,6,.98);
  border-bottom: 1px solid rgba(132,204,22,.1);
  overflow: hidden;
}

/* Header atmospheric glow */
.xo3-header::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(132,204,22,.4) 20%,
    rgba(34,211,238,.3) 50%,
    rgba(132,204,22,.4) 80%,
    transparent 100%
  );
}
.xo3-header::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 80% 100% at 50% -10%, rgba(132,204,22,.04), transparent 70%);
  pointer-events: none;
}

/* ── Main header row ── */
.xo3-hdr-main {
  display: flex; align-items: center;
  padding: 0 20px; height: 60px; gap: 0;
  position: relative; z-index: 2;
}

/* ── Left: Identity block ── */
.xo3-identity {
  display: flex; align-items: center; gap: 14px; flex-shrink: 0;
}

.xo3-logo-emblem {
  position: relative; width: 42px; height: 42px; flex-shrink: 0;
}
.xo3-logo-hex {
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(132,204,22,.12) 0%, rgba(34,211,238,.06) 100%);
  border: 1px solid rgba(132,204,22,.25);
  border-radius: 10px;
  position: relative; overflow: hidden;
}
.xo3-logo-hex::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(132,204,22,.07));
  animation: xo3-scan 5s ease-in-out infinite;
}
.xo3-logo-symbol {
  font-size: 18px; z-index: 1; position: relative;
  filter: drop-shadow(0 0 8px rgba(132,204,22,.5));
  animation: xo3-glw 3s ease-in-out infinite;
}
.xo3-logo-ping {
  position: absolute; top: -3px; right: -3px;
  width: 9px; height: 9px; border-radius: 50%;
  background: #84cc16;
  box-shadow: 0 0 8px rgba(132,204,22,.7);
  animation: xo3-blink 2s ease infinite;
}

.xo3-brand {
  display: flex; flex-direction: column; gap: 2px;
}
.xo3-brand-name {
  font-size: 17px; font-weight: 900; letter-spacing: -.4px; line-height: 1;
  background: linear-gradient(90deg, #e8edf5 0%, rgba(132,204,22,.85) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.xo3-brand-sub {
  display: flex; align-items: center; gap: 6px;
}
.xo3-brand-tag {
  font-size: 8px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
  color: rgba(132,204,22,.45); font-family: 'IBM Plex Mono', monospace;
}
.xo3-brand-sep { width: 1px; height: 8px; background: rgba(255,255,255,.1); }
.xo3-brand-ver {
  font-size: 8px; color: rgba(255,255,255,.2);
  font-family: 'IBM Plex Mono', monospace; letter-spacing: .5px;
}

/* ── Center: Chain identity pills ── */
.xo3-chain-badges {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 6px; padding: 0 16px; overflow: hidden;
}
.xo3-chain-badge {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 9px; border-radius: 6px;
  background: rgba(255,255,255,.018);
  border: 1px solid rgba(255,255,255,.055);
  flex-shrink: 0;
}
.xo3-chain-badge-glyph { font-size: 10px; }
.xo3-chain-badge-label {
  font-size: 8.5px; font-weight: 700; letter-spacing: .3px;
  font-family: 'IBM Plex Mono', monospace;
}
.xo3-chain-badge-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: currentColor; opacity: .55;
}

/* ── Right: Controls ── */
.xo3-hdr-controls {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}

/* Live indicator */
.xo3-live-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 7px;
  background: rgba(132,204,22,.06);
  border: 1px solid rgba(132,204,22,.16);
}
.xo3-live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #84cc16;
  box-shadow: 0 0 6px rgba(132,204,22,.6);
  animation: xo3-blink 1.4s ease infinite;
  flex-shrink: 0;
}
.xo3-live-text {
  font-size: 9px; font-weight: 800; color: #84cc16; letter-spacing: 1px; text-transform: uppercase;
  font-family: 'IBM Plex Mono', monospace;
}

/* Stats pills */
.xo3-hdr-stat {
  display: flex; flex-direction: column; align-items: center;
  padding: 4px 10px; border-radius: 7px;
  background: rgba(255,255,255,.022);
  border: 1px solid rgba(255,255,255,.05);
}
.xo3-hdr-stat-n {
  font-size: 13px; font-weight: 800; color: #e8edf5;
  font-family: 'IBM Plex Mono', monospace; line-height: 1;
}
.xo3-hdr-stat-l {
  font-size: 7.5px; color: rgba(132,204,22,.38); text-transform: uppercase;
  letter-spacing: .7px; margin-top: 2px;
}

.xo3-icon-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.022);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: rgba(255,255,255,.28);
  transition: all .14s; flex-shrink: 0;
}
.xo3-icon-btn:hover { background: rgba(255,255,255,.07); color: #e8edf5; border-color: rgba(255,255,255,.14); }

/* ── Stream ticker (scrolling strip below main hdr row) ── */
.xo3-stream-strip {
  height: 28px; overflow: hidden; position: relative;
  border-top: 1px solid rgba(255,255,255,.03);
  display: flex; align-items: center;
  background: rgba(0,0,0,.35);
}
.xo3-stream-strip::before,
.xo3-stream-strip::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 50px; z-index: 2; pointer-events: none;
}
.xo3-stream-strip::before { left: 0; background: linear-gradient(90deg, rgba(2,4,6,1), transparent); }
.xo3-stream-strip::after  { right: 0; background: linear-gradient(-90deg, rgba(2,4,6,1), transparent); }
.xo3-stream-label {
  flex-shrink: 0; padding: 0 14px 0 18px;
  font-size: 8px; font-weight: 700; color: rgba(132,204,22,.3);
  letter-spacing: 1.4px; text-transform: uppercase; font-family: 'IBM Plex Mono', monospace;
  border-right: 1px solid rgba(255,255,255,.04); z-index: 3; background: rgba(2,4,6,.98);
  white-space: nowrap;
}
.xo3-ticker-wrap { flex: 1; overflow: hidden; }
.xo3-ticker-inner {
  display: flex; width: max-content;
  animation: xo3-ticker 28s linear infinite;
  will-change: transform;
}
.xo3-ticker-inner:hover { animation-play-state: paused; }
.xo3-ticker-item {
  display: flex; align-items: center; gap: 5px;
  padding: 0 16px; white-space: nowrap; cursor: pointer;
  transition: opacity .15s;
}
.xo3-ticker-item:hover { opacity: .75; }
.xo3-ticker-glyph { font-size: 9px; }
.xo3-ticker-name { font-size: 9px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
.xo3-ticker-ev { font-size: 8.5px; color: rgba(255,255,255,.3); }
.xo3-ticker-sep { color: rgba(255,255,255,.08); font-size: 10px; padding: 0 4px; }

/* ── Back button (inside header, replaces identity on mobile) ── */
.xo3-back-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px; border: 1px solid rgba(255,255,255,.07);
  border-radius: 8px; background: transparent;
  color: rgba(255,255,255,.38); font-size: 11px; font-weight: 700;
  cursor: pointer; transition: all .14s;
  font-family: 'Syne', sans-serif; flex-shrink: 0;
}
.xo3-back-btn:hover { color: #e8edf5; border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.04); }

/* ══════════════════════════════════════════════
   SEARCH COMMAND BAR — Floating below header
══════════════════════════════════════════════ */
.xo3-search-zone {
  position: relative; z-index: 9; flex-shrink: 0;
  padding: 14px 20px 12px;
  background: rgba(2,4,6,.88);
  border-bottom: 1px solid rgba(255,255,255,.04);
  backdrop-filter: blur(20px);
}

/* Subtle gradient above search */
.xo3-search-zone::before {
  content: '';
  position: absolute; top: 0; left: 20px; right: 20px; height: 1px;
  background: linear-gradient(90deg,
    transparent,
    rgba(132,204,22,.12) 30%,
    rgba(34,211,238,.09) 70%,
    transparent
  );
}

.xo3-search-row {
  display: flex; align-items: center; gap: 10px;
}

/* Terminal-style search */
.xo3-search-terminal {
  flex: 1; display: flex; align-items: center; gap: 0;
  background: rgba(0,0,0,.55);
  border: 1px solid rgba(132,204,22,.12);
  border-radius: 11px;
  overflow: hidden; position: relative;
  transition: border-color .2s, box-shadow .2s;
  min-width: 0;
}
.xo3-search-terminal.focused {
  border-color: rgba(132,204,22,.38);
  box-shadow: 0 0 0 3px rgba(132,204,22,.07), 0 4px 24px rgba(0,0,0,.4);
}
.xo3-search-prefix {
  display: flex; align-items: center; gap: 7px;
  padding: 0 12px 0 14px; flex-shrink: 0;
  border-right: 1px solid rgba(132,204,22,.1);
  height: 42px;
  background: rgba(132,204,22,.04);
}
.xo3-search-prefix-label {
  font-size: 10px; font-weight: 700; color: rgba(132,204,22,.5);
  font-family: 'IBM Plex Mono', monospace; letter-spacing: .4px;
  white-space: nowrap;
}
.xo3-search-prompt {
  font-size: 13px; color: rgba(132,204,22,.55); font-family: 'IBM Plex Mono', monospace;
  animation: xo3-blink 1s ease infinite; flex-shrink: 0; margin-left: 11px;
}
.xo3-search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #d4dce8; font-size: 13px;
  font-family: 'IBM Plex Mono', monospace; letter-spacing: .1px;
  caret-color: #84cc16; padding: 0 8px 0 0; height: 42px;
  min-width: 0;
}
.xo3-search-input::placeholder { color: rgba(255,255,255,.18); font-size: 12px; }
.xo3-search-clear {
  background: transparent; border: none; cursor: pointer;
  color: rgba(255,255,255,.2); padding: 0 10px; display: flex;
  align-items: center; height: 42px; transition: color .12s; flex-shrink: 0;
}
.xo3-search-clear:hover { color: rgba(255,255,255,.55); }

/* Search hints */
.xo3-search-hints {
  display: flex; align-items: center; gap: 6px; margin-top: 9px; flex-wrap: wrap;
}
.xo3-search-hint-label {
  font-size: 8.5px; color: rgba(255,255,255,.18);
  font-family: 'IBM Plex Mono', monospace; letter-spacing: .4px; flex-shrink: 0;
}
.xo3-search-hint {
  padding: 3px 9px; border-radius: 5px;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
  font-size: 9px; color: rgba(255,255,255,.3);
  font-family: 'IBM Plex Mono', monospace; cursor: pointer;
  transition: all .14s; white-space: nowrap;
}
.xo3-search-hint:hover {
  border-color: rgba(132,204,22,.25); color: #84cc16;
  background: rgba(132,204,22,.04);
}

/* Search CTA button */
.xo3-search-cta {
  padding: 0 20px; height: 42px; border-radius: 10px;
  background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
  border: none; color: #0a0d06;
  font-size: 12px; font-weight: 900; cursor: pointer;
  font-family: 'Syne', sans-serif; letter-spacing: .4px;
  display: flex; align-items: center; gap: 7px; flex-shrink: 0;
  transition: all .16s;
  box-shadow: 0 4px 16px rgba(132,204,22,.2);
  white-space: nowrap;
}
.xo3-search-cta:hover:not(:disabled) {
  background: linear-gradient(135deg, #a3e635 0%, #84cc16 100%);
  box-shadow: 0 6px 22px rgba(132,204,22,.35);
  transform: translateY(-1px);
}
.xo3-search-cta:disabled { opacity: .4; cursor: not-allowed; transform: none; box-shadow: none; }
.xo3-spin { animation: xo3-spin .75s linear infinite; }

/* ── STAGE ── */
.xo3-stage {
  flex: 1; position: relative; z-index: 1;
  overflow: hidden; display: flex; flex-direction: column;
}

/* ═══════════ IDLE ═══════════ */
.xo3-idle {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column;
  align-items: center; padding: 28px 20px 36px;
  scrollbar-width: thin; scrollbar-color: rgba(132,204,22,.1) transparent;
}
.xo3-idle::-webkit-scrollbar { width: 3px; }
.xo3-idle::-webkit-scrollbar-thumb { background: rgba(132,204,22,.1); border-radius: 2px; }

/* Hero */
.xo3-hero { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
.xo3-hero-orb {
  position: relative; width: 90px; height: 90px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 22px;
}
.xo3-hero-core {
  font-size: 32px; z-index: 3; position: relative;
  animation: xo3-glw 3s ease-in-out infinite;
  filter: drop-shadow(0 0 18px rgba(132,204,22,.5));
}
.xo3-hero-ring {
  position: absolute; border-radius: 50%; border: 1px solid;
}
.xo3-hero-ring-1 { inset: -10px;  border-color: rgba(132,204,22,.15); animation: xo3-orb1 16s linear infinite; }
.xo3-hero-ring-2 { inset: -23px; border-color: rgba(34,211,238,.09); animation: xo3-orb2 26s linear infinite; }
.xo3-hero-ring-3 { inset: -38px; border-color: rgba(245,158,11,.06); animation: xo3-orb1 40s linear infinite reverse; }

.xo3-hero-title {
  font-size: clamp(24px, 4vw, 32px); font-weight: 900; letter-spacing: -.6px;
  color: #e8edf5; text-align: center; margin: 0 0 10px; line-height: 1.12;
}
.xo3-hero-title em { color: #84cc16; font-style: normal; }
.xo3-hero-desc {
  font-size: 12px; color: rgba(255,255,255,.3); text-align: center;
  line-height: 1.8; margin: 0; font-family: 'IBM Plex Mono', monospace;
  max-width: 440px;
}

/* Quick chips */
.xo3-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 26px; max-width: 540px; }
.xo3-chip {
  padding: 6px 13px; border-radius: 20px;
  background: rgba(255,255,255,.022); border: 1px solid rgba(255,255,255,.06);
  font-size: 11px; color: rgba(255,255,255,.38); cursor: pointer;
  transition: all .15s; font-family: 'IBM Plex Mono', monospace; letter-spacing: .2px;
}
.xo3-chip:hover {
  border-color: rgba(132,204,22,.3); color: #84cc16;
  background: rgba(132,204,22,.05); transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(132,204,22,.12);
}

/* Stats bar */
.xo3-stats {
  display: flex; align-items: stretch;
  background: rgba(255,255,255,.016); border: 1px solid rgba(255,255,255,.05);
  border-radius: 12px; overflow: hidden; margin-bottom: 28px;
}
.xo3-stat-item { display: flex; flex-direction: column; align-items: center; padding: 12px 22px; }
.xo3-stat-sep { width: 1px; background: rgba(255,255,255,.05); }
.xo3-stat-n { font-size: 20px; font-weight: 900; color: #e8edf5; font-family: 'IBM Plex Mono', monospace; line-height: 1; }
.xo3-stat-l { font-size: 9px; color: rgba(132,204,22,.38); text-transform: uppercase; letter-spacing: .6px; margin-top: 4px; }

/* Live feed */
.xo3-feed { width: 100%; max-width: 700px; }
.xo3-feed-title {
  font-size: 9px; font-weight: 700; color: rgba(132,204,22,.38);
  text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 11px;
  display: flex; align-items: center; gap: 8px;
}
.xo3-feed-dot { width: 5px; height: 5px; border-radius: 50%; background: #84cc16; animation: xo3-blink 1.6s ease infinite; }
.xo3-feed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 7px; }
.xo3-feed-item {
  padding: 11px 13px; border-radius: 10px;
  background: var(--fd, rgba(132,204,22,.03));
  border: 1px solid rgba(255,255,255,.042);
  cursor: pointer; transition: all .17s;
  display: flex; flex-direction: column; gap: 4px;
  animation: xo3-rise .3s ease both;
}
.xo3-feed-item:hover {
  border-color: color-mix(in srgb, var(--fc,#84cc16) 28%, transparent);
  transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,.3);
}
.xo3-feed-stream { font-size: 9.5px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
.xo3-feed-ev { font-size: 11.5px; color: rgba(255,255,255,.75); font-weight: 700; }
.xo3-feed-time { font-size: 9px; color: rgba(255,255,255,.22); font-family: 'IBM Plex Mono', monospace; }

/* Error */
.xo3-error {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px;
  background: rgba(244,63,94,.05); border: 1px solid rgba(244,63,94,.18);
  border-radius: 10px; font-size: 12px; color: rgba(244,63,94,.9);
  line-height: 1.6; max-width: 520px; font-family: 'IBM Plex Mono', monospace;
  margin-bottom: 18px;
}

/* ═══════════ SEARCHING ═══════════ */
.xo3-searching {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 16px;
}
.xo3-searching-ring {
  width: 60px; height: 60px; border-radius: 50%;
  border: 2px solid rgba(132,204,22,.1);
  border-top: 2px solid #84cc16;
  animation: xo3-spin .7s linear infinite;
}
.xo3-searching-txt { font-size: 13px; color: rgba(255,255,255,.32); }
.xo3-searching-q {
  font-size: 12px; color: rgba(132,204,22,.5);
  font-family: 'IBM Plex Mono', monospace;
  animation: xo3-blink 1.5s ease infinite;
}

/* ═══════════ NETWORK VIEW ═══════════ */
.xo3-net { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.xo3-net-canvas {
  flex: 1; overflow: auto; display: flex; align-items: flex-start;
  justify-content: center; padding: 24px 18px; position: relative;
}
.xo3-net-canvas::-webkit-scrollbar { width: 4px; height: 4px; }
.xo3-net-canvas::-webkit-scrollbar-thumb { background: rgba(132,204,22,.1); border-radius: 2px; }

.xo3-net-loading {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px;
  background: rgba(2,4,6,.88); backdrop-filter: blur(12px);
}
.xo3-net-ltxt { font-size: 12px; color: rgba(255,255,255,.36); }

/* Constellation */
.xo3-constellation {
  display: flex; flex-direction: column; align-items: center;
  animation: xo3-pop .3s cubic-bezier(.34,1.12,.64,1);
  min-width: 280px; width: 100%; max-width: 800px;
}
.xo3-const-top    { display: flex; flex-direction: column; align-items: center; }
.xo3-const-bot    { display: flex; flex-direction: column; align-items: center; }
.xo3-const-mid    { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; width: 100%; }
.xo3-const-ctr    { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.xo3-const-side   { display: flex; flex-direction: column; align-items: center; gap: 0; min-width: 0; max-width: 168px; }
.xo3-clabel       { font-size: 8px; font-weight: 700; color: rgba(255,255,255,.17); text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 7px; }
.xo3-const-empty  { padding: 36px 20px; text-align: center; font-size: 12px; color: rgba(255,255,255,.2); font-family: 'IBM Plex Mono', monospace; line-height: 1.8; }

/* ── NODE CARDS ── */
.xo3-node {
  position: relative; cursor: pointer; width: 166px;
  padding: 13px 12px; border-radius: 14px;
  background: rgba(255,255,255,.014);
  border: 1px solid color-mix(in srgb,var(--c,#84cc16) 14%,transparent);
  transition: all .22s cubic-bezier(.34,1.4,.64,1);
  animation: xo3-pop .28s cubic-bezier(.34,1.2,.64,1) both;
  backdrop-filter: blur(6px); flex-shrink: 0;
  display: flex; flex-direction: column; gap: 5px;
}
.xo3-node:hover {
  transform: translateY(-7px) scale(1.05);
  border-color: var(--c,#84cc16);
  box-shadow: 0 12px 36px var(--g,rgba(132,204,22,.28)), inset 0 1px 0 rgba(255,255,255,.06);
  background: var(--d,rgba(132,204,22,.05));
}
.xo3-node--center {
  width: 200px; padding: 16px 14px;
  background: var(--d,rgba(132,204,22,.05));
  border-color: var(--c,#84cc16);
  box-shadow: 0 0 44px var(--g,rgba(132,204,22,.22));
}
.xo3-node--compact { width: 146px; padding: 10px 10px; }
.xo3-node-glow {
  position: absolute; inset: -1px; border-radius: 14px; pointer-events: none;
  background: radial-gradient(circle at 22% 22%, color-mix(in srgb,var(--c,#84cc16) 8%,transparent), transparent 55%);
}
.xo3-node-badge { font-size: 8.5px; font-weight: 700; color: var(--c,#84cc16); font-family: 'IBM Plex Mono', monospace; letter-spacing: .4px; }
.xo3-node-glyph { font-size: 21px; line-height: 1; color: var(--c,#84cc16); filter: drop-shadow(0 0 7px var(--g,rgba(132,204,22,.5))); }
.xo3-node--center .xo3-node-glyph { font-size: 27px; }
.xo3-node--compact .xo3-node-glyph { font-size: 15px; }
.xo3-node-ev { display: flex; align-items: flex-start; gap: 5px; }
.xo3-node-em { font-size: 11px; flex-shrink: 0; margin-top: 1px; }
.xo3-node-name { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.82); line-height: 1.3; }
.xo3-node--center .xo3-node-name { font-size: 13px; }
.xo3-node--compact .xo3-node-name { font-size: 10px; }
.xo3-node-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 1px; }
.xo3-node-time { display: flex; align-items: center; gap: 3px; font-size: 9px; color: rgba(255,255,255,.25); font-family: 'IBM Plex Mono', monospace; }
.xo3-node-hash { font-size: 8px; color: rgba(255,255,255,.18); font-family: 'IBM Plex Mono', monospace; }
.xo3-node-pulse { position: absolute; inset: -10px; border-radius: 24px; border: 1px solid var(--c,#84cc16); pointer-events: none; animation: xo3-pls 2.4s ease-out infinite; }
.xo3-node-pulse-b { inset: -22px; border-radius: 36px; animation-delay: .9s; opacity: .35; }

/* Connector lines */
.xo3-conn { display: flex; align-items: center; justify-content: center; flex-shrink: 0; height: 26px; width: 2px; position: relative; }
.xo3-conn-line { position: absolute; width: 2px; height: 100%; background: linear-gradient(180deg,var(--c,#84cc16),transparent); opacity: .2; border-radius: 1px; }
.xo3-conn-flow { position: absolute; width: 2px; height: 50%; overflow: hidden; }
.xo3-conn-flow::after { content: ''; display: block; width: 100%; height: 100%; background: linear-gradient(180deg,transparent,var(--c,#84cc16),transparent); animation: xo3-flow 1.3s ease infinite; opacity: .55; }

/* ── DETAIL PANEL ── */
.xo3-detail {
  position: absolute; right: 0; top: 0; bottom: 0; width: 292px;
  background: rgba(2,4,8,.97); backdrop-filter: blur(28px);
  border-left: 1px solid rgba(255,255,255,.06);
  padding: 16px; overflow-y: auto; z-index: 20;
  display: flex; flex-direction: column; gap: 10px;
  animation: xo3-sl .2s ease;
}
.xo3-detail::-webkit-scrollbar { width: 3px; }
.xo3-detail::-webkit-scrollbar-thumb { background: rgba(132,204,22,.1); border-radius: 2px; }
.xo3-detail-hdr { display: flex; align-items: flex-start; justify-content: space-between; }
.xo3-detail-stream { display: flex; align-items: center; gap: 8px; }
.xo3-detail-glyph { font-size: 20px; }
.xo3-detail-sname { font-size: 13px; font-weight: 800; color: var(--c,#84cc16); }
.xo3-detail-stype { font-size: 9px; color: rgba(255,255,255,.26); font-family: 'IBM Plex Mono', monospace; }
.xo3-detail-acts { display: flex; gap: 4px; }
.xo3-detail-btn { width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); color: rgba(255,255,255,.3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .13s; }
.xo3-detail-btn:hover { color: #fff; background: rgba(255,255,255,.08); }
.xo3-detail-event { font-size: 14px; font-weight: 800; color: #e8edf5; display: flex; align-items: center; gap: 8px; line-height: 1.3; }
.xo3-detail-ei { font-size: 18px; flex-shrink: 0; }
.xo3-detail-time { font-size: 9.5px; color: rgba(255,255,255,.22); font-family: 'IBM Plex Mono', monospace; }
.xo3-detail-divider { height: 1px; background: rgba(255,255,255,.04); }
.xo3-detail-rows { display: flex; flex-direction: column; gap: 2px; }
.xo3-detail-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,.032); font-size: 10.5px; }
.xo3-detail-row:last-child { border-bottom: none; }
.xo3-detail-rl { color: rgba(255,255,255,.26); flex-shrink: 0; margin-right: 8px; }
.xo3-detail-rv { display: flex; align-items: center; gap: 4px; min-width: 0; }
.xo3-detail-rv code { color: var(--c,#84cc16); font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; }
.xo3-cp { background: transparent; border: none; color: rgba(255,255,255,.2); cursor: pointer; padding: 2px; display: flex; transition: color .12s; flex-shrink: 0; }
.xo3-cp:hover { color: #84cc16; }
.xo3-detail-payload {}
.xo3-detail-ptitle { font-size: 8.5px; font-weight: 700; color: rgba(255,255,255,.2); text-transform: uppercase; letter-spacing: .7px; margin-bottom: 7px; }
.xo3-detail-kv { display: flex; flex-direction: column; gap: 2px; background: rgba(255,255,255,.016); border: 1px solid rgba(255,255,255,.04); border-radius: 6px; padding: 5px 8px; margin-bottom: 4px; }
.xo3-detail-kk { font-size: 9px; font-weight: 700; color: var(--c,#84cc16); text-transform: uppercase; letter-spacing: .3px; }
.xo3-detail-kv-v { font-size: 10.5px; color: rgba(255,255,255,.68); word-break: break-all; font-family: 'IBM Plex Mono', monospace; }
.xo3-detail-footer { display: flex; gap: 6px; margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.04); }
.xo3-detail-action { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px; border: 1px solid rgba(255,255,255,.07); border-radius: 8px; background: rgba(255,255,255,.022); color: rgba(255,255,255,.5); font-size: 11px; font-weight: 700; cursor: pointer; transition: all .14s; font-family: 'Syne', sans-serif; }
.xo3-detail-action:hover { background: rgba(255,255,255,.06); color: #e8edf5; }
.xo3-detail-action--hi { background: rgba(132,204,22,.06); border-color: rgba(132,204,22,.2); color: #84cc16; }
.xo3-detail-action--hi:hover { background: rgba(132,204,22,.13); }

/* ── CHAIN THREAD ── */
.xo3-thread { flex-shrink: 0; padding: 10px 18px 13px; background: rgba(0,0,0,.7); backdrop-filter: blur(14px); border-top: 1px solid rgba(132,204,22,.05); }
.xo3-thread-label { font-size: 8.5px; font-weight: 700; color: rgba(132,204,22,.32); text-transform: uppercase; letter-spacing: 1.1px; margin-bottom: 9px; display: flex; align-items: center; gap: 7px; }
.xo3-thread-track { display: flex; align-items: center; overflow-x: auto; padding: 2px 0 7px; scrollbar-width: thin; scrollbar-color: rgba(132,204,22,.1) transparent; position: relative; }
.xo3-thread-track::-webkit-scrollbar { height: 3px; }
.xo3-thread-track::-webkit-scrollbar-thumb { background: rgba(132,204,22,.1); border-radius: 2px; }
.xo3-thread-rail { position: absolute; top: 7px; left: 0; right: 0; height: 1px; background: rgba(132,204,22,.06); pointer-events: none; }
.xo3-thread-seg { width: 18px; height: 1px; flex-shrink: 0; background: linear-gradient(90deg, color-mix(in srgb,var(--c,#84cc16) 22%,transparent), color-mix(in srgb,var(--c,#84cc16) 6%,transparent)); }
.xo3-thread-node { position: relative; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; cursor: pointer; padding: 0 2px; gap: 5px; }
.xo3-thread-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c,#84cc16); box-shadow: 0 0 6px var(--g,rgba(132,204,22,.35)); transition: transform .13s; flex-shrink: 0; }
.xo3-thread-node:hover .xo3-thread-dot { transform: scale(1.65); }
.xo3-thread-node--c .xo3-thread-dot { width: 14px; height: 14px; }
.xo3-thread-ring { position: absolute; top: -5px; left: 50%; transform: translateX(-50%); width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--c,#84cc16); animation: xo3-pls 1.7s ease-out infinite; pointer-events: none; }
.xo3-thread-tip { font-size: 8.5px; color: rgba(255,255,255,.24); white-space: nowrap; max-width: 70px; overflow: hidden; text-overflow: ellipsis; text-align: center; line-height: 1.2; }
.xo3-thread-node--c .xo3-thread-tip { color: rgba(132,204,22,.6); font-weight: 700; }

/* ═══════════ TRACE VIEW ═══════════ */
.xo3-trace { flex: 1; overflow-y: auto; padding: 20px 20px 30px; animation: xo3-su .22s ease; }
.xo3-trace::-webkit-scrollbar { width: 3px; }
.xo3-trace::-webkit-scrollbar-thumb { background: rgba(132,204,22,.1); border-radius: 2px; }
.xo3-trace-hdr { font-size: 10px; color: rgba(255,255,255,.22); font-family: 'IBM Plex Mono', monospace; margin-bottom: 20px; line-height: 1.6; }
.xo3-trace-item { display: flex; gap: 12px; }
.xo3-trace-left { display: flex; flex-direction: column; align-items: center; width: 14px; flex-shrink: 0; padding-top: 3px; }
.xo3-trace-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; background: var(--g,rgba(132,204,22,.28)); border: 2px solid var(--c,#84cc16); box-shadow: 0 0 6px var(--g,rgba(132,204,22,.28)); }
.xo3-trace-line { width: 2px; flex: 1; min-height: 14px; background: linear-gradient(180deg,rgba(132,204,22,.15),rgba(132,204,22,.03)); margin: 3px 0; }
.xo3-trace-block { flex: 1; padding: 10px 12px; border-radius: 9px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,.042); border-left: 3px solid var(--c,#84cc16); background: rgba(255,255,255,.013); cursor: pointer; transition: all .14s; }
.xo3-trace-block:hover { background: rgba(255,255,255,.03); }
.xo3-trace-btop { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.xo3-trace-bstream { font-size: 10.5px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
.xo3-trace-bdepth  { font-size: 9px; color: rgba(255,255,255,.17); margin-left: auto; }
.xo3-trace-bevent  { font-size: 12px; font-weight: 700; color: rgba(255,255,255,.82); margin-bottom: 4px; }
.xo3-trace-bhash   { font-size: 9px; color: rgba(255,255,255,.2); font-family: 'IBM Plex Mono', monospace; margin-bottom: 3px; }
.xo3-trace-btime   { font-size: 9px; color: rgba(255,255,255,.17); font-family: 'IBM Plex Mono', monospace; }
.xo3-trace-loading { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: rgba(255,255,255,.3); font-size: 12px; }
.xo3-trace-genesis { display: flex; flex-direction: column; align-items: flex-start; padding-left: 17px; margin-top: 4px; gap: 7px; }
.xo3-trace-gline   { width: 2px; height: 18px; background: rgba(132,204,22,.07); margin-left: -4px; }
.xo3-trace-gbadge  { padding: 7px 15px; background: rgba(168,85,247,.06); border: 1px solid rgba(168,85,247,.16); border-radius: 7px; font-size: 11px; font-weight: 700; color: #a855f7; font-family: 'IBM Plex Mono', monospace; }

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  /* Hide chain badge pills on smaller desktop */
  .xo3-chain-badges { display: none; }
  .xo3-hdr-stat { display: none; }
}

@media (max-width: 768px) {
  /* Header becomes more compact */
  .xo3-hdr-main { height: 52px; padding: 0 14px; }
  .xo3-brand-name { font-size: 15px; }
  .xo3-brand-sub { display: none; }
  .xo3-logo-hex { width: 36px; height: 36px; border-radius: 9px; }
  .xo3-logo-symbol { font-size: 15px; }
  .xo3-identity { gap: 10px; }
  .xo3-live-text { display: none; }
  .xo3-live-badge { padding: 5px 7px; }

  /* Search zone adjusts */
  .xo3-search-zone { padding: 10px 14px 10px; }
  .xo3-search-prefix { display: none; }
  .xo3-search-prompt { display: none; }
  .xo3-search-input { padding-left: 14px; }
  .xo3-search-cta { padding: 0 15px; font-size: 11px; }
  .xo3-search-cta span { display: none; }
  .xo3-search-hints { display: none; }

  /* Stream strip shorter on mobile */
  .xo3-stream-strip { height: 24px; }
  .xo3-stream-label { padding: 0 10px 0 14px; font-size: 7.5px; }

  /* Network */
  .xo3-const-mid { flex-direction: column; align-items: center; }
  .xo3-const-side { flex-direction: row; flex-wrap: wrap; justify-content: center; max-width: unset; }
  .xo3-node { width: 150px; }
  .xo3-node--center { width: 180px; }
  .xo3-node--compact { width: 132px; }

  /* Detail panel slides up from bottom */
  .xo3-detail {
    position: fixed; inset: auto 0 0 0; width: 100%; height: 56vh;
    border-left: none; border-top: 1px solid rgba(132,204,22,.12);
    border-radius: 18px 18px 0 0;
  }

  .xo3-idle { padding: 18px 14px 28px; }
  .xo3-feed-grid { grid-template-columns: repeat(2, 1fr); }
  .xo3-stat-item { padding: 10px 14px; }
  .xo3-stat-n { font-size: 17px; }
}

@media (max-width: 480px) {
  .xo3-brand-name { font-size: 14px; }
  .xo3-logo-emblem { display: none; }
  .xo3-chain-badges { display: none; }
  .xo3-search-cta { padding: 0 12px; }
  .xo3-feed-grid { grid-template-columns: 1fr 1fr; gap: 5px; }
  .xo3-chips { gap: 5px; }
  .xo3-chip { font-size: 10px; padding: 5px 10px; }
}
`;

// ── Node Card ──────────────────────────────────────────────────────────────
const NodeCard = React.forwardRef(({ record, role, onClick, delay = 0, compact = false }, ref) => {
  const s = sv(record?.stream_type);
  if (!record) return null;
  const roleLabels = { prev:"← Precedes", next:"Follows →", actor:"Same Actor", related:"Linked" };
  return (
    <div
      ref={ref}
      className={`xo3-node xo3-node--${role}${compact ? " xo3-node--compact" : ""}`}
      style={{ "--c": s.color, "--g": s.glow, "--d": s.dim, animationDelay: `${delay}ms` }}
      onClick={() => onClick?.(record)}
    >
      <div className="xo3-node-glow"/>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span className="xo3-node-badge">{record.stream_type}</span>
        {role !== "center" && <span style={{fontSize:7,fontWeight:800,color:"rgba(255,255,255,.22)",letterSpacing:".4px",textTransform:"uppercase"}}>{roleLabels[role]}</span>}
      </div>
      <div className="xo3-node-glyph">{s.glyph}</div>
      <div className="xo3-node-ev">
        <span className="xo3-node-em">{eventIcon(record.payload)}</span>
        <span className="xo3-node-name">{humanEvent(record.payload)}</span>
      </div>
      <div className="xo3-node-meta">
        <span className="xo3-node-time"><Clock size={8}/> {fmtAgo(record.timestamp)}</span>
        <span className="xo3-node-hash">{trunc(record.record_hash, 6)}</span>
      </div>
      {role === "center" && <>
        <div className="xo3-node-pulse"/>
        <div className="xo3-node-pulse xo3-node-pulse-b"/>
      </>}
    </div>
  );
});

const Conn = ({ color = "#84cc16" }) => (
  <div className="xo3-conn" style={{ "--c": color }}>
    <div className="xo3-conn-line"/>
    <div className="xo3-conn-flow"/>
  </div>
);

// ── Chain Thread ──────────────────────────────────────────────────────────
const ChainThread = ({ chain, centerIdx, onSelect }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || centerIdx < 0) return;
    const nodes = ref.current.querySelectorAll(".xo3-thread-node");
    nodes[centerIdx]?.scrollIntoView({ behavior:"smooth", block:"nearest", inline:"center" });
  }, [centerIdx]);
  if (!chain || chain.length < 2) return null;
  return (
    <div className="xo3-thread">
      <div className="xo3-thread-label"><Link2 size={9}/> Chain Thread · {chain.length} Records · Click to navigate</div>
      <div className="xo3-thread-track" ref={ref}>
        <div className="xo3-thread-rail"/>
        {chain.map((rec, i) => {
          const s = sv(rec.stream_type);
          const isC = i === centerIdx;
          return (
            <React.Fragment key={rec.record_id}>
              {i > 0 && <div className="xo3-thread-seg" style={{ "--c": s.color }}/>}
              <div className={`xo3-thread-node${isC ? " xo3-thread-node--c" : ""}`}
                style={{ "--c": s.color, "--g": s.glow }} onClick={() => onSelect(rec)}>
                <div className="xo3-thread-dot"/>
                {isC && <div className="xo3-thread-ring"/>}
                <div className="xo3-thread-tip">{humanEvent(rec.payload)}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────
const DetailPanel = ({ record, onClose, onExpand, onTrace }) => {
  if (!record) return null;
  const s = sv(record.stream_type);
  const data = Object.entries(record.payload || {}).filter(([k]) => k !== "event");
  return (
    <div className="xo3-detail" style={{ "--c": s.color, "--g": s.glow, "--d": s.dim }}>
      <div className="xo3-detail-hdr">
        <div className="xo3-detail-stream">
          <span className="xo3-detail-glyph">{s.glyph}</span>
          <div>
            <div className="xo3-detail-sname">{s.label}</div>
            <div className="xo3-detail-stype">{record.stream_type}</div>
          </div>
        </div>
        <div className="xo3-detail-acts">
          <button className="xo3-detail-btn" onClick={() => onExpand(record)}><Layers size={11}/></button>
          <button className="xo3-detail-btn" onClick={onClose}><X size={11}/></button>
        </div>
      </div>
      <div className="xo3-detail-event">
        <span className="xo3-detail-ei">{eventIcon(record.payload)}</span>
        {humanEvent(record.payload)}
      </div>
      <div className="xo3-detail-time">{fmtFull(record.timestamp)}</div>
      <div className="xo3-detail-divider"/>
      <div className="xo3-detail-rows">
        {[["Record", record.record_id], ["Actor", record.actor_id], ["Hash", record.record_hash], ["Prev", record.previous_hash]].map(([l, v]) => (
          <div key={l} className="xo3-detail-row">
            <span className="xo3-detail-rl">{l}</span>
            <div className="xo3-detail-rv"><code>{trunc(v, 10)}</code><CopyBtn text={v}/></div>
          </div>
        ))}
      </div>
      {data.length > 0 && (
        <div className="xo3-detail-payload">
          <div className="xo3-detail-ptitle">Event Data</div>
          {data.map(([k, v]) => (
            <div key={k} className="xo3-detail-kv">
              <span className="xo3-detail-kk">{k.replace(/_/g, " ")}</span>
              <span className="xo3-detail-kv-v">{String(v).slice(0, 80)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="xo3-detail-footer">
        <button className="xo3-detail-action" onClick={() => onTrace(record.record_id)}><GitBranch size={11}/> Trace</button>
        <button className="xo3-detail-action xo3-detail-action--hi" onClick={() => onExpand(record)}><Zap size={11}/> Expand</button>
      </div>
    </div>
  );
};

// ── Trace View ────────────────────────────────────────────────────────────
const TraceView = ({ chain, loading, onNodeClick }) => {
  if (loading) return (
    <div className="xo3-trace-loading">
      <Loader size={26} className="xo3-spin" style={{ color:"#84cc16" }}/>
      <span>Tracing chain to genesis…</span>
    </div>
  );
  return (
    <div className="xo3-trace">
      <div className="xo3-trace-hdr">Chain trace · {chain.length} events · walking backwards to the beginning</div>
      {chain.map((rec, i) => {
        const s = sv(rec.stream_type);
        const isLast = i === chain.length - 1;
        return (
          <div key={rec.record_id} className="xo3-trace-item">
            <div className="xo3-trace-left">
              <div className="xo3-trace-dot" style={{ "--c": s.color, "--g": s.glow }}/>
              {!isLast && <div className="xo3-trace-line"/>}
            </div>
            <div className="xo3-trace-block" style={{ "--c": s.color }} onClick={() => onNodeClick(rec)}>
              <div className="xo3-trace-btop">
                <span className="xo3-trace-bstream" style={{ color: s.color }}>{s.glyph} {rec.stream_type}</span>
                <span className="xo3-trace-bdepth">#{rec._depth ?? i}</span>
                {rec._hashValid !== false ? <CheckCircle size={11} color="#84cc16"/> : <AlertTriangle size={11} color="#f87171"/>}
              </div>
              <div className="xo3-trace-bevent">{eventIcon(rec.payload)} {humanEvent(rec.payload)}</div>
              <div className="xo3-trace-bhash">{trunc(rec.record_hash, 14)}</div>
              <div className="xo3-trace-btime">{fmtFull(rec.timestamp)}</div>
            </div>
          </div>
        );
      })}
      {chain.length > 0 && (
        <div className="xo3-trace-genesis">
          <div className="xo3-trace-gline"/>
          <div className="xo3-trace-gbadge">⛓ GENESIS — Origin of This Chain</div>
        </div>
      )}
    </div>
  );
};

// ── Idle View ─────────────────────────────────────────────────────────────
const IdleView = ({ feed, stats, error, onEnterRecord, onQuickSearch }) => {
  const total = stats?.totalRecords ?? stats?.total_records ?? 0;
  const QUICK = [
    "post_created", "token_transfer", "story_unlocked", "wallet_deposit",
    "account_created", "post_liked", "content_shared", "follow_added", "comment_added",
  ];
  return (
    <div className="xo3-idle">
      <div className="xo3-hero">
        <div className="xo3-hero-orb">
          <div className="xo3-hero-core">⛓</div>
          <div className="xo3-hero-ring xo3-hero-ring-1"/>
          <div className="xo3-hero-ring xo3-hero-ring-2"/>
          <div className="xo3-hero-ring xo3-hero-ring-3"/>
        </div>
        <h1 className="xo3-hero-title">Enter <em>the Chain</em></h1>
        <p className="xo3-hero-desc">
          Every action on Xeevia is permanently recorded and linked.<br/>
          Search any record, actor, event — and its entire network unfolds.
        </p>
      </div>

      <div className="xo3-chips">
        {QUICK.map(ev => (
          <button key={ev} className="xo3-chip" onClick={() => onQuickSearch(ev)}>
            {EVENT_ICONS[ev] || "◎"} {EVENT_LABELS[ev] || ev}
          </button>
        ))}
      </div>

      {error && <div className="xo3-error"><AlertTriangle size={13}/>{error}</div>}

      {total > 0 && (
        <div className="xo3-stats">
          <div className="xo3-stat-item">
            <span className="xo3-stat-n">{total.toLocaleString()}</span>
            <span className="xo3-stat-l">Records</span>
          </div>
          <div className="xo3-stat-sep"/>
          <div className="xo3-stat-item">
            <span className="xo3-stat-n">7</span>
            <span className="xo3-stat-l">Streams</span>
          </div>
          <div className="xo3-stat-sep"/>
          <div className="xo3-stat-item">
            <span className="xo3-stat-n" style={{ color:"#84cc16", fontSize:11 }}>● LIVE</span>
            <span className="xo3-stat-l">Status</span>
          </div>
        </div>
      )}

      {feed.length > 0 && (
        <div className="xo3-feed">
          <div className="xo3-feed-title">
            <div className="xo3-feed-dot"/>
            Live Chain Activity
          </div>
          <div className="xo3-feed-grid">
            {feed.slice(0, 9).map(rec => {
              const s = sv(rec.stream_type);
              return (
                <div key={rec.record_id} className="xo3-feed-item"
                  style={{ "--fc": s.color, "--fd": s.dim }} onClick={() => onEnterRecord(rec)}>
                  <span className="xo3-feed-stream" style={{ color: s.color }}>{s.glyph} {rec.stream_type}</span>
                  <span className="xo3-feed-ev">{eventIcon(rec.payload)} {humanEvent(rec.payload)}</span>
                  <span className="xo3-feed-time">{fmtAgo(rec.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Network View ──────────────────────────────────────────────────────────
const NetworkView = ({ centerRecord, network, loading, onNodeClick, onChainSelect, chain, chainCenterIdx, showDetail, selectedNode, onDetailClose, onExpand, onTrace }) => {
  const { prev, next, actorEvents, relatedEvents } = network;
  const cs = sv(centerRecord?.stream_type);
  return (
    <div className="xo3-net">
      {showDetail && selectedNode && (
        <DetailPanel record={selectedNode} onClose={onDetailClose} onExpand={onExpand} onTrace={onTrace}/>
      )}
      <div className="xo3-net-canvas">
        {loading && (
          <div className="xo3-net-loading">
            <Loader size={28} className="xo3-spin" style={{ color: cs.color }}/>
            <div className="xo3-net-ltxt">Building network around this event…</div>
          </div>
        )}
        {!loading && (
          <div className="xo3-constellation">
            {prev && (
              <div className="xo3-const-top">
                <div className="xo3-clabel">Precedes in Chain</div>
                <NodeCard record={prev} role="prev" onClick={onNodeClick} delay={60}/>
                <Conn color={sv(prev.stream_type).color}/>
              </div>
            )}
            <div className="xo3-const-mid">
              {actorEvents.length > 0 && (
                <div className="xo3-const-side">
                  <div className="xo3-clabel">Same Actor</div>
                  {actorEvents.slice(0, 3).map((rec, i) => (
                    <React.Fragment key={rec.record_id}>
                      <NodeCard record={rec} role="actor" onClick={onNodeClick} delay={80+i*50} compact/>
                      {i < Math.min(actorEvents.length, 3)-1 && <Conn color={sv(rec.stream_type).color}/>}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div className="xo3-const-ctr">
                <NodeCard record={centerRecord} role="center" onClick={onNodeClick}/>
              </div>
              {relatedEvents.length > 0 && (
                <div className="xo3-const-side">
                  <div className="xo3-clabel">Linked Events</div>
                  {relatedEvents.slice(0, 3).map((rec, i) => (
                    <React.Fragment key={rec.record_id}>
                      <NodeCard record={rec} role="related" onClick={onNodeClick} delay={100+i*50} compact/>
                      {i < Math.min(relatedEvents.length, 3)-1 && <Conn color={sv(rec.stream_type).color}/>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            {next && (
              <div className="xo3-const-bot">
                <Conn color={sv(next.stream_type).color}/>
                <div className="xo3-clabel">Follows in Chain</div>
                <NodeCard record={next} role="next" onClick={onNodeClick} delay={60}/>
              </div>
            )}
            {!prev && !next && !actorEvents.length && !relatedEvents.length && (
              <div className="xo3-const-empty">
                This event has no discoverable connections yet.<br/>
                It may be the first of its kind in the chain.
              </div>
            )}
          </div>
        )}
      </div>
      <ChainThread chain={chain} centerIdx={chainCenterIdx} onSelect={onChainSelect}/>
    </div>
  );
};

// ── Header Component ──────────────────────────────────────────────────────
const OracleHeader = ({ stats, feed, phase, onBack, onClose, onRefresh, searching }) => {
  const total = stats?.totalRecords ?? stats?.total_records ?? 0;

  // Stream ticker items from feed
  const tickerItems = feed.length > 0 ? [...feed, ...feed] : Object.entries(SV).map(([k, s]) => ({
    stream_type: k, payload: { event: "—" }, _placeholder: true,
  })).concat(Object.entries(SV).map(([k, s]) => ({ stream_type: k, payload: { event: "—" }, _placeholder: true })));

  return (
    <div className="xo3-header">
      {/* ── Main row ── */}
      <div className="xo3-hdr-main">

        {/* Left: identity */}
        <div className="xo3-identity">
          <div className="xo3-logo-emblem">
            <div className="xo3-logo-hex">
              <span className="xo3-logo-symbol">⛓</span>
            </div>
            <div className="xo3-logo-ping"/>
          </div>
          <div className="xo3-brand">
            <div className="xo3-brand-name">XRC Oracle</div>
            <div className="xo3-brand-sub">
              <span className="xo3-brand-tag">Xeevia Record Chain</span>
              <div className="xo3-brand-sep"/>
              <span className="xo3-brand-ver">v3.0</span>
            </div>
          </div>
        </div>

        {/* Center: stream identity badges (desktop) */}
        <div className="xo3-chain-badges">
          {Object.entries(SV).map(([key, s]) => (
            <div key={key} className="xo3-chain-badge" style={{ "--c": s.color }}>
              <span className="xo3-chain-badge-glyph" style={{ color: s.color }}>{s.glyph}</span>
              <span className="xo3-chain-badge-label" style={{ color: s.color }}>{key}</span>
              <div className="xo3-chain-badge-dot" style={{ color: s.color }}/>
            </div>
          ))}
        </div>

        {/* Right: controls */}
        <div className="xo3-hdr-controls">
          {phase !== "idle" && (
            <button className="xo3-back-btn" onClick={onBack}>
              <ArrowLeft size={12}/> Back
            </button>
          )}
          <div className="xo3-live-badge">
            <div className="xo3-live-dot"/>
            <span className="xo3-live-text">Live</span>
          </div>
          {stats && (
            <div className="xo3-hdr-stat">
              <span className="xo3-hdr-stat-n">{total.toLocaleString()}</span>
              <span className="xo3-hdr-stat-l">Records</span>
            </div>
          )}
          <button className="xo3-icon-btn" onClick={onRefresh} title="Refresh"><RefreshCw size={13}/></button>
          <button className="xo3-icon-btn" onClick={onClose}><X size={14}/></button>
        </div>
      </div>

      {/* ── Stream ticker strip ── */}
      <div className="xo3-stream-strip">
        <div className="xo3-stream-label">STREAMS</div>
        <div className="xo3-ticker-wrap">
          <div className="xo3-ticker-inner">
            {tickerItems.map((rec, i) => {
              const s = sv(rec.stream_type);
              return (
                <React.Fragment key={i}>
                  <div className="xo3-ticker-item">
                    <span className="xo3-ticker-glyph" style={{ color: s.color }}>{s.glyph}</span>
                    <span className="xo3-ticker-name" style={{ color: s.color }}>{rec.stream_type}</span>
                    {!rec._placeholder && (
                      <span className="xo3-ticker-ev">{humanEvent(rec.payload)}</span>
                    )}
                  </div>
                  <span className="xo3-ticker-sep">·</span>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Search Zone Component ─────────────────────────────────────────────────
const SearchZone = ({ query, setQuery, onSearch, searching, inputRef }) => {
  const [focused, setFocused] = useState(false);

  const HINTS = [
    { label: "post_created", display: "📝 post_created" },
    { label: "token_transfer", display: "💸 token_transfer" },
    { label: "wallet_deposit", display: "⬆️ wallet_deposit" },
    { label: "account_created", display: "👤 account_created" },
  ];

  return (
    <div className="xo3-search-zone">
      <div className="xo3-search-row">
        <div className={`xo3-search-terminal${focused ? " focused" : ""}`}>
          <div className="xo3-search-prefix">
            <Search size={12} color="rgba(132,204,22,.45)"/>
            <span className="xo3-search-prefix-label">QUERY</span>
          </div>
          <span className="xo3-search-prompt">_</span>
          <input
            ref={inputRef}
            className="xo3-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === "Enter" && query.trim() && onSearch(query.trim())}
            placeholder="record ID · user UUID · post_created · any keyword…"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="xo3-search-clear" onClick={() => setQuery("")}>
              <X size={13}/>
            </button>
          )}
        </div>
        <button
          className="xo3-search-cta"
          onClick={() => query.trim() && onSearch(query.trim())}
          disabled={searching || !query.trim()}
        >
          {searching
            ? <Loader size={13} className="xo3-spin"/>
            : <><Zap size={13}/><span>Enter Chain</span></>
          }
        </button>
      </div>

      <div className="xo3-search-hints">
        <span className="xo3-search-hint-label">TRY →</span>
        {HINTS.map(h => (
          <button key={h.label} className="xo3-search-hint"
            onClick={() => { setQuery(h.label); onSearch(h.label); }}>
            {h.display}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────
const XRCOracleExplorer = ({ onClose, xrcService, currentUser }) => {
  const [phase,         setPhase]         = useState("idle");
  const [query,         setQuery]         = useState("");
  const [searching,     setSearching]     = useState(false);
  const [error,         setError]         = useState(null);
  const [centerRecord,  setCenterRecord]  = useState(null);
  const [network,       setNetwork]       = useState({ prev:null, next:null, actorEvents:[], relatedEvents:[] });
  const [netLoading,    setNetLoading]    = useState(false);
  const [chain,         setChain]         = useState([]);
  const [chainIdx,      setChainIdx]      = useState(0);
  const [traceChain,    setTraceChain]    = useState([]);
  const [traceLoading,  setTraceLoading]  = useState(false);
  const [selectedNode,  setSelectedNode]  = useState(null);
  const [showDetail,    setShowDetail]    = useState(false);
  const [stats,         setStats]         = useState(null);
  const [feed,          setFeed]          = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    loadOverview();
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  const loadOverview = async () => {
    if (!xrcService) return;
    try {
      const [s, f] = await Promise.all([
        xrcService.getChainStats().catch(() => null),
        xrcService.getRecentActivity(12).catch(() => []),
      ]);
      setStats(s); setFeed(f);
    } catch {}
  };

  const oracleSearch = useCallback(async (q) => {
    if (!xrcService || !q.trim()) return;
    const raw = q.trim();
    setSearching(true); setError(null); setPhase("searching");
    try {
      let found = null;
      if (/^[0-9a-f-]{36}$/i.test(raw)) {
        const v = await xrcService.verifyRecord(raw).catch(() => null);
        if (v?.record) found = v.record;
      }
      if (!found && /^[0-9a-f-]{36}$/i.test(raw)) {
        const r = await xrcService.getActorHistory(raw, 1).catch(() => []);
        if (r.length > 0) found = r[0];
      }
      if (!found) {
        const r = await xrcService.searchRecords({ eventType: raw, limit: 1 }).catch(() => null);
        if (r?.records?.length > 0) found = r.records[0];
      }
      if (!found) {
        const r = await xrcService.searchRecords({ searchTerm: raw, limit: 1 }).catch(() => null);
        if (r?.records?.length > 0) found = r.records[0];
      }
      if (found) { await expandNetwork(found); }
      else {
        setError(`Nothing found for "${raw}". Try a Record ID, User UUID, or event type like "post_created".`);
        setPhase("idle");
      }
    } catch {
      setError("Oracle is unreachable. Verify the chain service is running.");
      setPhase("idle");
    } finally { setSearching(false); }
  }, [xrcService]);

  const expandNetwork = useCallback(async (record) => {
    setCenterRecord(record); setSelectedNode(null); setShowDetail(false);
    setPhase("network"); setNetLoading(true);
    try {
      const [traceRes, actorRecs, afterRes] = await Promise.all([
        xrcService.traceHistory(record.record_id, 10).catch(() => ({ chain: [] })),
        xrcService.getActorHistory(record.actor_id, 8).catch(() => []),
        xrcService.searchRecords({ streamType: record.stream_type, fromTimestamp: Number(record.timestamp)+1, limit: 4 }).catch(() => ({ records: [] })),
      ]);
      const fullChain = traceRes?.chain || [];
      let relatedEvents = [];
      const cid = record.payload?.post_id || record.payload?.story_id || record.payload?.reel_id || record.payload?.content_id;
      if (cid) {
        const rel = await xrcService.searchRecords({ searchTerm: cid, limit: 6 }).catch(() => ({ records: [] }));
        relatedEvents = (rel.records || []).filter(r => r.record_id !== record.record_id);
      }
      const prev = fullChain.find(r => r.record_hash === record.previous_hash) || (fullChain.length > 1 ? fullChain[1] : null);
      const next = (afterRes.records || [])[0] || null;
      const actorEvents = actorRecs.filter(r => r.record_id !== record.record_id).slice(0, 4);
      const ci = fullChain.findIndex(r => r.record_id === record.record_id);
      setChain(fullChain); setChainIdx(ci >= 0 ? ci : 0);
      setNetwork({ prev, next, actorEvents, relatedEvents: relatedEvents.slice(0, 3) });
    } catch (e) { console.error("[Oracle] expandNetwork:", e); }
    finally { setNetLoading(false); }
  }, [xrcService]);

  const traceToGenesis = useCallback(async (recordId) => {
    if (!xrcService) return;
    setPhase("trace"); setTraceLoading(true);
    try { const r = await xrcService.traceHistory(recordId, 40); setTraceChain(r?.chain || []); }
    catch {} finally { setTraceLoading(false); }
  }, [xrcService]);

  const handleBack = () => {
    setPhase("idle"); setCenterRecord(null);
    setNetwork({ prev:null, next:null, actorEvents:[], relatedEvents:[] });
    setChain([]); setTraceChain([]); setSelectedNode(null); setShowDetail(false); setError(null);
    setTimeout(() => inputRef.current?.focus(), 180);
  };

  return ReactDOM.createPortal(
    <>
      <style>{CSS}</style>
      <div className="xo3-root">
        {/* Background */}
        <div className="xo3-bg">
          <div className="xo3-grid"/>
          <div className="xo3-grid-accent"/>
        </div>

        {/* ═══ HEADER: Mission Control Banner ═══ */}
        <OracleHeader
          stats={stats}
          feed={feed}
          phase={phase}
          onBack={handleBack}
          onClose={onClose}
          onRefresh={loadOverview}
          searching={searching}
        />

        {/* ═══ SEARCH: Command Terminal Bar ═══ */}
        <SearchZone
          query={query}
          setQuery={setQuery}
          onSearch={oracleSearch}
          searching={searching}
          inputRef={inputRef}
        />

        {/* ═══ STAGE ═══ */}
        <div className="xo3-stage">
          {phase === "idle" && (
            <IdleView feed={feed} stats={stats} error={error}
              onEnterRecord={expandNetwork}
              onQuickSearch={q => { setQuery(q); oracleSearch(q); }}/>
          )}
          {phase === "searching" && (
            <div className="xo3-searching">
              <div className="xo3-searching-ring"/>
              <div className="xo3-searching-txt">Querying the chain…</div>
              <div className="xo3-searching-q">"{query}"</div>
            </div>
          )}
          {phase === "network" && centerRecord && (
            <NetworkView
              centerRecord={centerRecord} network={network} loading={netLoading}
              onNodeClick={rec => { setSelectedNode(rec); setShowDetail(true); }}
              onChainSelect={rec => { setQuery(trunc(rec.record_id, 18)); expandNetwork(rec); }}
              chain={chain} chainCenterIdx={chainIdx}
              showDetail={showDetail} selectedNode={selectedNode}
              onDetailClose={() => setShowDetail(false)} onExpand={rec => { setShowDetail(false); setQuery(trunc(rec.record_id, 18)); expandNetwork(rec); }} onTrace={traceToGenesis}
            />
          )}
          {phase === "trace" && (
            <TraceView chain={traceChain} loading={traceLoading} onNodeClick={rec => { setQuery(trunc(rec.record_id, 18)); expandNetwork(rec); }}/>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default XRCOracleExplorer;