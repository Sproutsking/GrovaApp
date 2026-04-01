// src/components/Boost/BoostStyles.jsx
// Mount ONCE in App.jsx — all boost keyframes injected globally.
import React from "react";

const CSS = `
/* ─── Silver ring ─────────────────────────────────────────────────────── */
@keyframes silverPulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(192,192,192,0.2), 0 0 20px rgba(192,192,192,0.5), 0 0 40px rgba(192,192,192,0.2); }
  50%     { box-shadow: 0 0 0 4px rgba(255,255,255,0.35), 0 0 36px rgba(212,212,212,0.8), 0 0 64px rgba(192,192,192,0.4); }
}
@keyframes silverSheen {
  0%   { background-position: -200% center; }
  100% { background-position:  300% center; }
}
@keyframes silverGrid {
  0%,100% { opacity: 0.07; }
  50%     { opacity: 0.16; }
}
@keyframes silverStar {
  0%,100% { opacity: 0.15; transform: scale(0.8); }
  50%     { opacity: 0.90; transform: scale(1.3); }
}

/* ─── Gold ring ───────────────────────────────────────────────────────── */
@keyframes goldShimmer {
  0%,100% { box-shadow: 0 0 0 2px rgba(251,191,36,0.22), 0 0 28px rgba(251,191,36,0.7), 0 0 56px rgba(251,191,36,0.3); border-color: #fbbf24; }
  50%     { box-shadow: 0 0 0 4px rgba(254,240,138,0.42), 0 0 48px rgba(251,191,36,1),   0 0 96px rgba(251,191,36,0.5); border-color: #fef08a; }
}
@keyframes goldFire {
  0%   { box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 28px rgba(249,115,22,0.75), 0 0 56px rgba(251,191,36,0.3);  border-color: #f97316; }
  25%  { box-shadow: 0 0 0 3px rgba(251,191,36,0.32), 0 0 38px rgba(251,191,36,0.9),  0 0 76px rgba(253,224,71,0.35); border-color: #fbbf24; }
  50%  { box-shadow: 0 0 0 4px rgba(220,38,38,0.28),  0 0 44px rgba(249,115,22,0.95), 0 0 88px rgba(249,115,22,0.45); border-color: #ef4444; }
  75%  { box-shadow: 0 0 0 3px rgba(251,191,36,0.32), 0 0 38px rgba(251,191,36,0.9),  0 0 76px rgba(253,224,71,0.35); border-color: #fbbf24; }
  100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 28px rgba(249,115,22,0.75), 0 0 56px rgba(251,191,36,0.3);  border-color: #f97316; }
}
@keyframes goldBeam {
  0%   { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
  12%  { opacity: 1; }
  88%  { opacity: 1; }
  100% { transform: translateX(230%)  skewX(-18deg); opacity: 0; }
}
@keyframes goldParticle {
  0%   { transform: translateY(0) scale(1);   opacity: 0.8; }
  100% { transform: translateY(-60px) scale(0); opacity: 0; }
}

/* ─── Diamond rings ───────────────────────────────────────────────────── */
@keyframes diamondViolet {
  0%,100% { box-shadow: 0 0 0 2px rgba(167,139,250,0.22), 0 0 36px rgba(167,139,250,0.8), 0 0 72px rgba(167,139,250,0.38); border-color: #a78bfa; }
  50%     { box-shadow: 0 0 0 4px rgba(196,181,253,0.42), 0 0 56px rgba(167,139,250,1),   0 0 112px rgba(167,139,250,0.58); border-color: #c4b5fd; }
}
@keyframes diamondIce {
  0%,100% { box-shadow: 0 0 0 2px rgba(96,165,250,0.22),  0 0 36px rgba(96,165,250,0.8),  0 0 72px rgba(96,165,250,0.38);  border-color: #60a5fa; }
  33%     { box-shadow: 0 0 0 3px rgba(6,182,212,0.3),    0 0 48px rgba(6,182,212,0.9),   0 0 96px rgba(6,182,212,0.45);   border-color: #06b6d4; }
  66%     { box-shadow: 0 0 0 4px rgba(186,230,253,0.35), 0 0 56px rgba(96,165,250,1),    0 0 112px rgba(96,165,250,0.56); border-color: #bae6fd; }
}
@keyframes diamondEmerald {
  0%,100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.22), 0 0 36px rgba(52,211,153,0.8), 0 0 72px rgba(52,211,153,0.38); border-color: #34d399; }
  50%     { box-shadow: 0 0 0 4px rgba(167,243,208,0.35),0 0 56px rgba(52,211,153,1),   0 0 112px rgba(52,211,153,0.56); border-color: #a7f3d0; }
}
@keyframes diamondRose {
  0%,100% { box-shadow: 0 0 0 2px rgba(244,114,182,0.22), 0 0 36px rgba(244,114,182,0.8), 0 0 72px rgba(244,114,182,0.38); border-color: #f472b6; }
  50%     { box-shadow: 0 0 0 4px rgba(251,207,232,0.35), 0 0 56px rgba(244,114,182,1),   0 0 112px rgba(244,114,182,0.56); border-color: #fbcfe8; }
}
@keyframes diamondVoid {
  0%,100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.07), 0 0 36px rgba(167,139,250,0.55), 0 0 72px rgba(96,165,250,0.25); border-color: rgba(255,255,255,0.2); }
  33%     { box-shadow: 0 0 0 3px rgba(255,255,255,0.12),  0 0 48px rgba(96,165,250,0.65),  0 0 96px rgba(167,139,250,0.38); border-color: rgba(96,165,250,0.5); }
  66%     { box-shadow: 0 0 0 3px rgba(255,255,255,0.09),  0 0 48px rgba(244,114,182,0.55), 0 0 96px rgba(52,211,153,0.28);  border-color: rgba(244,114,182,0.42); }
}

/* ─── Floating shape drifts ──────────────────────────────────────────── */
@keyframes drift1 {
  0%,100% { transform: translateY(0)    rotate(12deg);  opacity: var(--op,0.1); }
  33%     { transform: translateY(-18px) rotate(18deg);  opacity: calc(var(--op,0.1)*1.7); }
  66%     { transform: translateY(-9px)  rotate(8deg);   opacity: calc(var(--op,0.1)*1.3); }
}
@keyframes drift2 {
  0%,100% { transform: translateY(0)    rotate(45deg);  opacity: var(--op,0.08); }
  50%     { transform: translateY(-24px) rotate(54deg);  opacity: calc(var(--op,0.08)*2); }
}
@keyframes drift3 {
  0%,100% { transform: translateY(0)    rotate(-22deg); opacity: var(--op,0.09); }
  40%     { transform: translateY(-12px) rotate(-15deg); opacity: calc(var(--op,0.09)*1.8); }
  80%     { transform: translateY(-22px) rotate(-28deg); opacity: calc(var(--op,0.09)*1.2); }
}
@keyframes drift4 {
  0%,100% { transform: translateY(0)    rotate(70deg);  opacity: var(--op,0.07); }
  60%     { transform: translateY(-16px) rotate(62deg);  opacity: calc(var(--op,0.07)*2); }
}

/* ─── Frame pulse ────────────────────────────────────────────────────── */
@keyframes framePulse { 0%,100%{opacity:0.6} 50%{opacity:1} }

/* ─── Grid line animation ────────────────────────────────────────────── */
@keyframes gridFade { 0%,100%{opacity:0.04} 50%{opacity:0.09} }

/* ─── Orbit ring ─────────────────────────────────────────────────────── */
@keyframes orbitSpin { to { transform: rotate(360deg); } }
@keyframes orbitPulse { 0%,100%{opacity:0.15} 50%{opacity:0.35} }

/* ─── Ensure boost card children sit above overlays ─────────────────── */
.boost-card > * { position: relative; z-index: 1; }
.boost-card { isolation: isolate; }
`;

const BoostStyles = () => <style dangerouslySetInnerHTML={{ __html: CSS }} />;
export default BoostStyles;