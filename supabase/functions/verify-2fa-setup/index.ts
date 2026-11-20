// supabase/functions/verify-2fa-setup/index.ts
// ============================================================================
// Verifies the TOTP token entered during setup, then marks 2FA as enabled.
// Must be called AFTER generate-2fa to complete the setup flow.
//
// Body: { token: "123456" }
// Returns: { success: true } or { error: "..." }
//
// Deploy: supabase functions deploy verify-2fa-setup
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.4";
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  getConfiguredTwoFactorKey,
  requireStrongTwoFactorKey,
} from "../_shared/twoFactor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token }: { token: string } = await req.json();

    if (!token || !/^\d{6}$/.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid token format. Must be 6 digits." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit check — max 5 attempts per 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentAttempts, error: rateLimitError } = await supabaseAdmin
      .from("security_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("event_type", ["2fa_failed", "2fa_verified"])
      .gte("created_at", fiveMinAgo);

    if (rateLimitError) {
      console.error("[verify-2fa-setup] Could not verify rate limit:", rateLimitError.message);
      return new Response(JSON.stringify({ error: "Could not verify account security status. Try again shortly." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((recentAttempts || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please wait 5 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the stored (encrypted) secret
    const { data: tfaRow, error: fetchErr } = await supabaseAdmin
      .from("two_factor_auth")
      .select("secret, enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !tfaRow) {
      return new Response(JSON.stringify({ error: "2FA setup not initialized. Please restart setup." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tfaRow.enabled) {
      return new Response(JSON.stringify({ error: "2FA is already enabled." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt and verify
    const encryptionKey = getConfiguredTwoFactorKey();
    const decrypted = await decryptTwoFactorSecret(tfaRow.secret, encryptionKey);
    const secret = decrypted.secret;

    const totp  = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits:    6,
      period:    30,
      secret:    OTPAuth.Secret.fromBase32(secret),
    });

    // Validate with ±1 period window for clock skew tolerance
    const delta = totp.validate({ token, window: 1 });
    const isValid = delta !== null;

    if (!isValid) {
      // Log failed attempt
      const { error: failedEventError } = await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "2fa_failed",
        severity:   "warning",
        metadata:   { context: "setup" },
      });
      if (failedEventError) console.error("[verify-2fa-setup] Could not record failed verification:", failedEventError.message);

      return new Response(JSON.stringify({ success: false, error: "Invalid code. Check your authenticator app and try again." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encryptedSecret = decrypted.legacy
      ? await encryptTwoFactorSecret(secret, requireStrongTwoFactorKey(encryptionKey))
      : tfaRow.secret;

    // Enable 2FA
    const { error: enableErr } = await supabaseAdmin
      .from("two_factor_auth")
      .update({
        secret:      encryptedSecret,
        enabled:     true,
        verified_at: new Date().toISOString(),
        last_used:   new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (enableErr) {
      console.error("[verify-2fa-setup] Enable error:", enableErr);
      return new Response(JSON.stringify({ error: "Failed to enable 2FA. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profiles to require 2FA
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ require_2fa: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (profileUpdateError) {
      console.error("[verify-2fa-setup] Could not require 2FA on profile:", profileUpdateError.message);
      return new Response(JSON.stringify({ error: "2FA is enabled, but account security settings could not be updated. Contact support." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log success
    const { error: enabledEventError } = await supabaseAdmin.from("security_events").insert({
      user_id:    user.id,
      event_type: "2fa_enabled",
      severity:   "info",
      metadata:   { context: "setup_complete" },
    });
    if (enabledEventError) console.error("[verify-2fa-setup] Could not record successful setup:", enabledEventError.message);

    return new Response(
      JSON.stringify({ success: true, message: "2FA enabled successfully." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[verify-2fa-setup] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});