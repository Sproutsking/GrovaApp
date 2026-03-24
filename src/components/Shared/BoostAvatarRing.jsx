// src/components/Shared/BoostAvatarRing.jsx
// ============================================================================
// RING-FIXED — border+boxShadow on OUTER div, overflow:hidden on INNER only
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  BOOST_VISUAL,
  getBoostVisualForTheme,
} from "../../services/account/profileTierService";
import boostService from "../../services/boost/boostService";

const _cache = new Map();
async function fetchTier(userId) {
  if (_cache.has(userId)) return _cache.get(userId);
  const tier = await boostService.getUserBoostTier(userId);
  _cache.set(userId, tier);
  setTimeout(() => _cache.delete(userId), 60_000);
  return tier;
}

const BoostAvatarRing = ({
  userId,
  tier: tierProp,
  themeId,
  size = 42,
  src,
  letter = "U",
  showBadge = true,
  badgeSize = "sm",
  onClick,
  style,
  borderRadius = "circle",
}) => {
  const [tier, setTier] = useState(tierProp ?? null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (tierProp !== undefined) {
      setTier(tierProp);
      return;
    }
    if (!userId) return;
    fetchTier(userId)
      .then((t) => {
        if (mounted.current) setTier(t);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [userId, tierProp]);

  const baseVisual = tier ? BOOST_VISUAL[tier] : null;
  const visual =
    tier && themeId
      ? (getBoostVisualForTheme(tier, themeId) ?? baseVisual)
      : baseVisual;

  const br = borderRadius === "circle" ? "50%" : "28%";
  const badgeW = badgeSize === "md" ? 22 : 16;
  const badgeFs = badgeSize === "md" ? 11 : 8;

  const isValidImg =
    src &&
    typeof src === "string" &&
    !imgError &&
    (src.startsWith("http") || src.startsWith("blob:"));

  return (
    <>
      {visual?.animKeyframes && (
        <style dangerouslySetInnerHTML={{ __html: visual.animKeyframes }} />
      )}

      {/* OUTER: ring border + glow shadow + animation. NO overflow:hidden here. */}
      <div
        onClick={onClick}
        style={{
          position: "relative",
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: br,
          border: visual ? visual.border : "2px solid rgba(255,255,255,0.1)",
          boxShadow: visual ? visual.boxShadow : "none",
          animation: visual ? visual.animStyle : "none",
          cursor: onClick ? "pointer" : "default",
          transition: "box-shadow 0.3s, border-color 0.3s",
          ...style,
        }}
      >
        {/* INNER: clips avatar to circle/rounded shape */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: br,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Letter gradient fallback */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: visual
                ? `linear-gradient(135deg,${visual.grad[0]},${visual.grad[1]})`
                : "linear-gradient(135deg,#84cc16,#4d7c0f)",
              fontSize: Math.round(size * 0.42),
              fontWeight: 900,
              color: "#000",
              userSelect: "none",
            }}
          >
            {(letter || "U").charAt(0).toUpperCase()}
          </div>

          {/* Avatar image — no blur, no filter */}
          {isValidImg && (
            <img
              src={src}
              alt=""
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.3s",
                imageRendering: "auto",
                WebkitBackfaceVisibility: "hidden",
                backfaceVisibility: "hidden",
              }}
            />
          )}
        </div>

        {/* Badge pip — on outer wrapper so it's never clipped */}
        {showBadge && visual && (
          <div
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: badgeW,
              height: badgeW,
              borderRadius: "50%",
              background: `linear-gradient(135deg,${visual.grad[0]},${visual.grad[1]})`,
              border: "2px solid #060606",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: badgeFs,
              zIndex: 2,
              boxShadow: `0 2px 8px ${visual.glow}`,
              lineHeight: 1,
            }}
          >
            {visual.badge}
          </div>
        )}
      </div>
    </>
  );
};

export default BoostAvatarRing;

export const TierIndicator = ({ tier, size = 14 }) => {
  if (!tier || !BOOST_VISUAL[tier]) return null;
  const v = BOOST_VISUAL[tier];
  return (
    <span
      title={`${v.badgeLabel} Boost`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 5px",
        borderRadius: 10,
        fontSize: size - 2,
        fontWeight: 800,
        color: v.color,
        background: `${v.color}18`,
        border: `1px solid ${v.color}35`,
        boxShadow: `0 0 6px ${v.glow}`,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: size }}>{v.badge}</span>
    </span>
  );
};
