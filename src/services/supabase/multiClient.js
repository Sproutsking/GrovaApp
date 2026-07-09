import { createClient } from "@supabase/supabase-js";

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

function createSupabaseClient({ label, url, anonKey, storageKey }) {
  if (!url || !anonKey) {
    console.warn(`[Supabase][${label}] Missing URL or anon key; falling back to the identity project config.`);
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      storage: storageAdapter,
      storageKey,
      flowType: "implicit",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

const identityUrl = process.env.IDENTITY_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "";
const identityAnonKey = process.env.IDENTITY_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const coreUrl = process.env.CORE_SUPABASE_URL || identityUrl;
const coreAnonKey = process.env.CORE_SUPABASE_ANON_KEY || identityAnonKey;
const walletUrl = process.env.WALLET_SUPABASE_URL || identityUrl;
const walletAnonKey = process.env.WALLET_SUPABASE_ANON_KEY || identityAnonKey;

export const identityClient = createSupabaseClient({
  label: "identity",
  url: identityUrl,
  anonKey: identityAnonKey,
  storageKey: "xeevia-auth-token",
});

export const coreClient = createSupabaseClient({
  label: "core",
  url: coreUrl,
  anonKey: coreAnonKey,
  storageKey: "xeevia-core-auth-token",
});

export const walletClient = createSupabaseClient({
  label: "wallet",
  url: walletUrl,
  anonKey: walletAnonKey,
  storageKey: "xeevia-wallet-auth-token",
});

export function getSupabaseClient(role = "identity") {
  switch (role) {
    case "core":
      return coreClient;
    case "wallet":
      return walletClient;
    case "identity":
    default:
      return identityClient;
  }
}

export const supabase = identityClient || coreClient || walletClient;
export default supabase;
