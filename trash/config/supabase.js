// ============================================================================
// src/services/config/supabase.js — FINAL
//
// CRITICAL FOR PKCE / GOOGLE OAUTH:
//
//   The PKCE flow stores a "code verifier" BEFORE redirecting to Google.
//   Google then redirects back to /auth/callback on a NEW page load.
//   The code verifier MUST survive that page load — it must be in localStorage.
//
//   If storage is sessionStorage (or a custom adapter that uses it), the
//   verifier is GONE when the callback page loads → navigator.locks aborts
//   because there's nothing to exchange → "signal is aborted without reason".
//
// RULES:
//   1. storage: must use localStorage (not sessionStorage)
//   2. storageKey: custom key avoids conflicts with other Supabase projects
//   3. flowType: 'pkce' — required for OAuth + email OTP
//   4. detectSessionInUrl: true — lets Supabase auto-detect the ?code= param
//   5. ONE singleton instance — multiple createClient() calls = multiple
//      competing lock managers = guaranteed abort errors
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "[Supabase] Missing env vars. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.",
  );
}

// ── localStorage adapter ──────────────────────────────────────────────────────
// Explicit localStorage adapter ensures the code verifier survives
// the OAuth redirect (page unload → page load cycle).
// sessionStorage would lose it. This is the #1 cause of PKCE failures.
const localStorageAdapter = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, val) => {
    try {
      localStorage.setItem(key, val);
    } catch {}
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

// ── Singleton client ──────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: localStorageAdapter, // MUST be localStorage for PKCE
    storageKey: "xeevia-auth-token", // custom key, no conflicts
    flowType: "pkce", // required for OAuth + OTP
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // auto-detects ?code= on callback page
  },
});

export default supabase;
