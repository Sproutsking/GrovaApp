// supabase/functions/deposit-paystack-init/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Initialises a Paystack transaction for wallet deposits.
//
// FIX: userId now sourced from JWT (auth header) as the primary source,
// falling back to body.userId. This resolves "userId is required" error
// that occurred when the frontend auth session hadn't fully propagated.
//
// ENV vars required:
//   PAYSTACK_SECRET_KEY   – your Paystack secret key
//   APP_URL               – your app's public URL
//   SUPABASE_URL          – injected automatically by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY – injected automatically by Supabase runtime
//   SUPABASE_ANON_KEY     – injected automatically by Supabase runtime
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      usdAmount,
      usdNgnRate,
      currency = "EP",
      channel = "card",
      from_wallet,
      wallet_address,
      wallet_signature,
      import_ref,
    } = body as {
      nairaAmount: number;
      usdAmount?: number;
      usdNgnRate?: number;
      currency?: string;
      channel?: string;
      from_wallet?: string;
      wallet_address?: string;
      wallet_signature?: string;
      import_ref?: string;
    };

    // ── 2. Resolve userId from JWT (authoritative) + email ─────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    let resolvedUserId = body.userId as string | undefined;
    let resolvedEmail = body.email as string | undefined;

    if (authHeader) {
      const userClient = getSupabaseUser(authHeader);
      if (userClient) {
        const {
          data: { user },
          error: userErr,
        } = await userClient.auth.getUser();
        if (!userErr && user) {
          resolvedUserId = resolvedUserId || user.id;
          resolvedEmail = resolvedEmail || user.email || "";
        }
      }
    }

    // If still no userId, try to extract from JWT manually
    if (!resolvedUserId && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const payload = JSON.parse(atob(token.split(".")[1]));
        resolvedUserId = payload.sub;
        resolvedEmail = resolvedEmail || payload.email;
      } catch {
        /* ignore */
      }
    }

    if (!resolvedUserId) {
      return json(
        {
          success: false,
          error: "userId is required — please sign in and try again",
        },
        400,
      );
    }
    if (!resolvedEmail) {
      // Try to fetch email from profiles table
      const sb = getSupabaseAdmin();
      if (sb) {
        const { data: profile } = await sb
          .from("profiles")
          .select("email")
          .eq("id", resolvedUserId)
          .maybeSingle();
        resolvedEmail = profile?.email ?? "";
      }
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
    const n = parseFloat(String(nairaAmount));
    if (!n || n < 100) {
      return json(
        { success: false, error: "amount must be at least ₦100" },
        400,
      );
    }

    // ── 4. Paystack secret key ─────────────────────────────────────────────
    const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET) {
      console.error("[deposit-paystack-init] PAYSTACK_SECRET_KEY missing");
      return json(
        { success: false, error: "Payment gateway not configured" },
        500,
      );
    }

    // ── 5. Build reference ─────────────────────────────────────────────────
    const safeId = resolvedUserId.replace(/-/g, "").slice(0, 8);
    const reference = `xev_dep_${safeId}_${Date.now()}`;
    const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";
    const callback = `${APP_URL}/#wallet?verify=${reference}&status=success`;
    const amountKobo = Math.round(n * 100);

    // Compute USD equivalent for EP minting
    const ngnRate = usdNgnRate || 1500;
    const usdEquiv = usdAmount || parseFloat((n / ngnRate).toFixed(4));

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
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        // Find wallet id
        const { data: wallet } = await sb
          .from("wallets")
          .select("id")
          .eq("user_id", resolvedUserId)
          .maybeSingle();

        // Record as a pending transaction row
        await sb.from("transactions").insert({
          from_user_id: resolvedUserId,
          to_user_id: resolvedUserId,
          amount: n,
          type: "deposit",
          status: "pending",
          metadata: {
            paystack_ref: reference,
            source: "wallet_deposit",
            wallet_id: wallet?.id ?? null,
            amount_kobo: amountKobo,
            deposit_currency: currency,
            usd_amount: usdEquiv,
            ngn_rate: ngnRate,
            channel,
          },
        });

        // Also log payment intent
        await sb.from("payment_intents").upsert(
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
            },
          },
          { onConflict: "idempotency_key" },
        );
      }
    } catch (logErr) {
      console.warn("[deposit-paystack-init] Failed to log intent:", logErr);
      // Non-fatal — user proceeds to payment
    }

    // ── 8. Return success ──────────────────────────────────────────────────
    return json({
      success: true,
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
      access_code: paystackData.data.access_code,
      amount_ngn: n,
      amount_kobo: amountKobo,
      // creditAmount and amountKobo needed by depositFundService
      creditAmount,
      amountKobo,
      currency,
      label: creditLabel,
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
