// src/services/feeds/videoNavigationService.js — v1 ELITE VIDEO NAVIGATION
//
// ═══════════════════════════════════════════════════════════════════════════
// PURPOSE:
//
// [NAV-1]    Track video playback context across all pipelines (news, reels,
//            discovery, trending). When a user clicks video from ANY source,
//            capture: sourceTab, sourcePipeline, sourcePosition, videoId.
//
// [NAV-2]    On video close, renavigate to source tab and scroll to the
//            exact position the user clicked from. Supports instant playback
//            resumption at the saved position.
//
// [NAV-3]    Persistent video history (per session) so users can navigate
//            between videos without losing context. Back button returns to
//            the source pipeline.
//
// [REGISTRY] Module-level VideoContextRegistry stores:
//            - currentVideo: { id, pipeline, tab, position, thumbnail }
//            - history: [{ video, source, timestamp }]
//            - pipelines: { [pipeline]: { items, viewport, scrollPos } }
// ═══════════════════════════════════════════════════════════════════════════

// ─── Module-level registry ────────────────────────────────────────────────────
const VideoContextRegistry = {
  currentVideo: null,
  history: [],
  pipelines: new Map(),
  listeners: [],
  MAX_HISTORY: 50,
};

// ─── Subscribe to video navigation events ──────────────────────────────────
export function subscribeToVideoNavigation(callback) {
  VideoContextRegistry.listeners.push(callback);
  return () => {
    const idx = VideoContextRegistry.listeners.indexOf(callback);
    if (idx > -1) VideoContextRegistry.listeners.splice(idx, 1);
  };
}

// ─── Internal event broadcaster ────────────────────────────────────────────
function broadcastVideoChange() {
  VideoContextRegistry.listeners.forEach(cb => {
    try {
      cb(VideoContextRegistry.currentVideo);
    } catch (err) {
      console.error("Video navigation listener error:", err);
    }
  });
}

// ─── Register pipeline snapshot ────────────────────────────────────────────────
export function registerPipelineContext(pipelineKey, context) {
  if (!context || typeof context !== "object") return;
  VideoContextRegistry.pipelines.set(pipelineKey, {
    items: context.items || [],
    viewport: context.viewport || null,
    scrollPos: context.scrollPos || 0,
    timestamp: Date.now(),
    metadata: context.metadata || {},
  });
}

// ─── Get pipeline snapshot ─────────────────────────────────────────────────
export function getPipelineContext(pipelineKey) {
  return VideoContextRegistry.pipelines.get(pipelineKey) || null;
}

// ─── Record video playback start ───────────────────────────────────────────
export function recordVideoPlay(videoData) {
  const video = {
    id: videoData.id,
    pipeline: videoData.pipeline || "unknown",
    tab: videoData.tab || "feeds",
    position: videoData.position || 0,
    type: videoData.type || "reel",
    thumbnail: videoData.thumbnail || null,
    title: videoData.title || "",
    userId: videoData.userId || null,
    timestamp: Date.now(),
  };

  VideoContextRegistry.currentVideo = video;
  VideoContextRegistry.history.push({
    video,
    source: videoData.source || "direct",
    timestamp: Date.now(),
  });

  // Trim history
  if (VideoContextRegistry.history.length > VideoContextRegistry.MAX_HISTORY) {
    VideoContextRegistry.history.shift();
  }

  broadcastVideoChange();
  return video;
}

// ─── Get current video context ─────────────────────────────────────────────
export function getCurrentVideoContext() {
  return VideoContextRegistry.currentVideo;
}

// ─── Get video history ────────────────────────────────────────────────────
export function getVideoHistory() {
  return [...VideoContextRegistry.history];
}

// ─── Navigate to previous video in history ────────────────────────────────
export function navigatePreviousVideo() {
  if (VideoContextRegistry.history.length < 2) return null;
  VideoContextRegistry.history.pop(); // Remove current
  const previous = VideoContextRegistry.history[VideoContextRegistry.history.length - 1];
  if (previous) {
    VideoContextRegistry.currentVideo = previous.video;
    broadcastVideoChange();
    return previous.video;
  }
  return null;
}

// ─── Clear current video (on close) ────────────────────────────────────
export function clearCurrentVideo() {
  VideoContextRegistry.currentVideo = null;
  broadcastVideoChange();
}

// ─── Get relocation target (where to go when video closes) ────────────────────
export function getRelocationTarget() {
  if (!VideoContextRegistry.currentVideo) return null;

  const { pipeline, tab, position } = VideoContextRegistry.currentVideo;
  const pipelineCtx = VideoContextRegistry.pipelines.get(pipeline);

  return {
    tab,
    pipeline,
    position,
    context: pipelineCtx,
  };
}

// ─── Video position tracker for resume ─────────────────────────────────────
const _videoProgress = new Map();

export function recordVideoProgress(videoId, currentTime, duration) {
  if (!videoId) return;
  _videoProgress.set(videoId, {
    currentTime,
    duration,
    progress: duration > 0 ? (currentTime / duration) * 100 : 0,
    timestamp: Date.now(),
  });
}

export function getVideoProgress(videoId) {
  return _videoProgress.get(videoId) || null;
}

// ─── Smart pipeline selector based on content type ────────────────────────────
export function getPipelineForContent(content) {
  if (!content) return "unknown";

  // Detect content type
  if (content.is_news || content.source_name) return "news";
  if (content.type === "reel" || content.video_id) return "reels";
  if (content.category === "trending") return "trending";
  if (content.isDiscovery) return "discovery";

  return "unknown";
}

// ─── Build shareable video context URL ──────────────────────────────────────
export function buildVideoContextUrl(videoData) {
  if (!videoData?.id) return null;

  const params = new URLSearchParams({
    video: videoData.id,
    pipeline: videoData.pipeline || "reels",
    tab: videoData.tab || "feeds",
    position: videoData.position || 0,
  });

  return `${window.location.origin}?${params.toString()}`;
}

// ─── Parse video context from URL params ──────────────────────────────────
export function parseVideoContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get("video");

  if (!videoId) return null;

  return {
    id: videoId,
    pipeline: params.get("pipeline") || "reels",
    tab: params.get("tab") || "feeds",
    position: parseInt(params.get("position") || "0", 10),
  };
}

// ─── Export entire registry for debugging ──────────────────────────────────
export function getVideoRegistry() {
  return {
    current: VideoContextRegistry.currentVideo,
    history: VideoContextRegistry.history,
    pipelines: Object.fromEntries(VideoContextRegistry.pipelines),
    listenerCount: VideoContextRegistry.listeners.length,
  };
}

// ─── Clear all video context (e.g., on logout) ────────────────────────────
export function clearVideoRegistry() {
  VideoContextRegistry.currentVideo = null;
  VideoContextRegistry.history = [];
  VideoContextRegistry.pipelines.clear();
  broadcastVideoChange();
}

export default {
  subscribeToVideoNavigation,
  registerPipelineContext,
  getPipelineContext,
  recordVideoPlay,
  getCurrentVideoContext,
  getVideoHistory,
  navigatePreviousVideo,
  clearCurrentVideo,
  getRelocationTarget,
  recordVideoProgress,
  getVideoProgress,
  getPipelineForContent,
  buildVideoContextUrl,
  parseVideoContextFromUrl,
  getVideoRegistry,
  clearVideoRegistry,
};
