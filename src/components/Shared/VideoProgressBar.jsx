// ============================================================================
// src/components/Shared/VideoProgressBar.jsx - DRAGGABLE VIDEO TIMELINE
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';

const VideoProgressBar = ({ videoRef, isPlaying }) => {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const progressBarRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (!isDragging && video.duration) {
        const currentProgress = (video.currentTime / video.duration) * 100;
        setProgress(currentProgress);
      }
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef, isPlaying, isDragging]);

  const handleProgressClick = (e) => {
    const video = videoRef.current;
    const progressBar = progressBarRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const newTime = (percentage / 100) * video.duration;

    video.currentTime = newTime;
    setProgress(percentage);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleProgressClick(e);
  };

  const handleMouseMove = (e) => {
    const progressBar = progressBarRef.current;
    if (!progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (hoverX / rect.width) * 100));
    
    const video = videoRef.current;
    if (video && video.duration) {
      const time = (percentage / 100) * video.duration;
      setHoverTime(time);
    }

    if (isDragging) {
      handleProgressClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMove = (e) => handleProgressClick(e);
      const handleGlobalUp = () => setIsDragging(false);
      
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      
      return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
      };
    }
  }, [isDragging]);

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const video = videoRef.current;
  const currentTime = video?.currentTime || 0;
  const duration = video?.duration || 0;

  return (
    <>
      <div className="video-progress-container">
        <div 
          ref={progressBarRef}
          className="video-progress-bar"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="video-progress-track">
            <div 
              className="video-progress-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="video-progress-thumb" />
            </div>
          </div>
          
          {hoverTime !== null && (
            <div 
              className="video-progress-tooltip"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
        
        <div className="video-time-display">
          <span>{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <style jsx>{`
        .video-progress-container {
          width: 100%;
          padding: 0;
        }

        .video-progress-bar {
          position: relative;
          width: 100%;
          height: 20px;
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 6px 0;
        }

        .video-progress-track {
          position: relative;
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: visible;
        }

        .video-progress-bar:hover .video-progress-track {
          height: 5px;
        }

        .video-progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #84cc16 0%, #65a30d 100%);
          border-radius: 2px;
          transition: width 0.1s linear;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .video-progress-thumb {
          width: 12px;
          height: 12px;
          background: #84cc16;
          border-radius: 50%;
          transform: translateX(50%);
          opacity: 0;
          transition: opacity 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }

        .video-progress-bar:hover .video-progress-thumb {
          opacity: 1;
        }

        .video-progress-tooltip {
          position: absolute;
          bottom: 100%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          margin-bottom: 6px;
        }

        .video-time-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          font-weight: 600;
          margin-top: 2px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .time-separator {
          opacity: 0.5;
        }
      `}</style>
    </>
  );
};

export default VideoProgressBar;