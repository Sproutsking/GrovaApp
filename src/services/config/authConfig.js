// ============================================================================
// src/services/config/authConfig.js  — DYNAMIC ORIGIN RESOLVER
//
// PROBLEM SOLVED:
//   Hardcoding localhost:3000 breaks on port 3001, 3002, 3003, staging, prod.
//   Supabase needs to know where to redirect BACK TO after OAuth.
//   The redirect URL must be whitelisted in Supabase dashboard — but we can
//   whitelist a PATTERN, and dynamically build the URL from window.location.
//
// HOW IT WORKS:
//   getCallbackUrl() reads window.location.origin at CALL TIME.
//   → localhost:3000  →  http://localhost:3000/auth/callback
//   → localhost:3001  →  http://localhost:3001/auth/callback
//   → localhost:3002  →  http://localhost:3002/auth/callback
//   → xeevia.com      →  https://xeevia.com/auth/callback
//
// SUPABASE DASHBOARD — Add ALL of these to "Redirect URLs":
//   http://localhost:3000/auth/callback
//   http://localhost:3001/auth/callback
//   http://localhost:3002/auth/callback
//   http://localhost:3003/auth/callback
//   https://yourdomain.com/auth/callback
//   (Or use wildcard if your Supabase plan allows: http://localhost:*/auth/callback)
//
// This file is the SINGLE SOURCE OF TRUTH for all auth-related URLs.
// Import getCallbackUrl() anywhere you need it — never hardcode again.
// ============================================================================

/**
 * Returns the full OAuth callback URL based on the current window origin.
 * Always call this at runtime (inside functions), never at module load time,
 * so it captures the actual running port.
 *
 * @returns {string} e.g. "http://localhost:3001/auth/callback"
 */
export function getCallbackUrl() {
  try {
    return `${window.location.origin}/auth/callback`;
  } catch {
    // SSR / non-browser fallback
    return "http://localhost:3000/auth/callback";
  }
}

/**
 * Returns the app root URL (for post-auth redirects).
 * @returns {string} e.g. "http://localhost:3001/"
 */
export function getAppRoot() {
  try {
    return `${window.location.origin}/`;
  } catch {
    return "http://localhost:3000/";
  }
}

/**
 * Returns true if running on localhost (any port).
 * Useful for debug logging, dev-only features.
 */
export function isLocalhost() {
  try {
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

/**
 * Returns the current port number (number, or 80/443 if implicit).
 */
export function getCurrentPort() {
  try {
    const port = window.location.port;
    if (port) return parseInt(port, 10);
    return window.location.protocol === "https:" ? 443 : 80;
  } catch {
    return 3000;
  }
}
