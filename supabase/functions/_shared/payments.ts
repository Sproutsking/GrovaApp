// supabase/functions/_shared/payments.ts
// ============================================================================
// SHARED UTILITIES — Paystack + Web3. EP minted via increment_engagement_points.
// Every EP grant is tied to the payment record for full audit trail.
//
// v2 CRITICAL FIXES (deploy this — old version causes 401s):
// - validateEnv() — call at edge fn startup to catch missing secrets early
//   instead of cryptic 401s mid-request
// - requireAuth() — detailed logging so edge fn logs show exact failure point
// - activateAccount() — now sets payment_status = "paid" (was missing before)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Env validation ────────────────────────────────────────────────────────────
// Call at top of each edge function. Returns error Response if vars missing.
// This is the #1 fix for cryptic 401s — missing SUPABASE_SERVICE_ROLE_KEY
// causes getUser() to silently fail instead of giving a clear error.

export function validateEnv(required: string[]): Response | null {
  const missing = required.filter((k) => !Deno.env.get(k));
  if (missing.length === 0) return null;
  console.error("[validateEnv] Missing required env vars:", missing.join(", "));
  return errorResponse(
    `Server misconfiguration: missing env vars [${missing.join(", ")}]. Contact support.`,
    500,
    "SERVER_MISCONFIGURED",
  );
}

export const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  code = "ERROR",
): Response {
  return jsonResponse({ error: message, code }, status);
}

// ── requireAuth ───────────────────────────────────────────────────────────────
// Logs exact failure reason so Supabase Edge Function logs show what went wrong.
// The most common cause of 401 is SUPABASE_SERVICE_ROLE_KEY not set in secrets.

export async function requireAuth(
  req: Request,
): Promise<{ userId: string; email: string }> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    console.error("[requireAuth] No Authorization header in request");
    throw new Error("Missing Authorization header. Please sign in and try again.");
  }

  if (!authHeader.startsWith("Bearer ")) {
    console.error("[requireAuth] Authorization header missing Bearer prefix");
    throw new Error("Malformed Authorization header.");
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token || token.length < 20) {
    console.error("[requireAuth] Token empty or too short:", token?.length);
    throw new Error("Empty or invalid auth token.");
  }

  // Verify env vars before making the auth call — missing service role key
  // causes getUser() to fail with a confusing error instead of a clear one
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "[requireAuth] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in edge function secrets. " +
      "Go to Supabase Dashboard → Edge Functions → your-function → Secrets and add them.",
    );
    throw new Error("Server misconfiguration — auth service unavailable. Contact support.");
  }

  console.log("[requireAuth] Validating token, prefix:", token.slice(0, 20) + "…");

  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token);

  if (error) {
    console.error(
      "[requireAuth] getUser failed — message:", error.message,
      "| status:", error.status,
      "| code:", error.code,
      "\nIf this says 'invalid JWT' check that SUPABASE_SERVICE_ROLE_KEY is set in edge fn secrets.",
    );
    throw new Error(`Auth failed: ${error.message}`);
  }

  if (!user) {
    console.error("[requireAuth] getUser returned null user with no error — token likely expired");
    throw new Error("Session expired. Please sign out and sign in again.");
  }

  console.log("[requireAuth] ✅ Authenticated user:", user.id);
  return { userId: user.id, email: user.email ?? "" };
}

/**
 * Activate account + mint EP in a single call.
 * v2: now also sets payment_status = "paid" so isPaidProfile() gate passes.
 */
export async function activateAccount(
  userId: string,
  tier: string,
  meta: Record<string, unknown> = {},
  paymentId: string | null = null,
  productId: string | null = null,
): Promise<void> {
  const db = supabaseAdmin();

  // ── 1. Activate profile ───────────────────────────────────────────────────
  const updates: Record<string, unknown> = {
    account_activated: true,
    subscription_tier: tier,
    payment_status:    "paid",          // ← required for isPaidProfile() gate
    updated_at:        new Date().toISOString(),
  };
  if (tier === "pro") updates["is_pro"] = true;

  const { error } = await db.from("profiles").update(updates).eq("id", userId);
  if (error) {
    throw new Error(
      `Profile activation failed for user ${userId}: ${error.message}`,
    );
  }

  console.log(`[activateAccount] ✅ Activated user=${userId} tier=${tier}`);

  // ── 2. Mint EP via DB function (idempotent, audited) ─────────────────────
  const epGrant = Number(meta.ep_grant ?? 0);
  if (epGrant > 0) {
    const epReason = String(
      meta.ep_reason ?? `${tier} access grant — ${epGrant} EP`,
    );

    const { error: epErr } = await db.rpc("increment_engagement_points", {
      p_user_id:    userId,
      p_amount:     epGrant,
      p_reason:     epReason,
      p_payment_id: paymentId,
      p_product_id: productId,
    });

    if (epErr) {
      console.error(
        `[activateAccount] EP mint failed for user ${userId} (non-fatal):`,
        epErr.message,
      );
    } else {
      console.log(
        `[activateAccount] ✅ Minted ${epGrant} EP for user ${userId}`,
      );
    }
  }
}

export async function checkPaymentRateLimit(userId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("check_payment_rate_limit", {
    p_user_id: userId,
  });
  if (error) {
    console.warn("[rateLimit] RPC error (allowing through):", error.message);
    return true;
  }
  return data === true;
}