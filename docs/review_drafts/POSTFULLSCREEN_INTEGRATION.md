# Trimmed draft: POSTFULLSCREEN_INTEGRATION.md
// INTEGRATION GUIDE: PostFullScreen Modal

## Notes: This file has been trimmed to remove payment/web3/treasury sections for Xeevia-focused review.

## Trimmed content (first relevant lines)
// INTEGRATION GUIDE: PostFullScreen Modal

/* 
  To integrate PostFullScreen into your post components:

  1. Import the component:
  ────────────────────────────────────────────────────────────────────
  import PostFullScreen from "./PostFullScreen";

  2. Add state to track which post is open:
  ────────────────────────────────────────────────────────────────────
  const [fullScreenPost, setFullScreenPost] = useState(null);

  3. Add onClick handler to your post body/content:
  ────────────────────────────────────────────────────────────────────
  <div 
    onClick={() => setFullScreenPost(post)}
    className="post-content"
    style={{ cursor: 'pointer' }}
  >
    {post.text}
  </div>

  4. Render the modal conditionally:
  ────────────────────────────────────────────────────────────────────
  {fullScreenPost && (
    <PostFullScreen
      post={fullScreenPost}
      currentUser={currentUser}
      onClose={() => setFullScreenPost(null)}
    />
  )}

  EXAMPLE INTEGRATION IN PostCard.jsx:
  ────────────────────────────────────────────────────────────────────

  import React, { useState } from 'react';
  import PostFullScreen from './PostFullScreen';

  const PostCard = ({ post, currentUser }) => {
    const [fullScreenPost, setFullScreenPost] = useState(null);

    return (
      <>
        <div className="post-card">
          <div
            className="post-content"
            onClick={() => setFullScreenPost(post)}
            style={{ cursor: 'pointer' }}
          >
            <h3>{post.profiles?.full_name}</h3>
            <p>{post.text}</p>
          </div>
        </div>

        {fullScreenPost && (
          <PostFullScreen
            post={fullScreenPost}
            currentUser={currentUser}
            onClose={() => setFullScreenPost(null)}
          />
        )}
      </>
    );
  };

  export default PostCard;
*/

export const PostFullScreenIntegration = {
  description: "Click on post body to open full-screen X-like modal",
  features: [
    "Beautiful two-column layout (post + comments)",
    "Threaded comments with nested replies",
    "Full like/comment functionality with EP costs",
    "X-style close button",
    "Smooth scrolling on both columns",
    "Mobile responsive (stacked layout)",
    "Keyboard support (Escape to close, Ctrl+Enter to submit)",
    "Comment reply threading up to 3 levels deep",
  ],
  props: {
    post: "Post object with { id, text, images, user_id, profiles, likes, shares, created_at }",
    currentUser: "Current user object with { id, username, avatar_id }",
    onClose: "Callback function when modal is closed",
  },
};
