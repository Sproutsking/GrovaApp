// ============================================================================
// supabase/functions/paystack-create-transaction/index.ts  —  v9 CURRENCY_FIX
// ============================================================================
//
// CHANGES vs v8:
//   [FIX-1] CRITICAL: currency in Paystack payload hardcoded to "NGN".
//           v8 used (product.currency ?? "NGN").toUpperCase() which read
//           "USD" from payment_products (the table default), then sent
//           currency:"USD" to Paystack while amount was already in NGN kobo.
//           Paystack rejected this mismatch → 502 Bad Gateway.
//           Fix: always send currency:"NGN" since we ALWAYS convert to kobo.
//
// REQUIRED SECRETS (set in Dashboard → Settings → Edge Functions → Secrets):
//   PAYSTACK_SECRET_KEY = sk_live_...   (from Paystack Dashboard → Settings → API)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected — do NOT set them.
// ============================================================================

import {
  corsHeaders, errorResponse, jsonResponse,
  requireAuth, supabaseAdmin, checkPaymentRateLimit, validateEnv, AuthError,
} from "../_shared/payments.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  // ── 0. Validate env FIRST ────────────────────────────────────────────────
  const envErr = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY",
  ]);
  if (envErr) return envErr;

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  let userId: string, email: string;
  try {
    ({ userId, email } = await requireAuth(req));
  } catch (e) {
    const msg  = e instanceof Error ? e.message : "Unauthorized";
    const code = (e instanceof AuthError) ? e.code : "UNAUTHORIZED";
    const http = code === "SERVER_MISCONFIGURED" ? 503 : 401;
    console.error(`[paystack-create] Auth failed [${code}]:`, msg);
    return errorResponse(msg, http, code);
  }

  // ── 2. Parse + validate body ─────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400, "INVALID_REQUEST"); }

  const { product_id, idempotency_key, callback_url, amount_override_cents } = body as {
    product_id:             string;
    idempotency_key:        string;
    callback_url:           string;
    amount_override_cents?: number | null;
  };

  if (!product_id || !idempotency_key || !callback_url) {
    return errorResponse(
      "Missing required fields: product_id, idempotency_key, callback_url",
      400, "MISSING_FIELDS",
    );
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(product_id) || !UUID_RE.test(idempotency_key)) {
    return errorResponse(
      "product_id and idempotency_key must be valid UUID v4",
      400, "INVALID_FIELDS",
    );
  }

  const db = supabaseAdmin();

  // ── 3. Rate limit ────────────────────────────────────────────────────────
  if (!(await checkPaymentRateLimit(userId))) {
    return errorResponse("Too many payment attempts. Please wait a few minutes.", 429, "RATE_LIMITED");
  }

  // ── 4. Idempotency ───────────────────────────────────────────────────────
  const { data: existing } = await db
    .from("payment_intents")
    .select("status, provider_session, metadata")
    .eq("idempotency_key", idempotency_key)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.status === "completed") {
    return jsonResponse({ already_completed: true });
  }

  const existingMeta = existing?.metadata as Record<string, unknown> | null;
  if (existing?.provider_session && existingMeta?.authorization_url) {
    console.log(`[paystack-create] Returning cached session key=${idempotency_key}`);
    return jsonResponse({
      authorization_url: existingMeta.authorization_url,
      reference:         existing.provider_session,
    });
  }

  // ── 5. Fetch product ─────────────────────────────────────────────────────
  const { data: product, error: productErr } = await db
    .from("payment_products")
    .select("id, name, description, type, tier, amount_usd, currency, paystack_plan_code, metadata")
    .eq("id", product_id)
    .eq("is_active", true)
    .maybeSingle();

  if (productErr || !product) {
    console.error("[paystack-create] Product not found:", product_id, productErr?.message);
    return errorResponse("Invalid or inactive product.", 404, "INVALID_PRODUCT");
  }

  // ── 6. Fetch NGN conversion rate from platform_settings ──────────────────
  const FALLBACK_NGN_RATE = 1580;
  let ngnRate = FALLBACK_NGN_RATE;

  try {
    const { data: rateRow } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle();

    const storedRate = rateRow?.value?.ngn_rate;
    if (storedRate && typeof storedRate === "number" && storedRate >= 100) {
      ngnRate = storedRate;
      console.log(`[paystack-create] NGN rate from DB: ${ngnRate}`);
    } else {
      console.log(`[paystack-create] NGN rate fallback: ${ngnRate}`);
    }
  } catch (rateErr) {
    console.warn("[paystack-create] Could not fetch NGN rate (using fallback):", rateErr);
  }

  // ── 7. Determine amount in NGN kobo ──────────────────────────────────────
  // product.amount_usd is the USD price (e.g. 4 = $4)
  // We convert: USD * ngnRate * 100 = kobo
  // e.g. $4 * 1580 * 100 = 632,000 kobo = ₦6,320
  const productAmountUSD = product.amount_usd;
  const productKobo      = Math.round(productAmountUSD * ngnRate * 100);
  let   amountKobo       = productKobo;

  if (amount_override_cents != null && typeof amount_override_cents === "number") {
    // amount_override_cents arrives as USD cents from frontend (e.g. $2 = 200)
    // Convert to NGN kobo: (override / 100) * ngnRate * 100 = override * ngnRate
    const overrideUSD  = amount_override_cents / 100;
    const overrideKobo = Math.round(overrideUSD * ngnRate * 100);

    const minKobo = 5000;
    if (overrideKobo >= minKobo && overrideKobo <= productKobo * 10) {
      amountKobo = overrideKobo;
      console.log(`[paystack-create] Invite override: $${overrideUSD.toFixed(2)} × ₦${ngnRate} = ₦${(overrideKobo / 100).toLocaleString()}`);
    } else if (overrideKobo < minKobo) {
      console.warn(`[paystack-create] Override too low (₦${overrideKobo / 100}), using product price`);
    } else {
      console.warn(`[paystack-create] Override too high (₦${overrideKobo / 100}), using product price`);
    }
  }

  console.log(`[paystack-create] Final charge: ₦${(amountKobo / 100).toLocaleString()} (${amountKobo} kobo) rate=${ngnRate}`);

  // ── 8. Build reference + payload ─────────────────────────────────────────
  const reference     = `xv_${idempotency_key.replace(/-/g, "").slice(0, 18)}_${Date.now()}`;
  const cleanCallback = callback_url.split("?")[0].split("#")[0];

  const paystackPayload: Record<string, unknown> = {
    email,
    amount:   amountKobo,
    reference,
    // [FIX-1] Always "NGN" — payment_products.currency defaults to "USD" but
    // our amount is ALWAYS calculated in NGN kobo. Sending "USD" with a kobo
    // amount caused Paystack to reject the transaction (502 Bad Gateway).
    currency: "NGN",
    callback_url: `${cleanCallback}?ref=${reference}&product_id=${product.id}`,
    metadata: {
      custom_fields: [
        { display_name: "Product", variable_name: "product_name", value: product.name },
        { display_name: "Tier",    variable_name: "tier",         value: product.tier },
        { display_name: "Amount",  variable_name: "amount_usd",   value: `$${(amountKobo / ngnRate / 100).toFixed(2)} (₦${(amountKobo / 100).toLocaleString()})` },
      ],
      user_id:          userId,
      product_id:       product.id,
      idempotency_key,
      tier:             product.tier,
      cancel_action:    cleanCallback,
    },
  };

  if (product.type === "subscription" && product.paystack_plan_code) {
    paystackPayload["plan"] = product.paystack_plan_code;
  }

  // ── 9. Call Paystack API ──────────────────────────────────────────────────
  const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  console.log(`[paystack-create] Initializing user=${userId} amount=₦${(amountKobo / 100).toLocaleString()} ($${(amountKobo / ngnRate / 100).toFixed(2)})`);

  let psRes: Response;
  try {
    psRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method:  "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
      body:    JSON.stringify(paystackPayload),
    });
  } catch (networkErr) {
    console.error("[paystack-create] Network error:", networkErr);
    return errorResponse(
      "Could not reach the payment provider. Please check your connection and try again.",
      503, "PROVIDER_UNAVAILABLE",
    );
  }

  if (!psRes.ok) {
    const errText = await psRes.text().catch(() => "");
    console.error(`[paystack-create] Paystack ${psRes.status}:`, errText);
    if (psRes.status === 401) {
      return errorResponse(
        "Payment provider rejected credentials — check PAYSTACK_SECRET_KEY in edge fn secrets.",
        502, "PROVIDER_AUTH_ERROR",
      );
    }
    return errorResponse("Payment provider returned an error. Please try again.", 502, "PROVIDER_ERROR");
  }

  let psData: { status: boolean; message?: string; data?: { authorization_url: string; access_code: string } };
  try { psData = await psRes.json(); }
  catch { return errorResponse("Invalid response from payment provider.", 502, "PROVIDER_ERROR"); }

  if (!psData.status || !psData.data?.authorization_url) {
    console.error("[paystack-create] Unexpected Paystack response:", psData);
    return errorResponse(psData.message ?? "Payment initialization failed.", 502, "PROVIDER_ERROR");
  }

  const { authorization_url, access_code } = psData.data;
  console.log(`[paystack-create] ✅ authorization_url obtained ref=${reference}`);

  // ── 10. Store payment intent ──────────────────────────────────────────────
  const { error: intentErr } = await db.from("payment_intents").upsert(
    {
      user_id:          userId,
      product_id:       product.id,
      idempotency_key,
      provider:         "paystack",
      provider_session: reference,
      amount_cents:     amountKobo,
      currency:         "NGN",
      status:           "created",
      expires_at:       new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      metadata:         { authorization_url, access_code, reference },
    },
    { onConflict: "idempotency_key" },
  );
  if (intentErr) console.warn("[paystack-create] Intent store failed (non-fatal):", intentErr.message);

  return jsonResponse({ authorization_url, reference });
});