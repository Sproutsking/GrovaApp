// components/Community/utils/communityVisuals.js
// One source of truth for the "community image" visual language: the
// gradient presets a user can pick when they don't upload a photo, plus a
// single <CommunityAvatar/> renderer that gives every gradient/emoji icon in
// the app (create modal preview, sidebar rail, wherever else it's dropped
// in) the same premium treatment: mesh/aurora/pixel textures, a glass
// sheen, an inner highlight ring, and a glow tuned to the gradient's own
// color — instead of a flat CSS gradient square.
//
// Drop <CommunityAvatar gradientId="mesh-nebula" icon="🚀" size={48} /> in
// anywhere a community's image needs to render.

import React from "react";

export const CATEGORY_ORDER = ["Aurora", "Mesh", "Cosmic", "Sunset", "Pixel", "Glass"];

export const CATEGORY_BLURB = {
  Aurora: "Sweeping, living color",
  Mesh: "Soft multi-tone blend",
  Cosmic: "Deep space + starlight",
  Sunset: "Warm horizon tones",
  Pixel: "Retro arcade texture",
  Glass: "Quiet, frosted neutral",
};

export const PREMIUM_GRADIENTS = [
  // ── Aurora — animated, sweeping ─────────────────────────────
  {
    id: "aurora-veil",
    label: "Veil",
    category: "Aurora",
    glow: "#22d3ee",
    animated: true,
    css: "linear-gradient(135deg, #0ea5e9 0%, #22d3ee 35%, #9cff00 70%, #667eea 100%)",
  },
  {
    id: "aurora-ember",
    label: "Ember",
    category: "Aurora",
    glow: "#ee0979",
    animated: true,
    css: "linear-gradient(135deg, #ff6a00 0%, #ee0979 45%, #764ba2 100%)",
  },
  {
    id: "aurora-glacier",
    label: "Glacier",
    category: "Aurora",
    glow: "#4facfe",
    animated: true,
    css: "linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #a78bfa 100%)",
  },

  // ── Mesh — soft multi-radial blend ──────────────────────────
  {
    id: "mesh-nebula",
    label: "Nebula",
    category: "Mesh",
    glow: "#9cff00",
    css: "radial-gradient(at 20% 20%, rgba(156,255,0,.55), transparent 55%), radial-gradient(at 80% 25%, rgba(102,126,234,.6), transparent 55%), radial-gradient(at 50% 90%, rgba(240,147,251,.45), transparent 55%), linear-gradient(135deg, #1b1030 0%, #2a1a4a 100%)",
  },
  {
    id: "mesh-coral",
    label: "Coral",
    category: "Mesh",
    glow: "#fb7185",
    css: "radial-gradient(at 15% 25%, rgba(251,113,133,.6), transparent 55%), radial-gradient(at 85% 20%, rgba(251,191,36,.55), transparent 55%), radial-gradient(at 50% 90%, rgba(167,139,250,.4), transparent 55%), linear-gradient(135deg, #2a1220 0%, #3a1c1c 100%)",
  },
  {
    id: "mesh-ocean",
    label: "Ocean",
    category: "Mesh",
    glow: "#22d3ee",
    css: "radial-gradient(at 20% 20%, rgba(34,211,238,.55), transparent 55%), radial-gradient(at 80% 30%, rgba(59,130,246,.55), transparent 55%), radial-gradient(at 50% 90%, rgba(20,184,166,.45), transparent 55%), linear-gradient(135deg, #071a2e 0%, #0b2942 100%)",
  },

  // ── Cosmic — deep space, starfield ──────────────────────────
  {
    id: "cosmic-void",
    label: "Void",
    category: "Cosmic",
    glow: "#a78bfa",
    animated: true,
    css: "radial-gradient(circle at 30% 20%, rgba(255,255,255,.9) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.7) 0 1px, transparent 1px), radial-gradient(circle at 45% 82%, rgba(255,255,255,.6) 0 1px, transparent 1px), linear-gradient(160deg, #0f0f1a 0%, #1b1035 60%, #3b0764 100%)",
    backgroundSize: "60px 60px, 80px 80px, 70px 70px, 100% 100%",
  },
  {
    id: "cosmic-nova",
    label: "Nova",
    category: "Cosmic",
    glow: "#ec4899",
    css: "radial-gradient(at 60% 30%, rgba(236,72,153,.5), transparent 50%), linear-gradient(150deg, #1e0a3c 0%, #5b21b6 50%, #ec4899 100%)",
  },

  // ── Sunset — warm horizon ────────────────────────────────────
  {
    id: "sunset-bloom",
    label: "Bloom",
    category: "Sunset",
    glow: "#fee140",
    css: "linear-gradient(160deg, #fa709a 0%, #fee140 100%)",
  },
  {
    id: "sunset-dune",
    label: "Dune",
    category: "Sunset",
    glow: "#f97316",
    css: "linear-gradient(160deg, #f97316 0%, #dc2626 50%, #7c3aed 100%)",
  },

  // ── Pixel — retro arcade texture ────────────────────────────
  {
    id: "pixel-arcade",
    label: "Arcade",
    category: "Pixel",
    glow: "#9cff00",
    css: "repeating-linear-gradient(45deg, rgba(255,255,255,.1) 0 4px, transparent 4px 8px), linear-gradient(135deg, #9cff00 0%, #00c9ff 100%)",
  },
  {
    id: "pixel-nightdrive",
    label: "Nightdrive",
    category: "Pixel",
    glow: "#ff0080",
    css: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(135deg, #ff0080 0%, #7928ca 50%, #0f0c29 100%)",
    backgroundSize: "10px 10px, 10px 10px, 100% 100%",
  },

  // ── Glass — quiet, frosted, premium-neutral ─────────────────
  {
    id: "glass-slate",
    label: "Slate",
    category: "Glass",
    glow: "#94a3b8",
    css: "radial-gradient(at 25% 15%, rgba(255,255,255,.25), transparent 45%), linear-gradient(135deg, #334155 0%, #0f172a 100%)",
  },
  {
    id: "glass-champagne",
    label: "Champagne",
    category: "Glass",
    glow: "#d9c9a8",
    css: "radial-gradient(at 25% 15%, rgba(255,255,255,.55), transparent 45%), linear-gradient(135deg, #f5f0e6 0%, #d9c9a8 100%)",
  },
];

export const getGradientById = (id) =>
  PREMIUM_GRADIENTS.find((g) => g.id === id) || PREMIUM_GRADIENTS[0];

// ─────────────────────────────────────────────────────────────────────────
// <CommunityAvatar/> — the single, reusable "community image" renderer.
// Accepts either a curated gradientId, or a raw legacy gradient CSS string
// (so it stays compatible with communities that already have a plain
// `banner_gradient` saved), plus an emoji or an uploaded image URL.
// ─────────────────────────────────────────────────────────────────────────
export const CommunityAvatar = ({
  icon,
  gradientId,
  gradientCss,
  glow,
  size = 48,
  radius,
  shape = "rounded", // "rounded" | "circle"
  animated = true,
  className = "",
  style = {},
  children,
}) => {
  const preset = gradientId ? getGradientById(gradientId) : null;
  const bg = preset ? preset.css : gradientCss || "linear-gradient(135deg,#667eea,#764ba2)";
  const bgSize = preset?.backgroundSize;
  const glowColor = glow || preset?.glow || "#9cff00";
  const isImage = typeof icon === "string" && icon.startsWith("http");
  const isMotion = animated && !!preset?.animated;
  const r = radius ?? (shape === "circle" ? size / 2 : Math.max(10, Math.round(size * 0.24)));

  return (
    <div
      className={`cav-root${isMotion ? " cav-motion" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, borderRadius: r, "--cav-glow": glowColor, ...style }}
    >
      <div className="cav-bg" style={{ backgroundImage: bg, backgroundSize: bgSize || "cover", borderRadius: r }} />
      <div className="cav-sheen" style={{ borderRadius: r }} />
      <div className="cav-ring" style={{ borderRadius: r }} />
      <div className="cav-content" style={{ fontSize: Math.max(12, Math.round(size * 0.42)) }}>
        {isImage ? (
          <img src={icon} alt="" className="cav-img" style={{ borderRadius: r }} />
        ) : icon ? (
          <span className="cav-emoji">{icon}</span>
        ) : (
          children || null
        )}
      </div>

      <style>{`
        .cav-root{
          position:relative; flex-shrink:0; isolation:isolate;
          box-shadow:
            0 6px 18px rgba(0,0,0,.38),
            0 0 0 1px rgba(255,255,255,.06) inset,
            0 0 26px -6px var(--cav-glow);
          transition: box-shadow .3s ease, transform .25s cubic-bezier(.34,1.56,.64,1);
        }
        .cav-root:hover{
          transform: translateY(-1px) scale(1.02);
          box-shadow:
            0 10px 26px rgba(0,0,0,.45),
            0 0 0 1px rgba(255,255,255,.09) inset,
            0 0 34px -4px var(--cav-glow);
        }
        .cav-bg{ position:absolute; inset:0; background-position:center; background-repeat:no-repeat; }
        .cav-motion .cav-bg{
          background-size: 220% 220% !important;
          animation: cavDrift 14s ease-in-out infinite;
        }
        @keyframes cavDrift{
          0%,100%{ background-position: 20% 30%; }
          50%{ background-position: 80% 70%; }
        }
        .cav-sheen{
          position:absolute; inset:0; pointer-events:none;
          background: linear-gradient(125deg, rgba(255,255,255,.32) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,.14) 100%);
          mix-blend-mode: overlay;
        }
        .cav-ring{
          position:absolute; inset:0; pointer-events:none;
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.14), inset 0 -10px 16px -8px rgba(0,0,0,.35);
        }
        .cav-content{
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          overflow:hidden; color:#fff; font-weight:800; line-height:1;
        }
        .cav-img{ width:100%; height:100%; object-fit:cover; display:block; }
        .cav-emoji{ filter: drop-shadow(0 2px 6px rgba(0,0,0,.35)); }
        @media (prefers-reduced-motion: reduce){
          .cav-motion .cav-bg{ animation:none; }
          .cav-root, .cav-root:hover{ transition:none; transform:none; }
        }
      `}</style>
    </div>
  );
};

export default CommunityAvatar;