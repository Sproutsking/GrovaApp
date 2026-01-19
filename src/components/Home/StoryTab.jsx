import React, { useState } from 'react';
import StoryCard from './StoryCard';
import FullContentView from './FullContentView';

const StoryTab = ({
  stories,
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  onLike,
  onUnlock,
  onOpenFull
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);

  const openFullStory = (story) => {
    setSelectedStory(story);
    setShowFullContent(true);
  };

  return (
    <>
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          currentUser={currentUser}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onComment={onComment}
          onLike={onLike}
          onUnlock={onUnlock}
          onOpenFull={openFullStory}
        />
      ))}

      {showFullContent && selectedStory && (
        <FullContentView
          content={selectedStory}
          onClose={() => setShowFullContent(false)}
          onLike={onLike}
          onComment={onComment}
        />
      )}
    </>
  );
};

export default StoryTab;