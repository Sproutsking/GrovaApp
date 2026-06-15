// supabase/functions/withdraw-paystack-webhook/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WITHDRAW — PAYSTACK TRANSFER WEBHOOK
//
// Handles Paystack transfer.success and transfer.failed events.
// These are fired when a bank transfer completes or fails.
//
// VERIFICATION CHAIN:
//   1. HMAC-SHA512 signature verified against PAYSTACK_SECRET_KEY
//   2. Event type must be "transfer.success", "transfer.failed", or
//      "transfer.reversed"
//   3. Match withdrawal_queue row by paystack_reference in metadata
//   4. On success:  update status = "completed"  (EP was already debited
//                   by queue_withdrawal RPC — DO NOT debit again)
//   5. On failure:  refund EP back to user wallet atomically,
//                   update status = "failed"
//   6. Always return 200 to Paystack (non-200 triggers retries)
//
// CRITICAL — DOUBLE-ACCOUNTING FIX:
//   The queue_withdrawal RPC already:
//     • Debited EP from wallets
//     • Logged a wallet_history debit row
//   On transfer.success we must NOT log another debit — it would double-
//   charge the user in the ledger. We only update the withdrawal status.
//
// REQUIRED SECRETS:
//   PAYSTACK_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Always return 200 to Paystack to avoid retry loops — log errors internally
  const ok200 = () => new Response("ok", { status: 200 });

  const envErr = validateEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY",
  ]);
  if (envErr) { console.error("[wd-ps-wh] Missing env vars"); return ok200(); }

  const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  // ── Read raw body ──────────────────────────────────────────────────────────
  let rawBody: string;
  try { rawBody = await req.text(); }
  catch { return ok200(); }

  // ── Verify HMAC-SHA512 signature ───────────────────────────────────────────
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!signature) {
    console.error("[wd-ps-wh] No x-paystack-signature header");
    return ok200();
  }

  try {
    const enc      = new TextEncoder();
    const key      = await crypto.subtle.importKey(
      "raw",
      enc.encode(PAYSTACK_SK),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const sigBuf   = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const computed = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (computed !== signature) {
      console.error("[wd-ps-wh] ❌ Signature mismatch — possible replay attack");
      return ok200();
    }
  } catch (e) {
    console.error("[wd-ps-wh] Signature verification error:", e);
    return ok200();
  }

  // ── Parse event ────────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); }
  catch { return ok200(); }

  const eventType = String(event.event ?? "");
  const eventData = (event.data ?? {}) as Record<string, unknown>;
  const reference = String(eventData.reference ?? "");

  console.log(`[wd-ps-wh] Event: ${eventType} ref=${reference}`);

  // ── Only handle transfer events ────────────────────────────────────────────
  if (!["transfer.success", "transfer.failed", "transfer.reversed"].includes(eventType)) {
    return ok200();
  }
  if (!reference) {
    console.error("[wd-ps-wh] No reference in event data");
    return ok200();
  }

  const db = supabaseAdmin();

  // ── Find withdrawal by paystack_reference stored in metadata ──────────────
  const { data: rows } = await db
    .from("withdrawal_queue")
    .select("id, user_id, status, net_ep, ep_amount, metadata, destination_type")
    .eq("metadata->>paystack_reference", reference)
    .limit(1);

  const wd = rows?.[0];

  if (!wd) {
    console.error(`[wd-ps-wh] No withdrawal found for ref=${reference}`);
    return ok200();
  }

  // Idempotency guard — skip already-terminal states
  if (wd.status === "completed" || wd.status === "cancelled") {
    console.log(`[wd-ps-wh] Already ${wd.status} — skip`);
    return ok200();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // transfer.success
  // ══════════════════════════════════════════════════════════════════════════
  if (eventType === "transfer.success") {
    // FIX: Only mark as completed.
    // DO NOT log wallet_history debit or ep_transactions spend here.
    // The queue_withdrawal RPC already debited the wallet and logged both
    // when the withdrawal was first queued. Adding them again would be
    // double-accounting and would corrupt the user's ledger history.
    await db
      .from("withdrawal_queue")
      .update({
        status:       "completed",
        processed_at: new Date().toISOString(),
        metadata: {
          ...((wd.metadata as Record<string, unknown>) || {}),
          completed_at:   new Date().toISOString(),
          paystack_event: eventType,
        },
      })
      .eq("id", wd.id);

    // Log webhook event (idempotent upsert)
    try {
      await db.from("webhook_events").upsert({
        provider:        "paystack",
        event_id:        `wd_transfer_${reference}`,
        event_type:      eventType,
        payload:         event,
        verified:        true,
        processed:       true,
        processed_at:    new Date().toISOString(),
        idempotency_key: `wd_transfer_${reference}`,
      }, { onConflict: "event_id" });
    } catch (e) {
      console.warn("[wd-ps-wh] webhook_events upsert warn:", e);
    }

    console.log(`[wd-ps-wh] ✅ Withdrawal completed: ${wd.id}`);
    return ok200();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // transfer.failed OR transfer.reversed — REFUND EP
  // ══════════════════════════════════════════════════════════════════════════
  const failReason = String(
    (eventData.reason ?? eventData.gateway_response) ?? eventType
  );
  console.error(`[wd-ps-wh] ❌ Transfer ${eventType} for ${wd.id} — refunding ${wd.ep_amount} EP. Reason: ${failReason}`);

  try {
    // Fetch wallet with current balance
    const { data: wallet, error: wErr } = await db
      .from("wallets")
      .select("id, engagement_points")
      .eq("user_id", wd.user_id)
      .single();

    if (wErr || !wallet) {
      throw new Error(`Wallet not found for user ${wd.user_id}`);
    }

    const refundAmount = Number(wd.ep_amount); // refund FULL gross amount (inc. fee)
    const before       = parseFloat(String(wallet.engagement_points ?? "0"));
    const after        = parseFloat((before + refundAmount).toFixed(4));

    // Credit EP back to wallet
    await db
      .from("wallets")
      .update({ engagement_points: after, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    // Log wallet_history credit (this is correct — it's the refund entry)
    await db.from("wallet_history").insert({
      wallet_id:      wallet.id,
      user_id:        wd.user_id,
      change_type:    "credit",
      amount:         refundAmount,
      balance_before: before,
      balance_after:  after,
      reason:         "withdrawal:refund_transfer_failed",
      metadata: {
        withdrawal_id:      wd.id,
        paystack_reference: reference,
        event:              eventType,
        refund_reason:      failReason,
      },
    });

    // Log ep_transactions refund entry
    await db.from("ep_transactions").insert({
      user_id:       wd.user_id,
      amount:        refundAmount,
      balance_after: after,
      type:          "refund",
      reason:        `Withdrawal refund — transfer ${eventType} ref:${reference}`,
      metadata: { withdrawal_id: wd.id, reference, refund_reason: failReason },
    });

    // Update withdrawal status to failed
    await db
      .from("withdrawal_queue")
      .update({
        status:    "failed",
        error_msg: failReason,
        metadata: {
          ...((wd.metadata as Record<string, unknown>) || {}),
          failed_at:      new Date().toISOString(),
          paystack_event: eventType,
          ep_refunded:    refundAmount,
        },
      })
      .eq("id", wd.id);

    console.log(`[wd-ps-wh] ✅ Refunded ${refundAmount} EP to user ${wd.user_id}. New balance: ${after} EP`);

  } catch (e) {
    console.error("[wd-ps-wh] ❌ REFUND FAILED:", e);

    // Mark as failed and flag for manual review
    await db
      .from("withdrawal_queue")
      .update({
        status:      "failed",
        error_msg:   `Transfer failed + refund error: ${e instanceof Error ? e.message : String(e)}`,
        admin_notes: "⚠️ MANUAL REFUND REQUIRED — automated refund failed",
      })
      .eq("id", wd.id);

    // Return 500 so Paystack retries — we MUST eventually refund
    return new Response("refund_failed", { status: 500 });
  }

  // Log webhook event
  try {
    await db.from("webhook_events").upsert({
      provider:        "paystack",
      event_id:        `wd_transfer_${reference}`,
      event_type:      eventType,
      payload:         event,
      verified:        true,
      processed:       true,
      processed_at:    new Date().toISOString(),
      idempotency_key: `wd_transfer_${reference}`,
    }, { onConflict: "event_id" });
  } catch (e) {
    console.warn("[wd-ps-wh] webhook_events upsert warn:", e);
  }

  return ok200();
});