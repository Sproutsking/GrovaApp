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
  resolvePaymentPrice,
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

  const { product_id, founders_order_id, idempotency_key, callback_url, invite_code_id } = body as {
    product_id:             string;
    founders_order_id?:      string;
    idempotency_key:        string;
    callback_url:           string;
    invite_code_id?:        string;
  };

  if ((!product_id && !founders_order_id) || !idempotency_key || !callback_url) {
    return errorResponse(
      "Missing required fields: product_id or founders_order_id, idempotency_key, callback_url",
      400, "MISSING_FIELDS",
    );
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if ((product_id && !UUID_RE.test(product_id))
    || (founders_order_id && !UUID_RE.test(founders_order_id))
    || !UUID_RE.test(idempotency_key)) {
    return errorResponse(
      "product_id, founders_order_id, and idempotency_key must be valid UUID v4 values",
      400, "INVALID_FIELDS",
    );
  }

  const db = supabaseAdmin();

  // ── 3. Rate limit ────────────────────────────────────────────────────────
  if (!(await checkPaymentRateLimit(userId))) {
    return errorResponse("Too many payment attempts. Please wait a few minutes.", 429, "RATE_LIMITED");
  }
  if (founders_order_id) {
    const { error: expiryError } = await db.rpc("expire_founders_card_orders");
    if (expiryError) {
      console.error("[paystack-create] Could not expire stale founders-card reservations:", expiryError.message);
      return errorResponse("Could not verify the card reservation. Please retry shortly.", 503, "RESERVATION_CHECK_FAILED");
    }
  }

  // ── 4. Idempotency ───────────────────────────────────────────────────────
  let existing: { status: string; provider_session: string | null; metadata: Record<string, unknown> | null } | null = null;
  let founderOrder: {
    id: string;
    user_id: string;
    status: string;
    provider: string;
    total_price: number;
    currency: string;
  } | null = null;
  let founderPayment: {
    provider_reference: string;
    amount_minor: number;
    checkout_url: string | null;
    status: string;
  } | null = null;

  if (founders_order_id) {
    const { data: order, error: orderErr } = await db
      .from("founders_card_orders")
      .select("id,user_id,status,provider,total_price,currency,expires_at,provider_reference")
      .eq("id", founders_order_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (orderErr || !order) {
      return errorResponse("Founders-card order not found.", 404, "ORDER_NOT_FOUND");
    }
    if (order.provider !== "paystack") {
      return errorResponse("This order was not reserved for Paystack.", 409, "PROVIDER_MISMATCH");
    }
    if (order.status === "paid") return jsonResponse({ already_completed: true });
    if (order.status !== "pending" || new Date(order.expires_at) <= new Date()) {
      return errorResponse("This founders-card reservation has expired.", 410, "ORDER_EXPIRED");
    }
    founderOrder = order;

    const { data: payment, error: paymentErr } = await db
      .from("founders_card_payments")
      .select("provider_reference,amount_minor,checkout_url,status")
      .eq("order_id", order.id)
      .eq("provider", "paystack")
      .maybeSingle();
    if (paymentErr) {
      return errorResponse("Could not load the founders-card payment.", 500, "PAYMENT_LOOKUP_FAILED");
    }
    founderPayment = payment;
    if (payment?.status === "completed") return jsonResponse({ already_completed: true });
    if (payment?.checkout_url) {
      return jsonResponse({
        authorization_url: payment.checkout_url,
        reference: payment.provider_reference,
      });
    }
    if (payment?.status === "initializing") {
      return errorResponse("Your Paystack checkout is being prepared. Please wait a moment before retrying.", 409, "CHECKOUT_INITIALIZING");
    }
  } else {
    const { data: intent, error: intentLookupError } = await db
      .from("payment_intents")
      .select("user_id,product_id,status,provider_session,metadata")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();
    if (intentLookupError) {
      console.error("[paystack-create] Could not verify payment idempotency:", intentLookupError.message);
      return errorResponse("Could not verify this payment attempt. Please retry.", 503, "IDEMPOTENCY_CHECK_FAILED");
    }
    if (intent && intent.user_id !== userId) {
      return errorResponse("This payment idempotency key belongs to another account.", 409, "IDEMPOTENCY_CONFLICT");
    }
    if (intent && intent.product_id !== product_id) {
      return errorResponse("This payment idempotency key is already associated with another product.", 409, "IDEMPOTENCY_CONFLICT");
    }
    const intentMetadata = intent?.metadata as Record<string, unknown> | null;
    if (intent && (intentMetadata?.invite_code_id ?? null) !== (invite_code_id ?? null)) {
      return errorResponse("This payment idempotency key is already associated with another invitation.", 409, "IDEMPOTENCY_CONFLICT");
    }
    existing = intent;

    if (existing?.status === "completed") {
      return jsonResponse({ already_completed: true });
    }
    if (existing?.status === "created" && intentMetadata?.checkout_state === "initializing") {
      return errorResponse("Your payment checkout is being prepared. Please wait before retrying.", 409, "CHECKOUT_INITIALIZING");
    }

    const existingMeta = existing?.metadata as Record<string, unknown> | null;
    if (existing?.provider_session && existingMeta?.authorization_url) {
      console.log(`[paystack-create] Returning cached session key=${idempotency_key}`);
      return jsonResponse({
        authorization_url: existingMeta.authorization_url,
        reference:         existing.provider_session,
      });
    }
  }

  // ── 5. Fetch product ─────────────────────────────────────────────────────
  let product: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    tier: string;
    amount_usd: number;
    currency: string;
    paystack_plan_code: string | null;
    metadata: Record<string, unknown>;
  } | null = null;
  if (product_id) {
    const { data: row, error: productErr } = await db
      .from("payment_products")
      .select("id, name, description, type, tier, amount_usd, currency, paystack_plan_code, metadata")
      .eq("id", product_id)
      .eq("is_active", true)
      .maybeSingle();
    if (productErr || !row) {
      console.error("[paystack-create] Product not found:", product_id, productErr?.message);
      return errorResponse("Invalid or inactive product.", 404, "INVALID_PRODUCT");
    }
    product = row;
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
  let resolvedInviteCodeId: string | null = null;
  let productAmountUSD = founderOrder
    ? Number(founderOrder.total_price)
    : Number(product?.amount_usd);
  if (!founderOrder) {
    if (!product) {
      return errorResponse("A valid product_id is required for this payment.", 400, "INVALID_PRODUCT");
    }
    try {
      const resolvedPrice = await resolvePaymentPrice(db, productAmountUSD, invite_code_id);
      productAmountUSD = resolvedPrice.amountUSD;
      resolvedInviteCodeId = resolvedPrice.inviteCodeId;
    } catch (priceError) {
      return errorResponse(
        priceError instanceof Error ? priceError.message : "Could not verify the payment price.",
        400,
        "INVALID_PAYMENT_PRICE",
      );
    }
  }
  const productKobo      = Math.round(productAmountUSD * ngnRate * 100);
  const amountKobo = productKobo;

  console.log(`[paystack-create] Final charge: ₦${(amountKobo / 100).toLocaleString()} (${amountKobo} kobo) rate=${ngnRate}`);

  // ── 8. Build reference + payload ─────────────────────────────────────────
  const reference     = founderOrder
    ? `xv_fc_${founderOrder.id.replace(/-/g, "")}`
    : `xv_${idempotency_key.replace(/-/g, "").slice(0, 18)}_${Date.now()}`;
  const cleanCallback = callback_url.split("?")[0].split("#")[0];
  const completeCallback = founderOrder
    ? `${cleanCallback}?founders_order_id=${founderOrder.id}`
    : `${cleanCallback}?ref=${reference}&product_id=${product?.id}`;
  const intentExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const paystackPayload: Record<string, unknown> = {
    email,
    amount:   amountKobo,
    reference,
    // [FIX-1] Always "NGN" — payment_products.currency defaults to "USD" but
    // our amount is ALWAYS calculated in NGN kobo. Sending "USD" with a kobo
    // amount caused Paystack to reject the transaction (502 Bad Gateway).
    currency: "NGN",
    callback_url: completeCallback,
    metadata: {
      custom_fields: [
        { display_name: "Product", variable_name: "product_name", value: founderOrder ? "Xeevia Founders Card" : product?.name },
        { display_name: "Tier",    variable_name: "tier",         value: founderOrder ? "Founders Card" : product?.tier },
        { display_name: "Amount",  variable_name: "amount_usd",   value: `$${(amountKobo / ngnRate / 100).toFixed(2)} (₦${(amountKobo / 100).toLocaleString()})` },
      ],
      user_id:          userId,
      ...(product ? { product_id: product.id } : {}),
      ...(resolvedInviteCodeId ? { invite_code_id: resolvedInviteCodeId } : {}),
      idempotency_key,
      tier:             founderOrder ? "founders_card" : product?.tier,
      payment_purpose:  founderOrder ? "founders_card_purchase" : "account_access",
      ...(founderOrder ? {
        purchase_kind: "founders_card",
        founders_order_id: founderOrder.id,
      } : {}),
      cancel_action:    cleanCallback,
    },
  };

  if (!founderOrder && product?.type === "subscription" && product.paystack_plan_code) {
    paystackPayload["plan"] = product.paystack_plan_code;
  }

  // ── 9. Call Paystack API ──────────────────────────────────────────────────
  const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  console.log(`[paystack-create] Initializing user=${userId} amount=₦${(amountKobo / 100).toLocaleString()} ($${(amountKobo / ngnRate / 100).toFixed(2)})`);

  if (founderOrder) {
    const { data: policy, error: policyError } = await db
      .from("founders_card_policy")
      .select("reservation_hours")
      .eq("singleton", true)
      .maybeSingle();
    if (policyError || !policy) {
      console.error("[paystack-create] Could not load founders-card reservation policy:", policyError?.message);
      return errorResponse("Could not load the card reservation policy. No checkout was started.", 503, "POLICY_LOOKUP_FAILED");
    }

    const { data: updatedOrder, error: reservationUpdateError } = await db
      .from("founders_card_orders")
      .update({
        provider_reference: reference,
        expires_at: new Date(Date.now() + Number(policy.reservation_hours) * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", founderOrder.id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (reservationUpdateError || !updatedOrder) {
      console.error("[paystack-create] Could not update founders-card reservation expiry:", reservationUpdateError?.message);
      return errorResponse("Could not update the card reservation expiry. No checkout was started.", 503, "RESERVATION_UPDATE_FAILED");
    }

    const { error: paymentErr } = await db.from("founders_card_payments").upsert(
      {
        order_id: founderOrder.id,
        provider: "paystack",
        provider_reference: reference,
        amount_minor: amountKobo,
        currency: "NGN",
        status: "initializing",
        checkout_url: null,
        metadata: {
          payment_purpose: "founders_card_purchase",
          founders_order_id: founderOrder.id,
          ngn_rate: ngnRate,
          idempotency_key,
        },
      },
      { onConflict: "order_id,provider" },
    );
    if (paymentErr) {
      console.error("[paystack-create] Could not reserve payment reference:", paymentErr.message);
      return errorResponse("Could not record this payment attempt. No checkout was started.", 500, "PAYMENT_RECORD_FAILED");
    }
  }

  if (!founderOrder && product) {
    const { error: reserveIntentError } = await db.from("payment_intents").upsert(
      {
        user_id: userId,
        product_id: product.id,
        idempotency_key,
        provider: "paystack",
        provider_session: reference,
        amount_cents: amountKobo,
        currency: "NGN",
        status: "created",
        expires_at: intentExpiry,
        metadata: {
          checkout_state: "initializing",
          invite_code_id: resolvedInviteCodeId,
          amount_usd: productAmountUSD,
          ngn_rate: ngnRate,
        },
      },
      { onConflict: "idempotency_key" },
    );
    if (reserveIntentError) {
      console.error("[paystack-create] Could not reserve the priced payment intent:", reserveIntentError.message);
      return errorResponse("Could not safely reserve this payment attempt. No checkout was started.", 503, "INTENT_RESERVATION_FAILED");
    }
  }

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
    if (!founderOrder) {
      const { error: intentFailureError } = await db
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("idempotency_key", idempotency_key)
        .eq("user_id", userId)
        .eq("provider_session", reference);
      if (intentFailureError) {
        console.error("[paystack-create] Could not release failed checkout intent:", intentFailureError.message);
      }
    }
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
  if (founderOrder) {
    const { error: paymentErr } = await db
      .from("founders_card_payments")
      .update({
        status: "pending",
        checkout_url: authorization_url,
        metadata: {
          payment_purpose: "founders_card_purchase",
          founders_order_id: founderOrder.id,
          access_code,
          ngn_rate: ngnRate,
          idempotency_key,
        },
      })
      .eq("order_id", founderOrder.id)
      .eq("provider", "paystack")
      .eq("provider_reference", reference);
    if (paymentErr) {
      console.error("[paystack-create] Founders-card payment store failed:", paymentErr.message);
      return errorResponse("Payment link was created but could not be recorded. Contact support before retrying.", 500, "PAYMENT_RECORD_FAILED");
    }
    await db
      .from("founders_card_orders")
      .update({ provider_reference: reference, updated_at: new Date().toISOString() })
      .eq("id", founderOrder.id)
      .eq("user_id", userId);
    return jsonResponse({ authorization_url, reference });
  }

  if (!product) {
    return errorResponse("A valid product_id is required for this payment.", 400, "INVALID_PRODUCT");
  }

  const { error: intentErr } = await db.from("payment_intents")
    .update(
    {
      status: "redirected",
      metadata: {
        checkout_state: "ready",
        authorization_url,
        access_code,
        reference,
        invite_code_id: resolvedInviteCodeId,
        amount_usd: productAmountUSD,
        ngn_rate: ngnRate,
      },
    })
    .eq("idempotency_key", idempotency_key)
    .eq("user_id", userId)
    .eq("provider_session", reference);
  if (intentErr) {
    console.error("[paystack-create] Could not save the created checkout details:", intentErr.message);
    return errorResponse("Checkout was created but could not be saved. Contact support before retrying.", 500, "INTENT_STORE_FAILED");
  }

  return jsonResponse({ authorization_url, reference });
});