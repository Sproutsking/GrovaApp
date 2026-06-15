// supabase/functions/accept-offer/index.ts
// Buyer initiates trade
// validates → locks funds → creates trade → escrow → notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  CORS,
  json,
  err,
  serviceClient,
  getAuthUser,
  checkRateLimit,
  audit,
  notify,
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

    const buyerId = await getAuthUser(req);

    if (!buyerId) {
      return err(
        "Unauthorized",
        401
      );
    }

    const db = serviceClient();

    // Rate limiting

    const allowed =
      await checkRateLimit(
        db,
        buyerId,
        "accept_offer",
        20,
        3600
      );

    if (!allowed) {
      return err(
        "Rate limit exceeded",
        429
      );
    }

    const {
      offer_id,
      amount,
      payment_method_id,
      idempotency_key,
    } = await req.json();

    if (
      !offer_id ||
      !amount ||
      !payment_method_id
    ) {
      return err(
        "offer_id, amount and payment_method_id required"
      );
    }

    if (
      Number(amount) <= 0
    ) {
      return err(
        "amount must be > 0"
      );
    }

    // Idempotency

    if (idempotency_key) {
      const {
        data: existing,
      } = await db
        .from("p2p_trades")
        .select(
          "id,status"
        )
        .eq(
          "idempotency_key",
          idempotency_key
        )
        .single();

      if (existing) {
        return json({
          trade: existing,
          idempotent: true,
        });
      }
    }

    // Fetch offer

    const {
      data: offer,
      error: offerErr,
    } = await db
      .from("p2p_offers")
      .select("*")
      .eq(
        "id",
        offer_id
      )
      .eq(
        "status",
        "active"
      )
      .single();

    if (
      offerErr ||
      !offer
    ) {
      return err(
        "Offer not found"
      );
    }

    if (
      offer.seller_id === buyerId
    ) {
      return err(
        "Cannot trade with yourself"
      );
    }

    if (
      amount <
      offer.min_order
    ) {
      return err(
        `Minimum order is ${offer.min_order}`
      );
    }

    if (
      amount >
      offer.max_order
    ) {
      return err(
        `Maximum order is ${offer.max_order}`
      );
    }

    if (
      amount >
      offer.available_amount
    ) {
      return err(
        "Offer availability exceeded"
      );
    }

    // Verify buyer payment method

    const {
      data: pm,
      error: pmErr,
    } = await db
      .from(
        "p2p_payment_methods"
      )
      .select("*")
      .eq(
        "id",
        payment_method_id
      )
      .eq(
        "user_id",
        buyerId
      )
      .eq(
        "is_active",
        true
      )
      .single();

    if (
      pmErr ||
      !pm
    ) {
      return err(
        "Invalid payment method"
      );
    }

    // Verify seller wallet

    const walletCol =
      walletColumn(
        offer.asset
      );

    const {
      data: sellerWallet,
      error: swErr,
    } = await db
      .from("wallets")
      .select(
        `id,${walletCol}`
      )
      .eq(
        "user_id",
        offer.seller_id
      )
      .single();

    if (
      swErr ||
      !sellerWallet
    ) {
      return err(
        "Seller wallet not found"
      );
    }

    const balance =
      sellerWallet[
        walletCol
      ] ?? 0;

    if (
      balance < amount
    ) {
      return err(
        "Seller balance insufficient"
      );
    }

    const totalFiat =
      amount *
      offer.price_per_unit;

    const expiresAt =
      new Date(
        Date.now() +
        (30 * 60 * 1000)
      ).toISOString();

    // Lock escrow funds

    const {
      error: deductErr,
    } = await db.rpc(
      "p2p_deduct_for_escrow",
      {
        p_user_id:
          offer.seller_id,

        p_asset:
          offer.asset,

        p_amount:
          amount,
      }
    );

    if (deductErr) {
      return err(
        "Escrow lock failed: " +
        deductErr.message
      );
    }

    // Create trade

    const {
      data: trade,
      error: tradeErr,
    } = await db
      .from(
        "p2p_trades"
      )
      .insert({
        offer_id,

        buyer_id:
          buyerId,

        seller_id:
          offer.seller_id,

        asset:
          offer.asset,

        amount,

        price_per_unit:
          offer.price_per_unit,

        currency:
          offer.currency,

        total_fiat:
          totalFiat,

        payment_method:
          pm,

        status:
          "ESCROW_LOCKED",

        expires_at:
          expiresAt,

        idempotency_key:
          idempotency_key ??
          null,
      })
      .select()
      .single();

    // rollback

    if (tradeErr) {

      await db.rpc(
        "p2p_refund_escrow",
        {
          p_user_id:
            offer.seller_id,

          p_asset:
            offer.asset,

          p_amount:
            amount,
        }
      );

      return err(
        tradeErr.message
      );
    }

    // Escrow

    await db
      .from(
        "p2p_escrow"
      )
      .insert({
        trade_id:
          trade.id,

        holder_id:
          offer.seller_id,

        asset:
          offer.asset,

        amount,

        status:
          "locked",
      });

    // Update offer

    const remaining =
      offer.available_amount -
      amount;

    await db
      .from(
        "p2p_offers"
      )
      .update({
        available_amount:
          remaining,

        status:
          remaining <= 0
            ? "completed"
            : "active",
      })
      .eq(
        "id",
        offer_id
      );

    // Trade message

    await db
      .from(
        "p2p_trade_messages"
      )
      .insert({
        trade_id:
          trade.id,

        sender_id:
          offer.seller_id,

        msg_type:
          "system",

        message:
          `Trade started. ${amount} ${offer.asset} locked in escrow.`,
      });

    // Notifications

    await notify(
      db,
      offer.seller_id,
      trade.id,
      "trade_created",
      "New Trade",
      `Buyer wants ${amount} ${offer.asset}`
    );

    await notify(
      db,
      buyerId,
      trade.id,
      "trade_created",
      "Trade Created",
      `Send payment within 30 minutes`
    );

    await audit(
      db,
      buyerId,
      "ACCEPT_OFFER",
      {
        trade_id:
          trade.id,

        amount,

        asset:
          offer.asset,
      }
    );

    return json({
      success: true,
      trade,
    });

  } catch (e) {

    console.error(e);

    return err(
      e instanceof Error
      ? e.message
      : "Internal server error",
      500
    );
  }
});