// supabase/functions/stripe-create-session/index.ts

import Stripe from "https://esm.sh/stripe@14?target=deno";
import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  requireAuth,
  supabaseAdmin,
} from "../_shared/payments.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { userId, email } = await requireAuth(req);
    const body = await req.json();
    const { product_id, idempotency_key, success_url, cancel_url } = body;

    if (!product_id || !idempotency_key || !success_url || !cancel_url) {
      return errorResponse(
        "Missing required fields: product_id, idempotency_key, success_url, cancel_url",
      );
    }

    // Validate idempotency_key is a UUID
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotency_key,
      )
    ) {
      return errorResponse("Invalid idempotency_key: must be UUID v4");
    }

    const db = supabaseAdmin();

    // Rate limit check (max 5 attempts per 10 min)
    const { data: rateLimitOk } = await db.rpc("check_payment_rate_limit", {
      p_user_id: userId,
    });
    if (rateLimitOk === false) {
      return errorResponse(
        "Too many payment attempts. Please wait before retrying.",
        429,
      );
    }

    // Idempotency — return existing session if already created
    const { data: existingIntent } = await db
      .from("payment_intents")
      .select("id, status, provider_session, metadata")
      .eq("idempotency_key", idempotency_key)
      .maybeSingle();

    if (existingIntent?.status === "completed") {
      return jsonResponse({ already_completed: true });
    }
    if (
      existingIntent?.provider_session &&
      existingIntent?.metadata?.session_url
    ) {
      return jsonResponse({ session_url: existingIntent.metadata.session_url });
    }

    // Fetch product
    const { data: product, error: prodErr } = await db
      .from("payment_products")
      .select("*")
      .eq("id", product_id)
      .eq("is_active", true)
      .maybeSingle();

    if (prodErr || !product)
      return errorResponse("Invalid or inactive product", 404);

    // Get or create Stripe customer
    const { data: profile } = await db
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", userId)
      .single();

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await db
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const amountCents = Math.round(product.amount_usd * 100);
    const isSubscription = product.type === "subscription";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: isSubscription ? "subscription" : "payment",
      payment_method_types: ["card"],
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      metadata: {
        user_id: userId,
        product_id,
        idempotency_key,
        tier: product.tier,
      },
      line_items:
        isSubscription && product.stripe_price_id
          ? [{ price: product.stripe_price_id, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: product.currency.toLowerCase(),
                  unit_amount: amountCents,
                  product_data: {
                    name: product.name,
                    description: product.description ?? undefined,
                  },
                },
                quantity: 1,
              },
            ],
      allow_promotion_codes: false,
      client_reference_id: userId,
    };

    // Only add payment_intent_data for one-time payments
    if (!isSubscription) {
      sessionParams.payment_intent_data = {
        metadata: { user_id: userId, product_id, idempotency_key },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: idempotency_key,
    });

    // Persist intent
    await db.from("payment_intents").upsert(
      {
        user_id: userId,
        product_id,
        idempotency_key,
        provider: "stripe",
        provider_session: session.id,
        amount_cents: amountCents,
        currency: product.currency,
        status: "created",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        metadata: { session_url: session.url },
      },
      { onConflict: "idempotency_key" },
    );

    return jsonResponse({ session_url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[stripe-create-session]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
    );
  }
});
