// src/components/Home/ReelsTab.jsx

import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";
import ReelCard from "./ReelCard";
import FullScreenReels from "./FullScreenReels";

// ── New-reel banner — portal, only when this tab is active ───────────────────
function getMeasuredSafeTop() {
  let max = 0;
  try {
    for (const el of document.querySelectorAll("*")) {
      const s = window.getComputedStyle(el), p = s.position;
      if (p !== "fixed" && p !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.top < 10 && r.bottom > max && r.width > 60) max = r.bottom;
    }
  } catch {}
  return Math.max(max, 56) + 10;
}

const NewReelBanner = ({ count, onShow, isActive }) => {
  const [topPx, setTopPx] = useState(() => getMeasuredSafeTop());

  useEffect(() => {
    const id = requestAnimationFrame(() => setTopPx(getMeasuredSafeTop()));
    const onR = () => setTopPx(getMeasuredSafeTop());
    window.addEventListener("resize", onR, { passive: true });
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onR); };
  }, []);

  if (!isActive || !count) return null;

  return ReactDOM.createPortal(
    <>
      <button className="rlb-pill" style={{ top: topPx }} onClick={onShow}>
        <ArrowUp size={13} />
        {count} new reel{count !== 1 ? "s" : ""}
      </button>
      <style>{`
        .rlb-pill{
          position:fixed;left:50%;transform:translateX(-50%);z-index:9999;
          display:inline-flex;align-items:center;gap:7px;
          padding:9px 22px;border-radius:999px;
          background:rgba(168,85,247,0.97);
          border:1px solid rgba(255,255,255,0.22);
          color:#fff;font-size:13px;font-weight:700;cursor:pointer;
          white-space:nowrap;font-family:inherit;
          box-shadow:0 6px 30px rgba(168,85,247,0.5);
          backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
          animation:rlbIn .35s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .rlb-pill:hover{background:rgba(147,64,226,1);transform:translateX(-50%) scale(1.04);}
        .rlb-pill:active{transform:translateX(-50%) scale(0.97);}
        @keyframes rlbIn{
          from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(0.88);}
          to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
        }
      `}</style>
    </>,
    document.body,
  );
};

// ── ReelsTab ──────────────────────────────────────────────────────────────────
const ReelsTab = ({
  reels: initialReels,
  currentUser,
  onAuthorClick,
  onActionMenu,
  onComment,
  onSoundClick,
  onHashtagClick,
  onMentionClick,
  isActive = false,           // <-- NEW: true when "reels" tab is selected
}) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [pendingCount, setPendingCount] = useState(0);
  const [localReels, setLocalReels] = useState(
    (initialReels || []).filter((r) => !r.deleted_at),
  );
  const pendingRef = useRef([]);

  console.log("🎬 ReelsTab rendering with", localReels.length, "reels");

  // Keep in sync with parent prop changes (initial load, filter changes, etc.)
  useEffect(() => {
    setLocalReels((initialReels || []).filter((r) => !r.deleted_at));
  }, [initialReels]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Allow parent (HomeView) to push a new reel in via a ref-style event.
  // HomeView already uses its own realtime subscription; we expose a stable
  // imperative handle by attaching to a custom window event scoped to this tab.
  useEffect(() => {
    const handler = (e) => {
      const reel = e.detail?.reel;
      if (!reel) return;
      if (isActive) {
        setLocalReels(prev =>
          prev.some(r => r.id === reel.id) ? prev : [reel, ...prev],
        );
      } else {
        if (!pendingRef.current.some(r => r.id === reel.id)) {
          pendingRef.current = [reel, ...pendingRef.current];
          setPendingCount(pendingRef.current.length);
        }
      }
    };
    window.addEventListener("grova:newReel", handler);
    return () => window.removeEventListener("grova:newReel", handler);
  }, [isActive]);

  const flushPending = useCallback(() => {
    if (!pendingRef.current.length) return;
    const toAdd = pendingRef.current;
    pendingRef.current = [];
    setPendingCount(0);
    setLocalReels(prev => {
      const ids = new Set(prev.map(r => r.id));
      return [...toAdd.filter(r => !ids.has(r.id)), ...prev];
    });
    const el = document.querySelector(".main-content-desktop, .main-content-mobile");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleOpenFullScreen = (index) => {
    setFullScreenIndex(index);
    setShowFullScreen(true);
    if (!isDesktop) document.body.style.overflow = "hidden";
  };

  const handleCloseFullScreen = () => {
    setShowFullScreen(false);
    if (!isDesktop) document.body.style.overflow = "";
  };

  if (!localReels || localReels.length === 0) {
    return (
      <>
        <NewReelBanner count={pendingCount} onShow={flushPending} isActive={isActive} />
        <div className="empty-reels">
          <div className="empty-reels-icon">🎬</div>
          <p>No reels to display</p>
          <span>Start creating amazing content!</span>

          <style jsx>{`
            .empty-reels {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 80px 20px;
              text-align: center;
              gap: 16px;
            }
            .empty-reels-icon {
              font-size: 64px;
              opacity: 0.3;
            }
            .empty-reels p {
              color: #a3a3a3;
              font-size: 18px;
              font-weight: 600;
              margin: 0;
            }
            .empty-reels span {
              color: #737373;
              font-size: 14px;
            }
          `}</style>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Banner — portal, only visible when isActive===true */}
      <NewReelBanner count={pendingCount} onShow={flushPending} isActive={isActive} />

      {!showFullScreen && (
        <div className="reels-grid">
          {localReels.map((reel, index) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              currentUser={currentUser}
              onAuthorClick={onAuthorClick}
              onActionMenu={onActionMenu}
              onOpenFullScreen={() => handleOpenFullScreen(index)}
              onSoundClick={onSoundClick}
              onHashtagClick={onHashtagClick}
              onMentionClick={onMentionClick}
              index={index}
            />
          ))}
        </div>
      )}

      {showFullScreen && (
        <FullScreenReels
          reels={localReels}
          initialIndex={fullScreenIndex}
          currentUser={currentUser}
          onClose={handleCloseFullScreen}
          onAuthorClick={onAuthorClick}
          onActionMenu={onActionMenu}
          onSoundClick={onSoundClick}
        />
      )}

      <style jsx>{`
        .reels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
          padding: 0;
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 1280px) {
          .reels-grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 10px;
          }
        }

        @media (max-width: 1024px) {
          .reels-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            padding: 0px;
          }
        }

        @media (max-width: 768px) {
          .reels-grid {
            grid-template-columns: 1fr;
            gap: 0;
            padding: 0;
          }
        }

        @media (min-width: 1024px) {
          :global(.home-view.fullscreen-active) {
            overflow: hidden;
          }
          :global(.home-view.fullscreen-active .reels-grid) {
            display: none;
          }
        }
      `}</style>
    </>
  );
};

export default ReelsTab;