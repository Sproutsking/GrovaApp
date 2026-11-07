import authService from "./authService";
import { supabase } from "../config/supabase";

global.TextEncoder = require("util").TextEncoder;

jest.mock("../config/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      signInWithWeb3: jest.fn(),
      verifyOtp: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock("../config/authConfig", () => ({
  getCallbackUrl: () => "https://app.example/auth/callback",
}));

describe("AuthService X OAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.signInWithOAuth.mockResolvedValue({ error: null });
    supabase.auth.signInWithWeb3.mockResolvedValue({ error: null });
    supabase.auth.verifyOtp.mockResolvedValue({ error: null });
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });
  });

  it("uses the current X OAuth provider and profile scopes for main sign-in", async () => {
    await authService.signInOAuth("x");

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "x",
      options: {
        redirectTo: "https://app.example/auth/callback",
        skipBrowserRedirect: false,
        scopes: "tweet.read users.read users.email offline.access",
      },
    });
  });

  it.each(["ethereum", "solana"])("uses Supabase Web3 auth for %s wallets", async (chain) => {
    const wallet = { request: jest.fn() };

    await authService.signInWithWallet(chain, wallet);

    expect(supabase.auth.signInWithWeb3).toHaveBeenCalledWith({
      chain,
      wallet,
      statement: "Sign in to Xeevia",
      options: { url: `${window.location.origin}/` },
    });
  });

  it("rejects unsupported chains before calling Supabase", async () => {
    await expect(authService.signInWithWallet("tron", {}))
      .rejects.toThrow("Unsupported wallet sign-in chain: tron");
    expect(supabase.auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("surfaces Supabase Web3 authentication errors", async () => {
    const authError = new Error("Web3 provider is not enabled");
    supabase.auth.signInWithWeb3.mockResolvedValue({ error: authError });

    await expect(authService.signInWithWallet("ethereum", {})).rejects.toBe(authError);
  });

  it("verifies Cardano CIP-30 signatures before exchanging a one-time Supabase token", async () => {
    const wallet = {
      enable: jest.fn().mockResolvedValue({
        getUsedAddresses: jest.fn().mockResolvedValue(["01ab"]),
        signData: jest.fn().mockResolvedValue({ key: "cose-key", signature: "cose-signature" }),
      }),
    };
    supabase.functions.invoke
      .mockResolvedValueOnce({
        data: { challengeId: "challenge-id", message: "Sign in to Xeevia" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { token_hash: "one-time-token-hash" },
        error: null,
      });

    await authService.signInWithWallet("cardano", wallet);

    expect(wallet.enable).toHaveBeenCalledTimes(1);
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, "cardano-auth", {
      body: { action: "challenge", address: "01ab" },
    });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, "cardano-auth", {
      body: {
        action: "verify",
        challengeId: "challenge-id",
        address: "01ab",
        signature: "cose-signature",
        key: "cose-key",
      },
    });
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "one-time-token-hash",
      type: "magiclink",
    });
    expect(supabase.auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("does not exchange a Supabase token when Cardano challenge verification fails", async () => {
    const verificationError = new Error("Invalid Cardano wallet signature");
    const wallet = {
      enable: jest.fn().mockResolvedValue({
        getUsedAddresses: jest.fn().mockResolvedValue(["01ab"]),
        signData: jest.fn().mockResolvedValue({ key: "cose-key", signature: "cose-signature" }),
      }),
    };
    supabase.functions.invoke
      .mockResolvedValueOnce({
        data: { challengeId: "challenge-id", message: "Sign in to Xeevia" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: verificationError });

    await expect(authService.signInWithWallet("cardano", wallet)).rejects.toBe(verificationError);
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
