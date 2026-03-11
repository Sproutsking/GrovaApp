// ============================================================================
// src/services/config/boostAssets.js — LEGENDARY EDITION
// Silver / Gold / Diamond profile boost tiers.
// Pricing: $12/yr silver · $32/yr gold · $100/yr diamond
// ============================================================================

export const BOOST_TIERS = {
  free: { label: "Free", rank: 0 },
  whitelist: { label: "Whitelist", rank: 1 },
  standard: { label: "Standard", rank: 2 },
  vip: { label: "VIP", rank: 3 },
  silver: { label: "Silver Boost", rank: 4 },
  gold: { label: "Gold Boost", rank: 5 },
  diamond: { label: "Diamond Boost", rank: 6 },
};

// ── Pricing: annual subscription in USD ──────────────────────────────────────
export const BOOST_PRICING = {
  silver: {
    usd_yearly: 12,
    usd_monthly: 1.0,
    label: "$12 / year",
    label_monthly: "$1 / mo",
  },
  gold: {
    usd_yearly: 32,
    usd_monthly: 2.67,
    label: "$32 / year",
    label_monthly: "$2.67 / mo",
  },
  diamond: {
    usd_yearly: 100,
    usd_monthly: 8.33,
    label: "$100 / year",
    label_monthly: "$8.33 / mo",
  },
};

// ── Name colors ───────────────────────────────────────────────────────────────
export const TIER_NAME_COLORS = {
  free: null,
  whitelist: null,
  standard: null,
  vip: "#a78bfa",
  silver: "#d4d4d4",
  gold: "#fbbf24",
  diamond: "rainbow",
};

// ── Default avatar border per tier ───────────────────────────────────────────
export const TIER_AVATAR_BORDERS = {
  free: {
    border: "2.5px solid #84cc16",
    boxShadow: "0 3px 12px rgba(132,204,22,0.4)",
    animation: null,
  },
  whitelist: {
    border: "2.5px solid #84cc16",
    boxShadow: "0 3px 12px rgba(132,204,22,0.4)",
    animation: null,
  },
  standard: {
    border: "2.5px solid #84cc16",
    boxShadow: "0 3px 12px rgba(132,204,22,0.4)",
    animation: null,
  },
  vip: {
    border: "2.5px solid #a78bfa",
    boxShadow: "0 3px 14px rgba(167,139,250,0.5)",
    animation: null,
  },
  silver: {
    border: "3px solid #d4d4d4",
    boxShadow:
      "0 0 0 2px rgba(212,212,212,0.2), 0 0 20px rgba(212,212,212,0.5), 0 0 40px rgba(212,212,212,0.2)",
    animation: "boostSilverPulse",
  },
  gold: {
    border: "3px solid #fbbf24",
    boxShadow:
      "0 0 0 2px rgba(251,191,36,0.2), 0 0 28px rgba(251,191,36,0.6), 0 0 56px rgba(251,191,36,0.25)",
    animation: "boostGoldShimmer",
  },
  diamond: {
    border: "3px solid #a78bfa",
    boxShadow:
      "0 0 0 2px rgba(167,139,250,0.2), 0 0 36px rgba(167,139,250,0.7), 0 0 72px rgba(167,139,250,0.3)",
    animation: "boostDiamondViolet",
  },
};

// ============================================================================
// BORDER OPTIONS
// ============================================================================
export const BOOST_BORDER_OPTIONS = {
  silver: [
    {
      id: "silver_1",
      label: "Liquid Silver",
      description: "Flowing mercury shimmer",
      border: "3px solid #d4d4d4",
      boxShadow:
        "0 0 0 2px rgba(212,212,212,0.15), 0 0 20px rgba(212,212,212,0.55), 0 0 40px rgba(212,212,212,0.22)",
      animation: "boostSilverPulse",
      preview: "linear-gradient(135deg,#ffffff,#a3a3a3,#d4d4d4,#737373)",
      emoji: "🪙",
    },
  ],

  gold: [
    {
      id: "gold_1",
      label: "Royal Gold",
      description: "Classic luxury shimmer",
      border: "3px solid #fbbf24",
      boxShadow:
        "0 0 0 2px rgba(251,191,36,0.2), 0 0 28px rgba(251,191,36,0.65), 0 0 56px rgba(251,191,36,0.28)",
      animation: "boostGoldShimmer",
      preview: "linear-gradient(135deg,#fef3c7,#fbbf24,#d97706,#92400e)",
      emoji: "👑",
    },
    {
      id: "gold_2",
      label: "Molten Fire",
      description: "Gold meets volcanic ember",
      border: "3px solid #f97316",
      boxShadow:
        "0 0 0 2px rgba(249,115,22,0.18), 0 0 28px rgba(249,115,22,0.7), 0 0 56px rgba(251,191,36,0.32)",
      animation: "boostGoldFire",
      preview: "linear-gradient(135deg,#fbbf24,#f97316,#dc2626,#f97316)",
      emoji: "🔥",
    },
  ],

  diamond: [
    {
      id: "diamond_violet",
      label: "Purple Diamond",
      description: "Rare violet gem — spectral radiance",
      border: "3px solid #a78bfa",
      boxShadow:
        "0 0 0 2px rgba(167,139,250,0.2), 0 0 36px rgba(167,139,250,0.75), 0 0 72px rgba(167,139,250,0.35)",
      animation: "boostDiamondViolet",
      preview: "linear-gradient(135deg,#ede9fe,#a78bfa,#7c3aed,#4c1d95)",
      emoji: "💜",
      gemColor: "#a78bfa",
    },
    {
      id: "diamond_blue",
      label: "Blue Diamond",
      description: "Hope diamond electrify",
      border: "3px solid #60a5fa",
      boxShadow:
        "0 0 0 2px rgba(96,165,250,0.2), 0 0 36px rgba(96,165,250,0.75), 0 0 72px rgba(96,165,250,0.35)",
      animation: "boostDiamondIce",
      preview: "linear-gradient(135deg,#dbeafe,#60a5fa,#2563eb,#1e3a8a)",
      emoji: "💙",
      gemColor: "#60a5fa",
    },
    {
      id: "diamond_green",
      label: "Green Diamond",
      description: "Dresden emerald — rarest on earth",
      border: "3px solid #34d399",
      boxShadow:
        "0 0 0 2px rgba(52,211,153,0.2), 0 0 36px rgba(52,211,153,0.75), 0 0 72px rgba(52,211,153,0.35)",
      animation: "boostDiamondEmerald",
      preview: "linear-gradient(135deg,#d1fae5,#34d399,#059669,#064e3b)",
      emoji: "💚",
      gemColor: "#34d399",
    },
    {
      id: "diamond_pink",
      label: "Pink Diamond",
      description: "Argyle pink — most precious gem",
      border: "3px solid #f472b6",
      boxShadow:
        "0 0 0 2px rgba(244,114,182,0.2), 0 0 36px rgba(244,114,182,0.75), 0 0 72px rgba(244,114,182,0.35)",
      animation: "boostDiamondRose",
      preview: "linear-gradient(135deg,#fce7f3,#f472b6,#db2777,#831843)",
      emoji: "🩷",
      gemColor: "#f472b6",
    },
    {
      id: "diamond_black",
      label: "Black Diamond",
      description: "Carbonado — the dark star",
      border: "3px solid rgba(255,255,255,0.18)",
      boxShadow:
        "0 0 0 2px rgba(255,255,255,0.06), 0 0 36px rgba(167,139,250,0.5), 0 0 72px rgba(96,165,250,0.22)",
      animation: "boostDiamondBlack",
      preview: "linear-gradient(135deg,#374151,#111827,#000000,#1f2937)",
      emoji: "🖤",
      gemColor: "#e5e7eb",
    },
  ],
};

// ============================================================================
// BACKGROUND OPTIONS
// ============================================================================
export const BOOST_BACKGROUND_OPTIONS = {
  silver: [
    {
      id: "silver_bg_moonlit",
      label: "Moonlit Chrome",
      description: "Polished silver under moonlight",
      cssClass: "boost-bg-silver-moonlit",
      preview: "linear-gradient(135deg,#1f2937,#6b7280,#d4d4d4,#374151)",
      emoji: "🌙",
    },
  ],

  gold: [
    {
      id: "gold_bg_dynasty",
      label: "Dynasty Gold",
      description: "Ancient empire opulence",
      cssClass: "boost-bg-gold-dynasty",
      preview: "linear-gradient(135deg,#1c1406,#92400e,#fbbf24,#d97706)",
      emoji: "🏛️",
    },
    {
      id: "gold_bg_solar",
      label: "Solar Flare",
      description: "Living fire breathes through the card",
      cssClass: "boost-bg-gold-solar",
      preview: "linear-gradient(135deg,#1c0a00,#dc2626,#f97316,#fbbf24)",
      emoji: "☀️",
    },
  ],

  diamond: [
    {
      id: "diamond_bg_cosmos",
      label: "Violet Cosmos",
      description: "Deep space purple nebula",
      cssClass: "boost-bg-diamond-cosmos",
      preview: "linear-gradient(135deg,#0d0010,#4c1d95,#7c3aed,#a78bfa)",
      emoji: "🔮",
      gemColor: "#a78bfa",
    },
    {
      id: "diamond_bg_glacier",
      label: "Glacier Blue",
      description: "Arctic crystal cathedral",
      cssClass: "boost-bg-diamond-glacier",
      preview: "linear-gradient(135deg,#000d1a,#1e3a8a,#2563eb,#60a5fa)",
      emoji: "🧊",
      gemColor: "#60a5fa",
    },
    {
      id: "diamond_bg_emerald",
      label: "Emerald Abyss",
      description: "Depths of the living earth",
      cssClass: "boost-bg-diamond-emerald",
      preview: "linear-gradient(135deg,#001a0d,#064e3b,#059669,#34d399)",
      emoji: "🌿",
      gemColor: "#34d399",
    },
    {
      id: "diamond_bg_argyle",
      label: "Pink Argyle",
      description: "Rarest gem in the universe",
      cssClass: "boost-bg-diamond-argyle",
      preview: "linear-gradient(135deg,#1a0010,#831843,#db2777,#f472b6)",
      emoji: "🌸",
      gemColor: "#f472b6",
    },
    {
      id: "diamond_bg_black",
      label: "Black Diamond",
      description: "Void star — all light consumed",
      cssClass: "boost-bg-diamond-black",
      preview: "linear-gradient(135deg,#000000,#111827,#1f2937,#111827)",
      emoji: "⚫",
      gemColor: "#e5e7eb",
    },
  ],
};

// ============================================================================
// FRAME OPTIONS
// ============================================================================
export const BOOST_FRAME_OPTIONS = {
  silver: [
    {
      id: "silver_frame_sterling",
      label: "Sterling Frame",
      description: "Polished silver border",
      cssClass: "boost-frame-silver-sterling",
      preview: "linear-gradient(135deg,#ffffff,#9ca3af)",
      emoji: "🖼️",
    },
  ],

  gold: [
    {
      id: "gold_frame_leaf",
      label: "Gold Leaf",
      description: "Classic gilded border",
      cssClass: "boost-frame-gold-leaf",
      preview: "linear-gradient(135deg,#fef3c7,#fbbf24)",
      emoji: "🍂",
    },
    {
      id: "gold_frame_baroque",
      label: "Baroque Gold",
      description: "Ornate double-line luxury frame",
      cssClass: "boost-frame-gold-baroque",
      preview: "linear-gradient(135deg,#fbbf24,#d97706)",
      emoji: "✨",
    },
  ],

  diamond: [
    {
      id: "diamond_frame_violet",
      label: "Violet Halo",
      description: "Pulsing purple crown",
      cssClass: "boost-frame-diamond-violet",
      preview: "linear-gradient(135deg,#a78bfa,#7c3aed)",
      emoji: "💜",
    },
    {
      id: "diamond_frame_ice",
      label: "Ice Crown",
      description: "Frozen blue crystalline",
      cssClass: "boost-frame-diamond-ice",
      preview: "linear-gradient(135deg,#60a5fa,#06b6d4)",
      emoji: "👑",
    },
    {
      id: "diamond_frame_emerald",
      label: "Emerald Ring",
      description: "Living green energy pulse",
      cssClass: "boost-frame-diamond-emerald",
      preview: "linear-gradient(135deg,#34d399,#059669)",
      emoji: "💚",
    },
    {
      id: "diamond_frame_rose",
      label: "Pink Prism",
      description: "Rose argyle refraction",
      cssClass: "boost-frame-diamond-rose",
      preview: "linear-gradient(135deg,#f472b6,#db2777)",
      emoji: "🩷",
    },
    {
      id: "diamond_frame_black",
      label: "Obsidian Edge",
      description: "Dark star border pulse",
      cssClass: "boost-frame-diamond-black",
      preview: "linear-gradient(135deg,#374151,#111827)",
      emoji: "🖤",
    },
  ],
};

// ── Revenue bonus ─────────────────────────────────────────────────────────────
export const TIER_REVENUE_BONUS = { silver: 0, gold: 0.02, diamond: 0.05 };

// ── Helpers ───────────────────────────────────────────────────────────────────
export const getActiveBorderOption = (tier, selections = {}) => {
  if (!tier || !BOOST_BORDER_OPTIONS[tier]) return null;
  const opts = BOOST_BORDER_OPTIONS[tier];
  return opts.find((o) => o.id === selections.border) || opts[0];
};

export const getActiveBorderStyle = (tier, selections = {}) => {
  const opt = getActiveBorderOption(tier, selections);
  if (!opt) return TIER_AVATAR_BORDERS[tier] || TIER_AVATAR_BORDERS.free;
  return {
    border: opt.border,
    boxShadow: opt.boxShadow,
    animation: opt.animation,
  };
};

export const getActiveFrameOption = (tier, selections = {}) => {
  if (!tier || !BOOST_FRAME_OPTIONS[tier]) return null;
  const opts = BOOST_FRAME_OPTIONS[tier];
  return opts.find((o) => o.id === selections.frame) || opts[0];
};

export const getActiveBackgroundOption = (tier, selections = {}) => {
  if (!tier || !BOOST_BACKGROUND_OPTIONS[tier]) return null;
  const opts = BOOST_BACKGROUND_OPTIONS[tier];
  return opts.find((o) => o.id === selections.background) || opts[0];
};

export const getActiveFrameCSS = () => null;
export const getActiveBackgroundCSS = () => null;

export const getTierNameColor = (tier) => TIER_NAME_COLORS[tier] || null;
export const isBoostedTier = (tier) =>
  ["silver", "gold", "diamond"].includes(tier);
