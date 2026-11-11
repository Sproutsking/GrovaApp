import { verifyMessage, type Address, type Hex } from "npm:viem@2.55.13";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  supabaseAdmin,
  corsHeaders,
  jsonResponse,
  errorResponse,
  requireAuth,
} from "../_shared/payments.ts";
import {
  parseAddress as parseCardanoAddress,
  verifyCip8Signature,
} from "../cardano-auth/verification.ts";
import {
  decodeBase58,
  DepositAsset,
  DepositChainType,
  EVM_DEPOSIT_CHAINS,
  ERC20_TRANSFER_TOPIC,
  isValidRequestedUsdAmount,
  meetsRequestedDepositAmount,
  minimumAssetAmount,
  normalizeDepositTransactionHash,
  normalizeWalletAddress,
  rawAmountToNumber,
  SOLANA_TOKENS,
} from "./verification.ts";

const encoder = new TextEncoder();
const MIN_DEPOSIT_USD = 1;
const EP_PER_USD = 100;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CHALLENGES_PER_USER = 10;

type RequestBody = {
  action?: "challenge" | "verify" | "quote";
  chainType?: string;
  chain?: string;
  asset?: string;
  walletAddress?: string;
  requestedUsdAmount?: number;
  challengeId?: string;
  signature?: string;
  cardanoKey?: string;
  cardanoSignature?: string;
  txHash?: string;
};

type Challenge = {
  id: string;
  user_id: string;
  chain_type: DepositChainType;
  chain_name: string;
  asset_symbol: DepositAsset;
  wallet_address: string;
  requested_usd_amount: number;
  message: string;
  expires_at: string;
  consumed_at: string | null;
};

type VerificationResult = {
  assetAmount: number;
  usdAmount: number;
  walletAddress: string;
  confirmations: number;
  metadata: Record<string, unknown>;
};

type LiveMarketQuote = {
  unitPriceUsd: number;
  unitPriceNgn: number;
  priceChange24hPercent: number;
  quotedAt: string;
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestError(`${label} is required.`);
  }
  return value.trim();
}

function getChainDetails(chainType: DepositChainType, chain: string, asset: DepositAsset) {
  if (chainType === "EVM") {
    const config = EVM_DEPOSIT_CHAINS[chain];
    if (!config || (asset !== "USDC" && asset !== "USDT")) {
      throw new RequestError("Unsupported EVM network or stablecoin.");
    }
    return {
      tokenAddress: config.tokens[asset].address,
      treasuryAddress: Deno.env.get("TREASURY_WALLET_EVM") ??
        Deno.env.get("TREASURY_WALLET_ADDRESS"),
      chainId: config.chainId,
    };
  }

  if (chainType === "SOLANA") {
    if (chain !== "solana" || !(asset in SOLANA_TOKENS) || asset === "ADA") {
      throw new RequestError("Unsupported Solana stablecoin.");
    }
    return {
      tokenAddress: SOLANA_TOKENS[asset].mint,
      treasuryAddress: Deno.env.get("TREASURY_WALLET_SOL"),
      chainId: null,
    };
  }

  if (chainType === "CARDANO") {
    if (chain !== "cardano" || asset !== "ADA") {
      throw new RequestError("Only ADA is supported on Cardano.");
    }
    return {
      tokenAddress: null,
      treasuryAddress: Deno.env.get("TREASURY_WALLET_ADA"),
      chainId: null,
    };
  }

  throw new RequestError("Unsupported deposit network.");
}

function parseSelection(body: RequestBody) {
  const chainType = requireText(body.chainType, "Network type").toUpperCase();
  const chain = requireText(body.chain, "Network").toLowerCase();
  const asset = requireText(body.asset, "Asset").toUpperCase();

  if (
    chainType !== "EVM" && chainType !== "SOLANA" && chainType !== "CARDANO"
  ) {
    throw new RequestError("Unsupported deposit network.");
  }
  if (asset !== "USDC" && asset !== "USDT" && asset !== "ADA") {
    throw new RequestError("Unsupported deposit asset.");
  }

  return {
    chainType: chainType as DepositChainType,
    chain,
    asset: asset as DepositAsset,
  };
}

const MARKET_ASSET_IDS: Record<DepositAsset, string> = {
  USDC: "usd-coin",
  USDT: "tether",
  ADA: "cardano",
};

async function fetchLiveMarketQuote(asset: DepositAsset): Promise<LiveMarketQuote> {
  const assetId = MARKET_ASSET_IDS[asset];
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${assetId}&vs_currencies=usd%2Cngn&include_24hr_change=true&include_last_updated_at=true`,
    { signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) throw new Error(`Live ${asset} market quote returned HTTP ${response.status}.`);
  const priceData = await response.json() as Record<string, {
    usd?: number;
    ngn?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  }>;
  const quote = priceData[assetId];
  const timestamp = Number(quote?.last_updated_at);
  const quoteAge = Date.now() - timestamp * 1000;
  if (
    !Number.isFinite(timestamp) || timestamp <= 0 ||
    quoteAge < -5 * 60 * 1000 || quoteAge > 24 * 60 * 60 * 1000
  ) {
    throw new Error(`Live ${asset} quote is missing or older than 24 hours.`);
  }
  if (
    !Number.isFinite(quote?.usd) || !quote.usd || quote.usd <= 0 ||
    !Number.isFinite(quote?.ngn) || !quote.ngn || quote.ngn <= 0 ||
    !Number.isFinite(quote?.usd_24h_change)
  ) {
    throw new Error(`Live ${asset}/USD and ${asset}/NGN market data is temporarily unavailable.`);
  }
  return {
    unitPriceUsd: quote.usd,
    unitPriceNgn: quote.ngn,
    priceChange24hPercent: quote.usd_24h_change,
    quotedAt: new Date(timestamp * 1000).toISOString(),
  };
}

async function getDepositQuote(body: RequestBody) {
  const { chainType, chain, asset } = parseSelection(body);
  getChainDetails(chainType, chain, asset);
  const marketQuote = await fetchLiveMarketQuote(asset);
  const unitPriceUsd = marketQuote.unitPriceUsd;
  const decimals = chainType === "EVM"
    ? EVM_DEPOSIT_CHAINS[chain].tokens[asset as "USDC" | "USDT"].decimals
    : 6;
  return {
    minimumUsdAmount: MIN_DEPOSIT_USD,
    unitPriceUsd,
    unitPriceNgn: marketQuote.unitPriceNgn,
    priceChange24hPercent: marketQuote.priceChange24hPercent,
    quotedAt: marketQuote.quotedAt,
    quoteProvider: "CoinGecko",
    minimumAssetAmount: minimumAssetAmount(MIN_DEPOSIT_USD, unitPriceUsd, decimals),
  };
}

function validateTreasury(
  chainType: DepositChainType,
  treasuryAddress: string | undefined,
): string {
  if (!treasuryAddress) {
    throw new RequestError("This deposit network is not configured. Contact support.", 503);
  }
  if (chainType === "EVM" && !/^0x[0-9a-f]{40}$/i.test(treasuryAddress)) {
    throw new RequestError("EVM deposit address is misconfigured. Contact support.", 503);
  }
  if (chainType === "SOLANA" && decodeBase58(treasuryAddress).length !== 32) {
    throw new RequestError("Solana deposit address is misconfigured. Contact support.", 503);
  }
  if (chainType === "CARDANO" && !treasuryAddress.startsWith("addr1")) {
    throw new RequestError("Cardano deposit address is misconfigured. Contact support.", 503);
  }
  return treasuryAddress;
}

async function createChallenge(
  userId: string,
  body: RequestBody,
) {
  const { chainType, chain, asset } = parseSelection(body);
  const rawWalletAddress = requireText(body.walletAddress, "Wallet address");
  const requestedUsdAmount = Number(body.requestedUsdAmount);
  if (!isValidRequestedUsdAmount(requestedUsdAmount)) {
    if (!Number.isFinite(requestedUsdAmount) || requestedUsdAmount < MIN_DEPOSIT_USD) {
      throw new RequestError(`Enter a deposit amount of at least $${MIN_DEPOSIT_USD}.`);
    }
    if (requestedUsdAmount > 1_000_000) {
      throw new RequestError("The requested deposit amount is above the supported limit.");
    }
    throw new RequestError("Enter the requested deposit amount to no more than 2 decimal places.");
  }
  let walletAddress = normalizeWalletAddress(chainType, chain, rawWalletAddress);
  if (chainType === "CARDANO") {
    const parsed = parseCardanoAddress(rawWalletAddress);
    if (parsed.networkId !== 1) {
      throw new RequestError("Only Cardano mainnet wallets are supported.");
    }
    walletAddress = parsed.canonicalAddress;
  }

  const details = getChainDetails(chainType, chain, asset);
  const treasuryAddress = validateTreasury(chainType, details.treasuryAddress);
  const now = Date.now();
  const expiresAt = new Date(now + CHALLENGE_TTL_MS).toISOString();
  const challengeId = crypto.randomUUID();
  const message = [
    "Xeevia Web3 Deposit Wallet Proof",
    `User: ${userId}`,
    `Wallet: ${walletAddress}`,
    `Network: ${chainType}:${chain}`,
    `Asset: ${asset}`,
    `Minimum USD value: ${requestedUsdAmount.toFixed(2)}`,
    `Nonce: ${crypto.randomUUID()}`,
    `Expires: ${expiresAt}`,
    "",
    "Signing proves control of this wallet for this deposit. It does not submit a transaction or authorize a transfer.",
  ].join("\n");

  const admin = supabaseAdmin();
  const cleanup = await admin.from("web3_wallet_deposit_challenges")
    .delete()
    .lt("expires_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
  if (cleanup.error) throw new Error(`Could not clean expired deposit proofs: ${cleanup.error.message}`);

  const { count, error: countError } = await admin
    .from("web3_wallet_deposit_challenges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(now - 10 * 60 * 1000).toISOString());
  if (countError) throw new Error(`Could not check deposit proof rate limit: ${countError.message}`);
  if ((count ?? 0) >= MAX_CHALLENGES_PER_USER) {
    throw new RequestError("Too many deposit proof requests. Please wait a few minutes.", 429);
  }

  const { error: insertError } = await admin
    .from("web3_wallet_deposit_challenges")
    .insert({
      id: challengeId,
      user_id: userId,
      chain_type: chainType,
      chain_name: chain,
      asset_symbol: asset,
      wallet_address: walletAddress,
      requested_usd_amount: requestedUsdAmount,
      message,
      expires_at: expiresAt,
    });
  if (insertError) throw new Error(`Could not create deposit wallet proof: ${insertError.message}`);

  return {
    challengeId,
    message,
    expiresAt,
    walletAddress,
    treasuryAddress,
    tokenAddress: details.tokenAddress,
    chainId: details.chainId,
  };
}

function decodeHex(value: string, label: string, expectedBytes?: number): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new RequestError(`${label} must be a hexadecimal value.`);
  }
  const bytes = new Uint8Array(value.length / 2);
  if (expectedBytes !== undefined && bytes.length !== expectedBytes) {
    throw new RequestError(`${label} has an invalid length.`);
  }
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyWalletProof(
  challenge: Challenge,
  body: RequestBody,
): Promise<void> {
  const rawWalletAddress = requireText(body.walletAddress, "Wallet address");
  const chainType = challenge.chain_type;
  const chain = challenge.chain_name;
  const walletAddress = normalizeWalletAddress(chainType, chain, rawWalletAddress);
  if (chainType === "CARDANO") {
    const parsed = parseCardanoAddress(rawWalletAddress);
    if (
      parsed.networkId !== 1 ||
      parsed.canonicalAddress !== challenge.wallet_address
    ) {
      throw new RequestError("Wallet proof does not match the deposit challenge.", 401);
    }

    const key = requireText(body.cardanoKey, "Cardano signing key");
    const signature = requireText(body.cardanoSignature, "Cardano signature");
    const valid = await verifyCip8Signature(
      parsed.bytes,
      challenge.message,
      key,
      signature,
      parsed.paymentKeyHash,
    );
    if (!valid) throw new RequestError("Cardano wallet signature is invalid.", 401);
    return;
  }

  if (walletAddress !== challenge.wallet_address) {
    throw new RequestError("Wallet proof does not match the deposit challenge.", 401);
  }

  const signature = requireText(body.signature, "Wallet signature");
  if (chainType === "EVM") {
    if (!/^0x[0-9a-f]{130}$/i.test(signature)) {
      throw new RequestError("EVM wallet signature has an invalid format.", 401);
    }
    const valid = await verifyMessage({
      address: challenge.wallet_address as Address,
      message: challenge.message,
      signature: signature as Hex,
    });
    if (!valid) throw new RequestError("EVM wallet signature is invalid.", 401);
    return;
  }

  const publicKey = decodeBase58(walletAddress);
  const signatureBytes = decodeHex(signature, "Solana wallet signature", 64);
  try {
    const publicKeyBuffer = new Uint8Array(publicKey).buffer;
    const signatureBuffer = new Uint8Array(signatureBytes).buffer;
    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBuffer,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "Ed25519",
      key,
      signatureBuffer,
      encoder.encode(challenge.message),
    );
    if (!valid) throw new RequestError("Solana wallet signature is invalid.", 401);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Solana wallet signature could not be verified.", 401);
  }
}

type RpcEnvelope<T> = { result?: T | null; error?: { message?: string } };

async function evmRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<T | null> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`EVM RPC returned HTTP ${response.status}.`);
  const payload = await response.json() as RpcEnvelope<T>;
  if (payload.error) throw new Error("EVM RPC request failed.");
  return payload.result ?? null;
}

async function verifyEvmDeposit(
  challenge: Challenge,
  txHash: string,
): Promise<VerificationResult | "pending"> {
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) {
    throw new RequestError("Enter a valid EVM transaction hash.");
  }
  const chain = EVM_DEPOSIT_CHAINS[challenge.chain_name];
  if (!chain) throw new RequestError("Unsupported EVM network.");
  const rpcUrl = Deno.env.get(chain.rpcEnvKey);
  if (!rpcUrl) throw new RequestError(`${challenge.chain_name} verification is not configured. Contact support.`, 503);

  type Transaction = { from: string; blockNumber: string | null; chainId?: string | null };
  type Log = { address: string; topics: string[]; data: string };
  type Receipt = { status: string; blockNumber: string; logs: Log[] };
  const [rpcChainId, tx, receipt, latestBlock] = await Promise.all([
    evmRpc<string>(rpcUrl, "eth_chainId", []),
    evmRpc<Transaction>(rpcUrl, "eth_getTransactionByHash", [txHash]),
    evmRpc<Receipt>(rpcUrl, "eth_getTransactionReceipt", [txHash]),
    evmRpc<string>(rpcUrl, "eth_blockNumber", []),
  ]);
  if (!rpcChainId || Number.parseInt(rpcChainId, 16) !== chain.chainId) {
    throw new Error("Configured EVM RPC does not match the selected network.");
  }
  if (!tx || !receipt || !latestBlock) return "pending";
  if (receipt.status !== "0x1") throw new RequestError("The transaction failed on-chain.");

  const walletAddress = challenge.wallet_address.toLowerCase();
  if (tx.from?.toLowerCase() !== walletAddress) {
    throw new RequestError("The transaction sender does not match the signed wallet.");
  }
  if (tx.chainId && Number.parseInt(tx.chainId, 16) !== chain.chainId) {
    throw new RequestError("The transaction was submitted on a different network.");
  }

  const transactionBlock = Number.parseInt(receipt.blockNumber, 16);
  const currentBlock = Number.parseInt(latestBlock, 16);
  if (!Number.isSafeInteger(transactionBlock) || !Number.isSafeInteger(currentBlock)) {
    throw new Error("EVM RPC returned an invalid block number.");
  }
  const confirmations = currentBlock - transactionBlock + 1;
  if (confirmations < chain.minConfirmations) return "pending";

  const asset = challenge.asset_symbol as "USDC" | "USDT";
  const token = chain.tokens[asset];
  const treasury = validateTreasury(
    "EVM",
    Deno.env.get("TREASURY_WALLET_EVM") ?? Deno.env.get("TREASURY_WALLET_ADDRESS"),
  ).toLowerCase();
  const senderTopic = `0x${walletAddress.slice(2).padStart(64, "0")}`;
  const recipientTopic = `0x${treasury.slice(2).padStart(64, "0")}`;
  let rawReceived = 0n;

  for (const log of receipt.logs ?? []) {
    if (
      log.address?.toLowerCase() !== token.address.toLowerCase() ||
      log.topics?.[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC ||
      log.topics?.[1]?.toLowerCase() !== senderTopic ||
      log.topics?.[2]?.toLowerCase() !== recipientTopic ||
      !/^0x[0-9a-f]+$/i.test(log.data)
    ) continue;
    rawReceived += BigInt(log.data);
  }

  const assetAmount = rawAmountToNumber(rawReceived, token.decimals);
  const marketQuote = await fetchLiveMarketQuote(asset);
  return {
    assetAmount,
    usdAmount: assetAmount * marketQuote.unitPriceUsd,
    walletAddress,
    confirmations,
    metadata: {
      chain_id: chain.chainId,
      confirmations,
      token_address: token.address,
      unit_price_usd: marketQuote.unitPriceUsd,
      unit_price_ngn: marketQuote.unitPriceNgn,
      price_change_24h_percent: marketQuote.priceChange24hPercent,
      price_quoted_at: marketQuote.quotedAt,
      quote_provider: "CoinGecko",
    },
  };
}

async function verifySolanaDeposit(
  challenge: Challenge,
  txHash: string,
): Promise<VerificationResult | "pending"> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txHash)) {
    throw new RequestError("Enter a valid Solana transaction signature.");
  }
  const rpcUrl = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.mainnet-beta.solana.com";
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Solana RPC returned HTTP ${response.status}.`);
  const payload = await response.json() as RpcEnvelope<Record<string, unknown>>;
  if (payload.error) throw new Error("Solana RPC request failed.");
  if (!payload.result) return "pending";

  const tx = payload.result;
  const meta = tx.meta as Record<string, unknown> | null;
  if (!meta || meta.err) throw new RequestError("The Solana transaction failed on-chain.");

  const transaction = tx.transaction as Record<string, unknown>;
  const signatures = transaction.signatures as string[] | undefined;
  if (signatures?.[0] !== txHash) throw new RequestError("Solana transaction signature mismatch.");

  const message = transaction.message as Record<string, unknown>;
  const accountKeys = message.accountKeys as Array<string | { pubkey: string; signer?: boolean }> | undefined;
  const signerMatches = (accountKeys ?? []).some((key) =>
    typeof key !== "string" &&
    key.pubkey === challenge.wallet_address &&
    key.signer === true
  );
  if (!signerMatches) throw new RequestError("The signed wallet did not authorize this Solana transaction.");

  type TokenBalance = {
    accountIndex: number;
    mint: string;
    owner?: string;
    uiTokenAmount: { amount: string };
  };
  const pre = (meta.preTokenBalances ?? []) as TokenBalance[];
  const post = (meta.postTokenBalances ?? []) as TokenBalance[];
  const mint = SOLANA_TOKENS[challenge.asset_symbol as "USDC" | "USDT"].mint;
  const tokenDelta = (owner: string) => {
    const balances = new Map<number, bigint>();
    for (const row of pre) {
      if (row.mint === mint && row.owner === owner) {
        balances.set(row.accountIndex, BigInt(row.uiTokenAmount.amount) * -1n);
      }
    }
    for (const row of post) {
      if (row.mint === mint && row.owner === owner) {
        balances.set(
          row.accountIndex,
          (balances.get(row.accountIndex) ?? 0n) + BigInt(row.uiTokenAmount.amount),
        );
      }
    }
    return [...balances.values()].reduce((sum, amount) => sum + amount, 0n);
  };

  const gained = tokenDelta(validateTreasury("SOLANA", Deno.env.get("TREASURY_WALLET_SOL")));
  const senderChange = tokenDelta(challenge.wallet_address);
  if (gained <= 0n || senderChange >= 0n) {
    throw new RequestError("No matching stablecoin transfer from this wallet to the treasury was found.");
  }

  const assetAmount = rawAmountToNumber(gained, SOLANA_TOKENS[challenge.asset_symbol as "USDC" | "USDT"].decimals);
  const marketQuote = await fetchLiveMarketQuote(challenge.asset_symbol);
  return {
    assetAmount,
    usdAmount: assetAmount * marketQuote.unitPriceUsd,
    walletAddress: challenge.wallet_address,
    confirmations: 1,
    metadata: {
      mint,
      commitment: "finalized",
      unit_price_usd: marketQuote.unitPriceUsd,
      unit_price_ngn: marketQuote.unitPriceNgn,
      price_change_24h_percent: marketQuote.priceChange24hPercent,
      price_quoted_at: marketQuote.quotedAt,
      quote_provider: "CoinGecko",
    },
  };
}

async function cardanoRequest<T>(path: string): Promise<T> {
  const apiKey = Deno.env.get("BLOCKFROST_API_KEY");
  if (!apiKey) throw new RequestError("Cardano verification is not configured. Contact support.", 503);
  const response = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/${path}`, {
    headers: { project_id: apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    if (response.status === 404) throw new RequestError("Cardano transaction was not found yet.", 202);
    throw new Error(`Cardano verification provider returned HTTP ${response.status}.`);
  }
  return await response.json() as T;
}

async function verifyCardanoDeposit(
  challenge: Challenge,
  txHash: string,
): Promise<VerificationResult | "pending"> {
  if (!/^[0-9a-f]{64}$/i.test(txHash)) {
    throw new RequestError("Enter a valid Cardano transaction hash.");
  }
  const walletAddress = challenge.wallet_address;
  const treasury = validateTreasury("CARDANO", Deno.env.get("TREASURY_WALLET_ADA"));

  type Amount = { unit: string; quantity: string };
  type Utxos = {
    inputs: { address: string; amount: Amount[] }[];
    outputs: { address: string; amount: Amount[] }[];
  };
  type TxInfo = { block_height: number };
  type BlockInfo = { height: number };

  const [utxos, txInfo, latestBlock] = await Promise.all([
    cardanoRequest<Utxos>(`txs/${txHash.toLowerCase()}/utxos`),
    cardanoRequest<TxInfo>(`txs/${txHash.toLowerCase()}`),
    cardanoRequest<BlockInfo>("blocks/latest"),
  ]);
  if (!utxos.inputs.some((input) => input.address === walletAddress)) {
    throw new RequestError("The signed Cardano wallet was not an input to this transaction.");
  }
  if (latestBlock.height - txInfo.block_height + 1 < 2) return "pending";

  const lovelaceIn = utxos.inputs
    .filter((input) => input.address === treasury)
    .flatMap((input) => input.amount)
    .filter((amount) => amount.unit === "lovelace")
    .reduce((sum, amount) => sum + BigInt(amount.quantity), 0n);
  const lovelaceOut = utxos.outputs
    .filter((output) => output.address === treasury)
    .flatMap((output) => output.amount)
    .filter((amount) => amount.unit === "lovelace")
    .reduce((sum, amount) => sum + BigInt(amount.quantity), 0n);
  const receivedLovelace = lovelaceOut - lovelaceIn;
  if (receivedLovelace <= 0n) {
    throw new RequestError("No ADA transfer to the treasury was found in this transaction.");
  }

  const adaAmount = rawAmountToNumber(receivedLovelace, 6);
  const marketQuote = await fetchLiveMarketQuote("ADA");

  return {
    assetAmount: adaAmount,
    usdAmount: adaAmount * marketQuote.unitPriceUsd,
    walletAddress,
    confirmations: latestBlock.height - txInfo.block_height + 1,
    metadata: {
      block_height: txInfo.block_height,
      ada_usd: marketQuote.unitPriceUsd,
      unit_price_ngn: marketQuote.unitPriceNgn,
      price_change_24h_percent: marketQuote.priceChange24hPercent,
      price_quoted_at: marketQuote.quotedAt,
      quote_provider: "CoinGecko",
    },
  };
}

async function verifyDeposit(
  userId: string,
  body: RequestBody,
) {
  const challengeId = requireText(body.challengeId, "Deposit proof");
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) {
    throw new RequestError("Invalid deposit proof.");
  }
  const txHash = requireText(body.txHash, "Transaction hash");
  const admin = supabaseAdmin();
  const { data: challenge, error: challengeError } = await admin
    .from("web3_wallet_deposit_challenges")
    .select("id,user_id,chain_type,chain_name,asset_symbol,wallet_address,requested_usd_amount,message,expires_at,consumed_at")
    .eq("id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (challengeError) throw new Error(`Could not load deposit proof: ${challengeError.message}`);
  if (
    !challenge || challenge.consumed_at ||
    new Date(challenge.expires_at).getTime() <= Date.now()
  ) {
    throw new RequestError("Deposit wallet proof expired or was already used. Please try again.", 401);
  }

  await verifyWalletProof(challenge as Challenge, body);
  let verified: VerificationResult | "pending";
  try {
    const selected = challenge as Challenge;
    if (selected.chain_type === "EVM") {
      verified = await verifyEvmDeposit(selected, txHash);
    } else if (selected.chain_type === "SOLANA") {
      verified = await verifySolanaDeposit(selected, txHash);
    } else {
      verified = await verifyCardanoDeposit(selected, txHash);
    }
  } catch (error) {
    if (error instanceof RequestError && error.status === 202) {
      return { status: "pending", message: error.message };
    }
    throw error;
  }

  if (verified === "pending") {
    return {
      status: "pending",
      message: "The transaction is not finalized yet. Wait for confirmations and try again.",
    };
  }
  if (!Number.isFinite(verified.usdAmount) || verified.usdAmount < MIN_DEPOSIT_USD) {
    throw new RequestError(`The verified deposit must be worth at least $${MIN_DEPOSIT_USD}.`);
  }
  if (!meetsRequestedDepositAmount(
    verified.usdAmount,
    Number(challenge.requested_usd_amount),
  )) {
    throw new RequestError(
      `The confirmed transaction is worth $${verified.usdAmount.toFixed(2)}; send at least $${Number(challenge.requested_usd_amount).toFixed(2)} as selected.`,
    );
  }
  const epAmount = Math.floor(verified.usdAmount * EP_PER_USD);
  if (!Number.isSafeInteger(epAmount) || epAmount < MIN_DEPOSIT_USD * EP_PER_USD) {
    throw new RequestError("The verified deposit amount is outside the supported range.");
  }

  const normalizedTxHash = normalizeDepositTransactionHash(
    challenge.chain_type,
    txHash,
  );
  const { data: settlement, error: settlementError } = await admin.rpc(
    "settle_web3_wallet_deposit",
    {
      p_challenge_id: challenge.id,
      p_user_id: userId,
      p_chain_type: challenge.chain_type,
      p_chain_name: challenge.chain_name,
      p_asset_symbol: challenge.asset_symbol,
      p_tx_hash: normalizedTxHash,
      p_wallet_address: verified.walletAddress,
      p_asset_amount: verified.assetAmount,
      p_usd_amount: verified.usdAmount,
      p_ep_amount: epAmount,
      p_metadata: verified.metadata,
    },
  );
  if (settlementError) {
    if (settlementError.code === "23505") {
      throw new RequestError("This transaction has already been claimed.", 409);
    }
    throw new Error(`Could not settle verified Web3 deposit: ${settlementError.message}`);
  }
  if (!settlement?.success) {
    throw new Error("The verified deposit was not settled.");
  }

  return {
    status: "success",
    alreadyCredited: settlement.already_credited === true,
    depositId: settlement.deposit_id,
    epCredited: settlement.ep_credited,
    balanceAfter: settlement.balance_after,
    txHash: normalizedTxHash,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return errorResponse("Method not allowed.", 405, "METHOD_NOT_ALLOWED");

  let userId: string;
  try {
    ({ userId } = await requireAuth(req));
  } catch {
    return errorResponse("Sign in to verify a wallet deposit.", 401, "UNAUTHORIZED");
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400, "BAD_REQUEST");
  }

  try {
    if (body.action === "quote") {
      return jsonResponse(await getDepositQuote(body));
    }
    if (body.action === "challenge") {
      return jsonResponse(await createChallenge(userId, body));
    }
    if (body.action === "verify") {
      const result = await verifyDeposit(userId, body);
      return response(result, result.status === "pending" ? 202 : 200);
    }
    throw new RequestError("Action must be 'quote', 'challenge', or 'verify'.");
  } catch (error) {
    if (error instanceof RequestError) {
      return errorResponse(error.message, error.status, "DEPOSIT_REQUEST_FAILED");
    }
    console.error("[web3-wallet-deposit]", error instanceof Error ? error.message : "Unexpected error");
    return errorResponse("Deposit verification is temporarily unavailable. Please try again.", 503, "VERIFICATION_UNAVAILABLE");
  }
});
