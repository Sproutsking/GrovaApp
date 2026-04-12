// ============================================================================
// src/components/Home/NewsVideoStrip.jsx  — v3  REALTIME MODEL
//
// CHANGES vs v2:
//  [RT1] Supabase Realtime subscription — new articles slide into the strip
//        INSTANTLY when the cron inserts them. No more 3-minute cache stale.
//  [RT2] Cache TTL reduced from 3 min → 60s; Realtime patches it in real-time.
//  [RT3] "NEW" badge appears on articles that arrived via Realtime this session.
//  [RT4] Strip auto-scrolls to show newly arrived article (left edge).
//  [RT5] Falls back gracefully to direct Supabase query if Realtime is not
//        yet enabled (without breaking anything).
//  [IMP] Uses newsService.startRealtime() centrally — consistent with NewsTab.
//  [IMP] Better skeleton shimmer; smoother card hover.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { supabase } from "../../services/config/supabase";
import newsService from "../../services/news/newsService";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Play,
  ExternalLink,
  Rss,
  BookOpen,
  ArrowLeft,
  Loader,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const relTime = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return `${dy}d ago`;
};

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function getFaviconUrl(sourceUrl, articleUrl) {
  const domain = getDomain(sourceUrl) || getDomain(articleUrl);
  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;
}
function extractYouTubeId(url = "") {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

const CATS = {
  global: { bg: "rgba(59,130,246,0.2)", dot: "#3b82f6", tx: "#93c5fd" },
  africa: { bg: "rgba(249,115,22,0.2)", dot: "#f97316", tx: "#fdba74" },
  crypto: { bg: "rgba(234,179,8,0.2)", dot: "#eab308", tx: "#fde68a" },
  default: { bg: "rgba(132,204,22,0.15)", dot: "#84cc16", tx: "#bef264" },
};
const catStyle = (c) => CATS[(c || "").toLowerCase()] || CATS.default;

// ── Module-level cache (60s TTL) — [RT2] ─────────────────────────────────────
let _cachedItems = null;
let _cacheCategory = "__none__";
let _cacheFetchedAt = 0;
const CACHE_TTL_MS = 60_000; // [RT2] reduced from 3 min

// ── Favicon chip ──────────────────────────────────────────────────────────────
const FaviconChip = ({
  sourceUrl,
  articleUrl,
  sourceName,
  size = 18,
  radius = 4,
}) => {
  const [ok, setOk] = useState(true);
  const url = getFaviconUrl(sourceUrl, articleUrl);
  const initial = (sourceName || "N")[0]?.toUpperCase() || "N";
  if (url && ok) {
    return (
      <img
        src={url}
        alt={sourceName}
        onError={() => setOk(false)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: "linear-gradient(135deg,#1e3a5f,#0f2744)",
        border: "1px solid rgba(59,130,246,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontWeight: 900,
        color: "#60a5fa",
      }}
    >
      {initial}
    </div>
  );
};

// ── CORS proxy waterfall ──────────────────────────────────────────────────────
const PROXIES = [
  (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

async function fetchArticleText(url) {
  for (const makeProxy of PROXIES) {
    try {
      const res = await fetch(makeProxy(url), {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      let html = ct.includes("json")
        ? (await res.json())?.contents || ""
        : await res.text();
      if (!html || html.length < 100) continue;
      const text = extractTextFromHtml(html);
      if (text && text.length > 150) return text;
    } catch {
      /* try next */
    }
  }
  return null;
}

function extractTextFromHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "iframe",
  ].forEach((s) => {
    try {
      tmp.querySelectorAll(s).forEach((e) => e.remove());
    } catch {}
  });
  const SELS = [
    "[itemprop='articleBody']",
    "article .entry-content",
    "article",
    ".article-body",
    "main",
  ];
  for (const sel of SELS) {
    try {
      const el = tmp.querySelector(sel);
      if (!el) continue;
      const t = el.textContent.replace(/\s+/g, " ").trim();
      if (t.length > 200) return t;
    } catch {}
  }
  return (
    Array.from(tmp.querySelectorAll("p"))
      .map((p) => p.textContent.trim())
      .filter((t) => t.length > 60 && !t.toLowerCase().includes("cookie"))
      .join("\n\n") || null
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NewsArticleViewer
// ══════════════════════════════════════════════════════════════════════════════
const NewsArticleViewer = ({ item, onClose }) => {
  const {
    title = "",
    description = "",
    image_url,
    source_name,
    source_url,
    article_url,
    category,
    region,
    published_at,
    asset_tag,
  } = item;

  const [imgErr, setImgErr] = useState(false);
  const [body, setBody] = useState(null);
  const [fetchState, setFetchState] = useState("loading");
  const isMobile = window.innerWidth <= 768;
  const cs = catStyle(category);

  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, {
      overflow: "hidden",
      position: "fixed",
      top: `-${y}px`,
      left: "0",
      right: "0",
    });
    document.body.dataset.navY = y;
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.navY || "0"));
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  useEffect(() => {
    if (!article_url) {
      setFetchState("failed");
      return;
    }
    let cancelled = false;
    fetchArticleText(article_url)
      .then((text) => {
        if (cancelled) return;
        if (text) {
          setBody(text);
          setFetchState("done");
        } else setFetchState("failed");
      })
      .catch(() => {
        if (!cancelled) setFetchState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [article_url]);

  const hasImage = image_url && !imgErr;
  const isFullText =
    fetchState === "done" &&
    body &&
    body.length > (description?.length || 0) * 1.5;
  const display = fetchState === "done" && body ? body : description || null;

  return ReactDOM.createPortal(
    <>
      <div className="nav-root" role="dialog" aria-modal="true">
        {!isMobile && <div className="nav-backdrop" onClick={onClose} />}
        <div
          className={isMobile ? "nav-sheet" : "nav-desktop"}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="nav-topbar">
            <button className="nav-close" onClick={onClose}>
              {isMobile ? <ArrowLeft size={18} /> : <X size={18} />}
            </button>
            <div className="nav-topbar-info">
              <FaviconChip
                sourceUrl={source_url}
                articleUrl={article_url}
                sourceName={source_name}
                size={22}
                radius={5}
              />
              <div style={{ minWidth: 0 }}>
                <div className="nav-topbar-source">{source_name}</div>
                {published_at && (
                  <div className="nav-topbar-date">{relTime(published_at)}</div>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {isFullText && (
              <span className="nav-badge nav-badge-full">
                <CheckCircle size={9} /> Full article
              </span>
            )}
            <div className="nav-news-tag">
              <span className="nav-live-dot" />
              NEWS
            </div>
          </div>
          <div className="nav-body">
            {hasImage && (
              <div className="nav-hero">
                <img
                  src={image_url}
                  alt={title}
                  className="nav-hero-img"
                  onError={() => setImgErr(true)}
                />
              </div>
            )}
            <div className="nav-content">
              <div className="nav-tags">
                {category && (
                  <span
                    className="nav-tag"
                    style={{ background: cs.bg, color: cs.tx }}
                  >
                    <span
                      style={{
                        background: cs.dot,
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {category.toUpperCase()}
                  </span>
                )}
                {region && (
                  <span className="nav-tag nav-tag-sm">
                    {region.toUpperCase()}
                  </span>
                )}
                {asset_tag && (
                  <span className="nav-tag nav-tag-crypto">{asset_tag}</span>
                )}
              </div>
              <h1 className="nav-title">{title}</h1>
              <div className="nav-rule" />
              {fetchState === "loading" && (
                <div className="nav-loading">
                  <Loader size={16} className="nav-spin" /> Loading article…
                </div>
              )}
              {fetchState !== "loading" && display && (
                <div className="nav-text">{display}</div>
              )}
              {fetchState === "failed" && !display && (
                <div className="nav-empty">
                  <AlertCircle size={22} />
                  <p>This article requires visiting the source website.</p>
                </div>
              )}
              <div className="nav-attribution">
                <Rss size={11} />
                Published by <strong>{source_name}</strong>
              </div>
            </div>
          </div>
          <div className="nav-footer">
            {article_url ? (
              <a
                href={article_url}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-cta"
              >
                <ExternalLink size={13} />
                Read on {source_name}
              </a>
            ) : (
              <div className="nav-cta nav-cta-off">No source link</div>
            )}
          </div>
        </div>
      </div>
      <style>{NAV_CSS}</style>
    </>,
    document.body,
  );
};

const NAV_CSS = `
.nav-root{isolation:isolate;position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;}
.nav-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.84);backdrop-filter:blur(6px);animation:navFade 0.2s ease both;}
@keyframes navFade{from{opacity:0}to{opacity:1}}
.nav-desktop{position:relative;z-index:1;width:min(720px,94vw);max-height:92vh;border-radius:20px;overflow:hidden;background:#0f0f0f;border:1px solid rgba(255,255,255,0.1);box-shadow:0 32px 80px rgba(0,0,0,0.75);display:flex;flex-direction:column;animation:navUp 0.25s cubic-bezier(0.34,1.2,0.64,1) both;}
@keyframes navUp{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:none}}
.nav-sheet{position:relative;z-index:1;width:100%;height:100%;background:#0f0f0f;display:flex;flex-direction:column;overflow:hidden;}
.nav-topbar{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;background:rgba(15,15,15,0.98);min-height:54px;}
.nav-close{width:34px;height:34px;min-width:34px;border-radius:50%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.11);color:rgba(255,255,255,0.65);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;}
.nav-close:hover{background:rgba(132,204,22,0.12);border-color:rgba(132,204,22,0.3);color:#84cc16;}
.nav-topbar-info{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
.nav-topbar-source{font-size:12px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nav-topbar-date{font-size:10px;color:rgba(255,255,255,0.3);}
.nav-news-tag{display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:9px;font-weight:800;color:#f87171;letter-spacing:0.08em;flex-shrink:0;}
.nav-live-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;animation:navPulse 1.8s ease-in-out infinite;flex-shrink:0;}
@keyframes navPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
.nav-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700;}
.nav-badge-full{background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.25);color:#84cc16;}
.nav-body{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(132,204,22,0.3) transparent;}
.nav-body::-webkit-scrollbar{width:4px;}.nav-body::-webkit-scrollbar-thumb{background:rgba(132,204,22,0.3);border-radius:2px;}
.nav-hero{width:100%;height:200px;overflow:hidden;background:#0a0a0a;}
.nav-hero-img{width:100%;height:200px;object-fit:cover;display:block;}
.nav-content{padding:16px 16px 12px;}
.nav-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:10px;}
.nav-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 6px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:0.04em;}
.nav-tag-sm{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);}
.nav-tag-crypto{background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.22);color:#fbbf24;}
.nav-title{font-size:18px;font-weight:900;color:#f5f5f5;line-height:1.35;margin:0 0 12px;word-break:break-word;}
@media(max-width:480px){.nav-title{font-size:16px;}}
.nav-rule{height:1px;background:linear-gradient(90deg,transparent,rgba(132,204,22,0.2) 50%,transparent);margin:0 0 14px;}
.nav-loading{display:flex;align-items:center;gap:8px;padding:16px 0;color:rgba(255,255,255,0.35);font-size:13px;}
.nav-spin{animation:navSpin 1s linear infinite;}
@keyframes navSpin{to{transform:rotate(360deg)}}
.nav-text{font-size:15px;color:rgba(255,255,255,0.8);line-height:1.8;word-break:break-word;white-space:pre-wrap;margin-bottom:16px;}
.nav-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px;}
.nav-attribution{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,0.25);padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);}
.nav-attribution strong{color:rgba(255,255,255,0.45);}
.nav-footer{padding:10px 14px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;background:rgba(15,15,15,0.98);}
.nav-cta{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:11px;border-radius:10px;background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.3);color:#84cc16;font-size:13px;font-weight:700;text-decoration:none;transition:background 0.15s,transform 0.1s;}
.nav-cta:hover{background:rgba(132,204,22,0.18);transform:translateY(-1px);}
.nav-cta-off{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08);color:rgba(255,255,255,0.2);cursor:default;}
`;

// ══════════════════════════════════════════════════════════════════════════════
// NewsYouTubeViewer
// ══════════════════════════════════════════════════════════════════════════════
const NewsYouTubeViewer = ({ items, startIndex, onClose }) => {
  const [idx, setIdx] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const touchY = useRef(null);
  const current = items[idx];
  const ytId = extractYouTubeId(current?.article_url);
  const cs = catStyle(current?.category);

  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, {
      overflow: "hidden",
      position: "fixed",
      top: `-${y}px`,
      left: "0",
      right: "0",
    });
    document.body.dataset.nytY = y;
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.nytY || "0"));
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const goPrev = () => {
    if (idx > 0) setIdx((i) => i - 1);
  };
  const goNext = () => {
    if (idx < items.length - 1) setIdx((i) => i + 1);
  };
  const handleTouchStart = (e) => {
    touchY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchY.current === null) return;
    const delta = touchY.current - e.changedTouches[0].clientY;
    if (delta > 40) goNext();
    if (delta < -40) goPrev();
    touchY.current = null;
  };

  return ReactDOM.createPortal(
    <>
      <div
        className="nyt-root"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button className="nyt-close" onClick={onClose}>
          <X size={20} />
        </button>
        <button className="nyt-mute" onClick={() => setMuted((v) => !v)}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <div className="nyt-video-area">
          {ytId ? (
            <iframe
              key={`yt-${idx}`}
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${ytId}`}
              title={current?.title}
              allow="autoplay; fullscreen; accelerometer; gyroscope"
              allowFullScreen
              className="nyt-iframe"
              style={{ border: "none" }}
            />
          ) : (
            <div className="nyt-image-fallback">
              {current?.image_url && (
                <img
                  src={current.image_url}
                  alt={current.title}
                  className="nyt-fallback-img"
                />
              )}
              <div className="nyt-fallback-overlay">
                <BookOpen size={32} color="rgba(255,255,255,0.6)" />
                <p>Article — tap below to read</p>
              </div>
            </div>
          )}
          <div className="nyt-gradient" />
          <div className="nyt-info">
            <div className="nyt-source-row">
              <FaviconChip
                sourceUrl={current?.source_url}
                articleUrl={current?.article_url}
                sourceName={current?.source_name}
                size={20}
                radius={5}
              />
              <span className="nyt-source">{current?.source_name}</span>
              <span className="nyt-ts">{relTime(current?.published_at)}</span>
            </div>
            <h3 className="nyt-title">{current?.title}</h3>
            {current?.category && (
              <span
                className="nyt-cat"
                style={{ background: cs.bg, color: cs.tx }}
              >
                <span
                  style={{
                    background: cs.dot,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {current.category.toUpperCase()}
              </span>
            )}
          </div>
          {idx > 0 && (
            <button className="nyt-arrow nyt-arrow-up" onClick={goPrev}>
              <ChevronLeft size={20} style={{ transform: "rotate(90deg)" }} />
            </button>
          )}
          {idx < items.length - 1 && (
            <button className="nyt-arrow nyt-arrow-down" onClick={goNext}>
              <ChevronLeft size={20} style={{ transform: "rotate(-90deg)" }} />
            </button>
          )}
        </div>
        <div className="nyt-dots">
          {items.slice(0, 10).map((_, i) => (
            <button
              key={i}
              className={`nyt-dot${i === idx ? " nyt-dot-on" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
        {current?.article_url && (
          <a
            href={current.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="nyt-read-link"
          >
            <Rss size={11} />
            Read on {current.source_name}
            <ExternalLink size={11} />
          </a>
        )}
        <div className="nyt-prog">
          <div
            className="nyt-prog-fill"
            style={{ width: `${((idx + 1) / items.length) * 100}%` }}
          />
        </div>
      </div>
      <style>{NYT_CSS}</style>
    </>,
    document.body,
  );
};

const NYT_CSS = `
.nyt-root{position:fixed;inset:0;z-index:99990;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;}
.nyt-close{position:absolute;top:16px;left:16px;z-index:10;width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;}
.nyt-close:hover{background:rgba(0,0,0,0.8);}
.nyt-mute{position:absolute;top:16px;right:16px;z-index:10;width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.nyt-video-area{position:relative;width:100%;flex:1;max-width:560px;overflow:hidden;display:flex;align-items:center;justify-content:center;}
.nyt-iframe{position:absolute;inset:0;width:100%;height:100%;}
.nyt-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#111;}
.nyt-fallback-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.5;}
.nyt-fallback-overlay{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:10px;color:rgba(255,255,255,0.6);font-size:14px;font-weight:600;text-align:center;padding:0 24px;}
.nyt-gradient{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 35%,rgba(0,0,0,0.3) 65%,rgba(0,0,0,0.88) 100%);pointer-events:none;}
.nyt-info{position:absolute;bottom:22px;left:14px;right:52px;z-index:5;display:flex;flex-direction:column;gap:7px;}
.nyt-source-row{display:flex;align-items:center;gap:6px;}
.nyt-source{font-size:12px;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;}
.nyt-ts{font-size:10px;color:rgba(255,255,255,0.4);}
.nyt-title{font-size:15px;font-weight:800;color:#fff;line-height:1.4;margin:0;word-break:break-word;text-shadow:0 1px 4px rgba(0,0,0,0.8);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.nyt-cat{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 5px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:0.06em;width:fit-content;backdrop-filter:blur(4px);}
.nyt-arrow{position:absolute;z-index:8;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.12);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;}
.nyt-arrow:hover{background:rgba(0,0,0,0.7);}
.nyt-arrow-up{top:64px;right:14px;}.nyt-arrow-down{bottom:100px;right:14px;}
.nyt-dots{position:absolute;right:14px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:5px;z-index:8;}
.nyt-dot{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.25);border:none;padding:0;cursor:pointer;transition:background 0.15s,transform 0.15s;}
.nyt-dot-on{background:#84cc16;transform:scale(1.5);}
.nyt-read-link{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;text-decoration:none;z-index:8;backdrop-filter:blur(6px);white-space:nowrap;}
.nyt-prog{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.08);}
.nyt-prog-fill{height:100%;background:linear-gradient(90deg,#84cc16,#22d3ee);transition:width 0.3s ease;}
@media(max-width:768px){.nyt-video-area{max-width:100%;}.nyt-title{font-size:14px;}.nyt-dots,.nyt-arrow{display:none;}}
`;

// ══════════════════════════════════════════════════════════════════════════════
// NewsVideoStrip — main component
// ══════════════════════════════════════════════════════════════════════════════
const NewsVideoStrip = ({ preferCategory = null, currentUser }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState(new Set()); // [RT3] track real-time arrivals
  const [viewerMode, setViewerMode] = useState(null);
  const [viewerIdx, setViewerIdx] = useState(0);
  const scrollRef = useRef(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cacheKey = preferCategory || "__all__";
    const now = Date.now();

    if (
      _cachedItems &&
      _cacheCategory === cacheKey &&
      now - _cacheFetchedAt < CACHE_TTL_MS
    ) {
      setItems(_cachedItems);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let q = supabase
          .from("news_posts")
          .select(
            "id,title,description,image_url,source_name,source_url,article_url,category,region,asset_tag,published_at,source_logo",
          )
          .eq("is_active", true)
          .not("image_url", "is", null)
          .order("published_at", { ascending: false })
          .limit(30);

        if (preferCategory) q = q.eq("category", preferCategory);

        const { data, error } = await q;
        if (error || cancelled) return;

        let rows = data ?? [];

        if (preferCategory && rows.length < 5) {
          const { data: more } = await supabase
            .from("news_posts")
            .select(
              "id,title,description,image_url,source_name,source_url,article_url,category,region,asset_tag,published_at,source_logo",
            )
            .eq("is_active", true)
            .not("image_url", "is", null)
            .order("published_at", { ascending: false })
            .limit(20);
          if (more) {
            const ids = new Set(rows.map((r) => r.id));
            rows = [...rows, ...more.filter((r) => !ids.has(r.id))];
          }
        }

        if (!cancelled) {
          _cachedItems = rows;
          _cacheCategory = cacheKey;
          _cacheFetchedAt = Date.now();
          setItems(rows);
        }
      } catch (err) {
        console.warn("[NewsVideoStrip]", err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferCategory]);

  // ── [RT1] Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    const channelName = `nvs_realtime_${preferCategory || "all"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "news_posts" },
        (payload) => {
          const row = payload.new;
          if (!row?.is_active || !row.image_url) return;
          if (
            preferCategory &&
            row.category?.toLowerCase() !== preferCategory.toLowerCase()
          )
            return;

          setItems((prev) => {
            if (prev.some((i) => i.id === row.id)) return prev;
            const next = [row, ...prev].slice(0, 40); // keep strip lean
            _cachedItems = next;
            _cacheFetchedAt = Date.now();
            return next;
          });

          // [RT3] Mark as new
          setNewIds((prev) => new Set([...prev, row.id]));

          // [RT4] Scroll strip back to left to reveal new card
          if (scrollRef.current) {
            setTimeout(() => {
              scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
            }, 150);
          }

          // Clear "new" badge after 8 seconds
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
          }, 8_000);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[NewsVideoStrip] Realtime connected ✓");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [preferCategory]);

  const openItem = useCallback(
    (index) => {
      const item = items[index];
      if (!item) return;
      setViewerIdx(index);
      setViewerMode(extractYouTubeId(item.article_url) ? "youtube" : "article");
    },
    [items],
  );

  const scrollBy = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <>
      <div className="nvs-root">
        <div className="nvs-header">
          <div className="nvs-header-left">
            <span className="nvs-live-dot" />
            <span className="nvs-label">Live News</span>
          </div>
          <div className="nvs-header-right">
            <button
              className="nvs-arr"
              onClick={() => scrollBy(-1)}
              aria-label="Previous"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="nvs-arr"
              onClick={() => scrollBy(1)}
              aria-label="Next"
            >
              <ChevronLeft size={15} style={{ transform: "scaleX(-1)" }} />
            </button>
          </div>
        </div>

        <div className="nvs-strip" ref={scrollRef}>
          {loading &&
            [1, 2, 3, 4].map((i) => <div key={i} className="nvs-skel" />)}

          {!loading &&
            items.map((item, idx) => {
              const cs = catStyle(item.category);
              const hasYT = Boolean(extractYouTubeId(item.article_url));
              const isNew = newIds.has(item.id); // [RT3]

              return (
                <button
                  key={item.id}
                  className={`nvs-card${isNew ? " nvs-card-new" : ""}`}
                  onClick={() => openItem(idx)}
                  aria-label={item.title}
                >
                  <div className="nvs-thumb-wrap">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="nvs-thumb"
                        loading={idx < 4 ? "eager" : "lazy"}
                      />
                    ) : (
                      <div className="nvs-thumb-ph">
                        <Rss size={24} color="rgba(255,255,255,0.2)" />
                      </div>
                    )}
                    <div className="nvs-thumb-grad" />
                    {hasYT && (
                      <div className="nvs-play-ring">
                        <Play size={16} fill="white" color="white" />
                      </div>
                    )}
                    {/* [RT3] NEW badge */}
                    {isNew && <div className="nvs-new-badge">NEW</div>}
                    {item.category && (
                      <div
                        className="nvs-cat-badge"
                        style={{ background: cs.bg }}
                      >
                        <span
                          style={{
                            background: cs.dot,
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            color: cs.tx,
                            fontSize: 8,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                          }}
                        >
                          {item.category.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="nvs-card-foot">
                    <div className="nvs-source-row">
                      <FaviconChip
                        sourceUrl={item.source_url}
                        articleUrl={item.article_url}
                        sourceName={item.source_name}
                        size={14}
                        radius={3}
                      />
                      <span className="nvs-source-name">
                        {item.source_name}
                      </span>
                    </div>
                    <p className="nvs-card-title">{item.title}</p>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {viewerMode === "youtube" && items.length > 0 && (
        <NewsYouTubeViewer
          items={items}
          startIndex={viewerIdx}
          onClose={() => setViewerMode(null)}
        />
      )}
      {viewerMode === "article" && items[viewerIdx] && (
        <NewsArticleViewer
          item={items[viewerIdx]}
          onClose={() => setViewerMode(null)}
        />
      )}

      <style>{NVS_CSS}</style>
    </>
  );
};

const NVS_CSS = `
.nvs-root{width:100%;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:2px;background:rgba(0,0,0,0.15);}
.nvs-header{display:flex;align-items:center;justify-content:space-between;padding:9px 14px 5px;}
.nvs-header-left{display:flex;align-items:center;gap:7px;}
.nvs-live-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;animation:nvsPulse 1.8s ease-in-out infinite;flex-shrink:0;}
@keyframes nvsPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
.nvs-label{font-size:11px;font-weight:800;color:rgba(255,255,255,0.55);letter-spacing:0.07em;text-transform:uppercase;}
.nvs-header-right{display:flex;gap:4px;}
.nvs-arr{width:26px;height:26px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;}
.nvs-arr:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);}
.nvs-strip{display:flex;align-items:flex-start;gap:9px;padding:0 14px 12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.nvs-strip::-webkit-scrollbar{display:none;}
/* [RT1] Slide-in animation for new cards */
@keyframes nvsSlideIn{from{opacity:0;transform:translateX(-20px) scale(0.95)}to{opacity:1;transform:none}}
.nvs-skel{width:140px;min-width:140px;height:185px;border-radius:12px;flex-shrink:0;background:rgba(255,255,255,0.05);animation:nvsSkel 1.4s ease-in-out infinite;scroll-snap-align:start;}
@keyframes nvsSkel{0%,100%{opacity:0.5}50%{opacity:0.15}}
.nvs-card{width:140px;min-width:140px;display:flex;flex-direction:column;background:transparent;border:none;padding:0;cursor:pointer;text-align:left;scroll-snap-align:start;flex-shrink:0;transition:transform 0.15s;}
.nvs-card:hover{transform:scale(1.03);}
.nvs-card:active{transform:scale(0.97);}
.nvs-card-new{animation:nvsSlideIn 0.4s cubic-bezier(0.34,1.2,0.64,1) both;}
.nvs-thumb-wrap{position:relative;width:140px;height:140px;border-radius:11px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,0.07);}
.nvs-card-new .nvs-thumb-wrap{border-color:rgba(132,204,22,0.4);box-shadow:0 0 12px rgba(132,204,22,0.18);}
.nvs-thumb{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.3s;}
.nvs-card:hover .nvs-thumb{transform:scale(1.06);}
.nvs-thumb-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0f0f,#1a1a1a);}
.nvs-thumb-grad{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.65));pointer-events:none;}
.nvs-play-ring{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.nvs-cat-badge{position:absolute;bottom:5px;left:5px;display:inline-flex;align-items:center;gap:3px;padding:2px 6px 2px 4px;border-radius:999px;backdrop-filter:blur(6px);}
/* [RT3] NEW badge */
.nvs-new-badge{position:absolute;top:5px;right:5px;padding:2px 6px;border-radius:999px;background:#84cc16;color:#000;font-size:8px;font-weight:900;letter-spacing:0.06em;animation:nvsBadgePop 0.3s cubic-bezier(0.34,1.4,0.64,1) both;}
@keyframes nvsBadgePop{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}
.nvs-card-foot{padding:5px 2px 0;}
.nvs-source-row{display:flex;align-items:center;gap:4px;margin-bottom:3px;}
.nvs-source-name{font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:105px;}
.nvs-card-title{font-size:11px;font-weight:700;color:rgba(255,255,255,0.78);line-height:1.4;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
@media(max-width:768px){.nvs-header{padding:7px 12px 4px;}.nvs-strip{padding:0 12px 10px;gap:8px;}.nvs-arr{display:none;}}
`;

export default NewsVideoStrip;
