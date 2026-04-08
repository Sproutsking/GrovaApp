// supabase/functions/deposit-paystack-webhook/index.ts
// ════════════════════════════════════════════════════════════════════════════
//  WALLET DEPOSIT — Paystack Webhook Handler
//
//  ISOLATION:
//    This webhook ONLY processes events where metadata.source === "wallet_deposit".
//    The main paystack-webhook (for paywall/subscriptions) will also receive these
//    events but IGNORES them because it looks for product_id (which we don't set here).
//    Double processing is prevented by the webhook_events idempotency table.
//
//  REGISTER IN PAYSTACK DASHBOARD:
//    Add https://<project>.supabase.co/functions/v1/deposit-paystack-webhook
//    as a second webhook endpoint (Paystack supports multiple endpoints).
//    OR use the same endpoint and split by metadata.source in _shared/payments.ts
//
//  FLOW:
//    1. Verify HMAC-SHA512 signature
//    2. Check metadata.source === "wallet_deposit"
//    3. Check idempotency (webhook_events table)
//    4. Credit EP or XEV based on metadata.deposit_currency
//    5. Return 200 immediately (Paystack retries on non-200)
//
//  ECONOMY:
//    EP  : 1 NGN = 1 EP
//    XEV : 1 XEV = ₦2.50  (1 NGN = 0.4 XEV)
// ════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin, corsHeaders, validateEnv } from "../_shared/payments.ts";

const XEV_RATE   = 2.5;
const EP_PER_NGN = 1;

function calcCredit(naira: number, currency: "EP" | "XEV"): number {
  if (currency === "XEV") return parseFloat((naira / XEV_RATE).toFixed(4));
  return Math.floor(naira * EP_PER_NGN);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Always return 200 to Paystack — never let errors cause retries on already-processed events
  const ok200 = () => new Response("ok", { status: 200 });

  const envErr = validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PAYSTACK_SECRET_KEY"]);
  if (envErr) { console.error("[deposit-ps-wh] Missing env vars"); return ok200(); }

  const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  // Read body
  let rawBody: string;
  try { rawBody = await req.text(); } catch { return ok200(); }

  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!signature) { console.warn("[deposit-ps-wh] No signature"); return ok200(); }

  // ── Verify HMAC-SHA512 ────────────────────────────────────────────────────
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(PAYSTACK_SK),
      { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
    );
    const sigBuf   = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2,"0")).join("");
    if (computed !== signature) {
      console.error("[deposit-ps-wh] ❌ Signature mismatch");
      return ok200();
    }
  } catch (e) { console.error("[deposit-ps-wh] Signature error:", e); return ok200(); }

  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); } catch { return ok200(); }

  const eventType = String(event.event ?? "");
  const eventData = (event.data ?? {}) as Record<string, unknown>;

  // Only care about successful charges
  if (eventType !== "charge.success") {
    console.log(`[deposit-ps-wh] Ignoring: ${eventType}`);
    return ok200();
  }

  const db        = supabaseAdmin();
  const reference = String(eventData.reference ?? "");
  const status    = String(eventData.status    ?? "");
  const amountKobo= Number(eventData.amount    ?? 0);
  const metadata  = (eventData.metadata ?? {}) as Record<string, unknown>;

  // ── ISOLATION CHECK — only process wallet_deposit events ─────────────────
  if (metadata.source !== "wallet_deposit") {
    console.log(`[deposit-ps-wh] Not a wallet_deposit (source=${metadata.source}), skipping`);
    return ok200();
  }

  if (status !== "success") {
    console.warn(`[deposit-ps-wh] Non-success status: ${status}`);
    return ok200();
  }

  // ── Idempotency ───────────────────────────────────────────────────────────
  const { data: existingEvt } = await db
    .from("webhook_events")
    .select("id, processed")
    .eq("event_id", `wd_${reference}`)  // prefix to avoid collision with paywall events
    .eq("provider", "paystack")
    .maybeSingle();

  if (existingEvt?.processed) {
    console.log(`[deposit-ps-wh] Already processed ref=${reference}`);
    return ok200();
  }

  // ── Parse fields ──────────────────────────────────────────────────────────
  const userId          = String(metadata.user_id           ?? "");
  const depositCurrency = (metadata.deposit_currency as "EP"|"XEV") ?? "EP";
  const nairaAmount     = amountKobo / 100;

  if (!userId) {
    console.error(`[deposit-ps-wh] ❌ No user_id in metadata ref=${reference}`);
    await _logEvent(db, reference, eventData, false);
    return ok200();
  }

  // ── Calculate credit ──────────────────────────────────────────────────────
  const creditAmount = calcCredit(nairaAmount, depositCurrency);
  console.log(`[deposit-ps-wh] ₦${nairaAmount} → ${creditAmount} ${depositCurrency} | user=${userId} | ref=${reference}`);

  // ── Find or create transaction record ─────────────────────────────────────
  let txId: string | null = null;
  try {
    const { data: existingTx } = await db
      .from("transactions")
      .select("id, status")
      .eq("metadata->>reference", reference)
      .eq("from_user_id", userId)
      .maybeSingle();

    if (existingTx?.status === "completed") {
      console.log(`[deposit-ps-wh] Transaction already completed ref=${reference}`);
      await _logEvent(db, reference, eventData, true);
      return ok200();
    }

    if (existingTx) {
      txId = existingTx.id;
    } else {
      // Create transaction record
      const { data: newTx } = await db.from("transactions").insert({
        from_user_id: userId, to_user_id: userId,
        amount: creditAmount, type: "deposit", status: "processing",
        metadata: {
          method: "paystack", channel: String(metadata.channel ?? "card"),
          deposit_currency: depositCurrency, naira_amount: nairaAmount,
          credit_amount: creditAmount, reference, source: "wallet_deposit",
          paystack_ref: reference,
        },
      }).select("id").single();
      txId = newTx?.id ?? null;
    }
  } catch (e) {
    console.error("[deposit-ps-wh] Transaction record error:", e);
  }

  // ── Credit the wallet ─────────────────────────────────────────────────────
  let credited = false;
  let creditError: string | null = null;
  try {
    const field  = depositCurrency === "XEV" ? "grova_tokens" : "engagement_points";
    const { data: w, error: wErr } = await db
      .from("wallets").select(`id,${field}`).eq("user_id", userId).single();
    if (wErr || !w) throw new Error("Wallet not found: " + (wErr?.message ?? "null"));

    const before = parseFloat((w as Record<string,number>)[field]) || 0;
    const after  = parseFloat((before + creditAmount).toFixed(4));

    await db.from("wallets").update({
      [field]: after, updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    console.log(`[deposit-ps-wh] ✅ Credited ${creditAmount} ${depositCurrency} | ${before} → ${after}`);

    // wallet_history
    await db.from("wallet_history").insert({
      wallet_id: (w as Record<string,string>).id,
      user_id:   userId,
      change_type: "credit",
      amount:    creditAmount,
      balance_before: before,
      balance_after:  after,
      reason:    "deposit:paystack_webhook",
      ...(txId ? { transaction_id: txId } : {}),
      metadata: {
        currency:         depositCurrency,
        naira_paid:       nairaAmount,
        paystack_ref:     reference,
        source:           "wallet_deposit",
      },
    }).catch(() => {});

    // EP ledger
    if (depositCurrency === "EP") {
      await db.from("ep_transactions").insert({
        user_id: userId, amount: creditAmount, balance_after: after,
        type: "purchase_grant",
        reason: `EP minted — Paystack deposit ₦${nairaAmount} | ref:${reference}`,
        metadata: { deposit_ref: reference, naira_paid: nairaAmount, source: "wallet_deposit" },
      }).catch(() => {});
    }

    // Mark transaction complete
    if (txId) {
      await db.from("transactions").update({
        status: "completed", completed_at: new Date().toISOString(),
      }).eq("id", txId).catch(() => {});
    }

    // Platform revenue (informational only — wallet deposits are pass-through)
    await db.from("platform_revenue").insert({
      amount: nairaAmount / 100, // minimal platform record in USD equiv
      user_id: userId,
      source: "paystack_wallet_deposit",
      metadata: { reference, naira: nairaAmount, currency: depositCurrency, credit: creditAmount },
    }).catch(() => {});

    credited = true;
  } catch (e) {
    creditError = e instanceof Error ? e.message : String(e);
    console.error(`[deposit-ps-wh] ❌ Credit failed:`, creditError);
  }

  await _logEvent(db, reference, eventData, credited);
  return ok200();
});

async function _logEvent(
  db: ReturnType<typeof supabaseAdmin>,
  reference: string,
  payload: unknown,
  processed: boolean,
) {
  try {
    await db.from("webhook_events").upsert({
      provider:    "paystack",
      event_id:    `wd_${reference}`,   // "wd_" prefix isolates from paywall events
      event_type:  "charge.success",
      payload,
      verified:    true,
      processed,
      idempotency_key: `wd_${reference}`,
      processed_at: processed ? new Date().toISOString() : null,
    }, { onConflict: "event_id" });
  } catch (e) { console.warn("[deposit-ps-wh] Log failed:", e); }
}