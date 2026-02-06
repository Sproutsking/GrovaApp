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

// Register the service worker with optional callbacks
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    console.log("New update available!");
    // You can add logic here to prompt user to reload or auto-refresh
  },
  onSuccess: (registration) => {
    console.log("Service worker registered successfully!");
  },
});
