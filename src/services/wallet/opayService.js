// src/services/wallet/opayService.js
// Simple OPay RPC client wrappers for airtime/data/electricity/cable
import { supabase } from "../config/supabase";

// Minimal validation helpers
function cleanPhone(v) {
  if (!v) return null;
  const s = String(v).replace(/\D/g, "");
  return s;
}

function cleanNumber(v) {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const DEFAULT_RESP = { success: false, error: "Service unavailable" };

export const opayService = {
  async buyAirtime({ userId, network, phone, amount }) {
    const p = cleanPhone(phone);
    const a = cleanNumber(amount);
    if (!p || !network || !a) return { success: false, error: "Invalid parameters" };
    try {
      const { data, error } = await supabase.rpc("opay_buy_airtime", {
        p_user_id: userId,
        p_network: network,
        p_phone: p,
        p_amount: a,
      });
      if (error) return { success: false, error: error.message };
      return data || DEFAULT_RESP;
    } catch (e) {
      return { success: false, error: e?.message || "Unknown error" };
    }
  },

  async buyData({ userId, network, phone, planId, amount }) {
    const p = cleanPhone(phone);
    const a = cleanNumber(amount);
    if (!p || !network || !a) return { success: false, error: "Invalid parameters" };
    try {
      const { data, error } = await supabase.rpc("opay_buy_data", {
        p_user_id: userId,
        p_network: network,
        p_phone: p,
        p_plan_id: planId || null,
        p_amount: a,
      });
      if (error) return { success: false, error: error.message };
      return data || DEFAULT_RESP;
    } catch (e) {
      return { success: false, error: e?.message || "Unknown error" };
    }
  },

  async buyElectricity({ userId, provider, meterNumber, meterType = "prepaid", amount, customerName = null }) {
    const m = String(meterNumber).replace(/\D/g, "");
    const a = cleanNumber(amount);
    if (!m || !provider || !a) return { success: false, error: "Invalid parameters" };
    try {
      const { data, error } = await supabase.rpc("opay_buy_electricity", {
        p_user_id: userId,
        p_provider: provider,
        p_meter_number: m,
        p_meter_type: meterType,
        p_amount: a,
        p_customer_name: customerName,
      });
      if (error) return { success: false, error: error.message };
      return data || DEFAULT_RESP;
    } catch (e) {
      return { success: false, error: e?.message || "Unknown error" };
    }
  },

  async buyCable({ userId, provider, smartCard, packageId, amount }) {
    const s = String(smartCard).replace(/\D/g, "");
    const a = cleanNumber(amount);
    if (!s || !provider || !a) return { success: false, error: "Invalid parameters" };
    try {
      const { data, error } = await supabase.rpc("opay_buy_cable", {
        p_user_id: userId,
        p_provider: provider,
        p_smart_card: s,
        p_package_id: packageId || null,
        p_amount: a,
      });
      if (error) return { success: false, error: error.message };
      return data || DEFAULT_RESP;
    } catch (e) {
      return { success: false, error: e?.message || "Unknown error" };
    }
  },
};
