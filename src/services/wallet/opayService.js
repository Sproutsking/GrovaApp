// src/services/wallet/opayService.js
// OPay Business integration: Direct API calls (no local RPC stubs)
import { supabase } from "../config/supabase";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

function cleanPhone(v) {
  if (!v) return null;
  const s = String(v).replace(/\D/g, "");
  return s;
}

export async function withdrawToBank({
  userId,
  amount,
  bankAccount,
  bankCode,
  accountName,
  withdrawalPin,
}) {
  const acc = String(bankAccount || "").replace(/\D/g, "");
  const amt = cleanNumber(amount);

  if (!userId || !amt || !acc || !bankCode || !withdrawalPin) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/withdraw-opay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: amt,
        bankAccount: acc,
        bankCode,
        accountName,
        withdrawalPin,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Withdrawal failed");

    return {
      success: true,
      transaction_id: data.transaction_id,
      reference: data.reference,
      status: data.status,
      message: data.message,
    };
  } catch (e) {
    console.error("[opayService] Withdrawal error:", e);
    return { success: false, error: e?.message || "Withdrawal failed" };
  }
}

function cleanNumber(v) {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const DEFAULT_RESP = { success: false, error: "Service unavailable" };

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSITS (Request-to-Pay)
// ─────────────────────────────────────────────────────────────────────────────

export async function depositViaOPayWallet({ userId, opayPhone, ngnAmount }) {
  const phone = cleanPhone(opayPhone);
  const amount = cleanNumber(ngnAmount);

  if (!userId || !phone || !amount) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/deposit-opay-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        opayPhone: phone,
        ngnAmount: amount,
        currency: "NGN",
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Deposit initiation failed");

    return {
      success: true,
      transaction_id: data.transaction_id,
      reference: data.reference,
      status: data.status,
      message: data.message,
    };
  } catch (e) {
    console.error("[opayService] Deposit error:", e);
    return { success: false, error: e?.message || "Deposit failed" };
  }
}

export async function withdrawToOPayWallet({ userId, opayPhone, amount, withdrawalPin }) {
  const phone = cleanPhone(opayPhone);
  const amt = cleanNumber(amount);

  if (!userId || !phone || !amt || !withdrawalPin) {
    return { success: false, error: "Invalid parameters" };
  }

  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return { success: false, error: "Not authenticated" };

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/withdraw-opay`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          opayPhone: phone,
          withdrawalPin,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Withdrawal failed");

    return {
      success: true,
      transaction_id: data.transaction_id,
      reference: data.reference,
      status: data.status,
      message: data.message,
    };
  } catch (e) {
    console.error("[opayService] OPay withdrawal error:", e);
    return { success: false, error: e?.message || "Withdrawal failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BILL PAYMENTS (Airtime, Data, Electricity, Cable)
// ─────────────────────────────────────────────────────────────────────────────

export async function buyAirtime({ userId, network, phone, amount }) {
  const p = cleanPhone(phone);
  const a = cleanNumber(amount);
  if (!p || !network || !a)
    return { success: false, error: "Invalid parameters" };

  try {
    // Always call the RPC first to perform the purchase.
    const { data, error } = await supabase.rpc("opay_buy_airtime", {
      p_user_id: userId,
      p_network: network,
      p_phone: p,
      p_amount: a,
    });

    if (error) throw new Error(error.message || "RPC error");

    // Try persisting a transaction record if the DB API is available.
    try {
      if (supabase && typeof supabase.from === "function") {
        const maybeTx = supabase.from("paywave_transactions");
        if (maybeTx && typeof maybeTx.insert === "function") {
          const { data: txData, error: txError } = await maybeTx
            .insert({
              user_id: userId,
              transaction_type: "airtime",
              amount: a,
              fee_amount: 0,
              net_amount: a,
              status: "completed",
              provider: network.toUpperCase(),
              recipient_phone: p,
              reference_id: `airtime_${Date.now()}`,
              metadata: { network, phone: p },
            })
            .select()
            .single();

          if (!txError && txData) {
            return { success: true, transaction_id: txData.id, ...data };
          }
        }
      }
    } catch (e) {
      // ignore persistence errors
    }

    return { success: true, transaction_id: data?.transaction_id || null, ...data };
  } catch (e) {
    console.error("[opayService] Airtime error:", e);
    return { success: false, error: e?.message || "Airtime purchase failed" };
  }
}

export async function buyData({ userId, network, phone, planId, amount }) {
  const p = cleanPhone(phone);
  const a = cleanNumber(amount);
  if (!p || !network || !a)
    return { success: false, error: "Invalid parameters" };

  try {
    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .insert({
        user_id: userId,
        transaction_type: "data",
        amount: a,
        fee_amount: 0,
        net_amount: a,
        status: "pending",
        provider: network.toUpperCase(),
        recipient_phone: p,
        reference_id: `data_${Date.now()}`,
        metadata: { network, phone: p, plan_id: planId },
      })
      .select()
      .single();

    if (txError || !txData) throw new Error("Transaction record failed");

    const { data, error } = await supabase.rpc("opay_buy_data", {
      p_user_id: userId,
      p_network: network,
      p_phone: p,
      p_plan_id: planId || null,
      p_amount: a,
    });

    if (error) throw new Error(error.message);

    await supabase
      .from("paywave_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", txData.id);

    return { success: true, transaction_id: txData.id, ...data };
  } catch (e) {
    console.error("[opayService] Data error:", e);
    return { success: false, error: e?.message || "Data purchase failed" };
  }
}

export async function buyElectricity({
  userId,
  provider,
  meterNumber,
  meterType = "prepaid",
  amount,
  customerName = null,
}) {
  const m = String(meterNumber).replace(/\D/g, "");
  const a = cleanNumber(amount);
  if (!m || !provider || !a)
    return { success: false, error: "Invalid parameters" };

  try {
    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .insert({
        user_id: userId,
        transaction_type: "electricity",
        amount: a,
        fee_amount: 0,
        net_amount: a,
        status: "pending",
        provider: provider.toUpperCase(),
        recipient_account: m,
        recipient_name: customerName,
        reference_id: `electricity_${Date.now()}`,
        metadata: { provider, meter_number: m, meter_type: meterType },
      })
      .select()
      .single();

    if (txError || !txData) throw new Error("Transaction record failed");

    const { data, error } = await supabase.rpc("opay_buy_electricity", {
      p_user_id: userId,
      p_provider: provider,
      p_meter_number: m,
      p_meter_type: meterType,
      p_amount: a,
      p_customer_name: customerName,
    });

    if (error) throw new Error(error.message);

    await supabase
      .from("paywave_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", txData.id);

    return { success: true, transaction_id: txData.id, ...data };
  } catch (e) {
    console.error("[opayService] Electricity error:", e);
    return { success: false, error: e?.message || "Electricity bill failed" };
  }
}

export async function buyCable({
  userId,
  provider,
  smartCard,
  packageId,
  amount,
}) {
  const s = String(smartCard).replace(/\D/g, "");
  const a = cleanNumber(amount);
  if (!s || !provider || !a)
    return { success: false, error: "Invalid parameters" };

  try {
    const { data: txData, error: txError } = await supabase
      .from("paywave_transactions")
      .insert({
        user_id: userId,
        transaction_type: "cable",
        amount: a,
        fee_amount: 0,
        net_amount: a,
        status: "pending",
        provider: provider.toUpperCase(),
        recipient_account: s,
        reference_id: `cable_${Date.now()}`,
        metadata: { provider, smart_card: s, package_id: packageId },
      })
      .select()
      .single();

    if (txError || !txData) throw new Error("Transaction record failed");

    const { data, error } = await supabase.rpc("opay_buy_cable", {
      p_user_id: userId,
      p_provider: provider,
      p_smart_card: s,
      p_package_id: packageId || null,
      p_amount: a,
    });

    if (error) throw new Error(error.message);

    await supabase
      .from("paywave_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", txData.id);

    return { success: true, transaction_id: txData.id, ...data };
  } catch (e) {
    console.error("[opayService] Cable error:", e);
    return { success: false, error: e?.message || "Cable subscription failed" };
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
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, transactions: data || [] };
  } catch (e) {
    console.error("[opayService] History fetch error:", e);
    return { success: false, error: e?.message || "Failed to fetch history" };
  }
}

export async function getTransactionStatus(transactionId) {
  try {
    const { data, error } = await supabase
      .from("paywave_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (error) throw error;
    return { success: true, transaction: data };
  } catch (e) {
    console.error("[opayService] Status fetch error:", e);
    return { success: false, error: e?.message || "Failed to fetch status" };
  }
}

// Export all functions
export const opayService = {
  depositViaOPayWallet,
  withdrawToBank,
  withdrawToOPayWallet,
  buyAirtime,
  buyData,
  buyElectricity,
  buyCable,
  getTransactionHistory,
  getTransactionStatus,
};

export default opayService;

