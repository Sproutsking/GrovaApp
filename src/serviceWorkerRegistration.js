// src/serviceWorkerRegistration.js
// Updated service worker registration with better error handling

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
  ),
);

export function register(config) {
  // Check if service worker is supported
  if (!("serviceWorker" in navigator)) {
    console.log("Service Worker not supported in this browser");
    return;
  }

  window.addEventListener("load", () => {
    const swUrl = "/service-worker.js";

    if (isLocalhost) {
      // Check if service worker exists on localhost
      checkValidServiceWorker(swUrl, config);

      navigator.serviceWorker.ready.then(() => {
        console.log(
          "[PWA] App is being served cache-first by a service worker.",
        );
      });
    } else {
      // Production mode - register service worker
      registerValidSW(swUrl, config);
    }
  });
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log(
        "[PWA] Service Worker registered successfully:",
        registration,
      );

      // Check for updates
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;

        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === "installed") {
            if (navigator.serviceWorker.controller) {
              // New content is available
              console.log("[PWA] New content available! Please refresh.");

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }

              // Optionally prompt user to refresh
              if (
                window.confirm(
                  "New version available! Click OK to refresh and get the latest updates.",
                )
              ) {
                // Tell service worker to skip waiting
                installingWorker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              }
            } else {
              // Content is cached for offline use
              console.log("[PWA] Content is cached for offline use.");

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };

      // Check for updates every hour
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000,
      );
    })
    .catch((error) => {
      console.error("[PWA] Service Worker registration failed:", error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    headers: { "Service-Worker": "script" },
  })
    .then((response) => {
      const contentType = response.headers.get("content-type");

      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf("javascript") === -1)
      ) {
        // Service worker not found
        console.log("[PWA] Service worker not found. Reloading page.");
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log("[PWA] No internet connection. App running in offline mode.");
    });
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log("[PWA] Service Worker unregistered");
      })
      .catch((error) => {
        console.error(
          "[PWA] Error unregistering service worker:",
          error.message,
        );
      });
  }
}
