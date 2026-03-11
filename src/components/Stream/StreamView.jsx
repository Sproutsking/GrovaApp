// src/components/Stream/StreamView.jsx
// Xeevia Stream — EP-powered live streaming with adaptive quality control
// Video + Audio modes | Bandwidth selector | EP tipping | Multi-guest rooms

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio, Video, Mic, Eye, Heart, X, Send, Maximize2,
  Volume2, VolumeX, VideoOff, MicOff, Share2,
  Zap, Flame, Wifi, WifiOff, Users, Crown, Settings,
  ChevronDown, ChevronUp, Plus, PhoneOff, Cast,
  BarChart2, Gift, TrendingUp, Lock, Unlock, AlertCircle
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── Demo chat messages ─────────────────────────────────────────────────────
const DEMO_MSGS = [
  { id: 1,  user: "@krypto_k",  text: "🔥 first!!",              color: "#84cc16", type: "chat", ep: 0 },
  { id: 2,  user: "@nova_x",    text: "been waiting for this 🙌", color: "#60a5fa", type: "chat", ep: 0 },
  { id: 3,  user: "@sprout_s",  text: "sent 5 EP ⚡",            color: "#fbbf24", type: "tip",  ep: 5 },
  { id: 4,  user: "@zara_w",    text: "legendary stream 💎",      color: "#a78bfa", type: "chat", ep: 0 },
  { id: 5,  user: "@dev_88",    text: "sent 10 EP ⚡",           color: "#f472b6", type: "tip",  ep: 10 },
];

// ── Network quality presets ────────────────────────────────────────────────
const NETWORK_PRESETS = [
  { id: "ultra",   label: "Ultra HD",   sub: "~4 Mbps",   badge: "Best",    color: "#84cc16", res: "1080p" },
  { id: "high",    label: "High",       sub: "~2 Mbps",   badge: "Clear",   color: "#60a5fa", res: "720p"  },
  { id: "medium",  label: "Medium",     sub: "~800 Kbps", badge: "Smooth",  color: "#fbbf24", res: "480p"  },
  { id: "low",     label: "Data Saver", sub: "~300 Kbps", badge: "Lite",    color: "#f97316", res: "360p"  },
  { id: "minimal", label: "Minimal",    sub: "~100 Kbps", badge: "Ultra-lite",color:"#f472b6",res: "240p"  },
];

const CATEGORIES = ["Music 🎵", "Talk 🎙️", "Gaming 🎮", "Education 📚", "Fitness 💪", "Art 🎨", "Business 💼", "Tech ⚡"];

const EP_TIPS = [2, 5, 10, 25, 50, 100];

const FAKE_CHAT = [
  "🔥🔥🔥","let's gooo!","❤️❤️","quality is insane","first time here","vibing hard",
  "🚀 this is it","subscribed!","sent EP ⚡","need this energy","top tier creator",
];
const FAKE_USERS = ["@alpha","@blade","@cyan_v","@delta9","@echo88","@flux_k","@ghost","@hex","@iris","@jade_w"];
const FAKE_COLS  = ["#84cc16","#60a5fa","#a78bfa","#fbbf24","#f472b6","#34d399","#fb923c","#e879f9"];

// ── Animated bar for audio ─────────────────────────────────────────────────
const AudioBars = ({ active, color = "#a78bfa" }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
    {Array.from({ length: 14 }).map((_, i) => (
      <div key={i} style={{
        width: 4, borderRadius: 2,
        background: active ? color : "rgba(255,255,255,0.1)",
        height: active ? `${8 + Math.random() * 24}px` : "4px",
        animation: active ? `svBar 0.7s ease-in-out ${i * 0.06}s infinite` : "none",
        transition: "background 0.3s",
      }}/>
    ))}
  </div>
);

// ── Live stats pill ────────────────────────────────────────────────────────
const StatPill = ({ icon: Icon, value, color }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 8,
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
    fontSize: 11, fontWeight: 800, color: "#fff",
  }}>
    <Icon size={11} color={color}/>{value}
  </div>
);

const StreamView = ({ currentUser, userId, onClose, isSidebar = false }) => {
  const [mode,          setMode]          = useState("video");    // video | audio
  const [phase,         setPhase]         = useState("setup");    // setup | live | ended
  const [title,         setTitle]         = useState("");
  const [category,      setCategory]      = useState("Tech ⚡");
  const [networkPreset, setNetworkPreset] = useState("high");
  const [chatInput,     setChatInput]     = useState("");
  const [messages,      setMessages]      = useState(DEMO_MSGS);
  const [viewers,       setViewers]       = useState(0);
  const [likes,         setLikes]         = useState(0);
  const [epEarned,      setEpEarned]      = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [micOn,         setMicOn]         = useState(true);
  const [camOn,         setCamOn]         = useState(true);
  const [muted,         setMuted]         = useState(false);
  const [peakViewers,   setPeakViewers]   = useState(0);
  const [showNetwork,   setShowNetwork]   = useState(false);
  const [showTipPanel,  setShowTipPanel]  = useState(false);
  const [isPrivate,     setIsPrivate]     = useState(false);
  const [guestSlots,    setGuestSlots]    = useState([null, null]); // up to 2 guests
  const [signalStrength,setSignalStrength]= useState(4); // 1-5
  const [totalTips,     setTotalTips]     = useState(0);
  const [tab,           setTab]           = useState("chat"); // chat | tips | viewers

  const durationRef  = useRef(null);
  const chatRef      = useRef(null);
  const msgId        = useRef(10);

  const preset = NETWORK_PRESETS.find(p => p.id === networkPreset) || NETWORK_PRESETS[1];

  // Fetch viewers from Supabase
  useEffect(() => {
    if (phase !== "live") return;
    const fetchViewers = async () => {
      try {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gt("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString());
        const v = (count || 0) + Math.floor(Math.random() * 18) + 5;
        setViewers(v);
        setPeakViewers(prev => Math.max(prev, v));
      } catch {
        setViewers(Math.floor(Math.random() * 80) + 20);
      }
    };
    fetchViewers();
    const iv = setInterval(fetchViewers, 15000);
    return () => clearInterval(iv);
  }, [phase]);

  // Duration timer
  useEffect(() => {
    if (phase === "live") {
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      clearInterval(durationRef.current);
    }
    return () => clearInterval(durationRef.current);
  }, [phase]);

  // Simulate chat + tips + signal fluctuation
  useEffect(() => {
    if (phase !== "live") return;
    const iv = setInterval(() => {
      if (Math.random() > 0.35) {
        const isTip = Math.random() > 0.78;
        const tipAmt = EP_TIPS[Math.floor(Math.random() * 3)];
        const msg = {
          id:    ++msgId.current,
          user:  FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)],
          text:  isTip ? `sent ${tipAmt} EP ⚡` : FAKE_CHAT[Math.floor(Math.random() * FAKE_CHAT.length)],
          color: FAKE_COLS[Math.floor(Math.random() * FAKE_COLS.length)],
          type:  isTip ? "tip" : "chat",
          ep:    isTip ? tipAmt : 0,
        };
        setMessages(prev => [...prev.slice(-80), msg]);
        if (isTip) {
          setEpEarned(e => e + Math.floor(tipAmt * 0.84)); // 84% creator share
          setTotalTips(t => t + tipAmt);
        }
        setLikes(l => l + (Math.random() > 0.65 ? Math.floor(Math.random() * 3) + 1 : 0));
      }
      // Fluctuate signal
      setSignalStrength(s => Math.max(1, Math.min(5, s + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0))));
    }, 2000);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const fmtDur = (s) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtNum = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const sendMsg = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {
      id: ++msgId.current,
      user: `@${currentUser?.username || "you"}`,
      text: chatInput,
      color: "#84cc16",
      type: "chat", ep: 0,
    }]);
    setChatInput("");
  };

  const sendTip = (amount) => {
    setMessages(prev => [...prev, {
      id: ++msgId.current,
      user: `@${currentUser?.username || "you"}`,
      text: `sent ${amount} EP ⚡`,
      color: "#fbbf24",
      type: "tip", ep: amount,
    }]);
    setShowTipPanel(false);
  };

  const signalColor = signalStrength >= 4 ? "#84cc16" : signalStrength >= 3 ? "#fbbf24" : "#ef4444";
  const signalBars  = Array.from({ length: 5 }, (_, i) => i < signalStrength);

  const initials = (currentUser?.fullName || currentUser?.name || "U").charAt(0).toUpperCase();

  return (
    <div className={`sv-root ${isSidebar ? "sv-sidebar" : "sv-fullscreen"}`}>
      <style>{`
        @keyframes svLivePulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.55;transform:scale(0.88);}}
        @keyframes svBar{0%,100%{height:4px}25%{height:20px}50%{height:10px}75%{height:26px}}
        @keyframes svFadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes svGlow{0%,100%{box-shadow:0 0 18px rgba(132,204,22,0.25);}50%{box-shadow:0 0 34px rgba(132,204,22,0.5);}}
        @keyframes svRing{0%{transform:scale(1);opacity:.5;}100%{transform:scale(1.9);opacity:0;}}
        @keyframes svFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
        @keyframes svSlide{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
        @keyframes svTipPop{0%{transform:scale(0.7);opacity:0;}70%{transform:scale(1.1);}100%{transform:scale(1);opacity:1;}}

        .sv-root{
          display:flex;flex-direction:column;
          background:#050505;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          color:#fff;overflow:hidden;
        }
        .sv-fullscreen{position:fixed;inset:0;z-index:10001;}
        .sv-sidebar{
          position:relative;height:100%;
          border-left:1px solid rgba(132,204,22,0.1);
        }

        /* TOP BAR */
        .sv-topbar{
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 14px;
          background:rgba(5,5,5,0.96);
          backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(132,204,22,0.08);
          flex-shrink:0;
        }
        .sv-topbar-l{display:flex;align-items:center;gap:8px;}
        .sv-icon-btn{
          width:32px;height:32px;border-radius:9px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#737373;transition:all 0.15s;flex-shrink:0;
        }
        .sv-icon-btn:hover{background:rgba(255,255,255,0.09);color:#fff;}
        .sv-brand{display:flex;align-items:center;gap:7px;}
        .sv-brand-dot{
          width:28px;height:28px;border-radius:8px;
          background:linear-gradient(135deg,#fb7185,#e11d48);
          display:flex;align-items:center;justify-content:center;
        }
        .sv-brand-name{font-size:15px;font-weight:900;color:#fff;letter-spacing:-0.3px;}

        /* Mode toggle */
        .sv-mode-toggle{
          display:flex;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:2px;gap:2px;
        }
        .sv-mode-btn{
          display:flex;align-items:center;gap:5px;
          padding:6px 12px;border-radius:8px;border:none;
          font-size:11px;font-weight:800;cursor:pointer;
          transition:all 0.2s;color:#525252;background:transparent;
        }
        .sv-mode-btn.active{
          background:rgba(132,204,22,0.12);border:1px solid rgba(132,204,22,0.22);
          color:#84cc16;box-shadow:0 2px 10px rgba(132,204,22,0.18);
        }

        /* SETUP */
        .sv-setup{overflow-y:auto;padding:20px 16px 80px;flex:1;}
        .sv-setup-hero{text-align:center;margin-bottom:24px;}
        .sv-setup-icon{
          width:72px;height:72px;border-radius:22px;margin:0 auto 16px;
          display:flex;align-items:center;justify-content:center;
          animation:svFloat 3s ease-in-out infinite;
        }
        .sv-setup-title{font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;}
        .sv-setup-sub{font-size:13px;color:#525252;margin:0;line-height:1.5;}

        .sv-form-group{margin-bottom:14px;}
        .sv-label{font-size:10px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;display:block;}
        .sv-input{
          width:100%;padding:11px 12px;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
          border-radius:11px;color:#fff;font-size:13px;outline:none;
          transition:border-color 0.2s;box-sizing:border-box;caret-color:#84cc16;
        }
        .sv-input:focus{border-color:rgba(132,204,22,0.35);}
        .sv-cats{display:flex;flex-wrap:wrap;gap:6px;}
        .sv-cat{
          padding:5px 11px;border-radius:7px;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
          color:#444;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s;
        }
        .sv-cat.sel{background:rgba(132,204,22,0.1);border-color:rgba(132,204,22,0.28);color:#84cc16;}

        /* Network preset selector */
        .sv-network-grid{display:flex;flex-direction:column;gap:6px;}
        .sv-net-btn{
          display:flex;align-items:center;gap:10px;
          padding:10px 12px;border-radius:10px;
          background:rgba(255,255,255,0.03);border:1.5px solid rgba(255,255,255,0.07);
          cursor:pointer;transition:all 0.15s;text-align:left;
        }
        .sv-net-btn.active{border-color:var(--nc,#84cc16);background:rgba(132,204,22,0.06);}
        .sv-net-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
        .sv-net-info{flex:1;}
        .sv-net-label{font-size:12px;font-weight:800;color:#c4c4c4;}
        .sv-net-sub{font-size:10px;color:#444;margin-top:1px;}
        .sv-net-badge{
          padding:2px 8px;border-radius:5px;font-size:9px;font-weight:800;
        }

        /* Privacy toggle */
        .sv-privacy-row{
          display:flex;align-items:center;justify-content:space-between;
          padding:11px 12px;border-radius:11px;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
        }
        .sv-toggle{
          width:42px;height:24px;border-radius:12px;cursor:pointer;
          background:rgba(255,255,255,0.1);border:none;
          position:relative;transition:background 0.22s;flex-shrink:0;
        }
        .sv-toggle.on{background:linear-gradient(135deg,#84cc16,#4d7c0f);}
        .sv-toggle::after{
          content:'';position:absolute;top:3px;left:3px;
          width:18px;height:18px;border-radius:50%;
          background:#fff;transition:transform 0.22s;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
        }
        .sv-toggle.on::after{transform:translateX(18px);}

        /* Go live button */
        .sv-go-btn{
          width:100%;padding:13px;margin-top:10px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          border:none;border-radius:13px;
          color:#000;font-size:14px;font-weight:900;cursor:pointer;
          transition:all 0.18s;
          box-shadow:0 5px 20px rgba(132,204,22,0.38);
          animation:svGlow 3s ease-in-out infinite;
        }
        .sv-go-btn:hover{transform:translateY(-2px);box-shadow:0 9px 28px rgba(132,204,22,0.52);}
        .sv-go-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}

        /* LIVE LAYOUT */
        .sv-live{display:flex;flex-direction:column;height:100%;overflow:hidden;}

        /* Stage */
        .sv-stage{
          position:relative;flex:1;min-height:0;
          background:#000;
          display:flex;align-items:center;justify-content:center;
          overflow:hidden;
        }
        .sv-stage-bg{
          position:absolute;inset:0;
          background:radial-gradient(ellipse at center,rgba(132,204,22,0.04) 0%,transparent 70%);
        }
        .sv-cam-ph{
          width:100%;height:100%;
          display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:10px;
        }
        .sv-cam-av{
          width:72px;height:72px;border-radius:22px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          display:flex;align-items:center;justify-content:center;
          font-size:28px;font-weight:900;color:#000;
          box-shadow:0 6px 28px rgba(132,204,22,0.38);
        }
        .sv-cam-name{font-size:14px;font-weight:800;color:#fff;}
        .sv-audio-stage{
          display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:20px;width:100%;padding:32px 20px;
        }
        .sv-audio-av{
          width:90px;height:90px;border-radius:50%;
          background:linear-gradient(135deg,#a78bfa,#7c3aed);
          display:flex;align-items:center;justify-content:center;
          font-size:34px;font-weight:900;color:#fff;position:relative;
          box-shadow:0 0 0 10px rgba(167,139,250,0.1),0 0 0 20px rgba(167,139,250,0.05);
        }
        .sv-audio-ring{
          position:absolute;inset:-14px;border-radius:50%;
          border:2px solid rgba(167,139,250,0.3);
          animation:svRing 1.8s ease-out infinite;
        }

        /* Overlay badges */
        .sv-live-bl{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:5px;}
        .sv-live-badge{
          display:flex;align-items:center;gap:4px;
          padding:4px 9px;border-radius:7px;
          background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);
          font-size:10px;font-weight:800;
        }
        .sv-live-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;animation:svLivePulse 1.4s ease-in-out infinite;}
        .sv-stat-br{position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:5px;align-items:flex-end;}

        /* Signal indicator */
        .sv-signal{
          display:flex;align-items:flex-end;gap:2px;padding:4px 9px;
          border-radius:7px;background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);
        }
        .sv-signal-bar{width:3px;border-radius:1px;transition:all 0.3s;}

        /* Guest slots */
        .sv-guests{
          position:absolute;bottom:48px;right:12px;
          display:flex;flex-direction:column;gap:6px;
        }
        .sv-guest-slot{
          width:56px;height:80px;border-radius:12px;
          background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.1);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;backdrop-filter:blur(8px);
          transition:border-color 0.15s;
        }
        .sv-guest-slot:hover{border-color:rgba(132,204,22,0.3);}

        /* Title bar on stage */
        .sv-stage-title{
          position:absolute;bottom:10px;left:12px;right:80px;
        }
        .sv-stage-title-chip{
          display:inline-flex;align-items:center;gap:6px;
          padding:4px 10px;background:rgba(0,0,0,0.65);
          backdropFilter:blur(8px);border-radius:7px;
          font-size:11px;font-weight:700;color:#fff;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        }

        /* EP earned badge */
        .sv-ep-earned{
          position:absolute;bottom:10px;right:12px;
          display:flex;align-items:center;gap:4px;
          padding:4px 10px;border-radius:7px;
          background:rgba(132,204,22,0.18);border:1px solid rgba(132,204,22,0.3);
          backdrop-filter:blur(8px);font-size:11px;font-weight:900;color:#84cc16;
        }

        /* Controls */
        .sv-controls{
          display:flex;align-items:center;gap:8px;
          padding:10px 12px;
          background:rgba(0,0,0,0.92);
          border-top:1px solid rgba(255,255,255,0.04);
          flex-shrink:0;
          flex-wrap:wrap;justify-content:center;
        }
        .sv-ctrl{
          width:42px;height:42px;border-radius:12px;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;border:none;transition:all 0.15s;
        }
        .sv-ctrl.on{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#fff;}
        .sv-ctrl.off{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.22);color:#ef4444;}
        .sv-ctrl.active-hl{background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.22);color:#84cc16;}
        .sv-ctrl:hover{transform:scale(1.08);}
        .sv-end-btn{
          padding:10px 18px;border-radius:12px;
          background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);
          color:#ef4444;font-size:12px;font-weight:800;cursor:pointer;transition:all 0.15s;
        }
        .sv-end-btn:hover{background:rgba(239,68,68,0.18);}

        /* Network pill in controls */
        .sv-net-pill{
          display:flex;align-items:center;gap:5px;
          padding:6px 11px;border-radius:10px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
          cursor:pointer;font-size:10px;font-weight:800;transition:all 0.15s;
          color:#737373;
        }
        .sv-net-pill:hover{border-color:rgba(132,204,22,0.3);color:#84cc16;}

        /* Network dropdown */
        .sv-net-dropdown{
          position:absolute;bottom:56px;left:50%;transform:translateX(-50%);
          background:#0d0d0d;border:1px solid rgba(255,255,255,0.1);
          border-radius:14px;padding:10px;width:260px;z-index:200;
          box-shadow:0 12px 36px rgba(0,0,0,0.6);
          animation:svSlide 0.18s ease;
        }
        .sv-dropdown-title{font-size:10px;font-weight:800;color:#383838;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;padding:0 4px;}

        /* Tabs */
        .sv-tabs{
          display:flex;padding:6px 12px 0;gap:4px;
          background:rgba(0,0,0,0.88);flex-shrink:0;
          border-top:1px solid rgba(255,255,255,0.04);
        }
        .sv-tab{
          flex:1;padding:7px;border-radius:8px;border:none;
          font-size:10px;font-weight:800;cursor:pointer;
          transition:all 0.15s;color:#383838;background:transparent;
          text-transform:uppercase;letter-spacing:.4px;
        }
        .sv-tab.active{background:rgba(132,204,22,0.1);color:#84cc16;}

        /* Chat panel */
        .sv-chat-panel{
          flex:1;min-height:0;display:flex;flex-direction:column;
          background:#060606;overflow:hidden;
        }
        .sv-chat-msgs{
          flex:1;overflow-y:auto;padding:8px 12px;
          display:flex;flex-direction:column;gap:5px;
        }
        .sv-chat-msgs::-webkit-scrollbar{width:0;}
        .sv-chat-msg{font-size:12px;line-height:1.45;animation:svFadeUp 0.18s ease;}
        .sv-chat-user{font-weight:800;margin-right:4px;}
        .sv-chat-text{color:#c4c4c4;}
        .sv-tip-msg{
          display:flex;align-items:center;gap:6px;
          padding:5px 9px;border-radius:8px;
          background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.18);
          animation:svFadeUp 0.18s ease;
        }
        .sv-tip-msg-user{font-size:11px;font-weight:800;color:#fbbf24;}
        .sv-tip-msg-text{font-size:11px;color:#c4c4c4;}
        .sv-chat-input-row{
          display:flex;align-items:center;gap:7px;
          padding:7px 12px 10px;
          border-top:1px solid rgba(255,255,255,0.04);
          flex-shrink:0;
        }
        .sv-chat-inp{
          flex:1;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:9px;padding:8px 11px;
          color:#fff;font-size:12px;outline:none;
          caret-color:#84cc16;transition:border-color 0.15s;
        }
        .sv-chat-inp:focus{border-color:rgba(132,204,22,0.32);}
        .sv-tip-btn{
          width:32px;height:32px;border-radius:9px;flex-shrink:0;
          background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;transition:all 0.15s;
        }
        .sv-tip-btn:hover{background:rgba(251,191,36,0.2);}
        .sv-send{
          width:32px;height:32px;border-radius:9px;flex-shrink:0;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          border:none;display:flex;align-items:center;justify-content:center;
          cursor:pointer;transition:all 0.15s;
        }
        .sv-send:hover{transform:scale(1.08);}

        /* Tip panel */
        .sv-tip-panel{
          padding:10px 12px;
          background:rgba(251,191,36,0.04);
          border-top:1px solid rgba(251,191,36,0.1);
          flex-shrink:0;
        }
        .sv-tip-label{font-size:10px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px;}
        .sv-tip-grid{display:flex;gap:6px;flex-wrap:wrap;}
        .sv-tip-chip{
          padding:6px 12px;border-radius:8px;
          background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.22);
          color:#fbbf24;font-size:11px;font-weight:800;cursor:pointer;
          transition:all 0.15s;
          animation:svTipPop 0.3s ease;
        }
        .sv-tip-chip:hover{background:rgba(251,191,36,0.2);transform:scale(1.05);}

        /* Viewers tab */
        .sv-viewers-list{flex:1;overflow-y:auto;padding:8px 12px;}
        .sv-viewers-list::-webkit-scrollbar{width:0;}
        .sv-viewer-row{
          display:flex;align-items:center;gap:9px;
          padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);
        }
        .sv-viewer-av{
          width:28px;height:28px;border-radius:9px;
          background:linear-gradient(135deg,#525252,#383838);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:800;color:#fff;flex-shrink:0;
        }
        .sv-viewer-name{font-size:12px;font-weight:700;color:#c4c4c4;flex:1;}
        .sv-viewer-ep{font-size:10px;font-weight:800;color:#fbbf24;}

        /* Stats tab */
        .sv-stats-list{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;}
        .sv-stat-row2{
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;border-radius:11px;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
        }
        .sv-stat-lbl{font-size:11px;color:#525252;font-weight:700;}
        .sv-stat-val{font-size:16px;font-weight:900;}

        /* Ended */
        .sv-ended{
          display:flex;flex-direction:column;align-items:center;
          justify-content:center;flex:1;
          padding:32px 20px;text-align:center;overflow-y:auto;
        }
        .sv-ended-emoji{font-size:52px;margin-bottom:16px;}
        .sv-ended-title{font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;}
        .sv-ended-sub{font-size:13px;color:#525252;margin:0 0 24px;line-height:1.5;}
        .sv-ended-stats{display:flex;gap:16px;margin-bottom:24px;}
        .sv-ended-stat{text-align:center;}
        .sv-ended-val{font-size:24px;font-weight:900;color:#84cc16;display:block;}
        .sv-ended-lbl{font-size:9px;color:#444;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
        .sv-new-btn{
          padding:12px 28px;border-radius:12px;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);
          border:none;color:#000;font-size:13px;font-weight:900;
          cursor:pointer;transition:all 0.15s;
          box-shadow:0 5px 18px rgba(132,204,22,0.38);
        }
        .sv-new-btn:hover{transform:translateY(-2px);}
      `}</style>

      {/* ── TOP BAR ── */}
      <div className="sv-topbar">
        <div className="sv-topbar-l">
          {phase !== "live" && (
            <button className="sv-icon-btn" onClick={onClose}><X size={14}/></button>
          )}
          <div className="sv-brand">
            <div className="sv-brand-dot"><Radio size={13} color="#fff"/></div>
            <span className="sv-brand-name">Stream</span>
          </div>
        </div>

        {phase === "setup" && (
          <div className="sv-mode-toggle">
            <button className={`sv-mode-btn${mode === "video" ? " active" : ""}`}
              onClick={() => setMode("video")}>
              <Video size={12}/> Video
            </button>
            <button className={`sv-mode-btn${mode === "audio" ? " active" : ""}`}
              onClick={() => setMode("audio")}>
              <Mic size={12}/> Audio
            </button>
          </div>
        )}

        {phase === "live" && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 800, color: "#fff",
              background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.28)",
              padding: "3px 9px", borderRadius: 7,
            }}>
              <span className="sv-live-dot"/>LIVE
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#444" }}>{fmtDur(duration)}</span>
          </div>
        )}
      </div>

      {/* ── SETUP ── */}
      {phase === "setup" && (
        <div className="sv-setup">
          <div className="sv-setup-hero">
            <div className={`sv-setup-icon`} style={{
              background: mode === "video"
                ? "linear-gradient(135deg,rgba(251,113,133,0.18),rgba(225,29,72,0.08))"
                : "linear-gradient(135deg,rgba(167,139,250,0.18),rgba(109,40,217,0.08))",
              border: `1px solid ${mode === "video" ? "rgba(251,113,133,0.28)" : "rgba(167,139,250,0.28)"}`,
              boxShadow: `0 8px 28px ${mode === "video" ? "rgba(251,113,133,0.18)" : "rgba(167,139,250,0.18)"}`,
            }}>
              {mode === "video"
                ? <Video size={30} color="#fb7185"/>
                : <Mic size={30} color="#a78bfa"/>
              }
            </div>
            <h2 className="sv-setup-title">
              {mode === "video" ? "Video Stream" : "Audio Broadcast"}
            </h2>
            <p className="sv-setup-sub">
              {mode === "video"
                ? "Broadcast live. Earn EP from every tip and interaction."
                : "Go audio-only — podcasts, talks, music. Low data, high impact."
              }
            </p>
          </div>

          <div className="sv-form-group">
            <label className="sv-label">Stream Title</label>
            <input className="sv-input"
              placeholder={`What's the stream about?`}
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}/>
          </div>

          <div className="sv-form-group">
            <label className="sv-label">Category</label>
            <div className="sv-cats">
              {CATEGORIES.map(c => (
                <button key={c} className={`sv-cat${category === c ? " sel" : ""}`}
                  onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>

          {/* Network quality selector */}
          <div className="sv-form-group">
            <label className="sv-label">Transmission Quality</label>
            <p style={{ fontSize: 11, color: "#383838", marginBottom: 8, lineHeight: 1.4 }}>
              Choose based on your data plan. You can change this mid-stream.
            </p>
            <div className="sv-network-grid">
              {NETWORK_PRESETS.map(p => (
                <button key={p.id}
                  className={`sv-net-btn${networkPreset === p.id ? " active" : ""}`}
                  style={{ "--nc": p.color }}
                  onClick={() => setNetworkPreset(p.id)}>
                  <div className="sv-net-dot" style={{ background: networkPreset === p.id ? p.color : "#383838" }}/>
                  <div className="sv-net-info">
                    <div className="sv-net-label" style={{ color: networkPreset === p.id ? p.color : "#c4c4c4" }}>
                      {p.label} · {p.res}
                    </div>
                    <div className="sv-net-sub">{p.sub} bandwidth</div>
                  </div>
                  <div className="sv-net-badge"
                    style={{ background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}28` }}>
                    {p.badge}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="sv-form-group">
            <label className="sv-label">Visibility</label>
            <div className="sv-privacy-row">
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#c4c4c4", display: "flex", alignItems: "center", gap: 6 }}>
                  {isPrivate ? <Lock size={13} color="#f472b6"/> : <Unlock size={13} color="#84cc16"/>}
                  {isPrivate ? "Private — Invite only" : "Public — Anyone can watch"}
                </div>
                <div style={{ fontSize: 11, color: "#383838", marginTop: 2 }}>
                  {isPrivate ? "Share link to invite viewers" : "Discoverable on Xeevia"}
                </div>
              </div>
              <button className={`sv-toggle${isPrivate ? " on" : ""}`}
                style={isPrivate ? { background: "linear-gradient(135deg,#f472b6,#be185d)" } : {}}
                onClick={() => setIsPrivate(p => !p)}/>
            </div>
          </div>

          <button className="sv-go-btn"
            onClick={() => { if (title.trim()) setPhase("live"); }}
            disabled={!title.trim()}>
            🔴 &nbsp;Go Live Now
          </button>
        </div>
      )}

      {/* ── LIVE ── */}
      {phase === "live" && (
        <div className="sv-live" style={{ position: "relative" }}>

          {/* Stage */}
          <div className="sv-stage">
            <div className="sv-stage-bg"/>

            {mode === "video" ? (
              <div className="sv-cam-ph">
                {camOn ? (
                  <>
                    <div className="sv-cam-av">{initials}</div>
                    <span className="sv-cam-name">{currentUser?.fullName || "You"}</span>
                    <span style={{ fontSize: 11, color: "#525252" }}>{preset.label} · {preset.res}</span>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <VideoOff size={36} color="#383838"/>
                    <span style={{ color: "#383838", fontSize: 13, fontWeight: 700 }}>Camera Off</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="sv-audio-stage">
                <div className="sv-audio-av">
                  <span className="sv-audio-ring"/>
                  {initials}
                </div>
                <AudioBars active={micOn} color="#a78bfa"/>
                <span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 800 }}>
                  {micOn ? "● Broadcasting Audio" : "Mic Muted"}
                </span>
                <span style={{ fontSize: 11, color: "#444" }}>{preset.label} · {preset.sub}</span>
              </div>
            )}

            {/* Left badges */}
            <div className="sv-live-bl">
              <div className="sv-live-badge" style={{ color: "#ef4444" }}>
                <span className="sv-live-dot"/>LIVE
              </div>
              <div className="sv-live-badge" style={{ color: "#fbbf24" }}>
                <Zap size={9} color="#fbbf24"/>{category}
              </div>
              {isPrivate && (
                <div className="sv-live-badge" style={{ color: "#f472b6" }}>
                  <Lock size={9}/> Private
                </div>
              )}
            </div>

            {/* Right stats */}
            <div className="sv-stat-br">
              <StatPill icon={Eye}    value={fmtNum(viewers)} color="#60a5fa"/>
              <StatPill icon={Heart}  value={fmtNum(likes)}   color="#f472b6"/>
              {/* Signal strength */}
              <div className="sv-signal">
                {signalBars.map((active, i) => (
                  <div key={i} className="sv-signal-bar" style={{
                    height: 4 + i * 3,
                    background: active ? signalColor : "rgba(255,255,255,0.12)",
                  }}/>
                ))}
              </div>
            </div>

            {/* Guest slots */}
            <div className="sv-guests">
              {guestSlots.map((g, i) => (
                <div key={i} className="sv-guest-slot">
                  {g ? (
                    <span style={{ fontSize: 20 }}>👤</span>
                  ) : (
                    <Plus size={16} color="#383838"/>
                  )}
                </div>
              ))}
            </div>

            {/* Title */}
            <div className="sv-stage-title">
              <div className="sv-stage-title-chip">
                {isPrivate && <Lock size={9} color="#f472b6"/>}
                {title}
              </div>
            </div>

            {/* EP earned */}
            <div className="sv-ep-earned">
              <Zap size={10}/> +{fmtNum(Math.floor(epEarned))} EP
            </div>

            {/* Network dropdown */}
            {showNetwork && (
              <div className="sv-net-dropdown">
                <div className="sv-dropdown-title">Adjust Quality</div>
                {NETWORK_PRESETS.map(p => (
                  <button key={p.id}
                    className={`sv-net-btn${networkPreset === p.id ? " active" : ""}`}
                    style={{ "--nc": p.color, marginBottom: 5 }}
                    onClick={() => { setNetworkPreset(p.id); setShowNetwork(false); }}>
                    <div className="sv-net-dot" style={{ background: networkPreset === p.id ? p.color : "#383838" }}/>
                    <div className="sv-net-info">
                      <div className="sv-net-label" style={{ color: networkPreset === p.id ? p.color : "#c4c4c4" }}>
                        {p.label} · {p.res}
                      </div>
                      <div className="sv-net-sub">{p.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="sv-controls">
            {mode === "video" && (
              <button className={`sv-ctrl ${camOn ? "on" : "off"}`} onClick={() => setCamOn(p => !p)}>
                {camOn ? <Video size={16}/> : <VideoOff size={16}/>}
              </button>
            )}
            <button className={`sv-ctrl ${micOn ? "on" : "off"}`} onClick={() => setMicOn(p => !p)}>
              {micOn ? <Mic size={16}/> : <MicOff size={16}/>}
            </button>
            <button className="sv-ctrl on" onClick={() => setMuted(p => !p)}>
              {muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
            </button>
            <button className={`sv-ctrl ${showNetwork ? "active-hl" : "on"}`}
              onClick={() => setShowNetwork(p => !p)}>
              <Wifi size={16}/>
            </button>
            <button className="sv-ctrl on"><Share2 size={16}/></button>
            <div className="sv-net-pill" onClick={() => setShowNetwork(p => !p)}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: preset.color }}/>
              {preset.label}
            </div>
            <button className="sv-end-btn" onClick={() => setPhase("ended")}>End</button>
          </div>

          {/* Tabs */}
          <div className="sv-tabs">
            {[["chat", "💬 Chat"], ["tips", "⚡ Tips"], ["viewers", "👁 Viewers"]].map(([k, l]) => (
              <button key={k} className={`sv-tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {/* Chat/Tips/Viewers panel */}
          <div className="sv-chat-panel">
            {tab === "chat" && (
              <>
                <div ref={chatRef} className="sv-chat-msgs">
                  {messages.map(m => (
                    m.type === "tip" ? (
                      <div key={m.id} className="sv-tip-msg">
                        <Zap size={11} color="#fbbf24"/>
                        <span className="sv-tip-msg-user">{m.user}</span>
                        <span className="sv-tip-msg-text">{m.text}</span>
                      </div>
                    ) : (
                      <div key={m.id} className="sv-chat-msg">
                        <span className="sv-chat-user" style={{ color: m.color }}>{m.user}</span>
                        <span className="sv-chat-text">{m.text}</span>
                      </div>
                    )
                  ))}
                </div>

                {showTipPanel && (
                  <div className="sv-tip-panel">
                    <div className="sv-tip-label">Send EP Tip to Creator</div>
                    <div className="sv-tip-grid">
                      {EP_TIPS.map(amt => (
                        <button key={amt} className="sv-tip-chip" onClick={() => sendTip(amt)}>
                          ⚡ {amt} EP
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sv-chat-input-row">
                  <input className="sv-chat-inp"
                    placeholder="Say something…"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMsg()}/>
                  <button className="sv-tip-btn" onClick={() => setShowTipPanel(p => !p)}>
                    <Zap size={13} color="#fbbf24"/>
                  </button>
                  <button className="sv-send" onClick={sendMsg}>
                    <Send size={13} color="#000"/>
                  </button>
                </div>
              </>
            )}

            {tab === "tips" && (
              <div className="sv-stats-list">
                <div className="sv-stat-row2">
                  <span className="sv-stat-lbl">Total Tips Received</span>
                  <span className="sv-stat-val" style={{ color: "#fbbf24" }}>⚡ {fmtNum(totalTips)} EP</span>
                </div>
                <div className="sv-stat-row2">
                  <span className="sv-stat-lbl">Your Earnings (84%)</span>
                  <span className="sv-stat-val" style={{ color: "#84cc16" }}>{fmtNum(Math.floor(epEarned))} EP</span>
                </div>
                <div className="sv-stat-row2">
                  <span className="sv-stat-lbl">Viewers</span>
                  <span className="sv-stat-val" style={{ color: "#60a5fa" }}>{fmtNum(viewers)}</span>
                </div>
                <div className="sv-stat-row2">
                  <span className="sv-stat-lbl">Peak Viewers</span>
                  <span className="sv-stat-val" style={{ color: "#a78bfa" }}>{fmtNum(peakViewers)}</span>
                </div>
                <div className="sv-stat-row2">
                  <span className="sv-stat-lbl">Likes</span>
                  <span className="sv-stat-val" style={{ color: "#f472b6" }}>{fmtNum(likes)}</span>
                </div>
                <div className="sv-stat-row2">
                  <span className="sv-stat-lbl">Stream Quality</span>
                  <span className="sv-stat-val" style={{ color: preset.color }}>{preset.label} {preset.res}</span>
                </div>
              </div>
            )}

            {tab === "viewers" && (
              <div className="sv-viewers-list">
                {Array.from({ length: Math.min(viewers, 20) }, (_, i) => ({
                  name: FAKE_USERS[i % FAKE_USERS.length] + (i >= FAKE_USERS.length ? i : ""),
                  ep: Math.random() > 0.7 ? EP_TIPS[Math.floor(Math.random() * 3)] : 0,
                  initial: FAKE_USERS[i % FAKE_USERS.length][1].toUpperCase(),
                  color: FAKE_COLS[i % FAKE_COLS.length],
                })).map((v, i) => (
                  <div key={i} className="sv-viewer-row">
                    <div className="sv-viewer-av" style={{ background: `linear-gradient(135deg,${v.color}44,${v.color}22)`, color: v.color }}>
                      {v.initial}
                    </div>
                    <span className="sv-viewer-name">{v.name}</span>
                    {v.ep > 0 && <span className="sv-viewer-ep">⚡ {v.ep} EP</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENDED ── */}
      {phase === "ended" && (
        <div className="sv-ended">
          <div className="sv-ended-emoji">🎙️</div>
          <h2 className="sv-ended-title">Stream Ended</h2>
          <p className="sv-ended-sub">
            Great work, {currentUser?.fullName || "Creator"}! Here's your summary.
          </p>
          <div className="sv-ended-stats">
            <div className="sv-ended-stat">
              <span className="sv-ended-val">{fmtNum(peakViewers)}</span>
              <span className="sv-ended-lbl">Peak Viewers</span>
            </div>
            <div className="sv-ended-stat">
              <span className="sv-ended-val">{fmtNum(Math.floor(epEarned))}</span>
              <span className="sv-ended-lbl">EP Earned</span>
            </div>
            <div className="sv-ended-stat">
              <span className="sv-ended-val">{fmtDur(duration)}</span>
              <span className="sv-ended-lbl">Duration</span>
            </div>
          </div>
          <button className="sv-new-btn" onClick={() => {
            setPhase("setup"); setTitle(""); setDuration(0);
            setLikes(0); setEpEarned(0); setTotalTips(0);
            setMessages(DEMO_MSGS);
          }}>
            Start New Stream
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamView;