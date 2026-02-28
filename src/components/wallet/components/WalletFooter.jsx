// src/components/wallet/components/WalletFooter.jsx
import React from 'react';
import { Shield } from 'lucide-react';

const WalletFooter = () => {
  return (
    <div className="wallet-footer">
      <div className="footer-notice">
        <Shield size={16} />
        <div>
          <p className="footer-label">Xeevia Stability Protocol</p>
          <p className="footer-text">
            Next withdrawal available in <strong>45 days</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletFooter;