// src/components/Home/Newsfeed.jsx
import React from 'react';
import StoryCard from '../Shared/StoryCard';

const Newsfeed = ({ stories, handleUnlock, setViewingProfile }) => (
  <div className="stories-container">
    {stories.map(story => (
      <StoryCard key={story.id} story={story} onUnlock={handleUnlock} onAuthorClick={() => setViewingProfile(story)} />
    ))}
  </div>
);

export default Newsfeed;