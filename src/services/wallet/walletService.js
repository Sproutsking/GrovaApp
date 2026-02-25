// src/services/wallet/walletService.js
// ════════════════════════════════════════════════════════════════
// Wallet Service — $XEV + EP dual currency system
// - XEV: transferable, on-chain capable, converts to NGN
// - EP: internal-only, minted on deposit/engagement, burned on tx
// ════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// EP burn schedule (NGN equivalent determines weight)
const EP_BURN_SCHEDULE = {
  send_tiny: 1, // < ₦250 value
  send_small: 2, // ₦250–₦999
  send_medium: 4, // ₦1000–₦4999
  send_large: 7, // ₦5000–₦24999
  send_huge: 10, // ₦25000+
  swap: 5, // any EP↔XEV swap
  deposit: 0, // no burn on deposit
  receive: 0, // no burn on receive
  conversion: 3, // any currency conversion
};

const XEV_TO_NGN = 2.5;
const EP_PER_NGN = 1; // 1 EP minted per ₦1 deposited

function computeEPBurn(action, xevAmount) {
  if (action === "swap") return EP_BURN_SCHEDULE.swap;
  if (action === "conversion") return EP_BURN_SCHEDULE.conversion;
  if (action === "deposit" || action === "receive") return 0;

  const ngnValue = (parseFloat(xevAmount) || 0) * XEV_TO_NGN;
  if (ngnValue < 250) return EP_BURN_SCHEDULE.send_tiny;
  if (ngnValue < 1000) return EP_BURN_SCHEDULE.send_small;
  if (ngnValue < 5000) return EP_BURN_SCHEDULE.send_medium;
  if (ngnValue < 25000) return EP_BURN_SCHEDULE.send_large;
  return EP_BURN_SCHEDULE.send_huge;
}

export const walletService = {
  // ── Get wallet ────────────────────────────────────────────────
  async getWallet(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Get or create wallet ──────────────────────────────────────
  async ensureWallet(userId) {
    let wallet = await this.getWallet(userId);
    if (!wallet) {
      const { data, error } = await supabase
        .from("wallets")
        .insert({ user_id: userId, xev_tokens: 0, engagement_points: 0 })
        .select()
        .single();
      if (error) throw error;
      wallet = data;
    }
    return wallet;
  },

  // ── Subscribe to real-time balance changes ────────────────────
  subscribeToBalance(userId, callback) {
    const channel = supabase
      .channel(`wallet:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            callback({
              tokens: payload.new.xev_tokens || 0,
              points: payload.new.engagement_points || 0,
            });
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // ── Get recent transactions ───────────────────────────────────
  async getRecentTransactions(userId, limit = 20) {
    const { data, error } = await supabase
      .from("wallet_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ── Send tokens (XEV or EP) ───────────────────────────────────
  async sendTokens({
    fromUserId,
    toIdentifier,
    amount,
    currency,
    note,
    epBurn,
  }) {
    // Resolve recipient
    let toUserId;
    if (toIdentifier.startsWith("0x")) {
      // On-chain address — resolve via profile wallet address
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("wallet_address", toIdentifier)
        .maybeSingle();
      toUserId = data?.id;
    } else {
      const username = toIdentifier.replace("@", "");
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      toUserId = data?.id;
    }

    if (!toUserId) return { success: false, error: "Recipient not found" };

    // Call the Supabase RPC for atomic transfer
    const { data, error } = await supabase.rpc("transfer_tokens", {
      p_from_user_id: fromUserId,
      p_to_user_id: toUserId,
      p_amount: parseFloat(amount),
      p_currency: currency, // 'XEV' or 'EP'
      p_ep_burn:
        epBurn || computeEPBurn("send", currency === "XEV" ? amount : 0),
      p_note: note || "",
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── Swap EP ↔ XEV ─────────────────────────────────────────────
  async swapTokens({ userId, direction, amount, epBurn = 5 }) {
    const { data, error } = await supabase.rpc("swap_tokens", {
      p_user_id: userId,
      p_direction: direction, // 'EP_TO_XEV' | 'XEV_TO_EP'
      p_amount: parseFloat(amount),
      p_ep_burn: epBurn,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── Verify deposit ────────────────────────────────────────────
  async verifyDeposit({ userId, txReference, method, amount, currency }) {
    const { data, error } = await supabase.rpc("verify_deposit", {
      p_user_id: userId,
      p_tx_reference: txReference,
      p_method: method, // 'crypto' | 'transfer' | 'atm'
      p_amount: parseFloat(amount),
      p_currency: currency,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── Credit EP from engagement (called by post/story/reel service) ──
  async creditEngagementEP(userId, epAmount, reason) {
    const { data, error } = await supabase.rpc("credit_ep", {
      p_user_id: userId,
      p_amount: epAmount,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // ── Burn EP ───────────────────────────────────────────────────
  async burnEP(userId, amount, reason) {
    const { data, error } = await supabase.rpc("burn_ep", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // ── PayWave internal send (NGN-denominated, uses EP backing) ──
  async payWaveSend({
    fromUserId,
    toIdentifier,
    ngnAmount,
    isOpay,
    opayPhone,
  }) {
    if (isOpay) {
      // Route through master external account
      const { data, error } = await supabase.rpc("paywave_external_send", {
        p_from_user_id: fromUserId,
        p_opay_phone: opayPhone,
        p_ngn_amount: parseFloat(ngnAmount),
        p_fee: 5,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }

    // Internal PayWave send — resolve username
    const username = toIdentifier.replace("@", "");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!profile) return { success: false, error: "User not found" };

    const { data, error } = await supabase.rpc("paywave_internal_send", {
      p_from_user_id: fromUserId,
      p_to_user_id: profile.id,
      p_ngn_amount: parseFloat(ngnAmount),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── Get PayWave balance (EP → NGN conversion) ─────────────────
  async getPayWaveBalance(userId) {
    const wallet = await this.getWallet(userId);
    return {
      ep: wallet?.engagement_points || 0,
      ngn: (wallet?.engagement_points || 0) * 1, // 1 EP = ₦1
    };
  },

  // ── Helper: EP burn amount for given action ───────────────────
  getEPBurn(action, xevAmount = 0) {
    return computeEPBurn(action, xevAmount);
  },
};
