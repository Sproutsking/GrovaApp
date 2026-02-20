// src/components/wallet/WalletView.jsx
import React, { useState } from "react";
import "./styles/WalletStyles.css";
import "./styles/tradeStyles.css";
import OverviewTab from "./tabs/OverviewTab";
import SendTab from "./tabs/SendTab";
import DepositTab from "./tabs/DepositTab";
import ReceiveTab from "./tabs/ReceiveTab";
import SwapTab from "./tabs/SwapTab";
import TradeTab from "./tabs/TradeTab";
import SettingsTab from "./tabs/SettingsTab";

const WalletView = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="wallet-app">
      <div className="wallet-container">
        <div className="wallet-bg-gradient"></div>
        <div className="wallet-content">
          {activeTab === "overview" && (
            <OverviewTab setActiveTab={setActiveTab} />
          )}
          {activeTab === "send" && <SendTab setActiveTab={setActiveTab} />}
          {activeTab === "deposit" && (
            <DepositTab setActiveTab={setActiveTab} />
          )}
          {activeTab === "receive" && (
            <ReceiveTab setActiveTab={setActiveTab} />
          )}
          {activeTab === "swap" && <SwapTab setActiveTab={setActiveTab} />}
          {activeTab === "trade" && <TradeTab setActiveTab={setActiveTab} />}
          {activeTab === "settings" && (
            <SettingsTab setActiveTab={setActiveTab} />
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletView;
