// src/components/wallet/components/WalletHeader.jsx
import React from 'react';
import { Settings } from 'lucide-react';

const WalletHeader = ({ setActiveTab }) => {
  return (
    <div className="wallet-header">
      <div>
        <h2 className="wallet-title">Your Wallet</h2>
        <p className="wallet-subtitle">Manage your digital assets</p>
      </div>
      <button onClick={() => setActiveTab('settings')} className="icon-btn">
        <Settings size={20} />
      </button>
    </div>
  );
};

export default WalletHeader;