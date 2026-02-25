// ============================================================================
// src/components/Account/ProfileSection.jsx — UPDATED
// Added Saved Content button. No toast. Logout uses custom confirm.
// ============================================================================

import React, { useState, useEffect } from "react";
import { Eye, MessageSquare, Edit, Mail, Phone, Shield, LogOut, Bookmark } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import ProfileEditModal from "./ProfileEditModal";
import SavedContentModal from "../Modals/SavedContentModal";
import MyContentSection from "./MyContentSection";

// Custom confirm dialog (no browser popup)
const ConfirmLogout = ({ onConfirm, onCancel }) => (
  <>
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(4px)", zIndex: 9998,
    }} />
    <div style={{
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%,-50%)",
      background: "#111", border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: "18px", padding: "28px 24px",
      width: "min(300px, calc(100vw - 40px))",
      zIndex: 9999, boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
    }}>
      <div style={{ width: 44, height: 44, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <LogOut size={20} color="#ef4444" />
      </div>
      <p style={{ color: "#f5f5f5", fontSize: "15px", fontWeight: 700, textAlign: "center", marginBottom: 6 }}>Sign out?</p>
      <p style={{ color: "#737373", fontSize: "13px", textAlign: "center", marginBottom: 22 }}>You'll need to sign back in to access your account.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "11px", color: "#a3a3a3", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: "11px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.45)", borderRadius: "11px", color: "#ef4444", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Sign Out</button>
      </div>
    </div>
  </>
);

const ProfileSection = ({ userId, onProfileUpdate, onSignOut }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isMobile = window.innerWidth <= 768;

  useEffect(() => {
    if (userId) loadProfileData();
  }, [userId]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_id, bio, verified, is_pro, created_at, email, phone, phone_verified, show_email, show_phone")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) { setError("Could not load profile."); return; }

      if (!profileData) {
        setProfile({
          id: userId, fullName: "User", username: "user", avatar: null, avatarId: null,
          bio: null, verified: false, isPro: false,
          joinDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          email: null, phone: null, phoneVerified: false, showEmail: false, showPhone: false,
          stats: { totalContent: 0, stories: 0, reels: 0, posts: 0, totalViews: 0, totalComments: 0 },
          wallet: { grovaTokens: 0, engagementPoints: 0 },
        });
        return;
      }

      const { data: wallet } = await supabase.from("wallets").select("grova_tokens, engagement_points").eq("user_id", userId).maybeSingle();

      const [storiesResult, reelsResult, postsResult, storiesViewsResult, reelsViewsResult, postsViewsResult, commentsResult] =
        await Promise.allSettled([
          supabase.from("stories").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
          supabase.from("reels").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
          supabase.from("stories").select("views").eq("user_id", userId).is("deleted_at", null),
          supabase.from("reels").select("views").eq("user_id", userId).is("deleted_at", null),
          supabase.from("posts").select("views").eq("user_id", userId).is("deleted_at", null),
          supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        ]);

      const storiesCount = storiesResult.status === "fulfilled" ? (storiesResult.value.count ?? 0) : 0;
      const reelsCount = reelsResult.status === "fulfilled" ? (reelsResult.value.count ?? 0) : 0;
      const postsCount = postsResult.status === "fulfilled" ? (postsResult.value.count ?? 0) : 0;
      const commentsCount = commentsResult.status === "fulfilled" ? (commentsResult.value.count ?? 0) : 0;
      const allViewRows = [
        ...(storiesViewsResult.status === "fulfilled" ? storiesViewsResult.value.data || [] : []),
        ...(reelsViewsResult.status === "fulfilled" ? reelsViewsResult.value.data || [] : []),
        ...(postsViewsResult.status === "fulfilled" ? postsViewsResult.value.data || [] : []),
      ];
      const totalViews = allViewRows.reduce((sum, item) => sum + (item.views || 0), 0);

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
        fullName: profileData.full_name || "User",
        username: profileData.username || "user",
        avatar: avatarUrl, avatarId: profileData.avatar_id,
        bio: profileData.bio, verified: profileData.verified || false, isPro: profileData.is_pro || false,
        joinDate: new Date(profileData.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        email: profileData.email, phone: profileData.phone,
        phoneVerified: profileData.phone_verified || false,
        showEmail: profileData.show_email || false, showPhone: profileData.show_phone || false,
        stats: { totalContent: storiesCount + reelsCount + postsCount, stories: storiesCount, reels: reelsCount, posts: postsCount, totalViews, totalComments: commentsCount },
        wallet: { grovaTokens: wallet?.grova_tokens || 0, engagementPoints: wallet?.engagement_points || 0 },
      };

      setProfile(profileState);
      if (onProfileUpdate) onProfileUpdate({ id: profileState.id, fullName: profileState.fullName, username: profileState.username, avatar: avatarUrl, verified: profileState.verified, isPro: profileState.isPro });
    } catch (err) {
      console.warn("ProfileSection load error:", err?.message);
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = (updatedData) => {
    setProfile(prev => ({ ...prev, fullName: updatedData.fullName, username: updatedData.username, bio: updatedData.bio, avatar: updatedData.avatar, avatarId: updatedData.avatarId }));
    if (onProfileUpdate) onProfileUpdate({ id: profile.id, fullName: updatedData.fullName, username: updatedData.username, avatar: updatedData.avatar, verified: profile.verified, isPro: profile.isPro });
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    try { await onSignOut(); } catch (err) { console.error("Logout error:", err); }
  };

  const formatNumber = (num) => {
    if (num == null) return 0;
    const v = Number(num);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    if (v % 1 !== 0) return v.toFixed(2);
    return Math.floor(v);
  };

  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#84cc16" }}>
      <div style={{ width: 48, height: 48, border: "4px solid rgba(132,204,22,0.2)", borderTop: "4px solid #84cc16", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
      Loading profile...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <div style={{ color: "#ef4444", marginBottom: 20 }}>{error}</div>
      <button onClick={loadProfileData} style={{ padding: "12px 24px", background: "#84cc16", border: "none", borderRadius: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>Retry</button>
    </div>
  );

  if (!profile) return null;

  const isValidAvatar = profile.avatar && typeof profile.avatar === "string" && !imageError && (profile.avatar.startsWith("http") || profile.avatar.startsWith("blob:"));

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .profile-section { padding: 20px; }
        .profile-header-card {
          position: relative;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(132,204,22,0.25);
          border-radius: 24px;
          padding: 40px 24px;
          margin-bottom: 24px;
          overflow: hidden;
        }
        .profile-header-glow {
          position: absolute;inset: 0;
          background: linear-gradient(135deg, rgba(132,204,22,0.12) 0%, rgba(132,204,22,0.04) 100%);
        }
        .profile-header-content { position: relative;z-index: 1;text-align: center; }
        .profile-avatar {
          width: 120px;height: 120px;border-radius: 32px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;align-items: center;justify-content: center;
          margin: 0 auto 20px;border: 4px solid rgba(132,204,22,0.4);
          font-size: 48px;color: #000;font-weight: 800;
          overflow: hidden;position: relative;
          box-shadow: 0 8px 40px rgba(132,204,22,0.5);
        }
        .profile-avatar img { width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;transition:opacity 0.5s; }
        .profile-avatar-fallback { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;color:#000;font-weight:800; }
        .profile-name { font-size: 28px;font-weight: 900;color: #fff;margin: 0 0 8px 0; }
        .profile-username { font-size: 16px;color: #84cc16;margin: 0 0 16px 0;font-weight: 600; }
        .profile-stats-row { display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:nowrap; }
        .profile-stat { text-align:center;min-width:70px; }
        .profile-stat-value { font-size:20px;font-weight:900;background:linear-gradient(135deg,#84cc16 0%,#65a30d 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 4px 0; }
        .profile-stat-label { font-size:11px;color:#a3a3a3;margin:0;text-transform:uppercase;letter-spacing:.3px;font-weight:600; }
        .stat-divider { width:1px;height:35px;background:linear-gradient(180deg,transparent 0%,rgba(132,204,22,0.4) 50%,transparent 100%);flex-shrink:0; }
        .metrics-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px; }
        .metric-card { position:relative;background:rgba(255,255,255,0.04);border:1px solid rgba(132,204,22,0.25);border-radius:18px;padding:20px;overflow:hidden;transition:all 0.3s; }
        .metric-card:hover { border-color:rgba(132,204,22,0.5);transform:translateY(-4px);box-shadow:0 8px 28px rgba(132,204,22,0.3); }
        .metric-card-glow { position:absolute;inset:0;background:linear-gradient(135deg,rgba(132,204,22,0.08) 0%,transparent 100%); }
        .metric-content { position:relative;z-index:1;display:flex;flex-direction:column;gap:8px; }
        .metric-icon { color:#84cc16; }
        .metric-value { font-size:28px;font-weight:900;color:#fff;margin:0; }
        .metric-label { font-size:13px;color:#a3a3a3;margin:0;font-weight:600; }
        .profile-actions { display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(132,204,22,0.2);border-radius:16px;padding:4px;overflow:hidden; }
        .action-divider { width:1px;height:48px;background:linear-gradient(180deg,transparent 0%,rgba(132,204,22,0.5) 50%,transparent 100%);flex-shrink:0; }
        .edit-profile-btn { flex:1;padding:16px;background:linear-gradient(135deg,#84cc16 0%,#65a30d 100%);border:none;border-radius:12px;color:#000;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 20px rgba(132,204,22,0.4); }
        .edit-profile-btn:hover { transform:translateY(-2px);box-shadow:0 8px 32px rgba(132,204,22,0.6); }
        .logout-profile-btn { flex:1;padding:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;color:#ef4444;font-size:15px;font-weight:700;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;justify-content:center;gap:10px; }
        .logout-profile-btn:hover { background:rgba(239,68,68,0.15);transform:translateY(-2px); }
        .saved-btn { width:100%;padding:14px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:14px;color:#fbbf24;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px; }
        .saved-btn:hover { background:rgba(251,191,36,0.14);transform:translateY(-2px);box-shadow:0 6px 20px rgba(251,191,36,0.2); }
      `}</style>

      <div className="profile-section">
        <div className="profile-header-card">
          <div className="profile-header-glow" />
          <div className="profile-header-content">
            <div className="profile-avatar">
              <div className="profile-avatar-fallback">{profile.fullName?.charAt(0)?.toUpperCase() || "U"}</div>
              {isValidAvatar && (
                <img src={profile.avatar} alt={profile.fullName}
                  onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)}
                  crossOrigin="anonymous"
                  style={{ opacity: imageLoaded && !imageError ? 1 : 0 }}
                />
              )}
            </div>
            <h2 className="profile-name">{profile.fullName}</h2>
            <p className="profile-username">@{profile.username}</p>
            {profile.bio && <p style={{ color: "#a3a3a3", fontSize: "13px", marginBottom: 16 }}>{profile.bio}</p>}

            {(profile.showEmail || profile.showPhone) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, padding: "0 12px" }}>
                {profile.showEmail && profile.email && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 14px", background: "rgba(132,204,22,0.08)", border: "1px solid rgba(132,204,22,0.2)", borderRadius: "10px", fontSize: "13px", color: "#84cc16" }}>
                    <Mail size={14} />{profile.email}
                  </div>
                )}
                {profile.showPhone && profile.phone && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 14px", background: "rgba(132,204,22,0.08)", border: "1px solid rgba(132,204,22,0.2)", borderRadius: "10px", fontSize: "13px", color: "#84cc16" }}>
                    <Phone size={14} />{profile.phone}
                    {profile.phoneVerified && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", background: "rgba(34,197,94,0.2)", borderRadius: "5px", color: "#22c55e", fontSize: "10px", fontWeight: 700 }}><Shield size={9} /> Verified</span>}
                  </div>
                )}
              </div>
            )}

            <div className="profile-stats-row">
              <div className="profile-stat">
                <p className="profile-stat-value">{formatNumber(profile.stats?.totalContent)}</p>
                <p className="profile-stat-label">Content</p>
              </div>
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">{formatNumber(profile.wallet?.grovaTokens)}</p>
                <p className="profile-stat-label">GT Balance</p>
              </div>
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">{formatNumber(profile.wallet?.engagementPoints)}</p>
                <p className="profile-stat-label">EP Balance</p>
              </div>
            </div>
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-card-glow" />
            <div className="metric-content">
              <Eye size={24} className="metric-icon" />
              <p className="metric-value">{formatNumber(profile.stats?.totalViews)}</p>
              <p className="metric-label">Total Views</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-glow" />
            <div className="metric-content">
              <MessageSquare size={24} className="metric-icon" />
              <p className="metric-value">{formatNumber(profile.stats?.totalComments)}</p>
              <p className="metric-label">Comments</p>
            </div>
          </div>
        </div>

        {/* Saved Content Button */}
        <button className="saved-btn" onClick={() => setShowSavedModal(true)}>
          <Bookmark size={18} />
          Saved Content
        </button>

        <div className="profile-actions" style={{ marginTop: 14 }}>
          <button className="edit-profile-btn" onClick={() => setShowEditModal(true)}>
            <Edit size={18} />
            Edit Profile
          </button>
          <div className="action-divider" />
          <button className="logout-profile-btn" onClick={() => setShowLogoutConfirm(true)}>
            <LogOut size={18} />
            Logout
          </button>
        </div>

        {/* My Content — thumbnail grid with lightbox */}
        <MyContentSection
          userId={userId}
          showComments={true}
          profileData={profile}
          currentUser={{ id: userId }}
        />
      </div>

      {showEditModal && (
        <ProfileEditModal
          userId={userId}
          currentProfile={{ fullName: profile.fullName, username: profile.username, bio: profile.bio, avatar: profile.avatar, avatarId: profile.avatarId }}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {showSavedModal && (
        <SavedContentModal
          currentUser={{ id: userId }}
          onClose={() => setShowSavedModal(false)}
          isMobile={isMobile}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmLogout onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />
      )}
    </>
  );
};

export default ProfileSection;