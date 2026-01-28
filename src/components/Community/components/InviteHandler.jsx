import React, { useEffect, useState } from "react";
import { UserPlus, CheckCircle, X, AlertCircle } from "lucide-react";
import communityService from "../../../services/community/communityService";

const InviteHandler = ({ inviteCode, userId, onSuccess, onError, onClose }) => {
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [message, setMessage] = useState("");
  const [communityName, setCommunityName] = useState("");

  useEffect(() => {
    if (inviteCode && userId) {
      handleInvite();
    }
  }, [inviteCode, userId]);

  const handleInvite = async () => {
    try {
      setStatus("loading");
      setMessage("Joining community...");

      const community = await communityService.joinCommunityViaInvite(
        inviteCode,
        userId,
      );

      setCommunityName(community.name);
      setStatus("success");
      setMessage(`Successfully joined ${community.name}!`);

      // Wait a bit before calling success callback
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(community.id);
        }
      }, 1500);
    } catch (error) {
      console.error("Invite handler error:", error);
      setStatus("error");
      setMessage(error.message || "Failed to join community");

      // Auto-close error after 5 seconds
      setTimeout(() => {
        if (onError) {
          onError(error);
        }
      }, 5000);
    }
  };

  return (
    <>
      <div className="invite-overlay" onClick={onClose}>
        <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
          <button className="invite-close" onClick={onClose}>
            <X size={18} />
          </button>

          <div className="invite-content">
            {status === "loading" && (
              <>
                <div className="invite-icon loading">
                  <UserPlus size={40} />
                </div>
                <h3 className="invite-title">Joining Community</h3>
                <p className="invite-message">{message}</p>
                <div className="loading-spinner"></div>
              </>
            )}

            {status === "success" && (
              <>
                <div className="invite-icon success">
                  <CheckCircle size={40} />
                </div>
                <h3 className="invite-title">Welcome to {communityName}!</h3>
                <p className="invite-message">{message}</p>
                <p className="invite-submessage">
                  You've been assigned the Novis role. Complete verification to
                  unlock full access.
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="invite-icon error">
                  <AlertCircle size={40} />
                </div>
                <h3 className="invite-title">Failed to Join</h3>
                <p className="invite-message">{message}</p>
                <button className="retry-btn" onClick={handleInvite}>
                  Try Again
                </button>
                <button className="retry-btn secondary" onClick={onClose}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .invite-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          z-index: 100000;
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
          position: relative;
          width: 100%;
          max-width: 400px;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 20px;
          padding: 32px;
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

        .invite-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(26, 26, 26, 0.8);
          border: 1px solid rgba(42, 42, 42, 0.8);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .invite-close:hover {
          background: rgba(255, 107, 107, 0.2);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
        }

        .invite-content {
          text-align: center;
        }

        .invite-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .invite-icon.loading {
          background: rgba(156, 255, 0, 0.1);
          color: #9cff00;
          animation: pulse 2s ease-in-out infinite;
        }

        .invite-icon.success {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          animation: successPop 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .invite-icon.error {
          background: rgba(255, 107, 107, 0.2);
          color: #ff6b6b;
          animation: errorShake 0.5s;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }

        @keyframes successPop {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes errorShake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        .invite-title {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
        }

        .invite-message {
          font-size: 15px;
          color: #999;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .invite-submessage {
          font-size: 13px;
          color: #666;
          font-style: italic;
          margin-top: 8px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(156, 255, 0, 0.2);
          border-top-color: #9cff00;
          border-radius: 50%;
          margin: 20px auto 0;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .retry-btn {
          margin-top: 12px;
          padding: 12px 24px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(156, 255, 0, 0.4);
          border-radius: 10px;
          color: #9cff00;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .retry-btn:hover {
          background: rgba(156, 255, 0, 0.1);
          border-color: #9cff00;
        }

        .retry-btn.secondary {
          background: rgba(26, 26, 26, 0.6);
          border-color: rgba(42, 42, 42, 0.6);
          color: #999;
          margin-top: 8px;
        }

        .retry-btn.secondary:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(255, 107, 107, 0.4);
          color: #ff6b6b;
        }

        @media (max-width: 768px) {
          .invite-modal {
            padding: 24px;
          }

          .invite-title {
            font-size: 20px;
          }
        }
      `}</style>
    </>
  );
};

export default InviteHandler;
