// src/services/wallet/paymentService.js
// ============================================================================
// PAYMENT SERVICE — Paystack + Web3 only. CRA: process.env.REACT_APP_ prefix.
// Sensitive logic runs server-side in Edge Functions. This file handles:
// product fetching, Edge Function calls, and idempotency key management.
// ============================================================================

import { supabase } from "../config/supabase";

// ── Idempotency key management ────────────────────────────────────────────────

export function getOrCreateIdempotencyKey(productId) {
  const storageKey = `xv_idem_${productId}`;
  const existing   = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const newKey = crypto.randomUUID();
  sessionStorage.setItem(storageKey, newKey);
  return newKey;
}

export function clearIdempotencyKey(productId) {
  sessionStorage.removeItem(`xv_idem_${productId}`);
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function fetchPaymentProducts() {
  const { data, error } = await supabase
    .from("payment_products")
    .select("id, name, description, type, tier, amount_usd, currency, interval, metadata")
    .eq("is_active", true)
    .order("amount_usd", { ascending: true });

  if (error) throw new Error("Failed to load products: " + error.message);
  return data ?? [];
}

// ── Paystack ──────────────────────────────────────────────────────────────────

export async function createPaystackTransaction({ productId, idempotencyKey }) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new Error("Not authenticated. Please sign in.");

  const { data, error } = await supabase.functions.invoke(
    "paystack-create-transaction",
    {
      body: {
        product_id:      productId,
        idempotency_key: idempotencyKey,
        callback_url:    `${window.location.origin}/pay/callback`,
      },
    }
  );

  if (error)       throw new Error(error.message ?? "Paystack initialization failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Web3 ──────────────────────────────────────────────────────────────────────

export async function verifyWeb3Payment({
  chainType,
  chain,
  txHash,
  productId,
  idempotencyKey,
  claimedSenderWallet,
  expectedTokenAddress = null,
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new Error("Not authenticated. Please sign in.");

  const { data, error } = await supabase.functions.invoke(
    "web3-verify-payment",
    {
      body: {
        chainType,
        chain,
        txHash,
        productId,
        idempotencyKey,
        claimedSenderWallet,
        expectedTokenAddress,
      },
    }
  );

  if (error)       throw new Error(error.message ?? "Verification request failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Invite code ───────────────────────────────────────────────────────────────

export async function applyInviteCode({ code, userId, products }) {
  const normalized = code.trim().toUpperCase();

  const { data: invite, error } = await supabase
    .from("invite_codes")
    .select("id, uses_count, max_uses, type, tier")
    .eq("code", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (error || !invite) throw new Error("Invalid or expired invite code.");
  if (invite.uses_count >= invite.max_uses) {
    throw new Error("This invite code has reached its usage limit.");
  }

  const { error: updateErr } = await supabase
    .from("invite_codes")
    .update({ uses_count: invite.uses_count + 1 })
    .eq("id", invite.id);

  if (updateErr) throw new Error("Failed to apply invite code. Please try again.");

  const tier             = invite.tier ?? "whitelist";
  const matchingProduct  = products.find((p) => p.tier === tier) ?? products[0];

  if (matchingProduct) {
    await supabase.from("payments").insert({
      user_id:             userId,
      product_id:          matchingProduct.id,
      provider:            "paystack",
      provider_payment_id: `invite_${normalized}_${Date.now()}`,
      amount_cents:        0,
      currency:            "USD",
      status:              "completed",
      idempotency_key:     crypto.randomUUID(),
      completed_at:        new Date().toISOString(),
      metadata:            { invite_code: normalized, type: invite.type, tier },
    });
  }

  const { error: activateErr } = await supabase
    .from("profiles")
    .update({
      account_activated: true,
      subscription_tier: tier,
      invite_code_used:  normalized,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", userId);

  if (activateErr) throw new Error("Account activation failed. Contact support.");
  return { success: true, tier };
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getUserPayments(userId) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, payment_products(name, tier)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("Failed to load payment history: " + error.message);
  return data ?? [];
}

export async function getUserSubscription(userId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, payment_products(name, tier, amount_usd)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (error) console.warn("[paymentService] Subscription fetch:", error.message);
  return data ?? null;
}