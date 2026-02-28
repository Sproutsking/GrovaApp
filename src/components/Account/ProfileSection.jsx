// ============================================================================
// src/components/Account/ProfileSection.jsx — UPDATED
// Beautiful 2-col action card grid. Communities, Followers, Saved, Logout.
// Logout properly calls onSignOut to redirect to login without page refresh.
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  Eye, MessageSquare, Edit, Mail, Phone, Shield, LogOut,
  Bookmark, Users, UserPlus, Hash, Crown, Flame
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import ProfileEditModal from "./ProfileEditModal";
import SavedContentModal from "../Modals/SavedContentModal";
import CommunitiesModal from "../Modals/CommunitiesModal";
import FollowersModal from "../Modals/FollowersModal";
import MyContentSection from "./MyContentSection";

// ── Custom confirm dialog ──────────────────────────────────────────────────
const ConfirmLogout = ({ onConfirm, onCancel }) => (
  <>
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)", zIndex: 9998,
    }} />
    <div style={{
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%,-50%)",
      background: "#111", border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: "20px", padding: "28px 24px",
      width: "min(300px, calc(100vw - 40px))",
      zIndex: 9999, boxShadow: "0 24px 80px rgba(0,0,0,0.95)",
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

// ── Main Component ─────────────────────────────────────────────────────────
const ProfileSection = ({ userId, onProfileUpdate, onSignOut }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showCommunitiesModal, setShowCommunitiesModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersTab, setFollowersTab] = useState("followers");
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
          social: { followers: 0, following: 0, communities: 0 },
        });
        return;
      }

      const [
        walletRes, storiesRes, reelsRes, postsRes,
        storiesViewsRes, reelsViewsRes, postsViewsRes, commentsRes,
        followersRes, followingRes, communitiesRes
      ] = await Promise.allSettled([
        supabase.from("wallets").select("grova_tokens, engagement_points").eq("user_id", userId).maybeSingle(),
        supabase.from("stories").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("reels").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("stories").select("views").eq("user_id", userId).is("deleted_at", null),
        supabase.from("reels").select("views").eq("user_id", userId).is("deleted_at", null),
        supabase.from("posts").select("views").eq("user_id", userId).is("deleted_at", null),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("community_members").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const wallet = walletRes.status === "fulfilled" ? walletRes.value.data : null;
      const storiesCount = storiesRes.status === "fulfilled" ? (storiesRes.value.count ?? 0) : 0;
      const reelsCount = reelsRes.status === "fulfilled" ? (reelsRes.value.count ?? 0) : 0;
      const postsCount = postsRes.status === "fulfilled" ? (postsRes.value.count ?? 0) : 0;
      const commentsCount = commentsRes.status === "fulfilled" ? (commentsRes.value.count ?? 0) : 0;
      const followersCount = followersRes.status === "fulfilled" ? (followersRes.value.count ?? 0) : 0;
      const followingCount = followingRes.status === "fulfilled" ? (followingRes.value.count ?? 0) : 0;
      const communitiesCount = communitiesRes.status === "fulfilled" ? (communitiesRes.value.count ?? 0) : 0;

      const allViewRows = [
        ...(storiesViewsRes.status === "fulfilled" ? storiesViewsRes.value.data || [] : []),
        ...(reelsViewsRes.status === "fulfilled" ? reelsViewsRes.value.data || [] : []),
        ...(postsViewsRes.status === "fulfilled" ? postsViewsRes.value.data || [] : []),
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
        social: { followers: followersCount, following: followingCount, communities: communitiesCount },
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

  // ── Logout: sign out then trigger parent redirect to login ────────────────
  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    try {
      // Sign out from Supabase first
      await supabase.auth.signOut();
      // Then notify parent — parent should handle routing to login screen
      if (typeof onSignOut === "function") {
        onSignOut();
      }
    } catch (err) {
      console.error("Logout error:", err);
      // Even on error, still trigger redirect
      if (typeof onSignOut === "function") onSignOut();
    }
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

  // ── Action buttons config ─────────────────────────────────────────────────
  const actionButtons = [
    {
      id: "edit",
      icon: <Edit size={20} />,
      label: "Edit Profile",
      sub: "Update your info",
      accent: "#84cc16",
      bg: "linear-gradient(135deg, rgba(132,204,22,0.15) 0%, rgba(101,163,13,0.08) 100%)",
      border: "rgba(132,204,22,0.4)",
      onClick: () => setShowEditModal(true),
    },
    {
      id: "saved",
      icon: <Bookmark size={20} />,
      label: "Saved",
      sub: "Your bookmarks",
      accent: "#fbbf24",
      bg: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 100%)",
      border: "rgba(251,191,36,0.35)",
      onClick: () => setShowSavedModal(true),
    },
    {
      id: "followers",
      icon: <UserPlus size={20} />,
      label: "Followers",
      sub: `${formatNumber(profile.social?.followers)} people`,
      accent: "#60a5fa",
      bg: "linear-gradient(135deg, rgba(96,165,250,0.12) 0%, rgba(59,130,246,0.06) 100%)",
      border: "rgba(96,165,250,0.35)",
      onClick: () => { setFollowersTab("followers"); setShowFollowersModal(true); },
    },
    {
      id: "following",
      icon: <Users size={20} />,
      label: "Following",
      sub: `${formatNumber(profile.social?.following)} people`,
      accent: "#a78bfa",
      bg: "linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(139,92,246,0.06) 100%)",
      border: "rgba(167,139,250,0.35)",
      onClick: () => { setFollowersTab("following"); setShowFollowersModal(true); },
    },
    {
      id: "communities",
      icon: <Hash size={20} />,
      label: "Communities",
      sub: `${formatNumber(profile.social?.communities)} joined`,
      accent: "#34d399",
      bg: "linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(16,185,129,0.06) 100%)",
      border: "rgba(52,211,153,0.35)",
      onClick: () => setShowCommunitiesModal(true),
    },
    {
      id: "logout",
      icon: <LogOut size={20} />,
      label: "Sign Out",
      sub: "Log out of account",
      accent: "#ef4444",
      bg: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.06) 100%)",
      border: "rgba(239,68,68,0.35)",
      onClick: () => setShowLogoutConfirm(true),
    },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes profileFadeIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        .profile-section { padding: 20px; }
        .profile-header-card {
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(132,204,22,0.2);
          border-radius: 24px;
          padding: 40px 24px 32px;
          margin-bottom: 20px;
          overflow: hidden;
          animation: profileFadeIn 0.4s ease;
        }
        .profile-header-glow {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(132,204,22,0.1) 0%, rgba(132,204,22,0.03) 50%, transparent 100%);
          pointer-events: none;
        }
        .profile-header-glow::after {
          content: '';
          position: absolute;
          top: -60px; left: 50%; transform: translateX(-50%);
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(132,204,22,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .profile-header-content { position: relative; z-index: 1; text-align: center; }
        .profile-avatar {
          width: 110px; height: 110px; border-radius: 28px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px;
          border: 3px solid rgba(132,204,22,0.5);
          font-size: 44px; color: #000; font-weight: 800;
          overflow: hidden; position: relative;
          box-shadow: 0 8px 40px rgba(132,204,22,0.4), 0 0 0 6px rgba(132,204,22,0.08);
        }
        .profile-avatar img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; transition: opacity 0.4s; }
        .profile-avatar-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 44px; color: #000; font-weight: 800; }
        .profile-name { font-size: 26px; font-weight: 900; color: #fff; margin: 0 0 6px 0; }
        .profile-badges { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 6px; }
        .profile-badge-pro { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1)); border: 1px solid rgba(251,191,36,0.4); border-radius: 20px; font-size: 11px; font-weight: 800; color: #fbbf24; }
        .profile-badge-verified { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.3); border-radius: 20px; font-size: 11px; font-weight: 800; color: #84cc16; }
        .profile-username { font-size: 15px; color: #84cc16; margin: 0 0 14px 0; font-weight: 600; }
        .profile-bio { color: #a3a3a3; font-size: 13px; margin: 0 0 18px; line-height: 1.5; max-width: 320px; margin-left: auto; margin-right: auto; }
        .profile-stats-row { display: flex; align-items: center; justify-content: center; gap: 0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 8px; overflow: hidden; }
        .profile-stat { flex: 1; text-align: center; padding: 0 8px; }
        .profile-stat-value { font-size: 19px; font-weight: 900; background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 3px 0; }
        .profile-stat-label { font-size: 10px; color: #737373; margin: 0; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; }
        .stat-divider { width: 1px; height: 32px; background: linear-gradient(180deg, transparent 0%, rgba(132,204,22,0.3) 50%, transparent 100%); flex-shrink: 0; }

        /* Metrics grid */
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        .metric-card { position: relative; background: rgba(255,255,255,0.04); border: 1px solid rgba(132,204,22,0.2); border-radius: 18px; padding: 18px; overflow: hidden; transition: all 0.3s; cursor: default; }
        .metric-card:hover { border-color: rgba(132,204,22,0.45); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(132,204,22,0.25); }
        .metric-card-glow { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(132,204,22,0.07) 0%, transparent 100%); pointer-events: none; }
        .metric-content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 6px; }
        .metric-icon { color: #84cc16; }
        .metric-value { font-size: 26px; font-weight: 900; color: #fff; margin: 0; }
        .metric-label { font-size: 12px; color: #a3a3a3; margin: 0; font-weight: 600; }

        /* Actions grid */
        .actions-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 22px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .action-btn {
          position: relative;
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 10px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid;
          cursor: pointer;
          transition: all 0.25s;
          overflow: hidden;
          text-align: left;
        }
        .action-btn::before {
          content: '';
          position: absolute; inset: 0;
          opacity: 0;
          transition: opacity 0.25s;
        }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .action-btn:hover::before { opacity: 1; }
        .action-btn:active { transform: translateY(0); }
        .action-btn-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .action-btn-text { flex: 1; min-width: 0; }
        .action-btn-label { font-size: 13px; font-weight: 800; margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .action-btn-sub { font-size: 11px; font-weight: 500; margin: 0; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Contact info */
        .contact-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; padding: 0 2px; }
        .contact-chip { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 14px; background: rgba(132,204,22,0.08); border: 1px solid rgba(132,204,22,0.2); border-radius: 10px; font-size: 13px; color: #84cc16; }
      `}</style>

      <div className="profile-section">
        {/* ── Header card ─────────────────────────────────────────────────── */}
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

            {(profile.isPro || profile.verified) && (
              <div className="profile-badges">
                {profile.isPro && <span className="profile-badge-pro"><Crown size={10} /> PRO</span>}
                {profile.verified && <span className="profile-badge-verified"><Shield size={10} /> Verified</span>}
              </div>
            )}

            <p className="profile-username">@{profile.username}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

            {(profile.showEmail || profile.showPhone) && (
              <div className="contact-row">
                {profile.showEmail && profile.email && (
                  <div className="contact-chip"><Mail size={14} />{profile.email}</div>
                )}
                {profile.showPhone && profile.phone && (
                  <div className="contact-chip">
                    <Phone size={14} />{profile.phone}
                    {profile.phoneVerified && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", background: "rgba(34,197,94,0.2)", borderRadius: "5px", color: "#22c55e", fontSize: "10px", fontWeight: 700 }}>
                        <Shield size={9} /> Verified
                      </span>
                    )}
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
                <p className="profile-stat-value">{formatNumber(profile.social?.followers)}</p>
                <p className="profile-stat-label">Followers</p>
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

        {/* ── Metrics ─────────────────────────────────────────────────────── */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-card-glow" />
            <div className="metric-content">
              <Eye size={22} className="metric-icon" />
              <p className="metric-value">{formatNumber(profile.stats?.totalViews)}</p>
              <p className="metric-label">Total Views</p>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-glow" />
            <div className="metric-content">
              <MessageSquare size={22} className="metric-icon" />
              <p className="metric-value">{formatNumber(profile.stats?.totalComments)}</p>
              <p className="metric-label">Comments</p>
            </div>
          </div>
        </div>

        {/* ── Action buttons card ──────────────────────────────────────────── */}
        <div className="actions-card">
          <div className="actions-grid">
            {actionButtons.map(btn => (
              <button
                key={btn.id}
                className="action-btn"
                onClick={btn.onClick}
                style={{
                  background: btn.bg,
                  borderColor: btn.border,
                  "--hover-bg": btn.bg,
                }}
              >
                <div className="action-btn-icon" style={{ background: `${btn.accent}18`, border: `1px solid ${btn.accent}30` }}>
                  <span style={{ color: btn.accent }}>{btn.icon}</span>
                </div>
                <div className="action-btn-text">
                  <p className="action-btn-label" style={{ color: btn.accent }}>{btn.label}</p>
                  <p className="action-btn-sub" style={{ color: btn.accent }}>{btn.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── My Content ──────────────────────────────────────────────────── */}
        <MyContentSection
          userId={userId}
          showComments={true}
          profileData={profile}
          currentUser={{ id: userId }}
        />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
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

      {showCommunitiesModal && (
        <CommunitiesModal
          currentUser={{ id: userId }}
          onClose={() => setShowCommunitiesModal(false)}
          isMobile={isMobile}
        />
      )}

      {showFollowersModal && (
        <FollowersModal
          currentUser={{ id: userId }}
          onClose={() => setShowFollowersModal(false)}
          isMobile={isMobile}
          defaultTab={followersTab}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmLogout onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />
      )}
    </>
  );
};

export default ProfileSection;