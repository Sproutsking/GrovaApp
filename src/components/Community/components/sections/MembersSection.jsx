// components/Community/components/sections/MembersSection.jsx - FIXED VERSION
import React, { useState, useEffect } from "react";
import { Crown, Users, Search, Filter, CheckCircle } from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import mediaUrlService from "../../../../services/shared/mediaUrlService";
import communityOnlineStatusService from "../../../../services/community/communityOnlineStatusService";

const MembersSection = ({ community, userId }) => {
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    if (community?.id) {
      loadData();

      // Start online status tracking
      if (userId) {
        communityOnlineStatusService.start(userId, community.id);
      }

      // Subscribe to status updates
      const unsubscribe = communityOnlineStatusService.subscribe(
        (memberId, status) => {
          setOnlineStatuses((prev) => ({
            ...prev,
            [memberId]: status,
          }));
        },
      );

      return () => {
        unsubscribe();
        communityOnlineStatusService.stop();
      };
    }
  }, [community?.id, userId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("community_roles")
        .select("*")
        .eq("community_id", community.id)
        .order("position", { ascending: true });

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Load members with user data and role
      const { data: membersData, error: membersError } = await supabase
        .from("community_members")
        .select(
          `
          *,
          user:profiles!user_id(
            id,
            username,
            full_name,
            avatar_id,
            verified
          ),
          role:community_roles!role_id(
            id,
            name,
            color,
            position
          )
        `,
        )
        .eq("community_id", community.id)
        .order("joined_at", { ascending: false });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch online statuses for all members
      if (membersData && membersData.length > 0) {
        const memberIds = membersData.map((m) => m.user_id);
        const statuses =
          await communityOnlineStatusService.fetchMemberStatuses(memberIds);
        setOnlineStatuses(statuses);
      }
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.user?.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      member.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || member.role_id === filterRole;
    return matchesSearch && matchesRole;
  });

  const groupedMembers = roles
    .map((role) => ({
      role,
      members: filteredMembers.filter((m) => m.role_id === role.id),
    }))
    .filter((group) => group.members.length > 0);

  return (
    <>
      <div className="members-header">
        <div className="members-title">
          <Users size={20} />
          <span>Community Members</span>
          <div className="member-count-badge">{filteredMembers.length}</div>
        </div>
      </div>

      <div className="members-controls">
        {/* Search Button with Dropdown */}
        <div className="control-wrapper">
          <button
            className={`control-button ${showSearchPanel ? "active" : ""} ${searchQuery ? "has-value" : ""}`}
            onClick={() => {
              setShowSearchPanel(!showSearchPanel);
              setShowFilterPanel(false);
            }}
          >
            <Search size={16} />
            <span>{searchQuery || "Search members"}</span>
          </button>

          {showSearchPanel && (
            <div className="dropdown-panel search-panel">
              <div className="panel-header">
                <Search size={14} />
                <span>Search Members</span>
              </div>
              <input
                type="text"
                className="panel-input"
                placeholder="Type name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="clear-button"
                  onClick={() => setSearchQuery("")}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filter Button with Dropdown */}
        <div className="control-wrapper">
          <button
            className={`control-button ${showFilterPanel ? "active" : ""} ${filterRole !== "all" ? "has-value" : ""}`}
            onClick={() => {
              setShowFilterPanel(!showFilterPanel);
              setShowSearchPanel(false);
            }}
          >
            <Filter size={16} />
            <span>
              {filterRole === "all"
                ? "All Roles"
                : roles.find((r) => r.id === filterRole)?.name || "Filter"}
            </span>
          </button>

          {showFilterPanel && (
            <div className="dropdown-panel filter-panel">
              <div className="panel-header">
                <Filter size={14} />
                <span>Filter by Role</span>
              </div>
              <div className="filter-options">
                <button
                  className={`filter-option ${filterRole === "all" ? "selected" : ""}`}
                  onClick={() => {
                    setFilterRole("all");
                    setShowFilterPanel(false);
                  }}
                >
                  <div className="option-indicator" />
                  <span>All Roles</span>
                  <span className="option-count">{members.length}</span>
                </button>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    className={`filter-option ${filterRole === role.id ? "selected" : ""}`}
                    onClick={() => {
                      setFilterRole(role.id);
                      setShowFilterPanel(false);
                    }}
                  >
                    <div
                      className="option-indicator"
                      style={{ background: role.color }}
                    />
                    <span>{role.name}</span>
                    <span className="option-count">
                      {members.filter((m) => m.role_id === role.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="members-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading members...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} color="#666" />
            <h3>No members found</h3>
            <p>Try adjusting your search or filter</p>
          </div>
        ) : (
          groupedMembers.map(({ role, members: roleMembers }) => (
            <div key={role.id} className="role-group">
              <div className="role-group-header" style={{ color: role.color }}>
                <Crown size={14} />
                <span>{role.name}</span>
                <div
                  className="role-member-count"
                  style={{ background: `${role.color}20`, color: role.color }}
                >
                  {roleMembers.length}
                </div>
              </div>

              <div className="members-grid">
                {roleMembers.map((member) => {
                  const avatarUrl = member.user?.avatar_id
                    ? mediaUrlService.getAvatarUrl(member.user.avatar_id, 200)
                    : null;

                  const memberStatus = onlineStatuses[member.user_id] || {
                    online: false,
                  };
                  const isOnline = memberStatus.online;

                  return (
                    <div key={member.id} className="member-card">
                      <div className="member-card-contents">
                        <div className="member-card-header">
                          <div className="member-avatar">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={member.user?.full_name}
                              />
                            ) : (
                              <span className="avatar-fallback">
                                {member.user?.full_name?.[0]?.toUpperCase() ||
                                  "?"}
                              </span>
                            )}
                            {isOnline && (
                              <div className="online-status-ring">
                                <div className="online-dot" />
                              </div>
                            )}
                          </div>

                          {member.user?.verified && (
                            <div className="verified-icon">
                              <CheckCircle
                                size={14}
                                fill="#9cff00"
                                color="#000"
                              />
                            </div>
                          )}
                        </div>

                        <div className="member-info">
                          <div className="member-name">
                            {member.user?.full_name || "Unknown User"}
                          </div>
                          <div className="member-username">
                            @{member.user?.username || "unknown"}
                          </div>
                        </div>
                      </div>

                      {member.joined_at && (
                        <div className="member-joined">
                          Joined{" "}
                          {new Date(member.joined_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .members-header {
          padding: 0 12px;
          margin: 20px;
        }

        .members-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }

        .member-count-badge {
          padding: 4px 12px;
          background: linear-gradient(135deg, #9cff00 0%, #667eea 100%);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 800;
          color: #000;
        }

        .members-controls {
          display: flex;
          gap: 8px;
          padding: 0 12px;
          margin-bottom: 20px;
        }

        .control-wrapper {
          flex: 1;
          position: relative;
        }

        .control-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 10px;
          color: #999;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .control-button:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          color: #d4d4d4;
        }

        .control-button.active {
          border-color: rgba(156, 255, 0, 0.6);
          background: rgba(26, 26, 26, 0.9);
          color: #9cff00;
        }

        .control-button.has-value {
          border-color: rgba(156, 255, 0, 0.4);
          color: #9cff00;
        }

        .control-button span {
          flex: 1;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dropdown-panel {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: rgba(15, 15, 15, 0.98);
          border: 2px solid rgba(156, 255, 0, 0.3);
          border-radius: 12px;
          padding: 12px;
          z-index: 1000;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.6),
            0 0 40px rgba(156, 255, 0, 0.1);
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(156, 255, 0, 0.2);
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 700;
          color: #9cff00;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .panel-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.8);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          transition: all 0.2s;
        }

        .panel-input:focus {
          outline: none;
          border-color: rgba(156, 255, 0, 0.6);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.1);
        }

        .panel-input::placeholder {
          color: #666;
        }

        .clear-button {
          width: 100%;
          padding: 8px;
          margin-top: 8px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 6px;
          color: #ff6b6b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-button:hover {
          background: rgba(255, 107, 107, 0.2);
          border-color: rgba(255, 107, 107, 0.5);
        }

        .filter-options {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 300px;
          overflow-y: auto;
        }

        .filter-options::-webkit-scrollbar {
          width: 4px;
        }

        .filter-options::-webkit-scrollbar-track {
          background: rgba(26, 26, 26, 0.3);
        }

        .filter-options::-webkit-scrollbar-thumb {
          background: rgba(156, 255, 0, 0.3);
          border-radius: 2px;
        }

        .filter-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(26, 26, 26, 0.4);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 8px;
          color: #d4d4d4;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .filter-option:hover {
          background: rgba(26, 26, 26, 0.8);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateX(4px);
        }

        .filter-option.selected {
          background: rgba(156, 255, 0, 0.1);
          border-color: rgba(156, 255, 0, 0.6);
          color: #9cff00;
        }

        .option-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(156, 255, 0, 0.3);
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .filter-option.selected .option-indicator {
          box-shadow: 0 0 12px rgba(156, 255, 0, 0.6);
        }

        .filter-option span:first-of-type {
          flex: 1;
        }

        .option-count {
          padding: 2px 8px;
          background: rgba(156, 255, 0, 0.1);
          border: 1px solid rgba(156, 255, 0, 0.3);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #9cff00;
        }

        .members-content {
          padding: 0 12px;
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #666;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(156, 255, 0, 0.1);
          border-top-color: #9cff00;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state h3 {
          font-size: 16px;
          color: #999;
          margin: 16px 0 8px 0;
        }

        .empty-state p {
          font-size: 14px;
        }

        .role-group {
          margin-bottom: 32px;
        }

        .role-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 8px;
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.05) 0%, rgba(102, 126, 234, 0.05) 100%);
          border: 1px solid;
          border-left: 4px solid;
          border-radius: 18px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }

        .role-member-count {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 800;
          margin-left: auto;
          border: 1px solid;
        }

        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 6px;
        }

        .member-card {
          padding: 0 0 10px 0;
          background: rgb(26, 26, 26);
          border: 1px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .member-card:hover {
          transform: translateY(-2px);
        }

        .member-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .member-card-contents {
          display: flex;
          flex-direction: row;
          gap: 8px;
          padding: 10px;
          padding-bottom: 0;
          align-items: center;
        }
        .member-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 3px solid rgba(156, 255, 0, 0.2);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: visible;
          transition: all 0.3s;
        }

        .member-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .avatar-fallback {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }

        .online-status-ring {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .online-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 
            0 0 0 2px rgba(16, 185, 129, 0.3),
            0 0 12px rgba(16, 185, 129, 0.6);
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 
              0 0 0 2px rgba(16, 185, 129, 0.3),
              0 0 12px rgba(16, 185, 129, 0.6);
          }
          50% {
            box-shadow: 
              0 0 0 2px rgba(16, 185, 129, 0.5),
              0 0 16px rgba(16, 185, 129, 0.8);
          }
        }

        .verified-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .member-info {
          flex: 1;
        }

        .member-name {
          font-size: 14px;
          font-weight: 600;
          color: #ffffffd3;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .member-username {
          font-size: 12px;
          color: #999;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .member-joined {
          font-size: 11px;
          color: #666;
          text-align: center;
          padding-top: 8px;
          border-top: 1px solid rgba(42, 42, 42, 0.6);
        }
      `}</style>
    </>
  );
};

export default MembersSection;
