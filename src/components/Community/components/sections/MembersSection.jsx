import React, { useState } from 'react';
import { ChevronLeft, Crown, Users, Search, Filter, Shield, CheckCircle } from 'lucide-react';

const MembersSection = ({ 
  members, 
  roles, 
  loading,
  onBack
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || member.role_id === filterRole;
    return matchesSearch && matchesRole;
  });

  const groupedMembers = roles.map(role => ({
    role,
    members: filteredMembers.filter(m => m.role_id === role.id)
  })).filter(group => group.members.length > 0);

  return (
    <>
      <div className="back-button" onClick={onBack}>
        <ChevronLeft size={16} />
        Back to Menu
      </div>

      <div className="members-header">
        <div className="members-title">
          <Users size={20} />
          <span>Community Members</span>
          <div className="member-count-badge">
            {filteredMembers.length}
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="members-controls">
        <div className="search-bar">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-dropdown">
          <Filter size={16} />
          <select 
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Members List */}
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
                <div className="role-member-count" style={{ background: `${role.color}20`, color: role.color }}>
                  {roleMembers.length}
                </div>
              </div>

              <div className="members-grid">
                {roleMembers.map(member => (
                  <div key={member.id} className="member-card">
                    <div className="member-card-header">
                      <div className="member-avatar">
                        {member.user?.avatar ? (
                          <img src={member.user.avatar} alt={member.user?.full_name} />
                        ) : (
                          <span className="avatar-fallback">
                            {member.user?.full_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        )}
                        {member.is_online && <div className="online-dot" />}
                      </div>

                      {member.user?.verified && (
                        <div className="verified-icon">
                          <CheckCircle size={14} fill="#9cff00" color="#000" />
                        </div>
                      )}
                    </div>

                    <div className="member-info">
                      <div className="member-name">
                        {member.user?.full_name || 'Unknown User'}
                      </div>
                      <div className="member-username">
                        @{member.user?.username || 'unknown'}
                      </div>
                    </div>

                    <div className="member-role-badge" style={{ 
                      background: `${role.color}15`, 
                      color: role.color,
                      borderColor: `${role.color}40`
                    }}>
                      {role.name}
                    </div>

                    {member.joined_at && (
                      <div className="member-joined">
                        Joined {new Date(member.joined_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          cursor: pointer;
          color: #9cff00;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          margin-bottom: 16px;
        }

        .back-button:hover {
          transform: translateX(-4px);
          color: #84cc16;
        }

        .members-header {
          padding: 0 12px;
          margin-bottom: 20px;
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
          gap: 12px;
          padding: 0 12px;
          margin-bottom: 20px;
        }

        .search-bar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 10px;
          transition: all 0.2s;
        }

        .search-bar:focus-within {
          border-color: rgba(156, 255, 0, 0.6);
          box-shadow: 0 0 0 3px rgba(156, 255, 0, 0.1);
        }

        .search-bar input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font-size: 14px;
        }

        .search-bar input::placeholder {
          color: #666;
        }

        .filter-dropdown {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.8);
          border-radius: 10px;
          min-width: 160px;
        }

        .filter-dropdown select {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font-size: 14px;
          cursor: pointer;
        }

        .filter-dropdown select option {
          background: #1a1a1a;
          color: #fff;
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
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(156, 255, 0, 0.05) 0%, rgba(102, 126, 234, 0.05) 100%);
          border-left: 4px solid;
          border-radius: 8px;
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
          gap: 12px;
        }

        .member-card {
          padding: 16px;
          background: rgba(26, 26, 26, 0.6);
          border: 2px solid rgba(42, 42, 42, 0.6);
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .member-card:hover {
          background: rgba(26, 26, 26, 0.9);
          border-color: rgba(156, 255, 0, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .member-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .member-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .member-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-fallback {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }

        .online-dot {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #10b981;
          border: 3px solid rgba(26, 26, 26, 0.9);
          box-shadow: 0 0 12px #10b981;
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
          color: #fff;
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

        .member-role-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid;
          align-self: flex-start;
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