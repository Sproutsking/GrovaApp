import React, { useId } from "react";

const TIERS = {
  silver: { base: "#c7ccd3", dark: "#707783", light: "#f8fafc", label: "Silver" },
  gold: { base: "#e3a727", dark: "#9b6810", light: "#fff3b0", label: "Gold" },
  diamond: { base: "#4fa9d9", dark: "#1f6c93", light: "#dff7ff", label: "Diamond" },
};

const normalizeTier = (tier) => TIERS[tier] ? tier : "silver";

function BadgeShell({ children, size, label, className = "" }) {
  return (
    <span className={`verified-badge verified-badge-${className}`} role="img" aria-label={`${label} verified badge`} style={{ width: size, height: size, display: "inline-flex", flex: "0 0 auto", verticalAlign: "middle" }}>
      {children}
    </span>
  );
}

/** Group A: compact inline badge for message cards. */
export function VerifiedBadgeCircle({ tier = "silver", size = 16, className = "" }) {
  const safeTier = normalizeTier(tier);
  const colors = TIERS[safeTier];
  const gradientId = useId().replace(/:/g, "");
  return (
    <BadgeShell size={size} label={colors.label} className={`circle ${className}`}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors.light} />
            <stop offset="0.32" stopColor={colors.base} />
            <stop offset="1" stopColor={colors.dark} />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="16" cy="16" r="14.5" fill="none" stroke={colors.dark} strokeWidth="1" opacity="0.9" />
        <circle cx="16" cy="16" r="12.6" fill={`url(#${gradientId}-fill)`} stroke={colors.light} strokeWidth="0.7" opacity="0.98" />
        <path d="M9.5 16.1 14 20.4 22.7 11.8" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${gradientId}-glow)`} />
        {safeTier === "diamond" && <path d="m25.2 4.1.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="#fff" opacity=".95" />}
      </svg>
    </BadgeShell>
  );
}

/** Group B: larger seal for profile headers and profile modals. */
export function VerifiedBadgeSeal({ tier = "silver", size = 22, className = "" }) {
  const safeTier = normalizeTier(tier);
  const colors = TIERS[safeTier];
  const gradientId = useId().replace(/:/g, "");
  const points = Array.from({ length: 16 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 16 - Math.PI / 2;
    const radius = index % 2 === 0 ? 14 : 11.8;
    return `${16 + Math.cos(angle) * radius},${16 + Math.sin(angle) * radius}`;
  }).join(" ");
  return (
    <BadgeShell size={size} label={colors.label} className={`seal ${className}`}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`${gradientId}-seal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors.light} />
            <stop offset="0.4" stopColor={colors.base} />
            <stop offset="1" stopColor={colors.dark} />
          </linearGradient>
        </defs>
        <polygon points={points} fill={`url(#${gradientId}-seal)`} stroke={colors.dark} strokeWidth="0.8" />
        <circle cx="16" cy="16" r="8.2" fill={colors.dark} opacity=".72" />
        <path d="m11.9 16.1 3 2.9 5.7-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {safeTier === "diamond" && <path d="m26 3.8.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#fff" />}
      </svg>
    </BadgeShell>
  );
}

/** Group C is intentionally reserved for future faceted/gem surfaces. */
export function VerifiedBadgeFaceted() {
  return null;
}

const VerifiedBadges = { VerifiedBadgeCircle, VerifiedBadgeSeal, VerifiedBadgeFaceted };
export default VerifiedBadges;
