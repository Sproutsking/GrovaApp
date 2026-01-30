// ============================================================================
// src/components/Account/ProfileSection.jsx - WITH EMAIL/PHONE DISPLAY
// ============================================================================

import React, { useState, useEffect } from "react";
import { Eye, MessageSquare, Edit, Mail, Phone, Shield } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import ProfileEditModal from "./ProfileEditModal";

const ProfileSection = ({ userId, onProfileUpdate }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (userId) {
      loadProfileData();
    }
  }, [userId]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📊 Loading profile for user:", userId);

      // Load profile with contact info and privacy settings
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_id, bio, verified, is_pro, created_at, email, phone, phone_verified, show_email, show_phone",
        )
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("❌ Profile error:", profileError);
        throw new Error("Failed to load profile");
      }

      console.log("✅ Profile loaded:", profileData);

      // Load wallet data
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("grova_tokens, engagement_points")
        .eq("user_id", userId)
        .single();

      if (walletError) {
        console.warn("⚠️ Wallet error:", walletError);
      }

      // Load content stats
      const [
        { count: storiesCount },
        { count: reelsCount },
        { count: postsCount },
      ] = await Promise.all([
        supabase
          .from("stories")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("reels")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      // Aggregate views from all content
      const { data: storiesViews } = await supabase
        .from("stories")
        .select("views")
        .eq("user_id", userId);

      const { data: reelsViews } = await supabase
        .from("reels")
        .select("views")
        .eq("user_id", userId);

      const { data: postsViews } = await supabase
        .from("posts")
        .select("views")
        .eq("user_id", userId);

      const totalViews = [
        ...(storiesViews || []),
        ...(reelsViews || []),
        ...(postsViews || []),
      ].reduce((sum, item) => sum + (item.views || 0), 0);

      // Aggregate comments
      const { count: commentsCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Convert avatar_id to HIGH QUALITY URL
      let avatarUrl = null;
      if (profileData.avatar_id) {
        const baseUrl = mediaUrlService.getImageUrl(profileData.avatar_id);
        if (baseUrl && typeof baseUrl === "string") {
          const cleanUrl = baseUrl.split("?")[0];
          if (cleanUrl.includes("supabase")) {
            avatarUrl = `${cleanUrl}?quality=100&width=600&height=600&resize=cover&format=webp`;
          } else {
            avatarUrl = baseUrl;
          }
        }
      }

      const profileState = {
        id: profileData.id,
        fullName: profileData.full_name,
        username: profileData.username,
        avatar: avatarUrl,
        avatarId: profileData.avatar_id,
        bio: profileData.bio,
        verified: profileData.verified,
        isPro: profileData.is_pro,
        joinDate: new Date(profileData.created_at).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        // Contact info with privacy settings
        email: profileData.email,
        phone: profileData.phone,
        phoneVerified: profileData.phone_verified,
        showEmail: profileData.show_email,
        showPhone: profileData.show_phone,
        stats: {
          totalContent:
            (storiesCount || 0) + (reelsCount || 0) + (postsCount || 0),
          stories: storiesCount || 0,
          reels: reelsCount || 0,
          posts: postsCount || 0,
          totalViews: totalViews,
          totalComments: commentsCount || 0,
        },
        wallet: {
          grovaTokens: wallet?.grova_tokens || 0,
          engagementPoints: wallet?.engagement_points || 0,
        },
      };

      console.log("✅ Profile state ready:", profileState);
      setProfile(profileState);

      // Notify parent component for header update
      if (onProfileUpdate) {
        onProfileUpdate({
          id: profileState.id,
          fullName: profileState.fullName,
          username: profileState.username,
          avatar: avatarUrl,
          verified: profileState.verified,
          isPro: profileState.isPro,
        });
      }
    } catch (err) {
      console.error("❌ Failed to load profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = (updatedData) => {
    setProfile((prev) => ({
      ...prev,
      fullName: updatedData.fullName,
      username: updatedData.username,
      bio: updatedData.bio,
      avatar: updatedData.avatar,
      avatarId: updatedData.avatarId,
    }));

    // Update parent component
    if (onProfileUpdate) {
      onProfileUpdate({
        id: profile.id,
        fullName: updatedData.fullName,
        username: updatedData.username,
        avatar: updatedData.avatar,
        verified: profile.verified,
        isPro: profile.isPro,
      });
    }
  };

  const formatNumber = (num) => {
    if (num == null) return 0;
    const value = Number(num);

    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }

    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }

    if (value % 1 !== 0) {
      return value.toFixed(2);
    }

    return Math.floor(value);
  };

  const handleImageLoad = () => {
    console.log("✅ Profile avatar loaded successfully");
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e) => {
    console.error("❌ Profile avatar error:", e);
    setImageLoaded(false);
    setImageError(true);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#84cc16" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid rgba(132, 204, 22, 0.2)",
            borderTop: "4px solid #84cc16",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }}
        ></div>
        Loading profile...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ color: "#ef4444", marginBottom: "20px" }}>
          Error: {error}
        </div>
        <button
          onClick={loadProfileData}
          style={{
            padding: "12px 24px",
            background: "#84cc16",
            border: "none",
            borderRadius: "12px",
            color: "#000",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#737373" }}>
        Profile not found
      </div>
    );
  }

  const isValidAvatar =
    profile.avatar &&
    typeof profile.avatar === "string" &&
    !imageError &&
    (profile.avatar.startsWith("http") || profile.avatar.startsWith("blob:"));

  return (
    <>
      <style>{`
        .profile-section {
          padding: 20px;
        }

        .profile-header-card {
          position: relative;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-radius: 24px;
          padding: 40px 24px;
          margin-bottom: 24px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .profile-header-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.12) 0%, rgba(132, 204, 22, 0.04) 100%);
          animation: headerPulse 3s ease-in-out infinite;
        }

        @keyframes headerPulse {
          0%, 100% { opacity: 0.6; }
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
          border-radius: 32px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          border: 4px solid rgba(132, 204, 22, 0.4);
          font-size: 48px;
          color: #000;
          font-weight: 800;
          overflow: hidden;
          box-shadow: 0 8px 40px rgba(132, 204, 22, 0.5);
          position: relative;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          filter: brightness(1.15) contrast(1.2) saturate(1.25);
          opacity: ${imageLoaded && !imageError ? "1" : "0"};
          transition: opacity 0.5s ease-in-out;
        }

        .profile-avatar-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          color: #000;
          font-weight: 800;
          opacity: ${imageLoaded && !imageError ? "0" : "1"};
          transition: opacity 0.5s ease-in-out;
        }

        .profile-name {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
          filter: brightness(1.1);
        }

        .profile-username {
          font-size: 16px;
          color: #84cc16;
          margin: 0 0 16px 0;
          font-weight: 600;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
        }

        .contact-info-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
          padding: 0 20px;
        }

        .contact-info-item {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(132, 204, 22, 0.08);
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-radius: 12px;
          font-size: 14px;
          color: #84cc16;
        }

        .contact-info-item svg {
          flex-shrink: 0;
        }

        .verified-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 6px;
          color: #22c55e;
          font-size: 11px;
          font-weight: 700;
          margin-left: 8px;
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
          filter: brightness(1.15);
        }

        .profile-stat-label {
          font-size: 11px;
          color: #a3a3a3;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
          white-space: nowrap;
        }

        .stat-divider {
          width: 1px;
          height: 35px;
          background: linear-gradient(180deg, transparent 0%, rgba(132, 204, 22, 0.4) 50%, transparent 100%);
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
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(132, 204, 22, 0.25);
          border-radius: 18px;
          padding: 20px;
          overflow: hidden;
          transition: all 0.3s;
        }

        .metric-card:hover {
          border-color: rgba(132, 204, 22, 0.5);
          transform: translateY(-4px);
          box-shadow: 0 8px 28px rgba(132, 204, 22, 0.3);
        }

        .metric-card-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.08) 0%, transparent 100%);
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
          filter: brightness(1.2);
        }

        .metric-value {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin: 0;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
        }

        .metric-label {
          font-size: 13px;
          color: #a3a3a3;
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
          box-shadow: 0 4px 20px rgba(132, 204, 22, 0.4);
        }

        .edit-profile-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(132, 204, 22, 0.6);
          filter: brightness(1.1);
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
              {isValidAvatar && (
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  crossOrigin="anonymous"
                />
              )}
              <div className="profile-avatar-fallback">
                {profile.fullName?.charAt(0)?.toUpperCase() || "G"}
              </div>
            </div>

            <h2 className="profile-name">{profile.fullName || "Grova User"}</h2>
            <p className="profile-username">@{profile.username || "user"}</p>

            {/* Contact Information - Only shown if settings allow */}
            {(profile.showEmail || profile.showPhone) && (
              <div className="contact-info-section">
                {profile.showEmail && profile.email && (
                  <div className="contact-info-item">
                    <Mail size={16} />
                    <span>{profile.email}</span>
                  </div>
                )}
                {profile.showPhone && profile.phone && (
                  <div className="contact-info-item">
                    <Phone size={16} />
                    <span>{profile.phone}</span>
                    {profile.phoneVerified && (
                      <span className="verified-indicator">
                        <Shield size={10} />
                        Verified
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

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

        <button
          className="edit-profile-btn"
          onClick={() => setShowEditModal(true)}
        >
          <Edit size={20} />
          Edit Profile
        </button>
      </div>

      {showEditModal && (
        <ProfileEditModal
          userId={userId}
          currentProfile={{
            fullName: profile.fullName,
            username: profile.username,
            bio: profile.bio,
            avatar: profile.avatar,
            avatarId: profile.avatarId,
          }}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
};

export default ProfileSection;
