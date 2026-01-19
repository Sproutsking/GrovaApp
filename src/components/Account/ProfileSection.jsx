// src/components/Account/ProfileSection.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { Eye, MessageSquare, Edit, Award, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import mediaUrlService from '../../services/shared/mediaUrlService';
import UnifiedLoader from '../Shared/UnifiedLoader';
import ProfileEditModal from './ProfileEditModal';

const ProfileSection = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (userId) {
      loadProfileData();
    }
  }, [userId]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 Loading profile for user:', userId);

      // Load profile - FIXED: removed non-existent columns (location, website)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_id, bio, verified, is_pro, created_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ Profile error:', profileError);
        throw new Error('Failed to load profile');
      }

      console.log('✅ Profile loaded:', profileData);

      // Load wallet data
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('grova_tokens, engagement_points')
        .eq('user_id', userId)
        .single();

      if (walletError) {
        console.warn('⚠️ Wallet error:', walletError);
      }

      // Load content stats using correct column names (views not views_count)
      const [
        { count: storiesCount },
        { count: reelsCount },
        { count: postsCount }
      ] = await Promise.all([
        supabase.from('stories').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('reels').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId)
      ]);

      // Aggregate views from all content (using 'views' not 'views_count')
      const { data: storiesViews } = await supabase
        .from('stories')
        .select('views')
        .eq('user_id', userId);

      const { data: reelsViews } = await supabase
        .from('reels')
        .select('views')
        .eq('user_id', userId);

      const { data: postsViews } = await supabase
        .from('posts')
        .select('views')
        .eq('user_id', userId);

      const totalViews = [
        ...(storiesViews || []),
        ...(reelsViews || []),
        ...(postsViews || [])
      ].reduce((sum, item) => sum + (item.views || 0), 0);

      // Aggregate comments
      const { count: commentsCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Convert avatar_id to URL if exists
      const avatarUrl = profileData.avatar_id 
        ? mediaUrlService.getImageUrl(profileData.avatar_id) 
        : null;

      const profileState = {
        id: profileData.id,
        fullName: profileData.full_name,
        username: profileData.username,
        avatar: avatarUrl,
        bio: profileData.bio,
        verified: profileData.verified,
        isPro: profileData.is_pro,
        joinDate: new Date(profileData.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric' 
        }),
        stats: {
          totalContent: (storiesCount || 0) + (reelsCount || 0) + (postsCount || 0),
          stories: storiesCount || 0,
          reels: reelsCount || 0,
          posts: postsCount || 0,
          totalViews: totalViews,
          totalComments: commentsCount || 0
        },
        wallet: {
          grovaTokens: wallet?.grova_tokens || 0,
          engagementPoints: wallet?.engagement_points || 0
        }
      };

      console.log('✅ Profile state ready:', profileState);
      setProfile(profileState);

    } catch (err) {
      console.error('❌ Failed to load profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = (updatedData) => {
    setProfile(prev => ({
      ...prev,
      fullName: updatedData.fullName,
      username: updatedData.username,
      bio: updatedData.bio,
      avatar: updatedData.avatar
    }));
  };

  const formatNumber = (num) => {
    // Handle undefined/null
    if (num == null) return 0;
    
    // Convert to number and handle floating point precision
    const value = Number(num);
    
    // For millions
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    
    // For thousands
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    
    // For decimal numbers, round to 2 decimal places
    if (value % 1 !== 0) {
      return value.toFixed(2);
    }
    
    // For whole numbers
    return Math.floor(value);
  };

  if (loading) {
    return <UnifiedLoader type="profile" />;
  }

  if (error) {
    return <UnifiedLoader type="profile" error={error} onRetry={loadProfileData} />;
  }

  if (!profile) {
    return <UnifiedLoader type="profile" error="Profile not found" onRetry={loadProfileData} />;
  }

  return (
    <>
      <style>{`
        .profile-section {
          padding: 20px;
        }

        .profile-header-card {
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 20px;
          padding: 40px 24px;
          margin-bottom: 24px;
          overflow: hidden;
        }

        .profile-header-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.1) 0%, rgba(132, 204, 22, 0.03) 100%);
          animation: headerPulse 3s ease-in-out infinite;
        }

        @keyframes headerPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .profile-header-content {
          position: relative;
          z-index: 1;
          text-align: center;
        }

        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 30px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          border: 4px solid rgba(132, 204, 22, 0.3);
          font-size: 48px;
          color: #000;
          font-weight: 700;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(132, 204, 22, 0.4);
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-name {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 8px 0;
        }

        .profile-username {
          font-size: 16px;
          color: #84cc16;
          margin: 0 0 24px 0;
          font-weight: 600;
        }

        .profile-stats-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex-wrap: nowrap;
        }

        .profile-stat {
          text-align: center;
          min-width: 70px;
        }

        .profile-stat-value {
          font-size: 20px;
          font-weight: 900;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 4px 0;
          white-space: nowrap;
        }

        .profile-stat-label {
          font-size: 11px;
          color: #737373;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
          white-space: nowrap;
        }

        .stat-divider {
          width: 1px;
          height: 35px;
          background: linear-gradient(180deg, transparent 0%, rgba(132, 204, 22, 0.3) 50%, transparent 100%);
          flex-shrink: 0;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .metric-card {
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          padding: 20px;
          overflow: hidden;
          transition: all 0.3s;
        }

        .metric-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.2);
        }

        .metric-card-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.05) 0%, transparent 100%);
        }

        .metric-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .metric-icon {
          color: #84cc16;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin: 0;
        }

        .metric-label {
          font-size: 13px;
          color: #737373;
          margin: 0;
          font-weight: 600;
        }

        .edit-profile-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 16px;
          color: #000;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 4px 16px rgba(132, 204, 22, 0.3);
        }

        .edit-profile-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.5);
        }

        .edit-profile-btn:active {
          transform: translateY(0);
        }
      `}</style>

      <div className="profile-section">
        <div className="profile-header-card">
          <div className="profile-header-glow"></div>
          <div className="profile-header-content">
            <div className="profile-avatar">
              {profile.avatar && typeof profile.avatar === 'string' && profile.avatar.startsWith('http') ? (
                <img src={profile.avatar} alt={profile.fullName} />
              ) : (
                profile.fullName?.charAt(0)?.toUpperCase() || 'G'
              )}
            </div>

            <h2 className="profile-name">
              {profile.fullName || 'Grova User'}
            </h2>
            <p className="profile-username">
              @{profile.username || 'user'}
            </p>

            <div className="profile-stats-row">
              <div className="profile-stat">
                <p className="profile-stat-value">
                  {formatNumber(profile.stats?.totalContent)}
                </p>
                <p className="profile-stat-label">Content</p>
              </div>

              <div className="stat-divider"></div>

              <div className="profile-stat">
                <p className="profile-stat-value">
                  {formatNumber(profile.wallet?.grovaTokens)}
                </p>
                <p className="profile-stat-label">GT Balance</p>
              </div>

              <div className="stat-divider"></div>

              <div className="profile-stat">
                <p className="profile-stat-value">
                  {formatNumber(profile.wallet?.engagementPoints)}
                </p>
                <p className="profile-stat-label">EP Balance</p>
              </div>
            </div>
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-card-glow"></div>
            <div className="metric-content">
              <Eye size={24} className="metric-icon" />
              <p className="metric-value">
                {formatNumber(profile.stats?.totalViews)}
              </p>
              <p className="metric-label">Total Views</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card-glow"></div>
            <div className="metric-content">
              <MessageSquare size={24} className="metric-icon" />
              <p className="metric-value">
                {formatNumber(profile.stats?.totalComments)}
              </p>
              <p className="metric-label">Comments</p>
            </div>
          </div>
        </div>

        <button className="edit-profile-btn" onClick={() => setShowEditModal(true)}>
          <Edit size={20} />
          Edit Profile
        </button>
      </div>

      {showEditModal && (
        <ProfileEditModal
          userId={userId}
          currentProfile={profile}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
};

export default ProfileSection;