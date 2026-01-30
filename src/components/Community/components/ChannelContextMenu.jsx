import React, { useState, useRef, useEffect } from "react";
import {
  Edit3,
  Trash2,
  Lock,
  Unlock,
  Archive,
  Shield,
} from "lucide-react";

const ChannelContextMenu = ({
  position,
  channel,
  isOwner,
  hasManagePermission,
  isAdministrator,
  onClose,
  onEdit,
  onDelete,
  onTogglePrivacy,
  onWipeChannel,
}) => {
  const [confirmAction, setConfirmAction] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuRef.current || !position) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20;

    let { x, y } = position;

    // Ensure menu stays within viewport horizontally
    if (x + menuRect.width > viewportWidth - padding) {
      x = viewportWidth - menuRect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Ensure menu stays within viewport vertically
    if (y + menuRect.height > viewportHeight - padding) {
      y = viewportHeight - menuRect.height - padding;
    }
    if (y < padding) {
      y = padding;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.opacity = '1';
  }, [position]);

  if (!position || !channel) return null;

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
      <div className="channel-context-menu-overlay" onClick={onClose} />

      <div
        ref={menuRef}
        className="channel-context-menu"
        style={{
          left: position.x,
          top: position.y,
          opacity: 0,
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
            <div className="menu-section">
              {hasManagePermission && (
                <button
                  className="menu-item"
                  onClick={() => handleAction(() => onEdit?.())}
                >
                  <Edit3 size={16} />
                  <span>Edit Channel</span>
                </button>
              )}

              {hasManagePermission && (
                <button
                  className="menu-item"
                  onClick={() => handleAction(() => onTogglePrivacy?.())}
                >
                  {channel.is_private ? (
                    <>
                      <Unlock size={16} />
                      <span>Make Public</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>Make Private</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Administrator-only actions */}
            {isAdministrator && (
              <>
                <div className="menu-divider"></div>
                <div className="menu-section admin-section">
                  <button
                    className="menu-item warning"
                    onClick={() =>
                      handleAction(() => onWipeChannel?.(channel), true)
                    }
                  >
                    <Archive size={16} />
                    <span>Wipe All Messages</span>
                  </button>
                </div>
              </>
            )}

            {/* Delete channel */}
            {(hasManagePermission || isOwner) && (
              <>
                <div className="menu-divider"></div>
                <div className="menu-section">
                  <button
                    className="menu-item danger"
                    onClick={() => handleAction(() => onDelete?.(), true)}
                  >
                    <Trash2 size={16} />
                    <span>Delete Channel</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        .channel-context-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9998;
        }

        .channel-context-menu {
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
          transition: opacity 0.1s ease;
        }

        @keyframes contextMenuSlide {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .menu-section {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .admin-section {
          background: rgba(156, 255, 0, 0.02);
          border-radius: 8px;
          padding: 4px;
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
          .channel-context-menu {
            min-width: 200px;
            max-width: calc(100vw - 40px);
          }
        }
      `}</style>
    </>
  );
};

export default ChannelContextMenu;