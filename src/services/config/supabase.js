// ============================================================================
// src/services/config/supabase.js — v4 PKCE-FIRST FLOW
//
// WHAT CHANGED vs v3:
//   [A] flowType changed from "implicit" back to "pkce".
//
//       PKCE is the best modern OAuth flow for browser-based public clients.
//       It keeps the token exchange secure, avoids access token leakage,
//       and aligns with the strongest production auth model used by
//       serious platforms.
//
//       The tradeoff: the callback returns ?code= in the URL, which requires
//       the app to correctly process the redirect and exchange the code.
//       That requires robust client startup handling but is the safer path.
//
//   [B] storageKey remains "xeevia-auth-token".
//       The same storage adapter continues to support localStorage/sessionStorage
//       fallback and session persistence.
//
//   [C] Everything else (storage fallback chain, env guards, singleton
//       export) remains unchanged.
//
// RESULT: Auth now uses authorization code + PKCE, which is the secure,
//         production-grade flow for SPAs and keeps your app aligned with
//         modern OAuth best practices.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectConfig } from "../supabase/projectConfig";

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON } = getSupabaseProjectConfig("identity");

const { url: coreUrl, anonKey: coreAnon } = getSupabaseProjectConfig("core");
const { url: walletUrl, anonKey: walletAnon } = getSupabaseProjectConfig("wallet");

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "[Supabase] Missing env vars. Check IDENTITY_SUPABASE_URL/IDENTITY_SUPABASE_ANON_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY in your .env file.",
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
    flowType: "pkce", // ← Secure, modern SPA auth flow
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
