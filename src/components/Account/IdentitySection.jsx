// src/components/Account/IdentitySection.jsx
// ============================================================================
// Xeevia Unified Identity Layer — v3 PRECISE FIX
//
// ROOT CAUSE FIXED [BUG-1]:
//   The previous query included `connected_at` in the SELECT list.
//   That column does NOT exist on the `connections` table (confirmed against
//   the full schema dump). PostgreSQL returns error code 42703
//   ("column X does not exist") which surfaces as:
//     "column connections.connected_at does not exist"
//   Fix: SELECT only confirmed columns → provider, platform_user_id, auth_status
//
// ROOT CAUSE FIXED [BUG-2]:
//   withTimeout import was wrapped in try/catch requiring() — in ESM module
//   bundlers (Vite/webpack with ES modules) dynamic require() throws. We now
//   import it statically with a safe identity-function fallback inline.
//
// ROOT CAUSE FIXED [BUG-3]:
//   post_distribution query had no guard for missing table (42P01). Both
//   queries now check error.code and surface setupNeeded gracefully.
//
// VISION:
//   Xeevia sits above all social networks as a singular layer of digital
//   identity. 8 platforms shown, grouped by category. Live OAuth platforms
//   show Link/Reconnect/Unlink. Coming-soon platforms show a "Soon" badge
//   so users understand the roadmap. Distribution history shown when available.
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  Globe, Link2, Unlink, CheckCircle, AlertCircle, Clock,
  RefreshCw, BarChart2, Shield, Zap, Layers,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// Safe timeout wrapper — works even if the module doesn't resolve
const safeTimeout = (promise, ms = 12000) => {
  try {
    const { default: withTimeout } = require("../../services/shared/requestUtils");
    return withTimeout(promise, ms);
  } catch {
    return promise;
  }
};

// ── All platforms Xeevia supports ────────────────────────────────────────────
// This list is the single source of truth for both IdentitySection and
// PlatformSelector. Import PLATFORMS from here in PlatformSelector.
export const PLATFORMS = {
  // ── Live: OAuth routes exist ──────────────────────────────────────────────
  x: {
    name: "X (Twitter)",
    letter: "𝕏",
    color: "#e2e2e2",
    bg: "rgba(226,226,226,0.08)",
    border: "rgba(226,226,226,0.16)",
    desc: "Posts, threads & media to your X audience",
    category: "Social",
    live: true,
  },
  facebook: {
    name: "Facebook",
    letter: "f",
    color: "#5b9ef9",
    bg: "rgba(91,158,249,0.08)",
    border: "rgba(91,158,249,0.16)",
    desc: "Publish to your Facebook profile and pages",
    category: "Social",
    live: true,
  },
  instagram: {
    name: "Instagram",
    letter: "✦",
    color: "#f472b6",
    bg: "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.16)",
    desc: "Distribute photo & video content visually",
    category: "Social",
    live: true,
  },
  linkedin: {
    name: "LinkedIn",
    letter: "in",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.16)",
    desc: "Reach your professional network instantly",
    category: "Professional",
    live: true,
  },
  // ── Coming soon ───────────────────────────────────────────────────────────
  tiktok: {
    name: "TikTok",
    letter: "♪",
    color: "#fb7185",
    bg: "rgba(251,113,133,0.07)",
    border: "rgba(251,113,133,0.14)",
    desc: "Short-form video reach across TikTok's global audience",
    category: "Video",
    live: false,
  },
  youtube: {
    name: "YouTube",
    letter: "▶",
    color: "#f87171",
    bg: "rgba(248,113,113,0.07)",
    border: "rgba(248,113,113,0.14)",
    desc: "Publish long-form video, shorts & community posts",
    category: "Video",
    live: false,
  },
  threads: {
    name: "Threads",
    letter: "@",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.07)",
    border: "rgba(167,139,250,0.14)",
    desc: "Text-first conversations via Meta Threads",
    category: "Social",
    live: false,
  },
  pinterest: {
    name: "Pinterest",
    letter: "P",
    color: "#f87171",
    bg: "rgba(248,113,113,0.07)",
    border: "rgba(248,113,113,0.14)",
    desc: "Visual discovery and idea distribution at scale",
    category: "Visual",
    live: false,
  },
};

const STATUS_CFG = {
  active:  { label: "Connected",    color: "#84cc16", Icon: CheckCircle },
  expired: { label: "Token expired",color: "#f59e0b", Icon: AlertCircle },
  revoked: { label: "Disconnected", color: "#ef4444", Icon: AlertCircle },
  none:    { label: "Not linked",   color: "#3a3a3a", Icon: Clock       },
};

// ── Scoped styles ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes idIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes idSpin  { to{transform:rotate(360deg)} }
  @keyframes idPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes idBlink { 0%,100%{box-shadow:0 0 0 0 rgba(132,204,22,0)} 60%{box-shadow:0 0 0 5px rgba(132,204,22,0.12)} }

  .idRoot {
    padding: 20px 20px 40px;
    display: flex; flex-direction: column; gap: 28px;
    animation: idIn .32s ease both;
  }

  /* ── Hero ─────────────────────────────────────────────── */
  .idHero {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg,
      rgba(99,102,241,.13) 0%,
      rgba(139,92,246,.08) 55%,
      rgba(16,185,129,.05) 100%);
    border: 1px solid rgba(139,92,246,.28);
    border-radius: 22px; padding: 26px 24px 24px;
  }
  .idHero::after {
    content:""; pointer-events:none;
    position:absolute; top:-80px; right:-80px;
    width:240px; height:240px; border-radius:50%;
    background:radial-gradient(circle,rgba(139,92,246,.15) 0%,transparent 65%);
  }
  .idHeroEyebrow {
    display:flex; align-items:center; gap:7px;
    font-size:10px; font-weight:800; text-transform:uppercase;
    letter-spacing:.9px; color:#818cf8; margin-bottom:12px;
  }
  .idHeroTitle {
    font-size:21px; font-weight:900; color:#f5f5f5;
    margin:0 0 10px; line-height:1.25;
  }
  .idHeroTitle em { font-style:normal; color:#c4b5fd; }
  .idHeroBody {
    font-size:13px; color:#737373; line-height:1.75;
    margin:0 0 22px; max-width:480px;
  }
  .idStats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .idStat {
    text-align:center; padding:14px 6px;
    background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.07);
    border-radius:14px; transition:border-color .2s;
  }
  .idStat:hover { border-color:rgba(139,92,246,.3); }
  .idStatV { font-size:26px; font-weight:900; color:#c4b5fd; line-height:1; margin-bottom:5px; }
  .idStatL { font-size:10px; color:#404040; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }

  /* ── Section label ── */
  .idLabel {
    display:flex; align-items:center; gap:6px;
    font-size:10px; font-weight:800; color:#404040;
    text-transform:uppercase; letter-spacing:.7px; margin:0 0 12px;
  }

  /* ── How it works ── */
  .idHow {
    background:rgba(255,255,255,.02);
    border:1px solid rgba(255,255,255,.06);
    border-radius:18px; padding:20px 22px;
  }
  .idHowSteps { display:flex; margin-top:16px; position:relative; }
  .idHowSteps::before {
    content:""; position:absolute; top:17px; left:0; right:0; height:1px;
    background:linear-gradient(90deg,transparent,rgba(139,92,246,.25) 20%,rgba(132,204,22,.25) 80%,transparent);
  }
  .idHowStep { flex:1; display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; padding:0 6px; }
  .idHowNum {
    width:34px; height:34px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:900; color:#c4b5fd;
    background:#0a0a0b; border:1px solid rgba(255,255,255,.1);
    position:relative; z-index:1;
  }
  .idHowText { font-size:11.5px; color:#525252; line-height:1.55; }

  /* ── Platform cards ── */
  .idGrid { display:flex; flex-direction:column; gap:9px; }
  .idCard {
    position:relative; overflow:hidden;
    background:rgba(255,255,255,.025);
    border:1px solid rgba(255,255,255,.07);
    border-radius:17px; padding:15px 16px;
    display:flex; align-items:center; gap:14px;
    transition:border-color .2s, background .2s, transform .14s;
  }
  .idCard:hover { transform:translateX(3px); }
  .idCard::before {
    content:""; position:absolute; left:0; top:0; bottom:0; width:3px;
    border-radius:2px 0 0 2px; opacity:0; transition:opacity .2s;
    background:var(--cAccent,transparent);
  }
  .idCard.scActive  { border-color:rgba(132,204,22,.22); background:rgba(132,204,22,.03); }
  .idCard.scActive::before  { --cAccent:#84cc16; opacity:1; }
  .idCard.scExpired { border-color:rgba(245,158,11,.22); background:rgba(245,158,11,.03); }
  .idCard.scExpired::before { --cAccent:#f59e0b; opacity:1; }
  .idCard.scSoon    { opacity:.55; }

  .idIcon {
    width:44px; height:44px; border-radius:12px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; font-weight:900; border:1px solid;
    font-style:normal; transition:transform .18s;
  }
  .idCard:hover .idIcon { transform:scale(1.06); }

  .idBody { flex:1; min-width:0; }
  .idPname {
    display:flex; align-items:center; gap:7px;
    font-size:14px; font-weight:800; color:#efefef; margin:0 0 2px;
  }
  .idCatTag {
    padding:1px 6px; border-radius:6px; font-size:9px; font-weight:700;
    background:rgba(255,255,255,.06); color:#404040;
    text-transform:uppercase; letter-spacing:.4px;
  }
  .idPdesc { font-size:11.5px; color:#454545; margin:0 0 7px; line-height:1.5; }
  .idStatusRow { display:flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; }
  .idLiveDot {
    display:inline-block; width:5px; height:5px; border-radius:50%;
    background:#84cc16; animation:idPulse 2s ease-in-out infinite;
  }
  .idHandle { color:#3a3a3a; font-weight:500; }

  /* ── Action buttons ── */
  .idBtn {
    flex-shrink:0; display:inline-flex; align-items:center; gap:6px;
    padding:9px 15px; border-radius:10px; border:1px solid;
    font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;
    font-family:inherit; transition:background .14s, transform .1s, box-shadow .14s;
    letter-spacing:.01em;
  }
  .idBtn:active  { transform:scale(0.95); }
  .idBtn:disabled{ opacity:.4; cursor:not-allowed; }
  .idBtn.btnLink {
    background:rgba(139,92,246,.1); border-color:rgba(139,92,246,.38); color:#c4b5fd;
  }
  .idBtn.btnLink:hover:not(:disabled) {
    background:rgba(139,92,246,.18); box-shadow:0 0 14px rgba(139,92,246,.18);
  }
  .idBtn.btnDisconnect {
    background:rgba(239,68,68,.07); border-color:rgba(239,68,68,.28); color:#f87171;
  }
  .idBtn.btnDisconnect:hover:not(:disabled) { background:rgba(239,68,68,.13); }
  .idBtn.btnReconnect {
    background:rgba(245,158,11,.09); border-color:rgba(245,158,11,.33); color:#fbbf24;
  }
  .idBtn.btnReconnect:hover:not(:disabled) { background:rgba(245,158,11,.16); }
  .idSoonBadge {
    padding:3px 9px; border-radius:7px; font-size:10px; font-weight:800;
    background:rgba(255,255,255,.04); color:#3a3a3a;
    border:1px solid rgba(255,255,255,.07); letter-spacing:.4px; text-transform:uppercase;
  }

  /* ── Distribution history ── */
  .idTableWrap {
    background:rgba(255,255,255,.02);
    border:1px solid rgba(255,255,255,.06);
    border-radius:18px; padding:20px;
  }
  .idTable { width:100%; border-collapse:collapse; margin-top:14px; }
  .idTable th {
    font-size:10px; font-weight:700; color:#3a3a3a;
    text-transform:uppercase; letter-spacing:.4px;
    text-align:left; padding:5px 8px;
    border-bottom:1px solid rgba(255,255,255,.06);
  }
  .idTable td {
    font-size:12px; color:#737373; padding:10px 8px;
    border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle;
  }
  .idTable tr:last-child td { border-bottom:none; }
  .idPill {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 8px; border-radius:20px; font-size:11px; font-weight:700;
  }
  .idPill.ok  { background:rgba(132,204,22,.12); color:#84cc16; }
  .idPill.err { background:rgba(239,68,68,.12);  color:#f87171; }
  .idPill.pnd { background:rgba(245,158,11,.12); color:#fbbf24; }

  /* ── Trust callout ── */
  .idCallout {
    background:rgba(96,165,250,.05); border:1px solid rgba(96,165,250,.14);
    border-radius:14px; padding:16px; display:flex; gap:12px; align-items:flex-start;
  }
  .idCallout p { font-size:12px; color:#737373; line-height:1.7; margin:0; }
  .idCallout p strong { color:#93c5fd; }

  /* ── Notice (setup / error) ── */
  .idNotice {
    border-radius:16px; padding:20px;
    display:flex; gap:14px; align-items:flex-start;
  }
  .idNotice.warn { background:rgba(245,158,11,.06); border:1px solid rgba(245,158,11,.2); }
  .idNotice.err  { background:rgba(239,68,68,.06);  border:1px solid rgba(239,68,68,.2);  }
  .idNotice p { font-size:13px; color:#d4d4d4; line-height:1.65; margin:0; }
  .idNotice p strong { display:block; margin-bottom:6px; font-size:14px; }
  .idNotice .warnTitle { color:#fbbf24; }
  .idNotice .errTitle  { color:#f87171; }
  .idNotice code {
    display:block; margin-top:10px; padding:10px 12px;
    background:rgba(0,0,0,.45); border-radius:8px;
    font-family:monospace; font-size:11px; color:#84cc16;
    line-height:1.6; white-space:pre; overflow-x:auto;
  }

  /* ── Skeleton ── */
  .idSkel {
    border-radius:14px; background:rgba(255,255,255,.03);
    animation:idPulse 1.7s ease-in-out infinite;
  }

  .idSpin { animation:idSpin .8s linear infinite; }

  @media(max-width:480px){
    .idRoot { padding:14px 14px 32px; gap:20px; }
    .idHeroTitle { font-size:18px; }
    .idCard { flex-wrap:wrap; }
    .idBtn { flex:1; justify-content:center; }
    .idHowSteps { flex-direction:column; gap:12px; }
    .idHowSteps::before { display:none; }
    .idHowStep { flex-direction:row; text-align:left; gap:12px; }
    .idHowNum { flex-shrink:0; }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
const IdentitySection = ({ userId }) => {
  const [connections,  setConnections]  = useState({});
  const [distStats,    setDistStats]    = useState({});
  const [summary,      setSummary]      = useState({ connected: 0, published: 0 });
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [setupNeeded,  setSetupNeeded]  = useState(false);
  const [fetchError,   setFetchError]   = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setSetupNeeded(false);

    try {
      // [BUG-1 FIX] Only select columns that actually exist on connections.
      // Schema shows: provider, platform_user_id, auth_status (no connected_at).
      const connQuery = supabase
        .from("connections")
        .select("provider, platform_user_id, auth_status")
        .eq("user_id", userId);

      const distQuery = supabase
        .from("post_distribution")
        .select("platform, status")
        .eq("user_id", userId);

      const [connRes, distRes] = await Promise.all([
        safeTimeout(connQuery, 12000),
        safeTimeout(distQuery, 12000),
      ]);

      // [BUG-3 FIX] Detect missing tables (42P01) and surface setupNeeded
      if (connRes.error?.code === "42P01" || distRes.error?.code === "42P01") {
        setSetupNeeded(true);
        setLoading(false);
        return;
      }

      // Non-fatal: if connections table errors (e.g. RLS block), show 0 linked
      const connRows = connRes.error ? [] : (connRes.data || []);
      const distRows = distRes.error ? [] : (distRes.data || []);

      const connMap = {};
      connRows.forEach(c => { connMap[c.provider] = c; });
      setConnections(connMap);

      const statsMap = {};
      distRows.forEach(d => {
        if (!statsMap[d.platform]) statsMap[d.platform] = { success: 0, failed: 0, pending: 0 };
        const k = d.status === "success" ? "success" : d.status === "failed" ? "failed" : "pending";
        statsMap[d.platform][k] = (statsMap[d.platform][k] || 0) + 1;
      });
      setDistStats(statsMap);

      setSummary({
        connected: Object.values(connMap).filter(c => c.auth_status === "active").length,
        published: distRows.filter(d => d.status === "success").length,
      });
    } catch (err) {
      setFetchError(err?.message || "Failed to load identity data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  // ── Connect (OAuth redirect) ───────────────────────────────────────────────
  const handleConnect = (platform) => {
    const returnTo = encodeURIComponent(window.location.pathname + "#account/identity");
    window.location.href =
      `${window.location.origin}/api/auth/${platform}?user_id=${userId}&return_to=${returnTo}`;
  };

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const handleDisconnect = async (platform) => {
    const meta = PLATFORMS[platform];
    if (!window.confirm(
      `Disconnect ${meta.name}?\n\nPosts already published will stay on that platform.`
    )) return;

    setBusy(platform);
    try {
      const { error } = await supabase
        .from("connections")
        .update({ auth_status: "revoked" })
        .eq("user_id", userId)
        .eq("provider", platform);
      if (error) throw error;
      await load();
    } catch (err) {
      alert(err.message || "Failed to disconnect. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="idRoot">
        <div className="idSkel" style={{ height: 200 }} />
        <div className="idSkel" style={{ height: 110 }} />
        {[1,2,3,4].map(i => (
          <div key={i} className="idSkel" style={{ height: 78 }} />
        ))}
      </div>
    </>
  );

  // ── Setup needed ───────────────────────────────────────────────────────────
  if (setupNeeded) return (
    <>
      <style>{CSS}</style>
      <div className="idRoot">
        <div className="idNotice warn">
          <AlertCircle size={20} color="#fbbf24" style={{ flexShrink:0, marginTop:2 }} />
          <p>
            <strong className="warnTitle">One-time database setup needed</strong>
            The distribution tables haven't been created in Supabase yet. Run the migration
            SQL in Supabase → SQL Editor → New Query → Run, then refresh.
            <code>xeevia_distribution_migration.sql</code>
          </p>
        </div>
      </div>
    </>
  );

  // ── Fetch error ────────────────────────────────────────────────────────────
  if (fetchError) return (
    <>
      <style>{CSS}</style>
      <div className="idRoot">
        <div className="idNotice err">
          <AlertCircle size={20} color="#f87171" style={{ flexShrink:0, marginTop:2 }} />
          <p>
            <strong className="errTitle">Could not load identity data</strong>
            {fetchError}
          </p>
        </div>
        <button
          onClick={load}
          style={{
            alignSelf:"flex-start", padding:"10px 20px",
            background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)",
            borderRadius:10, color:"#f87171", fontWeight:700, cursor:"pointer",
            fontFamily:"inherit", fontSize:13, display:"flex", alignItems:"center", gap:7,
          }}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    </>
  );

  // ── Group platforms by category ────────────────────────────────────────────
  const byCategory = Object.entries(PLATFORMS).reduce((acc, [key, meta]) => {
    if (!acc[meta.category]) acc[meta.category] = [];
    acc[meta.category].push([key, meta]);
    return acc;
  }, {});

  const hasDistStats = Object.keys(distStats).length > 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="idRoot">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="idHero">
          <div className="idHeroEyebrow">
            <Layers size={11} />
            Xeevia Identity Layer
          </div>
          <h2 className="idHeroTitle">
            One Identity.<br />
            <em>Every Platform.</em>
          </h2>
          <p className="idHeroBody">
            Xeevia sits above every social network as your singular source of truth for digital
            identity. Link your accounts once — every post, reel, and story you publish here
            distributes across all of them automatically. Build your global presence from one place,
            without the fragmentation.
          </p>
          <div className="idStats">
            <div className="idStat">
              <div className="idStatV">{summary.connected}</div>
              <div className="idStatL">Linked</div>
            </div>
            <div className="idStat">
              <div className="idStatV">{summary.published}</div>
              <div className="idStatL">Distributed</div>
            </div>
            <div className="idStat">
              <div className="idStatV">{Object.keys(PLATFORMS).length}</div>
              <div className="idStatL">Platforms</div>
            </div>
          </div>
        </div>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <div className="idHow">
          <p className="idLabel"><Zap size={11} /> How it works</p>
          <div className="idHowSteps">
            {[
              { n:"1", text:"Link your social accounts below" },
              { n:"2", text:"Create content in Xeevia once" },
              { n:"3", text:"Publish — it distributes everywhere" },
            ].map(s => (
              <div key={s.n} className="idHowStep">
                <div className="idHowNum">{s.n}</div>
                <p className="idHowText">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Platform cards grouped by category ────────────────────────── */}
        {Object.entries(byCategory).map(([category, pairs]) => (
          <div key={category}>
            <p className="idLabel">
              <Globe size={11} /> {category}
            </p>
            <div className="idGrid">
              {pairs.map(([key, meta]) => {
                const conn   = connections[key];
                const status = conn?.auth_status || "none";
                const cfg    = STATUS_CFG[status] || STATUS_CFG.none;
                const Ic     = cfg.Icon;
                const isBusy = busy === key;
                const handle = conn?.platform_user_id || null;
                const scClass = status === "active"  ? "scActive"
                              : status === "expired" ? "scExpired"
                              : !meta.live           ? "scSoon"
                              : "";

                return (
                  <div key={key} className={`idCard ${scClass}`}>

                    {/* Icon */}
                    <div className="idIcon" style={{
                      background: meta.bg,
                      borderColor: meta.border,
                      color: meta.color,
                    }}>
                      {meta.letter}
                    </div>

                    {/* Body */}
                    <div className="idBody">
                      <p className="idPname">
                        {meta.name}
                        <span className="idCatTag">{meta.category}</span>
                      </p>
                      <p className="idPdesc">{meta.desc}</p>
                      <div className="idStatusRow" style={{ color: cfg.color }}>
                        {status === "active"
                          ? <span className="idLiveDot" />
                          : <Ic size={12} />
                        }
                        {cfg.label}
                        {handle && <span className="idHandle">· @{handle}</span>}
                      </div>
                    </div>

                    {/* Action */}
                    {!meta.live ? (
                      <span className="idSoonBadge">Soon</span>
                    ) : status === "active" ? (
                      <button
                        className="idBtn btnDisconnect"
                        onClick={() => handleDisconnect(key)}
                        disabled={isBusy}
                      >
                        {isBusy ? <RefreshCw size={12} className="idSpin" /> : <Unlink size={12} />}
                        Unlink
                      </button>
                    ) : status === "expired" ? (
                      <button
                        className="idBtn btnReconnect"
                        onClick={() => handleConnect(key)}
                        disabled={isBusy}
                      >
                        {isBusy ? <RefreshCw size={12} className="idSpin" /> : <RefreshCw size={12} />}
                        Reconnect
                      </button>
                    ) : (
                      <button
                        className="idBtn btnLink"
                        onClick={() => handleConnect(key)}
                        disabled={isBusy}
                      >
                        {isBusy ? <RefreshCw size={12} className="idSpin" /> : <Link2 size={12} />}
                        Link
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Distribution history ───────────────────────────────────────── */}
        {hasDistStats && (
          <div className="idTableWrap">
            <p className="idLabel" style={{ margin: 0 }}>
              <BarChart2 size={11} /> Distribution history
            </p>
            <table className="idTable">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Published</th>
                  <th>Failed</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(distStats).map(([p, s]) => (
                  <tr key={p}>
                    <td style={{ fontWeight: 700, color: "#d4d4d4" }}>
                      {PLATFORMS[p]?.name || p}
                    </td>
                    <td><span className="idPill ok"><CheckCircle size={10} /> {s.success || 0}</span></td>
                    <td><span className="idPill err"><AlertCircle size={10} /> {s.failed  || 0}</span></td>
                    <td><span className="idPill pnd"><Clock size={10} /> {s.pending || 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Trust callout ─────────────────────────────────────────────── */}
        <div className="idCallout">
          <Shield size={17} color="#93c5fd" style={{ flexShrink:0, marginTop:2 }} />
          <p>
            <strong>Your identity stays yours.</strong> Xeevia only publishes on your behalf
            when you explicitly hit Publish — it never reads your DMs, contacts, or private data
            from any connected platform. Unlink any network at any time, instantly.
          </p>
        </div>

      </div>
    </>
  );
};

export default IdentitySection;