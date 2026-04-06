// ============================================================================
// components/Messages/IncomingCallToast.jsx — NOVA CALL TOAST v3 FINAL
// ============================================================================
// MODES:
//   Mobile fullscreen — gorgeous incoming call screen with:
//     • Swipe right circle to ACCEPT (green glow trail)
//     • Swipe left circle to DECLINE (red glow trail)
//     • Caller photo, animated rings, live dots
//   Desktop toast — compact pill at top-right:
//     • Decline (red) + Accept (green) buttons
//     • Avatar, caller name, call type
//   Both: 30-second auto-decline, ringtone, ripple rings
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── EVENT BUS ─── */
class CallEventBus {
  constructor() { this._l = new Map(); }
  on(evt, fn) {
    if (!this._l.has(evt)) this._l.set(evt, new Set());
    this._l.get(evt).add(fn);
    return () => this._l.get(evt)?.delete(fn);
  }
  emit(evt, d) { this._l.get(evt)?.forEach(fn => { try { fn(d); } catch(e) {} }); }
}
export const callEventBus = new CallEventBus();

/* ─── RINGTONE ─── */
const ring = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (t, f, d) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d);
    };
    const n = ctx.currentTime;
    play(n, 880, 0.18); play(n+.22, 1100, 0.18); play(n+.44, 880, 0.18);
    return ctx;
  } catch { return null; }
};

/* ─── ICONS ─── */
const PhoneI = ({size=22,col="currentColor"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
);
const VideoI = ({size=22}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);
const EndI = ({size=22}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.32-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
  </svg>
);

/* ─── AVATAR ─── */
const CallerAv = ({ call, size }) => {
  const [err, setErr] = useState(false);
  const url = !err && call.callerAvatarId
    ? mediaUrlService.getAvatarUrl(call.callerAvatarId, 400) : null;
  return url
    ? <img src={url} alt={call.callerName} onError={() => setErr(true)}
        className="ict-av-img" style={{ width: size, height: size }}/>
    : <div className="ict-av-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
        {(call.callerName || "?").charAt(0).toUpperCase()}
      </div>;
};

/* ─── MOBILE FULLSCREEN INCOMING CALL ─── */
const MobileFullscreen = ({ call, onAccept, onDecline, secsLeft }) => {
  const isVid   = call.type === "video" || call.type === "group-video";
  const isGroup = call.type === "group" || call.type === "group-video";

  // Swipe state
  const [drag, setDrag]     = useState(0);   // -1 decline, 0 neutral, 1 accept
  const [dragX, setDragX]   = useState(0);
  const [dragging, setDrag2]= useState(false);
  const startX = useRef(0);
  const nodeRef = useRef(null);

  const THRESHOLD = 90;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; setDrag2(true); };
  const onTouchMove  = e => {
    const dx = e.touches[0].clientX - startX.current;
    setDragX(dx);
    if (dx > 20) setDrag(1);
    else if (dx < -20) setDrag(-1);
    else setDrag(0);
  };
  const onTouchEnd = () => {
    setDrag2(false);
    if (dragX > THRESHOLD) onAccept(call);
    else if (dragX < -THRESHOLD) onDecline(call.id);
    setDragX(0); setDrag(0);
  };

  const pct = ((30 - secsLeft) / 30) * 100;

  return (
    <div className="ict-fs-root">
      {/* Blurred background */}
      <div className="ict-fs-bg">
        {call.callerAvatarId && (
          <img src={mediaUrlService.getAvatarUrl(call.callerAvatarId, 600)} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.3)", transform: "scale(1.2)" }}
            onError={() => {}}/>
        )}
        <div className="ict-fs-bg-overlay"/>
      </div>

      {/* Animated ring particles */}
      <div className="ict-fs-rings">
        {[0,1,2,3].map(i => <div key={i} className="ict-fs-ring" style={{ animationDelay: `${i * 0.7}s` }}/>)}
      </div>

      {/* Top bar */}
      <div className="ict-fs-top">
        <div className="ict-fs-call-type-pill">
          {isVid ? <VideoI size={14}/> : <PhoneI size={14}/>}
          <span>{isGroup ? "Group " : ""}{isVid ? "Video" : "Voice"} Call</span>
        </div>
      </div>

      {/* Caller info */}
      <div className="ict-fs-caller">
        <div className="ict-fs-av-wrap">
          <CallerAv call={call} size={120}/>
          {/* Timer ring */}
          <svg className="ict-fs-timer-ring" viewBox="0 0 136 136">
            <circle cx="68" cy="68" r="62" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4"/>
            <circle cx="68" cy="68" r="62" fill="none" stroke="#84cc16" strokeWidth="4"
              strokeDasharray={`${2*Math.PI*62}`}
              strokeDashoffset={`${2*Math.PI*62*(pct/100)}`}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s linear" }}/>
          </svg>
        </div>
        <div className="ict-fs-name">{call.callerName}</div>
        <div className="ict-fs-status">
          {isGroup ? `${call.participantCount > 0 ? `${call.participantCount + 1} people · ` : ""}Group call` : "Calling you…"}
        </div>
        {/* Live dots */}
        <div className="ict-fs-dots">
          <span/><span/><span/>
        </div>
        <div className="ict-fs-timer-txt" style={{ color: secsLeft <= 5 ? "#ef4444" : "rgba(255,255,255,.4)" }}>
          {secsLeft}s
        </div>
      </div>

      {/* Swipe zone */}
      <div className="ict-fs-swipe-zone">
        {/* Hint labels */}
        <div className="ict-fs-hint" style={{ opacity: drag === -1 ? 1 : 0.35, color: "#ef4444" }}>
          ← Decline
        </div>
        <div className="ict-fs-hint" style={{ opacity: drag === 1 ? 1 : 0.35, color: "#84cc16" }}>
          Accept →
        </div>
      </div>

      {/* Swipeable circle */}
      <div className="ict-fs-swipe-wrap">
        <div
          ref={nodeRef}
          className={`ict-fs-swipe-circle${drag === 1 ? " ict-sw-accept" : drag === -1 ? " ict-sw-decline" : ""}`}
          style={{ transform: `translateX(${Math.max(-120, Math.min(120, dragX))}px)`, transition: dragging ? "none" : "transform .3s cubic-bezier(.34,1.56,.64,1)" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {drag === -1 ? <EndI size={28}/> : isVid ? <VideoI size={28}/> : <PhoneI size={28}/>}
        </div>
        <div className="ict-fs-swipe-track">
          <div className="ict-fs-track-left">
            <EndI size={20}/>
          </div>
          <div className="ict-fs-track-right">
            {isVid ? <VideoI size={20}/> : <PhoneI size={20}/>}
          </div>
        </div>
      </div>

      {/* Tap buttons as fallback on desktop-ish small devices */}
      <div className="ict-fs-tap-btns">
        <button className="ict-fs-tap-btn ict-tap-decline" onClick={() => onDecline(call.id)}>
          <EndI size={26}/>
        </button>
        <button className="ict-fs-tap-btn ict-tap-accept" onClick={() => onAccept(call)}>
          {isVid ? <VideoI size={26}/> : <PhoneI size={26}/>}
        </button>
      </div>
    </div>
  );
};

/* ─── DESKTOP TOAST ─── */
const DesktopToast = ({ call, idx, onAccept, onDecline, secsLeft }) => {
  const isVid   = call.type === "video" || call.type === "group-video";
  const isGroup = call.type === "group" || call.type === "group-video";

  return (
    <div className="ict-toast" style={{ animationDelay: `${idx * .08}s`, zIndex: 100000 - idx }}>
      {/* Shimmer sweep */}
      <div className="ict-shimmer" aria-hidden/>
      {/* Ripple behind avatar */}
      <div className="ict-ripple-bg"><div className="ict-r1"/><div className="ict-r2"/></div>

      <div className="ict-av-wrap">
        <CallerAv call={call} size={50}/>
        <div className={`ict-type-badge ${isVid ? "video" : "audio"}`}>
          {isVid ? <VideoI size={10}/> : <PhoneI size={10}/>}
        </div>
      </div>

      <div className="ict-info">
        <div className="ict-name">{call.callerName}</div>
        <div className="ict-desc">
          {isGroup ? `Group ${isVid?"video":"voice"} call` : `Incoming ${isVid?"video":"voice"} call`}
        </div>
        <div className="ict-live"><span/><span/><span/></div>
      </div>

      {/* Timer */}
      <div className="ict-timer" style={{ color: secsLeft <= 5 ? "#ef4444" : "rgba(255,255,255,.35)" }}>
        {secsLeft}s
      </div>

      <div className="ict-actions">
        <button className="ict-btn ict-dec" onClick={() => onDecline(call.id)} aria-label="Decline">
          <EndI size={20}/>
        </button>
        <button className="ict-btn ict-acc" onClick={() => onAccept(call)} aria-label="Accept">
          {isVid ? <VideoI size={20}/> : <PhoneI size={20}/>}
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
const IncomingCallToast = ({ onAccept, onDecline }) => {
  const [calls,   setCalls]   = useState([]);
  const [isMobile,setMobile]  = useState(window.innerWidth < 769);
  const [timers,  setTimers]  = useState({});  // callId → secsLeft
  const ringInts  = useRef({});
  const countInts = useRef({});
  const autoDecTs = useRef({});

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 769);
    window.addEventListener("resize", r, { passive: true });
    return () => window.removeEventListener("resize", r);
  }, []);

  const removeCall = useCallback((callId) => {
    clearInterval(ringInts.current[callId]);
    clearInterval(countInts.current[callId]);
    clearTimeout(autoDecTs.current[callId]);
    delete ringInts.current[callId];
    delete countInts.current[callId];
    delete autoDecTs.current[callId];
    setCalls(prev => prev.filter(c => c.id !== callId));
    setTimers(prev => { const n = {...prev}; delete n[callId]; return n; });
  }, []);

  const startRing = useCallback((callId) => {
    ring();
    ringInts.current[callId] = setInterval(ring, 2000);

    // Countdown timer
    setTimers(prev => ({ ...prev, [callId]: 30 }));
    countInts.current[callId] = setInterval(() => {
      setTimers(prev => {
        const left = (prev[callId] || 30) - 1;
        return { ...prev, [callId]: left };
      });
    }, 1000);

    autoDecTs.current[callId] = setTimeout(() => {
      removeCall(callId);
      callEventBus.emit("call_declined", callId);
    }, 30000);
  }, [removeCall]);

  useEffect(() => {
    const u1 = callEventBus.on("incoming_call", (info) => {
      const call = {
        id: info.id || `call_${Date.now()}`,
        callerName:      info.callerName || "Unknown",
        callerAvatarId:  info.callerAvatarId || info.callerAvatar || null,
        type:            info.type || "audio",
        groupName:       info.groupName || null,
        participantCount:info.participantCount || 0,
        callData:        info,
        ts:              Date.now(),
      };
      setCalls(prev => prev.some(c => c.id === call.id) ? prev : [...prev, call]);
      startRing(call.id);
    });

    const u2 = callEventBus.on("call_ended_remote", removeCall);
    return () => { u1(); u2(); };
  }, [startRing, removeCall]);

  useEffect(() => () => {
    Object.values(ringInts.current).forEach(clearInterval);
    Object.values(countInts.current).forEach(clearInterval);
    Object.values(autoDecTs.current).forEach(clearTimeout);
  }, []);

  const handleAccept = useCallback((call) => {
    removeCall(call.id);
    onAccept?.(call.callData);
  }, [removeCall, onAccept]);

  const handleDecline = useCallback((callId) => {
    removeCall(callId);
    onDecline?.(callId);
    callEventBus.emit("call_declined", callId);
  }, [removeCall, onDecline]);

  if (calls.length === 0) return null;

  // Mobile: show fullscreen for the first (most recent) call
  if (isMobile) {
    const call = calls[0];
    return (
      <>
        <MobileFullscreen
          call={call}
          secsLeft={timers[call.id] ?? 30}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
        <style>{CSS}</style>
      </>
    );
  }

  // Desktop: toast(s) at top-right
  return (
    <>
      <div className="ict-container">
        {calls.map((call, idx) => (
          <DesktopToast
            key={call.id}
            call={call}
            idx={idx}
            secsLeft={timers[call.id] ?? 30}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}
      </div>
      <style>{CSS}</style>
    </>
  );
};

const CSS = `
/* ══════════════════════════════════════════════════
   DESKTOP TOAST
══════════════════════════════════════════════════ */
.ict-container {
  position: fixed;
  top: 0; right: 0;
  z-index: 99998;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: calc(env(safe-area-inset-top,0px) + 14px) 16px 0;
  gap: 10px;
  pointer-events: none;
}

.ict-toast {
  position: relative;
  width: 340px;
  background: rgba(8,8,8,.97);
  border: 1px solid rgba(132,204,22,.3);
  border-radius: 20px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,.8), 0 0 40px rgba(132,204,22,.08);
  backdrop-filter: blur(20px);
  overflow: hidden;
  pointer-events: all;
  animation: ictIn .45s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes ictIn {
  from { opacity:0; transform:translateX(100%) scale(.9); }
  to   { opacity:1; transform:translateX(0) scale(1); }
}

.ict-shimmer {
  position: absolute; inset: 0; border-radius: 20px;
  background: linear-gradient(90deg,transparent,rgba(132,204,22,.12),transparent);
  animation: ictShim 2s linear infinite;
  pointer-events: none;
}
@keyframes ictShim { from{transform:translateX(-100%)} to{transform:translateX(100%)} }

.ict-ripple-bg { position:absolute;left:20px;top:50%;transform:translateY(-50%);pointer-events:none; }
.ict-r1,.ict-r2 { position:absolute;border-radius:50%;border:1.5px solid rgba(132,204,22,.25);animation:ictRip 2s ease-out infinite; }
.ict-r1 { width:68px;height:68px;top:-34px;left:-34px; }
.ict-r2 { width:90px;height:90px;top:-45px;left:-45px;animation-delay:.4s; }
@keyframes ictRip { 0%{transform:scale(.6);opacity:.8} 100%{transform:scale(1.4);opacity:0} }

.ict-av-wrap { position:relative;flex-shrink:0;z-index:1; }
.ict-av-img  { border-radius:50%;object-fit:cover;border:2px solid rgba(132,204,22,.4); }
.ict-av-fallback { border-radius:50%;background:linear-gradient(135deg,#0d1a00,#1a3300);border:2px solid rgba(132,204,22,.4);display:flex;align-items:center;justify-content:center;font-weight:800;color:#84cc16; }
.ict-type-badge { position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;border:2px solid #000;display:flex;align-items:center;justify-content:center; }
.ict-type-badge.audio { background:rgba(132,204,22,.9);color:#000; }
.ict-type-badge.video { background:rgba(96,165,250,.9);color:#fff; }

.ict-info { flex:1;min-width:0;z-index:1; }
.ict-name  { font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.ict-desc  { font-size:11px;color:rgba(255,255,255,.5);margin-top:2px; }
.ict-live  { display:flex;align-items:center;gap:3px;margin-top:5px; }
.ict-live span { width:5px;height:5px;border-radius:50%;background:#84cc16;animation:ictDot 1.2s ease-in-out infinite; }
.ict-live span:nth-child(2){animation-delay:.2s;}.ict-live span:nth-child(3){animation-delay:.4s;}
@keyframes ictDot { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1.2)} }

.ict-timer { font-size:11px;font-weight:700;flex-shrink:0;z-index:1;min-width:24px;text-align:center; }

.ict-actions { display:flex;gap:8px;flex-shrink:0;z-index:1; }
.ict-btn { width:44px;height:44px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s; }
.ict-btn:active { transform:scale(.9); }
.ict-dec { background:rgba(239,68,68,.15);border:1.5px solid rgba(239,68,68,.4)!important;color:#ef4444; }
.ict-dec:hover { background:rgba(239,68,68,.25); }
.ict-acc { background:linear-gradient(135deg,rgba(132,204,22,.3),rgba(34,197,94,.2));border:1.5px solid rgba(132,204,22,.5)!important;color:#84cc16;animation:accGlow 1.5s ease-in-out infinite; }
.ict-acc:hover { background:linear-gradient(135deg,rgba(132,204,22,.45),rgba(34,197,94,.35)); }
@keyframes accGlow { 0%,100%{box-shadow:0 0 0 0 rgba(132,204,22,.4)} 50%{box-shadow:0 0 0 10px rgba(132,204,22,0)} }

/* ══════════════════════════════════════════════════
   MOBILE FULLSCREEN
══════════════════════════════════════════════════ */
.ict-fs-root {
  position: fixed; inset: 0; z-index: 99999;
  display: flex; flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg,#000 0%,#050505 100%);
  overflow: hidden;
}

.ict-fs-bg {
  position: absolute; inset: 0;
  z-index: 0; overflow: hidden;
}
.ict-fs-bg-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom,rgba(0,0,0,.55) 0%,rgba(0,0,0,.7) 40%,rgba(0,0,0,.85) 75%,#000 100%);
}

.ict-fs-rings {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; z-index: 1;
}
.ict-fs-ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid rgba(132,204,22,.2);
  animation: fsRing 3s ease-out infinite;
}
.ict-fs-ring:nth-child(1){width:220px;height:220px;}
.ict-fs-ring:nth-child(2){width:320px;height:320px;}
.ict-fs-ring:nth-child(3){width:430px;height:430px;}
.ict-fs-ring:nth-child(4){width:560px;height:560px;}
@keyframes fsRing {
  0%   { transform:scale(.6); opacity:.7; }
  100% { transform:scale(1.5); opacity:0; }
}

.ict-fs-top {
  position: relative; z-index: 2;
  padding: calc(env(safe-area-inset-top,0px)+18px) 20px 0;
  width: 100%; text-align: center;
}
.ict-fs-call-type-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,.6);
}

.ict-fs-caller {
  position: relative; z-index: 2;
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 20px;
}

.ict-fs-av-wrap {
  position: relative; width: 136px; height: 136px;
  display: flex; align-items: center; justify-content: center;
}
.ict-fs-av-wrap .ict-av-img,
.ict-fs-av-wrap .ict-av-fallback { width:120px;height:120px;border-radius:50%;border:3px solid rgba(132,204,22,.35); }
.ict-fs-timer-ring {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none;
}

.ict-fs-name {
  font-size: 30px; font-weight: 900; color: #fff;
  letter-spacing: -.5px; text-align: center;
}
.ict-fs-status {
  font-size: 15px; color: rgba(255,255,255,.55);
  text-align: center;
}
.ict-fs-dots {
  display: flex; align-items: center; gap: 6px;
}
.ict-fs-dots span {
  width: 8px; height: 8px; border-radius: 50%;
  background: #84cc16;
  animation: fsDot 1.4s ease-in-out infinite;
}
.ict-fs-dots span:nth-child(2){animation-delay:.2s;}
.ict-fs-dots span:nth-child(3){animation-delay:.4s;}
@keyframes fsDot { 0%,80%,100%{opacity:.25;transform:scale(.7)} 40%{opacity:1;transform:scale(1.3)} }

.ict-fs-timer-txt {
  font-size: 13px; font-weight: 700;
  transition: color .5s;
}

/* Swipe zone (labels) */
.ict-fs-swipe-zone {
  position: relative; z-index: 2;
  width: 100%; max-width: 320px;
  display: flex; justify-content: space-between;
  padding: 0 24px;
  margin-bottom: 8px;
}
.ict-fs-hint {
  font-size: 13px; font-weight: 700;
  transition: opacity .2s, color .2s;
}

/* Swipeable circle */
.ict-fs-swipe-wrap {
  position: relative; z-index: 2;
  width: 100%; max-width: 320px;
  height: 72px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: calc(env(safe-area-inset-bottom,0px)+20px);
}

.ict-fs-swipe-track {
  position: absolute; inset: 0;
  border-radius: 36px;
  background: rgba(255,255,255,.06);
  border: 1.5px solid rgba(255,255,255,.1);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px;
}
.ict-fs-track-left  { color: rgba(239,68,68,.5); }
.ict-fs-track-right { color: rgba(132,204,22,.5); }

.ict-fs-swipe-circle {
  position: relative;
  width: 62px; height: 62px;
  border-radius: 50%;
  background: rgba(132,204,22,.15);
  border: 2px solid rgba(132,204,22,.45);
  display: flex; align-items: center; justify-content: center;
  color: #84cc16;
  cursor: grab; z-index: 1;
  user-select: none; touch-action: none;
  animation: swipeGlow 2s ease-in-out infinite;
}
.ict-fs-swipe-circle:active { cursor: grabbing; }
@keyframes swipeGlow {
  0%,100% { box-shadow:0 0 0 0 rgba(132,204,22,.4); }
  50%      { box-shadow:0 0 0 16px rgba(132,204,22,0); }
}
.ict-sw-accept {
  background: rgba(34,197,94,.2);
  border-color: rgba(34,197,94,.6);
  color: #22c55e;
}
.ict-sw-decline {
  background: rgba(239,68,68,.2);
  border-color: rgba(239,68,68,.6);
  color: #ef4444;
  animation: none;
}

/* Tap buttons (shown on touch devices as fallback below swipe) */
.ict-fs-tap-btns {
  display: none;
  position: relative; z-index: 2;
  gap: 40px;
  padding-bottom: calc(env(safe-area-inset-bottom,0px)+24px);
}
/* On non-touch (desktop-ish) show tap buttons instead */
@media (hover: hover) {
  .ict-fs-swipe-wrap { display: none; }
  .ict-fs-swipe-zone { display: none; }
  .ict-fs-tap-btns   { display: flex; }
}

.ict-fs-tap-btn {
  width: 70px; height: 70px;
  border-radius: 50%;
  border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}
.ict-fs-tap-btn:active { transform: scale(.92); }
.ict-tap-decline {
  background: rgba(239,68,68,.18);
  border: 2px solid rgba(239,68,68,.45) !important;
  color: #ef4444;
}
.ict-tap-decline:hover { background:rgba(239,68,68,.28); }
.ict-tap-accept {
  background: linear-gradient(135deg,rgba(132,204,22,.3),rgba(34,197,94,.2));
  border: 2px solid rgba(132,204,22,.55) !important;
  color: #84cc16;
  animation: accGlow 1.6s ease-in-out infinite;
}
.ict-tap-accept:hover { background:linear-gradient(135deg,rgba(132,204,22,.45),rgba(34,197,94,.35)); }

/* ── Responsive ── */
@media (max-width:480px) {
  .ict-toast { width:calc(100vw - 24px); border-radius:16px; }
  .ict-fs-name { font-size:26px; }
}
`;

export default IncomingCallToast;