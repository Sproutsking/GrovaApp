// src/components/Modals/UserProfileModal.jsx
// ============================================================================
// LIVE BOOST EDITION
//
// ID RESOLUTION — handles every caller shape:
//   user.id | user.user_id | user.userId | user.profile_id   (target)
//   currentUser.id | currentUser.uid | currentUser.userId    (viewer)
//
// ProfilePreview passes:
//   { id, user_id, userId, name, author, username, avatar,
//     verified, subscription_tier, payment_status, boost_selections }
//
// PostCard's profile object (fallback) passes:
//   { id, userId, author, username, avatar, verified }
//
// SendTab passes:
//   { id, username, full_name, avatar_id, ... }
//
// All shapes resolve correctly via resolveTargetId / resolveMyId.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  X, UserPlus, UserCheck, Loader,
  Shield, Crown, Image, Film, BookOpen, Heart, Eye,
} from "lucide-react";
import { supabase }          from "../../services/config/supabase";
import mediaUrlService       from "../../services/shared/mediaUrlService";
import followService         from "../../services/social/followService";
import { BOOST_VISUAL, getTierBadge } from "../../services/account/profileTierService";
import BoostProfileCard      from "../Boost/BoostProfileCard";
import BoostAvatarRing       from "../Shared/BoostAvatarRing";
import { useUserBoostTier }  from "../../hooks/useUserBoostTier";
import { buildPublicProfileDashboard } from "../../services/evidence/publicProfileDashboardModel";
import {
  Briefcase, FileText, MessageCircleReply, ThumbsUp, Sparkles, ArrowLeft,
  ShieldCheck, Users, MessageSquare,
} from "lucide-react";

// ── Colour helpers ────────────────────────────────────────────────────────────

const TIER_COLORS = {
  silver:  "#d4d4d4",
  gold:    "#fbbf24",
  diamond: "#a78bfa",
};

const DIAMOND_THEME_COLORS = {
  "diamond-cosmos":  "#a78bfa",
  "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399",
  "diamond-rose":    "#f472b6",
  "diamond-void":    "#e5e5e5",
  "diamond-inferno": "#ff6b35",
  "diamond-aurora":  "#22d3ee",
};

const getTierColor = (tier, themeId) => {
  if (!tier || !TIER_COLORS[tier]) return "#ffffff";
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId])
    return DIAMOND_THEME_COLORS[themeId];
  return TIER_COLORS[tier];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.floor(v));
};
const parseMediaIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    if (value.startsWith("http")) return [value];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    return [value];
  }
  return [];
};

const resolveMediaThumbnail = (item) => {
  if (!item) return null;
  const httpUrl = (url) => typeof url === "string" && url.startsWith("http") ? url : null;

  const imageIds = parseMediaIds(item.image_ids);
  if (imageIds.length) {
    const first = imageIds[0];
    return httpUrl(first) || mediaUrlService.getImageUrl(first, {
      width: 400,
      height: 400,
      crop: "fill",
      gravity: "auto",
      quality: "auto:best",
      format: "auto",
    });
  }

  if (item.cover_image_id) {
    return httpUrl(item.cover_image_id) || mediaUrlService.getStoryImageUrl(item.cover_image_id, 400);
  }

  const thumbnailId = item.thumbnail_id || item.video_id || parseMediaIds(item.video_ids)[0];
  if (thumbnailId) {
    const candidate = httpUrl(thumbnailId) || mediaUrlService.getVideoThumbnail(thumbnailId, {
      width: 400,
      height: 400,
      time: "0",
    });
    if (candidate) return candidate;
  }

  const fallback = item.thumbnail_url || item.cover_url || item.preview || item.poster;
  if (fallback) return httpUrl(fallback) || String(fallback);

  if (item.video_metadata) {
    const { thumbnail_url, poster, preview, poster_url } = item.video_metadata;
    return httpUrl(thumbnail_url || poster || preview || poster_url);
  }

  return null;
};
// ── Robust ID resolvers ───────────────────────────────────────────────────────

const resolveTargetId = (user) =>
  user?.id         ||
  user?.user_id    ||
  user?.userId     ||
  user?.profile_id ||
  null;

const resolveMyId = (cu) =>
  cu?.id      ||
  cu?.uid     ||
  cu?.userId  ||
  cu?.user_id ||
  null;

// ── Tier badge pill ───────────────────────────────────────────────────────────

const TierBadgePill = ({ tier, paymentStatus }) => {
  const b = getTierBadge(tier, paymentStatus);
  if (!b) return null;
  return (
    <span style={{
      display:      "inline-flex",
      alignItems:   "center",
      gap:          4,
      padding:      "2px 8px",
      borderRadius: 20,
      fontSize:     10,
      fontWeight:   800,
      color:        b.color,
      background:   `${b.color}18`,
      border:       `1px solid ${b.color}35`,
      boxShadow:    `0 0 6px ${b.glow}`,
      flexShrink:   0,
      transition:   "color 0.4s ease, background 0.4s ease, border-color 0.4s ease",
    }}>
      {b.emoji} {b.label}
    </span>
  );
};

// ── Content grid card ─────────────────────────────────────────────────────────

const ContentCard = ({ item, type }) => {
  const imgUrl = resolveMediaThumbnail(item);

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      background:   "rgba(255,255,255,0.04)",
      border:       "1px solid rgba(255,255,255,0.07)",
      aspectRatio:  "1", position: "relative",
    }}>
      {imgUrl ? (
        <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(132,204,22,0.05)",
        }}>
          {type === "reel"   ? <Film     size={22} color="#84cc16" opacity={0.3} />
           : type === "story" ? <BookOpen size={22} color="#84cc16" opacity={0.3} />
           :                    <Image   size={22} color="#84cc16" opacity={0.3} />}
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 100%)",
        padding: "5px 5px 4px", display: "flex", gap: 6,
        fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: 600,
      }}>
        {item.likes > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Heart size={8} /> {fmt(item.likes)}
          </span>
        )}
        {item.views > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Eye size={8} /> {fmt(item.views)}
          </span>
        )}
      </div>

      {type === "reel" && (
        <div style={{
          position: "absolute", top: 5, right: 5,
          background: "rgba(0,0,0,0.5)", borderRadius: 4,
          padding: "1px 4px", fontSize: 8, color: "#fff", fontWeight: 700,
        }}>▶</div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// UserProfileModal
// ══════════════════════════════════════════════════════════════════════════════

const UserProfileModal = ({ user, currentUser, onClose }) => {
  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [activeTab,      setActiveTab]      = useState("posts");
  const [posts,          setPosts]          = useState([]);
  const [reels,          setReels]          = useState([]);
  const [stories,        setStories]        = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [verificationItems, setVerificationItems] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [stats,          setStats]          = useState({
    posts: 0, reels: 0, stories: 0, followers: 0, following: 0,
  });

  const mounted = useRef(true);

  // ── ID resolution ─────────────────────────────────────────────────────────
  const targetId = resolveTargetId(user);
  const myId     = resolveMyId(currentUser);

  // String-compare — never rely on reference equality for UUIDs
  const isOwn        = !!(myId && targetId && String(myId) === String(targetId));
  const showFollowBtn = !!myId && !isOwn;

  // ── Live boost tier ───────────────────────────────────────────────────────
  const { tier: liveTier, themeId: liveThemeId, loading: boostLoading } =
    useUserBoostTier(targetId);

  // Prop values (already resolved by ProfilePreview) serve as instant hints
  const propTier    = user?.subscription_tier ?? null;
  const propThemeId = user?.boost_selections?.themeId ?? null;

  const tier    = boostLoading ? propTier    : (liveTier    ?? null);
  const themeId = boostLoading ? propThemeId : (liveThemeId ?? null);

  const hasBoosted = ["silver", "gold", "diamond"].includes(tier);
  const nameColor  = hasBoosted ? getTierColor(tier, themeId) : "#ffffff";
  const dashboard = buildPublicProfileDashboard(profile, verificationItems);
  const selectedSectionData = dashboard.sections.find((section) => section.id === selectedSection) || null;
  const verifiedCount = verificationItems.filter((item) => item?.verified).length;
  const highTrustCount = verificationItems.filter((item) => {
    const level = item?.metadata?.verificationLevel || item?.metadata?.verification_level;
    return item?.verified && (level === "high" || level === "critical");
  }).length;
  const sourceCount = new Set(verificationItems.map((item) => item?.provider).filter(Boolean)).size;
  const sectionIconMap = {
    bio: ShieldCheck,
    socials: Users,
    portfolio: Briefcase,
    reports: FileText,
    comments: MessageSquare,
    replies: MessageCircleReply,
    likes: ThumbsUp,
  };
  const glowColor  = hasBoosted ? `${nameColor}50` : "transparent";
  const v          = hasBoosted ? BOOST_VISUAL?.[tier] : null;

  // ── Follow button inline style ────────────────────────────────────────────
  const followBtnStyle = (() => {
    if (isFollowing) {
      return hasBoosted
        ? {
            background: `${nameColor}14`,
            border:     `1.5px solid ${nameColor}40`,
            color:      nameColor,
            boxShadow:  "none",
          }
        : {
            background: "rgba(132,204,22,0.08)",
            border:     "1.5px solid rgba(132,204,22,0.28)",
            color:      "#84cc16",
            boxShadow:  "none",
          };
    }
    if (hasBoosted && v?.grad) {
      return {
        background: `linear-gradient(135deg, ${v.grad[0]}, ${v.grad[1]})`,
        border:     "none",
        color:      "#000",
        boxShadow:  `0 6px 24px ${v.glow ?? nameColor + "55"}`,
      };
    }
    return {
      background: "linear-gradient(135deg,#84cc16,#65a30d)",
      border:     "none",
      color:      "#000",
      boxShadow:  "0 6px 24px rgba(132,204,22,0.38)",
    };
  })();

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    if (targetId) loadProfile();
    return () => { mounted.current = false; };
  }, [targetId]); // eslint-disable-line

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_id,bio,verified,is_pro,payment_status,created_at")
        .eq("id", targetId)
        .maybeSingle();

      const raw = p || {};

      // Build avatar URL — DB record wins, then try every prop shape callers pass
      let avatarUrl = null;
      if (raw.avatar_id) {
        const base = mediaUrlService.getAvatarUrl(raw.avatar_id, 300);
        if (base && typeof base === "string") {
          const clean = base.split("?")[0];
          avatarUrl = clean.includes("supabase")
            ? `${clean}?quality=100&width=300&height=300&resize=cover&format=webp`
            : base;
        }
      } else {
        const fallback =
          user?.avatar     ||
          user?.avatar_url ||
          user?.avatarUrl  ||
          null;
        if (fallback && typeof fallback === "string" && fallback.startsWith("http")) {
          avatarUrl = fallback;
        }
      }

      if (mounted.current)
        setProfile({
          id:            targetId,
          fullName:      raw.full_name || user?.full_name || user?.name || user?.author || "Unknown",
          username:      raw.username  || user?.username  || "unknown",
          avatarUrl,
          bio:           raw.bio       || null,
          verified:      raw.verified  || user?.verified  || false,
          isPro:         raw.is_pro    || false,
          joinDate:      raw.created_at
            ? new Date(raw.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : null,
          paymentStatus: raw.payment_status ?? user?.payment_status ?? "pending",
        });

      // Parallel counts + follow status
      const [postsR, reelsR, storiesR, followersR, followingR, evidenceR] =
        await Promise.allSettled([
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", targetId).is("deleted_at", null),
          supabase.from("reels").select("*", { count: "exact", head: true }).eq("user_id", targetId).is("deleted_at", null),
          supabase.from("stories").select("*", { count: "exact", head: true }).eq("user_id", targetId).is("deleted_at", null),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id",  targetId),
          supabase.from("evidence_items").select("*").eq("profile_id", targetId).order("created_at", { ascending: false }).limit(50),
        ]);

      if (mounted.current) {
        setStats({
          posts:     postsR.status     === "fulfilled" ? (postsR.value.count     ?? 0) : 0,
          reels:     reelsR.status     === "fulfilled" ? (reelsR.value.count     ?? 0) : 0,
          stories:   storiesR.status   === "fulfilled" ? (storiesR.value.count   ?? 0) : 0,
          followers: followersR.status === "fulfilled" ? (followersR.value.count ?? 0) : 0,
          following: followingR.status === "fulfilled" ? (followingR.value.count ?? 0) : 0,
        });
        setVerificationItems(Array.isArray(evidenceR?.value?.data) ? evidenceR.value.data : []);
      }

      // Follow status — only when viewing another user
      if (myId && targetId && String(myId) !== String(targetId)) {
        followService
          .isFollowing(myId, targetId)
          .then((res) => { if (mounted.current) setIsFollowing(!!res); })
          .catch(() => {});
      }

      loadContent("posts");
    } catch (e) {
      console.warn("[UserProfileModal]", e?.message);
    } finally {
      if (mounted.current) {
        setVerificationLoading(false);
        setLoading(false);
      }
    }
  };

  const loadContent = async (tab) => {
    setContentLoading(true);
    try {
      if (tab === "posts") {
        const { data } = await supabase
          .from("posts")
          .select("id,content,image_ids,video_ids,likes,views,comments_count,created_at")
          .eq("user_id", targetId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(12);
        if (mounted.current) setPosts(data || []);
      } else if (tab === "reels") {
        const { data } = await supabase
          .from("reels")
          .select("id,caption,thumbnail_id,video_id,likes,views,comments_count,created_at")
          .eq("user_id", targetId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(12);
        if (mounted.current) setReels(data || []);
      } else {
        const { data } = await supabase
          .from("stories")
          .select("id,title,cover_image_id,likes,views,comments_count,created_at")
          .eq("user_id", targetId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(12);
        if (mounted.current) setStories(data || []);
      }
    } catch (e) {
      console.warn("[UserProfileModal] content:", e?.message);
    } finally {
      if (mounted.current) setContentLoading(false);
    }
  };

  const handleTabChange = (tab) => { setActiveTab(tab); loadContent(tab); };

  const handleFollow = useCallback(async (e) => {
    e.stopPropagation();
    if (!myId || isOwn || followLoading) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowLoading(true);
    setStats((s) => ({ ...s, followers: s.followers + (next ? 1 : -1) }));
    try {
      if (next) await followService.followUser(myId, targetId);
      else      await followService.unfollowUser(myId, targetId);
    } catch {
      setIsFollowing(!next);
      setStats((s) => ({ ...s, followers: s.followers + (next ? -1 : 1) }));
    } finally {
      if (mounted.current) setFollowLoading(false);
    }
  }, [myId, targetId, isOwn, isFollowing, followLoading]);

  const currentContent =
    activeTab === "posts" ? posts : activeTab === "reels" ? reels : stories;

  // ── Render ────────────────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <div
      className="upm-bd"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="upm-sheet">
        {loading ? (
          <div className="upm-load">
            <div className="upm-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <>
            {/* ── Boost background header ── */}
            <BoostProfileCard
              tier={hasBoosted ? tier : null}
              themeId={themeId}
              style={{ borderRadius: "20px 20px 0 0", position: "relative" }}
            >
              <button className="upm-close" onClick={onClose}>
                <X size={16} />
              </button>

              <div className="upm-hdr">
                {/* Avatar */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <BoostAvatarRing
                    userId={targetId}
                    tier={hasBoosted ? tier : null}
                    themeId={hasBoosted ? themeId : null}
                    size={84}
                    src={
                      profile?.avatarUrl &&
                      (profile.avatarUrl.startsWith("http") || profile.avatarUrl.startsWith("blob:"))
                        ? profile.avatarUrl
                        : null
                    }
                    letter={(profile?.fullName || "U").charAt(0).toUpperCase()}
                    showBadge={hasBoosted}
                    badgeSize="md"
                    borderRadius="circle"
                  />
                </div>

                {/* Name */}
                <h2
                  className="upm-name"
                  style={{
                    color:      nameColor,
                    textShadow: hasBoosted
                      ? `0 0 28px ${glowColor}, 0 0 56px ${glowColor}80`
                      : "none",
                    transition: "color 0.4s ease, text-shadow 0.4s ease",
                  }}
                >
                  {profile?.fullName || "Unknown"}
                </h2>

                {/* Badges */}
                <div className="upm-badges">
                  {profile?.isPro && (
                    <span className="upm-b-pro"><Crown size={9} /> PRO</span>
                  )}
                  {profile?.verified && (
                    <span className="upm-b-ver"><Shield size={9} /> Verified</span>
                  )}
                  <TierBadgePill tier={tier} paymentStatus={profile?.paymentStatus} />
                </div>

                {/* Username */}
                <p
                  className="upm-uname"
                  style={{
                    color:      hasBoosted ? `${nameColor}80` : "rgba(255,255,255,0.5)",
                    transition: "color 0.4s ease",
                  }}
                >
                  @{profile?.username || "unknown"}
                </p>

                {profile?.bio     && <p className="upm-bio">{profile.bio}</p>}
                {profile?.joinDate && <p className="upm-join">Joined {profile.joinDate}</p>}
              </div>
            </BoostProfileCard>

            {/* ── Stats ── */}
            <div className="upm-stats">
              <div className="upm-stat">
                <span className="upm-sv">{fmt(stats.posts + stats.reels + stats.stories)}</span>
                <span className="upm-sl">Posts</span>
              </div>
              <div className="upm-sdiv" />
              <div className="upm-stat">
                <span className="upm-sv">{fmt(stats.followers)}</span>
                <span className="upm-sl">Followers</span>
              </div>
              <div className="upm-sdiv" />
              <div className="upm-stat">
                <span className="upm-sv">{fmt(stats.following)}</span>
                <span className="upm-sl">Following</span>
              </div>
            </div>

            {/* ── Follow / Unfollow button ── */}
            {showFollowBtn && (
              <div className="upm-follow-wrap">
                <button
                  className={`upm-fbtn${isFollowing ? " upm-fbtn--following" : ""}`}
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={followBtnStyle}
                >
                  {followLoading ? (
                    <Loader size={16} className="upm-spin-icon" />
                  ) : isFollowing ? (
                    <><UserCheck size={16} /><span>Following</span></>
                  ) : (
                    <><UserPlus size={16} /><span>Follow</span></>
                  )}
                </button>
              </div>
            )}

            <div style={{ margin: "16px 16px 0", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Verification Dashboard</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Open the full proof-driven dashboard from the profile.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDashboard(true);
                    setSelectedSection(null);
                  }}
                  style={{
                    border: "1px solid rgba(132,204,22,0.3)",
                    background: "rgba(132,204,22,0.12)",
                    color: "#84cc16",
                    borderRadius: 999,
                    padding: "10px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Open Dashboard
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(132,204,22,0.12)", color: "#84cc16", fontSize: 10, fontWeight: 800, border: "1px solid rgba(132,204,22,0.18)" }}>Verified {verifiedCount}</span>
                <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontSize: 10, fontWeight: 800, border: "1px solid rgba(96,165,250,0.18)" }}>High {highTrustCount}</span>
                <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontSize: 10, fontWeight: 800, border: "1px solid rgba(167,139,250,0.18)" }}>Sources {sourceCount}</span>
              </div>
            </div>

            {showDashboard ? (
              <div style={{ margin: "16px 16px 0", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Verification Dashboard</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{verificationLoading ? "Loading sections…" : "Tap a section to inspect verified evidence."}</div>
                  </div>
                  <button type="button" onClick={() => { setShowDashboard(false); setSelectedSection(null); }} style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f5f5f5", borderRadius: 999, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Close
                  </button>
                </div>

                {selectedSectionData ? (
                  <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{selectedSectionData.title}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{selectedSectionData.subtitle}</div>
                      </div>
                      <button type="button" onClick={() => setSelectedSection(null)} style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f5f5f5", borderRadius: 999, padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        Back
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#cfcfcf", marginBottom: 12 }}>{selectedSectionData.summary}</div>
                    {selectedSectionData.items.length === 0 ? (
                      <div style={{ padding: "12px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", color: "#8b8b8b", fontSize: 12 }}>No verified evidence found for this section yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {selectedSectionData.items.map((item) => (
                          <div key={item.id || item.title} style={{ padding: "12px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{item.title}</div>
                                <div style={{ fontSize: 11, color: "#8b8b8b", marginTop: 2 }}>{item.provider || "Unknown source"} · {item.evidence_type}</div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: item.verified ? "#84cc16" : "#9ca3af" }}>{item.verified ? "Verified" : "Tracked"}</div>
                            </div>
                            {item.summary ? <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 8 }}>{item.summary}</div> : null}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(132,204,22,0.14)", color: "#84cc16", fontSize: 10, fontWeight: 700, border: "1px solid rgba(132,204,22,0.22)" }}>{item.proofLabel}</span>
                              {item.verificationLevel ? <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontSize: 10, fontWeight: 700, border: "1px solid rgba(96,165,250,0.2)" }}>{String(item.verificationLevel).toUpperCase()} trust</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                    {dashboard.sections.map((section) => {
                      const Icon = sectionIconMap[section.id] || Sparkles;
                      return (
                        <button key={section.id} type="button" onClick={() => setSelectedSection(section.id)} style={{ textAlign: "left", borderRadius: 16, padding: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{section.title}</div>
                            <div style={{ width: 28, height: 28, borderRadius: 10, background: `${section.accent}16`, border: `1px solid ${section.accent}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={14} style={{ color: section.accent }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 8 }}>{section.subtitle}</div>
                          <div style={{ fontSize: 12, color: "#f5f5f5", fontWeight: 700 }}>{section.summary}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Tabs ── */}
            {!showDashboard && (
              <div className="upm-tabs">
                {[
                  { id: "posts",   icon: <Image    size={14} />, label: "Posts",   count: stats.posts   },
                  { id: "reels",   icon: <Film     size={14} />, label: "Reels",   count: stats.reels   },
                  { id: "stories", icon: <BookOpen size={14} />, label: "Stories", count: stats.stories },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`upm-tab${activeTab === t.id ? " active" : ""}`}
                    onClick={() => handleTabChange(t.id)}
                    style={
                      activeTab === t.id && hasBoosted
                        ? { color: nameColor, borderBottomColor: nameColor, background: `${nameColor}10` }
                        : {}
                    }
                  >
                    {t.icon}
                    <span>{t.label}</span>
                    {t.count > 0 && <span className="upm-tc">{fmt(t.count)}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* ── Content grid ── */}
            {!showDashboard && (
              <div className="upm-cnt">
                {contentLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 28 }}>
                    <div className="upm-spin-sm" />
                  </div>
                ) : currentContent.length > 0 ? (
                  <div className="upm-grid">
                    {currentContent.map((item) => (
                      <ContentCard
                        key={item.id}
                        item={item}
                        type={activeTab === "reels" ? "reel" : activeTab === "stories" ? "story" : "post"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="upm-empty">
                    {activeTab === "posts"  ? <Image    size={32} opacity={0.2} />
                    : activeTab === "reels" ? <Film     size={32} opacity={0.2} />
                    :                         <BookOpen size={32} opacity={0.2} />}
                    <p>No {activeTab} yet</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        /* ── Backdrop: near-transparent on desktop, no blur ── */
        .upm-bd {
          position:fixed; inset:0; z-index:10000;
          background:rgba(0,0,0,0.28);
          display:flex; align-items:center; justify-content:center;
          padding:20px 16px; animation:upmFI .2s ease;
        }

        /* ── Sheet: centered card on desktop ── */
        .upm-sheet {
          position:relative; width:100%; max-width:440px; max-height:90vh;
          overflow-y:auto; border-radius:20px; background:#0a0a0a;
          border:1px solid rgba(255,255,255,0.08);
          box-shadow:0 24px 80px rgba(0,0,0,.9);
          animation:upmSU .25s cubic-bezier(.34,1.4,.64,1); scrollbar-width:none;
        }
        .upm-sheet::-webkit-scrollbar { display:none; }

        /* ── Mobile: fullscreen bottom sheet ── */
        @media (max-width: 480px) {
          .upm-bd {
            padding:0;
            align-items:flex-end;
            background:rgba(0,0,0,0.55);
          }
          .upm-sheet {
            max-width:100%;
            width:100%;
            max-height:100dvh;
            height:100dvh;
            border-radius:0;
            border:none;
            box-shadow:none;
            animation:upmSUMobile .28s cubic-bezier(.34,1.2,.64,1);
          }
        }

        .upm-close {
          position:absolute; top:14px; right:14px; z-index:20;
          width:30px; height:30px; border-radius:50%;
          background:rgba(0,0,0,.45); backdrop-filter:blur(12px);
          border:1px solid rgba(255,255,255,.18); color:#fff;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all .15s;
        }
        .upm-close:hover { background:rgba(239,68,68,.25); border-color:rgba(239,68,68,.45); color:#ef4444; }
        .upm-load { padding:60px 24px; display:flex; flex-direction:column; align-items:center; gap:16px; color:#525252; font-size:13px; }
        .upm-spin { width:36px; height:36px; border:3px solid rgba(132,204,22,.2); border-top-color:#84cc16; border-radius:50%; animation:upmSpin .8s linear infinite; }
        .upm-spin-sm { width:22px; height:22px; border:2px solid rgba(132,204,22,.2); border-top-color:#84cc16; border-radius:50%; animation:upmSpin .8s linear infinite; }
        .upm-spin-icon { animation:upmSpin .7s linear infinite; flex-shrink:0; }
        .upm-hdr { padding:44px 24px 24px; text-align:center; position:relative; }
        .upm-name { font-size:22px; font-weight:900; margin:0 0 8px; line-height:1.2; }
        .upm-badges { display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
        .upm-b-pro { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:800; color:#fbbf24; background:rgba(251,191,36,.15); border:1px solid rgba(251,191,36,.35); }
        .upm-b-ver { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:800; color:#84cc16; background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.3); }
        .upm-uname { font-size:13px; font-weight:600; margin:0 0 10px; }
        .upm-bio { font-size:13px; color:#a3a3a3; line-height:1.5; margin:0 0 8px; max-width:320px; margin-left:auto; margin-right:auto; }
        .upm-join { font-size:11px; color:#525252; font-weight:500; margin:0; }
        .upm-stats { display:flex; align-items:stretch; background:rgba(255,255,255,.03); border-top:1px solid rgba(255,255,255,.06); border-bottom:1px solid rgba(255,255,255,.06); }
        .upm-stat { flex:1; padding:14px 8px; text-align:center; display:flex; flex-direction:column; gap:3; }
        .upm-sv { font-size:18px; font-weight:900; background:linear-gradient(135deg,#84cc16,#65a30d); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .upm-sl { font-size:10px; color:#737373; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
        .upm-sdiv { width:1px; margin:10px 0; background:rgba(255,255,255,.07); }
        .upm-follow-wrap { padding:16px 20px 4px; }
        .upm-fbtn {
          width:100%; padding:13px 20px; border-radius:14px;
          font-size:14px; font-weight:800; letter-spacing:0.02em;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
          transition:all .25s ease; font-family:inherit;
        }
        .upm-fbtn--following:hover {
          background:rgba(239,68,68,0.12) !important;
          border-color:rgba(239,68,68,0.40) !important;
          color:#ef4444 !important;
          box-shadow:none !important;
        }
        .upm-fbtn:disabled { opacity:.55; cursor:not-allowed; }
        .upm-tabs { display:flex; padding:14px 16px 0; gap:6px; }
        .upm-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:8px 6px; border-radius:10px 10px 0 0; font-size:12px; font-weight:700; font-family:inherit; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:all .18s; background:rgba(255,255,255,.03); color:#525252; }
        .upm-tab.active { background:rgba(132,204,22,.08); color:#84cc16; border-bottom-color:#84cc16; }
        .upm-tc { font-size:10px; padding:1px 5px; border-radius:8px; background:rgba(255,255,255,.07); color:#737373; }
        .upm-cnt { padding:10px 14px 20px; min-height:100px; }
        .upm-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
        .upm-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px; color:#525252; font-size:13px; }

        @keyframes upmFI       { from{opacity:0} to{opacity:1} }
        @keyframes upmSU       { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes upmSUMobile { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes upmSpin     { to{transform:rotate(360deg)} }
      `}</style>
    </div>,
    document.body
  );
};

export default UserProfileModal;