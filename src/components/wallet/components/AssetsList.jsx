// src/components/wallet/components/AssetsList.jsx
//
// FIX: Accept both `balance` and `userBalance` prop names.
// WalletView passes `balance` through sharedProps → OverviewTab → here,
// but the old component only read `userBalance`, so EP was always undefined
// and fell back to whatever stale/random value was in scope.
// Now we resolve the correct object once at the top and never diverge.

import React from 'react';
import { Coins, Zap } from 'lucide-react';

const AssetsList = ({ balance, userBalance, loading, hideBalance }) => {
  // Resolve whichever prop name is actually provided.
  // WalletView → sharedProps spreads `balance`; some callers may still
  // use `userBalance`. Both are safe — we just pick the first truthy one.
  const bal = balance ?? userBalance ?? { tokens: 0, points: 0 };

  // Mirror BalanceCard exactly: show nothing while loading.
  const tokens = !loading ? (bal.tokens ?? 0) : null;
  const points = !loading ? (bal.points  ?? 0) : null;

  const fmt = (n) => Number(n).toLocaleString('en');

  const epDisplay =
    points !== null
      ? points >= 1000
        ? `${(points / 1000).toFixed(1)}K`
        : fmt(points)
      : '—';

  const xevDisplay =
    tokens !== null ? fmt(tokens) : '—';

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
          <p className="asset-symbol">Transferable · On-chain</p>
        </div>
        <div className="asset-balance">
          <span className="asset-amount">
            {hideBalance ? '••••••' : xevDisplay}
          </span>
          <span className="asset-change positive">≈ $0</span>
        </div>
      </div>

      {/* Engagement Points — must always match BalanceCard EP */}
      <div className="asset-card">
        <div className="asset-icon secondary">
          <Zap size={20} />
        </div>
        <div className="asset-info">
          <h4 className="asset-name">Engagement Points</h4>
          <p className="asset-symbol">Platform currency · Internal only</p>
        </div>
        <div className="asset-balance">
          <span className="asset-amount">
            {hideBalance ? '••••' : epDisplay}
          </span>
          <span className="asset-tag" style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'rgba(34,211,238,0.75)',
            background: 'rgba(34,211,238,0.08)',
            border: '1px solid rgba(34,211,238,0.18)',
            borderRadius: 4,
            padding: '1px 6px',
            marginTop: 3,
            display: 'inline-block',
          }}>INTERNAL</span>
        </div>
      </div>
    </div>
  );
};

export default AssetsList;