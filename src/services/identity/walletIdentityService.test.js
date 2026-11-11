import walletIdentityService from "./walletIdentityService";
import { supabase } from "../config/supabase";

global.TextEncoder = require("util").TextEncoder;

jest.mock("../config/supabase", () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

describe("walletIdentityService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requests and verifies an EVM signature before completing wallet linking", async () => {
    const wallet = {
      request: jest.fn()
        .mockResolvedValueOnce(["0xAbC"])
        .mockResolvedValueOnce("0x2105")
        .mockResolvedValueOnce("0xsigned"),
    };
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: { challengeId: "challenge", message: "verify me" }, error: null })
      .mockResolvedValueOnce({ data: { wallet: { id: "linked-wallet" } }, error: null });

    const result = await walletIdentityService.link("ethereum", wallet, "MetaMask");

    expect(wallet.request).toHaveBeenNthCalledWith(1, { method: "eth_requestAccounts" });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, "wallet-identity", {
      body: { action: "challenge", chain: "ethereum", address: "0xAbC", chainId: 8453 },
    });
    expect(wallet.request).toHaveBeenNthCalledWith(3, {
      method: "personal_sign",
      params: ["0x766572696679206d65", "0xAbC"],
    });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, "wallet-identity", {
      body: {
        action: "verify",
        challengeId: "challenge",
        signature: "0xsigned",
        walletName: "MetaMask",
      },
    });
    expect(result.id).toBe("linked-wallet");
  });

  it("surfaces signature rejection and does not ask the server to verify", async () => {
    const wallet = {
      request: jest.fn()
        .mockResolvedValueOnce(["0xAbC"])
        .mockResolvedValueOnce("0x1")
        .mockRejectedValueOnce(new Error("User rejected request")),
    };
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { challengeId: "challenge", message: "verify me" },
      error: null,
    });

    await expect(walletIdentityService.link("ethereum", wallet)).rejects.toThrow("User rejected request");
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it("verifies Solana wallets with detached Ed25519 message signatures", async () => {
    const wallet = {
      publicKey: { toBase58: () => "wallet-address" },
      connect: jest.fn(),
      signMessage: jest.fn().mockResolvedValue({ signature: new Uint8Array([1, 2, 255]) }),
    };
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: { challengeId: "challenge", message: "verify me" }, error: null })
      .mockResolvedValueOnce({ data: { wallet: { id: "solana-wallet" } }, error: null });

    await walletIdentityService.link("solana", wallet, "Phantom");

    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, "wallet-identity", {
      body: { action: "challenge", chain: "solana", address: "wallet-address" },
    });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, "wallet-identity", {
      body: {
        action: "verify",
        challengeId: "challenge",
        signature: "0102ff",
        walletName: "Phantom",
      },
    });
  });

  it("requests CIP-30 Cardano data signatures for identity linking", async () => {
    const api = {
      getUsedAddresses: jest.fn().mockResolvedValue(["01ab"]),
      signData: jest.fn().mockResolvedValue({ signature: "cose-signature", key: "cose-key" }),
    };
    const wallet = { enable: jest.fn().mockResolvedValue(api) };
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: { challengeId: "challenge", message: "verify me" }, error: null })
      .mockResolvedValueOnce({ data: { wallet: { id: "cardano-wallet" } }, error: null });

    await walletIdentityService.link("cardano", wallet, "Lace");

    expect(api.signData).toHaveBeenCalledWith(
      "01ab",
      "766572696679206d65",
    );
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, "wallet-identity", {
      body: { action: "challenge", chain: "cardano", address: "01ab" },
    });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, "wallet-identity", {
      body: {
        action: "verify",
        challengeId: "challenge",
        signature: "cose-signature",
        publicKey: "cose-key",
        walletName: "Lace",
      },
    });
  });
});
