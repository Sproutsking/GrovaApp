// src/components/Home/DiscoveryCard.jsx — v5 ULTRA-ADDICTIVE + SUBSCRIPTION SAVE
//
// FEATURES:
// ─────────────────────────────────────────────────────────────────────────────
// [V1] Autoplay driven by isVisible prop (IntersectionObserver in parent)
// [V2] Adaptive video quality based on connection speed
// [V3] LQIP blur-up thumbnail loading
// [V4] Subscription-gated save (silver/gold/diamond only) with upgrade nudge
// [V5] Save stores URL reference in localStorage — zero DB cost
//      Saved items reload on demand from their external URLs
// [V6] Share via navigator.share or clipboard fallback
// [V7] Full-screen overlay on expand tap
// [V8] Category gradient always rendered — never black screen
// [V9] Cinematic caption with expand-on-tap
// [V10] Action rail with like, save, share, expand, view count
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from "react";
import {
  Play, Volume2, VolumeX,
  Heart, Bookmark, Share2, Eye,
  Compass, Maximize2, ChevronDown, BookmarkCheck,
  Lock,
} from "lucide-react";
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";
import {
  isSavedDiscovery,
  toggleSavedDiscovery,
  CATEGORY_GRADIENTS,
} from "../../services/discovery/discoveryService";

export { CATEGORY_GRADIENTS };

// ─── Re-export getSavedDiscovery for DiscoveryTab ─────────────────────────────
export { getSavedDiscovery } from "../../services/discovery/discoveryService";

// ─── Connection quality ───────────────────────────────────────────────────────
const _conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
const _ect  = _conn?.effectiveType  || "4g";
const _save = _conn?.saveData       || false;

function adaptUrl(url) {
  if (!url || typeof url !== "string" || !url.trim()) return "";
  if (_save || _ect === "slow-2g" || _ect === "2g")
    return url.replace("hd_1920_1080","sd_960_540").replace("hd_","sd_");
  if (_ect === "3g") return url.replace("hd_1920_1080","hd_1280_720");
  return url;
}

function getLqip(thumbUrl) {
  if (!thumbUrl || typeof thumbUrl !== "string") return "";
  if (thumbUrl.includes("cloudinary.com"))
    return thumbUrl.replace("/upload/", "/upload/w_20,q_1,f_auto/");
  if (thumbUrl.includes("pexels.com"))
    return `${thumbUrl.split("?")[0]}?w=20&auto=compress`;
  return "";
}

// ─── Mute preference ─────────────────────────────────────────────────────────
const getMutePref = () => {
  try { const v = sessionStorage.getItem("xv_disc_mute"); return v === null ? true : v === "true"; }
  catch { return true; }
};
const setMutePref = v => { try { sessionStorage.setItem("xv_disc_mute", String(v)); } catch {} };

// ─── Preload slot manager ─────────────────────────────────────────────────────
const _slots = { active: 0, max: 3 };

// ─── Mood → accent theme ──────────────────────────────────────────────────────
const MOOD_THEME = {
  calm:         { grad:"rgba(14,165,233,0.22)",  accent:"#0ea5e9", label:"Calm"      },
  intense:      { grad:"rgba(239,68,68,0.22)",   accent:"#ef4444", label:"Intense"   },
  motivational: { grad:"rgba(245,158,11,0.22)",  accent:"#f59e0b", label:"Energise"  },
  night:        { grad:"rgba(139,92,246,0.22)",  accent:"#8b5cf6", label:"Night"     },
  curious:      { grad:"rgba(16,185,129,0.22)",  accent:"#10b981", label:"Discover"  },
  cinematic:    { grad:"rgba(232,121,249,0.22)", accent:"#e879f9", label:"Cinematic" },
  eerie:        { grad:"rgba(107,114,128,0.22)", accent:"#6b7280", label:"Eerie"     },
  wonder:       { grad:"rgba(251,191,36,0.22)",  accent:"#fbbf24", label:"Wonder"    },
};
const DEFAULT_THEME = { grad:"rgba(132,204,22,0.22)", accent:"#84cc16", label:"Discovery" };

// ─── Subscription tiers that can save ────────────────────────────────────────
const SAVE_TIERS = new Set(["silver","gold","diamond"]);

function canSave(userProfile) {
  const t = userProfile?.subscription_tier || userProfile?.boost_tier || "free";
  return SAVE_TIERS.has(t);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DiscoveryCard
// ═══════════════════════════════════════════════════════════════════════════════
const DiscoveryCard = React.memo(function DiscoveryCard({
  item,
  isVisible,
  onOpenDiscovery,
  onOpenFullScreen,
  currentUser,
}) {
  const [muted,       setMuted]       = useState(getMutePref);
  const [playing,     setPlaying]     = useState(false);
  const [vidReady,    setVidReady]    = useState(false);
  const [posterOk,    setPosterOk]    = useState(false);
  const [liked,       setLiked]       = useState(false);
  const [saved,       setSaved]       = useState(() => isSavedDiscovery(item.id));
  const [captionExp,  setCaptionExp]  = useState(false);
  const [showHud,     setShowHud]     = useState(true);
  const [toast,       setToast]       = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const videoRef   = useRef(null);
  const hudTimer   = useRef(null);
  const skipRef    = useRef(Date.now());
  const coolingRef = useRef(null);
  const halfFired  = useRef(false);
  const fullFired  = useRef(false);
  const quarterFired = useRef(false);

  const theme      = MOOD_THEME[item.mood] || DEFAULT_THEME;
  const catGrad    = CATEGORY_GRADIENTS[item.category] || "linear-gradient(170deg,#0a0a14,#1a1a2e)";
  const adaptedUrl = useMemo(() => adaptUrl(item.videoUrl), [item.videoUrl]);
  const lqip       = useMemo(() => getLqip(item.thumbnailUrl), [item.thumbnailUrl]);
  const hasThumb   = !!(item.thumbnailUrl && typeof item.thumbnailUrl === "string" && item.thumbnailUrl.trim());
  const hasVideo   = !!(adaptedUrl && adaptedUrl.length > 0);

  // Ensure the video element always gets a source once the item is rendered.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !adaptedUrl) return;
    el.crossOrigin = "anonymous";
    if (!el.src) el.src = adaptedUrl;
  }, [adaptedUrl]);

  // Skip signal on fast scroll-past
  useEffect(() => {
    skipRef.current = Date.now();
    return () => {
      if (Date.now() - skipRef.current < 1200) recordSignal(item, "SKIP");
    };
  }, []); // eslint-disable-line

  // Preload slot
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !adaptedUrl) return;
    if (_slots.active < _slots.max) {
      _slots.active++;
      el.preload = "metadata";
      if (!el.src) el.src = adaptedUrl;
      return () => { _slots.active = Math.max(0, _slots.active - 1); };
    }
  }, [adaptedUrl]);

  // [V1] Autoplay driven by isVisible
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isVisible) {
      clearTimeout(coolingRef.current);
      if (!el.src && adaptedUrl) el.src = adaptedUrl;
      el.muted = muted;
      el.preload = "auto";
      const tryPlay = () => {
        el.play().then(() => setPlaying(true)).catch(() => {
          setPlaying(false);
        });
      };
      if (el.readyState >= 2) tryPlay();
      else el.addEventListener("canplay", tryPlay, { once: true });
    } else {
      el.pause();
      setPlaying(false);
      coolingRef.current = setTimeout(() => {
        if (!el.paused) return;
        el.removeAttribute("src");
        el.load();
        setVidReady(false);
      }, 900);
    }
    return () => clearTimeout(coolingRef.current);
  }, [isVisible, adaptedUrl, muted]);

  const resetHud = useCallback(() => {
    setShowHud(true);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setShowHud(false), 3200);
  }, []);

  useEffect(() => { resetHud(); return () => clearTimeout(hudTimer.current); }, []); // eslint-disable-line

  const showToast = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    resetHud();
    if (playing) {
      el.pause(); setPlaying(false); recordSignal(item, "PAUSE");
    } else {
      if (!el.src && adaptedUrl) el.src = adaptedUrl;
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, item, resetHud, adaptedUrl]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    const el = videoRef.current;
    const next = !muted;
    if (el) el.muted = next;
    setMuted(next); setMutePref(next); resetHud();
  }, [muted, resetHud]);

  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const pct = el.currentTime / el.duration;
    if (pct >= 0.8 && !fullFired.current) {
      fullFired.current = true;
      recordSignal(item, "WATCH_COMPLETE");
      try { window.dispatchEvent(new CustomEvent("xv:discoveryInterest", { detail: { item, reason: "watch_complete" } })); } catch {}
    } else if (pct >= 0.4 && !halfFired.current) {
      halfFired.current = true;
      recordSignal(item, "WATCH_HALF");
    } else if (pct >= 0.15 && !quarterFired.current) {
      quarterFired.current = true;
      recordSignal(item, "WATCH_QUARTER");
    }
  }, [item]);

  const handleLike = useCallback((e) => {
    e.stopPropagation();
    const next = !liked; setLiked(next);
    if (next) {
      recordSignal(item, "LIKE");
      try { window.dispatchEvent(new CustomEvent("xv:discoveryInterest", { detail: { item, reason: "like" } })); } catch {}
    }
    resetHud();
  }, [liked, item, resetHud]);

  // [V4] Subscription-gated save
  const handleSave = useCallback((e) => {
    e.stopPropagation();
    resetHud();

    if (!canSave(currentUser)) {
      setShowUpgrade(true);
      setTimeout(() => setShowUpgrade(false), 3500);
      return;
    }

    const result = toggleSavedDiscovery(item, currentUser);
    if (result.error === "upgrade_required") {
      setShowUpgrade(true);
      setTimeout(() => setShowUpgrade(false), 3500);
      return;
    }

    setSaved(result.saved);
    if (result.saved) {
      recordSignal(item, "SAVE");
      showToast("Saved to your collection ✓", "#84cc16");
    } else {
      showToast("Removed from saved", "#6b7280");
    }
  }, [item, currentUser, resetHud, showToast]);

  // [V6] Share
  const handleShare = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "SHARE");
    const shareUrl  = item.videoUrl || item.thumbnailUrl || window.location.href;
    const shareData = { title: item.title, text: item.caption || item.title, url: shareUrl };
    if (navigator.share && navigator.canShare?.(shareData)) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareUrl).then(() => {
        showToast("Link copied!", "#0ea5e9");
      }).catch(() => {});
    }
    resetHud();
  }, [item, resetHud, showToast]);

  // [V7] Full screen
  const handleFullScreen = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "CLICK_THROUGH");
    onOpenFullScreen?.(item);
  }, [item, onOpenFullScreen]);

  const handleBadgeClick = useCallback((e) => {
    e.stopPropagation();
    onOpenDiscovery?.(item.category);
  }, [item, onOpenDiscovery]);

  const fmt = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n || "");

  return (
    <div
      className="dc-card"
      style={{ "--mood-accent": theme.accent }}
      onClick={togglePlay}
    >
      {/* LQIP blur-up */}
      {lqip && (
        <div className="dc-lqip" style={{ backgroundImage: `url(${lqip})` }} aria-hidden />
      )}

      {/* Media layer */}
      <div className="dc-media">
        <div className="dc-cat-bg" style={{ background: catGrad }} />

        {hasThumb && (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className={`dc-poster${posterOk ? " dc-poster--ready" : ""}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setPosterOk(true)}
          />
        )}

        {hasVideo && (
          <video
            ref={videoRef}
            muted={muted}
            playsInline
            autoPlay={isVisible}
            loop
            preload={isVisible ? "auto" : "metadata"}
            className={`dc-video${vidReady ? " dc-video--ready" : ""}`}
            onCanPlay={() => setVidReady(true)}
            onLoadedData={() => setVidReady(true)}
            onError={() => {
              const el = videoRef.current;
              if (el) {
                el.pause();
                el.removeAttribute("src");
                el.load();
              }
              showToast("Video failed to load, trying next clip", "#f97316");
            }}
            onTimeUpdate={onTimeUpdate}
            onSeeked={() => {
              if (videoRef.current?.currentTime < 1) recordSignal(item, "REPLAY");
            }}
          />
        )}

        {/* No thumb fallback shimmer */}
        {!hasThumb && <div className="dc-no-thumb-shimmer" />}

        <div className="dc-grad-top" />
        <div className="dc-grad-bot" />
        <div className="dc-mood-bar" style={{ background: `linear-gradient(180deg,${theme.accent},transparent)` }} />
      </div>

      {/* Category badge */}
      <div
        className="dc-badge"
        style={{ background: theme.accent }}
        onClick={handleBadgeClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && handleBadgeClick(e)}
      >
        <Compass size={9} />
        {item.category} · {theme.label}
      </div>

      {/* HUD (play/mute) */}
      <div className={`dc-hud${showHud ? " dc-hud--show" : ""}`} aria-hidden>
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

      {/* Caption */}
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
        {item.photographer && (
          <div className="dc-photographer">📽 {item.photographer}</div>
        )}
      </div>

      {/* Action rail */}
      <div className="dc-actions" onClick={e => e.stopPropagation()}>
        <button className={`dc-act${liked ? " dc-act--liked" : ""}`} onClick={handleLike} aria-label="Like">
          <Heart size={20} fill={liked ? "currentColor" : "none"} />
        </button>

        <button
          className={`dc-act${saved ? " dc-act--saved" : ""}${!canSave(currentUser) ? " dc-act--locked" : ""}`}
          onClick={handleSave}
          aria-label={saved ? "Saved" : canSave(currentUser) ? "Save" : "Save (upgrade required)"}
          title={saved ? "Tap to unsave" : canSave(currentUser) ? "Save to watch later" : "Silver+ required to save"}
        >
          {!canSave(currentUser)
            ? <Lock size={17} />
            : saved
              ? <BookmarkCheck size={19} />
              : <Bookmark size={19} fill="none" />}
        </button>

        <button className="dc-act" onClick={handleShare} aria-label="Share">
          <Share2 size={18} />
        </button>

        <button className="dc-act dc-act--expand" onClick={handleFullScreen} aria-label="Full screen">
          <Maximize2 size={16} />
        </button>

        {item.views ? (
          <div className="dc-views"><Eye size={12} />{fmt(item.views)}</div>
        ) : null}
      </div>

      {/* Toast */}
      {toast && (
        <div className="dc-toast" style={{ borderColor: toast.color, color: toast.color }}>
          {toast.msg}
        </div>
      )}

      {/* Upgrade nudge */}
      {showUpgrade && (
        <div className="dc-upgrade-nudge">
          <Lock size={14} />
          <span>Silver, Gold or Diamond plan required to save</span>
        </div>
      )}

      <style>{DC_CSS}</style>
    </div>
  );
});

DiscoveryCard.displayName = "DiscoveryCard";
export default DiscoveryCard;

// ─── Styles ───────────────────────────────────────────────────────────────────
const DC_CSS = `
.dc-card{
  position:relative;width:100%;border-radius:18px;overflow:hidden;
  background:transparent;margin:4px 0 10px;
  cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
  border:1px solid rgba(255,255,255,0.07);
  transition:border-color .2s;contain:layout;
}
.dc-card:hover{border-color:rgba(255,255,255,0.14);}

.dc-lqip{
  position:absolute;inset:0;
  background-size:cover;background-position:center;
  filter:blur(14px) saturate(0.4);transform:scale(1.05);
  z-index:0;pointer-events:none;
}
.dc-media{
  position:relative;width:100%;aspect-ratio:9/16;overflow:hidden;z-index:1;
}

.dc-cat-bg{position:absolute;inset:0;z-index:0;}
.dc-poster{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;display:block;opacity:0;
  transition:opacity .4s ease;z-index:1;
}
.dc-poster--ready{opacity:1;}
.dc-video{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;display:block;opacity:0;
  transition:opacity .35s ease;z-index:2;
}
.dc-video--ready{opacity:1;}

.dc-no-thumb-shimmer{
  position:absolute;inset:0;z-index:1;
  background:rgba(255,255,255,0.02);overflow:hidden;
}
.dc-no-thumb-shimmer::after{
  content:"";position:absolute;top:0;left:0;width:50%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);
  animation:dcShimmer 2s ease-in-out infinite;
}
@keyframes dcShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}

.dc-grad-top{
  position:absolute;inset:0;bottom:auto;height:35%;
  background:linear-gradient(to bottom,rgba(0,0,0,0.58),transparent);
  pointer-events:none;z-index:3;
}
.dc-grad-bot{
  position:absolute;inset:0;top:auto;height:70%;
  background:linear-gradient(to top,rgba(0,0,0,0.97),rgba(0,0,0,0.6) 45%,transparent);
  pointer-events:none;z-index:3;
}
.dc-mood-bar{
  position:absolute;left:0;top:0;bottom:0;width:3px;
  z-index:4;pointer-events:none;opacity:0.8;
}

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

.dc-hud{
  position:absolute;inset:0;z-index:6;
  display:flex;align-items:center;justify-content:center;
  pointer-events:none;opacity:0;transition:opacity .3s;
}
.dc-hud--show{opacity:1;}
.dc-hud>*{pointer-events:all;}

.dc-play-btn{
  width:64px;height:64px;border-radius:50%;
  background:rgba(0,0,0,0.55);border:2px solid rgba(255,255,255,0.32);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(10px);transition:transform .2s,background .2s;
}
.dc-play-btn:hover{background:rgba(0,0,0,0.78);transform:scale(1.08);}

.dc-mute{
  position:absolute;bottom:212px;right:14px;
  width:36px;height:36px;border-radius:50%;
  background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.18);
  color:rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);transition:background .15s;
}
.dc-mute:hover{background:rgba(0,0,0,0.8);}
@media(max-width:768px){.dc-mute{bottom:calc(9/16 * 100vw * 0.52);}}

.dc-caption-area{
  position:absolute;bottom:76px;left:0;right:56px;
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
  text-shadow:0 2px 12px rgba(0,0,0,0.92);
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
.dc-photographer{
  font-size:9px;color:rgba(255,255,255,0.25);margin-top:5px;
  font-weight:500;pointer-events:none;
}

.dc-actions{
  position:absolute;bottom:14px;right:12px;
  display:flex;flex-direction:column;align-items:center;gap:13px;z-index:6;
}
.dc-act{
  width:40px;height:40px;border-radius:50%;
  background:rgba(0,0,0,0.52);border:1px solid rgba(255,255,255,0.14);
  color:rgba(255,255,255,0.8);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);
  transition:all .18s;-webkit-tap-highlight-color:transparent;
}
.dc-act:hover{background:rgba(0,0,0,0.82);color:#fff;transform:scale(1.1);}
.dc-act--liked{color:#ef4444;border-color:rgba(239,68,68,0.44);}
.dc-act--saved{color:#84cc16;border-color:rgba(132,204,22,0.44);}
.dc-act--expand{color:rgba(255,255,255,0.4);}
.dc-act--locked{color:rgba(255,255,255,0.3);border-color:rgba(255,255,255,0.08);}
.dc-views{
  display:flex;align-items:center;gap:3px;
  font-size:9px;font-weight:700;
  color:rgba(255,255,255,0.35);margin-top:-6px;
}

.dc-toast{
  position:absolute;bottom:84px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,0.9);
  font-size:11px;font-weight:700;padding:7px 16px;
  border-radius:20px;z-index:10;pointer-events:none;
  border:1px solid currentColor;white-space:nowrap;
  animation:dcToastIn .22s ease;
}
@keyframes dcToastIn{
  from{opacity:0;transform:translateX(-50%) translateY(8px)}
  to{opacity:1;transform:translateX(-50%) translateY(0)}
}

.dc-upgrade-nudge{
  position:absolute;bottom:90px;left:50%;transform:translateX(-50%);
  background:rgba(15,15,15,0.96);
  border:1px solid rgba(251,191,36,0.5);
  color:#fbbf24;
  font-size:11px;font-weight:700;
  padding:8px 16px;border-radius:14px;
  z-index:10;pointer-events:none;white-space:nowrap;
  display:flex;align-items:center;gap:6px;
  animation:dcToastIn .22s ease;
}
`;