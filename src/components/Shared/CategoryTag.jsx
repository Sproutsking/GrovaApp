// src/components/Shared/CategoryTag.jsx
import React from "react";

const CategoryTag = ({ category, onClick }) => {
  if (!category) return null;
  return (
    <div
      className="ctag-root"
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(category);
            }
          : undefined
      }
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <span className="ctag-dot" />
      <span className="ctag-label">{category}</span>
      <style>{`
        .ctag-root{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;background:rgba(132,204,22,0.07);border:1px solid rgba(132,204,22,0.18);margin:0 14px 10px;width:fit-content;transition:background 0.15s,border-color 0.15s}
        .ctag-root:hover{background:rgba(132,204,22,0.12);border-color:rgba(132,204,22,0.3)}
        .ctag-dot{width:5px;height:5px;border-radius:50%;background:#84cc16;flex-shrink:0}
        .ctag-label{font-size:10.5px;font-weight:700;color:rgba(132,204,22,0.8);letter-spacing:0.04em;text-transform:uppercase;line-height:1}
      `}</style>
    </div>
  );
};

export default CategoryTag;
