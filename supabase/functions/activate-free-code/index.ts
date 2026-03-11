// supabase/functions/activate-free-code/index.ts — AUDIT-FIXED
// Fixes applied:
//   1. validateEnv return value is now checked — env errors returned immediately
//   2. requireAuth destructuring includes isInternal (added to return type in _shared/payments.ts)
//   3. invite_code_redemptions → invite_code_usage (table that actually exists)
//   4. increment_invite_uses RPC → direct UPDATE with fallback to avoid missing RPC crash
//   5. EP grant uses meta.ep_grant field (consistent with activateAccount in _shared)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  requireAuth,
  validateEnv,
  activateAccount,
} from "../_shared/payments.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // FIX 1: Check validateEnv return value — was being silently discarded
    const envError = validateEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ANON_KEY",
    ]);
    if (envError) return envError;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // FIX 2: requireAuth now returns { userId, isInternal } — see _shared/payments.ts fix
    const authResult = await requireAuth(req, anonKey);
    if (authResult instanceof Response) return authResult;
    const { userId, isInternal } = authResult;

    const { code, userId: bodyUserId } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Missing required field: code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Internal calls can specify a different userId (admin-on-behalf)
    const effectiveUserId = isInternal && bodyUserId ? bodyUserId : userId;

    const db = createClient(supabaseUrl, serviceRoleKey);

    // Look up the invite code
    const { data: invite, error: inviteError } = await db
      .from("invite_codes")
      .select(
        "id, code, type, is_active, max_uses, current_uses, price_override, entry_price, metadata",
      )
      .eq("code", code.trim().toUpperCase())
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite.is_active) {
      return new Response(
        JSON.stringify({ error: "Invite code is no longer active" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify this is actually a free code
    const effectivePrice =
      invite.price_override !== null && invite.price_override !== undefined
        ? Number(invite.price_override)
        : invite.metadata?.entry_price_cents !== undefined
          ? invite.metadata.entry_price_cents / 100
          : invite.entry_price !== undefined
            ? Number(invite.entry_price)
            : 4;

    if (effectivePrice > 0) {
      return new Response(
        JSON.stringify({ error: "This invite code requires payment" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check max uses
    if (invite.max_uses !== null && invite.current_uses >= invite.max_uses) {
      return new Response(
        JSON.stringify({ error: "Invite code has reached maximum uses" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check for duplicate redemption
    const { data: existingRedemption } = await db
      .from("invite_code_usage") // FIX 3: was invite_code_redemptions (doesn't exist)
      .select("id")
      .eq("invite_code_id", invite.id)
      .eq("user_id", effectiveUserId)
      .maybeSingle();

    if (existingRedemption) {
      // Already redeemed — check if profile is already activated
      const { data: profile } = await db
        .from("profiles")
        .select("account_activated, payment_status")
        .eq("id", effectiveUserId)
        .single();

      if (profile?.account_activated) {
        return new Response(
          JSON.stringify({ success: true, alreadyActivated: true }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // FIX 4: Direct UPDATE instead of RPC call (increment_invite_uses may not exist)
    const { error: usesError } = await db
      .from("invite_codes")
      .update({ current_uses: (invite.current_uses || 0) + 1 })
      .eq("id", invite.id);

    if (usesError) {
      console.error("Failed to increment invite uses:", usesError);
      // Non-fatal — continue with activation
    }

    // Record usage in invite_code_usage (FIX 3: correct table)
    await db.from("invite_code_usage").upsert(
      {
        invite_code_id: invite.id,
        user_id: effectiveUserId,
        used_at: new Date().toISOString(),
      },
      { onConflict: "invite_code_id,user_id" },
    );

    // FIX 5: EP grant uses meta.ep_grant field to be consistent with activateAccount
    const epGrant =
      invite.metadata?.ep_grant ?? invite.metadata?.free_ep_grant ?? 50;

    // Activate the account via shared helper
    await activateAccount(db, effectiveUserId, {
      paymentStatus: "free",
      subscriptionTier: invite.type === "vip" ? "vip" : "standard",
      inviteCodeId: invite.id,
      inviteCode: invite.code,
      ep_grant: epGrant,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account activated with free invite code",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[activate-free-code] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
