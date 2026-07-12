// src/services/wallet/flutterwaveService.js
// Flutterwave integration for Pan-Africa deposits (mobile money + cards)
import { supabase } from "../config/supabase";
import { getSupabaseProjectUrl } from "../supabase/projectConfig";

const SUPABASE_URL = getSupabaseProjectUrl("wallet");

function cleanNumber(v) {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSITS
// ─────────────────────────────────────────────────────────────────────────────

export async function depositViaFlutterwave({
  userId,
  amount,
  currency = "NGN",
  paymentMethod = "all", // all, card, mobile_money
  country = "NG",
}) {
  const amt = cleanNumber(amount);
  if (!userId || !amt) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/deposit-flutterwave-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          amount: amt,
          currency,
          paymentMethod,
          country,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Deposit initiation failed");

    return {
      success: true,
      transaction_id: data.transaction_id,
      reference: data.reference,
      checkout_url: data.checkout_url,
      status: data.status,
      message: data.message,
    };
  } catch (e) {
    console.error("[flutterwaveService] Deposit error:", e);
    return { success: false, error: e?.message || "Deposit failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION HISTORY & STATUS
// ─────────────────────────────────────────────────────────────────────────────

export async function getTransactionHistory(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from("paywave_transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "Flutterwave")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, transactions: data || [] };
  } catch (e) {
    console.error("[flutterwaveService] History fetch error:", e);
    return { success: false, error: e?.message || "Failed to fetch history" };
  }
}

export async function getTransactionStatus(transactionId) {
  try {
    const { data, error } = await supabase
      .from("paywave_transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("provider", "Flutterwave")
      .single();

    if (error) throw error;
    return { success: true, transaction: data };
  } catch (e) {
    console.error("[flutterwaveService] Status fetch error:", e);
    return { success: false, error: e?.message || "Failed to fetch status" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

// Called when Flutterwave sends webhook about completed payment
export async function handleFlutterwaveWebhook(webhookData) {
  try {
    const { reference, status, amount, currency } = webhookData;

    if (status !== "successful") {
      console.warn("[flutterwaveService] Payment not successful:", webhookData);
      return { success: false, error: "Payment unsuccessful" };
    }

    // Find transaction by reference
    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .select("*")
      .eq("reference_id", reference)
      .eq("provider", "Flutterwave")
      .single();

    if (txError || !txData) {
      return { success: false, error: "Transaction not found" };
    }

    // Update transaction status
    const { error: updateError } = await supabase
      .from("paywave_transactions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...txData.metadata,
          webhook_received: new Date().toISOString(),
          flutterwave_status: status,
        },
      })
      .eq("id", txData.id);

    if (updateError) throw updateError;

    // Credit user wallet
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("paywave_balance")
      .eq("user_id", txData.user_id)
      .single();

    if (!walletError && walletData) {
      await supabase
        .from("wallets")
        .update({
          paywave_balance: Number(walletData.paywave_balance) + Number(txData.net_amount),
        })
        .eq("user_id", txData.user_id);
    }

    return {
      success: true,
      transaction_id: txData.id,
      message: "Payment processed successfully",
    };
  } catch (e) {
    console.error("[flutterwaveService] Webhook error:", e);
    return { success: false, error: e?.message || "Webhook processing failed" };
  }
}

// Export all functions
export const flutterwaveService = {
  depositViaFlutterwave,
  getTransactionHistory,
  getTransactionStatus,
  handleFlutterwaveWebhook,
};

export default flutterwaveService;
