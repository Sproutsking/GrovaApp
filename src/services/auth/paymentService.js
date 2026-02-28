// src/services/auth/paymentService.js -- v10 PRODUCTION FINAL
// -----------------------------------------------------------------------------
//  CHANGES vs v9:
//  [1] FIX: All BigInt() / globalThis.BigInt() removed -- ESLint no-undef safe.
//      Token amounts computed with Math.round() + Number math, encoded via
//      pure-JS toUint256Hex() helper. Safe for all USDT/USDC at 6 decimals
//      (max value ~2^24, well within Number.MAX_SAFE_INTEGER = 2^53-1).
//  [2] All other logic identical to v9 -- no functional changes.
// -----------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// --- Idempotency key ----------------------------------------------------------
var IK_KEY = "xv_idempotency_key";
export function getOrCreateIdempotencyKey() {
  var k = sessionStorage.getItem(IK_KEY);
  if (!k) {
    k = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(IK_KEY, k);
  }
  return k;
}
export function clearIdempotencyKey() { sessionStorage.removeItem(IK_KEY); }

// --- Products -----------------------------------------------------------------
export async function fetchPaymentProducts() {
  const { data, error } = await supabase
    .from("payment_products")
    .select("id,name,amount_usd,tier,metadata,is_active")
    .eq("is_active", true)
    .order("amount_usd", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// --- Invite code --------------------------------------------------------------
export async function fetchInviteCodeDetails(code) {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("id,code,type,entry_price,price_override,max_uses,uses_count,status,metadata,expires_at")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  var now = new Date();
  var is_full = (data.max_uses != null) && (data.uses_count >= data.max_uses);
  var is_expired = data.expires_at ? new Date(data.expires_at) < now : false;
  var enable_waitlist = data.metadata ? data.metadata.enable_waitlist !== false : true;
  var uses_remaining = data.max_uses != null ? Math.max(0, data.max_uses - data.uses_count) : null;
  var entry_price = data.entry_price;
  if (data.price_override != null && !isNaN(Number(data.price_override))) {
    entry_price = Number(data.price_override);
  } else if (
    data.metadata &&
    data.metadata.entry_price_cents != null &&
    !isNaN(Number(data.metadata.entry_price_cents))
  ) {
    entry_price = Number(data.metadata.entry_price_cents) / 100;
  }
  return Object.assign({}, data, {
    entry_price: entry_price,
    is_full: is_full,
    is_expired: is_expired,
    enable_waitlist: enable_waitlist,
    uses_remaining: uses_remaining,
  });
}

// --- Save connected wallet ----------------------------------------------------
export async function saveConnectedWallet(userId, ecosystem, address, label) {
  if (!userId || !address) return;
  try {
    const { error } = await supabase.from("connected_wallets").upsert(
      {
        user_id: userId,
        ecosystem: ecosystem.toUpperCase(),
        address: address,
        label: label || "",
        connected_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: "user_id,ecosystem,address" }
    );
    if (error) console.warn("[saveConnectedWallet]", error.message);
  } catch (e) {
    console.warn("[saveConnectedWallet] non-fatal:", e && e.message);
  }
}

// --- EVM wallet detection -----------------------------------------------------
export async function detectAvailableWallet() {
  if (typeof window === "undefined") return null;
  var candidates = [
    {
      label: "MetaMask",
      obj: function () {
        return window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isBraveWallet
          ? window.ethereum
          : null;
      },
    },
    {
      label: "Coinbase Wallet",
      obj: function () {
        return (
          window.coinbaseWalletExtension ||
          (window.ethereum && window.ethereum.isCoinbaseWallet ? window.ethereum : null)
        );
      },
    },
    {
      label: "Trust Wallet",
      obj: function () {
        return window.trustwallet || (window.ethereum && window.ethereum.isTrust ? window.ethereum : null);
      },
    },
    {
      label: "Brave Wallet",
      obj: function () {
        return window.ethereum && window.ethereum.isBraveWallet ? window.ethereum : null;
      },
    },
    {
      label: "Rainbow",
      obj: function () {
        return window.ethereum && window.ethereum.isRainbow ? window.ethereum : null;
      },
    },
    { label: "OKX Wallet",     obj: function () { return window.okxwallet || null; } },
    {
      label: "Rabby",
      obj: function () {
        return window.ethereum && window.ethereum.isRabby ? window.ethereum : null;
      },
    },
    { label: "Browser Wallet", obj: function () { return window.ethereum || null; } },
  ];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var obj = c.obj();
    if (!obj) continue;
    try {
      var accounts = await obj.request({ method: "eth_accounts" }).catch(function () { return []; });
      return {
        label: c.label,
        address: (accounts && accounts[0]) || null,
        connected: !!(accounts && accounts[0]),
        ecosystem: "EVM",
        provider: obj,
      };
    } catch (e) {
      // skip
    }
  }
  return null;
}

export async function connectWallet(ecosystem) {
  ecosystem = ecosystem || "EVM";
  if (ecosystem === "EVM") {
    if (!window.ethereum) throw new Error("No EVM wallet found. Install MetaMask or Coinbase Wallet.");
    var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts[0]) throw new Error("No account returned from wallet.");
    return accounts[0];
  }
  if (ecosystem === "SOLANA") {
    var sol = await connectSolanaWallet();
    return sol.address;
  }
  if (ecosystem === "CARDANO") {
    var ada = await connectCardanoWalletCIP30();
    return ada.address;
  }
  throw new Error("Unknown ecosystem: " + ecosystem);
}

// --- Solana wallet detection --------------------------------------------------
export async function detectSolanaWallet() {
  if (typeof window === "undefined") return null;
  var wallets = [
    {
      key: "phantom",
      label: "Phantom",
      getObj: function () {
        return (
          (window.phantom && window.phantom.solana) ||
          (window.solana && window.solana.isPhantom ? window.solana : null)
        );
      },
    },
    {
      key: "solflare",
      label: "Solflare",
      getObj: function () {
        return window.solflare && window.solflare.isSolflare ? window.solflare : null;
      },
    },
    {
      key: "backpack",
      label: "Backpack",
      getObj: function () {
        return window.backpack && window.backpack.isBackpack ? window.backpack : null;
      },
    },
    {
      key: "glow",
      label: "Glow",
      getObj: function () { return (window.glow && window.glow.solana) || null; },
    },
    {
      key: "sollet",
      label: "Sollet",
      getObj: function () { return window.sollet || null; },
    },
  ];
  for (var i = 0; i < wallets.length; i++) {
    var w = wallets[i];
    var obj = w.getObj();
    if (!obj) continue;
    try {
      var resp = await obj.connect({ onlyIfTrusted: true }).catch(function () { return null; });
      var address =
        (resp && resp.publicKey && resp.publicKey.toString()) ||
        (obj.publicKey && obj.publicKey.toString()) ||
        null;
      return { label: w.label, address: address, connected: !!address, obj: obj, ecosystem: "SOLANA" };
    } catch (e) {
      return { label: w.label, address: null, connected: false, obj: obj, ecosystem: "SOLANA" };
    }
  }
  return null;
}

export async function connectSolanaWallet(preferredObj) {
  preferredObj = preferredObj || null;
  if (typeof window === "undefined") throw new Error("Browser required.");
  var candidates = preferredObj
    ? [preferredObj]
    : [
        (window.phantom && window.phantom.solana) ||
          (window.solana && window.solana.isPhantom ? window.solana : null),
        window.solflare && window.solflare.isSolflare ? window.solflare : null,
        window.backpack && window.backpack.isBackpack ? window.backpack : null,
        (window.glow && window.glow.solana) || null,
      ].filter(Boolean);
  if (!candidates.length)
    throw new Error("No Solana wallet found. Install Phantom, Solflare, or Backpack.");
  for (var i = 0; i < candidates.length; i++) {
    var obj = candidates[i];
    try {
      await obj.connect();
      var address = obj.publicKey && obj.publicKey.toString();
      if (address) return { address: address, wallet: obj };
    } catch (e) {
      if (e && e.code === 4001)
        throw new Error("Connection rejected. Please approve in your wallet.");
    }
  }
  throw new Error("Could not connect to Solana wallet. Please unlock it and try again.");
}

// --- Cardano wallet detection -------------------------------------------------
export async function detectCardanoWallet() {
  if (typeof window === "undefined" || !window.cardano) return null;
  var cw = window.cardano;
  var wallets = [
    { key: "nami",       label: "Nami",       obj: cw.nami },
    { key: "eternl",     label: "Eternl",     obj: cw.eternl },
    { key: "flint",      label: "Flint",      obj: cw.flint },
    { key: "lace",       label: "Lace",       obj: cw.lace },
    { key: "yoroi",      label: "Yoroi",      obj: cw.yoroi },
    { key: "typhon",     label: "Typhon",     obj: cw.typhon },
    { key: "gerowallet", label: "GeroWallet", obj: cw.gerowallet },
    { key: "vespr",      label: "Vespr",      obj: cw.vespr },
    { key: "nufi",       label: "NuFi",       obj: cw.nufi },
  ];
  for (var i = 0; i < wallets.length; i++) {
    var w = wallets[i];
    if (!w.obj) continue;
    try {
      var enabled = await w.obj.isEnabled().catch(function () { return false; });
      if (enabled) {
        var api = await w.obj.enable().catch(function () { return null; });
        var addrs = api
          ? await api.getUsedAddresses().catch(function () { return []; })
          : [];
        var address = (addrs && addrs[0]) || null;
        return {
          label: w.label,
          address: address,
          connected: !!address,
          api: api,
          walletObj: w.obj,
          ecosystem: "CARDANO",
        };
      }
      return { label: w.label, address: null, connected: false, walletObj: w.obj, ecosystem: "CARDANO" };
    } catch (e) {
      // try next
    }
  }
  return null;
}

export async function connectCardanoWalletCIP30(preferredObj) {
  preferredObj = preferredObj || null;
  if (typeof window === "undefined" || !window.cardano) {
    throw new Error("No Cardano wallet found. Install Nami, Eternl, Flint, or Lace.");
  }
  var cw = window.cardano;
  var order = preferredObj
    ? [preferredObj]
    : [
        cw.nami, cw.eternl, cw.flint, cw.lace, cw.yoroi,
        cw.typhon, cw.gerowallet, cw.vespr, cw.nufi,
      ].filter(Boolean);
  for (var i = 0; i < order.length; i++) {
    var w = order[i];
    if (!w) continue;
    try {
      var api = await w.enable();
      var addrs = await api.getUsedAddresses().catch(function () { return []; });
      var address = addrs && addrs[0];
      if (address) return { address: address, api: api };
    } catch (e) {
      if (e && e.code === 2)
        throw new Error("Connection rejected. Please approve in your Cardano wallet.");
    }
  }
  throw new Error("Could not connect. Please unlock your Cardano wallet and try again.");
}

// --- Pure-JS uint256 ABI encoder (no BigInt / globalThis needed) --------------
// Converts a non-negative integer to a 64-char zero-padded hex string for
// ERC-20 ABI encoding. Stablecoin amounts at 6 decimals are at most ~2^24,
// safely within Number.MAX_SAFE_INTEGER (2^53 - 1).
function toUint256Hex(value) {
  var n = Math.round(Number(value));
  if (n < 0 || !isFinite(n)) throw new Error("Invalid token amount: " + value);
  return n.toString(16).padStart(64, "0");
}

// --- ERC-20 transfer encoder --------------------------------------------------
function encodeERC20Transfer(toAddress, amountRaw) {
  var selector = "0xa9059cbb"; // transfer(address,uint256)
  var addr = toAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  var amt  = toUint256Hex(amountRaw);
  return selector + addr + amt;
}

export async function sendERC20Transfer({ provider, tokenAddress, toAddress, amountRaw, chainId }) {
  var fromAccounts = await provider.request({ method: "eth_requestAccounts" });
  var from = fromAccounts[0];
  var currentChainHex = await provider.request({ method: "eth_chainId" });
  var currentChainId = parseInt(currentChainHex, 16);
  if (currentChainId !== chainId) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + chainId.toString(16) }],
      });
    } catch (e) {
      if (e && e.code === 4902)
        throw new Error("Please add the " + chainId + " network to your wallet first.");
      throw new Error((e && e.message) || "Failed to switch network.");
    }
  }
  var data = encodeERC20Transfer(toAddress, amountRaw);
  var txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: from, to: tokenAddress, data: data, chainId: "0x" + chainId.toString(16) }],
  });
  return txHash;
}

// --- Full automated EVM payment -----------------------------------------------
export async function requestWalletPayment({
  productId, amountUSD, chainId, chainName, tokenAddress, tokenDecimals, onStep,
}) {
  function step(type, message, extra) {
    if (onStep) onStep(Object.assign({ type: type, message: message }, extra || {}));
  }
  var treasury = process.env.REACT_APP_TREASURY_WALLET;
  if (!treasury) throw new Error("Treasury wallet not configured. Contact support.");
  if (!window.ethereum) throw new Error("No EVM wallet found. Install MetaMask or Coinbase Wallet.");

  step("connecting", "Connecting wallet...");
  var evmAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  var from = evmAccounts[0];

  step("switching_chain", "Switching to " + chainName + "...");
  var currentHex = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(currentHex, 16) !== chainId) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + chainId.toString(16) }],
      });
    } catch (e) {
      if (e && e.code === 4902) throw new Error("Add the " + chainName + " network to your wallet first.");
      throw new Error((e && e.message) || "Failed to switch chain.");
    }
  }

  // Pure number math -- no BigInt needed for 6-decimal stablecoins
  var amountRaw = Math.round(amountUSD * Math.pow(10, tokenDecimals));
  var txData = encodeERC20Transfer(treasury, amountRaw);

  step("sending", "Sending $" + amountUSD + " on " + chainName + "...");
  var txHash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{
      from: from,
      to: tokenAddress,
      data: txData,
      chainId: "0x" + chainId.toString(16),
    }],
  });
  step("sent", "Transaction sent! Waiting for confirmation...", { txHash: txHash });

  var idempotencyKey = getOrCreateIdempotencyKey();
  var sessionResult = await supabase.auth.getSession();
  var token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
  if (!token) throw new Error("Not authenticated. Please sign in and try again.");

  step("confirming", "Verifying on blockchain...");
  var verifyResp = await fetch(
    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        chainType: "EVM",
        chain: chainName,
        txHash: txHash,
        claimedSenderWallet: from,
        productId: productId,
        idempotencyKey: idempotencyKey,
        amountOverrideUSD: amountUSD,
      }),
    }
  );
  var verifyResult = await verifyResp.json();
  if (!verifyResp.ok)
    throw new Error((verifyResult && verifyResult.error) || "Verification failed (" + verifyResp.status + ").");
  if (verifyResult.status === "pending")
    return { pending: true, message: verifyResult.message || "Payment pending confirmation.", txHash: txHash };
  clearIdempotencyKey();
  return { success: true, txHash: txHash, result: verifyResult };
}

// --- Full automated Solana payment --------------------------------------------
export async function requestSolanaPayment({ productId, amountUSD, tokenSymbol, onStep }) {
  function step(type, message, extra) {
    if (onStep) onStep(Object.assign({ type: type, message: message }, extra || {}));
  }
  var treasury = process.env.REACT_APP_TREASURY_WALLET_SOL;
  if (!treasury) throw new Error("SOL treasury wallet not configured. Contact support.");

  step("connecting", "Connecting Solana wallet...");
  var solConn = await connectSolanaWallet();
  var solAddress = solConn.address;
  var solWallet  = solConn.wallet;

  var Connection, PublicKey, Transaction, createTransferCheckedInstruction, getAssociatedTokenAddress;
  try {
    var web3 = await import("@solana/web3.js");
    Connection = web3.Connection;
    PublicKey  = web3.PublicKey;
    Transaction = web3.Transaction;
    var splToken = await import("@solana/spl-token");
    createTransferCheckedInstruction = splToken.createTransferCheckedInstruction;
    getAssociatedTokenAddress        = splToken.getAssociatedTokenAddress;
  } catch (e) {
    throw new Error("Solana libraries not available. Please use Manual mode.");
  }

  var SOLANA_TOKENS = {
    USDC: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    USDT: { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  };
  var tokenMeta = SOLANA_TOKENS[tokenSymbol] || SOLANA_TOKENS.USDC;
  var rpc  = process.env.REACT_APP_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  var conn = new Connection(rpc, "confirmed");

  var fromPk = new PublicKey(solAddress);
  var toPk   = new PublicKey(treasury);
  var mintPk = new PublicKey(tokenMeta.address);
  // Pure number math -- no BigInt needed
  var rawAmt = Math.round(amountUSD * Math.pow(10, tokenMeta.decimals));

  step("sending", "Preparing $" + amountUSD + " " + tokenSymbol + " transfer...");
  var fromATA = await getAssociatedTokenAddress(mintPk, fromPk);
  var toATA   = await getAssociatedTokenAddress(mintPk, toPk);

  var tx = new Transaction().add(
    createTransferCheckedInstruction(fromATA, mintPk, toATA, fromPk, rawAmt, tokenMeta.decimals)
  );
  var latestBlock = await conn.getLatestBlockhash();
  tx.recentBlockhash = latestBlock.blockhash;
  tx.feePayer = fromPk;

  var signedTx = await solWallet.signTransaction(tx);
  step("sent", "Broadcasting to Solana...");
  var sig = await conn.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction(
    { signature: sig, blockhash: latestBlock.blockhash, lastValidBlockHeight: latestBlock.lastValidBlockHeight },
    "confirmed"
  );

  step("confirming", "Verifying with server...");
  var solIdempotencyKey = getOrCreateIdempotencyKey();
  var solSession = await supabase.auth.getSession();
  var solToken = solSession.data && solSession.data.session && solSession.data.session.access_token;
  if (!solToken) throw new Error("Not authenticated.");

  var solResp = await fetch(
    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + solToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        chainType: "SOLANA",
        chain: "solana",
        txHash: sig,
        claimedSenderWallet: solAddress,
        productId: productId,
        idempotencyKey: solIdempotencyKey,
        amountOverrideUSD: amountUSD,
      }),
    }
  );
  var solResult = await solResp.json();
  if (!solResp.ok)
    throw new Error((solResult && solResult.error) || "Verification failed (" + solResp.status + ").");
  clearIdempotencyKey();
  return { success: true, txHash: sig, result: solResult };
}

// --- Full automated Cardano payment -------------------------------------------
export async function requestCardanoPayment({ productId, amountUSD, onStep }) {
  function step(type, message, extra) {
    if (onStep) onStep(Object.assign({ type: type, message: message }, extra || {}));
  }
  var treasury = process.env.REACT_APP_TREASURY_WALLET_ADA;
  if (!treasury) throw new Error("ADA treasury wallet not configured. Contact support.");

  step("connecting", "Connecting Cardano wallet...");
  var adaConn = await connectCardanoWalletCIP30();
  var adaAddress = adaConn.address;
  var adaApi     = adaConn.api;

  step("sending", "Fetching ADA price...");
  var adaPerUSD = 2.5; // safe fallback
  try {
    var priceRes  = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd");
    var priceData = await priceRes.json();
    var adaUSD    = priceData && priceData.cardano && priceData.cardano.usd;
    if (adaUSD && !isNaN(adaUSD)) adaPerUSD = 1 / adaUSD;
  } catch (e) { /* use fallback */ }

  var adaAmount = amountUSD * adaPerUSD;
  // Pure number math -- no BigInt needed
  var lovelace = Math.round(adaAmount * 1000000);

  step("sending", "Sending " + adaAmount.toFixed(4) + " ADA (~$" + amountUSD + ")...");

  var txHash;
  try {
    if (typeof adaApi.sendLovelace === "function") {
      txHash = await adaApi.sendLovelace(treasury, lovelace.toString());
    } else {
      var CardanoWasm = await import("@emurgo/cardano-serialization-lib-browser").catch(function () { return null; });
      if (!CardanoWasm) throw new Error("CSL not loaded. Use Manual mode.");
      var utxos = await adaApi.getUtxos();
      if (!utxos || !utxos.length) throw new Error("No UTXOs available in wallet.");
      var txBuilder = CardanoWasm.TransactionBuilder.new(
        CardanoWasm.TransactionBuilderConfigBuilder.new()
          .coins_per_utxo_word(CardanoWasm.BigNum.from_str("34482"))
          .min_fee_a(CardanoWasm.BigNum.from_str("44"))
          .min_fee_b(CardanoWasm.BigNum.from_str("155381"))
          .key_deposit(CardanoWasm.BigNum.from_str("2000000"))
          .pool_deposit(CardanoWasm.BigNum.from_str("500000000"))
          .max_tx_size(8000)
          .max_value_size(5000)
          .build()
      );
      txBuilder.add_output(
        CardanoWasm.TransactionOutput.new(
          CardanoWasm.Address.from_bech32(treasury),
          CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(lovelace.toString()))
        )
      );
      for (var j = 0; j < utxos.length; j++) {
        txBuilder.add_utxo(
          CardanoWasm.TransactionUnspentOutput.from_bytes(Buffer.from(utxos[j], "hex"))
        );
      }
      txBuilder.add_change_if_needed(CardanoWasm.Address.from_bech32(adaAddress));
      var txBodyBuilt   = txBuilder.build();
      var witnessSetNew = CardanoWasm.TransactionWitnessSet.new();
      var txUnsigned    = CardanoWasm.Transaction.new(txBodyBuilt, witnessSetNew);
      var signedHex     = await adaApi.signTx(Buffer.from(txUnsigned.to_bytes()).toString("hex"), true);
      var txSigned      = CardanoWasm.Transaction.new(
        txBodyBuilt,
        CardanoWasm.TransactionWitnessSet.from_bytes(Buffer.from(signedHex, "hex"))
      );
      txHash = await adaApi.submitTx(Buffer.from(txSigned.to_bytes()).toString("hex"));
    }
  } catch (e) {
    var errMsg = (e && e.message) || "Transaction failed.";
    if (errMsg.indexOf("Manual") !== -1) throw e;
    throw new Error(errMsg + " If this persists, use Manual mode.");
  }

  if (!txHash) throw new Error("No transaction hash returned. Use Manual mode.");
  step("confirming", "Verifying with server...");

  var adaIdempotencyKey = getOrCreateIdempotencyKey();
  var adaSession = await supabase.auth.getSession();
  var adaToken = adaSession.data && adaSession.data.session && adaSession.data.session.access_token;
  if (!adaToken) throw new Error("Not authenticated.");

  var adaResp = await fetch(
    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + adaToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        chainType: "CARDANO",
        chain: "cardano",
        txHash: txHash,
        claimedSenderWallet: adaAddress,
        productId: productId,
        idempotencyKey: adaIdempotencyKey,
        amountOverrideUSD: amountUSD,
      }),
    }
  );
  var adaResult = await adaResp.json();
  if (!adaResp.ok)
    throw new Error((adaResult && adaResult.error) || "Verification failed (" + adaResp.status + ").");
  clearIdempotencyKey();
  return { success: true, txHash: txHash, result: adaResult };
}

// --- Manual Web3 verification -------------------------------------------------
export async function verifyWeb3Payment({
  chainType, chain, txHash, claimedSenderWallet, productId, amountOverrideUSD, inviteCodeId,
}) {
  var idempotencyKey = getOrCreateIdempotencyKey();
  var sessionResult  = await supabase.auth.getSession();
  var token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
  if (!token) throw new Error("Not authenticated. Please sign in.");

  var body = {
    chainType: chainType,
    chain: chain,
    txHash: txHash.trim(),
    claimedSenderWallet: claimedSenderWallet.trim(),
    productId: productId,
    idempotencyKey: idempotencyKey,
  };
  if (amountOverrideUSD != null) body.amountOverrideUSD = amountOverrideUSD;
  if (inviteCodeId) body.inviteCodeId = inviteCodeId;

  var resp = await fetch(
    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/web3-verify-payment",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  var result = await resp.json();
  if (!resp.ok)
    throw new Error((result && result.error) || "Verification error (" + resp.status + ").");
  return result;
}

// --- Paystack -----------------------------------------------------------------
export async function createPaystackTransaction({ productId, amountUSD, inviteCodeId, email }) {
  var sessionResult = await supabase.auth.getSession();
  var token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
  if (!token) throw new Error("Not authenticated.");
  var resp = await fetch(
    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/create-paystack-transaction",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: productId,
        amountUSD: amountUSD,
        inviteCodeId: inviteCodeId,
        email: email,
      }),
    }
  );
  var result = await resp.json();
  if (!resp.ok) throw new Error((result && result.error) || "Paystack error.");
  return result;
}

// --- Free code activation -----------------------------------------------------
export async function activateFreeCode({ inviteCodeId, productId }) {
  var idempotencyKey = getOrCreateIdempotencyKey();
  var sessionResult  = await supabase.auth.getSession();
  var token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
  if (!token) throw new Error("Not authenticated.");
  var resp = await fetch(
    process.env.REACT_APP_SUPABASE_URL + "/functions/v1/activate-free-code",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCodeId: inviteCodeId,
        productId: productId,
        idempotencyKey: idempotencyKey,
      }),
    }
  );
  var result = await resp.json();
  if (!resp.ok) throw new Error((result && result.error) || "Activation failed.");
  clearIdempotencyKey();
  return result;
}