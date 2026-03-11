import React, { useState, useEffect, useRef } from "react";
import { X, Music, TrendingUp, Clock } from "lucide-react";

/**
 * MusicSoundHistory - Modal showing videos using a specific sound/music
 * Props:
 * - music: string - name of the music/sound
 * - onClose: callback to close modal
 * - onVideoOpen: callback when a video is selected (videoId, videosList, startIndex)
 */
const MusicSoundHistory = ({ music, onClose, onVideoOpen }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    // Fetch videos using this sound
    fetchSoundHistory();
  }, [music]);

  const fetchSoundHistory = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/sounds/${encodeURIComponent(music)}/videos`);
      // const data = await response.json();

      // Mock data for now
      setTimeout(() => {
        setVideos([
          // Mock video data
        ]);
        setStats({
          totalUses: 0,
          firstUsedBy: "Unknown",
          firstUsedDate: new Date(),
          trending: false,
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error fetching sound history:", error);
      setLoading(false);
    }
  };

  const handleVideoClick = (video, index) => {
    if (onVideoOpen) {
      onVideoOpen(video, videos, index);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      <div
        ref={modalRef}
        className="music-history-backdrop"
        onClick={handleBackdropClick}
      >
        <div className="music-history-modal">
          <div className="music-history-header">
            <div className="music-history-title">
              <Music size={24} />
              <div className="music-title-info">
                <h2>{music}</h2>
                {stats && (
                  <div className="music-stats-quick">
                    <span>{stats.totalUses} uses</span>
                    {stats.trending && (
                      <>
                        <span className="stat-divider">•</span>
                        <span className="trending-badge">
                          <TrendingUp size={12} />
                          Trending
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button className="music-history-close" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {stats && (
            <div className="music-history-stats">
              <div className="stat-item">
                <Clock size={16} />
                <div className="stat-content">
                  <span className="stat-label">First used by</span>
                  <span className="stat-value">{stats.firstUsedBy}</span>
                </div>
              </div>
              <div className="stat-item">
                <Music size={16} />
                <div className="stat-content">
                  <span className="stat-label">Total videos</span>
                  <span className="stat-value">{stats.totalUses}</span>
                </div>
              </div>
            </div>
          )}

          <div className="music-history-content">
            {loading ? (
              <div className="music-history-loading">
                <div className="spinner-music" />
                <p>Loading videos...</p>
              </div>
            ) : videos.length > 0 ? (
              <div className="music-videos-grid">
                {videos.map((video, index) => (
                  <div
                    key={video.id}
                    className="music-video-card"
                    onClick={() => handleVideoClick(video, index)}
                  >
                    <div className="music-video-thumbnail">
                      <img src={video.thumbnail} alt={video.caption} />
                      <div className="video-play-overlay">
                        <Music size={32} />
                      </div>
                    </div>
                    <div className="music-video-info">
                      <p className="video-author">{video.author}</p>
                      <p className="video-caption">{video.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="music-history-empty">
                <Music size={48} />
                <p>No videos found using this sound</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .music-history-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .music-history-modal {
          background: #1a1a1a;
          border-radius: 16px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          border: 1px solid #2a2a2a;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .music-history-header {
          padding: 20px;
          border-bottom: 1px solid #2a2a2a;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .music-history-title {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          flex: 1;
          min-width: 0;
        }

        .music-history-title > svg {
          color: #84cc16;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .music-title-info {
          flex: 1;
          min-width: 0;
        }

        .music-title-info h2 {
          margin: 0;
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .music-stats-quick {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .stat-divider {
          color: rgba(255, 255, 255, 0.3);
        }

        .trending-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #84cc16;
          font-weight: 600;
        }

        .music-history-close {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .music-history-close:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.05);
        }

        .music-history-stats {
          padding: 16px 20px;
          background: rgba(132, 204, 22, 0.05);
          border-bottom: 1px solid #2a2a2a;
          display: flex;
          gap: 24px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .stat-item > svg {
          color: #84cc16;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 14px;
          color: #fff;
          font-weight: 600;
        }

        .music-history-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .music-history-loading,
        .music-history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
          color: rgba(255, 255, 255, 0.5);
        }

        .spinner-music {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(132, 204, 22, 0.2);
          border-top-color: #84cc16;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .music-videos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }

        .music-video-card {
          background: #222;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid #2a2a2a;
        }

        .music-video-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          border-color: #84cc16;
        }

        .music-video-thumbnail {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          background: #000;
          overflow: hidden;
        }

        .music-video-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .music-video-card:hover .video-play-overlay {
          opacity: 1;
        }

        .video-play-overlay svg {
          color: #84cc16;
        }

        .music-video-info {
          padding: 12px;
        }

        .video-author {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .video-caption {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        @media (max-width: 768px) {
          .music-history-backdrop {
            padding: 0;
          }

          .music-history-modal {
            border-radius: 0;
            max-height: 100vh;
            height: 100vh;
          }

          .music-videos-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
          }

          .music-history-stats {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default MusicSoundHistory;
