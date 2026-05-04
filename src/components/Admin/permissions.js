// ============================================================================
// src/components/Admin/permissions.js — v6 AMBASSADOR ADDED
// ============================================================================
//
// ARCHITECTURE CONTRACT:
//   Single source of truth for admin roles, section visibility, permissions.
//
//   Roles (from admin_team.role CHECK constraint in DB):
//     ceo_owner   — all access, all sections, cannot be removed/demoted
//     super_admin — all sections except CEO panel
//     a_admin     — advanced admin: most sections
//     b_admin     — standard admin: common sections
//     admin       — base admin level
//     support     — support cases + users (read-only sensitive)
//
//   RULES (never break these):
//     1. Unknown roles get minimal safe access (support level).
//     2. ceo_owner ALWAYS granted all sections — no exceptions.
//     3. getVisibleSections() never throws.
//     4. can(adminData, permission) is a named alias for hasPermission.
//     5. PERMISSIONS is the canonical set of all permission strings.
//     6. Role is ALWAYS read from DB — never derived from anything else.
//
// CHANGES v6:
//   - "ambassador" added to ALL_SECTIONS.
//   - "ambassador" added to SECTION_MAP for ceo_owner, super_admin,
//     a_admin, b_admin, admin. Support role does NOT see it.
//   - MANAGE_AMBASSADOR permission string added to PERMISSIONS enum.
//   - "manage_ambassador" added to ROLE_PERMISSIONS for relevant roles.
//
// ============================================================================

// ── All possible sections ─────────────────────────────────────────────────────

export const ALL_SECTIONS = [
  "dashboard",
  "support",
  "users",
  "invites",
  "analytics",
  "transactions",
  "communities",
  "security",
  "notifications",
  "system",
  "team",
  "ambassador",  // ← ADDED
  "ceo",
];

// ── Section visibility by role ────────────────────────────────────────────────

const SECTION_MAP = {
  ceo_owner: [...ALL_SECTIONS], // automatically includes "ambassador" via ALL_SECTIONS

  super_admin: [
    "dashboard",
    "support",
    "users",
    "invites",
    "analytics",
    "transactions",
    "communities",
    "security",
    "notifications",
    "system",
    "team",
    "ambassador",  // ← ADDED
  ],

  a_admin: [
    "dashboard",
    "support",
    "users",
    "invites",
    "analytics",
    "transactions",
    "communities",
    "security",
    "notifications",
    "system",
    "team",
    "ambassador",  // ← ADDED
  ],

  b_admin: [
    "dashboard",
    "support",
    "users",
    "invites",
    "analytics",
    "transactions",
    "communities",
    "security",
    "ambassador",  // ← ADDED
  ],

  admin: [
    "dashboard",
    "support",
    "users",
    "analytics",
    "communities",
    "ambassador",  // ← ADDED
  ],

  support: [
    "dashboard",
    "support",
    "users",
    // support agents do NOT see ambassador management
  ],
};

// ── Role metadata for UI display ──────────────────────────────────────────────

export const ROLE_META = {
  ceo_owner: {
    label: "CEO & Owner",
    color: "#f59e0b",
    priority: 0,
    badge: "👑",
    description: "Full platform control. Cannot be removed.",
  },
  super_admin: {
    label: "Super Admin",
    color: "#a855f7",
    priority: 1,
    badge: "⚡",
    description: "All sections except CEO panel.",
  },
  a_admin: {
    label: "A-Admin",
    color: "#3b82f6",
    priority: 2,
    badge: "🔷",
    description: "Advanced admin access.",
  },
  b_admin: {
    label: "B-Admin",
    color: "#06b6d4",
    priority: 3,
    badge: "🔹",
    description: "Standard admin access.",
  },
  admin: {
    label: "Admin",
    color: "#84cc16",
    priority: 4,
    badge: "✦",
    description: "Base admin level.",
  },
  support: {
    label: "Support",
    color: "#6b7280",
    priority: 5,
    badge: "🎧",
    description: "Support and user management.",
  },
};

// ── Default permissions per role ──────────────────────────────────────────────

export const ROLE_PERMISSIONS = {
  ceo_owner: ["all"],

  super_admin: [
    "view_users",
    "ban_users",
    "delete_users",
    "verify_users",
    "manage_invites",
    "view_analytics",
    "view_transactions",
    "refund_transactions",
    "manage_communities",
    "view_security",
    "send_notifications",
    "manage_settings",
    "manage_team",
    "freeze_platform",
    "view_support",
    "resolve_support",
    "assign_support",
    "adjust_wallet",
    "block_ip",
    "manage_ambassador",   // ← ADDED
  ],

  a_admin: [
    "view_users",
    "ban_users",
    "verify_users",
    "manage_invites",
    "view_analytics",
    "view_transactions",
    "refund_transactions",
    "manage_communities",
    "view_security",
    "send_notifications",
    "manage_settings",
    "manage_team",
    "view_support",
    "resolve_support",
    "assign_support",
    "manage_ambassador",   // ← ADDED
  ],

  b_admin: [
    "view_users",
    "ban_users",
    "verify_users",
    "manage_invites",
    "view_analytics",
    "view_transactions",
    "manage_communities",
    "view_security",
    "view_support",
    "resolve_support",
    "manage_ambassador",   // ← ADDED
  ],

  admin: [
    "view_users",
    "ban_users",
    "view_analytics",
    "manage_communities",
    "view_support",
    "resolve_support",
    "manage_ambassador",   // ← ADDED
  ],

  support: [
    "view_users",
    "view_support",
    "resolve_support",
    "assign_support",
    // no manage_ambassador for support role
  ],
};

// ── PERMISSIONS enum — all known permission strings ───────────────────────────

export const PERMISSIONS = {
  // User management
  VIEW_USERS:         "view_users",
  BAN_USERS:          "ban_users",
  DELETE_USERS:       "delete_users",
  VERIFY_USERS:       "verify_users",
  ADJUST_WALLET:      "adjust_wallet",
  RESTORE_USERS:      "restore_users",

  // Invites
  MANAGE_INVITES:     "manage_invites",
  VIEW_INVITES:       "view_invites",
  CREATE_INVITES:     "create_invites",
  DELETE_INVITES:     "delete_invites",

  // Analytics
  VIEW_ANALYTICS:     "view_analytics",

  // Transactions
  VIEW_TRANSACTIONS:  "view_transactions",
  REFUND_TRANSACTIONS:"refund_transactions",

  // Communities
  MANAGE_COMMUNITIES: "manage_communities",

  // Security
  VIEW_SECURITY:      "view_security",
  BLOCK_IP:           "block_ip",
  MANAGE_SECURITY:    "manage_security",

  // Notifications
  SEND_NOTIFICATIONS: "send_notifications",

  // System
  MANAGE_SETTINGS:    "manage_settings",
  FREEZE_PLATFORM:    "freeze_platform",
  VIEW_SYSTEM:        "view_system",
  VIEW_AUDIT_LOGS:    "view_audit_logs",

  // Team
  MANAGE_TEAM:        "manage_team",
  ADD_TEAM:           "add_team",
  REMOVE_TEAM:        "remove_team",
  VIEW_TEAM:          "view_team",

  // Support
  VIEW_SUPPORT:       "view_support",
  RESOLVE_SUPPORT:    "resolve_support",
  ASSIGN_SUPPORT:     "assign_support",

  // Ambassador  ← ADDED
  MANAGE_AMBASSADOR:  "manage_ambassador",

  // Special
  ALL:                "all",
};

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * getVisibleSections
 * Returns section IDs visible to this admin. Never throws.
 * ceo_owner always gets everything.
 *
 * @param {object|null} adminData
 * @returns {string[]}
 */
export function getVisibleSections(adminData) {
  if (!adminData) return ["dashboard"];

  const role = adminData?.role;

  // CEO always gets all
  if (role === "ceo_owner") return [...ALL_SECTIONS];

  // If permissions includes "all" and not a support role, grant all sections
  if (
    Array.isArray(adminData?.permissions) &&
    adminData.permissions.includes("all") &&
    role !== "support"
  ) {
    return [...ALL_SECTIONS];
  }

  // Role-based sections, fallback to support-level for unknown roles
  return SECTION_MAP[role] ?? SECTION_MAP["support"];
}

/**
 * hasPermission
 * @param {object|null} adminData
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(adminData, permission) {
  if (!adminData) return false;
  if (!Array.isArray(adminData.permissions)) return false;
  if (adminData.permissions.includes("all")) return true;
  return adminData.permissions.includes(permission);
}

/**
 * can — alias for hasPermission.
 * Usage: can(adminData, PERMISSIONS.BAN_USERS)
 */
export function can(adminData, permission) {
  return hasPermission(adminData, permission);
}

/**
 * getRoleMeta — safe role metadata lookup.
 */
export function getRoleMeta(role) {
  return ROLE_META[role] ?? ROLE_META["support"];
}

/**
 * isHigherRole — returns true if roleA outranks roleB.
 */
export function isHigherRole(roleA, roleB) {
  const priorityA = ROLE_META[roleA]?.priority ?? 99;
  const priorityB = ROLE_META[roleB]?.priority ?? 99;
  return priorityA < priorityB;
}

export default {
  ALL_SECTIONS,
  SECTION_MAP,
  ROLE_META,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  getVisibleSections,
  hasPermission,
  can,
  getRoleMeta,
  isHigherRole,
};