// ============================================================================
// EXAMPLE: How to integrate Xeevia Distribution into CreateView
// ============================================================================
// 
// This is a reference showing the exact changes needed in CreateView.jsx
// Copy patterns from here into your CreateView component
//

// ─── 1. ADD IMPORTS AT TOP ─────────────────────────────────────────────────
import useDistribution from "../../hooks/useDistribution";
import PlatformSelector from "../Distribution/PlatformSelector";
import DistributionStatus from "../Distribution/DistributionStatus";

// ─── 2. ADD STATE VARIABLES IN COMPONENT ──────────────────────────────────
// Inside CreateView functional component:

const CreateView = ({ onPublishSuccess, onClose }) => {
  // ... existing state ...
  
  // NEW: Distribution system
  const distribution = useDistribution(currentUser?.id);
  const [showDistributionStatus, setShowDistributionStatus] = useState(false);
  const [publishedPostId, setPublishedPostId] = useState(null);
  const [distributionError, setDistributionError] = useState(null);

  // ─── 3. UPDATE PUBLISH HANDLER ─────────────────────────────────────────
  // Replace or enhance your existing handlePublish function:

  const handlePublish = async () => {
    try {
      // Validate input
      if (activeTab === "post" && !postContent && !postMedia.length) {
        setUploadProgress(0);
        return;
      }

      setLoading(true);
      setUploadProgress(50);

      // ─── Step 1: Create post normally (existing flow) ────────────────────
      let createdPost;

      if (activeTab === "post") {
        createdPost = await createService.createPost({
          content: postContent,
          images: postMedia.filter(m => m.type === "image"),
          videos: postMedia.filter(m => m.type === "video"),
          category: postCategory,
          isTextCard: useTextCard,
          textCardMetadata: useTextCard ? { /* ... */ } : null,
          cardCaption: postCaption,
        }, currentUser.id);

        // Dispatch event for optimistic UI
        dispatchPublish(createdPost, "post");

      } else if (activeTab === "reel") {
        createdPost = await createService.createReel({
          video: reelMedia,
          caption: reelCaption,
          category: reelCategory,
        }, currentUser.id, setUploadProgress);

        dispatchPublish(createdPost, "reel");

      } else if (activeTab === "story") {
        createdPost = await createService.createStory({
          title: storyTitle,
          content: storyContent,
          cover: storyCover,
          category: storyCategory,
          unlockPrice: isUnlimitedAccess ? null : unlockPrice,
          maxAccesses: isUnlimitedAccess ? null : maxAccesses,
          titleColor,
          textColor,
        }, currentUser.id);

        dispatchPublish(createdPost, "story");
      }

      setUploadProgress(75);

      // ─── Step 2: Post created successfully in Xeevia ──────────────────────
      // At this point, content is ALWAYS safe in Xeevia
      console.log("✅ Post created in Xeevia:", createdPost.id);

      // ─── Step 3: Start cross-platform distribution (async, non-blocking) ─
      // Only for posts and reels, not stories
      if (activeTab === "post" || activeTab === "reel") {
        setPublishedPostId(createdPost.id);
        setShowDistributionStatus(true);

        // Start distribution in the background
        // User sees UI immediately while distribution happens
        try {
          await distribution.distributePost(
            createdPost.id,
            currentUser.id,
            distribution.selectedPlatforms // Use user's selected platforms
          );
          console.log("✅ Distribution complete");
        } catch (distError) {
          console.error("⚠️ Distribution error (post still in Xeevia):", distError);
          setDistributionError(distError.message);
          // Don't rethrow - post is already safe in Xeevia
        }
      }

      setUploadProgress(100);

      // ─── Step 4: Success callback ──────────────────────────────────────
      onPublishSuccess?.(createdPost);

      // Reset form after a delay
      setTimeout(() => {
        setPostContent("");
        setPostCaption("");
        setPostMedia([]);
        setReelCaption("");
        setReelMedia(null);
        setStoryTitle("");
        setStoryContent("");
        setStoryCover(null);
        setUploadProgress(0);
        setCurrentDraftId(null);
        setHasUnsavedChanges(false);
      }, 500);

    } catch (error) {
      console.error("❌ Publish error:", error);
      // Show error only for post creation failures
      // Distribution errors are shown in DistributionStatus
    } finally {
      setLoading(false);
    }
  };

  // ─── 4. ADD PLATFORM SELECTOR TO JSX ──────────────────────────────────────
  // Add this in your render, before the publish button:

  return (
    <div className="create-view-container">
      {/* ... existing tabs and form ... */}

      {/* NEW: Platform Selector (only for post/reel tabs) */}
      {(activeTab === "post" || activeTab === "reel") && (
        <div className="distribution-section">
          <PlatformSelector
            userId={currentUser?.id}
            onSelection={(platforms) => distribution.setPlatforms(platforms)}
            initialSelection={distribution.selectedPlatforms}
          />
        </div>
      )}

      {/* Publish button (existing) */}
      <button
        className="publish-btn"
        onClick={handlePublish}
        disabled={loading || distribution.isDistributing}
      >
        {distribution.isDistributing ? "Distributing..." : "Publish"}
      </button>

      {/* NEW: Distribution Status Dashboard */}
      {showDistributionStatus && publishedPostId && (
        <div className="distribution-status-section">
          <DistributionStatus
            postId={publishedPostId}
            isVisible={true}
          />

          {distributionError && (
            <div className="error-alert">
              <p>⚠️ Distribution had issues: {distributionError}</p>
              <button onClick={() => setDistributionError(null)}>Dismiss</button>
            </div>
          )}
        </div>
      )}

      {/* ... rest of form ... */}
    </div>
  );
};

// ─── 5. ADD SOME CSS (optional, can customize) ────────────────────────────

/*
.distribution-section {
  margin: 20px 0;
  padding: 16px;
  background: rgba(132, 204, 22, 0.05);
  border-radius: 8px;
}

.distribution-status-section {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
  border-radius: 8px;
}

.error-alert {
  padding: 12px;
  background: rgba(255, 107, 107, 0.1);
  border-left: 4px solid #ff6b6b;
  border-radius: 4px;
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-alert button {
  background: none;
  border: none;
  color: #d32f2f;
  cursor: pointer;
  font-weight: 500;
}
*/

// ─── KEY POINTS ─────────────────────────────────────────────────────────────
//
// 1. Post is ALWAYS created in Xeevia first
//    If external distribution fails, post is still safe
//
// 2. Distribution happens AFTER post creation
//    Async, non-blocking, user sees UI immediately
//
// 3. User selects platforms BEFORE publishing
//    Via PlatformSelector component
//
// 4. Status dashboard shows real-time updates
//    Polling every 5 seconds for latest status
//
// 5. Retries available from UI
//    User can click "Retry" on any failed platform
//
// 6. Deep link fallback for manual posting
//    If API publishing fails, user gets manual posting link
//

// ─── TESTING THE INTEGRATION ────────────────────────────────────────────────
//
// 1. Start with mock adapter:
//    - Won't require real API credentials
//    - Simulates delays and retries
//
// 2. Test happy path:
//    - Create post
//    - Select all platforms
//    - Watch distribution status
//    - Verify all succeed
//
// 3. Test error handling:
//    - Try with disconnected platform
//    - Verify deep link generation
//    - Test retry functionality
//
// 4. Test preferences:
//    - Set per-platform preferences
//    - Save and reload
//    - Verify remembered on next post
//
// 5. Add real platforms one at a time:
//    - Start with X (simplest API)
//    - Test thoroughly
//    - Then Facebook, Instagram, LinkedIn
//
