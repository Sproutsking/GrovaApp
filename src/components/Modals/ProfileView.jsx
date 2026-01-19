import React from 'react';
import { ArrowLeft } from 'lucide-react';

const ProfileView = ({ user, onClose, isMobile }) => (
  <div className={`profile-view ${isMobile ? 'full-screen' : 'pop-up'}`}>
    <div className="profile-bg-gradient"></div>
    <div className="profile-bg-glow"></div>
    <div className="profile-header">
      <button onClick={onClose}>
        <ArrowLeft size={24} />
      </button>
      <h3>{user.name}'s Profile</h3>
    </div>
    <div className="profile-content">
      <div className="profile-avatar-large">{user.avatar}</div>
      <h2 className="profile-name">{user.name}</h2>
      <p className="profile-username">{user.username}</p>
      <div className="profile-stats-row">
          <div className="profile-stat">
            <p className="profile-stat-value">47</p>
            <p className="profile-stat-label">Stories</p>
          </div>
          <div className="profile-stat-divider"></div>
          <div className="profile-stat">
            <p className="profile-stat-value">12.4K</p>
            <p className="profile-stat-label">Readers</p>
          </div>
          <div className="profile-stat-divider"></div>
          <div className="profile-stat">
            <p className="profile-stat-value">89K</p>
            <p className="profile-stat-label">Tokens</p>
          </div>
        </div>
    </div>
    <button className="follow-btn">Follow</button>
  </div>
);

export default ProfileView;