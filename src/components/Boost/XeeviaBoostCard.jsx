import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/*
  XeeviaBoostCard
  ────────────────────────────────────────────────────────────────────────
  React port of the standalone Xeevia "Boost" profile-upgrade card.
  Drop this component into your app section — it is fully self-contained
  (styles are injected via a scoped <style> tag, no external CSS needed
  besides the Google Fonts <link>, which you should add once to your
  document <head>, see FONT_HREF below).

  WHAT CHANGED FROM THE ORIGINAL HTML FILE
  ────────────────────────────────────────────────────────────────────────
  • Tabs, design/blend/font/color pickers are now React state instead of
    manual DOM class toggling.
  • The particle/ambient animations (falling meteors, sparks, motes, the
    comet/blade/serpent scene, etc.) are still built imperatively via
    refs, exactly like the original — porting ~40 unique particle
    generators into fully declarative JSX would balloon this file for no
    behavioral benefit, so `buildAmbient`, `buildAvatarBorder`, and
    `buildFx` remain DOM-manipulation functions, just called from
    `useEffect` instead of inline <script>.
  • All CSS class names are unchanged, but every selector is scoped under
    a single `.xvb-root` wrapper class so this won't collide with your
    app's existing `.card`, `.stats`, `.tabs`, etc. classes.
  • `body { ... }` and `:root { ... }` from the original became
    `.xvb-root { ... }` since this is now a section of a page, not the
    whole document.

  INTEGRATION NOTES (same 5-place rule as the original file)
  ────────────────────────────────────────────────────────────────────────
  Adding or editing a design still touches exactly 5 places, all keyed by
  the same `tier + '-' + designId` string:
    1. `TIERS[tier].designs[]`      — id, display name, tag line, preview swatch
    2. CSS `.card[data-tier=X][data-design=Y] .card-base`     (in STYLES below)
    3. CSS `.card[data-tier=X][data-design=Y] .card-texture`  (in STYLES below)
    4. CSS `.card[data-tier=X][data-design=Y] .avatar-ring`   (in STYLES below)
    5. `buildAmbient()` and `buildAvatarBorder()` — keyed on `key === '<tier>-<id>'`

  PERSISTING A USER'S SELECTION
  ────────────────────────────────────────────────────────────────────────
  This component takes optional `initialSelection` and `onSelectionChange`
  props so you can save/restore which design/blend/font/color a user has
  equipped from your backend, instead of always defaulting to index 0.

  PROFILE DATA
  ────────────────────────────────────────────────────────────────────────
  Pass a `profile` prop to override the placeholder name/handle/avatar
  initials/stats — see defaultProfile below for the shape.
*/

export const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,380;9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&family=Caveat:wght@700&family=Cinzel:wght@700&family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@500;700&family=Manrope:wght@700;800&family=Orbitron:wght@700&family=Playfair+Display:wght@700&family=Space+Mono:wght@700&family=Sora:wght@700&display=swap";

const ACCENT = { silver: '#c7ced4', gold: '#e8c25a', diamond: '#bfe4ff' };

const TIER_ORDER = ['silver', 'gold', 'diamond'];

const TIERS = {
  silver: {
    label: 'Silver', mark: '◈', fine: '925 sterling',
    designs: [
      { id: 'eclipse', name: 'Sterling Eclipse', tag: 'Corona ring, radiating rays, star dust', bg: 'radial-gradient(circle at 50% 40%,#050608 0 22%,#eef1f4 23% 26%,#4a525c 40%,#0a0c10 100%)' },
      { id: 'mercury', name: 'Liquid Mercury', tag: 'Fluid metal, falling mercury droplets', bg: 'radial-gradient(ellipse 70% 60% at 25% 20%,#e8ecf0,#8a95a0 45%,#1b2024)' },
      { id: 'chrome', name: 'Moonlit Chrome', tag: 'Engraved crest, brushed steel, chrome sheen', bg: 'linear-gradient(155deg,#eef1f4 0%,#4a525c 45%,#0a0c10 100%)' },
    ],
    blends: [{ id: 'platinum', name: 'Platinum', hue: 0 }, { id: 'graphite', name: 'Graphite', hue: -25 }, { id: 'aurora', name: 'Aurora', hue: 195 }],
    fonts: [
      { id: 'silver-classic', label: 'Classic', family: "'DM Sans', sans-serif" },
      { id: 'silver-editorial', label: 'Editorial', family: "'Cormorant Garamond', serif" },
    ],
    colors: [{ id: 'p', label: 'Pearl', color: '#f1f5f9' }, { id: 's', label: 'Steel', color: '#94a3b8' }, { id: 'i', label: 'Ice', color: '#bae6fd' }],
  },
  gold: {
    label: 'Gold', mark: '♛', fine: '24kt foil',
    designs: [
      { id: 'dynasty', name: 'Royal Dynasty', tag: 'Engraved hex, drifting gold dust', bg: 'radial-gradient(ellipse 80% 60% at 50% -10%,#fde68a,#c9932f 45%,#060400)' },
      { id: 'solar', name: 'Solar Flare', tag: 'Warm haze, erupting flare sparks', bg: 'radial-gradient(ellipse 80% 70% at 50% 130%,#fbbf24,#dc2626 55%,#050200)' },
      { id: 'corona', name: 'Solar Corona', tag: 'Sunburst rays, erupting flare sparks', bg: 'repeating-conic-gradient(from 0deg at 50% 120%,#f97316 0deg 5deg,#050200 5deg 11deg)' },
      { id: 'laurel', name: 'Imperial Laurel', tag: 'Engraved laurel vine, golden mist, leaf glints', bg: 'linear-gradient(165deg,#fde68a 0%,#8a5f16 45%,#0c0700 100%)' },
      { id: 'molten', name: 'Molten Core', tag: 'Cracked gold ore, glowing fissures, rising embers', bg: 'radial-gradient(ellipse 90% 80% at 50% 120%,#ff9a44,#7a2e04 45%,#050200)' },
    ],
    blends: [{ id: 'classic', name: 'Classic', hue: 0 }, { id: 'ember', name: 'Ember', hue: -18 }, { id: 'rose', name: 'Rosé', hue: 300 }, { id: 'verdant', name: 'Verdant', hue: 140 }],
    fonts: [
      { id: 'gold-classic', label: 'Classic', family: "'DM Sans', sans-serif" },
      { id: 'gold-editorial', label: 'Editorial', family: "'Cormorant Garamond', serif" },
      { id: 'gold-display', label: 'Display', family: "'Space Grotesk', sans-serif" },
      { id: 'gold-mono', label: 'Signal', family: "'Space Mono', monospace" },
      { id: 'gold-soft', label: 'Soft', family: "'Manrope', sans-serif" },
    ],
    colors: [{ id: 'sun', label: 'Sun', color: '#fde68a' }, { id: 'amber', label: 'Amber', color: '#fbbf24' }, { id: 'flame', label: 'Flame', color: '#fb923c' }, { id: 'rose', label: 'Rose', color: '#fda4af' }, { id: 'mint', label: 'Mint', color: '#86efac' }, { id: 'sky', label: 'Sky', color: '#7dd3fc' }],
  },
  diamond: {
    label: 'Diamond', mark: '✦', fine: 'IF–VVS clarity',
    designs: [
      { id: 'brilliant', name: 'Brilliant Cut', tag: 'Faceted kite, sparkle flares', bg: 'radial-gradient(ellipse 85% 65% at 50% -5%,#b8d2e6,#10202e 55%,#020305)' },
      { id: 'nebula', name: 'Nebula Drift', tag: 'Cosmic clouds, shooting stars', bg: 'radial-gradient(ellipse 70% 60% at 30% 20%,#c7b6fa,#7c3aed 45%,#030308)' },
      { id: 'shard', name: 'Glacial Aurora', tag: 'Layered aurora, frost glints, parallax shard fall', bg: 'linear-gradient(155deg,#78dcff 0%,#0e2a40 45%,#01060c 100%)' },
      { id: 'prism', name: 'Prism Array', tag: 'Triangle dispersion, a swimming light-ray sweep', bg: 'radial-gradient(ellipse 75% 60% at 50% -5%,#d8d8f5,#10121c 55%,#020204)' },
      { id: 'void', name: 'Void Lattice', tag: 'Sparse wireframe, drifting motes', bg: 'radial-gradient(ellipse 60% 50% at 50% -5%,#3a3a4a,#0a0a10 55%,#000)' },
      { id: 'quantum', name: 'Quantum Lattice', tag: 'Glowing circuit grid, traveling data pulses', bg: 'linear-gradient(160deg,#7dd3fc 0%,#0a1622 55%,#010203 100%)' },
      { id: 'bloom', name: 'Celestial Bloom', tag: 'Rotating mandala, petals of light', bg: 'radial-gradient(circle at 50% 45%,#f0abfc,#180b24 55%,#020103 100%)' },
      { id: 'rift', name: 'Obsidian Rift', tag: 'Cracked volcanic glass, pulsing energy fissures', bg: 'radial-gradient(ellipse 80% 70% at 50% 110%,#818cf8,#06060c 55%,#000)' },
    ],
    blends: [{ id: 'prism', name: 'Prism', hue: 300 }, { id: 'cosmos', name: 'Cosmos', hue: 40 }, { id: 'glacier', name: 'Glacier', hue: 0 }, { id: 'emerald', name: 'Emerald', hue: 110 }, { id: 'rose', name: 'Rose', hue: 280 }, { id: 'void', name: 'Void', hue: 200 }],
    fonts: [
      { id: 'diamond-classic', label: 'Classic', family: "'DM Sans', sans-serif" },
      { id: 'diamond-editorial', label: 'Editorial', family: "'Cormorant Garamond', serif" },
      { id: 'diamond-display', label: 'Display', family: "'Space Grotesk', sans-serif" },
      { id: 'diamond-mono', label: 'Signal', family: "'Space Mono', monospace" },
      { id: 'diamond-serif', label: 'Nocturne', family: "'Playfair Display', serif" },
      { id: 'diamond-tech', label: 'Tech', family: "'Orbitron', sans-serif" },
      { id: 'diamond-hand', label: 'Signature', family: "'Caveat', cursive" },
      { id: 'diamond-luxe', label: 'Luxe', family: "'Cinzel', serif" },
    ],
    colors: [{ id: 'prism', label: 'Prism', color: '#f0abfc' }, { id: 'cosmos', label: 'Cosmos', color: '#c4b5fd' }, { id: 'glacier', label: 'Glacier', color: '#93c5fd' }, { id: 'emerald', label: 'Emerald', color: '#6ee7b7' }, { id: 'rose', label: 'Rose', color: '#f9a8d4' }, { id: 'void', label: 'Void', color: '#f8fafc' }],
  },
};

const TIER_META = {
  silver: { meta: 'Verified · a single star crossing the dark, every few seconds.' },
  gold: { meta: 'Elite · a blade of light strikes across the card, embers rising after.' },
  diamond: { meta: 'Apex · a gem-serpent swims a slow figure through the stone.' },
};

const defaultProfile = {
  initials: 'SK',
  name: 'Sprouts King',
  handle: '@sprouts_king_53791',
  stats: [
    { value: '16', label: 'Content' },
    { value: '4', label: 'Followers' },
    { value: '101', label: 'EP' },
    { value: '0', label: 'XEV' },
  ],
};

const rand = (a, b) => a + Math.random() * (b - a);

/* eslint-disable react-hooks/exhaustive-deps */

export const SHOWCASE_STYLES = `
.xvb-root {
    --font-display:'Fraunces', serif; --font-ui:'Inter', sans-serif; --font-data:'Space Grotesk', sans-serif;
    --bg:#07080a; --panel:#0c0e11; --panel-line:rgba(255,255,255,0.07);
    --ink:#e9ecef; --ink-dim:#8a9099; --ink-faint:#565b62;
    --s-1:#5b636b; --s-2:#c7ced4; --s-3:#f4f6f7;
    --g-1:#5e3c0d; --g-2:#c9932f; --g-3:#f4dfa8;
    --d-2:#bfe4ff; --d-3:#ffffff;
    --accent:#c7ced4;
  }.xvb-root * { box-sizing:border-box; }.xvb-root {
    background:var(--bg); color:var(--ink); font-family:var(--font-ui); border-radius:24px;
    background-image: radial-gradient(ellipse 60% 40% at 50% -10%, rgba(180,190,200,0.06), transparent 60%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
  }.xvb-root a, .xvb-root button { font-family:inherit; }.xvb-root .shell { max-width:1220px; margin:0 auto; padding:40px 24px 100px; }.xvb-root header.top { display:flex; align-items:center; justify-content:space-between; margin-bottom:36px; flex-wrap:wrap; gap:16px; }.xvb-root .wordmark { display:flex; align-items:center; gap:10px; }.xvb-root .wordmark .dot { width:9px; height:9px; border-radius:50%; background:#3ddc84; box-shadow:0 0 12px #3ddc84aa; }.xvb-root .wordmark span { font-family:var(--font-display); font-weight:600; font-size:20px; }.xvb-root .wordmark small { display:block; font-size:11px; color:var(--ink-faint); letter-spacing:0.14em; text-transform:uppercase; margin-top:2px; }.xvb-root header.top p { margin:0; font-size:13px; color:var(--ink-dim); max-width:360px; text-align:right; }.xvb-root .tabs { position:relative; display:inline-flex; padding:5px; border-radius:16px; background:var(--panel); border:1px solid var(--panel-line); margin-bottom:16px; }.xvb-root .tabs button { position:relative; z-index:1; border:none; background:none; cursor:pointer; padding:10px 22px; font-size:13px; font-weight:700; color:var(--ink-dim); border-radius:12px; transition:color .25s ease; }.xvb-root .tabs .indicator { position:absolute; top:5px; bottom:5px; left:5px; width:calc(33.333% - 3.33px); border-radius:12px; transition:transform .45s cubic-bezier(.65,0,.35,1), background .45s ease; background:linear-gradient(135deg, var(--s-2), var(--s-3)); }.xvb-root [data-active="gold"] .indicator { background:linear-gradient(135deg, var(--g-2), var(--g-3)); }.xvb-root [data-active="diamond"] .indicator { background:linear-gradient(135deg, var(--d-2), var(--d-3)); }.xvb-root [data-active] .tabs button.active { color:#07080a; }.xvb-root .hint { font-size:11.5px; color:var(--ink-faint); margin-bottom:36px; max-width:620px; line-height:1.6; }.xvb-root .hint b { color:var(--ink-dim); }.xvb-root main.grid { display:grid; grid-template-columns:minmax(0,400px) 1fr; gap:56px; align-items:start; }
  @media (max-width: 900px){.xvb-root main.grid { grid-template-columns:1fr; } }.xvb-root .stage { position:sticky; top:32px; }.xvb-root .tier-heading { margin-bottom:18px; }.xvb-root .tier-heading h1 { font-family:var(--font-display); font-size:32px; font-weight:600; margin:0 0 6px; }.xvb-root .tier-heading .meta { font-size:12.5px; color:var(--ink-dim); }.xvb-root .tier-heading .fine { font-family:var(--font-data); font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-faint); margin-top:6px; }.xvb-root .card-stage { perspective:1400px; }.xvb-root .card { position:relative; border-radius:26px; overflow:hidden; isolation:isolate; width:100%; aspect-ratio:3/4; max-width:380px; transform-style:preserve-3d; transition:transform .35s cubic-bezier(.2,.6,.3,1); --hue:0deg; cursor:pointer; }.xvb-root .card-base { position:absolute; inset:0; z-index:0; background-repeat:no-repeat; }.xvb-root .card-texture { position:absolute; inset:0; z-index:0; background-repeat:repeat; }.xvb-root .card-light { position:absolute; inset:0; z-index:1; }.xvb-root .card-ambient { position:absolute; inset:0; z-index:2; overflow:hidden; pointer-events:none; }.xvb-root .card-material { position:absolute; inset:0; z-index:0; filter:hue-rotate(var(--hue)); transition:filter .5s ease; }.xvb-root .card-material .card-ambient, .xvb-root .card-material .card-light { position:absolute; inset:0; }.xvb-root .card-fx { position:absolute; inset:0; z-index:3; overflow:hidden; pointer-events:none; filter:hue-rotate(var(--hue)); transition:filter .5s ease; }.xvb-root .card-scrim { position:absolute; inset:0; z-index:4; pointer-events:none; background:linear-gradient(180deg, rgba(0,0,0,.16) 0%, transparent 26%, transparent 58%, rgba(0,0,0,.42) 100%); }.xvb-root .card-frame { position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:5; }.xvb-root .card-content { position:relative; z-index:6; height:100%; display:flex; flex-direction:column; align-items:center; padding:32px 24px 24px; text-align:center; pointer-events:none; }.xvb-root .card[data-tier="silver"][data-design="chrome"] .card-base { background:
      radial-gradient(circle at 78% 14%, #4a525c 0%, #1c2027 38%, transparent 62%),
      radial-gradient(ellipse 70% 50% at 12% 88%, rgba(150,158,168,.14), transparent 60%),
      linear-gradient(165deg, #0a0c10 0%, #191d24 45%, #0d1015 75%, #050608 100%); }.xvb-root .card[data-tier="silver"][data-design="chrome"] .card-texture { background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='92' height='106'%3E%3Cpath d='M46 4 L82 18 L82 52 Q82 86 46 102 Q10 86 10 52 L10 18 Z' fill='none' stroke='rgba(224,229,234,0.30)' stroke-width='1.2'/%3E%3Cpath d='M46 4 L46 102 M10 34 L82 34 M17 68 L75 68' stroke='rgba(224,229,234,0.18)' stroke-width='0.8' fill='none'/%3E%3Ccircle cx='46' cy='52' r='9' fill='none' stroke='rgba(224,229,234,0.24)' stroke-width='0.9'/%3E%3C/svg%3E"),
      repeating-linear-gradient(96deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 4px),
      repeating-radial-gradient(circle at 78% 14%, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 7px);
      mix-blend-mode:screen; opacity:.9; }.xvb-root .card[data-tier="silver"][data-design="mercury"] .card-base { background:
      radial-gradient(ellipse 55% 42% at 18% 14%, rgba(232,236,240,.52), transparent 60%),
      radial-gradient(ellipse 48% 38% at 86% 28%, rgba(180,190,200,.42), transparent 55%),
      radial-gradient(ellipse 65% 48% at 50% 92%, rgba(140,150,160,.44), transparent 60%),
      radial-gradient(ellipse 40% 30% at 65% 60%, rgba(210,215,222,.30), transparent 50%),
      linear-gradient(135deg, #0d0f12, #1b2024 55%, #0d0f12); }.xvb-root .card[data-tier="silver"][data-design="mercury"] .card-texture { background-image:repeating-linear-gradient(112deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 38px); mix-blend-mode:screen; opacity:.85; }.xvb-root .card[data-tier="silver"][data-design="eclipse"] .card-base { background:
      radial-gradient(circle at 50% 34%, #030405 0%, #030405 21%, transparent 22%),
      radial-gradient(circle at 50% 34%, transparent 21%, #f4f6f7 22%, #c7ced4 25%, rgba(199,206,212,.35) 29%, transparent 34%),
      radial-gradient(ellipse 100% 70% at 50% 34%, rgba(210,216,222,.22), transparent 65%),
      linear-gradient(180deg, #0b0d11 0%, #15181f 55%, #08090c 100%); }.xvb-root .card[data-tier="silver"][data-design="eclipse"] .card-texture { background-image:
      repeating-conic-gradient(from 0deg at 50% 34%, rgba(238,241,244,0.16) 0deg 1deg, transparent 1deg 7deg),
      radial-gradient(circle, rgba(255,255,255,.9) 1.2px, transparent 1.6px),
      radial-gradient(circle, rgba(255,255,255,.55) 1.2px, transparent 1.4px);
      background-size:auto, 52px 52px, 31px 31px; background-position:0 0, 0 0, 15px 21px;
      opacity:.95; }.xvb-root .card[data-tier="silver"] .card-light { background:radial-gradient(circle 260px at var(--mx,30%) var(--my,20%), rgba(255,255,255,.5), transparent 62%); mix-blend-mode:overlay; }.xvb-root .card[data-tier="silver"] .card-frame { border:1px solid rgba(215,220,226,0.4); box-shadow:inset 0 0 60px rgba(200,206,212,0.08), 0 24px 60px rgba(0,0,0,.6); }.xvb-root .card[data-tier="gold"][data-design="dynasty"] .card-base { background:
      radial-gradient(ellipse 90% 50% at 50% -10%, rgba(251,191,36,0.30) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 0% 90%, rgba(146,64,14,0.26) 0%, transparent 55%),
      radial-gradient(ellipse 50% 40% at 100% 60%, rgba(217,119,6,0.20) 0%, transparent 55%),
      radial-gradient(ellipse 30% 30% at 80% 10%, rgba(254,240,138,0.16) 0%, transparent 50%), #060400; }.xvb-root .card[data-tier="gold"][data-design="dynasty"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 0 L56 16 L56 50 L28 66 L0 50 L0 16Z' fill='none' stroke='rgba(251,191,36,0.38)' stroke-width='1.2'/%3E%3C/svg%3E"); opacity:1; }.xvb-root .card[data-tier="gold"][data-design="solar"] .card-base { background:
      radial-gradient(ellipse 80% 55% at 50% 108%, rgba(251,191,36,.32) 0%, transparent 55%),
      radial-gradient(ellipse 50% 45% at 22% 35%, rgba(249,115,22,.22) 0%, transparent 50%),
      radial-gradient(ellipse 55% 40% at 75% 30%, rgba(220,38,38,.20) 0%, transparent 50%), #050200; }.xvb-root .card[data-tier="gold"][data-design="solar"] .card-texture { background-image:repeating-linear-gradient(0deg, rgba(255,180,80,.11) 0 1px, transparent 1px 3px); opacity:.7; }.xvb-root .card[data-tier="gold"][data-design="corona"] .card-base { background:
      repeating-conic-gradient(from 0deg at 50% 118%, rgba(255,180,60,.16) 0deg 5deg, transparent 5deg 11deg),
      radial-gradient(ellipse 80% 55% at 50% -5%, rgba(251,191,36,.28) 0%, transparent 55%),
      radial-gradient(ellipse 55% 40% at 75% 85%, rgba(220,38,38,.20) 0%, transparent 50%), #050200; }.xvb-root .card[data-tier="gold"][data-design="corona"] .card-texture { background-image:repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 3px); opacity:.6; }.xvb-root .card[data-tier="gold"] .card-light { background:radial-gradient(circle 240px at var(--mx,30%) var(--my,20%), rgba(255,245,220,.55), transparent 60%); mix-blend-mode:overlay; }.xvb-root .card[data-tier="gold"] .card-frame { border:1px solid rgba(244,223,168,0.55); box-shadow:inset 0 0 60px rgba(201,147,47,0.14), 0 24px 60px rgba(0,0,0,.65); }.xvb-root .card[data-tier="gold"][data-design="laurel"] .card-base { background:
      radial-gradient(ellipse 85% 55% at 50% -8%, rgba(253,230,138,.30) 0%, transparent 58%),
      radial-gradient(ellipse 60% 45% at 8% 95%, rgba(146,64,14,.28) 0%, transparent 55%),
      radial-gradient(ellipse 55% 42% at 95% 90%, rgba(217,119,6,.22) 0%, transparent 55%),
      linear-gradient(175deg, #0c0700 0%, #1a1002 55%, #060300 100%); }.xvb-root .card[data-tier="gold"][data-design="laurel"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='120'%3E%3Cpath d='M35 6 Q52 20 35 34 Q18 20 35 6Z' fill='none' stroke='rgba(253,230,138,0.42)' stroke-width='1.2'/%3E%3Cpath d='M35 34 Q52 48 35 62 Q18 48 35 34Z' fill='none' stroke='rgba(253,230,138,0.36)' stroke-width='1.2'/%3E%3Cpath d='M35 62 Q52 76 35 90 Q18 76 35 62Z' fill='none' stroke='rgba(253,230,138,0.30)' stroke-width='1.2'/%3E%3Cline x1='35' y1='6' x2='35' y2='96' stroke='rgba(253,230,138,0.22)' stroke-width='0.9'/%3E%3C/svg%3E"); opacity:.95; }.xvb-root .card[data-tier="gold"][data-design="molten"] .card-base { background:
      radial-gradient(ellipse 90% 60% at 50% 115%, rgba(255,140,20,.40) 0%, transparent 55%),
      radial-gradient(ellipse 50% 35% at 20% 80%, rgba(255,80,20,.26) 0%, transparent 50%),
      radial-gradient(ellipse 45% 30% at 80% 70%, rgba(255,180,40,.20) 0%, transparent 50%),
      linear-gradient(180deg, #0a0603 0%, #150c04 55%, #050200 100%); }.xvb-root .card[data-tier="gold"][data-design="molten"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cpath d='M10 130 L34 96 L26 60 L52 44 L48 8 M52 44 L86 52 L94 20 M52 44 L74 82 L118 88 M26 60 L4 74' fill='none' stroke='rgba(255,160,60,0.55)' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E"); opacity:.95; }.xvb-root .card[data-tier="diamond"][data-design="brilliant"] .card-base { background:
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(180,210,230,.20), transparent 55%),
      radial-gradient(ellipse 50% 40% at 15% 70%, rgba(150,180,210,.14), transparent 50%),
      radial-gradient(ellipse 50% 40% at 85% 70%, rgba(150,180,210,.14), transparent 50%),
      radial-gradient(ellipse 90% 70% at 50% 0%, #10202e 0%, #020305 65%); }.xvb-root .card[data-tier="diamond"][data-design="brilliant"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='130'%3E%3Cpath d='M65 0 L130 42 L98 130 L32 130 L0 42 Z' fill='none' stroke='rgba(255,255,255,0.38)' stroke-width='1.3'/%3E%3Cpath d='M65 0 L65 48 M0 42 L65 48 L130 42 M32 130 L65 48 L98 130' stroke='rgba(255,255,255,0.26)' stroke-width='1.1' fill='none'/%3E%3C/svg%3E"); opacity:1; }.xvb-root .card[data-tier="diamond"][data-design="nebula"] .card-base { background:
      radial-gradient(ellipse 55% 40% at 22% 18%, rgba(167,139,250,.36), transparent 60%),
      radial-gradient(ellipse 50% 35% at 82% 14%, rgba(96,165,250,.28), transparent 55%),
      radial-gradient(ellipse 60% 45% at 55% 88%, rgba(244,114,182,.22), transparent 60%),
      radial-gradient(ellipse 45% 35% at 40% 55%, rgba(124,58,237,.18), transparent 50%), #030308; }.xvb-root .card[data-tier="diamond"][data-design="nebula"] .card-texture { background-image:
      radial-gradient(circle, rgba(255,255,255,.98) 1.2px, transparent 1.6px),
      radial-gradient(circle, rgba(255,255,255,.7) 1.2px, transparent 1.4px);
      background-size:46px 46px, 27px 27px; background-position:0 0, 13px 19px; opacity:.85; }.xvb-root .card[data-tier="diamond"][data-design="shard"] .card-base { background:
      radial-gradient(ellipse 55% 38% at 18% 12%, rgba(120,220,255,.24), transparent 58%),
      radial-gradient(ellipse 48% 36% at 82% 18%, rgba(150,255,220,.16), transparent 55%),
      radial-gradient(ellipse 60% 45% at 55% 100%, rgba(80,150,255,.20), transparent 60%),
      radial-gradient(ellipse 80% 60% at 50% 0%, #0e2a40, #01060c 72%); }.xvb-root .card[data-tier="diamond"][data-design="shard"] .card-texture { background-image:
      repeating-linear-gradient(58deg, rgba(191,228,255,0.16) 0 2px, transparent 2px 26px),
      repeating-linear-gradient(122deg, rgba(191,228,255,0.10) 0 1px, transparent 1px 38px),
      repeating-linear-gradient(4deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 60px); }.xvb-root .card[data-tier="diamond"][data-design="prism"] .card-base { background:
      radial-gradient(ellipse 40% 30% at 15% 10%, rgba(255,120,120,.13), transparent 60%),
      radial-gradient(ellipse 40% 30% at 85% 85%, rgba(120,180,255,.14), transparent 60%),
      radial-gradient(ellipse 35% 28% at 85% 15%, rgba(180,255,180,.10), transparent 55%),
      radial-gradient(ellipse 70% 55% at 50% 0%, #10121c, #020204 70%); }.xvb-root .card[data-tier="diamond"][data-design="prism"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpath d='M30 0 L60 52 L0 52 Z' fill='none' stroke='rgba(255,255,255,0.32)' stroke-width='1.1'/%3E%3Cpath d='M30 0 L30 52 M0 52 L30 26 L60 52' stroke='rgba(255,255,255,0.22)' stroke-width='0.9' fill='none'/%3E%3C/svg%3E"); opacity:1; }.xvb-root .card[data-tier="diamond"][data-design="void"] .card-base { background:
      radial-gradient(ellipse 50% 35% at 50% -5%, rgba(150,150,180,.15), transparent 60%),
      radial-gradient(ellipse 40% 30% at 15% 90%, rgba(120,120,160,.09), transparent 55%),
      radial-gradient(ellipse 40% 30% at 85% 90%, rgba(120,120,160,.09), transparent 55%), #000; }.xvb-root .card[data-tier="diamond"][data-design="void"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='86'%3E%3Cpath d='M50 4 L96 29 L96 62 L50 84 L4 62 L4 29 Z' fill='none' stroke='rgba(255,255,255,0.26)' stroke-width='1.2'/%3E%3C/svg%3E"); opacity:1; }.xvb-root .card[data-tier="diamond"][data-design="quantum"] .card-base { background:
      radial-gradient(ellipse 70% 50% at 50% -5%, rgba(56,189,248,.26), transparent 55%),
      radial-gradient(ellipse 55% 40% at 15% 85%, rgba(129,140,248,.20), transparent 55%),
      radial-gradient(ellipse 55% 40% at 88% 78%, rgba(45,212,191,.18), transparent 55%),
      linear-gradient(180deg, #050a12 0%, #030608 60%, #010203 100%); }.xvb-root .card[data-tier="diamond"][data-design="quantum"] .card-texture { background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpath d='M30 0 L60 26 L30 52 L0 26 Z' fill='none' stroke='rgba(125,211,252,0.40)' stroke-width='1.1'/%3E%3Ccircle cx='30' cy='0' r='1.8' fill='rgba(125,211,252,0.85)'/%3E%3Ccircle cx='60' cy='26' r='1.8' fill='rgba(125,211,252,0.85)'/%3E%3Ccircle cx='30' cy='52' r='1.8' fill='rgba(125,211,252,0.85)'/%3E%3Ccircle cx='0' cy='26' r='1.8' fill='rgba(125,211,252,0.85)'/%3E%3C/svg%3E");
      opacity:1; }.xvb-root .card[data-tier="diamond"][data-design="bloom"] .card-base { background:
      radial-gradient(ellipse 65% 50% at 50% 42%, rgba(244,171,252,.28), transparent 55%),
      radial-gradient(ellipse 55% 40% at 50% 42%, rgba(196,181,253,.22), transparent 50%),
      radial-gradient(ellipse 90% 70% at 50% 10%, #180b24, transparent 60%),
      linear-gradient(180deg, #0a0610 0%, #050308 65%, #020103 100%); }.xvb-root .card[data-tier="diamond"][data-design="bloom"] .card-texture {
      background-repeat:no-repeat; background-position:center 40%; background-size:82% auto;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cg fill='none' stroke='rgba(244,171,252,0.42)' stroke-width='1.1'%3E%3Ccircle cx='120' cy='120' r='30'/%3E%3Ccircle cx='120' cy='120' r='60'/%3E%3Ccircle cx='120' cy='120' r='90'/%3E%3Cpath d='M120 30 A90 90 0 0 1 198 165 A90 90 0 0 1 42 165 A90 90 0 0 1 120 30Z'/%3E%3Cpath d='M120 210 A90 90 0 0 1 42 75 A90 90 0 0 1 198 75 A90 90 0 0 1 120 210Z'/%3E%3C/g%3E%3C/svg%3E");
      opacity:.95; animation:bloomRotate 55s linear infinite, bloomBreathe 6s ease-in-out infinite; transform-origin:50% 40%; }.xvb-root .card[data-tier="diamond"][data-design="rift"] .card-base { background:
      radial-gradient(ellipse 70% 50% at 50% 105%, rgba(129,140,248,.26), transparent 55%),
      radial-gradient(ellipse 45% 35% at 15% 20%, rgba(56,189,248,.18), transparent 50%),
      linear-gradient(180deg, #030308 0%, #06060c 55%, #000 100%); }.xvb-root .card[data-tier="diamond"][data-design="rift"] .card-texture { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cpath d='M10 150 L44 110 L34 70 L64 50 L58 8 M64 50 L104 60 L114 24 M64 50 L90 96 L140 100 M34 70 L6 86' fill='none' stroke='rgba(147,197,253,0.55)' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E"); opacity:1; }.xvb-root .card[data-tier="diamond"] .card-light { background:radial-gradient(circle 200px at var(--mx,30%) var(--my,20%), rgba(255,255,255,.5), transparent 60%); mix-blend-mode:overlay; }.xvb-root .card[data-tier="diamond"] .card-frame { border:1px solid rgba(191,228,255,0.5); box-shadow:inset 0 0 70px rgba(191,228,255,0.10), 0 24px 70px rgba(0,0,0,.75), 0 0 90px rgba(191,228,255,.12); }.xvb-root .amb-moon { position:absolute; top:9%; right:11%; width:15%; aspect-ratio:1; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff 0%, #e4e8ec 32%, #aab0b8 70%, #666d76 100%); box-shadow:0 0 34px 8px rgba(220,224,235,.4), 0 0 70px 18px rgba(180,190,205,.18); overflow:hidden; }.xvb-root .amb-moon::before { content:''; position:absolute; inset:0; background:rgba(6,7,10,.6); border-radius:50%; transform:translateX(-38%); filter:blur(1px); }.xvb-root .amb-moon::after { content:''; position:absolute; inset:0; border-radius:50%; background:
      radial-gradient(circle at 66% 70%, rgba(0,0,0,.18) 0 14%, transparent 15%),
      radial-gradient(circle at 30% 58%, rgba(0,0,0,.14) 0 9%, transparent 10%),
      radial-gradient(circle at 55% 24%, rgba(0,0,0,.12) 0 7%, transparent 8%); }

  @keyframes chromeSheen{ 0%{ transform:translateX(-70%) rotate(14deg); opacity:0; } 15%{ opacity:.9; } 55%{ opacity:.9; } 100%{ transform:translateX(220%) rotate(14deg); opacity:0; } }.xvb-root .amb-chromesheen { position:absolute; top:-25%; left:-15%; width:32%; height:150%; background:linear-gradient(180deg, transparent, rgba(255,255,255,.4), transparent); filter:blur(6px); mix-blend-mode:overlay; animation:chromeSheen 7.5s ease-in-out infinite; }

  @keyframes meteorFall{ 0%{ transform:translate(0,0) rotate(-32deg); opacity:0; } 8%{opacity:1;} 78%{opacity:1;} 100%{ transform:translate(var(--dx,70px), 480px) rotate(-32deg); opacity:0; } }.xvb-root .amb-meteor { position:absolute; width:2px; height:52px; border-radius:2px; background:linear-gradient(180deg, transparent, rgba(255,255,255,.95)); filter:drop-shadow(0 0 5px rgba(255,255,255,.85)); animation:meteorFall var(--dur,1.9s) linear var(--del,0s) infinite; }.xvb-root .amb-meteor.nebula { background:linear-gradient(180deg, transparent, rgba(196,181,253,.95)); filter:drop-shadow(0 0 5px rgba(196,181,253,.85)); }

  @keyframes dropFall{ 0%{ transform:translate(0,-14%) scaleY(.8); opacity:0;} 8%{opacity:.95;} 72%{ transform:translate(var(--dx,6px), 380%) scaleY(1.3); opacity:.95;} 100%{ transform:translate(var(--dx,6px), 420%) scaleY(.4); opacity:0;} }.xvb-root .amb-droplet { position:absolute; width:7px; height:10px; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; background:radial-gradient(circle at 35% 28%, #fff, #c7ced4 55%, #6b7480 100%); box-shadow:0 0 5px rgba(255,255,255,.55); animation:dropFall var(--dur,3.2s) ease-in var(--del,0s) infinite; }

  @keyframes moteFloat{ 0%{ transform:translate(0,0); opacity:0;} 15%{opacity:.95;} 50%{ transform:translate(var(--dx,10px), -60%);} 85%{opacity:.75;} 100%{ transform:translate(calc(var(--dx,10px) * 1.6), -125%); opacity:0;} }.xvb-root .amb-mote { position:absolute; width:3.5px; height:3.5px; border-radius:50%; background:#ffd98a; box-shadow:0 0 7px 2px rgba(255,200,100,.8); animation:moteFloat var(--dur,6s) ease-in-out var(--del,0s) infinite; }.xvb-root .amb-mote.voidmote { background:#dfe6ee; box-shadow:0 0 6px 2px rgba(210,220,235,.55); }

  @keyframes sparkErupt{ 0%{ transform:translate(0,0) scale(1); opacity:0;} 8%{opacity:1;} 100%{ transform:translate(var(--dx,0), var(--dy,-150px)) scale(.25); opacity:0;} }.xvb-root .amb-spark { position:absolute; left:50%; top:94%; width:4px; height:4px; border-radius:50%; background:#ffdca8; box-shadow:0 0 9px 3px rgba(255,170,60,.85); animation:sparkErupt var(--dur,1.4s) cubic-bezier(.2,.8,.3,1) var(--del,0s) infinite; }

  @keyframes starFlare{ 0%,84%,100%{ opacity:0; transform:translate(-50%,-50%) scale(.3) rotate(0deg);} 90%{ opacity:1; transform:translate(-50%,-50%) scale(1.3) rotate(18deg);} 95%{ opacity:.4; transform:translate(-50%,-50%) scale(.8) rotate(18deg);} }.xvb-root .amb-star { position:absolute; width:18px; height:18px; animation:starFlare 2.8s ease-in-out infinite; }.xvb-root .amb-star::before, .xvb-root .amb-star::after { content:''; position:absolute; top:50%; left:50%; background:linear-gradient(90deg, transparent, rgba(255,255,255,.98), transparent); }.xvb-root .amb-star::before { width:18px; height:2px; transform:translate(-50%,-50%); }.xvb-root .amb-star::after { width:2px; height:18px; transform:translate(-50%,-50%); }

  @keyframes shardFall{ 0%{ transform:translate(0,-12%) rotate(0deg); opacity:0;} 10%{opacity:.9;} 88%{opacity:.9;} 100%{ transform:translate(var(--dx,20px), 420%) rotate(150deg); opacity:0;} }.xvb-root .amb-shardbit { position:absolute; width:6px; height:15px; background:linear-gradient(180deg, rgba(255,255,255,.95), rgba(191,228,255,.45)); clip-path:polygon(50% 0%, 100% 32%, 68% 100%, 32% 100%, 0% 32%); filter:drop-shadow(0 0 4px rgba(191,228,255,.65)); animation:shardFall var(--dur,4.2s) linear var(--del,0s) infinite; }.xvb-root .amb-shardbit.far { width:4px; height:10px; opacity:.55; filter:drop-shadow(0 0 3px rgba(191,228,255,.4)) blur(.4px); }.xvb-root .amb-shardbit.near { width:7px; height:18px; filter:drop-shadow(0 0 6px rgba(191,228,255,.75)); }

  @keyframes auroraDrift{ 0%{ transform:translate(-26%,-8%) rotate(-6deg); opacity:.5; } 50%{ transform:translate(12%,6%) rotate(-3deg); opacity:.85; } 100%{ transform:translate(-26%,-8%) rotate(-6deg); opacity:.5; } }.xvb-root .amb-aurora { position:absolute; left:-25%; top:-15%; width:150%; height:65%; background:linear-gradient(100deg, transparent 0%, rgba(120,220,255,.32) 22%, rgba(150,255,220,.24) 42%, rgba(110,170,255,.28) 62%, transparent 88%); filter:blur(16px); mix-blend-mode:screen; animation:auroraDrift 13s ease-in-out infinite; }

  @keyframes frostGlint{ 0%,100%{ opacity:.2; transform:scale(1) rotate(0deg); } 50%{ opacity:.95; transform:scale(1.4) rotate(20deg); } }.xvb-root .amb-frostglint { position:absolute; width:4px; height:4px; background:#eaf7ff; clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%); box-shadow:0 0 7px 2px rgba(191,228,255,.75); animation:frostGlint var(--dur,3.2s) ease-in-out var(--del,0s) infinite; }

  @keyframes iceRefraction{ 0%{ transform:translate(-70%,-70%) rotate(24deg); opacity:0; } 18%{ opacity:.45; } 50%{ opacity:.45; } 82%{ opacity:0; } 100%{ transform:translate(70%,70%) rotate(24deg); opacity:0; } }.xvb-root .amb-refraction { position:absolute; top:-45%; left:-45%; width:55%; height:190%; background:linear-gradient(180deg, transparent, rgba(255,255,255,.55), rgba(150,220,255,.3), transparent); filter:blur(9px); mix-blend-mode:screen; animation:iceRefraction 10s ease-in-out infinite; }

  @keyframes prismSwim{ 0%{ offset-distance:0%; opacity:0; } 8%{ opacity:.9; } 90%{ opacity:.9; } 100%{ offset-distance:100%; opacity:0; } }.xvb-root .amb-prismray { position:absolute; top:0; left:0; width:3px; height:64px; border-radius:3px; background:linear-gradient(180deg, transparent, rgba(255,255,255,.95), transparent); filter:blur(.5px) drop-shadow(0 0 9px rgba(255,255,255,.6)); mix-blend-mode:screen; offset-rotate:auto; animation:prismSwim linear infinite; }

  @keyframes twinkle{ 0%,100%{ opacity:var(--o,.2); transform:scale(1);} 50%{ opacity:calc(var(--o,.2)*2.4); transform:scale(1.6);} }.xvb-root .amb-dot { position:absolute; border-radius:50%; background:#fff; animation:twinkle var(--dur,3s) ease-in-out var(--del,0s) infinite; }.xvb-root .amb-void-spark { position:absolute; top:0; left:0; width:4px; height:4px; border-radius:50%; background:#fff; box-shadow:0 0 7px 2px rgba(255,255,255,.75); offset-rotate:0deg; animation:voidTravel 9s linear infinite; }
  @keyframes voidTravel{ 0%{ offset-distance:0%; opacity:.15;} 50%{opacity:.9;} 100%{ offset-distance:100%; opacity:.15;} }

  @keyframes bloomRotate{ to{ transform:rotate(360deg); } }

  @keyframes quantumPulse{ 0%{ transform:translate(0,0); opacity:0; } 10%{opacity:1;} 90%{opacity:1;} 100%{ transform:translate(var(--dx,60px), var(--dy,0px)); opacity:0; } }.xvb-root .amb-quantumpulse { position:absolute; width:4px; height:4px; border-radius:50%; background:#7dd3fc; box-shadow:0 0 8px 3px rgba(125,211,252,.85); animation:quantumPulse var(--dur,2.6s) linear var(--del,0s) infinite; }

  @keyframes scanSweep{ 0%{ transform:translateY(-40%); opacity:0; } 12%{ opacity:.65; } 88%{ opacity:.65; } 100%{ transform:translateY(140%); opacity:0; } }.xvb-root .amb-scanline { position:absolute; left:-8%; right:-8%; height:3px; background:linear-gradient(90deg, transparent, rgba(125,211,252,.95), transparent); filter:blur(1px) drop-shadow(0 0 9px rgba(125,211,252,.8)); animation:scanSweep 4.6s linear infinite; }

  @keyframes dataFlow{ 0%{ offset-distance:0%; opacity:0; } 8%{ opacity:1; } 92%{ opacity:1; } 100%{ offset-distance:100%; opacity:0; } }.xvb-root .amb-datapacket { position:absolute; width:9px; height:3px; border-radius:2px; background:linear-gradient(90deg, transparent, #7dd3fc, #fff); filter:drop-shadow(0 0 6px rgba(125,211,252,.85)); animation:dataFlow linear infinite; }

  @keyframes nodeBurst{ 0%,88%,100%{ opacity:0; transform:scale(.3); } 92%{ opacity:1; transform:scale(1.6); } 96%{ opacity:.3; transform:scale(2.4); } }.xvb-root .amb-nodeburst { position:absolute; width:6px; height:6px; border-radius:50%; background:#e0f2fe; box-shadow:0 0 14px 5px rgba(125,211,252,.9); animation:nodeBurst 3.6s ease-in-out infinite; }

  @keyframes moltenPulse{ 0%,100%{ opacity:.35; } 50%{ opacity:.8; } }.xvb-root .amb-moltenglow { position:absolute; left:0; right:0; bottom:-10%; height:55%; background:radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,130,30,.55), transparent 70%); filter:blur(10px); animation:moltenPulse 3.2s ease-in-out infinite; }

  @keyframes bloomBreathe{ 0%,100%{ opacity:.82; } 50%{ opacity:1; } }.xvb-root .amb-bloomrays { position:absolute; left:50%; top:40%; width:74%; aspect-ratio:1; transform:translate(-50%,-50%); border-radius:50%; background:repeating-conic-gradient(from 0deg, rgba(244,171,252,.16) 0deg 3deg, transparent 3deg 30deg); filter:blur(2px); animation:ringSpin 34s linear infinite reverse; }
  @keyframes petalFall{ 0%{ transform:translate(0,-12%) rotate(0deg); opacity:0; } 10%{ opacity:.92; } 85%{ opacity:.75; } 100%{ transform:translate(var(--dx,20px), 420%) rotate(200deg); opacity:0; } }.xvb-root .amb-petal { position:absolute; width:8px; height:12px; border-radius:50% 50% 50% 0; background:linear-gradient(160deg, #f0abfc, #c4b5fd); filter:drop-shadow(0 0 4px rgba(240,171,252,.65)); animation:petalFall var(--dur,6s) ease-in var(--del,0s) infinite; }

  @keyframes riftPulse{ 0%,100%{ opacity:.32; } 50%{ opacity:.75; } }.xvb-root .amb-riftglow { position:absolute; inset:0; background:radial-gradient(ellipse 60% 50% at 50% 60%, rgba(147,197,253,.32), transparent 65%); filter:blur(12px); animation:riftPulse 3s ease-in-out infinite; }
  @keyframes riftFlash{ 0%,90%,100%{ opacity:0; } 92%{ opacity:.4; } 94%{ opacity:.1; } 96%{ opacity:.32; } 98%{ opacity:0; } }.xvb-root .amb-riftflash { position:absolute; inset:0; background:radial-gradient(ellipse 75% 60% at 50% 55%, rgba(180,210,255,.6), transparent 70%); animation:riftFlash 9s ease-in-out infinite; }
  @keyframes energyTravel{ 0%{ offset-distance:0%; opacity:0; } 10%{ opacity:1; } 90%{ opacity:1; } 100%{ offset-distance:100%; opacity:0; } }.xvb-root .amb-riftenergy { position:absolute; width:5px; height:5px; border-radius:50%; background:#dbeafe; box-shadow:0 0 12px 4px rgba(147,197,253,.95); animation:energyTravel linear infinite; }

  @keyframes cometMove{ 0%{ offset-distance:0%; opacity:0; } 8%{ opacity:1; } 90%{ opacity:1; } 100%{ offset-distance:100%; opacity:0; } }.xvb-root .fx-particle { position:absolute; top:0; left:0; border-radius:50%; background:#fff; box-shadow:0 0 8px 2px rgba(255,255,255,.85); offset-rotate:0deg; }
  @keyframes bladeSwipe{ 0%{ transform:translate(-90px,320px) rotate(-38deg); opacity:0; } 6%{ opacity:1; } 24%{ transform:translate(320px,-40px) rotate(-38deg); opacity:1; } 33%{ opacity:0; } 100%{ opacity:0; } }.xvb-root .fx-blade { position:absolute; top:0; left:0; width:130px; height:5px; border-radius:3px; background:linear-gradient(90deg, transparent, rgba(255,255,255,.5) 20%, #fff 50%, rgba(255,255,255,.5) 80%, transparent); box-shadow:0 0 18px 4px rgba(255,255,255,.65); animation:bladeSwipe 4.6s ease-in-out infinite; }
  @keyframes sparkBurst{ 0%,20%{ opacity:0; transform:scale(.2); } 26%{ opacity:1; transform:scale(1); } 42%{ opacity:0; transform:scale(1.7); } 100%{ opacity:0; } }.xvb-root .fx-spark { position:absolute; width:70px; height:70px; margin:-35px; border-radius:50%; background:radial-gradient(circle, rgba(255,240,205,.95), transparent 70%); animation:sparkBurst 4.6s ease-in-out infinite; }
  @keyframes emberRise{ 0%{ transform:translate(0,0); opacity:0; } 12%{ opacity:.9; } 100%{ transform:translate(var(--drift,8px), -170px); opacity:0; } }.xvb-root .fx-ember { position:absolute; bottom:6%; width:4px; height:4px; border-radius:50%; background:#ffd98a; box-shadow:0 0 6px 2px rgba(255,190,90,.8); animation:emberRise linear infinite; }.xvb-root .fx-gem { position:absolute; top:0; left:0; clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%); background:linear-gradient(135deg,#fff,var(--d-2)); box-shadow:0 0 10px 2px rgba(191,228,255,.55); }.xvb-root .fx-gem.head { box-shadow:0 0 18px 5px rgba(191,228,255,.85), 0 0 34px 10px rgba(191,228,255,.35); }.xvb-root .fx-static { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:48px; opacity:.18; }
  @property --mx{ syntax:'<percentage>'; inherits:true; initial-value:32%; }
  @property --my{ syntax:'<percentage>'; inherits:true; initial-value:22%; }.xvb-root .card.is-idle { animation:ambientTilt 11s ease-in-out infinite; }
  @keyframes ambientTilt{ 0%,100%{ --mx:26%; --my:18%; } 50%{ --mx:76%; --my:64%; } }
  @media (prefers-reduced-motion: reduce){.xvb-root .card.is-idle { animation:none; }.xvb-root .amb-meteor, .xvb-root .amb-droplet, .xvb-root .amb-mote, .xvb-root .amb-spark, .xvb-root .amb-star, .xvb-root .amb-shardbit, .xvb-root .amb-prismray, .xvb-root .amb-dot, .xvb-root .amb-void-spark, .xvb-root .amb-aurora, .xvb-root .amb-frostglint, .xvb-root .amb-refraction, .xvb-root .amb-chromesheen, .xvb-root .amb-quantumpulse, .xvb-root .amb-moltenglow, .xvb-root .amb-riftglow, .xvb-root .amb-scanline, .xvb-root .amb-datapacket, .xvb-root .amb-nodeburst, .xvb-root .amb-bloomrays, .xvb-root .amb-petal, .xvb-root .amb-riftflash, .xvb-root .amb-riftenergy { animation:none !important; opacity:.4; }.xvb-root .card[data-tier="diamond"][data-design="bloom"] .card-texture { animation:none !important; }
  }.xvb-root .avatar-wrap { position:relative; width:114px; height:114px; margin-bottom:14px; display:flex; align-items:center; justify-content:center; }.xvb-root .avatar-glow { position:absolute; inset:9px; border-radius:50%; z-index:0; filter:blur(8px); pointer-events:none; }.xvb-root .card[data-tier="silver"] .avatar-glow { background:radial-gradient(circle, rgba(210,216,222,.5), transparent 70%); }.xvb-root .card[data-tier="gold"] .avatar-glow { background:radial-gradient(circle, rgba(201,147,47,.55), transparent 70%); }.xvb-root .card[data-tier="diamond"] .avatar-glow { background:radial-gradient(circle, rgba(191,228,255,.5), transparent 70%); }.xvb-root .avatar-ring { position:absolute; inset:0; border-radius:50%; z-index:1; pointer-events:none;
    -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));
    mask:radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px)); }.xvb-root .avatar-fx { position:absolute; inset:0; z-index:1; pointer-events:none; overflow:visible; }.xvb-root .avatar-core { position:relative; z-index:2; width:88px; height:88px; }.xvb-root .avatar { width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:27px; font-weight:600; color:#fff; background:linear-gradient(160deg, #2a2f36, #14171a); border:2px solid rgba(255,255,255,0.16); box-shadow:0 0 0 3px #07080a; }.xvb-root .tier-mark { position:absolute; right:-2px; bottom:-2px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; border:2px solid #07080a; z-index:3; }.xvb-root .card[data-tier="silver"] .tier-mark { background:linear-gradient(135deg,var(--s-2),var(--s-3)); }.xvb-root .card[data-tier="gold"] .tier-mark { background:linear-gradient(135deg,var(--g-2),var(--g-3)); }.xvb-root .card[data-tier="diamond"] .tier-mark { background:linear-gradient(135deg,var(--d-2),var(--d-3)); }

  @keyframes ringSpin{ to{ transform:rotate(360deg); } }
  @keyframes ringPulseGlow{ 0%,100%{ filter:brightness(1) saturate(1); } 50%{ filter:brightness(1.4) saturate(1.35); } }
  @keyframes ringShimmer{ 0%,100%{ opacity:.82; } 50%{ opacity:1; } }
  @keyframes avatarOrbit{ from{ offset-distance:0%; } to{ offset-distance:100%; } }
  @keyframes prismHue{ 0%{ filter:hue-rotate(0deg) brightness(1.15); } 100%{ filter:hue-rotate(360deg) brightness(1.15); } }.xvb-root .card[data-tier="silver"][data-design="chrome"] .avatar-ring { background:conic-gradient(from 0deg,#3a4048,#eef1f4 22%,#7a828c 45%,#f7f9fa 68%,#4a5058 88%,#3a4048); animation:ringSpin 9s linear infinite; }.xvb-root .card[data-tier="silver"][data-design="mercury"] .avatar-ring { background:conic-gradient(from 90deg,#c7ced4,#f7f9fa 18%,#8a95a0 40%,#eef1f4 58%,#5b636b 78%,#c7ced4); animation:ringSpin 5.5s ease-in-out infinite alternate, ringShimmer 3s ease-in-out infinite; }.xvb-root .card[data-tier="silver"][data-design="eclipse"] .avatar-ring { background:conic-gradient(from 0deg,#eef1f4,#c7ced4 8%,#3a4048 14%,#14171a 50%,#3a4048 86%,#c7ced4 92%,#eef1f4 100%); animation:ringSpin 10s linear infinite; }.xvb-root .card[data-tier="gold"][data-design="dynasty"] .avatar-ring { background:repeating-conic-gradient(from 0deg,#f4dfa8 0deg 7deg,#c9932f 7deg 14deg,#8a5f16 14deg 17deg,#c9932f 17deg 20deg); animation:ringSpin 15s linear infinite; }.xvb-root .card[data-tier="gold"][data-design="solar"] .avatar-ring { background:conic-gradient(from 180deg,#fbbf24,#dc2626 30%,#f97316 55%,#fde68a 80%,#dc2626 100%); animation:ringSpin 7s linear infinite reverse, ringPulseGlow 2.6s ease-in-out infinite; }.xvb-root .card[data-tier="gold"][data-design="corona"] .avatar-ring { -webkit-mask:radial-gradient(circle, transparent 58%, #000 63%, #000 100%); mask:radial-gradient(circle, transparent 58%, #000 63%, #000 100%); background:repeating-conic-gradient(from 0deg, rgba(251,191,36,.95) 0deg 2deg, transparent 2deg 14deg); animation:ringSpin 10s linear infinite; }.xvb-root .card[data-tier="gold"][data-design="laurel"] .avatar-ring { background:repeating-conic-gradient(from 0deg,#fde68a 0deg 5deg,#c9932f 5deg 9deg,#7a4e12 9deg 10deg,#c9932f 10deg 12deg); animation:ringSpin 18s linear infinite; }.xvb-root .card[data-tier="gold"][data-design="molten"] .avatar-ring { background:conic-gradient(from 0deg,#3a1c04,#ff9a44 15%,#7a2e04 30%,#ffcf7a 45%,#3a1c04 60%,#ff6a1a 75%,#3a1c04 100%); animation:ringSpin 6s linear infinite, ringPulseGlow 2.2s ease-in-out infinite; }.xvb-root .card[data-tier="diamond"][data-design="brilliant"] .avatar-ring { background:repeating-conic-gradient(from 0deg,#eaf6ff 0deg 6deg,#10202e 6deg 12deg,#bfe4ff 12deg 18deg,#10202e 18deg 24deg); animation:ringSpin 16s linear infinite; }.xvb-root .card[data-tier="diamond"][data-design="nebula"] .avatar-ring { background:conic-gradient(from 0deg,#a78bfa,#60a5fa 25%,#f472b6 50%,#7c3aed 75%,#a78bfa 100%); animation:ringSpin 12s linear infinite, ringPulseGlow 6s ease-in-out infinite; filter:blur(.3px); }.xvb-root .card[data-tier="diamond"][data-design="shard"] .avatar-ring { background:repeating-conic-gradient(from 0deg,#bfe4ff 0deg 9deg,#123048 9deg 13deg,#ffffff 13deg 15deg,#123048 15deg 19deg); animation:ringSpin 22s linear infinite; }.xvb-root .card[data-tier="diamond"][data-design="prism"] .avatar-ring { background:conic-gradient(from 0deg,#ff6b6b,#ffd166,#8affc1,#6ec6ff,#b98cff,#ff6b6b 100%); animation:ringSpin 8s linear infinite; filter:saturate(1.3); }.xvb-root .card[data-tier="diamond"][data-design="void"] .avatar-ring { background:conic-gradient(from 0deg, transparent 0deg 330deg, rgba(255,255,255,.95) 330deg 345deg, transparent 345deg 360deg); animation:ringSpin 4.5s linear infinite; }.xvb-root .card[data-tier="diamond"][data-design="quantum"] .avatar-ring { background:repeating-conic-gradient(from 0deg,#7dd3fc 0deg 4deg,#0a1622 4deg 8deg,#38bdf8 8deg 10deg,#0a1622 10deg 14deg); animation:ringSpin 6s linear infinite; }.xvb-root .card[data-tier="diamond"][data-design="bloom"] .avatar-ring { background:conic-gradient(from 0deg,#f0abfc,#c4b5fd 16%,#f0abfc 33%,#fbcfe8 50%,#c4b5fd 66%,#f0abfc 83%,#fbcfe8 100%); animation:ringSpin 20s linear infinite, ringPulseGlow 5s ease-in-out infinite; }.xvb-root .card[data-tier="diamond"][data-design="rift"] .avatar-ring { background:conic-gradient(from 0deg,#0a0a12,#93c5fd 10%,#0a0a12 22%,#818cf8 34%,#0a0a12 46%,#93c5fd 58%,#0a0a12 70%,#818cf8 82%,#0a0a12 100%); animation:ringSpin 9s linear infinite, ringPulseGlow 2.4s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce){.xvb-root .avatar-ring { animation:none !important; }
  }.xvb-root .p-name { font-size:21px; font-weight:800; margin:0 0 8px; transition:color .3s ease, text-shadow .3s ease; position:relative; }.xvb-root .text-block { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; }.xvb-root .text-block::before { content:''; position:absolute; inset:-14px -30px; z-index:-1; border-radius:18px; background:radial-gradient(ellipse 88% 82% at 50% 34%, rgba(0,0,0,.58), rgba(0,0,0,.26) 55%, transparent 78%); filter:blur(5px); pointer-events:none; }.xvb-root .p-badges { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; justify-content:center; }.xvb-root .p-badges span { font-size:10px; font-weight:700; letter-spacing:0.04em; padding:4px 9px; border-radius:20px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.18); color:#e9ecef; text-shadow:0 1px 2px rgba(0,0,0,.7); }.xvb-root .p-handle { font-size:12px; color:#c7ced4; margin-bottom:18px; text-shadow:0 1px 3px rgba(0,0,0,.85); }.xvb-root .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; width:100%; margin-top:auto; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08); }.xvb-root .stats div { text-align:center; }.xvb-root .stats b { display:block; font-family:var(--font-data); font-size:15px; font-weight:700; text-shadow:0 1px 3px rgba(0,0,0,.75); }.xvb-root .stats span { font-size:9px; letter-spacing:0.08em; color:var(--ink-faint); text-transform:uppercase; text-shadow:0 1px 2px rgba(0,0,0,.7); }.xvb-root .card-controls { display:flex; align-items:center; justify-content:space-between; margin-top:16px; gap:10px; max-width:380px; }.xvb-root .now-tag { font-size:11.5px; color:var(--ink-dim); line-height:1.5; }.xvb-root .now-tag b { color:var(--ink); }.xvb-root .replay-btn { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:var(--ink); background:var(--panel); border:1px solid var(--panel-line); padding:8px 13px; border-radius:10px; cursor:pointer; transition:border-color .2s, transform .15s; flex-shrink:0; }.xvb-root .replay-btn:hover { border-color:var(--accent); transform:translateY(-1px); }.xvb-root .panel-block { margin-bottom:32px; }.xvb-root .panel-block h2 { font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-faint); margin:0 0 14px; display:flex; align-items:center; gap:8px; }.xvb-root .panel-block h2 em { font-style:normal; color:var(--ink-dim); font-weight:600; text-transform:none; letter-spacing:0; }.xvb-root .design-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(158px,1fr)); gap:12px; }.xvb-root .design-card { text-align:left; padding:0; border-radius:14px; background:var(--panel); border:1px solid var(--panel-line); cursor:pointer; transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease; overflow:hidden; }.xvb-root .design-card:hover { border-color:rgba(255,255,255,0.25); transform:translateY(-2px); }.xvb-root .design-card.active { border-color:var(--accent); box-shadow:0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), 0 8px 24px rgba(0,0,0,.4); }.xvb-root .design-preview { position:relative; width:100%; aspect-ratio:16/10; background-size:cover; overflow:hidden; }.xvb-root .design-preview::after { content:''; position:absolute; inset:0; background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.16) 50%, transparent 70%); background-size:250% 100%; animation:sheenDrift 5s ease-in-out infinite; }
  @keyframes sheenDrift{ 0%{background-position:220% 0} 100%{background-position:-120% 0} }.xvb-root .design-txt { padding:10px 12px 12px; }.xvb-root .design-txt b { display:block; font-size:12.5px; font-weight:700; margin-bottom:2px; }.xvb-root .design-txt span { font-size:10px; color:var(--ink-faint); }.xvb-root .theme-grid { display:flex; flex-wrap:wrap; gap:8px; }.xvb-root .theme-card { display:flex; align-items:center; gap:8px; padding:8px 13px 8px 8px; border-radius:12px; background:var(--panel); border:1px solid var(--panel-line); cursor:pointer; transition:all .18s ease; }.xvb-root .theme-card:hover { border-color:rgba(255,255,255,0.22); }.xvb-root .theme-card.active { background:rgba(255,255,255,0.06); border-color:var(--accent); box-shadow:0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }.xvb-root .theme-swatch { width:26px; height:26px; border-radius:8px; flex-shrink:0; border:1px solid rgba(255,255,255,0.18); }.xvb-root .theme-card b { font-size:11.5px; font-weight:700; }.xvb-root .font-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; }.xvb-root .font-btn { padding:11px 10px; border-radius:10px; background:var(--panel); border:1px solid var(--panel-line); color:var(--ink); font-size:14px; cursor:pointer; transition:all .18s ease; text-align:left; }.xvb-root .font-btn.active { background:rgba(255,255,255,0.06); border-color:var(--accent); box-shadow:0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }.xvb-root .font-btn small { display:block; font-family:var(--font-ui); font-size:9px; color:var(--ink-faint); letter-spacing:.06em; text-transform:uppercase; margin-top:3px; }.xvb-root .color-row { display:flex; flex-wrap:wrap; gap:9px; }.xvb-root .color-dot { width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,0.18); cursor:pointer; transition:all .18s ease; }.xvb-root .color-dot.active { border-color:#fff; transform:scale(1.12); box-shadow:0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent); }.xvb-root button:focus-visible, .xvb-root .theme-card:focus-visible, .xvb-root .design-card:focus-visible, .xvb-root .font-btn:focus-visible, .xvb-root .color-dot:focus-visible { outline:2px solid #fff; outline-offset:2px; }

/* ── UPGRADE 1: Equip Flash — a one-shot, tier-unique flourish that plays across the
   card every time a design, blend, font, or color is picked. Same trigger, three
   completely different physical effects so each tier's act of "equipping" something
   feels distinct. ── */
.xvb-root .equip-flash{ position:absolute; inset:0; z-index:7; pointer-events:none; opacity:0; border-radius:inherit; }
.xvb-root[data-active="silver"] .equip-flash{
  background:linear-gradient(115deg, transparent 40%, rgba(255,255,255,.85) 50%, transparent 60%);
  background-size:300% 100%; background-position:220% 0; mix-blend-mode:overlay;
  animation:equipFlashSilver .9s cubic-bezier(.2,.7,.3,1) both;
}
@keyframes equipFlashSilver{ 0%{ opacity:0; background-position:220% 0; } 12%{ opacity:1; } 70%{ opacity:.9; } 100%{ opacity:0; background-position:-140% 0; } }

.xvb-root[data-active="gold"] .equip-flash{
  background:radial-gradient(circle at 50% 55%, rgba(255,210,120,.9), rgba(251,146,20,.35) 40%, transparent 68%);
  animation:equipFlashGold 1.1s ease-out both;
}
@keyframes equipFlashGold{ 0%{ opacity:0; transform:scale(.4); } 22%{ opacity:1; transform:scale(1); } 100%{ opacity:0; transform:scale(1.7); } }

.xvb-root[data-active="diamond"] .equip-flash{
  background:linear-gradient(100deg, transparent 30%, rgba(255,120,120,.5) 42%, rgba(255,255,255,.9) 50%, rgba(120,220,255,.5) 58%, transparent 70%);
  background-size:280% 100%; background-position:220% 0; mix-blend-mode:screen; filter:blur(.5px);
  animation:equipFlashDiamond 1.15s cubic-bezier(.2,.7,.3,1) both;
}
@keyframes equipFlashDiamond{ 0%{ opacity:0; background-position:220% 0; } 10%{ opacity:1; } 75%{ opacity:.85; } 100%{ opacity:0; background-position:-160% 0; } }

@media (prefers-reduced-motion: reduce){
  .xvb-root .equip-flash{ display:none; }
}

/* ── UPGRADE 2: Faceted swatches — the blend + color pickers change material per tier
   instead of staying identical circles everywhere. ── */
.xvb-root[data-active="silver"] .theme-swatch,
.xvb-root[data-active="silver"] .color-dot{ position:relative; overflow:hidden; }
.xvb-root[data-active="silver"] .theme-swatch::after,
.xvb-root[data-active="silver"] .color-dot::after{
  content:''; position:absolute; inset:-50%;
  background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.65) 50%, transparent 70%);
  background-size:250% 100%; background-position:220% 0; transition:background-position .55s ease;
}
.xvb-root[data-active="silver"] .theme-card:hover .theme-swatch::after,
.xvb-root[data-active="silver"] .color-dot:hover::after{ background-position:-120% 0; }

.xvb-root[data-active="gold"] .theme-swatch,
.xvb-root[data-active="gold"] .color-dot{ transition:box-shadow .25s ease, transform .25s ease; }
.xvb-root[data-active="gold"] .theme-card:hover .theme-swatch,
.xvb-root[data-active="gold"] .color-dot:hover{
  animation:goldSwatchPulse 1.1s ease-in-out infinite;
}
@keyframes goldSwatchPulse{ 0%,100%{ box-shadow:0 0 0 0 rgba(251,191,36,0); } 50%{ box-shadow:0 0 14px 3px rgba(251,191,36,.65); } }

.xvb-root[data-active="diamond"] .theme-swatch{
  border-radius:4px; clip-path:polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
  transition:filter .3s ease;
}
.xvb-root[data-active="diamond"] .color-dot{
  border-radius:4px; clip-path:polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  transition:filter .3s ease;
}
.xvb-root[data-active="diamond"] .theme-card:hover .theme-swatch,
.xvb-root[data-active="diamond"] .color-dot:hover{
  animation:diamondSwatchHue 1.4s linear infinite;
}
@keyframes diamondSwatchHue{ 0%{ filter:hue-rotate(0deg) brightness(1.1); } 100%{ filter:hue-rotate(360deg) brightness(1.1); } }

@media (prefers-reduced-motion: reduce){
  .xvb-root .theme-card:hover .theme-swatch, .xvb-root .color-dot:hover{ animation:none !important; }
}
`;

function spawnDots(container, count, sizeRange, opts = {}) {
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'amb-dot';
    const size = rand(sizeRange[0], sizeRange[1]);
    d.style.width = size + 'px'; d.style.height = size + 'px';
    d.style.top = rand(0, 92) + '%';
    d.style.left = rand(0, 92) + '%';
    d.style.setProperty('--o', rand(0.35, 0.75).toFixed(2));
    d.style.setProperty('--dur', rand(2.2, 5.2).toFixed(2) + 's');
    d.style.setProperty('--del', (-rand(0, 4)).toFixed(2) + 's');
    if (opts.boxShadow) d.style.boxShadow = opts.boxShadow;
    container.appendChild(d);
  }
}
function spawnMeteors(container, count, cls) {
  for (let i = 0; i < count; i++) {
    const m = document.createElement('div');
    m.className = 'amb-meteor' + (cls ? ' ' + cls : '');
    m.style.left = rand(-5, 80) + '%';
    m.style.top = rand(-15, 40) + '%';
    m.style.setProperty('--dx', rand(50, 110) + 'px');
    m.style.setProperty('--dur', rand(1.4, 2.6).toFixed(2) + 's');
    m.style.setProperty('--del', (-rand(0, 6)).toFixed(2) + 's');
    container.appendChild(m);
  }
}

export function buildAmbient(container, tier, designId, reduceMotion) {
  if (!container) return;
  container.innerHTML = '';
  if (reduceMotion) return;
  const key = tier + '-' + designId;

  if (key === 'silver-chrome') {
    const moon = document.createElement('div'); moon.className = 'amb-moon'; container.appendChild(moon);
    spawnMeteors(container, 6);
    const sheen = document.createElement('div'); sheen.className = 'amb-chromesheen'; container.appendChild(sheen);
  } else if (key === 'silver-eclipse') {
    const corona = document.createElement('div');
    Object.assign(corona.style, {
      position: 'absolute', left: '50%', top: '34%', width: '46%', aspectRatio: '1',
      transform: 'translate(-50%,-50%)', borderRadius: '50%',
      background: 'radial-gradient(circle, transparent 40%, rgba(238,241,244,.4) 46%, transparent 60%)',
      filter: 'blur(4px)', animation: 'moltenPulse 5s ease-in-out infinite',
    });
    container.appendChild(corona);
    spawnDots(container, 10, [1, 2], { boxShadow: '0 0 4px rgba(255,255,255,.7)' });
    const flare = document.createElement('div'); flare.className = 'amb-star';
    flare.style.left = 'calc(50% + 20%)'; flare.style.top = '34%';
    flare.style.animationDuration = '3.4s';
    container.appendChild(flare);
  } else if (key === 'silver-mercury') {
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div'); d.className = 'amb-droplet';
      d.style.left = rand(5, 92) + '%'; d.style.top = rand(-20, 10) + '%';
      d.style.setProperty('--dx', rand(-8, 8) + 'px');
      d.style.setProperty('--dur', rand(2.4, 4.2).toFixed(2) + 's');
      d.style.setProperty('--del', (-rand(0, 5)).toFixed(2) + 's');
      container.appendChild(d);
    }
  } else if (key === 'gold-dynasty') {
    for (let i = 0; i < 11; i++) {
      const m = document.createElement('div'); m.className = 'amb-mote';
      m.style.left = rand(5, 92) + '%'; m.style.top = rand(70, 96) + '%';
      m.style.setProperty('--dx', rand(-16, 16) + 'px');
      m.style.setProperty('--dur', rand(4.5, 8).toFixed(2) + 's');
      m.style.setProperty('--del', (-rand(0, 7)).toFixed(2) + 's');
      container.appendChild(m);
    }
  } else if (key === 'gold-solar' || key === 'gold-corona') {
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('div'); s.className = 'amb-spark';
      s.style.setProperty('--dx', rand(-70, 70) + 'px');
      s.style.setProperty('--dy', -rand(90, 190) + 'px');
      s.style.setProperty('--dur', rand(1.1, 1.9).toFixed(2) + 's');
      s.style.setProperty('--del', (-rand(0, 3)).toFixed(2) + 's');
      container.appendChild(s);
    }
  } else if (key === 'gold-laurel') {
    const mist = document.createElement('div'); mist.className = 'amb-aurora';
    mist.style.background = 'linear-gradient(100deg, transparent, rgba(253,230,138,.22), transparent)';
    mist.style.filter = 'blur(20px)';
    container.appendChild(mist);
    spawnDots(container, 9, [1.4, 2.6], { boxShadow: '0 0 6px rgba(253,230,138,.85)' });
  } else if (key === 'gold-molten') {
    const glow = document.createElement('div'); glow.className = 'amb-moltenglow'; container.appendChild(glow);
    for (let i = 0; i < 10; i++) {
      const e = document.createElement('div'); e.className = 'amb-mote';
      e.style.left = rand(10, 90) + '%'; e.style.top = rand(75, 98) + '%';
      e.style.background = '#ff9a44'; e.style.boxShadow = '0 0 8px 3px rgba(255,130,40,.9)';
      e.style.setProperty('--dx', rand(-14, 14) + 'px');
      e.style.setProperty('--dur', rand(3.5, 6).toFixed(2) + 's');
      e.style.setProperty('--del', (-rand(0, 6)).toFixed(2) + 's');
      container.appendChild(e);
    }
  } else if (key === 'diamond-brilliant') {
    const spots = [[18, 14], [76, 10], [42, 34], [64, 46], [24, 62], [80, 68], [50, 80], [12, 88]];
    spots.forEach(([l, t], i) => {
      const s = document.createElement('div'); s.className = 'amb-star';
      s.style.left = l + '%'; s.style.top = t + '%';
      s.style.animationDelay = (-(i * 0.35)).toFixed(2) + 's';
      s.style.animationDuration = (2.4 + (i % 3) * 0.4) + 's';
      container.appendChild(s);
    });
  } else if (key === 'diamond-nebula') {
    spawnMeteors(container, 4, 'nebula');
    spawnDots(container, 11, [1, 2.2], { boxShadow: '0 0 5px rgba(255,255,255,0.85)' });
  } else if (key === 'diamond-shard') {
    const aurora = document.createElement('div'); aurora.className = 'amb-aurora'; container.appendChild(aurora);
    for (let i = 0; i < 7; i++) {
      const g = document.createElement('div'); g.className = 'amb-frostglint';
      g.style.left = rand(6, 90) + '%'; g.style.top = rand(6, 90) + '%';
      g.style.setProperty('--dur', rand(2.4, 4.5).toFixed(2) + 's');
      g.style.setProperty('--del', (-rand(0, 4)).toFixed(2) + 's');
      container.appendChild(g);
    }
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('div'); s.className = 'amb-shardbit far';
      s.style.left = rand(5, 92) + '%'; s.style.top = rand(-20, 10) + '%';
      s.style.setProperty('--dx', rand(-16, 16) + 'px');
      s.style.setProperty('--dur', rand(5.5, 8).toFixed(2) + 's');
      s.style.setProperty('--del', (-rand(0, 7)).toFixed(2) + 's');
      container.appendChild(s);
    }
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('div'); s.className = 'amb-shardbit near';
      s.style.left = rand(5, 92) + '%'; s.style.top = rand(-20, 10) + '%';
      s.style.setProperty('--dx', rand(-26, 26) + 'px');
      s.style.setProperty('--dur', rand(3, 4.6).toFixed(2) + 's');
      s.style.setProperty('--del', (-rand(0, 6)).toFixed(2) + 's');
      container.appendChild(s);
    }
    const refr = document.createElement('div'); refr.className = 'amb-refraction'; container.appendChild(refr);
  } else if (key === 'diamond-prism') {
    const path = "path('M 50 -30 C 160 60, -20 170, 90 260 C 200 350, 20 430, 110 540')";
    const hues = [0, 130, 250];
    for (let i = 0; i < 3; i++) {
      const ray = document.createElement('div'); ray.className = 'amb-prismray';
      ray.style.offsetPath = path;
      ray.style.filter = (ray.style.filter || '') + ` hue-rotate(${hues[i]}deg)`;
      ray.style.animationDuration = (4.6 + i * 0.7).toFixed(2) + 's';
      ray.style.animationDelay = (-i * 1.7).toFixed(2) + 's';
      container.appendChild(ray);
    }
    spawnDots(container, 8, [1, 2], { boxShadow: '0 0 5px rgba(255,255,255,.75)' });
  } else if (key === 'diamond-void') {
    const spark = document.createElement('div'); spark.className = 'amb-void-spark';
    spark.style.offsetPath = "path('M50 4 L96 29 L96 62 L50 84 L4 62 L4 29 Z')";
    container.appendChild(spark);
    for (let i = 0; i < 6; i++) {
      const m = document.createElement('div'); m.className = 'amb-mote voidmote';
      m.style.left = rand(10, 85) + '%'; m.style.top = rand(20, 85) + '%';
      m.style.setProperty('--dx', rand(-14, 14) + 'px');
      m.style.setProperty('--dur', rand(6, 10).toFixed(2) + 's');
      m.style.setProperty('--del', (-rand(0, 8)).toFixed(2) + 's');
      container.appendChild(m);
    }
  } else if (key === 'diamond-quantum') {
    for (let i = 0; i < 6; i++) {
      const p = document.createElement('div'); p.className = 'amb-quantumpulse';
      p.style.left = rand(0, 90) + '%'; p.style.top = rand(0, 90) + '%';
      p.style.setProperty('--dx', rand(40, 90) + 'px');
      p.style.setProperty('--dy', rand(-40, 40) + 'px');
      p.style.setProperty('--dur', rand(2, 3.6).toFixed(2) + 's');
      p.style.setProperty('--del', (-rand(0, 4)).toFixed(2) + 's');
      container.appendChild(p);
    }
    spawnDots(container, 10, [1.2, 2], { boxShadow: '0 0 6px rgba(125,211,252,.85)' });
  } else if (key === 'diamond-bloom') {
    const CX = 50, CY = 40;
    [0, 60, 120, 180, 240, 300].forEach((ang, i) => {
      const radn = ang * Math.PI / 180;
      const s = document.createElement('div'); s.className = 'amb-star';
      s.style.left = (CX + 34 * Math.cos(radn)) + '%'; s.style.top = (CY + 30 * Math.sin(radn)) + '%';
      s.style.animationDelay = (-i * 0.5).toFixed(2) + 's'; s.style.animationDuration = '3s';
      container.appendChild(s);
    });
    spawnDots(container, 8, [1, 2], { boxShadow: '0 0 5px rgba(244,171,252,.8)' });
  } else if (key === 'diamond-rift') {
    const glow = document.createElement('div'); glow.className = 'amb-riftglow'; container.appendChild(glow);
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div'); s.className = 'amb-spark';
      s.style.left = rand(20, 80) + '%'; s.style.top = 'auto'; s.style.bottom = rand(0, 20) + '%';
      s.style.background = '#93c5fd'; s.style.boxShadow = '0 0 9px 3px rgba(147,197,253,.9)';
      s.style.setProperty('--dx', rand(-50, 50) + 'px');
      s.style.setProperty('--dy', -rand(70, 150) + 'px');
      s.style.setProperty('--dur', rand(1.3, 2.2).toFixed(2) + 's');
      s.style.setProperty('--del', (-rand(0, 3)).toFixed(2) + 's');
      container.appendChild(s);
    }
  }
}

export function buildAvatarBorder(container, tier, designId, reduceMotion) {
  if (!container) return;
  container.innerHTML = '';
  if (reduceMotion) return;
  const key = tier + '-' + designId;
  const CX = 57, CY = 57;

  if (key === 'silver-chrome') {
    const glint = document.createElement('div');
    Object.assign(glint.style, {
      position: 'absolute', width: '6px', height: '6px', borderRadius: '50%',
      background: '#fff', boxShadow: '0 0 8px 3px rgba(255,255,255,.9)',
      offsetPath: 'circle(53px at 57px 57px)', animation: 'avatarOrbit 4.5s linear infinite',
    });
    container.appendChild(glint);
  } else if (key === 'silver-eclipse') {
    const flareAngle = -20 * Math.PI / 180;
    const flare = document.createElement('div'); flare.className = 'amb-star';
    flare.style.width = '12px'; flare.style.height = '12px';
    flare.style.left = (CX + 50 * Math.cos(flareAngle) - 6) + 'px';
    flare.style.top = (CY + 50 * Math.sin(flareAngle) - 6) + 'px';
    flare.style.animationDuration = '3.4s';
    container.appendChild(flare);
  } else if (key === 'silver-mercury') {
    for (let i = 0; i < 2; i++) {
      const d = document.createElement('div'); d.className = 'amb-droplet';
      d.style.width = '5px'; d.style.height = '7px';
      d.style.left = (44 + i * 22) + 'px'; d.style.top = '96px';
      d.style.setProperty('--dur', (2.6 + i * 0.6) + 's');
      d.style.setProperty('--del', (-i * 1.1) + 's');
      container.appendChild(d);
    }
  } else if (key === 'gold-dynasty') {
    for (let i = 0; i < 6; i++) {
      const ang = i * 60;
      const s = document.createElement('div');
      Object.assign(s.style, {
        position: 'absolute', width: '6px', height: '6px', left: '50%', top: '50%',
        marginLeft: '-3px', marginTop: '-3px', background: 'linear-gradient(135deg,#fde68a,#c9932f)',
        clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', boxShadow: '0 0 6px rgba(251,191,36,.75)',
        transform: `rotate(${ang}deg) translate(53px)`,
      });
      container.appendChild(s);
    }
  } else if (key === 'gold-solar') {
    for (let i = 0; i < 4; i++) {
      const e = document.createElement('div'); e.className = 'fx-ember';
      e.style.position = 'absolute'; e.style.left = (30 + i * 16) + 'px'; e.style.bottom = '2px';
      e.style.animationDuration = (2 + Math.random()) + 's';
      e.style.animationDelay = (-Math.random() * 3) + 's';
      e.style.setProperty('--drift', (Math.random() * 14 - 7) + 'px');
      container.appendChild(e);
    }
  } else if (key === 'gold-laurel') {
    for (let i = 0; i < 5; i++) {
      const ang = i * 72;
      const l = document.createElement('div');
      Object.assign(l.style, {
        position: 'absolute', width: '7px', height: '10px', left: '50%', top: '50%',
        marginLeft: '-3.5px', marginTop: '-5px', background: 'linear-gradient(160deg,#fde68a,#c9932f)',
        clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 60%)', boxShadow: '0 0 5px rgba(253,230,138,.75)',
        transform: `rotate(${ang}deg) translate(53px) rotate(${-ang}deg)`,
      });
      container.appendChild(l);
    }
  } else if (key === 'gold-molten') {
    for (let i = 0; i < 4; i++) {
      const e = document.createElement('div'); e.className = 'fx-ember';
      e.style.position = 'absolute'; e.style.left = (28 + i * 17) + 'px'; e.style.bottom = '0px';
      e.style.animationDuration = (1.8 + Math.random()) + 's';
      e.style.animationDelay = (-Math.random() * 3) + 's';
      e.style.setProperty('--drift', (Math.random() * 14 - 7) + 'px');
      container.appendChild(e);
    }
  } else if (key === 'diamond-brilliant') {
    [20, 150, 270].forEach((ang, i) => {
      const radn = ang * Math.PI / 180;
      const s = document.createElement('div'); s.className = 'amb-star';
      s.style.width = '10px'; s.style.height = '10px';
      s.style.left = (CX + 50 * Math.cos(radn) - 5) + 'px';
      s.style.top = (CY + 50 * Math.sin(radn) - 5) + 'px';
      s.style.animationDelay = (-i * 0.7) + 's';
      s.style.animationDuration = '2.4s';
      container.appendChild(s);
    });
  } else if (key === 'diamond-nebula') {
    for (let i = 0; i < 6; i++) {
      const ang = rand(0, 360), radn = ang * Math.PI / 180, dist = rand(49, 54);
      const dot = document.createElement('div'); dot.className = 'amb-dot';
      const size = rand(1.4, 2.4);
      dot.style.width = size + 'px'; dot.style.height = size + 'px';
      dot.style.left = (CX + dist * Math.cos(radn)) + 'px';
      dot.style.top = (CY + dist * Math.sin(radn)) + 'px';
      dot.style.setProperty('--o', rand(0.5, 0.9).toFixed(2));
      dot.style.setProperty('--dur', rand(2, 5).toFixed(2) + 's');
      dot.style.setProperty('--del', (-rand(0, 4)).toFixed(2) + 's');
      container.appendChild(dot);
    }
  } else if (key === 'diamond-shard') {
    for (let i = 0; i < 4; i++) {
      const sh = document.createElement('div'); sh.className = 'amb-shardbit';
      sh.style.width = '4px'; sh.style.height = '10px';
      sh.style.left = (20 + i * 22) + 'px'; sh.style.top = '-8px';
      sh.style.setProperty('--dx', rand(-8, 8) + 'px');
      sh.style.setProperty('--dur', rand(3, 5).toFixed(2) + 's');
      sh.style.setProperty('--del', (-rand(0, 4)).toFixed(2) + 's');
      container.appendChild(sh);
    }
  } else if (key === 'diamond-prism') {
    for (let i = 0; i < 3; i++) {
      const gem = document.createElement('div');
      Object.assign(gem.style, {
        position: 'absolute', width: '7px', height: '7px',
        clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
        background: 'linear-gradient(135deg,#ff6b6b,#ffd166,#8affc1,#6ec6ff,#b98cff)',
        boxShadow: '0 0 8px 2px rgba(255,255,255,.65)',
        offsetPath: "path('M57 6 C 98 6 98 108 57 108 C 16 108 16 6 57 6 Z')",
        offsetRotate: '0deg',
        animation: `avatarOrbit ${5.5 + i * 0.4}s linear infinite ${-i * 1.8}s, prismHue 3s linear infinite ${-i * 1}s`,
      });
      container.appendChild(gem);
    }
  } else if (key === 'diamond-void') {
    const spark = document.createElement('div');
    Object.assign(spark.style, {
      position: 'absolute', width: '4px', height: '4px', borderRadius: '50%',
      background: '#fff', boxShadow: '0 0 6px 2px rgba(255,255,255,.8)',
      offsetPath: 'circle(53px at 57px 57px)', animation: 'avatarOrbit 6s linear infinite',
    });
    container.appendChild(spark);
  } else if (key === 'diamond-quantum') {
    for (let i = 0; i < 2; i++) {
      const p = document.createElement('div');
      Object.assign(p.style, {
        position: 'absolute', width: '4px', height: '4px', borderRadius: '50%',
        background: '#7dd3fc', boxShadow: '0 0 7px 2px rgba(125,211,252,.9)',
        offsetPath: 'circle(53px at 57px 57px)', animation: `avatarOrbit ${3 + i}s linear infinite ${-i * 1.5}s`,
      });
      container.appendChild(p);
    }
  } else if (key === 'diamond-bloom') {
    [30, 150, 270].forEach((ang, i) => {
      const radn = ang * Math.PI / 180;
      const s = document.createElement('div'); s.className = 'amb-star';
      s.style.width = '9px'; s.style.height = '9px';
      s.style.left = (CX + 48 * Math.cos(radn) - 4.5) + 'px';
      s.style.top = (CY + 48 * Math.sin(radn) - 4.5) + 'px';
      s.style.animationDelay = (-i * 0.6) + 's'; s.style.animationDuration = '2.6s';
      container.appendChild(s);
    });
  } else if (key === 'diamond-rift') {
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('div');
      Object.assign(s.style, {
        position: 'absolute', width: '4px', height: '4px', borderRadius: '50%',
        background: '#93c5fd', boxShadow: '0 0 7px 2px rgba(147,197,253,.9)',
        left: (30 + i * 20) + 'px', bottom: '0px',
        animation: `sparkErupt ${1.4 + Math.random() * 0.6}s cubic-bezier(.2,.8,.3,1) ${-Math.random() * 2}s infinite`,
      });
      container.appendChild(s);
    }
  }
}

function buildComet(container) {
  const path = "path('M -20 90 Q 200 -40 340 260')";
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('div');
    p.className = 'fx-particle';
    const size = 7 - i * 0.7;
    p.style.width = size + 'px'; p.style.height = size + 'px';
    p.style.opacity = Math.max(0.15, 0.95 - i * 0.13);
    p.style.offsetPath = path;
    p.style.animation = `cometMove 4.2s cubic-bezier(.4,0,.6,1) ${-(i * 0.085)}s infinite`;
    container.appendChild(p);
  }
}
function buildBlade(container) {
  const blade = document.createElement('div'); blade.className = 'fx-blade'; container.appendChild(blade);
  const spark = document.createElement('div'); spark.className = 'fx-spark'; spark.style.left = '78%'; spark.style.top = '10%'; container.appendChild(spark);
  for (let i = 0; i < 6; i++) {
    const e = document.createElement('div'); e.className = 'fx-ember';
    e.style.left = (10 + i * 14 + Math.random() * 6) + '%';
    e.style.setProperty('--drift', (Math.random() * 20 - 10) + 'px');
    e.style.animationDuration = (3 + Math.random() * 2).toFixed(2) + 's';
    e.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
    container.appendChild(e);
  }
}
function startSerpent(container) {
  const N = 12; const els = [];
  for (let i = 0; i < N; i++) {
    const d = document.createElement('div');
    d.className = 'fx-gem' + (i === 0 ? ' head' : '');
    const s = 1 - (i / N) * 0.72;
    d.style.width = (22 * s) + 'px'; d.style.height = (22 * s) + 'px';
    d.style.opacity = Math.max(0.35, 0.95 - (i / N) * 0.5);
    container.appendChild(d); els.push(d);
  }
  const history = []; const maxHist = N * 6 + 12; const t0 = performance.now(); let raf;
  function frame(now) {
    const r = container.getBoundingClientRect(); const w = r.width, h = r.height;
    const t = (now - t0) / 1000; const cx = w / 2, cy = h / 2;
    const A = w * 0.32, B = h * 0.26;
    const hx = cx + A * Math.sin(t * 1.05);
    const hy = cy + B * Math.sin(t * 0.6) * Math.cos(t * 0.19);
    history.unshift({ x: hx, y: hy }); if (history.length > maxHist) history.pop();
    for (let i = 0; i < N; i++) {
      const idx = Math.min(i * 6, history.length - 1);
      const p = history[idx] || { x: hx, y: hy };
      const p2 = history[Math.min(idx + 2, history.length - 1)] || p;
      const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
      const half = parseFloat(els[i].style.width) / 2;
      els[i].style.transform = `translate(${p.x - half}px, ${p.y - half}px) rotate(${angle}deg)`;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); els.forEach((e) => e.remove()); };
}

export function buildFx(container, tier, reduceMotion) {
  if (!container) return () => {};
  container.innerHTML = '';
  if (reduceMotion) {
    container.innerHTML = `<div class="fx-static">${TIERS[tier].mark}</div>`;
    return () => {};
  }
  if (tier === 'silver') { buildComet(container); return () => {}; }
  if (tier === 'gold') { buildBlade(container); return () => {}; }
  if (tier === 'diamond') { return startSerpent(container); }
  return () => {};
}

export default function XeeviaBoostCard({ profile = defaultProfile, initialSelection, onSelectionChange }) {
  const [tier, setTier] = useState('silver');
  const [selection, setSelection] = useState(() => ({
    silver: { design: 0, blend: 0, font: 0, color: 0 },
    gold: { design: 0, blend: 0, font: 0, color: 0 },
    diamond: { design: 0, blend: 0, font: 0, color: 0 },
    ...(initialSelection || {}),
  }));

  const cardRef = useRef(null);
  const cardFxRef = useRef(null);
  const cardAmbientRef = useRef(null);
  const avatarFxRef = useRef(null);
  const fxCleanupRef = useRef(() => {});

  const [reduceMotion, setReduceMotion] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(true);

  // Upgrade 1 — bumped every time a design/blend/font/color is picked, so a fresh
  // <div key={flashNonce}> remounts and its tier-specific CSS animation restarts.
  const [flashNonce, setFlashNonce] = useState(0);

  useEffect(() => {
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqHover = window.matchMedia('(hover: hover)');
    setReduceMotion(mqReduce.matches);
    setHoverCapable(mqHover.matches);
    const onReduce = (e) => setReduceMotion(e.matches);
    const onHover = (e) => setHoverCapable(e.matches);
    mqReduce.addEventListener?.('change', onReduce);
    mqHover.addEventListener?.('change', onHover);
    return () => {
      mqReduce.removeEventListener?.('change', onReduce);
      mqHover.removeEventListener?.('change', onHover);
    };
  }, []);

  const T = TIERS[tier];
  const sel = selection[tier];
  const design = T.designs[sel.design];
  const blend = T.blends[sel.blend];
  const font = T.fonts[sel.font];
  const color = T.colors[sel.color];

  const updateSelection = useCallback((patch) => {
    setSelection((prev) => {
      const next = { ...prev, [tier]: { ...prev[tier], ...patch } };
      onSelectionChange?.(tier, next[tier]);
      return next;
    });
    setFlashNonce((n) => n + 1);
  }, [tier, onSelectionChange]);

  // Rebuild ambient card particles + avatar-ring particles whenever the design changes
  useEffect(() => {
    buildAmbient(cardAmbientRef.current, tier, design.id, reduceMotion);
    buildAvatarBorder(avatarFxRef.current, tier, design.id, reduceMotion);
  }, [tier, design.id, reduceMotion]);

  // Rebuild the signature scene (comet / blade / serpent) whenever the tier changes
  const replay = useCallback(() => {
    fxCleanupRef.current?.();
    fxCleanupRef.current = buildFx(cardFxRef.current, tier, reduceMotion);
  }, [tier, reduceMotion]);

  useEffect(() => {
    replay();
    return () => fxCleanupRef.current?.();
  }, [replay]);

  // Idle tilt + pointer-follow highlight (imperative for the same reason as the original — driven by
  // continuous pointer coordinates, not something that should trigger React re-renders every frame)
  const onPointerEnter = useCallback(() => {
    if (!hoverCapable) return;
    cardRef.current?.classList.remove('is-idle');
  }, [hoverCapable]);
  const onPointerLeave = useCallback(() => {
    if (!hoverCapable) return;
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = '';
    if (!reduceMotion) el.classList.add('is-idle');
  }, [hoverCapable, reduceMotion]);
  const onPointerMove = useCallback((e) => {
    if (!hoverCapable) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.style.transform = `rotateY(${(px - 0.5) * 10}deg) rotateX(${(py - 0.5) * -10}deg)`;
  }, [hoverCapable]);

  const tierIndex = TIER_ORDER.indexOf(tier);
  const rootAccentStyle = useMemo(() => ({ '--accent': ACCENT[tier] }), [tier]);

  return (
    <div className="xvb-root" data-active={tier} style={rootAccentStyle}>
      <div className="shell">
        <header className="top">
          <div className="wordmark">
            <span className="dot" />
            <div><span>Xeevia</span><small>Boost · Next Generation</small></div>
          </div>
          <p>16 fully layered designs across three tiers — each with its own real animated scene, not gradient tricks.</p>
        </header>

        <div className="tabs">
          <div
            className="indicator"
            style={{ transform: `translateX(${tierIndex * 100}%)` }}
          />
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              className={t === tier ? 'active' : ''}
              onClick={() => setTier(t)}
            >
              {TIERS[t].mark} {TIERS[t].label}
            </button>
          ))}
        </div>

        <p className="hint">
          <b>Tab</b> fixes the scene (comet / blade / serpent) — unchanged.<br />
          <b>Background design</b> changes the card's gradient + texture, and each one carries its own layered, real
          animated scene.<br />
          <b>Color blend</b> tints whichever design is active.
        </p>

        <main className="grid">
          <div className="stage">
            <div className="tier-heading">
              <h1>{T.label}</h1>
              <div className="meta">{TIER_META[tier].meta}</div>
              <div className="fine">{T.fine}</div>
            </div>

            <div className="card-stage">
              <div
                ref={cardRef}
                className="card is-idle"
                data-tier={tier}
                data-design={design.id}
                style={{ '--hue': blend.hue + 'deg' }}
                onClick={replay}
                onPointerEnter={onPointerEnter}
                onPointerLeave={onPointerLeave}
                onPointerMove={onPointerMove}
              >
                <div className="card-material">
                  <div className="card-base" />
                  <div className="card-texture" />
                  <div className="card-ambient" ref={cardAmbientRef} />
                  <div className="card-light" />
                </div>
                <div className="card-fx" ref={cardFxRef} />
                <div className="card-scrim" />
                <div className="card-frame" />
                {flashNonce > 0 && <div key={flashNonce} className="equip-flash" />}
                <div className="card-content">
                  <div className="avatar-wrap">
                    <div className="avatar-glow" />
                    <div className="avatar-ring" />
                    <div className="avatar-fx" ref={avatarFxRef} />
                    <div className="avatar-core">
                      <div className="avatar">{profile.initials}</div>
                      <div className="tier-mark">{T.mark}</div>
                    </div>
                  </div>
                  <div className="text-block">
                    <div
                      className="p-name"
                      style={{
                        fontFamily: font.family,
                        color: color.color,
                        textShadow: `0 1px 2px rgba(0,0,0,.95), 0 3px 10px rgba(0,0,0,.6), 0 0 16px ${color.color}99`,
                        WebkitTextStroke: '0.35px rgba(0,0,0,.4)',
                      }}
                    >
                      {profile.name}
                    </div>
                    <div className="p-badges">
                      <span>PRO</span>
                      <span>{T.label}</span>
                      <span>✓ Paid Member</span>
                    </div>
                    <div className="p-handle">{profile.handle}</div>
                  </div>
                  <div className="stats">
                    {profile.stats.map((s) => (
                      <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-controls">
              <div className="now-tag">Now: <b>{design.name} · {blend.name}</b></div>
              <button className="replay-btn" onClick={replay}>↻ Replay scene</button>
            </div>
          </div>

          <div className="options">
            <div className="panel-block">
              <h2>Background design <em>— {T.designs.length} unlocked</em></h2>
              <div className="design-grid">
                {T.designs.map((d, i) => (
                  <button
                    key={d.id}
                    className={'design-card' + (i === sel.design ? ' active' : '')}
                    onClick={() => updateSelection({ design: i })}
                  >
                    <div className="design-preview" style={{ background: d.bg }} />
                    <div className="design-txt"><b>{d.name}</b><span>{d.tag}</span></div>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-block">
              <h2>Color blend <em>— {T.blends.length} unlocked</em></h2>
              <div className="theme-grid">
                {T.blends.map((b, i) => (
                  <button
                    key={b.id}
                    className={'theme-card' + (i === sel.blend ? ' active' : '')}
                    onClick={() => updateSelection({ blend: i })}
                  >
                    <div
                      className="theme-swatch"
                      style={{
                        background: `linear-gradient(135deg, var(--${tier[0]}-2), var(--${tier[0]}-3))`,
                        filter: `hue-rotate(${b.hue}deg)`,
                      }}
                    />
                    <b>{b.name}</b>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-block">
              <h2>Name font <em>— {T.fonts.length} unlocked</em></h2>
              <div className="font-grid">
                {T.fonts.map((f, i) => (
                  <button
                    key={f.id}
                    className={'font-btn' + (i === sel.font ? ' active' : '')}
                    style={{ fontFamily: f.family }}
                    onClick={() => updateSelection({ font: i })}
                  >
                    Sprouts<small>{f.label}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-block">
              <h2>Name color <em>— {T.colors.length} unlocked</em></h2>
              <div className="color-row">
                {T.colors.map((c, i) => (
                  <button
                    key={c.id}
                    className={'color-dot' + (i === sel.color ? ' active' : '')}
                    style={{ background: c.color }}
                    title={c.label}
                    onClick={() => updateSelection({ color: i })}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{SHOWCASE_STYLES}</style>
    </div>
  );
}