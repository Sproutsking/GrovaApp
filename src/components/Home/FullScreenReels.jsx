import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Heart, MessageCircle, Share2, Bookmark, Music, 
  VolumeX, Volume2, X, MoreVertical
} from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import LikeModel from '../../models/LikeModel';
import SaveModel from '../../models/SaveModel';
import mediaUrlService from '../../services/shared/mediaUrlService';
import { useToast } from '../../contexts/ToastContext';

// Global Video State Manager
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
    this.listeners.forEach(callback => callback());
  },

  setGlobalPlayState(shouldPlay) {
    this.globalPlayState = shouldPlay;
    sessionStorage.setItem('reels_global_play_state', shouldPlay.toString());
    this.notify();
  },

  getGlobalPlayState() {
    const saved = sessionStorage.getItem('reels_global_play_state');
    return saved === null ? false : saved === 'true';
  },

  setGlobalMuteState(shouldMute) {
    this.globalMuteState = shouldMute;
    sessionStorage.setItem('reels_global_muted', shouldMute.toString());
    this.notify();
  },

  getGlobalMuteState() {
    const saved = sessionStorage.getItem('reels_global_muted');
    return saved === null ? true : saved === 'true';
  },

  setCurrentlyVisibleVideo(videoId) {
    if (this.currentlyVisibleVideo !== videoId) {
      this.currentlyVisibleVideo = videoId;
      this.notify();
    }
  },

  init() {
    this.globalPlayState = this.getGlobalPlayState();
    this.globalMuteState = this.getGlobalMuteState();
  }
};

GlobalVideoState.init();

const FullScreenReels = ({ 
  reels = [], 
  onClose, 
  initialIndex = 0, 
  currentUser,
  onAuthorClick,
  onSoundClick,
  onActionMenu 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [muted, setMuted] = useState(GlobalVideoState.getGlobalMuteState());
  const [playing, setPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const touchStartY = useRef(0);
  const progressBarRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const { showToast } = useToast();

  const currentReel = reels[currentIndex];
  
  const profile = currentReel ? {
    userId: currentReel.user_id,
    author: currentReel.profiles?.full_name || currentReel.author || 'Unknown',
    username: currentReel.profiles?.username || currentReel.username || 'unknown',
    avatar: currentReel.profiles?.avatar_id || null,
    verified: currentReel.profiles?.verified || currentReel.verified || false
  } : null;

  // Use your mediaUrlService just like in ReelCard
  const videoUrl = currentReel?.video_id 
    ? mediaUrlService.getVideoUrl(currentReel.video_id, { quality: 'auto', format: 'mp4' })
    : null;
  
  const thumbnailUrl = currentReel?.thumbnail_id 
    ? mediaUrlService.getVideoThumbnail(currentReel.thumbnail_id, { width: 640, height: 1138 })
    : null;

  // Check like/save states
  // Subscribe to global mute state changes
  useEffect(() => {
    if (currentUser?.id && currentReel) {
      checkStates();
    }
  }, [currentReel?.id, currentUser?.id]);

  const checkStates = async () => {
    try {
      const [isLiked, isSaved] = await Promise.all([
        LikeModel.checkIfLiked('reel', currentReel.id, currentUser.id),
        SaveModel.checkIfSaved('reel', currentReel.id, currentUser.id)
      ]);
      setLiked(prev => ({ ...prev, [currentReel.id]: isLiked }));
      setSaved(prev => ({ ...prev, [currentReel.id]: isSaved }));
    } catch (error) {
      console.error('Error checking states:', error);
    }
  };
  useEffect(() => {
    const unsubscribe = GlobalVideoState.subscribe(() => {
      setMuted(GlobalVideoState.globalMuteState);
    });
    return unsubscribe;
  }, []);

  // Notify that fullscreen is open/closed
  useEffect(() => {
    const pauseEvent = new CustomEvent('fullscreen-opened');
    window.dispatchEvent(pauseEvent);
    
    // Set global play state to true when entering fullscreen
    GlobalVideoState.setGlobalPlayState(true);

    return () => {
      const closeEvent = new CustomEvent('fullscreen-closed');
      window.dispatchEvent(closeEvent);
      
      // Pause when closing fullscreen
      GlobalVideoState.setGlobalPlayState(false);
    };
  }, []);

  // Reset controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [playing]);

  // Play video function
  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoError || isTransitioningRef.current) return;

    video.play()
      .then(() => {
        setPlaying(true);
        setBuffering(false);
        resetControlsTimer();
      })
      .catch(err => {
        console.error('Play error:', err);
        if (err.name !== 'AbortError') {
          setVideoError(true);
        }
        setBuffering(false);
      });
  }, [videoError, resetControlsTimer]);

  // Pause video function
  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setPlaying(false);
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current || videoError) return;
    
    const newPlayState = !playing;
    
    // Update global play state
    GlobalVideoState.setGlobalPlayState(newPlayState);
    
    if (newPlayState) {
      playVideo();
    } else {
      pauseVideo();
    }
  }, [playing, videoError, playVideo, pauseVideo]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (showComments || showShare) return;
    
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm' || e.key === 'M') {
      const newMuted = !muted;
      setMuted(newMuted);
      GlobalVideoState.setGlobalMuteState(newMuted);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      goToPrevious();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      goToNext();
    }
  }, [onClose, togglePlay, showComments, showShare, muted]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const goToNext = useCallback(() => {
    if (currentIndex < reels.length - 1 && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      
      // Pause current video
      if (videoRef.current) {
        videoRef.current.pause();
      }
      
      setPlaying(false);
      setCurrentIndex(prev => prev + 1);
      setVideoError(false);
      setBuffering(true);
      setCurrentTime(0);
      setDuration(0);
      setBufferedProgress(0);
    }
  }, [currentIndex, reels.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioningRef.current) {
      isTransitioningRef.current = true;
      
      // Pause current video
      if (videoRef.current) {
        videoRef.current.pause();
      }
      
      setPlaying(false);
      setCurrentIndex(prev => prev - 1);
      setVideoError(false);
      setBuffering(true);
      setCurrentTime(0);
      setDuration(0);
      setBufferedProgress(0);
    }
  }, [currentIndex]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (isScrolling) return;

    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    if (e.deltaY > 0) {
      goToNext();
    } else if (e.deltaY < 0) {
      goToPrevious();
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 500);
  }, [isScrolling, goToNext, goToPrevious]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
  };

  // Progress bar handling
  const handleProgressBarClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !progressBarRef.current || !duration) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressBarDrag = (e) => {
    e.stopPropagation();
    if (!isDragging || !videoRef.current || !progressBarRef.current || !duration) return;

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

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setBuffering(false);
      setVideoError(false);
      isTransitioningRef.current = false;
      
      // Auto-play if global state says we should play
      if (GlobalVideoState.globalPlayState) {
        playVideo();
      }
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const videoDuration = videoRef.current.duration;
      if (videoDuration > 0) {
        const progress = (bufferedEnd / videoDuration) * 100;
        setBufferedProgress(progress);
      }
    }
  };

  const handleWaiting = () => {
    setBuffering(true);
  };

  const handleCanPlay = () => {
    setBuffering(false);
  };

  const handleError = (e) => {
    console.error('Video error:', e);
    setVideoError(true);
    setBuffering(false);
    isTransitioningRef.current = false;
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle video source changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset video state
    video.currentTime = 0;
    video.muted = muted;
    setCurrentTime(0);
    setShowControls(true);
    
    // Load the new video
    video.load();
  }, [currentIndex, videoUrl, muted]);

  // Handle mute state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // Handle drag events
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
    };
  }, [isDragging]);

  // Event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleKeyDown, handleWheel]);

  // Mock functions for demo - Replace with actual implementations
  const handleLike = async () => {
    if (!currentUser?.id) {
      showToast('warning', 'Please login to like');
      return;
    }

    try {
      const result = await LikeModel.toggleLike('reel', currentReel.id, currentUser.id);
      setLiked(prev => ({ ...prev, [currentReel.id]: result.liked }));
      
      if (result.liked) {
        showToast('success', 'Liked!', '+1 EP earned');
      }
    } catch (error) {
      console.error('Like error:', error);
      showToast('error', 'Failed to like');
    }
  };

  const handleSave = async () => {
    if (!currentUser?.id) {
      showToast('warning', 'Please login to save');
      return;
    }

    try {
      const result = await SaveModel.saveContent('reel', currentReel.id, currentUser.id);
      setSaved(prev => ({ ...prev, [currentReel.id]: result.saved }));
      
      showToast('success', result.saved ? 'Saved!' : 'Removed from saved');
    } catch (error) {
      console.error('Save error:', error);
      showToast('error', 'Failed to save');
    }
  };

  if (!currentReel || !profile) return null;

  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const playedPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <div 
        ref={containerRef}
        className="fullscreen-reels-container" 
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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

        {duration > 0 && (
          <div className="video-time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        )}

        <button 
          className={`fullscreen-close-btn ${showControls ? 'visible' : ''}`}
          onClick={onClose}
        >
          <X size={24} />
        </button>

        <div className="reel-slide">
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
                preload="auto"
                onClick={togglePlay}
                onWaiting={handleWaiting}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onProgress={handleProgress}
                onError={handleError}
              />
              
              {buffering && (
                <div className="buffering-spinner">
                  <div className="spinner-ring" />
                </div>
              )}

              {!playing && !buffering && (
                <div className="play-pause-overlay" onClick={togglePlay}>
                  <div className="play-icon-large">
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                      <circle cx="50" cy="50" r="48" stroke="white" strokeWidth="3" opacity="0.9"/>
                      <path d="M38 30L70 50L38 70V30Z" fill="white"/>
                    </svg>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="reel-fallback">
              <div className="reel-fallback-letter">
                {profile.author?.charAt(0) || 'R'}
              </div>
              {videoError && (
                <div className="error-message">Video unavailable</div>
              )}
            </div>
          )}

          <div className={`reel-left-info ${showControls ? 'visible' : ''}`}>
            <div className="reel-author-wrapper">
              <ProfilePreview 
                profile={profile}
                onClick={onAuthorClick}
                size="large"
              />

              <button 
                className="reel-music-info"
                onClick={(e) => {
                  e.stopPropagation();
                  onSoundClick?.(currentReel.music || 'Original Audio', currentReel);
                }}
              >
                <Music size={14} />
                <span className="music-marquee">{currentReel.music || 'Original Audio'}</span>
              </button>
            </div>

            {currentReel.caption && (
              <div className="reel-caption-full">
                <p>{currentReel.caption}</p>
              </div>
            )}
          </div>

          <div className={`reel-right-actions ${showControls ? 'visible' : ''}`}>
            <button className="action-btn-vertical" onClick={handleLike}>
              <Heart 
                size={28} 
                fill={liked[currentReel.id] ? '#ef4444' : 'none'} 
                color="#ffffff" 
              />
              <span>{formatNumber(currentReel.likes || 0)}</span>
            </button>

            <button 
              className="action-btn-vertical" 
              onClick={() => setShowComments(true)}
            >
              <MessageCircle size={28} color="#ffffff" />
              <span>{formatNumber(currentReel.comments_count || 0)}</span>
            </button>

            <button className="action-btn-vertical" onClick={handleSave}>
              <Bookmark 
                size={28} 
                fill={saved[currentReel.id] ? '#fbbf24' : 'none'} 
                color="#ffffff" 
              />
            </button>

            <button 
              className="action-btn-vertical" 
              onClick={() => setShowShare(true)}
            >
              <Share2 size={28} color="#ffffff" />
              <span>{formatNumber(currentReel.shares || 0)}</span>
            </button>

            <button 
              className="action-btn-vertical" 
              onClick={(e) => onActionMenu?.(e, currentReel, currentReel.user_id === currentUser?.id)}
            >
              <MoreVertical size={28} color="#ffffff" />
            </button>
          </div>

          <button 
            className={`fullscreen-mute-btn ${showControls ? 'visible' : ''}`}
            onClick={() => {
              const newMuted = !muted;
              setMuted(newMuted);
              GlobalVideoState.setGlobalMuteState(newMuted);
            }}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {showComments && (
        <CommentModal
          content={{ ...currentReel, type: 'reel' }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
        />
      )}

      {showShare && (
        <ShareModal
          content={{ ...currentReel, type: 'reel' }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}

      <style jsx>{`
        .fullscreen-reels-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #000;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .video-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(255, 255, 255, 0.15);
          z-index: 10002;
          cursor: pointer;
          transition: height 0.2s ease;
        }

        .video-progress-bar:hover {
          height: 6px;
        }

        .progress-buffered {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: rgba(255, 255, 255, 0.3);
          transition: width 0.3s ease;
        }

        .progress-played {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #84cc16 0%, #65a30d 100%);
          transition: width 0.1s linear;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .progress-handle {
          width: 12px;
          height: 12px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          opacity: 0;
          transition: opacity 0.2s ease;
          transform: translateX(50%);
        }

        .video-progress-bar:hover .progress-handle {
          opacity: 1;
        }

        .video-time-display {
          position: absolute;
          top: 6px;
          left: 8px;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(10px);
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          z-index: 10002;
          pointer-events: none;
          font-variant-numeric: tabular-nums;
        }

        .fullscreen-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 10001;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          opacity: 0;
          pointer-events: none;
        }

        .fullscreen-close-btn.visible {
          opacity: 1;
          pointer-events: all;
        }

        .fullscreen-close-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.05);
        }

        .reel-slide {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
        }

        .reel-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          cursor: pointer;
          background: #000;
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
          font-size: 48px;
          font-weight: 800;
          color: #000;
        }

        .error-message {
          color: rgba(255, 255, 255, 0.7);
          font-size: 16px;
        }

        .buffering-spinner {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
        }

        .spinner-ring {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .play-pause-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          cursor: pointer;
          z-index: 5;
        }

        .play-icon-large {
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }

        .reel-left-info {
          position: absolute;
          bottom: 80px;
          left: 20px;
          right: 80px;
          z-index: 10;
          transition: all 0.3s;
          opacity: 0;
          pointer-events: none;
        }

        .reel-left-info.visible {
          opacity: 1;
          pointer-events: all;
        }

        .reel-author-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .reel-music-info {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          padding: 8px 14px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          max-width: fit-content;
        }

        .reel-music-info:hover {
          background: rgba(0, 0, 0, 0.8);
        }

        .music-marquee {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .reel-caption-full {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          max-width: 400px;
        }

        .reel-caption-full p {
          color: white;
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        .reel-right-actions {
          position: absolute;
          right: 20px;
          bottom: 100px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          z-index: 10;
          transition: all 0.3s;
          opacity: 0;
          pointer-events: none;
        }

        .reel-right-actions.visible {
          opacity: 1;
          pointer-events: all;
        }

        .action-btn-vertical {
          position: relative;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 8px;
        }

        .action-btn-vertical:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.05);
        }

        .action-btn-vertical span {
          position: absolute;
          bottom: -22px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }

        .fullscreen-mute-btn {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10001;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          opacity: 0;
          pointer-events: none;
        }

        .fullscreen-mute-btn.visible {
          opacity: 1;
          pointer-events: all;
        }

        .fullscreen-mute-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.05);
        }

        @media (max-width: 768px) {
          .reel-left-info {
            bottom: 100px;
            left: 16px;
            right: 70px;
          }

          .reel-right-actions {
            right: 16px;
            bottom: 120px;
            gap: 20px;
          }

          .reel-caption-full {
            max-width: 100%;
          }

          .fullscreen-close-btn {
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
          }

          .fullscreen-mute-btn {
            top: 16px;
            left: 16px;
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </>
  );
};

export default FullScreenReels;