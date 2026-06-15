// src/components/Account/IdentitySection.jsx
// ============================================================================
// Xeevia unified identity layer.
// Xeevia = singular source of truth for all digital identity.
// Connect networks here → everything you post distributes across all of them.
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  Globe, Link2, Unlink, CheckCircle, AlertCircle, Clock,
  RefreshCw, BarChart2, Shield, Zap,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLATFORMS = {
  x: {
    name: "X  (Twitter)",
    letter: "𝕏",
    color: "#e7e7e7",
    bg: "rgba(231,231,231,0.08)",
    border: "rgba(231,231,231,0.2)",
    desc: "Posts, threads & media to your X audience",
  },
  facebook: {
    name: "Facebook",
    letter: "f",
    color: "#5699f8",
    bg: "rgba(86,153,248,0.08)",
    border: "rgba(86,153,248,0.2)",
    desc: "Publish to your Facebook profile and pages",
  },
  instagram: {
    name: "Instagram",
    letter: "✦",
    color: "#f06a82",
    bg: "rgba(240,106,130,0.08)",
    border: "rgba(240,106,130,0.2)",
    desc: "Distribute photo & video content visually",
  },
  linkedin: {
    name: "LinkedIn",
    letter: "in",
    color: "#4a9de0",
    bg: "rgba(74,157,224,0.08)",
    border: "rgba(74,157,224,0.2)",
    desc: "Reach your professional network instantly",
  },
};

const STATUS = {
  active:  { label: "Connected",     color: "#84cc16", Icon: CheckCircle },
  expired: { label: "Token expired", color: "#f59e0b", Icon: AlertCircle },
  revoked: { label: "Disconnected",  color: "#ef4444", Icon: AlertCircle },
  none:    { label: "Not connected", color: "#525252", Icon: Clock       },
};

// ── Scoped styles ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes id-fade-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes id-spin { to { transform: rotate(360deg) } }

  .id-root { padding: 20px; display: flex; flex-direction: column; gap: 24px; animation: id-fade-in 0.35s ease; }

  /* Hero */
  .id-hero {
    background: linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.05) 100%);
    border: 1px solid rgba(139,92,246,0.25);
    border-radius: 22px; padding: 24px;
  }
  .id-hero-title {
    font-size: 19px; font-weight: 900; color: #c4b5fd;
    margin: 0 0 10px; display: flex; align-items: center; gap: 10px;
  }
  .id-hero-body { font-size: 13px; color: #a3a3a3; line-height: 1.7; margin: 0 0 20px; }
  .id-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
  .id-stat {
    text-align: center; padding: 14px 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
  }
  .id-stat-v { font-size: 24px; font-weight: 900; color: #c4b5fd; line-height: 1; margin-bottom: 4px; }
  .id-stat-l { font-size: 10px; color: #737373; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Section label */
  .id-label { font-size: 11px; font-weight: 800; color: #525252; text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 12px; }

  /* Platform card */
  .id-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px; padding: 18px;
    display: flex; align-items: center; gap: 16px;
    transition: border-color 0.2s, background 0.2s;
  }
  .id-card.status-active  { border-color: rgba(132,204,22,0.22); background: rgba(132,204,22,0.03); }
  .id-card.status-expired { border-color: rgba(245,158,11,0.22); background: rgba(245,158,11,0.03); }

  .id-icon {
    width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 900; border: 1px solid;
    font-style: normal;
  }
  .id-body { flex: 1; min-width: 0; }
  .id-pname { font-size: 15px; font-weight: 800; color: #f5f5f5; margin: 0 0 2px; }
  .id-pdesc { font-size: 12px; color: #737373; margin: 0 0 8px; line-height: 1.5; }
  .id-status-row { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; }
  .id-handle { color: #525252; font-weight: 500; }

  /* Buttons */
  .id-btn {
    flex-shrink: 0; display: flex; align-items: center; gap: 6px;
    padding: 9px 16px; border-radius: 10px; border: 1px solid;
    font-size: 12px; font-weight: 700; cursor: pointer;
    font-family: inherit; transition: background 0.15s, transform 0.1s; white-space: nowrap;
  }
  .id-btn:active { transform: scale(0.96); }
  .id-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .id-btn.connect    { background: rgba(139,92,246,0.1); border-color: rgba(139,92,246,0.4); color: #c4b5fd; }
  .id-btn.connect:hover:not(:disabled)    { background: rgba(139,92,246,0.18); }
  .id-btn.disconnect { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.3);  color: #f87171; }
  .id-btn.disconnect:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
  .id-btn.reconnect  { background: rgba(245,158,11,0.1);  border-color: rgba(245,158,11,0.35); color: #fbbf24; }
  .id-btn.reconnect:hover:not(:disabled)  { background: rgba(245,158,11,0.18); }
  .id-spin { animation: id-spin 0.8s linear infinite; }

  /* Stats table */
  .id-table-wrap {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px; padding: 18px;
  }
  .id-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .id-table th { font-size: 10px; font-weight: 700; color: #525252; text-transform: uppercase; letter-spacing: 0.4px; text-align: left; padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .id-table td { font-size: 12px; color: #a3a3a3; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  .id-table tr:last-child td { border-bottom: none; }
  .id-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .id-pill.ok  { background: rgba(132,204,22,0.12); color: #84cc16; }
  .id-pill.err { background: rgba(239,68,68,0.12);  color: #f87171; }
  .id-pill.pnd { background: rgba(245,158,11,0.12); color: #fbbf24; }

  /* Callout */
  .id-callout {
    background: rgba(96,165,250,0.05); border: 1px solid rgba(96,165,250,0.18);
    border-radius: 14px; padding: 16px;
    display: flex; gap: 12px; align-items: flex-start;
  }
  .id-callout-text { font-size: 12px; color: #94a3b8; line-height: 1.65; margin: 0; }
  .id-callout-text strong { color: #93c5fd; }

  /* Setup notice */
  .id-setup {
    background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2);
    border-radius: 16px; padding: 20px;
    display: flex; gap: 14px; align-items: flex-start;
  }
  .id-setup-text { font-size: 13px; color: #d4d4d4; line-height: 1.65; margin: 0; }
  .id-setup-text strong { color: #fbbf24; display: block; margin-bottom: 6px; font-size: 14px; }
  .id-setup-text code { display: block; margin-top: 10px; padding: 10px 12px; background: rgba(0,0,0,0.4); border-radius: 8px; font-family: monospace; font-size: 11px; color: #84cc16; line-height: 1.6; white-space: pre; overflow-x: auto; }

  @media (max-width: 440px) {
    .id-card { flex-wrap: wrap; }
    .id-btn  { flex: 1; justify-content: center; }
    .id-stats { grid-template-columns: repeat(3,1fr); }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
const IdentitySection = ({ userId }) => {
  const [connections,  setConnections]  = useState({});
  const [distStats,    setDistStats]    = useState({});
  const [summary,      setSummary]      = useState({ connected: 0, published: 0 });
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null); // which platform is pending
  const [setupNeeded,  setSetupNeeded]  = useState(false);
  const [fetchError,   setFetchError]   = useState(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [connRes, distRes] = await Promise.all([
        supabase
          .from("connections")
          .select("provider, platform_user_id, platform_username, auth_status, connected_at")
          .eq("user_id", userId),
        supabase
          .from("post_distribution")
          .select("platform, status")
          .eq("user_id", userId),
      ]);

      // Detect missing table (42P01 = undefined_table)
      if (connRes.error?.code === "42P01" || distRes.error?.code === "42P01") {
        setSetupNeeded(true);
        setLoading(false);
        return;
      }
      if (connRes.error) throw connRes.error;
      if (distRes.error) throw distRes.error;

      // Build connection map
      const connMap = {};
      (connRes.data || []).forEach(c => { connMap[c.provider] = c; });
      setConnections(connMap);

      // Build dist stats
      const statsMap = {};
      (distRes.data || []).forEach(d => {
        if (!statsMap[d.platform]) statsMap[d.platform] = { success: 0, failed: 0, pending: 0 };
        statsMap[d.platform][d.status] = (statsMap[d.platform][d.status] || 0) + 1;
      });
      setDistStats(statsMap);

      const activeCount  = Object.values(connMap).filter(c => c.auth_status === "active").length;
      const publishCount = (distRes.data || []).filter(d => d.status === "success").length;
      setSummary({ connected: activeCount, published: publishCount });

    } catch (err) {
      setFetchError(err?.message || "Failed to load identity data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  // ── Connect ────────────────────────────────────────────────────────────────
  const handleConnect = (platform) => {
    // Opens the OAuth flow — your backend handles the rest and writes to
    // the connections + tokens tables on the callback route.
    const url = `${window.location.origin}/api/auth/${platform}?user_id=${userId}&return_to=${encodeURIComponent(window.location.pathname)}`;
    window.location.href = url;
  };

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const handleDisconnect = async (platform) => {
    const meta = PLATFORMS[platform];
    if (!window.confirm(`Disconnect ${meta.name}? Posts already sent will stay on that platform.`)) return;
    setBusy(platform);
    try {
      const { error } = await supabase
        .from("connections")
        .update({ auth_status: "revoked", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider", platform);
      if (error) throw error;
      await load();
    } catch (err) {
      alert(err.message || "Failed to disconnect");
    } finally {
      setBusy(null);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: "48px", textAlign: "center", color: "#c4b5fd" }}>
      <div style={{ width: 40, height: 40, border: "3px solid rgba(196,181,253,0.2)", borderTop: "3px solid #c4b5fd", borderRadius: "50%", animation: "id-spin 0.8s linear infinite", margin: "0 auto 14px" }} />
      <style>{`@keyframes id-spin{to{transform:rotate(360deg)}}`}</style>
      Loading identity layer…
    </div>
  );

  if (setupNeeded) return (
    <>
      <style>{CSS}</style>
      <div className="id-root">
        <div className="id-setup">
          <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
          <p className="id-setup-text">
            <strong>One-time database setup needed</strong>
            The distribution tables haven't been created in Supabase yet.
            Paste the migration SQL into Supabase → SQL Editor → New Query → Run,
            then refresh this page. The SQL file is named
            <code>xeevia_distribution_migration.sql</code>
            and was provided in the last session's output files.
          </p>
        </div>
      </div>
    </>
  );

  if (fetchError) return (
    <>
      <style>{CSS}</style>
      <div className="id-root">
        <div className="id-setup">
          <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
          <p className="id-setup-text">
            <strong style={{ color: "#f87171" }}>Could not load identity data</strong>
            {fetchError}
          </p>
        </div>
        <button onClick={load} style={{ alignSelf: "flex-start", padding: "10px 20px", background: "#c4b5fd", border: "none", borderRadius: "10px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Retry
        </button>
      </div>
    </>
  );

  const hasDistStats = Object.keys(distStats).length > 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="id-root">

        {/* ── Hero ── */}
        <div className="id-hero">
          <h2 className="id-hero-title">
            <Globe size={20} /> Unified Identity
          </h2>
          <p className="id-hero-body">
            Xeevia is your singular source of truth for digital identity.
            Connect your social networks once — every post, reel, and story
            you publish here distributes across all of them automatically.
            Build your audience everywhere from one place.
          </p>
          <div className="id-stats">
            <div className="id-stat">
              <div className="id-stat-v">{summary.connected}</div>
              <div className="id-stat-l">Connected</div>
            </div>
            <div className="id-stat">
              <div className="id-stat-v">{summary.published}</div>
              <div className="id-stat-l">Distributed</div>
            </div>
            <div className="id-stat">
              <div className="id-stat-v">{Object.keys(PLATFORMS).length}</div>
              <div className="id-stat-l">Platforms</div>
            </div>
          </div>
        </div>

        {/* ── Platform cards ── */}
        <div>
          <p className="id-label">Your networks</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(PLATFORMS).map(([key, meta]) => {
              const conn   = connections[key];
              const status = conn?.auth_status || "none";
              const cfg    = STATUS[status];
              const Ic     = cfg.Icon;
              const isBusy = busy === key;

              return (
                <div key={key} className={`id-card status-${status}`}>

                  {/* Icon */}
                  <div className="id-icon" style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}>
                    {meta.letter}
                  </div>

                  {/* Body */}
                  <div className="id-body">
                    <p className="id-pname">{meta.name}</p>
                    <p className="id-pdesc">{meta.desc}</p>
                    <div className="id-status-row" style={{ color: cfg.color }}>
                      <Ic size={13} />
                      {cfg.label}
                      {conn?.platform_username && (
                        <span className="id-handle">· @{conn.platform_username}</span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  {status === "active" ? (
                    <button
                      className="id-btn disconnect"
                      onClick={() => handleDisconnect(key)}
                      disabled={isBusy}
                    >
                      {isBusy
                        ? <RefreshCw size={12} className="id-spin" />
                        : <Unlink size={12} />}
                      Disconnect
                    </button>
                  ) : status === "expired" ? (
                    <button
                      className="id-btn reconnect"
                      onClick={() => handleConnect(key)}
                      disabled={isBusy}
                    >
                      {isBusy
                        ? <RefreshCw size={12} className="id-spin" />
                        : <RefreshCw size={12} />}
                      Reconnect
                    </button>
                  ) : (
                    <button
                      className="id-btn connect"
                      onClick={() => handleConnect(key)}
                      disabled={isBusy}
                    >
                      {isBusy
                        ? <RefreshCw size={12} className="id-spin" />
                        : <Link2 size={12} />}
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Distribution history ── */}
        {hasDistStats && (
          <div className="id-table-wrap">
            <p className="id-label" style={{ margin: 0 }}>
              <BarChart2 size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
              Distribution history
            </p>
            <table className="id-table">
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
                    <td style={{ fontWeight: 700, color: "#d4d4d4" }}>{PLATFORMS[p]?.name || p}</td>
                    <td><span className="id-pill ok"><CheckCircle size={10} /> {s.success || 0}</span></td>
                    <td><span className="id-pill err"><AlertCircle size={10} /> {s.failed  || 0}</span></td>
                    <td><span className="id-pill pnd"><Clock size={10} /> {s.pending || 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Callout ── */}
        <div className="id-callout">
          <Shield size={17} color="#93c5fd" style={{ flexShrink: 0, marginTop: 1 }} />
          <p className="id-callout-text">
            <strong>Your identity stays yours.</strong> Xeevia only posts on your behalf
            when you explicitly publish — it never reads your DMs, contacts, or private data
            from any connected platform. Disconnect any network at any time instantly.
          </p>
        </div>

      </div>
    </>
  );
};

export default IdentitySection;