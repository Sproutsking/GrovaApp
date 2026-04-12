// src/services/wallet/depositFundService.js
// ════════════════════════════════════════════════════════════════════════════
//  DEPOSIT FUND SERVICE — v5
//
//  ECONOMY (authoritative):
//    1 USD  = 100 EP
//    1 XEV  = 10 EP   →  1 XEV = $0.10 USD
//    EP per NGN  = 100 / USD_NGN_RATE
//    XEV per NGN = EP_per_NGN / 10
//
//  FLOW — PAY:
//    depositPaystackOpen() → deposit-paystack-init (intent) → Paystack popup
//    → Paystack webhook verifies independently → wallet credited
//    CLIENT NEVER CREDITS.
//
//  FLOW — IMPORT:
//    depositSmartImport():
//      1. Sign authorisation message in MetaMask/Phantom (NO money, NO credit)
//      2. Call depositPaystackOpen() → Paystack charges NGN
//      3. Webhook verifies → wallet credited
//    SIGNING ALONE DOES NOT CREDIT ANYTHING.
//
//  FLOW — RECEIVE:
//    User sends crypto → submits tx hash → depositCryptoVerify() →
//    web3-verify-payment edge function verifies on-chain → credits wallet
//
//  RULES:
//    • Never use .catch() on Supabase query builders (they are thenables,
//      not full Promises — .catch() will throw "not a function")
//    • No client-side wallet credit under any circumstance
//    • amountKobo always comes from server (deposit-paystack-init), never computed client-side
//    • reference always comes from server, never generated client-side
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// ─── Economy ──────────────────────────────────────────────────────────────────
export const MIN_DEPOSIT = 100;    // NGN
const EP_PER_USD         = 100;    // 1 USD = 100 EP
const XEV_PER_EP         = 0.1;   // 1 XEV = 10 EP  (1 EP = 0.1 XEV)

// ─── USD/NGN live rate ────────────────────────────────────────────────────────
let _cachedRate    = 1366;
let _rateFetchedAt = 0;
const RATE_TTL_MS  = 5 * 60 * 1000;

export function getCachedUSDNGN() {
  return _cachedRate;
}

export async function getLiveUSDNGN() {
  const now = Date.now();
  if (now - _rateFetchedAt < RATE_TTL_MS) return _cachedRate;
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.NGN;
    if (rate && typeof rate === "number" && rate > 100) {
      _cachedRate    = rate;
      _rateFetchedAt = now;
    }
  } catch { /* keep cached rate */ }
  return _cachedRate;
}

// ─── Conversion helpers (DISPLAY ONLY — server computes actual credit) ─────────
/**
 * Returns how much EP or XEV ₦naira buys at the given rate.
 * Used for the dual-input preview in DepositTab.
 * The webhook recomputes from the Paystack-verified NGN amount independently.
 */
export function depositCalcCredit(naira, currency, rate) {
  const n        = parseFloat(naira) || 0;
  const r        = rate || _cachedRate;
  const epPerNGN = EP_PER_USD / r;
  if (currency === "XEV") {
    return { amount: parseFloat((n * epPerNGN * XEV_PER_EP).toFixed(4)), label: "$XEV" };
  }
  return { amount: Math.floor(n * epPerNGN), label: "EP" };
}

/**
 * Returns both EP and XEV equivalents for a NGN amount.
 * Used in the rate strip / preview lines in DepositTab.
 */
export function depositCalcXEV(naira, rate) {
  const n        = parseFloat(naira) || 0;
  const r        = rate || _cachedRate;
  const epPerNGN = EP_PER_USD / r;
  const ep       = Math.floor(n * epPerNGN);
  const xev      = parseFloat((ep * XEV_PER_EP).toFixed(4));
  return { ep, xev };
}

// ─── Browser wallet detection ─────────────────────────────────────────────────
export async function depositDetectBrowserWallets() {
  const found = [];
  if (typeof window === "undefined") return found;

  // EVM wallets (MetaMask, Coinbase, Brave, Rabby, etc.)
  if (window.ethereum) {
    const label =
      (window.ethereum.isMetaMask && !window.ethereum.isBraveWallet) ? "MetaMask"
      : window.ethereum.isCoinbaseWallet ? "Coinbase Wallet"
      : window.ethereum.isBraveWallet    ? "Brave Wallet"
      : window.ethereum.isRabby          ? "Rabby"
      : "Browser Wallet";
    let address = null;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      address = accounts?.[0] ?? null;
    } catch { /* ignore */ }
    found.push({
      id:        `evm_${label.toLowerCase().replace(/\s+/g, "_")}`,
      name:      label,
      icon:      label === "MetaMask" ? "🦊" : "💼",
      color:     "#f6851b",
      currency:  "ETH / ERC-20",
      address,
      ecosystem: "EVM",
      provider:  window.ethereum,
    });
  }

  // Phantom (Solana)
  const phantom = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null);
  if (phantom) {
    let address = null;
    try {
      const r = await phantom.connect({ onlyIfTrusted: true }).catch(() => null);
      address = r?.publicKey?.toString() ?? phantom.publicKey?.toString() ?? null;
    } catch { /* ignore */ }
    found.push({
      id:        "solana_phantom",
      name:      "Phantom",
      icon:      "👻",
      color:     "#ab9ff2",
      currency:  "SOL / SPL",
      address,
      ecosystem: "SOLANA",
      provider:  phantom,
    });
  }

  // TronLink
  const tron = window.tronLink ?? window.tronWeb ?? null;
  if (tron) {
    found.push({
      id:        "tron_tronlink",
      name:      "TronLink",
      icon:      "🔴",
      color:     "#ef0027",
      currency:  "TRX / TRC-20",
      address:   tron.defaultAddress?.base58 ?? null,
      ecosystem: "TRON",
      provider:  tron,
    });
  }

  return found;
}

// ─── Smart Import ─────────────────────────────────────────────────────────────
/**
 * IMPORT FLOW — two steps:
 *
 * Step 1: Sign an authorisation message in MetaMask/Phantom.
 *   - This is a plain eth_sign / signMessage — NO on-chain transaction.
 *   - NO money moves. NO wallet credit. Zero.
 *   - The signature proves the user controls the wallet address.
 *
 * Step 2: Open Paystack to charge the user's bank/card for the NGN amount.
 *   - Only after Paystack confirms AND the webhook independently verifies
 *     will the wallet be credited.
 *
 * The message shown in MetaMask is purely informational — it describes what
 * will happen (Paystack will charge, then Xeevia will credit).
 */
export async function depositSmartImport({ wallet, nairaAmount, userId, currency, email }) {
  if (!wallet?.provider) throw new Error("No wallet provider available");

  const n = parseFloat(nairaAmount);
  if (!n || n < MIN_DEPOSIT) throw new Error(`Minimum deposit is ₦${MIN_DEPOSIT}`);

  const rate      = await getLiveUSDNGN();
  const preview   = depositCalcCredit(n, currency, rate);
  const timestamp = new Date().toISOString();
  const shortRef  = "IMPT-" + Math.random().toString(36).slice(2, 10).toUpperCase();

  // Message displayed in the wallet popup (MetaMask / Phantom).
  // This is a read-only authorisation record — no money moves at this step.
  const message = [
    "Xeevia Wallet — Import Authorisation",
    `Amount:    ₦${n.toLocaleString()}`,
    `Credit:    ${preview.amount} ${preview.label}`,
    `Reference: ${shortRef}`,
    `User:      ${userId}`,
    `Time:      ${timestamp}`,
    "",
    "Signing authorises Xeevia to credit your wallet.",
    "No on-chain transaction is executed.",
    "Your NGN will be charged via Paystack after you confirm.",
  ].join("\n");

  let walletAddress = null;
  let signature     = null;

  if (wallet.ecosystem === "EVM") {
    // Request account access
    let accounts;
    try {
      accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
    } catch (e) {
      throw new Error("Wallet connection rejected: " + (e?.message ?? "unknown"));
    }
    walletAddress = accounts?.[0];
    if (!walletAddress) throw new Error("No EVM account returned from wallet");

    // Sign the authorisation message
    try {
      signature = await wallet.provider.request({
        method: "personal_sign",
        params: [message, walletAddress],
      });
    } catch (e) {
      if (e?.code === 4001) throw new Error("Signature rejected — please approve in your wallet");
      throw new Error("Signing failed: " + (e?.message ?? "unknown"));
    }

  } else if (wallet.ecosystem === "SOLANA") {
    try {
      await wallet.provider.connect();
    } catch (e) {
      throw new Error("Phantom connection rejected: " + (e?.message ?? ""));
    }
    walletAddress = wallet.provider.publicKey?.toString();
    if (!walletAddress) throw new Error("No Solana account returned");

    try {
      const encoded = new TextEncoder().encode(message);
      const signed  = await wallet.provider.signMessage(encoded, "utf8");
      signature     = Buffer.from(signed.signature).toString("hex");
    } catch (e) {
      if (e?.code === 4001) throw new Error("Signature rejected — please approve in Phantom");
      throw new Error("Signing failed: " + (e?.message ?? "unknown"));
    }

  } else {
    throw new Error(
      `${wallet.ecosystem} import is not supported. Please use the PAY tab.`
    );
  }

  if (!signature) throw new Error("No signature returned from wallet");

  // ── Step 2: Charge via Paystack ───────────────────────────────────────────
  // The signature is passed as metadata to the intent so the webhook can log it.
  // Credit only happens after Paystack confirms the charge AND the webhook
  // independently verifies it with Paystack's API.
  return depositPaystackOpen({
    userId,
    email,
    nairaAmount:     n,
    channel:         "card",
    currency,
    fromWallet:      wallet.name,
    walletAddress,
    walletSignature: signature,
    importRef:       shortRef,
    onCancel:        () => {},
  });
}

// ─── Paystack open ────────────────────────────────────────────────────────────
/**
 * Opens Paystack to charge the user NGN.
 *
 * Returns { reference, credit, label, currency, pending: true } on success.
 * The credit value is OPTIMISTIC DISPLAY ONLY — actual credit fires via webhook.
 * WalletView's realtime subscription will update the balance automatically.
 *
 * Throws { cancelled: true } if user closes the popup.
 */
export async function depositPaystackOpen({
  userId,
  email,
  nairaAmount,
  channel         = "card",
  currency        = "EP",
  onCancel,
  fromWallet      = null,
  walletAddress   = null,
  walletSignature = null,
  importRef       = null,
}) {
  const n = parseFloat(nairaAmount);
  if (!n || n < MIN_DEPOSIT) throw new Error(`Minimum deposit is ₦${MIN_DEPOSIT}`);

  // ── Auth — use try/catch, never .catch() on supabase calls ───────────────
  let session;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session;
  } catch (e) {
    throw new Error("Session error: " + (e?.message ?? "unknown"));
  }

  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated. Please sign in and try again.");

  const userEmail = email || session?.user?.email;
  if (!userEmail) throw new Error("Email not found. Please update your profile.");

  // ── Register intent with server ───────────────────────────────────────────
  // Server generates the reference and writes the pending transaction row.
  // We receive amountKobo from the server so we never calculate it client-side.
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  let initResult;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/deposit-paystack-init`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        nairaAmount: n,
        currency,
        channel,
        ...(fromWallet      ? { from_wallet:      fromWallet }      : {}),
        ...(walletAddress   ? { wallet_address:   walletAddress }   : {}),
        ...(walletSignature ? { wallet_signature: walletSignature } : {}),
        ...(importRef       ? { import_ref:       importRef }       : {}),
      }),
    });
    initResult = await res.json();
    if (!res.ok) throw new Error(initResult?.error ?? `Intent failed (${res.status})`);
  } catch (e) {
    throw new Error("Could not register deposit: " + (e?.message ?? "network error"));
  }

  const { reference, creditAmount, amountKobo } = initResult;
  if (!reference) throw new Error("Server did not return a reference");

  // ── Load Paystack ─────────────────────────────────────────────────────────
  await _loadPaystackScript();

  const PAYSTACK_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
  if (!PAYSTACK_KEY) throw new Error("Paystack public key not configured.");

  // ── Open popup ────────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop.setup({
      key:      PAYSTACK_KEY,
      email:    userEmail,
      amount:   amountKobo,    // kobo — from server, not client-computed
      currency: "NGN",
      ref:      reference,     // server-generated — cannot be replayed
      channels: [channel],
      metadata: {
        // These fields are stored by Paystack and passed back in the webhook payload.
        source:           "wallet_deposit",   // isolation tag — webhook checks this
        user_id:          userId,
        deposit_currency: currency,
        channel,
        ...(fromWallet      ? { wallet_name:      fromWallet }      : {}),
        ...(walletAddress   ? { wallet_address:   walletAddress }   : {}),
        ...(walletSignature ? { wallet_signature: walletSignature } : {}),
        ...(importRef       ? { import_ref:       importRef }       : {}),
      },
      onSuccess: (transaction) => {
        // Paystack confirmed client-side. Do NOT credit here.
        // deposit-paystack-webhook will verify independently then credit.
        const label = currency === "XEV" ? "$XEV" : "EP";
        resolve({
          reference: transaction.reference ?? reference,
          credit:    creditAmount,
          label,
          currency,
          pending:   true,   // UI shows "processing" — balance updates via realtime
        });
      },
      onCancel: () => {
        if (typeof onCancel === "function") onCancel();
        const err     = new Error("Payment cancelled");
        err.cancelled = true;
        reject(err);
      },
    });
    handler.openIframe();
  });
}

// ─── Crypto receive verification ──────────────────────────────────────────────
export async function depositCryptoVerify({ userId, txHash, tokenId, network, nairaEquivalent, currency }) {
  let session;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session;
  } catch (e) {
    throw new Error("Session error: " + (e?.message ?? ""));
  }

  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const rate   = await getLiveUSDNGN();
  const amtUSD = parseFloat(((parseFloat(nairaEquivalent) || 0) / rate).toFixed(4));

  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/web3-verify-payment`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      chainType:           network === "Tron" ? "TRON" : "EVM",
      chain:               network.toLowerCase(),
      txHash,
      claimedSenderWallet: "",
      productId:           tokenId,
      idempotencyKey:      crypto.randomUUID(),
      amountOverrideUSD:   amtUSD,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result?.error ?? `Verify error ${res.status}`);
  return result;
}

// ─── Paystack script loader ───────────────────────────────────────────────────
let _scriptLoading = false;
let _scriptLoaded  = false;

function _loadPaystackScript() {
  if (_scriptLoaded && window.PaystackPop) return Promise.resolve();

  if (_scriptLoading) {
    return new Promise((resolve, reject) => {
      const iv = setInterval(() => {
        if (window.PaystackPop) { clearInterval(iv); _scriptLoaded = true; resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(iv); reject(new Error("Paystack script timeout")); }, 15_000);
    });
  }

  _scriptLoading = true;
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { _scriptLoaded = true; _scriptLoading = false; resolve(); return; }
    const s    = document.createElement("script");
    s.src      = "https://js.paystack.co/v1/inline.js";
    s.async    = true;
    s.onload   = () => { _scriptLoaded = true; _scriptLoading = false; resolve(); };
    s.onerror  = () => { _scriptLoading = false; reject(new Error("Failed to load Paystack. Check your connection.")); };
    document.head.appendChild(s);
  });
}