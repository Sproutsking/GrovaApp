// ============================================================================
// src/components/Home/ReelCard.jsx
// FIXES: video fills container edge-to-edge (object-fit:cover, no black bars)
//        toast dependency removed entirely
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, VolumeX, Volume2, Play, Pause } from "lucide-react";
import ReelProfilePreview from "../Shared/ReelProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ActionMenu from "../Shared/ActionMenu";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ─── GLOBAL VIDEO STATE ──────────────────────────────────────────────────────
const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  currentlyVisibleVideo: null,
  listeners: new Set(),

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  notify() {
    this.listeners.forEach((cb) => cb());
  },
  setGlobalPlayState(v) {
    this.globalPlayState = v;
    sessionStorage.setItem("reels_global_play_state", v.toString());
    this.notify();
  },
  getGlobalPlayState() {
    const s = sessionStorage.getItem("reels_global_play_state");
    return s === null ? false : s === "true";
  },
  setGlobalMuteState(v) {
    this.globalMuteState = v;
    sessionStorage.setItem("reels_global_muted", v.toString());
    this.notify();
  },
  getGlobalMuteState() {
    const s = sessionStorage.getItem("reels_global_muted");
    return s === null ? true : s === "true";
  },
  setCurrentlyVisibleVideo(id) {
    if (this.currentlyVisibleVideo !== id) {
      this.currentlyVisibleVideo = id;
      this.notify();
    }
  },
  init() {
    this.globalPlayState = this.getGlobalPlayState();
    this.globalMuteState = this.getGlobalMuteState();
  },
};
GlobalVideoState.init();

// ─── REEL CARD ────────────────────────────────────────────────────────────────
const ReelCard = ({
  reel,
  onProfileClick,
  onMusicClick,
  onActionMenu,
  currentUser,
  onOpenFullScreen,
  onHashtagClick,
  onMentionClick,
  onReelDelete,
  onReelUpdate,
  index,
}) => {
  const [muted, setMuted]                       = useState(GlobalVideoState.getGlobalMuteState());
  const [playing, setPlaying]                   = useState(false);
  const [isVisible, setIsVisible]               = useState(false);
  const [showControls, setShowControls]         = useState(false);
  const [videoError, setVideoError]             = useState(false);
  const [isLoading, setIsLoading]               = useState(true);
  const [currentTime, setCurrentTime]           = useState(0);
  const [duration, setDuration]                 = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isDragging, setIsDragging]             = useState(false);
  const [showComments, setShowComments]         = useState(false);
  const [showShare, setShowShare]               = useState(false);
  const [showActionMenu, setShowActionMenu]     = useState(false);
  const [actionMenuPos, setActionMenuPos]       = useState({ x: 0, y: 0 });
  const [captionExpanded, setCaptionExpanded]   = useState(false);

  const videoRef          = useRef(null);
  const controlsTimeout   = useRef(null);
  const containerRef      = useRef(null);
  const progressBarRef    = useRef(null);
  const observerRef       = useRef(null);
  const isTouching        = useRef(false);

  const isOwnReel = reel.user_id === currentUser?.id || reel.user_id === currentUser?.uid;

  const profile = {
    userId:   reel.user_id,
    author:   reel.profiles?.full_name  || reel.author   || "Unknown",
    username: reel.profiles?.username   || reel.username  || "unknown",
    avatar:   reel.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(reel.profiles.avatar_id, 200)
      : null,
    verified: reel.profiles?.verified || reel.verified || false,
  };

  const reelWithType = { ...reel, type: "reel" };

  const videoUrl = reel.video_id
    ? mediaUrlService.getVideoUrl(reel.video_id, { quality: "auto", format: "mp4" })
    : null;

  const thumbnailUrl = reel.thumbnail_id
    ? mediaUrlService.getVideoThumbnail(reel.thumbnail_id, { width: 640, height: 1138 })
    : null;

  const captionNeedsExpansion = reel.caption && reel.caption.length > 60;

  // ── Global state sync ────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      if (videoRef.current) {
        const shouldPlay = isVisible && GlobalVideoState.globalPlayState;
        if (shouldPlay && !playing) {
          videoRef.current.play().catch(() => {});
          setPlaying(true);
        } else if (!shouldPlay && playing) {
          videoRef.current.pause();
          setPlaying(false);
        }
      }
    });
    return unsub;
  }, [isVisible, playing]);

  // ── Intersection observer ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.75;
          setIsVisible(visible);
          if (visible) {
            GlobalVideoState.setCurrentlyVisibleVideo(reel.id);
            if (GlobalVideoState.globalPlayState && videoRef.current && !playing) {
              videoRef.current.play().catch(() => {});
              setPlaying(true);
            }
          } else {
            if (videoRef.current && playing) {
              videoRef.current.pause();
              setPlaying(false);
            }
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-10% 0px -10% 0px" },
    );
    observerRef.current.observe(containerRef.current);
    return () => observerRef.current?.disconnect();
  }, [reel.id, playing]);

  // ── Controls timer ───────────────────────────────────────────────────────
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (!isTouching.current) setShowControls(false);
    }, 3000);
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const next = !playing;
    GlobalVideoState.setGlobalPlayState(next);
    if (next) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
      resetControlsTimer();
    } else {
      videoRef.current.pause();
      setPlaying(false);
      setShowControls(true);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    }
  };

  const handleVideoClick = (e) => {
    if (
      e.target.closest("button") ||
      e.target.closest(".reel-bottom-bar") ||
      e.target.closest(".video-progress-container") ||
      e.target.closest(".reel-caption-section")
    ) return;
    if (onOpenFullScreen) {
      if (videoRef.current && playing) { videoRef.current.pause(); setPlaying(false); }
      onOpenFullScreen(index);
    }
  };

  const handleTouchStart = (e) => {
    if (e.target.closest(".reel-caption-section") || e.target.closest("button")) return;
    isTouching.current = true;
    resetControlsTimer();
  };
  const handleTouchEnd   = () => { isTouching.current = false; };
  const handleMouseEnter = () => resetControlsTimer();
  const handleMouseMove  = () => resetControlsTimer();
  const handleMouseLeave = () => {
    isTouching.current = false;
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setShowControls(false);
  };

  const handleMuteToggle = (e) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    GlobalVideoState.setGlobalMuteState(next);
  };

  const handleActionMenuBtn = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuPos({ x: rect.right, y: rect.bottom });
    setShowActionMenu(true);
    if (onActionMenu) onActionMenu(e, reelWithType, isOwnReel);
  };

  const handleEdit   = () => { setShowActionMenu(false); };
  const handleShare  = () => { setShowActionMenu(false); setShowShare(true); };
  const handleSave   = async () => {};
  const handleReport = () => {};

  const handleDelete = async (reelId) => {
    try {
      const { default: reelService } = await import("../../services/home/reelService");
      if (reelService?.deleteReel) await reelService.deleteReel(reelId);
      if (onReelDelete) onReelDelete(reelId);
    } catch (err) {
      console.error("ReelCard: Delete failed:", err);
      throw err;
    }
  };

  const handleCaptionToggle = (e) => {
    e.stopPropagation();
    setCaptionExpanded(!captionExpanded);
  };

  // ── Progress bar ─────────────────────────────────────────────────────────
  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const handleProgressBarMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      setVideoError(false);
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

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = GlobalVideoState.getGlobalMuteState();
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => { if (isDragging && progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (videoRef.current) { videoRef.current.currentTime = pct * duration; setCurrentTime(pct * duration); }
    }};
    const onMouseUp  = () => { if (isDragging) setIsDragging(false); };
    if (isDragging) { document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp); }
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, [isDragging, duration]);

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="reel-card">
        <div
          ref={containerRef}
          className="reel-video-container"
          onClick={handleVideoClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {videoUrl && !videoError ? (
            <>
              {/* ── THE FIX: inline styles guarantee object-fit:cover
                  regardless of any CSS specificity conflicts.
                  position:absolute + inset:0 makes the video fill
                  the container completely, exactly like Instagram. ── */}
              <video
                ref={videoRef}
                src={videoUrl}
                poster={thumbnailUrl}
                loop
                playsInline
                muted={muted}
                preload="metadata"
                style={{
                  position:      "absolute",
                  inset:         0,
                  width:         "100%",
                  height:        "100%",
                  objectFit:     "cover",      /* fills frame, no black bars */
                  objectPosition:"center",     /* crop from center */
                  display:       "block",
                  background:    "#000",
                }}
                onLoadStart={() => setIsLoading(true)}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onProgress={handleProgress}
                onError={() => { setVideoError(true); setIsLoading(false); }}
                onEnded={() => setPlaying(false)}
                onClick={togglePlay}
              />

              {isLoading && (
                <div className="reel-loading">
                  <div className="spinner" />
                </div>
              )}
            </>
          ) : (
            <div className="reel-placeholder">
              <div className="reel-placeholder-letter">
                {profile.author?.charAt(0) || "R"}
              </div>
              {videoError && <div className="reel-error-msg">Video unavailable</div>}
            </div>
          )}

          {/* Controls overlay */}
          <div className={`reel-overlay${showControls ? " visible" : ""}`}>
            {!videoError && (
              <button className="reel-play-btn" onClick={togglePlay}>
                {playing ? <Pause size={44} /> : <Play size={44} />}
              </button>
            )}
            <div className="reel-top-controls">
              {!videoError && (
                <button className="reel-mute-btn" onClick={handleMuteToggle}>
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="reel-bottom-bar">
            <div className={`video-progress-container${showControls ? " visible" : ""}`}>
              <div
                ref={progressBarRef}
                className="video-progress-bar"
                onClick={handleProgressBarClick}
                onMouseDown={handleProgressBarMouseDown}
              >
                <div className="progress-buffered" style={{ width: `${bufferedProgress}%` }} />
                <div className="progress-played" style={{ width: `${playedPct}%` }}>
                  <div className="progress-handle" />
                </div>
              </div>
              {!videoError && duration > 0 && (
                <div className="video-time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              )}
            </div>

            <div className="reel-bottom-content">
              <ReelProfilePreview
                profile={profile}
                music={reel.music}
                onProfileClick={onProfileClick}
                onMusicClick={onMusicClick}
                size="medium"
              />
              <button className="reel-menu-btn" onClick={handleActionMenuBtn}>
                <MoreVertical size={20} />
              </button>
            </div>
          </div>

          {captionExpanded && reel.caption && (
            <div className="reel-caption-expanded" onClick={handleCaptionToggle}>
              <div className="caption-expanded-content">
                <ParsedText text={reel.caption} onHashtagClick={onHashtagClick} onMentionClick={onMentionClick} />
              </div>
            </div>
          )}
        </div>

        {reel.caption && (
          <div
            className={`reel-caption-section${captionNeedsExpansion ? " has-more" : ""}`}
            onClick={captionNeedsExpansion ? handleCaptionToggle : undefined}
          >
            <p className="reel-caption">
              <ParsedText
                text={captionExpanded ? reel.caption : reel.caption.substring(0, 60)}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
              {captionNeedsExpansion && !captionExpanded && (
                <span className="caption-more">...more</span>
              )}
            </p>
          </div>
        )}

        <div className="reel-footer">
          <ReactionPanel
            content={reelWithType}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
            compact={true}
          />
        </div>
      </div>

      {showActionMenu && (
        <ActionMenu
          position={actionMenuPos}
          isOwnPost={isOwnReel}
          content={reelWithType}
          contentType="reel"
          currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={handleEdit}
          onShare={handleShare}
          onDelete={handleDelete}
          onSave={handleSave}
          onReport={handleReport}
        />
      )}

      {showComments && (
        <CommentModal
          content={reelWithType}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={window.innerWidth <= 768}
        />
      )}

      {showShare && (
        <ShareModal
          content={reelWithType}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
};

export default ReelCard;