import React from "react";
import {
  Edit3,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Hash,
  Settings,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";

const ChannelContextMenu = ({
  position,
  channel,
  isOwner,
  hasManagePermission,
  onClose,
  onEdit,
  onDelete,
  onTogglePrivacy,
  onClone,
  onSettings,
}) => {
  const handleAction = (action) => {
    if (action) action();
    if (onClose) onClose();
  };

  if (!position || !channel) return null;

  const canManage = isOwner || hasManagePermission;

  return (
    <>
      <div
        className="channel-context-menu"
        style={{
          top: Math.min(position.y, window.innerHeight - 300),
          left: Math.min(position.x, window.innerWidth - 220),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Channel Info Header */}
        <div className="context-header">
          <div className="channel-preview">
            <div className="channel-icon-preview">{channel.icon || "💬"}</div>
            <div className="channel-details">
              <div className="channel-name-preview">#{channel.name}</div>
              <div className="channel-type-badge">
                {channel.type} • {channel.is_private ? "Private" : "Public"}
              </div>
            </div>
          </div>
        </div>

        <div className="context-divider"></div>

        {/* Management Actions */}
        {canManage && (
          <>
            {onEdit && (
              <div
                className="context-item"
                onClick={() => handleAction(onEdit)}
              >
                <Edit3 size={16} />
                <span>Edit Channel</span>
              </div>
            )}

            {onSettings && (
              <div
                className="context-item"
                onClick={() => handleAction(onSettings)}
              >
                <Settings size={16} />
                <span>Channel Settings</span>
              </div>
            )}

            {onTogglePrivacy && (
              <div
                className="context-item"
                onClick={() => handleAction(onTogglePrivacy)}
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
              </div>
            )}

            {onClone && (
              <div
                className="context-item"
                onClick={() => handleAction(onClone)}
              >
                <Copy size={16} />
                <span>Clone Channel</span>
              </div>
            )}

            <div className="context-divider"></div>

            {onDelete && (
              <div
                className="context-item danger"
                onClick={() => handleAction(onDelete)}
              >
                <Trash2 size={16} />
                <span>Delete Channel</span>
              </div>
            )}
          </>
        )}

        {/* Channel Info Footer */}
        {!canManage && (
          <div className="context-item info">
            <Hash size={14} />
            <div className="info-text">
              <div>You don't have permission</div>
              <div>to manage this channel</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .channel-context-menu {
          position: fixed;
          min-width: 220px;
          background: rgba(15, 15, 15, 0.98);
          backdrop-filter: blur(24px);
          border: 2px solid rgba(156, 255, 0, 0.25);
          border-radius: 12px;
          padding: 8px;
          z-index: 100000;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(156, 255, 0, 0.15),
            0 0 40px rgba(156, 255, 0, 0.2);
          animation: contextSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes contextSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .context-header {
          padding: 8px;
          margin-bottom: 4px;
        }

        .channel-preview {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .channel-icon-preview {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(
            135deg,
            rgba(156, 255, 0, 0.2) 0%,
            rgba(102, 126, 234, 0.2) 100%
          );
          border: 2px solid rgba(156, 255, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .channel-details {
          flex: 1;
          min-width: 0;
        }

        .channel-name-preview {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 2px;
        }

        .channel-type-badge {
          font-size: 11px;
          color: #999;
          font-weight: 600;
          text-transform: capitalize;
        }

        .context-divider {
          height: 1px;
          background: rgba(156, 255, 0, 0.1);
          margin: 6px 0;
        }

        .context-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .context-item::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(156, 255, 0, 0.1) 0%,
            transparent 100%
          );
          opacity: 0;
          transition: opacity 0.2s;
        }

        .context-item:hover::before {
          opacity: 1;
        }

        .context-item:hover {
          background: rgba(26, 26, 26, 0.8);
          color: #9cff00;
          transform: translateX(4px);
        }

        .context-item.danger {
          color: #ff6b6b;
        }

        .context-item.danger:hover {
          background: rgba(255, 107, 107, 0.1);
          color: #ff6b6b;
        }

        .context-item.info {
          padding: 8px 12px;
          background: rgba(26, 26, 26, 0.4);
          cursor: default;
          opacity: 0.7;
        }

        .context-item.info:hover {
          transform: none;
          background: rgba(26, 26, 26, 0.4);
          color: #fff;
        }

        .info-text {
          font-size: 11px;
          line-height: 1.4;
          color: #999;
        }

        @media (max-width: 768px) {
          .channel-context-menu {
            min-width: 200px;
          }

          .channel-icon-preview {
            width: 36px;
            height: 36px;
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
};

export default ChannelContextMenu;
