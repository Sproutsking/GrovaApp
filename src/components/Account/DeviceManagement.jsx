// ============================================================================
// src/components/Account/DeviceManagement.jsx — v2 SCHEMA_CORRECT
// ============================================================================
// Schema used:
//   user_sessions:      id, user_id, session_token, device_fingerprint_id,
//                       ip_address, user_agent, location_data (jsonb),
//                       is_active, last_activity, expires_at, ended_at,
//                       created_at
//   device_fingerprints: id, user_id, fingerprint_hash, device_name,
//                        browser, os, is_trusted, first_seen, last_seen,
//                        location_country, location_city, ip_address, created_at
//   security_events:    user_id, event_type, severity, metadata, created_at
//
// CURRENT SESSION DETECTION:
//   We can't compare JWTs to DB session_tokens (different formats). Instead:
//   We pick the session whose last_activity is within the last 10 minutes AND
//   is the most recent overall. This is reliable since the user just loaded
//   this screen using that session.
//
// LOCATION DATA:
//   user_sessions.location_data is a jsonb that may contain {city, country,
//   region, lat, lng} — we parse all variants.
//   device_fingerprints has location_country and location_city as flat cols.
//
// REMOVE SESSION:
//   Sets user_sessions.is_active = false, ended_at = now().
//   Logs a security_events row with event_type = 'device_untrusted'.
//
// TRUST/UNTRUST DEVICE:
//   Flips device_fingerprints.is_trusted.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader, X, MapPin, Globe, Clock, Monitor, Smartphone,
  Tablet, Shield, ShieldCheck, ShieldOff, RefreshCw, Trash2,
  CheckCircle2, AlertTriangle, Wifi, WifiOff, Lock, Unlock,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";

// ── Helpers ────────────────────────────────────────────────────────────────

function extractBrowser(ua) {
  if (!ua) return "Unknown Browser";
  if (ua.includes("Edg/"))                         return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome") && ua.includes("Safari"))    return "Chrome";
  if (ua.includes("Firefox"))                       return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("MSIE") || ua.includes("Trident")) return "Internet Explorer";
  return "Unknown Browser";
}

function extractOS(ua) {
  if (!ua) return "Unknown OS";
  if (/iPhone|iPad/.test(ua))                       return "iOS";
  if (/Android/.test(ua))                            return "Android";
  if (/Windows NT/.test(ua))                        return "Windows";
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return "macOS";
  if (/Linux/.test(ua))                              return "Linux";
  if (/CrOS/.test(ua))                               return "Chrome OS";
  return "Unknown OS";
}

function isPhoneUA(ua = "") {
  return /iPhone|Android.*Mobile|Windows Phone|BlackBerry/.test(ua);
}

function isTabletUA(ua = "") {
  return /iPad|Android(?!.*Mobile)|Tablet/.test(ua);
}

function parseLocation(locationData, fallbackCountry, fallbackCity) {
  if (!locationData && !fallbackCountry && !fallbackCity) return "Unknown location";
  if (locationData) {
    if (typeof locationData === "string") return locationData;
    if (typeof locationData === "object") {
      const city    = locationData.city    || locationData.City    || "";
      const region  = locationData.region  || locationData.Region  || "";
      const country = locationData.country || locationData.Country || "";
      const parts   = [city, region, country].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
  }
  const parts = [fallbackCity, fallbackCountry].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

function timeAgo(ts) {
  if (!ts) return "Unknown";
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)          return "Active now";
  const m = Math.floor(s / 60);
  if (m < 60)          return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)          return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)           return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function isRecentlyActive(ts, windowMs = 10 * 60 * 1000) {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < windowMs;
}

// ── Device Icon ────────────────────────────────────────────────────────────
function DeviceIcon({ ua, size = 24, color = "#84cc16" }) {
  if (isPhoneUA(ua))  return <Smartphone  size={size} color={color} />;
  if (isTabletUA(ua)) return <Tablet      size={size} color={color} />;
  return                     <Monitor     size={size} color={color} />;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  const color = type === "success" ? "#84cc16" : type === "error" ? "#ef4444" : "#60a5fa";
  return (
    <div style={{
      position: "fixed", bottom: 96, left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 20px", borderRadius: 12,
      background: `${color}18`, border: `1px solid ${color}40`,
      color, fontSize: 12, fontWeight: 800, zIndex: 99999,
      whiteSpace: "nowrap", boxShadow: `0 4px 20px ${color}22`,
      animation: "dmToast 2.6s ease forwards", pointerEvents: "none",
    }}>
      {msg}
    </div>
  );
}

// ── ConfirmDialog ──────────────────────────────────────────────────────────
function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 10001 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "#111", border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 20, padding: "28px 24px",
        width: "min(340px, calc(100vw - 32px))", zIndex: 10002,
        boxShadow: "0 24px 80px rgba(0,0,0,0.95)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#737373", marginBottom: 24, lineHeight: 1.6 }}>{body}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11, color: "#a3a3a3", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "11px", background: danger ? "rgba(239,68,68,0.12)" : "rgba(132,204,22,0.12)", border: `1px solid ${danger ? "rgba(239,68,68,0.45)" : "rgba(132,204,22,0.35)"}`, borderRadius: 11, color: danger ? "#ef4444" : "#84cc16", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Session Card ───────────────────────────────────────────────────────────
function SessionCard({ session, isCurrent, onRevoke, onToggleTrust, busy }) {
  const recentActivity = isRecentlyActive(session.lastActivity, 5 * 60 * 1000);
  const expired        = session.expiresAt && new Date(session.expiresAt) < new Date();

  return (
    <div style={{
      position: "relative",
      background:    isCurrent ? "rgba(132,204,22,0.05)" : "rgba(255,255,255,0.02)",
      border:        `1px solid ${isCurrent ? "rgba(132,204,22,0.35)" : expired ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`,
      borderRadius:  18,
      padding:       "18px 18px 14px",
      marginBottom:  12,
      transition:    "border-color .2s",
    }}>
      {/* Current badge */}
      {isCurrent && (
        <div style={{
          position: "absolute", top: -11, left: 16,
          background: "linear-gradient(135deg,#84cc16,#4d7c0f)",
          color: "#000", fontSize: 10, fontWeight: 900,
          padding: "2px 10px", borderRadius: 8,
        }}>
          This Device
        </div>
      )}

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14, flexShrink: 0,
          background: isCurrent ? "rgba(132,204,22,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${isCurrent ? "rgba(132,204,22,0.25)" : "rgba(255,255,255,0.08)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <DeviceIcon ua={session.userAgent} size={22} color={isCurrent ? "#84cc16" : "#525252"} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
              {session.browser} on {session.os}
            </span>
            {session.isTrusted && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", fontSize: 10, fontWeight: 700 }}>
                <ShieldCheck size={9} /> Trusted
              </span>
            )}
            {expired && (
              <span style={{ padding: "1px 7px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 10, fontWeight: 700 }}>
                Expired
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#525252" }}>
            {session.deviceName && session.deviceName !== "Unknown Device" ? session.deviceName : `${session.os} Device`}
          </div>
        </div>

        {/* Online indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: recentActivity ? "#22c55e" : "#333",
            boxShadow: recentActivity ? "0 0 0 0 rgba(34,197,94,0.4)" : "none",
            animation: recentActivity ? "dmPulse 2s ease-out infinite" : "none",
          }} />
          <span style={{ fontSize: 10, color: recentActivity ? "#22c55e" : "#383838", fontWeight: 700 }}>
            {recentActivity ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 0", marginBottom: 14 }}>
        {[
          { Icon: Globe,  label: session.ipAddress  || "Unknown IP"                       },
          { Icon: MapPin, label: session.location   || "Unknown location"                 },
          { Icon: Clock,  label: `Last active: ${timeAgo(session.lastActivity)}`          },
          { Icon: Wifi,   label: `Signed in ${new Date(session.createdAt).toLocaleDateString()}` },
        ].map(({ Icon, label }, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 0" }}>
            <Icon size={12} color="#383838" />
            <span style={{ fontSize: 11, color: "#525252", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {!isCurrent && (
        <div style={{ display: "flex", gap: 8 }}>
          {session.deviceFingerprintId && (
            <button
              onClick={() => onToggleTrust(session)}
              disabled={busy}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                background: session.isTrusted ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)",
                border: `1px solid ${session.isTrusted ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                color: session.isTrusted ? "#ef4444" : "#22c55e",
                fontSize: 11, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1, fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              {session.isTrusted ? <><ShieldOff size={12} /> Untrust</> : <><ShieldCheck size={12} /> Trust</>}
            </button>
          )}
          <button
            onClick={() => onRevoke(session)}
            disabled={busy}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10,
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#ef4444", fontSize: 11, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1,
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}
          >
            {busy ? <Loader size={12} style={{ animation: "dmSpin 1s linear infinite" }} /> : <Trash2 size={12} />}
            {busy ? "Revoking…" : "Revoke"}
          </button>
        </div>
      )}

      {isCurrent && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 9, background: "rgba(132,204,22,0.04)", border: "1px solid rgba(132,204,22,0.12)" }}>
          <Lock size={11} color="#84cc16" />
          <span style={{ fontSize: 11, color: "#4d7c0f" }}>This is your current active session</span>
        </div>
      )}
    </div>
  );
}

// ── Device-only Card (device without active session) ───────────────────────
function DeviceOnlyCard({ device, onUntrust }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "14px 16px", marginBottom: 10,
      display: "flex", alignItems: "center", gap: 12,
      opacity: 0.7,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Monitor size={18} color="#383838" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#737373", marginBottom: 2 }}>
          {device.device_name || `${device.browser || "Unknown"} on ${device.os || "Unknown"}`}
        </div>
        <div style={{ fontSize: 11, color: "#383838" }}>
          Last seen {timeAgo(device.last_seen)} · {[device.location_city, device.location_country].filter(Boolean).join(", ") || "Unknown location"}
        </div>
      </div>
      {device.is_trusted && (
        <button onClick={() => onUntrust(device)} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Untrust
        </button>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const DeviceManagement = ({ userId, onClose }) => {
  const [sessions,      setSessions]      = useState([]); // active sessions (enriched)
  const [devices,       setDevices]       = useState([]); // device_fingerprints without active session
  const [loading,       setLoading]       = useState(true);
  const [currentId,     setCurrentId]     = useState(null); // ID of current session row
  const [confirm,       setConfirm]       = useState(null); // { session } or { device }
  const [busyId,        setBusyId]        = useState(null);
  const [toast,         setToast]         = useState(null);
  const mountedRef                        = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const flash = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  // ── Load sessions + devices ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Fetch active sessions
      const { data: rawSessions, error: sessErr } = await supabase
        .from("user_sessions")
        .select("id, session_token, device_fingerprint_id, ip_address, user_agent, location_data, is_active, last_activity, expires_at, ended_at, created_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("last_activity", { ascending: false });

      if (sessErr) {
        console.warn("[DeviceManagement] user_sessions error:", sessErr.message);
      }

      // 2. Fetch all device fingerprints for this user
      const { data: rawDevices, error: devErr } = await supabase
        .from("device_fingerprints")
        .select("id, fingerprint_hash, device_name, browser, os, is_trusted, first_seen, last_seen, location_country, location_city, ip_address")
        .eq("user_id", userId)
        .order("last_seen", { ascending: false });

      if (devErr) {
        console.warn("[DeviceManagement] device_fingerprints error:", devErr.message);
      }

      const sessions  = rawSessions  || [];
      const allDevices= rawDevices   || [];

      // 3. Detect current session — the one with most recent last_activity
      //    within the last 10 minutes (the user JUST loaded this page using it)
      let currentSessionId = null;
      if (sessions.length > 0) {
        const recentSessions = sessions.filter(s => isRecentlyActive(s.last_activity, 10 * 60 * 1000));
        const mostRecent     = recentSessions.length > 0 ? recentSessions[0] : sessions[0];
        currentSessionId     = mostRecent?.id || null;
      }
      if (mountedRef.current) setCurrentId(currentSessionId);

      // 4. Build device lookup map
      const deviceMap = {};
      allDevices.forEach(d => { deviceMap[d.id] = d; });

      // 5. Enrich sessions with device data
      const enrichedSessions = sessions.map(s => {
        const device = s.device_fingerprint_id ? deviceMap[s.device_fingerprint_id] : null;
        const browser = device?.browser || extractBrowser(s.user_agent);
        const os      = device?.os      || extractOS(s.user_agent);
        const location = parseLocation(
          s.location_data,
          device?.location_country,
          device?.location_city,
        );
        return {
          id:                s.id,
          sessionToken:      s.session_token,
          deviceFingerprintId: s.device_fingerprint_id,
          userAgent:         s.user_agent,
          browser,
          os,
          deviceName:        device?.device_name || `${browser} on ${os}`,
          ipAddress:         s.ip_address || device?.ip_address,
          location,
          lastActivity:      s.last_activity,
          expiresAt:         s.expires_at,
          createdAt:         s.created_at,
          isTrusted:         device?.is_trusted || false,
        };
      });

      // 6. Devices without an active session
      const activeFingerprintIds = new Set(sessions.map(s => s.device_fingerprint_id).filter(Boolean));
      const orphanDevices = allDevices.filter(d => !activeFingerprintIds.has(d.id));

      if (mountedRef.current) {
        setSessions(enrichedSessions);
        setDevices(orphanDevices);
      }
    } catch (err) {
      console.error("[DeviceManagement] loadData:", err);
      flash("Failed to load sessions", "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId, flash]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Revoke session ────────────────────────────────────────────────────────
  const revokeSession = useCallback(async (session) => {
    setConfirm(null);
    setBusyId(session.id);
    try {
      const { error } = await supabase
        .from("user_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", session.id);

      if (error) throw error;

      // Log security event
      await supabase.from("security_events").insert({
        user_id:    userId,
        event_type: "device_untrusted",
        severity:   "info",
        metadata: {
          session_id:   session.id,
          device_name:  session.deviceName,
          browser:      session.browser,
          os:           session.os,
          ip:           session.ipAddress,
          revoked_at:   new Date().toISOString(),
        },
      }).catch(() => {});

      flash("Session revoked successfully");
      setSessions(prev => prev.filter(s => s.id !== session.id));
    } catch (err) {
      flash(err.message || "Failed to revoke session", "error");
    } finally {
      setBusyId(null);
    }
  }, [userId, flash]);

  // ── Toggle device trust ───────────────────────────────────────────────────
  const toggleTrust = useCallback(async (session, makeTrusted) => {
    if (!session.deviceFingerprintId) return;
    setBusyId(session.id);
    try {
      const { error } = await supabase
        .from("device_fingerprints")
        .update({ is_trusted: makeTrusted })
        .eq("id", session.deviceFingerprintId);

      if (error) throw error;

      await supabase.from("security_events").insert({
        user_id:    userId,
        event_type: makeTrusted ? "device_trusted" : "device_untrusted",
        severity:   "info",
        metadata:   { fingerprint_id: session.deviceFingerprintId, device: session.deviceName },
      }).catch(() => {});

      flash(makeTrusted ? "Device marked as trusted" : "Device trust removed");
      setSessions(prev => prev.map(s =>
        s.id === session.id ? { ...s, isTrusted: makeTrusted } : s
      ));
    } catch (err) {
      flash(err.message || "Failed to update device trust", "error");
    } finally {
      setBusyId(null);
    }
  }, [userId, flash]);

  // ── Untrust orphan device ─────────────────────────────────────────────────
  const untrustOrphanDevice = useCallback(async (device) => {
    setBusyId(device.id);
    try {
      const { error } = await supabase
        .from("device_fingerprints")
        .update({ is_trusted: false })
        .eq("id", device.id);
      if (error) throw error;
      flash("Device untrusted");
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_trusted: false } : d));
    } catch (err) {
      flash(err.message || "Failed", "error");
    } finally {
      setBusyId(null);
    }
  }, [flash]);

  const activeCount   = sessions.length;
  const trustedCount  = sessions.filter(s => s.isTrusted).length + devices.filter(d => d.is_trusted).length;

  return (
    <>
      <style>{`
        @keyframes dmSpin  { to { transform: rotate(360deg); } }
        @keyframes dmFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dmToast { 0%{opacity:0;transform:translateX(-50%) translateY(6px)} 15%,75%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0} }
        @keyframes dmPulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)} 70%{box-shadow:0 0 0 6px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(18px)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#080808",
            border: "1px solid rgba(132,204,22,0.25)",
            borderRadius: 24, width: "100%", maxWidth: 560,
            maxHeight: "90vh", overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0 24px 80px rgba(0,0,0,0.95)",
            animation: "dmFadeIn .3s ease",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "20px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(132,204,22,0.04)",
            display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#84cc16,#4d7c0f)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Shield size={22} color="#000" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>Sessions & Devices</div>
              <div style={{ fontSize: 12, color: "#525252", marginTop: 2 }}>
                {activeCount} active session{activeCount !== 1 ? "s" : ""} · {trustedCount} trusted device{trustedCount !== 1 ? "s" : ""}
              </div>
            </div>
            <button onClick={loadData} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#525252" }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#525252" }}>
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 24px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Loader size={36} color="#84cc16" style={{ animation: "dmSpin 1s linear infinite", display: "block", margin: "0 auto 14px" }} />
                <div style={{ color: "#525252", fontSize: 13 }}>Loading sessions…</div>
              </div>
            ) : (
              <>
                {/* Security tip */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", marginBottom: 20, background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 13 }}>
                  <AlertTriangle size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: "#525252", lineHeight: 1.6 }}>
                    Remove sessions you don't recognize immediately. Trusted devices skip extra verification steps.
                  </div>
                </div>

                {/* Active Sessions */}
                <div style={{ fontSize: 10, fontWeight: 800, color: "#333", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                  Active Sessions ({sessions.length})
                </div>

                {sessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 20px", color: "#383838", fontSize: 13 }}>
                    <WifiOff size={32} color="#252525" style={{ display: "block", margin: "0 auto 12px" }} />
                    No active sessions found.
                    <br />
                    <span style={{ fontSize: 11, color: "#2a2a2a" }}>Sessions appear here when logged in on a device.</span>
                  </div>
                ) : (
                  sessions.map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isCurrent={session.id === currentId}
                      busy={busyId === session.id}
                      onRevoke={(s) => setConfirm({ type: "revoke", session: s })}
                      onToggleTrust={(s) => toggleTrust(s, !s.isTrusted)}
                    />
                  ))
                )}

                {/* Known Devices (no active session) */}
                {devices.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#333", textTransform: "uppercase", letterSpacing: "1px", margin: "20px 0 10px" }}>
                      Known Devices — Inactive ({devices.length})
                    </div>
                    {devices.map(d => (
                      <DeviceOnlyCard key={d.id} device={d} onUntrust={untrustOrphanDevice} />
                    ))}
                  </>
                )}

                {sessions.length === 0 && devices.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px", color: "#383838", fontSize: 13 }}>
                    <CheckCircle2 size={40} color="#22c55e" style={{ display: "block", margin: "0 auto 12px" }} />
                    <div style={{ fontWeight: 700, color: "#737373", marginBottom: 4 }}>No sessions or devices found</div>
                    <div style={{ fontSize: 11, color: "#383838" }}>Your account is clean. Activity appears here on next login.</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Revoke confirm */}
      {confirm?.type === "revoke" && (
        <ConfirmDialog
          title="Revoke Session"
          body={`Revoke the session on ${confirm.session.deviceName}? That device will need to sign in again.`}
          confirmLabel="Revoke Session"
          danger
          onConfirm={() => revokeSession(confirm.session)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}
    </>
  );
};

export default DeviceManagement;