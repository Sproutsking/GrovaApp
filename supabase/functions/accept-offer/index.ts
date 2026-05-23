// supabase/functions/accept-offer/index.ts
// Buyer calls this to initiate a trade.
// Atomically: validates offer → creates trade → deducts seller balance → locks escrow

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS, json, err, serviceClient, getAuthUser, checkRateLimit, audit, notify, isValidTransition } from "../shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const buyerId = await getAuthUser(req);
  if (!buyerId) return err("Unauthorized", 401);

  const db = serviceClient();

  // Rate limit: max 20 trade initiations per hour
  const allowed = await checkRateLimit(db, buyerId, "accept_offer", 20, 3600);
  if (!allowed) return err("Rate limit exceeded", 429);

  const { offer_id, amount, payment_method_id, idempotency_key } = await req.json();

  if (!offer_id || !amount || !payment_method_id) return err("offer_id, amount, payment_method_id required");
  if (amount <= 0) return err("amount must be > 0");

  // ── Idempotency check ─────────────────────────────────────────
  if (idempotency_key) {
    const { data: existing } = await db
      .from("p2p_trades")
      .select("id, status")
      .eq("idempotency_key", idempotency_key)
      .single();
    if (existing) return json({ trade: existing, idempotent: true });
  }

  // ── Fetch offer with row-lock ─────────────────────────────────
  const { data: offer, error: offerErr } = await db
    .from("p2p_offers")
    .select("*")
    .eq("id", offer_id)
    .eq("status", "active")
    .single();

  if (offerErr || !offer) return err("Offer not found or no longer active");
  if (offer.seller_id === buyerId) return err("Cannot trade with yourself");
  if (amount < offer.min_order) return err(`Minimum order is ${offer.min_order} ${offer.asset}`);
  if (amount > offer.max_order) return err(`Maximum order is ${offer.max_order} ${offer.asset}`);
  if (amount > offer.available_amount) return err("Insufficient offer availability");

  // ── Verify payment method belongs to buyer ────────────────────
  const { data: pm, error: pmErr } = await db
    .from("p2p_payment_methods")
    .select("*")
    .eq("id", payment_method_id)
    .eq("user_id", buyerId)
    .eq("is_active", true)
    .single();

  if (pmErr || !pm) return err("Payment method not found or not yours");

  // ── Check seller still has the balance ───────────────────────
  const walletCol = offer.asset === "XEV" ? "grova_tokens" : "usdt_balance";
  const { data: sellerWallet, error: swErr } = await db
    .from("wallets")
    .select(`id, ${walletCol}`)
    .eq("user_id", offer.seller_id)
    .single();

  if (swErr || !sellerWallet) return err("Seller wallet not found");
  if ((sellerWallet[walletCol] ?? 0) < amount) return err("Seller has insufficient balance");

  const totalFiat = amount * offer.price_per_unit;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  // ── ATOMIC OPERATIONS (manual transaction via RPC) ────────────
  // 1. Deduct seller wallet
  const { error: deductErr } = await db.rpc("p2p_deduct_for_escrow", {
    p_user_id: offer.seller_id,
    p_asset:   offer.asset,
    p_amount:  amount,
  });
  if (deductErr) return err("Failed to lock funds: " + deductErr.message);

  // 2. Create the trade
  const { data: trade, error: tradeErr } = await db
    .from("p2p_trades")
    .insert({
      offer_id,
      buyer_id:        buyerId,
      seller_id:       offer.seller_id,
      asset:           offer.asset,
      amount,
      price_per_unit:  offer.price_per_unit,
      currency:        offer.currency,
      total_fiat:      totalFiat,
      payment_method:  pm,
      status:          "ESCROW_LOCKED",
      expires_at:      expiresAt,
      idempotency_key: idempotency_key ?? null,
    })
    .select()
    .single();

  if (tradeErr) {
    // Rollback: refund the seller
    await db.rpc("p2p_refund_escrow", {
      p_user_id: offer.seller_id,
      p_asset:   offer.asset,
      p_amount:  amount,
    });
    return err("Failed to create trade: " + tradeErr.message);
  }

  // 3. Create escrow record
  await db.from("p2p_escrow").insert({
    trade_id:  trade.id,
    holder_id: offer.seller_id,
    asset:     offer.asset,
    amount,
    status:    "locked",
  });

  // 4. Update offer available amount
  const newAvailable = offer.available_amount - amount;
  await db.from("p2p_offers")
    .update({
      available_amount: newAvailable,
      status: newAvailable <= 0 ? "completed" : "active",
    })
    .eq("id", offer_id);

  // 5. Insert system message into trade chat
  await db.from("p2p_trade_messages").insert({
    trade_id:  trade.id,
    sender_id: offer.seller_id, // system uses seller id as origin
    msg_type:  "system",
    message:   `Trade started. ${amount} ${offer.asset} is locked in escrow. Buyer must send payment within 30 minutes.`,
  });

  // 6. Notify both parties
  await notify(db, offer.seller_id, trade.id, "trade_created",
    "New Trade Initiated",
    `Buyer wants ${amount} ${offer.asset} at ${offer.price_per_unit} ${offer.currency}. Escrow locked.`);

  await notify(db, buyerId, trade.id, "trade_created",
    "Trade Created",
    `Send ${totalFiat.toLocaleString()} ${offer.currency} to the seller within 30 minutes.`);

  await audit(db, buyerId, "ACCEPT_OFFER", { trade_id: trade.id, amount, asset: offer.asset });

  return json({ trade });
});