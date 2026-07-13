import { createClient } from "@supabase/supabase-js";
import { getProjectEnvConfig } from "./projectBoundaries";

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
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

const identityConfig = getProjectEnvConfig("identity", process.env);
const coreConfig = getProjectEnvConfig("core", process.env);
const walletConfig = getProjectEnvConfig("wallet", process.env);

export const identityClient = createSupabaseClient({
  label: identityConfig.label,
  url: identityConfig.url,
  anonKey: identityConfig.anonKey,
  storageKey: identityConfig.storageKey,
});

export const coreClient = createSupabaseClient({
  label: coreConfig.label,
  url: coreConfig.url,
  anonKey: coreConfig.anonKey,
  storageKey: coreConfig.storageKey,
});

export const walletClient = createSupabaseClient({
  label: walletConfig.label,
  url: walletConfig.url,
  anonKey: walletConfig.anonKey,
  storageKey: walletConfig.storageKey,
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
