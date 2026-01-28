import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Music, VolumeX, Volume2, Play, Pause } from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import ReactionPanel from '../Shared/ReactionPanel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import ParsedText from '../Shared/ParsedText';
import mediaUrlService from '../../services/shared/mediaUrlService';

// ==================== GLOBAL VIDEO STATE MANAGER ====================
const GlobalVideoState = {
  globalPlayState: false, // Universal play/pause state for all videos
  globalMuteState: true,  // Universal mute/unmute state for all videos
  currentlyVisibleVideo: null, // Currently visible video ID
  listeners: new Set(),

  // Subscribe to state changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },

  // Notify all listeners of state change
  notify() {
    this.listeners.forEach(callback => callback());
  },

  // Set global play state - affects all videos
  setGlobalPlayState(shouldPlay) {
    this.globalPlayState = shouldPlay;
    sessionStorage.setItem('reels_global_play_state', shouldPlay.toString());
    this.notify();
  },

  getGlobalPlayState() {
    const saved = sessionStorage.getItem('reels_global_play_state');
    return saved === null ? false : saved === 'true';
  },

  // Set global mute state - affects all videos
  setGlobalMuteState(shouldMute) {
    this.globalMuteState = shouldMute;
    sessionStorage.setItem('reels_global_muted', shouldMute.toString());
    this.notify();
  },

  getGlobalMuteState() {
    const saved = sessionStorage.getItem('reels_global_muted');
    return saved === null ? true : saved === 'true';
  },

  // Set which video is currently visible on screen
  setCurrentlyVisibleVideo(videoId) {
    if (this.currentlyVisibleVideo !== videoId) {
      this.currentlyVisibleVideo = videoId;
      this.notify();
    }
  },

  // Initialize state from session storage
  init() {
    this.globalPlayState = this.getGlobalPlayState();
    this.globalMuteState = this.getGlobalMuteState();
  }
};

// Initialize on module load
GlobalVideoState.init();

const ReelCard = ({ 
  reel, 
  onAuthorClick, 
  onActionMenu, 
  currentUser, 
  onOpenFullScreen, 
  onSoundClick,
  onHashtagClick,
  onMentionClick,
  index 
}) => {
  const [muted, setMuted] = useState(GlobalVideoState.getGlobalMuteState());
  const [playing, setPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(9/16);
  
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);
  const observerRef = useRef(null);

  const profile = {
    userId: reel.user_id,
    author: reel.profiles?.full_name || reel.author || 'Unknown',
    username: reel.profiles?.username || reel.username || 'unknown',
    avatar: reel.profiles?.avatar_id 
      ? mediaUrlService.getAvatarUrl(reel.profiles.avatar_id, 200)
      : null,
    verified: reel.profiles?.verified || reel.verified || false
  };

  const reelWithType = {
    ...reel,
    type: 'reel'
  };

  const videoUrl = reel.video_id 
    ? mediaUrlService.getVideoUrl(reel.video_id, { quality: 'auto', format: 'mp4' })
    : null;
  
  const thumbnailUrl = reel.thumbnail_id 
    ? mediaUrlService.getVideoThumbnail(reel.thumbnail_id, { width: 640, height: 1138 })
    : null;

  // Subscribe to global state changes
  useEffect(() => {
    const unsubscribe = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
      
      // Handle play/pause based on visibility and global state
      if (videoRef.current) {
        const shouldPlay = isVisible && GlobalVideoState.globalPlayState;
        
        if (shouldPlay && !playing) {
          videoRef.current.play().catch(err => {
            console.error('Auto-play error:', err);
          });
          setPlaying(true);
        } else if (!shouldPlay && playing) {
          videoRef.current.pause();
          setPlaying(false);
        }
      }
    });

    return unsubscribe;
  }, [isVisible, playing]);

  // Intersection Observer to detect when video is visible
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting && entry.intersectionRatio >= 0.75;
          setIsVisible(visible);

          if (visible) {
            GlobalVideoState.setCurrentlyVisibleVideo(reel.id);
            
            // Auto-play if global play state is true
            if (GlobalVideoState.globalPlayState && videoRef.current && !playing) {
              videoRef.current.play().catch(err => {
                console.error('Auto-play on scroll:', err);
              });
              setPlaying(true);
            }
          } else {
            // Auto-pause when scrolled out of view
            if (videoRef.current && playing) {
              videoRef.current.pause();
              setPlaying(false);
            }
          }
        });
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-10% 0px -10% 0px'
      }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [reel.id, playing]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    
    const newPlayState = !playing;
    
    // Update global play state - affects all videos
    GlobalVideoState.setGlobalPlayState(newPlayState);
    
    if (newPlayState) {
      videoRef.current.play().catch(err => {
        console.error('Play error:', err);
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
    if (e.target.closest('button') || e.target.closest('.reel-info-overlay') || e.target.closest('.video-progress-bar')) {
      return;
    }
    
    if (onOpenFullScreen) {
      // Pause current video when opening fullscreen
      if (videoRef.current && playing) {
        videoRef.current.pause();
        setPlaying(false);
      }
      onOpenFullScreen(index);
    }
  };

  const handleMouseEnter = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  };

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const handleMouseLeave = () => {
    if (playing && !isDragging) {
      resetControlsTimer();
    }
  };

  const handleSoundClick = (e) => {
    e.stopPropagation();
    if (onSoundClick) {
      onSoundClick(reel.music || 'Original Audio', reel);
    }
  };

  const handleMuteToggle = (e) => {
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    GlobalVideoState.setGlobalMuteState(newMuted);
  };

  const handleActionMenu = (e) => {
    e.stopPropagation();
    if (onActionMenu) {
      onActionMenu(e, reelWithType, reel.user_id === currentUser?.id);
    }
  };

  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressBarDrag = (e) => {
    e.stopPropagation();
    if (!isDragging || !videoRef.current || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const dragX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, dragX / rect.width));
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressBarMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      setVideoError(false);
      
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      if (videoWidth && videoHeight) {
        setVideoAspectRatio(videoWidth / videoHeight);
      }
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const duration = videoRef.current.duration;
      if (duration > 0) {
        const progress = (bufferedEnd / duration) * 100;
        setBufferedProgress(progress);
      }
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = GlobalVideoState.getGlobalMuteState();
    }
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        handleProgressBarDrag(e);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isDragging]);

  const playedPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getVideoFitStyle = () => {
    const containerAspectRatio = 9 / 16;
    
    if (videoAspectRatio > containerAspectRatio) {
      return 'cover';
    } else {
      return 'contain';
    }
  };

  return (
    <>
      <div className="reel-card">
        <div 
          ref={containerRef}
          className="reel-video-container" 
          onClick={handleVideoClick}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
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

          {videoUrl && !videoError ? (
            <>
              <video
                ref={videoRef}
                className="reel-video"
                src={videoUrl}
                poster={thumbnailUrl}
                loop
                playsInline
                muted={muted}
                preload="metadata"
                style={{ objectFit: getVideoFitStyle() }}
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
                <div className="reel-loading">
                  <div className="spinner" />
                </div>
              )}
            </>
          ) : (
            <div className="reel-placeholder">
              <div className="reel-placeholder-letter">
                {profile.author?.charAt(0) || 'R'}
              </div>
              {videoError && <div className="reel-error-msg">Video unavailable</div>}
            </div>
          )}

          <div className={`reel-overlay ${showControls || !playing ? 'visible' : ''}`}>
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

          <div className="reel-info-overlay">
            <div className="reel-author-wrapper">
              <ProfilePreview 
                profile={profile}
                onClick={onAuthorClick}
                size="medium"
              />

              <button className="reel-music-info" onClick={handleSoundClick}>
                <Music size={14} />
                <span className="music-marquee">{reel.music || 'Original Audio'}</span>
              </button>
            </div>

            <button className="reel-menu-btn" onClick={handleActionMenu}>
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {reel.caption && (
          <div className="reel-caption-section">
            <p className="reel-caption">
              <ParsedText 
                text={reel.caption}
                onHashtagClick={onHashtagClick}
                onMentionClick={onMentionClick}
              />
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