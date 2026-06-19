// supabase/functions/trade-actions/index.ts
// Unified Edge Function handling all trade lifecycle actions:
// mark_paid | confirm_payment | cancel_trade | open_dispute | resolve_dispute

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS, json, err, serviceClient, getAuthUser,
  checkRateLimit, audit, notify, isValidTransition
} from "../_shared/utils.ts";

// ── Helper: update trade status with validation ──────────────────────────────
async function transitionTrade(
  db: ReturnType<typeof serviceClient>,
  tradeId: string,
  actorId: string,
  toStatus: string,
  extra: Record<string, unknown> = {}
) {
  const { data: trade, error: fetchErr } = await db
    .from("p2p_trades")
    .select("*")
    .eq("id", tradeId)
    .single();

  if (fetchErr || !trade) return { error: "Trade not found" };
  if (!isValidTransition(trade.status, toStatus))
    return { error: `Cannot transition from ${trade.status} to ${toStatus}` };

  const { data: updated, error: updateErr } = await db
    .from("p2p_trades")
    .update({ status: toStatus, ...extra })
    .eq("id", tradeId)
    .eq("status", trade.status)  // optimistic lock
    .select()
    .single();

  if (updateErr || !updated) return { error: "Trade update failed (concurrent modification?)" };

  await audit(db, actorId, `TRANSITION_${toStatus}`, { trade_id: tradeId, from: trade.status, to: toStatus });
  return { trade: updated };
}

// ── Helper: release escrow to buyer ─────────────────────────────────────────
async function releaseEscrow(
  db: ReturnType<typeof serviceClient>,
  tradeId: string,
  toBuyerId: string
) {
  const { data: escrow, error: escErr } = await db
    .from("p2p_escrow")
    .select("*")
    .eq("trade_id", tradeId)
    .eq("status", "locked")
    .single();

  if (escErr || !escrow) return { error: "Escrow record not found or already resolved" };

  // Credit buyer wallet
  const walletCol = escrow.asset === "XEV" ? "xev_tokens" : "usdt_balance";
  const { data: buyerWallet } = await db
    .from("wallets")
    .select(`id, ${walletCol}`)
    .eq("user_id", toBuyerId)
    .single();

  if (!buyerWallet) return { error: "Buyer wallet not found" };

  const newBal = (buyerWallet[walletCol] ?? 0) + escrow.amount;
  const { error: creditErr } = await db
    .from("wallets")
    .update({ [walletCol]: newBal })
    .eq("user_id", toBuyerId);

  if (creditErr) return { error: "Failed to credit buyer: " + creditErr.message };

  // Log to wallet_history
  await db.from("wallet_history").insert({
    wallet_id:      buyerWallet.id,
    user_id:        toBuyerId,
    change_type:    "credit",
    amount:         escrow.amount,
    balance_before: buyerWallet[walletCol] ?? 0,
    balance_after:  newBal,
    reason:         `P2P Trade ${tradeId} completed`,
    metadata:       { trade_id: tradeId, asset: escrow.asset, currency: escrow.asset },
  });

  // Mark escrow released
  await db.from("p2p_escrow")
    .update({ status: "released", resolved_at: new Date().toISOString() })
    .eq("trade_id", tradeId);

  return { success: true, amount: escrow.amount, asset: escrow.asset };
}

// ── Helper: refund escrow to seller ─────────────────────────────────────────
async function refundEscrow(
  db: ReturnType<typeof serviceClient>,
  tradeId: string
) {
  const { data: escrow } = await db
    .from("p2p_escrow")
    .select("*")
    .eq("trade_id", tradeId)
    .eq("status", "locked")
    .single();

  if (!escrow) return { error: "No locked escrow found" };

  const walletCol = escrow.asset === "XEV" ? "xev_tokens" : "usdt_balance";
  const { data: sellerWallet } = await db
    .from("wallets")
    .select(`id, ${walletCol}`)
    .eq("user_id", escrow.holder_id)
    .single();

  if (!sellerWallet) return { error: "Seller wallet not found" };

  const newBal = (sellerWallet[walletCol] ?? 0) + escrow.amount;
  await db.from("wallets")
    .update({ [walletCol]: newBal })
    .eq("user_id", escrow.holder_id);

  await db.from("wallet_history").insert({
    wallet_id:      sellerWallet.id,
    user_id:        escrow.holder_id,
    change_type:    "credit",
    amount:         escrow.amount,
    balance_before: sellerWallet[walletCol] ?? 0,
    balance_after:  newBal,
    reason:         `P2P Trade ${tradeId} cancelled/refunded`,
    metadata:       { trade_id: tradeId, asset: escrow.asset, currency: escrow.asset },
  });

  await db.from("p2p_escrow")
    .update({ status: "refunded", resolved_at: new Date().toISOString() })
    .eq("trade_id", tradeId);

  return { success: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const userId = await getAuthUser(req);
  if (!userId) return err("Unauthorized", 401);

  const db = serviceClient();
  const { action, trade_id, ...params } = await req.json();

  if (!trade_id) return err("trade_id required");

  // ── Fetch trade to verify actor ───────────────────────────────────────────
  const { data: trade, error: tErr } = await db
    .from("p2p_trades")
    .select("*")
    .eq("id", trade_id)
    .single();

  if (tErr || !trade) return err("Trade not found");
  const isBuyer  = trade.buyer_id  === userId;
  const isSeller = trade.seller_id === userId;
  if (!isBuyer && !isSeller) return err("Not a participant in this trade");

  // ══════════════════════════════════════════════════════════════════════════
  // MARK_PAID — buyer confirms they sent payment
  // ══════════════════════════════════════════════════════════════════════════
  if (action === "mark_paid") {
    if (!isBuyer) return err("Only buyer can mark payment as sent");
    if (trade.status !== "ESCROW_LOCKED" && trade.status !== "PAYMENT_PENDING")
      return err("Trade is not in the correct state");

    const result = await transitionTrade(db, trade_id, userId, "PAYMENT_SENT", {
      buyer_confirmed: true,
    });
    if (result.error) return err(result.error);

    // Insert system message
    await db.from("p2p_trade_messages").insert({
      trade_id,
      sender_id: userId,
      msg_type:  "system",
      message:   "Buyer has marked payment as sent. Seller: please verify and confirm receipt.",
    });

    await notify(db, trade.seller_id, trade_id, "payment_sent",
      "Payment Sent",
      "Buyer claims they have sent payment. Please check your account and confirm.");

    return json({ trade: result.trade });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIRM_PAYMENT — seller confirms receipt and releases escrow
  // ══════════════════════════════════════════════════════════════════════════
  if (action === "confirm_payment") {
    if (!isSeller) return err("Only seller can confirm payment received");
    if (trade.status !== "PAYMENT_SENT") return err("Buyer must mark payment sent first");

    // Release escrow to buyer
    const release = await releaseEscrow(db, trade_id, trade.buyer_id);
    if (release.error) return err(release.error);

    // Complete the trade
    const result = await transitionTrade(db, trade_id, userId, "COMPLETED", {
      seller_confirmed: true,
      completed_at:     new Date().toISOString(),
    });
    if (result.error) return err(result.error);

    // Update offer trades_count
    await db.from("p2p_offers")
      .update({ trades_count: trade.trades_count + 1 })
      .eq("id", trade.offer_id);

    // Update reputation for both
    await db.rpc("p2p_update_reputation", {
      p_buyer_id:  trade.buyer_id,
      p_seller_id: trade.seller_id,
      p_asset:     trade.asset,
      p_amount:    trade.amount,
    });

    await db.from("p2p_trade_messages").insert({
      trade_id,
      sender_id: userId,
      msg_type:  "system",
      message:   `✅ Trade complete! ${trade.amount} ${trade.asset} has been sent to the buyer.`,
    });

    await notify(db, trade.buyer_id, trade_id, "trade_completed",
      "Trade Completed",
      `${trade.amount} ${trade.asset} has been added to your wallet.`);

    await notify(db, trade.seller_id, trade_id, "trade_completed",
      "Trade Completed",
      `You received ${trade.total_fiat.toLocaleString()} ${trade.currency}.`);

    return json({ trade: result.trade });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CANCEL_TRADE — either party can cancel before payment sent
  // ══════════════════════════════════════════════════════════════════════════
  if (action === "cancel_trade") {
    if (!["CREATED", "ESCROW_LOCKED", "PAYMENT_PENDING"].includes(trade.status))
      return err("Cannot cancel trade in current state");

    // Refund escrow to seller
    const refund = await refundEscrow(db, trade_id);
    if (refund.error && refund.error !== "No locked escrow found") return err(refund.error);

    // Restore offer availability
    await db.from("p2p_offers")
      .update({
        available_amount: db.rpc("p2p_restore_offer_amount", {
          p_offer_id: trade.offer_id,
          p_amount:   trade.amount,
        }),
        status: "active",
      })
      .eq("id", trade.offer_id);

    const result = await transitionTrade(db, trade_id, userId, "CANCELLED", {
      metadata: { ...trade.metadata, cancelled_by: userId, cancel_reason: params.reason ?? null },
    });
    if (result.error) return err(result.error);

    await db.from("p2p_trade_messages").insert({
      trade_id,
      sender_id: userId,
      msg_type:  "system",
      message:   `Trade cancelled by ${isBuyer ? "buyer" : "seller"}.`,
    });

    const otherId = isBuyer ? trade.seller_id : trade.buyer_id;
    await notify(db, otherId, trade_id, "trade_cancelled",
      "Trade Cancelled",
      `The trade has been cancelled. ${isBuyer ? "Seller" : "Buyer"} funds returned.`);

    return json({ trade: result.trade });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OPEN_DISPUTE
  // ══════════════════════════════════════════════════════════════════════════
  if (action === "open_dispute") {
    if (!["ESCROW_LOCKED", "PAYMENT_PENDING", "PAYMENT_SENT"].includes(trade.status))
      return err("Cannot dispute trade in current state");

    const { reason, evidence_urls } = params;
    if (!reason) return err("reason required");

    const result = await transitionTrade(db, trade_id, userId, "DISPUTED", {
      dispute_opened_by:  userId,
      dispute_reason:     reason,
      dispute_evidence:   evidence_urls ?? [],
    });
    if (result.error) return err(result.error);

    // Mark escrow as disputed
    await db.from("p2p_escrow")
      .update({ status: "disputed" })
      .eq("trade_id", trade_id);

    await db.from("p2p_trade_messages").insert({
      trade_id,
      sender_id: userId,
      msg_type:  "system",
      message:   `⚠️ Dispute opened: ${reason}. A moderator will review shortly.`,
    });

    const otherId = isBuyer ? trade.seller_id : trade.buyer_id;
    await notify(db, otherId, trade_id, "dispute_opened",
      "Dispute Opened",
      `A dispute has been raised on your trade. Reason: ${reason}`);

    return json({ trade: result.trade });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESOLVE_DISPUTE — admin/moderator only
  // ══════════════════════════════════════════════════════════════════════════
  if (action === "resolve_dispute") {
    // Check admin
    const { data: adminRow } = await db
      .from("admin_team")
      .select("id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!adminRow) return err("Only moderators can resolve disputes", 403);
    if (trade.status !== "DISPUTED") return err("Trade is not disputed");

    const { resolution, favor } = params; // favor: "buyer" | "seller"
    if (!resolution) return err("resolution notes required");
    if (!["buyer", "seller"].includes(favor)) return err("favor must be buyer or seller");

    if (favor === "buyer") {
      const release = await releaseEscrow(db, trade_id, trade.buyer_id);
      if (release.error) return err(release.error);
    } else {
      const refund = await refundEscrow(db, trade_id);
      if (refund.error) return err(refund.error);
    }

    const result = await transitionTrade(db, trade_id, userId, favor === "buyer" ? "COMPLETED" : "CANCELLED", {
      moderator_id:     userId,
      resolution_notes: resolution,
      completed_at:     new Date().toISOString(),
    });
    if (result.error) return err(result.error);

    await db.from("p2p_trade_messages").insert({
      trade_id,
      sender_id: userId,
      msg_type:  "system",
      message:   `⚖️ Dispute resolved. Decision: in favor of ${favor}. ${resolution}`,
    });

    await notify(db, trade.buyer_id, trade_id, "dispute_resolved",
      "Dispute Resolved",
      `Decision: in favor of ${favor}. ${resolution}`);

    await notify(db, trade.seller_id, trade_id, "dispute_resolved",
      "Dispute Resolved",
      `Decision: in favor of ${favor}. ${resolution}`);

    return json({ trade: result.trade });
  }

  return err("Unknown action");
});