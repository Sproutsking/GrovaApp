export function getDetectedWallets(walletWindow, announcedEvmWallets = []) {
  if (!walletWindow) return [];

  const detected = [];
  const seenProviders = new Set();
  const addWallet = (wallet) => {
    if (!wallet?.provider || seenProviders.has(wallet.provider)) return;
    seenProviders.add(wallet.provider);
    detected.push(wallet);
  };
  const evmProviders = [
    ...announcedEvmWallets,
    ...(Array.isArray(walletWindow.ethereum?.providers) ? walletWindow.ethereum.providers : []),
    walletWindow.ethereum,
    walletWindow.coinbaseWalletExtension,
    walletWindow.okxwallet,
    walletWindow.rabby,
    walletWindow.trustwallet,
  ];

  evmProviders.forEach((candidate) => {
    const provider = candidate?.provider || candidate;
    if (typeof provider?.request !== "function") return;
    const info = candidate?.info || provider.info || {};
    const name = info.name
      || (provider.isBraveWallet ? "Brave Wallet"
        : provider.isCoinbaseWallet ? "Coinbase Wallet"
          : provider.isRabby ? "Rabby"
            : provider.isMetaMask ? "MetaMask"
              : provider.isTrust ? "Trust Wallet"
                : provider.isOKXWallet ? "OKX Wallet"
                  : "EVM wallet");
    addWallet({
      id: info.rdns || `evm-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      chain: "ethereum",
      provider,
    });
  });

  [
    ["Phantom", walletWindow.phantom?.solana || (walletWindow.solana?.isPhantom ? walletWindow.solana : null)],
    ["Solflare", walletWindow.solflare],
    ["Backpack", walletWindow.backpack?.solana],
    ["Glow", walletWindow.glow?.solana],
    ["Brave Wallet", walletWindow.braveSolana],
    ["Solana wallet", walletWindow.solana],
  ].forEach(([name, provider]) => {
    if (
      typeof provider?.connect !== "function"
      || (
        typeof provider.signIn !== "function"
        && (
          typeof provider.signMessage !== "function"
          || typeof provider.publicKey?.toBase58 !== "function"
        )
      )
    ) return;
    addWallet({
      id: `solana-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      chain: "solana",
      provider,
    });
  });

  Object.entries(walletWindow.cardano || {}).forEach(([key, provider]) => {
    if (typeof provider?.enable !== "function" || typeof provider?.isEnabled !== "function") return;
    const name = provider.name || key;
    addWallet({ id: `cardano-${key}`, name, chain: "cardano", provider });
  });

  return detected;
}
