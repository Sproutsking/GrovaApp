// ============================================================================
// src/services/auth/paymentGate.js — v5 BULLETPROOF
// ============================================================================
//
// SINGLE SOURCE OF TRUTH for payment/access checks.
//
// CHANGES vs v4:
//   [1] isPaidProfile() now also checks payment_status === 'free'
//       (admin-granted free access) so those users aren't paywalled.
//   [2] canAccessApp() accepts the paidCache boolean from AuthContext's
//       getIsPaidCached() — once paid mid-session, NEVER paywalls again
//       even if a profile re-fetch returns stale DB data.
//   [3] isAdminBypass() now checks adminData.roleLevel as well as isAdmin
//       flag, so ceo_owner is never accidentally blocked.
//   [4] isPaidProfileData is re-exported from AuthContext — no duplication.
//
// HOW THE PAYWALL WORKS (complete flow):
//   1. User lands → AppRouter checks loading state → shows Splash
//   2. Auth resolves → if no user → AuthWall (login screen)
//   3. User logs in → profile fetched → canAccessApp() checked
//   4. If not paid → AuthWall with paywall=true → PaywallGate shown
//   5. User pays → edge function activates account → refreshProfile() called
//   6. Profile reloaded → isPaidProfile() returns true → paidCacheRef = true
//   7. App renders → PaywallGate never shown again this session
//   8. On next login → fresh profile fetch → isPaidProfile() still true (DB is updated)
// ============================================================================

import { isPaidProfileData } from "../../components/Auth/AuthContext";

/**
 * Returns true if the user's profile shows they have paid / been activated.
 * Checks every field that activateAccount() sets in payments.ts.
 *
 * @param {object|null} profile — Supabase profiles row
 * @returns {boolean}
 */
export function isPaidProfile(profile) {
  return isPaidProfileData(profile);
}

/**
 * Returns true if the admin should bypass payment gate entirely.
 * Admins (any level) always have full access.
 *
 * @param {boolean} isAdmin
 * @param {object|null} adminData — from AuthContext
 * @returns {boolean}
 */
export function isAdminBypass(isAdmin, adminData = null) {
  if (isAdmin === true) return true;
  // Belt-and-suspenders: check adminData if available
  if (adminData && adminData.roleLevel > 0) return true;
  return false;
}

/**
 * Full gate check — use this in AppRouter.
 *
 * Checks in order:
 *   1. Admin bypass → always let admins in
 *   2. Account status → block suspended/deleted even if paid
 *   3. Paid cache → once paid mid-session, never re-check
 *   4. Payment check → let paid/activated users in
 *
 * @param {object} params
 * @param {object|null}  params.profile
 * @param {boolean}      params.isAdmin
 * @param {object|null}  params.adminData
 * @param {boolean}      params.paidCache — from AuthContext.getIsPaidCached()
 * @returns {boolean} true = let user in, false = show paywall
 */
export function canAccessApp({
  profile,
  isAdmin,
  adminData = null,
  paidCache = false,
}) {
  // Admins always bypass
  if (isAdminBypass(isAdmin, adminData)) return true;

  // No profile yet
  if (!profile) return false;

  // Block suspended or hard-deleted accounts even if paid
  if (profile.account_status === "suspended") return false;
  if (profile.deleted_at) return false;

  // Session-level paid cache — once paid, always in (this session)
  if (paidCache) return true;

  return isPaidProfile(profile);
}
