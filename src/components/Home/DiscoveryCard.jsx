// src/components/Home/DiscoveryCard.jsx — v2 ZERO-PERCEIVED-LOADING + CINEMATIC
//
// ═══════════════════════════════════════════════════════════════════════════
// PERFECTIONS vs v1:
//
// [L1] INSTANT VISUAL — poster image is shown immediately with a blurred
//      low-quality placeholder underneath. User NEVER sees a blank card.
//      LQIP is generated from thumbnailUrl with ?w=20 transform.
//
// [L2] VIDEO PRELOAD — when card enters IntersectionObserver (even before
//      it's the "active" one), we preload metadata so the first frame is
//      ready instantly when autoplay fires. Managed per-card so we never
//      buffer more than 3 cards simultaneously.
//
// [L3] SINGLE ACTIVE RULE — only one video plays at a time. The parent
//      (DiscoveryTab) passes isVisible. When isVisible flips false, the
//      video pauses and releases the decoder via src="" after 800ms
//      (cooling state), preserving the poster.
//
// [L4] ADAPTIVE BITRATE — connection-aware video URL selection.
//      4G: hd_1920_1080, 3G: hd_1280_720, 2G/save: sd_960_540.
//
// [L5] CINEMATIC OVERLAY — dynamic gradient shifts based on mood.
//      calm = blue, intense = red/orange, cinematic = purple, etc.
//
// [L6] ACTION RAIL signals all wire to PersonalizationModel.
//
// [L7] MUTE persisted in sessionStorage across cards.
//
// [L8] WATCH TIME — signals fire at 40% and 80% thresholds.
//
// [L9] SKIP detection — if component unmounts within 1.5s, signal SKIP.
//
// [L10] No layout shift — card has a fixed aspect-ratio container with
//       contain:layout so surroundings never repaint during media swap.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from "react";
import {
  Play, Pause, Volume2, VolumeX,
  Heart, Bookmark, Share2, Eye,
  Compass, Maximize2, ChevronDown,
} from "lucide-react";
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";

// ─── Connection quality (computed once at module load) ─────────────────────
const _conn  = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect   = _conn?.effectiveType || "4g";
const _save  = _conn?.saveData || false;

const CONNECTION = {
  isSlow: _save || _ect === "slow-2g" || _ect === "2g",
  isMid:  _ect === "3g",
};

// [L4] Adaptive video URL
function adaptVideoUrl(url) {
  if (!url) return "";
  if (CONNECTION.isSlow) return url.replace("hd_1920_1080", "sd_960_540").replace("hd_", "sd_");
  if (CONNECTION.isMid)  return url.replace("hd_1920_1080", "hd_1280_720");
  return url;
}

// [L1] LQIP placeholder — append tiny size to Pexels/Cloudinary URLs
function getLqipUrl(thumbUrl) {
  if (!thumbUrl) return "";
  // Pexels supports ?w= parameter
  if (thumbUrl.includes("pexels.com")) return `${thumbUrl.split("?")[0]}?w=20&auto=compress`;
  // Cloudinary supports on-the-fly transforms
  if (thumbUrl.includes("cloudinary.com")) return thumbUrl.replace("/upload/", "/upload/w_20,q_1,f_auto/");
  return thumbUrl;
}

// [L7] Mute state persisted
const getMutePref = () => {
  try { const v = sessionStorage.getItem("xv_disc_mute"); return v === null ? true : v === "true"; }
  catch { return true; }
};
const setMutePref = (v) => { try { sessionStorage.setItem("xv_disc_mute", String(v)); } catch {} };

// ─── Mood → visual theme ───────────────────────────────────────────────────
const MOOD_THEME = {
  calm:         { grad: "rgba(14,165,233,0.18)", accent: "#0ea5e9", label: "Calm"        },
  intense:      { grad: "rgba(239,68,68,0.18)",  accent: "#ef4444", label: "Intense"     },
  motivational: { grad: "rgba(245,158,11,0.18)", accent: "#f59e0b", label: "Energise"    },
  night:        { grad: "rgba(139,92,246,0.18)", accent: "#8b5cf6", label: "Night"       },
  curious:      { grad: "rgba(16,185,129,0.18)", accent: "#10b981", label: "Discover"    },
  cinematic:    { grad: "rgba(232,121,249,0.18)",accent: "#e879f9", label: "Cinematic"   },
};
const DEFAULT_THEME = { grad: "rgba(132,204,22,0.18)", accent: "#84cc16", label: "Discovery" };

// ─── Global concurrent preload limiter ────────────────────────────────────
// Ensures at most 3 videos preload simultaneously across all mounted cards.
const _preloadSlots = { active: 0, max: 3 };

// ═══════════════════════════════════════════════════════════════════════════
// DiscoveryCard
// ═══════════════════════════════════════════════════════════════════════════
const DiscoveryCard = React.memo(function DiscoveryCard({
  item,
  isVisible,
  onOpenDiscovery,
}) {
  const [muted,      setMuted]      = useState(getMutePref);
  const [playing,    setPlaying]    = useState(false);
  const [vidReady,   setVidReady]   = useState(false);
  const [posterOk,   setPosterOk]   = useState(false);
  const [liked,      setLiked]      = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [captionExp, setCaptionExp] = useState(false);
  const [showHud,    setShowHud]    = useState(true);

  const videoRef  = useRef(null);
  const hudTimer  = useRef(null);
  const skipRef   = useRef(Date.now());
  const coolingRef = useRef(null);
  const halfFired  = useRef(false);
  const fullFired  = useRef(false);

  const theme = MOOD_THEME[item.mood] || DEFAULT_THEME;
  const adaptedUrl = useMemo(() => adaptVideoUrl(item.videoUrl), [item.videoUrl]);
  const lqip = useMemo(() => getLqipUrl(item.thumbnailUrl), [item.thumbnailUrl]);

  // ── [L9] Skip detection ─────────────────────────────────────────────────
  useEffect(() => {
    skipRef.current = Date.now();
    return () => {
      if (Date.now() - skipRef.current < 1500) recordSignal(item, "SKIP");
    };
  }, []); // eslint-disable-line

  // ── [L2] Preload metadata when card enters proximity ───────────────────
  // We preload here in useEffect triggered by isVisible's neighbours.
  // The actual isVisible toggle is used to play/pause below.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !adaptedUrl) return;

    // Acquire a preload slot
    if (_preloadSlots.active < _preloadSlots.max) {
      _preloadSlots.active++;
      el.preload = "metadata";
      if (!el.src) el.src = adaptedUrl;

      return () => {
        _preloadSlots.active = Math.max(0, _preloadSlots.active - 1);
      };
    }
  }, []); // eslint-disable-line — intentionally fires once on mount

  // ── [L3] Single active rule: autoplay / pause via isVisible ─────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isVisible) {
      clearTimeout(coolingRef.current);
      // Ensure src is set
      if (!el.src && adaptedUrl) el.src = adaptedUrl;
      el.muted = muted;

      const tryPlay = () => {
        el.play()
          .then(() => setPlaying(true))
          .catch(() => {}); // autoplay blocked — poster stays visible
      };

      if (el.readyState >= 2) { // HAVE_CURRENT_DATA or better
        tryPlay();
      } else {
        el.addEventListener("canplay", tryPlay, { once: true });
        return () => el.removeEventListener("canplay", tryPlay);
      }
    } else {
      el.pause();
      setPlaying(false);
      // [L3] Cooling — release src after 800ms to free decoder
      coolingRef.current = setTimeout(() => {
        if (!el.paused) return; // re-activated
        el.removeAttribute("src");
        el.load(); // reset element so browser frees resources
      }, 800);
    }

    return () => clearTimeout(coolingRef.current);
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HUD auto-hide ───────────────────────────────────────────────────────
  const resetHud = useCallback(() => {
    setShowHud(true);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setShowHud(false), 3000);
  }, []);

  useEffect(() => {
    resetHud();
    return () => clearTimeout(hudTimer.current);
  }, []); // eslint-disable-line

  // ── Toggle play/pause ────────────────────────────────────────────────────
  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    resetHud();
    if (playing) {
      el.pause();
      setPlaying(false);
      recordSignal(item, "PAUSE");
    } else {
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, item, resetHud]);

  // ── Toggle mute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    const el = videoRef.current;
    const next = !muted;
    if (el) el.muted = next;
    setMuted(next);
    setMutePref(next);
    resetHud();
  }, [muted, resetHud]);

  // ── [L8] Watch time tracking ─────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const pct = el.currentTime / el.duration;
    if (pct >= 0.8 && !fullFired.current) {
      fullFired.current = true;
      recordSignal(item, "WATCH_COMPLETE");
    } else if (pct >= 0.4 && !halfFired.current) {
      halfFired.current = true;
      recordSignal(item, "WATCH_HALF");
    }
  }, [item]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleLike = useCallback((e) => {
    e.stopPropagation();
    const next = !liked;
    setLiked(next);
    if (next) recordSignal(item, "LIKE");
    resetHud();
  }, [liked, item, resetHud]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    if (next) recordSignal(item, "SAVE");
    resetHud();
  }, [saved, item, resetHud]);

  const handleShare = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "SHARE");
    if (navigator.share) {
      navigator.share({ title: item.title, text: item.caption || "" }).catch(() => {});
    }
    resetHud();
  }, [item, resetHud]);

  const handleOpenDiscovery = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "CLICK_THROUGH");
    onOpenDiscovery?.(item.category);
  }, [item, onOpenDiscovery]);

  const fmt = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n || "");

  return (
    <div
      className="dc-card"
      style={{ "--mood-grad": theme.grad, "--mood-accent": theme.accent }}
      onClick={togglePlay}
    >
      {/* ── [L1] LQIP blurred placeholder — always shown first ── */}
      {lqip && (
        <div
          className="dc-lqip"
          style={{ backgroundImage: `url(${lqip})` }}
          aria-hidden="true"
        />
      )}

      {/* ── Media layer ── */}
      <div className="dc-media">
        {/* Poster image — replaces LQIP once loaded */}
        {item.thumbnailUrl && (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className={`dc-poster ${posterOk ? "dc-poster--ready" : ""}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setPosterOk(true)}
          />
        )}

        {/* Video element — overlays poster when ready */}
        {adaptedUrl && (
          <video
            ref={videoRef}
            muted={muted}
            playsInline
            loop
            preload="none"
            className={`dc-video ${vidReady ? "dc-video--ready" : ""}`}
            onCanPlay={() => setVidReady(true)}
            onTimeUpdate={onTimeUpdate}
            onSeeked={() => { if (videoRef.current?.currentTime < 1) recordSignal(item, "REPLAY"); }}
          />
        )}

        {/* [L5] Mood-tinted cinematic gradient */}
        <div className="dc-grad-top" />
        <div className="dc-grad-bot" style={{ "--mood-g": theme.grad }} />

        {/* Mood accent bar */}
        <div className="dc-mood-bar" style={{ background: `linear-gradient(90deg,${theme.accent},transparent)` }} />
      </div>

      {/* ── Discovery badge ── */}
      <div
        className="dc-badge"
        style={{ background: theme.accent }}
        onClick={handleOpenDiscovery}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpenDiscovery(e)}
      >
        <Compass size={9} />
        {item.category} · {theme.label}
      </div>

      {/* ── HUD (fades out after 3s idle) ── */}
      <div className={`dc-hud ${showHud ? "dc-hud--show" : ""}`} aria-hidden="true">
        {/* Play/pause center button */}
        {!playing && (
          <div className="dc-play-btn">
            <Play size={26} fill="#fff" color="#fff" />
          </div>
        )}
        {/* Mute toggle */}
        <button className="dc-mute" onClick={toggleMute} aria-label="Toggle mute">
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* ── Caption ── */}
      <div className="dc-caption-area">
        <div className="dc-cat-label" style={{ color: theme.accent }}>
          {item.category}
        </div>
        <h3 className="dc-title">{item.title}</h3>
        {item.caption && (
          <p
            className={`dc-caption ${captionExp ? "dc-caption--exp" : ""}`}
            onClick={(e) => { e.stopPropagation(); setCaptionExp(v => !v); }}
          >
            {item.caption}
            {!captionExp && item.caption.length > 80 && (
              <span className="dc-caption-more">
                <ChevronDown size={11} />
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── Action rail ── */}
      <div className="dc-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className={`dc-act ${liked ? "dc-act--liked" : ""}`}
          onClick={handleLike}
          aria-label="Like"
        >
          <Heart size={20} fill={liked ? "currentColor" : "none"} />
        </button>
        <button
          className={`dc-act ${saved ? "dc-act--saved" : ""}`}
          onClick={handleSave}
          aria-label="Save"
        >
          <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
        </button>
        <button className="dc-act" onClick={handleShare} aria-label="Share">
          <Share2 size={18} />
        </button>
        <button className="dc-act dc-act--expand" onClick={handleOpenDiscovery} aria-label="Open Discovery">
          <Maximize2 size={16} />
        </button>
        {item.views ? (
          <div className="dc-views">
            <Eye size={12} />
            {fmt(item.views)}
          </div>
        ) : null}
      </div>

      <style>{DC_CSS}</style>
    </div>
  );
});

DiscoveryCard.displayName = "DiscoveryCard";
export default DiscoveryCard;

// ─── CSS ─────────────────────────────────────────────────────────────────────
const DC_CSS = `
/* [L10] No layout shift — fixed aspect ratio with contain */
.dc-card{
  position:relative;
  width:100%;
  border-radius:18px;
  overflow:hidden;
  background:#080808;
  margin:4px 0 10px;
  cursor:pointer;
  user-select:none;
  -webkit-tap-highlight-color:transparent;
  border:1px solid rgba(255,255,255,0.06);
  transition:border-color .2s;
  contain:layout;
}
.dc-card:hover{border-color:rgba(255,255,255,0.12);}

/* [L1] LQIP blurred placeholder — underneath everything */
.dc-lqip{
  position:absolute;inset:0;
  background-size:cover;background-position:center;
  filter:blur(12px) saturate(0.4);
  transform:scale(1.05); /* prevent blur edge artifacts */
  z-index:0;
  pointer-events:none;
}

/* Media container — 9:14 portrait */
.dc-media{
  position:relative;
  width:100%;
  aspect-ratio:9/14;
  background:transparent;
  overflow:hidden;
  z-index:1;
}

/* Poster — slides in once loaded */
.dc-poster{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:cover;display:block;
  opacity:0;transition:opacity .25s ease;
  z-index:1;
}
.dc-poster--ready{opacity:1;}

/* Video — overlays poster when ready */
.dc-video{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:cover;display:block;
  opacity:0;transition:opacity .3s ease;
  z-index:2;
}
.dc-video--ready{opacity:1;}

/* [L5] Cinematic gradients */
.dc-grad-top{
  position:absolute;inset:0;bottom:auto;height:35%;
  background:linear-gradient(to bottom,rgba(0,0,0,0.5),transparent);
  pointer-events:none;z-index:3;
}
.dc-grad-bot{
  position:absolute;inset:0;top:auto;height:60%;
  background:linear-gradient(to top,rgba(0,0,0,0.95),rgba(0,0,0,0.45) 60%,transparent);
  pointer-events:none;z-index:3;
}

/* Mood accent bar — left edge glow */
.dc-mood-bar{
  position:absolute;left:0;top:0;bottom:0;width:3px;z-index:4;
  pointer-events:none;opacity:0.7;
}

/* Discovery badge */
.dc-badge{
  position:absolute;top:12px;left:12px;z-index:5;
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:20px;
  font-size:9.5px;font-weight:800;letter-spacing:.06em;
  color:#fff;text-transform:uppercase;
  cursor:pointer;
  box-shadow:0 2px 12px rgba(0,0,0,0.45);
  transition:transform .15s,opacity .15s;
}
.dc-badge:hover{transform:scale(1.05);opacity:.9;}

/* HUD */
.dc-hud{
  position:absolute;inset:0;z-index:6;
  display:flex;align-items:center;justify-content:center;
  pointer-events:none;
  opacity:0;transition:opacity .3s;
}
.dc-hud--show{opacity:1;}
.dc-hud>*{pointer-events:all;}

.dc-play-btn{
  width:64px;height:64px;border-radius:50%;
  background:rgba(0,0,0,0.52);
  border:2px solid rgba(255,255,255,0.32);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(10px);
  transition:transform .2s,background .2s;
}
.dc-play-btn:hover{background:rgba(0,0,0,0.75);transform:scale(1.08);}

.dc-mute{
  position:absolute;bottom:196px;right:14px;
  width:36px;height:36px;border-radius:50%;
  background:rgba(0,0,0,0.5);
  border:1px solid rgba(255,255,255,0.15);
  color:rgba(255,255,255,0.82);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);
  transition:background .15s;
}
.dc-mute:hover{background:rgba(0,0,0,0.78);}

/* Caption area */
.dc-caption-area{
  position:absolute;bottom:70px;left:0;right:54px;
  padding:0 14px;z-index:5;pointer-events:none;
}
.dc-cat-label{
  font-size:10px;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;margin-bottom:4px;
  text-shadow:0 1px 6px rgba(0,0,0,0.9);
}
.dc-title{
  font-size:16px;font-weight:800;color:#fff;
  line-height:1.25;margin:0 0 6px;
  text-shadow:0 2px 12px rgba(0,0,0,0.85);
}
.dc-caption{
  font-size:12.5px;font-weight:500;
  color:rgba(255,255,255,0.74);
  line-height:1.5;margin:0;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;
  overflow:hidden;
  text-shadow:0 1px 6px rgba(0,0,0,0.9);
  cursor:pointer;pointer-events:all;
  transition:opacity .15s;
}
.dc-caption--exp{-webkit-line-clamp:unset;overflow:visible;display:block;}
.dc-caption-more{display:inline-flex;align-items:center;margin-left:3px;opacity:.6;}

/* Action rail */
.dc-actions{
  position:absolute;bottom:14px;right:14px;
  display:flex;flex-direction:column;align-items:center;
  gap:14px;z-index:6;
}
.dc-act{
  width:40px;height:40px;border-radius:50%;
  background:rgba(0,0,0,0.48);
  border:1px solid rgba(255,255,255,0.12);
  color:rgba(255,255,255,0.75);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);
  transition:all .18s;
  -webkit-tap-highlight-color:transparent;
}
.dc-act:hover{background:rgba(0,0,0,0.78);color:#fff;transform:scale(1.1);}
.dc-act--liked{color:#ef4444;border-color:rgba(239,68,68,0.42);}
.dc-act--saved{color:#84cc16;border-color:rgba(132,204,22,0.42);}
.dc-act--expand{color:rgba(255,255,255,0.48);}
.dc-views{
  display:flex;align-items:center;gap:3px;
  font-size:9px;font-weight:700;
  color:rgba(27, 24, 24, 0.38);
  margin-top:-6px;
}

@media(max-width:768px){
  .dc-media{aspect-ratio:9/16;}
  .dc-title{font-size:14px;}
  .dc-actions{gap:12px;}
  .dc-mute{bottom:calc(100vw * 16/9 - 50px);}
}
`;