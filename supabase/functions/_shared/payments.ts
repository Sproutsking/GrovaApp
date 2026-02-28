// supabase/functions/_shared/payments.ts  —  v13 PRODUCTION FINAL
// ============================================================================
//  MERGED BEST OF v11 + v12:
//  [1] Typed AuthError class (from v11)
//  [2] validateEnv returns Response directly — use as guard at top of handler (v11)
//  [3] supabaseAdmin factory pattern — fresh client per call, never cached (v11)
//  [4] requireAuth with full error code contract + internal service-key support (v11+v12)
//  [5] activateAccount sets payment_status="paid" + is_vip for whitelist/vip tiers (v12)
//  [6] activateAccount accepts paymentId + productId for EP grant RPC args (v11)
//  [7] withRetry with jitter for resilient RPC under high traffic (v11)
//  [8] checkPaymentRateLimit — never blocks on our own failure (both)
//  [9] PAYSTACK_WEBHOOK_SECRET removed — use PAYSTACK_SECRET_KEY for HMAC-SHA512 (v11)
//
//  DEPLOYMENT CHECKLIST — run once per environment:
//  ─────────────────────────────────────────────────────────────────────────
//  supabase secrets set --project-ref <ref> \
//    SUPABASE_URL="https://<ref>.supabase.co" \
//    SUPABASE_SERVICE_ROLE_KEY="<service_role from Project Settings → API>" \
//    PAYSTACK_SECRET_KEY="sk_test_... or sk_live_..." \
//    TREASURY_WALLET_ADDRESS="0x..." \
//    TREASURY_WALLET_SOL="<solana_address>" \
//    TREASURY_WALLET_ADA="addr1..." \
//    POLYGON_RPC_URL="https://polygon-rpc.com" \
//    BASE_RPC_URL="https://mainnet.base.org" \
//    ARBITRUM_RPC_URL="https://arb1.arbitrum.io/rpc" \
//    ETH_RPC_URL="https://eth.llamarpc.com" \
//    BSC_RPC_URL="https://bsc-dataseed.binance.org" \
//    ALLOWED_ORIGIN="https://yourdomain.com"
//
//  ⚠️  NOTE: There is NO separate PAYSTACK_WEBHOOK_SECRET.
//  Paystack signs webhooks using PAYSTACK_SECRET_KEY via HMAC-SHA512.
//
//  THE #1 CAUSE OF 401 ERRORS:
//  ─────────────────────────────────────────────────────────────────────────
//  SUPABASE_SERVICE_ROLE_KEY missing → every auth.getUser() returns "Invalid JWT"
//  The user JWT is valid. The SERVER cannot verify it without the service key.
//
//  FACTORY PATTERN — CRITICAL:
//  ─────────────────────────────────────────────────────────────────────────
//  Module-level createClient() runs BEFORE env vars are injected → always fails.
//  The factory () => createClient(...) creates a fresh client AT CALL TIME. ✓
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

// ── 2. CORS headers ───────────────────────────────────────────────────────────
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":
    Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── 3. Env validator ──────────────────────────────────────────────────────────
// Call FIRST in every edge function handler.
// Converts mystery "Invalid JWT" into clear "SERVER_MISCONFIGURED".
// Returns a Response on failure (use as: const bad = validateEnv([...]); if (bad) return bad;)
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
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status  = 400,
  code    = "ERROR",
): Response {
  return jsonResponse({ error: message, code }, status);
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
// USAGE PATTERNS:
//   External callers: Bearer <user_jwt>
//   Internal callers: Bearer <service_role_key>, pass isInternalCall=true
//     → skips getUser(), returns synthetic identity { userId: "internal" }
//     → for subscription-sync cron jobs that run as the system
//
// INTERNAL CALL WITH USER ID:
//   Pass bodyUserId when calling internally on behalf of a specific user.
//   The function returns { userId: bodyUserId } instead of "internal".
export async function requireAuth(
  req:            Request,
  isInternalCall = false,
  bodyUserId?:   string,
): Promise<{ userId: string; email: string }> {

  // Env guard — catches missing service key before it causes cryptic JWT errors
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error(
      `[requireAuth] MISSING SECRETS — URL:${supabaseUrl ? "ok" : "MISSING"} KEY:${serviceKey ? "ok" : "MISSING"}`,
    );
    throw new AuthError(
      "Payment service is misconfigured (missing server secrets). Contact support.",
      "SERVER_MISCONFIGURED",
    );
  }

  // Extract token
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
    // If caller passed a userId (acting on behalf of a real user), use it
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
    console.error(`[requireAuth] getUser FAILED — status:${status} code:${code} msg:${msg}`);

    const isInvalidJwt =
      msg.toLowerCase().includes("invalid jwt") ||
      msg.toLowerCase().includes("invalid token") ||
      code === "invalid_jwt";

    if (isInvalidJwt) {
      // This almost always means SUPABASE_SERVICE_ROLE_KEY is wrong/missing
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

// ── 7. activateAccount — single source of truth for ALL payment providers ─────
//
// Sets EVERY field that isPaidProfile() checks in paymentGate.js:
//   account_activated = true
//   payment_status    = "paid"      ← isPaidProfile() checks this
//   subscription_tier = tier        ← isPaidProfile() checks this
//   is_pro            = true        ← if tier === "pro"
//   is_vip            = true        ← if tier === "vip" or "whitelist"
//
// EP grant is NON-FATAL — activation always completes even if EP RPC fails.
// Pass paymentId + productId for full EP audit trail in the RPC call.
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

  // Tier-specific flags
  if (tier === "pro")       updates["is_pro"] = true;
  if (tier === "vip")       updates["is_vip"] = true;
  if (tier === "whitelist") updates["is_vip"] = true;

  const { error } = await db.from("profiles").update(updates).eq("id", userId);
  if (error) {
    throw new Error(`Profile activation failed for user ${userId}: ${error.message}`);
  }
  console.log(`[activateAccount] Activated user=${userId} tier=${tier}`);

  // EP grant — non-fatal, logged but never blocks activation
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
// Returns true = ALLOWED. Always allows on error (never block users due to our failure).
// Max 5 pending payment intents per user per 10 minutes (enforced in DB RPC).
export async function checkPaymentRateLimit(userId: string): Promise<boolean> {
  const db = supabaseAdmin();
  try {
    const { data, error } = await db.rpc("check_payment_rate_limit", { p_user_id: userId });
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

// ── 9. withRetry — resilient async with exponential back-off + jitter ─────────
// Used for RPC calls and DB operations that may transiently fail under load.
// maxAttempts : total tries (default 3)
// baseDelayMs : initial delay in ms, doubles each retry + random jitter (default 200)
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
          `[withRetry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}