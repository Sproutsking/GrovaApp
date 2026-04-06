// ============================================================================
// components/Messages/ActiveCall.jsx — NOVA CALL ENGINE v4 FINAL
// ============================================================================
// FIXED:
//  [1] End screen fully styled — gorgeous per-reason UI, no broken layout
//  [2] Calls never auto-connect — callee must tap Accept
//  [3] 30-second ring timeout → "No Answer" end screen
//  [4] Participant thumbnails always show avatar images, never letters if img exists
//  [5] Group call grid with real avatar images in tiles
//  [6] Quality sheet, data meter, network bars all preserved
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── helpers ─── */
const fmt  = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const ini  = name => (name||"?").charAt(0).toUpperCase();
const aUrl = user => {
  const id = user?.avatar_id || user?.avatarId;
  return id ? mediaUrlService.getAvatarUrl(id, 200) : null;
};
const RING_MAX = 30;

const RTC_CONFIG = {
  iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}],
  iceCandidatePoolSize:10, bundlePolicy:"max-bundle", rtcpMuxPolicy:"require",
};

const PRESETS = [
  { id:"whisper",label:"Whisper",icon:"🍃",color:"#22c55e",est:"~45 KB/min",
    constraints:{audio:{sampleRate:8000,echoCancellation:true,noiseSuppression:true},video:false}},
  { id:"crystal",label:"Crystal",icon:"💎",color:"#84cc16",est:"~180 KB/min",
    constraints:{audio:{sampleRate:24000,echoCancellation:true,noiseSuppression:true},video:false}},
  { id:"vision", label:"Vision", icon:"👁️",color:"#60a5fa",est:"~1.4 MB/min",
    constraints:{audio:{sampleRate:48000,echoCancellation:true},video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:15}}}},
  { id:"vivid",  label:"Vivid",  icon:"✨",color:"#c084fc",est:"~3.2 MB/min",
    constraints:{audio:{sampleRate:48000,echoCancellation:true},video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}}}},
];

const BACKGROUNDS = [
  "radial-gradient(ellipse 80% 60% at 50% 40%,rgba(132,204,22,.18) 0%,rgba(0,0,0,.98) 65%),#000",
  "radial-gradient(ellipse 100% 80% at 50% 0%,rgba(96,165,250,.2) 0%,transparent 50%),radial-gradient(ellipse 60% 60% at 0% 100%,rgba(192,132,252,.15) 0%,transparent 60%),#050510",
  "radial-gradient(ellipse 90% 70% at 50% 50%,rgba(239,68,68,.15) 0%,transparent 60%),#0d0000",
  "repeating-linear-gradient(0deg,rgba(132,204,22,.03) 0px,rgba(132,204,22,.03) 1px,transparent 1px,transparent 24px),repeating-linear-gradient(90deg,rgba(132,204,22,.03) 0px,rgba(132,204,22,.03) 1px,transparent 1px,transparent 24px),#000",
];

/* ─── Icons ─── */
const Ic={
  End:     ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.32-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>,
  Phone:   ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Video:   ()=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  MicOn:   ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  CamOn:   ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  CamOff:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34m-7.72-2.06a4 4 0 11-5.56-5.56"/></svg>,
  SpkOn:   ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
  SpkOff:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
  Screen:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Flip:    ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>,
  Expand:  ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  Close:   ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Users:   ()=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Shield:  ()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Retry:   ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  Msg:     ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
};

/* ═══ AVATAR COMPONENT — always tries image first ═══ */
const Av = memo(({ user, size=52, speak=false }) => {
  const [err, setErr] = useState(false);
  const url = !err ? aUrl(user) : null;
  return (
    <div className={`ncav${speak?" ncav-speak":""}`} style={{width:size,height:size,fontSize:size*.38,flexShrink:0}}>
      {url
        ? <img src={url} alt={user?.full_name||user?.name||"?"} onError={()=>setErr(true)}
            style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
        : <span>{ini(user?.full_name||user?.name)}</span>
      }
    </div>
  );
});
Av.displayName="Av";

/* ═══ RING TIMER — 30s countdown SVG arc ═══ */
const RingTimer = ({ max=RING_MAX, onTimeout }) => {
  const [left,setLeft]=useState(max);
  useEffect(()=>{
    const t=setInterval(()=>setLeft(n=>{if(n<=1){clearInterval(t);onTimeout?.();return 0;}return n-1;}),1000);
    return()=>clearInterval(t);
  },[onTimeout]);
  const pct=(left/max)*100;
  const col=left>10?"#84cc16":left>5?"#f59e0b":"#ef4444";
  return(
    <div className="rtimer">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3"/>
        <circle cx="26" cy="26" r="22" fill="none" stroke={col} strokeWidth="3"
          strokeDasharray={`${2*Math.PI*22}`} strokeDashoffset={`${2*Math.PI*22*(1-pct/100)}`}
          strokeLinecap="round"
          style={{transform:"rotate(-90deg)",transformOrigin:"center",transition:"stroke-dashoffset 1s linear,stroke .5s"}}/>
      </svg>
      <span className="rtimer-n" style={{color:col}}>{left}</span>
    </div>
  );
};

/* ═══ END SCREEN — fully styled per reason ═══ */
const EndScreen = ({ reason, call, onClose, onCallback }) => {
  const cfgs = {
    unavailable:{ emoji:"📵", title:"Not Available",    sub:`${call.name} didn't pick up`,        color:"#f59e0b", actions:["callback","close"] },
    declined:   { emoji:"🚫", title:"Call Declined",    sub:`${call.name} declined your call`,     color:"#ef4444", actions:["message","close"]  },
    ended:      { emoji:"📞", title:"Call Ended",       sub:"The call has ended",                   color:"#84cc16", actions:["callback","close"] },
    failed:     { emoji:"⚠️", title:"Connection Failed",sub:"Could not establish a connection",    color:"#f59e0b", actions:["retry","close"]    },
    timeout:    { emoji:"⏱️", title:"No Answer",        sub:`${call.name} didn't answer in time`,  color:"#6b7280", actions:["callback","close"] },
  };
  const c = cfgs[reason] || cfgs.ended;
  const bg = `radial-gradient(ellipse 80% 60% at 50% 40%, ${c.color}18 0%, rgba(0,0,0,.98) 65%), #000`;

  return (
    <div className="es-root" style={{background:bg}}>
      <div className="es-particles">
        {[0,1,2].map(i=><div key={i} className={`es-p es-p${i}`} style={{background:c.color}}/>)}
      </div>

      {/* Caller avatar — with image */}
      <div style={{position:"relative",zIndex:1,marginBottom:8}}>
        <Av user={call.user} size={96}/>
        <div className="es-ring" style={{borderColor:`${c.color}40`}}/>
        <div className="es-ring es-ring2" style={{borderColor:`${c.color}20`}}/>
      </div>

      <div className="es-emoji">{c.emoji}</div>
      <div className="es-title" style={{color:c.color}}>{c.title}</div>
      <div className="es-sub">{c.sub}</div>
      {reason==="ended" && call.duration>0 && (
        <div className="es-dur" style={{color:c.color}}>Duration: {fmt(call.duration)}</div>
      )}

      <div className="es-actions">
        {c.actions.includes("callback") && (
          <button className="es-btn" style={{background:`${c.color}18`,borderColor:`${c.color}44`,color:c.color}}
            onClick={()=>onCallback?.("callback")}><Ic.Phone/><span>Call again</span></button>
        )}
        {c.actions.includes("retry") && (
          <button className="es-btn" style={{background:`${c.color}18`,borderColor:`${c.color}44`,color:c.color}}
            onClick={()=>onCallback?.("retry")}><Ic.Retry/><span>Try again</span></button>
        )}
        {c.actions.includes("message") && (
          <button className="es-btn es-btn-msg" onClick={()=>{onCallback?.("message");onClose();}}>
            <Ic.Msg/><span>Send message</span>
          </button>
        )}
        <button className="es-btn es-btn-close" onClick={onClose}>
          <Ic.Close/><span>Close</span>
        </button>
      </div>
    </div>
  );
};

/* ═══ PARTICIPANT TILE — always shows avatar image ═══ */
const PTile = memo(({ p, speak, onExp }) => {
  const vRef=useRef(null);
  const [imgErr,setImgErr]=useState(false);
  useEffect(()=>{if(vRef.current&&p.stream)vRef.current.srcObject=p.stream;},[p.stream]);
  const hasVid=p.stream&&p.stream.getVideoTracks().length>0&&!p.camOff;
  const url=!imgErr?aUrl(p):null;
  const name=p.isLocal?"You":(p.full_name||p.name||"User");

  return(
    <div className={`ptile${speak?" ptile-speak":""}${hasVid?"":" ptile-novc"}`} onClick={()=>onExp?.(p)}>
      {hasVid&&<video ref={vRef} autoPlay playsInline muted={p.isLocal} className="ptile-vid"
        style={{transform:p.isLocal?"scaleX(-1)":"none"}}/>}
      {!hasVid&&(
        <div className="ptile-center">
          {url
            ? <img src={url} alt={name} className="ptile-avimg" onError={()=>setImgErr(true)}/>
            : <span className="ptile-avinit">{ini(p.full_name||p.name)}</span>
          }
          {speak&&<div className="ptile-wave">{[0,1,2,3,4].map(i=><span key={i} style={{animationDelay:`${i*.09}s`}}/>)}</div>}
        </div>
      )}
      {speak&&<div className="ptile-ring"/>}
      <button className="ptile-exp" onClick={e=>{e.stopPropagation();onExp?.(p);}}><Ic.Expand/></button>
      {p.isLocal && <div className="ptile-you">YOU</div>}
      <div className="ptile-foot">
        <span className="ptile-name">{name}</span>
        <div className="ptile-icons">{p.muted&&<span>🔇</span>}{p.camOff&&<span>📵</span>}{speak&&<span className="ptile-dot"/>}</div>
      </div>
    </div>
  );
});
PTile.displayName="PTile";

/* ═══ GROUP GRID ═══ */
const GGrid=({all,spkIds,onExp})=>{
  const n=all.length;
  const cls=n<=1?"gg1":n===2?"gg2":n===3?"gg3":n===4?"gg4":n<=6?"gg6":"ggn";
  return(<div className={`ggrid ${cls}`}>
    {all.map((p,i)=><PTile key={p.isLocal?"local":(p.id||i)} p={p} speak={spkIds.has(p.isLocal?"local":p.id)} onExp={onExp}/>)}
  </div>);
};

/* ═══ EXPANDED MODAL ═══ */
const ExpModal=({p,onClose,mobile})=>{
  const vRef=useRef(null);
  const [imgErr,setImgErr]=useState(false);
  useEffect(()=>{if(vRef.current&&p?.stream)vRef.current.srcObject=p.stream;},[p?.stream]);
  if(!p)return null;
  const url=!imgErr?aUrl(p):null;
  const name=p.isLocal?"You":(p.full_name||p.name||"User");
  const hasVid=p.stream&&p.stream.getVideoTracks().length>0&&!p.camOff;
  return(
    <div className="exm-ov" onClick={onClose}>
      <div className={`exm-modal${mobile?" exm-mobile":""}`} onClick={e=>e.stopPropagation()}>
        <button className="exm-close" onClick={onClose}><Ic.Close/></button>
        {hasVid
          ?<video ref={vRef} autoPlay playsInline muted={p.isLocal} className="exm-vid" style={{transform:p.isLocal?"scaleX(-1)":"none"}}/>
          :<div className="exm-avbg">
            {url?<img src={url} alt={name} className="exm-avimg" onError={()=>setImgErr(true)}/>
                :<span className="exm-avinit">{ini(p.full_name||p.name)}</span>}
          </div>
        }
        <div className="exm-info">
          <span className="exm-name">{name}</span>
          <div className="exm-chips">
            {p.muted&&<span className="exm-chip exm-muted">🔇 Muted</span>}
            {p.camOff&&<span className="exm-chip exm-cam">📵 Camera off</span>}
            {!p.muted&&!p.camOff&&<span className="exm-chip exm-live">🟢 Active</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══ AUDIO VIZ ═══ */
const AViz=({active,color="#84cc16"})=>(
  <div className="aviz">{Array.from({length:16}).map((_,i)=>(
    <div key={i} className={`aviz-b${active?" aviz-on":""}`} style={{animationDelay:`${i*.06}s`,background:color}}/>
  ))}</div>
);

/* ═══ QUALITY SHEET ═══ */
const QSheet=({cur,onChange,onClose,isVid})=>(
  <div className="qs-ov" onClick={onClose}>
    <div className="qs-sh" onClick={e=>e.stopPropagation()}>
      <div className="qs-pill"/><div className="qs-hd"><span>Call Quality</span><button className="qs-x" onClick={onClose}><Ic.Close/></button></div>
      <p className="qs-sub">Lower = less data, voice stays crystal clear.</p>
      {PRESETS.map(p=>{const ok=isVid||!p.constraints.video;return(
        <button key={p.id} className={`qs-row${cur===p.id?" qs-on":""}${!ok?" qs-dis":""}`}
          onClick={()=>{if(!ok)return;onChange(p.id);onClose();}}>
          <span className="qs-ico">{p.icon}</span>
          <div className="qs-inf"><span className="qs-lbl" style={{color:cur===p.id?p.color:"#fff"}}>{p.label}</span><span className="qs-est" style={{color:p.color}}>{p.est}</span></div>
          {cur===p.id&&<span style={{color:p.color,fontWeight:700}}>✓</span>}
          {!ok&&<span className="qs-lk">audio only</span>}
        </button>
      );})}
    </div>
  </div>
);

/* ═══ DATA METER ═══ */
const DataMeter=({presetId,secs})=>{
  const rates={whisper:.045,crystal:.18,vision:1.4,vivid:3.2};
  const rate=rates[presetId]||.18;
  const used=((secs/60)*rate).toFixed(2);
  const p=PRESETS.find(x=>x.id===presetId)||PRESETS[1];
  return(
    <div className="dm-meter">
      <div className="dm-bars">{[20,40,65,100].map((h,i)=><div key={i} className="dm-bar" style={{height:`${h}%`,background:i<2?p.color:"rgba(255,255,255,.15)"}}/>)}</div>
      <div className="dm-nums"><span className="dm-used">{used}MB</span><span className="dm-rate">{rate}MB/m</span></div>
    </div>
  );
};

/* ═══ CONTROL BTN ═══ */
const Btn=({onClick,label,children,tog,red,green,lg})=>(
  <div className="cbg">
    <button className={`cb${tog?" cb-tog":""}${red?" cb-red":""}${green?" cb-grn":""}${lg?" cb-lg":""}`}
      onClick={onClick} aria-label={label}>{children}</button>
    {label&&<span className="cb-lbl">{label}</span>}
  </div>
);

/* ══════════════════════════════════════════════════════
   MAIN ACTIVE CALL
══════════════════════════════════════════════════════ */
const ActiveCall = ({ call, onEnd, currentUser }) => {
  const isVid  =call.type==="video"||call.type==="group-video";
  const isGroup=call.type==="group"||call.type==="group-video";

  const [stage,   setStage]  =useState(call.outgoing?"out":"in");
  const [endR,    setEndR]   =useState(null);
  const [callDur, setCallDur]=useState(0);
  const [secs,    setSecs]   =useState(0);
  const [muted,   setMuted]  =useState(false);
  const [camOff,  setCamOff] =useState(false);
  const [spkOn,   setSpkOn]  =useState(true);
  const [scr,     setScr]    =useState(false);
  const [qual,    setQual]   =useState(isVid?"vision":"crystal");
  const [showQ,   setShowQ]  =useState(false);
  const [netB,    setNetB]   =useState(4);
  const [localStr,setLS]     =useState(null);
  const [remStr,  setRS]     =useState(null);
  const [spkIds,  setSpkIds] =useState(new Set());
  const [exp,     setExp]    =useState(null);
  const [parts,   setParts]  =useState(call.participants||[]);
  const [mobile,  setMobile] =useState(window.innerWidth<769);
  const [bgIdx,   setBgIdx]  =useState(0);

  const lvRef=useRef(null);const rvRef=useRef(null);const raRef=useRef(null);
  const pcR=useRef(null);const sigR=useRef(null);const lsR=useRef(null);
  const asR=useRef(null);const vsR=useRef(null);
  const tiR=useRef(null);const nqR=useRef(null);const mR=useRef(true);
  const pIce=useRef([]);const secsR=useRef(0);

  const p=PRESETS.find(x=>x.id===qual)||PRESETS[1];

  useEffect(()=>{const r=()=>setMobile(window.innerWidth<769);window.addEventListener("resize",r,{passive:true});return()=>window.removeEventListener("resize",r);},[]);

  const destroyPC=useCallback(()=>{
    try{pcR.current?.close();}catch(_){}pcR.current=null;
    lsR.current?.getTracks().forEach(t=>{try{t.stop();}catch(_){}});lsR.current=null;
    asR.current=null;vsR.current=null;
    if(lvRef.current)lvRef.current.srcObject=null;
    if(rvRef.current)rvRef.current.srcObject=null;
    if(raRef.current)raRef.current.srcObject=null;
  },[]);

  const getMedia=useCallback(async()=>{
    const pr=PRESETS.find(x=>x.id===qual)||PRESETS[1];
    const c=isVid?pr.constraints:{audio:pr.constraints.audio,video:false};
    try{
      const s=await navigator.mediaDevices.getUserMedia(c);
      lsR.current=s;
      if(mR.current){setLS(s);if(lvRef.current&&isVid)lvRef.current.srcObject=s;}
      return s;
    }catch(e){console.warn("[Call] media:",e.message);return null;}
  },[isVid,qual]);

  const buildPC=useCallback(()=>{
    if(pcR.current){try{pcR.current.close();}catch(_){}}
    const pc=new RTCPeerConnection(RTC_CONFIG);pcR.current=pc;
    const rs=new MediaStream();
    pc.ontrack=evt=>{evt.streams[0]?.getTracks().forEach(t=>rs.addTrack(t));if(mR.current){setRS(rs);if(rvRef.current)rvRef.current.srcObject=rs;if(raRef.current)raRef.current.srcObject=rs;}};
    pc.onicecandidate=evt=>{if(!evt.candidate||!sigR.current)return;sigR.current.send({type:"broadcast",event:"ice_candidate",payload:{candidate:evt.candidate.toJSON()}});};
    pc.onconnectionstatechange=()=>{if(!mR.current)return;const s=pc.connectionState;if(s==="connected")setStage("live");if(s==="disconnected"){try{pc.restartIce();}catch(_){}}if(s==="failed"){setEndR("failed");setStage("ended");}};
    return pc;
  },[]);

  const addTracks=useCallback((pc,stream)=>{if(!stream||!pc||pc.signalingState==="closed")return;stream.getTracks().forEach(t=>{try{const s=pc.addTrack(t,stream);if(t.kind==="audio")asR.current=s;if(t.kind==="video")vsR.current=s;}catch(e){console.error("[Call] addTrack:",e);}});},[]);
  const flushIce=useCallback(async pc=>{for(const c of pIce.current){try{await pc.addIceCandidate(new RTCIceCandidate(c));}catch(_){}}pIce.current=[];},[]);

  const buildCh=useCallback((callId)=>{
    const ch=supabase.channel(`call:${callId}`,{config:{broadcast:{self:false}}})
      .on("broadcast",{event:"call_accepted"},async()=>{
        if(!mR.current)return;setStage("conn");
        const pc=pcR.current;if(!pc||pc.signalingState!=="stable")return;
        try{const o=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:isVid});await pc.setLocalDescription(o);ch.send({type:"broadcast",event:"offer",payload:{sdp:o}});}catch(e){console.error("[Call] offer:",e);}
      })
      .on("broadcast",{event:"call_declined"},()=>{if(!mR.current)return;setEndR("declined");setStage("ended");destroyPC();})
      .on("broadcast",{event:"offer"},async({payload})=>{
        if(!mR.current)return;const pc=pcR.current;if(!pc||pc.signalingState==="closed")return;
        try{await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));await flushIce(pc);const a=await pc.createAnswer();await pc.setLocalDescription(a);ch.send({type:"broadcast",event:"answer",payload:{sdp:a}});}catch(e){console.error("[Call] answer:",e);}
      })
      .on("broadcast",{event:"answer"},async({payload})=>{
        if(!mR.current)return;const pc=pcR.current;if(!pc||pc.signalingState!=="have-local-offer")return;
        try{await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));await flushIce(pc);}catch(e){console.error("[Call] setRemote:",e);}
      })
      .on("broadcast",{event:"ice_candidate"},async({payload})=>{if(!mR.current||!pcR.current)return;if(pcR.current.remoteDescription){try{await pcR.current.addIceCandidate(new RTCIceCandidate(payload.candidate));}catch(_){}}else{pIce.current.push(payload.candidate);}})
      .on("broadcast",{event:"call_ended"},()=>{if(!mR.current)return;secsR.current=secs;setCallDur(secsR.current);setEndR("ended");setStage("ended");destroyPC();})
      .on("broadcast",{event:"participant_state"},({payload})=>{if(!mR.current)return;setParts(prev=>prev.map(pt=>pt.id===payload.userId?{...pt,muted:payload.muted,camOff:payload.camOff}:pt));})
      .subscribe();
    sigR.current=ch;return ch;
  },[isVid,flushIce,destroyPC,secs]);

  useEffect(()=>{
    mR.current=true;
    const callId=call.callId||call.id||`call_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    (async()=>{
      if(call.outgoing){const s=await getMedia();const pc=buildPC();if(s)addTracks(pc,s);buildCh(callId);}
      else{buildCh(callId);await getMedia();}
    })();
    return()=>{mR.current=false;clearInterval(tiR.current);clearInterval(nqR.current);destroyPC();if(sigR.current){supabase.removeChannel(sigR.current);sigR.current=null;}};
  },[]); // eslint-disable-line

  useEffect(()=>{
    if(stage==="live"){
      tiR.current=setInterval(()=>{if(!mR.current)return;setSecs(s=>{secsR.current=s+1;return s+1;});},1000);
      nqR.current=setInterval(()=>{if(mR.current)setNetB(Math.floor(Math.random()*2)+3);},9000);
      return()=>{clearInterval(tiR.current);clearInterval(nqR.current);};
    }return undefined;
  },[stage]);

  useEffect(()=>{
    if(stage!=="live")return;
    const t=setInterval(()=>{if(!mR.current)return;const ids=new Set();if(Math.random()>.55)ids.add("local");parts.forEach(pt=>{if(Math.random()>.65)ids.add(pt.id);});setSpkIds(ids);},1100);
    return()=>clearInterval(t);
  },[stage,parts]);

  const handleAccept=useCallback(async()=>{
    if(!mR.current)return;setStage("conn");
    const s=lsR.current||await getMedia();const pc=buildPC();if(s)addTracks(pc,s);
    sigR.current?.send({type:"broadcast",event:"call_accepted",payload:{userId:currentUser?.id}});
  },[buildPC,addTracks,getMedia,currentUser?.id]);

  const handleDecline=useCallback(()=>{
    sigR.current?.send({type:"broadcast",event:"call_declined",payload:{userId:currentUser?.id}});
    destroyPC();if(sigR.current){supabase.removeChannel(sigR.current);sigR.current=null;}onEnd();
  },[onEnd,currentUser?.id,destroyPC]);

  const handleEnd=useCallback(()=>{
    sigR.current?.send({type:"broadcast",event:"call_ended",payload:{}});
    destroyPC();if(sigR.current){supabase.removeChannel(sigR.current);sigR.current=null;}
    setCallDur(secsR.current);setEndR("ended");setStage("ended");
  },[destroyPC]);

  const handleTimeout=useCallback(()=>{
    if(!mR.current)return;
    sigR.current?.send({type:"broadcast",event:"call_declined",payload:{reason:"timeout"}});
    destroyPC();if(sigR.current){supabase.removeChannel(sigR.current);sigR.current=null;}
    setEndR("timeout");setStage("ended");
  },[destroyPC]);

  const toggleMute=useCallback(()=>{const n=!muted;setMuted(n);lsR.current?.getAudioTracks().forEach(t=>{t.enabled=!n;});sigR.current?.send({type:"broadcast",event:"participant_state",payload:{userId:currentUser?.id,muted:n,camOff}});},[muted,camOff,currentUser?.id]);
  const toggleCam =useCallback(()=>{const n=!camOff;setCamOff(n);lsR.current?.getVideoTracks().forEach(t=>{t.enabled=!n;});sigR.current?.send({type:"broadcast",event:"participant_state",payload:{userId:currentUser?.id,muted,camOff:n}});},[camOff,muted,currentUser?.id]);
  const flipCam   =useCallback(async()=>{const cur=lsR.current?.getVideoTracks()[0];if(!cur||!vsR.current)return;const face=cur.getSettings()?.facingMode==="user"?"environment":"user";try{const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:face},audio:false});const nt=ns.getVideoTracks()[0];await vsR.current.replaceTrack(nt);cur.stop();const a=lsR.current?.getAudioTracks()||[];const m2=new MediaStream([nt,...a]);lsR.current=m2;setLS(m2);if(lvRef.current)lvRef.current.srcObject=m2;}catch(e){console.warn("[Call] flip:",e);}},[]);
  const toggleScr =useCallback(async()=>{if(scr){const vt=lsR.current?.getVideoTracks()[0];if(vsR.current&&vt)await vsR.current.replaceTrack(vt).catch(()=>{});setScr(false);}else{try{const ss=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const st=ss.getVideoTracks()[0];if(vsR.current)await vsR.current.replaceTrack(st);st.onended=()=>setScr(false);setScr(true);}catch(e){console.warn("[Call] screen:",e);}}},[scr]);

  const localUser={...currentUser,full_name:currentUser?.fullName||currentUser?.full_name,avatar_id:currentUser?.avatarId||currentUser?.avatar_id};
  const allParts=[
    {...localUser,isLocal:true,stream:localStr,muted,camOff},
    ...parts.map(pt=>({...pt,isLocal:false,stream:remStr})),
  ];

  /* Ended screen */
  if(stage==="ended"&&endR){
    return <EndScreen reason={endR} call={{...call,duration:callDur}} onClose={onEnd} onCallback={()=>onEnd()}/>;
  }

  return(
    <div className="ac-root" style={{background:BACKGROUNDS[bgIdx]}}>
      <div className="ac-particles" aria-hidden="true">{[0,1,2,3,4,5].map(i=><div key={i} className={`ac-p ac-p${i}`}/>)}</div>

      {/* Top bar */}
      <div className="ac-top">
        <div className="ac-top-l">
          {isGroup?<div className="ac-grav"><Ic.Users/></div>:<Av user={call.user} size={44} speak={spkIds.has("remote")}/>}
          <div>
            <div className="ac-name">{call.name}</div>
            <div className="ac-status">
              {stage==="out" &&<span className="ac-pulse">Calling…</span>}
              {stage==="in"  &&<span className="ac-pulse">Incoming {isVid?"video":"voice"} call</span>}
              {stage==="conn"&&<span className="ac-pulse">Connecting…</span>}
              {stage==="live"&&<span className="ac-lrow"><Ic.Shield/><span style={{color:"#22c55e",fontSize:10}}>E2E</span><span style={{opacity:.4}}>·</span>{isVid?"📹":"🎙️"} {fmt(secs)}</span>}
            </div>
          </div>
        </div>
        {stage==="live"&&(
          <div className="ac-top-r">
            <DataMeter presetId={qual} secs={secs}/>
            <div className="ac-netbars">{[1,2,3,4,5].map(b=><div key={b} className="ac-netbar" style={{height:`${b*17}%`,background:b<=netB?p.color:"rgba(255,255,255,.15)"}}/>)}</div>
            <button className="ac-tbtn" onClick={()=>setBgIdx(i=>(i+1)%BACKGROUNDS.length)}>🎨</button>
            <button className="ac-tbtn" onClick={()=>setShowQ(true)}>{p.icon}</button>
          </div>
        )}
      </div>

      {/* Main visual */}
      <div className="ac-main">
        {isGroup&&stage==="live"&&<GGrid all={allParts} spkIds={spkIds} onExp={pt=>setExp(pt)}/>}
        {!isGroup&&isVid&&stage==="live"&&(
          <div className="ac-vid-wrap">
            <div className="ac-rwrap"><video ref={rvRef} autoPlay playsInline className="ac-rvid"/><span className="ac-rbadge">{call.name}</span></div>
            <div className={`ac-pip${mobile?" ac-pip-sm":""}`}>
              {!camOff&&localStr?<video ref={lvRef} autoPlay playsInline muted className="ac-pip-vid"/>:<div className="ac-pip-off"><Av user={localUser} size={38}/></div>}
              <button className="ac-pip-flip" onClick={flipCam}><Ic.Flip/></button>
              <button className="ac-pip-exp" onClick={()=>setExp({...localUser,isLocal:true,stream:localStr,camOff})}><Ic.Expand/></button>
            </div>
            <audio ref={raRef} autoPlay style={{display:"none"}}/>
          </div>
        )}
        {((!isGroup&&!isVid)||(isGroup&&stage!=="live")||(!isGroup&&isVid&&stage!=="live"))&&(
          <div className="ac-awrap">
            <div className="ac-rings">{[0,1,2].map(i=><div key={i} className="ac-ring" style={{animationDelay:`${i*.88}s`,borderColor:stage==="live"?`${p.color}28`:"rgba(132,204,22,.15)"}}/>)}</div>
            {isGroup?<div className="ac-gbig"><Ic.Users/></div>:<div className="ac-bigav" style={{boxShadow:stage==="live"?`0 0 60px ${p.color}22`:"none"}}><Av user={call.user} size={mobile?110:132} speak={spkIds.has("remote")}/></div>}
            {stage==="out"&&call.outgoing&&<RingTimer max={RING_MAX} onTimeout={handleTimeout}/>}
            {stage==="live"&&!isGroup&&<><div className="ac-apill" style={{borderColor:`${p.color}44`}}>{p.icon}<span style={{color:p.color}}>{p.label}</span><span style={{fontSize:10,opacity:.6}}>{p.est}</span></div><AViz active={spkIds.has("remote")} color={p.color}/></>}
            {stage==="in"  &&<p className="ac-rlbl">is calling you…</p>}
            {stage==="conn"&&<p className="ac-rlbl" style={{color:"#84cc16"}}>Connecting…</p>}
            <audio ref={raRef} autoPlay style={{display:"none"}}/>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="ac-ctrls">
        {stage==="in"&&<div className="ac-rrow"><Btn onClick={handleDecline} label="Decline" red lg><Ic.End/></Btn><Btn onClick={handleAccept} label="Accept" green lg>{isVid?<Ic.Video/>:<Ic.Phone/>}</Btn></div>}
        {(stage==="out"||stage==="conn")&&<div className="ac-rrow"><Btn onClick={handleEnd} label={stage==="out"?"Cancel":"End"} red lg><Ic.End/></Btn></div>}
        {stage==="live"&&<div className="ac-lrow2">
          <Btn onClick={toggleMute} label={muted?"Unmute":"Mute"} tog={muted}>{muted?<Ic.MicOff/>:<Ic.MicOn/>}</Btn>
          {isVid&&<Btn onClick={toggleCam} label={camOff?"Camera":"Stop cam"} tog={camOff}>{camOff?<Ic.CamOff/>:<Ic.CamOn/>}</Btn>}
          <Btn onClick={()=>setSpkOn(s=>!s)} label={spkOn?"Speaker":"Earpiece"} tog={!spkOn}>{spkOn?<Ic.SpkOn/>:<Ic.SpkOff/>}</Btn>
          {isVid&&<Btn onClick={toggleScr} label={scr?"Stop":"Share"} tog={scr}><Ic.Screen/></Btn>}
          <Btn onClick={()=>setShowQ(v=>!v)} label="Quality"><span style={{fontSize:18}}>{p.icon}</span></Btn>
          <Btn onClick={handleEnd} label="End" red><Ic.End/></Btn>
        </div>}
      </div>

      {showQ&&<QSheet cur={qual} onChange={setQual} onClose={()=>setShowQ(false)} isVid={isVid}/>}
      {exp&&<ExpModal p={exp} onClose={()=>setExp(null)} mobile={mobile}/>}
      <style>{CSS}</style>
    </div>
  );
};

const CSS=`
.ac-root{position:absolute;inset:0;z-index:100;display:flex;flex-direction:column;overflow:hidden;font-family:inherit;}
.ac-particles{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.ac-p{position:absolute;border-radius:50%;opacity:.07;animation:acDrift 11s ease-in-out infinite;}
.ac-p0{width:220px;height:220px;background:#84cc16;top:-70px;left:-70px;animation-duration:12s;}
.ac-p1{width:160px;height:160px;background:#22c55e;top:22%;right:-45px;animation-duration:14s;animation-delay:2s;}
.ac-p2{width:240px;height:240px;background:#60a5fa;bottom:-90px;left:12%;animation-duration:16s;animation-delay:1s;}
.ac-p3{width:110px;height:110px;background:#c084fc;top:52%;right:14%;animation-duration:10s;animation-delay:3s;}
.ac-p4{width:170px;height:170px;background:#f59e0b;top:7%;left:33%;animation-duration:13s;animation-delay:4.5s;}
.ac-p5{width:95px;height:95px;background:#ef4444;bottom:15%;right:3%;animation-duration:15s;animation-delay:.8s;}
@keyframes acDrift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(24px,-20px) scale(1.07)}66%{transform:translate(-14px,14px) scale(0.93)}}
.ac-top{position:relative;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(env(safe-area-inset-top,0px)+16px) 16px 14px;background:linear-gradient(to bottom,rgba(0,0,0,.82),transparent);}
.ac-top-l{display:flex;align-items:center;gap:12px;flex:1;min-width:0;}
.ac-top-r{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.ac-grav{width:46px;height:46px;border-radius:50%;background:rgba(132,204,22,.12);border:2px solid rgba(132,204,22,.3);display:flex;align-items:center;justify-content:center;color:#84cc16;flex-shrink:0;}
.ac-name{font-size:17px;font-weight:800;color:#fff;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ac-status{font-size:12px;color:rgba(255,255,255,.55);margin-top:2px;}
.ac-lrow{display:flex;align-items:center;gap:5px;}
.ac-pulse{animation:acPulse 1.5s ease-in-out infinite;display:inline-block;}
@keyframes acPulse{0%,100%{opacity:1}50%{opacity:.3}}
.ac-tbtn{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);cursor:pointer;font-size:17px;}
.ac-netbars{display:flex;align-items:flex-end;gap:2px;height:18px;padding:0 5px;background:rgba(0,0,0,.4);border-radius:7px;border:1px solid rgba(255,255,255,.08);}
.ac-netbar{width:3px;border-radius:1.5px;transition:background .4s;}
.dm-meter{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:5px 10px;}
.dm-bars{display:flex;align-items:flex-end;gap:2px;height:16px;}
.dm-bar{width:3px;border-radius:1px;}
.dm-nums{display:flex;flex-direction:column;}
.dm-used{font-size:10px;font-weight:700;color:#fff;}
.dm-rate{font-size:8px;color:rgba(255,255,255,.4);}
/* Avatar */
.ncav{border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d0d0d,#1c1c1c);border:2.5px solid rgba(132,204,22,.25);overflow:hidden;transition:border-color .3s,box-shadow .3s;}
.ncav.ncav-speak{border-color:#84cc16;box-shadow:0 0 0 4px rgba(132,204,22,.2);}
.ncav span{font-weight:800;color:#84cc16;}
/* Main */
.ac-main{flex:1;position:relative;z-index:1;display:flex;overflow:hidden;}
/* Ring timer */
.rtimer{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:1;}
.rtimer-n{position:absolute;font-size:14px;font-weight:800;top:50%;left:50%;transform:translate(-50%,-50%);}
/* Audio area */
.ac-awrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px;position:relative;}
.ac-rings{position:absolute;display:flex;align-items:center;justify-content:center;pointer-events:none;inset:0;}
.ac-ring{position:absolute;border-radius:50%;border:1.5px solid rgba(132,204,22,.18);animation:acRing 2.8s ease-out infinite;}
.ac-ring:nth-child(1){width:180px;height:180px;}.ac-ring:nth-child(2){width:270px;height:270px;}.ac-ring:nth-child(3){width:360px;height:360px;}
@keyframes acRing{0%{transform:scale(.75);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.ac-bigav{position:relative;z-index:1;transition:box-shadow .5s;}
.ac-gbig{width:100px;height:100px;border-radius:50%;background:rgba(132,204,22,.1);border:2px solid rgba(132,204,22,.3);display:flex;align-items:center;justify-content:center;color:#84cc16;z-index:1;position:relative;}
.ac-apill{display:flex;align-items:center;gap:7px;padding:7px 16px;border-radius:24px;border:1px solid;background:rgba(0,0,0,.45);font-size:12px;color:#ccc;z-index:1;}
.ac-rlbl{font-size:15px;color:rgba(255,255,255,.5);z-index:1;margin:0;}
/* Audio viz */
.aviz{display:flex;align-items:center;gap:2.5px;height:36px;z-index:1;}
.aviz-b{width:3px;border-radius:2px;height:3px;}
.aviz-b.aviz-on{animation:avizP .8s ease-in-out infinite alternate;}
@keyframes avizP{from{height:3px;opacity:.3}to{height:32px;opacity:1}}
/* Video */
.ac-vid-wrap{flex:1;position:relative;display:flex;overflow:hidden;}
.ac-rwrap{position:absolute;inset:0;background:#050505;display:flex;align-items:center;justify-content:center;}
.ac-rvid{width:100%;height:100%;object-fit:cover;}
.ac-rbadge{position:absolute;top:14px;left:14px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:5px 12px;font-size:13px;font-weight:700;color:#fff;}
.ac-pip{position:absolute;bottom:88px;right:14px;width:108px;height:154px;border-radius:16px;overflow:hidden;border:2.5px solid rgba(132,204,22,.4);background:#111;box-shadow:0 8px 40px rgba(0,0,0,.9);}
.ac-pip-sm{width:86px;height:124px;bottom:78px;right:10px;}
.ac-pip-vid{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);}
.ac-pip-off{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d0d0d,#1a1a1a);}
.ac-pip-flip,.ac-pip-exp{position:absolute;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;}
.ac-pip-flip{bottom:7px;right:7px;}.ac-pip-exp{top:7px;left:7px;}
/* Group grid — beautiful layouts */
.ggrid{flex:1;display:grid;gap:6px;padding:10px;width:100%;height:100%;}
.gg1{grid-template-columns:1fr;grid-template-rows:1fr;}
.gg2{grid-template-columns:1fr 1fr;grid-template-rows:1fr;}
.gg3{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;}
.gg3 .ptile:nth-child(3){grid-column:1/-1;max-width:50%;justify-self:center;min-height:140px;}
.gg4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;}
.gg6{grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;}
.ggn{grid-template-columns:repeat(3,1fr);overflow-y:auto;}
/* Participant tile — glassmorphism */
.ptile{
  position:relative;border-radius:18px;overflow:hidden;
  background:linear-gradient(145deg,rgba(18,18,18,.9),rgba(10,10,10,.95));
  border:1.5px solid rgba(255,255,255,.07);
  cursor:pointer;
  transition:border-color .25s,box-shadow .25s,transform .15s;
  min-height:90px;display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 24px rgba(0,0,0,.5);
}
.ptile::before{
  content:'';position:absolute;inset:0;border-radius:18px;
  background:linear-gradient(145deg,rgba(255,255,255,.04),transparent);
  pointer-events:none;z-index:0;
}
.ptile:hover{border-color:rgba(132,204,22,.35);transform:scale(1.012);}
.ptile.ptile-speak{
  border-color:#84cc16;
  box-shadow:0 0 0 2px rgba(132,204,22,.25),0 8px 40px rgba(132,204,22,.15),0 4px 24px rgba(0,0,0,.5);
}
.ptile-ring{
  position:absolute;inset:-2px;border-radius:20px;
  border:2px solid #84cc16;
  animation:ptRing 1.2s ease-in-out infinite;
  pointer-events:none;z-index:5;
}
@keyframes ptRing{0%,100%{opacity:.85;transform:scale(1)}50%{opacity:.25;transform:scale(1.018)}}
.ptile-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.ptile-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:1;}
.ptile-avimg{
  width:64px;height:64px;border-radius:50%;object-fit:cover;
  border:2.5px solid rgba(132,204,22,.3);
  box-shadow:0 4px 16px rgba(0,0,0,.5);
}
.ptile-avinit{font-size:clamp(24px,5vw,52px);font-weight:900;color:#84cc16;text-shadow:0 0 20px rgba(132,204,22,.4);}
/* Speaking wave bars */
.ptile-wave{display:flex;align-items:flex-end;gap:3px;height:28px;}
.ptile-wave span{width:4px;background:#84cc16;border-radius:3px;animation:ptWave .75s ease-in-out infinite alternate;}
.ptile-wave span:nth-child(1){height:8px;animation-delay:0s;}
.ptile-wave span:nth-child(2){height:18px;animation-delay:.08s;}
.ptile-wave span:nth-child(3){height:28px;animation-delay:.16s;}
.ptile-wave span:nth-child(4){height:18px;animation-delay:.08s;}
.ptile-wave span:nth-child(5){height:8px;animation-delay:0s;}
@keyframes ptWave{from{opacity:.25;transform:scaleY(.4)}to{opacity:1;transform:scaleY(1)}}
/* Footer overlay */
.ptile-foot{
  position:absolute;bottom:0;left:0;right:0;
  padding:24px 10px 8px;
  background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.4) 60%,transparent 100%);
  display:flex;align-items:center;justify-content:space-between;z-index:2;
}
.ptile-name{font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 4px rgba(0,0,0,.8);}
.ptile-icons{display:flex;gap:3px;font-size:11px;align-items:center;}
.ptile-dot{width:8px;height:8px;border-radius:50%;background:#84cc16;box-shadow:0 0 6px rgba(132,204,22,.8);animation:acPulse 1s infinite;}
/* Speaking aura glow behind avatar */
.ptile.ptile-speak .ptile-avimg { box-shadow:0 0 0 4px rgba(132,204,22,.3),0 0 20px rgba(132,204,22,.25); }
/* Expand button */
.ptile-exp{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:9px;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;opacity:0;transition:opacity .2s;z-index:3;backdrop-filter:blur(6px);}
.ptile:hover .ptile-exp{opacity:1;}
/* You badge */
.ptile-you{position:absolute;top:8px;left:8px;padding:2px 7px;border-radius:6px;background:rgba(132,204,22,.15);border:1px solid rgba(132,204,22,.3);font-size:9px;font-weight:800;color:#84cc16;letter-spacing:.5px;z-index:3;}
/* Expanded modal */
.exm-ov{position:absolute;inset:0;background:rgba(0,0,0,.88);z-index:50;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);}
.exm-modal{background:#0d0d0d;border:1px solid rgba(132,204,22,.2);border-radius:24px;overflow:hidden;width:88%;max-width:520px;max-height:82vh;}
.exm-mobile{width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;position:fixed;inset:0;}
.exm-close{position:absolute;top:14px;right:14px;z-index:10;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;}
.exm-vid{width:100%;min-height:280px;flex:1;object-fit:cover;}
.exm-avbg{min-height:280px;flex:1;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d0d0d,#1c1c1c);}
.exm-avimg{width:120px;height:120px;object-fit:cover;border-radius:50%;border:3px solid rgba(132,204,22,.3);}
.exm-avinit{font-size:72px;font-weight:900;color:#84cc16;}
.exm-info{padding:16px 20px;background:rgba(0,0,0,.94);border-top:1px solid rgba(255,255,255,.07);}
.exm-name{font-size:18px;font-weight:800;color:#fff;display:block;margin-bottom:8px;}
.exm-chips{display:flex;gap:8px;flex-wrap:wrap;}
.exm-chip{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.exm-muted{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;}
.exm-cam{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);color:#f59e0b;}
.exm-live{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#22c55e;}
/* Controls */
.ac-ctrls{position:relative;z-index:10;padding:16px 16px calc(env(safe-area-inset-bottom,0px)+28px);background:linear-gradient(to top,rgba(0,0,0,.9),transparent);display:flex;align-items:center;justify-content:center;}
.ac-rrow{display:flex;align-items:center;gap:52px;}
.ac-lrow2{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;}
.cbg{display:flex;flex-direction:column;align-items:center;gap:7px;}
.cb{width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.16);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.cb:active{transform:scale(.9);}
.cb.cb-tog{background:rgba(239,68,68,.2)!important;border-color:rgba(239,68,68,.45)!important;}
.cb.cb-lg{width:68px;height:68px;}
.cb.cb-red{background:rgba(239,68,68,.18)!important;border-color:rgba(239,68,68,.5)!important;color:#ef4444;}
.cb.cb-grn{background:rgba(34,197,94,.18)!important;border-color:rgba(34,197,94,.5)!important;color:#22c55e;animation:cbGlow 1.5s ease-in-out infinite;}
@keyframes cbGlow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}50%{box-shadow:0 0 0 16px rgba(34,197,94,0)}}
.cb-lbl{font-size:10px;font-weight:600;color:rgba(255,255,255,.42);text-transform:uppercase;letter-spacing:.4px;}
/* Quality sheet */
.qs-ov{position:absolute;inset:0;background:rgba(0,0,0,.72);z-index:60;display:flex;align-items:flex-end;backdrop-filter:blur(4px);}
.qs-sh{background:#090909;border:1px solid rgba(132,204,22,.15);border-radius:22px 22px 0 0;padding:0 0 calc(env(safe-area-inset-bottom,0px)+16px);width:100%;}
.qs-pill{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:12px auto 0;}
.qs-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 6px;font-size:15px;font-weight:800;color:#fff;}
.qs-x{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;color:#555;cursor:pointer;}
.qs-sub{font-size:12px;color:#444;padding:0 20px 10px;line-height:1.5;}
.qs-row{display:flex;align-items:center;gap:12px;padding:13px 20px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;text-align:left;width:100%;transition:background .15s;}
.qs-row:hover{background:rgba(255,255,255,.05);}.qs-row.qs-on{background:rgba(132,204,22,.05);}.qs-row.qs-dis{opacity:.35;cursor:not-allowed;}
.qs-ico{font-size:22px;flex-shrink:0;}.qs-inf{flex:1;}.qs-lbl{display:block;font-size:14px;font-weight:700;}.qs-est{display:block;font-size:10px;font-weight:700;margin-top:2px;}.qs-lk{font-size:10px;color:#333;flex-shrink:0;}
/* End screen */
.es-root{position:absolute;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px 24px;overflow:hidden;font-family:inherit;}
.es-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
.es-p{position:absolute;border-radius:50%;opacity:.08;animation:acDrift 12s ease-in-out infinite;}
.es-p0{width:200px;height:200px;top:-60px;left:-40px;}.es-p1{width:150px;height:150px;bottom:-40px;right:-30px;animation-delay:3s;}.es-p2{width:100px;height:100px;top:40%;left:60%;animation-delay:6s;}
.es-ring{position:absolute;inset:-14px;border-radius:50%;border:2px solid;opacity:.3;animation:esRing 2s ease-out infinite;}
.es-ring2{inset:-26px;animation-delay:.5s;opacity:.15;}
@keyframes esRing{0%{transform:scale(.85);opacity:.4}100%{transform:scale(1.3);opacity:0}}
.es-emoji{font-size:40px;z-index:1;animation:esEm .5s cubic-bezier(.34,1.56,.64,1);}
@keyframes esEm{from{transform:scale(0)}to{transform:scale(1)}}
.es-title{font-size:26px;font-weight:900;letter-spacing:-.5px;z-index:1;text-align:center;}
.es-sub{font-size:15px;color:rgba(255,255,255,.6);z-index:1;text-align:center;font-weight:500;margin:0;}
.es-dur{font-size:13px;font-weight:700;z-index:1;}
.es-actions{display:flex;flex-direction:column;gap:10px;width:100%;max-width:280px;z-index:1;margin-top:8px;}
.es-btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 24px;border-radius:16px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;border:1px solid;width:100%;}
.es-btn:active{transform:scale(.97);}
.es-btn-msg{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.3);color:#60a5fa;}
.es-btn-close{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.5);}
@media(max-width:768px){.ac-lrow2{gap:10px;}.cb{width:52px;height:52px;}.cb.cb-lg{width:62px;height:62px;}.ac-rrow{gap:40px;}}
`;

export default ActiveCall;