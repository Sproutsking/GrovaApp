// src/components/wallet/components/AssetsList.jsx
import React from 'react';
import { Coins, Eye } from 'lucide-react';

const AssetsList = ({ userBalance }) => {
  return (
    <div className="assets-section">
      <h3 className="section-title">Your Assets</h3>
      <div className="asset-card premium">
        <div className="asset-glow"></div>
        <div className="asset-icon primary">
          <Coins size={20} />
        </div>
        <div className="asset-info">
          <h4 className="asset-name">Grova Tokens</h4>
          <p className="asset-symbol">GT</p>
        </div>
        <div className="asset-balance">
          <span className="asset-amount">{userBalance.tokens.toLocaleString()}</span>
          <span className="asset-change positive">+12.5%</span>
        </div>
      </div>
      <div className="asset-card">
        <div className="asset-icon secondary">
          <Eye size={20} />
        </div>
        <div className="asset-info">
          <h4 className="asset-name">Engagement Points</h4>
          <p className="asset-symbol">EP • Non-withdrawable</p>
        </div>
        <div className="asset-balance">
          <span className="asset-amount">{userBalance.points.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default AssetsList;