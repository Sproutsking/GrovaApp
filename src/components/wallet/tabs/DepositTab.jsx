// src/components/wallet/tabs/DepositTab.jsx
import React, { useState } from 'react';
import { X, Download, ArrowBigLeft } from 'lucide-react';

const DepositTab = ({ setActiveTab }) => {
  const [depositForm, setDepositForm] = useState({ method: 'USDT', amount: '' });
  const rates = { USDTtoGT: 1, NGNtoGT: 1 / 2.5, CredittoGT: 1 / 2.5 }; // Assumptions
  const paymentOptions = ['USDT', 'NGN Bank', 'Credit Card'];

  const rate = rates[`${depositForm.method.replace(' ', '')}toGT`];
  const gettingGT = (parseFloat(depositForm.amount) || 0) * rate;
  const currency = depositForm.method === 'USDT' ? 'USDT' : depositForm.method === 'NGN Bank' ? 'NGN' : 'NGN'; // Credit in NGN

  const handleDeposit = () => {
    console.log('Depositing:', depositForm, 'Getting:', gettingGT);
  };

  return (
    <>
      <div className="view-header">
        <button onClick={() => setActiveTab('overview')} className="back-btn">
          <ArrowBigLeft size={20} />
        </button>
        <div>
          <h2 className="view-title">Deposit</h2>
          <p className="view-subtitle">Add funds to your wallet</p>
        </div>
      </div>
      <div className="form-card">
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select
            className="token-select"
            value={depositForm.method}
            onChange={(e) => setDepositForm({ ...depositForm, method: e.target.value })}
          >
            {paymentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Amount</label>
          <div className="input-with-suffix">
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={depositForm.amount}
              onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
            />
            <span className="input-suffix">{currency}</span>
          </div>
          <div className="form-hint">
            You will get: {gettingGT.toFixed(2)} GT
          </div>
        </div>
      </div>
      <div className="transaction-summary">
        <h4 className="summary-title">Deposit Summary</h4>
        <div className="summary-row">
          <span>Amount</span>
          <strong>{depositForm.amount || '0.00'} {currency}</strong>
        </div>
        <div className="summary-row">
          <span>Rate</span>
          <span>1 {currency} = {rate.toFixed(2)} GT</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-row total">
          <span>You Get</span>
          <strong>{gettingGT.toFixed(2)} GT</strong>
        </div>
      </div>
      <button
        className="btn-primary"
        disabled={!depositForm.amount}
        onClick={handleDeposit}
      >
        <Download size={18} />
        Deposit
      </button>
    </>
  );
};

export default DepositTab;