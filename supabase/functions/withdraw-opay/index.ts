// supabase/functions/withdraw-opay/index.ts
// OPay withdrawal: Send to bank account or OPay wallet
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  getCorsHeaders,
  requireAuth,
  validateEnv,
  jsonResponse,
  errorResponse,
} from "../_shared/payments.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const opayApiUrl = Deno.env.get("OPAY_API_URL") || "https://api.opayweb.com/api/v3";
const opayApiKey = Deno.env.get("OPAY_API_KEY")!;
const opaySecretKey = Deno.env.get("OPAY_SECRET_KEY")!;
const opayMerchantId = Deno.env.get("OPAY_MERCHANT_ID")!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED", req);
  }

  try {
    const {
      userId: bodyUserId,
      amount,
      bankAccount,
      bankCode,
      accountName,
      opayPhone,
      withdrawalPin,
    } = await req.json();

    const authResult = await requireAuth(req);
    const userId = authResult.userId;

    if (bodyUserId && bodyUserId !== userId) {
      return errorResponse(
        "Unauthorized: mismatched user identity",
        401,
        "UNAUTHORIZED",
        req,
      );
    }

    if (!amount) {
      return errorResponse(
        "Missing required field: amount",
        400,
        "INVALID_REQUEST",
        req,
      );
    }

    if (!withdrawalPin) {
      return errorResponse(
        "Withdrawal PIN required",
        400,
        "PIN_REQUIRED",
        req,
      );
    }

    const {
      data: pinValidation,
      error: pinValidationError,
    } = await supabase.rpc("verify_withdrawal_pin", {
      p_user_id: userId,
      p_pin: withdrawalPin,
    });

    const validPin =
      pinValidation === true ||
      pinValidation?.success === true ||
      (typeof pinValidation === "object" && pinValidation?.success === true);

    if (pinValidationError || !validPin) {
      return errorResponse(
        pinValidationError?.message || "Invalid withdrawal PIN",
        401,
        "PIN_INVALID",
        req,
      );
    }

    // 1. Validate user wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("paywave_balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !walletData) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (Number(walletData.paywave_balance) < amount) {
      return new Response(
        JSON.stringify({
          error: "Insufficient balance",
          available: walletData.paywave_balance,
          requested: amount,
        }),
        { status: 400, headers },
      );
    }

    // 2. Create transaction record
    const transactionRef = `opay_withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .insert({
        user_id: userId,
        transaction_type: "withdrawal",
        amount,
        fee_amount: 0,
        net_amount: amount,
        status: "pending",
        provider: "OPay",
        recipient_account: bankAccount || opayPhone,
        reference_id: transactionRef,
        metadata: {
          bank_code: bankCode,
          account_name: accountName,
          withdrawal_type: bankAccount ? "bank" : "opay_wallet",
        },
      })
      .select()
      .single();

    if (txError || !txData) {
      return new Response(
        JSON.stringify({ error: "Failed to create withdrawal record" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Verify bank account name (if bank transfer)
    if (bankAccount && bankCode) {
      const nameCheckResult = await verifyBankAccountName(
        bankAccount,
        bankCode,
        opayApiKey,
        opaySecretKey
      );

      if (!nameCheckResult.valid) {
        await supabase
          .from("paywave_transactions")
          .update({ status: "failed" })
          .eq("id", txData.id);

        return new Response(
          JSON.stringify({
            error: "Account verification failed",
            details: nameCheckResult.error,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Call OPay disbursement API
    const opayPayload = {
      merchant_id: opayMerchantId,
      reference: transactionRef,
      amount: Math.round(amount * 100), // Convert to kobo
      currency: "NGN",
      recipient: bankAccount ? { account: bankAccount, code: bankCode } : { phone: opayPhone },
      narration: "Withdrawal from Xeevia PayWave",
      user_id: userId,
    };

    const opaySignature = await generateOPaySignature(opayPayload, opaySecretKey);

    const opayResponse = await fetch(
      `${opayApiUrl}/disbursement`,
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
      console.error("[withdraw-opay] OPay API error:", error);

      await supabase
        .from("paywave_transactions")
        .update({ status: "failed" })
        .eq("id", txData.id);

      return errorResponse(
        error.message || "OPay disbursement failed",
        400,
        "OPAY_DISBURSEMENT_FAILED",
        req,
      );
    }

    const opayData = await opayResponse.json();

    // 5. Deduct from user wallet
    await supabase
      .from("wallets")
      .update({
        paywave_balance: Number(walletData.paywave_balance) - amount,
      })
      .eq("user_id", userId);

    // 6. Update transaction with OPay reference
    await supabase
      .from("paywave_transactions")
      .update({
        status: "completed",
        provider_transaction_id: opayData.disbursement_id,
        completed_at: new Date().toISOString(),
        metadata: {
          ...txData.metadata,
          opay_disbursement_id: opayData.disbursement_id,
          completed_at: new Date().toISOString(),
        },
      })
      .eq("id", txData.id);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: txData.id,
        reference: transactionRef,
        provider_transaction_id: opayData.disbursement_id,
        status: "completed",
        message: "Withdrawal successful",
        amount,
        recipient: bankAccount || opayPhone,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[withdraw-opay] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      "INTERNAL_ERROR",
      req,
    );
  }
});

// Verify bank account name via OPay Account Name Inquiry API
async function verifyBankAccountName(
  accountNumber: string,
  bankCode: string,
  apiKey: string,
  secretKey: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const payload = {
      account_number: accountNumber,
      bank_code: bankCode,
    };

    const signature = await generateOPaySignature(payload, secretKey);
    const apiUrl = Deno.env.get("OPAY_API_URL") || "https://api.opayweb.com/api/v3";

    const response = await fetch(
      `${apiUrl}/account-name-inquiry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Signature": signature,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      return { valid: false, error: "Account verification failed" };
    }

    const data = await response.json();
    return { valid: data.valid || false, name: data.account_name };
  } catch (error) {
    console.error("Account verification error:", error);
    return { valid: false, error: "Verification service error" };
  }
}

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
