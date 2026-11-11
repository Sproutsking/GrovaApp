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
//   10. One database RPC atomically updates the wallet, ledgers, and transaction
//   11. 200 on success, 500 on transient/configuration failures (Paystack retries)
//
//  IMPORTANT: No .catch() on Supabase query builders.
//  Supabase builders are thenables, not full Promises — .catch() crashes.
//  All non-critical DB writes use try/catch.
// ════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

// ── Economy ───────────────────────────────────────────────────────────────────
const AMOUNT_TOLERANCE_KOBO = 1;     // ±1 kobo for float rounding

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
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
  if (envErr) {
    console.error("[deposit-ps-wh] Missing env vars");
    return new Response("webhook_not_configured", { status: 500 });
  }

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
    if (!constantTimeEqual(computed, signature.toLowerCase())) {
      console.error("[deposit-ps-wh] ❌ Signature mismatch");
      return ok200();
    }
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
    if (/Paystack HTTP (429|5\d\d)/.test(psVerify.error ?? "")) {
      return new Response("paystack_verify_retry", { status: 500 });
    }
    return ok200();
  }

  const verifiedAmountKobo = psVerify.amountKobo;
  const verifiedAmountNGN  = verifiedAmountKobo / 100;
  console.log(`[deposit-ps-wh] ✅ Paystack verified ref=${reference} ₦${verifiedAmountNGN}`);

  // ── STEP 7: Find pending intent by server-generated payment reference ──────
  const { data: pendingTx, error: txFindErr } = await db
    .from("transactions")
    .select("id, from_user_id, status, amount, metadata")
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
    return new Response("pending_intent_missing", { status: 500 });
  }
  const intentUserId = String(pendingTx.from_user_id ?? "");
  if (!intentUserId) {
    console.error(`[deposit-ps-wh] ❌ Intent has no owner ref=${reference}`);
    await _logEvent(db, eventId, event, false, null, pendingTx.id, "Pending intent has no owner");
    return new Response("pending_intent_invalid", { status: 500 });
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
  if (!Number.isSafeInteger(intentAmountKobo) || intentAmountKobo <= 0) {
    await _logEvent(db, eventId, event, false, null, pendingTx.id, "Invalid amount in pending intent");
    return new Response("pending_intent_invalid", { status: 500 });
  }
  const diff = Math.abs(verifiedAmountKobo - intentAmountKobo);
  if (diff > AMOUNT_TOLERANCE_KOBO) {
    const reason = `Amount mismatch: intent=${intentAmountKobo} verified=${verifiedAmountKobo}`;
    console.error(`[deposit-ps-wh] ❌ ${reason} ref=${reference}`);
    await _logEvent(db, eventId, event, false, null, pendingTx.id, reason);
    return ok200();
  }

  if (psVerify.metadata.source !== "wallet_deposit") {
    await _logEvent(db, eventId, event, false, null, pendingTx.id, "Verified transaction source mismatch");
    return ok200();
  }

  // Ownership and conversion terms come from the persisted server-side intent,
  // never from the webhook's metadata.
  try {
    const { data: settlement, error: settlementError } = await db.rpc(
      "settle_paystack_wallet_deposit",
      {
        p_paystack_reference: reference,
        p_verified_amount_kobo: verifiedAmountKobo,
      },
    );
    if (settlementError) throw new Error(settlementError.message);
    if (!settlement?.success) throw new Error("Deposit settlement returned no success result");

    await _logEvent(db, eventId, event, true, null, pendingTx.id, null);
    return ok200();
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[deposit-ps-wh] ❌ Atomic settlement failed ref=${reference}:`, reason);
    await _logEvent(db, eventId, event, false, null, pendingTx.id, reason);
    return new Response("credit_failed", { status: 500 });
  }
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