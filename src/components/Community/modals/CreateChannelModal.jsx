import React, { useState } from "react";
import { X, Hash, Volume2, Bell } from "lucide-react";

const CreateChannelModal = ({ onClose, onCreate, communityId }) => {
  const [formData, setFormData] = useState({
    name: "",
    icon: "💬",
    description: "",
    type: "text",
    isPrivate: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const channelTypes = [
    {
      value: "text",
      label: "Text Channel",
      icon: Hash,
      gradient: "linear-gradient(135deg, #9cff00 0%, #667eea 100%)",
    },
    {
      value: "voice",
      label: "Voice Channel",
      icon: Volume2,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      value: "announcement",
      label: "Announcement",
      icon: Bell,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Channel name is required");
      return;
    }

    if (formData.name.length < 1 || formData.name.length > 50) {
      setError("Channel name must be between 1 and 50 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onCreate({
        community_id: communityId,
        name: formData.name.trim().toLowerCase().replace(/\s+/g, "-"),
        icon: formData.icon || "💬",
        description: formData.description || null,
        type: formData.type || "text",
        is_private: formData.isPrivate,
      });
      onClose();
    } catch (err) {
      console.error("Error creating channel:", err);
      setError(err.message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title">Create Channel</span>
            <button className="close-modal" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label className="form-label">Channel Type</label>
              <div className="channel-type-grid">
                {channelTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      className={`channel-type-card ${formData.type === type.value ? "selected" : ""}`}
                      onClick={() =>
                        setFormData({ ...formData, type: type.value })
                      }
                    >
                      <div
                        className="type-icon"
                        style={{ background: type.gradient }}
                      >
                        <Icon size={20} />
                      </div>
                      <span>{type.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Channel Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., general, announcements"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={50}
              />
              <small className="help-text">
                Will be formatted as:{" "}
                {formData.name.toLowerCase().replace(/\s+/g, "-") ||
                  "channel-name"}
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Channel Icon</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter emoji (e.g., 💬, 📢, 🎮)"
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                maxLength={2}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea
                className="form-textarea"
                placeholder="Describe the purpose of this channel..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
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
                <span className="checkbox-label">
                  Make this channel private
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="action-btn secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="action-btn primary"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? "Creating..." : "Create Channel"}
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
          max-width: 520px;
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

        .channel-type-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .channel-type-card {
          padding: 16px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #999;
        }

        .channel-type-card:hover {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }

        .channel-type-card.selected {
          background: rgba(156, 255, 0, 0.1);
          border-color: #9cff00;
          color: #9cff00;
          box-shadow: 0 0 24px rgba(156, 255, 0, 0.3);
        }

        .type-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .channel-type-card span {
          font-size: 12px;
          font-weight: 600;
          text-align: center;
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
          display: block;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
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

          .channel-type-grid {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </>
  );
};

export default CreateChannelModal;
