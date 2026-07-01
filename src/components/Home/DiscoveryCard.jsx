// src/components/Home/DiscoveryCard.jsx — v6 WORKING MEDIA + INTEREST CARDS
//
// FIXES in v6:
// ─────────────────────────────────────────────────────────────────────────────
// • Video loads with explicit src assignment on mount, not just on isVisible
// • Thumbnail always shows (no opacity:0 on initial render)
// • Error fallback — if video 404s, card stays beautiful with thumbnail
// • Video element uses crossOrigin="anonymous" for CDN compatibility
// ─────────────────────────────────────────────────────────────────────────────
//
// FEATURES:
// ─────────────────────────────────────────────────────────────────────────────
// [V1] Autoplay driven by isVisible prop (IntersectionObserver in parent)
// [V2] Adaptive video quality based on connection speed
// [V3] Thumbnail always visible — video fades in on top when ready
// [V4] Subscription-gated save (silver/gold/diamond only) with upgrade nudge
// [V5] Interest Card — shown after 4s of watching, or on fast scroll
//      "More like this" / "Show less" — feeds personalization model
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
  Lock, ThumbsUp, ThumbsDown, X as XIcon,
} from "lucide-react";
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";
import {
  isSavedDiscovery,
  toggleSavedDiscovery,
  CATEGORY_GRADIENTS,
} from "../../services/discovery/discoveryService";
import mediaUrlService from "../../services/shared/mediaUrlService";

export { CATEGORY_GRADIENTS };
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

// ─── Subscription tiers ───────────────────────────────────────────────────────
const SAVE_TIERS = new Set(["silver","gold","diamond"]);
function canSave(userProfile) {
  const t = userProfile?.subscription_tier || userProfile?.boost_tier || "free";
  return SAVE_TIERS.has(t);
}

// ─── Interest card trigger ────────────────────────────────────────────────────
// Show after 4 seconds of watching, or if user watches > 60%
const INTEREST_CARD_DELAY = 4000;
const INTEREST_CARD_WATCH_PCT = 0.6;

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
  const [muted,         setMuted]         = useState(getMutePref);
  const [playing,       setPlaying]       = useState(false);
  const [vidReady,      setVidReady]      = useState(false);
  const [vidError,      setVidError]      = useState(false);
  const [posterOk,      setPosterOk]      = useState(false);
  const [liked,         setLiked]         = useState(false);
  const [saved,         setSaved]         = useState(() => isSavedDiscovery(item.id));
  const [captionExp,    setCaptionExp]    = useState(false);
  const [showHud,       setShowHud]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [showUpgrade,   setShowUpgrade]   = useState(false);
  const [showInterest,  setShowInterest]  = useState(false);
  const [interestDone,  setInterestDone]  = useState(false);

  const videoRef      = useRef(null);
  const hudTimer      = useRef(null);
  const skipRef       = useRef(Date.now());
  const coolingRef    = useRef(null);
  const halfFired     = useRef(false);
  const fullFired     = useRef(false);
  const quarterFired  = useRef(false);
  const interestTimer = useRef(null);
  const watchStart    = useRef(null);
  const mountedRef    = useRef(true);

  const theme      = MOOD_THEME[item.mood] || DEFAULT_THEME;
  const catGrad    = CATEGORY_GRADIENTS[item.category] || "linear-gradient(170deg,#0a0a14,#1a1a2e)";
  const adaptedUrl = useMemo(() => adaptUrl(item.videoUrl), [item.videoUrl]);
  const hasThumb   = !!(item.thumbnailUrl && typeof item.thumbnailUrl === "string" && item.thumbnailUrl.trim());
  const hasVideo   = !!(adaptedUrl && adaptedUrl.length > 0) && !vidError;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!hasThumb) return;
    try {
      mediaUrlService.preloadMediaUrl(item.thumbnailUrl, { type: "image", priority: "high" });
    } catch {}
  }, [hasThumb, item.thumbnailUrl]);

  // Preload slot
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !adaptedUrl) return;
    if (_slots.active < _slots.max) {
      _slots.active++;
      el.preload = "metadata";
      // Assign src immediately so the browser can start fetching metadata
      if (!el.src || el.src !== adaptedUrl) {
        el.src = adaptedUrl;
      }
      return () => { _slots.active = Math.max(0, _slots.active - 1); };
    }
  }, []); // eslint-disable-line

  // [V1] Autoplay driven by isVisible
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !adaptedUrl || vidError) return;

    if (isVisible) {
      clearTimeout(coolingRef.current);
      watchStart.current = Date.now();

      // Ensure src is set
      if (!el.src || !el.src.includes(adaptedUrl.split("/").pop())) {
        el.src = adaptedUrl;
      }
      el.muted = muted;

      const tryPlay = () => {
        el.play()
          .then(() => { if (mountedRef.current) setPlaying(true); })
          .catch(() => {});
      };

      if (el.readyState >= 2) {
        tryPlay();
      } else {
        el.load();
        el.addEventListener("canplay", tryPlay, { once: true });
      }

      // Interest card timer
      if (!interestDone) {
        clearTimeout(interestTimer.current);
        interestTimer.current = setTimeout(() => {
          if (mountedRef.current && !interestDone) setShowInterest(true);
        }, INTEREST_CARD_DELAY);
      }
    } else {
      clearTimeout(interestTimer.current);
      setShowInterest(false);
      el.pause();
      setPlaying(false);

      // Record watch time as signal
      if (watchStart.current) {
        const elapsed = Date.now() - watchStart.current;
        if (elapsed < 1200) recordSignal(item, "SKIP");
        watchStart.current = null;
      }

      coolingRef.current = setTimeout(() => {
        if (!el.paused) return;
        el.removeAttribute("src");
        el.load();
        if (mountedRef.current) setVidReady(false);
      }, 900);
    }

    return () => {
      clearTimeout(coolingRef.current);
      clearTimeout(interestTimer.current);
    };
  }, [isVisible]); // eslint-disable-line

  const resetHud = useCallback(() => {
    setShowHud(true);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setShowHud(false), 3200);
  }, []);

  useEffect(() => {
    resetHud();
    return () => clearTimeout(hudTimer.current);
  }, []); // eslint-disable-line

  const showToast = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    const el = videoRef.current;
    if (!el || !hasVideo) return;
    resetHud();
    if (playing) {
      el.pause(); setPlaying(false); recordSignal(item, "PAUSE");
    } else {
      if (!el.src && adaptedUrl) { el.src = adaptedUrl; el.load(); }
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, item, resetHud, adaptedUrl, hasVideo]);

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

    // Show interest card at 60% watch
    if (pct >= INTEREST_CARD_WATCH_PCT && !interestDone && !showInterest) {
      setShowInterest(true);
    }

    if (pct >= 0.8 && !fullFired.current) {
      fullFired.current = true;
      recordSignal(item, "WATCH_COMPLETE");
    } else if (pct >= 0.4 && !halfFired.current) {
      halfFired.current = true;
      recordSignal(item, "WATCH_HALF");
    } else if (pct >= 0.15 && !quarterFired.current) {
      quarterFired.current = true;
      recordSignal(item, "WATCH_QUARTER");
    }
  }, [item, interestDone, showInterest]);

  const handleLike = useCallback((e) => {
    e.stopPropagation();
    const next = !liked; setLiked(next);
    if (next) recordSignal(item, "LIKE");
    resetHud();
  }, [liked, item, resetHud]);

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

  const handleFullScreen = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "CLICK_THROUGH");
    onOpenFullScreen?.(item);
  }, [item, onOpenFullScreen]);

  const handleBadgeClick = useCallback((e) => {
    e.stopPropagation();
    onOpenDiscovery?.(item.category);
  }, [item, onOpenDiscovery]);

  // Interest card handlers
  const handleMoreLikeThis = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "INTEREST");
    setShowInterest(false);
    setInterestDone(true);
    showToast("Got it — showing you more like this! 🔥", "#84cc16");
  }, [item, showToast]);

  const handleShowLess = useCallback((e) => {
    e.stopPropagation();
    recordSignal(item, "HIDE");
    setShowInterest(false);
    setInterestDone(true);
    showToast("Showing less of this", "#6b7280");
  }, [item, showToast]);

  const handleDismissInterest = useCallback((e) => {
    e.stopPropagation();
    setShowInterest(false);
    setInterestDone(true);
  }, []);

  const fmt = n => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n || "");

  return (
    <div
      className="dc-card"
      style={{ "--mood-accent": theme.accent }}
      onClick={togglePlay}
    >
      {/* Media layer */}
      <div className="dc-media">
        {/* Category gradient background — always visible */}
        <div className="dc-cat-bg" style={{ background: catGrad }} />

        {/* Thumbnail — ALWAYS visible until video is playing */}
        {hasThumb && (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className={`dc-poster${posterOk ? " dc-poster--ready" : " dc-poster--loading"}`}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            crossOrigin="anonymous"
            onLoad={() => setPosterOk(true)}
            onError={(e) => {
              // If Unsplash fails, show gradient
              e.currentTarget.style.display = "none";
            }}
          />
        )}

        {/* Video — fades in on top of thumbnail when ready */}
        {adaptedUrl && (
          <video
            ref={videoRef}
            muted={muted}
            playsInline
            loop
            preload="metadata"
            crossOrigin="anonymous"
            className={`dc-video${vidReady && playing ? " dc-video--ready" : ""}`}
            onCanPlay={() => { if (mountedRef.current) setVidReady(true); }}
            onTimeUpdate={onTimeUpdate}
            onError={() => {
              console.warn("[DiscoveryCard] Video error for:", adaptedUrl);
              if (mountedRef.current) setVidError(true);
            }}
            onSeeked={() => {
              if (videoRef.current?.currentTime < 1) recordSignal(item, "REPLAY");
            }}
          />
        )}

        {/* Gradient overlays */}
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
        {!playing && hasVideo && !vidError && (
          <div className="dc-play-btn">
            <Play size={26} fill="#fff" color="#fff" />
          </div>
        )}
        {hasVideo && !vidError && (
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

      {/* ── Interest Card ──────────────────────────────────────────────────── */}
      {showInterest && (
        <div className="dc-interest-card" onClick={e => e.stopPropagation()}>
          <button className="dc-interest-dismiss" onClick={handleDismissInterest} aria-label="Dismiss">
            <XIcon size={12} />
          </button>
          <div className="dc-interest-label">
            <Compass size={11} />
            <span>{item.category}</span>
          </div>
          <p className="dc-interest-q">How do you feel about this?</p>
          <div className="dc-interest-btns">
            <button className="dc-interest-yes" onClick={handleMoreLikeThis}>
              <ThumbsUp size={14} />
              <span>More like this</span>
            </button>
            <button className="dc-interest-no" onClick={handleShowLess}>
              <ThumbsDown size={14} />
              <span>Show less</span>
            </button>
          </div>
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

.dc-media{
  position:relative;width:100%;aspect-ratio:9/14;overflow:hidden;
  background:#0a0a10;
}
@media(max-width:768px){.dc-media{aspect-ratio:9/16;}}

.dc-cat-bg{
  position:absolute;inset:0;z-index:0;
}
.dc-poster{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;display:block;z-index:1;
  transition:opacity .35s ease;
}
.dc-poster--loading{opacity:0.5;}
.dc-poster--ready{opacity:1;}

.dc-video{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;display:block;opacity:0;
  transition:opacity .35s ease;z-index:2;
}
.dc-video--ready{opacity:1;}

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

/* ── Interest Card ─────────────────────────────────────────────────────────── */
.dc-interest-card{
  position:absolute;
  bottom:0;left:0;right:0;
  z-index:9;
  padding:14px 16px 18px;
  background:linear-gradient(to top,rgba(0,0,0,0.97) 0%,rgba(0,0,0,0.88) 70%,transparent 100%);
  backdrop-filter:blur(4px);
  animation:dcInterestIn .3s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes dcInterestIn{
  from{opacity:0;transform:translateY(16px)}
  to{opacity:1;transform:translateY(0)}
}
.dc-interest-dismiss{
  position:absolute;top:12px;right:12px;
  width:24px;height:24px;border-radius:50%;
  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
  color:rgba(255,255,255,0.4);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;
}
.dc-interest-label{
  display:inline-flex;align-items:center;gap:5px;
  font-size:9px;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;color:var(--mood-accent);
  margin-bottom:6px;
}
.dc-interest-q{
  font-size:14px;font-weight:700;color:#fff;
  margin:0 0 12px;line-height:1.3;
}
.dc-interest-btns{
  display:flex;gap:8px;
}
.dc-interest-yes,
.dc-interest-no{
  flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
  padding:9px 12px;border-radius:12px;
  font-size:12px;font-weight:700;
  cursor:pointer;transition:all .18s;font-family:inherit;
}
.dc-interest-yes{
  background:rgba(132,204,22,0.14);
  border:1px solid rgba(132,204,22,0.38);
  color:#a3e635;
}
.dc-interest-yes:hover{background:rgba(132,204,22,0.26);}
.dc-interest-no{
  background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.12);
  color:rgba(255,255,255,0.5);
}
.dc-interest-no:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);}
`;