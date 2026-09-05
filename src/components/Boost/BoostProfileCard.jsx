// src/components/Boost/BoostProfileCard.jsx
// ============================================================================
// THE SPECTACULAR EDITION
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getTheme, getBoostBackgroundColor } from "../../services/boost/boostThemes";
import { buildAmbient as buildShowcaseAmbient, buildAvatarBorder as buildShowcaseAvatarBorder, buildFx as buildShowcaseFx } from "./XeeviaBoostCard";

const THEMES = {

  // ── SILVER ───────────────────────────────────────────────────────────────
  "silver-chrome": {
    tier: "silver",
    bg: "#06060a",
    radials: [
      // Strong crown halo top-center
      "radial-gradient(ellipse 85% 55% at 50% -8%,  rgba(230,230,248,0.28) 0%, transparent 62%)",
      // Left shoulder
      "radial-gradient(ellipse 50% 42% at 4%  18%,  rgba(200,200,225,0.18) 0%, transparent 55%)",
      // Right shoulder
      "radial-gradient(ellipse 50% 42% at 96% 18%,  rgba(200,200,225,0.18) 0%, transparent 55%)",
      // Bottom reflection pool
      "radial-gradient(ellipse 65% 38% at 50% 112%, rgba(165,165,195,0.15) 0%, transparent 58%)",
      // Mid-left accent
      "radial-gradient(ellipse 32% 28% at 16% 62%,  rgba(185,185,210,0.10) 0%, transparent 48%)",
      // Mid-right accent
      "radial-gradient(ellipse 32% 28% at 84% 62%,  rgba(185,185,210,0.10) 0%, transparent 48%)",
    ],
    frame: {
      border: "1.5px solid rgba(215,215,235,0.50)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.08), inset 0 0 52px rgba(205,205,230,0.12), 0 12px 60px rgba(0,0,0,0.82), 0 0 72px rgba(205,205,232,0.26)",
    },
    overlays: ["silverGrid", "silverSheen", "silverStars"],
  },

  // ── GOLD DYNASTY ─────────────────────────────────────────────────────────
  "gold-dynasty": {
    tier: "gold",
    bg: "#060400",
    radials: [
      "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(251,191,36,0.22) 0%, transparent 60%)",
      "radial-gradient(ellipse 60% 40% at 0%  90%,  rgba(146,64,14,0.18)  0%, transparent 55%)",
      "radial-gradient(ellipse 50% 40% at 100% 60%, rgba(217,119,6,0.14)  0%, transparent 55%)",
      "radial-gradient(ellipse 30% 30% at 80% 10%,  rgba(254,240,138,0.1) 0%, transparent 50%)",
    ],
    frame: { border: "1.5px solid rgba(251,191,36,0.45)", boxShadow: "0 0 0 1px rgba(254,240,138,0.08), inset 0 0 48px rgba(251,191,36,0.08), 0 12px 64px rgba(0,0,0,0.8), 0 0 64px rgba(251,191,36,0.22)" },
    overlays: ["goldHexGrid", "goldBeam", "goldParticles"],
  },

  // ── GOLD SOLAR ───────────────────────────────────────────────────────────
  "gold-solar": {
    tier: "gold",
    bg: "#050100",
    radials: [
      "radial-gradient(ellipse 80% 55% at 50% -5%,  rgba(251,191,36,0.28) 0%, transparent 55%)",
      "radial-gradient(ellipse 50% 45% at 20% 35%,  rgba(249,115,22,0.2)  0%, transparent 50%)",
      "radial-gradient(ellipse 40% 40% at 80% 70%,  rgba(220,38,38,0.15)  0%, transparent 50%)",
      "radial-gradient(ellipse 60% 30% at 50% 110%, rgba(249,115,22,0.12) 0%, transparent 55%)",
    ],
    frame: { border: "1.5px solid rgba(249,115,22,0.45)", boxShadow: "0 0 0 1px rgba(254,215,170,0.07), inset 0 0 48px rgba(249,115,22,0.08), 0 12px 64px rgba(0,0,0,0.8), 0 0 64px rgba(249,115,22,0.24)" },
    overlays: ["solarDiagonals", "goldBeam"],
  },

  // ── DIAMOND COSMOS ───────────────────────────────────────────────────────
  "diamond-cosmos": {
    tier: "diamond",
    bg: "#030010",
    gemColor: "#a78bfa",
    radials: [
      "radial-gradient(ellipse 70% 50% at 25% 0%,   rgba(167,139,250,0.28) 0%, transparent 55%)",
      "radial-gradient(ellipse 60% 45% at 75% 15%,  rgba(124,58,237,0.22)  0%, transparent 50%)",
      "radial-gradient(ellipse 80% 40% at 50% 90%,  rgba(76,29,149,0.26)   0%, transparent 60%)",
      "radial-gradient(ellipse 40% 35% at 5%  60%,  rgba(139,92,246,0.16)  0%, transparent 45%)",
      "radial-gradient(ellipse 35% 30% at 95% 50%,  rgba(167,139,250,0.14) 0%, transparent 45%)",
    ],
    frame: { border: "1.5px solid rgba(167,139,250,0.55)", boxShadow: "0 0 0 1px rgba(196,181,253,0.10), inset 0 0 60px rgba(167,139,250,0.12), 0 12px 72px rgba(0,0,0,0.9), 0 0 110px rgba(167,139,250,0.30)", animation: "framePulse 3s ease-in-out infinite" },
    overlays: ["cosmosOrbit", "cosmosNebula", "diamondFloats"],
    floatShapes: [
      { ch:"♦", sz:80,  top:"7%",   left:"5%",   op:0.18, bl:1.5, an:"drift1", dur:"7s",   del:"0s"   },
      { ch:"♦", sz:120, bot:"8%",   right:"4%",  op:0.10, bl:3,   an:"drift2", dur:"10s",  del:"1s"   },
      { ch:"◆", sz:32,  top:"40%",  right:"7%",  op:0.15, bl:0,   an:"drift3", dur:"5.5s", del:"2s"   },
      { ch:"·", sz:60,  top:"20%",  right:"20%", op:0.30, bl:0,   an:"drift4", dur:"3s",   del:"0.5s" },
      { ch:"♦", sz:16,  top:"65%",  left:"15%",  op:0.22, bl:0,   an:"drift1", dur:"4s",   del:"3s"   },
    ],
  },

  // ── DIAMOND GLACIER ──────────────────────────────────────────────────────
  "diamond-glacier": {
    tier: "diamond",
    bg: "#000814",
    gemColor: "#60a5fa",
    radials: [
      "radial-gradient(ellipse 60% 55% at 50% -5%,  rgba(96,165,250,0.32)  0%, transparent 55%)",
      "radial-gradient(ellipse 40% 45% at 85% 25%,  rgba(6,182,212,0.22)   0%, transparent 50%)",
      "radial-gradient(ellipse 50% 40% at 10% 65%,  rgba(30,58,138,0.28)   0%, transparent 55%)",
      "radial-gradient(ellipse 35% 30% at 90% 85%,  rgba(37,99,235,0.18)   0%, transparent 45%)",
    ],
    frame: { border: "1.5px solid rgba(96,165,250,0.55)", boxShadow: "0 0 0 1px rgba(186,230,253,0.10), inset 0 0 60px rgba(96,165,250,0.12), 0 12px 72px rgba(0,0,0,0.9), 0 0 110px rgba(96,165,250,0.30)", animation: "framePulse 3.6s ease-in-out infinite" },
    overlays: ["glacierShafts", "iceGrid", "diamondFloats"],
    floatShapes: [
      { ch:"❄", sz:68,  top:"5%",    right:"7%",  op:0.20, bl:1.5, an:"drift3", dur:"8s",   del:"0s"   },
      { ch:"♦", sz:104, bot:"7%",    left:"5%",   op:0.10, bl:3,   an:"drift4", dur:"12s",  del:"1.5s" },
      { ch:"❄", sz:28,  top:"48%",   left:"9%",   op:0.18, bl:0,   an:"drift1", dur:"5s",   del:"3s"   },
      { ch:"◆", sz:20,  bot:"28%",   right:"11%", op:0.22, bl:0,   an:"drift2", dur:"6s",   del:"0.8s" },
    ],
  },

  // ── DIAMOND EMERALD ──────────────────────────────────────────────────────
  "diamond-emerald": {
    tier: "diamond",
    bg: "#000a03",
    gemColor: "#34d399",
    radials: [
      "radial-gradient(ellipse 70% 50% at 40% 0%,   rgba(52,211,153,0.28)  0%, transparent 55%)",
      "radial-gradient(ellipse 50% 45% at 85% 35%,  rgba(5,150,105,0.22)   0%, transparent 50%)",
      "radial-gradient(ellipse 60% 45% at 5%  75%,  rgba(6,78,59,0.34)     0%, transparent 55%)",
      "radial-gradient(ellipse 40% 35% at 65% 95%,  rgba(16,185,129,0.18)  0%, transparent 45%)",
    ],
    frame: { border: "1.5px solid rgba(52,211,153,0.55)", boxShadow: "0 0 0 1px rgba(167,243,208,0.10), inset 0 0 60px rgba(52,211,153,0.12), 0 12px 72px rgba(0,0,0,0.9), 0 0 110px rgba(52,211,153,0.30)", animation: "framePulse 4.2s ease-in-out infinite" },
    overlays: ["emeraldRays", "emeraldGrid", "diamondFloats"],
    floatShapes: [
      { ch:"♦", sz:84,  top:"9%",   left:"4%",   op:0.18, bl:1.5, an:"drift2", dur:"8.5s", del:"0s"   },
      { ch:"♦", sz:100, bot:"7%",   right:"5%",  op:0.10, bl:3,   an:"drift1", dur:"11s",  del:"1s"   },
      { ch:"◆", sz:28,  top:"52%",  right:"9%",  op:0.18, bl:0,   an:"drift4", dur:"5s",   del:"2.5s" },
      { ch:"♦", sz:16,  top:"28%",  left:"18%",  op:0.24, bl:0,   an:"drift3", dur:"4.5s", del:"1.2s" },
    ],
  },

  // ── DIAMOND ROSE ─────────────────────────────────────────────────────────
  "diamond-rose": {
    tier: "diamond",
    bg: "#08000a",
    gemColor: "#f472b6",
    radials: [
      "radial-gradient(ellipse 70% 50% at 60% 0%,   rgba(244,114,182,0.30) 0%, transparent 55%)",
      "radial-gradient(ellipse 50% 45% at 15% 25%,  rgba(219,39,119,0.22)  0%, transparent 50%)",
      "radial-gradient(ellipse 60% 45% at 85% 70%,  rgba(131,24,67,0.28)   0%, transparent 55%)",
      "radial-gradient(ellipse 40% 35% at 40% 95%,  rgba(244,114,182,0.18) 0%, transparent 45%)",
    ],
    frame: { border: "1.5px solid rgba(244,114,182,0.55)", boxShadow: "0 0 0 1px rgba(251,207,232,0.10), inset 0 0 60px rgba(244,114,182,0.12), 0 12px 72px rgba(0,0,0,0.9), 0 0 110px rgba(244,114,182,0.30)", animation: "framePulse 3.3s ease-in-out infinite" },
    overlays: ["rosePetals", "roseGrid", "diamondFloats"],
    floatShapes: [
      { ch:"♦", sz:76,  top:"6%",   right:"6%",  op:0.20, bl:1.5, an:"drift3", dur:"7s",   del:"0s"   },
      { ch:"♦", sz:108, bot:"10%",  left:"4%",   op:0.10, bl:3,   an:"drift1", dur:"10s",  del:"1.2s" },
      { ch:"🌹",sz:22,  top:"48%",  left:"7%",   op:0.20, bl:0,   an:"drift2", dur:"6s",   del:"2s"   },
      { ch:"♦", sz:16,  bot:"28%",  right:"13%", op:0.24, bl:0,   an:"drift4", dur:"4.2s", del:"0.6s" },
    ],
  },

  // ── DIAMOND VOID ─────────────────────────────────────────────────────────
  "diamond-void": {
    tier: "diamond",
    bg: "#000000",
    gemColor: "rgba(255,255,255,0.6)",
    radials: [
      "radial-gradient(ellipse 50% 40% at 20% 0%,   rgba(167,139,250,0.15) 0%, transparent 50%)",
      "radial-gradient(ellipse 40% 35% at 80% 0%,   rgba(96,165,250,0.12)  0%, transparent 45%)",
      "radial-gradient(ellipse 50% 40% at 50% 100%, rgba(52,211,153,0.09)  0%, transparent 55%)",
      "radial-gradient(ellipse 35% 30% at 0%  50%,  rgba(244,114,182,0.08) 0%, transparent 45%)",
      "radial-gradient(ellipse 35% 30% at 100% 50%, rgba(251,191,36,0.07)  0%, transparent 45%)",
    ],
    frame: { border: "1.5px solid rgba(255,255,255,0.15)", boxShadow: "0 0 0 1px rgba(255,255,255,0.05), inset 0 0 60px rgba(167,139,250,0.08), 0 12px 72px rgba(0,0,0,0.98), 0 0 110px rgba(167,139,250,0.18)", animation: "framePulse 5.5s ease-in-out infinite" },
    overlays: ["voidGeometry", "diamondFloats"],
    floatShapes: [
      { ch:"♦", sz:88,  top:"7%",   left:"5%",   op:0.12, bl:2.5, an:"drift1", dur:"10s",  del:"0s"   },
      { ch:"♦", sz:128, bot:"9%",   right:"4%",  op:0.07, bl:4,   an:"drift2", dur:"13s",  del:"1s"   },
      { ch:"◆", sz:28,  top:"42%",  right:"8%",  op:0.14, bl:0,   an:"drift3", dur:"5.5s", del:"2.5s" },
      { ch:"♦", sz:16,  top:"68%",  left:"13%",  op:0.17, bl:0,   an:"drift4", dur:"4s",   del:"1.5s" },
    ],
  },
};

// ── OVERLAY RENDERERS ─────────────────────────────────────────────────────

const SilverGridOverlay = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
    backgroundImage:`
      linear-gradient(45deg,  rgba(215,215,238,0.10) 1px, transparent 1px),
      linear-gradient(-45deg, rgba(215,215,238,0.10) 1px, transparent 1px)`,
    backgroundSize:"38px 38px",
    animation:"silverGrid 4s ease-in-out infinite",
  }}/>
);

const SilverSheenOverlay = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
    background:"linear-gradient(110deg,transparent 18%,rgba(255,255,255,0.07) 36%,rgba(228,228,248,0.14) 50%,rgba(255,255,255,0.07) 64%,transparent 82%)",
    backgroundSize:"300% 100%",
    animation:"silverSheen 5s ease-in-out infinite",
  }}/>
);

const SilverStarsOverlay = () => {
  const stars = [
    { top:"11%", left:"8%",  s:3, d:"0s",    dur:"2.8s" },
    { top:"26%", left:"84%", s:2, d:"1.1s",  dur:"3.6s" },
    { top:"57%", left:"12%", s:3, d:"2.2s",  dur:"3.0s" },
    { top:"72%", left:"72%", s:2, d:"0.6s",  dur:"4.2s" },
    { top:"40%", left:"48%", s:2, d:"3.3s",  dur:"5.0s" },
    { top:"88%", left:"56%", s:2, d:"1.9s",  dur:"3.4s" },
    { top:"18%", left:"61%", s:4, d:"0.3s",  dur:"2.4s" },
    { top:"80%", left:"29%", s:3, d:"2.7s",  dur:"3.8s" },
    { top:"47%", left:"91%", s:2, d:"1.4s",  dur:"4.5s" },
    { top:"6%",  left:"44%", s:2, d:"0.8s",  dur:"3.2s" },
    { top:"34%", left:"26%", s:3, d:"2.0s",  dur:"2.9s" },
    { top:"63%", left:"38%", s:2, d:"0.4s",  dur:"4.0s" },
  ];
  return (
    <div aria-hidden="true" style={{
      position:"absolute", inset:0, borderRadius:"inherit",
      pointerEvents:"none", zIndex:0, overflow:"hidden",
    }}>
      {stars.map((st, i) => (
        <div key={i} style={{
          position:"absolute", top:st.top, left:st.left,
          width:st.s, height:st.s, borderRadius:"50%",
          background:"rgba(230,230,255,0.9)",
          animation:`silverStar ${st.dur} ease-in-out ${st.d} infinite`,
          boxShadow:`0 0 ${st.s * 2}px rgba(210,210,240,0.8)`,
        }}/>
      ))}
    </div>
  );
};

const GoldHexGrid = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 0 L56 16 L56 50 L28 66 L0 50 L0 16Z' fill='none' stroke='rgba(251,191,36,0.09)' stroke-width='1'/%3E%3Cpath d='M28 66 L56 82 L56 100' fill='none' stroke='rgba(251,191,36,0.06)' stroke-width='1'/%3E%3Cpath d='M28 66 L0 82 L0 100' fill='none' stroke='rgba(251,191,36,0.06)' stroke-width='1'/%3E%3C/svg%3E")`,
    backgroundSize:"56px 100px",
    animation:"gridFade 3.5s ease-in-out infinite",
  }}/>
);

const GoldBeamOverlay = ({ color = "rgba(251,191,36," }) => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    <div style={{
      position:"absolute", top:0, left:"-130%", width:"55%", height:"100%",
      background:`linear-gradient(110deg,transparent 0%,${color}0.1) 50%,transparent 100%)`,
      animation:"goldBeam 4.5s ease-in-out 0.8s infinite", transform:"skewX(-18deg)",
    }}/>
    <div style={{
      position:"absolute", top:0, left:"-130%", width:"32%", height:"100%",
      background:`linear-gradient(110deg,transparent 0%,${color}0.06) 50%,transparent 100%)`,
      animation:"goldBeam 4.5s ease-in-out 2.6s infinite", transform:"skewX(-18deg)",
    }}/>
  </div>
);

const SolarDiagonals = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { left:"5%",  w:"2px", h:"60%", top:"20%", rot:-35, op:0.12, delay:"0s"   },
      { left:"20%", w:"1px", h:"45%", top:"30%", rot:-35, op:0.08, delay:"0.8s" },
      { left:"60%", w:"2px", h:"55%", top:"15%", rot:-35, op:0.10, delay:"1.6s" },
      { left:"80%", w:"1px", h:"40%", top:"35%", rot:-35, op:0.07, delay:"0.4s" },
    ].map((s, i) => (
      <div key={i} style={{
        position:"absolute", left:s.left, top:s.top, width:s.w, height:s.h,
        background:"linear-gradient(180deg,transparent 0%,rgba(249,115,22,0.4) 50%,transparent 100%)",
        transform:`rotate(${s.rot}deg)`, opacity:s.op,
        animation:`framePulse ${2.5 + i * 0.7}s ease-in-out ${s.delay} infinite`,
      }}/>
    ))}
  </div>
);

const GoldParticles = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { left:"15%", bot:"10%", delay:"0s",   dur:"3s",   sz:3, op:0.7 },
      { left:"35%", bot:"5%",  delay:"1.2s", dur:"2.5s", sz:2, op:0.5 },
      { left:"55%", bot:"8%",  delay:"0.6s", dur:"3.5s", sz:3, op:0.6 },
      { left:"75%", bot:"12%", delay:"1.8s", dur:"2.8s", sz:2, op:0.5 },
      { left:"90%", bot:"6%",  delay:"0.3s", dur:"3.2s", sz:2, op:0.4 },
    ].map((p, i) => (
      <div key={i} style={{
        position:"absolute", left:p.left, bottom:p.bot,
        width:p.sz, height:p.sz, borderRadius:"50%",
        background:"#fbbf24", opacity:p.op,
        animation:`goldParticle ${p.dur} ease-out ${p.delay} infinite`,
      }}/>
    ))}
  </div>
);

const CosmosOrbit = ({ color }) => (
  <div aria-hidden="true" style={{
    position:"absolute", top:"50%", left:"50%",
    transform:"translate(-50%,-50%)",
    width:"120%", paddingBottom:"120%",
    pointerEvents:"none", zIndex:0,
  }}>
    <div style={{
      position:"absolute", inset:0, borderRadius:"50%",
      background:`conic-gradient(from 0deg, transparent 0%, ${color}55 20%, transparent 40%, ${color}33 60%, transparent 80%, ${color}44 95%, transparent 100%)`,
      animation:"orbitSpin 12s linear infinite", opacity:0.25,
    }}/>
  </div>
);

const CosmosNebula = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { top:"5%",  left:"60%", w:180, h:120, op:0.08, delay:"0s", dur:"6s", col:"rgba(167,139,250,0.6)" },
      { top:"55%", left:"5%",  w:150, h:100, op:0.06, delay:"2s", dur:"8s", col:"rgba(124,58,237,0.5)"  },
      { top:"70%", left:"55%", w:200, h:130, op:0.05, delay:"1s", dur:"7s", col:"rgba(76,29,149,0.5)"   },
    ].map((n, i) => (
      <div key={i} style={{
        position:"absolute", top:n.top, left:n.left, width:n.w, height:n.h,
        background:`radial-gradient(ellipse, ${n.col} 0%, transparent 70%)`,
        opacity:n.op, filter:"blur(20px)",
        animation:`framePulse ${n.dur} ease-in-out ${n.delay} infinite`,
      }}/>
    ))}
  </div>
);

const GlacierShafts = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { left:"20%", w:"60px", op:0.10, delay:"0s",   dur:"4s"   },
      { left:"50%", w:"40px", op:0.07, delay:"1.5s", dur:"5s"   },
      { left:"75%", w:"50px", op:0.09, delay:"0.8s", dur:"4.5s" },
    ].map((s, i) => (
      <div key={i} style={{
        position:"absolute", top:0, left:s.left, width:s.w, height:"100%",
        background:"linear-gradient(180deg,rgba(96,165,250,0.30) 0%,transparent 65%)",
        opacity:s.op,
        animation:`framePulse ${s.dur} ease-in-out ${s.delay} infinite`,
      }}/>
    ))}
  </div>
);

const IceGrid = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='90'%3E%3Cpath d='M26 0 L52 15 L52 45 L26 60 L0 45 L0 15Z' fill='none' stroke='rgba(96,165,250,0.10)' stroke-width='0.8'/%3E%3C/svg%3E")`,
    backgroundSize:"52px 90px",
    animation:"gridFade 5s ease-in-out infinite",
  }}/>
);

const EmeraldRays = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { left:"10%", op:0.12, delay:"0s",   dur:"5s"   },
      { left:"30%", op:0.08, delay:"1.8s", dur:"6s"   },
      { left:"55%", op:0.11, delay:"0.9s", dur:"4.5s" },
      { left:"80%", op:0.07, delay:"2.5s", dur:"5.5s" },
    ].map((r, i) => (
      <div key={i} style={{
        position:"absolute", top:0, left:r.left, width:"2px", height:"100%",
        background:"linear-gradient(180deg,transparent 0%,rgba(52,211,153,0.6) 40%,rgba(52,211,153,0.6) 60%,transparent 100%)",
        opacity:r.op,
        animation:`framePulse ${r.dur} ease-in-out ${r.delay} infinite`,
      }}/>
    ))}
  </div>
);

const EmeraldGrid = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='90'%3E%3Cpath d='M26 0 L52 15 L52 45 L26 60 L0 45 L0 15Z' fill='none' stroke='rgba(52,211,153,0.08)' stroke-width='0.8'/%3E%3C/svg%3E")`,
    backgroundSize:"52px 90px",
    animation:"gridFade 5s ease-in-out infinite",
  }}/>
);

const RosePetals = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { top:"5%",  left:"60%", w:140, h:90,  op:0.12, delay:"0s",   dur:"4s"   },
      { top:"40%", left:"5%",  w:120, h:110, op:0.09, delay:"1.5s", dur:"5s"   },
      { top:"70%", left:"55%", w:160, h:100, op:0.08, delay:"0.8s", dur:"4.5s" },
    ].map((p, i) => (
      <div key={i} style={{
        position:"absolute", top:p.top, left:p.left, width:p.w, height:p.h,
        background:`radial-gradient(ellipse, rgba(244,114,182,0.5) 0%, transparent 70%)`,
        opacity:p.op,
        animation:`framePulse ${p.dur} ease-in-out ${p.delay} infinite`,
      }}/>
    ))}
  </div>
);

const RoseGrid = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
    backgroundImage:`
      linear-gradient(45deg,  rgba(244,114,182,0.06) 1px, transparent 1px),
      linear-gradient(-45deg, rgba(244,114,182,0.06) 1px, transparent 1px)`,
    backgroundSize:"40px 40px",
    animation:"gridFade 5s ease-in-out infinite",
  }}/>
);

const VoidGeometry = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0, overflow:"hidden",
  }}>
    {[
      { type:"h", top:"25%", w:"100%", col:"rgba(167,139,250,0.08)", delay:"0s",   dur:"8s"  },
      { type:"h", top:"55%", w:"100%", col:"rgba(96,165,250,0.07)",  delay:"2.5s", dur:"10s" },
      { type:"h", top:"80%", w:"70%",  col:"rgba(52,211,153,0.06)",  delay:"1.2s", dur:"9s"  },
      { type:"v", left:"25%",h:"100%", col:"rgba(244,114,182,0.07)", delay:"3s",   dur:"7s"  },
      { type:"v", left:"72%",h:"80%",  col:"rgba(251,191,36,0.05)",  delay:"0.6s", dur:"11s" },
    ].map((l, i) => (
      <div key={i} style={{
        position:"absolute",
        ...(l.type === "h"
          ? { top:l.top, left:0, width:l.w, height:"1px" }
          : { left:l.left, top:0, height:l.h, width:"1px" }),
        background:l.col,
        animation:`framePulse ${l.dur} ease-in-out ${l.delay} infinite`,
      }}/>
    ))}
  </div>
);

const DiamondFloats = ({ shapes, gemColor }) => {
  if (!shapes?.length) return null;
  return (
    <div aria-hidden="true" style={{
      position:"absolute", inset:0, borderRadius:"inherit",
      pointerEvents:"none", zIndex:0, overflow:"hidden",
    }}>
      {shapes.map((s, i) => (
        <div key={i} style={{
          position:"absolute",
          top:s.top, left:s.left, right:s.right, bottom:s.bot,
          width:s.sz, height:s.sz, fontSize:s.sz,
          color:gemColor, opacity:s.op,
          filter:s.bl ? `blur(${s.bl}px)` : undefined,
          animation:`${s.an} ${s.dur} ease-in-out ${s.del} infinite`,
          lineHeight:1, userSelect:"none", "--op": s.op,
        }}>{s.ch}</div>
      ))}
    </div>
  );
};

const Vignette = () => (
  <div aria-hidden="true" style={{
    position:"absolute", inset:0, borderRadius:"inherit",
    pointerEvents:"none", zIndex:0,
    background:"radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.55) 100%)",
  }}/>
);

const ShowcaseOverlay = ({ theme }) => {
  if (!theme?.texture) return null;
  const texture = {
    rays: "repeating-conic-gradient(from 0deg at 50% 34%, rgba(255,255,255,.16) 0deg 1deg, transparent 1deg 7deg)",
    metal: "repeating-linear-gradient(112deg, rgba(255,255,255,.14) 0 2px, transparent 2px 38px)",
    crest: "repeating-linear-gradient(96deg, rgba(255,255,255,.1) 0 1px, transparent 1px 4px), repeating-radial-gradient(circle at 78% 14%, rgba(255,255,255,.07) 0 1px, transparent 1px 7px)",
    hex: "linear-gradient(30deg, transparent 45%, rgba(251,191,36,.12) 46% 47%, transparent 48%), linear-gradient(150deg, transparent 45%, rgba(251,191,36,.12) 46% 47%, transparent 48%)",
    heat: "repeating-linear-gradient(0deg, rgba(255,180,80,.11) 0 1px, transparent 1px 3px)",
    laurel: "repeating-linear-gradient(90deg, transparent 0 18px, rgba(253,230,138,.12) 19px 20px, transparent 21px 36px)",
    cracks: "linear-gradient(135deg, transparent 46%, rgba(255,160,60,.42) 47% 48%, transparent 49%), linear-gradient(35deg, transparent 54%, rgba(255,190,90,.24) 55% 56%, transparent 57%)",
    facet: "linear-gradient(35deg, transparent 48%, rgba(255,255,255,.28) 49% 50%, transparent 51%), linear-gradient(145deg, transparent 48%, rgba(255,255,255,.2) 49% 50%, transparent 51%)",
    stars: "radial-gradient(circle, rgba(255,255,255,.9) 1.2px, transparent 1.6px)",
    ice: "repeating-linear-gradient(58deg, rgba(191,228,255,.16) 0 2px, transparent 2px 26px), repeating-linear-gradient(122deg, rgba(191,228,255,.1) 0 1px, transparent 1px 38px)",
    triangles: "linear-gradient(60deg, transparent 49%, rgba(255,255,255,.2) 50%, transparent 51%), linear-gradient(120deg, transparent 49%, rgba(255,255,255,.18) 50%, transparent 51%)",
    lattice: "linear-gradient(30deg, transparent 49%, rgba(255,255,255,.16) 50%, transparent 51%), linear-gradient(150deg, transparent 49%, rgba(255,255,255,.16) 50%, transparent 51%)",
    circuit: "linear-gradient(90deg, rgba(125,211,252,.14) 1px, transparent 1px), linear-gradient(rgba(125,211,252,.14) 1px, transparent 1px)",
    mandala: "repeating-conic-gradient(from 0deg at 50% 42%, rgba(244,171,252,.16) 0deg 3deg, transparent 3deg 30deg)",
  }[theme.texture];
  const sceneColor = theme.accent;
  const sceneClass = `boost-scene boost-scene-${theme.id}`;
  return (
    <div aria-hidden="true" className={sceneClass} style={{ position:"absolute", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:texture, backgroundSize:theme.texture === "stars" ? "46px 46px" : "auto", opacity:.7, mixBlendMode:"screen" }} />
      <div className="boost-scene-glow" style={{ background:sceneColor }} />
      {Array.from({ length: theme.scene === "mercury" ? 8 : theme.scene === "nebula" ? 12 : 6 }, (_, i) => (
        <i key={i} style={{ left:`${8 + ((i * 17) % 84)}%`, top:`${12 + ((i * 23) % 76)}%`, background:sceneColor, animationDelay:`-${i * .55}s` }} />
      ))}
    </div>
  );
};

const randomBetween = (min, max) => min + Math.random() * (max - min);

function addParticles(container, themeId) {
  if (!container) return;
  container.replaceChildren();
  const add = (className, count, setup) => {
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      particle.className = className;
      setup(particle, index);
      container.appendChild(particle);
    }
  };

  if (themeId === "silver-eclipse") {
    add("boost-ambient-star", 12, (particle) => {
      particle.style.left = `${randomBetween(8, 92)}%`;
      particle.style.top = `${randomBetween(8, 92)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 4)}s`;
    });
  } else if (themeId === "silver-mercury") {
    add("boost-ambient-droplet", 9, (particle) => {
      particle.style.left = `${randomBetween(5, 92)}%`;
      particle.style.animationDuration = `${randomBetween(2.4, 4.2)}s`;
      particle.style.animationDelay = `-${randomBetween(0, 5)}s`;
    });
  } else if (themeId === "silver-chrome") {
    const moon = document.createElement("i");
    moon.className = "boost-ambient-moon";
    container.appendChild(moon);
    const sheen = document.createElement("i");
    sheen.className = "boost-ambient-sheen";
    container.appendChild(sheen);
  } else if (themeId === "gold-dynasty" || themeId === "gold-laurel") {
    add("boost-ambient-mote", 12, (particle) => {
      particle.style.left = `${randomBetween(5, 92)}%`;
      particle.style.top = `${randomBetween(70, 98)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 7)}s`;
    });
  } else if (["gold-solar", "gold-corona"].includes(themeId)) {
    add("boost-ambient-spark", 16, (particle) => {
      particle.style.left = `${randomBetween(8, 92)}%`;
      particle.style.setProperty("--dx", `${randomBetween(-70, 70)}px`);
      particle.style.setProperty("--dy", `${-randomBetween(90, 190)}px`);
      particle.style.animationDelay = `-${randomBetween(0, 3)}s`;
    });
  } else if (themeId === "gold-molten" || themeId === "diamond-rift") {
    add("boost-ambient-ember", 12, (particle) => {
      particle.style.left = `${randomBetween(8, 92)}%`;
      particle.style.bottom = `${randomBetween(0, 12)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 4)}s`;
    });
  } else if (themeId === "diamond-nebula") {
    add("boost-ambient-meteor", 5, (particle) => {
      particle.style.left = `${randomBetween(0, 88)}%`;
      particle.style.top = `${randomBetween(0, 45)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 6)}s`;
    });
  } else if (themeId === "diamond-shard") {
    add("boost-ambient-shard", 12, (particle) => {
      particle.style.left = `${randomBetween(5, 92)}%`;
      particle.style.animationDuration = `${randomBetween(3, 7)}s`;
      particle.style.animationDelay = `-${randomBetween(0, 6)}s`;
    });
  } else if (themeId === "diamond-prism") {
    add("boost-ambient-prism", 3, (particle, index) => {
      particle.style.animationDelay = `${-index * 1.7}s`;
    });
  } else if (themeId === "diamond-quantum") {
    add("boost-ambient-pulse", 8, (particle) => {
      particle.style.left = `${randomBetween(0, 90)}%`;
      particle.style.top = `${randomBetween(0, 90)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 4)}s`;
    });
  } else if (themeId === "diamond-bloom") {
    add("boost-ambient-petal", 10, (particle) => {
      particle.style.left = `${randomBetween(8, 92)}%`;
      particle.style.top = `${randomBetween(-10, 20)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 6)}s`;
    });
  } else if (themeId === "diamond-void") {
    add("boost-ambient-void-dot", 8, (particle) => {
      particle.style.left = `${randomBetween(8, 92)}%`;
      particle.style.top = `${randomBetween(10, 90)}%`;
      particle.style.animationDelay = `-${randomBetween(0, 8)}s`;
    });
  } else if (themeId === "diamond-brilliant") {
    add("boost-ambient-star", 8, (particle, index) => {
      particle.style.left = `${18 + (index * 29) % 70}%`;
      particle.style.top = `${12 + (index * 31) % 76}%`;
      particle.style.animationDelay = `-${index * 0.35}s`;
    });
  }
}

function startSignatureScene(container, tier, reduceMotion) {
  if (!container) return () => {};
  container.replaceChildren();
  if (reduceMotion) return () => {};

  if (tier === "gold") {
    const blade = document.createElement("i");
    blade.className = "boost-signature-blade";
    container.appendChild(blade);
    for (let index = 0; index < 7; index += 1) {
      const ember = document.createElement("i");
      ember.className = "boost-signature-ember";
      ember.style.left = `${10 + index * 13}%`;
      ember.style.animationDelay = `-${index * 0.4}s`;
      container.appendChild(ember);
    }
    return () => container.replaceChildren();
  }

  if (tier === "silver") {
    const comet = document.createElement("i");
    comet.className = "boost-signature-comet";
    container.appendChild(comet);
    return () => container.replaceChildren();
  }

  const gems = Array.from({ length: 12 }, (_, index) => {
    const gem = document.createElement("i");
    gem.className = `boost-signature-gem${index === 0 ? " head" : ""}`;
    gem.style.setProperty("--index", index);
    container.appendChild(gem);
    return gem;
  });
  let frameId;
  const startedAt = performance.now();
  const render = (now) => {
    const rect = container.getBoundingClientRect();
    const time = (now - startedAt) / 1000;
    const headX = rect.width / 2 + rect.width * 0.32 * Math.sin(time * 1.05);
    const headY = rect.height / 2 + rect.height * 0.26 * Math.sin(time * 0.6) * Math.cos(time * 0.19);
    gems.forEach((gem, index) => {
      const delay = index * 8;
      const x = headX - delay * 2.1;
      const y = headY - delay * 1.2;
      gem.style.transform = `translate(${x}px, ${y}px) rotate(${time * 45 - index * 15}deg)`;
    });
    frameId = requestAnimationFrame(render);
  };
  frameId = requestAnimationFrame(render);
  return () => {
    cancelAnimationFrame(frameId);
    container.replaceChildren();
  };
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────
const BoostProfileCard = ({ tier, themeId, backgroundColorId, style = {}, className = "", children, embedded = false }) => {
  const ambientRef = useRef(null);
  const cardFxRef = useRef(null);
  const avatarFxRef = useRef(null);
  const signatureRef = useRef(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const theme = useMemo(() => {
    if (!tier || !["silver","gold","diamond"].includes(tier)) return null;
    const key = themeId ?? { silver:"silver-chrome", gold:"gold-dynasty", diamond:"diamond-cosmos" }[tier];
    const sharedTheme = getTheme(tier, key);
    if (sharedTheme) return sharedTheme;
    return THEMES[key] ?? null;
  }, [tier, themeId]);

  useEffect(() => {
    if (!theme) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = (event) => setReduceMotion(event.matches);
    setReduceMotion(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", updateMotion);
    return () => mediaQuery.removeEventListener?.("change", updateMotion);
  }, [theme]);

  useEffect(() => {
    if (!theme) return undefined;
    const designId = theme.id.replace(`${tier}-`, "");
    buildShowcaseAmbient(ambientRef.current, tier, designId, reduceMotion);
    buildShowcaseAvatarBorder(avatarFxRef.current, tier, designId, reduceMotion);
    return buildShowcaseFx(cardFxRef.current, tier, reduceMotion);
  }, [theme, tier, reduceMotion]);

  if (!theme) return <div className={className} style={style}>{children}</div>;

  const legacyLayers = Array.isArray(theme.radials) ? theme.radials : [];
  const bgLayers = theme.card?.background
    ?? [...legacyLayers, theme.bg ?? "#080b11"].join(", ");
  const backgroundColor = getBoostBackgroundColor(tier, backgroundColorId)?.color;
  const themedBackground = backgroundColor
    ? `linear-gradient(${backgroundColor}aa, ${backgroundColor}aa), ${bgLayers}`
    : bgLayers;

  const cardRadius = style.borderRadius ?? 24;
  const cardStyle = {
    position: "relative",
    overflow: "hidden",
    isolation: "isolate",
    background: "transparent",
    width: "100%",
    height: embedded ? "100%" : "auto",
    minHeight: embedded ? 0 : undefined,
    maxWidth: embedded ? "100%" : undefined,
    aspectRatio: embedded ? undefined : "auto",
    borderRadius: cardRadius,
    ...theme.frame,
    ...style,
  };

  return (
    <div
      className={`xvb-root ${embedded ? "xvb-embed" : ""} ${className}`.trim()}
      data-tier={tier}
      data-design={theme.id.replace(`${tier}-`, "")}
      style={{
        width: "100%",
        height: embedded ? "100%" : undefined,
        position: "relative",
        overflow: "hidden",
        borderRadius: cardRadius,
        background: "transparent",
        isolation: "isolate",
      }}
    >
      <div
        className={`boost-card card boost-tier-${tier} boost-theme-${themeId ?? "default"}`}
        data-tier={tier}
        data-design={theme.id.replace(`${tier}-`, "")}
        style={cardStyle}
      >
        <div className="card-material" aria-hidden="true">
          <div className="card-base" style={{ background: themedBackground }} />
          <div className="card-texture" />
          <div className="card-ambient" ref={ambientRef} />
          <div className="card-light" />
        </div>
        <div ref={cardFxRef} className="card-fx" aria-hidden="true" />
        <div className="card-scrim" aria-hidden="true" />
        <div className="card-frame" aria-hidden="true" />
        <div ref={avatarFxRef} className="avatar-fx" aria-hidden="true" />
        <div className="card-content" style={{ position: "relative", zIndex: 1, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>{children}</div>
      </div>
    </div>
  );
};

export default BoostProfileCard;