const getRuntimeEnv = () => {
  if (typeof window === "undefined") return {};
  return window._env_ || {};
};

const runtimeEnv = getRuntimeEnv();
const runtimeLegacySupabaseUrl = typeof window !== "undefined" ? window.__SUPABASE_URL__ || "" : "";

const identityUrl =
  runtimeEnv.IDENTITY_SUPABASE_URL ||
  runtimeEnv.REACT_APP_IDENTITY_SUPABASE_URL ||
  runtimeEnv.REACT_APP_SUPABASE_URL ||
  runtimeEnv.NEXT_PUBLIC_SUPABASE_URL ||
  runtimeLegacySupabaseUrl ||
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
  process.env.IDENTITY_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_IDENTITY_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const coreUrl =
  runtimeEnv.CORE_SUPABASE_URL ||
  runtimeEnv.REACT_APP_CORE_SUPABASE_URL ||
  runtimeEnv.NEXT_PUBLIC_CORE_SUPABASE_URL ||
  process.env.CORE_SUPABASE_URL ||
  process.env.REACT_APP_CORE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_CORE_SUPABASE_URL ||
  identityUrl;

const coreAnonKey =
  runtimeEnv.CORE_SUPABASE_ANON_KEY ||
  runtimeEnv.REACT_APP_CORE_SUPABASE_ANON_KEY ||
  runtimeEnv.NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY ||
  process.env.CORE_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_CORE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_CORE_SUPABASE_ANON_KEY ||
  identityAnonKey;

const walletUrl =
  runtimeEnv.WALLET_SUPABASE_URL ||
  runtimeEnv.REACT_APP_WALLET_SUPABASE_URL ||
  runtimeEnv.NEXT_PUBLIC_WALLET_SUPABASE_URL ||
  process.env.WALLET_SUPABASE_URL ||
  process.env.REACT_APP_WALLET_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_WALLET_SUPABASE_URL ||
  identityUrl;

const walletAnonKey =
  runtimeEnv.WALLET_SUPABASE_ANON_KEY ||
  runtimeEnv.REACT_APP_WALLET_SUPABASE_ANON_KEY ||
  runtimeEnv.NEXT_PUBLIC_WALLET_SUPABASE_ANON_KEY ||
  process.env.WALLET_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_WALLET_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_WALLET_SUPABASE_ANON_KEY ||
  identityAnonKey;

export function getSupabaseProjectConfig(role = "identity") {
  switch (role) {
    case "core":
      return { url: coreUrl, anonKey: coreAnonKey };
    case "wallet":
      return { url: walletUrl, anonKey: walletAnonKey };
    case "identity":
    default:
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
