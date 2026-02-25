// ============================================================================
// src/services/auth/paymentGate.js — SINGLE SOURCE OF TRUTH
// ============================================================================
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  PAYMENT GATE — ONE FILE, ONE FUNCTION, ONE RULE                       │
// │                                                                         │
// │  Both App.jsx (AppRouter) and PaywallGate.jsx import isPaidProfile()   │
// │  from HERE. Never define this logic twice. If the rule changes,        │
// │  change it in this one file only.                                      │
// └─────────────────────────────────────────────────────────────────────────┘
//
// A user is considered ACTIVATED (paid) if ANY of these conditions are true:
//
//   account_activated = true
//     Set by: Paystack webhook, invite code apply, admin manual activation
//
//   payment_status = 'paid' or 'vip'
//     Set by: Paystack webhook, web3 payment verification
//
//   subscription_tier = 'standard' | 'pro' | 'vip' | 'whitelist'
//     Set by: Invite code apply (whitelist tier), subscription upgrade
//
// The paywall gate (AuthWall paywall mode) is shown if and ONLY IF:
//   - User is authenticated (has a session)
//   - Profile row is loaded (not null, not still fetching)
//   - isPaidProfile(profile) returns FALSE
//   - isAdmin is FALSE
//
// Once a user is activated, this function returns true forever (unless
// an admin explicitly reverts the DB fields — which is intentional).
// The payment screen NEVER re-appears mid-session.
//
// ACCOUNT STATUS GUARD (added v4):
//   Suspended or soft-deleted accounts are blocked even if paid.
//   This prevents banned users from re-entering via a cached paid status.
// ============================================================================

/**
 * Returns true if the user has completed payment / been activated.
 * Does NOT check account_status — use canAccessApp() for the full gate.
 *
 * @param {object|null} profile - The profile row from Supabase
 * @returns {boolean}
 */
export function isPaidProfile(profile) {
  if (!profile) return false;

  return (
    // Explicit activation flag (set by webhook or admin)
    profile.account_activated === true ||
    // Paystack/web3 payment completed
    profile.payment_status === "paid" ||
    profile.payment_status === "vip" ||
    // Subscription tier upgrade (invite code, subscription, waitlist promotion)
    profile.subscription_tier === "standard" ||
    profile.subscription_tier === "pro" ||
    profile.subscription_tier === "vip" ||
    profile.subscription_tier === "whitelist"
  );
}

/**
 * Returns true if an admin should bypass the payment gate entirely.
 * Admins always have full access regardless of payment status.
 *
 * @param {boolean} isAdmin - The isAdmin flag from AuthContext
 * @returns {boolean}
 */
export function isAdminBypass(isAdmin) {
  return isAdmin === true;
}

/**
 * Full gate check — use this in AppRouter.
 *
 * Checks in order:
 *   1. Admin bypass — always let admins in
 *   2. Account status — block suspended/deleted even if paid
 *   3. Payment check — let paid/activated users in
 *
 * @param {object} params
 * @param {object|null} params.profile
 * @param {boolean} params.isAdmin
 * @returns {boolean} true = let user in, false = show paywall
 */
export function canAccessApp({ profile, isAdmin }) {
  // Admins always bypass payment gate
  if (isAdminBypass(isAdmin)) return true;

  // No profile yet
  if (!profile) return false;

  // Block suspended or hard-deleted accounts even if they paid
  if (profile.account_status === "suspended") return false;
  if (profile.deleted_at) return false;

  return isPaidProfile(profile);
}
