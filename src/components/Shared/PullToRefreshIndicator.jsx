import React from "react";

const PullToRefreshIndicator = ({ pullDistance, isRefreshing }) => {
  const PULL_THRESHOLD = 80;
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress * 2, 1);

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "0",
        left: "50%",
        transform: `translateX(-50%) translateY(${Math.min(pullDistance - 40, 40)}px)`,
        zIndex: 1000,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
        opacity: opacity,
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(10px)",
          border: "2px solid #84cc16",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(132, 204, 22, 0.3)",
        }}
      >
        {isRefreshing ? (
          <div
            style={{
              width: "24px",
              height: "24px",
              border: "3px solid rgba(132, 204, 22, 0.3)",
              borderTop: "3px solid #84cc16",
              borderRadius: "50%",
              animation: "spin 0.6s linear infinite",
            }}
          />
        ) : (
          <i
            className="bx bx-refresh"
            style={{
              fontSize: "24px",
              color: "#84cc16",
              transform: `rotate(${rotation}deg)`,
              transition: "transform 0.1s ease-out",
            }}
          />
        )}
      </div>

      {!isRefreshing && pullDistance >= PULL_THRESHOLD && (
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#84cc16",
            fontWeight: "600",
            textAlign: "center",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
          }}
        >
          Release to refresh
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PullToRefreshIndicator;
