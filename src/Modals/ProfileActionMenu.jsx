// ============================================================================
// src/components/Modals/ProfileActionMenu.jsx
// ============================================================================

import React from "react";
import {
  Flag,
  UserX,
  Share2,
  Copy,
  Bookmark,
  Ban,
  AlertTriangle,
  X,
} from "lucide-react";

const ProfileActionMenu = ({ user, onClose, currentUser, isOwnProfile }) => {
  const handleCopyProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${user.username || user.id}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      onClose();
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleReport = () => {
    onClose();
    // Trigger report flow
  };

  const handleBlock = () => {
    onClose();
    // Trigger block flow
  };

  const menuItems = isOwnProfile
    ? [
        {
          icon: Share2,
          label: "Share Profile",
          action: handleCopyProfile,
          color: "#fff",
        },
        {
          icon: Copy,
          label: "Copy Profile Link",
          action: handleCopyProfile,
          color: "#fff",
        },
      ]
    : [
        {
          icon: Copy,
          label: "Copy Profile Link",
          action: handleCopyProfile,
          color: "#fff",
        },
        {
          icon: Share2,
          label: "Share Profile",
          action: handleCopyProfile,
          color: "#fff",
        },
        {
          icon: Flag,
          label: "Report User",
          action: handleReport,
          color: "#ef4444",
        },
        {
          icon: Ban,
          label: "Block User",
          action: handleBlock,
          color: "#ef4444",
        },
      ];

  return (
    <>
      <div className="profile-action-overlay" onClick={onClose}>
        <div
          className="profile-action-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="profile-action-header">
            <h3>Actions</h3>
            <button onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="profile-action-items">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="profile-action-item"
                onClick={item.action}
                style={{ "--item-color": item.color }}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .profile-action-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(12px);
          z-index: 10001;
          display: flex;
          align-items: flex-end;
          justify-content: center;
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

        .profile-action-menu {
          width: 100%;
          max-width: 480px;
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 20px 20px 0 0;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @media (min-width: 769px) {
          .profile-action-overlay {
            align-items: center;
          }

          .profile-action-menu {
            border-radius: 20px;
          }
        }

        .profile-action-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
        }

        .profile-action-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .profile-action-header button {
          background: none;
          border: none;
          color: #737373;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-action-header button:hover {
          color: #84cc16;
        }

        .profile-action-items {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .profile-action-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: var(--item-color, #fff);
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
          font-size: 15px;
          font-weight: 600;
        }

        .profile-action-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(132, 204, 22, 0.3);
          transform: translateX(4px);
        }

        .profile-action-item:active {
          transform: translateX(2px);
        }

        @media (max-width: 768px) {
          .profile-action-header {
            padding: 16px;
          }

          .profile-action-items {
            padding: 8px;
          }
        }
      `}</style>
    </>
  );
};

export default ProfileActionMenu;
