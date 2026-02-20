// src/components/wallet/components/QuickActions.jsx
import React from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Download,
  Repeat,
  Settings,
  TrendingUp,
} from "lucide-react";

const QuickActions = ({ setActiveTab }) => {
  return (
    <div className="quick-actions">
      <button
        className="quick-action-btn primary"
        onClick={() => setActiveTab("send")}
      >
        <div className="button-icon">
          <ArrowUpRight size={20} />
        </div>
        <span>Send</span>
      </button>
      <button
        className="quick-action-btn primary"
        onClick={() => setActiveTab("deposit")}
      >
        <div className="button-icon">
          <Download size={20} />
        </div>
        <span>Deposit</span>
      </button>
      <button
        className="quick-action-btn primary"
        onClick={() => setActiveTab("receive")}
      >
        <div className="button-icon">
          <ArrowDownLeft size={20} />
        </div>
        <span>Receive</span>
      </button>
      <button
        className="quick-action-btn secondary"
        onClick={() => setActiveTab("swap")}
      >
        <div className="button-icon">
          <Repeat size={20} />
        </div>
        <span>Swap</span>
      </button>
      <button
        className="quick-action-btn secondary"
        onClick={() => setActiveTab("trade")}
      >
        <div className="button-icon">
          <TrendingUp size={20} />
        </div>
        <span>Trade</span>
      </button>
      <button
        className="quick-action-btn secondary"
        onClick={() => setActiveTab("trade")}
      >
        <div className="button-icon">
          <Wallet size={20} />
        </div>
        <span>Pay Wave</span>
      </button>
      <button
        className="quick-action-btn"
        onClick={() => setActiveTab("settings")}
      >
        <div className="button-icon">
          <Settings size={20} />
        </div>
        <span>Settings</span>
      </button>
    </div>
  );
};

export default QuickActions;
