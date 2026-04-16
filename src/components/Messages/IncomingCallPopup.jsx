// components/Messages/IncomingCallPopup.jsx — NOVA INCOMING CALL v2
// ============================================================================
// COORDINATION:
//  - Mounts inside DMMessagesView so it only shows when DM panel is open
//  - DMMessagesView dispatches nova:dm_open on mount → IncomingCallToast stays silent
//  - This popup handles the call UI beautifully with countdown + full design
// ============================================================================

import React, { useState, useEffect, useRef, memo } from "react";
import callService from "../../services/messages/callService";
import mediaUrlService from "../../services/shared/mediaUrlService";

const IncomingCallPopup = memo(({ call, onAccept, onDecline }) => {
  const [timeLeft,  setTimeLeft]  = useState(45);
  const [accepted,  setAccepted]  = useState(false);
  const [declined,  setDeclined]  = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  const callerName = call?.caller?.full_name || call?.callerName || "Unknown";
  const callerAvId = call?.caller?.avatar_id || call?.callerAvId;
  const callType   = call?.type || call?.callType || "audio";
  const isVideo    = callType.includes("video");
  const callId     = call?.callId;
  const callerId   = call?.callerId;
  const avatarUrl  = !avatarErr && callerAvId ? mediaUrlService.getAvatarUrl(callerAvId, 300) : null;
  const initials   = callerName.charAt(0).toUpperCase();

  // Countdown timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          if (!accepted && !declined) handleDecline(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line

  // Ring tone via Web Audio API
  useEffect(() => {
    let cancelled = false;
    const ring = async () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const ringOnce = (startAt, freq1 = 880, freq2 = 660) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq1, startAt);
          osc.frequency.setValueAtTime(freq2, startAt + 0.18);
          gain.gain.setValueAtTime(0.07, startAt);
          gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.55);
          osc.start(startAt);
          osc.stop(startAt + 0.55);
        };
        let t = ctx.currentTime;
        for (let i = 0; i < 15 && !cancelled; i++) {
          ringOnce(t); ringOnce(t + 0.6);
          t += 2.5;
        }
      } catch (_) {}
    };
    ring();
    return () => {
      cancelled = true;
      try { audioCtxRef.current?.close(); } catch (_) {}
    };
  }, []);

  const handleAccept = () => {
    clearInterval(intervalRef.current);
    setAccepted(true);
    callService.answerCall(callId).catch(() => {});
    onAccept?.({ callId, callerId, callerName, callType, caller: call?.caller });
  };

  const handleDecline = (isTimeout = false) => {
    if (declined || accepted) return;
    clearInterval(intervalRef.current);
    setDeclined(true);
    callService.declineCall(callId, callerId, callType).catch(() => {});
    onDecline?.({ callId, reason: isTimeout ? "timeout" : "declined" });
  };

  const progress = timeLeft / 45;
  const R = 70;
  const CIRCUM = 2 * Math.PI * R;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,.88)",
      backdropFilter: "blur(32px) saturate(1.3)",
      animation: "icpIn .42s cubic-bezier(.34,1.56,.64,1)",
    }}>
      <style>{`
        @keyframes icpIn     { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
        @keyframes icpPulse  { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.22);opacity:.08} }
        @keyframes icpAvPulse{ 0%,100%{box-shadow:0 0 0 0 rgba(132,204,22,.45)} 50%{box-shadow:0 0 0 28px rgba(132,204,22,0)} }
        @keyframes icpFloat  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes icpBtnGlow{ 0%,100%{box-shadow:0 8px 32px rgba(22,163,74,.4)} 50%{box-shadow:0 8px 42px rgba(22,163,74,.7),0 0 0 12px rgba(22,163,74,.1)} }
      `}</style>

      {/* Radial background glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 65% 55% at 50% 38%, rgba(132,204,22,.07) 0%, transparent 70%)", pointerEvents: "none" }}/>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, maxWidth: 360, width: "100%", padding: "0 28px", animation: "icpFloat .5s cubic-bezier(.22,1,.36,1)" }}>

        {/* Badge */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 7, background: "rgba(132,204,22,.1)", border: "1px solid rgba(132,204,22,.22)", borderRadius: 22, padding: "6px 18px" }}>
          <span style={{ fontSize: 13 }}>{isVideo ? "📹" : "📞"}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#84cc16", textTransform: "uppercase", letterSpacing: ".7px" }}>
            Incoming {isVideo ? "Video" : "Voice"} Call
          </span>
        </div>

        {/* Avatar ring */}
        <div style={{ position: "relative", width: 148, height: 148, marginBottom: 28 }}>
          {/* Pulse rings */}
          <div style={{ position: "absolute", inset: -22, borderRadius: "50%", background: "rgba(132,204,22,.07)", animation: "icpPulse 2.2s ease-in-out infinite" }}/>
          <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "rgba(132,204,22,.1)", animation: "icpPulse 2.2s ease-in-out .55s infinite" }}/>

          {/* SVG countdown ring */}
          <svg style={{ position: "absolute", top: -6, left: -6, width: 160, height: 160, transform: "rotate(-90deg)" }}>
            <circle cx={80} cy={80} r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={4.5}/>
            <circle
              cx={80} cy={80} r={R} fill="none" stroke="#84cc16" strokeWidth={4.5}
              strokeDasharray={CIRCUM}
              strokeDashoffset={CIRCUM * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>

          {/* Avatar */}
          <div style={{
            width: 148, height: 148, borderRadius: "50%", overflow: "hidden",
            background: "linear-gradient(135deg,#0d1a00,#1a3300)",
            border: "3px solid rgba(132,204,22,.38)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "icpAvPulse 2.4s ease-in-out infinite",
            position: "relative", zIndex: 1,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={callerName} onError={() => setAvatarErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              : <span style={{ fontSize: 60, fontWeight: 900, color: "#84cc16" }}>{initials}</span>
            }
          </div>

          {/* Countdown badge */}
          <div style={{
            position: "absolute", bottom: 2, right: 2,
            width: 34, height: 34, borderRadius: "50%",
            background: "#000", border: "2px solid rgba(132,204,22,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#84cc16", zIndex: 2,
          }}>
            {timeLeft}
          </div>
        </div>

        {/* Name */}
        <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff", margin: "0 0 5px", textAlign: "center", letterSpacing: "-.6px" }}>
          {callerName}
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.4)", margin: "0 0 48px", textAlign: "center" }}>
          {accepted ? "Connecting…" : declined ? "Call ended" : "Ringing…"}
        </p>

        {/* Buttons */}
        {!accepted && !declined && (
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            {/* Decline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => handleDecline(false)}
                style={{
                  width: 74, height: 74, borderRadius: "50%",
                  background: "linear-gradient(135deg,#dc2626,#991b1b)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 32px rgba(220,38,38,.42)",
                  transition: "transform .15s, box-shadow .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.09)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-3.41-2.6m-2.59-2.6A19.79 19.79 0 012 8.72a2 2 0 011.72-2L6.72 6a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.68 13.9"/>
                  <line x1="22" y1="2" x2="2" y2="22" stroke="#fff" strokeWidth="2.5"/>
                </svg>
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Decline</span>
            </div>

            {/* Accept */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button
                onClick={handleAccept}
                style={{
                  width: 74, height: 74, borderRadius: "50%",
                  background: "linear-gradient(135deg,#16a34a,#14532d)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 32px rgba(22,163,74,.48)",
                  animation: "icpBtnGlow 1.6s ease-in-out infinite",
                  transition: "transform .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.09)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>Accept</span>
            </div>
          </div>
        )}

        {/* Post-action state */}
        {(accepted || declined) && (
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: accepted ? "rgba(22,163,74,.18)" : "rgba(239,68,68,.18)",
            border: `2px solid ${accepted ? "#16a34a" : "#ef4444"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
          }}>
            {accepted ? "✓" : "✕"}
          </div>
        )}
      </div>
    </div>
  );
});

IncomingCallPopup.displayName = "IncomingCallPopup";
export default IncomingCallPopup;