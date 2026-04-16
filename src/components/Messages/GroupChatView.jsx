// components/Messages/GroupChatView.jsx — NOVA GROUP CHAT v3 COMPLETE
// Features: real-time chat, emoji picker, GIF (Tenor+fallback), group edit,
// icon upload, beautiful reply design, reactions, members list.

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import groupDMService  from "../../services/messages/groupDMService";
import mediaUrlService from "../../services/shared/mediaUrlService";

// ── Tenor GIF search with fallback ───────────────────────────────────────────
const FALLBACK_GIFS = [
  { id:"f1", url:"https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", preview:"https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif", title:"Hi", tags:["hi","hello","hey","wave"] },
  { id:"f2", url:"https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", preview:"https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif", title:"LOL", tags:["lol","laugh","funny","haha"] },
  { id:"f3", url:"https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif", preview:"https://media.giphy.com/media/d2Z9QYzA2aidiWn6/200.gif", title:"Fire", tags:["fire","hot","amazing","wow"] },
  { id:"f4", url:"https://media.giphy.com/media/xT9IgG50Lg7russbD6/giphy.gif", preview:"https://media.giphy.com/media/xT9IgG50Lg7russbD6/200.gif", title:"Clap", tags:["clap","great","nice","good"] },
  { id:"f5", url:"https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif", preview:"https://media.giphy.com/media/l3q2K5jinAlChoCLS/200.gif", title:"OK", tags:["ok","fine","sure","alright"] },
  { id:"f6", url:"https://media.giphy.com/media/fUSp9NJCKqHpBfxKvN/giphy.gif", preview:"https://media.giphy.com/media/fUSp9NJCKqHpBfxKvN/200.gif", title:"Sad", tags:["sad","cry","no","miss"] },
  { id:"f7", url:"https://media.giphy.com/media/l46CsHbZDSZKjsGNO/giphy.gif", preview:"https://media.giphy.com/media/l46CsHbZDSZKjsGNO/200.gif", title:"Yes!", tags:["yes","win","celebrate","yeah"] },
  { id:"f8", url:"https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif", preview:"https://media.giphy.com/media/ZqlvCTNHpqrio/200.gif", title:"Love", tags:["love","heart","cute","sweet"] },
  { id:"f9", url:"https://media.giphy.com/media/oGO1MPNUVbbk4/giphy.gif", preview:"https://media.giphy.com/media/oGO1MPNUVbbk4/200.gif", title:"Thinking", tags:["think","hmm","idk","wait"] },
  { id:"f10", url:"https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif", preview:"https://media.giphy.com/media/11sBLVxNs7v6WA/200.gif", title:"Deal", tags:["deal","ok","agree","yes","deal"] },
  { id:"f11", url:"https://media.giphy.com/media/ukMiDpZpm6B8/giphy.gif", preview:"https://media.giphy.com/media/ukMiDpZpm6B8/200.gif", title:"Party", tags:["party","celebrate","fun","woo"] },
  { id:"f12", url:"https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif", preview:"https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200.gif", title:"NoNoNo", tags:["no","stop","nope","bad"] },
];

const searchGifs = async (query, limit = 12) => {
  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyC6bfxFR63-j8KFoiVHF4K5GKPZ5QLRHQE&limit=${limit}&media_filter=gif`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("tenor");
    const data = await res.json();
    return (data.results||[]).map(r=>({
      id: r.id,
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || "",
      preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || "",
      title: r.title || query,
    })).filter(g => g.url);
  } catch {
    const q = query.toLowerCase();
    const filtered = FALLBACK_GIFS.filter(g => g.tags.some(t => q.includes(t) || t.includes(q)));
    return (filtered.length ? filtered : FALLBACK_GIFS).slice(0, limit);
  }
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ic = {
  Back:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Send:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Smile:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  Gif:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 12h4M10 10v4"/><path d="M14 10h2a2 2 0 010 4h-2"/></svg>,
  Edit:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Close:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Reply:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>,
  Users:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Camera: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Search: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  DblChk: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 11 9 5 5"/><polyline points="20 8 14 16 8 12"/></svg>,
};

const timeStr = ts => ts ? new Date(ts).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}) : "";

// ── Avatar ────────────────────────────────────────────────────────────────────
const Av = memo(({ user, size=32 }) => {
  const [err, setErr] = useState(false);
  const id  = user?.avatar_id || user?.avatarId;
  const url = !err && id ? mediaUrlService.getAvatarUrl(id, 200) : null;
  const ini = (user?.full_name || user?.name || "?").charAt(0).toUpperCase();
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#0d1a00,#1a3300)",border:"1.5px solid rgba(132,204,22,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:700,color:"#84cc16",overflow:"hidden",flexShrink:0}}>
      {url ? <img src={url} alt={ini} onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : ini}
    </div>
  );
});
Av.displayName = "Av";

// ── Emoji categories ──────────────────────────────────────────────────────────
const EMOJI_CATS = {
  "⭐": ["😂","🔥","❤️","👍","💀","🎉","😭","🤣","✨","💯","🫡","🙏","💪","🥹","😤","🫠","🤡","😎","🤯","🫶"],
  "😀": ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","👿","💀","💩","🤡","👻","👽","🤖"],
  "👋": ["👋","🤚","🖐","✋","🖖","👌","🤌","🤏","✌","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","💪","🦾"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟","♥️","❣️"],
  "🔥": ["🔥","💫","⭐","🌟","✨","💥","❄️","🌈","☀️","🌊","🌙","⚡","💧","🌸","🌺","🍀","🎉","🎊","🎈","🎁","🏆","🥇","💎","🚀","🛸","🌍","🎯","💯","🔮","🌀"],
  "🍕": ["🍕","🍔","🌮","🌯","🍜","🍣","🍰","🎂","🧁","🍩","🍦","☕","🧋","🍺","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🥤","🧃","🫖","🍫","🍬","🍭","🍿","🥜","🫘"],
  "✈️": ["✈️","🚀","🛸","🚗","🚕","🏎","🏍","🛵","🚲","🛴","🚁","⛵","🚢","🏖","🏝","🏔","🗺","🌋","🏕","🏠","🏯","🗼","🎡","🎢"],
  "📱": ["📱","💻","⌨️","🖥","🖨","🖱","📷","📸","🎥","📺","📻","🎙","⌚","🔋","🔌","💡","🔦","🕯","💸","💳","💰","💎","⚖️","🔧","🔨","⚙️","🔑","🗝","🔐","🔒","🚪"],
};

// ── EmojiPicker ───────────────────────────────────────────────────────────────
const EmojiPicker = memo(({ onSelect, onClose }) => {
  const [cat,setcat] = useState("⭐");
  const [search,setSrch] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  useEffect(()=>{inputRef.current?.focus();},[]);
  useEffect(()=>{
    const h = e=>{if(!ref.current?.contains(e.target))onClose();};
    const t = setTimeout(()=>document.addEventListener("pointerdown",h),100);
    return()=>{clearTimeout(t);document.removeEventListener("pointerdown",h);};
  },[onClose]);
  const emojis = search
    ? Object.values(EMOJI_CATS).flat().filter((e,i,a)=>a.indexOf(e)===i)
    : (EMOJI_CATS[cat]||[]);
  return (
    <div ref={ref} style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:320,background:"#111",border:"1px solid rgba(132,204,22,.25)",borderRadius:14,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,.8)",zIndex:100}} onPointerDown={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 11px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <Ic.Search/>
        <input ref={inputRef} value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search emoji…" style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,color:"#fff",fontSize:12,padding:"5px 9px",outline:"none"}}/>
      </div>
      {!search&&<div style={{display:"flex",gap:2,padding:"6px 9px",borderBottom:"1px solid rgba(255,255,255,.06)",overflowX:"auto",scrollbarWidth:"none"}}>
        {Object.keys(EMOJI_CATS).map(k=>(
          <button key={k} onClick={()=>setcat(k)} style={{flexShrink:0,width:32,height:30,borderRadius:7,background:cat===k?"rgba(132,204,22,.15)":"transparent",border:`1px solid ${cat===k?"rgba(132,204,22,.4)":"transparent"}`,fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{k}</button>
        ))}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:2,padding:8,maxHeight:240,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"rgba(132,204,22,.3) transparent"}}>
        {emojis.map((e,i)=>(
          <button key={i} onClick={()=>onSelect(e)} style={{aspectRatio:"1",background:"transparent",border:"none",borderRadius:6,fontSize:21,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .1s,transform .1s"}}
            onMouseEnter={ev=>{ev.currentTarget.style.background="rgba(132,204,22,.15)";ev.currentTarget.style.transform="scale(1.2)";}}
            onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";ev.currentTarget.style.transform="scale(1)";}}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
});
EmojiPicker.displayName = "EmojiPicker";

// ── GifPicker ─────────────────────────────────────────────────────────────────
const GifPicker = memo(({ onSelect, onClose }) => {
  const [query,setQ] = useState("");
  const [gifs,setGifs] = useState(FALLBACK_GIFS.slice(0,8));
  const [loading,setLoading] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(null);
  useEffect(()=>{inputRef.current?.focus();},[]);
  useEffect(()=>{
    const h = e=>{if(!ref.current?.contains(e.target))onClose();};
    const t = setTimeout(()=>document.addEventListener("pointerdown",h),100);
    return()=>{clearTimeout(t);document.removeEventListener("pointerdown",h);};
  },[onClose]);
  useEffect(()=>{
    if(query.length<2){setGifs(FALLBACK_GIFS.slice(0,12));return;}
    clearTimeout(timer.current);
    timer.current = setTimeout(async()=>{
      setLoading(true);
      const r = await searchGifs(query);
      setGifs(r);
      setLoading(false);
    },400);
    return()=>clearTimeout(timer.current);
  },[query]);
  const QUICK = ["hi","lol","fire","love","yes","no","wow","party","thanks","ok","cool","sad"];
  return (
    <div ref={ref} style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:340,background:"#111",border:"1px solid rgba(132,204,22,.25)",borderRadius:14,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,.8)",zIndex:100}} onPointerDown={e=>e.stopPropagation()}>
      <div style={{padding:"9px 11px 7px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
          <Ic.Search/>
          <input ref={inputRef} value={query} onChange={e=>setQ(e.target.value)} placeholder="Search GIFs…" style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,color:"#fff",fontSize:12,padding:"5px 9px",outline:"none"}}/>
        </div>
        <div style={{display:"flex",gap:5,overflowX:"auto",scrollbarWidth:"none"}}>
          {QUICK.map(q=><button key={q} onClick={()=>setQ(q)} style={{flexShrink:0,padding:"3px 9px",borderRadius:12,background:query===q?"rgba(132,204,22,.15)":"rgba(255,255,255,.05)",border:`1px solid ${query===q?"rgba(132,204,22,.35)":"rgba(255,255,255,.07)"}`,color:query===q?"#84cc16":"#777",fontSize:11,fontWeight:600,cursor:"pointer"}}>{q}</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3,padding:8,maxHeight:240,overflowY:"auto",scrollbarWidth:"thin"}}>
        {loading&&<div style={{gridColumn:"1/-1",display:"flex",justifyContent:"center",padding:20}}><div style={{width:20,height:20,border:"2px solid rgba(132,204,22,.15)",borderTopColor:"#84cc16",borderRadius:"50%",animation:"gcSpin .7s linear infinite"}}/></div>}
        {!loading&&gifs.map(g=>(
          <button key={g.id} onClick={()=>onSelect(g.url,g.title)} style={{border:"none",background:"transparent",padding:0,cursor:"pointer",borderRadius:8,overflow:"hidden",aspectRatio:"4/3"}}>
            <img src={g.preview||g.url} alt={g.title} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:8,transition:"transform .15s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>
          </button>
        ))}
      </div>
      <div style={{padding:"3px 11px 7px",fontSize:9,color:"#333",textAlign:"right"}}>Tenor · Giphy fallback</div>
    </div>
  );
});
GifPicker.displayName = "GifPicker";

// ── Group Edit Modal ──────────────────────────────────────────────────────────
const GroupEditModal = ({ group, onSave, onClose }) => {
  const [name,setName]   = useState(group?.name||"");
  const [icon,setIcon]   = useState(group?.icon||"👥");
  const [imgSrc,setImg]  = useState(group?.icon_url||null);
  const [saving,setSaving]= useState(false);
  const fileRef = useRef(null);
  const ICONS = ["👥","🎮","📚","🏀","🎵","💼","🎨","🚀","⚡","🔥","🌍","🧠","💎","🎯","🏆","🌟","🎭","🎪","🛡","⚔️","🎋","🌺","🎀","🎊","🎉"];
  const handleImg = f => {
    if (!f||!f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = e => { setImg(e.target.result); setIcon(""); };
    r.readAsDataURL(f);
  };
  const handleSave = async () => {
    if (!name.trim()||saving) return;
    setSaving(true);
    try {
      const updates = { name:name.trim(), icon:imgSrc?null:icon };
      if (imgSrc) updates.icon_url = imgSrc;
      await groupDMService.updateGroup(group.id, updates);
      onSave({...group,...updates}); onClose();
    } catch(e){console.warn("[GroupEdit]",e);}
    finally{setSaving(false);}
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:99996,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div style={{width:"100%",maxHeight:"88vh",background:"#090909",border:"1px solid rgba(132,204,22,.15)",borderRadius:"22px 22px 0 0",display:"flex",flexDirection:"column",overflow:"hidden",animation:"geUp .32s cubic-bezier(.34,1.4,.64,1)"}}>
        <style>{`@keyframes geUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px 11px",borderBottom:"1px solid rgba(255,255,255,.06)",flexShrink:0}}>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancel</button>
          <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>Edit Group</span>
          <button onClick={handleSave} disabled={!name.trim()||saving} style={{padding:"7px 16px",borderRadius:20,background:"rgba(132,204,22,.2)",border:"1px solid rgba(132,204,22,.4)",color:"#84cc16",fontSize:13,fontWeight:700,cursor:"pointer",opacity:!name.trim()||saving?.4:1}}>
            {saving?"Saving…":"Save"}
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 18px 24px"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:18}}>
            <div style={{position:"relative",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
              <div style={{width:88,height:88,borderRadius:"50%",background:"rgba(132,204,22,.1)",border:"2px dashed rgba(132,204,22,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:imgSrc?0:44,overflow:"hidden"}}>
                {imgSrc?<img src={imgSrc} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:icon}
              </div>
              <div style={{position:"absolute",bottom:0,right:0,width:28,height:28,borderRadius:"50%",background:"#84cc16",border:"2px solid #090909",display:"flex",alignItems:"center",justifyContent:"center",color:"#000"}}>
                <Ic.Camera/>
              </div>
            </div>
            <span style={{fontSize:11,color:"#555"}}>Tap to upload photo or pick emoji below</span>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e.target.files?.[0])}/>
          </div>
          <p style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".7px",margin:"0 0 7px"}}>Group Name</p>
          <input value={name} onChange={e=>setName(e.target.value)} maxLength={60} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,color:"#fff",fontSize:15,padding:"11px 13px",outline:"none",boxSizing:"border-box",fontWeight:600,caretColor:"#84cc16",marginBottom:16}}/>
          {!imgSrc&&<>
            <p style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".7px",margin:"0 0 8px"}}>Group Icon</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {ICONS.map(ic=><button key={ic} onClick={()=>{setIcon(ic);setImg(null);}} style={{fontSize:26,padding:8,borderRadius:12,background:icon===ic?"rgba(132,204,22,.12)":"rgba(255,255,255,.03)",border:`1px solid ${icon===ic?"rgba(132,204,22,.4)":"rgba(255,255,255,.06)"}`,cursor:"pointer",transition:"all .12s"}}>{ic}</button>)}
            </div>
          </>}
          {imgSrc&&<button onClick={()=>setImg(null)} style={{padding:"7px 14px",borderRadius:10,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer"}}>Remove photo → use emoji</button>}
        </div>
      </div>
    </div>
  );
};

// ── Message Bubble ────────────────────────────────────────────────────────────
const MsgBubble = memo(({ msg, isMe, prevSame, nextSame, members, onReply, onReact }) => {
  const [showActions, setShowActions] = useState(false);
  const longRef = useRef(null);
  const isGif = msg.content?.startsWith("__GIF__:");
  const user = !isMe ? (members?.find(m=>m?.id===(msg.user_id||msg.sender_id))||msg.user) : null;
  const replyMsg = msg._replyMsg;
  const reacs = msg.reactions && typeof msg.reactions==="object"
    ? Object.entries(msg.reactions).filter(([k,v])=>k!=="_users"&&Number(v)>0)
    : [];

  return (
    <div style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:7,marginBottom:nextSame?2:10,padding:"0 10px"}}
      onContextMenu={e=>{e.preventDefault();setShowActions(a=>!a);}}
      onTouchStart={()=>{longRef.current=setTimeout(()=>setShowActions(true),500);}}
      onTouchEnd={()=>clearTimeout(longRef.current)}>
      {!isMe&&<div style={{width:28,flexShrink:0,marginBottom:2}}>{!nextSame&&user&&<Av user={user} size={28}/>}</div>}
      <div style={{maxWidth:"73%",display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",position:"relative"}}>
        {!isMe&&!prevSame&&user&&<span style={{fontSize:11,fontWeight:700,color:"#84cc16",marginBottom:3,marginLeft:2}}>{user?.full_name||user?.name||"Member"}</span>}
        
        {/* Reply quote — stunning design */}
        {replyMsg&&(
          <div style={{display:"flex",alignItems:"stretch",marginBottom:4,borderRadius:isMe?"10px 10px 10px 4px":"10px 10px 4px 10px",overflow:"hidden",maxWidth:"100%",cursor:"pointer"}} onClick={()=>{}}>
            <div style={{width:3,background:isMe?"rgba(255,255,255,.3)":"#84cc16",flexShrink:0}}/>
            <div style={{padding:"5px 10px",background:isMe?"rgba(255,255,255,.06)":"rgba(132,204,22,.06)",minWidth:0,flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,color:isMe?"rgba(255,255,255,.5)":"#84cc16",marginBottom:2}}>
                <Ic.Reply/>
                {replyMsg.user?.full_name||replyMsg.user?.name||"User"}
              </div>
              <div style={{fontSize:11,color:isMe?"rgba(255,255,255,.45)":"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {replyMsg.content?.startsWith("__GIF__:") ? "🎞 GIF" : replyMsg.content?.slice(0,60)}
              </div>
            </div>
          </div>
        )}

        {/* Main bubble */}
        <div style={{padding:isGif?0:"9px 13px",background:isGif?"transparent":(isMe?"linear-gradient(135deg,#84cc16,#65a30d)":"rgba(255,255,255,.07)"),borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",border:isGif?"none":(isMe?"none":"1px solid rgba(255,255,255,.07)"),maxWidth:"100%",wordBreak:"break-word"}}>
          {isGif
            ? <img src={msg.content.replace("__GIF__:","")} alt="GIF" style={{maxWidth:220,maxHeight:170,borderRadius:10,display:"block",objectFit:"cover"}}/>
            : <span style={{fontSize:14,color:isMe?"#000":"#f0f0f0",lineHeight:1.5}}>{msg.content}</span>
          }
        </div>

        {/* Reactions */}
        {reacs.length>0&&(
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4,justifyContent:isMe?"flex-end":"flex-start"}}>
            {reacs.map(([emoji,count])=>(
              <div key={emoji} style={{display:"flex",alignItems:"center",gap:2,padding:"2px 7px",borderRadius:12,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.09)",fontSize:13}}>
                {emoji}<span style={{fontSize:10,fontWeight:700,color:"#888"}}>{count}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",gap:3,marginTop:2,justifyContent:isMe?"flex-end":"flex-start"}}>
          <span style={{fontSize:10,color:"#444"}}>{timeStr(msg.created_at)}</span>
          {isMe&&<Ic.DblChk/>}
        </div>

        {/* Quick react panel */}
        {showActions&&(
          <div style={{position:"absolute",top:-44,[isMe?"right":"left"]:0,display:"flex",gap:4,background:"rgba(14,14,14,.98)",border:"1px solid rgba(255,255,255,.1)",borderRadius:28,padding:"6px 8px",boxShadow:"0 8px 24px rgba(0,0,0,.7)",zIndex:10,animation:"rxIn .15s ease-out",whiteSpace:"nowrap"}}>
            {["😂","❤️","🔥","👍","😭","😮"].map(e=>(
              <button key={e} onClick={()=>{onReact?.(msg.id||msg._tempId,e);setShowActions(false);}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",borderRadius:8,padding:"2px 3px",transition:"transform .1s"}}
                onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.3)"}
                onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}>
                {e}
              </button>
            ))}
            <button onClick={()=>{onReply?.(msg);setShowActions(false);}} style={{background:"rgba(132,204,22,.1)",border:"1px solid rgba(132,204,22,.25)",borderRadius:12,padding:"5px 10px",color:"#84cc16",cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700}}>
              <Ic.Reply/> Reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
MsgBubble.displayName = "MsgBubble";

// ════════════════════════════════════════════════════════════════════════════
// MAIN GroupChatView
// ════════════════════════════════════════════════════════════════════════════
const GroupChatView = ({ group:groupProp, currentUser, onBack, onStartCall }) => {
  const [group,       setGroup]       = useState(groupProp);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [replyTo,     setReplyTo]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [showGif,     setShowGif]     = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [typing,      setTyping]      = useState([]);
  const [sending,     setSending]     = useState(false);
  const endRef    = useRef(null);
  const inputRef  = useRef(null);
  const typTimer  = useRef(null);

  const uid     = currentUser?.id || "";
  const isAdmin = group?.members?.some(m=>m?.id===uid&&m?.is_admin) || group?.created_by===uid;
  const members = Array.isArray(group?.members)?group.members:[];

  useEffect(()=>{
    if (!group?.id) return;
    setLoading(true);
    groupDMService.loadMessages(group.id).then(msgs=>{
      setMessages(msgs||[]);
      setLoading(false);
      setTimeout(()=>endRef.current?.scrollIntoView({behavior:"instant"}),80);
    }).catch(()=>setLoading(false));
  },[group?.id]);

  useEffect(()=>{
    if (!group?.id) return;
    const unsub = groupDMService.subscribeToMessages(group.id,{
      onMessage: msg=>{
        if (!msg?.id) return;
        setMessages(prev=>{
          if (prev.some(m=>m.id===msg.id||m._tempId===msg.id)) return prev;
          return [...prev,msg];
        });
        setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),80);
      },
      onTyping: ({userId,userName,typing:isTyping})=>{
        if (userId===uid) return;
        setTyping(prev=>isTyping?[...prev.filter(n=>n!==userName),userName]:prev.filter(n=>n!==userName));
        if (isTyping) setTimeout(()=>setTyping(p=>p.filter(n=>n!==userName)),4000);
      },
    });
    const unsubUpdate = groupDMService.on(`group_updated:${group.id}`, upd=>{ if(upd?.id) setGroup(g=>({...g,...upd})); });
    return ()=>{ unsub(); unsubUpdate(); };
  },[group?.id,uid]);

  const handleTyping = () => {
    clearTimeout(typTimer.current);
    groupDMService.sendTyping(group.id, true, currentUser?.fullName||currentUser?.full_name||"Someone");
    typTimer.current = setTimeout(()=>groupDMService.sendTyping(group.id,false,currentUser?.fullName||"Someone"),2000);
  };

  const send = async (text=input.trim()) => {
    if (!text||sending||!group?.id) return;
    setInput(""); setReplyTo(null); setSending(true);
    try {
      const norm = {id:uid, full_name:currentUser?.fullName||currentUser?.full_name||"You", avatar_id:currentUser?.avatarId||currentUser?.avatar_id};
      const msg = await groupDMService.sendMessage(group.id, text, norm, replyTo?.id||null);
      if (msg) {
        setMessages(prev=>{
          const without = prev.filter(m=>!m._optimistic||m.content!==text);
          return without.some(m=>m.id===msg.id)?without:[...without,msg];
        });
        setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),80);
      }
    } catch(e){ console.warn("[GroupChat] send:",e.message); }
    finally{ setSending(false); }
  };

  const handleReact = (msgId, emoji) => {
    setMessages(prev=>prev.map(m=>{
      if(m.id!==msgId&&m._tempId!==msgId) return m;
      const r={...(m.reactions||{})};
      const users={...(r._users||{})};
      const prev_=users[uid];
      if(prev_===emoji){delete users[uid];r[emoji]=Math.max(0,(r[emoji]||1)-1);if(!r[emoji])delete r[emoji];}
      else{if(prev_){r[prev_]=Math.max(0,(r[prev_]||1)-1);if(!r[prev_])delete r[prev_];}r[emoji]=(r[emoji]||0)+1;users[uid]=emoji;}
      return{...m,reactions:{...r,_users:users}};
    }));
  };

  const iconDisplay = group?.icon_url
    ? <img src={group.icon_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
    : <span style={{fontSize:20}}>{group?.icon||"👥"}</span>;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#000",overflow:"hidden"}}>
      <style>{`@keyframes rxIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}@keyframes gcSpin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"calc(env(safe-area-inset-top,0px)+10px) 13px 10px",background:"rgba(0,0,0,.98)",borderBottom:"1px solid rgba(132,204,22,.1)",flexShrink:0}}>
        <button onClick={onBack} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",color:"#84cc16",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><Ic.Back/></button>
        <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(132,204,22,.1)",border:"1.5px solid rgba(132,204,22,.25)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{iconDisplay}</div>
        <div style={{flex:1,minWidth:0,cursor:isAdmin?"pointer":"default"}} onClick={()=>isAdmin&&setShowEdit(true)}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:14,fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{group?.name}</span>
            {isAdmin&&<span style={{color:"#84cc16",opacity:.6}}><Ic.Edit/></span>}
          </div>
          <span style={{fontSize:11,color:typing.length>0?"#84cc16":"#555",fontStyle:typing.length>0?"italic":"normal"}}>
            {typing.length>0?`${typing[0]} is typing…`:`${members.length} members`}
          </span>
        </div>
        <button onClick={()=>setShowMembers(s=>!s)} style={{width:34,height:34,borderRadius:10,background:showMembers?"rgba(132,204,22,.12)":"rgba(255,255,255,.04)",border:`1px solid ${showMembers?"rgba(132,204,22,.3)":"rgba(255,255,255,.07)"}`,color:showMembers?"#84cc16":"#666",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Ic.Users/></button>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 0 8px",display:"flex",flexDirection:"column"}}>
          {loading&&<div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:22,height:22,border:"2px solid rgba(132,204,22,.15)",borderTopColor:"#84cc16",borderRadius:"50%",animation:"gcSpin .7s linear infinite"}}/></div>}
          {!loading&&messages.length===0&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,color:"#444"}}>
              <div style={{fontSize:48,marginBottom:12}}>{group?.icon||"👥"}</div>
              <div style={{fontSize:15,fontWeight:700,color:"#555",marginBottom:4}}>Start the conversation</div>
              <div style={{fontSize:12,color:"#3a3a3a"}}>Say hi to the group!</div>
            </div>
          )}
          {messages.map((msg,i)=>{
            const prev = messages[i-1];
            const next = messages[i+1];
            const isMe = msg.user_id===uid||msg.sender_id===uid;
            const prevSame = prev&&(prev.user_id===msg.user_id||prev.sender_id===msg.sender_id);
            const nextSame = next&&(next.user_id===msg.user_id||next.sender_id===msg.sender_id);
            let m2 = msg;
            if (msg.reply_to_id&&!msg._replyMsg) {
              const found = messages.find(x=>x.id===msg.reply_to_id);
              if (found) m2 = {...msg,_replyMsg:found};
            }
            return <MsgBubble key={msg._tempId||msg.id} msg={m2} isMe={isMe} prevSame={prevSame} nextSame={nextSame} members={members} onReply={setReplyTo} onReact={handleReact}/>;
          })}
          <div ref={endRef}/>
        </div>

        {/* Members panel */}
        {showMembers&&(
          <div style={{width:180,background:"rgba(8,8,8,.97)",borderLeft:"1px solid rgba(255,255,255,.06)",overflowY:"auto",flexShrink:0}}>
            <div style={{padding:"12px 12px 8px",borderBottom:"1px solid rgba(255,255,255,.05)"}}><span style={{fontSize:10,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:".6px"}}>Members · {members.length}</span></div>
            {members.map(m=>m&&(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px"}}>
                <Av user={m} size={26}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.full_name||m.name||"?"}</div>
                  {m.is_admin&&<div style={{fontSize:9,fontWeight:700,color:"#84cc16"}}>ADMIN</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply preview */}
      {replyTo&&(
        <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 13px",background:"rgba(132,204,22,.05)",borderTop:"1px solid rgba(132,204,22,.15)",borderLeft:"3px solid #84cc16",animation:"rxIn .2s ease-out",flexShrink:0}}>
          <Ic.Reply/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"#84cc16",marginBottom:1}}>{replyTo.user?.full_name||replyTo.user?.name||"User"}</div>
            <div style={{fontSize:12,color:"#777",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{replyTo.content?.startsWith("__GIF__:")?"🎞 GIF":replyTo.content?.slice(0,70)}</div>
          </div>
          <button onClick={()=>setReplyTo(null)} style={{color:"#555",background:"none",border:"none",cursor:"pointer",padding:2}}><Ic.Close/></button>
        </div>
      )}

      {/* Input */}
      <div style={{background:"rgba(0,0,0,.98)",borderTop:"1px solid rgba(255,255,255,.06)",padding:"9px 12px calc(env(safe-area-inset-bottom,0px)+9px)",position:"relative",flexShrink:0}}>
        {showEmoji&&<EmojiPicker onSelect={e=>{setInput(i=>i+e);setShowEmoji(false);inputRef.current?.focus();}} onClose={()=>setShowEmoji(false)}/>}
        {showGif&&<GifPicker onSelect={(url)=>{send(`__GIF__:${url}`);setShowGif(false);}} onClose={()=>setShowGif(false)}/>}
        <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>{setShowEmoji(s=>!s);setShowGif(false);}} style={{width:34,height:34,borderRadius:"50%",background:showEmoji?"rgba(132,204,22,.12)":"rgba(255,255,255,.04)",border:`1px solid ${showEmoji?"rgba(132,204,22,.3)":"rgba(255,255,255,.07)"}`,color:showEmoji?"#84cc16":"#666",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Ic.Smile/></button>
            <button onClick={()=>{setShowGif(s=>!s);setShowEmoji(false);}} style={{width:34,height:34,borderRadius:"50%",background:showGif?"rgba(96,165,250,.12)":"rgba(255,255,255,.04)",border:`1px solid ${showGif?"rgba(96,165,250,.3)":"rgba(255,255,255,.07)"}`,color:showGif?"#60a5fa":"#666",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Ic.Gif/></button>
          </div>
          <textarea ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);handleTyping();}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} rows={1} placeholder="Message the group…"
            style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.09)",borderRadius:20,color:"#fff",fontSize:14,padding:"9px 15px",outline:"none",resize:"none",fontFamily:"inherit",caretColor:"#84cc16",lineHeight:1.45,maxHeight:120,overflowY:"auto",transition:"border-color .15s"}}
            onFocus={e=>e.target.style.borderColor="rgba(132,204,22,.4)"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.09)"}/>
          <button onClick={()=>send()} disabled={!input.trim()||sending} style={{width:40,height:40,borderRadius:"50%",background:input.trim()?"linear-gradient(135deg,rgba(132,204,22,.25),rgba(101,163,13,.2))":"rgba(255,255,255,.04)",border:`1.5px solid ${input.trim()?"rgba(132,204,22,.5)":"rgba(255,255,255,.07)"}`,color:input.trim()?"#84cc16":"#333",display:"flex",alignItems:"center",justifyContent:"center",cursor:input.trim()?"pointer":"default",transition:"all .15s",flexShrink:0}}>
            <Ic.Send/>
          </button>
        </div>
      </div>

      {showEdit&&<GroupEditModal group={group} onSave={setGroup} onClose={()=>setShowEdit(false)}/>}
    </div>
  );
};

export default GroupChatView;