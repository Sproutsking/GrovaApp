// src/components/Stream/LiveStreamersRow.jsx
// ============================================================================
// Horizontal scrollable live streamers strip.
// Self-contained — queries Supabase directly so it works before
// streamService.js is deployed.
//
// Props:
//   variant      "home" (default) | "sidebar"
//   onJoin       (session) => void — called when user clicks a streamer
//   currentUser  — for avatar fallback
//
// FIX vs original:
//   - Avatar no longer rotates. The spinning gradient is a ::before
//     pseudo-element clipped by overflow:hidden on the ring container.
//     The avatar sits above it via z-index and has zero animation.
//   - Card max width 60px (was 76px home / 64px sidebar — too large).
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { Radio, Eye } from "lucide-react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

// ── Fetch live sessions directly from Supabase ────────────────────────────────
const fetchLiveSessions = async () => {
  const { data, error } = await supabase
    .from("live_sessions")
    .select(
      `id, title, category, mode, peak_viewers, total_likes,
       started_at, livekit_room, is_private,
       profiles:user_id (id, full_name, username, avatar_id, verified)`,
    )
    .eq("status", "live")
    .eq("is_private", false)
    .order("peak_viewers", { ascending: false })
    .limit(20);

  // Silently return empty if table does not exist yet (migration not run)
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist"))
      return [];
    throw error;
  }
  return data || [];
};

// ── Avatar component ──────────────────────────────────────────────────────────
const StreamerAvatar = ({ profile }) => {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const avatarUrl =
    !imgError && profile?.avatar_id
      ? mediaUrlService.getImageUrl(profile.avatar_id, {
          width: 100,
          height: 100,
          crop: "fill",
          gravity: "face",
        })
      : null;

  const initials = (profile?.full_name || profile?.username || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Initials show instantly as placeholder */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: "#000",
          userSelect: "none",
          lineHeight: 1,
          position: "absolute",
        }}
      >
        {initials}
      </span>
      {/* Image fades in once loaded */}
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={profile?.full_name || ""}
          loading="eager"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
            opacity: loaded ? 1 : 0,
            transition: "opacity .2s ease",
          }}
        />
      )}
    </div>
  );
};

// ── Single streamer card ──────────────────────────────────────────────────────
const StreamerCard = ({ session, variant, onClick }) => {
  const isSidebar = variant === "sidebar";
  const profile = session.profiles || {};
  const cardW = isSidebar ? 56 : 60;

  return (
    <button
      className="lsr-card"
      style={{ "--card-w": `${cardW}px` }}
      onClick={() => onClick(session)}
      title={`${profile.full_name || "Streamer"} — ${session.title}`}
    >
      {/* ── Ring + avatar ──────────────────────────────────────────────────
          .lsr-ring is a 54px circle with overflow:hidden + dark background.
          Its ::before pseudo spins (conic gradient) — clipped to circle shape.
          .lsr-avatar-wrap sits above ::before via z-index:1, inset:3px.
          It has ZERO animation — avatar never rotates.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="lsr-ring-wrap">
        <div className="lsr-ring">
          <div className="lsr-avatar-wrap">
            <StreamerAvatar profile={profile} />
          </div>
        </div>

        {/* Expanding pulse ring behind */}
        <div className="lsr-ring-pulse" />

        {/* LIVE dot */}
        <div className="lsr-live-dot" />

        {/* Viewer count chip */}
        <div className="lsr-viewer-chip">
          <Eye size={7} strokeWidth={2.5} />
          {fmt(session.peak_viewers || 0)}
        </div>
      </div>

      {/* Username */}
      <span className="lsr-name">
        {(profile.username || profile.full_name || "streamer").slice(0, 9)}
      </span>

      {/* Category — home only */}
      {!isSidebar && <span className="lsr-cat">{session.category}</span>}
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const LiveStreamersRow = ({ variant = "home", onJoin, currentUser }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const rowRef = useRef(null);
  const rtRef = useRef(null);
  const isSidebar = variant === "sidebar";

  // ── Load + realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await fetchLiveSessions();
        if (mounted) setSessions(data);
      } catch {
        /* silent — non-critical widget */
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel("lsr_live_sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_sessions" },
        async () => {
          try {
            const data = await fetchLiveSessions();
            if (mounted) setSessions(data);
          } catch {
            /* silent */
          }
        },
      )
      .subscribe();

    rtRef.current = () => supabase.removeChannel(channel);
    return () => {
      mounted = false;
      rtRef.current?.();
    };
  }, []);

  // ── Scroll shadow detection ────────────────────────────────────────────────
  const checkScroll = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 8,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 8,
    });
  };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [sessions]);

  // Don't render if nobody is live
  if (!loading && sessions.length === 0) return null;

  const handleJoin = (session) => {
    if (typeof onJoin === "function") onJoin(session);
  };

  return (
    <>
      <style>{`
        /* ── Wrapper + fade edges ── */
        .lsr-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .lsr-wrap::before,
        .lsr-wrap::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0;
          width: 28px;
          pointer-events: none;
          z-index: 2;
          transition: opacity .2s;
        }
        .lsr-wrap::before {
          left: 0;
          background: linear-gradient(90deg, rgba(0,0,0,.9), transparent);
          opacity: var(--fade-left, 0);
        }
        .lsr-wrap::after {
          right: 0;
          background: linear-gradient(-90deg, rgba(0,0,0,.9), transparent);
          opacity: var(--fade-right, 0);
        }

        /* ── Sidebar header ── */
        .lsr-sidebar-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 9px;
          border-bottom: 1px solid rgba(255,255,255,.06);
          position: relative;
        }
        .lsr-sidebar-hdr::before {
          content: "";
          position: absolute;
          left: 0; bottom: -1px;
          width: 28px; height: 2px;
          background: linear-gradient(90deg, #ef4444, transparent);
          border-radius: 1px;
        }
        .lsr-sidebar-hdr-left { display: flex; align-items: center; gap: 8px; }
        .lsr-sidebar-icon {
          width: 24px; height: 24px; border-radius: 7px;
          background: rgba(239,68,68,.12);
          border: 1px solid rgba(239,68,68,.25);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lsr-sidebar-title {
          font-size: 11px; font-weight: 800; color: #e5e5e5;
          letter-spacing: .5px; text-transform: uppercase;
        }
        .lsr-sidebar-sub { font-size: 10px; color: #484848; font-weight: 500; margin-top: 1px; }
        .lsr-count-badge {
          display: flex; align-items: center; gap: 3px;
          padding: 2px 7px; border-radius: 5px;
          background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2);
          font-size: 9px; font-weight: 800; color: #ef4444;
        }
        .lsr-count-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #ef4444;
          animation: lsrPulse 1.4s ease-in-out infinite;
          display: inline-block;
        }

        /* ── Home header ── */
        .lsr-home-hdr {
          display: flex; align-items: center; gap: 8px;
          padding: 0 16px 10px;
        }
        .lsr-home-live-badge {
          display: flex; align-items: center; gap: 5px;
          padding: 3px 9px; border-radius: 7px;
          background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.22);
          font-size: 10px; font-weight: 900; color: #ef4444;
          letter-spacing: .4px; text-transform: uppercase;
        }
        .lsr-home-live-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
          animation: lsrPulse 1.4s ease-in-out infinite;
        }
        .lsr-home-count { font-size: 11px; color: #484848; font-weight: 600; }

        /* ── Scroll container ── */
        .lsr-scroll {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }
        .lsr-scroll::-webkit-scrollbar { display: none; }

        /* ── Card ── */
        .lsr-card {
          display: flex; flex-direction: column;
          align-items: center; gap: 4px;
          flex-shrink: 0;
          width: var(--card-w, 60px);
          background: transparent; border: none;
          cursor: pointer; padding: 2px 0 0;
          scroll-snap-align: start;
          -webkit-tap-highlight-color: transparent;
          transition: transform .18s ease;
        }
        .lsr-card:hover  { transform: translateY(-2px); }
        .lsr-card:active { transform: scale(.93); }

        /* ── Ring wrap — positions ring + dot + chip together ── */
        .lsr-ring-wrap {
          position: relative;
          width: 54px; height: 54px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* ── Ring: overflow:hidden clips spinning ::before to circle ── */
        .lsr-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          background: #0a0a0a; /* gap colour between spinner and avatar */
        }

        /* Spinning conic gradient — ONLY this element rotates */
        .lsr-ring::before {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          width: 200%; height: 200%;
          margin-top: -100%; margin-left: -100%;
          background: conic-gradient(
            #ef4444 0deg, #fb7185 40%, #ef4444 100%
          );
          animation: lsrSpin 4s linear infinite;
          z-index: 0;
        }
        @keyframes lsrSpin { to { transform: rotate(360deg); } }

        /* Avatar wrapper — above spinner, ZERO animation, never rotates */
        .lsr-avatar-wrap {
          position: absolute;
          inset: 3px; /* 3px gap = visible ring border */
          border-radius: 50%;
          overflow: hidden;
          z-index: 1;
        }

        /* Expanding pulse ring — behind everything */
        .lsr-ring-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(239,68,68,.4);
          animation: lsrRingPulse 2s ease-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        @keyframes lsrRingPulse {
          0%   { transform: scale(1);    opacity: .5; }
          100% { transform: scale(1.55); opacity: 0;  }
        }

        /* LIVE dot */
        .lsr-live-dot {
          position: absolute;
          bottom: 2px; right: 2px;
          width: 11px; height: 11px;
          border-radius: 50%;
          background: #ef4444;
          border: 2px solid #0a0a0a;
          animation: lsrPulse 1.4s ease-in-out infinite;
          z-index: 2;
        }

        /* Viewer chip */
        .lsr-viewer-chip {
          position: absolute;
          top: -3px; right: -4px;
          display: flex; align-items: center; gap: 2px;
          padding: 2px 5px; border-radius: 5px;
          background: rgba(0,0,0,.8);
          border: 1px solid rgba(255,255,255,.1);
          font-size: 8px; font-weight: 800; color: #c4c4c4;
          backdrop-filter: blur(6px);
          z-index: 3;
        }

        /* Text labels */
        .lsr-name {
          font-size: 10px; font-weight: 700; color: #c4c4c4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: var(--card-w, 60px);
          text-align: center; transition: color .15s; line-height: 1.3;
        }
        .lsr-card:hover .lsr-name { color: #fff; }
        .lsr-cat {
          font-size: 8.5px; font-weight: 600; color: #383838;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: var(--card-w, 60px); text-align: center;
        }

        /* Loading shimmer */
        .lsr-shimmer {
          border-radius: 50%;
          background: rgba(255,255,255,.04);
          animation: lsrShimmer 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* Animations */
        @keyframes lsrPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: .5; transform: scale(.85); }
        }
        @keyframes lsrShimmer {
          0%,100% { opacity: .5; }
          50%     { opacity: .15; }
        }
      `}</style>

      <div
        className="lsr-wrap"
        style={{
          "--fade-left": canScroll.left ? "1" : "0",
          "--fade-right": canScroll.right ? "1" : "0",
        }}
      >
        {/* Header */}
        {isSidebar ? (
          <div className="lsr-sidebar-hdr">
            <div className="lsr-sidebar-hdr-left">
              <div className="lsr-sidebar-icon">
                <Radio size={12} color="#ef4444" />
              </div>
              <div>
                <div className="lsr-sidebar-title">Live Now</div>
                <div className="lsr-sidebar-sub">Active streams</div>
              </div>
            </div>
            {sessions.length > 0 && (
              <div className="lsr-count-badge">
                <span className="lsr-count-dot" />
                {sessions.length}
              </div>
            )}
          </div>
        ) : (
          <div className="lsr-home-hdr">
            <div className="lsr-home-live-badge">
              <div className="lsr-home-live-dot" />
              Live
            </div>
            {sessions.length > 0 && (
              <span className="lsr-home-count">
                {sessions.length} streaming now
              </span>
            )}
          </div>
        )}

        {/* Scroll row */}
        <div
          ref={rowRef}
          className="lsr-scroll"
          style={{
            gap: isSidebar ? "10px" : "14px",
            padding: isSidebar ? "4px 0 10px" : "4px 16px 12px",
          }}
        >
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="lsr-shimmer"
                  style={{
                    width: isSidebar ? 54 : 54,
                    height: isSidebar ? 54 : 54,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))
            : sessions.map((s) => (
                <StreamerCard
                  key={s.id}
                  session={s}
                  variant={variant}
                  onClick={handleJoin}
                />
              ))}
        </div>
      </div>
    </>
  );
};

export default LiveStreamersRow;
