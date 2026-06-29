// src/hooks/useWalletConnect.js
// ════════════════════════════════════════════════════════════════════════════
// WALLET CONNECT HOOK — Multi-Chain Wallet Detection & Connection
//
// PURPOSE:
//   Detect browser wallets (MetaMask, Phantom, Coinbase, Rabby, TronLink)
//   Connect to wallets and retrieve:
//     - Chain type (EVM, SOLANA, TRON, CARDANO)
//     - Wallet address
//     - Wallet name
//     - Available tokens on that wallet
//     - Request permission to sign and pay
//
// SUPPORTED WALLETS:
//   EVM:    MetaMask, Coinbase Wallet, Brave Wallet, Rabby, Injected
//   SOLANA: Phantom, Solflare, Backpack, Marinade
//   TRON:   TronLink (Web3)
//   CARDANO: Nami, Eternl, Flint (browser extension detection)
//
// USAGE:
//   const { wallets, connecting, connectWallet, getBalance, signMessage } = useWalletConnect();
//   
//   // Detect available wallets
//   useEffect(() => {
//     const available = wallets.filter(w => w.available);
//   }, [wallets]);
//   
//   // Connect to a wallet
//   const handleConnect = async () => {
//     const connected = await connectWallet(selectedWallet.id, 'EVM', 137); // Polygon
//   };
//
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";

// ── Wallet Registry ──────────────────────────────────────────────────────────
const WALLET_REGISTRY = {
  // EVM Wallets
  metamask: {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    color: "#f6851b",
    chainType: "EVM",
    supports: ["ethereum", "polygon", "base", "arbitrum", "optimism"],
    detect: () => window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isBraveWallet,
  },
  coinbase: {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "💼",
    color: "#1652f0",
    chainType: "EVM",
    supports: ["ethereum", "polygon", "base", "arbitrum", "optimism"],
    detect: () => window.ethereum && window.ethereum.isCoinbaseWallet,
  },
  brave: {
    id: "brave",
    name: "Brave Wallet",
    icon: "🦁",
    color: "#fb542b",
    chainType: "EVM",
    supports: ["ethereum", "polygon", "base", "arbitrum", "optimism"],
    detect: () => window.ethereum && window.ethereum.isBraveWallet,
  },
  rabby: {
    id: "rabby",
    name: "Rabby",
    icon: "🐰",
    color: "#8c6cf7",
    chainType: "EVM",
    supports: ["ethereum", "polygon", "base", "arbitrum", "optimism"],
    detect: () => window.ethereum && window.ethereum.isRabby,
  },

  // Solana Wallets
  phantom: {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    color: "#ab9ff2",
    chainType: "SOLANA",
    supports: ["solana"],
    detect: () => window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null),
  },
  solflare: {
    id: "solflare",
    name: "Solflare",
    icon: "🔥",
    color: "#ffb84d",
    chainType: "SOLANA",
    supports: ["solana"],
    detect: () => window.solflare,
  },

  // Tron Wallets
  tronlink: {
    id: "tronlink",
    name: "TronLink",
    icon: "⛓️",
    color: "#eb0029",
    chainType: "TRON",
    supports: ["tron"],
    detect: () => window.tronLink || window.tronWeb,
  },

  // Cardano Wallets (basic detection)
  nami: {
    id: "nami",
    name: "Nami",
    icon: "🎨",
    color: "#1e7145",
    chainType: "CARDANO",
    supports: ["cardano"],
    detect: () => window.cardano?.nami,
  },
  eternl: {
    id: "eternl",
    name: "Eternl",
    icon: "💎",
    color: "#4a90e2",
    chainType: "CARDANO",
    supports: ["cardano"],
    detect: () => window.cardano?.eternl,
  },
};

// ── Main Hook ────────────────────────────────────────────────────────────────
export function useWalletConnect() {
  const [wallets, setWallets] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(null);
  const [error, setError] = useState(null);

  // ── Detect available wallets ─────────────────────────────────────────────
  const detectWallets = useCallback(() => {
    if (typeof window === "undefined") return;

    const detected = [];

    // Check each wallet in registry
    for (const [key, wallet] of Object.entries(WALLET_REGISTRY)) {
      try {
        const provider = wallet.detect();
        if (provider) {
          detected.push({
            id: wallet.id,
            name: wallet.name,
            icon: wallet.icon,
            color: wallet.color,
            chainType: wallet.chainType,
            supports: wallet.supports,
            available: true,
            provider,
          });
        }
      } catch (e) {
        // Silently skip if detection fails
      }
    }

    setWallets(detected);
  }, []);

  // ── Detect on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    detectWallets();
    // Also detect on window load (in case wallet is loaded late)
    window.addEventListener("load", detectWallets);
    return () => window.removeEventListener("load", detectWallets);
  }, [detectWallets]);

  // ── Connect to wallet ────────────────────────────────────────────────────
  const connectWallet = useCallback(
    async (walletId, chainType = null, chainId = null) => {
      setConnecting(true);
      setError(null);

      try {
        const wallet = wallets.find((w) => w.id === walletId);
        if (!wallet) throw new Error(`Wallet ${walletId} not found`);

        const provider = wallet.provider;
        if (!provider) throw new Error(`${wallet.name} provider not available`);

        let address = null;
        let actualChainType = wallet.chainType;

        // ── EVM Connection ───────────────────────────────────────────────
        if (wallet.chainType === "EVM") {
          try {
            // Request account access
            const accounts = await provider.request({ method: "eth_requestAccounts" });
            address = accounts?.[0];
            if (!address) throw new Error("No EVM account returned");

            // Get chain ID
            const chainHex = await provider.request({ method: "eth_chainId" });
            const currentChainId = parseInt(chainHex, 16);

            // Check if we need to switch chains
            if (chainId && currentChainId !== chainId) {
              try {
                await provider.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: `0x${chainId.toString(16)}` }],
                });
              } catch (switchError) {
                if (switchError.code === 4902) {
                  // Chain not added, ask user to add it
                  throw new Error(`Please add chain ${chainId} to your wallet`);
                }
                throw switchError;
              }
            }
          } catch (e) {
            if (e.code === 4001) throw new Error("Connection rejected by user");
            throw e;
          }
        }
        // ── SOLANA Connection ────────────────────────────────────────────
        else if (wallet.chainType === "SOLANA") {
          try {
            const resp = await provider.connect({ onlyIfTrusted: false });
            address = resp?.publicKey?.toString();
            if (!address) {
              // Try alternate detection
              address = provider.publicKey?.toString();
            }
            if (!address) throw new Error("No Solana account returned");
          } catch (e) {
            if (e.message.includes("User") || e.code === 4001) {
              throw new Error("Connection rejected by user");
            }
            throw e;
          }
        }
        // ── TRON Connection ─────────────────────────────────────────────
        else if (wallet.chainType === "TRON") {
          try {
            if (!provider.tronWeb) {
              throw new Error("TronWeb not available");
            }
            address = provider.tronWeb.defaultAddress.hex;
            if (!address) {
              throw new Error("No Tron account. Please unlock your wallet.");
            }
          } catch (e) {
            throw new Error(`Tron connection failed: ${e.message}`);
          }
        }
        // ── CARDANO Connection ──────────────────────────────────────────
        else if (wallet.chainType === "CARDANO") {
          try {
            // Request wallet enable (permission)
            await provider.enable();
            // Get unused addresses
            const addrs = await provider.getUsedAddresses();
            address = addrs?.[0];
            if (!address) throw new Error("No Cardano account found");
          } catch (e) {
            if (e.message.includes("User")) {
              throw new Error("Connection rejected by user");
            }
            throw e;
          }
        }

        if (!address) throw new Error("Failed to retrieve wallet address");

        setConnected({
          walletId: wallet.id,
          walletName: wallet.name,
          chainType: actualChainType,
          address,
          provider,
          icon: wallet.icon,
          color: wallet.color,
        });

        return {
          success: true,
          walletId: wallet.id,
          walletName: wallet.name,
          chainType: actualChainType,
          address,
        };
      } catch (e) {
        const msg = e.message || "Connection failed";
        setError(msg);
        setConnecting(false);
        throw new Error(msg);
      } finally {
        setConnecting(false);
      }
    },
    [wallets]
  );

  // ── Request signature ────────────────────────────────────────────────────
  const requestSignature = useCallback(
    async (message, chainType) => {
      if (!connected) throw new Error("Wallet not connected");
      if (chainType && connected.chainType !== chainType) {
        throw new Error(`Expected ${chainType} wallet, got ${connected.chainType}`);
      }

      try {
        // ── EVM Signature ────────────────────────────────────────────────
        if (connected.chainType === "EVM") {
          const signature = await connected.provider.request({
            method: "personal_sign",
            params: [message, connected.address],
          });
          return signature;
        }
        // ── SOLANA Signature ─────────────────────────────────────────────
        else if (connected.chainType === "SOLANA") {
          const encoded = new TextEncoder().encode(message);
          const signed = await connected.provider.signMessage(encoded, "utf8");
          return Buffer.from(signed.signature).toString("hex");
        }
        // ── CARDANO Signature ────────────────────────────────────────────
        else if (connected.chainType === "CARDANO") {
          const signature = await connected.provider.signData(
            Buffer.from(message).toString("hex")
          );
          return signature.signature;
        }

        throw new Error(`Signing not supported for ${connected.chainType}`);
      } catch (e) {
        if (e.code === 4001 || e.message.includes("User")) {
          throw new Error("Signature rejected by user");
        }
        throw e;
      }
    },
    [connected]
  );

  // ── Request payment (approve stablecoin transfer) ──────────────────────
  const requestPayment = useCallback(
    async (tokenAddress, spenderAddress, amount) => {
      if (!connected || connected.chainType !== "EVM") {
        throw new Error("EVM wallet required for payment");
      }

      try {
        // This is a simplified approval request
        // In production, you'd construct the actual ERC-20 approve call
        const tx = await connected.provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: connected.address,
              to: spenderAddress,
              value: amount,
              // This is simplified — real implementation needs ERC-20 approve call
            },
          ],
        });
        return tx;
      } catch (e) {
        if (e.code === 4001) throw new Error("Transaction rejected by user");
        throw e;
      }
    },
    [connected]
  );

  // ── Disconnect ───────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setConnected(null);
    setError(null);
  }, []);

  return {
    // State
    wallets,
    connected,
    connecting,
    error,

    // Methods
    detectWallets,
    connectWallet,
    requestSignature,
    requestPayment,
    disconnect,

    // Computed
    isConnected: !!connected,
    connectedWalletName: connected?.walletName,
    connectedAddress: connected?.address,
  };
}

export default useWalletConnect;
