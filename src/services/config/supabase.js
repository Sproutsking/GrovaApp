// ============================================================================
// src/services/config/supabase.js — v4 PKCE FLOW
//
// WHAT CHANGED vs v2:
//   [A] OAuth uses the PKCE authorization-code flow.
//
//       PKCE flow works like this:
//         1. App generates a code_verifier + code_challenge
//         2. Supabase redirects back with ?code= in the URL
//         3. App exchanges ?code= for a session via a network round-trip
//         4. If the Service Worker intercepts step 2 before Supabase JS
//            can read the ?code=, the exchange never happens → stuck splash
//
//       PKCE keeps access tokens out of the authorization URL and exchanges a
//       short-lived code using a browser-held verifier before creating a session.
//       This is the recommended flow for modern browser applications.
//
//   [B] storageKey kept as "xeevia-auth-token" — no migration needed.
//       Implicit flow still uses the same storage adapter for persistence.
//
//   [C] Everything else (storage fallback chain, env guards, singleton
//       export) is identical to v2. No other files need to change.
//
// RESULT: OAuth returns with a short-lived ?code= value. AuthContext waits for
//         Supabase JS to complete the exchange, then removes it from the URL.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "[Supabase] Missing env vars. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.",
  );
}

// ── Storage adapter with fallback chain ───────────────────────────────────────
// If localStorage is blocked (privacy settings, incognito, some mobile
// browsers), we fall back gracefully rather than breaking the auth flow.
//   1. localStorage  — survives page reload (preferred)
//   2. sessionStorage — survives tab session only
//   3. in-memory Map  — survives current JS context only (last resort)
const memoryStore = new Map();

function tryLocalStorage() {
  try {
    localStorage.setItem("__xv_test__", "1");
    localStorage.removeItem("__xv_test__");
    return true;
  } catch {
    return false;
  }
}

function trySessionStorage() {
  try {
    sessionStorage.setItem("__xv_test__", "1");
    sessionStorage.removeItem("__xv_test__");
    return true;
  } catch {
    return false;
  }
}

const hasLocalStorage = tryLocalStorage();
const hasSessionStorage = trySessionStorage();

if (!hasLocalStorage) {
  console.warn(
    "[Supabase] localStorage unavailable — falling back to " +
      (hasSessionStorage ? "sessionStorage" : "in-memory storage") +
      ". Sessions will not persist across page reloads.",
  );
}

const storageAdapter = {
  getItem: (key) => {
    try {
      if (hasLocalStorage) return localStorage.getItem(key);
      if (hasSessionStorage) return sessionStorage.getItem(key);
      return memoryStore.get(key) ?? null;
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  setItem: (key, val) => {
    try {
      if (hasLocalStorage) {
        localStorage.setItem(key, val);
        return;
      }
      if (hasSessionStorage) {
        sessionStorage.setItem(key, val);
        return;
      }
      memoryStore.set(key, val);
    } catch {
      memoryStore.set(key, val);
    }
  },
  removeItem: (key) => {
    try {
      if (hasLocalStorage) {
        localStorage.removeItem(key);
        return;
      }
      if (hasSessionStorage) {
        sessionStorage.removeItem(key);
        return;
      }
      memoryStore.delete(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

// ── Singleton client ──────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: storageAdapter,
    storageKey: "xeevia-auth-token",
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
