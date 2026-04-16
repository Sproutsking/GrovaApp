// ============================================================================
// src/components/Home/ReelCard.jsx  — FULL REDESIGN
// Supa-smart, production-grade reel card for PC + Mobile
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  MoreVertical,
  VolumeX,
  Volume2,
  Play,
  Pause,
  UserPlus,
  UserCheck,
  Maximize2,
} from "lucide-react";
import ReelProfilePreview from "../Shared/ReelProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ActionMenu from "../Shared/ActionMenu";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";
import followService from "../../services/social/followService";

// ── Relative timestamp ────────────────────────────────────────────────────────
const relTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ── Global video state ────────────────────────────────────────────────────────
const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  currentlyVisibleVideo: null,
  listeners: new Set(),
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
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

// ── Category colors map ───────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  entertainment: {
    bg: "rgba(132,204,22,0.12)",
    border: "rgba(132,204,22,0.3)",
    dot: "#84cc16",
    text: "#a3e635",
  },
  music: {
    bg: "rgba(168,85,247,0.12)",
    border: "rgba(168,85,247,0.3)",
    dot: "#a855f7",
    text: "#c084fc",
  },
  sports: {
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.3)",
    dot: "#f97316",
    text: "#fb923c",
  },
  gaming: {
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.3)",
    dot: "#3b82f6",
    text: "#60a5fa",
  },
  news: {
    bg: "rgba(236,72,153,0.12)",
    border: "rgba(236,72,153,0.3)",
    dot: "#ec4899",
    text: "#f472b6",
  },
  comedy: {
    bg: "rgba(234,179,8,0.12)",
    border: "rgba(234,179,8,0.3)",
    dot: "#eab308",
    text: "#fbbf24",
  },
  education: {
    bg: "rgba(20,184,166,0.12)",
    border: "rgba(20,184,166,0.3)",
    dot: "#14b8a6",
    text: "#2dd4bf",
  },
  default: {
    bg: "rgba(132,204,22,0.12)",
    border: "rgba(132,204,22,0.3)",
    dot: "#84cc16",
    text: "#a3e635",
  },
};
const getCategoryStyle = (cat) =>
  CATEGORY_COLORS[(cat || "").toLowerCase()] || CATEGORY_COLORS.default;

// ── Main Component ────────────────────────────────────────────────────────────
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
  const [muted, setMuted] = useState(GlobalVideoState.getGlobalMuteState());
  const [playing, setPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState({ x: 0, y: 0 });
  const [videoAspectRatio, setVideoAspectRatio] = useState(9 / 16);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showFollowAnim, setShowFollowAnim] = useState(false);

  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const observerRef = useRef(null);
  const isTouching = useRef(false);

  const isOwnReel =
    reel.user_id === currentUser?.id || reel.user_id === currentUser?.uid;

  const profile = {
    userId: reel.user_id,
    author: reel.profiles?.full_name || reel.author || "Unknown",
    username: reel.profiles?.username || reel.username || "unknown",
    avatar: reel.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(reel.profiles.avatar_id, 200)
      : null,
    verified: reel.profiles?.verified || reel.verified || false,
  };

  const reelWithType = { ...reel, type: "reel" };
  const videoUrl = reel.video_id
    ? mediaUrlService.getVideoUrl(reel.video_id, {
        quality: "auto",
        format: "mp4",
      })
    : null;
  const thumbnailUrl = reel.thumbnail_id
    ? mediaUrlService.getVideoThumbnail(reel.thumbnail_id, {
        width: 640,
        height: 1138,
      })
    : null;
  const captionNeedsExpansion = reel.caption && reel.caption.length > 60;
  const catStyle = getCategoryStyle(reel.category);

  // Follow status
  useEffect(() => {
    if (!currentUser?.id || isOwnReel) return;
    followService
      .isFollowing(currentUser.id, reel.user_id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [reel.user_id, currentUser?.id, isOwnReel]);

  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    if (next) {
      setShowFollowAnim(true);
      setTimeout(() => setShowFollowAnim(false), 800);
    }
    try {
      if (next) await followService.followUser(currentUser.id, reel.user_id);
      else await followService.unfollowUser(currentUser.id, reel.user_id);
    } catch {
      setIsFollowing(!next);
    }
  };

  // Global video state subscription
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

  // Intersection observer
  useEffect(() => {
    if (!containerRef.current) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible =
            entry.isIntersecting && entry.intersectionRatio >= 0.75;
          setIsVisible(visible);
          if (visible) {
            GlobalVideoState.setCurrentlyVisibleVideo(reel.id);
            if (
              GlobalVideoState.globalPlayState &&
              videoRef.current &&
              !playing
            ) {
              videoRef.current.play().catch(() => {});
              setPlaying(true);
            }
          } else if (videoRef.current && playing) {
            videoRef.current.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-10% 0px -10% 0px" },
    );
    observerRef.current.observe(containerRef.current);
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [reel.id, playing]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isTouching.current) setShowControls(false);
    }, 3000);
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const next = !playing;
    GlobalVideoState.setGlobalPlayState(next);
    if (next) {
      videoRef.current.play().catch(() => {
        setVideoError(true);
      });
      setPlaying(true);
      resetControlsTimer();
    } else {
      videoRef.current.pause();
      setPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  };

  const handleVideoClick = (e) => {
    if (
      e.target.closest("button") ||
      e.target.closest(".xv-reel-bottom-bar") ||
      e.target.closest(".xv-progress-wrap") ||
      e.target.closest(".xv-caption-section")
    )
      return;
    if (onOpenFullScreen) {
      if (videoRef.current && playing) {
        videoRef.current.pause();
        setPlaying(false);
      }
      onOpenFullScreen(index);
    }
  };

  const handleTouchStart = (e) => {
    if (e.target.closest(".xv-caption-section") || e.target.closest("button"))
      return;
    isTouching.current = true;
    resetControlsTimer();
  };
  const handleTouchEnd = () => {
    isTouching.current = false;
  };
  const handleMouseEnter = () => {
    setIsHovered(true);
    resetControlsTimer();
  };
  const handleMouseMove = () => resetControlsTimer();
  const handleMouseLeave = () => {
    setIsHovered(false);
    isTouching.current = false;
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
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

  const handleDelete = async (reelId) => {
    try {
      const { default: reelService } =
        await import("../../services/home/reelService");
      if (reelService?.deleteReel) await reelService.deleteReel(reelId);
      if (onReelDelete) onReelDelete(reelId);
    } catch (err) {
      throw err;
    }
  };

  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    videoRef.current.currentTime =
      ((e.clientX - rect.left) / rect.width) * duration;
    setCurrentTime(videoRef.current.currentTime);
  };
  const handleProgressBarDrag = (e) => {
    e.stopPropagation();
    if (!isDragging || !videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(videoRef.current.currentTime);
  };
  const handleProgressBarMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    handleProgressBarClick(e);
  };
  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging)
      setCurrentTime(videoRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      setVideoError(false);
      const { videoWidth: w, videoHeight: h } = videoRef.current;
      if (w && h) setVideoAspectRatio(w / h);
    }
  };
  const handleProgress = () => {
    if (videoRef.current?.buffered.length > 0) {
      const end = videoRef.current.buffered.end(
        videoRef.current.buffered.length - 1,
      );
      if (videoRef.current.duration > 0)
        setBufferedProgress((end / videoRef.current.duration) * 100);
    }
  };
  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    if (videoRef.current)
      videoRef.current.muted = GlobalVideoState.getGlobalMuteState();
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging) handleProgressBarDrag(e);
    };
    const onMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isDragging]);

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const getVideoFit = () => (videoAspectRatio > 9 / 16 ? "cover" : "contain");

  return (
    <>
      <div className={`xv-reel-card${isHovered ? " hovered" : ""}`}>
        {/* ── VIDEO CONTAINER ─────────────────────────── */}
        <div
          ref={containerRef}
          className="xv-reel-video-wrap"
          onClick={handleVideoClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {videoUrl && !videoError ? (
            <>
              <video
                ref={videoRef}
                className="xv-reel-video"
                src={videoUrl}
                poster={thumbnailUrl}
                loop
                playsInline
                muted={muted}
                preload="metadata"
                style={{ objectFit: getVideoFit() }}
                onLoadStart={() => setIsLoading(true)}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onProgress={handleProgress}
                onError={() => {
                  setVideoError(true);
                  setIsLoading(false);
                }}
                onEnded={() => setPlaying(false)}
              />
              {isLoading && (
                <div className="xv-reel-loading">
                  <div className="xv-spinner" />
                </div>
              )}
            </>
          ) : (
            <div className="xv-reel-placeholder">
              <div className="xv-placeholder-letter">
                {profile.author?.charAt(0) || "R"}
              </div>
              {videoError && (
                <div className="xv-error-msg">Video unavailable</div>
              )}
            </div>
          )}

          {/* Cinematic gradient overlay */}
          <div className="xv-cinematic-overlay" />

          {/* Top controls */}
          <div className={`xv-top-controls${showControls ? " visible" : ""}`}>
            {!videoError && (
              <button
                className="xv-icon-btn"
                onClick={handleMuteToggle}
                aria-label="Toggle mute"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}
            {onOpenFullScreen && (
              <button
                className="xv-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current && playing) {
                    videoRef.current.pause();
                    setPlaying(false);
                  }
                  onOpenFullScreen(index);
                }}
                aria-label="Full screen"
              >
                <Maximize2 size={16} />
              </button>
            )}
          </div>

          {/* Centre play/pause */}
          {!videoError && (
            <div
              className={`xv-play-area${showControls ? " visible" : ""}`}
              onClick={togglePlay}
            >
              <div className="xv-play-ring">
                {playing ? <Pause size={26} /> : <Play size={26} />}
              </div>
            </div>
          )}

          {/* Bottom bar inside video */}
          <div className="xv-reel-bottom-bar">
            {/* Progress */}
            <div
              className={`xv-progress-wrap${showControls ? " visible" : ""}`}
            >
              <div
                ref={progressBarRef}
                className="xv-progress-track"
                onClick={handleProgressBarClick}
                onMouseDown={handleProgressBarMouseDown}
              >
                <div
                  className="xv-progress-buffered"
                  style={{ width: `${bufferedProgress}%` }}
                />
                <div
                  className="xv-progress-played"
                  style={{ width: `${playedPct}%` }}
                >
                  <div className="xv-progress-thumb" />
                </div>
              </div>
              {!videoError && duration > 0 && (
                <span className="xv-time-badge">
                  {formatTime(currentTime)}
                  <span className="xv-time-sep">/</span>
                  {formatTime(duration)}
                </span>
              )}
            </div>

            {/* Profile row */}
            <div className="xv-bottom-row">
              <div className="xv-profile-area">
                <ReelProfilePreview
                  profile={profile}
                  music={reel.music}
                  onProfileClick={onProfileClick}
                  onMusicClick={onMusicClick}
                  size="medium"
                />
              </div>

              <div className="xv-bottom-actions">
                {reel.created_at && (
                  <span className="xv-timestamp">
                    {relTime(reel.created_at)}
                  </span>
                )}

                {!isOwnReel && currentUser?.id && (
                  <button
                    className={`xv-follow-btn${isFollowing ? " following" : ""}${showFollowAnim ? " pop" : ""}`}
                    onClick={handleFollowToggle}
                    aria-label={isFollowing ? "Unfollow" : "Follow"}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck size={12} />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={12} />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  className="xv-icon-btn"
                  onClick={handleActionMenuBtn}
                  aria-label="Options"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Expanded caption overlay inside video */}
          {captionExpanded && reel.caption && (
            <div
              className="xv-caption-expanded-overlay"
              onClick={() => setCaptionExpanded(false)}
            >
              <div className="xv-caption-expanded-content">
                <ParsedText
                  text={reel.caption}
                  onHashtagClick={onHashtagClick}
                  onMentionClick={onMentionClick}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── CAPTION BELOW VIDEO ─────────────────────── */}
        {reel.caption && (
          <div
            className={`xv-caption-section${captionNeedsExpansion ? " expandable" : ""}`}
            onClick={
              captionNeedsExpansion
                ? () => setCaptionExpanded(!captionExpanded)
                : undefined
            }
          >
            <p className="xv-caption-text">
              <ParsedText
                text={
                  captionExpanded ? reel.caption : reel.caption.substring(0, 60)
                }
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
              {captionNeedsExpansion && !captionExpanded && (
                <span className="xv-caption-more"> ...more</span>
              )}
            </p>
          </div>
        )}

        {/* ── CATEGORY TAG ────────────────────────────── */}
        {reel.category && (
          <div
            className="xv-category-pill"
            style={{
              background: catStyle.bg,
              borderColor: catStyle.border,
            }}
          >
            <span
              className="xv-category-dot"
              style={{ background: catStyle.dot }}
            />
            <span
              className="xv-category-label"
              style={{ color: catStyle.text }}
            >
              {reel.category.toUpperCase()}
            </span>
          </div>
        )}

        {/* ── REACTIONS FOOTER ────────────────────────── */}
        <div className="xv-reel-footer">
          <ReactionPanel
            content={reelWithType}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
            compact={true}
          />
        </div>

        {/* Hover shimmer accent */}
        <div className="xv-card-accent" />
      </div>

      {/* ── PORTALS ─────────────────────────────────────── */}
      {showActionMenu && (
        <ActionMenu
          position={actionMenuPos}
          isOwnPost={isOwnReel}
          content={reelWithType}
          contentType="reel"
          currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={() => setShowActionMenu(false)}
          onShare={() => {
            setShowActionMenu(false);
            setShowShare(true);
          }}
          onDelete={handleDelete}
          onSave={() => {}}
          onReport={() => {}}
        />
      )}

      {showComments &&
        ReactDOM.createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
            <CommentModal
              content={reelWithType}
              currentUser={currentUser}
              onClose={() => setShowComments(false)}
              isMobile={window.innerWidth <= 768}
            />
          </div>,
          document.body,
        )}

      {showShare &&
        ReactDOM.createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
            <ShareModal
              content={reelWithType}
              currentUser={currentUser}
              onClose={() => setShowShare(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
};

export default ReelCard;
