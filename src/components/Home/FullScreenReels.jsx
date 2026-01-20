// ============================================================================
// src/components/Home/FullScreenReels.jsx - FIXED VERSION
// ============================================================================

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

const FullScreenReels = ({ 
  reels, 
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
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [videoError, setVideoError] = useState({});
  const [showControls, setShowControls] = useState(true);
  
  const videoRefs = useRef({});
  const controlsTimeoutRef = useRef(null);
  const { showToast } = useToast();

  const currentReel = reels[currentIndex];
  
  const profile = currentReel ? {
    userId: currentReel.user_id,
    author: currentReel.profiles?.full_name || currentReel.author || 'Unknown',
    username: currentReel.profiles?.username || currentReel.username || 'unknown',
    avatar: currentReel.profiles?.avatar_id || currentReel.avatar,
    verified: currentReel.profiles?.verified || currentReel.verified || false
  } : null;

  const videoUrl = currentReel?.video_id 
    ? mediaUrlService.getVideoUrl(currentReel.video_id)
    : null;

  useEffect(() => {
    if (currentUser?.id && currentReel) {
      checkStates();
    }
  }, [currentReel?.id, currentUser?.id]);

  const checkStates = async () => {
    const [isLiked, isSaved] = await Promise.all([
      LikeModel.checkIfLiked('reel', currentReel.id, currentUser.id),
      SaveModel.checkIfSaved('reel', currentReel.id, currentUser.id)
    ]);
    setLiked(prev => ({ ...prev, [currentReel.id]: isLiked }));
    setSaved(prev => ({ ...prev, [currentReel.id]: isSaved }));
  };

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

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  const togglePlay = useCallback(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;
    
    if (currentVideo.paused) {
      currentVideo.play().catch(err => {
        console.error('Play error:', err);
        setVideoError(prev => ({ ...prev, [currentIndex]: true }));
      });
      setPlaying(true);
      resetControlsTimer();
    } else {
      currentVideo.pause();
      setPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [currentIndex, resetControlsTimer]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm' || e.key === 'M') {
      setMuted(prev => !prev);
    }
  }, [onClose, togglePlay]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;

    currentVideo.currentTime = 0;
    setPlaying(true);
    setBuffering(true);
    setShowControls(true);
    
    currentVideo.play()
      .then(() => {
        setBuffering(false);
        resetControlsTimer();
      })
      .catch(err => {
        console.error('Play error:', err);
        setVideoError(prev => ({ ...prev, [currentIndex]: true }));
        setBuffering(false);
      });

    Object.keys(videoRefs.current).forEach(key => {
      if (parseInt(key) !== currentIndex && videoRefs.current[key]) {
        videoRefs.current[key].pause();
      }
    });
  }, [currentIndex, resetControlsTimer]);

  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      currentVideo.muted = muted;
    }
  }, [muted, currentIndex]);

  if (!currentReel || !profile) return null;

  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <div className="fullscreen-reels-overlay" onMouseMove={handleMouseMove}>
        <button 
          className={`fullscreen-close-btn ${showControls ? 'visible' : ''}`}
          onClick={onClose}
        >
          <X size={24} />
        </button>

        <div className="reels-container">
          <div className="reel-slide">
            {videoUrl && !videoError[currentIndex] ? (
              <>
                <video
                  ref={el => videoRefs.current[currentIndex] = el}
                  className="reel-video"
                  src={videoUrl}
                  loop
                  playsInline
                  muted={muted}
                  onClick={togglePlay}
                  onWaiting={() => setBuffering(true)}
                  onCanPlay={() => setBuffering(false)}
                  onError={() => setVideoError(prev => ({ ...prev, [currentIndex]: true }))}
                />
                
                {buffering && (
                  <div className="buffering-spinner">
                    <div className="spinner-ring" />
                  </div>
                )}

                {!playing && (
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
                {videoError[currentIndex] && (
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
              onClick={() => setMuted(!muted)}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <CommentModal
          content={{ ...currentReel, type: 'reel' }}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          isMobile={window.innerWidth <= 768}
        />
      )}

      {showShare && (
        <ShareModal
          content={{ ...currentReel, type: 'reel' }}
          currentUser={currentUser}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
};

export default FullScreenReels;