import {
  decodeBase58,
  EVM_DEPOSIT_CHAINS,
  isValidRequestedUsdAmount,
  meetsRequestedDepositAmount,
  minimumAssetAmount,
  normalizeDepositTransactionHash,
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

Deno.test("validates the requested deposit amount and enforces the confirmed minimum", () => {
  if (!isValidRequestedUsdAmount(1) || !isValidRequestedUsdAmount(125.5)) {
    throw new Error("A valid requested deposit amount was rejected.");
  }
  if (
    isValidRequestedUsdAmount(0.99) ||
    isValidRequestedUsdAmount(1.001) ||
    isValidRequestedUsdAmount(1_000_000.01)
  ) {
    throw new Error("An invalid requested deposit amount was accepted.");
  }
  if (!meetsRequestedDepositAmount(25.5, 25.5)) {
    throw new Error("A confirmed deposit equal to the requested amount was rejected.");
  }
  if (meetsRequestedDepositAmount(25.49, 25.5)) {
    throw new Error("A confirmed deposit below the requested amount was accepted.");
  }
});

Deno.test("normalizes case-insensitive EVM and Cardano transaction hashes", () => {
  const evmHash = `0x${"aB".repeat(32)}`;
  if (normalizeDepositTransactionHash("EVM", evmHash) !== evmHash.toLowerCase()) {
    throw new Error("EVM transaction hash was not normalized.");
  }
  const cardanoHash = "aB".repeat(32);
  if (
    normalizeDepositTransactionHash("CARDANO", cardanoHash) !==
    cardanoHash.toLowerCase()
  ) {
    throw new Error("Cardano transaction hash was not normalized.");
  }
  if (
    normalizeDepositTransactionHash("SOLANA", "AbCd") !== "AbCd"
  ) {
    throw new Error("Case-sensitive Solana signature was changed.");
  }
});

Deno.test("rounds minimum crypto deposits up to the asset precision", () => {
  if (minimumAssetAmount(1, 1, 6) !== 1) {
    throw new Error("Stablecoin minimum was calculated incorrectly.");
  }
  if (minimumAssetAmount(1, 0.4, 6) !== 2.5) {
    throw new Error("ADA minimum was calculated incorrectly.");
  }
  if (minimumAssetAmount(1, 3, 6) !== 0.333334) {
    throw new Error("Crypto minimum was not rounded up to token precision.");
  }
});
