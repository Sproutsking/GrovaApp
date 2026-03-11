// ============================================================================
// src/components/Modals/UserProfileModal.jsx — TOAST REMOVED
// All useToast calls replaced with local flash state. No toast dependency.
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Bell, Eye, MessageSquare, Heart, UserPlus, UserCheck,
  Sparkles, TrendingUp, Award, BookOpen, Film, Image, DollarSign,
  Users, Calendar, MoreHorizontal, Share2, Edit,
} from "lucide-react";

import profileService from "../../services/account/profileService";
import followService from "../../services/social/followService";
import ShareModal from "./ShareModal";
import ProfileActionMenu from "./ProfileActionMenu";
import NotificationSettingsModal from "../Modals/NotificationSettingsModal";
import ProfileEditModal from "../Account/ProfileEditModal";
import DMMessagesView from "../Messages/DMMessagesView";
import PostTab from "../Home/PostTab";
import StoryTab from "../Home/StoryTab";
import ReelsTab from "../Home/ReelsTab";
import MyContentSection from "../Account/MyContentSection";

// ── Simple inline flash (no external toast needed) ────────────────────────────
const FlashBanner = ({ flash }) => {
  if (!flash) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: flash.type === "error" ? "#ef4444" : "#111",
      color: "#fff", padding: "9px 18px", borderRadius: "999px",
      fontSize: "13px", fontWeight: 600, zIndex: 99999,
      border: flash.type === "error" ? "1px solid #fca5a5" : "1px solid rgba(132,204,22,0.4)",
      whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      animation: "flashIn 0.25s ease",
    }}>
      {flash.message}
    </div>
  );
};

const UserProfileModal = ({ user, onClose, currentUser, onAuthorClick, onActionMenu }) => {
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [contentData, setContentData] = useState({ posts: [], stories: [], reels: [] });
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDM, setShowDM] = useState(false);
  const [dmTargetUserId, setDmTargetUserId] = useState(null);

  // ── Flash instead of toast ──────────────────────────────────────────────────
  const [flash, setFlash] = useState(null);
  let flashTimer = null;
  const showFlash = (message, type = "success") => {
    setFlash({ message, type });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => setFlash(null), 3000);
  };

  const isMobile = window.innerWidth <= 768;
  const isOwnProfile = currentUser?.id === user?.id || currentUser?.id === user?.user_id;
  const userId = user?.id || user?.user_id || user?.userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      if (!isOwnProfile) checkFollowStatus();
    }
    return () => clearTimeout(flashTimer);
  }, [userId]);

  useEffect(() => {
    if (profileData && userId) loadUserContent();
  }, [profileData]);

  useEffect(() => {
    if (activeTab && !contentData[activeTab]?.length && !loadingContent && profileData) {
      loadUserContent(activeTab);
    }
  }, [activeTab, profileData]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (!userId) return;
      const profile = await profileService.getProfile(userId);
      const [followerCount, followingCount] = await Promise.all([
        followService.getFollowerCount(userId),
        followService.getFollowingCount(userId),
      ]);
      setProfileData({ ...profile, stats: { ...profile.stats, followers: followerCount, following: followingCount } });
    } catch (error) {
      console.error("Failed to load profile:", error);
      showFlash("Failed to load profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!currentUser?.id || isOwnProfile) return;
    try {
      const following = await followService.isFollowing(currentUser.id, userId);
      setIsFollowing(following);
    } catch (error) {
      console.error("Failed to check follow status:", error);
    }
  };

  const loadUserContent = async (type = "all") => {
    try {
      setLoadingContent(true);
      const content = await profileService.getUserContent(userId, type);
      const enrichContent = (items) => {
        if (!profileData) return items;
        return items.map(item => ({
          ...item,
          profiles: {
            full_name: profileData.fullName || user?.author || user?.name || "Unknown",
            username: profileData.username || "unknown",
            avatar_id: profileData.avatarId,
            verified: profileData.verified || false,
          },
          author: profileData.fullName || user?.author || user?.name || "Unknown",
          username: profileData.username || "unknown",
          avatar: profileData.avatar,
          verified: profileData.verified || false,
        }));
      };
      if (type === "all") {
        setContentData({
          posts: enrichContent(content.filter(c => c.type === "post")),
          stories: enrichContent(content.filter(c => c.type === "story")),
          reels: enrichContent(content.filter(c => c.type === "reel")),
        });
      } else {
        setContentData(prev => ({ ...prev, [type + "s"]: enrichContent(content) }));
      }
    } catch (error) {
      console.error("Failed to load user content:", error);
    } finally {
      setLoadingContent(false);
    }
  };

  // ── OPTIMISTIC FOLLOW TOGGLE ───────────────────────────────────────────────
  const handleFollowToggle = async () => {
    if (!currentUser?.id) { showFlash("Please login to follow users", "error"); return; }
    const newFollowState = !isFollowing;
    // Instant UI update
    setIsFollowing(newFollowState);
    setProfileData(prev => ({
      ...prev,
      stats: { ...prev.stats, followers: newFollowState ? (prev.stats?.followers || 0) + 1 : Math.max(0, (prev.stats?.followers || 1) - 1) },
    }));
    try {
      if (newFollowState) {
        await followService.followUser(currentUser.id, userId);
        showFlash(`Following ${profileData?.fullName || "user"}`);
      } else {
        await followService.unfollowUser(currentUser.id, userId);
        showFlash(`Unfollowed ${profileData?.fullName || "user"}`);
      }
      setTimeout(() => loadProfile(), 1000);
    } catch (error) {
      // Rollback
      setIsFollowing(!newFollowState);
      setProfileData(prev => ({
        ...prev,
        stats: { ...prev.stats, followers: !newFollowState ? (prev.stats?.followers || 0) + 1 : Math.max(0, (prev.stats?.followers || 1) - 1) },
      }));
      showFlash("Action failed. Please try again.", "error");
    }
  };

  const handleMessageClick = () => {
    if (!currentUser?.id) { showFlash("Please login to send messages", "error"); return; }
    setDmTargetUserId(userId);
    setShowDM(true);
  };

  const handleProfileUpdated = (updatedProfile) => {
    setProfileData(prev => ({ ...prev, fullName: updatedProfile.fullName, username: updatedProfile.username, bio: updatedProfile.bio, avatar: updatedProfile.avatar, avatarId: updatedProfile.avatarId }));
    showFlash("Profile updated!");
  };

  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className={`profile-modal-overlay ${isMobile ? "mobile" : ""}`} onClick={onClose}>
        <div className="profile-modal-container loading" onClick={e => e.stopPropagation()}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!profileData) return null;

  const displayName = profileData.fullName || user?.author || user?.name || "User";
  const username = profileData.username || (user?.author || user?.name || "user").toLowerCase().replace(/\s+/g, "_");
  const avatar = profileData.avatar || user?.avatar || displayName.charAt(0);
  const joinDate = profileData.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Recently";

  const mobileStats = [
    { icon: BookOpen, value: profileData.stats?.totalStories || 0, label: "Stories" },
    { icon: Film, value: profileData.stats?.totalReels || 0, label: "Reels" },
    { icon: DollarSign, value: formatNumber(profileData.wallet?.grovaTokens || 0), label: "Tokens", highlight: true },
  ];
  const desktopStats = [
    { icon: BookOpen, value: profileData.stats?.totalStories || 0, label: "Stories" },
    { icon: Film, value: profileData.stats?.totalReels || 0, label: "Reels" },
    { icon: Image, value: profileData.stats?.totalPosts || 0, label: "Posts" },
    { icon: DollarSign, value: formatNumber(profileData.wallet?.grovaTokens || 0), label: "Tokens", highlight: true },
  ];
  const stats = isMobile ? mobileStats : desktopStats;

  return (
    <>
      <FlashBanner flash={flash} />
      <div className={`profile-modal-overlay ${isMobile ? "mobile" : ""}`} onClick={onClose}>
        <div className="profile-modal-container" onClick={e => e.stopPropagation()}>
          <div className="profile-modal-header">
            <button onClick={onClose} className="profile-back-btn"><ArrowLeft size={20} /></button>
            <div className="profile-header-title">
              <span>{displayName}</span>
              {profileData.verified && <div className="profile-verified-badge"><Sparkles size={12} /></div>}
            </div>
            <div className="profile-header-actions">
              {isOwnProfile && (
                <button className="profile-action-icon-btn" title="Edit Profile" onClick={() => setShowEditModal(true)}>
                  <Edit size={18} />
                </button>
              )}
              <button className="profile-action-icon-btn" onClick={() => setShowShareModal(true)}><Share2 size={18} /></button>
              <button className="profile-action-icon-btn" onClick={() => setShowActionMenu(true)}><MoreHorizontal size={18} /></button>
            </div>
          </div>

          <div className="profile-modal-content">
            <div className="profile-banner-section">
              <div className="profile-banner-gradient" />
              <div className="profile-avatar-container">
                <div className="profile-avatar-large">
                  {typeof avatar === "string" && avatar.startsWith("http")
                    ? <img src={avatar} alt={displayName} />
                    : avatar}
                </div>
                <div className="profile-avatar-glow" />
              </div>
            </div>

            <div className="profile-basic-info">
              <h2 className="profile-display-name">{displayName}</h2>
              <p className="profile-username-text">@{username}</p>
              {profileData.bio && <p className="profile-bio">{profileData.bio}</p>}
              <div className="profile-meta-info">
                <div className="profile-meta-item"><Calendar size={14} /><span>Joined {joinDate}</span></div>
              </div>

              <div className="profile-action-buttons">
                {!isOwnProfile ? (
                  <>
                    <button className={`profile-follow-btn ${isFollowing ? "following" : ""}`} onClick={handleFollowToggle}>
                      {isFollowing ? <><UserCheck size={18} /><span>Following</span></> : <><UserPlus size={18} /><span>Follow</span></>}
                    </button>
                    <button className="profile-message-btn" onClick={handleMessageClick}>
                      <MessageSquare size={18} /><span>Message</span>
                    </button>
                    <button className="profile-icon-only-btn" onClick={() => setShowNotificationSettings(true)} title="Notification Settings">
                      <Bell size={18} />
                    </button>
                  </>
                ) : (
                  <button className="profile-edit-btn-full" onClick={() => setShowEditModal(true)}>
                    <Edit size={18} /><span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>

            <div className="profile-stats-grid">
              {stats.map((stat, index) => (
                <div key={index} className={`profile-stat-card ${stat.highlight ? "highlight" : ""}`}>
                  <stat.icon size={isMobile ? 18 : 20} className="stat-icon" />
                  <div className="stat-number">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="profile-engagement-stats">
              <div className="engagement-item">
                <Users size={16} />
                <span className="engagement-value">{formatNumber(profileData.stats?.followers || 0)}</span>
                <span className="engagement-label">Followers</span>
              </div>
              <div className="engagement-divider" />
              {isOwnProfile && (
                <>
                  <div className="engagement-item">
                    <Users size={16} />
                    <span className="engagement-value">{formatNumber(profileData.stats?.following || 0)}</span>
                    <span className="engagement-label">Following</span>
                  </div>
                  <div className="engagement-divider" />
                </>
              )}
              <div className="engagement-item">
                <Eye size={16} />
                <span className="engagement-value">{formatNumber(profileData.stats?.totalViews || 0)}</span>
                <span className="engagement-label">Views</span>
              </div>
              <div className="engagement-divider" />
              <div className="engagement-item">
                <Heart size={16} />
                <span className="engagement-value">{formatNumber(profileData.stats?.totalComments || 0)}</span>
                <span className="engagement-label">Engagement</span>
              </div>
            </div>

            <div className="profile-achievements-banner">
              <div className="achievement-icon"><Award size={24} /></div>
              <div className="achievement-info">
                <div className="achievement-title">Elite Creator</div>
                <div className="achievement-desc">{formatNumber(profileData.wallet?.engagementPoints || 0)} EP earned</div>
              </div>
              <div className="achievement-badge"><TrendingUp size={16} /></div>
            </div>

            {/* Thumbnail grid — Posts, Reels, Stories (no comments for other users) */}
            <div style={{ padding: "0 12px 20px" }}>
              <MyContentSection
              userId={userId}
              showComments={false}
              profileData={profileData}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
            />
            </div>
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareModal content={{ type: "profile", id: userId, username, name: displayName }} onClose={() => setShowShareModal(false)} currentUser={currentUser} />
      )}
      {showActionMenu && (
        <ProfileActionMenu user={profileData} onClose={() => setShowActionMenu(false)} currentUser={currentUser} isOwnProfile={isOwnProfile} />
      )}
      {showNotificationSettings && (
        <NotificationSettingsModal user={profileData} onClose={() => setShowNotificationSettings(false)} currentUser={currentUser} />
      )}
      {showEditModal && (
        <ProfileEditModal userId={userId} currentProfile={profileData} onClose={() => setShowEditModal(false)} onSuccess={handleProfileUpdated} />
      )}
      {showDM && dmTargetUserId && (
        <DMMessagesView currentUser={currentUser} onClose={() => { setShowDM(false); setDmTargetUserId(null); }} initialOtherUserId={dmTargetUserId} standalone={true} />
      )}

      <style>{`
        @keyframes flashIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .profile-modal-overlay { position:fixed;inset:0;z-index:9999;display:flex;background:rgba(0,0,0,0.95);backdrop-filter:blur(20px);align-items:center;justify-content:flex-end;animation:fadeIn 0.3s ease; }
        .profile-modal-overlay.mobile { justify-content:center;align-items:flex-end; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideInRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes slideInUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .profile-modal-container { width:480px;max-width:480px;height:100vh;background:#000;border-left:1px solid rgba(132,204,22,0.2);display:flex;flex-direction:column;animation:slideInRight 0.3s cubic-bezier(0.4,0,0.2,1);overflow:hidden; }
        @media(max-width:768px) { .profile-modal-container { width:100%;max-width:100%;height:95vh;border-radius:24px 24px 0 0;border-left:none;border-top:1px solid rgba(132,204,22,0.2);animation:slideInUp 0.3s cubic-bezier(0.4,0,0.2,1); } }
        .profile-modal-container.loading { justify-content:center;align-items:center; }
        .loading-spinner { width:48px;height:48px;border:4px solid rgba(132,204,22,0.2);border-top-color:#84cc16;border-radius:50%;animation:spin 0.8s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .profile-modal-header { position:sticky;top:0;background:rgba(0,0,0,0.98);backdrop-filter:blur(24px);border-bottom:1px solid rgba(132,204,22,0.2);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;z-index:10; }
        .profile-back-btn,.profile-action-icon-btn { width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:#737373;cursor:pointer;transition:all 0.2s; }
        .profile-back-btn:hover,.profile-action-icon-btn:hover { background:rgba(255,255,255,0.1);color:#84cc16;border-color:rgba(132,204,22,0.3); }
        .profile-header-title { flex:1;text-align:center;font-size:18px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px; }
        .profile-verified-badge { width:20px;height:20px;border-radius:50%;background:#84cc16;display:flex;align-items:center;justify-content:center;color:#000; }
        .profile-header-actions { display:flex;gap:8px; }
        .profile-modal-content { flex:1;overflow-y:auto;overflow-x:hidden; }
        .profile-modal-content::-webkit-scrollbar { width:6px; }
        .profile-modal-content::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.3);border-radius:3px; }
        .profile-banner-section { position:relative;height:140px;margin-bottom:70px; }
        .profile-banner-gradient { width:100%;height:100%;background:linear-gradient(135deg,rgba(132,204,22,0.2) 0%,rgba(132,204,22,0.05) 100%); }
        .profile-avatar-container { position:absolute;bottom:-60px;left:50%;transform:translateX(-50%);text-align:center; }
        .profile-avatar-large { width:120px;height:120px;background:linear-gradient(135deg,#84cc16 0%,#65a30d 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:48px;margin:0 auto;border:6px solid #000;box-shadow:0 8px 32px rgba(132,204,22,0.5);position:relative;z-index:2;overflow:hidden; }
        .profile-avatar-large img { width:100%;height:100%;object-fit:cover; }
        .profile-avatar-glow { position:absolute;inset:-20px;background:radial-gradient(circle,rgba(132,204,22,0.3) 0%,transparent 70%);z-index:1;pointer-events:none; }
        .profile-basic-info { padding:0 20px 20px;text-align:center; }
        .profile-display-name { font-size:28px;font-weight:800;color:#fff;margin:0 0 4px 0; }
        .profile-username-text { font-size:15px;color:#84cc16;margin:0 0 12px 0; }
        .profile-bio { font-size:14px;color:#a3a3a3;line-height:1.6;margin:0 0 12px 0; }
        .profile-meta-info { display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-bottom:20px;font-size:13px;color:#737373; }
        .profile-meta-item { display:flex;align-items:center;gap:6px; }
        .profile-action-buttons { display:flex;gap:10px;margin-bottom:20px; }
        .profile-follow-btn,.profile-message-btn,.profile-edit-btn-full { flex:1;padding:14px;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.3s;border:none; }
        .profile-follow-btn { background:linear-gradient(135deg,#84cc16 0%,#65a30d 100%);color:#000; }
        .profile-follow-btn.following { background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(132,204,22,0.3); }
        .profile-message-btn { background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(132,204,22,0.2); }
        .profile-edit-btn-full { background:linear-gradient(135deg,#84cc16 0%,#65a30d 100%);color:#000; }
        .profile-icon-only-btn { width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(132,204,22,0.2);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;flex-shrink:0;transition:all 0.2s; }
        .profile-stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:0 20px 20px; }
        @media(max-width:768px) { .profile-stats-grid { grid-template-columns:repeat(3,1fr);gap:8px;padding:0 16px 16px; } }
        .profile-stat-card { background:rgba(255,255,255,0.03);border:1px solid rgba(132,204,22,0.2);border-radius:12px;padding:16px 8px;text-align:center;transition:all 0.2s; }
        .profile-stat-card.highlight { background:rgba(132,204,22,0.1);border-color:rgba(132,204,22,0.3); }
        .profile-stat-card:hover { border-color:rgba(132,204,22,0.4);transform:translateY(-2px); }
        .stat-icon { color:#84cc16;margin-bottom:8px; }
        .stat-number { font-size:20px;font-weight:800;color:#fff;margin-bottom:4px; }
        .stat-label { font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:.05em; }
        .profile-engagement-stats { display:flex;justify-content:space-around;padding:18px;margin:0 20px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(132,204,22,0.2);border-radius:12px; }
        .engagement-item { display:flex;flex-direction:column;align-items:center;gap:6px; }
        .engagement-value { font-size:20px;font-weight:800;color:#84cc16; }
        .engagement-label { font-size:12px;color:#737373; }
        .engagement-divider { width:1px;background:rgba(132,204,22,0.2); }
        .profile-achievements-banner { display:flex;align-items:center;gap:16px;padding:18px;margin:0 20px 20px;background:linear-gradient(135deg,rgba(132,204,22,0.1) 0%,rgba(132,204,22,0.05) 100%);border:1px solid rgba(132,204,22,0.3);border-radius:12px; }
        .achievement-icon { width:48px;height:48px;border-radius:12px;background:rgba(132,204,22,0.2);display:flex;align-items:center;justify-content:center;color:#84cc16;flex-shrink:0; }
        .achievement-info { flex:1; }
        .achievement-title { font-size:16px;font-weight:700;color:#fff;margin-bottom:4px; }
        .achievement-desc { font-size:13px;color:#737373; }
        .achievement-badge { width:40px;height:40px;border-radius:8px;background:rgba(132,204,22,0.2);display:flex;align-items:center;justify-content:center;color:#84cc16; }
        .profile-content-tabs { display:flex;gap:8px;padding:0 20px;border-bottom:1px solid rgba(132,204,22,0.1);margin-bottom:20px; }
        .profile-tab { flex:1;padding:12px;background:none;border:none;color:#737373;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;border-bottom:2px solid transparent;transition:all 0.2s;font-weight:600; }
        .profile-tab.active { color:#84cc16;border-bottom-color:#84cc16; }
        .profile-content-display { padding:0 20px 20px;min-height:200px; }
        .content-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px; }
        .content-loading p { color:#737373;font-size:14px; }
        .empty-content { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;gap:16px; }
        .empty-icon { font-size:64px;opacity:0.3; }
        .empty-content p { color:#737373;font-size:16px;font-weight:600; }
      `}</style>
    </>
  );
};

export default UserProfileModal;