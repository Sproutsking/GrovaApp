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
  const [error, setError]       = useState("");

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

    const name = formData.name.trim();

    if (!name) {
      setError("Community name is required");
      return;
    }
    if (name.length < 3) {
      setError("Community name must be at least 3 characters");
      return;
    }
    if (name.length > 100) {
      setError("Community name must be 100 characters or less");
      return;
    }

    try {
      setCreating(true);
      await onCreate({ ...formData, name });
    } catch (err) {
      setError(err.message || "Failed to create community. Please try again.");
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) handleSubmit();
  };

  return (
    <>
      <div className="cc-overlay" onClick={onClose}>
        <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
          {/* ── Header ── */}
          <div className="cc-header">
            <span className="cc-title">Create Community</span>
            <button className="cc-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="cc-body">
            {error && (
              <div className="cc-error">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="cc-field">
              <label className="cc-label">Community Name *</label>
              <input
                type="text"
                className="cc-input"
                placeholder="Enter community name…"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={handleKeyDown}
                maxLength={100}
                autoFocus
              />
              <p className="cc-hint">{formData.name.length}/100 characters</p>
            </div>

            {/* Description */}
            <div className="cc-field">
              <label className="cc-label">Description</label>
              <textarea
                className="cc-textarea"
                placeholder="Describe your community…"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Icon */}
            <div className="cc-field">
              <label className="cc-label">Community Icon</label>
              <div className="cc-icon-row">
                <div
                  className="cc-icon-preview"
                  style={{ background: formData.bannerGradient }}
                >
                  {formData.icon || "🌟"}
                </div>
                <input
                  type="text"
                  className="cc-input"
                  placeholder="Enter emoji…"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  maxLength={2}
                />
              </div>
            </div>

            {/* Banner gradient */}
            <div className="cc-field">
              <label className="cc-label">Banner Colour</label>
              <div className="cc-gradient-grid">
                {gradientOptions.map((gradient, index) => (
                  <div
                    key={index}
                    className={`cc-gradient-swatch${formData.bannerGradient === gradient ? " selected" : ""}`}
                    style={{ background: gradient }}
                    onClick={() => setFormData({ ...formData, bannerGradient: gradient })}
                    role="button"
                    aria-label={`Gradient ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Private toggle */}
            <div className="cc-field">
              <div
                className="cc-checkbox-row"
                role="checkbox"
                aria-checked={formData.isPrivate}
                tabIndex={0}
                onClick={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                onKeyDown={(e) => e.key === " " && setFormData({ ...formData, isPrivate: !formData.isPrivate })}
              >
                <div className={`cc-checkbox${formData.isPrivate ? " checked" : ""}`}>
                  {formData.isPrivate && <span>✓</span>}
                </div>
                <div>
                  <span className="cc-checkbox-label">Make this community private</span>
                  <p className="cc-hint">Only members with an invite link can join</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="cc-actions">
              <button
                type="button"
                className="cc-btn secondary"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-btn primary"
                onClick={handleSubmit}
                disabled={creating || !formData.name.trim()}
              >
                {creating ? "Creating…" : "Create Community"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Overlay: PC gets 32px top, mobile 20px ── */
        .cc-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px 20px;
          animation: ccFade 0.2s ease;
          overflow-y: auto;
        }
        @keyframes ccFade { from { opacity: 0; } to { opacity: 1; } }

        /* ── Modal ── */
        .cc-modal {
          width: 100%;
          max-width: 560px;
          background: #0f0f0f;
          border: 2px solid rgba(156, 255, 0, 0.25);
          border-radius: 20px;
          box-shadow:
            0 24px 64px rgba(0, 0, 0, 0.9),
            0 0 80px rgba(156, 255, 0, 0.08);
          overflow: hidden;
          animation: ccSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin: auto;
          max-height: calc(100vh - 70px);
          display: flex;
          flex-direction: column;
        }
        @keyframes ccSlide {
          from { opacity: 0; transform: scale(0.96) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }

        /* ── Header ── */
        .cc-header {
          padding: 20px 24px;
          border-bottom: 1.5px solid rgba(156, 255, 0, 0.15);
          background: linear-gradient(180deg, rgba(26,26,26,0.8) 0%, transparent 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .cc-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.4px;
        }
        .cc-close {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: rgba(26, 26, 26, 0.7);
          border: 1.5px solid rgba(42, 42, 42, 0.9);
          color: #888;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .cc-close:hover {
          border-color: rgba(255, 107, 107, 0.5);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        /* ── Body ── */
        .cc-body {
          padding: 22px 24px 24px;
          overflow-y: auto;
          flex: 1;
        }
        .cc-body::-webkit-scrollbar { width: 6px; }
        .cc-body::-webkit-scrollbar-track { background: rgba(22,22,22,.4); }
        .cc-body::-webkit-scrollbar-thumb { background: rgba(156,255,0,.3); border-radius: 3px; }

        /* ── Error ── */
        .cc-error {
          padding: 13px 16px;
          background: rgba(255, 107, 107, 0.13);
          border: 1.5px solid rgba(255, 107, 107, 0.4);
          border-radius: 12px;
          color: #ff6b6b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 18px;
          animation: ccShake 0.38s;
        }
        @keyframes ccShake {
          0%,100% { transform: translateX(0);   }
          25%      { transform: translateX(-6px); }
          75%      { transform: translateX(6px);  }
        }

        /* ── Fields ── */
        .cc-field { margin-bottom: 18px; }
        .cc-field:last-child { margin-bottom: 0; }

        .cc-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .cc-input {
          width: 100%;
          padding: 13px 15px;
          background: rgba(22, 22, 22, 0.9);
          border: 1.5px solid rgba(40, 40, 40, 0.9);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.25s, box-shadow 0.25s;
          outline: none;
          box-sizing: border-box;
        }
        .cc-input:focus {
          border-color: rgba(156, 255, 0, 0.55);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.09);
        }
        .cc-input::placeholder { color: #444; }

        .cc-textarea {
          width: 100%;
          padding: 13px 15px;
          background: rgba(22, 22, 22, 0.9);
          border: 1.5px solid rgba(40, 40, 40, 0.9);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
          transition: border-color 0.25s, box-shadow 0.25s;
          outline: none;
          box-sizing: border-box;
        }
        .cc-textarea:focus {
          border-color: rgba(156, 255, 0, 0.55);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.09);
        }
        .cc-textarea::placeholder { color: #444; }

        .cc-hint {
          font-size: 11px;
          color: #555;
          margin-top: 5px;
        }

        /* ── Icon row ── */
        .cc-icon-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .cc-icon-preview {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          flex-shrink: 0;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
          border: 1.5px solid rgba(156, 255, 0, 0.2);
        }

        /* ── Gradient swatches ── */
        .cc-gradient-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .cc-gradient-swatch {
          height: 52px;
          border-radius: 11px;
          cursor: pointer;
          border: 2px solid rgba(40, 40, 40, 0.9);
          position: relative;
          transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
        }
        .cc-gradient-swatch:hover {
          transform: translateY(-3px);
          border-color: rgba(156, 255, 0, 0.4);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
        }
        .cc-gradient-swatch.selected {
          border-color: #9cff00;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.45);
        }
        .cc-gradient-swatch.selected::after {
          content: "✓";
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 18px;
          font-weight: 800;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
        }

        /* ── Checkbox row ── */
        .cc-checkbox-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          user-select: none;
          padding: 14px 16px;
          background: rgba(18, 18, 18, 0.8);
          border: 1.5px solid rgba(40, 40, 40, 0.9);
          border-radius: 12px;
          transition: border-color 0.2s;
        }
        .cc-checkbox-row:hover { border-color: rgba(156, 255, 0, 0.25); }

        .cc-checkbox {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: rgba(22, 22, 22, 0.9);
          border: 1.5px solid rgba(60, 60, 60, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
          transition: all 0.2s;
        }
        .cc-checkbox.checked {
          background: rgba(156, 255, 0, 0.25);
          border-color: #9cff00;
        }
        .cc-checkbox span {
          color: #9cff00;
          font-weight: 800;
          font-size: 13px;
        }
        .cc-checkbox-label {
          font-size: 14px;
          color: #ddd;
          font-weight: 500;
          display: block;
        }

        /* ── Actions ── */
        .cc-actions {
          display: flex;
          gap: 10px;
          margin-top: 24px;
        }
        .cc-btn {
          flex: 1;
          padding: 13px 22px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1.5px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .cc-btn.secondary {
          background: rgba(22, 22, 22, 0.9);
          color: #888;
          border-color: rgba(40, 40, 40, 0.9);
        }
        .cc-btn.secondary:hover:not(:disabled) {
          color: #ccc;
          border-color: rgba(156, 255, 0, 0.35);
        }
        .cc-btn.primary {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          color: #000;
          box-shadow: 0 4px 16px rgba(156, 255, 0, 0.35);
        }
        .cc-btn.primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(156, 255, 0, 0.5);
        }
        .cc-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none !important;
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .cc-overlay {
            padding: 20px 14px 14px;
            align-items: flex-end;
          }
          .cc-modal {
          border-radius: 0;
          top: 46px;
          bottom: 70px;
            max-width: 100%;
            border-radius: 20px 20px 0 0;
            // max-height: calc(100vh - 46px);
          }
          .cc-gradient-grid { grid-template-columns: repeat(2, 1fr); }
          .cc-actions { flex-direction: column-reverse; }
        }
      `}</style>
    </>
  );
};

export default CreateCommunityModal;