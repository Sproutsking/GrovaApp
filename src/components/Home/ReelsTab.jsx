// ============================================================================
// src/components/Home/ReelsTab.jsx - COMPLETE FIXED
// ============================================================================

import React from 'react';
import ReelCard from './ReelCard';

const ReelsTab = ({ reels, currentUser, onAuthorClick, onActionMenu, onComment }) => {
  console.log('🎬 ReelsTab rendering with', reels?.length || 0, 'reels');
  
  // Filter out any deleted reels on the client side as extra safety
  const activeReels = reels?.filter(reel => !reel.deleted_at) || [];

  if (!activeReels || activeReels.length === 0) {
    return (
      <div className="empty-reels">
        <p>No reels to display</p>
      </div>
    );
  }

  return (
    <div className="reels-grid">
      {activeReels.map((reel, index) => (
        <ReelCard
          key={reel.id}
          reel={reel}
          currentUser={currentUser}
          onAuthorClick={() => onAuthorClick(reel)}
          onActionMenu={onActionMenu}
          index={index}
        />
      ))}

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
            gap: 16px;
          }
        }

        .empty-reels {
          text-align: center;
          padding: 60px 20px;
          color: #737373;
        }
      `}</style>
    </div>
  );
};

export default ReelsTab;