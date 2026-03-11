// ============================================================================
// src/components/Home/FullScreenReels.jsx
// FIXES: toast removed, video object-fit:cover via inline styles
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { VolumeX, Volume2, X, MoreVertical } from "lucide-react";
import ReelProfilePreview from "../Shared/ReelProfilePreview";
import FullScreenReactionPanel from "../Shared/FullScreenReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ─── GLOBAL VIDEO STATE ──────────────────────────────────────────────────────
const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  currentlyVisibleVideo: null,
  listeners: new Set(),
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },
  notify() { this.listeners.forEach((cb) => cb()); },
  setGlobalPlayState(v) { this.globalPlayState = v; sessionStorage.setItem("reels_global_play_state", v.toString()); this.notify(); },
  getGlobalPlayState() { const s = sessionStorage.getItem("reels_global_play_state"); return s === null ? false : s === "true"; },
  setGlobalMuteState(v) { this.globalMuteState = v; sessionStorage.setItem("reels_global_muted", v.toString()); this.notify(); },
  getGlobalMuteState() { const s = sessionStorage.getItem("reels_global_muted"); return s === null ? true : s === "true"; },
  setCurrentlyVisibleVideo(id) { if (this.currentlyVisibleVideo !== id) { this.currentlyVisibleVideo = id; this.notify(); } },
  init() { this.globalPlayState = this.getGlobalPlayState(); this.globalMuteState = this.getGlobalMuteState(); },
};
GlobalVideoState.init();

// ─── FULL SCREEN REELS ───────────────────────────────────────────────────────
const FullScreenReels = ({
  reels = [],
  onClose,
  initialIndex = 0,
  currentUser,
  onAuthorClick,
  onSoundClick,
  onActionMenu,
}) => {
  const [currentIndex, setCurrentIndex]           = useState(initialIndex);
  const [muted, setMuted]                         = useState(GlobalVideoState.getGlobalMuteState());
  const [playing, setPlaying]                     = useState(false);
  const [showComments, setShowComments]           = useState(false);
  const [showShare, setShowShare]                 = useState(false);
  const [isLoading, setIsLoading]                 = useState(true);
  const [buffering, setBuffering]                 = useState(false);
  const [videoError, setVideoError]               = useState(false);
  const [showControls, setShowControls]           = useState(true);
  const [currentTime, setCurrentTime]             = useState(0);
  const [duration, setDuration]                   = useState(0);
  const [bufferedProgress, setBufferedProgress]   = useState(0);
  const [isDragging, setIsDragging]               = useState(false);
  const [isScrolling, setIsScrolling]             = useState(false);
  const [captionExpanded, setCaptionExpanded]     = useState(false);

  const videoRef          = useRef(null);
  const controlsTimeout   = useRef(null);
  const containerRef      = useRef(null);
  const scrollTimeout      = useRef(null);
  const touchStartY       = useRef(0);
  const progressBarRef    = useRef(null);
  const isTransitioning   = useRef(false);

  const currentReel = reels[currentIndex];

  const profile = currentReel ? {
    userId:   currentReel.user_id,
    author:   currentReel.profiles?.full_name || currentReel.author   || "Unknown",
    username: currentReel.profiles?.username  || currentReel.username  || "unknown",
    avatar:   currentReel.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(currentReel.profiles.avatar_id, 200)
      : null,
    verified: currentReel.profiles?.verified || currentReel.verified || false,
  } : null;

  const videoUrl = currentReel?.video_id
    ? mediaUrlService.getVideoUrl(currentReel.video_id, { quality: "auto", format: "mp4" })
    : null;

  const thumbnailUrl = currentReel?.thumbnail_id
    ? mediaUrlService.getVideoThumbnail(currentReel.thumbnail_id, { width: 640, height: 1138 })
    : null;

  // ── Global mute sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => setMuted(GlobalVideoState.globalMuteState));
    return unsub;
  }, []);

  // ── Broadcast open/close ─────────────────────────────────────────────────
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fullscreen-opened"));
    GlobalVideoState.setGlobalPlayState(true);
    return () => {
      window.dispatchEvent(new CustomEvent("fullscreen-closed"));
      GlobalVideoState.setGlobalPlayState(false);
    };
  }, []);

  // ── Controls auto-hide ───────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (playing) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  // ── Play / pause ─────────────────────────────────────────────────────────
  const playVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v || videoError || isTransitioning.current) return;
    v.play()
      .then(() => { setPlaying(true); setBuffering(false); resetControlsTimer(); })
      .catch((err) => { if (err.name !== "AbortError") setVideoError(true); setBuffering(false); });
  }, [videoError, resetControlsTimer]);

  const pauseVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current || videoError) return;
    const next = !playing;
    GlobalVideoState.setGlobalPlayState(next);
    next ? playVideo() : pauseVideo();
  }, [playing, videoError, playVideo, pauseVideo]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goToNext = useCallback(() => {
    if (currentIndex < reels.length - 1 && !isTransitioning.current) {
      isTransitioning.current = true;
      videoRef.current?.pause();
      setPlaying(false); setCurrentIndex(p => p + 1); setVideoError(false);
      setIsLoading(true); setBuffering(true); setCurrentTime(0);
      setDuration(0); setBufferedProgress(0); setCaptionExpanded(false);
      setTimeout(() => { isTransitioning.current = false; }, 100);
    }
  }, [currentIndex, reels.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning.current) {
      isTransitioning.current = true;
      videoRef.current?.pause();
      setPlaying(false); setCurrentIndex(p => p - 1); setVideoError(false);
      setIsLoading(true); setBuffering(true); setCurrentTime(0);
      setDuration(0); setBufferedProgress(0); setCaptionExpanded(false);
      setTimeout(() => { isTransitioning.current = false; }, 100);
    }
  }, [currentIndex]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (showComments || showShare) return;
    if (e.key === "Escape")     onClose();
    else if (e.key === " ")     { e.preventDefault(); togglePlay(); }
    else if (e.key === "m")     { const n = !muted; setMuted(n); GlobalVideoState.setGlobalMuteState(n); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); goToPrevious(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); goToNext(); }
  }, [onClose, togglePlay, showComments, showShare, muted, goToPrevious, goToNext]);

  // ── Wheel scroll ─────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (isScrolling) return;
    setIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    e.deltaY > 0 ? goToNext() : goToPrevious();
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 150);
  }, [isScrolling, goToNext, goToPrevious]);

  // ── Touch ────────────────────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    if (e.target.closest("button") || e.target.closest(".reel-left-info")) return;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (e.target.closest("button") || e.target.closest(".reel-left-info")) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 30) { diff > 0 ? goToNext() : goToPrevious(); }
  };

  // ── Progress ─────────────────────────────────────────────────────────────
  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };
  const handleProgressBarMouseDown = (e) => { e.stopPropagation(); setIsDragging(true); handleProgressBarClick(e); };
  const handleTimeUpdate = () => { if (videoRef.current && !isDragging) setCurrentTime(videoRef.current.currentTime); };
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false); setBuffering(false); setVideoError(false);
      if (GlobalVideoState.globalPlayState) playVideo();
    }
  };
  const handleProgress = () => {
    if (videoRef.current?.buffered.length > 0) {
      const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      if (videoRef.current.duration > 0)
        setBufferedProgress((end / videoRef.current.duration) * 100);
    }
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  // ── Video reload on index change ─────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = muted;
    setCurrentTime(0);
    setShowControls(true);
    v.load();
  }, [currentIndex, videoUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // ── Global drag listeners ────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (isDragging && progressBarRef.current && duration) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (videoRef.current) { videoRef.current.currentTime = pct * duration; setCurrentTime(pct * duration); }
      }
    };
    const onUp = () => { if (isDragging) setIsDragging(false); };
    if (isDragging) { document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); }
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [isDragging, duration]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const c = containerRef.current;
    if (c) c.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (c) c.removeEventListener("wheel", handleWheel);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (scrollTimeout.current)   clearTimeout(scrollTimeout.current);
    };
  }, [handleKeyDown, handleWheel]);

  const playedPct    = duration > 0 ? (currentTime / duration) * 100 : 0;
  const reelWithType = { ...currentReel, type: "reel" };
  const captionNeedsExpansion = currentReel?.caption && currentReel.caption.length > 60;

  if (!currentReel || !profile) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="fullscreen-reels-container"
        onMouseMove={resetControlsTimer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close button */}
        <button
          className={`fullscreen-close-btn${showControls ? " visible" : ""}`}
          onClick={onClose}
        >
          <X size={24} />
        </button>

        <div className="reel-slide">
          {videoUrl && !videoError ? (
            <>
              {/* ── INLINE STYLES guarantee object-fit:cover works.
                  position:absolute + inset:0 fills the container fully.
                  This is identical to how Instagram/Facebook display reels. ── */}
              <video
                ref={videoRef}
                src={videoUrl}
                poster={thumbnailUrl}
                loop
                playsInline
                muted={muted}
                preload="auto"
                style={{
                  position:       "absolute",
                  inset:          0,
                  width:          "100%",
                  height:         "100%",
                  objectFit:      "cover",      /* fills frame, no black bars */
                  objectPosition: "center",
                  display:        "block",
                  background:     "#000",
                  cursor:         "pointer",
                }}
                onClick={togglePlay}
                onLoadStart={() => setIsLoading(true)}
                onWaiting={() => setBuffering(true)}
                onCanPlay={() => setBuffering(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onProgress={handleProgress}
                onError={() => { setVideoError(true); setIsLoading(false); setBuffering(false); }}
                onEnded={() => setPlaying(false)}
              />

              {(isLoading || buffering) && (
                <div className="reel-loading">
                  <div className="spinner" />
                </div>
              )}

              {!playing && !buffering && !isLoading && (
                <div className="play-pause-overlay" onClick={togglePlay}>
                  <div className="play-icon-large">
                    <svg width="90" height="90" viewBox="0 0 100 100" fill="none">
                      <circle cx="50" cy="50" r="48" stroke="white" strokeWidth="3" opacity="0.9" />
                      <path d="M38 30L70 50L38 70V30Z" fill="white" />
                    </svg>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="reel-fallback">
              <div className="reel-fallback-letter">{profile.author?.charAt(0) || "R"}</div>
              {videoError && <div className="error-message">Video unavailable</div>}
            </div>
          )}

          {/* Progress + profile info */}
          <div className="reel-left-info">
            <div className="video-progress-container">
              <div
                ref={progressBarRef}
                className="video-progress-bar"
                onClick={handleProgressBarClick}
                onMouseDown={handleProgressBarMouseDown}
              >
                <div className="progress-buffered" style={{ width: `${bufferedProgress}%` }} />
                <div className="progress-played"   style={{ width: `${playedPct}%` }}>
                  <div className="progress-handle" />
                </div>
              </div>
              {!videoError && duration > 0 && (
                <div className="video-time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              )}
            </div>

            <ReelProfilePreview
              profile={profile}
              music={currentReel.music}
              onProfileClick={onAuthorClick}
              onMusicClick={(name) => onSoundClick?.(name, currentReel)}
              size="large"
            />

            {currentReel.caption && (
              <div
                className={`reel-caption-container${captionNeedsExpansion ? " has-more" : ""}`}
                onClick={captionNeedsExpansion ? (e) => { e.stopPropagation(); setCaptionExpanded(!captionExpanded); } : undefined}
              >
                <p className="reel-caption-text">
                  {captionExpanded ? currentReel.caption : currentReel.caption.substring(0, 60)}
                  {captionNeedsExpansion && !captionExpanded && (
                    <span className="caption-more">...more</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {captionExpanded && currentReel.caption && (
            <div className="reel-caption-expanded" onClick={() => setCaptionExpanded(false)}>
              <div className="caption-expanded-content"><p>{currentReel.caption}</p></div>
            </div>
          )}

          {/* Right actions */}
          <div className={`reel-right-actions${showControls ? " visible" : ""}`}>
            <FullScreenReactionPanel
              content={reelWithType}
              currentUser={currentUser}
              onComment={() => setShowComments(true)}
              onShare={() => setShowShare(true)}
            />
            <button
              className="action-menu-btn"
              onClick={(e) => onActionMenu?.(e, currentReel, currentReel.user_id === currentUser?.id)}
            >
              <MoreVertical size={28} color="#ffffff" />
            </button>
          </div>

          {/* Mute */}
          <button
            className={`fullscreen-mute-btn${showControls ? " visible" : ""}`}
            onClick={() => { const n = !muted; setMuted(n); GlobalVideoState.setGlobalMuteState(n); }}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {showComments && (
        <CommentModal
          content={{ ...currentReel, type: "reel" }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
        />
      )}
      {showShare && (
        <ShareModal
          content={{ ...currentReel, type: "reel" }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}

      <style jsx>{`
        .fullscreen-reels-container {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          max-width: 500px;
          height: 92vh;
          background: #000;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 12px;
        }

        .fullscreen-close-btn {
          position: absolute;
          top: 20px; right: 20px;
          z-index: 10001;
          background: rgba(0,0,0,0.7);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          opacity: 0; pointer-events: none;
        }
        .fullscreen-close-btn.visible { opacity: 1; pointer-events: all; }
        .fullscreen-close-btn:hover { background: rgba(0,0,0,0.9); transform: scale(1.05); }

        .reel-slide {
          position: relative;
          width: 100%; height: 100%;
          background: #000;
          overflow: hidden;
        }

        .reel-fallback {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #171717 0%, #0a0a0a 100%);
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 20px;
        }
        .reel-fallback-letter {
          width: 120px; height: 120px; border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 48px; font-weight: 800; color: #000;
        }
        .error-message { color: rgba(255,255,255,0.7); font-size: 16px; }

        .reel-loading {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%); z-index: 10;
        }
        .spinner {
          width: 50px; height: 50px;
          border: 4px solid rgba(132,204,22,0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .play-pause-overlay {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.3);
          cursor: pointer; z-index: 5;
        }
        .play-icon-large { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.05);opacity:1} }

        .reel-left-info {
          position: absolute; bottom: 4px; left: 4px; right: 90px;
          z-index: 10; display: flex; flex-direction: column; gap: 0;
          pointer-events: all;
        }

        .video-progress-container {
          display: flex; align-items: center; gap: 8px; width: 100%;
        }
        .video-progress-bar {
          flex: 1; height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px; cursor: pointer;
          position: relative; overflow: hidden;
        }
        .video-progress-bar:hover { height: 6px; }
        .progress-buffered {
          position: absolute; top: 0; left: 0; height: 100%;
          background: rgba(255,255,255,0.35);
          transition: width 0.3s ease; border-radius: 2px;
        }
        .progress-played {
          position: absolute; top: 0; left: 0; height: 100%;
          background: linear-gradient(90deg,#84cc16 0%,#65a30d 100%);
          transition: width 0.1s linear;
          display: flex; align-items: center; justify-content: flex-end;
          border-radius: 2px;
        }
        .progress-handle {
          width: 10px; height: 10px; background: #fff;
          border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          opacity: 0; transition: opacity 0.2s; transform: translateX(50%);
        }
        .video-progress-bar:hover .progress-handle { opacity: 1; }
        .video-time-display {
          background: rgba(0,0,0,0.7); color: white;
          padding: 3px 8px; border-radius: 6px;
          font-size: 10px; font-weight: 600;
          font-variant-numeric: tabular-nums;
          white-space: nowrap; flex-shrink: 0;
        }

        .reel-caption-container { cursor: default; margin-top: 4px; }
        .reel-caption-container.has-more { cursor: pointer; }
        .reel-caption-text {
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(10px);
          padding: 4px 10px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          color: white; font-size: 12px; line-height: 1.4;
          margin: 0; display: inline-block; max-width: 100%;
        }
        .caption-more {
          color: rgba(255,255,255,0.5); font-weight: 600;
          margin-left: 4px; transition: color 0.2s;
        }

        .reel-caption-expanded {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.85) 100%);
          backdrop-filter: blur(10px);
          padding: 16px; max-height: 60%; overflow-y: auto;
          z-index: 50; cursor: pointer;
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        .caption-expanded-content p { color: #e5e5e5; font-size: 14px; line-height: 1.5; margin: 0; }

        .reel-right-actions {
          position: absolute; right: 2%; bottom: 10px;
          display: flex; flex-direction: column; gap: 12px;
          z-index: 10; opacity: 0; pointer-events: none;
          align-items: center; justify-content: center;
          transition: opacity 0.3s;
        }
        .reel-right-actions.visible { opacity: 1; pointer-events: all; }

        .action-menu-btn {
          background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1); color: white;
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .action-menu-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.05); }

        .fullscreen-mute-btn {
          position: absolute; top: 20px; left: 20px; z-index: 10001;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1); color: white;
          width: 44px; height: 44px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s;
          opacity: 0; pointer-events: none;
        }
        .fullscreen-mute-btn.visible { opacity: 1; pointer-events: all; }
        .fullscreen-mute-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.05); }

        @media (max-width: 768px) {
          .fullscreen-reels-container {
            max-width: 100%; height: 100svh;
            border-radius: 0; top: 0; left: 0; transform: none;
          }
          .reel-left-info  { bottom: 12px; left: 12px; right: 70px; }
          .reel-right-actions { right: 12px; bottom: 12px; gap: 8px; }
          .fullscreen-close-btn { top: 16px; right: 16px; }
          .fullscreen-mute-btn  { top: 16px; left: 16px; width: 40px; height: 40px; }
        }
      `}</style>
    </>
  );
};

export default FullScreenReels;