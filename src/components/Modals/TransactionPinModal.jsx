import React, { useState, useEffect } from 'react';

const TransactionPinModal = ({ onConfirm, onClose }) => {
  const [pin, setPin] = useState(['', '', '', '']);

  const handleKeyPress = (e) => {
    const value = e.key;
    if (value >= '0' && value <= '9') {
      const newPin = [...pin];
      const index = newPin.findIndex((p) => p === '');
      if (index !== -1) {
        newPin[index] = value;
        setPin(newPin);
        if (newPin.every((p) => p !== '')) {
          onConfirm(newPin.join(''));
        }
      }
    } else if (value === 'Backspace') {
      const newPin = [...pin];
      const index = newPin.findLastIndex((p) => p !== '');
      if (index !== -1) {
        newPin[index] = '';
        setPin(newPin);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pin]);

  return (
    <div className="modal-overlay">
      <div className="transaction-modal">
        <h3>Enter Transaction PIN</h3>
        <div className="pin-input">
          {pin.map((digit, index) => (
            <div key={index} className="pin-dot">
              {digit ? '•' : ''}
            </div>
          ))}
        </div>
        <button onClick={onClose} className="cancel-btn">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TransactionPinModal;