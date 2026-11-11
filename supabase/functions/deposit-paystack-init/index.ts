// supabase/functions/deposit-paystack-init/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Initialises a Paystack transaction for wallet deposits.
//
// The depositor identity and email are derived from a verified Supabase session.
//
// FIX v2: Response now includes `paystackKey` (from REACT_APP_PAYSTACK_PUBLIC_KEY
// secret) so the frontend never needs REACT_APP_PAYSTACK_PUBLIC_KEY baked into
// the build. Works identically on localhost and production.
//
// ENV vars required:
//   PAYSTACK_SECRET_KEY          – your Paystack secret key (sk_live_...)
//   REACT_APP_PAYSTACK_PUBLIC_KEY – your Paystack public key (pk_live_...)
//   APP_URL                      – your app's public URL
//   SUPABASE_URL                 – injected automatically by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY    – injected automatically by Supabase runtime
//   SUPABASE_ANON_KEY            – injected automatically by Supabase runtime
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_NGN_RATE = 1366;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

function getSupabaseUser(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    // ── 1. Parse body ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body) return json({ success: false, error: "Invalid JSON body" }, 400);

    const {
      nairaAmount,
      currency = "EP",
      channel = "card",
      from_wallet,
      wallet_address,
      wallet_signature,
      import_ref,
    } = body as {
      nairaAmount: number;
      currency?: string;
      channel?: string;
      from_wallet?: string;
      wallet_address?: string;
      wallet_signature?: string;
      import_ref?: string;
    };

    // ── 2. Resolve userId from JWT (authoritative) + email ─────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Sign in to deposit." }, 401);
    }
    const userClient = getSupabaseUser(authHeader);
    if (!userClient) {
      return json({ success: false, error: "Authentication is not configured." }, 503);
    }
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, error: "Your session is invalid or expired." }, 401);
    }
    const resolvedUserId = user.id;
    let resolvedEmail = user.email || "";
    const sb = getSupabaseAdmin();
    if (!sb) {
      return json({ success: false, error: "Deposit service is not configured." }, 503);
    }
    if (!resolvedEmail) {
      const { data: profile, error: profileError } = await sb
        .from("profiles")
        .select("email")
        .eq("id", resolvedUserId)
        .maybeSingle();
      if (profileError) throw new Error(`Could not load depositor profile: ${profileError.message}`);
      resolvedEmail = profile?.email ?? "";
    }
    if (!resolvedEmail) {
      return json(
        {
          success: false,
          error: "email is required — please update your profile",
        },
        400,
      );
    }

    // ── 3. Validate amount ─────────────────────────────────────────────────
    let n = Number(nairaAmount);
    if (!Number.isFinite(n) || n < 100) {
      return json(
        { success: false, error: "amount must be at least ₦100" },
        400,
      );
    }
    const amountKobo = Math.round(n * 100);
    if (!Number.isSafeInteger(amountKobo) || amountKobo < 10_000) {
      return json({ success: false, error: "Enter a valid deposit amount." }, 400);
    }
    n = amountKobo / 100;
    if (currency !== "EP" && currency !== "XEV") {
      return json({ success: false, error: "Unsupported wallet currency." }, 400);
    }
    if (channel !== "card" && channel !== "bank_transfer") {
      return json({ success: false, error: "Unsupported payment method." }, 400);
    }

    // ── 4. Paystack keys ───────────────────────────────────────────────────
    const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET) {
      console.error("[deposit-paystack-init] PAYSTACK_SECRET_KEY missing");
      return json(
        { success: false, error: "Payment gateway not configured" },
        500,
      );
    }

    // Public key is read server-side and returned to the client.
    // Accept either PAYSTACK_PUBLIC_KEY or REACT_APP_PAYSTACK_PUBLIC_KEY
    // to be robust across deployment environments.
    const PAYSTACK_PUBLIC_KEY = Deno.env.get("PAYSTACK_PUBLIC_KEY")
      ?? Deno.env.get("REACT_APP_PAYSTACK_PUBLIC_KEY");
    if (!PAYSTACK_PUBLIC_KEY) {
      console.error(
        "[deposit-paystack-init] PAYSTACK public key missing (PAYSTACK_PUBLIC_KEY or REACT_APP_PAYSTACK_PUBLIC_KEY)",
      );
      return json(
        { success: false, error: "Payment gateway not configured (public key)" },
        500,
      );
    }

    // ── 5. Build reference ─────────────────────────────────────────────────
    const safeId = resolvedUserId.replace(/-/g, "").slice(0, 8);
    const reference = `xev_dep_${safeId}_${crypto.randomUUID()}`;
    const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";
    const callback = `${APP_URL}/#wallet?verify=${reference}&status=success`;
    const { data: rateSetting, error: rateError } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle();
    if (rateError) {
      console.warn("[deposit-paystack-init] Could not load configured NGN rate; using server fallback:", rateError.message);
    }
    const configuredRate = Number(rateSetting?.value?.ngn_rate);
    const ngnRate = Number.isFinite(configuredRate) && configuredRate >= 100 && configuredRate <= 1_000_000
      ? configuredRate
      : FALLBACK_NGN_RATE;
    const usdEquiv = parseFloat((n / ngnRate).toFixed(6));

    // Compute credit preview (for response only — server webhook is authoritative)
    const EP_PER_USD = 100;
    const XEV_PER_EP = 0.1;
    let creditAmount: number;
    let creditLabel: string;
    if (currency === "XEV") {
      creditAmount = parseFloat(
        (usdEquiv * EP_PER_USD * XEV_PER_EP).toFixed(4),
      );
      creditLabel = "$XEV";
    } else {
      creditAmount = Math.floor(usdEquiv * EP_PER_USD);
      creditLabel = "EP";
    }
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return json(
        { success: false, error: "This deposit amount is too small to credit your wallet." },
        400,
      );
    }

    // ── 6. Call Paystack initialize ────────────────────────────────────────
    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: resolvedEmail,
          amount: amountKobo,
          reference,
          currency: "NGN",
          callback_url: callback,
          channels:
            channel === "bank_transfer"
              ? ["bank_transfer"]
              : ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
          metadata: {
            source: "wallet_deposit",
            user_id: resolvedUserId,
            deposit_currency: currency,
            amount_ngn: n,
            amount_kobo: amountKobo,
            usd_amount: usdEquiv,
            usd_ngn_rate: ngnRate,
            ngn_rate: ngnRate,
            channel,
            ...(from_wallet ? { wallet_name: from_wallet } : {}),
            ...(wallet_address ? { wallet_address: wallet_address } : {}),
            ...(wallet_signature ? { wallet_signature: wallet_signature } : {}),
            ...(import_ref ? { import_ref: import_ref } : {}),
          },
        }),
      },
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status || !paystackData.data?.authorization_url) {
      console.error("[deposit-paystack-init] Paystack error:", paystackData);
      return json(
        {
          success: false,
          error: paystackData.message || "Payment gateway error",
        },
        502,
      );
    }

    // ── 7. Record pending transaction in DB ────────────────────────────────
    const { data: wallet, error: walletError } = await sb
      .from("wallets")
      .select("id")
      .eq("user_id", resolvedUserId)
      .maybeSingle();
    if (walletError) throw new Error(`Could not load depositor wallet: ${walletError.message}`);

    const { error: txInsertError } = await sb.from("transactions").insert({
      from_user_id: resolvedUserId,
      to_user_id: resolvedUserId,
      amount: n,
      type: "deposit",
      status: "pending",
      metadata: {
        paystack_ref: reference,
        source: "wallet_deposit",
        currency: "NGN",
        wallet_id: wallet?.id ?? null,
        amount_kobo: amountKobo,
        deposit_currency: currency,
        usd_amount: usdEquiv,
        ngn_rate: ngnRate,
        ngn_rate_source: "server",
        channel,
      },
    });
    if (txInsertError) throw new Error(`Could not save deposit intent: ${txInsertError.message}`);

    const { error: paymentIntentError } = await sb.from("payment_intents").upsert(
      {
        user_id: resolvedUserId,
        product_id: "00000000-0000-0000-0000-000000000000",
        idempotency_key: reference,
        provider: "paystack",
        provider_session: paystackData.data.reference,
        amount_cents: amountKobo,
        currency: "NGN",
        status: "redirected",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        metadata: {
          user_id: resolvedUserId,
          type: "wallet_deposit",
          amount_ngn: n,
          email: resolvedEmail,
          deposit_currency: currency,
          usd_amount: usdEquiv,
          ngn_rate: ngnRate,
          ngn_rate_source: "server",
        },
      },
      { onConflict: "idempotency_key" },
    );
    if (paymentIntentError) {
      console.warn("[deposit-paystack-init] Could not save payment intent:", paymentIntentError.message);
    }

    // ── 8. Return success ──────────────────────────────────────────────────
    // paystackKey is included so the frontend (depositFundService.js) can
    // open the Paystack popup without needing REACT_APP_PAYSTACK_PUBLIC_KEY
    // baked into the frontend build. Works on localhost and all deployments.
    // Expose the public key only if present. Also include diagnostics so
    // clients can clearly detect a missing key without exposing secret values.
    const paystackKeyPresent = !!PAYSTACK_PUBLIC_KEY;
    const paystackKeySource = paystackKeyPresent
      ? (Deno.env.get("PAYSTACK_PUBLIC_KEY") ? "PAYSTACK_PUBLIC_KEY" : "REACT_APP_PAYSTACK_PUBLIC_KEY")
      : null;

    return json({
      success: true,
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
      access_code: paystackData.data.access_code,
      amount_ngn: n,
      amount_kobo: amountKobo,
      creditAmount,
      amountKobo,
      currency,
      label: creditLabel,
      paystackKey: paystackKeyPresent ? PAYSTACK_PUBLIC_KEY : null,
      paystackKeyPresent,
      paystackKeySource,
    });
  } catch (err) {
    console.error("[deposit-paystack-init] Unexpected error:", err);
    return json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      500,
    );
  }
});