// ============================================================================
// src/services/news/newsCron.js  — v4
//
// CHANGES vs v3:
//  [C1] Two separate cron schedules:
//       - Article cycle: every 2 minutes (bucket rotation across sources)
//       - Video cycle:   every 15 minutes (all YouTube channels)
//  [C2] Boot sequence runs BOTH cycles immediately on startup.
//  [C3] Health endpoint includes video cycle stats.
//  [C4] Graceful shutdown handles both cron jobs.
// ============================================================================

import cron from "node-cron";
import {
  runNewsFetchCycle,
  runVideoFetchCycle,
  NEWS_SOURCES,
  VIDEO_SOURCES,
} from "./newsFetcher.js";

// ── State ─────────────────────────────────────────────────────────────────────
let articleRunning = false;
let videoRunning   = false;
let lastArticleRun = null;
let lastVideoRun   = null;
let lastArticleCount = 0;
let lastVideoCount   = 0;
let lastArticleError = null;
let lastVideoError   = null;
let articleCronJob   = null;
let videoCronJob     = null;

// [C1] Bucket rotation — 3 buckets for articles so each 2-min tick hits ~⅓
const ARTICLE_BUCKETS = (() => {
  const size   = Math.ceil(NEWS_SOURCES.length / 3);
  const result = [];
  for (let i = 0; i < NEWS_SOURCES.length; i += size) {
    result.push(NEWS_SOURCES.slice(i, i + size));
  }
  return result;
})();
let articleBucketIdx = 0;

// ── Article fetch tick ────────────────────────────────────────────────────────
async function runArticleTick(forceAll = false) {
  if (articleRunning) { console.log("[NewsCron] Article already running — skipping"); return; }
  articleRunning = true;
  const t0 = Date.now();
  try {
    const sources = forceAll
      ? NEWS_SOURCES
      : ARTICLE_BUCKETS[articleBucketIdx % ARTICLE_BUCKETS.length];
    articleBucketIdx++;
    console.log(
      `[NewsCron] Article tick — bucket ${(articleBucketIdx % ARTICLE_BUCKETS.length) + 1}/` +
      `${ARTICLE_BUCKETS.length} (${sources.length} sources)`
    );
    lastArticleCount = await runNewsFetchCycle(sources);
    lastArticleRun   = new Date().toISOString();
    lastArticleError = null;
    console.log(`[NewsCron] ✓ Article done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${lastArticleCount} new`);
  } catch (err) {
    lastArticleError = err.message;
    console.error("[NewsCron] ✗ Article error:", err);
  } finally {
    articleRunning = false;
  }
}

// ── Video fetch tick ──────────────────────────────────────────────────────────
async function runVideoTick() {
  if (videoRunning) { console.log("[NewsCron] Video already running — skipping"); return; }
  videoRunning = true;
  const t0 = Date.now();
  try {
    console.log(`[NewsCron] Video tick — ${VIDEO_SOURCES.length} channels`);
    lastVideoCount = await runVideoFetchCycle(VIDEO_SOURCES);
    lastVideoRun   = new Date().toISOString();
    lastVideoError = null;
    console.log(`[NewsCron] ✓ Video done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${lastVideoCount} new`);
  } catch (err) {
    lastVideoError = err.message;
    console.error("[NewsCron] ✗ Video error:", err);
  } finally {
    videoRunning = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function startNewsCron() {
  const ARTICLE_SCHEDULE = process.env.NEWS_CRON_SCHEDULE       ?? "*/2 * * * *";
  const VIDEO_SCHEDULE   = process.env.NEWS_VIDEO_CRON_SCHEDULE ?? "*/15 * * * *";

  console.log(`[NewsCron] Starting — articles: ${ARTICLE_SCHEDULE}, videos: ${VIDEO_SCHEDULE}`);

  // [C2] Immediate boot runs
  runArticleTick(true);
  runVideoTick();

  // Second article run after 30s for cold-start coverage
  setTimeout(() => runArticleTick(false), 30_000);

  // Scheduled runs
  articleCronJob = cron.schedule(ARTICLE_SCHEDULE, () => runArticleTick(false), {
    scheduled: true, timezone: "UTC",
  });
  videoCronJob = cron.schedule(VIDEO_SCHEDULE, () => runVideoTick(), {
    scheduled: true, timezone: "UTC",
  });

  // [C4] Graceful shutdown
  const shutdown = () => {
    console.log("[NewsCron] Shutting down…");
    if (articleCronJob) { articleCronJob.stop(); articleCronJob = null; }
    if (videoCronJob)   { videoCronJob.stop();   videoCronJob   = null; }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);
}

export function stopNewsCron() {
  if (articleCronJob) { articleCronJob.stop(); articleCronJob = null; }
  if (videoCronJob)   { videoCronJob.stop();   videoCronJob   = null; }
}

export async function triggerManualFetch({ forceAll = true, type = "all" } = {}) {
  if (type === "video" || type === "all") {
    if (!videoRunning) runVideoTick();
  }
  if (type === "article" || type === "all") {
    if (articleRunning) return { ok: false, message: "Already in progress" };
    const t0 = Date.now();
    articleRunning = true;
    try {
      const sources = forceAll ? NEWS_SOURCES : ARTICLE_BUCKETS[articleBucketIdx++ % ARTICLE_BUCKETS.length];
      const count   = await runNewsFetchCycle(sources);
      lastArticleCount = count;
      lastArticleRun   = new Date().toISOString();
      lastArticleError = null;
      return { ok: true, count, elapsed: Date.now() - t0 };
    } catch (err) {
      lastArticleError = err.message;
      return { ok: false, message: err.message };
    } finally {
      articleRunning = false;
    }
  }
  return { ok: true, message: "triggered" };
}

export function getHealth() {
  return {
    article: {
      running:     articleRunning,
      lastRun:     lastArticleRun,
      lastCount:   lastArticleCount,
      lastError:   lastArticleError,
      bucketIdx:   articleBucketIdx,
      totalSources: NEWS_SOURCES.length,
      buckets:     ARTICLE_BUCKETS.length,
      schedule:    process.env.NEWS_CRON_SCHEDULE ?? "*/2 * * * *",
    },
    video: {
      running:      videoRunning,
      lastRun:      lastVideoRun,
      lastCount:    lastVideoCount,
      lastError:    lastVideoError,
      totalChannels: VIDEO_SOURCES.length,
      schedule:     process.env.NEWS_VIDEO_CRON_SCHEDULE ?? "*/15 * * * *",
    },
  };
}