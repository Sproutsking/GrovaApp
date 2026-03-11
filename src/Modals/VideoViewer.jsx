import React, { useState, useRef, useEffect } from "react";
import {
  X,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Play,
  Pause,
} from "lucide-react";

/**
 * VideoViewer - Fullscreen video viewer with vertical scrolling between videos
 * Props:
 * - videos: array of video objects
 * - initialIndex: starting video index
 * - onClose: callback to close viewer
 */
const VideoViewer = ({ videos = [], initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const isScrolling = useRef(false);

  const currentVideo = videos[currentIndex];
  const hasNext = currentIndex < videos.length - 1;
  const hasPrev = currentIndex > 0;

  useEffect(() => {
    // Auto-play when video changes
    if (videoRef.current && currentVideo) {
      setLoading(true);
      videoRef.current.load();
    }
  }, [currentIndex, currentVideo]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowUp") goToPrev();
      if (e.key === "ArrowDown") goToNext();
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  const goToNext = () => {
    if (hasNext && !isScrolling.current) {
      isScrolling.current = true;
      setCurrentIndex((prev) => prev + 1);
      setTimeout(() => {
        isScrolling.current = false;
      }, 500);
    }
  };

  const goToPrev = () => {
    if (hasPrev && !isScrolling.current) {
      isScrolling.current = true;
      setCurrentIndex((prev) => prev - 1);
      setTimeout(() => {
        isScrolling.current = false;
      }, 500);
    }
  };

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
        goToPrev();
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      goToNext();
    } else if (e.deltaY < 0) {
      goToPrev();
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  const handleVideoClick = (e) => {
    if (!e.target.closest("button")) {
      togglePlay();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setLoading(false);
      videoRef.current
        .play()
        .then(() => {
          setPlaying(true);
        })
        .catch((err) => {
          console.error("Auto-play failed:", err);
          setPlaying(false);
        });
    }
  };

  const handleVideoEnd = () => {
    if (hasNext) {
      goToNext();
    } else {
      setPlaying(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentVideo) {
    return null;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="video-viewer-backdrop"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="video-viewer-header">
          <div className="viewer-video-info">
            <span className="viewer-author">{currentVideo.author}</span>
            <span className="viewer-index">
              {currentIndex + 1} / {videos.length}
            </span>
          </div>
          <button className="video-viewer-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="video-viewer-container" onClick={handleVideoClick}>
          <video
            ref={videoRef}
            className="video-viewer-video"
            src={currentVideo.videoUrl}
            poster={currentVideo.thumbnail}
            loop={!hasNext}
            playsInline
            muted={muted}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleVideoEnd}
          />

          {loading && (
            <div className="video-viewer-loading">
              <div className="spinner-viewer" />
            </div>
          )}

          <div className="video-viewer-controls">
            <button className="viewer-play-btn" onClick={togglePlay}>
              {playing ? <Pause size={40} /> : <Play size={40} />}
            </button>
          </div>

          <div className="video-viewer-bottom">
            <div className="viewer-progress-info">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            <button className="viewer-mute-btn" onClick={toggleMute}>
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

          {currentVideo.caption && (
            <div className="video-viewer-caption">
              <p>{currentVideo.caption}</p>
            </div>
          )}
        </div>

        <div className="video-viewer-nav">
          {hasPrev && (
            <button className="video-nav-btn video-nav-prev" onClick={goToPrev}>
              <ChevronUp size={32} />
            </button>
          )}
          {hasNext && (
            <button className="video-nav-btn video-nav-next" onClick={goToNext}>
              <ChevronDown size={32} />
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .video-viewer-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #000;
          z-index: 20000;
          display: flex;
          flex-direction: column;
        }

        .video-viewer-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 16px;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.8),
            transparent
          );
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }

        .viewer-video-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .viewer-author {
          color: #fff;
          font-size: 16px;
          font-weight: 700;
        }

        .viewer-index {
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
        }

        .video-viewer-close {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .video-viewer-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .video-viewer-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
        }

        .video-viewer-video {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
        }

        .video-viewer-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .spinner-viewer {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .video-viewer-controls {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }

        .video-viewer-container:hover .video-viewer-controls {
          opacity: 1;
        }

        .viewer-play-btn {
          background: rgba(0, 0, 0, 0.7);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          pointer-events: all;
        }

        .viewer-play-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: scale(1.05);
        }

        .video-viewer-bottom {
          position: absolute;
          bottom: 20px;
          left: 0;
          right: 0;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .viewer-progress-info {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          padding: 8px 14px;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          gap: 6px;
          font-variant-numeric: tabular-nums;
        }

        .viewer-mute-btn {
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .viewer-mute-btn:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: scale(1.05);
        }

        .video-viewer-caption {
          position: absolute;
          bottom: 80px;
          left: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 500px;
        }

        .video-viewer-caption p {
          margin: 0;
          color: #fff;
          font-size: 14px;
          line-height: 1.5;
        }

        .video-viewer-nav {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .video-nav-btn {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .video-nav-btn:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.1);
          border-color: #84cc16;
        }

        .video-nav-btn:active {
          transform: scale(0.95);
        }

        @media (max-width: 768px) {
          .video-viewer-nav {
            display: none;
          }

          .video-viewer-caption {
            bottom: 70px;
            left: 12px;
            right: 12px;
          }

          .video-viewer-bottom {
            padding: 0 12px;
            bottom: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default VideoViewer;
