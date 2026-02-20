import React, { useState, useEffect } from "react";
import {
  Eye,
  MessageSquare,
  Edit,
  Mail,
  Phone,
  Shield,
  LogOut,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import ProfileEditModal from "./ProfileEditModal";

const ProfileSection = ({ userId, onProfileUpdate, onSignOut }) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📊 Loading profile for user:", userId);

      // ── FIX: maybeSingle() never throws a 406 when row is missing ──────────
      // The old .single() was crashing with "Failed to load profile" any time
      // RLS blocked the row OR the profile didn't exist yet. maybeSingle()
      // returns null data instead of throwing — component renders gracefully.
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_id, bio, verified, is_pro, created_at, email, phone, phone_verified, show_email, show_phone",
        )
        .eq("id", userId)
        .maybeSingle(); // ← was .single() — THE BUG

      if (profileError) {
        // Log but don't throw — show retry UI instead of crashing the whole tab
        console.warn("⚠️ Profile query error:", profileError.message);
        setError("Could not load profile.");
        return;
      }

      if (!profileData) {
        // New user whose profile row hasn't been created yet — show empty state
        console.warn("⚠️ No profile row found for:", userId);
        setProfile({
          id: userId,
          fullName: "Xeevia User",
          username: "user",
          avatar: null,
          avatarId: null,
          bio: null,
          verified: false,
          isPro: false,
          joinDate: new Date().toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
          email: null,
          phone: null,
          phoneVerified: false,
          showEmail: false,
          showPhone: false,
          stats: {
            totalContent: 0,
            stories: 0,
            reels: 0,
            posts: 0,
            totalViews: 0,
            totalComments: 0,
          },
          wallet: { grovaTokens: 0, engagementPoints: 0 },
        });
        return;
      }

      console.log("✅ Profile loaded:", profileData);

      // ── Wallet — maybeSingle, never throws ───────────────────────────────
      const { data: wallet } = await supabase
        .from("wallets")
        .select("grova_tokens, engagement_points")
        .eq("user_id", userId)
        .maybeSingle(); // ← was .single() — also crashed when wallet missing

      // ── Content stats — all parallel, all graceful ────────────────────────
      const [
        storiesResult,
        reelsResult,
        postsResult,
        storiesViewsResult,
        reelsViewsResult,
        postsViewsResult,
        commentsResult,
      ] = await Promise.allSettled([
        supabase
          .from("stories")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("reels")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("stories")
          .select("views")
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("reels")
          .select("views")
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("posts")
          .select("views")
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
      ]);

      // Safely extract counts — default 0 if query failed
      const storiesCount =
        storiesResult.status === "fulfilled"
          ? (storiesResult.value.count ?? 0)
          : 0;
      const reelsCount =
        reelsResult.status === "fulfilled" ? (reelsResult.value.count ?? 0) : 0;
      const postsCount =
        postsResult.status === "fulfilled" ? (postsResult.value.count ?? 0) : 0;
      const commentsCount =
        commentsResult.status === "fulfilled"
          ? (commentsResult.value.count ?? 0)
          : 0;

      const allViewRows = [
        ...(storiesViewsResult.status === "fulfilled"
          ? storiesViewsResult.value.data || []
          : []),
        ...(reelsViewsResult.status === "fulfilled"
          ? reelsViewsResult.value.data || []
          : []),
        ...(postsViewsResult.status === "fulfilled"
          ? postsViewsResult.value.data || []
          : []),
      ];
      const totalViews = allViewRows.reduce(
        (sum, item) => sum + (item.views || 0),
        0,
      );

      // ── Avatar URL ────────────────────────────────────────────────────────
      let avatarUrl = null;
      if (profileData.avatar_id) {
        const baseUrl = mediaUrlService.getImageUrl(profileData.avatar_id);
        if (baseUrl && typeof baseUrl === "string") {
          const cleanUrl = baseUrl.split("?")[0];
          avatarUrl = cleanUrl.includes("supabase")
            ? `${cleanUrl}?quality=100&width=600&height=600&resize=cover&format=webp`
            : baseUrl;
        }
      }

      const profileState = {
        id: profileData.id,
        fullName: profileData.full_name || "Xeevia User",
        username: profileData.username || "user",
        avatar: avatarUrl,
        avatarId: profileData.avatar_id,
        bio: profileData.bio,
        verified: profileData.verified || false,
        isPro: profileData.is_pro || false,
        joinDate: new Date(profileData.created_at).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        email: profileData.email,
        phone: profileData.phone,
        phoneVerified: profileData.phone_verified || false,
        showEmail: profileData.show_email || false,
        showPhone: profileData.show_phone || false,
        stats: {
          totalContent: storiesCount + reelsCount + postsCount,
          stories: storiesCount,
          reels: reelsCount,
          posts: postsCount,
          totalViews,
          totalComments: commentsCount,
        },
        wallet: {
          grovaTokens: wallet?.grova_tokens || 0,
          engagementPoints: wallet?.engagement_points || 0,
        },
      };

      console.log("✅ Profile state ready:", profileState);
      setProfile(profileState);

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
      // Never crash the component — always show retry UI
      console.warn("⚠️ ProfileSection load error (non-fatal):", err?.message);
      setError("Could not load profile.");
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

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      try {
        console.log("👋 Logging out...");
        await onSignOut();
      } catch (error) {
        console.error("Logout error:", error);
        alert("Failed to logout. Please try again.");
      }
    }
  };

  const formatNumber = (num) => {
    if (num == null) return 0;
    const value = Number(num);
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    if (value % 1 !== 0) return value.toFixed(2);
    return Math.floor(value);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
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
        />
        Loading profile...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error with retry ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ color: "#ef4444", marginBottom: "20px" }}>{error}</div>
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
        Profile not found.{" "}
        <button
          onClick={loadProfileData}
          style={{
            color: "#84cc16",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: "700",
          }}
        >
          Retry
        </button>
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
        }

        .profile-name {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
        }

        .profile-username {
          font-size: 16px;
          color: #84cc16;
          margin: 0 0 16px 0;
          font-weight: 600;
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

        .contact-info-item svg { flex-shrink: 0; }

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

        .metric-icon { color: #84cc16; }

        .metric-value {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin: 0;
        }

        .metric-label {
          font-size: 13px;
          color: #a3a3a3;
          margin: 0;
          font-weight: 600;
        }

        .profile-actions {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          padding: 4px;
          overflow: hidden;
        }

        .action-divider {
          width: 1px;
          height: 48px;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(132, 204, 22, 0.4) 20%,
            rgba(132, 204, 22, 0.6) 50%,
            rgba(132, 204, 22, 0.4) 80%,
            transparent 100%
          );
          flex-shrink: 0;
          position: relative;
        }

        .action-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 3px;
          height: 60%;
          background: radial-gradient(ellipse, rgba(132, 204, 22, 0.8) 0%, transparent 70%);
          filter: blur(2px);
        }

        .edit-profile-btn {
          flex: 1;
          padding: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border: none;
          border-radius: 12px;
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

        .edit-profile-btn:active { transform: translateY(0); }

        .logout-profile-btn {
          flex: 1;
          padding: 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #ef4444;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .logout-profile-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.5);
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(239, 68, 68, 0.4);
        }

        .logout-profile-btn:active { transform: translateY(0); }
      `}</style>

      <div className="profile-section">
        <div className="profile-header-card">
          <div className="profile-header-glow" />
          <div className="profile-header-content">
            {/* Avatar — fallback letter always rendered underneath */}
            <div className="profile-avatar">
              <div className="profile-avatar-fallback">
                {profile.fullName?.charAt(0)?.toUpperCase() || "X"}
              </div>
              {isValidAvatar && (
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  crossOrigin="anonymous"
                  style={{ opacity: imageLoaded && !imageError ? 1 : 0 }}
                />
              )}
            </div>

            <h2 className="profile-name">{profile.fullName}</h2>
            <p className="profile-username">@{profile.username}</p>

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
                        <Shield size={10} /> Verified
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
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">
                  {formatNumber(profile.wallet?.grovaTokens)}
                </p>
                <p className="profile-stat-label">GT Balance</p>
              </div>
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">
                  {formatNumber(profile.wallet?.engagementPoints)}
                </p>
                <p className="profile-stat-label">EP Balance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-card-glow" />
            <div className="metric-content">
              <Eye size={24} className="metric-icon" />
              <p className="metric-value">
                {formatNumber(profile.stats?.totalViews)}
              </p>
              <p className="metric-label">Total Views</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-glow" />
            <div className="metric-content">
              <MessageSquare size={24} className="metric-icon" />
              <p className="metric-value">
                {formatNumber(profile.stats?.totalComments)}
              </p>
              <p className="metric-label">Comments</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="profile-actions">
          <button
            className="edit-profile-btn"
            onClick={() => setShowEditModal(true)}
          >
            <Edit size={20} />
            Edit Profile
          </button>
          <div className="action-divider" />
          <button className="logout-profile-btn" onClick={handleLogout}>
            <LogOut size={20} />
            Logout
          </button>
        </div>
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
