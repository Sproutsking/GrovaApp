// supabase/functions/web3-verify-payment/index.ts
// ============================================================================
// WEB3 PAYMENT VERIFICATION — Main Entry Point
//
// SECURITY MODEL:
//   • Nothing from the frontend is trusted except identifiers.
//   • All on-chain data is fetched directly from RPC nodes.
//   • Replay protection enforced at DB level (UNIQUE on txHash).
//   • User wallet claimed by frontend is validated against on-chain sender.
//   • Treasury address comes from server env vars — never from frontend.
//   • Amount expected comes from our DB product record — never from frontend.
//   • Chain config (confirmations, token addresses) comes from chainConfig.ts.
//   • No user can activate another user's payment.
//
// REQUEST BODY (from frontend):
//   {
//     chainType:             "EVM" | "SOLANA" | "CARDANO"
//     chain:                 "polygon" | "base" | "arbitrum" | "ethereum" | "bnb"
//     txHash:                "0x..."
//     productId:             "uuid"
//     idempotencyKey:        "uuid"
//     claimedSenderWallet:   "0x..."
//     expectedTokenAddress:  "0x..." | null  (null = accept any supported stablecoin)
//   }
//
// RESPONSE:
//   Success:   { status: "confirmed", tier, activatedAt }
//   Pending:   { status: "pending_confirmations", confirmations, required, estimatedWaitSeconds }
//   Failed:    { error: "...", code: "VERIFICATION_FAILED" | "DUPLICATE" | ... }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEVMChainConfig, ChainType } from "./chainConfig.ts";
import { verifyEVMPayment }             from "./evmAdapter.ts";
import { verifySOLANAPayment, verifyCARDANOPayment } from "./futureAdapters.ts";

// ── Supabase admin client (service role — bypasses RLS) ───────────────────────
const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

// ── CORS headers ───────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, code: string, status = 400): Response {
  return json({ error: message, code }, status);
}

// ── Auth helper ────────────────────────────────────────────────────────────────
async function requireAuth(req: Request): Promise<{ userId: string; email: string }> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Missing auth token");
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(
    auth.replace("Bearer ", "")
  );
  if (error || !user) throw new Error("Invalid or expired auth token");
  return { userId: user.id, email: user.email ?? "" };
}

// ── Input validation ──────────────────────────────────────────────────────────
const EVM_TX_HASH_RE   = /^0x[0-9a-fA-F]{64}$/;
const EVM_ADDRESS_RE   = /^0x[0-9a-fA-F]{40}$/;
const UUID_RE          = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateEVMTxHash(hash: string): boolean {
  return EVM_TX_HASH_RE.test(hash);
}
function validateEVMAddress(addr: string): boolean {
  return EVM_ADDRESS_RE.test(addr);
}
function validateUUID(id: string): boolean {
  return UUID_RE.test(id);
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return err("Method not allowed", "METHOD_NOT_ALLOWED", 405);

  // ── 1. Authenticate caller ─────────────────────────────────────────────────
  let userId: string;
  let userEmail: string;
  try {
    const auth = await requireAuth(req);
    userId    = auth.userId;
    userEmail = auth.email;
  } catch (e) {
    return err(e instanceof Error ? e.message : "Unauthorized", "UNAUTHORIZED", 401);
  }

  // ── 2. Parse and validate request body ────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", "INVALID_REQUEST");
  }

  const {
    chainType,
    chain,
    txHash,
    productId,
    idempotencyKey,
    claimedSenderWallet,
    expectedTokenAddress = null,
  } = body as {
    chainType:             string;
    chain:                 string;
    txHash:                string;
    productId:             string;
    idempotencyKey:        string;
    claimedSenderWallet:   string;
    expectedTokenAddress?: string | null;
  };

  // Required fields
  if (!chainType || !chain || !txHash || !productId || !idempotencyKey || !claimedSenderWallet) {
    return err(
      "Missing required fields: chainType, chain, txHash, productId, idempotencyKey, claimedSenderWallet",
      "MISSING_FIELDS"
    );
  }

  // UUID format
  if (!validateUUID(productId) || !validateUUID(idempotencyKey)) {
    return err("productId and idempotencyKey must be valid UUID v4", "INVALID_FIELDS");
  }

  // Chain-type-specific format validation
  if (chainType === "EVM") {
    if (!validateEVMTxHash(txHash)) {
      return err("Invalid EVM txHash format (expected 0x + 64 hex chars)", "INVALID_FIELDS");
    }
    if (!validateEVMAddress(claimedSenderWallet)) {
      return err("Invalid EVM wallet address format", "INVALID_FIELDS");
    }
    if (expectedTokenAddress !== null && !validateEVMAddress(expectedTokenAddress)) {
      return err("Invalid expectedTokenAddress format", "INVALID_FIELDS");
    }
  }

  const db = supabaseAdmin();

  // ── 3. Replay protection — check if this txHash was already used ──────────
  // We check BEFORE doing any RPC calls to avoid wasted work.
  const { data: existingPayment } = await db
    .from("payments")
    .select("id, status, user_id")
    .eq("provider_payment_id", txHash.toLowerCase())
    .eq("provider", "web3")
    .maybeSingle();

  if (existingPayment) {
    if (existingPayment.status === "completed") {
      // Already processed and successful
      if (existingPayment.user_id !== userId) {
        // CRITICAL: Someone is trying to claim another user's transaction
        logSecurityEvent(db, userId, "TX_CLAIM_CONFLICT", {
          txHash,
          originalUserId: existingPayment.user_id,
        });
        return err(
          "This transaction has already been used to activate a different account.",
          "TX_ALREADY_USED",
          409
        );
      }
      return json({ status: "already_verified", message: "Your account is already active." });
    }

    if (existingPayment.status === "processing") {
      // Previously submitted but pending confirmations — re-verify
      // (falls through to verification below)
    }
  }

  // ── 4. Check idempotency — return existing result for same key + user ─────
  const { data: existingIntent } = await db
    .from("payment_intents")
    .select("id, status, metadata")
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingIntent?.status === "completed") {
    return json({ status: "already_verified", message: "Your account is already active." });
  }

  // ── 5. Fetch product from DB (NEVER trust amount from frontend) ───────────
  const { data: product, error: productErr } = await db
    .from("payment_products")
    .select("id, name, tier, amount_usd, is_active, metadata")
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();

  if (productErr || !product) {
    return err("Invalid or inactive product.", "INVALID_PRODUCT", 404);
  }

  // ── 6. Get treasury wallet from ENV (NEVER from frontend) ─────────────────
  const treasuryWallet = Deno.env.get("TREASURY_WALLET_ADDRESS");
  if (!treasuryWallet) {
    console.error("[web3-verify] TREASURY_WALLET_ADDRESS env var not set");
    return err("Payment service misconfigured. Contact support.", "SERVER_ERROR", 500);
  }

  // ── 7. Rate limit — max 10 verify attempts per tx per user per hour ───────
  const { count: recentAttempts } = await db
    .from("webhook_events")
    .select("*", { count: "exact", head: true })
    .eq("provider", "web3")
    .eq("event_type", "verify_attempt")
    .contains("payload", { user_id: userId, tx_hash: txHash.toLowerCase() })
    .gte("received_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((recentAttempts ?? 0) >= 10) {
    return err(
      "Too many verification attempts for this transaction. Please wait before retrying.",
      "RATE_LIMITED",
      429
    );
  }

  // Log this attempt (also used for rate limiting above)
  await db.from("webhook_events").insert({
    provider:   "web3",
    event_id:   `attempt:${txHash.toLowerCase()}:${userId}:${Date.now()}`,
    event_type: "verify_attempt",
    payload:    { user_id: userId, tx_hash: txHash.toLowerCase(), chain, chainType },
    verified:   false,
  }).single();

  // ── 8. Route to blockchain adapter ────────────────────────────────────────
  console.log(`[web3-verify] User=${userId} Chain=${chainType}:${chain} Tx=${txHash}`);

  let verificationResult: {
    verified:        boolean;
    reason:          string;
    pendingConfirms: boolean;
    confirmations:   number;
    [key: string]:   unknown;
  };

  try {
    if (chainType === "EVM") {
      const chainConfig = getEVMChainConfig(chain);
      if (!chainConfig) {
        return err(
          `Unsupported EVM chain: '${chain}'. Supported: polygon, base, arbitrum, ethereum, bnb`,
          "UNSUPPORTED_CHAIN"
        );
      }

      verificationResult = await verifyEVMPayment({
        chain,
        chainConfig,
        txHash:               txHash.toLowerCase(),
        expectedRecipient:    treasuryWallet,
        expectedAmountUSD:    product.amount_usd,
        expectedTokenAddress: expectedTokenAddress ?? null,
        claimedSenderWallet,
      });

    } else if (chainType === "SOLANA") {
      const result = await verifySOLANAPayment({
        txSignature:       txHash,
        expectedRecipient: treasuryWallet,
        expectedAmountUSD: product.amount_usd,
        claimedSender:     claimedSenderWallet,
      });
      verificationResult = result;

    } else if (chainType === "CARDANO") {
      const result = await verifyCARDANOPayment({
        txHash,
        expectedRecipient: treasuryWallet,
        expectedAmountUSD: product.amount_usd,
        claimedSender:     claimedSenderWallet,
      });
      verificationResult = result;

    } else {
      return err(
        `Unsupported chainType: '${chainType}'. Supported: EVM`,
        "UNSUPPORTED_CHAIN_TYPE"
      );
    }

  } catch (e) {
    console.error("[web3-verify] Adapter error:", e);
    return err(
      "Blockchain verification failed due to a network error. Please try again.",
      "RPC_ERROR",
      503
    );
  }

  // ── 9. Handle pending confirmations ───────────────────────────────────────
  if (verificationResult.pendingConfirms) {
    // Store as processing so the scheduler can retry
    await upsertPayment(db, {
      userId,
      product,
      txHash:          txHash.toLowerCase(),
      idempotencyKey,
      chain,
      chainType,
      status:          "processing",
      walletAddress:   claimedSenderWallet.toLowerCase(),
      tokenAddress:    (verificationResult.tokenAddress as string) || expectedTokenAddress || null,
      blockNumber:     (verificationResult.blockNumber as number) || null,
      confirmations:   verificationResult.confirmations,
      verificationLog: verificationResult,
    });

    const chainCfg  = chainType === "EVM" ? getEVMChainConfig(chain) : null;
    const blockTime = chainCfg?.blockTimeSeconds ?? 3;
    const remaining = Math.max(0, verificationResult.requiredConfirms as number - verificationResult.confirmations);

    return json({
      status:                 "pending_confirmations",
      confirmations:          verificationResult.confirmations,
      required:               verificationResult.requiredConfirms,
      estimatedWaitSeconds:   remaining * blockTime,
      message:                `Transaction found! Waiting for ${remaining} more confirmation(s). ` +
                              `Estimated wait: ~${Math.ceil(remaining * blockTime / 60)} minute(s).`,
    });
  }

  // ── 10. Handle failed verification ────────────────────────────────────────
  if (!verificationResult.verified) {
    console.warn(
      `[web3-verify] FAILED User=${userId} Tx=${txHash} Reason=${verificationResult.reason}`
    );

    // Update payment status to failed if it existed
    if (existingPayment) {
      await db.from("payments")
        .update({ status: "failed", failure_reason: verificationResult.reason, updated_at: new Date().toISOString() })
        .eq("provider_payment_id", txHash.toLowerCase());
    }

    return err(verificationResult.reason, "VERIFICATION_FAILED", 422);
  }

  // ── 11. ✅ VERIFIED — Store payment and activate account ─────────────────
  console.log(
    `[web3-verify] ✅ CONFIRMED User=${userId} Tx=${txHash} ` +
    `Token=${verificationResult.tokenSymbol} Amount=${verificationResult.amountFound}`
  );

  try {
    // Store completed payment (UPSERT on idempotency_key = safe to retry)
    const { data: paymentRecord, error: payErr } = await upsertPayment(db, {
      userId,
      product,
      txHash:          txHash.toLowerCase(),
      idempotencyKey,
      chain,
      chainType,
      status:          "completed",
      walletAddress:   (verificationResult.fromAddress as string) || claimedSenderWallet.toLowerCase(),
      tokenAddress:    (verificationResult.tokenAddress as string) || expectedTokenAddress || null,
      blockNumber:     (verificationResult.blockNumber as number) || null,
      confirmations:   verificationResult.confirmations,
      verificationLog: verificationResult,
    });

    if (payErr) {
      // If it's a duplicate-key error, the payment was already processed
      if (payErr.code === "23505") {
        return json({ status: "already_verified", message: "Your account is already active." });
      }
      throw new Error("Payment record insert failed: " + payErr.message);
    }

    // Mark intent as completed
    await db.from("payment_intents")
      .upsert({
        user_id:          userId,
        product_id:       product.id,
        idempotency_key:  idempotencyKey,
        provider:         "web3",
        provider_session: txHash.toLowerCase(),
        amount_cents:     Math.round(product.amount_usd * 100),
        currency:         "USD",
        status:           "completed",
        expires_at:       new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        metadata:         { tx_hash: txHash.toLowerCase(), chain, confirmed_at: new Date().toISOString() },
      }, { onConflict: "idempotency_key" });

    // Log confirmed webhook event for audit trail
    await db.from("webhook_events").upsert({
      provider:    "web3",
      event_id:    `confirmed:${txHash.toLowerCase()}`,
      event_type:  "transfer.confirmed",
      payload:     {
        tx_hash:      txHash.toLowerCase(),
        chain,
        chain_type:   chainType,
        user_id:      userId,
        user_email:   userEmail,
        token_symbol: verificationResult.tokenSymbol,
        amount_found: verificationResult.amountFound,
        confirmations: verificationResult.confirmations,
      },
      verified:    true,
      processed:   true,
      payment_id:  paymentRecord?.id ?? null,
      processed_at: new Date().toISOString(),
    }, { onConflict: "provider, event_id" });

    // Activate account
    await activateAccount(db, userId, product.tier, product.metadata as Record<string, unknown>);

    return json({
      status:      "confirmed",
      tier:        product.tier,
      activatedAt: new Date().toISOString(),
      message:     "Payment confirmed and account activated. Welcome to Xeevia!",
    });

  } catch (e) {
    console.error("[web3-verify] Post-verification error:", e);
    // Payment verified on-chain but DB write failed.
    // Log for manual recovery — user's money is safe.
    await db.from("webhook_events").insert({
      provider:    "web3",
      event_id:    `error:${txHash.toLowerCase()}:${Date.now()}`,
      event_type:  "activation.error",
      payload:     {
        user_id:  userId,
        tx_hash:  txHash.toLowerCase(),
        error:    e instanceof Error ? e.message : String(e),
        verified: true,  // Payment WAS verified — this is a DB error, not a payment error
      },
      verified:    true,
      processed:   false,
      processing_error: e instanceof Error ? e.message : String(e),
    });

    return err(
      "Payment verified on-chain but account activation failed. " +
      "Please contact support with your transaction hash — you will NOT lose your money.",
      "ACTIVATION_ERROR",
      500
    );
  }
});

// ── DB helpers ────────────────────────────────────────────────────────────────

async function upsertPayment(
  db: ReturnType<typeof supabaseAdmin>,
  p: {
    userId:          string;
    product:         { id: string; amount_usd: number };
    txHash:          string;
    idempotencyKey:  string;
    chain:           string;
    chainType:       string;
    status:          string;
    walletAddress:   string;
    tokenAddress:    string | null;
    blockNumber:     number | null;
    confirmations:   number;
    verificationLog: unknown;
  }
) {
  return db.from("payments").upsert({
    user_id:              p.userId,
    product_id:           p.product.id,
    provider:             "web3",
    provider_payment_id:  p.txHash,
    amount_cents:         Math.round(p.product.amount_usd * 100),
    currency:             "USD",
    status:               p.status,
    idempotency_key:      p.idempotencyKey,
    chain_id:             null,            // We store chain name, not numeric ID here
    wallet_address:       p.walletAddress,
    contract_address:     p.tokenAddress,
    block_number:         p.blockNumber,
    block_confirmations:  p.confirmations,
    webhook_received_at:  p.status === "completed" ? new Date().toISOString() : null,
    completed_at:         p.status === "completed" ? new Date().toISOString() : null,
    metadata: {
      chain:            p.chain,
      chain_type:       p.chainType,
      verification_log: p.verificationLog,
    },
  }, { onConflict: "idempotency_key" })
  .select("id")
  .single();
}

async function activateAccount(
  db:       ReturnType<typeof supabaseAdmin>,
  userId:   string,
  tier:     string,
  meta:     Record<string, unknown> = {}
) {
  const updates: Record<string, unknown> = {
    account_activated: true,
    subscription_tier: tier,
    updated_at:        new Date().toISOString(),
  };

  if (tier === "pro") updates["is_pro"] = true;

  await db.from("profiles").update(updates).eq("id", userId);

  // Grant EP bonus if specified in product metadata
  if (meta.ep_grant && Number(meta.ep_grant) > 0) {
    await db.rpc("increment_engagement_points", {
      p_user_id: userId,
      p_amount:  Number(meta.ep_grant),
    }).catch((e: unknown) => {
      // Non-fatal — EP failure does not block activation
      console.warn("[web3-verify] EP grant failed (non-fatal):", e);
    });
  }
}

async function logSecurityEvent(
  db:      ReturnType<typeof supabaseAdmin>,
  userId:  string,
  event:   string,
  payload: Record<string, unknown>
) {
  await db.from("webhook_events").insert({
    provider:   "web3",
    event_id:   `security:${event}:${userId}:${Date.now()}`,
    event_type: `security.${event.toLowerCase()}`,
    payload:    { user_id: userId, ...payload },
    verified:   false,
  }).single().catch(() => {});
}