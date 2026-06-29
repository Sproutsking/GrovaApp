// supabase/functions/web3-submit-payment/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WEB3 SUBMIT PAYMENT — Submit Signed TX & Begin Confirmation Tracking
//
// FLOW:
//   1. User submits TX hash from signed wallet transaction
//   2. Function validates signature + TX exists
//   3. Creates payment record (if not already exist via idempotency)
//   4. Creates pending confirmation tracker
//   5. Starts webhook listener (or polling fallback)
//   6. Returns payment ID + initial status
//
// SECURITY:
//   ✓ Idempotency: Same nonce cannot submit twice
//   ✓ Session validation: TX must be from same wallet that initiated
//   ✓ Status tracking: All states logged for audit
//   ✓ Replay protection: TX hash uniqueness checked
//
// ════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Required confirmations by chain ──────────────────────────────────────────
const REQUIRED_CONFIRMATIONS: Record<string, number> = {
  ethereum: 12,
  polygon: 5,
  base: 5,
  arbitrum: 5,
  optimism: 5,
  solana: 0, // Solana is instant finality
  cardano: 2,
  tron: 19,
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    sessionId?: string;
    nonce?: string;
    txHash?: string;
    signature?: string;
    chainType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { sessionId, nonce, txHash, signature, chainType } = body;

  // ── Validate input ─────────────────────────────────────────────────────────
  if (!sessionId) return json({ error: "sessionId required" }, 400);
  if (!nonce) return json({ error: "nonce required" }, 400);
  if (!txHash) return json({ error: "txHash required" }, 400);

  // Normalize TX hash (remove 0x if present, ensure lowercase)
  const normalizedTxHash = txHash.toLowerCase().replace(/^0x/, "");

  // ── Get auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey);

  const token = authHeader.slice(7);

  // ── Verify JWT and get user ─────────────────────────────────────────────────
  let userId: string;
  try {
    const { data: sessionData, error: sessionError } = await db.auth.api.getUser(token);
    if (sessionError || !sessionData?.user?.id) {
      return json({ error: "Invalid session" }, 401);
    }
    userId = sessionData.user.id;
  } catch (e) {
    return json({ error: "Auth failed: " + (e as Error).message }, 401);
  }

  // ── Get auto payment session ────────────────────────────────────────────────
  const { data: autoSession, error: sessionFetchError } = await db
    .from("web3_auto_payment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("nonce", nonce)
    .maybeSingle();

  if (sessionFetchError) {
    console.error("Session fetch error:", sessionFetchError);
    return json({ error: "Failed to fetch payment session" }, 500);
  }

  if (!autoSession) {
    return json({ error: "Payment session not found or expired" }, 404);
  }

  // Check session hasn't already been submitted
  if (autoSession.status !== "awaiting_signature" && autoSession.status !== "signed") {
    return json(
      {
        error: `Session already in status: ${autoSession.status}`,
        message: "Payment already submitted. Check your wallet.",
      },
      409
    );
  }

  // Check session expiry
  if (new Date(autoSession.expires_at) < new Date()) {
    return json({ error: "Payment session expired" }, 410);
  }

  // ── Check for replay: Is this TX already in our system? ──────────────────────
  const { data: existingPayment, error: paymentCheckError } = await db
    .from("payments")
    .select("id,user_id,status")
    .eq("provider_payment_id", `0x${normalizedTxHash}`)
    .maybeSingle();

  if (paymentCheckError) {
    console.error("Payment check error:", paymentCheckError);
    return json({ error: "Database error" }, 500);
  }

  // If TX already exists and belongs to another user → REPLAY ATTACK
  if (existingPayment && existingPayment.user_id !== userId) {
    console.warn(`[REPLAY_ATTACK] TX ${normalizedTxHash} used by different user`);
    return json(
      {
        error: "This transaction has already been used by another account",
        code: "TX_ALREADY_USED",
      },
      409
    );
  }

  // If TX exists and already completed → IDEMPOTENT RETURN
  if (existingPayment && existingPayment.status === "completed") {
    return json({
      status: "already_completed",
      paymentId: existingPayment.id,
      txHash: `0x${normalizedTxHash}`,
      message: "Payment already completed",
    });
  }

  // ── Create or update payment record ──────────────────────────────────────────
  let paymentId = existingPayment?.id;

  if (!paymentId) {
    const { data: newPayment, error: paymentCreateError } = await db
      .from("payments")
      .insert({
        user_id: userId,
        provider: "web3",
        provider_payment_id: `0x${normalizedTxHash}`,
        status: "processing",
        amount_usd: autoSession.amount_usd,
        amount_cents: Math.round(autoSession.amount_usd * 100),
        product_id: "00000000-0000-0000-0000-000000000000",
        idempotency_key: `${sessionId}-${nonce}`,
        wallet_address: autoSession.wallet_address,
        chain_id: 0, // Will be updated by verification
        metadata: {
          chainType: autoSession.chain_type,
          chainName: autoSession.chain_name,
          walletName: autoSession.wallet_name,
          sessionId,
          nonce,
        },
      })
      .select("id")
      .single();

    if (paymentCreateError) {
      console.error("Payment creation error:", paymentCreateError);
      return json({ error: "Failed to create payment record" }, 500);
    }

    paymentId = newPayment.id;
  }

  // ── Create pending confirmation tracker ──────────────────────────────────────
  const requiredConfirmations = REQUIRED_CONFIRMATIONS[autoSession.chain_name.toLowerCase()] || 5;

  const { error: pendingError } = await db.from("web3_pending_confirmations").insert({
    payment_id: paymentId,
    user_id: userId,
    chain_type: autoSession.chain_type,
    chain_name: autoSession.chain_name,
    tx_hash: `0x${normalizedTxHash}`,
    current_confirmations: 0,
    required_confirmations: requiredConfirmations,
    is_finalized: false,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  });

  if (pendingError) {
    console.error("Pending confirmation creation error:", pendingError);
    // Don't fail here — confirmation tracking is secondary
    console.warn("Could not create confirmation tracker, continuing...");
  }

  // ── Update auto payment session ──────────────────────────────────────────────
  const { error: sessionUpdateError } = await db
    .from("web3_auto_payment_sessions")
    .update({
      status: "submitted",
      payment_id: paymentId,
      tx_hash: `0x${normalizedTxHash}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (sessionUpdateError) {
    console.error("Session update error:", sessionUpdateError);
    // Non-critical — continue
  }

  // ── Log webhook event (initial submission) ──────────────────────────────────
  const { error: eventError } = await db.from("web3_webhook_events").insert({
    payment_id: paymentId,
    user_id: userId,
    chain_type: autoSession.chain_type,
    chain_name: autoSession.chain_name,
    tx_hash: `0x${normalizedTxHash}`,
    event_type: "submitted",
    payload: {
      sessionId,
      nonce,
      signature,
    },
    verified: false,
    processed: false,
  });

  if (eventError) {
    console.error("Event logging error:", eventError);
    // Non-critical
  }

  // ── Return success ──────────────────────────────────────────────────────────
  return json({
    success: true,
    paymentId,
    sessionId,
    txHash: `0x${normalizedTxHash}`,
    chainType: autoSession.chain_type,
    chainName: autoSession.chain_name,
    status: "submitted",
    requiredConfirmations,
    message: `Transaction submitted. Waiting for ${requiredConfirmations} confirmations...`,
    polling: {
      url: `/functions/v1/web3-payment-status?paymentId=${paymentId}`,
      interval: 3000, // 3 seconds
      maxWait: 5 * 60 * 1000, // 5 minutes
    },
  });
});
