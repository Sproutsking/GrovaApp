import {
  decodeBase58,
  EVM_DEPOSIT_CHAINS,
  normalizeWalletAddress,
  rawAmountToNumber,
  SOLANA_TOKENS,
} from "./verification.ts";

Deno.test("deposit registry includes EVM and Solana USDT", () => {
  if (!EVM_DEPOSIT_CHAINS.ethereum.tokens.USDT.address) {
    throw new Error("Ethereum USDT contract is missing.");
  }
  if (!EVM_DEPOSIT_CHAINS.bnb.tokens.USDT.address) {
    throw new Error("BNB USDT contract is missing.");
  }
  if (!SOLANA_TOKENS.USDT.mint) {
    throw new Error("Solana USDT mint is missing.");
  }
});

Deno.test("normalizes EVM addresses and validates supported networks", () => {
  const address = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";
  if (
    normalizeWalletAddress("EVM", "ethereum", address) !==
    address.toLowerCase()
  ) {
    throw new Error("EVM address was not normalized.");
  }

  let rejected = false;
  try {
    normalizeWalletAddress("EVM", "unsupported", address);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Unsupported EVM network was accepted.");
});

Deno.test("decodes the all-zero Solana public key", () => {
  const publicKey = decodeBase58("11111111111111111111111111111111");
  if (publicKey.length !== 32 || publicKey.some((byte) => byte !== 0)) {
    throw new Error("Base58 public key decoding returned an unexpected value.");
  }
});

Deno.test("converts raw token units without rounding away token precision", () => {
  if (rawAmountToNumber(1_234_567n, 6) !== 1.234567) {
    throw new Error("Six-decimal token amount was converted incorrectly.");
  }
  if (rawAmountToNumber(1_000_000_000_000_000_000n, 18) !== 1) {
    throw new Error("Eighteen-decimal token amount was converted incorrectly.");
  }
});
