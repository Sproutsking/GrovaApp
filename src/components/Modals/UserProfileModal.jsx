// src/components/Modals/UserProfileModal.jsx — TIER BADGE UPDATE
// ============================================================================
// CHANGES (UI structure UNCHANGED — precision additions only):
//  [1] Import buildTierInfo and getTierBadge from profileTierService
//  [2] Tier badge pill shown in identity section below username
//  [3] Access status label added (PAID MEMBER / FREE MEMBER) — small, subtle
//  [4] EP balance shown in stat cards uses engagement_points (accurate)
//  All modal layout, animations, stat grid, action buttons — UNCHANGED.
// ============================================================================

import React, { useState, useEffect } from "react";
import {
  ArrowLeft, Bell, Eye, MessageSquare, Heart, UserPlus, UserCheck,
  Sparkles, TrendingUp, Award, BookOpen, Film, Image, DollarSign,
  Users, Calendar, MoreHorizontal, Share2, Edit, X, Zap,
} from "lucide-react";

import profileService from "../../services/account/profileService";
import followService from "../../services/social/followService";
import ShareModal from "./ShareModal";
import ProfileActionMenu from "./ProfileActionMenu";
import NotificationSettingsModal from "./NotificationSettingsModal";
import ProfileEditModal from "../Account/ProfileEditModal";
import DMMessagesView from "../Messages/DMMessagesView";
import MyContentSection from "../Account/MyContentSection";
import { buildTierInfo, getTierBadge } from "../../services/account/profileTierService";

// ── Flash banner — unchanged from original ────────────────────────────────────
const FlashBanner = ({ flash }) => {
  if (!flash) return null;
  return (
    <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background: flash.type === "error" ? "rgba(239,68,68,0.95)" : "rgba(10,10,10,0.96)", color:"#fff", padding:"10px 20px", borderRadius:"999px", fontSize:"13px", fontWeight:700, zIndex:99999, border: flash.type === "error" ? "1px solid rgba(252,165,165,0.4)" : "1px solid rgba(132,204,22,0.35)", whiteSpace:"nowrap", boxShadow:"0 8px 28px rgba(0,0,0,0.6)", animation:"upmFlashIn 0.25s ease", backdropFilter:"blur(12px)" }}>
      {flash.message}
    </div>
  );
};

// ── [2] Tier badge pill — precision addition ─────────────────────────────────
const TierBadgePill = ({ subscriptionTier, paymentStatus }) => {
  const badge = getTierBadge(subscriptionTier, paymentStatus);
  if (!badge) return null;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:800,
      color: badge.color,
      background:`${badge.color}15`,
      border:`1px solid ${badge.color}35`,
      boxShadow:`0 0 8px ${badge.glow}`,
    }}>
      {badge.emoji} {badge.label}
    </span>
  );
};

// ── [3] Access badge — precision addition ─────────────────────────────────────
const AccessBadge = ({ paymentStatus, accountActivated }) => {
  if (!accountActivated || paymentStatus === "pending") return null;
  const map = {
    paid: { label:"Paid Member",  color:"#a3e635" },
    free: { label:"Free Member",  color:"#38bdf8" },
  };
  const cfg = map[paymentStatus];
  if (!cfg) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"1px 7px", borderRadius:10, fontSize:9, fontWeight:800, color:cfg.color, background:`${cfg.color}12`, border:`1px solid ${cfg.color}28` }}>
      ✓ {cfg.label}
    </span>
  );
};

const UserProfileModal = ({ user, onClose, currentUser, onAuthorClick, onActionMenu }) => {
  const [isFollowing, setIsFollowing]                       = useState(false);
  const [profileData, setProfileData]                       = useState(null);
  const [tierInfo, setTierInfo]                             = useState(null); // [1]
  const [loading, setLoading]                               = useState(true);
  const [showShareModal, setShowShareModal]                 = useState(false);
  const [showActionMenu, setShowActionMenu]                 = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showEditModal, setShowEditModal]                   = useState(false);
  const [showDM, setShowDM]                                 = useState(false);
  const [dmTargetUserId, setDmTargetUserId]                 = useState(null);
  const [flash, setFlash]                                   = useState(null);

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
    if (userId) { loadProfile(); if (!isOwnProfile) checkFollowStatus(); }
    return () => clearTimeout(flashTimer);
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (!userId) return;
      const profile = await profileService.getProfile(userId);
      const [followerCount, followingCount] = await Promise.all([
        followService.getFollowerCount(userId),
        followService.getFollowingCount(userId),
      ]);
      const enrichedProfile = {
        ...profile,
        stats: { ...profile.stats, followers: followerCount, following: followingCount },
      };
      setProfileData(enrichedProfile);
      // [1] Build tier info from the profile
      setTierInfo(buildTierInfo({
        account_activated:  profile.account_activated ?? profile.accountActivated ?? false,
        payment_status:     profile.payment_status    ?? profile.paymentStatus    ?? "pending",
        subscription_tier:  profile.subscription_tier ?? profile.subscriptionTier ?? "standard",
      }));
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
    } catch {}
  };

  const handleFollowToggle = async () => {
    if (!currentUser?.id) { showFlash("Please login to follow users", "error"); return; }
    const next = !isFollowing;
    setIsFollowing(next);
    setProfileData(prev => ({ ...prev, stats: { ...prev.stats, followers: next ? (prev.stats?.followers || 0) + 1 : Math.max(0, (prev.stats?.followers || 1) - 1) } }));
    try {
      if (next) { await followService.followUser(currentUser.id, userId); showFlash(`Following ${profileData?.fullName || "user"}`); }
      else       { await followService.unfollowUser(currentUser.id, userId); showFlash(`Unfollowed ${profileData?.fullName || "user"}`); }
      setTimeout(() => loadProfile(), 1000);
    } catch {
      setIsFollowing(!next);
      setProfileData(prev => ({ ...prev, stats: { ...prev.stats, followers: !next ? (prev.stats?.followers || 0) + 1 : Math.max(0, (prev.stats?.followers || 1) - 1) } }));
      showFlash("Action failed. Please try again.", "error");
    }
  };

  const handleMessageClick = () => {
    if (!currentUser?.id) { showFlash("Please login to send messages", "error"); return; }
    setDmTargetUserId(userId); setShowDM(true);
  };

  const handleProfileUpdated = (updatedProfile) => {
    setProfileData(prev => ({ ...prev, fullName: updatedProfile.fullName, username: updatedProfile.username, bio: updatedProfile.bio, avatar: updatedProfile.avatar, avatarId: updatedProfile.avatarId }));
    showFlash("Profile updated!");
  };

  const fmt = (num) => {
    if (!num) return "0";
    if (num >= 1_000_000_000) return `${(num/1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000)     return `${(num/1_000_000).toFixed(1)}M`;
    if (num >= 1_000)         return `${(num/1_000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) return (
    <> <style>{upmStyles}</style>
      <div className="upm-backdrop" onClick={onClose}>
        <div className="upm-card upm-loading" onClick={e=>e.stopPropagation()}>
          <div className="upm-spinner" />
        </div>
      </div>
    </>
  );

  if (!profileData) return null;

  const displayName  = profileData.fullName || user?.author || user?.name || "User";
  const username     = profileData.username || (user?.author || user?.name || "user").toLowerCase().replace(/\s+/g, "_");
  const avatar       = profileData.avatar   || user?.avatar || displayName.charAt(0);
  const joinDate     = profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString("en-US", { month:"short", year:"numeric" }) : "Recently";
  // [4] Use engagement_points directly for accurate EP
  const epBalance    = Number(profileData.engagement_points ?? profileData.wallet?.engagementPoints ?? 0);

  const statCards = [
    { icon: BookOpen,     value: profileData.stats?.totalStories || 0,    label: "Stories" },
    { icon: Film,         value: profileData.stats?.totalReels   || 0,    label: "Reels" },
    { icon: Image,        value: profileData.stats?.totalPosts   || 0,    label: "Posts" },
    { icon: Zap,          value: fmt(epBalance),                           label: "EP",    highlight: true }, // [4]
  ];
  const visibleStats = isMobile ? statCards.filter(s => s.label !== "Posts") : statCards;

  const subscriptionTier = profileData.subscription_tier ?? profileData.subscriptionTier ?? "standard";
  const paymentStatus    = profileData.payment_status    ?? profileData.paymentStatus    ?? "pending";
  const accountActivated = profileData.account_activated ?? profileData.accountActivated ?? false;

  return (
    <>
      <FlashBanner flash={flash} />
      <style>{upmStyles}</style>

      <div className={`upm-backdrop ${isMobile ? "upm-mobile" : ""}`} onClick={onClose}>
        <div className={`upm-card ${isMobile ? "upm-card-mobile" : "upm-card-desktop"}`} onClick={e=>e.stopPropagation()}>

          {/* TOP BAR — unchanged */}
          <div className="upm-topbar">
            <button className="upm-icon-btn" onClick={onClose}>
              {isMobile ? <ArrowLeft size={18}/> : <X size={16}/>}
            </button>
            <div className="upm-topbar-title">
              <span>{displayName}</span>
              {profileData.verified && <div className="upm-verified"><Sparkles size={10}/></div>}
            </div>
            <div className="upm-topbar-right">
              {isOwnProfile && <button className="upm-icon-btn" onClick={()=>setShowEditModal(true)} title="Edit Profile"><Edit size={16}/></button>}
              <button className="upm-icon-btn" onClick={()=>setShowShareModal(true)}><Share2 size={16}/></button>
              <button className="upm-icon-btn" onClick={()=>setShowActionMenu(true)}><MoreHorizontal size={16}/></button>
            </div>
          </div>

          {/* BODY — unchanged structure */}
          <div className="upm-body">
            <div className="upm-banner"><div className="upm-banner-gradient"/></div>

            <div className="upm-avatar-wrap">
              <div className="upm-avatar">
                {typeof avatar === "string" && avatar.startsWith("http")
                  ? <img src={avatar} alt={displayName}/>
                  : <span>{typeof avatar === "string" ? avatar : displayName.charAt(0)}</span>
                }
              </div>
              <div className="upm-avatar-glow"/>
            </div>

            {/* IDENTITY — tier badge + access badge added precisely */}
            <div className="upm-identity">
              <h2 className="upm-name">{displayName}</h2>
              <p className="upm-handle">@{username}</p>

              {/* [2][3] Tier badge + access badge — precision row addition */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                <TierBadgePill subscriptionTier={subscriptionTier} paymentStatus={paymentStatus} />
                <AccessBadge paymentStatus={paymentStatus} accountActivated={accountActivated} />
              </div>

              {profileData.bio && <p className="upm-bio">{profileData.bio}</p>}
              <div className="upm-meta"><Calendar size={12}/><span>Joined {joinDate}</span></div>
            </div>

            {/* ACTION BUTTONS — unchanged */}
            <div className="upm-actions">
              {!isOwnProfile ? (
                <>
                  <button className={`upm-btn-primary ${isFollowing?"upm-btn-following":""}`} onClick={handleFollowToggle}>
                    {isFollowing ? <UserCheck size={16}/> : <UserPlus size={16}/>}
                    <span>{isFollowing ? "Following" : "Follow"}</span>
                  </button>
                  <button className="upm-btn-secondary" onClick={handleMessageClick}>
                    <MessageSquare size={16}/><span>Message</span>
                  </button>
                  <button className="upm-btn-icon-only" onClick={()=>setShowNotificationSettings(true)} title="Notifications">
                    <Bell size={16}/>
                  </button>
                </>
              ) : (
                <button className="upm-btn-primary" onClick={()=>setShowEditModal(true)} style={{ flex:1 }}>
                  <Edit size={16}/><span>Edit Profile</span>
                </button>
              )}
            </div>

            {/* STAT CARDS — [4] EP column shows accurate balance */}
            <div className={`upm-stat-grid upm-stat-grid-${visibleStats.length}`}>
              {visibleStats.map((s, i) => (
                <div key={i} className={`upm-stat-card ${s.highlight?"upm-stat-highlight":""}`}>
                  <s.icon size={16} className="upm-stat-icon"/>
                  <div className="upm-stat-value">{s.value}</div>
                  <div className="upm-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ENGAGEMENT ROW — unchanged */}
            <div className="upm-engage-row">
              <div className="upm-engage-item">
                <Users size={14}/>
                <span className="upm-engage-val">{fmt(profileData.stats?.followers || 0)}</span>
                <span className="upm-engage-lbl">Followers</span>
              </div>
              <div className="upm-engage-sep"/>
              {isOwnProfile && (
                <>
                  <div className="upm-engage-item">
                    <Users size={14}/>
                    <span className="upm-engage-val">{fmt(profileData.stats?.following || 0)}</span>
                    <span className="upm-engage-lbl">Following</span>
                  </div>
                  <div className="upm-engage-sep"/>
                </>
              )}
              <div className="upm-engage-item">
                <Eye size={14}/>
                <span className="upm-engage-val">{fmt(profileData.stats?.totalViews || 0)}</span>
                <span className="upm-engage-lbl">Views</span>
              </div>
              <div className="upm-engage-sep"/>
              <div className="upm-engage-item">
                <Heart size={14}/>
                <span className="upm-engage-val">{fmt(profileData.stats?.totalComments || 0)}</span>
                <span className="upm-engage-lbl">Engagement</span>
              </div>
            </div>

            {/* ACHIEVEMENT — unchanged */}
            <div className="upm-achievement">
              <div className="upm-achievement-icon"><Award size={22}/></div>
              <div className="upm-achievement-body">
                <div className="upm-achievement-title">
                  {tierInfo?.hasBoost ? `${tierInfo.tierEmoji} ${tierInfo.tierLabel}` : "Elite Creator"}
                </div>
                <div className="upm-achievement-sub">{fmt(epBalance)} EP earned</div>
              </div>
              <div className="upm-achievement-badge"><TrendingUp size={14}/></div>
            </div>

            {/* CONTENT — unchanged */}
            <div className="upm-content-wrap">
              <MyContentSection
                userId={userId} showComments={false}
                profileData={profileData} currentUser={currentUser}
                onAuthorClick={onAuthorClick} onActionMenu={onActionMenu}
              />
            </div>
          </div>
        </div>
      </div>

      {showShareModal && <ShareModal content={{type:"profile", id:userId, username, name:displayName}} onClose={()=>setShowShareModal(false)} currentUser={currentUser}/>}
      {showActionMenu && <ProfileActionMenu user={profileData} onClose={()=>setShowActionMenu(false)} currentUser={currentUser} isOwnProfile={isOwnProfile}/>}
      {showNotificationSettings && <NotificationSettingsModal user={profileData} onClose={()=>setShowNotificationSettings(false)} currentUser={currentUser}/>}
      {showEditModal && <ProfileEditModal userId={userId} currentProfile={profileData} onClose={()=>setShowEditModal(false)} onSuccess={handleProfileUpdated}/>}
      {showDM && dmTargetUserId && <DMMessagesView currentUser={currentUser} onClose={()=>{setShowDM(false);setDmTargetUserId(null);}} initialOtherUserId={dmTargetUserId} standalone={true}/>}
    </>
  );
};

// ── All original styles preserved exactly ────────────────────────────────────
const upmStyles = `
  @keyframes upmFlashIn { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes upmFadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes upmSlideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes upmZoomIn  { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  @keyframes upmSpin    { to{transform:rotate(360deg)} }
  .upm-backdrop { position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.88);backdrop-filter:blur(22px);display:flex;align-items:center;justify-content:center;animation:upmFadeIn 0.25s ease;padding:20px; }
  .upm-backdrop.upm-mobile { align-items:flex-end;padding:0; }
  .upm-card { position:relative;background:#040404;display:flex;flex-direction:column;overflow:hidden; }
  .upm-card-desktop { width:520px;max-width:100%;max-height:88vh;border-radius:24px;border:1px solid rgba(132,204,22,0.18);box-shadow:0 32px 96px rgba(0,0,0,0.85),0 0 0 1px rgba(255,255,255,0.04);animation:upmZoomIn 0.28s cubic-bezier(0.16,1,0.3,1); }
  .upm-card-mobile { width:100%;max-height:93vh;border-radius:26px 26px 0 0;border-top:1px solid rgba(132,204,22,0.18);box-shadow:0 -20px 60px rgba(0,0,0,0.8);animation:upmSlideUp 0.32s cubic-bezier(0.16,1,0.3,1); }
  .upm-card.upm-loading { width:520px;max-width:90vw;height:220px;border-radius:24px;border:1px solid rgba(132,204,22,0.12);align-items:center;justify-content:center; }
  .upm-spinner { width:40px;height:40px;border:3px solid rgba(132,204,22,0.15);border-top-color:#84cc16;border-radius:50%;animation:upmSpin 0.8s linear infinite; }
  .upm-topbar { position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:10px;padding:14px 16px 12px;background:rgba(4,4,4,0.97);backdrop-filter:blur(20px);border-bottom:1px solid rgba(132,204,22,0.12);flex-shrink:0; }
  .upm-topbar-title { flex:1;text-align:center;font-size:16px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .upm-topbar-right { display:flex;gap:6px; }
  .upm-icon-btn { width:36px;height:36px;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);display:flex;align-items:center;justify-content:center;color:#737373;cursor:pointer;transition:all 0.18s; }
  .upm-icon-btn:hover { background:rgba(132,204,22,0.1);border-color:rgba(132,204,22,0.25);color:#84cc16; }
  .upm-verified { width:18px;height:18px;border-radius:50%;background:#84cc16;display:flex;align-items:center;justify-content:center;color:#000;flex-shrink:0; }
  .upm-body { flex:1;overflow-y:auto;overflow-x:hidden; }
  .upm-body::-webkit-scrollbar { width:4px; }
  .upm-body::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.2);border-radius:2px; }
  .upm-banner { height:110px;position:relative;flex-shrink:0; }
  .upm-banner-gradient { width:100%;height:100%;background:linear-gradient(135deg,rgba(132,204,22,0.18) 0%,rgba(132,204,22,0.04) 60%,rgba(0,0,0,0) 100%); }
  .upm-avatar-wrap { position:relative;width:fit-content;margin:-54px auto 0;z-index:2; }
  .upm-avatar { width:108px;height:108px;border-radius:50%;background:linear-gradient(135deg,#84cc16,#4d7c0f);border:5px solid #040404;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:900;color:#000;overflow:hidden;box-shadow:0 8px 28px rgba(132,204,22,0.45);position:relative;z-index:1; }
  .upm-avatar img { width:100%;height:100%;object-fit:cover; }
  .upm-avatar-glow { position:absolute;inset:-16px;border-radius:50%;background:radial-gradient(circle,rgba(132,204,22,0.25) 0%,transparent 70%);z-index:0;pointer-events:none; }
  .upm-identity { padding:14px 20px 6px;text-align:center; }
  .upm-name { font-size:24px;font-weight:900;color:#fff;margin:0 0 3px;letter-spacing:-0.3px; }
  .upm-handle { font-size:14px;color:#84cc16;margin:0 0 6px;font-weight:600; }
  .upm-bio { font-size:13.5px;color:#a3a3a3;line-height:1.6;margin:0 0 10px; }
  .upm-meta { display:flex;align-items:center;justify-content:center;gap:5px;font-size:12px;color:#525252;margin-bottom:4px; }
  .upm-actions { display:flex;gap:8px;padding:12px 16px 6px; }
  .upm-btn-primary,.upm-btn-secondary { display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s;border:none;flex:1; }
  .upm-btn-primary { background:linear-gradient(135deg,#84cc16,#4d7c0f);color:#000;box-shadow:0 4px 16px rgba(132,204,22,0.3); }
  .upm-btn-primary:hover { transform:translateY(-1px);filter:brightness(1.08); }
  .upm-btn-primary.upm-btn-following { background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(132,204,22,0.25);box-shadow:none; }
  .upm-btn-secondary { background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(132,204,22,0.18); }
  .upm-btn-secondary:hover { background:rgba(255,255,255,0.09); }
  .upm-btn-icon-only { width:46px;height:46px;border-radius:12px;flex-shrink:0;background:rgba(255,255,255,0.05);border:1px solid rgba(132,204,22,0.18);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;transition:all 0.2s; }
  .upm-btn-icon-only:hover { background:rgba(132,204,22,0.1); }
  .upm-stat-grid { display:grid;gap:8px;padding:12px 14px; }
  .upm-stat-grid-4 { grid-template-columns:repeat(4,1fr); }
  .upm-stat-grid-3 { grid-template-columns:repeat(3,1fr); }
  .upm-stat-card { background:rgba(255,255,255,0.03);border:1px solid rgba(132,204,22,0.12);border-radius:14px;padding:14px 6px;text-align:center;transition:all 0.2s; }
  .upm-stat-card:hover { border-color:rgba(132,204,22,0.3);transform:translateY(-2px); }
  .upm-stat-highlight { background:rgba(132,204,22,0.07);border-color:rgba(132,204,22,0.22); }
  .upm-stat-icon { color:#84cc16;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto; }
  .upm-stat-value { font-size:19px;font-weight:900;color:#fff;margin-bottom:3px; }
  .upm-stat-label { font-size:10px;color:#525252;text-transform:uppercase;letter-spacing:0.05em;font-weight:700; }
  .upm-engage-row { display:flex;justify-content:space-around;align-items:center;padding:14px 16px;margin:0 14px;background:rgba(255,255,255,0.025);border:1px solid rgba(132,204,22,0.12);border-radius:16px;margin-bottom:12px; }
  .upm-engage-item { display:flex;flex-direction:column;align-items:center;gap:4px;color:#525252; }
  .upm-engage-val { font-size:18px;font-weight:900;color:#84cc16;line-height:1; }
  .upm-engage-lbl { font-size:11px;color:#525252;font-weight:600; }
  .upm-engage-sep { width:1px;height:36px;background:rgba(132,204,22,0.12); }
  .upm-achievement { display:flex;align-items:center;gap:14px;padding:14px 16px;margin:0 14px 16px;background:linear-gradient(135deg,rgba(132,204,22,0.09),rgba(132,204,22,0.03));border:1px solid rgba(132,204,22,0.2);border-radius:16px; }
  .upm-achievement-icon { width:44px;height:44px;border-radius:12px;background:rgba(132,204,22,0.15);display:flex;align-items:center;justify-content:center;color:#84cc16;flex-shrink:0; }
  .upm-achievement-body { flex:1; }
  .upm-achievement-title { font-size:14px;font-weight:800;color:#fff;margin-bottom:3px; }
  .upm-achievement-sub { font-size:12px;color:#737373; }
  .upm-achievement-badge { width:36px;height:36px;border-radius:10px;background:rgba(132,204,22,0.15);display:flex;align-items:center;justify-content:center;color:#84cc16; }
  .upm-content-wrap { padding:0 10px 28px; }
`;

export default UserProfileModal;