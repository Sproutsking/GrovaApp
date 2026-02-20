import React, { useState } from "react";
import {
  Crown,
  Plus,
  Save,
  ChevronRight,
  Shield,
  MessageSquare,
  Hash,
  Users,
  Settings as SettingsIcon,
  Lock,
  Edit,
  Check,
} from "lucide-react";

const RolesPermissionsSection = ({
  roles,
  members,
  selectedRole,
  setSelectedRole,
  canManageRoles,
  onUpdateRole,
  onCreateRole,
}) => {
  const [roleTab, setRoleTab] = useState("display");
  const [roleDisplay, setRoleDisplay] = useState({
    name: selectedRole?.name || "",
    color: selectedRole?.color || "#667eea",
  });
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleData, setNewRoleData] = useState({
    name: "",
    color: "#95A5A6",
  });

  // Comprehensive permission categories
  const permissionCategories = {
    messaging: {
      label: "Messaging Permissions",
      icon: MessageSquare,
      permissions: [
        {
          key: "sendMessages",
          label: "Send Messages",
          desc: "Allow members to send messages in channels",
        },
        {
          key: "attachFiles",
          label: "Attach Files",
          desc: "Allow members to upload and attach files",
        },
        {
          key: "embedLinks",
          label: "Embed Links",
          desc: "Allow members to post links with previews",
        },
        {
          key: "addReactions",
          label: "Add Reactions",
          desc: "Allow members to react to messages with emojis",
        },
        {
          key: "useExternalEmojis",
          label: "Use External Emojis",
          desc: "Allow members to use emojis from other communities",
        },
        {
          key: "mentionEveryone",
          label: "Mention @everyone",
          desc: "Allow members to mention all members at once",
        },
        {
          key: "useSlashCommands",
          label: "Use Slash Commands",
          desc: "Allow members to use bot commands",
        },
      ],
    },
    channels: {
      label: "Channel Permissions",
      icon: Hash,
      permissions: [
        {
          key: "viewChannels",
          label: "View Channels",
          desc: "Allow members to view channel list",
        },
        {
          key: "createChannels",
          label: "Create Channels",
          desc: "Allow members to create new channels",
        },
        {
          key: "manageChannels",
          label: "Manage Channels",
          desc: "Allow members to edit and delete channels",
        },
        {
          key: "createPrivateChannels",
          label: "Create Private Channels",
          desc: "Allow members to create private channels",
        },
      ],
    },
    members: {
      label: "Member Permissions",
      icon: Users,
      permissions: [
        {
          key: "viewMembers",
          label: "View Members",
          desc: "Allow members to see member list",
        },
        {
          key: "inviteMembers",
          label: "Invite Members",
          desc: "Allow members to create invite links",
        },
        {
          key: "kickMembers",
          label: "Kick Members",
          desc: "Allow members to remove others from community",
        },
        {
          key: "banMembers",
          label: "Ban Members",
          desc: "Allow members to permanently ban others",
        },
        {
          key: "manageNicknames",
          label: "Manage Nicknames",
          desc: "Allow members to change others' nicknames",
        },
        {
          key: "changeOwnNickname",
          label: "Change Own Nickname",
          desc: "Allow members to change their own nickname",
        },
      ],
    },
    roles: {
      label: "Role Permissions",
      icon: Crown,
      permissions: [
        {
          key: "manageRoles",
          label: "Manage Roles",
          desc: "Allow members to create and edit roles",
        },
        {
          key: "assignRoles",
          label: "Assign Roles",
          desc: "Allow members to assign roles to others",
        },
        {
          key: "viewRoles",
          label: "View Roles",
          desc: "Allow members to view role information",
        },
      ],
    },
    moderation: {
      label: "Moderation Permissions",
      icon: Shield,
      permissions: [
        {
          key: "manageMessages",
          label: "Manage Messages",
          desc: "Allow members to delete and edit any message",
        },
        {
          key: "pinMessages",
          label: "Pin Messages",
          desc: "Allow members to pin important messages",
        },
        {
          key: "readMessageHistory",
          label: "Read Message History",
          desc: "Allow members to read past messages",
        },
        {
          key: "viewAuditLog",
          label: "View Audit Log",
          desc: "Allow members to view community action logs",
        },
        {
          key: "timeoutMembers",
          label: "Timeout Members",
          desc: "Allow members to temporarily mute others",
        },
        {
          key: "manageWarnings",
          label: "Manage Warnings",
          desc: "Allow members to issue warnings",
        },
      ],
    },
    community: {
      label: "Community Permissions",
      icon: SettingsIcon,
      permissions: [
        {
          key: "manageCommunity",
          label: "Manage Community",
          desc: "Allow members to modify community settings",
        },
        {
          key: "manageWebhooks",
          label: "Manage Webhooks",
          desc: "Allow members to create and manage webhooks",
        },
        {
          key: "manageInvites",
          label: "Manage Invites",
          desc: "Allow members to manage invite links",
        },
        {
          key: "viewAnalytics",
          label: "View Analytics",
          desc: "Allow members to view community analytics",
        },
        {
          key: "manageEmojis",
          label: "Manage Emojis",
          desc: "Allow members to add custom emojis",
        },
      ],
    },
    advanced: {
      label: "Advanced Permissions",
      icon: Lock,
      permissions: [
        {
          key: "administrator",
          label: "Administrator",
          desc: "Grant all permissions (dangerous!)",
        },
        {
          key: "bypassSlowMode",
          label: "Bypass Slow Mode",
          desc: "Allow members to bypass channel slow mode",
        },
        {
          key: "prioritySpeaker",
          label: "Priority Speaker",
          desc: "Allow members to be heard over others in voice",
        },
        {
          key: "moveMembers",
          label: "Move Members",
          desc: "Allow members to move others between voice channels",
        },
      ],
    },
  };

  const handleCreateRole = async () => {
    if (!newRoleData.name.trim()) {
      alert("Please enter a role name");
      return;
    }

    try {
      await onCreateRole(newRoleData);
      setShowCreateRole(false);
      setNewRoleData({ name: "", color: "#95A5A6" });
    } catch (error) {
      console.error("Error creating role:", error);
      alert("Failed to create role");
    }
  };

  const handleSaveDisplay = async () => {
    try {
      await onUpdateRole(selectedRole.id, roleDisplay);
      alert("Role updated successfully!");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update role");
    }
  };

  const togglePermission = async (permissionKey) => {
    const currentValue = selectedRole.permissions?.[permissionKey] || false;
    try {
      await onUpdateRole(selectedRole.id, {
        permissions: {
          ...selectedRole.permissions,
          [permissionKey]: !currentValue,
        },
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      alert("Failed to update permission");
    }
  };

  const colorPresets = [
    "#FF6B6B",
    "#F093FB",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DFE6E9",
    "#74B9FF",
    "#A29BFE",
    "#FD79A8",
    "#FDCB6E",
    "#E17055",
    "#00B894",
    "#00CEC9",
    "#667eea",
  ];

  return (
    <>
      {!selectedRole ? (
        <>
          {/* Roles List View */}
          <div className="section-header">
            <div className="settings-title">
              <Crown size={18} />
              Manage Roles
            </div>
            {canManageRoles && (
              <button
                className="icon-btn-primary"
                onClick={() => setShowCreateRole(true)}
                title="Create New Role"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {/* Create Role Form */}
          {showCreateRole && (
            <div className="create-role-form">
              <div className="form-header">
                <h3>Create New Role</h3>
              </div>

              <div className="form-group">
                <label className="form-label">Role Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRoleData.name}
                  onChange={(e) =>
                    setNewRoleData({ ...newRoleData, name: e.target.value })
                  }
                  placeholder="Enter role name..."
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role Color</label>
                <div className="color-preset-grid">
                  {colorPresets.map((color) => (
                    <div
                      key={color}
                      className={`color-preset ${newRoleData.color === color ? "selected" : ""}`}
                      style={{ background: color }}
                      onClick={() => setNewRoleData({ ...newRoleData, color })}
                      title={color}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  className="color-input-full"
                  value={newRoleData.color}
                  onChange={(e) =>
                    setNewRoleData({ ...newRoleData, color: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preview</label>
                <div
                  className="role-preview-card"
                  style={{ borderColor: newRoleData.color }}
                >
                  <Crown size={16} color={newRoleData.color} />
                  <span style={{ color: newRoleData.color }}>
                    {newRoleData.name || "New Role"}
                  </span>
                </div>
              </div>

              <div className="button-row">
                <button
                  className="action-btn secondary"
                  onClick={() => setShowCreateRole(false)}
                >
                  Cancel
                </button>
                <button className="action-btn" onClick={handleCreateRole}>
                  <Plus size={14} />
                  Create Role
                </button>
              </div>
            </div>
          )}

          {/* Roles List */}
          <div className="role-list">
            {roles.map((role) => (
              <div
                key={role.id}
                className="role-card-enhanced"
                onClick={() => {
                  setSelectedRole(role);
                  setRoleDisplay({ name: role.name, color: role.color });
                }}
              >
                <div className="role-card-left">
                  <div
                    className="role-color-badge-large"
                    style={{ background: role.color }}
                  />
                  <div className="role-info">
                    <div className="role-name" style={{ color: role.color }}>
                      <Crown size={14} />
                      {role.name}
                    </div>
                    <div className="role-stats">
                      <Users size={12} />
                      {members.filter((m) => m.role_id === role.id).length}{" "}
                      members
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="#666" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Role Details View */}
          <div
            className="role-header-card"
            style={{ borderLeftColor: roleDisplay.color }}
          >
            <div
              className="role-icon-large"
              style={{ background: roleDisplay.color }}
            >
              <Crown size={24} color="#fff" />
            </div>
            <div>
              <div className="role-title" style={{ color: roleDisplay.color }}>
                {roleDisplay.name}
              </div>
              <div className="role-subtitle">
                {members.filter((m) => m.role_id === selectedRole.id).length}{" "}
                members with this role
              </div>
            </div>
          </div>

          <div className="role-tabs">
            <button
              className={`role-tab ${roleTab === "display" ? "active" : ""}`}
              onClick={() => setRoleTab("display")}
            >
              <Edit size={14} />
              Display
            </button>
            <button
              className={`role-tab ${roleTab === "permissions" ? "active" : ""}`}
              onClick={() => setRoleTab("permissions")}
            >
              <Shield size={14} />
              Permissions
            </button>
            <button
              className={`role-tab ${roleTab === "members" ? "active" : ""}`}
              onClick={() => setRoleTab("members")}
            >
              <Users size={14} />
              Members
            </button>
          </div>

          {/* Display Tab */}
          {roleTab === "display" && (
            <div className="tab-content">
              <div className="form-group">
                <label className="form-label">Role Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={roleDisplay.name}
                  onChange={(e) =>
                    setRoleDisplay({ ...roleDisplay, name: e.target.value })
                  }
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role Color</label>
                <div className="color-preset-grid">
                  {colorPresets.map((color) => (
                    <div
                      key={color}
                      className={`color-preset ${roleDisplay.color === color ? "selected" : ""}`}
                      style={{ background: color }}
                      onClick={() => setRoleDisplay({ ...roleDisplay, color })}
                      title={color}
                    />
                  ))}
                </div>
                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    className="color-input"
                    value={roleDisplay.color}
                    onChange={(e) =>
                      setRoleDisplay({ ...roleDisplay, color: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={roleDisplay.color}
                    onChange={(e) =>
                      setRoleDisplay({ ...roleDisplay, color: e.target.value })
                    }
                    placeholder="#667eea"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Preview</label>
                <div
                  className="role-preview-large"
                  style={{ borderColor: roleDisplay.color }}
                >
                  <Crown size={20} color={roleDisplay.color} />
                  <span style={{ color: roleDisplay.color }}>
                    {roleDisplay.name || "Role Name"}
                  </span>
                </div>
              </div>

              <button className="action-btn" onClick={handleSaveDisplay}>
                <Save size={14} />
                Save Changes
              </button>
            </div>
          )}

          {/* Permissions Tab */}
          {roleTab === "permissions" && (
            <div className="tab-content">
              <div className="permissions-notice">
                <Shield size={16} />
                <span>
                  Carefully configure permissions to control what members with
                  this role can do
                </span>
              </div>

              {Object.entries(permissionCategories).map(
                ([categoryKey, category]) => {
                  const CategoryIcon = category.icon;
                  return (
                    <div key={categoryKey} className="permission-category">
                      <div className="category-header">
                        <CategoryIcon size={16} />
                        <span>{category.label}</span>
                      </div>

                      <div className="permission-list">
                        {category.permissions.map((perm) => {
                          const isEnabled =
                            selectedRole.permissions?.[perm.key] || false;
                          const isAdminEnabled =
                            selectedRole.permissions?.administrator || false;

                          return (
                            <div
                              key={perm.key}
                              className={`permission-item ${isAdminEnabled && perm.key !== "administrator" ? "disabled" : ""}`}
                            >
                              <div className="permission-info-detailed">
                                <div className="permission-label">
                                  {perm.label}
                                </div>
                                <div className="permission-desc">
                                  {perm.desc}
                                </div>
                              </div>
                              <div
                                className={`toggle ${isEnabled || (isAdminEnabled && perm.key !== "administrator") ? "active" : ""}`}
                                onClick={() => {
                                  if (
                                    !isAdminEnabled ||
                                    perm.key === "administrator"
                                  ) {
                                    togglePermission(perm.key);
                                  }
                                }}
                              >
                                <div className="toggle-slider" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {/* Members Tab */}
          {roleTab === "members" && (
            <div className="tab-content">
              <div className="members-grid">
                {members
                  .filter((m) => m.role_id === selectedRole.id)
                  .map((member) => (
                    <div key={member.id} className="member-card-enhanced">
                      <div className="member-avatar-large">
                        {member.user?.avatar ? (
                          <img
                            src={member.user.avatar}
                            alt={member.user?.full_name}
                          />
                        ) : (
                          <span className="avatar-fallback">
                            {member.user?.full_name?.[0]?.toUpperCase() || "?"}
                          </span>
                        )}
                        {member.is_online && (
                          <div className="online-indicator" />
                        )}
                      </div>
                      <div className="member-details">
                        <div className="member-name">
                          {member.user?.full_name || "Unknown"}
                        </div>
                        <div className="member-username">
                          @{member.user?.username || "unknown"}
                        </div>
                        {member.user?.verified && (
                          <div className="verified-badge-small">
                            <Shield size={10} />
                            Verified
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {members.filter((m) => m.role_id === selectedRole.id).length ===
                  0 && (
                  <div className="empty-state-small">
                    <Users size={32} color="#666" />
                    <p>No members have this role yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 0 12px;
        }

        .settings-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        .icon-btn-primary {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.2);
        }

        .icon-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.4);
        }

        .create-role-form {
          background: linear-gradient(
            135deg,
            rgba(26, 26, 26, 0.8) 0%,
            rgba(20, 20, 20, 0.8) 100%
          );
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 20px;
          border: 1px solid rgba(156, 255, 0, 0.2);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .form-header h3 {
          font-size: 16px;
          font-weight: 700;
          color: #9cff00;
          margin-bottom: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #9cff00;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: rgba(156, 255, 0, 0.6);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.1);
        }

        .color-preset-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .color-preset {
          height: 40px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
          position: relative;
        }

        .color-preset:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .color-preset.selected {
          border-color: #9cff00;
          box-shadow: 0 0 20px rgba(156, 255, 0, 0.4);
        }

        .color-preset.selected::after {
          content: "✓";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-weight: 700;
          font-size: 16px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .color-input-full {
          width: 100%;
          height: 48px;
          border-radius: 10px;
          border: 2px solid rgba(42, 42, 42, 0.8);
          cursor: pointer;
          transition: all 0.2s;
        }

        .color-input-full:hover {
          border-color: rgba(156, 255, 0, 0.6);
        }

        .color-picker-wrapper {
          display: flex;
          gap: 12px;
        }

        .color-input {
          width: 80px;
          height: 48px;
          border-radius: 10px;
          border: 2px solid rgba(42, 42, 42, 0.8);
          cursor: pointer;
          transition: all 0.2s;
        }

        .color-input:hover {
          border-color: rgba(156, 255, 0, 0.6);
        }

        .role-preview-card {
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          font-size: 16px;
        }

        .role-preview-large {
          padding: 20px;
          background: rgba(26, 26, 26, 0.6);
          border: 3px solid;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          font-size: 18px;
        }

        .button-row {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .action-btn {
          flex: 1;
          padding: 12px 20px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border: none;
          border-radius: 10px;
          color: #000;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.2);
        }

        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(156, 255, 0, 0.4);
        }

        .action-btn.secondary {
          background: rgba(26, 26, 26, 0.8);
          color: #fff;
          border: 2px solid rgba(42, 42, 42, 0.8);
          box-shadow: none;
        }

        .action-btn.secondary:hover {
          background: rgba(42, 42, 42, 0.8);
          border-color: rgba(156, 255, 0, 0.3);
        }

        .role-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .role-card-enhanced {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .role-card-enhanced:hover {
          background: rgba(26, 26, 26, 0.9);
          transform: translateX(8px);
          border-color: rgba(156, 255, 0, 0.3);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .role-card-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .role-color-badge-large {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 12px rgba(0, 0, 0, 0.3);
        }

        .role-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .role-name {
          font-weight: 700;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .role-stats {
          font-size: 12px;
          color: #999;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .role-header-card {
          padding: 20px;
          background: rgba(26, 26, 26, 0.6);
          border-left: 4px solid;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .role-icon-large {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .role-title {
          font-size: 20px;
          font-weight: 800;
        }

        .role-subtitle {
          font-size: 13px;
          color: #999;
          margin-top: 4px;
        }

        .role-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          padding: 0 12px;
        }

        .role-tab {
          flex: 1;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          color: #999;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .role-tab:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.2);
          color: #d4d4d4;
        }

        .role-tab.active {
          background: linear-gradient(
            135deg,
            rgba(156, 255, 0, 0.15) 0%,
            rgba(102, 126, 234, 0.15) 100%
          );
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
          box-shadow: 0 4px 12px rgba(156, 255, 0, 0.15);
        }

        .tab-content {
          padding: 0 12px;
        }

        .permissions-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.3);
          border-radius: 10px;
          color: #9cff00;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .permission-category {
          margin-bottom: 24px;
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: linear-gradient(
            135deg,
            rgba(156, 255, 0, 0.1) 0%,
            rgba(102, 126, 234, 0.1) 100%
          );
          border-left: 4px solid #9cff00;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #9cff00;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .permission-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .permission-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(26, 26, 26, 0.4);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .permission-item:hover {
          background: rgba(26, 26, 26, 0.7);
          border-color: rgba(156, 255, 0, 0.2);
        }

        .permission-item.disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .permission-info-detailed {
          flex: 1;
          margin-right: 16px;
        }

        .permission-label {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 4px;
        }

        .permission-desc {
          font-size: 12px;
          color: #999;
          line-height: 1.4;
        }

        .toggle {
          width: 52px;
          height: 28px;
          background: rgba(42, 42, 42, 0.8);
          border-radius: 14px;
          position: relative;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid rgba(42, 42, 42, 0.8);
          flex-shrink: 0;
        }

        .toggle:hover {
          border-color: rgba(156, 255, 0, 0.3);
        }

        .toggle.active {
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border-color: #9cff00;
          box-shadow: 0 0 16px rgba(156, 255, 0, 0.4);
        }

        .toggle-slider {
          width: 20px;
          height: 20px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .toggle.active .toggle-slider {
          left: 26px;
          background: #000;
        }

        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }

        .member-card-enhanced {
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          transition: all 0.3s;
        }

        .member-card-enhanced:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .member-avatar-large {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
          overflow: hidden;
        }

        .member-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-fallback {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }

        .online-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #10b981;
          border: 3px solid rgba(26, 26, 26, 0.9);
          box-shadow: 0 0 12px #10b981;
        }

        .member-details {
          text-align: center;
          width: 100%;
        }

        .member-name {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .member-username {
          font-size: 12px;
          color: #999;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .verified-badge-small {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(156, 255, 0, 0.15);
          border: 1px solid rgba(156, 255, 0, 0.3);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #9cff00;
          margin-top: 6px;
        }

        .empty-state-small {
          grid-column: 1 / -1;
          padding: 60px 20px;
          text-align: center;
          color: #666;
        }

        .empty-state-small p {
          margin-top: 12px;
          font-size: 14px;
        }
      `}</style>
    </>
  );
};

export default RolesPermissionsSection;
