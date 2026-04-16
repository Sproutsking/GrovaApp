// ============================================================================
// src/components/Auth/AuthWall.jsx — v21 ELEVATED_BEAUTY
// ============================================================================
//
// WHAT CHANGED FROM v20:
//   [DESIGN-1] Left panel elevated: copied BrandPanel richness from PaywallGate —
//              animated node graph SVG, richer feature cards, avatar stack,
//              stat counters, trust strip. Deeper visual hierarchy.
//
//   [DESIGN-2] Provider buttons redesigned from ground up:
//              - Default state: a subtle but visible glowing arc orbits the button
//                continuously (always on, not just on hover).
//              - Hover state: arc brightens, speeds up, button surface lifts with
//                a directional color sweep. Arrow appears.
//              - The conic border is now a proper thin orbiting arc — NOT wings —
//                achieved with a radial-gradient mask that cuts a clean ring,
//                so only a tight ~60° luminous arc travels around the perimeter.
//
//   [DESIGN-3] Mobile-first layout overhaul:
//              - Left panel hidden on mobile (< 768px)
//              - Right panel fills full width with tight, elegant padding
//              - Provider buttons stack beautifully on small screens
//              - PaywallGate mobile: reduced padding, tighter spacing throughout
//
//   [FIX-1]   All DB fetching logic unchanged from v20.
//   [FIX-2]   PaywallGate mobile: override .xv-paywall-scroll padding on mobile
//             from 36px/44px to 16px/20px; brand panel hidden below 768px.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import authService from "../../services/auth/authService";
import PaywallGate from "./PaywallGate";
import { supabase } from "../../services/config/supabase";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg:    #050706;
    --lime:  #a8e63d;
    --lime2: #c8f56a;
    --red:   #e05252;
    --text:  #dde8dd;
    --dim:   #2a3a2a;
    --dim2:  #1a2a1a;
  }

  /* ── Core keyframes ── */
  @keyframes S_letter {
    0%   { opacity:0; transform:translateY(-52px) scaleY(1.22); filter:blur(10px); }
    50%  { opacity:1; transform:translateY(5px) scaleY(0.96);   filter:blur(0); }
    75%  { transform:translateY(-2px) scaleY(1.01); }
    100% { opacity:1; transform:translateY(0) scaleY(1); }
  }
  @keyframes S_tagline { from{opacity:0;letter-spacing:18px} to{opacity:0.55;letter-spacing:6px} }
  @keyframes S_arc { 0%{stroke-dashoffset:251;opacity:0.1} 45%{stroke-dashoffset:35;opacity:1} 100%{stroke-dashoffset:251;opacity:0.1} }
  @keyframes S_scan   { from{top:-1px} to{top:100vh} }
  @keyframes S_glow   { 0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} }
  @keyframes XV_fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes XV_riseIn { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes XV_spin   { to{transform:rotate(360deg)} }
  @keyframes CK_ring   { from{stroke-dashoffset:289} to{stroke-dashoffset:0} }
  @keyframes CK_tick   { from{stroke-dashoffset:90;opacity:0} 8%{opacity:1} to{stroke-dashoffset:0;opacity:1} }
  @keyframes CK_disc   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes CK_pulse  { 0%{transform:scale(1);filter:drop-shadow(0 0 0px rgba(168,230,61,0))} 40%{transform:scale(1.12);filter:drop-shadow(0 0 28px rgba(168,230,61,.7))} 100%{transform:scale(1);filter:drop-shadow(0 0 8px rgba(168,230,61,.25))} }
  @keyframes CK_halo   { 0%{transform:translate(-50%,-50%) scale(.8);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
  @keyframes XK_ring   { from{stroke-dashoffset:289} to{stroke-dashoffset:0} }
  @keyframes XK_line   { from{stroke-dashoffset:80;opacity:0} 8%{opacity:1} to{stroke-dashoffset:0;opacity:1} }
  @keyframes XK_disc   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }

  /* ── Left panel ambient ── */
  @keyframes LP_orb1      { 0%,100%{transform:translate(0,0)} 50%{transform:translate(22px,-18px)} }
  @keyframes LP_orb2      { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-18px,14px)} }
  @keyframes LP_pulse     { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.55)} }
  @keyframes LP_shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes LP_rise      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes LP_nodePulse { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes LP_dash      { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
  @keyframes LP_linePulse { 0%,100%{stroke-opacity:.22} 50%{stroke-opacity:.7} }

  /*
   * ── Provider button orbiting arc border ──
   *
   * Strategy: .pb-arc-track is an absolutely positioned div that
   * ALWAYS rotates (animation:ARC_orbit). It contains .pb-arc-conic
   * which has a conic-gradient (bright 60-deg arc + transparent rest).
   * A radial-gradient mask on .pb-arc-conic punches out the center,
   * revealing ONLY a thin ring at the perimeter — no "wings" or fill.
   * Default opacity: 0.38 (always visible). Hover: 1.0, faster spin.
   */
  @keyframes ARC_orbit { to { transform: rotate(360deg); } }
  @keyframes PB_sweep  { from{transform:scaleX(0)} to{transform:scaleX(1)} }

  .xv, .xv * { box-sizing:border-box; }
  .xv { font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }

  /* ── Left panel value rows ── */
  .lp-value-row {
    display:flex;align-items:flex-start;gap:10px;
    padding:10px 12px;
    background:rgba(255,255,255,.018);
    border:1px solid rgba(168,230,61,.07);
    border-radius:11px;
    transition:border-color .22s,background .22s,transform .2s;
    cursor:default;
  }
  .lp-value-row:hover {
    border-color:rgba(168,230,61,.18);
    background:rgba(168,230,61,.025);
    transform:translateX(3px);
  }
  .lp-icon-box {
    width:30px;height:30px;border-radius:8px;
    background:rgba(168,230,61,.07);border:1px solid rgba(168,230,61,.12);
    display:flex;align-items:center;justify-content:center;
    font-size:14px;flex-shrink:0;
    transition:background .22s,border-color .22s;
  }
  .lp-value-row:hover .lp-icon-box {
    background:rgba(168,230,61,.13);border-color:rgba(168,230,61,.26);
  }
  .lp-stat-box {
    flex:1;background:rgba(255,255,255,.016);border:1px solid rgba(168,230,61,.08);
    border-radius:9px;padding:8px 10px;text-align:center;
    position:relative;overflow:hidden;
    transition:border-color .22s,transform .2s;
  }
  .lp-stat-box::before {
    content:"";position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(168,230,61,.14),transparent);
  }
  .lp-stat-box:hover { border-color:rgba(168,230,61,.2); transform:translateY(-2px); }
  .lp-shimmer {
    background:linear-gradient(90deg,#a8e63d 0%,#d4fc72 25%,#5a9a10 50%,#d4fc72 75%,#a8e63d 100%);
    background-size:200% auto;
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    animation:LP_shimmer 4s linear infinite;
  }
  .lp-feat-card {
    background:rgba(255,255,255,.014);
    border:1px solid rgba(168,230,61,.065);
    border-radius:10px;
    padding:10px 10px;
    transition:border-color .2s,background .2s;
    cursor:default;
  }
  .lp-feat-card:hover {
    border-color:rgba(168,230,61,.15);
    background:rgba(168,230,61,.018);
  }

  /* ── Provider button wrap ── */
  .pb-wrap {
    position:relative;
    border-radius:14px;
    margin-bottom:7px;
  }

  /* The rotating container — always spinning, always present */
  .pb-arc-track {
    position:absolute;
    inset:-1.5px;
    border-radius:15.5px;
    pointer-events:none;
    z-index:0;
    /* default: dim but visible */
    opacity:0.38;
    transition:opacity .3s ease, animation-duration .3s;
    animation:ARC_orbit 3.8s linear infinite;
    will-change:transform;
  }
  .pb-wrap:hover .pb-arc-track {
    opacity:1;
    animation-duration:1.7s;
  }

  /*
   * The arc element itself: conic-gradient + mask.
   * The radial-gradient mask hollows out everything except the 2.5px border ring.
   * This is the key fix that eliminates the "wings" / filled-center.
   */
  .pb-arc-conic {
    position:absolute;
    inset:0;
    border-radius:inherit;
    -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
    mask:radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
    /* background (conic) is set inline per provider */
  }

  /* Inner button surface */
  .pb-inner {
    position:relative;
    z-index:1;
    display:grid;
    grid-template-columns:44px 1fr 28px;
    align-items:center;
    width:100%;
    padding:13px 14px;
    border-radius:13px;
    cursor:pointer;
    font-family:'DM Sans',sans-serif;
    transition:background .25s,border-color .25s,transform .15s,box-shadow .25s;
    overflow:hidden;
  }
  .pb-wrap:hover .pb-inner { transform:translateY(-1px); }

  .pb-sweep {
    position:absolute;inset:0;
    transform:scaleX(0);transform-origin:left;
    pointer-events:none;
  }
  .pb-wrap:hover .pb-sweep {
    animation:PB_sweep .42s cubic-bezier(.23,1,.32,1) forwards;
  }
  .pb-icon  { display:flex;align-items:center;justify-content:center; }
  .pb-label { font-size:13px;font-weight:500;text-align:center;transition:color .2s; }
  .pb-arrow { display:flex;align-items:center;justify-content:flex-end;transition:opacity .25s; }

  /* ── Avatar stack ── */
  .lp-avatar {
    width:26px;height:26px;border-radius:50%;
    border:2px solid #020804;
    display:flex;align-items:center;justify-content:center;
    font-size:9px;font-weight:800;color:#040a00;
    flex-shrink:0;overflow:hidden;
    transition:transform .2s;
  }
  .lp-avatar:hover { transform:translateY(-3px); z-index:10!important; }

  /* ─────────────────── MOBILE ─────────────────── */
  @media (max-width:768px) {
    .xv-left  { display:none !important; }
    .xv-right {
      flex:1 1 100% !important;
      padding:0 !important;
      align-items:flex-start !important;
      border-left:none !important;
    }
    .xv-right-inner {
      width:100% !important;
      max-width:100% !important;
      padding:36px 22px 44px !important;
    }
  }

  /* ── PaywallGate mobile overrides — injected here to tighten its layout ── */
  @media (max-width:768px) {
    .xv-brand      { display:none !important; }
    .xv-paywall-side   { width:100% !important; }
    .xv-paywall-scroll {
      padding:14px 16px 44px !important;
      max-width:100% !important;
    }
    .xv-signout-bar {
      margin-bottom:12px !important;
      padding:8px 10px !important;
      border-radius:10px !important;
    }
    .xv-card {
      border-radius:12px !important;
    }
    .xv-feat-grid {
      gap:5px !important;
    }
    .xv-feat-card {
      padding:8px 7px !important;
      border-radius:9px !important;
    }
    .xv-btn-lime,
    .xv-btn-wl,
    .xv-btn-vip {
      padding:14px 16px !important;
      font-size:14px !important;
      border-radius:12px !important;
    }
  }
`;

// ─── Shared atoms ─────────────────────────────────────────────────────────────
const Grain = () => (
  <svg aria-hidden style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0,opacity:0.03}}>
    <filter id="xvg2">
      <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#xvg2)"/>
  </svg>
);

const Corners = ({ color = "rgba(168,230,61,0.26)" }) => (
  <div aria-hidden style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1}}>
    {[
      {s:{top:14,left:14},    p:"M0 24 L0 0 L24 0"},
      {s:{top:14,right:14},   p:"M0 0 L24 0 L24 24"},
      {s:{bottom:14,left:14}, p:"M0 0 L0 24 L24 24"},
      {s:{bottom:14,right:14},p:"M0 24 L24 24 L24 0"},
    ].map((c,i)=>(
      <svg key={i} style={{position:"absolute",...c.s,width:24,height:24}} viewBox="0 0 24 24" fill="none">
        <path d={c.p} stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ))}
  </div>
);

const ScanLine = () => (
  <div aria-hidden style={{position:"absolute",left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(168,230,61,.04),rgba(168,230,61,.09),rgba(168,230,61,.04),transparent)",animation:"S_scan 9s linear infinite",pointerEvents:"none",zIndex:1}}/>
);

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────
export function SuccessScreen({ provider }) {
  const name = provider ? provider[0].toUpperCase()+provider.slice(1) : "";
  const R=46, C=2*Math.PI*R;
  return (
    <div style={{position:"fixed",inset:0,background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,overflow:"hidden",animation:"XV_fadeIn .3s ease"}} className="xv">
      <style>{CSS}</style><Grain/><Corners/><ScanLine/>
      <div aria-hidden style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.09) 0%,transparent 65%)",animation:"S_glow 5s ease-in-out infinite",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"relative",marginBottom:44,zIndex:2}}>
        {[0,1,2].map(i=><div key={i} aria-hidden style={{position:"absolute",top:"50%",left:"50%",width:120,height:120,borderRadius:"50%",border:"1.5px solid rgba(168,230,61,.35)",animation:`CK_halo 2s ease ${1.4+i*.55}s infinite`,pointerEvents:"none"}}/>)}
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden style={{animation:"CK_pulse .55s ease 1.25s 1 both",position:"relative",zIndex:2}}>
          <circle cx="60" cy="60" r="44" fill="rgba(168,230,61,.08)" style={{animation:"CK_disc .35s cubic-bezier(.34,1.56,.64,1) .78s both",opacity:0,transformOrigin:"60px 60px"}}/>
          <circle cx="60" cy="60" r={R} stroke="rgba(168,230,61,.07)" strokeWidth="2" fill="none"/>
          <circle cx="60" cy="60" r={R} stroke="var(--lime)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} style={{animation:`CK_ring .72s cubic-bezier(.4,0,.2,1) .1s forwards`,transformOrigin:"60px 60px",transform:"rotate(-90deg)"}}/>
          <path d="M37 60 L52 75 L83 40" stroke="var(--lime2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="90" strokeDashoffset="90" style={{animation:"CK_tick .42s cubic-bezier(.4,0,.2,1) .82s forwards",opacity:0}}/>
        </svg>
      </div>
      <div style={{textAlign:"center",zIndex:2,maxWidth:300,padding:"0 24px",animation:"XV_riseIn .6s ease 1.4s both",opacity:0}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(28px,5vw,36px)",fontWeight:700,color:"var(--text)",letterSpacing:"-0.5px",lineHeight:1.2,marginBottom:10}}>You're in.</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.8}}>Signed in via <span style={{color:"var(--lime)",fontWeight:600}}>{name}</span><br/>Taking you to Xeevia…</div>
      </div>
      <div aria-hidden style={{position:"absolute",bottom:28,fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:"8px",color:"#111a11",animation:"XV_fadeIn 1s ease 2s both",opacity:0}}>XEEVIA</div>
    </div>
  );
}

// ─── DECLINED SCREEN ──────────────────────────────────────────────────────────
export function DeclinedScreen({ message, onRetry }) {
  const R=46, C=2*Math.PI*R;
  return (
    <div style={{position:"fixed",inset:0,background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,overflow:"hidden",padding:"0 24px",animation:"XV_fadeIn .3s ease"}} className="xv">
      <style>{CSS}</style><Grain/><Corners color="rgba(224,82,82,.28)"/><ScanLine/>
      <div aria-hidden style={{position:"absolute",top:"38%",left:"50%",transform:"translate(-50%,-50%)",width:380,height:380,borderRadius:"50%",background:"radial-gradient(circle,rgba(224,82,82,.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div style={{position:"relative",marginBottom:44,zIndex:2}}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
          <circle cx="60" cy="60" r="44" fill="rgba(224,82,82,.07)" style={{animation:"XK_disc .35s cubic-bezier(.34,1.56,.64,1) .76s both",opacity:0,transformOrigin:"60px 60px"}}/>
          <circle cx="60" cy="60" r={R} stroke="rgba(224,82,82,.07)" strokeWidth="2" fill="none"/>
          <circle cx="60" cy="60" r={R} stroke="var(--red)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} style={{animation:`XK_ring .68s cubic-bezier(.4,0,.2,1) .1s forwards`,transformOrigin:"60px 60px",transform:"rotate(-90deg)"}}/>
          <path d="M38 38 L82 82" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="80" style={{animation:"XK_line .26s ease .8s forwards",opacity:0}}/>
          <path d="M82 38 L38 82" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="80" style={{animation:"XK_line .26s ease .98s forwards",opacity:0}}/>
        </svg>
      </div>
      <div style={{textAlign:"center",zIndex:2,maxWidth:300,animation:"XV_riseIn .55s ease 1.2s both",opacity:0}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(24px,4vw,30px)",fontWeight:700,color:"var(--text)",letterSpacing:"-0.3px",marginBottom:10}}>Sign-in cancelled</div>
        <p style={{fontSize:14,color:"#4a2a2a",lineHeight:1.8,marginBottom:32}}>{message||"The sign-in was cancelled or couldn't be completed."}</p>
        <button onClick={onRetry} style={{width:"100%",maxWidth:260,padding:"15px 0",borderRadius:100,border:"none",background:"rgba(224,82,82,.12)",color:"#e05252",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.2px",transition:"background .2s",outline:"1.5px solid rgba(224,82,82,.25)"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(224,82,82,.2)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(224,82,82,.12)"}
        >Try again</button>
      </div>
    </div>
  );
}

// ─── LEFT PANEL ───────────────────────────────────────────────────────────────
function LeftPanel() {
  const [memberCount, setMemberCount] = useState(null);
  const [epGrant, setEpGrant] = useState(300);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          if (data.value.member_count != null) setMemberCount(data.value.member_count);
          if (data.value.ep_grant != null) setEpGrant(data.value.ep_grant);
        }
      })
      .catch(() => {});

    supabase
      .from("profiles")
      .select("id,full_name,avatar_id")
      .is("deleted_at", null)
      .not("full_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => { if (data?.length) setRecentUsers(data); })
      .catch(() => {});
  }, []);

  const fmtCount = (n) => {
    if (n == null) return null;
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString();
  };

  function buildAvatarUrl(avatarId) {
    if (!avatarId) return null;
    if (avatarId.startsWith("http")) return avatarId;
    const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL ?? "";
    return `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarId}?width=60&height=60&resize=cover&format=webp`;
  }

  const ACCENT_COLORS = ["#a8e63d","#84cc16","#65a30d","#d4fc72"];

  const VALUE_PROPS = [
    { icon:"⚡", title:"Engagement Has Weight", body:"Every action costs something and means something. No bots. No fake reach." },
    { icon:"💸", title:"Creators Keep 84%",    body:"84% of every EP tip lands directly in your wallet — not the platform's." },
    { icon:"⛓",  title:"XRC Protocol",          body:"Every like, post and transaction is cryptographically recorded. Yours permanently." },
  ];

  const FEATURES = [
    { n:"01", icon:"🔒", title:"Private & Yours",    sub:"Your data, your rules" },
    { n:"02", icon:"⚡", title:`${epGrant} EP on join`, sub:"Instant reward"       },
    { n:"03", icon:"♾️",  title:"Lifetime access",     sub:"No renewals ever"      },
  ];

  const ECO_STATS = [
    { value:"$1 = 100 EP", label:"Fixed EP Rate",  note:"stable"       },
    { value:"84%",          label:"Creator Share", note:"of every tip" },
    { value:"1T XEV",       label:"Token Supply",  note:"hard cap"     },
  ];

  // Animated node graph (same as PaywallGate BrandPanel)
  const NODE_PATHS = [
    "M110,160 L275,255","M275,255 L450,185","M275,255 L295,415",
    "M295,415 L155,475","M295,415 L465,495","M450,185 L530,305",
    "M530,305 L465,495","M155,475 L75,580","M465,495 L545,595",
    "M110,160 L75,75","M450,185 L530,95","M295,415 L370,530",
    "M275,255 L160,330","M160,330 L75,580",
  ];
  const NODE_CIRCLES = [
    [110,160,5.5],[275,255,8],[450,185,5],[295,415,7],[155,475,4.5],
    [465,495,6],[530,305,5],[75,580,4],[545,595,4],[75,75,4.5],
    [530,95,4.5],[370,530,5],[160,330,5],
  ];

  return (
    <div style={{
      width:"100%", height:"100dvh",
      position:"relative", overflow:"hidden",
      display:"flex", flexDirection:"column",
      padding:"24px 30px 20px",
      background:"#020804",
    }}>
      {/* Ambient orbs */}
      <div aria-hidden style={{position:"absolute",top:-90,left:-80,width:360,height:360,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.09) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"LP_orb1 20s ease-in-out infinite"}}/>
      <div aria-hidden style={{position:"absolute",bottom:-120,right:-80,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.055) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"LP_orb2 26s ease-in-out infinite"}}/>

      {/* Animated node graph — behind all content */}
      <svg aria-hidden style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.45,pointerEvents:"none",zIndex:0}} viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="lpng" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a8e63d" stopOpacity="1"/>
            <stop offset="100%" stopColor="#a8e63d" stopOpacity="0"/>
          </radialGradient>
          <filter id="lpglow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        {NODE_PATHS.map((d,i)=>(
          <path key={i} d={d} stroke="rgba(168,230,61,.5)" strokeWidth="1.1" fill="none"
            strokeDasharray="7 13"
            style={{
              animation:`LP_dash ${3.5+i*.3}s linear infinite, LP_linePulse ${2+i*.2}s ease-in-out infinite`,
              animationDelay:`${i*.25}s`,
            }}
          />
        ))}
        {NODE_CIRCLES.map(([cx,cy,r],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="url(#lpng)" filter="url(#lpglow)"
            style={{animation:`LP_nodePulse ${2.2+i*.38}s ease-in-out infinite`,animationDelay:`${i*.21}s`}}
          />
        ))}
      </svg>

      {/* Dot grid */}
      <div aria-hidden style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,opacity:.011,backgroundImage:"radial-gradient(rgba(168,230,61,.9) 1px,transparent 1px)",backgroundSize:"22px 22px"}}/>
      {/* Right separator */}
      <div aria-hidden style={{position:"absolute",right:0,top:"8%",bottom:"8%",width:1,background:"linear-gradient(to bottom,transparent,rgba(168,230,61,.08) 30%,rgba(168,230,61,.08) 70%,transparent)",zIndex:2}}/>

      {/* All content */}
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>

        {/* ── Logo ── */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,animation:"LP_rise .5s ease both",animationFillMode:"forwards",opacity:0}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#a8e63d,#4d7c0f)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(168,230,61,.22)",flexShrink:0}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:900,color:"#040a00",lineHeight:1}}>X</span>
          </div>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:"6px",color:"#4a7a1a",lineHeight:1}}>XEEVIA</div>
            <div style={{fontSize:7,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"#2a4a1a",marginTop:1}}>The First True SocialFi Economy</div>
          </div>
        </div>

        {/* ── Headline ── */}
        <div style={{marginBottom:10,animation:"LP_rise .55s ease .08s both",animationFillMode:"forwards",opacity:0}}>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(20px,2.2vw,31px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-1.6px",margin:"0 0 7px",color:"#edf5ed"}}>
            Your social life,<br/>
            <span className="lp-shimmer">renewed.</span>
          </h1>
          <p style={{fontSize:10.5,color:"#2e4a2e",lineHeight:1.72,maxWidth:310,margin:0}}>
            A private social experience built for people who want more — real connections,
            genuine community, and a platform that actually belongs to you.
          </p>
        </div>

        {/* ── Live member badge ── */}
        <div style={{
          display:"inline-flex",alignItems:"center",gap:8,
          background:"rgba(168,230,61,.042)",border:"1px solid rgba(168,230,61,.12)",
          borderRadius:100,padding:"4px 11px",marginBottom:11,
          alignSelf:"flex-start",
          animation:"LP_rise .5s ease .16s both",animationFillMode:"forwards",opacity:0,
        }}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#a8e63d",flexShrink:0,boxShadow:"0 0 6px rgba(168,230,61,.7)",animation:"LP_pulse 2s ease-in-out infinite"}}/>
          {memberCount != null ? (
            <span style={{fontSize:10,fontWeight:700,color:"#8abe3a"}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:11}}>{fmtCount(memberCount)}</span>
              {" "}members in the economy
            </span>
          ) : (
            <span style={{fontSize:10,fontWeight:700,color:"#4a6a2a"}}>Join the economy today</span>
          )}
          <span style={{fontSize:7.5,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",color:"#2a4a1a"}}>LIVE</span>
        </div>

        {/* ── Feature cards (3-col grid, like PaywallGate) ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8,animation:"LP_rise .5s ease .2s both",animationFillMode:"forwards",opacity:0}}>
          {FEATURES.map(({n,icon,title,sub})=>(
            <div key={n} className="lp-feat-card">
              <div style={{fontSize:16,marginBottom:4}}>{icon}</div>
              <div style={{fontSize:8.5,color:"#4a6a3a",fontWeight:800,letterSpacing:"1.2px",marginBottom:3}}>{n}</div>
              <div style={{fontSize:10,color:"#90c040",fontWeight:700,lineHeight:1.3,marginBottom:2}}>{title}</div>
              <div style={{fontSize:9,color:"#2e4a2e",lineHeight:1.4}}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Value propositions (flex-grow) ── */}
        <div style={{display:"flex",flexDirection:"column",gap:6,flex:1,minHeight:0,animation:"LP_rise .5s ease .26s both",animationFillMode:"forwards",opacity:0}}>
          {VALUE_PROPS.map(({icon,title,body})=>(
            <div key={title} className="lp-value-row" style={{flex:1,minHeight:0}}>
              <div className="lp-icon-box">{icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10.5,fontWeight:800,color:"#b8d870",marginBottom:2,lineHeight:1.3}}>{title}</div>
                <div style={{fontSize:9.5,color:"#2e4a2e",lineHeight:1.6}}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Economy stats ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:8,animation:"LP_rise .5s ease .32s both",animationFillMode:"forwards",opacity:0}}>
          {ECO_STATS.map(({value,label,note})=>(
            <div key={label} className="lp-stat-box">
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(9px,.9vw,12px)",fontWeight:900,color:"#a8e63d",letterSpacing:"-0.3px",lineHeight:1,marginBottom:2}}>{value}</div>
              <div style={{fontSize:7.5,fontWeight:800,color:"#7aaa4a",textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:1}}>{label}</div>
              <div style={{fontSize:7.5,color:"#1e2e1e"}}>{note}</div>
            </div>
          ))}
        </div>

        {/* ── Trust row with avatar stack ── */}
        <div style={{borderTop:"1px solid rgba(168,230,61,.055)",paddingTop:9,marginTop:8,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,animation:"LP_rise .5s ease .38s both",animationFillMode:"forwards",opacity:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
            {/* Avatar stack */}
            <div style={{display:"flex",alignItems:"center",flexShrink:0}}>
              {(recentUsers.length > 0 ? recentUsers : [null,null,null,null]).map((u,i)=>{
                const url = u ? buildAvatarUrl(u.avatar_id) : null;
                const init = u ? (u.full_name||"U").charAt(0).toUpperCase() : "?";
                return (
                  <div key={u?.id||i} className="lp-avatar" style={{marginLeft:i>0?-8:0,zIndex:4-i,background:url?"transparent":ACCENT_COLORS[i%4],position:"relative"}}>
                    {url ? (
                      <img src={url} alt="" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover",display:"block"}}
                        onError={e=>{e.target.style.display="none";e.target.parentNode.style.background=ACCENT_COLORS[i%4];}}
                      />
                    ) : (
                      <span style={{color:"#040a00",fontSize:9,fontWeight:800}}>{init}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:900,color:"#90c040",letterSpacing:"-0.4px",fontFamily:"'Syne',sans-serif",lineHeight:1}}>
                {memberCount != null ? fmtCount(memberCount) : "—"}
              </div>
              <div style={{fontSize:9,color:"#4a6a3a",fontWeight:600}}>members joined</div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
            {[["⛓","Web3"],["🏦","Paystack"],["🔐","Encrypted"]].map(([ic,lb])=>(
              <div key={lb} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:7.5,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",color:"#2a4a1a",background:"rgba(168,230,61,.03)",border:"1px solid rgba(168,230,61,.08)",borderRadius:100,padding:"2.5px 7px",whiteSpace:"nowrap"}}>
                <span>{ic}</span><span>{lb}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Provider SVG icons ───────────────────────────────────────────────────────
const GI  = () => <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
const XII = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#ccc" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const FbI = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const DcI = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>;

// ─── Provider button with always-on orbiting arc border ────────────────────────────────────
function ProviderBtn({ icon, label, rgb, delay, state, onClick }) {
  const [vis, setVis] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setVis(true), delay); return()=>clearTimeout(t); },[delay]);

  const sel   = state === "selected";
  const other = state === "other";
  const short = label.replace("Continue with ", "");

  /*
   * Conic gradient: a ~70° bright arc at the end, rest transparent.
   * The .pb-arc-conic mask cuts out the center, leaving ONLY the ring border.
   * Result: a clean luminous arc that orbits the button edge. No "wings".
   */
  const conicBg = `conic-gradient(
    from 0deg,
    rgba(${rgb},0)     0deg,
    rgba(${rgb},0)     280deg,
    rgba(${rgb},0.45)  320deg,
    rgba(${rgb},1)     350deg,
    rgba(${rgb},0.45)  360deg
  )`;

  return (
    <div
      className="pb-wrap"
      style={{
        opacity: vis ? (other ? 0.14 : 1) : 0,
        transform: vis ? "translateY(0)" : "translateY(12px)",
        transition:`opacity .5s ease ${delay}ms, transform .5s cubic-bezier(.23,1,.32,1) ${delay}ms`,
        pointerEvents: other ? "none" : "auto",
      }}
    >
      {/* Always-on orbiting arc track */}
      <div className="pb-arc-track" aria-hidden>
        <div className="pb-arc-conic" style={{background:conicBg}}/>
      </div>

      {/* Inner button surface */}
      <button
        className="pb-inner"
        data-selected={sel}
        data-other={other}
        onClick={!sel&&!other?onClick:undefined}
        disabled={other}
        style={{
          border:`1px solid rgba(${rgb},${sel?.35:.15})`,
          background: sel
            ? `rgba(${rgb},.09)`
            : `rgba(${rgb},.03)`,
          boxShadow: sel
            ? `0 0 20px rgba(${rgb},.18), inset 0 1px 0 rgba(255,255,255,.04)`
            : `0 0 10px rgba(${rgb},.07), inset 0 1px 0 rgba(255,255,255,.025)`,
        }}
      >
        {/* Sweep overlay (fires on hover via CSS) */}
        <div
          className="pb-sweep"
          style={{background:`linear-gradient(90deg,rgba(${rgb},.15),rgba(${rgb},.03))`}}
          aria-hidden
        />
        {/* Icon */}
        <span className="pb-icon">
          {sel
            ? <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid rgba(${rgb},.2)`,borderTopColor:`rgb(${rgb})`,animation:"XV_spin .7s linear infinite"}}/>
            : icon
          }
        </span>
        {/* Label */}
        <span className="pb-label" style={{color:sel?`rgb(${rgb})`:`rgba(${rgb},.75)`}}>
          {sel ? `Opening ${short}…` : label}
        </span>
        {/* Arrow — always show dimly, brighter on hover */}
        <span className="pb-arrow" style={{opacity:sel?.9:.45}}>
          {sel
            ? <div style={{width:6,height:6,borderRadius:"50%",background:`rgb(${rgb})`,boxShadow:`0 0 7px rgba(${rgb},1)`,animation:"XV_spin 2s ease infinite"}}/>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2 6h8M7 4l3 2-3 2" stroke={`rgba(${rgb},.65)`} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </span>
      </button>
    </div>
  );
}

// ─── LOGIN VIEW ───────────────────────────────────────────────────────────────
function LoginView() {
  const [status,  setStatus]  = useState("idle");
  const [provider,setProvider]= useState(null);
  const [errMsg,  setErrMsg]  = useState("");
  const mounted = useRef(true);
  useEffect(()=>{ mounted.current=true; return()=>{ mounted.current=false; }; },[]);

  const go = useCallback(async (p) => {
    if (status === "loading") return;
    setErrMsg(""); setProvider(p); setStatus("loading");
    try {
      await authService.signInOAuth(p);
    } catch (e) {
      if (!mounted.current) return;
      const msg = e?.message || "";
      if (/cancel|denied|access_denied|closed|popup/i.test(msg)) {
        setErrMsg(msg); setStatus("declined");
      } else {
        setErrMsg(msg || "Sign-in failed. Please try again."); setStatus("idle"); setProvider(null);
      }
    }
  }, [status]);

  const retry = useCallback(() => { setStatus("idle"); setProvider(null); setErrMsg(""); }, []);

  if (status === "declined") return <DeclinedScreen message={errMsg} onRetry={retry}/>;

  const PROVIDERS = [
    { id:"google",   icon:<GI/>,  label:"Continue with Google",  rgb:"66,133,244",   delay:0   },
    { id:"x",        icon:<XII/>, label:"Continue with X",        rgb:"200,200,200",  delay:65  },
    { id:"facebook", icon:<FbI/>, label:"Continue with Facebook", rgb:"24,119,242",   delay:130 },
    { id:"discord",  icon:<DcI/>, label:"Continue with Discord",  rgb:"88,101,242",   delay:195 },
  ];

  return (
    <div style={{width:"100%"}}>
      {/* Heading */}
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(30px,4.5vw,46px)",letterSpacing:"2px",lineHeight:1,color:"var(--text)",animation:"XV_riseIn .65s ease .05s both",opacity:0}}>WELCOME BACK</div>
        <div style={{fontSize:12,fontWeight:400,color:"var(--dim)",marginTop:6,animation:"XV_riseIn .65s ease .13s both",opacity:0}}>Sign in to continue to Xeevia</div>
        <div style={{width:28,height:2,marginTop:10,background:"linear-gradient(90deg,var(--lime),transparent)",animation:"XV_fadeIn .8s ease .2s both",opacity:0}}/>
      </div>

      {/* Inline error */}
      {errMsg && status==="idle" && (
        <div style={{marginBottom:10,padding:"10px 13px",borderRadius:10,border:"1px solid rgba(224,82,82,.2)",background:"rgba(224,82,82,.05)",color:"#a06060",fontSize:12.5,display:"flex",gap:8,animation:"XV_riseIn .3s ease"}}>
          <span>⚠</span><span>{errMsg}</span>
        </div>
      )}

      {/* Provider buttons */}
      <div>
        {PROVIDERS.map(p=>(
          <ProviderBtn
            key={p.id}
            icon={p.icon}
            label={p.label}
            rgb={p.rgb}
            delay={p.delay}
            state={status==="loading" ? (provider===p.id?"selected":"other") : "idle"}
            onClick={()=>go(p.id)}
          />
        ))}
      </div>

      {/* Terms */}
      <div style={{marginTop:14,fontSize:10,color:"#192019",lineHeight:2,animation:"XV_fadeIn 1s ease .55s both",opacity:0}}>
        By continuing you agree to our{" "}
        <span style={{color:"#253025",textDecoration:"underline",cursor:"pointer"}}>Terms</span>{" & "}
        <span style={{color:"#253025",textDecoration:"underline",cursor:"pointer"}}>Privacy</span>
      </div>
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
export function Splash() {
  return (
    <div style={{minHeight:"100dvh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}} className="xv">
      <style>{CSS}</style><Grain/><Corners/><ScanLine/>
      <div aria-hidden style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:740,height:740,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.08) 0%,transparent 65%)",animation:"S_glow 5.5s ease-in-out infinite",pointerEvents:"none",zIndex:0}}/>
      <div style={{textAlign:"center",position:"relative",zIndex:2}}>
        <div style={{display:"flex",justifyContent:"center",gap:"0.01em",marginBottom:18}} aria-label="XEEVIA">
          {"XEEVIA".split("").map((ch,i)=>(
            <span key={i} aria-hidden style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(84px,17vw,146px)",letterSpacing:"5px",lineHeight:1,backgroundImage:"linear-gradient(175deg,#e8ff9a 0%,#a8e63d 38%,#5a9a10 100%)",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",display:"inline-block",animation:`S_letter .9s cubic-bezier(.23,1,.32,1) ${i*.18}s both`}}>{ch}</span>
          ))}
        </div>
        <div style={{fontSize:10,letterSpacing:"5px",textTransform:"uppercase",fontWeight:500,color:"var(--lime)",animation:"S_tagline 1.1s ease 2.0s forwards",opacity:0}}>Own Your Social Capital</div>
        <div style={{marginTop:56,display:"flex",justifyContent:"center",animation:"XV_fadeIn .7s ease 2.25s both",opacity:0}}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
            <circle cx="22" cy="22" r="18" stroke="rgba(168,230,61,.07)" strokeWidth="2"/>
            <circle cx="22" cy="22" r="18" stroke="url(#arcg2)" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="251" style={{animation:"S_arc 2.1s ease-in-out infinite",transformOrigin:"22px 22px",transform:"rotate(-90deg)"}}/>
            <circle cx="22" cy="22" r="2.8" fill="rgba(168,230,61,.55)" style={{animation:"S_glow 2.1s ease-in-out infinite"}}/>
            <defs><linearGradient id="arcg2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="rgba(168,230,61,0)"/><stop offset="55%" stopColor="rgba(168,230,61,.6)"/><stop offset="100%" stopColor="#a8e63d"/></linearGradient></defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── AUTH WALL — root export ──────────────────────────────────────────────────
export default function AuthWall({ paywall = false }) {
  if (paywall) return <PaywallGate/>;

  return (
    <div
      style={{
        height:"100dvh",
        width:"100%",
        background:"var(--bg)",
        display:"flex",
        alignItems:"stretch",
        position:"relative",
        overflow:"hidden",
      }}
      className="xv"
    >
      <style>{CSS}</style>
      <Grain/><Corners/><ScanLine/>

      {/* ── Left panel — 46% width, full height ── */}
      <div
        className="xv-left"
        style={{
          flex:"0 0 46%",
          height:"100dvh",
          overflow:"hidden",
          position:"relative",
        }}
      >
        <LeftPanel/>
      </div>

      {/* ── Right panel — remaining width, centered ── */}
      <div
        className="xv-right"
        style={{
          flex:"1 1 54%",
          height:"100dvh",
          overflow:"hidden",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          padding:"36px 28px",
          position:"relative",
          zIndex:2,
          borderLeft:"1px solid rgba(168,230,61,.03)",
        }}
      >
        <div className="xv-right-inner" style={{width:"100%",maxWidth:370}}>
          <LoginView/>
        </div>
      </div>
    </div>
  );
}