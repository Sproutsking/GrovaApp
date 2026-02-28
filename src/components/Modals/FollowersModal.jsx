// ============================================================================
// src/components/Modals/FollowersModal.jsx
// Shows followers and following with beautiful UI
// ============================================================================

import React, { useState, useEffect } from "react";
import { X, UserPlus, Users, Search, Crown, Shield, CheckCircle2, UserMinus, UserCheck } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

const FollowersModal = ({ currentUser, onClose, isMobile, defaultTab = "followers" }) => {
  const [tab, setTab] = useState(defaultTab);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [followingBack, setFollowingBack] = useState({});

  useEffect(() => {
    if (currentUser?.id) loadData();
  }, [currentUser?.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [followerRes, followingRes] = await Promise.allSettled([
        supabase
          .from("follows")
          .select("follower_id, created_at, profiles:follower_id(id, full_name, username, avatar_id, verified, is_pro, bio)")
          .eq("following_id", currentUser.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("follows")
          .select("following_id, created_at, profiles:following_id(id, full_name, username, avatar_id, verified, is_pro, bio)")
          .eq("follower_id", currentUser.id)
          .order("created_at", { ascending: false }),
      ]);

      const followerList = followerRes.status === "fulfilled"
        ? (followerRes.value.data || []).map(f => ({ ...f.profiles, followed_at: f.created_at }))
        : [];
      const followingList = followingRes.status === "fulfilled"
        ? (followingRes.value.data || []).map(f => ({ ...f.profiles, followed_at: f.created_at }))
        : [];

      // Build followingBack map (users we follow back from our followers)
      const followingIds = new Set(followingList.map(u => u.id));
      const backMap = {};
      followerList.forEach(u => { backMap[u.id] = followingIds.has(u.id); });

      setFollowers(followerList);
      setFollowing(followingList);
      setFollowingBack(backMap);
    } catch (err) {
      console.warn("FollowersModal load error:", err?.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveAvatar = (avatarId) => {
    if (!avatarId) return null;
    const url = mediaUrlService.getImageUrl(avatarId);
    if (!url) return null;
    const clean = url.split("?")[0];
    return clean.includes("supabase")
      ? `${clean}?quality=80&width=200&height=200&resize=cover&format=webp`
      : url;
  };

  const currentList = tab === "followers" ? followers : following;
  const filtered = currentList.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <>
      <style>{`
        .fm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px); z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: fmFadeIn 0.2s ease;
        }
        @keyframes fmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fmSlideUp { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: translateY(0) } }
        .fm-modal {
          background: #0a0a0a;
          border: 1px solid rgba(132,204,22,0.2);
          border-radius: 24px;
          width: min(520px, 100%);
          max-height: 85vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(132,204,22,0.05);
          animation: fmSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .fm-header { padding: 24px 24px 0; flex-shrink: 0; }
        .fm-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .fm-title { font-size: 20px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 10px; }
        .fm-title-icon { width: 36px; height: 36px; background: rgba(132,204,22,0.12); border: 1px solid rgba(132,204,22,0.25); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .fm-close { width: 36px; height: 36px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #a3a3a3; transition: all 0.2s; }
        .fm-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .fm-tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.04); border-radius: 14px; padding: 4px; margin-bottom: 20px; }
        .fm-tab { flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.25s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .fm-tab.active { background: rgba(132,204,22,0.15); color: #84cc16; border: 1px solid rgba(132,204,22,0.3); }
        .fm-tab:not(.active) { background: transparent; color: #737373; border: 1px solid transparent; }
        .fm-tab:not(.active):hover { color: #a3a3a3; background: rgba(255,255,255,0.04); }
        .fm-count { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 18px; padding: 0 6px; border-radius: 9px; font-size: 11px; font-weight: 800; }
        .fm-tab.active .fm-count { background: rgba(132,204,22,0.2); color: #84cc16; }
        .fm-tab:not(.active) .fm-count { background: rgba(255,255,255,0.08); color: #525252; }
        .fm-search { padding: 0 20px 14px; position: relative; flex-shrink: 0; }
        .fm-search-input { width: 100%; padding: 10px 16px 10px 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 14px; outline: none; box-sizing: border-box; transition: border-color 0.2s; }
        .fm-search-input:focus { border-color: rgba(132,204,22,0.4); }
        .fm-search-input::placeholder { color: #525252; }
        .fm-search-icon { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); color: #525252; pointer-events: none; }
        .fm-list { flex: 1; overflow-y: auto; padding: 0 12px 12px; }
        .fm-list::-webkit-scrollbar { width: 4px; }
        .fm-list::-webkit-scrollbar-track { background: transparent; }
        .fm-list::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.3); border-radius: 2px; }
        .fm-item { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 16px; transition: background 0.2s; margin-bottom: 4px; }
        .fm-item:hover { background: rgba(255,255,255,0.04); }
        .fm-avatar-wrap { position: relative; flex-shrink: 0; }
        .fm-avatar { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #1a2e05 0%, #0d1a02 100%); border: 1.5px solid rgba(132,204,22,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; color: #84cc16; font-weight: 800; overflow: hidden; }
        .fm-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .fm-verified { position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; background: #84cc16; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #0a0a0a; }
        .fm-pro { position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; background: #fbbf24; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #0a0a0a; }
        .fm-info { flex: 1; min-width: 0; }
        .fm-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .fm-name { font-size: 14px; font-weight: 700; color: #fff; }
        .fm-username { font-size: 12px; color: #737373; font-weight: 600; }
        .fm-time { font-size: 11px; color: #404040; font-weight: 600; margin-top: 3px; }
        .fm-mutual-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; background: rgba(132,204,22,0.08); border: 1px solid rgba(132,204,22,0.2); border-radius: 6px; font-size: 10px; color: #84cc16; font-weight: 700; }
        .fm-follow-btn { padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid; transition: all 0.2s; flex-shrink: 0; display: flex; align-items: center; gap: 5px; }
        .fm-follow-btn.following { background: rgba(132,204,22,0.08); border-color: rgba(132,204,22,0.25); color: #84cc16; }
        .fm-follow-btn.follow { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); color: #a3a3a3; }
        .fm-follow-btn.follow:hover { background: rgba(132,204,22,0.1); border-color: rgba(132,204,22,0.3); color: #84cc16; }
        .fm-empty { padding: 60px 20px; text-align: center; }
        .fm-empty-icon { width: 64px; height: 64px; background: rgba(132,204,22,0.06); border: 1px solid rgba(132,204,22,0.15); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .fm-empty-title { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 8px 0; }
        .fm-empty-sub { font-size: 13px; color: #525252; margin: 0; }
        .fm-loading { padding: 60px 20px; text-align: center; }
        .fm-spinner { width: 40px; height: 40px; border: 3px solid rgba(132,204,22,0.15); border-top-color: #84cc16; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div className="fm-overlay" onClick={onClose}>
        <div className="fm-modal" onClick={e => e.stopPropagation()}>
          <div className="fm-header">
            <div className="fm-header-top">
              <h3 className="fm-title">
                <div className="fm-title-icon"><Users size={18} color="#84cc16" /></div>
                Connections
              </h3>
              <button className="fm-close" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="fm-tabs">
              <button className={`fm-tab ${tab === "followers" ? "active" : ""}`} onClick={() => setTab("followers")}>
                <UserPlus size={14} />
                Followers
                <span className="fm-count">{followers.length}</span>
              </button>
              <button className={`fm-tab ${tab === "following" ? "active" : ""}`} onClick={() => setTab("following")}>
                <UserCheck size={14} />
                Following
                <span className="fm-count">{following.length}</span>
              </button>
            </div>
          </div>

          <div className="fm-search">
            <Search size={15} className="fm-search-icon" />
            <input className="fm-search-input" placeholder="Search people..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="fm-list">
            {loading ? (
              <div className="fm-loading">
                <div className="fm-spinner" />
                <p style={{ color: "#737373", fontSize: "14px", margin: 0 }}>Loading...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="fm-empty">
                <div className="fm-empty-icon"><Users size={28} color="#84cc16" opacity={0.5} /></div>
                <p className="fm-empty-title">{search ? "No results" : tab === "followers" ? "No followers yet" : "Not following anyone"}</p>
                <p className="fm-empty-sub">{search ? "Try a different name" : tab === "followers" ? "Share your profile to gain followers" : "Discover creators to follow"}</p>
              </div>
            ) : filtered.map(user => {
              const avatarUrl = resolveAvatar(user.avatar_id);
              const isFollowingBack = tab === "followers" && followingBack[user.id];
              return (
                <div key={user.id} className="fm-item">
                  <div className="fm-avatar-wrap">
                    <div className="fm-avatar">
                      {avatarUrl ? <img src={avatarUrl} alt={user.full_name} crossOrigin="anonymous" /> : (user.full_name?.charAt(0)?.toUpperCase() || "U")}
                    </div>
                    {user.is_pro && <div className="fm-pro"><Crown size={8} color="#000" /></div>}
                    {user.verified && !user.is_pro && <div className="fm-verified"><Shield size={8} color="#000" /></div>}
                  </div>
                  <div className="fm-info">
                    <div className="fm-name-row">
                      <span className="fm-name">{user.full_name || "User"}</span>
                      {isFollowingBack && (
                        <span className="fm-mutual-badge"><CheckCircle2 size={9} /> Mutual</span>
                      )}
                    </div>
                    <div className="fm-username">@{user.username || "user"}</div>
                    <div className="fm-time">{formatDate(user.followed_at)}</div>
                  </div>
                  {tab === "followers" && !isFollowingBack && (
                    <button className="fm-follow-btn follow"><UserPlus size={12} /> Follow</button>
                  )}
                  {tab === "followers" && isFollowingBack && (
                    <button className="fm-follow-btn following"><UserCheck size={12} /> Following</button>
                  )}
                  {tab === "following" && (
                    <button className="fm-follow-btn following"><UserMinus size={12} /> Following</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default FollowersModal;