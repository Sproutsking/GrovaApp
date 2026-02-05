import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  Link2,
  Settings,
  LogOut,
  Crown,
  ChevronRight,
  Bell,
  Trash2,
  Plus,
  Star,
  TrendingUp,
  Activity,
  ChevronLeft,
  AlertTriangle,
  Palette,
} from "lucide-react";

// Import all section components
import RolesPermissionsSection from "./sections/RolesPermissionsSection";
import NotificationsSection from "./sections/NotificationsSection";
import MembersSection from "./sections/MembersSection";
import CommunitySettingsSection from "./sections/CommunitySettingsSection";
import AnalyticsSection from "./sections/AnalyticsSection";

// Custom Confirmation Dialog Component
const ConfirmDialog = ({
  show,
  onClose,
  onConfirm,
  title,
  message,
  isDanger,
}) => {
  if (!show) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <AlertTriangle size={24} color={isDanger ? "#ff6b6b" : "#9cff00"} />
          <h3>{title}</h3>
        </div>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`confirm-btn ${isDanger ? "danger" : "primary"}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Confirm
          </button>
        </div>
      </div>
      <style>{`
        .confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          z-index: 20000;
          display: flex;
          align-items: center;
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

        .confirm-dialog {
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .confirm-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .confirm-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .confirm-message {
          font-size: 14px;
          color: #ccc;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .confirm-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .confirm-btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .confirm-btn.cancel {
          background: rgba(26, 26, 26, 0.6);
          border-color: rgba(42, 42, 42, 0.8);
          color: #999;
        }

        .confirm-btn.cancel:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          color: #9cff00;
        }

        .confirm-btn.primary {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          color: #000;
        }

        .confirm-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.3);
        }

        .confirm-btn.danger {
          background: #ff6b6b;
          color: #fff;
        }

        .confirm-btn.danger:hover {
          background: #ff5252;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(255, 107, 107, 0.4);
        }
      `}</style>
    </div>
  );
};

const CommunityMenu = ({
  show,
  onClose,
  community,
  userId,
  onLeave,
  onUpdate,
  onCreateChannel,
  onDeleteCommunity,
  onOpenInvite,
  onOpenBackgroundSwitcher,
  // Data props
  members = [],
  roles = [],
  channels = [],
}) => {
  const [menuView, setMenuView] = useState("main");
  const [userRole, setUserRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
    isDanger: false,
  });

  useEffect(() => {
    if (show && community) {
      setMenuView("main");
      setSelectedRole(null);
      loadUserRole();
    }
  }, [show, community]);

  const loadUserRole = async () => {
    try {
      setLoading(true);
      const currentMember = members.find((m) => m.user_id === userId);
      if (currentMember) {
        const role = roles.find((r) => r.id === currentMember.role_id);
        setUserRole(role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
    } finally {
      setLoading(false);
    }
  };

  const isOwner = community?.owner_id === userId;
  const canManageRoles = userRole?.permissions?.manageRoles || isOwner;
  const canManageCommunity = userRole?.permissions?.manageCommunity || isOwner;

  const handleInviteClick = () => {
    onClose();
    onOpenInvite();
  };

  const handleBackgroundClick = () => {
    onClose();
    if (onOpenBackgroundSwitcher) {
      onOpenBackgroundSwitcher();
    }
  };

  const handleUpdateRole = async (roleId, updates) => {
    try {
      await onUpdate({ type: "role", roleId, updates });
    } catch (error) {
      console.error("Error updating role:", error);
      throw error;
    }
  };

  const handleCreateRole = async (roleData) => {
    try {
      await onUpdate({ type: "createRole", roleData });
    } catch (error) {
      console.error("Error creating role:", error);
      throw error;
    }
  };

  const handleUpdateNotifications = async (notifSettings) => {
    try {
      await onUpdate({ type: "notifications", settings: notifSettings });
    } catch (error) {
      console.error("Error updating notifications:", error);
      throw error;
    }
  };

  const handleUpdateCommunitySettings = async (settings) => {
    try {
      await onUpdate({ type: "community", settings });
    } catch (error) {
      console.error("Error updating community settings:", error);
      throw error;
    }
  };

  const showConfirmDialog = (title, message, onConfirm, isDanger = false) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      onConfirm,
      isDanger,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      show: false,
      title: "",
      message: "",
      onConfirm: () => {},
      isDanger: false,
    });
  };

  if (!show) return null;

  return (
    <>
      <div className="menu-overlay" onClick={onClose}>
        <div
          className="community-menu-sidebar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="menu-header">
            <div className="menu-title">
              {menuView === "main" ? (
                <div className="header-content">
                  <div
                    className="community-icon-large"
                    style={{ background: community.banner_gradient }}
                  >
                    {community.icon}
                  </div>
                  <div className="community-info">
                    <div className="community-name">
                      {community.name}
                      {community.is_verified && (
                        <Star size={16} color="#9cff00" fill="#9cff00" />
                      )}
                    </div>
                    <div className="community-stats">
                      <span>
                        {community.member_count?.toLocaleString() ||
                          members.length}{" "}
                        members
                      </span>
                      <span>•</span>
                      <span>
                        {members.filter((m) => m.is_online).length} online
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="back-header">
                  <button
                    className="back-btn"
                    onClick={() => {
                      setMenuView("main");
                      setSelectedRole(null);
                    }}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="view-title">
                    {menuView === "members" && "Members"}
                    {menuView === "settings" && "Settings"}
                    {menuView === "roles" && "Roles & Permissions"}
                    {menuView === "analytics" && "Analytics"}
                    {menuView === "notifications" && "Notifications"}
                  </span>
                </div>
              )}
            </div>
            <button className="close-menu" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="menu-content">
            {menuView === "main" && (
              <>
                <div className="menu-section">
                  <div className="stat-card-grid">
                    <div className="stat-card">
                      <Users size={20} color="#9cff00" />
                      <div>
                        <div className="stat-value">
                          {community.member_count?.toLocaleString() ||
                            members.length}
                        </div>
                        <div className="stat-label">Total Members</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <Activity size={20} color="#667eea" />
                      <div>
                        <div className="stat-value">
                          {members.filter((m) => m.is_online).length}
                        </div>
                        <div className="stat-label">Online Now</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="menu-section">
                  <div
                    className="menu-item"
                    onClick={() => setMenuView("members")}
                  >
                    <div
                      className="menu-item-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, #9cff00 0%, #667eea 100%)",
                      }}
                    >
                      <Users size={18} />
                    </div>
                    <div className="menu-item-content">
                      <span className="menu-item-title">View Members</span>
                      <span className="menu-item-desc">
                        Browse all community members
                      </span>
                    </div>
                    <ChevronRight size={16} color="#666" />
                  </div>

                  <div className="menu-item" onClick={handleInviteClick}>
                    <div
                      className="menu-item-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                      }}
                    >
                      <Link2 size={18} />
                    </div>
                    <div className="menu-item-content">
                      <span className="menu-item-title">Invite People</span>
                      <span className="menu-item-desc">Share invite links</span>
                    </div>
                  </div>

                  <div className="menu-item" onClick={onCreateChannel}>
                    <div
                      className="menu-item-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                      }}
                    >
                      <Plus size={18} />
                    </div>
                    <div className="menu-item-content">
                      <span className="menu-item-title">Create Channel</span>
                      <span className="menu-item-desc">Add a new channel</span>
                    </div>
                  </div>

                  <div className="menu-item" onClick={handleBackgroundClick}>
                    <div
                      className="menu-item-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      }}
                    >
                      <Palette size={18} />
                    </div>
                    <div className="menu-item-content">
                      <span className="menu-item-title">Change Background</span>
                      <span className="menu-item-desc">
                        Customize chat appearance
                      </span>
                    </div>
                  </div>

                  {canManageCommunity && (
                    <>
                      <div
                        className="menu-item"
                        onClick={() => setMenuView("settings")}
                      >
                        <div
                          className="menu-item-icon"
                          style={{
                            background:
                              "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                          }}
                        >
                          <Settings size={18} />
                        </div>
                        <div className="menu-item-content">
                          <span className="menu-item-title">
                            Community Settings
                          </span>
                          <span className="menu-item-desc">
                            Manage appearance & privacy
                          </span>
                        </div>
                        <ChevronRight size={16} color="#666" />
                      </div>

                      <div
                        className="menu-item"
                        onClick={() => setMenuView("roles")}
                      >
                        <div
                          className="menu-item-icon"
                          style={{
                            background:
                              "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                          }}
                        >
                          <Crown size={18} />
                        </div>
                        <div className="menu-item-content">
                          <span className="menu-item-title">
                            Roles & Permissions
                          </span>
                          <span className="menu-item-desc">
                            Configure member roles
                          </span>
                        </div>
                        <ChevronRight size={16} color="#666" />
                      </div>

                      <div
                        className="menu-item"
                        onClick={() => setMenuView("analytics")}
                      >
                        <div
                          className="menu-item-icon"
                          style={{
                            background:
                              "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
                          }}
                        >
                          <TrendingUp size={18} />
                        </div>
                        <div className="menu-item-content">
                          <span className="menu-item-title">Analytics</span>
                          <span className="menu-item-desc">
                            View community insights
                          </span>
                        </div>
                        <ChevronRight size={16} color="#666" />
                      </div>
                    </>
                  )}

                  <div
                    className="menu-item"
                    onClick={() => setMenuView("notifications")}
                  >
                    <div
                      className="menu-item-icon"
                      style={{
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      }}
                    >
                      <Bell size={18} />
                    </div>
                    <div className="menu-item-content">
                      <span className="menu-item-title">Notifications</span>
                      <span className="menu-item-desc">
                        Customize your alerts
                      </span>
                    </div>
                    <ChevronRight size={16} color="#666" />
                  </div>

                  {!isOwner && (
                    <div
                      className="menu-item danger"
                      onClick={() =>
                        showConfirmDialog(
                          "Leave Community",
                          "Are you sure you want to leave this community? You can always rejoin later.",
                          () => {
                            onLeave(community.id);
                            onClose();
                          },
                          false,
                        )
                      }
                    >
                      <div
                        className="menu-item-icon"
                        style={{ background: "#ff6b6b" }}
                      >
                        <LogOut size={18} />
                      </div>
                      <div className="menu-item-content">
                        <span className="menu-item-title">Leave Community</span>
                        <span className="menu-item-desc">
                          You can always rejoin later
                        </span>
                      </div>
                    </div>
                  )}

                  {isOwner && (
                    <div
                      className="menu-item danger"
                      onClick={() =>
                        showConfirmDialog(
                          "Delete Community",
                          "⚠️ WARNING: This will permanently delete the community and all its data. This action cannot be undone. Are you absolutely sure?",
                          () => {
                            onDeleteCommunity();
                            onClose();
                          },
                          true,
                        )
                      }
                    >
                      <div
                        className="menu-item-icon"
                        style={{ background: "#ff6b6b" }}
                      >
                        <Trash2 size={18} />
                      </div>
                      <div className="menu-item-content">
                        <span className="menu-item-title">
                          Delete Community
                        </span>
                        <span className="menu-item-desc">
                          Permanently remove this community
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Render section components */}
            {menuView === "members" && (
              <MembersSection
                community={community}
                onBack={() => setMenuView("main")}
              />
            )}

            {menuView === "notifications" && (
              <NotificationsSection
                community={community}
                onBack={() => setMenuView("main")}
                onUpdateNotifications={handleUpdateNotifications}
              />
            )}

            {menuView === "roles" && (
              <RolesPermissionsSection
                roles={roles}
                members={members}
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                canManageRoles={canManageRoles}
                onUpdateRole={handleUpdateRole}
                onCreateRole={handleCreateRole}
                onBack={() => {
                  if (selectedRole) {
                    setSelectedRole(null);
                  } else {
                    setMenuView("main");
                  }
                }}
              />
            )}

            {menuView === "settings" && (
              <CommunitySettingsSection
                community={community}
                userId={userId}
                onUpdate={handleUpdateCommunitySettings}
                onClose={() => setMenuView("main")}
              />
            )}

            {menuView === "analytics" && (
              <AnalyticsSection
                community={community}
                onBack={() => setMenuView("main")}
              />
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        show={confirmDialog.show}
        onClose={closeConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDanger={confirmDialog.isDanger}
      />

      <style jsx>{`
        /* All styles from original file remain the same */
        .menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(4px);
          z-index: 10000;
          animation: overlayFadeIn 0.3s ease;
        }

        @keyframes overlayFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .community-menu-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 420px;
          background: rgba(15, 15, 15, 0.98);
          border-left: 2px solid rgba(156, 255, 0, 0.2);
          box-shadow:
            -8px 0 32px rgba(0, 0, 0, 0.6),
            0 0 80px rgba(156, 255, 0, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .menu-header {
          padding: 8px 12px;
          border-bottom: 2px solid rgba(156, 255, 0, 0.1);
          background: linear-gradient(
            180deg,
            rgba(26, 26, 26, 0.8) 0%,
            rgba(15, 15, 15, 0) 100%
          );
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .menu-title {
          flex: 1;
          min-width: 0;
        }
        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .back-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          color: #9cff00;
        }

        .view-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }

        .community-icon-large {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .community-info {
          flex: 1;
          min-width: 0;
        }

        .community-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .community-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #999;
        }

        .close-menu {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          color: #999;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .close-menu:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(255, 107, 107, 0.6);
          color: #ff6b6b;
          transform: rotate(90deg);
        }

        .menu-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .menu-content::-webkit-scrollbar {
          width: 6px;
        }
        .menu-content::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.3);
        }
        .menu-content::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
          border-radius: 3px;
        }
        .menu-content::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 255, 0, 0.5);
        }

        .menu-section {
          padding: 12px;
        }

        .stat-card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .stat-card {
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s;
        }

        .stat-card:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .stat-value {
          font-size: 20px;
          font-weight: 800;
          color: #9cff00;
        }

        .stat-label {
          font-size: 11px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(26, 26, 26, 0.4);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 8px;
        }

        .menu-item:hover {
          background: rgba(26, 26, 26, 0.8);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateX(8px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .menu-item.danger:hover {
          border-color: rgba(255, 107, 107, 0.5);
          background: rgba(255, 107, 107, 0.05);
        }

        .menu-item-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .menu-item-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .menu-item-title {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .menu-item-desc {
          font-size: 11px;
          color: #999;
        }

        @media (max-width: 768px) {
          .menu-overlay {
            background: rgba(15, 15, 15, 0.98);
            backdrop-filter: none;
          }

          .community-menu-sidebar {
            max-width: 100%;
            border-left: none;
            animation: slideUpMobile 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          }

          @keyframes slideUpMobile {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </>
  );
};

export default CommunityMenu;
