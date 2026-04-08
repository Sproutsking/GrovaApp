// ============================================================================
// src/components/Home/NewsCard.jsx
//
// System-generated news card rendered inside PostTab alongside user posts.
// Identified by post._type === "news".
//
// Design:
//   • Compact — never exceeds a sane max-height; title clamped to 2 lines
//   • Description clamped to 3 lines; inline expand (no modal)
//   • Fixed 180px image height — zero layout-shift on load
//   • Shimmer skeleton while image loads
//   • Image tap → lightbox at z-index 100010 (above every sidebar)
//   • "Read Full Story" → new tab
//   • Blue left accent stripe visually distinguishes news from user posts
//   • Category colour-coded: global=blue, africa=emerald, crypto=amber
//   • Source favicon fetched from Google S2 API
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import { ExternalLink, Globe, TrendingUp, Leaf, Map, X } from "lucide-react";

// ── Category metadata ─────────────────────────────────────────────────────────
const CAT = {
  global:      { label: "Global",      Icon: Globe,       accent: "#60a5fa" },
  africa:      { label: "Africa",      Icon: Map,         accent: "#34d399" },
  crypto:      { label: "Crypto",      Icon: TrendingUp,  accent: "#f59e0b" },
  agriculture: { label: "Agriculture", Icon: Leaf,        accent: "#84cc16" },
};

// ── Relative timestamp ────────────────────────────────────────────────────────
function relTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Favicon URL via Google S2 ─────────────────────────────────────────────────
function faviconUrl(sourceUrl) {
  try {
    const { hostname } = new URL(sourceUrl);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch { return null; }
}

// ── Lightbox (portal-level z-index so it sits above every sidebar) ────────────
const NewsLightbox = ({ src, title, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.97)",
        zIndex: 100010,                    // above every sidebar (10050 in App.jsx)
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "nlFadeIn 0.18s ease",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <X size={18} />
      </button>
      <img
        src={src}
        alt={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "78vh",
          objectFit: "contain", borderRadius: 10,
        }}
      />
      {title && (
        <p
          style={{
            marginTop: 14, maxWidth: 680,
            fontSize: 13, color: "rgba(255,255,255,0.45)",
            textAlign: "center", lineHeight: 1.5,
          }}
        >
          {title}
        </p>
      )}
      <style>{`@keyframes nlFadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// NewsCard
// ═════════════════════════════════════════════════════════════════════════════
const NewsCard = ({ post }) => {
  const [expanded,     setExpanded]     = useState(false);
  const [needsExpand,  setNeedsExpand]  = useState(false);
  const [imgLoaded,    setImgLoaded]    = useState(false);
  const [imgError,     setImgError]     = useState(false);
  const [lightbox,     setLightbox]     = useState(false);
  const [favErr,       setFavErr]       = useState(false);

  const descRef = useRef(null);

  const { label: catLabel, Icon: CatIcon, accent } =
    CAT[post.category] ?? CAT.global;
  const fav = faviconUrl(post.source_url);

  // Measure whether description overflows 3-line clamp
  useEffect(() => {
    const el = descRef.current;
    if (!el || !post.description) return;

    // Temporarily unlock to measure full height
    el.style.webkitLineClamp = "unset";
    el.style.overflow        = "visible";
    el.style.display         = "block";
    const full = el.scrollHeight;

    // Restore
    el.style.webkitLineClamp = "3";
    el.style.overflow        = "hidden";
    el.style.display         = "-webkit-box";
    const clamped = el.clientHeight;

    setNeedsExpand(full > clamped + 2);
  }, [post.description]);

  const hasImage = post.image_url && !imgError;

  return (
    <>
      {lightbox && hasImage && (
        <NewsLightbox
          src={post.image_url}
          title={post.title}
          onClose={() => setLightbox(false)}
        />
      )}

      <article className="nc-card">

        {/* ── Blue left accent stripe ── */}
        <div
          className="nc-stripe"
          style={{ background: `linear-gradient(180deg, ${accent}cc 0%, ${accent}44 100%)` }}
        />

        {/* ── HEADER ── */}
        <div className="nc-header">
          <div className="nc-source-row">
            <div className="nc-source">
              {fav && !favErr && (
                <img
                  src={fav}
                  alt=""
                  className="nc-favicon"
                  onError={() => setFavErr(true)}
                />
              )}
              <span className="nc-source-name">{post.source_name}</span>
            </div>
            <span className="nc-time">{relTime(post.published_at)}</span>
          </div>

          <div className="nc-badges">
            {/* Verified News */}
            <span className="nc-badge nc-badge--verified">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Verified News
            </span>

            {/* Category */}
            <span
              className="nc-badge nc-badge--cat"
              style={{
                "--acc":  accent,
                "--accL": accent + "1a",
                "--accB": accent + "44",
              }}
            >
              <CatIcon size={9} />
              {catLabel}
            </span>

            {/* Asset tag */}
            {post.asset_tag && (
              <span className="nc-badge nc-badge--asset">
                {post.asset_tag}
              </span>
            )}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="nc-body">
          {/* Title — 2-line clamp */}
          <h3 className="nc-title">{post.title}</h3>

          {/* Image */}
          {hasImage && (
            <div
              className="nc-img-wrap"
              onClick={() => setLightbox(true)}
              title="View full image"
            >
              {!imgLoaded && <div className="nc-img-shimmer" />}
              <img
                src={post.image_url}
                alt={post.title}
                className={`nc-img${imgLoaded ? " nc-img--loaded" : ""}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                loading="lazy"
              />
              {imgLoaded && (
                <div className="nc-img-zoom-hint">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {post.description && (
            <>
              <p
                ref={descRef}
                className={`nc-desc${expanded ? " nc-desc--expanded" : ""}`}
              >
                {post.description}
              </p>
              {needsExpand && !expanded && (
                <button
                  className="nc-more-btn"
                  onClick={() => setExpanded(true)}
                >
                  more
                </button>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="nc-footer">
          <a
            href={post.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="nc-read-btn"
            onClick={(e) => e.stopPropagation()}
          >
            Read Full Story
            <ExternalLink size={11} />
          </a>
        </div>
      </article>

      <style>{`
        /* ── Card shell ──────────────────────────────────────────────────── */
        .nc-card {
          position: relative;
          background: #0f0f0f;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 10px;
          transition: border-color 0.2s;
        }
        .nc-card:hover { border-color: rgba(255,255,255,0.15); }

        /* Left stripe */
        .nc-stripe {
          position: absolute;
          left: 0; top: 10px; bottom: 10px;
          width: 3px;
          border-radius: 0 3px 3px 0;
        }

        /* ── Header ──────────────────────────────────────────────────────── */
        .nc-header {
          padding: 10px 14px 0 18px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .nc-source-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .nc-source {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .nc-favicon {
          width: 14px; height: 14px;
          border-radius: 3px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .nc-source-name {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.65);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nc-time {
          font-size: 10.5px;
          color: rgba(255,255,255,0.28);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Badges ──────────────────────────────────────────────────────── */
        .nc-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
        }
        .nc-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .nc-badge--verified {
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.25);
          color: #93c5fd;
        }
        .nc-badge--cat {
          background: var(--accL);
          border: 1px solid var(--accB);
          color: var(--acc);
        }
        .nc-badge--asset {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          color: #fbbf24;
          letter-spacing: 0.07em;
          font-size: 9px;
          font-weight: 800;
        }

        /* ── Body ────────────────────────────────────────────────────────── */
        .nc-body {
          padding: 7px 14px 0 18px;
        }
        .nc-title {
          font-size: 14px;
          font-weight: 700;
          color: #f0f0f0;
          line-height: 1.4;
          margin: 0 0 7px;
          /* 2-line clamp */
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Image */
        .nc-img-wrap {
          position: relative;
          width: 100%;
          height: 180px;
          border-radius: 9px;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
          margin-bottom: 7px;
          cursor: zoom-in;
          flex-shrink: 0;
        }
        .nc-img-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 25%,
            rgba(255,255,255,0.07) 50%,
            rgba(255,255,255,0.03) 75%
          );
          background-size: 200% 100%;
          animation: ncShimmer 1.4s infinite;
        }
        @keyframes ncShimmer {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }
        .nc-img {
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .nc-img--loaded { opacity: 1; }
        .nc-img-zoom-hint {
          position: absolute;
          bottom: 8px; right: 8px;
          width: 24px; height: 24px;
          border-radius: 6px;
          background: rgba(0,0,0,0.7);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.6);
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .nc-img-wrap:hover .nc-img-zoom-hint { opacity: 1; }

        /* Description */
        .nc-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          line-height: 1.6;
          margin: 0 0 2px;
          /* 3-line clamp */
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .nc-desc--expanded {
          display: block;
          -webkit-line-clamp: unset;
          overflow: visible;
        }
        .nc-more-btn {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-bottom: 2px;
          font-family: inherit;
          line-height: 1.8;
          transition: color 0.15s;
        }
        .nc-more-btn:hover { color: #84cc16; }

        /* ── Footer ──────────────────────────────────────────────────────── */
        .nc-footer {
          padding: 7px 14px 10px 18px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          border-top: 1px solid rgba(255,255,255,0.05);
          margin-top: 8px;
        }
        .nc-read-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 13px;
          border-radius: 999px;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.22);
          color: #93c5fd;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.18s ease;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .nc-read-btn:hover {
          background: rgba(59,130,246,0.18);
          border-color: rgba(59,130,246,0.4);
          color: #bfdbfe;
          transform: translateX(1px);
        }

        /* Mobile */
        @media (max-width: 768px) {
          .nc-card {
            border-radius: 0;
            border-left: none;
            border-right: none;
            margin-bottom: 0;
          }
          .nc-img-wrap { height: 155px; }
          .nc-title { font-size: 13.5px; }
        }
      `}</style>
    </>
  );
};

export default NewsCard;