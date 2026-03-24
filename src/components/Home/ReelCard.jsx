// ============================================================================
// src/components/Home/ReelCard.jsx
// Changes from original (structure UNCHANGED, precision additions only):
//  [1] isFollowing state + checkFollowStatus() on mount — mirrors UserProfileModal
//  [2] handleFollowToggle() — optimistic, mirrors UserProfileModal exactly
//  [3] Follow/Unfollow button + timestamp added in reel-bottom-content row
//  [4] Category tag pill rendered above reel-footer reactions
//  All video, progress, intersection observer logic — UNCHANGED
// ============================================================================

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { MoreVertical, VolumeX, Volume2, Play, Pause, UserPlus, UserCheck } from "lucide-react";
import ReelProfilePreview from "../Shared/ReelProfilePreview";
import ReactionPanel from "../Shared/ReactionPanel";
import CommentModal from "../Modals/CommentModal";
import ShareModal from "../Modals/ShareModal";
import ActionMenu from "../Shared/ActionMenu";
import ParsedText from "../Shared/ParsedText";
import mediaUrlService from "../../services/shared/mediaUrlService";
import followService from "../../services/social/followService"; // [1]

// ── relative timestamp ────────────────────────────────────────────────────────
const relTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ── Global video state (unchanged) ───────────────────────────────────────────
const GlobalVideoState = {
  globalPlayState: false,
  globalMuteState: true,
  currentlyVisibleVideo: null,
  listeners: new Set(),
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },
  notify() { this.listeners.forEach(cb => cb()); },
  setGlobalPlayState(v) { this.globalPlayState = v; sessionStorage.setItem("reels_global_play_state", v.toString()); this.notify(); },
  getGlobalPlayState() { const s = sessionStorage.getItem("reels_global_play_state"); return s === null ? false : s === "true"; },
  setGlobalMuteState(v) { this.globalMuteState = v; sessionStorage.setItem("reels_global_muted", v.toString()); this.notify(); },
  getGlobalMuteState() { const s = sessionStorage.getItem("reels_global_muted"); return s === null ? true : s === "true"; },
  setCurrentlyVisibleVideo(id) { if (this.currentlyVisibleVideo !== id) { this.currentlyVisibleVideo = id; this.notify(); } },
  init() { this.globalPlayState = this.getGlobalPlayState(); this.globalMuteState = this.getGlobalMuteState(); },
};
GlobalVideoState.init();

const ReelCard = ({
  reel, onProfileClick, onMusicClick, onActionMenu,
  currentUser, onOpenFullScreen, onHashtagClick, onMentionClick,
  onReelDelete, onReelUpdate, index,
}) => {
  const [muted,            setMuted]            = useState(GlobalVideoState.getGlobalMuteState());
  const [playing,          setPlaying]          = useState(false);
  const [isVisible,        setIsVisible]        = useState(false);
  const [showControls,     setShowControls]     = useState(false);
  const [videoError,       setVideoError]       = useState(false);
  const [isLoading,        setIsLoading]        = useState(true);
  const [currentTime,      setCurrentTime]      = useState(0);
  const [duration,         setDuration]         = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isDragging,       setIsDragging]       = useState(false);
  const [showComments,     setShowComments]     = useState(false);
  const [showShare,        setShowShare]        = useState(false);
  const [showActionMenu,   setShowActionMenu]   = useState(false);
  const [actionMenuPos,    setActionMenuPos]    = useState({ x: 0, y: 0 });
  const [videoAspectRatio, setVideoAspectRatio] = useState(9 / 16);
  const [captionExpanded,  setCaptionExpanded]  = useState(false);

  // [1] Follow state — mirrors UserProfileModal
  const [isFollowing, setIsFollowing] = useState(false);

  const videoRef           = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const containerRef       = useRef(null);
  const progressBarRef     = useRef(null);
  const observerRef        = useRef(null);
  const isTouching         = useRef(false);

  const isOwnReel = reel.user_id === currentUser?.id || reel.user_id === currentUser?.uid;

  const profile = {
    userId:   reel.user_id,
    author:   reel.profiles?.full_name  || reel.author   || "Unknown",
    username: reel.profiles?.username   || reel.username || "unknown",
    avatar:   reel.profiles?.avatar_id
      ? mediaUrlService.getAvatarUrl(reel.profiles.avatar_id, 200)
      : null,
    verified: reel.profiles?.verified || reel.verified || false,
  };

  const reelWithType = { ...reel, type: "reel" };
  const videoUrl     = reel.video_id ? mediaUrlService.getVideoUrl(reel.video_id, { quality: "auto", format: "mp4" }) : null;
  const thumbnailUrl = reel.thumbnail_id ? mediaUrlService.getVideoThumbnail(reel.thumbnail_id, { width: 640, height: 1138 }) : null;
  const captionNeedsExpansion = reel.caption && reel.caption.length > 60;

  // [1] Check follow on mount — mirrors UserProfileModal.checkFollowStatus()
  useEffect(() => {
    if (!currentUser?.id || isOwnReel) return;
    followService.isFollowing(currentUser.id, reel.user_id)
      .then(setIsFollowing)
      .catch(() => {});
  }, [reel.user_id, currentUser?.id, isOwnReel]);

  // [2] Follow toggle — mirrors UserProfileModal.handleFollowToggle()
  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      if (next) await followService.followUser(currentUser.id, reel.user_id);
      else      await followService.unfollowUser(currentUser.id, reel.user_id);
    } catch {
      setIsFollowing(!next);
    }
  };

  // ── Global video state ───────────────────────────────────────────────────
  useEffect(() => {
    const unsub = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      if (videoRef.current) {
        const shouldPlay = isVisible && GlobalVideoState.globalPlayState;
        if (shouldPlay && !playing)  { videoRef.current.play().catch(() => {}); setPlaying(true); }
        else if (!shouldPlay && playing) { videoRef.current.pause(); setPlaying(false); }
      }
    });
    return unsub;
  }, [isVisible, playing]);

  // ── Intersection observer ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.75;
        setIsVisible(visible);
        if (visible) {
          GlobalVideoState.setCurrentlyVisibleVideo(reel.id);
          if (GlobalVideoState.globalPlayState && videoRef.current && !playing) {
            videoRef.current.play().catch(() => {}); setPlaying(true);
          }
        } else if (videoRef.current && playing) {
          videoRef.current.pause(); setPlaying(false);
        }
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-10% 0px -10% 0px" });
    observerRef.current.observe(containerRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [reel.id, playing]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => { if (!isTouching.current) setShowControls(false); }, 3000);
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const next = !playing;
    GlobalVideoState.setGlobalPlayState(next);
    if (next) { videoRef.current.play().catch(() => { setVideoError(true); }); setPlaying(true); resetControlsTimer(); }
    else       { videoRef.current.pause(); setPlaying(false); setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }
  };

  const handleVideoClick = (e) => {
    if (e.target.closest("button") || e.target.closest(".reel-bottom-bar") || e.target.closest(".video-progress-container") || e.target.closest(".reel-caption-section")) return;
    if (onOpenFullScreen) { if (videoRef.current && playing) { videoRef.current.pause(); setPlaying(false); } onOpenFullScreen(index); }
  };

  const handleTouchStart = (e) => { if (e.target.closest(".reel-caption-section") || e.target.closest("button")) return; isTouching.current = true; resetControlsTimer(); };
  const handleTouchEnd   = () => { isTouching.current = false; };
  const handleMouseEnter = () => resetControlsTimer();
  const handleMouseMove  = () => resetControlsTimer();
  const handleMouseLeave = () => { isTouching.current = false; if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); setShowControls(false); };
  const handleMuteToggle = (e) => { e.stopPropagation(); const next = !muted; setMuted(next); GlobalVideoState.setGlobalMuteState(next); };

  const handleActionMenuBtn = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuPos({ x: rect.right, y: rect.bottom });
    setShowActionMenu(true);
    if (onActionMenu) onActionMenu(e, reelWithType, isOwnReel);
  };

  const handleDelete = async (reelId) => {
    try {
      const { default: reelService } = await import("../../services/home/reelService");
      if (reelService?.deleteReel) await reelService.deleteReel(reelId);
      if (onReelDelete) onReelDelete(reelId);
    } catch (err) { throw err; }
  };

  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
    setCurrentTime(videoRef.current.currentTime);
  };
  const handleProgressBarDrag = (e) => {
    e.stopPropagation();
    if (!isDragging || !videoRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(videoRef.current.currentTime);
  };
  const handleProgressBarMouseDown = (e) => { e.stopPropagation(); setIsDragging(true); handleProgressBarClick(e); };
  const handleTimeUpdate    = () => { if (videoRef.current && !isDragging) setCurrentTime(videoRef.current.currentTime); };
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration); setIsLoading(false); setVideoError(false);
      const { videoWidth: w, videoHeight: h } = videoRef.current;
      if (w && h) setVideoAspectRatio(w / h);
    }
  };
  const handleProgress = () => {
    if (videoRef.current?.buffered.length > 0) {
      const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      if (videoRef.current.duration > 0) setBufferedProgress((end / videoRef.current.duration) * 100);
    }
  };
  const formatTime = (s) => { if (!s || isNaN(s)) return "0:00"; return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`; };

  useEffect(() => { if (videoRef.current) videoRef.current.muted = GlobalVideoState.getGlobalMuteState(); }, []);

  useEffect(() => {
    const onMouseMove = (e) => { if (isDragging) handleProgressBarDrag(e); };
    const onMouseUp   = ()    => { if (isDragging) setIsDragging(false); };
    if (isDragging) { document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp); }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isDragging]);

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const getVideoFit = () => videoAspectRatio > (9 / 16) ? "cover" : "contain";

  return (
    <>
      <div className="reel-card">
        <div
          ref={containerRef}
          className="reel-video-container"
          onClick={handleVideoClick}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          onMouseEnter={handleMouseEnter} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
        >
          {videoUrl && !videoError ? (
            <>
              <video
                ref={videoRef}
                className="reel-video"
                src={videoUrl} poster={thumbnailUrl}
                loop playsInline muted={muted} preload="metadata"
                style={{ objectFit: getVideoFit() }}
                onLoadStart={() => setIsLoading(true)}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onProgress={handleProgress}
                onError={() => { setVideoError(true); setIsLoading(false); }}
                onEnded={() => setPlaying(false)}
              />
              {isLoading && <div className="reel-loading"><div className="spinner" /></div>}
            </>
          ) : (
            <div className="reel-placeholder">
              <div className="reel-placeholder-letter">{profile.author?.charAt(0) || "R"}</div>
              {videoError && <div className="reel-error-msg">Video unavailable</div>}
            </div>
          )}

          <div className={`reel-overlay ${showControls ? "visible" : ""}`}>
            {!videoError && (
              <button className="reel-play-btn" onClick={togglePlay}>
                {playing ? <Pause size={48} /> : <Play size={48} />}
              </button>
            )}
            <div className="reel-top-controls">
              {!videoError && (
                <button className="reel-mute-btn" onClick={handleMuteToggle}>
                  {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              )}
            </div>
          </div>

          <div className="reel-bottom-bar">
            <div className={`video-progress-container ${showControls ? "visible" : ""}`}>
              <div ref={progressBarRef} className="video-progress-bar" onClick={handleProgressBarClick} onMouseDown={handleProgressBarMouseDown}>
                <div className="progress-buffered" style={{ width: `${bufferedProgress}%` }} />
                <div className="progress-played"   style={{ width: `${playedPct}%` }}>
                  <div className="progress-handle" />
                </div>
              </div>
              {!videoError && duration > 0 && (
                <div className="video-time-display">{formatTime(currentTime)} / {formatTime(duration)}</div>
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

              {/* [3] Timestamp */}
              {reel.created_at && (
                <span className="reel-timestamp">{relTime(reel.created_at)}</span>
              )}

              {/* [3] Follow / Unfollow */}
              {!isOwnReel && currentUser?.id && (
                <button
                  className={`reel-follow-btn${isFollowing ? " following" : ""}`}
                  onClick={handleFollowToggle}
                >
                  {isFollowing
                    ? <><UserCheck size={13} /><span>Following</span></>
                    : <><UserPlus size={13} /><span>Follow</span></>
                  }
                </button>
              )}

              <button className="reel-menu-btn" onClick={handleActionMenuBtn} aria-label="Reel options">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>

          {captionExpanded && reel.caption && (
            <div className="reel-caption-expanded" onClick={() => setCaptionExpanded(false)}>
              <div className="caption-expanded-content">
                <ParsedText text={reel.caption} onHashtagClick={onHashtagClick} onMentionClick={onMentionClick} />
              </div>
            </div>
          )}
        </div>

        {reel.caption && (
          <div
            className={`reel-caption-section ${captionNeedsExpansion ? "has-more" : ""}`}
            onClick={captionNeedsExpansion ? () => setCaptionExpanded(!captionExpanded) : undefined}
          >
            <p className="reel-caption">
              <ParsedText text={captionExpanded ? reel.caption : reel.caption.substring(0, 60)} onHashtagClick={onHashtagClick} onMentionClick={onMentionClick} />
              {captionNeedsExpansion && !captionExpanded && <span className="caption-more">...more</span>}
            </p>
          </div>
        )}

        {/* [4] Category tag — above reactions */}
        {reel.category && (
          <div className="reel-category-tag">
            <span className="reel-cat-dot" />
            <span>{reel.category}</span>
          </div>
        )}

        <div className="reel-footer">
          <ReactionPanel
            content={reelWithType} currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal" compact={true}
          />
        </div>
      </div>

      {/* Styles for new elements only */}
      <style>{`
        .reel-timestamp {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .reel-follow-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
          white-space: nowrap;
          font-family: inherit;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff;
          backdrop-filter: blur(8px);
        }
        .reel-follow-btn:hover { background: rgba(132,204,22,0.2); border-color: rgba(132,204,22,0.5); color: #84cc16; }
        .reel-follow-btn.following {
          background: rgba(132,204,22,0.15);
          border-color: rgba(132,204,22,0.4);
          color: #84cc16;
        }
        .reel-follow-btn.following:hover {
          background: rgba(239,68,68,0.15);
          border-color: rgba(239,68,68,0.4);
          color: #ef4444;
        }
        .reel-category-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          border-radius: 999px;
          background: rgba(132,204,22,0.07);
          border: 1px solid rgba(132,204,22,0.18);
          margin: 4px 14px 8px;
          width: fit-content;
        }
        .reel-cat-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #84cc16;
          flex-shrink: 0;
        }
        .reel-category-tag span:last-child {
          font-size: 10.5px;
          font-weight: 700;
          color: rgba(132,204,22,0.8);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1;
        }
      `}</style>

      {showActionMenu && (
        <ActionMenu
          position={actionMenuPos} isOwnPost={isOwnReel}
          content={reelWithType} contentType="reel" currentUser={currentUser}
          onClose={() => setShowActionMenu(false)}
          onEdit={() => setShowActionMenu(false)}
          onShare={() => { setShowActionMenu(false); setShowShare(true); }}
          onDelete={handleDelete}
          onSave={() => {}} onReport={() => {}}
        />
      )}

      {showComments && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
          <CommentModal content={reelWithType} currentUser={currentUser} onClose={() => setShowComments(false)} isMobile={window.innerWidth <= 768} />
        </div>, document.body
      )}

      {showShare && ReactDOM.createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100002 }}>
          <ShareModal content={reelWithType} currentUser={currentUser} onClose={() => setShowShare(false)} />
        </div>, document.body
      )}
    </>
  );
};

export default ReelCard;