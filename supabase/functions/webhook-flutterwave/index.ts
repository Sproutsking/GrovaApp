// supabase/functions/webhook-flutterwave/index.ts
// Handle Flutterwave payment confirmations
// Validates webhook signature, credits wallet on successful payment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FlutterwaveWebhook {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    device_fingerprint: string;
    amount: number;
    currency: string;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    processor_response: string;
    auth_model: string;
    ip: string;
    narration: string;
    status: string;
    payment_type: string;
    created_at: string;
    account_id: number;
    customer: {
      id: number;
      name: string;
      phone_number: string;
      email: string;
    };
    card: {
      first_6digits: string;
      last_4digits: string;
      issuer: string;
      country: string;
      type: string;
      token: string;
    };
    meta: {
      user_id?: string;
    };
  };
}

async function verifyFlutterwaveSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const crypto = await import("https://deno.land/std@0.208.0/crypto/mod.ts");
  
  // Flutterwave signature verification: HMAC-SHA256
  const key = new TextEncoder().encode(flutterwaveSecretKey);
  const data = new TextEncoder().encode(body);
  
  const computed = await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    data
  );
  
  const computedSig = Array.from(new Uint8Array(computed))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return computedSig === signature;
}

async function handlePaymentSuccess(webhook: FlutterwaveWebhook) {
  const { data: payload } = webhook;
  const userId = payload.meta?.user_id;
  
  if (!userId) {
    console.error("No user_id in webhook metadata");
    return;
  }

  // Find transaction by tx_ref
  const { data: transaction, error: txError } = await supabase
    .from("paywave_transactions")
    .select("id, user_id, amount, fee_amount, net_amount, status")
    .eq("reference_id", payload.tx_ref)
    .maybeSingle();

  if (txError || !transaction) {
    console.error("Transaction not found for tx_ref:", payload.tx_ref);
    return;
  }

  if (transaction.status === "completed") {
    console.log("Transaction already completed:", payload.tx_ref);
    return; // Already processed
  }

  // Get user wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, paywave_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (!wallet) {
    console.error("Wallet not found for user:", userId);
    return;
  }

  // Calculate net amount (amount - fee already applied during checkout)
  const creditAmount = transaction.net_amount;
  const newBalance = (wallet.paywave_balance || 0) + creditAmount;

  // Credit wallet
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
      provider_transaction_id: payload.flw_ref,
      metadata: {
        ...transaction.metadata,
        flutterwave_webhook_received: new Date().toISOString(),
        customer_email: payload.customer.email,
        customer_phone: payload.customer.phone_number,
        payment_type: payload.payment_type,
        card_issuer: payload.card?.issuer,
        wallet_credited_amount: creditAmount,
      },
    })
    .eq("id", transaction.id);

  console.log(`Payment successful: ${payload.tx_ref}, credited ₦${creditAmount}`);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("verifyHash") || req.headers.get("x-flutterwave-signature");

    if (!signature) {
      console.error("No signature header");
      return new Response(JSON.stringify({ error: "No signature" }), { status: 401 });
    }

    // Verify signature
    if (!await verifyFlutterwaveSignature(body, signature)) {
      console.error("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    const webhook = JSON.parse(body) as FlutterwaveWebhook;

    // Only handle successful payments
    if (webhook.event === "charge.completed" && webhook.data.status === "successful") {
      await handlePaymentSuccess(webhook);
    } else if (webhook.event === "charge.completed" && webhook.data.status === "failed") {
      // Mark transaction as failed
      await supabase
        .from("paywave_transactions")
        .update({
          status: "failed",
          metadata: {
            ...webhook.data.meta,
            failed_at: new Date().toISOString(),
            failure_reason: webhook.data.processor_response,
          },
        })
        .eq("reference_id", webhook.data.tx_ref);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
