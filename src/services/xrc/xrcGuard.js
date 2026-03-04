// ============================================================================
// services/xrc/xrcGuard.js
// XRC v2 — Development vs Production awareness
//
// THE CORE DESIGN PRINCIPLE:
//   In development → XRC silently skips recording (won't pollute chain with test data)
//   In production  → XRC records everything once real users act
//
// HOW IT DECIDES "real user action":
//   1. Must be authenticated (real Supabase user, not mocked)
//   2. Must NOT be running in localhost/dev unless explicitly overridden
//   3. Actor ID must be a real UUID (not a placeholder)
//
// OVERRIDE: Set XRC_FORCE_DEV=true in your .env to record in dev for testing.
// ============================================================================

const IS_DEV =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test" ||
  (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168.")));

const FORCE_IN_DEV = process.env.REACT_APP_XRC_FORCE_DEV === "true";

// UUID v4 pattern
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns true if XRC should record this action.
 *
 * XRC records when:
 *   - In production (IS_DEV = false), OR
 *   - REACT_APP_XRC_FORCE_DEV=true is set, AND
 *   - actorId is a real UUID (not placeholder/system)
 */
export function shouldRecord(actorId) {
  // Never record without a valid actor
  if (!actorId || !UUID_PATTERN.test(actorId)) return false;

  // In production, always record
  if (!IS_DEV) return true;

  // In dev, only record if explicitly forced
  if (FORCE_IN_DEV) return true;

  // Dev mode without override → skip silently
  return false;
}

/**
 * Returns the current environment label for logging.
 */
export function getEnvironment() {
  if (!IS_DEV) return "production";
  if (FORCE_IN_DEV) return "development-forced";
  return "development-silent";
}

/**
 * Log an XRC skip event (debug only, never in production).
 */
export function logSkip(streamType, event, reason) {
  if (!IS_DEV) return;
  console.debug(
    `[XRC] ⏭️  Skipped ${streamType}:${event} — ${reason} (dev mode)`,
  );
}

/**
 * Log a successful XRC write (debug level).
 */
export function logWrite(streamType, event, recordId) {
  if (IS_DEV && !FORCE_IN_DEV) return;
  console.debug(`[XRC] ✅ Recorded ${streamType}:${event} → ${recordId}`);
}

export { IS_DEV, FORCE_IN_DEV };