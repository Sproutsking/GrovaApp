import React, { useCallback, useEffect, useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useAppKitWallet } from "@reown/appkit-wallet-button/react";
import "../../services/wallet/walletConnectConfig";

export default function WalletPickerWithReown({
  wallets,
  error,
  onClose,
  onSelectInjected,
  onSelectRemote,
  onConnectionError,
  renderPickerContent: PickerContent,
}) {
  const [connectedChain, setConnectedChain] = useState(null);
  const [connectingWallet, setConnectingWallet] = useState("");
  const evmAccount = useAppKitAccount({ namespace: "eip155" });
  const solanaAccount = useAppKitAccount({ namespace: "solana" });
  const { walletProvider: evmProvider } = useAppKitProvider("eip155");
  const { walletProvider: solanaProvider } = useAppKitProvider("solana");
  const handleEvmSuccess = useCallback(() => setConnectedChain("ethereum"), []);
  const handleSolanaSuccess = useCallback(() => setConnectedChain("solana"), []);
  const handleConnectionError = useCallback((connectionError) => {
    setConnectedChain(null);
    setConnectingWallet("");
    onConnectionError(connectionError);
  }, [onConnectionError]);
  const {
    connect: connectEvm,
    isReady: evmReady,
  } = useAppKitWallet({
    namespace: "eip155",
    onSuccess: handleEvmSuccess,
    onError: handleConnectionError,
  });
  const {
    connect: connectSolana,
    isReady: solanaReady,
  } = useAppKitWallet({
    namespace: "solana",
    onSuccess: handleSolanaSuccess,
    onError: handleConnectionError,
  });

  useEffect(() => {
    if (connectedChain === "ethereum" && evmAccount.isConnected && evmProvider) {
      setConnectedChain(null);
      setConnectingWallet("");
      onSelectRemote("ethereum", evmProvider);
    } else if (connectedChain === "solana" && solanaAccount.isConnected && solanaProvider) {
      setConnectedChain(null);
      setConnectingWallet("");
      onSelectRemote("solana", solanaProvider);
    }
  }, [
    connectedChain,
    evmAccount.isConnected,
    evmProvider,
    solanaAccount.isConnected,
    solanaProvider,
    onSelectRemote,
  ]);

  const handleRemoteSelect = useCallback(async (chain, walletId) => {
    setConnectingWallet(walletId);
    setConnectedChain(null);
    await (chain === "ethereum" ? connectEvm : connectSolana)(walletId);
  }, [connectEvm, connectSolana]);

  return (
    <PickerContent
      wallets={wallets}
      error={error}
      onClose={onClose}
      onSelectInjected={onSelectInjected}
      onSelectRemote={handleRemoteSelect}
      onConnectionError={onConnectionError}
      connectingWallet={connectingWallet}
      remoteReady={Boolean(evmReady || solanaReady)}
      walletConnectEnabled
    />
  );
}
