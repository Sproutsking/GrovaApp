// supabase/functions/_shared/payments.ts
// Shared utilities for all payment Edge Functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

/** Verify caller is a valid Supabase-authenticated user */
export async function requireAuth(
  req: Request,
): Promise<{ userId: string; email: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabaseAdmin().auth.getUser(token);

  if (error || !user) throw new Error("Invalid auth token");
  return { userId: user.id, email: user.email ?? "" };
}

/**
 * Activate a user's account after payment confirmed.
 * Grants EP if the product metadata includes ep_grant.
 */
export async function activateAccount(
  userId: string,
  tier: string,
  meta: Record<string, unknown> = {},
) {
  const db = supabaseAdmin();

  const updates: Record<string, unknown> = {
    account_activated: true,
    subscription_tier: tier,
    updated_at: new Date().toISOString(),
  };

  // Pro tier also sets is_pro flag
  if (tier === "pro") {
    updates["is_pro"] = true;
  }

  await db.from("profiles").update(updates).eq("id", userId);

  // Grant EP bonus if specified in product metadata
  if (meta.ep_grant && Number(meta.ep_grant) > 0) {
    await db
      .rpc("increment_engagement_points", {
        p_user_id: userId,
        p_amount: meta.ep_grant,
      })
      .catch((err: unknown) => {
        // Non-fatal — EP grant failure should not block account activation
        console.warn("[activateAccount] EP grant failed:", err);
      });
  }
}
