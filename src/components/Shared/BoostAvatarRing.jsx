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

import React, { useState } from "react";

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
};

function getVisual(tier, themeId) {
  if (!tier || !TIER_RING[tier]) return null;
  const base = TIER_RING[tier];
  if (tier === "diamond" && themeId && DIAMOND_THEME[themeId]) {
    return { ...base, ...DIAMOND_THEME[themeId] };
  }
  return base;
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
function SilverRing({ size }) {
  const r    = size / 2 + 3;
  const cx   = r;
  const cy   = r;
  const circ = 2 * Math.PI * (r - 2.5);
  const dash = circ / 18;

  return (
    <svg
      width={r * 2} height={r * 2}
      style={{ position:"absolute", inset: -(r - size/2), pointerEvents:"none", overflow:"visible" }}
    >
      <defs>
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
function GoldRing({ size }) {
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
      style={{ position:"absolute", inset: -(orb - size/2), pointerEvents:"none", overflow:"visible" }}
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
function DiamondRing({ size, visual }) {
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
      style={{ position:"absolute", inset: -(r - size/2), pointerEvents:"none", overflow:"visible" }}
    >
      <defs>
        {/* Primary spectrum gradient */}
        <linearGradient id="dg0" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse"
          x1="0" y1="0" x2={total} y2={total}>
          <stop offset="0%"    stopColor="#ff6b6b" />
          <stop offset="16.6%" stopColor="#ffd93d" />
          <stop offset="33.3%" stopColor="#6bcb77" />
          <stop offset="50%"   stopColor="#4d96ff" />
          <stop offset="66.6%" stopColor={c1}      />
          <stop offset="83.3%" stopColor="#ff6fd8" />
          <stop offset="100%"  stopColor="#ff6b6b" />
        </linearGradient>
        {/* Secondary — theme-tinted arc */}
        <linearGradient id="dg1" x1="100%" y1="0%" x2="0%" y2="100%" gradientUnits="userSpaceOnUse"
          x1="0" y1="0" x2={total} y2={total}>
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
  onClick,
  style,
  borderRadius = "circle",
}) => {
  injectKeyframes();

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);

  const visual = getVisual(tier, themeId);
  const br     = borderRadius === "circle" ? "50%" : "28%";

  const badgeW  = badgeSize === "md" ? 22 : 16;
  const badgeFs = badgeSize === "md" ? 11 : 8;

  const isValidImg =
    src &&
    typeof src === "string" &&
    !imgError &&
    (src.startsWith("http") || src.startsWith("blob:"));

  const fallbackGrad = visual
    ? `linear-gradient(135deg,${visual.grad[0]},${visual.grad[1]})`
    : "linear-gradient(135deg,#334155,#1e293b)";

  return (
    <div
      onClick={onClick}
      style={{
        position:   "relative",
        flexShrink: 0,
        width:      size,
        height:     size,
        borderRadius: br,
        cursor:     onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {/* Avatar circle — clips image/letter */}
      <div
        style={{
          width:        "100%",
          height:       "100%",
          borderRadius: br,
          overflow:     "hidden",
          position:     "relative",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          background:   fallbackGrad,
        }}
      >
        {/* Letter fallback */}
        <span
          style={{
            position:   "absolute",
            fontSize:   Math.round(size * 0.42),
            fontWeight: 900,
            color:      visual ? "#000" : "rgba(255,255,255,0.9)",
            userSelect: "none",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {(letter || "U").charAt(0).toUpperCase()}
        </span>

        {/* Avatar image */}
        {isValidImg && (
          <img
            src={src}
            alt=""
            crossOrigin="anonymous"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              position:   "absolute",
              inset:      0,
              width:      "100%",
              height:     "100%",
              objectFit:  "cover",
              opacity:    imgLoaded ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          />
        )}
      </div>

      {/* SVG ring overlay — rendered outside the clipping div */}
      {visual && tier === "silver"  && <SilverRing  size={size} />}
      {visual && tier === "gold"    && <GoldRing    size={size} />}
      {visual && tier === "diamond" && <DiamondRing size={size} visual={visual} />}

      {/* Badge pip */}
      {showBadge && visual && (
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