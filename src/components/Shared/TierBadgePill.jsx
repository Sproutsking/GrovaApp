import React from "react";
import { getTierBadge } from "../../services/account/profileTierService";

const TierBadgePill = ({ tier, paymentStatus, style = {}, className = "" }) => {
  const badge = getTierBadge(tier, paymentStatus);
  if (!badge) return null;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 800,
        color: badge.color,
        background: `${badge.color}18`,
        border: `1px solid ${badge.color}35`,
        boxShadow: `0 0 6px ${badge.glow}`,
        flexShrink: 0,
        transition: "color 0.4s ease, background 0.4s ease, border-color 0.4s ease",
        ...style,
      }}
    >
      {badge.emoji} {badge.label}
    </span>
  );
};

export default TierBadgePill;
