"use strict";

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/,
  ),
);

export function register() {
  if (!("serviceWorker" in navigator)) return;

  if (isLocalhost) {
    console.log("[PWA] Dev mode — Service Worker disabled for safety");
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        console.log("[PWA] SW registered:", reg.scope);
        reg.update();

        setInterval(() => reg.update(), 3600000);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              if (typeof window.__xvShowUpdate === "function") {
                window.__xvShowUpdate();
              }
            }
          });
        });
      })
      .catch((err) =>
        console.warn("[PWA] SW registration failed:", err.message),
      );
  });
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  }
}