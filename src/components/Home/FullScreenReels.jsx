// ============================================================================
// src/components/Home/FullScreenReels.jsx - UNIFIED WITH NEW COMPONENTS
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Heart, MessageCircle, Share2, Bookmark, Music, 
  VolumeX, Volume2, X, MoreVertical, SkipForward, SkipBack 
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
  
  const videoRefs = useRef({});
  const lastTapRef = useRef({ time: 0, side: '' });
  const touchStartY = useRef(0);
  const touchMoveY = useRef(0);
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

  const togglePlay = useCallback(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;
    
    if (currentVideo.paused) {
      currentVideo.play().catch(err => {
        console.error('Play error:', err);
        setVideoError(prev => ({ ...prev, [currentIndex]: true }));
      });
      setPlaying(true);
    } else {
      currentVideo.pause();
      setPlaying(false);
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown' && currentIndex < reels.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm' || e.key === 'M') {
      setMuted(prev => !prev);
    }
  }, [currentIndex, reels.length, onClose, togglePlay]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex];
    if (!currentVideo) return;

    currentVideo.currentTime = 0;
    setPlaying(true);
    setBuffering(true);
    
    currentVideo.play()
      .then(() => setBuffering(false))
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
  }, [currentIndex]);

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
      <div className="fullscreen-reels-overlay">
        <button className="fullscreen-close-btn" onClick={onClose}>
          <X size={28} />
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
                    <div className="spinner" />
                  </div>
                )}

                {!playing && (
                  <div className="play-pause-overlay">
                    <div className="play-icon-large">
                      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="38" stroke="white" strokeWidth="2" opacity="0.8"/>
                        <path d="M32 25L55 40L32 55V25Z" fill="white"/>
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

            <div className="reel-left-info">
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
                  <Music size={16} />
                  <span className="music-marquee">{currentReel.music || 'Original Audio'}</span>
                </button>
              </div>

              {currentReel.caption && (
                <div className="reel-caption-full">
                  <p>{currentReel.caption}</p>
                </div>
              )}
            </div>

            <div className="reel-right-actions">
              <button className="action-btn-vertical" onClick={handleLike}>
                <Heart 
                  size={32} 
                  fill={liked[currentReel.id] ? '#ef4444' : 'none'} 
                  color="#ffffff" 
                />
                <span>{formatNumber(currentReel.likes || 0)}</span>
              </button>

              <button 
                className="action-btn-vertical" 
                onClick={() => setShowComments(true)}
              >
                <MessageCircle size={32} color="#ffffff" />
                <span>{formatNumber(currentReel.comments_count || 0)}</span>
              </button>

              <button className="action-btn-vertical" onClick={handleSave}>
                <Bookmark 
                  size={32} 
                  fill={saved[currentReel.id] ? '#fbbf24' : 'none'} 
                  color="#ffffff" 
                />
              </button>

              <button 
                className="action-btn-vertical" 
                onClick={() => setShowShare(true)}
              >
                <Share2 size={32} color="#ffffff" />
                <span>{formatNumber(currentReel.shares || 0)}</span>
              </button>

              <button 
                className="action-btn-vertical" 
                onClick={(e) => onActionMenu?.(e, currentReel, currentReel.user_id === currentUser?.id)}
              >
                <MoreVertical size={32} color="#ffffff" />
              </button>
            </div>

            <button className="fullscreen-mute-btn" onClick={() => setMuted(!muted)}>
              {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>

            <div className="reels-progress">
              {reels.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`progress-dot ${idx === currentIndex ? 'active' : ''}`}
                />
              ))}
            </div>
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

      <style jsx>{`
        .fullscreen-reels-overlay {
          position: fixed;
          inset: 0;
          background: #000;
          z-index: 10000;
          overflow: hidden;
        }

        .fullscreen-close-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10002;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .fullscreen-close-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: rotate(90deg);
        }

        .reels-container {
          width: 100%;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .reel-slide {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reel-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
          cursor: pointer;
        }

        .buffering-spinner {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          z-index: 100;
        }

        .spinner {
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
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.2);
          z-index: 50;
        }

        .reel-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
        }

        .reel-fallback-letter {
          font-size: 200px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.3);
        }

        .error-message {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.8);
          padding: 12px 24px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 8px;
        }

        .reel-left-info {
          position: absolute;
          bottom: 100px;
          left: 20px;
          right: 100px;
          z-index: 10001;
        }

        .reel-author-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .reel-music-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border-radius: 24px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          max-width: 300px;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }

        .reel-music-info:hover {
          background: rgba(0, 0, 0, 0.8);
          border-color: rgba(132, 204, 22, 0.5);
        }

        .music-marquee {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reel-caption-full p {
          font-size: 15px;
          color: #fff;
          line-height: 1.5;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
        }

        .reel-right-actions {
          position: absolute;
          right: 20px;
          bottom: 100px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: center;
          z-index: 10001;
        }

        .action-btn-vertical {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .action-btn-vertical:hover {
          transform: scale(1.1);
        }

        .action-btn-vertical span {
          font-size: 13px;
          font-weight: 600;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
        }

        .fullscreen-mute-btn {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10001;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .fullscreen-mute-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: scale(1.05);
        }

        .reels-progress {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          z-index: 10001;
        }

        .progress-dot {
          width: 4px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.5);
          transition: all 0.3s;
        }

        .progress-dot.active {
          background: #84cc16;
          width: 24px;
        }
      `}</style>
    </>
  );
};

export default FullScreenReels;