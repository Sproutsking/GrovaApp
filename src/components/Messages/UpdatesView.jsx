// components/Messages/UpdatesView.jsx — NOVA UPDATES v8 COMPLETE
// ============================================================================
// ARCHITECTURE:
//  UPLOADS:   statusUpdateService.uploadMedia() — Cloudinary-based, NO Supabase
//             storage bucket needed. Fixes "Bucket not found" permanently.
//  LIKES:     status_likes table ONLY. Zero impact on post_likes/reel_likes.
//  REPLY→DM:  dmMessageService.createConversation + sendMessage. Reply lives
//             in DM chat forever, even after status expires.
//  VIEWER:    Mobile = fullscreen. Desktop = card-peek. Per-segment rings.
//  VIEWS:     Shown ONLY to status owner. Like + Reply shown to everyone.
//  BADGES:    registerUpdatesBadgeSetter exports unseen count to DMMessagesView.
//  NO CHANNELS: Channels section removed entirely.
// ============================================================================

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from "react";
import { supabase }            from "../../services/config/supabase";
import statusUpdateService, {
  isVideoStatus,
}                              from "../../services/messages/statusUpdateService";
import mediaUrlService         from "../../services/shared/mediaUrlService";
import dmMessageService        from "../../services/messages/dmMessageService";

// ── Badge export ──────────────────────────────────────────────────────────────
let _badgeSetter = null;
export const registerUpdatesBadgeSetter = (fn) => { _badgeSetter = fn; };

// ── Constants ─────────────────────────────────────────────────────────────────
const STORY_DURATION = 6000; // ms per status in viewer
const CHAR_MAX       = 280;

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
  { h:6,  label:"6h",  sub:"Gone quickly" },
  { h:12, label:"12h", sub:"Half a day"   },
  { h:18, label:"18h", sub:"Most of the day" },
  { h:24, label:"24h", sub:"Full day"     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtRel = (iso) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000)    return "just now";
  if (ms < 3600000)  return `${Math.floor(ms/60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms/3600000)}h ago`;
  return `${Math.floor(ms/86400000)}d ago`;
};

const fmtCountdown = (exp) => {
  const ms = new Date(exp).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const getSeenKey  = (uid) => `uv_seen_${uid}`;
const getMediaUrl = (imageId) => {
  if (!imageId) return null;
  try {
    const url = statusUpdateService.getMediaUrl?.(imageId)
      || mediaUrlService.getImageUrl?.(imageId)
      || mediaUrlService.getAvatarUrl?.(imageId, 800);
    return (url && typeof url === "string" && url.startsWith("http")) ? url : null;
  } catch { return null; }
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic = {
  Heart:    ({ f }) => <svg width="17" height="17" viewBox="0 0 24 24" fill={f?"#ef4444":"none"} stroke={f?"#ef4444":"currentColor"} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Reply:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>,
  Eye:      () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Send:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Close:    () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Plus:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Pause:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Clock:    () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Trash:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Check:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Verified: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="#60a5fa"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Camera:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Video:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Type:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  SoundOn:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
  SoundOff: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
  ChevL:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevR:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

// ── Avatar ─────────────────────────────────────────────────────────────────────
const UAv = memo(({ user, size = 50, ring = false, nearExp = false }) => {
  const [err, setErr] = useState(false);
  const avId   = user?.avatar_id || user?.avatarId;
  const url    = !err && avId
    ? (mediaUrlService.getAvatarUrl?.(avId, 200) || null)
    : null;
  const safeUrl = (url && typeof url === "string" && url.startsWith("http")) ? url : null;
  const ini    = (user?.full_name || user?.username || "?").charAt(0).toUpperCase();
  const ringColor = nearExp ? "#f59e0b" : "#84cc16";

  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", overflow:"hidden",
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#0d0d0d,#1c1c1c)",
      border:ring ? `2.5px solid ${ringColor}` : "2px solid rgba(132,204,22,.2)",
      flexShrink:0, fontSize:size*.4, fontWeight:800, color:"#84cc16",
      boxSizing:"border-box",
    }}>
      {safeUrl
        ? <img src={safeUrl} alt={ini} onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        : <span>{ini}</span>
      }
    </div>
  );
});
UAv.displayName = "UAv";

// ── Status Thumbnail with segmented ring ──────────────────────────────────────
const StatusThumb = memo(({ statuses: sts, profile, isMe = false, onClick }) => {
  const [err, setErr] = useState(false);
  const count  = sts.length;
  const first  = sts[0];
  const mu     = getMediaUrl(first?.image_id);
  const isVid  = isVideoStatus(first);
  const SIZE   = 64;
  const R      = 29;
  const STROKE = 2.8;
  const GAP    = count > 1 ? 6 : 0;
  const totalDeg = 360 - GAP * count;
  const segDeg   = count > 0 ? totalDeg / count : 360;
  const circum   = 2 * Math.PI * R;
  const segLen   = (segDeg / 360) * circum;

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}
      onClick={onClick}>
      <div style={{position:"relative",width:SIZE,height:SIZE}}>
        <svg width={SIZE} height={SIZE} style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}}>
          {count > 0
            ? Array.from({length:count}).map((_,i)=>{
                const off = (i*(segDeg+GAP)/360)*circum;
                return (
                  <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
                    stroke={isMe?"#60a5fa":"#84cc16"} strokeWidth={STROKE}
                    strokeDasharray={`${segLen} ${circum-segLen}`}
                    strokeDashoffset={-off} strokeLinecap="round" opacity={.9}/>
                );
              })
            : <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
                stroke="rgba(132,204,22,.35)" strokeWidth={STROKE} strokeDasharray="4 4"/>
          }
        </svg>
        <div style={{position:"absolute",inset:STROKE+2,borderRadius:"50%",overflow:"hidden",
          background:"linear-gradient(135deg,#0d0d0d,#1c1c1c)",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          {mu && !isVid && !err
            ? <img src={mu} alt="" onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : mu && isVid
              ? <div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:18}}>▶</span></div>
              : first?.bg
                ? <div style={{width:"100%",height:"100%",background:first.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:10,color:first.text_color||"#84cc16",textAlign:"center",padding:"2px 4px"}}>{first.text?.slice(0,14)}</span>
                  </div>
                : <UAv user={profile} size={SIZE-(STROKE+2)*2}/>
          }
          {isMe && count === 0 && (
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#84cc16"}}>
              <Ic.Plus/>
            </div>
          )}
        </div>
        {count > 1 && (
          <div style={{position:"absolute",bottom:0,right:0,width:16,height:16,borderRadius:"50%",
            background:isMe?"#60a5fa":"#84cc16",border:"1.5px solid #000",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:9,fontWeight:800,color:"#000",zIndex:2}}>
            {count}
          </div>
        )}
      </div>
      <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.55)",
        maxWidth:64,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {isMe ? "My status" : (profile?.full_name||"?").split(" ")[0]}
      </span>
    </div>
  );
});
StatusThumb.displayName = "StatusThumb";

// ════════════════════════════════════════════════════════════════════════════
// STORY VIEWER — Mobile fullscreen + Desktop card-peek
// ════════════════════════════════════════════════════════════════════════════
const StoryViewer = memo(({
  allGroups, startGroupIdx, startStoryIdx,
  currentUser, userId, onClose, onDmReply,
  likedIds, onToggleLike,
}) => {
  const [gIdx,     setGIdx]     = useState(startGroupIdx);
  const [sIdx,     setSIdx]     = useState(startStoryIdx);
  const [prog,     setProg]     = useState(0);
  const [paused,   setPaused]   = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [showRep,  setShowRep]  = useState(false);
  const [repTxt,   setRepTxt]   = useState("");
  const [sending,  setSending]  = useState(false);
  const [repDone,  setRepDone]  = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769);

  const timerRef  = useRef(null);
  const videoRef  = useRef(null);

  const group   = allGroups[gIdx];
  const story   = group?.statuses?.[sIdx];
  const isMyStory = group?.isMe || story?.user_id === userId;
  const isVid   = isVideoStatus(story) || story?.media_type === "video";
  const mediaUrl= getMediaUrl(story?.image_id);
  const isLiked = likedIds.has(story?.id || "");

  useEffect(()=>{
    const r = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize",r,{passive:true});
    return ()=>window.removeEventListener("resize",r);
  },[]);

  // Mark seen on story change
  useEffect(()=>{
    if (!story) return;
    setProg(0); setRepDone(false); setRepTxt(""); setShowRep(false);
    // Record view via statusUpdateService
    if (!isMyStory) {
      try { statusUpdateService.recordView?.(story.id, userId, story.user_id); } catch {}
    }
  }, [gIdx, sIdx]); // eslint-disable-line

  // Sync video mute
  useEffect(()=>{
    if (videoRef.current) {
      videoRef.current.muted = muted;
      if (!paused) videoRef.current.play().catch(()=>{});
      else videoRef.current.pause();
    }
  },[muted, paused]);

  // Progress timer (skip for video)
  useEffect(()=>{
    if (paused || isVid || showRep) { clearInterval(timerRef.current); return; }
    const step = (50/STORY_DURATION)*100;
    timerRef.current = setInterval(()=>{
      setProg(p=>{
        if (p>=100) { clearInterval(timerRef.current); advance(); return 0; }
        return Math.min(p+step, 100);
      });
    }, 50);
    return ()=>clearInterval(timerRef.current);
  }, [gIdx, sIdx, paused, isVid, showRep]); // eslint-disable-line

  const advance = useCallback(()=>{
    const g = allGroups[gIdx];
    if (!g) { onClose(); return; }
    if (sIdx < g.statuses.length-1) { setSIdx(s=>s+1); setProg(0); }
    else if (gIdx < allGroups.length-1) { setGIdx(g=>g+1); setSIdx(0); setProg(0); }
    else onClose();
  },[gIdx, sIdx, allGroups, onClose]);

  const retreat = useCallback(()=>{
    if (sIdx > 0) { setSIdx(s=>s-1); setProg(0); }
    else if (gIdx > 0) { setGIdx(g=>g-1); setSIdx(0); setProg(0); }
  },[gIdx, sIdx]);

  // ✅ Reply → DM
  const handleReply = async () => {
    if (!repTxt.trim() || sending || !story?.user_id || story.user_id===userId) return;
    setSending(true);
    try {
      await onDmReply({ replyText: repTxt.trim(), status: story });
      setRepTxt(""); setShowRep(false); setRepDone(true);
      setTimeout(()=>setRepDone(false), 3500);
    } catch (e) { console.warn("[StoryViewer] reply:", e.message); }
    finally { setSending(false); }
  };

  if (!story) return null;

  const bgStyle = story.bg
    ? { background: story.bg }
    : (mediaUrl) ? { background: "#000" }
    : { background: "linear-gradient(145deg,#0d1117,#1a2332)" };

  // Progress bars component
  const ProgressBars = ({ allSts }) => (
    <div style={{display:"flex",gap:3,width:"100%"}}>
      {allSts.map((_,i)=>(
        <div key={i} style={{flex:1,height:2.5,background:"rgba(255,255,255,.3)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:"#fff",
            width: i<sIdx ? "100%" : i===sIdx ? (isVid?"50%":`${prog}%`) : "0%"}}/>
        </div>
      ))}
    </div>
  );

  // Actions bar
  const ActionsBar = ({ compact=false }) => (
    <div style={{display:"flex",alignItems:"center",gap:compact?8:12}}>
      {/* Views — owner only */}
      {isMyStory && (
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"rgba(255,255,255,.55)"}}>
          <Ic.Eye/> <span>{story.views||0}</span>
        </div>
      )}
      {/* Likes — everyone */}
      <button onClick={()=>onToggleLike(story.id, isLiked)}
        style={{display:"flex",alignItems:"center",gap:5,padding:compact?"5px 10px":"8px 14px",
          borderRadius:24,background:isLiked?"rgba(239,68,68,.15)":"rgba(0,0,0,.5)",
          border:isLiked?"1px solid rgba(239,68,68,.35)":"1px solid rgba(255,255,255,.2)",
          color:isLiked?"#ef4444":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
        <Ic.Heart f={isLiked}/>
        <span>{story.likes||0}</span>
      </button>
      {/* Reply (DM) — everyone except owner */}
      {!isMyStory && (
        <button onClick={()=>{setShowRep(r=>!r); setPaused(true);}}
          style={{display:"flex",alignItems:"center",gap:5,padding:compact?"5px 10px":"8px 14px",
            borderRadius:24,background:"rgba(0,0,0,.5)",border:"1px solid rgba(255,255,255,.2)",
            color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          <Ic.Reply/><span>Reply</span>
        </button>
      )}
    </div>
  );

  // Reply input
  const ReplyInput = () => showRep ? (
    <div style={{display:"flex",gap:8,paddingTop:8}}>
      <input value={repTxt} onChange={e=>setRepTxt(e.target.value)}
        autoFocus placeholder={`Reply to ${story.profile?.full_name?.split(" ")[0]||""}… → goes to DM`}
        onKeyDown={e=>e.key==="Enter"&&handleReply()}
        disabled={sending}
        style={{flex:1,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",
          borderRadius:24,color:"#fff",fontSize:13,padding:"10px 16px",outline:"none",caretColor:"#84cc16"}}/>
      <button onClick={handleReply} disabled={!repTxt.trim()||sending}
        style={{width:40,height:40,borderRadius:"50%",background:"#84cc16",border:"none",
          color:"#000",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
        {sending ? <span style={{width:14,height:14,border:"2px solid rgba(0,0,0,.3)",borderTopColor:"#000",borderRadius:"50%",animation:"svSpin .7s linear infinite",display:"block"}}/> : <Ic.Send/>}
      </button>
      <button onClick={()=>{setShowRep(false);setPaused(false);}}
        style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Ic.Close/>
      </button>
    </div>
  ) : null;

  // Media content
  const MediaContent = ({ fullH=false }) => {
    if (isVid && mediaUrl) return (
      <video ref={videoRef} src={mediaUrl} autoPlay loop playsInline muted={muted}
        onTimeUpdate={e=>{
          const v = e.currentTarget;
          if (v.duration) {
            const p = (v.currentTime/v.duration)*100;
            setProg(p);
            if (p>=99) advance();
          }
        }}
        style={{width:"100%",height:fullH?"100%":"auto",objectFit:fullH?"cover":"contain",
          display:"block",maxHeight:fullH?"100%":420}}/>
    );
    if (mediaUrl) return (
      <img src={mediaUrl} alt=""
        style={{width:"100%",height:fullH?"100%":"auto",objectFit:fullH?"cover":"contain",
          display:"block",maxHeight:fullH?"100%":480}}/>
    );
    return (
      <div style={{width:"100%",height:fullH?"100%":300,minHeight:200,
        background:story.bg||"linear-gradient(145deg,#0d1117,#1a2332)",
        display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
        <p style={{fontSize:story.text?.length>100?18:story.text?.length>50?22:26,fontWeight:700,
          color:story.text_color||"#fff",textAlign:"center",lineHeight:1.4,margin:0,wordBreak:"break-word"}}>
          {story.text}
        </p>
      </div>
    );
  };

  // ── MOBILE: fullscreen ────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{position:"fixed",inset:0,zIndex:99999,background:"#000",display:"flex",flexDirection:"column"}}>
        <style>{`@keyframes svSpin{to{transform:rotate(360deg)}}`}</style>

        {/* Progress */}
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,
          padding:"calc(env(safe-area-inset-top,0px)+8px) 12px 6px",
          background:"linear-gradient(180deg,rgba(0,0,0,.7),transparent)"}}>
          <ProgressBars allSts={group?.statuses||[]}/>
        </div>

        {/* Header */}
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,
          display:"flex",alignItems:"center",gap:10,
          padding:"calc(env(safe-area-inset-top,0px)+24px) 14px 8px"}}>
          <UAv user={story.profile||group.user} size={36} ring/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:4}}>
              {story.profile?.full_name||group.user?.full_name}
              {story.profile?.verified && <Ic.Verified/>}
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>{fmtRel(story.created_at)}</div>
          </div>
          {isVid && (
            <button onClick={()=>setMuted(m=>!m)}
              style={{width:30,height:30,borderRadius:"50%",background:"rgba(0,0,0,.5)",
                border:"1px solid rgba(255,255,255,.15)",color:"#fff",display:"flex",
                alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              {muted?<Ic.SoundOff/>:<Ic.SoundOn/>}
            </button>
          )}
          <button onClick={()=>setPaused(p=>!p)}
            style={{width:30,height:30,borderRadius:"50%",background:"rgba(0,0,0,.5)",
              border:"1px solid rgba(255,255,255,.15)",color:"#fff",display:"flex",
              alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            {paused?<Ic.Play/>:<Ic.Pause/>}
          </button>
          <button onClick={onClose}
            style={{width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.5)",
              border:"1px solid rgba(255,255,255,.15)",color:"#fff",display:"flex",
              alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            <Ic.Close/>
          </button>
        </div>

        {/* Media */}
        <div style={{flex:1,position:"relative",overflow:"hidden",...bgStyle}}
          onPointerDown={()=>setPaused(true)} onPointerUp={()=>setPaused(false)}>
          <MediaContent fullH/>
          {story.text && mediaUrl && (
            <div style={{position:"absolute",bottom:0,left:0,right:0,
              background:"linear-gradient(to top,rgba(0,0,0,.8),transparent)",padding:"28px 16px 16px"}}>
              <p style={{color:story.text_color||"#fff",fontSize:15,fontWeight:600,margin:0}}>{story.text}</p>
            </div>
          )}
          {/* Tap zones */}
          <button onClick={retreat} style={{position:"absolute",left:0,top:"10%",bottom:"20%",width:"35%",background:"transparent",border:"none",cursor:"pointer"}}/>
          <button onClick={advance} style={{position:"absolute",right:0,top:"10%",bottom:"20%",width:"35%",background:"transparent",border:"none",cursor:"pointer"}}/>
        </div>

        {/* Bottom actions */}
        <div style={{padding:"10px 14px calc(env(safe-area-inset-bottom,0px)+12px)",
          background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)"}}>
          {repDone && <div style={{display:"flex",alignItems:"center",gap:6,color:"#84cc16",fontSize:13,fontWeight:600,justifyContent:"center",padding:"4px 0 8px"}}>
            <Ic.Check/> Reply sent to DM ✓
          </div>}
          <ActionsBar/>
          <ReplyInput/>
        </div>
      </div>
    );
  }

  // ── DESKTOP: card-peek ────────────────────────────────────────────────────
  const prevGroup = allGroups[gIdx-1];
  const nextGroup = allGroups[gIdx+1];

  const PeekCard = ({g, side, onClick}) => {
    const s = g?.statuses?.[0];
    const mu = getMediaUrl(s?.image_id);
    return (
      <button onClick={onClick} style={{flexShrink:0,width:110,height:180,borderRadius:16,
        overflow:"hidden",border:"1px solid rgba(255,255,255,.08)",background:"#111",cursor:"pointer",
        opacity:.4,transform:side==="left"?"scale(.88) translateX(20px)":"scale(.88) translateX(-20px)",transition:"all .25s"}}>
        {mu
          ? <img src={mu} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <div style={{width:"100%",height:"100%",background:s?.bg||"#0d1a00",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:10,color:s?.text_color||"#84cc16",textAlign:"center",padding:8}}>
                {s?.text?.slice(0,35)}
              </span>
            </div>
        }
      </button>
    );
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,.9)",
      display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(16px)"}}>
      <style>{`@keyframes svSpin{to{transform:rotate(360deg)}}`}</style>

      <button onClick={onClose} style={{position:"absolute",top:20,right:20,width:40,height:40,
        borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",
        color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10}}>
        <Ic.Close/>
      </button>

      {/* Keyboard arrows */}
      <button onClick={retreat} disabled={gIdx===0&&sIdx===0}
        style={{position:"absolute",left:24,top:"50%",transform:"translateY(-50%)",width:44,height:44,
          borderRadius:"50%",background:gIdx>0||sIdx>0?"rgba(255,255,255,.1)":"transparent",
          border:"1px solid rgba(255,255,255,.1)",color:"#fff",display:"flex",
          alignItems:"center",justifyContent:"center",cursor:"pointer",
          opacity:gIdx>0||sIdx>0?1:0.2}}>
        <Ic.ChevL/>
      </button>
      <button onClick={advance}
        style={{position:"absolute",right:24,top:"50%",transform:"translateY(-50%)",width:44,height:44,
          borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.1)",
          color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
        <Ic.ChevR/>
      </button>

      <div style={{display:"flex",alignItems:"center",gap:12,maxWidth:820,width:"100%",padding:"0 80px"}}>
        {prevGroup
          ? <PeekCard g={prevGroup} side="left" onClick={retreat}/>
          : sIdx > 0
            ? <PeekCard g={group} side="left" onClick={retreat}/>
            : <div style={{width:110,flexShrink:0}}/>
        }

        {/* Main card */}
        <div style={{flex:"0 0 360px",maxWidth:360,background:"#050505",borderRadius:24,
          overflow:"hidden",border:"1px solid rgba(132,204,22,.18)",
          boxShadow:"0 40px 100px rgba(0,0,0,.95)",display:"flex",flexDirection:"column",
          height:620,position:"relative",...bgStyle}}>

          {/* Progress */}
          <div style={{display:"flex",gap:3,padding:"12px 14px 6px",flexShrink:0,
            background:"linear-gradient(180deg,rgba(0,0,0,.6),transparent)"}}>
            <ProgressBars allSts={group?.statuses||[]}/>
          </div>

          {/* Header */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 14px 8px",flexShrink:0}}>
            <UAv user={story.profile||group.user} size={34} ring/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",gap:4}}>
                {story.profile?.full_name||group.user?.full_name}
                {story.profile?.verified && <Ic.Verified/>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{fmtRel(story.created_at)}</div>
            </div>
            {isVid && (
              <button onClick={()=>setMuted(m=>!m)}
                style={{width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,.5)",
                  border:"1px solid rgba(255,255,255,.15)",color:"#fff",display:"flex",
                  alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                {muted?<Ic.SoundOff/>:<Ic.SoundOn/>}
              </button>
            )}
            <button onClick={()=>setPaused(p=>!p)}
              style={{width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,.5)",
                border:"1px solid rgba(255,255,255,.15)",color:"#fff",display:"flex",
                alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              {paused?<Ic.Play/>:<Ic.Pause/>}
            </button>
          </div>

          {/* Media */}
          <div style={{flex:1,overflow:"hidden",position:"relative"}}
            onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
            <MediaContent fullH/>
            {story.text && mediaUrl && (
              <div style={{position:"absolute",bottom:0,left:0,right:0,
                background:"linear-gradient(to top,rgba(0,0,0,.8),transparent)",padding:"24px 14px 12px"}}>
                <p style={{color:story.text_color||"#fff",fontSize:14,fontWeight:600,margin:0}}>{story.text}</p>
              </div>
            )}
            {/* Tap zones */}
            <button onClick={retreat} style={{position:"absolute",left:0,top:0,bottom:0,width:"35%",background:"transparent",border:"none",cursor:"pointer"}}/>
            <button onClick={advance} style={{position:"absolute",right:0,top:0,bottom:0,width:"35%",background:"transparent",border:"none",cursor:"pointer"}}/>
          </div>

          {/* Actions */}
          <div style={{padding:"10px 14px 14px",flexShrink:0,background:"rgba(0,0,0,.85)"}}>
            {repDone && <div style={{display:"flex",alignItems:"center",gap:6,color:"#84cc16",fontSize:12,fontWeight:600,marginBottom:8}}>
              <Ic.Check/> Reply sent to DM ✓
            </div>}
            <ActionsBar compact/>
            <ReplyInput/>
          </div>
        </div>

        {nextGroup
          ? <PeekCard g={nextGroup} side="right" onClick={advance}/>
          : sIdx < (group?.statuses?.length||1)-1
            ? <PeekCard g={group} side="right" onClick={advance}/>
            : <div style={{width:110,flexShrink:0}}/>
        }
      </div>
    </div>
  );
});
StoryViewer.displayName = "StoryViewer";

// ════════════════════════════════════════════════════════════════════════════
// ADD STATUS MODAL — Text | Photo | Video with multi-step flow
// ════════════════════════════════════════════════════════════════════════════
const AddStatusModal = memo(({ currentUser, onClose, onAdded }) => {
  const [step,   setStep]   = useState("pick");   // pick | compose | duration
  const [mode,   setMode]   = useState("text");   // text | photo | video
  const [text,   setText]   = useState("");
  const [bg,     setBg]     = useState(GRADIENTS[0]);
  const [bgPage, setBgPage] = useState(0);
  const [tcol,   setTcol]   = useState("#ffffff");
  const [dur,    setDur]    = useState(24);
  const [media,  setMedia]  = useState(null);  // { id, url, type }
  const [saving, setSaving] = useState(false);
  const [pct,    setPct]    = useState(0);
  const [err,    setErr]    = useState(null);
  const fileRef = useRef(null);

  const charPct  = Math.min((text.length/CHAR_MAX)*100, 100);
  const bgSlice  = GRADIENTS.slice(bgPage*5, bgPage*5+5);
  const canNext  = !!media || text.trim().length > 0;
  const expAt    = new Date(Date.now() + dur*3_600_000);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setErr(null);
    const isVid = f.type.startsWith("video/");
    const isImg = f.type.startsWith("image/");
    if (!isVid && !isImg) { setErr("Only images and videos are supported."); return; }
    const maxMb = isVid ? 100 : 20;
    if (f.size > maxMb*1024*1024) { setErr(`Too large — max ${maxMb}MB for ${isVid?"video":"image"}.`); return; }
    setSaving(true); setPct(0); setErr(null);
    statusUpdateService.uploadMedia(f, p=>setPct(p))
      .then(res => { setMedia(res); setStep("compose"); })
      .catch(e  => { setErr(`Upload failed: ${e.message}`); })
      .finally(()=>setSaving(false));
  }, []);

  const handleShare = async () => {
    if (saving || !canNext) return;
    setSaving(true);
    try {
      await statusUpdateService.create({
        userId:    currentUser.id,
        text:      text.trim() || null,
        bg:        media ? null : bg,
        textColor: tcol,
        duration:  dur,
        media,
      });
      onAdded?.(); onClose();
    } catch(e) {
      // Fallback: direct insert
      try {
        const row = {
          user_id:    currentUser.id,
          text:       text.trim() || null,
          bg:         media ? null : bg,
          text_color: tcol,
          duration_h: dur,
          expires_at: expAt.toISOString(),
          views: 0, likes: 0,
          media_type: media ? media.type : "text",
        };
        if (media?.id) row.image_id = media.id;
        const { error } = await supabase.from("status_updates").insert(row);
        if (error) throw error;
        onAdded?.(); onClose();
      } catch(e2) {
        setErr(`Could not share: ${e2.message}`);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-pill"/>

        {/* ── PICK ── */}
        {step==="pick" && (
          <>
            <div className="modal-hdr">
              <h3 className="modal-title">New Status</h3>
              <button className="modal-close" onClick={onClose}><Ic.Close/></button>
            </div>
            <div className="pick-grid">
              {[
                {icon:<Ic.Type/>, label:"Text",  desc:"Express yourself with words and color",cls:"pick-icon-text",  m:"text"},
                {icon:<Ic.Camera/>,label:"Photo", desc:"Full quality · JPG, PNG, WEBP up to 20MB",cls:"pick-icon-photo", m:"photo"},
                {icon:<Ic.Video/>, label:"Video", desc:"Full quality · MP4, MOV up to 100MB",cls:"pick-icon-video", m:"video"},
              ].map(({icon,label,desc,cls,m})=>(
                <button key={m} className="pick-card" onClick={()=>{
                  setMode(m);
                  if (m==="text") { setStep("compose"); }
                  else { if(fileRef.current){ fileRef.current.accept=m==="video"?"video/*":"image/*"; fileRef.current.click(); }}
                }}>
                  <div className={`pick-icon ${cls}`}>{icon}</div>
                  <div className="pick-info">
                    <span className="pick-label">{label}</span>
                    <span className="pick-desc">{desc}</span>
                  </div>
                  <span className="pick-arrow">→</span>
                </button>
              ))}
              <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}}
                onChange={e=>handleFile(e.target.files?.[0])} onClick={e=>{e.target.value="";}}/>
            </div>
            {saving && (
              <div className="upload-prog">
                <div className="upload-bar"><div className="upload-fill" style={{width:`${pct}%`}}/></div>
                <span className="upload-label">Uploading {pct}%…</span>
              </div>
            )}
            {err && <div className="modal-err">{err}</div>}
          </>
        )}

        {/* ── COMPOSE ── */}
        {step==="compose" && (
          <>
            <div className="modal-hdr">
              <button className="modal-back" onClick={()=>{ setMedia(null); setStep("pick"); }}>← Back</button>
              <span className="modal-title modal-title-c">{media?"Add Caption":"Write Status"}</span>
              <button className="modal-close" onClick={onClose}><Ic.Close/></button>
            </div>

            {/* Preview */}
            <div className="compose-preview" style={media?{background:"#000"}:{background:bg}}>
              {media?.type==="video" && <video src={media.url} muted autoPlay loop playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/>}
              {media?.type==="image" && <img src={media.url} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>}
              {text && <p className="compose-overlay-text" style={{color:tcol}}>{text}</p>}
              {!text && !media && <p className="compose-placeholder">Your status preview…</p>}
            </div>

            <div className="compose-inp-wrap">
              <textarea className="compose-textarea"
                placeholder={media?"Add a caption (optional)…":"What's on your mind?"}
                value={text} onChange={e=>setText(e.target.value)}
                maxLength={CHAR_MAX} autoFocus={!media}/>
              <div className="compose-char">
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2.5"/>
                  <circle cx="12" cy="12" r="10" fill="none"
                    stroke={charPct>90?"#ef4444":charPct>70?"#f59e0b":"#84cc16"}
                    strokeWidth="2.5"
                    strokeDasharray={`${2*Math.PI*10}`}
                    strokeDashoffset={`${2*Math.PI*10*(1-charPct/100)}`}
                    strokeLinecap="round"
                    style={{transform:"rotate(-90deg)",transformOrigin:"center",transition:"all .2s"}}/>
                </svg>
                <span style={{fontSize:11,color:charPct>90?"#ef4444":"#555"}}>{CHAR_MAX-text.length}</span>
              </div>
            </div>

            {!media && (
              <>
                <p className="compose-section-lbl">Background</p>
                <div className="bg-row">
                  {bgSlice.map((g,i)=>(
                    <button key={i} className={`bg-sw${bg===g?" bg-sw-on":""}`} style={{background:g}} onClick={()=>setBg(g)}>
                      {bg===g&&<Ic.Check/>}
                    </button>
                  ))}
                  <button className="bg-page" onClick={()=>setBgPage(p=>(p+1)%Math.ceil(GRADIENTS.length/5))}>
                    {bgPage<Math.ceil(GRADIENTS.length/5)-1?"→":"↺"}
                  </button>
                </div>
              </>
            )}

            <p className="compose-section-lbl">Text Color</p>
            <div className="color-row">
              {TEXT_COLORS.map(c=>(
                <button key={c} className={`color-dot${tcol===c?" color-dot-on":""}`}
                  style={{background:c}} onClick={()=>setTcol(c)}/>
              ))}
            </div>

            <button className="compose-cta" onClick={()=>setStep("duration")} disabled={!canNext}>
              Next: Set Duration →
            </button>
          </>
        )}

        {/* ── DURATION ── */}
        {step==="duration" && (
          <>
            <div className="modal-hdr">
              <button className="modal-back" onClick={()=>setStep("compose")}>← Back</button>
              <span className="modal-title modal-title-c">How long?</span>
              <button className="modal-close" onClick={onClose}><Ic.Close/></button>
            </div>
            <div className="dur-preview" style={media?{background:"#111",overflow:"hidden"}:{background:bg}}>
              {media?.type==="video"&&<video src={media.url} muted autoPlay loop playsInline style={{height:"100%",objectFit:"cover",width:"100%"}}/>}
              {media?.type==="image"&&<img src={media.url} alt="" style={{height:"100%",objectFit:"cover",width:"100%"}}/>}
              {!media&&text&&<p style={{color:tcol,fontSize:13,fontWeight:700,margin:0,padding:"0 12px",textAlign:"center"}}>{text.slice(0,60)}{text.length>60?"…":""}</p>}
            </div>
            <p className="dur-hint">Status disappears automatically after this time.</p>
            <div className="dur-cards">
              {DURATIONS.map(d=>(
                <button key={d.h} className={`dur-card${dur===d.h?" dur-on":""}`} onClick={()=>setDur(d.h)}>
                  <span className="dur-time">{d.label}</span>
                  <span className="dur-desc">{d.sub}</span>
                  {dur===d.h&&<span className="dur-check"><Ic.Check/></span>}
                </button>
              ))}
            </div>
            <div className="dur-expiry">
              <Ic.Clock/>
              <span>Expires {expAt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}, {expAt.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})}</span>
            </div>
            {err && <div className="modal-err">{err}</div>}
            <button className={`share-btn${saving?" saving":""}`} onClick={handleShare} disabled={saving||!canNext}>
              {saving ? <span className="sv-spinner"/> : <><Ic.Send/><span>Share Status</span></>}
            </button>
          </>
        )}
      </div>

      {/* ═══ STYLES ══════════════════════════════════════════════════════════ */}
      <style>{`
        .modal-ov{position:fixed;inset:0;z-index:20001;background:rgba(0,0,0,.8);display:flex;align-items:flex-end;backdrop-filter:blur(4px);}
        .modal-sheet{width:100%;max-height:92vh;background:#080808;border:1px solid rgba(132,204,22,.12);border-radius:22px 22px 0 0;overflow:hidden;display:flex;flex-direction:column;animation:msUp .3s cubic-bezier(.34,1.4,.64,1);}
        @keyframes msUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .modal-pill{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.1);margin:12px auto 0;flex-shrink:0;}
        .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;flex-shrink:0;}
        .modal-title{font-size:17px;font-weight:800;color:#fff;margin:0;}
        .modal-title-c{flex:1;text-align:center;}
        .modal-close{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#555;}
        .modal-back{background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer;}
        .modal-err{padding:8px 18px;color:#ef4444;font-size:13px;font-weight:600;flex-shrink:0;}
        .pick-grid{display:flex;flex-direction:column;gap:8px;padding:8px 18px 16px;overflow-y:auto;}
        .pick-card{display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);cursor:pointer;text-align:left;transition:background .15s,border-color .15s;width:100%;}
        .pick-card:hover{background:rgba(255,255,255,.06);border-color:rgba(132,204,22,.25);}
        .pick-icon{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .pick-icon-text{background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.2);color:#84cc16;}
        .pick-icon-photo{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);color:#60a5fa;}
        .pick-icon-video{background:rgba(192,132,252,.1);border:1px solid rgba(192,132,252,.2);color:#c084fc;}
        .pick-info{flex:1;min-width:0;}
        .pick-label{display:block;font-size:15px;font-weight:700;color:#fff;margin-bottom:3px;}
        .pick-desc{display:block;font-size:12px;color:#555;}
        .pick-arrow{color:#333;font-size:16px;flex-shrink:0;}
        .upload-prog{padding:4px 18px 8px;display:flex;flex-direction:column;gap:5px;flex-shrink:0;}
        .upload-bar{height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;}
        .upload-fill{height:100%;background:linear-gradient(90deg,#84cc16,#a3e635);border-radius:2px;transition:width .3s;}
        .upload-label{font-size:12px;color:#84cc16;font-weight:600;text-align:center;}
        .compose-preview{height:180px;margin:0 18px;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;flex-shrink:0;}
        .compose-overlay-text{position:absolute;bottom:0;left:0;right:0;padding:14px;font-size:14px;font-weight:700;text-align:center;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);word-break:break-word;}
        .compose-placeholder{font-size:14px;color:rgba(255,255,255,.2);text-align:center;padding:0 20px;font-style:italic;}
        .compose-inp-wrap{display:flex;align-items:flex-start;gap:8px;padding:10px 18px;flex-shrink:0;}
        .compose-textarea{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;color:#fff;font-size:14px;padding:12px 14px;resize:none;outline:none;caret-color:#84cc16;min-height:72px;line-height:1.5;font-family:inherit;}
        .compose-textarea:focus{border-color:rgba(132,204,22,.3);}
        .compose-textarea::placeholder{color:#333;}
        .compose-char{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;}
        .compose-section-lbl{font-size:10px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:.8px;padding:4px 18px 6px;flex-shrink:0;}
        .bg-row{display:flex;gap:8px;padding:0 18px 10px;overflow-x:auto;flex-shrink:0;}
        .bg-row::-webkit-scrollbar{height:0;}
        .bg-sw{width:38px;height:38px;border-radius:10px;border:2px solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .15s;}
        .bg-sw:hover{transform:scale(1.08);}
        .bg-sw.bg-sw-on{border-color:#fff;box-shadow:0 0 0 2px rgba(132,204,22,.4);}
        .bg-page{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#666;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
        .color-row{display:flex;gap:8px;padding:0 18px 12px;overflow-x:auto;flex-shrink:0;}
        .color-row::-webkit-scrollbar{height:0;}
        .color-dot{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.1);cursor:pointer;flex-shrink:0;transition:transform .15s;}
        .color-dot:hover{transform:scale(1.12);}
        .color-dot.color-dot-on{border-color:#fff;box-shadow:0 0 0 3px rgba(132,204,22,.4);}
        .compose-cta{margin:8px 18px 18px;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(132,204,22,.2),rgba(101,163,13,.14));border:1px solid rgba(132,204,22,.35);color:#84cc16;font-size:15px;font-weight:700;cursor:pointer;transition:all .15s;display:block;width:calc(100% - 36px);}
        .compose-cta:hover{background:linear-gradient(135deg,rgba(132,204,22,.28),rgba(101,163,13,.2));}
        .compose-cta:disabled{opacity:.35;cursor:not-allowed;}
        .dur-preview{height:130px;margin:0 18px;border-radius:16px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;}
        .dur-hint{font-size:13px;color:#555;text-align:center;padding:10px 24px 4px;margin:0;flex-shrink:0;}
        .dur-cards{display:flex;flex-direction:column;gap:8px;padding:4px 18px;flex:1;overflow-y:auto;}
        .dur-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);cursor:pointer;text-align:left;transition:background .15s,border-color .15s;position:relative;width:100%;}
        .dur-on{background:rgba(132,204,22,.08)!important;border-color:rgba(132,204,22,.35)!important;}
        .dur-time{font-size:18px;font-weight:800;color:#fff;min-width:42px;}
        .dur-on .dur-time{color:#84cc16;}
        .dur-desc{font-size:12px;color:#555;flex:1;}
        .dur-check{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:#84cc16;display:flex;align-items:center;justify-content:center;color:#000;}
        .dur-expiry{display:flex;align-items:center;gap:6px;font-size:11px;color:#444;padding:8px 18px;flex-shrink:0;}
        .share-btn{display:flex;align-items:center;justify-content:center;gap:10px;margin:10px 18px 20px;padding:15px;border-radius:16px;background:linear-gradient(135deg,#84cc16,#65a30d);border:none;color:#000;font-size:15px;font-weight:800;cursor:pointer;transition:all .15s;}
        .share-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(132,204,22,.35);}
        .share-btn:active{transform:scale(.98);}
        .share-btn.saving{opacity:.65;cursor:not-allowed;}
        .share-btn:disabled{opacity:.35;cursor:not-allowed;}
        .sv-spinner{width:16px;height:16px;border:2px solid rgba(0,0,0,.2);border-top-color:#000;border-radius:50%;animation:svSpin .7s linear infinite;display:inline-block;}
        @keyframes svSpin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
});
AddStatusModal.displayName = "AddStatusModal";

// ── Contact/Status list item ──────────────────────────────────────────────────
const ContactRow = memo(({ group, isSeen, onClick }) => {
  const first   = group.statuses[0];
  const mu      = getMediaUrl(first?.image_id);
  const isVid   = isVideoStatus(first);
  const preview = isVid ? "🎥 Video" : first?.image_id ? "📷 Photo"
    : first?.text?.slice(0,50) || "Status update";

  return (
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",
      borderBottom:"1px solid rgba(255,255,255,.04)",cursor:"pointer",transition:"background .15s",opacity:isSeen?.65:1}}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.025)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{position:"relative",flexShrink:0}}>
        <UAv user={group.user} size={48} ring={!isSeen}/>
        {/* Multi-update indicator */}
        {group.statuses.length > 1 && (
          <div style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",
            background:"#84cc16",border:"1.5px solid #000",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:9,fontWeight:800,color:"#000",zIndex:2}}>
            {group.statuses.length}
          </div>
        )}
        {/* Media type badge */}
        {first?.image_id && (
          <div style={{position:"absolute",bottom:0,right:-2,width:16,height:16,borderRadius:"50%",
            background:"#000",border:"1px solid rgba(255,255,255,.15)",display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:9,zIndex:2}}>
            {isVid?"🎥":"📷"}
          </div>
        )}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:isSeen?"#666":"#fff",display:"flex",alignItems:"center",gap:4}}>
          {group.user?.full_name}
          {group.user?.verified && <Ic.Verified/>}
        </div>
        <div style={{fontSize:12,color:"#444",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {preview} · {fmtRel(first?.created_at)}
        </div>
      </div>
      {mu && first?.image_id && !isVid && (
        <div style={{width:42,height:42,borderRadius:10,overflow:"hidden",flexShrink:0}}>
          <img src={mu} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        </div>
      )}
      {!isSeen && <div style={{width:9,height:9,borderRadius:"50%",background:"#84cc16",flexShrink:0}}/>}
    </div>
  );
});
ContactRow.displayName = "ContactRow";

// ════════════════════════════════════════════════════════════════════════════
// MAIN UpdatesView
// ════════════════════════════════════════════════════════════════════════════
const UpdatesView = ({ currentUser, userId, onOpenDM }) => {
  const [myStatuses,  setMyStatuses]  = useState([]);
  const [feedGroups,  setFeedGroups]  = useState([]);
  const [likedIds,    setLikedIds]    = useState(new Set());
  const [loading,     setLoading]     = useState(true);
  const [viewer,      setViewer]      = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [extTarget,   setExtTarget]   = useState(null);
  const seenRef  = useRef(new Set());
  const mountRef = useRef(true);

  useEffect(()=>{
    try {
      const raw = localStorage.getItem(getSeenKey(userId));
      if (raw) seenRef.current = new Set(JSON.parse(raw));
    } catch {}
  }, [userId]);

  // ── Load statuses ─────────────────────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    if (!userId || !mountRef.current) return;
    try {
      let data = null;
      try {
        const { data:d, error:e } = await supabase
          .from("status_updates")
          .select(`id,text,bg,text_color,image_id,media_type,duration_h,views,likes,created_at,expires_at,user_id,
            profile:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)`)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending:false });
        if (e) throw e;
        data = d;
      } catch {
        // Fallback without media_type
        const { data:d2, error:e2 } = await supabase
          .from("status_updates")
          .select(`id,text,bg,text_color,image_id,duration_h,views,likes,created_at,expires_at,user_id,
            profile:profiles!status_updates_user_id_fkey(id,full_name,username,avatar_id,verified)`)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending:false });
        if (e2) throw e2;
        data = (d2||[]).map(s=>({...s, media_type:s.image_id?"image":"text"}));
      }
      if (!mountRef.current) return;

      const enriched = (data||[]).map(s=>({
        ...s,
        media_type: s.media_type || (s.image_id?(isVideoStatus(s)?"video":"image"):"text"),
      }));

      setMyStatuses(enriched.filter(s=>s.user_id===userId));
      const others = enriched.filter(s=>s.user_id!==userId);

      // Group others by user
      const map = new Map();
      others.forEach(s=>{
        if (!map.has(s.user_id)) map.set(s.user_id, { user:s.profile, statuses:[], hasUnseen:false });
        const seen = seenRef.current.has(s.id);
        if (!seen) map.get(s.user_id).hasUnseen = true;
        map.get(s.user_id).statuses.push({ ...s, _seen:seen });
      });
      const groups = Array.from(map.values()).sort((a,b)=>(b.hasUnseen?1:0)-(a.hasUnseen?1:0));
      setFeedGroups(groups);

      // Load liked IDs
      if (enriched.length > 0) {
        const { data:likeRows } = await supabase
          .from("status_likes").select("status_id")
          .eq("user_id", userId)
          .in("status_id", enriched.map(s=>s.id));
        if (mountRef.current && likeRows) {
          setLikedIds(new Set(likeRows.map(l=>l.status_id)));
        }
      }

      // Badge count
      const unseenCount = groups.filter(g=>g.hasUnseen).length;
      _badgeSetter?.(unseenCount);
    } catch(err) {
      console.warn("[UpdatesView] load:", err.message);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(()=>{
    mountRef.current = true;
    setLoading(true);
    loadStatuses();
    return ()=>{ mountRef.current = false; };
  },[loadStatuses]);

  // Listen for "dm:addStory"
  useEffect(()=>{
    const h = ()=>setShowAdd(true);
    document.addEventListener("dm:addStory", h);
    return ()=>document.removeEventListener("dm:addStory", h);
  },[]);

  // Real-time subscription
  useEffect(()=>{
    if (!userId) return;
    const ch = supabase.channel(`su_rt_${userId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"status_updates"},()=>loadStatuses())
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[userId, loadStatuses]);

  // ── Toggle Like (status_likes ONLY, no impact on post_likes) ─────────────
  const handleToggleLike = useCallback(async (statusId, isLiked) => {
    if (!userId || !statusId) return;
    // Optimistic
    setLikedIds(prev=>{ const n=new Set(prev); isLiked?n.delete(statusId):n.add(statusId); return n; });
    setMyStatuses(prev=>prev.map(s=>s.id===statusId?{...s,likes:Math.max(0,(s.likes||0)+(isLiked?-1:1))}:s));
    setFeedGroups(prev=>prev.map(g=>({...g,statuses:g.statuses.map(s=>s.id===statusId?{...s,likes:Math.max(0,(s.likes||0)+(isLiked?-1:1))}:s)})));

    try {
      if (isLiked) {
        await supabase.from("status_likes").delete().eq("status_id",statusId).eq("user_id",userId);
      } else {
        await supabase.from("status_likes").insert({status_id:statusId,user_id:userId}).select();
      }
      // Update count
      const { data:curr } = await supabase.from("status_updates").select("likes").eq("id",statusId).maybeSingle();
      if (curr) {
        await supabase.from("status_updates").update({likes:Math.max(0,(curr.likes||0)+(isLiked?-1:1))}).eq("id",statusId);
      }
    } catch {
      // Rollback
      setLikedIds(prev=>{ const n=new Set(prev); isLiked?n.add(statusId):n.delete(statusId); return n; });
    }
  }, [userId]);

  // ── Mark seen + record view ───────────────────────────────────────────────
  const markSeen = useCallback((statusId, ownerId) => {
    if (!statusId || seenRef.current.has(statusId)) return;
    seenRef.current.add(statusId);
    try { localStorage.setItem(getSeenKey(userId), JSON.stringify([...seenRef.current])); } catch {}
    if (ownerId !== userId) {
      try { statusUpdateService.recordView?.(statusId, userId, ownerId); } catch {}
    }
    setFeedGroups(prev=>prev.map(g=>({
      ...g,
      statuses: g.statuses.map(s=>s.id===statusId?{...s,_seen:true}:s),
      hasUnseen: g.statuses.some(s=>s.id!==statusId&&!s._seen),
    })));
  }, [userId]);

  // ── Reply → DM ────────────────────────────────────────────────────────────
  const handleDmReply = useCallback(async ({ replyText, status }) => {
    if (!replyText?.trim() || !status?.user_id || status.user_id===userId) return;
    try {
      const conv = await dmMessageService.createConversation(userId, status.user_id);
      const preview = status.text
        ? `"${status.text.slice(0,60)}${status.text.length>60?"…":""}"`
        : status.media_type==="video" ? "🎥 a video status" : "📷 a photo status";
      const msg = `↩ Replied to your status ${preview}:\n\n${replyText}`;
      await dmMessageService.sendMessage(conv.id, msg, userId);
      onOpenDM?.({ userId: status.user_id });
    } catch(e) {
      console.warn("[UpdatesView] DM reply failed:", e.message);
    }
  }, [userId, onOpenDM]);

  // ── Delete my status ──────────────────────────────────────────────────────
  const handleDelete = useCallback(async (sid) => {
    setMyStatuses(prev=>prev.filter(s=>s.id!==sid));
    try {
      await supabase.from("status_updates").delete().eq("id",sid).eq("user_id",userId);
    } catch {}
  }, [userId]);

  // ── Extend my status ──────────────────────────────────────────────────────
  const handleExtend = useCallback(async (sid, hours) => {
    const found = myStatuses.find(s=>s.id===sid);
    if (!found) return;
    const base   = new Date(Math.max(new Date(found.expires_at),Date.now()));
    const newExp = new Date(base.getTime()+hours*3_600_000).toISOString();
    try {
      await supabase.from("status_updates").update({expires_at:newExp}).eq("id",sid).eq("user_id",userId);
      loadStatuses();
    } catch {}
  }, [myStatuses, userId, loadStatuses]);

  // ── Build viewer groups ───────────────────────────────────────────────────
  const myUser = {
    id:userId,
    full_name:currentUser?.fullName||currentUser?.full_name||currentUser?.name||"You",
    avatar_id:currentUser?.avatarId||currentUser?.avatar_id,
  };
  const myGroup    = { user:myUser, statuses:myStatuses, isMe:true };
  const allGroups  = [myGroup, ...feedGroups];

  const openViewer = (groupIdx, storyIdx=0) => {
    const s = allGroups[groupIdx]?.statuses?.[storyIdx];
    if (s) markSeen(s.id, s.user_id || allGroups[groupIdx]?.user?.id);
    setViewer({ groupIdx, storyIdx });
  };

  const unseenGroups = feedGroups.filter(g=>g.hasUnseen);
  const seenGroups   = feedGroups.filter(g=>!g.hasUnseen);
  const todayCount   = myStatuses.filter(s=>Date.now()-new Date(s.created_at)<86_400_000).length;
  const isNearExp    = (exp) => { const ms=new Date(exp).getTime()-Date.now(); return ms>0&&ms<3600000; };

  return (
    <div className="upd-root">

      {/* ── Ring tray ── */}
      <div className="upd-tray">
        {[
          { group:myGroup, isMe:true, onClick:()=>myStatuses.length>0?openViewer(0):setShowAdd(true) },
          ...feedGroups.map((g,i)=>({ group:g, isMe:false, onClick:()=>openViewer(i+1) }))
        ].map(({group,isMe,onClick},i)=>(
          <StatusThumb key={i} statuses={group.statuses} profile={group.user} isMe={isMe} onClick={onClick}/>
        ))}
        {loading && [0,1,2,3].map(i=>(
          <div key={i} style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,255,255,.04)",
            animation:`updPulse 1.4s ${i*.15}s ease-in-out infinite`,flexShrink:0}}/>
        ))}
      </div>

      {/* ── My Status row ── */}
      <div className="my-row">
        <div className="my-row-left" onClick={()=>myStatuses.length>0?openViewer(0):setShowAdd(true)}>
          <div className="my-av-wrap">
            <UAv user={myUser} size={50} ring={myStatuses.length>0}/>
            <button className="my-add-btn" onClick={e=>{e.stopPropagation();setShowAdd(true);}}>
              <Ic.Plus/>
            </button>
          </div>
          <div className="my-info">
            <div className="my-name">My Status</div>
            <div className="my-sub">
              {myStatuses.length>0?`${myStatuses.length} active update${myStatuses.length>1?"s":""}· tap to view`:"Tap + to add your status"}
            </div>
          </div>
          {myStatuses.length>0&&<span className="my-badge">{myStatuses.length}</span>}
        </div>
      </div>

      {/* ── My status mini cards ── */}
      {myStatuses.length>0&&(
        <div className="my-cards-scroll">
          {myStatuses.map(s=>{
            const mu = getMediaUrl(s.image_id);
            const nearExp = isNearExp(s.expires_at);
            return (
              <div key={s.id} className="my-card" onClick={()=>openViewer(0,myStatuses.indexOf(s))}>
                <div className="my-card-thumb" style={s.bg?{background:s.bg}:{background:"#0d1117"}}>
                  {mu && (isVideoStatus(s)||s.media_type==="video")
                    ? <video src={mu} muted autoPlay loop playsInline className="my-card-thumb-img"/>
                    : mu ? <img src={mu} alt="" className="my-card-thumb-img"/>
                    : null}
                  {s.text&&<span className="my-card-thumb-text" style={{color:s.text_color||"#fff"}}>{s.text.slice(0,40)}</span>}
                  <div className="my-card-thumb-overlay"/>
                </div>
                <div className="my-card-footer">
                  <div className="my-card-meta">
                    <span style={{display:"flex",alignItems:"center",gap:2,color:nearExp?"#f59e0b":"#555"}}>
                      <Ic.Clock/> {fmtCountdown(s.expires_at)}
                    </span>
                    <span style={{display:"flex",alignItems:"center",gap:2,color:"#555"}}><Ic.Eye/> {s.views||0}</span>
                  </div>
                  <div className="my-card-actions">
                    {nearExp&&(
                      <button className="my-extend-btn" onClick={e=>{e.stopPropagation();setExtTarget(s);}}>+time</button>
                    )}
                    <button className="my-del-btn" onClick={e=>{e.stopPropagation();handleDelete(s.id);}}>
                      <Ic.Trash/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Others: Recent unseen ── */}
      {!loading && unseenGroups.length>0 && (
        <>
          <div className="section-lbl">Recent updates</div>
          {unseenGroups.map(g=>(
            <ContactRow key={g.user?.id} group={g} isSeen={false}
              onClick={()=>{ const idx=allGroups.indexOf(g); openViewer(idx<0?1:idx); }}/>
          ))}
        </>
      )}

      {/* ── Others: Viewed ── */}
      {!loading && seenGroups.length>0 && (
        <>
          <div className="section-lbl" style={{color:"#2a2a2a"}}>Viewed</div>
          {seenGroups.map(g=>(
            <ContactRow key={g.user?.id} group={g} isSeen
              onClick={()=>{ const idx=allGroups.indexOf(g); openViewer(idx<0?1:idx); }}/>
          ))}
        </>
      )}

      {/* ── Empty ── */}
      {!loading&&feedGroups.length===0&&(
        <div className="upd-empty">
          <div style={{fontSize:56}}>📡</div>
          <h3 style={{fontSize:20,fontWeight:800,color:"#fff",textAlign:"center",margin:0}}>No updates yet</h3>
          <p style={{fontSize:13,color:"#555",textAlign:"center",maxWidth:280,lineHeight:1.5,margin:0}}>
            Follow people to see their status updates here. Share yours too!
          </p>
          <button onClick={()=>setShowAdd(true)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"13px 24px",borderRadius:16,
              background:"linear-gradient(135deg,rgba(132,204,22,.2),rgba(101,163,13,.14))",
              border:"1px solid rgba(132,204,22,.35)",color:"#84cc16",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:8}}>
            <Ic.Plus/> Create Your First Status
          </button>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {loading&&(
        <div style={{padding:"8px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {[0,1,2,3,4].map(i=>(
            <div key={i} style={{height:72,borderRadius:14,background:"rgba(255,255,255,.03)",
              animation:`updPulse 1.4s ${i*.1}s ease-in-out infinite`}}/>
          ))}
        </div>
      )}

      {/* ── Extend modal ── */}
      {extTarget&&(
        <div style={{position:"fixed",inset:0,zIndex:20002,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"flex-end"}}>
          <div style={{width:"100%",background:"#0d0d0d",border:"1px solid rgba(245,158,11,.2)",
            borderRadius:"18px 18px 0 0",padding:"0 0 calc(env(safe-area-inset-bottom,0px)+16px)",
            animation:"msUp .25s cubic-bezier(.34,1.4,.64,1)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px 8px",fontSize:16,fontWeight:800,color:"#fff"}}>
              <span>⏳ Extend Status</span>
              <button onClick={()=>setExtTarget(null)} style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#555"}}>
                <Ic.Close/>
              </button>
            </div>
            <p style={{fontSize:13,color:"#666",padding:"0 18px 10px",margin:0}}>
              Currently: <strong style={{color:"#f59e0b"}}>{fmtCountdown(extTarget.expires_at)} remaining</strong>
            </p>
            {[3,6,12,24].map(h=>(
              <button key={h} onClick={()=>{handleExtend(extTarget.id,h);setExtTarget(null);}}
                style={{display:"block",width:"100%",padding:"13px 18px",background:"rgba(245,158,11,.06)",
                  border:"none",borderBottom:"1px solid rgba(255,255,255,.04)",color:"#f59e0b",
                  fontSize:15,fontWeight:700,textAlign:"left",cursor:"pointer"}}>
                + {h} hours
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Viewer ── */}
      {viewer&&(
        <StoryViewer
          allGroups={allGroups}
          startGroupIdx={viewer.groupIdx}
          startStoryIdx={viewer.storyIdx}
          currentUser={currentUser}
          userId={userId}
          onClose={()=>setViewer(null)}
          onDmReply={handleDmReply}
          likedIds={likedIds}
          onToggleLike={handleToggleLike}
        />
      )}

      {/* ── Add status ── */}
      {showAdd&&(
        <AddStatusModal
          currentUser={currentUser}
          onClose={()=>setShowAdd(false)}
          onAdded={()=>{ loadStatuses(); }}
        />
      )}

      <style>{`
        .upd-root{display:flex;flex-direction:column;height:100%;overflow-y:auto;background:#000;-webkit-overflow-scrolling:touch;}
        .upd-root::-webkit-scrollbar{width:3px;}
        .upd-root::-webkit-scrollbar-thumb{background:rgba(132,204,22,.2);border-radius:2px;}
        .upd-tray{display:flex;gap:10px;padding:12px 14px;overflow-x:auto;-webkit-overflow-scrolling:touch;border-bottom:1px solid rgba(255,255,255,.04);background:rgba(4,4,4,.6);flex-shrink:0;scrollbar-width:none;}
        .upd-tray::-webkit-scrollbar{display:none;}
        .my-row{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.04);flex-shrink:0;}
        .my-row-left{display:flex;align-items:center;gap:12px;cursor:pointer;flex:1;min-width:0;}
        .my-av-wrap{position:relative;flex-shrink:0;}
        .my-add-btn{position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:#84cc16;border:2px solid #000;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#000;}
        .my-add-btn svg{width:11px;height:11px;}
        .my-info{flex:1;min-width:0;}
        .my-name{font-size:14px;font-weight:700;color:#fff;}
        .my-sub{font-size:12px;color:#555;margin-top:2px;}
        .my-badge{min-width:22px;height:22px;border-radius:11px;padding:0 6px;background:rgba(132,204,22,.15);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .my-cards-scroll{display:flex;gap:10px;padding:10px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-shrink:0;scrollbar-width:none;}
        .my-cards-scroll::-webkit-scrollbar{height:0;}
        .my-card{width:100px;flex-shrink:0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#0d0d0d;cursor:pointer;transition:transform .15s;}
        .my-card:hover{transform:translateY(-2px);}
        .my-card-thumb{position:relative;height:140px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        .my-card-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .my-card-thumb-text{position:relative;z-index:1;font-size:11px;font-weight:700;text-align:center;padding:6px;word-break:break-word;line-height:1.3;}
        .my-card-thumb-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.5),transparent);}
        .my-card-footer{padding:7px 8px;background:#0a0a0a;}
        .my-card-meta{display:flex;justify-content:space-between;font-size:9px;margin-bottom:5px;}
        .my-card-actions{display:flex;justify-content:flex-end;gap:5px;}
        .my-extend-btn{padding:2px 6px;border-radius:6px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);color:#f59e0b;font-size:9px;font-weight:700;cursor:pointer;}
        .my-del-btn{width:22px;height:22px;border-radius:6px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;}
        .section-lbl{font-size:10px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:.8px;padding:10px 16px 3px;flex-shrink:0;}
        .upd-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:60px 24px;flex:1;}
        @keyframes updPulse{0%,100%{opacity:.5}50%{opacity:.12}}
      `}</style>
    </div>
  );
};

export default UpdatesView;