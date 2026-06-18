// src/services/wallet/depositFundService.js
// ════════════════════════════════════════════════════════════════════════════
//  DEPOSIT FUND SERVICE — v7
//
//  KEY FIX (v7):
//    REACT_APP_PAYSTACK_PUBLIC_KEY is a build-time env variable.
//    On localhost, CRA bakes it in during `npm start`.
//    On production (Vercel / Netlify / Railway), if the env var is NOT set
//    in the deployment dashboard it is simply `undefined` at runtime —
//    even if it exists in your local .env.
//
//    The auth/paywall Paystack worked because it either:
//      a) Called Paystack via a backend/edge function (key never on client), or
//      b) Had the var set in the deploy dashboard for that specific flow.
//
//    THE REAL FIX:
//      The Paystack PUBLIC key is returned by your own edge function
//      (deposit-paystack-init) in `initResult.paystackKey`.
//      We use that. No client-side env var needed at all.
//
//      Fallback chain:
//        1. initResult.paystackKey   ← server-side secret, always available
//        2. process.env.REACT_APP_PAYSTACK_PUBLIC_KEY  ← local dev convenience
//
//    This means:
//      - Works on localhost without any .env changes
//      - Works on production without touching deployment env vars
//      - Auth flow and deposit flow use the same key source
//      - The public key never needs to be baked into the frontend bundle
//
//  EP MINT FIX (retained from v6):
//    NGN → USD → EP conversion at 100 EP/USD.
//    usd_amount passed in metadata so webhook mints correctly.
//
//  ECONOMY (authoritative):
//    1 USD  = 100 EP
//    1 XEV  = 10 EP   →  1 XEV = $0.10 USD
//    NGN deposits: convert to USD first, then apply 100 EP/USD
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../config/supabase";

// ─── Economy ──────────────────────────────────────────────────────────────────
export const MIN_DEPOSIT = 100;   // NGN
const EP_PER_USD         = 100;   // 1 USD = 100 EP
const XEV_PER_EP         = 0.1;   // 1 XEV = 10 EP  (1 EP = 0.1 XEV)

// ─── USD/NGN live rate ────────────────────────────────────────────────────────
let _cachedRate    = 1500;
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
export function depositCalcCredit(naira, currency, rate) {
  const n        = parseFloat(naira) || 0;
  const r        = rate || _cachedRate;
  const usdEquiv = n / r;

  if (currency === "XEV") {
    const xev = parseFloat((usdEquiv / 0.1).toFixed(4));
    return { amount: xev, label: "$XEV" };
  }

  const ep = Math.floor(usdEquiv * EP_PER_USD);
  return { amount: ep, label: "EP" };
}

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
//  v7 KEY CHANGE:
//    The Paystack PUBLIC key is now sourced from the edge function response
//    (`initResult.paystackKey`). This means:
//
//    • Your edge function (deposit-paystack-init) must include this in its
//      response JSON:
//
//        return new Response(JSON.stringify({
//          reference,
//          creditAmount,
//          amountKobo,
//          paystackKey: Deno.env.get("PAYSTACK_PUBLIC_KEY"),  // ← ADD THIS LINE
//        }), { headers: { "Content-Type": "application/json" } });
//
//    • PAYSTACK_PUBLIC_KEY is already set in your Supabase edge function
//      secrets (it must be, since auth Paystack works). No new secrets needed.
//
//    • REACT_APP_PAYSTACK_PUBLIC_KEY no longer needs to be in your frontend
//      env at all — on production or locally.
//
//    Fallback: if the edge function hasn't been updated yet, we still check
//    process.env as a secondary so local dev doesn't break during migration.
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

  // ── 1. Get auth session ───────────────────────────────────────────────────
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

  // ── 2. Compute USD equivalent ─────────────────────────────────────────────
  const rate      = await getLiveUSDNGN();
  const usdAmount = parseFloat((n / rate).toFixed(4));

  // ── 3. Call edge function to register intent ──────────────────────────────
  //       Edge function returns: { reference, creditAmount, amountKobo, paystackKey }
  //       paystackKey is read from Deno.env on the server — always available.
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  let initResult;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/deposit-paystack-init`, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,           // belt+suspenders: also send userId explicitly
        nairaAmount:  n,
        usdAmount,
        usdNgnRate:   rate,
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

  const { reference, creditAmount, amountKobo, paystackKey: serverKey } = initResult;
  if (!reference) throw new Error("Server did not return a reference");

  // ── 4. Resolve Paystack public key ────────────────────────────────────────
  //       Priority: edge function response → local env fallback
  //       If neither exists, surface a clear actionable error.
  const PAYSTACK_KEY = serverKey || process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;


  if (!PAYSTACK_KEY) {
    // Include server response to help diagnose misconfiguration without
    // exposing secret keys (serverKey would be undefined here).
    const debug = { serverKeyPresent: !!serverKey, initResultSummary: { reference, amountKobo, creditAmount } };
    console.error("[depositPaystackOpen] Missing Paystack public key", debug);
    throw new Error(
      "Paystack key unavailable. Ensure your edge function (deposit-paystack-init) returns `paystackKey` (Deno.env.get(\"PAYSTACK_PUBLIC_KEY\") or REACT_APP_PAYSTACK_PUBLIC_KEY). " +
      "Server response: " + JSON.stringify(debug)
    );
  }

  // ── 5. Load Paystack inline script ───────────────────────────────────────
  await _loadPaystackScript();

  // ── 6. Open Paystack popup ────────────────────────────────────────────────
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
        usd_amount:       usdAmount,
        usd_ngn_rate:     rate,
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