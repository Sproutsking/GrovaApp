// supabase/functions/web3-verify-payment/index.ts — v3 PRODUCTION FINAL
// ─────────────────────────────────────────────────────────────────────────────
//  CHANGES vs v2:
//  [1] SOLANA verification — RPC-based SPL token transfer validation
//  [2] CARDANO verification — Blockfrost UTxO validation + ADA/USD price
//  [3] Server-resolved invitation pricing; client prices are never trusted
//  [4] activateAccount sets payment_status="paid" so isPaidProfile() works
//  [5] All field names aligned: chainType, txHash, claimedSenderWallet
//  [6] Replay protection via UNIQUE(provider_payment_id) on payments table
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  supabaseAdmin,
  corsHeaders,
  jsonResponse,
  errorResponse,
  requireAuth,
  activateAccount,
  withRetry,
  validateEnv,
  resolvePaymentPrice,
} from "../_shared/payments.ts";

// ── EVM chains registry ───────────────────────────────────────────────────────
const EVM_CHAINS: Record<string, {
  chainId: number;
  rpcEnvKey: string;
  minConfirmations: number;
  stableTokens: Record<string, { address: string; decimals: number }>;
}> = {
  polygon:   { chainId: 137,   rpcEnvKey: "POLYGON_RPC_URL",   minConfirmations: 5,
    stableTokens: { USDT: { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6  }, USDC: { address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", decimals: 6  } } },
  base:      { chainId: 8453,  rpcEnvKey: "BASE_RPC_URL",      minConfirmations: 5,
    stableTokens: { USDT: { address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", decimals: 6  }, USDC: { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6  } } },
  arbitrum:  { chainId: 42161, rpcEnvKey: "ARBITRUM_RPC_URL",  minConfirmations: 5,
    stableTokens: { USDT: { address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6  }, USDC: { address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6  } } },
  optimism:  { chainId: 10,    rpcEnvKey: "OPTIMISM_RPC_URL",  minConfirmations: 5,
    stableTokens: { USDT: { address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", decimals: 6  }, USDC: { address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6  } } },
  ethereum:  { chainId: 1,     rpcEnvKey: "ETH_RPC_URL",       minConfirmations: 12,
    stableTokens: { USDT: { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6  }, USDC: { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6  } } },
  bnb:       { chainId: 56,    rpcEnvKey: "BSC_RPC_URL",       minConfirmations: 10,
    stableTokens: { USDT: { address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 }, USDC: { address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 } } },
  avalanche: { chainId: 43114, rpcEnvKey: "AVALANCHE_RPC_URL", minConfirmations: 5,
    stableTokens: { USDT: { address: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", decimals: 6  }, USDC: { address: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", decimals: 6  } } },
  zksync:    { chainId: 324,   rpcEnvKey: "ZKSYNC_RPC_URL",    minConfirmations: 5,
    stableTokens: { USDT: { address: "0x493257fd37edb34451f62edf8d2a0c418852ba4c", decimals: 6  }, USDC: { address: "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4", decimals: 6  } } },
  fantom:    { chainId: 250,   rpcEnvKey: "FANTOM_RPC_URL",    minConfirmations: 10,
    stableTokens: { USDT: { address: "0x049d68029688eabf473097a2fc38ef61633a3c7a", decimals: 6  }, USDC: { address: "0x04068da6c83afcfa0e13ba15a6696662335d5b75", decimals: 6  } } },
};

const AMOUNT_TOLERANCE = 0.02; // 2% slack
type FoundersCardAdaQuote = {
  id: string;
  adaUsd: number;
  lovelace: number;
  amountUsd: number;
  issuedAt: string;
  expiresAt: string;
};

// ── RPC helper ────────────────────────────────────────────────────────────────
async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status} from ${rpcUrl}`);
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

// ── EVM verification ──────────────────────────────────────────────────────────
async function verifyEVM(opts: {
  chain: string;
  txHash: string;
  senderWallet: string;
  expectedUSD: number;
  treasuryWallet: string;
  tolerance?: number;
}): Promise<{ ok: boolean; message: string; pendingConfirmations?: number }> {
  const { chain, txHash, senderWallet, expectedUSD, treasuryWallet } = opts;
  const cfg = EVM_CHAINS[chain.toLowerCase()];
  if (!cfg) return { ok: false, message: `Unsupported EVM chain: "${chain}"` };

  const rpcUrl = Deno.env.get(cfg.rpcEnvKey);
  if (!rpcUrl) return { ok: false, message: `${chain} RPC not configured. Contact support.` };

  // Parallel fetch: tx, receipt, latest block
  const [txRaw, receiptRaw, latestHex] = await Promise.all([
    rpcCall(rpcUrl, "eth_getTransactionByHash",  [txHash]),
    rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash]),
    rpcCall(rpcUrl, "eth_blockNumber",           []),
  ]);

  type EvmTx      = { from: string; blockNumber: string } | null;
  type EvmReceipt = { status: string; logs: { topics: string[]; data: string; address: string }[] } | null;

  const tx      = txRaw      as EvmTx;
  const receipt = receiptRaw as EvmReceipt;

  if (!tx)                         return { ok: false, message: "Transaction not found. It may still be propagating." };
  if (!receipt || receipt.status !== "0x1") return { ok: false, message: "Transaction failed or not yet mined." };

  // Sender check
  if (tx.from?.toLowerCase() !== senderWallet.toLowerCase()) {
    return { ok: false, message: `Sender mismatch: expected ${senderWallet}, got ${tx.from}` };
  }

  // Confirmation check
  const txBlock   = parseInt(tx.blockNumber, 16);
  const latest    = parseInt(latestHex as string, 16);
  const confirms  = latest - txBlock + 1;
  if (confirms < cfg.minConfirmations) {
    return {
      ok: false,
      message: `${confirms}/${cfg.minConfirmations} confirmations. Please wait a moment.`,
      pendingConfirmations: cfg.minConfirmations - confirms,
    };
  }

  // Decode ERC-20 Transfer log
  // Transfer(address indexed from, address indexed to, uint256 value)
  const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const fromPadded    = `0x000000000000000000000000${senderWallet.toLowerCase().replace("0x", "")}`;
  const toPadded     = `0x000000000000000000000000${treasuryWallet.toLowerCase().replace("0x", "")}`;
  const minAccept    = expectedUSD * (1 - (opts.tolerance ?? AMOUNT_TOLERANCE));

  for (const log of receipt.logs) {
    if (
      log.topics?.[0]?.toLowerCase() !== TRANSFER_SIG.toLowerCase() ||
      log.topics?.[1]?.toLowerCase() !== fromPadded.toLowerCase() ||
      log.topics?.[2]?.toLowerCase() !== toPadded.toLowerCase()
    ) continue;

    // Identify token
    const tokenAddr = log.address.toLowerCase();
    const token = Object.values(cfg.stableTokens).find(t => t.address.toLowerCase() === tokenAddr);
    if (!token) continue;

    const rawVal    = BigInt("0x" + (log.data.startsWith("0x") ? log.data.slice(2) : log.data));
    const sentUSD   = Number(rawVal) / Math.pow(10, token.decimals);

    if (sentUSD >= minAccept) return { ok: true, message: "EVM payment verified." };
    return { ok: false, message: `Insufficient amount. Expected ~$${expectedUSD}, received $${sentUSD.toFixed(2)}.` };
  }

  return { ok: false, message: "No matching stablecoin transfer to treasury wallet found in this transaction." };
}

// ── Solana verification ───────────────────────────────────────────────────────
async function verifySolana(opts: {
  txHash: string;
  senderWallet: string;
  expectedUSD: number;
  treasuryWallet: string;
  tolerance?: number;
}): Promise<{ ok: boolean; message: string }> {
  const { txHash, senderWallet, expectedUSD, treasuryWallet } = opts;
  const rpcUrl = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";

  const SOL_TOKENS = [
    { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  ];

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "getTransaction",
      params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" }],
    }),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const { result: tx } = await res.json() as { result: Record<string, unknown> | null };
  if (!tx) return { ok: false, message: "Solana transaction not found or not yet finalized." };

  const meta = tx.meta as Record<string, unknown> | null;
  if (meta?.err) return { ok: false, message: "Solana transaction failed on-chain." };

  type TokenBalance = { accountIndex: number; mint: string; uiTokenAmount: { uiAmount: number | null }; owner: string };
  const preBals  = (meta?.preTokenBalances  ?? []) as TokenBalance[];
  const postBals = (meta?.postTokenBalances ?? []) as TokenBalance[];

  const minAccept = expectedUSD * (1 - (opts.tolerance ?? AMOUNT_TOLERANCE));

  for (const token of SOL_TOKENS) {
    const treasuryPre  = preBals.find(b  => b.mint === token.mint && b.owner === treasuryWallet);
    const treasuryPost = postBals.find(b => b.mint === token.mint && b.owner === treasuryWallet);
    if (!treasuryPost) continue;

    const gained = (treasuryPost.uiTokenAmount?.uiAmount ?? 0) - (treasuryPre?.uiTokenAmount?.uiAmount ?? 0);
    if (gained < minAccept) {
      return { ok: false, message: `Insufficient ${token.symbol}. Expected ~$${expectedUSD}, treasury gained $${gained.toFixed(2)}.` };
    }

    type AccountKey = string | { pubkey: string; signer?: boolean };
    const message = (tx.transaction as { message?: { accountKeys?: AccountKey[] } } | undefined)?.message;
    const senderSigned = (message?.accountKeys ?? []).some((key) =>
      typeof key === "string"
        ? key === senderWallet
        : key.pubkey === senderWallet && key.signer === true
    );
    if (!senderSigned) {
      return { ok: false, message: "The linked sender wallet did not sign this Solana transaction." };
    }

    const senderPre  = preBals.find(b  => b.mint === token.mint && b.owner === senderWallet);
    const senderPost = postBals.find(b => b.mint === token.mint && b.owner === senderWallet);
    if (!senderPre || !senderPost) {
      return { ok: false, message: `Could not confirm a ${token.symbol} balance change for the linked sender wallet.` };
    }
    const sent = (senderPre.uiTokenAmount?.uiAmount ?? 0) - (senderPost.uiTokenAmount?.uiAmount ?? 0);
    if (sent < minAccept) {
      return { ok: false, message: `The linked sender wallet did not send enough ${token.symbol}.` };
    }

    return { ok: true, message: "Solana payment verified." };
  }

  return { ok: false, message: `No matching USDC/USDT transfer to treasury wallet found in this transaction.` };
}

// ── Cardano verification ──────────────────────────────────────────────────────
async function verifyCardano(opts: {
  txHash: string;
  senderWallet: string;
  expectedUSD: number;
  treasuryWallet: string;
  tolerance?: number;
  expectedLovelace?: number;
  quoteIssuedAt?: string;
  quoteExpiresAt?: string;
}): Promise<{ ok: boolean; message: string; pendingConfirmations?: number }> {
  const { txHash, senderWallet, expectedUSD, treasuryWallet } = opts;

  const blockfrostKey = Deno.env.get("BLOCKFROST_API_KEY");
  if (!blockfrostKey) {
    return { ok: false, message: "Cardano verification requires BLOCKFROST_API_KEY. Contact support." };
  }

  type Utxo = {
    inputs:  { address: string }[];
    outputs: { address: string; amount: { unit: string; quantity: string }[] }[];
  };

  const [utxoRes, transactionRes] = await Promise.all([
    fetch(`https://cardano-mainnet.blockfrost.io/api/v0/txs/${txHash}/utxos`, {
      headers: { "project_id": blockfrostKey },
    }),
    fetch(`https://cardano-mainnet.blockfrost.io/api/v0/txs/${txHash}`, {
      headers: { "project_id": blockfrostKey },
    }),
  ]);
  if (utxoRes.status === 404 || transactionRes.status === 404) {
    return {
      ok: false,
      message: "Cardano transaction not found. It may still be propagating.",
      pendingConfirmations: 1,
    };
  }
  if (!utxoRes.ok || !transactionRes.ok) {
    throw new Error(`Blockfrost HTTP ${!utxoRes.ok ? utxoRes.status : transactionRes.status}`);
  }

  const [utxo, transaction] = await Promise.all([
    utxoRes.json() as Promise<Utxo>,
    transactionRes.json() as Promise<{ block_time?: number }>,
  ]);

  // Verify sender is in inputs
  const senderMatch = utxo.inputs.some(i => i.address === senderWallet);
  if (!senderMatch) return { ok: false, message: "Sender address not found in transaction inputs." };

  if (opts.expectedLovelace != null) {
    const blockTime = transaction.block_time;
    const issuedAt = opts.quoteIssuedAt ? Date.parse(opts.quoteIssuedAt) : NaN;
    const expiresAt = opts.quoteExpiresAt ? Date.parse(opts.quoteExpiresAt) : NaN;
    const includedAt = typeof blockTime === "number" ? blockTime * 1000 : NaN;
    if (!Number.isFinite(includedAt) || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)
      || includedAt < issuedAt || includedAt > expiresAt) {
      return { ok: false, message: "The ADA payment was not included during its valid price quote." };
    }

    const treasuryLovelace = utxo.outputs
      .filter(output => output.address === treasuryWallet)
      .flatMap(output => output.amount)
      .filter(amount => amount.unit === "lovelace")
      .reduce((total, amount) => total + BigInt(amount.quantity), 0n);
    if (treasuryLovelace < BigInt(opts.expectedLovelace)) {
      return { ok: false, message: "The ADA payment is below the locked quote amount." };
    }
    return { ok: true, message: "Cardano payment verified against its locked ADA quote." };
  }

  // Find output to treasury
  const treasuryOut = utxo.outputs.find(o => o.address === treasuryWallet);
  if (!treasuryOut) return { ok: false, message: "Treasury address not found in transaction outputs." };

  const lovelace   = Number(treasuryOut.amount.find(a => a.unit === "lovelace")?.quantity ?? "0");
  const adaReceived = lovelace / 1_000_000;

  // Fetch live ADA/USD price
  try {
    const pr = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd");
    if (!pr.ok) throw new Error(`Price service returned HTTP ${pr.status}`);
    const pd = await pr.json() as { cardano?: { usd?: number } };
    const adaUSD = pd.cardano?.usd;
    if (typeof adaUSD !== "number" || !Number.isFinite(adaUSD) || adaUSD <= 0) {
      throw new Error("Price service returned an invalid ADA quote");
    }
    const usdReceived = adaReceived * adaUSD;
    const minAccept = expectedUSD * (1 - (opts.tolerance ?? AMOUNT_TOLERANCE));
    if (usdReceived < minAccept) {
      return {
        ok: false,
        message: `Insufficient ADA. Received ${adaReceived.toFixed(4)} ADA ≈ $${usdReceived.toFixed(2)} (@ $${adaUSD.toFixed(4)}/ADA). Expected ~$${expectedUSD}.`,
      };
    }
    return { ok: true, message: `Cardano payment verified at $${adaUSD.toFixed(4)}/ADA.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Could not obtain a reliable ADA price: ${error.message}` : "Could not obtain a reliable ADA price.",
    };
  }
}

// ── Main serve ────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // Env check first — turn "Invalid JWT" into a clear server error
  const envError = validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TREASURY_WALLET_ADDRESS"]);
  if (envError) return envError;

  // Auth
  let userId: string;
  try {
    ({ userId } = await requireAuth(req));
  } catch (e: unknown) {
    return errorResponse((e as Error).message, 401, "UNAUTHORIZED");
  }

  // Body
  let body: {
    action?: string;
    chainType?: string;
    chain?: string;
    txHash?: string;
    claimedSenderWallet?: string;
    productId?: string;
    founders_order_id?: string;
    idempotencyKey?: string;
    amountOverrideUSD?: number;
    inviteCodeId?: string;
    cryptoQuoteId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "BAD_REQUEST");
  }

  const {
    chainType, chain, txHash, claimedSenderWallet,
    productId, founders_order_id: foundersOrderId, idempotencyKey, inviteCodeId,
  } = body;
  const isAdaQuoteRequest = body.action === "founders_card_ada_quote";

  if (typeof chainType !== "string" || !["EVM", "SOLANA", "CARDANO"].includes(chainType.toUpperCase())) {
    return errorResponse("Missing or unsupported chainType (EVM | SOLANA | CARDANO)", 400, "UNSUPPORTED_CHAIN");
  }
  if (!isAdaQuoteRequest && (typeof txHash !== "string" || !txHash)) {
    return errorResponse("Missing or invalid txHash", 400, "MISSING_FIELD");
  }
  if (!isAdaQuoteRequest && (typeof claimedSenderWallet !== "string" || !claimedSenderWallet)) {
    return errorResponse("Missing or invalid claimedSenderWallet", 400, "MISSING_FIELD");
  }
  if (!isAdaQuoteRequest && (txHash!.length > 128 || claimedSenderWallet!.length > 256)) {
    return errorResponse("Transaction details exceed the allowed length.", 400, "INVALID_PAYMENT_DETAILS");
  }
  if ((!productId && !foundersOrderId) || typeof idempotencyKey !== "string") {
    return errorResponse("Missing productId or founders_order_id and idempotencyKey.", 400, "MISSING_FIELD");
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(idempotencyKey)
    || (productId != null && (typeof productId !== "string" || !UUID_RE.test(productId)))
    || (foundersOrderId != null && (typeof foundersOrderId !== "string" || !UUID_RE.test(foundersOrderId)))) {
    return errorResponse("Payment identifiers must be valid UUID v4 values.", 400, "INVALID_PAYMENT_DETAILS");
  }

  const db = supabaseAdmin();
  if (body.action === "founders_card_ada_quote") {
    if (chainType?.toUpperCase() !== "CARDANO" || chain?.toLowerCase() !== "cardano") {
      return errorResponse("An ADA quote requires the Cardano network.", 400, "INVALID_CHAIN");
    }
    if (productId != null || typeof foundersOrderId !== "string" || !UUID_RE.test(foundersOrderId)) {
      return errorResponse("A valid founders-card order is required for an ADA quote.", 400, "INVALID_ORDER");
    }

    const { error: expiryError } = await db.rpc("expire_founders_card_orders");
    if (expiryError) {
      console.error("[web3-verify-payment] Could not expire stale founders-card reservations:", expiryError.message);
      return errorResponse("Could not verify the card reservation. Please retry shortly.", 503, "RESERVATION_CHECK_FAILED");
    }

    const { data: order, error: orderError } = await db.from("founders_card_orders")
      .select("id,user_id,status,provider,total_price,currency,expires_at")
      .eq("id", foundersOrderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (orderError || !order) return errorResponse("Founders-card order not found.", 404, "ORDER_NOT_FOUND");
    if (order.status !== "pending" || order.provider !== "web3" || order.currency !== "USD"
      || new Date(order.expires_at) <= new Date()) {
      return errorResponse("This founders-card reservation is not available for an ADA quote.", 409, "ORDER_NOT_PAYABLE");
    }

    const { data: existingPayment, error: paymentLookupError } = await db.from("founders_card_payments")
      .select("id,provider_reference,status,metadata")
      .eq("order_id", order.id)
      .eq("provider", "web3")
      .maybeSingle();
    if (paymentLookupError) {
      console.error("[web3-verify-payment] Could not load the ADA quote record:", paymentLookupError.message);
      return errorResponse("Could not load the ADA quote. Please retry.", 503, "ADA_QUOTE_LOOKUP_FAILED");
    }
    if (existingPayment && (existingPayment.status !== "pending"
      || !existingPayment.provider_reference.startsWith("ada_quote:"))) {
      return errorResponse("A crypto payment is already being verified for this order.", 409, "PAYMENT_ALREADY_PENDING");
    }

    const storedMetadata = existingPayment?.metadata && typeof existingPayment.metadata === "object"
      ? existingPayment.metadata as Record<string, unknown>
      : {};
    const storedQuote = storedMetadata.ada_quote as {
      id?: string;
      adaUsd?: number;
      lovelace?: number;
      amountUsd?: number;
      issuedAt?: string;
      expiresAt?: string;
    } | undefined;
    if (storedQuote?.id && UUID_RE.test(storedQuote.id)
      && storedQuote.amountUsd === Number(order.total_price)
      && Number.isFinite(storedQuote.adaUsd) && Number(storedQuote.adaUsd) > 0
      && storedQuote.issuedAt && Number.isFinite(Date.parse(storedQuote.issuedAt))
      && storedQuote.expiresAt && Date.parse(storedQuote.expiresAt) > Date.parse(storedQuote.issuedAt)
      && Date.parse(storedQuote.expiresAt) > Date.now()
      && Number.isSafeInteger(storedQuote.lovelace) && Number(storedQuote.lovelace) > 0) {
      return jsonResponse({
        cryptoQuoteId: storedQuote.id,
        amountAda: Number(storedQuote.lovelace) / 1_000_000,
        lovelace: storedQuote.lovelace,
        adaUsd: storedQuote.adaUsd,
        expiresAt: storedQuote.expiresAt,
      });
    }

    let adaUsd: number;
    try {
      const priceResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd",
        { signal: AbortSignal.timeout(8000) },
      );
      if (!priceResponse.ok) throw new Error(`Price service returned HTTP ${priceResponse.status}`);
      const priceData = await priceResponse.json() as { cardano?: { usd?: number } };
      adaUsd = priceData.cardano?.usd ?? NaN;
      if (!Number.isFinite(adaUsd) || adaUsd <= 0) throw new Error("Price service returned an invalid ADA price.");
    } catch (quoteError) {
      console.error("[web3-verify-payment] Could not create ADA quote:", quoteError);
      return errorResponse("A reliable ADA price is temporarily unavailable. Please retry.", 503, "ADA_PRICE_UNAVAILABLE");
    }

    const amountUsd = Number(order.total_price);
    const lovelace = Math.ceil((amountUsd / adaUsd) * 1_000_000);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0 || !Number.isSafeInteger(lovelace) || lovelace <= 0) {
      return errorResponse("Could not calculate a safe ADA quote for this order.", 503, "ADA_QUOTE_INVALID");
    }
    const quoteId = crypto.randomUUID();
    const issuedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000);
    const quote = {
      id: quoteId,
      adaUsd,
      amountUsd,
      lovelace,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    const { error: quoteSaveError } = await db.from("founders_card_payments").upsert({
      ...(existingPayment?.id ? { id: existingPayment.id } : {}),
      order_id: order.id,
      provider: "web3",
      provider_reference: `ada_quote:${quoteId}`,
      amount_minor: Math.round(amountUsd * 100),
      currency: "USD",
      status: "pending",
      failure_reason: null,
      metadata: { payment_purpose: "founders_card_purchase", founders_order_id: order.id, ada_quote: quote },
    }, { onConflict: "order_id,provider" });
    if (quoteSaveError) {
      console.error("[web3-verify-payment] Could not store the ADA quote:", quoteSaveError.message);
      return errorResponse("Could not securely store the ADA quote. Please retry.", 503, "ADA_QUOTE_STORE_FAILED");
    }

    return jsonResponse({
      cryptoQuoteId: quoteId,
      amountAda: lovelace / 1_000_000,
      lovelace,
      adaUsd,
      expiresAt: expiresAt.toISOString(),
    });
  }

  if (foundersOrderId) {
    const { error: expiryError } = await db.rpc("expire_founders_card_orders");
    if (expiryError) {
      console.error("[web3-verify-payment] Could not expire stale founders-card reservations:", expiryError.message);
      return errorResponse("Could not verify the card reservation. Please retry shortly.", 503, "RESERVATION_CHECK_FAILED");
    }
  }

  // ── Idempotency: already completed? ─────────────────────────────────────────
  if (!foundersOrderId) {
    const { data: existingIntent, error: existingIntentError } = await db.from("payment_intents")
      .select("id,user_id,status,provider,product_id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingIntentError) {
      console.error("[web3-verify-payment] Could not check payment intent:", existingIntentError.message);
      return errorResponse("Could not verify the payment attempt. Please retry.", 503, "INTENT_LOOKUP_FAILED");
    }
    if (existingIntent && (
      existingIntent.user_id !== userId ||
      existingIntent.provider !== "web3" ||
      existingIntent.product_id !== productId
    )) {
      return errorResponse("This payment idempotency key is already associated with another payment.", 409, "IDEMPOTENCY_CONFLICT");
    }
    if (existingIntent?.status === "completed") {
      return jsonResponse({ status: "already_processed", message: "Payment already completed." });
    }
  }

  // ── Replay: tx already used? ─────────────────────────────────────────────────
  const { data: existingPayment, error: existingPaymentError } = await db.from("payments")
    .select("id,status,user_id")
    .eq("provider_payment_id", txHash)
    .maybeSingle();

  if (existingPaymentError) {
    console.error("[web3-verify-payment] Could not check transaction replay:", existingPaymentError.message);
    return errorResponse("Could not verify whether this transaction was already used. Please retry.", 503, "REPLAY_CHECK_FAILED");
  }
  if (existingPayment) {
    if (existingPayment.user_id !== userId) {
      return errorResponse("This transaction has already been used by another account.", 409, "TX_ALREADY_USED");
    }
    if (existingPayment.status === "completed") {
      return jsonResponse({ status: "already_processed", message: "Payment already completed." });
    }
  }

  let founderOrder: {
    id: string;
    user_id: string;
    tier: string;
    quantity: number;
    status: string;
    provider: string;
    total_price: number;
    currency: string;
    expires_at: string;
  } | null = null;
  let founderOrderExpired = false;
  let product: {
    id: string;
    amount_usd: number;
    tier: string | null;
    metadata: Record<string, unknown> | null;
  } | null = null;
  let expectedUSD: number;

  if (foundersOrderId) {
    const { data: order, error: orderErr } = await db
      .from("founders_card_orders")
      .select("id,user_id,tier,quantity,status,provider,total_price,currency,expires_at")
      .eq("id", foundersOrderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (orderErr || !order) return errorResponse("Founders-card order not found.", 404, "ORDER_NOT_FOUND");
    if (order.status === "paid") {
      return jsonResponse({ status: "already_processed", message: "Founders-card payment already completed." });
    }
    if (!["pending", "expired"].includes(order.status) || order.provider !== "web3"
      || order.currency !== "USD") {
      return errorResponse("This founders-card reservation is not available for crypto payment.", 409, "ORDER_NOT_PAYABLE");
    }
    founderOrder = order;
    founderOrderExpired = order.status === "expired" || new Date(order.expires_at) <= new Date();
    expectedUSD = Number(order.total_price);
  } else {
    const { data: paymentProduct, error: productError } = await db.from("payment_products")
      .select("id,amount_usd,tier,metadata")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle();
    if (productError) {
      console.error("[web3-verify-payment] Could not load payment product:", productError.message);
      return errorResponse("Could not load the payment product. Please retry.", 503, "PRODUCT_LOOKUP_FAILED");
    }
    if (!paymentProduct) return errorResponse("Product not found or inactive.", 404, "PRODUCT_NOT_FOUND");
    product = paymentProduct;
    try {
      const resolvedPrice = await resolvePaymentPrice(db, Number(paymentProduct.amount_usd), inviteCodeId);
      expectedUSD = resolvedPrice.amountUSD;
    } catch (priceError) {
      return errorResponse(
        priceError instanceof Error ? priceError.message : "Could not verify the payment price.",
        400,
        "INVALID_PAYMENT_PRICE",
      );
    }

  }

  if (typeof txHash !== "string" || !txHash
    || typeof claimedSenderWallet !== "string" || !claimedSenderWallet) {
    return errorResponse("Missing or invalid transaction details.", 400, "MISSING_FIELD");
  }

  const normalizedChainType = chainType.toUpperCase();
  const identityChain = normalizedChainType === "EVM"
    ? "ethereum"
    : normalizedChainType === "SOLANA"
      ? "solana"
      : "cardano";
  if (
    typeof chain !== "string" ||
    (normalizedChainType === "EVM" && !Object.prototype.hasOwnProperty.call(EVM_CHAINS, chain.toLowerCase())) ||
    (normalizedChainType === "SOLANA" && chain.toLowerCase() !== "solana") ||
    (normalizedChainType === "CARDANO" && chain.toLowerCase() !== "cardano")
  ) {
    return errorResponse("The selected payment network does not match the payment type.", 400, "INVALID_CHAIN");
  }
  if (normalizedChainType === "EVM" && (
    !/^0x[0-9a-f]{64}$/i.test(txHash) ||
    !/^0x[0-9a-f]{40}$/i.test(claimedSenderWallet)
  )) {
    return errorResponse("Provide a valid EVM transaction hash and sender wallet.", 400, "INVALID_PAYMENT_DETAILS");
  }
  if (normalizedChainType === "CARDANO" && !/^[0-9a-f]{64}$/i.test(txHash)) {
    return errorResponse("Provide a valid Cardano transaction hash.", 400, "INVALID_PAYMENT_DETAILS");
  }
  if (normalizedChainType === "SOLANA" && !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txHash)) {
    return errorResponse("Provide a valid Solana transaction signature.", 400, "INVALID_PAYMENT_DETAILS");
  }

  let linkedWalletQuery = db
    .from("identity_wallets")
    .select("id")
    .eq("user_id", userId)
    .eq("chain", identityChain);
  linkedWalletQuery = normalizedChainType === "EVM"
    ? linkedWalletQuery.eq("address_key", claimedSenderWallet.toLowerCase())
    : linkedWalletQuery.eq("address", claimedSenderWallet);
  const { data: linkedWallet, error: linkedWalletError } = await linkedWalletQuery.maybeSingle();
  if (linkedWalletError) {
    console.error("[web3-verify-payment] Could not verify linked payment wallet:", linkedWalletError.message);
    return errorResponse("Could not verify the linked wallet. Please retry.", 503, "WALLET_IDENTITY_CHECK_FAILED");
  }
  if (!linkedWallet) {
    return errorResponse("Link and verify the payment wallet to your Xeevia account before paying.", 403, "WALLET_NOT_LINKED");
  }

  if (!Number.isFinite(expectedUSD) || expectedUSD <= 0) {
    return errorResponse("This payment flow requires a positive server-verified price.", 400, "INVALID_AMOUNT");
  }

  const treasuryEVM = Deno.env.get("TREASURY_WALLET_ADDRESS") ?? "";
  const treasurySOL = Deno.env.get("TREASURY_WALLET_SOL")     ?? "";
  const treasuryADA = Deno.env.get("TREASURY_WALLET_ADA")     ?? "";

  let founderPaymentId: string | null = null;
  let founderAdaQuote: FoundersCardAdaQuote | null = null;
  if (founderOrder) {
    const amountMinor = Math.round(expectedUSD * 100);
    const { data: existingCardPayment, error: cardPaymentLookupError } = await db
      .from("founders_card_payments")
      .select("id,provider_reference,status,metadata")
      .eq("order_id", founderOrder.id)
      .eq("provider", "web3")
      .maybeSingle();
    if (cardPaymentLookupError) {
      return errorResponse("Could not load the founders-card crypto payment.", 500, "PAYMENT_LOOKUP_FAILED");
    }
    if (existingCardPayment?.status === "completed") {
      return jsonResponse({ status: "already_processed", message: "Founders-card payment already completed." });
    }
    if (existingCardPayment?.status === "refund_required") {
      return jsonResponse({
        status: "refund_required",
        message: "Payment was verified after the reservation expired. No card was issued; contact support with the transaction hash for a manual refund.",
        txHash,
      });
    }
    const storedMetadata = existingCardPayment?.metadata && typeof existingCardPayment.metadata === "object"
      ? existingCardPayment.metadata as Record<string, unknown>
      : {};
    const storedQuote = storedMetadata.ada_quote as FoundersCardAdaQuote | undefined;
    if (normalizedChainType === "CARDANO") {
      if (typeof body.cryptoQuoteId !== "string" || !UUID_RE.test(body.cryptoQuoteId)
        || !storedQuote || storedQuote.id !== body.cryptoQuoteId
        || storedQuote.amountUsd !== expectedUSD
        || !Number.isFinite(storedQuote.adaUsd) || storedQuote.adaUsd <= 0
        || !Number.isSafeInteger(storedQuote.lovelace) || storedQuote.lovelace <= 0
        || !storedQuote.issuedAt || !storedQuote.expiresAt
        || !Number.isFinite(Date.parse(storedQuote.issuedAt))
        || !Number.isFinite(Date.parse(storedQuote.expiresAt))) {
        return errorResponse("A valid server-issued ADA quote is required for founders-card payment.", 400, "ADA_QUOTE_REQUIRED");
      }
      founderAdaQuote = storedQuote;
    }
    const matchesAdaQuote = normalizedChainType === "CARDANO"
      && existingCardPayment?.provider_reference === `ada_quote:${body.cryptoQuoteId}`;
    if (["pending", "late_crypto_review"].includes(existingCardPayment?.status || "")
      && existingCardPayment?.provider_reference !== txHash
      && !matchesAdaQuote) {
      return errorResponse("A crypto transaction is already being verified for this order.", 409, "PAYMENT_ALREADY_PENDING");
    }

    if (!founderOrderExpired && (!existingCardPayment || existingCardPayment.status === "failed")) {
      const { data: policy, error: policyError } = await db
        .from("founders_card_policy")
        .select("reservation_hours")
        .eq("singleton", true)
        .maybeSingle();
      if (policyError || !policy) {
        console.error("[web3-verify-payment] Could not load founders-card reservation policy:", policyError?.message);
        return errorResponse("Could not load the card reservation policy.", 503, "POLICY_LOOKUP_FAILED");
      }

      const { data: updatedOrder, error: orderUpdateError } = await db
        .from("founders_card_orders")
        .update({
          expires_at: new Date(Date.now() + Number(policy.reservation_hours) * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", founderOrder.id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();
      if (orderUpdateError || !updatedOrder) {
        console.error("[web3-verify-payment] Could not refresh founders-card reservation expiry:", orderUpdateError?.message);
        return errorResponse("The card reservation expired before crypto verification could begin.", 409, "ORDER_EXPIRED");
      }
    }

    const paymentValues = {
      order_id: founderOrder.id,
      provider: "web3",
      provider_reference: txHash,
      amount_minor: amountMinor,
      currency: "USD",
      status: founderOrderExpired ? "late_crypto_review" : "pending",
      failure_reason: founderOrderExpired
        ? "Crypto payment is being verified after reservation expiry; a confirmed payment requires a manual refund."
        : null,
      metadata: {
        payment_purpose: "founders_card_purchase",
        founders_order_id: founderOrder.id,
        tier: founderOrder.tier,
        quantity: founderOrder.quantity,
        chainType,
        chain,
        claimedSenderWallet,
        ...(founderAdaQuote ? { ada_quote: founderAdaQuote } : {}),
      },
    };
    const { data: cardPayment, error: cardPaymentError } = matchesAdaQuote && existingCardPayment?.id
      ? await db.from("founders_card_payments")
        .update(paymentValues)
        .eq("id", existingCardPayment.id)
        .eq("provider_reference", `ada_quote:${body.cryptoQuoteId}`)
        .select("id")
        .maybeSingle()
      : await db.from("founders_card_payments")
        .upsert({
          ...(existingCardPayment?.id ? { id: existingCardPayment.id } : {}),
          ...paymentValues,
        }, { onConflict: "order_id,provider" })
        .select("id")
        .single();
    if (cardPaymentError || !cardPayment) {
      if (matchesAdaQuote && !cardPaymentError) {
        return errorResponse("The ADA quote is already being used for another transaction.", 409, "ADA_QUOTE_ALREADY_USED");
      }
      console.error("[web3-verify-payment] Founders-card payment record failed:", cardPaymentError?.message);
      return errorResponse("Could not record this founders-card crypto payment.", 500, "PAYMENT_RECORD_FAILED");
    }
    founderPaymentId = cardPayment.id;
  }

  // ── Create/upsert payment intent ──────────────────────────────────────────────
  const intentExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
  if (!founderOrder) {
    const { error: intentSaveError } = await db.from("payment_intents").upsert({
      idempotency_key: idempotencyKey,
      user_id: userId,
      product_id: productId,
      amount_cents: Math.round(expectedUSD * 100),
      currency: "USD",
      status: "created",
      expires_at: intentExpiry,
      provider: "web3",
      metadata: { chainType, chain, txHash, invite_code_id: inviteCodeId ?? null },
    }, { onConflict: "idempotency_key" });
    if (intentSaveError) {
      console.error("[web3-verify-payment] Could not store priced payment intent:", intentSaveError.message);
      return errorResponse("Could not safely record this payment attempt. Please retry.", 503, "INTENT_STORE_FAILED");
    }
  }

  // ── Create or update payment record ──────────────────────────────────────────
  let paymentId: string | null = existingPayment?.id ?? null;
  if (!founderOrder && !paymentId) {
    const { data: newPayment, error: paymentInsertError } = await db.from("payments").insert({
      user_id: userId,
      provider: "web3",
      provider_payment_id: txHash,
      status: "pending",
      amount_usd: expectedUSD,
      product_id: productId,
      chain: chain ?? null,
      wallet_address: claimedSenderWallet,
      created_at: new Date().toISOString(),
    }).select("id").single();
    if (paymentInsertError || !newPayment) {
      console.error("[web3-verify-payment] Could not record pending payment:", paymentInsertError?.message);
      return errorResponse("Could not safely record this payment attempt. Please retry.", 503, "PAYMENT_RECORD_FAILED");
    }
    paymentId = newPayment?.id ?? null;
  }

  // ── On-chain verification ─────────────────────────────────────────────────────
  let verifyResult: { ok: boolean; message: string; pendingConfirmations?: number };

  try {
    const upper = chainType.toUpperCase();
    const tolerance = founderOrder ? 0 : undefined;
    if (upper === "EVM") {
      if (!treasuryEVM) return errorResponse("EVM treasury wallet not configured. Contact support.", 500, "SERVER_MISCONFIGURED");
      verifyResult = await withRetry(() =>
        verifyEVM({ chain: chain ?? "", txHash, senderWallet: claimedSenderWallet, expectedUSD, treasuryWallet: treasuryEVM, tolerance })
      );
    } else if (upper === "SOLANA") {
      if (!treasurySOL) return errorResponse("SOL treasury wallet not configured. Contact support.", 500, "SERVER_MISCONFIGURED");
      verifyResult = await withRetry(() =>
        verifySolana({ txHash, senderWallet: claimedSenderWallet, expectedUSD, treasuryWallet: treasurySOL, tolerance })
      );
    } else if (upper === "CARDANO") {
      if (!treasuryADA) return errorResponse("ADA treasury wallet not configured. Contact support.", 500, "SERVER_MISCONFIGURED");
      verifyResult = await withRetry(() =>
        verifyCardano({
          txHash,
          senderWallet: claimedSenderWallet,
          expectedUSD,
          treasuryWallet: treasuryADA,
          tolerance,
          ...(founderAdaQuote ? {
            expectedLovelace: founderAdaQuote.lovelace,
            quoteIssuedAt: founderAdaQuote.issuedAt,
            quoteExpiresAt: founderAdaQuote.expiresAt,
          } : {}),
        })
      );
    } else {
      return errorResponse(`Unknown chainType: "${chainType}". Use EVM, SOLANA, or CARDANO.`, 400, "UNSUPPORTED_CHAIN");
    }
  } catch (e: unknown) {
    // RPC/network error — mark payment as pending for retry
    if (!founderOrder) {
      const { error: pendingUpdateError } = await db.from("payments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("provider_payment_id", txHash);
      if (pendingUpdateError) {
        console.error("[web3-verify-payment] Could not preserve pending payment after RPC failure:", pendingUpdateError.message);
      }
    }
    return errorResponse(`Verification RPC error: ${(e as Error).message}. Payment saved as pending — we'll retry.`, 503, "RPC_ERROR");
  }

  // ── Pending confirmations ─────────────────────────────────────────────────────
  if (!verifyResult.ok && verifyResult.pendingConfirmations !== undefined) {
    if (founderOrder && founderOrderExpired && founderPaymentId) {
      await db.from("founders_card_payments").update({
        status: "late_crypto_review",
        failure_reason: "Crypto transaction is awaiting confirmation after reservation expiry; refund manually if confirmed.",
      }).eq("id", founderPaymentId);
    } else if (!founderOrder) {
      const { error: pendingUpdateError } = await db.from("payments").update({
        status: "pending",
        block_confirmations: null,
        updated_at: new Date().toISOString(),
      }).eq("provider_payment_id", txHash);
      if (pendingUpdateError) {
        console.error("[web3-verify-payment] Could not update pending confirmation status:", pendingUpdateError.message);
      }
    }
    return jsonResponse({
      status: "pending",
      message: verifyResult.message,
      pending_confirmations: verifyResult.pendingConfirmations,
    }, 202);
  }

  // ── Verification failed ───────────────────────────────────────────────────────
  if (!verifyResult.ok) {
    if (founderOrder && founderPaymentId) {
      await db.from("founders_card_payments")
        .update({ status: "failed", failure_reason: verifyResult.message })
        .eq("id", founderPaymentId);
    } else {
      const { error: failedUpdateError } = await db.from("payments").update({
        status: "failed",
        failure_reason: verifyResult.message,
        updated_at: new Date().toISOString(),
      }).eq("provider_payment_id", txHash);
      if (failedUpdateError) {
        console.error("[web3-verify-payment] Could not mark failed crypto payment:", failedUpdateError.message);
      }
    }
    return errorResponse(verifyResult.message, 400, "VERIFICATION_FAILED");
  }

  const paymentPurpose = founderOrder ? "founders_card" : "product";
  const claimReference = founderOrder
    ? founderOrder.id
    : `${productId}:${idempotencyKey}`;
  const { data: transactionClaimed, error: transactionClaimError } = await db.rpc(
    "claim_web3_payment",
    {
      p_chain: `${String(chainType).toLowerCase()}:${String(chain || "").toLowerCase()}`,
      p_tx_hash: txHash,
      p_user_id: userId,
      p_payment_purpose: paymentPurpose,
      p_reference_id: claimReference,
    },
  );
  if (transactionClaimError) {
    console.error("[web3-verify-payment] Could not claim verified transaction:", transactionClaimError.message);
    return errorResponse("Could not safely finalize this transaction. Please retry shortly.", 503, "TRANSACTION_CLAIM_FAILED");
  }
  if (!transactionClaimed) {
    if (founderPaymentId) {
      const { error: paymentUpdateError } = await db.from("founders_card_payments")
        .update({
          status: "failed",
          failure_reason: "This transaction has already been claimed for another payment.",
        })
        .eq("id", founderPaymentId)
        .in("status", ["pending", "late_crypto_review"]);
      if (paymentUpdateError) {
        console.error("[web3-verify-payment] Could not release conflicting card payment attempt:", paymentUpdateError.message);
        return errorResponse("This transaction was already claimed, but the order status could not be updated. Contact support.", 500, "PAYMENT_CONFLICT_UPDATE_FAILED");
      }
    }
    return errorResponse("This blockchain transaction has already been used for another payment.", 409, "TX_ALREADY_CLAIMED");
  }

  if (founderOrder) {
    if (founderOrderExpired) {
      if (!founderPaymentId) {
        return errorResponse("Could not locate the late crypto payment record. Contact support with the transaction hash.", 500, "LATE_PAYMENT_RECORD_MISSING");
      }
      const { error: refundFlagError } = await db
        .from("founders_card_payments")
        .update({
          status: "refund_required",
          failure_reason: "Crypto payment verified after reservation expiry; manual refund required.",
        })
        .eq("id", founderPaymentId);
      if (refundFlagError) {
        console.error("[web3-verify-payment] Could not flag late founders-card payment:", refundFlagError.message);
        return errorResponse("Payment verified after reservation expiry, but support status could not be recorded. Contact support with the transaction hash.", 500, "LATE_PAYMENT_RECORD_FAILED");
      }
      return jsonResponse({
        status: "refund_required",
        message: "Payment was verified after the reservation expired. No card was issued; contact support with the transaction hash for a manual refund.",
        txHash,
      });
    }
    const { error: settleError } = await db.rpc("settle_founders_card_order", {
      p_order_id: founderOrder.id,
      p_provider: "web3",
      p_provider_reference: txHash,
      p_amount_minor: Math.round(expectedUSD * 100),
      p_currency: "USD",
    });
    if (settleError) {
      console.error("[web3-verify-payment] Founders-card settlement failed:", settleError.message);
      return errorResponse("Crypto payment was verified but the card could not be issued. Contact support with the transaction hash.", 500, "CARD_SETTLEMENT_FAILED");
    }
    return jsonResponse({
      status: "success",
      message: "Crypto payment verified and founders card issued.",
      txHash,
    });
  }

  // ── Verification passed — activate account ────────────────────────────────────
  try {
    await withRetry(() => activateAccount(userId, product?.tier ?? "standard", product?.metadata ?? {}));
  } catch (e: unknown) {
    return errorResponse(
      `Payment verified but activation failed: ${(e as Error).message}. Contact support with TX: ${txHash}`,
      500, "ACTIVATION_FAILED"
    );
  }

  // ── Mark payment completed ────────────────────────────────────────────────────
  const { error: paymentCompleteError } = await db.from("payments").update({
    status: "completed",
    updated_at: new Date().toISOString(),
  }).eq("provider_payment_id", txHash);
  if (paymentCompleteError) {
    console.error("[web3-verify-payment] Could not mark payment complete:", paymentCompleteError.message);
    return errorResponse("Payment was verified and account activation completed, but payment status could not be saved. Contact support.", 500, "PAYMENT_STATUS_UPDATE_FAILED");
  }

  // ── Mark intent completed ─────────────────────────────────────────────────────
  const { error: intentCompleteError } = await db.from("payment_intents").update({
    status: "completed",
    payment_id: paymentId,
    updated_at: new Date().toISOString(),
  }).eq("idempotency_key", idempotencyKey).eq("user_id", userId);
  if (intentCompleteError) {
    console.error("[web3-verify-payment] Could not mark payment intent complete:", intentCompleteError.message);
    return errorResponse("Payment was verified and account activation completed, but the payment record needs reconciliation.", 500, "INTENT_STATUS_UPDATE_FAILED");
  }

  // ── Increment invite code uses ────────────────────────────────────────────────
  if (inviteCodeId) {
    const { error: inviteUseError } = await db.rpc("increment_invite_uses", { p_invite_id: inviteCodeId });
    if (inviteUseError) {
      console.error("[web3-verify-payment] Invite code usage count could not be updated:", inviteUseError.message);
    }
  }

  // ── Grant EP if product metadata has ep_grant ─────────────────────────────────
  // (already handled inside activateAccount — no duplicate grant needed)

  return jsonResponse({
    status: "success",
    message: "Payment verified. Account activated.",
    tier: product?.tier ?? "standard",
    txHash,
  });
});