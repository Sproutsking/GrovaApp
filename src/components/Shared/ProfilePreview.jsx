// src/components/Shared/ProfilePreview.jsx — FULL BOOST INTEGRATION
// ============================================================================
// Changes:
//   - BoostAvatarRing used everywhere — boost ring border visible in posts/reels/stories
//   - Tier name color + username color passed through
//   - Image rendered at full clarity — no blur, no opacity tricks on the wrapper
//   - themeId threaded through to BoostAvatarRing
// ============================================================================

import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Sparkles } from "lucide-react";
import UserProfileModal from "../Modals/UserProfileModal";
import mediaUrlService from "../../services/shared/mediaUrlService";
import { getTierBadge } from "../../services/account/profileTierService";
import BoostAvatarRing from "./BoostAvatarRing";

// ── Tier color helper ─────────────────────────────────────────────────────────
const TIER_NAME_COLORS = {
  silver: "#d4d4d4",
  gold: "#fbbf24",
  diamond: "#a78bfa",
};

// Diamond theme accent overrides
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
  if (tier === "diamond" && themeId && DIAMOND_THEME_COLORS[themeId]) {
    return DIAMOND_THEME_COLORS[themeId];
  }
  return TIER_NAME_COLORS[tier] ?? null;
};

const TierBadge = ({ tier, paymentStatus }) => {
  const badge = getTierBadge(tier, paymentStatus);
  if (!badge) return null;
  return (
    <span
      title={badge.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        lineHeight: 1,
        filter: `drop-shadow(0 0 4px ${badge.glow})`,
        flexShrink: 0,
      }}
    >
      {badge.emoji}
    </span>
  );
};

const ProfilePreview = ({
  profile,
  currentUser,
  size = "medium",
  layout = "horizontal",
  showUsername = true,
  className = "",
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);

  const getUserData = () => {
    if (profile.userId || profile.author) {
      return {
        userId: profile.userId || profile.user_id || profile.id,
        author:
          profile.author || profile.name || profile.full_name || "Unknown User",
        username: profile.username || "unknown",
        avatar: profile.avatar,
        verified: profile.verified || false,
        subscriptionTier:
          profile.subscription_tier ?? profile.subscriptionTier ?? "standard",
        paymentStatus:
          profile.payment_status ?? profile.paymentStatus ?? "pending",
        themeId:
          profile.boost_selections?.themeId ??
          profile.boostSelections?.themeId ??
          null,
      };
    }
    const userId = profile.user_id || profile.id;
    const profileData = profile.profiles || profile;
    const author =
      profileData.full_name || profile.author || profile.name || "Unknown User";
    const username =
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
      verified: profileData.verified || profile.verified || false,
      subscriptionTier:
        profileData.subscription_tier ??
        profile.subscription_tier ??
        "standard",
      paymentStatus:
        profileData.payment_status ?? profile.payment_status ?? "pending",
      themeId:
        profileData.boost_selections?.themeId ??
        profile.boost_selections?.themeId ??
        profile.boostSelections?.themeId ??
        null,
    };
  };

  const userData = getUserData();
  const {
    userId,
    author,
    username,
    avatar,
    verified,
    subscriptionTier,
    paymentStatus,
    themeId,
  } = userData;

  const hasBoostedTier = ["silver", "gold", "diamond"].includes(
    subscriptionTier,
  );
  const nameColor = getNameColor(subscriptionTier, themeId);
  const displayNameColor = nameColor ?? "#ffffff";
  const displayUserColor = nameColor
    ? `${nameColor}90`
    : "rgba(255,255,255,0.65)";

  const sizes = {
    small: { avatar: 32, name: 13, username: 11 },
    medium: { avatar: 42, name: 14, username: 12 },
    large: { avatar: 52, name: 16, username: 13 },
  };
  const currentSize = sizes[size] ?? sizes.medium;

  const handleClick = (e) => {
    e.stopPropagation();
    setShowProfileModal(true);
  };

  // Enhance avatar URL for full quality — no blur
  let enhancedAvatar = avatar;
  if (avatar && typeof avatar === "string") {
    const cleanUrl = avatar.split("?")[0];
    if (cleanUrl.includes("supabase") || cleanUrl.includes("cloudinary")) {
      const targetSize = currentSize.avatar * 3;
      enhancedAvatar = avatar.includes("?")
        ? avatar
        : `${cleanUrl}?quality=100&width=${targetSize}&height=${targetSize}&resize=cover&format=webp`;
    }
  }
  const isValidUrl =
    enhancedAvatar &&
    typeof enhancedAvatar === "string" &&
    (enhancedAvatar.startsWith("http://") ||
      enhancedAvatar.startsWith("https://") ||
      enhancedAvatar.startsWith("blob:"));

  return (
    <>
      <div
        className={`profile-preview profile-preview-${layout} ${className}`}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        {/* BoostAvatarRing — shows boost ring in posts/reels/stories */}
        <BoostAvatarRing
          userId={userId}
          tier={hasBoostedTier ? subscriptionTier : null}
          themeId={themeId}
          size={currentSize.avatar}
          src={isValidUrl ? enhancedAvatar : null}
          letter={
            typeof avatar === "string" && avatar.length === 1
              ? avatar
              : author?.charAt(0)?.toUpperCase() || "U"
          }
          showBadge={false} /* badge shown separately via TierBadge */
          onClick={handleClick}
          borderRadius="circle"
          style={{ cursor: "pointer", flexShrink: 0 }}
        />

        <div className="profile-preview-info">
          {/* Name — tier color + glow for boosted */}
          <div
            style={{
              fontSize: `${currentSize.name}px`,
              fontWeight: 700,
              color: displayNameColor,
              display: "flex",
              alignItems: "center",
              gap: 5,
              textShadow: hasBoostedTier
                ? `0 0 14px ${displayNameColor}50`
                : "0 2px 6px rgba(0,0,0,0.9)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "color 0.3s",
            }}
          >
            <span>{author}</span>
            {verified && (
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: hasBoostedTier
                    ? `linear-gradient(135deg,${displayNameColor},${displayNameColor}bb)`
                    : "linear-gradient(135deg,#84cc16,#a3e635)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000",
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${displayNameColor}55`,
                }}
              >
                <Sparkles size={currentSize.name - 2} />
              </div>
            )}
            <TierBadge tier={subscriptionTier} paymentStatus={paymentStatus} />
          </div>

          {/* Username — faded tier color */}
          {showUsername && username && (
            <div
              style={{
                fontSize: `${currentSize.username}px`,
                color: displayUserColor,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "color 0.3s",
              }}
            >
              @{username}
            </div>
          )}
        </div>
      </div>

      {showProfileModal &&
        ReactDOM.createPortal(
          <UserProfileModal
            user={{
              id: userId,
              user_id: userId,
              userId,
              name: author,
              author,
              username,
              avatar,
              verified,
              subscription_tier: subscriptionTier,
              payment_status: paymentStatus,
            }}
            currentUser={currentUser}
            onClose={() => setShowProfileModal(false)}
          />,
          document.body,
        )}

      <style>{`
        .profile-preview {
          display:flex; align-items:center;
          transition:all 0.2s; max-width:fit-content;
          background:rgba(0,0,0,0.06);
          padding:4px 10px 4px 4px;
          border-radius:12px; border:1px solid transparent;
        }
        .profile-preview:hover  { transform:scale(1.02); }
        .profile-preview:active { transform:scale(0.98); }
        .profile-preview-horizontal { flex-direction:row; gap:8px; }
        .profile-preview-vertical   { flex-direction:column; gap:6px; text-align:center; }
        .profile-preview-info { display:flex; flex-direction:column; gap:2px; min-width:0; }
        @media (max-width:768px) { .profile-preview { padding:4px 8px 4px 4px; } }
      `}</style>
    </>
  );
};

export default ProfilePreview;
