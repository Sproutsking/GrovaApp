// src/components/Shared/BoostAvatarRing.jsx
// ============================================================================
// PURE DISPLAY — zero data fetching. All tier data comes from props.
// Tier rings are SVG overlays, not box-shadows — they render perfectly at any
// size, never get clipped, and are GPU-composited via CSS transform only.
//
// SILVER  — rotating precision-dashed stroke: crisp, mechanical, exact
// GOLD    — three molten particles orbiting in offset ellipses: alive
// DIAMOND — prismatic conic arc that walks through the full spectrum: gem-light
// ============================================================================

import React, { useEffect, useState } from "react";

// ── Tier visual definitions ───────────────────────────────────────────────

const TIER_RING = {
  silver: {
    grad:       ["#e2e8f0", "#94a3b8"],
    glow:       "rgba(148,163,184,0.55)",
    badge:      "🪙",
    badgeLabel: "Silver",
    color:      "#d4d4d4",
  },
  gold: {
    grad:       ["#fde68a", "#f59e0b"],
    glow:       "rgba(245,158,11,0.65)",
    badge:      "✦",
    badgeLabel: "Gold",
    color:      "#fbbf24",
  },
  diamond: {
    // themeId overrides handled in getVisual()
    grad:       ["#c4b5fd", "#818cf8"],
    glow:       "rgba(167,139,250,0.70)",
    badge:      "◆",
    badgeLabel: "Diamond",
    color:      "#a78bfa",
  },
};

const DIAMOND_THEME = {
  "diamond-cosmos":  { grad: ["#c4b5fd","#818cf8"], glow: "rgba(167,139,250,0.70)", color: "#a78bfa" },
  "diamond-glacier": { grad: ["#93c5fd","#3b82f6"], glow: "rgba(59,130,246,0.70)",  color: "#60a5fa" },
  "diamond-emerald": { grad: ["#6ee7b7","#10b981"], glow: "rgba(16,185,129,0.70)",  color: "#34d399" },
  "diamond-rose":    { grad: ["#fbcfe8","#ec4899"], glow: "rgba(236,72,153,0.70)",  color: "#f472b6" },
  "diamond-void":    { grad: ["#f1f5f9","#94a3b8"], glow: "rgba(148,163,184,0.70)", color: "#e5e5e5" },
  "diamond-inferno": { grad: ["#fed7aa","#f97316"], glow: "rgba(249,115,22,0.70)",  color: "#ff6b35" },
  "diamond-aurora":  { grad: ["#a5f3fc","#06b6d4"], glow: "rgba(6,182,212,0.70)",   color: "#22d3ee" },
  "diamond-brilliant": { grad: ["#eaf6ff","#7dd3fc"], glow: "rgba(125,211,252,0.70)", color: "#b8d2e6" },
  "diamond-nebula":   { grad: ["#ddd6fe","#8b5cf6"], glow: "rgba(139,92,246,0.70)",  color: "#c7b6fa" },
  "diamond-shard":   { grad: ["#bfe4ff","#38bdf8"], glow: "rgba(56,189,248,0.70)",  color: "#78dcff" },
  "diamond-prism":   { grad: ["#f0abfc","#60a5fa"], glow: "rgba(192,132,252,0.70)", color: "#d8d8f5" },
  "diamond-quantum": { grad: ["#bae6fd","#06b6d4"], glow: "rgba(34,211,238,0.70)",  color: "#7dd3fc" },
  "diamond-bloom":   { grad: ["#f0abfc","#c084fc"], glow: "rgba(240,171,252,0.70)", color: "#f0abfc" },
  "diamond-rift":    { grad: ["#c4b5fd","#6366f1"], glow: "rgba(129,140,248,0.70)", color: "#818cf8" },
};

const SHOWCASE_RING = {
  "silver-chrome": { background: "conic-gradient(from 0deg,#3a4048,#eef1f4 22%,#7a828c 45%,#f7f9fa 68%,#4a5058 88%,#3a4048)", animation: "_bar-spin 9s linear infinite" },
  "silver-mercury": { background: "conic-gradient(from 90deg,#c7ced4,#f7f9fa 18%,#8a95a0 40%,#eef1f4 58%,#5b636b 78%,#c7ced4)", animation: "_bar-spin 5.5s ease-in-out infinite alternate, _pulse-glow 3s ease-in-out infinite" },
  "silver-eclipse": { background: "conic-gradient(from 0deg,#eef1f4,#c7ced4 8%,#3a4048 14%,#14171a 50%,#3a4048 86%,#c7ced4 92%,#eef1f4 100%)", animation: "_bar-spin 10s linear infinite" },
  "gold-dynasty": { background: "repeating-conic-gradient(from 0deg,#f4dfa8 0deg 7deg,#c9932f 7deg 14deg,#8a5f16 14deg 17deg,#c9932f 17deg 20deg)", animation: "_bar-spin 15s linear infinite" },
  "gold-solar": { background: "conic-gradient(from 180deg,#fbbf24,#dc2626 30%,#f97316 55%,#fde68a 80%,#dc2626 100%)", animation: "_bar-spin-rev 7s linear infinite, _pulse-glow 2.6s ease-in-out infinite" },
  "gold-corona": { background: "repeating-conic-gradient(from 0deg,rgba(251,191,36,.95) 0deg 2deg,transparent 2deg 14deg)", mask: "radial-gradient(circle, transparent 58%, #000 63%, #000 100%)", animation: "_bar-spin 10s linear infinite" },
  "gold-laurel": { background: "repeating-conic-gradient(from 0deg,#fde68a 0deg 5deg,#c9932f 5deg 9deg,#7a4e12 9deg 10deg,#c9932f 10deg 12deg)", animation: "_bar-spin 18s linear infinite" },
  "gold-molten": { background: "conic-gradient(from 20deg,#ffcf70,#7a2e04 18%,#ff9a44 37%,#321004 55%,#ffb84d 76%,#7a2e04 100%)", animation: "_bar-spin 6s linear infinite, _pulse-glow 2.2s ease-in-out infinite" },
  "diamond-brilliant": { background: "conic-gradient(from 0deg,#ffffff,#b8d2e6 18%,#4f7894 36%,#ffffff 50%,#78dcff 68%,#dff6ff 84%,#ffffff)", animation: "_prism 7s linear infinite" },
  "diamond-nebula": { background: "conic-gradient(from 40deg,#f0abfc,#7c3aed 22%,#312e81 43%,#60a5fa 64%,#f0abfc 82%,#7c3aed)", animation: "_prism2 8s linear infinite" },
  "diamond-shard": { background: "conic-gradient(from 20deg,#e0f2fe,#38bdf8 20%,#0e7490 42%,#a7f3d0 62%,#78dcff 82%,#e0f2fe)", animation: "_prism 9s linear infinite" },
  "diamond-prism": { background: "conic-gradient(from 0deg,#f0abfc,#60a5fa 20%,#86efac 40%,#fde68a 60%,#fda4af 80%,#f0abfc)", animation: "_prism 6s linear infinite" },
  "diamond-void": { background: "conic-gradient(from 0deg,#ffffff,#1e293b 18%,#94a3b8 34%,#020617 52%,#a78bfa 72%,#ffffff)", animation: "_prism2 11s linear infinite" },
  "diamond-quantum": { background: "repeating-conic-gradient(from 0deg,#7dd3fc 0deg 8deg,#0e7490 8deg 14deg,#c4b5fd 14deg 18deg,#7dd3fc 18deg 24deg)", animation: "_prism 8s linear infinite" },
  "diamond-bloom": { background: "conic-gradient(from 0deg,#f0abfc,#c084fc 22%,#f9a8d4 42%,#ffffff 52%,#c4b5fd 75%,#f0abfc)", animation: "_prism2 10s linear infinite" },
  "diamond-rift": { background: "conic-gradient(from 15deg,#c4b5fd,#6366f1 24%,#172554 46%,#38bdf8 68%,#818cf8 86%,#c4b5fd)", animation: "_prism 8.5s linear infinite" },
};

function getShowcaseRing(tier, themeId) {
  const key = themeId || { silver: "silver-chrome", gold: "gold-dynasty", diamond: "diamond-brilliant" }[tier];
  return SHOWCASE_RING[key] || (tier === "diamond"
    ? { background: `conic-gradient(from 0deg,${getVisual(tier, themeId)?.grad?.[0] || "#c4b5fd"},#fff,${getVisual(tier, themeId)?.grad?.[1] || "#818cf8"},${getVisual(tier, themeId)?.grad?.[0] || "#c4b5fd"})`, animation: "_prism 8s linear infinite" }
    : null);
}

function getVisual(tier, themeId) {
  if (!tier || !TIER_RING[tier]) return null;
  const base = TIER_RING[tier];
  if (tier === "diamond" && themeId && DIAMOND_THEME[themeId]) {
    return { ...base, ...DIAMOND_THEME[themeId] };
  }
  return base;
}

function StaticTierRing({ shellSize, visual }) {
  // The ring's inner edge meets the photo edge; the stroke expands outward.
  const radius = shellSize / 2 + 1;
  return (
    <svg width={radius * 2} height={radius * 2} style={{ position: "absolute", left: shellSize / 2 - radius, top: shellSize / 2 - radius, pointerEvents: "none", overflow: "visible" }}>
      <circle cx={radius} cy={radius} r={radius} fill="none" stroke={visual.grad[0]} strokeWidth="2" />
      <circle cx={radius} cy={radius} r={radius + 2.5} fill="none" stroke={visual.grad[1]} strokeWidth="0.75" strokeOpacity=".72" />
    </svg>
  );
}

// ── Keyframes (injected once via <style>) ─────────────────────────────────

const KEYFRAMES = `
@keyframes _bar-spin { to { transform: rotate(360deg); } }
@keyframes _bar-spin-rev { to { transform: rotate(-360deg); } }
@keyframes _orb0 {
  0%   { transform: translate(0px, 0px) scale(1);    opacity:1; }
  25%  { transform: translate(5px,-4px) scale(1.25); opacity:.9; }
  50%  { transform: translate(0px,-6px) scale(.85);  opacity:.7; }
  75%  { transform: translate(-5px,-2px) scale(1.1); opacity:.9; }
  100% { transform: translate(0px, 0px) scale(1);    opacity:1; }
}
@keyframes _orb1 {
  0%   { transform: translate(0px, 0px) scale(1);    opacity:.8; }
  33%  { transform: translate(-4px, 4px) scale(1.2); opacity:1; }
  66%  { transform: translate(4px,  2px) scale(.8);  opacity:.6; }
  100% { transform: translate(0px, 0px) scale(1);    opacity:.8; }
}
@keyframes _orb2 {
  0%   { transform: translate(0px, 0px) scale(.9);   opacity:.7; }
  40%  { transform: translate(3px, -5px) scale(1.3); opacity:1; }
  80%  { transform: translate(-3px,3px) scale(.75);  opacity:.65; }
  100% { transform: translate(0px, 0px) scale(.9);   opacity:.7; }
}
@keyframes _prism {
  0%   { transform: rotate(0deg);   }
  100% { transform: rotate(360deg); }
}
@keyframes _prism2 {
  0%   { transform: rotate(0deg);   opacity:.7; }
  50%  { opacity:1; }
  100% { transform: rotate(-360deg); opacity:.7; }
}
@keyframes _pulse-glow {
  0%,100% { opacity:.55; }
  50%      { opacity:.9;  }
}
`;

let _injected = false;
function injectKeyframes() {
  if (_injected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
  _injected = true;
}

// ── Ring renderers ────────────────────────────────────────────────────────

// SILVER — rotating precision dashes (two counter-rotating layers)
function SilverRing({ size, bleed = 0 }) {
  const r    = size / 2 + 3;
  const cx   = r;
  const cy   = r;
  const circ = 2 * Math.PI * (r - 2.5);
  const dash = circ / 18;

  return (
    <svg
      width={r * 2} height={r * 2}
      style={{ position:"absolute", left: bleed - (r - size/2), top: bleed - (r - size/2), pointerEvents:"none", overflow:"visible" }}
    >
      <defs>
              loading="eager"
              fetchPriority="high"
              decoding="async"
        <linearGradient id="sg0" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="sg1" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#cbd5e1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#475569" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Outer glow pulse */}
      <circle
        cx={cx} cy={cy} r={r - 1}
        fill="none" stroke="rgba(203,213,225,0.25)" strokeWidth={6}
        style={{ animation: "_pulse-glow 2.8s ease-in-out infinite" }}
      />

      {/* Layer 1 — rotating dashes */}
      <circle
        cx={cx} cy={cy} r={r - 2.5}
        fill="none"
        stroke="url(#sg0)"
        strokeWidth={1.75}
        strokeDasharray={`${dash * 0.55} ${dash * 0.45}`}
        strokeLinecap="round"
        style={{ animation: "_bar-spin 5s linear infinite", transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Layer 2 — counter-rotating finer dashes */}
      <circle
        cx={cx} cy={cy} r={r - 2.5}
        fill="none"
        stroke="url(#sg1)"
        strokeWidth={1.25}
        strokeDasharray={`${dash * 0.2} ${dash * 0.8}`}
        strokeLinecap="round"
        style={{ animation: "_bar-spin-rev 8s linear infinite", transformOrigin: `${cx}px ${cy}px` }}
      />
    </svg>
  );
}

// GOLD — three molten particles in staggered elliptical orbit paths
function GoldRing({ size, bleed = 0 }) {
  const orb   = size / 2 + 4;
  const total = orb * 2;
  const cx    = orb;
  const cy    = orb;
  const rx    = orb - 2;
  const ry    = orb * 0.52;

  // Pre-compute 3 orbit positions (120° apart) as circle points on an ellipse
  // We use CSS animation to move each along its path layer
  const orbs = [
    { dur: "3.2s", delay: "0s",    r: size * 0.09, anim: "_orb0", color: "#fde68a", blur: 0   },
    { dur: "4.1s", delay: "-1.4s", r: size * 0.07, anim: "_orb1", color: "#f59e0b", blur: 1   },
    { dur: "2.7s", delay: "-0.7s", r: size * 0.06, anim: "_orb2", color: "#fbbf24", blur: 0   },
  ];

  const baseTrailOpacity = 0.18;

  return (
    <svg
      width={total} height={total}
      style={{ position:"absolute", left: bleed - (orb - size/2), top: bleed - (orb - size/2), pointerEvents:"none", overflow:"visible" }}
    >
      <defs>
        <linearGradient id="gg0" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="gf0" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Orbit track — faint ellipse guide */}
      <ellipse
        cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none"
        stroke="rgba(251,191,36,0.13)"
        strokeWidth={1}
        transform={`rotate(-20 ${cx} ${cy})`}
      />
      <ellipse
        cx={cx} cy={cy} rx={rx * 0.78} ry={ry * 0.9}
        fill="none"
        stroke="rgba(253,230,138,0.08)"
        strokeWidth={0.75}
        transform={`rotate(40 ${cx} ${cy})`}
      />

      {/* Static glow halo */}
      <circle
        cx={cx} cy={cy} r={orb - 1}
        fill="none"
        stroke="rgba(251,191,36,0.18)"
        strokeWidth={5}
        style={{ animation: "_pulse-glow 3.5s ease-in-out infinite" }}
      />

      {/* Orbiting particles */}
      {orbs.map((o, i) => {
        // Place each orb at a point on the ellipse, animated via keyframes
        const angle = (i / 3) * Math.PI * 2;
        const ox = cx + Math.cos(angle) * rx;
        const oy = cy + Math.sin(angle) * ry * 0.9;
        return (
          <g
            key={i}
            style={{
              transformOrigin: `${ox}px ${oy}px`,
              animation: `${o.anim} ${o.dur} ${o.delay} ease-in-out infinite`,
            }}
          >
            {/* Soft glow beneath */}
            <circle
              cx={ox} cy={oy} r={o.r * 2.2}
              fill={o.color}
              opacity={0.22}
              filter="url(#gf0)"
            />
            {/* Main particle */}
            <circle cx={ox} cy={oy} r={o.r} fill={o.color} opacity={0.92} />
            {/* Specular highlight */}
            <circle cx={ox - o.r*0.3} cy={oy - o.r*0.35} r={o.r * 0.38} fill="#fff" opacity={0.55} />
          </g>
        );
      })}
    </svg>
  );
}

// DIAMOND — prismatic conic arc that walks through spectrum, two counter-rotating layers
function DiamondRing({ size, visual, bleed = 0 }) {
  const r     = size / 2 + 4;
  const total = r * 2;
  const cx    = r;
  const cy    = r;
  const rc    = r - 2.2;

  // We create the prism effect via stacked arcs with different spectrum stops
  // and animate each at different speeds/directions
  const c1 = visual.grad[0];
  const c2 = visual.grad[1];

  return (
    <svg
      width={total} height={total}
      style={{ position:"absolute", left: bleed - (r - size/2), top: bleed - (r - size/2), pointerEvents:"none", overflow:"visible" }}
    >
      <defs>
        {/* Primary spectrum gradient */}
        <linearGradient id="dg0" x1="0" y1="0" x2={total} y2={total} gradientUnits="userSpaceOnUse">
          <stop offset="0%"    stopColor="#ff6b6b" />
          <stop offset="16.6%" stopColor="#ffd93d" />
          <stop offset="33.3%" stopColor="#6bcb77" />
          <stop offset="50%"   stopColor="#4d96ff" />
          <stop offset="66.6%" stopColor={c1}      />
          <stop offset="83.3%" stopColor="#ff6fd8" />
          <stop offset="100%"  stopColor="#ff6b6b" />
        </linearGradient>
        {/* Secondary — theme-tinted arc */}
        <linearGradient id="dg1" x1={total} y1="0" x2="0" y2={total} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={c2}   stopOpacity="0.9" />
          <stop offset="50%"  stopColor={c1}   stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.8" />
        </linearGradient>
        {/* Glow filter */}
        <filter id="df0" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Outer glow */}
      <circle
        cx={cx} cy={cy} r={rc + 1}
        fill="none"
        stroke={visual.glow}
        strokeWidth={7}
        style={{ animation: "_pulse-glow 2.2s ease-in-out infinite" }}
      />

      {/* Layer 1: full prismatic ring rotating */}
      <g style={{ animation: "_prism 6s linear infinite", transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx} cy={cy} r={rc}
          fill="none"
          stroke="url(#dg0)"
          strokeWidth={2.5}
          strokeLinecap="round"
          filter="url(#df0)"
        />
      </g>

      {/* Layer 2: theme-tinted arc, counter-rotating, partial opacity */}
      <g style={{ animation: "_prism2 9s linear infinite", transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx} cy={cy} r={rc}
          fill="none"
          stroke="url(#dg1)"
          strokeWidth={1.5}
          strokeDasharray={`${rc * 1.2} ${rc * 4.8}`}
          strokeLinecap="round"
          opacity={0.75}
        />
      </g>

      {/* Specular flare — tiny bright spot that feels like light hitting a facet */}
      <g style={{ animation: "_prism 6s linear infinite", transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx} cy={cy - rc}
          r={2.2}
          fill="#fff"
          opacity={0.9}
        />
      </g>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────

const BoostAvatarRing = ({
  tier,
  themeId,
  size        = 42,
  src,
  letter      = "U",
  showBadge   = true,
  badgeSize   = "sm",
  imageBleed  = 0,
  onClick,
  style,
  borderRadius = "circle",
  accentColor,
}) => {
  injectKeyframes();

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const visual = getVisual(tier, themeId);
  const showcaseRing = getShowcaseRing(tier, themeId);
  const isBoostedProfile = !!visual;
  const normalizedRadius = typeof borderRadius === "string" ? borderRadius.toLowerCase() : "";
  const br = normalizedRadius === "circle" || normalizedRadius === "rounded" || normalizedRadius === "round" ? "50%" : "28%";
  const avatarShellSize = isBoostedProfile ? size + 6 : size + 4;
  const showBadgeBg = showBadge && visual;

  const badgeW  = badgeSize === "md" ? 22 : 16;
  const badgeFs = badgeSize === "md" ? 11 : 8;

  const showTierBadge = false;

  const isValidImg =
    src &&
    typeof src === "string" &&
    (src.startsWith("http") || src.startsWith("blob:"));

  const shouldRenderImage = isValidImg && !imgError;
  const effectiveImageBleed = Math.max(1, imageBleed);

  const fallbackGrad = visual
    ? `linear-gradient(135deg,${visual.grad[0]},${visual.grad[1]})`
    : "linear-gradient(135deg,#334155,#1e293b)";

  return (
    <div
      onClick={onClick}
      style={{
        position:   "relative",
        flexShrink: 0,
        width:      avatarShellSize,
        height:     avatarShellSize,
        borderRadius: br,
        cursor:     onClick ? "pointer" : "default",
        margin:     0,
        padding:    0,
        display:    "inline-flex",
        ...style,
      }}
    >
      {/* Avatar circle — clips image/letter */}
      <div
        style={{
          position:     "absolute",
          inset:        0,
          borderRadius: br,
          overflow:     "hidden",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          background:   fallbackGrad,
          zIndex:        1,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: br,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: fallbackGrad,
          }}
        >
          {shouldRenderImage && (
            <img
              key={src || `${size}-${letter}`}
              src={src}
              alt=""
              crossOrigin="anonymous"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setImgError(true)}
              style={{
                position:       "absolute",
                inset:          -effectiveImageBleed,
                width:          `calc(100% + ${effectiveImageBleed * 2}px)`,
                height:         `calc(100% + ${effectiveImageBleed * 2}px)`,
                objectFit:      "cover",
                objectPosition: "center",
                opacity:        1,
                filter:         "saturate(1.08) contrast(1.04)",
                zIndex:         2,
              }}
            />
          )}

          {!shouldRenderImage ? (
            <span
              style={{
                position:   "absolute",
                inset:      0,
                display:    "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize:   Math.round(size * 0.42),
                fontWeight: 900,
                color:      visual ? "#000" : "rgba(255,255,255,0.9)",
                userSelect: "none",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                zIndex:     3,
              }}
            >
              {(letter || "U").charAt(0).toUpperCase()}
            </span>
          ) : null}
        </div>
      </div>

      {/* The ring uses the original showcase design selected by tier + theme. */}
      {visual && showcaseRing && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -2,
            zIndex: 2,
            pointerEvents: "none",
            borderRadius: "50%",
            background: showcaseRing.background,
            WebkitMask: showcaseRing.mask || "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px))",
            mask: showcaseRing.mask || "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px))",
            animation: showcaseRing.animation,
            boxShadow: `0 0 10px ${visual.glow}`,
          }}
        />
      )}

      {/* Tier badge pip — only for boost status, never used as the verification badge */}
      {showTierBadge && (
        <div
          style={{
            position:       "absolute",
            bottom:         -2,
            right:          -2,
            width:          badgeW,
            height:         badgeW,
            borderRadius:   "50%",
            background:     `linear-gradient(135deg,${visual.grad[0]},${visual.grad[1]})`,
            border:         "2px solid #060606",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       badgeFs,
            zIndex:         3,
            boxShadow:      `0 2px 8px ${visual.glow}`,
            lineHeight:     1,
          }}
        >
          {visual.badge}
        </div>
      )}
    </div>
  );
};

export default BoostAvatarRing;

// ── TierIndicator pill ────────────────────────────────────────────────────

export { getVisual as getBoostVisualForRing };

export const TierIndicator = ({ tier, themeId, size = 14 }) => {
  const v = getVisual(tier, themeId);
  if (!v) return null;
  return (
    <span
      title={`${v.badgeLabel} Boost`}
      style={{
        display:     "inline-flex",
        alignItems:  "center",
        gap:         3,
        padding:     "1px 5px",
        borderRadius: 10,
        fontSize:    size - 2,
        fontWeight:  800,
        color:       v.color,
        background:  `${v.color}18`,
        border:      `1px solid ${v.color}35`,
        boxShadow:   `0 0 6px ${v.glow}`,
        flexShrink:  0,
        lineHeight:  1,
      }}
    >
      <span style={{ fontSize: size }}>{v.badge}</span>
    </span>
  );
};