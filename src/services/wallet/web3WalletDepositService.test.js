import {
  createWeb3DepositChallenge,
  getWeb3DepositQuote,
} from "./web3WalletDepositService";
import { supabase } from "../config/supabase";

jest.mock("../config/supabase", () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

describe("web3WalletDepositService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("binds the requested deposit amount into the authenticated challenge request", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { challengeId: "challenge", message: "deposit proof" },
      error: null,
    });

    await createWeb3DepositChallenge({
      chainType: "EVM",
      chain: "base",
      asset: "USDC",
      walletAddress: "0x123",
      requestedUsdAmount: 25.5,
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith("web3-wallet-deposit", {
      body: {
        action: "challenge",
        chainType: "EVM",
        chain: "base",
        asset: "USDC",
        walletAddress: "0x123",
        requestedUsdAmount: 25.5,
      },
    });
  });

  it("requests a current Cardano deposit quote", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { unitPriceUsd: 0.5, minimumAssetAmount: 2 },
      error: null,
    });

    await getWeb3DepositQuote({
      chainType: "CARDANO",
      chain: "cardano",
      asset: "ADA",
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith("web3-wallet-deposit", {
      body: {
        action: "quote",
        chainType: "CARDANO",
        chain: "cardano",
        asset: "ADA",
      },
    });
  });
});
