// ============================================================================
// src/components/wallet/WalletViewRouter.jsx — Trinity Mode Wallet Router
// ============================================================================
// Conditionally renders different wallet layouts based on Trinity mode
// 'everyday' → Balance matrix, fiat pay-in/withdraw, PayWave modules
// 'gaming'   → Asset-centric, gaming micro-tips, escrow, virtual coins
// 'web3'     → On-chain view, wallet signatures, staking, token swaps
// ============================================================================

import React from "react";
import WalletView from "./WalletView";

const WalletViewRouter = (props) => {
  return <WalletView {...props} />;
};

export default WalletViewRouter;
