// paywave/constants.js
// ─────────────────────────────────────────────────────────────
// All static data & CSS shared across the PayWave app.
// Import what you need; nothing here has side-effects.
// ─────────────────────────────────────────────────────────────

// ── Palette tokens ──────────────────────────────────────────
export const COLOR = {
  bg:           "#07080a",
  surface:      "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.055)",
  border:       "rgba(255,255,255,0.072)",
  // Lime — primary accent
  lime:         "#a3e635",         // tailwind lime-400
  limeDim:      "#84cc16",         // lime-500
  limeGlow:     "rgba(163,230,53,0.13)",
  limeBorder:   "rgba(163,230,53,0.22)",
  // Gold — compliment touch (used very sparingly ~1/10 of lime)
  gold:         "#d4a847",
  goldDim:      "rgba(212,168,71,0.15)",
  goldBorder:   "rgba(212,168,71,0.25)",
  // Text
  text:         "#eef0ee",
  textSoft:     "#7a8a80",
  textMuted:    "#3d4a40",
};

// ── Shared CSS injected once at root ───────────────────────
export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           ${COLOR.bg};
    --surface:      ${COLOR.surface};
    --surface-h:    ${COLOR.surfaceHover};
    --border:       ${COLOR.border};

    --lime:         ${COLOR.lime};
    --lime-dim:     ${COLOR.limeDim};
    --lime-glow:    ${COLOR.limeGlow};
    --lime-border:  ${COLOR.limeBorder};

    --gold:         ${COLOR.gold};
    --gold-dim:     ${COLOR.goldDim};
    --gold-border:  ${COLOR.goldBorder};

    --text:         ${COLOR.text};
    --text-soft:    ${COLOR.textSoft};
    --text-muted:   ${COLOR.textMuted};

    --font-d: 'Syne', sans-serif;
    --font-b: 'DM Sans', sans-serif;
    --font-m: 'DM Mono', monospace;

    --r-xs: 8px;
    --r-sm: 11px;
    --r:    15px;
    --r-lg: 20px;

    --nav-h:    66px;
    --header-h: 50px;
    --shell-w:  448px;
  }

  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-b);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Shell ────────────────────────────────────────────── */
  .pw-shell {
    position: fixed; inset: 0; z-index: 100;
    background: var(--bg);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .pw-shell {
      position: relative; inset: auto; z-index: auto;
      width: var(--shell-w); height: 100%;
      min-height: 100vh;
      border-left:  1px solid var(--border);
      border-right: 1px solid var(--border);
      background: #080b09;
      box-shadow: 0 0 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(163,230,53,0.04);
    }
  }

  /* ── Scrollable areas ─────────────────────────────────── */
  .pw-scroll, .pw-scroll-px {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding-bottom: calc(var(--nav-h) + 10px);
    scrollbar-width: none;
  }
  .pw-scroll-px { padding-left: 15px; padding-right: 15px; }
  .pw-scroll::-webkit-scrollbar, .pw-scroll-px::-webkit-scrollbar { display: none; }

  /* ── Glass card ───────────────────────────────────────── */
  .glass {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r);
    position: relative; overflow: hidden;
  }
  .glass::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(140deg, rgba(255,255,255,0.03) 0%, transparent 55%);
    pointer-events: none; border-radius: inherit;
  }
  .glass.click { cursor: pointer; transition: background .18s, border-color .15s, transform .12s; }
  .glass.click:hover  { background: var(--surface-h); border-color: rgba(255,255,255,0.1); }
  .glass.click:active { transform: scale(0.985); }

  /* lime accent card variant */
  .glass-lime {
    background: linear-gradient(140deg, rgba(163,230,53,0.07) 0%, rgba(132,204,22,0.04) 100%);
    border-color: var(--lime-border);
  }

  /* gold accent card variant (rare) */
  .glass-gold {
    background: linear-gradient(140deg, rgba(212,168,71,0.08) 0%, rgba(212,168,71,0.03) 100%);
    border-color: var(--gold-border);
  }

  /* ── Buttons ──────────────────────────────────────────── */
  .btn-lime {
    background: var(--lime);
    color: #0a0e06;
    font-family: var(--font-d);
    font-weight: 700; font-size: 13.5px; letter-spacing: 0.01em;
    padding: 11px 22px; border-radius: var(--r-sm);
    border: none; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    transition: all .18s;
    box-shadow: 0 6px 20px rgba(163,230,53,0.22), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .btn-lime:hover {
    background: #b5f015;
    box-shadow: 0 8px 28px rgba(163,230,53,0.32);
    transform: translateY(-1px);
  }
  .btn-lime:active  { transform: scale(0.97) translateY(0); }
  .btn-lime:disabled { opacity: 0.28; cursor: not-allowed; transform: none; }
  .btn-lime.full  { width: 100%; }
  .btn-lime.sm    { padding: 8px 14px; font-size: 12.5px; }

  .btn-ghost {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-b);
    font-weight: 500; font-size: 13.5px;
    padding: 11px 22px; border-radius: var(--r-sm);
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    transition: all .18s;
  }
  .btn-ghost:hover  { background: var(--surface-h); border-color: rgba(255,255,255,0.11); }
  .btn-ghost:active { transform: scale(0.97); }

  /* ── Header ───────────────────────────────────────────── */
  .pw-header {
    position: sticky; top: 0;
    height: var(--header-h);
    background: rgba(7,8,10,0.88);
    backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
    border-bottom: 1px solid var(--border);
    padding: 0 15px;
    display: flex; align-items: center; gap: 10px;
    z-index: 10; flex-shrink: 0;
  }
  .pw-back {
    width: 30px; height: 30px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all .15s;
  }
  .pw-back:hover { background: var(--surface-h); border-color: rgba(163,230,53,0.25); }
  .pw-header-title {
    font-family: var(--font-d);
    font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.01em;
  }

  /* ── Bottom nav ───────────────────────────────────────── */
  .pw-nav {
    position: sticky; bottom: 0;
    height: var(--nav-h);
    background: rgba(7,8,10,0.97);
    backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
    border-top: 1px solid var(--border);
    padding: 8px 4px; z-index: 20; flex-shrink: 0;
  }
  .pw-nav-inner { display: flex; align-items: center; justify-content: space-around; height: 100%; }
  .pw-nav-btn {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 14px; border-radius: var(--r-sm);
    border: none; background: transparent; color: var(--text-soft);
    cursor: pointer; transition: all .18s;
    font-family: var(--font-b); font-size: 9.5px; font-weight: 500; letter-spacing: 0.03em;
  }
  .pw-nav-btn:hover { color: rgba(255,255,255,0.55); }
  .pw-nav-btn.active {
    background: rgba(163,230,53,0.1);
    border: 1px solid var(--lime-border);
    color: var(--lime);
  }

  /* ── Form elements ────────────────────────────────────── */
  .f-section { padding: 15px; }
  .f-stack { display: flex; flex-direction: column; gap: 14px; }
  .f-label {
    font-family: var(--font-b); color: var(--text-soft); font-size: 11px;
    letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 6px;
  }
  .f-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-sm); padding: 11px 13px;
    transition: border-color .18s;
  }
  .f-card:focus-within { border-color: var(--lime-border); }
  .f-input {
    width: 100%; background: transparent; color: var(--text);
    border: none; outline: none; font-family: var(--font-b); font-size: 14px;
  }
  .f-input::placeholder { color: var(--text-muted); }
  .f-input-lg {
    width: 100%; background: transparent; color: var(--text);
    border: none; outline: none; font-family: var(--font-d); font-size: 24px; font-weight: 700;
  }
  .f-input-lg::placeholder { color: var(--text-muted); }

  /* ── Amount chips ─────────────────────────────────────── */
  .amt-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
  .amt-grid-6 { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
  .amt-btn {
    padding: 9px 6px; border-radius: var(--r-sm);
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-b); font-weight: 600; font-size: 12.5px;
    cursor: pointer; transition: all .15s; text-align: center;
  }
  .amt-btn.sel {
    background: rgba(163,230,53,0.12);
    border-color: var(--lime-border); color: var(--lime);
  }
  .amt-btn:hover:not(.sel) { background: var(--surface-h); }

  /* ── Network / Provider chips ─────────────────────────── */
  .net-grid  { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }
  .prov-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }

  .net-btn {
    aspect-ratio: 1; border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--font-d); font-weight: 700; font-size: 11.5px;
    border: 2px solid transparent; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.28); transition: transform .15s;
  }
  .net-btn:hover { transform: scale(1.04); }
  .net-btn.sel { border-color: var(--lime); box-shadow: 0 0 0 3px rgba(163,230,53,0.15); transform: scale(0.96); }

  .prov-btn {
    aspect-ratio: 16/9; border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--font-d); font-weight: 700; font-size: 11.5px;
    border: 2px solid transparent; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.28); transition: transform .15s;
  }
  .prov-btn:hover { transform: scale(1.04); }
  .prov-btn.sel { border-color: var(--lime); transform: scale(0.96); }

  /* ── Plan row button ──────────────────────────────────── */
  .plan-btn {
    width: 100%; padding: 12px 13px; border-radius: var(--r-sm);
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); text-align: left; cursor: pointer; transition: all .15s;
  }
  .plan-btn.sel {
    background: rgba(163,230,53,0.09);
    border-color: var(--lime-border);
    box-shadow: 0 4px 20px rgba(163,230,53,0.08);
  }
  .plan-btn:hover:not(.sel) { background: var(--surface-h); }

  /* ── Section header ───────────────────────────────────── */
  .sec-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .sec-title { font-family: var(--font-d); font-size: 13.5px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
  .sec-link { color: var(--lime); font-size: 11.5px; font-weight: 500; background: transparent; border: none; cursor: pointer; transition: opacity .15s; }
  .sec-link:hover { opacity: .7; }

  /* ── TX rows ──────────────────────────────────────────── */
  .tx-row  { display: flex; align-items: center; justify-content: space-between; }
  .tx-left { display: flex; align-items: center; gap: 10px; }
  .tx-icon { width: 34px; height: 34px; border-radius: var(--r-xs); display: flex; align-items: center; justify-content: center; background: var(--surface); border: 1px solid var(--border); flex-shrink: 0; }
  .tx-icon.cr { background: rgba(163,230,53,0.12); border-color: var(--lime-border); }
  .tx-title  { font-family: var(--font-b); color: var(--text); font-size: 13.5px; font-weight: 500; }
  .tx-date   { color: var(--text-soft); font-size: 11.5px; }
  .tx-amt    { font-family: var(--font-d); font-weight: 700; font-size: 13.5px; color: var(--text); }
  .tx-amt.cr { color: var(--lime); }
  .tx-status { color: var(--lime); font-size: 9.5px; }

  /* ── Info banners ─────────────────────────────────────── */
  .info-lime   { background: rgba(163,230,53,0.07); border: 1px solid var(--lime-border); border-radius: var(--r); padding: 12px 14px; }
  .info-gold   { background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--r); padding: 12px 14px; }
  .info-red    { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--r); padding: 12px 14px; }
  .info-blue   { background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.18); border-radius: var(--r); padding: 12px 14px; }

  .c-lime  { color: var(--lime); }
  .c-gold  { color: var(--gold); }
  .c-red   { color: #f87171; }
  .c-blue  { color: #60a5fa; }
  .c-muted { color: var(--text-soft); }

  /* ── Avatar ───────────────────────────────────────────── */
  .av {
    border-radius: 50%;
    background: linear-gradient(135deg, var(--lime) 0%, #65a30d 100%);
    display: flex; align-items: center; justify-content: center;
    color: #0a0e06; font-family: var(--font-d); font-weight: 800; flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(163,230,53,0.25);
  }
  .av-sm { width: 34px; height: 34px; font-size: 13px; }
  .av-lg { width: 54px; height: 54px; font-size: 20px; }

  /* ── Icon chip ────────────────────────────────────────── */
  .ic-chip {
    width: 31px; height: 31px; border-radius: var(--r-xs);
    background: var(--surface); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-soft); position: relative;
    transition: all .15s;
  }
  .ic-chip:hover { background: var(--surface-h); border-color: var(--lime-border); }
  .ic-chip:active { transform: scale(0.92); }
  .notif-pip {
    position: absolute; top: -3px; right: -3px;
    width: 14px; height: 14px;
    background: var(--lime); border: 1.5px solid var(--bg);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 700; color: #0a0e06;
  }

  /* ── Toggle ───────────────────────────────────────────── */
  .tog { width: 38px; height: 20px; border-radius: 10px; position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0; }
  .tog.on  { background: var(--lime); }
  .tog.off { background: #1c2018; border: 1px solid rgba(255,255,255,0.07); }
  .tog-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; position: absolute; top: 3px; transition: all .2s; }
  .tog.on  .tog-thumb { right: 3px; left: auto; background: #0a0e06; }
  .tog.off .tog-thumb { left: 3px; }

  /* ── Copy row ─────────────────────────────────────────── */
  .copy-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--border); }
  .copy-val { color: var(--text); font-family: var(--font-m); font-size: 14px; }
  .copy-ic  { padding: 5px; border-radius: 6px; background: rgba(163,230,53,0.1); border: none; cursor: pointer; display: flex; color: var(--lime); transition: background .15s; }
  .copy-ic:hover { background: rgba(163,230,53,0.18); }

  /* ── Bank select ──────────────────────────────────────── */
  .bank-sel { width: 100%; background: var(--surface); padding: 11px 13px; border-radius: var(--r-sm); color: var(--text); outline: none; border: 1px solid var(--border); font-size: 14px; font-family: var(--font-b); cursor: pointer; }
  .bank-sel:focus { border-color: var(--lime-border); }
  .bank-sel option { background: #0c0f0a; }

  /* ── Gradient icon swatches ───────────────────────────── */
  .g-purple { background: linear-gradient(135deg,#a855f7,#ec4899); }
  .g-blue   { background: linear-gradient(135deg,#3b82f6,#06b6d4); }
  .g-orange { background: linear-gradient(135deg,#f97316,#ef4444); }
  .g-yellow { background: linear-gradient(135deg,#eab308,#f97316); }
  .g-green  { background: linear-gradient(135deg,#22c55e,#10b981); }
  .g-pink   { background: linear-gradient(135deg,#ec4899,#f43f5e); }
  .g-indigo { background: linear-gradient(135deg,#6366f1,#a855f7); }
  .g-teal   { background: linear-gradient(135deg,#14b8a6,#06b6d4); }
  .g-lime   { background: linear-gradient(135deg,#a3e635,#65a30d); }
  .g-blue2  { background: linear-gradient(135deg,#3b82f6,#6366f1); }
  .g-rose   { background: linear-gradient(135deg,#f43f5e,#ec4899); }
  .g-red2   { background: linear-gradient(135deg,#ef4444,#f97316); }
  .g-inv1   { background: linear-gradient(135deg,#a3e635,#65a30d); }
  .g-inv2   { background: linear-gradient(135deg,#3b82f6,#6366f1); }
  .g-inv3   { background: linear-gradient(135deg,#a855f7,#ec4899); }
  .g-sav1   { background: linear-gradient(135deg,#f97316,#ef4444); }
  .g-sav2   { background: linear-gradient(135deg,#6366f1,#a855f7); }
  .g-sav3   { background: linear-gradient(135deg,#ec4899,#f43f5e); }
  .net-mtn      { background: linear-gradient(135deg,#eab308,#ca8a04); }
  .net-glo      { background: linear-gradient(135deg,#22c55e,#16a34a); }
  .net-airtel   { background: linear-gradient(135deg,#ef4444,#dc2626); }
  .net-9mobile  { background: linear-gradient(135deg,#10b981,#059669); }
  .prov-dstv    { background: linear-gradient(135deg,#ef4444,#dc2626); }
  .prov-gotv    { background: linear-gradient(135deg,#22c55e,#16a34a); }
  .prov-startimes{ background: linear-gradient(135deg,#3b82f6,#2563eb); }
  .prov-ikeja   { background: linear-gradient(135deg,#eab308,#ca8a04); }
  .prov-eko     { background: linear-gradient(135deg,#3b82f6,#2563eb); }
  .prov-abuja   { background: linear-gradient(135deg,#22c55e,#16a34a); }
  .prov-bet9ja  { background: linear-gradient(135deg,#eab308,#ca8a04); }
  .prov-sportybet{ background: linear-gradient(135deg,#22c55e,#16a34a); }
  .prov-nairabet{ background: linear-gradient(135deg,#ef4444,#dc2626); }

  /* ── Layout helpers ───────────────────────────────────── */
  .row    { display: flex; align-items: center; gap: 8px; }
  .row-sb { display: flex; align-items: center; justify-content: space-between; }
  .col    { display: flex; flex-direction: column; }
  .f1     { flex: 1; }
  .space-y > * + * { margin-top: 8px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 13px; }
  .mb-4 { margin-bottom: 18px; }
  .mt-3 { margin-top: 13px; }

  /* ── Quick action grid (Home) ─────────────────────────── */
  .quick-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; margin-bottom: 16px; }
  .quick-btn  { display: flex; flex-direction: column; align-items: center; gap: 6px; background: transparent; border: none; cursor: pointer; }
  .quick-icon { width: 50px; height: 50px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.32); transition: transform .15s; }
  .quick-btn:hover  .quick-icon { transform: scale(1.07) translateY(-1px); }
  .quick-btn:active .quick-icon { transform: scale(0.93); }
  .quick-label { color: var(--text-soft); font-size: 9.5px; font-weight: 500; }

  /* ── Services grid ────────────────────────────────────── */
  .srv-grid  { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
  .srv-item  { display: flex; flex-direction: column; align-items: center; gap: 6px; background: transparent; border: none; cursor: pointer; }
  .srv-icon  { width: 50px; height: 50px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.32); transition: transform .15s; }
  .srv-item:hover  .srv-icon { transform: scale(1.07) translateY(-1px); }
  .srv-item:active .srv-icon { transform: scale(0.93); }
  .srv-label { color: var(--text-soft); font-size: 9.5px; font-weight: 500; text-align: center; line-height: 1.3; }
`;

// ── App data ─────────────────────────────────────────────────
export const NETWORKS = [
  { id:"mtn",    name:"MTN",    cls:"net-mtn"    },
  { id:"glo",    name:"GLO",    cls:"net-glo"    },
  { id:"airtel", name:"Airtel", cls:"net-airtel" },
  { id:"9mob",   name:"9M",     cls:"net-9mobile"},
];

export const DATA_PLANS = [
  { id:1, size:"1GB",  dur:"1 Day",   price:250,  back:1.75 },
  { id:2, size:"2GB",  dur:"2 Days",  price:500,  back:5    },
  { id:3, size:"5GB",  dur:"7 Days",  price:1500, back:15   },
  { id:4, size:"10GB", dur:"30 Days", price:3000, back:30   },
];

export const TV_PROVS = [
  { id:"dstv",      name:"DSTV",      cls:"prov-dstv"      },
  { id:"gotv",      name:"GOTV",      cls:"prov-gotv"      },
  { id:"startimes", name:"Startimes", cls:"prov-startimes" },
];

export const TV_PLANS = [
  { id:1, name:"Basic",   price:2000  },
  { id:2, name:"Premium", price:5000  },
  { id:3, name:"Ultimate",price:10000 },
];

export const ELEC_PROVS = [
  { id:"ikeja", name:"Ikeja Electric", cls:"prov-ikeja" },
  { id:"eko",   name:"Eko Electric",   cls:"prov-eko"   },
  { id:"abuja", name:"Abuja Electric", cls:"prov-abuja" },
];

export const BET_PROVS = [
  { id:"bet9ja",    name:"Bet9ja",    cls:"prov-bet9ja"    },
  { id:"sportybet", name:"Sportybet", cls:"prov-sportybet" },
  { id:"nairabet",  name:"Nairabet",  cls:"prov-nairabet"  },
];

export const GIFT_CARDS = [
  { id:1, name:"Amazon",      min:1000 },
  { id:2, name:"Google Play", min:500  },
  { id:3, name:"iTunes",      min:2000 },
];

export const BILL_TYPES = [
  { id:1, name:"Water Bill",   icon:"Zap"       },
  { id:2, name:"Internet Bill",icon:"Wifi"      },
  { id:3, name:"School Fees",  icon:"Building2" },
];

export const LOAN_PLANS = [
  { id:1, name:"Quick Loan",    rate:"5%",  max:5000,  desc:"Instant approval" },
  { id:2, name:"Personal Loan", rate:"10%", max:50000, desc:"Flexible terms"   },
];

export const BANKS = [
  { id:"palmpay",    name:"Palmpay"    },
  { id:"opay",       name:"OPay"       },
  { id:"moniepoint", name:"Moniepoint" },
  { id:"access",     name:"Access Bank"},
  { id:"gtb",        name:"GTBank"     },
];

export const TRANSACTIONS = [
  { id:1, type:"credit", title:"OWealth Interest",  amount:0.09,  date:"Jan 9, 02:33", status:"Successful" },
  { id:2, type:"debit",  title:"Airtime Purchase",  amount:100.0, date:"Jan 6, 02:31", status:"Successful" },
  { id:3, type:"credit", title:"Money Received",    amount:500.0, date:"Jan 5, 14:20", status:"Successful" },
  { id:4, type:"debit",  title:"Data Purchase",     amount:250.0, date:"Jan 4, 09:15", status:"Successful" },
];