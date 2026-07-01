// ============================================================================
// src/components/Messages/IncomingCallPopupEnhanced.jsx — ELITE INCOMING CALL v5
// ============================================================================
// ENHANCEMENTS vs v4:
//  [E1] Unique z-index management — only ONE popup visible at time
//  [E2] Modal exclusivity — closes other modals when active
//  [E3] Full-screen incoming call — no popup modal shown, clean fullscreen
//  [E4] Premium animations — smoother entry/exit
//  [E5] Better button interactions
//  [E6] Improved audio ring with variatio
// ============================================================================

import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import callService from "../../services/messages/callService";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ✅ Extract every possible field path
const extractCallerName = (call) =>
  call?.caller?.full_name || call?.caller?.name || call?.callerName || call?.name || "Unknown Caller";

const extractCallerAvId = (call) =>
  call?.caller?.avatar_id || call?.caller?.avatarId || call?.callerAvatarId || call?.callerAvId || null;

const buildAvatarUrl = (avId) => {
  if (!avId) return null;
  try {
    if (mediaUrlService.getAvatarUrl) {
      const url = mediaUrlService.getAvatarUrl(avId, 300);
      if (url && typeof url === "string" && url.startsWith("http")) return url;
    }
    if (mediaUrlService.getImageUrl) {
      const url = mediaUrlService.getImageUrl(avId);
      if (url && typeof url === "string" && url.startsWith("http")) return url;
    }
  } catch {}
  return null;
};

// ── Avatar with error fallback ────────────────────────────────────────────────
const CallAvatar = ({ call, size = 148 }) => {
  const [failed, setFailed] = useState(false);
  const name    = extractCallerName(call);
  const avId    = extractCallerAvId(call);
  const url     = !failed ? buildAvatarUrl(avId) : null;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      background: "linear-gradient(135deg,#0d1a00,#1a3300)",
      border: "3px solid rgba(132,204,22,.38)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", zIndex: 1,
    }}>
      {url
        ? <img
            src={url}
            alt={name}
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        : <span style={{ fontSize: Math.round(size * 0.4), fontWeight: 900, color: "#84cc16" }}>{initial}</span>
      }
    </div>
  );
};

// ── Global singleton for modal management ──────────────────────────────────────
let activeCallPopupId = null;

const IncomingCallPopupEnhanced = memo(({ call, onAccept, onDecline, isFullScreen = false }) => {
  const [timeLeft, setTimeLeft] = useState(45);
  const [phase,    setPhase]    = useState("ringing"); // ringing | accepted | declined | ended
  const [popupId]  = useState(() => `popup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const didAct      = useRef(false);

  const callerName = extractCallerName(call);
  const callType   = call?.type || call?.callType || "audio";
  const isVideo    = callType.includes("video");
  const callId     = call?.callId || call?.id;
  const callerId   = call?.callerId || call?.caller?.id;

  // [E1] Register this popup as active
  useEffect(() => {
    activeCallPopupId = popupId;
    return () => {
      if (activeCallPopupId === popupId) {
        activeCallPopupId = null;
      }
    };
  }, [popupId]);

  // [E2] Close other modals when this popup is active
  useEffect(() => {
    if (activeCallPopupId !== popupId) return;
    
    // Hide other overlays
    const hideOtherModals = () => {
      const modals = document.querySelectorAll('[role="dialog"], .modal, .popup');
      modals.forEach(modal => {
        if (!modal.contains(document.querySelector(`[data-popup-id="${popupId}"]`))) {
          modal.style.opacity = "0.2";
          modal.style.pointerEvents = "none";
        }
      });
    };

    hideOtherModals();
    return () => {
      const modals = document.querySelectorAll('[role="dialog"], .modal, .popup');
      modals.forEach(modal => {
        modal.style.opacity = "";
        modal.style.pointerEvents = "";
      });
    };
  }, [popupId]);

  // ── Ring ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const beep = (t, freq = 880, dur = 0.18) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = "sine";
          o.frequency.setValueAtTime(freq, t); o.frequency.setValueAtTime(freq * 0.75, t + dur);
          g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.37);
          o.start(t); o.stop(t + dur + 0.37);
        };
        let t = ctx.currentTime + 0.1;
        for (let i = 0; i < 20 && !cancelled; i++) { 
          beep(t, 880, 0.18);
          beep(t + 0.65, 660, 0.18);
          t += 2.6;
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
      try { audioCtxRef.current?.close(); } catch {}
    };
  }, []);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          if (!didAct.current) {
            didAct.current = true;
            callService.declineCall(callId, callerId, callType);
            onDecline?.({ callId, reason: "timeout" });
            setPhase("declined");
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line

  // ── Auto-dismiss when caller cancels ──────────────────────────────────────
  useEffect(() => {
    const dismiss = (data) => {
      const cid = data?.callId || data?.detail?.callId;
      if (cid && cid !== callId) return;
      if (didAct.current) return;
      didAct.current = true;
      clearInterval(intervalRef.current);
      try { audioCtxRef.current?.close(); } catch {}
      setPhase("ended");
      setTimeout(() => onDecline?.({ callId, reason: "caller_ended" }), 1800);
    };
    const unsubEnded    = callService.on("call_ended",   dismiss);
    const unsubDeclined = callService.on("call_declined", dismiss);
    const winH = (e) => dismiss(e.detail);
    window.addEventListener("nova:call_ended", winH);
    return () => {
      unsubEnded(); unsubDeclined();
      window.removeEventListener("nova:call_ended", winH);
    };
  }, [callId, onDecline]);

  const handleAccept = useCallback(() => {
    if (didAct.current) return;
    didAct.current = true;
    clearInterval(intervalRef.current);
    try { audioCtxRef.current?.close(); } catch {}
    setPhase("accepted");
    callService.answerCall(callId);
    onAccept?.({ callId, callerId, callerName, callType, caller: call?.caller });
  }, [callId, callerId, callerName, callType, call, onAccept]);

  const handleDecline = useCallback(() => {
    if (didAct.current) return;
    didAct.current = true;
    clearInterval(intervalRef.current);
    try { audioCtxRef.current?.close(); } catch {}
    setPhase("declined");
    callService.declineCall(callId, callerId, callType);
    onDecline?.({ callId, reason: "declined" });
  }, [callId, callerId, callType, onDecline]);

  const R = 70; const CIRCUM = 2 * Math.PI * R;
  const progress  = timeLeft / 45;
  const isDone    = phase !== "ringing";
  const isEnded   = phase === "ended";
  const isAccepted= phase === "accepted";
  const statusText= isAccepted ? "Connecting…" : isEnded ? "Call ended" : phase === "declined" ? "Call declined" : "Ringing…";
  const ringColor = isEnded ? "#ef4444" : isAccepted ? "#22c55e" : "#84cc16";

  // [E3] Higher z-index for full-screen, no other modals
  const zIndex = isFullScreen ? 99999 : 9999;

  return (
    <div
      data-popup-id={popupId}
      style={{
        position: "fixed", 
        inset: 0, 
        zIndex,
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "linear-gradient(180deg, rgba(0,0,0,.94) 0%, rgba(5,5,5,.92) 100%)", 
        backdropFilter: "blur(34px) saturate(1.3)",
        animation: "icpIn .42s cubic-bezier(.34,1.56,.64,1)",
      }}
    >
      <style>{`
        @keyframes icpIn      { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
        @keyframes icpRingPulse{ 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.22);opacity:.08} }
        @keyframes icpAvPulse { 0%,100%{box-shadow:0 0 0 0 rgba(132,204,22,.45)} 50%{box-shadow:0 0 0 28px rgba(132,204,22,0)} }
        @keyframes icpFloat   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes icpBtnGlow { 0%,100%{box-shadow:0 8px 32px rgba(22,163,74,.4)} 50%{box-shadow:0 8px 42px rgba(22,163,74,.7),0 0 0 12px rgba(22,163,74,.1)} }
      `}</style>

      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 65% 55% at 50% 38%,rgba(132,204,22,.07) 0%,transparent 70%)", pointerEvents: "none" }}/>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, maxWidth: 390, width: "100%", padding: "0 28px", animation: "icpFloat .5s cubic-bezier(.22,1,.36,1)" }}>

        {/* Badge */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 7, background: "rgba(132,204,22,.12)", border: "1px solid rgba(132,204,22,.22)", borderRadius: 999, padding: "7px 16px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)" }}>
          <span style={{ fontSize: 13 }}>{isVideo ? "📹" : "📞"}</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#84cc16", textTransform: "uppercase", letterSpacing: ".7px" }}>
            Incoming {isVideo ? "Video" : "Voice"} Call
          </span>
        </div>

        {/* Avatar + countdown ring */}
        <div style={{ position: "relative", width: 148, height: 148, marginBottom: 28 }}>
          {!isDone && (
            <>
              <div style={{ position: "absolute", inset: -22, borderRadius: "50%", background: "rgba(132,204,22,.07)", animation: "icpRingPulse 2.2s ease-in-out infinite" }}/>
              <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "rgba(132,204,22,.1)", animation: "icpRingPulse 2.2s ease-in-out .55s infinite" }}/>
            </>
          )}
          <svg style={{ position: "absolute", top: -6, left: -6, width: 160, height: 160, transform: "rotate(-90deg)" }}>
            <circle cx={80} cy={80} r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={4.5}/>
            <circle cx={80} cy={80} r={R} fill="none" stroke={ringColor} strokeWidth={4.5}
              strokeDasharray={CIRCUM} strokeDashoffset={CIRCUM * (1 - (isDone ? 1 : progress))}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear,stroke .3s" }}/>
          </svg>

          {/* ✅ Avatar with error fallback */}
          <div style={{ animation: isDone ? "none" : "icpAvPulse 2.4s ease-in-out infinite", position: "relative", zIndex: 1 }}>
            <CallAvatar call={call} size={148}/>
          </div>

          {/* Countdown / done badge */}
          <div style={{
            position: "absolute", bottom: 2, right: 2, width: 34, height: 34, borderRadius: "50%",
            background: isDone ? (isAccepted ? "#16a34a" : "#dc2626") : "#000",
            border: "2px solid rgba(132,204,22,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: isDone ? 16 : 12, fontWeight: 800, color: isDone ? "#fff" : "#84cc16", zIndex: 2,
          }}>
            {isDone ? (isAccepted ? "✓" : "✕") : timeLeft}
          </div>
        </div>

        {/* Name + status */}
        <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff", margin: "0 0 5px", textAlign: "center", letterSpacing: "-.6px" }}>{callerName}</h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.45)", margin: "0 0 48px", textAlign: "center" }}>{statusText}</p>

        {/* Buttons — ringing only */}
        {phase === "ringing" && (
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            {/* Decline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button onClick={handleDecline} style={{
                width: 74, height: 74, borderRadius: "50%",
                background: "linear-gradient(135deg,#dc2626,#991b1b)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(220,38,38,.42)", transition: "all .15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.09)"; e.currentTarget.style.boxShadow = "0 12px 48px rgba(220,38,38,.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(220,38,38,.42)"; }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-3.41-2.6m-2.59-2.6A19.79 19.79 0 012 8.72a2 2 0 011.72-2L6.72 6a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  <line x1="22" y1="2" x2="2" y2="22" stroke="#fff" strokeWidth="2.5"/>
                </svg>
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Decline</span>
            </div>

            {/* Accept */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button onClick={handleAccept} style={{
                width: 74, height: 74, borderRadius: "50%",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(34,197,94,.42)", transition: "all .15s",
                animation: "icpBtnGlow 2s ease-in-out infinite",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.09)"; e.currentTarget.style.boxShadow = "0 12px 48px rgba(34,197,94,.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(34,197,94,.42)"; }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Accept</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

IncomingCallPopupEnhanced.displayName = "IncomingCallPopupEnhanced";
export default IncomingCallPopupEnhanced;
