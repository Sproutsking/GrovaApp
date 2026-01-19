// ============================================================================
// src/components/Home/SoundModal.jsx - NEW COMPONENT
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Music, Play, TrendingUp, Users, Film } from 'lucide-react';
import { supabase } from '../../services/config/supabase';
import mediaUrlService from '../../services/shared/mediaUrlService';
import { useToast } from '../../contexts/ToastContext';

const SoundModal = ({ soundName, originReel, onClose, onReelClick }) => {
  const [loading, setLoading] = useState(true);
  const [soundData, setSoundData] = useState(null);
  const [reelsUsingSound, setReelsUsingSound] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    loadSoundData();
  }, [soundName]);

  const loadSoundData = async () => {
    try {
      setLoading(true);

      // Check if this is "Original Audio" or a specific sound
      if (soundName === 'Original Audio' || !soundName) {
        setSoundData({
          name: 'Original Audio',
          isOriginal: true,
          firstUsedBy: originReel?.profiles || originReel,
          firstUsedDate: originReel?.created_at,
          totalUses: 1
        });
        setReelsUsingSound([originReel]);
        setLoading(false);
        return;
      }

      // Load all reels using this sound
      const { data: reels, error } = await supabase
        .from('reels')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            username,
            avatar_id,
            verified
          )
        `)
        .eq('music', soundName)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!reels || reels.length === 0) {
        // No reels found with this sound
        setSoundData({
          name: soundName,
          isOriginal: true,
          firstUsedBy: originReel?.profiles || originReel,
          firstUsedDate: originReel?.created_at,
          totalUses: 1
        });
        setReelsUsingSound([originReel]);
      } else {
        // Sound has been used multiple times
        const firstReel = reels[0];
        setSoundData({
          name: soundName,
          isOriginal: false,
          firstUsedBy: firstReel.profiles,
          firstUsedDate: firstReel.created_at,
          totalUses: reels.length
        });
        setReelsUsingSound(reels);
      }

    } catch (error) {
      console.error('Failed to load sound data:', error);
      showToast('error', 'Failed to load sound information');
      
      // Fallback to showing just the current reel
      setSoundData({
        name: soundName || 'Original Audio',
        isOriginal: true,
        firstUsedBy: originReel?.profiles || originReel,
        firstUsedDate: originReel?.created_at,
        totalUses: 1
      });
      setReelsUsingSound([originReel]);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className="sound-modal-overlay" onClick={onClose}>
        <div className="sound-modal" onClick={(e) => e.stopPropagation()}>
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading sound info...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!soundData) return null;

  const creator = soundData.firstUsedBy;
  const creatorName = creator?.full_name || creator?.username || 'Unknown';
  const creatorUsername = creator?.username || creatorName;
  const creatorInitial = creatorName.charAt(0).toUpperCase();
  const creatorAvatar = creator?.avatar_id 
    ? mediaUrlService.getAvatarUrl(creator.avatar_id, 128) 
    : null;

  return (
    <>
      <div className="sound-modal-overlay" onClick={onClose}>
        <div className="sound-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="sound-modal-header">
            <div className="sound-header-content">
              <div className="sound-icon-large">
                <Music size={32} />
              </div>
              <div className="sound-title-section">
                <h2 className="sound-name">{soundData.name}</h2>
                <p className="sound-subtitle">
                  {soundData.isOriginal ? 'Original Audio' : 'Trending Sound'}
                </p>
              </div>
            </div>
            <button className="sound-close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {/* Sound Stats */}
          <div className="sound-stats-grid">
            <div className="sound-stat-card">
              <Film size={20} className="stat-icon" />
              <div className="stat-value">{formatNumber(soundData.totalUses)}</div>
              <div className="stat-label">Videos</div>
            </div>
            <div className="sound-stat-card">
              <TrendingUp size={20} className="stat-icon" />
              <div className="stat-value">
                {soundData.totalUses > 100 ? 'Viral' : soundData.totalUses > 10 ? 'Popular' : 'New'}
              </div>
              <div className="stat-label">Status</div>
            </div>
            <div className="sound-stat-card">
              <Users size={20} className="stat-icon" />
              <div className="stat-value">{formatNumber(soundData.totalUses)}</div>
              <div className="stat-label">Creators</div>
            </div>
          </div>

          {/* Original Creator */}
          <div className="original-creator-section">
            <h3 className="section-title">
              {soundData.isOriginal ? 'Posted by' : 'First used by'}
            </h3>
            <div className="creator-card">
              {creatorAvatar ? (
                <img src={creatorAvatar} alt={creatorName} className="creator-avatar" />
              ) : (
                <div className="creator-avatar">{creatorInitial}</div>
              )}
              <div className="creator-info">
                <div className="creator-name">
                  {creatorName}
                  {creator?.verified && <span className="verified-badge">✓</span>}
                </div>
                <div className="creator-username">@{creatorUsername}</div>
                <div className="creator-date">{formatDate(soundData.firstUsedDate)}</div>
              </div>
            </div>
          </div>

          {/* Videos Using This Sound */}
          <div className="reels-grid-section">
            <h3 className="section-title">
              Videos using this sound ({reelsUsingSound.length})
            </h3>
            <div className="reels-grid">
              {reelsUsingSound.map((reel) => {
                const thumbnailUrl = reel.thumbnail_id 
                  ? mediaUrlService.getVideoThumbnail(reel.thumbnail_id, { width: 300, height: 400 })
                  : (reel.video_id ? mediaUrlService.getVideoThumbnail(reel.video_id) : null);
                
                const reelProfile = reel.profiles || reel;
                const reelAuthor = reelProfile?.full_name || reelProfile?.username || 'Unknown';
                
                return (
                  <div 
                    key={reel.id} 
                    className="sound-reel-card"
                    onClick={() => {
                      onClose();
                      onReelClick?.(reel);
                    }}
                  >
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt={reel.caption || 'Reel'} className="reel-thumbnail" />
                    ) : (
                      <div className="reel-thumbnail-placeholder">
                        <Film size={32} />
                      </div>
                    )}
                    <div className="reel-overlay-info">
                      <div className="reel-play-icon">
                        <Play size={24} fill="white" />
                      </div>
                      <div className="reel-stats-overlay">
                        <span>{formatNumber(reel.views || 0)} views</span>
                      </div>
                    </div>
                    <div className="reel-card-footer">
                      <p className="reel-author-small">{reelAuthor}</p>
                      {reel.caption && (
                        <p className="reel-caption-small">{reel.caption}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sound-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(20px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .sound-modal {
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 24px;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          box-shadow: 0 20px 60px rgba(132, 204, 22, 0.2);
        }

        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .sound-modal::-webkit-scrollbar {
          width: 8px;
        }

        .sound-modal::-webkit-scrollbar-track {
          background: rgba(132, 204, 22, 0.1);
        }

        .sound-modal::-webkit-scrollbar-thumb {
          background: rgba(132, 204, 22, 0.3);
          border-radius: 4px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          gap: 20px;
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

        .loading-container p {
          color: #a3a3a3;
          font-size: 16px;
        }

        .sound-modal-header {
          position: sticky;
          top: 0;
          background: rgba(0, 0, 0, 0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(132, 204, 22, 0.2);
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }

        .sound-header-content {
          display: flex;
          gap: 16px;
          align-items: center;
          flex: 1;
        }

        .sound-icon-large {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .sound-title-section {
          flex: 1;
        }

        .sound-name {
          font-size: 24px;
          font-weight: 900;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .sound-subtitle {
          font-size: 14px;
          color: #84cc16;
          margin: 0;
          font-weight: 600;
        }

        .sound-close-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(132, 204, 22, 0.2);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .sound-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(132, 204, 22, 0.5);
          transform: rotate(90deg);
        }

        .sound-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          padding: 24px;
        }

        .sound-stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          transition: all 0.3s;
        }

        .sound-stat-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(132, 204, 22, 0.2);
        }

        .stat-icon {
          color: #84cc16;
          margin-bottom: 12px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 13px;
          color: #737373;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .original-creator-section {
          padding: 0 24px 24px;
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 16px 0;
        }

        .creator-card {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 16px;
          transition: all 0.2s;
        }

        .creator-card:hover {
          border-color: rgba(132, 204, 22, 0.4);
          background: rgba(255, 255, 255, 0.05);
        }

        .creator-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid #84cc16;
          object-fit: cover;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: #000;
          flex-shrink: 0;
        }

        .creator-info {
          flex: 1;
        }

        .creator-name {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: #84cc16;
          border-radius: 50%;
          color: #000;
          font-size: 12px;
        }

        .creator-username {
          font-size: 14px;
          color: #84cc16;
          margin-bottom: 4px;
        }

        .creator-date {
          font-size: 13px;
          color: #737373;
        }

        .reels-grid-section {
          padding: 0 24px 24px;
        }

        .reels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .sound-reel-card {
          position: relative;
          aspect-ratio: 9/16;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
        }

        .sound-reel-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 32px rgba(132, 204, 22, 0.3);
          border-color: rgba(132, 204, 22, 0.5);
        }

        .reel-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .reel-thumbnail-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(132, 204, 22, 0.05) 100%);
          color: #84cc16;
        }

        .reel-overlay-info {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.3s;
        }

        .sound-reel-card:hover .reel-overlay-info {
          opacity: 1;
        }

        .reel-play-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(132, 204, 22, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          margin-bottom: 12px;
          transform: scale(0.8);
          transition: all 0.3s;
        }

        .sound-reel-card:hover .reel-play-icon {
          transform: scale(1);
        }

        .reel-stats-overlay {
          font-size: 14px;
          color: #fff;
          font-weight: 600;
        }

        .reel-card-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
        }

        .reel-author-small {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .reel-caption-small {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .sound-modal {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .sound-stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 16px;
          }

          .sound-stat-card {
            padding: 16px 12px;
          }

          .stat-value {
            font-size: 20px;
          }

          .reels-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
        }
      `}</style>
    </>
  );
};

export default SoundModal;