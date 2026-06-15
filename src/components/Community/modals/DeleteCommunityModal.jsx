import React, { useState, useRef, useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

/**
 * DeleteCommunityModal
 * Requires the owner to type the community name to confirm deletion.
 *
 * Usage:
 *   <DeleteCommunityModal
 *     community={community}
 *     onConfirm={handleDelete}
 *     onClose={() => setShowDelete(false)}
 *   />
 */
const DeleteCommunityModal = ({ community, onConfirm, onClose }) => {
  const [inputValue, setInputValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const overlayRef = useRef(null);

  const confirmName = community?.name || "";
  const isConfirmed = inputValue === confirmName;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleDelete = async () => {
    if (!isConfirmed || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await onConfirm?.();
    } catch (err) {
      setError(err.message || "Failed to delete community. Try again.");
      setDeleting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  return (
    <div ref={overlayRef} className="dcm-overlay" onClick={handleOverlayClick}>
      <div className="dcm-modal">
        {/* Close button */}
        <button className="dcm-close" onClick={onClose}>
          <X size={16} />
        </button>

        {/* Warning icon */}
        <div className="dcm-icon-wrap">
          <AlertTriangle size={32} className="dcm-icon" />
        </div>

        <h2 className="dcm-title">Delete Community</h2>
        <p className="dcm-subtitle">
          This action is <strong>permanent and cannot be undone.</strong>
          <br />
          All channels, messages, and members will be lost forever.
        </p>

        {/* Community preview */}
        <div className="dcm-preview">
          {community?.avatar && (
            <img src={community.avatar} alt="" className="dcm-avatar" />
          )}
          <span className="dcm-comm-name">{community?.name}</span>
        </div>

        {/* Confirmation input */}
        <div className="dcm-confirm-block">
          <label className="dcm-label">
            Type <strong>{confirmName}</strong> to confirm:
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
            placeholder={confirmName}
            className={`dcm-input ${isConfirmed ? "valid" : inputValue ? "invalid" : ""}`}
            disabled={deleting}
            autoComplete="off"
          />
          {inputValue && !isConfirmed && (
            <span className="dcm-hint">Name doesn't match</span>
          )}
        </div>

        {error && <div className="dcm-error">{error}</div>}

        {/* Action buttons */}
        <div className="dcm-actions">
          <button className="dcm-btn cancel" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className={`dcm-btn delete ${isConfirmed && !deleting ? "ready" : ""}`}
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
          >
            {deleting ? (
              <span className="dcm-spinner" />
            ) : (
              <>
                <Trash2 size={15} />
                Delete Forever
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .dcm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.15s ease-out;
          padding: 16px;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .dcm-modal {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: #0f0f0f;
          border: 1px solid rgba(255,68,68,0.3);
          border-radius: 18px;
          padding: 28px 24px 24px;
          text-align: center;
          box-shadow: 0 24px 80px rgba(0,0,0,0.9), 0 0 60px rgba(255,68,68,0.1);
          animation: modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.9) translateY(16px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .dcm-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .dcm-close:hover { background: rgba(255,68,68,0.15); color: #ff4444; }

        .dcm-icon-wrap {
          width: 64px;
          height: 64px;
          background: rgba(255,68,68,0.12);
          border: 2px solid rgba(255,68,68,0.25);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,68,68,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(255,68,68,0); }
        }
        .dcm-icon { color: #ff4444; }

        .dcm-title {
          font-size: 20px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 8px;
        }

        .dcm-subtitle {
          font-size: 13px;
          color: #888;
          line-height: 1.5;
          margin: 0 0 16px;
        }
        .dcm-subtitle strong { color: #ff6666; }

        .dcm-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .dcm-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,68,68,0.3);
        }
        .dcm-comm-name {
          font-size: 15px;
          font-weight: 800;
          color: #fff;
        }

        .dcm-confirm-block {
          text-align: left;
          margin-bottom: 16px;
        }
        .dcm-label {
          display: block;
          font-size: 12px;
          color: #888;
          margin-bottom: 8px;
          line-height: 1.5;
        }
        .dcm-label strong { color: #ccc; font-family: monospace; font-size: 13px; }

        .dcm-input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .dcm-input::placeholder { color: #444; }
        .dcm-input:focus { border-color: rgba(255,68,68,0.4); }
        .dcm-input.valid { border-color: rgba(255,68,68,0.6); background: rgba(255,68,68,0.08); }
        .dcm-input.invalid { border-color: rgba(255,255,255,0.12); }

        .dcm-hint {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #ff6644;
        }

        .dcm-error {
          padding: 8px 12px;
          background: rgba(255,68,68,0.1);
          border: 1px solid rgba(255,68,68,0.25);
          border-radius: 8px;
          color: #ff6666;
          font-size: 12px;
          margin-bottom: 12px;
          text-align: left;
        }

        .dcm-actions {
          display: flex;
          gap: 10px;
        }

        .dcm-btn {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: inherit;
          border: none;
        }

        .dcm-btn.cancel {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #aaa;
        }
        .dcm-btn.cancel:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; }

        .dcm-btn.delete {
          background: rgba(255,68,68,0.15);
          border: 1px solid rgba(255,68,68,0.2);
          color: #ff6666;
          opacity: 0.5;
          cursor: not-allowed;
        }
        .dcm-btn.delete.ready {
          background: linear-gradient(135deg, #ff4444, #cc2222);
          border-color: transparent;
          color: #fff;
          opacity: 1;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(255,68,68,0.35);
        }
        .dcm-btn.delete.ready:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,68,68,0.45); }
        .dcm-btn.delete.ready:active { transform: scale(0.97); }

        .dcm-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .dcm-modal { padding: 24px 16px 20px; }
          .dcm-title { font-size: 18px; }
        }
      `}</style>
    </div>
  );
};

export default DeleteCommunityModal;