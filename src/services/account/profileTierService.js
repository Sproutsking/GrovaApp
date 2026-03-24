// src/services/account/profileTierService.js
// ============================================================================
// Profile Tier Service — visual config for boost tiers + theme overrides
//
// Exports:
//   BOOST_TIERS        — pricing + benefits config
//   BOOST_VISUAL       — per-tier ring/badge/gradient config
//   getBoostVisualForTheme — returns theme-specific ring override (or null)
//   buildTierInfo      — constructs full tier display info from profile row
//   getTierBadge       — returns badge emoji/label/color for a tier
// ============================================================================

// ── Tier pricing + benefits ───────────────────────────────────────────────────
export const BOOST_TIERS = {
  silver: {
    name: "Silver Boost",
    ep_price: { monthly: 200, yearly: 1_800 },
    usd_display: { monthly: "$2", yearly: "$18" },
    ep_bonus_pct: 0,
    theme_count: 1,
    benefits: [
      "Animated silver ring on your avatar",
      "Silver name color across the platform",
      "Moonlit Chrome profile card design",
      "Priority in follower suggestions",
    ],
  },
  gold: {
    name: "Gold Boost",
    ep_price: { monthly: 500, yearly: 5_000 },
    usd_display: { monthly: "$5", yearly: "$50" },
    ep_bonus_pct: 10,
    theme_count: 2,
    benefits: [
      "Animated gold ring with shimmer effect",
      "Gold name color across the platform",
      "2 exclusive profile card designs",
      "+10% EP on all earnings",
      "Priority content ranking",
    ],
  },
  diamond: {
    name: "Diamond Boost",
    ep_price: { monthly: 1_100, yearly: 10_000 },
    usd_display: { monthly: "$11", yearly: "$100" },
    ep_bonus_pct: 25,
    theme_count: 5,
    benefits: [
      "Animated diamond ring — 5 exclusive themes",
      "Theme-colored name across the platform",
      "5 spectacular profile card designs",
      "+25% EP on all earnings",
      "Top priority in all rankings",
      "Exclusive diamond badge",
    ],
  },
};

// ── Per-tier visual config (ring + badge + gradients) ────────────────────────
export const BOOST_VISUAL = {
  silver: {
    badge: "🌙",
    badgeLabel: "Silver",
    color: "#d4d4d4",
    glow: "rgba(212,212,212,0.5)",
    grad: ["#c0c0c0", "#a8a8a8"],
    border: "2.5px solid #c0c0c0",
    boxShadow:
      "0 0 0 3px rgba(192,192,192,0.2), 0 0 20px rgba(192,192,192,0.5), 0 0 40px rgba(192,192,192,0.2)",
    animStyle: "silverPulse 3s ease-in-out infinite",
    animKeyframes: `
      @keyframes silverPulse {
        0%,100% { box-shadow: 0 0 0 3px rgba(192,192,192,0.2), 0 0 20px rgba(192,192,192,0.5), 0 0 40px rgba(192,192,192,0.2); }
        50%     { box-shadow: 0 0 0 4px rgba(255,255,255,0.35), 0 0 36px rgba(212,212,212,0.8), 0 0 64px rgba(192,192,192,0.4); }
      }
    `,
  },

  gold: {
    badge: "👑",
    badgeLabel: "Gold",
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.6)",
    grad: ["#fbbf24", "#d97706"],
    border: "2.5px solid #fbbf24",
    boxShadow:
      "0 0 0 3px rgba(251,191,36,0.28), 0 0 28px rgba(251,191,36,0.7), 0 0 56px rgba(251,191,36,0.3)",
    animStyle: "goldShimmer 2.5s ease-in-out infinite",
    animKeyframes: `
      @keyframes goldShimmer {
        0%,100% { box-shadow: 0 0 0 2px rgba(251,191,36,0.2), 0 0 28px rgba(251,191,36,0.7), 0 0 56px rgba(251,191,36,0.3); border-color: #fbbf24; }
        50%     { box-shadow: 0 0 0 4px rgba(254,240,138,0.42), 0 0 48px rgba(251,191,36,1),   0 0 96px rgba(251,191,36,0.5); border-color: #fef08a; }
      }
    `,
  },

  diamond: {
    badge: "💎",
    badgeLabel: "Diamond",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.6)",
    grad: ["#a78bfa", "#7c3aed"],
    border: "2.5px solid #a78bfa",
    boxShadow:
      "0 0 0 3px rgba(167,139,250,0.28), 0 0 36px rgba(167,139,250,0.8), 0 0 72px rgba(167,139,250,0.4)",
    animStyle: "diamondViolet 3s ease-in-out infinite",
    animKeyframes: `
      @keyframes diamondViolet {
        0%,100% { box-shadow: 0 0 0 2px rgba(167,139,250,0.22), 0 0 36px rgba(167,139,250,0.8), 0 0 72px rgba(167,139,250,0.4); border-color: #a78bfa; }
        50%     { box-shadow: 0 0 0 4px rgba(196,181,253,0.42), 0 0 56px rgba(167,139,250,1),   0 0 112px rgba(167,139,250,0.6); border-color: #c4b5fd; }
      }
    `,
  },
};

// ── Diamond theme-specific ring overrides ─────────────────────────────────────
const DIAMOND_THEME_VISUALS = {
  "diamond-cosmos": {
    border: "2.5px solid #a78bfa",
    boxShadow:
      "0 0 0 3px rgba(167,139,250,0.28), 0 0 36px rgba(167,139,250,0.8), 0 0 72px rgba(167,139,250,0.4)",
    animStyle: "diamondViolet 3s ease-in-out infinite",
    grad: ["#a78bfa", "#7c3aed"],
    glow: "rgba(167,139,250,0.6)",
    badge: "💎",
  },
  "diamond-glacier": {
    border: "2.5px solid #60a5fa",
    boxShadow:
      "0 0 0 3px rgba(96,165,250,0.22), 0 0 36px rgba(96,165,250,0.8), 0 0 72px rgba(96,165,250,0.4)",
    animStyle: "diamondIce 3s ease-in-out infinite",
    grad: ["#60a5fa", "#2563eb"],
    glow: "rgba(96,165,250,0.6)",
    badge: "❄️",
    animKeyframes: `
      @keyframes diamondIce {
        0%,100% { box-shadow: 0 0 0 2px rgba(96,165,250,0.22), 0 0 36px rgba(96,165,250,0.8), 0 0 72px rgba(96,165,250,0.4); border-color: #60a5fa; }
        33%     { box-shadow: 0 0 0 3px rgba(6,182,212,0.3),    0 0 48px rgba(6,182,212,0.9),  0 0 96px rgba(6,182,212,0.5);  border-color: #06b6d4; }
        66%     { box-shadow: 0 0 0 4px rgba(186,230,253,0.35), 0 0 56px rgba(96,165,250,1),   0 0 112px rgba(96,165,250,0.6); border-color: #bae6fd; }
      }
    `,
  },
  "diamond-emerald": {
    border: "2.5px solid #34d399",
    boxShadow:
      "0 0 0 3px rgba(52,211,153,0.22), 0 0 36px rgba(52,211,153,0.8), 0 0 72px rgba(52,211,153,0.4)",
    animStyle: "diamondEmerald 3s ease-in-out infinite",
    grad: ["#34d399", "#059669"],
    glow: "rgba(52,211,153,0.6)",
    badge: "💚",
    animKeyframes: `
      @keyframes diamondEmerald {
        0%,100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.22), 0 0 36px rgba(52,211,153,0.8), 0 0 72px rgba(52,211,153,0.4); border-color: #34d399; }
        50%     { box-shadow: 0 0 0 4px rgba(167,243,208,0.35), 0 0 56px rgba(52,211,153,1),   0 0 112px rgba(52,211,153,0.6); border-color: #a7f3d0; }
      }
    `,
  },
  "diamond-rose": {
    border: "2.5px solid #f472b6",
    boxShadow:
      "0 0 0 3px rgba(244,114,182,0.22), 0 0 36px rgba(244,114,182,0.8), 0 0 72px rgba(244,114,182,0.4)",
    animStyle: "diamondRose 3s ease-in-out infinite",
    grad: ["#f472b6", "#db2777"],
    glow: "rgba(244,114,182,0.6)",
    badge: "🌹",
    animKeyframes: `
      @keyframes diamondRose {
        0%,100% { box-shadow: 0 0 0 2px rgba(244,114,182,0.22), 0 0 36px rgba(244,114,182,0.8), 0 0 72px rgba(244,114,182,0.4); border-color: #f472b6; }
        50%     { box-shadow: 0 0 0 4px rgba(251,207,232,0.35), 0 0 56px rgba(244,114,182,1),   0 0 112px rgba(244,114,182,0.6); border-color: #fbcfe8; }
      }
    `,
  },
  "diamond-void": {
    border: "2.5px solid rgba(255,255,255,0.2)",
    boxShadow:
      "0 0 0 2px rgba(255,255,255,0.07), 0 0 36px rgba(167,139,250,0.55), 0 0 72px rgba(96,165,250,0.28)",
    animStyle: "diamondVoid 4s ease-in-out infinite",
    grad: ["rgba(255,255,255,0.7)", "rgba(200,200,200,0.5)"],
    glow: "rgba(167,139,250,0.5)",
    badge: "🖤",
    animKeyframes: `
      @keyframes diamondVoid {
        0%,100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.07), 0 0 36px rgba(167,139,250,0.55), 0 0 72px rgba(96,165,250,0.28); border-color: rgba(255,255,255,0.2); }
        33%     { box-shadow: 0 0 0 3px rgba(255,255,255,0.12), 0 0 48px rgba(96,165,250,0.65),  0 0 96px rgba(167,139,250,0.38); border-color: rgba(96,165,250,0.5); }
        66%     { box-shadow: 0 0 0 3px rgba(255,255,255,0.09), 0 0 48px rgba(244,114,182,0.55), 0 0 96px rgba(52,211,153,0.28);  border-color: rgba(244,114,182,0.42); }
      }
    `,
  },
};

// Gold theme-specific ring overrides
const GOLD_THEME_VISUALS = {
  "gold-dynasty": {
    border: "2.5px solid #fbbf24",
    boxShadow:
      "0 0 0 3px rgba(251,191,36,0.28), 0 0 28px rgba(251,191,36,0.7), 0 0 56px rgba(251,191,36,0.3)",
    animStyle: "goldShimmer 2.5s ease-in-out infinite",
    grad: ["#fbbf24", "#d97706"],
    glow: "rgba(251,191,36,0.6)",
    badge: "👑",
  },
  "gold-solar": {
    border: "2.5px solid #f97316",
    boxShadow:
      "0 0 0 3px rgba(249,115,22,0.22), 0 0 28px rgba(249,115,22,0.75), 0 0 56px rgba(251,191,36,0.35)",
    animStyle: "goldFire 3s ease-in-out infinite",
    grad: ["#f97316", "#dc2626"],
    glow: "rgba(249,115,22,0.6)",
    badge: "☀️",
    animKeyframes: `
      @keyframes goldFire {
        0%   { box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 28px rgba(249,115,22,0.75), 0 0 56px rgba(251,191,36,0.35); border-color: #f97316; }
        25%  { box-shadow: 0 0 0 3px rgba(251,191,36,0.32), 0 0 38px rgba(251,191,36,0.9),  0 0 76px rgba(253,224,71,0.4);  border-color: #fbbf24; }
        50%  { box-shadow: 0 0 0 4px rgba(220,38,38,0.28),  0 0 44px rgba(249,115,22,0.95), 0 0 88px rgba(249,115,22,0.5);  border-color: #ef4444; }
        75%  { box-shadow: 0 0 0 3px rgba(251,191,36,0.32), 0 0 38px rgba(251,191,36,0.9),  0 0 76px rgba(253,224,71,0.4);  border-color: #fbbf24; }
        100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 28px rgba(249,115,22,0.75), 0 0 56px rgba(251,191,36,0.35); border-color: #f97316; }
      }
    `,
  },
};

// ── getBoostVisualForTheme ────────────────────────────────────────────────────
// Returns a theme-specific ring visual override, or null if using tier default.
// Used by BoostAvatarRing when both tier + themeId are provided.
export function getBoostVisualForTheme(tier, themeId) {
  if (!tier || !themeId) return null;
  if (tier === "diamond" && DIAMOND_THEME_VISUALS[themeId]) {
    const base = BOOST_VISUAL.diamond;
    const override = DIAMOND_THEME_VISUALS[themeId];
    return { ...base, ...override };
  }
  if (tier === "gold" && GOLD_THEME_VISUALS[themeId]) {
    const base = BOOST_VISUAL.gold;
    const override = GOLD_THEME_VISUALS[themeId];
    return { ...base, ...override };
  }
  if (tier === "silver") {
    return BOOST_VISUAL.silver; // Only one silver theme
  }
  return null;
}

// ── buildTierInfo ─────────────────────────────────────────────────────────────
export function buildTierInfo(profileData) {
  if (!profileData) return null;
  const tier = profileData.subscription_tier ?? "standard";
  const paymentStatus = profileData.payment_status ?? "pending";
  const activated = profileData.account_activated ?? false;

  // Determine access status
  let accessStatus = "NOT_ACTIVATED";
  if (activated || paymentStatus === "paid") accessStatus = "PAID";
  else if (paymentStatus === "free_access") accessStatus = "FREE_ACCESS";

  const visual = BOOST_VISUAL[tier] ?? null;

  return {
    tier,
    paymentStatus,
    accessStatus,
    hasBoostedTier: ["silver", "gold", "diamond"].includes(tier),
    isSystemGrant: profileData.is_system_grant ?? false,
    visual,
    displayName: visual
      ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Boost`
      : null,
  };
}

// ── getTierBadge ──────────────────────────────────────────────────────────────
export function getTierBadge(tier, paymentStatus) {
  if (!tier || !["silver", "gold", "diamond"].includes(tier)) return null;
  if (
    paymentStatus &&
    !["paid", "active", "system_grant"].includes(paymentStatus)
  )
    return null;
  const v = BOOST_VISUAL[tier];
  if (!v) return null;
  return {
    emoji: v.badge,
    label: v.badgeLabel,
    color: v.color,
    glow: v.glow,
  };
}

export default {
  BOOST_TIERS,
  BOOST_VISUAL,
  getBoostVisualForTheme,
  buildTierInfo,
  getTierBadge,
};
