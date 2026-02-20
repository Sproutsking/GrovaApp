// supabase/functions/web3-verify-payment/chainConfig.ts
// ============================================================================
// CHAIN CONFIGURATION — Single source of truth for all blockchain settings.
// To add a new EVM chain: add one entry to EVM_CHAINS below. Nothing else
// needs to change. The adapter reads this config at runtime.
// ============================================================================

export type ChainType = "EVM" | "SOLANA" | "CARDANO";

export interface TokenConfig {
  address:  string;   // Contract address (checksummed or lowercase — we normalize)
  decimals: number;   // Token decimal places
  symbol:   string;   // Human-readable symbol for logging
}

export interface EVMChainConfig {
  chainId:          number;         // Numeric EVM chain ID
  name:             string;         // Human-readable name for logging
  rpcEnvKey:        string;         // Env var key holding the RPC URL
  nativeSymbol:     string;         // Native token symbol (ETH, MATIC, BNB)
  nativeDecimals:   number;         // Native token decimals (always 18 for EVM)
  minConfirmations: number;         // Min blocks before we accept payment
  stableTokens:     TokenConfig[];  // Accepted stable tokens (USDT, USDC)
  blockTimeSeconds: number;         // Approx block time — used for UX estimates
}

// ── EVM Chain Registry ────────────────────────────────────────────────────────
// Keyed by lowercase chain identifier sent from frontend.
// NEVER trust chain IDs from the frontend — we validate against this map.
export const EVM_CHAINS: Record<string, EVMChainConfig> = {
  polygon: {
    chainId:          137,
    name:             "Polygon Mainnet",
    rpcEnvKey:        "POLYGON_RPC_URL",
    nativeSymbol:     "MATIC",
    nativeDecimals:   18,
    minConfirmations: 5,    // ~10 seconds on Polygon — 5 is safe
    blockTimeSeconds: 2,
    stableTokens: [
      {
        address:  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        decimals: 6,
        symbol:   "USDT",
      },
      {
        address:  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        decimals: 6,
        symbol:   "USDC",
      },
    ],
  },

  base: {
    chainId:          8453,
    name:             "Base Mainnet",
    rpcEnvKey:        "BASE_RPC_URL",
    nativeSymbol:     "ETH",
    nativeDecimals:   18,
    minConfirmations: 3,    // Base is an Optimistic rollup — 3 is reasonable
    blockTimeSeconds: 2,
    stableTokens: [
      {
        address:  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
        decimals: 6,
        symbol:   "USDT",
      },
      {
        address:  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
        symbol:   "USDC",
      },
    ],
  },

  arbitrum: {
    chainId:          42161,
    name:             "Arbitrum One",
    rpcEnvKey:        "ARBITRUM_RPC_URL",
    nativeSymbol:     "ETH",
    nativeDecimals:   18,
    minConfirmations: 3,
    blockTimeSeconds: 1,
    stableTokens: [
      {
        address:  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        decimals: 6,
        symbol:   "USDT",
      },
      {
        address:  "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        decimals: 6,
        symbol:   "USDC",
      },
    ],
  },

  ethereum: {
    chainId:          1,
    name:             "Ethereum Mainnet",
    rpcEnvKey:        "ETH_RPC_URL",
    nativeSymbol:     "ETH",
    nativeDecimals:   18,
    minConfirmations: 12,   // Ethereum needs 12 for finality confidence
    blockTimeSeconds: 12,
    stableTokens: [
      {
        address:  "0xdac17f958d2ee523a2206206994597c13d831ec7",
        decimals: 6,
        symbol:   "USDT",
      },
      {
        address:  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
        symbol:   "USDC",
      },
    ],
  },

  bnb: {
    chainId:          56,
    name:             "BNB Smart Chain",
    rpcEnvKey:        "BSC_RPC_URL",
    nativeSymbol:     "BNB",
    nativeDecimals:   18,
    minConfirmations: 15,   // BSC has lower finality guarantees — use more
    blockTimeSeconds: 3,
    stableTokens: [
      {
        address:  "0x55d398326f99059ff775485246999027b3197955",
        decimals: 18,       // USDT on BSC uses 18 decimals — not 6
        symbol:   "USDT",
      },
      {
        address:  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        decimals: 18,       // USDC on BSC uses 18 decimals — not 6
        symbol:   "USDC",
      },
    ],
  },
};

// ERC-20 Transfer event signature (keccak256 of "Transfer(address,address,uint256)")
// This is a fixed constant across ALL EVM chains — never changes.
export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Tolerance: we allow payments up to 2% short of expected amount.
// This covers minor fee differences but rejects genuinely short payments.
export const AMOUNT_TOLERANCE_PERCENT = 2;

// ── Validation helpers ────────────────────────────────────────────────────────

/** Returns the EVM chain config or null if unsupported */
export function getEVMChainConfig(chain: string): EVMChainConfig | null {
  return EVM_CHAINS[chain.toLowerCase()] ?? null;
}

/** Normalize any Ethereum address to lowercase for safe comparison */
export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/** Check whether two addresses are the same (case-insensitive) */
export function addressesMatch(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}

/**
 * Convert a raw token amount (bigint from chain) to a human decimal number.
 * e.g. 1000000n with decimals=6 → 1.0
 */
export function toDecimalAmount(raw: bigint, decimals: number): number {
  const divisor = BigInt(10 ** decimals);
  const whole   = raw / divisor;
  const frac    = raw % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

/**
 * Return true if actualAmount is within tolerance of expectedAmount.
 * We allow the user to pay SLIGHTLY less (within AMOUNT_TOLERANCE_PERCENT)
 * to handle minor rounding during token conversion.
 * We do NOT allow under-payment beyond tolerance.
 */
export function isAmountSufficient(actual: number, expected: number): boolean {
  const minimum = expected * (1 - AMOUNT_TOLERANCE_PERCENT / 100);
  return actual >= minimum;
}