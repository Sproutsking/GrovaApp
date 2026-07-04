        stats: { ...prev.stats, followers: !newFollowState ? (prev.stats?.followers || 0) + 1 : Math.max(0, (prev.stats?.followers || 1) - 1) },
// Wrapper: re-export canonical modal to avoid duplicate-source runtime issues.
// This ensures imports from both `src/components/Modals/*` and `src/Modals/*`
// resolve to the same module implementation.

export { default } from "../components/Modals/UserProfileModal.jsx";
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

            <VerificationLedgerCard
              userId={userId}
              currentUser={currentUser}
              onOpenOracle={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-oracle"));
                }
              }}
            />

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