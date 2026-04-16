// components/Messages/IncomingCallToast.jsx — NOVA CALL TOAST v4
// ============================================================================
// COORDINATION FIX:
//  - Listens to nova:dm_open / nova:dm_close events from DMMessagesView
//  - When DM panel is open, IncomingCallPopup (inside DM) handles the call
//    so this toast stays silent — no more double popup problem
//  - When DM is closed, this toast shows for calls received anywhere in app
//
// TO ACTIVATE: DMMessagesView must dispatch these events:
//   mount:   window.dispatchEvent(new CustomEvent('nova:dm_open'))
//   unmount: window.dispatchEvent(new CustomEvent('nova:dm_close'))
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import mediaUrlService from "../../services/shared/mediaUrlService";
import callService from "../../services/messages/callService";

class CallEventBus {
  constructor() { this._m = new Map(); }
  on(e, fn) {
    if (!this._m.has(e)) this._m.set(e, new Set());
    this._m.get(e).add(fn);
    return () => this._m.get(e)?.delete(fn);
  }
  emit(e, d) { this._m.get(e)?.forEach(fn => { try { fn(d); } catch (_) {} }); }
}

export const callEventBus = new CallEventBus();

const RING_DURATION = 35;

const IncomingCallToast = ({ onAccept, onDecline }) => {
  const [calls, setCalls] = useState([]);
  const [dmIsOpen, setDmIsOpen] = useState(false);

  const audioRef = useRef(null);
  const timerRef = useRef(null);
  // Track latest dmIsOpen in a ref so the addCall callback is always fresh
  const dmOpenRef = useRef(false);

  // Listen for DM panel open/close
  useEffect(() => {
    const onDmOpen  = () => { setDmIsOpen(true);  dmOpenRef.current = true; };
    const onDmClose = () => { setDmIsOpen(false); dmOpenRef.current = false; };
    window.addEventListener("nova:dm_open",  onDmOpen);
    window.addEventListener("nova:dm_close", onDmClose);
    return () => {
      window.removeEventListener("nova:dm_open",  onDmOpen);
      window.removeEventListener("nova:dm_close", onDmClose);
    };
  }, []);

  // When DM opens, clear any existing toasts (popup will take over)
  useEffect(() => {
    if (dmIsOpen) setCalls([]);
  }, [dmIsOpen]);

  const addCall = useCallback((callInfo) => {
    // If DM is open, IncomingCallPopup inside DMMessagesView will handle it
    if (dmOpenRef.current) return;
    if (!callInfo?.callId && !callInfo?.id) return;
    const id = callInfo.callId || callInfo.id;
    setCalls(prev => {
      if (prev.some(c => (c.callId || c.id) === id)) return prev;
      return [...prev, { ...callInfo, _timer: RING_DURATION }];
    });
  }, []);

  const removeCall = useCallback((callId) => {
    setCalls(prev => prev.filter(c => (c.callId || c.id) !== callId));
  }, []);

  // Subscribe to call events
  useEffect(() => {
    const unsubBus   = callService.on("incoming_call", addCall);
    const unsubEvent = callEventBus.on("incoming_call", addCall);
    const winHandler = (e) => { if (e.detail) addCall(e.detail); };
    window.addEventListener("nova:incoming_call", winHandler);
    // When a call ends/is declined, remove it
    const unsubEnd = callService.on("call_ended", ({ callId }) => {
      if (callId) removeCall(callId);
    });
    return () => {
      unsubBus(); unsubEvent(); unsubEnd();
      window.removeEventListener("nova:incoming_call", winHandler);
    };
  }, [addCall, removeCall]);

  // Ring audio
  useEffect(() => {
    if (calls.length > 0) {
      try {
        if (!audioRef.current) {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const playRing = () => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.28, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);
            // second beep
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.45);
            osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.60);
            gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.45);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.80);
            osc2.start(ctx.currentTime + 0.45);
            osc2.stop(ctx.currentTime + 0.80);
          };
          audioRef.current = { play: playRing };
        }
        audioRef.current.play();
        timerRef.current = setInterval(() => audioRef.current?.play(), 2400);
      } catch (_) {}
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [calls.length]);

  const handleAccept = useCallback((call) => {
    const callId = call.callId || call.id;
    removeCall(callId);
    window.dispatchEvent(new CustomEvent("nova:accept_call", { detail: call }));
    onAccept?.(call);
  }, [removeCall, onAccept]);

  const handleDecline = useCallback((call) => {
    const callId = call.callId || call.id;
    removeCall(callId);
    callService.declineCall(callId).catch(() => {});
    onDecline?.(callId);
  }, [removeCall, onDecline]);

  if (calls.length === 0 || dmIsOpen) return null;

  const call = calls[0];
  const isVideo = call.type === "video" || call.callType === "video";
  const isGroup = call.type === "group" || call.type === "group-video" || call.callType === "group" || call.callType === "group-video";
  const callerName = call.callerName || call.name || "Someone";
  const callerAvatarId = call.callerAvatarId || call.callerAvId;
  const callerAvatarUrl = callerAvatarId ? mediaUrlService.getAvatarUrl(callerAvatarId, 200) : null;
  const callerInitial = callerName.charAt(0).toUpperCase();

  return (
    <>
      <div className="ict-overlay" aria-live="assertive" role="dialog" aria-label="Incoming call">
        <div className="ict-card">

          {/* Animated pulse rings */}
          <div className="ict-rings">
            <div className="ict-ring ict-ring-1" />
            <div className="ict-ring ict-ring-2" />
            <div className="ict-ring ict-ring-3" />
          </div>

          {/* Avatar */}
          <div className="ict-avatar-wrap">
            {callerAvatarUrl
              ? <img src={callerAvatarUrl} alt={callerName} className="ict-avatar-img" />
              : <div className="ict-avatar-fallback">{callerInitial}</div>
            }
          </div>

          {/* Info */}
          <div className="ict-info">
            <div className="ict-call-type">
              {isGroup
                ? `Incoming group ${isVideo ? "video" : "voice"} call`
                : `Incoming ${isVideo ? "video" : "voice"} call`}
            </div>
            <div className="ict-caller-name">{callerName}</div>
            {isGroup && call.groupName && <div className="ict-group-name">{call.groupName}</div>}
          </div>

          {/* Actions */}
          <div className="ict-actions">
            {/* Decline */}
            <button className="ict-btn ict-decline" onClick={() => handleDecline(call)} aria-label="Decline">
              <div className="ict-btn-icon ict-decline-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.32-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              </div>
              <span className="ict-btn-label">Decline</span>
            </button>

            {/* Accept */}
            <button className="ict-btn ict-accept" onClick={() => handleAccept(call)} aria-label="Accept">
              <div className="ict-btn-icon ict-accept-icon">
                {isVideo ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                )}
              </div>
              <span className="ict-btn-label">Accept</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .ict-overlay {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 999999;
          display: flex;
          justify-content: center;
          padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 0;
          pointer-events: none;
        }
        .ict-card {
          background: rgba(6, 6, 6, 0.98);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 26px;
          padding: 22px 24px 24px;
          width: 100%;
          max-width: 390px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(132, 204, 22, 0.08), 0 0 60px rgba(132, 204, 22, 0.04);
          backdrop-filter: blur(28px);
          pointer-events: all;
          position: relative;
          overflow: hidden;
          animation: ictSlideIn 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes ictSlideIn {
          from { opacity: 0; transform: translateY(-130%) scale(0.8); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
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
          border: 1.5px solid rgba(132, 204, 22, 0.15);
          animation: ictRingPulse 2.8s ease-out infinite;
        }
        .ict-ring-1 { width:  80px; height:  80px; animation-delay: 0s; }
        .ict-ring-2 { width: 130px; height: 130px; animation-delay: 0.7s; }
        .ict-ring-3 { width: 180px; height: 180px; animation-delay: 1.4s; }
        @keyframes ictRingPulse {
          0%   { transform: scale(0.8); opacity: 0.9; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        .ict-avatar-wrap {
          position: relative;
          z-index: 1;
          width: 76px;
          height: 76px;
          border-radius: 50%;
          overflow: hidden;
          border: 2.5px solid rgba(132, 204, 22, 0.4);
          box-shadow: 0 0 0 4px rgba(132, 204, 22, 0.1), 0 0 24px rgba(132, 204, 22, 0.15);
          flex-shrink: 0;
        }
        .ict-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .ict-avatar-fallback {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #0d1a00, #1a3300);
          display: flex; align-items: center; justify-content: center;
          font-size: 30px; font-weight: 800; color: #84cc16;
        }
        .ict-info { text-align: center; z-index: 1; }
        .ict-call-type {
          font-size: 11px; font-weight: 700; color: #84cc16;
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px;
        }
        .ict-caller-name {
          font-size: 21px; font-weight: 900; color: #fff;
          letter-spacing: -0.4px;
        }
        .ict-group-name { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 2px; }
        .ict-actions { display: flex; gap: 44px; z-index: 1; margin-top: 4px; }
        .ict-btn {
          display: flex; flex-direction: column; align-items: center; gap: 9px;
          cursor: pointer; border: none; background: none; padding: 0;
          transition: transform 0.15s;
        }
        .ict-btn:active { transform: scale(0.9); }
        .ict-btn-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .ict-btn-icon {
          width: 60px; height: 60px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: transform .15s, box-shadow .15s;
        }
        .ict-btn-icon:hover { transform: scale(1.08); }
        .ict-decline-icon {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
          box-shadow: 0 6px 28px rgba(220, 38, 38, 0.45);
          color: #fff;
        }
        .ict-accept-icon {
          background: linear-gradient(135deg, #16a34a, #15803d);
          box-shadow: 0 6px 28px rgba(22, 163, 74, 0.5);
          color: #fff;
          animation: ictGlowAccept 1.6s ease-in-out infinite;
        }
        @keyframes ictGlowAccept {
          0%, 100% { box-shadow: 0 6px 28px rgba(22, 163, 74, 0.5); }
          50%       { box-shadow: 0 6px 40px rgba(22, 163, 74, 0.8), 0 0 0 10px rgba(22,163,74,0.12); }
        }
        .ict-decline .ict-btn-label { color: #ef4444; }
        .ict-accept .ict-btn-label { color: #4ade80; }

        @media (max-width: 480px) {
          .ict-card { border-radius: 22px; padding: 18px 20px 22px; }
          .ict-caller-name { font-size: 19px; }
          .ict-avatar-wrap { width: 68px; height: 68px; }
          .ict-btn-icon { width: 54px; height: 54px; }
        }
      `}</style>
    </>
  );
};

export default IncomingCallToast;