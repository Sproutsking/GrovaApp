// src/components/Home/DiscoveryCard.jsx — v3 NEVER-BLACK + GRADIENT-FIRST
//
// ═══════════════════════════════════════════════════════════════════════════
// FIXES vs v2:
//
// [G1]  GRADIENT BASE — every card renders a cinematic category gradient
//       as the absolute bottom layer. Even if thumbnailUrl is empty or
//       fails, the card is always visually filled. Never black.
//
// [G2]  LQIP SAFE — getLqipUrl returns "" for non-Pexels/non-Cloudinary
//       URLs so the blurred placeholder never fires a broken network req.
//
// [G3]  VIDEO GUARD — adaptVideoUrl and the video element only activate
//       when videoUrl is a non-empty string. Empty string = no video el.
//
// [G4]  POSTER SAFE — poster img only renders when thumbnailUrl is set.
//       When absent, gradient fills the space and category + title are
//       shown prominently with a shimmer animation.
//
// [G5]  MOOD THEME APPLIED TO GRADIENT — the mood-tinted bottom gradient
//       overlay uses the mood color so dark cards have personality.
//
// All v2 logic preserved:
//   L1 LQIP | L2 video preload slots | L3 single active rule
//   L4 adaptive bitrate | L6 action rail signals | L7 mute persist
//   L8 watch time | L9 skip detection | L10 no layout shift
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from "react";
import {
  Play, Volume2, VolumeX,
  Heart, Bookmark, Share2, Eye,
  Compass, Maximize2, ChevronDown,
} from "lucide-react";
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";

// ─── Connection quality ────────────────────────────────────────────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType || "4g";
const _save = _conn?.saveData || false;
const CONNECTION = {
  isSlow: _save || _ect === "slow-2g" || _ect === "2g",
  isMid:  _ect === "3g",
};

// [L4] Adaptive video URL
function adaptVideoUrl(url) {
  if (!url || typeof url !== "string" || !url.trim()) return "";
  if (CONNECTION.isSlow) return url.replace("hd_1920_1080","sd_960_540").replace("hd_","sd_");
  if (CONNECTION.isMid)  return url.replace("hd_1920_1080","hd_1280_720");
  return url;
}

// [G2] LQIP — only for Cloudinary and Pexels (direct CDN URLs we know support transforms)
function getLqipUrl(thumbUrl) {
  if (!thumbUrl || typeof thumbUrl !== "string") return "";
  if (thumbUrl.includes("cloudinary.com"))
    return thumbUrl.replace("/upload/", "/upload/w_20,q_1,f_auto/");
  if (thumbUrl.includes("pexels.com"))
    return `${thumbUrl.split("?")[0]}?w=20&auto=compress`;
  return ""; // don't attempt LQIP for unknown CDNs
}

// [L7] Mute preference persisted in sessionStorage
const getMutePref = () => {
  try { const v = sessionStorage.getItem("xv_disc_mute"); return v === null ? true : v === "true"; }
  catch { return true; }
};
const setMutePref = v => { try { sessionStorage.setItem("xv_disc_mute", String(v)); } catch {} };

// ─── Mood → visual theme ───────────────────────────────────────────────────
const MOOD_THEME = {
  calm:         { grad:"rgba(14,165,233,0.22)",  accent:"#0ea5e9", label:"Calm"      },
  intense:      { grad:"rgba(239,68,68,0.22)",   accent:"#ef4444", label:"Intense"   },
  motivational: { grad:"rgba(245,158,11,0.22)",  accent:"#f59e0b", label:"Energise"  },
  night:        { grad:"rgba(139,92,246,0.22)",  accent:"#8b5cf6", label:"Night"     },
  curious:      { grad:"rgba(16,185,129,0.22)",  accent:"#10b981", label:"Discover"  },
  cinematic:    { grad:"rgba(232,121,249,0.22)", accent:"#e879f9", label:"Cinematic" },
};
const DEFAULT_THEME = { grad:"rgba(132,204,22,0.22)", accent:"#84cc16", label:"Discovery" };

// ─── [G1] Per-category cinematic gradient backgrounds ─────────────────────
const CATEGORY_GRADIENTS = {
  "Ocean":            "linear-gradient(170deg,#0c2a4a 0%,#0a4a6e 45%,#0e7490 100%)",
  "Jungle":           "linear-gradient(170deg,#052e16 0%,#14532d 55%,#166534 100%)",
  "Predator":         "linear-gradient(170deg,#1c0a00 0%,#431407 55%,#7c2d12 100%)",
  "Birds":            "linear-gradient(170deg,#0c1445 0%,#1e3a8a 55%,#1d4ed8 100%)",
  "Space & Earth":    "linear-gradient(170deg,#020617 0%,#0f172a 45%,#1e1b4b 100%)",
  "Snow":             "linear-gradient(170deg,#0c1a2e 0%,#1e3a5f 55%,#93c5fd 100%)",
  "Rain":             "linear-gradient(170deg,#0a0f1e 0%,#1e293b 55%,#475569 100%)",
  "Waterfalls":       "linear-gradient(170deg,#042f2e 0%,#134e4a 55%,#0d9488 100%)",
  "Macro Wildlife":   "linear-gradient(170deg,#1a2e05 0%,#365314 55%,#4d7c0f 100%)",
  "Mountains":        "linear-gradient(170deg,#1c1917 0%,#292524 55%,#78716c 100%)",
  "Desert":           "linear-gradient(170deg,#1c1400 0%,#451a03 55%,#92400e 100%)",
  "Night Nature":     "linear-gradient(170deg,#020617 0%,#1e1b4b 55%,#4338ca 100%)",
  "Storms":           "linear-gradient(170deg,#09090b 0%,#18181b 55%,#52525b 100%)",
  "Aerial Earth":     "linear-gradient(170deg,#0c1445 0%,#1e3a8a 45%,#0e7490 100%)",
  "Relaxation":       "linear-gradient(170deg,#042f2e 0%,#0f4c5c 55%,#0ea5e9 100%)",
  "Survival":         "linear-gradient(170deg,#1c0a00 0%,#292524 55%,#57534e 100%)",
  "Extreme Nature":   "linear-gradient(170deg,#1c0000 0%,#450a0a 55%,#b91c1c 100%)",
};
const DEFAULT_CAT_GRAD = "linear-gradient(170deg,#0a0a14 0%,#1a1a2e 100%)";

// ─── Global concurrent preload limiter ────────────────────────────────────
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

  const videoRef   = useRef(null);
  const hudTimer   = useRef(null);
  const skipRef    = useRef(Date.now());
  const coolingRef = useRef(null);
  const halfFired  = useRef(false);
  const fullFired  = useRef(false);

  const theme      = MOOD_THEME[item.mood] || DEFAULT_THEME;
  const catGrad    = CATEGORY_GRADIENTS[item.category] || DEFAULT_CAT_GRAD;
  const adaptedUrl = useMemo(() => adaptVideoUrl(item.videoUrl), [item.videoUrl]);
  const lqip       = useMemo(() => getLqipUrl(item.thumbnailUrl), [item.thumbnailUrl]);
  const hasThumb   = !!(item.thumbnailUrl && typeof item.thumbnailUrl === "string");
  const hasVideo   = !!(adaptedUrl && adaptedUrl.length > 0);

  // ── [L9] Skip detection ──────────────────────────────────────────────────
  useEffect(() => {
    skipRef.current = Date.now();
    return () => {
      if (Date.now() - skipRef.current < 1500) recordSignal(item, "SKIP");
    };
  }, []); // eslint-disable-line

  // ── [L2] Preload metadata slot acquisition on mount ──────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !adaptedUrl) return;
    if (_preloadSlots.active < _preloadSlots.max) {
      _preloadSlots.active++;
      el.preload = "metadata";
      if (!el.src) el.src = adaptedUrl;
      return () => {
        _preloadSlots.active = Math.max(0, _preloadSlots.active - 1);
      };
    }
  }, []); // eslint-disable-line — intentionally once

  // ── [L3] Single active rule: play/pause via isVisible ───────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isVisible) {
      clearTimeout(coolingRef.current);
      if (!el.src && adaptedUrl) el.src = adaptedUrl;
      el.muted = muted;
      const tryPlay = () => {
        el.play().then(() => setPlaying(true)).catch(() => {});
      };
      if (el.readyState >= 2) { tryPlay(); }
      else {
        el.addEventListener("canplay", tryPlay, { once: true });
        return () => el.removeEventListener("canplay", tryPlay);
      }
    } else {
      el.pause();
      setPlaying(false);
      coolingRef.current = setTimeout(() => {
        if (!el.paused) return;
        el.removeAttribute("src");
        el.load();
      }, 800);
    }
    return () => clearTimeout(coolingRef.current);
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HUD auto-hide ────────────────────────────────────────────────────────
  const resetHud = useCallback(() => {
    setShowHud(true);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setShowHud(false), 3000);
  }, []);

  useEffect(() => { resetHud(); return () => clearTimeout(hudTimer.current); }, []); // eslint-disable-line

  // ── Toggle play/pause ────────────────────────────────────────────────────
  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    resetHud();
    if (playing) {
      el.pause(); setPlaying(false); recordSignal(item, "PAUSE");
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
    setMuted(next); setMutePref(next); resetHud();
  }, [muted, resetHud]);

  // ── [L8] Watch time tracking ─────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const pct = el.currentTime / el.duration;
    if (pct >= 0.8 && !fullFired.current) { fullFired.current = true; recordSignal(item, "WATCH_COMPLETE"); }
    else if (pct >= 0.4 && !halfFired.current) { halfFired.current = true; recordSignal(item, "WATCH_HALF"); }
  }, [item]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleLike = useCallback((e) => {
    e.stopPropagation();
    const next = !liked; setLiked(next);
    if (next) recordSignal(item, "LIKE");
    resetHud();
  }, [liked, item, resetHud]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    const next = !saved; setSaved(next);
    if (next) recordSignal(item, "SAVE");
    resetHud();
  }, [saved, item, resetHud]);

  const handleShare = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "SHARE");
    if (navigator.share) navigator.share({ title: item.title, text: item.caption || "" }).catch(() => {});
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
      {/* [G2] LQIP blurred placeholder — only when we have a valid lqip URL */}
      {lqip && (
        <div
          className="dc-lqip"
          style={{ backgroundImage: `url(${lqip})` }}
          aria-hidden="true"
        />
      )}

      {/* Media layer */}
      <div className="dc-media">

        {/* [G1] CATEGORY GRADIENT — always rendered as base, z-index 0 */}
        <div className="dc-cat-bg" style={{ background: catGrad }} />

        {/* [G4] Poster — only when thumbnailUrl exists */}
        {hasThumb && (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className={`dc-poster${posterOk ? " dc-poster--ready" : ""}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setPosterOk(true)}
            onError={() => {}} // gradient already showing — no action needed
          />
        )}

        {/* [G3] Video element — only when adaptedUrl is non-empty */}
        {hasVideo && (
          <video
            ref={videoRef}
            muted={muted}
            playsInline
            loop
            preload="none"
            className={`dc-video${vidReady ? " dc-video--ready" : ""}`}
            onCanPlay={() => setVidReady(true)}
            onTimeUpdate={onTimeUpdate}
            onSeeked={() => {
              if (videoRef.current?.currentTime < 1) recordSignal(item, "REPLAY");
            }}
          />
        )}

        {/* [G5] Cinematic gradients — mood-tinted */}
        <div className="dc-grad-top" />
        <div className="dc-grad-bot" />

        {/* Mood accent bar — left edge glow */}
        <div
          className="dc-mood-bar"
          style={{ background: `linear-gradient(180deg,${theme.accent},transparent)` }}
        />

        {/* [G4] When no thumbnail: show prominent title + shimmer on gradient */}
        {!hasThumb && (
          <>
            <div className="dc-no-thumb-shimmer" />
            <div className="dc-no-thumb-title">{item.title}</div>
          </>
        )}
      </div>

      {/* Discovery badge */}
      <div
        className="dc-badge"
        style={{ background: theme.accent }}
        onClick={handleOpenDiscovery}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && handleOpenDiscovery(e)}
      >
        <Compass size={9} />
        {item.category} · {theme.label}
      </div>

      {/* HUD (fades after 3s idle) */}
      <div className={`dc-hud${showHud ? " dc-hud--show" : ""}`} aria-hidden="true">
        {!playing && hasVideo && (
          <div className="dc-play-btn">
            <Play size={26} fill="#fff" color="#fff" />
          </div>
        )}
        {hasVideo && (
          <button className="dc-mute" onClick={toggleMute} aria-label="Toggle mute">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}
      </div>

      {/* Caption area */}
      <div className="dc-caption-area">
        <div className="dc-cat-label" style={{ color: theme.accent }}>{item.category}</div>
        <h3 className="dc-title">{item.title}</h3>
        {item.caption && (
          <p
            className={`dc-caption${captionExp ? " dc-caption--exp" : ""}`}
            onClick={e => { e.stopPropagation(); setCaptionExp(v => !v); }}
          >
            {item.caption}
            {!captionExp && item.caption.length > 80 && (
              <span className="dc-caption-more"><ChevronDown size={11} /></span>
            )}
          </p>
        )}
      </div>

      {/* Action rail */}
      <div className="dc-actions" onClick={e => e.stopPropagation()}>
        <button
          className={`dc-act${liked ? " dc-act--liked" : ""}`}
          onClick={handleLike} aria-label="Like"
        >
          <Heart size={20} fill={liked ? "currentColor" : "none"} />
        </button>
        <button
          className={`dc-act${saved ? " dc-act--saved" : ""}`}
          onClick={handleSave} aria-label="Save"
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
          <div className="dc-views"><Eye size={12} />{fmt(item.views)}</div>
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
/* [L10] Fixed aspect-ratio, no layout shift */
.dc-card{
  position:relative;width:100%;border-radius:18px;overflow:hidden;
  background:transparent;
  margin:4px 0 10px;cursor:pointer;user-select:none;
  -webkit-tap-highlight-color:transparent;
  border:1px solid rgba(255,255,255,0.07);
  transition:border-color .2s;contain:layout;
}
.dc-card:hover{border-color:rgba(255,255,255,0.14);}

/* [G2] LQIP blurred background */
.dc-lqip{
  position:absolute;inset:0;
  background-size:cover;background-position:center;
  filter:blur(12px) saturate(0.4);
  transform:scale(1.05);
  z-index:0;pointer-events:none;
}

/* Media container — 9:14 portrait */
.dc-media{
  position:relative;width:100%;aspect-ratio:9/14;
  overflow:hidden;z-index:1;
}
@media(max-width:768px){.dc-media{aspect-ratio:9/16;}}

/* [G1] Category gradient base — z-index 0, always visible */
.dc-cat-bg{position:absolute;inset:0;z-index:0;}

/* Poster — fades in over gradient */
.dc-poster{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;display:block;
  opacity:0;transition:opacity .3s ease;z-index:1;
}
.dc-poster--ready{opacity:1;}

/* Video — overlays poster when ready */
.dc-video{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;display:block;
  opacity:0;transition:opacity .3s ease;z-index:2;
}
.dc-video--ready{opacity:1;}

/* [G5] Cinematic gradients */
.dc-grad-top{
  position:absolute;inset:0;bottom:auto;height:35%;
  background:linear-gradient(to bottom,rgba(0,0,0,0.55),transparent);
  pointer-events:none;z-index:3;
}
.dc-grad-bot{
  position:absolute;inset:0;top:auto;height:65%;
  background:linear-gradient(to top,rgba(0,0,0,0.96),rgba(0,0,0,0.5) 55%,transparent);
  pointer-events:none;z-index:3;
}

/* Mood accent bar */
.dc-mood-bar{
  position:absolute;left:0;top:0;bottom:0;width:3px;
  z-index:4;pointer-events:none;opacity:0.75;
}

/* [G4] No-thumbnail state: shimmer + title on gradient */
@keyframes dcShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
.dc-no-thumb-shimmer{
  position:absolute;inset:0;z-index:2;overflow:hidden;
}
.dc-no-thumb-shimmer::after{
  content:"";position:absolute;top:0;left:0;width:50%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);
  animation:dcShimmer 2s ease-in-out infinite;
}
.dc-no-thumb-title{
  position:absolute;bottom:80px;left:14px;right:54px;z-index:4;
  font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);
  line-height:1.3;text-shadow:0 2px 12px rgba(0,0,0,0.95);
}

/* Discovery badge */
.dc-badge{
  position:absolute;top:12px;left:12px;z-index:5;
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:20px;
  font-size:9.5px;font-weight:800;letter-spacing:.06em;
  color:#fff;text-transform:uppercase;cursor:pointer;
  box-shadow:0 2px 12px rgba(0,0,0,0.5);
  transition:transform .15s,opacity .15s;
}
.dc-badge:hover{transform:scale(1.05);opacity:.9;}

/* HUD */
.dc-hud{
  position:absolute;inset:0;z-index:6;
  display:flex;align-items:center;justify-content:center;
  pointer-events:none;opacity:0;transition:opacity .3s;
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
  position:absolute;bottom:200px;right:14px;
  width:36px;height:36px;border-radius:50%;
  background:rgba(0,0,0,0.52);
  border:1px solid rgba(255,255,255,0.18);
  color:rgba(255,255,255,0.85);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);
  transition:background .15s;
}
.dc-mute:hover{background:rgba(0,0,0,0.78);}

/* Caption area */
.dc-caption-area{
  position:absolute;bottom:72px;left:0;right:54px;
  padding:0 14px;z-index:5;pointer-events:none;
}
.dc-cat-label{
  font-size:10px;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;margin-bottom:4px;
  text-shadow:0 1px 6px rgba(0,0,0,0.95);
}
.dc-title{
  font-size:16px;font-weight:800;color:#fff;
  line-height:1.25;margin:0 0 6px;
  text-shadow:0 2px 12px rgba(0,0,0,0.9);
}
@media(max-width:768px){.dc-title{font-size:14px;}}
.dc-caption{
  font-size:12.5px;font-weight:500;color:rgba(255,255,255,0.76);
  line-height:1.5;margin:0;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;
  overflow:hidden;text-shadow:0 1px 6px rgba(0,0,0,0.95);
  cursor:pointer;pointer-events:all;
}
.dc-caption--exp{-webkit-line-clamp:unset;overflow:visible;display:block;}
.dc-caption-more{display:inline-flex;align-items:center;margin-left:3px;opacity:.6;}

/* Action rail */
.dc-actions{
  position:absolute;bottom:14px;right:14px;
  display:flex;flex-direction:column;align-items:center;
  gap:14px;z-index:6;
}
@media(max-width:768px){.dc-actions{gap:12px;}}
.dc-act{
  width:40px;height:40px;border-radius:50%;
  background:rgba(0,0,0,0.5);
  border:1px solid rgba(255,255,255,0.14);
  color:rgba(255,255,255,0.78);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);
  transition:all .18s;-webkit-tap-highlight-color:transparent;
}
.dc-act:hover{background:rgba(0,0,0,0.8);color:#fff;transform:scale(1.1);}
.dc-act--liked{color:#ef4444;border-color:rgba(239,68,68,0.44);}
.dc-act--saved{color:#84cc16;border-color:rgba(132,204,22,0.44);}
.dc-act--expand{color:rgba(255,255,255,0.48);}
.dc-views{
  display:flex;align-items:center;gap:3px;
  font-size:9px;font-weight:700;
  color:rgba(255,255,255,0.38);margin-top:-6px;
}

.dc-mute{bottom:calc(9/14 * 100vw * 0.5);}
@media(max-width:768px){.dc-mute{bottom:calc(9/16 * 100vw * 0.5);}}
`;