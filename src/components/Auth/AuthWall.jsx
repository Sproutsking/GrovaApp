// ============================================================================
// src/components/Auth/AuthWall.jsx — v23 BORDER_SPIN_FIXED
// ============================================================================
//
// WHAT CHANGED FROM v22:
//   [FIX] Provider button border spin system overhauled:
//         - IDLE state:    border spins at 3s — always running (unchanged).
//         - SELECTED state: border spins at 3s (same speed, not faster).
//                           Conic stops are fully opaque & vivid so the ring
//                           is clearly visible. pb-inner bg lifts to #121212
//                           so the colored 1.5px ring contrasts against it.
//         - OTHER state:   border animation is set to `none` instantly via
//                           inline style override — no spinning on unchosen
//                           buttons at all. Opacity already 0.14 so they
//                           recede; killing the spin makes it cleaner.
//         - Speed stays 3s across idle & selected — the previous "1.2s fast
//           spin" feeling was wrong. The ring just needs to be more visible.
//
//   Everything else from v22 is UNCHANGED.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import authService from "../../services/auth/authService";
import PaywallGate from "./PaywallGate";
import { supabase } from "../../services/config/supabase";
import mediaUrlService from "../../services/shared/mediaUrlService";
import { AppLoader } from "../Shared/UnifiedLoader";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800;900&display=swap');

  .xv {
    --lime:  #a8e63d;
    --lime2: #c8f56a;
    --red:   #e05252;
    --text:  #dde8dd;
    --dim:   #2a3a2a;
    --dim2:  #1a2a1a;
  }

  /* ── Core keyframes ── */
  @keyframes S_letter {
    0%   { opacity:0; transform:translateY(-52px) scaleY(1.22); filter:blur(10px); }
    50%  { opacity:1; transform:translateY(5px) scaleY(0.96);   filter:blur(0); }
    75%  { transform:translateY(-2px) scaleY(1.01); }
    100% { opacity:1; transform:translateY(0) scaleY(1); }
  }
  @keyframes S_tagline { from{opacity:0;letter-spacing:18px} to{opacity:0.55;letter-spacing:6px} }
  @keyframes S_arc { 0%{stroke-dashoffset:251;opacity:0.1} 45%{stroke-dashoffset:35;opacity:1} 100%{stroke-dashoffset:251;opacity:0.1} }
  @keyframes S_scan   { from{top:-1px} to{top:100vh} }
  @keyframes S_glow   { 0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} }
  @keyframes XV_fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes XV_riseIn { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes XV_spin   { to{transform:rotate(360deg)} }
  @keyframes CK_ring   { from{stroke-dashoffset:289} to{stroke-dashoffset:0} }
  @keyframes CK_tick   { from{stroke-dashoffset:90;opacity:0} 8%{opacity:1} to{stroke-dashoffset:0;opacity:1} }
  @keyframes CK_disc   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes CK_pulse  { 0%{transform:scale(1);filter:drop-shadow(0 0 0px rgba(168,230,61,0))} 40%{transform:scale(1.12);filter:drop-shadow(0 0 28px rgba(168,230,61,.7))} 100%{transform:scale(1);filter:drop-shadow(0 0 8px rgba(168,230,61,.25))} }
  @keyframes CK_halo   { 0%{transform:translate(-50%,-50%) scale(.8);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
  @keyframes XK_ring   { from{stroke-dashoffset:289} to{stroke-dashoffset:0} }
  @keyframes XK_line   { from{stroke-dashoffset:80;opacity:0} 8%{opacity:1} to{stroke-dashoffset:0;opacity:1} }
  @keyframes XK_disc   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }

  /* ── Left panel ambient ── */
  @keyframes LP_orb1      { 0%,100%{transform:translate(0,0)} 50%{transform:translate(22px,-18px)} }
  @keyframes LP_orb2      { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-18px,14px)} }
  @keyframes LP_pulse     { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.55)} }
  @keyframes LP_shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes LP_rise      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes LP_nodePulse { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes LP_dash      { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
  @keyframes LP_linePulse { 0%,100%{stroke-opacity:.22} 50%{stroke-opacity:.7} }

  /* ── Provider button border — single rotation speed used everywhere ── */
  @keyframes PB_rotate {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(360deg); }
  }

  /* ── Selected state: subtle breathe on the inner face ── */
  @keyframes PB_selected_breathe {
    0%,100% { background: #121212; }
    50%     { background: #161616; }
  }

  .xv, .xv * { box-sizing:border-box; }
  .xv { font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }

  /* ── Left panel value rows ── */
  .lp-value-row {
    display:flex;align-items:flex-start;gap:10px;
    padding:10px 12px;
    background:rgba(255,255,255,.018);
    border:1px solid rgba(168,230,61,.07);
    border-radius:11px;
    transition:border-color .22s,background .22s,transform .2s;
    cursor:default;
  }
  .lp-value-row:hover {
    border-color:rgba(168,230,61,.18);
    background:rgba(168,230,61,.025);
    transform:translateX(3px);
  }
  .lp-icon-box {
    width:30px;height:30px;border-radius:8px;
    background:rgba(168,230,61,.07);border:1px solid rgba(168,230,61,.12);
    display:flex;align-items:center;justify-content:center;
    font-size:14px;flex-shrink:0;
    transition:background .22s,border-color .22s;
  }
  .lp-value-row:hover .lp-icon-box {
    background:rgba(168,230,61,.13);border-color:rgba(168,230,61,.26);
  }
  .lp-stat-box {
    flex:1;background:rgba(255,255,255,.016);border:1px solid rgba(168,230,61,.08);
    border-radius:9px;padding:8px 10px;text-align:center;
    position:relative;overflow:hidden;
    transition:border-color .22s,transform .2s;
  }
  .lp-stat-box::before {
    content:"";position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(168,230,61,.14),transparent);
  }
  .lp-stat-box:hover { border-color:rgba(168,230,61,.2); transform:translateY(-2px); }
  .lp-shimmer {
    background:linear-gradient(90deg,#a8e63d 0%,#d4fc72 25%,#5a9a10 50%,#d4fc72 75%,#a8e63d 100%);
    background-size:200% auto;
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    animation:LP_shimmer 4s linear infinite;
  }
  .lp-feat-card {
    background:rgba(255,255,255,.014);
    border:1px solid rgba(168,230,61,.065);
    border-radius:10px;
    padding:10px 10px;
    transition:border-color .2s,background .2s;
    cursor:default;
  }
  .lp-feat-card:hover {
    border-color:rgba(168,230,61,.15);
    background:rgba(168,230,61,.018);
  }

  /* ── Provider button wrap ── */
  .pb-wrap {
    position: relative;
    border-radius: 14px;
    margin-bottom: 8px;
    cursor: pointer;
    overflow: hidden;
    padding: 1.5px;
  }

  /*
   * Spinning conic layer.
   * The animation property is controlled entirely via inline style on the
   * element — this lets React switch it instantly without a CSS class toggle
   * delay. The keyframe just defines the rotation; timing lives inline.
   */
  .pb-border {
    position: absolute;
    width: 300%;
    height: 300%;
    top: 50%;
    left: 50%;
    pointer-events: none;
    z-index: 0;
  }

  /* Inner face */
  .pb-inner {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 40px 1fr 24px;
    align-items: center;
    gap: 0;
    width: 100%;
    padding: 13px 16px;
    border-radius: 12.5px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    background: #0d0d0d;
    border: none;
    outline: none;
    transition: background .18s;
  }

  .pb-icon  { display:flex;align-items:center;justify-content:center; }
  .pb-label {
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    transition: color .18s;
  }
  .pb-arrow {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    transition: opacity .18s, transform .18s, color .18s;
  }
  .pb-wrap:hover .pb-arrow {
    opacity: 1 !important;
    transform: translateX(3px);
  }

  /* ── Avatar stack ── */
  .lp-avatar {
    width:26px;height:26px;border-radius:50%;
    border:2px solid #020804;
    display:flex;align-items:center;justify-content:center;
    font-size:9px;font-weight:800;color:#040a00;
    flex-shrink:0;overflow:hidden;
    transition:transform .2s;
  }
  .lp-avatar:hover { transform:translateY(-3px); z-index:10!important; }

  /* ─────────────────── MOBILE ─────────────────── */
  @media (max-width:768px) {
    .xv-left  { display:none !important; }
    .xv-right {
      flex:1 1 100% !important;
      padding:0 !important;
      align-items:center !important;
      justify-content:center !important;
      border-left:none !important;
      min-height:100dvh;
    }
    .xv-right-inner {
      width:100% !important;
      max-width:100% !important;
      padding:24px 24px !important;
      display:flex !important;
      flex-direction:column !important;
      justify-content:center !important;
      align-items:center !important;
    }
  }

  /* ── PaywallGate mobile overrides ── */
  @media (max-width:768px) {
    .xv-brand      { display:none !important; }
    .xv-paywall-side   { width:100% !important; }
    .xv-paywall-scroll {
      padding:14px 16px 44px !important;
      max-width:100% !important;
    }
    .xv-signout-bar {
      margin-bottom:12px !important;
      padding:8px 10px !important;
      border-radius:10px !important;
    }
    .xv-card {
      border-radius:12px !important;
    }
    .xv-feat-grid {
      gap:5px !important;
    }
    .xv-feat-card {
      padding:8px 7px !important;
      border-radius:9px !important;
    }
    .xv-btn-lime,
    .xv-btn-wl,
    .xv-btn-vip {
      padding:14px 16px !important;
      font-size:14px !important;
      border-radius:12px !important;
    }
  }
`;

// ─── Shared atoms ─────────────────────────────────────────────────────────────
const Grain = () => (
  <svg
    aria-hidden
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 0,
      opacity: 0.03,
    }}
  >
    <filter id="xvg2">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.68"
        numOctaves="4"
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#xvg2)" />
  </svg>
);

const Corners = ({ color = "rgba(168,230,61,0.26)" }) => (
  <div
    aria-hidden
    style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
  >
    {[
      { s: { top: 14, left: 14 }, p: "M0 24 L0 0 L24 0" },
      { s: { top: 14, right: 14 }, p: "M0 0 L24 0 L24 24" },
      { s: { bottom: 14, left: 14 }, p: "M0 0 L0 24 L24 24" },
      { s: { bottom: 14, right: 14 }, p: "M0 24 L24 24 L24 0" },
    ].map((c, i) => (
      <svg
        key={i}
        style={{ position: "absolute", ...c.s, width: 24, height: 24 }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d={c.p} stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ))}
  </div>
);

const ScanLine = () => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      background:
        "linear-gradient(90deg,transparent,rgba(168,230,61,.04),rgba(168,230,61,.09),rgba(168,230,61,.04),transparent)",
      animation: "S_scan 9s linear infinite",
      pointerEvents: "none",
      zIndex: 1,
    }}
  />
);

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────
export function SuccessScreen({ provider }) {
  const name = provider ? provider[0].toUpperCase() + provider.slice(1) : "";
  const R = 46,
    C = 2 * Math.PI * R;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        overflow: "hidden",
        animation: "XV_fadeIn .3s ease",
      }}
      className="xv"
    >
      <style>{CSS}</style>
      <Grain />
      <Corners />
      <ScanLine />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(168,230,61,.09) 0%,transparent 65%)",
          animation: "S_glow 5s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", marginBottom: 44, zIndex: 2 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: "1.5px solid rgba(168,230,61,.35)",
              animation: `CK_halo 2s ease ${1.4 + i * 0.55}s infinite`,
              pointerEvents: "none",
            }}
          />
        ))}
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
          style={{
            animation: "CK_pulse .55s ease 1.25s 1 both",
            position: "relative",
            zIndex: 2,
          }}
        >
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="rgba(168,230,61,.08)"
            style={{
              animation: "CK_disc .35s cubic-bezier(.34,1.56,.64,1) .78s both",
              opacity: 0,
              transformOrigin: "60px 60px",
            }}
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            stroke="rgba(168,230,61,.07)"
            strokeWidth="2"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            stroke="var(--lime)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C}
            style={{
              animation: `CK_ring .72s cubic-bezier(.4,0,.2,1) .1s forwards`,
              transformOrigin: "60px 60px",
              transform: "rotate(-90deg)",
            }}
          />
          <path
            d="M37 60 L52 75 L83 40"
            stroke="var(--lime2)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="90"
            strokeDashoffset="90"
            style={{
              animation: "CK_tick .42s cubic-bezier(.4,0,.2,1) .82s forwards",
              opacity: 0,
            }}
          />
        </svg>
      </div>
      <div
        style={{
          textAlign: "center",
          zIndex: 2,
          maxWidth: 300,
          padding: "0 24px",
          animation: "XV_riseIn .6s ease 1.4s both",
          opacity: 0,
        }}
      >
        <div
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: "clamp(28px,5vw,36px)",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.5px",
            lineHeight: 1.2,
            marginBottom: 10,
          }}
        >
          You're in.
        </div>
        <div style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.8 }}>
          Signed in via{" "}
          <span style={{ color: "var(--lime)", fontWeight: 600 }}>{name}</span>
          <br />
          Taking you to Xeevia…
        </div>
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 28,
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: 11,
          letterSpacing: "8px",
          color: "#111a11",
          animation: "XV_fadeIn 1s ease 2s both",
          opacity: 0,
        }}
      >
        XEEVIA
      </div>
    </div>
  );
}

// ─── DECLINED SCREEN ──────────────────────────────────────────────────────────
export function DeclinedScreen({ message, onRetry }) {
  const R = 46,
    C = 2 * Math.PI * R;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        overflow: "hidden",
        padding: "0 24px",
        animation: "XV_fadeIn .3s ease",
      }}
      className="xv"
    >
      <style>{CSS}</style>
      <Grain />
      <Corners color="rgba(224,82,82,.28)" />
      <ScanLine />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "38%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(224,82,82,.07) 0%,transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", marginBottom: 44, zIndex: 2 }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
        >
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="rgba(224,82,82,.07)"
            style={{
              animation: "XK_disc .35s cubic-bezier(.34,1.56,.64,1) .76s both",
              opacity: 0,
              transformOrigin: "60px 60px",
            }}
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            stroke="rgba(224,82,82,.07)"
            strokeWidth="2"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r={R}
            stroke="var(--red)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C}
            style={{
              animation: `XK_ring .68s cubic-bezier(.4,0,.2,1) .1s forwards`,
              transformOrigin: "60px 60px",
              transform: "rotate(-90deg)",
            }}
          />
          <path
            d="M38 38 L82 82"
            stroke="var(--red)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="80"
            strokeDashoffset="80"
            style={{ animation: "XK_line .26s ease .8s forwards", opacity: 0 }}
          />
          <path
            d="M82 38 L38 82"
            stroke="var(--red)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="80"
            strokeDashoffset="80"
            style={{ animation: "XK_line .26s ease .98s forwards", opacity: 0 }}
          />
        </svg>
      </div>
      <div
        style={{
          textAlign: "center",
          zIndex: 2,
          maxWidth: 300,
          animation: "XV_riseIn .55s ease 1.2s both",
          opacity: 0,
        }}
      >
        <div
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: "clamp(24px,4vw,30px)",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.3px",
            marginBottom: 10,
          }}
        >
          Sign-in cancelled
        </div>
        <p
          style={{
            fontSize: 14,
            color: "#4a2a2a",
            lineHeight: 1.8,
            marginBottom: 32,
          }}
        >
          {message || "The sign-in was cancelled or couldn't be completed."}
        </p>
        <button
          onClick={onRetry}
          style={{
            width: "100%",
            maxWidth: 260,
            padding: "15px 0",
            borderRadius: 100,
            border: "none",
            background: "rgba(224,82,82,.12)",
            color: "#e05252",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif",
            letterSpacing: "0.2px",
            transition: "background .2s",
            outline: "1.5px solid rgba(224,82,82,.25)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(224,82,82,.2)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(224,82,82,.12)")
          }
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// ─── LEFT PANEL ───────────────────────────────────────────────────────────────
function LeftPanel() {
  const [memberCount, setMemberCount] = useState(null);
  const [epGrant, setEpGrant] = useState(300);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          if (data.value.member_count != null)
            setMemberCount(data.value.member_count);
          if (data.value.ep_grant != null) setEpGrant(data.value.ep_grant);
        }
      })
      .catch(() => {});

    supabase
      .from("profiles")
      .select("id,full_name,avatar_id")
      .is("deleted_at", null)
      .not("full_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data?.length) setRecentUsers(data);
      })
      .catch(() => {});
  }, []);

  const fmtCount = (n) => {
    if (n == null) return null;
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString();
  };

  function buildAvatarUrl(avatarId) {
    try {
      if (!avatarId) return null;
      // prefer centralized mediaUrlService which knows cloud/storage rules
      const url = mediaUrlService.getAvatarUrl(avatarId, 80);
      if (url) return url;
    } catch (e) {}
    if (avatarId && avatarId.startsWith("http")) return avatarId;
    return null;
  }

  const ACCENT_COLORS = ["#a8e63d", "#84cc16", "#65a30d", "#d4fc72"];

  const VALUE_PROPS = [
    {
      icon: "⚡",
      title: "Engagement Has Weight",
      body: "Every action costs something and means something. No bots. No fake reach.",
    },
    {
      icon: "💸",
      title: "Creators Keep 84%",
      body: "84% of every EP tip lands directly in your wallet — not the platform's.",
    },
    {
      icon: "⛓",
      title: "XRC Protocol",
      body: "Every like, post and transaction is cryptographically recorded. Yours permanently.",
    },
  ];

  const FEATURES = [
    {
      n: "01",
      icon: "🔒",
      title: "Private & Yours",
      sub: "Your data, your rules",
    },
    {
      n: "02",
      icon: "⚡",
      title: `${epGrant} EP on join`,
      sub: "Instant reward",
    },
    { n: "03", icon: "♾️", title: "Lifetime access", sub: "No renewals ever" },
  ];

  const ECO_STATS = [
    { value: "$1 = 100 EP", label: "Fixed EP Rate", note: "stable" },
    { value: "84%", label: "Creator Share", note: "of every tip" },
    { value: "1T XEV", label: "Token Supply", note: "hard cap" },
  ];

  const NODE_PATHS = [
    "M110,160 L275,255",
    "M275,255 L450,185",
    "M275,255 L295,415",
    "M295,415 L155,475",
    "M295,415 L465,495",
    "M450,185 L530,305",
    "M530,305 L465,495",
    "M155,475 L75,580",
    "M465,495 L545,595",
    "M110,160 L75,75",
    "M450,185 L530,95",
    "M295,415 L370,530",
    "M275,255 L160,330",
    "M160,330 L75,580",
  ];
  const NODE_CIRCLES = [
    [110, 160, 5.5],
    [275, 255, 8],
    [450, 185, 5],
    [295, 415, 7],
    [155, 475, 4.5],
    [465, 495, 6],
    [530, 305, 5],
    [75, 580, 4],
    [545, 595, 4],
    [75, 75, 4.5],
    [530, 95, 4.5],
    [370, 530, 5],
    [160, 330, 5],
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "24px 30px 20px",
        background: "#020804",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -90,
          left: -80,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(168,230,61,.09) 0%,transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
          animation: "LP_orb1 20s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: -120,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(168,230,61,.055) 0%,transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
          animation: "LP_orb2 26s ease-in-out infinite",
        }}
      />

      <svg
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.45,
          pointerEvents: "none",
          zIndex: 0,
        }}
        viewBox="0 0 600 700"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="lpng" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a8e63d" stopOpacity="1" />
            <stop offset="100%" stopColor="#a8e63d" stopOpacity="0" />
          </radialGradient>
          <filter id="lpglow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {NODE_PATHS.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="rgba(168,230,61,.5)"
            strokeWidth="1.1"
            fill="none"
            strokeDasharray="7 13"
            style={{
              animation: `LP_dash ${3.5 + i * 0.3}s linear infinite, LP_linePulse ${2 + i * 0.2}s ease-in-out infinite`,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
        {NODE_CIRCLES.map(([cx, cy, r], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="url(#lpng)"
            filter="url(#lpglow)"
            style={{
              animation: `LP_nodePulse ${2.2 + i * 0.38}s ease-in-out infinite`,
              animationDelay: `${i * 0.21}s`,
            }}
          />
        ))}
      </svg>

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.011,
          backgroundImage:
            "radial-gradient(rgba(168,230,61,.9) 1px,transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          top: "8%",
          bottom: "8%",
          width: 1,
          background:
            "linear-gradient(to bottom,transparent,rgba(168,230,61,.08) 30%,rgba(168,230,61,.08) 70%,transparent)",
          zIndex: 2,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
            animation: "LP_rise .5s ease both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "linear-gradient(135deg,#a8e63d,#4d7c0f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(168,230,61,.22)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 17,
                fontWeight: 900,
                color: "#040a00",
                lineHeight: 1,
              }}
            >
              X
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 17,
                letterSpacing: "6px",
                color: "#4a7a1a",
                lineHeight: 1,
              }}
            >
              XEEVIA
            </div>
            <div
              style={{
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#2a4a1a",
                marginTop: 1,
              }}
            >
              The First True SocialFi Economy
            </div>
          </div>
        </div>

        <div
          style={{
            marginBottom: 10,
            animation: "LP_rise .55s ease .08s both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          <h1
            style={{
              fontFamily: "'Syne',sans-serif",
              fontSize: "clamp(24px,2.8vw,38px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-1.6px",
              margin: "0 0 10px",
              color: "#ffffff",
              textShadow: "0 0 20px rgba(168, 230, 61, 0.25)",
            }}
          >
            Your social life,
            <br />
            <span className="lp-shimmer">renewed.</span>
          </h1>
          <p
            style={{
              fontSize: 12.5,
              color: "#d4e1d4",
              lineHeight: 1.8,
              maxWidth: 310,
              margin: 0,
              fontWeight: 500,
            }}
          >
            A private social experience built for people who want more — real
            connections, genuine community, and a platform that actually belongs
            to you.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(168,230,61,.042)",
            border: "1px solid rgba(168,230,61,.12)",
            borderRadius: 100,
            padding: "4px 11px",
            marginBottom: 11,
            alignSelf: "flex-start",
            animation: "LP_rise .5s ease .16s both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#a8e63d",
              flexShrink: 0,
              boxShadow: "0 0 6px rgba(168,230,61,.7)",
              animation: "LP_pulse 2s ease-in-out infinite",
            }}
          />
          {memberCount != null ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#8abe3a" }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 11 }}>
                {fmtCount(memberCount)}
              </span>{" "}
              members in the economy
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4a6a2a" }}>
              Join the economy today
            </span>
          )}
          <span
            style={{
              fontSize: 7.5,
              fontWeight: 800,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#2a4a1a",
            }}
          >
            LIVE
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 6,
            marginBottom: 8,
            animation: "LP_rise .5s ease .2s both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          {FEATURES.map(({ n, icon, title, sub }) => (
            <div key={n} className="lp-feat-card">
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#a8e63d",
                  fontFamily: "'Syne',sans-serif",
                  marginBottom: 2,
                  textShadow: "0 0 8px rgba(168, 230, 61, 0.3)",
                }}
              >
                {n}
              </div>
              <div style={{ fontSize: 16, marginBottom: 3 }}>{icon}</div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#d4e1d4",
                  lineHeight: 1.25,
                  marginBottom: 2,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  fontSize: 7.5,
                  fontWeight: 500,
                  color: "#8abe3a",
                  letterSpacing: "0.5px",
                }}
              >
                {sub}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flex: 1,
            minHeight: 0,
            animation: "LP_rise .5s ease .26s both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          {VALUE_PROPS.map(({ icon, title, body }) => (
            <div
              key={title}
              className="lp-value-row"
              style={{ flex: 1, minHeight: 0 }}
            >
              <div className="lp-icon-box">{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: "#c8f56a",
                    marginBottom: 3,
                    lineHeight: 1.3,
                    textShadow: "0 0 6px rgba(168, 230, 61, 0.2)",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{ fontSize: 10, color: "#b8d8a0", lineHeight: 1.7, fontWeight: 500 }}
                >
                  {body}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 6,
            marginTop: 8,
            animation: "LP_rise .5s ease .32s both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          {ECO_STATS.map(({ value, label, note }) => (
            <div key={label} className="lp-stat-box">
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: "clamp(10px,1vw,13px)",
                  fontWeight: 900,
                  color: "#d4fc72",
                  letterSpacing: "-0.3px",
                  lineHeight: 1,
                  marginBottom: 2,
                  textShadow: "0 0 8px rgba(168, 230, 61, 0.25)",
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  color: "#a8d86a",
                  textTransform: "uppercase",
                  letterSpacing: "0.7px",
                  marginBottom: 1,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 7.5, color: "#5a7a4a", fontWeight: 500 }}>{note}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(168,230,61,.055)",
            paddingTop: 9,
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            animation: "LP_rise .5s ease .38s both",
            animationFillMode: "forwards",
            opacity: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              {(recentUsers.length > 0
                ? recentUsers
                : [null, null, null, null]
              ).map((u, i) => {
                const url = u ? buildAvatarUrl(u.avatar_id) : null;
                const init = u
                  ? (u.full_name || "U").charAt(0).toUpperCase()
                  : "?";
                return (
                  <div
                    key={u?.id || i}
                    className="lp-avatar"
                    style={{
                      marginLeft: i > 0 ? -8 : 0,
                      zIndex: 4 - i,
                      background: url ? "transparent" : ACCENT_COLORS[i % 4],
                      position: "relative",
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentNode.style.background =
                            ACCENT_COLORS[i % 4];
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          color: "#040a00",
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                      >
                        {init}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#90c040",
                  letterSpacing: "-0.4px",
                  fontFamily: "'Syne',sans-serif",
                  lineHeight: 1,
                }}
              >
                {memberCount != null ? fmtCount(memberCount) : "—"}
              </div>
              <div style={{ fontSize: 9, color: "#4a6a3a", fontWeight: 600 }}>
                members joined
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 3,
              flexShrink: 0,
            }}
          >
            {[
              ["⛓", "Web3"],
              ["🏦", "Paystack"],
              ["🔐", "Encrypted"],
            ].map(([ic, lb]) => (
              <div
                key={lb}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 7.5,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "#2a4a1a",
                  background: "rgba(168,230,61,.03)",
                  border: "1px solid rgba(168,230,61,.08)",
                  borderRadius: 100,
                  padding: "2.5px 7px",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{ic}</span>
                <span>{lb}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Provider SVG icons ───────────────────────────────────────────────────────
const GI = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);
const XII = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#ccc" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const FbI = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
const DcI = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
  </svg>
);

// ─── Provider button ──────────────────────────────────────────────────────────
//
// STATE MACHINE (driven by `state` prop from LoginView):
//
//   "idle"     → border spins at 3s, normal opacity, clickable
//   "selected" → border spins at 3s (same speed — feels intentional, not frantic)
//                conic stops are fully opaque so the 1.5px ring is vivid
//                pb-inner background lifts to #121212 for contrast
//                icon swaps to spinner, label shows "Opening X…"
//   "other"    → border animation: none (instantly killed via inline style)
//                opacity drops to 0.14, pointer-events: none
//
// Key insight: the animation speed does NOT change on selection. What changes
// is (a) conic stop opacity → fully vivid, (b) inner bg → slightly lighter,
// (c) "other" buttons lose their animation entirely so they go completely still.
//
function ProviderBtn({ icon, label, g1, g2, g3, delay, state, onClick }) {
  const [vis, setVis] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVis(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const sel   = state === "selected";
  const other = state === "other";
  const short = label.replace("Continue with ", "");

  // ── Conic gradient ──
  // IDLE:     semi-transparent stops — subtle, ambient ring feel
  // SELECTED: fully opaque stops — ring pops clearly on the button edge
  // OTHER:    doesn't matter (animation is none), but keep it defined
  const conicBg = sel
    ? `conic-gradient(${g1}, ${g2}, ${g3}, ${g2}, ${g1})`
    : `conic-gradient(
        ${g1}88, ${g2}66, ${g3}44,
        ${g2}66, ${g1}88
      )`;

  // ── Border animation ──
  // selected → same 3s speed, fully vivid conic (see above)
  // other    → "none" — kills the spin instantly the moment another is clicked
  // idle     → 3s spin as before
  const borderAnim = other
    ? "none"
    : "PB_rotate 3s linear infinite";

  // ── Inner face background ──
  // selected → #121212 so the colored 1.5px ring contrasts against it
  // hovered  → #131313 (unchanged from v22)
  // default  → #0d0d0d
  const innerBg = sel
    ? "#121212"
    : hovered
      ? "#131313"
      : "#0d0d0d";

  return (
    <div
      className="pb-wrap"
      style={{
        opacity: vis ? (other ? 0.14 : 1) : 0,
        transform: vis ? "translateY(0)" : "translateY(12px)",
        transition: `opacity .5s ease ${delay}ms, transform .5s cubic-bezier(.23,1,.32,1) ${delay}ms`,
        pointerEvents: other ? "none" : "auto",
      }}
      onMouseEnter={() => !sel && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Spinning conic border ── */}
      <div
        className="pb-border"
        aria-hidden
        style={{
          background: conicBg,
          animation: borderAnim,
        }}
      />

      {/* ── Inner button face ── */}
      <button
        className="pb-inner"
        onClick={!sel && !other ? onClick : undefined}
        disabled={other}
        style={{ background: innerBg }}
      >
        {/* Icon */}
        <span className="pb-icon">
          {sel ? (
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,.15)",
                borderTopColor: "#fff",
                animation: "XV_spin .7s linear infinite",
              }}
            />
          ) : (
            icon
          )}
        </span>

        {/* Label */}
        <span
          className="pb-label"
          style={{
            color: sel ? "#ffffff" : hovered ? "#f0f0f0" : "#c0c0c0",
          }}
        >
          {sel ? `Opening ${short}…` : label}
        </span>

        {/* Arrow / indicator */}
        <span
          className="pb-arrow"
          style={{
            opacity: sel ? 1 : hovered ? 1 : 0.4,
            transform:
              hovered && !sel ? "translateX(3px)" : "translateX(0)",
            color: hovered && !sel ? "#a8e63d" : "#666",
          }}
        >
          {sel ? (
            /* Pulsing lime dot — confirms something is happening */
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#a8e63d",
                boxShadow: "0 0 6px rgba(168,230,61,.8)",
                animation: "LP_pulse 1.4s ease-in-out infinite",
              }}
            />
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
            >
              <path
                d="M2 6h8M7 4l3 2-3 2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

// ─── LOGIN VIEW ───────────────────────────────────────────────────────────────
function LoginView() {
  const [status, setStatus]   = useState("idle");
  const [provider, setProvider] = useState(null);
  const [errMsg, setErrMsg]   = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const go = useCallback(
    (p) => {
      if (status === "loading") return;
      setErrMsg("");
      setProvider(p);
      setStatus("loading");
      
      // Directly call provider without awaiting — no intermediate screen
      authService.signInOAuth({ provider: p, usePopup: true }).catch((e) => {
        if (!mounted.current) return;
        const msg = e?.message || "";
        if (/cancel|denied|access_denied|closed|popup/i.test(msg)) {
          setErrMsg(msg);
          setStatus("declined");
        } else {
          setErrMsg(msg || "Sign-in failed. Please try again.");
          setStatus("idle");
          setProvider(null);
        }
      });
    },
    [status],
  );

  const retry = useCallback(() => {
    setStatus("idle");
    setProvider(null);
    setErrMsg("");
  }, []);

  if (status === "declined")
    return <DeclinedScreen message={errMsg} onRetry={retry} />;

  const PROVIDERS = [
    {
      id: "google",
      icon: <GI />,
      label: "Continue with Google",
      g1: "#4285F4",
      g2: "#34A853",
      g3: "#FBBC05",
      delay: 0,
    },
    {
      id: "x",
      icon: <XII />,
      label: "Continue with X",
      g1: "#ffffff",
      g2: "#888888",
      g3: "#333333",
      delay: 65,
    },
    {
      id: "facebook",
      icon: <FbI />,
      label: "Continue with Facebook",
      g1: "#1877F2",
      g2: "#42a5f5",
      g3: "#0d5abf",
      delay: 130,
    },
    {
      id: "discord",
      icon: <DcI />,
      label: "Continue with Discord",
      g1: "#5865F2",
      g2: "#8b96ff",
      g3: "#3c4de0",
      delay: 195,
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      {/* ── Heading ── */}
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "'Bebas Neue',sans-serif",
            fontSize: "clamp(32px,4.5vw,48px)",
            letterSpacing: "2px",
            lineHeight: 1,
            color: "var(--text)",
            animation: "XV_riseIn .65s ease .05s both",
            opacity: 0,
          }}
        >
          WELCOME BACK
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#c8f56a",
            marginTop: 8,
            animation: "XV_riseIn .65s ease .13s both",
            opacity: 0,
            textShadow: "0 0 12px rgba(200,245,106,0.2)",
            letterSpacing: "0.3px",
          }}
        >
          Sign in to continue to Xeevia
        </div>
        <div
          style={{
            width: 28,
            height: 2,
            marginTop: 12,
            background:
              "linear-gradient(90deg,transparent,var(--lime),transparent)",
            margin: "12px auto 0",
            animation: "XV_fadeIn .8s ease .2s both",
            opacity: 0,
          }}
        />
      </div>

      {/* ── Inline error ── */}
      {errMsg && status === "idle" && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 13px",
            borderRadius: 10,
            border: "1px solid rgba(224,82,82,.2)",
            background: "rgba(224,82,82,.05)",
            color: "#a06060",
            fontSize: 12.5,
            display: "flex",
            gap: 8,
            animation: "XV_riseIn .3s ease",
          }}
        >
          <span>⚠</span>
          <span>{errMsg}</span>
        </div>
      )}

      {/* ── Provider buttons ── */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {PROVIDERS.map((p) => (
          <ProviderBtn
            key={p.id}
            icon={p.icon}
            label={p.label}
            g1={p.g1}
            g2={p.g2}
            g3={p.g3}
            delay={p.delay}
            state={
              status === "loading"
                ? provider === p.id
                  ? "selected"
                  : "other"
                : "idle"
            }
            onClick={() => go(p.id)}
          />
        ))}
      </div>

      {/* ── Terms ── */}
      <div
        style={{
          marginTop: 24,
          fontSize: 11,
          fontWeight: 500,
          color: "#8fb88f",
          lineHeight: 1.9,
          textAlign: "center",
          animation: "XV_fadeIn 1s ease .55s both",
          opacity: 0,
          letterSpacing: "0.2px",
        }}
      >
        By continuing you agree to our{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#d4fc72",
            fontWeight: 700,
            textDecoration: "none",
            cursor: "pointer",
            borderBottom: "1.5px solid rgba(212,252,114,0.4)",
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            textShadow: "0 0 8px rgba(212,252,114,0.15)",
          }}
          onMouseEnter={(e) => {
            e.target.style.borderBottomColor = "rgba(212,252,114,0.8)";
            e.target.style.textShadow = "0 0 16px rgba(212,252,114,0.3)";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderBottomColor = "rgba(212,252,114,0.4)";
            e.target.style.textShadow = "0 0 8px rgba(212,252,114,0.15)";
          }}
        >
          Terms
        </a>
        {" & "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#d4fc72",
            fontWeight: 700,
            textDecoration: "none",
            cursor: "pointer",
            borderBottom: "1.5px solid rgba(212,252,114,0.4)",
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            textShadow: "0 0 8px rgba(212,252,114,0.15)",
          }}
          onMouseEnter={(e) => {
            e.target.style.borderBottomColor = "rgba(212,252,114,0.8)";
            e.target.style.textShadow = "0 0 16px rgba(212,252,114,0.3)";
          }}
          onMouseLeave={(e) => {
            e.target.style.borderBottomColor = "rgba(212,252,114,0.4)";
            e.target.style.textShadow = "0 0 8px rgba(212,252,114,0.15)";
          }}
        >
          Privacy
        </a>
      </div>
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
export function Splash({ message = "Initializing Xeevia..." }) {
  return <AppLoader message={message} />;
}

// ─── AUTH WALL — root export ──────────────────────────────────────────────────
export default function AuthWall({ paywall = false }) {
  if (paywall) return <PaywallGate />;

  return (
    <div
      style={{
        height: "100dvh",
        width: "100%",
        background: "var(--bg)",
        display: "flex",
        alignItems: "stretch",
        position: "relative",
        overflow: "hidden",
      }}
      className="xv"
    >
      <style>{CSS}</style>
      <Grain />
      <Corners />
      <ScanLine />

      {/* ── Left panel — 46% width, full height ── */}
      <div
        className="xv-left"
        style={{
          flex: "0 0 46%",
          height: "100dvh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <LeftPanel />
      </div>

      {/* ── Right panel — perfectly centered both axes ── */}
      <div
        className="xv-right"
        style={{
          flex: "1 1 54%",
          height: "100dvh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
          borderLeft: "1px solid rgba(168,230,61,.03)",
        }}
      >
        <div
          className="xv-right-inner"
          style={{
            width: "100%",
            maxWidth: 380,
            padding: "0 32px",
          }}
        >
          <LoginView />
        </div>
      </div>
    </div>
  );
}