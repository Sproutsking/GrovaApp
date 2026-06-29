// supabase/functions/deposit-opay-checkout/index.ts
// OPay wallet deposit: Request-to-Pay flow
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const opayApiUrl = Deno.env.get("OPAY_API_URL") || "https://api.opayweb.com/api/v3";
const opayApiKey = Deno.env.get("OPAY_API_KEY")!;
const opaySecretKey = Deno.env.get("OPAY_SECRET_KEY")!;
const opayMerchantId = Deno.env.get("OPAY_MERCHANT_ID")!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { userId, opayPhone, ngnAmount, currency = "NGN" } = await req.json();

    if (!userId || !opayPhone || !ngnAmount) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: userId, opayPhone, ngnAmount",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Validate user exists
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Create PayWave transaction record
    const transactionRef = `opay_deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .insert({
        user_id: userId,
        transaction_type: "deposit",
        amount: ngnAmount,
        fee_amount: 0,
        net_amount: ngnAmount,
        status: "pending",
        provider: "OPay",
        reference_id: transactionRef,
        metadata: {
          opay_phone: opayPhone,
          currency,
          checkout_type: "request_to_pay",
        },
      })
      .select()
      .single();

    if (txError || !txData) {
      return new Response(
        JSON.stringify({ error: "Failed to create transaction record" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Call OPay Request-to-Pay API
    // OPay creates a payment request that user must approve in their OPay app
    const opayPayload = {
      merchant_id: opayMerchantId,
      reference: transactionRef,
      amount: Math.round(ngnAmount * 100), // Convert to kobo
      currency: "NGN",
      phone: opayPhone.replace(/^0/, "234"), // Convert 0708... to 234708...
      user_id: userId,
      metadata: {
        xeevia_transaction_id: txData.id,
        user_email: userData.email,
      },
    };

    const opaySignature = await generateOPaySignature(opayPayload, opaySecretKey);

    const opayResponse = await fetch(
      `${opayApiUrl}/request-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opayApiKey}`,
          "X-Signature": opaySignature,
        },
        body: JSON.stringify(opayPayload),
      }
    );

    if (!opayResponse.ok) {
      const error = await opayResponse.json();
      console.error("[opay-deposit] OPay API error:", error);

      // Update transaction status
      await supabase
        .from("paywave_transactions")
        .update({ status: "failed" })
        .eq("id", txData.id);

      return new Response(
        JSON.stringify({
          error: error.message || "OPay API request failed",
          provider_error: error,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const opayData = await opayResponse.json();

    // 4. Update transaction with OPay reference
    await supabase
      .from("paywave_transactions")
      .update({
        status: "processing",
        provider_transaction_id: opayData.transaction_id,
        metadata: {
          ...txData.metadata,
          opay_transaction_id: opayData.transaction_id,
          opay_request_id: opayData.request_id,
          checkout_initiated_at: new Date().toISOString(),
        },
      })
      .eq("id", txData.id);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: txData.id,
        reference: transactionRef,
        provider_transaction_id: opayData.transaction_id,
        status: "processing",
        message: `OPay payment request sent to ${opayPhone}. Please approve in your OPay app.`,
        amount: ngnAmount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[deposit-opay-checkout] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Helper: Generate OPay API signature
async function generateOPaySignature(
  payload: Record<string, unknown>,
  secretKey: string
): Promise<string> {
  const message = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const keyData = encoder.encode(secretKey);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
