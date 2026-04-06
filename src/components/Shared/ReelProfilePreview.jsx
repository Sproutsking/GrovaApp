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
//   • Music row and slot animation logic unchanged
// ============================================================================

import React, { useState, useEffect } from "react";
import ReactDOM                        from "react-dom";
import { Sparkles, Music }             from "lucide-react";
import UserProfileModal                from "../Modals/UserProfileModal";
import BoostAvatarRing                 from "./BoostAvatarRing";
import { useUserBoostTier }            from "../../hooks/useUserBoostTier";
import mediaUrlService                 from "../../services/shared/mediaUrlService";

// ── Tier colour maps (shared with ProfilePreview) ─────────────────────────

const TIER_NAME_COLORS = {
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

const getNameColor = (tier, themeId) => {
  if (!tier || !TIER_NAME_COLORS[tier]) return null;
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId]) {
    return DIAMOND_THEME_COLORS[themeId];
  }
  return TIER_NAME_COLORS[tier];
};

// ── Component ─────────────────────────────────────────────────────────────

const ReelProfilePreview = ({
  profile,
  music,
  currentUser,
  onMusicClick,
  size      = "medium",
  className = "",
}) => {
  const [animationIndex,   setAnimationIndex]   = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ── Resolve static user data from props ──────────────────────────────
  const getUserData = () => {
    if (profile.userId || profile.author) {
      return {
        userId:     profile.userId || profile.user_id || profile.id,
        author:     profile.author || profile.name || profile.full_name || "Unknown User",
        username:   profile.username || "unknown",
        avatar:     profile.avatar,
        verified:   profile.verified || false,
        propTier:   profile.subscription_tier ?? profile.subscriptionTier ?? "standard",
        propThemeId:
          profile.boost_selections?.themeId ??
          profile.boostSelections?.themeId ??
          null,
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
    if (profileData.avatar_id) {
      avatar = mediaUrlService.getAvatarUrl(profileData.avatar_id, 200);
    } else if (profile.avatar) {
      avatar = profile.avatar;
    } else {
      avatar = author.charAt(0).toUpperCase();
    }

    return {
      userId,
      author,
      username,
      avatar,
      verified:    profileData.verified || profile.verified || false,
      propTier:    profileData.subscription_tier ?? profile.subscription_tier ?? "standard",
      propThemeId:
        profileData.boost_selections?.themeId ??
        profile.boost_selections?.themeId ??
        null,
    };
  };

  const {
    userId,
    author,
    username,
    avatar,
    verified,
    propTier,
    propThemeId,
  } = getUserData();

  // ── Single source of truth for boost tier ────────────────────────────
  // While loading, fall back to prop values so there's no unstyled flash.
  // After the first resolve, live data always wins.
  const { tier: liveTier, themeId: liveThemeId, loading: boostLoading } =
    useUserBoostTier(userId);

  const tier    = boostLoading ? propTier    : (liveTier    ?? null);
  const themeId = boostLoading ? propThemeId : (liveThemeId ?? null);

  const hasBoostedTier   = ["silver", "gold", "diamond"].includes(tier);
  const nameColor        = getNameColor(tier, themeId);
  const displayNameColor = nameColor ?? "#ffffff";
  const displayUserColor = nameColor ? `${nameColor}90` : "rgba(255,255,255,0.65)";

  // ── Sizes ─────────────────────────────────────────────────────────────
  const sizes = {
    small:  { avatar: 32, name: 13, music: 11 },
    medium: { avatar: 42, name: 14, music: 11 },
    large:  { avatar: 52, name: 16, music: 12 },
  };
  const sz = sizes[size] ?? sizes.medium;

  const hasMusic = music && music.trim().length > 0;

  // Slot-machine text when there's no music
  useEffect(() => {
    if (hasMusic) return;
    const id = setInterval(() => setAnimationIndex((p) => (p + 1) % 2), 3000);
    return () => clearInterval(id);
  }, [hasMusic]);

  // ── Resolve avatar URL ────────────────────────────────────────────────
  let enhancedAvatar = avatar;
  if (avatar && typeof avatar === "string") {
    const cleanUrl = avatar.split("?")[0];
    if (cleanUrl.includes("supabase") || cleanUrl.includes("cloudinary")) {
      const targetPx = sz.avatar * 3;
      enhancedAvatar = avatar.includes("?")
        ? avatar
        : `${cleanUrl}?quality=100&width=${targetPx}&height=${targetPx}&resize=cover&format=webp`;
    }
  }
  const isValidUrl =
    enhancedAvatar &&
    typeof enhancedAvatar === "string" &&
    (enhancedAvatar.startsWith("http://") ||
      enhancedAvatar.startsWith("https://") ||
      enhancedAvatar.startsWith("blob:"));

  const handleProfileClick = (e) => { e.stopPropagation(); setShowProfileModal(true); };
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
          />

          <div className="rpp-text">
            {/* Author name */}
            <div
              className="rpp-name"
              style={{
                fontSize:   sz.name,
                color:      displayNameColor,
                textShadow: hasBoostedTier
                  ? `0 0 14px ${displayNameColor}50, 0 2px 6px rgba(0,0,0,0.9)`
                  : "0 2px 6px rgba(0,0,0,0.9)",
                transition: "color 0.4s ease, text-shadow 0.4s ease",
              }}
              onClick={handleProfileClick}
            >
              <span>{author}</span>
              {verified && (
                <span
                  className="rpp-verified"
                  style={{
                    background: hasBoostedTier
                      ? `linear-gradient(135deg,${displayNameColor},${displayNameColor}bb)`
                      : "linear-gradient(135deg,#84cc16,#a3e635)",
                    boxShadow:  `0 2px 8px ${displayNameColor}55`,
                    transition: "background 0.4s ease, box-shadow 0.4s ease",
                  }}
                >
                  <Sparkles size={sz.name - 2} />
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
                <span className="rpp-music-animated">
                  <span className={`rpp-slide${animationIndex === 0 ? " rpp-slide--on" : ""}`}>
                    No sound used
                  </span>
                  <span className={`rpp-slide${animationIndex === 1 ? " rpp-slide--on" : ""}`}>
                    @{username}
                  </span>
                </span>
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
              verified,
              subscription_tier: tier,
              boost_selections:  { themeId },
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