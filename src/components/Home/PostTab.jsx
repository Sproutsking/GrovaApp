// src/components/Home/PostTab.jsx
// OPTIMISTIC UI — posts appear instantly, no flicker, no delay
import React, { useState, useCallback, useRef } from "react";
import PostCard from "./PostCard";

const PostTab = ({ posts: initialPosts, currentUser, onAuthorClick, onActionMenu, onComment }) => {
  const [posts, setPosts] = useState(initialPosts);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Keep in sync with parent prop changes (e.g. after refresh)
  React.useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  // Optimistic post update — called from PostCard when user edits
  const handlePostUpdate = useCallback((updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }, []);

  // Optimistic post delete — instant removal, parent notified
  const handlePostDelete = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // Optimistic new post prepend — called when user creates a post
  const prependPost = useCallback((newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  }, []);

  if (!posts || posts.length === 0) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#737373" }}>
        <p style={{ fontSize: 16 }}>No posts yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="post-tab-feed">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onComment={onComment}
          onPostUpdate={handlePostUpdate}
          onPostDelete={handlePostDelete}
        />
      ))}
    </div>
  );
};

export default PostTab;