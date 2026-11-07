import { getDetectedWallets } from "./walletDiscovery";

describe("getDetectedWallets", () => {
  it("lists announced EVM providers by EIP-6963 identity and removes duplicate providers", () => {
    const provider = { request: jest.fn(), isMetaMask: true };
    const walletWindow = {
      ethereum: provider,
      ethereumProvider: provider,
    };

    const wallets = getDetectedWallets(walletWindow, [{
      info: { uuid: "metamask-uuid", name: "MetaMask", rdns: "io.metamask" },
      provider,
    }]);

    expect(wallets).toEqual([{
      id: "io.metamask",
      name: "MetaMask",
      chain: "ethereum",
      provider,
    }]);
  });

  it("includes Solana providers only when they can connect and sign", () => {
    const phantom = {
      connect: jest.fn(),
      signMessage: jest.fn(),
      publicKey: { toBase58: jest.fn() },
    };
    const incomplete = { connect: jest.fn() };
    const wallets = getDetectedWallets({
      phantom: { solana: phantom },
      solflare: incomplete,
    });

    expect(wallets).toEqual([{
      id: "solana-phantom",
      name: "Phantom",
      chain: "solana",
      provider: phantom,
    }]);
  });

  it("lists all enabled CIP-30 Cardano wallets", () => {
    const lace = { name: "Lace", enable: jest.fn(), isEnabled: jest.fn() };
    const invalid = { name: "Invalid", enable: jest.fn() };
    const wallets = getDetectedWallets({
      cardano: { lace, invalid },
    });

    expect(wallets).toEqual([{
      id: "cardano-lace",
      name: "Lace",
      chain: "cardano",
      provider: lace,
    }]);
  });

  it("returns no wallets when browser injection is unavailable", () => {
    expect(getDetectedWallets(null)).toEqual([]);
  });
});
