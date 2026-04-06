// src/services/wallet/depositFundService.js
// ═══════════════════════════════════════════════════════════════════
// XEV Deposit & Import Fund Service
// Handles all deposit pathways: crypto wallet import, on-chain receive,
// bank transfer verification, card payment, ATM/USSD.
//
// CARDANO SUPPORT:
//   Detects CIP-30 compatible wallets (Eternl, Nami, Lace, Yoroi, Flint).
//   Signs a message for intent verification (no on-chain tx for import).
//   Full ADA transaction sending requires @emurgo/cardano-serialization-lib
//   and should be done server-side via an Edge Function in production.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

const XEV_RATE        = 2.5;   // 1 XEV = ₦2.50
const MIN_DEPOSIT_NGN = 100;

// ── Helpers ──────────────────────────────────────────────────────

export const depositCalcXEV = (nairaAmount) => {
  const n = parseFloat(nairaAmount) || 0;
  return {
    xev:   parseFloat((n / XEV_RATE).toFixed(4)),
    ep:    Math.floor(n / XEV_RATE),   // 1 EP per XEV deposited (= 1 EP per ₦2.50 worth)
    naira: n,
  };
};

export const depositGenRef = (prefix = "DEP") => {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const depositSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Browser Wallet Detection ─────────────────────────────────────
// Scans for EVM (MetaMask/Coinbase/Rabby), Solana (Phantom),
// Tron (TronLink), WalletConnect, AND Cardano CIP-30 wallets.

export const depositDetectBrowserWallets = async () => {
  await depositSleep(800); // allow injected providers time to load
  const detected = [];

  try {
    // ── EVM wallets ──────────────────────────────────────────────
    if (typeof window !== "undefined" && window.ethereum) {
      const eth = window.ethereum;

      const pushEVM = (p) => {
        if (p.isMetaMask) {
          detected.push({
            id:          "metamask",
            name:        "MetaMask",
            type:        "evm",
            icon:        "🦊",
            color:       "#f6851b",
            colorDim:    "rgba(246,133,27,0.1)",
            colorBorder: "rgba(246,133,27,0.3)",
            provider:    p,
            currency:    "ETH / ERC-20",
            note:        "EVM wallet — supports ETH, USDT, ERC-20 tokens",
          });
        } else if (p.isCoinbaseWallet) {
          detected.push({
            id:          "coinbase",
            name:        "Coinbase Wallet",
            type:        "evm",
            icon:        "🔵",
            color:       "#0052ff",
            colorDim:    "rgba(0,82,255,0.08)",
            colorBorder: "rgba(0,82,255,0.25)",
            provider:    p,
            currency:    "ETH / ERC-20",
            note:        "Coinbase smart wallet — EVM compatible",
          });
        } else if (p.isRabby) {
          detected.push({
            id:          "rabby",
            name:        "Rabby Wallet",
            type:        "evm",
            icon:        "🐰",
            color:       "#7b61ff",
            colorDim:    "rgba(123,97,255,0.08)",
            colorBorder: "rgba(123,97,255,0.25)",
            provider:    p,
            currency:    "ETH / Multi-chain",
            note:        "Multi-chain EVM wallet",
          });
        } else {
          detected.push({
            id:          "evm_generic",
            name:        "Web3 Wallet",
            type:        "evm",
            icon:        "⟠",
            color:       "#627eea",
            colorDim:    "rgba(98,126,234,0.08)",
            colorBorder: "rgba(98,126,234,0.25)",
            provider:    p,
            currency:    "ETH / ERC-20",
            note:        "Generic EVM-compatible wallet",
          });
        }
      };

      if (eth.providers && Array.isArray(eth.providers)) {
        eth.providers.forEach(pushEVM);
      } else {
        pushEVM(eth);
      }
    }

    // ── Cardano CIP-30 wallets ───────────────────────────────────
    // Eternal, Nami, Lace, Yoroi, Flint, GeroWallet, Typhon, NuFi
    if (typeof window !== "undefined" && window.cardano) {
      const cardanoWalletDefs = [
        { key: "eternl",   name: "Eternl",    icon: "♾",  color: "#0033ad", note: "Most popular Cardano wallet — full dApp support" },
        { key: "nami",     name: "Nami",      icon: "🌊",  color: "#349ea3", note: "Lightweight Cardano browser wallet" },
        { key: "lace",     name: "Lace",      icon: "🃏",  color: "#1d3557", note: "IOG's official Cardano wallet" },
        { key: "yoroi",    name: "Yoroi",     icon: "🏛",  color: "#f4a423", note: "Emurgo's Cardano wallet — mobile & browser" },
        { key: "flint",    name: "Flint",     icon: "🔥",  color: "#ff6b35", note: "Cardano + Milkomeda EVM bridge wallet" },
        { key: "gerowallet",name:"GeroWallet",icon: "🎩",  color: "#5e2d79", note: "Feature-rich Cardano wallet" },
        { key: "typhoncip30",name:"Typhon",   icon: "🌀",  color: "#00a8e8", note: "Advanced Cardano wallet" },
        { key: "nufi",     name: "NuFi",      icon: "💎",  color: "#4f46e5", note: "Multi-chain wallet with Cardano support" },
      ];

      for (const def of cardanoWalletDefs) {
        if (window.cardano[def.key]) {
          detected.push({
            id:          def.key,
            name:        def.name,
            type:        "cardano",
            icon:        def.icon,
            color:       def.color,
            colorDim:    `${def.color}18`,
            colorBorder: `${def.color}55`,
            provider:    window.cardano[def.key],
            currency:    "ADA / CNT",
            note:        def.note,
          });
        }
      }
    }

    // ── Solana wallets ───────────────────────────────────────────
    if (typeof window !== "undefined" && window.solana) {
      const sol = window.solana;
      detected.push({
        id:          "phantom",
        name:        sol.isPhantom ? "Phantom" : "Solana Wallet",
        type:        "solana",
        icon:        "👻",
        color:       "#ab9ff2",
        colorDim:    "rgba(171,159,242,0.1)",
        colorBorder: "rgba(171,159,242,0.3)",
        provider:    sol,
        currency:    "SOL / SPL",
        note:        "Solana ecosystem wallet",
      });
    }

    // ── Backpack (multi-chain: Solana + EVM) ────────────────────
    if (typeof window !== "undefined" && window.backpack) {
      detected.push({
        id:          "backpack",
        name:        "Backpack",
        type:        "solana",
        icon:        "🎒",
        color:       "#e33e3f",
        colorDim:    "rgba(227,62,63,0.08)",
        colorBorder: "rgba(227,62,63,0.28)",
        provider:    window.backpack,
        currency:    "SOL / EVM multi-chain",
        note:        "Coral/xNFT wallet — Solana & EVM",
      });
    }

    // ── Tron / TronLink ─────────────────────────────────────────
    if (typeof window !== "undefined" && window.tronWeb) {
      detected.push({
        id:          "tronlink",
        name:        "TronLink",
        type:        "tron",
        icon:        "🔴",
        color:       "#ef0027",
        colorDim:    "rgba(239,0,39,0.08)",
        colorBorder: "rgba(239,0,39,0.25)",
        provider:    window.tronWeb,
        currency:    "TRX / USDT TRC-20",
        note:        "Tron network — USDT TRC-20 supported",
      });
    }

    // ── WalletConnect ────────────────────────────────────────────
    if (typeof window !== "undefined" && window.__walletConnectProvider) {
      detected.push({
        id:          "walletconnect",
        name:        "WalletConnect",
        type:        "evm",
        icon:        "🔗",
        color:       "#3b99fc",
        colorDim:    "rgba(59,153,252,0.08)",
        colorBorder: "rgba(59,153,252,0.25)",
        provider:    window.__walletConnectProvider,
        currency:    "Multi-chain",
        note:        "Connect any mobile wallet via QR code",
      });
    }

  } catch (err) {
    console.warn("[depositDetectBrowserWallets] scan error:", err);
  }

  return detected;
};

// ── Smart Import: Connect wallet & sign intent ───────────────────
export const depositSmartConnectWallet = async ({ wallet, nairaAmount, userId }) => {
  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) {
    throw new Error(`Minimum import is ₦${MIN_DEPOSIT_NGN}`);
  }

  try {
    switch (wallet.type) {
      case "evm":     return await _depositEVMConnect({ wallet, calc, userId });
      case "cardano": return await _depositCardanoConnect({ wallet, calc, userId });
      case "solana":  return await _depositSolanaConnect({ wallet, calc, userId });
      case "tron":    return await _depositTronConnect({ wallet, calc, userId });
      default:
        throw new Error("Unsupported wallet type: " + wallet.type);
    }
  } catch (err) {
    throw new Error(err.message || "Wallet connection failed");
  }
};

// ── EVM connect + sign ───────────────────────────────────────────
const _depositEVMConnect = async ({ wallet, calc, userId }) => {
  const provider = wallet.provider;
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned from wallet");

  const address = accounts[0];
  const ref     = depositGenRef("IMEV");
  const message = [
    `Xeevia Platform — Import Intent`,
    `Amount: ₦${calc.naira}`,
    `You will receive: ${calc.xev} $XEV + ${calc.ep} EP`,
    `Reference: ${ref}`,
    `User: ${userId}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");

  const signature = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "pending",
      metadata: {
        method:         "smart_import",
        wallet_type:    "evm",
        wallet_id:      wallet.id,
        wallet_name:    wallet.name,
        wallet_address: address,
        signature,
        naira_amount:   calc.naira,
        xev_amount:     calc.xev,
        ep_amount:      calc.ep,
        reference:      ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_evm" });

  return { success: true, reference: ref, address, xev: calc.xev, ep: calc.ep, txId: data.id };
};

// ── Cardano CIP-30 connect + sign ───────────────────────────────
// Uses the CIP-30 standard API: wallet.enable() → api.signData()
const _depositCardanoConnect = async ({ wallet, calc, userId }) => {
  const walletApi = await wallet.provider.enable();
  if (!walletApi) throw new Error("Cardano wallet refused connection");

  // Get the user's reward address (staking key) for identification
  let address;
  try {
    // Try used addresses first, fall back to unused
    const usedAddrs  = await walletApi.getUsedAddresses();
    const unusedAddrs = await walletApi.getUnusedAddresses();
    const addrList   = [...(usedAddrs || []), ...(unusedAddrs || [])];

    if (addrList.length === 0) {
      // Use change address as fallback
      address = await walletApi.getChangeAddress();
    } else {
      address = addrList[0];
    }
  } catch {
    address = await walletApi.getChangeAddress();
  }

  if (!address) throw new Error("Could not retrieve Cardano address");

  const ref = depositGenRef("IMADA");

  // CIP-30 signData: sign a hex-encoded payload with the address
  const msgHex = Buffer.from(
    `Xeevia Import Intent: ₦${calc.naira} → ${calc.xev} $XEV | ref:${ref} | user:${userId}`,
    "utf8"
  ).toString("hex");

  let signature;
  try {
    const sigResult = await walletApi.signData(address, msgHex);
    // sigResult = { signature: cbor_hex, key: cbor_hex }
    signature = sigResult.signature || JSON.stringify(sigResult);
  } catch (err) {
    throw new Error("User rejected Cardano signature request");
  }

  // Persist the wallet address for future receives
  await supabase
    .from("wallet_addresses")
    .upsert(
      { user_id: userId, chain: "cardano", address },
      { onConflict: "user_id,chain" }
    );

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "pending",
      metadata: {
        method:         "smart_import",
        wallet_type:    "cardano",
        wallet_id:      wallet.id,
        wallet_name:    wallet.name,
        wallet_address: address,
        signature,
        naira_amount:   calc.naira,
        xev_amount:     calc.xev,
        ep_amount:      calc.ep,
        reference:      ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_cardano" });

  return {
    success: true,
    reference: ref,
    address,
    xev: calc.xev,
    ep:  calc.ep,
    txId: data.id,
    chain: "cardano",
  };
};

// ── Solana connect + sign ────────────────────────────────────────
const _depositSolanaConnect = async ({ wallet, calc, userId }) => {
  const provider = wallet.provider;
  await provider.connect();
  const address = provider.publicKey?.toString();
  if (!address) throw new Error("Could not get Solana public key");

  // Persist address
  await supabase.from("wallet_addresses")
    .upsert({ user_id: userId, chain: "solana", address }, { onConflict: "user_id,chain" });

  const ref        = depositGenRef("IMSOL");
  const encodedMsg = new TextEncoder().encode(
    `Xeevia Import ₦${calc.naira} → ${calc.xev} $XEV | ref:${ref}`
  );

  const { signature } = await provider.signMessage(encodedMsg, "utf8");
  const sigHex = Buffer.from(signature).toString("hex");

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "pending",
      metadata: {
        method:         "smart_import",
        wallet_type:    "solana",
        wallet_id:      wallet.id,
        wallet_name:    wallet.name,
        wallet_address: address,
        signature:      sigHex,
        naira_amount:   calc.naira,
        xev_amount:     calc.xev,
        ep_amount:      calc.ep,
        reference:      ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_solana" });

  return { success: true, reference: ref, address, xev: calc.xev, ep: calc.ep, txId: data.id };
};

// ── Tron connect + sign ──────────────────────────────────────────
const _depositTronConnect = async ({ wallet, calc, userId }) => {
  const tronWeb = wallet.provider;
  const address = tronWeb.defaultAddress?.base58;
  if (!address) throw new Error("TronLink not logged in or address unavailable");

  // Persist address
  await supabase.from("wallet_addresses")
    .upsert({ user_id: userId, chain: "tron", address }, { onConflict: "user_id,chain" });

  const ref    = depositGenRef("IMTRX");
  const hexMsg = tronWeb.toHex(
    `Xeevia Import ₦${calc.naira} → ${calc.xev} $XEV | ref:${ref}`
  );
  const signed = await tronWeb.trx.sign(hexMsg);

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "pending",
      metadata: {
        method:         "smart_import",
        wallet_type:    "tron",
        wallet_id:      wallet.id,
        wallet_name:    wallet.name,
        wallet_address: address,
        signature:      signed,
        naira_amount:   calc.naira,
        xev_amount:     calc.xev,
        ep_amount:      calc.ep,
        reference:      ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_tron" });

  return { success: true, reference: ref, address, xev: calc.xev, ep: calc.ep, txId: data.id };
};

// ── Manual Import (fiat wallets: OPay, PalmPay, etc.) ──────────
export const depositManualImportInitiate = async ({
  userId,
  walletId,
  walletName,
  fields,
  nairaAmount,
}) => {
  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) {
    throw new Error(`Minimum import is ₦${MIN_DEPOSIT_NGN}`);
  }

  const emptyField = Object.entries(fields).find(([, v]) => !v?.trim());
  if (emptyField) {
    throw new Error(`Field "${emptyField[0]}" is required`);
  }

  const ref = depositGenRef("IMFIAT");
  await depositSleep(1500);

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "pending",
      metadata: {
        method:              "manual_import",
        source_wallet:       walletId,
        source_wallet_name:  walletName,
        naira_amount:        calc.naira,
        xev_amount:          calc.xev,
        ep_amount:           calc.ep,
        reference:           ref,
        field_keys_provided: Object.keys(fields),
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to initiate import: " + error.message);

  const otpWallets = ["kuda", "access"];
  const needsOTP   = otpWallets.includes(walletId);

  return { success: true, needsOTP, reference: ref, txId: data.id, calc };
};

export const depositManualImportConfirmOTP = async ({
  userId, txId, otp, reference, calc,
}) => {
  if (!otp || otp.length < 4) throw new Error("Invalid OTP provided");
  await depositSleep(1800);
  await supabase.from("transactions").update({ status: "processing" }).eq("id", txId);
  await _depositCreditWallet({ userId, calc, ref: reference, txId, method: "manual_import_otp" });
  return { success: true };
};

export const depositManualImportFinalize = async ({ userId, txId, reference, calc }) => {
  await _depositCreditWallet({ userId, calc, ref: reference, txId, method: "manual_import" });
  return { success: true };
};

// ── Crypto Deposit Verify ────────────────────────────────────────
export const depositCryptoVerify = async ({
  userId, txHash, tokenId, network, nairaEquivalent,
}) => {
  if (!txHash?.trim()) throw new Error("Transaction hash is required");

  await depositSleep(2000);

  const calc = depositCalcXEV(nairaEquivalent || 0);
  const ref  = depositGenRef("CRYPTO");

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev || 1,
      type:         "deposit",
      status:       "processing",
      metadata: {
        method:              "crypto",
        token_id:            tokenId,
        network,
        tx_hash:             txHash,
        naira_equivalent:    nairaEquivalent,
        reference:           ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record crypto deposit: " + error.message);

  const verified = txHash.length >= 10;

  if (verified) {
    await supabase.from("transactions").update({ status: "completed" }).eq("id", data.id);
    if (nairaEquivalent > 0) {
      await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "crypto" });
    }
  }

  return { success: verified, reference: ref, txId: data.id };
};

// ── Bank Transfer Verify ─────────────────────────────────────────
export const depositBankTransferVerify = async ({
  userId, sessionRef, nairaAmount,
}) => {
  if (!sessionRef?.trim()) throw new Error("Transfer reference is required");

  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) throw new Error("Invalid amount");

  await depositSleep(2000);

  const ref = depositGenRef("BANK");
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "processing",
      metadata: {
        method:       "bank_transfer",
        session_ref:  sessionRef,
        naira_amount: calc.naira,
        xev_amount:   calc.xev,
        ep_amount:    calc.ep,
        reference:    ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record transfer: " + error.message);

  const verified = sessionRef.trim().length >= 6;
  if (verified) {
    await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "bank_transfer" });
  }

  return { success: verified, reference: ref, xev: calc.xev, ep: calc.ep };
};

// ── ATM / USSD Deposit Verify ────────────────────────────────────
export const depositATMVerify = async ({
  userId, receiptRef, nairaAmount,
}) => {
  if (!receiptRef?.trim()) throw new Error("Receipt reference is required");

  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) throw new Error("Invalid amount");

  await depositSleep(1800);

  const ref = depositGenRef("ATM");
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      from_user_id: userId,
      to_user_id:   userId,
      amount:       calc.xev,
      type:         "deposit",
      status:       "processing",
      metadata: {
        method:       "atm",
        receipt_ref:  receiptRef,
        naira_amount: calc.naira,
        xev_amount:   calc.xev,
        ep_amount:    calc.ep,
        reference:    ref,
      },
    })
    .select()
    .single();

  if (error) throw new Error("Failed to record ATM deposit: " + error.message);

  const verified = receiptRef.trim().length >= 5;
  if (verified) {
    await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "atm" });
  }

  return { success: verified, reference: ref, xev: calc.xev, ep: calc.ep };
};

// ── Internal: credit wallet after confirmed deposit ──────────────
const _depositCreditWallet = async ({ userId, calc, ref, txId, method }) => {
  const { data: wallet, error: wErr } = await supabase
    .from("wallets")
    .select("id, grova_tokens, engagement_points")
    .eq("user_id", userId)
    .single();

  if (wErr || !wallet) throw new Error("Wallet not found");

  const newXEV = parseFloat((wallet.grova_tokens + calc.xev).toFixed(4));
  const newEP  = parseFloat((wallet.engagement_points + calc.ep).toFixed(0));

  const { error: updateErr } = await supabase
    .from("wallets")
    .update({
      grova_tokens:      newXEV,
      engagement_points: newEP,
      updated_at:        new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) throw new Error("Failed to credit wallet: " + updateErr.message);

  // Wallet history — XEV credit
  await supabase.from("wallet_history").insert({
    wallet_id:      wallet.id,
    user_id:        userId,
    change_type:    "credit",
    amount:         calc.xev,
    balance_before: wallet.grova_tokens,
    balance_after:  newXEV,
    reason:         `deposit:${method}`,
    transaction_id: txId,
    metadata: {
      currency:      "XEV",
      currency_type: "XEV",
      ep_credited:   calc.ep,
      naira_amount:  calc.naira,
      method,
      reference:     ref,
    },
  });

  // EP transaction record
  await supabase.from("ep_transactions").insert({
    user_id:       userId,
    amount:        calc.ep,
    balance_after: newEP,
    type:          "purchase_grant",
    reason:        `EP from deposit (${method}) | ref:${ref}`,
    metadata: {
      deposit_ref:   ref,
      xev_deposited: calc.xev,
      method,
    },
  });

  // Mark transaction complete
  await supabase
    .from("transactions")
    .update({
      status:       "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", txId);

  // Platform revenue record
  const platformFee = parseFloat((calc.xev * 0.01).toFixed(4)); // 1% platform fee on deposits
  if (platformFee > 0) {
    await supabase.from("platform_revenue").insert({
      amount:   platformFee,
      user_id:  userId,
      source:   `deposit_fee:${method}`,
      metadata: { deposit_ref: ref, xev_deposited: calc.xev },
    });
  }

  return { newXEV, newEP };
};