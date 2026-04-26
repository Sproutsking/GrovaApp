// supabase/functions/_shared/payments.ts  —  v14 CORS_FIX
// ============================================================================
//  WHAT CHANGED vs v13:
//
//  [CORS FIX] ALLOWED_ORIGIN was stored as a hashed/encoded secret value,
//  not a plain URL. Deno.env.get("ALLOWED_ORIGIN") returned garbage, so
//  every edge function was sending a broken Access-Control-Allow-Origin
//  header, blocking ALL requests from localhost AND production.
//
//  Fix: corsHeaders is now a FUNCTION (getCorsHeaders) that:
//    1. Reads the Origin header from the incoming request
//    2. Explicitly allows localhost:* and 127.0.0.1:* in development
//    3. Falls back to ALLOWED_ORIGIN env var for production
//    4. Falls back to "*" if ALLOWED_ORIGIN is missing or looks invalid
//       (i.e. not a URL starting with http)
//
//  The old static `corsHeaders` export is kept as a fallback alias for
//  webhook endpoints (Paystack, Web3) that receive requests from external
//  servers where CORS doesn't apply.
//
//  HOW TO USE IN EVERY EDGE FUNCTION:
//
//    import { getCorsHeaders, ... } from "../_shared/payments.ts";
//
//    Deno.serve(async (req) => {
//      const headers = getCorsHeaders(req);          // ← pass req
//      if (req.method === "OPTIONS") {
//        return new Response(null, { status: 200, headers });
//      }
//      // use `headers` in every response you return
//    });
//
//  DEPLOYMENT CHECKLIST:
//  ─────────────────────────────────────────────────────────────────────────
//  supabase secrets set --project-ref <ref> \
//    SUPABASE_URL="https://<ref>.supabase.co" \
//    SUPABASE_SERVICE_ROLE_KEY="<service_role>" \
//    PAYSTACK_SECRET_KEY="sk_live_..." \
//    ALLOWED_ORIGIN="https://yourdomain.com"     ← plain URL, NOT hashed
//    TREASURY_WALLET_ADDRESS="0x..."
//    TREASURY_WALLET_SOL="<solana_address>"
//    TREASURY_WALLET_ADA="addr1..."
//    POLYGON_RPC_URL="https://polygon-rpc.com"
//    ...etc
//
//  ⚠️  ALLOWED_ORIGIN must be a plain URL like "https://xeevia.com"
//      Do NOT use a hashed or encoded value — Deno reads it as a raw string.
//
//  ⚠️  There is NO separate PAYSTACK_WEBHOOK_SECRET.
//      Paystack signs webhooks using PAYSTACK_SECRET_KEY via HMAC-SHA512.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── 1. Typed AuthError ────────────────────────────────────────────────────────
export class AuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

// ── 2. CORS — request-aware ───────────────────────────────────────────────────
//
// getCorsHeaders(req) reads the incoming Origin header and returns the
// correct Access-Control-Allow-Origin for that request.
//
// Priority:
//   1. localhost / 127.0.0.1 / 192.168.x.x  → echo back the origin (dev)
//   2. ALLOWED_ORIGIN env var (if it looks like a URL) → use it
//   3. Fallback                              → "*"
//
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "";

  const isLocalhost =
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin);

  // Only trust ALLOWED_ORIGIN if it actually looks like a URL.
  // The old secret was a hashed value — this guard prevents that mistake.
  const rawEnv        = Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const envOriginSafe = rawEnv.startsWith("http") ? rawEnv : "*";

  const allowedOrigin = isLocalhost ? origin : envOriginSafe;

  return {
    "Access-Control-Allow-Origin":      allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-paystack-signature",
    "Access-Control-Allow-Methods":     "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": isLocalhost ? "true" : "false",
    "Vary":                             "Origin",
  };
}

// Legacy static alias — safe for webhook handlers (no browser CORS needed).
// For all user-facing edge functions, use getCorsHeaders(req) instead.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ── 3. Env validator ──────────────────────────────────────────────────────────
// Call FIRST in every edge function handler.
// Returns a Response on failure — use as:
//   const bad = validateEnv([...]); if (bad) return bad;
// Returns null on success.
export function validateEnv(required: string[]): Response | null {
  const missing = required.filter((k) => {
    const v = Deno.env.get(k);
    return !v || !v.trim();
  });
  if (missing.length === 0) return null;

  console.error(
    `[validateEnv] MISSING SECRETS: ${missing.join(", ")}\n` +
    `Fix: Supabase Dashboard → Edge Functions → Secrets → add these keys.\n` +
    `Without SUPABASE_SERVICE_ROLE_KEY every auth call returns "Invalid JWT".`,
  );

  return new Response(
    JSON.stringify({
      error: `Server misconfiguration: missing [${missing.join(", ")}]. Contact support.`,
      code:  "SERVER_MISCONFIGURED",
    }),
    {
      status:  500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// ── 4. Admin client FACTORY ───────────────────────────────────────────────────
// NEVER cache at module level. Fresh per call so env vars are always current.
export const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

// ── 5. Response helpers ───────────────────────────────────────────────────────
export function jsonResponse(
  data:    unknown,
  status = 200,
  req?:    Request,
): Response {
  const headers = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status  = 400,
  code    = "ERROR",
  req?:    Request,
): Response {
  return jsonResponse({ error: message, code }, status, req);
}

// ── 6. requireAuth ────────────────────────────────────────────────────────────
//
// ERROR CODE CONTRACT (frontend reads data.code from error body):
//   SERVER_MISCONFIGURED → admin must set secrets in Supabase dashboard
//   SESSION_EXPIRED      → user must sign out and sign back in
//   AUTH_MISSING         → no Authorization header sent
//   AUTH_ERROR           → other Supabase auth error
//   UNAUTHORIZED         → invalid internal token
//
// INTERNAL CALL:
//   Pass isInternalCall=true + the service role key as Bearer token.
//   Returns { userId: bodyUserId ?? "internal" }.
//
export async function requireAuth(
  req:            Request,
  isInternalCall = false,
  bodyUserId?:    string,
): Promise<{ userId: string; email: string }> {

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error(
      `[requireAuth] MISSING SECRETS — URL:${supabaseUrl ? "ok" : "MISSING"} ` +
      `KEY:${serviceKey ? "ok" : "MISSING"}`,
    );
    throw new AuthError(
      "Payment service is misconfigured (missing server secrets). Contact support.",
      "SERVER_MISCONFIGURED",
    );
  }

  const authHeader = (req.headers.get("Authorization") ?? "").trim();
  if (!authHeader.startsWith("Bearer ")) {
    throw new AuthError("No auth token provided. Please sign in.", "AUTH_MISSING");
  }
  const token = authHeader.slice(7).trim();
  if (token.length < 20) {
    throw new AuthError("Invalid auth token format. Please sign in again.", "AUTH_MISSING");
  }

  // Internal scheduler / cron call
  if (isInternalCall) {
    if (token !== serviceKey) {
      throw new AuthError("Invalid internal token.", "UNAUTHORIZED");
    }
    return {
      userId: bodyUserId ?? "internal",
      email:  bodyUserId ? "" : "system@internal",
    };
  }

  // Verify with Supabase Admin API
  console.log("[requireAuth] Verifying token:", token.slice(0, 20) + "...");
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token);

  if (error) {
    const msg    = error.message ?? "";
    const code   = (error as { code?: string }).code ?? "";
    const status = error.status ?? 0;
    console.error(
      `[requireAuth] getUser FAILED — status:${status} code:${code} msg:${msg}`,
    );

    const isInvalidJwt =
      msg.toLowerCase().includes("invalid jwt") ||
      msg.toLowerCase().includes("invalid token") ||
      code === "invalid_jwt";

    if (isInvalidJwt) {
      throw new AuthError(
        "Payment service is misconfigured (server cannot verify session). Contact support.",
        "SERVER_MISCONFIGURED",
      );
    }
    if (status === 401 || msg.toLowerCase().includes("expired")) {
      throw new AuthError(
        "Your session has expired. Please sign out and sign in again.",
        "SESSION_EXPIRED",
      );
    }
    throw new AuthError(`Authentication error: ${msg}`, "AUTH_ERROR");
  }

  if (!user) {
    throw new AuthError(
      "Session not found. Please sign out and sign in again.",
      "SESSION_EXPIRED",
    );
  }

  console.log("[requireAuth] Authenticated:", user.id);
  return { userId: user.id, email: user.email ?? "" };
}

// ── 7. activateAccount ────────────────────────────────────────────────────────
//
// Single source of truth for ALL payment providers.
// Sets EVERY field that isPaidProfile() checks in paymentGate.js:
//   account_activated = true
//   payment_status    = "paid"
//   subscription_tier = tier
//   is_pro            = true  (if tier === "pro")
//   is_vip            = true  (if tier === "vip" or "whitelist")
//
// EP grant is NON-FATAL — activation always completes even if EP RPC fails.
//
export async function activateAccount(
  userId:    string,
  tier:      string,
  meta:      Record<string, unknown> = {},
  paymentId: string | null = null,
  productId: string | null = null,
): Promise<void> {
  const db = supabaseAdmin();

  const updates: Record<string, unknown> = {
    account_activated: true,
    payment_status:    "paid",
    subscription_tier: tier,
    updated_at:        new Date().toISOString(),
  };

  if (tier === "pro")       updates["is_pro"] = true;
  if (tier === "vip")       updates["is_vip"] = true;
  if (tier === "whitelist") updates["is_vip"] = true;

  const { error } = await db.from("profiles").update(updates).eq("id", userId);
  if (error) {
    throw new Error(`Profile activation failed for user ${userId}: ${error.message}`);
  }
  console.log(`[activateAccount] Activated user=${userId} tier=${tier}`);

  // EP grant — non-fatal
  const epGrant = Number(meta.ep_grant ?? 0);
  if (epGrant > 0) {
    const { error: epErr } = await db.rpc("increment_engagement_points", {
      p_user_id:    userId,
      p_amount:     epGrant,
      p_reason:     String(meta.ep_reason ?? `${tier} access grant — ${epGrant} EP`),
      p_payment_id: paymentId,
      p_product_id: productId,
    });
    if (epErr) {
      console.warn(`[activateAccount] EP grant non-fatal user=${userId}:`, epErr.message);
    } else {
      console.log(`[activateAccount] Minted ${epGrant} EP user=${userId}`);
    }
  }
}

// ── 8. Rate limit helper ──────────────────────────────────────────────────────
// Returns true = ALLOWED. Always allows on error (never block users due to
// our own RPC failure).
export async function checkPaymentRateLimit(userId: string): Promise<boolean> {
  const db = supabaseAdmin();
  try {
    const { data, error } = await db.rpc("check_payment_rate_limit", {
      p_user_id: userId,
    });
    if (error) {
      console.warn("[rateLimit] RPC error (allowing through):", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.warn("[rateLimit] Exception (allowing through):", e);
    return true;
  }
}

// ── 9. withRetry ──────────────────────────────────────────────────────────────
// Resilient async with exponential back-off + jitter.
// maxAttempts : total tries (default 3)
// baseDelayMs : initial delay in ms, doubles each retry + random jitter (200ms)
export async function withRetry<T>(
  fn:           () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        const jitter = Math.random() * 100;
        const delay  = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        console.warn(
          `[withRetry] Attempt ${attempt}/${maxAttempts} failed, ` +
          `retrying in ${Math.round(delay)}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}