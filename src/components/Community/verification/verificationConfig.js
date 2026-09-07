export const DEFAULT_VERIFICATION_CONFIG = {
  mode: "quick",
  quickEnabled: true,
  pictureEnabled: true,
  name: "Xeevia Verification",
  avatarIcon: "shield",
  accentColor: "#c9a66b",
  message: "Confirm your identity to unlock the rest of the community.",
  quick: {
    idleTitle: "Verification required",
    idleDescription: "Confirm you are a real, unique person to unlock the rest of the community.",
    verifiedTitle: "You are verified",
    verifiedDescription: "Your identity is confirmed. You now have full access.",
    buttonLabel: "Verify",
  },
  picture: {
    idleTitle: "Picture check",
    descriptionTemplate: "Select the card showing the {label}, then tap its letter below.",
    verifiedTitle: "You are verified",
    verifiedDescription: "Your identity is confirmed. You now have full access.",
  },
  panels: {
    rules: { label: "Rules", text: "Real identities only. One account holds one seal." },
    info: { label: "How it works", text: "Verification confirms access and does not read your messages or files." },
    perks: { label: "Perks", text: "Verified members get full channel access." },
  },
  challenge: {
    cards: [],
    correctId: null,
  },
};

export function normalizeVerificationConfig(saved = {}) {
  return {
    ...DEFAULT_VERIFICATION_CONFIG,
    ...saved,
    quick: { ...DEFAULT_VERIFICATION_CONFIG.quick, ...(saved.quick || {}) },
    picture: { ...DEFAULT_VERIFICATION_CONFIG.picture, ...(saved.picture || {}) },
    panels: {
      rules: { ...DEFAULT_VERIFICATION_CONFIG.panels.rules, ...((saved.panels || {}).rules || {}) },
      info: { ...DEFAULT_VERIFICATION_CONFIG.panels.info, ...((saved.panels || {}).info || {}) },
      perks: { ...DEFAULT_VERIFICATION_CONFIG.panels.perks, ...((saved.panels || {}).perks || {}) },
    },
    challenge: {
      ...DEFAULT_VERIFICATION_CONFIG.challenge,
      ...(saved.challenge || {}),
      cards: Array.isArray(saved.challenge?.cards) ? saved.challenge.cards : [],
    },
  };
}

export function challengeIsReady(config) {
  const cards = config?.challenge?.cards || [];
  return cards.length >= 2 && cards.some((card) => card.id === config.challenge.correctId);
}
