// src/components/wallet/components/BalanceCard.jsx
import React from 'react';
import { Coins } from 'lucide-react';

const BalanceCard = ({ userBalance }) => {
  const rates = { GTtoNGN: 2.5 };
  return (
    <div className="balance-showcase">
      <div className="balance-primary">
        <div className="balance-icon">
          <Coins size={24} />
        </div>
        <div className="balance-info">
          <span className="balance-label">Total Balance</span>
          <h1 className="balance-amount">
            {userBalance.tokens.toLocaleString()}
            <span className="balance-currency">GT</span>
          </h1>
          <p className="balance-converted">≈ ₦{(userBalance.tokens * rates.GTtoNGN).toLocaleString()} NGN</p>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;