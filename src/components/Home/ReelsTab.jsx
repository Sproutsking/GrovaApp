import React, { useState, useEffect } from 'react';
import ReelCard from './ReelCard';
import FullScreenReels from './FullScreenReels';

const ReelsTab = ({ 
  reels, 
  currentUser, 
  onAuthorClick, 
  onActionMenu, 
  onComment,
  onSoundClick,
  onHashtagClick,
  onMentionClick 
}) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  
  console.log('🎬 ReelsTab rendering with', reels?.length || 0, 'reels');
  
  const activeReels = reels?.filter(reel => !reel.deleted_at) || [];

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpenFullScreen = (index) => {
    setFullScreenIndex(index);
    setShowFullScreen(true);
    
    if (!isDesktop) {
      document.body.style.overflow = 'hidden';
    }
  };

  const handleCloseFullScreen = () => {
    setShowFullScreen(false);
    
    if (!isDesktop) {
      document.body.style.overflow = '';
    }
  };

  if (!activeReels || activeReels.length === 0) {
    return (
      <div className="empty-reels">
        <div className="empty-reels-icon">🎬</div>
        <p>No reels to display</p>
        <span>Start creating amazing content!</span>
        
        <style jsx>{`
          .empty-reels {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 20px;
            text-align: center;
            gap: 16px;
          }

          .empty-reels-icon {
            font-size: 64px;
            opacity: 0.3;
          }

          .empty-reels p {
            color: #a3a3a3;
            font-size: 18px;
            font-weight: 600;
            margin: 0;
          }

          .empty-reels span {
            color: #737373;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {!showFullScreen && (
        <div className="reels-grid">
          {activeReels.map((reel, index) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
              onOpenFullScreen={() => handleOpenFullScreen(index)}
              onSoundClick={onSoundClick}
              onHashtagClick={onHashtagClick}
              onMentionClick={onMentionClick}
              index={index}
            />
          ))}
        </div>
      )}

      {showFullScreen && (
        <FullScreenReels
          reels={activeReels}
          initialIndex={fullScreenIndex}
          currentUser={currentUser}
          onClose={handleCloseFullScreen}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onSoundClick={onSoundClick}
        />
      )}

      <style jsx>{`
        .reels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
          padding: 20px 0;
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 1280px) {
          .reels-grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
          }
        }

        @media (max-width: 1024px) {
          .reels-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            padding: 16px;
          }
        }

        @media (max-width: 768px) {
          .reels-grid {
            grid-template-columns: 1fr;
            gap: 0;
            padding: 0;
          }
        }

        @media (min-width: 1024px) {
          :global(.home-view.fullscreen-active) {
            overflow: hidden;
          }
          
          :global(.home-view.fullscreen-active .reels-grid) {
            display: none;
          }
        }
      `}</style>
    </>
  );
};

export default ReelsTab;