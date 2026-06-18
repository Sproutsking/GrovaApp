// src/services/wallet/p2pService.js
// All P2P trade operations — frontend NEVER touches wallets directly.
// Every mutating action goes through Supabase Edge Functions.

import { supabase } from "../config/supabase";

// ── Invoke helper ────────────────────────────────────────────────────────────
async function invoke(fn, payload = {}) {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body: payload });
    if (error) throw new Error(error.message || "Request failed");
    if (!data) throw new Error("No response from function");
    if (data?.error) throw new Error(data.error || "Function error");
    return data;
  } catch (e) {
    // Surface function name to help debugging
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${fn} failed: ${msg}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFERS
// ═══════════════════════════════════════════════════════════════════════════════

export const p2pService = {

  // ── Create a sell offer ───────────────────────────────────────────────────
  async createOffer({ asset, totalAmount, pricePerUnit, currency, paymentMethodIds, minOrder, maxOrder, terms }) {
    return invoke("create-offer", {
      asset,
      total_amount:       totalAmount,
      price_per_unit:     pricePerUnit,
      currency,
      payment_method_ids: paymentMethodIds,
      min_order:          minOrder,
      max_order:          maxOrder,
      terms,
    });
  },

  // ── Pause / resume / cancel an offer ────────────────────────────────────
  async updateOfferStatus(offerId, status) {
    // Allowed: paused | active | cancelled (owner only via RLS)
    const { data, error } = await supabase
      .from("p2p_offers")
      .update({ status })
      .eq("id", offerId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // ── Fetch active offers (public browse) ─────────────────────────────────
  async getOffers({ asset, currency, minAmount, maxAmount, search } = {}) {
    let q = supabase
      .from("p2p_offers")
      .select(`
        *,
        seller:profiles!p2p_offers_seller_id_fkey(id, username, full_name, avatar_id, verified),
        reputation:p2p_reputation!inner(trust_score, completed_trades, total_trades, is_verified, avg_release_secs),
        payment_methods:p2p_payment_methods(id, type, label, bank_name)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (asset)     q = q.eq("asset", asset);
    if (currency)  q = q.eq("currency", currency);
    if (minAmount) q = q.gte("available_amount", minAmount);
    if (maxAmount) q = q.lte("price_per_unit", maxAmount);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // ── Fetch MY offers ──────────────────────────────────────────────────────
  async getMyOffers(userId) {
    const { data, error } = await supabase
      .from("p2p_offers")
      .select("*")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  async getMyPaymentMethods(userId) {
    const { data, error } = await supabase
      .from("p2p_payment_methods")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async addPaymentMethod(method) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("p2p_payment_methods")
      .insert({ ...method, user_id: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deletePaymentMethod(id) {
    const { error } = await supabase
      .from("p2p_payment_methods")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRADES
  // ═══════════════════════════════════════════════════════════════════════════

  // Buyer accepts an offer — creates trade + locks escrow
  async acceptOffer({ offerId, amount, paymentMethodId }) {
    const key = `${offerId}-${amount}-${Date.now()}`;
    return invoke("accept-offer", {
      offer_id:          offerId,
      amount,
      payment_method_id: paymentMethodId,
      idempotency_key:   key,
    });
  },

  // Buyer marks payment as sent
  async markPaid(tradeId) {
    return invoke("trade-actions", { action: "mark_paid", trade_id: tradeId });
  },

  // Seller confirms receipt + releases escrow
  async confirmPayment(tradeId) {
    return invoke("trade-actions", { action: "confirm_payment", trade_id: tradeId });
  },

  // Cancel trade (either party)
  async cancelTrade(tradeId, reason) {
    return invoke("trade-actions", { action: "cancel_trade", trade_id: tradeId, reason });
  },

  // Open dispute
  async openDispute(tradeId, reason, evidenceUrls = []) {
    return invoke("trade-actions", {
      action:        "open_dispute",
      trade_id:      tradeId,
      reason,
      evidence_urls: evidenceUrls,
    });
  },

  // Fetch user's trades
  async getMyTrades(userId) {
    const { data, error } = await supabase
      .from("p2p_trades")
      .select(`
        *,
        offer:p2p_offers(asset, payment_method_ids),
        buyer:profiles!p2p_trades_buyer_id_fkey(id, username, full_name, avatar_id),
        seller:profiles!p2p_trades_seller_id_fkey(id, username, full_name, avatar_id),
        escrow:p2p_escrow(status, amount)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  // Fetch single trade with full context
  async getTrade(tradeId) {
    const { data, error } = await supabase
      .from("p2p_trades")
      .select(`
        *,
        buyer:profiles!p2p_trades_buyer_id_fkey(id, username, full_name, avatar_id, verified),
        seller:profiles!p2p_trades_seller_id_fkey(id, username, full_name, avatar_id, verified),
        buyer_rep:p2p_reputation!fk_buyer(trust_score, completed_trades, total_trades),
        seller_rep:p2p_reputation!fk_seller(trust_score, completed_trades, total_trades),
        escrow:p2p_escrow(status, amount, asset)
      `)
      .eq("id", tradeId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT
  // ═══════════════════════════════════════════════════════════════════════════

  async getMessages(tradeId) {
    const { data, error } = await supabase
      .from("p2p_trade_messages")
      .select(`*, sender:profiles!p2p_trade_messages_sender_id_fkey(id, username, full_name, avatar_id)`)
      .eq("trade_id", tradeId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async sendMessage(tradeId, senderId, message, msgType = "text", fileUrl = null, fileName = null) {
    const { data, error } = await supabase
      .from("p2p_trade_messages")
      .insert({
        trade_id:  tradeId,
        sender_id: senderId,
        message,
        msg_type:  msgType,
        file_url:  fileUrl,
        file_name: fileName,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async markMessagesRead(tradeId, userId) {
    await supabase
      .from("p2p_trade_messages")
      .update({ is_read: true })
      .eq("trade_id", tradeId)
      .neq("sender_id", userId);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  subscribeTrade(tradeId, onUpdate) {
    const channel = supabase
      .channel(`p2p_trade:${tradeId}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "p2p_trades",
        filter: `id=eq.${tradeId}`,
      }, (payload) => onUpdate("trade", payload.new))
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "p2p_trade_messages",
        filter: `trade_id=eq.${tradeId}`,
      }, (payload) => onUpdate("message", payload.new))
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "p2p_escrow",
        filter: `trade_id=eq.${tradeId}`,
      }, (payload) => onUpdate("escrow", payload.new))
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  subscribeNotifications(userId, onNotification) {
    const channel = supabase
      .channel(`p2p_notif:${userId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "p2p_notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => onNotification(payload.new))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async getNotifications(userId) {
    const { data, error } = await supabase
      .from("p2p_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async markNotificationRead(id) {
    await supabase.from("p2p_notifications").update({ is_read: true }).eq("id", id);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPUTATION
  // ═══════════════════════════════════════════════════════════════════════════

  async getReputation(userId) {
    const { data, error } = await supabase
      .from("p2p_reputation")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPLOAD DISPUTE EVIDENCE (via Cloudinary / Supabase Storage)
  // ═══════════════════════════════════════════════════════════════════════════

  async uploadEvidence(file) {
    const ext  = file.name.split(".").pop();
    const path = `p2p/evidence/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("p2p-evidence")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(error.message);
    const { data: { publicUrl } } = supabase.storage.from("p2p-evidence").getPublicUrl(path);
    return publicUrl;
  },
};

export default p2pService;