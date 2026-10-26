import React from "react";

const PullToRefreshIndicator = ({ indicatorRef, isRefreshing }) => (
  <div
    ref={indicatorRef}
    aria-hidden="true"
    data-testid="pull-to-refresh-indicator"
    style={{
      position: "fixed",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%) scale(.8)",
      zIndex: 1000,
      opacity: 0,
      pointerEvents: "none",
      display: "none",
      transition: "transform 160ms cubic-bezier(.2,.8,.2,1), opacity 120ms linear",
      willChange: "transform, opacity",
    }}
  >
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        background: "rgba(0, 0, 0, 0.85)",
        border: "2px solid #84cc16",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
          data-pull-refresh-icon
          className="bx bx-refresh"
          style={{
            fontSize: "20px",
            color: "#84cc16",
            transform: "rotate(0deg)",
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

export default PullToRefreshIndicator;
