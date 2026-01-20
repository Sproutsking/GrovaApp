// ============================================================================
// src/components/Home/ReelCard.jsx - FINAL FIXED VERSION
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Music, VolumeX, Volume2, Play, Pause } from 'lucide-react';
import ProfilePreview from '../Shared/ProfilePreview';
import ReactionPanel from '../Shared/ReactionPanel';
import CommentModal from '../Modals/CommentModal';
import ShareModal from '../Modals/ShareModal';
import mediaUrlService from '../../services/shared/mediaUrlService';

const ReelCard = ({ 
  reel, 
  onAuthorClick, 
  onActionMenu, 
  currentUser, 
  onOpenFullScreen, 
  onSoundClick,
  index 
}) => {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);

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
    
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      videoRef.current.play().catch(err => {
        console.error('Play error:', err);
        setVideoError(true);
      });
      setPlaying(true);
      resetControlsTimer();
    }
  };

  const handleVideoClick = (e) => {
    // Don't open fullscreen if clicking on buttons or controls
    if (e.target.closest('button') || e.target.closest('.reel-info-overlay')) {
      return;
    }
    
    if (onOpenFullScreen) {
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
    if (playing) {
      resetControlsTimer();
    }
  };

  const handleSoundClick = (e) => {
    e.stopPropagation();
    if (onSoundClick) {
      onSoundClick(reel.music || 'Original Audio', reel);
    }
  };

  const handleActionMenu = (e) => {
    e.stopPropagation();
    if (onActionMenu) {
      onActionMenu(e, reelWithType, reel.user_id === currentUser?.id);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

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
                onLoadedData={() => {
                  setIsLoading(false);
                  setVideoError(false);
                }}
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
                <button className="reel-mute-btn" onClick={(e) => {
                  e.stopPropagation();
                  setMuted(!muted);
                }}>
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
            <p className="reel-caption">{reel.caption}</p>
          </div>
        )}

        <div className="reel-footer">
          <ReactionPanel
            content={reelWithType}
            currentUser={currentUser}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            layout="horizontal"
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