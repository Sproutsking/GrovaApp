import React from "react";
import ReactDOM from "react-dom/client";
import GrovaApp from "./App.jsx";
import "./styles/global.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GrovaApp />
  </React.StrictMode>,
);

// Register the service worker
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    console.log("[PWA] New update available!");

    // You can show a custom update notification here
    const updateNotification = document.createElement("div");
    updateNotification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.95);
      color: #84cc16;
      padding: 16px 24px;
      border-radius: 12px;
      border: 2px solid #84cc16;
      box-shadow: 0 8px 32px rgba(132, 204, 22, 0.3);
      z-index: 10000;
      max-width: 300px;
    `;
    updateNotification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">Update Available</div>
      <div style="font-size: 14px; margin-bottom: 12px;">A new version of Grova is ready!</div>
      <button 
        id="update-btn"
        style="
          background: #84cc16;
          color: #000;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
        "
      >
        Update Now
      </button>
    `;

    document.body.appendChild(updateNotification);

    document.getElementById("update-btn").addEventListener("click", () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      window.location.reload();
    });
  },
  onSuccess: (registration) => {
    console.log("[PWA] Service worker registered successfully!");
    console.log("[PWA] App is ready for offline use");
  },
});

// Log PWA status
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then(() => {
    console.log("[PWA] Service Worker is active and ready");
  });
}
