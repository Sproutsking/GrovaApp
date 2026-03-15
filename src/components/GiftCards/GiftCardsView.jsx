// src/components/GiftCards/GiftCardsView.jsx
// Xeevia Gift Cards — Burst-Box experience
// Buy → Configure → Confirm → Burst open → Message revealed
// 2% protocol fee on ALL transactions: buy, send, redeem
// 6 gem tiers · Real Supabase integration ready

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Copy,
  CheckCircle,
  Zap,
  Search,
  Send,
  Gift,
  Crown,
  Gem,
  Flame,
  Star,
  Sparkles,
  Wallet,
  RotateCcw,
  ArrowLeft,
  Package,
  ChevronRight,
  Plus,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import ProfilePreview from "../Shared/ProfilePreview";

// ── Constants ─────────────────────────────────────────────────────────────────
const FEE = 0.02;
const GCODE = () => {
  const s = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GC-${s()}-${s()}-XEEVIA`;
};

// ── Gem Tiers ─────────────────────────────────────────────────────────────────
const TIERS = [
  {
    id: "silver",
    name: "Silver",
    value: 100,
    price: 1,
    c1: "#e2e8f0",
    c2: "#94a3b8",
    glow: "rgba(226,232,240,0.22)",
    Icon: Star,
    badge: "Starter",
    desc: "100 EP — A spark of appreciation.",
  },
  {
    id: "gold",
    name: "Gold",
    value: 500,
    price: 5,
    c1: "#fbbf24",
    c2: "#d97706",
    glow: "rgba(251,191,36,0.28)",
    Icon: Crown,
    badge: "Popular",
    desc: "500 EP — A crown of gold for a king.",
  },
  {
    id: "blue_diamond",
    name: "Blue Diamond",
    value: 1500,
    price: 15,
    c1: "#38bdf8",
    c2: "#0284c7",
    glow: "rgba(56,189,248,0.28)",
    Icon: Gem,
    badge: "Best Value",
    desc: "1,500 EP + Blue Diamond badge for 7 days.",
  },
  {
    id: "red_diamond",
    name: "Red Diamond",
    value: 3000,
    price: 28,
    c1: "#f87171",
    c2: "#dc2626",
    glow: "rgba(248,113,113,0.28)",
    Icon: Flame,
    badge: "Fierce",
    desc: "3,000 EP + Red aura for 14 days.",
  },
  {
    id: "black_diamond",
    name: "Black Diamond",
    value: 6000,
    price: 55,
    c1: "#d4d4d8",
    c2: "#6b7280",
    glow: "rgba(212,212,216,0.22)",
    Icon: Sparkles,
    badge: "Rare",
    desc: "6,000 EP + Black Diamond status for 30 days.",
  },
  {
    id: "purple_diamond",
    name: "Purple Diamond",
    value: 12000,
    price: 100,
    c1: "#c084fc",
    c2: "#7c3aed",
    glow: "rgba(192,132,252,0.32)",
    Icon: Gem,
    badge: "Legendary",
    desc: "12,000 EP + Whale status for 60 days.",
  },
];

const OCCASIONS = [
  "Birthday 🎂",
  "Thank You 🙏",
  "Congrats 🎉",
  "Just Because 💚",
  "Big Love ❤️",
  "Apology 😅",
  "Well Done 🌟",
  "Good Luck 🍀",
  "Milestone 🏆",
  "Welcome 👋",
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes gcReveal  { from{opacity:0;transform:scale(.88) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes gcPop     { 0%{transform:scale(.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
  @keyframes gcShimmer { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
  @keyframes gcBounce  { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-7px) rotate(2deg)} }
  @keyframes gcShake   { 0%{transform:rotate(0)} 18%{transform:rotate(-8deg) scale(1.05)} 36%{transform:rotate(8deg) scale(1.05)} 54%{transform:rotate(-4deg)} 72%{transform:rotate(4deg)} 90%{transform:rotate(-1deg)} 100%{transform:rotate(0) scale(1)} }
  @keyframes gcLidFly  { from{transform:rotateX(0) translateY(0)} to{transform:rotateX(-70deg) translateY(-30px) scale(1.1);opacity:0} }
  @keyframes gcExplode { from{opacity:1;transform:translate(0,0) rotate(0deg) scale(1)} to{opacity:0;transform:translate(var(--px),var(--py)) rotate(var(--pr)) scale(0)} }
  @keyframes gcToast   { 0%{opacity:0;transform:translateX(-50%) translateY(10px)} 15%,80%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0} }
  @keyframes gcSpin    { to{transform:rotate(360deg)} }
  @keyframes gcCardIn  { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes gcSuccess { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes gcPulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
  @keyframes gcFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
`;

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, color }) => (
  <div
    style={{
      position: "fixed",
      bottom: 96,
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 22px",
      borderRadius: 14,
      background: `linear-gradient(135deg,${color},${color}bb)`,
      color: "#000",
      fontSize: 12,
      fontWeight: 900,
      zIndex: 99999,
      pointerEvents: "none",
      whiteSpace: "nowrap",
      boxShadow: `0 6px 26px ${color}55`,
      animation: "gcToast 2.8s ease forwards",
    }}
  >
    {msg}
  </div>
);

// ── Gift Card Visual ──────────────────────────────────────────────────────────
const CardFace = ({
  tier,
  message,
  occasion,
  senderName,
  recipientName,
  code,
  compact,
}) => (
  <div
    style={{
      borderRadius: compact ? 14 : 20,
      overflow: "hidden",
      position: "relative",
      background: `linear-gradient(145deg,${tier.c1}18 0%,${tier.c2}0a 60%,transparent 100%)`,
      border: `1.5px solid ${tier.c1}40`,
      padding: compact ? "14px 14px" : "22px 20px",
      boxShadow: `0 16px 48px ${tier.glow},0 2px 0 ${tier.c1}15 inset`,
      animation: "gcReveal .5s cubic-bezier(.34,1.56,.64,1)",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "40%",
        height: "100%",
        background:
          "linear-gradient(45deg,transparent,rgba(255,255,255,0.06),transparent)",
        animation: "gcShimmer 4s ease-in-out infinite",
        pointerEvents: "none",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: `linear-gradient(90deg,transparent,${tier.c1}60,transparent)`,
        pointerEvents: "none",
      }}
    />

    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: compact ? 10 : 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 900,
            color: tier.c1,
            textTransform: "uppercase",
            letterSpacing: "2.5px",
            marginBottom: 4,
            opacity: 0.7,
          }}
        >
          XEEVIA GIFT CARD
        </div>
        <div
          style={{
            fontSize: compact ? 18 : 24,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-0.3px",
          }}
        >
          {tier.name}
        </div>
      </div>
      <div
        style={{
          width: compact ? 40 : 52,
          height: compact ? 40 : 52,
          borderRadius: compact ? 12 : 15,
          background: `${tier.c1}15`,
          border: `1.5px solid ${tier.c1}35`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 6px 20px ${tier.glow}`,
        }}
      >
        <tier.Icon size={compact ? 18 : 24} color={tier.c1} />
      </div>
    </div>
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "5px 11px" : "7px 14px",
        borderRadius: 10,
        background: `${tier.c1}12`,
        border: `1px solid ${tier.c1}25`,
        marginBottom: compact ? 9 : 14,
      }}
    >
      <Zap size={compact ? 10 : 13} color={tier.c1} />
      <span
        style={{ fontSize: compact ? 16 : 22, fontWeight: 900, color: tier.c1 }}
      >
        {tier.value.toLocaleString()} EP
      </span>
    </div>
    {message && (
      <div
        style={{
          fontSize: compact ? 11 : 13,
          color: "rgba(255,255,255,0.5)",
          fontStyle: "italic",
          lineHeight: 1.65,
          padding: compact ? "8px 10px" : "10px 13px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          borderLeft: `2px solid ${tier.c1}45`,
          marginBottom: compact ? 9 : 14,
        }}
      >
        "{message}"
      </div>
    )}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <div>
        {senderName && (
          <div style={{ fontSize: 10, color: "#3a3a3a" }}>
            From <span style={{ color: "#606060" }}>{senderName}</span>
          </div>
        )}
        {recipientName && (
          <div style={{ fontSize: 10, color: "#3a3a3a" }}>
            To <span style={{ color: "#888" }}>{recipientName}</span>
          </div>
        )}
        {occasion && (
          <div
            style={{
              fontSize: 10,
              color: tier.c1,
              marginTop: 3,
              fontWeight: 700,
            }}
          >
            {occasion}
          </div>
        )}
      </div>
      {code && (
        <div
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: "#252525",
            fontFamily: "monospace",
            letterSpacing: ".4px",
            background: "rgba(0,0,0,0.5)",
            padding: "4px 9px",
            borderRadius: 6,
          }}
        >
          {code}
        </div>
      )}
    </div>
  </div>
);

// ── Burst Box ─────────────────────────────────────────────────────────────────
const BurstBox = ({ tier, onOpened }) => {
  const [phase, setPhase] = useState("idle");
  const [particles, setParticles] = useState([]);

  const handleTap = () => {
    if (phase !== "idle") return;
    setPhase("shaking");
    setTimeout(() => {
      setPhase("explode");
      setParticles(
        Array.from({ length: 32 }, (_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 320,
          y: -(Math.random() * 240 + 50),
          rot: Math.random() * 720 - 360,
          size: Math.random() * 11 + 4,
          color: [tier.c1, tier.c2, "#fff", "#fbbf24", "#fff", tier.c1][
            Math.floor(Math.random() * 6)
          ],
          delay: i * 0.015,
          round: Math.random() > 0.45,
        })),
      );
      setTimeout(() => {
        setPhase("done");
        onOpened?.();
      }, 700);
    }, 600);
  };

  if (phase === "done") return null;

  return (
    <div
      style={{
        textAlign: "center",
        padding: "28px 0 20px",
        position: "relative",
        userSelect: "none",
      }}
    >
      {phase === "explode" &&
        particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.round ? "50%" : "3px",
              "--px": `${p.x}px`,
              "--py": `${p.y}px`,
              "--pr": `${p.rot}deg`,
              animation: `gcExplode .85s cubic-bezier(.22,1,.36,1) ${p.delay}s both`,
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        ))}

      <div
        onClick={handleTap}
        style={{
          display: "inline-block",
          cursor: phase === "idle" ? "pointer" : "default",
          position: "relative",
          animation:
            phase === "idle"
              ? "gcBounce 2.4s ease-in-out infinite"
              : phase === "shaking"
                ? "gcShake .6s ease"
                : "none",
        }}
      >
        {/* Lid */}
        <div
          style={{
            position: "absolute",
            top: -4,
            left: -10,
            right: -10,
            height: 34,
            background: `linear-gradient(135deg,${tier.c1},${tier.c2})`,
            borderRadius: "12px 12px 0 0",
            boxShadow: `0 -4px 18px ${tier.glow},0 1px 0 rgba(255,255,255,0.2) inset`,
            transformOrigin: "center top",
            animation:
              phase === "explode"
                ? "gcLidFly .4s cubic-bezier(.22,1,.36,1) forwards"
                : "none",
            zIndex: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 16,
              height: "100%",
              background: "rgba(255,255,255,0.2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            🎀
          </div>
        </div>
        {/* Box */}
        <div
          style={{
            width: 116,
            height: 100,
            borderRadius: "0 0 16px 16px",
            marginTop: 30,
            background: `linear-gradient(160deg,${tier.c1}1a,${tier.c2}0e)`,
            border: `2px solid ${tier.c1}45`,
            borderTop: "none",
            boxShadow: `0 16px 40px ${tier.glow},0 1px 0 rgba(255,255,255,0.04) inset`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 16,
              background: tier.c1,
              opacity: 0.18,
            }}
          />
          <tier.Icon
            size={38}
            color={tier.c1}
            style={{
              filter: `drop-shadow(0 0 12px ${tier.glow})`,
              position: "relative",
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "45%",
              background:
                "linear-gradient(180deg,rgba(255,255,255,0.06),transparent)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {phase === "idle" && (
        <div
          style={{
            marginTop: 18,
            fontSize: 12,
            color: "#3a3a3a",
            fontWeight: 700,
          }}
        >
          👆 Tap to burst open
        </div>
      )}
    </div>
  );
};

// ── Inbox Gift Card ───────────────────────────────────────────────────────────
const InboxCard = ({ card, onClaim }) => {
  const [phase, setPhase] = useState("sealed");
  const tier = TIERS.find((t) => t.id === card.tier) || TIERS[0];
  const net = tier.value - Math.round(tier.value * FEE);

  const open = () => {
    if (phase !== "sealed") return;
    setPhase("shaking");
    setTimeout(() => setPhase("revealed"), 700);
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 11,
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
        animation: "gcCardIn .35s ease both",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: `${tier.c1}16`,
            border: `1px solid ${tier.c1}28`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <tier.Icon size={15} color={tier.c1} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d4" }}>
            From{" "}
            <span style={{ color: tier.c1 }}>
              @{card.senderUsername || "someone"}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#404040" }}>
            {card.occasion || "A special gift"}
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: tier.c1 }}>
          {tier.value.toLocaleString()} EP
        </div>
      </div>
      <div style={{ padding: "10px 14px 14px" }}>
        {phase === "sealed" && (
          <div
            onClick={open}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              cursor: "pointer",
              borderRadius: 14,
              background: `${tier.c1}07`,
              border: `1.5px dashed ${tier.c1}25`,
              transition: "all .2s",
            }}
          >
            <div
              style={{
                fontSize: 52,
                animation: "gcFloat 2.2s ease-in-out infinite",
                marginBottom: 8,
              }}
            >
              🎁
            </div>
            <div style={{ fontSize: 12, color: "#505050", fontWeight: 700 }}>
              Tap to burst open your gift
            </div>
          </div>
        )}
        {phase === "shaking" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "24px",
              gap: 10,
            }}
          >
            <div
              style={{ fontSize: 52, animation: "gcShake .5s ease infinite" }}
            >
              📦
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#444",
                animation: "gcPulse .6s ease infinite",
              }}
            >
              Opening…
            </div>
          </div>
        )}
        {(phase === "revealed" || phase === "claimed") && (
          <div
            style={{ animation: "gcReveal .5s cubic-bezier(.34,1.56,.64,1)" }}
          >
            <CardFace
              tier={tier}
              message={card.message}
              occasion={card.occasion}
              senderName={`@${card.senderUsername || "someone"}`}
              compact
            />
            <div style={{ marginTop: 10 }}>
              {phase === "revealed" && (
                <button
                  onClick={() => {
                    setPhase("claimed");
                    onClaim?.(card);
                  }}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 12,
                    border: "none",
                    background: `linear-gradient(135deg,${tier.c1},${tier.c2})`,
                    color: "#000",
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: `0 6px 20px ${tier.glow}`,
                    fontFamily: "inherit",
                  }}
                >
                  <Zap size={14} /> Claim {net.toLocaleString()} EP
                  <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 600 }}>
                    (−2% fee)
                  </span>
                </button>
              )}
              {phase === "claimed" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "12px",
                    borderRadius: 11,
                    background: "rgba(34,197,94,0.07)",
                    border: "1px solid rgba(34,197,94,0.18)",
                  }}
                >
                  <CheckCircle size={15} color="#22c55e" />
                  <span
                    style={{ fontSize: 12, color: "#22c55e", fontWeight: 800 }}
                  >
                    {net.toLocaleString()} EP Claimed! ✨
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── User Search ───────────────────────────────────────────────────────────────
const UserSearch = ({ onSelect, selected, currentUser }) => {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  const db = useRef(null);

  const search = async (v) => {
    if (!v.trim()) {
      setRes([]);
      return;
    }
    setBusy(true);
    try {
      const clean = v.replace(/^@/, "");
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_id,verified")
        .or(`username.ilike.%${clean}%,full_name.ilike.%${clean}%`)
        .neq("id", currentUser?.id)
        .limit(6);
      setRes(data || []);
    } catch {
      setRes([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#3a3a3a",
          textTransform: "uppercase",
          letterSpacing: "1px",
          display: "block",
          marginBottom: 8,
        }}
      >
        Send To
      </label>
      <div style={{ position: "relative" }}>
        <Search
          size={13}
          color="#404040"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            clearTimeout(db.current);
            db.current = setTimeout(() => search(e.target.value), 280);
          }}
          placeholder="@username or name…"
          style={{
            width: "100%",
            padding: "11px 12px 11px 36px",
            background: selected
              ? "rgba(132,204,22,0.04)"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${selected ? "rgba(132,204,22,0.3)" : "rgba(255,255,255,0.09)"}`,
            borderRadius: 12,
            color: "#fff",
            fontSize: 13,
            outline: "none",
            caretColor: "#84cc16",
            fontFamily: "inherit",
            transition: "border .2s",
            boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
          }}
        />
        {busy && (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              border: "2px solid rgba(132,204,22,0.15)",
              borderTopColor: "#84cc16",
              borderRadius: "50%",
              animation: "gcSpin .7s linear infinite",
            }}
          />
        )}
      </div>
      {res.length > 0 && (
        <div
          style={{
            background: "rgba(10,10,10,0.99)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 13,
            overflow: "hidden",
            marginTop: 5,
            boxShadow: "0 12px 36px rgba(0,0,0,0.8)",
            backdropFilter: "blur(20px)",
          }}
        >
          {res.map((u, i) => {
            const pd = {
              userId: u.id,
              author: u.full_name || u.username,
              username: u.username,
              profiles: { avatar_id: u.avatar_id },
              verified: u.verified,
            };
            return (
              <div
                key={u.id}
                onClick={() => {
                  onSelect(u);
                  setQ(`@${u.username}`);
                  setRes([]);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 13px",
                  cursor: "pointer",
                  borderBottom:
                    i < res.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                  transition: "background .12s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <ProfilePreview
                  profile={pd}
                  currentUser={currentUser}
                  size="small"
                  showUsername
                />
              </div>
            );
          })}
        </div>
      )}
      {selected && !res.length && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 13px",
            marginTop: 5,
            background: "rgba(132,204,22,0.05)",
            border: "1px solid rgba(132,204,22,0.16)",
            borderRadius: 11,
          }}
        >
          <CheckCircle size={13} color="#84cc16" />
          <span
            style={{ fontSize: 12, color: "#84cc16", fontWeight: 700, flex: 1 }}
          >
            Sending to @{selected.username}
          </span>
          <button
            onClick={() => {
              onSelect(null);
              setQ("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#3a3a3a",
              cursor: "pointer",
              padding: 2,
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
const GiftCardsView = ({ currentUser, onClose, isSidebar = false }) => {
  const [tab, setTab] = useState("send");
  const [phase, setPhase] = useState("browse");
  const [selId, setSelId] = useState(null);
  const [occasion, setOccasion] = useState("");
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [redCode, setRedCode] = useState("");
  const [redState, setRedState] = useState("idle");
  const [myCards, setMyCards] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genCode, setGenCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [burstDone, setBurstDone] = useState(false);

  const tier = TIERS.find((t) => t.id === selId);
  const fee = tier ? Math.round(tier.value * FEE) : 0;
  const net = tier ? tier.value - fee : 0;

  const flash = useCallback((msg, color = "#84cc16") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    setMyCards([
      {
        code: "GC-X4K2-9M7R-XEEVIA",
        tier: "gold",
        status: "unused",
        value: 500,
      },
      {
        code: "GC-B3Z9-8N5P-XEEVIA",
        tier: "blue_diamond",
        status: "sent",
        value: 1500,
      },
    ]);
    setInbox([
      {
        code: "GC-DEMO-0001-XEEVIA",
        tier: "gold",
        status: "received",
        value: 500,
        senderUsername: "sproutsking",
        occasion: "Well Done 🌟",
        message: "You built something real. Keep going. The world needs this.",
      },
    ]);
  }, []);

  const reset = () => {
    setPhase("browse");
    setSelId(null);
    setOccasion("");
    setMessage("");
    setRecipient(null);
    setGenCode("");
    setBurstDone(false);
  };

  const handleBuy = async () => {
    if (!tier) return;
    if (phase === "browse") {
      setPhase("configure");
      return;
    }
    if (phase === "configure") {
      if (!recipient) {
        flash("Select a recipient first", "#f97316");
        return;
      }
      setPhase("confirm");
      setBurstDone(false);
      return;
    }
    if (phase === "confirm") {
      setLoading(true);
      try {
        const code = GCODE();
        // Production: await supabase.from("gift_cards").insert({ code, tier:tier.id, value:tier.value, price:tier.price, fee_ep:fee, net_ep:net, sender_id:currentUser?.id, recipient_id:recipient.id, message, occasion, status:"sent", created_at:new Date().toISOString() });
        await new Promise((r) => setTimeout(r, 900));
        setGenCode(code);
        setPhase("success");
        flash(`${tier.name} sent to @${recipient.username}! 🎁`, tier.c1);
      } catch {
        flash("Something went wrong. Try again.", "#f87171");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRedeem = async () => {
    if (!redCode.trim()) return;
    setRedState("loading");
    try {
      await new Promise((r) => setTimeout(r, 1400));
      // Production: query gift_cards, verify unused, credit (value - fee) to ep_balance
      const valid = redCode.trim().toUpperCase().startsWith("GC-");
      setRedState(valid ? "success" : "error");
      if (valid) flash("EP Claimed! Balance updated. 🎉", "#22c55e");
    } catch {
      setRedState("error");
    }
  };

  const claimInbox = (card) => {
    const t = TIERS.find((x) => x.id === card.tier);
    if (t)
      flash(
        `+${t.value - Math.round(t.value * FEE)} EP claimed (−2% fee)! 🎉`,
        t.c1,
      );
    setInbox((p) =>
      p.map((c) => (c.code === card.code ? { ...c, status: "claimed" } : c)),
    );
  };

  const newInbox = inbox.filter((c) => c.status === "received").length;

  const titleMap = {
    send:
      phase === "browse"
        ? "Gift Cards"
        : phase === "configure"
          ? tier?.name || "Configure"
          : phase === "confirm"
            ? "Confirm"
            : "Gift Sent! 🎁",
    redeem: "Redeem Card",
    inbox: "Gift Inbox",
    my_cards: "My Cards",
  };

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
          ? { height: "100%", borderLeft: "1px solid rgba(255,255,255,0.06)" }
          : { position: "fixed", inset: 0, zIndex: 9500 }),
      }}
    >
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "14px 16px 10px",
          background: "rgba(5,5,5,0.96)",
          backdropFilter: "blur(28px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          boxShadow: "0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {phase !== "browse" && tab === "send" ? (
          <button
            onClick={reset}
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#707070",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={15} />
          </button>
        ) : (
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#707070",
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.4px",
            }}
          >
            {titleMap[tab]}
          </div>
          <div style={{ fontSize: 10, color: "#2e2e2e", marginTop: 1 }}>
            Precious gems for precious people
          </div>
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: "rgba(56,189,248,0.1)",
            border: "1px solid rgba(56,189,248,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Gift size={16} color="#38bdf8" />
        </div>
      </div>

      {/* ── TABS ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 16px",
          flexShrink: 0,
          background: "rgba(5,5,5,0.7)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {[
          { k: "send", l: "Send" },
          { k: "redeem", l: "Redeem" },
          {
            k: "inbox",
            l: newInbox > 0 ? `Inbox ${newInbox}` : "Inbox",
            dot: newInbox > 0,
          },
          { k: "my_cards", l: "Cards" },
        ].map(({ k, l, dot }) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                if (k !== "send") reset();
              }}
              style={{
                padding: "6px 15px",
                borderRadius: 100,
                position: "relative",
                border: `1px solid ${active ? "rgba(56,189,248,0.36)" : "rgba(255,255,255,0.07)"}`,
                background: active
                  ? "rgba(56,189,248,0.12)"
                  : "rgba(255,255,255,0.025)",
                color: active ? "#38bdf8" : "#484848",
                boxShadow: active ? "0 2px 14px rgba(56,189,248,0.28)" : "none",
                fontSize: 11,
                fontWeight: active ? 800 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all .18s",
                fontFamily: "inherit",
              }}
            >
              {l}
              {dot && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 5,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#f87171",
                    animation: "gcPulse 1.5s ease infinite",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 100px" }}>
        {/* ════════ SEND TAB ════════ */}
        {tab === "send" && (
          <>
            {phase === "browse" && (
              <>
                <p
                  style={{
                    fontSize: 11,
                    color: "#383838",
                    margin: "4px 0 14px",
                    lineHeight: 1.7,
                  }}
                >
                  Choose a gem tier. Cards arrive as sealed gift boxes —
                  recipient bursts them open to reveal your message.
                </p>
                {TIERS.map((t, i) => {
                  const sel = selId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelId(sel ? null : t.id)}
                      style={{
                        borderRadius: 16,
                        marginBottom: 9,
                        cursor: "pointer",
                        border: `1.5px solid ${sel ? t.c1 + "55" : "rgba(255,255,255,0.06)"}`,
                        background: sel
                          ? `${t.c1}08`
                          : "rgba(255,255,255,0.018)",
                        boxShadow: sel
                          ? `0 8px 28px ${t.glow},0 1px 0 ${t.c1}10 inset`
                          : "0 1px 0 rgba(255,255,255,0.03) inset",
                        transition: "all .22s",
                        position: "relative",
                        overflow: "hidden",
                        animation: `gcCardIn .3s ease ${i * 0.05}s both`,
                        transform: sel ? "translateY(-2px)" : "none",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 1,
                          background: `linear-gradient(90deg,transparent,${sel ? t.c1 + "40" : "rgba(255,255,255,0.04)"},transparent)`,
                          pointerEvents: "none",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 13,
                          padding: "13px 14px",
                        }}
                      >
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 15,
                            flexShrink: 0,
                            background: `linear-gradient(135deg,${t.c1}1e,${t.c2}0c)`,
                            border: `1.5px solid ${t.c1}38`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: sel ? `0 0 22px ${t.glow}` : "none",
                            transition: "box-shadow .2s",
                          }}
                        >
                          <t.Icon size={23} color={t.c1} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: "#fff",
                              }}
                            >
                              {t.name}
                            </span>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: `${t.c1}16`,
                                color: t.c1,
                                border: `1px solid ${t.c1}28`,
                                fontSize: 9,
                                fontWeight: 800,
                              }}
                            >
                              {t.badge}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#383838",
                              marginBottom: 6,
                              lineHeight: 1.4,
                            }}
                          >
                            {t.desc}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 15,
                                fontWeight: 900,
                                color: t.c1,
                              }}
                            >
                              ${t.price}
                            </span>
                            <span style={{ color: "#282828" }}>·</span>
                            <Zap size={9} color="#484848" />
                            <span
                              style={{
                                fontSize: 11,
                                color: "#484848",
                                fontWeight: 700,
                              }}
                            >
                              {t.value.toLocaleString()} EP
                            </span>
                            <span style={{ fontSize: 9, color: "#252525" }}>
                              · 2% fee
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 7,
                            border: `1.5px solid ${sel ? t.c1 : "rgba(255,255,255,0.06)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: sel ? `${t.c1}18` : "transparent",
                            transition: "all .18s",
                            flexShrink: 0,
                          }}
                        >
                          {sel && (
                            <CheckCircle
                              size={14}
                              color={t.c1}
                              style={{ animation: "gcPop .25s ease" }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={handleBuy}
                  disabled={!selId}
                  style={{
                    width: "100%",
                    padding: "14px",
                    marginTop: 8,
                    borderRadius: 14,
                    border: "none",
                    background: selId
                      ? `linear-gradient(135deg,${tier?.c1},${tier?.c2})`
                      : "rgba(255,255,255,0.05)",
                    color: selId ? "#000" : "#303030",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: selId ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: selId ? `0 8px 26px ${tier?.glow}` : "none",
                    transition: "all .18s",
                    fontFamily: "inherit",
                  }}
                >
                  <Send size={14} /> Continue
                </button>
              </>
            )}

            {phase === "configure" && tier && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: "13px 14px",
                    background: `${tier.c1}07`,
                    border: `1px solid ${tier.c1}22`,
                    borderRadius: 15,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      background: `${tier.c1}16`,
                      border: `1px solid ${tier.c1}28`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <tier.Icon size={21} color={tier.c1} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}
                    >
                      {tier.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#444" }}>
                      {tier.value.toLocaleString()} EP · ${tier.price}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{ fontSize: 9, color: "#333", marginBottom: 2 }}
                    >
                      They receive
                    </div>
                    <div
                      style={{ fontSize: 14, fontWeight: 900, color: tier.c1 }}
                    >
                      {net.toLocaleString()} EP
                    </div>
                    <div style={{ fontSize: 9, color: "#2a2a2a" }}>−2% fee</div>
                  </div>
                </div>

                <UserSearch
                  onSelect={setRecipient}
                  selected={recipient}
                  currentUser={currentUser}
                />

                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#2a2a2a",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 9,
                  }}
                >
                  Occasion
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 18,
                  }}
                >
                  {OCCASIONS.map((o) => (
                    <button
                      key={o}
                      onClick={() => setOccasion(occasion === o ? "" : o)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 9,
                        background:
                          occasion === o
                            ? `${tier.c1}13`
                            : "rgba(255,255,255,0.04)",
                        border: `1px solid ${occasion === o ? tier.c1 + "38" : "rgba(255,255,255,0.07)"}`,
                        color: occasion === o ? tier.c1 : "#484848",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all .15s",
                        fontFamily: "inherit",
                      }}
                    >
                      {o}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#2a2a2a",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 9,
                  }}
                >
                  Message
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={220}
                  placeholder="Write a message that appears when they burst the box open…"
                  style={{
                    width: "100%",
                    padding: "12px 13px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 13,
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    resize: "none",
                    caretColor: "#84cc16",
                    fontFamily: "inherit",
                    lineHeight: 1.65,
                    marginBottom: 5,
                  }}
                />
                <div
                  style={{
                    fontSize: 10,
                    color: "#252525",
                    textAlign: "right",
                    marginBottom: 18,
                  }}
                >
                  {message.length}/220
                </div>

                <button
                  onClick={handleBuy}
                  disabled={!recipient}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 14,
                    border: "none",
                    background: recipient
                      ? `linear-gradient(135deg,${tier.c1},${tier.c2})`
                      : "rgba(255,255,255,0.05)",
                    color: recipient ? "#000" : "#303030",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: recipient ? "pointer" : "not-allowed",
                    boxShadow: recipient ? `0 8px 26px ${tier.glow}` : "none",
                    transition: "all .18s",
                    fontFamily: "inherit",
                  }}
                >
                  Preview Gift →
                </button>
              </>
            )}

            {phase === "confirm" && tier && (
              <>
                <div
                  style={{
                    marginBottom: 16,
                    background: `${tier.c1}05`,
                    border: `1px solid ${tier.c1}18`,
                    borderRadius: 18,
                    padding: "4px 4px 12px",
                    boxShadow: `0 8px 32px ${tier.glow}18`,
                  }}
                >
                  {!burstDone ? (
                    <>
                      <BurstBox
                        tier={tier}
                        onOpened={() => setBurstDone(true)}
                      />
                      <p
                        style={{
                          textAlign: "center",
                          fontSize: 11,
                          color: "#383838",
                          marginTop: 2,
                        }}
                      >
                        Tap the box to preview what{" "}
                        {recipient?.username || "they"} will see
                      </p>
                    </>
                  ) : (
                    <div style={{ padding: "6px 10px 4px" }}>
                      <CardFace
                        tier={tier}
                        message={message}
                        occasion={occasion}
                        senderName={currentUser?.username || "You"}
                        recipientName={recipient?.username}
                        code="GC-PREVIEW"
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    padding: "14px 16px",
                    marginBottom: 14,
                    boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
                  }}
                >
                  {[
                    ["To", `@${recipient?.username}`, "#888"],
                    [
                      "Card value",
                      `${tier.value.toLocaleString()} EP`,
                      tier.c1,
                    ],
                    ["Protocol fee", `−${fee} EP (2%)`, "#3a3a3a"],
                  ].map(([l, v, c]) => (
                    <div
                      key={l}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "#555",
                        marginBottom: 8,
                      }}
                    >
                      <span>{l}</span>
                      <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      height: 1,
                      background: "rgba(255,255,255,0.05)",
                      margin: "5px 0 9px",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    <span style={{ color: "#777" }}>They receive</span>
                    <span style={{ color: tier.c1 }}>
                      {net.toLocaleString()} EP
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleBuy}
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 14,
                    border: "none",
                    background: `linear-gradient(135deg,${tier.c1},${tier.c2})`,
                    color: "#000",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: `0 8px 28px ${tier.glow}`,
                    opacity: loading ? 0.7 : 1,
                    transition: "all .18s",
                    fontFamily: "inherit",
                  }}
                >
                  {loading ? (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        border: "2.5px solid rgba(0,0,0,0.2)",
                        borderTopColor: "#000",
                        borderRadius: "50%",
                        animation: "gcSpin .7s linear infinite",
                      }}
                    />
                  ) : (
                    <>
                      <Gift size={15} /> Send ${tier.price} Gift Card
                    </>
                  )}
                </button>
              </>
            )}

            {phase === "success" && tier && (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 0",
                  animation: "gcSuccess .5s cubic-bezier(.34,1.56,.64,1)",
                }}
              >
                <div
                  style={{
                    fontSize: 72,
                    marginBottom: 16,
                    animation: "gcFloat 2.2s ease-in-out infinite",
                  }}
                >
                  🎁
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#fff",
                    marginBottom: 8,
                    letterSpacing: "-0.5px",
                  }}
                >
                  Gift Sent!
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#555",
                    marginBottom: 24,
                    lineHeight: 1.6,
                  }}
                >
                  @{recipient?.username} has a sealed box waiting
                  <br />
                  in their inbox.
                </div>
                <div style={{ marginBottom: 14 }}>
                  <CardFace
                    tier={tier}
                    message={message}
                    occasion={occasion}
                    senderName={currentUser?.username || "You"}
                    recipientName={recipient?.username}
                    code={genCode}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "11px 14px",
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    marginBottom: 13,
                    boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#555",
                      letterSpacing: ".5px",
                      textAlign: "left",
                    }}
                  >
                    {genCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(genCode).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 8,
                      background: copied
                        ? "rgba(34,197,94,0.1)"
                        : "rgba(255,255,255,0.06)",
                      border: copied
                        ? "1px solid rgba(34,197,94,0.22)"
                        : "1px solid rgba(255,255,255,0.09)",
                      color: copied ? "#22c55e" : "#666",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {copied ? "Copied ✓" : <Copy size={12} />}
                  </button>
                </div>
                <button
                  onClick={reset}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 13,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#707070",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    fontFamily: "inherit",
                  }}
                >
                  <RotateCcw size={13} /> Send Another Gift
                </button>
              </div>
            )}
          </>
        )}

        {/* ════════ REDEEM TAB ════════ */}
        {tab === "redeem" && (
          <>
            <p
              style={{
                fontSize: 11,
                color: "#383838",
                margin: "4px 0 16px",
                lineHeight: 1.7,
              }}
            >
              Enter a gift card code to redeem EP into your balance. 2% protocol
              fee applied on redemption.
            </p>
            <div
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: "16px",
                marginBottom: 14,
                boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#383838",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: 11,
                }}
              >
                Gift Code
              </div>
              <input
                value={redCode}
                onChange={(e) => {
                  setRedCode(e.target.value.toUpperCase());
                  setRedState("idle");
                }}
                placeholder="GC-XXXX-XXXX-XEEVIA"
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  marginBottom: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${redState === "error" ? "rgba(248,113,113,0.4)" : redState === "success" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  caretColor: "#38bdf8",
                  fontFamily: "monospace",
                  letterSpacing: ".5px",
                  transition: "border .2s",
                }}
              />
              <button
                onClick={handleRedeem}
                disabled={!redCode.trim() || redState === "loading"}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 12,
                  border: "none",
                  background: redCode.trim()
                    ? "linear-gradient(135deg,#38bdf8,#0284c7)"
                    : "rgba(255,255,255,0.05)",
                  color: redCode.trim() ? "#000" : "#383838",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: redCode.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                }}
              >
                {redState === "loading" ? (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2.5px solid rgba(0,0,0,0.2)",
                      borderTopColor: "#000",
                      borderRadius: "50%",
                      animation: "gcSpin .7s linear infinite",
                    }}
                  />
                ) : (
                  <>
                    <Zap size={14} /> Redeem EP
                  </>
                )}
              </button>
              {redState === "success" && (
                <div
                  style={{
                    marginTop: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "11px 13px",
                    background: "rgba(34,197,94,0.06)",
                    border: "1px solid rgba(34,197,94,0.18)",
                    borderRadius: 11,
                    animation: "gcReveal .4s ease",
                  }}
                >
                  <CheckCircle size={15} color="#22c55e" />
                  <span
                    style={{ fontSize: 12, color: "#22c55e", fontWeight: 800 }}
                  >
                    Redeemed! EP added to your balance (−2% fee).
                  </span>
                </div>
              )}
              {redState === "error" && (
                <div
                  style={{
                    marginTop: 11,
                    padding: "11px 13px",
                    background: "rgba(248,113,113,0.05)",
                    border: "1px solid rgba(248,113,113,0.18)",
                    borderRadius: 11,
                  }}
                >
                  <span
                    style={{ fontSize: 12, color: "#f87171", fontWeight: 800 }}
                  >
                    Invalid or already used code.
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                padding: "13px 15px",
                background: "rgba(255,255,255,0.018)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 13,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#2a2a2a",
                  fontWeight: 700,
                  marginBottom: 7,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Demo Code
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "#484848",
                    flex: 1,
                  }}
                >
                  GC-X4K2-9M7R-XEEVIA
                </span>
                <button
                  onClick={() => {
                    setRedCode("GC-X4K2-9M7R-XEEVIA");
                    setRedState("idle");
                  }}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#555",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Use
                </button>
              </div>
            </div>
          </>
        )}

        {/* ════════ INBOX TAB ════════ */}
        {tab === "inbox" && (
          <>
            <p
              style={{
                fontSize: 11,
                color: "#383838",
                margin: "4px 0 14px",
                lineHeight: 1.7,
              }}
            >
              Tap the box to burst it open and claim your EP.
            </p>
            {inbox.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "56px 20px",
                  opacity: 0.4,
                }}
              >
                <div
                  style={{
                    fontSize: 56,
                    marginBottom: 14,
                    animation: "gcFloat 2.5s ease-in-out infinite",
                  }}
                >
                  🎁
                </div>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  No gifts yet.
                  <br />
                  Share your profile so people can send you gems.
                </div>
              </div>
            )}
            {inbox.map((card) => (
              <InboxCard key={card.code} card={card} onClaim={claimInbox} />
            ))}
          </>
        )}

        {/* ════════ MY CARDS TAB ════════ */}
        {tab === "my_cards" && (
          <>
            <p
              style={{
                fontSize: 11,
                color: "#383838",
                margin: "4px 0 14px",
                lineHeight: 1.7,
              }}
            >
              Unused cards can be sent. Sent cards tracked here.
            </p>
            {myCards.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "56px 20px",
                  opacity: 0.4,
                }}
              >
                <Package
                  size={44}
                  color="#2a2a2a"
                  style={{ margin: "0 auto 14px", display: "block" }}
                />
                <div style={{ fontSize: 13, color: "#444" }}>
                  No cards yet. Buy your first gem.
                </div>
              </div>
            )}
            {myCards.map((gc, i) => {
              const t = TIERS.find((x) => x.id === gc.tier) || TIERS[0];
              const unused = gc.status === "unused";
              return (
                <div
                  key={gc.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: "13px 14px",
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${unused ? t.c1 + "22" : "rgba(255,255,255,0.05)"}`,
                    borderRadius: 15,
                    marginBottom: 9,
                    animation: `gcCardIn .3s ease ${i * 0.06}s both`,
                    boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      flexShrink: 0,
                      background: `${t.c1}15`,
                      border: `1px solid ${t.c1}26`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <t.Icon size={20} color={t.c1} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#fff",
                        marginBottom: 2,
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#2a2a2a",
                        fontFamily: "monospace",
                        letterSpacing: ".4px",
                      }}
                    >
                      {gc.code}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      flexShrink: 0,
                      marginRight: unused ? 8 : 0,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: t.c1 }}>
                      {t.value.toLocaleString()} EP
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: unused ? "#484848" : "#303030",
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                        marginTop: 2,
                      }}
                    >
                      {gc.status}
                    </div>
                  </div>
                  {unused && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() => {
                          setTab("send");
                          setSelId(gc.tier);
                          setPhase("configure");
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 7,
                          fontSize: 10,
                          fontWeight: 800,
                          background: "rgba(132,204,22,0.1)",
                          border: "1px solid rgba(132,204,22,0.22)",
                          color: "#84cc16",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Send
                      </button>
                      <button
                        onClick={() => {
                          setTab("redeem");
                          setRedCode(gc.code);
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 7,
                          fontSize: 10,
                          fontWeight: 800,
                          background: "rgba(56,189,248,0.1)",
                          border: "1px solid rgba(56,189,248,0.22)",
                          color: "#38bdf8",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Redeem
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setTab("send")}
              style={{
                width: "100%",
                padding: "13px",
                marginTop: 4,
                borderRadius: 13,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.025)",
                color: "#707070",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                fontFamily: "inherit",
              }}
            >
              <Plus size={13} /> Buy New Gift Card
            </button>
          </>
        )}
      </div>
      {toast && <Toast msg={toast.msg} color={toast.color} />}
    </div>
  );
};

export default GiftCardsView;
