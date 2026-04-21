// supabase/functions/verify-2fa-login/index.ts
// ============================================================================
// Verifies a TOTP token OR backup code during login or sensitive actions
// (withdrawals, PIN changes, phone changes, etc.)
//
// Body: { token: "123456" }  — TOTP code
//    OR { backupCode: "ABCD1-23456" }  — backup code
// Returns: { success: true } or { error: "..." }
//
// Deploy: supabase functions deploy verify-2fa-login
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.4";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decryptSecret(encryptedSecret: string, key: string): string {
  const decoded = atob(encryptedSecret);
  return decoded.split("").map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join("");
}

async function hashBackupCode(code: string): Promise<string> {
  const enc    = new TextEncoder().encode(code.toUpperCase().trim());
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
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

    const body: { token?: string; backupCode?: string; userId?: string } = await req.json();
    const { token, backupCode } = body;

    if (!token && !backupCode) {
      return new Response(JSON.stringify({ error: "Provide either a TOTP token or a backup code." }), {
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

    // Rate limit: max 5 failed attempts per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: failedAttempts } = await supabaseAdmin
      .from("security_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "2fa_failed")
      .gte("created_at", fifteenMinAgo);

    if ((failedAttempts || 0) >= 5) {
      // Also lock the account
      await supabaseAdmin.from("profiles").update({
        account_locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);

      await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "account_locked",
        severity:   "critical",
        metadata:   { reason: "too_many_2fa_attempts" },
      }).catch(() => {});

      return new Response(
        JSON.stringify({ error: "Account temporarily locked due to too many failed 2FA attempts. Try again in 30 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch 2FA record
    const { data: tfaRow, error: fetchErr } = await supabaseAdmin
      .from("two_factor_auth")
      .select("secret, enabled, backup_codes")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !tfaRow) {
      return new Response(JSON.stringify({ error: "2FA not found for this account." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tfaRow.enabled) {
      return new Response(JSON.stringify({ error: "2FA is not enabled on this account." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encryptionKey = Deno.env.get("TWO_FA_ENCRYPTION_KEY") || "xeevia-2fa-default-key-change-me";

    // ── BACKUP CODE path ──────────────────────────────────────────────────────
    if (backupCode) {
      const codeHash  = await hashBackupCode(backupCode);
      const storedCodes: string[] = tfaRow.backup_codes || [];

      // Find the matching code (constant-time comparison across all codes)
      let matchedIndex = -1;
      for (let i = 0; i < storedCodes.length; i++) {
        if (safeEqual(storedCodes[i], codeHash)) {
          matchedIndex = i;
        }
      }

      if (matchedIndex === -1) {
        await supabaseAdmin.from("security_events").insert({
          user_id:    user.id,
          event_type: "2fa_failed",
          severity:   "warning",
          metadata:   { context: "backup_code" },
        }).catch(() => {});

        return new Response(
          JSON.stringify({ success: false, error: "Invalid backup code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidate used backup code by removing it
      const updatedCodes = storedCodes.filter((_, i) => i !== matchedIndex);
      await supabaseAdmin
        .from("two_factor_auth")
        .update({
          backup_codes: updatedCodes,
          last_used:    new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "2fa_verified",
        severity:   "info",
        metadata:   { context: "backup_code", remaining_codes: updatedCodes.length },
      }).catch(() => {});

      return new Response(
        JSON.stringify({
          success:         true,
          remainingCodes:  updatedCodes.length,
          warningIfLow:    updatedCodes.length <= 2
            ? `Only ${updatedCodes.length} backup code(s) remaining. Generate new ones soon.`
            : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TOTP path ─────────────────────────────────────────────────────────────
    if (!token || !/^\d{6}$/.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid TOTP format. Must be 6 digits." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secret = decryptSecret(tfaRow.secret, encryptionKey);
    const totp   = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits:    6,
      period:    30,
      secret:    OTPAuth.Secret.fromBase32(secret),
    });

    const delta   = totp.validate({ token, window: 1 });
    const isValid = delta !== null;

    if (!isValid) {
      await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "2fa_failed",
        severity:   "warning",
        metadata:   { context: "login" },
      }).catch(() => {});

      return new Response(
        JSON.stringify({ success: false, error: "Invalid 2FA code. Check your authenticator app." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used
    await supabaseAdmin
      .from("two_factor_auth")
      .update({ last_used: new Date().toISOString() })
      .eq("user_id", user.id);

    await supabaseAdmin.from("security_events").insert({
      user_id:    user.id,
      event_type: "2fa_verified",
      severity:   "info",
      metadata:   { context: "login" },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[verify-2fa-login] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});