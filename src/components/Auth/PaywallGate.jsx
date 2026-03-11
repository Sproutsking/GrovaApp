// src/components/Auth/PaywallGate.jsx — v39
// ============================================================================
// BASE: v38 FAST-SYNC — preserved exactly.
// SURGICAL FIXES:
//  [1] handleFreeActivate — passes { code, userId } to activateFreeCode.
//      Inline "Activate Free Access" button visible when isFree OR
//      user is in invite.metadata.whitelisted_user_ids.
//  [2] Slide auto-rotation — userStoppedRef boolean: slides rotate freely
//      on load, stop only when user manually clicks a dot or applies a code.
//      URL ?ref= auto-selects slide without killing rotation.
//  [3] Live data sync — Realtime platform_settings subscription also calls
//      loadStats() so member_count stays live when InviteSection updates.
//  [4] Waitlist count immediate update — after joining waitlist, increments
//      waitlistCount locally without waiting for DB poll.
//  [5] Waitlist-approved users — isUserWhitelistedFromWaitlist() checks
//      invite.metadata.whitelisted_user_ids. If user is in array, shows
//      "🎉 You've been approved!" banner + free activation CTA.
//  [6] App domain — APP_URL = process.env.REACT_APP_APP_URL || window.location.origin.
//      No more localhost in production share links.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../../services/config/supabase";
import {
  verifyWeb3Payment,
  activateFreeCode,
  clearIdempotencyKey,
} from "../../services/auth/paymentService";
import {
  fetchPaywallConfig,
  fetchLiveStats,
  fetchInviteCodeDetails,
  isPaidProfile,
} from "../../services/auth/paywallDataService";
import PaywallPayment from "./PaywallPayment";

// ── [6] App URL ───────────────────────────────────────────────────────────────
const APP_URL =
  process.env.REACT_APP_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  typeof n === "number" && !isNaN(n)
    ? n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(2)
    : "—";
const mono = { fontFamily: "'JetBrains Mono', monospace" };

function buildAvatarUrl(avatarId) {
  if (!avatarId) return null;
  if (avatarId.startsWith("http")) return avatarId;
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL ?? "";
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${avatarId}?width=80&height=80&resize=cover&format=webp`;
}

function safePrice(value, fallback = 4) {
  const n = Number(value);
  return n > 0 ? n : fallback;
}

function resolvePrice(invite, fallback = 4) {
  const fb = safePrice(fallback, 4);
  if (!invite) return fb;
  const po = invite.price_override;
  if (po != null && !isNaN(Number(po))) return Number(po);
  const meta = invite?.metadata ?? {};
  if (meta.entry_price_cents != null && !isNaN(Number(meta.entry_price_cents)))
    return Number(meta.entry_price_cents) / 100;
  const ep = invite.entry_price;
  if (ep != null && !isNaN(Number(ep))) return Number(ep);
  return fb;
}

// [5] Checks invite.metadata.whitelisted_user_ids for the current userId
function isUserWhitelistedFromWaitlist(invite, userId) {
  if (!invite || !userId) return false;
  const ids = invite?.metadata?.whitelisted_user_ids ?? [];
  return ids.includes(userId);
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&family=Syne:wght@700;800;900&display=swap');
  @keyframes xvSpin    { to { transform: rotate(360deg); } }
  @keyframes xvFadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes xvFadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes xvPop     { 0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)} }
  @keyframes xvGlow    { 0%,100%{box-shadow:0 0 10px rgba(163,230,53,.15)}50%{box-shadow:0 0 24px rgba(163,230,53,.45)} }
  @keyframes xvSlide   { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes xvModalIn { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
  @keyframes xvNodeP   { 0%,100%{opacity:.5;r:3} 50%{opacity:1;r:6} }
  @keyframes xvDash    { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
  @keyframes xvShimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes xvLinePulse { 0%,100%{stroke-opacity:.3} 50%{stroke-opacity:.9} }
  @keyframes xvBounce  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
  * { box-sizing:border-box; }
  .xv { font-family:'Inter',-apple-system,sans-serif; -webkit-font-smoothing:antialiased; }
  .xv ::-webkit-scrollbar { width:3px }
  .xv ::-webkit-scrollbar-thumb { background:#252525; border-radius:2px }
  .xv-brand { width:50%; flex-shrink:0; background:#020302; border-right:1px solid #141814; display:flex; flex-direction:column; justify-content:space-between; padding:52px 54px; position:relative; overflow:hidden; }
  .xv-brand-noise { position:absolute; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events:none; z-index:0; opacity:.6; }
  .xv-brand-gradient { position:absolute; bottom:-120px; left:-80px; width:500px; height:500px; border-radius:50%; background:radial-gradient(circle,rgba(163,230,53,.10) 0%,transparent 65%); pointer-events:none; z-index:0; }
  .xv-brand-gradient-top { position:absolute; top:-100px; right:-60px; width:380px; height:380px; border-radius:50%; background:radial-gradient(circle,rgba(163,230,53,.07) 0%,transparent 65%); pointer-events:none; z-index:0; }
  .xv-feat-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:32px; }
  .xv-feat-card { background:#0d0f0d; border:1px solid #1e221e; border-radius:12px; padding:12px 13px; transition:border-color .2s; }
  .xv-feat-card:hover { border-color:#2e382e; }
  .xv-avatar-stack { display:flex; align-items:center; }
  .xv-avatar { width:32px; height:32px; border-radius:50%; border:2px solid #020302; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#040a00; flex-shrink:0; transition:transform .2s; overflow:hidden; object-fit:cover; }
  .xv-avatar:hover { transform:translateY(-3px); z-index:10!important; }
  .xv-shimmer { background:linear-gradient(90deg,#a3e635 0%,#d4fc72 30%,#65a30d 50%,#d4fc72 70%,#a3e635 100%); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:xvShimmer 4s linear infinite; }
  .xv-tech-badge { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#4a5a4a; background:#0e110e; border:1px solid #1e221e; border-radius:20px; padding:4px 10px; }
  .xv-paywall-side { width:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#080808; }
  .xv-paywall-scroll { width:100%; max-width:510px; padding:36px 44px; overflow-y:auto; max-height:100vh; animation:xvSlide .45s ease; }
  .xv-btn-lime { width:100%; padding:16px 24px; border-radius:14px; border:none; background:linear-gradient(135deg,#a3e635 0%,#84cc16 55%,#65a30d 100%); color:#061000; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 4px 22px rgba(163,230,53,.35),inset 0 1px 0 rgba(255,255,255,.12); transition:transform .15s,box-shadow .15s,filter .15s; position:relative; overflow:hidden; }
  .xv-btn-lime::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(255,255,255,.1),transparent 50%); pointer-events:none; }
  .xv-btn-lime:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 32px rgba(163,230,53,.5),inset 0 1px 0 rgba(255,255,255,.14); }
  .xv-btn-lime:active:not(:disabled) { transform:none; }
  .xv-btn-lime:disabled { background:#1c1c1c; color:#333; cursor:not-allowed; box-shadow:none; filter:none; }
  .xv-btn-wl { width:100%; padding:16px 24px; border-radius:14px; border:none; background:linear-gradient(135deg,#38bdf8 0%,#0284c7 100%); color:#001a26; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 4px 22px rgba(56,189,248,.35); transition:transform .15s,box-shadow .15s; }
  .xv-btn-wl:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 32px rgba(56,189,248,.5); }
  .xv-btn-wl:disabled { background:#1c1c1c; color:#333; cursor:not-allowed; box-shadow:none; }
  .xv-btn-sol { width:100%; padding:16px 24px; border-radius:14px; border:none; background:linear-gradient(135deg,#9945ff 0%,#7c3aed 100%); color:#fff; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 4px 22px rgba(153,69,255,.35); transition:transform .15s,box-shadow .15s; }
  .xv-btn-sol:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 32px rgba(153,69,255,.5); }
  .xv-btn-sol:disabled { background:#1c1c1c; color:#333; cursor:not-allowed; box-shadow:none; }
  .xv-btn-ada { width:100%; padding:16px 24px; border-radius:14px; border:none; background:linear-gradient(135deg,#0033ad 0%,#0057ff 100%); color:#fff; font-weight:800; font-size:15px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 4px 22px rgba(0,51,173,.35); transition:transform .15s,box-shadow .15s; }
  .xv-btn-ada:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 32px rgba(0,51,173,.5); }
  .xv-btn-ada:disabled { background:#1c1c1c; color:#333; cursor:not-allowed; box-shadow:none; }
  .xv-btn-outline { width:100%; padding:12px 18px; border-radius:12px; border:1.5px solid rgba(163,230,53,.3); background:rgba(163,230,53,.05); color:#a3e635; font-weight:700; font-size:13px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px; transition:all .15s; }
  .xv-btn-outline:hover:not(:disabled) { border-color:rgba(163,230,53,.5); background:rgba(163,230,53,.09); transform:translateY(-1px); }
  .xv-btn-outline:disabled { opacity:.3; cursor:not-allowed; }
  .xv-btn-danger { width:100%; padding:12px; border-radius:11px; border:1.5px solid rgba(239,68,68,.28); background:rgba(239,68,68,.05); color:#f87171; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:7px; transition:all .15s; }
  .xv-btn-danger:hover { border-color:rgba(239,68,68,.45); background:rgba(239,68,68,.09); }
  .xv-seg { display:flex; background:#0e0e0e; border:1.5px solid #1e1e1e; border-radius:12px; padding:3px; gap:3px; margin-bottom:16px; }
  .xv-seg-btn { flex:1; padding:9px 8px; border-radius:9px; border:none; cursor:pointer; font-family:inherit; font-weight:700; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; transition:all .18s; background:transparent; color:#555; }
  .xv-seg-btn.on { background:#181818; color:#e8e8e8; box-shadow:0 1px 4px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04); border:1px solid #2a2a2a; }
  .xv-seg-btn.on.smart { color:#a3e635; }
  .xv-seg-btn.on.manual { color:#94a3b8; }
  .xv-seg-btn:not(.on):hover { color:#888; }
  .xv-tabs { display:flex; gap:3px; background:#0d0d0d; border:1px solid #1a1a1a; border-radius:14px; padding:4px; margin-bottom:20px; }
  .xv-tab { flex:1; padding:11px 6px; border-radius:10px; border:none; background:transparent; cursor:pointer; font-family:inherit; font-weight:700; font-size:12px; transition:all .18s; display:flex; align-items:center; justify-content:center; gap:5px; }
  .xv-tab.on { background:rgba(163,230,53,.1); color:#d4fc72; box-shadow:inset 0 0 0 1.5px rgba(163,230,53,.28); }
  .xv-tab.off { color:#555; }
  .xv-tab.off:hover { color:#888; background:rgba(255,255,255,.03); }
  .xv-tab.soon { color:#666; }
  .xv-tab.soon:hover { color:#999; background:rgba(245,158,11,.04); }
  .xv-select-wrap { position:relative; }
  .xv-select-wrap::after { content:'▾'; position:absolute; right:14px; top:50%; transform:translateY(-50%); color:#666; font-size:13px; pointer-events:none; }
  .xv-chain-sel { width:100%; appearance:none; -webkit-appearance:none; background:#141414; border:1.5px solid #252525; border-radius:12px; color:#e8e8e8; font-family:inherit; font-size:13px; font-weight:600; padding:12px 38px 12px 14px; cursor:pointer; outline:none; transition:border-color .15s; }
  .xv-chain-sel:focus { border-color:rgba(163,230,53,.4); }
  .xv-chain-sel option { background:#141414; color:#e8e8e8; }
  .xv-token-row { display:flex; gap:8px; }
  .xv-token-btn { flex:1; padding:10px; border-radius:10px; border:1.5px solid #222; background:#141414; color:#888; font-weight:700; font-size:13px; cursor:pointer; font-family:inherit; transition:all .15s; text-align:center; }
  .xv-token-btn.on { border-color:rgba(163,230,53,.45); background:rgba(163,230,53,.08); color:#d4fc72; }
  .xv-token-btn:not(.on):hover { border-color:#333; color:#aaa; }
  .xv-input { width:100%; background:#141414; border:1.5px solid #232323; border-radius:11px; padding:13px 15px; color:#f0f0f0; font-family:'JetBrains Mono',monospace; font-size:12px; transition:border-color .15s,box-shadow .15s; caret-color:#a3e635; outline:none; }
  .xv-input::placeholder { color:#444; }
  .xv-input:focus { border-color:rgba(163,230,53,.4); box-shadow:0 0 0 3px rgba(163,230,53,.06); }
  .xv-input.ok { border-color:rgba(163,230,53,.32); }
  .xv-input.err { border-color:rgba(239,68,68,.32); }
  .xv-card { background:#141414; border:1px solid #1e1e1e; border-radius:16px; padding:20px; }
  .xv-dot { width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; transition:all .3s; }
  .xv-dot.done { background:rgba(163,230,53,.16); border:1.5px solid #a3e635; color:#a3e635; }
  .xv-dot.act { background:rgba(163,230,53,.08); border:1.5px solid rgba(163,230,53,.45); color:#a3e635; animation:xvGlow 2s ease-in-out infinite; }
  .xv-dot.idle { background:#181818; border:1.5px solid #252525; color:#444; }
  .xv-hero-dots { display:flex; gap:6px; justify-content:center; margin-top:14px; }
  .xv-hero-dot { height:6px; border-radius:3px; transition:all .3s; cursor:pointer; background:#2a2a2a; }
  .xv-overlay { position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(8px); animation:xvFadeIn .2s; }
  .xv-modal { background:#0d0d0d; border:1px solid rgba(245,158,11,.25); border-radius:20px; padding:36px 32px; max-width:400px; width:100%; text-align:center; animation:xvModalIn .3s cubic-bezier(.23,1,.32,1); }
  .xv-modal-wl { background:#0a1418; border:1px solid rgba(56,189,248,.3); border-radius:20px; padding:36px 32px; max-width:420px; width:100%; text-align:center; animation:xvModalIn .3s cubic-bezier(.23,1,.32,1); }
  .xv-signout-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:24px; padding:10px 14px; background:#0e0e0e; border:1px solid #1a1a1a; border-radius:12px; }
  .xv-signout-user { font-size:12px; color:#888; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
  .xv-signout-btn { flex-shrink:0; background:transparent; border:1px solid #2a2a2a; border-radius:8px; color:#666; font-size:11px; font-weight:700; padding:5px 12px; cursor:pointer; font-family:inherit; transition:all .15s; white-space:nowrap; letter-spacing:.3px; }
  .xv-signout-btn:hover { border-color:#ef4444; color:#f87171; background:rgba(239,68,68,.06); }
  @media (max-width:768px) {
    .xv-brand { display:none!important; }
    .xv-paywall-side { width:100%!important; }
    .xv-paywall-scroll { padding:20px 18px 56px!important; max-width:100%!important; }
  }
`;

// ── Primitives ────────────────────────────────────────────────────────────────
const Spin = ({ size = 18, color = "#a3e635" }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: "50%",
      border: `2px solid rgba(163,230,53,.12)`,
      borderTopColor: color,
      animation: "xvSpin .6s linear infinite",
    }}
  />
);

function SignOutBar({ profile, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const display =
    profile?.email || profile?.full_name || profile?.username || "your account";
  const handle = async () => {
    setBusy(true);
    try {
      await onSignOut();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="xv-signout-bar">
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#444",
            marginBottom: 2,
          }}
        >
          Signed in as
        </div>
        <div className="xv-signout-user">{display}</div>
      </div>
      <button className="xv-signout-btn" onClick={handle} disabled={busy}>
        {busy ? "Signing out…" : "← Sign out"}
      </button>
    </div>
  );
}

// ── WaitlistSuccessModal ──────────────────────────────────────────────────────
function WaitlistSuccessModal({ onClose, waitlistPosition }) {
  return (
    <div
      className="xv-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="xv-modal-wl">
        <div
          style={{
            fontSize: 52,
            marginBottom: 16,
            animation: "xvBounce 1s ease-in-out 2",
          }}
        >
          ⏳
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#38bdf8",
            marginBottom: 8,
            letterSpacing: "-0.5px",
          }}
        >
          You're on the waitlist!
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#4a8a9a",
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          We'll notify you the moment a whitelist spot opens up. No payment
          needed now — your spot is reserved.
        </div>
        {waitlistPosition && (
          <div
            style={{
              background: "rgba(56,189,248,.06)",
              border: "1px solid rgba(56,189,248,.2)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "#38bdf8",
                marginBottom: 4,
              }}
            >
              Your position
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>
              #{waitlistPosition}
            </div>
          </div>
        )}
        <div
          style={{
            background: "rgba(56,189,248,.04)",
            border: "1px solid rgba(56,189,248,.12)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 11,
            color: "#3a6a7a",
            lineHeight: 1.6,
          }}
        >
          💡 You earned <strong style={{ color: "#38bdf8" }}>200 EP</strong> for
          joining the waitlist. Keep an eye on your email.
        </div>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg,#38bdf8,#0284c7)",
            color: "#001a26",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Got it — I'll wait ✓
        </button>
      </div>
    </div>
  );
}

// ── WaitlistAlreadyModal ──────────────────────────────────────────────────────
function WaitlistAlreadyModal({ onClose }) {
  return (
    <div
      className="xv-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="xv-modal-wl">
        <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#38bdf8",
            marginBottom: 8,
          }}
        >
          Already on the list!
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#4a8a9a",
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          You're already on the waitlist for this link. We'll email you as soon
          as a spot becomes available.
        </div>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "1.5px solid rgba(56,189,248,.3)",
            background: "transparent",
            color: "#38bdf8",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── BrandPanel ────────────────────────────────────────────────────────────────
function BrandPanel({ memberCount, epGrant }) {
  const [recentUsers, setRecentUsers] = useState([]);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,full_name,avatar_id,avatar_metadata")
      .is("deleted_at", null)
      .not("full_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data?.length) setRecentUsers(data);
      })
      .catch(() => {});
  }, []);

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
      title: `${epGrant ?? 300} EP on join`,
      sub: "Instant reward",
    },
    { n: "03", icon: "♾️", title: "Lifetime access", sub: "No renewals ever" },
  ];
  const ACCENT_COLORS = ["#a3e635", "#84cc16", "#65a30d", "#d4fc72"];

  return (
    <div className="xv-brand">
      <div className="xv-brand-noise" />
      <div className="xv-brand-gradient" />
      <div className="xv-brand-gradient-top" />
      <svg
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.55,
          pointerEvents: "none",
          zIndex: 0,
        }}
        viewBox="0 0 600 700"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="ng28" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a3e635" stopOpacity="1" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </radialGradient>
          <filter id="glow28">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {[
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
        ].map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="rgba(163,230,53,.65)"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="8 14"
            style={{
              animation: `xvDash ${3.5 + i * 0.3}s linear infinite, xvLinePulse ${2 + i * 0.2}s ease-in-out infinite`,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
        {[
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
        ].map(([cx, cy, r], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="url(#ng28)"
            filter="url(#glow28)"
            style={{
              animation: `xvNodeP ${2.2 + i * 0.38}s ease-in-out infinite`,
              animationDelay: `${i * 0.21}s`,
            }}
          />
        ))}
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg,#a3e635,#65a30d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#040a00",
                fontFamily: "'Syne', sans-serif",
              }}
            >
              X
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "5px",
              color: "#5a8a25",
              textTransform: "uppercase",
            }}
          >
            XEEVIA
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "clamp(34px, 3.4vw, 52px)",
            fontWeight: 900,
            lineHeight: 1.06,
            letterSpacing: "-2px",
            margin: "0 0 18px",
            color: "#f5f5f5",
          }}
        >
          Your social life,
          <br />
          <span className="xv-shimmer">renewed.</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "#8a9a8a",
            lineHeight: 1.85,
            maxWidth: 370,
            margin: "0 0 32px",
          }}
        >
          A private social experience built for people who want more — real
          connections, genuine community, and a platform that actually belongs
          to you.
        </p>
        <div className="xv-feat-grid" style={{ marginBottom: 32 }}>
          {FEATURES.map(({ n, icon, title, sub }) => (
            <div key={n} className="xv-feat-card">
              <div style={{ fontSize: 18, marginBottom: 7 }}>{icon}</div>
              <div
                style={{
                  fontSize: 9,
                  color: "#666",
                  fontWeight: 800,
                  letterSpacing: "1.2px",
                  marginBottom: 5,
                }}
              >
                {n}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#90c040",
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 3,
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: 10, color: "#7a8a7a", lineHeight: 1.4 }}>
                {sub}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderLeft: "2px solid #1e2a1e", paddingLeft: 16 }}>
          <p
            style={{
              color: "#6a7a6a",
              fontSize: 12,
              lineHeight: 1.85,
              fontStyle: "italic",
              margin: 0,
            }}
          >
            "The next social protocol won't be owned by a company.
            <br />
            It'll be owned by the people who showed up first."
          </p>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid #141814",
          paddingTop: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="xv-avatar-stack">
            {(recentUsers.length > 0
              ? recentUsers
              : [null, null, null, null]
            ).map((user, i) => {
              const avatarUrl = user ? buildAvatarUrl(user.avatar_id) : null;
              const initials = user
                ? (user.full_name || "U").charAt(0).toUpperCase()
                : "?";
              return (
                <div
                  key={user?.id || i}
                  className="xv-avatar"
                  style={{
                    marginLeft: i > 0 ? -10 : 0,
                    zIndex: 4 - i,
                    background: avatarUrl
                      ? "transparent"
                      : ACCENT_COLORS[i % ACCENT_COLORS.length],
                    position: "relative",
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user?.full_name || ""}
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
                          ACCENT_COLORS[i % ACCENT_COLORS.length];
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        color: "#040a00",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {initials}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#90c040",
                letterSpacing: "-0.5px",
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {memberCount > 0 ? memberCount.toLocaleString() : "—"}
            </div>
            <div style={{ fontSize: 10, color: "#6a7a6a", fontWeight: 600 }}>
              members joined
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 5,
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            <span className="xv-tech-badge">⛓ Web3</span>
            <span className="xv-tech-badge">🔐 Supabase</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <span className="xv-tech-badge">🏦 Paystack</span>
            <span className="xv-tech-badge">✓ On-chain</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PriceHero ─────────────────────────────────────────────────────────────────
function PriceHero({
  productPrice,
  inviteDetails,
  loading,
  paywallEpGrant,
  liveStats,
  heroMessage,
  onJoinWaitlist,
  waitlistJoined,
  joiningWaitlist,
  userId, // [5] needed for whitelisted_user_ids check
  onFreeActivate,
  freeActivating, // [1] free activate CTA
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [priceKey, setPriceKey] = useState(0);
  const prevPrice = useRef(null);
  const autoRef = useRef(null);
  // [2] Track whether user manually stopped rotation
  const userStoppedRef = useRef(false);

  const publicPrice = safePrice(productPrice, 4);
  const publicEp = paywallEpGrant ?? 300;
  const stats = liveStats ?? {
    memberCount: 0,
    whitelistTotal: 0,
    whitelistFilled: 0,
    waitlistCount: 0,
  };
  const memberLabel =
    stats.memberCount > 0 ? stats.memberCount.toLocaleString() : "—";

  const isWhitelistInvite =
    inviteDetails &&
    (inviteDetails.type === "whitelist" ||
      inviteDetails.metadata?.invite_type === "whitelist" ||
      inviteDetails.metadata?.invite_category === "whitelist");
  const derivedIsFull =
    isWhitelistInvite &&
    inviteDetails?.max_uses > 0 &&
    (inviteDetails?.uses_count ?? 0) >= inviteDetails.max_uses;
  const isFull =
    isWhitelistInvite && (!!inviteDetails?.is_full || derivedIsFull);
  const hasWL = !!(
    isWhitelistInvite &&
    inviteDetails?.metadata?.enable_waitlist !== false &&
    inviteDetails?.enable_waitlist !== false
  );
  const invitePrice = isWhitelistInvite
    ? resolvePrice(inviteDetails, publicPrice)
    : publicPrice;
  // isFree: any applied invite with resolved price = 0 grants free access, regardless of type
  const isFree =
    !!inviteDetails && resolvePrice(inviteDetails, publicPrice) === 0;
  const inviteEp = inviteDetails?.ep_grant ?? 500;
  const nonWlDiscount =
    inviteDetails && !isWhitelistInvite
      ? resolvePrice(inviteDetails, publicPrice)
      : null;
  const wlMax = isWhitelistInvite ? (inviteDetails?.max_uses ?? 0) : 0;
  const wlFilled = isWhitelistInvite ? (inviteDetails?.uses_count ?? 0) : 0;
  const wlPct =
    wlMax > 0 ? Math.min(100, Math.round((wlFilled / wlMax) * 100)) : 0;
  const wlSpotsLeft = Math.max(0, wlMax - wlFilled);
  const slide0Price = nonWlDiscount != null ? nonWlDiscount : publicPrice;
  const waitlistPos = (stats.waitlistCount ?? 0) + 1;

  // [5] Check if user is whitelisted from waitlist
  const isApprovedFromWaitlist = isUserWhitelistedFromWaitlist(
    inviteDetails,
    userId,
  );

  const wlSlide = isFull
    ? {
        id: "whitelist-full",
        badge: "WHITELIST FULL",
        badgeColor: "#94a3b8",
        badgeBg: "rgba(148,163,184,.08)",
        badgeBorder: "rgba(148,163,184,.2)",
        price: publicPrice,
        accent: "#94a3b8",
        note: "whitelist is full — join the waitlist below",
        epLabel: null,
        showPrice: true,
      }
    : isFree
      ? {
          id: "whitelist-free",
          badge: "FREE ACCESS",
          badgeColor: "#a3e635",
          badgeBg: "rgba(163,230,53,.1)",
          badgeBorder: "rgba(163,230,53,.25)",
          price: 0,
          accent: "#a3e635",
          note: "whitelisted · no payment needed",
          epLabel: `${inviteEp} EP`,
          showPrice: true,
        }
      : isWhitelistInvite
        ? {
            id: "whitelist-invite",
            badge: "WHITELIST ENTRY",
            badgeColor: "#f59e0b",
            badgeBg: "rgba(245,158,11,.1)",
            badgeBorder: "rgba(245,158,11,.25)",
            price: invitePrice,
            accent: "#f59e0b",
            note: "whitelist · exclusive entry price",
            epLabel: `${inviteEp} EP`,
            showPrice: true,
          }
        : {
            id: "whitelist-generic",
            badge: "WHITELIST",
            badgeColor: "#f59e0b",
            badgeBg: "rgba(245,158,11,.08)",
            badgeBorder: "rgba(245,158,11,.2)",
            price: publicPrice,
            accent: "#f59e0b",
            note: "have a whitelist invite code? apply it below",
            epLabel: "500 EP",
            showPrice: false,
          };

  const wlQueueSlide = {
    id: "waitlist-generic",
    badge: "WAITLIST",
    badgeColor: "#38bdf8",
    badgeBg: "rgba(56,189,248,.06)",
    badgeBorder: "rgba(56,189,248,.18)",
    accent: "#38bdf8",
    epLabel: "200 EP",
  };

  const SLIDES = [
    {
      id: "public",
      badge: nonWlDiscount != null ? "INVITE PRICE" : "PUBLIC ENTRY",
      badgeColor: "#a3e635",
      badgeBg: "rgba(163,230,53,.1)",
      badgeBorder: "rgba(163,230,53,.25)",
      price: slide0Price,
      accent: "#a3e635",
      note:
        nonWlDiscount != null
          ? "exclusive invite price"
          : "one-time · instant activation",
      epLabel: `${publicEp} EP`,
      showPrice: true,
      kind: "public",
    },
    { ...wlSlide, kind: "whitelist" },
    { ...wlQueueSlide, kind: "waitlist" },
  ];

  // [2] When invite is applied, jump to correct slide without killing rotation for ?ref= auto-apply
  useEffect(() => {
    if (!inviteDetails) return;
    // Only stop rotation if user applied the code manually
    if (userStoppedRef.current) {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    }
    if (isWhitelistInvite && isFull && hasWL) {
      setSlideIdx(2);
      return;
    }
    if (isWhitelistInvite) {
      setSlideIdx(1);
      return;
    }
    if (nonWlDiscount != null) {
      setSlideIdx(0);
      return;
    }
  }, [inviteDetails?.id, isWhitelistInvite, isFull, hasWL]); // eslint-disable-line

  // [2] Auto-rotation: starts immediately, runs until user stops it
  useEffect(() => {
    if (userStoppedRef.current && inviteDetails) return;
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(
      () => setSlideIdx((p) => (p + 1) % SLIDES.length),
      3000,
    );
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [inviteDetails]); // eslint-disable-line

  const si = Math.min(slideIdx, SLIDES.length - 1);
  const s = SLIDES[si];
  const activePrice = s?.price ?? publicPrice;

  useEffect(() => {
    if (prevPrice.current !== null && prevPrice.current !== activePrice)
      setPriceKey((k) => k + 1);
    prevPrice.current = activePrice;
  }, [activePrice]);

  const goTo = (i) => {
    // [2] Manual dot click = stop rotation
    userStoppedRef.current = true;
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
    setSlideIdx(i);
  };

  if (loading)
    return (
      <div
        className="xv-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 26,
          marginBottom: 14,
        }}
      >
        <Spin size={20} />
      </div>
    );

  const PriceBig = ({ price: p, accent: ac, animated }) => (
    <div
      key={animated ? priceKey : undefined}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 3,
        animation: animated && priceKey > 0 ? "xvPop .3s ease" : "none",
      }}
    >
      {p !== 0 && p !== "FREE" && (
        <span
          style={{
            fontSize: 20,
            color: "#555",
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          $
        </span>
      )}
      <span
        style={{
          fontSize: 50,
          fontWeight: 900,
          lineHeight: 1,
          color: p === 0 || p === "FREE" ? "#a3e635" : "#fff",
          letterSpacing: "-3px",
          transition: "color .4s",
        }}
      >
        {typeof p === "number" ? (p === 0 ? "FREE" : fmt(p)) : p}
      </span>
    </div>
  );

  const LiveCount = () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#0f0f0f",
        border: "1px solid #1a1a1a",
        borderRadius: 10,
        padding: "9px 12px",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#a3e635",
            boxShadow: "0 0 6px #a3e63580",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "#a3e635",
            animation: "xvGlow 2s ease-in-out infinite",
            opacity: 0.4,
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: "#e4e4e4",
            letterSpacing: "-0.3px",
          }}
        >
          {memberLabel}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#555",
            marginLeft: 6,
            fontWeight: 600,
          }}
        >
          members joined
        </span>
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "#a3e63599",
          letterSpacing: "1px",
          textTransform: "uppercase",
        }}
      >
        LIVE
      </span>
    </div>
  );

  const EpBadge = ({ ep, accent: ac }) => (
    <div
      style={{
        background: "#0f0f0f",
        border: `1px solid ${ac}18`,
        borderRadius: 10,
        padding: "7px 12px",
        textAlign: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: ac,
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        {ep}
      </div>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "#444",
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          marginTop: 2,
        }}
      >
        reward
      </div>
    </div>
  );

  return (
    <div
      className="xv-card"
      style={{
        marginBottom: 14,
        position: "relative",
        overflow: "hidden",
        padding: "15px 17px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -32,
          right: -32,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: `radial-gradient(circle,${s.accent}30 0%,transparent 70%)`,
          pointerEvents: "none",
          transition: "background .6s",
        }}
      />

      {/* [5] Approved-from-waitlist banner */}
      {isApprovedFromWaitlist && (
        <div
          style={{
            background: "rgba(163,230,53,.08)",
            border: "1px solid rgba(163,230,53,.25)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#a3e635" }}>
              You've been approved!
            </div>
            <div style={{ fontSize: 10, color: "#5a8a35", marginTop: 2 }}>
              Your waitlist spot has been whitelisted — activate free access
              below.
            </div>
          </div>
        </div>
      )}

      <div
        key={s.id}
        style={{
          position: "relative",
          zIndex: 1,
          animation: "xvSlide .32s cubic-bezier(.23,1,.32,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: s.badgeColor,
              background: s.badgeBg,
              border: `1px solid ${s.badgeBorder}`,
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            {s.badge}
          </span>
          <span style={{ fontSize: 9, color: "#333", fontWeight: 700 }}>
            {si + 1} / {SLIDES.length}
          </span>
        </div>

        {/* PUBLIC */}
        {s.kind === "public" && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                marginBottom: 11,
              }}
            >
              <div>
                <PriceBig price={s.price} accent={s.accent} animated />
                <div
                  style={{
                    fontSize: 10,
                    color: "#5a5a5a",
                    fontWeight: 600,
                    marginTop: 3,
                  }}
                >
                  {s.note}
                </div>
              </div>
              {s.epLabel && <EpBadge ep={s.epLabel} accent={s.accent} />}
            </div>
            <LiveCount />
            {heroMessage && (
              <div style={{ marginTop: 6, padding: "4px 6px" }}>
                <span style={{ fontSize: 10, color: "#666", lineHeight: 1.6 }}>
                  {heroMessage}
                </span>
              </div>
            )}
          </>
        )}

        {/* WHITELIST */}
        {s.kind === "whitelist" && (
          <>
            {isFull && (
              <div
                style={{
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.2)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12 }}>🔒</span>
                <div>
                  <div
                    style={{ fontSize: 11, fontWeight: 800, color: "#f87171" }}
                  >
                    Whitelist slots exhausted
                  </div>
                  <div style={{ fontSize: 9, color: "#7a3a3a", marginTop: 1 }}>
                    All {wlMax} spots have been claimed
                  </div>
                </div>
              </div>
            )}
            {s.showPrice && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  marginBottom: 11,
                }}
              >
                <div>
                  <PriceBig
                    price={
                      s.price === 0
                        ? "FREE"
                        : s.id === "whitelist-generic"
                          ? "?"
                          : s.price
                    }
                    accent={s.accent}
                    animated
                  />
                  <div
                    style={{
                      fontSize: 10,
                      color: "#5a5a5a",
                      fontWeight: 600,
                      marginTop: 3,
                    }}
                  >
                    {s.note}
                  </div>
                </div>
                {s.epLabel && <EpBadge ep={s.epLabel} accent={s.accent} />}
              </div>
            )}
            {isWhitelistInvite && wlMax > 0 ? (
              <div
                style={{
                  background: "#0f0f0f",
                  border: `1px solid ${s.accent}15`,
                  borderRadius: 10,
                  padding: "9px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ fontSize: 10, color: "#666", fontWeight: 600 }}
                  >
                    Whitelist slots
                  </span>
                  <span
                    style={{ fontSize: 10, color: s.accent, fontWeight: 800 }}
                  >{`${wlFilled.toLocaleString()} / ${wlMax.toLocaleString()}`}</span>
                </div>
                <div
                  style={{ height: 3, background: "#1a1a1a", borderRadius: 3 }}
                >
                  <div
                    style={{
                      width: `${wlPct}%`,
                      height: "100%",
                      borderRadius: 3,
                      background: `linear-gradient(90deg,${s.accent}60,${s.accent})`,
                      boxShadow: `0 0 6px ${s.accent}40`,
                      transition: "width .6s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 9, color: "#444" }}>
                    {wlPct}% claimed
                  </span>
                  <span
                    style={{ fontSize: 9, color: isFull ? "#f87171" : "#444" }}
                  >
                    {isFull ? "FULL" : `${wlSpotsLeft} spots left`}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#0f0f0f",
                  border: `1px solid ${s.accent}15`,
                  borderRadius: 10,
                  padding: "11px 13px",
                  fontSize: 11,
                  color: "#666",
                  lineHeight: 1.6,
                }}
              >
                🎫 Apply a whitelist invite code below to unlock exclusive
                pricing and see available spots.
              </div>
            )}
            {/* [1][5] Free activate CTA — shown when isFree OR approved from waitlist */}
            {(isFree || isApprovedFromWaitlist) && inviteDetails?.code && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="xv-btn-lime"
                  onClick={() => onFreeActivate(inviteDetails.code)}
                  disabled={freeActivating}
                  style={{ opacity: freeActivating ? 0.7 : 1 }}
                >
                  {freeActivating ? (
                    <>
                      <Spin size={16} color="#061000" /> Activating…
                    </>
                  ) : (
                    "🎉 Activate Free Access →"
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* WAITLIST */}
        {s.kind === "waitlist" && (
          <>
            <div style={{ marginBottom: 11 }}>
              <div
                style={{
                  background: "rgba(239,68,68,.06)",
                  border: "1px solid rgba(239,68,68,.18)",
                  borderRadius: 8,
                  padding: "7px 11px",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span style={{ fontSize: 11 }}>🔒</span>
                <div>
                  <div
                    style={{ fontSize: 10, fontWeight: 800, color: "#f87171" }}
                  >
                    Whitelist slots exhausted
                  </div>
                  <div
                    style={{ fontSize: 8.5, color: "#7a3a3a", marginTop: 1 }}
                  >
                    Join the waitlist — no payment needed now
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#c0e0f0",
                  lineHeight: 1.55,
                  marginBottom: 4,
                }}
              >
                Get whitelisted when a spot opens
              </div>
              <div style={{ fontSize: 10, color: "#4a6a7a", fontWeight: 600 }}>
                We'll notify you instantly · your spot is reserved · enter free
                today
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#0a1418",
                border: "1px solid rgba(56,189,248,.15)",
                borderRadius: 10,
                padding: "9px 12px",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#38bdf8",
                  boxShadow: "0 0 6px #38bdf880",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#e4e4e4",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {stats.waitlistCount > 0
                    ? stats.waitlistCount.toLocaleString()
                    : "—"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#3a5a6a",
                    marginLeft: 6,
                    fontWeight: 600,
                  }}
                >
                  {stats.waitlistCount === 1 ? "person" : "people"} waiting
                </span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#38bdf8",
                    lineHeight: 1,
                  }}
                >
                  200 EP
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: "#2a4a5a",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  on join
                </div>
              </div>
            </div>
            {waitlistJoined ? (
              <div
                style={{
                  background: "rgba(56,189,248,.08)",
                  border: "1.5px solid rgba(56,189,248,.3)",
                  borderRadius: 14,
                  padding: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>✓</span>
                <span
                  style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8" }}
                >
                  You're on the waitlist!
                </span>
              </div>
            ) : (
              <button
                className="xv-btn-wl"
                onClick={onJoinWaitlist}
                disabled={joiningWaitlist || waitlistJoined}
                style={{ opacity: joiningWaitlist ? 0.7 : 1 }}
              >
                {joiningWaitlist ? (
                  <>
                    <Spin size={16} color="#001a26" /> Joining…
                  </>
                ) : (
                  "⏳ Join Waitlist Now →"
                )}
              </button>
            )}
          </>
        )}
      </div>

      <div className="xv-hero-dots" style={{ marginTop: 12 }}>
        {SLIDES.map((sl, i) => (
          <div
            key={sl.id}
            onClick={() => goTo(i)}
            className="xv-hero-dot"
            style={{
              width: i === si ? 20 : 6,
              background: i === si ? s.accent : "#1e1e1e",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── PaywallGate (main) ────────────────────────────────────────────────────────
export default function PaywallGate({ children }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const mounted = useRef(true);

  const [paywallConfig, setPaywallConfig] = useState(null);
  const [liveStats, setLiveStats] = useState({
    memberCount: 0,
    whitelistTotal: 0,
    whitelistFilled: 0,
    waitlistCount: 0,
  });
  const [configLoading, setConfigLoading] = useState(true);

  const [inviteDetails, setInviteDetails] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const inviteRef = useRef(null);

  const [heroMessage, setHeroMessage] = useState(null);

  const [tab, setTab] = useState("evm");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [freeActivating, setFreeActivating] = useState(false);
  const [freeActivated, setFreeActivated] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);

  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [showWaitlistSuccess, setShowWaitlistSuccess] = useState(false);
  const [showWaitlistAlready, setShowWaitlistAlready] = useState(false);
  const [waitlistPosition, setWaitlistPosition] = useState(null);

  useEffect(() => {
    inviteRef.current = inviteDetails;
  }, [inviteDetails]);

  const loadConfig = useCallback(async () => {
    if (!mounted.current) return;
    try {
      const cfg = await fetchPaywallConfig();
      if (!mounted.current) return;
      setPaywallConfig(cfg);
      setHeroMessage(cfg.hero_message ?? null);
    } catch (e) {
      console.warn("[PaywallGate] loadConfig error:", e?.message);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!mounted.current) return;
    try {
      const cfg = await fetchPaywallConfig();
      const settingsMemberCount = cfg?.member_count ?? 0;
      const stats = await fetchLiveStats();
      if (!mounted.current) return;
      const memberCount = Math.max(settingsMemberCount, stats.memberCount);
      setLiveStats({ ...stats, memberCount });
    } catch {
      /* non-fatal */
    }
  }, []);

  const refetchActiveInvite = useCallback(async (codeStr) => {
    if (!codeStr || !mounted.current) return;
    try {
      const fresh = await fetchInviteCodeDetails(codeStr);
      if (fresh && mounted.current) setInviteDetails(fresh);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const init = async () => {
      setConfigLoading(true);
      try {
        await Promise.all([loadConfig(), loadStats()]);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled && mounted.current) setConfigLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode && !inviteDetails) {
      fetchInviteCodeDetails(refCode.toUpperCase())
        .then((details) => {
          if (details && mounted.current) setInviteDetails(details);
        })
        .catch(() => {});
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const configSub = supabase
      .channel(`paywall-platform-settings-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        (payload) => {
          const changedKey = payload?.new?.key ?? payload?.old?.key ?? "";
          if (changedKey && changedKey !== "paywall_config") return;
          loadConfig();
          loadStats(); // [3] also refresh stats so member_count stays live
        },
      )
      .subscribe();

    const inviteSub = supabase
      .channel(`paywall-invite-codes-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invite_codes" },
        () => {
          if (inviteRef.current?.code)
            refetchActiveInvite(inviteRef.current.code);
          loadStats();
        },
      )
      .subscribe();

    const profileSub = supabase
      .channel(`paywall-profiles-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        () => loadStats(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(configSub);
      supabase.removeChannel(inviteSub);
      supabase.removeChannel(profileSub);
    };
  }, [loadConfig, refetchActiveInvite, loadStats]);

  // Poll every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConfig();
      loadStats();
      if (inviteRef.current?.code) refetchActiveInvite(inviteRef.current.code);
    }, 5_000);
    return () => clearInterval(interval);
  }, [loadConfig, loadStats, refetchActiveInvite]);

  // Refresh on tab focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadConfig();
        loadStats();
        if (inviteRef.current?.code)
          refetchActiveInvite(inviteRef.current.code);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadConfig, loadStats, refetchActiveInvite]);

  const productPrice = safePrice(paywallConfig?.product_price, 4);
  const paywallEpGrant = paywallConfig?.ep_grant ?? 300;
  // Derived at gate level so PaywallPayment gets the authoritative signal
  const isFreeAccess =
    !!inviteDetails && resolvePrice(inviteDetails, productPrice) === 0;
  const isApprovedAccess = isUserWhitelistedFromWaitlist(
    inviteDetails,
    user?.id,
  );

  const handleVerify = useCallback(
    async (params) => {
      setVerifying(true);
      setVerifyError("");
      try {
        const result = await verifyWeb3Payment({
          ...params,
          // userId is read from JWT by edge fn — do NOT send in body
          amountOverrideUSD: resolvePrice(inviteRef.current, productPrice), // correct param name
          inviteCodeId: inviteRef.current?.id ?? null, // UUID, not code string
          productId: paywallConfig?.product_id ?? "xeevia-access",
        });
        if (result?.success) {
          await clearIdempotencyKey(user?.id);
          await refreshProfile(); // reload so isPaidProfile() returns true immediately
        } else {
          setVerifyError(
            result?.message ?? "Verification failed. Please try again.",
          );
        }
      } catch (e) {
        setVerifyError(e?.message ?? "Verification failed.");
      } finally {
        setVerifying(false);
      }
    },
    [user?.id, productPrice, paywallConfig?.product_id, refreshProfile],
  );

  const handleSmartPaySuccess = useCallback(
    async (result) => {
      if (result?.success && user?.id)
        await clearIdempotencyKey(user.id).catch(() => {});
    },
    [user?.id],
  );

  // handleFreeActivate — passes inviteDetails.id (UUID) as inviteCodeId to edge fn
  // Edge fn activateAccount() writes all profile fields server-side (bypasses RLS)
  // Then refreshProfile() reloads context so isPaidProfile() returns true
  const handleFreeActivate = useCallback(
    async (code) => {
      if (!user?.id || !inviteRef.current?.id) return;
      setFreeActivating(true);
      try {
        const productId = paywallConfig?.product_id ?? "xeevia-access";
        await activateFreeCode({
          inviteCodeId: inviteRef.current.id, // UUID — what edge fn expects
          productId,
        });
        // Reload profile from DB — edge fn has already written account_activated=true
        await refreshProfile();
        // Also set local flag so gate unlocks immediately if profile reload is slow
        setFreeActivated(true);
      } catch (e) {
        console.error("[PaywallGate] handleFreeActivate error:", e?.message);
      } finally {
        setFreeActivating(false);
      }
    },
    [user?.id, paywallConfig?.product_id, refreshProfile],
  );

  const handleJoinWaitlist = useCallback(async () => {
    const invite = inviteRef.current;
    if (!invite?.id || !user?.id) return;
    setJoiningWaitlist(true);
    try {
      const { data: fresh, error: fetchErr } = await supabase
        .from("invite_codes")
        .select("id, metadata, max_uses, uses_count")
        .eq("id", invite.id)
        .single();
      if (fetchErr) throw fetchErr;

      const meta = fresh?.metadata ?? {};
      const existingEntries = meta.waitlist_entries ?? [];

      if (existingEntries.some((e) => e.user_id === user.id)) {
        setShowWaitlistAlready(true);
        setJoiningWaitlist(false);
        return;
      }

      const newEntry = {
        user_id: user.id,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        joined_at: new Date().toISOString(),
        authenticated_at: new Date().toISOString(),
        account_activated: false,
        ep_granted: 200,
      };
      const updatedEntries = [...existingEntries, newEntry];
      const updatedMeta = {
        ...meta,
        waitlist_entries: updatedEntries,
        waitlist_count: updatedEntries.length,
      };

      const { error: updateErr } = await supabase
        .from("invite_codes")
        .update({ metadata: updatedMeta, updated_at: new Date().toISOString() })
        .eq("id", fresh.id);
      if (updateErr) throw updateErr;

      // NOTE: waitlist_entries table does not exist in schema.
      // All waitlist state lives in invite_codes.metadata.waitlist_entries (JSONB).
      // The update above already persisted the entry — no separate table write needed.

      setWaitlistPosition(updatedEntries.length);
      setWaitlistJoined(true);
      setShowWaitlistSuccess(true);

      // [4] Immediate local increment
      setLiveStats((prev) => ({
        ...prev,
        waitlistCount: (prev.waitlistCount ?? 0) + 1,
      }));

      await refetchActiveInvite(invite.code);
      await loadStats();
    } catch (e) {
      console.error("[PaywallGate] handleJoinWaitlist error:", e?.message);
    } finally {
      setJoiningWaitlist(false);
    }
  }, [
    user?.id,
    profile?.email,
    profile?.full_name,
    refetchActiveInvite,
    loadStats,
  ]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (!user) return children;
  if (freeActivated || isPaidProfile(profile)) return children;

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="xv"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          background: "#060806",
          overflow: "hidden",
          zIndex: 9000,
        }}
      >
        <BrandPanel
          memberCount={liveStats.memberCount}
          epGrant={paywallEpGrant}
        />
        <div className="xv-paywall-side">
          <div className="xv-paywall-scroll">
            <SignOutBar profile={profile} onSignOut={handleSignOut} />
            <PriceHero
              productPrice={productPrice}
              inviteDetails={inviteDetails}
              loading={configLoading}
              paywallEpGrant={paywallEpGrant}
              liveStats={liveStats}
              heroMessage={heroMessage}
              onJoinWaitlist={handleJoinWaitlist}
              waitlistJoined={waitlistJoined}
              joiningWaitlist={joiningWaitlist}
              userId={user?.id}
              onFreeActivate={handleFreeActivate}
              freeActivating={freeActivating}
            />
            <PaywallPayment
              user={user}
              paywallConfig={paywallConfig}
              inviteDetails={inviteDetails}
              setInviteDetails={setInviteDetails}
              inviteLoading={inviteLoading}
              setInviteLoading={setInviteLoading}
              verifying={verifying}
              verifyError={verifyError}
              resetVerify={() => setVerifyError("")}
              onVerify={handleVerify}
              onSmartPaySuccess={handleSmartPaySuccess}
              onFreeActivate={handleFreeActivate}
              freeActivating={freeActivating}
              isFreeAccess={isFreeAccess}
              isApprovedAccess={isApprovedAccess}
              showPaystack={showPaystack}
              setShowPaystack={setShowPaystack}
              tab={tab}
              setTab={setTab}
            />
          </div>
        </div>
      </div>

      {showWaitlistSuccess && (
        <WaitlistSuccessModal
          onClose={() => setShowWaitlistSuccess(false)}
          waitlistPosition={waitlistPosition}
        />
      )}
      {showWaitlistAlready && (
        <WaitlistAlreadyModal onClose={() => setShowWaitlistAlready(false)} />
      )}
    </>
  );
}
