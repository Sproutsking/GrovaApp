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

    const body: { token?: string; backupCode?: string; purpose?: string; userId?: string } = await req.json();
    const { token, backupCode, purpose } = body;
    if (purpose && purpose !== "transaction_pin_change") {
      return new Response(JSON.stringify({ error: "Unsupported authentication purpose." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (purpose === "transaction_pin_change" && backupCode) {
      return new Response(JSON.stringify({ error: "An authenticator app code is required for a PIN change." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const { count: failedAttempts, error: rateLimitError } = await supabaseAdmin
      .from("security_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "2fa_failed")
      .gte("created_at", fifteenMinAgo);
    if (rateLimitError) {
      console.error("[verify-2fa-login] Could not verify 2FA rate limit:", rateLimitError.message);
      return new Response(JSON.stringify({ error: "Could not verify account security status. Try again shortly." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((failedAttempts || 0) >= 5) {
      // Also lock the account
      const { error: lockError } = await supabaseAdmin.from("profiles").update({
        account_locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (lockError) {
        console.error("[verify-2fa-login] Could not lock account:", lockError.message);
        return new Response(JSON.stringify({ error: "Could not securely lock the account. Try again shortly." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: lockEventError } = await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "account_locked",
        severity:   "critical",
        metadata:   { reason: "too_many_2fa_attempts" },
      });
      if (lockEventError) console.error("[verify-2fa-login] Could not record account lock:", lockEventError.message);

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

    const encryptionKey = getConfiguredTwoFactorKey();
    if (purpose === "transaction_pin_change") {
      requireStrongTwoFactorKey(encryptionKey);
    }

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
        const { error: failedEventError } = await supabaseAdmin.from("security_events").insert({
          user_id:    user.id,
          event_type: "2fa_failed",
          severity:   "warning",
          metadata:   { context: "backup_code" },
        });
        if (failedEventError) console.error("[verify-2fa-login] Could not record failed backup code:", failedEventError.message);

        return new Response(
          JSON.stringify({ success: false, error: "Invalid backup code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: remainingCodes, error: consumeError } = await supabaseAdmin.rpc(
        "consume_two_factor_backup_code",
        { p_user_id: user.id, p_code_hash: codeHash },
      );
      if (consumeError) {
        console.error("[verify-2fa-login] Could not consume backup code:", consumeError.message);
        return new Response(JSON.stringify({ error: "Could not securely use the backup code. Try again." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (remainingCodes === null) {
        const { error: failedEventError } = await supabaseAdmin.from("security_events").insert({
          user_id: user.id,
          event_type: "2fa_failed",
          severity: "warning",
          metadata: { context: "backup_code_replay" },
        });
        if (failedEventError) {
          console.error("[verify-2fa-login] Could not record reused backup code:", failedEventError.message);
        }
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or already used backup code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: verifiedEventError } = await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "2fa_verified",
        severity:   "info",
        metadata:   { context: "backup_code", remaining_codes: remainingCodes },
      });
      if (verifiedEventError) console.error("[verify-2fa-login] Could not record backup-code verification:", verifiedEventError.message);

      return new Response(
        JSON.stringify({
          success:         true,
          remainingCodes,
          warningIfLow:    remainingCodes <= 2
            ? `Only ${remainingCodes} backup code(s) remaining. Generate new ones soon.`
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

    const decrypted = await decryptTwoFactorSecret(tfaRow.secret, encryptionKey);
    const secret = decrypted.secret;
    const totp   = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits:    6,
      period:    30,
      secret:    OTPAuth.Secret.fromBase32(secret),
    });

    const delta   = totp.validate({ token, window: 1 });
    const isValid = delta !== null;

    if (!isValid) {
      const { error: failedEventError } = await supabaseAdmin.from("security_events").insert({
        user_id:    user.id,
        event_type: "2fa_failed",
        severity:   "warning",
        metadata:   { context: purpose ?? "login" },
      });
      if (failedEventError) {
        console.error("[verify-2fa-login] Could not record failed TOTP attempt:", failedEventError.message);
        if (purpose === "transaction_pin_change") {
          return new Response(JSON.stringify({ error: "Could not securely record this attempt. Try again shortly." }), {
            status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: "Invalid 2FA code. Check your authenticator app." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let upgradedSecret: string | undefined;
    if (decrypted.legacy && encryptionKey && encryptionKey !== "xeevia-2fa-default-key-change-me") {
      try {
        upgradedSecret = await encryptTwoFactorSecret(secret, requireStrongTwoFactorKey(encryptionKey));
      } catch (error) {
        if (purpose === "transaction_pin_change") throw error;
        console.error("[verify-2fa-login] Could not upgrade legacy authenticator secret:", error);
      }
    }

    let authorizationToken: string | undefined;
    if (purpose === "transaction_pin_change") {
      const timeStep = Math.floor(Date.now() / 30_000) + (delta ?? 0);
      const { error: replayError } = await supabaseAdmin
        .from("transaction_pin_totp_uses")
        .insert({ user_id: user.id, time_step: timeStep });
      if (replayError?.code === "23505") {
        return new Response(
          JSON.stringify({ success: false, error: "That authenticator code was already used. Wait for a new code and try again." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (replayError) {
        console.error("[verify-2fa-login] Could not record one-time TOTP use:", replayError.message);
        return new Response(JSON.stringify({ error: "Could not securely authorize this PIN change. Try again." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      authorizationToken = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const tokenDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(authorizationToken));
      const tokenHash = Array.from(new Uint8Array(tokenDigest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: authorizationError } = await supabaseAdmin
        .from("transaction_pin_change_authorizations")
        .insert({
          token_hash: tokenHash,
          user_id: user.id,
          purpose,
          expires_at: expiresAt,
        });
      if (authorizationError) {
        console.error("[verify-2fa-login] Could not store PIN-change authorization:", authorizationError.message);
        return new Response(JSON.stringify({ error: "Could not securely authorize this PIN change. Try again." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update last_used
    const { error: lastUsedError } = await supabaseAdmin
      .from("two_factor_auth")
      .update({ last_used: new Date().toISOString(), ...(upgradedSecret ? { secret: upgradedSecret } : {}) })
      .eq("user_id", user.id);
    if (lastUsedError) {
      console.error("[verify-2fa-login] Could not update 2FA last-used timestamp:", lastUsedError.message);
      return new Response(JSON.stringify({ error: "Could not securely complete authentication. Try again." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: verifiedEventError } = await supabaseAdmin.from("security_events").insert({
      user_id:    user.id,
      event_type: "2fa_verified",
      severity:   "info",
      metadata:   { context: purpose ?? "login" },
    });
    if (verifiedEventError) console.error("[verify-2fa-login] Could not record successful verification:", verifiedEventError.message);

    return new Response(
      JSON.stringify({ success: true, ...(authorizationToken ? { authorizationToken, expiresInSeconds: 300 } : {}) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[verify-2fa-login] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});