// ============================================================================
// src/components/Modals/TransactionPinModal.jsx - REFINED ELEGANT DESIGN (FIXED)
// ============================================================================
import React, { useState, useEffect, useRef } from "react";
import { Lock, X, AlertCircle, CheckCircle } from "lucide-react";

const TransactionPinModal = ({
  amount,
  recipient,
  transactionType = "transfer",
  description,
  onConfirm,
  onClose,
  icon,
  title,
}) => {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const getTitle = () => {
    if (title) return title;

    switch (transactionType) {
      case "unlock":
        return "Unlock Content";
      case "purchase":
        return "Confirm Purchase";
      case "withdraw":
        return "Withdraw Funds";
      case "deposit":
        return "Confirm Deposit";
      case "swap":
        return "Confirm Swap";
      case "transfer":
      default:
        return "Confirm Transaction";
    }
  };

  const getDescription = () => {
    if (description) return description;

    if (recipient) {
      switch (transactionType) {
        case "unlock":
          return `Unlock "${recipient}"`;
        case "transfer":
          return `Send to @${recipient}`;
        case "purchase":
          return `Purchase ${recipient}`;
        default:
          return recipient;
      }
    }

    return "Enter your PIN to continue";
  };

  const handleInputChange = (index, value) => {
    // Prevent invalid input
    if (value.length > 1) return;
    if (value !== "" && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError("");

    // Auto-focus next input
    if (value && index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }

    // Auto-submit when complete
    if (newPin.every((p) => p !== "")) {
      handleSubmit(newPin.join(""));
    }
  };

  const handleInputKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (pin[index] === "" && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1].focus();
      }
      // Note: clearing the current field is handled by onChange
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1].focus();
    } else if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault();
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();

    if (/^\d{4}$/.test(pasted)) {
      const digits = pasted.split("");
      setPin(digits);
      setError("");
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (pinValue) => {
    if (pinValue.length !== 4) {
      setError("Please enter complete PIN");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      await onConfirm(pinValue);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || "Invalid PIN. Please try again.");
      setPin(["", "", "", ""]);
      setIsProcessing(false);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const IconComponent = icon || Lock;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="transaction-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="close-modal-btn" onClick={onClose}>
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="modal-icon">
          <IconComponent size={28} />
        </div>

        {/* Title */}
        <h3 className="modal-title">{getTitle()}</h3>

        {/* Description */}
        <p className="modal-description">{getDescription()}</p>

        {/* Amount */}
        <div className="amount-box">
          <span className="amount-value">{amount?.toLocaleString() || 0}</span>
          <span className="amount-currency">GT</span>
        </div>

        {/* PIN Input */}
        <div className="pin-section">
          <label className="pin-label">Enter PIN</label>
          <div className="pin-inputs" onPaste={handlePaste}>
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="one-time-code"
                className={`pin-box ${digit ? "filled" : ""} ${error ? "error" : ""} ${success ? "success" : ""}`}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(index, e)}
                disabled={isProcessing || success}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="alert alert-success">
            <CheckCircle size={16} />
            <span>Transaction successful!</span>
          </div>
        )}

        {/* Processing */}
        {isProcessing && !success && (
          <div className="processing">
            <div className="spinner" />
            <span>Processing...</span>
          </div>
        )}

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="cancel-btn"
          disabled={isProcessing}
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.88);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease;
          padding: 20px;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .transaction-modal {
          background: linear-gradient(145deg, #1a1a1a, #0f0f0f);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 20px;
          width: 100%;
          max-width: 380px;
          padding: 32px 28px 28px 28px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          text-align: center;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .close-modal-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #737373;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .close-modal-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        .modal-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 20px auto;
          background: linear-gradient(
            135deg,
            rgba(132, 204, 22, 0.15),
            rgba(132, 204, 22, 0.08)
          );
          border: 2px solid rgba(132, 204, 22, 0.25);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
        }
        .modal-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px 0;
          text-align: center;
        }
        .modal-description {
          font-size: 14px;
          color: #a3a3a3;
          margin: 0 0 24px 0;
          text-align: center;
          line-height: 1.4;
        }
        .amount-box {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          padding: 12px 24px;
          background: rgba(132, 204, 22, 0.08);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          margin-bottom: 28px;
        }
        .amount-value {
          font-size: 24px;
          font-weight: 800;
          color: #84cc16;
        }
        .amount-currency {
          font-size: 15px;
          font-weight: 700;
          color: #84cc16;
          opacity: 0.8;
        }
        .pin-section {
          margin-bottom: 20px;
        }
        .pin-label {
          display: block;
          font-size: 12px;
          color: #a3a3a3;
          font-weight: 600;
          margin-bottom: 12px;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .pin-inputs {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .pin-box {
          width: 56px;
          height: 64px;
          background: rgba(255, 255, 255, 0.04);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 28px;
          font-weight: 700;
          text-align: center;
          transition: all 0.25s ease;
          outline: none;
          caret-color: #84cc16;
        }
        .pin-box:focus {
          background: rgba(132, 204, 22, 0.08);
          border-color: #84cc16;
          box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.12);
        }
        .pin-box.filled {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.4);
        }
        .pin-box.error {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.5);
          animation: shake 0.4s ease;
        }
        .pin-box.success {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.5);
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-8px);
          }
          75% {
            transform: translateX(8px);
          }
        }
        .pin-box:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .alert {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
          animation: slideIn 0.3s ease;
        }
        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        .alert-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .processing {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          color: #84cc16;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .cancel-btn {
          width: 100%;
          max-width: 200px;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #a3a3a3;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin: 0 auto;
          display: block;
        }
        .cancel-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (max-width: 480px) {
          .transaction-modal {
            max-width: 340px;
            padding: 28px 24px 24px 24px;
          }
          .modal-title {
            font-size: 20px;
          }
          .modal-description {
            font-size: 13px;
          }
          .amount-value {
            font-size: 22px;
          }
          .pin-box {
            width: 52px;
            height: 60px;
            font-size: 26px;
          }
          .pin-inputs {
            gap: 8px;
          }
        }
        @media (max-width: 360px) {
          .transaction-modal {
            max-width: 300px;
            padding: 24px 20px 20px 20px;
          }
          .pin-box {
            width: 48px;
            height: 56px;
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
};

export default TransactionPinModal;
