// src/components/wallet/components/AssetsList.jsx
import React from 'react';
import { Coins, Zap } from 'lucide-react';

const AssetsList = ({ userBalance, loading, hideBalance }) => {
  // Mirror BalanceCard: only show real values once loading is done
  const tokens = !loading ? (userBalance?.tokens ?? 0) : null;
  const points = !loading ? (userBalance?.points ?? 0) : null;

  const fmt = (n) => n.toLocaleString('en');
  const epDisplay = points !== null
    ? (points >= 1000 ? `${(points / 1000).toFixed(1)}K` : fmt(points))
    : '—';

  return (
    <div className="assets-section">
      <h3 className="section-title">Your Assets</h3>

      {/* $XEV Token */}
      <div className="asset-card premium">
        <div className="asset-glow"></div>
        <div className="asset-icon primary">
          <Coins size={20} />
        </div>
        <div className="asset-info">
          <h4 className="asset-name">$XEV Token</h4>
          <p className="asset-symbol">$XEV · Xeevia</p>
        </div>
        <div className="asset-balance">
          <span className="asset-amount">
            {hideBalance ? '••••••' : (tokens !== null ? fmt(tokens) : '—')}
          </span>
          <span className="asset-change positive">+12.5%</span>
        </div>
      </div>

      {/* Engagement Points */}
      <div className="asset-card">
        <div className="asset-icon secondary">
          <Zap size={20} />
        </div>
        <div className="asset-info">
          <h4 className="asset-name">Engagement Points</h4>
          <p className="asset-symbol">EP · Non-withdrawable</p>
        </div>
        <div className="asset-balance">
          <span className="asset-amount">
            {hideBalance ? '••••' : epDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AssetsList;