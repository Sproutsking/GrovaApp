// ============================================================================
// src/components/Home/VideoCard.jsx  — v5  ZERO CSS POLLUTION
//
// EVERY CSS class is prefixed xvc- (card) or xfsv- (full-screen view).
// These prefixes are unique enough to never collide with PostCard, NewsCard
// or any other component in the app.
//
// NO border-left on any element — that was causing the red line in PostTab.
// NO ::before pseudo-element.
// NO generic keyframe names — all prefixed xvc* / xfsv*.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Play, Volume2, VolumeX, X, ExternalLink,
  Clock, ChevronLeft, ChevronRight, Radio,
} from "lucide-react";

export function useRelTime(dateStr) {
  const calc = useCallback(() => {
    if (!dateStr) return "";
    const ts = typeof dateStr === "number" ? dateStr : new Date(dateStr).getTime();
    if (isNaN(ts) || ts <= 0) return "";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 0 || s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [dateStr]);
  const [label, setLabel] = useState(() => calc());
  useEffect(() => {
    setLabel(calc());
    const id = setInterval(() => setLabel(calc()), 15_000);
    return () => clearInterval(id);
  }, [calc]);
  return label;
}

function isLiveNow(v) {
  return v?.isLiveBroadcast === true || v?.liveStatus === "live";
}

const CAT = {
  global:  { bg: "rgba(59,130,246,0.12)", bd: "rgba(59,130,246,0.3)",  dot: "#3b82f6", tx: "#60a5fa" },
  africa:  { bg: "rgba(249,115,22,0.12)", bd: "rgba(249,115,22,0.3)",  dot: "#f97316", tx: "#fb923c" },
  crypto:  { bg: "rgba(234,179,8,0.12)",  bd: "rgba(234,179,8,0.3)",   dot: "#eab308", tx: "#fbbf24" },
  default: { bg: "rgba(132,204,22,0.08)", bd: "rgba(132,204,22,0.25)", dot: "#84cc16", tx: "#a3e635" },
};
const cs = (c) => CAT[(c || "").toLowerCase()] || CAT.default;

const YT_FS     = (id, m) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${m?1:0}&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
const YT_INLINE = (id)    => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

const XvcIcon = ({ name, size = 36, radius = 10 }) => {
  const ini = (name || "YT").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: "linear-gradient(135deg,#7f1d1d,#450a0a)",
      border: "1px solid rgba(239,68,68,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size < 40 ? 11 : 13, fontWeight: 900, color: "#f87171",
    }}>
      {ini || "▶"}
    </div>
  );
};

// ── Full-screen player ────────────────────────────────────────────────────────
const FullScreenVideoView = ({ videos, startIndex, onClose }) => {
  const [idx,   setIdx]   = useState(startIndex);
  const [muted, setMuted] = useState(false);
  const [prog,  setProg]  = useState(0);
  const touchX = useRef(null);
  const ifRef  = useRef(null);
  const plRef  = useRef(null);
  const rafRef = useRef(null);
  const isMob  = window.innerWidth <= 768;
  const vid    = videos[idx];
  const c      = cs(vid?.category);
  const ts     = useRelTime(vid?.published_at);
  const live   = isLiveNow(vid);

  useEffect(() => {
    const y = window.scrollY;
    Object.assign(document.body.style, { overflow:"hidden", position:"fixed", top:`-${y}px`, left:"0", right:"0" });
    document.body.dataset.xfsvY = y;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")  setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(videos.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.cssText = "";
      window.scrollTo(0, parseInt(document.body.dataset.xfsvY || "0"));
      window.removeEventListener("keydown", onKey);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onClose, videos.length]);

  useEffect(() => {
    if (live || !ifRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProg(0);
    if (plRef.current) { try { plRef.current.destroy(); } catch { /* ignore */ } plRef.current = null; }
    const tryInit = () => {
      if (!window.YT?.Player || !ifRef.current) return;
      plRef.current = new window.YT.Player(ifRef.current, {
        events: {
          onReady: (e) => {
            if (muted) e.target.mute();
            const tick = () => {
              try {
                const p = plRef.current;
                if (p?.getDuration?.() > 0) setProg((p.getCurrentTime() / p.getDuration()) * 100);
              } catch { /* ignore */ }
              rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
          },
        },
      });
    };
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = tryInit;
    } else { setTimeout(tryInit, 600); }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [idx, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = useCallback((e) => {
    if (live) return;
    try {
      const r = e.currentTarget.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      const dur = plRef.current?.getDuration?.() || 0;
      if (dur > 0) { plRef.current.seekTo((pct / 100) * dur, true); setProg(pct); }
    } catch { /* ignore */ }
  }, [live]);

  const toggleMute = () => {
    try { if (muted) plRef.current?.unMute?.(); else plRef.current?.mute?.(); } catch { /* ignore */ }
    setMuted((v) => !v);
  };
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx((i) => Math.min(videos.length - 1, i + 1)), [videos.length]);

  return ReactDOM.createPortal(
    <>
      <div className="xfsv-root"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const d = touchX.current - e.changedTouches[0].clientX;
          if (d > 50) next(); else if (d < -50) prev();
          touchX.current = null;
        }}
      >
        {!isMob && <div className="xfsv-bd" onClick={onClose} />}
        <div className={isMob ? "xfsv-sheet" : "xfsv-desk"} onClick={(e) => e.stopPropagation()}>
          <div className="xfsv-bar">
            <button className="xfsv-close" onClick={onClose}><X size={16} /></button>
            <div className="xfsv-bar-info">
              <span className="xfsv-bar-src">{vid?.channelName}</span>
              <span className="xfsv-bar-ts">{live ? "Broadcasting live" : ts}</span>
            </div>
            <div style={{ flex: 1 }} />
            {videos.length > 1 && <span className="xfsv-ctr">{idx + 1} / {videos.length}</span>}
            <div className={`xfsv-tag${live ? " xfsv-tag--live" : ""}`}>
              <span className="xfsv-tag-dot" />{live ? "LIVE NOW" : "VIDEO"}
            </div>
          </div>
          {idx > 0 && <button className="xfsv-nav xfsv-nav-l" onClick={prev}><ChevronLeft size={24} /></button>}
          {idx < videos.length - 1 && <button className="xfsv-nav xfsv-nav-r" onClick={next}><ChevronRight size={24} /></button>}
          <div className="xfsv-player">
            <iframe ref={ifRef} key={`xfsv-${idx}`} src={YT_FS(vid?.videoId, muted)} title={vid?.title}
              allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen className="xfsv-iframe" style={{ border: "none" }} />
          </div>
          {!live ? (
            <div className="xfsv-scrub" onClick={seek}>
              <div className="xfsv-track">
                <div className="xfsv-fill" style={{ width: `${prog}%` }} />
                <div className="xfsv-thumb" style={{ left: `${prog}%` }} />
              </div>
            </div>
          ) : (
            <div className="xfsv-live-bar"><span className="xfsv-live-dot" />LIVE — seeking disabled</div>
          )}
          <div className="xfsv-ctrl-row">
            <button className="xfsv-btn" onClick={toggleMute}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div style={{ flex: 1 }} />
            {vid?.category && (
              <span className="xfsv-cat" style={{ background: c.bg, color: c.tx }}>
                <span style={{ background: c.dot, width: 5, height: 5, borderRadius: "50%", display: "inline-block" }} />
                {vid.category.toUpperCase()}
              </span>
            )}
            <button className="xfsv-btn xfsv-btn-yt"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${vid.videoId}`, "_blank", "noopener")}>
              <ExternalLink size={14} /> {live ? "Watch Live" : "YouTube"}
            </button>
          </div>
          <div className="xfsv-body">
            <h2 className="xfsv-title">{vid?.title}</h2>
            {videos.length > 1 && (
              <div className="xfsv-dots">
                {videos.slice(0, 20).map((_, i) => (
                  <button key={i} className={`xfsv-dot${i === idx ? " xfsv-dot--on" : ""}`} onClick={() => setIdx(i)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{XFSV_CSS}</style>
    </>,
    document.body,
  );
};

const XFSV_CSS = `
.xfsv-root{isolation:isolate;position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;}
.xfsv-bd{position:absolute;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);animation:xfsvFd .2s ease both;}
@keyframes xfsvFd{from{opacity:0}to{opacity:1}}
.xfsv-desk{position:relative;z-index:1;width:min(780px,94vw);max-height:94vh;border-radius:20px;overflow:hidden;background:#0d0d0d;border:1px solid rgba(255,255,255,0.1);box-shadow:0 32px 80px rgba(0,0,0,0.8);display:flex;flex-direction:column;animation:xfsvUp .25s cubic-bezier(0.34,1.2,0.64,1) both;}
@keyframes xfsvUp{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:none}}
.xfsv-sheet{position:relative;z-index:1;width:100%;height:100%;background:#0d0d0d;display:flex;flex-direction:column;overflow:hidden;}
.xfsv-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;min-height:54px;position:relative;z-index:10;}
.xfsv-close{width:36px;height:36px;min-width:36px;border-radius:50%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .15s;}
.xfsv-close:hover{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#f87171;}
.xfsv-bar-info{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;}
.xfsv-bar-src{font-size:13px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.xfsv-bar-ts{font-size:10px;color:rgba(255,255,255,0.35);font-variant-numeric:tabular-nums;}
.xfsv-ctr{font-size:11px;font-weight:700;color:rgba(255,255,255,0.3);padding:2px 8px;background:rgba(255,255,255,0.06);border-radius:999px;flex-shrink:0;}
.xfsv-tag{display:flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);font-size:9px;font-weight:900;color:#f87171;flex-shrink:0;}
.xfsv-tag--live{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);animation:xfsvLG 1.5s ease-in-out infinite;}
@keyframes xfsvLG{0%,100%{box-shadow:none}50%{box-shadow:0 0 12px rgba(239,68,68,0.5)}}
.xfsv-tag-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;animation:xfsvP 1.4s ease-in-out infinite;}
@keyframes xfsvP{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}
.xfsv-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:20;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.18);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;backdrop-filter:blur(10px);}
.xfsv-nav:hover{background:rgba(255,255,255,0.15);border-color:rgba(255,255,255,0.5);}
.xfsv-nav-l{left:10px;}.xfsv-nav-r{right:10px;}
@media(max-width:768px){.xfsv-nav{width:38px;height:38px;}.xfsv-nav-l{left:4px;}.xfsv-nav-r{right:4px;}}
.xfsv-player{position:relative;width:100%;aspect-ratio:16/9;background:#000;flex-shrink:0;}
.xfsv-iframe{position:absolute;inset:0;width:100%;height:100%;}
.xfsv-scrub{padding:10px 16px 4px;cursor:pointer;flex-shrink:0;user-select:none;}
.xfsv-track{position:relative;height:4px;background:rgba(255,255,255,0.12);border-radius:2px;overflow:visible;}
.xfsv-scrub:hover .xfsv-track{height:6px;}
.xfsv-fill{height:100%;background:#ef4444;border-radius:2px;transition:width .1s linear;}
.xfsv-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid #fff;pointer-events:none;transition:left .1s linear;}
.xfsv-live-bar{display:flex;align-items:center;gap:8px;padding:10px 16px 4px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);flex-shrink:0;}
.xfsv-live-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:xfsvLD 1.4s ease-in-out infinite;}
@keyframes xfsvLD{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}
.xfsv-ctrl-row{display:flex;align-items:center;gap:10px;padding:6px 16px 8px;flex-shrink:0;}
.xfsv-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
.xfsv-btn:hover{background:rgba(255,255,255,0.12);color:#fff;}
.xfsv-btn-yt{border-color:rgba(239,68,68,0.25);color:#f87171;}
.xfsv-btn-yt:hover{background:rgba(239,68,68,0.1);}
.xfsv-cat{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 6px;border-radius:999px;font-size:9px;font-weight:800;}
.xfsv-body{padding:10px 16px 14px;overflow-y:auto;flex:1;}
.xfsv-title{font-size:16px;font-weight:800;color:#f0f0f0;line-height:1.45;margin:0 0 12px;word-break:break-word;}
@media(max-width:768px){.xfsv-title{font-size:15px;}}
.xfsv-dots{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.xfsv-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;padding:0;cursor:pointer;transition:all .15s;flex-shrink:0;}
.xfsv-dot--on{background:#ef4444;transform:scale(1.4);}
.xfsv-dot:hover:not(.xfsv-dot--on){background:rgba(255,255,255,0.35);}
`;

// ── VideoCard — zero CSS pollution ────────────────────────────────────────────
const VideoCard = ({ video, allVideos }) => {
  const [playing,  setPlaying]  = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const ts    = useRelTime(video.published_at);
  const live  = isLiveNow(video);
  const c     = cs(video.category);
  const pvids = allVideos?.length ? allVideos : [video];
  const si    = Math.max(0, pvids.findIndex((v) => v.videoId === video.videoId));
  // Robust thumbnail with double fallback
  const thumb = thumbErr
    ? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`
    : (video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`);
  const openFull = (e) => { e?.stopPropagation(); setShowFull(true); };

  return (
    <>
      <div className="xvc-card">
        <div className="xvc-header">
          <XvcIcon name={video.channelName} size={36} radius={10} />
          <div className="xvc-src-info">
            <div className="xvc-src-row">
              <span className="xvc-src-name">{video.channelName || "YouTube News"}</span>
              <span className="xvc-yt-pill">▶</span>
            </div>
            <span className="xvc-ts"><Clock size={10} />{ts}</span>
          </div>
          <div className={`xvc-badge${live ? " xvc-badge--live" : ""}`}>
            <span className="xvc-badge-dot" />{live ? "LIVE NOW" : "VIDEO"}
          </div>
        </div>

        <div className="xvc-hero" onClick={playing ? undefined : openFull}
          role={playing ? undefined : "button"} tabIndex={playing ? undefined : 0}
          onKeyDown={(e) => !playing && e.key === "Enter" && openFull(e)}>
          {!playing ? (
            <>
              <img src={thumb} alt={video.title} className="xvc-thumb" loading="lazy"
                onError={() => !thumbErr && setThumbErr(true)} />
              <div className="xvc-grad" />
              <div className="xvc-play-wrap">
                <div className="xvc-play-ring">
                  {live ? <Radio size={22} color="white" /> : <Play size={22} fill="white" color="white" />}
                </div>
              </div>
              {video.category && (
                <div className="xvc-cat-chip" style={{ background: c.bg }}>
                  <span style={{ background: c.dot, width: 4, height: 4, borderRadius: "50%", display: "inline-block" }} />
                  <span style={{ color: c.tx, fontSize: 8, fontWeight: 800 }}>{video.category.toUpperCase()}</span>
                </div>
              )}
              <div className={`xvc-chip${live ? " xvc-chip--live" : ""}`}>{live ? "● LIVE" : "▶ YouTube"}</div>
            </>
          ) : (
            <iframe src={YT_INLINE(video.videoId)} title={video.title}
              allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen className="xvc-iframe" style={{ border: "none" }} />
          )}
        </div>

        <div className="xvc-body">
          <h3 className="xvc-title" onClick={openFull} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openFull(e)}>
            {video.title}
          </h3>
        </div>

        {video.category && (
          <div className="xvc-tags">
            <span className="xvc-tag" style={{ background: c.bg, borderColor: c.bd }}>
              <span style={{ background: c.dot }} className="xvc-tag-dot" />
              <span style={{ color: c.tx }}>{video.category.toUpperCase()}</span>
            </span>
          </div>
        )}

        <div className="xvc-footer">
          <button className="xvc-btn-watch" onClick={openFull}>
            <Play size={12} fill="currentColor" /> Watch
          </button>
          <button className="xvc-btn-inline" onClick={(e) => { e.stopPropagation(); setPlaying((v) => !v); }}>
            {playing ? "▪ Stop" : "▶ Play here"}
          </button>
          <a href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank" rel="noopener noreferrer" className="xvc-btn-yt"
            onClick={(e) => e.stopPropagation()}>
            YouTube ↗
          </a>
        </div>
      </div>

      {showFull && <FullScreenVideoView videos={pvids} startIndex={si} onClose={() => setShowFull(false)} />}
      <style>{XVC_CSS}</style>
    </>
  );
};

const XVC_CSS = `
.xvc-card{background:var(--card-bg,#111);border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;transition:border-color .2s,box-shadow .2s;}
.xvc-card:hover{border-color:rgba(255,255,255,0.14);box-shadow:0 4px 24px rgba(0,0,0,0.3);}
@media(max-width:768px){.xvc-card{border-radius:0!important;border-left:none;border-right:none;}}
.xvc-header{display:flex;align-items:center;gap:10px;padding:12px 14px 8px;}
.xvc-src-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.xvc-src-row{display:flex;align-items:center;gap:6px;}
.xvc-src-name{font-size:13px;font-weight:700;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:185px;}
.xvc-yt-pill{width:17px;height:17px;border-radius:4px;background:rgba(239,68,68,0.85);display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:900;flex-shrink:0;}
.xvc-ts{display:flex;align-items:center;gap:3px;font-size:10.5px;color:rgba(255,255,255,0.35);font-weight:500;font-variant-numeric:tabular-nums;}
.xvc-badge{display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:9px;font-weight:800;color:#f87171;flex-shrink:0;}
.xvc-badge--live{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#fca5a5;animation:xvcLG 2s ease-in-out infinite;}
@keyframes xvcLG{0%,100%{box-shadow:0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 10px rgba(239,68,68,0.35)}}
.xvc-badge-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:xvcP 1.8s ease-in-out infinite;}
@keyframes xvcP{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.xvc-hero{position:relative;width:100%;height:200px;overflow:hidden;background:#0a0a0a;cursor:pointer;}
.xvc-thumb{width:100%;height:200px;object-fit:cover;display:block;transition:transform .3s;}
.xvc-card:hover .xvc-thumb{transform:scale(1.02);}
.xvc-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 55%);pointer-events:none;}
.xvc-play-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;}
.xvc-play-ring{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .2s;}
.xvc-hero:hover .xvc-play-ring{background:rgba(255,255,255,0.22);border-color:rgba(255,255,255,0.7);transform:scale(1.08);}
.xvc-cat-chip{position:absolute;bottom:28px;left:10px;display:inline-flex;align-items:center;gap:3px;padding:2px 7px 2px 5px;border-radius:999px;backdrop-filter:blur(6px);}
.xvc-chip{position:absolute;top:8px;left:8px;padding:2px 7px;border-radius:4px;background:rgba(239,68,68,0.85);color:#fff;font-size:8px;font-weight:900;}
.xvc-chip--live{animation:xvcLG 1.5s ease-in-out infinite;}
.xvc-iframe{width:100%;height:200px;display:block;}
.xvc-body{padding:10px 14px 6px;}
.xvc-title{font-size:15px;font-weight:800;color:#f0f0f0;line-height:1.45;margin:0 0 7px;cursor:pointer;transition:color .15s;word-break:break-word;}
.xvc-title:hover{color:#f87171;}
.xvc-tags{display:flex;align-items:center;gap:6px;padding:4px 14px 2px;flex-wrap:wrap;}
.xvc-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 7px;border-radius:999px;border:1px solid;font-size:9.5px;font-weight:800;}
.xvc-tag-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;display:inline-block;}
.xvc-footer{display:flex;align-items:center;gap:8px;padding:8px 14px 11px;border-top:1px solid rgba(255,255,255,0.04);margin-top:6px;}
.xvc-btn-watch{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
.xvc-btn-watch:hover{background:rgba(239,68,68,0.18);transform:translateY(-1px);}
.xvc-btn-inline{display:inline-flex;align-items:center;gap:4px;padding:6px 11px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;}
.xvc-btn-inline:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);}
.xvc-btn-yt{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none;transition:all .15s;white-space:nowrap;margin-left:auto;}
.xvc-btn-yt:hover{background:rgba(239,68,68,0.08);color:#f87171;border-color:rgba(239,68,68,0.25);}
`;

export default VideoCard;