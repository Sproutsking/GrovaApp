const PROJECT_BOUNDARIES = Object.freeze({
  identity: Object.freeze({
    label: "identity",
    purpose: "Auth, sessions, MFA, recovery, and identity-related data",
    env: {
      url: "IDENTITY_SUPABASE_URL",
      anonKey: "IDENTITY_SUPABASE_ANON_KEY",
      serviceRoleKey: "IDENTITY_SUPABASE_SERVICE_ROLE_KEY",
    },
    fallbackEnv: {
      url: "REACT_APP_SUPABASE_URL",
      anonKey: "REACT_APP_SUPABASE_ANON_KEY",
    },
    storageKey: "xeevia-auth-token",
  }),
  core: Object.freeze({
    label: "core",
    purpose: "Content, feeds, communities, profiles, and core app data",
    env: {
      url: "CORE_SUPABASE_URL",
      anonKey: "CORE_SUPABASE_ANON_KEY",
      serviceRoleKey: "CORE_SUPABASE_SERVICE_ROLE_KEY",
    },
    fallbackEnv: {
      url: "IDENTITY_SUPABASE_URL",
      anonKey: "IDENTITY_SUPABASE_ANON_KEY",
    },
    storageKey: "xeevia-core-auth-token",
  }),
  wallet: Object.freeze({
    label: "wallet",
    purpose: "Payments, ledgers, payouts, treasury, and wallet-specific data",
    env: {
      url: "WALLET_SUPABASE_URL",
      anonKey: "WALLET_SUPABASE_ANON_KEY",
      serviceRoleKey: "WALLET_SUPABASE_SERVICE_ROLE_KEY",
    },
    fallbackEnv: {
      url: "IDENTITY_SUPABASE_URL",
      anonKey: "IDENTITY_SUPABASE_ANON_KEY",
    },
    storageKey: "xeevia-wallet-auth-token",
  }),
});

export function getProjectBoundary(role = "identity") {
  const normalizedRole = String(role || "identity").toLowerCase();
  return PROJECT_BOUNDARIES[normalizedRole] || PROJECT_BOUNDARIES.identity;
}

export function getProjectEnvConfig(role = "identity", env = process.env) {
  const boundary = getProjectBoundary(role);

  return {
    label: boundary.label,
    purpose: boundary.purpose,
    url: env[boundary.env.url] || env[boundary.fallbackEnv.url] || "",
    anonKey: env[boundary.env.anonKey] || env[boundary.fallbackEnv.anonKey] || "",
    serviceRoleKey: env[boundary.env.serviceRoleKey] || "",
    storageKey: boundary.storageKey,
  };
}

export function getProjectRoles() {
  return Object.keys(PROJECT_BOUNDARIES);
}

export { PROJECT_BOUNDARIES };
export default PROJECT_BOUNDARIES;
