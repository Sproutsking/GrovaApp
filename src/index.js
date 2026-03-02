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
  </React.StrictMode>
);

// Register SW only in production (safe + logs)
if (process.env.NODE_ENV === "production") {
  serviceWorkerRegistration.register();
} else {
  serviceWorkerRegistration.unregister();
}