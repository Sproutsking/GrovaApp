// src/components/wallet/tabs/SendTab.jsx
import React, { useState } from 'react';
import { X, Send, Coins, Eye, ArrowBigLeft } from 'lucide-react';

const SendTab = ({ setActiveTab }) => {
  const [sendType, setSendType] = useState(null);
  const [sendForm, setSendForm] = useState({ address: '', amount: '' });
  const userBalance = { tokens: 1250, points: 3420 };
  const rates = { GTtoNGN: 2.5, EPtoNGN: 1 }; // Assuming EP rate for display

  const handleSend = () => {
    console.log('Sending:', sendForm, 'Type:', sendType);
  };

  if (!sendType) {
    return (
      <>
        <div className="view-header">
          <button onClick={() => setActiveTab('overview')} className="back-btn">
            <ArrowBigLeft size={20} />
          </button>
          <div>
            <h2 className="view-title">Send</h2>
            <p className="view-subtitle">Choose what to send</p>
          </div>
        </div>
        <div className="send-options">
          <button className="send-option-btn" onClick={() => setSendType('tokens')}>
            <Coins size={18} />
            Send (GT)
          </button>
          <button className="send-option-btn" onClick={() => setSendType('points')} style={{ marginTop: '12px' }}>
            <Eye size={18} />
            Send (EP)
          </button>
        </div>
      </>
    );
  }

  const balance = sendType === 'tokens' ? userBalance.tokens : userBalance.points;
  const currency = sendType === 'tokens' ? 'GT' : 'EP';
  const rate = sendType === 'tokens' ? rates.GTtoNGN : rates.EPtoNGN;
  const converted = (parseFloat(sendForm.amount) || 0) * rate;

  return (
    <>
      <div className="view-header">
        <button onClick={() => setSendType(null)} className="back-btn">
          <ArrowBigLeft size={20} />
        </button>
        <div>
          <h2 className="view-title">Send {currency}</h2>
          <p className="view-subtitle">Transfer {currency} securely</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-group">
          <label className="form-label">Recipient Address</label>
          <input
            type="text"
            className="form-input"
            placeholder="0x1234...abcd"
            value={sendForm.address}
            onChange={(e) => setSendForm({ ...sendForm, address: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Amount</label>
          <div className="input-with-suffix">
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={sendForm.amount}
              onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
            />
            <span className="input-suffix">{currency}</span>
          </div>
          <div className="form-hint">
            Available: {balance} {currency} ≈ ₦{balance * rate} NGN
          </div>
          <div className="form-hint">
            Converted: ≈ ₦{converted.toLocaleString()} NGN
          </div>
        </div>
      </div>
      <div className="transaction-summary">
        <h4 className="summary-title">Transaction Summary</h4>
        <div className="summary-row">
          <span>Amount</span>
          <strong>{sendForm.amount || '0.00'} {currency}</strong>
        </div>
        <div className="summary-row">
          <span>Network Fee</span>
          <span>0.002 {currency}</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-row total">
          <span>Total</span>
          <strong>{(parseFloat(sendForm.amount) + 0.002 || 0.002).toFixed(3)} {currency}</strong>
        </div>
        <div className="summary-row">
          <span>Converted Total</span>
          <strong>≈ ₦{((parseFloat(sendForm.amount) + 0.002) * rate).toLocaleString()} NGN</strong>
        </div>
      </div>
      <button
        className="btn-primary"
        disabled={!sendForm.address || !sendForm.amount}
        onClick={handleSend}
      >
        <Send size={18} />
        Send {currency}
      </button>
    </>
  );
};

export default SendTab;