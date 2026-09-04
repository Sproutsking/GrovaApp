// src/components/Boost/BoostStyles.jsx
// Mount ONCE in App.jsx — all boost keyframes injected globally.
import React from "react";
import { SHOWCASE_STYLES } from "./XeeviaBoostCard";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Cinzel:wght@700&family=Cormorant+Garamond:wght@700&family=DM+Sans:wght@700&family=Manrope:wght@800&family=Orbitron:wght@700&family=Playfair+Display:wght@700&family=Sora:wght@700&family=Space+Grotesk:wght@700&family=Space+Mono:wght@700&display=swap');
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

/* ─── Showcase scene layers ───────────────────────────────────────────── */
@keyframes showcaseFloat { 0%,100% { transform:translate3d(0,8px,0) scale(.7); opacity:.12; } 50% { transform:translate3d(8px,-18px,0) scale(1.35); opacity:.78; } }
@keyframes showcaseSweep { 0% { transform:translateX(-140%) rotate(18deg); opacity:0; } 18% { opacity:.7; } 82% { opacity:.7; } 100% { transform:translateX(240%) rotate(18deg); opacity:0; } }
@keyframes showcaseSpin { to { transform:rotate(360deg); } }
.boost-scene .boost-scene-glow { position:absolute; width:55%; aspect-ratio:1; left:22%; top:30%; border-radius:50%; opacity:.16; filter:blur(22px); animation:showcaseFloat 5s ease-in-out infinite; mix-blend-mode:screen; }
.boost-scene > i { position:absolute; width:4px; height:4px; border-radius:50%; opacity:.4; box-shadow:0 0 10px 3px currentColor; animation:showcaseFloat 4.8s ease-in-out infinite; mix-blend-mode:screen; }
.boost-scene-silver-eclipse .boost-scene-glow, .boost-scene-gold-corona .boost-scene-glow { width:42%; left:29%; top:18%; opacity:.24; }
.boost-scene-silver-eclipse > i, .boost-scene-gold-corona > i { width:2px; height:42%; left:49% !important; top:10% !important; border-radius:0; background:linear-gradient(180deg,transparent,currentColor,transparent) !important; box-shadow:none; animation:showcaseSweep 5s ease-in-out infinite; }
.boost-scene-gold-molten .boost-scene-glow, .boost-scene-diamond-rift .boost-scene-glow { top:68%; opacity:.3; }
.boost-scene-diamond-bloom .boost-scene-glow { animation:showcaseSpin 22s linear infinite; background:conic-gradient(from 0deg,transparent,currentColor,transparent 35%,currentColor,transparent); filter:blur(8px); }
.boost-scene-diamond-quantum > i { animation-duration:2.4s; border-radius:1px; }
@media (prefers-reduced-motion: reduce) { .boost-scene .boost-scene-glow, .boost-scene > i { animation:none !important; opacity:.35; } }

/* ─── Ensure boost card children sit above overlays ─────────────────── */
.xvb-root { width: 100%; height: 100%; }
.boost-card > * { position: relative; z-index: 1; }
.boost-card { isolation: isolate; width: 100%; height: 100%; }

/* ─── Source showcase motion primitives ───────────────────────────────── */
.boost-ambient-motion, .boost-signature-motion { position:absolute; inset:0; z-index:2; overflow:hidden; pointer-events:none; }
.boost-ambient-motion > i, .boost-signature-motion > i { position:absolute; display:block; pointer-events:none; }
.boost-ambient-star { width:18px; height:18px; animation:showcaseStar 2.8s ease-in-out infinite; }
.boost-ambient-star::before, .boost-ambient-star::after { content:""; position:absolute; left:50%; top:50%; background:rgba(255,255,255,.95); box-shadow:0 0 8px rgba(255,255,255,.9); transform:translate(-50%,-50%); }
.boost-ambient-star::before { width:18px; height:2px; }.boost-ambient-star::after { width:2px; height:18px; }
.boost-ambient-droplet { top:-12%; width:7px; height:10px; border-radius:50% 50% 50% 40%; background:radial-gradient(circle at 35% 25%,#fff,#c7ced4 55%,#6b7480); box-shadow:0 0 7px rgba(255,255,255,.8); animation:showcaseDrop 3.2s ease-in infinite; }
.boost-ambient-moon { top:9%; right:11%; width:15%; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle at 35% 30%,#fff,#e4e8ec 32%,#aab0b8 70%,#666d76); box-shadow:0 0 34px 8px rgba(220,224,235,.4); }
.boost-ambient-sheen { top:-25%; left:-15%; width:32%; height:150%; background:linear-gradient(180deg,transparent,rgba(255,255,255,.4),transparent); filter:blur(6px); mix-blend-mode:overlay; animation:showcaseSheen 7.5s ease-in-out infinite; }
.boost-ambient-mote { width:4px; height:4px; border-radius:50%; background:#ffd98a; box-shadow:0 0 8px 3px rgba(255,190,90,.8); animation:showcaseMote 6s ease-in-out infinite; }
.boost-ambient-spark { bottom:6%; width:4px; height:4px; border-radius:50%; background:#ffdca8; box-shadow:0 0 10px 3px rgba(255,170,60,.85); animation:showcaseSpark 1.5s cubic-bezier(.2,.8,.3,1) infinite; }
.boost-ambient-ember { width:4px; height:4px; border-radius:50%; background:#ff9a44; box-shadow:0 0 9px 3px rgba(255,130,40,.9); animation:showcaseEmber 2.2s linear infinite; }
.boost-ambient-meteor { width:2px; height:52px; border-radius:2px; background:linear-gradient(180deg,transparent,rgba(196,181,253,.95)); filter:drop-shadow(0 0 5px rgba(196,181,253,.85)); animation:showcaseMeteor 2s linear infinite; }
.boost-ambient-shard { top:-12%; width:6px; height:15px; background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(191,228,255,.45)); clip-path:polygon(50% 0%,100% 32%,68% 100%,32% 100%,0% 32%); filter:drop-shadow(0 0 5px rgba(191,228,255,.7)); animation:showcaseShard 4.5s linear infinite; }
.boost-ambient-prism { top:-20%; left:0; width:3px; height:64px; background:linear-gradient(180deg,transparent,#fff,transparent); filter:drop-shadow(0 0 9px rgba(255,255,255,.8)); offset-path:path("M 50 -30 C 160 60, -20 170, 90 260 C 200 350, 20 430, 110 540"); animation:showcasePrism 5s linear infinite; }
.boost-ambient-pulse { width:4px; height:4px; border-radius:50%; background:#7dd3fc; box-shadow:0 0 9px 3px rgba(125,211,252,.85); animation:showcasePulse 2.8s linear infinite; }
.boost-ambient-petal { width:8px; height:12px; border-radius:50% 50% 50% 0; background:linear-gradient(160deg,#f0abfc,#c4b5fd); filter:drop-shadow(0 0 4px rgba(240,171,252,.65)); animation:showcasePetal 6s ease-in infinite; }
.boost-ambient-void-dot { width:4px; height:4px; border-radius:50%; background:#fff; box-shadow:0 0 7px 2px rgba(255,255,255,.75); animation:showcaseVoid 7s ease-in-out infinite; }
.boost-signature-comet { top:0; left:0; width:8px; height:8px; border-radius:50%; background:#fff; box-shadow:0 0 12px 3px #fff; offset-path:path("M -20 90 Q 200 -40 340 260"); animation:showcaseComet 4.2s cubic-bezier(.4,0,.6,1) infinite; }
.boost-signature-blade { top:0; left:0; width:130px; height:5px; border-radius:3px; background:linear-gradient(90deg,transparent,rgba(255,255,255,.5) 20%,#fff 50%,rgba(255,255,255,.5) 80%,transparent); box-shadow:0 0 18px 4px rgba(255,255,255,.65); animation:showcaseBlade 4.6s ease-in-out infinite; }
.boost-signature-ember { bottom:6%; width:4px; height:4px; border-radius:50%; background:#ffd98a; box-shadow:0 0 6px 2px rgba(255,190,90,.8); animation:showcaseEmber 3.4s linear infinite; }
.boost-signature-gem { width:22px; height:22px; background:linear-gradient(135deg,#fff,#bfe4ff); clip-path:polygon(50% 0%,100% 50%,50% 100%,0 50%); box-shadow:0 0 10px 2px rgba(191,228,255,.55); opacity:calc(1 - var(--index) * .045); }
.boost-signature-gem.head { box-shadow:0 0 18px 5px rgba(191,228,255,.85); }
@keyframes showcaseStar { 0%,84%,100% { opacity:0; transform:scale(.3) rotate(0); } 90% { opacity:1; transform:scale(1.3) rotate(18deg); } 95% { opacity:.4; transform:scale(.8) rotate(18deg); } }
@keyframes showcaseDrop { 0% { transform:translateY(-10%); opacity:0; } 10% { opacity:.95; } 100% { transform:translateY(520%); opacity:0; } }
@keyframes showcaseSheen { 0% { transform:translateX(-70%) rotate(14deg); opacity:0; } 15%,55% { opacity:.9; } 100% { transform:translateX(220%) rotate(14deg); opacity:0; } }
@keyframes showcaseMote { 0%,100% { transform:translate(0,0); opacity:0; } 20% { opacity:.95; } 100% { transform:translate(12px,-150px); opacity:0; } }
@keyframes showcaseSpark { 0% { transform:translate(0,0); opacity:0; } 8% { opacity:1; } 100% { transform:translate(var(--dx,0),var(--dy,-150px)); opacity:0; } }
@keyframes showcaseEmber { 0% { transform:translate(0,0); opacity:0; } 12% { opacity:.9; } 100% { transform:translate(8px,-170px); opacity:0; } }
@keyframes showcaseMeteor { 0% { transform:translate(0,0) rotate(-32deg); opacity:0; } 8%,78% { opacity:1; } 100% { transform:translate(80px,480px) rotate(-32deg); opacity:0; } }
@keyframes showcaseShard { 0% { transform:translate(0,-12%) rotate(0); opacity:0; } 10%,88% { opacity:.9; } 100% { transform:translate(20px,420%) rotate(150deg); opacity:0; } }
@keyframes showcasePrism { 0% { offset-distance:0%; opacity:0; } 8%,90% { opacity:.9; } 100% { offset-distance:100%; opacity:0; } }
@keyframes showcasePulse { 0% { transform:translate(0,0); opacity:0; } 10%,90% { opacity:1; } 100% { transform:translate(70px,12px); opacity:0; } }
@keyframes showcasePetal { 0% { transform:translate(0,-12%) rotate(0); opacity:0; } 10%,85% { opacity:.9; } 100% { transform:translate(20px,420%) rotate(200deg); opacity:0; } }
@keyframes showcaseVoid { 0%,100% { opacity:.15; transform:scale(.7); } 50% { opacity:.9; transform:scale(1.5); } }
@keyframes showcaseComet { 0% { offset-distance:0%; opacity:0; } 8%,90% { opacity:1; } 100% { offset-distance:100%; opacity:0; } }
@keyframes showcaseBlade { 0% { transform:translate(-90px,320px) rotate(-38deg); opacity:0; } 6%,24% { opacity:1; } 33%,100% { opacity:0; } }
@media (prefers-reduced-motion: reduce) { .boost-ambient-motion > i, .boost-signature-motion > i { animation:none !important; opacity:.45; } }

/* ─── Profile card material stack ─────────────────────────────────────── */
.boost-card.card { position:relative; overflow:hidden; isolation:isolate; width: 100%; height: 100%; }
.boost-card.card .card-material,
.boost-card.card .card-scrim,
.boost-card.card .card-frame { position:absolute; inset:0; pointer-events:none; }
.boost-card.card .card-material { z-index:0; overflow:hidden; width: 100%; height: 100%; }
.boost-card.card .card-base { position:absolute; inset:0; background:var(--boost-card-base, transparent); }
.boost-card.card .card-texture { position:absolute; inset:0; opacity:.9; mix-blend-mode:screen; background-repeat:repeat; background-size:auto; }
.boost-card.card .card-light { position:absolute; inset:0; background:radial-gradient(circle 220px at 30% 20%, rgba(255,255,255,.32), transparent 62%); mix-blend-mode:overlay; animation:profileLightDrift 11s ease-in-out infinite; }
.boost-card.card .card-scrim { z-index:2; background:linear-gradient(180deg, rgba(0,0,0,.14), transparent 25%, transparent 58%, rgba(0,0,0,.5)); }
.boost-card.card .card-frame { z-index:3; border:1px solid var(--boost-frame, rgba(255,255,255,.2)); box-shadow:inset 0 0 52px var(--boost-frame-glow, rgba(255,255,255,.08)), 0 18px 64px rgba(0,0,0,.7); border-radius:inherit; }
.boost-card.card .card-content { z-index:4; width: 100%; height: 100%; min-height: 100%; display: flex; flex-direction: column; }

.boost-card.card[data-tier="silver"][data-design="silver-eclipse"] .card-base { background:radial-gradient(circle at 50% 34%, #030405 0 21%, transparent 22%), radial-gradient(circle at 50% 34%, transparent 21%, #f4f6f7 22%, #c7ced4 25%, rgba(199,206,212,.35) 29%, transparent 34%), radial-gradient(ellipse 100% 70% at 50% 34%, rgba(210,216,222,.22), transparent 65%), linear-gradient(180deg,#0b0d11,#15181f 55%,#08090c); }
.boost-card.card[data-tier="silver"][data-design="silver-eclipse"] .card-texture { background-image:repeating-conic-gradient(from 0deg at 50% 34%, rgba(238,241,244,.16) 0deg 1deg, transparent 1deg 7deg), radial-gradient(circle, rgba(255,255,255,.9) 1.2px, transparent 1.6px); background-size:auto,52px 52px; animation:profileTexturePulse 4s ease-in-out infinite; }
.boost-card.card[data-tier="silver"][data-design="silver-mercury"] .card-base { background:radial-gradient(ellipse 55% 42% at 18% 14%, rgba(232,236,240,.52), transparent 60%), radial-gradient(ellipse 48% 38% at 86% 28%, rgba(180,190,200,.42), transparent 55%), radial-gradient(ellipse 65% 48% at 50% 92%, rgba(140,150,160,.44), transparent 60%), linear-gradient(135deg,#0d0f12,#1b2024 55%,#0d0f12); }
.boost-card.card[data-tier="silver"][data-design="silver-mercury"] .card-texture { background-image:repeating-linear-gradient(112deg, rgba(255,255,255,.14) 0 2px, transparent 2px 38px); animation:profileMetalFlow 7s linear infinite; }
.boost-card.card[data-tier="silver"][data-design="silver-chrome"] .card-base { background:radial-gradient(circle at 78% 14%, #4a525c, #1c2027 38%, transparent 62%), radial-gradient(ellipse 70% 50% at 12% 88%, rgba(150,158,168,.14), transparent 60%), linear-gradient(165deg,#0a0c10,#191d24 45%,#0d1015 75%,#050608); }
.boost-card.card[data-tier="silver"][data-design="silver-chrome"] .card-texture { background-image:repeating-linear-gradient(96deg, rgba(255,255,255,.1) 0 1px, transparent 1px 4px), repeating-radial-gradient(circle at 78% 14%, rgba(255,255,255,.07) 0 1px, transparent 1px 7px); animation:profileChromeSheen 7.5s ease-in-out infinite; }

.boost-card.card[data-tier="gold"][data-design="gold-dynasty"] .card-base { background:radial-gradient(ellipse 90% 50% at 50% -10%, rgba(251,191,36,.3), transparent 60%), radial-gradient(ellipse 60% 40% at 0% 90%, rgba(146,64,14,.26), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 60%, rgba(217,119,6,.2), transparent 55%), #060400; }
.boost-card.card[data-tier="gold"][data-design="gold-dynasty"] .card-texture { background-image:linear-gradient(30deg, transparent 45%, rgba(251,191,36,.2) 46% 47%, transparent 48%), linear-gradient(150deg, transparent 45%, rgba(251,191,36,.2) 46% 47%, transparent 48%); background-size:56px 100px; }
.boost-card.card[data-tier="gold"][data-design="gold-solar"] .card-base { background:radial-gradient(ellipse 80% 55% at 50% 108%, rgba(251,191,36,.32), transparent 55%), radial-gradient(ellipse 50% 45% at 22% 35%, rgba(249,115,22,.22), transparent 50%), radial-gradient(ellipse 55% 40% at 75% 30%, rgba(220,38,38,.2), transparent 50%), #050200; }
.boost-card.card[data-tier="gold"][data-design="gold-solar"] .card-texture { background-image:repeating-linear-gradient(0deg, rgba(255,180,80,.11) 0 1px, transparent 1px 3px); animation:profileHeat 3.2s ease-in-out infinite; }
.boost-card.card[data-tier="gold"][data-design="gold-corona"] .card-base { background:repeating-conic-gradient(from 0deg at 50% 118%, rgba(255,180,60,.16) 0deg 5deg, transparent 5deg 11deg), radial-gradient(ellipse 80% 55% at 50% -5%, rgba(251,191,36,.28), transparent 55%), radial-gradient(ellipse 55% 40% at 75% 85%, rgba(220,38,38,.2), transparent 50%), #050200; }
.boost-card.card[data-tier="gold"][data-design="gold-corona"] .card-texture { background-image:repeating-conic-gradient(from 0deg at 50% 118%, rgba(255,255,255,.1) 0deg 2deg, transparent 2deg 14deg); animation:profileCorona 8s linear infinite; }
.boost-card.card[data-tier="gold"][data-design="gold-laurel"] .card-base { background:radial-gradient(ellipse 85% 55% at 50% -8%, rgba(253,230,138,.3), transparent 58%), radial-gradient(ellipse 60% 45% at 8% 95%, rgba(146,64,14,.28), transparent 55%), linear-gradient(175deg,#0c0700,#1a1002 55%,#060300); }
.boost-card.card[data-tier="gold"][data-design="gold-laurel"] .card-texture { background-image:repeating-linear-gradient(90deg, transparent 0 18px, rgba(253,230,138,.16) 19px 20px, transparent 21px 36px); animation:profileLaurel 8s ease-in-out infinite; }
.boost-card.card[data-tier="gold"][data-design="gold-molten"] .card-base { background:radial-gradient(ellipse 90% 60% at 50% 115%, rgba(255,140,20,.4), transparent 55%), radial-gradient(ellipse 50% 35% at 20% 80%, rgba(255,80,20,.26), transparent 50%), radial-gradient(ellipse 45% 30% at 80% 70%, rgba(255,180,40,.2), transparent 50%), linear-gradient(180deg,#0a0603,#150c04 55%,#050200); }
.boost-card.card[data-tier="gold"][data-design="gold-molten"] .card-texture { background-image:linear-gradient(135deg, transparent 46%, rgba(255,160,60,.55) 47% 48%, transparent 49%), linear-gradient(35deg, transparent 54%, rgba(255,190,90,.3) 55% 56%, transparent 57%); animation:profileCrackPulse 3.2s ease-in-out infinite; }

.boost-card.card[data-tier="diamond"] .card-base { background:radial-gradient(ellipse 70% 50% at 50% 0%, rgba(191,228,255,.18), transparent 55%), linear-gradient(180deg,#10121c,#020305 72%); }
.boost-card.card[data-tier="diamond"][data-design="diamond-cosmos"] .card-base { background:radial-gradient(ellipse 55% 40% at 22% 18%, rgba(167,139,250,.36), transparent 60%), radial-gradient(ellipse 50% 35% at 82% 14%, rgba(96,165,250,.28), transparent 55%), radial-gradient(ellipse 60% 45% at 55% 88%, rgba(244,114,182,.22), transparent 60%), #030308; }
.boost-card.card[data-tier="diamond"][data-design="diamond-nebula"] .card-base { background:radial-gradient(ellipse 55% 40% at 22% 18%, rgba(167,139,250,.36), transparent 60%), radial-gradient(ellipse 50% 35% at 82% 14%, rgba(96,165,250,.28), transparent 55%), radial-gradient(ellipse 60% 45% at 55% 88%, rgba(244,114,182,.22), transparent 60%), #030308; }
.boost-card.card[data-tier="diamond"][data-design="diamond-shard"] .card-base { background:radial-gradient(ellipse 55% 38% at 18% 12%, rgba(120,220,255,.24), transparent 58%), radial-gradient(ellipse 48% 36% at 82% 18%, rgba(150,255,220,.16), transparent 55%), radial-gradient(ellipse 80% 60% at 50% 0%, #0e2a40, #01060c 72%); }
.boost-card.card[data-tier="diamond"][data-design="diamond-prism"] .card-base { background:radial-gradient(ellipse 40% 30% at 15% 10%, rgba(255,120,120,.13), transparent 60%), radial-gradient(ellipse 40% 30% at 85% 85%, rgba(120,180,255,.14), transparent 60%), radial-gradient(ellipse 70% 55% at 50% 0%, #10121c, #020204 70%); }
.boost-card.card[data-tier="diamond"][data-design="diamond-void"] .card-base { background:radial-gradient(ellipse 50% 35% at 50% -5%, rgba(150,150,180,.15), transparent 60%), radial-gradient(ellipse 40% 30% at 15% 90%, rgba(120,120,160,.09), transparent 55%), #000; }
.boost-card.card[data-tier="diamond"][data-design="diamond-quantum"] .card-base { background:radial-gradient(ellipse 70% 50% at 50% -5%, rgba(56,189,248,.26), transparent 55%), radial-gradient(ellipse 55% 40% at 15% 85%, rgba(129,140,248,.2), transparent 55%), linear-gradient(180deg,#050a12,#030608 60%,#010203); }
.boost-card.card[data-tier="diamond"][data-design="diamond-bloom"] .card-base { background:radial-gradient(ellipse 65% 50% at 50% 42%, rgba(244,171,252,.28), transparent 55%), radial-gradient(ellipse 90% 70% at 50% 10%, #180b24, transparent 60%), linear-gradient(180deg,#0a0610,#050308 65%,#020103); }
.boost-card.card[data-tier="diamond"][data-design="diamond-rift"] .card-base { background:radial-gradient(ellipse 70% 50% at 50% 105%, rgba(129,140,248,.26), transparent 55%), radial-gradient(ellipse 45% 35% at 15% 20%, rgba(56,189,248,.18), transparent 50%), linear-gradient(180deg,#030308,#06060c 55%,#000); }
.boost-card.card[data-tier="diamond"][data-design="diamond-cosmos"] .card-texture, .boost-card.card[data-tier="diamond"][data-design="diamond-nebula"] .card-texture { background-image:radial-gradient(circle, rgba(255,255,255,.95) 1.2px, transparent 1.6px); background-size:46px 46px; animation:profileStarField 4s ease-in-out infinite; }
.boost-card.card[data-tier="diamond"][data-design="diamond-shard"] .card-texture { background-image:repeating-linear-gradient(58deg, rgba(191,228,255,.16) 0 2px, transparent 2px 26px), repeating-linear-gradient(122deg, rgba(191,228,255,.1) 0 1px, transparent 1px 38px); animation:profileAurora 13s ease-in-out infinite; }
.boost-card.card[data-tier="diamond"][data-design="diamond-prism"] .card-texture { background-image:linear-gradient(60deg, transparent 49%, rgba(255,255,255,.24) 50%, transparent 51%), linear-gradient(120deg, transparent 49%, rgba(255,255,255,.18) 50%, transparent 51%); background-size:60px 52px; animation:profilePrism 6s linear infinite; }
.boost-card.card[data-tier="diamond"][data-design="diamond-void"] .card-texture { background-image:linear-gradient(30deg, transparent 49%, rgba(255,255,255,.18) 50%, transparent 51%), linear-gradient(150deg, transparent 49%, rgba(255,255,255,.14) 50%, transparent 51%); background-size:100px 86px; }
.boost-card.card[data-tier="diamond"][data-design="diamond-quantum"] .card-texture { background-image:linear-gradient(90deg, rgba(125,211,252,.16) 1px, transparent 1px), linear-gradient(rgba(125,211,252,.16) 1px, transparent 1px); background-size:60px 52px; animation:profileCircuit 3s linear infinite; }
.boost-card.card[data-tier="diamond"][data-design="diamond-bloom"] .card-texture { background-image:repeating-conic-gradient(from 0deg at 50% 42%, rgba(244,171,252,.2) 0deg 3deg, transparent 3deg 30deg); animation:profileBloom 22s linear infinite; }
.boost-card.card[data-tier="diamond"][data-design="diamond-rift"] .card-texture { background-image:linear-gradient(135deg, transparent 46%, rgba(147,197,253,.55) 47% 48%, transparent 49%), linear-gradient(35deg, transparent 54%, rgba(129,140,248,.35) 55% 56%, transparent 57%); animation:profileCrackPulse 3s ease-in-out infinite; }

@keyframes profileLightDrift { 0%,100% { background-position:20% 15%; opacity:.35; } 50% { background-position:78% 68%; opacity:.65; } }
@keyframes profileTexturePulse { 0%,100% { opacity:.55; } 50% { opacity:1; } }
@keyframes profileMetalFlow { to { background-position:180px 0; } }
@keyframes profileChromeSheen { 0%,100% { background-position:0 0; } 50% { background-position:80px 0; } }
@keyframes profileHeat { 0%,100% { opacity:.45; } 50% { opacity:.95; } }
@keyframes profileCorona { to { transform:rotate(360deg); } }
@keyframes profileLaurel { 0%,100% { transform:translateX(0); opacity:.45; } 50% { transform:translateX(18px); opacity:.9; } }
@keyframes profileCrackPulse { 0%,100% { opacity:.5; filter:brightness(1); } 50% { opacity:1; filter:brightness(1.45); } }
@keyframes profileStarField { 0%,100% { opacity:.35; background-position:0 0; } 50% { opacity:.85; background-position:23px 18px; } }
@keyframes profileAurora { 0%,100% { transform:translateX(-18px) rotate(-2deg); } 50% { transform:translateX(18px) rotate(2deg); } }
@keyframes profilePrism { to { background-position:60px 52px; } }
@keyframes profileCircuit { to { background-position:60px 52px; } }
@keyframes profileBloom { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .boost-card.card .card-light, .boost-card.card .card-texture { animation:none !important; } }
`;

const BoostStyles = () => (
  <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <style dangerouslySetInnerHTML={{ __html: SHOWCASE_STYLES }} />
  </>
);
export default BoostStyles;