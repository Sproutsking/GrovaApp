// src/components/wallet/tabs/OverviewTab.jsx
import React from 'react';
import WalletHeader from '../components/WalletHeader';
import BalanceCard from '../components/BalanceCard';
import QuickActions from '../components/QuickActions';
import AssetsList from '../components/AssetsList';
import WalletFooter from '../components/WalletFooter';

const OverviewTab = ({ setActiveTab }) => {
  const userBalance = {
    tokens: 1250,
    points: 3420
  };

  return (
    <>
      <div className="wallet-hero">
        <div className="wallet-hero-glow"></div>
        <WalletHeader setActiveTab={setActiveTab} />
        <BalanceCard userBalance={userBalance} />
      </div>
      <QuickActions setActiveTab={setActiveTab} />
      <AssetsList userBalance={userBalance} />
      <WalletFooter />
    </>
  );
};

export default OverviewTab;