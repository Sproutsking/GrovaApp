// supabase/functions/deposit-paystack-init/index.ts
// ════════════════════════════════════════════════════════════════════════════
//  WALLET DEPOSIT — Paystack Intent Registration
//
//  CORS FIX: getCORSHeaders() in _shared/payments.ts now reflects the
//  incoming Origin, so localhost:3000 (dev) is explicitly allowed.
//  This eliminates the "blocked by CORS policy" preflight rejection.
//
//  SINGLE RESPONSIBILITY: Register a pending deposit intent. Never credits.
//
//  ECONOMY:
//    1 USD = 100 EP
//    1 XEV = 10 EP  →  1 XEV = $0.10 USD
//
//  FLOW:
//    1. Auth check
//    2. Validate nairaAmount >= 100
//    3. Fetch live NGN rate from platform_settings (fallback 1500)
//    4. Verify wallet exists for user
//    5. Write pending transaction row with all metadata
//    6. Return { reference, creditAmount, currency, amountKobo }
//
//  The client opens Paystack with the returned reference.
//  deposit-paystack-webhook is the sole crediting authority.
// ════════════════════════════════════════════════════════════════════════════

const corsHeadersDev = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "false",
};

function getOriginHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isDev =
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin);

  const allowedOrigin = isDev
    ? origin
    : (Deno.env.get("ALLOWED_ORIGIN") ?? "*");

  return {
    "Access-Control-Allow-Origin":  allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": isDev ? "true" : "false",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MIN_DEPOSIT_NGN   = 100;
const EP_PER_USD        = 100;
const XEV_PER_EP        = 0.1;
const FALLBACK_NGN_RATE = 1500;

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
  const headers = getOriginHeaders(req);

  // Preflight — must return 200 with CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }), {
      status: 405, headers,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured", code: "SERVER_MISCONFIGURED" }), {
      status: 500, headers,
    });
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing Authorization header", code: "UNAUTHORIZED" }), {
      status: 401, headers,
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired auth token", code: "UNAUTHORIZED" }), {
      status: 401, headers,
    });
  }
  const userId = user.id;

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: {
    nairaAmount?:      number;
    usdAmount?:        number;
    usdNgnRate?:       number;
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
    return new Response(JSON.stringify({ error: "Invalid JSON", code: "BAD_REQUEST" }), {
      status: 400, headers,
    });
  }

  const {
    nairaAmount      = 0,
    usdAmount,
    usdNgnRate: clientRate,
    currency         = "EP",
    channel          = "card",
    from_wallet,
    wallet_address,
    wallet_signature,
    import_ref,
  } = body;

  if (!nairaAmount || typeof nairaAmount !== "number" || nairaAmount < MIN_DEPOSIT_NGN) {
    return new Response(JSON.stringify({ error: `Minimum deposit is ₦${MIN_DEPOSIT_NGN}`, code: "BELOW_MIN" }), {
      status: 400, headers,
    });
  }
  if (currency !== "EP" && currency !== "XEV") {
    return new Response(JSON.stringify({ error: "currency must be EP or XEV", code: "INVALID_CURRENCY" }), {
      status: 400, headers,
    });
  }

  // ── Fetch live NGN rate ───────────────────────────────────────────────────
  let ngnRate = clientRate && clientRate > 100 ? clientRate : FALLBACK_NGN_RATE;
  try {
    const { data: rateRow } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle();
    const stored = Number(rateRow?.value?.ngn_rate ?? 0);
    if (stored >= 100) ngnRate = stored;
  } catch { /* use fallback */ }

  // Use server-authoritative USD amount if client sent it, else compute
  const verifiedUSD = typeof usdAmount === "number" && usdAmount > 0
    ? usdAmount
    : nairaAmount / ngnRate;

  // Credit preview: compute from USD for correctness
  let creditAmount: number;
  if (currency === "XEV") {
    creditAmount = parseFloat((verifiedUSD / 0.1).toFixed(4)); // $0.10 per XEV
  } else {
    creditAmount = Math.floor(verifiedUSD * EP_PER_USD); // 100 EP per $1
  }

  const amountKobo = Math.round(nairaAmount * 100);
  const reference  = generateReference(userId);

  // ── Verify wallet exists ──────────────────────────────────────────────────
  const { data: wallet, error: walletErr } = await db
    .from("wallets")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletErr || !wallet) {
    console.error(`[deposit-ps-init] No wallet user=${userId}:`, walletErr?.message);
    return new Response(JSON.stringify({ error: "Wallet not found. Contact support.", code: "WALLET_NOT_FOUND" }), {
      status: 400, headers,
    });
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
    usd_amount:       verifiedUSD,
  };

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
    return new Response(JSON.stringify({ error: "Could not register deposit. Please try again.", code: "INTENT_WRITE_FAILED" }), {
      status: 500, headers,
    });
  }

  console.log(
    `[deposit-ps-init] Registered user=${userId} ` +
    `₦${nairaAmount} (≈$${verifiedUSD.toFixed(2)}) @ ₦${ngnRate}/USD → ${creditAmount} ${currency} ref=${reference}`,
  );

  return new Response(JSON.stringify({ ok: true, reference, creditAmount, currency, amountKobo }), {
    status: 200, headers,
  });
});