// supabase/functions/create-offer/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  CORS,
  json,
  err,
  serviceClient,
  getAuthUser,
  checkRateLimit,
  audit,
  walletColumn,
} from "../_shared/utils.ts";

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(
        "ok",
        { headers: CORS }
      );
    }

    const userId = await getAuthUser(req);

    if (!userId) {
      return err("Unauthorized", 401);
    }

    const db = serviceClient();

    // Rate limit
    const allowed = await checkRateLimit(
      db,
      userId,
      "create_offer",
      10,
      3600,
    );

    if (!allowed) {
      return err(
        "Rate limit exceeded. Max 10 offers per hour.",
        429,
      );
    }

    const body = await req.json();

    const {
      asset,
      total_amount,
      price_per_unit,
      currency,
      payment_method_ids,
      min_order,
      max_order,
      terms,
    } = body;

    // Validation

    if (!["XEV", "USDT"].includes(asset)) {
      return err("asset must be XEV or USDT");
    }

    if (
      !total_amount ||
      Number(total_amount) <= 0
    ) {
      return err(
        "total_amount must be > 0"
      );
    }

    if (
      !price_per_unit ||
      Number(price_per_unit) <= 0
    ) {
      return err(
        "price_per_unit must be > 0"
      );
    }

    if (
      !["NGN", "USD", "GHS", "KES"]
        .includes(currency)
    ) {
      return err(
        "Unsupported currency"
      );
    }

    if (
      !min_order ||
      !max_order ||
      min_order <= 0 ||
      max_order < min_order
    ) {
      return err(
        "Invalid min/max order limits"
      );
    }

    if (max_order > total_amount) {
      return err(
        "max_order cannot exceed total_amount"
      );
    }

    if (
      !Array.isArray(payment_method_ids) ||
      payment_method_ids.length === 0
    ) {
      return err(
        "At least one payment method required"
      );
    }

    // Verify payment methods belong to seller

    const {
      data: pms,
      error: pmErr,
    } = await db
      .from("p2p_payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .in(
        "id",
        payment_method_ids
      );

    if (
      pmErr ||
      !pms ||
      pms.length !== payment_method_ids.length
    ) {
      return err(
        "One or more payment methods invalid or not yours"
      );
    }

    // Check balance

    const column = walletColumn(asset);

    const {
      data: wallet,
      error: walletErr,
    } = await db
      .from("wallets")
      .select(
        `id, ${column}`
      )
      .eq(
        "user_id",
        userId
      )
      .single();

    if (
      walletErr ||
      !wallet
    ) {
      return err(
        "Wallet not found"
      );
    }

    const balance =
      wallet[column] ?? 0;

    if (
      balance <
      total_amount
    ) {
      return err(
        `Insufficient ${asset} balance`
      );
    }

    // Create offer

    const {
      data: offer,
      error: offerErr,
    } = await db
      .from("p2p_offers")
      .insert({
        seller_id: userId,
        asset,
        total_amount,
        available_amount:
          total_amount,
        price_per_unit,
        currency,
        payment_method_ids,
        min_order,
        max_order,
        terms:
          terms ?? null,
        status: "active",
      })
      .select()
      .single();

    if (offerErr) {
      return err(
        "Failed to create offer: " +
        offerErr.message
      );
    }

    await audit(
      db,
      userId,
      "CREATE_OFFER",
      {
        offer_id: offer.id,
        asset,
        total_amount,
      },
      undefined,
      offer.id,
    );

    return json({
      success: true,
      offer,
    });

  } catch (e) {
    console.error(e);

    return err(
      e instanceof Error
        ? e.message
        : "Internal server error",
      500,
    );
  }
});