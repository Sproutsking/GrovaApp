// src/components/Home/StoriesTab.jsx
import React from 'react';
import StoryCard from '../Shared/StoryCard';

const StoriesTab = ({ 
  stories,
  handleUnlock,
  handleLikeStory,
  handleOpenComments,
  handleOpenProfile,
  handleOpenActionMenu,
  handleOpenShare,
  handleSaveContent,
  currentUser 
}) => {
  const handleAuthorClick = (story) => {
    const user = {
      name: story.author,
      username: `@${story.author.toLowerCase().replace(/\s+/g, '_')}`,
      avatar: story.avatar,
      verified: story.verified,
      author: story.author,
    };
    handleOpenProfile(user);
  };

  return (
    <div className="stories-tab-container">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          onAuthorClick={handleAuthorClick}
          onUnlock={handleUnlock}
          onLike={handleLikeStory}
          onComment={handleOpenComments}
          onShare={handleOpenShare}
          onSave={handleSaveContent}
          onActionMenu={handleOpenActionMenu}
          currentUser={currentUser}
          isMarket={false}
        />
      ))}
    </div>
  );
};

export default StoriesTab;