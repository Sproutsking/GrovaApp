// src/components/wallet/components/QuickActions.jsx
import React from 'react';
import { ArrowUpRight, ArrowDownLeft, Wallet, Download, Repeat, TrendingUp } from 'lucide-react';

const QuickActions = ({ setActiveTab }) => {
  return (
    <div className="quick-actions">
      <button className="quick-action-btn primary" onClick={() => setActiveTab('send')}>
        <ArrowUpRight size={20} />
        <span>Send</span>
      </button>
      <button className="quick-action-btn primary" onClick={() => setActiveTab('deposit')}>
        <Download size={20} />
        <span>Deposit</span>
      </button>
      <button className="quick-action-btn primary" onClick={() => setActiveTab('receive')}>
        <ArrowDownLeft size={20} />
        <span>Receive</span>
      </button>
      <button className="quick-action-btn secondary" onClick={() => setActiveTab('swap')}>
        <Repeat size={20} />
        <span>Swap</span>
      </button>
      <button className="quick-action-btn secondary" onClick={() => setActiveTab('trade')}>
        <TrendingUp size={20} />
        <span>Trade</span>
      </button>
      <button className="quick-action-btn secondary" onClick={() => setActiveTab('trade')}>
        <Wallet size={20} />
        <span>Pay Wave</span>
      </button>
    </div>
  );
};

export default QuickActions;