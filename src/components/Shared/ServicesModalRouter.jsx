// ============================================================================
// src/components/Shared/ServicesModalRouter.jsx — Trinity Mode Services Router
// ============================================================================
// Conditionally renders different services overlays based on Trinity mode
// 'everyday' → Standard multi-category services
// 'gaming'   → Gaming-focused services (trading, matchmaking, clans)
// 'web3'     → Web3-focused services (oracles, analytics, tooling)
// ============================================================================

import React from "react";
import useTrinitylens, { normalizeTrinityLens } from "../../hooks/useTrinitylens";
import ServicesModal from "./ServicesModal";

const ServicesModalRouter = (props) => {
  const { activeTrinityLens } = useTrinitylens();
  const safeLens = normalizeTrinityLens(activeTrinityLens);

  return <div style={{ willChange: "contents" }}><ServicesModal {...props} trinityLens={safeLens} /></div>;
};

export default ServicesModalRouter;
