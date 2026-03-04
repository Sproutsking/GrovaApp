// src/services/wallet/depositFundService.js
// ── XEV Deposit & Import Fund Service ───────────────────────────────────────
// Custom-built deposit orchestration layer — isolated from other wallet rules.

import { supabase } from "../config/supabase";

const XEV_RATE = 2.5; // 1 XEV = ₦2.50
const MIN_DEPOSIT_NGN = 100;

// ── Helpers ──────────────────────────────────────────────────────────────────

const depositCalcXEV = (nairaAmount) => {
  const n = parseFloat(nairaAmount) || 0;
  return {
    xev: parseFloat((n / XEV_RATE).toFixed(4)),
    ep: Math.floor(n / XEV_RATE),
    naira: n,
  };
};

const depositGenRef = (prefix = "DEP") => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const depositSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Wallet Detection (Smart Import) ─────────────────────────────────────────

/**
 * depositDetectBrowserWallets
 * Scans the browser environment for injected wallet providers.
 * Returns a list of detected wallets with metadata.
 */
export const depositDetectBrowserWallets = async () => {
  await depositSleep(800); // allow providers to inject
  const detected = [];

  try {
    // EVM / MetaMask family
    if (typeof window !== "undefined" && window.ethereum) {
      const eth = window.ethereum;

      if (eth.providers && Array.isArray(eth.providers)) {
        // Multiple EVM wallets via EIP-5749
        for (const p of eth.providers) {
          if (p.isMetaMask) {
            detected.push({
              id: "metamask",
              name: "MetaMask",
              type: "evm",
              icon: "🦊",
              color: "#f6851b",
              colorDim: "rgba(246,133,27,0.1)",
              colorBorder: "rgba(246,133,27,0.3)",
              provider: p,
              currency: "ETH / ERC-20",
              note: "EVM wallet — supports ETH, USDT, ERC-20 tokens",
            });
          } else if (p.isCoinbaseWallet) {
            detected.push({
              id: "coinbase",
              name: "Coinbase Wallet",
              type: "evm",
              icon: "🔵",
              color: "#0052ff",
              colorDim: "rgba(0,82,255,0.08)",
              colorBorder: "rgba(0,82,255,0.25)",
              provider: p,
              currency: "ETH / ERC-20",
              note: "Coinbase smart wallet — EVM compatible",
            });
          } else if (p.isRabby) {
            detected.push({
              id: "rabby",
              name: "Rabby Wallet",
              type: "evm",
              icon: "🐰",
              color: "#7b61ff",
              colorDim: "rgba(123,97,255,0.08)",
              colorBorder: "rgba(123,97,255,0.25)",
              provider: p,
              currency: "ETH / Multi-chain",
              note: "Multi-chain EVM wallet",
            });
          }
        }
      } else {
        // Single provider
        const p = eth;
        if (p.isMetaMask) {
          detected.push({
            id: "metamask",
            name: "MetaMask",
            type: "evm",
            icon: "🦊",
            color: "#f6851b",
            colorDim: "rgba(246,133,27,0.1)",
            colorBorder: "rgba(246,133,27,0.3)",
            provider: p,
            currency: "ETH / ERC-20",
            note: "EVM wallet — supports ETH, USDT, ERC-20 tokens",
          });
        } else if (p.isCoinbaseWallet) {
          detected.push({
            id: "coinbase",
            name: "Coinbase Wallet",
            type: "evm",
            icon: "🔵",
            color: "#0052ff",
            colorDim: "rgba(0,82,255,0.08)",
            colorBorder: "rgba(0,82,255,0.25)",
            provider: p,
            currency: "ETH / ERC-20",
            note: "Coinbase smart wallet — EVM compatible",
          });
        } else if (p.isRabby) {
          detected.push({
            id: "rabby",
            name: "Rabby Wallet",
            type: "evm",
            icon: "🐰",
            color: "#7b61ff",
            colorDim: "rgba(123,97,255,0.08)",
            colorBorder: "rgba(123,97,255,0.25)",
            provider: p,
            currency: "ETH / Multi-chain",
            note: "Multi-chain EVM wallet",
          });
        } else {
          detected.push({
            id: "evm_generic",
            name: "Web3 Wallet",
            type: "evm",
            icon: "⟠",
            color: "#627eea",
            colorDim: "rgba(98,126,234,0.08)",
            colorBorder: "rgba(98,126,234,0.25)",
            provider: p,
            currency: "ETH / ERC-20",
            note: "Generic EVM-compatible wallet",
          });
        }
      }
    }

    // Solana wallets
    if (typeof window !== "undefined" && window.solana) {
      const sol = window.solana;
      detected.push({
        id: "phantom",
        name: sol.isPhantom ? "Phantom" : "Solana Wallet",
        type: "solana",
        icon: "👻",
        color: "#ab9ff2",
        colorDim: "rgba(171,159,242,0.1)",
        colorBorder: "rgba(171,159,242,0.3)",
        provider: sol,
        currency: "SOL / SPL",
        note: "Solana ecosystem wallet",
      });
    }

    // Tron / TronLink
    if (typeof window !== "undefined" && window.tronWeb) {
      detected.push({
        id: "tronlink",
        name: "TronLink",
        type: "tron",
        icon: "🔴",
        color: "#ef0027",
        colorDim: "rgba(239,0,39,0.08)",
        colorBorder: "rgba(239,0,39,0.25)",
        provider: window.tronWeb,
        currency: "TRX / USDT TRC-20",
        note: "Tron network — USDT TRC-20 supported",
      });
    }

    // WalletConnect (if initialized externally)
    if (typeof window !== "undefined" && window.__walletConnectProvider) {
      detected.push({
        id: "walletconnect",
        name: "WalletConnect",
        type: "evm",
        icon: "🔗",
        color: "#3b99fc",
        colorDim: "rgba(59,153,252,0.08)",
        colorBorder: "rgba(59,153,252,0.25)",
        provider: window.__walletConnectProvider,
        currency: "Multi-chain",
        note: "Connect any mobile wallet via QR code",
      });
    }
  } catch (err) {
    console.warn("[depositDetectBrowserWallets] scan error:", err);
  }

  return detected;
};

// ── Smart Import: Request wallet connection & sign ───────────────────────────

/**
 * depositSmartConnectWallet
 * Connects to a detected wallet, gets address, requests sign/payment.
 */
export const depositSmartConnectWallet = async ({ wallet, nairaAmount, userId }) => {
  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) {
    throw new Error(`Minimum import is ₦${MIN_DEPOSIT_NGN}`);
  }

  try {
    if (wallet.type === "evm") {
      return await _depositEVMConnect({ wallet, calc, userId });
    } else if (wallet.type === "solana") {
      return await _depositSolanaConnect({ wallet, calc, userId });
    } else if (wallet.type === "tron") {
      return await _depositTronConnect({ wallet, calc, userId });
    } else {
      throw new Error("Unsupported wallet type: " + wallet.type);
    }
  } catch (err) {
    throw new Error(err.message || "Wallet connection failed");
  }
};

// EVM connect + message sign (intent recording)
const _depositEVMConnect = async ({ wallet, calc, userId }) => {
  const provider = wallet.provider;

  // Request accounts
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned from wallet");

  const address = accounts[0];
  const ref = depositGenRef("IMEV");
  const message = [
    `XEV Platform — Import Intent`,
    `Amount: ₦${calc.naira}`,
    `You will receive: ${calc.xev} $XEV + ${calc.ep} EP`,
    `Reference: ${ref}`,
    `User: ${userId}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");

  // Sign message (no on-chain tx needed for intent recording)
  const signature = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });

  // Record intent in Supabase
  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev,
    type: "deposit",
    status: "pending",
    metadata: {
      method: "smart_import",
      wallet_type: "evm",
      wallet_id: wallet.id,
      wallet_name: wallet.name,
      wallet_address: address,
      signature,
      naira_amount: calc.naira,
      xev_amount: calc.xev,
      ep_amount: calc.ep,
      reference: ref,
    },
  }).select().single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  // Credit wallet (in production, this would be after on-chain confirmation)
  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_evm" });

  return { success: true, reference: ref, address, xev: calc.xev, ep: calc.ep, txId: data.id };
};

// Solana connect + sign
const _depositSolanaConnect = async ({ wallet, calc, userId }) => {
  const provider = wallet.provider;
  await provider.connect();
  const address = provider.publicKey?.toString();
  if (!address) throw new Error("Could not get Solana public key");

  const ref = depositGenRef("IMSOL");
  const encodedMsg = new TextEncoder().encode(
    `XEV Import ₦${calc.naira} → ${calc.xev} $XEV | ref:${ref}`
  );

  const { signature } = await provider.signMessage(encodedMsg, "utf8");
  const sigHex = Buffer.from(signature).toString("hex");

  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev,
    type: "deposit",
    status: "pending",
    metadata: {
      method: "smart_import",
      wallet_type: "solana",
      wallet_id: wallet.id,
      wallet_name: wallet.name,
      wallet_address: address,
      signature: sigHex,
      naira_amount: calc.naira,
      xev_amount: calc.xev,
      ep_amount: calc.ep,
      reference: ref,
    },
  }).select().single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_solana" });

  return { success: true, reference: ref, address, xev: calc.xev, ep: calc.ep, txId: data.id };
};

// Tron connect + sign
const _depositTronConnect = async ({ wallet, calc, userId }) => {
  const tronWeb = wallet.provider;
  const address = tronWeb.defaultAddress?.base58;
  if (!address) throw new Error("TronLink not logged in or address unavailable");

  const ref = depositGenRef("IMTRX");
  const hexMsg = tronWeb.toHex(
    `XEV Import ₦${calc.naira} → ${calc.xev} $XEV | ref:${ref}`
  );
  const signed = await tronWeb.trx.sign(hexMsg);

  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev,
    type: "deposit",
    status: "pending",
    metadata: {
      method: "smart_import",
      wallet_type: "tron",
      wallet_id: wallet.id,
      wallet_name: wallet.name,
      wallet_address: address,
      signature: signed,
      naira_amount: calc.naira,
      xev_amount: calc.xev,
      ep_amount: calc.ep,
      reference: ref,
    },
  }).select().single();

  if (error) throw new Error("Failed to record intent: " + error.message);

  await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "smart_tron" });

  return { success: true, reference: ref, address, xev: calc.xev, ep: calc.ep, txId: data.id };
};

// ── Manual Import ────────────────────────────────────────────────────────────

/**
 * depositManualImportInitiate
 * Initiates a manual import from a fiat wallet (OPay, PalmPay, etc.)
 * In production: calls payment gateway API to debit source wallet.
 */
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

  // Validate required fields exist
  const emptyField = Object.entries(fields).find(([, v]) => !v?.trim());
  if (emptyField) {
    throw new Error(`Field "${emptyField[0]}" is required`);
  }

  const ref = depositGenRef("IMFIAT");

  // Simulate gateway call (replace with real gateway SDK in prod)
  await depositSleep(1500);

  // Record pending transaction
  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev,
    type: "deposit",
    status: "pending",
    metadata: {
      method: "manual_import",
      source_wallet: walletId,
      source_wallet_name: walletName,
      naira_amount: calc.naira,
      xev_amount: calc.xev,
      ep_amount: calc.ep,
      reference: ref,
      // Never store sensitive fields — only log non-sensitive metadata
      field_keys_provided: Object.keys(fields),
    },
  }).select().single();

  if (error) throw new Error("Failed to initiate import: " + error.message);

  // Determine if OTP is needed
  const otpWallets = ["kuda", "access"];
  const needsOTP = otpWallets.includes(walletId);

  return {
    success: true,
    needsOTP,
    reference: ref,
    txId: data.id,
    calc,
  };
};

/**
 * depositManualImportConfirmOTP
 * Confirms an OTP for manual import flows that require it.
 */
export const depositManualImportConfirmOTP = async ({
  userId,
  txId,
  otp,
  reference,
  calc,
}) => {
  if (!otp || otp.length < 4) throw new Error("Invalid OTP provided");

  // Simulate OTP verification with gateway
  await depositSleep(1800);

  // Update tx status
  await supabase.from("transactions").update({
    status: "processing",
    metadata: supabase.rpc ? undefined : undefined, // handled below
  }).eq("id", txId);

  // Credit the wallet
  await _depositCreditWallet({ userId, calc, ref: reference, txId, method: "manual_import_otp" });

  return { success: true };
};

/**
 * depositManualImportFinalize
 * Finalizes a non-OTP manual import immediately after gateway confirms.
 */
export const depositManualImportFinalize = async ({ userId, txId, reference, calc }) => {
  await _depositCreditWallet({ userId, calc, ref: reference, txId, method: "manual_import" });
  return { success: true };
};

// ── Crypto Deposit Verify ────────────────────────────────────────────────────

/**
 * depositCryptoVerify
 * Verifies a crypto deposit by transaction hash.
 */
export const depositCryptoVerify = async ({
  userId,
  txHash,
  tokenId,
  network,
  nairaEquivalent,
}) => {
  if (!txHash?.trim()) throw new Error("Transaction hash is required");

  await depositSleep(2000); // simulate chain query

  const calc = depositCalcXEV(nairaEquivalent || 0);
  const ref = depositGenRef("CRYPTO");

  // Record
  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev || 1,
    type: "deposit",
    status: "processing",
    metadata: {
      method: "crypto",
      token_id: tokenId,
      network,
      tx_hash: txHash,
      naira_equivalent: nairaEquivalent,
      reference: ref,
    },
  }).select().single();

  if (error) throw new Error("Failed to record crypto deposit: " + error.message);

  // In production: query blockchain API to verify tx
  // For now simulate success
  const verified = txHash.length >= 10; // basic check

  if (verified) {
    await supabase.from("transactions").update({ status: "completed" }).eq("id", data.id);
    // If naira equivalent known, credit
    if (nairaEquivalent > 0) {
      await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "crypto" });
    }
  }

  return { success: verified, reference: ref, txId: data.id };
};

// ── Bank Transfer Verify ─────────────────────────────────────────────────────

/**
 * depositBankTransferVerify
 * Verifies a bank transfer by session ID / reference.
 */
export const depositBankTransferVerify = async ({
  userId,
  sessionRef,
  nairaAmount,
}) => {
  if (!sessionRef?.trim()) throw new Error("Transfer reference is required");

  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) throw new Error("Invalid amount");

  await depositSleep(2000);

  const ref = depositGenRef("BANK");
  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev,
    type: "deposit",
    status: "processing",
    metadata: {
      method: "bank_transfer",
      session_ref: sessionRef,
      naira_amount: calc.naira,
      xev_amount: calc.xev,
      ep_amount: calc.ep,
      reference: ref,
    },
  }).select().single();

  if (error) throw new Error("Failed to record transfer: " + error.message);

  // Simulate Providus verification
  const verified = sessionRef.trim().length >= 6;

  if (verified) {
    await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "bank_transfer" });
  }

  return { success: verified, reference: ref, xev: calc.xev, ep: calc.ep };
};

// ── ATM / USSD Deposit Verify ────────────────────────────────────────────────

/**
 * depositATMVerify
 * Verifies an ATM/USSD cash deposit.
 */
export const depositATMVerify = async ({
  userId,
  receiptRef,
  nairaAmount,
}) => {
  if (!receiptRef?.trim()) throw new Error("Receipt reference is required");

  const calc = depositCalcXEV(nairaAmount);
  if (calc.naira < MIN_DEPOSIT_NGN) throw new Error("Invalid amount");

  await depositSleep(1800);

  const ref = depositGenRef("ATM");
  const { data, error } = await supabase.from("transactions").insert({
    from_user_id: userId,
    to_user_id: userId,
    amount: calc.xev,
    type: "deposit",
    status: "processing",
    metadata: {
      method: "atm",
      receipt_ref: receiptRef,
      naira_amount: calc.naira,
      xev_amount: calc.xev,
      ep_amount: calc.ep,
      reference: ref,
    },
  }).select().single();

  if (error) throw new Error("Failed to record ATM deposit: " + error.message);

  const verified = receiptRef.trim().length >= 5;

  if (verified) {
    await _depositCreditWallet({ userId, calc, ref, txId: data.id, method: "atm" });
  }

  return { success: verified, reference: ref, xev: calc.xev, ep: calc.ep };
};

// ── Internal: credit wallet ──────────────────────────────────────────────────

const _depositCreditWallet = async ({ userId, calc, ref, txId, method }) => {
  // 1. Fetch wallet
  const { data: wallet, error: wErr } = await supabase
    .from("wallets")
    .select("id, grova_tokens, engagement_points, paywave_balance")
    .eq("user_id", userId)
    .single();

  if (wErr || !wallet) throw new Error("Wallet not found");

  const newXEV = parseFloat((wallet.grova_tokens + calc.xev).toFixed(4));
  const newEP = parseFloat((wallet.engagement_points + calc.ep).toFixed(0));

  // 2. Update wallet balances
  const { error: updateErr } = await supabase
    .from("wallets")
    .update({
      grova_tokens: newXEV,
      engagement_points: newEP,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) throw new Error("Failed to credit wallet: " + updateErr.message);

  // 3. Write wallet history
  await supabase.from("wallet_history").insert({
    wallet_id: wallet.id,
    user_id: userId,
    change_type: "credit",
    amount: calc.xev,
    balance_before: wallet.grova_tokens,
    balance_after: newXEV,
    reason: `Deposit via ${method} | ref:${ref}`,
    transaction_id: txId,
    metadata: { ep_credited: calc.ep, naira_amount: calc.naira, method },
  });

  // 4. Also record EP transaction
  await supabase.from("ep_transactions").insert({
    user_id: userId,
    amount: calc.ep,
    balance_after: newEP,
    type: "purchase_grant",
    reason: `EP from deposit (${method}) | ref:${ref}`,
    ref_payment_id: null,
    metadata: { deposit_ref: ref, xev_deposited: calc.xev },
  });

  // 5. Mark transaction complete
  await supabase.from("transactions").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", txId);

  return { newXEV, newEP };
};

// ── Export utility ───────────────────────────────────────────────────────────
export { depositCalcXEV, depositGenRef };