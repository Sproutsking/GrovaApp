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