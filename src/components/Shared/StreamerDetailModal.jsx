// src/components/Shared/StreamerDetailModal.jsx
// ============================================================================
// Full-screen streamer profile modal.
// Shows aggregate stats + full session history.
// Each session card:
//   — RECORDED: custom audio/video player with progress, play/pause, mute
//   — NOT RECORDED: "Session not recorded" card with session stats
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ArrowLeft,
  Tv,
  Eye,
  Heart,
  Clock,
  Mic,
  Video,
  Sparkles,
  Calendar,
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronRight,
  BarChart2,
} from "lucide-react";

import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import UnifiedLoader from "./UnifiedLoader";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const fmtTime = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const fmtDuration = (startedAt, endedAt) => {
  if (!startedAt || !endedAt) return null;
  const mins = Math.floor((new Date(endedAt) - new Date(startedAt)) / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ── Custom media player ───────────────────────────────────────────────────────
const MediaPlayer = ({ url, mode }) => {
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(false);
  const ref = useRef(null);
  const isAudio = mode === "audio";

  const toggle = () => {
    if (!ref.current || err) return;
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      ref.current.play().catch(() => setErr(true));
      setPlaying(true);
    }
  };

  const seek = (e) => {
    if (!ref.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    ref.current.currentTime = pct * duration;
  };

  const pct = duration ? (curTime / duration) * 100 : 0;

  const sharedProps = {
    ref,
    src: url,
    preload: "metadata",
    muted,
    onTimeUpdate: () => setCurTime(ref.current?.currentTime || 0),
    onLoadedMetadata: () => {
      setDuration(ref.current?.duration || 0);
      setReady(true);
    },
    onEnded: () => setPlaying(false),
    onError: () => {
      setErr(true);
      setReady(true);
    },
  };

  return (
    <div
      style={{
        background: "rgba(239,68,68,.06)",
        border: "1px solid rgba(239,68,68,.2)",
        borderRadius: 12,
        padding: "14px",
        marginTop: 10,
      }}
    >
      {/* Hidden audio or visible video */}
      {isAudio ? (
        <audio {...sharedProps} style={{ display: "none" }} />
      ) : (
        <video
          {...sharedProps}
          style={{
            width: "100%",
            display: "block",
            borderRadius: 8,
            marginBottom: 12,
            maxHeight: 200,
            background: "#000",
            objectFit: "contain",
          }}
        />
      )}

      {/* Type label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "rgba(239,68,68,.15)",
            border: "1px solid rgba(239,68,68,.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isAudio ? (
            <Mic size={11} color="#ef4444" />
          ) : (
            <Video size={11} color="#ef4444" />
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#ef4444",
            letterSpacing: 0.4,
          }}
        >
          {isAudio ? "AUDIO RECORDING" : "VIDEO RECORDING"}
        </span>
        {!ready && !err && (
          <span style={{ fontSize: 10, color: "#484848" }}>Loading…</span>
        )}
      </div>

      {err ? (
        <div
          style={{
            textAlign: "center",
            padding: "8px 0",
            color: "#484848",
            fontSize: 12,
          }}
        >
          Unable to load recording
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div
            onClick={seek}
            style={{
              height: 5,
              background: "rgba(255,255,255,.08)",
              borderRadius: 3,
              cursor: "pointer",
              marginBottom: 10,
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "linear-gradient(90deg,#ef4444,#fb7185)",
                borderRadius: 3,
                transition: "width .1s linear",
              }}
            />
            {ready && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${pct}%`,
                  transform: "translate(-50%,-50%)",
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: "#ef4444",
                  border: "2px solid #0a0a0a",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {/* Controls row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Play/pause */}
            <button
              onClick={toggle}
              disabled={!ready}
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: ready
                  ? "rgba(239,68,68,.15)"
                  : "rgba(255,255,255,.04)",
                border: `1px solid ${ready ? "rgba(239,68,68,.35)" : "rgba(255,255,255,.07)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: ready ? "pointer" : "default",
                color: "#ef4444",
                flexShrink: 0,
              }}
            >
              {!ready ? (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(239,68,68,.4)",
                    borderTopColor: "#ef4444",
                    borderRadius: "50%",
                    animation: "sdmSpin 1s linear infinite",
                  }}
                />
              ) : playing ? (
                <Pause size={15} color="#ef4444" />
              ) : (
                <Play size={15} color="#ef4444" fill="#ef4444" />
              )}
            </button>

            {/* Time */}
            <div
              style={{
                flex: 1,
                fontSize: 11,
                color: "#525252",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtTime(curTime)} / {fmtTime(duration)}
            </div>

            {/* Mute */}
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (ref.current) ref.current.muted = next;
              }}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: muted
                  ? "rgba(239,68,68,.1)"
                  : "rgba(255,255,255,.04)",
                border: `1px solid ${muted ? "rgba(239,68,68,.25)" : "rgba(255,255,255,.07)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: muted ? "#ef4444" : "#484848",
                flexShrink: 0,
              }}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Not-recorded card ─────────────────────────────────────────────────────────
const NotRecordedCard = ({ session }) => {
  const dur = fmtDuration(session.started_at, session.ended_at);
  return (
    <div
      style={{
        background: "rgba(255,255,255,.02)",
        border: "1px dashed rgba(255,255,255,.08)",
        borderRadius: 12,
        padding: "14px",
        marginTop: 10,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(255,255,255,.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 18,
        }}
      >
        📭
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#484848",
            marginBottom: 4,
          }}
        >
          Session not recorded
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#363636",
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          This stream wasn't saved for replay. Here's how it went:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <span
            style={{
              fontSize: 11,
              color: "#484848",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Eye size={10} />
            <span style={{ color: "#ef4444", fontWeight: 700 }}>
              {fmt(session.peak_viewers || 0)}
            </span>{" "}
            peak viewers
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#484848",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            ❤{" "}
            <span style={{ color: "#ef4444", fontWeight: 700 }}>
              {fmt(session.total_likes || 0)}
            </span>{" "}
            likes
          </span>
          {dur && (
            <span
              style={{
                fontSize: 11,
                color: "#484848",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Clock size={10} />
              <span style={{ color: "#d4d4d4", fontWeight: 700 }}>
                {dur}
              </span>{" "}
              duration
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Session card ──────────────────────────────────────────────────────────────
const SessionCard = ({ session, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasRec = !!session.recording_url;
  const isAudio = session.mode === "audio";
  const dur = fmtDuration(session.started_at, session.ended_at);

  return (
    <div
      style={{
        background: hasRec ? "rgba(239,68,68,.03)" : "rgba(255,255,255,.02)",
        border: `1px solid ${hasRec ? "rgba(239,68,68,.14)" : "rgba(255,255,255,.06)"}`,
        borderRadius: 13,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      {/* Tap header to expand/collapse */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          cursor: "pointer",
        }}
      >
        {/* Mode icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            flexShrink: 0,
            background: hasRec ? "rgba(239,68,68,.1)" : "rgba(255,255,255,.04)",
            border: `1px solid ${hasRec ? "rgba(239,68,68,.22)" : "rgba(255,255,255,.07)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isAudio ? (
            <Mic size={14} color={hasRec ? "#ef4444" : "#484848"} />
          ) : (
            <Video size={14} color={hasRec ? "#ef4444" : "#484848"} />
          )}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#d4d4d4",
              marginBottom: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {session.title || "Untitled Stream"}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              color: "#484848",
              flexWrap: "wrap",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Calendar size={9} />
              {fmtDate(session.started_at)}
            </span>
            {session.category && (
              <>
                <span style={{ color: "#2a2a2a" }}>·</span>
                <span>{session.category}</span>
              </>
            )}
            {dur && (
              <>
                <span style={{ color: "#2a2a2a" }}>·</span>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Clock size={9} />
                  {dur}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Badges + chevron */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          {hasRec ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                padding: "2px 6px",
                background: "rgba(239,68,68,.15)",
                color: "#ef4444",
                borderRadius: 4,
              }}
            >
              RECORDED
            </span>
          ) : (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                background: "rgba(255,255,255,.05)",
                color: "#484848",
                borderRadius: 4,
              }}
            >
              LIVE ONLY
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              color: "#484848",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Eye size={9} />
            {fmt(session.peak_viewers || 0)}
          </span>
        </div>
        <div
          style={{
            color: "#2a2a2a",
            transition: "transform .2s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <ChevronRight size={14} />
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* Stats strip */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderTop: "1px solid rgba(255,255,255,.04)",
              paddingTop: 12,
              marginBottom: 4,
            }}
          >
            {[
              { label: "PEAK VIEWERS", value: fmt(session.peak_viewers || 0) },
              { label: "LIKES", value: fmt(session.total_likes || 0) },
              ...(dur ? [{ label: "DURATION", value: dur }] : []),
            ].map(({ label, value }, i, arr) => (
              <React.Fragment key={label}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 800, color: "#ef4444" }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      fontSize: 8.5,
                      color: "#484848",
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      marginTop: 2,
                    }}
                  >
                    {label}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      background: "rgba(255,255,255,.06)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Recording or not-recorded */}
          {hasRec ? (
            <MediaPlayer url={session.recording_url} mode={session.mode} />
          ) : (
            <NotRecordedCard session={session} />
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const StreamerDetailModal = ({ streamer, onClose }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(streamer?.profile || null);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    if (!streamer?.userId) return;
    (async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, username, avatar_id, verified, bio")
            .eq("id", streamer.userId)
            .maybeSingle(),
          supabase
            .from("live_sessions")
            .select(
              "id, title, category, mode, peak_viewers, total_likes, started_at, ended_at, recording_url, status",
            )
            .eq("user_id", streamer.userId)
            .eq("is_private", false)
            .order("started_at", { ascending: false })
            .limit(50),
        ]);
        if (pRes.data) setProfile(pRes.data);
        setSessions(sRes.data || []);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, [streamer?.userId]); // eslint-disable-line

  const pr = profile || streamer?.profile || {};
  const avatarUrl =
    !imgErr && pr.avatar_id
      ? mediaUrlService.getImageUrl(pr.avatar_id, {
          width: 160,
          height: 160,
          crop: "fill",
          gravity: "face",
        })
      : null;
  const initial = (pr.full_name || pr.username || "?").charAt(0).toUpperCase();
  const recordedCount = sessions.filter((s) => s.recording_url).length;

  return (
    <>
      <style>{`
        @keyframes sdmUp   { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes sdmSpin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.82)",
          backdropFilter: "blur(14px)",
          zIndex: 10001,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10002,
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
          color: "#fff",
          animation: "sdmUp .3s cubic-bezier(.34,1.1,.64,1)",
          overflow: "hidden",
        }}
      >
        {/* ── Top bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            flexShrink: 0,
            background: "rgba(5,5,5,.98)",
            backdropFilter: "blur(20px)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#737373",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(239,68,68,.1)",
              border: "1px solid rgba(239,68,68,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Tv size={14} color="#ef4444" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pr.full_name || pr.username || "Streamer"}
            </div>
            <div style={{ fontSize: 11, color: "#484848", marginTop: 1 }}>
              Streamer profile
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#737373",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 48px" }}>
          {/* Profile card */}
          <div
            style={{
              background:
                "linear-gradient(135deg,rgba(239,68,68,.08),rgba(239,68,68,.02))",
              border: "1px solid rgba(239,68,68,.16)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
            }}
          >
            {/* Avatar + name */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#ef4444,#b91c1c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 26,
                  overflow: "hidden",
                  border: "2px solid rgba(239,68,68,.35)",
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    onError={() => setImgErr(true)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pr.full_name || "Streamer"}
                  </span>
                  {pr.verified && (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        background: "#84cc16",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Sparkles size={10} color="#000" />
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#525252",
                    marginBottom: pr.bio ? 6 : 0,
                  }}
                >
                  @{pr.username || "user"}
                </div>
                {pr.bio && (
                  <div
                    style={{ fontSize: 12, color: "#484848", lineHeight: 1.55 }}
                  >
                    {pr.bio}
                  </div>
                )}
              </div>
            </div>

            {/* Aggregate stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {[
                {
                  label: "STREAMS",
                  value: fmt(streamer?.sessions ?? sessions.length),
                },
                {
                  label: "PEAK VIEWERS",
                  value: fmt(streamer?.peakViewers ?? 0),
                },
                { label: "TOTAL LIKES", value: fmt(streamer?.totalLikes ?? 0) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    textAlign: "center",
                    padding: "10px 4px",
                    background: "rgba(0,0,0,.3)",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.05)",
                  }}
                >
                  <div
                    style={{ fontSize: 17, fontWeight: 800, color: "#ef4444" }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: "#484848",
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      marginTop: 2,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Recordings summary */}
            {!loading && sessions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,.07)",
                  border: "1px solid rgba(239,68,68,.15)",
                  borderRadius: 9,
                }}
              >
                <Radio size={13} color="#ef4444" />
                <span
                  style={{ fontSize: 12, color: "#d4d4d4", fontWeight: 600 }}
                >
                  {recordedCount > 0
                    ? `${recordedCount} of ${sessions.length} sessions recorded`
                    : `${sessions.length} sessions — none recorded`}
                </span>
              </div>
            )}
          </div>

          {/* Session list */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#484848",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              marginBottom: 12,
              paddingLeft: 2,
            }}
          >
            Stream History ({loading ? "…" : sessions.length})
          </div>

          {loading ? (
            <UnifiedLoader type="section" message="Loading sessions…" />
          ) : sessions.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 0",
                color: "#2e2e2e",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>
                📡
              </div>
              <p style={{ fontSize: 13, margin: 0 }}>No stream history found</p>
            </div>
          ) : (
            sessions.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                defaultOpen={i === 0}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default StreamerDetailModal;
