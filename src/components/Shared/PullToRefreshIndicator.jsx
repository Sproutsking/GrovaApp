import React from "react";

const PullToRefreshIndicator = ({ pullDistance, isRefreshing }) => {
  const PULL_THRESHOLD = 100;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 360;
  const scale = 0.8 + progress * 0.2;
  const opacity = Math.min(progress * 1.5, 1);

  if (pullDistance < 10 && !isRefreshing) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        left: "50%",
        transform: `translateX(-50%) scale(${scale})`,
        zIndex: 1000,
        opacity: opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "2px solid #84cc16",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(132, 204, 22, 0.25)",
        }}
      >
        {isRefreshing ? (
          <div
            style={{
              width: "20px",
              height: "20px",
              border: "2.5px solid rgba(132, 204, 22, 0.25)",
              borderTopColor: "#84cc16",
              borderRadius: "50%",
              animation: "spin 0.6s linear infinite",
            }}
          />
        ) : (
          <i
            className="bx bx-refresh"
            style={{
              fontSize: "20px",
              color: "#84cc16",
              transform: `rotate(${rotation}deg)`,
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PullToRefreshIndicator;
