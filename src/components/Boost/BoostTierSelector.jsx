/**
 * BoostTierSelector — Premium tier selection with pricing, checkmarks & animations
 * ============================================================================
 * Shows Silver, Gold, Diamond tiers with:
 * - Clear pricing (monthly/annual)
 * - Animated ornamental checkmarks (extend outward, not inward)
 * - Beautiful tier-colored decorative borders
 * - Clear avatar rendering without design obstruction
 * - Smooth selection animations
 *
 * Props:
 *   currentTier      — 'silver' | 'gold' | 'diamond' (current active tier)
 *   onSelectTier     — (tier) => void
 *   onUpgradeBillingClick — () => void (when user clicks to upgrade)
 */

import React, { useState } from "react";
import { Check, Sparkles } from "lucide-react";

const TIER_CONFIG = {
  silver: {
    label: "Silver",
    mark: "◈",
    tagline: "Verified · a single star crossing",
    description: "Your entry to premium profiles",
    monthlyPrice: 1,
    yearlyPrice: 9,
    features: [
      "Polished chrome profile designs",
      "Custom name font & color",
      "Moon & meteor animations",
      "Verified badge",
      "Basic avatar border",
    ],
    colorClass: "text-gray-300",
    borderColor: "#c7ced4",
    bgGradient: "from-gray-900 via-slate-800 to-gray-900",
    glowColor: "rgba(199, 206, 212, 0.4)",
    markEmoji: "◈",
  },
  gold: {
    label: "Gold",
    mark: "♛",
    tagline: "Elite · a blade of light strikes",
    description: "Professional tier with all features",
    monthlyPrice: 2,
    yearlyPrice: 16,
    features: [
      "3 exclusive gold designs",
      "Blade & ember animations",
      "4 color blend options",
      "5 font choices",
      "6 color variations",
      "Enhanced avatar glow",
      "Gold tier mark",
    ],
    colorClass: "text-amber-300",
    borderColor: "#fbbf24",
    bgGradient: "from-amber-950 via-yellow-900 to-amber-950",
    glowColor: "rgba(251, 191, 36, 0.4)",
    markEmoji: "♛",
  },
  diamond: {
    label: "Diamond",
    mark: "✦",
    tagline: "Apex · a gem-serpent swims slow",
    description: "Ultimate tier with cosmic features",
    monthlyPrice: 3,
    yearlyPrice: 27,
    features: [
      "5 cosmic prismatic designs",
      "Gem-serpent animations",
      "6 color blend options",
      "8 font choices",
      "6 color variations",
      "Premium avatar halo",
      "Diamond tier mark",
      "Exclusive cosmic effects",
      "Highest visibility boost",
    ],
    colorClass: "text-blue-300",
    borderColor: "#bfe4ff",
    bgGradient: "from-blue-950 via-indigo-900 to-blue-950",
    glowColor: "rgba(191, 228, 255, 0.4)",
    markEmoji: "✦",
  },
};

const TIERS_ORDERED = ["silver", "gold", "diamond"];

/**
 * DecorativeCheckmark — beautiful ornamental checkmark that extends OUTWARD
 * from the card, positioned in top-right, scaled & animated
 */
const DecorativeCheckmark = ({ tierKey }) => {
  const config = TIER_CONFIG[tierKey];
  const rotation = tierKey === "silver" ? 15 : tierKey === "gold" ? -12 : 8;

  return (
    <div
      style={{
        position: "absolute",
        top: -18,
        right: -18,
        width: 64,
        height: 64,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 10,
        animation: "checkmarkPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      <style>{`
        @keyframes checkmarkPop {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          70% { transform: scale(1.15) rotate(${rotation}deg); opacity: 1; }
          100% { transform: scale(1) rotate(${rotation}deg); opacity: 1; }
        }
        @keyframes checkmarkGlow {
          0%, 100% { 
            box-shadow: 0 0 0 0 ${config.glowColor}, 
                        inset 0 0 12px ${config.glowColor};
          }
          50% { 
            box-shadow: 0 0 0 8px rgba(255,255,255,0), 
                        inset 0 0 20px ${config.glowColor};
          }
        }
      `}</style>
      
      {/* Outer decorative ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `conic-gradient(from 0deg, 
            ${config.borderColor}40 0deg 45deg, 
            transparent 45deg 135deg,
            ${config.borderColor}40 135deg 180deg,
            transparent 180deg 225deg,
            ${config.borderColor}40 225deg 270deg,
            transparent 270deg 360deg)`,
          animation: "checkmarkGlow 2.4s ease-in-out infinite",
        }}
      />

      {/* Inner glow sphere */}
      <div
        style={{
          position: "absolute",
          inset: 4,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, 
            ${config.borderColor}60, 
            ${config.borderColor}20 40%, 
            transparent 70%)`,
          filter: "blur(6px)",
        }}
      />

      {/* Check symbol */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          fontSize: 32,
          fontWeight: "bold",
          color: config.borderColor,
          textShadow: `0 0 12px ${config.glowColor}, 0 0 24px ${config.glowColor}`,
          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
        }}
      >
        ✓
      </div>
    </div>
  );
};

/**
 * TierCard — individual tier card with pricing, features, and selection
 */
const TierCard = ({ tierKey, isSelected, onSelect, disabled }) => {
  const config = TIER_CONFIG[tierKey];
  const yearlyDiscount =
    ((config.monthlyPrice * 12 - config.yearlyPrice) / (config.monthlyPrice * 12)) * 100;

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Decorative checkmark appears when selected, extends outward */}
      {isSelected && <DecorativeCheckmark tierKey={tierKey} />}

      {/* Main card container */}
      <div
        onClick={() => !isSelected && !disabled && onSelect(tierKey)}
        style={{
          position: "relative",
          borderRadius: 24,
          padding: 28,
          cursor: disabled ? "not-allowed" : isSelected ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? "none" : "auto",
          transition: "all 0.35s cubic-bezier(0.2, 0.6, 0.3, 1)",
          transform: isSelected ? "scale(1.02)" : "scale(1)",
          background: isSelected
            ? `linear-gradient(135deg, 
              rgba(255, 255, 255, 0.04) 0%,
              rgba(255, 255, 255, 0.02) 100%)`
            : "rgba(255, 255, 255, 0.01)",
          border: isSelected
            ? `2px solid ${config.borderColor}60`
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: isSelected
            ? `0 0 32px ${config.glowColor}, 
               inset 0 0 40px rgba(255,255,255,0.05),
               0 12px 48px rgba(0,0,0,0.6)`
            : "0 8px 32px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Animated gradient background on selection */}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, 
                ${config.borderColor}08 0%,
                transparent 50%,
                ${config.borderColor}04 100%)`,
              pointerEvents: "none",
              animation: "shimmerFlow 3s ease-in-out infinite",
            }}
          />
        )}

        {/* Header: Tier name & mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 24,
              filter: `drop-shadow(0 0 8px ${config.glowColor})`,
            }}
          >
            {config.markEmoji}
          </div>
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: isSelected ? config.borderColor : "rgba(255,255,255,0.9)",
                transition: "color 0.3s",
              }}
            >
              {config.label}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.5)",
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              {config.tagline}
            </div>
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 20,
            lineHeight: 1.5,
            position: "relative",
            zIndex: 2,
          }}
        >
          {config.description}
        </div>

        {/* Pricing section */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            border: `1px solid ${config.borderColor}20`,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            {/* Monthly */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  marginBottom: 4,
                }}
              >
                Monthly
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: config.borderColor,
                }}
              >
                ${config.monthlyPrice}
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    fontWeight: 500,
                  }}
                >
                  /mo
                </span>
              </div>
            </div>

            {/* Yearly */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  marginBottom: 4,
                }}
              >
                Yearly
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: config.borderColor,
                }}
              >
                ${config.yearlyPrice}
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    fontWeight: 500,
                  }}
                >
                  /yr
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: `${config.borderColor}cc`,
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                Save {Math.round(yearlyDiscount)}%
              </div>
            </div>
          </div>
        </div>

        {/* Features list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 20,
            position: "relative",
            zIndex: 2,
          }}
        >
          {config.features.map((feature, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 12,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <span
                style={{
                  color: config.borderColor,
                  fontWeight: 800,
                  minWidth: 16,
                }}
              >
                ✓
              </span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={() => onSelect(tierKey)}
          disabled={isSelected || isUpgrading}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: isSelected || isUpgrading ? "default" : "pointer",
            transition: "all 0.25s",
            position: "relative",
            zIndex: 2,
            background: isSelected
              ? `linear-gradient(135deg, ${config.borderColor}40, ${config.borderColor}20)`
              : `linear-gradient(135deg, ${config.borderColor}25, ${config.borderColor}15)`,
            color: config.borderColor,
            border: `1.5px solid ${config.borderColor}50`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            opacity: isSelected ? 0.8 : 1,
            boxShadow: isSelected
              ? `inset 0 0 16px ${config.glowColor}`
              : "none",
          }}
          onMouseEnter={(e) => {
            if (!isSelected && !isUpgrading) {
              e.currentTarget.style.boxShadow = `0 0 16px ${config.glowColor}`;
              e.currentTarget.style.transform = "translateY(-2px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected && !isUpgrading) {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {isSelected ? "✓ Current Plan" : "Select Plan"}
        </button>
      </div>
    </div>
  );
};

/**
 * BoostTierSelector — Main component (PRODUCTION-READY)
 * NO MOCK DATA — Uses real backend via parent component
 */
const BoostTierSelector = ({
  currentTier = "silver",
  onSelectTier = () => {},
  onUpgradeBillingClick = () => {},
  isLoading = false,
  disabled = false,
}) => {
  const handleSelectTier = (tier) => {
    if (tier === currentTier || disabled || isLoading) return;
    // Call parent handler - real backend integration happens in parent
    onSelectTier(tier);
  };

  return (
    <div
      style={{
        position: "relative",
        background: "linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #0f0f1e 100%)",
        borderRadius: 32,
        padding: 40,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Background decorative elements */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 600px 400px at 50% -100px,
            rgba(199, 206, 212, 0.06) 0%,
            rgba(251, 191, 36, 0.04) 30%,
            rgba(191, 228, 255, 0.04) 60%,
            transparent 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Global styles for animations */}
      <style>{`
        @keyframes shimmerFlow {
          0% { background-position: -200% center; }
          50% { background-position: 100% center; }
          100% { background-position: -200% center; }
        }
        @keyframes tierCardEnter {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          marginBottom: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Sparkles size={20} color="#bfe4ff" />
          <h2
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: "rgba(255,255,255,0.95)",
              margin: 0,
            }}
          >
            Choose Your Tier
          </h2>
          <Sparkles size={20} color="#bfe4ff" />
        </div>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            maxWidth: 500,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Unlock exclusive profile designs, animations, and customization options. Start with Silver
          and upgrade anytime.
        </p>
      </div>

      {/* Tier cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 28,
          position: "relative",
          zIndex: 8,
          marginBottom: 32,
        }}
      >
        {TIERS_ORDERED.map((tierKey, idx) => (
          <div
            key={tierKey}
            style={{
              animation: `tierCardEnter 0.6s ease-out ${idx * 0.1}s both`,
            }}
          >
            <TierCard
              tierKey={tierKey}
              isSelected={currentTier === tierKey}
              onSelect={handleSelectTier}
              disabled={disabled || isLoading}
            />
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div
        style={{
          position: "relative",
          zIndex: 8,
          padding: 20,
          background: "rgba(255,255,255,0.02)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          All plans include full access to profile customization. Cancel anytime. Billed monthly or
          yearly.
          <br />
          <span style={{ color: "rgba(255,255,255,0.5)" }}>
            Your profile design persists across all tiers.
          </span>
        </p>
      </div>
    </div>
  );
};

export default BoostTierSelector;
