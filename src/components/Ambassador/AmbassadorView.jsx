// ============================================================================
// src/components/Ambassador/AmbassadorView.jsx — v3 PREMIUM REDESIGN
// ============================================================================
// BUG FIX: Added missing opening `{` brace on the AmbassadorView function body
//          (was causing "Unexpected token, expected '{'" at line 1067).
//
// REDESIGN: Complete mobile-first premium overhaul.
//   - Glassmorphism cards with subtle grain texture
//   - Animated gradient accents and glow effects
//   - Bottom nav bar for mobile (thumb-friendly)
//   - Smooth spring-like micro-interactions
//   - Gorgeous level progress visualization
//   - Rich earnings chart with animated bars
//   - Pull-to-refresh friendly layout
// ============================================================================
/* eslint-disable no-unused-vars */
import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import {
  useAmbassadorProfile,
  useJoinAmbassadorProgram,
  useAmbassadorReferrals,
  useAmbassadorEarnings,
  usePayoutRequest,
  AMBASSADOR_LEVELS,
  getLevelConfig,
} from "./useAmbassadorData";

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:      "#05050a",
  bg1:     "#0a0a12",
  bg2:     "#0f0f1a",
  bg3:     "#141420",
  bg4:     "#1a1a28",
  border:  "#1c1c2e",
  border2: "#252538",
  border3: "#2e2e48",
  text:    "#f0f0fa",
  text2:   "#c0c0d8",
  muted:   "#5a5a78",
  accent:  "#a3e635",
  accentD: "#7cb82f",
  success: "#34d399",
  danger:  "#f87171",
  warn:    "#fbbf24",
  info:    "#60a5fa",
  purple:  "#a78bfa",
};

// ─── Utils ───────────────────────────────────────────────────────────────────
function buildLink(code) {
  return `${window.location.origin}?ref=${code}`;
}
function fmt$(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n) { return Number(n || 0).toLocaleString(); }
function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h, { passive: true });
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ─── Noise texture overlay ────────────────────────────────────────────────
const noiseStyle = {
  position: "absolute", inset: 0, pointerEvents: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
  borderRadius: "inherit",
  zIndex: 0,
};

// ─── CountUp ────────────────────────────────────────────────────────────────
function CountUp({ target, prefix = "", decimals = 0, duration = 800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const num = parseFloat(String(target).replace(/[^0-9.]/g, "")) || 0;
    const steps = 36;
    let step = 0;
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setVal(num * eased);
      if (step >= steps) { setVal(num); clearInterval(ref.current); }
    }, duration / steps);
    return () => clearInterval(ref.current);
  }, [target, duration]);
  return (
    <span>
      {prefix}
      {decimals > 0
        ? val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : Math.round(val).toLocaleString()}
    </span>
  );
}

// ─── Animated progress bar ────────────────────────────────────────────────
function Bar({ value, max, color, h = 6, animate = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.05)", borderRadius: h, overflow: "hidden", position: "relative" }}>
      <div style={{
        height: "100%",
        width: animate ? `${pct}%` : `${pct}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: h,
        transition: "width 1.2s cubic-bezier(.34,1.56,.64,1)",
        boxShadow: pct > 0 ? `0 0 12px ${color}66` : "none",
        position: "relative",
      }}>
        {pct > 10 && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 3,
            background: color, borderRadius: "0 3px 3px 0",
            boxShadow: `0 0 8px ${color}, 0 0 16px ${color}88`,
          }} />
        )}
      </div>
    </div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Copy", small = false }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      })}
      style={{
        padding: small ? "6px 14px" : "9px 18px",
        borderRadius: 12,
        border: `1px solid ${copied ? T.accent + "66" : T.border3}`,
        background: copied ? T.accent + "18" : "rgba(255,255,255,0.04)",
        color: copied ? T.accent : T.text2,
        fontSize: small ? 11 : 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all .2s",
        whiteSpace: "nowrap",
        flexShrink: 0,
        backdropFilter: "blur(8px)",
      }}
    >{copied ? "✓ Copied!" : label}</button>
  );
}

// ─── Level badge ─────────────────────────────────────────────────────────────
function LevelBadge({ level, size = "md" }) {
  const cfg = getLevelConfig(level);
  const pad = size === "lg" ? "8px 18px" : size === "sm" ? "3px 9px" : "4px 12px";
  const fs  = size === "lg" ? 12 : size === "sm" ? 9 : 10;
  const ico = size === "lg" ? 16 : 12;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: pad, borderRadius: 30,
      background: cfg.badgeBg, border: `1px solid ${cfg.badgeBorder}`,
      fontSize: fs, fontWeight: 800, color: cfg.color, whiteSpace: "nowrap",
      boxShadow: `0 0 16px ${cfg.color}18`,
    }}>
      <span style={{ fontSize: ico }}>{cfg.icon}</span>
      LVL {level} · {cfg.name.toUpperCase()}
    </span>
  );
}

// ─── Glass card ───────────────────────────────────────────────────────────────
function GlassCard({ children, style = {}, accent, onClick, noPad }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHov(true)}
      onMouseLeave={() => onClick && setHov(false)}
      style={{
        background: `linear-gradient(135deg, ${T.bg2}f0, ${T.bg1}e0)`,
        border: `1px solid ${hov ? (accent ? accent + "44" : T.border3) : (accent ? accent + "22" : T.border)}`,
        borderRadius: 20,
        padding: noPad ? 0 : "20px",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(16px)",
        transition: "border-color .2s, transform .2s, box-shadow .2s",
        transform: hov && onClick ? "translateY(-2px)" : "none",
        boxShadow: accent
          ? `0 0 40px ${accent}0a, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      <div style={noiseStyle} />
      {accent && (
        <div style={{
          position: "absolute", top: -60, right: -60, width: 160, height: 160,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, prefix = "", decimals = 0, isMobile }) {
  return (
    <GlassCard accent={color} style={{ flex: "1 1 0", minWidth: 0 }}>
      <div style={{ fontSize: isMobile ? 24 : 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 8, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.4px", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: T.text, letterSpacing: -0.5, lineHeight: 1 }}>
        <CountUp target={value} prefix={prefix} decimals={decimals} />
      </div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
      <div style={{ marginTop: 12 }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${color}88, ${color}22)`, borderRadius: 2 }} />
      </div>
    </GlassCard>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniChart({ data, color, isMobile }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.amount), 0.01);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 4 : 5, height: isMobile ? 56 : 64 }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.amount / max) * (isMobile ? 52 : 60));
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              title={`${d.label}: ${fmt$(d.amount)}`}
              style={{
                width: "100%", height: h,
                borderRadius: "3px 3px 0 0",
                background: d.amount > 0
                  ? `linear-gradient(180deg, ${color}, ${color}44)`
                  : "rgba(255,255,255,0.04)",
                transition: `height .8s cubic-bezier(.34,1.2,.64,1) ${i * 0.04}s`,
                boxShadow: d.amount > 0 ? `0 -2px 8px ${color}44` : "none",
              }}
            />
            <span style={{ fontSize: 7, color: T.muted, whiteSpace: "nowrap" }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════════
function LoadingScreen() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", flexDirection: "column", gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: `3px solid ${T.border2}`,
        borderTopColor: T.accent,
        animation: "ambSpin .7s linear infinite",
      }} />
      <div style={{ fontSize: 13, color: T.muted, letterSpacing: "0.5px" }}>Loading your profile…</div>
      <style>{`@keyframes ambSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function ErrorScreen({ error, reload }) {
  return (
    <div style={{ maxWidth: 400, margin: "48px auto", padding: "0 20px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
      <div style={{ fontSize: 15, color: T.danger, marginBottom: 8, fontWeight: 600 }}>Something went wrong</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.6 }}>{error}</div>
      <button
        onClick={reload}
        style={{
          padding: "12px 28px", borderRadius: 14, border: `1px solid ${T.border3}`,
          background: "rgba(255,255,255,0.04)", color: T.text2,
          cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          transition: "all .2s",
        }}
      >Try Again</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JOIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function JoinScreen({ userProfile, onJoined, isMobile }) {
  const { join, joining, error } = useJoinAmbassadorProgram();
  const [agreed, setAgreed] = useState(false);
  const [activeLevel, setActiveLevel] = useState(null);

  const handleJoin = async () => {
    try { const r = await join(userProfile.id, userProfile); onJoined(r); } catch {}
  };

  return (
    <div style={{
      maxWidth: 640, margin: "0 auto",
      padding: isMobile ? "24px 16px 100px" : "48px 24px 60px",
    }}>
      <style>{`
        @keyframes ambFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes ambPulseRing { 0%{transform:scale(1);opacity:.4} 100%{transform:scale(1.8);opacity:0} }
        @keyframes ambShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ambFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
      `}</style>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48, animation: "ambFadeUp .5s ease both" }}>
        {/* Animated icon */}
        <div style={{
          display: "inline-flex", position: "relative", marginBottom: 24,
          animation: "ambFloat 3s ease-in-out infinite",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: `linear-gradient(135deg, ${T.accent}22, ${T.accent}08)`,
            border: `1.5px solid ${T.accent}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36,
            boxShadow: `0 0 40px ${T.accent}20`,
          }}>🌐</div>
          <div style={{
            position: "absolute", inset: -8, borderRadius: 30,
            border: `1px solid ${T.accent}22`,
            animation: "ambPulseRing 2s ease-out infinite",
          }} />
        </div>

        {/* Pill badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 18px", borderRadius: 30,
          background: `${T.accent}0f`, border: `1px solid ${T.accent}33`,
          fontSize: 10, fontWeight: 800, color: T.accent,
          letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 20,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, display: "inline-block", boxShadow: `0 0 6px ${T.accent}` }} />
          Xeevia Ambassador Program
        </div>

        <h1 style={{
          fontSize: isMobile ? 30 : 42,
          fontWeight: 900, color: T.text,
          margin: "0 0 14px", letterSpacing: -1.5, lineHeight: 1.08,
        }}>
          Share your link.{" "}
          <span style={{
            background: `linear-gradient(135deg, ${T.accent}, #65a30d)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Earn real money.
          </span>
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 15, color: T.muted, margin: "0 auto", lineHeight: 1.75, maxWidth: 460 }}>
          Every user who joins through your referral link earns you a commission. Level up to unlock higher rates — up to 20%.
        </p>
      </div>

      {/* Level cards — tap to expand */}
      <div style={{ marginBottom: 28, animation: "ambFadeUp .5s .1s ease both" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14, textAlign: "center" }}>
          Commission Tiers
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)",
          gap: isMobile ? 10 : 8,
        }}>
          {AMBASSADOR_LEVELS.map((lvl) => {
            const isActive = activeLevel === lvl.level;
            return (
              <div
                key={lvl.level}
                onClick={() => setActiveLevel(isActive ? null : lvl.level)}
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${lvl.badgeBg}, ${lvl.color}12)`
                    : lvl.badgeBg,
                  border: `1.5px solid ${isActive ? lvl.color + "66" : lvl.badgeBorder}`,
                  borderRadius: 18, padding: isMobile ? "16px 12px" : "18px 10px",
                  textAlign: "center", cursor: "pointer",
                  transition: "all .25s cubic-bezier(.34,1.2,.64,1)",
                  transform: isActive ? "scale(1.04) translateY(-3px)" : "scale(1)",
                  boxShadow: isActive ? `0 8px 24px ${lvl.color}22` : "none",
                  ...(isMobile && lvl.level === 5 ? { gridColumn: "1 / -1" } : {}),
                }}
              >
                <div style={{ fontSize: isMobile ? 26 : 22, marginBottom: 6 }}>{lvl.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: lvl.color, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>
                  {lvl.name}
                </div>
                <div style={{ fontSize: isMobile ? 24 : 22, fontWeight: 900, color: T.text, lineHeight: 1 }}>{lvl.commissionPct}%</div>
                <div style={{ fontSize: 8, color: T.muted, marginTop: 2 }}>commission</div>
                {isActive && (
                  <div style={{
                    marginTop: 8, fontSize: 9, color: lvl.color,
                    fontWeight: 700, lineHeight: 1.5,
                    padding: "4px 8px", background: `${lvl.color}0f`,
                    borderRadius: 8, border: `1px solid ${lvl.color}22`,
                  }}>
                    {lvl.minMonthly === 0 ? "Starting level" : `${fmtNum(lvl.minMonthly)}+ refs/mo`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <GlassCard style={{ marginBottom: 16, animation: "ambFadeUp .5s .2s ease both" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.text2, marginBottom: 18, textTransform: "uppercase", letterSpacing: "1.2px" }}>
          How it works
        </div>
        {[
          { icon: "🔗", title: "Get your unique link", desc: "Join in seconds and get a personal referral link ready to share." },
          { icon: "📣", title: "Share it everywhere", desc: "Post on socials, WhatsApp, communities — no approval needed." },
          { icon: "💰", title: "Earn on every signup", desc: "Collect a % of every $1 paid through your link, automatically." },
          { icon: "📈", title: "Level up & earn more", desc: "Hit monthly targets to unlock up to 20% commission." },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", gap: 14, alignItems: "flex-start",
            marginBottom: i < 3 ? 16 : 0,
            paddingBottom: i < 3 ? 16 : 0,
            borderBottom: i < 3 ? `1px solid ${T.border}` : "none",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: `${T.accent}0f`, border: `1px solid ${T.accent}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </GlassCard>

      {/* Example earnings */}
      <GlassCard accent={T.accent} style={{ marginBottom: 16, animation: "ambFadeUp .5s .25s ease both" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.accent, marginBottom: 14, textTransform: "uppercase", letterSpacing: "1.2px" }}>
          💡 Example earnings at $1 per referral
        </div>
        <div style={{ display: "flex", gap: isMobile ? 6 : 8 }}>
          {AMBASSADOR_LEVELS.map((lvl) => {
            const mid = lvl.maxMonthly === Infinity ? 1200 : Math.round((lvl.minMonthly + lvl.maxMonthly) / 2);
            const earn = (mid * 1 * lvl.commissionPct) / 100;
            return (
              <div key={lvl.level} style={{
                flex: 1, textAlign: "center",
                padding: isMobile ? "10px 4px" : "12px 6px",
                background: `${lvl.color}0a`,
                border: `1px solid ${lvl.color}1a`,
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 8, color: T.muted, marginBottom: 4 }}>~{mid < 1000 ? mid : (mid / 1000) + "k"}/mo</div>
                <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 900, color: lvl.color, letterSpacing: -0.5 }}>{fmt$(earn)}</div>
                <div style={{ fontSize: 8, color: lvl.color + "88", marginTop: 2 }}>{lvl.commissionPct}%</div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* TOS checkbox */}
      <label
        style={{
          display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer",
          marginBottom: 20, animation: "ambFadeUp .5s .3s ease both",
        }}
      >
        <div
          onClick={() => setAgreed(v => !v)}
          style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
            border: `2px solid ${agreed ? T.accent : T.border3}`,
            background: agreed ? T.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .2s cubic-bezier(.34,1.2,.64,1)",
            boxShadow: agreed ? `0 0 12px ${T.accent}44` : "none",
          }}
        >
          {agreed && <span style={{ fontSize: 12, color: "#000", fontWeight: 900 }}>✓</span>}
        </div>
        <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.65 }}>
          I agree to the Ambassador Terms. Commissions are paid on request with a minimum of $10. Xeevia may adjust rates with 30 days notice.
        </span>
      </label>

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 14, marginBottom: 16,
          background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.2)",
          fontSize: 12, color: T.danger, lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleJoin}
        disabled={joining || !agreed}
        style={{
          width: "100%", padding: isMobile ? "17px" : "19px",
          borderRadius: 18, border: "none",
          background: (!agreed || joining)
            ? T.bg3
            : `linear-gradient(135deg, ${T.accent} 0%, #65a30d 100%)`,
          color: (!agreed || joining) ? T.muted : "#051000",
          fontWeight: 900, fontSize: isMobile ? 15 : 16,
          cursor: (!agreed || joining) ? "not-allowed" : "pointer",
          fontFamily: "inherit", transition: "all .25s",
          boxShadow: (!agreed || joining) ? "none" : `0 10px 40px ${T.accent}40`,
          letterSpacing: -0.3,
          animation: "ambFadeUp .5s .35s ease both",
        }}
      >
        {joining ? "Setting up your account…" : "Join the Ambassador Program →"}
      </button>

      <p style={{ textAlign: "center", fontSize: 11, color: T.muted, marginTop: 14 }}>
        Free to join · No targets required · Withdraw anytime
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function Dashboard({ profile, onReload, isMobile }) {
  const [tab, setTab] = useState("overview");
  const [showPayout, setShowPayout] = useState(false);
  const [payoutDone, setPayoutDone] = useState(false);
  const { chartData } = useAmbassadorEarnings(profile.id);
  const lvl = profile.levelConfig;

  const TABS = [
    { id: "overview",  label: "Overview",  icon: "📊" },
    { id: "referrals", label: "Referrals", icon: "👥" },
    { id: "earnings",  label: "Earnings",  icon: "💰" },
    { id: "share",     label: "Share",     icon: "🔗" },
  ];

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", paddingBottom: isMobile ? 90 : 48 }}>
      <style>{`
        @keyframes ambSpin{to{transform:rotate(360deg)}}
        @keyframes ambFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes ambSlideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        @keyframes ambBounceIn{0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}
        @keyframes ambToast{0%{opacity:0;transform:translateY(20px)}10%{opacity:1;transform:none}85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(20px)}}
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: isMobile ? "20px 16px 0" : "32px 0 0",
        marginBottom: isMobile ? 20 : 24,
      }}>
        {/* Profile row */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 12,
          flexDirection: isMobile ? "column" : "row",
          marginBottom: 20,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <LevelBadge level={profile.current_level} size={isMobile ? "sm" : "md"} />
              <span style={{ color: T.muted, fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: T.muted }}>
                Code:{" "}
                <span style={{ color: T.accent, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.5px" }}>
                  {profile.invite_code}
                </span>
              </span>
              <span style={{ color: T.muted, fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: lvl.color }}>{lvl.commissionPct}% per ref</span>
            </div>
          </div>

          <button
            onClick={() => setShowPayout(true)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: isMobile ? "13px 20px" : "12px 22px",
              borderRadius: 14, border: "none",
              background: profile.pendingPayout >= 10
                ? `linear-gradient(135deg, ${T.success}, #059669)`
                : "rgba(255,255,255,0.05)",
              color: profile.pendingPayout >= 10 ? "#001a0e" : T.muted,
              fontWeight: 800, fontSize: 13, cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap",
              alignSelf: isMobile ? "stretch" : "auto",
              justifyContent: "center",
              boxShadow: profile.pendingPayout >= 10 ? `0 8px 24px ${T.success}33` : "none",
              transition: "all .2s",
            }}
          >
            💸 Request Payout
            {profile.pendingPayout > 0 && (
              <span style={{
                padding: "2px 10px", borderRadius: 10,
                background: "rgba(0,0,0,0.2)",
                fontSize: 12, fontWeight: 900,
              }}>
                {fmt$(profile.pendingPayout)}
              </span>
            )}
          </button>
        </div>

        {/* ── Desktop Tabs ── */}
        {!isMobile && (
          <div style={{
            display: "flex", gap: 2,
            borderBottom: `1px solid ${T.border}`,
          }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "11px 18px",
                borderRadius: "12px 12px 0 0",
                border: "none",
                borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
                background: tab === t.id ? `${T.accent}0a` : "transparent",
                color: tab === t.id ? T.accent : T.muted,
                fontWeight: tab === t.id ? 800 : 500, fontSize: 13,
                cursor: "pointer", fontFamily: "inherit",
                transition: "color .15s, background .15s",
              }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: isMobile ? "0 16px" : "0" }}>
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18 }}>
            {/* Stats row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: isMobile ? 10 : 14,
            }}>
              <StatCard icon="👥" label="Total Referrals" value={profile.total_referrals} color={lvl.color} isMobile={isMobile} />
              <StatCard icon="📅" label="This Month" value={profile.thisMonthRefs || 0}
                sub={`${fmtNum(profile.prev_month_referrals)} last month`} color={T.info} isMobile={isMobile} />
              <StatCard icon="💰" label="Total Earned" value={profile.totalEarned}
                prefix="$" decimals={2} color={T.success} isMobile={isMobile} />
              <StatCard icon="⏳" label="Pending" value={profile.pendingPayout}
                prefix="$" decimals={2}
                sub={profile.pendingPayout >= 10 ? "✓ Ready to withdraw" : `$${(10 - profile.pendingPayout).toFixed(2)} to min`}
                color={T.warn} isMobile={isMobile} />
            </div>

            {/* Level card */}
            <LevelCard profile={profile} isMobile={isMobile} />

            {/* Earnings chart */}
            <GlassCard>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 3 }}>Earnings · Last 8 Weeks</div>
                  <div style={{ fontSize: 12, color: T.muted }}>
                    This month:{" "}
                    <span style={{ color: T.success, fontWeight: 700 }}>{fmt$(profile.thisMonthEarned)}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: lvl.color }}>{fmt$(profile.totalEarned)}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>lifetime</div>
                </div>
              </div>
              <MiniChart data={chartData} color={lvl.color} isMobile={isMobile} />
            </GlassCard>

            {/* Recent referrals */}
            <ReferralsPanel ambassadorId={profile.id} isMobile={isMobile} limit={5} />
          </div>
        )}

        {/* REFERRALS */}
        {tab === "referrals" && (
          <ReferralsPanel ambassadorId={profile.id} isMobile={isMobile} limit={20} />
        )}

        {/* EARNINGS */}
        {tab === "earnings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
              gap: isMobile ? 10 : 14,
            }}>
              <StatCard icon="💎" label="Lifetime Earned" value={profile.totalEarned} prefix="$" decimals={2} color={T.success} isMobile={isMobile} />
              <StatCard icon="📅" label="This Month" value={profile.thisMonthEarned} prefix="$" decimals={2} color={lvl.color} isMobile={isMobile} />
              <StatCard icon="⏳" label="Pending Payout" value={profile.pendingPayout} prefix="$" decimals={2} color={T.warn} isMobile={isMobile}
                style={isMobile ? { gridColumn: "1 / -1" } : {}} />
            </div>

            <GlassCard>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 18 }}>Earnings History</div>
              <MiniChart data={chartData} color={lvl.color} isMobile={isMobile} />
            </GlassCard>

            {/* Commission rate table */}
            <GlassCard noPad>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Commission Rate Schedule</div>
              </div>
              {AMBASSADOR_LEVELS.map((l, i) => (
                <div key={l.level} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 20px",
                  borderBottom: i < AMBASSADOR_LEVELS.length - 1 ? `1px solid ${T.border}` : "none",
                  background: l.level === profile.current_level ? `${l.color}07` : "transparent",
                  transition: "background .2s",
                }}>
                  <span style={{ fontSize: 20 }}>{l.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: l.level === profile.current_level ? l.color : T.text2 }}>
                      {l.name}
                      {l.level === profile.current_level && (
                        <span style={{
                          marginLeft: 8, fontSize: 8, fontWeight: 900, color: l.color,
                          background: `${l.color}18`, padding: "2px 8px", borderRadius: 6,
                          border: `1px solid ${l.color}33`,
                        }}>← YOU</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                      {l.minMonthly}–{l.maxMonthly === Infinity ? "∞" : l.maxMonthly} referrals/month
                    </div>
                  </div>
                  <div style={{
                    padding: "6px 14px", borderRadius: 12,
                    background: l.badgeBg, border: `1px solid ${l.badgeBorder}`,
                    fontSize: 16, fontWeight: 900, color: l.color,
                  }}>
                    {l.commissionPct}%
                  </div>
                </div>
              ))}
            </GlassCard>
          </div>
        )}

        {/* SHARE */}
        {tab === "share" && (
          <SharePanel code={profile.invite_code} profile={profile} isMobile={isMobile} />
        )}
      </div>

      {/* ── Mobile bottom navigation ── */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: `${T.bg1}f0`,
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "12px 4px 10px",
                border: "none", background: "transparent",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                cursor: "pointer", fontFamily: "inherit",
                color: tab === t.id ? T.accent : T.muted,
                transition: "color .15s",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, fontWeight: tab === t.id ? 800 : 500 }}>{t.label}</span>
              {tab === t.id && (
                <div style={{
                  position: "absolute", bottom: "env(safe-area-inset-bottom, 0px)",
                  width: 32, height: 2, borderRadius: 1,
                  background: T.accent,
                  boxShadow: `0 0 8px ${T.accent}`,
                }} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Payout modal */}
      {showPayout && (
        <PayoutModal
          ambassador={profile}
          isMobile={isMobile}
          onClose={() => setShowPayout(false)}
          onSuccess={() => {
            setShowPayout(false);
            setPayoutDone(true);
            onReload();
            setTimeout(() => setPayoutDone(false), 4000);
          }}
        />
      )}

      {payoutDone && (
        <div style={{
          position: "fixed",
          bottom: isMobile ? 90 : 28,
          left: isMobile ? 16 : "auto",
          right: isMobile ? 16 : 28,
          zIndex: 9999,
          padding: "15px 22px", borderRadius: 16,
          background: `${T.success}14`,
          border: `1px solid ${T.success}44`,
          fontSize: 13, fontWeight: 700, color: T.success,
          boxShadow: "0 12px 40px rgba(0,0,0,.6)",
          animation: "ambToast 4s ease forwards",
          backdropFilter: "blur(16px)",
        }}>
          ✅ Payout request submitted! We'll process it within 3–5 business days.
        </div>
      )}
    </div>
  );
}

// ─── Level card ──────────────────────────────────────────────────────────────
function LevelCard({ profile, isMobile }) {
  const lvl       = profile.levelConfig;
  const nextLvl   = getLevelConfig(Math.min(5, profile.current_level + 1));
  const isMax     = profile.current_level === 5;
  const thisMonth = profile.thisMonthRefs || 0;
  const target    = isMax ? lvl.minMonthly : nextLvl.minMonthly;
  const remaining = Math.max(0, target - thisMonth);

  return (
    <GlassCard accent={lvl.color}>
      <div style={{
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between", gap: 14, marginBottom: 20,
        flexDirection: isMobile ? "column" : "row",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: isMobile ? 56 : 68, height: isMobile ? 56 : 68,
            borderRadius: 20,
            background: `${lvl.color}18`,
            border: `2px solid ${lvl.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: isMobile ? 28 : 36,
            boxShadow: `0 0 24px ${lvl.color}22`,
          }}>{lvl.icon}</div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.4px", marginBottom: 4 }}>
              Your Level
            </div>
            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: lvl.color, letterSpacing: -0.5, lineHeight: 1 }}>
              {lvl.name}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Level {profile.current_level} of 5</div>
          </div>
        </div>

        <div style={{
          background: `${lvl.color}12`,
          border: `1px solid ${lvl.color}30`,
          borderRadius: 16, padding: "14px 20px", textAlign: "center",
          alignSelf: isMobile ? "flex-start" : "auto",
          boxShadow: `0 0 24px ${lvl.color}14`,
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: lvl.color, letterSpacing: -1.5, lineHeight: 1 }}>
            {lvl.commissionPct}%
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>commission rate</div>
        </div>
      </div>

      {/* Progress to next level */}
      {!isMax && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: T.muted }}>
              Progress to{" "}
              <span style={{ color: nextLvl.color, fontWeight: 700 }}>{nextLvl.icon} {nextLvl.name}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: lvl.color }}>
              {fmtNum(thisMonth)} / {fmtNum(target)}
            </span>
          </div>
          <Bar value={thisMonth} max={target} color={lvl.color} h={8} />
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
            {remaining > 0 ? (
              <>
                <span style={{ color: T.text2, fontWeight: 600 }}>{fmtNum(remaining)}</span>
                {" "}more referrals this month unlocks{" "}
                <span style={{ color: nextLvl.color, fontWeight: 700 }}>{nextLvl.name} ({nextLvl.commissionPct}%)</span>
              </>
            ) : (
              <span style={{ color: T.success, fontWeight: 700 }}>✓ You'll be promoted next month!</span>
            )}
          </div>
        </div>
      )}

      {isMax && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: `${lvl.color}0a`, border: `1px solid ${lvl.color}22`,
          fontSize: 13, color: lvl.color, fontWeight: 700, marginBottom: 18,
        }}>
          👑 Maximum level — you're earning the full 20% commission on every referral
        </div>
      )}

      {/* Level progress dots */}
      <div style={{ display: "flex", gap: 8 }}>
        {AMBASSADOR_LEVELS.map(l => (
          <div key={l.level} style={{ flex: 1 }}>
            <div style={{
              height: 5, borderRadius: 3,
              background: l.level <= profile.current_level
                ? `linear-gradient(90deg, ${l.color}88, ${l.color})`
                : "rgba(255,255,255,0.04)",
              boxShadow: l.level === profile.current_level ? `0 0 10px ${l.color}55` : "none",
              transition: "background .3s",
            }} />
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <span style={{ fontSize: 10 }}>{l.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, color: T.muted, lineHeight: 1.65 }}>
        📅 Levels reset on the 1st of each month based on your previous month's referrals.
        {profile.prev_month_referrals > 0 && (
          <> Last month: <strong style={{ color: lvl.color }}>{fmtNum(profile.prev_month_referrals)} referrals</strong>.</>
        )}
      </div>
    </GlassCard>
  );
}

// ─── Referrals panel ─────────────────────────────────────────────────────────
function ReferralsPanel({ ambassadorId, isMobile, limit = 20 }) {
  const { referrals, total, page, setPage, loading } = useAmbassadorReferrals(ambassadorId, limit);

  if (loading && !referrals.length) return (
    <GlassCard>
      <div style={{ textAlign: "center", padding: "24px 0", color: T.muted, fontSize: 13 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${T.border2}`, borderTopColor: T.accent, animation: "ambSpin .7s linear infinite", margin: "0 auto 10px" }} />
        Loading referrals…
      </div>
    </GlassCard>
  );

  if (!referrals.length) return (
    <GlassCard>
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.muted, marginBottom: 6 }}>No referrals yet</div>
        <div style={{ fontSize: 12, color: T.muted }}>Share your link to start earning</div>
      </div>
    </GlassCard>
  );

  return (
    <GlassCard noPad>
      <div style={{
        padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Referrals</div>
        <span style={{
          fontSize: 11, color: T.muted, fontWeight: 600,
          background: "rgba(255,255,255,0.04)", padding: "3px 10px", borderRadius: 8,
          border: `1px solid ${T.border}`,
        }}>{fmtNum(total)} total</span>
      </div>

      {referrals.map((ref, i) => {
        const u = ref.referred_user;
        const name = u?.full_name || u?.username || "Anonymous";
        const initials = name.slice(0, 2).toUpperCase();
        const isConfirmed = ref.status === "confirmed";
        return (
          <div key={ref.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: isMobile ? "14px 16px" : "14px 20px",
            borderBottom: i < referrals.length - 1 ? `1px solid ${T.border}` : "none",
            transition: "background .15s",
          }}
            onMouseEnter={e => !isMobile && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
            onMouseLeave={e => !isMobile && (e.currentTarget.style.background = "transparent")}
          >
            {/* Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: `${T.accent}1a`, border: `1px solid ${T.accent}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: T.accent,
            }}>{initials}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: T.text2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{name}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{timeAgo(ref.created_at)}</div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: T.success }}>+{fmt$(ref.commission_amount)}</div>
              <div style={{ fontSize: 9, color: T.muted }}>{ref.commission_pct}% of {fmt$(ref.revenue_amount)}</div>
            </div>

            <div style={{
              padding: "3px 9px", borderRadius: 7, flexShrink: 0,
              background: isConfirmed ? `${T.success}12` : `${T.danger}12`,
              border: `1px solid ${isConfirmed ? T.success + "28" : T.danger + "28"}`,
              fontSize: 9, fontWeight: 800,
              color: isConfirmed ? T.success : T.danger,
            }}>{ref.status}</div>
          </div>
        );
      })}

      {total > limit && (
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{
            padding: "7px 18px", borderRadius: 10, border: `1px solid ${T.border}`,
            background: "transparent", color: page === 0 ? T.muted : T.text2,
            fontSize: 11, fontWeight: 700, cursor: page === 0 ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>← Prev</button>
          <span style={{ fontSize: 11, color: T.muted }}>Page {page + 1}</span>
          <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} style={{
            padding: "7px 18px", borderRadius: 10, border: `1px solid ${T.border}`,
            background: "transparent", color: (page + 1) * limit >= total ? T.muted : T.text2,
            fontSize: 11, fontWeight: 700, cursor: (page + 1) * limit >= total ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>Next →</button>
        </div>
      )}
    </GlassCard>
  );
}

// ─── Share panel ─────────────────────────────────────────────────────────────
function SharePanel({ code, profile, isMobile }) {
  const link = buildLink(code);
  const lvl  = profile.levelConfig;
  const [msg, setMsg] = useState(`Join me on Xeevia! Use my link to get started 🚀`);
  const [activeShare, setActiveShare] = useState(null);

  const shareItems = [
    { icon: "💬", label: "WhatsApp", color: "#25D366", url: `https://wa.me/?text=${encodeURIComponent(msg + "\n\n" + link)}` },
    { icon: "𝕏", label: "X / Twitter", color: "#e7e7e7", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(link)}` },
    { icon: "✈️", label: "Telegram", color: "#2AABEE", url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}` },
    { icon: "💼", label: "LinkedIn", color: "#0A66C2", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18 }}>
      {/* Link card */}
      <GlassCard>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 18 }}>🔗 Your Ambassador Link</div>

        {/* Full link */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border2}`,
          borderRadius: 14, padding: "12px 16px", marginBottom: 12,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}>
          <span style={{
            flex: 1, fontSize: 12, color: T.muted,
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: isMobile ? "normal" : "nowrap",
            wordBreak: isMobile ? "break-all" : "normal",
            fontFamily: "monospace",
          }}>{link}</span>
          <CopyBtn text={link} label="Copy Link" small />
        </div>

        {/* Referral code */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: `${T.accent}08`, border: `1px solid ${T.accent}22`,
          borderRadius: 14, padding: "12px 16px", marginBottom: 20,
        }}>
          <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>Referral code</span>
          <span style={{ flex: 1, fontSize: 18, fontWeight: 900, color: T.accent, fontFamily: "monospace", letterSpacing: "1px" }}>{code}</span>
          <CopyBtn text={code} label="Copy" small />
        </div>

        {/* Custom message */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 10 }}>
            Your message
          </div>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            rows={isMobile ? 3 : 2}
            style={{
              width: "100%", background: "rgba(255,255,255,0.03)",
              border: `1px solid ${T.border2}`,
              borderRadius: 14, padding: "12px 16px", color: T.text2,
              fontSize: 13, lineHeight: 1.65, fontFamily: "inherit",
              outline: "none", resize: "none", transition: "border-color .15s",
              boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = T.accent + "55")}
            onBlur={e => (e.target.style.borderColor = T.border2)}
          />
        </div>

        {/* Share buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {shareItems.map(s => (
            <a
              key={s.label}
              href={s.url}
              target="_blank" rel="noreferrer"
              onMouseEnter={() => setActiveShare(s.label)}
              onMouseLeave={() => setActiveShare(null)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "13px 16px", borderRadius: 14,
                border: `1px solid ${activeShare === s.label ? s.color + "44" : T.border}`,
                background: activeShare === s.label ? `${s.color}0a` : "rgba(255,255,255,0.03)",
                textDecoration: "none", transition: "all .2s",
                color: activeShare === s.label ? s.color : T.text2,
                fontSize: 13, fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              {s.label}
            </a>
          ))}
        </div>
      </GlassCard>

      {/* Commission reminder */}
      <GlassCard accent={T.accent}>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.75 }}>
          💰 You earn{" "}
          <strong style={{ color: T.accent }}>{lvl.commissionPct}%</strong>
          {" "}commission right now. Reach Level 5 to earn up to{" "}
          <strong style={{ color: T.warn }}>20%</strong>
          {" "}— that's{" "}
          <strong style={{ color: T.success }}>$200 per 1,000 referrals</strong> at $1/user.
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Payout modal ─────────────────────────────────────────────────────────────
function PayoutModal({ ambassador, isMobile, onClose, onSuccess }) {
  const { request, requesting, error } = usePayoutRequest();
  const [method, setMethod] = useState("bank");
  const [bank, setBank] = useState("");
  const [acctNum, setAcctNum] = useState("");
  const [acctName, setAcctName] = useState("");
  const [note, setNote] = useState("");
  const pending = ambassador?.pendingPayout || 0;
  const canReq  = pending >= 10;

  const handleSubmit = async () => {
    try {
      await request(ambassador.id, pending, { method, bank, accountNumber: acctNum, accountName: acctName, note });
      onSuccess();
    } catch {}
  };

  const fieldStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.border2}`,
    borderRadius: 12, padding: "12px 16px", color: T.text,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    transition: "border-color .15s", boxSizing: "border-box",
  };

  const methods = [
    { id: "bank", label: "🏦 Bank" },
    { id: "crypto", label: "₿ Crypto" },
    { id: "paypal", label: "🅿 PayPal" },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.85)",
        backdropFilter: "blur(16px)",
        zIndex: 9999,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: `linear-gradient(135deg, ${T.bg2}f8, ${T.bg1}f0)`,
        border: `1px solid ${T.border2}`,
        borderRadius: isMobile ? "24px 24px 0 0" : 24,
        padding: isMobile ? "24px 20px 32px" : "28px 28px",
        width: "100%", maxWidth: 460,
        maxHeight: isMobile ? "90vh" : "none",
        overflowY: "auto",
        position: "relative",
      }}>
        <div style={noiseStyle} />
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Handle */}
          {isMobile && (
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: T.border3, margin: "0 auto 20px",
            }} />
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.text, marginBottom: 4 }}>Request Payout</div>
              <div style={{ fontSize: 12, color: T.muted }}>
                Available:{" "}
                <strong style={{ color: T.success, fontSize: 15 }}>{fmt$(pending)}</strong>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border2}`,
                borderRadius: 10, color: T.muted, cursor: "pointer",
                padding: "7px 13px", fontFamily: "inherit", fontSize: 14,
                transition: "all .15s",
              }}
            >✕</button>
          </div>

          {!canReq && (
            <div style={{
              padding: "16px 18px", borderRadius: 16,
              background: "rgba(251,191,36,.05)",
              border: "1px solid rgba(251,191,36,.2)",
              fontSize: 13, color: T.warn, lineHeight: 1.65, marginBottom: 24,
            }}>
              Minimum payout is <strong>$10.00</strong>. You have <strong>{fmt$(pending)}</strong> pending.
              Keep sharing your link to reach the threshold!
            </div>
          )}

          {canReq && (
            <>
              {/* Payment method */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    style={{
                      flex: 1, padding: "11px 6px", borderRadius: 12, cursor: "pointer",
                      fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                      border: `1px solid ${method === m.id ? T.accent + "55" : T.border}`,
                      background: method === m.id ? `${T.accent}0f` : "rgba(255,255,255,0.03)",
                      color: method === m.id ? T.accent : T.muted,
                      transition: "all .2s",
                    }}
                  >{m.label}</button>
                ))}
              </div>

              {method === "bank" && (
                <>
                  {[
                    { label: "Bank Name", val: bank, set: setBank, ph: "e.g. GTBank" },
                    { label: "Account Number", val: acctNum, set: setAcctNum, ph: "0123456789" },
                    { label: "Account Name", val: acctName, set: setAcctName, ph: "John Doe" },
                  ].map(f => (
                    <div key={f.label} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 7 }}>{f.label}</div>
                      <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={fieldStyle}
                        onFocus={e => (e.target.style.borderColor = T.accent + "55")} onBlur={e => (e.target.style.borderColor = T.border2)} />
                    </div>
                  ))}
                </>
              )}
              {method === "crypto" && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 7 }}>Wallet Address</div>
                  <input value={bank} onChange={e => setBank(e.target.value)} placeholder="0x..." style={fieldStyle}
                    onFocus={e => (e.target.style.borderColor = T.accent + "55")} onBlur={e => (e.target.style.borderColor = T.border2)} />
                </div>
              )}
              {method === "paypal" && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 7 }}>PayPal Email</div>
                  <input value={bank} onChange={e => setBank(e.target.value)} placeholder="you@email.com" style={fieldStyle}
                    onFocus={e => (e.target.style.borderColor = T.accent + "55")} onBlur={e => (e.target.style.borderColor = T.border2)} />
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 7 }}>Note (optional)</div>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Any additional info…" style={fieldStyle}
                  onFocus={e => (e.target.style.borderColor = T.accent + "55")} onBlur={e => (e.target.style.borderColor = T.border2)} />
              </div>

              {/* Amount summary */}
              <div style={{
                padding: "14px 18px", borderRadius: 16, marginBottom: 18,
                background: `${T.success}08`, border: `1px solid ${T.success}22`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, color: T.muted }}>Payout amount</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: T.success, letterSpacing: -1 }}>{fmt$(pending)}</span>
              </div>

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 12,
                  background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.18)",
                  fontSize: 12, color: T.danger, marginBottom: 14,
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={requesting}
                style={{
                  width: "100%", padding: "15px", borderRadius: 16, border: "none",
                  background: requesting ? T.bg3 : `linear-gradient(135deg, ${T.success}, #059669)`,
                  color: requesting ? T.muted : "#001a0d",
                  fontWeight: 900, fontSize: 15, cursor: requesting ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "all .2s",
                  boxShadow: requesting ? "none" : `0 8px 28px ${T.success}30`,
                }}
              >
                {requesting ? "Submitting…" : "Submit Payout Request →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT EXPORT — BUG FIX: Added missing `{` opening brace for function body
// ═══════════════════════════════════════════════════════════════════════════
export default function AmbassadorView({ userId, userProfile }) {
  const isMobile = useIsMobile();
  const { profile, loading, error, reload } = useAmbassadorProfile(userId);
  const [justJoined, setJustJoined] = useState(false);

  const handleJoined = useCallback(() => {
    setJustJoined(true);
    reload();
  }, [reload]);

  // Global styles
  const globalStyles = `
    @keyframes ambSpin { to { transform: rotate(360deg); } }
    @keyframes ambFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    @keyframes ambToast { 0%{opacity:0;transform:translateY(16px)} 8%{opacity:1;transform:none} 88%{opacity:1;transform:none} 100%{opacity:0;transform:translateY(16px)} }
  `;

  if (loading) return (
    <div style={{ background: T.bg, minHeight: "100%", color: T.text }}>
      <style>{globalStyles}</style>
      <LoadingScreen />
    </div>
  );

  if (error) return (
    <div style={{ background: T.bg, minHeight: "100%", color: T.text }}>
      <style>{globalStyles}</style>
      <ErrorScreen error={error} reload={reload} />
    </div>
  );

  if (!profile) return (
    <div style={{ background: T.bg, minHeight: "100%", color: T.text }}>
      <style>{globalStyles}</style>
      <JoinScreen userProfile={userProfile} onJoined={handleJoined} isMobile={isMobile} />
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100%", color: T.text }}>
      <style>{globalStyles}</style>
      <Dashboard profile={profile} onReload={reload} isMobile={isMobile} />
    </div>
  );
}