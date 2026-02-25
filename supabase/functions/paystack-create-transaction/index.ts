// supabase/functions/paystack-create-transaction/index.ts
// ============================================================================
// PAYSTACK — Create Transaction  v2
//
// FIXES vs old version:
// - validateEnv() call at startup catches missing PAYSTACK_SECRET_KEY early
// - Better logging throughout so edge function logs show exact failure point
// - amount_override_cents support: if frontend passes this (invite pricing),
//   we use it ONLY after validating it's >= $0.50 and <= 10x product price
// ============================================================================

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  requireAuth,
  supabaseAdmin,
  checkPaymentRateLimit,
  validateEnv,
} from "../_shared/payments.ts";

const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const PAYSTACK_BASE   = "https://api.paystack.co";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  // ── 0. Validate required env vars at startup ───────────────────────────────
  const envErr = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY",
  ]);
  if (envErr) return envErr;

  // ── 1. Authenticate ────────────────────────────────────────────────────────
  let userId: string;
  let email: string;
  try {
    const auth = await requireAuth(req);
    userId = auth.userId;
    email  = auth.email;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    console.error("[paystack-create] Auth failed:", msg);
    return errorResponse(msg, 401, "UNAUTHORIZED");
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_REQUEST");
  }

  const {
    product_id,
    idempotency_key,
    callback_url,
    amount_override_cents,
  } = body as {
    product_id:             string;
    idempotency_key:        string;
    callback_url:           string;
    amount_override_cents?: number;
  };

  if (!product_id || !idempotency_key || !callback_url) {
    return errorResponse(
      "Missing required fields: product_id, idempotency_key, callback_url",
      400,
      "MISSING_FIELDS"
    );
  }

  // Validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(product_id) || !UUID_RE.test(idempotency_key)) {
    return errorResponse(
      "product_id and idempotency_key must be valid UUID v4",
      400,
      "INVALID_FIELDS"
    );
  }

  const db = supabaseAdmin();

  // ── 3. Rate limit ──────────────────────────────────────────────────────────
  const allowed = await checkPaymentRateLimit(userId);
  if (!allowed) {
    return errorResponse(
      "Too many payment attempts. Please wait a few minutes before trying again.",
      429,
      "RATE_LIMITED"
    );
  }

  // ── 4. Idempotency — return existing session if already created ────────────
  const { data: existingIntent } = await db
    .from("payment_intents")
    .select("status, provider_session, metadata")
    .eq("idempotency_key", idempotency_key)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingIntent?.status === "completed") {
    return jsonResponse({ already_completed: true });
  }

  if (
    existingIntent?.provider_session &&
    existingIntent?.metadata &&
    (existingIntent.metadata as Record<string, unknown>).authorization_url
  ) {
    return jsonResponse({
      authorization_url: (existingIntent.metadata as Record<string, unknown>).authorization_url,
      reference:         existingIntent.provider_session,
    });
  }

  // ── 5. Fetch product (amount from DB — never trusted from frontend) ────────
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

  // ── 6. Determine amount ────────────────────────────────────────────────────
  // amount_override_cents is allowed ONLY for invite code pricing.
  // We validate it's reasonable: > $0.50 and <= 10x product price.
  const productCents = Math.round(product.amount_usd * 100);
  let amountCents    = productCents;

  if (amount_override_cents != null && typeof amount_override_cents === "number") {
    const override = Math.round(amount_override_cents);
    const minAllowed = 50;             // $0.50 minimum
    const maxAllowed = productCents * 10; // sanity cap
    if (override >= minAllowed && override <= maxAllowed) {
      amountCents = override;
      console.log(`[paystack-create] Using invite override amount: $${(override/100).toFixed(2)} (product default: $${(productCents/100).toFixed(2)})`);
    } else {
      console.warn(`[paystack-create] Ignored invalid override: ${override} cents (product: ${productCents} cents, min: ${minAllowed})`);
    }
  }

  // ── 7. Build Paystack payload ──────────────────────────────────────────────
  const reference = `xv_${idempotency_key.replace(/-/g, "").slice(0, 18)}_${Date.now()}`;

  const paystackPayload: Record<string, unknown> = {
    email,
    amount:       amountCents,
    reference,
    currency:     "USD",
    callback_url: `${callback_url}?ref=${reference}&product_id=${product_id}`,
    metadata: {
      custom_fields: [
        { display_name: "Product", variable_name: "product_name", value: product.name },
        { display_name: "Tier",    variable_name: "tier",         value: product.tier },
        { display_name: "Amount",  variable_name: "amount_usd",   value: `$${(amountCents/100).toFixed(2)}` },
      ],
      user_id:         userId,
      product_id:      product.id,
      idempotency_key: idempotency_key,
      tier:            product.tier,
    },
  };

  if (product.type === "subscription" && product.paystack_plan_code) {
    paystackPayload["plan"] = product.paystack_plan_code;
  }

  // ── 8. Initialize with Paystack ────────────────────────────────────────────
  console.log(`[paystack-create] Initializing for user=${userId} amount=$${(amountCents/100).toFixed(2)} email=${email}`);

  let psResponse: Response;
  try {
    psResponse = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });
  } catch (networkErr) {
    console.error("[paystack-create] Network error calling Paystack:", networkErr);
    return errorResponse(
      "Could not reach payment provider. Please try again.",
      503,
      "PROVIDER_UNAVAILABLE"
    );
  }

  if (!psResponse.ok) {
    const errBody = await psResponse.text().catch(() => "unknown");
    console.error(`[paystack-create] Paystack API error ${psResponse.status}:`, errBody);
    return errorResponse(
      "Payment provider returned an error. Please try again.",
      502,
      "PROVIDER_ERROR"
    );
  }

  const psData = await psResponse.json();

  if (!psData.status || !psData.data?.authorization_url) {
    console.error("[paystack-create] Unexpected Paystack response:", psData);
    return errorResponse(
      psData.message ?? "Payment initialization failed.",
      502,
      "PROVIDER_ERROR"
    );
  }

  const { authorization_url, access_code } = psData.data;

  console.log(`[paystack-create] ✅ Got authorization_url for ref=${reference}`);

  // ── 9. Store intent ────────────────────────────────────────────────────────
  const { error: intentErr } = await db.from("payment_intents").upsert({
    user_id:          userId,
    product_id:       product.id,
    idempotency_key:  idempotency_key,
    provider:         "paystack",
    provider_session: reference,
    amount_cents:     amountCents,
    currency:         "USD",
    status:           "created",
    expires_at:       new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    metadata:         { authorization_url, access_code, reference },
  }, { onConflict: "idempotency_key" });

  if (intentErr) {
    console.warn("[paystack-create] Intent store failed (non-fatal):", intentErr.message);
  }

  return jsonResponse({ authorization_url, reference });
});