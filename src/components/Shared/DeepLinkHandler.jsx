// ============================================================================
// DeepLinkHandler.jsx - Handle external post links and deep linking
// ============================================================================
// Place this in src/components/shared/DeepLinkHandler.jsx

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * DeepLinkHandler - Handles deep links from external sources
 *
 * Usage: Add to your main App.jsx or Routes component
 * <DeepLinkHandler />
 */
const DeepLinkHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Handle post deep links on component mount
    const handleDeepLink = () => {
      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);

      // Check if this is a post link: /post/:postId
      const postMatch = path.match(/^\/post\/([a-f0-9-]{36})$/i);

      if (postMatch) {
        const postId = postMatch[1];
        console.log("🔗 Deep link detected for post:", postId);

        // Navigate to the post detail view
        // Adjust this path based on your routing structure
        navigate(`/post/${postId}`, { replace: true });
      }

      // Handle query parameter style: ?post=:postId
      const postIdFromQuery =
        searchParams.get("post") || searchParams.get("postId");
      if (postIdFromQuery) {
        console.log("🔗 Deep link detected from query param:", postIdFromQuery);
        navigate(`/post/${postIdFromQuery}`, { replace: true });
      }

      // Handle other content types if needed
      const reelId = searchParams.get("reel");
      if (reelId) {
        navigate(`/reel/${reelId}`, { replace: true });
      }

      const storyId = searchParams.get("story");
      if (storyId) {
        navigate(`/story/${storyId}`, { replace: true });
      }
    };

    handleDeepLink();
  }, [navigate, location]);

  return null; // This component doesn't render anything
};

export default DeepLinkHandler;
