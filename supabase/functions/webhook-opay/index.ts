// supabase/functions/webhook-opay/index.ts
// Handle OPay payment confirmations and disbursement callbacks
// Validates webhook signature, credits wallet on successful payment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const opaySecretKey = Deno.env.get("OPAY_SECRET_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface OPayWebhookEvent {
  reference: string;
  amount: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  type: "DEPOSIT" | "WITHDRAWAL" | "BILL_PAYMENT";
  userPhone?: string;
  accountNumber?: string;
  timestamp: string;
  signature: string;
}

async function verifyOPaySignature(
  event: OPayWebhookEvent,
  signature: string
): Promise<boolean> {
  const crypto = await import("https://deno.land/std@0.208.0/crypto/mod.ts");
  
  // OPay signature verification: HMAC-SHA256
  const message = JSON.stringify(event);
  const key = new TextEncoder().encode(opaySecretKey);
  const data = new TextEncoder().encode(message);
  
  const computed = await crypto.subtle.sign("HMAC", 
    await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    data
  );
  
  const computedSig = Array.from(new Uint8Array(computed))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return computedSig === signature;
}

async function handleDepositSuccess(event: OPayWebhookEvent) {
  const { data: transaction, error: txError } = await supabase
    .from("paywave_transactions")
    .select("id, user_id, amount, fee_amount, net_amount")
    .eq("provider_transaction_id", event.reference)
    .maybeSingle();

  if (txError || !transaction) {
    console.error("Transaction not found:", event.reference);
    return;
  }

  // Credit user wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, paywave_balance")
    .eq("user_id", transaction.user_id)
    .maybeSingle();

  if (!wallet) {
    console.error("Wallet not found for user:", transaction.user_id);
    return;
  }

  const newBalance = (wallet.paywave_balance || 0) + transaction.net_amount;

  // Update wallet balance
  await supabase
    .from("wallets")
    .update({ paywave_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  // Update transaction status
  await supabase
    .from("paywave_transactions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: {
        ...transaction.metadata,
        opay_webhook_received_at: new Date().toISOString(),
        wallet_credited_amount: transaction.net_amount,
      },
    })
    .eq("id", transaction.id);

  console.log(`Deposit successful: ${event.reference}, credited ₦${transaction.net_amount}`);
}

async function handleWithdrawalSuccess(event: OPayWebhookEvent) {
  const { data: transaction } = await supabase
    .from("paywave_transactions")
    .select("id, user_id, amount, status")
    .eq("provider_transaction_id", event.reference)
    .maybeSingle();

  if (!transaction) return;

  // Update transaction status
  await supabase
    .from("paywave_transactions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: {
        ...transaction.metadata,
        withdrawal_confirmed_at: new Date().toISOString(),
        bank_reference: event.reference,
      },
    })
    .eq("id", transaction.id);

  console.log(`Withdrawal successful: ${event.reference}`);
}

async function handleBillPaymentSuccess(event: OPayWebhookEvent) {
  const { data: transaction } = await supabase
    .from("paywave_transactions")
    .select("id, user_id, amount, transaction_type")
    .eq("provider_transaction_id", event.reference)
    .maybeSingle();

  if (!transaction) return;

  // Update transaction status
  await supabase
    .from("paywave_transactions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: {
        ...transaction.metadata,
        bill_payment_confirmed_at: new Date().toISOString(),
      },
    })
    .eq("id", transaction.id);

  console.log(`Bill payment successful: ${event.reference} (${transaction.transaction_type})`);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json() as OPayWebhookEvent;
    
    // Verify webhook signature
    if (!await verifyOPaySignature(body, body.signature)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    // Handle based on event type and status
    if (body.status === "SUCCESS") {
      if (body.type === "DEPOSIT") {
        await handleDepositSuccess(body);
      } else if (body.type === "WITHDRAWAL") {
        await handleWithdrawalSuccess(body);
      } else if (body.type === "BILL_PAYMENT") {
        await handleBillPaymentSuccess(body);
      }
    } else if (body.status === "FAILED") {
      // Update transaction to failed
      await supabase
        .from("paywave_transactions")
        .update({
          status: "failed",
          metadata: {
            ...body,
            failed_at: new Date().toISOString(),
          },
        })
        .eq("provider_transaction_id", body.reference);
    }

    return new Response(JSON.stringify({ success: true, reference: body.reference }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
