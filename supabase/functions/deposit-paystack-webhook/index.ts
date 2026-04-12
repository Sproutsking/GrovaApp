// supabase/functions/deposit-paystack-webhook/index.ts
// ════════════════════════════════════════════════════════════════════════════
//  WALLET DEPOSIT — Paystack Webhook (SOLE CREDITING AUTHORITY)
//
//  ECONOMY:
//    1 USD = 100 EP
//    1 XEV = 10 EP  →  1 XEV = $0.10 USD
//    EP per NGN  = 100 / USD_NGN_RATE
//    XEV per NGN = EP_per_NGN / 10
//
//  VERIFICATION CHAIN (all must pass before any credit):
//    1. HMAC-SHA512 signature verified against PAYSTACK_SECRET_KEY
//    2. Event type must be "charge.success"
//    3. metadata.source must be "wallet_deposit"
//    4. Paystack payload status must be "success"
//    5. Idempotency: webhook_events checked — already processed → 200 OK
//    6. Re-verify with Paystack REST API (/transaction/verify/:ref)
//       This is the ground truth. We never trust webhook payload amounts.
//    7. Pending transaction row must exist (written by deposit-paystack-init)
//    8. If already "completed" → skip with 200 OK
//    9. Amount integrity: Paystack-verified kobo vs intent kobo (±1 tolerance)
//   10. Atomic wallet update with optimistic concurrency (eq field = before)
//   11. wallet_history, ep_transactions, transaction completion written
//   12. 200 on success, 500 on credit failure (Paystack retries on 500)
//
//  IMPORTANT: No .catch() on Supabase query builders.
//  Supabase builders are thenables, not full Promises — .catch() crashes.
//  All non-critical DB writes use try/catch.
// ════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

// ── Economy ───────────────────────────────────────────────────────────────────
const EP_PER_USD            = 100;   // 1 USD = 100 EP
const XEV_PER_EP            = 0.1;   // 1 XEV = 10 EP
const FALLBACK_NGN_RATE     = 1366;
const AMOUNT_TOLERANCE_KOBO = 1;     // ±1 kobo for float rounding

function calcCredit(naira: number, currency: "EP" | "XEV", ngnRate: number): number {
  const epPerNGN = EP_PER_USD / ngnRate;
  if (currency === "XEV") return parseFloat((naira * epPerNGN * XEV_PER_EP).toFixed(4));
  return Math.floor(naira * epPerNGN);
}

// ── Paystack re-verify ────────────────────────────────────────────────────────
async function verifyWithPaystack(reference: string, secretKey: string): Promise<{
  ok: boolean;
  amountKobo: number;
  status: string;
  metadata: Record<string, unknown>;
  error?: string;
}> {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` }, signal: AbortSignal.timeout(12_000) },
  );

  if (!res.ok) {
    return { ok: false, amountKobo: 0, status: "", metadata: {}, error: `Paystack HTTP ${res.status}` };
  }

  type PSBody = { status: boolean; data?: { status: string; amount: number; metadata?: Record<string, unknown> }; message?: string };
  const body = await res.json() as PSBody;

  if (!body.status || !body.data) {
    return { ok: false, amountKobo: 0, status: "", metadata: {}, error: body.message ?? "Paystack verify false" };
  }

  return {
    ok:        body.data.status === "success",
    amountKobo: body.data.amount,
    status:    body.data.status,
    metadata:  body.data.metadata ?? {},
    error:     body.data.status !== "success" ? `Paystack status: ${body.data.status}` : undefined,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Return 200 to Paystack on logic errors to prevent infinite retries.
  // Only return 500 on credit failures we want retried.
  const ok200 = () => new Response("ok", { status: 200 });

  const envErr = validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PAYSTACK_SECRET_KEY"]);
  if (envErr) { console.error("[deposit-ps-wh] Missing env vars"); return ok200(); }

  const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  // ── Read raw body first (must precede any .json() call) ───────────────────
  let rawBody: string;
  try { rawBody = await req.text(); }
  catch { console.error("[deposit-ps-wh] Cannot read body"); return ok200(); }

  // ── STEP 1: Verify HMAC-SHA512 signature ──────────────────────────────────
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!signature) { console.error("[deposit-ps-wh] ❌ No signature header"); return ok200(); }

  try {
    const enc      = new TextEncoder();
    const key      = await crypto.subtle.importKey("raw", enc.encode(PAYSTACK_SK), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sigBuf   = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (computed !== signature) { console.error("[deposit-ps-wh] ❌ Signature mismatch"); return ok200(); }
  } catch (e) { console.error("[deposit-ps-wh] Signature error:", e); return ok200(); }

  // ── Parse event ───────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); }
  catch { console.error("[deposit-ps-wh] Cannot parse body"); return ok200(); }

  const eventType     = String(event.event ?? "");
  const eventData     = (event.data ?? {}) as Record<string, unknown>;
  const reference     = String(eventData.reference ?? "");
  const webhookStatus = String(eventData.status ?? "");
  const metadata      = (eventData.metadata ?? {}) as Record<string, unknown>;

  // ── STEP 2: Event type ────────────────────────────────────────────────────
  if (eventType !== "charge.success") { console.log(`[deposit-ps-wh] Ignoring: ${eventType}`); return ok200(); }
  if (!reference) { console.error("[deposit-ps-wh] ❌ No reference"); return ok200(); }

  // ── STEP 3: Source isolation ──────────────────────────────────────────────
  if (metadata.source !== "wallet_deposit") {
    console.log(`[deposit-ps-wh] Not wallet_deposit (source="${metadata.source}") — skip`);
    return ok200();
  }

  // ── STEP 4: Webhook payload status ───────────────────────────────────────
  if (webhookStatus !== "success") { console.warn(`[deposit-ps-wh] status=${webhookStatus} ref=${reference}`); return ok200(); }

  const db      = supabaseAdmin();
  const eventId = `wd_${reference}`;

  // ── STEP 5: Idempotency ───────────────────────────────────────────────────
  const { data: existingEvt } = await db
    .from("webhook_events")
    .select("id, processed")
    .eq("event_id", eventId)
    .eq("provider", "paystack")
    .maybeSingle();

  if (existingEvt?.processed) {
    console.log(`[deposit-ps-wh] Already processed ref=${reference}`);
    return ok200();
  }

  // Write unprocessed marker to block concurrent retries
  try {
    await db.from("webhook_events").upsert(
      { provider: "paystack", event_id: eventId, event_type: eventType, payload: event, verified: true, processed: false, idempotency_key: eventId, received_at: new Date().toISOString() },
      { onConflict: "event_id" },
    );
  } catch (e) { console.warn("[deposit-ps-wh] Idempotency upsert warn:", e); }

  // ── STEP 6: Re-verify with Paystack API ──────────────────────────────────
  let psVerify: Awaited<ReturnType<typeof verifyWithPaystack>>;
  try {
    psVerify = await verifyWithPaystack(reference, PAYSTACK_SK);
  } catch (e) {
    console.error(`[deposit-ps-wh] ❌ Verify threw ref=${reference}:`, e);
    return new Response("verify_error", { status: 500 }); // Paystack will retry
  }

  if (!psVerify.ok) {
    console.error(`[deposit-ps-wh] ❌ Verify failed ref=${reference}: ${psVerify.error}`);
    await _logEvent(db, eventId, event, false, null, null, `Verify failed: ${psVerify.error}`);
    return ok200();
  }

  const verifiedAmountKobo = psVerify.amountKobo;
  const verifiedAmountNGN  = verifiedAmountKobo / 100;
  console.log(`[deposit-ps-wh] ✅ Paystack verified ref=${reference} ₦${verifiedAmountNGN}`);

  // ── STEP 7: Find pending intent ───────────────────────────────────────────
  // The intent was written by deposit-paystack-init.
  // We match by: user_id in metadata + paystack_ref + source tag.
  const intentUserId = String(metadata.user_id ?? "");
  if (!intentUserId) {
    console.error(`[deposit-ps-wh] ❌ No user_id in metadata ref=${reference}`);
    await _logEvent(db, eventId, event, false, null, null, "No user_id in metadata");
    return ok200();
  }

  const { data: pendingTx, error: txFindErr } = await db
    .from("transactions")
    .select("id, status, amount, metadata")
    .eq("from_user_id", intentUserId)
    .eq("type", "deposit")
    .eq("metadata->>paystack_ref", reference)
    .eq("metadata->>source", "wallet_deposit")
    .maybeSingle();

  if (txFindErr) {
    console.error(`[deposit-ps-wh] ❌ DB error finding intent ref=${reference}:`, txFindErr.message);
    return new Response("db_error", { status: 500 }); // Paystack will retry
  }

  if (!pendingTx) {
    console.error(`[deposit-ps-wh] ❌ No pending intent ref=${reference}`);
    await _logEvent(db, eventId, event, false, null, null, "No pending intent found");
    return ok200();
  }

  // ── STEP 8: Already completed? ────────────────────────────────────────────
  if (pendingTx.status === "completed") {
    console.log(`[deposit-ps-wh] Intent already completed ref=${reference}`);
    await _logEvent(db, eventId, event, true, null, pendingTx.id, null);
    return ok200();
  }

  // ── STEP 9: Amount integrity ──────────────────────────────────────────────
  const intentMeta       = (pendingTx.metadata as Record<string, unknown>) ?? {};
  const intentAmountKobo = Number(intentMeta.amount_kobo ?? 0);

  if (intentAmountKobo > 0) {
    const diff = Math.abs(verifiedAmountKobo - intentAmountKobo);
    if (diff > AMOUNT_TOLERANCE_KOBO) {
      console.error(`[deposit-ps-wh] ❌ Amount mismatch ref=${reference}: intent=${intentAmountKobo} verified=${verifiedAmountKobo}`);
      await _logEvent(db, eventId, event, false, null, pendingTx.id, `Amount mismatch: intent=${intentAmountKobo} verified=${verifiedAmountKobo}`);
      return ok200();
    }
  }

  // ── Fetch NGN rate for credit calculation ─────────────────────────────────
  // Prefer the rate stored in the intent (set at time of registration).
  // Falls back to live platform_settings, then constant.
  let ngnRate = Number(intentMeta.ngn_rate ?? 0);
  if (ngnRate < 100) {
    try {
      const { data: rateRow } = await db.from("platform_settings").select("value").eq("key", "paywall_config").maybeSingle();
      const stored = Number(rateRow?.value?.ngn_rate ?? 0);
      if (stored >= 100) ngnRate = stored;
    } catch { /* ignore */ }
  }
  if (ngnRate < 100) ngnRate = FALLBACK_NGN_RATE;

  const depositCurrency = (intentMeta.deposit_currency as "EP" | "XEV") ?? "EP";
  const walletId        = String(intentMeta.wallet_id ?? "");

  // Credit is computed from VERIFIED NGN, not from client-supplied amount
  const creditAmount = calcCredit(verifiedAmountNGN, depositCurrency, ngnRate);

  console.log(`[deposit-ps-wh] Crediting ${creditAmount} ${depositCurrency} user=${intentUserId} ref=${reference}`);

  // ── STEP 10: Credit wallet ────────────────────────────────────────────────
  let credited    = false;
  let creditError: string | null = null;

  try {
    const field = depositCurrency === "XEV" ? "grova_tokens" : "engagement_points";

    // Fetch current wallet balance
    let walletQuery = db.from("wallets").select(`id,${field}`);
    const { data: w, error: wErr } = walletId
      ? await walletQuery.eq("id", walletId).single()
      : await walletQuery.eq("user_id", intentUserId).single();

    if (wErr || !w) throw new Error(`Wallet not found: ${wErr?.message ?? "null"}`);

    const finalWalletId = (w as Record<string, string>).id;
    const before        = parseFloat(String((w as Record<string, unknown>)[field] ?? "0")) || 0;
    const after         = parseFloat((before + creditAmount).toFixed(4));

    // Optimistic concurrency: only update if value matches what we read.
    // Prevents double-credit if two webhook retries fire simultaneously.
    const { data: updated, error: updateErr } = await db
      .from("wallets")
      .update({ [field]: after, updated_at: new Date().toISOString() })
      .eq("id", finalWalletId)
      .eq(field, before)   // optimistic lock
      .select("id")
      .maybeSingle();

    if (updateErr) throw new Error(`Wallet update error: ${updateErr.message}`);

    if (!updated) {
      // Another webhook beat us — check if transaction completed already
      const { data: recheck } = await db.from("transactions").select("status").eq("id", pendingTx.id).single();
      if (recheck?.status === "completed") {
        console.log(`[deposit-ps-wh] Race resolved — already credited ref=${reference}`);
        await _logEvent(db, eventId, event, true, null, pendingTx.id, null);
        return ok200();
      }
      throw new Error("Wallet update matched 0 rows — concurrent update, Paystack should retry");
    }

    console.log(`[deposit-ps-wh] ✅ ${field} ${before} → ${after} (+${creditAmount}) user=${intentUserId}`);

    // ── wallet_history ──────────────────────────────────────────────────────
    try {
      await db.from("wallet_history").insert({
        wallet_id:      finalWalletId,
        user_id:        intentUserId,
        change_type:    "credit",
        amount:         creditAmount,
        balance_before: before,
        balance_after:  after,
        reason:         "deposit:paystack_webhook",
        transaction_id: pendingTx.id,
        metadata: {
          currency:      depositCurrency,
          naira_paid:    verifiedAmountNGN,
          kobo_paid:     verifiedAmountKobo,
          paystack_ref:  reference,
          source:        "wallet_deposit",
          verified_by:   "paystack_api",
          ngn_rate:      ngnRate,
        },
      });
    } catch (e) { console.warn("[deposit-ps-wh] wallet_history warn:", e); }

    // ── EP ledger (EP only) ─────────────────────────────────────────────────
    if (depositCurrency === "EP") {
      try {
        await db.from("ep_transactions").insert({
          user_id:       intentUserId,
          amount:        creditAmount,
          balance_after: after,
          type:          "purchase_grant",
          reason:        `EP minted — Paystack deposit ₦${verifiedAmountNGN} | ref:${reference}`,
          metadata: {
            deposit_ref:  reference,
            naira_paid:   verifiedAmountNGN,
            ep_rate:      `100 EP per $1 USD @ ₦${ngnRate}/USD`,
            source:       "wallet_deposit",
            verified_by:  "paystack_api",
          },
        });
      } catch (e) { console.warn("[deposit-ps-wh] ep_transactions warn:", e); }
    }

    // ── Mark transaction completed ──────────────────────────────────────────
    try {
      await db.from("transactions").update({
        status:       "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...intentMeta,
          verified_amount_kobo: verifiedAmountKobo,
          verified_amount_ngn:  verifiedAmountNGN,
          credited_amount:      creditAmount,
          credited_at:          new Date().toISOString(),
        },
      }).eq("id", pendingTx.id);
    } catch (e) { console.warn("[deposit-ps-wh] tx update warn:", e); }

    // ── Platform revenue (informational) ────────────────────────────────────
    try {
      await db.from("platform_revenue").insert({
        amount:   parseFloat((verifiedAmountNGN / ngnRate).toFixed(6)),
        user_id:  intentUserId,
        source:   "paystack_wallet_deposit",
        metadata: { reference, naira: verifiedAmountNGN, currency: depositCurrency, credit: creditAmount, ngn_rate: ngnRate },
      });
    } catch (e) { console.warn("[deposit-ps-wh] platform_revenue warn:", e); }

    credited = true;

  } catch (e) {
    creditError = e instanceof Error ? e.message : String(e);
    console.error(`[deposit-ps-wh] ❌ Credit failed ref=${reference}:`, creditError);
  }

  await _logEvent(db, eventId, event, credited, null, pendingTx.id, creditError);

  if (!credited) {
    // Return 500 so Paystack retries the webhook delivery
    return new Response("credit_failed", { status: 500 });
  }

  return ok200();
});

// ── Log webhook event ─────────────────────────────────────────────────────────
async function _logEvent(
  db: ReturnType<typeof supabaseAdmin>,
  eventId: string,
  payload: unknown,
  processed: boolean,
  paymentId: string | null,
  txId: string | null,
  errorMsg: string | null,
): Promise<void> {
  try {
    await db.from("webhook_events").upsert(
      {
        provider:        "paystack",
        event_id:        eventId,
        event_type:      "charge.success",
        payload,
        verified:        true,
        processed,
        payment_id:      paymentId,
        idempotency_key: eventId,
        processing_error: errorMsg,
        processed_at:    processed ? new Date().toISOString() : null,
      },
      { onConflict: "event_id" },
    );
  } catch (e) { console.warn("[deposit-ps-wh] _logEvent warn:", e); }
}