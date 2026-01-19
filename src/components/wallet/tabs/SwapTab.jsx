// src/components/wallet/tabs/SwapTab.jsx
import React, { useState } from 'react';
import { X, Repeat, TrendingUp, ArrowBigLeft } from 'lucide-react';

const SwapTab = ({ setActiveTab }) => {
  const [swapForm, setSwapForm] = useState({ fromToken: 'GT', toToken: 'ETH', amount: '' });
  const swapRates = { GT: { ETH: 0.001, USDT: 1 }, BTC: { GT: 1000 }, ETH: { GT: 1000 } }; // Assumptions

  const getRate = () => swapRates[swapForm.fromToken]?.[swapForm.toToken] || 0;
  const toAmount = (parseFloat(swapForm.amount) || 0) * getRate();

  return (
    <>
      <div className="view-header">
        <button onClick={() => setActiveTab('overview')} className="back-btn">
          <ArrowBigLeft size={20} />
        </button>
        <div>
          <h2 className="view-title">Swap Tokens</h2>
          <p className="view-subtitle">Exchange tokens instantly</p>
        </div>
      </div>
      <div className="swap-container">
        <div className="swap-card">
          <div className="swap-label">From</div>
          <div className="swap-input-group">
            <input
              type="number"
              className="swap-input"
              placeholder="0.00"
              value={swapForm.amount}
              onChange={(e) => setSwapForm({ ...swapForm, amount: e.target.value })}
            />
            <select
              className="token-select"
              value={swapForm.fromToken}
              onChange={(e) => setSwapForm({ ...swapForm, fromToken: e.target.value })}
            >
              <option value="GT">GT</option>
              <option value="EP">EP</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
              <option value="SOL">SOL</option>
              <option value="MON">MON</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          <div className="swap-balance">Balance: 1,250 GT</div>
        </div>
        <button className="swap-switch" onClick={() => setSwapForm({ ...swapForm, fromToken: swapForm.toToken, toToken: swapForm.fromToken })}>
          <Repeat size={20} />
        </button>
        <div className="swap-card">
          <div className="swap-label">To</div>
          <div className="swap-input-group">
            <input
              type="number"
              className="swap-input"
              placeholder="0.00"
              value={toAmount.toFixed(6)}
              readOnly
            />
            <select
              className="token-select"
              value={swapForm.toToken}
              onChange={(e) => setSwapForm({ ...swapForm, toToken: e.target.value })}
            >
              <option value="GT">GT</option>
              <option value="EP">EP</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
              <option value="SOL">SOL</option>
              <option value="MON">MON</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
        </div>
        <div className="swap-rate">
          <TrendingUp size={16} />
          <span>1 {swapForm.fromToken} = {getRate()} {swapForm.toToken}</span>
        </div>
      </div>
      <button className="btn-primary" disabled={!swapForm.amount}>
        <Repeat size={20} />
        Swap
      </button>
    </>
  );
};

export default SwapTab;