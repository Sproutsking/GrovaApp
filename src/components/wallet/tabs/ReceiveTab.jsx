// src/components/wallet/tabs/ReceiveTab.jsx
import React, { useState } from 'react';
import { X, CheckCircle, Copy, QrCode, Shield, ArrowBigLeft } from 'lucide-react';

const ReceiveTab = ({ setActiveTab }) => {
  const [copiedAddress, setCopiedAddress] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText("0x1234...abcd");
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <>
      <div className="view-header">
        <button onClick={() => setActiveTab('overview')} className="back-btn">
          <ArrowBigLeft size={20} />
        </button>
        <div>
          <h2 className="view-title">Receive Tokens</h2>
          <p className="view-subtitle">Share your address to receive GT</p>
        </div>
      </div>
      <div className="qr-section">
        <div className="qr-box">
          <div className="qr-placeholder">
            <QrCode size={80} strokeWidth={1.5} />
          </div>
        </div>
        <p className="qr-hint">Scan to send tokens to this wallet</p>
      </div>
      <div className="address-card">
        <div className="address-label">Your Wallet Address</div>
        <div className="address-box">
          <code className="address-text">0x1234...abcd</code>
          <button
            className={`copy-btn ${copiedAddress ? 'copied' : ''}`}
            onClick={copyAddress}
          >
            {copiedAddress ? <CheckCircle size={18} /> : <Copy size={18} />}
          </button>
        </div>
        {copiedAddress && (
          <div className="copy-success">Address copied to clipboard!</div>
        )}
      </div>
      <div className="info-box">
        <Shield size={20} />
        <div>
          <h4>Secure Transactions</h4>
          <p>Only share this address with trusted sources. Verify the sender before confirming transactions.</p>
        </div>
      </div>
    </>
  );
};

export default ReceiveTab;