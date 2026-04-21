// src/components/Account/SecuritySection.jsx — v4 FORTRESS
// ============================================================================
// FIXES & IMPROVEMENTS vs v3:
//  [SEC-1] Withdrawal limits now match actual DB security_level 1–5:
//          L1=$100 L2=$250 L3=$500 L4=$2,000 L5=$10,000 (matching FAQ/docs)
//  [SEC-2] All DB calls use async/await + try/catch — no .catch() chaining
//  [SEC-3] PIN change correctly calls PinSetupModal with hasPin=true
//  [SEC-4] 2FA disable uses proper DB delete + profile update
//  [SEC-5] Security score calculates from actual DB state on every load
//  [SEC-6] Level upgrade logic accounts for phone verification (from profiles)
//  [SEC-7] Passkey error messages are user-friendly
//  [SEC-8] Sessions: "End All" correctly excludes current session by token
//  [SEC-9] Recovery phrase banner links directly to modal
//  [SEC-10] Security tip updated with correct withdrawal limits
// ============================================================================
import React, { useState, useEffect, useCallback, memo } from "react";
import {
  Shield, Smartphone, Key, Lock, AlertTriangle, CheckCircle, Loader,
  Eye, EyeOff, Fingerprint, ShieldCheck, Clock, Globe, Trash2,
  AlertOctagon, Info, ChevronDown, ChevronRight, XCircle, RefreshCw,
  Monitor, MapPin, Wifi, Phone,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import TwoFactorSetupModal from "../Modals/TwoFactorSetupModal";
import TwoFAModal          from "../Modals/TwoFAModal";
import StatusModal         from "../Modals/StatusModal";
import ConfirmModal        from "../Modals/ConfirmModal";
import PinSetupModal       from "../Modals/PinSetupModal";
import RecoveryPhraseModal        from "../Modals/RecoveryPhraseModal";
import PhoneVerificationModal     from "../Modals/PhoneVerificationModal";

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
@keyframes ssFade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@keyframes ssSpin{to{transform:rotate(360deg)}}
@keyframes ssPulse{0%,100%{opacity:1}50%{opacity:.4}}
.ss{animation:ssFade .3s ease;padding:12px 14px 28px}

.sr{display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:12px;margin-bottom:5px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);transition:all .15s;cursor:default}
.sr:hover{background:rgba(255,255,255,.04);border-color:rgba(132,204,22,.15)}
.sr.on{background:rgba(132,204,22,.05);border-color:rgba(132,204,22,.18)}
.sr.click{cursor:pointer}
.sr.click:active{transform:scale(.98)}

.si{width:32px;height:32px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(132,204,22,.09);border:1px solid rgba(132,204,22,.16);color:#84cc16}
.si.r{background:rgba(239,68,68,.09);border-color:rgba(239,68,68,.16);color:#ef4444}
.si.a{background:rgba(251,191,36,.09);border-color:rgba(251,191,36,.16);color:#fbbf24}
.si.b{background:rgba(96,165,250,.09);border-color:rgba(96,165,250,.16);color:#60a5fa}
.si.p{background:rgba(167,139,250,.09);border-color:rgba(167,139,250,.16);color:#a78bfa}

.sl{font-size:13px;font-weight:700;color:#e5e5e5;line-height:1;margin:0 0 2px}
.sd{font-size:10.5px;color:#4a4a4a;font-weight:500;line-height:1}

.ck{padding:3px 8px;border-radius:20px;font-size:9.5px;font-weight:800;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;flex-shrink:0}
.ck.g{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.18)}
.ck.rr{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.18)}
.ck.a{background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.18)}

.sg{font-size:9.5px;font-weight:800;color:#333;letter-spacing:.08em;text-transform:uppercase;padding:10px 2px 5px;margin:0}

.sc{padding:14px;border-radius:14px;background:linear-gradient(145deg,rgba(132,204,22,.06),rgba(132,204,22,.02));border:1px solid rgba(132,204,22,.16);margin-bottom:12px;position:relative;overflow:hidden}

.sa{padding:9px 11px;border-radius:10px;margin-bottom:8px;display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.6}
.sa.red{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.13);color:#ef4444}
.sa.amb{background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.13);color:#fbbf24}
.sa.blu{background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.13);color:#60a5fa}
.sa.grn{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.13);color:#22c55e}

.sin{width:100%;padding:9px 11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:9px;color:#fff;font-size:12.5px;box-sizing:border-box;outline:none;transition:border .15s}
.sin:focus{border-color:rgba(132,204,22,.5)}

.bl{padding:8px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#84cc16,#65a30d);color:#000;font-size:11.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s}
.bl:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 2px 10px rgba(132,204,22,.28)}
.bl:disabled{opacity:.45;cursor:not-allowed}
.bg{padding:8px 12px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#5a5a5a;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.bg:hover{background:rgba(255,255,255,.08);color:#999}
.br{padding:8px 12px;border-radius:9px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.17);color:#ef4444;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.br:hover{background:rgba(239,68,68,.13)}

.sess-card{display:flex;gap:10px;padding:10px;border-bottom:1px solid rgba(255,255,255,.04);align-items:flex-start}
.sess-card:last-child{border-bottom:none}
.sess-device-icon{width:36px;height:36px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.sess-info{flex:1;min-width:0}
.sess-name{font-size:12px;font-weight:700;color:#d4d4d4;margin:0 0 3px}
.sess-meta{font-size:10px;color:#3a3a3a;display:flex;flex-direction:column;gap:2px}
.sess-meta-row{display:flex;align-items:center;gap:4px}
.sess-current{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);border-radius:5px;color:#22c55e;font-size:9px;font-weight:800}

/* [SEC-1] Withdrawal limit table */
.wl-table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px}
.wl-table th{padding:5px 8px;text-align:left;color:#484848;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid rgba(255,255,255,.05)}
.wl-table td{padding:6px 8px;color:#9ca3af;border-bottom:1px solid rgba(255,255,255,.03)}
.wl-table tr.current-level td{color:#fff;background:rgba(132,204,22,.04)}
.wl-table tr.current-level td:first-child{color:#84cc16;font-weight:800}
`;

// [SEC-1] CORRECT withdrawal limits per security level
const SECURITY_LEVELS = {
  1: { label: "Basic",   color: "#ef4444", pct: 20,  dailyLimit: "$100"    },
  2: { label: "Low",     color: "#f59e0b", pct: 40,  dailyLimit: "$250"    },
  3: { label: "Medium",  color: "#eab308", pct: 60,  dailyLimit: "$500"    },
  4: { label: "High",    color: "#84cc16", pct: 80,  dailyLimit: "$2,000"  },
  5: { label: "Maximum", color: "#22c55e", pct: 100, dailyLimit: "$10,000" },
};

function fmtAgo(d) {
  if (!d) return "Never";
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d ago`;
  return new Date(d).toLocaleDateString();
}

function parseBrowser(ua) {
  if (!ua) return "Unknown";
  if (ua.includes("Edg"))    return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox"))return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera"))  return "Opera";
  return "Browser";
}

function parseOS(ua) {
  if (!ua) return "Unknown";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Android"))  return "Android";
  if (ua.includes("Windows"))  return "Windows";
  if (ua.includes("Mac OS"))   return "macOS";
  if (ua.includes("Linux"))    return "Linux";
  return "Unknown OS";
}

function isMobileUA(ua) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua || "");
}

// ── [SEC-5] Calculate true security level from actual DB state ────────────────
async function computeSecurityLevel(userId, profileData) {
  let level = 1;
  // 2FA enabled (+2)
  const { data: tfa } = await supabase
    .from("two_factor_auth")
    .select("enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (tfa?.enabled) level = Math.min(level + 2, 5);

  // Phone verified (+1)
  if (profileData?.phone_verified) level = Math.min(level + 1, 5);

  // PIN set (+0.5 → round up at level 3)
  const { data: wallet } = await supabase
    .from("wallets")
    .select("withdrawal_pin_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (wallet?.withdrawal_pin_hash) level = Math.min(level + 1, 5);

  return Math.max(1, Math.min(level, 5));
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const SecuritySection = ({ userId }) => {
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [level,       setLevel]       = useState(1);
  const [has2FA,      set2FA]         = useState(false);
  const [hasKey,      setKey]         = useState(false);
  const [hasPin,      setPin]         = useState(false);
  const [hasPhrase,   setHasPhrase]   = useState(false);
  const [pinLen,      setPinLen]      = useState(null);
  const [phoneVer,    setPhoneVer]    = useState(false);
  const [failed,      setFailed]      = useState(0);
  const [locked,      setLocked]      = useState(false);
  const [lockUntil,   setLockUntil]   = useState(null);
  const [sessions,    setSessions]    = useState([]);
  const [devices,     setDevices]     = useState([]);
  const [events,      setEvents]      = useState([]);
  const [lastPwd,     setLastPwd]     = useState(null);
  const [currentToken, setCurrentToken] = useState(null);

  const [open, setOpen] = useState(null);
  const tog = (k) => setOpen((o) => (o === k ? null : k));

  // Password form
  const [cp, setCp]     = useState("");
  const [np, setNp]     = useState("");
  const [cfp, setCfp]   = useState("");
  const [shCp, setShCp] = useState(false);
  const [shNp, setShNp] = useState(false);
  const [pstr, setPstr] = useState(0);

  useEffect(() => {
    let s = 0;
    if (np.length >= 8)  s += 20;
    if (np.length >= 12) s += 10;
    if (np.length >= 16) s += 10;
    if (/[a-z]/.test(np)) s += 15;
    if (/[A-Z]/.test(np)) s += 15;
    if (/\d/.test(np))    s += 15;
    if (/[^a-zA-Z0-9]/.test(np)) s += 15;
    setPstr(Math.min(s, 100));
  }, [np]);

  const pstrC = pstr < 30 ? "#ef4444" : pstr < 60 ? "#f59e0b" : pstr < 80 ? "#eab308" : "#22c55e";
  const pstrL = pstr < 30 ? "Weak" : pstr < 60 ? "Fair" : pstr < 80 ? "Good" : "Strong";

  // Modals
  const [m2faSetup, set2FASetup] = useState(false);
  const [mPin,      setMPin]     = useState(false);
  const [mRec,      setMRec]     = useState(false);
  const [mPhone,    setMPhone]   = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [status,    setStatus]   = useState({ show: false, type: "success", message: "" });
  const [confirm,   setConfirm]  = useState({ show: false, title: "", message: "", action: null, dangerous: false });

  const showSt = (t, m) => setStatus({ show: true, type: t, message: m });
  const hideSt = ()     => setStatus(s => ({ ...s, show: false }));
  const showCf = (t, m, a, dangerous = false) => setConfirm({ show: true, title: t, message: m, action: a, dangerous });
  const hideCf = ()     => setConfirm(c => ({ ...c, show: false }));

  // ── [SEC-2] Load — all async/await ────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { session: curSess } } = await supabase.auth.getSession();
      setCurrentToken(curSess?.access_token || null);

      const [pR, fR, wR, dR, sR, eR] = await Promise.allSettled([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("two_factor_auth").select("enabled").eq("user_id", userId).maybeSingle(),
        supabase.from("wallets").select("withdrawal_pin_hash,pin_length,recovery_phrase_encrypted").eq("user_id", userId).maybeSingle(),
        supabase.from("trusted_devices").select("*").eq("user_id", userId).eq("revoked", false),
        supabase.from("user_sessions").select("*").eq("user_id", userId).eq("is_active", true).order("last_activity", { ascending: false }),
        supabase.from("security_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
      ]);

      const profile = pR.status === "fulfilled" ? pR.value.data : null;
      if (profile) {
        setFailed(profile.failed_login_attempts || 0);
        setLocked(!!profile.account_locked_until && new Date(profile.account_locked_until) > new Date());
        setLockUntil(profile.account_locked_until);
        setLastPwd(profile.password_changed_at);
        setKey(profile.fingerprint_enabled || profile.facial_verification_enabled || false);
        setPhoneVer(profile.phone_verified || false);
        if (profile.email) setUserEmail(profile.email);
      }

      // Also grab email from auth session as fallback
      if (!userEmail) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) setUserEmail(session.user.email);
      }

      const tfa = fR.status === "fulfilled" ? fR.value.data : null;
      set2FA(tfa?.enabled || false);

      const wallet = wR.status === "fulfilled" ? wR.value.data : null;
      setPin(!!wallet?.withdrawal_pin_hash);
      setPinLen(wallet?.pin_length || null);
      setHasPhrase(!!wallet?.recovery_phrase_encrypted);

      if (dR.status === "fulfilled") setDevices(dR.value.data || []);
      if (sR.status === "fulfilled") setSessions(sR.value.data || []);
      if (eR.status === "fulfilled") setEvents(eR.value.data || []);

      // [SEC-5] Compute true security level
      const computed = await computeSecurityLevel(userId, profile);
      setLevel(computed);

      // Sync computed level to DB if it drifted
      if (profile && profile.security_level !== computed) {
        await supabase.from("profiles")
          .update({ security_level: computed, updated_at: new Date().toISOString() })
          .eq("id", userId);
      }
    } catch (e) {
      console.error("Security load error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  // ── [SEC-4] Disable 2FA ───────────────────────────────────────────────────
  const disable2FA = () => showCf(
    "Disable 2FA?",
    "Two-factor authentication protects your account against unauthorized access. Are you sure you want to disable it?",
    async () => {
      hideCf();
      setSaving(true);
      try {
        const { error: delErr } = await supabase
          .from("two_factor_auth")
          .delete()
          .eq("user_id", userId);
        if (delErr) throw delErr;

        await supabase.from("profiles")
          .update({ require_2fa: false, updated_at: new Date().toISOString() })
          .eq("id", userId);

        await supabase.from("security_events")
          .insert({ user_id: userId, event_type: "2fa_disabled", severity: "warning", metadata: {} });

        set2FA(false);
        showSt("success", "2FA has been disabled.");
        load();
      } catch (e) {
        showSt("error", e.message || "Failed to disable 2FA.");
      } finally {
        setSaving(false);
      }
    },
    true // dangerous
  );

  // ── Passkey ───────────────────────────────────────────────────────────────
  const enablePasskey = async () => {
    if (!window.PublicKeyCredential) {
      return showSt("error", "Your browser doesn't support passkeys. Try Chrome, Safari, or Edge.");
    }
    const avail = await window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable()
      .catch(() => false);
    if (!avail) {
      return showSt("error", "No biometric sensor found. Enable fingerprint or Face ID first.");
    }
    try {
      setSaving(true);
      const ch = new Uint8Array(32);
      crypto.getRandomValues(ch);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: ch,
          rp: { name: "Xeevia", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(userId),
            name: userId,
            displayName: "Xeevia User",
          },
          pubKeyCredParams: [
            { alg: -7,   type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      });
      if (!cred) throw new Error("No credential was created.");

      await supabase.from("profiles")
        .update({ fingerprint_enabled: true, updated_at: new Date().toISOString() })
        .eq("id", userId);

      await supabase.from("security_events")
        .insert({ user_id: userId, event_type: "device_trusted", severity: "info", metadata: { type: "passkey" } });

      setKey(true);
      showSt("success", "Passkey enabled! You can now use biometrics to authenticate.");
      load();
    } catch (e) {
      if (e.name === "NotAllowedError") {
        showSt("error", "Passkey setup was cancelled or timed out.");
      } else {
        showSt("error", "Failed to enable passkey. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Password change ───────────────────────────────────────────────────────
  const changePwd = async () => {
    if (!cp || !np || !cfp) return showSt("error", "Please fill all password fields.");
    if (np !== cfp)          return showSt("error", "New passwords don't match.");
    if (np.length < 8)       return showSt("error", "Password must be at least 8 characters.");
    if (pstr < 40)           return showSt("error", "Password is too weak. Add uppercase, numbers and symbols.");
    try {
      setSaving(true);
      const { error: authErr } = await supabase.auth.updateUser({ password: np });
      if (authErr) throw authErr;

      await supabase.from("profiles")
        .update({ password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", userId);

      await supabase.from("security_events")
        .insert({ user_id: userId, event_type: "password_changed", severity: "info", metadata: {} });

      setCp(""); setNp(""); setCfp(""); setOpen(null);
      showSt("success", "Password updated successfully!");
      load();
    } catch (e) {
      showSt("error", e.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  // ── [SEC-8] Sessions ──────────────────────────────────────────────────────
  const endSession = (id) => showCf(
    "End Session?",
    "This device will be signed out immediately.",
    async () => {
      hideCf();
      setSaving(true);
      try {
        await supabase.from("user_sessions")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("id", id);
        showSt("success", "Session ended.");
        load();
      } catch (e) {
        showSt("error", "Failed to end session.");
      } finally {
        setSaving(false);
      }
    }
  );

  const endAllSessions = () => showCf(
    "End All Other Sessions?",
    "All other devices will be signed out immediately. You will remain signed in on this device.",
    async () => {
      hideCf();
      setSaving(true);
      try {
        const query = supabase.from("user_sessions")
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("is_active", true);

        // Exclude current session if we have its token
        if (currentToken) {
          query.neq("session_token", currentToken);
        }

        await query;
        showSt("success", "All other sessions ended.");
        load();
      } catch (e) {
        showSt("error", "Failed to end sessions.");
      } finally {
        setSaving(false);
      }
    },
    true
  );

  const revokeDevice = (id) => showCf(
    "Revoke Device?",
    "This device will be removed from your trusted list and will need to pass 2FA again.",
    async () => {
      hideCf();
      setSaving(true);
      try {
        await supabase.from("trusted_devices")
          .update({ revoked: true, revoked_at: new Date().toISOString() })
          .eq("id", id);
        showSt("success", "Device revoked.");
        load();
      } catch (e) {
        showSt("error", "Failed to revoke device.");
      } finally {
        setSaving(false);
      }
    }
  );

  const si = SECURITY_LEVELS[level] || SECURITY_LEVELS[1];

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 20px", gap: 10 }}>
      <style>{`@keyframes ssSpin{to{transform:rotate(360deg)}}`}</style>
      <Loader size={26} style={{ animation: "ssSpin 1s linear infinite", color: "#84cc16" }} />
      <p style={{ color: "#454545", fontSize: 12 }}>Loading security settings…</p>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="ss">

        {/* ── Alerts ── */}
        {locked && (
          <div className="sa red">
            <AlertOctagon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><strong>Account locked</strong> — Too many failed login attempts. Unlocks {fmtAgo(lockUntil)}</div>
          </div>
        )}
        {failed > 0 && !locked && (
          <div className="sa amb">
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <div><strong>{failed}</strong> failed login attempt{failed > 1 ? "s" : ""} on your account</div>
          </div>
        )}
        {!hasPhrase && (
          <div className="sa amb" style={{ cursor: "pointer" }} onClick={() => setMRec(true)}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Action required:</strong> Set up your recovery phrase to protect your wallet.{" "}
              <span style={{ color: "#fbbf24", textDecoration: "underline", fontWeight: 700 }}>Set up now →</span>
            </div>
          </div>
        )}

        {/* ── Security Score ── */}
        <div className="sc">
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${si.color},transparent)`, borderRadius: "14px 14px 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1 }}>Security Score</div>
              <div style={{ fontSize: 10.5, color: "#3a3a3a", marginTop: 2 }}>{si.label} protection · {si.dailyLimit}/day withdrawal limit</div>
            </div>
            <div style={{ padding: "3px 10px", borderRadius: 8, background: `${si.color}18`, color: si.color, fontSize: 12, fontWeight: 900, border: `1.5px solid ${si.color}28` }}>
              Level {level}
            </div>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,.05)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", width: `${si.pct}%`, background: `linear-gradient(90deg,${si.color},${si.color}88)`, borderRadius: 3, transition: "width .8s cubic-bezier(.4,0,.2,1)", boxShadow: `0 0 6px ${si.color}40` }} />
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["2FA",    has2FA],
              ["Passkey", hasKey],
              ["PIN",     hasPin],
              ["Phrase",  hasPhrase],
              ["Phone",   phoneVer],
            ].map(([l, ok]) => (
              <span key={l} className={`ck ${ok ? "g" : "rr"}`}>
                {ok ? <CheckCircle size={7} /> : <XCircle size={7} />} {l}
              </span>
            ))}
          </div>

          {/* [SEC-1] Withdrawal limits table */}
          <details style={{ cursor: "pointer" }}>
            <summary style={{ fontSize: 10.5, color: "#484848", fontWeight: 700, userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <ChevronDown size={10} /> View all withdrawal limits
            </summary>
            <table className="wl-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Daily Limit</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(SECURITY_LEVELS).map(([lv, cfg]) => (
                  <tr key={lv} className={Number(lv) === level ? "current-level" : ""}>
                    <td>Level {lv}</td>
                    <td>{cfg.label}</td>
                    <td>{cfg.dailyLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        {/* ── Authentication ── */}
        <p className="sg">Authentication</p>

        <div className={`sr ${has2FA ? "on" : ""}`}>
          <div className="si"><ShieldCheck size={15} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sl">Two-Factor Authentication</p>
            <p className="sd">TOTP authenticator app (Google Auth, Authy)</p>
          </div>
          <span className={`ck ${has2FA ? "g" : "rr"}`}>
            {has2FA ? <CheckCircle size={7} /> : <XCircle size={7} />} {has2FA ? "On" : "Off"}
          </span>
          {!has2FA
            ? <button className="bl" onClick={() => set2FASetup(true)} disabled={saving}>Enable</button>
            : <button className="br" style={{ padding: "5px 9px", fontSize: 10 }} onClick={disable2FA} disabled={saving}><XCircle size={10} /> Disable</button>
          }
        </div>

        <div className={`sr ${hasKey ? "on" : ""}`}>
          <div className="si"><Fingerprint size={15} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sl">Passkey & Biometrics</p>
            <p className="sd">Fingerprint · Face ID · Device PIN</p>
          </div>
          <span className={`ck ${hasKey ? "g" : "rr"}`}>
            {hasKey ? <CheckCircle size={7} /> : <XCircle size={7} />} {hasKey ? "Active" : "Off"}
          </span>
          {!hasKey && (
            <button className="bl" onClick={enablePasskey} disabled={saving}>
              {saving ? "…" : "Enable"}
            </button>
          )}
        </div>

        <div className={`sr click ${phoneVer ? "on" : ""}`} onClick={() => setMPhone(true)}>
          <div className="si b"><Phone size={15} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sl">Phone Verification</p>
            <p className="sd">{phoneVer ? "Phone number verified — tap to change" : "Not verified — tap to verify and unlock Level 4"}</p>
          </div>
          <span className={`ck ${phoneVer ? "g" : "a"}`}>
            {phoneVer ? <CheckCircle size={7} /> : <AlertTriangle size={7} />} {phoneVer ? "Verified" : "Pending"}
          </span>
          {!phoneVer && (
            <button className="bl" onClick={(e) => { e.stopPropagation(); setMPhone(true); }} disabled={saving} style={{ fontSize: 10, padding: "5px 9px" }}>
              Verify
            </button>
          )}
          <ChevronRight size={13} color="#2e2e2e" />
        </div>

        {/* ── Wallet Security ── */}
        <p className="sg">Wallet Security</p>

        <div className={`sr click ${hasPin ? "on" : ""}`} onClick={() => setMPin(true)}>
          <div className="si"><Lock size={15} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sl">{hasPin ? "Change Transaction PIN" : "Set Transaction PIN"}</p>
            <p className="sd">{hasPin ? `${pinLen || "?"}-digit PIN active — required for all withdrawals` : "No PIN set — tap to create one now"}</p>
          </div>
          <span className={`ck ${hasPin ? "g" : "rr"}`}>
            {hasPin ? <CheckCircle size={7} /> : <XCircle size={7} />} {hasPin ? "Set" : "None"}
          </span>
        </div>

        <div className={`sr click ${hasPhrase ? "on" : ""}`} onClick={() => setMRec(true)}>
          <div className="si a"><Key size={15} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="sl">Recovery Phrase</p>
            <p className="sd">{hasPhrase ? "12-word backup saved — tap to view" : "⚠️ Not set — your wallet has no backup"}</p>
          </div>
          <span className={`ck ${hasPhrase ? "g" : "a"}`}>
            {hasPhrase ? <CheckCircle size={7} /> : <AlertTriangle size={7} />} {hasPhrase ? "Set" : "Missing"}
          </span>
        </div>

        {/* ── Account ── */}
        <p className="sg">Account</p>

        {/* Password — expandable */}
        <div className={`sr ${open === "pwd" ? "on" : ""}`} style={{ flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => tog("pwd")}>
            <div className="si a"><Lock size={15} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="sl">Password</p>
              <p className="sd">{lastPwd ? `Last changed ${fmtAgo(lastPwd)}` : "Not recently changed"}</p>
            </div>
            <ChevronDown size={13} color="#2e2e2e" style={{ transform: open === "pwd" ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </div>
          {open === "pwd" && (
            <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 12 }}>
              {[
                { label: "Current Password",  v: cp,  set: setCp,  sh: shCp, tog: () => setShCp((s) => !s) },
                { label: "New Password",       v: np,  set: setNp,  sh: shNp, tog: () => setShNp((s) => !s), str: true },
                { label: "Confirm New Password", v: cfp, set: setCfp, noTog: true },
              ].map(({ label, v, set, sh, tog: tg, str, noTog }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 9.5, color: "#3a3a3a", fontWeight: 700, marginBottom: 5, letterSpacing: ".04em" }}>
                    {label.toUpperCase()}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={sh || noTog ? "text" : "password"}
                      className="sin"
                      value={v}
                      onChange={(e) => set(e.target.value)}
                      placeholder="••••••••"
                    />
                    {!noTog && (
                      <button onClick={tg} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#454545" }}>
                        {sh ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                  {str && v && (
                    <>
                      <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, marginTop: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pstr}%`, background: pstrC, borderRadius: 2, transition: "all .3s" }} />
                      </div>
                      <span style={{ fontSize: 9.5, color: pstrC, fontWeight: 700 }}>{pstrL} password</span>
                    </>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
                <button className="bl" onClick={changePwd} disabled={saving || !cp || !np || !cfp}>
                  {saving
                    ? <><Loader size={10} style={{ animation: "ssSpin 1s linear infinite" }} /> Saving…</>
                    : <><CheckCircle size={10} /> Update Password</>
                  }
                </button>
                <button className="bg" onClick={() => { setOpen(null); setCp(""); setNp(""); setCfp(""); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Active Sessions ── */}
        {sessions.length > 0 && (
          <>
            <p className="sg">Active Sessions ({sessions.length})</p>
            <div className={`sr ${open === "sess" ? "on" : ""}`} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => tog("sess")}>
                <div className="si b"><Globe size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="sl">Signed-in Devices</p>
                  <p className="sd">{sessions.length} active session{sessions.length !== 1 ? "s" : ""} across your devices</p>
                </div>
                <ChevronDown size={13} color="#2e2e2e" style={{ transform: open === "sess" ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </div>
              {open === "sess" && (
                <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 4 }}>
                  {sessions.map((s) => {
                    const ua      = s.user_agent || "";
                    const browser = parseBrowser(ua);
                    const os      = parseOS(ua);
                    const mobile  = isMobileUA(ua);
                    const isCurrent = s.session_token === currentToken;
                    const loc     = s.location_data;
                    const locStr  = loc?.city && loc?.country
                      ? `${loc.city}, ${loc.country}`
                      : loc?.city || loc?.country || null;

                    return (
                      <div key={s.id} className="sess-card">
                        <div className="sess-device-icon" style={{
                          background: mobile ? "rgba(96,165,250,0.1)" : "rgba(132,204,22,0.1)",
                          border: `1px solid ${mobile ? "rgba(96,165,250,0.2)" : "rgba(132,204,22,0.2)"}`,
                        }}>
                          {mobile ? <Smartphone size={16} color="#60a5fa" /> : <Monitor size={16} color="#84cc16" />}
                        </div>
                        <div className="sess-info">
                          <div className="sess-name">
                            {browser} on {os}
                            {isCurrent && <span className="sess-current" style={{ marginLeft: 6 }}>● This device</span>}
                          </div>
                          <div className="sess-meta">
                            {s.ip_address && (
                              <div className="sess-meta-row">
                                <Wifi size={9} color="#444" /><span>{s.ip_address}</span>
                              </div>
                            )}
                            {locStr && (
                              <div className="sess-meta-row">
                                <MapPin size={9} color="#444" /><span>{locStr}</span>
                              </div>
                            )}
                            <div className="sess-meta-row">
                              <Clock size={9} color="#444" /><span>Last active {fmtAgo(s.last_activity)}</span>
                            </div>
                            <div className="sess-meta-row" style={{ color: "#2a2a2a" }}>
                              <span>Signed in {new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        {!isCurrent && (
                          <button className="br" style={{ padding: "5px 8px", fontSize: 10, flexShrink: 0, alignSelf: "center" }}
                            onClick={() => endSession(s.id)} disabled={saving}>
                            End
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {sessions.length > 1 && (
                    <button className="br" style={{ margin: "8px 10px 4px", width: "calc(100% - 20px)", justifyContent: "center" }}
                      onClick={endAllSessions} disabled={saving}>
                      <Trash2 size={10} /> End All Other Sessions
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Trusted Devices ── */}
        {devices.length > 0 && (
          <>
            <p className="sg">Trusted Devices</p>
            <div className={`sr ${open === "dev" ? "on" : ""}`} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => tog("dev")}>
                <div className="si"><Smartphone size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="sl">Trusted Devices</p>
                  <p className="sd">{devices.length} device{devices.length !== 1 ? "s" : ""} skip 2FA verification</p>
                </div>
                <ChevronDown size={13} color="#2e2e2e" style={{ transform: open === "dev" ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </div>
              {open === "dev" && (
                <div style={{ marginTop: 9, borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 9 }}>
                  {devices.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#d4d4d4" }}>{d.device_name || "Unknown device"}</div>
                        <div style={{ fontSize: 10, color: "#3a3a3a" }}>Trusted {fmtAgo(d.trusted_at)}</div>
                      </div>
                      <button className="br" style={{ padding: "4px 9px", fontSize: 10 }} onClick={() => revokeDevice(d.id)} disabled={saving}>
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Recent Security Events ── */}
        {events.length > 0 && (
          <>
            <p className="sg">Recent Security Activity</p>
            <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.055)", borderRadius: 12, overflow: "hidden" }}>
              {events.map((e, i) => {
                const c = { critical: "#ef4444", warning: "#f59e0b", info: "#353535" }[e.severity] || "#353535";
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", borderBottom: i < events.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#888", flex: 1 }}>
                      {e.event_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </div>
                    <div style={{ fontSize: 10, color: "#333" }}>{fmtAgo(e.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* [SEC-10] Security tips */}
        <div className="sa blu" style={{ marginTop: 14 }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Reach Level 5</strong> to unlock a $10,000/day withdrawal limit. Enable 2FA (+2 levels), verify your phone (+1), and set a transaction PIN (+1).
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      <TwoFactorSetupModal
        show={m2faSetup}
        onClose={() => set2FASetup(false)}
        userId={userId}
        onSuccess={() => {
          set2FA(true);
          showSt("success", "2FA enabled! Your account is now more secure.");
          load();
        }}
      />
      <TwoFAModal show={false} onClose={() => {}} userId={userId} onSuccess={() => {}} />

      {mPin && (
        <PinSetupModal
          userId={userId}
          hasPin={hasPin}
          currentPinLength={pinLen}
          onClose={() => setMPin(false)}
          onSuccess={({ pinLength: nl }) => {
            setPin(true);
            setPinLen(nl);
            setMPin(false);
            showSt("success", `${nl}-digit PIN ${hasPin ? "updated" : "created"} successfully!`);
            load();
          }}
        />
      )}

      {mRec && (
        <RecoveryPhraseModal
          userId={userId}
          onClose={() => { setMRec(false); load(); }}
        />
      )}

      {mPhone && (
        <PhoneVerificationModal
          show={mPhone}
          onClose={() => setMPhone(false)}
          userId={userId}
          userEmail={userEmail}
          currentPhone={phoneVer ? undefined : undefined}
          onSuccess={(verifiedPhone) => {
            setMPhone(false);
            setPhoneVer(true);
            showSt("success", "Phone verified! Your security level has been updated.");
            load();
          }}
        />
      )}

      <StatusModal {...status} onClose={hideSt} />
      <ConfirmModal
        show={confirm.show}
        title={confirm.title}
        message={confirm.message}
        dangerous={confirm.dangerous}
        onConfirm={() => { confirm.action?.(); hideCf(); }}
        onCancel={hideCf}
      />
    </>
  );
};

export default memo(SecuritySection);