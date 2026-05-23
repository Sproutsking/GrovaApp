// ============================================================================
// src/components/Messages/UpdatesView.jsx — v16 PRODUCTION
// ============================================================================
//
// FIXES vs v15:
//   [FIX-1]  openGallery null crash — AddStatusModal called useSoundGallery()
//            which returned null because it was rendered outside
//            SoundGalleryProvider. Fix: AddStatusModal is now wrapped in its
//            own SoundGalleryProvider internally so it is always valid.
//            The provider is lightweight and idempotent; nesting is safe.
//
//   [FIX-2]  "Could not find the 'music' column" — statusUpdateService.create()
//            now probes the schema once and omits missing columns gracefully.
//            The fallback direct-insert in handleShare also strips music/
//            media_type when the columns aren't in the schema cache yet.
//
//   [FIX-3]  handleShare fallback insert no longer blindly includes music —
//            it checks whether the music column probe has resolved.
//
// All prior VID-* and SND-* fixes from v15 are fully preserved.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { supabase } from "../../services/config/supabase";
import statusUpdateService, { isVideoStatus } from "../../services/messages/statusUpdateService";
import mediaUrlService from "../../services/shared/mediaUrlService";
import dmMessageService from "../../services/messages/dmMessageService";
import { SoundGalleryProvider, useSoundGallery } from "../Shared/SoundGallery";

// ── Badge registration ────────────────────────────────────────────────────────
let _badgeSetter = null;
export const registerUpdatesBadgeSetter = (fn) => { _badgeSetter = fn; };

// ── Constants ─────────────────────────────────────────────────────────────────
const TIER_LIMITS   = { free: 5, silver: 10, gold: 18, diamond: 30 };
const STORY_MS      = 5500;
const CHAR_MAX      = 280;

const GRADIENTS = [
  "linear-gradient(145deg,#0d1a00,#1a3300)",
  "linear-gradient(145deg,#0f2027,#203a43,#2c5364)",
  "linear-gradient(145deg,#1a1a2e,#16213e,#0f3460)",
  "linear-gradient(145deg,#200122,#6f0000)",
  "linear-gradient(145deg,#0f0c29,#302b63,#24243e)",
  "linear-gradient(145deg,#000428,#004e92)",
  "linear-gradient(145deg,#0d1b2a,#1b4332)",
  "linear-gradient(145deg,#13000a,#3d0026)",
  "linear-gradient(145deg,#0a0a0a,#1a1a1a)",
  "linear-gradient(145deg,#1a0533,#3d1166)",
  "linear-gradient(145deg,#2d1b69,#11998e)",
  "linear-gradient(145deg,#141e30,#243b55)",
];

const TEXT_COLORS = [
  "#ffffff","#84cc16","#f59e0b","#ef4444","#60a5fa",
  "#c084fc","#f472b6","#34d399","#fbbf24","#a78bfa","#fb923c","#22d3ee",
];

const DURATIONS = [
  { h: 6,  label: "6h",  sub: "Gone quickly"   },
  { h: 12, label: "12h", sub: "Half a day"      },
  { h: 18, label: "18h", sub: "Most of the day" },
  { h: 24, label: "24h", sub: "Full day"         },
];

// ── Pure helpers ──────────────────────────────────────────────────────────────
const fmtRel = (iso) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000)    return "just now";
  if (ms < 3600000)  return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.floor(ms / 86400000)}d`;
};
const fmtCountdown = (exp) => {
  const ms = new Date(exp).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const isNearExp  = (exp) => { const ms = new Date(exp).getTime() - Date.now(); return ms > 0 && ms < 3_600_000; };
const getSeenKey = (uid) => `uv_seen_${uid}`;
const cleanSoundName = (n = "") => n.replace(/\.(mp3|wav|ogg|m4a|aac|flac)$/i, "").replace(/[-_]/g, " ").trim();

// ── Video detection ───────────────────────────────────────────────────────────
const isVideoUrl = (url) => {
  if (!url) return false;
  if (url.includes("/video/upload/")) return true;
  if (/\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|ogv|3gp)(\?|$)/i.test(url)) return true;
  return false;
};
const isVideoStatusFull = (s) => {
  if (!s) return false;
  if (s.media_type === "video") return true;
  if (isVideoStatus(s)) return true;
  if (s.image_id) return isVideoUrl(getMediaUrl(s.image_id) || "");
  return false;
};

// ── [VID-5] Media URL ─────────────────────────────────────────────────────────
const getMediaUrl = (imageId) => {
  if (!imageId) return null;
  try {
    if (typeof imageId === "string" && imageId.startsWith("http")) {
      if (imageId.includes("cloudinary.com") && imageId.includes("/video/upload/")) {
        if (imageId.includes("q_auto") || imageId.includes("f_mp4") || imageId.includes("vc_auto")) return imageId;
        return imageId.replace("/video/upload/", "/video/upload/q_auto,f_mp4/");
      }
      return imageId;
    }
    const svcUrl = statusUpdateService.getMediaUrl?.(imageId);
    if (svcUrl?.startsWith("http")) return svcUrl;
    const cUrl = mediaUrlService.getImageUrl?.(imageId);
    if (cUrl?.startsWith("http")) return cUrl;
    return null;
  } catch { return null; }
};

const buildVideoCascade = (url) => {
  if (!url) return [];
  const urls = [url];
  if (url.includes("cloudinary.com")) {
    const bare = url.replace(/\/video\/upload\/[^/]+\//g, "/video/upload/");
    if (bare !== url) urls.push(bare);
    const webm = bare.replace("/video/upload/", "/video/upload/f_webm/");
    if (!urls.includes(webm)) urls.push(webm);
  }
  return [...new Set(urls)];
};

// ══════════════════════════════════════════════════════════════════════════════
// Icons
// ══════════════════════════════════════════════════════════════════════════════
const Ic = {
  Heart:    ({ f }) => <svg width="18" height="18" viewBox="0 0 24 24" fill={f?"#ef4444":"none"} stroke={f?"#ef4444":"currentColor"} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Reply:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>,
  Repost:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
  Eye:      () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Send:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Close:    () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Plus:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Pause:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Clock:    () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Trash:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Check:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Verified: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="#60a5fa"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Camera:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Video:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Type:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  SoundOn:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
  SoundOff: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
  ChevL:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevR:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Lock:     () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Music:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
};

// ── Waveform bars ─────────────────────────────────────────────────────────────
const WaveBars = memo(({ playing, color = "#84cc16", size = "md" }) => {
  const bars = [4,9,13,7,11,5,10,12,6,9,4,8,11,5,10];
  const maxH = size === "sm" ? 14 : 20;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2, height:maxH }}>
      {bars.map((h,i) => (
        <div key={i} style={{
          width: 2.5,
          height: playing ? Math.max(3,(h/14)*maxH) : 2.5,
          background: color, borderRadius: 2,
          animation: playing ? `uvWave .55s ${(i*.06).toFixed(2)}s ease-in-out infinite alternate` : "none",
          transition: "height .2s ease",
        }} />
      ))}
    </div>
  );
});
WaveBars.displayName = "WaveBars";

// ── Heart burst ───────────────────────────────────────────────────────────────
const HeartBurst = memo(({ x, y, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 900); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:"fixed", left:x, top:y, pointerEvents:"none", zIndex:999999, transform:"translate(-50%,-50%)" }}>
      {Array.from({length:8}).map((_,i) => {
        const rad = (i/8)*360*Math.PI/180, dist = 38+Math.random()*28;
        return <div key={i} style={{ position:"absolute", fontSize:13+Math.random()*6, animation:`uvHburst .9s ${Math.random()*150}ms cubic-bezier(.22,1,.36,1) forwards`, "--dx":`${Math.cos(rad)*dist}px`, "--dy":`${Math.sin(rad)*dist}px` }}>❤️</div>;
      })}
    </div>
  );
});
HeartBurst.displayName = "HeartBurst";

// ── Avatar ────────────────────────────────────────────────────────────────────
const UAv = memo(({ user, size = 50, ring = false, nearExp = false }) => {
  const [err, setErr] = useState(false);
  const avId  = user?.avatar_id || user?.avatarId;
  const url   = !err && avId ? (mediaUrlService.getAvatarUrl?.(avId, 200) || null) : null;
  const safe  = url?.startsWith("http") ? url : null;
  const ini   = (user?.full_name || user?.username || "?").charAt(0).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0d0d0d,#1c1c1c)", border:ring?`2.5px solid ${nearExp?"#f59e0b":"#84cc16"}`:"2px solid rgba(132,204,22,.18)", flexShrink:0, fontSize:size*.4, fontWeight:800, color:"#84cc16", boxSizing:"border-box" }}>
      {safe ? <img src={safe} alt={ini} onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span>{ini}</span>}
    </div>
  );
});
UAv.displayName = "UAv";

// ── Status thumbnail ──────────────────────────────────────────────────────────
const StatusThumb = memo(({ statuses:sts, profile, isMe=false, onClick, hasNew=false }) => {
  const [err, setErr] = useState(false);
  const count = sts.length;
  const first = sts[0];
  const mu    = getMediaUrl(first?.image_id);
  const isVid = isVideoStatusFull(first);
  const SIZE=64, R=29, STROKE=3;
  const GAP     = count>1 ? (count===2?8:count<=4?6:5) : 0;
  const segDeg  = count>0 ? (360-GAP*count)/count : 360;
  const circum  = 2*Math.PI*R;
  const segLen  = (segDeg/360)*circum;
  const nearE   = count>0 && first && isNearExp(first.expires_at);
  const ringCol = isMe?"#60a5fa":nearE?"#f59e0b":"#84cc16";

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0,position:"relative"}} onClick={onClick}>
      {hasNew && <div style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:"#ef4444",border:"2px solid #000",zIndex:5,animation:"uvNewDot 1.5s ease-in-out infinite"}}/>}
      <div style={{position:"relative",width:SIZE,height:SIZE}}>
        <svg width={SIZE} height={SIZE} style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}}>
          {count>0 ? Array.from({length:count}).map((_,i)=>{
            const off = (i*(segDeg+GAP)/360)*circum;
            return <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={ringCol} strokeWidth={STROKE} strokeDasharray={`${segLen} ${circum-segLen}`} strokeDashoffset={-off} strokeLinecap="round" opacity={.95}/>;
          }) : <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(132,204,22,.25)" strokeWidth={STROKE} strokeDasharray="4 4"/>}
        </svg>
        <div style={{position:"absolute",inset:STROKE+3,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#0d0d0d,#1c1c1c)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {mu && !isVid && !err ? <img src={mu} alt="" onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/> :
           mu && isVid         ? <div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:18}}>▶</span></div> :
           first?.bg           ? <div style={{width:"100%",height:"100%",background:first.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,color:first.text_color||"#84cc16",textAlign:"center",padding:"2px 4px",wordBreak:"break-word"}}>{first.text?.slice(0,14)}</span></div> :
                                  <UAv user={profile} size={SIZE-(STROKE+3)*2}/>}
          {isMe && count===0 && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#84cc16"}}><Ic.Plus/></div>}
        </div>
        {count>1 && <div style={{position:"absolute",bottom:0,right:0,width:17,height:17,borderRadius:"50%",background:ringCol,border:"1.5px solid #000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#000",zIndex:2}}>{count}</div>}
      </div>
      <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.5)",maxWidth:64,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {isMe ? "My status" : (profile?.full_name||"?").split(" ")[0]}
      </span>
    </div>
  );
});
StatusThumb.displayName = "StatusThumb";

// ══════════════════════════════════════════════════════════════════════════════
// VideoPlayer
// ══════════════════════════════════════════════════════════════════════════════
const VideoPlayer = memo(({ src, fullH=false, muted=true, paused=false, onProgress, onEnded }) => {
  const videoRef   = useRef(null);
  const cascadeRef = useRef([]);
  const [urlIdx,  setUrlIdx]  = useState(0);
  const [failed,  setFailed]  = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cascadeRef.current = buildVideoCascade(src);
    setUrlIdx(0); setFailed(false); setLoading(true);
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    muted ? v.setAttribute("muted","") : v.removeAttribute("muted");
  }, [muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) { v.pause(); return; }
    if (v.readyState >= 3) {
      v.muted = true;
      v.play().catch(() => {});
    }
  }, [paused, urlIdx]);

  const handleLoaded = useCallback(() => {
    setLoading(false);
    if (!paused && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [paused]);

  const handleError = useCallback(() => {
    const next = urlIdx + 1;
    if (next < cascadeRef.current.length) { setUrlIdx(next); }
    else { setFailed(true); setLoading(false); }
  }, [urlIdx]);

  const handleTimeUpdate = useCallback((e) => {
    const v = e.currentTarget;
    if (!v.duration || isNaN(v.duration) || v.duration <= 0) return;
    const pct = (v.currentTime / v.duration) * 100;
    onProgress?.(Math.min(pct, 100));
    if (pct >= 99) onEnded?.();
  }, [onProgress, onEnded]);

  if (failed) {
    return (
      <div style={{width:"100%",height:fullH?"100%":300,background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
        <div style={{fontSize:36}}>📹</div>
        <a href={src} target="_blank" rel="noopener noreferrer"
          style={{color:"#84cc16",fontSize:13,fontWeight:700,padding:"8px 16px",borderRadius:12,background:"rgba(132,204,22,.1)",border:"1px solid rgba(132,204,22,.3)",textDecoration:"none"}}>
          Open video ↗
        </a>
      </div>
    );
  }

  const activeUrl = cascadeRef.current[urlIdx] || src;

  return (
    <div style={{ position:"absolute", inset:0, background:"#000", transform:"translateZ(0)", willChange:"transform" }}>
      {loading && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,background:"rgba(0,0,0,.5)"}}>
          <div style={{width:36,height:36,border:"3px solid rgba(132,204,22,.3)",borderTopColor:"#84cc16",borderRadius:"50%",animation:"uvSpin .8s linear infinite"}}/>
        </div>
      )}
      <video
        ref={videoRef}
        key={`vp-${activeUrl}`}
        src={activeUrl}
        autoPlay playsInline loop muted preload="auto"
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:fullH?"cover":"contain", display:"block", background:"#000", transform:"translateZ(0)", willChange:"transform" }}
        onLoadedData={handleLoaded}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
        onPlay={() => setLoading(false)}
      />
    </div>
  );
});
VideoPlayer.displayName = "VideoPlayer";

// ── StoryMedia ────────────────────────────────────────────────────────────────
const StoryMedia = memo(({ story, mediaUrl, isVid, muted, paused, onProgress, onEnded, fullH=false }) => {
  if (isVid && mediaUrl) {
    return (
      <VideoPlayer src={mediaUrl} fullH={fullH} muted={muted} paused={paused} onProgress={onProgress} onEnded={onEnded}/>
    );
  }
  if (mediaUrl) {
    return (
      <img src={mediaUrl} alt="" style={{ width:"100%", height:fullH?"100%":"auto", objectFit:fullH?"cover":"contain", display:"block", maxHeight:fullH?"100%":480 }}/>
    );
  }
  return (
    <div style={{ width:"100%", height:fullH?"100%":300, minHeight:200, background:story.bg||"linear-gradient(145deg,#0d1117,#1a2332)", display:"flex", alignItems:"center", justifyContent:"center", padding:32, boxSizing:"border-box" }}>
      <p style={{ fontSize:story.text?.length>100?18:story.text?.length>50?22:28, fontWeight:800, color:story.text_color||"#fff", textAlign:"center", lineHeight:1.4, margin:0, wordBreak:"break-word", textShadow:"0 2px 16px rgba(0,0,0,.5)" }}>
        {story.text}
      </p>
    </div>
  );
});
StoryMedia.displayName = "StoryMedia";

// ══════════════════════════════════════════════════════════════════════════════
// StoryViewer
// ══════════════════════════════════════════════════════════════════════════════
const StoryViewer = memo(({ allGroups, startGroupIdx, startStoryIdx, userId, onClose, onDmReply, likedIds, onToggleLike, onRepost }) => {
  const [gIdx, setGIdx]       = useState(startGroupIdx);
  const [sIdx, setSIdx]       = useState(startStoryIdx);
  const [prog, setProg]       = useState(0);
  const [paused, setPaused]   = useState(false);
  const [muted, setMuted]     = useState(true);
  const [showRep, setShowRep] = useState(false);
  const [repTxt, setRepTxt]   = useState("");
  const [sending, setSending] = useState(false);
  const [repDone, setRepDone] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);
  const [burst, setBurst]     = useState(null);
  const [swipeX, setSwipeX]   = useState(0);
  const [touching, setTouching] = useState(false);
  const [repostDone, setRepostDone] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  const timerRef    = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", r, { passive:true });
    return () => window.removeEventListener("resize", r);
  }, []);

  const group    = allGroups[gIdx];
  const story    = group?.statuses?.[sIdx];
  const isMyStory = group?.isMe || story?.user_id === userId;
  const isVid    = isVideoStatusFull(story);
  const mediaUrl = getMediaUrl(story?.image_id);
  const isLiked  = likedIds.has(story?.id || "");
  const nearE    = story ? isNearExp(story.expires_at) : false;

  useEffect(() => {
    if (!story) return;
    setProg(0); setRepDone(false); setRepTxt(""); setShowRep(false); setRepostDone(false);
    if (!isMyStory) {
      try { statusUpdateService.recordView?.(story.id, userId, story.user_id); } catch {}
    }
  }, [gIdx, sIdx]); // eslint-disable-line

  useEffect(() => {
    if (paused || isVid || showRep) { clearInterval(timerRef.current); return; }
    const step = (50/STORY_MS)*100;
    timerRef.current = setInterval(() => {
      setProg((p) => {
        if (p >= 100) { clearInterval(timerRef.current); advance(); return 0; }
        return Math.min(p + step, 100);
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [gIdx, sIdx, paused, isVid, showRep]); // eslint-disable-line

  const advance = useCallback(() => {
    const g = allGroups[gIdx];
    if (!g) { onClose(); return; }
    if (sIdx < g.statuses.length - 1) { setSIdx((s) => s+1); setProg(0); }
    else if (gIdx < allGroups.length - 1) { setGIdx((g) => g+1); setSIdx(0); setProg(0); }
    else onClose();
  }, [gIdx, sIdx, allGroups, onClose]);

  const retreat = useCallback(() => {
    if (sIdx > 0) { setSIdx((s) => s-1); setProg(0); }
    else if (gIdx > 0) { setGIdx((g) => g-1); setSIdx(0); setProg(0); }
  }, [gIdx, sIdx]);

  const handleMediaTap = (e) => {
    const now = Date.now();
    if (now - lastTap < 280) {
      const r = e.currentTarget.getBoundingClientRect();
      setBurst({ x: e.clientX||r.left+r.width/2, y: e.clientY||r.top+r.height/2 });
      if (!isLiked) onToggleLike(story.id, false);
    }
    setLastTap(now);
  };

  const handleLike = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setBurst({ x: r.left+r.width/2, y: r.top+r.height/2 });
    onToggleLike(story.id, isLiked);
  };

  const handleReply = async () => {
    if (!repTxt.trim() || sending || !story?.user_id || story.user_id === userId) return;
    setSending(true);
    try {
      await onDmReply({ replyText:repTxt.trim(), status:story });
      setRepTxt(""); setShowRep(false); setRepDone(true);
      setTimeout(() => setRepDone(false), 3500);
    } catch {}
    finally { setSending(false); }
  };

  const handleRepost = async () => {
    if (!story || story.user_id === userId) return;
    try { await onRepost?.(story); setRepostDone(true); setTimeout(() => setRepostDone(false), 3000); } catch {}
  };

  const onTouchStart = (e) => { touchStartX.current=e.touches[0].clientX; touchStartY.current=e.touches[0].clientY; setTouching(true); setSwipeX(0); };
  const onTouchMove  = (e) => { if (!touching) return; const dx=e.touches[0].clientX-touchStartX.current; if (Math.abs(e.touches[0].clientY-touchStartY.current)>30) return; setSwipeX(dx); };
  const onTouchEnd   = () => { setTouching(false); if (swipeX<-60) advance(); else if (swipeX>60) retreat(); setSwipeX(0); };

  if (!story) return null;

  const ProgBars = ({ sts }) => (
    <div style={{display:"flex",gap:3,width:"100%"}}>
      {sts.map((_,i) => (
        <div key={i} style={{flex:1,height:2.5,background:"rgba(255,255,255,.22)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:"#fff",borderRadius:2,width:i<sIdx?"100%":i===sIdx?`${prog}%`:"0%",transition:"width .05s linear"}}/>
        </div>
      ))}
    </div>
  );

  const ActionsBar = ({ compact=false }) => (
    <div style={{display:"flex",alignItems:"center",gap:compact?6:10,flexWrap:"wrap"}}>
      {isMyStory && (
        <div style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:20,background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.14)"}}>
          <Ic.Eye/><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.7)"}}>{story.views||0}</span>
        </div>
      )}
      <button onClick={handleLike} style={{display:"flex",alignItems:"center",gap:5,padding:compact?"5px 10px":"8px 14px",borderRadius:24,background:isLiked?"rgba(239,68,68,.18)":"rgba(0,0,0,.5)",border:isLiked?"1px solid rgba(239,68,68,.45)":"1px solid rgba(255,255,255,.2)",color:isLiked?"#ef4444":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .15s",transform:isLiked?"scale(1.05)":"scale(1)"}}>
        <Ic.Heart f={isLiked}/><span>{story.likes||0}</span>
      </button>
      {!isMyStory && (
        <button onClick={()=>{setShowRep(r=>!r);setPaused(true);}} style={{display:"flex",alignItems:"center",gap:5,padding:compact?"5px 10px":"8px 14px",borderRadius:24,background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          <Ic.Reply/><span>Reply</span>
        </button>
      )}
      <button onClick={handleRepost} style={{display:"flex",alignItems:"center",gap:5,padding:compact?"5px 10px":"8px 14px",borderRadius:24,background:repostDone?"rgba(132,204,22,.2)":"rgba(0,0,0,.5)",border:repostDone?"1px solid rgba(132,204,22,.5)":"1px solid rgba(255,255,255,.2)",color:repostDone?"#84cc16":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
        <Ic.Repost/><span>{repostDone?"Reposted!":"Repost"}</span>
      </button>
      {story.music && (
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:24,background:"rgba(132,204,22,.1)",border:"1px solid rgba(132,204,22,.3)"}}>
          <Ic.Music/><span style={{fontSize:11,color:"#84cc16",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanSoundName(story.music)}</span>
        </div>
      )}
      {isVid && (
        <button onClick={()=>setMuted(m=>!m)} style={{width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          {muted?<Ic.SoundOff/>:<Ic.SoundOn/>}
        </button>
      )}
    </div>
  );

  const ReplyInput = () => showRep ? (
    <div style={{display:"flex",gap:8,paddingTop:8}}>
      <input value={repTxt} onChange={e=>setRepTxt(e.target.value)} autoFocus
        placeholder={`Reply to ${story.profile?.full_name?.split(" ")[0]||""}…`}
        onKeyDown={e=>e.key==="Enter"&&handleReply()} disabled={sending}
        style={{flex:1,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:24,color:"#fff",fontSize:13,padding:"10px 16px",outline:"none",caretColor:"#84cc16"}}/>
      <button onClick={handleReply} disabled={!repTxt.trim()||sending}
        style={{width:44,height:44,borderRadius:"50%",background:"#84cc16",border:"none",color:"#000",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
        {sending ? <span style={{width:14,height:14,border:"2px solid rgba(0,0,0,.3)",borderTopColor:"#000",borderRadius:"50%",animation:"uvSpin .7s linear infinite",display:"block"}}/> : <Ic.Send/>}
      </button>
      <button onClick={()=>{setShowRep(false);setPaused(false);}}
        style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <Ic.Close/>
      </button>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <div style={{position:"fixed",inset:0,zIndex:99999,background:"#000",display:"flex",flexDirection:"column",userSelect:"none"}}>
        {burst && <HeartBurst x={burst.x} y={burst.y} onDone={()=>setBurst(null)}/>}
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,paddingTop:"env(safe-area-inset-top,0px)",background:"linear-gradient(180deg,rgba(0,0,0,.8),transparent)"}}>
          <div style={{padding:"8px 12px 4px"}}><ProgBars sts={group?.statuses||[]}/></div>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 14px 8px"}}>
            <UAv user={story.profile||group.user} size={36} ring nearExp={nearE}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:4}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{story.profile?.full_name||group.user?.full_name}</span>
                {story.profile?.verified && <Ic.Verified/>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{fmtRel(story.created_at)}{nearE&&<span style={{color:"#f59e0b",marginLeft:5}}><Ic.Clock/> {fmtCountdown(story.expires_at)}</span>}</div>
            </div>
            <button onClick={()=>setPaused(p=>!p)} style={{width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
              {paused?<Ic.Play/>:<Ic.Pause/>}
            </button>
            <button onClick={onClose} style={{width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
              <Ic.Close/>
            </button>
          </div>
        </div>

        <div
          style={{flex:1,position:"relative",background:story.bg||"#000",transform:`translateX(${swipeX*.18}px)`,transition:touching?"none":"transform .25s ease-out"}}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onPointerDown={()=>!isVid&&setPaused(true)} onPointerUp={()=>!isVid&&setPaused(false)}
          onClick={handleMediaTap}
        >
          <StoryMedia story={story} mediaUrl={mediaUrl} isVid={isVid} muted={muted} paused={paused} onProgress={(p)=>setProg(p)} onEnded={advance} fullH/>
          {story.text && mediaUrl && (
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,.85),transparent)",padding:"28px 16px 14px"}}>
              <p style={{color:story.text_color||"#fff",fontSize:15,fontWeight:700,margin:0,lineHeight:1.4}}>{story.text}</p>
            </div>
          )}
          <button onClick={(e)=>{e.stopPropagation();retreat();}} style={{position:"absolute",left:0,top:"15%",bottom:"25%",width:"30%",background:"transparent",border:"none",cursor:"pointer",zIndex:2}}/>
          <button onClick={(e)=>{e.stopPropagation();advance();}} style={{position:"absolute",right:0,top:"15%",bottom:"25%",width:"30%",background:"transparent",border:"none",cursor:"pointer",zIndex:2}}/>
        </div>

        <div style={{background:"rgba(0,0,0,.92)",backdropFilter:"blur(12px)",padding:"10px 16px",paddingBottom:"max(env(safe-area-inset-bottom,0px),14px)",flexShrink:0}}>
          {repDone && <div style={{display:"flex",alignItems:"center",gap:6,color:"#84cc16",fontSize:13,fontWeight:600,justifyContent:"center",paddingBottom:8}}><Ic.Check/> Reply sent ✓</div>}
          <ActionsBar/><ReplyInput/>
        </div>
      </div>
    );
  }

  const prevPeek = sIdx>0 ? {g:group,si:sIdx-1} : gIdx>0 ? {g:allGroups[gIdx-1],si:(allGroups[gIdx-1]?.statuses?.length||1)-1} : null;
  const nextPeek = sIdx<(group?.statuses?.length||1)-1 ? {g:group,si:sIdx+1} : gIdx<allGroups.length-1 ? {g:allGroups[gIdx+1],si:0} : null;

  const PeekCard = ({ g, si=0, side, onClick }) => {
    const s = g?.statuses?.[si];
    const mu = getMediaUrl(s?.image_id);
    const iv = isVideoStatusFull(s);
    return (
      <button onClick={onClick} style={{flexShrink:0,width:115,height:185,borderRadius:18,overflow:"hidden",border:"1px solid rgba(255,255,255,.07)",background:"#111",cursor:"pointer",opacity:.38,transform:side==="left"?"scale(.88) translateX(18px)":"scale(.88) translateX(-18px)",transition:"all .25s",outline:"none"}}>
        {mu ? (iv ? <div style={{width:"100%",height:"100%",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:28,opacity:.8}}>▶</span></div> : <img src={mu} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>) :
          <div style={{width:"100%",height:"100%",background:s?.bg||"#0d1a00",display:"flex",alignItems:"center",justifyContent:"center",padding:8,boxSizing:"border-box"}}>
            <span style={{fontSize:11,color:s?.text_color||"#84cc16",textAlign:"center",lineHeight:1.4}}>{s?.text?.slice(0,40)}</span>
          </div>}
      </button>
    );
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,.92)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(18px)"}}>
      {burst && <HeartBurst x={burst.x} y={burst.y} onDone={()=>setBurst(null)}/>}
      <button onClick={onClose} style={{position:"absolute",top:20,right:20,width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10,outline:"none"}}><Ic.Close/></button>
      <button onClick={retreat} disabled={!prevPeek} style={{position:"absolute",left:20,top:"50%",transform:"translateY(-50%)",width:46,height:46,borderRadius:"50%",background:prevPeek?"rgba(255,255,255,.1)":"transparent",border:"1px solid rgba(255,255,255,.1)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",opacity:prevPeek?1:.2,outline:"none"}}><Ic.ChevL/></button>
      <button onClick={advance} style={{position:"absolute",right:20,top:"50%",transform:"translateY(-50%)",width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.1)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",outline:"none"}}><Ic.ChevR/></button>

      <div style={{display:"flex",alignItems:"center",gap:14,maxWidth:860,width:"100%",padding:"0 90px"}}>
        {prevPeek ? <PeekCard g={prevPeek.g} si={prevPeek.si} side="left" onClick={retreat}/> : <div style={{width:115,flexShrink:0}}/>}

        <div style={{flex:"0 0 370px",maxWidth:370,background:story.bg||"#050505",borderRadius:26,border:"1px solid rgba(132,204,22,.22)",boxShadow:"0 40px 100px rgba(0,0,0,.97)",display:"flex",flexDirection:"column",height:640,position:"relative"}}>
          <div style={{display:"flex",gap:3,padding:"12px 14px 6px",flexShrink:0,background:"linear-gradient(180deg,rgba(0,0,0,.65),transparent)",borderRadius:"26px 26px 0 0",position:"relative",zIndex:2}}>
            <ProgBars sts={group?.statuses||[]}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"2px 14px 8px",flexShrink:0,position:"relative",zIndex:2}}>
            <UAv user={story.profile||group.user} size={34} ring nearExp={nearE}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:4}}>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{story.profile?.full_name||group.user?.full_name}</span>
                {story.profile?.verified && <Ic.Verified/>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{fmtRel(story.created_at)}{nearE&&<span style={{color:"#f59e0b",marginLeft:5}}><Ic.Clock/> {fmtCountdown(story.expires_at)}</span>}</div>
            </div>
            <button onClick={()=>setPaused(p=>!p)} style={{width:29,height:29,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              {paused?<Ic.Play/>:<Ic.Pause/>}
            </button>
          </div>

          <div
            style={{flex:1,position:"relative"}}
            onMouseEnter={()=>!isVid&&setPaused(true)}
            onMouseLeave={()=>!isVid&&setPaused(false)}
            onClick={handleMediaTap}
          >
            <StoryMedia story={story} mediaUrl={mediaUrl} isVid={isVid} muted={muted} paused={paused} onProgress={(p)=>setProg(p)} onEnded={advance} fullH/>
            {story.text && mediaUrl && (
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,.85),transparent)",padding:"24px 14px 12px",zIndex:2}}>
                <p style={{color:story.text_color||"#fff",fontSize:14,fontWeight:700,margin:0,lineHeight:1.4}}>{story.text}</p>
              </div>
            )}
            <button onClick={(e)=>{e.stopPropagation();retreat();}} style={{position:"absolute",left:0,top:0,bottom:0,width:"35%",background:"transparent",border:"none",cursor:"pointer",zIndex:3}}/>
            <button onClick={(e)=>{e.stopPropagation();advance();}} style={{position:"absolute",right:0,top:0,bottom:0,width:"35%",background:"transparent",border:"none",cursor:"pointer",zIndex:3}}/>
          </div>

          <div style={{padding:"10px 14px 14px",flexShrink:0,background:"rgba(0,0,0,.9)",borderRadius:"0 0 26px 26px",position:"relative",zIndex:2}}>
            {repDone && <div style={{display:"flex",alignItems:"center",gap:6,color:"#84cc16",fontSize:12,fontWeight:600,marginBottom:8}}><Ic.Check/> Reply sent ✓</div>}
            <ActionsBar compact/><ReplyInput/>
          </div>
        </div>

        {nextPeek ? <PeekCard g={nextPeek.g} si={nextPeek.si} side="right" onClick={advance}/> : <div style={{width:115,flexShrink:0}}/>}
      </div>
    </div>
  );
});
StoryViewer.displayName = "StoryViewer";

// ══════════════════════════════════════════════════════════════════════════════
// AddStatusModalInner — uses useSoundGallery() safely (always inside Provider)
// ══════════════════════════════════════════════════════════════════════════════
const AddStatusModalInner = memo(({ currentUser, onClose, onAdded, tierLimit, currentCount }) => {
  const [step,   setStep]   = useState("pick");
  const [text,   setText]   = useState("");
  const [bg,     setBg]     = useState(GRADIENTS[0]);
  const [bgPage, setBgPage] = useState(0);
  const [tcol,   setTcol]   = useState("#ffffff");
  const [dur,    setDur]    = useState(24);
  const [media,  setMedia]  = useState(null);
  const [sound,  setSound]  = useState(null);
  const [saving, setSaving] = useState(false);
  const [pct,    setPct]    = useState(0);
  const [err,    setErr]    = useState(null);
  const fileRef  = useRef(null);

  // [FIX-1] This is now always inside SoundGalleryProvider — never null
  const gallery = useSoundGallery();

  const atLimit  = currentCount >= tierLimit;
  const charPct  = Math.min((text.length/CHAR_MAX)*100, 100);
  const bgSlice  = GRADIENTS.slice(bgPage*5, bgPage*5+5);
  const canNext  = !!media || text.trim().length > 0;
  const expAt    = new Date(Date.now() + dur*3_600_000);

  const openSound = useCallback(() => {
    if (!gallery) return; // defensive guard
    gallery.openGallery("status", (s) => setSound(s));
  }, [gallery]);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setErr(null);
    const isVid = f.type.startsWith("video/");
    const ext   = (f.name?.split(".").pop()||"").toLowerCase();
    const vExts = ["mp4","mov","avi","webm","m4v","mpeg","mpg"];
    const iExts = ["jpg","jpeg","png","gif","webp","avif"];
    if (!f.type.startsWith("image/") && !isVid && !vExts.includes(ext) && !iExts.includes(ext)) {
      setErr("Only images and videos are supported."); return;
    }
    const maxMb = isVid||vExts.includes(ext) ? 100 : 20;
    if (f.size > maxMb*1024*1024) { setErr(`Too large — max ${maxMb}MB.`); return; }
    setSaving(true); setPct(0);
    statusUpdateService.uploadMedia(f, (p) => setPct(p))
      .then((res) => { setMedia(res); setStep("compose"); })
      .catch((e)  => setErr(`Upload failed: ${e.message}`))
      .finally(()  => setSaving(false));
  }, []);

  // [FIX-2] handleShare uses service which now handles missing music column
  const handleShare = async () => {
    if (saving || !canNext) return;
    setSaving(true);
    setErr(null);
    try {
      await statusUpdateService.create({
        userId:    currentUser.id,
        text:      text.trim() || null,
        bg:        media ? null : bg,
        textColor: tcol,
        duration:  dur,
        media,
        sound,
      });
      onAdded?.();
      onClose();
    } catch (e) {
      // [FIX-3] Fallback direct insert — strips music/media_type if column missing
      try {
        const row = {
          user_id:    currentUser.id,
          text:       text.trim() || null,
          bg:         media ? null : bg,
          text_color: tcol,
          duration_h: dur,
          expires_at: expAt.toISOString(),
          views:      0,
          likes:      0,
        };
        if (media?.id) row.image_id = media.id;

        // Probe first to know which columns to include
        const [hasMusicCol, hasMediaTypeCol] = await Promise.all([
          supabase.from("status_updates").select("music").limit(1).then(r => !r.error),
          supabase.from("status_updates").select("media_type").limit(1).then(r => !r.error),
        ]);

        if (hasMediaTypeCol) row.media_type = media ? (media.type||"image") : "text";
        if (hasMusicCol)     row.music      = sound?.name || null;

        const { error: insertErr } = await supabase.from("status_updates").insert(row);
        if (insertErr) throw insertErr;
        onAdded?.();
        onClose();
      } catch (e2) {
        setErr(`Could not share: ${e2.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const SoundRow = () => (
    <div style={{padding:"0 18px 8px",flexShrink:0}}>
      {sound ? (
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",background:"rgba(132,204,22,.09)",border:"1px solid rgba(132,204,22,.28)",borderRadius:16}}>
          <Ic.Music/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:"#84cc16",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanSoundName(sound.name)}</div>
            <div style={{fontSize:10,color:"rgba(132,204,22,.6)",marginTop:1}}>
              Song {Math.round((sound.songVol||1)*100)}% · Video {Math.round((sound.videoVol||0.3)*100)}%
            </div>
          </div>
          <button onClick={openSound} style={{padding:"3px 9px",borderRadius:8,background:"rgba(132,204,22,.12)",border:"1px solid rgba(132,204,22,.25)",color:"#84cc16",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>Change</button>
          <button onClick={()=>setSound(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.35)",cursor:"pointer",fontSize:16,flexShrink:0,lineHeight:1}}>✕</button>
        </div>
      ) : (
        <button onClick={openSound} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderRadius:16,background:"rgba(132,204,22,.05)",border:"1px solid rgba(132,204,22,.16)",color:"rgba(132,204,22,.8)",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",justifyContent:"center",transition:"all .15s",fontFamily:"inherit"}}>
          <Ic.Music/> Add Sound
        </button>
      )}
    </div>
  );

  return (
    <div className="as-ov" onClick={onClose}>
      <div className="as-sheet" onClick={(e)=>e.stopPropagation()}>
        <div className="as-pill"/>

        {/* ── PICK ── */}
        {step === "pick" && (
          <>
            <div className="as-hdr">
              <h3 className="as-title">New Status</h3>
              <button className="as-close" onClick={onClose}><Ic.Close/></button>
            </div>
            {atLimit && (
              <div style={{margin:"0 18px 10px",padding:"10px 12px",borderRadius:10,background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.22)",display:"flex",alignItems:"center",gap:8}}>
                <Ic.Lock/>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Limit reached ({currentCount}/{tierLimit})</div>
                  <div style={{fontSize:11,color:"#666",marginTop:1}}>Delete a status or upgrade</div>
                </div>
              </div>
            )}
            <div className="as-pick-grid">
              {[
                {icon:<Ic.Type/>,  label:"Text",  desc:"Words + color backgrounds", cls:"as-pt", m:"text"},
                {icon:<Ic.Camera/>,label:"Photo", desc:"JPG, PNG, WEBP · up to 20MB", cls:"as-pp", m:"photo"},
                {icon:<Ic.Video/>, label:"Video", desc:"MP4, MOV · up to 100MB",    cls:"as-pv", m:"video"},
              ].map(({icon,label,desc,cls,m}) => (
                <button key={m} className="as-pick-card" disabled={atLimit} style={{opacity:atLimit?.38:1,cursor:atLimit?"not-allowed":"pointer"}}
                  onClick={()=>{
                    if (atLimit) return;
                    if (m==="text") { setStep("compose"); }
                    else { if (fileRef.current) { fileRef.current.accept=m==="video"?"video/*":"image/*"; fileRef.current.click(); } }
                  }}>
                  <div className={`as-pick-icon ${cls}`}>{icon}</div>
                  <div className="as-pick-info"><span className="as-pick-label">{label}</span><span className="as-pick-desc">{desc}</span></div>
                  <span className="as-pick-arrow">→</span>
                </button>
              ))}
              <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={(e)=>handleFile(e.target.files?.[0])} onClick={(e)=>{e.target.value="";}}/>
            </div>
            <SoundRow/>
            {saving && (
              <div className="as-prog-wrap">
                <div className="as-prog-bar"><div className="as-prog-fill" style={{width:`${pct}%`}}/></div>
                <span className="as-prog-label">Uploading {Math.round(pct)}%…</span>
              </div>
            )}
            {err && <div className="as-err">{err}</div>}
          </>
        )}

        {/* ── COMPOSE ── */}
        {step === "compose" && (
          <>
            <div className="as-hdr">
              <button className="as-back" onClick={()=>{setMedia(null);setStep("pick");}}>← Back</button>
              <span className="as-title as-title-c">{media?"Add Caption":"Write Status"}</span>
              <button className="as-close" onClick={onClose}><Ic.Close/></button>
            </div>

            <div className="as-preview" style={media?{background:"#000"}:{background:bg}}>
              {media?.type==="video" && <video key={media.url} src={media.url} muted autoPlay loop playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/>}
              {media?.type==="image" && <img key={media.url} src={media.url} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>}
              {text && <p className="as-overlay-text" style={{color:tcol}}>{text}</p>}
              {!text && !media && <p className="as-placeholder">Your status preview…</p>}
              {sound && (
                <div style={{position:"absolute",bottom:8,left:8,display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:"rgba(0,0,0,.7)",borderRadius:20,backdropFilter:"blur(6px)"}}>
                  <Ic.Music/>
                  <span style={{fontSize:11,color:"#84cc16",fontWeight:600,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanSoundName(sound.name)}</span>
                </div>
              )}
            </div>

            <div className="as-inp-wrap">
              <textarea className="as-textarea" placeholder={media?"Add a caption (optional)…":"What's on your mind?"} value={text} onChange={(e)=>setText(e.target.value)} maxLength={CHAR_MAX} autoFocus={!media}/>
              <div className="as-char-ring">
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2.5"/>
                  <circle cx="12" cy="12" r="10" fill="none" stroke={charPct>90?"#ef4444":charPct>70?"#f59e0b":"#84cc16"} strokeWidth="2.5"
                    strokeDasharray={`${2*Math.PI*10}`} strokeDashoffset={`${2*Math.PI*10*(1-charPct/100)}`} strokeLinecap="round"
                    style={{transform:"rotate(-90deg)",transformOrigin:"center",transition:"all .2s"}}/>
                </svg>
                <span style={{fontSize:11,color:charPct>90?"#ef4444":"#555"}}>{CHAR_MAX-text.length}</span>
              </div>
            </div>

            <SoundRow/>

            {!media && (
              <>
                <p className="as-section-lbl">Background</p>
                <div className="as-bg-row">
                  {bgSlice.map((g,i) => (
                    <button key={i} className={`as-bg-sw${bg===g?" as-bg-on":""}`} style={{background:g}} onClick={()=>setBg(g)}>{bg===g&&<Ic.Check/>}</button>
                  ))}
                  <button className="as-bg-page" onClick={()=>setBgPage(p=>(p+1)%Math.ceil(GRADIENTS.length/5))}>
                    {bgPage<Math.ceil(GRADIENTS.length/5)-1?"→":"↺"}
                  </button>
                </div>
              </>
            )}

            <p className="as-section-lbl">Text Color</p>
            <div className="as-color-row">
              {TEXT_COLORS.map((c) => (
                <button key={c} className={`as-color-dot${tcol===c?" as-dot-on":""}`} style={{background:c}} onClick={()=>setTcol(c)}/>
              ))}
            </div>

            <button className="as-cta" onClick={()=>setStep("duration")} disabled={!canNext}>Next: Set Duration →</button>
          </>
        )}

        {/* ── DURATION ── */}
        {step === "duration" && (
          <>
            <div className="as-hdr">
              <button className="as-back" onClick={()=>setStep("compose")}>← Back</button>
              <span className="as-title as-title-c">How long?</span>
              <button className="as-close" onClick={onClose}><Ic.Close/></button>
            </div>

            <div className="as-dur-preview" style={media?{background:"#111",overflow:"hidden"}:{background:bg}}>
              {media?.type==="video" && <video key={media.url} src={media.url} muted autoPlay loop playsInline style={{height:"100%",objectFit:"cover",width:"100%"}}/>}
              {media?.type==="image" && <img src={media.url} alt="" style={{height:"100%",objectFit:"cover",width:"100%"}}/>}
              {!media && text && <p style={{color:tcol,fontSize:13,fontWeight:700,margin:0,padding:"0 12px",textAlign:"center"}}>{text.slice(0,60)}{text.length>60?"…":""}</p>}
            </div>

            {sound && (
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 18px 0"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(132,204,22,.09)",border:"1px solid rgba(132,204,22,.25)",borderRadius:14,flex:1,minWidth:0}}>
                  <Ic.Music/>
                  <span style={{fontSize:12,fontWeight:600,color:"#84cc16",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanSoundName(sound.name)}</span>
                  <span style={{fontSize:10,color:"rgba(132,204,22,.55)",marginLeft:"auto",flexShrink:0}}>
                    {Math.round((sound.songVol||1)*100)}% / {Math.round((sound.videoVol||0.3)*100)}%
                  </span>
                </div>
              </div>
            )}

            <p className="as-dur-hint">Status disappears after this time.</p>
            <div className="as-dur-cards">
              {DURATIONS.map((d) => (
                <button key={d.h} className={`as-dur-card${dur===d.h?" as-dur-on":""}`} onClick={()=>setDur(d.h)}>
                  <span className="as-dur-time">{d.label}</span>
                  <span className="as-dur-desc">{d.sub}</span>
                  {dur===d.h && <span className="as-dur-check"><Ic.Check/></span>}
                </button>
              ))}
            </div>

            <div className="as-dur-expiry">
              <Ic.Clock/>
              <span>Expires {expAt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}, {expAt.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})}</span>
            </div>
            {err && <div className="as-err">{err}</div>}
            <button className={`as-share-btn${saving?" as-saving":""}`} onClick={handleShare} disabled={saving||!canNext} style={{marginBottom:"max(env(safe-area-inset-bottom,0px),16px)"}}>
              {saving ? <span className="as-spinner"/> : <><Ic.Send/><span>Share Status</span></>}
            </button>
          </>
        )}
      </div>
      <style>{MODAL_CSS}</style>
    </div>
  );
});
AddStatusModalInner.displayName = "AddStatusModalInner";

// [FIX-1] AddStatusModal wraps itself in SoundGalleryProvider so useSoundGallery()
// inside AddStatusModalInner is always valid regardless of the outer tree.
const AddStatusModal = memo((props) => (
  <SoundGalleryProvider>
    <AddStatusModalInner {...props} />
  </SoundGalleryProvider>
));
AddStatusModal.displayName = "AddStatusModal";

// ── Contact Row ───────────────────────────────────────────────────────────────
const ContactRow = memo(({ group, isSeen, onClick, onRepost }) => {
  const first  = group.statuses[0];
  const mu     = getMediaUrl(first?.image_id);
  const isVid  = isVideoStatusFull(first);
  const preview = isVid?"🎥 Video":first?.image_id?"📷 Photo":first?.text?.slice(0,50)||"Status update";
  const count  = group.statuses.length;
  const nearE  = !isSeen && first && isNearExp(first.expires_at);
  const ringCol = nearE?"#f59e0b":"#84cc16";
  const SIZE=52, R=24, STROKE=2.5;
  const GAP    = count>1?(count<=3?7:5):0;
  const segDeg = count>0?(360-GAP*count)/count:360;
  const circum = 2*Math.PI*R;
  const segLen = (segDeg/360)*circum;

  return (
    <div onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,.03)",cursor:"pointer",transition:"background .15s",opacity:isSeen?.6:1}}
      onMouseEnter={(e)=>e.currentTarget.style.background="rgba(255,255,255,.025)"}
      onMouseLeave={(e)=>e.currentTarget.style.background="transparent"}>
      <div style={{position:"relative",flexShrink:0,width:SIZE,height:SIZE}}>
        <svg width={SIZE} height={SIZE} style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}}>
          {!isSeen&&count>0 ? Array.from({length:count}).map((_,i)=>{
            const off = (i*(segDeg+GAP)/360)*circum;
            return <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={ringCol} strokeWidth={STROKE} strokeDasharray={`${segLen} ${circum-segLen}`} strokeDashoffset={-off} strokeLinecap="round" opacity={.95}/>;
          }) : <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={STROKE}/>}
        </svg>
        <div style={{position:"absolute",inset:STROKE+3,borderRadius:"50%",overflow:"hidden"}}>
          <UAv user={group.user} size={SIZE-(STROKE+3)*2}/>
        </div>
        {count>1&&!isSeen&&<div style={{position:"absolute",bottom:-1,right:-1,width:16,height:16,borderRadius:"50%",background:ringCol,border:"1.5px solid #000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#000",zIndex:2}}>{count}</div>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:isSeen?"#555":"#fff",display:"flex",alignItems:"center",gap:4}}>
          {group.user?.full_name}{group.user?.verified&&<Ic.Verified/>}
        </div>
        <div style={{fontSize:12,color:"#444",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {preview} · {fmtRel(first?.created_at)}
          {nearE&&<span style={{color:"#f59e0b",marginLeft:4,fontSize:11}}>⏰ {fmtCountdown(first.expires_at)}</span>}
        </div>
        {first?.music && <div style={{fontSize:10,color:"rgba(132,204,22,.5)",marginTop:2,display:"flex",alignItems:"center",gap:3}}><Ic.Music/>{cleanSoundName(first.music)}</div>}
      </div>
      {mu&&!isVid&&<div style={{width:42,height:42,borderRadius:10,overflow:"hidden",flexShrink:0}}><img src={mu} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
      <button onClick={(e)=>{e.stopPropagation();onRepost?.(first);}}
        style={{width:32,height:32,borderRadius:"50%",background:"rgba(132,204,22,.07)",border:"1px solid rgba(132,204,22,.2)",color:"#84cc16",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}} title="Repost">
        <Ic.Repost/>
      </button>
      {!isSeen&&<div style={{width:9,height:9,borderRadius:"50%",background:"#84cc16",flexShrink:0,boxShadow:"0 0 6px rgba(132,204,22,.6)"}}/>}
    </div>
  );
});
ContactRow.displayName = "ContactRow";

// ══════════════════════════════════════════════════════════════════════════════
// MAIN UpdatesView
// ══════════════════════════════════════════════════════════════════════════════
const UpdatesView = ({ currentUser, userId, onOpenDM }) => {
  const [myStatuses,  setMyStatuses]  = useState([]);
  const [feedGroups,  setFeedGroups]  = useState([]);
  const [likedIds,    setLikedIds]    = useState(new Set());
  const [loading,     setLoading]     = useState(true);
  const [viewer,      setViewer]      = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [extTarget,   setExtTarget]   = useState(null);
  const [tierInfo,    setTierInfo]    = useState({ tier:"free", limit:5 });
  const [liveNewDot,  setLiveNewDot]  = useState(false);

  const seenRef  = useRef(new Set());
  const mountRef = useRef(true);

  const loadTier = useCallback(async () => {
    try {
      const { data } = await supabase.from("profile_boosts").select("boost_tier").eq("user_id",userId).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
      const tier = data?.boost_tier || "free";
      setTierInfo({ tier, limit:TIER_LIMITS[tier]||TIER_LIMITS.free });
    } catch { setTierInfo({ tier:"free", limit:5 }); }
  }, [userId]);

  useEffect(() => {
    try { const raw = localStorage.getItem(getSeenKey(userId)); if (raw) seenRef.current = new Set(JSON.parse(raw)); } catch {}
  }, [userId]);

  const loadStatuses = useCallback(async () => {
    if (!userId || !mountRef.current) return;
    try {
      let data = null;
      try {
        const { data:d, error:e } = await supabase
          .from("status_updates")
          .select("id,text,bg,text_color,image_id,media_type,music,duration_h,views,likes,created_at,expires_at,user_id,profile:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)")
          .gt("expires_at", new Date().toISOString())
          .order("created_at",{ascending:false});
        if (e) throw e;
        data = d;
      } catch (err) {
        // Columns may not exist — fall back to base select
        if (err?.message?.includes("music") || err?.message?.includes("schema cache") || err?.message?.includes("media_type")) {
          const { data:d2, error:e2 } = await supabase
            .from("status_updates")
            .select("id,text,bg,text_color,image_id,duration_h,views,likes,created_at,expires_at,user_id,profile:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)")
            .gt("expires_at", new Date().toISOString())
            .order("created_at",{ascending:false});
          if (e2) throw e2;
          data = (d2||[]).map((s) => ({ ...s, media_type:s.image_id?"image":"text", music:null }));
        } else {
          throw err;
        }
      }
      if (!mountRef.current) return;

      const enriched = (data||[]).map((s) => ({
        ...s,
        media_type: s.media_type || (s.image_id ? (isVideoStatusFull(s)?"video":"image") : "text"),
        music: s.music || null,
      }));

      setMyStatuses(enriched.filter((s) => s.user_id === userId));

      const map = new Map();
      enriched.filter((s) => s.user_id !== userId).forEach((s) => {
        if (!map.has(s.user_id)) map.set(s.user_id, { user:s.profile, statuses:[], hasUnseen:false });
        const seen = seenRef.current.has(s.id);
        if (!seen) map.get(s.user_id).hasUnseen = true;
        map.get(s.user_id).statuses.push({ ...s, _seen:seen });
      });
      const groups = Array.from(map.values()).sort((a,b) => (b.hasUnseen?1:0)-(a.hasUnseen?1:0));
      setFeedGroups(groups);

      if (enriched.length > 0) {
        const { data:lrows } = await supabase.from("status_likes").select("status_id").eq("user_id",userId).in("status_id",enriched.map((s)=>s.id));
        if (mountRef.current && lrows) setLikedIds(new Set(lrows.map((l)=>l.status_id)));
      }

      _badgeSetter?.(groups.filter((g)=>g.hasUnseen).length);
    } catch (e) { console.warn("[UpdatesView] load:", e?.message); }
    finally { if (mountRef.current) setLoading(false); }
  }, [userId]);

  useEffect(() => {
    mountRef.current = true; setLoading(true);
    loadTier(); loadStatuses();
    return () => { mountRef.current = false; };
  }, [loadStatuses, loadTier]);

  useEffect(() => {
    const h = () => setShowAdd(true);
    document.addEventListener("dm:addStory", h);
    return () => document.removeEventListener("dm:addStory", h);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`su_ui_${userId}`)
      .on("postgres_changes", {event:"INSERT",schema:"public",table:"status_updates"}, (p) => {
        if (p.new?.user_id !== userId) setLiveNewDot(true);
        loadStatuses();
      })
      .on("postgres_changes", {event:"DELETE",schema:"public",table:"status_updates"}, () => loadStatuses())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadStatuses]);

  const handleToggleLike = useCallback(async (statusId, wasLiked) => {
    if (!userId || !statusId) return;
    const delta = wasLiked ? -1 : 1;
    setLikedIds((p) => { const n=new Set(p); wasLiked?n.delete(statusId):n.add(statusId); return n; });
    setMyStatuses((p) => p.map((s) => s.id===statusId?{...s,likes:Math.max(0,(s.likes||0)+delta)}:s));
    setFeedGroups((p) => p.map((g) => ({...g,statuses:g.statuses.map((s) => s.id===statusId?{...s,likes:Math.max(0,(s.likes||0)+delta)}:s)})));
    try {
      if (wasLiked) {
        await supabase.from("status_likes").delete().eq("status_id",statusId).eq("user_id",userId);
      } else {
        await supabase.from("status_likes").insert({status_id:statusId,user_id:userId}).select();
      }
      const { data:curr } = await supabase.from("status_updates").select("likes").eq("id",statusId).maybeSingle();
      if (curr) await supabase.from("status_updates").update({likes:Math.max(0,(curr.likes||0)+delta)}).eq("id",statusId);
    } catch {
      setLikedIds((p) => { const n=new Set(p); wasLiked?n.add(statusId):n.delete(statusId); return n; });
    }
  }, [userId]);

  const markSeen = useCallback((statusId, ownerId) => {
    if (!statusId || seenRef.current.has(statusId)) return;
    seenRef.current.add(statusId);
    try { localStorage.setItem(getSeenKey(userId), JSON.stringify([...seenRef.current])); } catch {}
    if (ownerId !== userId) {
      try { statusUpdateService.recordView?.(statusId, userId, ownerId); } catch {}
    }
    setFeedGroups((p) => p.map((g) => ({
      ...g,
      statuses: g.statuses.map((s) => s.id===statusId?{...s,_seen:true}:s),
      hasUnseen: g.statuses.some((s) => s.id!==statusId && !s._seen),
    })));
  }, [userId]);

  const handleDmReply = useCallback(async ({ replyText, status }) => {
    if (!replyText?.trim() || !status?.user_id || status.user_id===userId) return;
    try {
      const conv = await dmMessageService.createConversation(userId, status.user_id);
      const payload = statusUpdateService.getReplyPayload(status, replyText);
      await dmMessageService.sendMessage(conv.id, payload, userId);
      onOpenDM?.({ userId:status.user_id });
    } catch (e) { console.warn("[UpdatesView] DM reply:", e?.message); }
  }, [userId, onOpenDM]);

  const handleRepost = useCallback(async (status) => {
    if (!status || !userId) return;
    const author = status.profile?.username || status.profile?.full_name || "someone";
    const txt = status.text ? `↩ Reposted @${author}: ${status.text}`.slice(0,CHAR_MAX) : `↩ Reposted @${author}`;
    try {
      await statusUpdateService.create({
        userId, text:txt,
        bg: status.image_id?null:(status.bg||GRADIENTS[0]),
        textColor: status.text_color||"#ffffff",
        duration: 24,
        media: status.image_id?{id:status.image_id,type:status.media_type||"image",url:getMediaUrl(status.image_id)}:null,
      });
      loadStatuses();
    } catch (e) { console.warn("[UpdatesView] repost:", e?.message); throw e; }
  }, [userId, loadStatuses]);

  const handleDelete = useCallback(async (sid) => {
    setMyStatuses((p) => p.filter((s) => s.id!==sid));
    try { await supabase.from("status_updates").delete().eq("id",sid).eq("user_id",userId); } catch {}
  }, [userId]);

  const handleExtend = useCallback(async (sid, hours) => {
    const found = myStatuses.find((s) => s.id===sid);
    if (!found) return;
    const base   = new Date(Math.max(new Date(found.expires_at), Date.now()));
    const newExp = new Date(base.getTime()+hours*3_600_000).toISOString();
    try {
      await supabase.from("status_updates").update({expires_at:newExp}).eq("id",sid).eq("user_id",userId);
      loadStatuses();
    } catch {}
  }, [myStatuses, userId, loadStatuses]);

  const myUser  = { id:userId, full_name:currentUser?.fullName||currentUser?.full_name||currentUser?.name||"You", avatar_id:currentUser?.avatarId||currentUser?.avatar_id };
  const myGroup = { user:myUser, statuses:myStatuses, isMe:true };
  const allGroups = [myGroup, ...feedGroups];

  const openViewer = (groupIdx, storyIdx=0) => {
    setLiveNewDot(false);
    const s = allGroups[groupIdx]?.statuses?.[storyIdx];
    if (s) markSeen(s.id, s.user_id || allGroups[groupIdx]?.user?.id);
    setViewer({ groupIdx, storyIdx });
  };

  const atLimit      = myStatuses.length >= tierInfo.limit;
  const unseenGroups = feedGroups.filter((g) => g.hasUnseen);
  const seenGroups   = feedGroups.filter((g) => !g.hasUnseen);

  return (
    <div className="upd-root">
      {/* Ring tray */}
      <div className="upd-tray">
        {[
          { group:myGroup, isMe:true, onClick:()=>myStatuses.length>0?openViewer(0):setShowAdd(true) },
          ...feedGroups.map((g,i) => ({ group:g, isMe:false, onClick:()=>openViewer(i+1) })),
        ].map(({group,isMe,onClick},i) => (
          <StatusThumb key={i} statuses={group.statuses} profile={group.user} isMe={isMe} onClick={onClick} hasNew={!isMe&&group.hasUnseen&&liveNewDot}/>
        ))}
        {loading && [0,1,2,3].map((i) => (
          <div key={i} style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,255,255,.04)",animation:`uvPulse 1.4s ${i*.15}s ease-in-out infinite`,flexShrink:0}}/>
        ))}
      </div>

      {/* My status row */}
      <div className="upd-my-row">
        <div className="upd-my-left" onClick={()=>myStatuses.length>0?openViewer(0):setShowAdd(true)}>
          <div className="upd-my-av-wrap">
            <UAv user={myUser} size={50} ring={myStatuses.length>0}/>
            <button className="upd-my-add" onClick={(e)=>{e.stopPropagation();if(!atLimit)setShowAdd(true);}} style={{opacity:atLimit?.4:1,cursor:atLimit?"not-allowed":"pointer"}}>
              <Ic.Plus/>
            </button>
          </div>
          <div className="upd-my-info">
            <div className="upd-my-name">My Status</div>
            <div className="upd-my-sub">{atLimit?`Limit reached (${myStatuses.length}/${tierInfo.limit})`:myStatuses.length>0?`${myStatuses.length}/${tierInfo.limit} · tap to view`:"Tap + to share a status"}</div>
          </div>
          {myStatuses.length>0&&<span className="upd-my-badge">{myStatuses.length}</span>}
        </div>
      </div>

      {/* My status cards */}
      {myStatuses.length>0 && (
        <div className="upd-cards-scroll">
          {myStatuses.map((s,si) => {
            const mu = getMediaUrl(s.image_id);
            const nE = isNearExp(s.expires_at);
            return (
              <div key={s.id} className="upd-card" onClick={()=>openViewer(0,si)}>
                <div className="upd-card-thumb" style={s.bg?{background:s.bg}:{background:"#0d1117"}}>
                  {mu&&isVideoStatusFull(s) ? <video src={mu} muted autoPlay loop playsInline className="upd-card-media"/> :
                   mu                        ? <img src={mu} alt="" className="upd-card-media"/> : null}
                  {s.text && <span className="upd-card-text" style={{color:s.text_color||"#fff"}}>{s.text.slice(0,40)}</span>}
                  <div className="upd-card-ov"/>
                  {s.music && <div style={{position:"absolute",bottom:32,left:6,display:"flex",alignItems:"center",gap:3,padding:"2px 6px",background:"rgba(0,0,0,.6)",borderRadius:10,backdropFilter:"blur(4px)"}}><Ic.Music/><span style={{fontSize:8,color:"#84cc16",maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanSoundName(s.music)}</span></div>}
                </div>
                <div className="upd-card-footer">
                  <div className="upd-card-meta">
                    <span style={{display:"flex",alignItems:"center",gap:2,color:nE?"#f59e0b":"#555",fontSize:9}}><Ic.Clock/>{fmtCountdown(s.expires_at)}</span>
                    <span style={{display:"flex",alignItems:"center",gap:2,color:"#555",fontSize:9}}><Ic.Eye/>{s.views||0}</span>
                  </div>
                  <div className="upd-card-actions">
                    {nE && <button className="upd-extend-btn" onClick={(e)=>{e.stopPropagation();setExtTarget(s);}}>+time</button>}
                    <button className="upd-del-btn" onClick={(e)=>{e.stopPropagation();handleDelete(s.id);}}><Ic.Trash/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unseen */}
      {!loading && unseenGroups.length>0 && (
        <>
          <div className="upd-section" style={{display:"flex",alignItems:"center",gap:6}}>
            Recent updates
            {liveNewDot && <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block",animation:"uvNewDot 1.5s ease-in-out infinite"}}/>}
          </div>
          {unseenGroups.map((g) => (
            <ContactRow key={g.user?.id} group={g} isSeen={false} onRepost={handleRepost}
              onClick={()=>{const idx=allGroups.indexOf(g);openViewer(idx<0?1:idx);}}/>
          ))}
        </>
      )}

      {/* Seen */}
      {!loading && seenGroups.length>0 && (
        <>
          <div className="upd-section" style={{color:"#2a2a2a"}}>Viewed</div>
          {seenGroups.map((g) => (
            <ContactRow key={g.user?.id} group={g} isSeen onRepost={handleRepost}
              onClick={()=>{const idx=allGroups.indexOf(g);openViewer(idx<0?1:idx);}}/>
          ))}
        </>
      )}

      {/* Empty */}
      {!loading && feedGroups.length===0 && (
        <div className="upd-empty">
          <div style={{fontSize:56}}>📡</div>
          <h3 style={{fontSize:20,fontWeight:800,color:"#fff",textAlign:"center",margin:0}}>No updates yet</h3>
          <p style={{fontSize:13,color:"#555",textAlign:"center",maxWidth:280,lineHeight:1.6,margin:0}}>Follow people to see their status updates here.</p>
          <button onClick={()=>!atLimit&&setShowAdd(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"13px 24px",borderRadius:16,background:"rgba(132,204,22,.12)",border:"1px solid rgba(132,204,22,.3)",color:"#84cc16",fontSize:14,fontWeight:700,cursor:atLimit?"not-allowed":"pointer",marginTop:8,opacity:atLimit?.4:1}}>
            <Ic.Plus/> Create Your First Status
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{padding:"8px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {[0,1,2,3,4].map((i) => (
            <div key={i} style={{height:72,borderRadius:14,background:"rgba(255,255,255,.03)",animation:`uvPulse 1.4s ${i*.1}s ease-in-out infinite`}}/>
          ))}
        </div>
      )}

      {/* Extend modal */}
      {extTarget && (
        <div style={{position:"fixed",inset:0,zIndex:20002,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"flex-end"}}>
          <div style={{width:"100%",background:"#0d0d0d",border:"1px solid rgba(245,158,11,.22)",borderRadius:"18px 18px 0 0",paddingBottom:"max(env(safe-area-inset-bottom,0px),16px)",animation:"uvMsUp .25s cubic-bezier(.34,1.4,.64,1)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px 8px",fontSize:16,fontWeight:800,color:"#fff"}}>
              <span>⏳ Extend Status</span>
              <button onClick={()=>setExtTarget(null)} style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#555"}}><Ic.Close/></button>
            </div>
            <p style={{fontSize:13,color:"#666",padding:"0 18px 10px",margin:0}}>Currently: <strong style={{color:"#f59e0b"}}>{fmtCountdown(extTarget.expires_at)} remaining</strong></p>
            {[3,6,12,24].map((h) => (
              <button key={h} onClick={()=>{handleExtend(extTarget.id,h);setExtTarget(null);}}
                style={{display:"block",width:"100%",padding:"13px 18px",background:"rgba(245,158,11,.06)",border:"none",borderBottom:"1px solid rgba(255,255,255,.04)",color:"#f59e0b",fontSize:15,fontWeight:700,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
                + {h} hours
              </button>
            ))}
          </div>
        </div>
      )}

      {viewer && (
        <StoryViewer
          allGroups={allGroups}
          startGroupIdx={viewer.groupIdx}
          startStoryIdx={viewer.storyIdx}
          userId={userId}
          onClose={()=>setViewer(null)}
          onDmReply={handleDmReply}
          likedIds={likedIds}
          onToggleLike={handleToggleLike}
          onRepost={handleRepost}
        />
      )}

      {/* [FIX-1] AddStatusModal self-contains its SoundGalleryProvider */}
      {showAdd && (
        <AddStatusModal
          currentUser={currentUser}
          onClose={()=>setShowAdd(false)}
          onAdded={()=>{loadStatuses();setLiveNewDot(false);}}
          tierLimit={tierInfo.limit}
          currentCount={myStatuses.length}
        />
      )}

      <style>{ROOT_CSS}</style>
    </div>
  );
};

export default UpdatesView;

// ══════════════════════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════════════════════
const ROOT_CSS = `
  @keyframes uvSpin    { to{transform:rotate(360deg)} }
  @keyframes uvWave    { from{transform:scaleY(.25)} to{transform:scaleY(1)} }
  @keyframes uvHburst  { 0%{opacity:1;transform:translate(0,0) scale(.5)} 60%{opacity:1} 100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.2)} }
  @keyframes uvPulse   { 0%,100%{opacity:.5} 50%{opacity:.1} }
  @keyframes uvNewDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }
  @keyframes uvMsUp    { from{transform:translateY(100%)} to{transform:translateY(0)} }

  .upd-root { display:flex; flex-direction:column; height:100%; overflow-y:auto; background:#000; -webkit-overflow-scrolling:touch; }
  .upd-root::-webkit-scrollbar { width:3px; }
  .upd-root::-webkit-scrollbar-thumb { background:rgba(132,204,22,.18); border-radius:2px; }

  .upd-tray { display:flex; gap:10px; padding:12px 14px; overflow-x:auto; -webkit-overflow-scrolling:touch; border-bottom:1px solid rgba(255,255,255,.04); background:rgba(4,4,4,.6); flex-shrink:0; scrollbar-width:none; }
  .upd-tray::-webkit-scrollbar { display:none; }

  .upd-my-row   { display:flex; align-items:center; padding:13px 16px; border-bottom:1px solid rgba(255,255,255,.04); flex-shrink:0; }
  .upd-my-left  { display:flex; align-items:center; gap:12px; cursor:pointer; flex:1; min-width:0; }
  .upd-my-av-wrap { position:relative; flex-shrink:0; }
  .upd-my-add   { position:absolute; bottom:-2px; right:-2px; width:22px; height:22px; border-radius:50%; background:#84cc16; border:2px solid #000; display:flex; align-items:center; justify-content:center; color:#000; transition:transform .15s; }
  .upd-my-add:hover { transform:scale(1.15); }
  .upd-my-add svg { width:11px; height:11px; }
  .upd-my-info  { flex:1; min-width:0; }
  .upd-my-name  { font-size:14px; font-weight:700; color:#fff; }
  .upd-my-sub   { font-size:11px; color:#555; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .upd-my-badge { min-width:22px; height:22px; border-radius:11px; padding:0 6px; background:rgba(132,204,22,.15); border:1px solid rgba(132,204,22,.3); color:#84cc16; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  .upd-cards-scroll { display:flex; gap:10px; padding:10px 16px; overflow-x:auto; -webkit-overflow-scrolling:touch; flex-shrink:0; scrollbar-width:none; }
  .upd-cards-scroll::-webkit-scrollbar { height:0; }

  .upd-card { width:100px; flex-shrink:0; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,.07); background:#0d0d0d; cursor:pointer; transition:transform .15s; }
  .upd-card:hover { transform:translateY(-2px); }
  .upd-card-thumb { position:relative; height:140px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .upd-card-media { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .upd-card-text  { position:relative; z-index:1; font-size:10px; font-weight:700; text-align:center; padding:6px; word-break:break-word; line-height:1.3; }
  .upd-card-ov    { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.5),transparent); }
  .upd-card-footer { padding:7px 8px; background:#0a0a0a; }
  .upd-card-meta   { display:flex; justify-content:space-between; margin-bottom:5px; }
  .upd-card-actions { display:flex; justify-content:flex-end; gap:5px; }
  .upd-extend-btn { padding:2px 6px; border-radius:6px; background:rgba(245,158,11,.12); border:1px solid rgba(245,158,11,.3); color:#f59e0b; font-size:9px; font-weight:700; cursor:pointer; }
  .upd-del-btn    { width:22px; height:22px; border-radius:6px; background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.18); display:flex; align-items:center; justify-content:center; cursor:pointer; }

  .upd-section { font-size:10px; font-weight:700; color:#333; text-transform:uppercase; letter-spacing:.8px; padding:10px 16px 3px; flex-shrink:0; }
  .upd-empty   { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:60px 24px; flex:1; }
`;

const MODAL_CSS = `
  @keyframes asMUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes uvSpin { to{transform:rotate(360deg)} }

  .as-ov     { position:fixed; inset:0; z-index:20001; background:rgba(0,0,0,.82); display:flex; align-items:flex-end; backdrop-filter:blur(6px); }
  .as-sheet  { width:100%; max-height:93vh; background:#080808; border:1px solid rgba(132,204,22,.12); border-radius:22px 22px 0 0; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; animation:asMUp .3s cubic-bezier(.34,1.4,.64,1); scrollbar-width:none; }
  .as-sheet::-webkit-scrollbar { display:none; }
  .as-pill   { width:36px; height:4px; border-radius:2px; background:rgba(255,255,255,.1); margin:12px auto 0; flex-shrink:0; }

  .as-hdr    { display:flex; align-items:center; justify-content:space-between; padding:14px 18px 10px; flex-shrink:0; }
  .as-title  { font-size:17px; font-weight:800; color:#fff; margin:0; }
  .as-title-c { flex:1; text-align:center; }
  .as-close  { width:32px; height:32px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); display:flex; align-items:center; justify-content:center; cursor:pointer; color:#555; }
  .as-back   { background:none; border:none; color:#84cc16; font-size:13px; font-weight:700; cursor:pointer; padding:0; }
  .as-err    { padding:8px 18px; color:#ef4444; font-size:13px; font-weight:600; flex-shrink:0; }

  .as-pick-grid { display:flex; flex-direction:column; gap:8px; padding:8px 18px 8px; }
  .as-pick-card { display:flex; align-items:center; gap:14px; padding:16px; border-radius:16px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); text-align:left; transition:background .15s,border-color .15s; width:100%; font-family:inherit; }
  .as-pick-card:not([disabled]):hover { background:rgba(255,255,255,.06); border-color:rgba(132,204,22,.25); }
  .as-pick-icon { width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .as-pt { background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.2); color:#84cc16; }
  .as-pp { background:rgba(96,165,250,.1);  border:1px solid rgba(96,165,250,.2);  color:#60a5fa; }
  .as-pv { background:rgba(192,132,252,.1); border:1px solid rgba(192,132,252,.2); color:#c084fc; }
  .as-pick-info  { flex:1; min-width:0; }
  .as-pick-label { display:block; font-size:15px; font-weight:700; color:#fff; margin-bottom:3px; }
  .as-pick-desc  { display:block; font-size:12px; color:#555; }
  .as-pick-arrow { color:#333; font-size:16px; flex-shrink:0; }

  .as-prog-wrap  { padding:4px 18px 8px; display:flex; flex-direction:column; gap:5px; flex-shrink:0; }
  .as-prog-bar   { height:4px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden; }
  .as-prog-fill  { height:100%; background:linear-gradient(90deg,#84cc16,#a3e635); border-radius:2px; transition:width .3s; }
  .as-prog-label { font-size:12px; color:#84cc16; font-weight:600; text-align:center; }

  .as-preview    { height:185px; margin:0 18px; border-radius:16px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; flex-shrink:0; }
  .as-overlay-text { position:absolute; bottom:0; left:0; right:0; padding:14px; font-size:14px; font-weight:700; text-align:center; background:linear-gradient(to top,rgba(0,0,0,.75),transparent); word-break:break-word; margin:0; }
  .as-placeholder  { font-size:14px; color:rgba(255,255,255,.2); text-align:center; padding:0 20px; font-style:italic; }

  .as-inp-wrap { display:flex; align-items:flex-start; gap:8px; padding:10px 18px; flex-shrink:0; }
  .as-textarea { flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:14px; color:#fff; font-size:14px; padding:12px 14px; resize:none; outline:none; caret-color:#84cc16; min-height:72px; max-height:110px; line-height:1.5; font-family:inherit; transition:border-color .18s; }
  .as-textarea:focus { border-color:rgba(132,204,22,.3); }
  .as-textarea::placeholder { color:#333; }
  .as-char-ring { display:flex; flex-direction:column; align-items:center; gap:3px; flex-shrink:0; }

  .as-section-lbl { font-size:10px; font-weight:700; color:#333; text-transform:uppercase; letter-spacing:.8px; padding:4px 18px 6px; flex-shrink:0; }
  .as-bg-row { display:flex; gap:8px; padding:0 18px 10px; overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
  .as-bg-row::-webkit-scrollbar { display:none; }
  .as-bg-sw  { width:38px; height:38px; border-radius:10px; border:2px solid transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
  .as-bg-sw.as-bg-on { border-color:#fff; box-shadow:0 0 0 2px rgba(132,204,22,.4); }
  .as-bg-page { width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); color:#666; font-size:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }

  .as-color-row { display:flex; gap:8px; padding:0 18px 12px; overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
  .as-color-row::-webkit-scrollbar { display:none; }
  .as-color-dot { width:28px; height:28px; border-radius:50%; border:2px solid rgba(255,255,255,.1); cursor:pointer; flex-shrink:0; transition:all .12s; }
  .as-color-dot.as-dot-on { border-color:#fff; box-shadow:0 0 0 3px rgba(132,204,22,.4); }

  .as-cta { margin:8px 18px 6px; padding:14px; border-radius:16px; background:linear-gradient(135deg,rgba(132,204,22,.18),rgba(101,163,13,.12)); border:1px solid rgba(132,204,22,.35); color:#84cc16; font-size:15px; font-weight:700; cursor:pointer; transition:all .15s; display:block; width:calc(100% - 36px); font-family:inherit; }
  .as-cta:disabled { opacity:.35; cursor:not-allowed; }

  .as-dur-preview { height:130px; margin:0 18px; border-radius:16px; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; }
  .as-dur-hint    { font-size:13px; color:#555; text-align:center; padding:10px 24px 4px; margin:0; flex-shrink:0; }
  .as-dur-cards   { display:flex; flex-direction:column; gap:8px; padding:4px 18px; flex-shrink:0; }
  .as-dur-card    { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); cursor:pointer; text-align:left; transition:background .15s,border-color .15s; position:relative; width:100%; font-family:inherit; }
  .as-dur-on      { background:rgba(132,204,22,.08) !important; border-color:rgba(132,204,22,.35) !important; }
  .as-dur-time    { font-size:18px; font-weight:800; color:#fff; min-width:42px; }
  .as-dur-on .as-dur-time { color:#84cc16; }
  .as-dur-desc    { font-size:12px; color:#555; flex:1; }
  .as-dur-check   { position:absolute; right:14px; top:50%; transform:translateY(-50%); width:24px; height:24px; border-radius:50%; background:#84cc16; display:flex; align-items:center; justify-content:center; color:#000; }
  .as-dur-expiry  { display:flex; align-items:center; gap:6px; font-size:11px; color:#444; padding:8px 18px; flex-shrink:0; }

  .as-share-btn { display:flex; align-items:center; justify-content:center; gap:10px; margin:10px 18px; padding:15px; border-radius:16px; background:linear-gradient(135deg,#84cc16,#65a30d); border:none; color:#000; font-size:15px; font-weight:800; cursor:pointer; transition:all .15s; font-family:inherit; }
  .as-share-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(132,204,22,.35); }
  .as-share-btn.as-saving,.as-share-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
  .as-spinner { width:16px; height:16px; border:2px solid rgba(0,0,0,.2); border-top-color:#000; border-radius:50%; animation:uvSpin .7s linear infinite; display:inline-block; }
`;