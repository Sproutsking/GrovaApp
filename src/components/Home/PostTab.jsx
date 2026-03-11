// src/components/Home/PostTab.jsx
// forwardRef exposes .prepend() / .updatePost() / .deletePost() to HomeView
import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import PostCard from "./PostCard";

const PostTab = forwardRef(({ posts: initialPosts, currentUser }, ref) => {
  const [posts, setPosts] = useState(initialPosts);

  // Sync when parent does a full refresh
  React.useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useImperativeHandle(ref, () => ({
    prepend(post) {
      setPosts((prev) =>
        prev.some((p) => p.id === post.id) ? prev : [post, ...prev],
      );
    },
    updatePost(updated) {
      setPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
      );
    },
    deletePost(postId) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
  }));

  const handlePostUpdate = useCallback((updated) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }, []);

  const handlePostDelete = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // ReactionPanel bubbles comment count changes here via onCommented
  const handleContentUpdate = useCallback((updated) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }, []);

  if (!posts.length) return null;

  return (
    <>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onPostUpdate={handlePostUpdate}
          onPostDelete={handlePostDelete}
          onContentUpdate={handleContentUpdate}
        />
      ))}
    </>
  );
});

PostTab.displayName = "PostTab";
export default PostTab;
