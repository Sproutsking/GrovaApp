// supabase/functions/deposit-paystack-init/index.ts
// ════════════════════════════════════════════════════════════════════════════
//  WALLET DEPOSIT — Paystack Init & Confirm
//
//  PURPOSE:  Handles Paystack transactions for XEV Wallet deposits ONLY.
//            This function is 100% separate from paystack-create-transaction
//            which handles the platform paywall/subscription.
//
//  ISOLATION TAG: metadata.source = "wallet_deposit"
//                 deposit-paystack-webhook checks this tag to avoid cross-fire
//                 with the main paystack-webhook handler.
//
//  ACTIONS:
//    init    — register deposit intent (idempotency key)
//    confirm — called client-side after Paystack callback to belt-and-suspenders
//              credit the wallet (webhook is authoritative, this is backup)
//
//  ECONOMY:
//    EP  : 1 NGN = 1 EP  (minted at deposit, burned at use)
//    XEV : 1 XEV = ₦2.50 NGN  (internal, no on-chain mint yet)
// ════════════════════════════════════════════════════════════════════════════

import {
  corsHeaders, errorResponse, jsonResponse,
  requireAuth, supabaseAdmin, validateEnv,
} from "../_shared/payments.ts";

const XEV_RATE   = 2.5;   // NGN per 1 XEV
const EP_PER_NGN = 1;     // 1 NGN = 1 EP

function calcCredit(naira: number, currency: "EP" | "XEV") {
  if (currency === "XEV") return parseFloat((naira / XEV_RATE).toFixed(4));
  return Math.floor(naira * EP_PER_NGN);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  // Validate required secrets
  const envErr = validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (envErr) return envErr;

  // Auth
  let userId: string;
  try { ({ userId } = await requireAuth(req)); }
  catch (e: unknown) {
    return errorResponse((e as Error).message, 401, "UNAUTHORIZED");
  }

  let body: {
    action?: string;
    userId?: string;
    nairaAmount?: number;
    currency?: "EP" | "XEV";
    channel?: "card" | "bank_transfer";
    reference?: string;
    source?: string;
  };
  try { body = await req.json(); } catch {
    return errorResponse("Invalid JSON", 400, "BAD_REQUEST");
  }

  const {
    action     = "init",
    nairaAmount = 0,
    currency    = "EP",
    channel     = "card",
    reference   = "",
    source      = "wallet_deposit",
  } = body;

  // Safety: reject if source tag is wrong
  if (source !== "wallet_deposit") {
    return errorResponse("Invalid source for this endpoint", 400, "WRONG_SOURCE");
  }

  const db = supabaseAdmin();

  // ── INIT — register intent ─────────────────────────────────────────────────
  if (action === "init") {
    if (!nairaAmount || nairaAmount < 100) {
      return errorResponse("Minimum deposit is ₦100", 400, "BELOW_MIN");
    }
    if (!reference) {
      return errorResponse("reference is required", 400, "MISSING_REF");
    }

    const creditAmount = calcCredit(nairaAmount, currency as "EP" | "XEV");

    // Idempotency — check if we've seen this reference
    const { data: existing } = await db
      .from("transactions")
      .select("id, status")
      .eq("metadata->>reference", reference)
      .eq("from_user_id", userId)
      .maybeSingle();

    if (existing?.status === "completed") {
      return jsonResponse({ ok: true, already_completed: true, reference });
    }

    if (!existing) {
      // Register pending intent
      await db.from("transactions").insert({
        from_user_id: userId,
        to_user_id:   userId,
        amount:       creditAmount,
        type:         "deposit",
        status:       "pending",
        metadata: {
          method:           "paystack",
          channel,
          deposit_currency: currency,
          naira_amount:     nairaAmount,
          credit_amount:    creditAmount,
          reference,
          source:           "wallet_deposit",
        },
      }).catch(() => {}); // non-fatal
    }

    console.log(`[deposit-ps-init] INIT user=${userId} ₦${nairaAmount} → ${creditAmount} ${currency} ref=${reference}`);
    return jsonResponse({ ok: true, reference, creditAmount, currency });
  }

  // ── CONFIRM — called after Paystack callback ───────────────────────────────
  if (action === "confirm") {
    if (!reference) return errorResponse("reference required", 400, "MISSING_REF");

    // Check if already credited (webhook may have beaten us)
    const { data: tx } = await db
      .from("transactions")
      .select("id, status, metadata")
      .eq("metadata->>reference", reference)
      .eq("from_user_id", userId)
      .maybeSingle();

    if (tx?.status === "completed") {
      console.log(`[deposit-ps-init] CONFIRM already done ref=${reference}`);
      return jsonResponse({ ok: true, already_credited: true });
    }

    // Verify with Paystack directly
    const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SK) {
      // Cannot verify — defer to webhook
      return jsonResponse({ ok: true, deferred_to_webhook: true });
    }

    let psOk = false;
    let psAmount = 0;
    try {
      const psRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SK}` },
      });
      if (psRes.ok) {
        const psData = await psRes.json() as {
          status: boolean;
          data?: { status: string; amount: number; metadata?: Record<string,unknown> };
        };
        psOk     = psData.status && psData.data?.status === "success";
        psAmount = (psData.data?.amount ?? 0) / 100; // kobo → NGN
        // Extra safety: confirm source tag
        const psMeta = psData.data?.metadata as Record<string,unknown> | undefined;
        if (psMeta?.source !== "wallet_deposit") {
          console.warn(`[deposit-ps-init] CONFIRM wrong source on PS metadata ref=${reference}`);
          return errorResponse("Source mismatch", 400, "WRONG_SOURCE");
        }
      }
    } catch (e) {
      console.warn(`[deposit-ps-init] PS verify error ref=${reference}:`, e);
    }

    if (!psOk) {
      // Paystack hasn't confirmed yet — webhook will handle it
      return jsonResponse({ ok: true, pending: true, message: "Awaiting Paystack confirmation" });
    }

    // Credit the wallet
    const creditCurrency = (tx?.metadata as Record<string,unknown>)?.deposit_currency as "EP"|"XEV" || currency as "EP"|"XEV";
    const creditAmount   = calcCredit(psAmount, creditCurrency);

    await _creditWallet(db, userId, creditCurrency, creditAmount, reference, tx?.id || null, "paystack_confirm");

    console.log(`[deposit-ps-init] CONFIRM credited ${creditAmount} ${creditCurrency} ref=${reference}`);
    return jsonResponse({ ok: true, credited: true, amount: creditAmount, currency: creditCurrency });
  }

  return errorResponse("Unknown action", 400, "UNKNOWN_ACTION");
});

// ─── internal credit function ─────────────────────────────────────────────────
async function _creditWallet(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string,
  currency: "EP" | "XEV",
  amount: number,
  ref: string,
  txId: string | null,
  method: string,
) {
  const field = currency === "XEV" ? "grova_tokens" : "engagement_points";

  const { data: w, error: wErr } = await db
    .from("wallets").select(`id,${field}`).eq("user_id", userId).single();
  if (wErr || !w) throw new Error("Wallet not found for user: " + userId);

  const before = parseFloat((w as Record<string,number>)[field]) || 0;
  const after  = parseFloat((before + amount).toFixed(4));

  await db.from("wallets").update({
    [field]: after,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await db.from("wallet_history").insert({
    wallet_id: (w as Record<string,string>).id,
    user_id:   userId,
    change_type: "credit",
    amount,
    balance_before: before,
    balance_after:  after,
    reason: `deposit:${method}`,
    ...(txId ? { transaction_id: txId } : {}),
    metadata: { currency, method, reference: ref, source: "wallet_deposit" },
  }).catch(() => {});

  if (currency === "EP") {
    await db.from("ep_transactions").insert({
      user_id: userId, amount, balance_after: after,
      type: "purchase_grant",
      reason: `EP minted — paystack deposit | ref:${ref}`,
      metadata: { deposit_ref: ref, method, source: "wallet_deposit" },
    }).catch(() => {});
  }

  if (txId) {
    await db.from("transactions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", txId).catch(() => {});
  }
}