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
  X, UserPlus, UserCheck, Loader, Gift,
  Crown, Image, Film, BookOpen, Heart, Eye, Clock3,
  Bookmark, Settings, ExternalLink, UserRound, UsersRound, Globe2,
  Home, Search, PlusSquare, Wallet, MapPin, Share2,
  Flame, TrendingUp,
} from "lucide-react";
import { supabase }          from "../../services/config/supabase";
import mediaUrlService       from "../../services/shared/mediaUrlService";
import followService         from "../../services/social/followService";
import { BOOST_VISUAL, getBoostVisualForTheme } from "../../services/account/profileTierService";
import BoostProfileCard      from "../Boost/BoostProfileCard";
import BoostAvatarRing       from "../Shared/BoostAvatarRing";
import PostCard              from "../Home/PostCard";
import ReelCard              from "../Home/ReelCard";
import StoryCard             from "../Home/StoryCard";
import { useUserBoostTier }  from "../../hooks/useUserBoostTier";
import { getBoostNameDesign } from "../../services/boost/boostThemes";
import { buildPublicProfileDashboard } from "../../services/evidence/publicProfileDashboardModel";
import { createFirstPartyXeeviaEvidence } from "../../services/evidence/evidenceNormalizer";
import { formatProfileTag, normalizeProfileTags } from "../../services/account/profileTags";
import ProfileEditModal from "../Account/ProfileEditModal";
import trendingService from "../../services/feed/trendingService";
import VerificationDashboardPage from "./VerificationDashboardPage";
import XRDProfileDashboard from "./XRDProfileDashboard";
import TierBadgePill from "../Shared/TierBadgePill";
import { VerifiedBadgeSeal } from "../Shared/VerifiedBadges";
import {
  Briefcase, FileText, MessageCircleReply, ThumbsUp, Sparkles,
  BadgeCheck, ShieldCheck, Users, MessageSquare,
  ChevronRight, Edit3,
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

const ProfilePeopleStack = ({ kind, people, total, loading, onOpen }) => {
  const label = kind === "following" ? "Following" : "Followers";
  const visiblePeople = [...people]
    .sort((left, right) => {
      const verifiedDelta = Number(Boolean(right.profiles?.verified)) - Number(Boolean(left.profiles?.verified));
      if (verifiedDelta) return verifiedDelta;
      return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
    })
    .slice(0, 4);
  const names = visiblePeople
    .slice(0, 3)
    .map((item) => item.profiles?.full_name || item.profiles?.username)
    .filter(Boolean);
  const remaining = Math.max(0, total - names.length);

  return (
    <button
      type="button"
      className="upm-people-card"
      onClick={() => onOpen(kind)}
      aria-label={`${label}: ${fmt(total)} people`}
    >
      <span className="upm-people-faces" aria-hidden="true">
        {visiblePeople.map((item, index) => {
          const person = item.profiles || {};
          const avatar = mediaUrlService.resolveAvatarUrl(person.avatar_id, 80);
          const size = 26 + Math.round(8 * (index / Math.max(visiblePeople.length - 1, 1)));
          return (
            <span className={`upm-people-avatar${index === visiblePeople.length - 1 ? " is-front" : ""}`} key={item.follower_id || item.following_id || person.id || index} style={{ "--avatar-size": `${size}px`, "--avatar-order": index, "--avatar-brightness": (0.6 + 0.4 * (index / Math.max(visiblePeople.length - 1, 1))).toFixed(2) }} title={`${person.full_name || person.username || "Member"}${person.verified ? " · Verified" : ""}`}>
              {avatar
                ? <img src={avatar} alt="" />
                : (person.full_name || person.username || "?").charAt(0).toUpperCase()}
              {person.verified && <span className="upm-people-verified"><BadgeCheck size={12} /></span>}
            </span>
          );
        })}
      </span>
      <span className="upm-people-copy">
        <span className="upm-people-title"><strong>{fmt(total)}</strong><small>{label}</small></span>
        <span className="upm-people-names">
          {names.length
            ? `${names.join(", ")}${remaining ? ` +${fmt(remaining)}` : ""}`
            : loading ? "Loading people…" : "No people yet"}
        </span>
      </span>
      <span className="upm-people-open" aria-hidden="true"><ChevronRight size={15} /></span>
    </button>
  );
};

const ProfileSidebarAccordion = ({ id, title, isOpen, onToggle, actions, children, className = "" }) => (
  <section className={`upm-sidebar-block upm-sidebar-accordion${isOpen ? " is-expanded" : ""}${className ? ` ${className}` : ""}`}>
    <div className="upm-sidebar-accordion-head">
      <button
        type="button"
        className="upm-sidebar-accordion-toggle"
        aria-expanded={isOpen}
        aria-controls={`upm-sidebar-${id}`}
        onClick={onToggle}
      >
        <span className="upm-sidebar-label">{title}</span>
        <ChevronRight size={13} aria-hidden="true" />
      </button>
      {actions}
    </div>
    <div className="upm-sidebar-accordion-content" id={`upm-sidebar-${id}`}>
      {children}
    </div>
  </section>
);

const resolveMyId = (cu) =>
  cu?.id      ||
  cu?.uid     ||
  cu?.userId  ||
  cu?.user_id ||
  null;
const FullProfileContent = ({ item, type, profile, currentUser }) => {
  const content = {
    ...item,
    author: item.author || profile?.fullName || "Unknown",
    username: item.username || profile?.username || "unknown",
    profiles: item.profiles || {
      full_name: profile?.fullName || "Unknown",
      username: profile?.username || "unknown",
      avatar_id: profile?.avatarId || null,
      verified: profile?.verified || false,
    },
  };

  if (type === "reel") {
    return <ReelCard reel={content} currentUser={currentUser} index={0} />;
  }
  if (type === "story") {
    return <StoryCard story={content} currentUser={currentUser} />;
  }
  return <PostCard post={content} currentUser={currentUser} />;
};

// ══════════════════════════════════════════════════════════════════════════════
// UserProfileModal
// ══════════════════════════════════════════════════════════════════════════════

const UserProfileModal = ({ user, currentUser, onClose, openVerificationDashboard = false, verificationRecord = null, presentation = "modal" }) => {
  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [isFollowing,    setIsFollowing]    = useState(false);
  const [followLoading,  setFollowLoading]  = useState(false);
  const [activeTab,      setActiveTab]      = useState("posts");
  const [contentFilter,  setContentFilter]  = useState("momentum");
  const [posts,          setPosts]          = useState([]);
  const [reels,          setReels]          = useState([]);
  const [stories,        setStories]        = useState([]);
  const [replies,        setReplies]        = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [verificationItems, setVerificationItems] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showDashboard, setShowDashboard] = useState(openVerificationDashboard);
  const [showXRD, setShowXRD] = useState(false);
  const [initialXRDSection, setInitialXRDSection] = useState("Overview");
  const [selectedContent, setSelectedContent] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [stats,          setStats]          = useState({
    posts: 0, reels: 0, stories: 0, followers: 0, following: 0,
  });
  const [profileCommunities, setProfileCommunities] = useState([]);
  const [connectionPreviews, setConnectionPreviews] = useState({ followers: [], following: [] });
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionList, setConnectionList] = useState(null);
  const [connectionListLoading, setConnectionListLoading] = useState(false);
  const [ambassadorData, setAmbassadorData] = useState(null);
  const [linkedNetworks, setLinkedNetworks] = useState([]);
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [topStreamers, setTopStreamers] = useState([]);
  const [similarCreators, setSimilarCreators] = useState([]);
  const [creatorRailLoading, setCreatorRailLoading] = useState(true);
  const [selectedRailProfile, setSelectedRailProfile] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [expandedSidebarCard, setExpandedSidebarCard] = useState(null);

  const mounted = useRef(true);
  const profileLoadSequence = useRef(0);

  useEffect(() => {
    if (openVerificationDashboard) setShowDashboard(true);
  }, [openVerificationDashboard]);

  useEffect(() => {
    let active = true;
    trendingService.getTrendingTopics(6)
      .then((topics) => {
        if (active) setTrendingTopics(topics || []);
      })
      .catch((error) => {
        console.error("[UserProfileModal] Could not load trending topics:", error);
      })
      .finally(() => {
        if (active) setTrendingLoading(false);
      });
    return () => { active = false; };
  }, []);

  // ── ID resolution ─────────────────────────────────────────────────────────
  const targetId = resolveTargetId(user);
  const myId     = resolveMyId(currentUser);

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    const loadTopStreamers = async () => {
      const { data, error } = await supabase
          .from("live_sessions")
          .select("user_id,peak_viewers,profiles:user_id(id,full_name,username,avatar_id,verified)")
          .eq("is_private", false)
          .not("user_id", "is", null)
          .order("peak_viewers", { ascending: false })
          .limit(40);
      if (error) throw error;

      const streamsByUser = new Map();
      (data || []).forEach((session) => {
        const person = session.profiles;
        if (!person?.id || person.id === targetId) return;
        const existing = streamsByUser.get(person.id);
        if (existing) {
          existing.peakViewers = Math.max(existing.peakViewers, Number(session.peak_viewers) || 0);
        } else {
          streamsByUser.set(person.id, {
            profile: person,
            peakViewers: Number(session.peak_viewers) || 0,
          });
        }
      });
      return [...streamsByUser.values()].slice(0, 3);
    };

    const loadSimilarCreators = async () => {
      if (!profile?.profileTags?.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_id,verified,profile_tags")
        .neq("id", targetId)
        .overlaps("profile_tags", profile.profileTags)
        .limit(4);
      if (error) throw error;
      return data || [];
    };

    setCreatorRailLoading(true);
    Promise.allSettled([loadTopStreamers(), loadSimilarCreators()])
      .then(([streamersResult, creatorsResult]) => {
        if (!active) return;
        if (streamersResult.status === "fulfilled") {
          setTopStreamers(streamersResult.value);
        } else {
          console.error("[UserProfileModal] Could not load top streamers:", streamersResult.reason);
          setTopStreamers([]);
        }
        if (creatorsResult.status === "fulfilled") {
          setSimilarCreators(creatorsResult.value);
        } else {
          console.error("[UserProfileModal] Could not load similar creators:", creatorsResult.reason);
          setSimilarCreators([]);
        }
      })
      .finally(() => {
        if (active) setCreatorRailLoading(false);
      });
    return () => { active = false; };
  }, [targetId, profile?.profileTags, loading]);

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
  const profileFields = [profile?.fullName, profile?.username, profile?.avatarUrl, profile?.bio, profile?.profileTags?.length, profile?.joinDate];
  const profileCompleteness = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const publicSocialLinks = Object.entries(profile?.socialLinks || {})
    .filter(([, value]) => typeof value === "string" && /^https?:\/\//i.test(value))
    .map(([provider, url]) => ({ provider, url }));
  const evidenceProfileLinks = verificationItems
    .filter((item) => typeof item?.url === "string" && /^https?:\/\//i.test(item.url))
    .map((item) => ({ provider: item.provider || "External profile", url: item.url }));
  const visibleNetworks = isOwn
    ? [...linkedNetworks.map((item) => ({ provider: item.provider, status: item.auth_status })), ...publicSocialLinks]
    : evidenceProfileLinks;
  const evidenceSourcesCount = new Set(verificationItems.map((item) => item?.provider).filter(Boolean)).size;
  const institutionCount = new Set(verificationItems
    .filter((item) => ["institution", "organization"].includes(String(
      item?.entity_type || item?.entityType || item?.metadata?.entityType || item?.metadata?.entity_type || "",
    ).toLowerCase()))
    .map((item) => item?.provider || item?.metadata?.institution || item?.title)
    .filter(Boolean)).size;
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
  const coverVisual = hasBoosted
    ? (getBoostVisualForTheme(tier, themeId) || v)
    : null;
  const coverStyle = coverVisual ? {
    "--cover-accent": getTierColor(tier, themeId) || coverVisual.color,
    "--cover-glow": coverVisual.glow || glowColor,
  } : undefined;

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
            background: `${nameColor}24`,
            border:     `1.5px solid ${nameColor}A0`,
            color:      nameColor,
            boxShadow:  `0 4px 16px ${nameColor}30`,
          }
        : {
            background: "linear-gradient(135deg,rgba(132,204,22,.22),rgba(16,185,129,.13))",
            border:     "1.5px solid rgba(163,230,53,.72)",
            color:      "#d9f99d",
            boxShadow:  "0 4px 16px rgba(132,204,22,.18)",
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
    const requestId = ++profileLoadSequence.current;
    setProfile(null);
    setVerificationItems([]);
    setVerificationLoading(Boolean(targetId));
    setIsFollowing(false);
    setStats({ posts: 0, reels: 0, stories: 0, followers: 0, following: 0 });
    setPosts([]);
    setReels([]);
    setStories([]);
    setReplies([]);
    if (targetId) {
      setLoading(true);
      loadProfile(requestId);
    } else {
      setLoading(false);
      setVerificationLoading(false);
    }
    return () => {
      mounted.current = false;
      profileLoadSequence.current += 1;
    };
  }, [targetId]); // eslint-disable-line

  useEffect(() => {
    let active = true;
    if (!targetId) return undefined;
    supabase
      .from("community_members")
      .select("community:communities(id, name, icon, avatar_id, member_count), joined_at")
      .eq("user_id", targetId)
      .order("joined_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (active) setProfileCommunities((data || []).map((item) => ({ ...item.community, joinedAt: item.joined_at })).filter((item) => item?.id));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [targetId]);

  useEffect(() => {
    let active = true;
    setConnectionPreviews({ followers: [], following: [] });
    setConnectionList(null);
    setConnectionsLoading(true);
    setAmbassadorData(null);
    setLinkedNetworks([]);
    if (!targetId) {
      setConnectionsLoading(false);
      return undefined;
    }

    Promise.all([
      followService.getFollowers(targetId, 5),
      followService.getFollowing(targetId, 5),
    ]).then(([followers, following]) => {
      if (active) setConnectionPreviews({ followers, following });
    }).catch((error) => {
      console.error("[UserProfileModal] Could not load connection previews:", error);
    }).finally(() => {
      if (active) setConnectionsLoading(false);
    });

    if (isOwn) {
      supabase
        .from("connections")
        .select("provider,platform_user_id,auth_status,connected_via")
        .eq("user_id", targetId)
        .then(({ data, error }) => {
          if (error) throw error;
          if (active) setLinkedNetworks(data || []);
        })
        .catch((error) => console.error("[UserProfileModal] Could not load linked networks:", error));

      supabase
        .from("ambassador_profiles")
        .select("current_level, invite_code, status, commission_pct")
        .eq("user_id", targetId)
        .eq("status", "active")
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw error;
          if (active) setAmbassadorData(data || null);
        })
        .catch((error) => console.error("[UserProfileModal] Could not load ambassador status:", error));
    }

    return () => { active = false; };
  }, [targetId, isOwn]);

  const loadProfile = async (requestId) => {
    setLoading(true);
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_id,avatar_metadata,banner_image_id,bio,profile_tags,verified,is_pro,payment_status,created_at,email,phone,show_email,show_phone,location_city,location_country")
        .eq("id", targetId)
        .maybeSingle();
      if (!mounted.current || profileLoadSequence.current !== requestId) return;

      const raw = p || {};
      const userAvatarSource = [user?.avatar_url, user?.avatarUrl, user?.avatar]
        .find((value) => typeof value === "string" && value.trim().length > 1);
      const currentUserMetadata = isOwn ? currentUser?.user_metadata || currentUser?.userMetadata || {} : {};
      const userMetadata = user?.user_metadata || user?.userMetadata || currentUserMetadata;
      const identityMetadata = Array.isArray(user?.identities)
        ? user.identities.map((identity) => identity?.identity_data || identity?.identityData || {})
        : [];

      const avatarCandidates = [...new Set([
        ...mediaUrlService.resolveAvatarUrls(raw.avatar_id, 300),
        ...mediaUrlService.resolveAvatarUrls(raw.avatar_metadata, 300),
        ...mediaUrlService.resolveAvatarUrls(userMetadata, 300),
        ...mediaUrlService.resolveAvatarUrls(identityMetadata, 300),
        ...mediaUrlService.resolveAvatarUrls(user?.avatar_id, 300),
        ...mediaUrlService.resolveAvatarUrls(user?.avatar_metadata || user?.avatarMetadata, 300),
        ...mediaUrlService.resolveAvatarUrls(userAvatarSource, 300),
        ...(isOwn ? mediaUrlService.resolveAvatarUrls(currentUser?.avatar_url || currentUser?.avatarUrl || currentUser?.avatar, 300) : []),
      ])];
      const [avatarUrl, ...avatarFallbackUrls] = avatarCandidates;
      const bannerImageUrl = raw.banner_image_id
        ? (/^https?:\/\//i.test(raw.banner_image_id)
          ? raw.banner_image_id
          : mediaUrlService.getOptimizedImageUrl(raw.banner_image_id, {
              width: 1500,
              height: 520,
              quality: "100",
              format: "webp",
              crop: "fill",
            }))
        : null;

      if (mounted.current && profileLoadSequence.current === requestId)
        setProfile({
          id:            targetId,
          fullName:      raw.full_name || user?.full_name || user?.name || user?.author || "Unknown",
          username:      raw.username  || user?.username  || "unknown",
          avatarUrl,
          avatarFallbackUrls,
          avatarId:      raw.avatar_id || user?.avatar_id || (isOwn ? currentUser?.avatar_id : null) || null,
          avatarMetadata: raw.avatar_metadata || userMetadata || null,
          bannerImageUrl,
          bannerImageId: raw.banner_image_id || null,
          bio:           raw.bio       || null,
          profileTags:   normalizeProfileTags(raw.profile_tags),
          location:      [raw.location_city, raw.location_country].filter((part) => typeof part === "string" && part.trim()).join(", ") || user?.location || null,
          verified:      raw.verified  || user?.verified  || false,
          isPro:         raw.is_pro    || false,
          joinDate:      raw.created_at
            ? new Date(raw.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : null,
          email:        raw.show_email ? raw.email : null,
          phone:        raw.show_phone ? raw.phone : null,
          socialLinks:  user?.social_links && typeof user.social_links === "object" ? user.social_links : {},
          paymentStatus: raw.payment_status ?? user?.payment_status ?? "pending",
        });

      // The profile shell should not wait for counts, evidence, or the first
      // content grid request before becoming interactive.
      if (mounted.current && profileLoadSequence.current === requestId) {
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

      if (mounted.current && profileLoadSequence.current === requestId) {
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
          title: verificationRecord.payload?.event === "profile_lookup" ? "Profile identity lookup" : (verificationRecord.payload?.event || "XRC verification record"),
          summary: verificationRecord.payload?.event === "profile_lookup"
            ? "XRC Oracle resolved this profile identity from a verified profile search."
            : `Verified ${verificationRecord.stream_type || "XRC"} record ${verificationRecord.record_id || ""}`,
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
          .then((res) => { if (mounted.current && profileLoadSequence.current === requestId) setIsFollowing(!!res); })
          .catch(() => {});
      }

    } catch (e) {
      console.warn("[UserProfileModal]", e?.message);
    } finally {
      if (mounted.current && profileLoadSequence.current === requestId) {
        setVerificationLoading(false);
        setLoading(false);
      }
    }
  };

  const loadContent = async (tab) => {
    const requestId = profileLoadSequence.current;
    setContentLoading(true);
    try {
      if (tab === "posts") {
        const { data } = await supabase
          .from("posts")
          .select("id,user_id,content,image_ids,image_metadata,video_ids,video_metadata,is_text_card,text_card_metadata,card_caption,category,likes,views,comments_count,shares,created_at,updated_at,profiles:user_id(id,full_name,username,avatar_id,verified)")
          .eq("user_id", targetId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(12);
        if (mounted.current && profileLoadSequence.current === requestId) setPosts(data || []);
      } else if (tab === "reels") {
        const { data } = await supabase
          .from("reels")
          .select("id,user_id,caption,music,category,duration,thumbnail_id,video_id,video_metadata,likes,views,comments_count,shares,created_at,profiles:user_id(id,full_name,username,avatar_id,verified)")
          .eq("user_id", targetId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(12);
        if (mounted.current && profileLoadSequence.current === requestId) setReels(data || []);
      } else if (tab === "stories") {
        const { data } = await supabase
          .from("stories")
          .select("id,user_id,title,preview,full_content,cover_image_id,cover_image_metadata,category,unlock_cost,max_accesses,current_accesses,likes,views,comments_count,created_at,profiles:user_id(id,full_name,username,avatar_id,verified)")
          .eq("user_id", targetId).is("deleted_at", null)
          .order("created_at", { ascending: false }).limit(12);
        if (mounted.current && profileLoadSequence.current === requestId) setStories(data || []);
      } else {
        const { data } = await supabase
          .from("comments")
          .select("id,content,created_at,likes,reply_count,parent_id")
          .eq("user_id", targetId)
          .order("created_at", { ascending: false })
          .limit(12);
        if (mounted.current && profileLoadSequence.current === requestId) setReplies(data || []);
      }
    } catch (e) {
      console.warn("[UserProfileModal] content:", e?.message);
      if (tab === "replies" && mounted.current && profileLoadSequence.current === requestId) setReplies([]);
    } finally {
      if (mounted.current && profileLoadSequence.current === requestId) setContentLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== "replies") setContentFilter("momentum");
    loadContent(tab);
  };

  const handleOwnerShortcut = (action) => {
    onClose?.();
    window.dispatchEvent(new CustomEvent("xeevia:profile-shortcut", { detail: { action } }));
  };

  const handleAppNavigation = (tab) => {
    onClose?.();
    window.dispatchEvent(new CustomEvent("xeevia:profile-app-nav", { detail: { tab } }));
  };

  const handleProfileSearch = (event) => {
    event.preventDefault();
    const query = profileSearchQuery.trim();
    if (!query) return;
    handleSearchNavigate(query);
  };

  const handleSearchNavigate = (query) => {
    onClose?.();
    window.dispatchEvent(new CustomEvent("xeevia:profile-app-search", { detail: { query } }));
  };

  const openConnectionList = (kind) => {
    setConnectionList(kind);
    setConnectionListLoading(true);
    const load = kind === "followers" ? followService.getFollowers : followService.getFollowing;
    load.call(followService, targetId, 20)
      .then((items) => setConnectionPreviews((previous) => ({ ...previous, [kind]: items })))
      .finally(() => setConnectionListLoading(false));
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile/${encodeURIComponent(profile?.username || targetId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile?.fullName || "Xeevia profile", url: profileUrl });
        return;
      }
      if (!navigator.clipboard?.writeText) {
        setProfileNotice("Sharing is not available in this browser.");
        return;
      }
      await navigator.clipboard.writeText(profileUrl);
      setProfileNotice("Profile link copied.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("[UserProfileModal] Could not share profile:", error);
        setProfileNotice("Could not share this profile. Please try again.");
      }
    }
  };

  const handleOpenContent = useCallback((item, type) => {
    setSelectedContent({ item, type });
  }, []);

  const handleFollow = useCallback(async (e) => {
    e.preventDefault();
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
    e.preventDefault();
    e.stopPropagation();
    if (!myId || isOwn || !targetId) return;
    window.dispatchEvent(new CustomEvent("community:open-dm", {
      detail: { userId: targetId },
    }));
    onClose?.();
  }, [myId, isOwn, targetId, onClose]);

  const handleGift = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!targetId || isOwn) return;
    window.dispatchEvent(new CustomEvent("xeevia:open-gift-card", {
      detail: {
        recipient: {
          id: targetId,
          user_id: targetId,
          username: profile?.username || user?.username || "user",
          full_name: profile?.fullName || user?.name || user?.full_name || "User",
          avatar_id: profile?.avatarId || user?.avatar_id || null,
        },
      },
    }));
    onClose?.();
  }, [targetId, isOwn, profile, user, onClose]);

  const scoreMomentum = (item) => {
    const likes = Number(item?.likes || item?.like_count || 0);
    const views = Number(item?.views || item?.view_count || 0);
    const comments = Number(item?.comments_count || item?.comment_count || 0);
    return views + likes * 2 + comments * 4;
  };

  const getVisibleContent = () => {
    const source = activeTab === "posts" ? posts : activeTab === "reels" ? reels : activeTab === "stories" ? stories : replies;
    if (!source?.length) return [];
    if (contentFilter === "48h") {
      const now = Date.now();
      return source.filter((item) => {
        const createdAt = new Date(item?.created_at || 0).getTime();
        return Number.isFinite(createdAt) && (now - createdAt) <= 48 * 60 * 60 * 1000;
      });
    }
    return [...source].sort((a, b) => scoreMomentum(b) - scoreMomentum(a));
  };

  const currentContent = getVisibleContent();

  // ── Render ────────────────────────────────────────────────────────────────
  return showDashboard ? dashboardPage : ReactDOM.createPortal(
    <div
      className={`upm-bd${presentation === "section" ? " upm-section-surface" : ""}`}
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
            <nav className="upm-app-rail" aria-label="Xeevia navigation">
              <button type="button" className="upm-close-nav" onClick={onClose} aria-label="Close profile" title="Close profile">
                <X size={17} />
              </button>
              <span className="upm-app-rail-divider" aria-hidden="true" />
              {[
                [Home, "Home", "home"],
                [Search, "Explore", "search"],
                [PlusSquare, "Create", "create"],
                [UsersRound, "Community", "community"],
                [Wallet, "Wallet", "wallet"],
                [UserRound, "Account", "account"],
              ].map(([Icon, label, tab]) => (
                <button
                  type="button"
                  key={tab}
                  className={tab === "account" ? "active" : ""}
                  aria-label={label}
                  title={label}
                  onClick={() => handleAppNavigation(tab)}
                >
                  <Icon size={18} />
                </button>
              ))}
            </nav>

            <aside className="upm-profile-sidebar" aria-label="Profile details and shortcuts">
              <ProfileSidebarAccordion
                id="about"
                title={isOwn ? "Your profile" : "About"}
                isOpen={expandedSidebarCard === "about"}
                onToggle={() => setExpandedSidebarCard((current) => current === "about" ? null : "about")}
              >
                {profile?.bio && <p className="upm-sidebar-bio upm-sidebar-accordion-item">{profile.bio}</p>}
                {profile?.location && <div className="upm-sidebar-detail upm-sidebar-accordion-item"><MapPin size={13} /><span>{profile.location}</span></div>}
                {profile?.joinDate && <div className="upm-sidebar-detail upm-sidebar-accordion-item"><Clock3 size={13} /><span>Joined {profile.joinDate}</span></div>}
                {profile?.email && <div className="upm-sidebar-detail upm-sidebar-accordion-item"><span className="upm-sidebar-detail-dot" /><span>{profile.email}</span></div>}
                {profile?.phone && <div className="upm-sidebar-detail upm-sidebar-accordion-item"><span className="upm-sidebar-detail-dot" /><span>{profile.phone}</span></div>}
                {!profile?.bio && !profile?.location && !profile?.joinDate && !profile?.email && !profile?.phone && (
                  <p className="upm-sidebar-muted upm-sidebar-accordion-item">No additional profile details shared.</p>
                )}
              </ProfileSidebarAccordion>

              {isOwn && (
                <>
                  <section className="upm-sidebar-block upm-strength-card">
                    <div className="upm-sidebar-strength-top"><span>Profile completeness</span><strong>{profileCompleteness}%</strong></div>
                    <div className="upm-strength-track"><span style={{ width: `${profileCompleteness}%` }} /></div>
                    <button type="button" onClick={() => handleOwnerShortcut("edit-profile")}>Complete your profile <ChevronRight size={13} /></button>
                  </section>

                  <ProfileSidebarAccordion
                    id="shortcuts"
                    title="Profile shortcuts"
                    isOpen={expandedSidebarCard === "shortcuts"}
                    onToggle={() => setExpandedSidebarCard((current) => current === "shortcuts" ? null : "shortcuts")}
                  >
                  <nav className="upm-sidebar-nav" aria-label="Your profile shortcuts">
                    <button type="button" onClick={() => handleOwnerShortcut("edit-profile")}><Settings size={15} /><span>Edit profile</span><ChevronRight size={13} /></button>
                    <button type="button" onClick={() => handleOwnerShortcut("saved")}><Bookmark size={15} /><span>Saved</span><ChevronRight size={13} /></button>
                    <button type="button" onClick={() => openConnectionList("followers")}><UsersRound size={15} /><span>Followers</span><b>{fmt(stats.followers)}</b></button>
                    <button type="button" onClick={() => openConnectionList("following")}><UserRound size={15} /><span>Following</span><b>{fmt(stats.following)}</b></button>
                    <button type="button" onClick={() => { setInitialXRDSection("Verification"); setShowXRD(true); }}><ShieldCheck size={15} /><span>Verification / XRD</span><ChevronRight size={13} /></button>
                    <button type="button" onClick={() => { onClose?.(); window.dispatchEvent(new CustomEvent("xeevia:open-community")); }}><Globe2 size={15} /><span>Communities</span><b>{fmt(profileCommunities.length)}</b></button>
                    <button type="button" onClick={() => handleOwnerShortcut("ambassador")}><Sparkles size={15} /><span>Ambassador</span><small>{ambassadorData ? `${ambassadorData.commission_pct}%` : "Explore"}</small></button>
                    <button type="button" onClick={() => { setShowXRD(true); setInitialXRDSection("Oracle"); }}><ExternalLink size={15} /><span>XRC Oracle</span><ChevronRight size={13} /></button>
                  </nav>
                  </ProfileSidebarAccordion>
                </>
              )}

              <ProfileSidebarAccordion
                id="connections"
                title={connectionList ? `Recent ${connectionList}` : "Connections"}
                isOpen={expandedSidebarCard === "connections"}
                onToggle={() => setExpandedSidebarCard((current) => current === "connections" ? null : "connections")}
                className="upm-connections"
                actions={connectionList
                  ? <button type="button" onClick={() => setConnectionList(null)}>Back</button>
                  : <button type="button" onClick={() => openConnectionList("followers")}>See all</button>}
              >
                <div className="upm-connections-grid">
                {connectionListLoading ? <div className="upm-sidebar-muted">Loading connections…</div> : (connectionList ? connectionPreviews[connectionList] : [
                  ...connectionPreviews.followers.slice(0, 3),
                  ...connectionPreviews.following.slice(0, 3),
                ]).slice(0, 6).map((item, index) => {
                  const person = item.profiles || {};
                  const key = item.follower_id || item.following_id || person.id || index;
                  const avatar = mediaUrlService.resolveAvatarUrl(person.avatar_id, 96);
                  return (
                    <div className="upm-connection-person" key={`${key}-${index}`}>
                      <span>{avatar ? <img src={avatar} alt="" /> : (person.full_name || person.username || "?").charAt(0).toUpperCase()}</span>
                      <div><strong>{person.full_name || person.username || "Xeevia member"}</strong><small>@{person.username || "member"}</small></div>
                    </div>
                  );
                })}
                {!connectionListLoading && (connectionList
                  ? connectionPreviews[connectionList].length === 0
                  : connectionPreviews.followers.length + connectionPreviews.following.length === 0) && (
                  <p className="upm-sidebar-muted">No connections to show yet.</p>
                )}
                </div>
                {!connectionList && (
                  <div className="upm-connection-actions">
                    <button type="button" onClick={() => openConnectionList("followers")}>Followers <b>{fmt(stats.followers)}</b></button>
                    <button type="button" onClick={() => openConnectionList("following")}>Following <b>{fmt(stats.following)}</b></button>
                  </div>
                )}
              </ProfileSidebarAccordion>

              <ProfileSidebarAccordion
                id="networks"
                title="Linked networks"
                isOpen={expandedSidebarCard === "networks"}
                onToggle={() => setExpandedSidebarCard((current) => current === "networks" ? null : "networks")}
                className="upm-sidebar-links"
              >
                {visibleNetworks.length ? visibleNetworks.map(({ provider, url, status }, index) => (
                  url ? (
                    <a className="upm-sidebar-accordion-item" key={`${provider}-${url}`} href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={13} /><span>{provider.replaceAll("_", " ")}</span><ChevronRight size={12} />
                    </a>
                  ) : (
                    <div className="upm-network-status upm-sidebar-accordion-item" key={`${provider}-${index}`}>
                      <span>{provider.replaceAll("_", " ")}</span>
                      <small className={status === "active" ? "is-linked" : ""}>{status === "active" ? "Linked" : status || "Connection status unavailable"}</small>
                    </div>
                  )
                )) : <p className="upm-sidebar-muted upm-sidebar-accordion-item">{isOwn ? "Your linked accounts will appear here." : "No public links shared."}</p>}
              </ProfileSidebarAccordion>
            </aside>

            <main className="upm-main" aria-label="Profile content">
            <section className="upm-profile-shell">
              <div className={`upm-profile-hero${hasBoosted ? " is-boosted" : ""}`}>
                <BoostProfileCard
                  tier={hasBoosted ? tier : null}
                  themeId={themeId}
                  backgroundColorId={backgroundColorId}
                  embedded
                  className="upm-boost-profile"
                  style={{ minHeight: 0, borderRadius: 18, width: "100%" }}
                >
                  <div className="upm-hdr upm-profile-header">
                    <div
                      className={`upm-profile-cover${profile?.bannerImageUrl ? " has-custom-banner" : ""}${hasBoosted && !profile?.bannerImageUrl ? ` tier-${tier}` : ""}`}
                      style={!profile?.bannerImageUrl ? coverStyle : undefined}
                      aria-label="Xeevia profile banner"
                    >
                      {profile?.bannerImageUrl && <img className="upm-profile-banner-image" src={profile.bannerImageUrl} alt="" />}
                      {!profile?.bannerImageUrl && (
                        <>
                          <div className="upm-cover-grid" />
                          <div className="upm-cover-copy">
                            <strong>{profile?.fullName || "Xeevia profile"}</strong>
                          </div>
                          <div className="upm-cover-brand">
                            <img src={`${process.env.PUBLIC_URL || ""}/logo192.png`} alt="Xeevia" />
                          </div>
                        </>
                      )}
                      {isOwn && (
                        <button
                          type="button"
                          className="upm-cover-edit"
                          onClick={() => setShowProfileEditor(true)}
                          aria-label="Update profile banner"
                          title="Update your banner"
                        >
                          <Edit3 size={15} />
                        </button>
                      )}
                    </div>
                    <div className="upm-profile-identity-row">
                      <BoostAvatarRing
                        userId={targetId}
                        tier={hasBoosted ? tier : null}
                        themeId={hasBoosted ? themeId : null}
                        size={110}
                        src={profile?.avatarUrl || null}
                        fallbackSrc={profile?.avatarFallbackUrls || []}
                        letter={profile?.fullName?.trim()?.charAt(0) || "U"}
                        style={{ transform: "translateX(18px)" }}
                        showBadge={false}
                        badgeSize="md"
                        borderRadius="circle"
                      />
                    </div>
                  <div className="upm-profile-action-row" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                    {showFollowBtn && (
                      <>
                        <button type="button" className={`upm-fbtn${isFollowing ? " upm-fbtn--following" : ""}`} onClick={handleFollow} disabled={followLoading} style={followBtnStyle} aria-label={isFollowing ? "Unfollow user" : "Follow user"}>
                          {followLoading ? <Loader size={16} className="upm-spin-icon" /> : isFollowing ? <><UserCheck size={16} /><span>Following</span></> : <><UserPlus size={16} /><span>Follow</span></>}
                        </button>
                        <button className="upm-fbtn upm-message-btn" onClick={handleMessage} type="button" aria-label="Message user">
                          <MessageSquare size={16} /><span>Message</span>
                        </button>
                        <button className="upm-fbtn upm-gift-btn" onClick={handleGift} type="button" aria-label="Send user a gift">
                          <Gift size={16} /><span>Gift</span>
                        </button>
                      </>
                    )}
                    <button type="button" className="upm-xrd-btn" onClick={() => { setInitialXRDSection("Overview"); setShowXRD(true); }} aria-label="Open Xeevia Record dashboard">
                      <ShieldCheck size={16} /><span>XRD</span>
                    </button>
                  </div>

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
                  <span>{profile?.fullName || "Unknown"}</span>
                  {(profile?.verified || hasBoosted) && <VerifiedBadgeSeal tier={hasBoosted ? tier : "silver"} size={20} />}
                </h2>

                <div className="upm-badges">
                  {profile?.isPro && (
                    <span className="upm-b-pro"><Crown size={9} /> PRO</span>
                  )}
                  <TierBadgePill tier={tier} paymentStatus={profile?.paymentStatus} />
                </div>

                <p
                  className="upm-uname"
                  style={{
                    color:      hasBoosted ? `${nameColor}80` : "rgba(255,255,255,0.5)",
                    transition: "color 0.4s ease",
                  }}
                >
                  @{profile?.username || "unknown"}
                </p>

                {profile?.profileTags?.length > 0 && (
                  <div className="upm-profile-tags" aria-label="Self-described profile tags" title="Self-described profile labels">
                    {profile.profileTags.map((tag) => (
                      <span className="upm-profile-tag" key={tag}>{formatProfileTag(tag)}</span>
                    ))}
                  </div>
                )}

                {profile?.bio     && <p className="upm-bio">{profile.bio}</p>}
                <div className="upm-profile-meta">
                  {profile?.location && <span className="upm-profile-meta-pill"><MapPin size={12} />{profile.location}</span>}
                  {profile?.joinDate && <span className="upm-profile-meta-pill"><Clock3 size={12} />Joined {profile.joinDate}</span>}
                </div>
                {(profile?.email || profile?.phone) && (
                  <div className="upm-contact-meta">
                    {profile.email && <span>{profile.email}</span>}
                    {profile.phone && <span>{profile.phone}</span>}
                  </div>
                )}
                  </div>
                </BoostProfileCard>
              </div>

              <div className="upm-card-lower">
                <div className="upm-people-grid" aria-label="Profile connections">
                  <ProfilePeopleStack
                    kind="following"
                    people={connectionPreviews.following}
                    total={stats.following}
                    loading={connectionsLoading}
                    onOpen={openConnectionList}
                  />
                  <ProfilePeopleStack
                    kind="followers"
                    people={connectionPreviews.followers}
                    total={stats.followers}
                    loading={connectionsLoading}
                    onOpen={openConnectionList}
                  />
                </div>

                <section className="upm-xrd-card" aria-label="Xeevia Record overview">
                  <div className="upm-xrd-card-head">
                    <span className="upm-xrd-mark">XRD</span>
                    <div className="upm-verification-copy">
                      <strong>View verified records</strong>
                      <small>{isOwn ? "Your evidence, traced to its source." : `${profile?.fullName || "This profile"}'s public evidence, traced to its source.`}</small>
                    </div>
                  </div>
                  <button type="button" className="upm-xrd-open" onClick={() => { setInitialXRDSection("Overview"); setShowXRD(true); }}>
                    Open XRD <ChevronRight size={14} />
                  </button>
                  <div className="upm-xrd-stats">
                    {[
                      [verificationItems.length, "Records"],
                      [verificationItems.filter((item) => item?.verified).length, "Verified"],
                      [evidenceSourcesCount, "Sources"],
                      [institutionCount, "Institutions"],
                    ].map(([value, label]) => (
                      <div key={label}><strong>{fmt(value)}</strong><span>{label}</span></div>
                    ))}
                  </div>
                  {profileNotice && <p className="upm-profile-notice" role="status">{profileNotice}</p>}
                </section>
              </div>
            </section>

            <div className="upm-quick-actions" aria-label={isOwn ? "Profile shortcuts" : "Profile actions"}>
              {(isOwn ? [
                [Settings, "Edit Profile", "Update your info", "#a3e635", () => handleOwnerShortcut("edit-profile")],
                [Bookmark, "Saved", "Your bookmarks", "#fb923c", () => handleOwnerShortcut("saved")],
                [UsersRound, "Followers", `${fmt(stats.followers)} people`, "#60a5fa", () => openConnectionList("followers")],
                [UserRound, "Following", `${fmt(stats.following)} people`, "#a78bfa", () => openConnectionList("following")],
                [ShieldCheck, "Verification", "Open proof dashboard", "#c084fc", () => { setInitialXRDSection("Verification"); setShowXRD(true); }],
                [Globe2, "Communities", `${fmt(profileCommunities.length)} joined`, "#2dd4bf", () => { onClose?.(); window.dispatchEvent(new CustomEvent("xeevia:open-community")); }],
                [Sparkles, "Ambassador", ambassadorData ? `${ambassadorData.commission_pct}% commission` : "Explore the program", "#f59e0b", () => handleOwnerShortcut("ambassador")],
                [ExternalLink, "XRC Oracle", "Ask your evidence", "#a3e635", () => { setInitialXRDSection("Oracle"); setShowXRD(true); }],
              ] : [
                [UserPlus, isFollowing ? "Following" : "Follow", isFollowing ? "Manage connection" : "Connect with this profile", "#a3e635", handleFollow],
                [MessageSquare, "Message", "Say hello", "#fb923c", handleMessage],
                [UsersRound, "Followers", `${fmt(stats.followers)} people`, "#60a5fa", () => openConnectionList("followers")],
                [UserRound, "Following", `${fmt(stats.following)} people`, "#a78bfa", () => openConnectionList("following")],
                [ShieldCheck, "Verification", "See what is verified", "#c084fc", () => { setInitialXRDSection("Verification"); setShowXRD(true); }],
                [Globe2, "Communities", `${fmt(profileCommunities.length)} joined`, "#2dd4bf", () => { onClose?.(); window.dispatchEvent(new CustomEvent("xeevia:open-community")); }],
                [Share2, "Share profile", "Send this profile", "#fb923c", handleShareProfile],
                [Sparkles, "Ask Oracle", "Ask about this profile", "#a3e635", () => { setInitialXRDSection("Oracle"); setShowXRD(true); }],
              ]).map(([Icon, title, subtitle, accent, action]) => (
                <button type="button" key={title} className="upm-quick-action" style={{ "--upm-action-accent": accent }} onClick={action}>
                  <span className="upm-quick-icon"><Icon size={16} /></span>
                  <span className="upm-quick-copy"><strong>{title}</strong><small>{subtitle}</small></span>
                </button>
              ))}
            </div>

            {showXRD && (
              <XRDProfileDashboard
                profile={profile}
                currentUser={currentUser}
                targetId={targetId}
                verificationItems={verificationItems}
                initialSection={initialXRDSection}
                onClose={() => setShowXRD(false)}
              />
            )}

            {showDashboard ? (
              <div style={{ margin: "16px 16px 0", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Verification Dashboard</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{verificationLoading ? "Loading sections…" : "Tap a section to inspect verified evidence."}</div>
                  </div>
                  <button type="button" onClick={() => { setShowDashboard(false); setSelectedSection(null); }} style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f5f5f5", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Close
                  </button>
                </div>

                {selectedSectionData ? (
                  <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{selectedSectionData.title}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{selectedSectionData.subtitle}</div>
                      </div>
                      <button type="button" onClick={() => setSelectedSection(null)} style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f5f5f5", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Back
                      </button>
                    </div>
                    <div style={{ fontSize: 13, color: "#cfcfcf", marginBottom: 12 }}>{selectedSectionData.summary}</div>
                    {selectedSectionData.items.length === 0 ? (
                      <div style={{ padding: "12px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", color: "#8b8b8b", fontSize: 13 }}>No verified evidence found for this section yet.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {selectedSectionData.items.map((item) => (
                          <div key={item.id || item.title} style={{ padding: "12px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: "#8b8b8b", marginTop: 2 }}>{item.provider || "Unknown source"} · {item.evidence_type}</div>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: item.verified ? "#84cc16" : "#9ca3af" }}>{item.verified ? "Verified" : "Tracked"}</div>
                            </div>
                            {item.summary ? <div style={{ fontSize: 13, color: "#d1d5db", marginTop: 8 }}>{item.summary}</div> : null}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(132,204,22,0.14)", color: "#84cc16", fontSize: 11, fontWeight: 700, border: "1px solid rgba(132,204,22,0.22)" }}>{item.proofLabel}</span>
                              {item.verificationLevel ? <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontSize: 11, fontWeight: 700, border: "1px solid rgba(96,165,250,0.2)" }}>{String(item.verificationLevel).toUpperCase()} trust</span> : null}
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
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{section.title}</div>
                            <div style={{ width: 28, height: 28, borderRadius: 10, background: `${section.accent}16`, border: `1px solid ${section.accent}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={14} style={{ color: section.accent }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{section.subtitle}</div>
                          <div style={{ fontSize: 13, color: "#f5f5f5", fontWeight: 700 }}>{section.summary}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Tabs ── */}
            {!showDashboard && (
              <>
                <div className="upm-tabs">
                  {[
                    { id: "posts",   icon: <Image    size={14} />, label: "Posts",   count: stats.posts   },
                    { id: "reels",   icon: <Film     size={14} />, label: "Reels",   count: stats.reels   },
                    { id: "stories", icon: <BookOpen size={14} />, label: "Stories", count: stats.stories },
                    { id: "replies", icon: <MessageCircleReply size={14} />, label: "Replies", count: replies.length || 0 },
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

                {activeTab !== "replies" && (
                  <div className="upm-filter-bar">
                    <div className="upm-filter-label">Ranking</div>
                    <select
                      className="upm-filter-select"
                      value={contentFilter}
                      onChange={(e) => setContentFilter(e.target.value)}
                    >
                      <option value="momentum">Top momentum</option>
                      <option value="48h">Last 48 hours</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {/* ── Content grid ── */}
            {!showDashboard && (
              <div className="upm-cnt">
                {contentLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 28 }}>
                    <div className="upm-spin-sm" />
                  </div>
                ) : activeTab === "replies" ? (
                  replies.length > 0 ? (
                    <div className="upm-reply-list">
                      {replies.map((item) => (
                        <button type="button" key={item.id} className="upm-reply-item" onClick={() => handleOpenContent(item, "reply")}>
                          <div className="upm-reply-header">
                            <span className="upm-reply-badge">Reply</span>
                            <span className="upm-reply-date">{item.created_at ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recently"}</span>
                          </div>
                          <div className="upm-reply-copy">{item.content || "Comment"}</div>
                          <div className="upm-reply-meta">
                            <span><Heart size={12} /> {fmt(item.likes || 0)}</span>
                            <span><MessageCircleReply size={12} /> {fmt(item.reply_count || 0)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="upm-empty">
                      <MessageCircleReply size={32} opacity={0.2} />
                      <p>No replies yet</p>
                    </div>
                  )
                ) : currentContent.length > 0 ? (
                  <div className="upm-full-feed">
                    {currentContent.map((item) => (
                      <FullProfileContent
                        key={item.id}
                        item={item}
                        type={activeTab === "reels" ? "reel" : activeTab === "stories" ? "story" : "post"}
                        profile={profile}
                        currentUser={currentUser}
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
            </main>

            <aside className="upm-profile-rail" aria-label="Profile highlights">
              <form className="upm-rail-search" onSubmit={handleProfileSearch}>
                <Search size={15} />
                <input
                  value={profileSearchQuery}
                  onChange={(event) => setProfileSearchQuery(event.target.value)}
                  aria-label="Search Xeevia"
                  placeholder="Search Xeevia"
                />
                <button type="submit" aria-label="Submit Xeevia search"><ChevronRight size={14} /></button>
              </form>

              <section className="upm-discovery-section">
                <div className="upm-discovery-heading"><Crown size={15} /><strong>Top streamers</strong></div>
                {creatorRailLoading ? (
                  <div className="upm-discovery-empty">Loading streamers…</div>
                ) : topStreamers.length ? topStreamers.map(({ profile: person, peakViewers }) => {
                  const avatar = mediaUrlService.resolveAvatarUrl(person.avatar_id, 80);
                  return (
                    <button type="button" className="upm-discovery-person" key={person.id} onClick={() => setSelectedRailProfile(person)}>
                      <span className="upm-discovery-avatar">{avatar ? <img src={avatar} alt="" /> : (person.full_name || person.username || "?").charAt(0).toUpperCase()}</span>
                      <span className="upm-discovery-copy">
                        <strong>{person.full_name || person.username || "Xeevia creator"}</strong>
                        <small>{fmt(peakViewers)} peak viewers</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  );
                }) : (
                  <div className="upm-discovery-empty">No streamer rankings yet.</div>
                )}
              </section>

              <section className="upm-discovery-section">
                <div className="upm-discovery-heading"><UsersRound size={15} /><strong>Similar creators</strong></div>
                {creatorRailLoading ? (
                  <div className="upm-discovery-empty">Finding creators…</div>
                ) : similarCreators.length ? similarCreators.map((person) => {
                  const avatar = mediaUrlService.resolveAvatarUrl(person.avatar_id, 80);
                  return (
                    <button type="button" className="upm-discovery-person" key={person.id} onClick={() => setSelectedRailProfile(person)}>
                      <span className="upm-discovery-avatar">{avatar ? <img src={avatar} alt="" /> : (person.full_name || person.username || "?").charAt(0).toUpperCase()}</span>
                      <span className="upm-discovery-copy">
                        <strong>{person.full_name || person.username || "Xeevia creator"}</strong>
                        <small>{normalizeProfileTags(person.profile_tags).slice(0, 2).map(formatProfileTag).join(" · ")}</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  );
                }) : (
                  <div className="upm-discovery-empty">
                    {profile?.profileTags?.length ? "No matching creators yet." : "Profile tags help find similar creators."}
                  </div>
                )}
              </section>

              <section className="upm-trending">
                <div className="upm-trending-title"><TrendingUp size={15} /><strong>Trending</strong></div>
                {trendingLoading ? (
                  <div className="upm-trending-empty">Loading current topics…</div>
                ) : trendingTopics.length ? (
                  trendingTopics.slice(0, 5).map((topic) => (
                    <button
                      type="button"
                      className="upm-trending-row"
                      key={`${topic.type}-${topic.label}`}
                      onClick={() => handleSearchNavigate(topic.label)}
                    >
                      <span className="upm-trending-icon"><Flame size={13} /></span>
                      <span className="upm-trending-copy">
                        <strong>{topic.type === "hashtag" && !topic.label.startsWith("#") ? `#${topic.label}` : topic.label}</strong>
                        <small>{fmt(topic.count)} {topic.type === "category" ? "views" : "posts"} · Trending</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))
                ) : (
                  <div className="upm-trending-empty">No trending topics yet.</div>
                )}
              </section>
            </aside>

            {selectedRailProfile && (
              <UserProfileModal
                user={selectedRailProfile}
                currentUser={currentUser}
                onClose={() => setSelectedRailProfile(null)}
              />
            )}

            {showProfileEditor && isOwn && (
              <ProfileEditModal
                userId={targetId}
                currentProfile={{
                  fullName: profile?.fullName,
                  username: profile?.username,
                  bio: profile?.bio,
                  profileTags: profile?.profileTags,
                  avatar: profile?.avatarUrl,
                  avatarId: profile?.avatarId,
                  bannerImageUrl: profile?.bannerImageUrl,
                  bannerImageId: profile?.bannerImageId,
                }}
                onClose={() => setShowProfileEditor(false)}
                onSuccess={(updatedProfile) => {
                  setProfile((previous) => ({
                    ...previous,
                    ...updatedProfile,
                    avatarUrl: updatedProfile.avatar || previous?.avatarUrl,
                    avatarFallbackUrls: [...new Set([
                      ...mediaUrlService.resolveAvatarUrls(updatedProfile.avatarId || previous?.avatarId, 300),
                      ...(previous?.avatarFallbackUrls || []),
                    ].filter(Boolean))],
                  }));
                }}
              />
            )}

            {selectedContent && (
              <div className="upm-content-dialog-backdrop" onClick={() => setSelectedContent(null)}>
                <section className="upm-content-dialog" role="dialog" aria-modal="true" aria-label="Open profile content" onClick={(event) => event.stopPropagation()}>
                  <div className="upm-content-dialog-head">
                    <div>
                      <span className="upm-rail-kicker">{selectedContent.type === "reply" ? "Reply" : selectedContent.type}</span>
                      <strong>{profile?.fullName || "Profile content"}</strong>
                    </div>
                    <button type="button" className="upm-content-dialog-close" onClick={() => setSelectedContent(null)} aria-label="Close content">
                      <X size={16} />
                    </button>
                  </div>
                  {selectedContent.type === "reply" ? (
                    <p className="upm-content-dialog-copy">{selectedContent.item.content || "Comment"}</p>
                  ) : (
                    <div className="upm-full-feed upm-dialog-feed">
                      <FullProfileContent
                        item={selectedContent.item}
                        type={selectedContent.type}
                        profile={profile}
                        currentUser={currentUser}
                      />
                    </div>
                  )}
                  <div className="upm-content-dialog-meta">
                    <span><Heart size={13} /> {fmt(selectedContent.item.likes || 0)}</span>
                    <span><Eye size={13} /> {fmt(selectedContent.item.views || 0)}</span>
                    <span><MessageCircleReply size={13} /> {fmt(selectedContent.item.comments_count || selectedContent.item.reply_count || 0)}</span>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        /* ── Backdrop: near-transparent on desktop, no blur ── */
        .upm-bd {
          position:fixed; inset:0; z-index:10000;
          background:rgba(0,0,0,0.42);
          display:flex; align-items:center; justify-content:center;
          padding:0; animation:upmFI .2s ease; touch-action:manipulation;
        }
        .upm-section-surface { background:#0a0a0a; align-items:stretch; justify-content:stretch; }
        .upm-section-surface .upm-sheet { border-radius:0; border:0; box-shadow:none; animation:none; }

        .upm-sheet {
          position:relative; width:100%; max-width:none; height:100%; max-height:none;
          min-height:0; display:grid; grid-template-columns:64px minmax(220px,270px) minmax(0,640px) minmax(240px,300px);
          align-content:stretch; justify-content:center; gap:0; padding:14px;
          overflow:hidden; border-radius:0; background:#000;
          border:0;
          box-shadow:0 24px 80px rgba(0,0,0,.9);
          animation:upmSU .25s cubic-bezier(.34,1.4,.64,1); scrollbar-width:none;
        }
        .upm-sheet::-webkit-scrollbar { display:none; }
        .upm-app-rail { position:relative; z-index:4; display:flex; flex-direction:column; align-items:center; gap:8px; min-width:0; padding:0 8px 8px 0; border-right:1px solid #2f3336; }
        .upm-close-nav { color:#efffd8!important; border-color:rgba(221,255,186,.3)!important; background:linear-gradient(145deg,rgba(10,15,12,.94),rgba(0,0,0,.78))!important; box-shadow:0 4px 16px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.12); }
        .upm-close-nav:hover { color:#101800!important; border-color:rgba(217,255,158,.8)!important; background:linear-gradient(145deg,#a3e635,#65a30d)!important; box-shadow:0 6px 20px rgba(132,204,22,.24); }
        .upm-close-nav:focus-visible { outline:2px solid #c5f76b; outline-offset:3px; }
        .upm-app-rail-divider { width:34px; height:1px; flex:none; margin:3px 0 5px; background:linear-gradient(90deg,transparent,rgba(163,230,53,.92),rgba(52,211,153,.78),transparent); box-shadow:0 0 9px rgba(163,230,53,.62); }
        .upm-app-rail button { width:44px; height:44px; display:grid; place-items:center; border:1px solid #2a2d2a; border-radius:13px; background:#000; color:#8a918a; cursor:pointer; transition:color .15s,border-color .15s,background .15s; }
        .upm-app-rail button:hover, .upm-app-rail button.active { color:#a3e635; border-color:#a3e635; background:rgba(163,230,53,.055); }
        .upm-profile-sidebar { min-width:0; min-height:0; display:grid; align-content:start; gap:10px; box-sizing:border-box; padding:16px 12px 24px; overflow-y:auto; overscroll-behavior:contain; background:linear-gradient(180deg,#101610,#080b09 88%); border-right:1px solid #2f3336; scrollbar-width:thin; scrollbar-color:rgba(132,204,22,.28) transparent; }
        .upm-profile-sidebar::-webkit-scrollbar { width:5px; }
        .upm-profile-sidebar::-webkit-scrollbar-thumb { background:rgba(132,204,22,.24); border-radius:999px; }
        .upm-sidebar-block { position:relative; min-width:0; padding:13px 12px; overflow:hidden; border:1px solid #343b33; border-radius:14px; background:radial-gradient(ellipse at 100% 0,rgba(132,204,22,.075),transparent 48%),linear-gradient(145deg,rgba(16,21,16,.98),rgba(5,7,5,.99)); box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 10px 24px rgba(0,0,0,.28); }
        .upm-sidebar-block::before { position:absolute; top:0; left:14px; right:14px; height:1px; background:linear-gradient(90deg,transparent,rgba(163,230,53,.7),rgba(16,185,129,.4),transparent); content:""; }
        .upm-sidebar-accordion-head { display:flex; align-items:center; gap:8px; min-width:0; }
        .upm-sidebar-accordion-toggle { min-width:0; flex:1; display:flex; align-items:center; gap:8px; padding:0; border:0; background:transparent; color:#d9f99d; text-align:left; cursor:pointer; }
        .upm-sidebar-accordion-toggle .upm-sidebar-label { flex:1; margin:0; }
        .upm-sidebar-accordion-toggle > svg { flex:0 0 auto; color:#9aa393; transition:transform .18s,color .18s; }
        .upm-sidebar-accordion.is-expanded .upm-sidebar-accordion-toggle > svg { transform:rotate(90deg); color:#a3e635; }
        .upm-sidebar-accordion-content { min-width:0; margin-top:9px; }
        .upm-sidebar-accordion:not(.is-expanded) .upm-sidebar-accordion-content > .upm-sidebar-accordion-item:nth-child(n+3) { display:none; }
        .upm-sidebar-accordion-head > button:not(.upm-sidebar-accordion-toggle) { flex:0 0 auto; padding:0; border:0; background:none; color:#a3e635; font-size:calc((9px) + 1px); font-weight:700; cursor:pointer; }
        .upm-sidebar-accordion-content .upm-sidebar-nav { padding:0; border:0; background:none; box-shadow:none; }
        .upm-sidebar-accordion:not(.is-expanded) .upm-sidebar-nav button:nth-of-type(n+3) { display:none; }
        .upm-connections:not(.is-expanded) .upm-connection-person:nth-child(n+3) { display:none; }
        .upm-sidebar-label { display:flex; align-items:center; gap:7px; margin-bottom:9px; color:#d9f99d; font-size:calc((9px) + 1px); font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .upm-sidebar-label::before { width:3px; height:11px; flex:0 0 3px; border-radius:99px; background:linear-gradient(180deg,#bef264,#65a30d); box-shadow:0 0 8px rgba(163,230,53,.42); content:""; }
        .upm-sidebar-title { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .upm-sidebar-title .upm-sidebar-label { margin:0; }
        .upm-sidebar-title button { padding:0; border:0; background:none; color:#a3e635; font-size:calc((9px) + 1px); font-weight:700; cursor:pointer; }
        .upm-sidebar-bio, .upm-sidebar-muted { margin:0; color:#a8b0a3; font-size:calc((10px) + 1px); line-height:1.55; }
        .upm-sidebar-detail { display:flex; align-items:center; gap:7px; margin-top:8px; color:#a8b0a3; font-size:calc((10px) + 1px); overflow-wrap:anywhere; }
        .upm-sidebar-detail svg { flex:0 0 auto; color:#84cc16; }
        .upm-sidebar-detail-dot { width:5px; height:5px; flex:0 0 5px; border-radius:50%; background:#84cc16; }
        .upm-strength-card { padding:13px 11px; border-color:rgba(163,230,53,.28); background:linear-gradient(135deg,rgba(132,204,22,.11),rgba(16,185,129,.045) 52%,rgba(5,7,5,.98)); }
        .upm-sidebar-strength-top { display:flex; justify-content:space-between; gap:8px; color:#c7cec1; font-size:calc((10px) + 1px); }
        .upm-sidebar-strength-top strong { color:#d9f99d; }
        .upm-strength-track { height:4px; margin:10px 0; overflow:hidden; border-radius:99px; background:rgba(255,255,255,.1); }
        .upm-strength-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#65a30d,#a3e635); }
        .upm-strength-card button { display:flex; align-items:center; gap:4px; padding:0; border:0; background:none; color:#a3e635; font-size:calc((9px) + 1px); font-weight:800; cursor:pointer; }
        .upm-sidebar-nav { display:grid; gap:5px; padding:10px; border:1px solid #292e29; border-radius:14px; background:linear-gradient(145deg,rgba(16,21,16,.96),rgba(5,7,5,.98)); box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 22px rgba(0,0,0,.16); }
        .upm-sidebar-nav button { min-width:0; display:flex; align-items:center; gap:9px; padding:9px 8px; border:1px solid #202620; border-radius:9px; color:#b9c0b4; background:rgba(0,0,0,.28); text-align:left; font:inherit; font-size:calc((10px) + 1px); cursor:pointer; transition:background .15s,border-color .15s,color .15s,transform .15s; }
        .upm-sidebar-nav button:hover { color:#f4f8ef; border-color:rgba(163,230,53,.32); background:linear-gradient(110deg,rgba(132,204,22,.12),rgba(16,185,129,.045)); transform:translateY(-1px); }
        .upm-sidebar-nav button > svg { flex:0 0 auto; color:#93c944; }
        .upm-sidebar-nav button span { flex:1; }
        .upm-sidebar-nav button b, .upm-sidebar-nav button small { color:#9ca3af; font-size:calc((9px) + 1px); font-weight:700; }
        .upm-connections-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-top:10px; }
        .upm-connection-person { display:flex; flex-direction:column; gap:6px; min-width:0; padding:7px; border:1px solid #252b25; border-radius:11px; background:linear-gradient(155deg,rgba(255,255,255,.035),rgba(0,0,0,.34)); transition:border-color .15s,background .15s; }
        .upm-connection-person:hover { border-color:rgba(163,230,53,.28); background:linear-gradient(155deg,rgba(132,204,22,.075),rgba(0,0,0,.35)); }
        .upm-connection-person > span { width:100%; aspect-ratio:1; display:grid; place-items:center; overflow:hidden; border:1px solid rgba(255,255,255,.12); border-radius:9px; color:#d9f99d; background:linear-gradient(135deg,rgba(132,204,22,.8),rgba(16,185,129,.55)); font-size:calc((19px) + 1px); font-weight:800; }
        .upm-connection-person > span img { width:100%; height:100%; object-fit:cover; }
        .upm-connection-person > div { display:flex; flex-direction:column; min-width:0; gap:2px; }
        .upm-connection-person strong { color:#d5dbd0; font-size:calc((10px) + 1px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .upm-connection-person small { color:#788174; font-size:calc((9px) + 1px); }
        .upm-connection-actions { display:flex; justify-content:space-between; gap:8px; margin-top:8px; }
        .upm-connection-actions button, .upm-connections-back { padding:0; border:0; background:none; color:#a3e635; font-size:calc((9px) + 1px); cursor:pointer; }
        .upm-connection-actions b { margin-left:3px; color:#e3e8de; }
        .upm-connections-back { margin-top:9px; color:#aab3a5; }
        .upm-sidebar-links a { display:flex; align-items:center; gap:7px; margin-top:6px; padding:8px; border:1px solid #202620; border-radius:9px; background:rgba(0,0,0,.28); color:#b9c0b4; text-decoration:none; text-transform:capitalize; font-size:calc((10px) + 1px); transition:border-color .15s,background .15s,color .15s; }
        .upm-sidebar-links a svg:first-child { color:#93c944; }
        .upm-sidebar-links a span { flex:1; }
        .upm-sidebar-links a:hover { color:#d9f99d; border-color:rgba(163,230,53,.32); background:rgba(132,204,22,.075); }
        .upm-network-status { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:6px; padding:8px; border:1px solid #202620; border-radius:9px; background:rgba(0,0,0,.28); color:#b9c0b4; font-size:calc((10px) + 1px); text-transform:capitalize; }
        .upm-network-status small { color:#9ca3af; font-size:calc((9px) + 1px); }
        .upm-network-status small.is-linked { color:#a3e635; }
        .upm-main { min-width:0; min-height:0; height:100%; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:rgba(132,204,22,.34) transparent; background:#000; border-right:1px solid #2f3336; }
        .upm-profile-shell { position:relative; margin:8px 8px 0; padding:0 0 5px; }
        .upm-profile-hero { overflow:hidden; border:1px solid #2f3336; border-radius:18px; background:#050605; }
        .upm-profile-hero.is-boosted { border-color:transparent; }
        .upm-boost-profile, .upm-boost-profile.xvb-root, .upm-boost-profile .boost-card { width:100% !important; height:max-content !important; min-height:0 !important; max-height:none !important; }
        .upm-boost-profile .card-content { height:max-content !important; min-height:0 !important; padding:0 !important; box-sizing:border-box; }
        .upm-main::-webkit-scrollbar, .upm-profile-rail::-webkit-scrollbar { width:6px; }
        .upm-main::-webkit-scrollbar-track, .upm-profile-rail::-webkit-scrollbar-track { background:transparent; }
        .upm-main::-webkit-scrollbar-thumb, .upm-profile-rail::-webkit-scrollbar-thumb { background:rgba(132,204,22,.28); border-radius:999px; }
        .upm-profile-rail { position:relative; top:auto; right:auto; bottom:auto; width:auto; min-width:0; min-height:0; box-sizing:border-box; padding:16px 12px; overflow-y:auto; overscroll-behavior:contain; background:#000; border-left:1px solid #2f3336; z-index:3; }
        .upm-profile-rail > * { padding:14px; border:1px solid #2a2d2a; border-radius:16px; background:#050505; }
        .upm-profile-rail > * + * { margin-top:10px; }
        .upm-profile-rail::before { display:none; }
        .upm-discovery-section { display:grid; gap:4px; }
        .upm-discovery-heading { display:flex; align-items:center; gap:8px; margin-bottom:3px; color:#e7e9ea; font-size:calc((14px) + 1px); }
        .upm-discovery-heading svg { color:#a3e635; }
        .upm-discovery-person { display:flex; align-items:center; gap:9px; width:100%; min-width:0; padding:8px 2px; border:0; border-top:1px solid #202327; background:transparent; color:#e7e9ea; text-align:left; cursor:pointer; }
        .upm-discovery-person:hover, .upm-trending-row:hover { background:#080a08; }
        .upm-discovery-person:focus-visible, .upm-trending-row:focus-visible { outline:2px solid #84cc16; outline-offset:2px; border-radius:8px; }
        .upm-discovery-avatar { width:34px; height:34px; flex:none; display:grid; place-items:center; overflow:hidden; border:1px solid #2f3336; border-radius:50%; background:#101510; color:#d9f99d; font-size:calc((13px) + 1px); font-weight:800; }
        .upm-discovery-avatar img { width:100%; height:100%; object-fit:cover; }
        .upm-discovery-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:3px; }
        .upm-discovery-copy strong { overflow:hidden; color:#e7e9ea; font-size:calc((11px) + 1px); text-overflow:ellipsis; white-space:nowrap; }
        .upm-discovery-copy small, .upm-discovery-empty { color:#71767b; font-size:calc((9px) + 1px); line-height:1.4; }
        .upm-discovery-person > svg { flex:none; color:#71767b; }
        .upm-discovery-empty { padding:8px 0 2px; }
        .upm-trending { display:grid; gap:5px; }
        .upm-trending-title { display:flex; align-items:center; gap:8px; margin:0 0 3px; color:#e7e9ea; font-size:calc((14px) + 1px); }
        .upm-trending-title svg { color:#a3e635; }
        .upm-trending-row { display:flex; align-items:center; gap:9px; width:100%; min-width:0; padding:9px 2px; border:0; border-top:1px solid #202327; background:transparent; color:#e7e9ea; text-align:left; cursor:pointer; }
        .upm-trending-icon { width:26px; height:26px; flex:none; display:grid; place-items:center; border:1px solid rgba(248,113,113,.2); border-radius:8px; background:rgba(248,113,113,.08); color:#f87171; }
        .upm-trending-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:3px; }
        .upm-trending-copy strong { overflow:hidden; color:#e7e9ea; font-size:calc((11px) + 1px); text-overflow:ellipsis; white-space:nowrap; }
        .upm-trending-copy small, .upm-trending-empty { color:#71767b; font-size:calc((9px) + 1px); }
        .upm-trending-row > svg { flex:none; color:#71767b; }
        .upm-rail-search { display:flex; align-items:center; gap:8px; padding:0 12px!important; border-radius:999px!important; color:#858d81; }
        .upm-rail-search input { flex:1; min-width:0; height:38px; border:0; outline:0; background:transparent; color:#edf1e9; font:inherit; font-size:calc((10px) + 1px); }
        .upm-rail-search button { width:25px; height:25px; display:grid; place-items:center; border:1px solid #303630; border-radius:50%; background:#080a08; color:#929b8d; cursor:pointer; }

        @media (max-width: 1200px) and (min-width: 1001px) {
          .upm-sheet { grid-template-columns:56px minmax(0,640px) minmax(220px,280px); }
          .upm-profile-sidebar { display:none; }
        }
        @media (max-width: 1000px) and (min-width: 768px) {
          .upm-sheet { grid-template-columns:56px minmax(0,640px); }
          .upm-profile-sidebar, .upm-profile-rail { display:none; }
          .upm-app-rail { position:absolute; top:12px; left:12px; z-index:20; padding:0; border:0; }
          .upm-app-rail > :not(.upm-close-nav) { display:none; }
        }

        @media (max-width: 767px) {
          .upm-bd {
            inset:0; padding:0;
            align-items:flex-end;
            background:rgba(0,0,0,0.55);
          }
          .upm-sheet {
            max-width:100%;
            width:100%;
            max-height:100dvh;
            height:100dvh;
            min-height:0;
            display:block;
            padding:0;
            overscroll-behavior:contain;
            border:none; border-radius:18px 18px 0 0; box-shadow:none;
            animation:upmSUMobile .28s cubic-bezier(.34,1.2,.64,1);
          }
          .upm-section-surface { align-items:stretch; }
          .upm-section-surface { bottom:64px; }
          .upm-section-surface .upm-sheet { height:calc(100dvh - 64px); max-height:calc(100dvh - 64px); border-radius:0; }
          .upm-main { width:100%; height:100%; }
          .upm-bd, .upm-sheet, .upm-main { pointer-events:auto; touch-action:pan-y; }
          .upm-app-rail { position:absolute; top:10px; left:10px; z-index:20; display:flex; padding:0; border:0; }
          .upm-app-rail > :not(.upm-close-nav) { display:none; }
          .upm-profile-sidebar { display:none; }
          .upm-hdr { padding:18px 12px 12px; }
          .upm-profile-rail { display:none; }
          .upm-hdr, .upm-card-lower, .upm-tabs, .upm-cnt { box-sizing:border-box; }
          .upm-tabs { padding-left:10px; padding-right:10px; }
          .upm-cnt { width:100%; padding-left:0; padding-right:0; }
          .upm-verification-entry { width:calc(100% - 40px); margin-left:20px; margin-right:20px; }
        }

        .upm-load { grid-column:1 / -1; place-self:center; padding:60px 24px; display:flex; flex-direction:column; align-items:center; gap:16px; color:#a2a89f; font-size:calc((13px) + 1px); }
        .upm-spin { width:36px; height:36px; border:3px solid rgba(132,204,22,.2); border-top-color:#84cc16; border-radius:50%; animation:upmSpin .8s linear infinite; }
        .upm-spin-sm { width:22px; height:22px; border:2px solid rgba(132,204,22,.2); border-top-color:#84cc16; border-radius:50%; animation:upmSpin .8s linear infinite; }
        .upm-spin-icon { animation:upmSpin .7s linear infinite; flex-shrink:0; }
        .upm-hdr { padding:40px 24px 12px; text-align:center; position:relative; width:100%; display:flex; flex-direction:column; border-radius:24px 24px 0 0; overflow:hidden; }
        .upm-profile-header { --upm-cover-height:154px; padding:10px 16px 16px; text-align:left; background:transparent!important; }
        .upm-profile-cover { height:154px; position:relative; overflow:hidden; border:1px solid rgba(163,230,53,.42); border-radius:14px; background-color:#07100a; background-image:linear-gradient(90deg,rgba(4,10,6,.9),rgba(4,10,6,.68) 52%,rgba(4,10,6,.42)),radial-gradient(ellipse at 18% 35%,rgba(132,204,22,.28),transparent 48%),radial-gradient(ellipse at 88% 78%,rgba(16,185,129,.22),transparent 48%),linear-gradient(120deg,#101a10,#07100a 50%,#08110d); background-position:center; background-size:cover; box-shadow:inset 0 0 44px rgba(0,0,0,.34),0 8px 28px rgba(0,0,0,.2); }
        .upm-profile-cover.tier-silver,.upm-profile-cover.tier-gold,.upm-profile-cover.tier-diamond { border-color:color-mix(in srgb,var(--cover-accent) 36%,#292d29); background-image:radial-gradient(ellipse at 16% 20%,color-mix(in srgb,var(--cover-accent) 12%,transparent),transparent 46%),radial-gradient(ellipse at 86% 82%,color-mix(in srgb,var(--cover-accent) 8%,transparent),transparent 44%),linear-gradient(120deg,#101211,#050605 52%,#0d0f0e); box-shadow:inset 0 0 44px rgba(0,0,0,.34),0 8px 28px rgba(0,0,0,.2); }
        .upm-profile-cover.tier-silver .upm-cover-copy strong,.upm-profile-cover.tier-gold .upm-cover-copy strong,.upm-profile-cover.tier-diamond .upm-cover-copy strong { color:#edf0e9; text-shadow:0 0 12px color-mix(in srgb,var(--cover-accent) 18%,transparent); }
        .upm-profile-cover.tier-silver .upm-cover-grid,.upm-profile-cover.tier-gold .upm-cover-grid,.upm-profile-cover.tier-diamond .upm-cover-grid { background-image:linear-gradient(color-mix(in srgb,var(--cover-accent) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--cover-accent) 7%,transparent) 1px,transparent 1px); }
        .upm-profile-cover.tier-silver .upm-cover-brand,.upm-profile-cover.tier-gold .upm-cover-brand,.upm-profile-cover.tier-diamond .upm-cover-brand { filter:drop-shadow(0 0 8px color-mix(in srgb,var(--cover-accent) 24%,transparent)); }
        .upm-profile-cover.tier-silver .upm-cover-brand::before,.upm-profile-cover.tier-gold .upm-cover-brand::before,.upm-profile-cover.tier-diamond .upm-cover-brand::before { background:linear-gradient(145deg,rgba(255,255,255,.1),color-mix(in srgb,var(--cover-accent) 26%,#101210) 58%,#080a08); }
        .upm-profile-cover.has-custom-banner { background-color:#07100a; }
        .upm-profile-cover.has-custom-banner::after { content:none; }
        .upm-profile-banner-image { position:absolute; inset:0; z-index:0; width:100%; height:100%; object-fit:cover; object-position:center; }
        .upm-cover-grid { position:absolute; z-index:1; inset:0; background-image:linear-gradient(rgba(163,230,53,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.075) 1px,transparent 1px); background-size:28px 28px; mask-image:linear-gradient(90deg,transparent,#000 72%); }
        .upm-cover-copy { position:absolute; left:20px; top:50%; z-index:2; display:flex; flex-direction:column; gap:7px; max-width:70%; transform:translateY(-50%); }
        .upm-cover-copy span { color:#b7ef73; font-size:calc((9px) + 1px); font-weight:900; letter-spacing:.16em; }
        .upm-cover-copy strong { overflow:hidden; color:#d9f99d; font-size:calc((clamp(18px,3vw,28px)) + 1px); font-weight:900; line-height:1.1; text-overflow:ellipsis; text-shadow:0 2px 18px rgba(132,204,22,.25); }
        .upm-cover-brand { position:absolute; z-index:2; top:50%; right:24px; width:74px; height:82px; display:grid; place-items:center; transform:translateY(-50%); filter:drop-shadow(0 0 14px rgba(132,204,22,.38)); }
        .upm-cover-brand::before { position:absolute; inset:0; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); background:linear-gradient(145deg,#c5f76b,#57c725 58%,#159b63); content:""; }
        .upm-cover-brand img { position:relative; z-index:1; display:block; width:57px; height:57px; object-fit:contain; border-radius:50%; background:#060906; }
        .upm-cover-edit { position:absolute; top:12px; right:12px; z-index:2; width:32px; height:32px; display:grid; place-items:center; clip-path:none; border:2px solid rgba(7,16,10,.82); border-radius:50%; background:#f0ffc8; color:#172407; cursor:pointer; box-shadow:0 3px 12px rgba(0,0,0,.48); transition:transform .16s,background .16s; }
        .upm-cover-edit:hover { background:#fff; transform:scale(1.08); }
        .upm-cover-edit:focus-visible { outline:2px solid #fff; outline-offset:3px; }
        .upm-profile-identity-row { display:flex; align-items:flex-end; gap:12px; min-height:76px; margin-top:-49px; position:relative; z-index:2; }
        .upm-profile-action-row { position:absolute; top:calc(10px + var(--upm-cover-height) + 3px); right:18px; z-index:3; display:flex; align-items:center; justify-content:flex-end; gap:3px; flex-wrap:wrap; }
        .upm-profile-action-row .upm-fbtn { width:auto; min-height:36px; padding:7px 11px; border-radius:999px; white-space:nowrap; box-shadow:0 4px 14px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.1); }
        .upm-profile-action-row .upm-fbtn:focus-visible,.upm-xrd-btn:focus-visible { outline:2px solid #d9f99d; outline-offset:2px; }
        .upm-xrd-btn { min-height:34px; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:0 12px; border:1px solid rgba(163,230,53,.38); border-radius:999px; background:linear-gradient(135deg,#a3e635,#65a30d); color:#0a1400; font-size:calc((10px) + 1px); font-weight:900; cursor:pointer; box-shadow:0 6px 20px rgba(132,204,22,.2); }
        .upm-xrd-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
        .upm-profile-header .upm-name { justify-content:flex-start; margin:13px 0 2px; text-align:left; }
        .upm-profile-header .upm-badges { justify-content:flex-start; margin-bottom:1px; }
        .upm-profile-header .upm-uname { margin:0 0 9px; text-align:left; }
        .upm-profile-header .upm-bio { max-width:650px; margin:0 0 9px; text-align:left; }
        .upm-profile-tags { display:flex; flex-wrap:wrap; gap:6px; margin:-3px 0 9px; }
        .upm-profile-tag { display:inline-flex; align-items:center; padding:3px 8px; border:1px solid rgba(163,230,53,.3); border-radius:999px; background:rgba(132,204,22,.09); color:#c5f17e; font-size:calc((9px) + 1px); font-weight:800; line-height:1.2; }
        .upm-profile-meta { display:flex; align-items:center; flex-wrap:wrap; gap:7px; min-height:18px; margin-top:2px; color:#c6d0be; font-size:calc((10px) + 1px); }
        .upm-profile-meta-pill { display:inline-flex; align-items:center; gap:6px; min-height:25px; padding:0 9px; border:1px solid rgba(163,230,53,.2); border-radius:999px; background:linear-gradient(135deg,rgba(132,204,22,.1),rgba(16,185,129,.045)); }
        .upm-profile-meta-pill svg { flex:none; color:#a3e635; }
        .upm-name { font-size:calc((22px) + 1px); font-weight:900; margin:0 0 8px; line-height:1.2; display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,0.6); }
        .upm-name-verified { display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background:#84cc16; color:#071007; font-size:calc((12px) + 1px); font-weight:900; line-height:1; }
        .upm-badges { display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
        .upm-b-pro { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:calc((10px) + 1px); font-weight:800; color:#fbbf24; background:rgba(251,191,36,.2); border:1px solid rgba(251,191,36,.45); }
        .upm-b-ver { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:calc((10px) + 1px); font-weight:800; color:#84cc16; background:rgba(132,204,22,.15); border:1px solid rgba(132,204,22,.4); }
        .upm-uname { font-size:calc((13px) + 1px); font-weight:600; margin:0 0 10px; color:#e5e5e5; text-shadow:0 1px 8px rgba(0,0,0,0.5); }
        .upm-bio { font-size:calc((13px) + 1px); color:#d1d1d1; line-height:1.5; margin:0 0 8px; max-width:320px; margin-left:auto; margin-right:auto; text-shadow:0 1px 6px rgba(0,0,0,0.5); }
        .upm-join { font-size:calc((11px) + 1px); color:#b3b3b3; font-weight:500; margin:0; text-shadow:0 1px 4px rgba(0,0,0,0.4); }
        .upm-card-lower { margin-top:12px; padding:0 0 5px; background:transparent; }
        .upm-people-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:0 10px; }
        .upm-people-card { position:relative; container-type:inline-size; min-height:58px; display:flex; align-items:center; gap:0; width:100%; min-width:0; padding:10px 9px 10px 11px; overflow:hidden; border:1px solid #2a2d2a; border-radius:16px; background:radial-gradient(120% 160% at 100% 0%,rgba(163,230,53,.07),transparent 60%),linear-gradient(180deg,#0a0c0a,#000); color:#ececec; text-align:left; cursor:pointer; transition:transform .2s,border-color .2s,box-shadow .25s; }
        .upm-people-card::before { position:absolute; top:0; left:18px; right:18px; height:1px; background:linear-gradient(90deg,transparent,#a3e635,transparent); content:""; opacity:.42; }
        .upm-people-card:hover,.upm-people-card:focus-visible { border-color:rgba(163,230,53,.6); outline:none; transform:translateY(-1px); box-shadow:0 14px 30px -18px #a3e635; }
        .upm-people-faces { display:flex; align-items:center; flex:none; padding-right:2px; }
        .upm-people-avatar { position:relative; display:grid; place-items:center; flex:none; width:var(--avatar-size,29px); height:var(--avatar-size,29px); margin-left:-10px; overflow:visible; border:2px solid #060706; border-radius:50%; background:linear-gradient(135deg,#a3e635,#10b981); color:#06100a; font-size:calc((10px) + 1px); font-weight:800; filter:brightness(var(--avatar-brightness,1)); z-index:var(--avatar-order,0); transition:margin .3s cubic-bezier(.2,.9,.3,1),filter .25s,transform .3s; }
        .upm-people-avatar:first-child { margin-left:0; }
        .upm-people-avatar.is-front { box-shadow:0 0 0 1px rgba(163,230,53,.72),0 8px 18px -8px rgba(163,230,53,.65); }
        .upm-people-avatar img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
        .upm-people-verified { position:absolute; right:-4px; bottom:-3px; z-index:2; width:15px; height:15px; display:grid; place-items:center; border:1px solid #050705; border-radius:50%; background:#a3e635; color:#071004; filter:drop-shadow(0 0 5px rgba(163,230,53,.65)); }
        .upm-people-verified svg { fill:#a3e635; stroke:#071004; }
        .upm-people-card:hover .upm-people-avatar,.upm-people-card:focus-visible .upm-people-avatar { margin-left:-5px; filter:brightness(1); transform:translateY(-1px); }
        .upm-people-card:hover .upm-people-avatar:first-child,.upm-people-card:focus-visible .upm-people-avatar:first-child { margin-left:0; }
        .upm-people-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:4px; overflow:hidden; margin-left:12px; padding-left:12px; border-left:1px solid #2a2d2a; line-height:1; }
        .upm-people-title { display:flex; flex-wrap:wrap; align-items:baseline; column-gap:7px; row-gap:3px; min-width:0; }
        .upm-people-title strong { color:#ececec; font-size:calc((19px) + 1px); font-weight:800; letter-spacing:-.03em; }
        .upm-people-title small { color:#8a918a; font-size:calc((9px) + 1px); letter-spacing:.1em; text-transform:uppercase; }
        .upm-people-names { overflow:hidden; color:#747c72; font-size:calc((9px) + 1px); text-overflow:ellipsis; white-space:nowrap; }
        .upm-people-open { flex:none; width:25px; height:25px; display:grid; place-items:center; margin-left:6px; border:1px solid #33372f; border-radius:50%; background:#000; color:#a3e635; transition:background .2s,color .2s,border-color .2s; }
        .upm-people-card:hover .upm-people-open,.upm-people-card:focus-visible .upm-people-open { border-color:#a3e635; background:#a3e635; color:#0a1400; }
        @media(prefers-reduced-motion:reduce) { .upm-people-avatar,.upm-people-open { transition:none!important; } }
        .upm-stats { display:flex; align-items:stretch; margin:0 10px; padding:2px; border-radius:12px; background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.1); box-shadow:inset 0 1px rgba(255,255,255,.06),0 8px 22px rgba(0,0,0,.18); backdrop-filter:blur(14px); overflow:hidden; }
        .upm-stat { flex:1; padding:6px 6px; text-align:center; display:flex; flex-direction:column; gap:1px; border-radius:9px; }
        .upm-stat:hover { background:rgba(255,255,255,.035); }
        .upm-sv { font-size:calc((16px) + 1px); font-weight:900; background:linear-gradient(135deg,#84cc16,#65a30d); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .upm-sl { font-size:calc((9px) + 1px); color:#737373; font-weight:700; text-transform:uppercase; letter-spacing:.3px; }
        .upm-sdiv { width:1px; margin:7px 0; background:rgba(255,255,255,.07); }
        .upm-follow-wrap { position:relative; z-index:5; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; padding:7px 12px 1px; pointer-events:auto; }
        .upm-fbtn {
          width:100%; padding:7px 8px; border-radius:10px;
          font-size:calc((11px) + 1px); font-weight:800; letter-spacing:0.01em;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;
          position:relative; z-index:6; transition:all .25s ease; font-family:inherit; pointer-events:auto; touch-action:manipulation;
        }
        .upm-fbtn--following:hover {
          background:rgba(239,68,68,0.12) !important;
          border-color:rgba(239,68,68,0.40) !important;
          color:#ef4444 !important;
          box-shadow:none !important;
        }
        .upm-fbtn:disabled { opacity:.55; cursor:not-allowed; }
        .upm-message-btn { background:linear-gradient(145deg,rgba(37,99,235,.3),rgba(30,64,175,.17)); border:1px solid rgba(147,197,253,.62); color:#dbeafe; box-shadow:0 3px 14px rgba(37,99,235,.18),inset 0 1px rgba(255,255,255,.12); }
        .upm-message-btn:hover { background:linear-gradient(145deg,rgba(59,130,246,.4),rgba(30,64,175,.26)); border-color:#bfdbfe; color:#fff; box-shadow:0 0 20px rgba(96,165,250,.25); }
        .upm-gift-btn { background:linear-gradient(145deg,rgba(217,119,6,.28),rgba(146,64,14,.17)); border:1px solid rgba(252,211,77,.66); color:#fef3c7; box-shadow:0 3px 14px rgba(217,119,6,.16),inset 0 1px rgba(255,255,255,.1); }
        .upm-gift-btn:hover { background:linear-gradient(145deg,rgba(245,158,11,.4),rgba(180,83,9,.27)); border-color:#fde68a; color:#fff; box-shadow:0 0 20px rgba(251,191,36,.22); }
        .upm-verification-entry { margin:5px 10px 0; width:calc(100% - 20px); border-radius:11px; border:1px solid rgba(168,85,247,.3); background:radial-gradient(circle at top left,rgba(168,85,247,.16),transparent 30%),rgba(15,23,42,.78); padding:6px 8px; display:flex; align-items:center; gap:6px; cursor:pointer; color:#fff; text-align:left; }
        .upm-verification-entry:hover { border-color:rgba(168,85,247,.58); background:radial-gradient(circle at top left,rgba(168,85,247,.24),transparent 34%),rgba(15,23,42,.9); }
        .upm-verification-icon { width:30px; height:30px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:rgba(168,85,247,.16); color:#d8b4fe; flex-shrink:0; }
        .upm-verification-copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }
        .upm-verification-copy strong { font-size:calc((12px) + 1px); }
        .upm-verification-copy small { color:#c4b5fd; font-size:calc((10px) + 1px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .upm-verification-open { display:inline-flex; align-items:center; gap:4px; padding:6px 8px; border-radius:999px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); font-size:calc((10px) + 1px); font-weight:700; flex-shrink:0; }
        .upm-xrd-card { position:relative; margin:14px 10px 0; padding:14px; overflow:hidden; border:1px solid rgba(163,230,53,.42); border-radius:17px; background-color:#020402; background-image:linear-gradient(rgba(163,230,53,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.045) 1px,transparent 1px),radial-gradient(ellipse at 0 0,rgba(163,230,53,.12),transparent 55%); background-size:22px 22px,22px 22px,auto; box-shadow:inset 0 0 32px rgba(163,230,53,.025); }
        .upm-xrd-card-head { display:flex; align-items:center; gap:10px; }
        .upm-xrd-mark { width:42px; height:42px; flex:0 0 42px; display:grid; place-items:center; border-radius:12px; background:linear-gradient(140deg,#b5f35c,#65a30d); color:#101907; font-size:calc((12px) + 1px); font-weight:950; }
        .upm-xrd-card .upm-verification-copy strong { font-size:calc((13px) + 1px); }
        .upm-xrd-card .upm-verification-copy small { color:#929b8d; white-space:normal; }
        .upm-xrd-open { width:100%; min-height:34px; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:10px; border:0; border-radius:999px; background:linear-gradient(135deg,#b5f35c,#84cc16); color:#101907; font-size:calc((10px) + 1px); font-weight:900; cursor:pointer; }
        .upm-xrd-open:hover { filter:brightness(1.08); }
        .upm-xrd-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-top:9px; }
        .upm-xrd-stats > div { min-height:54px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border:1px solid #242a23; border-radius:11px; background:rgba(0,0,0,.72); }
        .upm-xrd-stats strong { color:#f1f4ec; font-size:calc((17px) + 1px); line-height:1.1; }
        .upm-xrd-stats span { color:#879080; font-size:calc((8px) + 1px); font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .upm-quick-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:0 10px 14px; }
        .upm-quick-action { min-width:0; min-height:55px; display:flex; align-items:center; gap:9px; padding:8px; border:1px solid #262a26; border-radius:13px; background:#030403; color:#f1f3ef; text-align:left; cursor:pointer; transition:border-color .15s,background .15s,transform .15s; }
        .upm-quick-action:hover { border-color:color-mix(in srgb,var(--upm-action-accent) 55%,#262a26); background:color-mix(in srgb,var(--upm-action-accent) 7%,#030403); transform:translateY(-1px); }
        .upm-quick-icon { width:30px; height:30px; flex:0 0 30px; display:grid; place-items:center; border:1px solid #292d28; border-radius:9px; background:#080a08; color:var(--upm-action-accent); }
        .upm-quick-copy { min-width:0; display:flex; flex-direction:column; gap:3px; }
        .upm-quick-copy strong { overflow:hidden; color:#eef1ea; font-size:calc((10px) + 1px); text-overflow:ellipsis; white-space:nowrap; }
        .upm-quick-copy small { overflow:hidden; color:#828a7e; font-size:calc((8px) + 1px); text-overflow:ellipsis; white-space:nowrap; }
        .upm-profile-notice { margin:0 10px 14px; color:#a3e635; font-size:calc((10px) + 1px); }
        .upm-tabs { display:flex; padding:14px 16px 0; gap:6px; }
        .upm-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:8px 6px; border-radius:10px 10px 0 0; font-size:calc((12px) + 1px); font-weight:700; font-family:inherit; border:none; border-bottom:2px solid transparent; cursor:pointer; transition:all .18s; background:rgba(255,255,255,.03); color:#525252; }
        .upm-tab.active { background:rgba(132,204,22,.08); color:#84cc16; border-bottom-color:#84cc16; }
        .upm-tc { font-size:calc((10px) + 1px); padding:1px 5px; border-radius:8px; background:rgba(255,255,255,.07); color:#737373; }
        .upm-cnt { padding:10px 14px 20px; min-height:100px; }
        .upm-cnt img, .upm-cnt video, .upm-dialog-feed img, .upm-dialog-feed video { filter:none !important; opacity:1 !important; image-rendering:auto; }
        .upm-full-feed { display:flex; flex-direction:column; gap:12px; }
        .upm-full-feed > * { width:100%; min-width:0; }
        .upm-dialog-feed { margin-top:2px; }
        .upm-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px; color:#525252; font-size:calc((13px) + 1px); }

        @media (max-width:767px) {
          .upm-profile-shell { margin:0; }
          .upm-profile-hero { border-top:0; border-radius:0 0 18px 18px; }
          .upm-profile-header { --upm-cover-height:132px; padding:0 12px 14px; }
          .upm-profile-cover { height:132px; border-top:0; border-radius:0 0 14px 14px; }
          .upm-people-grid { grid-template-columns:minmax(0,1fr); }
          .upm-cover-brand { right:18px; width:64px; height:72px; }
          .upm-cover-brand img { width:49px; height:49px; }
          .upm-cover-edit { top:10px; right:10px; bottom:auto; width:25px; height:25px; }
          .upm-cover-copy { left:15px; }
          .upm-profile-identity-row { margin-top:-42px; gap:8px; }
          .upm-profile-action-row { right:18px; gap:3px; }
          .upm-profile-action-row .upm-fbtn,.upm-xrd-btn { width:34px; min-width:34px; height:34px; min-height:34px; padding:0; border-radius:50%; }
          .upm-profile-action-row .upm-fbtn span,.upm-xrd-btn span { display:none; }
          .upm-profile-header .upm-name { margin-top:12px; font-size:calc((21px) + 1px); }
          .upm-profile-header .upm-bio { font-size:calc((12px) + 1px); }
        }
        @media (max-width:380px) {
          .upm-profile-header { --upm-cover-height:118px; }
          .upm-profile-identity-row { gap:5px; }
          .upm-profile-action-row { gap:2px; }
          .upm-profile-action-row .upm-fbtn,.upm-xrd-btn { width:30px; min-width:30px; height:30px; min-height:30px; }
          .upm-profile-action-row svg { width:14px; height:14px; }
          .upm-profile-cover { height:118px; }
        }

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