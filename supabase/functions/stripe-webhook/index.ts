// supabase/functions/stripe-webhook/index.ts

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { supabaseAdmin, activateAccount } from "../_shared/payments.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return new Response("Not allowed", { status: 405 });

  const rawBody = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature");

  if (!sig)
    return new Response("Missing stripe-signature header", { status: 400 });

  // ── 1. Verify webhook signature — NEVER skip this ─────────────────────────
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      new Uint8Array(rawBody),
      sig,
      WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response("Webhook signature invalid", { status: 400 });
  }

  const db = supabaseAdmin();

  // ── 2. Log raw event — UNIQUE(provider, event_id) prevents replay attacks ─
  const { data: loggedEvent, error: insertErr } = await db
    .from("webhook_events")
    .insert({
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      payload: event.data.object as Record<string, unknown>,
      signature: sig.slice(0, 500),
      verified: true,
    })
    .select("id")
    .single();

  if (insertErr?.code === "23505") {
    // Duplicate event — already processed or currently processing
    console.log("[stripe-webhook] Duplicate event, skipping:", event.id);
    return new Response("OK", { status: 200 });
  }
  if (insertErr || !loggedEvent) {
    console.error("[stripe-webhook] Failed to log event:", insertErr);
    return new Response("DB error logging event", { status: 500 });
  }

  const webhookEventId = loggedEvent.id;

  // ── 3. Process event ───────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(
          event.data.object as Stripe.Checkout.Session,
          db,
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, db);
        break;

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription,
          db,
          event.type,
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
          db,
        );
        break;

      default:
        // Acknowledge but don't process unhandled event types
        break;
    }

    await db
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", webhookEventId);
  } catch (err) {
    console.error(
      "[stripe-webhook] Processing error for",
      event.type,
      ":",
      err,
    );
    await db
      .from("webhook_events")
      .update({ processing_error: String(err) })
      .eq("id", webhookEventId);
    // Always return 200 — Stripe retries on non-2xx and we've already logged
  }

  return new Response("OK", { status: 200 });
});

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCheckoutComplete(
  session: Stripe.Checkout.Session,
  db: ReturnType<typeof supabaseAdmin>,
) {
  const { user_id, product_id, idempotency_key, tier } = session.metadata ?? {};
  if (!user_id || !product_id || !idempotency_key) {
    throw new Error("Missing metadata on session: " + session.id);
  }

  const amountCents = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Fetch product for metadata (ep_grant etc.)
  const { data: product } = await db
    .from("payment_products")
    .select("*")
    .eq("id", product_id)
    .single();

  // Upsert payment — idempotency_key UNIQUE prevents duplicates
  const { data: payment, error: payErr } = await db
    .from("payments")
    .upsert(
      {
        user_id,
        product_id,
        provider: "stripe",
        provider_payment_id: paymentIntentId,
        provider_customer_id:
          typeof session.customer === "string" ? session.customer : null,
        provider_session_id: session.id,
        subscription_id:
          typeof session.subscription === "string"
            ? session.subscription
            : null,
        amount_cents: amountCents,
        currency: (session.currency ?? "usd").toUpperCase(),
        status: "completed",
        idempotency_key,
        webhook_received_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        metadata: { stripe_session: session.id, tier },
      },
      { onConflict: "idempotency_key" },
    )
    .select("id")
    .single();

  if (payErr) throw new Error("Payment upsert failed: " + payErr.message);

  // Update intent status
  await db
    .from("payment_intents")
    .update({ status: "completed" })
    .eq("idempotency_key", idempotency_key);

  // Handle subscription record
  if (typeof session.subscription === "string") {
    const stripeInstance = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });
    const sub = await stripeInstance.subscriptions.retrieve(
      session.subscription,
    );

    await db.from("subscriptions").upsert(
      {
        user_id,
        product_id,
        payment_id: payment.id,
        provider: "stripe",
        provider_sub_id: sub.id,
        status: sub.status,
        current_period_start: new Date(
          sub.current_period_start * 1000,
        ).toISOString(),
        current_period_end: new Date(
          sub.current_period_end * 1000,
        ).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: "provider_sub_id" },
    );

    await db
      .from("profiles")
      .update({
        subscription_expires: new Date(
          sub.current_period_end * 1000,
        ).toISOString(),
      })
      .eq("id", user_id);
  }

  await activateAccount(
    user_id,
    tier ?? product?.tier ?? "standard",
    product?.metadata ?? {},
  );
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof supabaseAdmin>,
) {
  if (!invoice.subscription || typeof invoice.subscription !== "string") return;

  const stripeInstance = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const sub = await stripeInstance.subscriptions.retrieve(invoice.subscription);

  await db
    .from("subscriptions")
    .update({
      status: sub.status,
      current_period_start: new Date(
        sub.current_period_start * 1000,
      ).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider_sub_id", sub.id);

  const { data: subRecord } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("provider_sub_id", sub.id)
    .maybeSingle();

  if (subRecord) {
    await db
      .from("profiles")
      .update({
        subscription_expires: new Date(
          sub.current_period_end * 1000,
        ).toISOString(),
        is_pro: true,
      })
      .eq("id", subRecord.user_id);
  }
}

async function handleSubscriptionChange(
  sub: Stripe.Subscription,
  db: ReturnType<typeof supabaseAdmin>,
  eventType: string,
) {
  const isCanceled =
    eventType === "customer.subscription.deleted" || sub.status === "canceled";

  await db
    .from("subscriptions")
    .update({
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider_sub_id", sub.id);

  if (isCanceled) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id")
      .eq("provider_sub_id", sub.id)
      .maybeSingle();

    if (data?.user_id) {
      await db
        .from("profiles")
        .update({
          is_pro: false,
          subscription_tier: "standard",
          subscription_expires: null,
        })
        .eq("id", data.user_id);
    }
  }
}

async function handlePaymentFailed(
  pi: Stripe.PaymentIntent,
  db: ReturnType<typeof supabaseAdmin>,
) {
  await db
    .from("payments")
    .update({
      status: "failed",
      failure_reason: pi.last_payment_error?.message ?? "Unknown failure",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_payment_id", pi.id);
}
