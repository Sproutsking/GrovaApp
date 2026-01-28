import React from "react";
import { Copy, Edit3, Trash2, Reply, Pin, Flag, Smile } from "lucide-react";

const ContextMenu = ({
  position,
  message,
  userId,
  permissions,
  onClose,
  onEdit,
  onDelete,
  onReaction,
  onCopy,
}) => {
  if (!position || !message) return null;

  const isOwnMessage = message.user_id === userId;
  const canManage = permissions?.manageMessages;

  const menuWidth = 200;
  const menuHeight = 300;
  const padding = 16;

  let finalX = position.x;
  let finalY = position.y;

  if (finalX + menuWidth > window.innerWidth - padding) {
    finalX = window.innerWidth - menuWidth - padding;
  }
  if (finalX < padding) {
    finalX = padding;
  }

  if (finalY + menuHeight > window.innerHeight - padding) {
    finalY = window.innerHeight - menuHeight - padding;
  }
  if (finalY < padding) {
    finalY = padding;
  }

  const quickReactions = ["❤️", "👍", "😂", "🔥", "🎉", "💯"];

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        className="context-menu"
        style={{
          top: finalY,
          left: finalX,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="context-section reactions-section">
          <div className="quick-reactions">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                className="reaction-btn"
                onClick={() => {
                  onReaction(emoji);
                  onClose();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="context-divider"></div>

        <div className="context-section">
          <button
            className="context-item"
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            <Copy size={16} />
            <span>Copy Text</span>
          </button>

          <button className="context-item">
            <Reply size={16} />
            <span>Reply</span>
          </button>

          <button className="context-item">
            <Pin size={16} />
            <span>Pin Message</span>
          </button>
        </div>

        {(isOwnMessage || canManage) && (
          <>
            <div className="context-divider"></div>
            <div className="context-section">
              {isOwnMessage && (
                <button
                  className="context-item"
                  onClick={() => {
                    onEdit();
                    onClose();
                  }}
                >
                  <Edit3 size={16} />
                  <span>Edit Message</span>
                </button>
              )}
              <button
                className="context-item danger"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
              >
                <Trash2 size={16} />
                <span>Delete Message</span>
              </button>
            </div>
          </>
        )}

        {!isOwnMessage && (
          <>
            <div className="context-divider"></div>
            <div className="context-section">
              <button className="context-item danger">
                <Flag size={16} />
                <span>Report</span>
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .context-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9998;
        }

        .context-menu {
          position: fixed;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 16px;
          padding: 12px;
          min-width: 200px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9), 0 0 80px rgba(156, 255, 0, 0.2);
          backdrop-filter: blur(20px);
          z-index: 9999;
          animation: contextMenuSlide 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes contextMenuSlide {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .context-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .reactions-section {
          padding: 8px 0;
        }

        .quick-reactions {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
        }

        .reaction-btn {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 12px;
          background: rgba(26, 26, 26, 0.6);
          border: 1.5px solid rgba(42, 42, 42, 0.6);
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .reaction-btn:hover {
          background: rgba(156, 255, 0, 0.2);
          border-color: rgba(156, 255, 0, 0.4);
          transform: scale(1.15);
        }

        .context-divider {
          height: 1px;
          background: rgba(156, 255, 0, 0.1);
          margin: 8px 0;
        }

        .context-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: transparent;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
          text-align: left;
        }

        .context-item:hover {
          background: rgba(156, 255, 0, 0.15);
        }

        .context-item.danger {
          color: #ff4444;
        }

        .context-item.danger:hover {
          background: rgba(255, 68, 68, 0.15);
        }

        .context-item svg {
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .context-menu {
            min-width: 180px;
            max-width: calc(100vw - 32px);
          }

          .quick-reactions {
            grid-template-columns: repeat(6, 1fr);
          }

          .reaction-btn {
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
};

export default ContextMenu;
