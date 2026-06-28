import React from "react";
import mediaUrlService from "../../services/shared/mediaUrlService";

const TIER = { CRITICAL: 0, URGENT: 1, BATCH: 2 };
const _SLOTS = { [TIER.CRITICAL]: 12, [TIER.URGENT]: 8, [TIER.BATCH]: 4 };
const _queues = { [TIER.CRITICAL]: [], [TIER.URGENT]: [], [TIER.BATCH]: [] };
const _done = new Set();
const _flying = { [TIER.CRITICAL]: 0, [TIER.URGENT]: 0, [TIER.BATCH]: 0 };
const _headSet = new Set();
let _idleHandle = null;

function getCld() {
  return (
    window.__CLD_CLOUD__ ||
    window.__CLOUDINARY_CLOUD__ ||
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    null
  );
}

function _injectHead(url) {
  if (!url || _headSet.has(url)) return;
  _headSet.add(url);
  try {
    const l = document.createElement("link");
    l.rel = "preload";
    l.as = "image";
    l.href = url;
    l.fetchPriority = "high";
    document.head.appendChild(l);
  } catch {}
}

function _drainTier(tier) {
  while (_flying[tier] < _SLOTS[tier] && _queues[tier].length > 0) {
    const url = _queues[tier].shift();
    _flying[tier]++;
    const img = new Image();
    const done = () => { _flying[tier]--; _drainTier(tier); };
    img.onload = done;
    img.onerror = done;
    if (tier === TIER.CRITICAL) img.fetchPriority = "high";
    if (tier === TIER.BATCH) img.fetchPriority = "low";
    img.src = url;
  }
}

function _drain() {
  _drainTier(TIER.CRITICAL);
  _drainTier(TIER.URGENT);
  if (_queues[TIER.BATCH].length && !_idleHandle) {
    if (typeof requestIdleCallback !== "undefined") {
      _idleHandle = requestIdleCallback(() => { _idleHandle = null; _drainTier(TIER.BATCH); }, { timeout: 2000 });
    } else {
      setTimeout(() => _drainTier(TIER.BATCH), 150);
    }
  }
}

function schedulePreload(url, tier = TIER.BATCH) {
  if (!url || typeof url !== "string") return;
  if (tier === TIER.CRITICAL) _injectHead(url);
  if (_done.has(url)) {
    for (let t = tier + 1; t <= TIER.BATCH; t++) {
      const idx = _queues[t].indexOf(url);
      if (idx !== -1) {
        _queues[t].splice(idx, 1);
        _queues[tier].unshift(url);
        _drain();
        return;
      }
    }
    return;
  }
  _done.add(url);
  _queues[tier].push(url);
  _drain();
}

function buildAllCandidates(id, opts = {}) {
  if (!id || typeof id !== "string" || !id.trim()) return [];
  const clean = id.trim();
  const w = opts.width || 1200;
  const q = opts.quality || "auto:best";
  const f = opts.format || "auto";
  const cld = getCld();
  const urls = [];

  try {
    const u = mediaUrlService.getImageUrl(clean, { width: w, quality: q, format: f, crop: "limit" });
    if (u?.startsWith("http") && !urls.includes(u)) urls.push(u);
  } catch {}

  if (cld) {
    const u2 = `https://res.cloudinary.com/${cld}/image/upload/w_${w},q_${q},f_${f},c_limit/${clean}`;
    if (!urls.includes(u2)) urls.push(u2);
    const u3 = `https://res.cloudinary.com/${cld}/image/upload/${clean}`;
    if (!urls.includes(u3)) urls.push(u3);
  }

  if (clean.startsWith("http") && !urls.includes(clean)) urls.push(clean);
  const supa = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supa && !clean.startsWith("http")) {
    const u5 = `${supa}/storage/v1/object/public/posts/${clean}`;
    if (!urls.includes(u5)) urls.push(u5);
  }

  return urls;
}

function buildSafeVideoUrl(id) {
  if (!id || typeof id !== "string" || !id.trim()) return null;
  const clean = id.trim();
  if (clean.startsWith("http")) return clean;
  const cld = getCld();
  if (cld) return `https://res.cloudinary.com/${cld}/video/upload/q_auto,f_mp4/${clean}.mp4`;
  try {
    const raw = mediaUrlService.getVideoUrl(clean, { quality: "auto", format: "mp4" });
    if (!raw) return null;
    const qi = raw.indexOf("?");
    const base = qi >= 0 ? raw.slice(0, qi) : raw;
    const query = qi >= 0 ? raw.slice(qi) : "";
    return base.replace(/\.mp4$/i, "") + ".mp4" + query;
  } catch {
    return null;
  }
}

function getVideoIds(item) {
  if (!item) return [];
  if (item.type === "post") return (item.video_ids || []).filter(Boolean);
  if (item.type === "reel") return item.video_id ? [item.video_id] : [];
  return [];
}

function preloadItemImages(item, tier) {
  if (!item || item.type !== "post") return;
  (item.image_ids || []).filter(Boolean).slice(0, 1).forEach((id) => {
    buildAllCandidates(id).forEach((url) => schedulePreload(url, tier));
  });
}

function preloadItemThumbnails(item, tier) {
  if (!item) return;
  if (item.type === "reel") {
    const thumbnailId = item.thumbnail_id || item.video_id;
    if (!thumbnailId) return;
    try {
      const url = item.thumbnail_id
        ? mediaUrlService.getImageUrl(thumbnailId, { width: 480, quality: "auto:good", format: "webp" })
        : mediaUrlService.getVideoThumbnail(thumbnailId, { width: 480, height: 711 });
      if (url) schedulePreload(url, tier);
    } catch {}
  }
}

function preloadBatch(items, anchorIndex = 0) {
  if (!items?.length) return;
  items.forEach((item, index) => {
    if (!item) return;
    const dist = Math.abs(index - anchorIndex);
    const tier = dist <= 6 ? TIER.CRITICAL : dist <= 16 ? TIER.URGENT : TIER.BATCH;
    preloadItemImages(item, tier);
    preloadItemThumbnails(item, tier);
  });
}

function preloadFirstPaintImages(items) {
  if (!items?.length) return;
  items.slice(0, 10).forEach((item) => {
    if (!item) return;
    if (item.type === "post") {
      (item.image_ids || []).slice(0, 1).filter(Boolean).forEach((id) => {
        const url = `https://res.cloudinary.com/${getCld()}/image/upload/w_800,q_auto:good,f_auto,c_limit/${id.trim()}`;
        schedulePreload(url, TIER.CRITICAL);
        try {
          const u = mediaUrlService.getImageUrl(id, { width: 800, quality: "auto:good", format: "auto" });
          if (u?.startsWith("http")) schedulePreload(u, TIER.CRITICAL);
        } catch {}
      });
    } else if (item.type === "reel") {
      const thumbnailId = item.thumbnail_id || item.video_id;
      if (!thumbnailId) return;
      try {
        const url = item.thumbnail_id
          ? mediaUrlService.getImageUrl(thumbnailId, { width: 480, quality: "auto:good", format: "webp" })
          : mediaUrlService.getVideoThumbnail(thumbnailId, { width: 480, height: 711 });
        if (url) schedulePreload(url, TIER.CRITICAL);
      } catch {}
    }
  });
}

const VideoPreloadRunway = React.memo(({ items, anchorIndex, preloadWindow = 18, renderRadius = 30 }) => {
  const cld = getCld();
  const start = Math.max(0, anchorIndex - preloadWindow);
  const end = Math.min(items.length - 1, anchorIndex + preloadWindow);
  const rStart = Math.max(0, anchorIndex - renderRadius);
  const rEnd = Math.min(items.length - 1, anchorIndex + renderRadius);
  const hints = [];

  for (let i = start; i <= end; i++) {
    if (i >= rStart && i <= rEnd) continue;
    const item = items[i];
    if (!item) continue;
    const ids = getVideoIds(item);
    if (!ids.length) continue;
    ids.forEach((id, j) => {
      const url = buildSafeVideoUrl(id);
      if (!url) return;
      hints.push(
        <video key={`vpr-${item.id}-${j}`}
          src={url}
          preload="metadata"
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        />,
      );
    });
  }

  if (!hints.length) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none", zIndex: -1 }}>
      {hints}
    </div>
  );
});
VideoPreloadRunway.displayName = "VideoPreloadRunway";

export {
  preloadFirstPaintImages,
  preloadBatch,
  VideoPreloadRunway,
};
