// src/components/Shared/NetworkError.jsx
import React, { useState, useEffect } from "react";
import { WifiOff, RefreshCw, Wifi } from "lucide-react";

const NetworkError = ({ onRetry }) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);

  // Auto-retry when connection comes back
  useEffect(() => {
    const handleOnline = () => {
      setAutoChecking(true);
      setTimeout(() => {
        setAutoChecking(false);
        onRetry?.();
      }, 1000);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [onRetry]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await new Promise((r) => setTimeout(r, 500));
    setIsRetrying(false);
    onRetry?.();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.97)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "28px",
        padding: "24px",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "90px",
          height: "90px",
          borderRadius: "50%",
          background: "rgba(239,68,68,0.08)",
          border: "2px solid rgba(239,68,68,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {autoChecking ? (
          <Wifi size={42} color="#84cc16" />
        ) : (
          <WifiOff size={42} color="#ef4444" />
        )}
        {autoChecking && (
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "2px solid rgba(132,204,22,0.4)",
              animation: "pulse 1s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Text */}
      <div style={{ textAlign: "center", maxWidth: "380px" }}>
        <h2
          style={{
            fontSize: "22px",
            fontWeight: "800",
            color: "#fff",
            marginBottom: "10px",
          }}
        >
          {autoChecking ? "Reconnecting..." : "No Internet Connection"}
        </h2>
        <p style={{ fontSize: "14px", color: "#9ca3af", lineHeight: "1.7" }}>
          {autoChecking
            ? "Connection detected — restoring your session..."
            : "You're offline. Your session and data are safe. Everything will sync automatically when you reconnect."}
        </p>
      </div>

      {/* Status pills */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {[
          { icon: "🔒", text: "Session is preserved" },
          { icon: "💾", text: "Your data is safe" },
          { icon: "🔄", text: "Auto-syncs on reconnect" },
        ].map((item) => (
          <div
            key={item.text}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 16px",
              background: "rgba(132,204,22,0.06)",
              border: "1px solid rgba(132,204,22,0.12)",
              borderRadius: "20px",
              fontSize: "12.5px",
              color: "#a3e635",
            }}
          >
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Retry button */}
      {!autoChecking && (
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "13px 28px",
            background: isRetrying
              ? "#1a1a1e"
              : "linear-gradient(135deg, #84cc16, #65a30d)",
            border: isRetrying ? "1px solid #27272a" : "none",
            borderRadius: "11px",
            color: isRetrying ? "#6b7280" : "#000",
            fontSize: "15px",
            fontWeight: "700",
            cursor: isRetrying ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          <RefreshCw
            size={18}
            style={{
              animation: isRetrying ? "spin 0.8s linear infinite" : "none",
            }}
          />
          {isRetrying ? "Checking..." : "Try Again"}
        </button>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
      `}</style>
    </div>
  );
};

export default NetworkError;
