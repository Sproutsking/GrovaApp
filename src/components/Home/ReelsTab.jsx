// ============================================================================
// src/components/Home/ReelsTab.jsx - WITH FULLSCREEN SUPPORT
// ============================================================================

import React, { useState } from 'react';
import ReelCard from './ReelCard';
import FullScreenReels from './FullScreenReels';

const ReelsTab = ({ reels, currentUser, onAuthorClick, onActionMenu, onComment }) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  
  console.log('🎬 ReelsTab rendering with', reels?.length || 0, 'reels');
  
  const activeReels = reels?.filter(reel => !reel.deleted_at) || [];

  const handleOpenFullScreen = (index) => {
    setFullScreenIndex(index);
    setShowFullScreen(true);
  };

  const handleCloseFullScreen = () => {
    setShowFullScreen(false);
  };

  if (!activeReels || activeReels.length === 0) {
    return (
      <div className="empty-reels">
        <p>No reels to display</p>
      </div>
    );
  }

  return (
    <>
      <div className="reels-grid">
        {activeReels.map((reel, index) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            currentUser={currentUser}
            onAuthorClick={() => onAuthorClick(reel)}
            onActionMenu={onActionMenu}
            onOpenFullScreen={() => handleOpenFullScreen(index)}
            index={index}
          />
        ))}
      </div>

      {showFullScreen && (
        <FullScreenReels
          reels={activeReels}
          initialIndex={fullScreenIndex}
          currentUser={currentUser}
          onClose={handleCloseFullScreen}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
        />
      )}

      <style jsx>{`
        .reels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          padding: 0;
        }

        @media (max-width: 768px) {
          .reels-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }

        .empty-reels {
          text-align: center;
          padding: 60px 20px;
          color: #737373;
        }
      `}</style>
    </>
  );
};

export default ReelsTab;