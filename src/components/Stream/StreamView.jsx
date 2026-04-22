// src/components/Stream/StreamView.jsx
// ============================================================================
// Xeevia Stream — LiveKit integration
//
// ORIGINAL DESIGN RESTORED — the beautiful v1 UI is the base.
// ADDITIONS on top of original:
//   [A1] Camera permission check + request before setup (PermissionGate)
//   [A2] Camera preview before going live (PreviewStage)
//   [A3] track.enabled mic/cam toggle during live (no reconnect)
//   [A4] Real AnalyserNode audio visualiser (replaces CSS fake)
//   [A5] Co-speaker invite system (audio stage)
//   [A6] Co-streamer invite system (video stage)
//   [A7] Raise hand for viewers
//   [A8] Stage tab in host view
//   [A9] Stage invite toast for viewers
//   [A10] ViewerRoom fully styled (no broken UI)
//   [A11] Supabase Realtime channel for shared chat+likes+stage
//   [A12] streamSession cleared on unmount (no zombie tracks)
//
// SETUP:
//   1. npm install @livekit/components-react @livekit/components-styles livekit-client
//   2. Deploy /supabase/functions/stream/index.ts
//   3. Set secrets: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
//   4. .env: REACT_APP_SUPABASE_STREAM_FUNCTION_URL=...
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  Lock,
  Unlock,
  AlertCircle,
  Users,
  ArrowLeft,
  RotateCcw,
  Shield,
  RefreshCw,
  Hand,
  PhoneOff,
  Star,
  CheckCircle,
  CameraOff,
  Search,
  Crown,
  Plus,
  UserPlus,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── LiveKit SDK — lazy so missing SDK doesn't crash the app ──────────────────
let LiveKitRoom = null;
let VideoConference = null;
let RoomAudioRenderer = null;
try {
  const lkComponents = require("@livekit/components-react");
  LiveKitRoom = lkComponents.LiveKitRoom;
  VideoConference = lkComponents.VideoConference;
  RoomAudioRenderer = lkComponents.RoomAudioRenderer;
} catch {
  /* SDK not installed */
}
const SDK_AVAILABLE = LiveKitRoom !== null;

const STREAM_FN_URL =
  process.env.REACT_APP_SUPABASE_STREAM_FUNCTION_URL ||
  "https://rxtijxlvacqjiocdwzrh.supabase.co/functions/v1/stream";

// ── Static data ───────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: "ultra",
    label: "Ultra HD",
    sub: "~4 Mbps",
    badge: "Best",
    color: "#84cc16",
    res: "1080p",
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: {
      sampleRate: 48000,
      channelCount: 2,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
  {
    id: "high",
    label: "High",
    sub: "~2 Mbps",
    badge: "Clear",
    color: "#60a5fa",
    res: "720p",
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: {
      sampleRate: 44100,
      channelCount: 2,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
  {
    id: "medium",
    label: "Medium",
    sub: "~800 Kbps",
    badge: "Smooth",
    color: "#fbbf24",
    res: "480p",
    video: {
      width: { ideal: 854 },
      height: { ideal: 480 },
      frameRate: { ideal: 24 },
    },
    audio: {
      sampleRate: 44100,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
  {
    id: "low",
    label: "Data Saver",
    sub: "~300 Kbps",
    badge: "Lite",
    color: "#f97316",
    res: "360p",
    video: {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 20 },
    },
    audio: {
      sampleRate: 22050,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    sub: "~100 Kbps",
    badge: "Ultra-lite",
    color: "#f472b6",
    res: "240p",
    video: {
      width: { ideal: 426 },
      height: { ideal: 240 },
      frameRate: { ideal: 15 },
    },
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: false,
    },
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

const CHAT_COLORS = [
  "#84cc16",
  "#60a5fa",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f87171",
];
const chatColor = (id = "") =>
  CHAT_COLORS[id.charCodeAt(0) % CHAT_COLORS.length];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtN = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0));
const fmtDur = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

async function fetchLiveKitToken({
  roomName,
  userId,
  userName,
  isHost,
  canPublish = false,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be signed in to go live.");
  const res = await fetch(STREAM_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: isHost ? "start" : "join",
      roomName,
      userId,
      userName: userName || "user",
      isHost,
      canPublish,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Token request failed: ${res.status}`);
  }
  return res.json();
}

// [A1] Permission helpers
async function probePermission(name) {
  try {
    const s = await navigator.permissions.query({ name });
    return s.state;
  } catch {
    return "prompt";
  }
}

async function getMediaStream(mode, presetId) {
  const p = PRESETS.find((x) => x.id === presetId) || PRESETS[1];
  if (mode === "audio")
    return navigator.mediaDevices.getUserMedia({
      audio: p.audio,
      video: false,
    });
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: p.video,
      audio: p.audio,
    });
  } catch (e) {
    if (
      e.name === "OverconstrainedError" ||
      e.name === "ConstraintNotSatisfiedError"
    )
      return navigator.mediaDevices.getUserMedia({
        video: true,
        audio: p.audio,
      });
    throw e;
  }
}

// ── Shared CSS ────────────────────────────────────────────────────────────────
const BASE_CSS = `
  @keyframes svLivePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.86)}}
  @keyframes svBar{0%,100%{height:4px}25%{height:22px}50%{height:10px}75%{height:28px}}
  @keyframes svUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes svGlow{0%,100%{box-shadow:0 0 18px rgba(132,204,22,.22)}50%{box-shadow:0 0 36px rgba(132,204,22,.52)}}
  @keyframes svSpin{to{transform:rotate(360deg)}}
  @keyframes svInvite{0%{transform:translateY(100%);opacity:0}100%{transform:translateY(0);opacity:1}}
  @keyframes svHandWave{0%,100%{transform:rotate(0)}30%{transform:rotate(22deg)}70%{transform:rotate(-12deg)}}
  @keyframes svLikePop{0%{transform:scale(1)}45%{transform:scale(1.5)}100%{transform:scale(1)}}
  @keyframes svHeartFly{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-60px)}}
  @keyframes svSpeak{0%,100%{box-shadow:0 0 0 0 rgba(132,204,22,0),0 0 0 0 rgba(132,204,22,0)}40%{box-shadow:0 0 0 4px rgba(132,204,22,.35),0 0 0 8px rgba(132,204,22,.12)}80%{box-shadow:0 0 0 6px rgba(132,204,22,.2),0 0 0 12px rgba(132,204,22,.05)}}
  @keyframes svSpeakRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.55);opacity:0}}
  @keyframes svSearchIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
`;

// ── Original sub-components (unchanged) ───────────────────────────────────────
const StatPill = ({ Icon, value, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 9px",
      borderRadius: 8,
      background: "rgba(0,0,0,.62)",
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
        background: "rgba(0,0,0,.62)",
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
            background: i < strength ? color : "rgba(255,255,255,.12)",
            transition: "background .3s",
          }}
        />
      ))}
    </div>
  );
};

// [A4] Real AnalyserNode audio visualiser (replaces CSS fake)
const AudioBars = ({ stream, active, color = "#a78bfa", barCount = 14 }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioRef = useRef(null);
  const smoothed = useRef(new Float32Array(barCount).fill(4));

  useEffect(() => {
    // If we have a real stream, use AnalyserNode
    if (stream && active) {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const an = ac.createAnalyser();
        an.fftSize = barCount * 4;
        an.smoothingTimeConstant = 0.8;
        ac.createMediaStreamSource(stream).connect(an);
        audioRef.current = ac;
        const data = new Uint8Array(an.frequencyBinCount);
        const draw = () => {
          rafRef.current = requestAnimationFrame(draw);
          an.getByteFrequencyData(data);
          const cv = canvasRef.current;
          if (!cv) return;
          const ctx = cv.getContext("2d"),
            W = cv.width,
            H = cv.height;
          ctx.clearRect(0, 0, W, H);
          const sw = W / barCount;
          for (let i = 0; i < barCount; i++) {
            smoothed.current[i] =
              smoothed.current[i] * 0.75 + (data[i] / 255) * H * 0.25;
            const h = Math.max(3, smoothed.current[i]);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.6 + (h / H) * 0.4;
            ctx.beginPath();
            ctx.roundRect(i * sw + 1, H - h, sw - 2, h, 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        };
        draw();
        return () => {
          cancelAnimationFrame(rafRef.current);
          ac.close().catch(() => {});
        };
      } catch {}
    }
    // Fallback: static low bars when no stream or not active
    cancelAnimationFrame(rafRef.current);
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d"),
      W = cv.width,
      H = cv.height;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < barCount; i++) {
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.globalAlpha = 1;
      ctx.fillRect(i * (W / barCount) + 1, H - 4, W / barCount - 2, 4);
    }
  }, [stream, active, color, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 12}
      height={38}
      style={{ width: barCount * 12, height: 38, display: "block" }}
    />
  );
};

// ── SDK not installed notice (original) ───────────────────────────────────────
const SDKNotice = ({ onClose }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 10001,
      background: "#050505",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      textAlign: "center",
    }}
  >
    <style>{BASE_CSS}</style>
    <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
    <h2
      style={{
        fontSize: 20,
        fontWeight: 900,
        color: "#fff",
        margin: "0 0 8px",
      }}
    >
      LiveKit SDK Required
    </h2>
    <p
      style={{
        fontSize: 13,
        color: "#525252",
        margin: "0 0 24px",
        lineHeight: 1.6,
        maxWidth: 400,
      }}
    >
      Real live streaming needs the LiveKit client installed. Run this in your
      project root:
    </p>
    <div
      style={{
        background: "rgba(132,204,22,.08)",
        border: "1px solid rgba(132,204,22,.2)",
        borderRadius: 12,
        padding: "12px 20px",
        fontFamily: "monospace",
        fontSize: 13,
        color: "#84cc16",
        marginBottom: 24,
        maxWidth: 500,
        wordBreak: "break-all",
      }}
    >
      npm install @livekit/components-react @livekit/components-styles
      livekit-client
    </div>
    <button
      onClick={onClose}
      style={{
        padding: "11px 24px",
        borderRadius: 11,
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.1)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Go Back
    </button>
  </div>
);

// ── [A1] Permission Gate ──────────────────────────────────────────────────────
const PermissionGate = ({ mode, onGranted, onAudioOnly, onClose }) => {
  const [phase, setPhase] = useState("checking");
  const [camState, setCamState] = useState("prompt");
  const [micState, setMicState] = useState("prompt");
  const [browser, setBrowser] = useState("chrome");
  const [os, setOs] = useState("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setOs("ios");
    else if (/Android/.test(ua)) setOs("android");
    if (/Firefox/.test(ua)) setBrowser("firefox");
    else if (/Edg\//.test(ua)) setBrowser("edge");
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) setBrowser("safari");
  }, []);

  useEffect(() => {
    (async () => {
      const cam = await probePermission("camera");
      const mic = await probePermission("microphone");
      setCamState(cam);
      setMicState(mic);
      if (mic === "denied" && (mode === "audio" || cam === "denied")) {
        setPhase("denied");
        return;
      }
      if (cam === "denied" && mode === "video") {
        setPhase("denied");
        return;
      }
      if (
        (mode === "audio" && mic === "granted") ||
        (cam === "granted" && mic === "granted")
      ) {
        setPhase("granted");
        return;
      }
      setPhase("requesting");
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (phase !== "requesting") return;
    let alive = true;
    navigator.mediaDevices
      .getUserMedia(
        mode === "audio"
          ? { audio: true, video: false }
          : { audio: true, video: true },
      )
      .then((s) => {
        s.getTracks().forEach((t) => t.stop());
        if (alive) setPhase("granted");
      })
      .catch((err) => {
        if (!alive) return;
        setPhase(err.name === "NotFoundError" ? "noDevice" : "denied");
      });
    return () => {
      alive = false;
    };
  }, [phase, mode]);

  useEffect(() => {
    if (phase === "granted") onGranted();
  }, [phase]); // eslint-disable-line

  const steps = useMemo(() => {
    if (os === "ios")
      return [
        "Open iPhone Settings → Privacy & Security",
        "Tap Camera → enable for this browser",
        "Tap Microphone → enable for this browser",
        "Return here and tap Try Again",
      ];
    return (
      {
        chrome: [
          "Click the 🔒 lock icon in the address bar",
          'Set Camera & Microphone to "Allow"',
          "Refresh the page",
        ],
        firefox: [
          "Click the camera icon in the address bar",
          "Remove the blocked permission",
          "Reload and allow when prompted",
        ],
        safari: [
          "Open Safari → Settings → Websites",
          "Find Camera & Microphone for this site",
          'Set both to "Allow"',
        ],
        edge: [
          'Click 🔒 in address bar, set Camera & Microphone to "Allow"',
          "Refresh the page",
        ],
      }[browser] || [
        "Click the 🔒 lock icon",
        "Allow Camera and Microphone",
        "Refresh the page",
      ]
    );
  }, [browser, os]);

  const fontStyle = {
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
  };

  if (phase === "checking" || phase === "requesting")
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          ...fontStyle,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid rgba(132,204,22,.2)",
            borderTopColor: "#84cc16",
            animation: "svSpin 1s linear infinite",
          }}
        />
        <p
          style={{
            fontSize: 14,
            color: "#525252",
            fontWeight: 600,
            margin: 0,
            textAlign: "center",
          }}
        >
          {phase === "checking"
            ? "Checking permissions…"
            : "Waiting for permission…"}
        </p>
        {phase === "requesting" && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(132,204,22,.07)",
              border: "1px solid rgba(132,204,22,.2)",
              borderRadius: 12,
              maxWidth: 290,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "#84cc16",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              A browser dialog appeared — click <strong>Allow</strong> to
              continue.
            </p>
          </div>
        )}
      </div>
    );

  if (phase === "noDevice")
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          textAlign: "center",
          ...fontStyle,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: "rgba(251,191,36,.1)",
            border: "1px solid rgba(251,191,36,.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CameraOff size={26} color="#fbbf24" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>
          No Device Found
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "#525252",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 280,
          }}
        >
          {mode === "video"
            ? "No camera detected. You can still broadcast audio only."
            : "No microphone found. Please connect one and try again."}
        </p>
        {mode === "video" && (
          <button
            onClick={onAudioOnly}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "11px 22px",
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 900,
              fontFamily: "inherit",
            }}
          >
            <Mic size={15} />
            Audio Only
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: "9px 22px",
            borderRadius: 11,
            cursor: "pointer",
            background: "transparent",
            border: "1px solid rgba(255,255,255,.08)",
            color: "#484848",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    );

  if (phase === "denied")
    return (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 14,
          padding: "24px 20px",
          textAlign: "center",
          ...fontStyle,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: "rgba(239,68,68,.1)",
            border: "1px solid rgba(239,68,68,.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          <Shield size={26} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>
          Permission Required
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "#525252",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 300,
          }}
        >
          {camState === "denied" &&
            micState === "denied" &&
            "Camera and microphone were blocked. "}
          {camState === "denied" &&
            micState !== "denied" &&
            "Camera access was blocked. "}
          {camState !== "denied" &&
            micState === "denied" &&
            "Microphone access was blocked. "}
          Fix it in your browser settings then try again.
        </p>
        <div
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "12px 14px",
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 12,
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "#525252",
              textTransform: "uppercase",
              letterSpacing: ".7px",
              marginBottom: 8,
            }}
          >
            How to fix
          </div>
          <ol
            style={{
              margin: 0,
              padding: "0 0 0 16px",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            {steps.map((s, i) => (
              <li
                key={i}
                style={{ fontSize: 12, color: "#a3a3a3", lineHeight: 1.5 }}
              >
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            maxWidth: 300,
          }}
        >
          {camState === "denied" &&
            micState !== "denied" &&
            mode === "video" && (
              <button
                onClick={onAudioOnly}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "11px",
                  borderRadius: 11,
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 900,
                  fontFamily: "inherit",
                  width: "100%",
                }}
              >
                <Mic size={15} />
                Continue Audio Only
              </button>
            )}
          <button
            onClick={() => setPhase("requesting")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "11px",
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
              color: "#000",
              fontSize: 13,
              fontWeight: 900,
              fontFamily: "inherit",
              width: "100%",
            }}
          >
            <RefreshCw size={15} />
            Try Again
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "9px",
              borderRadius: 11,
              cursor: "pointer",
              background: "transparent",
              border: "1px solid rgba(255,255,255,.08)",
              color: "#484848",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              width: "100%",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );

  return null;
};

// ── [A2] Camera preview stage ─────────────────────────────────────────────────
const CameraPreview = ({ mode, preset, onStreamReady, onError }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [mirrored, setMirrored] = useState(true);

  useEffect(() => {
    let alive = true;
    getMediaStream(mode, preset)
      .then((stream) => {
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current && mode === "video")
          videoRef.current.srcObject = stream;
        setReady(true);
        onStreamReady(stream);
      })
      .catch((err) => {
        if (alive) onError(err);
      });
    return () => {
      alive = false;
    };
  }, [mode, preset]); // eslint-disable-line

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        background: "#000",
        flexShrink: 0,
        height: "clamp(220px,38vw,380px)",
        overflow: "hidden",
      }}
    >
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "3px solid rgba(132,204,22,.2)",
              borderTopColor: "#84cc16",
              animation: "svSpin 1s linear infinite",
            }}
          />
        </div>
      )}
      {mode === "video" ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transform: mirrored ? "scaleX(-1)" : "none",
            transition: "transform .25s",
          }}
        />
      ) : (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            background: "#0a0a0a",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🎙
          </div>
          {ready && streamRef.current && (
            <AudioBars stream={streamRef.current} active color="#a78bfa" />
          )}
          <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>
            Microphone Active
          </span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          background: "linear-gradient(transparent,rgba(0,0,0,.7))",
          pointerEvents: "none",
        }}
      />
      {mode === "video" && ready && (
        <button
          onClick={() => setMirrored((p) => !p)}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "rgba(0,0,0,.65)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  );
};

// ── [A9] Stage invite toast (viewer) ─────────────────────────────────────────
const StageInviteToast = ({ invite, onAccept, onDecline }) => (
  <div
    style={{
      position: "absolute",
      bottom: 64,
      left: 12,
      right: 12,
      zIndex: 200,
      animation: "svInvite .3s cubic-bezier(.34,1.1,.64,1)",
    }}
  >
    <div
      style={{
        background: "#141414",
        border: "1px solid rgba(132,204,22,.4)",
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,.9)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: "rgba(132,204,22,.12)",
            border: "1px solid rgba(132,204,22,.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {invite.type === "video" ? (
            <Video size={16} color="#84cc16" />
          ) : (
            <Mic size={16} color="#84cc16" />
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.2,
            }}
          >
            {invite.type === "video" ? "Share your camera!" : "Join the stage!"}
          </div>
          <div style={{ fontSize: 11, color: "#525252", marginTop: 2 }}>
            The host invited you{" "}
            {invite.type === "video" ? "on video" : "to speak"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onAccept}
          style={{
            flex: 1,
            padding: "9px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
            color: "#000",
            fontSize: 12,
            fontWeight: 900,
            fontFamily: "inherit",
          }}
        >
          {invite.type === "video" ? "Go on Camera" : "Join Stage"}
        </button>
        <button
          onClick={onDecline}
          style={{
            flex: 1,
            padding: "9px",
            borderRadius: 10,
            cursor: "pointer",
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            color: "#737373",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          Decline
        </button>
      </div>
    </div>
  </div>
);

// ── Stage tile (compact participant card) ─────────────────────────────────────
// ── Adaptive Stage Grid ───────────────────────────────────────────────────────
//
// Grid layout rules (total = host + co-participants):
//   1 person  (solo host)  → full width, no grid shown
//   2 people               → 2 equal columns
//   3 people               → host top-full-width + 2 below
//   4 people               → 2×2 grid
//   5 people               → host top-full + row of 4 below
//   6 people               → 2×3 grid
//   7-9 people             → 3×3 grid
//
// MAX_STAGE = 8 co-participants + host = 9 total (3×3 perfectly divisible)
//
// Each cell shows:
//   - Live camera feed (video) OR avatar (audio speaker)
//   - Speaking pulse ring (green animated ring when mic active + audio detected)
//   - Host crown badge (gold)
//   - Mute indicator dot
//   - Name + role label
//   - Host control buttons (mute / remove) on hover overlay
//
const MAX_STAGE = 8; // max co-participants (not counting host)

// Compute grid columns/rows from total participant count
function gridLayout(total) {
  if (total <= 1) return { cols: 1, rows: 1 };
  if (total === 2) return { cols: 2, rows: 1 };
  if (total === 3) return { cols: 2, rows: 2, hostSpan: 2 }; // host spans top row
  if (total === 4) return { cols: 2, rows: 2 };
  if (total === 5) return { cols: 4, rows: 2, hostSpan: 4 }; // host spans top
  if (total === 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 }; // 7-9
}

// One cell in the stage grid
const StageCell = ({
  p,
  isSelf,
  isHost,
  canControl,
  speaking,
  onMute,
  onRemove,
  stageH,
  cols,
}) => {
  const videoRef = useRef(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (videoRef.current && p.stream) videoRef.current.srcObject = p.stream;
  }, [p.stream]);

  const initial = (p.name || "?").charAt(0).toUpperCase();
  const micActive = p.micOn !== false;
  const isCoStreamer = p.role === "co-streamer";
  const cellH = Math.floor(stageH / Math.ceil(cols > 1 ? 2 : 1));

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "#0a0a0a",
        overflow: "hidden",
        border:
          speaking && micActive
            ? "2px solid rgba(132,204,22,.7)"
            : "2px solid rgba(255,255,255,.06)",
        transition: "border-color .3s",
        // Speaking glow
        boxShadow:
          speaking && micActive
            ? "0 0 0 2px rgba(132,204,22,.18) inset"
            : "none",
      }}
    >
      {/* Video or avatar */}
      {isCoStreamer && p.stream && p.camOn !== false ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isSelf}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: isHost
              ? "linear-gradient(160deg,#1a1200,#0a0a0a)"
              : "linear-gradient(160deg,#0d1200,#0a0a0a)",
          }}
        >
          {/* Speaking rings */}
          {speaking && micActive && (
            <>
              <div
                style={{
                  position: "absolute",
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: "2px solid rgba(132,204,22,.5)",
                  animation: "svSpeakRing 1.2s ease-out infinite",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: "2px solid rgba(132,204,22,.3)",
                  animation: "svSpeakRing 1.2s ease-out .4s infinite",
                  pointerEvents: "none",
                }}
              />
            </>
          )}
          {/* Avatar */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              flexShrink: 0,
              position: "relative",
              zIndex: 1,
              background: isHost
                ? "linear-gradient(135deg,#fbbf24,#f59e0b)"
                : "linear-gradient(135deg,#84cc16,#4d7c0f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 22,
              color: "#000",
              boxShadow:
                speaking && micActive
                  ? "0 0 0 3px rgba(132,204,22,.5), 0 0 0 6px rgba(132,204,22,.2)"
                  : "none",
              transition: "box-shadow .3s",
            }}
          >
            {initial}
            {isHost && (
              <div
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                  border: "2px solid #0a0a0a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Crown size={9} color="#000" />
              </div>
            )}
          </div>
          {/* Audio visualiser bars for speakers */}
          {speaking && micActive && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: 18,
                position: "relative",
                zIndex: 1,
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    borderRadius: 2,
                    background: "#84cc16",
                    height: `${4 + Math.random() * 14}px`,
                    animation: `svBar .6s ease-in-out ${i * 0.08}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Name / role label — bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 8px 6px",
          background: "linear-gradient(transparent,rgba(0,0,0,.85))",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: isHost ? "#fbbf24" : "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {isSelf ? "You" : p.name}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "rgba(255,255,255,.5)",
              fontWeight: 600,
              marginTop: 1,
            }}
          >
            {isHost ? "Host" : isCoStreamer ? "On Cam" : "Speaker"}
          </div>
        </div>
        {/* Mic indicator */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            flexShrink: 0,
            background: micActive
              ? "rgba(132,204,22,.9)"
              : "rgba(239,68,68,.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 4,
          }}
        >
          {micActive ? (
            <Mic size={7} color="#000" />
          ) : (
            <MicOff size={7} color="#fff" />
          )}
        </div>
      </div>

      {/* Host control overlay (hover) */}
      {canControl && !isSelf && !isHost && hover && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            display: "flex",
            gap: 4,
            animation: "svUp .15s ease",
          }}
        >
          <button
            onClick={() => onMute && onMute(p)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              cursor: "pointer",
              border: "none",
              background: "rgba(0,0,0,.8)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c4c4c4",
            }}
          >
            {micActive ? <MicOff size={10} /> : <Mic size={10} />}
          </button>
          <button
            onClick={() => onRemove && onRemove(p)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              cursor: "pointer",
              border: "none",
              background: "rgba(239,68,68,.8)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
};

// Invite search panel — slides down inside the stage area
const StageSearchPanel = ({ viewerList, handRaisers, onInvite, onClose }) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const all = useMemo(() => {
    // Merge hand raisers first, then remaining viewers
    const raisedIds = new Set(handRaisers.map((h) => h.id));
    const others = viewerList.filter((v) => !raisedIds.has(v.id));
    return [...handRaisers.map((h) => ({ ...h, raised: true })), ...others];
  }, [viewerList, handRaisers]);

  const filtered = query.trim()
    ? all.filter((v) =>
        (v.name || "").toLowerCase().includes(query.toLowerCase()),
      )
    : all;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        background: "rgba(5,5,5,.97)",
        backdropFilter: "blur(16px)",
        display: "flex",
        flexDirection: "column",
        animation: "svSearchIn .2s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,.07)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,.06)",
            borderRadius: 10,
            padding: "7px 10px",
          }}
        >
          <Search size={13} color="#525252" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search viewers by name…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 12,
              fontFamily: "inherit",
              caretColor: "#84cc16",
            }}
          />
        </div>
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            cursor: "pointer",
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#737373",
          }}
        >
          <X size={13} />
        </button>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: "#2a2a2a",
              fontSize: 12,
            }}
          >
            {query
              ? "No viewers match that name"
              : "No viewers yet — share your stream link"}
          </div>
        ) : (
          filtered.map((v) => (
            <div
              key={v.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 8px",
                borderRadius: 10,
                marginBottom: 4,
                background: v.raised
                  ? "rgba(251,191,36,.04)"
                  : "rgba(255,255,255,.025)",
                border: `1px solid ${v.raised ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.05)"}`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 13,
                  color: "#000",
                }}
              >
                {(v.name || "?").replace("@", "").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#d4d4d4",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.name}
                </div>
                {v.raised && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "#fbbf24",
                      fontWeight: 700,
                      marginTop: 1,
                    }}
                  >
                    ✋ Hand raised
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  onClick={() => {
                    onInvite(v, "audio");
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "5px 9px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "none",
                    background: "rgba(132,204,22,.15)",
                    color: "#84cc16",
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: "inherit",
                  }}
                >
                  <Mic size={10} /> Speak
                </button>
                <button
                  onClick={() => {
                    onInvite(v, "video");
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "5px 9px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "none",
                    background: "rgba(96,165,250,.15)",
                    color: "#60a5fa",
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: "inherit",
                  }}
                >
                  <Video size={10} /> Cam
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// The main adaptive stage grid component
// stagePeople = [host, ...co-participants] — host is always first
const StageGrid = ({
  stagePeople,
  currentUserId,
  isHost,
  mode,
  hostVideoRef,
  hostCamOn,
  hostMicOn,
  hostStream,
  onMute,
  onRemove,
  viewerList,
  handRaisers,
  onInvite,
  speakingId, // id of person currently detected as speaking
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const total = stagePeople.length;
  const layout = gridLayout(total);
  const canAddMore =
    stagePeople.filter((p) => p.role !== "host").length < MAX_STAGE;

  // Attach host video
  useEffect(() => {
    if (hostVideoRef?.current && hostStream && mode === "video")
      hostVideoRef.current.srcObject = hostStream;
  }, [hostStream, mode, hostVideoRef]);

  if (total <= 1) {
    // Solo — just the regular full-width video, no grid
    return null;
  }

  // Build grid CSS
  const gridCols = `repeat(${layout.cols}, 1fr)`;
  const stageHcss = "clamp(220px, 38vw, 380px)";
  const stageH =
    typeof window !== "undefined"
      ? Math.max(220, Math.min(380, Math.round(window.innerWidth * 0.38)))
      : 280;

  return (
    <div style={{ position: "relative", flexShrink: 0, background: "#000" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          gridAutoRows: `${Math.floor(stageH / (layout.rows || 1))}px`,
          gap: 2,
          height: stageHcss,
          background: "#000",
        }}
      >
        {stagePeople.map((p, idx) => {
          const pIsHost = p.role === "host";
          const pIsSelf = p.id === currentUserId;
          const speaking = p.id === speakingId;

          // Host cell uses the ref for live video feed
          if (pIsHost) {
            return (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  background: "#0a0a0a",
                  overflow: "hidden",
                  // Host spans full top row when layout.hostSpan is set
                  gridColumn: layout.hostSpan
                    ? `1 / span ${layout.hostSpan}`
                    : undefined,
                  border:
                    speaking && hostMicOn
                      ? "2px solid rgba(132,204,22,.7)"
                      : "2px solid rgba(255,255,255,.06)",
                  transition: "border-color .3s",
                }}
              >
                {mode === "video" ? (
                  <>
                    <video
                      ref={hostVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        transform: "scaleX(-1)",
                      }}
                    />
                    {!hostCamOn && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,.88)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <VideoOff size={24} color="#383838" />
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(160deg,#1a1200,#0a0a0a)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {speaking && hostMicOn && (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            border: "2px solid rgba(132,204,22,.5)",
                            animation: "svSpeakRing 1.2s ease-out infinite",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            border: "2px solid rgba(132,204,22,.3)",
                            animation: "svSpeakRing 1.2s ease-out .4s infinite",
                          }}
                        />
                      </>
                    )}
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 20,
                        color: "#000",
                        position: "relative",
                        zIndex: 1,
                        boxShadow:
                          speaking && hostMicOn
                            ? "0 0 0 3px rgba(132,204,22,.5),0 0 0 7px rgba(132,204,22,.2)"
                            : "none",
                      }}
                    >
                      {(p.name || "H").charAt(0).toUpperCase()}
                      <div
                        style={{
                          position: "absolute",
                          top: -5,
                          right: -5,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                          border: "2px solid #0a0a0a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Crown size={8} color="#000" />
                      </div>
                    </div>
                    <AudioBars
                      stream={hostStream}
                      active={hostMicOn}
                      color="#a78bfa"
                    />
                  </div>
                )}
                {/* LIVE badge + name */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "12px 8px 5px",
                    background: "linear-gradient(transparent,rgba(0,0,0,.85))",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#fbbf24",
                      }}
                    >
                      {p.name || "Host"}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,.5)",
                        marginTop: 1,
                      }}
                    >
                      Host
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 6px",
                      borderRadius: 5,
                      background: "rgba(239,68,68,.75)",
                      fontSize: 9,
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#fff",
                        animation: "svLivePulse 1.4s ease-in-out infinite",
                      }}
                    />
                    LIVE
                  </div>
                </div>
              </div>
            );
          }

          return (
            <StageCell
              key={p.id}
              p={p}
              isSelf={pIsSelf}
              isHost={false}
              canControl={isHost}
              speaking={speaking}
              onMute={onMute}
              onRemove={onRemove}
              stageH={stageH}
              cols={layout.cols}
            />
          );
        })}

        {/* Add participant cell — only shown to host, only if under limit */}
        {isHost && canAddMore && (
          <div
            onClick={() => setShowSearch(true)}
            style={{
              cursor: "pointer",
              background: "rgba(255,255,255,.025)",
              border: "2px dashed rgba(132,204,22,.25)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all .18s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(132,204,22,.06)";
              e.currentTarget.style.borderColor = "rgba(132,204,22,.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,.025)";
              e.currentTarget.style.borderColor = "rgba(132,204,22,.25)";
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(132,204,22,.12)",
                border: "1px solid rgba(132,204,22,.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={16} color="#84cc16" />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#525252" }}>
              Add to stage
            </span>
          </div>
        )}
      </div>

      {/* Search panel overlay */}
      {showSearch && (
        <StageSearchPanel
          viewerList={viewerList}
          handRaisers={handRaisers}
          onInvite={onInvite}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
};

// ── [A10] Viewer Room — fully styled, original design language ────────────────
const ViewerRoom = ({ session, currentUser, onClose }) => {
  const isDesktop = useIsDesktop();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ended, setEnded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [likes, setLikes] = useState(session.total_likes || 0);
  const [likeAnim, setLikeAnim] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [muted, setMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [stageInvite, setStageInvite] = useState(null);
  const [stagePhase, setStagePhase] = useState("off"); // off|permitting|joining|on
  const [stageMode, setStageMode] = useState("audio");
  const [onStage, setOnStage] = useState(false);
  const [stageMicOn, setStageMicOn] = useState(true);
  const [stageCamOn, setStageCamOn] = useState(true);
  const [allStage, setAllStage] = useState([]);
  // ── FIX: tab state was missing from ViewerRoom ────────────────────────────
  const [tab, setTab] = useState("chat");

  const chRef = useRef(null);
  const chatRef = useRef(null);
  const pingRef = useRef(null);
  const msgId = useRef(0);
  const heartId = useRef(0);
  const stageRef = useRef(null); // MediaStream ref

  const profile = session.profiles || {};
  const myId = currentUser?.id || "viewer";
  const myName = `@${currentUser?.username || currentUser?.fullName || "viewer"}`;
  const myColor = chatColor(myId);
  const sessionMode = session.mode || "video";

  const FONT =
    "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif";

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Presence ping
        if (currentUser?.id) {
          const ping = () =>
            supabase
              .from("stream_viewers")
              .upsert(
                {
                  session_id: session.id,
                  user_id: currentUser.id,
                  last_seen: new Date().toISOString(),
                },
                { onConflict: "session_id,user_id" },
              )
              .then(() => {})
              .catch(() => {});
          ping();
          pingRef.current = setInterval(ping, 20_000);
        }

        const ch = supabase.channel(`stream:${session.id}`, {
          config: { broadcast: { self: true }, presence: { key: myId } },
        });
        ch.on("broadcast", { event: "chat" }, ({ payload }) => {
          if (!alive) return;
          setMessages((p) => [
            ...p.slice(-199),
            { id: ++msgId.current, ...payload },
          ]);
        });
        ch.on("broadcast", { event: "like" }, ({ payload }) => {
          if (!alive) return;
          setLikes((c) => c + 1);
          setMessages((p) => [
            ...p.slice(-199),
            { id: ++msgId.current, type: "like", user: payload.user },
          ]);
        });
        ch.on("broadcast", { event: "stream_ended" }, () => {
          if (alive) setEnded(true);
        });
        ch.on("broadcast", { event: "stage_state" }, ({ payload }) => {
          if (!alive) return;
          setAllStage(payload.participants || []);
        });
        ch.on("broadcast", { event: "stage_invite" }, ({ payload }) => {
          if (!alive || payload.targetId !== myId) return;
          setStageInvite({ type: payload.type });
        });
        ch.on("broadcast", { event: "stage_revoke" }, ({ payload }) => {
          if (!alive || payload.targetId !== myId) return;
          leaveStage();
          setMessages((p) => [
            ...p.slice(-199),
            {
              id: ++msgId.current,
              type: "system",
              text: "You were removed from the stage.",
            },
          ]);
        });
        ch.on("broadcast", { event: "stage_mute" }, ({ payload }) => {
          if (!alive || payload.targetId !== myId || !stageRef.current) return;
          stageRef.current.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          setStageMicOn(false);
        });
        ch.on("presence", { event: "sync" }, () => {
          setViewerCount(
            Math.max(0, Object.keys(ch.presenceState()).length - 1),
          );
        });
        await ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ user: myName, userId: myId, role: "viewer" });
            ch.send({
              type: "broadcast",
              event: "chat",
              payload: { type: "join", user: myName },
            });
          }
        });
        chRef.current = ch;
        supabase
          .channel(`ss:${session.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "live_sessions",
              filter: `id=eq.${session.id}`,
            },
            (p) => {
              if (p.new?.status === "ended" && alive) setEnded(true);
            },
          )
          .subscribe();
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      clearInterval(pingRef.current);
      if (chRef.current) {
        chRef.current.send({
          type: "broadcast",
          event: "chat",
          payload: { type: "leave", user: myName },
        });
        supabase.removeChannel(chRef.current);
      }
      if (stageRef.current)
        stageRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [session.id]); // eslint-disable-line

  const sendMsg = () => {
    if (!chatInput.trim() || !chRef.current) return;
    chRef.current.send({
      type: "broadcast",
      event: "chat",
      payload: {
        type: "chat",
        user: myName,
        text: chatInput.trim(),
        color: myColor,
        speakerBadge: onStage,
      },
    });
    setChatInput("");
  };
  const sendLike = () => {
    if (!chRef.current) return;
    chRef.current.send({
      type: "broadcast",
      event: "like",
      payload: { user: myName },
    });
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 600);
    const id = ++heartId.current,
      x = 28 + Math.random() * 44;
    setHearts((h) => [...h, { id, x }]);
    setTimeout(() => setHearts((h) => h.filter((hh) => hh.id !== id)), 1200);
  };
  const toggleHand = () => {
    if (!chRef.current) return;
    const raised = !handRaised;
    setHandRaised(raised);
    chRef.current.send({
      type: "broadcast",
      event: raised ? "hand_raise" : "hand_lower",
      payload: { userId: myId, user: myName },
    });
  };
  const acceptInvite = () => {
    const type = stageInvite?.type || "audio";
    setStageInvite(null);
    setStageMode(type);
    setStagePhase("permitting");
  };
  const declineInvite = () => {
    setStageInvite(null);
    if (chRef.current)
      chRef.current.send({
        type: "broadcast",
        event: "stage_declined",
        payload: { userId: myId, user: myName },
      });
  };

  const onPermGranted = useCallback(async () => {
    setStagePhase("joining");
    try {
      const stream = await getMediaStream(stageMode, "medium");
      stageRef.current = stream;
      setOnStage(true);
      setStagePhase("on");
      if (chRef.current) {
        chRef.current.send({
          type: "broadcast",
          event: "chat",
          payload: { type: "stage", text: `${myName} joined the stage` },
        });
        chRef.current.send({
          type: "broadcast",
          event: "viewer_joined_stage",
          payload: {
            userId: myId,
            user: myName.replace("@", ""),
            role: stageMode === "video" ? "co-streamer" : "co-speaker",
          },
        });
      }
    } catch (e) {
      setStagePhase("off");
      setMessages((p) => [
        ...p.slice(-199),
        {
          id: ++msgId.current,
          type: "system",
          text: `Couldn't join stage: ${e.message}`,
        },
      ]);
    }
  }, [stageMode, myId, myName]);

  const leaveStage = useCallback(() => {
    if (stageRef.current) {
      stageRef.current.getTracks().forEach((t) => t.stop());
      stageRef.current = null;
    }
    setOnStage(false);
    setStagePhase("off");
    if (chRef.current) {
      chRef.current.send({
        type: "broadcast",
        event: "viewer_left_stage",
        payload: { userId: myId, user: myName },
      });
      chRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: { type: "stage", text: `${myName} left the stage` },
      });
    }
  }, [myId, myName]);

  const toggleStageMic = () => {
    if (!stageRef.current) return;
    stageRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setStageMicOn((p) => !p);
  };
  const toggleStageCam = () => {
    if (!stageRef.current) return;
    stageRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setStageCamOn((p) => !p);
  };

  const displayStage = useMemo(() => {
    if (!onStage) return allStage;
    const others = allStage.filter((p) => p.id !== myId);
    return [
      ...others,
      {
        id: myId,
        name: myName.replace("@", ""),
        role: stageMode === "video" ? "co-streamer" : "co-speaker",
        onStage: true,
        micOn: stageMicOn,
        camOn: stageCamOn,
        stream: stageRef.current,
      },
    ];
  }, [allStage, onStage, myId, myName, stageMode, stageMicOn, stageCamOn]);

  // ── FIX: define viewerBody — the mobile column layout for viewers ─────────
  const viewerBody = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Video area */}
      <div
        style={{
          height: "clamp(220px,38vw,380px)",
          flexShrink: 0,
          background: "#000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {SDK_AVAILABLE ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 900,
                  color: "#000",
                }}
              >
                {(profile.full_name || "?").charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                {session.title}
              </span>
              <span style={{ fontSize: 12, color: "#525252" }}>
                {session.category}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 900,
                color: "#000",
              }}
            >
              {(profile.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
              {session.title}
            </span>
          </div>
        )}
        <div style={{ position: "absolute", top: 9, left: 9 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 9px",
              borderRadius: 7,
              background: "rgba(0,0,0,.65)",
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
        </div>
        <div
          style={{ position: "absolute", bottom: 9, left: 9, right: 80 }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: "3px 9px",
              background: "rgba(0,0,0,.72)",
              backdropFilter: "blur(8px)",
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session.title}
          </div>
        </div>
        {/* Like + hand */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <button
            onClick={sendLike}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              cursor: "pointer",
              background: "rgba(244,114,182,.12)",
              border: "1px solid rgba(244,114,182,.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Heart
              size={17}
              color="#f472b6"
              fill={likeAnim ? "#f472b6" : "none"}
              style={{ animation: likeAnim ? "svLikePop .5s ease" : "none" }}
            />
          </button>
          <button
            onClick={toggleHand}
            title={handRaised ? "Lower hand" : "Raise hand"}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              cursor: "pointer",
              background: handRaised
                ? "rgba(251,191,36,.15)"
                : "rgba(255,255,255,.06)",
              border: `1px solid ${handRaised ? "rgba(251,191,36,.35)" : "rgba(255,255,255,.1)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Hand
              size={16}
              color={handRaised ? "#fbbf24" : "#525252"}
              style={{
                animation: handRaised ? "svHandWave 1s ease-in-out infinite" : "",
              }}
            />
          </button>
        </div>
        {hearts.map((h) => (
          <div
            key={h.id}
            style={{
              position: "absolute",
              bottom: 16,
              left: `${h.x}%`,
              fontSize: 20,
              animation: "svHeartFly 1.1s ease-out forwards",
              pointerEvents: "none",
            }}
          >
            ❤️
          </div>
        ))}
        {/* Stage invite toast */}
        {stageInvite && (
          <StageInviteToast
            invite={stageInvite}
            onAccept={acceptInvite}
            onDecline={declineInvite}
          />
        )}
      </div>

      {/* Stage grid */}
      {displayStage.length > 0 && (
        <StageGrid
          stagePeople={displayStage}
          currentUserId={myId}
          isHost={false}
          mode={sessionMode}
          hostVideoRef={null}
          hostCamOn={false}
          hostMicOn={false}
          hostStream={null}
          onMute={null}
          onRemove={null}
          viewerList={[]}
          handRaisers={[]}
          onInvite={null}
          speakingId={null}
        />
      )}

      {/* On-stage controls */}
      {onStage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 14px",
            flexShrink: 0,
            background: "rgba(132,204,22,.05)",
            border: "1px solid rgba(132,204,22,.14)",
            borderLeft: "none",
            borderRight: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 800,
              color: "#84cc16",
              marginRight: 8,
            }}
          >
            <Star size={12} fill="#84cc16" />
            ON STAGE
          </div>
          <button
            onClick={toggleStageMic}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: stageMicOn
                ? "rgba(255,255,255,.08)"
                : "rgba(239,68,68,.09)",
              color: stageMicOn ? "#fff" : "#ef4444",
            }}
          >
            {stageMicOn ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
          {stageMode === "video" && (
            <button
              onClick={toggleStageCam}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                cursor: "pointer",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: stageCamOn
                  ? "rgba(255,255,255,.08)"
                  : "rgba(239,68,68,.09)",
                color: stageCamOn ? "#fff" : "#ef4444",
              }}
            >
              {stageCamOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
          )}
          <button
            onClick={leaveStage}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              cursor: "pointer",
              border: "1px solid rgba(239,68,68,.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(239,68,68,.12)",
              color: "#ef4444",
            }}
          >
            <PhoneOff size={16} />
          </button>
        </div>
      )}

      {/* Chat tab bar */}
      <div
        style={{
          display: "flex",
          padding: "5px 12px 0",
          background: "rgba(0,0,0,.9)",
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,.04)",
          gap: 4,
        }}
      >
        {[
          ["chat", "💬 Chat"],
          ["viewers", "👁 Viewers"],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: "7px 4px",
              borderRadius: 8,
              border: "none",
              fontSize: 9.5,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: FONT,
              background: tab === k ? "rgba(132,204,22,.1)" : "transparent",
              color: tab === k ? "#84cc16" : "#383838",
              textTransform: "uppercase",
              letterSpacing: ".3px",
              transition: "all .15s",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tab panels */}
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
                gap: 4,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 0",
                    color: "#242424",
                    fontSize: 12,
                  }}
                >
                  Be the first to say something 👋
                </div>
              )}
              {messages.map((m) => {
                if (m.type === "join")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#383838",
                        fontStyle: "italic",
                        animation: "svUp .15s ease",
                      }}
                    >
                      👋 {m.user} joined
                    </div>
                  );
                if (m.type === "leave")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#383838",
                        fontStyle: "italic",
                        animation: "svUp .15s ease",
                      }}
                    >
                      — {m.user} left
                    </div>
                  );
                if (m.type === "like")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#f472b6",
                        animation: "svUp .15s ease",
                      }}
                    >
                      ❤️ {m.user}
                    </div>
                  );
                if (m.type === "stage")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#fbbf24",
                        animation: "svUp .15s ease",
                      }}
                    >
                      🎙 {m.text}
                    </div>
                  );
                if (m.type === "system")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#525252",
                        fontStyle: "italic",
                        animation: "svUp .15s ease",
                      }}
                    >
                      ℹ {m.text}
                    </div>
                  );
                return (
                  <div
                    key={m.id}
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      animation: "svUp .18s ease",
                    }}
                  >
                    {m.speakerBadge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          background: "rgba(167,139,250,.15)",
                          color: "#a78bfa",
                          padding: "1px 5px",
                          borderRadius: 4,
                          marginRight: 5,
                        }}
                      >
                        ON STAGE
                      </span>
                    )}
                    <span
                      style={{ fontWeight: 800, marginRight: 4, color: m.color }}
                    >
                      {m.user}
                    </span>
                    <span style={{ color: "#c4c4c4" }}>{m.text}</span>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                gap: 7,
                padding: "8px 12px 12px",
                borderTop: "1px solid rgba(255,255,255,.04)",
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
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 9,
                  padding: "8px 11px",
                  color: "#fff",
                  fontSize: 12,
                  outline: "none",
                  caretColor: "#84cc16",
                  fontFamily: FONT,
                }}
              />
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

        {tab === "viewers" && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Users size={32} color="#2a2a2a" />
            <span style={{ fontSize: 24, fontWeight: 900, color: "#84cc16" }}>
              {fmtN(viewerCount || session.peak_viewers)}
            </span>
            <span style={{ fontSize: 11, color: "#525252", fontWeight: 600 }}>
              watching right now
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // Permission gate overlay
  if (stagePhase === "permitting")
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT,
          color: "#fff",
        }}
      >
        <style>{BASE_CSS}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            background: "rgba(5,5,5,.98)",
            backdropFilter: "blur(22px)",
            borderBottom: "1px solid rgba(255,255,255,.06)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setStagePhase("off")}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#737373",
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
            Join the Stage
          </span>
        </div>
        <PermissionGate
          mode={stageMode}
          onGranted={onPermGranted}
          onAudioOnly={() => setStageMode("audio")}
          onClose={() => setStagePhase("off")}
        />
      </div>
    );

  if (stagePhase === "joining")
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: FONT,
          color: "#fff",
        }}
      >
        <style>{BASE_CSS}</style>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid rgba(132,204,22,.2)",
            borderTopColor: "#84cc16",
            animation: "svSpin 1s linear infinite",
          }}
        />
        <p
          style={{ fontSize: 14, color: "#525252", fontWeight: 600, margin: 0 }}
        >
          Joining the stage…
        </p>
      </div>
    );

  if (ended)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "#050505",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 32,
          textAlign: "center",
          fontFamily: FONT,
          color: "#fff",
        }}
      >
        <style>{BASE_CSS}</style>
        <div style={{ fontSize: 52 }}>📺</div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>
          Stream has ended
        </h2>
        <p style={{ fontSize: 13, color: "#525252", margin: 0 }}>
          {profile.full_name || "The streamer"} wrapped up.
        </p>
        <button
          onClick={onClose}
          style={{
            padding: "12px 28px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
            color: "#000",
            fontSize: 13,
            fontWeight: 900,
            fontFamily: FONT,
          }}
        >
          Back to feed
        </button>
      </div>
    );

  if (loading)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontFamily: FONT,
          color: "#fff",
        }}
      >
        <style>{BASE_CSS}</style>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(132,204,22,.2)",
            borderTopColor: "#84cc16",
            animation: "svSpin 1s linear infinite",
          }}
        />
        <span style={{ color: "#525252", fontSize: 13, fontWeight: 600 }}>
          Joining stream…
        </span>
      </div>
    );

  if (error)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: FONT,
          color: "#fff",
        }}
      >
        <style>{BASE_CSS}</style>
        <AlertCircle size={40} color="#ef4444" />
        <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0 }}>
          Couldn't join stream
        </h3>
        <p style={{ color: "#525252", fontSize: 13, margin: 0 }}>{error}</p>
        <button
          onClick={onClose}
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.1)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          Go Back
        </button>
      </div>
    );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT,
        color: "#fff",
      }}
    >
      <style>{BASE_CSS}</style>
      {/* Header always full-width */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 14px",
          background: "rgba(5,5,5,.98)",
          backdropFilter: "blur(22px)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#737373",
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 13,
                color: "#000",
              }}
            >
              {(profile.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                {profile.full_name || "Streamer"}
              </div>
              <div style={{ fontSize: 10, color: "#525252" }}>
                @{profile.username} · {session.category}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 800,
              color: "#fff",
              background: "rgba(239,68,68,.14)",
              border: "1px solid rgba(239,68,68,.28)",
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
                display: "inline-block",
                animation: "svLivePulse 1.4s ease-in-out infinite",
              }}
            />
            LIVE
          </div>
          <StatPill
            Icon={Eye}
            value={fmtN(viewerCount || session.peak_viewers)}
            color="#60a5fa"
          />
          <StatPill Icon={Heart} value={fmtN(likes)} color="#f472b6" />
          <button
            onClick={() => setMuted((p) => !p)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: muted ? "#ef4444" : "#737373",
            }}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      {/* Body: desktop = split panel, mobile = column */}
      {isDesktop ? (
        <DesktopLiveShell
          left={
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {/* Video area */}
              <div
                style={{
                  height: "clamp(220px,38vw,380px)",
                  flexShrink: 0,
                  background: "#000",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {SDK_AVAILABLE ? (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 90,
                          height: 90,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 32,
                          fontWeight: 900,
                          color: "#000",
                        }}
                      >
                        {(profile.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <span
                        style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}
                      >
                        {session.title}
                      </span>
                      <span style={{ fontSize: 12, color: "#525252" }}>
                        {session.category}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 32,
                        fontWeight: 900,
                        color: "#000",
                      }}
                    >
                      {(profile.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <span
                      style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}
                    >
                      {session.title}
                    </span>
                  </div>
                )}
                <div style={{ position: "absolute", top: 9, left: 9 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 9px",
                      borderRadius: 7,
                      background: "rgba(0,0,0,.65)",
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
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 9,
                    left: 9,
                    right: 80,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      padding: "3px 9px",
                      background: "rgba(0,0,0,.72)",
                      backdropFilter: "blur(8px)",
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {session.title}
                  </div>
                </div>
                {/* Like + hand */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  <button
                    onClick={sendLike}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: "rgba(244,114,182,.12)",
                      border: "1px solid rgba(244,114,182,.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Heart
                      size={17}
                      color="#f472b6"
                      fill={likeAnim ? "#f472b6" : "none"}
                      style={{
                        animation: likeAnim ? "svLikePop .5s ease" : "none",
                      }}
                    />
                  </button>
                  <button
                    onClick={toggleHand}
                    title={handRaised ? "Lower hand" : "Raise hand"}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: handRaised
                        ? "rgba(251,191,36,.15)"
                        : "rgba(255,255,255,.06)",
                      border: `1px solid ${handRaised ? "rgba(251,191,36,.35)" : "rgba(255,255,255,.1)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Hand
                      size={16}
                      color={handRaised ? "#fbbf24" : "#525252"}
                      style={{
                        animation: handRaised
                          ? "svHandWave 1s ease-in-out infinite"
                          : "",
                      }}
                    />
                  </button>
                </div>
                {hearts.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      position: "absolute",
                      bottom: 16,
                      left: `${h.x}%`,
                      fontSize: 20,
                      animation: "svHeartFly 1.1s ease-out forwards",
                      pointerEvents: "none",
                    }}
                  >
                    ❤️
                  </div>
                ))}
              </div>

              {/* Stage grid */}
              {displayStage.length > 0 && (
                <StageGrid
                  stagePeople={displayStage}
                  currentUserId={myId}
                  isHost={false}
                  mode={sessionMode}
                  hostVideoRef={null}
                  hostCamOn={false}
                  hostMicOn={false}
                  hostStream={null}
                  onMute={null}
                  onRemove={null}
                  viewerList={[]}
                  handRaisers={[]}
                  onInvite={null}
                  speakingId={null}
                />
              )}

              {/* On-stage controls */}
              {onStage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 14px",
                    flexShrink: 0,
                    background: "rgba(132,204,22,.05)",
                    border: "1px solid rgba(132,204,22,.14)",
                    borderLeft: "none",
                    borderRight: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#84cc16",
                      marginRight: 8,
                    }}
                  >
                    <Star size={12} fill="#84cc16" />
                    ON STAGE
                  </div>
                  <button
                    onClick={toggleStageMic}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      cursor: "pointer",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: stageMicOn
                        ? "rgba(255,255,255,.08)"
                        : "rgba(239,68,68,.09)",
                      color: stageMicOn ? "#fff" : "#ef4444",
                    }}
                  >
                    {stageMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                  </button>
                  {stageMode === "video" && (
                    <button
                      onClick={toggleStageCam}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        cursor: "pointer",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: stageCamOn
                          ? "rgba(255,255,255,.08)"
                          : "rgba(239,68,68,.09)",
                        color: stageCamOn ? "#fff" : "#ef4444",
                      }}
                    >
                      {stageCamOn ? (
                        <Video size={16} />
                      ) : (
                        <VideoOff size={16} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={leaveStage}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      cursor: "pointer",
                      border: "1px solid rgba(239,68,68,.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(239,68,68,.12)",
                      color: "#ef4444",
                    }}
                  >
                    <PhoneOff size={16} />
                  </button>
                </div>
              )}

              {/* Stage invite toast stays on left panel */}
              {stageInvite && (
                <div style={{ position: "relative" }}>
                  <StageInviteToast
                    invite={stageInvite}
                    onAccept={acceptInvite}
                    onDecline={declineInvite}
                  />
                </div>
              )}
            </div>
          }
          sidebarProps={{
            viewers: viewerCount,
            likes,
            epEarned: 0,
            duration: 0,
            peakVw: 0,
            signal: 4,
            messages,
            chatInput,
            setChatInput,
            onSendMsg: sendMsg,
            chatRef,
            tab,
            setTab,
            handRaisers: [],
            stageParticipants: [],
            allStage: [],
            viewerList: [],
            inviteToStage: () => {},
            muteParticipant: () => {},
            removeFromStage: () => {},
            speakingId: null,
            userId: myId,
            StageCell,
            FONT,
            fmtN,
            fmtDur,
            isHost: false,
            mode: sessionMode,
          }}
        />
      ) : (
        viewerBody
      )}
    </div>
  );
};

// ── Host inner room visual ────────────────────────────────────────────────────
const HostRoom = ({ mode, micOn, camOn, stream }) => (
  <div
    style={{
      flex: 1,
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      minHeight: 220,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at center,rgba(132,204,22,.04) 0%,transparent 70%)",
      }}
    />
    {mode === "audio" && (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
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
            color: "#fff",
            boxShadow: "0 0 0 10px rgba(167,139,250,.1)",
          }}
        >
          🎙
        </div>
        <AudioBars stream={stream} active={micOn} color="#a78bfa" />
        <span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 800 }}>
          {micOn ? "● Broadcasting" : "Mic Muted"}
        </span>
      </div>
    )}
    {mode === "video" && !camOn && (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <VideoOff size={36} color="#383838" />
        <span style={{ color: "#383838", fontSize: 13, fontWeight: 700 }}>
          Camera Off
        </span>
      </div>
    )}
  </div>
);

// ── Desktop detection hook ────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth > 768);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isDesktop;
}

// ── Draggable divider ─────────────────────────────────────────────────────────
const DraggableDivider = ({ onDrag }) => {
  const dragging = useRef(false);
  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    const move = (ev) => {
      if (dragging.current) onDrag(ev.clientX);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up, { once: true });
  };
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        flexShrink: 0,
        cursor: "col-resize",
        position: "relative",
        background: "rgba(255,255,255,.04)",
        transition: "background .18s",
        zIndex: 10,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(132,204,22,.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.04)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 4,
          height: 40,
          borderRadius: 2,
          background: "rgba(255,255,255,.15)",
        }}
      />
    </div>
  );
};

// ── Desktop right sidebar ─────────────────────────────────────────────────────
const DesktopSidebar = ({
  viewers,
  likes,
  epEarned,
  duration,
  peakVw,
  signal,
  messages,
  chatInput,
  setChatInput,
  onSendMsg,
  chatRef,
  tab,
  setTab,
  handRaisers,
  stageParticipants,
  allStage,
  viewerList,
  inviteToStage,
  muteParticipant,
  removeFromStage,
  speakingId,
  userId,
  StageCell,
  FONT,
  fmtN,
  fmtDur,
  isHost,
  mode,
}) => {
  const [liveStreams, setLiveStreams] = useState([]);
  useEffect(() => {
    supabase
      .from("live_sessions")
      .select("id,title,category,mode,profiles(full_name,username)")
      .eq("status", "live")
      .limit(12)
      .then(({ data }) => {
        if (data) setLiveStreams(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#070707",
        borderLeft: "1px solid rgba(255,255,255,.06)",
        fontFamily: FONT,
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Stat strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 14px",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,.05)",
          background: "rgba(0,0,0,.6)",
          flexWrap: "wrap",
        }}
      >
        {[
          [Eye, fmtN(viewers), "#60a5fa"],
          [Heart, fmtN(likes), "#f472b6"],
          [Zap, `+${fmtN(Math.floor(epEarned))} EP`, "#84cc16"],
          [Users, fmtN(peakVw) + " pk", "#a78bfa"],
        ].map(([Icon, val, col], i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 800,
              background: "rgba(255,255,255,.04)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Icon size={10} color={col} />
            {val}
          </div>
        ))}
        <div
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 700,
            color: "#444",
          }}
        >
          {fmtDur(duration)}
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "4px 8px",
          background: "rgba(0,0,0,.8)",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,.05)",
        }}
      >
        {(isHost
          ? [
              ["chat", "💬"],
              [
                "stage",
                `🎙${handRaisers.length > 0 ? ` (${handRaisers.length})` : ""}`,
              ],
              ["viewers", "👁"],
              ["live", "📡"],
            ]
          : [
              ["chat", "💬"],
              ["viewers", "👁"],
              ["live", "📡"],
            ]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 7,
              border: "none",
              fontSize: 10,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: FONT,
              background: tab === k ? "rgba(132,204,22,.12)" : "transparent",
              color: tab === k ? "#84cc16" : "#383838",
              textTransform: "uppercase",
              letterSpacing: ".3px",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* CHAT */}
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
                gap: 4,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 0",
                    color: "#242424",
                    fontSize: 12,
                  }}
                >
                  {isHost
                    ? "Chat will appear here when viewers join 👀"
                    : "Be the first to say something 👋"}
                </div>
              )}
              {messages.map((m) => {
                if (m.type === "join")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#383838",
                        fontStyle: "italic",
                        animation: "svUp .15s ease",
                      }}
                    >
                      👋 {m.user} joined
                    </div>
                  );
                if (m.type === "leave")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#383838",
                        fontStyle: "italic",
                        animation: "svUp .15s ease",
                      }}
                    >
                      — {m.user} left
                    </div>
                  );
                if (m.type === "like")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#f472b6",
                        animation: "svUp .15s ease",
                      }}
                    >
                      ❤️ {m.user}
                    </div>
                  );
                if (m.type === "stage")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#fbbf24",
                        animation: "svUp .15s ease",
                      }}
                    >
                      🎙 {m.text}
                    </div>
                  );
                if (m.type === "system")
                  return (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 11,
                        color: "#525252",
                        fontStyle: "italic",
                        animation: "svUp .15s ease",
                      }}
                    >
                      ℹ {m.text}
                    </div>
                  );
                return (
                  <div
                    key={m.id}
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      animation: "svUp .18s ease",
                    }}
                  >
                    {m.hostBadge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          background: "rgba(132,204,22,.15)",
                          color: "#84cc16",
                          padding: "1px 5px",
                          borderRadius: 4,
                          marginRight: 5,
                        }}
                      >
                        HOST
                      </span>
                    )}
                    {m.speakerBadge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          background: "rgba(167,139,250,.15)",
                          color: "#a78bfa",
                          padding: "1px 5px",
                          borderRadius: 4,
                          marginRight: 5,
                        }}
                      >
                        ON STAGE
                      </span>
                    )}
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
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                gap: 7,
                padding: "8px 12px 12px",
                borderTop: "1px solid rgba(255,255,255,.04)",
                flexShrink: 0,
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendMsg()}
                placeholder={
                  isHost ? "Say something to your viewers…" : "Say something…"
                }
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 9,
                  padding: "8px 11px",
                  color: "#fff",
                  fontSize: 12,
                  outline: "none",
                  caretColor: "#84cc16",
                  fontFamily: FONT,
                }}
              />
              <button
                onClick={onSendMsg}
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

        {/* STAGE — host only */}
        {tab === "stage" && isHost && (
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#383838",
                  textTransform: "uppercase",
                  letterSpacing: ".7px",
                  marginBottom: 8,
                }}
              >
                On Stage ({allStage.length}/9)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {allStage.map((p) => (
                  <StageCell
                    key={p.id}
                    p={p}
                    isSelf={p.id === userId}
                    isHost={p.role === "host"}
                    canControl={p.role !== "host"}
                    speaking={p.id === speakingId}
                    onMute={muteParticipant}
                    onRemove={removeFromStage}
                    stageH={96}
                    cols={4}
                  />
                ))}
              </div>
            </div>
            {handRaisers.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: "#fbbf24",
                    textTransform: "uppercase",
                    letterSpacing: ".7px",
                    marginBottom: 8,
                  }}
                >
                  ✋ Raised Hands ({handRaisers.length})
                </div>
                {handRaisers.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 10,
                      marginBottom: 5,
                      background: "rgba(251,191,36,.04)",
                      border: "1px solid rgba(251,191,36,.14)",
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 13,
                        color: "#000",
                        flexShrink: 0,
                      }}
                    >
                      {(v.name || "?").replace("@", "").charAt(0).toUpperCase()}
                    </div>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#d4d4d4",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.name}
                    </span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        onClick={() => inviteToStage(v, "audio")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          padding: "4px 8px",
                          borderRadius: 7,
                          cursor: "pointer",
                          border: "none",
                          background: "rgba(132,204,22,.15)",
                          color: "#84cc16",
                          fontSize: 10,
                          fontWeight: 800,
                          fontFamily: FONT,
                        }}
                      >
                        <Mic size={9} />
                        Speak
                      </button>
                      <button
                        onClick={() => inviteToStage(v, "video")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          padding: "4px 8px",
                          borderRadius: 7,
                          cursor: "pointer",
                          border: "none",
                          background: "rgba(96,165,250,.15)",
                          color: "#60a5fa",
                          fontSize: 10,
                          fontWeight: 800,
                          fontFamily: FONT,
                        }}
                      >
                        <Video size={9} />
                        Cam
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#383838",
                textTransform: "uppercase",
                letterSpacing: ".7px",
                marginBottom: 8,
              }}
            >
              Invite a Viewer
            </div>
            {viewerList.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  color: "#2a2a2a",
                  fontSize: 12,
                }}
              >
                No viewers yet
              </div>
            ) : (
              viewerList.slice(0, 20).map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 10,
                    marginBottom: 4,
                    background: "rgba(255,255,255,.025)",
                    border: "1px solid rgba(255,255,255,.05)",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 11,
                      color: "#000",
                      flexShrink: 0,
                    }}
                  >
                    {(v.name || "?").replace("@", "").charAt(0).toUpperCase()}
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#d4d4d4",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.name}
                  </span>
                  <div style={{ display: "flex", gap: 3 }}>
                    <button
                      onClick={() => inviteToStage(v, "audio")}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        cursor: "pointer",
                        border: "none",
                        background: "rgba(132,204,22,.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#84cc16",
                      }}
                    >
                      <Mic size={10} />
                    </button>
                    <button
                      onClick={() => inviteToStage(v, "video")}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        cursor: "pointer",
                        border: "none",
                        background: "rgba(96,165,250,.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#60a5fa",
                      }}
                    >
                      <Video size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VIEWERS */}
        {tab === "viewers" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#383838",
                textTransform: "uppercase",
                letterSpacing: ".7px",
                marginBottom: 8,
              }}
            >
              Watching now · {fmtN(viewers)}
            </div>
            {(viewerList || []).length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "28px 0",
                  color: "#2a2a2a",
                  fontSize: 12,
                }}
              >
                No viewer data yet
              </div>
            ) : (
              (viewerList || []).map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(255,255,255,.04)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 12,
                      color: "#000",
                      flexShrink: 0,
                    }}
                  >
                    {(v.name || "?").replace("@", "").charAt(0).toUpperCase()}
                  </div>
                  <span
                    style={{ fontSize: 12, color: "#c4c4c4", fontWeight: 600 }}
                  >
                    {v.name}
                  </span>
                  {isHost && (
                    <div
                      style={{ marginLeft: "auto", display: "flex", gap: 3 }}
                    >
                      <button
                        onClick={() => inviteToStage(v, "audio")}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          cursor: "pointer",
                          border: "none",
                          background: "rgba(132,204,22,.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#84cc16",
                        }}
                      >
                        <Mic size={10} />
                      </button>
                      <button
                        onClick={() => inviteToStage(v, "video")}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          cursor: "pointer",
                          border: "none",
                          background: "rgba(96,165,250,.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#60a5fa",
                        }}
                      >
                        <Video size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* LIVE NOW */}
        {tab === "live" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#383838",
                textTransform: "uppercase",
                letterSpacing: ".7px",
                marginBottom: 10,
              }}
            >
              Live Right Now
            </div>
            {liveStreams.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "28px 0",
                  color: "#2a2a2a",
                  fontSize: 12,
                }}
              >
                No other streams right now
              </div>
            ) : (
              liveStreams.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 11,
                    marginBottom: 6,
                    cursor: "pointer",
                    background: "rgba(255,255,255,.025)",
                    border: "1px solid rgba(255,255,255,.06)",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,.045)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,.025)")
                  }
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      flexShrink: 0,
                      position: "relative",
                      background:
                        s.mode === "audio"
                          ? "linear-gradient(135deg,#a78bfa,#7c3aed)"
                          : "linear-gradient(135deg,#84cc16,#4d7c0f)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 15,
                      color: "#000",
                    }}
                  >
                    {(s.profiles?.full_name || "?").charAt(0).toUpperCase()}
                    <div
                      style={{
                        position: "absolute",
                        inset: -2,
                        borderRadius: "50%",
                        border: "2px solid #ef4444",
                        animation: "svLivePulse 2s ease-in-out infinite",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#525252", marginTop: 1 }}
                    >
                      {s.profiles?.username
                        ? `@${s.profiles.username}`
                        : "Unknown"}{" "}
                      · {s.category}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {s.mode === "audio" ? (
                      <Mic size={10} color="#a78bfa" />
                    ) : (
                      <Video size={10} color="#84cc16" />
                    )}
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#ef4444",
                        animation: "svLivePulse 1.4s ease-in-out infinite",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Desktop live shell ─────────────────────────────────────────────────────────
const DesktopLiveShell = ({ left, sidebarProps }) => {
  const containerRef = useRef(null);
  const [leftW, setLeftW] = useState(65);

  const onDrag = useCallback((clientX) => {
    if (!containerRef.current) return;
    const { left: cLeft, width } = containerRef.current.getBoundingClientRect();
    const pct = Math.round(((clientX - cLeft) / width) * 100);
    setLeftW(Math.max(40, Math.min(80, pct)));
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${leftW}%`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {left}
      </div>
      <DraggableDivider onDrag={onDrag} />
      <div
        style={{
          flex: 1,
          minWidth: 260,
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <DesktopSidebar {...sidebarProps} />
      </div>
    </div>
  );
};

// ── Main StreamView router ────────────────────────────────────────────────────
const StreamView = ({
  currentUser,
  userId,
  onClose,
  isSidebar = false,
  streamSession = null,
}) => {
  if (streamSession) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "#050505",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
          color: "#fff",
        }}
      >
        <style>{BASE_CSS}</style>
        <ViewerRoom
          session={streamSession}
          currentUser={currentUser}
          onClose={onClose}
        />
      </div>
    );
  }
  return (
    <div
      style={
        isSidebar
          ? {}
          : {
              position: "fixed",
              inset: 0,
              zIndex: 10001,
              background: "#050505",
              fontFamily:
                "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
              color: "#fff",
            }
      }
    >
      <style>{BASE_CSS}</style>
      <HostStreamView
        currentUser={currentUser}
        userId={userId}
        onClose={onClose}
        isSidebar={isSidebar}
      />
    </div>
  );
};

// ── Host stream view ── ORIGINAL DESIGN + additions ───────────────────────────
const HostStreamView = ({ currentUser, userId, onClose, isSidebar }) => {
  const isDesktop = useIsDesktop();
  const [mode, setMode] = useState("video");
  const [phase, setPhase] = useState("permission");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Tech ⚡");
  const [preset, setPreset] = useState("high");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showNet, setShowNet] = useState(false);
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [epEarned, setEpEarned] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peakVw, setPeakVw] = useState(0);
  const [totalTips, setTotalTips] = useState(0);
  const [signal, setSignal] = useState(4);

  const [stageParticipants, setStageParticipants] = useState([]);
  const [handRaisers, setHandRaisers] = useState([]);
  const [viewerList, setViewerList] = useState([]);
  const [showStageSearch, setShowStageSearch] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);

  const [previewStream, setPreviewStream] = useState(null);
  const [liveStream, setLiveStream] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);

  const durRef = useRef(null);
  const chatRef = useRef(null);
  const hbRef = useRef(null);
  const chRef = useRef(null);
  const sidRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const msgId = useRef(0);

  const pDef = PRESETS.find((p) => p.id === preset) || PRESETS[1];
  const isHost = true;
  const initials = (currentUser?.fullName || currentUser?.name || "U")
    .charAt(0)
    .toUpperCase();
  const myName = `@${currentUser?.username || currentUser?.fullName || "host"}`;
  const myColor = chatColor(userId || "host");

  useEffect(() => {
    sidRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const s = phase === "live" ? liveStream : previewStream;
    if (
      (phase === "preview" || phase === "live") &&
      s &&
      videoRef.current &&
      mode === "video"
    )
      videoRef.current.srcObject = s;
  }, [phase, liveStream, previewStream, mode]);

  useEffect(() => {
    if (phase === "live") {
      durRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else clearInterval(durRef.current);
    return () => clearInterval(durRef.current);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;
    const iv = setInterval(() => setEpEarned((e) => e + 2 / 60), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    const ping = () =>
      supabase
        .from("live_sessions")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("id", sessionId)
        .then(() => {})
        .catch(() => {});
    ping();
    hbRef.current = setInterval(ping, 30_000);
    return () => clearInterval(hbRef.current);
  }, [phase, sessionId]);

  useEffect(() => {
    if (phase !== "live" || !chRef.current) return;
    chRef.current
      .send({
        type: "broadcast",
        event: "stage_state",
        payload: {
          participants: [
            {
              id: userId,
              name: currentUser?.fullName || "Host",
              role: "host",
              onStage: true,
              micOn,
              camOn,
            },
            ...stageParticipants,
          ],
        },
      })
      .catch(() => {});
  }, [stageParticipants, micOn, camOn, phase]); // eslint-disable-line

  useEffect(() => {
    if (phase !== "live" || !streamRef.current || !micOn) return;
    let alive = true,
      rafId = null,
      lastId = null;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const an = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.6;
      ac.createMediaStreamSource(streamRef.current).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const check = () => {
        if (!alive) return;
        rafId = requestAnimationFrame(check);
        an.getByteFrequencyData(data);
        const rms = Math.sqrt(
          data.reduce((s, v) => s + v * v, 0) / data.length,
        );
        const id = rms > 12 ? userId : null;
        if (id !== lastId) {
          lastId = id;
          if (alive) setSpeakingId(id);
        }
      };
      check();
      return () => {
        alive = false;
        cancelAnimationFrame(rafId);
        ac.close().catch(() => {});
      };
    } catch {}
  }, [phase, micOn, userId]); // eslint-disable-line

  useEffect(
    () => () => {
      clearInterval(durRef.current);
      clearInterval(hbRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (previewStream) previewStream.getTracks().forEach((t) => t.stop());
      const sid = sidRef.current;
      if (sid)
        supabase
          .from("live_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", sid)
          .then(() => {})
          .catch(() => {});
      if (chRef.current) supabase.removeChannel(chRef.current);
    },
    [],
  ); // eslint-disable-line

  const toggleMic = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn((p) => !p);
  }, []);
  const toggleCam = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamOn((p) => !p);
  }, []);

  const inviteToStage = useCallback((viewer, type = "audio") => {
    if (!chRef.current) return;
    chRef.current.send({
      type: "broadcast",
      event: "stage_invite",
      payload: { targetId: viewer.id, type },
    });
    setMessages((p) => [
      ...p.slice(-199),
      {
        id: ++msgId.current,
        type: "system",
        text: `Invited ${viewer.name} to ${type === "video" ? "share camera" : "speak"}`,
      },
    ]);
  }, []);

  const removeFromStage = useCallback((p) => {
    if (!chRef.current) return;
    chRef.current.send({
      type: "broadcast",
      event: "stage_revoke",
      payload: { targetId: p.id },
    });
    setStageParticipants((prev) => prev.filter((x) => x.id !== p.id));
  }, []);
  const muteParticipant = useCallback((p) => {
    if (!chRef.current) return;
    chRef.current.send({
      type: "broadcast",
      event: "stage_mute",
      payload: { targetId: p.id },
    });
    setStageParticipants((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, micOn: false } : x)),
    );
  }, []);

  const allStage = useMemo(
    () => [
      {
        id: userId,
        name: currentUser?.fullName || "Host",
        role: "host",
        onStage: true,
        micOn,
        camOn,
        isSelf: true,
      },
      ...stageParticipants,
    ],
    [userId, currentUser, micOn, camOn, stageParticipants],
  );

  const handleGoLive = async () => {
    if (!title.trim()) return;
    setPhase("connecting");
    setConnectError(null);
    try {
      const roomName = `xeevia-${(userId || "u").slice(0, 8)}-${Date.now()}`;
      const { data: sd, error: se } = await supabase
        .from("live_sessions")
        .insert({
          user_id: userId,
          title,
          category,
          mode,
          quality_preset: preset,
          is_private: isPrivate,
          is_recording: isRecording,
          livekit_room: roomName,
          status: "pending",
        })
        .select()
        .single();
      if (se) throw new Error("Failed to create session: " + se.message);
      setSessionId(sd.id);

      let stream = streamRef.current;
      if (
        !stream ||
        stream.getTracks().every((t) => t.readyState === "ended")
      ) {
        stream = await getMediaStream(mode, preset);
        streamRef.current = stream;
      }
      setLiveStream(stream);

      let r = { livekitToken: null, livekitUrl: null };
      if (SDK_AVAILABLE)
        r = await fetchLiveKitToken({
          roomName,
          userId: userId || "host",
          userName: myName,
          isHost: true,
          canPublish: true,
        });

      await supabase
        .from("live_sessions")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", sd.id);

      const ch = supabase.channel(`stream:${sd.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: userId || "host" },
        },
      });
      ch.on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages((p) => [
          ...p.slice(-199),
          { id: ++msgId.current, ...payload },
        ]);
      });
      ch.on("broadcast", { event: "like" }, ({ payload }) => {
        setLikes((l) => l + 1);
        setEpEarned((e) => e + 0.1);
        setMessages((p) => [
          ...p.slice(-199),
          { id: ++msgId.current, type: "like", user: payload.user },
        ]);
      });
      ch.on("broadcast", { event: "hand_raise" }, ({ payload }) => {
        setHandRaisers((h) => [
          ...h.filter((x) => x.id !== payload.userId),
          { id: payload.userId, name: payload.user },
        ]);
        setMessages((p) => [
          ...p.slice(-199),
          {
            id: ++msgId.current,
            type: "system",
            text: `${payload.user} raised their hand ✋`,
          },
        ]);
      });
      ch.on("broadcast", { event: "hand_lower" }, ({ payload }) => {
        setHandRaisers((h) => h.filter((x) => x.id !== payload.userId));
      });
      ch.on("broadcast", { event: "viewer_joined_stage" }, ({ payload }) => {
        setStageParticipants((prev) => {
          if (prev.find((p) => p.id === payload.userId)) return prev;
          return [
            ...prev,
            {
              id: payload.userId,
              name: payload.user,
              role: payload.role || "co-speaker",
              onStage: true,
              micOn: true,
              camOn: true,
            },
          ];
        });
        setHandRaisers((h) => h.filter((x) => x.id !== payload.userId));
      });
      ch.on("broadcast", { event: "viewer_left_stage" }, ({ payload }) => {
        setStageParticipants((prev) =>
          prev.filter((p) => p.id !== payload.userId),
        );
      });
      ch.on("broadcast", { event: "stage_declined" }, ({ payload }) => {
        setMessages((p) => [
          ...p.slice(-199),
          {
            id: ++msgId.current,
            type: "system",
            text: `${payload.user} declined the stage invite`,
          },
        ]);
      });
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const count = Math.max(0, Object.keys(state).length - 1);
        setViewers(count);
        setPeakVw((p) => Math.max(p, count));
        setViewerList(
          Object.values(state)
            .flat()
            .filter((p) => p.role === "viewer")
            .map((p) => ({ id: p.userId, name: p.user })),
        );
      });
      await ch.subscribe(async (s) => {
        if (s === "SUBSCRIBED")
          await ch.track({ user: myName, userId, role: "host" });
      });
      chRef.current = ch;
      if (r.livekitToken) setLivekitToken(r.livekitToken);
      if (r.livekitUrl) setLivekitUrl(r.livekitUrl);
      setPhase("live");
    } catch (e) {
      console.error("Go live failed:", e);
      setConnectError(e.message);
      setPhase("setup");
    }
  };

  const handleEndStream = async () => {
    clearInterval(durRef.current);
    clearInterval(hbRef.current);
    if (chRef.current) {
      await chRef.current.send({
        type: "broadcast",
        event: "stream_ended",
        payload: {},
      });
      supabase.removeChannel(chRef.current);
      chRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const sid = sessionId;
    if (sid) {
      const mins = Math.max(1, Math.ceil(duration / 60));
      await supabase
        .from("live_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          peak_viewers: peakVw,
          total_likes: likes,
        })
        .eq("id", sid);
      await supabase.from("stream_usage_logs").insert({
        user_id: userId,
        session_id: sid,
        minutes_used: mins,
        was_recording: isRecording,
        peak_viewers: peakVw,
        ep_earned: Math.floor(epEarned),
      });
    }
    setPhase("ended");
  };

  const sendMsg = () => {
    if (!chatInput.trim() || !chRef.current) return;
    chRef.current.send({
      type: "broadcast",
      event: "chat",
      payload: {
        type: "chat",
        user: myName,
        text: chatInput.trim(),
        color: myColor,
        hostBadge: true,
      },
    });
    setChatInput("");
  };

  const FONT =
    "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#050505",
        fontFamily: FONT,
        color: "#fff",
        overflow: "hidden",
        ...(isSidebar
          ? { height: "100%", borderLeft: "1px solid rgba(132,204,22,.1)" }
          : { position: "fixed", inset: 0, zIndex: 10001 }),
      }}
    >
      <style>{BASE_CSS}</style>

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 14px",
          background: "rgba(5,5,5,.98)",
          backdropFilter: "blur(22px)",
          borderBottom: "1px solid rgba(132,204,22,.08)",
          flexShrink: 0,
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
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.08)",
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
        {phase === "permission" && (
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
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
                    mode === k ? "1px solid rgba(132,204,22,.22)" : "none",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  background:
                    mode === k ? "rgba(132,204,22,.12)" : "transparent",
                  color: mode === k ? "#84cc16" : "#525252",
                  fontFamily: FONT,
                }}
              >
                <Ic size={12} />
                {l}
              </button>
            ))}
          </div>
        )}
        {phase === "preview" && (
          <span style={{ fontSize: 11, color: "#525252", fontWeight: 700 }}>
            Camera Preview
          </span>
        )}
        {phase === "setup" && (
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
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
                    mode === k ? "1px solid rgba(132,204,22,.22)" : "none",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  background:
                    mode === k ? "rgba(132,204,22,.12)" : "transparent",
                  color: mode === k ? "#84cc16" : "#525252",
                  fontFamily: FONT,
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
                background: "rgba(239,68,68,.14)",
                border: "1px solid rgba(239,68,68,.28)",
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
            {handRaisers.length > 0 && (
              <button
                onClick={() => setTab("stage")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 7,
                  background: "rgba(251,191,36,.12)",
                  border: "1px solid rgba(251,191,36,.3)",
                  fontSize: 10,
                  fontWeight: 900,
                  color: "#fbbf24",
                  cursor: "pointer",
                  fontFamily: FONT,
                  animation: "svLivePulse 2s ease-in-out infinite",
                }}
              >
                ✋{handRaisers.length}
              </button>
            )}
          </div>
        )}
        {phase === "connecting" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid rgba(132,204,22,.2)",
                borderTopColor: "#84cc16",
                animation: "svSpin 1s linear infinite",
              }}
            />
            <span style={{ fontSize: 11, color: "#525252", fontWeight: 600 }}>
              Connecting…
            </span>
          </div>
        )}
      </div>

      {/* PERMISSION phase */}
      {phase === "permission" && (
        <PermissionGate
          mode={mode}
          onGranted={() => setPhase("preview")}
          onAudioOnly={() => {
            setMode("audio");
            setPhase("preview");
          }}
          onClose={onClose}
        />
      )}

      {/* PREVIEW phase */}
      {phase === "preview" && (
        <>
          <CameraPreview
            mode={mode}
            preset={preset}
            onStreamReady={(s) => {
              setPreviewStream(s);
              streamRef.current = s;
            }}
            onError={() => setPhase("permission")}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 14px",
              background: "rgba(0,0,0,.95)",
              flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,.05)",
            }}
          >
            {mode === "video" && (
              <button
                onClick={() => {
                  if (streamRef.current)
                    streamRef.current.getVideoTracks().forEach((t) => {
                      t.enabled = !t.enabled;
                    });
                  setCamOn((p) => !p);
                }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  cursor: "pointer",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: camOn
                    ? "rgba(255,255,255,.08)"
                    : "rgba(239,68,68,.09)",
                  color: camOn ? "#fff" : "#ef4444",
                }}
              >
                {camOn ? <Video size={15} /> : <VideoOff size={15} />}
              </button>
            )}
            <button
              onClick={() => {
                if (streamRef.current)
                  streamRef.current.getAudioTracks().forEach((t) => {
                    t.enabled = !t.enabled;
                  });
                setMicOn((p) => !p);
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                cursor: "pointer",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: micOn
                  ? "rgba(255,255,255,.08)"
                  : "rgba(239,68,68,.09)",
                color: micOn ? "#fff" : "#ef4444",
              }}
            >
              {micOn ? <Mic size={15} /> : <MicOff size={15} />}
            </button>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              style={{
                flex: 1,
                maxWidth: 180,
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 9,
                color: "#c4c4c4",
                fontSize: 11,
                padding: "6px 10px",
                fontFamily: FONT,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#111" }}>
                  {p.res} — {p.label}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "#080808",
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: "rgba(132,204,22,.08)",
                  border: "1px solid rgba(132,204,22,.15)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#84cc16",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#84cc16",
                    animation: "svLivePulse 1.4s ease-in-out infinite",
                  }}
                />
                {previewStream ? "Camera ready" : "Starting camera…"}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "#484848",
                  margin: 0,
                  lineHeight: 1.5,
                  maxWidth: 260,
                }}
              >
                This is what your viewers will see. Adjust quality above, then
                continue.
              </p>
            </div>
            <div style={{ padding: "0 16px 20px", flexShrink: 0 }}>
              <button
                onClick={() => setPhase("setup")}
                disabled={!previewStream}
                style={{
                  width: "100%",
                  padding: 13,
                  borderRadius: 12,
                  border: "none",
                  cursor: previewStream ? "pointer" : "not-allowed",
                  fontFamily: FONT,
                  background: previewStream
                    ? "linear-gradient(135deg,#84cc16,#4d7c0f)"
                    : "rgba(255,255,255,.05)",
                  color: previewStream ? "#000" : "#383838",
                  fontSize: 14,
                  fontWeight: 900,
                  boxShadow: previewStream
                    ? "0 5px 20px rgba(132,204,22,.32)"
                    : "none",
                }}
              >
                {previewStream ? "Set Up Stream →" : "Starting camera…"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* SETUP phase */}
      {phase === "setup" && (
        <div style={{ overflowY: "auto", padding: "20px 16px 90px", flex: 1 }}>
          {connectError && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                background: "rgba(239,68,68,.08)",
                border: "1px solid rgba(239,68,68,.2)",
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <AlertCircle
                size={16}
                color="#ef4444"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#ef4444",
                    marginBottom: 3,
                  }}
                >
                  Setup Required
                </div>
                <div
                  style={{ fontSize: 11, color: "#737373", lineHeight: 1.5 }}
                >
                  {connectError}
                </div>
              </div>
            </div>
          )}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                margin: "0 auto 16px",
                background:
                  mode === "video"
                    ? "linear-gradient(135deg,rgba(251,113,133,.18),rgba(225,29,72,.08))"
                    : "linear-gradient(135deg,rgba(167,139,250,.18),rgba(109,40,217,.08))",
                border: `1px solid ${mode === "video" ? "rgba(251,113,133,.28)" : "rgba(167,139,250,.28)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 11,
                color: "#fff",
                fontSize: 13,
                outline: "none",
                caretColor: "#84cc16",
                fontFamily: FONT,
                boxSizing: "border-box",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(132,204,22,.35)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,.08)")
              }
            />
          </div>
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
                        ? "rgba(132,204,22,.1)"
                        : "rgba(255,255,255,.03)",
                    border: `1px solid ${category === c ? "rgba(132,204,22,.28)" : "rgba(255,255,255,.07)"}`,
                    color: category === c ? "#84cc16" : "#444",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
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
                        : "rgba(255,255,255,.03)",
                    border: `1.5px solid ${preset === p.id ? p.color + "44" : "rgba(255,255,255,.07)"}`,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: FONT,
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
              Visibility
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 12px",
                borderRadius: 11,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.07)",
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
                    : "rgba(255,255,255,.1)",
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
                    boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                  }}
                />
              </div>
            </div>
          </div>
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
              Recording
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 12px",
                borderRadius: 11,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 800, color: "#c4c4c4" }}
                >
                  Save this stream
                </div>
                <div style={{ fontSize: 11, color: "#383838", marginTop: 2 }}>
                  Stored to Cloudflare · available after stream ends
                </div>
              </div>
              <div
                onClick={() => setIsRecording((r) => !r)}
                style={{
                  width: 42,
                  height: 24,
                  borderRadius: 12,
                  cursor: "pointer",
                  background: isRecording
                    ? "linear-gradient(135deg,#84cc16,#4d7c0f)"
                    : "rgba(255,255,255,.1)",
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
                    transform: isRecording ? "translateX(18px)" : "none",
                    boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                  }}
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleGoLive}
            disabled={!title.trim()}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 13,
              border: "none",
              background: title.trim()
                ? "linear-gradient(135deg,#84cc16,#4d7c0f)"
                : "rgba(255,255,255,.05)",
              color: title.trim() ? "#000" : "#383838",
              fontSize: 15,
              fontWeight: 900,
              cursor: title.trim() ? "pointer" : "not-allowed",
              boxShadow: title.trim()
                ? "0 6px 22px rgba(132,204,22,.38)"
                : "none",
              transition: "all .18s",
              fontFamily: FONT,
            }}
          >
            🔴 &nbsp;Go Live Now
          </button>
        </div>
      )}

      {/* CONNECTING phase */}
      {phase === "connecting" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: 32,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "3px solid rgba(132,204,22,.2)",
              borderTopColor: "#84cc16",
              animation: "svSpin 1s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#fff",
                margin: "0 0 6px",
              }}
            >
              Starting your stream…
            </p>
            <p style={{ fontSize: 13, color: "#525252", margin: 0 }}>
              Creating room and generating token
            </p>
          </div>
        </div>
      )}

      {/* LIVE phase */}
      {phase === "live" &&
        (() => {
          const videoColumn = (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
                position: "relative",
                minHeight: 0,
              }}
            >
              {allStage.length <= 1 ? (
                <div
                  style={{
                    height: "clamp(220px,38vw,380px)",
                    flexShrink: 0,
                    background: "#000",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {mode === "video" ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          background: "#000",
                          transform: "scaleX(-1)",
                        }}
                      />
                      {!camOn && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,.88)",
                            gap: 8,
                          }}
                        >
                          <VideoOff size={30} color="#383838" />
                          <span
                            style={{
                              color: "#383838",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            Camera Off
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 18,
                        padding: "24px 20px",
                        background: "#0a0a0a",
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
                          color: "#fff",
                          boxShadow: "0 0 0 10px rgba(167,139,250,.1)",
                        }}
                      >
                        🎙
                      </div>
                      <AudioBars
                        stream={liveStream}
                        active={micOn}
                        color="#a78bfa"
                      />
                      <span
                        style={{
                          color: "#a78bfa",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {micOn ? "● Broadcasting" : "Mic Muted"}
                      </span>
                    </div>
                  )}
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
                    <StatPill
                      Icon={Eye}
                      value={fmtN(viewers)}
                      color="#60a5fa"
                    />
                    <StatPill
                      Icon={Heart}
                      value={fmtN(likes)}
                      color="#f472b6"
                    />
                    <SignalBars strength={signal} />
                  </div>
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 9px",
                        borderRadius: 7,
                        background: "rgba(0,0,0,.65)",
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
                  </div>
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
                      background: "rgba(132,204,22,.18)",
                      border: "1px solid rgba(132,204,22,.3)",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#84cc16",
                    }}
                  >
                    <Zap size={10} />+{fmtN(Math.floor(epEarned))} EP
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      maxWidth: "55%",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "3px 9px",
                        background: "rgba(0,0,0,.72)",
                        backdropFilter: "blur(8px)",
                        borderRadius: 7,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {title}
                    </div>
                  </div>
                  {isHost && (
                    <>
                      <button
                        onClick={() => setShowStageSearch(true)}
                        style={{
                          position: "absolute",
                          bottom: 10,
                          left: "50%",
                          transform: "translateX(-50%)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 12px",
                          borderRadius: 20,
                          background: "rgba(132,204,22,.12)",
                          border: "1px solid rgba(132,204,22,.28)",
                          color: "#84cc16",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          fontFamily: FONT,
                        }}
                      >
                        <UserPlus size={12} /> Invite to stage
                      </button>
                      {showStageSearch && (
                        <StageSearchPanel
                          viewerList={viewerList}
                          handRaisers={handRaisers}
                          onInvite={(v, t) => {
                            inviteToStage(v, t);
                            setShowStageSearch(false);
                          }}
                          onClose={() => setShowStageSearch(false)}
                        />
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <StageGrid
                    stagePeople={allStage}
                    currentUserId={userId}
                    isHost={isHost}
                    mode={mode}
                    hostVideoRef={videoRef}
                    hostCamOn={camOn}
                    hostMicOn={micOn}
                    hostStream={liveStream}
                    onMute={muteParticipant}
                    onRemove={removeFromStage}
                    viewerList={viewerList}
                    handRaisers={handRaisers}
                    onInvite={inviteToStage}
                    speakingId={speakingId}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      alignItems: "flex-end",
                      pointerEvents: "none",
                    }}
                  >
                    <StatPill
                      Icon={Eye}
                      value={fmtN(viewers)}
                      color="#60a5fa"
                    />
                    <StatPill
                      Icon={Heart}
                      value={fmtN(likes)}
                      color="#f472b6"
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 7,
                      background: "rgba(132,204,22,.18)",
                      border: "1px solid rgba(132,204,22,.3)",
                      fontSize: 10,
                      fontWeight: 900,
                      color: "#84cc16",
                      pointerEvents: "none",
                    }}
                  >
                    <Zap size={9} />+{fmtN(Math.floor(epEarned))} EP
                  </div>
                </div>
              )}

              {/* Controls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "9px 12px",
                  background: "rgba(0,0,0,.94)",
                  borderTop: "1px solid rgba(255,255,255,.04)",
                  flexShrink: 0,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {[
                  mode === "video" && {
                    icon: camOn ? Video : VideoOff,
                    on: camOn,
                    fn: toggleCam,
                  },
                  { icon: micOn ? Mic : MicOff, on: micOn, fn: toggleMic },
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
                  {
                    icon: Share2,
                    on: true,
                    fn: () => {
                      const url = window.location.href;
                      if (navigator.share)
                        navigator.share({ title, url }).catch(() => {});
                      else navigator.clipboard?.writeText(url).catch(() => {});
                    },
                  },
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
                          ? "rgba(132,204,22,.1)"
                          : b.on
                            ? "rgba(255,255,255,.07)"
                            : "rgba(239,68,68,.1)",
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: b.hl
                          ? "rgba(132,204,22,.22)"
                          : b.on
                            ? "rgba(255,255,255,.1)"
                            : "rgba(239,68,68,.22)",
                        color: b.hl ? "#84cc16" : b.on ? "#fff" : "#ef4444",
                      }}
                    >
                      <b.icon size={16} />
                    </button>
                  ))}
                <button
                  onClick={handleEndStream}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    background: "rgba(239,68,68,.1)",
                    border: "1px solid rgba(239,68,68,.25)",
                    color: "#ef4444",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  End Stream
                </button>
              </div>

              {/* Chat tabs */}
              <div
                style={{
                  display: "flex",
                  padding: "5px 12px 0",
                  background: "rgba(0,0,0,.9)",
                  flexShrink: 0,
                  borderTop: "1px solid rgba(255,255,255,.04)",
                  gap: 4,
                }}
              >
                {[
                  ["chat", "💬 Chat"],
                  [
                    "stage",
                    `🎙 Stage${handRaisers.length > 0 ? ` (${handRaisers.length})` : ""}`,
                  ],
                  ["tips", "⚡ Tips"],
                  ["viewers", "👁 Viewers"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    style={{
                      flex: 1,
                      padding: "7px 4px",
                      borderRadius: 8,
                      border: "none",
                      fontSize: 9.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: FONT,
                      background:
                        tab === k ? "rgba(132,204,22,.1)" : "transparent",
                      color: tab === k ? "#84cc16" : "#383838",
                      textTransform: "uppercase",
                      letterSpacing: ".3px",
                      transition: "all .15s",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Tab panels */}
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
                      {messages.length === 0 && (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "24px 0",
                            color: "#2a2a2a",
                            fontSize: 12,
                          }}
                        >
                          Chat will appear here when viewers join 👀
                        </div>
                      )}
                      {messages.map((m) => {
                        if (m.type === "system")
                          return (
                            <div
                              key={m.id}
                              style={{
                                fontSize: 11,
                                color: "#525252",
                                fontStyle: "italic",
                                animation: "svUp .15s ease",
                              }}
                            >
                              ℹ {m.text}
                            </div>
                          );
                        if (m.type === "like")
                          return (
                            <div
                              key={m.id}
                              style={{
                                fontSize: 11,
                                color: "#f472b6",
                                animation: "svUp .15s ease",
                              }}
                            >
                              ❤️ {m.user}
                            </div>
                          );
                        if (m.type === "stage")
                          return (
                            <div
                              key={m.id}
                              style={{
                                fontSize: 11,
                                color: "#fbbf24",
                                animation: "svUp .15s ease",
                              }}
                            >
                              🎙 {m.text}
                            </div>
                          );
                        return (
                          <div
                            key={m.id}
                            style={{
                              fontSize: 12,
                              lineHeight: 1.45,
                              animation: "svUp .18s ease",
                            }}
                          >
                            {m.hostBadge && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 900,
                                  background: "rgba(132,204,22,.15)",
                                  color: "#84cc16",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  marginRight: 5,
                                }}
                              >
                                HOST
                              </span>
                            )}
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
                        );
                      })}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "7px 12px 10px",
                        borderTop: "1px solid rgba(255,255,255,.04)",
                        flexShrink: 0,
                      }}
                    >
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                        placeholder="Say something to your viewers…"
                        style={{
                          flex: 1,
                          background: "rgba(255,255,255,.04)",
                          border: "1px solid rgba(255,255,255,.08)",
                          borderRadius: 9,
                          padding: "8px 11px",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none",
                          caretColor: "#84cc16",
                          fontFamily: FONT,
                        }}
                      />
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

                {tab === "stage" && (
                  <div
                    style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}
                  >
                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: "#383838",
                          textTransform: "uppercase",
                          letterSpacing: ".7px",
                          marginBottom: 8,
                        }}
                      >
                        On Stage ({allStage.length}/9)
                      </div>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                      >
                        {allStage.map((p) => (
                          <StageCell
                            key={p.id}
                            p={p}
                            isSelf={p.id === userId}
                            isHost={p.role === "host"}
                            canControl={p.role !== "host"}
                            speaking={p.id === speakingId}
                            onMute={muteParticipant}
                            onRemove={removeFromStage}
                            stageH={96}
                            cols={4}
                          />
                        ))}
                      </div>
                    </div>
                    {handRaisers.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: "#fbbf24",
                            textTransform: "uppercase",
                            letterSpacing: ".7px",
                            marginBottom: 8,
                          }}
                        >
                          ✋ Raised Hands ({handRaisers.length})
                        </div>
                        {handRaisers.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "9px 12px",
                              borderRadius: 11,
                              marginBottom: 6,
                              background: "rgba(251,191,36,.04)",
                              border: "1px solid rgba(251,191,36,.14)",
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg,#84cc16,#4d7c0f)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 900,
                                fontSize: 14,
                                color: "#000",
                                flexShrink: 0,
                              }}
                            >
                              {(v.name || "?")
                                .replace("@", "")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#d4d4d4",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {v.name}
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => inviteToStage(v, "audio")}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "5px 9px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontFamily: FONT,
                                  background: "rgba(132,204,22,.1)",
                                  border: "1px solid rgba(132,204,22,.25)",
                                  color: "#84cc16",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <Mic size={11} />
                                Speak
                              </button>
                              <button
                                onClick={() => inviteToStage(v, "video")}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "5px 9px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontFamily: FONT,
                                  background: "rgba(96,165,250,.1)",
                                  border: "1px solid rgba(96,165,250,.25)",
                                  color: "#60a5fa",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                <Video size={11} />
                                Cam
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: "#383838",
                          textTransform: "uppercase",
                          letterSpacing: ".7px",
                          marginBottom: 8,
                        }}
                      >
                        Invite a Viewer
                      </div>
                      {viewerList.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "20px 0",
                            color: "#2a2a2a",
                            fontSize: 12,
                          }}
                        >
                          No viewers yet
                        </div>
                      ) : (
                        viewerList.slice(0, 20).map((v) => (
                          <div
                            key={v.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 11,
                              marginBottom: 5,
                              background: "rgba(255,255,255,.025)",
                              border: "1px solid rgba(255,255,255,.05)",
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg,#84cc16,#4d7c0f)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 900,
                                fontSize: 12,
                                color: "#000",
                                flexShrink: 0,
                              }}
                            >
                              {(v.name || "?")
                                .replace("@", "")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#d4d4d4",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {v.name}
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => inviteToStage(v, "audio")}
                                title="Speak"
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 7,
                                  cursor: "pointer",
                                  background: "rgba(132,204,22,.08)",
                                  border: "1px solid rgba(132,204,22,.18)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#84cc16",
                                }}
                              >
                                <Mic size={11} />
                              </button>
                              <button
                                onClick={() => inviteToStage(v, "video")}
                                title="Camera"
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 7,
                                  cursor: "pointer",
                                  background: "rgba(96,165,250,.08)",
                                  border: "1px solid rgba(96,165,250,.18)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#60a5fa",
                                }}
                              >
                                <Video size={11} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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
                      ["Total Tips", `⚡ ${fmtN(totalTips)} EP`, "#fbbf24"],
                      [
                        "Your Earnings (84%)",
                        `${fmtN(Math.floor(epEarned))} EP`,
                        "#84cc16",
                      ],
                      ["Viewers", fmtN(viewers), "#60a5fa"],
                      ["Peak Viewers", fmtN(peakVw), "#a78bfa"],
                      ["Duration", fmtDur(duration), "#c4c4c4"],
                    ].map(([l, v, c]) => (
                      <div
                        key={l}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 11,
                          background: "rgba(255,255,255,.025)",
                          border: "1px solid rgba(255,255,255,.055)",
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
                        <span
                          style={{ fontSize: 16, fontWeight: 900, color: c }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {tab === "viewers" && (
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "16px 12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Users size={32} color="#2a2a2a" />
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: "#84cc16",
                      }}
                    >
                      {fmtN(viewers)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#525252",
                        fontWeight: 600,
                      }}
                    >
                      watching right now
                    </span>
                    <span style={{ fontSize: 10, color: "#333" }}>
                      Peak: {fmtN(peakVw)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );

          if (isDesktop && !isSidebar) {
            return (
              <DesktopLiveShell
                left={videoColumn}
                sidebarProps={{
                  viewers,
                  likes,
                  epEarned,
                  duration,
                  peakVw,
                  signal,
                  messages,
                  chatInput,
                  setChatInput,
                  onSendMsg: sendMsg,
                  chatRef,
                  tab,
                  setTab,
                  handRaisers,
                  stageParticipants,
                  allStage,
                  viewerList,
                  inviteToStage,
                  muteParticipant,
                  removeFromStage,
                  speakingId,
                  userId,
                  StageCell,
                  FONT,
                  fmtN,
                  fmtDur,
                  isHost: true,
                  mode,
                }}
              />
            );
          }
          return videoColumn;
        })()}

      {/* ENDED phase */}
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
              setPhase("permission");
              setTitle("");
              setDuration(0);
              setLikes(0);
              setEpEarned(0);
              setTotalTips(0);
              setMessages([]);
              setSessionId(null);
              setLivekitToken(null);
              setLivekitUrl(null);
              setPeakVw(0);
              setPreviewStream(null);
              setLiveStream(null);
              setStageParticipants([]);
              streamRef.current = null;
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
              boxShadow: "0 5px 18px rgba(132,204,22,.36)",
              fontFamily: FONT,
            }}
          >
            Start New Stream
          </button>
          <button
            onClick={onClose}
            style={{
              marginTop: 12,
              padding: "10px 24px",
              borderRadius: 12,
              background: "transparent",
              border: "1px solid rgba(255,255,255,.08)",
              color: "#525252",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Back to feed
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamView;