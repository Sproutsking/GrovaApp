// paywave/PayWaveApp.jsx  ── v3 REFINED EDITION
// ─────────────────────────────────────────────────────────────
// Design philosophy: Tight spacing, surgical precision.
// Less padding = more elegance. Every px deliberate.
// Dark luxury fintech — obsidian surfaces, lime signal, gold warmth.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { Home, Zap, TrendingUp, History, User, ArrowLeft } from "lucide-react";

import HomeTab from "./tabs/HomeTab";
import ServicesTab from "./tabs/ServicesTab";
import FinanceTab, { FinanceSubView } from "./tabs/FinanceTab";
import TransactionsTab from "./tabs/TransactionsTab";
import AccountTab from "./tabs/AccountTab";
import BillsTab from "./tabs/BillsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import { SuccessModal } from "./modals/index";
import { supabase } from "../../../services/config/supabase";
import { useAuth } from "../../Auth/AuthContext";

// ─────────────────────────────────────────────────────────────
// GLOBAL DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────
export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Core palette */
    --bg:           #05070a;
    --bg2:          #070a0e;
    --s1:           rgba(255,255,255,0.028);
    --s2:           rgba(255,255,255,0.048);
    --s3:           rgba(255,255,255,0.072);
    --b1:           rgba(255,255,255,0.055);
    --b2:           rgba(255,255,255,0.09);
    --b3:           rgba(255,255,255,0.14);

    /* Brand */
    --lime:         #a3e635;
    --lime-d:       #84cc16;
    --lime-b:       #c8f564;
    --lime-glow:    rgba(163,230,53,0.12);
    --lime-ring:    rgba(163,230,53,0.22);

    /* Accent */
    --gold:         #d4a847;
    --gold-d:       rgba(212,168,71,0.1);
    --gold-ring:    rgba(212,168,71,0.24);

    /* Text */
    --t1:           #eef2ec;
    --t2:           rgba(255,255,255,0.5);
    --t3:           rgba(255,255,255,0.28);
    --t4:           rgba(255,255,255,0.14);

    /* Type */
    --fd:           'Syne', sans-serif;
    --fb:           'DM Sans', sans-serif;
    --fm:           'DM Mono', monospace;

    /* Radius */
    --r1:   6px;
    --r2:   10px;
    --r3:   14px;
    --r4:   18px;

    /* Layout */
    --nav-h:    62px;
    --side-w:   64px;
    --hdr-h:    46px;
    --px:       14px;
    --px2:      12px;

    /* Shadows */
    --sh1: 0 2px 8px rgba(0,0,0,0.3);
    --sh2: 0 6px 20px rgba(0,0,0,0.4);
    --sh3: 0 14px 40px rgba(0,0,0,0.55);
    --lime-sh: 0 6px 22px rgba(163,230,53,0.22);
  }

  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--t1);
    font-family: var(--fb);
    font-size: 13px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ── Shell ── */
  .pw-shell {
    position: absolute; inset: 0;
    background: var(--bg);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .pw-shell { flex-direction: row; background: var(--bg2); }
  }

  /* ── Scroll containers ── */
  .pw-content {
    flex: 1; min-width: 0; min-height: 0;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .pw-scroll, .pw-scroll-px {
    flex: 1; width: 100%; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    padding-bottom: 20px;
    padding-left: var(--px);
    padding-right: var(--px);
    scrollbar-width: none;
  }
  .pw-scroll::-webkit-scrollbar,
  .pw-scroll-px::-webkit-scrollbar { display: none; }

  /* ── Glass cards ── */
  .xg {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: var(--r3);
    position: relative;
    overflow: hidden;
  }
  .xg::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(
      150deg,
      rgba(255,255,255,0.035) 0%,
      rgba(255,255,255,0.006) 35%,
      transparent 60%
    );
    pointer-events: none;
    border-radius: inherit;
  }
  .xg-lime {
    background: linear-gradient(148deg,rgba(163,230,53,0.07) 0%,rgba(132,204,22,0.02) 100%);
    border-color: var(--lime-ring);
  }
  .xg-gold {
    background: linear-gradient(148deg,rgba(212,168,71,0.08) 0%,rgba(212,168,71,0.02) 100%);
    border-color: var(--gold-ring);
  }
  .xg-click {
    cursor: pointer;
    transition: background .15s, border-color .15s, transform .1s;
  }
  .xg-click:hover {
    background: var(--s2);
    border-color: var(--b2);
  }
  .xg-click:active { transform: scale(0.988); }

  /* ── Buttons ── */
  .btn-p {
    background: linear-gradient(135deg, var(--lime) 0%, var(--lime-d) 100%);
    color: #060e02;
    font-family: var(--fd);
    font-weight: 800;
    font-size: 12.5px;
    letter-spacing: 0.01em;
    padding: 11px 18px;
    border-radius: var(--r2);
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all .18s;
    box-shadow: var(--lime-sh), inset 0 1px 0 rgba(255,255,255,0.2);
    position: relative;
    overflow: hidden;
    white-space: nowrap;
  }
  .btn-p::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 55%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transform: skewX(-20deg);
  }
  .btn-p:hover::after { left: 160%; transition: left .5s ease; }
  .btn-p:hover {
    background: linear-gradient(135deg, var(--lime-b) 0%, var(--lime) 100%);
    box-shadow: 0 8px 28px rgba(163,230,53,0.35);
    transform: translateY(-1px);
  }
  .btn-p:active { transform: scale(0.97) translateY(0); }
  .btn-p:disabled { opacity: 0.28; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-p:disabled::after { display: none; }
  .btn-p.full { width: 100%; display: flex; }
  .btn-p.sm   { padding: 8px 13px; font-size: 11.5px; }

  .btn-dk {
    background: rgba(255,255,255,0.055);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--t1);
    font-family: var(--fd);
    font-weight: 700;
    font-size: 12.5px;
    padding: 11px 18px;
    border-radius: var(--r2);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all .15s;
    white-space: nowrap;
  }
  .btn-dk:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.17); }
  .btn-dk:active { transform: scale(0.97); }
  .btn-dk.full { width: 100%; display: flex; }

  .btn-g {
    background: var(--s1);
    border: 1px solid var(--b1);
    color: var(--t1);
    font-family: var(--fb);
    font-weight: 500;
    font-size: 12.5px;
    padding: 11px 18px;
    border-radius: var(--r2);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all .15s;
    white-space: nowrap;
  }
  .btn-g:hover { background: var(--s2); border-color: var(--b2); }
  .btn-g:active { transform: scale(0.97); }
  .btn-g.full { width: 100%; display: flex; }
  .btn-g.sm   { padding: 8px 13px; font-size: 11.5px; }

  /* Paired buttons */
  .btn-pair { display: flex; gap: 8px; width: 100%; }
  .btn-pair > * { flex: 1; min-width: 0; padding-left: 0; padding-right: 0; }

  /* ── Header ── */
  .pw-hdr {
    position: sticky; top: 0;
    height: var(--hdr-h);
    background: rgba(5,7,10,0.94);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border-bottom: 1px solid var(--b1);
    padding: 0 var(--px);
    display: flex; align-items: center; gap: 9px;
    z-index: 10; flex-shrink: 0;
  }
  .pw-back-btn {
    width: 28px; height: 28px;
    border-radius: var(--r1);
    border: 1px solid var(--b1);
    background: var(--s1);
    color: var(--t2);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all .14s;
  }
  .pw-back-btn:hover { background: var(--s2); border-color: var(--lime-ring); color: var(--lime); }
  .pw-hdr-title {
    font-family: var(--fd);
    font-size: 14px; font-weight: 700;
    color: var(--t1); letter-spacing: -0.01em;
    flex: 1;
  }

  /* ── Mobile bottom nav ── */
  .pw-nav {
    position: sticky; bottom: 0;
    height: var(--nav-h);
    background: rgba(5,7,10,0.98);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border-top: 1px solid var(--b1);
    display: flex; align-items: center; justify-content: space-around;
    padding: 6px 4px 8px;
    z-index: 20; flex-shrink: 0;
  }
  .pw-nav-btn {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 13px;
    border-radius: var(--r2);
    border: none;
    background: transparent;
    color: var(--t3);
    cursor: pointer;
    transition: all .18s;
    font-family: var(--fb);
    font-size: 9px; font-weight: 500;
  }
  .pw-nav-btn.active {
    background: rgba(163,230,53,0.09);
    border: 1px solid rgba(163,230,53,0.2);
    color: var(--lime);
  }
  @media (min-width: 768px) { .pw-nav { display: none; } }

  /* ── Desktop side nav ── */
  .pw-sidenav { display: none; }
  @media (min-width: 768px) {
    .pw-sidenav {
      display: flex; flex-direction: column;
      width: var(--side-w); flex-shrink: 0;
      background: rgba(4,5,8,0.98);
      border-right: 1px solid var(--b1);
      z-index: 20;
      padding: 8px 0;
    }
    .pw-side-back {
      width: 34px; height: 34px; margin: 0 auto 6px;
      border-radius: var(--r2);
      border: 1px solid var(--b1);
      background: var(--s1);
      color: var(--t2);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .14s; flex-shrink: 0;
    }
    .pw-side-back:hover { background: var(--s2); border-color: var(--lime-ring); color: var(--lime); }
    .pw-side-div { width: 28px; height: 1px; background: var(--b1); margin: 2px auto 6px; }
    .pw-side-items { flex: 1; display: flex; flex-direction: column; }
    .pw-side-btn {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 4px;
      border: none; background: transparent;
      color: var(--t3); cursor: pointer;
      transition: all .15s;
      font-family: var(--fb); font-size: 8.5px; font-weight: 500;
      position: relative;
    }
    .pw-side-btn::before {
      content: ''; position: absolute; left: 0; top: 22%; bottom: 22%;
      width: 2.5px; border-radius: 0 2px 2px 0;
      background: transparent; transition: background .15s;
    }
    .pw-side-btn:hover { color: var(--t2); background: rgba(255,255,255,0.02); }
    .pw-side-btn.active { color: var(--lime); background: rgba(163,230,53,0.05); }
    .pw-side-btn.active::before { background: var(--lime); }
    .pw-side-icon {
      width: 32px; height: 32px; border-radius: var(--r2);
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .pw-side-btn.active .pw-side-icon {
      background: rgba(163,230,53,0.12);
      box-shadow: 0 3px 10px rgba(163,230,53,0.12);
    }
  }

  /* ── Form elements ── */
  .xf-section { padding: 14px 0 6px; }
  .xf-stack { display: flex; flex-direction: column; gap: 12px; }
  .xf-lbl {
    font-family: var(--fb);
    color: var(--t3);
    font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase;
    display: block; margin-bottom: 5px; font-weight: 600;
  }
  .xf-wrap {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: var(--r2);
    padding: 9px 12px;
    transition: border-color .16s, box-shadow .16s;
  }
  .xf-wrap:focus-within {
    border-color: var(--lime-ring);
    box-shadow: 0 0 0 2.5px rgba(163,230,53,0.07);
  }
  .xf-in {
    width: 100%; background: transparent;
    color: var(--t1); border: none; outline: none;
    font-family: var(--fb); font-size: 13px;
  }
  .xf-in::placeholder { color: var(--t4); }
  .xf-in-lg {
    width: 100%; background: transparent;
    color: var(--t1); border: none; outline: none;
    font-family: var(--fd); font-size: 26px; font-weight: 800;
  }
  .xf-in-lg::placeholder { color: var(--t4); }

  /* ── Amount quick grid ── */
  .amt-row { display: flex; gap: 6px; }
  .amt-btn {
    flex: 1; padding: 7px 4px;
    border-radius: var(--r1);
    background: var(--s1); border: 1px solid var(--b1);
    color: var(--t2); font-family: var(--fb);
    font-weight: 600; font-size: 11.5px;
    cursor: pointer; transition: all .13s; text-align: center;
  }
  .amt-btn.sel {
    background: rgba(163,230,53,0.1);
    border-color: var(--lime-ring);
    color: var(--lime);
  }
  .amt-btn:hover:not(.sel) { background: var(--s2); border-color: var(--b2); }

  /* ── Network / provider grids ── */
  .net-grid  { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }
  .prov-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
  .net-btn {
    aspect-ratio: 1; border-radius: var(--r2);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--fd); font-weight: 700; font-size: 10.5px;
    border: 2px solid transparent; cursor: pointer;
    box-shadow: var(--sh1); transition: transform .13s;
  }
  .net-btn:hover { transform: scale(1.04); }
  .net-btn.sel { border-color: var(--lime); box-shadow: 0 0 0 2.5px rgba(163,230,53,0.16); transform: scale(0.96); }
  .prov-btn {
    aspect-ratio: 16/9; border-radius: var(--r1);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--fd); font-weight: 700; font-size: 10.5px;
    border: 2px solid transparent; cursor: pointer;
    box-shadow: var(--sh1); transition: transform .13s;
  }
  .prov-btn:hover { transform: scale(1.04); }
  .prov-btn.sel { border-color: var(--lime); transform: scale(0.96); }

  /* ── Section header ── */
  .xsec-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .xsec-t {
    font-family: var(--fd); font-size: 12.5px; font-weight: 700;
    color: var(--t1); letter-spacing: -0.01em;
    display: flex; align-items: center; gap: 7px;
  }
  .xsec-t::before {
    content: '';
    display: block;
    width: 3px; height: 13px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--lime), var(--lime-d));
    box-shadow: 0 0 6px rgba(163,230,53,0.45);
    flex-shrink: 0;
  }
  .xsec-link {
    color: var(--lime); font-size: 10.5px; font-weight: 600;
    background: transparent; border: none; cursor: pointer;
    font-family: var(--fb);
    transition: opacity .13s;
  }
  .xsec-link:hover { opacity: .65; }

  /* ── Transaction rows ── */
  .tx-row  { display: flex; align-items: center; justify-content: space-between; }
  .tx-left { display: flex; align-items: center; gap: 9px; }
  .tx-ic {
    width: 32px; height: 32px; border-radius: var(--r1);
    display: flex; align-items: center; justify-content: center;
    background: var(--s2); border: 1px solid var(--b1);
    flex-shrink: 0;
  }
  .tx-ic.cr {
    background: rgba(163,230,53,0.1);
    border-color: rgba(163,230,53,0.22);
  }
  .tx-name  { font-family: var(--fb); color: var(--t1); font-size: 12.5px; font-weight: 500; }
  .tx-date  { color: var(--t3); font-size: 10.5px; margin-top: 1px; }
  .tx-amt   { font-family: var(--fd); font-weight: 700; font-size: 13px; color: var(--t1); }
  .tx-amt.cr { color: var(--lime); }
  .tx-stat  { color: rgba(163,230,53,0.5); font-size: 9px; font-weight: 600; letter-spacing: 0.04em; }

  /* ── Info boxes ── */
  .info-lime {
    background: rgba(163,230,53,0.06);
    border: 1px solid var(--lime-ring);
    border-radius: var(--r3); padding: 10px 12px;
  }
  .info-gold {
    background: var(--gold-d);
    border: 1px solid var(--gold-ring);
    border-radius: var(--r3); padding: 10px 12px;
  }

  /* ── Color utilities ── */
  .c-lime  { color: var(--lime); }
  .c-gold  { color: var(--gold); }
  .c-red   { color: #f87171; }
  .c-muted { color: var(--t2); }
  .c-dim   { color: var(--t3); }

  /* ── Avatar ── */
  .xav {
    border-radius: 50%;
    background: linear-gradient(135deg, var(--lime) 0%, var(--lime-d) 100%);
    display: flex; align-items: center; justify-content: center;
    color: #060e02; font-family: var(--fd); font-weight: 800;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(163,230,53,0.24);
  }
  .xav-sm { width: 32px; height: 32px; font-size: 12px; }
  .xav-md { width: 40px; height: 40px; font-size: 15px; }
  .xav-lg { width: 52px; height: 52px; font-size: 19px; }

  /* ── Icon chip ── */
  .ic-chip {
    width: 28px; height: 28px; border-radius: var(--r1);
    background: var(--s2); border: 1px solid var(--b1);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--t2); position: relative;
    transition: all .13s;
  }
  .ic-chip:hover { background: var(--s3); border-color: var(--lime-ring); color: var(--lime); }
  .notif-pip {
    position: absolute; top: -3px; right: -3px;
    width: 13px; height: 13px;
    background: var(--lime); border: 1.5px solid var(--bg);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 7.5px; font-weight: 800; color: #060e02;
  }

  /* ── Toggle ── */
  .xtog { width: 36px; height: 20px; border-radius: 10px; position: relative; cursor: pointer; transition: background .18s; flex-shrink: 0; }
  .xtog.on  { background: var(--lime); }
  .xtog.off { background: rgba(255,255,255,0.08); border: 1px solid var(--b1); }
  .xtog-thumb { width: 13px; height: 13px; border-radius: 50%; background: #fff; position: absolute; top: 3.5px; transition: all .18s; }
  .xtog.on  .xtog-thumb { right: 4px; left: auto; background: #060e02; }
  .xtog.off .xtog-thumb { left: 3.5px; }

  /* ── Copy row ── */
  .copy-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 11px; border-radius: var(--r2);
    background: var(--s1); border: 1px solid var(--b1);
  }
  .copy-val { color: var(--t1); font-family: var(--fm); font-size: 13px; }
  .copy-ic {
    padding: 4px; border-radius: 6px;
    background: rgba(163,230,53,0.09); border: none;
    cursor: pointer; display: flex; color: var(--lime);
    transition: background .13s;
  }
  .copy-ic:hover { background: rgba(163,230,53,0.18); }

  /* ── Bank select ── */
  .bank-sel {
    width: 100%; background: var(--s1);
    padding: 9px 11px; border-radius: var(--r2);
    color: var(--t1); outline: none;
    border: 1px solid var(--b1);
    font-size: 13px; font-family: var(--fb);
    cursor: pointer; transition: border-color .15s;
    appearance: none;
  }
  .bank-sel:focus { border-color: var(--lime-ring); box-shadow: 0 0 0 2.5px rgba(163,230,53,0.07); }
  .bank-sel option { background: #0c0f0a; }

  /* ── Quick action grid ── */
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 9px;
    margin-bottom: 16px;
  }
  .quick-btn {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    background: transparent; border: none; cursor: pointer;
  }
  .quick-icon {
    width: 50px; height: 50px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    transition: transform .16s, box-shadow .16s;
  }
  .quick-btn:hover .quick-icon { transform: scale(1.07) translateY(-2px); }
  .quick-btn:active .quick-icon { transform: scale(0.93); }
  .quick-lbl { color: var(--t2); font-size: 9.5px; font-weight: 500; font-family: var(--fb); }

  /* ── Services grid ── */
  .srv-grid  { display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; }
  .srv-item  { display: flex; flex-direction: column; align-items: center; gap: 6px; background: transparent; border: none; cursor: pointer; }
  .srv-icon  { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; transition: transform .16s; }
  .srv-item:hover .srv-icon  { transform: scale(1.07) translateY(-2px); }
  .srv-item:active .srv-icon { transform: scale(0.93); }
  .srv-lbl   { color: var(--t2); font-size: 9.5px; font-weight: 500; text-align: center; line-height: 1.3; font-family: var(--fb); }

  /* ── Gradient swatches ── */
  .g-purple{background:linear-gradient(145deg,#a855f7,#7c3aed);box-shadow:0 6px 18px rgba(168,85,247,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-blue  {background:linear-gradient(145deg,#3b82f6,#1d4ed8);box-shadow:0 6px 18px rgba(59,130,246,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-orange{background:linear-gradient(145deg,#f97316,#ea580c);box-shadow:0 6px 18px rgba(249,115,22,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-amber {background:linear-gradient(145deg,#d4a847,#b45309);box-shadow:0 6px 18px rgba(212,168,71,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-green {background:linear-gradient(145deg,#22c55e,#16a34a);box-shadow:0 6px 18px rgba(34,197,94,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-pink  {background:linear-gradient(145deg,#ec4899,#db2777);box-shadow:0 6px 18px rgba(236,72,153,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-indigo{background:linear-gradient(145deg,#6366f1,#4f46e5);box-shadow:0 6px 18px rgba(99,102,241,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-teal  {background:linear-gradient(145deg,#14b8a6,#0d9488);box-shadow:0 6px 18px rgba(20,184,166,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-lime  {background:linear-gradient(145deg,#a3e635,#65a30d);box-shadow:0 6px 18px rgba(163,230,53,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-rose  {background:linear-gradient(145deg,#f43f5e,#e11d48);box-shadow:0 6px 18px rgba(244,63,94,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-blue2 {background:linear-gradient(145deg,#3b82f6,#4f46e5);box-shadow:0 6px 18px rgba(79,70,229,0.35),inset 0 1px 0 rgba(255,255,255,0.14)}
  .g-inv1  {background:linear-gradient(145deg,#a3e635,#65a30d)}
  .g-inv2  {background:linear-gradient(145deg,#3b82f6,#4f46e5)}
  .g-inv3  {background:linear-gradient(145deg,#a855f7,#7c3aed)}
  .g-sav1  {background:linear-gradient(145deg,#f97316,#ea580c)}
  .g-sav2  {background:linear-gradient(145deg,#6366f1,#4f46e5)}
  .g-sav3  {background:linear-gradient(145deg,#ec4899,#db2777)}
  .net-mtn    {background:linear-gradient(145deg,#eab308,#ca8a04)}
  .net-glo    {background:linear-gradient(145deg,#22c55e,#16a34a)}
  .net-airtel {background:linear-gradient(145deg,#ef4444,#dc2626)}
  .net-9mobile{background:linear-gradient(145deg,#10b981,#059669)}
  .prov-dstv  {background:linear-gradient(145deg,#ef4444,#dc2626)}
  .prov-gotv  {background:linear-gradient(145deg,#22c55e,#16a34a)}
  .prov-startimes{background:linear-gradient(145deg,#3b82f6,#1d4ed8)}
  .prov-ikeja {background:linear-gradient(145deg,#eab308,#ca8a04)}
  .prov-eko   {background:linear-gradient(145deg,#3b82f6,#1d4ed8)}
  .prov-abuja {background:linear-gradient(145deg,#22c55e,#16a34a)}
  .prov-bet9ja    {background:linear-gradient(145deg,#eab308,#ca8a04)}
  .prov-sportybet {background:linear-gradient(145deg,#22c55e,#16a34a)}
  .prov-nairabet  {background:linear-gradient(145deg,#ef4444,#dc2626)}

  /* ── Spacing helpers ── */
  .row    { display:flex; align-items:center; gap:7px; }
  .row-sb { display:flex; align-items:center; justify-content:space-between; }
  .col    { display:flex; flex-direction:column; }
  .f1     { flex:1; }
  .sp-y>*+* { margin-top:8px; }
  .mb-2 { margin-bottom:8px }
  .mb-3 { margin-bottom:12px }
  .mb-4 { margin-bottom:18px }
  .mt-2 { margin-top:8px }
  .mt-3 { margin-top:12px }

  /* ── Keyframes ── */
  @keyframes pw-spin    { to{transform:rotate(360deg)} }
  @keyframes pw-shimmer { 0%,100%{opacity:.35} 50%{opacity:.75} }
  @keyframes pw-pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(163,230,53,.2)} 50%{box-shadow:0 0 0 8px rgba(163,230,53,0)} }
  @keyframes pw-fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pw-glow    { 0%,100%{box-shadow:0 0 16px rgba(163,230,53,.06)} 50%{box-shadow:0 0 32px rgba(163,230,53,.14)} }
  @keyframes pw-live    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.14)} }
  @keyframes pw-shimmer-sweep {
    0%   { left: -100%; }
    100% { left: 160%; }
  }
`;

const MAIN_TABS = new Set(["home","services","finance","transactions","account"]);
const BILLS_VIEWS = new Set(["airtime","data","tv","electricity","betting","giftcards","bills","services"]);
const WALLET_VIEWS = new Set(["send","receive","invest","save","cards"]);

const BACK_MAP = {
  airtime:"home", data:"home", tv:"services", electricity:"home",
  betting:"services", giftcards:"services", bills:"services",
  loans:"finance", send:"home", receive:"home",
  invest:"finance", save:"finance", cards:"finance",
  notifications:"home", transactions:"home",
};

const NAV_TABS = [
  { id:"home",         label:"Home",     icon:Home        },
  { id:"services",     label:"Services", icon:Zap         },
  { id:"finance",      label:"Finance",  icon:TrendingUp  },
  { id:"transactions", label:"History",  icon:History     },
  { id:"account",      label:"Account",  icon:User        },
];

export default function PayWaveApp({ onBack, userId }) {
  const { profile } = useAuth();
  const [page, setPage]             = useState("home");
  const [showBalance, setShowBalance] = useState(true);
  const [successMsg, setSuccessMsg]  = useState(null);
  const [pwBalance, setPwBalance]    = useState(0);
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
    } catch {}
    finally { setBalanceLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`pw_bal:${profile.id}`)
      .on("postgres_changes",{
        event:"UPDATE", schema:"public", table:"wallets",
        filter:`user_id=eq.${profile.id}`,
      },(payload) => {
        if (payload.new?.paywave_balance != null)
          setPwBalance(payload.new.paywave_balance);
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.id]);

  const [notifications, setNotifications] = useState([]);

  const goBack = () => {
    const dest = BACK_MAP[page];
    if (dest) { setPage(dest); return; }
    if (page === "home") { onBack?.(); return; }
    setPage("home");
  };

  const handleSuccess = (msg) => setSuccessMsg(msg);
  const clearSuccess  = () => { setSuccessMsg(null); setPage("home"); };

  const isMainTab   = MAIN_TABS.has(page);
  const activeNavId = isMainTab ? page : (BACK_MAP[page] ?? "home");

  const renderPage = () => {
    if (page === "home")
      return <HomeTab pwBalance={pwBalance} showBalance={showBalance}
        setShowBalance={setShowBalance} notifications={notifications}
        setPage={setPage} onBack={onBack} onRefresh={fetchBalance} />;
    if (page === "services")     return <ServicesTab setPage={setPage} />;
    if (page === "finance")      return <FinanceTab pwBalance={pwBalance} setPage={setPage} />;
    if (page === "transactions")
      return <TransactionsTab setPage={setPage} userId={profile?.id} onRefresh={fetchBalance} />;
    if (page === "account")
      return <AccountTab setPage={setPage} onSuccess={handleSuccess} />;
    if (BILLS_VIEWS.has(page))
      return <BillsTab view={page} onBack={goBack} onSuccess={handleSuccess} setPage={setPage} />;
    if (WALLET_VIEWS.has(page))
      return <FinanceSubView view={page} pwBalance={pwBalance} onBack={goBack}
        onSuccess={handleSuccess} userId={profile?.id} onRefresh={fetchBalance} />;
    if (page === "notifications")
      return <NotificationsTab notifications={notifications}
        setNotifications={setNotifications} onBack={goBack} />;

    return (
      <div className="pw-scroll" style={{ display:"flex", flexDirection:"column" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:12, padding:28 }}>
          <div style={{ width:52, height:52, borderRadius:"50%",
            background:"rgba(163,230,53,0.08)", border:"1px solid var(--lime-ring)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Zap size={22} color="var(--lime)" />
          </div>
          <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:800 }}>Coming Soon</div>
          <div style={{ color:"var(--t2)", fontSize:12, textAlign:"center", lineHeight:1.6 }}>
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
          <button className="pw-side-back" onClick={onBack} title="Back">
            <ArrowLeft size={13} />
          </button>
          <div className="pw-side-div" style={{ background:"rgba(212,168,71,0.22)" }} />
          <div className="pw-side-items">
            {NAV_TABS.map((tab) => (
              <button key={tab.id}
                className={`pw-side-btn ${activeNavId === tab.id ? "active" : ""}`}
                onClick={() => setPage(tab.id)} title={tab.label}>
                <div className="pw-side-icon"><tab.icon size={16} /></div>
                <span style={{ fontSize:"7.5px", letterSpacing:"0.03em" }}>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="pw-content">
          {renderPage()}
          <nav className="pw-nav">
            {NAV_TABS.map((tab) => (
              <button key={tab.id}
                className={`pw-nav-btn ${activeNavId === tab.id ? "active" : ""}`}
                onClick={() => setPage(tab.id)}>
                <tab.icon size={17} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {successMsg && <SuccessModal message={successMsg} onClose={clearSuccess} />}
      </div>
    </>
  );
}