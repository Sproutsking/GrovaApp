import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { Heart } from "lucide-react";

const BURST_CSS = `
  @keyframes xvLikeCore { 0%{opacity:0;transform:translate(-50%,-50%) scale(.25)} 42%{opacity:1;transform:translate(-50%,-50%) scale(1.28)} 72%{opacity:1;transform:translate(-50%,-50%) scale(.96)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.12)} }
  @keyframes xvLikeOrbit { 0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(0) scale(.25)} 28%{opacity:1} 100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(-48px) scale(.55)} }
  .xv-like-burst-core{position:absolute;left:0;top:0;color:#fb7185;filter:drop-shadow(0 4px 14px rgba(251,113,133,.5));animation:xvLikeCore .72s cubic-bezier(.22,1,.36,1) both;}
  .xv-like-burst-orbit{position:absolute;left:0;top:0;color:var(--burst-color);filter:drop-shadow(0 2px 6px rgba(251,113,133,.32));animation:xvLikeOrbit .72s ease-out both;}
  @media(prefers-reduced-motion:reduce){.xv-like-burst-core,.xv-like-burst-orbit{animation-duration:.01ms;}}
`;

export default function LikeBurst({ x, y, onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 760);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return ReactDOM.createPortal(
    <div aria-hidden="true" style={{ position: "fixed", left: x, top: y, zIndex: 99999, pointerEvents: "none", transform: "translate(-50%,-50%)" }}>
      <Heart className="xv-like-burst-core" size={52} fill="currentColor" strokeWidth={1.5} />
      {[
        [250, "#fb7185"], [300, "#fda4af"], [350, "#f43f5e"],
        [30, "#fb7185"], [80, "#fda4af"], [130, "#f43f5e"],
      ].map(([angle, color], index) => (
        <Heart
          key={index}
          className="xv-like-burst-orbit"
          size={17}
          fill="currentColor"
          strokeWidth={1.5}
          style={{ "--angle": `${angle}deg`, "--burst-color": color, animationDelay: `${index * 18}ms` }}
        />
      ))}
      <style>{BURST_CSS}</style>
    </div>,
    document.body,
  );
}