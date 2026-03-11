// src/components/Home/StoryTab.jsx
import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import StoryCard from "./StoryCard";
import FullContentView from "./FullContentView";

const StoryTab = forwardRef(
  (
    {
      stories: initialStories,
      currentUser,
      onAuthorClick,
      onActionMenu,
      onUnlock,
    },
    ref,
  ) => {
    const [stories, setStories] = useState(initialStories);
    const [showFull, setShowFull] = useState(false);
    const [selectedStory, setSelected] = useState(null);

    React.useEffect(() => {
      setStories(initialStories);
    }, [initialStories]);

    useImperativeHandle(ref, () => ({
      prepend(story) {
        setStories((prev) =>
          prev.some((s) => s.id === story.id) ? prev : [story, ...prev],
        );
      },
      updateStory(updated) {
        setStories((prev) =>
          prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
        );
      },
      deleteStory(storyId) {
        setStories((prev) => prev.filter((s) => s.id !== storyId));
      },
    }));

    const handleContentUpdate = useCallback((updated) => {
      setStories((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
      );
    }, []);

    const openFull = useCallback((story) => {
      setSelected(story);
      setShowFull(true);
    }, []);

    if (!stories.length) return null;

    return (
      <>
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            currentUser={currentUser}
            onAuthorClick={onAuthorClick}
            onActionMenu={onActionMenu}
            onUnlock={onUnlock}
            onOpenFull={openFull}
            onContentUpdate={handleContentUpdate}
          />
        ))}

        {showFull && selectedStory && (
          <FullContentView
            story={selectedStory}
            currentUser={currentUser}
            onClose={() => {
              setShowFull(false);
              setSelected(null);
            }}
          />
        )}
      </>
    );
  },
);

StoryTab.displayName = "StoryTab";
export default StoryTab;
