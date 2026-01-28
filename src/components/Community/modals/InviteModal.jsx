import React, { useState, useEffect } from "react";
import { X, Copy, CheckCircle, Share2, Clock, Users } from "lucide-react";
import communityService from "../../../services/community/communityService";

const InviteModal = ({ community, userId, onClose }) => {
  const [settings, setSettings] = useState({
    duration: "7d",
    maxUses: "unlimited",
  });
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    generateInvite();
  }, [settings]);

  const generateInvite = async () => {
    try {
      setGenerating(true);
      setError("");

      const link = await communityService.generateInvite(
        community.id,
        userId,
        settings,
      );

      // Extract invite code from the generated link
      const code = link.split("/").pop();

      // Create proper invite URL with query parameter for client-side handling
      const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${code}`;

      setInviteLink(inviteUrl);
    } catch (err) {
      console.error("Error generating invite:", err);
      setError(err.message || "Failed to generate invite link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${community.name}`,
          text: `Join my community "${community.name}" on the platform!`,
          url: inviteLink,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    } else {
      handleCopy();
    }
  };

  const durationOptions = [
    { value: "1h", label: "1 hour" },
    { value: "6h", label: "6 hours" },
    { value: "24h", label: "24 hours" },
    { value: "7d", label: "7 days" },
    { value: "never", label: "Never" },
  ];

  const maxUsesOptions = [
    { value: "1", label: "1 use" },
    { value: "5", label: "5 uses" },
    { value: "10", label: "10 uses" },
    { value: "25", label: "25 uses" },
    { value: "50", label: "50 uses" },
    { value: "100", label: "100 uses" },
    { value: "unlimited", label: "Unlimited" },
  ];

  return (
    <>
      <div className="invite-modal-overlay" onClick={onClose}>
        <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="header-content">
              <div
                className="community-icon"
                style={{ background: community.banner_gradient }}
              >
                {community.icon}
              </div>
              <div className="header-text">
                <h2 className="modal-title">Invite to {community.name}</h2>
                <p className="modal-subtitle">
                  Share this link with others to invite them
                </p>
              </div>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="settings-section">
              <div className="setting-group">
                <label className="setting-label">
                  <Clock size={16} />
                  <span>Expire After</span>
                </label>
                <div className="setting-options">
                  {durationOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`option-btn ${settings.duration === option.value ? "active" : ""}`}
                      onClick={() =>
                        setSettings({ ...settings, duration: option.value })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label className="setting-label">
                  <Users size={16} />
                  <span>Max Uses</span>
                </label>
                <div className="setting-options">
                  {maxUsesOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`option-btn ${settings.maxUses === option.value ? "active" : ""}`}
                      onClick={() =>
                        setSettings({ ...settings, maxUses: option.value })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="link-section">
              <label className="link-label">Invite Link</label>
              <div className="link-container">
                <input
                  type="text"
                  className="link-input"
                  value={inviteLink || "Generating..."}
                  readOnly
                />
                <button
                  className="copy-btn"
                  onClick={handleCopy}
                  disabled={!inviteLink || generating}
                >
                  {copied ? (
                    <>
                      <CheckCircle size={18} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {navigator.share && (
              <button
                className="share-btn"
                onClick={handleShare}
                disabled={!inviteLink || generating}
              >
                <Share2 size={18} />
                <span>Share Link</span>
              </button>
            )}

            <div className="info-box">
              <p>
                Anyone with this link will be able to join your community.
                {community.is_private && " This is a private community."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .invite-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .invite-modal {
          width: 100%;
          max-width: 560px;
          background: #0f0f0f;
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 20px;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9);
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

        .modal-header {
          padding: 24px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .header-content {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          flex: 1;
        }

        .community-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .header-text {
          flex: 1;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .modal-subtitle {
          font-size: 13px;
          color: #999;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-btn:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 24px;
        }

        .error-message {
          padding: 12px 14px;
          background: rgba(255, 107, 107, 0.15);
          border: 2px solid rgba(255, 107, 107, 0.4);
          border-radius: 10px;
          color: #ff6b6b;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .settings-section {
          margin-bottom: 24px;
        }

        .setting-group {
          margin-bottom: 20px;
        }

        .setting-group:last-child {
          margin-bottom: 0;
        }

        .setting-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .setting-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .option-btn {
          padding: 8px 14px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 8px;
          color: #999;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .option-btn:hover {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.4);
          color: #fff;
        }

        .option-btn.active {
          background: rgba(156, 255, 0, 0.15);
          border-color: rgba(156, 255, 0, 0.5);
          color: #9cff00;
        }

        .link-section {
          margin-bottom: 16px;
        }

        .link-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .link-container {
          display: flex;
          gap: 10px;
        }

        .link-input {
          flex: 1;
          padding: 12px 14px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 10px;
          color: #fff;
          font-size: 13px;
          font-family: monospace;
          outline: none;
        }

        .copy-btn {
          padding: 12px 18px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.3);
          white-space: nowrap;
        }

        .copy-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(156, 255, 0, 0.5);
        }

        .copy-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .share-btn {
          width: 100%;
          padding: 14px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s;
          margin-bottom: 16px;
        }

        .share-btn:hover:not(:disabled) {
          background: rgba(26, 26, 26, 1);
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
        }

        .share-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .info-box {
          padding: 14px;
          background: rgba(156, 255, 0, 0.05);
          border: 1px solid rgba(156, 255, 0, 0.2);
          border-radius: 10px;
          color: #999;
          font-size: 12px;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .invite-modal {
            max-width: 100%;
            border-radius: 16px;
          }

          .setting-options {
            gap: 6px;
          }

          .option-btn {
            padding: 6px 10px;
            font-size: 11px;
          }

          .link-container {
            flex-direction: column;
          }

          .copy-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
};

export default InviteModal;
