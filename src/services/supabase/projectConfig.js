const identityUrl = process.env.IDENTITY_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "";
const identityAnonKey = process.env.IDENTITY_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const coreUrl = process.env.CORE_SUPABASE_URL || identityUrl;
const coreAnonKey = process.env.CORE_SUPABASE_ANON_KEY || identityAnonKey;
const walletUrl = process.env.WALLET_SUPABASE_URL || identityUrl;
const walletAnonKey = process.env.WALLET_SUPABASE_ANON_KEY || identityAnonKey;

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

export const supabaseProjectConfig = {
  identity: getSupabaseProjectConfig("identity"),
  core: getSupabaseProjectConfig("core"),
  wallet: getSupabaseProjectConfig("wallet"),
};

export default supabaseProjectConfig;
