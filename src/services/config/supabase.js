// ============================================================================
// src/services/config/supabase.js — v2 STORAGE FALLBACK
//
// PROBLEM: If localStorage is blocked (browser privacy settings, incognito,
// or certain mobile browsers), the PKCE code verifier AND the session token
// are never persisted. The session exists only in memory during that page load.
// When the edge function is called, getSession() returns the in-memory session,
// but Supabase validates it against the stored token — if they don't match or
// the token can't be verified, you get "Invalid JWT".
//
// FIX: Storage adapter with fallback chain:
//   1. localStorage (preferred — survives page reload, works for PKCE)
//   2. sessionStorage (survives tab session, not page reload)
//   3. in-memory Map (last resort — works for the current tab only)
//
// The in-memory fallback means: user stays logged in during the session,
// payment works, but they'll need to log in again after closing the tab.
// That's acceptable. A broken payment flow is not.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "[Supabase] Missing env vars. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.",
  );
}

// ── Storage adapter with fallback chain ───────────────────────────────────────
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

const hasLocalStorage   = tryLocalStorage();
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
      if (hasLocalStorage)   return localStorage.getItem(key);
      if (hasSessionStorage) return sessionStorage.getItem(key);
      return memoryStore.get(key) ?? null;
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  setItem: (key, val) => {
    try {
      if (hasLocalStorage)   { localStorage.setItem(key, val);   return; }
      if (hasSessionStorage) { sessionStorage.setItem(key, val); return; }
      memoryStore.set(key, val);
    } catch {
      memoryStore.set(key, val);
    }
  },
  removeItem: (key) => {
    try {
      if (hasLocalStorage)   { localStorage.removeItem(key);   return; }
      if (hasSessionStorage) { sessionStorage.removeItem(key); return; }
      memoryStore.delete(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

// ── Singleton client ──────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          storageAdapter,
    storageKey:       "xeevia-auth-token",
    flowType:         "pkce",
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: true,
  },
});

export default supabase;