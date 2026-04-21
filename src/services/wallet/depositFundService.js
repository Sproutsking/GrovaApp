// src/services/wallet/depositFundService.js
// ════════════════════════════════════════════════════════════════════════════
//  DEPOSIT FUND SERVICE — v6
//
//  EP MINT FIX:
//    Previously depositCalcCredit("NGN", ...) returned raw NGN as EP,
//    so a $4 / ₦5,380 payment showed "5,380 EP" in the preview and
//    the webhook minted 5,380 EP instead of 400 EP.
//
//    Root cause: the old formula was:
//      ep = Math.floor(naira * epPerNGN)     ← epPerNGN ≈ 0.073 → tiny
//    BUT the webhook was calling mintOnDeposit(userId, ngnAmount, "NGN")
//    with deposit_per_ngn = 1, giving 1 EP/₦1 = 5,380 EP.
//
//    Fix applied in TWO places:
//      1. depositCalcCredit (preview) — now correctly converts NGN→USD→EP
//      2. mintOnDeposit call path    — webhook should pass USD amount with
//         currency="USD". If it only has NGN, epService.computeEPMint now
//         does the conversion internally.
//
//    Correct result: $4 USD = 400 EP regardless of local currency charged.
//
//  ECONOMY (authoritative):
//    1 USD  = 100 EP
//    1 XEV  = 10 EP   →  1 XEV = $0.10 USD
//    NGN deposits: convert to USD first, then apply 100 EP/USD
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// ─── Economy ──────────────────────────────────────────────────────────────────
export const MIN_DEPOSIT = 100;    // NGN
const EP_PER_USD         = 100;    // 1 USD = 100 EP
const XEV_PER_EP         = 0.1;   // 1 XEV = 10 EP  (1 EP = 0.1 XEV)

// ─── USD/NGN live rate ────────────────────────────────────────────────────────
let _cachedRate    = 1500;  // raised default: more conservative, avoids over-minting
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

// ─── Conversion helpers (DISPLAY ONLY — server computes actual credit) ────────
//
// FIX: depositCalcCredit now correctly converts NGN → USD → EP.
//
// Old (wrong):
//   ep = Math.floor(naira × epPerNGN)   where epPerNGN = EP_PER_USD / rate
//   Example: Math.floor(5380 × (100/1345)) = Math.floor(400) = 400 EP ✓
//   This was CORRECT in the preview. The bug was in the WEBHOOK path
//   calling mintOnDeposit with currency="NGN" and deposit_per_ngn=1.
//
// The preview was actually fine. The webhook was the real bug.
// But we harden both here for clarity and auditability.
//
export function depositCalcCredit(naira, currency, rate) {
  const n        = parseFloat(naira) || 0;
  const r        = rate || _cachedRate;

  // Always: NGN → USD → EP
  const usdEquiv = n / r;  // e.g. ₦5,380 / 1345 = $4.00

  if (currency === "XEV") {
    // $4 × (1 XEV / $0.10) = 40 XEV  →  but display in XEV
    const xev = parseFloat((usdEquiv / 0.1).toFixed(4));
    return { amount: xev, label: "$XEV" };
  }

  // EP: $4 × 100 EP/USD = 400 EP
  const ep = Math.floor(usdEquiv * EP_PER_USD);
  return { amount: ep, label: "EP" };
}

/**
 * Returns both EP and XEV equivalents for a NGN amount.
 * Used in the rate strip / preview lines in DepositTab.
 */
export function depositCalcXEV(naira, rate) {
  const n        = parseFloat(naira) || 0;
  const r        = rate || _cachedRate;
  const usdEquiv = n / r;
  const ep       = Math.floor(usdEquiv * EP_PER_USD);
  const xev      = parseFloat((ep * XEV_PER_EP).toFixed(4));
  return { ep, xev };
}

// ─── Browser wallet detection ─────────────────────────────────────────────────
export async function depositDetectBrowserWallets() {
  const found = [];
  if (typeof window === "undefined") return found;

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
export async function depositSmartImport({ wallet, nairaAmount, userId, currency, email }) {
  if (!wallet?.provider) throw new Error("No wallet provider available");

  const n = parseFloat(nairaAmount);
  if (!n || n < MIN_DEPOSIT) throw new Error(`Minimum deposit is ₦${MIN_DEPOSIT}`);

  const rate    = await getLiveUSDNGN();
  const preview = depositCalcCredit(n, currency, rate);
  const timestamp = new Date().toISOString();
  const shortRef  = "IMPT-" + Math.random().toString(36).slice(2, 10).toUpperCase();

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
    let accounts;
    try {
      accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
    } catch (e) {
      throw new Error("Wallet connection rejected: " + (e?.message ?? "unknown"));
    }
    walletAddress = accounts?.[0];
    if (!walletAddress) throw new Error("No EVM account returned from wallet");
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
    throw new Error(`${wallet.ecosystem} import is not supported. Please use the PAY tab.`);
  }

  if (!signature) throw new Error("No signature returned from wallet");

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
//
// FIX: We now pass `usd_amount` in the intent body so the webhook/edge
// function can credit EP based on USD, not NGN. The edge function should
// prefer usd_amount × 100 EP/USD over ngnAmount × (wrong rate).
//
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

  // Compute USD equivalent to pass to the edge function.
  // The edge function must use this (not raw NGN) to mint EP correctly.
  const rate      = await getLiveUSDNGN();
  const usdAmount = parseFloat((n / rate).toFixed(4));

  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  let initResult;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/deposit-paystack-init`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        nairaAmount:  n,
        usdAmount,          // ← NEW: pass USD so webhook can mint correctly
        usdNgnRate:   rate, // ← NEW: pass the rate used for auditability
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

  await _loadPaystackScript();

  const PAYSTACK_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
  if (!PAYSTACK_KEY) throw new Error("Paystack public key not configured.");

  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop.setup({
      key:      PAYSTACK_KEY,
      email:    userEmail,
      amount:   amountKobo,
      currency: "NGN",
      ref:      reference,
      channels: [channel],
      metadata: {
        source:           "wallet_deposit",
        user_id:          userId,
        deposit_currency: currency,
        usd_amount:       usdAmount,   // ← webhook reads this to mint EP
        usd_ngn_rate:     rate,        // ← for audit trail
        channel,
        ...(fromWallet      ? { wallet_name:      fromWallet }      : {}),
        ...(walletAddress   ? { wallet_address:   walletAddress }   : {}),
        ...(walletSignature ? { wallet_signature: walletSignature } : {}),
        ...(importRef       ? { import_ref:       importRef }       : {}),
      },
      onSuccess: (transaction) => {
        const label = currency === "XEV" ? "$XEV" : "EP";
        resolve({
          reference: transaction.reference ?? reference,
          credit:    creditAmount,
          label,
          currency,
          pending:   true,
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