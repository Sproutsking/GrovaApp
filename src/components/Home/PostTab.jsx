import React from 'react';
import PostCard from './PostCard';

const PostTab = ({
  posts,
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  onLike,
  onShare
}) => {
  return (
    <>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onComment={onComment}
          onLike={onLike}
          onShare={onShare}
        />
      ))}
    </>
  );
};

export default PostTab;