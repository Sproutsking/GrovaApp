export type DepositChainType = "EVM" | "SOLANA" | "CARDANO";
export type DepositAsset = "USDC" | "USDT" | "ADA";

type EvmToken = { address: string; decimals: number };
type EvmChain = {
  chainId: number;
  rpcEnvKey: string;
  minConfirmations: number;
  tokens: Record<"USDC" | "USDT", EvmToken>;
};

export const EVM_DEPOSIT_CHAINS: Record<string, EvmChain> = {
  ethereum: {
    chainId: 1,
    rpcEnvKey: "ETH_RPC_URL",
    minConfirmations: 12,
    tokens: {
      USDC: { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
      USDT: { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
    },
  },
  polygon: {
    chainId: 137,
    rpcEnvKey: "POLYGON_RPC_URL",
    minConfirmations: 5,
    tokens: {
      USDC: { address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", decimals: 6 },
      USDT: { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6 },
    },
  },
  base: {
    chainId: 8453,
    rpcEnvKey: "BASE_RPC_URL",
    minConfirmations: 5,
    tokens: {
      USDC: { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
      USDT: { address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", decimals: 6 },
    },
  },
  arbitrum: {
    chainId: 42161,
    rpcEnvKey: "ARBITRUM_RPC_URL",
    minConfirmations: 5,
    tokens: {
      USDC: { address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
      USDT: { address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
    },
  },
  optimism: {
    chainId: 10,
    rpcEnvKey: "OPTIMISM_RPC_URL",
    minConfirmations: 5,
    tokens: {
      USDC: { address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6 },
      USDT: { address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", decimals: 6 },
    },
  },
  bnb: {
    chainId: 56,
    rpcEnvKey: "BSC_RPC_URL",
    minConfirmations: 10,
    tokens: {
      USDC: { address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
      USDT: { address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
    },
  },
  avalanche: {
    chainId: 43114,
    rpcEnvKey: "AVALANCHE_RPC_URL",
    minConfirmations: 5,
    tokens: {
      USDC: { address: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", decimals: 6 },
      USDT: { address: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", decimals: 6 },
    },
  },
  zksync: {
    chainId: 324,
    rpcEnvKey: "ZKSYNC_RPC_URL",
    minConfirmations: 5,
    tokens: {
      USDC: { address: "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4", decimals: 6 },
      USDT: { address: "0x493257fd37edb34451f62edf8d2a0c418852ba4c", decimals: 6 },
    },
  },
  fantom: {
    chainId: 250,
    rpcEnvKey: "FANTOM_RPC_URL",
    minConfirmations: 10,
    tokens: {
      USDC: { address: "0x04068da6c83afcfa0e13ba15a6696662335d5b75", decimals: 6 },
      USDT: { address: "0x049d68029688eabf473097a2fc38ef61633a3c7a", decimals: 6 },
    },
  },
};

export const SOLANA_TOKENS: Record<"USDC" | "USDT", { mint: string; decimals: number }> = {
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
};

export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function decodeBase58(value: string): Uint8Array {
  if (!value || value.length > 128) throw new Error("Invalid base58 value.");

  let decoded = 0n;
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) throw new Error("Invalid base58 value.");
    decoded = decoded * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn));
    decoded >>= 8n;
  }
  bytes.reverse();

  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") {
    leadingZeroes += 1;
  }

  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes]);
}

export function rawAmountToNumber(rawAmount: bigint, decimals: number): number {
  if (rawAmount < 0n || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Invalid token amount.");
  }
  const scale = 10n ** BigInt(decimals);
  const whole = rawAmount / scale;
  const fraction = rawAmount % scale;
  const amount = Number(whole) + Number(fraction) / Number(scale);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    throw new Error("Deposit amount is outside the supported range.");
  }
  return amount;
}

export function normalizeWalletAddress(
  chainType: DepositChainType,
  chain: string,
  address: string,
): string {
  const value = address.trim();
  if (chainType === "EVM") {
    if (!EVM_DEPOSIT_CHAINS[chain] || !/^0x[0-9a-f]{40}$/i.test(value)) {
      throw new Error("Invalid EVM wallet address or unsupported network.");
    }
    return value.toLowerCase();
  }

  if (chainType === "SOLANA") {
    if (chain !== "solana" || decodeBase58(value).length !== 32) {
      throw new Error("Invalid Solana wallet address.");
    }
    return value;
  }

  if (chainType === "CARDANO") {
    if (chain !== "cardano" || !/^(?:[0-9a-f]{2})+$/i.test(value)) {
      throw new Error("Invalid Cardano wallet address.");
    }
    return value.toLowerCase();
  }

  throw new Error("Unsupported deposit network.");
}
