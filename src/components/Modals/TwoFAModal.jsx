import React, { useState, useEffect } from 'react';

const TwoFAModal = ({ onConfirm, onClose }) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);

  const handleKeyPress = (e) => {
    const value = e.key;
    if (value >= '0' && value <= '9') {
      const newCode = [...code];
      const index = newCode.findIndex((c) => c === '');
      if (index !== -1) {
        newCode[index] = value;
        setCode(newCode);
        if (newCode.every((c) => c !== '')) {
          onConfirm(newCode.join(''));
        }
      }
    } else if (value === 'Backspace') {
      const newCode = [...code];
      const index = newCode.findLastIndex((c) => c !== '');
      if (index !== -1) {
        newCode[index] = '';
        setCode(newCode);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [code]);

  return (
    <div className="modal-overlay">
      <div className="transaction-modal">
        <h3>Enter 2FA Code</h3>
        <div className="code-input">
          {code.map((digit, index) => (
            <div key={index} className="code-box">
              {digit}
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

export default TwoFAModal;