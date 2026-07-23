// ============================================================================
// src/utils/lazyRetry.js
// ============================================================================
//
// Wraps a dynamic import() used with React.lazy() so that a failed chunk
// load (ChunkLoadError / "Failed to fetch dynamically imported module")
// gets ONE automatic full-page reload instead of crashing straight to the
// top-level error boundary.
//
// WHY THIS IS NEEDED:
//   React.lazy() chunks are content-hashed files (e.g. 334.6c1b2fb3.chunk.js).
//   If the browser has an old main bundle in memory (from before a deploy)
//   or the CDN briefly serves a stale index.html/main.js that references a
//   chunk hash no longer on the server, the dynamic import 404s and throws.
//   A single reload almost always fixes this because it re-fetches
//   index.html + the current main bundle, which reference the CURRENT
//   (correct) chunk hashes.
//
// HOW IT WORKS:
//   1. Try the import normally.
//   2. If it fails, check a sessionStorage flag scoped to THIS specific
//      chunk import (by component name) so we only ever retry once per
//      chunk per browser session — this prevents an infinite reload loop
//      if the chunk is genuinely missing on the server (real deploy bug).
//   3. If we haven't retried yet, set the flag, reload the page.
//   4. If we HAVE already retried and it's still failing, throw the error
//      for real so the top-level error boundary shows the "Something
//      hiccupped" screen with a manual "Try Again" button — because at
//      that point auto-reloading again would just loop forever.
//
// USAGE (in App.jsx):
//   const AccountView = lazy(() => lazyRetry(() => import("./components/Account/AccountView"), "AccountView"));
//
// ============================================================================

export function lazyRetry(importFn, componentName) {
  const storageKey = `xv_chunk_retry_${componentName || "unknown"}`;

  return new Promise((resolve, reject) => {
    importFn()
      .then((module) => {
        // Successful load — clear any retry flag for this component so a
        // future genuine failure gets its own fresh retry attempt.
        try {
          sessionStorage.removeItem(storageKey);
        } catch (_) {}
        resolve(module);
      })
      .catch((error) => {
        const alreadyRetried = (() => {
          try {
            return sessionStorage.getItem(storageKey) === "1";
          } catch (_) {
            return false;
          }
        })();

        const msg = String(error?.message ?? "");
        const name = String(error?.name ?? "");
        const isChunkError =
          name === "ChunkLoadError" ||
          /Loading chunk [\d]+ failed/i.test(msg) ||
          /Failed to fetch dynamically imported module/i.test(msg) ||
          /Importing a module script failed/i.test(msg) ||
          /error loading dynamically imported module/i.test(msg);

        if (isChunkError && !alreadyRetried) {
          try {
            sessionStorage.setItem(storageKey, "1");
          } catch (_) {}
          console.warn(
            `[lazyRetry] Chunk load failed for "${componentName}" — reloading once to recover:`,
            msg,
          );
          window.location.reload();
          // Never resolves/rejects after this — the page is reloading.
          return;
        }

        // Either not a chunk error, or we already tried reloading once and
        // it's still broken — this is a real error. Let it propagate so the
        // error boundary can show the fallback UI.
        reject(error);
      });
  });
}

export default lazyRetry;