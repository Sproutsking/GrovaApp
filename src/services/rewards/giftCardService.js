// src/services/rewards/giftCardService.js
// ============================================================================
// Complete Gift Card Service — Supabase integrated
// Handles: buy, send, redeem, inbox, my cards
// 2% protocol fee on all transactions
// $1 = 100 EP | Fee = 2% of card EP value
// ============================================================================

import { supabase } from '../config/supabase';

const FEE_RATE = 0.02;

// Tier config — single source of truth, matches GiftCardsView UI
export const GIFT_CARD_TIERS = {
  silver:        { name: "Silver",        value_ep: 100,   price_usd: 1,   badge: "Starter"   },
  gold:          { name: "Gold",          value_ep: 500,   price_usd: 5,   badge: "Popular"   },
  blue_diamond:  { name: "Blue Diamond",  value_ep: 1500,  price_usd: 15,  badge: "Best Value" },
  red_diamond:   { name: "Red Diamond",   value_ep: 3000,  price_usd: 28,  badge: "Fierce"    },
  black_diamond: { name: "Black Diamond", value_ep: 6000,  price_usd: 55,  badge: "Rare"      },
  purple_diamond:{ name: "Purple Diamond",value_ep: 12000, price_usd: 100, badge: "Legendary" },
};

// Generate a unique gift card code
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `GC-${seg()}-${seg()}-XEEVIA`;
}

// ── Buy & Send ────────────────────────────────────────────────────────────────
/**
 * Purchase and send a gift card.
 * @param {object} params
 * @param {string} params.senderId        - Auth user ID sending the card
 * @param {string} params.recipientId     - Profile ID of recipient
 * @param {string} params.tier            - e.g. "gold"
 * @param {string} [params.occasion]      - e.g. "Birthday 🎂"
 * @param {string} [params.message]       - Personal message
 * @param {string} [params.paymentId]     - Optional payment record ID
 * @returns {{ code, tier, value_ep, net_ep, fee_ep }}
 */
export async function buyAndSendGiftCard({ senderId, recipientId, tier, occasion = "", message = "", paymentId = null }) {
  if (!senderId) throw new Error("Sender ID required");
  if (!recipientId) throw new Error("Recipient ID required");
  if (!GIFT_CARD_TIERS[tier]) throw new Error(`Invalid tier: ${tier}`);

  const config   = GIFT_CARD_TIERS[tier];
  const value_ep = config.value_ep;
  const fee_ep   = Math.round(value_ep * FEE_RATE);
  const net_ep   = value_ep - fee_ep;
  const code     = generateCode();

  const { data, error } = await supabase
    .from("gift_cards")
    .insert({
      code,
      tier,
      value_ep,
      price_usd:    config.price_usd,
      fee_ep,
      net_ep,
      sender_id:    senderId,
      recipient_id: recipientId,
      occasion:     occasion || null,
      message:      message  || null,
      status:       "sent",
    })
    .select("id, code, tier, value_ep, net_ep, fee_ep")
    .single();

  if (error) throw new Error(`Failed to create gift card: ${error.message}`);

  // Send notification to recipient
  await supabase.from("notifications").insert({
    recipient_user_id: recipientId,
    actor_user_id:     senderId,
    type:              "payment_confirmed",
    message:           `You received a ${config.name} gift card! 🎁`,
    metadata:          { gift_card_id: data.id, gift_card_code: code, tier, value_ep, net_ep },
  }).catch(() => {}); // non-fatal

  return data;
}

// ── Redeem ────────────────────────────────────────────────────────────────────
/**
 * Redeem a gift card code. Credits net_ep to user's balance.
 * @param {object} params
 * @param {string} params.userId - The redeeming user's ID
 * @param {string} params.code   - The gift card code (e.g. "GC-XXXX-XXXX-XEEVIA")
 * @returns {{ net_ep, tier, occasion, message }}
 */
export async function redeemGiftCard({ userId, code }) {
  if (!userId) throw new Error("User ID required");
  if (!code?.trim()) throw new Error("Gift card code required");

  const cleanCode = code.trim().toUpperCase();

  // Fetch the gift card
  const { data: card, error: fetchErr } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("code", cleanCode)
    .maybeSingle();

  if (fetchErr) throw new Error(`Failed to fetch gift card: ${fetchErr.message}`);
  if (!card) throw new Error("Invalid gift card code. Please check and try again.");

  // Validate
  if (card.status === "redeemed") throw new Error("This gift card has already been redeemed.");
  if (card.status === "expired")  throw new Error("This gift card has expired.");
  if (card.status === "unused" && card.sender_id === userId) throw new Error("You cannot redeem your own unsent gift card.");
  if (card.recipient_id && card.recipient_id !== userId) throw new Error("This gift card was sent to someone else.");
  if (card.expires_at && new Date(card.expires_at) < new Date()) throw new Error("This gift card has expired.");

  const net_ep = card.net_ep;

  // Mark as redeemed
  const { error: updateErr } = await supabase
    .from("gift_cards")
    .update({ status: "redeemed", redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("id", card.id)
    .eq("status", card.status); // optimistic lock

  if (updateErr) throw new Error(`Redemption failed: ${updateErr.message}`);

  // Credit EP to user
  const { error: epErr } = await supabase.rpc("increment_engagement_points", {
    p_user_id:    userId,
    p_amount:     net_ep,
    p_reason:     `Gift card redeemed: ${GIFT_CARD_TIERS[card.tier]?.name ?? card.tier} — ${net_ep} EP (after 2% fee)`,
    p_payment_id: null,
    p_product_id: null,
  });

  if (epErr) {
    // Fallback: direct profile update
    const { data: profile } = await supabase
      .from("profiles")
      .select("engagement_points")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ engagement_points: (Number(profile.engagement_points) || 0) + net_ep })
        .eq("id", userId);
    }
    console.warn("[giftCardService] RPC failed, used direct update:", epErr.message);
  }

  // Notify sender their card was redeemed
  if (card.sender_id && card.sender_id !== userId) {
    const config = GIFT_CARD_TIERS[card.tier];
    await supabase.from("notifications").insert({
      recipient_user_id: card.sender_id,
      actor_user_id:     userId,
      type:              "payment_confirmed",
      message:           `Your ${config?.name ?? card.tier} gift card was redeemed! 🎉`,
      metadata:          { gift_card_id: card.id, tier: card.tier, net_ep },
    }).catch(() => {});
  }

  return {
    net_ep,
    tier:     card.tier,
    occasion: card.occasion,
    message:  card.message,
    tier_name: GIFT_CARD_TIERS[card.tier]?.name ?? card.tier,
  };
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
/**
 * Get all gift cards received by a user.
 * @param {string} userId
 * @returns {Array}
 */
export async function getGiftCardInbox(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("gift_cards")
    .select(`
      id, code, tier, value_ep, net_ep, fee_ep,
      occasion, message, status, created_at, redeemed_at,
      sender:sender_id ( id, full_name, username, avatar_id )
    `)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch inbox: ${error.message}`);
  return data ?? [];
}

// ── My Cards ──────────────────────────────────────────────────────────────────
/**
 * Get all gift cards purchased/sent by a user.
 * @param {string} userId
 * @returns {Array}
 */
export async function getMyGiftCards(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("gift_cards")
    .select(`
      id, code, tier, value_ep, net_ep, fee_ep,
      occasion, message, status, created_at, redeemed_at,
      recipient:recipient_id ( id, full_name, username, avatar_id )
    `)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch my cards: ${error.message}`);
  return data ?? [];
}

// ── Realtime subscription ─────────────────────────────────────────────────────
/**
 * Subscribe to incoming gift cards for a user.
 * @param {string}   userId
 * @param {Function} onNew - callback(card)
 * @returns Supabase channel (call .unsubscribe() to clean up)
 */
export function subscribeToIncomingGiftCards(userId, onNew) {
  return supabase
    .channel(`gift-cards-inbox-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "gift_cards", filter: `recipient_id=eq.${userId}` },
      (payload) => { if (payload.new) onNew(payload.new); }
    )
    .subscribe();
}

export default {
  GIFT_CARD_TIERS,
  buyAndSendGiftCard,
  redeemGiftCard,
  getGiftCardInbox,
  getMyGiftCards,
  subscribeToIncomingGiftCards,
};