import { createAppKit } from "@reown/appkit/react";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  celo,
  fantom,
  gnosis,
  linea,
  mainnet,
  mantle,
  mode,
  moonbeam,
  optimism,
  polygon,
  scroll,
  solana,
  zkSync,
} from "@reown/appkit/networks";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { walletConnectConfigured, walletConnectProjectId } from "./walletConnectSettings";

if (walletConnectConfigured) {
  const appUrl = typeof window === "undefined" ? "https://app.xeevia.com" : window.location.origin;
  const networks = [
    mainnet,
    base,
    arbitrum,
    optimism,
    polygon,
    avalanche,
    bsc,
    gnosis,
    linea,
    scroll,
    zkSync,
    celo,
    fantom,
    mantle,
    moonbeam,
    mode,
    solana,
  ];

  createAppKit({
    adapters: [new EthersAdapter(), new SolanaAdapter()],
    networks,
    projectId: walletConnectProjectId,
    metadata: {
      name: "Xeevia",
      description: "Sign in to Xeevia with your wallet",
      url: appUrl,
      icons: [`${appUrl}/logo192.png`],
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#a8e63d",
      "--w3m-border-radius-master": "8px",
    },
    enableEIP6963: true,
    experimental_preferUniversalLinks: true,
    allowUnsupportedChain: true,
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
      history: false,
    },
  });
}
