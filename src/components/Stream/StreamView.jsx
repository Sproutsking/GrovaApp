// src/components/Stream/StreamView.jsx
// Xeevia Stream — EP-powered live streaming · Video + Audio modes
// Adaptive quality · EP tipping (84% creator) · Multi-guest slots · Signal monitor

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio,
  Video,
  Mic,
  Eye,
  Heart,
  X,
  Send,
  Volume2,
  VolumeX,
  VideoOff,
  MicOff,
  Share2,
  Zap,
  Wifi,
  Users,
  Crown,
  Settings,
  Plus,
  PhoneOff,
  Lock,
  Unlock,
  BarChart2,
  Gift,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── Static data ───────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: "ultra",
    label: "Ultra HD",
    sub: "~4 Mbps",
    badge: "Best",
    color: "#84cc16",
    res: "1080p",
  },
  {
    id: "high",
    label: "High",
    sub: "~2 Mbps",
    badge: "Clear",
    color: "#60a5fa",
    res: "720p",
  },
  {
    id: "medium",
    label: "Medium",
    sub: "~800 Kbps",
    badge: "Smooth",
    color: "#fbbf24",
    res: "480p",
  },
  {
    id: "low",
    label: "Data Saver",
    sub: "~300 Kbps",
    badge: "Lite",
    color: "#f97316",
    res: "360p",
  },
  {
    id: "minimal",
    label: "Minimal",
    sub: "~100 Kbps",
    badge: "Ultra-lite",
    color: "#f472b6",
    res: "240p",
  },
];
const CATEGORIES = [
  "Music 🎵",
  "Talk 🎙️",
  "Gaming 🎮",
  "Education 📚",
  "Fitness 💪",
  "Art 🎨",
  "Business 💼",
  "Tech ⚡",
];
const EP_TIPS = [2, 5, 10, 25, 50, 100];
const MSGS_DEMO = [
  {
    id: 1,
    user: "@krypto_k",
    text: "🔥 first!!",
    color: "#84cc16",
    type: "chat",
    ep: 0,
  },
  {
    id: 2,
    user: "@nova_x",
    text: "been waiting for this 🙌",
    color: "#60a5fa",
    type: "chat",
    ep: 0,
  },
  {
    id: 3,
    user: "@sprout_s",
    text: "sent 5 EP ⚡",
    color: "#fbbf24",
    type: "tip",
    ep: 5,
  },
  {
    id: 4,
    user: "@zara_w",
    text: "legendary stream 💎",
    color: "#a78bfa",
    type: "chat",
    ep: 0,
  },
  {
    id: 5,
    user: "@dev_88",
    text: "sent 10 EP ⚡",
    color: "#f472b6",
    type: "tip",
    ep: 10,
  },
];
const FAKE_MSGS = [
  "🔥🔥🔥",
  "let's gooo!",
  "❤️❤️",
  "quality is insane",
  "first time here",
  "vibing hard",
  "🚀 this is it",
  "subscribed!",
  "sent EP ⚡",
  "need this energy",
  "top tier creator",
  "W stream",
  "real ones here",
  "this is unreal",
  "absolute banger",
];
const FAKE_USERS = [
  "@alpha",
  "@blade",
  "@cyan_v",
  "@delta9",
  "@echo88",
  "@flux_k",
  "@ghost",
  "@hex",
  "@iris",
  "@jade_w",
  "@kilo_m",
  "@luna_p",
];
const FAKE_COLS = [
  "#84cc16",
  "#60a5fa",
  "#a78bfa",
  "#fbbf24",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#e879f9",
];

// ── Audio Bars ────────────────────────────────────────────────────────────────
const AudioBars = ({ active, color = "#a78bfa" }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 38 }}>
    {Array.from({ length: 14 }).map((_, i) => (
      <div
        key={i}
        style={{
          width: 4,
          borderRadius: 2,
          background: active ? color : "rgba(255,255,255,0.08)",
          height: active ? `${8 + Math.random() * 24}px` : "4px",
          animation: active
            ? `svBar .7s ease-in-out ${i * 0.06}s infinite`
            : "none",
          transition: "background .3s",
        }}
      />
    ))}
  </div>
);

// ── Stat Pill ─────────────────────────────────────────────────────────────────
const StatPill = ({ Icon, value, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 9px",
      borderRadius: 8,
      background: "rgba(0,0,0,0.62)",
      backdropFilter: "blur(10px)",
      fontSize: 11,
      fontWeight: 800,
      color: "#fff",
    }}
  >
    <Icon size={10} color={color} />
    {value}
  </div>
);

// ── Signal Bars ───────────────────────────────────────────────────────────────
const SignalBars = ({ strength }) => {
  const color =
    strength >= 4 ? "#84cc16" : strength >= 3 ? "#fbbf24" : "#ef4444";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        padding: "4px 9px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.62)",
        backdropFilter: "blur(10px)",
      }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 1,
            height: 4 + i * 3,
            background: i < strength ? color : "rgba(255,255,255,0.12)",
            transition: "background .3s",
          }}
        />
      ))}
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const StreamView = ({ currentUser, userId, onClose, isSidebar = false }) => {
  const [mode, setMode] = useState("video"); // video | audio
  const [phase, setPhase] = useState("setup"); // setup | live | ended
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Tech ⚡");
  const [preset, setPreset] = useState("high");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(MSGS_DEMO);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [epEarned, setEpEarned] = useState(0);
  const [duration, setDuration] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [peakVw, setPeakVw] = useState(0);
  const [showNet, setShowNet] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [guests, setGuests] = useState([null, null]);
  const [signal, setSignal] = useState(4);
  const [totalTips, setTotalTips] = useState(0);
  const [tab, setTab] = useState("chat"); // chat | tips | viewers

  const durRef = useRef(null);
  const chatRef = useRef(null);
  const msgId = useRef(10);

  const pDef = PRESETS.find((p) => p.id === preset) || PRESETS[1];
  const initials = (currentUser?.fullName || currentUser?.name || "U")
    .charAt(0)
    .toUpperCase();
  const fmtN = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
  const fmtDur = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Viewer count from Supabase
  useEffect(() => {
    if (phase !== "live") return;
    const fetchV = async () => {
      try {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gt("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString());
        const v = (count || 0) + Math.floor(Math.random() * 18) + 5;
        setViewers(v);
        setPeakVw((p) => Math.max(p, v));
      } catch {
        setViewers(Math.floor(Math.random() * 80) + 20);
      }
    };
    fetchV();
    const iv = setInterval(fetchV, 15000);
    return () => clearInterval(iv);
  }, [phase]);

  // Duration timer
  useEffect(() => {
    if (phase === "live") {
      durRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else clearInterval(durRef.current);
    return () => clearInterval(durRef.current);
  }, [phase]);

  // Simulated chat + tips
  useEffect(() => {
    if (phase !== "live") return;
    const iv = setInterval(() => {
      if (Math.random() > 0.35) {
        const isTip = Math.random() > 0.78;
        const tipAmt = EP_TIPS[Math.floor(Math.random() * 3)];
        setMessages((p) => [
          ...p.slice(-80),
          {
            id: ++msgId.current,
            user: FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)],
            text: isTip
              ? `sent ${tipAmt} EP ⚡`
              : FAKE_MSGS[Math.floor(Math.random() * FAKE_MSGS.length)],
            color: FAKE_COLS[Math.floor(Math.random() * FAKE_COLS.length)],
            type: isTip ? "tip" : "chat",
            ep: isTip ? tipAmt : 0,
          },
        ]);
        if (isTip) {
          setEpEarned((e) => e + Math.floor(tipAmt * 0.84));
          setTotalTips((t) => t + tipAmt);
        }
        setLikes(
          (l) =>
            l + (Math.random() > 0.65 ? Math.floor(Math.random() * 3) + 1 : 0),
        );
      }
      setSignal((s) =>
        Math.max(
          1,
          Math.min(
            5,
            s + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0),
          ),
        ),
      );
    }, 2000);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMsg = () => {
    if (!chatInput.trim()) return;
    setMessages((p) => [
      ...p,
      {
        id: ++msgId.current,
        user: `@${currentUser?.username || "you"}`,
        text: chatInput,
        color: "#84cc16",
        type: "chat",
        ep: 0,
      },
    ]);
    setChatInput("");
  };

  const sendTip = (amt) => {
    setMessages((p) => [
      ...p,
      {
        id: ++msgId.current,
        user: `@${currentUser?.username || "you"}`,
        text: `sent ${amt} EP ⚡`,
        color: "#fbbf24",
        type: "tip",
        ep: amt,
      },
    ]);
    setShowTip(false);
  };

  const signalColor =
    signal >= 4 ? "#84cc16" : signal >= 3 ? "#fbbf24" : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#050505",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
        color: "#fff",
        overflow: "hidden",
        ...(isSidebar
          ? { height: "100%", borderLeft: "1px solid rgba(132,204,22,0.1)" }
          : { position: "fixed", inset: 0, zIndex: 10001 }),
      }}
    >
      <style>{`
        @keyframes svLivePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.86)} }
        @keyframes svBar       { 0%,100%{height:4px} 25%{height:22px} 50%{height:10px} 75%{height:28px} }
        @keyframes svUp        { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes svGlow      { 0%,100%{box-shadow:0 0 18px rgba(132,204,22,0.22)} 50%{box-shadow:0 0 36px rgba(132,204,22,0.52)} }
        @keyframes svRing      { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2);opacity:0} }
        @keyframes svFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes svSlide     { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
        @keyframes svTipPop    { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes svSpin      { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── TOP BAR ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 14px",
          background: "rgba(5,5,5,0.98)",
          backdropFilter: "blur(22px)",
          borderBottom: "1px solid rgba(132,204,22,0.08)",
          flexShrink: 0,
          boxShadow: "0 1px 0 rgba(132,204,22,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {phase !== "live" && (
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#737373",
              }}
            >
              <X size={14} />
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg,#fb7185,#e11d48)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Radio size={13} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>
              Stream
            </span>
          </div>
        </div>

        {phase === "setup" && (
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 2,
              gap: 2,
            }}
          >
            {[
              ["video", "Video", Video],
              ["audio", "Audio", Mic],
            ].map(([k, l, Ic]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border:
                    mode === k ? "1px solid rgba(132,204,22,0.22)" : "none",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  background:
                    mode === k ? "rgba(132,204,22,0.12)" : "transparent",
                  color: mode === k ? "#84cc16" : "#525252",
                  fontFamily: "inherit",
                }}
              >
                <Ic size={12} />
                {l}
              </button>
            ))}
          </div>
        )}

        {phase === "live" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 800,
                color: "#fff",
                background: "rgba(239,68,68,0.14)",
                border: "1px solid rgba(239,68,68,0.28)",
                padding: "3px 9px",
                borderRadius: 7,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#ef4444",
                  animation: "svLivePulse 1.4s ease-in-out infinite",
                }}
              />
              LIVE
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#444" }}>
              {fmtDur(duration)}
            </span>
          </div>
        )}
      </div>

      {/* ── SETUP ── */}
      {phase === "setup" && (
        <div style={{ overflowY: "auto", padding: "20px 16px 90px", flex: 1 }}>
          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                margin: "0 auto 16px",
                background:
                  mode === "video"
                    ? "linear-gradient(135deg,rgba(251,113,133,0.18),rgba(225,29,72,0.08))"
                    : "linear-gradient(135deg,rgba(167,139,250,0.18),rgba(109,40,217,0.08))",
                border: `1px solid ${mode === "video" ? "rgba(251,113,133,0.28)" : "rgba(167,139,250,0.28)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "svFloat 3s ease-in-out infinite",
                boxShadow: `0 8px 28px ${mode === "video" ? "rgba(251,113,133,0.18)" : "rgba(167,139,250,0.18)"}`,
              }}
            >
              {mode === "video" ? (
                <Video size={30} color="#fb7185" />
              ) : (
                <Mic size={30} color="#a78bfa" />
              )}
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: "#fff",
                margin: "0 0 6px",
              }}
            >
              {mode === "video" ? "Video Stream" : "Audio Broadcast"}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#525252",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {mode === "video"
                ? "Broadcast live. Earn EP from every tip and interaction."
                : "Go audio-only — podcasts, talks, music. Low data, high impact."}
            </p>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#3a3a3a",
                textTransform: "uppercase",
                letterSpacing: ".8px",
                marginBottom: 6,
                display: "block",
              }}
            >
              Stream Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="What's the stream about?"
              style={{
                width: "100%",
                padding: "11px 12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 11,
                color: "#fff",
                fontSize: 13,
                outline: "none",
                transition: "border-color .2s",
                caretColor: "#84cc16",
                fontFamily: "inherit",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(132,204,22,0.35)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.08)")
              }
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#3a3a3a",
                textTransform: "uppercase",
                letterSpacing: ".8px",
                marginBottom: 6,
                display: "block",
              }}
            >
              Category
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 7,
                    background:
                      category === c
                        ? "rgba(132,204,22,0.1)"
                        : "rgba(255,255,255,0.03)",
                    border: `1px solid ${category === c ? "rgba(132,204,22,0.28)" : "rgba(255,255,255,0.07)"}`,
                    color: category === c ? "#84cc16" : "#444",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all .15s",
                    fontFamily: "inherit",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#3a3a3a",
                textTransform: "uppercase",
                letterSpacing: ".8px",
                marginBottom: 6,
                display: "block",
              }}
            >
              Transmission Quality
            </label>
            <p
              style={{
                fontSize: 11,
                color: "#383838",
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              Based on your data plan. Adjustable mid-stream.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 11,
                    background:
                      preset === p.id
                        ? `${p.color}08`
                        : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${preset === p.id ? p.color + "44" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer",
                    transition: "all .15s",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: preset === p.id ? p.color : "#383838",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: preset === p.id ? p.color : "#c4c4c4",
                      }}
                    >
                      {p.label} · {p.res}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>
                      {p.sub} bandwidth
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "2px 8px",
                      borderRadius: 5,
                      background: `${p.color}18`,
                      color: p.color,
                      border: `1px solid ${p.color}28`,
                      fontSize: 9,
                      fontWeight: 800,
                    }}
                  >
                    {p.badge}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#3a3a3a",
                textTransform: "uppercase",
                letterSpacing: ".8px",
                marginBottom: 6,
                display: "block",
              }}
            >
              Visibility
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 12px",
                borderRadius: 11,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#c4c4c4",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isPrivate ? (
                    <Lock size={13} color="#f472b6" />
                  ) : (
                    <Unlock size={13} color="#84cc16" />
                  )}
                  {isPrivate
                    ? "Private — Invite only"
                    : "Public — Anyone can watch"}
                </div>
                <div style={{ fontSize: 11, color: "#383838", marginTop: 2 }}>
                  {isPrivate
                    ? "Share link to invite viewers"
                    : "Discoverable on Xeevia"}
                </div>
              </div>
              <div
                onClick={() => setIsPrivate((p) => !p)}
                style={{
                  width: 42,
                  height: 24,
                  borderRadius: 12,
                  cursor: "pointer",
                  background: isPrivate
                    ? "linear-gradient(135deg,#f472b6,#be185d)"
                    : "rgba(255,255,255,0.1)",
                  position: "relative",
                  transition: "background .22s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "transform .22s",
                    transform: isPrivate ? "translateX(18px)" : "none",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Go Live */}
          <button
            onClick={() => {
              if (title.trim()) setPhase("live");
            }}
            disabled={!title.trim()}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 13,
              border: "none",
              background: title.trim()
                ? "linear-gradient(135deg,#84cc16,#4d7c0f)"
                : "rgba(255,255,255,0.05)",
              color: title.trim() ? "#000" : "#383838",
              fontSize: 15,
              fontWeight: 900,
              cursor: title.trim() ? "pointer" : "not-allowed",
              boxShadow: title.trim()
                ? "0 6px 22px rgba(132,204,22,0.38)"
                : "none",
              animation: title.trim()
                ? "svGlow 3s ease-in-out infinite"
                : "none",
              transition: "all .18s",
              fontFamily: "inherit",
            }}
          >
            🔴 &nbsp;Go Live Now
          </button>
        </div>
      )}

      {/* ── LIVE ── */}
      {phase === "live" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Stage */}
          <div
            style={{
              position: "relative",
              flex: "0 0 auto",
              minHeight: isSidebar ? 160 : 220,
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at center,rgba(132,204,22,0.04) 0%,transparent 70%)",
              }}
            />

            {mode === "video" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  height: "100%",
                }}
              >
                {camOn ? (
                  <>
                    <div
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 22,
                        background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        fontWeight: 900,
                        color: "#000",
                        boxShadow: "0 6px 26px rgba(132,204,22,0.36)",
                      }}
                    >
                      {initials}
                    </div>
                    <span
                      style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}
                    >
                      {currentUser?.fullName || "You"}
                    </span>
                    <span style={{ fontSize: 11, color: "#525252" }}>
                      {pDef.label} · {pDef.res}
                    </span>
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <VideoOff size={36} color="#383838" />
                    <span
                      style={{
                        color: "#383838",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Camera Off
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 18,
                  width: "100%",
                  padding: "24px 20px",
                }}
              >
                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#fff",
                    position: "relative",
                    boxShadow:
                      "0 0 0 10px rgba(167,139,250,0.1),0 0 0 20px rgba(167,139,250,0.05)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: -14,
                      borderRadius: "50%",
                      border: "2px solid rgba(167,139,250,0.28)",
                      animation: "svRing 1.8s ease-out infinite",
                    }}
                  />
                  {initials}
                </div>
                <AudioBars active={micOn} color="#a78bfa" />
                <span
                  style={{ color: "#a78bfa", fontSize: 13, fontWeight: 800 }}
                >
                  {micOn ? "● Broadcasting Audio" : "Mic Muted"}
                </span>
                <span style={{ fontSize: 11, color: "#444" }}>
                  {pDef.label} · {pDef.sub}
                </span>
              </div>
            )}

            {/* Left badges */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 9px",
                  borderRadius: 7,
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(10px)",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#ef4444",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#ef4444",
                    animation: "svLivePulse 1.4s ease-in-out infinite",
                  }}
                />
                LIVE
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 9px",
                  borderRadius: 7,
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(10px)",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#fbbf24",
                }}
              >
                <Zap size={9} color="#fbbf24" />
                {category}
              </div>
              {isPrivate && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    borderRadius: 7,
                    background: "rgba(0,0,0,0.65)",
                    backdropFilter: "blur(10px)",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#f472b6",
                  }}
                >
                  <Lock size={9} />
                  Private
                </div>
              )}
            </div>

            {/* Right stats */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "flex",
                flexDirection: "column",
                gap: 5,
                alignItems: "flex-end",
              }}
            >
              <StatPill Icon={Eye} value={fmtN(viewers)} color="#60a5fa" />
              <StatPill Icon={Heart} value={fmtN(likes)} color="#f472b6" />
              <SignalBars strength={signal} />
            </div>

            {/* Guest slots */}
            <div
              style={{
                position: "absolute",
                bottom: 44,
                right: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {guests.map((g, i) => (
                <div
                  key={i}
                  style={{
                    width: 52,
                    height: 76,
                    borderRadius: 11,
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backdropFilter: "blur(8px)",
                    transition: "border-color .15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(132,204,22,0.3)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.1)")
                  }
                >
                  {g ? (
                    <span style={{ fontSize: 18 }}>👤</span>
                  ) : (
                    <Plus size={15} color="#383838" />
                  )}
                </div>
              ))}
            </div>

            {/* Title chip */}
            <div
              style={{ position: "absolute", bottom: 10, left: 10, right: 70 }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {isPrivate && <Lock size={9} color="#f472b6" />}
                {title}
              </div>
            </div>

            {/* EP earned */}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 7,
                background: "rgba(132,204,22,0.18)",
                border: "1px solid rgba(132,204,22,0.3)",
                backdropFilter: "blur(8px)",
                fontSize: 11,
                fontWeight: 900,
                color: "#84cc16",
              }}
            >
              <Zap size={10} />+{fmtN(Math.floor(epEarned))} EP
            </div>

            {/* Network dropdown */}
            {showNet && (
              <div
                style={{
                  position: "absolute",
                  bottom: 52,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                  padding: 10,
                  width: 260,
                  zIndex: 200,
                  boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
                  animation: "svSlide .18s ease",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#383838",
                    textTransform: "uppercase",
                    letterSpacing: ".8px",
                    marginBottom: 8,
                    padding: "0 4px",
                  }}
                >
                  Adjust Quality
                </div>
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPreset(p.id);
                      setShowNet(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 10px",
                      borderRadius: 9,
                      width: "100%",
                      background:
                        preset === p.id ? `${p.color}08` : "transparent",
                      border: `1.5px solid ${preset === p.id ? p.color + "40" : "rgba(255,255,255,0.06)"}`,
                      cursor: "pointer",
                      marginBottom: 5,
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: preset === p.id ? p.color : "#383838",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: preset === p.id ? p.color : "#c4c4c4",
                        }}
                      >
                        {p.label} · {p.res}
                      </div>
                      <div style={{ fontSize: 10, color: "#444" }}>{p.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 12px",
              background: "rgba(0,0,0,0.94)",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              flexShrink: 0,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {[
              mode === "video" && {
                icon: camOn ? Video : VideoOff,
                on: camOn,
                fn: () => setCamOn((p) => !p),
              },
              {
                icon: micOn ? Mic : MicOff,
                on: micOn,
                fn: () => setMicOn((p) => !p),
              },
              {
                icon: muted ? VolumeX : Volume2,
                on: !muted,
                fn: () => setMuted((p) => !p),
              },
              {
                icon: Wifi,
                on: !showNet,
                hl: showNet,
                fn: () => setShowNet((p) => !p),
              },
              { icon: Share2, on: true, fn: () => {} },
            ]
              .filter(Boolean)
              .map((b, i) => (
                <button
                  key={i}
                  onClick={b.fn}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    transition: "all .15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: b.hl
                      ? "rgba(132,204,22,0.1)"
                      : b.on
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(239,68,68,0.1)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: b.hl
                      ? "rgba(132,204,22,0.22)"
                      : b.on
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(239,68,68,0.22)",
                    color: b.hl ? "#84cc16" : b.on ? "#fff" : "#ef4444",
                  }}
                >
                  <b.icon size={16} />
                </button>
              ))}
            {/* Quality pill */}
            <div
              onClick={() => setShowNet((p) => !p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 11px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 800,
                color: "#737373",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(132,204,22,0.3)";
                e.currentTarget.style.color = "#84cc16";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#737373";
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: pDef.color,
                }}
              />
              {pDef.label}
            </div>
            {/* End */}
            <button
              onClick={() => setPhase("ended")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "inherit",
              }}
            >
              End
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              padding: "5px 12px 0",
              background: "rgba(0,0,0,0.9)",
              flexShrink: 0,
              borderTop: "1px solid rgba(255,255,255,0.04)",
              gap: 4,
            }}
          >
            {[
              ["chat", "💬 Chat"],
              ["tips", "⚡ Tips"],
              ["viewers", "👁 Viewers"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  flex: 1,
                  padding: "7px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background:
                    tab === k ? "rgba(132,204,22,0.1)" : "transparent",
                  color: tab === k ? "#84cc16" : "#383838",
                  textTransform: "uppercase",
                  letterSpacing: ".4px",
                  transition: "all .15s",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Chat Panel */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              background: "#060606",
              overflow: "hidden",
            }}
          >
            {tab === "chat" && (
              <>
                <div
                  ref={chatRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "8px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {messages.map((m) =>
                    m.type === "tip" ? (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 9px",
                          borderRadius: 8,
                          background: "rgba(251,191,36,0.07)",
                          border: "1px solid rgba(251,191,36,0.16)",
                          animation: "svUp .18s ease",
                        }}
                      >
                        <Zap size={11} color="#fbbf24" />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#fbbf24",
                          }}
                        >
                          {m.user}
                        </span>
                        <span style={{ fontSize: 11, color: "#c4c4c4" }}>
                          {m.text}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={m.id}
                        style={{
                          fontSize: 12,
                          lineHeight: 1.45,
                          animation: "svUp .18s ease",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            marginRight: 4,
                            color: m.color,
                          }}
                        >
                          {m.user}
                        </span>
                        <span style={{ color: "#c4c4c4" }}>{m.text}</span>
                      </div>
                    ),
                  )}
                </div>

                {showTip && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "rgba(251,191,36,0.04)",
                      borderTop: "1px solid rgba(251,191,36,0.1)",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#444",
                        textTransform: "uppercase",
                        letterSpacing: ".8px",
                        marginBottom: 7,
                      }}
                    >
                      Send EP Tip · Creator keeps 84%
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {EP_TIPS.map((amt) => (
                        <button
                          key={amt}
                          onClick={() => sendTip(amt)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "rgba(251,191,36,0.1)",
                            border: "1px solid rgba(251,191,36,0.22)",
                            color: "#fbbf24",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                            transition: "all .15s",
                            fontFamily: "inherit",
                            animation: "svTipPop .3s ease",
                          }}
                        >
                          ⚡ {amt} EP
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 12px 10px",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    flexShrink: 0,
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                    placeholder="Say something…"
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 9,
                      padding: "8px 11px",
                      color: "#fff",
                      fontSize: 12,
                      outline: "none",
                      caretColor: "#84cc16",
                      transition: "border-color .15s",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "rgba(132,204,22,0.32)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                    }
                  />
                  <button
                    onClick={() => setShowTip((p) => !p)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      flexShrink: 0,
                      background: showTip
                        ? "rgba(251,191,36,0.2)"
                        : "rgba(251,191,36,0.12)",
                      border: `1px solid ${showTip ? "rgba(251,191,36,0.38)" : "rgba(251,191,36,0.22)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Zap size={13} color="#fbbf24" />
                  </button>
                  <button
                    onClick={sendMsg}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      flexShrink: 0,
                      background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Send size={13} color="#000" />
                  </button>
                </div>
              </>
            )}

            {tab === "tips" && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  [
                    "Total Tips Received",
                    `⚡ ${fmtN(totalTips)} EP`,
                    "#fbbf24",
                  ],
                  [
                    "Your Earnings (84%)",
                    `${fmtN(Math.floor(epEarned))} EP`,
                    "#84cc16",
                  ],
                  ["Viewers", fmtN(viewers), "#60a5fa"],
                  ["Peak Viewers", fmtN(peakVw), "#a78bfa"],
                  ["Likes", fmtN(likes), "#f472b6"],
                  ["Quality", `${pDef.label} ${pDef.res}`, pDef.color],
                ].map(([l, v, c]) => (
                  <div
                    key={l}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 11,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.055)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "#525252",
                        fontWeight: 700,
                      }}
                    >
                      {l}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: c }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "viewers" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                {Array.from({ length: Math.min(viewers, 20) }, (_, i) => ({
                  name:
                    FAKE_USERS[i % FAKE_USERS.length] +
                    (i >= FAKE_USERS.length ? i : ""),
                  ep:
                    Math.random() > 0.7
                      ? EP_TIPS[Math.floor(Math.random() * 3)]
                      : 0,
                  init: FAKE_USERS[i % FAKE_USERS.length][1].toUpperCase(),
                  color: FAKE_COLS[i % FAKE_COLS.length],
                })).map((v, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        background: `linear-gradient(135deg,${v.color}44,${v.color}22)`,
                        color: v.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {v.init}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#c4c4c4",
                        flex: 1,
                      }}
                    >
                      {v.name}
                    </span>
                    {v.ep > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#fbbf24",
                        }}
                      >
                        ⚡ {v.ep} EP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENDED ── */}
      {phase === "ended" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: "32px 22px",
            textAlign: "center",
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 54, marginBottom: 16 }}>🎙️</div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#fff",
              margin: "0 0 6px",
            }}
          >
            Stream Ended
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#525252",
              margin: "0 0 28px",
              lineHeight: 1.5,
            }}
          >
            Great work, {currentUser?.fullName || "Creator"}. Here's your
            session.
          </p>
          <div style={{ display: "flex", gap: 18, marginBottom: 28 }}>
            {[
              [fmtN(peakVw), "Peak Viewers"],
              [fmtN(Math.floor(epEarned)), "EP Earned"],
              [fmtDur(duration), "Duration"],
            ].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#84cc16",
                    display: "block",
                  }}
                >
                  {v}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: "#444",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                  }}
                >
                  {l}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setPhase("setup");
              setTitle("");
              setDuration(0);
              setLikes(0);
              setEpEarned(0);
              setTotalTips(0);
              setMessages(MSGS_DEMO);
            }}
            style={{
              padding: "12px 28px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
              border: "none",
              color: "#000",
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 5px 18px rgba(132,204,22,0.36)",
              fontFamily: "inherit",
            }}
          >
            Start New Stream
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamView;
