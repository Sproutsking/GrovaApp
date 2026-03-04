// ============================================================================
// services/xrc/streamRegistry.js
// XRC v2 — Stream type definitions and metadata registry
// ============================================================================

export const STREAM_TYPES = {
  XTRC: "XTRC", // Transaction Record Chain — token transfers, payments, refunds
  XERC: "XERC", // Engagement Record Chain — likes, comments, shares, views
  XARC: "XARC", // Account Record Chain — profile creation, updates, bans
  XCRC: "XCRC", // Content Record Chain — post/reel/story create, edit, delete
  XPRC: "XPRC", // Permission Record Chain — role assignments, access changes
  XSRC: "XSRC", // System Record Chain — platform freeze, admin actions, settings
  XWRC: "XWRC", // Wallet Record Chain — state transitions ONLY (not calculations)
};

export const STREAM_REGISTRY = {
  [STREAM_TYPES.XTRC]: {
    label: "Transaction Chain",
    description: "Token transfers, payments, refunds, EP awards",
    color: "#f59e0b",
    icon: "💸",
    requiresRealUser: true,
    sensitive: true,
  },
  [STREAM_TYPES.XERC]: {
    label: "Engagement Chain",
    description: "Likes, comments, shares, views, reactions",
    color: "#ec4899",
    icon: "❤️",
    requiresRealUser: true,
    sensitive: false,
  },
  [STREAM_TYPES.XARC]: {
    label: "Account Chain",
    description: "Profile creation, updates, bans, deletions",
    color: "#3b82f6",
    icon: "👤",
    requiresRealUser: true,
    sensitive: true,
  },
  [STREAM_TYPES.XCRC]: {
    label: "Content Chain",
    description: "Post, reel, story creation, edits, deletions",
    color: "#84cc16",
    icon: "📝",
    requiresRealUser: true,
    sensitive: false,
  },
  [STREAM_TYPES.XPRC]: {
    label: "Permission Chain",
    description: "Role assignments, permission grants and revocations",
    color: "#8b5cf6",
    icon: "🔐",
    requiresRealUser: true,
    sensitive: true,
  },
  [STREAM_TYPES.XSRC]: {
    label: "System Chain",
    description: "Platform admin actions, settings, freeze events",
    color: "#ef4444",
    icon: "⚙️",
    requiresRealUser: false, // system can write
    sensitive: true,
  },
  [STREAM_TYPES.XWRC]: {
    label: "Wallet Chain",
    description:
      "Wallet state transitions only — NOT balance calculations. Includes before/after snapshots.",
    color: "#06b6d4",
    icon: "💎",
    requiresRealUser: true,
    sensitive: true,
    // SPECIAL: payload MUST include: token_balance_before, token_balance_after, token_delta
    requiredPayloadFields: ["token_balance_before", "token_balance_after", "token_delta"],
  },
};

/**
 * Validate payload for XWRC (special wallet chain rules).
 */
export function validateXWRCPayload(payload) {
  if (!payload) return { valid: false, error: "Payload is required" };
  const required = STREAM_REGISTRY[STREAM_TYPES.XWRC].requiredPayloadFields;
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null) {
      return { valid: false, error: `XWRC payload missing required field: ${field}` };
    }
  }
  return { valid: true };
}

/**
 * Get stream metadata by type.
 */
export function getStream(streamType) {
  return STREAM_REGISTRY[streamType] || null;
}

/**
 * List all stream types as array.
 */
export function listStreams() {
  return Object.entries(STREAM_REGISTRY).map(([type, meta]) => ({ type, ...meta }));
}