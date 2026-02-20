// supabase/functions/_shared/payments.ts
// ============================================================================
// SHARED UTILITIES — Used by all payment Edge Functions.
// Stripe has been removed. Supported providers: Paystack, Web3.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Service-role admin client — bypasses RLS. Only use in Edge Functions. */
export const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

export const corsHeaders = {
  "Access-Control-Allow-Origin":  Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400, code = "ERROR"): Response {
  return jsonResponse({ error: message, code }, status);
}

/**
 * Verify the caller is a valid Supabase-authenticated user.
 * Throws if the token is missing or invalid.
 */
export async function requireAuth(req: Request): Promise<{ userId: string; email: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !user) throw new Error("Invalid or expired auth token");
  return { userId: user.id, email: user.email ?? "" };
}

/**
 * Activate a user's account after payment is confirmed.
 * This is the single activation point — called by all payment providers.
 *
 * Sets:
 *   - account_activated = true
 *   - subscription_tier = tier
 *   - is_pro = true (if tier === "pro")
 *   - Grants EP if product metadata specifies ep_grant
 */
export async function activateAccount(
  userId: string,
  tier:   string,
  meta:   Record<string, unknown> = {}
): Promise<void> {
  const db = supabaseAdmin();

  const updates: Record<string, unknown> = {
    account_activated: true,
    subscription_tier: tier,
    updated_at:        new Date().toISOString(),
  };

  if (tier === "pro") updates["is_pro"] = true;

  const { error } = await db.from("profiles").update(updates).eq("id", userId);
  if (error) {
    throw new Error(`Profile activation failed for user ${userId}: ${error.message}`);
  }

  // Grant EP bonus — non-fatal if this fails
  if (meta.ep_grant && Number(meta.ep_grant) > 0) {
    await db.rpc("increment_engagement_points", {
      p_user_id: userId,
      p_amount:  Number(meta.ep_grant),
    }).catch((e: unknown) => {
      console.warn("[activateAccount] EP grant non-fatal failure:", e);
    });
  }
}

/**
 * Check payment rate limit: max 5 pending intents per user per 10 minutes.
 * Returns false if the user should be throttled.
 */
export async function checkPaymentRateLimit(userId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("check_payment_rate_limit", { p_user_id: userId });
  if (error) {
    // On RPC error, allow through — don't block users due to our own failure
    console.warn("[rateLimit] RPC error:", error.message);
    return true;
  }
  return data === true;
}