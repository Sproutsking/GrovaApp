// paywave/PayWaveWrapper.jsx
// ─────────────────────────────────────────────────────────────
// PC layout shell — FIXED POSITION, viewport-anchored.
// Height is ALWAYS viewport height minus the app header.
// Nothing depends on parent container height.
//
// Usage:
//   <PayWaveWrapper onBack={() => setView("overview")} topOffset={87} />
//
//   topOffset = height in px of your app's fixed header bar (default 87)
//   Measure: Grova green bar (~40px) + window chrome (~47px) = ~87px
//   Or just pass the exact pixel value from your layout.
//
// On ≤767px  → mobile, full screen fixed overlay
// On 768–1099 → left collapsed (58px) + center fills
// On ≥1100px  → left (240px) + center fills + right (280px)
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import PayWaveApp from "./PayWaveApp";

const WRAPPER_CSS = `
  /* ── FIXED viewport-anchored shell ──────────────────────
     position: fixed  → always stays exactly where told
     top: var(--pw-top) → below app header, set via JS prop
     left/right/bottom: 0 → stretches edge to edge and to bottom
     z-index: 50 → sits above page content, below modals
  ─────────────────────────────────────────────────────── */
  /* ── PayWave fixed shell ───────────────────────────────────
     Values derived directly from Sidebar.jsx and global.css:
       Sidebar: left = calc(6% + 5px), width = 280px, top = 56px
       Header:  top = 56px (desktop-header height)
     So PayWave starts at:
       top:  56px                        (below the header)
       left: calc(6% + 5px + 280px)      (after the sidebar)
       right: 0, bottom: 0               (fills to screen edges)
  ────────────────────────────────────────────────────────── */
  .pw-layout {
    position: fixed;
    top: 56px;
    left: calc(6% + 5px + 280px);
    right: 0;
    bottom: 0;
    z-index: 49;               /* below sidebar (z-index: 50) but above content */
    display: flex;
    flex-direction: row;
    background: #07080a;
    overflow: hidden;
  }

  /* Mobile: full screen, sits above mobile header/nav */
  @media (max-width: 768px) {
    .pw-layout {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 200;
    }
  }

  /* ── Left sidebar — fixed height from parent ── */
  .pw-left {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 18px 12px;
    gap: 4px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    background: rgba(4,5,6,0.98);
    border-right: 1px solid rgba(255,255,255,0.06);
    /* height = 100% of fixed parent — guaranteed */
  }
  .pw-left::-webkit-scrollbar { display: none; }

  /* ── Center — fills all remaining width ── */
  .pw-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    box-shadow: inset 1px 0 0 rgba(163,230,53,0.04);
  }

  /* ── Right sidebar ── */
  .pw-right {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px 16px;
    scrollbar-width: none;
    background: rgba(4,5,6,0.95);
    border-left: 1px solid rgba(255,255,255,0.06);
  }
  .pw-right::-webkit-scrollbar { display: none; }

  /* ── Left sidebar styles ───────────────────── */
  .sb-logo {
    font-family: 'Syne', sans-serif;
    font-size: 17px; font-weight: 800;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #a3e635, #65a30d);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 0 4px 12px;
    border-bottom: 1px solid rgba(212,168,71,0.18);
    margin-bottom: 18px;
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }
  .sb-logo-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #d4a847;
    box-shadow: 0 0 8px rgba(212,168,71,0.5);
    flex-shrink: 0;
  }

  .sb-nav-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 10px;
    border: none; background: transparent;
    color: rgba(255,255,255,0.28);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 500;
    width: 100%; text-align: left;
    cursor: pointer; transition: all .15s;
    flex-shrink: 0;
  }
  .sb-nav-btn:hover { color: rgba(255,255,255,0.58); background: rgba(255,255,255,0.03); }
  .sb-nav-btn.active {
    color: #a3e635;
    background: rgba(163,230,53,0.07);
    border: 1px solid rgba(163,230,53,0.16);
  }
  .sb-nav-ic {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background .15s;
  }
  .sb-nav-btn.active .sb-nav-ic { background: rgba(163,230,53,0.12); }

  .sb-section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.1em; color: rgba(255,255,255,0.15);
    padding: 0 4px; margin: 14px 0 5px;
    flex-shrink: 0;
  }

  .sb-user {
    margin-top: auto;
    padding: 10px; border-radius: 12px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.055);
    display: flex; align-items: center; gap: 9px;
    transition: border-color .15s;
    flex-shrink: 0;
  }
  .sb-user:hover { border-color: rgba(163,230,53,0.14); }
  .sb-av {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #a3e635, #65a30d);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: 13px; color: #0a0e06; flex-shrink: 0;
    box-shadow: 0 2px 10px rgba(163,230,53,0.2);
  }

  /* ── Right sidebar widgets ─────────────────── */
  .rw-card {
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.055);
    background: rgba(255,255,255,0.02);
    flex-shrink: 0;
  }
  .rw-card.lime { border-color: rgba(163,230,53,0.13); background: rgba(163,230,53,0.03); }
  .rw-card.gold { border-color: rgba(212,168,71,0.18);  background: rgba(212,168,71,0.03); }

  .rw-card-title {
    font-family: 'Syne', sans-serif;
    font-size: 12.5px; font-weight: 700;
    margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .rw-card-title.lime { color: rgba(163,230,53,0.7); }
  .rw-card-title.gold { color: rgba(212,168,71,0.7); }

  .tag-chip {
    display: inline-flex; padding: 4px 10px;
    border-radius: 20px; background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.065);
    color: rgba(255,255,255,0.3); font-size: 11px;
    margin: 2.5px; cursor: pointer; transition: all .14s;
    font-family: 'DM Sans', sans-serif;
  }
  .tag-chip:hover {
    color: rgba(255,255,255,0.65);
    background: rgba(255,255,255,0.07);
    border-color: rgba(163,230,53,0.2);
  }

  .market-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .market-row:last-child { border-bottom: none; padding-bottom: 0; }

  .stat-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 9px;
  }
  .stat-row:last-child { margin-bottom: 0; }

  .rw-tip {
    font-size: 11px; line-height: 1.65;
    color: rgba(255,255,255,0.16);
    font-family: 'DM Sans', sans-serif;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px dashed rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .rw-tip span { color: rgba(163,230,53,0.45); }

  /* ── Responsive ────────────────────────────── */
  @media (max-width: 767px) {
    .pw-left, .pw-right { display: none; }
  }

  @media (min-width: 768px) and (max-width: 1099px) {
    .pw-left {
      width: 58px;
      padding: 18px 8px;
      align-items: center;
    }
    .sb-logo { font-size: 0; border: none; padding: 0; margin: 0 0 16px; justify-content: center; }
    .sb-logo::after { content: "G"; font-size: 18px; font-family: Syne, sans-serif; font-weight: 800; color: #a3e635; -webkit-text-fill-color: #a3e635; }
    .sb-logo-dot { display: none; }
    .sb-nav-btn { width: 40px; padding: 0; justify-content: center; border-radius: 10px; }
    .sb-nav-btn span.nav-label { display: none; }
    .sb-section-label { display: none; }
    .sb-user { padding: 8px; justify-content: center; }
    .sb-user-name { display: none; }
    .pw-right { display: none; }
  }
`;

const SI = ({ d, d2, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {d2 && <path d={d2} />}
  </svg>
);

const TRENDING = ["#Bitcoin", "#Fintech", "#PayWave", "#Savings", "#NGX", "#Crypto", "#Budget2025", "#Naira", "#Stocks"];

const MARKET = [
  { sym:"BTC/NGN", val:"₦72.4M", chg:"+2.4%", up:true  },
  { sym:"ETH/NGN", val:"₦3.8M",  chg:"+1.1%", up:true  },
  { sym:"USDT",    val:"₦1,585", chg:"+0.3%", up:true  },
  { sym:"BNB/NGN", val:"₦548K",  chg:"-0.8%", up:false },
];

const STATS = [
  { label:"Transactions", val:"4 today",  color:"rgba(255,255,255,0.55)" },
  { label:"Savings rate", val:"12% p.a.", color:"#a3e635"                },
  { label:"Cashback",     val:"₦20.75",   color:"#d4a847"                },
  { label:"Total saved",  val:"₦5,000",   color:"rgba(255,255,255,0.4)"  },
];

// topOffset = px height of your app's fixed top bar (Grova header).
// Measure it once and pass it in. Default covers most cases.
export default function PayWaveWrapper({ onBack }) {
  const [active, setActive] = useState("wallet");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        ${WRAPPER_CSS}
      `}</style>

      <div className="pw-layout">

          {/* ── CENTER — PayWave ─────────────────────── */}
          <main className="pw-center">
            <PayWaveApp onBack={onBack} />
          </main>

          {/* ── RIGHT SIDEBAR ────────────────────────── */}
          <aside className="pw-right">

            <div className="rw-card">
              <div className="rw-card-title" style={{ color:"rgba(255,255,255,0.35)" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(212,168,71,0.6)" strokeWidth={2.5}><path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" /></svg>
                Trending Now
              </div>
              <div style={{ display:"flex", flexWrap:"wrap" }}>
                {TRENDING.map(tag => <button key={tag} className="tag-chip">{tag}</button>)}
              </div>
            </div>

            <div className="rw-card lime">
              <div className="rw-card-title lime">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                Live Market
              </div>
              {MARKET.map(item => (
                <div key={item.sym} className="market-row">
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.38)", fontFamily:"DM Sans, sans-serif" }}>{item.sym}</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:"rgba(255,255,255,0.58)", fontFamily:"DM Sans, sans-serif" }}>{item.val}</div>
                    <div style={{ fontSize:10.5, fontWeight:600, color: item.up ? "#a3e635" : "#f87171" }}>{item.chg}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rw-card gold">
              <div className="rw-card-title gold">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Quick Stats
              </div>
              {STATS.map(({ label, val, color }) => (
                <div key={label} className="stat-row">
                  <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.24)", fontFamily:"DM Sans, sans-serif" }}>{label}</span>
                  <span style={{ fontSize:12, fontWeight:700, color, fontFamily:"DM Sans, sans-serif" }}>{val}</span>
                </div>
              ))}
            </div>

            <div className="rw-tip">
              💡 Invest <span>₦1,000/day</span> into OWealth to grow <span>₦365,000+/year</span> at 10% annual returns.
            </div>

          </aside>

        </div>
    </>
  );
}