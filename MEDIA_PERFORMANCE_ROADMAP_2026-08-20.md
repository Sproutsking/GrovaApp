# Grova Media Performance Roadmap

**Update date:** 2026-08-20  
**Purpose:** Make posts, reels, stories, status updates, news media, and chat media feel instant while keeping bandwidth, memory, and battery usage under control.

## Decision

Grova will use a unified media delivery pipeline:

- **Cloudinary** for responsive images, avatars, post images, story covers, and video thumbnails.
- **Adaptive video streaming** through Cloudflare Stream or Cloudinary HLS/DASH for reels and longer video.
- **One shared media component** for every media surface in the app.
- **Cursor-based feed pagination** with background fetching of the next page.
- **Small predictive prefetch windows** based on viewport position and scroll direction.
- **Memory and IndexedDB caching** for feed metadata and small thumbnails.
- **Service-worker caching** for thumbnails and static assets, not unrestricted full-video caching.

The goal is an instant visual response, not downloading the entire feed before the user reaches it.

## Implementation Log

### 2026-08-20: Phase 1 media budget update

- Feed-oriented Cloudinary image helpers now default to `auto:good`.
- Removed generated duplicate image candidates from the shared preload engine.
- Reduced first-paint image preloading from ten items to six.
- Bounded shared image prefetching to a small anchor window with lower concurrency.
- Reduced post and unified-feed render and preload windows.
- Reduced speculative video metadata preloading to the next one to three positions.
- Reduced reel thumbnail preloading and removed `auto:best` from pipeline thumbnails.
- Cloudinary video and adaptive-stream requests now bypass the service-worker object cache; thumbnails and images remain cacheable.

The production build passed after these changes. Adaptive streaming, the shared `MediaAsset` component, cursor-level feed caching, and asynchronous upload processing remain the next phases.

### 2026-08-20: Pipeline resilience update

- Added session-backed stale data for injected feed pipelines so repeat visits can render immediately.
- Added a bounded 3.5-second request window so slow or stalled secondary queries cannot leave skeleton strips on screen indefinitely.
- Scoped People You Might Know cache entries to the signed-in user.
- Added an explicit no-user loading exit for the follows pipeline.
- Preserved deterministic gradient and initials fallbacks while profile and reel media arrive.

### 2026-08-20: Post video parity update

- Ordinary post videos now use the same normalized source and poster-first model as reels.
- Added safe MP4 source candidates for post video IDs and direct stored URLs.
- Added poster resolution from video metadata, post images, or a generated video thumbnail.
- Changed fullscreen post video loading to metadata-first so the poster paints before buffering.
- Added fullscreen source retry when a provider URL fails.

### 2026-08-20: Profile post preview update

- Profile post grids now resolve `video_ids` into Cloudinary poster thumbnails.
- Profile post previews fall back to extracting a frame from the actual video when no poster loads.
- User profile modal cards now recognize post videos as playable media instead of treating them as image-only posts.

### 2026-08-20: Text post preview update

- Added dedicated text-post previews to the profile grid and user profile modal.
- Text previews use the saved text-card gradient, color, and alignment metadata when available.
- Added a clear `TEXT POST` marker and compact readable excerpt so text content is visually distinct from image and video media.
- Added a polished fallback gradient for ordinary text-only posts without text-card metadata.

### 2026-08-20: XRC verification search and dashboard update

- Connected the Oracle UI to the XRC service `smartSearch` path instead of the limited single-record search calls.
- Added profile and username resolution, including `@username` and pasted profile links.
- Added selectable result cards for matching profiles, posts, reels, transactions, record IDs, and event activity.
- Selecting a result with an actor now opens that profile directly on the verification dashboard.
- The selected XRC record is injected into the dashboard as high-trust evidence so the searched result is visible immediately.
- Record-only results still open the Oracle network and trace view for chain-level inspection.

## Current State

The repository already contains useful performance infrastructure:

- Cloudinary upload and transformation URLs in `src/services/upload/uploadService.js`.
- Shared media URL generation and preload helpers in `src/services/shared/mediaUrlService.js`.
- Cloudflare Stream support in `src/services/config/cloudflare.js`.
- Several feed and reel preload paths in `src/components/Home/preloadEngine.js`, `FeedTab.jsx`, `PostTab.jsx`, `ReelsTab.jsx`, and `FeedPipelines.jsx`.
- IntersectionObserver-based visibility handling in feed, reel, story, discovery, and news components.
- A service worker with a Cloudinary cache in `public/service-worker.js`.

The main problem is fragmentation. Multiple components make their own loading and preloading decisions. Some paths also generate fallback candidate URLs, use high-quality variants for feed thumbnails, or preload too many hidden videos. That can increase duplicate requests and make mobile performance worse even when the screen appears fast on a strong connection.

## Target Media Contract

Every media-bearing record should eventually expose a stable asset shape:

```js
{
  id: "asset-id",
  kind: "image|video",
  status: "processing|ready|failed",
  thumbnailUrl: "https://...",
  imageUrl: "https://...",
  srcSet: "...",
  streamUrl: "https://.../manifest/video.m3u8",
  fallbackUrl: "https://...mp4",
  width: 1080,
  height: 1920,
  duration: 18.4,
  posterTime: 0
}
```

Posts, reels, stories, status updates, news, profiles, messages, and discovery items should consume this contract instead of reconstructing provider URLs independently.

## Delivery Rules

### Images

- Use responsive widths such as 320, 640, 960, and 1280 pixels.
- Use `f_auto` and `q_auto` or the equivalent provider settings.
- Use `auto:good` for normal feed thumbnails and `auto:best` only for detail/fullscreen views.
- Use a tiny placeholder or low-quality preview for immediate paint.
- Request only the width needed by the rendered container.
- Return the final thumbnail URL from the feed API when possible so the client does not generate multiple candidates.

### Video

- Render the thumbnail first.
- Attach the stream only when the item is visible or immediately ahead of the viewport.
- Prefer HLS/DASH for playback and retain MP4 only as a fallback.
- Keep one actively playing feed video where practical.
- Pause videos that leave the viewport.
- Release or unload videos more than two or three positions away.
- Do not preload full video files for large portions of the feed.

### Prefetching

Use a small priority runway:

| Distance from viewport | Action |
| --- | --- |
| Visible | Load immediately and play when allowed |
| Next 1 item | Preload thumbnail and video metadata |
| Next 2 items | Preload thumbnail; optionally prepare the stream on fast connections |
| Further away | Fetch metadata only; no hidden full-video preload |

The runway should respond to scroll direction. If the user scrolls down, prioritize items below the anchor. If the user scrolls up, prioritize items above it.

Respect `navigator.connection.saveData`, effective connection type, battery conditions where available, and reduced-motion preferences.

## Unified Media Component

Create a shared `MediaAsset` component and move media behavior into it. It should own:

- Placeholder and poster rendering.
- Responsive image selection.
- Thumbnail-to-video transition.
- IntersectionObserver visibility state.
- Autoplay, pause, and mute behavior.
- Retry and fallback handling.
- Provider selection between image, HLS/DASH, and MP4.
- Fetch priority and preload policy.
- Cleanup of detached video elements.

Existing components should become presentation wrappers around this component rather than implementing independent preload logic.

## Feed Architecture

The feed should render metadata before waiting for all media:

```text
Request feed page
  -> return post metadata and thumbnail URLs
  -> render immediately with placeholders
  -> load visible media
  -> prefetch the next cursor page
  -> prepare the next one or two media items
```

Use cursor pagination with a modest page size, such as 20 items. Fetch the next page when the user reaches approximately 60-70% of the current page. Keep the current and next page in a shared query cache so navigating between feed, reels, stories, and fullscreen views does not refetch the same records.

## Upload and Processing Pipeline

Uploads should be separated from publication:

```text
Client upload
  -> create media asset with processing status
  -> transcode and generate thumbnail/manifest
  -> provider webhook marks asset ready
  -> post or reel becomes fully publishable
```

`src/services/upload/uploadService.js` currently uploads directly to Cloudinary and returns the uploaded resource. The next version should also persist a media asset record containing processing status, provider identifiers, thumbnail URL, stream URL, dimensions, duration, and byte size.

The client should show upload progress and a processing state. A failed transcode should be visible and retryable rather than producing a feed item with a broken media URL.

## Cache Strategy

### Browser memory

Cache the current feed page, next feed page, and recently resolved media URLs for the active session.

### IndexedDB

Store:

- Feed metadata.
- Cursor positions.
- Small thumbnails and posters where useful.
- Recently viewed story/reel metadata.

Do not use IndexedDB as a general-purpose full-video store.

### Service worker

Keep static assets and thumbnails aggressively cached. Treat full video separately. Avoid caching arbitrary Cloudinary video responses because range requests and large objects can create incomplete responses, high storage use, and eviction pressure.

The Cloudinary fetch branch in `public/service-worker.js` should eventually distinguish image/thumbnail requests from video and streaming requests.

## Rollout Plan

### Phase 1: Fastest visible improvement

1. Change feed thumbnails from `auto:best` to `q_auto` or `auto:good`.
2. Add responsive image variants and `srcSet` to post, story, profile, news, and reel thumbnail components.
3. Remove duplicate candidate URL generation from the first-paint path.
4. Consolidate duplicate image and video preloader implementations.
5. Reduce the video runway to the visible item plus the next one or two items.
6. Return stable thumbnail URLs with feed data.

### Phase 2: Reel playback

1. Standardize reel playback on adaptive streaming.
2. Add the shared `MediaAsset` component.
3. Use thumbnail-first rendering.
4. Enforce active-video limits and pause distant videos.
5. Add connection-aware quality selection.

### Phase 3: Feed readiness

1. Introduce shared cursor-based feed caching.
2. Prefetch the next page at 60-70% scroll progress.
3. Prefetch according to scroll direction.
4. Store feed metadata and selected thumbnails in IndexedDB.
5. Preserve the last usable feed page for fast return navigation.

### Phase 4: Upload processing

1. Add a media asset table and processing states.
2. Generate thumbnails, dimensions, duration, and streaming manifests asynchronously.
3. Add provider webhook handling.
4. Publish media-bearing content only after the asset is ready.
5. Add retry and moderation hooks before publication.

## Acceptance Criteria

The work is successful when these are measured on a mid-range mobile device and a simulated 4G connection:

- First visible image or poster appears within 500 ms after feed data is available.
- Returning to the feed shows the first viewport from memory or browser cache without a blank media state.
- The next reel starts within approximately 500 ms after the user swipes to it when the runway was available.
- Scrolling through 50 feed items does not create more than a small bounded number of active video elements.
- Distant videos pause and release resources.
- Feed thumbnails do not request 1920-pixel assets inside small cards.
- Save-Data and slow connections reduce preload work and video quality.
- Service-worker storage does not grow without bound from full video responses.
- Media errors show a usable poster or fallback instead of a blank or black card.
- Upload completion and media processing status are observable and retryable.

## Metrics to Add

Track these timings and counters:

- Feed request start to first metadata render.
- Feed request start to first visible media paint.
- Thumbnail paint to video playback start.
- Rebuffer count and total rebuffer duration.
- Media cache hit rate.
- Average bytes downloaded per feed session.
- Number of active video elements.
- Prefetch requests that were actually viewed.
- Upload time and processing time.
- Media processing failure rate.

## Guiding Principle

The app should spend bandwidth on what the user can see and what they are most likely to see next. Everything else should remain metadata, a thumbnail, or a cached reference until demand makes the full media necessary.
