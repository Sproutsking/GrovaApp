// =============================================================================
// src/lib/supabaseClient.js
// =============================================================================
//
// Single Supabase client instance + auth helpers used by every component
// that needs to call a Supabase edge function.
//
// KEY EXPORTS
//   supabase          — the Supabase client (unchanged from before)
//   getAuthHeaders()  — async; returns fresh auth headers, auto-refreshes token
//   callEdgeFunction()— async; wraps fetch with headers, retry, error parsing
//
// WHY THIS EXISTS
//   Before this file, every component built its own fetch headers. Some forgot
//   the Authorization header, some used a cached (possibly expired) token.
//   This caused the "Not authenticated" error in PaywallGate.handleFreeActivate.
//   All edge function calls MUST now go through callEdgeFunction().
// =============================================================================

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// 1. Supabase client singleton
// ---------------------------------------------------------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
      "Check your .env file.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------
// 2. getAuthHeaders()
//    Returns a headers object ready to pass to fetch().
//    Automatically refreshes the token if it's within 60 seconds of expiry.
//
//    Usage:
//      const headers = await getAuthHeaders();
//      const res = await fetch(url, { method: "POST", headers, body: ... });
// ---------------------------------------------------------------------------
export async function getAuthHeaders() {
  // Get the current session — never use a cached variable; always read live
  let { data: sessionData, error } = await supabase.auth.getSession();

  if (error) {
    console.error("[getAuthHeaders] getSession error:", error.message);
    throw new Error("AUTH_SESSION_ERROR");
  }

  let session = sessionData?.session;

  // If no session at all, there is nothing we can do here — caller must handle
  if (!session) {
    console.warn("[getAuthHeaders] No active session found.");
    throw new Error("AUTH_NO_SESSION");
  }

  // Auto-refresh if within 60 seconds of expiry (or already expired)
  const expiresAt = session.expires_at; // Unix timestamp (seconds)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = expiresAt - nowSeconds;

  if (secondsUntilExpiry < 60) {
    console.info(
      "[getAuthHeaders] Token expiring soon — refreshing session...",
    );
    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshError || !refreshData.session) {
      console.error(
        "[getAuthHeaders] Session refresh failed:",
        refreshError?.message,
      );
      throw new Error("AUTH_REFRESH_FAILED");
    }
    session = refreshData.session;
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

// ---------------------------------------------------------------------------
// 3. callEdgeFunction(name, body, options)
//    The SINGLE way to call a Supabase edge function from the client.
//    Handles: auth headers, JSON serialisation, retry on token expiry,
//    structured error parsing, user-friendly error messages.
//
//    @param {string}  name          — function name, e.g. "activate-account"
//    @param {object}  body          — JSON body (will be stringified)
//    @param {object}  [options]
//    @param {number}  [options.maxRetries=3]   — total attempts (including first)
//    @param {number}  [options.retryDelayMs=800] — base delay between retries
//    @param {string}  [options.method="POST"]
//
//    @returns {object} — parsed JSON response body
//    @throws  {EdgeFunctionError} — { code, message, status }
// ---------------------------------------------------------------------------
export class EdgeFunctionError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "EdgeFunctionError";
    this.code = code; // e.g. "AUTH_EXPIRED", "ALREADY_ACTIVATED"
    this.status = status; // HTTP status code
  }
}

// Maps server error codes to user-friendly messages
const ERROR_MESSAGES = {
  AUTH_EXPIRED: "Your session expired. Please wait while we reconnect...",
  AUTH_REFRESH_FAILED:
    "Your session could not be refreshed. Please log in again.",
  AUTH_NO_SESSION: "You are not signed in. Please log in to continue.",
  AUTH_INVALID: "Your session is invalid. Please log in again.",
  ALREADY_ACTIVATED: null, // Not an error — treat as success
  INVALID_CODE: "This invite code is invalid.",
  CODE_EXPIRED: "This invite link has expired.",
  CODE_MAX_USES: "This invite link has reached its usage limit.",
  CODE_INACTIVE: "This invite code is no longer active.",
  PROFILE_NOT_FOUND:
    "Your account profile could not be found. Please contact support.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
};

export async function callEdgeFunction(name, body = {}, options = {}) {
  const { maxRetries = 3, retryDelayMs = 800, method = "POST" } = options;

  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let headers;

    try {
      headers = await getAuthHeaders();
    } catch (authErr) {
      // If we can't get headers at all, no point retrying
      const code = authErr.message || "AUTH_NO_SESSION";
      throw new EdgeFunctionError(
        code,
        ERROR_MESSAGES[code] ?? "Authentication failed. Please log in.",
        401,
      );
    }

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: method !== "GET" ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      console.warn(
        `[callEdgeFunction] Network error (attempt ${attempt}):`,
        networkErr.message,
      );
      lastError = new EdgeFunctionError(
        "NETWORK_ERROR",
        "Network error. Please check your connection and try again.",
        0,
      );
      if (attempt < maxRetries) {
        await delay(retryDelayMs * attempt);
        continue;
      }
      throw lastError;
    }

    // 409 = already activated — idempotent, treat as success
    if (response.status === 409) {
      let json = {};
      try {
        json = await response.json();
      } catch (_) {}
      if (json.error === "ALREADY_ACTIVATED") {
        console.info(
          "[callEdgeFunction] Already activated — treating as success.",
        );
        return json;
      }
    }

    // Auth errors that may be recoverable via refresh
    if (response.status === 401) {
      const json = await safeParseJson(response);
      const code = json?.error ?? "AUTH_EXPIRED";

      if (code === "AUTH_EXPIRED" && attempt < maxRetries) {
        console.info(
          `[callEdgeFunction] Auth expired — refreshing and retrying (attempt ${attempt})...`,
        );
        try {
          const { error: refreshErr } = await supabase.auth.refreshSession();
          if (refreshErr) throw refreshErr;
        } catch (refreshErr) {
          throw new EdgeFunctionError(
            "AUTH_REFRESH_FAILED",
            ERROR_MESSAGES.AUTH_REFRESH_FAILED,
            401,
          );
        }
        await delay(retryDelayMs);
        continue;
      }

      // AUTH_INVALID or refresh exhausted
      throw new EdgeFunctionError(
        code,
        ERROR_MESSAGES[code] ?? "Authentication failed.",
        401,
      );
    }

    // 403 = invalid session — must re-login, no retry
    if (response.status === 403) {
      const json = await safeParseJson(response);
      const code = json?.error ?? "AUTH_INVALID";
      throw new EdgeFunctionError(
        code,
        ERROR_MESSAGES[code] ?? "Access denied. Please log in again.",
        403,
      );
    }

    // Other non-2xx
    if (!response.ok) {
      const json = await safeParseJson(response);
      const code = json?.error ?? "INTERNAL_ERROR";
      const msg = ERROR_MESSAGES[code] ?? json?.message ?? "An error occurred.";

      // Some errors are not worth retrying
      const noRetry = [
        "INVALID_CODE",
        "CODE_EXPIRED",
        "CODE_MAX_USES",
        "CODE_INACTIVE",
        "PROFILE_NOT_FOUND",
      ];
      if (noRetry.includes(code) || attempt >= maxRetries) {
        throw new EdgeFunctionError(code, msg, response.status);
      }

      lastError = new EdgeFunctionError(code, msg, response.status);
      console.warn(
        `[callEdgeFunction] Error ${code} (attempt ${attempt}) — retrying...`,
      );
      await delay(retryDelayMs * attempt);
      continue;
    }

    // Success
    const json = await safeParseJson(response);
    return json;
  }

  throw (
    lastError ??
    new EdgeFunctionError("UNKNOWN_ERROR", "An unexpected error occurred.", 500)
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function safeParseJson(response) {
  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
