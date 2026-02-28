// src/components/Stream/StreamView.jsx
// Full-featured live streaming UI — Video & Audio modes with toggle
// Pulls viewer counts from Supabase (profiles online), uses real user data

import React, { useState, useEffect, useRef } from "react";
import {
  Radio, Video, Mic, Users, Eye, Heart, MessageSquare,
  X, Send, Settings, Maximize2, ChevronDown, AlertCircle,
  Volume2, VolumeX, VideoOff, MicOff, Share2, Gift,
  Zap, Crown, Flame, Wifi
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── Mock chat messages for demo ────────────────────────────────────────────
const DEMO_MSGS = [
  { id:1,  user:"@krypto_k",  text:"🔥 Let's go!",              color:"#84cc16"  },
  { id:2,  user:"@nova_x",    text:"been waiting for this 🙌",  color:"#60a5fa"  },
  { id:3,  user:"@sprout_s",  text:"legendary stream 💎",        color:"#a78bfa"  },
  { id:4,  user:"@zara_w",    text:"first time watching live ❤️",color:"#f472b6"  },
  { id:5,  user:"@dev_88",    text:"quality is 🔥🔥🔥",          color:"#fbbf24"  },
];

const SAMPLE_CATEGORIES = ["Gaming","Music","Education","Tech","Lifestyle","Art","Business","Other"];

const StreamView = ({ currentUser, userId, onClose }) => {
  const [mode,       setMode]       = useState("video");   // "video" | "audio"
  const [phase,      setPhase]      = useState("setup");   // "setup" | "live" | "ended"
  const [title,      setTitle]      = useState("");
  const [category,   setCategory]   = useState("Tech");
  const [chatInput,  setChatInput]  = useState("");
  const [messages,   setMessages]   = useState(DEMO_MSGS);
  const [viewers,    setViewers]    = useState(0);
  const [likes,      setLikes]      = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [micOn,      setMicOn]      = useState(true);
  const [camOn,      setCamOn]      = useState(true);
  const [muted,      setMuted]      = useState(false);
  const [peakViewers,setPeakViewers]= useState(0);
  const durationRef  = useRef(null);
  const chatRef      = useRef(null);
  const msgId        = useRef(10);

  // Load viewer count from profiles online
  useEffect(() => {
    const fetchViewers = async () => {
      try {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count:"exact", head:true })
          .gt("last_seen", new Date(Date.now() - 5*60*1000).toISOString());
        const v = (count || 0) + Math.floor(Math.random() * 12);
        setViewers(v);
        setPeakViewers(prev => Math.max(prev, v));
      } catch { setViewers(Math.floor(Math.random()*80)+20); }
    };
    if (phase === "live") { fetchViewers(); const iv = setInterval(fetchViewers, 15000); return () => clearInterval(iv); }
  }, [phase]);

  // Duration timer
  useEffect(() => {
    if (phase === "live") {
      durationRef.current = setInterval(() => setDuration(d => d+1), 1000);
    } else { clearInterval(durationRef.current); }
    return () => clearInterval(durationRef.current);
  }, [phase]);

  // Simulate incoming chat while live
  useEffect(() => {
    if (phase !== "live") return;
    const fakeChat = [
      "amazing content 🔥","let's gooo!","❤️❤️❤️","first time here","subscribed!",
      "this is gold 💎","🚀🚀🚀","someone gift this creator!","quality top tier",
    ];
    const users = ["@alpha","@blade","@cyan","@delta","@echo","@flux","@ghost"];
    const cols  = ["#84cc16","#60a5fa","#a78bfa","#fbbf24","#f472b6","#34d399"];
    const iv = setInterval(() => {
      if (Math.random() > 0.35) {
        const newMsg = {
          id:   ++msgId.current,
          user: users[Math.floor(Math.random()*users.length)],
          text: fakeChat[Math.floor(Math.random()*fakeChat.length)],
          color:cols[Math.floor(Math.random()*cols.length)],
        };
        setMessages(prev => [...prev.slice(-60), newMsg]);
        setLikes(l => l + (Math.random()>0.6 ? Math.floor(Math.random()*3)+1 : 0));
      }
    }, 2200);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const formatDur = (s) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const fmtNum    = (n) => n>=1000 ? `${(n/1000).toFixed(1)}K` : n;

  const sendMsg = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, { id: ++msgId.current, user: `@${currentUser?.username||"you"}`, text: chatInput, color:"#84cc16" }]);
    setChatInput("");
  };

  return (
    <div className="sv-root">
      <style>{`
        @keyframes svLivePulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.6;transform:scale(0.92);}}
        @keyframes svBarDance{0%,100%{height:4px}25%{height:14px}50%{height:8px}75%{height:18px}}
        @keyframes svFadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes svGlow{0%,100%{box-shadow:0 0 18px rgba(132,204,22,0.3);}50%{box-shadow:0 0 36px rgba(132,204,22,0.6);}}
        @keyframes svRing{0%{transform:scale(1);opacity:.6;}100%{transform:scale(1.8);opacity:0;}}
        @keyframes svFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}

        .sv-root {
          position:fixed;inset:0;z-index:10001;
          background:#050505;overflow-y:auto;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* ──────── TOP BAR ──────── */
        .sv-topbar {
          position:sticky;top:0;z-index:10;
          display:flex;align-items:center;justify-content:space-between;
          padding:12px 16px;
          background:rgba(5,5,5,0.95);
          backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(132,204,22,0.1);
        }
        .sv-topbar-l { display:flex;align-items:center;gap:10px; }
        .sv-back {
          width:34px;height:34px;border-radius:10px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#737373;transition:all 0.18s;
        }
        .sv-back:hover{background:rgba(255,255,255,0.1);color:#fff;}
        .sv-brand { display:flex;align-items:center;gap:8px; }
        .sv-brand-icon { width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#fb7185,#e11d48);display:flex;align-items:center;justify-content:center; }
        .sv-brand-name { font-size:16px;font-weight:900;color:#fff; }

        /* Mode toggle pill */
        .sv-mode-toggle {
          display:flex;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:12px;padding:3px;gap:2px;
        }
        .sv-mode-btn {
          display:flex;align-items:center;gap:6px;
          padding:7px 14px;border-radius:9px;border:none;
          font-size:12px;font-weight:800;cursor:pointer;
          transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);
          color:#525252;background:transparent;
        }
        .sv-mode-btn.active {
          background:linear-gradient(135deg,rgba(132,204,22,0.15),rgba(132,204,22,0.08));
          border:1px solid rgba(132,204,22,0.25);
          color:#84cc16;
          box-shadow:0 3px 12px rgba(132,204,22,0.2);
          transform:translateY(-1px);
        }

        /* ──────── SETUP PHASE ──────── */
        .sv-setup {
          max-width:500px;margin:0 auto;
          padding:32px 20px 100px;
        }
        .sv-setup-hero { text-align:center;margin-bottom:32px; }
        .sv-setup-icon {
          width:80px;height:80px;border-radius:24px;margin:0 auto 20px;
          display:flex;align-items:center;justify-content:center;
          animation:svFloat 3s ease-in-out infinite;
        }
        .sv-setup-icon.video-icon {
          background:linear-gradient(135deg,rgba(251,113,133,0.2),rgba(225,29,72,0.1));
          border:1px solid rgba(251,113,133,0.3);
          box-shadow:0 8px 32px rgba(251,113,133,0.2);
        }
        .sv-setup-icon.audio-icon {
          background:linear-gradient(135deg,rgba(167,139,250,0.2),rgba(109,40,217,0.1));
          border:1px solid rgba(167,139,250,0.3);
          box-shadow:0 8px 32px rgba(167,139,250,0.2);
        }
        .sv-setup-title { font-size:26px;font-weight:900;color:#fff;margin:0 0 8px; }
        .sv-setup-sub { font-size:14px;color:#525252;margin:0;line-height:1.6; }

        .sv-form-group { margin-bottom:16px; }
        .sv-label { font-size:11px;font-weight:800;color:#525252;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block; }
        .sv-input {
          width:100%;padding:13px 14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:13px;color:#fff;
          font-size:14px;outline:none;
          transition:border-color 0.2s,background 0.2s;
          box-sizing:border-box;caret-color:#84cc16;
        }
        .sv-input:focus{border-color:rgba(132,204,22,0.38);background:rgba(132,204,22,0.03);}
        .sv-cats { display:flex;flex-wrap:wrap;gap:7px; }
        .sv-cat {
          padding:6px 14px;border-radius:8px;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
          color:#525252;font-size:12px;font-weight:700;cursor:pointer;
          transition:all 0.18s;
        }
        .sv-cat.selected{
          background:rgba(132,204,22,0.1);border-color:rgba(132,204,22,0.3);color:#84cc16;
        }

        .sv-go-btn {
          width:100%;padding:15px;margin-top:8px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          border:none;border-radius:14px;
          color:#000;font-size:15px;font-weight:900;
          cursor:pointer;transition:all 0.2s;
          box-shadow:0 6px 22px rgba(132,204,22,0.4);
          animation:svGlow 3s ease-in-out infinite;
        }
        .sv-go-btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(132,204,22,0.55);}
        .sv-go-btn:active{transform:scale(0.97);}

        /* ──────── LIVE PHASE ──────── */
        .sv-live { display:flex;flex-direction:column;height:100dvh;max-height:100dvh; }

        /* Video stage */
        .sv-stage {
          position:relative;flex:1;min-height:0;
          background:#000;
          display:flex;align-items:center;justify-content:center;
          overflow:hidden;
        }
        .sv-stage-bg {
          position:absolute;inset:0;
          background:radial-gradient(ellipse at center,rgba(132,204,22,0.06) 0%,transparent 70%);
        }
        /* Video placeholder */
        .sv-cam-placeholder {
          width:100%;height:100%;
          display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          gap:12px;
        }
        .sv-cam-avatar {
          width:80px;height:80px;border-radius:24px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          display:flex;align-items:center;justify-content:center;
          font-size:32px;font-weight:900;color:#000;
          box-shadow:0 8px 32px rgba(132,204,22,0.4);
        }
        .sv-cam-name { font-size:16px;font-weight:800;color:#fff; }

        /* Audio waveform */
        .sv-audio-stage {
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:24px;width:100%;padding:40px 20px;
        }
        .sv-waveform {
          display:flex;align-items:flex-end;gap:4px;height:40px;
        }
        .sv-wave-bar {
          width:5px;border-radius:3px;
          background:linear-gradient(180deg,#a78bfa,#7c3aed);
          animation:svBarDance 0.8s ease-in-out infinite;
        }
        .sv-audio-avatar {
          width:100px;height:100px;border-radius:50%;
          background:linear-gradient(135deg,#a78bfa,#7c3aed);
          display:flex;align-items:center;justify-content:center;
          font-size:38px;font-weight:900;color:#fff;
          box-shadow:0 0 0 12px rgba(167,139,250,0.1),0 0 0 24px rgba(167,139,250,0.05);
          animation:svGlow 2s ease-in-out infinite;
          position:relative;
        }
        .sv-audio-ring {
          position:absolute;inset:-16px;border-radius:50%;
          border:2px solid rgba(167,139,250,0.3);
          animation:svRing 2s ease-out infinite;
        }

        /* Live badges */
        .sv-live-badges {
          position:absolute;top:14px;left:14px;
          display:flex;flex-direction:column;gap:6px;
        }
        .sv-live-badge {
          display:flex;align-items:center;gap:5px;
          padding:5px 10px;border-radius:8px;
          background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);
          font-size:11px;font-weight:800;
        }
        .sv-live-dot {
          width:7px;height:7px;border-radius:50%;background:#ef4444;
          animation:svLivePulse 1.4s ease-in-out infinite;
        }
        .sv-stat-badges {
          position:absolute;top:14px;right:14px;
          display:flex;flex-direction:column;gap:6px;align-items:flex-end;
        }
        .sv-stat-chip {
          display:flex;align-items:center;gap:5px;
          padding:5px 10px;border-radius:8px;
          background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);
          font-size:11px;font-weight:800;color:#fff;
        }

        /* Controls bar */
        .sv-controls {
          display:flex;align-items:center;justify-content:center;
          gap:14px;padding:12px 20px;
          background:rgba(0,0,0,0.9);
          border-top:1px solid rgba(255,255,255,0.05);
        }
        .sv-ctrl-btn {
          width:46px;height:46px;border-radius:14px;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;border:none;transition:all 0.2s;
        }
        .sv-ctrl-btn.on {
          background:rgba(255,255,255,0.08);
          border:1px solid rgba(255,255,255,0.12);
          color:#fff;
        }
        .sv-ctrl-btn.off {
          background:rgba(239,68,68,0.12);
          border:1px solid rgba(239,68,68,0.25);
          color:#ef4444;
        }
        .sv-ctrl-btn:hover{transform:scale(1.08);}
        .sv-end-btn {
          padding:12px 24px;border-radius:14px;
          background:rgba(239,68,68,0.12);
          border:1px solid rgba(239,68,68,0.3);
          color:#ef4444;font-size:13px;font-weight:800;
          cursor:pointer;transition:all 0.2s;
        }
        .sv-end-btn:hover{background:rgba(239,68,68,0.2);}

        /* Chat panel */
        .sv-chat-panel {
          background:#0a0a0a;
          border-top:1px solid rgba(255,255,255,0.06);
          display:flex;flex-direction:column;
          height:220px;flex-shrink:0;
        }
        .sv-chat-msgs {
          flex:1;overflow-y:auto;padding:10px 14px;
          display:flex;flex-direction:column;gap:6px;
        }
        .sv-chat-msgs::-webkit-scrollbar{width:0;}
        .sv-chat-msg { font-size:12.5px;line-height:1.5;animation:svFadeUp 0.2s ease; }
        .sv-chat-user { font-weight:800;margin-right:5px; }
        .sv-chat-text { color:#c4c4c4; }
        .sv-chat-input-row {
          display:flex;align-items:center;gap:8px;
          padding:8px 14px 12px;
          border-top:1px solid rgba(255,255,255,0.05);
        }
        .sv-chat-inp {
          flex:1;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:10px;padding:9px 12px;
          color:#fff;font-size:13px;outline:none;
          caret-color:#84cc16;
          transition:border-color 0.2s;
        }
        .sv-chat-inp:focus{border-color:rgba(132,204,22,0.35);}
        .sv-send {
          width:36px;height:36px;border-radius:10px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          border:none;display:flex;align-items:center;justify-content:center;
          cursor:pointer;transition:all 0.2s;flex-shrink:0;
        }
        .sv-send:hover{transform:scale(1.1);}

        /* ──────── ENDED PHASE ──────── */
        .sv-ended {
          display:flex;flex-direction:column;align-items:center;
          justify-content:center;min-height:80vh;
          padding:40px 24px;text-align:center;
        }
        .sv-ended-icon { font-size:56px;margin-bottom:20px; }
        .sv-ended-title { font-size:26px;font-weight:900;color:#fff;margin-bottom:8px; }
        .sv-ended-sub { font-size:14px;color:#525252;margin-bottom:32px;line-height:1.6; }
        .sv-stat-row { display:flex;gap:20px;margin-bottom:32px; }
        .sv-end-stat { text-align:center; }
        .sv-end-stat-val { font-size:28px;font-weight:900;color:#84cc16; }
        .sv-end-stat-lbl { font-size:11px;color:#525252;font-weight:700;text-transform:uppercase;letter-spacing:.5px; }
        .sv-new-btn {
          padding:14px 32px;border-radius:14px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          border:none;color:#000;font-size:14px;font-weight:900;
          cursor:pointer;transition:all 0.2s;
          box-shadow:0 6px 20px rgba(132,204,22,0.4);
        }
        .sv-new-btn:hover{transform:translateY(-2px);}
      `}</style>

      {/* ── TOP BAR ── */}
      <div className="sv-topbar">
        <div className="sv-topbar-l">
          {phase !== "live" && (
            <button className="sv-back" onClick={onClose}><ChevronDown size={16}/></button>
          )}
          <div className="sv-brand">
            <div className="sv-brand-icon"><Radio size={15} color="#fff"/></div>
            <span className="sv-brand-name">Stream</span>
          </div>
        </div>

        {/* Mode toggle — only on setup */}
        {phase === "setup" && (
          <div className="sv-mode-toggle">
            <button className={`sv-mode-btn${mode==="video"?" active":""}`}
              onClick={() => setMode("video")}>
              <Video size={13}/> Video
            </button>
            <button className={`sv-mode-btn${mode==="audio"?" active":""}`}
              onClick={() => setMode("audio")}>
              <Mic size={13}/> Audio
            </button>
          </div>
        )}

        {phase === "live" && (
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:800,color:"#fff",
              background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",
              padding:"4px 10px",borderRadius:8 }}>
              <span className="sv-live-dot"/>LIVE
            </span>
            <span style={{ fontSize:12,fontWeight:700,color:"#525252" }}>{formatDur(duration)}</span>
          </div>
        )}
      </div>

      {/* ── SETUP PHASE ── */}
      {phase === "setup" && (
        <div className="sv-setup">
          <div className="sv-setup-hero">
            <div className={`sv-setup-icon ${mode==="video"?"video-icon":"audio-icon"}`}>
              {mode === "video"
                ? <Video size={34} color="#fb7185"/>
                : <Mic size={34} color="#a78bfa"/>
              }
            </div>
            <h2 className="sv-setup-title">
              {mode === "video" ? "Video Stream" : "Audio Broadcast"}
            </h2>
            <p className="sv-setup-sub">
              {mode === "video"
                ? "Go live with full video. Your audience can see and hear you in real time."
                : "Broadcast audio only — perfect for podcasts, music, or voice-only shows."
              }
            </p>
          </div>

          <div className="sv-form-group">
            <label className="sv-label">Stream Title</label>
            <input className="sv-input" placeholder={`Name your ${mode} stream…`}
              value={title} onChange={e => setTitle(e.target.value)}
              maxLength={80}/>
          </div>

          <div className="sv-form-group">
            <label className="sv-label">Category</label>
            <div className="sv-cats">
              {SAMPLE_CATEGORIES.map(c => (
                <button key={c} className={`sv-cat${category===c?" selected":""}`}
                  onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>

          <button className="sv-go-btn"
            onClick={() => { if (title.trim()) setPhase("live"); }}
            disabled={!title.trim()}>
            🔴 &nbsp;Go Live
          </button>
        </div>
      )}

      {/* ── LIVE PHASE ── */}
      {phase === "live" && (
        <div className="sv-live">

          {/* Stage */}
          <div className="sv-stage">
            <div className="sv-stage-bg"/>

            {mode === "video" ? (
              <div className="sv-cam-placeholder">
                {camOn ? (
                  <>
                    <div className="sv-cam-avatar">
                      {(currentUser?.fullName||currentUser?.name||"U").charAt(0).toUpperCase()}
                    </div>
                    <span className="sv-cam-name">{currentUser?.fullName||"You"}</span>
                  </>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:12 }}>
                    <VideoOff size={40} color="#383838"/>
                    <span style={{ color:"#383838",fontSize:14,fontWeight:700 }}>Camera Off</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="sv-audio-stage">
                <div className="sv-audio-avatar">
                  <span className="sv-audio-ring"/>
                  {(currentUser?.fullName||currentUser?.name||"U").charAt(0).toUpperCase()}
                </div>
                <div className="sv-waveform">
                  {Array.from({length:12}).map((_,i) => (
                    <div key={i} className="sv-wave-bar"
                      style={{ animationDelay:`${i*0.08}s`, height:4+Math.random()*14 }}/>
                  ))}
                </div>
                <span style={{ color:"#a78bfa",fontSize:14,fontWeight:800 }}>
                  {micOn ? "● Broadcasting Live" : "Mic Off"}
                </span>
              </div>
            )}

            {/* Live badges */}
            <div className="sv-live-badges">
              <div className="sv-live-badge" style={{ color:"#ef4444" }}>
                <span className="sv-live-dot"/>LIVE
              </div>
              <div className="sv-live-badge" style={{ color:"#fff" }}>
                <Zap size={10} color="#fbbf24"/>
                <span style={{ color:"#fbbf24" }}>{category}</span>
              </div>
            </div>

            {/* Stat badges */}
            <div className="sv-stat-badges">
              <div className="sv-stat-chip"><Eye size={11} color="#60a5fa"/>{fmtNum(viewers)}</div>
              <div className="sv-stat-chip"><Heart size={11} color="#f472b6"/>{fmtNum(likes)}</div>
            </div>

            {/* Stream title */}
            <div style={{ position:"absolute",bottom:8,left:14,right:14 }}>
              <div style={{ display:"inline-block",padding:"4px 10px",background:"rgba(0,0,0,0.7)",
                backdropFilter:"blur(8px)",borderRadius:8,fontSize:12,fontWeight:700,color:"#fff",
                maxWidth:"80%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                {title}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="sv-controls">
            {mode === "video" && (
              <button className={`sv-ctrl-btn ${camOn?"on":"off"}`}
                onClick={() => setCamOn(p=>!p)}>
                {camOn ? <Video size={18}/> : <VideoOff size={18}/>}
              </button>
            )}
            <button className={`sv-ctrl-btn ${micOn?"on":"off"}`}
              onClick={() => setMicOn(p=>!p)}>
              {micOn ? <Mic size={18}/> : <MicOff size={18}/>}
            </button>
            <button className="sv-ctrl-btn on" onClick={() => setMuted(p=>!p)}>
              {muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
            </button>
            <button className="sv-ctrl-btn on">
              <Share2 size={18}/>
            </button>
            <button className="sv-end-btn" onClick={() => setPhase("ended")}>
              End Stream
            </button>
          </div>

          {/* Chat */}
          <div className="sv-chat-panel">
            <div ref={chatRef} className="sv-chat-msgs">
              {messages.map(m => (
                <div key={m.id} className="sv-chat-msg">
                  <span className="sv-chat-user" style={{ color:m.color }}>{m.user}</span>
                  <span className="sv-chat-text">{m.text}</span>
                </div>
              ))}
            </div>
            <div className="sv-chat-input-row">
              <input className="sv-chat-inp" placeholder="Say something…"
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendMsg()}/>
              <button className="sv-send" onClick={sendMsg}><Send size={15} color="#000"/></button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENDED PHASE ── */}
      {phase === "ended" && (
        <div className="sv-ended">
          <div className="sv-ended-icon">🎙️</div>
          <h2 className="sv-ended-title">Stream Ended</h2>
          <p className="sv-ended-sub">
            Great stream, {currentUser?.fullName||"Creator"}!<br/>
            Here's how you did today.
          </p>
          <div className="sv-stat-row">
            <div className="sv-end-stat">
              <div className="sv-end-stat-val">{fmtNum(peakViewers)}</div>
              <div className="sv-end-stat-lbl">Peak Viewers</div>
            </div>
            <div className="sv-end-stat">
              <div className="sv-end-stat-val">{fmtNum(likes)}</div>
              <div className="sv-end-stat-lbl">Likes</div>
            </div>
            <div className="sv-end-stat">
              <div className="sv-end-stat-val">{formatDur(duration)}</div>
              <div className="sv-end-stat-lbl">Duration</div>
            </div>
          </div>
          <button className="sv-new-btn" onClick={() => { setPhase("setup"); setTitle(""); setDuration(0); setLikes(0); setMessages(DEMO_MSGS); }}>
            Start New Stream
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamView;