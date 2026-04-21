// components/Messages/IncomingCallToast.jsx — NOVA CALL TOAST v6
// ============================================================================
// FIXES v6:
//  [AVATAR-FIX]  Tries every possible avatar field path. Uses onError to fall
//                back to initials if image fails to load. No more black circle.
//  [DISMISS-FIX] Listens to nova:call_ended → auto-dismisses when caller cancels
//  [COORD-FIX]   Stays silent when DM is open (nova:dm_open/close)
//  Original design/style preserved exactly.
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
  emit(e, d) { this._m.get(e)?.forEach(fn => { try { fn(d); } catch {} }); }
}
export const callEventBus = new CallEventBus();

// ✅ Extract caller name — every possible field path
const extractCallerName = (call) =>
  call?.callerName
  || call?.caller?.full_name
  || call?.caller?.name
  || call?.name
  || "Unknown Caller";

// ✅ Extract avatar ID — every possible field path
const extractCallerAvId = (call) =>
  call?.callerAvatarId
  || call?.callerAvId
  || call?.caller?.avatar_id
  || call?.caller?.avatarId
  || null;

// ✅ Build avatar URL — try getAvatarUrl first, fall back to getImageUrl
const buildAvatarUrl = (avId) => {
  if (!avId) return null;
  try {
    // Try avatar-specific URL builder first
    if (mediaUrlService.getAvatarUrl) {
      const url = mediaUrlService.getAvatarUrl(avId, 200);
      if (url && typeof url === "string" && url.startsWith("http")) return url;
    }
    // Fall back to general image URL
    if (mediaUrlService.getImageUrl) {
      const url = mediaUrlService.getImageUrl(avId);
      if (url && typeof url === "string" && url.startsWith("http")) return url;
    }
  } catch {}
  return null;
};

const RING_DURATION = 45; // seconds

const IncomingCallToast = ({ onAccept, onDecline }) => {
  const [calls,    setCalls]    = useState([]);
  const [dmIsOpen, setDmIsOpen] = useState(false);
  const dmOpenRef        = useRef(false);
  const audioCtxRef      = useRef(null);
  const countdownTimers  = useRef({});

  // ── DM panel coordination ─────────────────────────────────────────────────
  useEffect(() => {
    const onOpen  = () => { setDmIsOpen(true);  dmOpenRef.current = true;  setCalls([]); };
    const onClose = () => { setDmIsOpen(false); dmOpenRef.current = false; };
    window.addEventListener("nova:dm_open",  onOpen);
    window.addEventListener("nova:dm_close", onClose);
    return () => {
      window.removeEventListener("nova:dm_open",  onOpen);
      window.removeEventListener("nova:dm_close", onClose);
    };
  }, []);

  const getCallId = (call) => call?.callId || call?.id;

  const removeCall = useCallback((callId) => {
    if (!callId) return;
    clearInterval(countdownTimers.current[callId]);
    delete countdownTimers.current[callId];
    setCalls(prev => prev.filter(c => getCallId(c) !== callId));
  }, []);

  const addCall = useCallback((callInfo) => {
    if (dmOpenRef.current) return;
    const id = getCallId(callInfo);
    if (!id) return;
    setCalls(prev => {
      if (prev.some(c => getCallId(c) === id)) return prev;
      return [...prev, callInfo];
    });
    // Auto-dismiss countdown
    let secs = RING_DURATION;
    countdownTimers.current[id] = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(countdownTimers.current[id]);
        delete countdownTimers.current[id];
        removeCall(id);
        callService.declineCall(id).catch?.(() => {});
        onDecline?.(id);
      }
    }, 1000);
  }, [removeCall, onDecline]);

  // ── Subscribe ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubService = callService.on("incoming_call",  addCall);
    const unsubBus     = callEventBus.on("incoming_call", addCall);
    const winHandler   = (e) => { if (e.detail) addCall(e.detail); };
    window.addEventListener("nova:incoming_call", winHandler);

    // Auto-dismiss when caller cancels
    const unsubEnded = callService.on("call_ended", ({ callId }) => { if (callId) removeCall(callId); });
    const winEndH    = (e) => { const id = e.detail?.callId; if (id) removeCall(id); };
    window.addEventListener("nova:call_ended", winEndH);

    return () => {
      unsubService(); unsubBus(); unsubEnded();
      window.removeEventListener("nova:incoming_call", winHandler);
      window.removeEventListener("nova:call_ended",    winEndH);
      Object.values(countdownTimers.current).forEach(t => clearInterval(t));
      countdownTimers.current = {};
    };
  }, [addCall, removeCall]);

  // ── Ring audio ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (calls.length > 0 && !dmIsOpen) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const beep = (t) => {
          const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
          o1.connect(g1); g1.connect(ctx.destination);
          o1.frequency.setValueAtTime(880, t); o1.frequency.setValueAtTime(660, t + 0.18);
          g1.gain.setValueAtTime(0.22, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o1.start(t); o1.stop(t + 0.5);
          const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.setValueAtTime(880, t + 0.6); o2.frequency.setValueAtTime(660, t + 0.78);
          g2.gain.setValueAtTime(0.18, t + 0.6); g2.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
          o2.start(t + 0.6); o2.stop(t + 1.1);
        };
        let t = ctx.currentTime + 0.1;
        for (let i = 0; i < 30; i++) { beep(t); t += 2.6; }
      } catch {}
    } else {
      try { audioCtxRef.current?.close(); } catch {}
      audioCtxRef.current = null;
    }
    return () => { try { audioCtxRef.current?.close(); } catch {}; audioCtxRef.current = null; };
  }, [calls.length, dmIsOpen]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAccept = useCallback((call) => {
    const id = getCallId(call);
    removeCall(id);
    try { audioCtxRef.current?.close(); } catch {}
    window.dispatchEvent(new CustomEvent("nova:accept_call", { detail: call }));
    onAccept?.(call);
  }, [removeCall, onAccept]);

  const handleDecline = useCallback((call) => {
    const id = getCallId(call);
    removeCall(id);
    try { audioCtxRef.current?.close(); } catch {}
    callService.declineCall(id).catch?.(() => {});
    onDecline?.(id);
  }, [removeCall, onDecline]);

  if (calls.length === 0 || dmIsOpen) return null;

  const call      = calls[0];
  const isVideo   = call?.type === "video" || call?.callType === "video";
  const isGroup   = ["group","group-video"].includes(call?.type) || ["group","group-video"].includes(call?.callType);
  const callerName= extractCallerName(call);
  const callerAvId= extractCallerAvId(call);
  const avatarUrl = buildAvatarUrl(callerAvId);
  const initials  = callerName.charAt(0).toUpperCase();

  return (
    <CallToastCard
      callerName={callerName}
      avatarUrl={avatarUrl}
      initials={initials}
      isVideo={isVideo}
      isGroup={isGroup}
      groupName={call?.groupName}
      onAccept={() => handleAccept(call)}
      onDecline={() => handleDecline(call)}
    />
  );
};

// ── Separated card component so avatar error state is self-contained ──────────
const CallToastCard = ({ callerName, avatarUrl, initials, isVideo, isGroup, groupName, onAccept, onDecline }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = avatarUrl && !imgFailed;

  return (
    <>
      <div className="ict-overlay" aria-live="assertive" role="dialog" aria-label="Incoming call">
        <div className="ict-card">

          {/* Animated pulse rings */}
          <div className="ict-rings">
            <div className="ict-ring ict-ring-1"/>
            <div className="ict-ring ict-ring-2"/>
            <div className="ict-ring ict-ring-3"/>
          </div>

          {/* ✅ Avatar — with onError fallback so initials show if image fails */}
          <div className="ict-avatar-wrap">
            {showImage ? (
              <img
                src={avatarUrl}
                alt={callerName}
                className="ict-avatar-img"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="ict-avatar-fallback">{initials}</div>
            )}
          </div>

          {/* Info */}
          <div className="ict-info">
            <div className="ict-call-type">
              {isGroup
                ? `Incoming group ${isVideo ? "video" : "voice"} call`
                : `Incoming ${isVideo ? "video" : "voice"} call`}
            </div>
            <div className="ict-caller-name">{callerName}</div>
            {isGroup && groupName && <div className="ict-group-name">{groupName}</div>}
          </div>

          {/* Actions */}
          <div className="ict-actions">
            {/* Decline */}
            <button className="ict-btn ict-decline" onClick={onDecline} aria-label="Decline">
              <div className="ict-btn-icon ict-decline-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.32-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
              </div>
              <span className="ict-btn-label">Decline</span>
            </button>

            {/* Accept */}
            <button className="ict-btn ict-accept" onClick={onAccept} aria-label="Accept">
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
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 999999;
          display: flex; justify-content: center;
          padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 0;
          pointer-events: none;
        }
        .ict-card {
          background: rgba(6, 6, 6, 0.98);
          border: 1px solid rgba(132, 204, 22, 0.3);
          border-radius: 26px;
          padding: 22px 24px 24px;
          width: 100%; max-width: 390px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          box-shadow: 0 32px 80px rgba(0,0,0,.95), 0 0 0 1px rgba(132,204,22,.08);
          backdrop-filter: blur(28px);
          pointer-events: all;
          position: relative; overflow: hidden;
          animation: ictSlideIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes ictSlideIn {
          from { opacity:0; transform:translateY(-130%) scale(0.8); }
          to   { opacity:1; transform:translateY(0)     scale(1); }
        }
        .ict-rings { position:absolute; inset:0; pointer-events:none; display:flex; align-items:center; justify-content:center; }
        .ict-ring  { position:absolute; border-radius:50%; border:1.5px solid rgba(132,204,22,.15); animation:ictRingPulse 2.8s ease-out infinite; }
        .ict-ring-1 { width:80px;  height:80px;  animation-delay:0s;   }
        .ict-ring-2 { width:130px; height:130px; animation-delay:0.7s; }
        .ict-ring-3 { width:180px; height:180px; animation-delay:1.4s; }
        @keyframes ictRingPulse { 0%{transform:scale(.8);opacity:.9} 100%{transform:scale(2);opacity:0} }
        .ict-avatar-wrap {
          position:relative; z-index:1;
          width:76px; height:76px; border-radius:50%; overflow:hidden;
          border:2.5px solid rgba(132,204,22,.4);
          box-shadow:0 0 0 4px rgba(132,204,22,.1), 0 0 24px rgba(132,204,22,.15);
          flex-shrink:0; background:linear-gradient(135deg,#0d1a00,#1a3300);
        }
        .ict-avatar-img {
          width:100%; height:100%; object-fit:cover; display:block;
        }
        .ict-avatar-fallback {
          width:100%; height:100%;
          display:flex; align-items:center; justify-content:center;
          font-size:30px; font-weight:800; color:#84cc16;
        }
        .ict-info        { text-align:center; z-index:1; }
        .ict-call-type   { font-size:11px; font-weight:700; color:#84cc16; text-transform:uppercase; letter-spacing:.8px; margin-bottom:5px; }
        .ict-caller-name { font-size:21px; font-weight:900; color:#fff; letter-spacing:-.4px; }
        .ict-group-name  { font-size:12px; color:rgba(255,255,255,.45); margin-top:2px; }
        .ict-actions     { display:flex; gap:44px; z-index:1; margin-top:4px; }
        .ict-btn {
          display:flex; flex-direction:column; align-items:center; gap:9px;
          cursor:pointer; border:none; background:none; padding:0; transition:transform .15s;
        }
        .ict-btn:active { transform:scale(.9); }
        .ict-btn-label  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
        .ict-btn-icon   { width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:transform .15s, box-shadow .15s; }
        .ict-btn-icon:hover { transform:scale(1.08); }
        .ict-decline-icon { background:linear-gradient(135deg,#dc2626,#b91c1c); box-shadow:0 6px 28px rgba(220,38,38,.45); color:#fff; }
        .ict-accept-icon  { background:linear-gradient(135deg,#16a34a,#15803d); box-shadow:0 6px 28px rgba(22,163,74,.5);  color:#fff; animation:ictGlow 1.6s ease-in-out infinite; }
        @keyframes ictGlow {
          0%,100% { box-shadow:0 6px 28px rgba(22,163,74,.5); }
          50%      { box-shadow:0 6px 40px rgba(22,163,74,.8),0 0 0 10px rgba(22,163,74,.12); }
        }
        .ict-decline .ict-btn-label { color:#ef4444; }
        .ict-accept  .ict-btn-label { color:#4ade80; }
        @media(max-width:480px) {
          .ict-card { border-radius:22px; padding:18px 20px 22px; }
          .ict-caller-name { font-size:19px; }
          .ict-btn-icon { width:54px; height:54px; }
        }
      `}</style>
    </>
  );
};

export default IncomingCallToast;