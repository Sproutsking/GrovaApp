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
import { getBoostNameDesign } from "../../services/boost/boostThemes";
import { buildPublicProfileDashboard } from "../../services/evidence/publicProfileDashboardModel";
import { createFirstPartyXeeviaEvidence } from "../../services/evidence/evidenceNormalizer";
import VerificationDashboardPage from "./VerificationDashboardPage";
import TierBadgePill from "../Shared/TierBadgePill";
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
  const isVideoUrl = (url) => /\/video\/upload\/|\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url || "");

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

  if (item.thumbnail_id) {
    const directThumbnail = httpUrl(item.thumbnail_id);
    if (directThumbnail && !isVideoUrl(directThumbnail)) return directThumbnail;
    if (!directThumbnail) {
      const candidate = mediaUrlService.getImageUrl(item.thumbnail_id, {
        width: 400,
        height: 400,
        crop: "fill",
        gravity: "auto",
        quality: "auto:good",
        format: "webp",
      });
      if (candidate) return candidate;
    }
  }

  const videoId = item.video_id || parseMediaIds(item.video_ids)[0];
  if (videoId) {
    const candidate = mediaUrlService.getVideoThumbnail(videoId, {
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

const resolveVideoUrl = (item) => {
  const value = item?.video_metadata?.url || item?.video_url || item?.video_id || parseMediaIds(item?.video_ids)[0];
  if (!value || typeof value !== "string") return null;
  if (/^https?:\/\//i.test(value)) return value;
  return mediaUrlService.getVideoUrl(value, { quality: "auto", format: "mp4" });
};

const isTextPost = (item) => {
  const hasTextFlag = item?.is_text_card === true || item?.is_text_card === "true" || item?.is_text_card === 1;
  const hasMedia = parseMediaIds(item?.image_ids).length > 0 || parseMediaIds(item?.video_ids).length > 0;
  return hasTextFlag || (!hasMedia && Boolean(item?.content || item?.card_caption));
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

// ── Content grid card ─────────────────────────────────────────────────────────

const ContentCard = ({ item, type }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const imgUrl = resolveMediaThumbnail(item);
  const textPost = type === "post" && isTextPost(item);
  const isVideo = type === "reel" || (type === "post" && parseMediaIds(item.video_ids).length > 0);
  const videoUrl = isVideo ? resolveVideoUrl(item) : null;
  const showVideo = isVideo && (!imgUrl || imageFailed) && videoUrl;

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      background:   "rgba(255,255,255,0.04)",
      border:       "1px solid rgba(255,255,255,0.07)",
      aspectRatio:  "1", position: "relative",
    }}>
      {textPost ? (
        <div style={{
          width: "100%", height: "100%", padding: 12, display: "flex",
          flexDirection: "column", justifyContent: "center", gap: 8,
          overflow: "hidden", textAlign: item.text_card_metadata?.align || "center",
          color: item.text_card_metadata?.textColor || "#fff",
          background: item.text_card_metadata?.gradient || "linear-gradient(145deg,#172554,#0f766e)",
          position: "relative", isolation: "isolate",
        }}>
          <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: ".12em", opacity: .7 }}>TEXT POST</span>
          <span style={{ fontSize: 13, lineHeight: 1.18, fontWeight: 800, textShadow: "0 2px 8px rgba(0,0,0,.35)" }}>
            {item.content || item.card_caption || "Text post"}
          </span>
        </div>
      ) : showVideo ? (
        <video
          src={videoUrl}
          poster={imgUrl || undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : imgUrl && !imageFailed ? (
        <img
          src={imgUrl}
          alt=""
          onError={() => setImageFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(132,204,22,0.05)",
        }}>
          {isVideo          ? <Film     size={22} color="#84cc16" opacity={0.3} />
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

const UserProfileModal = ({ user, currentUser, onClose, openVerificationDashboard = false, verificationRecord = null }) => {
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
  const [showDashboard, setShowDashboard] = useState(openVerificationDashboard);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [stats,          setStats]          = useState({
    posts: 0, reels: 0, stories: 0, followers: 0, following: 0,
  });

  const mounted = useRef(true);

  useEffect(() => {
    if (openVerificationDashboard) setShowDashboard(true);
  }, [openVerificationDashboard]);

  // ── ID resolution ─────────────────────────────────────────────────────────
  const targetId = resolveTargetId(user);
  const myId     = resolveMyId(currentUser);

  // String-compare — never rely on reference equality for UUIDs
  const isOwn        = !!(myId && targetId && String(myId) === String(targetId));
  const showFollowBtn = !!myId && !isOwn;

  // ── Live boost tier ───────────────────────────────────────────────────────
  const { tier: liveTier, themeId: liveThemeId, fontId: liveFontId, colorId: liveColorId, backgroundColorId: liveBackgroundColorId, loading: boostLoading } =
    useUserBoostTier(targetId);

  // Prop values (already resolved by ProfilePreview) serve as instant hints
  const propTier    = user?.subscription_tier ?? null;
  const propThemeId = user?.boost_selections?.themeId ?? null;
  const propFontId  = user?.boost_selections?.fontId ?? null;
  const propColorId = user?.boost_selections?.colorId ?? null;
  const propBackgroundColorId = user?.boost_selections?.backgroundColorId ?? null;

  const tier    = boostLoading ? propTier    : (liveTier    ?? null);
  const themeId = boostLoading ? propThemeId : (liveThemeId ?? null);
  const fontId  = boostLoading ? propFontId  : (liveFontId  ?? null);
  const colorId = boostLoading ? propColorId : (liveColorId ?? null);
  const backgroundColorId = boostLoading ? propBackgroundColorId : (liveBackgroundColorId ?? null);

  const hasBoosted = ["silver", "gold", "diamond"].includes(tier);
  const nameDesign = getBoostNameDesign(tier, fontId, colorId);
  const nameColor  = hasBoosted ? (nameDesign.color?.color ?? getTierColor(tier, themeId)) : "#ffffff";
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

  const dashboardPage = (
    <VerificationDashboardPage
      profile={profile}
      dashboard={dashboard}
      verificationItems={verificationItems}
      loading={verificationLoading}
      onBack={() => { setShowDashboard(false); setSelectedSection(null); }}
      onClose={onClose}
    />
  );

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
        avatarUrl = mediaUrlService.getOptimizedImageUrl(raw.avatar_id, {
          width: 300,
          height: 300,
          quality: "100",
          format: "webp",
          crop: "fill",
          gravity: "face",
        });
      } else {
        const fallback =
          user?.avatar     ||
          user?.avatar_url ||
          user?.avatarUrl  ||
          null;
        if (fallback && typeof fallback === "string" && fallback.startsWith("http")) {
          avatarUrl = mediaUrlService.getOptimizedImageUrl(fallback, {
            width: 300,
            height: 300,
            quality: "100",
            format: "webp",
            crop: "fill",
            gravity: "face",
          }) || fallback;
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

      // The profile shell should not wait for counts, evidence, or the first
      // content grid request before becoming interactive.
      if (mounted.current) {
        setLoading(false);
        loadContent("posts");
      }

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
        const storedEvidence = Array.isArray(evidenceR?.value?.data) ? evidenceR.value.data : [];
        const oracleEvidence = verificationRecord ? [{
          id: `xrc-${verificationRecord.record_id}`,
          title: verificationRecord.payload?.event || "XRC verification record",
          summary: `Verified ${verificationRecord.stream_type || "XRC"} record ${verificationRecord.record_id || ""}`,
          provider: "XRC Oracle",
          evidence_type: "verification",
          verified: true,
          metadata: { proofType: "credential", verificationLevel: "high", record_id: verificationRecord.record_id, stream_type: verificationRecord.stream_type },
          url: null,
          created_at: verificationRecord.created_at || null,
        }] : [];
        const firstParty = createFirstPartyXeeviaEvidence({
          id: targetId,
          fullName: raw.full_name || user?.full_name || user?.name || user?.author,
          username: raw.username || user?.username,
          avatarUrl,
          bio: raw.bio,
        });
        const externalEvidence = storedEvidence.filter((item) => String(item?.provider || "").toLowerCase() !== "xeevia");
        setVerificationItems([...(firstParty ? [firstParty] : []), ...oracleEvidence, ...externalEvidence]);
      }

      // Follow status — only when viewing another user
      if (myId && targetId && String(myId) !== String(targetId)) {
        followService
          .isFollowing(myId, targetId)
          .then((res) => { if (mounted.current) setIsFollowing(!!res); })
          .catch(() => {});
      }

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
      const result = next
        ? await followService.followUser(myId, targetId)
        : await followService.unfollowUser(myId, targetId);
      if (result?.success === false) {
        setIsFollowing(!next);
        setStats((s) => ({ ...s, followers: s.followers + (next ? -1 : 1) }));
      }
    } catch {
      setIsFollowing(!next);
      setStats((s) => ({ ...s, followers: s.followers + (next ? -1 : 1) }));
    } finally {
      if (mounted.current) setFollowLoading(false);
    }
  }, [myId, targetId, isOwn, isFollowing, followLoading]);

  const handleMessage = useCallback((e) => {
    e.stopPropagation();
    if (!myId || isOwn || !targetId) return;
    window.dispatchEvent(new CustomEvent("community:open-dm", {
      detail: { userId: targetId },
    }));
    onClose?.();
  }, [myId, isOwn, targetId, onClose]);

  const currentContent =
    activeTab === "posts" ? posts : activeTab === "reels" ? reels : stories;

  // ── Render ────────────────────────────────────────────────────────────────
  return showDashboard ? dashboardPage : ReactDOM.createPortal(
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
              backgroundColorId={backgroundColorId}
              embedded
              style={{ borderRadius: "20px 20px 0 0", position: "relative", width: "100%", minHeight: 0, maxHeight: "calc(100vh - 240px)" }}
            >
              <button className="upm-close" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}>
                <X size={16} />
              </button>

              <div className="upm-hdr" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%)", backdropFilter: "blur(8px)" }}>
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
                    showBadge={false}
                    badgeSize="md"
                    borderRadius="circle"
                  />
                </div>

                {/* Name */}
                <h2
                  className="upm-name"
                  style={{
                    color:      nameColor,
                    ...(nameDesign.color?.gradient ? {
                      backgroundImage: nameDesign.color.gradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      backgroundSize: "220% 100%",
                      animation: "upmNameGradient 6s linear infinite",
                    } : {}),
                    fontFamily: nameDesign.font?.family,
                    fontWeight: nameDesign.font?.weight || 900,
                    letterSpacing: nameDesign.font?.spacing,
                    textShadow: hasBoosted
                      ? `0 0 28px ${glowColor}, 0 0 56px ${glowColor}80`
                      : "none",
                    transition: "color 0.4s ease, text-shadow 0.4s ease",
                  }}
                >
                  {profile?.fullName || "Unknown"}
                  {(profile?.verified || hasBoosted) && <span className="upm-name-verified" aria-label="Verified account">✓</span>}
                </h2>

                {/* Badges */}
                <div className="upm-badges">
                  {profile?.isPro && (
                    <span className="upm-b-pro"><Crown size={9} /> PRO</span>
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
                <button
                  className="upm-fbtn upm-message-btn"
                  onClick={handleMessage}
                  type="button"
                >
                  <MessageSquare size={16} />
                  <span>Message</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowDashboard(true);
                setSelectedSection(null);
              }}
              style={{
                margin: "16px 16px 0",
                width: "calc(100% - 32px)",
                borderRadius: 18,
                border: "1px solid rgba(168,85,247,0.25)",
                background: "radial-gradient(circle at top left, rgba(168,85,247,0.18), transparent 28%), linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                cursor: "pointer",
                color: "#fff",
                borderColor: "rgba(168,85,247,0.35)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(168,85,247,0.16)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ShieldCheck size={18} color="#d8b4fe" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Verification Dashboard</div>
                  <div style={{ fontSize: 11, color: "#c4b5fd", marginTop: 2 }}>Open the full proof-driven dashboard from the profile.</div>
                </div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                Open
                <ArrowLeft size={12} style={{ transform: "rotate(180deg)" }} />
              </div>
            </button>

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
          position:fixed; top:34px; right:26px; z-index:10001;
          width:32px; height:32px; border-radius:50%;
          background:rgba(0,0,0,.65); backdrop-filter:blur(12px);
          border:1.5px solid rgba(255,255,255,.28); color:#fff;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all .15s; pointer-events:auto; padding:0;
        }
        .upm-close:hover { background:rgba(239,68,68,.35); border-color:rgba(239,68,68,.55); color:#ef4444; }
        @media (max-width: 480px) {
          .upm-close { top:16px; right:16px; }
        }
        .upm-load { padding:60px 24px; display:flex; flex-direction:column; align-items:center; gap:16px; color:#525252; font-size:13px; }
        .upm-spin { width:36px; height:36px; border:3px solid rgba(132,204,22,.2); border-top-color:#84cc16; border-radius:50%; animation:upmSpin .8s linear infinite; }
        .upm-spin-sm { width:22px; height:22px; border:2px solid rgba(132,204,22,.2); border-top-color:#84cc16; border-radius:50%; animation:upmSpin .8s linear infinite; }
        .upm-spin-icon { animation:upmSpin .7s linear infinite; flex-shrink:0; }
        .upm-hdr { padding:44px 24px 24px; text-align:center; position:relative; width:100%; display:flex; flex-direction:column; border-radius:20px 20px 0 0; overflow:hidden; }
        .upm-name { font-size:22px; font-weight:900; margin:0 0 8px; line-height:1.2; display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,0.6); }
        .upm-name-verified { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#84cc16; color:#071007; font-size:12px; font-weight:900; line-height:1; }
        .upm-badges { display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
        .upm-b-pro { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:800; color:#fbbf24; background:rgba(251,191,36,.2); border:1px solid rgba(251,191,36,.45); }
        .upm-b-ver { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:800; color:#84cc16; background:rgba(132,204,22,.15); border:1px solid rgba(132,204,22,.4); }
        .upm-uname { font-size:13px; font-weight:600; margin:0 0 10px; color:#e5e5e5; text-shadow:0 1px 8px rgba(0,0,0,0.5); }
        .upm-bio { font-size:13px; color:#d1d1d1; line-height:1.5; margin:0 0 8px; max-width:320px; margin-left:auto; margin-right:auto; text-shadow:0 1px 6px rgba(0,0,0,0.5); }
        .upm-join { font-size:11px; color:#b3b3b3; font-weight:500; margin:0; text-shadow:0 1px 4px rgba(0,0,0,0.4); }
        .upm-stats { display:flex; align-items:stretch; margin:0 16px; padding:4px; border-radius:18px; background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.1); box-shadow:inset 0 1px rgba(255,255,255,.06),0 8px 22px rgba(0,0,0,.18); backdrop-filter:blur(14px); overflow:hidden; }
        .upm-stat { flex:1; padding:12px 8px; text-align:center; display:flex; flex-direction:column; gap:3px; border-radius:13px; }
        .upm-stat:hover { background:rgba(255,255,255,.035); }
        .upm-sv { font-size:18px; font-weight:900; background:linear-gradient(135deg,#84cc16,#65a30d); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .upm-sl { font-size:10px; color:#737373; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
        .upm-sdiv { width:1px; margin:10px 0; background:rgba(255,255,255,.07); }
        .upm-follow-wrap { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:14px 20px 4px; }
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
        .upm-message-btn { background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.16); color:#e5e7eb; box-shadow:inset 0 1px rgba(255,255,255,.06); }
        .upm-message-btn:hover { background:rgba(96,165,250,.12); border-color:rgba(96,165,250,.5); color:#93c5fd; box-shadow:0 0 18px rgba(96,165,250,.16); }
        .upm-tabs { display:flex; padding:14px 16px 0; gap:6px; }
        .upm-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:8px 6px; border-radius:10px 10px 0 0; font-size:12px; font-weight:700; font-family:inherit; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:all .18s; background:rgba(255,255,255,.03); color:#525252; }
        .upm-tab.active { background:rgba(132,204,22,.08); color:#84cc16; border-bottom-color:#84cc16; }
        .upm-tc { font-size:10px; padding:1px 5px; border-radius:8px; background:rgba(255,255,255,.07); color:#737373; }
        .upm-cnt { padding:10px 14px 20px; min-height:100px; }
        .upm-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
        .upm-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px; color:#525252; font-size:13px; }

        @media (max-width: 480px) {
          .upm-stats { margin:0 12px; }
          .upm-follow-wrap { padding-left:16px; padding-right:16px; }
        }

        @keyframes upmFI       { from{opacity:0} to{opacity:1} }
        @keyframes upmSU       { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes upmSUMobile { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes upmSpin     { to{transform:rotate(360deg)} }
        @keyframes upmNameGradient { from{background-position:0% 50%} to{background-position:220% 50%} }
      `}</style>
    </div>,
    document.body
  );
};

export default UserProfileModal;