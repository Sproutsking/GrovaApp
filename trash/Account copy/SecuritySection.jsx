// src/components/Account/SecuritySection.jsx — FIXED
// KEY CHANGE: profiles query uses maybeSingle() not single(), all queries in Promise.allSettled
import React, { useState, useEffect, useCallback, memo } from "react";
import {
  Shield,
  Smartphone,
  Key,
  Lock,
  AlertTriangle,
  CheckCircle,
  Loader,
  Eye,
  EyeOff,
  Fingerprint,
  ShieldCheck,
  Clock,
  Globe,
  Trash2,
  XCircle,
  AlertOctagon,
  Info,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import { ensureValidSession } from "../../services/auth/sessionRefresh";
import TwoFactorSetupModal from "../Modals/TwoFactorSetupModal";
import TwoFAModal from "../Modals/TwoFAModal";
import StatusModal from "../Modals/StatusModal";
import ConfirmModal from "../Modals/ConfirmModal";

async function ensureSession() {
  const session = await ensureValidSession();
  if (!session) throw new Error("SESSION_EXPIRED");
  return session;
}

const SecuritySection = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [securityLevel, setSecurityLevel] = useState(1);
  const [has2FA, setHas2FA] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [hasWithdrawalPin, setHasWithdrawalPin] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState(null);
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [lastPasswordChange, setLastPasswordChange] = useState(null);
  const [showPinSection, setShowPinSection] = useState(false);
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FAVerify, setShow2FAVerify] = useState(false);
  const [statusModal, setStatusModal] = useState({
    show: false,
    type: "success",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: "",
    message: "",
    action: null,
  });

  const loadSecurityData = useCallback(async () => {
    try {
      setLoading(true);
      await ensureSession().catch(() => null);

      // FIX: Promise.allSettled so one failing query never kills the rest
      // FIX: profiles uses maybeSingle() — single() throws 406 and crashes everything
      const [profileR, twoFAR, walletR, devicesR, sessionsR, eventsR] =
        await Promise.allSettled([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase
            .from("two_factor_auth")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("wallets")
            .select("withdrawal_pin_hash")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("trusted_devices")
            .select("*")
            .eq("user_id", userId)
            .eq("revoked", false),
          supabase
            .from("user_sessions")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true),
          supabase
            .from("security_events")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      // Profile — safe extraction
      if (
        profileR.status === "fulfilled" &&
        !profileR.value.error &&
        profileR.value.data
      ) {
        const p = profileR.value.data;
        setSecurityLevel(p.security_level || 1);
        setFailedAttempts(p.failed_login_attempts || 0);
        setAccountLocked(
          !!p.account_locked_until &&
            new Date(p.account_locked_until) > new Date(),
        );
        setLockUntil(p.account_locked_until);
        setLastPasswordChange(p.password_changed_at);
        setHasPasskey(
          p.fingerprint_enabled || p.facial_verification_enabled || false,
        );
      } else if (profileR.status === "fulfilled" && profileR.value.error) {
        console.warn(
          "⚠️ SecuritySection profile query:",
          profileR.value.error.message,
        );
      }

      if (twoFAR.status === "fulfilled" && twoFAR.value.data)
        setHas2FA(twoFAR.value.data.enabled || false);
      if (walletR.status === "fulfilled" && walletR.value.data)
        setHasWithdrawalPin(!!walletR.value.data.withdrawal_pin_hash);
      if (devicesR.status === "fulfilled" && devicesR.value.data)
        setTrustedDevices(devicesR.value.data || []);
      if (sessionsR.status === "fulfilled" && sessionsR.value.data)
        setActiveSessions(sessionsR.value.data || []);
      if (eventsR.status === "fulfilled" && eventsR.value.data)
        setRecentEvents(eventsR.value.data || []);
    } catch (err) {
      console.warn("[SecuritySection] load error:", err?.message);
      showStatus("error", "Failed to load security settings.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadSecurityData();
  }, [userId, loadSecurityData]);

  useEffect(() => {
    if (newPassword) calculatePasswordStrength(newPassword);
    else setPasswordStrength(0);
  }, [newPassword]);

  const showStatus = (type, message) =>
    setStatusModal({ show: true, type, message });
  const hideStatus = () =>
    setStatusModal({ show: false, type: "success", message: "" });
  const showConfirm = (title, message, action) =>
    setConfirmModal({ show: true, title, message, action });
  const hideConfirm = () =>
    setConfirmModal({ show: false, title: "", message: "", action: null });

  const calculatePasswordStrength = (password) => {
    let s = 0;
    if (password.length >= 8) s += 20;
    if (password.length >= 12) s += 10;
    if (password.length >= 16) s += 10;
    if (/[a-z]/.test(password)) s += 15;
    if (/[A-Z]/.test(password)) s += 15;
    if (/[0-9]/.test(password)) s += 15;
    if (/[^a-zA-Z0-9]/.test(password)) s += 15;
    setPasswordStrength(Math.min(s, 100));
  };

  const getStrengthColor = () =>
    passwordStrength < 30
      ? "#ef4444"
      : passwordStrength < 60
        ? "#f59e0b"
        : passwordStrength < 80
          ? "#eab308"
          : "#22c55e";
  const getStrengthLabel = () =>
    passwordStrength < 30
      ? "Weak"
      : passwordStrength < 60
        ? "Fair"
        : passwordStrength < 80
          ? "Good"
          : "Strong";

  const updateSecurityLevel = async (level) => {
    try {
      await supabase
        .from("profiles")
        .update({ security_level: level, updated_at: new Date().toISOString() })
        .eq("id", userId);
      setSecurityLevel(level);
    } catch (e) {
      console.warn("updateSecurityLevel:", e?.message);
    }
  };

  const logSecurityEvent = async (
    eventType,
    severity = "info",
    metadata = {},
  ) => {
    try {
      await supabase.from("security_events").insert({
        user_id: userId,
        event_type: eventType,
        severity,
        metadata: { ...metadata, timestamp: new Date().toISOString() },
      });
    } catch {
      /* non-critical */
    }
  };

  const handle2FASetupSuccess = async () => {
    setHas2FA(true);
    await updateSecurityLevel(5);
    showStatus("success", "Two-Factor Authentication enabled!");
    await loadSecurityData();
  };

  const handleDisable2FA = () =>
    showConfirm(
      "Disable Two-Factor Authentication",
      "This will reduce your account security.",
      async () => {
        try {
          hideConfirm();
          setSaving(true);
          await ensureSession();
          const { error } = await supabase
            .from("two_factor_auth")
            .delete()
            .eq("user_id", userId);
          if (error) throw error;
          await Promise.all([
            logSecurityEvent("2fa_disabled", "warning"),
            supabase
              .from("profiles")
              .update({
                require_2fa: false,
                security_level: 3,
                updated_at: new Date().toISOString(),
              })
              .eq("id", userId),
          ]);
          setHas2FA(false);
          setSecurityLevel(3);
          showStatus("success", "Two-Factor Authentication disabled.");
          await loadSecurityData();
        } catch (e) {
          showStatus(
            "error",
            e.message === "SESSION_EXPIRED"
              ? "Session expired. Please refresh."
              : "Failed to disable 2FA.",
          );
        } finally {
          setSaving(false);
        }
      },
    );

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showStatus("error", "Fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showStatus("error", "Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      showStatus("error", "Password must be at least 8 characters.");
      return;
    }
    if (passwordStrength < 60) {
      showStatus("error", "Password is too weak.");
      return;
    }
    try {
      setSaving(true);
      await ensureSession();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      await Promise.all([
        logSecurityEvent("password_changed", "info"),
        supabase
          .from("profiles")
          .update({
            password_changed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId),
      ]);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
      showStatus("success", "Password changed successfully!");
      await loadSecurityData();
    } catch (e) {
      showStatus(
        "error",
        e.message === "SESSION_EXPIRED"
          ? "Session expired. Please refresh."
          : e.message || "Failed to change password.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetWithdrawalPin = async () => {
    if (!withdrawalPin || !confirmPin) {
      showStatus("error", "Enter and confirm your PIN.");
      return;
    }
    if (withdrawalPin !== confirmPin) {
      showStatus("error", "PINs do not match.");
      return;
    }
    if (!/^\d{4,6}$/.test(withdrawalPin)) {
      showStatus("error", "PIN must be 4-6 digits.");
      return;
    }
    try {
      setSaving(true);
      await ensureSession();
      const pinHash = btoa(withdrawalPin + userId);
      const { error } = await supabase
        .from("wallets")
        .update({
          withdrawal_pin_hash: pinHash,
          pin_attempts: 0,
          pin_locked_until: null,
        })
        .eq("user_id", userId);
      if (error) throw error;
      await logSecurityEvent("withdrawal_pin_set", "info");
      setWithdrawalPin("");
      setConfirmPin("");
      setShowPinSection(false);
      setHasWithdrawalPin(true);
      showStatus("success", "Withdrawal PIN set!");
    } catch (e) {
      showStatus(
        "error",
        e.message === "SESSION_EXPIRED"
          ? "Session expired."
          : "Failed to set PIN.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePasskey = async () => {
    if (!window.PublicKeyCredential) {
      showStatus("error", "Passkeys not supported on this device.");
      return;
    }
    const avail =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
        () => false,
      );
    if (!avail) {
      showStatus("error", "No biometric sensor found on this device.");
      return;
    }
    try {
      setSaving(true);
      await ensureSession();
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Xeevia", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(userId),
            name: userId,
            displayName: "Xeevia User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
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
      if (!cred) throw new Error("No credential returned.");
      await Promise.all([
        supabase
          .from("profiles")
          .update({
            fingerprint_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId),
        logSecurityEvent("device_trusted", "info", { type: "passkey" }),
      ]);
      setHasPasskey(true);
      await updateSecurityLevel(Math.max(securityLevel, 4));
      showStatus("success", "Passkey enabled!");
      await loadSecurityData();
    } catch (e) {
      if (e.name === "NotAllowedError")
        showStatus("error", "Passkey setup cancelled.");
      else if (e.message === "SESSION_EXPIRED")
        showStatus("error", "Session expired.");
      else showStatus("error", "Failed to enable passkey.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeDevice = (id) =>
    showConfirm(
      "Revoke Device",
      "You'll need to re-authenticate from this device.",
      async () => {
        try {
          hideConfirm();
          setSaving(true);
          await ensureSession();
          await supabase
            .from("trusted_devices")
            .update({ revoked: true, revoked_at: new Date().toISOString() })
            .eq("id", id);
          showStatus("success", "Device revoked.");
          await loadSecurityData();
        } catch {
          showStatus("error", "Failed to revoke device.");
        } finally {
          setSaving(false);
        }
      },
    );

  const handleTerminateSession = (id) =>
    showConfirm(
      "Terminate Session",
      "This will sign out this session.",
      async () => {
        try {
          hideConfirm();
          setSaving(true);
          await ensureSession();
          await supabase
            .from("user_sessions")
            .update({ is_active: false, ended_at: new Date().toISOString() })
            .eq("id", id);
          showStatus("success", "Session terminated.");
          await loadSecurityData();
        } catch {
          showStatus("error", "Failed.");
        } finally {
          setSaving(false);
        }
      },
    );

  const handleTerminateAllSessions = () =>
    showConfirm(
      "Sign Out All Other Devices",
      "All other sessions will be terminated.",
      async () => {
        try {
          hideConfirm();
          setSaving(true);
          const session = await ensureSession();
          await supabase
            .from("user_sessions")
            .update({ is_active: false, ended_at: new Date().toISOString() })
            .eq("user_id", userId)
            .neq("session_token", session.access_token);
          showStatus("success", "All other sessions terminated.");
          await loadSecurityData();
        } catch {
          showStatus("error", "Failed.");
        } finally {
          setSaving(false);
        }
      },
    );

  const secLevels = {
    1: {
      label: "Basic",
      color: "#ef4444",
      desc: "Minimal security — password only",
    },
    2: {
      label: "Low",
      color: "#f59e0b",
      desc: "Basic protection with email verification",
    },
    3: {
      label: "Medium",
      color: "#eab308",
      desc: "Good protection with phone verification",
    },
    4: {
      label: "High",
      color: "#84cc16",
      desc: "Strong protection with passkey",
    },
    5: {
      label: "Maximum",
      color: "#22c55e",
      desc: "Maximum security with 2FA",
    },
  };
  const secInfo = secLevels[securityLevel] || {
    label: "Unknown",
    color: "#737373",
    desc: "",
  };

  const fmtDate = (d) => {
    if (!d) return "Never";
    const dt = new Date(d);
    const dm = Math.floor((Date.now() - dt) / 60000);
    const dh = Math.floor(dm / 60);
    const dd = Math.floor(dh / 24);
    if (dm < 1) return "Just now";
    if (dm < 60) return `${dm}m ago`;
    if (dh < 24) return `${dh}h ago`;
    if (dd < 7) return `${dd}d ago`;
    return dt.toLocaleDateString();
  };
  const evtIcon = (t) =>
    ({
      login_success: <CheckCircle size={16} />,
      login_failed: <XCircle size={16} />,
      "2fa_enabled": <ShieldCheck size={16} />,
      "2fa_verified": <ShieldCheck size={16} />,
      "2fa_failed": <AlertTriangle size={16} />,
      password_changed: <Key size={16} />,
      device_trusted: <Smartphone size={16} />,
      account_locked: <Lock size={16} />,
    })[t] || <Info size={16} />;
  const evtColor = (s) =>
    ({ critical: "#ef4444", warning: "#f59e0b", info: "#84cc16" })[s] ||
    "#737373";

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
          gap: "16px",
        }}
      >
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Loader
          size={32}
          style={{ animation: "spin 1s linear infinite", color: "#84cc16" }}
        />
        <p style={{ color: "#a3a3a3" }}>Loading security settings...</p>
      </div>
    );

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .sec-section{padding:20px;animation:slideIn .4s ease}
        .sec-card{background:linear-gradient(135deg,rgba(132,204,22,.05),rgba(132,204,22,.02));border:1px solid rgba(132,204,22,.3);border-radius:20px;padding:28px;margin-bottom:24px;position:relative;overflow:hidden}
        .sec-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#84cc16,#65a30d)}
        .sec-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
        .sec-card-left{display:flex;align-items:center;gap:12px}
        .sec-icon-wrap{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#84cc16,#65a30d);display:flex;align-items:center;justify-content:center;color:#000;box-shadow:0 4px 16px rgba(132,204,22,.4)}
        .sec-card-title{font-size:20px;font-weight:800;color:#fff;margin:0}
        .sec-level-badge{padding:8px 20px;border-radius:12px;font-size:14px;font-weight:800;display:inline-flex;align-items:center;gap:8px}
        .sec-feature{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px;margin-bottom:16px}
        .sec-feature-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .sec-feature-left{display:flex;align-items:center;gap:12px}
        .sec-feature-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(132,204,22,.1);color:#84cc16}
        .sec-feature-title{font-size:16px;font-weight:700;color:#fff}
        .sec-feature-desc{font-size:13px;color:#737373;line-height:1.5}
        .sec-status{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px}
        .sec-status-enabled{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3)}
        .sec-status-disabled{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
        .sec-btn{padding:10px 20px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px;border:none}
        .sec-btn-primary{background:linear-gradient(135deg,#84cc16,#65a30d);color:#000}
        .sec-btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 4px 16px rgba(132,204,22,.4)}
        .sec-btn-danger{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
        .sec-btn-danger:hover:not(:disabled){background:rgba(239,68,68,.2)}
        .sec-btn:disabled{opacity:.5;cursor:not-allowed}
        .sec-input-group{margin-bottom:16px}
        .sec-input-label{display:block;color:#a3a3a3;font-size:13px;font-weight:600;margin-bottom:8px}
        .sec-input-wrapper{position:relative}
        .sec-input{width:100%;padding:14px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(132,204,22,.2);border-radius:10px;color:#fff;font-size:14px;transition:all .2s;box-sizing:border-box}
        .sec-input:focus{outline:none;border-color:#84cc16}
        .sec-input-icon{position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;color:#737373}
        .sec-strength-bar{height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;margin-top:8px}
        .sec-device-item{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .sec-device-name{font-size:14px;font-weight:700;color:#fff;margin-bottom:4px}
        .sec-device-meta{font-size:12px;color:#737373}
        .sec-event-item{display:flex;align-items:flex-start;gap:12px;padding:14px;background:rgba(255,255,255,.02);border-radius:10px;margin-bottom:10px}
        .sec-event-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .sec-event-title{font-size:14px;font-weight:600;color:#fff;margin-bottom:4px}
        .sec-event-time{font-size:12px;color:#737373}
        .sec-alert{padding:16px;border-radius:12px;margin-bottom:24px;display:flex;align-items:flex-start;gap:12px}
        .sec-alert-warning{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24}
        .sec-alert-danger{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444}
        .sec-alert-info{background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:#3b82f6}
      `}</style>

      <div className="sec-section">
        {accountLocked && (
          <div className="sec-alert sec-alert-danger">
            <AlertOctagon size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  marginBottom: "4px",
                }}
              >
                Account Locked
              </div>
              <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                Locked due to failed login attempts. Unlocks{" "}
                {fmtDate(lockUntil)}.
              </div>
            </div>
          </div>
        )}
        {failedAttempts > 0 && !accountLocked && (
          <div className="sec-alert sec-alert-warning">
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: "13px" }}>
              <strong>{failedAttempts}</strong> failed login attempt
              {failedAttempts > 1 ? "s" : ""} detected.
            </div>
          </div>
        )}

        {/* Security Overview */}
        <div className="sec-card">
          <div className="sec-card-header">
            <div className="sec-card-left">
              <div className="sec-icon-wrap">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="sec-card-title">Security Overview</h3>
                <p
                  style={{
                    color: "#737373",
                    fontSize: "13px",
                    margin: "4px 0 0",
                  }}
                >
                  Your current security status
                </p>
              </div>
            </div>
            <div
              className="sec-level-badge"
              style={{
                background: `${secInfo.color}20`,
                color: secInfo.color,
                border: `2px solid ${secInfo.color}40`,
              }}
            >
              <Shield size={16} /> Level {securityLevel}: {secInfo.label}
            </div>
          </div>
          <p
            style={{
              color: "#a3a3a3",
              fontSize: "14px",
              marginBottom: "24px",
              lineHeight: "1.6",
            }}
          >
            {secInfo.desc}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: "16px",
            }}
          >
            {[
              { label: "Two-Factor Auth", ok: has2FA, i: ["🔒", "🔓"] },
              { label: "Passkey / Biometric", ok: hasPasskey, i: ["🔑", "🚫"] },
              {
                label: "Withdrawal PIN",
                ok: hasWithdrawalPin,
                i: ["💰", "⚠️"],
              },
            ].map(({ label, ok, i }) => (
              <div
                key={label}
                style={{
                  background: ok ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
                  border: `1px solid ${ok ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                  {ok ? i[0] : i[1]}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#fff",
                    marginBottom: "4px",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: ok ? "#22c55e" : "#ef4444",
                    fontWeight: "600",
                  }}
                >
                  {ok ? "Enabled" : "Not Set"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2FA */}
        <div className="sec-card">
          <div className="sec-feature">
            <div className="sec-feature-header">
              <div className="sec-feature-left">
                <div className="sec-feature-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="sec-feature-title">
                    Two-Factor Authentication
                  </div>
                  <div className="sec-feature-desc">
                    Require a code from your authenticator app
                  </div>
                </div>
              </div>
              <div
                className={
                  has2FA
                    ? "sec-status sec-status-enabled"
                    : "sec-status sec-status-disabled"
                }
              >
                {has2FA ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {has2FA ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {!has2FA ? (
                <button
                  className="sec-btn sec-btn-primary"
                  onClick={() => setShow2FASetup(true)}
                  disabled={saving}
                >
                  <Shield size={16} /> Enable 2FA
                </button>
              ) : (
                <>
                  <button
                    className="sec-btn sec-btn-primary"
                    onClick={() => setShow2FAVerify(true)}
                    disabled={saving}
                  >
                    <Key size={16} /> Test 2FA
                  </button>
                  <button
                    className="sec-btn sec-btn-danger"
                    onClick={handleDisable2FA}
                    disabled={saving}
                  >
                    <XCircle size={16} /> Disable 2FA
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Passkey */}
        <div className="sec-card">
          <div className="sec-feature">
            <div className="sec-feature-header">
              <div className="sec-feature-left">
                <div className="sec-feature-icon">
                  <Fingerprint size={20} />
                </div>
                <div>
                  <div className="sec-feature-title">
                    Passkey & Biometric Login
                  </div>
                  <div className="sec-feature-desc">
                    Sign in with fingerprint, Face ID, or device PIN
                  </div>
                </div>
              </div>
              <div
                className={
                  hasPasskey
                    ? "sec-status sec-status-enabled"
                    : "sec-status sec-status-disabled"
                }
              >
                {hasPasskey ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {hasPasskey ? "Enabled" : "Disabled"}
              </div>
            </div>
            {!hasPasskey && (
              <div style={{ marginTop: "16px" }}>
                <button
                  className="sec-btn sec-btn-primary"
                  onClick={handleEnablePasskey}
                  disabled={saving}
                >
                  <Fingerprint size={16} />{" "}
                  {saving ? "Enabling..." : "Enable Passkey"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="sec-card">
          <div className="sec-card-header">
            <div className="sec-card-left">
              <div className="sec-icon-wrap">
                <Lock size={24} />
              </div>
              <h3 className="sec-card-title">Password</h3>
            </div>
            {lastPasswordChange && (
              <div style={{ fontSize: "12px", color: "#737373" }}>
                Last changed: {fmtDate(lastPasswordChange)}
              </div>
            )}
          </div>
          {!showPasswordSection ? (
            <button
              className="sec-btn sec-btn-primary"
              onClick={() => setShowPasswordSection(true)}
            >
              <Key size={16} /> Change Password
            </button>
          ) : (
            <div>
              <div className="sec-input-group">
                <label className="sec-input-label">Current Password</label>
                <div className="sec-input-wrapper">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    className="sec-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                  />
                  <div
                    className="sec-input-icon"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </div>
                </div>
              </div>
              <div className="sec-input-group">
                <label className="sec-input-label">New Password</label>
                <div className="sec-input-wrapper">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className="sec-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                  <div
                    className="sec-input-icon"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </div>
                </div>
                {newPassword && (
                  <>
                    <div className="sec-strength-bar">
                      <div
                        style={{
                          height: "100%",
                          width: `${passwordStrength}%`,
                          background: getStrengthColor(),
                          borderRadius: "3px",
                          transition: "all .3s",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        marginTop: "6px",
                        fontWeight: "600",
                        color: getStrengthColor(),
                      }}
                    >
                      {getStrengthLabel()}
                    </div>
                  </>
                )}
              </div>
              <div className="sec-input-group">
                <label className="sec-input-label">Confirm New Password</label>
                <input
                  type="password"
                  className="sec-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  className="sec-btn sec-btn-primary"
                  onClick={handleChangePassword}
                  disabled={
                    saving ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                >
                  {saving ? (
                    <>
                      <Loader
                        size={16}
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      Changing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} /> Change Password
                    </>
                  )}
                </button>
                <button
                  className="sec-btn sec-btn-danger"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Withdrawal PIN */}
        <div className="sec-card">
          <div className="sec-card-header">
            <div className="sec-card-left">
              <div className="sec-icon-wrap">
                <Key size={24} />
              </div>
              <div>
                <h3 className="sec-card-title">Withdrawal PIN</h3>
                <p
                  style={{
                    color: "#737373",
                    fontSize: "13px",
                    margin: "4px 0 0",
                  }}
                >
                  Extra protection for withdrawals
                </p>
              </div>
            </div>
            <div
              className={
                hasWithdrawalPin
                  ? "sec-status sec-status-enabled"
                  : "sec-status sec-status-disabled"
              }
            >
              {hasWithdrawalPin ? (
                <CheckCircle size={14} />
              ) : (
                <XCircle size={14} />
              )}
              {hasWithdrawalPin ? "Set" : "Not Set"}
            </div>
          </div>
          {!showPinSection ? (
            <button
              className="sec-btn sec-btn-primary"
              onClick={() => setShowPinSection(true)}
            >
              <Lock size={16} /> {hasWithdrawalPin ? "Change PIN" : "Set PIN"}
            </button>
          ) : (
            <div>
              <div className="sec-input-group">
                <label className="sec-input-label">PIN (4-6 digits)</label>
                <div className="sec-input-wrapper">
                  <input
                    type={showPin ? "text" : "password"}
                    className="sec-input"
                    value={withdrawalPin}
                    onChange={(e) =>
                      setWithdrawalPin(
                        e.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    placeholder="Enter PIN"
                    maxLength={6}
                  />
                  <div
                    className="sec-input-icon"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </div>
                </div>
              </div>
              <div className="sec-input-group">
                <label className="sec-input-label">Confirm PIN</label>
                <input
                  type={showPin ? "text" : "password"}
                  className="sec-input"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Confirm PIN"
                  maxLength={6}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  className="sec-btn sec-btn-primary"
                  onClick={handleSetWithdrawalPin}
                  disabled={saving || !withdrawalPin || !confirmPin}
                >
                  {saving ? (
                    "Setting..."
                  ) : (
                    <>
                      <CheckCircle size={16} /> Set PIN
                    </>
                  )}
                </button>
                <button
                  className="sec-btn sec-btn-danger"
                  onClick={() => {
                    setShowPinSection(false);
                    setWithdrawalPin("");
                    setConfirmPin("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="sec-card">
          <div className="sec-card-header">
            <div className="sec-card-left">
              <div className="sec-icon-wrap">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="sec-card-title">Active Sessions</h3>
                <p
                  style={{
                    color: "#737373",
                    fontSize: "13px",
                    margin: "4px 0 0",
                  }}
                >
                  Signed-in devices
                </p>
              </div>
            </div>
            {activeSessions.length > 1 && (
              <button
                className="sec-btn sec-btn-danger"
                onClick={handleTerminateAllSessions}
                disabled={saving}
                style={{ fontSize: "13px", padding: "8px 16px" }}
              >
                <Trash2 size={14} /> End All Others
              </button>
            )}
          </div>
          {activeSessions.length === 0 ? (
            <p
              style={{
                color: "#737373",
                fontSize: "14px",
                textAlign: "center",
                padding: "20px",
              }}
            >
              No active sessions
            </p>
          ) : (
            activeSessions.map((s) => (
              <div key={s.id} className="sec-device-item">
                <div>
                  <div className="sec-device-name">
                    {s.user_agent?.includes("Mobile")
                      ? "📱 Mobile"
                      : "💻 Desktop"}
                  </div>
                  <div className="sec-device-meta">
                    {s.location_data?.city || "Unknown"} ·{" "}
                    {fmtDate(s.last_activity)}
                  </div>
                </div>
                <button
                  className="sec-btn sec-btn-danger"
                  onClick={() => handleTerminateSession(s.id)}
                  disabled={saving}
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  <Trash2 size={14} /> End
                </button>
              </div>
            ))
          )}
        </div>

        {/* Trusted Devices */}
        <div className="sec-card">
          <div className="sec-card-header">
            <div className="sec-card-left">
              <div className="sec-icon-wrap">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="sec-card-title">Trusted Devices</h3>
                <p
                  style={{
                    color: "#737373",
                    fontSize: "13px",
                    margin: "4px 0 0",
                  }}
                >
                  Won't require 2FA
                </p>
              </div>
            </div>
          </div>
          {trustedDevices.length === 0 ? (
            <p
              style={{
                color: "#737373",
                fontSize: "14px",
                textAlign: "center",
                padding: "20px",
              }}
            >
              No trusted devices
            </p>
          ) : (
            trustedDevices.map((d) => (
              <div key={d.id} className="sec-device-item">
                <div>
                  <div className="sec-device-name">
                    {d.device_name || "Unknown"}
                  </div>
                  <div className="sec-device-meta">
                    Trusted {fmtDate(d.trusted_at)}
                    {d.expires_at && ` · Expires ${fmtDate(d.expires_at)}`}
                  </div>
                </div>
                <button
                  className="sec-btn sec-btn-danger"
                  onClick={() => handleRevokeDevice(d.id)}
                  disabled={saving}
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  <Trash2 size={14} /> Revoke
                </button>
              </div>
            ))
          )}
        </div>

        {/* Recent Events */}
        <div className="sec-card">
          <div className="sec-card-header">
            <div className="sec-card-left">
              <div className="sec-icon-wrap">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="sec-card-title">Recent Security Activity</h3>
                <p
                  style={{
                    color: "#737373",
                    fontSize: "13px",
                    margin: "4px 0 0",
                  }}
                >
                  Last 10 events
                </p>
              </div>
            </div>
          </div>
          {recentEvents.length === 0 ? (
            <p
              style={{
                color: "#737373",
                fontSize: "14px",
                textAlign: "center",
                padding: "20px",
              }}
            >
              No recent events
            </p>
          ) : (
            recentEvents.map((e) => (
              <div key={e.id} className="sec-event-item">
                <div
                  className="sec-event-icon"
                  style={{ background: `${evtColor(e.severity)}20` }}
                >
                  <div style={{ color: evtColor(e.severity) }}>
                    {evtIcon(e.event_type)}
                  </div>
                </div>
                <div>
                  <div className="sec-event-title">
                    {e.event_type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </div>
                  <div className="sec-event-time">
                    {fmtDate(e.created_at)}
                    {e.ip_address && ` · ${e.ip_address}`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sec-alert sec-alert-info">
          <Info size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
            <strong>Tips:</strong> Enable 2FA · Use a strong password · Review
            sessions · Set a withdrawal PIN.
          </div>
        </div>
      </div>

      <TwoFactorSetupModal
        show={show2FASetup}
        onClose={() => setShow2FASetup(false)}
        userId={userId}
        onSuccess={handle2FASetupSuccess}
      />
      <TwoFAModal
        show={show2FAVerify}
        onClose={() => setShow2FAVerify(false)}
        userId={userId}
        onSuccess={() => {
          setShow2FAVerify(false);
          showStatus("success", "2FA verified!");
        }}
      />
      <StatusModal {...statusModal} onClose={hideStatus} />
      <ConfirmModal
        {...confirmModal}
        onConfirm={() => confirmModal.action?.()}
        onCancel={hideConfirm}
      />
    </>
  );
};

export default memo(SecuritySection);
