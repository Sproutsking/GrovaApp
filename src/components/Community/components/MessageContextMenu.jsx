import React, { useEffect, useRef } from "react";
import {
  Edit2, Trash2, Lock, Unlock, Shield, Hash, Megaphone,
  Copy, Bell, BellOff, UserPlus, Settings,
} from "lucide-react";

/**
 * ChannelContextMenu
 *
 * Shows different options depending on permissions:
 *   - Members: Mark as read, Copy link, Mute/Unmute, Leave
 *   - Admins: + Edit, Delete, Toggle Privacy
 *   - Owners: + Permissions, Delete (with confirmation)
 */
const ChannelContextMenu = ({
  position,
  channel,
  isOwner,
  hasManagePermission,
  isAdministrator,
  onClose,
  onEdit,
  onDelete,
  onPermissions,
  onTogglePrivacy,
  onCopyLink,
  onMuteToggle,
  isMuted = false,
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose?.();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Clamp to viewport
  const menuStyle = {
    position: "fixed",
    top: Math.min(position.y, window.innerHeight - 300),
    left: Math.min(position.x, window.innerWidth - 220),
    zIndex: 9999,
  };

  const ChannelIcon = channel?.type === "announcement" ? Megaphone : Hash;

  return (
    <div ref={menuRef} style={menuStyle} className="ccm-menu" onClick={(e) => e.stopPropagation()}>
      {/* Channel info header */}
      <div className="ccm-header">
        <ChannelIcon size={13} className="ccm-ch-icon" />
        <span className="ccm-ch-name">{channel?.name}</span>
        {channel?.is_private && <Lock size={10} className="ccm-lock" />}
      </div>

      <div className="ccm-divider" />

      {/* Member actions (everyone) */}
      <button className="ccm-item" onClick={() => { onMuteToggle?.(); onClose(); }}>
        {isMuted ? <Bell size={14} /> : <BellOff size={14} />}
        <span>{isMuted ? "Unmute Channel" : "Mute Channel"}</span>
      </button>

      <button className="ccm-item" onClick={() => { onCopyLink?.(); onClose(); }}>
        <Copy size={14} />
        <span>Copy Link</span>
      </button>

      {/* Admin/Manage actions */}
      {(hasManagePermission || isOwner) && (
        <>
          <div className="ccm-divider" />
          <div className="ccm-section-label">Admin</div>

          <button className="ccm-item" onClick={() => { onEdit?.(); onClose(); }}>
            <Edit2 size={14} />
            <span>Edit Channel</span>
          </button>

          <button className="ccm-item" onClick={() => { onTogglePrivacy?.(); onClose(); }}>
            {channel?.is_private ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{channel?.is_private ? "Make Public" : "Make Private"}</span>
          </button>

          {(isAdministrator || isOwner) && (
            <button className="ccm-item" onClick={() => { onPermissions?.(); onClose(); }}>
              <Shield size={14} />
              <span>Channel Permissions</span>
            </button>
          )}
        </>
      )}

      {/* Danger zone */}
      {(hasManagePermission || isOwner) && (
        <>
          <div className="ccm-divider" />
          <button
            className="ccm-item danger"
            onClick={() => {
              if (window.confirm(`Delete #${channel?.name}? This cannot be undone.`)) {
                onDelete?.();
              }
              onClose();
            }}
          >
            <Trash2 size={14} />
            <span>Delete Channel</span>
          </button>
        </>
      )}

      <style>{`
        .ccm-menu {
          min-width: 210px;
          background: #111;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(156,255,0,0.06);
          animation: menuIn 0.12s ease-out;
          user-select: none;
        }
        @keyframes menuIn {
          from { opacity: 0; transform: scale(0.94) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .ccm-header {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px 8px;
          background: rgba(255,255,255,0.03);
        }
        .ccm-ch-icon { color: #9cff00; flex-shrink: 0; }
        .ccm-ch-name {
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ccm-lock { color: #666; flex-shrink: 0; }

        .ccm-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 3px 0;
        }

        .ccm-section-label {
          padding: 4px 14px 2px;
          font-size: 9px;
          font-weight: 800;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .ccm-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 14px;
          background: none;
          border: none;
          color: #ccc;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
          text-align: left;
          font-family: inherit;
        }
        .ccm-item:hover {
          background: rgba(156,255,0,0.08);
          color: #fff;
        }
        .ccm-item svg { color: #666; flex-shrink: 0; transition: color 0.12s; }
        .ccm-item:hover svg { color: #9cff00; }

        .ccm-item.danger { color: #ff4444; }
        .ccm-item.danger:hover {
          background: rgba(255,68,68,0.1);
          color: #ff6666;
        }
        .ccm-item.danger svg { color: #ff4444; }
        .ccm-item.danger:hover svg { color: #ff6666; }
      `}</style>
    </div>
  );
};

export default ChannelContextMenu;