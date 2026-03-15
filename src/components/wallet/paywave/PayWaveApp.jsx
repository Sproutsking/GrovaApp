// paywave/PayWaveApp.jsx
// ─────────────────────────────────────────────────────────────
// Root orchestrator for PayWave — PURE ₦ NAIRA SYSTEM.
//
// REDESIGN v2 — Premium fintech aesthetic:
//   • Deeper, richer backgrounds with subtle texture
//   • Sculptural glass cards with inner-glow highlights
//   • Shimmer-animated primary button
//   • More generous spacing throughout (f-section → 18px top)
//   • Premium mobile bottom nav with pill active indicator
//   • Better form field styling with focus glow
//   • More impressive quick-action grid
//   • Better transaction row typography
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { Home, Zap, TrendingUp, History, User, ArrowLeft } from "lucide-react";

import HomeTab from "./tabs/HomeTab";
import ServicesTab from "./tabs/ServicesTab";
import FinanceTab from "./tabs/FinanceTab";
import TransactionsTab from "./tabs/TransactionsTab";
import AccountTab from "./tabs/AccountTab";
import BillsTab from "./tabs/BillsTab";
import WalletTab from "./tabs/WalletTab";
import NotificationsTab from "./tabs/NotificationsTab";
import { SuccessModal } from "./modals/index";
import { supabase } from "../../../services/config/supabase";
import { useAuth } from "../../Auth/AuthContext";

// ─────────────────────────────────────────────────────────────
// GLOBAL STYLES  — complete premium redesign
// ─────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           #05060a;
    --bg2:          #080b0f;
    --surface:      rgba(255,255,255,0.034);
    --surface-h:    rgba(255,255,255,0.06);
    --surface-2:    rgba(255,255,255,0.05);
    --border:       rgba(255,255,255,0.075);
    --border-h:     rgba(255,255,255,0.12);
    --lime:         #a3e635;
    --lime-dim:     #84cc16;
    --lime-bright:  #bef264;
    --lime-glow:    rgba(163,230,53,0.14);
    --lime-border:  rgba(163,230,53,0.25);
    --lime-deep:    rgba(163,230,53,0.08);
    --gold:         #d4a847;
    --gold-bright:  #f0c050;
    --gold-dim:     rgba(212,168,71,0.15);
    --gold-border:  rgba(212,168,71,0.28);
    --text:         #eef2ec;
    --text-soft:    #7a8c78;
    --text-muted:   #3a4a38;
    --font-d: 'Syne', sans-serif;
    --font-b: 'DM Sans', sans-serif;
    --font-m: 'DM Mono', monospace;
    --r-xs: 8px; --r-sm: 12px; --r: 16px; --r-lg: 22px; --r-xl: 28px;
    --nav-h: 70px; --side-w: 70px; --header-h: 52px;
    --pw-pad-left: 16px;
    --pw-pad-right: 16px;

    /* Depth shadows */
    --shadow-sm:  0 2px 8px  rgba(0,0,0,0.32);
    --shadow-md:  0 6px 24px rgba(0,0,0,0.44);
    --shadow-lg:  0 16px 48px rgba(0,0,0,0.56);
    --shadow-xl:  0 24px 64px rgba(0,0,0,0.64);
    --lime-shadow: 0 8px 28px rgba(163,230,53,0.22);
  }

  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-b);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Shell ── */
  .pw-shell {
    position: absolute; inset: 0;
    background: var(--bg);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .pw-shell {
      flex-direction: row;
      background: var(--bg2);
      align-items: stretch;
    }
  }

  /* ── Scroll containers — improved spacing ── */
  .pw-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

  .pw-scroll, .pw-scroll-px {
    flex: 1; width: 100%; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    padding-bottom: 24px;
    padding-top: 0;
    scrollbar-width: none;
    padding-left: var(--pw-pad-left);
    padding-right: var(--pw-pad-right);
  }
  .pw-scroll::-webkit-scrollbar,
  .pw-scroll-px::-webkit-scrollbar { display: none; }

  /* ── Glass cards — sculptural treatment ── */
  .glass {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r);
    position: relative;
    overflow: hidden;
  }
  /* Inner-glow top highlight */
  .glass::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(
      160deg,
      rgba(255,255,255,0.045) 0%,
      rgba(255,255,255,0.01)  40%,
      transparent             70%
    );
    pointer-events: none;
    border-radius: inherit;
  }

  .glass.click {
    cursor: pointer;
    transition: background .18s, border-color .18s, transform .12s, box-shadow .18s;
  }
  .glass.click:hover {
    background: var(--surface-h);
    border-color: rgba(255,255,255,0.11);
    box-shadow: 0 4px 20px rgba(0,0,0,0.28);
  }
  .glass.click:active { transform: scale(0.985); }

  .glass-lime {
    background: linear-gradient(145deg, rgba(163,230,53,0.08) 0%, rgba(132,204,22,0.04) 100%);
    border-color: var(--lime-border);
  }
  .glass-lime::before {
    background: linear-gradient(160deg, rgba(163,230,53,0.08) 0%, transparent 60%);
  }

  .glass-gold {
    background: linear-gradient(145deg, rgba(212,168,71,0.09) 0%, rgba(212,168,71,0.04) 100%);
    border-color: var(--gold-border);
  }
  .glass-gold::before {
    background: linear-gradient(160deg, rgba(212,168,71,0.1) 0%, transparent 60%);
  }

  /* ── Primary button — premium shimmer ── */
  .btn-lime {
    background: linear-gradient(135deg, var(--lime) 0%, var(--lime-dim) 100%);
    color: #080e03;
    font-family: var(--font-d);
    font-weight: 800;
    font-size: 13.5px;
    letter-spacing: 0.01em;
    padding: 12px 22px;
    border-radius: var(--r-sm);
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: all .2s;
    box-shadow: 0 6px 22px rgba(163,230,53,0.28), inset 0 1px 0 rgba(255,255,255,0.22);
    position: relative;
    overflow: hidden;
  }
  /* Shimmer sweep */
  .btn-lime::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.2),
      transparent
    );
    transform: skewX(-20deg);
    transition: none;
  }
  .btn-lime:hover::after {
    left: 160%;
    transition: left 0.55s ease;
  }
  .btn-lime:hover {
    background: linear-gradient(135deg, var(--lime-bright) 0%, var(--lime) 100%);
    box-shadow: 0 10px 32px rgba(163,230,53,0.38);
    transform: translateY(-1px);
  }
  .btn-lime:active { transform: scale(0.97) translateY(0); }
  .btn-lime:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-lime:disabled::after { display: none; }
  .btn-lime.full { width: 100%; }
  .btn-lime.sm   { padding: 9px 15px; font-size: 12.5px; }

  /* ── Ghost button ── */
  .btn-ghost {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-b);
    font-weight: 500;
    font-size: 13.5px;
    padding: 12px 22px;
    border-radius: var(--r-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: all .18s;
  }
  .btn-ghost:hover {
    background: var(--surface-h);
    border-color: var(--border-h);
    box-shadow: 0 4px 14px rgba(0,0,0,0.22);
  }
  .btn-ghost:active { transform: scale(0.97); }

  /* ── Header bar ── */
  .pw-header {
    position: sticky; top: 0; height: var(--header-h);
    background: rgba(5,6,10,0.92);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-bottom: 1px solid var(--border);
    padding: 0 var(--pw-pad-left);
    display: flex; align-items: center; gap: 10px;
    z-index: 10; flex-shrink: 0;
  }
  .pw-back {
    width: 32px; height: 32px; border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all .15s;
  }
  .pw-back:hover { background: var(--surface-h); border-color: rgba(163,230,53,0.3); color: var(--lime); }
  .pw-header-title {
    font-family: var(--font-d);
    font-size: 15px; font-weight: 700;
    color: var(--text); letter-spacing: -0.01em;
  }

  /* ── Mobile bottom navigation — premium pill ── */
  .pw-nav {
    position: sticky; bottom: 0; height: var(--nav-h);
    background: rgba(5,6,10,0.98);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-top: 1px solid var(--border);
    padding: 8px 8px 10px;
    z-index: 20; flex-shrink: 0;
  }
  .pw-nav-inner {
    display: flex; align-items: center; justify-content: space-around; height: 100%;
  }
  .pw-nav-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 7px 16px;
    border-radius: var(--r);
    border: none;
    background: transparent;
    color: var(--text-soft);
    cursor: pointer;
    transition: all .2s;
    font-family: var(--font-b);
    font-size: 9.5px; font-weight: 500; letter-spacing: 0.03em;
    position: relative;
  }
  .pw-nav-btn:hover { color: rgba(255,255,255,0.6); }

  /* Active: lime pill background */
  .pw-nav-btn.active {
    background: rgba(163,230,53,0.1);
    border: 1px solid rgba(163,230,53,0.22);
    color: var(--lime);
    box-shadow: 0 4px 16px rgba(163,230,53,0.12);
  }
  @media (min-width: 768px) { .pw-nav { display: none; } }

  /* ── Desktop side navigation ── */
  .pw-sidenav { display: none; }
  @media (min-width: 768px) {
    .pw-sidenav {
      display: flex; flex-direction: column;
      width: var(--side-w); flex-shrink: 0;
      min-height: 0;
      background: rgba(4,5,8,0.98);
      border-right: 1px solid var(--border);
      z-index: 20;
      padding: 10px 0;
      overflow: hidden;
    }
    .pw-side-back {
      width: 38px; height: 38px; margin: 0 auto 8px;
      border-radius: 11px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s; flex-shrink: 0;
    }
    .pw-side-back:hover { background: var(--surface-h); border-color: rgba(163,230,53,0.28); color: var(--lime); }
    .pw-side-divider { width: 32px; height: 1px; background: var(--border); margin: 4px auto 8px; }
    .pw-side-items { flex: 1; display: flex; flex-direction: column; }
    .pw-side-btn {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 5px;
      border: none; background: transparent;
      color: var(--text-soft); cursor: pointer;
      transition: all .18s;
      font-family: var(--font-b); font-size: 9px; font-weight: 500; letter-spacing: 0.04em;
      width: 100%; position: relative;
    }
    .pw-side-btn::before {
      content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
      width: 3px; border-radius: 0 3px 3px 0;
      background: transparent; transition: background .18s;
    }
    .pw-side-btn:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.025); }
    .pw-side-btn.active { color: var(--lime); background: rgba(163,230,53,0.06); }
    .pw-side-btn.active::before { background: var(--lime); }
    .pw-side-icon {
      width: 36px; height: 36px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      transition: background .18s;
    }
    .pw-side-btn.active .pw-side-icon {
      background: rgba(163,230,53,0.14);
      box-shadow: 0 4px 14px rgba(163,230,53,0.14);
    }
    .pw-side-label { text-align: center; line-height: 1.2; }
  }

  /* ── Form sections — more breathing room ── */
  .f-section { padding: 18px var(--pw-pad-left) 8px; }
  .f-stack    { display: flex; flex-direction: column; gap: 16px; }
  .f-label {
    font-family: var(--font-b);
    color: var(--text-soft);
    font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase;
    display: block; margin-bottom: 7px; font-weight: 600;
  }
  .f-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 12px 14px;
    transition: border-color .18s, box-shadow .18s;
  }
  .f-card:focus-within {
    border-color: var(--lime-border);
    box-shadow: 0 0 0 3px rgba(163,230,53,0.08);
  }
  .f-input {
    width: 100%; background: transparent;
    color: var(--text); border: none; outline: none;
    font-family: var(--font-b); font-size: 14px;
  }
  .f-input::placeholder { color: var(--text-muted); }
  .f-input-lg {
    width: 100%; background: transparent;
    color: var(--text); border: none; outline: none;
    font-family: var(--font-d); font-size: 28px; font-weight: 800;
  }
  .f-input-lg::placeholder { color: var(--text-muted); }

  /* ── Amount quick buttons ── */
  .amt-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
  .amt-btn {
    padding: 10px 6px; border-radius: var(--r-sm);
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-b);
    font-weight: 600; font-size: 12.5px;
    cursor: pointer; transition: all .15s; text-align: center;
  }
  .amt-btn.sel {
    background: rgba(163,230,53,0.12);
    border-color: var(--lime-border);
    color: var(--lime);
    box-shadow: 0 2px 10px rgba(163,230,53,0.12);
  }
  .amt-btn:hover:not(.sel) { background: var(--surface-h); border-color: var(--border-h); }

  /* ── Network / provider grids ── */
  .net-grid  { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
  .prov-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }

  .net-btn {
    aspect-ratio: 1; border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--font-d); font-weight: 700; font-size: 11.5px;
    border: 2px solid transparent; cursor: pointer;
    box-shadow: var(--shadow-sm); transition: transform .15s;
  }
  .net-btn:hover { transform: scale(1.05); }
  .net-btn.sel { border-color: var(--lime); box-shadow: 0 0 0 3px rgba(163,230,53,0.18); transform: scale(0.96); }

  .prov-btn {
    aspect-ratio: 16/9; border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--font-d); font-weight: 700; font-size: 11.5px;
    border: 2px solid transparent; cursor: pointer;
    box-shadow: var(--shadow-sm); transition: transform .15s;
  }
  .prov-btn:hover { transform: scale(1.04); }
  .prov-btn.sel { border-color: var(--lime); transform: scale(0.96); }

  .plan-btn {
    width: 100%; padding: 13px 14px;
    border-radius: var(--r-sm); background: var(--surface);
    border: 1px solid var(--border); color: var(--text);
    text-align: left; cursor: pointer; transition: all .15s;
  }
  .plan-btn.sel {
    background: rgba(163,230,53,0.09);
    border-color: var(--lime-border);
    box-shadow: 0 4px 22px rgba(163,230,53,0.09);
  }
  .plan-btn:hover:not(.sel) { background: var(--surface-h); }

  /* ── Section header ── */
  .sec-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; }
  .sec-title {
    font-family: var(--font-d); font-size: 13.5px; font-weight: 700;
    color: var(--text); letter-spacing: -0.01em;
  }
  .sec-link {
    color: var(--lime); font-size: 11.5px; font-weight: 600;
    background: transparent; border: none; cursor: pointer;
    transition: opacity .15s; font-family: var(--font-b);
  }
  .sec-link:hover { opacity: .7; }

  /* ── Transaction rows — sharper typography ── */
  .tx-row  { display: flex; align-items: center; justify-content: space-between; }
  .tx-left { display: flex; align-items: center; gap: 11px; }
  .tx-icon {
    width: 36px; height: 36px; border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tx-icon.cr {
    background: rgba(163,230,53,0.12);
    border-color: var(--lime-border);
    box-shadow: 0 2px 8px rgba(163,230,53,0.1);
  }
  .tx-title { font-family: var(--font-b); color: var(--text); font-size: 13.5px; font-weight: 500; }
  .tx-date  { color: var(--text-soft); font-size: 11.5px; margin-top: 1px; }
  .tx-amt   { font-family: var(--font-d); font-weight: 700; font-size: 14px; color: var(--text); }
  .tx-amt.cr { color: var(--lime); }
  .tx-status { color: var(--lime); font-size: 9.5px; font-weight: 600; letter-spacing: 0.04em; }

  /* ── Info boxes ── */
  .info-lime {
    background: rgba(163,230,53,0.07);
    border: 1px solid var(--lime-border);
    border-radius: var(--r); padding: 13px 15px;
  }
  .info-gold {
    background: var(--gold-dim);
    border: 1px solid var(--gold-border);
    border-radius: var(--r); padding: 13px 15px;
  }
  .c-lime  { color: var(--lime); }
  .c-gold  { color: var(--gold); }
  .c-red   { color: #f87171; }
  .c-muted { color: var(--text-soft); }

  /* ── Avatar ── */
  .av {
    border-radius: 50%;
    background: linear-gradient(135deg, var(--lime) 0%, #65a30d 100%);
    display: flex; align-items: center; justify-content: center;
    color: #080e03; font-family: var(--font-d); font-weight: 800;
    flex-shrink: 0;
    box-shadow: 0 6px 18px rgba(163,230,53,0.28);
  }
  .av-sm { width: 36px; height: 36px; font-size: 13px; }
  .av-lg { width: 56px; height: 56px; font-size: 21px; }

  /* ── Icon chip ── */
  .ic-chip {
    width: 32px; height: 32px; border-radius: 9px;
    background: var(--surface); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-soft); position: relative;
    transition: all .15s;
  }
  .ic-chip:hover { background: var(--surface-h); border-color: var(--lime-border); color: var(--lime); }
  .notif-pip {
    position: absolute; top: -4px; right: -4px;
    width: 15px; height: 15px;
    background: var(--lime); border: 2px solid var(--bg);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 800; color: #080e03;
  }

  /* ── Toggle ── */
  .tog { width: 40px; height: 22px; border-radius: 11px; position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0; }
  .tog.on  { background: var(--lime); box-shadow: 0 2px 8px rgba(163,230,53,0.3); }
  .tog.off { background: #1a2016; border: 1px solid rgba(255,255,255,0.07); }
  .tog-thumb { width: 15px; height: 15px; border-radius: 50%; background: #fff; position: absolute; top: 3.5px; transition: all .2s; }
  .tog.on  .tog-thumb { right: 4px; left: auto; background: #080e03; }
  .tog.off .tog-thumb { left: 4px; }

  /* ── Copy row ── */
  .copy-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--border); }
  .copy-val { color: var(--text); font-family: var(--font-m); font-size: 14px; }
  .copy-ic { padding: 5px; border-radius: 7px; background: rgba(163,230,53,0.1); border: none; cursor: pointer; display: flex; color: var(--lime); transition: background .15s; }
  .copy-ic:hover { background: rgba(163,230,53,0.2); }

  /* ── Bank select ── */
  .bank-sel { width: 100%; background: var(--surface); padding: 12px 14px; border-radius: var(--r-sm); color: var(--text); outline: none; border: 1px solid var(--border); font-size: 14px; font-family: var(--font-b); cursor: pointer; transition: border-color .18s; appearance: none; -webkit-appearance: none; }
  .bank-sel:focus { border-color: var(--lime-border); box-shadow: 0 0 0 3px rgba(163,230,53,0.08); }
  .bank-sel option { background: #0c0f0a; }

  /* ── Gradient utilities ── */
  .g-purple{background:linear-gradient(145deg,#a855f7,#7c3aed)} .g-blue{background:linear-gradient(145deg,#3b82f6,#1d4ed8)} .g-orange{background:linear-gradient(145deg,#f97316,#ea580c)} .g-yellow{background:linear-gradient(145deg,#eab308,#ca8a04)} .g-green{background:linear-gradient(145deg,#22c55e,#16a34a)} .g-pink{background:linear-gradient(145deg,#ec4899,#db2777)} .g-indigo{background:linear-gradient(145deg,#6366f1,#4f46e5)} .g-teal{background:linear-gradient(145deg,#14b8a6,#0d9488)} .g-lime{background:linear-gradient(145deg,#a3e635,#65a30d)} .g-blue2{background:linear-gradient(145deg,#3b82f6,#4f46e5)} .g-rose{background:linear-gradient(145deg,#f43f5e,#e11d48)} .g-red2{background:linear-gradient(145deg,#ef4444,#dc2626)} .g-inv1{background:linear-gradient(145deg,#a3e635,#65a30d)} .g-inv2{background:linear-gradient(145deg,#3b82f6,#4f46e5)} .g-inv3{background:linear-gradient(145deg,#a855f7,#7c3aed)} .g-sav1{background:linear-gradient(145deg,#f97316,#ea580c)} .g-sav2{background:linear-gradient(145deg,#6366f1,#4f46e5)} .g-sav3{background:linear-gradient(145deg,#ec4899,#db2777)}
  .net-mtn{background:linear-gradient(145deg,#eab308,#ca8a04)} .net-glo{background:linear-gradient(145deg,#22c55e,#16a34a)} .net-airtel{background:linear-gradient(145deg,#ef4444,#dc2626)} .net-9mobile{background:linear-gradient(145deg,#10b981,#059669)}
  .prov-dstv{background:linear-gradient(145deg,#ef4444,#dc2626)} .prov-gotv{background:linear-gradient(145deg,#22c55e,#16a34a)} .prov-startimes{background:linear-gradient(145deg,#3b82f6,#1d4ed8)} .prov-ikeja{background:linear-gradient(145deg,#eab308,#ca8a04)} .prov-eko{background:linear-gradient(145deg,#3b82f6,#1d4ed8)} .prov-abuja{background:linear-gradient(145deg,#22c55e,#16a34a)} .prov-bet9ja{background:linear-gradient(145deg,#eab308,#ca8a04)} .prov-sportybet{background:linear-gradient(145deg,#22c55e,#16a34a)} .prov-nairabet{background:linear-gradient(145deg,#ef4444,#dc2626)}

  /* ── Layout helpers ── */
  .row    { display:flex; align-items:center; gap:8px; }
  .row-sb { display:flex; align-items:center; justify-content:space-between; }
  .col    { display:flex; flex-direction:column; }
  .f1     { flex: 1; }
  .space-y > * + * { margin-top: 9px; }
  .mb-2{margin-bottom:8px} .mb-3{margin-bottom:14px} .mb-4{margin-bottom:20px} .mt-3{margin-top:14px}

  /* ── Quick action grid — premium treatment ── */
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  .quick-btn {
    display: flex; flex-direction: column; align-items: center; gap: 7px;
    background: transparent; border: none; cursor: pointer;
  }
  .quick-icon {
    width: 56px; height: 56px;
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.14);
    transition: transform .18s, box-shadow .18s;
  }
  .quick-btn:hover .quick-icon {
    transform: scale(1.08) translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .quick-btn:active .quick-icon { transform: scale(0.94); }
  .quick-label { color: var(--text-soft); font-size: 10px; font-weight: 500; font-family: var(--font-b); }

  /* ── Services grid ── */
  .srv-grid  { display:grid; grid-template-columns:repeat(4,1fr); gap:11px; }
  .srv-item  { display:flex; flex-direction:column; align-items:center; gap:7px; background:transparent; border:none; cursor:pointer; }
  .srv-icon  { width:54px; height:54px; border-radius:16px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.14); transition:transform .18s, box-shadow .18s; }
  .srv-item:hover .srv-icon  { transform:scale(1.08) translateY(-2px); box-shadow:0 12px 32px rgba(0,0,0,0.44); }
  .srv-item:active .srv-icon { transform:scale(0.94); }
  .srv-label { color:var(--text-soft); font-size:10px; font-weight:500; text-align:center; line-height:1.3; font-family:var(--font-b); }

  /* ── Keyframes ── */
  @keyframes pw-spin    { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}   }
  @keyframes pw-shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }
  @keyframes pw-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(163,230,53,.22)} 50%{box-shadow:0 0 0 10px rgba(163,230,53,0)} }
  @keyframes pw-fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pw-glow    { 0%,100%{box-shadow:0 0 20px rgba(163,230,53,.08)} 50%{box-shadow:0 0 40px rgba(163,230,53,.18)} }
`;

const MAIN_TABS = new Set([
  "home",
  "services",
  "finance",
  "transactions",
  "account",
]);
const BILLS_VIEWS = new Set([
  "airtime",
  "data",
  "tv",
  "electricity",
  "betting",
  "giftcards",
  "bills",
  "services",
]);
const WALLET_VIEWS = new Set(["send", "receive", "invest", "save", "cards"]);

const BACK_MAP = {
  airtime: "home",
  data: "home",
  tv: "services",
  electricity: "home",
  betting: "services",
  giftcards: "services",
  bills: "services",
  loans: "finance",
  send: "home",
  receive: "home",
  invest: "finance",
  save: "finance",
  cards: "finance",
  notifications: "home",
  transactions: "home",
};

const NAV_TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "services", label: "Services", icon: Zap },
  { id: "finance", label: "Finance", icon: TrendingUp },
  { id: "transactions", label: "History", icon: History },
  { id: "account", label: "Account", icon: User },
];

export default function PayWaveApp({ onBack, userId }) {
  const { profile } = useAuth();
  const [page, setPage] = useState("home");
  const [showBalance, setShowBalance] = useState(true);
  const [successMsg, setSuccessMsg] = useState(null);

  // ── PayWave Naira balance ──────────────────────────────────
  const [pwBalance, setPwBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("wallets")
        .select("paywave_balance")
        .eq("user_id", profile.id)
        .maybeSingle();
      setPwBalance(data?.paywave_balance ?? 0);
    } catch (err) {
      console.error("PayWave balance fetch:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Real-time balance updates
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`pw_bal:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          if (payload.new?.paywave_balance != null) {
            setPwBalance(payload.new.paywave_balance);
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.id]);

  const [notifications, setNotifications] = useState([]);

  const goBack = () => {
    const dest = BACK_MAP[page];
    if (dest) {
      setPage(dest);
      return;
    }
    if (page === "home") {
      onBack?.();
      return;
    }
    setPage("home");
  };

  const handleSuccess = (msg) => setSuccessMsg(msg);
  const clearSuccess = () => {
    setSuccessMsg(null);
    setPage("home");
  };

  const isMainTab = MAIN_TABS.has(page);
  const activeNavId = isMainTab ? page : (BACK_MAP[page] ?? "home");

  const renderPage = () => {
    if (page === "home")
      return (
        <HomeTab
          pwBalance={pwBalance}
          showBalance={showBalance}
          setShowBalance={setShowBalance}
          notifications={notifications}
          setPage={setPage}
          onBack={onBack}
          onRefresh={fetchBalance}
        />
      );
    if (page === "services") return <ServicesTab setPage={setPage} />;
    if (page === "finance")
      return <FinanceTab pwBalance={pwBalance} setPage={setPage} />;
    if (page === "transactions")
      return (
        <TransactionsTab
          setPage={setPage}
          userId={profile?.id}
          onRefresh={fetchBalance}
        />
      );
    if (page === "account")
      return <AccountTab setPage={setPage} onSuccess={handleSuccess} />;
    if (BILLS_VIEWS.has(page))
      return (
        <BillsTab
          view={page}
          onBack={goBack}
          onSuccess={handleSuccess}
          setPage={setPage}
        />
      );
    if (WALLET_VIEWS.has(page))
      return (
        <WalletTab
          view={page}
          pwBalance={pwBalance}
          onBack={goBack}
          onSuccess={handleSuccess}
          userId={profile?.id}
          onRefresh={fetchBalance}
        />
      );
    if (page === "notifications")
      return (
        <NotificationsTab
          notifications={notifications}
          setNotifications={setNotifications}
          onBack={goBack}
        />
      );

    // Fallback — coming soon
    return (
      <div
        className="pw-scroll"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            padding: `0 var(--pw-pad-left)`,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 52,
            flexShrink: 0,
          }}
        >
          <button className="pw-back" onClick={goBack}>
            <ArrowLeft size={14} />
          </button>
          <span
            style={{
              fontFamily: "var(--font-d)",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, " ")}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(163,230,53,0.1)",
              border: "1px solid var(--lime-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={28} color="var(--lime)" />
          </div>
          <div
            style={{
              fontFamily: "var(--font-d)",
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            Coming Soon
          </div>
          <div
            style={{
              color: "var(--text-soft)",
              fontSize: 13,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            This feature is under development
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div className="pw-shell">
        <nav className="pw-sidenav">
          <button
            className="pw-side-back"
            onClick={onBack}
            title="Back to Wallet"
          >
            <ArrowLeft size={15} />
          </button>
          <div
            className="pw-side-divider"
            style={{ background: "rgba(212,168,71,0.25)" }}
          />
          <div className="pw-side-items">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`pw-side-btn ${activeNavId === tab.id ? "active" : ""}`}
                onClick={() => setPage(tab.id)}
                title={tab.label}
              >
                <div className="pw-side-icon">
                  <tab.icon size={18} />
                </div>
                <span className="pw-side-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="pw-content">
          {renderPage()}
          {isMainTab && (
            <nav className="pw-nav">
              <div className="pw-nav-inner">
                {NAV_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={`pw-nav-btn ${page === tab.id ? "active" : ""}`}
                    onClick={() => setPage(tab.id)}
                  >
                    <tab.icon size={19} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>
        {successMsg && (
          <SuccessModal message={successMsg} onClose={clearSuccess} />
        )}
      </div>
    </>
  );
}
