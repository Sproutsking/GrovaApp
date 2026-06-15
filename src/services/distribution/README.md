# Xeevia Social Distribution System

A unified publishing engine that allows users to create content once and distribute it intelligently across multiple connected social platforms.

## 🎯 Core Principle

**Xeevia is the creation hub. External platforms are distribution nodes.**

- Content is created and stored in Xeevia (canonical version)
- Publishing is optional — posts work perfectly on Xeevia alone
- External platforms are distribution targets, never dependencies
- If external posting fails, Xeevia post remains intact

## 📦 System Architecture

### Database Layer (`supabase/migrations/002_create_distribution_tables.sql`)

```
post_distribution
├─ Tracks each post's publishing status per platform
├─ Fields: post_id, platform, status, external_post_id, error_message, retry_count
└─ Status: 'pending' | 'publishing' | 'success' | 'failed'

platform_distribution_preferences
├─ User's per-platform distribution settings
├─ Fields: user_id, platform_preferences, global_default_enabled, auto_retry
└─ Allows fine-grained control over which platforms to publish to

distribution_queue
├─ Queue of posts pending cross-platform distribution
├─ Used for async processing and batch operations
└─ Tracks processing status and errors

distribution_deep_links
├─ Fallback URLs for manual posting if API publishing fails
├─ Platform-specific instructions for user
└─ Generated when automated publishing cannot complete
```

### Service Layer (`src/services/distribution/`)

#### `distributionService.js` - Main Orchestration Engine

**Core Methods:**

- `distributePost(postId, userId, selectedPlatforms)` - Main pipeline
  - Determines target platforms
  - Creates distribution records
  - Publishes to all platforms in parallel
  - Handles retries and fallbacks

- `getPublishTargets(userId, selectedPlatforms, overrideDefaults)` - Smart platform selection
  - Respects user preferences
  - Filters to connected platforms only
  - Supports one-time overrides

- `publishToSinglePlatform(postId, userId, post, platform)` - Individual platform publishing
  - Gets platform adapter
  - Fetches encrypted token
  - Executes publishing with 3-attempt retry logic
  - Falls back to deep link on failure

- `getDistributionStatus(postId)` - Status tracking
  - Returns summary: total, successful, failed, pending
  - Platform-specific details with external post IDs

- `retryFailedDistribution(postId, platform)` - Recovery mechanism
  - Resets failed distribution record
  - Executes publishing again

#### Platform Adapters (`src/services/distribution/adapters/`)

Each social platform gets a dedicated adapter extending `BaseAdapter`:

**`BaseAdapter.js` - Common Patterns**
- `publishPost()` - Platform API publishing (must implement)
- `generateDeepLink()` - Fallback URL generation (must implement)
- `validatePost()` - Pre-publish validation
- `formatContent()` - Respect platform character limits
- `getMediaUrls()` - Extract all media from post
- `shouldRetry()` - Smart retry logic

**Platform-Specific Adapters:**

- **`XAdapter.js`** (X/Twitter)
  - 280 character limit
  - Media upload via separate endpoint
  - Deep link: twitter.com/intent/tweet

- **`FacebookAdapter.js`** (Facebook)
  - Multi-image support
  - Link sharing via graph API
  - Deep link: facebook.com/sharer

- **`InstagramAdapter.js`** (Instagram)
  - Reels (video)
  - Carousel (multiple images)
  - Single image posts
  - Deep link: instagram.com/create

- **`LinkedInAdapter.js`** (LinkedIn)
  - Professional text-focused
  - Media with metadata
  - 3000 character limit
  - Deep link: linkedin.com/feed

### React Components (`src/components/Distribution/`)

#### `PlatformSelector.jsx`
**Purpose:** Allow users to choose which platforms to distribute to

**Features:**
- Visual grid of connected platforms
- Toggle individual platforms or "Post Everywhere"
- Per-platform preference settings
- Settings panel for advanced options
- Real-time validation

**Props:**
```jsx
<PlatformSelector 
  userId={currentUser.id}
  onSelection={(platforms) => handleSelection(platforms)}
  initialSelection={["x", "instagram"]}
/>
```

**CSS:** `PlatformSelector.css`
- Grid layout responsive design
- Platform cards with status indicators
- Settings panel with toggle UI
- Loading and interactive states

#### `DistributionStatus.jsx`
**Purpose:** Show post distribution results and recovery options

**Features:**
- Real-time status for each platform
- Retry button for failed distributions
- Copy external post IDs
- Links to view posts on each platform
- Success/failure indicators
- Status polling (5-second intervals)

**Props:**
```jsx
<DistributionStatus 
  postId={post.id}
  isVisible={true}
/>
```

**CSS:** `DistributionStatus.css`
- Status badges with color coding
- Platform status cards
- Error messages and retry UI
- Success summary
- Responsive mobile layout

### Hooks (`src/hooks/`)

#### `useDistribution.js`
**Purpose:** Encapsulate distribution state and methods

**Hook API:**
```javascript
const distribution = useDistribution(userId);

// State
distribution.selectedPlatforms    // Array of selected platforms
distribution.isDistributing       // Publishing in progress
distribution.distributionError    // Error message if failed
distribution.distributionStatus   // Distribution result summary

// Methods
await distribution.distributePost(postId, platforms?)
await distribution.retryDistribution(postId, platform)
await distribution.getStatus(postId)
distribution.setPlatforms(platforms)
distribution.clearState()
```

### Data Models (`src/models/`)

#### `DistributionModel.js`
Low-level database operations for distribution tables:

- `getDistributionRecord(postId, platform)` - Fetch single record
- `getPostDistributions(postId)` - All platforms for a post
- `getUserDistributionHistory(userId)` - User's distribution history
- `createDistributionRecord()` - Initialize distribution
- `updateDistributionStatus()` - Update platform status
- `markSuccess()` / `markFailed()` - Status shortcuts
- `getPreferences()` / `savePreferences()` - User settings
- `getDistributionStats()` - Analytics aggregation

## 🔄 Publishing Flow

```
1. User creates content in CreateView
   ↓
2. User clicks "Publish"
   ↓
3. PlatformSelector shows connected platforms
   ↓
4. User selects platforms (or uses "Post Everywhere" default)
   ↓
5. Post created in Xeevia (guaranteed)
   ↓
6. Distribution pipeline starts (parallel, non-blocking):
   For each selected platform:
   ├─ Check connection & permissions
   ├─ Get encrypted token
   ├─ Call platform API
   ├─ Retry up to 3 times with exponential backoff
   └─ If all retries fail:
      ├─ Generate deep link fallback
      └─ Notify user with recovery option
   ↓
7. DistributionStatus dashboard shows results
   ↓
8. User can retry failed platforms from UI
```

## 🛡️ Failure Handling

### Retry Strategy
- **Automatic retries:** 3 attempts per platform
- **Backoff:** Exponential (1s, 2s, 4s)
- **Triggers:** Network errors, server errors (5xx)
- **Skips:** Authentication errors (401/403)

### Fallback Deep Links
When API publishing fails after retries:
1. Generate platform-specific deep link
2. Store in `distribution_deep_links` table
3. User can manually complete posting
4. Content never lost

### Error Tracking
All errors logged in `post_distribution` table:
- Error message
- Retry count
- Timestamp
- Platform-specific details

## 👤 User Control System

### Default Preferences
- **"Post Everywhere"** - Publish to all connected platforms automatically
- **Per-platform toggles** - Enable/disable specific platforms
- **Auto-retry** - Automatically retry failed distributions

### One-Time Overrides
```javascript
// Override default behavior for this post
await distribution.distributePost(postId, ["x", "instagram"]);
```

### View/Change Preferences
- Via PlatformSelector settings panel
- Persistent in `platform_distribution_preferences` table
- Per-user configuration

## 📊 Status Tracking

### Post Distribution Summary
```javascript
const status = await distribution.getDistributionStatus(postId);
// Returns:
{
  total: 4,
  successful: 3,
  failed: 1,
  pending: 0,
  byPlatform: {
    x: { status: "success", externalPostId: "123...", publishedAt: "..." },
    instagram: { status: "failed", error: "Reels require 15+ seconds", ... },
    facebook: { status: "success", externalPostId: "456...", ... },
    linkedin: { status: "success", externalPostId: "789...", ... }
  }
}
```

### Dashboard Features
- Real-time status updates (5s polling)
- Per-platform result indicators
- Retry buttons for failures
- Copy post ID functionality
- Links to view on each platform

## 🔌 Platform Integration

### Add a New Platform

1. **Create adapter:**
```javascript
// src/services/distribution/adapters/TikTokAdapter.js
import BaseAdapter from "./BaseAdapter";

class TikTokAdapter extends BaseAdapter {
  constructor() {
    super("TikTok", "https://open.tiktokapis.com/v1");
  }

  async publishPost(encryptedToken, post, platformUserId) {
    // Implementation
  }

  generateDeepLink(post) {
    return { url, instructions };
  }
}

export default TikTokAdapter;
```

2. **Register in factory:**
```javascript
// platformAdapterFactory.js
import TikTokAdapter from "./adapters/TikTokAdapter";

this.adapters.tiktok = new TikTokAdapter();
```

3. **Add to UI:**
```javascript
// PlatformSelector.jsx
const platforms = {
  // ... existing
  tiktok: {
    name: "TikTok",
    icon: Music,
    color: "#000000",
    description: "Short-form video",
  },
};
```

## 🚀 Deployment Considerations

### Token Management
- Tokens stored encrypted in database
- Decryption handled by adapters
- Token rotation supported via `tokens` table

### Scaling
For high-volume publishing:
1. Move distribution to Supabase Edge Functions (serverless)
2. Use background job queue for retries
3. Implement webhook handlers for platform events
4. Add queue monitoring/metrics

### API Rate Limiting
- Respect platform rate limits
- Implement backoff strategies
- Queue excess requests
- Monitor quota usage

### Security
- Never log full tokens
- Validate token permissions before publishing
- Sanitize user content before sending to platforms
- Audit distribution access
- Implement permission checks

## 📝 Configuration

### Environment Variables (if needed)
```
XEEVIA_ENABLE_DISTRIBUTION=true
DISTRIBUTION_RETRY_ATTEMPTS=3
DISTRIBUTION_RETRY_BACKOFF_MS=1000
DISTRIBUTION_POLL_INTERVAL=5000
```

### Database Setup
```sql
-- Run migration
psql -U postgres -d xeevia -f supabase/migrations/002_create_distribution_tables.sql
```

## 🧪 Testing

### Mock Adapter
```javascript
import BaseAdapter from "./BaseAdapter";

class MockAdapter extends BaseAdapter {
  async publishPost(token, post, userId) {
    await new Promise(r => setTimeout(r, 500));
    return `mock-${Date.now()}`;
  }

  generateDeepLink(post) {
    return { url: "https://mock.test", instructions: [] };
  }
}

platformAdapterFactory.registerAdapter("mock", new MockAdapter());
```

### Test Distribution Flow
```javascript
const result = await distribution.distributePost(
  postId,
  userId,
  ["mock", "x"]  // Use mock adapter
);
```

## 📚 Related Files

**Database:**
- `supabase/migrations/002_create_distribution_tables.sql`

**Services:**
- `src/services/distribution/distributionService.js`
- `src/services/distribution/platformAdapterFactory.js`
- `src/services/distribution/adapters/*.js`

**Components:**
- `src/components/Distribution/PlatformSelector.jsx`
- `src/components/Distribution/DistributionStatus.jsx`

**Hooks:**
- `src/hooks/useDistribution.js`

**Models:**
- `src/models/DistributionModel.js`

## 🤝 Integration Checklist

- [ ] Run migration: `002_create_distribution_tables.sql`
- [ ] Import PlatformSelector in CreateView
- [ ] Import DistributionStatus in CreateView
- [ ] Add useDistribution hook to CreateView
- [ ] Modify publish handler to call distribution
- [ ] Test with mock adapter first
- [ ] Connect real platforms (X, Facebook, Instagram, LinkedIn)
- [ ] Test deep link fallback
- [ ] Verify error handling and retries
- [ ] Monitor distribution status in production

## 🔐 Non-Negotiable Rules

1. **Xeevia is always the origin** - Post created in Xeevia first
2. **Never lose content** - Always stored locally before external distribution
3. **Preserve canonical version** - Xeevia post is the source of truth
4. **Optional distribution** - External posting doesn't block local publishing
5. **User control** - Always respect user's platform preferences
6. **Graceful fallback** - Deep links provide manual posting option
7. **Transparent status** - Users always know where their post was published

---

Built with ❤️ for Xeevia - Publish Once. Reach Everywhere.
