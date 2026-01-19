// ============================================================================
// src/components/Home/ReelCard.jsx - COMPLETE WITH AVATAR FIX
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

  // FIXED: Generate full Cloudinary URL for avatar
  const profile = {
    userId: reel.user_id,
    author: reel.profiles?.full_name || reel.author || 'Unknown',
    username: reel.profiles?.username || reel.username || 'unknown',
    avatar: reel.profiles?.avatar_id 
      ? mediaUrlService.getAvatarUrl(reel.profiles.avatar_id, 200)
      : null,
    verified: reel.profiles?.verified || reel.verified || false
  };

  // Ensure the reel has type set
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
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
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

  const handleOpenFullScreen = (e) => {
    e.stopPropagation();
    if (videoRef.current && playing) {
      videoRef.current.pause();
      setPlaying(false);
    }
    if (onOpenFullScreen) {
      onOpenFullScreen(index);
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
        <div className="reel-video-container" onClick={handleOpenFullScreen}>
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

      <style jsx>{`
        .reel-card {
          background: #000;
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          margin-bottom: 16px;
        }

        .reel-card:hover {
          border-color: rgba(132, 204, 22, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.15);
        }

        .reel-video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 9/16;
          max-height: 80vh;
          background: #000;
          overflow: hidden;
        }

        .reel-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }

        .reel-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .reel-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          min-height: 400px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
        }

        .reel-placeholder-letter {
          font-size: 120px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.3);
        }

        .reel-error-msg {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          padding: 8px 16px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 8px;
        }

        .reel-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          opacity: 0;
          pointer-events: none;
        }

        .reel-overlay.visible {
          opacity: 1;
          pointer-events: all;
          background: rgba(0, 0, 0, 0.3);
        }

        .reel-play-btn {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(132, 204, 22, 0.9);
          border: none;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .reel-play-btn:hover {
          transform: scale(1.1);
          background: #84cc16;
        }

        .reel-top-controls {
          position: absolute;
          top: 12px;
          right: 12px;
        }

        .reel-mute-btn {
          width: 36px;
          height: 36px;
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

        .reel-mute-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: scale(1.05);
        }

        .reel-info-overlay {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          z-index: 10;
        }

        .reel-author-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .reel-music-info {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
          max-width: 250px;
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

        .reel-menu-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .reel-menu-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.05);
        }

        .reel-caption-section {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
        }

        .reel-caption {
          font-size: 14px;
          color: #e5e5e5;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .reel-footer {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.5);
          border-top: 1px solid rgba(132, 204, 22, 0.1);
        }
      `}</style>
    </>
  );
};

export default ReelCard;