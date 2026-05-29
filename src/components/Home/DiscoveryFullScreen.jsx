// src/components/Home/DiscoveryFullScreen.jsx — v2 SUBSCRIPTION GATED SAVE
//
// Full-screen overlay for a single discovery clip.
// Features: autoplay, mute toggle, like, subscription-gated save, share,
//           swipe-to-navigate, keyboard nav, gradient background fallback.

import React, {
  useState, useRef, useEffect, useCallback,
} from "react";
import {
  X, Volume2, VolumeX, Heart, Bookmark, BookmarkCheck,
  Share2, Compass, ChevronLeft, ChevronRight, Lock,
} from "lucide-react";
import { recordSignal } from "../../services/discovery/discoveryPersonalizationModel";
import {
  CATEGORY_GRADIENTS,
  isSavedDiscovery,
  toggleSavedDiscovery,
} from "../../services/discovery/discoveryService";

const SAVE_TIERS = new Set(["silver","gold","diamond"]);
function canSave(userProfile) {
  const t = userProfile?.subscription_tier || userProfile?.boost_tier || "free";
  return SAVE_TIERS.has(t);
}

const DiscoveryFullScreen = ({
  item,
  onClose,
  onNext,
  onPrev,
  currentUser,
}) => {
  const [muted,        setMuted]        = useState(true);
  const [playing,      setPlaying]      = useState(false);
  const [ready,        setReady]        = useState(false);
  const [liked,        setLiked]        = useState(false);
  const [saved,        setSaved]        = useState(() => isSavedDiscovery(item.id));
  const [showControls, setShowControls] = useState(true);
  const [toast,        setToast]        = useState(null);
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [captionExp,   setCaptionExp]   = useState(false);

  const videoRef   = useRef(null);
  const ctrlTimer  = useRef(null);
  const touchStart = useRef(null);
  const touchY     = useRef(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Autoplay on mount
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !item.videoUrl) return;
    el.src   = item.videoUrl;
    el.muted = true;
    setMuted(true);
    const tryPlay = () => el.play().then(() => setPlaying(true)).catch(() => {});
    if (el.readyState >= 2) tryPlay();
    else el.addEventListener("canplay", tryPlay, { once: true });
  }, [item.videoUrl]);

  // Reset on item change
  useEffect(() => {
    setSaved(isSavedDiscovery(item.id));
    setLiked(false); setReady(false); setPlaying(false); setCaptionExp(false);
    const el = videoRef.current;
    if (!el) return;
    if (item.videoUrl) {
      el.src   = item.videoUrl;
      el.muted = muted;
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [item.id]); // eslint-disable-line

  const resetCtrl = useCallback(() => {
    setShowControls(true);
    clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => setShowControls(false), 3800);
  }, []);

  useEffect(() => { resetCtrl(); return () => clearTimeout(ctrlTimer.current); }, []); // eslint-disable-line

  const showToast = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    resetCtrl();
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  }, [playing, resetCtrl]);

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    const el = videoRef.current;
    const next = !muted;
    if (el) el.muted = next;
    setMuted(next); resetCtrl();
  }, [muted, resetCtrl]);

  const handleLike = useCallback((e) => {
    e.stopPropagation();
    const next = !liked; setLiked(next);
    if (next) recordSignal(item, "LIKE");
    resetCtrl();
  }, [liked, item, resetCtrl]);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    resetCtrl();

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
  }, [item, currentUser, resetCtrl, showToast]);

  const handleShare = useCallback((e) => {
    e.stopPropagation();
    const shareUrl  = item.videoUrl || item.thumbnailUrl || window.location.href;
    const shareData = { title: item.title, text: item.caption || "", url: shareUrl };
    if (navigator.share && navigator.canShare?.(shareData)) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareUrl).then(() => {
        showToast("Link copied!", "#0ea5e9");
      }).catch(() => {});
    }
    resetCtrl();
  }, [item, resetCtrl, showToast]);

  // Swipe navigation
  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    touchY.current     = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = touchStart.current - e.changedTouches[0].clientX;
    const dy = Math.abs((touchY.current || 0) - e.changedTouches[0].clientY);
    touchStart.current = null; touchY.current = null;
    if (dy > 80) return; // vertical swipe = scroll, ignore
    if (dx > 60 && onNext) onNext();
    if (dx < -60 && onPrev) onPrev();
  };

  // Keyboard nav
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && onNext) onNext();
      if (e.key === "ArrowLeft"  && onPrev) onPrev();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev, togglePlay]);

  const bgGrad  = CATEGORY_GRADIENTS[item.category] || "linear-gradient(170deg,#0a0a14,#1a1a2e)";
  const hasVideo = !!(item.videoUrl && item.videoUrl.trim());

  return (
    <div
      className="dfs-root"
      onClick={togglePlay}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background */}
      <div className="dfs-bg" style={{ background: bgGrad }} />

      {/* Thumbnail poster */}
      {item.thumbnailUrl && (
        <img
          src={item.thumbnailUrl}
          alt=""
          className={`dfs-poster${(!hasVideo || !playing) ? " dfs-poster--show" : ""}`}
        />
      )}

      {/* Video */}
      {hasVideo && (
        <video
          ref={videoRef}
          muted={muted}
          playsInline
          loop
          preload="auto"
          className={`dfs-video${ready ? " dfs-video--ready" : ""}`}
          onCanPlay={() => setReady(true)}
        />
      )}

      <div className="dfs-grad-top" />
      <div className="dfs-grad-bot" />

      {/* Top bar */}
      <div className={`dfs-top${showControls ? " show" : ""}`} onClick={e => e.stopPropagation()}>
        <button className="dfs-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="dfs-top-badge"><Compass size={11} />{item.category}</div>
        <button className="dfs-icon-btn" onClick={toggleMute} aria-label="Toggle mute">
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Prev/Next arrows (desktop) */}
      {onPrev && (
        <button className={`dfs-nav dfs-nav-l${showControls ? " show" : ""}`}
          onClick={e => { e.stopPropagation(); onPrev(); }} aria-label="Previous">
          <ChevronLeft size={24} />
        </button>
      )}
      {onNext && (
        <button className={`dfs-nav dfs-nav-r${showControls ? " show" : ""}`}
          onClick={e => { e.stopPropagation(); onNext(); }} aria-label="Next">
          <ChevronRight size={24} />
        </button>
      )}

      {/* Caption */}
      <div className="dfs-caption" onClick={e => e.stopPropagation()}>
        <div className="dfs-caption-cat">{item.category}</div>
        <h2 className="dfs-caption-title">{item.title}</h2>
        {item.caption && (
          <p
            className={`dfs-caption-text${captionExp ? " dfs-caption-text--exp" : ""}`}
            onClick={() => setCaptionExp(v => !v)}
          >
            {item.caption}
          </p>
        )}
      </div>

      {/* Action rail */}
      <div className="dfs-actions" onClick={e => e.stopPropagation()}>
        <button className={`dfs-act${liked ? " dfs-act--liked" : ""}`} onClick={handleLike}>
          <Heart size={24} fill={liked ? "currentColor" : "none"} />
        </button>

        <button
          className={`dfs-act${saved ? " dfs-act--saved" : ""}${!canSave(currentUser) ? " dfs-act--locked" : ""}`}
          onClick={handleSave}
          title={saved ? "Remove from saved" : canSave(currentUser) ? "Save to watch later" : "Silver+ required"}
        >
          {!canSave(currentUser)
            ? <Lock size={20} />
            : saved
              ? <BookmarkCheck size={22} />
              : <Bookmark size={22} />}
        </button>

        <button className="dfs-act" onClick={handleShare}><Share2 size={20} /></button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="dfs-toast" style={{ borderColor: toast.color, color: toast.color }}>
          {toast.msg}
        </div>
      )}

      {/* Upgrade nudge */}
      {showUpgrade && (
        <div className="dfs-upgrade">
          <Lock size={14} />
          <span>Silver, Gold or Diamond required to save clips</span>
        </div>
      )}

      <style>{DFS_CSS}</style>
    </div>
  );
};

export default DiscoveryFullScreen;

const DFS_CSS = `
.dfs-root{
  position:fixed;inset:0;z-index:9800;
  display:flex;align-items:center;justify-content:center;
  background:#000;cursor:pointer;overscroll-behavior:contain;
}
.dfs-bg{position:absolute;inset:0;z-index:0;}
.dfs-poster{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;z-index:1;opacity:0;transition:opacity .35s;
}
.dfs-poster--show{opacity:1;}
.dfs-video{
  position:absolute;inset:0;width:100%;height:100%;
  object-fit:contain;z-index:2;opacity:0;transition:opacity .3s;
}
.dfs-video--ready{opacity:1;}
@media(max-width:768px){.dfs-video{object-fit:cover;}}
.dfs-grad-top{
  position:absolute;top:0;left:0;right:0;height:30%;
  background:linear-gradient(to bottom,rgba(0,0,0,0.75),transparent);
  z-index:3;pointer-events:none;
}
.dfs-grad-bot{
  position:absolute;bottom:0;left:0;right:0;height:55%;
  background:linear-gradient(to top,rgba(0,0,0,0.95),rgba(0,0,0,0.5) 50%,transparent);
  z-index:3;pointer-events:none;
}
.dfs-top{
  position:absolute;top:0;left:0;right:0;z-index:6;
  display:flex;align-items:center;justify-content:space-between;
  padding:16px;
  opacity:0;transform:translateY(-8px);transition:opacity .25s,transform .25s;
  pointer-events:none;
}
.dfs-top.show{opacity:1;transform:translateY(0);pointer-events:all;}
.dfs-top-badge{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 12px;border-radius:20px;
  background:rgba(255,255,255,0.12);
  font-size:11px;font-weight:800;letter-spacing:.06em;
  color:rgba(255,255,255,0.9);text-transform:uppercase;
  border:1px solid rgba(255,255,255,0.16);
}
.dfs-icon-btn{
  width:40px;height:40px;border-radius:50%;
  background:rgba(0,0,0,0.52);border:1px solid rgba(255,255,255,0.15);
  color:#fff;display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);transition:background .15s,transform .15s;
}
.dfs-icon-btn:hover{background:rgba(0,0,0,0.82);transform:scale(1.08);}
.dfs-nav{
  position:absolute;top:50%;transform:translateY(-50%);
  z-index:6;cursor:pointer;
  width:48px;height:48px;border-radius:50%;
  background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);
  color:#fff;display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(8px);
  opacity:0;transition:opacity .25s;pointer-events:none;
}
.dfs-nav.show{opacity:1;pointer-events:all;}
.dfs-nav-l{left:16px;}
.dfs-nav-r{right:16px;}
.dfs-caption{
  position:absolute;bottom:88px;left:16px;right:82px;z-index:5;
}
.dfs-caption-cat{
  font-size:10px;font-weight:800;letter-spacing:.1em;
  text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:6px;
}
.dfs-caption-title{
  font-size:20px;font-weight:800;color:#fff;
  line-height:1.2;margin:0 0 8px;
  text-shadow:0 2px 16px rgba(0,0,0,0.92);
}
@media(max-width:768px){.dfs-caption-title{font-size:17px;}}
.dfs-caption-text{
  font-size:13px;color:rgba(255,255,255,0.72);line-height:1.55;margin:0;
  text-shadow:0 1px 8px rgba(0,0,0,0.92);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  cursor:pointer;
}
.dfs-caption-text--exp{-webkit-line-clamp:unset;overflow:visible;display:block;}
.dfs-actions{
  position:absolute;bottom:14px;right:14px;
  display:flex;flex-direction:column;align-items:center;gap:18px;z-index:6;
}
.dfs-act{
  width:46px;height:46px;border-radius:50%;
  background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.16);
  color:rgba(255,255,255,0.85);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;backdrop-filter:blur(8px);transition:all .18s;
}
.dfs-act:hover{background:rgba(0,0,0,0.84);color:#fff;transform:scale(1.1);}
.dfs-act--liked{color:#ef4444;border-color:rgba(239,68,68,0.44);}
.dfs-act--saved{color:#84cc16;border-color:rgba(132,204,22,0.44);}
.dfs-act--locked{color:rgba(255,255,255,0.3);border-color:rgba(255,255,255,0.08);}
.dfs-toast{
  position:absolute;bottom:120px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,0.92);
  font-size:12px;font-weight:700;padding:8px 18px;
  border-radius:20px;z-index:10;pointer-events:none;
  border:1px solid currentColor;white-space:nowrap;
  animation:dfsIn .2s ease;
}
@keyframes dfsIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.dfs-upgrade{
  position:absolute;bottom:130px;left:50%;transform:translateX(-50%);
  background:rgba(15,15,15,0.96);border:1px solid rgba(251,191,36,0.5);
  color:#fbbf24;font-size:11px;font-weight:700;
  padding:8px 16px;border-radius:14px;z-index:10;pointer-events:none;
  white-space:nowrap;display:flex;align-items:center;gap:6px;
  animation:dfsIn .2s ease;
}
`;