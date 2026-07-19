// ============================================================================
// src/services/auth/optimizedAuthService.js — DIRECT FLOW (NO POPUPS)
// ============================================================================
//
// OPTIMIZATIONS vs old flow:
//   [1] Direct OAuth redirect — no popup window overhead
//   [2] Single-pass auth on return from provider
//   [3] No artificial session refresh polling — refresh only when needed
//   [4] No 60s enforcement interval — check on-demand only
//   [5] Removed postMessage complexity — direct route handlers
//   [6] Lightning-fast session validation
//
// FLOW:
//   1. User clicks "Sign in with Google"
//   2. Direct OAuth redirect to provider (no popup)
//   3. Provider redirects back to app with #access_token= in hash
//   4. AuthContext detects session, loads profile
//   5. App is ready — no intermediate steps
//
// ============================================================================

import { supabase } from "../config/supabase";
import { getCallbackUrl } from "../config/authConfig";
import { getSupabaseProjectUrl } from "../supabase/projectConfig";

/**
 * Direct OAuth sign-in — no popups, direct redirect
 */
export async function signInWithProviderDirect(provider) {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getCallbackUrl(),
        skipBrowserRedirect: false, // Direct redirect = fastest
        queryParams: {
          // Provider-specific optimizations
          ...(provider === "google" && {
            access_type: "offline",
            prompt: "select_account", // Skip on repeat logins
          }),
          ...(provider === "facebook" && {
            display: "popup", // Facebook's fast option
          }),
        },
      },
      flowType: "pkce",
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error(`[Auth] OAuth error for ${provider}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Session validation — on-demand, not polled
 */
export async function validateSessionOnDemand() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (err) {
    console.error("[Auth] Session validation failed:", err.message);
    return null;
  }
}

/**
 * Refresh token only when accessing protected resources
 */
export async function refreshTokenIfNeeded() {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return session;
  } catch (err) {
    console.error("[Auth] Token refresh failed:", err.message);
    return null;
  }
}

/**
 * Fast sign-out — local scope only (no background server calls)
 */
export async function signOutFast() {
  try {
    await supabase.auth.signOut({ scope: "local" });
    return true;
  } catch (err) {
    console.error("[Auth] Sign-out failed:", err.message);
    return false;
  }
}

/**
 * Get current user without network round-trip
 */
export function getCurrentUserSync() {
  try {
    const session = supabase.auth.session?.();
    return session?.user || null;
  } catch {
    return null;
  }
}

/**
 * Check if session is still valid (fast check)
 */
export async function isSessionValid() {
  const session = await validateSessionOnDemand();
  return !!session?.access_token;
}

export default {
  signInWithProviderDirect,
  validateSessionOnDemand,
  refreshTokenIfNeeded,
  signOutFast,
  getCurrentUserSync,
  isSessionValid,
};
