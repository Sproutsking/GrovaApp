export const EXPERIENCE_IDS = Object.freeze({
  XEEVIA: "xeevia",
  GAMING: "gaming",
  WEB3: "web3",
});

const CORE_NAVIGATION = Object.freeze([
  { id: "home", label: "Home" },
  { id: "community", label: "Community" },
  { id: "market", label: "Market" },
  { id: "wallet", label: "Wallet" },
  { id: "account", label: "Account" },
]);

export const EXPERIENCE_CONFIG = Object.freeze({
  xeevia: Object.freeze({
    id: "xeevia",
    name: "Xeevia",
    description: "Social life, communities, and creators",
    accent: "#a8e63d",
    navigation: CORE_NAVIGATION,
    authProviders: ["google", "x", "facebook", "discord"],
    features: Object.freeze(["generalFeed", "creators", "generalDiscovery"]),
  }),
  gaming: Object.freeze({
    id: "gaming",
    name: "Gaming",
    description: "Roblox, players, teams, and gaming culture",
    accent: "#60a5fa",
    navigation: CORE_NAVIGATION,
    authProviders: ["roblox", "fortnite", "minecraft", "discord"],
    features: Object.freeze(["gameFeed", "roblox", "avatarFashion", "trading", "gameCommunities"]),
  }),
  web3: Object.freeze({
    id: "web3",
    name: "Web3",
    description: "Builders, protocols, projects, and communities",
    accent: "#f59e0b",
    navigation: CORE_NAVIGATION,
    authProviders: ["dynamic", "privy", "web3auth", "rainbowkit", "discord"],
    features: Object.freeze(["web3Feed", "protocols", "projects", "opportunities", "walletActivity"]),
  }),
});

export const getExperienceConfig = (experienceId) =>
  EXPERIENCE_CONFIG[experienceId] || EXPERIENCE_CONFIG.xeevia;

export const getStoredExperienceId = () => {
  if (typeof window === "undefined") return EXPERIENCE_IDS.XEEVIA;
  const stored = window.localStorage.getItem("xeevia_active_experience");
  return EXPERIENCE_CONFIG[stored] ? stored : EXPERIENCE_IDS.XEEVIA;
};
