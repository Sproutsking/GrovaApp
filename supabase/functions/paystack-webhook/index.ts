// ============================================================================
// supabase/functions/paystack-webhook/index.ts  —  v6 PAYSTACK_SECRET_KEY FIX
// ============================================================================
//
//  ⚠️  PAYSTACK DOES NOT HAVE A SEPARATE WEBHOOK SECRET.
//  They sign webhooks using your PAYSTACK_SECRET_KEY via HMAC-SHA512.
//  The signature is in the header: x-paystack-signature
//
//  Required Supabase secrets for this function:
//    SUPABASE_URL                ← auto-set by Supabase
//    SUPABASE_SERVICE_ROLE_KEY   ← auto-set by Supabase
//    PAYSTACK_SECRET_KEY         ← sk_test_... or sk_live_... (you have this ✅)
//
//  Webhook URL to set in Paystack Dashboard:
//    Settings → API Keys & Webhooks → Test Webhook URL:
//    https://rxtijxlvacqjiocdwzrh.supabase.co/functions/v1/paystack-webhook
//
//  ALWAYS returns HTTP 200 to Paystack — even on activation failure —
//  to prevent infinite retry storms. Failures are logged to webhook_events.
//
// ============================================================================

import {
  corsHeaders,
  supabaseAdmin,
  activateAccount,
  validateEnv,
} from "../_shared/payments.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return new Response("Method not allowed", { status: 405 });

  // ── 0. Validate env — only needs PAYSTACK_SECRET_KEY now ─────────────────
  const envErr = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY",         // ← used for HMAC signing, not a separate secret
  ]);
  if (envErr) {
    // Return 200 so Paystack doesn't retry (can't fix missing secrets by retrying)
    console.error("[paystack-webhook] Missing env vars — cannot process");
    return new Response("ok", { status: 200 });
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  // ── 1. Read raw body FIRST (must be before any .json() call) ─────────────
  let rawBody: string;
  try { rawBody = await req.text(); }
  catch { return new Response("Cannot read body", { status: 400 }); }

  // ── 2. Verify HMAC-SHA512 using PAYSTACK_SECRET_KEY ──────────────────────
  //  Paystack signs: HMAC-SHA512(rawBody, secretKey)
  //  and puts the hex result in header: x-paystack-signature
  const signature = req.headers.get("x-paystack-signature") ?? "";

  if (!signature) {
    console.warn("[paystack-webhook] ⚠️ No x-paystack-signature header — rejecting");
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const sigBuf   = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computed !== signature) {
      console.error("[paystack-webhook] ❌ Signature mismatch — possible spoofed request");
      return new Response("Invalid signature", { status: 400 });
    }
    console.log("[paystack-webhook] ✅ Signature verified");
  } catch (e) {
    console.error("[paystack-webhook] Signature check error:", e);
    return new Response("Signature error", { status: 400 });
  }

  // ── 3. Parse event ────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const eventType = String(event.event ?? "");
  const eventData = (event.data ?? {}) as Record<string, unknown>;
  console.log(`[paystack-webhook] Event: ${eventType}`);

  // Only process successful charges
  if (eventType !== "charge.success") {
    console.log(`[paystack-webhook] Ignoring: ${eventType}`);
    return new Response("ok", { status: 200 });
  }

  const db = supabaseAdmin();
  const { error: expiryError } = await db.rpc("expire_founders_card_orders");
  if (expiryError) {
    console.error("[paystack-webhook] Could not expire stale founders-card reservations:", expiryError.message);
  }

  // ── 4. Extract fields ─────────────────────────────────────────────────────
  const reference     = String(eventData.reference ?? "");
  const status        = String(eventData.status    ?? "");
  const amountCents   = Number(eventData.amount    ?? 0);
  const currency      = String(eventData.currency  ?? "USD");
  const customerEmail = String(
    (eventData.customer as Record<string, unknown>)?.email ?? ""
  );
  const metadata       = (eventData.metadata ?? {}) as Record<string, unknown>;
  const userId         = String(metadata.user_id         ?? "");
  const productId      = String(metadata.product_id      ?? "");
  const idempotencyKey = String(metadata.idempotency_key ?? reference);
  const tier           = String(metadata.tier            ?? "standard");

  if (!reference || status !== "success") {
    console.warn("[paystack-webhook] Not a success event:", status);
    return new Response("ok", { status: 200 });
  }

  // ── 5. Idempotency — never process the same reference twice ──────────────
  const { data: existingEvent } = await db
    .from("webhook_events")
    .select("id, processed")
    .eq("event_id",  reference)
    .eq("provider",  "paystack")
    .maybeSingle();

  if (existingEvent?.processed) {
    console.log(`[paystack-webhook] Already processed ref=${reference}`);
    return new Response("ok", { status: 200 });
  }

  // ── 6. Resolve user — metadata.user_id first, fallback to email ──────────
  let resolvedUserId = userId;
  if (!resolvedUserId && customerEmail) {
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("email", customerEmail)
      .maybeSingle();
    resolvedUserId = profile?.id ?? "";
  }

  if (!resolvedUserId) {
    console.error(
      `[paystack-webhook] ❌ Cannot resolve user for ref=${reference} email=${customerEmail}`
    );
    await logWebhookEvent(db, eventType, reference, eventData, false, null, null);
    return new Response("ok", { status: 200 });
  }

  // Founders cards are assets, not account subscriptions. Fulfill this branch
  // only from the order and amount captured when Paystack checkout was created.
  const purchaseKind = String(metadata.purchase_kind ?? "");
  const paymentPurpose = String(metadata.payment_purpose ?? "");
  const foundersOrderId = String(metadata.founders_order_id ?? "");
  const isFoundersCardPurchase = purchaseKind === "founders_card"
    || paymentPurpose === "founders_card_purchase"
    || Boolean(foundersOrderId);
  if (isFoundersCardPurchase) {
    if (
      !foundersOrderId
      || (purchaseKind !== "founders_card" && paymentPurpose !== "founders_card_purchase")
    ) {
      console.error(`[paystack-webhook] Incomplete founders-card metadata ref=${reference}`);
      await logWebhookEvent(db, eventType, reference, eventData, false, null, resolvedUserId);
      return new Response("ok", { status: 200 });
    }

    const { data: order, error: orderErr } = await db
      .from("founders_card_orders")
      .select("id,user_id,status,provider,provider_reference,expires_at")
      .eq("id", foundersOrderId)
      .maybeSingle();
    if (orderErr || !order || order.user_id !== resolvedUserId
      || order.provider !== "paystack" || order.provider_reference !== reference) {
      console.error(`[paystack-webhook] Founders-card order mismatch ref=${reference}`, orderErr?.message);
      await logWebhookEvent(db, eventType, reference, eventData, false, null, resolvedUserId);
      return new Response("ok", { status: 200 });
    }

    const { data: cardPayment, error: cardPaymentErr } = await db
      .from("founders_card_payments")
      .select("id,amount_minor,currency,status")
      .eq("order_id", order.id)
      .eq("provider", "paystack")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (cardPaymentErr || !cardPayment
      || Number(cardPayment.amount_minor) !== amountCents
      || cardPayment.currency !== currency
      || !["initializing", "pending", "completed", "failed", "refund_required", "refund_pending", "refunded"].includes(cardPayment.status)) {
      console.error(`[paystack-webhook] Founders-card amount/payment mismatch ref=${reference}`, cardPaymentErr?.message);
      await logWebhookEvent(db, eventType, reference, eventData, false, null, resolvedUserId);
      return new Response("ok", { status: 200 });
    }

    if (order.status === "paid") {
      await logWebhookEvent(db, eventType, reference, eventData, true, null, resolvedUserId);
      return new Response("ok", { status: 200 });
    }

    if (order.status !== "pending" || new Date(order.expires_at) <= new Date()) {
      if (cardPayment.status === "refunded" || cardPayment.status === "refund_pending") {
        await logWebhookEvent(db, eventType, reference, eventData, true, null, resolvedUserId);
        return new Response("ok", { status: 200 });
      }

      let refundStatus = "refund_required";
      let refundFailure = "Reservation expired after payment; refund needs manual follow-up.";
      let followupRecorded = false;
      const { data: policy, error: policyError } = await db
        .from("founders_card_policy")
        .select("late_paystack_action")
        .eq("singleton", true)
        .maybeSingle();
      if (policyError || !policy) {
        refundFailure = `Could not load the late-payment policy; manual refund follow-up required. ${policyError?.message ?? ""}`.trim();
      } else if (policy.late_paystack_action === "manual_review") {
        refundFailure = "Reservation expired after payment; manual refund requested by founders-card policy.";
        followupRecorded = true;
      } else {
        try {
          const refundResponse = await fetch("https://api.paystack.co/refund", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transaction: reference,
              amount: amountCents,
              customer_note: "Founders Card reservation expired before payment was confirmed.",
            }),
          });
          const refundResult = await refundResponse.json() as {
            status?: boolean;
            message?: string;
            data?: { status?: string };
          };
          const providerStatus = String(refundResult.data?.status ?? "").toLowerCase();
          if (refundResponse.ok && refundResult.status) {
            if (providerStatus === "processed") {
              refundStatus = "refunded";
              refundFailure = "";
            } else if (providerStatus === "failed" || providerStatus === "needs-attention") {
              refundFailure = `Paystack refund status: ${providerStatus}.`;
            } else {
              refundStatus = "refund_pending";
              refundFailure = `Paystack refund status: ${providerStatus || "pending confirmation"}.`;
            }
          } else {
            refundFailure = refundResult.message || `Paystack refund request failed (${refundResponse.status}).`;
          }
        } catch (refundError) {
          refundFailure = refundError instanceof Error
            ? `Paystack refund request failed: ${refundError.message}`
            : "Paystack refund request failed.";
        }
      }

      const { error: refundUpdateError } = await db
        .from("founders_card_payments")
        .update({
          status: refundStatus,
          failure_reason: refundFailure || null,
        })
        .eq("id", cardPayment.id);
      if (refundUpdateError) {
        console.error(`[paystack-webhook] Could not save late-payment refund status ref=${reference}:`, refundUpdateError.message);
        await logWebhookEvent(db, eventType, reference, eventData, false, null, resolvedUserId);
      } else {
        await logWebhookEvent(db, eventType, reference, eventData, refundStatus !== "refund_required" || followupRecorded, null, resolvedUserId);
      }
      console.error(`[paystack-webhook] Late founders-card payment ref=${reference}; status=${refundStatus}; ${refundFailure}`);
      return new Response("ok", { status: 200 });
    }

    const { error: settleError } = await db.rpc("settle_founders_card_order", {
      p_order_id: order.id,
      p_provider: "paystack",
      p_provider_reference: reference,
      p_amount_minor: amountCents,
      p_currency: currency,
    });
    if (settleError) {
      console.error(`[paystack-webhook] Founders-card settlement failed ref=${reference}:`, settleError.message);
      await logWebhookEvent(db, eventType, reference, eventData, false, null, resolvedUserId);
      return new Response("ok", { status: 200 });
    }

    await logWebhookEvent(db, eventType, reference, eventData, true, null, resolvedUserId);
    console.log(`[paystack-webhook] ✅ Founders card order=${order.id} settled ref=${reference}`);
    return new Response("ok", { status: 200 });
  }

  const { data: paymentIntent, error: paymentIntentError } = await db
    .from("payment_intents")
    .select("user_id,product_id,provider,provider_session,amount_cents,currency,status,metadata")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (paymentIntentError) {
    console.error(`[paystack-webhook] Could not verify payment intent ref=${reference}:`, paymentIntentError.message);
    return new Response("Temporary payment verification failure.", { status: 503 });
  }
  if (
    !paymentIntent ||
    paymentIntent.user_id !== resolvedUserId ||
    paymentIntent.product_id !== productId ||
    paymentIntent.provider !== "paystack" ||
    paymentIntent.provider_session !== reference ||
    !["created", "redirected", "completed"].includes(paymentIntent.status) ||
    Number(paymentIntent.amount_cents) !== amountCents ||
    String(paymentIntent.currency).toUpperCase() !== currency.toUpperCase() ||
    currency.toUpperCase() !== "NGN"
  ) {
    console.error(`[paystack-webhook] Payment intent mismatch ref=${reference}`);
    await logWebhookEvent(db, eventType, reference, eventData, false, null, resolvedUserId);
    return new Response("ok", { status: 200 });
  }

  // ── 7. Resolve product ────────────────────────────────────────────────────
  let resolvedProductId = productId;
  let productMeta: Record<string, unknown> = {};
  let resolvedTier = tier;

  if (resolvedProductId) {
    const { data: prod } = await db
      .from("payment_products")
      .select("id, tier, metadata")
      .eq("id", resolvedProductId)
      .maybeSingle();
    if (prod) {
      resolvedTier = prod.tier ?? tier;
      productMeta  = (prod.metadata as Record<string, unknown>) ?? {};
    }
  } else {
    // Fallback: cheapest active product
    const { data: defaultProd } = await db
      .from("payment_products")
      .select("id, tier, metadata")
      .eq("is_active", true)
      .order("amount_usd", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (defaultProd) {
      resolvedProductId = defaultProd.id;
      resolvedTier      = defaultProd.tier ?? tier;
      productMeta       = (defaultProd.metadata as Record<string, unknown>) ?? {};
    }
  }

  // ── 8. Record payment ─────────────────────────────────────────────────────
  let paymentId: string | null = null;
  try {
    const payRecord: Record<string, unknown> = {
      user_id:             resolvedUserId,
      provider:            "paystack",
      provider_payment_id: reference,
      amount_cents:        amountCents,
      currency,
      status:              "completed",
      idempotency_key:     idempotencyKey,
      webhook_received_at: new Date().toISOString(),
      completed_at:        new Date().toISOString(),
      metadata: {
        paystack_reference: reference,
        customer_email:     customerEmail,
        tier:               resolvedTier,
        invite_code_id:     paymentIntent.metadata?.invite_code_id ?? null,
      },
    };
    if (resolvedProductId) payRecord["product_id"] = resolvedProductId;

    const { data: payment, error: payErr } = await db
      .from("payments")
      .upsert(payRecord, { onConflict: "idempotency_key" })
      .select("id")
      .single();

    if (payErr) console.warn("[paystack-webhook] Payment record warning:", payErr.message);
    else paymentId = payment?.id ?? null;
  } catch (e) {
    console.error("[paystack-webhook] Payment record error:", e);
  }

  // ── 9. Activate account ───────────────────────────────────────────────────
  let activationError: string | null = null;
  try {
    await activateAccount(
      resolvedUserId,
      resolvedTier,
      productMeta,
      paymentId,
      resolvedProductId || null,
    );
    console.log(
      `[paystack-webhook] ✅ Activated user=${resolvedUserId} tier=${resolvedTier}`
    );
  } catch (e) {
    activationError = e instanceof Error ? e.message : String(e);
    console.error(`[paystack-webhook] ❌ Activation failed:`, activationError);
    // DON'T return error — Paystack would retry → duplicate payments
  }

  if (!activationError && typeof paymentIntent.metadata?.invite_code_id === "string") {
    const { error: inviteUseError } = await db.rpc("increment_invite_uses", {
      p_invite_id: paymentIntent.metadata.invite_code_id,
    });
    if (inviteUseError) {
      console.error(`[paystack-webhook] Could not update invite usage for ref=${reference}:`, inviteUseError.message);
    }
  }

  // ── 10. Mark payment_intent completed ────────────────────────────────────
  const { error: intentUpdateError } = await db
    .from("payment_intents")
    .update({ status: "completed" })
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", resolvedUserId);
  if (intentUpdateError) {
    console.error("[paystack-webhook] Could not mark payment intent complete:", intentUpdateError.message);
  }

  // ── 11. Log webhook event ─────────────────────────────────────────────────
  await logWebhookEvent(
    db, eventType, reference, eventData,
    !activationError, paymentId, resolvedUserId,
  );

  // ALWAYS 200 — Paystack will retry forever on non-200 → duplicate charges
  return new Response("ok", { status: 200 });
});

// ── logWebhookEvent ───────────────────────────────────────────────────────────
async function logWebhookEvent(
  db:        ReturnType<typeof supabaseAdmin>,
  eventType: string,
  reference: string,
  payload:   unknown,
  processed: boolean,
  paymentId: string | null,
  userId:    string | null,
): Promise<void> {
  try {
    await db.from("webhook_events").upsert(
      {
        provider:     "paystack",
        event_id:     reference,
        event_type:   eventType,
        payload,
        verified:     true,
        processed,
        payment_id:   paymentId,
        processed_at: processed ? new Date().toISOString() : null,
      },
      { onConflict: "provider, event_id" },
    );
  } catch (e) {
    console.warn("[webhook] Log failed (non-fatal):", e);
  }
}