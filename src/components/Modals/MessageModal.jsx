// ============================================================================
// src/components/Modals/MessageModal.jsx - DIRECT MESSAGING MODAL
// ============================================================================

import React, { useState } from "react";
import { X, Send, Smile, Paperclip, Image as ImageIcon } from "lucide-react";

const MessageModal = ({ recipient, onClose, currentUser }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      setSending(true);
      // TODO: Implement actual messaging logic
      console.log("Sending message to:", recipient.username);
      console.log("Message:", message);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      setMessage("");
      alert("Message sent! (Feature coming soon)");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style jsx>{`
        .message-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .message-modal {
          width: 90%;
          max-width: 600px;
          background: #0a0a0a;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          max-height: 80vh;
          animation: slideUp 0.3s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .message-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .recipient-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .recipient-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #000;
          font-size: 20px;
          overflow: hidden;
          border: 2px solid rgba(132, 204, 22, 0.4);
        }

        .recipient-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .recipient-details {
          display: flex;
          flex-direction: column;
        }

        .recipient-name {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .recipient-username {
          font-size: 14px;
          color: #737373;
        }

        .close-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #737373;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .message-modal-body {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          min-height: 300px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .empty-state {
          text-align: center;
          color: #737373;
        }

        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.3;
        }

        .empty-state-text {
          font-size: 14px;
        }

        .message-modal-footer {
          padding: 20px 24px;
          border-top: 1px solid rgba(132, 204, 22, 0.2);
        }

        .message-input-container {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .message-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.4);
        }

        .message-input-wrapper {
          flex: 1;
          position: relative;
        }

        .message-input {
          width: 100%;
          min-height: 40px;
          max-height: 120px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          resize: none;
          font-family: inherit;
          transition: all 0.2s;
        }

        .message-input:focus {
          outline: none;
          border-color: rgba(132, 204, 22, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .message-input::placeholder {
          color: #737373;
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.3);
        }

        .send-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(132, 204, 22, 0.5);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .coming-soon-badge {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 8px;
          color: #3b82f6;
          font-size: 12px;
          font-weight: 700;
          margin-top: 12px;
        }

        @media (max-width: 768px) {
          .message-modal {
            width: 100%;
            max-width: 100%;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }

          .message-modal-body {
            min-height: 400px;
          }
        }
      `}</style>

      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal" onClick={(e) => e.stopPropagation()}>
          <div className="message-modal-header">
            <div className="recipient-info">
              <div className="recipient-avatar">
                {recipient.avatar &&
                typeof recipient.avatar === "string" &&
                recipient.avatar.startsWith("http") ? (
                  <img src={recipient.avatar} alt={recipient.name} />
                ) : (
                  recipient.name?.charAt(0)?.toUpperCase() || "U"
                )}
              </div>
              <div className="recipient-details">
                <div className="recipient-name">
                  {recipient.name || "User"}
                  {recipient.verified && (
                    <span style={{ color: "#84cc16" }}>✓</span>
                  )}
                </div>
                <div className="recipient-username">
                  @{recipient.username || "user"}
                </div>
              </div>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="message-modal-body">
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-text">
                Start a conversation with {recipient.name}
              </div>
              <div className="coming-soon-badge">Coming Soon</div>
            </div>
          </div>

          <div className="message-modal-footer">
            <div className="message-input-container">
              <div className="message-actions">
                <button className="action-btn" title="Add emoji">
                  <Smile size={20} />
                </button>
                <button className="action-btn" title="Attach file">
                  <Paperclip size={20} />
                </button>
                <button className="action-btn" title="Add image">
                  <ImageIcon size={20} />
                </button>
              </div>

              <div className="message-input-wrapper">
                <textarea
                  className="message-input"
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={1}
                />
              </div>

              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!message.trim() || sending}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MessageModal;
