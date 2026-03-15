// ============================================================================
// src/services/auth/paymentGate.js — v6 PRODUCTION FINAL
// ============================================================================
//
// SINGLE SOURCE OF TRUTH for payment/access checks.
//
// CHANGES vs v5:
//   [1] CRITICAL FIX: Removed circular import of isPaidProfileData from
//       AuthContext. That import resolves to undefined at module init time
//       because AuthContext itself hasn't finished evaluating — causing every
//       isPaidProfile() call to return false and blocking ALL users permanently.
//       isPaidProfile() is now 100% self-contained with no external imports.
//   [2] isPaidProfile() checks ALL activation signals written by activateAccount():
//         • account_activated === true          (primary flag, always written)
//         • payment_status in paid/vip/free     ("free" = admin-granted free access)
//         • subscription_tier not free/pending  (legacy tier-based fallback)
//   [3] isPaidProfileData re-exported as alias so AuthContext and any legacy
//       code that imports it by that name continue to work unchanged.
//   [4] canAccessApp() + isAdminBypass() logic unchanged from v5.
//
// HOW THE PAYWALL WORKS (complete flow):
//   1. User lands → AppRouter checks loading state → shows Splash
//   2. Auth resolves → if no user → AuthWall (login screen)
//   3. User logs in → profile fetched → canAccessApp() checked
//   4. If not paid → AuthWall with paywall=true → PaywallGate shown
//   5. User pays/activates → edge function writes:
//        account_activated = true
//        payment_status    = "paid" | "free"
//        subscription_tier = "standard" | "vip" | etc.
//      → refreshProfile() called on frontend
//   6. Profile reloaded → isPaidProfile() returns true → paidCacheRef = true
//   7. App renders → PaywallGate never shown again this session
//   8. On next login → fresh profile fetch → isPaidProfile() still true (DB updated)
//
// NOTE FOR AuthContext.js:
//   If AuthContext currently imports isPaidProfileData from AuthContext itself,
//   change that import to:
//     import { isPaidProfileData } from '../services/auth/paymentGate';
//   This file has zero imports, so there is no circular dependency.
// ============================================================================

/**
 * Returns true if the user's profile shows they have paid / been activated.
 *
 * Checks every field that activateAccount() sets in _shared/payments.ts:
 *   account_activated  — set true on every activation path (paid + free)
 *   payment_status     — "paid" | "vip" | "free"  ("free" = invite free grant)
 *   subscription_tier  — anything other than "free" or "pending"
 *
 * This function has NO imports and cannot cause circular dependency issues.
 *
 * @param {object|null} profile — Supabase profiles row
 * @returns {boolean}
 */
export function isPaidProfile(profile) {
  if (!profile) return false;

  // Primary flag — always written by activateAccount() on every path
  if (profile.account_activated === true) return true;

  // Payment status check — "free" is critical: covers invite-code free access
  if (["paid", "vip", "free"].includes(profile.payment_status)) return true;

  // Tier-based legacy fallback — any non-default tier means access was granted
  if (
    profile.subscription_tier &&
    !["free", "pending"].includes(profile.subscription_tier)
  )
    return true;

  return false;
}

/**
 * Alias for legacy code that imports isPaidProfileData from AuthContext or elsewhere.
 * Functionally identical to isPaidProfile — use whichever name is already in your code.
 */
export const isPaidProfileData = isPaidProfile;

/**
 * Returns true if the admin should bypass the payment gate entirely.
 * Any admin level always has full access — never gets paywalled.
 *
 * @param {boolean}      isAdmin
 * @param {object|null}  adminData — from AuthContext (optional)
 * @returns {boolean}
 */
export function isAdminBypass(isAdmin, adminData = null) {
  if (isAdmin === true) return true;
  // Belt-and-suspenders: check roleLevel from adminData if isAdmin flag is wrong
  if (adminData && adminData.roleLevel > 0) return true;
  return false;
}

/**
 * Full gate check — use this in AppRouter to decide whether to show the paywall.
 *
 * Evaluation order:
 *   1. Admin bypass  → admins always get in regardless of payment status
 *   2. No profile    → not loaded yet, deny
 *   3. Account status → block suspended/deleted accounts even if paid
 *   4. Session cache → once paid mid-session, never re-check DB
 *   5. isPaidProfile → live check against the profile row
 *
 * @param {object}       params
 * @param {object|null}  params.profile    — Supabase profiles row
 * @param {boolean}      params.isAdmin    — from AuthContext
 * @param {object|null}  params.adminData  — from AuthContext (optional)
 * @param {boolean}      params.paidCache  — from AuthContext.getIsPaidCached()
 * @returns {boolean} true = let user into app, false = show paywall
 */
export function canAccessApp({
  profile,
  isAdmin,
  adminData = null,
  paidCache = false,
}) {
  // 1. Admins always bypass
  if (isAdminBypass(isAdmin, adminData)) return true;

  // 2. Profile not yet loaded
  if (!profile) return false;

  // 3. Hard blocks — suspended or soft-deleted accounts never get in
  if (profile.account_status === "suspended") return false;
  if (profile.deleted_at) return false;

  // 4. Session-level paid cache — once the user has paid this session,
  //    never re-check even if a profile re-fetch returns stale data
  if (paidCache) return true;

  // 5. Live check
  return isPaidProfile(profile);
}
