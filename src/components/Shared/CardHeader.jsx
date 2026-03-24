// src/components/Shared/CardHeader.jsx
// ============================================================================
// BOOST RING EDITION — Complete fix
// - Avatar correctly shows boost ring with tier + themeId
// - Name color = tier color with glow text-shadow
// - Username = tier color at 60% opacity
// - Follow/unfollow with tier-colored border when boosted
// - themeId resolved from every possible prop shape
// ============================================================================

import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck, MoreVertical, Loader } from "lucide-react";
import followService from "../../services/social/followService";
import BoostAvatarRing from "./BoostAvatarRing";

// ── relative time ─────────────────────────────────────────────────────────────
const relativeTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const wk = Math.floor(d / 7);
  if (wk < 5) return `${wk}w`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ── Tier name color helpers ───────────────────────────────────────────────────
const TIER_NAME_COLORS = {
  silver: "#d4d4d4",
  gold: "#fbbf24",
  diamond: "#a78bfa",
};
const DIAMOND_THEME_COLORS = {
  "diamond-cosmos": "#a78bfa",
  "diamond-glacier": "#60a5fa",
  "diamond-emerald": "#34d399",
  "diamond-rose": "#f472b6",
  "diamond-void": "#e5e5e5",
  "diamond-inferno": "#ff6b35",
  "diamond-aurora": "#22d3ee",
};

const getNameColor = (tier, themeId) => {
  if (!tier || !["silver", "gold", "diamond"].includes(tier)) return null;
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId])
    return DIAMOND_THEME_COLORS[themeId];
  return TIER_NAME_COLORS[tier] ?? null;
};

// ── CardHeader ────────────────────────────────────────────────────────────────
const CardHeader = ({
  profile,
  createdAt,
  currentUser,
  onAuthorClick,
  onMenuClick,
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isOwn = currentUser?.id && profile?.userId === currentUser.id;
  const showFollow = !isOwn && !!currentUser?.id;

  const hasBoostedTier = ["silver", "gold", "diamond"].includes(
    profile?.subscriptionTier ?? profile?.subscription_tier ?? "",
  );
  const tier = profile?.subscriptionTier ?? profile?.subscription_tier ?? null;

  // Resolve themeId from every possible prop shape
  const themeId =
    profile?.themeId ??
    profile?.boost_selections?.themeId ??
    profile?.boostSelections?.themeId ??
    null;

  const nameColor = hasBoostedTier
    ? (getNameColor(tier, themeId) ?? "#fff")
    : "#fff";
  const glowColor = hasBoostedTier ? `${nameColor}50` : "transparent";

  useEffect(() => {
    if (!currentUser?.id || !profile?.userId || isOwn) return;
    followService
      .isFollowing(currentUser.id, profile.userId)
      .then(setIsFollowing)
      .catch(() => {});
  }, [profile?.userId, currentUser?.id, isOwn]);

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id || isLoading) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setIsLoading(true);
    try {
      if (next) await followService.followUser(currentUser.id, profile.userId);
      else await followService.unfollowUser(currentUser.id, profile.userId);
    } catch {
      setIsFollowing(!next);
    } finally {
      setIsLoading(false);
    }
  };

  const initial = (profile?.author || "U").charAt(0).toUpperCase();

  // Build avatar src
  let avatarSrc = null;
  if (
    profile?.avatar &&
    typeof profile.avatar === "string" &&
    profile.avatar.startsWith("http")
  ) {
    const cleanUrl = profile.avatar.split("?")[0];
    if (cleanUrl.includes("supabase") || cleanUrl.includes("cloudinary")) {
      avatarSrc = `${cleanUrl}?quality=100&width=120&height=120&resize=cover&format=webp`;
    } else {
      avatarSrc = profile.avatar;
    }
  }

  return (
    <div className="ch-root">
      {/* Avatar with boost ring */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onAuthorClick?.(profile);
        }}
      >
        <BoostAvatarRing
          userId={profile?.userId}
          tier={hasBoostedTier ? tier : null}
          themeId={hasBoostedTier ? themeId : null}
          size={38}
          src={avatarSrc}
          letter={initial}
          showBadge={hasBoostedTier}
          borderRadius="circle"
          style={{ cursor: "pointer" }}
        />
      </div>

      {/* Name + handle + time */}
      <div
        className="ch-info"
        onClick={(e) => {
          e.stopPropagation();
          onAuthorClick?.(profile);
        }}
      >
        <div className="ch-name-row">
          <span
            className="ch-name"
            style={{
              color: nameColor,
              textShadow: hasBoostedTier ? `0 0 10px ${glowColor}` : "none",
              transition: "color 0.3s",
            }}
          >
            {profile?.author || "Unknown"}
          </span>
          {profile?.verified && (
            <span className="ch-verified" style={{ color: nameColor }}>
              ✦
            </span>
          )}
        </div>
        <div className="ch-sub-row">
          <span
            className="ch-handle"
            style={{
              color: hasBoostedTier
                ? `${nameColor}70`
                : "rgba(255,255,255,0.38)",
              transition: "color 0.3s",
            }}
          >
            @{profile?.username || "unknown"}
          </span>
          {createdAt && (
            <>
              <span className="ch-dot">·</span>
              <span className="ch-time">{relativeTime(createdAt)}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Follow / Unfollow */}
      {showFollow && (
        <button
          className={`ch-follow-btn${isFollowing ? " ch-follow-btn--following" : " ch-follow-btn--not"}`}
          onClick={handleFollow}
          disabled={isLoading}
          aria-label={isFollowing ? "Unfollow" : "Follow"}
          style={
            hasBoostedTier
              ? {
                  borderColor: `${nameColor}45`,
                  color: nameColor,
                  background: isFollowing ? `${nameColor}12` : "transparent",
                }
              : {}
          }
        >
          {isLoading ? (
            <Loader size={12} className="ch-follow-spinner" />
          ) : isFollowing ? (
            <>
              <UserCheck size={12} />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus size={12} />
              <span>Follow</span>
            </>
          )}
        </button>
      )}

      {/* Three-dot menu */}
      <button
        className="ch-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          onMenuClick?.(e);
        }}
        aria-label="More options"
      >
        <MoreVertical size={18} />
      </button>

      <style>{`
        .ch-root { display:flex; align-items:center; gap:10px; padding:12px 14px 10px; }
        .ch-info { display:flex; flex-direction:column; gap:2px; min-width:0; cursor:pointer; flex:1; }
        .ch-name-row { display:flex; align-items:center; gap:5px; }
        .ch-name { font-size:13.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
        .ch-verified { font-size:9px; flex-shrink:0; line-height:1; }
        .ch-sub-row { display:flex; align-items:center; gap:4px; }
        .ch-handle { font-size:11.5px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ch-dot  { font-size:11px; color:rgba(255,255,255,0.2); flex-shrink:0; }
        .ch-time { font-size:11px; color:rgba(255,255,255,0.3); font-weight:500; flex-shrink:0; white-space:nowrap; }
        .ch-follow-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:999px; font-size:11.5px; font-weight:700; cursor:pointer; flex-shrink:0; transition:all 0.2s; white-space:nowrap; font-family:inherit; line-height:1; border:1px solid transparent; }
        .ch-follow-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .ch-follow-btn--not { background:transparent; border-color:rgba(132,204,22,0.45); color:#84cc16; }
        .ch-follow-btn--not:hover:not(:disabled) { background:rgba(132,204,22,0.1); border-color:#84cc16; }
        .ch-follow-btn--following { background:rgba(132,204,22,0.1); border-color:rgba(132,204,22,0.25); color:rgba(132,204,22,0.8); }
        .ch-follow-btn--following:hover:not(:disabled) { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.3); color:#ef4444; }
        @keyframes ch-spin { to { transform:rotate(360deg); } }
        .ch-follow-spinner { animation:ch-spin 0.7s linear infinite; }
        .ch-menu-btn { width:32px; height:32px; border-radius:8px; flex-shrink:0; background:transparent; border:none; color:rgba(255,255,255,0.3); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s; }
        .ch-menu-btn:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.7); }
      `}</style>
    </div>
  );
};

export default CardHeader;

// ── CategoryTag ───────────────────────────────────────────────────────────────
export const CategoryTag = ({ category, onClick }) => {
  if (!category) return null;
  return (
    <div
      className="ctag-root"
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(category);
            }
          : undefined
      }
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <span className="ctag-dot" />
      <span className="ctag-label">{category}</span>
      <style>{`
        .ctag-root { display:inline-flex; align-items:center; gap:6px; padding:4px 10px 4px 8px; border-radius:999px; background:rgba(132,204,22,0.07); border:1px solid rgba(132,204,22,0.18); margin:0 14px 10px; width:fit-content; transition:background 0.15s,border-color 0.15s; }
        .ctag-root:hover { background:rgba(132,204,22,0.12); border-color:rgba(132,204,22,0.3); }
        .ctag-dot { width:5px; height:5px; border-radius:50%; background:#84cc16; flex-shrink:0; }
        .ctag-label { font-size:10.5px; font-weight:700; color:rgba(132,204,22,0.8); letter-spacing:0.04em; text-transform:uppercase; line-height:1; }
      `}</style>
    </div>
  );
};
