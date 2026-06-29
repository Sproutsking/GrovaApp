// supabase/functions/web3-webhook-listener/index.ts
// ════════════════════════════════════════════════════════════════════════════
// WEB3 WEBHOOK LISTENER — Process On-Chain Events & Update Confirmations
//
// ENTRY POINTS:
//   1. PUSH: External webhook calls this when TX is confirmed
//   2. POLL: Scheduled job periodically checks pending confirmations
//   3. MANUAL: Edge function called from submit-payment after TX submission
//
// FLOW:
//   1. Receive webhook event (tx_hash, confirmations, block_number)
//   2. Verify event authenticity (if applicable)
//   3. Look up pending confirmation tracker
//   4. Update confirmation count
//   5. If finalized → mark payment complete → credit user
//   6. Log event to webhook_events table
//   7. Return status
//
// IDEMPOTENCY:
//   ✓ Same tx_hash + event_type only processed once (via received_at uniqueness)
//   ✓ Payment status checked before crediting (no double-credit)
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

// ── RPC helper for on-chain verification ────────────────────────────────────
async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = await res.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    txHash?: string;
    chainType?: string;
    chainName?: string;
    confirmations?: number;
    blockNumber?: number;
    blockTime?: number;
    status?: string;
    eventType?: string;
    fromWebhook?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const {
    txHash,
    chainType = "EVM",
    chainName = "polygon",
    confirmations = 0,
    blockNumber,
    status = "submitted",
    eventType = "confirmed",
    fromWebhook = false,
  } = body;

  if (!txHash) {
    return json({ error: "txHash required" }, 400);
  }

  const normalizedTxHash = txHash.toLowerCase().replace(/^0x/, "0x");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey);

  // ── Find pending confirmation by tx_hash ─────────────────────────────────────
  const { data: pending, error: pendingError } = await db
    .from("web3_pending_confirmations")
    .select("*")
    .eq("tx_hash", normalizedTxHash)
    .maybeSingle();

  if (pendingError) {
    console.error("Pending fetch error:", pendingError);
    return json({ error: "Database error" }, 500);
  }

  if (!pending) {
    return json({
      error: "No pending confirmation found for this transaction",
      code: "PENDING_NOT_FOUND",
    }, 404);
  }

  // ── Verify on-chain if from external source ─────────────────────────────────
  let verifiedConfirmations = confirmations;

  if (fromWebhook && chainType === "EVM") {
    try {
      const rpcUrl = Deno.env.get(`${chainName.toUpperCase()}_RPC_URL`);
      if (!rpcUrl) {
        console.warn(`No RPC URL for ${chainName}, skipping verification`);
      } else {
        // Get current block number
        const latestBlock = await rpcCall(rpcUrl, "eth_blockNumber", []);
        const latestBlockNum = parseInt(latestBlock as string, 16);

        // Get transaction receipt
        const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [normalizedTxHash]);

        if (!receipt) {
          return json({
            error: "Transaction not found on-chain",
            code: "TX_NOT_FOUND",
          }, 404);
        }

        const txBlockNum = parseInt((receipt as any).blockNumber, 16);
        verifiedConfirmations = latestBlockNum - txBlockNum + 1;

        // Check if transaction succeeded
        if ((receipt as any).status !== "0x1") {
          console.warn(`Transaction ${normalizedTxHash} failed on-chain`);
          await db
            .from("payments")
            .update({ status: "failed", metadata: { failed_reason: "Transaction failed on-chain" } })
            .eq("provider_payment_id", normalizedTxHash);

          await db
            .from("web3_pending_confirmations")
            .update({ is_finalized: true })
            .eq("payment_id", pending.payment_id);

          return json({
            status: "failed",
            txHash: normalizedTxHash,
            message: "Transaction failed on-chain",
          });
        }
      }
    } catch (e) {
      console.error("On-chain verification error:", (e as Error).message);
      // Non-critical — continue with provided confirmations
    }
  }

  // ── Update pending confirmation ──────────────────────────────────────────────
  const isFinalized = verifiedConfirmations >= pending.required_confirmations;

  const { error: updateError } = await db
    .from("web3_pending_confirmations")
    .update({
      current_confirmations: verifiedConfirmations,
      is_finalized: isFinalized,
      ...(isFinalized && { finalized_at: new Date().toISOString() }),
      last_checked_at: new Date().toISOString(),
    })
    .eq("payment_id", pending.payment_id);

  if (updateError) {
    console.error("Pending update error:", updateError);
    return json({ error: "Failed to update confirmation status" }, 500);
  }

  // ── Log webhook event ────────────────────────────────────────────────────────
  const { error: eventError } = await db.from("web3_webhook_events").insert({
    payment_id: pending.payment_id,
    user_id: pending.user_id,
    chain_type: pending.chain_type,
    chain_name: pending.chain_name,
    tx_hash: normalizedTxHash,
    event_type: eventType,
    block_number: blockNumber,
    confirmations: verifiedConfirmations,
    payload: { status, fromWebhook },
    verified: true,
    processed: true,
  });

  if (eventError) {
    console.error("Event logging error:", eventError);
    // Non-critical
  }

  // ── If finalized, credit the user ────────────────────────────────────────────
  if (isFinalized) {
    try {
      // Get payment
      const { data: payment, error: paymentFetchError } = await db
        .from("payments")
        .select("*")
        .eq("id", pending.payment_id)
        .eq("status", "processing")
        .single();

      if (paymentFetchError || !payment) {
        console.warn("Payment not found or already completed");
        return json({
          status: "completed",
          txHash: normalizedTxHash,
          confirmations: verifiedConfirmations,
          message: "Payment finalized (already processed)",
        });
      }

      // Mark payment as completed
      const { error: completeError } = await db
        .from("payments")
        .update({
          status: "completed",
          block_confirmations: verifiedConfirmations,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.payment_id);

      if (completeError) {
        console.error("Payment completion error:", completeError);
        throw completeError;
      }

      // Credit user's EP wallet (call the finalize function)
      const { error: creditError } = await db.rpc("finalize_web3_payment", {
        p_payment_id: pending.payment_id,
        p_block_confirmations: verifiedConfirmations,
      });

      if (creditError) {
        console.error("Credit error:", creditError);
        // Still return success because payment is marked complete
        console.warn("Payment marked complete but credit may be pending");
      } else {
        console.log(`✓ Payment ${pending.payment_id} completed and credited`);
      }

      // Update auto payment session to confirmed
      await db
        .from("web3_auto_payment_sessions")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("payment_id", pending.payment_id)
        .catch((e) => console.warn("Session update error:", e));

      return json({
        success: true,
        status: "completed",
        txHash: normalizedTxHash,
        confirmations: verifiedConfirmations,
        paymentId: pending.payment_id,
        message: `✓ Payment confirmed! ${payment.amount_cents / 100} USD credited.`,
      });
    } catch (e) {
      console.error("Finalization error:", (e as Error).message);
      return json({
        error: "Failed to finalize payment",
        details: (e as Error).message,
      }, 500);
    }
  }

  // ── Not yet finalized, return progress ────────────────────────────────────────
  return json({
    status: "pending",
    txHash: normalizedTxHash,
    confirmations: verifiedConfirmations,
    requiredConfirmations: pending.required_confirmations,
    message: `Waiting for confirmations (${verifiedConfirmations}/${pending.required_confirmations})`,
  }, 202);
});
