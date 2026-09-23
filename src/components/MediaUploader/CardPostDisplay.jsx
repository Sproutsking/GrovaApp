import React, { useState } from "react";
import LinkifiedText from "../Shared/LinkifiedText";
import "./CardPost.css";

// ─── EDGE OVERLAYS ────────────────────────────────────────────────────────────
const EDGE_STYLES = {
  none: "",
  soft: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.28) 100%)",
  medium:
    "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.48) 100%)",
  strong:
    "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.68) 100%)",
  corners:
    "radial-gradient(ellipse at 0% 0%, rgba(0,0,0,0.55) 0%, transparent 50%)," +
    "radial-gradient(ellipse at 100% 0%, rgba(0,0,0,0.55) 0%, transparent 50%)," +
    "radial-gradient(ellipse at 0% 100%, rgba(0,0,0,0.55) 0%, transparent 50%)," +
    "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.55) 0%, transparent 50%)",
};

// ─── SMART AUTO-SCALE ─────────────────────────────────────────────────────────
// Auto sizing is deliberately based on content, not viewport width. This keeps
// the same card stable across phones while still leaving room for wrapping.
const getAutoTypo = (text = "") => {
  const chars = text.trim().length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  if (words <= 2 && chars <= 10)
    return {
      fontSize: "52px",
      lineHeight: "1.0",
      letterSpacing: "-0.03em",
      fontWeight: 900,
    };
  if (words <= 3 && chars <= 22)
    return {
      fontSize: "40px",
      lineHeight: "1.08",
      letterSpacing: "-0.02em",
      fontWeight: 900,
    };
  if (words <= 6 && chars <= 40)
    return {
      fontSize: "32px",
      lineHeight: "1.15",
      letterSpacing: "-0.015em",
      fontWeight: 800,
    };
  if (words <= 10 && chars <= 65)
    return {
      fontSize: "25px",
      lineHeight: "1.22",
      letterSpacing: "-0.01em",
      fontWeight: 800,
    };
  if (chars <= 100)
    return {
      fontSize: "21px",
      lineHeight: "1.3",
      letterSpacing: "-0.01em",
      fontWeight: 700,
    };
  if (chars <= 160)
    return {
      fontSize: "18px",
      lineHeight: "1.35",
      letterSpacing: "-0.005em",
      fontWeight: 700,
    };
  if (chars <= 240)
    return {
      fontSize: "16px",
      lineHeight: "1.4",
      letterSpacing: "0",
      fontWeight: 650,
    };
  return {
    fontSize: "15px",
    lineHeight: "1.45",
    letterSpacing: "0",
    fontWeight: 600,
  };
};

// ─── LOCKED TYPOGRAPHY ───────────────────────────────────────────────────────
const getLockedTypo = (px) => {
  if (px >= 56)
    return { lineHeight: "1.05", letterSpacing: "-0.04em", fontWeight: 900 };
  if (px >= 40)
    return { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: 900 };
  if (px >= 30)
    return { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: 800 };
  if (px >= 22)
    return { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: 800 };
  if (px >= 16)
    return { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: 700 };
  return { lineHeight: "1.5", letterSpacing: "0", fontWeight: 600 };
};

// ─── SMART CARD HEIGHT ────────────────────────────────────────────────────────
const getCardHeight = (text = "") => {
  const chars = text.trim().length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  if (words <= 2 && chars <= 10) return "152px";
  if (words <= 3 && chars <= 22) return "172px";
  if (words <= 6 && chars <= 40) return "198px";
  if (words <= 10 && chars <= 65) return "224px";
  if (chars <= 100) return "252px";
  if (chars <= 160) return "292px";
  if (chars <= 240) return "332px";
  return "372px";
};

// ─── SMART PADDING ────────────────────────────────────────────────────────────
const getPadding = (text = "") => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 3) return "32px 40px";
  if (words <= 8) return "28px 36px";
  return "24px 28px";
};

export const shouldClampCardText = (text = "") => {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const chars = trimmed.length;
  return words > 8 || chars > 70;
};

// ─── CARD POST DISPLAY ────────────────────────────────────────────────────────
const CardPostDisplay = ({ post }) => {
  // Extract metadata from the post
  const meta = post?.text_card_metadata || {};
  const gradient =
    meta.gradient || "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)";
  const textColor = meta.textColor || "#ffffff";
  const edgeStyle = meta.edgeStyle || "medium";
  const align = meta.align || "center";
  const cardText = post?.content || "";

  // fontSize: null = Auto, number = user's locked size
  const userFontSize = meta.fontSize ?? null;

  // cardHeight: user's custom height or auto-calculated
  const userCardHeight = meta.cardHeight;

  const edgeOverlay = EDGE_STYLES[edgeStyle] ?? EDGE_STYLES.medium;
  const isAutoLayout = !userCardHeight;
  const cardHeight = userCardHeight || getCardHeight(cardText);
  const padding = isAutoLayout ? getPadding(cardText) : "24px 28px";

  // Build the final text style
  let textStyle;
  if (userFontSize !== null && userFontSize !== undefined) {
    // User picked a size — use it exactly
    const locked = getLockedTypo(userFontSize);
    textStyle = {
      fontSize: `${userFontSize}px`,
      lineHeight: locked.lineHeight,
      letterSpacing: locked.letterSpacing,
      fontWeight: locked.fontWeight,
      color: textColor,
    };
  } else {
    // Auto — smart responsive scale
    const auto = getAutoTypo(cardText);
    textStyle = {
      fontSize: auto.fontSize,
      lineHeight: auto.lineHeight,
      letterSpacing: auto.letterSpacing,
      fontWeight: auto.fontWeight,
      color: textColor,
    };
  }

  const resolvedAlign =
    isAutoLayout && align === "center" && cardText.trim().length > 65
      ? "left"
      : align;
  const alignItems =
    resolvedAlign === "left" ? "flex-start" : resolvedAlign === "right" ? "flex-end" : "center";
  const shouldClamp = shouldClampCardText(cardText);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`cp-wrapper${isAutoLayout ? " cp-wrapper-auto" : ""}`} style={{ height: cardHeight }}>
      <div className="cp-card" style={{ background: gradient }}>
        {/* Micro-grain noise */}
        <div className="cp-noise" aria-hidden="true" />

        {/* Top-left light catch */}
        <div className="cp-shine" aria-hidden="true" />

        {/* Bottom ground darkening */}
        <div className="cp-grain" aria-hidden="true" />

        {/* Vignette edge */}
        {edgeOverlay && (
          <div
            className="cp-edge"
            style={{ background: edgeOverlay }}
            aria-hidden="true"
          />
        )}

        {/* Text */}
        <div
          className="cp-text-layer"
          style={{ padding, textAlign: resolvedAlign, alignItems }}
        >
          <div className={`cp-copy${shouldClamp && !expanded ? " cp-copy-clamped" : ""}`}>
            <LinkifiedText>{cardText}</LinkifiedText>
          </div>
          {shouldClamp && (
            <button type="button" className="cp-more-btn" onClick={() => setExpanded((previous) => !previous)}>
              {expanded ? "Less" : "More"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardPostDisplay;
