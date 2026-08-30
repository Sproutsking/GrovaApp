import React from "react";
import { AlertCircle, Coins, TrendingUp } from "lucide-react";
import HomeView from "./HomeView";

const TOKENS = [
  { symbol: "$XEV", name: "Xeevia Token", price: "0.0234", change: "+12.5%", up: true },
  { symbol: "ETH", name: "Ethereum", price: "2456.32", change: "+3.2%", up: true },
  { symbol: "SOL", name: "Solana", price: "145.67", change: "-2.1%", up: false },
];

const Web3HomeView = (props) => {
  const { activeHomeTab } = props;
  if (activeHomeTab === "feed" || activeHomeTab === "news" || activeHomeTab === "sports") {
    return <HomeView {...props} trinityLens="web3" activeHomeTab={activeHomeTab} />;
  }

  if (activeHomeTab === "tokens") {
    return <div style={{ padding: "16px" }}>{TOKENS.map((token) => (
      <div key={token.symbol} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--surface-border)" }}>
        <div><strong style={{ color: "var(--text)" }}>{token.symbol}</strong><div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{token.name}</div></div>
        <div style={{ textAlign: "right" }}><strong style={{ color: "var(--text)" }}>${token.price}</strong><div style={{ fontSize: "11px", color: token.up ? "#22c55e" : "#ef4444" }}>{token.change}</div></div>
      </div>
    ))}</div>;
  }

  const signals = activeHomeTab === "signals";
  const Icon = signals ? AlertCircle : TrendingUp;
  return <div style={{ padding: "16px" }}>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}><Icon size={16} color="#a855f7" /></div>
    {signals && <div style={{ color: "var(--text-secondary)", fontSize: "12px" }}>No signals yet</div>}
  </div>;
};

export default Web3HomeView;
