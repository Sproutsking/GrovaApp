export const DEFAULT_MODERATION_CONFIG = {
  name: "Xeevia Moderation",
  avatarIcon: "shieldAlert",
  accentColor: "#e2555c",
  enabled: true,
  filters: {
    bannedWords: { enabled: true, words: "" },
    spam: { enabled: true, maxMessages: 5, windowSeconds: 7 },
    caps: { enabled: true, maxPercent: 70 },
    mentions: { enabled: true, maxMentions: 5 },
    invites: { enabled: true },
    duplicates: { enabled: true, maxRepeats: 3 },
  },
  escalation: [
    { id: "e1", strikes: 1, action: "warn", muteMinutes: 10 },
    { id: "e2", strikes: 3, action: "mute", muteMinutes: 30 },
    { id: "e3", strikes: 5, action: "kick", muteMinutes: 10 },
    { id: "e4", strikes: 7, action: "ban", muteMinutes: 10 },
  ],
  logging: { enabled: true, channelName: "mod-log" },
};

export function normalizeModerationConfig(saved = {}) {
  const base = DEFAULT_MODERATION_CONFIG;
  return {
    ...base,
    ...saved,
    filters: Object.fromEntries(Object.entries(base.filters).map(([key, value]) => [key, { ...value, ...(saved.filters?.[key] || {}) }])),
    escalation: Array.isArray(saved.escalation) && saved.escalation.length ? saved.escalation : base.escalation,
    logging: { ...base.logging, ...(saved.logging || {}) },
  };
}
