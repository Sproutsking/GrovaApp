// ============================================================================
// src/utils/swMigration.js
// ============================================================================
//
// Runs silently on every app load for existing users.
// If they have an old SW version cached (pre-1.0.2), this forces it to
// update immediately rather than waiting up to 24hrs for Chrome's cycle.
//
// Called once from App.jsx MainApp's init useEffect.
//
// ============================================================================

const CURRENT_VERSION = "xeevia-1.0.2";

// Versions that had the auth-breaking reload bug
const BROKEN_VERSIONS = ["xeevia-1.0.0", "xeevia-1.0.1", null, undefined];

export async function runSwMigration() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return;

    for (const reg of regs) {
      const sw = reg.active || reg.installing || reg.waiting;
      if (!sw) continue;

      const version = await getSwVersion(reg);

      if (BROKEN_VERSIONS.includes(version)) {
        console.log(
          `[PWA] Migrating old SW (${version ?? "unknown"}) → ${CURRENT_VERSION}`,
        );

        await reg.update().catch(() => {});

        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            const AUTH_PATHS = ["/auth/callback", "/auth/popup-callback"];
            const onAuth = AUTH_PATHS.some((p) =>
              window.location.pathname.startsWith(p),
            );
            if (!onAuth) {
              sessionStorage.setItem("xv_sw_migrated", "1");
              window.location.reload();
            }
          },
          { once: true },
        );
      }
    }
  } catch {
    // Never crash the app over SW migration
  }
}

function getSwVersion(registration) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 1000);

    const handler = (event) => {
      if (event.data?.type === "SW_VERSION") {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve(event.data.version ?? null);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);

    try {
      const sw =
        registration.active || registration.waiting || registration.installing;
      sw?.postMessage({ type: "GET_VERSION" });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}
