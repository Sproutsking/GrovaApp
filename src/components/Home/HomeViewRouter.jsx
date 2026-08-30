// ============================================================================
// src/components/Home/HomeViewRouter.jsx — Trinity Mode Router
// ============================================================================
// Conditionally renders different home experiences based on active Trinity mode
// 'everyday' → Standard social feed
// 'gaming'   → Gaming-focused clips & streams
// 'web3'     → Web3 alpha & token tracking
// ============================================================================

import React, { lazy, Suspense } from "react";
import useTrinitylens, { normalizeTrinityLens } from "../../hooks/useTrinitylens";
import HomeView from "./HomeView";
import UnifiedLoader from "../Shared/UnifiedLoader";

// Lazy load gaming and web3 views
const GamingHomeView = lazy(() => import("./GamingHomeView"));
const Web3HomeView = lazy(() => import("./Web3HomeView"));

const HomeViewRouter = (props) => {
  const { activeTrinityLens } = useTrinitylens();
  const safeLens = normalizeTrinityLens(activeTrinityLens);
  const validTabs = {
    everyday: ["feed", "stories", "news", "sports", "culture"],
    gaming: ["feed", "clips", "news", "sports", "live"],
    web3: ["feed", "news", "sports", "alpha", "tokens", "signals"],
  }[safeLens] || ["feed", "stories", "news", "sports", "culture"];
  const activeHomeTab = validTabs.includes(props.activeHomeTab)
    ? props.activeHomeTab
    : validTabs[0];

  return (
    <Suspense fallback={<UnifiedLoader />}>
      {safeLens === "everyday" && <HomeView {...props} trinityLens="everyday" activeHomeTab={activeHomeTab} />}
      {safeLens === "gaming" && <GamingHomeView {...props} trinityLens="gaming" activeHomeTab={activeHomeTab} />}
      {safeLens === "web3" && <Web3HomeView {...props} trinityLens="web3" activeHomeTab={activeHomeTab} />}
    </Suspense>
  );
};

export default HomeViewRouter;
