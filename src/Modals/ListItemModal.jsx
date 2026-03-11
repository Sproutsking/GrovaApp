// src/components/Modals/ListItemModal.jsx
import React, { useState } from 'react';
import { X, TrendingUp, AlertCircle } from 'lucide-react';

const ListItemModal = ({ onList, onClose, selectedItem }) => {
  const [price, setPrice] = useState(selectedItem?.unlockCost * 1.5 || 0);
  const suggestedPrice = selectedItem?.unlockCost * 1.5;
  const minPrice = selectedItem?.unlockCost * 1.2;
  const royaltyAmount = price * 0.1;
  const yourEarnings = price - royaltyAmount;

  const handleList = () => {
    if (price < minPrice) {
      alert(`Minimum listing price is ${minPrice} GT (120% of original price)`);
      return;
    }
    onList(selectedItem, price);
  };

  return (
    <div className="modal-overlay">
      <div className="list-modal-content">
        {/* Header */}
        <div className="modal-header">
          <h3>List on Open Market</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Story Info */}
        <div className="list-story-info">
          <div className="list-story-title">
            <strong>{selectedItem?.title}</strong>
          </div>
          <div className="list-story-meta">
            <span>Original Price: {selectedItem?.unlockCost} GT</span>
            <span className="sold-out-badge">• SOLD OUT</span>
          </div>
        </div>

        {/* Info Alert */}
        <div className="list-info-alert">
          <AlertCircle size={20} />
          <p>
            This story has reached maximum accesses. You can now list it for resale 
            and earn from secondary market trades!
          </p>
        </div>

        {/* Price Input */}
        <div className="list-price-section">
          <label className="list-label">
            Set Your Price
          </label>
          <div className="list-price-input-wrapper">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              placeholder="Enter price"
              min={minPrice}
              step={0.1}
            />
            <span className="list-currency">GT</span>
          </div>
          
          {/* Price Suggestions */}
          <div className="list-price-suggestions">
            <button 
              className="suggestion-btn"
              onClick={() => setPrice(suggestedPrice)}
            >
              Suggested: {suggestedPrice} GT
            </button>
            <button 
              className="suggestion-btn"
              onClick={() => setPrice(suggestedPrice * 2)}
            >
              Premium: {(suggestedPrice * 2).toFixed(1)} GT
            </button>
          </div>
        </div>

        {/* Breakdown */}
        <div className="list-breakdown">
          <div className="breakdown-row">
            <span>Listing Price</span>
            <strong>{price.toFixed(1)} GT</strong>
          </div>
          <div className="breakdown-row royalty">
            <span>
              <TrendingUp size={16} />
              Creator Royalty (10%)
            </span>
            <span>-{royaltyAmount.toFixed(1)} GT</span>
          </div>
          <div className="breakdown-row total">
            <span>You'll Receive</span>
            <strong className="earnings">{yourEarnings.toFixed(1)} GT</strong>
          </div>
        </div>

        {/* Minimum Price Warning */}
        {price < minPrice && price > 0 && (
          <div className="list-warning">
            <AlertCircle size={16} />
            <span>Price must be at least {minPrice} GT</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="list-actions">
          <button 
            className="list-btn-primary" 
            onClick={handleList}
            disabled={price < minPrice}
          >
            List for Sale
          </button>
          <button className="list-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>

        {/* Terms */}
        <div className="list-terms">
          <p>
            By listing, you agree that 10% of the sale price will be paid as 
            royalty to the original creator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ListItemModal;