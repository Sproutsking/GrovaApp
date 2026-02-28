// src/services/wallet/walletService.js
// ════════════════════════════════════════════════════════════════
// Xeevia Wallet Service — $XEV (grova_tokens) + EP dual currency
//
// FIXES:
//  1. Avatar URL built from supabase.supabaseUrl — no env var needed
//  2. getRecentTransactions() returns PERSPECTIVE-CORRECT rows:
//       • Sender  sees "Sent X to @username"     (change_type='debit')
//       • Receiver sees "Received X from @user"  (change_type='credit')
//       Both filter by user_id so each person only sees THEIR row.
//  3. Real-time subscription on wallet_history for instant updates
//  4. Avatar always loaded by fetching profile at query time
// ════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

const XEV_TO_NGN = 2.5;

// ── EP Burn ────────────────────────────────────────────────────
function computeEPBurn(currency, amount) {
  const a = parseFloat(amount) || 0;
  if (currency === "EP") {
    if (a < 100)  return 0.5;
    if (a < 500)  return 2;
    if (a < 2000) return 5;
    return 10;
  }
  const ngn = a * XEV_TO_NGN;
  if (ngn < 250)   return 1;
  if (ngn < 1000)  return 2;
  if (ngn < 5000)  return 4;
  if (ngn < 25000) return 7;
  return 10;
}

// ── Avatar URL — read base from the live supabase client ───────
function getAvatarUrl(avatarId) {
  if (!avatarId) return null;
  try {
    const base = supabase.supabaseUrl;
    if (!base) return null;
    return `${base}/storage/v1/object/public/avatars/${avatarId}`;
  } catch {
    return null;
  }
}

// ── Recipient cache ────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 60_000;

async function resolveRecipient(identifier) {
  if (!identifier) return { error: "Invalid recipient" };

  if (identifier.startsWith("0x")) {
    // On-chain wallet address — no DB lookup needed
    return { id: null, address: identifier, isOnChain: true };
  }

  const username = identifier.replace(/^@/, "").trim().toLowerCase();
  if (!username) return { error: "Invalid recipient" };

  const hit = _cache.get(username);
  if (hit && hit.expires > Date.now()) return hit.data;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,full_name,avatar_id,verified")
    .ilike("username", username)
    .eq("account_status", "active")
    .maybeSingle();

  if (error || !data) return { error: "Recipient not found. Check the username." };

  const result = {
    id:        data.id,
    username:  data.username,
    fullName:  data.full_name,
    avatarId:  data.avatar_id,
    avatarUrl: getAvatarUrl(data.avatar_id),
    verified:  data.verified,
  };
  _cache.set(username, { data: result, expires: Date.now() + CACHE_TTL });
  return result;
}

// ─────────────────────────────────────────────────────────────
export const walletService = {

  // ── Get wallet ───────────────────────────────────────────────
  async getWallet(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Ensure wallet ────────────────────────────────────────────
  async ensureWallet(userId) {
    let w = await this.getWallet(userId);
    if (!w) {
      const { data, error } = await supabase
        .from("wallets")
        .insert({ user_id: userId, grova_tokens: 0, engagement_points: 0, paywave_balance: 0 })
        .select().single();
      if (error) throw error;
      w = data;
    }
    return w;
  },

  // ── Real-time balance ────────────────────────────────────────
  subscribeToBalance(userId, callback) {
    const ch = supabase
      .channel(`wallet_balance:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new) callback({
            tokens:  payload.new.grova_tokens      ?? 0,
            points:  payload.new.engagement_points ?? 0,
            paywave: payload.new.paywave_balance   ?? 0,
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  },

  // ── Real-time transaction feed ───────────────────────────────
  // Subscribes to wallet_history INSERT events for this user.
  // Fires with an enriched transaction object including counterparty avatar.
  subscribeToTransactions(userId, onNewTx) {
    const ch = supabase
      .channel(`wallet_history_live:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_history", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new;
          if (!row) return;

          const counterparty = await this._enrichCounterparty(row);
          onNewTx(this._normaliseRow(row, counterparty));
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  },

  // ── Recent transactions ──────────────────────────────────────
  // wallet_history has ONE row per user per transaction.
  // We filter by user_id — each user sees only THEIR own row.
  // change_type='debit'  → Sender's row  → label "Sent"
  // change_type='credit' → Receiver's row → label "Received"
  async getRecentTransactions(userId, limit = 25) {
    const { data, error } = await supabase
      .from("wallet_history")
      .select("id,user_id,change_type,amount,balance_before,balance_after,reason,metadata,created_at,transaction_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Enrich each row with counterparty avatar in parallel
    const enriched = await Promise.all(
      data.map(async (row) => {
        const counterparty = await this._enrichCounterparty(row);
        return this._normaliseRow(row, counterparty);
      })
    );
    return enriched;
  },

  // ── Internal: enrich counterparty ───────────────────────────
  async _enrichCounterparty(row) {
    const cpUsername = row.metadata?.counterparty_username;
    if (!cpUsername) return null;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_id,verified")
        .ilike("username", cpUsername)
        .maybeSingle();

      if (!profile) return null;
      return {
        id:        profile.id,
        username:  profile.username,
        fullName:  profile.full_name,
        avatarId:  profile.avatar_id,
        avatarUrl: getAvatarUrl(profile.avatar_id),
        verified:  profile.verified,
      };
    } catch {
      return null;
    }
  },

  // ── Internal: normalise a wallet_history row ─────────────────
  _normaliseRow(row, counterparty) {
    const isSent   = row.change_type === "debit";
    const currency = row.metadata?.currency || "EP";
    return {
      ...row,
      displayLabel:    isSent ? "Sent" : "Received",
      displaySign:     isSent ? "-" : "+",
      displayColor:    isSent ? "#f87171" : "#a3e635",
      displayCurrency: currency,
      counterparty,
      note: row.metadata?.note || "",
    };
  },

  // ── Send tokens ──────────────────────────────────────────────
  async sendTokens({ fromUserId, toIdentifier, amount, currency, note, epBurn }) {
    const recipient = await resolveRecipient(toIdentifier);
    if (recipient.error) return { success: false, error: recipient.error };
    if (recipient.id === fromUserId) return { success: false, error: "You cannot send to yourself." };

    const burn = epBurn ?? computeEPBurn(currency, amount);

    const { data, error } = await supabase.rpc("transfer_tokens", {
      p_from_user_id: fromUserId,
      p_to_user_id:   recipient.id,
      p_amount:       parseFloat(amount),
      p_currency:     currency,
      p_ep_burn:      burn,
      p_note:         note || "",
    });

    if (error) return { success: false, error: error.message || "Transaction failed" };
    if (!data || data.success === false) return { success: false, error: data?.error || "Transaction rejected" };

    return {
      success:        true,
      transaction_id: data.transaction_id,
      currency:       data.currency,
      amount:         data.amount,
      ep_burned:      data.ep_burned,
      recipient,
    };
  },

  // ── Search users for send UI (with avatar) ───────────────────
  async searchUsers(query, currentUserId, limit = 7) {
    if (!query || query.length < 2) return [];
    const q = query.replace(/^@/, "").trim();
    const { data } = await supabase
      .from("profiles")
      .select("id,username,full_name,avatar_id,verified,account_status")
      .eq("account_status", "active")
      .ilike("username", `${q}%`)
      .neq("id", currentUserId)
      .limit(limit);

    if (!data) return [];
    return data.map(u => ({
      ...u,
      avatarUrl: getAvatarUrl(u.avatar_id),
    }));
  },

  // ── Swap ─────────────────────────────────────────────────────
  async swapTokens({ userId, direction, amount, epBurn = 5 }) {
    const { data, error } = await supabase.rpc("swap_tokens", {
      p_user_id: userId, p_direction: direction, p_amount: parseFloat(amount), p_ep_burn: epBurn,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── Verify deposit ───────────────────────────────────────────
  async verifyDeposit({ userId, txReference, method, amount, currency }) {
    const { data, error } = await supabase.rpc("verify_deposit", {
      p_user_id: userId, p_tx_reference: txReference, p_method: method,
      p_amount: parseFloat(amount), p_currency: currency,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── PayWave ──────────────────────────────────────────────────
  async payWaveSend({ fromUserId, toIdentifier, ngnAmount, isOpay, opayPhone }) {
    if (isOpay) {
      const { data, error } = await supabase.rpc("paywave_external_send", {
        p_from_user_id: fromUserId, p_opay_phone: opayPhone, p_ngn_amount: parseFloat(ngnAmount), p_fee: 5,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }
    const recipient = await resolveRecipient(toIdentifier);
    if (recipient.error) return { success: false, error: recipient.error };
    const { data, error } = await supabase.rpc("paywave_internal_send", {
      p_from_user_id: fromUserId, p_to_user_id: recipient.id, p_ngn_amount: parseFloat(ngnAmount),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async getPayWaveBalance(userId) {
    const wallet = await this.getWallet(userId);
    return { ep: wallet?.engagement_points ?? 0, ngn: (wallet?.engagement_points ?? 0) };
  },

  // ── Credit EP ────────────────────────────────────────────────
  async creditEngagementEP(userId, epAmount, reason) {
    const { data, error } = await supabase.rpc("credit_ep", {
      p_user_id: userId, p_amount: epAmount, p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  // ── Helpers ──────────────────────────────────────────────────
  getAvatarUrl,
  getEPBurn: computeEPBurn,
};