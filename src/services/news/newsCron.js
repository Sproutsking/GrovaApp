// ============================================================================
// src/services/news/newsCron.js  — v3
//
// CHANGES:
//  [C1] Schedule reduced from every 8 min → every 2 min for near-real-time
//  [C2] Category rotation: each tick cycles a subset of sources so we hit
//       ALL sources frequently without hammering any single server.
//  [C3] Boot sequence: runs immediately, then again after 30s, then every 2m.
//       This ensures a fully-populated feed even right after cold start.
//  [C4] Health check endpoint: GET /api/news/health returns last fetch stats.
//  [C5] Graceful shutdown on SIGTERM/SIGINT.
// ============================================================================

import cron from "node-cron";
import { runNewsFetchCycle, NEWS_SOURCES } from "./newsFetcher.js";

// ── State ─────────────────────────────────────────────────────────────────────
let isRunning = false;
let lastRun = null;
let lastCount = 0;
let lastError = null;
let cronJob = null;

// [C2] Source rotation buckets — so each 2-min tick only hits ~⅓ of sources
// but ALL sources are hit within every 6 minutes.
const BUCKETS = (() => {
  const size = Math.ceil(NEWS_SOURCES.length / 3);
  const result = [];
  for (let i = 0; i < NEWS_SOURCES.length; i += size) {
    result.push(NEWS_SOURCES.slice(i, i + size));
  }
  return result;
})();

let bucketIdx = 0;

// ── Run one fetch cycle ───────────────────────────────────────────────────────
async function scheduledFetch(forceAll = false) {
  if (isRunning) {
    console.log("[NewsCron] Already running — skipping tick");
    return;
  }

  isRunning = true;
  const t0 = Date.now();

  try {
    // [C2] Rotate bucket unless forced full-run
    const sources = forceAll
      ? NEWS_SOURCES
      : BUCKETS[bucketIdx % BUCKETS.length];
    bucketIdx++;

    console.log(
      `[NewsCron] Tick — bucket ${(bucketIdx % BUCKETS.length) + 1}/${BUCKETS.length}` +
        ` (${sources.length} sources)`,
    );

    lastCount = await runNewsFetchCycle(sources);
    lastRun = new Date().toISOString();
    lastError = null;

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[NewsCron] ✓ Done in ${elapsed}s — ${lastCount} new articles`);
  } catch (err) {
    lastError = err.message;
    console.error("[NewsCron] ✗ Unhandled error:", err);
  } finally {
    isRunning = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * startNewsCron()
 * Call once at server boot.
 */
export function startNewsCron() {
  const CRON_SCHEDULE = process.env.NEWS_CRON_SCHEDULE ?? "*/2 * * * *"; // [C1]
  console.log(`[NewsCron] Starting — schedule: ${CRON_SCHEDULE}`);

  // [C3] Immediate full run on boot
  scheduledFetch(true);

  // [C3] Second run after 30s to catch any sources that were slow on first tick
  setTimeout(() => scheduledFetch(false), 30_000);

  // [C1] Every-2-minute tick
  cronJob = cron.schedule(CRON_SCHEDULE, () => scheduledFetch(false), {
    scheduled: true,
    timezone: "UTC",
  });

  // [C5] Graceful shutdown
  const shutdown = () => {
    console.log("[NewsCron] Shutting down…");
    if (cronJob) {
      cronJob.stop();
      cronJob = null;
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

/**
 * stopNewsCron()
 */
export function stopNewsCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}

/**
 * triggerManualFetch({ forceAll })
 * Called by admin API or for testing.
 */
export async function triggerManualFetch({ forceAll = true } = {}) {
  if (isRunning) return { ok: false, message: "Fetch already in progress" };
  isRunning = true;
  const t0 = Date.now();
  try {
    const sources = forceAll
      ? NEWS_SOURCES
      : BUCKETS[bucketIdx % BUCKETS.length];
    bucketIdx++;
    const count = await runNewsFetchCycle(sources);
    lastCount = count;
    lastRun = new Date().toISOString();
    lastError = null;
    return { ok: true, count, elapsed: Date.now() - t0 };
  } catch (err) {
    lastError = err.message;
    return { ok: false, message: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * [C4] getHealth()
 * Mount this on GET /api/news/health
 */
export function getHealth() {
  return {
    isRunning,
    lastRun,
    lastCount,
    lastError,
    bucketIdx,
    totalSources: NEWS_SOURCES.length,
    buckets: BUCKETS.length,
    schedule: process.env.NEWS_CRON_SCHEDULE ?? "*/2 * * * *",
  };
}
