// src/components/Shared/ReelProfilePreview.jsx
// ============================================================================
// CLEAN BOOST EDITION
//
// Architecture fix: tier resolved ONCE at the top via useUserBoostTier().
// BoostAvatarRing receives tier+themeId as props only — it no longer fetches
// internally, so there's zero double-fetch, zero race condition, zero flash.
//
// Visual changes:
//   • BoostAvatarRing with new SVG-based tier rings
//   • Name + username coloured with live tier colour, CSS-transitioned
//   • Verified badge inherits tier colour when boosted
//   • Username and content timestamp stay together beneath the author
// ============================================================================

import React, { useState } from "react";
import ReactDOM                        from "react-dom";
import { Music }                       from "lucide-react";
import UserProfileModal                from "../Modals/UserProfileModal";
import BoostAvatarRing                 from "./BoostAvatarRing";
import { useUserBoostTier }            from "../../hooks/useUserBoostTier";
import mediaUrlService                 from "../../services/shared/mediaUrlService";
import { getBoostNameDesign }          from "../../services/boost/boostThemes";
import { getBoostNameColor }           from "./profileVisuals";

// ── Tier colour maps (shared with ProfilePreview) ─────────────────────────

const formatContentTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ── Component ─────────────────────────────────────────────────────────────

const ReelProfilePreview = ({
  profile,
  music,
  currentUser,
  onMusicClick,
  onProfileClick,
  size      = "medium",
  className = "",
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ── Resolve static user data from props ──────────────────────────────
  const getUserData = () => {
    if (profile.userId || profile.author) {
      // Prioritize avatar_id and resolve it, fall back to avatar prop
      let avatar = null;
      if (profile.avatar_id) {
        avatar = mediaUrlService.resolveAvatarUrl(profile.avatar_id, 140);
      } else if (profile.avatar && typeof profile.avatar === 'string') {
        if (profile.avatar.length === 1) {
          avatar = profile.avatar; // Single letter fallback
        } else {
          avatar = mediaUrlService.resolveAvatarUrl(profile.avatar, 140);
        }
      }
      
      return {
        userId:     profile.userId || profile.user_id || profile.id,
        author:     profile.author || profile.name || profile.full_name || "Unknown User",
        username:   profile.username || "unknown",
        createdAt:  profile.createdAt || null,
        avatar:     avatar,
        avatarId:   profile.avatar_id || profile.avatarId || null,
        avatarMetadata: profile.avatar_metadata || profile.avatarMetadata || null,
        userMetadata: profile.user_metadata || profile.userMetadata || null,
        identities: profile.identities || null,
        verified:   profile.verified || false,
        propTier:   profile.subscription_tier ?? profile.subscriptionTier ?? "standard",
        propThemeId:
          profile.boost_selections?.themeId ??
          profile.boostSelections?.themeId ??
          null,
        propFontId: profile.boost_selections?.fontId ?? profile.boostSelections?.fontId ?? null,
        propColorId: profile.boost_selections?.colorId ?? profile.boostSelections?.colorId ?? null,
      };
    }

    const userId      = profile.user_id || profile.id;
    const profileData = profile.profiles || profile;
    const author      =
      profileData.full_name || profile.author || profile.name || "Unknown User";
    const username    =
      profileData.username ||
      profile.username ||
      (author || "user").toLowerCase().replace(/\s+/g, "_");

    let avatar = null;
    const avatarSource =
      profileData.avatar_id ||
      profileData.avatarId ||
      profileData.avatar_url ||
      profileData.avatarUrl ||
      profile.avatar_url ||
      profile.avatarUrl ||
      profile.avatar;

    if (avatarSource) {
      avatar = mediaUrlService.resolveAvatarUrl(avatarSource, 200);
    }
    if (!avatar) {
      avatar = author.charAt(0).toUpperCase();
    }

    return {
      userId,
      author,
      username,
      createdAt: profile.createdAt || null,
      avatar,
      avatarId: profileData.avatar_id || profileData.avatarId || profile.avatar_id || profile.avatarId || null,
      avatarMetadata: profileData.avatar_metadata || profileData.avatarMetadata || profile.avatar_metadata || profile.avatarMetadata || null,
      userMetadata: profileData.user_metadata || profileData.userMetadata || profile.user_metadata || profile.userMetadata || null,
      identities: profileData.identities || profile.identities || null,
      verified:    profileData.verified || profile.verified || false,
      propTier:    profileData.subscription_tier ?? profile.subscription_tier ?? "standard",
      propThemeId:
        profileData.boost_selections?.themeId ??
        profile.boost_selections?.themeId ??
        null,
      propFontId: profileData.boost_selections?.fontId ?? profile.boost_selections?.fontId ?? null,
      propColorId: profileData.boost_selections?.colorId ?? profile.boost_selections?.colorId ?? null,
    };
  };

  const {
    userId,
    author,
    username,
    createdAt,
    avatar,
    avatarId,
    avatarMetadata,
    userMetadata,
    identities,
    verified,
    propTier,
    propThemeId,
    propFontId,
    propColorId,
  } = getUserData();

  // ── Single source of truth for boost tier ────────────────────────────
  // While loading, fall back to prop values so there's no unstyled flash.
  // After the first resolve, live data always wins.
  const { tier: liveTier, themeId: liveThemeId, fontId: liveFontId, colorId: liveColorId, loading: boostLoading } =
    useUserBoostTier(userId);

  const tier    = boostLoading ? propTier    : (liveTier    ?? null);
  const themeId = boostLoading ? propThemeId : (liveThemeId ?? null);
  const fontId  = boostLoading ? propFontId : (liveFontId ?? null);
  const colorId = boostLoading ? propColorId : (liveColorId ?? null);

  const hasBoostedTier   = ["silver", "gold", "diamond"].includes(tier);
  const nameDesign       = getBoostNameDesign(tier, fontId, colorId);
  const nameColor        = getBoostNameColor(tier, themeId);
  const displayNameColor = nameDesign.color?.color ?? nameColor ?? "#ffffff";
  const displayUserColor = displayNameColor !== "#ffffff" ? `${displayNameColor}90` : "rgba(255,255,255,0.65)";

  // ── Sizes ─────────────────────────────────────────────────────────────
  const sizes = {
    small:  { avatar: 32, name: 13, music: 11 },
    medium: { avatar: 42, name: 14, music: 11 },
    large:  { avatar: 52, name: 16, music: 12 },
  };
  const sz = sizes[size] ?? sizes.medium;

  const hasMusic = music && music.trim().length > 0;

  // ── Ensure avatar is high-quality ────────────────────────────────────────
  const enhancedAvatar =
    avatar && typeof avatar === "string" && avatar.startsWith("http")
      ? mediaUrlService.getOptimizedImageUrl(avatar, {
          width: sz.avatar * 3,
          height: sz.avatar * 3,
          quality: "100",
          format: "webp",
          crop: "fill",
          gravity: "face",
        })
      : avatar;

  const isValidUrl =
    enhancedAvatar &&
    typeof enhancedAvatar === "string" &&
    (enhancedAvatar.startsWith("http://") ||
      enhancedAvatar.startsWith("https://") ||
      enhancedAvatar.startsWith("blob:"));

  const handleProfileClick = (e) => {
    e?.stopPropagation?.();
    if (typeof onProfileClick === "function") {
      onProfileClick({
        id: userId,
        user_id: userId,
        userId,
        name: author,
        author,
        username,
        avatar,
        avatar_id: avatarId,
        avatarId,
        avatar_metadata: avatarMetadata,
        avatarMetadata,
        user_metadata: userMetadata,
        userMetadata,
        identities,
        verified,
        subscription_tier: tier,
        boost_selections: { themeId, fontId, colorId },
      });
      return;
    }
    setShowProfileModal(true);
  };
  const handleMusicClick   = (e) => {
    e.stopPropagation();
    if (hasMusic && onMusicClick) onMusicClick(music);
  };

  return (
    <>
      <div className={`rpp ${className}`}>
        <div className="rpp-container">

          {/* Avatar — BoostAvatarRing is pure display, receives resolved tier */}
          <BoostAvatarRing
            tier={hasBoostedTier ? tier : null}
            themeId={themeId}
            size={sz.avatar}
            src={isValidUrl ? enhancedAvatar : null}
            letter={
              typeof avatar === "string" && avatar.length === 1
                ? avatar
                : author?.charAt(0)?.toUpperCase() || "U"
            }
            showBadge={false}
            borderRadius="circle"
            onClick={handleProfileClick}
            style={{ cursor: "pointer", flexShrink: 0 }}
            accentColor={hasBoostedTier ? displayNameColor : undefined}
          />

          <div className="rpp-text">
            {/* Author name */}
            <div
              className="rpp-name"
              style={{
                fontSize:      sz.name,
                fontFamily:    nameDesign.font?.family,
                fontWeight:    nameDesign.font?.weight || 700,
                letterSpacing: nameDesign.font?.spacing,
                color:         displayNameColor,
                display:       "inline-flex",
                alignItems:    "center",
                gap:           6,
                minWidth:      0,
                textShadow:    hasBoostedTier
                  ? `0 0 14px ${displayNameColor}50, 0 2px 6px rgba(0,0,0,0.9)`
                  : "0 2px 6px rgba(0,0,0,0.9)",
                transition:    "color 0.4s ease, text-shadow 0.4s ease",
              }}
              onClick={handleProfileClick}
            >
              <span style={{ display: "inline-block", minWidth: 0 }}>{author}</span>
              {verified && (
                <span
                  className="rpp-verified"
                  style={{
                    background: hasBoostedTier
                      ? `linear-gradient(135deg,${displayNameColor},${displayNameColor}bb)`
                      : "linear-gradient(135deg,#22c55e,#4ade80)",
                    boxShadow:  `0 2px 8px ${displayNameColor || '#22c55e'}55`,
                    border:     "1.5px solid rgba(255,255,255,0.7)",
                    transition: "background 0.4s ease, box-shadow 0.4s ease",
                  }}
                  aria-label="Verified account"
                  title="Verified account"
                >
                  ✓
                </span>
              )}
            </div>

            <div className="rpp-username" style={{ color: displayUserColor }}>
              <span>@{username}</span>
              {createdAt && formatContentTime(createdAt) && (
                <span className="rpp-content-time" title={new Date(createdAt).toLocaleString()}>
                  · {formatContentTime(createdAt)}
                </span>
              )}
            </div>

            {/* Music row */}
            <button
              className={`rpp-music${!hasMusic ? " rpp-music--silent" : ""}`}
              onClick={handleMusicClick}
              style={{ fontSize: sz.music }}
              disabled={!hasMusic}
            >
              <Music size={sz.music + 1} />
              {hasMusic ? (
                <span className="rpp-music-text">{music}</span>
              ) : (
                <span className="rpp-music-text">No sound used</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Profile modal — receives already-resolved tier + themeId */}
      {showProfileModal &&
        ReactDOM.createPortal(
          <UserProfileModal
            user={{
              id:                userId,
              user_id:           userId,
              userId,
              name:              author,
              author,
              username,
              avatar,
              avatar_id: avatarId,
              avatarId,
              avatar_metadata: avatarMetadata,
              avatarMetadata,
              verified,
              subscription_tier: tier,
              boost_selections:  { themeId, fontId, colorId },
            }}
            currentUser={currentUser}
            onClose={() => setShowProfileModal(false)}
          />,
          document.body
        )}

      <style>{`
        .rpp { display:flex; max-width:fit-content; }

        .rpp-container {
          display:flex; align-items:center; gap:10px;
          background:rgba(0,0,0,0.50);
          backdrop-filter:blur(10px);
          padding:6px 12px 6px 6px;
          border-radius:12px;
          border:1px solid rgba(255,255,255,0.10);
          transition:background 0.2s;
        }
        .rpp-container:hover { background:rgba(0,0,0,0.65); }

        .rpp-text {
          display:flex; flex-direction:column; gap:1px; min-width:0;
        }

        .rpp-name {
          font-weight:700;
          display:flex; align-items:center; gap:6px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          cursor:pointer;
          transition:transform 0.2s;
        }
        .rpp-name:hover { transform:scale(1.02); }
        .rpp-username {
          display:flex; align-items:center; gap:5px; min-width:0;
          margin-top:2px;
          font-size:${Math.max(10, sz.music - 1)}px; font-weight:600;
          white-space:nowrap;
        }
        .rpp-username > span:first-child { overflow:hidden; text-overflow:ellipsis; }
        .rpp-content-time { flex-shrink:0; color:rgba(255,255,255,.48); font-weight:500; }

        .rpp-verified {
          width:18px; height:18px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          color:#000; flex-shrink:0;
        }

        .rpp-music {
          background:transparent; padding:0; border:none;
          display:flex; align-items:center; gap:4px;
          color:rgba(255,255,255,0.70); cursor:pointer;
          transition:all 0.2s; max-width:180px;
          text-shadow:0 1px 4px rgba(0,0,0,0.9); text-align:left;
        }
        .rpp-music--silent { cursor:default; opacity:0.70; }
        .rpp-music:not(.rpp-music--silent):hover { color:#84cc16; transform:scale(1.02); }

        .rpp-music-text {
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:500;
        }

        .rpp-music-animated {
          position:relative; display:inline-block;
          height:1.2em; overflow:hidden; width:100%;
        }

        .rpp-slide {
          position:absolute; top:0; left:0; width:100%;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          font-weight:500; opacity:0; transform:translateY(20px);
          transition:all 0.5s cubic-bezier(0.4,0,0.2,1);
        }
        .rpp-slide--on { opacity:1; transform:translateY(0); }

        @media (max-width:768px) {
          .rpp-container { padding:5px 10px 5px 5px; }
          .rpp-music { max-width:160px; }
        }
      `}</style>
    </>
  );
};

export default ReelProfilePreview;