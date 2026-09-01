// src/components/Shared/ProfilePreview.jsx
// ============================================================================
// LIVE BOOST EDITION
//
// useUserBoostTier(userId) is the single source of truth for tier + themeId.
// Prop-level subscription_tier / themeId values serve as instant render hints
// only (preventing an unstyled flash on first paint) — the live hook overwrites
// them on its first resolution and keeps them current via realtime subscription.
//
// Visual updates are CSS-transitioned so boost activations / cancellations
// feel fluid rather than jarring.
//
// KEY: currentUser must be passed in from the parent so UserProfileModal can
// render the follow button correctly. PostCard (and all other callers) must
// forward their currentUser prop here.
// ============================================================================

import React, { useState } from "react";
import ReactDOM             from "react-dom";
import { Sparkles }         from "lucide-react";
import UserProfileModal     from "../Modals/UserProfileModal";
import mediaUrlService      from "../../services/shared/mediaUrlService";
import { getTierBadge }     from "../../services/account/profileTierService";
import BoostAvatarRing      from "./BoostAvatarRing";
import { useUserBoostTier } from "../../hooks/useUserBoostTier";
import { getBoostNameColor } from "./profileVisuals";
import { getBoostNameDesign } from "../../services/boost/boostThemes";

// ── Tier colour helpers ───────────────────────────────────────────────────────

// ── Tier badge emoji pill ─────────────────────────────────────────────────────

const TierBadge = ({ tier, paymentStatus }) => {
  const badge = getTierBadge(tier, paymentStatus);
  if (!badge) return null;
  return (
    <span
      title={badge.label}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        fontSize:       10,
        lineHeight:     1,
        filter:         `drop-shadow(0 0 4px ${badge.glow})`,
        flexShrink:     0,
      }}
    >
      {badge.emoji}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ProfilePreview = ({
  profile,
  currentUser,           // REQUIRED for follow button in UserProfileModal
  size         = "medium",
  layout       = "horizontal",
  showUsername = true,
  className    = "",
  onClick,               // optional external click override
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ── Resolve static data from props ───────────────────────────────────────
  const resolveUserData = () => {
    // Flat shape (from post author objects, DMs, notifications, etc.)
    if (profile.userId || profile.author) {
      // Prioritize avatar_id and resolve it, fall back to avatar prop
      let avatar = null;
      if (profile.avatar_id) {
        avatar = mediaUrlService.resolveAvatarUrl(profile.avatar_id, 160);
      } else if (profile.avatar && typeof profile.avatar === 'string') {
        if (profile.avatar.length === 1) {
          avatar = profile.avatar; // Single letter fallback
        } else {
          avatar = mediaUrlService.resolveAvatarUrl(profile.avatar, 160);
        }
      }
      
      return {
        userId:            profile.userId || profile.user_id || profile.id,
        author:            profile.author || profile.name || profile.full_name || "Unknown User",
        username:          profile.username || "unknown",
        avatar:            avatar,
        verified:          profile.verified || false,
        propTier:          profile.subscription_tier ?? profile.subscriptionTier ?? "standard",
        propPaymentStatus: profile.payment_status ?? profile.paymentStatus ?? "pending",
        propThemeId:
          profile.boost_selections?.themeId ??
          profile.boostSelections?.themeId  ??
          null,
        propFontId: profile.boost_selections?.fontId ?? profile.boostSelections?.fontId ?? null,
        propColorId: profile.boost_selections?.colorId ?? profile.boostSelections?.colorId ?? null,
      };
    }

    // Nested shape (from Supabase joins: profile.profiles = {...})
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
      profile.avatar ||
      profileData.avatar_metadata ||
      profile.avatar_metadata;
    if (avatarSource) {
      avatar = mediaUrlService.resolveAvatarUrl(avatarSource, 200);
    }
    if (!avatar && profile.avatar) {
      avatar = mediaUrlService.resolveAvatarUrl(profile.avatar, 200);
    }
    if (!avatar) {
      avatar = author.charAt(0).toUpperCase();
    }

    return {
      userId,
      author,
      username,
      avatar,
      verified:          profileData.verified || profile.verified || false,
      propTier:          profileData.subscription_tier ?? profile.subscription_tier ?? "standard",
      propPaymentStatus: profileData.payment_status   ?? profile.payment_status    ?? "pending",
      propThemeId:
        profileData.boost_selections?.themeId ??
        profile.boost_selections?.themeId     ??
        profile.boostSelections?.themeId      ??
        null,
      propFontId: profileData.boost_selections?.fontId ?? profile.boost_selections?.fontId ?? null,
      propColorId: profileData.boost_selections?.colorId ?? profile.boost_selections?.colorId ?? null,
    };
  };

  const {
    userId,
    author,
    username,
    avatar,
    verified,
    propTier,
    propPaymentStatus,
    propThemeId,
    propFontId,
    propColorId,
  } = resolveUserData();

  // ── Live boost tier — the authoritative source ────────────────────────────
  const {
    tier:    liveTier,
    themeId: liveThemeId,
    fontId: liveFontId,
    colorId: liveColorId,
    loading: boostLoading,
  } = useUserBoostTier(userId);

  // While the hook's first fetch is in-flight, use prop values to prevent flash
  const tier          = boostLoading ? propTier    : (liveTier    ?? null);
  const themeId       = boostLoading ? propThemeId : (liveThemeId ?? null);
  const fontId        = boostLoading ? propFontId : (liveFontId ?? null);
  const colorId        = boostLoading ? propColorId : (liveColorId ?? null);
  const paymentStatus = propPaymentStatus;

  const hasBoostedTier   = ["silver", "gold", "diamond"].includes(tier);
  const nameColor        = getBoostNameColor(tier, themeId);
  const nameDesign       = getBoostNameDesign(tier, fontId, colorId);
  const displayNameColor = nameDesign.color?.color ?? nameColor ?? "#ffffff";
  const displayUserColor = displayNameColor !== "#ffffff" ? `${displayNameColor}90` : "rgba(255,255,255,0.65)";

  // ── Avatar size table ─────────────────────────────────────────────────────
  const sizes = {
    small:  { avatar: 32, name: 13, username: 11 },
    medium: { avatar: 42, name: 14, username: 12 },
    large:  { avatar: 52, name: 16, username: 13 },
  };
  const sz = sizes[size] ?? sizes.medium;

  // ── Ensure avatar is high-quality ─────────────────────────────────────────
  // mediaUrlService.resolveAvatarUrl() already optimizes, but if a direct URL
  // slips through, enhance it here. Supabase/Cloudinary URLs already have params.
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

  const handleClick = (e) => {
    e.stopPropagation();
    // If caller provided their own onClick, call it too (but don't block modal)
    if (typeof onClick === "function") onClick(e);
    setShowProfileModal(true);
  };

  // Build the user object passed to UserProfileModal.
  // Provide EVERY possible ID key so resolveTargetId() always finds it,
  // regardless of which shape the modal's resolver checks first.
  const modalUser = {
    id:                userId,
    user_id:           userId,
    userId:            userId,
    name:              author,
    author,
    username,
    avatar:            isValidUrl ? enhancedAvatar : avatar,
    verified,
    subscription_tier: tier,
    payment_status:    paymentStatus,
    boost_selections:  { themeId, fontId, colorId },
  };

  return (
    <>
      <div
        className={`profile-preview profile-preview-${layout} ${className}`}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        {/* Avatar ring — live tier drives ring colour + animation */}
        <BoostAvatarRing
          userId={userId}
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
          onClick={handleClick}
          borderRadius="circle"
          style={{ cursor: "pointer", flexShrink: 0 }}
          accentColor={hasBoostedTier ? displayNameColor : undefined}
        />

        <div className="profile-preview-info">
          {/* Name — live tier colour, smooth transition */}
          <div
            style={{
              fontSize:      `${sz.name}px`,
              fontFamily:    nameDesign.font?.family,
              fontWeight:    700,
              letterSpacing: nameDesign.font?.spacing,
              color:         displayNameColor,
              display:       "inline-flex",
              alignItems:    "center",
              gap:           6,
              flexWrap:      "nowrap",
              minWidth:      0,
              lineHeight:    1.2,
              textShadow:    hasBoostedTier
                ? `0 0 14px ${nameDesign.color?.shadow || displayNameColor}90`
                : "0 2px 6px rgba(0,0,0,0.9)",
              whiteSpace:    "nowrap",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              transition:    "color 0.4s ease, text-shadow 0.4s ease",
            }}
          >
            <span style={{ display: "inline-block", minWidth: 0 }}>{author}</span>

            {verified && (
              <span
                style={{
                  width:          18,
                  height:         18,
                  borderRadius:   "50%",
                  background:     hasBoostedTier
                    ? `linear-gradient(135deg,${displayNameColor},${displayNameColor}bb)`
                    : "linear-gradient(135deg,#22c55e,#4ade80)",
                  display:        "inline-flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  color:          "#041108",
                  flexShrink:     0,
                  boxShadow:      `0 2px 8px ${displayNameColor || '#22c55e'}55`,
                  border:         "1.5px solid rgba(255,255,255,0.7)",
                  transition:     "background 0.4s ease",
                  fontWeight:     900,
                  fontSize:      11,
                  lineHeight:    1,
                  transform:      "translateY(-1px)",
                }}
                aria-label="Verified account"
                title="Verified account"
              >
                ✓
              </span>
            )}

            <TierBadge tier={tier} paymentStatus={paymentStatus} />
          </div>

          {/* Username — faded live tier colour */}
          {showUsername && username && (
            <div
              style={{
                fontSize:     `${sz.username}px`,
                color:        displayUserColor,
                fontWeight:   600,
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                transition:   "color 0.4s ease",
              }}
            >
              @{username}
            </div>
          )}
        </div>
      </div>

      {/* Profile modal — portal so it escapes any overflow:hidden ancestor */}
      {showProfileModal &&
        ReactDOM.createPortal(
          <UserProfileModal
            user={modalUser}
            currentUser={currentUser}
            onClose={() => setShowProfileModal(false)}
          />,
          document.body
        )}

      <style>{`
        .profile-preview {
          display: flex; align-items: center;
          transition: all 0.2s; max-width: fit-content;
          background: rgba(0,0,0,0.06);
          padding: 4px 10px 4px 4px;
          border-radius: 12px; border: 1px solid transparent;
        }
        .profile-preview:hover  { transform: scale(1.02); }
        .profile-preview:active { transform: scale(0.98); }
        .profile-preview-horizontal { flex-direction: row;    gap: 8px; }
        .profile-preview-vertical   { flex-direction: column; gap: 6px; text-align: center; }
        .profile-preview-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        @media (max-width: 768px) { .profile-preview { padding: 4px 8px 4px 4px; } }
      `}</style>
    </>
  );
};

export default ProfilePreview;