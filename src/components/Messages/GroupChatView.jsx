// components/Messages/GroupChatView.jsx — NOVA GROUP CHAT v6 COMPLETE
// ============================================================================
// v6 FEATURES:
//  [BG]       Chat backgrounds from BackgroundService (same as ChatView)
//  [SETTINGS] Settings modal (top-right) with rename, icon, AND delete group
//             Admin-only delete; members see read-only info + leave option
//  [MSG]      isSentByMe checks every id field — own messages always visible
//             Optimistic messages shown instantly with uid on both fields
//             subscribeToMessages DB-path no longer filters out sender's own msgs
//  [INPUT]    Emoji picker + GIF picker (Tenor+fallback) identical to ChatView
//  [LAYOUT]   Header padding 14px sides, safe-area top/bottom correct
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import groupDMService from "../../services/messages/groupDMService";
import mediaUrlService from "../../services/shared/mediaUrlService";
import backgroundService from "../../services/messages/BackgroundService";

// ─── GIF helpers ──────────────────────────────────────────────────────────────
const FALLBACK_GIFS = [
  { id:"f1",  url:"https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",  preview:"https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif",  tags:["hi","hello","hey","wave"] },
  { id:"f2",  url:"https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", preview:"https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif", tags:["lol","laugh","funny","haha"] },
  { id:"f3",  url:"https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif",   preview:"https://media.giphy.com/media/d2Z9QYzA2aidiWn6/200.gif",   tags:["fire","hot","amazing","wow"] },
  { id:"f4",  url:"https://media.giphy.com/media/xT9IgG50Lg7russbD6/giphy.gif", preview:"https://media.giphy.com/media/xT9IgG50Lg7russbD6/200.gif", tags:["clap","great","nice","good"] },
  { id:"f5",  url:"https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",  preview:"https://media.giphy.com/media/l3q2K5jinAlChoCLS/200.gif",  tags:["ok","fine","sure","alright"] },
  { id:"f6",  url:"https://media.giphy.com/media/fUSp9NJCKqHpBfxKvN/giphy.gif", preview:"https://media.giphy.com/media/fUSp9NJCKqHpBfxKvN/200.gif", tags:["sad","cry","no","miss"] },
  { id:"f7",  url:"https://media.giphy.com/media/l46CsHbZDSZKjsGNO/giphy.gif",  preview:"https://media.giphy.com/media/l46CsHbZDSZKjsGNO/200.gif",  tags:["yes","win","celebrate","yeah"] },
  { id:"f8",  url:"https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif",      preview:"https://media.giphy.com/media/ZqlvCTNHpqrio/200.gif",      tags:["love","heart","cute","sweet"] },
  { id:"f9",  url:"https://media.giphy.com/media/oGO1MPNUVbbk4/giphy.gif",      preview:"https://media.giphy.com/media/oGO1MPNUVbbk4/200.gif",      tags:["think","hmm","idk","wait"] },
  { id:"f10", url:"https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif",     preview:"https://media.giphy.com/media/11sBLVxNs7v6WA/200.gif",     tags:["deal","ok","agree","yes"] },
  { id:"f11", url:"https://media.giphy.com/media/ukMiDpZpm6B8/giphy.gif",       preview:"https://media.giphy.com/media/ukMiDpZpm6B8/200.gif",       tags:["party","celebrate","fun","woo"] },
  { id:"f12", url:"https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif", preview:"https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200.gif", tags:["no","stop","nope","bad"] },
];

const searchGifs = async (query, limit = 12) => {
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyC6bfxFR63-j8KFoiVHF4K5GKPZ5QLRHQE&limit=${limit}&media_filter=gif`);
    if (!res.ok) throw new Error("tenor");
    const d = await res.json();
    return (d.results||[]).map(r=>({
      id:r.id,
      url:r.media_formats?.gif?.url||r.media_formats?.tinygif?.url||"",
      preview:r.media_formats?.tinygif?.url||r.media_formats?.nanogif?.url||"",
    })).filter(g=>g.url);
  } catch {
    const q = query.toLowerCase();
    const f = FALLBACK_GIFS.filter(g=>g.tags.some(t=>q.includes(t)||t.includes(q)));
    return (f.length?f:FALLBACK_GIFS).slice(0,limit);
  }
};

// ─── Emoji data ───────────────────────────────────────────────────────────────
const EMOJI_CATS = {
  "⭐":["😂","🔥","❤️","👍","💀","🎉","😭","🤣","✨","💯","🫡","🙏","💪","🥹","😤","🫠","🤡","😎","🤯","🫶"],
  "😀":["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😋","😛","😜","🤪","😝","🤑","🤗","🤔","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😴","😷","🤒","🤕","🤧","🥵","🥶","😵","🤯","🥳","😎","😕","😮","😲","😳","🥺","😦","😧","😢","😭","😱","😞","😩","😫","😤","😡","💀","💩","🤡","👻","👽","🤖"],
  "👋":["👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","💪","🦾"],
  "❤️":["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟","♥️","❣️"],
  "🔥":["🔥","💫","⭐","🌟","✨","💥","❄️","🌈","☀️","🌊","🌙","⚡","💧","🌸","🌺","🍀","🎉","🎊","🎈","🎁","🏆","🥇","💎","🚀","🛸","🌍","🎯","💯","🔮","🌀"],
  "🍕":["🍕","🍔","🌮","🌯","🍜","🍣","🍰","🎂","🧁","🍩","🍦","☕","🧋","🍺","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🥤","🧃","🫖","🍫","🍬","🍭","🍿","🥜","🫘"],
  "✈️":["✈️","🚀","🛸","🚗","🚕","🏎","🏍","🛵","🚲","🛴","🚁","⛵","🚢","🏖","🏝","🏔","🗺","🌋","🏕","🏠","🏯","🗼","🎡","🎢"],
  "📱":["📱","💻","⌨️","🖥","🖨","🖱","📷","📸","🎥","📺","📻","🎙","⌚","🔋","🔌","💡","🔦","🕯","💸","💳","💰","💎","⚖️","🔧","🔨","⚙️","🔑","🗝","🔐","🔒","🚪"],
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  Back:     ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Send:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Smile:    ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  Gif:      ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 12h4M10 10v4"/><path d="M14 10h2a2 2 0 010 4h-2"/></svg>,
  Close:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Reply:    ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>,
  Users:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Settings: ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Camera:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Search:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  DblChk:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 11 9 5 5"/><polyline points="20 8 14 16 8 12"/></svg>,
  Down:     ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Trash:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>,
  Palette:  ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
  Leave:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const timeStr = ts => ts ? new Date(ts).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}) : "";

// ─── isSentByMe — checks every possible id field on both sides ────────────────
const isSentByMe = (msg, currentUser) => {
  if (!msg || !currentUser) return false;
  const myIds    = [currentUser.id, currentUser.uid, currentUser.userId].filter(Boolean).map(String);
  const senderIds= [msg.user_id, msg.sender_id, msg.user?.id, msg.userId, msg.senderId].filter(Boolean).map(String);
  return myIds.some(id => senderIds.includes(id));
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Av = memo(({ user, size=32 }) => {
  const [err, setErr] = useState(false);
  const id  = user?.avatar_id || user?.avatarId;
  const url = !err && id ? mediaUrlService.getAvatarUrl(id, 200) : null;
  const ini = (user?.full_name||user?.name||"?").charAt(0).toUpperCase();
  useEffect(()=>{
    if(url) mediaUrlService.preloadMediaUrl(url, { type: 'image', priority: 'high' });
  },[url]);
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#0d1a00,#1a3300)",border:"1.5px solid rgba(132,204,22,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:700,color:"#84cc16",overflow:"hidden",flexShrink:0}}>
      {url ? <img src={url} alt={ini} loading="eager" fetchPriority="high" onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini}
    </div>
  );
});
Av.displayName = "Av";

// ─── EmojiPicker ─────────────────────────────────────────────────────────────
const EmojiPicker = memo(({ onSelect, onClose }) => {
  const [cat, setCat] = useState("⭐");
  const [srch, setSrch] = useState("");
  const ref = useRef(null); const iRef = useRef(null);
  useEffect(()=>{ iRef.current?.focus(); },[]);
  useEffect(()=>{
    const h=e=>{if(!ref.current?.contains(e.target))onClose();};
    const t=setTimeout(()=>document.addEventListener("pointerdown",h),100);
    return()=>{clearTimeout(t);document.removeEventListener("pointerdown",h);};
  },[onClose]);
  const emojis = srch ? Object.values(EMOJI_CATS).flat().filter((e,i,a)=>a.indexOf(e)===i) : (EMOJI_CATS[cat]||[]);
  return (
    <div ref={ref} className="gcv-ep" onPointerDown={e=>e.stopPropagation()}>
      <div className="gcv-ep-sr"><Ic.Search/><input ref={iRef} value={srch} onChange={e=>setSrch(e.target.value)} placeholder="Search emoji…" className="gcv-ep-inp"/></div>
      {!srch&&<div className="gcv-ep-cats">{Object.keys(EMOJI_CATS).map(k=><button key={k} onClick={()=>setCat(k)} className={`gcv-ep-cb${cat===k?" gcv-ep-cb-on":""}`}>{k}</button>)}</div>}
      <div className="gcv-ep-grid">{emojis.map((e,i)=><button key={i} onClick={()=>onSelect(e)} className="gcv-ep-em" onMouseEnter={ev=>{ev.currentTarget.style.background="rgba(132,204,22,.15)";ev.currentTarget.style.transform="scale(1.2)";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";ev.currentTarget.style.transform="scale(1)";}}>{e}</button>)}</div>
    </div>
  );
});
EmojiPicker.displayName="EmojiPicker";

// ─── GifPicker ────────────────────────────────────────────────────────────────
const GifPicker = memo(({ onSelect, onClose }) => {
  const [q, setQ] = useState(""); const [gifs, setGifs] = useState(FALLBACK_GIFS.slice(0,8)); const [ld, setLd] = useState(false);
  const ref=useRef(null); const iRef=useRef(null); const tmr=useRef(null);
  const QUICK=["hi","lol","fire","love","yes","no","wow","party","thanks","ok","cool","sad"];
  useEffect(()=>{ iRef.current?.focus(); },[]);
  useEffect(()=>{
    const h=e=>{if(!ref.current?.contains(e.target))onClose();};
    const t=setTimeout(()=>document.addEventListener("pointerdown",h),100);
    return()=>{clearTimeout(t);document.removeEventListener("pointerdown",h);};
  },[onClose]);
  useEffect(()=>{
    if(q.length<2){setGifs(FALLBACK_GIFS.slice(0,12));return;}
    clearTimeout(tmr.current);
    tmr.current=setTimeout(async()=>{setLd(true);setGifs(await searchGifs(q));setLd(false);},400);
    return()=>clearTimeout(tmr.current);
  },[q]);
  return (
    <div ref={ref} className="gcv-gp" onPointerDown={e=>e.stopPropagation()}>
      <div className="gcv-gp-top">
        <div className="gcv-ep-sr"><Ic.Search/><input ref={iRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search GIFs…" className="gcv-ep-inp"/></div>
        <div className="gcv-gp-quick">{QUICK.map(k=><button key={k} onClick={()=>setQ(k)} className={`gcv-gp-chip${q===k?" gcv-gp-chip-on":""}`}>{k}</button>)}</div>
      </div>
      <div className="gcv-gp-grid">
        {ld&&<div style={{gridColumn:"1/-1",display:"flex",justifyContent:"center",padding:20}}><div className="gcv-spin"/></div>}
        {!ld&&gifs.map(g=><button key={g.id} onClick={()=>onSelect(g.url)} className="gcv-gp-item"><img src={g.preview||g.url} alt="" loading="lazy" className="gcv-gp-img" onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1);"}/></button>)}
      </div>
      <div style={{padding:"3px 10px 6px",fontSize:9,color:"#333",textAlign:"right"}}>Tenor · Giphy fallback</div>
    </div>
  );
});
GifPicker.displayName="GifPicker";

// ─── Settings Modal (replaces old GroupEditModal) ─────────────────────────────
// Admin sees: rename, icon picker, change background, DELETE group
// Member sees: group info, members list, LEAVE group
const SettingsModal = ({ group, currentUser, isAdmin, selectedBg, onBgChange, onSave, onDelete, onLeave, onClose }) => {
  const [page, setPage]   = useState("main"); // "main" | "bg" | "icon" | "confirm_delete" | "confirm_leave"
  const [name, setName]   = useState(group?.name||"");
  const [icon, setIcon]   = useState(group?.icon||"👥");
  const [imgSrc, setImg]  = useState(group?.icon_url||null);
  const [saving, setSave] = useState(false);
  const fileRef = useRef(null);
  const bgs = backgroundService.getBackgrounds();
  const ICONS = ["👥","🎮","📚","🏀","🎵","💼","🎨","🚀","⚡","🔥","🌍","🧠","💎","🎯","🏆","🌟","🎭","🎪","🛡","⚔️","🎋","🌺","🎀","🎊","🎉"];

  const handleImg = f => {
    if (!f||!f.type.startsWith("image/")) return;
    const r = new FileReader(); r.onload=e=>{setImg(e.target.result);setIcon("");};  r.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!name.trim()||saving) return;
    setSave(true);
    try {
      const updates = { name:name.trim(), icon: imgSrc?null:icon };
      if (imgSrc) updates.icon_url = imgSrc;
      await groupDMService.updateGroup(group.id, updates);
      onSave({...group,...updates});
    } catch(e){console.warn("[Settings]",e);}
    finally{ setSave(false); }
  };

  const members = Array.isArray(group?.members)?group.members:[];

  return (
    <div className="gcv-modal-ov" onClick={onClose}>
      <div className="gcv-modal" onClick={e=>e.stopPropagation()}>
        <div className="gcv-modal-pill"/>

        {/* ── MAIN PAGE ── */}
        {page==="main"&&<>
          <div className="gcv-modal-hd">
            <button className="gcv-modal-cancel" onClick={onClose}>Close</button>
            <span className="gcv-modal-title">Group Settings</span>
            {isAdmin
              ? <button className="gcv-modal-action" onClick={handleSave} disabled={!name.trim()||saving}>{saving?"Saving…":"Save"}</button>
              : <div style={{width:52}}/>
            }
          </div>

          <div className="gcv-modal-body">
            {/* Group avatar */}
            <div className="gcv-modal-av-wrap" onClick={()=>isAdmin&&fileRef.current?.click()} style={{cursor:isAdmin?"pointer":"default"}}>
              <div className="gcv-modal-av">
                {imgSrc?<img src={imgSrc} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:44}}>{icon}</span>}
              </div>
              {isAdmin&&<div className="gcv-modal-av-cam"><Ic.Camera/></div>}
              {isAdmin&&<input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e.target.files?.[0])}/>}
            </div>
            {isAdmin&&<p style={{fontSize:11,color:"#555",textAlign:"center",marginBottom:16}}>Tap to change photo</p>}

            {/* Group name */}
            {isAdmin
              ? <>
                  <p className="gcv-modal-label">Group Name</p>
                  <input value={name} onChange={e=>setName(e.target.value)} maxLength={60} className="gcv-modal-inp"/>
                </>
              : <div style={{fontSize:18,fontWeight:800,color:"#fff",textAlign:"center",marginBottom:16}}>{group?.name}</div>
            }

            {/* Settings rows */}
            <div className="gcv-settings-rows">
              {isAdmin&&(
                <button className="gcv-settings-row" onClick={()=>setPage("icon")}>
                  <span className="gcv-sr-left"><span style={{fontSize:18}}>🎨</span><span>Change Icon</span></span>
                  <span className="gcv-sr-chev">›</span>
                </button>
              )}
              <button className="gcv-settings-row" onClick={()=>setPage("bg")}>
                <span className="gcv-sr-left"><span style={{fontSize:18}}>🖼️</span><span>Chat Background</span></span>
                <span className="gcv-sr-chev">›</span>
              </button>
              <button className="gcv-settings-row" onClick={()=>setPage("members")}>
                <span className="gcv-sr-left"><span style={{fontSize:18}}>👥</span><span>Members ({members.length})</span></span>
                <span className="gcv-sr-chev">›</span>
              </button>
            </div>

            {/* Danger zone */}
            <div className="gcv-danger-zone">
              {isAdmin
                ? <button className="gcv-danger-btn gcv-btn-delete" onClick={()=>setPage("confirm_delete")}>
                    <Ic.Trash/> Delete Group
                  </button>
                : <button className="gcv-danger-btn gcv-btn-leave" onClick={()=>setPage("confirm_leave")}>
                    <Ic.Leave/> Leave Group
                  </button>
              }
            </div>
          </div>
        </>}

        {/* ── BACKGROUND PAGE ── */}
        {page==="bg"&&<>
          <div className="gcv-modal-hd">
            <button className="gcv-modal-cancel" onClick={()=>setPage("main")}>← Back</button>
            <span className="gcv-modal-title">Chat Background</span>
            <div style={{width:52}}/>
          </div>
          <div className="gcv-modal-body">
            <div className="gcv-bg-grid">
              {bgs.map((b,i)=>(
                <button key={i} className={`gcv-bg-opt${selectedBg===i?" gcv-bg-on":""}`}
                  onClick={()=>{onBgChange(i);setPage("main");}}>
                  {b.isDefault
                    ? <div className="gcv-bg-prev gcv-bg-grid-pat"/>
                    : b.image
                      ? <img src={b.image} alt={b.name} className="gcv-bg-prev" style={{objectFit:"cover"}}/>
                      : <div className="gcv-bg-prev" style={{background:b.value}}/>
                  }
                  <span className="gcv-bg-name">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>}

        {/* ── ICON PAGE ── */}
        {page==="icon"&&<>
          <div className="gcv-modal-hd">
            <button className="gcv-modal-cancel" onClick={()=>setPage("main")}>← Back</button>
            <span className="gcv-modal-title">Choose Icon</span>
            <div style={{width:52}}/>
          </div>
          <div className="gcv-modal-body">
            <div className="gcv-icon-grid">
              {ICONS.map(ic=>(
                <button key={ic} onClick={()=>{setIcon(ic);setImg(null);setPage("main");}}
                  className={`gcv-icon-btn${icon===ic?" gcv-icon-on":""}`}>{ic}</button>
              ))}
            </div>
          </div>
        </>}

        {/* ── MEMBERS PAGE ── */}
        {page==="members"&&<>
          <div className="gcv-modal-hd">
            <button className="gcv-modal-cancel" onClick={()=>setPage("main")}>← Back</button>
            <span className="gcv-modal-title">Members ({members.length})</span>
            <div style={{width:52}}/>
          </div>
          <div className="gcv-modal-body" style={{padding:0}}>
            {members.map(m=>m&&(
              <div key={m.id} className="gcv-member-row-full">
                <Av user={m} size={36}/>
                <div className="gcv-mrf-info">
                  <div className="gcv-mrf-name">{m.full_name||m.name||"?"}</div>
                  {m.is_admin&&<div className="gcv-mrf-admin">ADMIN</div>}
                </div>
                {String(m.id)===String(currentUser?.id||"")&&<span className="gcv-mrf-you">You</span>}
              </div>
            ))}
          </div>
        </>}

        {/* ── CONFIRM DELETE ── */}
        {page==="confirm_delete"&&<>
          <div className="gcv-modal-hd">
            <button className="gcv-modal-cancel" onClick={()=>setPage("main")}>Cancel</button>
            <span className="gcv-modal-title" style={{color:"#ef4444"}}>Delete Group</span>
            <div style={{width:52}}/>
          </div>
          <div className="gcv-modal-body" style={{alignItems:"center",textAlign:"center",paddingTop:32}}>
            <div style={{fontSize:52,marginBottom:16}}>🗑️</div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:8}}>Delete "{group?.name}"?</div>
            <div style={{fontSize:13,color:"#666",marginBottom:32,lineHeight:1.5}}>
              This will permanently delete the group and all messages for every member. This cannot be undone.
            </div>
            <button className="gcv-confirm-delete-btn" onClick={onDelete}>
              Yes, Delete Group
            </button>
          </div>
        </>}

        {/* ── CONFIRM LEAVE ── */}
        {page==="confirm_leave"&&<>
          <div className="gcv-modal-hd">
            <button className="gcv-modal-cancel" onClick={()=>setPage("main")}>Cancel</button>
            <span className="gcv-modal-title" style={{color:"#f97316"}}>Leave Group</span>
            <div style={{width:52}}/>
          </div>
          <div className="gcv-modal-body" style={{alignItems:"center",textAlign:"center",paddingTop:32}}>
            <div style={{fontSize:52,marginBottom:16}}>🚪</div>
            <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:8}}>Leave "{group?.name}"?</div>
            <div style={{fontSize:13,color:"#666",marginBottom:32,lineHeight:1.5}}>
              You will no longer receive messages from this group.
            </div>
            <button className="gcv-confirm-leave-btn" onClick={onLeave}>
              Yes, Leave Group
            </button>
          </div>
        </>}
      </div>
    </div>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MsgBubble = memo(({ msg, isMe, prevSame, nextSame, members, onReply, onReact }) => {
  const [showActions, setShowActions] = useState(false);
  const [hovered, setHovered]         = useState(false);
  const longRef = useRef(null);
  const isGif   = msg.content?.startsWith("__GIF__:");
  const gifUrl  = isGif ? msg.content.replace("__GIF__:","") : null;
  const senderId= msg.user_id||msg.sender_id||msg.user?.id;
  const user    = !isMe ? (members?.find(m=>m?.id&&String(m.id)===String(senderId))||msg.user) : null;
  const replyMsg= msg._replyMsg;
  const reacs   = msg.reactions&&typeof msg.reactions==="object"
    ? Object.entries(msg.reactions).filter(([k,v])=>k!=="_users"&&Number(v)>0) : [];

  return (
    <div className={`gcv-row${isMe?" gcv-me":" gcv-them"}`}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      onContextMenu={e=>{e.preventDefault();setShowActions(a=>!a);}}
      onTouchStart={()=>{longRef.current=setTimeout(()=>setShowActions(true),500);}}
      onTouchEnd={()=>clearTimeout(longRef.current)}>

      {/* Avatar col */}
      <div className="gcv-avcol">
        {!isMe&&!nextSame&&user&&<Av user={user} size={30}/>}
      </div>

      <div className={`gcv-bwrap${isMe?" gcv-bwrap-me":" gcv-bwrap-them"}`}>
        {!isMe&&!prevSame&&user&&<span className="gcv-sname">{user?.full_name||user?.name||"Member"}</span>}

        {/* Reply quote */}
        {replyMsg&&(
          <div className={`gcv-rq${isMe?" gcv-rq-me":""}`}>
            <div className="gcv-rq-bar"/><div className="gcv-rq-body">
              <div className="gcv-rq-who"><Ic.Reply/><span>{replyMsg.user?.full_name||"User"}</span></div>
              <div className="gcv-rq-pre">{replyMsg.content?.startsWith("__GIF__:")?"🎞 GIF":replyMsg.content?.slice(0,60)}</div>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div className={[
          "gcv-bubble",
          isMe?"gcv-bme":"gcv-bthem",
          isGif?"gcv-bgif":"",
          nextSame&&isMe?"gcv-grpme":"",
          nextSame&&!isMe?"gcv-grpthem":"",
          !nextSame&&isMe?"gcv-tailme":"",
          !nextSame&&!isMe?"gcv-tailthem":"",
          msg._optimistic?"gcv-opt":"",
          msg._failed?"gcv-fail":"",
        ].filter(Boolean).join(" ")}>
          {isGif
            ? <img src={gifUrl} alt="GIF" className="gcv-gif"/>
            : <span className="gcv-txt">{msg.content}</span>
          }
        </div>

        {/* Reactions */}
        {reacs.length>0&&(
          <div className={`gcv-reacs${isMe?" gcv-reacs-me":""}`}>
            {reacs.map(([e,c])=><div key={e} className="gcv-reac">{e}<span className="gcv-reac-c">{c}</span></div>)}
          </div>
        )}

        {/* Meta */}
        <div className={`gcv-meta${isMe?" gcv-meta-me":""}`}>
          <span className="gcv-time">{timeStr(msg.created_at)}</span>
          {isMe&&<Ic.DblChk/>}
        </div>

        {/* Desktop hover reply */}
        {hovered&&!showActions&&(
          <button className={`gcv-hr${isMe?" gcv-hr-l":" gcv-hr-r"}`} onClick={()=>onReply?.(msg)}><Ic.Reply/></button>
        )}

        {/* Quick react */}
        {showActions&&(
          <div className={`gcv-rxp${isMe?" gcv-rxp-l":" gcv-rxp-r"}`}>
            {["😂","❤️","🔥","👍","😭","😮"].map(e=>(
              <button key={e} className="gcv-rxbtn" onClick={()=>{onReact?.(msg.id||msg._tempId,e);setShowActions(false);}}>{e}</button>
            ))}
            <button className="gcv-rxreply" onClick={()=>{onReply?.(msg);setShowActions(false);}}><Ic.Reply/> Reply</button>
          </div>
        )}
      </div>
    </div>
  );
});
MsgBubble.displayName="MsgBubble";

// ─── Date divider ─────────────────────────────────────────────────────────────
const DateDiv = memo(({date})=>(
  <div className="gcv-dated"><div className="gcv-dline"/><span className="gcv-dlbl">{date}</span><div className="gcv-dline"/></div>
));
DateDiv.displayName="DateDiv";

const getDateLabel = ts => {
  if (!ts) return "";
  const diff=Math.floor((Date.now()-new Date(ts))/86400000);
  if (diff===0) return "Today";
  if (diff===1) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
const GroupChatView = ({ group: groupProp, currentUser, onBack }) => {
  const [group,        setGroup]        = useState(groupProp);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [replyTo,      setReplyTo]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showEmoji,    setShowEmoji]    = useState(false);
  const [showGif,      setShowGif]      = useState(false);
  const [showMembers,  setShowMembers]  = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [typing,       setTyping]       = useState([]);
  const [sending,      setSending]      = useState(false);
  const [showJump,     setShowJump]     = useState(false);
  const [selectedBg,   setSelectedBg]   = useState(() =>
    backgroundService.getConversationBackground ? backgroundService.getConversationBackground(`gc_${groupProp?.id}`) : 0
  );

  const endRef       = useRef(null);
  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const typTimer     = useRef(null);
  const isAtBottom   = useRef(true);

  // Stable uid — normalise every possible currentUser field
  const uid     = String(currentUser?.id||currentUser?.uid||currentUser?.userId||"");
  const isAdmin = group?.members?.some(m=>m?.id&&String(m.id)===uid&&m?.is_admin)||group?.created_by===uid;
  const members = Array.isArray(group?.members)?group.members:[];

  const bgStyle     = backgroundService.getBgStyle?.(selectedBg) ?? {};
  const bgs         = backgroundService.getBackgrounds?.() ?? [];
  const isDefaultBg = bgs[selectedBg]?.isDefault !== false;

  const scrollToBottom = useCallback((b="smooth")=>{
    endRef.current?.scrollIntoView({behavior:b});
  },[]);

  const handleScroll = ()=>{
    if (!containerRef.current) return;
    const {scrollTop,scrollHeight,clientHeight}=containerRef.current;
    isAtBottom.current=scrollHeight-scrollTop-clientHeight<100;
    setShowJump(!isAtBottom.current);
  };

  // Load messages on mount
  useEffect(()=>{
    if (!group?.id) return;
    setLoading(true);
    groupDMService.loadMessages(group.id).then(msgs=>{
      setMessages(msgs||[]);
      setLoading(false);
      setTimeout(()=>scrollToBottom("instant"),80);
    }).catch(()=>setLoading(false));
  },[group?.id,scrollToBottom]);

  // Realtime subscribe
  useEffect(()=>{
    if (!group?.id) return;
    const unsub = groupDMService.subscribeToMessages(group.id,{
      onMessage: msg=>{
        if (!msg?.id&&!msg?._tempId) return;
        setMessages(prev=>{
          // Deduplicate — match by real id or tempId
          if (prev.some(m=>(m.id&&msg.id&&m.id===msg.id)||(m._tempId&&msg._tempId&&m._tempId===msg._tempId))) return prev;
          // Replace matching optimistic
          const replaced = prev.map(m=>m._tempId&&msg.id&&m._tempId===msg._tempId?{...msg}:m);
          if (replaced.some(m=>m._tempId&&m._tempId===msg._tempId)) return replaced;
          return [...prev,msg];
        });
        if (isAtBottom.current) setTimeout(()=>scrollToBottom("smooth"),80);
      },
      onTyping:({userId,userName,typing:isTy})=>{
        if (String(userId)===uid) return;
        setTyping(prev=>isTy?[...prev.filter(n=>n!==userName),userName]:prev.filter(n=>n!==userName));
        if (isTy) setTimeout(()=>setTyping(p=>p.filter(n=>n!==userName)),4000);
      },
    });
    const unsubUpd=groupDMService.on(`group_updated:${group.id}`,upd=>{if(upd?.id)setGroup(g=>({...g,...upd}));});
    return()=>{unsub();unsubUpd();};
  },[group?.id,uid,scrollToBottom]);

  const handleTyping=()=>{
    clearTimeout(typTimer.current);
    groupDMService.sendTyping(group.id,true,currentUser?.fullName||currentUser?.full_name||"Someone");
    typTimer.current=setTimeout(()=>groupDMService.sendTyping(group.id,false,"Someone"),2000);
  };

  // Send — optimistic first, then confirmed
  const send=async(text=input.trim())=>{
    if (!text||sending||!group?.id) return;
    const replyRef=replyTo;
    setInput(""); setReplyTo(null); setSending(true);
    // Create optimistic with BOTH user_id and sender_id set to uid
    const tempId=`tmp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const optimistic={
      id:tempId,_tempId:tempId,_optimistic:true,
      user_id:uid,sender_id:uid,          // ← both fields → isSentByMe will match
      content:text,
      created_at:new Date().toISOString(),
      reply_to_id:replyRef?.id||null,
      user:{id:uid,full_name:currentUser?.fullName||currentUser?.full_name||"You"},
    };
    setMessages(prev=>[...prev,optimistic]);
    setTimeout(()=>scrollToBottom("smooth"),50);

    try {
      const norm={id:uid,full_name:currentUser?.fullName||currentUser?.full_name||"You",avatar_id:currentUser?.avatarId||currentUser?.avatar_id};
      const msg=await groupDMService.sendMessage(group.id,text,norm,replyRef?.id||null);
      if (msg) {
        setMessages(prev=>{
          // Replace optimistic with confirmed
          const without=prev.filter(m=>m._tempId!==tempId);
          return without.some(m=>m.id===msg.id)?without:[...without,{...msg,user:norm}];
        });
      }
    } catch(e){
      setMessages(prev=>prev.map(m=>m._tempId===tempId?{...m,_failed:true}:m));
      console.warn("[GroupChat] send:",e.message);
    } finally {setSending(false);}
  };

  const handleReact=useCallback((msgId,emoji)=>{
    setMessages(prev=>prev.map(m=>{
      if(m.id!==msgId&&m._tempId!==msgId)return m;
      const r={...(m.reactions||{})};const users={...(r._users||{})};const prev_=users[uid];
      if(prev_===emoji){delete users[uid];r[emoji]=Math.max(0,(r[emoji]||1)-1);if(!r[emoji])delete r[emoji];}
      else{if(prev_){r[prev_]=Math.max(0,(r[prev_]||1)-1);if(!r[prev_])delete r[prev_];}r[emoji]=(r[emoji]||0)+1;users[uid]=emoji;}
      return{...m,reactions:{...r,_users:users}};
    }));
  },[uid]);

  // Delete group (admin only)
  const handleDelete=async()=>{
    try {
      await groupDMService.deleteGroup?.(group.id);
    } catch(e){console.warn("[GroupChat] delete:",e);}
    onBack();
  };

  // Leave group (member)
  const handleLeave=async()=>{
    try {
      await groupDMService.leaveGroup?.(group.id,uid);
    } catch(e){console.warn("[GroupChat] leave:",e);}
    onBack();
  };

  const handleBgChange=(idx)=>{
    setSelectedBg(idx);
    backgroundService.setConversationBackground?.(`gc_${group.id}`,idx);
  };

  const iconDisplay=group?.icon_url
    ?<img src={group.icon_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
    :<span style={{fontSize:20}}>{group?.icon||"👥"}</span>;

  // Build date-grouped list
  const msgWithDates=[];let lastDate=null;
  messages.forEach((msg,i)=>{
    const lbl=getDateLabel(msg.created_at);
    if(lbl&&lbl!==lastDate){msgWithDates.push({_type:"date",label:lbl,_key:`d${i}`});lastDate=lbl;}
    msgWithDates.push(msg);
  });

  return (
    <div className="gcv-root">
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div className="gcv-head">
        <button className="gcv-back" onClick={onBack}><Ic.Back/></button>

        <div className="gcv-head-info">
          <div className="gcv-head-av"><div className="gcv-head-av-in">{iconDisplay}</div></div>
          <div className="gcv-head-txt">
            <div className="gcv-head-name">{group?.name}</div>
            <div className={`gcv-head-sub${typing.length>0?" gcv-typing":""}`}>
              {typing.length>0?`${typing[0]} is typing…`:`${members.length} member${members.length!==1?"s":""}`}
            </div>
          </div>
        </div>

        <div className="gcv-head-right">
          <button className={`gcv-hbtn${showMembers?" gcv-hbtn-on":""}`} onClick={()=>setShowMembers(s=>!s)} title="Members">
            <Ic.Users/>
          </button>
          <button className={`gcv-hbtn${showSettings?" gcv-hbtn-on":""}`} onClick={()=>setShowSettings(true)} title="Settings">
            <Ic.Settings/>
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="gcv-body">
        {/* Messages */}
        <div className={`gcv-msgs${isDefaultBg?" gcv-msgs-default":""}`} style={bgStyle} ref={containerRef} onScroll={handleScroll}>
          <div className="gcv-msgs-overlay"/>
          <div className="gcv-msgs-content">
            {loading&&<div className="gcv-loading"><div className="gcv-spin"/></div>}
            {!loading&&messages.length===0&&(
              <div className="gcv-empty">
                <div className="gcv-empty-icon">{group?.icon||"👥"}</div>
                <div className="gcv-empty-title">Start the conversation</div>
                <div className="gcv-empty-sub">Say hi to the group!</div>
              </div>
            )}
            {msgWithDates.map((item,i)=>{
              if(item._type==="date") return <DateDiv key={item._key} date={item.label}/>;
              const msg=item;
              const idx=messages.indexOf(msg);
              const prev=messages[idx-1];const next=messages[idx+1];
              const isMe=isSentByMe(msg,currentUser);
              const prevSame=prev&&isSentByMe(prev,currentUser)===isMe&&(prev.user_id===msg.user_id||prev.sender_id===msg.sender_id);
              const nextSame=next&&isSentByMe(next,currentUser)===isMe&&(next.user_id===msg.user_id||next.sender_id===msg.sender_id);
              let m2=msg;
              if(msg.reply_to_id&&!msg._replyMsg){const found=messages.find(x=>x.id===msg.reply_to_id);if(found)m2={...msg,_replyMsg:found};}
              return <MsgBubble key={msg._tempId||msg.id||i} msg={m2} isMe={isMe} prevSame={prevSame} nextSame={nextSame} members={members} onReply={setReplyTo} onReact={handleReact}/>;
            })}
            {typing.length>0&&(
              <div className="gcv-row gcv-them">
                <div className="gcv-avcol"><div className="gcv-typing-av">{(typing[0]||"?").charAt(0).toUpperCase()}</div></div>
                <div className="gcv-bwrap gcv-bwrap-them">
                  <span className="gcv-sname">{typing[0]}</span>
                  <div className="gcv-bubble gcv-bthem gcv-tailthem gcv-typing-bubble"><div className="gcv-dots"><span/><span/><span/></div></div>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>
          {showJump&&<button className="gcv-jump" onClick={()=>scrollToBottom()}><Ic.Down/></button>}
        </div>

        {/* Members side panel */}
        {showMembers&&(
          <div className="gcv-mpanel">
            <div className="gcv-mpanel-hdr">Members · {members.length}</div>
            {members.map(m=>m&&(
              <div key={m.id} className="gcv-mrow">
                <Av user={m} size={28}/>
                <div className="gcv-minfo">
                  <div className="gcv-mname">{m.full_name||m.name||"?"}</div>
                  {m.is_admin&&<div className="gcv-madmin">ADMIN</div>}
                </div>
                {String(m.id)===uid&&<span className="gcv-myou">You</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REPLY BAR ── */}
      {replyTo&&(
        <div className="gcv-rbar">
          <div className="gcv-rbar-acc"/>
          <div className="gcv-rbar-body">
            <div className="gcv-rbar-who">Replying to {replyTo.user?.full_name||replyTo.user?.name||"User"}</div>
            <div className="gcv-rbar-pre">{replyTo.content?.startsWith("__GIF__:")?"🎞 GIF":replyTo.content?.slice(0,70)}</div>
          </div>
          <button className="gcv-rbar-x" onClick={()=>setReplyTo(null)}><Ic.Close/></button>
        </div>
      )}

      {/* ── INPUT ── */}
      <div className="gcv-input-root">
        {showEmoji&&<EmojiPicker onSelect={e=>{setInput(v=>v+e);setShowEmoji(false);inputRef.current?.focus();}} onClose={()=>setShowEmoji(false)}/>}
        {showGif&&<GifPicker onSelect={url=>{send(`__GIF__:${url}`);setShowGif(false);}} onClose={()=>setShowGif(false)}/>}
        <div className="gcv-ibar">
          <div className="gcv-iacts">
            <button className={`gcv-ibtn${showEmoji?" gcv-ibtn-on":""}`} onClick={()=>{setShowEmoji(s=>!s);setShowGif(false);}}><Ic.Smile/></button>
            <button className={`gcv-ibtn gcv-ibtn-gif${showGif?" gcv-ibtn-gif-on":""}`} onClick={()=>{setShowGif(s=>!s);setShowEmoji(false);}}><Ic.Gif/></button>
          </div>
          <textarea ref={inputRef} value={input} rows={1} placeholder="Message the group…" className="gcv-ta"
            onChange={e=>{setInput(e.target.value);handleTyping();const ta=inputRef.current;if(ta){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,120)+"px";}}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          />
          <button className={`gcv-send${input.trim()?" gcv-send-on":""}`} onClick={()=>send()} disabled={!input.trim()||sending}><Ic.Send/></button>
        </div>
      </div>

      {/* ── SETTINGS MODAL ── */}
      {showSettings&&(
        <SettingsModal
          group={group} currentUser={currentUser} isAdmin={isAdmin}
          selectedBg={selectedBg}
          onBgChange={handleBgChange}
          onSave={updated=>{setGroup(updated);setShowSettings(false);}}
          onDelete={handleDelete}
          onLeave={handleLeave}
          onClose={()=>setShowSettings(false)}
        />
      )}
    </div>
  );
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes geUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes gcvSpin{to{transform:rotate(360deg)}}
@keyframes gcvMsgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes gcvFadeIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
@keyframes gcvRBIn{from{opacity:0;scale:.7}to{opacity:1;scale:1}}
@keyframes gcvRxIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
@keyframes gcvRBSlide{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes gcvDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}

/* Root */
.gcv-root{display:flex;flex-direction:column;height:100%;background:#000;overflow:hidden;position:relative;}

/* Header — 14px sides, safe-area top, exactly matches ChatView */
.gcv-head{
  display:flex;align-items:center;gap:10px;
  padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px;
  background:rgba(0,0,0,.98);border-bottom:1px solid rgba(132,204,22,.1);
  position:relative;z-index:10;flex-shrink:0;min-height:56px;box-sizing:border-box;
}
.gcv-back{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .2s;}
.gcv-back:hover{background:rgba(132,204,22,.1);}
.gcv-head-info{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.gcv-head-av{width:38px;height:38px;flex-shrink:0;}
.gcv-head-av-in{width:38px;height:38px;border-radius:50%;background:rgba(132,204,22,.1);border:1.5px solid rgba(132,204,22,.25);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:20px;}
.gcv-head-txt{flex:1;min-width:0;}
.gcv-head-name{font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.gcv-head-sub{font-size:11px;color:#555;transition:color .2s;}
.gcv-head-sub.gcv-typing{color:#84cc16;font-style:italic;}
.gcv-head-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.gcv-hbtn{width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#666;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.gcv-hbtn:hover,.gcv-hbtn-on{background:rgba(132,204,22,.1)!important;border-color:rgba(132,204,22,.25)!important;color:#84cc16!important;}

/* Body */
.gcv-body{flex:1;display:flex;overflow:hidden;}

/* Messages — supports backgrounds like ChatView */
.gcv-msgs{flex:1;overflow-y:auto;position:relative;-webkit-overflow-scrolling:touch;}
.gcv-msgs::-webkit-scrollbar{width:3px;}
.gcv-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px;}
.gcv-msgs-overlay{position:absolute;inset:0;background:rgba(0,0,0,.22);pointer-events:none;z-index:0;}
.gcv-msgs-default .gcv-msgs-overlay{background:rgba(0,0,0,.05);}
.gcv-msgs-content{position:relative;z-index:1;padding:12px 14px 16px;display:flex;flex-direction:column;gap:1px;}

.gcv-loading{display:flex;justify-content:center;padding:40px;}
.gcv-spin{width:22px;height:22px;border:2px solid rgba(132,204,22,.15);border-top-color:#84cc16;border-radius:50%;animation:gcvSpin .7s linear infinite;}

.gcv-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;min-height:280px;}
.gcv-empty-icon{font-size:52px;margin-bottom:14px;opacity:.6;}
.gcv-empty-title{font-size:15px;font-weight:700;color:#555;margin-bottom:4px;}
.gcv-empty-sub{font-size:12px;color:#3a3a3a;}

/* Date divider */
.gcv-dated{display:flex;align-items:center;gap:10px;margin:14px 0 8px;}
.gcv-dline{flex:1;height:1px;background:rgba(255,255,255,.06);}
.gcv-dlbl{font-size:10px;font-weight:700;color:#3a3a3a;text-transform:uppercase;letter-spacing:.6px;white-space:nowrap;}

/* Jump */
.gcv-jump{position:absolute;bottom:16px;right:16px;z-index:5;width:38px;height:38px;border-radius:50%;background:rgba(10,10,10,.96);border:1px solid rgba(132,204,22,.4);color:#84cc16;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.6);animation:gcvFadeIn .2s ease-out;}

/* Rows */
.gcv-row{display:flex;align-items:flex-end;gap:7px;margin-bottom:2px;position:relative;animation:gcvMsgIn .18s ease-out both;}
.gcv-me{flex-direction:row-reverse;}
.gcv-them{flex-direction:row;}
.gcv-avcol{width:32px;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center;}
.gcv-typing-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0d1a00,#1a3300);border:1.5px solid rgba(132,204,22,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#84cc16;}
.gcv-bwrap{max-width:72%;display:flex;flex-direction:column;position:relative;}
.gcv-bwrap-me{align-items:flex-end;}
.gcv-bwrap-them{align-items:flex-start;}
.gcv-sname{font-size:11px;font-weight:700;color:#84cc16;margin-bottom:3px;padding:0 2px;}

/* Reply quote */
.gcv-rq{display:flex;align-items:stretch;margin-bottom:5px;border-radius:8px;overflow:hidden;cursor:pointer;max-width:100%;}
.gcv-rq-me{flex-direction:row-reverse;}
.gcv-rq-bar{width:3px;flex-shrink:0;background:#84cc16;}
.gcv-rq-me .gcv-rq-bar{background:rgba(255,255,255,.3);}
.gcv-rq-body{padding:5px 10px;flex:1;min-width:0;background:rgba(0,0,0,.25);}
.gcv-rq-who{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#84cc16;margin-bottom:2px;}
.gcv-rq-me .gcv-rq-who{color:rgba(255,255,255,.5);}
.gcv-rq-pre{font-size:11px;color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* Bubbles */
.gcv-bubble{padding:9px 13px;word-break:break-word;position:relative;}
.gcv-bme{background:linear-gradient(135deg,rgba(132,204,22,.22),rgba(101,163,13,.16));border:1px solid rgba(132,204,22,.28);border-radius:18px 18px 4px 18px;}
.gcv-bthem{background:rgba(22,22,22,.97);border:1px solid rgba(255,255,255,.07);border-radius:18px 18px 18px 4px;}
.gcv-grpme{border-radius:18px 4px 4px 18px!important;}
.gcv-grpthem{border-radius:4px 18px 18px 4px!important;}
.gcv-tailme{border-radius:18px 18px 4px 18px!important;}
.gcv-tailthem{border-radius:18px 18px 18px 4px!important;}
.gcv-bgif{padding:0!important;background:transparent!important;border:none!important;}
.gcv-gif{max-width:220px;max-height:170px;border-radius:10px;display:block;object-fit:cover;}
.gcv-txt{font-size:14px;line-height:1.5;color:#f0f0f0;}
.gcv-bme .gcv-txt{color:#e8ffe8;}
.gcv-opt{opacity:.65;}.gcv-fail{opacity:.45;}

/* Meta */
.gcv-meta{display:flex;align-items:center;gap:4px;margin-top:3px;padding:0 2px;}
.gcv-meta-me{justify-content:flex-end;}
.gcv-time{font-size:10px;color:#444;}

/* Reactions */
.gcv-reacs{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;}
.gcv-reacs-me{justify-content:flex-end;}
.gcv-reac{display:flex;align-items:center;gap:2px;padding:2px 7px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);font-size:13px;cursor:pointer;transition:background .15s;}
.gcv-reac:hover{background:rgba(255,255,255,.12);}
.gcv-reac-c{font-size:10px;font-weight:700;color:#888;}

/* Hover reply btn */
.gcv-hr{position:absolute;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;background:rgba(14,14,14,.95);border:1px solid rgba(132,204,22,.3);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;z-index:5;animation:gcvRBIn .15s ease-out forwards;box-shadow:0 2px 8px rgba(0,0,0,.4);}
.gcv-hr:hover{background:rgba(132,204,22,.12);}
.gcv-hr-r{right:-36px;}.gcv-hr-l{left:-36px;}
@media(max-width:768px){.gcv-hr{display:none;}}

/* React panel */
.gcv-rxp{position:absolute;top:-50px;display:flex;gap:3px;align-items:center;background:rgba(14,14,14,.98);border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:6px 8px;box-shadow:0 8px 24px rgba(0,0,0,.7);z-index:10;animation:gcvRxIn .15s ease-out;white-space:nowrap;}
.gcv-rxp-l{right:0;}.gcv-rxp-r{left:0;}
.gcv-rxbtn{background:none;border:none;font-size:22px;cursor:pointer;border-radius:8px;padding:2px 3px;transition:transform .1s;}
.gcv-rxbtn:hover{transform:scale(1.3);}
.gcv-rxreply{background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);border-radius:12px;padding:5px 10px;color:#84cc16;cursor:pointer;display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;}

/* Typing */
.gcv-typing-bubble{padding:10px 14px!important;}
.gcv-dots{display:flex;gap:4px;}
.gcv-dots span{width:6px;height:6px;border-radius:50%;background:#555;animation:gcvDot 1.2s ease infinite;}
.gcv-dots span:nth-child(2){animation-delay:.15s;}
.gcv-dots span:nth-child(3){animation-delay:.3s;}

/* Members side panel */
.gcv-mpanel{width:176px;background:rgba(8,8,8,.97);border-left:1px solid rgba(255,255,255,.06);overflow-y:auto;flex-shrink:0;}
.gcv-mpanel-hdr{padding:12px 12px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.6px;}
.gcv-mrow{display:flex;align-items:center;gap:8px;padding:9px 12px;}
.gcv-minfo{flex:1;min-width:0;}
.gcv-mname{font-size:12px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gcv-madmin{font-size:9px;font-weight:700;color:#84cc16;letter-spacing:.4px;}
.gcv-myou{font-size:10px;color:#555;font-style:italic;flex-shrink:0;}

/* Reply bar */
.gcv-rbar{display:flex;align-items:center;gap:9px;padding:9px 14px;background:rgba(8,8,8,.98);border-top:1px solid rgba(132,204,22,.15);animation:gcvRBSlide .2s ease-out;flex-shrink:0;}
.gcv-rbar-acc{width:3px;height:36px;border-radius:2px;background:#84cc16;flex-shrink:0;}
.gcv-rbar-body{flex:1;min-width:0;}
.gcv-rbar-who{font-size:10px;font-weight:700;color:#84cc16;margin-bottom:2px;}
.gcv-rbar-pre{font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gcv-rbar-x{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#666;flex-shrink:0;}

/* Input */
.gcv-input-root{flex-shrink:0;background:rgba(0,0,0,.98);border-top:1px solid rgba(255,255,255,.06);position:relative;}
.gcv-ibar{display:flex;align-items:flex-end;gap:8px;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 12px);}
.gcv-iacts{display:flex;gap:4px;flex-shrink:0;}
.gcv-ibtn{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#666;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.gcv-ibtn:hover{background:rgba(132,204,22,.08);color:#84cc16;}
.gcv-ibtn-on{background:rgba(132,204,22,.12)!important;border-color:rgba(132,204,22,.3)!important;color:#84cc16!important;}
.gcv-ibtn-gif:hover{background:rgba(96,165,250,.08)!important;color:#60a5fa!important;}
.gcv-ibtn-gif-on{background:rgba(96,165,250,.12)!important;border-color:rgba(96,165,250,.3)!important;color:#60a5fa!important;}
.gcv-ta{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:22px;color:#fff;font-size:14px;padding:10px 16px;outline:none;caret-color:#84cc16;font-family:inherit;resize:none;overflow:hidden;line-height:1.4;min-height:40px;max-height:120px;transition:border-color .2s;box-sizing:border-box;}
.gcv-ta:focus{border-color:rgba(132,204,22,.35);}
.gcv-ta::placeholder{color:#333;}
.gcv-send{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.07);color:#333;display:flex;align-items:center;justify-content:center;cursor:not-allowed;flex-shrink:0;transition:all .15s;}
.gcv-send-on{background:linear-gradient(135deg,rgba(132,204,22,.25),rgba(101,163,13,.2))!important;border-color:rgba(132,204,22,.45)!important;color:#84cc16!important;cursor:pointer!important;}
.gcv-send-on:hover{background:linear-gradient(135deg,rgba(132,204,22,.35),rgba(101,163,13,.3))!important;}

/* Emoji picker */
.gcv-ep{position:absolute;bottom:calc(100% + 8px);left:14px;width:320px;background:#111;border:1px solid rgba(132,204,22,.25);border-radius:14px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.8);z-index:200;}
.gcv-ep-sr{display:flex;align-items:center;gap:7px;padding:9px 11px;border-bottom:1px solid rgba(255,255,255,.06);}
.gcv-ep-inp{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#fff;font-size:12px;padding:5px 9px;outline:none;}
.gcv-ep-cats{display:flex;gap:2px;padding:6px 9px;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto;scrollbar-width:none;}
.gcv-ep-cb{flex-shrink:0;width:32px;height:30px;border-radius:7px;background:transparent;border:1px solid transparent;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.gcv-ep-cb-on{background:rgba(132,204,22,.15)!important;border-color:rgba(132,204,22,.4)!important;}
.gcv-ep-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px;max-height:240px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(132,204,22,.3) transparent;}
.gcv-ep-em{aspect-ratio:1;background:transparent;border:none;border-radius:6px;font-size:21px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,transform .1s;}

/* GIF picker */
.gcv-gp{position:absolute;bottom:calc(100% + 8px);left:14px;width:340px;background:#111;border:1px solid rgba(132,204,22,.25);border-radius:14px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.8);z-index:200;}
.gcv-gp-top{padding:9px 11px 7px;border-bottom:1px solid rgba(255,255,255,.06);}
.gcv-gp-quick{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;margin-top:7px;}
.gcv-gp-chip{flex-shrink:0;padding:3px 9px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:#777;font-size:11px;font-weight:600;cursor:pointer;}
.gcv-gp-chip-on{background:rgba(132,204,22,.15)!important;border-color:rgba(132,204,22,.35)!important;color:#84cc16!important;}
.gcv-gp-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:8px;max-height:240px;overflow-y:auto;scrollbar-width:thin;}
.gcv-gp-item{border:none;background:transparent;padding:0;cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:4/3;}
.gcv-gp-img{width:100%;height:100%;object-fit:cover;border-radius:8px;transition:transform .15s;}

/* Settings modal */
.gcv-modal-ov{position:fixed;inset:0;z-index:99996;background:rgba(0,0,0,.82);display:flex;align-items:flex-end;backdrop-filter:blur(8px);}
.gcv-modal{width:100%;max-height:90vh;background:#090909;border:1px solid rgba(132,204,22,.15);border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;animation:geUp .32s cubic-bezier(.34,1.4,.64,1);}
.gcv-modal-pill{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:12px auto 0;flex-shrink:0;}
.gcv-modal-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 11px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;}
.gcv-modal-title{font-size:15px;font-weight:800;color:#fff;}
.gcv-modal-cancel{background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer;}
.gcv-modal-action{padding:7px 16px;border-radius:20px;background:rgba(132,204,22,.2);border:1px solid rgba(132,204,22,.4);color:#84cc16;font-size:13px;font-weight:700;cursor:pointer;}
.gcv-modal-action:disabled{opacity:.35;cursor:not-allowed;}
.gcv-modal-body{flex:1;overflow-y:auto;padding:16px 18px 32px;display:flex;flex-direction:column;}
.gcv-modal-av-wrap{position:relative;width:88px;height:88px;margin:0 auto 8px;cursor:pointer;}
.gcv-modal-av{width:88px;height:88px;border-radius:50%;background:rgba(132,204,22,.1);border:2px dashed rgba(132,204,22,.4);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.gcv-modal-av-cam{position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:50%;background:#84cc16;border:2px solid #090909;display:flex;align-items:center;justify-content:center;color:#000;}
.gcv-modal-label{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.7px;margin:0 0 7px;}
.gcv-modal-inp{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;font-size:15px;padding:11px 13px;outline:none;box-sizing:border-box;font-weight:600;caret-color:#84cc16;margin-bottom:16px;}

/* Settings rows */
.gcv-settings-rows{display:flex;flex-direction:column;gap:1px;margin-bottom:24px;}
.gcv-settings-row{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;cursor:pointer;transition:background .15s;margin-bottom:6px;}
.gcv-settings-row:hover{background:rgba(255,255,255,.06);}
.gcv-sr-left{display:flex;align-items:center;gap:10px;font-size:14px;color:#ccc;font-weight:500;}
.gcv-sr-chev{font-size:18px;color:#444;}

/* Danger zone */
.gcv-danger-zone{margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);}
.gcv-danger-btn{width:100%;padding:13px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;}
.gcv-btn-delete{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444;}
.gcv-btn-delete:hover{background:rgba(239,68,68,.18);}
.gcv-btn-leave{background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.3);color:#f97316;}
.gcv-btn-leave:hover{background:rgba(249,115,22,.18);}

/* Confirm actions */
.gcv-confirm-delete-btn{width:100%;max-width:280px;padding:14px;border-radius:14px;background:rgba(239,68,68,.15);border:1.5px solid rgba(239,68,68,.4);color:#ef4444;font-size:15px;font-weight:800;cursor:pointer;transition:all .15s;}
.gcv-confirm-delete-btn:hover{background:rgba(239,68,68,.25);}
.gcv-confirm-leave-btn{width:100%;max-width:280px;padding:14px;border-radius:14px;background:rgba(249,115,22,.15);border:1.5px solid rgba(249,115,22,.4);color:#f97316;font-size:15px;font-weight:800;cursor:pointer;transition:all .15s;}
.gcv-confirm-leave-btn:hover{background:rgba(249,115,22,.25);}

/* Bg picker */
.gcv-bg-grid{display:flex;flex-direction:column;gap:6px;}
.gcv-bg-opt{display:flex;align-items:center;gap:12px;padding:9px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;cursor:pointer;transition:all .15s;text-align:left;}
.gcv-bg-opt:hover{background:rgba(255,255,255,.06);}
.gcv-bg-on{background:rgba(132,204,22,.1)!important;border-color:rgba(132,204,22,.35)!important;}
.gcv-bg-prev{width:40px;height:32px;border-radius:6px;flex-shrink:0;}
.gcv-bg-grid-pat{background:repeating-linear-gradient(90deg,rgba(132,204,22,.25) 0px,rgba(132,204,22,.25) 1px,transparent 1px,transparent 8px),repeating-linear-gradient(0deg,rgba(132,204,22,.25) 0px,rgba(132,204,22,.25) 1px,transparent 1px,transparent 8px),#000;}
.gcv-bg-name{font-size:13px;color:#ccc;font-weight:500;}

/* Icon picker */
.gcv-icon-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
.gcv-icon-btn{font-size:26px;padding:10px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:all .12s;}
.gcv-icon-on{background:rgba(132,204,22,.12)!important;border-color:rgba(132,204,22,.4)!important;}

/* Members full list */
.gcv-member-row-full{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.04);}
.gcv-mrf-info{flex:1;min-width:0;}
.gcv-mrf-name{font-size:13px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gcv-mrf-admin{font-size:9px;font-weight:700;color:#84cc16;letter-spacing:.4px;margin-top:1px;}
.gcv-mrf-you{font-size:10px;color:#555;font-style:italic;flex-shrink:0;}
`;

export default GroupChatView;