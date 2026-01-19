// src/components/Profile/UserProfileModal.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Bell, Eye, MessageSquare, Heart, User, UserPlus, UserCheck,
  Sparkles, TrendingUp, Award, BookOpen, Film, Image, DollarSign,
  Users, Calendar, MapPin, Link as LinkIcon, MoreHorizontal, Share2, Flag
} from 'lucide-react';
import profileService from '../../services/account/profileService';
import { useToast } from '../../contexts/ToastContext';

const UserProfileModal = ({ user, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const isMobile = window.innerWidth <= 768;

  const isOwnProfile = currentUser?.id === user?.id || currentUser?.id === user?.user_id;

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      const userId = user?.id || user?.user_id || user?.userId;
      if (!userId) {
        console.error('No user ID found');
        return;
      }

      const profile = await profileService.getProfile(userId);
      setProfileData(profile);
    } catch (error) {
      console.error('Failed to load profile:', error);
      showToast('error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    try {
      setIsFollowing(!isFollowing);
      showToast('success', isFollowing ? 'Unfollowed' : 'Following!', 
        `You ${isFollowing ? 'unfollowed' : 'are now following'} ${profileData?.fullName}`);
    } catch (error) {
      showToast('error', 'Action failed');
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className={`profile-modal-overlay ${isMobile ? 'mobile' : ''}`} onClick={onClose}>
        <div className="profile-modal-container loading" onClick={(e) => e.stopPropagation()}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!profileData) return null;

  const displayName = profileData.fullName || user?.author || user?.name || 'User';
  const username = profileData.username || (user?.author || user?.name || 'user').toLowerCase().replace(/\s+/g, '_');
  const avatar = profileData.avatar || user?.avatar || displayName.charAt(0);

  return (
    <>
      <style>{`
        .profile-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(24px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          animation: fadeIn 0.3s ease;
        }

        .profile-modal-overlay.mobile {
          justify-content: center;
          align-items: flex-end;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes slideInUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .profile-modal-container {
          width: 480px;
          max-width: 480px;
          height: 100vh;
          background: #000;
          border-left: 1px solid rgba(132, 204, 22, 0.2);
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .profile-modal-container {
            width: 100%;
            max-width: 100%;
            height: 95vh;
            border-radius: 24px 24px 0 0;
            border-left: none;
            border-top: 1px solid rgba(132, 204, 22, 0.2);
            animation: slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
        }

        .profile-modal-container.loading {
          justify-content: center;
          align-items: center;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .profile-modal-header {
          position: sticky;
          top: 0;
          background: rgba(0, 0, 0, 0.98);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }

        .profile-back-btn, .profile-action-icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #737373;
          cursor: pointer;
          transition: all 0.2s;
        }

        .profile-back-btn:hover, .profile-action-icon-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #84cc16;
          border-color: rgba(132, 204, 22, 0.3);
        }

        .profile-header-title {
          flex: 1;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .profile-verified-badge {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #84cc16;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .profile-header-actions {
          display: flex;
          gap: 8px;
        }

        .profile-modal-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .profile-modal-content::-webkit-scrollbar {
          width: 6px;
        }

        .profile-modal-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .profile-modal-content::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 3px;
        }

        .profile-banner-section {
          position: relative;
          height: 140px;
          margin-bottom: 80px;
        }

        .profile-banner-gradient {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(132, 204, 22, 0.05) 100%);
        }

        .profile-avatar-container {
          position: absolute;
          bottom: -60px;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
        }

        .profile-avatar-large {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #000;
          font-size: 48px;
          margin: 0 auto;
          border: 6px solid #000;
          box-shadow: 0 8px 32px rgba(132, 204, 22, 0.5);
          position: relative;
          z-index: 2;
          overflow: hidden;
        }

        .profile-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-avatar-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, rgba(132, 204, 22, 0.3) 0%, transparent 70%);
          z-index: 1;
          pointer-events: none;
        }

        .profile-basic-info {
          padding: 0 20px 24px;
          text-align: center;
        }

        .profile-display-name {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .profile-username-text {
          font-size: 15px;
          color: #84cc16;
          margin: 0 0 16px 0;
        }

        .profile-bio {
          font-size: 14px;
          color: #a3a3a3;
          line-height: 1.6;
          margin: 0 0 16px 0;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .profile-meta-info {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #737373;
        }

        .profile-meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .profile-meta-item a {
          color: #84cc16;
          text-decoration: none;
        }

        .profile-action-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .profile-follow-btn, .profile-message-btn, .profile-edit-btn {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s;
          border: none;
        }

        .profile-follow-btn {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          color: #000;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.3);
        }

        .profile-follow-btn.following {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(132, 204, 22, 0.3);
        }

        .profile-message-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(132, 204, 22, 0.2);
        }

        .profile-edit-btn {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          color: #000;
        }

        .profile-icon-only-btn {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          cursor: pointer;
          flex-shrink: 0;
        }

        .profile-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          padding: 0 20px 24px;
        }

        .profile-stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          padding: 16px 8px;
          text-align: center;
          transition: all 0.2s;
        }

        .profile-stat-card.highlight {
          background: rgba(132, 204, 22, 0.1);
          border-color: rgba(132, 204, 22, 0.3);
        }

        .profile-stat-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          transform: translateY(-2px);
        }

        .stat-icon {
          color: #84cc16;
          margin-bottom: 8px;
        }

        .stat-number {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .profile-engagement-stats {
          display: flex;
          justify-content: space-around;
          padding: 20px;
          margin: 0 20px 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
        }

        .engagement-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .engagement-value {
          font-size: 20px;
          font-weight: 800;
          color: #84cc16;
        }

        .engagement-label {
          font-size: 12px;
          color: #737373;
        }

        .engagement-divider {
          width: 1px;
          background: rgba(132, 204, 22, 0.2);
        }

        .profile-achievements-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          margin: 0 20px 24px;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.1) 0%, rgba(132, 204, 22, 0.05) 100%);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 12px;
        }

        .achievement-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
          flex-shrink: 0;
        }

        .achievement-info {
          flex: 1;
        }

        .achievement-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .achievement-desc {
          font-size: 13px;
          color: #737373;
        }

        .achievement-badge {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(132, 204, 22, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #84cc16;
        }

        .profile-content-tabs {
          display: flex;
          gap: 8px;
          padding: 0 20px;
          border-bottom: 1px solid rgba(132, 204, 22, 0.1);
          margin-bottom: 24px;
        }

        .profile-tab {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          color: #737373;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
          font-weight: 600;
        }

        .profile-tab.active {
          color: #84cc16;
          border-bottom-color: #84cc16;
        }

        .profile-recent-content {
          padding: 0 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .profile-content-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
          cursor: pointer;
        }

        .profile-content-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          background: rgba(255, 255, 255, 0.05);
        }

        .content-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .content-type-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: rgba(132, 204, 22, 0.2);
          border-radius: 6px;
          color: #84cc16;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .content-category-tag {
          padding: 4px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 6px;
          font-size: 11px;
          color: #737373;
        }

        .content-card-title {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 12px 0;
          line-height: 1.4;
        }

        .content-card-stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #737373;
        }

        .content-stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .content-unlock-price {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(132, 204, 22, 0.1);
          color: #84cc16;
          font-weight: 700;
          font-size: 14px;
        }

        .profile-report-section {
          padding: 0 20px 24px;
        }

        .profile-report-btn {
          width: 100%;
          padding: 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #ef4444;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .profile-report-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.5);
        }
      `}</style>

      <div className={`profile-modal-overlay ${isMobile ? 'mobile' : ''}`} onClick={onClose}>
        <div className="profile-modal-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="profile-modal-header">
            <button onClick={onClose} className="profile-back-btn">
              <ArrowLeft size={20} />
            </button>
            <div className="profile-header-title">
              <span>{displayName}</span>
              {profileData.verified && (
                <div className="profile-verified-badge">
                  <Sparkles size={12} />
                </div>
              )}
            </div>
            <div className="profile-header-actions">
              <button className="profile-action-icon-btn">
                <Share2 size={18} />
              </button>
              <button className="profile-action-icon-btn">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="profile-modal-content">
            {/* Banner with Avatar */}
            <div className="profile-banner-section">
              <div className="profile-banner-gradient"></div>
              <div className="profile-avatar-container">
                <div className="profile-avatar-large">
                  {typeof avatar === 'string' && avatar.startsWith('http') ? (
                    <img src={avatar} alt={displayName} />
                  ) : (
                    avatar
                  )}
                </div>
                <div className="profile-avatar-glow"></div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="profile-basic-info">
              <h2 className="profile-display-name">{displayName}</h2>
              <p className="profile-username-text">@{username}</p>
              
              {profileData.bio && (
                <p className="profile-bio">{profileData.bio}</p>
              )}

              {/* Meta Info */}
              <div className="profile-meta-info">
                {profileData.location && (
                  <div className="profile-meta-item">
                    <MapPin size={14} />
                    <span>{profileData.location}</span>
                  </div>
                )}
                <div className="profile-meta-item">
                  <Calendar size={14} />
                  <span>Joined {profileData.joinDate || 'Jan 2024'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="profile-action-buttons">
                {!isOwnProfile ? (
                  <>
                    <button 
                      className={`profile-follow-btn ${isFollowing ? 'following' : ''}`}
                      onClick={handleFollowToggle}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck size={18} />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={18} />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                    <button className="profile-message-btn">
                      <MessageSquare size={18} />
                      <span>Message</span>
                    </button>
                  </>
                ) : (
                  <button className="profile-edit-btn">
                    <User size={18} />
                    <span>Edit Profile</span>
                  </button>
                )}
                <button className="profile-icon-only-btn">
                  <Bell size={18} />
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="profile-stats-grid">
              <div className="profile-stat-card">
                <BookOpen size={20} className="stat-icon" />
                <div className="stat-number">{profileData.stats?.stories || 0}</div>
                <div className="stat-label">Stories</div>
              </div>
              <div className="profile-stat-card">
                <Film size={20} className="stat-icon" />
                <div className="stat-number">{profileData.stats?.reels || 0}</div>
                <div className="stat-label">Reels</div>
              </div>
              <div className="profile-stat-card">
                <Image size={20} className="stat-icon" />
                <div className="stat-number">{profileData.stats?.posts || 0}</div>
                <div className="stat-label">Posts</div>
              </div>
              <div className="profile-stat-card highlight">
                <DollarSign size={20} className="stat-icon" />
                <div className="stat-number">{formatNumber(profileData.wallet?.grovaTokens || 0)}</div>
                <div className="stat-label">Tokens</div>
              </div>
            </div>

            {/* Engagement Stats */}
            <div className="profile-engagement-stats">
              <div className="engagement-item">
                <Users size={16} />
                <span className="engagement-value">{formatNumber(profileData.stats?.followers || 0)}</span>
                <span className="engagement-label">Followers</span>
              </div>
              <div className="engagement-divider"></div>
              <div className="engagement-item">
                <Eye size={16} />
                <span className="engagement-value">{formatNumber(profileData.stats?.totalViews || 0)}</span>
                <span className="engagement-label">Views</span>
              </div>
              <div className="engagement-divider"></div>
              <div className="engagement-item">
                <Heart size={16} />
                <span className="engagement-value">{formatNumber(profileData.stats?.totalLikes || 0)}</span>
                <span className="engagement-label">Likes</span>
              </div>
            </div>

            {/* Achievements Banner */}
            <div className="profile-achievements-banner">
              <div className="achievement-icon">
                <Award size={24} />
              </div>
              <div className="achievement-info">
                <div className="achievement-title">Elite Creator</div>
                <div className="achievement-desc">{formatNumber(profileData.wallet?.engagementPoints || 0)} EP earned</div>
              </div>
              <div className="achievement-badge">
                <TrendingUp size={16} />
              </div>
            </div>

            {/* Tabs */}
            <div className="profile-content-tabs">
              <button 
                className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <Image size={18} />
                <span>Posts</span>
              </button>
              <button 
                className={`profile-tab ${activeTab === 'stories' ? 'active' : ''}`}
                onClick={() => setActiveTab('stories')}
              >
                <BookOpen size={18} />
                <span>Stories</span>
              </button>
              <button 
                className={`profile-tab ${activeTab === 'reels' ? 'active' : ''}`}
                onClick={() => setActiveTab('reels')}
              >
                <Film size={18} />
                <span>Reels</span>
              </button>
            </div>

            {/* Recent Content */}
            <div className="profile-recent-content">
              <div className="profile-content-card">
                <div className="content-card-header">
                  <div className="content-type-badge">
                    <BookOpen size={14} />
                    <span>story</span>
                  </div>
                  <div className="content-category-tag">Folklore</div>
                </div>
                <h4 className="content-card-title">The Village Oracle's Last Words</h4>
                <div className="content-card-stats">
                  <span className="content-stat">
                    <Eye size={14} />
                    {formatNumber(2800)}
                  </span>
                  <span className="content-stat">
                    <MessageSquare size={14} />
                    342
                  </span>
                  <span className="content-stat">
                    <Heart size={14} />
                    890
                  </span>
                </div>
                <div className="content-unlock-price">
                  <DollarSign size={14} />
                  50 GT
                </div>
              </div>
            </div>

            {/* Report - Only for other profiles */}
            {!isOwnProfile && (
              <div className="profile-report-section">
                <button className="profile-report-btn">
                  <Flag size={16} />
                  <span>Report User</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UserProfileModal;