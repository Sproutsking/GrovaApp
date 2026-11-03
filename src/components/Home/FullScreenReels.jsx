import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { VolumeX, Volume2, X, MoreVertical } from "lucide-react";
import ReelProfilePreview from "../Shared/ReelProfilePreview";
import FullScreenReactionPanel from "../Shared/FullScreenReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import mediaUrlService from "../../services/shared/mediaUrlService";
import GlobalVideoState from "../../services/video/GlobalVideoState";

const FullScreenReels = ({
  reels = [],
  onClose,
  initialIndex = 0,
  currentUser,
  onAuthorClick,
  onSoundClick,
  onActionMenu,
  onProfileClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(GlobalVideoState.getGlobalMuteState());
  const [playing, setPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [portalRoot, setPortalRoot] = useState(null);

  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const touchTrackingRef = useRef(false);
  const progressBarRef = useRef(null);
  const videoRetryRef = useRef({ reelId: null, attempts: 0, timer: null });
  const isTransitioningRef = useRef(false);
  const transitionTimeoutRef = useRef(null);

  const currentReel = reels[currentIndex];

  const profile = currentReel
    ? {
        userId: currentReel.user_id,
        author: currentReel.profiles?.full_name || currentReel.author || "Unknown",
        username: currentReel.profiles?.username || currentReel.username || "unknown",
        createdAt: currentReel.created_at,
        avatar: currentReel.profiles?.avatar_id
          ? mediaUrlService.getAvatarUrl(currentReel.profiles.avatar_id, 200)
          : null,
        verified: currentReel.profiles?.verified || currentReel.verified || false,
      }
    : null;

  const videoUrl = currentReel?.video_id
    ? mediaUrlService.getVideoUrl(currentReel.video_id, { quality: "auto", format: "mp4" })
    : null;

  const thumbnailUrl = currentReel?.thumbnail_id
    ? mediaUrlService.getVideoThumbnail(currentReel.thumbnail_id, { width: 640, height: 1138 })
    : null;
  const previousReel = currentIndex > 0 ? reels[currentIndex - 1] : null;
  const nextReel = currentIndex < reels.length - 1 ? reels[currentIndex + 1] : null;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const allowNextVideoPreload = !connection?.saveData
    && !["slow-2g", "2g"].includes(connection?.effectiveType);
  const getReelVideoUrl = (reel) => reel?.video_id
    ? mediaUrlService.getVideoUrl(reel.video_id, { quality: "auto", format: "mp4" })
    : null;
  const nextVideoUrl = getReelVideoUrl(nextReel);

  const getNeighborThumbnail = (reel) => reel?.thumbnail_id
    ? mediaUrlService.getVideoThumbnail(reel.thumbnail_id, { width: 640, height: 1138 })
    : null;
  const previousThumbnailUrl = getNeighborThumbnail(previousReel);
  const nextThumbnailUrl = getNeighborThumbnail(nextReel);

  useEffect(() => {
    if (thumbnailUrl) {
      mediaUrlService.preloadMediaUrl(thumbnailUrl, { type: "image", priority: "high" });
    }
  }, [thumbnailUrl]);

  useEffect(() => {
    [previousThumbnailUrl, nextThumbnailUrl].forEach((url) => {
      if (url) mediaUrlService.preloadMediaUrl(url, { type: "image", priority: "high" });
    });
  }, [previousThumbnailUrl, nextThumbnailUrl]);

  useEffect(() => {
    const unsubscribe = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const previousPlayState = GlobalVideoState.getGlobalPlayState();
    const previousMuteState = GlobalVideoState.getGlobalMuteState();

    GlobalVideoState.setFullscreenOpen(true);
    GlobalVideoState.setGlobalMuteState(previousMuteState);
    window.dispatchEvent(new CustomEvent("fullscreen-opened"));

    // Lock body scroll during full-screen
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      window.dispatchEvent(new CustomEvent("fullscreen-closed"));
      GlobalVideoState.setFullscreenOpen(false);
      GlobalVideoState.setGlobalPlayState(previousPlayState);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const host = document.createElement("div");
    host.setAttribute("data-fullscreen-reels-portal", "true");
    const mountTarget = document.body || document.documentElement;
    if (!mountTarget) return undefined;
    mountTarget.appendChild(host);
    setPortalRoot(host);
    return () => {
      host.remove();
      setPortalRoot(null);
    };
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoError || isTransitioningRef.current) return;
    video.play()
      .then(() => { setPlaying(true); setBuffering(false); resetControlsTimer(); })
      .catch((err) => {
        console.error("Play error:", err);
        if (err.name !== "AbortError" && err.name !== "NotAllowedError") setVideoError(true);
        setBuffering(false);
      });
  }, [videoError, resetControlsTimer]);

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPlaying(false);
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current || videoError) return;
    const newPlayState = !playing;
    GlobalVideoState.setGlobalPlayState(newPlayState);
    if (newPlayState) playVideo(); else pauseVideo();
  }, [playing, videoError, playVideo, pauseVideo]);

  const updateSwipeOffset = useCallback((offset, duration = 0, easing = "cubic-bezier(0.22, 1, 0.36, 1)") => {
    const container = containerRef.current;
    if (!container) return;
    const transition = duration
      ? `transform ${duration}ms ${easing}`
      : "none";
    const slide = container.querySelector(".reel-slide");
    if (slide) {
      slide.style.transition = transition;
      slide.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
    container.querySelectorAll("[data-reel-neighbor]").forEach((neighbor) => {
      const direction = Number(neighbor.dataset.direction);
      neighbor.style.transition = transition;
      neighbor.style.transform = `translate3d(-50%, ${direction * container.clientHeight + offset}px, 0)`;
    });
  }, []);

  const finishSwipe = useCallback((direction, shouldAdvance) => {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.querySelector(".reel-slide");
    const neighbor = container.querySelector(`[data-reel-neighbor="${direction}"]`);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 140 : 360;
    const easing = shouldAdvance
      ? "cubic-bezier(0.22, 1, 0.36, 1)"
      : "cubic-bezier(0.2, 1.35, 0.35, 1)";

    isTransitioningRef.current = true;
    if (shouldAdvance) {
      if (videoRef.current) videoRef.current.pause();
      setPlaying(false);
      setVideoError(false);
      setIsLoading(true);
      setBuffering(true);
      setCurrentTime(0);
      setDuration(0);
      setBufferedProgress(0);
      setCaptionExpanded(false);

      const targetOffset = -direction * container.clientHeight;
      if (slide) {
        slide.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        slide.style.transform = `translate3d(0, ${targetOffset}px, 0)`;
      }
      if (neighbor) {
        neighbor.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        neighbor.style.transform = "translate3d(-50%, 0, 0)";
      }
    } else {
      updateSwipeOffset(0, duration, easing);
    }

    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      if (shouldAdvance) setCurrentIndex((index) => index + direction);
      updateSwipeOffset(0);
      isTransitioningRef.current = false;
    }, duration);
  }, [currentIndex, reels, updateSwipeOffset]);

  const transitionToReel = useCallback((direction) => {
    if (isTransitioningRef.current) return;
    const canAdvance = direction > 0 ? currentIndex < reels.length - 1 : currentIndex > 0;
    if (canAdvance) finishSwipe(direction, true);
  }, [currentIndex, reels.length, finishSwipe]);

  const goToNext = useCallback(() => transitionToReel(1), [transitionToReel]);
  const goToPrevious = useCallback(() => transitionToReel(-1), [transitionToReel]);

  const handleKeyDown = useCallback((e) => {
    if (showComments || showShare) return;
    if (e.key === "Escape") onClose();
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "m" || e.key === "M") {
      const newMuted = !muted;
      setMuted(newMuted);
      GlobalVideoState.setGlobalMuteState(newMuted);
    } else if (e.key === "ArrowUp") { e.preventDefault(); goToPrevious(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); goToNext(); }
  }, [onClose, togglePlay, showComments, showShare, muted, goToNext, goToPrevious]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (isScrolling || Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 18) return;
    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (e.deltaY > 0) goToNext(); else if (e.deltaY < 0) goToPrevious();
    scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
  }, [isScrolling, goToNext, goToPrevious]);

  const handleTouchStart = (e) => {
    if (showComments || showShare || e.target.closest("button") || e.target.closest(".reel-left-info")
      || e.target.closest(".reel-right-actions") || e.target.closest(".video-progress-container")) {
      touchTrackingRef.current = false;
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
    touchTrackingRef.current = true;
    updateSwipeOffset(0);
  };

  const handleTouchMove = (e) => {
    if (!touchTrackingRef.current || isTransitioningRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.15) return;

    const direction = deltaY < 0 ? 1 : -1;
    const canNavigate = direction > 0 ? Boolean(nextReel) : Boolean(previousReel);
    const height = containerRef.current?.clientHeight || window.innerHeight;
    const distance = Math.abs(deltaY);
    const resistedDelta = canNavigate
      ? deltaY
      : Math.sign(deltaY) * height * 0.42 * (1 - 1 / (distance * 0.55 / height + 1));
    updateSwipeOffset(resistedDelta);
  };

  const handleTouchEnd = (e) => {
    if (!touchTrackingRef.current) return;
    if (e.target.closest("button") || e.target.closest(".reel-left-info") || e.target.closest(".reel-right-actions")) {
      touchTrackingRef.current = false;
      updateSwipeOffset(0, 320);
      return;
    }

    const endY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - endY;
    const horizontalDiff = Math.abs(touchStartX.current - e.changedTouches[0].clientX);
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = Math.abs(diff) / elapsed;
    touchTrackingRef.current = false;
    if (Math.abs(diff) < 4 || Math.abs(diff) < horizontalDiff * 1.15) {
      updateSwipeOffset(0);
      return;
    }

    const direction = diff > 0 ? 1 : -1;
    const canAdvance = direction > 0 ? Boolean(nextReel) : Boolean(previousReel);
    const height = containerRef.current?.clientHeight || window.innerHeight;
    const shouldAdvance = canAdvance
      && (Math.abs(diff) > Math.min(140, height * 0.18) || (velocity > 0.62 && Math.abs(diff) > 36));
    finishSwipe(direction, shouldAdvance);
  };

  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const handleProgressBarDrag = useCallback((e) => {
    e.stopPropagation();
    if (!isDragging || !videoRef.current || !progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  }, [duration, isDragging]);

  const handleProgressBarMouseDown = (e) => {
    e.stopPropagation(); setIsDragging(true); handleProgressBarClick(e);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoError(false);
      videoRetryRef.current.attempts = 0;
      if (GlobalVideoState.globalPlayState) playVideo();
    }
  };

  const markVideoReady = (videoElement) => {
    if (videoElement && videoElement !== videoRef.current) videoElement.pause();
    if (videoElement === videoRef.current) {
      setIsLoading(false);
      setBuffering(false);
      setVideoError(false);
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      if (videoRef.current.duration > 0)
        setBufferedProgress((bufferedEnd / videoRef.current.duration) * 100);
    }
  };

  const handleWaiting = () => setBuffering(true);
  const handleCanPlay  = (e) => markVideoReady(e.currentTarget);
  const handleError    = (e) => {
    if (e.currentTarget.error?.code === 1) return;
    if (e.currentTarget.error?.code === 2 && videoRetryRef.current.attempts < 1) {
      videoRetryRef.current.attempts += 1;
      setIsLoading(true);
      setBuffering(true);
      videoRetryRef.current.timer = setTimeout(() => videoRef.current?.load(), 900);
      return;
    }
    console.error("Video error:", e);
    setVideoError(true); setIsLoading(false); setBuffering(false);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    clearTimeout(videoRetryRef.current.timer);
    videoRetryRef.current = { reelId: currentReel?.id, attempts: 0, timer: null };
    video.currentTime = 0;
    setCurrentTime(0); setShowControls(true);
    video.load();
  }, [currentIndex, videoUrl, currentReel?.id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const onMove = (e) => { if (isDragging) handleProgressBarDrag(e); };
    const onUp   = () => { if (isDragging) setIsDragging(false); };
    if (isDragging) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, handleProgressBarDrag]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const container = containerRef.current;
    if (container) container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (container) container.removeEventListener("wheel", handleWheel);
    };
  }, [handleKeyDown, handleWheel]);

  useEffect(() => () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    if (videoRetryRef.current.timer) clearTimeout(videoRetryRef.current.timer);
    isTransitioningRef.current = false;
  }, []);

  const playedPercentage      = duration > 0 ? (currentTime / duration) * 100 : 0;
  const reelWithType          = { ...currentReel, type: "reel" };
  const captionNeedsExpansion = currentReel?.caption && currentReel.caption.length > 60;
  const handleCaptionToggle   = (e) => { e.stopPropagation(); setCaptionExpanded(!captionExpanded); };

  if (!currentReel || !profile) return null;

  if (!portalRoot) return null;

  return ReactDOM.createPortal(
    <>
      <div
        ref={containerRef}
        className={`fullscreen-reels-container${showComments ? " with-comments" : ""}`}
        onMouseMove={() => resetControlsTimer()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          if (!touchTrackingRef.current) return;
          touchTrackingRef.current = false;
          finishSwipe(0, false);
        }}
      >
        <button className={`fullscreen-close-btn ${showControls ? "visible" : ""}`} onClick={onClose}>
          <X size={24} />
        </button>

        {[previousReel && { reel: previousReel, direction: -1 }, nextReel && { reel: nextReel, direction: 1 }]
          .filter(Boolean)
          .map(({ reel, direction }) => {
            const previewUrl = direction > 0 ? nextThumbnailUrl : previousThumbnailUrl;
            const previewVideoUrl = direction > 0 && allowNextVideoPreload ? nextVideoUrl : null;
            const author = reel.profiles?.full_name || reel.author || "Creator";
            return (
              <div
                key={`${reel.id || direction}-preview`}
                className={`reel-neighbor ${direction > 0 ? "reel-neighbor-next" : "reel-neighbor-previous"}`}
                data-reel-neighbor={direction}
                data-direction={direction}
                aria-hidden="true"
              >
                {previewUrl ? (
                  <img className="reel-neighbor-image" src={previewUrl} alt="" />
                ) : (
                  <div className="reel-neighbor-fallback">{author.charAt(0).toUpperCase()}</div>
                )}
                {previewVideoUrl && (
                  <video
                    className="reel-neighbor-video"
                    src={previewVideoUrl}
                    poster={previewUrl || undefined}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={(e) => markVideoReady(e.currentTarget)}
                    onCanPlay={(e) => markVideoReady(e.currentTarget)}
                  />
                )}
                <div className="reel-neighbor-shade" />
                <div className="reel-neighbor-label">
                  <span>{direction > 0 ? "UP NEXT" : "PREVIOUS REEL"}</span>
                  <strong>{author}</strong>
                  {reel.caption && <p>{reel.caption}</p>}
                </div>
              </div>
            );
          })}

        <div className="reel-slide">
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                data-reel-id={currentReel.id}
                className="reel-video"
                src={videoUrl}
                poster={thumbnailUrl}
                loop playsInline muted={muted} preload="auto"
                onClick={togglePlay}
                onLoadStart={() => {
                  setIsLoading(true);
                  setBuffering(true);
                  setVideoError(false);
                }}
                onWaiting={handleWaiting}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={(e) => markVideoReady(e.currentTarget)}
                onProgress={handleProgress}
                onError={handleError}
              />
              {videoError && <div className="reel-video-error">Video unavailable</div>}
              {isLoading && (
                <div className="reel-loading"><div className="spinner" /></div>
              )}
              {!playing && !buffering && !isLoading && (
                <div className="play-pause-overlay" onClick={togglePlay}>
                  <div className="play-icon-large">
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
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
              {currentReel.video_id && <div className="error-message">Video unavailable</div>}
            </div>
          )}

          <div className="video-progress-container">
            <div
              ref={progressBarRef}
              className="video-progress-bar"
              onClick={handleProgressBarClick}
              onMouseDown={handleProgressBarMouseDown}
            >
              <div className="progress-buffered" style={{ width: `${bufferedProgress}%` }} />
              <div className="progress-played" style={{ width: `${playedPercentage}%` }}>
                <div className="progress-handle" />
              </div>
            </div>
            {!videoError && duration > 0 && (
              <div className="video-time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            )}
          </div>

          <div className="reel-left-info">
            <ReelProfilePreview
              profile={profile}
              music={currentReel.music}
              onProfileClick={onAuthorClick}
              onMusicClick={(musicName) => onSoundClick?.(musicName, currentReel)}
              size="large"
            />

            {currentReel.caption && (
              <div
                className={`reel-caption-container ${captionNeedsExpansion ? "has-more" : ""}`}
                onClick={captionNeedsExpansion ? handleCaptionToggle : undefined}
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
            <div className="reel-caption-expanded" onClick={handleCaptionToggle}>
              <div className="caption-expanded-content">
                <p>{currentReel.caption}</p>
              </div>
            </div>
          )}

          <div className={`reel-right-actions ${showControls ? "visible" : ""}`}>
            <FullScreenReactionPanel
              content={reelWithType}
              currentUser={currentUser}
              onComment={() => setShowComments(true)}
              onShare={() => setShowShare(true)}
            />
            <button
              className="action-menu-btn"
              onClick={(e) => onActionMenu?.(e, currentReel, currentReel.user_id === currentUser?.id)}
              aria-label="More actions"
            >
              <MoreVertical size={22} color="#ffffff" />
            </button>
          </div>

          <button
            className={`fullscreen-mute-btn ${showControls ? "visible" : ""}`}
            onClick={() => { const n = !muted; setMuted(n); GlobalVideoState.setGlobalMuteState(n); }}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
        {showComments && (
          <div className="fullscreen-reels-comments">
          <CommentModal
            content={{ ...currentReel, type: "reel" }}
            currentUser={currentUser}
            onClose={() => setShowComments(false)}
            isMobile={window.innerWidth <= 768}
            embedded
            onProfileClick={onProfileClick}
          />
          </div>
        )}
      </div>
      {showShare && (
        <ShareModal content={{ ...currentReel, type: "reel" }} currentUser={currentUser} onClose={() => setShowShare(false)} />
      )}

      <style jsx>{`
        .fullscreen-reels-container {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          overscroll-behavior: contain;
          touch-action: none;
          top: 0 !important;
          left: 0 !important;
          width: 100vw;
          height: 100vh;
          box-sizing: border-box;
        }

        .fullscreen-reels-comments {
          position: absolute;
          z-index: 10002;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(390px, 38vw);
          display: flex;
          flex-direction: column;
          background: rgba(10, 10, 10, 0.97);
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: -24px 0 70px rgba(0, 0, 0, 0.45);
          animation: reelsCommentsIn 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .fullscreen-reels-container.with-comments { padding-right: min(390px, 38vw); }
        .fullscreen-reels-container.with-comments .reel-slide { max-width: 100%; }
        .fullscreen-reels-comments-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 58px;
          padding: 0 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: #f5f5f5;
        }
        .fullscreen-reels-comments-head button {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 8px;
          background: rgba(255,255,255,.06);
          color: #fff;
          cursor: pointer;
        }
        .fullscreen-reels-comments-body { min-height: 0; flex: 1; overflow: hidden; }
        @keyframes reelsCommentsIn { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
        @media (max-width: 768px) {
          .fullscreen-reels-container.with-comments { padding-right: 0; }
          .fullscreen-reels-comments {
            top: auto;
            left: 0;
            right: 0;
            width: 100%;
            min-width: 0;
            height: min(78vh, 650px);
            border-top: 1px solid rgba(255,255,255,.15);
            border-left: 0;
            border-radius: 18px 18px 0 0;
            animation-name: reelsCommentsUp;
          }
          @keyframes reelsCommentsUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        }

        .fullscreen-close-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10001;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          opacity: 0;
          pointer-events: none;
        }

        .fullscreen-close-btn.visible { 
          opacity: 1; 
          pointer-events: all; 
        }
        
        .fullscreen-close-btn:hover { 
          background: rgba(0,0,0,0.9); 
          transform: scale(1.05);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .reel-slide {
          width: min(100%, 1100px);
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          max-width: 100vw;
          max-height: 100vh;
          transform: translate3d(0, 0, 0);
          will-change: transform;
          z-index: 1;
        }

        .reel-neighbor {
          position: absolute;
          top: 0;
          left: 50%;
          width: min(100%, 1100px);
          height: 100%;
          overflow: hidden;
          background: #080808;
          pointer-events: none;
          will-change: transform;
          z-index: 0;
        }

        .reel-neighbor-next { transform: translate3d(-50%, 100%, 0); }
        .reel-neighbor-previous { transform: translate3d(-50%, -100%, 0); }

        .reel-neighbor-image,
        .reel-neighbor-fallback {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }

        .reel-neighbor-image {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .reel-neighbor-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
          z-index: 2;
        }

        .reel-neighbor-fallback {
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 50% 42%, rgba(132,204,22,.24), #080808 58%);
          color: #a3e635;
          font-size: 64px;
          font-weight: 800;
        }

        .reel-neighbor-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,.2), transparent 30%, rgba(0,0,0,.78));
          z-index: 3;
        }

        .reel-neighbor-label {
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: max(72px, calc(env(safe-area-inset-bottom) + 56px));
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #fff;
          text-shadow: 0 1px 12px rgba(0,0,0,.65);
          z-index: 4;
        }

        .reel-neighbor-label span {
          color: #c4f277;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .14em;
        }

        .reel-neighbor-label strong { font-size: 19px; font-weight: 750; }
        .reel-neighbor-label p {
          max-width: 420px;
          margin: 0;
          color: rgba(255,255,255,.82);
          font-size: 14px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .reel-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          cursor: pointer;
          background: #000;
          display: block;
        }

        .reel-fallback {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #171717 0%, #0a0a0a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 20px;
        }

        .reel-fallback-letter {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: calc((48px) + 1px);
          font-weight: 800;
          color: #000;
        }

        .error-message { color: rgba(255,255,255,0.7); font-size: calc((16px) + 1px); }

        .reel-video-error {
          position: absolute;
          inset: 0;
          z-index: 12;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0,0,0,.42);
          color: rgba(255,255,255,.82);
          font-size: 15px;
          font-weight: 600;
          text-align: center;
        }

        .reel-loading {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
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

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%       { transform: scale(1.05); opacity: 1; }
        }

        .reel-left-info {
          position: absolute;
          bottom: 72px; left: 16px; right: 104px;
          z-index: 10;
          pointer-events: all;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .video-progress-container {
          position: absolute; left: 16px; right: 16px;
          bottom: max(48px, env(safe-area-inset-bottom));
          display: flex; align-items: center; gap: 8px; width: auto;
        }

        .video-progress-bar {
          flex: 1; height: 5px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px; cursor: pointer;
          transition: height 0.2s ease;
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
          background: #fff;
          transition: width 0.1s linear;
          display: flex; align-items: center; justify-content: flex-end;
          border-radius: 2px;
        }

        .progress-handle {
          width: 10px; height: 10px;
          background: #fff; border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          opacity: 0; transition: opacity 0.2s ease;
          transform: translateX(50%);
        }

        .video-progress-bar:hover .progress-handle { opacity: 1; }

        .video-time-display {
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(10px);
          color: white; padding: 3px 8px; border-radius: 6px;
          font-size: calc((10px) + 1px); font-weight: 600;
          font-variant-numeric: tabular-nums;
          white-space: nowrap; flex-shrink: 0;
        }

        .reel-caption-container { cursor: default; margin-top: 4px; }
        .reel-caption-container.has-more { cursor: pointer; }
        .reel-caption-container.has-more:hover .caption-more { color: #84cc16; }

        .reel-caption-text {
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(10px);
          padding: 4px 10px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          color: white; font-size: calc((12px) + 1px); line-height: 1.4;
          margin: 0; display: inline-block; max-width: 100%;
        }

        .caption-more {
          color: rgba(255,255,255,0.5); font-weight: 600;
          margin-left: 4px; transition: color 0.2s;
        }

        .reel-caption-expanded {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%);
          backdrop-filter: blur(10px);
          padding: 16px; max-height: 60%; overflow-y: auto;
          z-index: 50; cursor: pointer;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        .caption-expanded-content p { color: #e5e5e5; font-size: calc((14px) + 1px); line-height: 1.5; margin: 0; }

        .reel-right-actions {
          position: absolute; right: 16px; bottom: 104px;
          display: flex; flex-direction: column; gap: 12px;
          z-index: 10; transition: all 0.3s;
          opacity: 0; pointer-events: none;
          align-items: center; justify-content: center;
        }

        .reel-right-actions.visible { opacity: 1; pointer-events: all; }

        .action-menu-btn {
          position: relative; right: auto; bottom: auto; align-self: center;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          color: white; width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }

        .action-menu-btn svg { transform: rotate(90deg); }

        .action-menu-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.05); }
        .action-menu-btn svg { width: 24px; height: 24px; }

        .fullscreen-mute-btn {
          position: absolute; top: 20px; left: 20px;
          z-index: 10001;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          color: white; width: 44px; height: 44px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s;
          opacity: 0; pointer-events: none;
        }

        .fullscreen-mute-btn.visible { opacity: 1; pointer-events: all; }
        .fullscreen-mute-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.05); }

        @media (max-width: 768px) {
          .fullscreen-reels-container {
            inset: 0;
            width: 100%;
            height: 100%;
            border-radius: 0;
            padding: 0;
          }

          .reel-left-info { bottom: 72px; left: 12px; right: 72px; }
          .video-progress-container { left: 12px; right: 12px; bottom: max(48px, env(safe-area-inset-bottom)); }
          .reel-caption-text { font-size: calc((12px) + 1px); padding: 5px 8px; }
          .caption-expanded-content p { font-size: calc((13px) + 1px); }
          .reel-right-actions { right: 12px; bottom: 104px; gap: 8px; }
          .action-menu-btn { width: 44px; height: 44px; }
          .action-menu-btn svg { width: 22px; height: 22px; }
          .fullscreen-close-btn { top: 16px; right: 16px; width: 40px; height: 40px; }
          .fullscreen-mute-btn  { top: 16px; left: 16px;  width: 40px; height: 40px; }
        }

        @media (max-width: 480px) {
          .reel-left-info { bottom: 68px; left: 10px; right: 64px; }
          .video-progress-container { left: 10px; right: 10px; bottom: max(44px, env(safe-area-inset-bottom)); }
          .reel-caption-text { font-size: calc((11px) + 1px); padding: 4px 6px; }
          .action-menu-btn { width: 40px; height: 40px; }
          .reel-right-actions { right: 10px; bottom: 96px; gap: 6px; }
          .fullscreen-close-btn { top: 12px; right: 12px; width: 36px; height: 36px; font-size: calc((18px) + 1px); }
          .fullscreen-mute-btn  { top: 12px; left: 12px;  width: 36px; height: 36px; font-size: calc((16px) + 1px); }
        }

        /* Ensure no scrollbar shows */
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  , portalRoot);
};

export default FullScreenReels;