import React from 'react';

const NewStoriesBar = ({ newStories, setNewStories, onView }) => {
  if (newStories.length === 0) return null;

  return (
    <div className="new-stories-bar">
      <div className="new-stories-content">
        <div className="new-stories-avatars">
          {newStories.slice(0, 3).map((story, idx) => (
            <div key={story.id} className="new-story-avatar" style={{ zIndex: 10 - idx }}>
              {story.avatar}
            </div>
          ))}
        </div>
        <span className="new-stories-text">
          {newStories.length <= 3
            ? `${newStories.length} new ${newStories.length === 1 ? 'story' : 'stories'}`
            : `3+ new stories`}
        </span>
        <button className="refresh-button" onClick={onView || (() => setNewStories([]))}>
          View
        </button>
      </div>
    </div>
  );
};

export default NewStoriesBar;