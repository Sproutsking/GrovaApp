// ============================================================================
// src/components/Home/VideoCard.jsx
//
// Matches NewsCard design exactly.
// Features:
//  [V1] Same card structure as NewsCard — header, hero, body, footer.
//  [V2] Thumbnail on load; click → embedded YouTube player in-card.
//  [V3] Full timeline scrubbing via YouTube IFrame API.
//  [V4] Mute/unmute, fullscreen button, progress bar.
//  [V5] Live-ticking timestamp (useRelTime hook).
//  [V6] "LIVE" badge if published < 30 minutes ago.
//  [V7] Full-screen overlay player (same as NewsCard full-screen reader).
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Play,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  ExternalLink,
  Clock,
  Rss,
} from "lucide-react";

// ── Live-ticking timestamp hook ───────────────────────────────────────────────
export function useRelTime(dateStr) {
  const calc = useCallback(() => {
    if (!dateStr) return "";
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }, [dateStr]);

  const [label, setLabel] = useState(() => calc());

  useEffect(() => {
    setLabel(calc());
    // Tick every 15s for fresh "just now" / "Xs ago" labels
    const id = setInterval(() => setLabel(calc()), 15_000);
    return () => clearInterval(id);
  }, [calc]);

  return label;
}

// ── Is this video "live" (published < 30 min ago)? ───────────────────────────
function isLive(dateStr) {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 30 * 60_000;
}

const CAT_STYLES = {
  global: {
    bg: "rgba(59,130,246,0.12)",
    bd: "rgba(59,130,246,0.3)",
    dot: "#3b82f6",
    tx: "#60a5fa",
  },
  africa: {
    bg: "rgba(249,115,22,0.12)",
    bd: "rgba(249,115,22,0.3)",
    dot: "#f97316",
    tx: "#fb923c",
  },
  crypto: {
    bg: "rgba(234,179,8,0.12)",
    bd: "rgba(234,179,8,0.3)",
    dot: "#eab308",
    tx: "#fbbf24",
  },
  default: {
    bg: "rgba(132,204,22,0.08)",
    bd: "rgba(132,204,22,0.25)",
    dot: "#84cc16",
    tx: "#a3e635",
  },
};
const catStyle = (c) =>
  CAT_STYLES[(c || "").toLowerCase()] || CAT_STYLES.default;

const YT_EMBED = (id) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;

// ── Source favicon ────────────────────────────────────────────────────────────
const SourceIcon = ({ name, size = 36, radius = 10 }) => {
  const initials = (name || "YT")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: "linear-gradient(135deg,#7f1d1d,#450a0a)",
        border: "1px solid rgba(239,68,68,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size < 40 ? 11 : 13,
        fontWeight: 900,
        color: "#f87171",
        letterSpacing: "0.5px",
      }}
    >
      {initials || "▶"}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Full-screen video overlay (same feel as FullScreenNewsView)
// ══════════════════════════════════════════════════════════════════════════════
const FullScreenVideoView = ({ video, onClose }) => {
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const rafRef = useRef(null);
  const isMobile = window.innerWidth <= 768;
  const cs = catStyle(video.category);
  const ts = useRelTime(video.published_at);
  const live = isLive(video.published_at);

  // Scroll lock
  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, {
      overflow: "hidden",
      position: "fixed",
      top: `-${y}px`,
      left: "0",
      right: "0",
    });
    document.body.dataset.fsvY = y;
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.fsvY || "0"));
      window.removeEventListener("keydown", esc);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onClose]);

  // YouTube IFrame API — progress tracking
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const tryInit = () => {
      if (!window.YT?.Player || !iframeRef.current) return;
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: (e) => {
            if (muted) e.target.mute();
            trackProgress();
          },
        },
      });
    };
    const old = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      old?.();
      tryInit();
    };
    const t = setTimeout(tryInit, 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const trackProgress = () => {
    const tick = () => {
      try {
        const p = playerRef.current;
        if (p?.getDuration?.()) {
          const pct = (p.getCurrentTime() / p.getDuration()) * 100;
          setProgress(Math.min(100, Math.max(0, pct)));
        }
      } catch {
        /* ignore */
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleSeek = useCallback((e) => {
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const dur = playerRef.current?.getDuration?.() || 0;
      if (dur > 0) {
        playerRef.current.seekTo((pct / 100) * dur, true);
        setProgress(pct);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = () => {
    try {
      if (muted) playerRef.current?.unMute?.();
      else playerRef.current?.mute?.();
    } catch {
      /* ignore */
    }
    setMuted((v) => !v);
  };

  const openYT = () =>
    window.open(
      `https://www.youtube.com/watch?v=${video.videoId}`,
      "_blank",
      "noopener",
    );

  return ReactDOM.createPortal(
    <>
      <div className="fsv-root" role="dialog">
        {!isMobile && <div className="fsv-backdrop" onClick={onClose} />}
        <div
          className={isMobile ? "fsv-sheet" : "fsv-desktop"}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Topbar */}
          <div className="fsv-topbar">
            <button className="fsv-close" onClick={onClose} aria-label="Close">
              {isMobile ? "←" : <X size={16} />}
            </button>
            <div className="fsv-topbar-info">
              <span className="fsv-topbar-src">{video.channelName}</span>
              <span className="fsv-topbar-ts">{ts}</span>
            </div>
            <div style={{ flex: 1 }} />
            <div className="fsv-video-tag">
              <span className="fsv-vt-dot" />
              {live ? "LIVE NOW" : "VIDEO"}
            </div>
          </div>

          {/* Player */}
          <div className="fsv-player-wrap">
            <iframe
              ref={iframeRef}
              src={YT_EMBED(video.videoId)}
              title={video.title}
              allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="fsv-iframe"
              style={{ border: "none" }}
            />
          </div>

          {/* Progress / scrub bar */}
          <div
            className="fsv-scrub-wrap"
            role="slider"
            aria-label="Video progress"
            aria-valuenow={Math.round(progress)}
            tabIndex={0}
            onClick={handleSeek}
            onMouseDown={() => setSeeking(true)}
            onMouseUp={() => setSeeking(false)}
          >
            <div className="fsv-scrub-track">
              <div
                className="fsv-scrub-fill"
                style={{ width: `${progress}%` }}
              />
              <div
                className="fsv-scrub-thumb"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="fsv-controls">
            <button
              className="fsv-ctrl-btn"
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div style={{ flex: 1 }} />
            {video.category && (
              <span
                className="fsv-cat"
                style={{ background: cs.bg, color: cs.tx }}
              >
                <span
                  style={{
                    background: cs.dot,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {video.category.toUpperCase()}
              </span>
            )}
            <button
              className="fsv-ctrl-btn fsv-yt-btn"
              onClick={openYT}
              title="Watch on YouTube"
            >
              <ExternalLink size={14} /> YouTube
            </button>
          </div>

          {/* Title */}
          <div className="fsv-body">
            <h2 className="fsv-title">{video.title}</h2>
          </div>
        </div>
      </div>
      <style>{FSV_CSS}</style>
    </>,
    document.body,
  );
};

const FSV_CSS = `
.fsv-root{isolation:isolate;position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;}
.fsv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);animation:fsvFade .2s ease both;}
@keyframes fsvFade{from{opacity:0}to{opacity:1}}
.fsv-desktop{position:relative;z-index:1;width:min(780px,94vw);max-height:94vh;border-radius:20px;overflow:hidden;background:#0d0d0d;border:1px solid rgba(255,255,255,0.1);box-shadow:0 32px 80px rgba(0,0,0,0.8);display:flex;flex-direction:column;animation:fsvUp .25s cubic-bezier(0.34,1.2,0.64,1) both;}
@keyframes fsvUp{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:none}}
.fsv-sheet{position:relative;z-index:1;width:100%;height:100%;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden;}
.fsv-topbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;min-height:54px;}
.fsv-close{width:36px;height:36px;min-width:36px;border-radius:50%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:18px;transition:all .15s;}
.fsv-close:hover{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#f87171;}
.fsv-topbar-info{display:flex;flex-direction:column;gap:1px;min-width:0;}
.fsv-topbar-src{font-size:13px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fsv-topbar-ts{font-size:10px;color:rgba(255,255,255,0.35);font-variant-numeric:tabular-nums;}
.fsv-video-tag{display:flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);font-size:9px;font-weight:900;color:#f87171;letter-spacing:0.1em;flex-shrink:0;}
.fsv-vt-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;animation:fsvPulse 1.4s ease-in-out infinite;}
@keyframes fsvPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}
.fsv-player-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#000;flex-shrink:0;}
.fsv-iframe{position:absolute;inset:0;width:100%;height:100%;}
/* Scrub bar */
.fsv-scrub-wrap{padding:10px 16px 4px;cursor:pointer;flex-shrink:0;}
.fsv-scrub-track{position:relative;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:visible;}
.fsv-scrub-fill{height:100%;background:#ef4444;border-radius:2px;transition:width .1s linear;}
.fsv-scrub-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.6);pointer-events:none;transition:left .1s linear;}
.fsv-scrub-wrap:hover .fsv-scrub-track{height:6px;}
/* Controls */
.fsv-controls{display:flex;align-items:center;gap:10px;padding:6px 16px 8px;flex-shrink:0;}
.fsv-ctrl-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
.fsv-ctrl-btn:hover{background:rgba(255,255,255,0.12);color:#fff;}
.fsv-yt-btn{border-color:rgba(239,68,68,0.25);color:#f87171;}
.fsv-yt-btn:hover{background:rgba(239,68,68,0.1);}
.fsv-cat{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 6px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.04em;}
.fsv-body{padding:10px 16px 14px;overflow-y:auto;flex:1;}
.fsv-title{font-size:16px;font-weight:800;color:#f0f0f0;line-height:1.45;margin:0;word-break:break-word;}
@media(max-width:768px){.fsv-title{font-size:15px;}}
`;

// ══════════════════════════════════════════════════════════════════════════════
// VideoCard — matches NewsCard layout exactly
// ══════════════════════════════════════════════════════════════════════════════
const VideoCard = ({ video }) => {
  const [playing, setPlaying] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const ts = useRelTime(video.published_at);
  const live = isLive(video.published_at);
  const cs = catStyle(video.category);

  const thumbSrc = thumbErr
    ? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`
    : video.thumbnail ||
      `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;

  const openFull = (e) => {
    e?.stopPropagation();
    setShowFull(true);
  };

  return (
    <>
      <div className="vc-card content-card">
        {/* HEADER — matches NewsCard header exactly */}
        <div className="vc-header">
          <SourceIcon name={video.channelName} size={36} radius={10} />
          <div className="vc-source-info">
            <div className="vc-source-row-top">
              <span className="vc-source-name">
                {video.channelName || "YouTube News"}
              </span>
              <span className="vc-yt-icon">▶</span>
            </div>
            <div className="vc-meta">
              <span className="vc-ts">
                <Clock size={10} />
                {ts}
              </span>
            </div>
          </div>
          {/* LIVE badge if < 30 min, else VIDEO badge */}
          <div className={`vc-badge${live ? " vc-badge--live" : ""}`}>
            <span className="vc-badge-dot" />
            {live ? "LIVE NOW" : "VIDEO"}
          </div>
        </div>

        {/* HERO — thumbnail or inline player */}
        <div
          className="vc-hero"
          onClick={playing ? undefined : openFull}
          role={playing ? undefined : "button"}
          tabIndex={playing ? undefined : 0}
          onKeyDown={(e) => !playing && e.key === "Enter" && openFull(e)}
        >
          {!playing ? (
            <>
              <img
                src={thumbSrc}
                alt={video.title}
                className="vc-thumb"
                loading="lazy"
                onError={() => setThumbErr(true)}
              />
              <div className="vc-thumb-grad" />
              {/* Play overlay — frosted glass, no garish red circle */}
              <div className="vc-play-overlay">
                <div className="vc-play-ring">
                  <Play size={22} fill="white" color="white" />
                </div>
              </div>
              {/* Category chip */}
              {video.category && (
                <div className="vc-cat-chip" style={{ background: cs.bg }}>
                  <span
                    style={{
                      background: cs.dot,
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      color: cs.tx,
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {video.category.toUpperCase()}
                  </span>
                </div>
              )}
              {/* Duration badge */}
              <div className="vc-yt-chip">▶ YouTube</div>
            </>
          ) : (
            // Inline mini-player (click to expand full)
            <iframe
              src={YT_EMBED(video.videoId)}
              title={video.title}
              allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="vc-inline-iframe"
              style={{ border: "none" }}
            />
          )}
        </div>

        {/* BODY */}
        <div className="vc-body">
          <h3
            className="vc-title"
            onClick={openFull}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openFull(e)}
          >
            {video.title}
          </h3>
        </div>

        {/* TAGS */}
        {video.category && (
          <div className="vc-tags-row">
            <span
              className="vc-tag"
              style={{ background: cs.bg, borderColor: cs.bd }}
            >
              <span style={{ background: cs.dot }} className="vc-tag-dot" />
              <span style={{ color: cs.tx }}>
                {video.category.toUpperCase()}
              </span>
            </span>
          </div>
        )}

        {/* FOOTER */}
        <div className="vc-footer">
          <button className="vc-btn-watch" onClick={openFull}>
            <Play size={12} fill="currentColor" /> Watch
          </button>
          <button
            className="vc-btn-inline"
            onClick={(e) => {
              e.stopPropagation();
              setPlaying((v) => !v);
            }}
          >
            {playing ? "▪ Stop" : "▶ Play here"}
          </button>
          <a
            href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vc-btn-yt"
            onClick={(e) => e.stopPropagation()}
          >
            YouTube ↗
          </a>
        </div>
      </div>

      {showFull && (
        <FullScreenVideoView video={video} onClose={() => setShowFull(false)} />
      )}

      <style>{VC_CSS}</style>
    </>
  );
};

const VC_CSS = `
/* VideoCard — mirrors NewsCard structure */
.vc-card{background:var(--card-bg,#111);border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;position:relative;transition:border-color .2s;}
.vc-card::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#ef4444 0%,#f97316 50%,#fbbf24 100%);opacity:0.65;z-index:1;}
.vc-card:hover{border-color:rgba(255,255,255,0.12);}
@media(max-width:768px){.vc-card{border-radius:0!important;border-left:none;border-right:none;}}
.vc-header{display:flex;align-items:center;gap:10px;padding:12px 14px 8px;}
.vc-source-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.vc-source-row-top{display:flex;align-items:center;gap:6px;}
.vc-source-name{font-size:13px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:185px;}
.vc-yt-icon{width:17px;height:17px;border-radius:4px;background:rgba(239,68,68,0.85);display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:900;flex-shrink:0;}
.vc-meta{display:flex;align-items:center;gap:8px;}
.vc-ts{display:flex;align-items:center;gap:3px;font-size:10.5px;color:rgba(255,255,255,0.35);font-weight:500;font-variant-numeric:tabular-nums;}
.vc-badge{display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:9px;font-weight:800;color:#f87171;letter-spacing:0.08em;flex-shrink:0;}
.vc-badge--live{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#fca5a5;animation:vcLiveGlow 2s ease-in-out infinite;}
@keyframes vcLiveGlow{0%,100%{box-shadow:0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 10px rgba(239,68,68,0.35)}}
.vc-badge-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:vcPulse 1.8s ease-in-out infinite;}
@keyframes vcPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
/* Hero */
.vc-hero{position:relative;width:100%;height:200px;overflow:hidden;background:#0a0a0a;cursor:pointer;}
.vc-thumb{width:100%;height:200px;object-fit:cover;display:block;transition:transform .3s;}
.vc-card:hover .vc-thumb{transform:scale(1.02);}
.vc-thumb-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 55%);pointer-events:none;}
.vc-play-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;}
.vc-play-ring{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .2s;}
.vc-hero:hover .vc-play-ring{background:rgba(255,255,255,0.22);border-color:rgba(255,255,255,0.7);transform:scale(1.08);}
.vc-cat-chip{position:absolute;bottom:28px;left:10px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px 2px 5px;border-radius:999px;backdrop-filter:blur(6px);}
.vc-yt-chip{position:absolute;top:8px;left:8px;padding:2px 7px;border-radius:4px;background:rgba(239,68,68,0.85);color:#fff;font-size:8px;font-weight:900;letter-spacing:.03em;}
.vc-inline-iframe{width:100%;height:200px;display:block;}
/* Body */
.vc-body{padding:10px 14px 6px;}
.vc-title{font-size:15px;font-weight:800;color:#f0f0f0;line-height:1.45;margin:0 0 7px;cursor:pointer;transition:color .15s;word-break:break-word;}
.vc-title:hover{color:#f87171;}
/* Tags */
.vc-tags-row{display:flex;align-items:center;gap:6px;padding:4px 14px 2px;flex-wrap:wrap;}
.vc-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 7px;border-radius:999px;border:1px solid;font-size:9.5px;font-weight:800;letter-spacing:.04em;}
.vc-tag-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;display:inline-block;}
/* Footer */
.vc-footer{display:flex;align-items:center;gap:8px;padding:8px 14px 11px;border-top:1px solid rgba(255,255,255,0.04);margin-top:6px;}
.vc-btn-watch{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
.vc-btn-watch:hover{background:rgba(239,68,68,0.18);transform:translateY(-1px);}
.vc-btn-inline{display:inline-flex;align-items:center;gap:4px;padding:6px 11px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
.vc-btn-inline:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);}
.vc-btn-yt{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none;transition:all .15s;white-space:nowrap;margin-left:auto;}
.vc-btn-yt:hover{background:rgba(239,68,68,0.08);color:#f87171;border-color:rgba(239,68,68,0.25);}
`;

export default VideoCard;
