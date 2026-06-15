// ============================================================================
// XEEVIA DISTRIBUTION INTEGRATION GUIDE
// How to integrate cross-platform distribution into CreateView
// ============================================================================

/**
 * INTEGRATION STEPS:
 * 
 * 1. In CreateView.jsx, add the distribution hook and components:
 * 
 *    import useDistribution from "../../hooks/useDistribution";
 *    import PlatformSelector from "../Distribution/PlatformSelector";
 *    import DistributionStatus from "../Distribution/DistributionStatus";
 * 
 * 2. Initialize the hook in the component:
 * 
 *    const distribution = useDistribution(currentUser?.id);
 *    const [showDistributionStatus, setShowDistributionStatus] = useState(false);
 *    const [publishedPostId, setPublishedPostId] = useState(null);
 * 
 * 3. Add PlatformSelector to your JSX (before the publish button):
 * 
 *    <PlatformSelector 
 *      userId={currentUser?.id}
 *      onSelection={(platforms) => distribution.setPlatforms(platforms)}
 *      initialSelection={distribution.selectedPlatforms}
 *    />
 * 
 * 4. Modify the publish handler to trigger distribution:
 * 
 *    const handlePublish = async () => {
 *      try {
 *        // 1. Create post normally
 *        const post = await createService.createPost(postData, currentUser.id);
 *        
 *        // 2. Start distribution (optional - can be async)
 *        setPublishedPostId(post.id);
 *        setShowDistributionStatus(true);
 *        
 *        await distribution.distributePost(post.id);
 *        
 *        // 3. Show success feedback
 *        onPublishSuccess?.(post);
 *      } catch (error) {
 *        // Handle error
 *      }
 *    };
 * 
 * 5. Add DistributionStatus component to your JSX:
 * 
 *    {showDistributionStatus && (
 *      <DistributionStatus 
 *        postId={publishedPostId}
 *        isVisible={true}
 *      />
 *    )}
 * 
 * PLATFORM CONFIGURATION:
 * 
 * The system supports these platforms (easily extensible):
 * - X (Twitter)
 * - Facebook
 * - Instagram
 * - LinkedIn
 * 
 * Add new platforms:
 * 1. Create adapter in src/services/distribution/adapters/PlatformAdapter.js
 * 2. Extend BaseAdapter
 * 3. Register in platformAdapterFactory.js
 * 4. Add to platforms list in PlatformSelector.jsx
 * 
 * PLATFORM ADAPTER PATTERN:
 * 
 * class MyPlatformAdapter extends BaseAdapter {
 *   constructor() {
 *     super("PlatformName", "https://api.platform.com/v1");
 *   }
 *   
 *   async publishPost(encryptedToken, post, platformUserId) {
 *     // Decrypt token, call API, return external post ID
 *     const token = await this.decryptToken(encryptedToken);
 *     const content = this.formatContent(post.content, 280);
 *     const mediaUrls = this.getMediaUrls(post);
 *     
 *     // API call logic...
 *     return externalPostId;
 *   }
 *   
 *   generateDeepLink(post) {
 *     // Return { url, instructions } for fallback
 *     return {
 *       url: "https://...",
 *       instructions: ["Step 1", "Step 2"]
 *     };
 *   }
 * }
 * 
 * TOKEN MANAGEMENT:
 * 
 * Tokens are stored encrypted in the database:
 * - Stored in: tokens table
 * - Associated with: connections(connection_id)
 * - Decryption: Handled by adapter's decryptToken() method
 * 
 * For development, modify BaseAdapter.decryptToken() to skip decryption
 * 
 * DATABASE SCHEMA:
 * 
 * post_distribution:
 *   - Tracks each platform's publishing status
 *   - status: 'pending' | 'publishing' | 'success' | 'failed'
 *   - external_post_id: ID from the platform API
 *   - error_message: If failed, reason why
 * 
 * platform_distribution_preferences:
 *   - User's per-platform publishing settings
 *   - global_default_enabled: Post to all connected platforms by default
 *   - platform_preferences: { "x": { enabled: true }, ... }
 * 
 * distribution_queue:
 *   - Queue of posts pending distribution
 *   - Used for async processing and retry logic
 * 
 * ERROR HANDLING & RETRY:
 * 
 * - Automatic retry: 3 attempts with exponential backoff
 * - Failed distributions create fallback deep links
 * - User can manually retry from DistributionStatus UI
 * - All errors logged in post_distribution table
 * 
 * USAGE PATTERNS:
 * 
 * 1. Simple one-time override:
 *    const result = await distribution.distributePost(postId, ["x", "instagram"]);
 * 
 * 2. Use user's default preferences:
 *    const result = await distribution.distributePost(postId);
 * 
 * 3. Check status:
 *    const status = await distribution.getStatus(postId);
 *    // Returns: { total, successful, failed, pending, byPlatform }
 * 
 * 4. Retry failed platform:
 *    await distribution.retryDistribution(postId, "facebook");
 * 
 * ADVANCED: ASYNC DISTRIBUTION
 * 
 * For large-scale deployments, distribution can be moved to:
 * - Supabase Edge Functions (serverless)
 * - Background job queue (e.g., Bull, Celery)
 * - Webhook handlers for platform events
 * 
 * Current pattern: Synchronous from client (can timeout on slow networks)
 * Recommended: Trigger distribution job on server, poll status from client
 * 
 * TESTING ADAPTERS:
 * 
 * Mock adapter for testing:
 * 
 * class MockAdapter extends BaseAdapter {
 *   async publishPost(token, post, userId) {
 *     // Simulate API delay
 *     await new Promise(r => setTimeout(r, 1000));
 *     // Return mock post ID
 *     return `mock-${Date.now()}`;
 *   }
 * }
 * 
 * Enable in development:
 * platformAdapterFactory.registerAdapter("mock", new MockAdapter());
 * 
 */

export const XEEVIA_DISTRIBUTION_GUIDE = {
  platforms: ["x", "facebook", "instagram", "linkedin"],
  features: [
    "One-click multi-platform publishing",
    "Per-platform default preferences",
    "Automatic retry with exponential backoff",
    "Fallback deep links for manual posting",
    "Real-time distribution status dashboard",
    "User-controlled platform selection",
    "Failed post recovery",
  ],
  integration: {
    components: [
      "PlatformSelector - UI for platform selection",
      "DistributionStatus - Status dashboard",
    ],
    hooks: [
      "useDistribution - Distribution state and methods",
    ],
    services: [
      "distributionService - Core distribution engine",
    ],
  },
};
