import React, { useState } from "react";
import { X } from "lucide-react";

const CreateCommunityModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "🌟",
    isPrivate: false,
    bannerGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const gradientOptions = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #9cff00 0%, #667eea 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  ];

  const handleSubmit = async () => {
    setError("");

    if (!formData.name.trim()) {
      setError("Community name is required");
      return;
    }

    if (formData.name.length < 3 || formData.name.length > 100) {
      setError("Community name must be between 3 and 100 characters");
      return;
    }

    try {
      setCreating(true);
      await onCreate(formData);
    } catch (err) {
      setError(err.message || "Failed to create community. Please try again.");
      setCreating(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title">Create Community</span>
            <button className="close-modal" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label className="form-label">Community Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter community name..."
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={100}
                required
                autoFocus
              />
              <p className="help-text">{formData.name.length}/100 characters</p>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Describe your community..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Community Icon</label>
              <div className="icon-input-wrapper">
                <div
                  className="icon-preview"
                  style={{ background: formData.bannerGradient }}
                >
                  {formData.icon}
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🌟"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData({ ...formData, icon: e.target.value })
                  }
                  maxLength={2}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Banner Gradient</label>
              <div className="gradient-grid">
                {gradientOptions.map((gradient, index) => (
                  <div
                    key={index}
                    className={`gradient-option ${formData.bannerGradient === gradient ? "selected" : ""}`}
                    style={{ background: gradient }}
                    onClick={() =>
                      setFormData({ ...formData, bannerGradient: gradient })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <div className="checkbox-item">
                <div
                  className={`checkbox ${formData.isPrivate ? "checked" : ""}`}
                  onClick={() =>
                    setFormData({ ...formData, isPrivate: !formData.isPrivate })
                  }
                >
                  {formData.isPrivate && <span>✓</span>}
                </div>
                <div>
                  <span className="checkbox-label">
                    Make this community private
                  </span>
                  <p className="help-text">
                    Only members can see and join this community
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="action-btn secondary"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn primary"
                onClick={handleSubmit}
                disabled={creating || !formData.name.trim()}
              >
                {creating ? "Creating..." : "Create Community"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: overlayFadeIn 0.2s ease;
          overflow-y: auto;
        }

        @keyframes overlayFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal {
          width: 100%;
          max-width: 580px;
          background: #0f0f0f;
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 20px;
          box-shadow:
            0 24px 64px rgba(0, 0, 0, 0.9),
            0 0 100px rgba(156, 255, 0, 0.15);
          overflow: hidden;
          animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin: auto;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .modal-header {
          padding: 24px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.2);
          background: linear-gradient(
            180deg,
            rgba(26, 26, 26, 0.9) 0%,
            rgba(15, 15, 15, 0) 100%
          );
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .close-modal {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .close-modal:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-body::-webkit-scrollbar {
          width: 8px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.5);
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.4);
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 255, 0, 0.6);
        }

        .error-message {
          padding: 14px 16px;
          background: rgba(255, 107, 107, 0.15);
          border: 2px solid rgba(255, 107, 107, 0.4);
          border-radius: 12px;
          color: #ff6b6b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
          animation: shake 0.4s;
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

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 14px 16px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.3s;
          outline: none;
        }

        .form-input:focus,
        .form-textarea:focus {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.6);
          box-shadow: 0 0 0 4px rgba(156, 255, 0, 0.1);
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: #666;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .help-text {
          font-size: 11px;
          color: #666;
          margin-top: 6px;
        }

        .icon-input-wrapper {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .icon-preview {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          border: 2px solid rgba(156, 255, 0, 0.3);
        }

        .gradient-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .gradient-option {
          height: 56px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid rgba(42, 42, 42, 0.8);
          position: relative;
        }

        .gradient-option:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          border-color: rgba(156, 255, 0, 0.4);
        }

        .gradient-option.selected {
          border-color: #9cff00;
          box-shadow: 0 0 24px rgba(156, 255, 0, 0.5);
        }

        .gradient-option.selected::after {
          content: "✓";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-size: 20px;
          font-weight: 800;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
        }

        .checkbox-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
        }

        .checkbox {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .checkbox.checked {
          background: rgba(156, 255, 0, 0.3);
          border-color: #9cff00;
        }

        .checkbox span {
          color: #9cff00;
          font-weight: 800;
          font-size: 14px;
        }

        .checkbox-label {
          font-size: 14px;
          color: #fff;
          font-weight: 500;
          display: block;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }

        .action-btn {
          flex: 1;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-btn.secondary {
          background: rgba(26, 26, 26, 0.8);
          color: #999;
          border-color: rgba(42, 42, 42, 0.8);
        }

        .action-btn.secondary:hover:not(:disabled) {
          background: rgba(26, 26, 26, 1);
          color: #fff;
          border-color: rgba(156, 255, 0, 0.4);
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          color: #000;
          border-color: transparent;
          box-shadow: 0 4px 16px rgba(156, 255, 0, 0.4);
        }

        .action-btn.primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.6);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .modal {
            max-width: 100%;
            border-radius: 16px;
            max-height: 95vh;
          }

          .gradient-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .modal-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </>
  );
};

export default CreateCommunityModal;
