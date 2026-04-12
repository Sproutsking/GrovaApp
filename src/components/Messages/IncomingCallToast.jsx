// ============================================================================
// components/Messages/IncomingCallToast.jsx — NOVA CALL TOAST v3
// ============================================================================
// FIXED:
//  - Subscribes to callService.on("incoming_call") bus
//  - Also listens to window "nova:incoming_call" event for cross-component use
//  - Ring audio plays on incoming call
//  - Toast is always visible regardless of which screen user is on
//  - Accept fires window "nova:accept_call" so App.jsx can open ActiveCall
//  - Proper auto-dismiss on accept/decline
//  - Beautiful fullscreen overlay design that works on mobile + desktop
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import mediaUrlService from "../../services/shared/mediaUrlService";
import callService from "../../services/messages/callService";

class CallEventBus {
  constructor() {
    this._m = new Map();
  }
  on(e, fn) {
    if (!this._m.has(e)) this._m.set(e, new Set());
    this._m.get(e).add(fn);
    return () => this._m.get(e)?.delete(fn);
  }
  emit(e, d) {
    this._m.get(e)?.forEach((fn) => {
      try {
        fn(d);
      } catch (_) {}
    });
  }
}

export const callEventBus = new CallEventBus();

const RING_DURATION = 35;

const IncomingCallToast = ({ onAccept, onDecline }) => {
  const [calls, setCalls] = useState([]); // queue of incoming calls
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const addCall = useCallback((callInfo) => {
    if (!callInfo?.callId && !callInfo?.id) return;
    const id = callInfo.callId || callInfo.id;
    setCalls((prev) => {
      if (prev.some((c) => (c.callId || c.id) === id)) return prev;
      return [...prev, { ...callInfo, _timer: RING_DURATION }];
    });
  }, []);

  const removeCall = useCallback((callId) => {
    setCalls((prev) => prev.filter((c) => (c.callId || c.id) !== callId));
  }, []);

  // Subscribe to call events from multiple sources
  useEffect(() => {
    // From callService bus (when DM panel is open)
    const unsubBus = callService.on("incoming_call", addCall);

    // From callEventBus (from MessageNotificationService)
    const unsubEvent = callEventBus.on("incoming_call", addCall);

    // From window events (cross-component)
    const winHandler = (e) => {
      if (e.detail) addCall(e.detail);
    };
    window.addEventListener("nova:incoming_call", winHandler);

    return () => {
      unsubBus();
      unsubEvent();
      window.removeEventListener("nova:incoming_call", winHandler);
    };
  }, [addCall]);

  // Ring audio
  useEffect(() => {
    if (calls.length > 0) {
      // Play ring tone using Web Audio API (no external file needed)
      try {
        if (!audioRef.current) {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const playRing = () => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              ctx.currentTime + 0.3,
            );
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
          };
          audioRef.current = {
            play: () => {
              playRing();
              setTimeout(playRing, 400);
            },
            stop: () => {},
          };
        }
        timerRef.current = setInterval(() => {
          audioRef.current?.play();
        }, 1200);
        audioRef.current?.play();
      } catch (_) {}
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [calls.length]);

  const handleAccept = useCallback(
    (call) => {
      const callId = call.callId || call.id;
      removeCall(callId);
      // Dispatch window event so App.jsx opens ActiveCall
      window.dispatchEvent(
        new CustomEvent("nova:accept_call", { detail: call }),
      );
      onAccept?.(call);
    },
    [removeCall, onAccept],
  );

  const handleDecline = useCallback(
    (call) => {
      const callId = call.callId || call.id;
      removeCall(callId);
      callService.declineCall(callId);
      onDecline?.(callId);
    },
    [removeCall, onDecline],
  );

  if (calls.length === 0) return null;

  const call = calls[0]; // Show topmost call
  const isVideo = call.type === "video" || call.callType === "video";
  const isGroup =
    call.type === "group" ||
    call.type === "group-video" ||
    call.callType === "group" ||
    call.callType === "group-video";
  const callerAvatarUrl = call.callerAvatarId
    ? mediaUrlService.getAvatarUrl(call.callerAvatarId, 200)
    : null;
  const callerInitial = (call.callerName || call.name || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <div
        className="ict-overlay"
        aria-live="assertive"
        role="dialog"
        aria-label="Incoming call"
      >
        <div className="ict-card">
          {/* Animated ring */}
          <div className="ict-rings">
            <div className="ict-ring ict-ring-1" />
            <div className="ict-ring ict-ring-2" />
            <div className="ict-ring ict-ring-3" />
          </div>

          {/* Avatar */}
          <div className="ict-avatar-wrap">
            {callerAvatarUrl ? (
              <img
                src={callerAvatarUrl}
                alt={call.callerName}
                className="ict-avatar-img"
              />
            ) : (
              <div className="ict-avatar-fallback">{callerInitial}</div>
            )}
          </div>

          {/* Info */}
          <div className="ict-info">
            <div className="ict-call-type">
              {isGroup
                ? `Incoming group ${isVideo ? "video" : "voice"} call`
                : `Incoming ${isVideo ? "video" : "voice"} call`}
            </div>
            <div className="ict-caller-name">
              {call.callerName || call.name || "Someone"}
            </div>
            {isGroup && call.groupName && (
              <div className="ict-group-name">{call.groupName}</div>
            )}
            {isGroup && call.participantCount > 0 && (
              <div className="ict-participants">
                {call.participantCount} participants
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="ict-actions">
            <button
              className="ict-btn ict-decline"
              onClick={() => handleDecline(call)}
              aria-label="Decline"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.32-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
              </svg>
              <span>Decline</span>
            </button>
            <button
              className="ict-btn ict-accept"
              onClick={() => handleAccept(call)}
              aria-label="Accept"
            >
              {isVideo ? (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ) : (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              )}
              <span>Accept</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .ict-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 999999;
          display: flex;
          justify-content: center;
          padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px 0;
          pointer-events: none;
        }
        .ict-card {
          background: rgba(8, 8, 8, 0.97);
          border: 1px solid rgba(132, 204, 22, 0.35);
          border-radius: 24px;
          padding: 24px;
          width: 100%;
          max-width: 380px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(132, 204, 22, 0.1);
          backdrop-filter: blur(24px);
          pointer-events: all;
          position: relative;
          overflow: hidden;
          animation: ictSlideIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes ictSlideIn {
          from { opacity: 0; transform: translateY(-120%) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ict-rings {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ict-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(132, 204, 22, 0.2);
          animation: ictRingPulse 2.5s ease-out infinite;
        }
        .ict-ring-1 { width: 80px;  height: 80px;  animation-delay: 0s; }
        .ict-ring-2 { width: 120px; height: 120px; animation-delay: 0.6s; }
        .ict-ring-3 { width: 160px; height: 160px; animation-delay: 1.2s; }
        @keyframes ictRingPulse {
          0%   { transform: scale(0.85); opacity: 0.8; }
          100% { transform: scale(1.8);  opacity: 0; }
        }
        .ict-avatar-wrap {
          position: relative;
          z-index: 1;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          border: 2.5px solid rgba(132, 204, 22, 0.4);
          box-shadow: 0 0 0 4px rgba(132, 204, 22, 0.12);
          flex-shrink: 0;
        }
        .ict-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ict-avatar-fallback {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0d1a00, #1a3300);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          color: #84cc16;
        }
        .ict-info {
          text-align: center;
          z-index: 1;
        }
        .ict-call-type {
          font-size: 11px;
          font-weight: 700;
          color: #84cc16;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 6px;
        }
        .ict-caller-name {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.4px;
        }
        .ict-group-name {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 3px;
        }
        .ict-participants {
          font-size: 11px;
          color: #84cc16;
          margin-top: 2px;
        }
        .ict-actions {
          display: flex;
          gap: 40px;
          z-index: 1;
          margin-top: 4px;
        }
        .ict-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          border: none;
          background: none;
          padding: 0;
          transition: transform 0.15s;
        }
        .ict-btn:active { transform: scale(0.92); }
        .ict-btn span {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ict-decline {
          color: #ef4444;
        }
        .ict-decline svg, .ict-decline span {
          background: rgba(239, 68, 68, 0.15);
          border-radius: 50%;
          padding: 14px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid rgba(239, 68, 68, 0.4);
        }
        .ict-decline span {
          border-radius: 0;
          background: none;
          border: none;
          padding: 0;
          width: auto;
          height: auto;
        }
        .ict-accept {
          color: #22c55e;
        }
        .ict-accept svg, .ict-accept > span:first-of-type {
          background: rgba(34, 197, 94, 0.18);
          border-radius: 50%;
          padding: 14px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid rgba(34, 197, 94, 0.5);
        }
        .ict-accept span {
          border-radius: 0;
          background: none;
          border: none;
          padding: 0;
          width: auto;
          height: auto;
        }
        .ict-accept svg {
          animation: ictGlow 1.5s ease-in-out infinite;
        }
        @keyframes ictGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          50%      { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
        }

        @media (max-width: 480px) {
          .ict-card { border-radius: 20px; padding: 20px; }
          .ict-caller-name { font-size: 20px; }
          .ict-avatar-wrap { width: 70px; height: 70px; }
          .ict-avatar-fallback { font-size: 28px; }
        }
      `}</style>
    </>
  );
};

export default IncomingCallToast;
