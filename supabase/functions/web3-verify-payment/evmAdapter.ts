// supabase/functions/web3-verify-payment/evmAdapter.ts
// ============================================================================
// EVM ADAPTER — Full production implementation.
// Handles: transaction fetching, receipt validation, confirmation counting,
// native token transfer verification, and ERC-20 token log decoding.
//
// SECURITY RULES enforced here:
//   1. We fetch ALL data directly from the RPC — nothing from the frontend
//      is trusted except identifiers (txHash, chain, amounts).
//   2. We validate the on-chain sender matches the claimed wallet.
//   3. We validate the on-chain recipient matches our treasury.
//   4. We decode raw ERC-20 Transfer logs — we do NOT trust frontend claims
//      about what token was transferred.
//   5. Amount tolerance is applied conservatively (2% under only).
//   6. Reverted transactions are always rejected.
//   7. Minimum confirmation count per chain is enforced.
// ============================================================================

import {
  EVMChainConfig,
  TokenConfig,
  ERC20_TRANSFER_TOPIC,
  normalizeAddress,
  addressesMatch,
  toDecimalAmount,
  isAmountSufficient,
} from "./chainConfig.ts";

// ── RPC JSON types ────────────────────────────────────────────────────────────

interface RPCResponse<T> {
  jsonrpc: string;
  id:      number;
  result:  T | null;
  error?:  { code: number; message: string };
}

interface EVMLog {
  address: string;
  topics:  string[];
  data:    string;
}

interface EVMReceipt {
  status:      string;        // "0x1" = success, "0x0" = reverted
  blockNumber: string;        // Hex block number
  from:        string;        // Sender address
  to:          string | null; // Recipient (null for contract deployments)
  logs:        EVMLog[];
}

interface EVMTransaction {
  from:     string;
  to:       string | null;
  value:    string;           // Hex wei amount
  input:    string;           // Calldata
  chainId:  string | null;    // Hex chain ID
}

// ── Public result type ────────────────────────────────────────────────────────

export interface EVMVerificationResult {
  verified:          boolean;
  reason:            string;
  confirmations:     number;
  requiredConfirms:  number;
  pendingConfirms:   boolean;   // True if confirmed but below minimum
  blockNumber:       number;
  tokenSymbol:       string;
  tokenAddress:      string;
  amountFound:       number;
  amountExpected:    number;
  fromAddress:       string;
  toAddress:         string;
  chainName:         string;
}

// ── Core EVM Adapter ──────────────────────────────────────────────────────────

export async function verifyEVMPayment(params: {
  chain:                string;
  chainConfig:          EVMChainConfig;
  txHash:               string;
  expectedRecipient:    string;
  expectedAmountUSD:    number;
  expectedTokenAddress: string | null;   // null = check all accepted stablecoins
  claimedSenderWallet:  string;
}): Promise<EVMVerificationResult> {
  const {
    chain,
    chainConfig,
    txHash,
    expectedRecipient,
    expectedAmountUSD,
    expectedTokenAddress,
    claimedSenderWallet,
  } = params;

  const rpcUrl = Deno.env.get(chainConfig.rpcEnvKey);
  if (!rpcUrl) {
    return fail(
      `RPC URL not configured for chain ${chain} (env key: ${chainConfig.rpcEnvKey})`,
      chainConfig
    );
  }

  // ── Step 1: Fetch transaction receipt ──────────────────────────────────────
  const receiptRes = await rpcCall<EVMReceipt>(
    rpcUrl,
    "eth_getTransactionReceipt",
    [txHash]
  );

  if (receiptRes.error) {
    return fail(`RPC error fetching receipt: ${receiptRes.error.message}`, chainConfig);
  }

  if (!receiptRes.result) {
    return fail(
      "Transaction not found. It may not be mined yet — please wait and try again.",
      chainConfig
    );
  }

  const receipt = receiptRes.result;

  // ── Step 2: Verify transaction succeeded (not reverted) ───────────────────
  if (receipt.status !== "0x1") {
    return fail(
      "Transaction was reverted on-chain. No funds were transferred.",
      chainConfig
    );
  }

  // ── Step 3: Fetch transaction details (amount + chain ID) ─────────────────
  const txRes = await rpcCall<EVMTransaction>(
    rpcUrl,
    "eth_getTransactionByHash",
    [txHash]
  );

  if (txRes.error || !txRes.result) {
    return fail("Could not fetch transaction details from RPC.", chainConfig);
  }

  const tx = txRes.result;

  // ── Step 4: Validate chain ID matches claimed chain ────────────────────────
  // This prevents replaying a Polygon tx as an Ethereum tx etc.
  if (tx.chainId !== null) {
    const onChainId = parseInt(tx.chainId, 16);
    if (onChainId !== chainConfig.chainId) {
      return fail(
        `Chain ID mismatch: transaction is on chain ${onChainId} but claimed chain ` +
        `'${chain}' expects ${chainConfig.chainId}.`,
        chainConfig
      );
    }
  }

  // ── Step 5: Validate sender matches claimed wallet ─────────────────────────
  // Prevents one user claiming another user's transaction.
  if (!addressesMatch(receipt.from, claimedSenderWallet)) {
    return fail(
      `Sender mismatch: transaction was sent from ${receipt.from} but user ` +
      `claimed wallet ${claimedSenderWallet}.`,
      chainConfig
    );
  }

  // ── Step 6: Count confirmations ────────────────────────────────────────────
  const blockRes = await rpcCall<string>(rpcUrl, "eth_blockNumber", []);
  if (blockRes.error || !blockRes.result) {
    return fail("Could not fetch current block number from RPC.", chainConfig);
  }

  const txBlock      = parseInt(receipt.blockNumber, 16);
  const currentBlock = parseInt(blockRes.result, 16);
  const confirmations = currentBlock - txBlock;

  if (confirmations < chainConfig.minConfirmations) {
    // Return a pending result — NOT a failure. The scheduler will retry.
    return {
      verified:         false,
      reason:           `Waiting for confirmations: ${confirmations}/${chainConfig.minConfirmations}`,
      confirmations,
      requiredConfirms: chainConfig.minConfirmations,
      pendingConfirms:  true,
      blockNumber:      txBlock,
      tokenSymbol:      "",
      tokenAddress:     "",
      amountFound:      0,
      amountExpected:   expectedAmountUSD,
      fromAddress:      normalizeAddress(receipt.from),
      toAddress:        "",
      chainName:        chainConfig.name,
    };
  }

  // ── Step 7: Determine payment type and verify amount ──────────────────────
  //
  // We check in this order:
  //   A) ERC-20 token transfer (most common — USDT/USDC)
  //   B) Native token transfer (ETH/MATIC/BNB direct send)
  //
  // For ERC-20: we decode Transfer logs from the receipt.
  // For native: we read tx.value directly.

  // Determine which tokens to check
  const tokensToCheck: TokenConfig[] = expectedTokenAddress
    ? (() => {
        const match = chainConfig.stableTokens.find(
          (t) => addressesMatch(t.address, expectedTokenAddress)
        );
        if (!match) {
          return [];  // Frontend claimed a token we don't support
        }
        return [match];
      })()
    : chainConfig.stableTokens;  // Check all accepted stablecoins

  // ── 7A: Check ERC-20 Transfer logs ────────────────────────────────────────
  for (const token of tokensToCheck) {
    const transferResult = findERC20Transfer(
      receipt.logs,
      token,
      expectedRecipient
    );

    if (transferResult !== null) {
      const amountHuman = toDecimalAmount(transferResult.amount, token.decimals);

      if (!isAmountSufficient(amountHuman, expectedAmountUSD)) {
        return fail(
          `Insufficient ${token.symbol} amount: received ${amountHuman.toFixed(4)} USD, ` +
          `expected ${expectedAmountUSD} USD (tolerance: 2%).`,
          chainConfig,
          {
            tokenSymbol:  token.symbol,
            tokenAddress: token.address,
            amountFound:  amountHuman,
            amountExpected: expectedAmountUSD,
            fromAddress:  normalizeAddress(receipt.from),
            toAddress:    normalizeAddress(expectedRecipient),
            confirmations,
            blockNumber:  txBlock,
          }
        );
      }

      // ✅ ERC-20 payment verified
      return {
        verified:         true,
        reason:           "ERC-20 transfer verified successfully.",
        confirmations,
        requiredConfirms: chainConfig.minConfirmations,
        pendingConfirms:  false,
        blockNumber:      txBlock,
        tokenSymbol:      token.symbol,
        tokenAddress:     normalizeAddress(token.address),
        amountFound:      amountHuman,
        amountExpected:   expectedAmountUSD,
        fromAddress:      normalizeAddress(receipt.from),
        toAddress:        normalizeAddress(expectedRecipient),
        chainName:        chainConfig.name,
      };
    }
  }

  // ── 7B: Check native token transfer ───────────────────────────────────────
  // Only if the tx.to matches treasury AND there's a non-zero value
  const nativeValue = BigInt(tx.value ?? "0x0");

  if (
    nativeValue > 0n &&
    tx.to !== null &&
    addressesMatch(tx.to, expectedRecipient)
  ) {
    // We do NOT accept native token payments for USD-priced products
    // because native price is volatile. We only accept stablecoins.
    return fail(
      `Native ${chainConfig.nativeSymbol} transfers are not accepted. ` +
      `Please send USDT or USDC on ${chainConfig.name}.`,
      chainConfig,
      {
        fromAddress:  normalizeAddress(receipt.from),
        toAddress:    normalizeAddress(tx.to),
        confirmations,
        blockNumber:  txBlock,
      }
    );
  }

  // ── 7C: No valid transfer found ───────────────────────────────────────────
  return fail(
    `No valid USDT or USDC transfer to the treasury wallet (${expectedRecipient}) ` +
    `was found in this transaction's logs. Verify you sent to the correct address ` +
    `and used an accepted token.`,
    chainConfig,
    {
      fromAddress:  normalizeAddress(receipt.from),
      confirmations,
      blockNumber:  txBlock,
    }
  );
}

// ── ERC-20 Log Decoder ────────────────────────────────────────────────────────

/**
 * Scans receipt logs for an ERC-20 Transfer event matching the expected token
 * and recipient. Returns the raw transfer amount (bigint) or null if not found.
 *
 * ERC-20 Transfer event structure:
 *   topics[0] = keccak256("Transfer(address,address,uint256)") — event signature
 *   topics[1] = from address (left-padded to 32 bytes)
 *   topics[2] = to address (left-padded to 32 bytes)
 *   data      = uint256 amount (32 bytes hex)
 */
function findERC20Transfer(
  logs:              EVMLog[],
  token:             TokenConfig,
  expectedRecipient: string
): { amount: bigint; toAddress: string } | null {
  for (const log of logs) {
    // Must be from the expected token contract
    if (!addressesMatch(log.address, token.address)) continue;

    // Must have the Transfer event signature
    if (log.topics[0] !== ERC20_TRANSFER_TOPIC) continue;

    // Must have all 3 topics (from, to are indexed)
    if (log.topics.length < 3) continue;

    // Decode recipient from topics[2] — strip leading zeros (32 bytes → 20 byte address)
    const toAddress = "0x" + log.topics[2].slice(26).toLowerCase();

    if (!addressesMatch(toAddress, expectedRecipient)) continue;

    // Decode amount from data field (32 bytes hex → bigint)
    const amountHex = log.data === "0x" ? "0x0" : log.data;
    const amount    = BigInt(amountHex);

    if (amount === 0n) continue;  // Zero-value transfer events are noise

    return { amount, toAddress };
  }

  return null;
}

// ── RPC Helper ─────────────────────────────────────────────────────────────────

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<RPCResponse<T>> {
  try {
    const response = await fetch(rpcUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        jsonrpc: "2.0",
        id:      1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      return {
        jsonrpc: "2.0",
        id:      1,
        result:  null,
        error:   { code: response.status, message: `HTTP ${response.status}: ${response.statusText}` },
      };
    }

    return await response.json() as RPCResponse<T>;
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id:      1,
      result:  null,
      error:   { code: -1, message: err instanceof Error ? err.message : "Network error" },
    };
  }
}

// ── Result builder helpers ────────────────────────────────────────────────────

function fail(
  reason:  string,
  config:  EVMChainConfig,
  partial?: Partial<EVMVerificationResult>
): EVMVerificationResult {
  return {
    verified:         false,
    reason,
    confirmations:    partial?.confirmations    ?? 0,
    requiredConfirms: config.minConfirmations,
    pendingConfirms:  false,
    blockNumber:      partial?.blockNumber      ?? 0,
    tokenSymbol:      partial?.tokenSymbol      ?? "",
    tokenAddress:     partial?.tokenAddress     ?? "",
    amountFound:      partial?.amountFound      ?? 0,
    amountExpected:   partial?.amountExpected   ?? 0,
    fromAddress:      partial?.fromAddress      ?? "",
    toAddress:        partial?.toAddress        ?? "",
    chainName:        config.name,
  };
}