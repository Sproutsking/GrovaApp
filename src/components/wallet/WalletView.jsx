// src/components/wallet/WalletView.jsx
import React, { useState, useEffect, useCallback } from "react";
import "./styles/WalletStyles.css";
import "./styles/tradeStyles.css";
import OverviewTab  from "./tabs/OverviewTab";
import SendTab      from "./tabs/SendTab";
import DepositTab   from "./tabs/DepositTab";
import ReceiveTab   from "./tabs/ReceiveTab";
import SwapTab      from "./tabs/SwapTab";
import TradeTab     from "./tabs/TradeTab";
import SettingsTab  from "./tabs/SettingsTab";
import PayWave      from "./paywave/PayWaveWrapper";           // ✅ actual path
import { walletService } from "../../services/wallet/walletService";
import { epService }     from "../../services/wallet/epService";
import { CurrencyProvider } from "../../contexts/CurrencyContext"; // ✅ src/contexts/
import { useAuth }         from "../Auth/AuthContext";

const WalletView = ({
  userBalance: initialBalance,
  setUserBalance,
  isMobile,
  userId,
  refreshTrigger,
}) => {
  const { profile } = useAuth();

  const [activeTab,    setActiveTab]    = useState("overview");
  const [showPayWave,  setShowPayWave]  = useState(false);
  const [balance,      setBalance]      = useState(initialBalance || { tokens: 0, points: 0 });
  const [loading,      setLoading]      = useState(false);
  const [transactions, setTransactions] = useState([]);

  const loadWallet = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [walletData, txData] = await Promise.all([
        walletService.getWallet(userId),
        walletService.getRecentTransactions(userId, 20),
      ]);
      if (walletData) {
        const newBalance = {
          tokens: walletData.xev_tokens        ?? 0,
          points: walletData.engagement_points ?? 0,
        };
        setBalance(newBalance);
        if (setUserBalance) setUserBalance(newBalance);
      }
      if (txData) setTransactions(txData);
    } catch (err) {
      console.error("Wallet load error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, setUserBalance]);

  useEffect(() => { loadWallet(); }, [loadWallet, refreshTrigger]);

  // Real-time balance subscription
  useEffect(() => {
    if (!userId) return;
    const unsub = walletService.subscribeToBalance(userId, (newBalance) => {
      setBalance(newBalance);
      if (setUserBalance) setUserBalance(newBalance);
    });
    return () => unsub?.();
  }, [userId, setUserBalance]);

  const handleTabChange = (tab) => {
    if (tab === "paywave") { setShowPayWave(true); return; }
    setActiveTab(tab);
  };

  const sharedProps = {
    setActiveTab:    handleTabChange,
    userId,
    balance,
    onRefresh:       loadWallet,
    transactions,
    setTransactions,
    username:        profile?.username,
  };

  if (showPayWave) {
    return (
      <CurrencyProvider>
        <PayWave
          userId={userId}
          epBalance={balance.points}
          onBack={() => setShowPayWave(false)}
        />
      </CurrencyProvider>
    );
  }

  return (
    <CurrencyProvider>
      <div className="wallet-app">
        <div className="wallet-container">
          <div className="wallet-bg-gradient" />
          <div className="wallet-content">
            {activeTab === "overview"  && <OverviewTab  {...sharedProps} loading={loading} />}
            {activeTab === "send"      && <SendTab      {...sharedProps} />}
            {activeTab === "deposit"   && <DepositTab   {...sharedProps} />}
            {activeTab === "receive"   && <ReceiveTab   {...sharedProps} />}
            {activeTab === "swap"      && <SwapTab      {...sharedProps} />}
            {activeTab === "trade"     && <TradeTab     {...sharedProps} />}
            {activeTab === "settings"  && <SettingsTab  {...sharedProps} />}
          </div>
        </div>
      </div>
    </CurrencyProvider>
  );
};

export default WalletView;