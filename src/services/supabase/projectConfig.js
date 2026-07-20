const getRuntimeEnv = () => {
  if (typeof window === "undefined") return {};
  return window._env_ || {};
};

const getMeta = (name) => {
  try {
    if (typeof document === "undefined") return undefined;
    var m = document.querySelector('meta[name="' + name + '"]');
    return m ? m.getAttribute('content') : undefined;
  } catch {
    return undefined;
  }
};

const runtimeEnv = getRuntimeEnv();
const runtimeLegacySupabaseUrl = typeof window !== "undefined" ? window.__SUPABASE_URL__ || getMeta('xeevia:supabase-url') || "" : "";

const identityUrl =
  runtimeEnv.IDENTITY_SUPABASE_URL ||
  runtimeEnv.REACT_APP_IDENTITY_SUPABASE_URL ||
  runtimeEnv.REACT_APP_SUPABASE_URL ||
  runtimeEnv.NEXT_PUBLIC_SUPABASE_URL ||
  runtimeLegacySupabaseUrl ||
  getMeta('xeevia:identity-supabase-url') ||
  process.env.IDENTITY_SUPABASE_URL ||
  process.env.REACT_APP_IDENTITY_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const identityAnonKey =
  runtimeEnv.IDENTITY_SUPABASE_ANON_KEY ||
  runtimeEnv.REACT_APP_IDENTITY_SUPABASE_ANON_KEY ||
  runtimeEnv.REACT_APP_SUPABASE_ANON_KEY ||
  runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  getMeta('xeevia:identity-supabase-anon') ||
  process.env.IDENTITY_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_IDENTITY_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const coreUrl =
  runtimeEnv.CORE_SUPABASE_URL ||
  runtimeEnv.REACT_APP_CORE_SUPABASE_URL ||
  runtimeEnv.NEXT_PUBLIC_CORE_SUPABASE_URL ||
  getMeta('xeevia:core-supabase-url') ||
  process.env.CORE_SUPABASE_URL ||
  process.env.REACT_APP_CORE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_CORE_SUPABASE_URL ||
  identityUrl;

const coreAnonKey =
  runtimeEnv.CORE_SUPABASE_ANON_KEY ||
  runtimeEnv.REACT_APP_CORE_SUPABASE_ANON_KEY ||
  runtimeEnv.NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY ||
  getMeta('xeevia:core-supabase-anon') ||
  process.env.CORE_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_CORE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY ||
  identityAnonKey;

const walletUrl =
  runtimeEnv.WALLET_SUPABASE_URL ||
  runtimeEnv.REACT_APP_WALLET_SUPABASE_URL ||
  runtimeEnv.NEXT_PUBLIC_WALLET_SUPABASE_URL ||
  getMeta('xeevia:wallet-supabase-url') ||
  process.env.WALLET_SUPABASE_URL ||
  process.env.REACT_APP_WALLET_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_WALLET_SUPABASE_URL ||
  identityUrl;

const walletAnonKey =
  runtimeEnv.WALLET_SUPABASE_ANON_KEY ||
  runtimeEnv.REACT_APP_WALLET_SUPABASE_ANON_KEY ||
  runtimeEnv.NEXT_PUBLIC_WALLET_SUPABASE_ANON_KEY ||
  getMeta('xeevia:wallet-supabase-anon') ||
  process.env.WALLET_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_WALLET_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_WALLET_SUPABASE_ANON_KEY ||
  identityAnonKey;

export function getSupabaseProjectConfig(role = "identity") {
  switch (role) {
    case "core":
      if (typeof window !== "undefined" && (window.__XEEVIA_DEBUG__ || process.env.NODE_ENV !== "production")) {
        try {
          // Avoid printing full anon keys in logs
          const anonPreview = coreAnonKey ? `${String(coreAnonKey).slice(0,4)}...` : "(none)";
          console.debug(`[supabase] role=core url=${coreUrl} anon=${anonPreview}`);
        } catch (e) {}
      }
      return { url: coreUrl, anonKey: coreAnonKey };
    case "wallet":
      if (typeof window !== "undefined" && (window.__XEEVIA_DEBUG__ || process.env.NODE_ENV !== "production")) {
        try {
          const anonPreview = walletAnonKey ? `${String(walletAnonKey).slice(0,4)}...` : "(none)";
          console.debug(`[supabase] role=wallet url=${walletUrl} anon=${anonPreview}`);
        } catch (e) {}
      }
      return { url: walletUrl, anonKey: walletAnonKey };
    case "identity":
    default:
      if (typeof window !== "undefined" && (window.__XEEVIA_DEBUG__ || process.env.NODE_ENV !== "production")) {
        try {
          const anonPreview = identityAnonKey ? `${String(identityAnonKey).slice(0,4)}...` : "(none)";
          console.debug(`[supabase] role=identity url=${identityUrl} anon=${anonPreview}`);
        } catch (e) {}
      }
      return { url: identityUrl, anonKey: identityAnonKey };
  }
}

export function getSupabaseProjectUrl(role = "identity") {
  return getSupabaseProjectConfig(role).url;
}

export function getSupabaseProjectAnonKey(role = "identity") {
  return getSupabaseProjectConfig(role).anonKey;
}

export function getSupabaseProjectFunctionUrl(role = "identity", functionName = "") {
  const baseUrl = getSupabaseProjectUrl(role).replace(/\/$/, "");
  if (!baseUrl) return "";
  if (!functionName) return `${baseUrl}/functions/v1`;
  return `${baseUrl}/functions/v1/${String(functionName).replace(/^\/+/, "")}`;
}

export const supabaseProjectConfig = {
  identity: getSupabaseProjectConfig("identity"),
  core: getSupabaseProjectConfig("core"),
  wallet: getSupabaseProjectConfig("wallet"),
};

export default supabaseProjectConfig;
