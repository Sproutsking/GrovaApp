// ============================================================================
// src/components/Account/ProfileSection.jsx — UPDATED
// Beautiful 2-col action card grid. Communities, Followers, Saved, Logout.
// Logout properly calls onSignOut to redirect to login without page refresh.
// NEW: Views + Comments + Likes metric row — always horizontal, never wraps.
//      All live data with real-time Supabase subscriptions for instant updates.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye, MessageSquare, Edit, Mail, Phone, Shield, LogOut,
  Bookmark, Users, UserPlus, Hash, Crown, Flame, Heart,
  TrendingUp, Zap, Activity
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import ProfileEditModal from "./ProfileEditModal";
import SavedContentModal from "../Modals/SavedContentModal";
import CommunitiesModal from "../Modals/CommunitiesModal";
import FollowersModal from "../Modals/FollowersModal";
import MyContentSection from "./MyContentSection";

// ── Animated counter hook ──────────────────────────────────────────────────
const useAnimatedCount = (target, duration = 600) => {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef(null);

  useEffect(() => {
    const start = prev.current;
    const end = target;
    if (start === end) return;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = end;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
};

// ── Format number helper ───────────────────────────────────────────────────
const fmt = (num) => {
  if (num == null) return "0";
  const v = Number(num);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.floor(v).toString();
};

// ── Pulse dot (live indicator) ─────────────────────────────────────────────
const LiveDot = () => (
  <span style={{
    display: "inline-block", width: 6, height: 6, borderRadius: "50%",
    background: "#84cc16", marginLeft: 4, flexShrink: 0,
    boxShadow: "0 0 0 0 rgba(132,204,22,0.6)",
    animation: "livePulse 1.8s ease-out infinite",
  }} />
);

// ── Single stat pill in the triStat row ───────────────────────────────────
const TriStatPill = ({ icon: Icon, value, label, accent, glowColor, animTarget }) => {
  const displayed = useAnimatedCount(animTarget ?? value, 700);
  return (
    <div className="tri-stat-pill" style={{ "--accent": accent, "--glow": glowColor }}>
      <div className="tri-stat-inner">
        <div className="tri-stat-icon-wrap">
          <Icon size={15} style={{ color: accent }} />
        </div>
        <div className="tri-stat-text">
          <span className="tri-stat-value">{fmt(displayed)}</span>
          <span className="tri-stat-label">{label}</span>
        </div>
      </div>
    </div>
  );
};

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

  // Live reactive stats — updated by realtime subscriptions
  const [liveStats, setLiveStats] = useState({
    totalViews: 0, totalComments: 0, totalLikes: 0,
    followers: 0, following: 0, communities: 0,
    grovaTokens: 0, engagementPoints: 0, totalContent: 0,
  });

  const subsRef = useRef([]);
  const isMobile = window.innerWidth <= 768;

  // ── Realtime subscription helpers ──────────────────────────────────────
  const patchLive = useCallback((patch) =>
    setLiveStats(prev => ({ ...prev, ...patch })), []);

  const subscribeLive = useCallback(() => {
    if (!userId) return;

    // Clean up old subs
    subsRef.current.forEach(s => supabase.removeChannel(s));
    subsRef.current = [];

    // Helper to recount a table
    const recount = async (table, col, value, field, extra = {}) => {
      const q = supabase.from(table).select("*", { count: "exact", head: true }).eq(col, value);
      if (extra.is) q.is(extra.is[0], extra.is[1]);
      const { count } = await q;
      if (count !== null) patchLive({ [field]: count });
    };

    // Helper to resum views
    const resumViews = async () => {
      const [sv, rv, pv] = await Promise.all([
        supabase.from("stories").select("views").eq("user_id", userId).is("deleted_at", null),
        supabase.from("reels").select("views").eq("user_id", userId).is("deleted_at", null),
        supabase.from("posts").select("views").eq("user_id", userId).is("deleted_at", null),
      ]);
      const rows = [
        ...(sv.data || []), ...(rv.data || []), ...(pv.data || []),
      ];
      patchLive({ totalViews: rows.reduce((s, r) => s + (r.views || 0), 0) });
    };

    // Helper to resum likes
    const resumLikes = async () => {
      const [sl, rl, pl] = await Promise.all([
        supabase.from("story_likes").select("*", { count: "exact", head: true })
          .in("story_id", await getContentIds("stories")),
        supabase.from("reel_likes").select("*", { count: "exact", head: true })
          .in("reel_id", await getContentIds("reels")),
        supabase.from("post_likes").select("*", { count: "exact", head: true })
          .in("post_id", await getContentIds("posts")),
      ]);
      const total = (sl.count || 0) + (rl.count || 0) + (pl.count || 0);
      patchLive({ totalLikes: total });
    };

    const getContentIds = async (table) => {
      const { data } = await supabase.from(table).select("id").eq("user_id", userId).is("deleted_at", null);
      return (data || []).map(r => r.id);
    };

    // Subscribe: follows
    const followSub = supabase.channel(`follows-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => {
        recount("follows", "following_id", userId, "followers");
        recount("follows", "follower_id", userId, "following");
      }).subscribe();

    // Subscribe: comments
    const commentSub = supabase.channel(`comments-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `user_id=eq.${userId}` }, () => {
        recount("comments", "user_id", userId, "totalComments");
      }).subscribe();

    // Subscribe: community_members
    const commSub = supabase.channel(`comm-members-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_members", filter: `user_id=eq.${userId}` }, () => {
        recount("community_members", "user_id", userId, "communities");
      }).subscribe();

    // Subscribe: posts/reels/stories (views + content count)
    const postSub = supabase.channel(`posts-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `user_id=eq.${userId}` }, () => {
        resumViews();
        recount("posts", "user_id", userId, "totalContent");
      }).subscribe();

    const reelSub = supabase.channel(`reels-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reels", filter: `user_id=eq.${userId}` }, () => {
        resumViews();
      }).subscribe();

    const storySub = supabase.channel(`stories-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stories", filter: `user_id=eq.${userId}` }, () => {
        resumViews();
      }).subscribe();

    // Subscribe: likes
    const postLikeSub = supabase.channel(`post-likes-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, resumLikes)
      .subscribe();
    const reelLikeSub = supabase.channel(`reel-likes-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reel_likes" }, resumLikes)
      .subscribe();
    const storyLikeSub = supabase.channel(`story-likes-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "story_likes" }, resumLikes)
      .subscribe();

    // Subscribe: wallet
    const walletSub = supabase.channel(`wallet-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` }, async () => {
        const { data } = await supabase.from("wallets").select("grova_tokens, engagement_points").eq("user_id", userId).maybeSingle();
        if (data) patchLive({ grovaTokens: data.grova_tokens || 0, engagementPoints: data.engagement_points || 0 });
      }).subscribe();

    subsRef.current = [followSub, commentSub, commSub, postSub, reelSub, storySub, postLikeSub, reelLikeSub, storyLikeSub, walletSub];
  }, [userId, patchLive]);

  useEffect(() => {
    if (userId) { loadProfileData(); subscribeLive(); }
    return () => subsRef.current.forEach(s => supabase.removeChannel(s));
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
        setProfile({ id: userId, fullName: "User", username: "user", avatar: null, avatarId: null, bio: null, verified: false, isPro: false, joinDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }), email: null, phone: null, phoneVerified: false, showEmail: false, showPhone: false });
        setLiveStats({ totalContent: 0, totalViews: 0, totalComments: 0, totalLikes: 0, followers: 0, following: 0, communities: 0, grovaTokens: 0, engagementPoints: 0 });
        return;
      }

      const getContentIds = async (table) => {
        const { data } = await supabase.from(table).select("id").eq("user_id", userId).is("deleted_at", null);
        return (data || []).map(r => r.id);
      };

      const [storyIds, reelIds, postIds] = await Promise.all([
        getContentIds("stories"), getContentIds("reels"), getContentIds("posts"),
      ]);

      const [
        walletRes, storiesRes, reelsRes, postsRes,
        storiesViewsRes, reelsViewsRes, postsViewsRes, commentsRes,
        followersRes, followingRes, communitiesRes,
        storyLikesRes, reelLikesRes, postLikesRes,
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
        storyIds.length ? supabase.from("story_likes").select("*", { count: "exact", head: true }).in("story_id", storyIds) : Promise.resolve({ count: 0 }),
        reelIds.length ? supabase.from("reel_likes").select("*", { count: "exact", head: true }).in("reel_id", reelIds) : Promise.resolve({ count: 0 }),
        postIds.length ? supabase.from("post_likes").select("*", { count: "exact", head: true }).in("post_id", postIds) : Promise.resolve({ count: 0 }),
      ]);

      const wallet = walletRes.status === "fulfilled" ? walletRes.value.data : null;
      const storiesCount = storiesRes.status === "fulfilled" ? (storiesRes.value.count ?? 0) : 0;
      const reelsCount = reelsRes.status === "fulfilled" ? (reelsRes.value.count ?? 0) : 0;
      const postsCount = postsRes.status === "fulfilled" ? (postsRes.value.count ?? 0) : 0;
      const commentsCount = commentsRes.status === "fulfilled" ? (commentsRes.value.count ?? 0) : 0;
      const followersCount = followersRes.status === "fulfilled" ? (followersRes.value.count ?? 0) : 0;
      const followingCount = followingRes.status === "fulfilled" ? (followingRes.value.count ?? 0) : 0;
      const communitiesCount = communitiesRes.status === "fulfilled" ? (communitiesRes.value.count ?? 0) : 0;
      const storyLikesCount = storyLikesRes.status === "fulfilled" ? (storyLikesRes.value.count ?? 0) : 0;
      const reelLikesCount = reelLikesRes.status === "fulfilled" ? (reelLikesRes.value.count ?? 0) : 0;
      const postLikesCount = postLikesRes.status === "fulfilled" ? (postLikesRes.value.count ?? 0) : 0;

      const allViewRows = [
        ...(storiesViewsRes.status === "fulfilled" ? storiesViewsRes.value.data || [] : []),
        ...(reelsViewsRes.status === "fulfilled" ? reelsViewsRes.value.data || [] : []),
        ...(postsViewsRes.status === "fulfilled" ? postsViewsRes.value.data || [] : []),
      ];
      const totalViews = allViewRows.reduce((sum, item) => sum + (item.views || 0), 0);
      const totalLikes = storyLikesCount + reelLikesCount + postLikesCount;

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
      };

      setProfile(profileState);
      setLiveStats({
        totalContent: storiesCount + reelsCount + postsCount,
        totalViews, totalComments: commentsCount, totalLikes,
        followers: followersCount, following: followingCount, communities: communitiesCount,
        grovaTokens: wallet?.grova_tokens || 0, engagementPoints: wallet?.engagement_points || 0,
      });

      if (onProfileUpdate) onProfileUpdate({
        id: profileState.id, fullName: profileState.fullName,
        username: profileState.username, avatar: avatarUrl,
        verified: profileState.verified, isPro: profileState.isPro,
      });
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
    try {
      await supabase.auth.signOut();
      if (typeof onSignOut === "function") onSignOut();
    } catch (err) {
      console.error("Logout error:", err);
      if (typeof onSignOut === "function") onSignOut();
    }
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

  const isValidAvatar = profile.avatar && typeof profile.avatar === "string" && !imageError &&
    (profile.avatar.startsWith("http") || profile.avatar.startsWith("blob:"));

  const actionButtons = [
    { id: "edit", icon: <Edit size={20} />, label: "Edit Profile", sub: "Update your info", accent: "#84cc16", bg: "linear-gradient(135deg, rgba(132,204,22,0.15) 0%, rgba(101,163,13,0.08) 100%)", border: "rgba(132,204,22,0.4)", onClick: () => setShowEditModal(true) },
    { id: "saved", icon: <Bookmark size={20} />, label: "Saved", sub: "Your bookmarks", accent: "#fbbf24", bg: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 100%)", border: "rgba(251,191,36,0.35)", onClick: () => setShowSavedModal(true) },
    { id: "followers", icon: <UserPlus size={20} />, label: "Followers", sub: `${fmt(liveStats.followers)} people`, accent: "#60a5fa", bg: "linear-gradient(135deg, rgba(96,165,250,0.12) 0%, rgba(59,130,246,0.06) 100%)", border: "rgba(96,165,250,0.35)", onClick: () => { setFollowersTab("followers"); setShowFollowersModal(true); } },
    { id: "following", icon: <Users size={20} />, label: "Following", sub: `${fmt(liveStats.following)} people`, accent: "#a78bfa", bg: "linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(139,92,246,0.06) 100%)", border: "rgba(167,139,250,0.35)", onClick: () => { setFollowersTab("following"); setShowFollowersModal(true); } },
    { id: "communities", icon: <Hash size={20} />, label: "Communities", sub: `${fmt(liveStats.communities)} joined`, accent: "#34d399", bg: "linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(16,185,129,0.06) 100%)", border: "rgba(52,211,153,0.35)", onClick: () => setShowCommunitiesModal(true) },
    { id: "logout", icon: <LogOut size={20} />, label: "Sign Out", sub: "Log out of account", accent: "#ef4444", bg: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.06) 100%)", border: "rgba(239,68,68,0.35)", onClick: () => setShowLogoutConfirm(true) },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes profileFadeIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(132,204,22,0.7); }
          70%  { box-shadow: 0 0 0 5px rgba(132,204,22,0); }
          100% { box-shadow: 0 0 0 0 rgba(132,204,22,0); }
        }
        @keyframes shimmerIn {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes countPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }

        .profile-section { padding: 20px; }

        /* ── Header card ── */
        .profile-header-card {
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(132,204,22,0.2);
          border-radius: 24px;
          padding: 40px 24px 32px;
          margin-bottom: 16px;
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

        /* ── Top stats row (content / followers / tokens / EP) ── */
        .profile-stats-row { display: flex; align-items: center; justify-content: center; gap: 0; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 14px 8px; overflow: hidden; }
        .profile-stat { flex: 1; text-align: center; padding: 0 8px; }
        .profile-stat-value { font-size: 19px; font-weight: 900; background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 3px 0; }
        .profile-stat-label { font-size: 10px; color: #737373; margin: 0; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; }
        .stat-divider { width: 1px; height: 32px; background: linear-gradient(180deg, transparent 0%, rgba(132,204,22,0.3) 50%, transparent 100%); flex-shrink: 0; }

        /* ── TRISTAT ROW — views / comments / likes ── */
        .tristat-card {
          position: relative;
          background: rgba(10,10,10,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 4px;
          margin-bottom: 16px;
          overflow: hidden;
          animation: shimmerIn 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tristat-card::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(110deg,
            rgba(132,204,22,0.06) 0%,
            rgba(251,191,36,0.04) 33%,
            rgba(239,68,68,0.06) 66%,
            transparent 100%);
          border-radius: inherit;
          pointer-events: none;
        }
        .tristat-live-bar {
          position: absolute; top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #84cc16, #fbbf24, #ef4444, #84cc16);
          background-size: 200% 100%;
          animation: liveBarScroll 3s linear infinite;
          border-radius: 2px 2px 0 0;
        }
        @keyframes liveBarScroll {
          from { background-position: 0% 0%; }
          to   { background-position: 200% 0%; }
        }
        .tristat-row {
          display: flex;
          flex-direction: row;          /* ALWAYS row — never column */
          align-items: stretch;
          gap: 0;
          min-width: 0;
        }

        /* Each pill */
        .tri-stat-pill {
          flex: 1 1 0;
          min-width: 0;
          position: relative;
          cursor: default;
          border-radius: 14px;
          transition: background 0.2s, transform 0.2s;
        }
        .tri-stat-pill:hover {
          background: rgba(255,255,255,0.04);
          transform: translateY(-1px);
        }
        .tri-stat-inner {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: clamp(4px, 1.2vw, 10px);
          padding: clamp(10px, 2vw, 18px) clamp(6px, 1.5vw, 14px);
          min-width: 0;
        }
        .tri-stat-icon-wrap {
          display: flex; align-items: center; justify-content: center;
          width: clamp(26px, 5vw, 34px);
          height: clamp(26px, 5vw, 34px);
          border-radius: 9px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
          flex-shrink: 0;
          transition: box-shadow 0.25s;
        }
        .tri-stat-pill:hover .tri-stat-icon-wrap {
          box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 35%, transparent);
        }
        .tri-stat-icon-wrap svg {
          width: clamp(11px, 2.5vw, 15px) !important;
          height: clamp(11px, 2.5vw, 15px) !important;
        }
        .tri-stat-text {
          display: flex; flex-direction: column; align-items: flex-start;
          min-width: 0; flex: 1 1 auto;
        }
        .tri-stat-value {
          font-size: clamp(14px, 3.5vw, 20px);
          font-weight: 900;
          color: var(--accent);
          line-height: 1.15;
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .tri-stat-label {
          font-size: clamp(8px, 1.8vw, 11px);
          color: #525252;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* Dividers between pills */
        .tristat-divider {
          width: 1px;
          margin: 10px 0;
          background: linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          flex-shrink: 0;
          align-self: stretch;
        }

        /* ── Actions grid ── */
        .actions-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 22px;
          padding: 10px;
          margin-bottom: 0px;
        }
        .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .action-btn {
          position: relative;
          display: flex; flex-direction: row; align-items: flex-start;
          gap: 10px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid;
          cursor: pointer;
          transition: all 0.25s;
          overflow: hidden;
          text-align: left;
        }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .action-btn:active { transform: translateY(0); }
        .action-btn-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .action-btn-text { flex: 1; min-width: 0; }
        .action-btn-label { font-size: 13px; font-weight: 800; margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .action-btn-sub { font-size: 11px; font-weight: 500; margin: 0; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* ── Contact info ── */
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

            {/* Top-row stats: content / followers / tokens / EP */}
            <div className="profile-stats-row">
              <div className="profile-stat">
                <p className="profile-stat-value">{fmt(liveStats.totalContent)}</p>
                <p className="profile-stat-label">Content</p>
              </div>
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">{fmt(liveStats.followers)}</p>
                <p className="profile-stat-label">Followers</p>
              </div>
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">{fmt(liveStats.grovaTokens)}</p>
                <p className="profile-stat-label">GT Balance</p>
              </div>
              <div className="stat-divider" />
              <div className="profile-stat">
                <p className="profile-stat-value">{fmt(liveStats.engagementPoints)}</p>
                <p className="profile-stat-label">EP Balance</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── TRISTAT: Views / Comments / Likes — always row, never wraps ── */}
        <div className="tristat-card">
          <div className="tristat-live-bar" />
          <div className="tristat-row">

            <TriStatPill
              icon={Eye}
              animTarget={liveStats.totalViews}
              value={liveStats.totalViews}
              label="Views"
              accent="#84cc16"
              glowColor="rgba(132,204,22,0.35)"
            />

            <div className="tristat-divider" />

            <TriStatPill
              icon={MessageSquare}
              animTarget={liveStats.totalComments}
              value={liveStats.totalComments}
              label="Comments"
              accent="#60a5fa"
              glowColor="rgba(96,165,250,0.35)"
            />

            <div className="tristat-divider" />

            <TriStatPill
              icon={Heart}
              animTarget={liveStats.totalLikes}
              value={liveStats.totalLikes}
              label="Likes"
              accent="#f87171"
              glowColor="rgba(248,113,113,0.35)"
            />

          </div>

          {/* Live indicator footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 5, paddingBottom: 8,
          }}>
            <LiveDot />
            <span style={{ fontSize: 9, color: "#525252", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Live
            </span>
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
                style={{ background: btn.bg, borderColor: btn.border }}
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
          profileData={{
            ...profile,
            stats: {
              totalContent: liveStats.totalContent,
              totalViews: liveStats.totalViews,
              totalComments: liveStats.totalComments,
            },
            wallet: { grovaTokens: liveStats.grovaTokens, engagementPoints: liveStats.engagementPoints },
            social: { followers: liveStats.followers, following: liveStats.following, communities: liveStats.communities },
          }}
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
      {showSavedModal && <SavedContentModal currentUser={{ id: userId }} onClose={() => setShowSavedModal(false)} isMobile={isMobile} />}
      {showCommunitiesModal && <CommunitiesModal currentUser={{ id: userId }} onClose={() => setShowCommunitiesModal(false)} isMobile={isMobile} />}
      {showFollowersModal && <FollowersModal currentUser={{ id: userId }} onClose={() => setShowFollowersModal(false)} isMobile={isMobile} defaultTab={followersTab} />}
      {showLogoutConfirm && <ConfirmLogout onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />}
    </>
  );
};

export default ProfileSection;