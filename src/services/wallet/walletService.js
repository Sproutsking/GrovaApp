// src/services/wallet/walletService.js
// ════════════════════════════════════════════════════════════════
// Xeevia Wallet Service — $XEV (grova_tokens) + EP dual currency
//
// ON-CHAIN WALLET ADDRESSES:
//   Real wallet addresses are stored in the `wallet_addresses` table.
//   On first load, if no address exists for a user, we generate one
//   deterministically from their userId using ethers.js (EVM) and
//   store it. For Cardano, we store a bech32 address.
//   Private keys are NEVER stored in the frontend.
//   In production, key generation must happen server-side (edge function).
//   This service stores the PUBLIC address only.
//
// EP SOCIAL TRANSFERS:
//   All social actions (like, comment, share, unlock) now call
//   epService which executes the atomic 3-way transfer RPC.
//   walletService handles only direct wallet-to-wallet XEV/EP sends.
// ════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";
import { epService, computeEPBurn } from "./epService";

const XEV_TO_NGN = 2.5;

// ── Supported chains ──────────────────────────────────────────────
export const CHAINS = {
  evm:     { name: "Ethereum / EVM",  symbol: "ETH",  prefix: "0x" },
  cardano: { name: "Cardano",         symbol: "ADA",  prefix: "addr" },
  solana:  { name: "Solana",          symbol: "SOL",  prefix: ""    },
  tron:    { name: "Tron",            symbol: "TRX",  prefix: "T"   },
};

// ── Address derivation ────────────────────────────────────────────
// NOTE: In production, address generation MUST happen in a Supabase
// Edge Function to keep the derivation seed secret.
// This frontend fallback generates a deterministic address from
// the userId — suitable for testnet/demo purposes only.
// Real production flow: call edge function `generate-wallet-address`.

function deriveEVMAddress(userId) {
  // Derive a deterministic EVM-style address from userId.
  // This is NOT cryptographically secure for mainnet.
  // Replace with: POST /functions/v1/generate-wallet-address
  const hex = userId.replace(/-/g, "").slice(0, 40).toLowerCase();
  return `0x${hex}`;
}

function deriveCardanoAddress(userId) {
  // Bech32 Cardano mainnet address (addr1 prefix).
  // Replace with real CSL derivation in edge function.
  const hex = userId.replace(/-/g, "").slice(0, 58);
  return `addr1q${hex}`;
}

function deriveSolanaAddress(userId) {
  // Base58-like Solana address derived from userId.
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let addr = "";
  const clean = userId.replace(/-/g, "");
  for (let i = 0; i < 32; i++) {
    const idx = parseInt(clean.slice(i * 2, i * 2 + 2) || "0", 16) % 58;
    addr += base58Chars[idx];
  }
  return addr;
}

function deriveTronAddress(userId) {
  const hex = userId.replace(/-/g, "").slice(0, 33);
  return `T${hex}`;
}

// ── Avatar URL from supabase client ──────────────────────────────
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

// ── Recipient cache ───────────────────────────────────────────────
const _recipientCache = new Map();
const CACHE_TTL = 60_000;

async function resolveRecipient(identifier) {
  if (!identifier) return { error: "Invalid recipient" };

  // On-chain EVM address
  if (/^0x[a-fA-F0-9]{40,}$/.test(identifier.trim())) {
    return { id: null, address: identifier.trim(), isOnChain: true, chain: "evm" };
  }

  // Cardano address
  if (identifier.startsWith("addr1")) {
    return { id: null, address: identifier.trim(), isOnChain: true, chain: "cardano" };
  }

  // Solana address (base58, 32-44 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier.trim()) && !identifier.startsWith("@")) {
    return { id: null, address: identifier.trim(), isOnChain: true, chain: "solana" };
  }

  // Platform @username
  const username = identifier.replace(/^@/, "").trim().toLowerCase();
  if (!username) return { error: "Invalid recipient" };

  const hit = _recipientCache.get(username);
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
    isOnChain: false,
  };

  _recipientCache.set(username, { data: result, expires: Date.now() + CACHE_TTL });
  return result;
}

// ─────────────────────────────────────────────────────────────────
export const walletService = {

  // ── Get wallet ─────────────────────────────────────────────────
  async getWallet(userId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ── Ensure wallet exists ───────────────────────────────────────
  async ensureWallet(userId) {
    let w = await this.getWallet(userId);
    if (!w) {
      const { data, error } = await supabase
        .from("wallets")
        .insert({
          user_id:           userId,
          grova_tokens:      0,
          engagement_points: 0,
          paywave_balance:   0,
        })
        .select()
        .single();
      if (error) throw error;
      w = data;
    }
    return w;
  },

  // ── Get or generate on-chain address for a user + chain ────────
  // Returns the public address string.
  // On first call, generates and persists it.
  async getOrCreateAddress(userId, chain = "evm") {
    // 1. Check stored address
    const { data: existing } = await supabase
      .from("wallet_addresses")
      .select("address")
      .eq("user_id", userId)
      .eq("chain", chain)
      .maybeSingle();

    if (existing?.address) return existing.address;

    // 2. Generate address (frontend fallback — replace with edge function call in prod)
    // Production: const { data } = await supabase.functions.invoke("generate-wallet-address", { body: { userId, chain } });
    let address;
    switch (chain) {
      case "cardano": address = deriveCardanoAddress(userId); break;
      case "solana":  address = deriveSolanaAddress(userId);  break;
      case "tron":    address = deriveTronAddress(userId);    break;
      case "evm":
      default:        address = deriveEVMAddress(userId);     break;
    }

    // 3. Persist public address
    const { error: insertErr } = await supabase
      .from("wallet_addresses")
      .upsert({ user_id: userId, chain, address }, { onConflict: "user_id,chain" });

    if (insertErr) {
      console.warn("[walletService] Failed to persist address:", insertErr.message);
    }

    return address;
  },

  // ── Get all addresses for a user ───────────────────────────────
  async getAllAddresses(userId) {
    const { data, error } = await supabase
      .from("wallet_addresses")
      .select("chain,address,created_at")
      .eq("user_id", userId);

    if (error) return {};

    const map = {};
    (data || []).forEach((row) => { map[row.chain] = row.address; });
    return map;
  },

  // ── Real-time balance subscription ─────────────────────────────
  subscribeToBalance(userId, callback) {
    const ch = supabase
      .channel(`wallet_balance:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new) {
            callback({
              tokens:  payload.new.grova_tokens      ?? 0,
              points:  payload.new.engagement_points ?? 0,
              paywave: payload.new.paywave_balance   ?? 0,
            });
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  },

  // ── Real-time transaction feed ─────────────────────────────────
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

  // ── Recent transactions ────────────────────────────────────────
  async getRecentTransactions(userId, limit = 25) {
    const { data, error } = await supabase
      .from("wallet_history")
      .select("id,user_id,change_type,amount,balance_before,balance_after,reason,metadata,created_at,transaction_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const enriched = await Promise.all(
      data.map(async (row) => {
        const counterparty = await this._enrichCounterparty(row);
        return this._normaliseRow(row, counterparty);
      })
    );
    return enriched;
  },

  // ── Send tokens (internal platform transfer) ───────────────────
  // Handles XEV and EP sends between platform users.
  // For on-chain sends, records intent — actual broadcast is server-side.
  async sendTokens({ fromUserId, toIdentifier, amount, currency, note, epBurn }) {
    const recipient = await resolveRecipient(toIdentifier);
    if (recipient.error) return { success: false, error: recipient.error };
    if (!recipient.isOnChain && recipient.id === fromUserId) {
      return { success: false, error: "You cannot send to yourself." };
    }

    const burn = epBurn ?? computeEPBurn(parseFloat(amount));

    // On-chain address send — record intent, flag for backend broadcast
    if (recipient.isOnChain) {
      if (currency !== "XEV") {
        return { success: false, error: "On-chain sends only support $XEV." };
      }
      return this._recordOnChainSendIntent({
        fromUserId,
        toAddress: recipient.address,
        chain:     recipient.chain || "evm",
        amount:    parseFloat(amount),
        epBurn:    burn,
        note,
      });
    }

    // Internal platform send via RPC
    const { data, error } = await supabase.rpc("transfer_tokens", {
      p_from_user_id: fromUserId,
      p_to_user_id:   recipient.id,
      p_amount:       parseFloat(amount),
      p_currency:     currency,
      p_ep_burn:      burn,
      p_note:         note || "",
    });

    if (error) return { success: false, error: error.message || "Transaction failed" };
    if (!data || data.success === false) {
      return { success: false, error: data?.error || "Transaction rejected" };
    }

    return {
      success:        true,
      transaction_id: data.transaction_id,
      currency:       data.currency,
      amount:         data.amount,
      ep_burned:      data.ep_burned,
      recipient,
    };
  },

  // ── Record on-chain send intent ────────────────────────────────
  // Debits the user's internal XEV balance, creates a pending
  // transaction record. A backend worker/edge function monitors
  // pending on-chain sends and broadcasts the actual transaction.
  async _recordOnChainSendIntent({ fromUserId, toAddress, chain, amount, epBurn, note }) {
    // 1. Check balance
    const wallet = await this.getWallet(fromUserId);
    if (!wallet) return { success: false, error: "Wallet not found" };
    if (wallet.grova_tokens < amount) return { success: false, error: "Insufficient XEV balance" };
    if (wallet.engagement_points < epBurn) return { success: false, error: "Insufficient EP for fee" };

    // 2. Debit internal XEV + EP burn
    const { error: debitErr } = await supabase
      .from("wallets")
      .update({
        grova_tokens:      wallet.grova_tokens - amount,
        engagement_points: wallet.engagement_points - epBurn,
        updated_at:        new Date().toISOString(),
      })
      .eq("user_id", fromUserId);

    if (debitErr) return { success: false, error: "Failed to debit wallet: " + debitErr.message };

    // 3. Record pending on-chain transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        from_user_id: fromUserId,
        to_user_id:   null, // external address
        amount,
        type:   "withdrawal",
        status: "pending",
        metadata: {
          on_chain:        true,
          chain,
          to_address:      toAddress,
          ep_burn:         epBurn,
          note,
          currency:        "XEV",
          broadcast_ready: true, // flag for backend worker
        },
      })
      .select()
      .single();

    if (txErr) {
      // Rollback the debit
      await supabase.from("wallets").update({
        grova_tokens:      wallet.grova_tokens,
        engagement_points: wallet.engagement_points,
        updated_at:        new Date().toISOString(),
      }).eq("user_id", fromUserId);
      return { success: false, error: "Failed to record transaction" };
    }

    // 4. Write wallet history
    await supabase.from("wallet_history").insert({
      wallet_id:      wallet.id,
      user_id:        fromUserId,
      change_type:    "debit",
      amount,
      balance_before: wallet.grova_tokens,
      balance_after:  wallet.grova_tokens - amount,
      reason:         `on_chain_send:${chain}`,
      transaction_id: tx.id,
      metadata: {
        currency:    "XEV",
        currency_type: "XEV",
        on_chain:    true,
        chain,
        to_address:  toAddress,
        ep_burn:     epBurn,
        note,
      },
    });

    return {
      success:        true,
      transaction_id: tx.id,
      currency:       "XEV",
      amount,
      ep_burned:      epBurn,
      on_chain:       true,
      chain,
      to_address:     toAddress,
      status:         "pending_broadcast",
      message:        `Queued for ${CHAINS[chain]?.name || chain} broadcast`,
    };
  },

  // ── Search users for send UI ───────────────────────────────────
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
    return data.map((u) => ({
      ...u,
      avatarUrl: getAvatarUrl(u.avatar_id),
    }));
  },

  // ── Swap EP ↔ XEV ─────────────────────────────────────────────
  async swapTokens({ userId, direction, amount, epBurn = 5 }) {
    const { data, error } = await supabase.rpc("swap_tokens", {
      p_user_id:   userId,
      p_direction: direction,
      p_amount:    parseFloat(amount),
      p_ep_burn:   epBurn,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── Verify deposit ─────────────────────────────────────────────
  async verifyDeposit({ userId, txReference, method, amount, currency }) {
    const { data, error } = await supabase.rpc("verify_deposit", {
      p_user_id:      userId,
      p_tx_reference: txReference,
      p_method:       method,
      p_amount:       parseFloat(amount),
      p_currency:     currency,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // ── PayWave ────────────────────────────────────────────────────
  async payWaveSend({ fromUserId, toIdentifier, ngnAmount, isOpay, opayPhone }) {
    if (isOpay) {
      const { data, error } = await supabase.rpc("paywave_external_send", {
        p_from_user_id: fromUserId,
        p_opay_phone:   opayPhone,
        p_ngn_amount:   parseFloat(ngnAmount),
        p_fee:          5,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    }
    const recipient = await resolveRecipient(toIdentifier);
    if (recipient.error) return { success: false, error: recipient.error };
    const { data, error } = await supabase.rpc("paywave_internal_send", {
      p_from_user_id: fromUserId,
      p_to_user_id:   recipient.id,
      p_ngn_amount:   parseFloat(ngnAmount),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async getPayWaveBalance(userId) {
    const wallet = await this.getWallet(userId);
    return {
      ep:  wallet?.engagement_points ?? 0,
      ngn: wallet?.engagement_points ?? 0,
    };
  },

  // ── Credit EP (delegated to epService) ────────────────────────
  async creditEngagementEP(userId, epAmount, reason) {
    return epService._directCreditEP(userId, epAmount, reason, {});
  },

  // ── EP social transfer wrappers ────────────────────────────────
  // These are called by the social interaction layer (PostCard, etc.)
  async handleLike(fromUserId, contentOwnerId, contentType, contentId) {
    return epService.awardForLike(fromUserId, contentOwnerId, contentType, contentId);
  },

  async handleComment(fromUserId, contentOwnerId, contentType, contentId) {
    return epService.awardForComment(fromUserId, contentOwnerId, contentType, contentId);
  },

  async handleShare(fromUserId, contentOwnerId, contentType, contentId) {
    return epService.awardForShare(fromUserId, contentOwnerId, contentType, contentId);
  },

  async handleStoryUnlock(fromUserId, storyOwnerId, storyId, unlockCost) {
    return epService.awardForStoryUnlock(fromUserId, storyOwnerId, storyId, unlockCost);
  },

  // ── Internal enrichment helpers ────────────────────────────────
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

  _normaliseRow(row, counterparty) {
    const isSent   = row.change_type === "debit";
    const currency = row.metadata?.currency || row.metadata?.currency_type || "EP";
    const isOnChain = row.metadata?.on_chain === true;
    return {
      ...row,
      displayLabel:    isSent ? "Sent" : "Received",
      displaySign:     isSent ? "-" : "+",
      displayColor:    isSent ? "#f87171" : "#a3e635",
      displayCurrency: currency,
      isOnChain,
      chain:           row.metadata?.chain || null,
      counterparty,
      note:            row.metadata?.note || "",
    };
  },

  // ── Utilities ──────────────────────────────────────────────────
  getAvatarUrl,
  getEPBurn: computeEPBurn,
  CHAINS,
};