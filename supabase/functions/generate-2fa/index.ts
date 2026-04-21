// supabase/functions/generate-2fa/index.ts
// ============================================================================
// Generates a TOTP secret + QR code for 2FA setup.
// Called BEFORE the user has verified — secret is stored temporarily
// with enabled=false until verify-2fa-setup confirms a valid token.
//
// Deploy: supabase functions deploy generate-2fa
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.4";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Crypto-secure random bytes → base32 ──────────────────────────────────────
function generateBase32Secret(length = 20): string {
  const chars   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes   = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % 32]).join("");
}

// ── Generate backup codes ─────────────────────────────────────────────────────
async function generateBackupCodes(count = 8): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes  = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const formatted = `${code.slice(0, 5)}-${code.slice(5)}`;
    plain.push(formatted);

    // Hash for storage
    const enc    = new TextEncoder().encode(formatted);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    hashed.push(Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join(""));
  }

  return { plain, hashed };
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

    // Create Supabase client with service role for DB writes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the user's JWT
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

    // Check if 2FA is already enabled
    const { data: existing } = await supabaseAdmin
      .from("two_factor_auth")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.enabled) {
      return new Response(JSON.stringify({ error: "2FA is already enabled on this account." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate secret
    const secret = generateBase32Secret(20);

    // Build TOTP object for URL generation
    const totp = new OTPAuth.TOTP({
      issuer:    "Xeevia",
      label:     user.email || user.id,
      algorithm: "SHA1",
      digits:    6,
      period:    30,
      secret:    OTPAuth.Secret.fromBase32(secret),
    });

    const otpauthUrl = totp.toString();

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width:           256,
      margin:          1,
      color:           { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    });

    // Generate backup codes
    const { plain: backupCodesPlain, hashed: backupCodesHashed } = await generateBackupCodes(8);

    // Encrypt secret for storage (XOR with environment key)
    // In production, use a proper KMS. This provides basic obfuscation.
    const encryptionKey = Deno.env.get("TWO_FA_ENCRYPTION_KEY") || "xeevia-2fa-default-key-change-me";
    const encryptedSecret = btoa(
      secret.split("").map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ encryptionKey.charCodeAt(i % encryptionKey.length))
      ).join("")
    );

    // Upsert into two_factor_auth — NOT enabled yet (enabled=false until verified)
    const { error: upsertErr } = await supabaseAdmin
      .from("two_factor_auth")
      .upsert({
        user_id:      user.id,
        secret:       encryptedSecret,
        enabled:      false,
        backup_codes: backupCodesHashed,
        created_at:   new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("[generate-2fa] DB error:", upsertErr);
      return new Response(JSON.stringify({ error: "Failed to initialize 2FA setup." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log setup started
    await supabaseAdmin.from("security_events").insert({
      user_id:    user.id,
      event_type: "2fa_setup_started",
      severity:   "info",
      metadata:   {},
    }).catch(() => {});

    // Return QR code, manual entry key, and backup codes (only time plain codes shown)
    return new Response(
      JSON.stringify({
        success:     true,
        qrCode:      qrCodeDataUrl,
        secret:      secret,             // manual entry key for authenticator app
        otpauthUrl:  otpauthUrl,
        backupCodes: backupCodesPlain,   // shown ONCE — user must save these
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[generate-2fa] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});