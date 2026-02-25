// ============================================================================
// src/services/auth/paymentService.js — v17 BULLETPROOF AUTH
// ============================================================================
//
// KEY FIX vs v16:
//   getAuthHeaders() now logs exactly what's happening at each step.
//   Correctly handles dead refresh tokens by falling through to getUser()
//   which uses Supabase's internal in-memory token (autoRefreshToken).
//
//   The 4-step chain:
//     1. getSession() — use if access_token fresh (>5min to expiry)
//     2. refreshSession() — if expiring; errors are caught, don't throw
//     3. getUser() → retry getSession() — uses Supabase internal memory token
//     4. Throw — clear message to sign in again
//
// ============================================================================

import { supabase } from "../config/supabase";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;

  // Step 1: Try existing session
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) console.warn("[getAuthHeaders] getSession error:", sessionError.message);

    const session = sessionData?.session ?? null;
    if (session?.access_token) {
      const msLeft = ((session.expires_at ?? 0) * 1000) - Date.now();
      if (msLeft > 5 * 60 * 1000) {
        console.log("[getAuthHeaders] ✅ Fresh session, expires in", Math.round(msLeft / 60000), "min");
        return { Authorization: `Bearer ${session.access_token}`, apikey: anon, "Content-Type": "application/json" };
      }
      console.log("[getAuthHeaders] Token expiring in", Math.round(msLeft / 60000), "min — refreshing");
    } else {
      console.log("[getAuthHeaders] No session — trying refresh");
    }
  } catch (e) {
    console.warn("[getAuthHeaders] getSession threw:", e.message);
  }

  // Step 2: Refresh the session
  try {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("[getAuthHeaders] refreshSession failed:", refreshError.message);
      // Don't throw — fall through to Step 3
    } else if (refreshData?.session?.access_token) {
      console.log("[getAuthHeaders] ✅ Refreshed session successfully");
      return { Authorization: `Bearer ${refreshData.session.access_token}`, apikey: anon, "Content-Type": "application/json" };
    }
  } catch (e) {
    console.warn("[getAuthHeaders] refreshSession threw:", e.message);
  }

  // Step 3: getUser() uses Supabase's internal in-memory token
  // Works even when stored refresh token is dead/revoked
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.warn("[getAuthHeaders] getUser failed:", userError.message);
    } else if (userData?.user) {
      const { data: retryData } = await supabase.auth.getSession();
      if (retryData?.session?.access_token) {
        console.log("[getAuthHeaders] ✅ Got session after getUser retry");
        return { Authorization: `Bearer ${retryData.session.access_token}`, apikey: anon, "Content-Type": "application/json" };
      }
    }
  } catch (e) {
    console.warn("[getAuthHeaders] getUser threw:", e.message);
  }

  // Step 4: All attempts failed
  console.error("[getAuthHeaders] ❌ All auth attempts failed — session is dead");
  throw new Error("Your session has expired. Please sign out and sign in again.");
}

// ─── Edge function caller ─────────────────────────────────────────────────────

async function callEdgeFunction(functionName, body) {
  let headers;
  try {
    headers = await getAuthHeaders();
  } catch (authErr) {
    throw new Error(`Authentication failed: ${authErr.message}`);
  }

  const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/${functionName}`;

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (networkErr) {
    throw new Error(`Network error calling ${functionName}: ${networkErr.message}`);
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    const msg = data?.error ?? data?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

export function getOrCreateIdempotencyKey(productId) {
  const k = `xv_idem_${productId}`;
  const e = sessionStorage.getItem(k);
  if (e) return e;
  const n = crypto.randomUUID();
  sessionStorage.setItem(k, n);
  return n;
}

export function clearIdempotencyKey(productId) {
  sessionStorage.removeItem(`xv_idem_${productId}`);
}

// ─── Products — ADMIN CONTROLLED ─────────────────────────────────────────────

export async function fetchPaymentProducts() {
  const { data, error } = await supabase
    .from("payment_products")
    .select("id, name, description, type, tier, amount_usd, currency, interval, is_active, metadata")
    .eq("is_active", true)
    .order("amount_usd", { ascending: true });
  if (error) throw new Error("Failed to load products: " + error.message);
  return data ?? [];
}

// ─── Invite code details ──────────────────────────────────────────────────────

export async function fetchInviteCodeDetails(code) {
  if (!code?.trim()) return null;
  const normalized = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, code, type, tier, status, expires_at, max_uses, uses_count, entry_price, price_override, metadata")
    .eq("code", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  const meta = data.metadata || {};
  return {
    id: data.id,
    code: data.code,
    type: data.type,
    tier: meta.target_tier ?? data.tier ?? "standard",
    entry_price: data.entry_price ?? 4,
    price_override: data.price_override ?? null,
    enable_waitlist: meta.enable_waitlist ?? false,
    is_full: (data.uses_count || 0) >= (data.max_uses || Infinity),
    waitlist_count: meta.waitlist_count || 0,
  };
}

// ─── Paystack ─────────────────────────────────────────────────────────────────

export async function createPaystackTransaction({ productId, idempotencyKey, amountOverrideCents }) {
  const body = {
    product_id: productId,
    idempotency_key: idempotencyKey,
    callback_url: `${window.location.origin}/`,
  };
  if (amountOverrideCents != null && !isNaN(amountOverrideCents)) {
    body.amount_override_cents = Math.round(amountOverrideCents);
  }
  return callEdgeFunction("paystack-create-transaction", body);
}

// ─── Web3 ─────────────────────────────────────────────────────────────────────

export async function verifyWeb3Payment({ chainType, chain, txHash, productId, idempotencyKey, claimedSenderWallet, expectedTokenAddress = null }) {
  return callEdgeFunction("web3-verify-payment", {
    chainType, chain, txHash, productId,
    idempotency_key: idempotencyKey,
    claimedSenderWallet, expectedTokenAddress,
  });
}

// ─── Invite code apply ────────────────────────────────────────────────────────

export async function applyInviteCode({ code, userId, products }) {
  const normalized = code.trim().toUpperCase();

  const { data: invite, error } = await supabase
    .from("invite_codes")
    .select("id, uses_count, max_uses, type, tier, expires_at, status, entry_price, price_override, metadata")
    .eq("code", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (error || !invite) throw new Error("Invalid or expired invite code.");
  if (invite.expires_at && new Date(invite.expires_at) < new Date())
    throw new Error("This invite code has expired.");

  const isFull = (invite.uses_count || 0) >= (invite.max_uses || Infinity);
  const meta = invite.metadata || {};
  const hasWaitlist = meta.enable_waitlist === true;

  if (isFull && hasWaitlist) {
    await supabase.from("invite_codes").update({
      metadata: { ...meta, waitlist_count: (meta.waitlist_count || 0) + 1 },
    }).eq("id", invite.id);
    throw new Error("__WAITLIST__");
  }

  if (isFull && !hasWaitlist) throw new Error("This invite code has reached its usage limit.");

  const tier = meta.target_tier ?? invite.tier ?? (
    invite.type === "vip" ? "vip" : invite.type === "whitelist" ? "whitelist" : "standard"
  );

  const { error: updateErr } = await supabase
    .from("invite_codes")
    .update({ uses_count: (invite.uses_count || 0) + 1 })
    .eq("id", invite.id);

  if (updateErr) throw new Error("Failed to apply code. Please try again.");

  await supabase.from("invite_code_usage").insert({
    invite_code_id: invite.id,
    code: normalized,
    used_by: userId,
    used_at: new Date().toISOString(),
  });

  const product =
    products.find((p) => p.tier === tier && p.is_active) ??
    products.find((p) => p.is_active) ??
    products[0];

  if (product) {
    await supabase.from("payments").insert({
      user_id: userId,
      product_id: product.id,
      provider: "paystack",
      provider_payment_id: `invite_${normalized}_${Date.now()}`,
      amount_cents: 0,
      currency: "USD",
      status: "completed",
      idempotency_key: crypto.randomUUID(),
      completed_at: new Date().toISOString(),
      metadata: { invite_code: normalized, type: invite.type, tier },
    });
  }

  const { error: activateErr } = await supabase
    .from("profiles")
    .update({
      account_activated: true,
      subscription_tier: tier,
      payment_status: "paid",
      invite_code_used: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (activateErr) throw new Error("Account activation failed. Contact support.");
  return { success: true, tier };
}

// ─── Payment history ──────────────────────────────────────────────────────────

export async function getUserPayments(userId) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, payment_products(name, tier)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserSubscription(userId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*, payment_products(name, tier, amount_usd)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  return data ?? null;
}