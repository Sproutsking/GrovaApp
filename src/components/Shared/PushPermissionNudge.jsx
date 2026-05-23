// ============================================================================
// src/components/Shared/PushPermissionNudge.jsx — v1
// ============================================================================
// Handles Bug 7: if the user never granted push permission, the app is
// completely silent. This component listens for the "push:needs_permission"
// event dispatched by pushService.start() and shows a non-blocking banner
// that the user can accept or dismiss. It only shows once per session.
//
// Mount this inside MainApp, anywhere in the tree (it uses fixed positioning).
// Example in App.jsx:
//   import PushPermissionNudge from "./components/Shared/PushPermissionNudge";
//   // Inside MainApp return, after InAppNotificationToast:
//   <PushPermissionNudge userId={user?.id} />
// ============================================================================

import React, { useState, useEffect, useCallback, memo } from "react";
import { pushService } from "../../services/notifications/pushService";

const PushPermissionNudge = memo(({ userId }) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Don't show if already granted or denied
    if (!pushService.isSupported()) return;
    if (Notification.permission !== "default") return;

    // Check if dismissed this session
    try {
      if (sessionStorage.getItem("xv_push_nudge_dismissed")) return;
    } catch {}

    // Show after a short delay on the "push:needs_permission" event
    const handler = () => {
      // Small delay so it doesn't flash immediately on load
      setTimeout(() => setVisible(true), 4000);
    };

    window.addEventListener("push:needs_permission", handler);

    // Also handle grant success — hide the nudge
    const grantHandler = () => {
      setVisible(false);
    };
    window.addEventListener("push:permission_granted", grantHandler);

    return () => {
      window.removeEventListener("push:needs_permission", handler);
      window.removeEventListener("push:permission_granted", grantHandler);
    };
  }, []);

  const handleEnable = useCallback(async () => {
    if (requesting || !userId) return;
    setRequesting(true);
    try {
      const granted = await pushService.enablePushNotifications(userId);
      if (granted) {
        setVisible(false);
      } else {
        // Permission denied — dismiss quietly
        handleDismiss();
      }
    } catch {}
    setRequesting(false);
  }, [userId, requesting]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    try {
      sessionStorage.setItem("xv_push_nudge_dismissed", "1");
    } catch {}
  }, []);

  if (!visible || dismissed) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
          left: "16px",
          right: "16px",
          maxWidth: "420px",
          margin: "0 auto",
          zIndex: 99989,
          background: "rgba(8, 8, 8, 0.98)",
          border: "1px solid rgba(132, 204, 22, 0.25)",
          borderRadius: "18px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          animation: "pushNudgeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            background: "rgba(132, 204, 22, 0.1)",
            border: "1px solid rgba(132, 204, 22, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "18px",
          }}
        >
          🔔
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "#fff",
              marginBottom: "2px",
            }}
          >
            Stay in the loop
          </div>
          <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.4 }}>
            Enable notifications for messages, calls and activity
          </div>
        </div>

        <button
          onClick={handleEnable}
          disabled={requesting}
          style={{
            padding: "8px 14px",
            borderRadius: "12px",
            border: "none",
            background:
              "linear-gradient(135deg, rgba(132, 204, 22, 0.9), rgba(101, 163, 13, 0.9))",
            color: "#061000",
            fontSize: "12px",
            fontWeight: "800",
            cursor: requesting ? "not-allowed" : "pointer",
            flexShrink: 0,
            opacity: requesting ? 0.6 : 1,
            transition: "opacity 0.15s",
            fontFamily: "inherit",
          }}
        >
          {requesting ? "…" : "Enable"}
        </button>

        <button
          onClick={handleDismiss}
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#444",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "inherit",
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <style>{`
        @keyframes pushNudgeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
});

PushPermissionNudge.displayName = "PushPermissionNudge";
export default PushPermissionNudge;
