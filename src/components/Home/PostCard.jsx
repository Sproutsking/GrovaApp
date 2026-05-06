// src/components/Home/PostCard.jsx — v5 ZERO-WAIT MEDIA
//
// ════════════════════════════════════════════════════════════════════════════
// HOW MEDIA APPEARS INSTANTLY
//
// PostTab's dual-pipeline preloader has already fetched every image into the
// browser HTTP cache before this card ever mounts. When React renders this
// component the <img src> is a cache hit — the browser does not issue a
// network request. It decodes the bytes already in memory and paints in
// a single frame.
//
// SmartImage handles the two possible states:
//
//   CACHE HIT  → useLayoutEffect fires synchronously after mount, detects
//                img.complete === true, sets revealed = true before the
//                browser even does its first paint. The image is visible
//                in frame 1. Zero transition, zero flicker.
//
//   CACHE MISS → The image starts downloading (e.g. very first load, or
//                user scrolled faster than the preloader). A dark shimmer
//                skeleton fills the slot. When onLoad fires, a 160ms
//                opacity fade-in reveals the image smoothly. No jump,
//                no layout shift, no broken-image icon.
//
// Key rules that guarantee cache coherence with the PostTab preloader:
//   • loading="eager"     — never delay a request the preloader has primed
//   • fetchPriority based on feed position — first card gets "high"
//   • buildImageUrl Strategy 2 URL = PostTab buildPreloadImgUrl URL
//     (same cld · w · q · f · c · id → guaranteed HTTP cache hit)
//
// Videos use a proximity-aware preload attribute:
//   in-viewport + active  → preload="auto"   (buffer the stream)
//   adjacent carousel     → preload="metadata"
//   outside viewport      → preload="none"   (PostTab VideoPreloadRunway
//                            already fetched metadata before card mounted)
//
// Everything else — video player, follow, like, double-tap love burst,
// lightbox, action menus, edit/share modals — is preserved from v4.
// ════════════════════════════════════════════════════════════════════════════

import React, {
  useState, useRef, useEffect, useLayoutEffect, useCallback,
} from "react";
import ReactDOM from "react-dom";
import {
  VolumeX, Volume2, Play, Pause,
  ChevronLeft, ChevronRight, X,
  UserPlus, UserCheck, MoreVertical,
} from "lucide-react";
import ProfilePreview     from "../Shared/ProfilePreview";
import ReactionPanel      from "../Shared/ReactionPanel";
import ActionMenu         from "../Shared/ActionMenu";
import ParsedText         from "../Shared/ParsedText";
import EditPostModal      from "../Modals/EditPostModal";
import ShareModal         from "../Modals/ShareModal";
import CardPostDisplay    from "../MediaUploader/CardPostDisplay";
import mediaUrlService    from "../../services/shared/mediaUrlService";
import postService        from "../../services/home/postService";
import FullScreenPostView from "./FullScreenPostView";
import followService      from "../../services/social/followService";

// ─── Connection-quality profile (MUST match PostTab.jsx exactly) ──────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData      || false;

function getQualityProfile() {
  if (_save || _ect === "slow-2g" || _ect === "2g")
    return { quality:"auto:low",  imgFormat:"webp", imgWidth:480,  videoQ:"auto:low"  };
  if (_ect === "3g")
    return { quality:"auto:good", imgFormat:"webp", imgWidth:800,  videoQ:"auto:good" };
  return   { quality:"auto:best", imgFormat:"webp", imgWidth:1200, videoQ:"auto:best" };
}
const Q = getQualityProfile();

// ─── Cloud name ───────────────────────────────────────────────────────────────
const getCldCloud = () =>
  window.__CLD_CLOUD__ || process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "grova";

// ─── buildImageUrl — candidate array, Strategy 2 MUST match PostTab URL ──────
function buildImageUrl(id, opts = {}) {
  if (!id || typeof id !== "string" || !id.trim()) return [];
  const clean = id.trim();
  const w   = opts.width   || Q.imgWidth;
  const q   = opts.quality || Q.quality;
  const f   = opts.format  || Q.imgFormat;
  const cld = getCldCloud();
  const out = [];

  // Strategy 1: mediaUrlService
  try {
    const s1 = mediaUrlService.getImageUrl(clean, { width:w, quality:q, format:f, crop:"limit", gravity:"auto" });
    if (s1 && typeof s1 === "string" && s1.startsWith("http")) out.push(s1);
  } catch {}

  // Strategy 2: Direct Cloudinary — IDENTICAL to PostTab buildPreloadImgUrl → cache hit
  if (cld) {
    out.push(`https://res.cloudinary.com/${cld}/image/upload/w_${w},q_${q},f_${f},c_limit/${clean}`);
    out.push(`https://res.cloudinary.com/${cld}/image/upload/${clean}`);
  }

  // Strategy 3: id already a full URL
  if (clean.startsWith("http")) out.push(clean);

  // Strategy 4: Supabase storage
  const supa = process.env.REACT_APP_SUPABASE_URL;
  if (supa && !clean.startsWith("http"))
    out.push(`${supa}/storage/v1/object/public/posts/${clean}`);

  return [...new Set(out)];
}

// ─── buildVideoUrl ────────────────────────────────────────────────────────────
function buildVideoUrl(id) {
  if (!id || typeof id !== "string" || !id.trim()) return [];
  const clean = id.trim();
  const q   = Q.videoQ;
  const cld = getCldCloud();
  const out = [];

  try {
    const raw = mediaUrlService.getVideoUrl(clean, { quality:q, format:"mp4" });
    if (raw && typeof raw === "string" && raw.startsWith("http")) {
      const qi   = raw.indexOf("?");
      const base = qi >= 0 ? raw.slice(0, qi) : raw;
      const qs   = qi >= 0 ? raw.slice(qi)    : "";
      out.push(base.replace(/\.mp4$/i, "") + ".mp4" + qs);
    }
  } catch {}

  if (cld) {
    out.push(`https://res.cloudinary.com/${cld}/video/upload/q_${q},f_mp4/${clean}.mp4`);
    out.push(`https://res.cloudinary.com/${cld}/video/upload/${clean}.mp4`);
  }
  if (clean.startsWith("http")) out.push(clean);

  return [...new Set(out)];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const relTime = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const dy = Math.floor(h / 24); if (dy < 7) return `${dy}d`;
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric" });
};

// ─── Global video state ───────────────────────────────────────────────────────
export const GlobalVideoState = {
  globalPlayState: false, globalMuteState: true, listeners: new Set(),
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },
  notify() { this.listeners.forEach(cb => cb()); },
  setGlobalPlayState(v) { this.globalPlayState = v; sessionStorage.setItem("gv_play", v); this.notify(); },
  getGlobalPlayState() { const s = sessionStorage.getItem("gv_play"); return s === null ? false : s === "true"; },
  setGlobalMuteState(v) { this.globalMuteState = v; sessionStorage.setItem("gv_mute", v); this.notify(); },
  getGlobalMuteState() { const s = sessionStorage.getItem("gv_mute"); return s === null ? true : s === "true"; },
  init() { this.globalPlayState = this.getGlobalPlayState(); this.globalMuteState = this.getGlobalMuteState(); },
};
GlobalVideoState.init();

// ─── Carousel prefetch (preload sibling images when card mounts) ──────────────
const _pf = new Set();
function prefetchImage(url) {
  if (!url || _pf.has(url)) return;
  _pf.add(url);
  const img = new Image();
  img.fetchPriority = "low";
  img.src = url;
}

// ─── Double-tap ───────────────────────────────────────────────────────────────
function useDoubleTap(cb, delay = 350) {
  const last = useRef(0);
  return useCallback((e) => {
    const now = Date.now();
    const t   = e.touches?.[0] || e.changedTouches?.[0];
    const x   = t?.clientX ?? e.clientX;
    const y   = t?.clientY ?? e.clientY;
    if (now - last.current < delay) { cb({ x, y }); last.current = 0; }
    else last.current = now;
  }, [cb, delay]);
}

// ─── Love burst ───────────────────────────────────────────────────────────────
const LoveBurst = ({ x, y, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 900); return () => clearTimeout(t); }, [onDone]);
  return ReactDOM.createPortal(
    <div style={{ position:"fixed", left:x, top:y, zIndex:99999, pointerEvents:"none", transform:"translate(-50%,-50%)" }}>
      <div className="gvp-lv-big">❤️</div>
      {["❤️","❤️","💖","❤️","💖","❤️"].map((h, i) => (
        <div key={i} className="gvp-lv-sat" style={{ "--angle":`${[270,315,0,45,90,225][i]}deg` }}>{h}</div>
      ))}
    </div>,
    document.body,
  );
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const ImageLightbox = ({ imageUrl, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", h); };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="gvp-lightbox-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gvp-lightbox-content">
        <button className="gvp-lightbox-close" onClick={onClose}><X size={20} /></button>
        <img src={imageUrl} alt="" className="gvp-lightbox-img" />
      </div>
    </div>,
    document.body,
  );
};

// ─── Category colours ─────────────────────────────────────────────────────────
const CAT_COLORS = {
  tech:          { bg:"rgba(132,204,22,.13)", border:"rgba(132,204,22,.32)", dot:"#84cc16", text:"#a3e635" },
  technology:    { bg:"rgba(132,204,22,.13)", border:"rgba(132,204,22,.32)", dot:"#84cc16", text:"#a3e635" },
  general:       { bg:"rgba(132,204,22,.13)", border:"rgba(132,204,22,.32)", dot:"#84cc16", text:"#a3e635" },
  entertainment: { bg:"rgba(132,204,22,.13)", border:"rgba(132,204,22,.32)", dot:"#84cc16", text:"#a3e635" },
  music:         { bg:"rgba(168,85,247,.13)",  border:"rgba(168,85,247,.32)",  dot:"#a855f7", text:"#c084fc" },
  sports:        { bg:"rgba(249,115,22,.13)",  border:"rgba(249,115,22,.32)",  dot:"#f97316", text:"#fb923c" },
  gaming:        { bg:"rgba(59,130,246,.13)",  border:"rgba(59,130,246,.32)",  dot:"#3b82f6", text:"#60a5fa" },
  news:          { bg:"rgba(236,72,153,.13)",  border:"rgba(236,72,153,.32)",  dot:"#ec4899", text:"#f472b6" },
  comedy:        { bg:"rgba(234,179,8,.13)",   border:"rgba(234,179,8,.32)",   dot:"#eab308", text:"#fbbf24" },
  education:     { bg:"rgba(20,184,166,.13)",  border:"rgba(20,184,166,.32)",  dot:"#14b8a6", text:"#2dd4bf" },
  lifestyle:     { bg:"rgba(236,72,153,.13)",  border:"rgba(236,72,153,.32)",  dot:"#ec4899", text:"#f472b6" },
};
const getCatStyle = (cat) => CAT_COLORS[(cat || "").toLowerCase()] || CAT_COLORS.tech;

// ════════════════════════════════════════════════════════════════════════════════
// SmartImage — zero-wait image display
// ════════════════════════════════════════════════════════════════════════════════
const SmartImage = ({ candidates = [], alt = "", className, style, fetchPriority, onLoad, onClick }) => {
  const [idx,      setIdx]      = useState(0);
  const [failed,   setFailed]   = useState(false);
  const [revealed, setRevealed] = useState(false);
  const imgRef = useRef(null);

  // Reset when candidates array changes (new post or active carousel slide)
  useEffect(() => {
    setIdx(0);
    setFailed(false);
    setRevealed(false);
  }, [candidates.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // CACHE HIT — detect synchronously after mount.
  // If PostTab's preloader fetched this URL, img.complete = true immediately.
  // setRevealed(true) before the browser's first paint → zero transition delay.
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setRevealed(true);
  }, [idx]);

  if (!candidates.length || failed) {
    return (
      <div className="gvp-err" style={style}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }

  return (
    <>
      {/* Dark shimmer skeleton — visible only during a cache miss */}
      {!revealed && <div className="gvp-img-skeleton" style={style} aria-hidden="true" />}

      <img
        ref={imgRef}
        src={candidates[idx]}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity:    revealed ? 1 : 0,
          // Skip transition on cache hit (revealed from useLayoutEffect) so
          // the image is visible instantly, not after a 160ms delay.
          transition: revealed ? "none" : "opacity 0.16s ease",
        }}
        loading="eager"                        // never delay a pre-warmed request
        fetchPriority={fetchPriority || "auto"}
        decoding="async"                       // keep compositor thread free
        onLoad={() => { setRevealed(true); onLoad?.(); }}
        onError={() => {
          if (idx < candidates.length - 1) setIdx(i => i + 1);
          else setFailed(true);
        }}
        onClick={onClick}
      />
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// useVideoPlayer hook — unchanged from v4
// ════════════════════════════════════════════════════════════════════════════════
function useVideoPlayer(videoRef, globalMuted, inViewport, globalPlayState) {
  const [playing,          setPlaying]          = useState(false);
  const [isLoading,        setIsLoading]        = useState(true);
  const [videoError,       setVideoError]       = useState(false);
  const [currentTime,      setCurrentTime]      = useState(0);
  const [duration,         setDuration]         = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [showControls,     setShowControls]     = useState(false);
  const [aspectRatio,      setAspectRatio]      = useState(9 / 16);
  const controlsTimer = useRef(null);
  const isTouching    = useRef(false);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (!isTouching.current) setShowControls(false);
    }, 3000);
  }, []);

  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    const next = !playing;
    GlobalVideoState.setGlobalPlayState(next);
    if (next) {
      videoRef.current.play().catch(() => setVideoError(true));
      setPlaying(true); resetControlsTimer();
    } else {
      videoRef.current.pause(); setPlaying(false);
      setShowControls(true); clearTimeout(controlsTimer.current);
    }
  }, [playing, videoRef, resetControlsTimer]);

  const handleLoadStart      = () => setIsLoading(true);
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration); setIsLoading(false); setVideoError(false);
    const { videoWidth: w, videoHeight: h } = videoRef.current;
    if (w && h) setAspectRatio(w / h);
  };
  const handleTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const handleProgress   = () => {
    const v = videoRef.current;
    if (v?.buffered.length > 0 && v.duration > 0)
      setBufferedProgress((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
  };
  const handleError = () => { setVideoError(true); setIsLoading(false); };
  const handleEnded = () => setPlaying(false);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = globalMuted; }, [globalMuted, videoRef]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    if (inViewport && globalPlayState) {
      v.muted = GlobalVideoState.globalMuteState;
      v.play().catch(() => {}); setPlaying(true);
    } else if (!inViewport && !v.paused) {
      v.pause(); setPlaying(false);
    }
  }, [inViewport, globalPlayState, videoRef]);

  const progressBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleProgressClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
    setCurrentTime(videoRef.current.currentTime);
  };
  const handleProgressMouseDown = (e) => { e.stopPropagation(); setIsDragging(true); handleProgressClick(e); };

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging || !videoRef.current || !progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = pct * duration; setCurrentTime(videoRef.current.currentTime);
    };
    const onUp = () => { if (isDragging) setIsDragging(false); };
    if (isDragging) { document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); }
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [isDragging, duration, videoRef]);

  useEffect(() => () => clearTimeout(controlsTimer.current), []);

  const formatTime   = (s) => { if (!s || isNaN(s)) return "0:00"; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`; };
  const playedPct    = duration > 0 ? (currentTime / duration) * 100 : 0;
  const getObjectFit = () => (aspectRatio > 9 / 16 ? "cover" : "contain");

  const touchHandlers = {
    onTouchStart: () => { isTouching.current = true;  resetControlsTimer(); },
    onTouchEnd:   () => { isTouching.current = false; },
  };
  const mouseHandlers = {
    onMouseEnter: () => resetControlsTimer(),
    onMouseMove:  () => resetControlsTimer(),
    onMouseLeave: () => {
      isTouching.current = false;
      clearTimeout(controlsTimer.current);
      setShowControls(false);
    },
  };

  return {
    playing, isLoading, videoError, currentTime, duration, bufferedProgress,
    showControls, aspectRatio, playedPct, progressBarRef, formatTime, getObjectFit,
    togglePlay, handleLoadStart, handleLoadedMetadata, handleTimeUpdate,
    handleProgress, handleError, handleEnded, handleProgressClick,
    handleProgressMouseDown, touchHandlers, mouseHandlers,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ReelStyleVideo — proximity-aware preload attribute
// ════════════════════════════════════════════════════════════════════════════════
const ReelStyleVideo = ({ item, idx, isActive, inVP, muted, onMuteToggle }) => {
  const videoRef  = useRef(null);
  const [vidIdx,  setVidIdx]  = useState(0);
  const [vidFail, setVidFail] = useState(false);

  const {
    playing, isLoading, videoError, duration, bufferedProgress, showControls,
    playedPct, progressBarRef, formatTime, getObjectFit, togglePlay,
    handleLoadStart, handleLoadedMetadata, handleTimeUpdate, handleProgress,
    handleError: hookError, handleEnded, handleProgressClick,
    handleProgressMouseDown, touchHandlers, mouseHandlers, currentTime,
  } = useVideoPlayer(videoRef, muted, inVP && isActive, GlobalVideoState.getGlobalPlayState());

  const handleVideoError = useCallback(() => {
    if (vidIdx < item.candidates.length - 1) setVidIdx(i => i + 1);
    else { setVidFail(true); hookError(); }
  }, [vidIdx, item.candidates.length, hookError]);

  // Proximity-aware preload:
  //   in viewport + active  → buffer (preload="auto")
  //   adjacent carousel     → metadata only
  //   outside viewport      → none  (VideoPreloadRunway already got metadata)
  const preload  = !inVP ? "none" : isActive ? "auto" : idx === 1 ? "metadata" : "none";
  const src      = item.candidates[vidIdx];

  return (
    <div
      className="gvp-rv-wrap"
      {...touchHandlers}
      {...mouseHandlers}
      onClick={(e) => {
        if (e.target.closest(".gvp-rv-controls-top") ||
            e.target.closest(".gvp-rv-progress-wrap") ||
            e.target.closest(".gvp-rv-mute-btn")) return;
        togglePlay(e);
      }}
    >
      {!vidFail && src ? (
        <>
          <video
            ref={videoRef}
            className="gvp-rv-video"
            src={src}
            poster={item.poster || undefined}
            loop playsInline muted={muted} preload={preload}
            style={{ objectFit: getObjectFit() }}
            onLoadStart={handleLoadStart}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onError={handleVideoError}
            onEnded={handleEnded}
          />
          {isLoading && (
            <div className="gvp-rv-loading" aria-hidden="true">
              <div className="gvp-rv-spinner" />
            </div>
          )}
        </>
      ) : (
        <div className="gvp-rv-placeholder">
          <div className="gvp-rv-err-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="gvp-rv-err-msg">Video unavailable</p>
        </div>
      )}

      <div className="gvp-rv-cinematic" />

      {!vidFail && (
        <div className={`gvp-rv-controls-top${showControls ? " visible" : ""}`}>
          <button className="gvp-rv-icon-btn" type="button"
            onClick={(e) => { e.stopPropagation(); onMuteToggle(e); }} aria-label="Toggle mute">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}
      {!vidFail && (
        <div className={`gvp-rv-play-area${showControls ? " visible" : ""}`} onClick={togglePlay}>
          <div className="gvp-rv-play-ring">
            {playing ? <Pause size={26} /> : <Play size={26} />}
          </div>
        </div>
      )}
      {!vidFail && (
        <div className="gvp-rv-bottom-bar">
          <div className={`gvp-rv-progress-wrap${showControls ? " visible" : ""}`}>
            <div ref={progressBarRef} className="gvp-rv-progress-track"
              onClick={handleProgressClick} onMouseDown={handleProgressMouseDown}>
              <div className="gvp-rv-progress-buffered" style={{ width:`${bufferedProgress}%` }} />
              <div className="gvp-rv-progress-played"   style={{ width:`${playedPct}%` }}>
                <div className="gvp-rv-progress-thumb" />
              </div>
            </div>
            {duration > 0 && (
              <span className="gvp-rv-time-badge">
                {formatTime(currentTime)}<span className="gvp-rv-time-sep">/</span>{formatTime(duration)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PostCard
// ════════════════════════════════════════════════════════════════════════════════
const PostCard = ({
  post: initialPost,
  currentUser,
  onPostUpdate,
  onPostDelete,
  feedIndex = 99,
}) => {
  const [post,       setPost]       = useState(initialPost);
  const [visible,    setVisible]    = useState(true);
  const [active,     setActive]     = useState(0);
  const [muted,      setMuted]      = useState(GlobalVideoState.getGlobalMuteState());
  const [txStart,    setTxStart]    = useState(null);
  const [txEnd,      setTxEnd]      = useState(null);
  const [capExp,     setCapExp]     = useState(false);
  const [lightbox,   setLightbox]   = useState(null);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [menuPos,    setMenuPos]    = useState({ x:0, y:0 });
  const [fullPost,   setFullPost]   = useState(false);
  const [editModal,  setEditModal]  = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [followPop,  setFollowPop]  = useState(false);
  const [txtOver,    setTxtOver]    = useState(false);
  const [capClamp,   setCapClamp]   = useState(false);
  const [inVP,       setInVP]       = useState(feedIndex === 0);
  const [burst,      setBurst]      = useState(null);
  const [isHovered,  setIsHovered]  = useState(false);

  const contRef = useRef(null);
  const txtRef  = useRef(null);
  const capRef  = useRef(null);
  const delRef  = useRef(null);

  useEffect(() => { if (visible) setPost(initialPost); }, [initialPost]); // eslint-disable-line

  const isOwn = post.user_id === currentUser?.id
             || post.user_id === currentUser?.uid
             || post.user_id === currentUser?.userId;

  const isTxt = Boolean(post.is_text_card === true || post.is_text_card === "true" || post.is_text_card === 1);

  const profile = {
    id: post.user_id, userId: post.user_id, user_id: post.user_id,
    author:   post.profiles?.full_name || post.author   || "Unknown",
    username: post.profiles?.username  || post.username || "unknown",
    avatar:   post.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(post.profiles.avatar_id, 200)
      : post.avatar || null,
    verified: post.profiles?.verified || post.verified || false,
  };

  useEffect(() => {
    if (!currentUser?.id || isOwn) return;
    followService.isFollowing(currentUser.id, post.user_id).then(setFollowing).catch(() => {});
  }, [post.user_id, currentUser?.id, isOwn]); // eslint-disable-line

  const toggleFollow = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !following;
    setFollowing(next);
    if (next) { setFollowPop(true); setTimeout(() => setFollowPop(false), 600); }
    const result = next
      ? await followService.followUser(currentUser.id, post.user_id)
      : await followService.unfollowUser(currentUser.id, post.user_id);
    if (result?.success === false && !result?.alreadyFollowing) setFollowing(!next);
  };

  // Build media items
  const items = (() => {
    if (isTxt) return [];
    const out = [];
    (post.image_ids || []).forEach((id, i) => {
      if (!id?.trim()) return;
      const m          = post.image_metadata?.[i] || {};
      const candidates = buildImageUrl(id, { width:Q.imgWidth, quality:Q.quality, format:Q.imgFormat });
      if (!candidates.length) return;
      const fullCandidates = buildImageUrl(id, { width:1920, quality:"auto:best", format:"webp" });
      out.push({ type:"image", id, index:i, candidates, fullCandidates, w:m.width||null, h:m.height||null });
    });
    (post.video_ids || []).forEach((id, i) => {
      if (!id?.trim()) return;
      const m          = post.video_metadata?.[i] || {};
      const candidates = buildVideoUrl(id);
      if (!candidates.length) return;
      out.push({ type:"video", id, index:i, candidates, poster:m.thumbnail_url||null, duration:m.duration, w:m.width||null, h:m.height||null });
    });
    return out;
  })();

  const multi    = items.length > 1;
  const hasMedia = items.length > 0;
  const catStyle = getCatStyle(post.category);

  // Prefetch sibling images in carousel on mount
  useEffect(() => {
    items.forEach((item, i) => {
      if (item.type !== "image" || i === 0) return;
      const url = item.candidates[1]; // Strategy 2 = direct Cloudinary
      if (url) prefetchImage(url);
    });
  }, []); // eslint-disable-line

  // Prefetch next slides on navigation
  useEffect(() => {
    [1, 2, 3].forEach(off => {
      const nxt = items[active + off];
      if (nxt?.type === "image" && nxt.candidates[1]) prefetchImage(nxt.candidates[1]);
    });
  }, [active]); // eslint-disable-line

  // Text overflow
  useEffect(() => {
    if (!txtRef.current || !post.content || hasMedia || isTxt) return;
    const measure = () => {
      const el = txtRef.current;
      if (el) setTxtOver(el.scrollHeight > window.innerHeight * 0.4);
    };
    const ro = new ResizeObserver(measure); ro.observe(txtRef.current); measure();
    return () => ro.disconnect();
  }, [post.content, hasMedia, isTxt]);

  // Caption clamp
  useEffect(() => {
    if (!capRef.current || !post.content || !hasMedia) return;
    const measure = () => {
      const el = capRef.current; if (!el) return;
      const lh = parseFloat(window.getComputedStyle(el).lineHeight) || 22;
      setCapClamp(el.scrollHeight > lh * 2 + 6);
    };
    const ro = new ResizeObserver(measure); ro.observe(capRef.current); measure();
    return () => ro.disconnect();
  }, [post.content, hasMedia]);

  // Global mute sync
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => setMuted(GlobalVideoState.globalMuteState));
    return unsub;
  }, []);

  // Viewport detection for video autoplay
  useEffect(() => {
    if (!contRef.current) return;
    const obs = new IntersectionObserver(([e]) => setInVP(e.isIntersecting), { threshold:0.4 });
    obs.observe(contRef.current);
    return () => { if (contRef.current) obs.unobserve(contRef.current); }; // eslint-disable-line
  }, []);

  const fireBurst = useCallback(({ x, y }) => {
    setBurst({ x, y, id: Date.now() });
    if (currentUser?.id) window.dispatchEvent(new CustomEvent("grova:quicklike", {
      detail: { contentId:post.id, contentType:"post", userId:currentUser.id },
    }));
  }, [post.id, currentUser?.id]);

  const dtap = useDoubleTap(fireBurst);

  const handleMuteToggle = (e) => {
    e?.stopPropagation();
    const next = !muted;
    setMuted(next);
    GlobalVideoState.setGlobalMuteState(next);
  };

  if (!visible) return null;

  const onTS = (e) => { setTxEnd(null); setTxStart(e.targetTouches[0].clientX); };
  const onTM = (e) => setTxEnd(e.targetTouches[0].clientX);
  const onTE = () => {
    if (!txStart || !txEnd) return;
    const d = txStart - txEnd;
    if (d > 50 && active < items.length - 1) setActive(active + 1);
    if (d < -50 && active > 0)              setActive(active - 1);
  };

  const openMenu = (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x:r.right, y:r.bottom }); setMenuOpen(true);
  };

  const doUpdate = (updated) => {
    setPost(p => ({ ...p, ...updated })); setEditModal(false);
    if (onPostUpdate) onPostUpdate(updated);
  };

  const doDelete = async (id) => {
    delRef.current = post; setVisible(false); if (onPostDelete) onPostDelete(id);
    try { await postService.deletePost(id); }
    catch { setVisible(true); delRef.current = null; throw new Error("Delete failed"); }
  };

  // fetchPriority based on feed position
  const imgPriority = feedIndex === 0 ? "high" : feedIndex <= 3 ? "high" : "auto";

  return (
    <>
      <div
        className={`gvp-card${isHovered ? " gvp-hovered" : ""}`}
        ref={contRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* ── HEADER ── */}
        <div className="gvp-header">
          <ProfilePreview profile={profile} currentUser={currentUser} size="small" />
          {post.created_at && <span className="gvp-ts">{relTime(post.created_at)}</span>}
          <div className="gvp-hsp" />
          {!isOwn && currentUser?.id && (
            <button
              className={`gvp-follow-btn${following ? " following" : ""}${followPop ? " pop" : ""}`}
              onClick={toggleFollow}
            >
              {following
                ? <><UserCheck size={12}/><span>Following</span></>
                : <><UserPlus  size={12}/><span>Follow</span></>}
            </button>
          )}
          <button className="gvp-icon-btn" onClick={openMenu} aria-label="More">
            <MoreVertical size={16} />
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="gvp-body" onTouchEnd={dtap} onDoubleClick={dtap}>
          {isTxt ? (
            <>
              <div className="gvp-tcs"><CardPostDisplay post={post} /></div>
              {post.card_caption && (
                <div className="gvp-text" style={{ padding:"6px 14px 0" }}>
                  <ParsedText text={post.card_caption} />
                </div>
              )}
            </>
          ) : !hasMedia ? (
            <>
              <div
                ref={txtRef}
                className={`gvp-text gvp-text-only${!capExp && txtOver ? " gvp-fade" : ""}`}
                style={!capExp && txtOver ? { maxHeight:"40vh", overflow:"hidden" } : undefined}
              >
                <ParsedText text={post.content} />
              </div>
              {txtOver && !capExp && (
                <button className="gvp-expand" onClick={() => setFullPost(true)}>Read more</button>
              )}
            </>
          ) : (
            <>
              <div
                className="gvp-media-wrap"
                onTouchStart={onTS}
                onTouchMove={onTM}
                onTouchEnd={(e) => { onTE(); dtap(e); }}
              >
                <div className="gvp-cinematic" />

                {post.category && (
                  <div className="gvp-media-cat" style={{ background:catStyle.bg, borderColor:catStyle.border }}>
                    <span className="gvp-media-cat-dot" style={{ background:catStyle.dot }} />
                    <span style={{ color:catStyle.text }}>{post.category.toUpperCase()}</span>
                  </div>
                )}

                {items.map((item, idx) => {
                  const isAct = idx === active;
                  return (
                    <div key={`${item.type}-${item.id}-${idx}`} className={`gvp-slide${isAct ? " show" : ""}`}>
                      {item.type === "image" ? (
                        <div className="gvp-img-box">
                          <SmartImage
                            candidates={item.candidates}
                            alt=""
                            className="gvp-img"
                            fetchPriority={imgPriority}
                            onClick={() => item.fullCandidates?.[0] && setLightbox(item.fullCandidates[0])}
                          />
                        </div>
                      ) : (
                        <ReelStyleVideo
                          item={item} idx={idx} isActive={isAct}
                          inVP={inVP} muted={muted} onMuteToggle={handleMuteToggle}
                        />
                      )}
                    </div>
                  );
                })}

                {multi && (
                  <>
                    <div className="gvp-dots">
                      {items.map((_, i) => (
                        <button key={i} className={`gvp-dot${i === active ? " on" : ""}`} onClick={() => setActive(i)} />
                      ))}
                    </div>
                    {active > 0 && (
                      <button className="gvp-nav gvp-nav-l" onClick={() => setActive(active - 1)}>
                        <ChevronLeft size={22}/>
                      </button>
                    )}
                    {active < items.length - 1 && (
                      <button className="gvp-nav gvp-nav-r" onClick={() => setActive(active + 1)}>
                        <ChevronRight size={22}/>
                      </button>
                    )}
                    <div className="gvp-count">{active + 1} / {items.length}</div>
                  </>
                )}
              </div>

              {post.content && (
                <>
                  <div ref={capRef} className={`gvp-text gvp-cap${!capExp && capClamp ? " gvp-cap-clamp" : ""}`}>
                    <ParsedText text={post.content} />
                  </div>
                  {capClamp && !capExp && (
                    <button className="gvp-expand gvp-expand-inline" onClick={() => setCapExp(true)}>…more</button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="gvp-footer">
          <ReactionPanel content={{ ...post, type:"post" }} currentUser={currentUser} layout="horizontal" />
        </div>
      </div>

      {/* ── PORTALS ── */}
      {burst && <LoveBurst key={burst.id} x={burst.x} y={burst.y} onDone={() => setBurst(null)} />}

      {menuOpen && (
        <ActionMenu
          position={menuPos} isOwnPost={isOwn} content={post} contentType="post"
          currentUser={currentUser} onClose={() => setMenuOpen(false)}
          onEdit={() => { setMenuOpen(false); setEditModal(true); }}
          onShare={() => { setMenuOpen(false); setShareModal(true); }}
          onDelete={doDelete} onSave={() => {}} onReport={() => {}}
        />
      )}

      {editModal && (
        <EditPostModal post={post} currentUser={currentUser}
          onClose={() => setEditModal(false)} onUpdate={doUpdate} />
      )}

      {shareModal && ReactDOM.createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:9001 }}>
          <ShareModal content={post} contentType="post" currentUser={currentUser}
            onClose={() => setShareModal(false)} />
        </div>,
        document.body,
      )}

      {lightbox && <ImageLightbox imageUrl={lightbox} onClose={() => setLightbox(null)} />}
      {fullPost  && <FullScreenPostView post={post} profile={profile} onClose={() => setFullPost(false)} currentUser={currentUser} />}

      <style>{CSS}</style>
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// CSS — gvp-* namespace, complete
// ════════════════════════════════════════════════════════════════════════════════
const CSS = `
/* ── Love burst ── */
@keyframes gvpLvBig{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}40%{opacity:1;transform:translate(-50%,-50%) scale(1.4)}70%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
@keyframes gvpLvSat{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(0) scale(.3)}30%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(-55px) scale(.9)}}
.gvp-lv-big{position:absolute;font-size:72px;line-height:1;animation:gvpLvBig .85s cubic-bezier(.34,1.2,.64,1) both;filter:drop-shadow(0 4px 16px rgba(239,68,68,.7));pointer-events:none;user-select:none;transform:translate(-50%,-50%);}
.gvp-lv-sat{position:absolute;font-size:26px;line-height:1;animation:gvpLvSat .8s ease-out both;pointer-events:none;user-select:none;transform:translate(-50%,-50%);}

/* ── Card shell ── */
.gvp-card{position:relative;background:#080808;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);transition:transform .28s cubic-bezier(.22,1,.36,1),border-color .28s ease,box-shadow .28s ease;box-shadow:0 8px 32px rgba(0,0,0,.45);margin-bottom:10px;contain:layout style;}
@keyframes gvpShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
.gvp-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 0%,rgba(132,204,22,0) 15%,rgba(163,230,53,.95) 40%,#d4f576 50%,rgba(163,230,53,.95) 60%,rgba(132,204,22,0) 85%,transparent 100%);background-size:200% 100%;opacity:0;z-index:20;pointer-events:none;transition:opacity .3s ease;}
.gvp-card.gvp-hovered::before{opacity:1;animation:gvpShimmer 1.6s ease-in-out infinite;}
.gvp-card::after{content:'';position:absolute;inset:0;border-radius:20px;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(132,204,22,0);transition:box-shadow .3s ease;}
.gvp-card.gvp-hovered::after{box-shadow:inset 0 0 0 1px rgba(132,204,22,0.18);}
.gvp-card.gvp-hovered{transform:translateY(-2px) scale(1.003);border-color:rgba(132,204,22,0.18);box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 28px rgba(132,204,22,0.06);}

/* ── Header ── */
.gvp-header{display:flex;align-items:center;gap:6px;padding:12px 12px 8px;}
.gvp-ts{font-size:11px;color:rgba(255,255,255,0.28);font-weight:500;white-space:nowrap;flex-shrink:0;}
.gvp-hsp{flex:1;min-width:0;}
.gvp-follow-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;height:30px;font-size:11.5px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;font-family:inherit;letter-spacing:.02em;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.13);color:rgba(255,255,255,.8);transition:background .2s,border-color .2s,color .2s,transform .15s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
.gvp-follow-btn:hover{background:rgba(132,204,22,.15);border-color:rgba(132,204,22,.45);color:#a3e635;transform:scale(1.04);}
.gvp-follow-btn.following{background:rgba(132,204,22,.12);border-color:rgba(132,204,22,.35);color:#a3e635;}
.gvp-follow-btn.following:hover{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.35);color:#f87171;}
@keyframes gvpPop{0%{transform:scale(1)}40%{transform:scale(1.18)}70%{transform:scale(.94)}100%{transform:scale(1)}}
.gvp-follow-btn.pop{animation:gvpPop .5s cubic-bezier(.22,1,.36,1);}
.gvp-icon-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.5);cursor:pointer;transition:background .2s,border-color .2s,transform .15s,color .2s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);flex-shrink:0;}
.gvp-icon-btn:hover{background:rgba(132,204,22,.12);border-color:rgba(132,204,22,.3);color:#a3e635;transform:scale(1.08);}
.gvp-icon-btn:active{transform:scale(.95);}

/* ── Body ── */
.gvp-body{padding-top:0;margin-top:0;}
.gvp-text{padding:0 14px;color:#eeeeee;font-size:14px;line-height:1.7;margin-top:4px;margin-bottom:0;word-break:break-word;white-space:pre-wrap;}
.gvp-text-only.gvp-fade{position:relative;}
.gvp-text-only.gvp-fade::after{content:"";position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(to bottom,transparent,#080808);pointer-events:none;}
.gvp-cap{margin:6px 0 2px;padding:0 14px;}
.gvp-cap-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.gvp-expand{display:inline-block;background:none;border:none;padding:2px 14px 0;color:#6b7280;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:color .15s;margin-bottom:2px;line-height:1.6;}
.gvp-expand:hover{color:#84cc16;}
.gvp-expand-inline{padding:1px 14px 3px;}

/* ── Media wrapper ── */
.gvp-media-wrap{position:relative;margin-top:4px;overflow:hidden;}
.gvp-slide{display:none;width:100%;}
.gvp-slide.show{display:block;}
.gvp-cinematic{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(to bottom,rgba(0,0,0,.3) 0%,transparent 16%,transparent 60%,rgba(0,0,0,.42) 78%,rgba(0,0,0,.8) 100%);}
.gvp-media-cat{position:absolute;top:10px;left:10px;z-index:4;display:inline-flex;align-items:center;gap:5px;padding:4px 10px 4px 8px;border-radius:999px;border:1px solid;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:none;}
.gvp-media-cat-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.gvp-media-cat span:last-child{font-size:10px;font-weight:800;letter-spacing:.07em;line-height:1;}

/* ── Image box + skeleton ── */
.gvp-img-box{width:100%;background:#0a0a0a;line-height:0;overflow:hidden;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;}
.gvp-img{display:block;width:100%;height:auto;max-height:75vh;object-fit:contain;background:transparent;cursor:zoom-in;position:relative;z-index:1;}
@keyframes gvpSkPulse{0%,100%{opacity:.45}50%{opacity:.15}}
.gvp-img-skeleton{position:absolute;inset:0;background:linear-gradient(135deg,#111 0%,#181818 50%,#111 100%);background-size:200% 200%;animation:gvpSkPulse 1.4s ease-in-out infinite;border-radius:inherit;z-index:0;}
.gvp-err{min-height:140px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.02);color:rgba(255,255,255,.28);font-size:13px;gap:8px;border-radius:inherit;}

/* ── Carousel controls ── */
.gvp-dots{display:flex;justify-content:center;gap:5px;padding:7px 0 5px;}
.gvp-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.25);border:none;cursor:pointer;padding:0;transition:background .15s,transform .15s,width .2s,border-radius .2s;}
.gvp-dot.on{background:#84cc16;transform:scale(1.2);width:18px;border-radius:3px;}
.gvp-nav{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;transition:background .15s;}
.gvp-nav:hover{background:rgba(0,0,0,.8);}
.gvp-nav-l{left:10px;}.gvp-nav-r{right:10px;}
.gvp-count{position:absolute;top:10px;right:10px;z-index:5;background:rgba(0,0,0,.65);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;font-variant-numeric:tabular-nums;}

/* ── Footer ── */
.gvp-footer{display:flex;align-items:center;padding:4px 6px 8px;background:#080808;border-top:1px solid rgba(255,255,255,.04);}

/* ── Lightbox ── */
.gvp-lightbox-overlay{position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:9500;display:flex;align-items:center;justify-content:center;}
.gvp-lightbox-content{position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center;}
.gvp-lightbox-close{position:absolute;top:-44px;right:0;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.gvp-lightbox-close:hover{background:rgba(255,255,255,.2);}
.gvp-lightbox-img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;}

/* ══ Video (gvp-rv-*) ══ */
.gvp-rv-wrap{position:relative!important;width:100%!important;aspect-ratio:9/14!important;height:70vh!important;background:#000!important;cursor:pointer!important;overflow:hidden!important;display:block!important;}
.gvp-rv-video{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;display:block!important;background:#000!important;}
.gvp-rv-cinematic{position:absolute!important;inset:0!important;background:linear-gradient(to bottom,rgba(0,0,0,.35) 0%,transparent 18%,transparent 55%,rgba(0,0,0,.5) 78%,rgba(0,0,0,.88) 100%)!important;pointer-events:none!important;z-index:2!important;}
.gvp-rv-loading{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;z-index:10!important;}
@keyframes gvpRvSpin{to{transform:rotate(360deg)}}
.gvp-rv-spinner{width:44px!important;height:44px!important;border:3px solid rgba(132,204,22,.15)!important;border-top-color:#84cc16!important;border-radius:50%!important;animation:gvpRvSpin .9s linear infinite!important;}
.gvp-rv-placeholder{position:absolute!important;inset:0!important;background:radial-gradient(ellipse at 30% 30%,rgba(132,204,22,.08) 0%,transparent 60%),linear-gradient(135deg,#111 0%,#080808 100%)!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-direction:column!important;gap:14px!important;}
.gvp-rv-err-icon{color:rgba(255,255,255,.3);}
.gvp-rv-err-msg{color:rgba(255,255,255,.4)!important;font-size:12px!important;font-weight:500!important;letter-spacing:.05em!important;margin:0!important;}
.gvp-rv-controls-top{position:absolute!important;top:14px!important;right:14px!important;z-index:12!important;display:flex!important;gap:8px!important;opacity:0!important;transform:translateY(-4px)!important;transition:opacity .25s ease,transform .25s ease!important;pointer-events:none!important;}
.gvp-rv-controls-top.visible{opacity:1!important;transform:translateY(0)!important;pointer-events:all!important;}
.gvp-rv-icon-btn{display:flex!important;align-items:center!important;justify-content:center!important;width:36px!important;height:36px!important;border-radius:50%!important;background:rgba(0,0,0,.55)!important;border:1px solid rgba(255,255,255,.12)!important;color:rgba(255,255,255,.88)!important;cursor:pointer!important;transition:background .2s,border-color .2s,transform .15s,color .2s!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important;flex-shrink:0!important;}
.gvp-rv-icon-btn:hover{background:rgba(132,204,22,.15)!important;border-color:rgba(132,204,22,.4)!important;color:#a3e635!important;transform:scale(1.08)!important;}
.gvp-rv-play-area{position:absolute!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;z-index:11!important;opacity:0!important;transition:opacity .25s ease!important;pointer-events:none!important;}
.gvp-rv-play-area.visible{opacity:1!important;pointer-events:all!important;}
.gvp-rv-play-ring{width:64px!important;height:64px!important;border-radius:50%!important;background:rgba(0,0,0,.6)!important;border:2px solid rgba(255,255,255,.22)!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important;transition:background .2s,transform .15s,border-color .2s!important;}
.gvp-rv-play-area:hover .gvp-rv-play-ring{background:rgba(132,204,22,.2)!important;border-color:rgba(132,204,22,.5)!important;transform:scale(1.06)!important;}
.gvp-rv-bottom-bar{position:absolute!important;bottom:0!important;left:0!important;right:0!important;z-index:10!important;padding:0 12px 12px!important;display:flex!important;flex-direction:column!important;gap:10px!important;}
.gvp-rv-progress-wrap{display:flex!important;align-items:center!important;gap:10px!important;opacity:0!important;transition:opacity .25s ease!important;pointer-events:none!important;}
.gvp-rv-progress-wrap.visible{opacity:1!important;pointer-events:all!important;}
.gvp-rv-progress-track{flex:1!important;height:3px!important;background:rgba(255,255,255,.18)!important;border-radius:99px!important;cursor:pointer!important;position:relative!important;overflow:visible!important;transition:height .2s ease!important;}
.gvp-rv-progress-track:hover{height:5px!important;}
.gvp-rv-progress-buffered{position:absolute!important;top:0!important;left:0!important;height:100%!important;background:rgba(255,255,255,.28)!important;border-radius:99px!important;transition:width .3s ease!important;}
.gvp-rv-progress-played{position:absolute!important;top:0!important;left:0!important;height:100%!important;background:linear-gradient(90deg,#65a30d 0%,#a3e635 100%)!important;border-radius:99px!important;transition:width .1s linear!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;overflow:visible!important;}
.gvp-rv-progress-thumb{width:11px!important;height:11px!important;background:#fff!important;border-radius:50%!important;box-shadow:0 0 0 2px rgba(132,204,22,.5),0 2px 6px rgba(0,0,0,.4)!important;opacity:0!important;transition:opacity .2s ease!important;transform:translateX(50%)!important;flex-shrink:0!important;}
.gvp-rv-progress-track:hover .gvp-rv-progress-thumb{opacity:1!important;}
.gvp-rv-time-badge{font-size:10px!important;font-weight:700!important;color:rgba(255,255,255,.75)!important;white-space:nowrap!important;flex-shrink:0!important;font-variant-numeric:tabular-nums!important;letter-spacing:.03em!important;background:rgba(0,0,0,.5)!important;padding:2px 7px!important;border-radius:6px!important;}
.gvp-rv-time-sep{opacity:.45;margin:0 2px;}

/* ── Mobile ── */
@media(max-width:768px){
  .gvp-card{border-radius:0!important;margin-bottom:0;}
  .gvp-card.gvp-hovered{transform:none;box-shadow:none;}
  .gvp-card::before,.gvp-card::after{display:none;}
  .gvp-header{padding:8px 12px 5px;gap:4px;}
  .gvp-follow-btn span{display:none;}
  .gvp-follow-btn{padding:5px 7px;border-radius:50%;width:30px;height:30px;justify-content:center;}
  .gvp-media-wrap{width:100vw;position:relative;left:50%;transform:translateX(-50%);margin-top:4px;border-radius:0;}
  .gvp-img{max-height:80svh;cursor:default;}
  .gvp-nav{display:none;}
  .gvp-text{padding:0 12px;font-size:13.5px;}
  .gvp-cap{padding:0 12px;}
  .gvp-footer{padding:3px 4px 8px;}
  .gvp-lightbox-overlay{padding:0;}
  .gvp-lightbox-content{max-width:100vw;max-height:100vh;}
  .gvp-lightbox-img{max-width:100vw;max-height:100vh;border-radius:0;}
  .gvp-lightbox-close{top:18px;right:18px;}
  .gvp-rv-wrap{aspect-ratio:9/16!important;max-height:82svh!important;height:auto!important;}
  .gvp-rv-play-ring{width:52px!important;height:52px!important;}
  .gvp-rv-icon-btn{width:34px!important;height:34px!important;}
  .gvp-rv-time-badge{font-size:9px!important;padding:2px 5px!important;}
  .gvp-rv-bottom-bar{padding:0 10px 10px!important;}
}
`;

export default PostCard;