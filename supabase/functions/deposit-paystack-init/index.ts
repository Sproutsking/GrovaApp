// supabase/functions/deposit-paystack-init/index.ts
// ════════════════════════════════════════════════════════════════════════════
//  WALLET DEPOSIT — Paystack Intent Registration
//
//  SINGLE RESPONSIBILITY: Register a pending deposit intent. Never credits.
//
//  ECONOMY:
//    1 USD = 100 EP
//    1 XEV = 10 EP  →  1 XEV = $0.10 USD
//    EP per NGN  = 100 / USD_NGN_RATE
//    XEV per NGN = EP_per_NGN / 10
//
//  FLOW:
//    1. Auth check
//    2. Validate nairaAmount >= 100
//    3. Fetch live NGN rate from platform_settings (fallback 1366)
//    4. Verify wallet exists for user
//    5. Write pending transaction row with all metadata
//    6. Return { reference, creditAmount, currency, amountKobo }
//
//  The client opens Paystack with the returned reference.
//  deposit-paystack-webhook is the sole crediting authority.
// ════════════════════════════════════════════════════════════════════════════

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  requireAuth,
  supabaseAdmin,
  validateEnv,
} from "../_shared/payments.ts";

const MIN_DEPOSIT_NGN   = 100;
const EP_PER_USD        = 100;   // 1 USD = 100 EP
const XEV_PER_EP        = 0.1;   // 1 XEV = 10 EP
const FALLBACK_NGN_RATE = 1366;

function calcCreditPreview(naira: number, currency: "EP" | "XEV", ngnRate: number): number {
  const epPerNGN = EP_PER_USD / ngnRate;
  if (currency === "XEV") return parseFloat((naira * epPerNGN * XEV_PER_EP).toFixed(4));
  return Math.floor(naira * epPerNGN);
}

function generateReference(userId: string): string {
  const ts   = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const uid  = userId.replace(/-/g, "").slice(0, 8);
  return `wd_${uid}_${ts}_${rand}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  const envErr = validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (envErr) return envErr;

  let userId: string;
  try {
    ({ userId } = await requireAuth(req));
  } catch (e: unknown) {
    return errorResponse((e as Error).message, 401, "UNAUTHORIZED");
  }

  let body: {
    nairaAmount?:      number;
    currency?:         string;
    channel?:          string;
    from_wallet?:      string;
    wallet_address?:   string;
    wallet_signature?: string;
    import_ref?:       string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400, "BAD_REQUEST");
  }

  const {
    nairaAmount      = 0,
    currency         = "EP",
    channel          = "card",
    from_wallet,
    wallet_address,
    wallet_signature,
    import_ref,
  } = body;

  if (!nairaAmount || typeof nairaAmount !== "number" || nairaAmount < MIN_DEPOSIT_NGN) {
    return errorResponse(`Minimum deposit is ₦${MIN_DEPOSIT_NGN}`, 400, "BELOW_MIN");
  }
  if (currency !== "EP" && currency !== "XEV") {
    return errorResponse("currency must be EP or XEV", 400, "INVALID_CURRENCY");
  }

  const db = supabaseAdmin();

  // ── Fetch live NGN rate ───────────────────────────────────────────────────
  let ngnRate = FALLBACK_NGN_RATE;
  try {
    const { data: rateRow } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle();
    const stored = Number(rateRow?.value?.ngn_rate ?? 0);
    if (stored >= 100) ngnRate = stored;
  } catch { /* use fallback */ }

  const creditAmount = calcCreditPreview(nairaAmount, currency as "EP" | "XEV", ngnRate);
  const amountKobo   = Math.round(nairaAmount * 100);
  const reference    = generateReference(userId);

  // ── Verify wallet exists ──────────────────────────────────────────────────
  const { data: wallet, error: walletErr } = await db
    .from("wallets")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletErr || !wallet) {
    console.error(`[deposit-ps-init] No wallet user=${userId}:`, walletErr?.message);
    return errorResponse("Wallet not found. Contact support.", 400, "WALLET_NOT_FOUND");
  }

  // ── Write pending intent ──────────────────────────────────────────────────
  const intentMeta: Record<string, unknown> = {
    method:           "paystack",
    channel,
    deposit_currency: currency,
    naira_amount:     nairaAmount,
    amount_kobo:      amountKobo,
    credit_amount:    creditAmount,
    paystack_ref:     reference,
    source:           "wallet_deposit",
    wallet_id:        wallet.id,
    ngn_rate:         ngnRate,
  };

  // Import flow: store wallet proof fields (webhook can log/verify them)
  if (from_wallet)      intentMeta.from_wallet      = from_wallet;
  if (wallet_address)   intentMeta.wallet_address   = wallet_address;
  if (wallet_signature) intentMeta.wallet_signature = wallet_signature;
  if (import_ref)       intentMeta.import_ref       = import_ref;

  const { error: txErr } = await db.from("transactions").insert({
    from_user_id: userId,
    to_user_id:   userId,
    amount:       creditAmount,
    type:         "deposit",
    status:       "pending",
    metadata:     intentMeta,
  });

  if (txErr) {
    console.error(`[deposit-ps-init] Intent write failed user=${userId}:`, txErr.message);
    return errorResponse("Could not register deposit. Please try again.", 500, "INTENT_WRITE_FAILED");
  }

  console.log(
    `[deposit-ps-init] Registered user=${userId} ` +
    `₦${nairaAmount} @ ₦${ngnRate}/USD → ${creditAmount} ${currency} ref=${reference}`,
  );

  return jsonResponse({ ok: true, reference, creditAmount, currency, amountKobo });
});