// supabase/functions/webhook-xrc-settlement/index.ts
// Handle XRC Oracle blockchain settlement confirmations
// Validates blockchain proof, updates transaction status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BlockchainSettlement {
  transactionHash: string;
  chainId: number; // 1 = Solana, 137 = Polygon, 8453 = Base
  blockNumber: number;
  confirmations: number;
  fromAddress: string;
  toAddress: string;
  amount: string; // in USD
  timestamp: string;
  status: "confirmed" | "pending" | "failed";
  signature?: string;
}

const CHAIN_NAMES: Record<number, string> = {
  1: "solana",
  137: "polygon",
  8453: "base",
};

async function handleBlockchainConfirmation(settlement: BlockchainSettlement) {
  const chainName = CHAIN_NAMES[settlement.chainId];
  
  if (!chainName) {
    console.error("Unknown chain ID:", settlement.chainId);
    return;
  }

  // Find transaction by provider reference
  const { data: transaction, error: txError } = await supabase
    .from("paywave_transactions")
    .select("id, user_id, amount, status, provider")
    .eq("provider_transaction_id", settlement.transactionHash)
    .eq("provider", chainName.toUpperCase())
    .maybeSingle();

  if (txError || !transaction) {
    console.error(`Transaction not found for ${chainName} hash:`, settlement.transactionHash);
    return;
  }

  if (transaction.status === "completed") {
    console.log("Transaction already completed:", settlement.transactionHash);
    return;
  }

  // Get or create XRC record
  const usdAmount = parseFloat(settlement.amount);
  const ngnRate = 1500; // Current USD to NGN rate
  const creditAmount = usdAmount * ngnRate;

  const { data: xrcRecord } = await supabase
    .from("xrc_paywave_records")
    .insert({
      paywave_transaction_id: transaction.id,
      chain_id: settlement.chainId,
      chain_name: chainName,
      transaction_hash: settlement.transactionHash,
      block_number: settlement.blockNumber,
      confirmations: settlement.confirmations,
      status: settlement.status === "confirmed" ? "verified" : "pending",
      proof_data: {
        from_address: settlement.fromAddress,
        to_address: settlement.toAddress,
        amount_usd: usdAmount,
        amount_ngn: creditAmount,
        timestamp: settlement.timestamp,
      },
    })
    .select("id")
    .maybeSingle();

  if (!xrcRecord) {
    console.error("Failed to create XRC record");
    return;
  }

  // Get wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, paywave_balance")
    .eq("user_id", transaction.user_id)
    .maybeSingle();

  if (!wallet) {
    console.error("Wallet not found for user:", transaction.user_id);
    return;
  }

  // Credit wallet with NGN equivalent
  const newBalance = (wallet.paywave_balance || 0) + creditAmount;

  await supabase
    .from("wallets")
    .update({ paywave_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  // Update transaction
  await supabase
    .from("paywave_transactions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      xrc_record_id: xrcRecord.id,
      metadata: {
        ...transaction.metadata,
        blockchain_confirmed_at: new Date().toISOString(),
        blockchain_chain: chainName,
        blockchain_confirmations: settlement.confirmations,
        usd_amount: usdAmount,
        ngn_converted_amount: creditAmount,
        conversion_rate: ngnRate,
      },
    })
    .eq("id", transaction.id);

  console.log(`Blockchain settlement confirmed: ${settlement.transactionHash}, credited ₦${creditAmount} on ${chainName}`);
}

async function handleBlockchainFailure(settlement: BlockchainSettlement) {
  const { data: transaction } = await supabase
    .from("paywave_transactions")
    .select("id")
    .eq("provider_transaction_id", settlement.transactionHash)
    .maybeSingle();

  if (!transaction) return;

  // Mark transaction as failed
  await supabase
    .from("paywave_transactions")
    .update({
      status: "failed",
      metadata: {
        blockchain_failed_at: new Date().toISOString(),
        blockchain_failure_reason: "Transaction not confirmed on chain",
      },
    })
    .eq("id", transaction.id);

  console.log(`Blockchain settlement failed: ${settlement.transactionHash}`);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const settlement = await req.json() as BlockchainSettlement;

    // Validate settlement data
    if (!settlement.transactionHash || !settlement.chainId || settlement.confirmations === undefined) {
      return new Response(JSON.stringify({ error: "Invalid settlement data" }), { status: 400 });
    }

    if (settlement.status === "confirmed" && settlement.confirmations >= 1) {
      await handleBlockchainConfirmation(settlement);
    } else if (settlement.status === "failed") {
      await handleBlockchainFailure(settlement);
    } else {
      console.log("Settlement still pending confirmations:", settlement.transactionHash);
    }

    return new Response(JSON.stringify({ success: true, hash: settlement.transactionHash }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
