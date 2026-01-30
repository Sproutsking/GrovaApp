import React from "react";
import PostCard from "./PostCard";

const PostTab = ({ posts, currentUser }) => {
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUser={currentUser} />
      ))}
    </>
  );
};

export default PostTab;
