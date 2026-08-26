const TIER_NAME_COLORS = {
  silver: "#d4d4d4",
  gold: "#fbbf24",
  diamond: "#a78bfa",
};

const DIAMOND_THEME_COLORS = {
  "diamond-cosmos": "#a78bfa",
  "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399",
  "diamond-rose": "#f472b6",
  "diamond-void": "#e5e5e5",
  "diamond-inferno": "#ff6b35",
  "diamond-aurora": "#22d3ee",
};

export function getBoostNameColor(tier, themeId) {
  if (!tier || !TIER_NAME_COLORS[tier]) return null;
  if (tier === "diamond" && DIAMOND_THEME_COLORS[themeId]) {
    return DIAMOND_THEME_COLORS[themeId];
  }
  return TIER_NAME_COLORS[tier];
}