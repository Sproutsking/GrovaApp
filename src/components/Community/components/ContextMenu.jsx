import React, { useState, useRef, useEffect } from "react";
import {
  Copy,
  Edit3,
  Trash2,
  Reply,
  Pin,
  Flag,
  UserX,
  Shield,
  Ban,
  Archive,
  Forward,
} from "lucide-react";

const ContextMenu = ({
  position,
  message,
  userId,
  permissions,
  isAdmin,
  isOwner,
  isModerator,
  onClose,
  onEdit,
  onDelete,
  onReaction,
  onCopy,
  onReply,
  onPin,
  onReport,
  onBanUser,
  onKickUser,
  onDeleteUserMessages,
  onForward,
}) => {
  const [confirmAction, setConfirmAction] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);

  const quickReactions = [
    "❤️",
    "👍",
    "😂",
    "🔥",
    "🎉",
    "💯",
    "😮",
    "😢",
    "🙏",
    "👏",
  ];

  const isOwnMessage = message?.user_id === userId;
  const canManageMessages =
    permissions?.manageMessages || isAdmin || isOwner || isModerator;
  const canDeleteOwnMessage = isOwnMessage;
  const canDeleteAnyMessage = canManageMessages;
  const canEditOwnMessage = isOwnMessage;
  const canModerate = isAdmin || isOwner || isModerator;
  const canBanUsers = isAdmin || isOwner;
  const canKickUsers = canModerate;
  const canPinMessages = permissions?.pinMessages || canModerate;

  useEffect(() => {
    if (!menuRef.current || !position) return;

    const calculatePosition = () => {
      const menu = menuRef.current;
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 20;

      let { x, y } = position;

      // Smart positioning based on cursor location
      const cursorInBottomHalf = y > viewportHeight / 2;
      const cursorInRightHalf = x > viewportWidth / 2;

      // Horizontal positioning
      if (cursorInRightHalf) {
        // Open to the left of cursor
        x = Math.max(padding, x - menuRect.width - 10);
      } else {
        // Open to the right of cursor
        x = Math.min(viewportWidth - menuRect.width - padding, x + 10);
      }

      // Vertical positioning
      if (cursorInBottomHalf) {
        // Open upward from cursor
        y = Math.max(padding, y - menuRect.height);
      } else {
        // Open downward from cursor
        y = Math.min(viewportHeight - menuRect.height - padding, y);
      }

      // Ensure it stays within viewport
      x = Math.max(
        padding,
        Math.min(x, viewportWidth - menuRect.width - padding),
      );
      y = Math.max(
        padding,
        Math.min(y, viewportHeight - menuRect.height - padding),
      );

      setMenuPosition({ x, y, cursorInBottomHalf });
    };

    // Small delay to ensure menu is rendered
    setTimeout(calculatePosition, 10);
  }, [position]);

  if (!position || !message || !menuPosition) return null;

  const handleReaction = (emoji) => {
    onReaction?.(emoji);
    onClose();
  };

  const handleAction = (action, requiresConfirm = false) => {
    if (requiresConfirm) {
      setConfirmAction(action);
    } else {
      action();
      onClose();
    }
  };

  const confirmAndExecute = () => {
    if (confirmAction) {
      confirmAction();
      setConfirmAction(null);
      onClose();
    }
  };

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />

      <div
        ref={menuRef}
        className={`context-menu ${menuPosition.cursorInBottomHalf ? "open-upward" : "open-downward"}`}
        style={{
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {confirmAction ? (
          <div className="confirm-section">
            <div className="confirm-icon">
              <Shield size={18} />
            </div>
            <div className="confirm-text">
              <h4>Confirm Action</h4>
              <p>This action cannot be undone.</p>
            </div>
            <div className="confirm-actions">
              <button
                className="confirm-btn cancel"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn proceed"
                onClick={confirmAndExecute}
              >
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="reactions-section">
              <div className="reactions-grid">
                {quickReactions.map((emoji) => (
                  <button
                    key={emoji}
                    className="reaction-btn"
                    onClick={() => handleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-divider"></div>

            <div className="menu-section">
              <button
                className="menu-item"
                onClick={() => handleAction(() => onReply?.(message))}
              >
                <Reply size={16} />
                <span>Reply</span>
              </button>

              <button
                className="menu-item"
                onClick={() => handleAction(() => onCopy?.())}
              >
                <Copy size={16} />
                <span>Copy</span>
              </button>

              {onForward && (
                <button
                  className="menu-item"
                  onClick={() => handleAction(() => onForward?.(message))}
                >
                  <Forward size={16} />
                  <span>Forward</span>
                </button>
              )}

              {canPinMessages && (
                <button
                  className="menu-item"
                  onClick={() => handleAction(() => onPin?.(message))}
                >
                  <Pin size={16} />
                  <span>Pin</span>
                </button>
              )}
            </div>

            {canEditOwnMessage && (
              <>
                <div className="menu-divider"></div>
                <div className="menu-section">
                  <button
                    className="menu-item"
                    onClick={() => handleAction(() => onEdit?.())}
                  >
                    <Edit3 size={16} />
                    <span>Edit</span>
                  </button>

                  {canDeleteOwnMessage && (
                    <button
                      className="menu-item danger"
                      onClick={() => handleAction(() => onDelete?.(), true)}
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {!isOwnMessage && canModerate && (
              <>
                <div className="menu-divider"></div>
                <div className="menu-section mod-section">
                  {canDeleteAnyMessage && (
                    <button
                      className="menu-item warning"
                      onClick={() => handleAction(() => onDelete?.(), true)}
                    >
                      <Trash2 size={16} />
                      <span>Delete Message</span>
                    </button>
                  )}

                  {canDeleteAnyMessage && (
                    <button
                      className="menu-item warning"
                      onClick={() =>
                        handleAction(
                          () => onDeleteUserMessages?.(message.user_id),
                          true,
                        )
                      }
                    >
                      <Archive size={16} />
                      <span>Delete All from User</span>
                    </button>
                  )}

                  {canKickUsers && (
                    <button
                      className="menu-item warning"
                      onClick={() =>
                        handleAction(() => onKickUser?.(message.user_id), true)
                      }
                    >
                      <UserX size={16} />
                      <span>Kick User</span>
                    </button>
                  )}

                  {canBanUsers && (
                    <button
                      className="menu-item danger"
                      onClick={() =>
                        handleAction(() => onBanUser?.(message.user_id), true)
                      }
                    >
                      <Ban size={16} />
                      <span>Ban User</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {!isOwnMessage && !canModerate && (
              <>
                <div className="menu-divider"></div>
                <div className="menu-section">
                  <button
                    className="menu-item danger"
                    onClick={() => handleAction(() => onReport?.(message))}
                  >
                    <Flag size={16} />
                    <span>Report</span>
                  </button>
                </div>
              </>
            )}
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
          background: rgba(8, 8, 8, 0.98);
          border: 1px solid rgba(156, 255, 0, 0.18);
          border-radius: 14px;
          padding: 8px;
          min-width: 220px;
          max-width: 260px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.9),
            0 0 40px rgba(156, 255, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(24px);
          z-index: 9999;
          animation: contextMenuSlide 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .context-menu.open-upward {
          transform-origin: bottom center;
        }

        .context-menu.open-downward {
          transform-origin: top center;
        }

        @keyframes contextMenuSlide {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .menu-section {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .mod-section {
          background: rgba(156, 255, 0, 0.02);
          border-radius: 8px;
          padding: 4px;
        }

        .reactions-section {
          padding: 6px;
        }

        .reactions-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }

        .reaction-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(20, 20, 20, 0.5);
          border: 1px solid rgba(40, 40, 40, 0.5);
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .reaction-btn:hover {
          background: rgba(156, 255, 0, 0.12);
          border-color: rgba(156, 255, 0, 0.3);
          transform: scale(1.12);
        }

        .menu-divider {
          height: 1px;
          background: rgba(156, 255, 0, 0.06);
          margin: 6px 0;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          text-align: left;
        }

        .menu-item:hover {
          background: rgba(156, 255, 0, 0.08);
          color: #9cff00;
          transform: translateX(2px);
        }

        .menu-item.danger {
          color: rgba(239, 68, 68, 0.9);
        }

        .menu-item.danger:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
        }

        .menu-item.warning {
          color: rgba(251, 146, 60, 0.9);
        }

        .menu-item.warning:hover {
          background: rgba(251, 146, 60, 0.08);
          color: #fb923c;
        }

        .menu-item svg {
          flex-shrink: 0;
          opacity: 0.85;
        }

        .menu-item:hover svg {
          opacity: 1;
        }

        .menu-item span {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .confirm-section {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .confirm-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(251, 146, 60, 0.1);
          border: 1px solid rgba(251, 146, 60, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fb923c;
          margin: 0 auto;
        }

        .confirm-text {
          text-align: center;
        }

        .confirm-text h4 {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .confirm-text p {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        .confirm-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .confirm-btn {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid;
        }

        .confirm-btn.cancel {
          background: rgba(115, 115, 115, 0.08);
          border-color: rgba(115, 115, 115, 0.2);
          color: rgba(255, 255, 255, 0.7);
        }

        .confirm-btn.cancel:hover {
          background: rgba(115, 115, 115, 0.15);
          border-color: rgba(115, 115, 115, 0.3);
          color: #fff;
        }

        .confirm-btn.proceed {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .confirm-btn.proceed:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
        }

        @media (max-width: 768px) {
          .context-menu {
            min-width: 200px;
            max-width: calc(100vw - 40px);
          }

          .reaction-btn {
            width: 32px;
            height: 32px;
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
};

export default ContextMenu;
