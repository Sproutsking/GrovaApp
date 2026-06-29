// supabase/functions/deposit-flutterwave-checkout/index.ts
// Flutterwave deposit: Universal mobile money + card checkout
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const flutterwaveApiUrl = "https://api.flutterwave.com/v3";
const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const {
      userId,
      amount,
      currency = "NGN",
      paymentMethod = "all", // all, card, mobile_money
      country = "NG",
    } = await req.json();

    if (!userId || !amount) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: userId, amount",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Validate user
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("id, email, phone")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Create transaction record
    const transactionRef = `flw_deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .insert({
        user_id: userId,
        transaction_type: "deposit",
        amount,
        fee_amount: 0,
        net_amount: amount,
        status: "pending",
        provider: "Flutterwave",
        reference_id: transactionRef,
        metadata: {
          currency,
          payment_method: paymentMethod,
          country,
          checkout_type: "standard",
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

    // 3. Create Flutterwave payment link
    // Flutterwave handles all payment methods via a single checkout URL
    const flutterwavePayload = {
      tx_ref: transactionRef,
      amount: Number(amount),
      currency: currency,
      payment_options: paymentMethod === "all" ? "card,mobilemoney" : paymentMethod,
      redirect_url: `${Deno.env.get("PUBLIC_URL") || "https://app.xeevia.com"}/wallet/deposit-confirm?ref=${transactionRef}`,
      customer: {
        email: userData.email,
        phone_number: userData.phone || "",
        name: userData.id,
      },
      customizations: {
        title: "Xeevia PayWave Deposit",
        description: `Deposit ${amount} ${currency} to your PayWave wallet`,
        logo: "https://app.xeevia.com/logo.png",
      },
      meta: {
        xeevia_transaction_id: txData.id,
        user_id: userId,
      },
    };

    // 4. Call Flutterwave API to initialize payment
    const flutterwaveResponse = await fetch(
      `${flutterwaveApiUrl}/payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${flutterwaveSecretKey}`,
        },
        body: JSON.stringify(flutterwavePayload),
      }
    );

    if (!flutterwaveResponse.ok) {
      const error = await flutterwaveResponse.json();
      console.error("[deposit-flutterwave] Flutterwave API error:", error);

      await supabase
        .from("paywave_transactions")
        .update({ status: "failed" })
        .eq("id", txData.id);

      return new Response(
        JSON.stringify({
          error: error.message || "Flutterwave API request failed",
          provider_error: error,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const flutterwaveData = await flutterwaveResponse.json();

    if (!flutterwaveData.data?.link) {
      return new Response(
        JSON.stringify({
          error: "Failed to generate checkout link",
          provider_error: flutterwaveData,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Update transaction with Flutterwave reference
    await supabase
      .from("paywave_transactions")
      .update({
        status: "processing",
        provider_transaction_id: flutterwaveData.data.id,
        metadata: {
          ...txData.metadata,
          flutterwave_link_id: flutterwaveData.data.id,
          checkout_initiated_at: new Date().toISOString(),
        },
      })
      .eq("id", txData.id);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: txData.id,
        reference: transactionRef,
        provider_transaction_id: flutterwaveData.data.id,
        checkout_url: flutterwaveData.data.link,
        status: "processing",
        message: "Checkout link generated. Redirect user to complete payment.",
        amount,
        currency,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[deposit-flutterwave-checkout] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
