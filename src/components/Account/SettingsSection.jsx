// src/components/Account/SettingsSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unified: Pro subscription removed. Subscription card → Boost card.
// Boost button opens UpgradeView directly. Reads boost tier from profile_boosts.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Lock, User, Loader, Save, Mail, Phone,
  AlertTriangle, BadgeCheck, CheckCircle, ChevronDown, Shield, Zap,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import settingsService from "../../services/account/settingsService";
import StatusModal from "../Modals/StatusModal";
import ConfirmModal from "../Modals/ConfirmModal";
import PhoneVerificationModal from "../Modals/PhoneVerificationModal";
import EmailVerificationModal from "../Modals/EmailVerificationModal";
import { pushService } from "../../services/notifications/pushService";
import SecuritySection from "./SecuritySection";

// Tier display config
const TIER_CONFIG = {
  silver:  { label: "Silver Boost",  emoji: "🥈", color: "#C0C0C0" },
  gold:    { label: "Gold Boost",    emoji: "🥇", color: "#FFD700" },
  diamond: { label: "Diamond Boost", emoji: "💎", color: "#00BFFF" },
  none:    { label: "No Boost",      emoji: "👤", color: "#737373" },
};

// ─────────────────────────────────────────────────────────────────────────────
const S = `
@keyframes ssSpin { to { transform: rotate(360deg); } }
@keyframes ssFade { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }

.sset {
  --surface-strong: #101710;
  --surface-border: #2b382d;
  --surface: #202a22;
  --panel: #151d16;
  --text: #edf3eb;
  --text-secondary: #a7b3a5;
  --accent: #84cc16;
  padding: 12px 14px 80px;
  animation: ssFade .3s ease;
}

.sset-card {
  background: #101710;
  border: 1px solid var(--surface-border);
  border-radius: 14px; padding: 14px; margin-bottom: 12px;
  position: relative; overflow: hidden;
}
.sset-card-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: #84cc16;
}

.sset-ch {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; cursor: pointer; user-select: none;
}
.sset-ch-left { display: flex; align-items: center; gap: 10px; }
.sset-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: #24331b;
  border: 1px solid #40552d;
  display: flex; align-items: center; justify-content: center; color: #b7eb67;
}
.sset-title { font-size: calc((14px) + 1px); font-weight: 800; color: var(--text); margin: 0; }
.sset-badge {
  padding: 2px 8px; background: #26371c;
  border: 1px solid #3e5729; border-radius: 6px; color: #c5f17e;
  font-size: calc((10px) + 1px); font-weight: 700;
}
.sset-caret { color: #a7b3a5; transition: transform .2s; flex-shrink: 0; }
.sset-caret.open { transform: rotate(180deg); }
.sset-accordion-button {
  width: 100%; padding: 0 0 12px; border: 0; background: #101710;
  color: inherit; text-align: left; font: inherit; cursor: pointer;
}
.sset-ch.sset-accordion-button { margin-bottom: 0; }
.sset-accordion-button:focus-visible {
  outline: 2px solid #a3e635; outline-offset: 4px; border-radius: 8px;
}
.sset-security-summary { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sset-security-summary small { color: #a7b3a5; font-size: 11px; line-height: 1.4; }
.sset-security-body { border-top: 1px solid #2b382d; }
.sset-security-body .ss { padding: 14px 0 2px; animation: none; }

.sset-toggle {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--surface-border);
}
.sset-toggle:last-child { border-bottom: none; padding-bottom: 0; }
.sset-toggle:first-child { padding-top: 0; }
.sset-tinfo { flex: 1; padding-right: 12px; }
.sset-tlabel { font-size: calc((13px) + 1px); font-weight: 700; color: var(--text); margin-bottom: 1px; }
.sset-tdesc  { font-size: calc((10.5px) + 1px); color: var(--text-secondary); line-height: 1.4; }

.sset-sw {
  position: relative; width: 42px; height: 24px; flex-shrink: 0;
  background: var(--surface);
  border-radius: 12px;
  cursor: pointer; transition: all .25s;
  border: 1.5px solid var(--surface-border);
  padding: 0; appearance: none; font: inherit;
}
.sset-sw.on {
  background: #5f8e1c;
  border-color: var(--accent);
}
.sset-sw:disabled { background: #354036; border-color: #48564a; cursor: wait; }
.sset-sw-knob {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; background: #e7eee5;
  border-radius: 50%; transition: transform .25s;
}
.sset-sw.on .sset-sw-knob { transform: translateX(18px); }
.sset-sw:focus-visible { outline: 2px solid #a3e635; outline-offset: 3px; }

.sset-contact {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid #2b342d;
}
.sset-contact:last-of-type { border-bottom: none; }
.sset-contact-body { flex: 1; min-width: 0; }
.sset-contact-label {
  font-size: calc((9.5px) + 1px); color: var(--text-secondary); font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px;
}
.sset-contact-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sset-contact-val {
  font-size: calc((13px) + 1px); color: var(--text); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;
}

.sset-vbadge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: calc((10px) + 1px); font-weight: 800;
  background: #183421;
  border: 1px solid #316543; color: #8fe0a2; flex-shrink: 0;
}
.sset-vbadge-ico, .sset-vbadge-text { flex-shrink: 0; }

.sset-ubadge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: calc((10px) + 1px); font-weight: 700;
  background: #382d16; border: 1px solid #715c2a; color: #f0ca63; flex-shrink: 0;
}

.sset-cbtn {
  padding: 6px 12px; border-radius: 8px; flex-shrink: 0;
  background: #26371c; border: 1px solid #496631;
  color: #c5f17e; font-size: calc((11.5px) + 1px); font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 5px; transition: all .15s; white-space: nowrap;
}
.sset-cbtn:hover { background: #324a22; border-color: #6b913f; }

/* ── Boost card ── */
.sset-boost-active {
  border-radius: 12px; padding: 14px; margin-bottom: 12px;
  display: flex; align-items: center; gap: 12; position: relative; overflow: hidden;
}
.sset-boost-none {
  padding: 14px 0 4px;
}

/* ── Upgrade button ── */
.sset-upgrade-btn {
  width: 100%; padding: 14px;
  background: #80620d;
  border: 1px solid #b9972f; border-radius: 12px; color: #fff1b3;
  font-size: calc((14px) + 1px); font-weight: 900; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: background .2s,border-color .2s;
}
.sset-upgrade-btn:hover { background: #957514; border-color: #d3b04a; }

.sset-manage-btn {
  width: 100%; padding: 12px;
  background: #202820; border: 1px solid #3b473d;
  border-radius: 12px; color: #e1e9e1;
  font-size: calc((13px) + 1px); font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: background .2s,border-color .2s;
}
.sset-manage-btn:hover { background: #2c372d; border-color: #58675a; color: #fff; }

.sset-save {
  width: 100%; padding: 14px;
  background: #6a9c1b;
  border: 1px solid #84cc16; border-radius: 12px; color: #081100;
  font-size: calc((14px) + 1px); font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: background .2s,border-color .2s; margin-top: 6px;
}
.sset-save:hover:not(:disabled) { background: #7bad20; border-color: #a3e635; }
.sset-save:disabled { background: #34402f; border-color: #46513f; color: #9aa493; cursor: not-allowed; }

.sset-banner {
  border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
  display: flex; align-items: flex-start; gap: 8px; font-size: calc((12px) + 1px); line-height: 1.5;
}
.sset-banner.warn  { background: #382d16; border: 1px solid #715c2a; color: #f0ca63; }
.sset-banner.info  { background: #172b3b; border: 1px solid #345d79; color: #a6d9fc; }
.sset-banner.succ  { background: #183421; border: 1px solid #316543; color: #8fe0a2; }
`;

// ─────────────────────────────────────────────────────────────────────────────
const SettingsSection = ({ userId, onOpenUpgrade, themeMode, setThemeMode }) => {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [profilePreferences, setProfilePreferences] = useState({});

  // Contact
  const [email,         setEmail]         = useState("");
  const [emailVerified, setEmailVerified] = useState(true);
  const [phone,         setPhone]         = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Modals
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Section expand
  const [openSection, setOpenSection] = useState("security");

  // Notifications
  const [notifs, setNotifs] = useState({
    profileVisits: false, comments: false, likes: false,
    shares: false, newFollowers: false, storyUnlocks: false,
    messages: false, calls: false, payments: false,
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Privacy
  const [privacy, setPrivacy] = useState({
    privateAccount: false, showEmail: false, showPhone: false,
  });

  // Boost (replaces Pro subscription)
  const [boostTier,    setBoostTier]    = useState("none");
  const [boostExpires, setBoostExpires] = useState(null);
  const [isSystemGrant, setIsSystemGrant] = useState(false);

  // Modals
  const [statusModal,  setStatusModal]  = useState({ show:false, type:"success", message:"" });
  const [confirmModal, setConfirmModal] = useState({ show:false, title:"", message:"", action:null });

  const showSt = (t,m) => setStatusModal({ show:true, type:t, message:m });
  const hideSt = ()    => setStatusModal({ show:false, type:"success", message:"" });
  const showCf = (t,m,a) => setConfirmModal({ show:true, title:t, message:m, action:a });
  const hideCf = ()    => setConfirmModal({ show:false, title:"", message:"", action:null });

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      await pushService.getProvider(userId);

      const [profileRes, boostRes, pushRes] = await Promise.allSettled([
        supabase.from("profiles")
          .select("email,phone,phone_verified,is_private,show_email,show_phone,preferences")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("profile_boosts")
          .select("boost_tier,expires_at,status,is_system_grant")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
        supabase.from("push_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.data) {
        const p = profileRes.value.data;
        setEmail(p.email || "");
        setPhone(p.phone || "");
        setPhoneVerified(p.phone_verified || false);
        setEmailVerified(true);
        setPrivacy({
          privateAccount: p.is_private  || false,
          showEmail:      p.show_email  || false,
          showPhone:      p.show_phone  || false,
        });
        const prefs = p.preferences || {};
        setProfilePreferences(prefs);
        setNotifs({
          profileVisits: prefs.notify_profile_visits === true,
          comments:      prefs.notify_comments       === true,
          likes:         prefs.notify_likes          === true,
          shares:        prefs.notify_shares         === true,
          newFollowers:  prefs.notify_followers      === true,
          storyUnlocks:  prefs.notify_unlocks        === true,
          messages:      prefs.notify_messages      === true,
          calls:         prefs.notify_calls         === true,
          payments:      prefs.notify_payments      === true,
        });
        if (setThemeMode) {
          const themePref = prefs.theme_mode === "light" || prefs.themeMode === "light" ? "light" : "dark";
          setThemeMode(themePref);
        }
      }

      if (boostRes.status === "fulfilled" && boostRes.value?.data) {
        const b = boostRes.value.data;
        setBoostTier(b.boost_tier || "none");
        setBoostExpires(b.expires_at || null);
        setIsSystemGrant(b.is_system_grant || false);
      } else {
        setBoostTier("none");
        setBoostExpires(null);
        setIsSystemGrant(false);
      }

      setPushEnabled(
        pushRes.status === "fulfilled" &&
        Array.isArray(pushRes.value?.data) &&
        pushRes.value.data.length > 0 &&
        pushService.getPermission() === "granted",
      );

      setHasChanges(false);
    } catch (err) {
      console.error("SettingsSection.loadData:", err);
      showSt("error", "Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId) return;
    try {
      setSaving(true);
      const preferences = {
        ...profilePreferences,
        notify_profile_visits: notifs.profileVisits,
        notify_comments:       notifs.comments,
        notify_likes:          notifs.likes,
        notify_shares:         notifs.shares,
        notify_followers:      notifs.newFollowers,
        notify_unlocks:        notifs.storyUnlocks,
        notify_messages:       notifs.messages,
        notify_calls:          notifs.calls,
        notify_payments:       notifs.payments,
        theme_mode:            themeMode === "light" ? "light" : "dark",
        themeMode:             themeMode === "light" ? "light" : "dark",
      };
      await settingsService.saveSettings(userId, privacy, preferences);
      setHasChanges(false);
      showSt("success", "Settings saved!");
    } catch (err) {
      console.error("SettingsSection.handleSave:", err);
      showSt("error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif   = key => { setNotifs(p => ({ ...p, [key]: !p[key] }));  setHasChanges(true); };
  const togglePush = async () => {
    if (!userId || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await pushService.unsubscribe(userId);
        setPushEnabled(false);
        showSt("success", "Push notifications turned off on this device.");
      } else {
        const enabled = await pushService.enablePushNotifications(userId);
        if (!enabled) {
          const permission = pushService.getPermission();
          showSt(
            "error",
            permission === "denied"
              ? "Notifications are blocked. Allow them in your browser settings, then try again."
              : "Push notifications could not be enabled. Please try again.",
          );
          return;
        }
        setPushEnabled(true);
        const provider = pushService.getStatus().lastProvider;
        showSt(
          "success",
          provider === "legacy"
            ? "Push notifications are enabled using Web Push. Firebase token registration needs attention."
            : "Push notifications are now enabled on this device.",
        );
      }
    } catch (err) {
      console.error("SettingsSection.togglePush:", err);
      showSt("error", "Push notification settings could not be changed. Please try again.");
    } finally {
      setPushBusy(false);
    }
  };
  const togglePrivacy = key => { setPrivacy(p => ({ ...p, [key]: !p[key] })); setHasChanges(true); };
  const toggleAppTheme = () => {
    const nextTheme = themeMode === "light" ? "dark" : "light";
    setThemeMode?.(nextTheme);
    setHasChanges(true);
  };
  const togSection    = key => setOpenSection(o => o === key ? null : key);

  const enabledCount = Object.values(notifs).filter(Boolean).length;
  const tierCfg      = TIER_CONFIG[boostTier] || TIER_CONFIG.none;
  const hasBoost     = boostTier !== "none";
  const daysLeft     = boostExpires
    ? Math.max(0, Math.ceil((new Date(boostExpires) - Date.now()) / 86_400_000))
    : 0;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{`@keyframes ssSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", padding:"50px 20px", gap:12 }}>
        <Loader size={28} style={{ animation:"ssSpin 1s linear infinite", color:"#84cc16" }} />
        <p style={{ color:"#555", fontSize:13 }}>Loading settings…</p>
      </div>
    </>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{S}</style>
      <div className="sset">

        {/* Info banner */}
        <div className="sset-banner info">
          <Bell size={14} style={{ flexShrink:0, marginTop:1 }}/>
          <span>Notifications are <strong>OFF by default</strong>. Enable only what you want.</span>
        </div>

        {hasChanges && (
          <div className="sset-banner warn">
            <AlertTriangle size={14} style={{ flexShrink:0, marginTop:1 }}/>
            <span>You have unsaved changes</span>
          </div>
        )}

        {/* ── Security & Access ─────────────────────────────────────────────── */}
        <div className="sset-card sset-security-card">
          <div className="sset-card-accent" />
          <button
            type="button"
            className="sset-ch sset-accordion-button"
            onClick={() => togSection("security")}
            aria-expanded={openSection === "security"}
            aria-controls="settings-security-panel"
          >
            <span className="sset-ch-left">
              <span className="sset-icon"><Shield size={16} /></span>
              <span className="sset-security-summary">
                <span className="sset-title">Security &amp; Access</span>
                <small>Sign-in protection, trusted devices, wallet security</small>
              </span>
            </span>
            <ChevronDown size={16} className={`sset-caret ${openSection === "security" ? "open" : ""}`} />
          </button>
          <div
            className="sset-security-body"
            id="settings-security-panel"
            hidden={openSection !== "security"}
          >
            {openSection === "security" && <SecuritySection userId={userId} />}
          </div>
        </div>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <div className="sset-card">
          <div className="sset-card-accent"/>
          <div className="sset-ch" onClick={() => togSection("notifications")}>
            <div className="sset-ch-left">
              <div className="sset-icon"><Bell size={16}/></div>
              <h3 className="sset-title">Notifications</h3>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="sset-badge">{enabledCount}/9</span>
              <ChevronDown size={14} className={`sset-caret ${openSection==="notifications"?"open":""}`}/>
            </div>
          </div>

          {openSection === "notifications" && (
            <>
              <div className="sset-toggle">
                <div className="sset-tinfo">
                  <div className="sset-tlabel">Push Notifications</div>
                  <div className="sset-tdesc">
                    Messages, calls and activity alerts on this device
                  </div>
                </div>
                <button
                  type="button"
                  className={`sset-sw ${pushEnabled ? "on" : ""}`}
                  onClick={togglePush}
                  disabled={pushBusy}
                  aria-label={pushEnabled ? "Disable push notifications" : "Enable push notifications"}
                  aria-pressed={pushEnabled}
                >
                  <span className="sset-sw-knob" />
                </button>
              </div>
              {[
                { key:"profileVisits", label:"Profile Visits",  desc:"When someone views your profile" },
                { key:"comments",      label:"Comments",         desc:"When someone comments on your content" },
                { key:"likes",         label:"Likes",            desc:"When someone likes your content" },
                { key:"shares",        label:"Shares",           desc:"When someone shares your content" },
                { key:"newFollowers",  label:"New Followers",    desc:"When someone follows you" },
                { key:"storyUnlocks",  label:"Story Unlocks",    desc:"When someone unlocks your story" },
                { key:"messages",      label:"Messages",         desc:"When someone sends you a direct message" },
                { key:"calls",         label:"Calls",             desc:"When someone calls you" },
                { key:"payments",      label:"Payments",          desc:"When a payment is confirmed" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="sset-toggle">
                  <div className="sset-tinfo">
                    <div className="sset-tlabel">{label}</div>
                    <div className="sset-tdesc">{desc}</div>
                  </div>
                  <button
                    type="button"
                    className={`sset-sw ${notifs[key] ? "on" : ""}`}
                    onClick={() => toggleNotif(key)}
                    aria-label={`${label} notifications`}
                    aria-pressed={notifs[key]}
                  >
                    <span className="sset-sw-knob" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Privacy & Contact ─────────────────────────────────────────────── */}
        <div className="sset-card">
          <div className="sset-card-accent"/>
          <div className="sset-ch" onClick={() => togSection("privacy")}>
            <div className="sset-ch-left">
              <div className="sset-icon"><Lock size={16}/></div>
              <h3 className="sset-title">Privacy & Contact</h3>
            </div>
            <ChevronDown size={14} className={`sset-caret ${openSection==="privacy"?"open":""}`}/>
          </div>

          {openSection === "privacy" && (
            <>
              {/* Email */}
              <div className="sset-contact">
                <div className="sset-contact-body">
                  <div className="sset-contact-label">Email Address</div>
                  <div className="sset-contact-row">
                    <span className="sset-contact-val">{email || "Not set"}</span>
                    {emailVerified ? (
                      <div className="sset-vbadge">
                        <BadgeCheck size={10} className="sset-vbadge-ico"/>
                        <span className="sset-vbadge-text">Verified</span>
                      </div>
                    ) : (
                      <div className="sset-ubadge"><AlertTriangle size={9}/> Unverified</div>
                    )}
                  </div>
                </div>
                <button className="sset-cbtn" onClick={() => setShowEmail(true)}>
                  <Mail size={12}/> Change
                </button>
              </div>

              {/* Phone */}
              <div className="sset-contact">
                <div className="sset-contact-body">
                  <div className="sset-contact-label">Phone Number</div>
                  <div className="sset-contact-row">
                    <span className="sset-contact-val">{phone || "Not set"}</span>
                    {phone && (
                      phoneVerified ? (
                        <div className="sset-vbadge">
                          <BadgeCheck size={10} className="sset-vbadge-ico"/>
                          <span className="sset-vbadge-text">Verified</span>
                        </div>
                      ) : (
                        <div className="sset-ubadge"><AlertTriangle size={9}/> Unverified</div>
                      )
                    )}
                  </div>
                </div>
                <button className="sset-cbtn" onClick={() => setShowPhone(true)}>
                  <Phone size={12}/> {phone ? "Change" : "Add"}
                </button>
              </div>

              {/* Privacy toggles */}
              <div style={{ marginTop:6 }}>
                {[
                  { key:"privateAccount", label:"Private Account",      desc:"Only approved followers can see your content" },
                  { key:"showEmail",      label:"Show Email in Profile", desc:"Make your email visible to other users" },
                  ...(phone ? [{ key:"showPhone", label:"Show Phone in Profile", desc:"Make your number visible to other users" }] : []),
                ].map(({ key, label, desc }) => (
                  <div key={key} className="sset-toggle">
                    <div className="sset-tinfo">
                      <div className="sset-tlabel">{label}</div>
                      <div className="sset-tdesc">{desc}</div>
                    </div>
                    <div className={`sset-sw ${privacy[key]?"on":""}`} onClick={() => togglePrivacy(key)}>
                      <div className="sset-sw-knob"/>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Preferences ───────────────────────────────────────────────── */}
        <div className="sset-card">
          <div className="sset-card-accent"/>
          <div className="sset-ch" onClick={() => togSection("preferences")}>
            <div className="sset-ch-left">
              <div className="sset-icon">
                <User size={16}/>
              </div>
              <h3 className="sset-title">Preferences</h3>
            </div>
            <ChevronDown size={14} className={`sset-caret ${openSection==="preferences"?"open":""}`}/>
          </div>

          {openSection === "preferences" && (
            <>
              <div className="sset-toggle">
                <div className="sset-tinfo">
                  <div className="sset-tlabel">App theme</div>
                  <div className="sset-tdesc">Switch between light and dark mode for the whole app.</div>
                </div>
                <div className={`sset-sw ${themeMode==="light"?"on":""}`} onClick={toggleAppTheme}>
                  <div className="sset-sw-knob"/>
                </div>
              </div>
            </>
          )}

        </div>

        {/* ── Boost / Upgrade ───────────────────────────────────────────────── */}
        <div className="sset-card">
          {/* Accent bar matches boost tier color */}
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:2,
            background: hasBoost ? tierCfg.color : "#84cc16",
          }}/>

          <div className="sset-ch" onClick={() => togSection("boost")}>
            <div className="sset-ch-left">
              <div className="sset-icon" style={{
                background: hasBoost ? "#202a22" : undefined,
                border:     hasBoost ? "1px solid #3b473d" : undefined,
                color:      hasBoost ? tierCfg.color : "#84cc16",
                fontSize:   hasBoost ? 19 : undefined,
              }}>
                {hasBoost ? tierCfg.emoji : <User size={16}/>}
              </div>
              <h3 className="sset-title">Profile Upgrade</h3>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {hasBoost && (
                <span style={{
                  padding:"2px 8px", borderRadius:6, fontSize:11, fontWeight:700,
                  background:"#202a22", color:tierCfg.color,
                  border:"1px solid #3b473d",
                }}>
                  {tierCfg.label}
                </span>
              )}
              <ChevronDown size={14} className={`sset-caret ${openSection==="boost"?"open":""}`}/>
            </div>
          </div>

          {openSection === "boost" && (
            <>
              {hasBoost ? (
                /* ── Active boost info ── */
                <div>
                  {/* Tier badge */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                    borderRadius:12, marginBottom:12,
                    background:"#151d16", border:"1px solid #303d31",
                  }}>
                    <span style={{ fontSize:29 }}>{tierCfg.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:900, color:tierCfg.color }}>
                        {tierCfg.label}
                      </div>
                      <div style={{ fontSize:12, color:"#a7b3a5", marginTop:2 }}>
                        {isSystemGrant ? "Complimentary · Admin grant · No EP charged" :
                          boostExpires ? `Expires in ${daysLeft} day${daysLeft!==1?"s":""}` : "Active"}
                      </div>
                    </div>
                    <div style={{
                      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:800,
                      background: daysLeft <= 7 && !isSystemGrant
                        ? "#3a211c" : "#1c3220",
                      color: daysLeft <= 7 && !isSystemGrant ? "#ef4444" : "#22c55e",
                      border: daysLeft <= 7 && !isSystemGrant
                        ? "1px solid #9f4b39" : "1px solid #3f7a47",
                    }}>
                      {isSystemGrant ? "✓ Granted" : daysLeft <= 7 ? `⚠ ${daysLeft}d left` : "Active"}
                    </div>
                  </div>

                  {/* Perks reminder */}
                  <div style={{ fontSize:12, color:"#a7b3a5", marginBottom:12, lineHeight:1.6 }}>
                    Your boost includes exclusive profile themes, animated avatar ring,
                    and EP bonus on all earnings.
                  </div>

                  <button className="sset-manage-btn" onClick={() => window.dispatchEvent(new CustomEvent("xeevia:profile-shortcut", { detail: { action: "manage-boost" } }))}>
                    <Zap size={13}/> Manage Profile Upgrade
                  </button>
                  <button className="sset-upgrade-btn" onClick={() => onOpenUpgrade?.()}>
                    👑 Upgrade Your Profile
                  </button>
                </div>
              ) : (
                /* ── No boost — upgrade CTA ── */
                <div className="sset-boost-none">
                  <p style={{ fontSize:13, color:"#a7b3a5", lineHeight:1.6, margin:"0 0 14px" }}>
                    Unlock a stunning animated profile, exclusive themes, and earn more EP.
                    Choose from <strong style={{ color:"#d3d8d2" }}>Silver</strong>,{" "}
                    <strong style={{ color:"#f0ca63" }}>Gold</strong>, or{" "}
                    <strong style={{ color:"#9bd5ff" }}>Diamond</strong> boost.
                  </p>

                  {/* Tier preview pills */}
                  <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                    {["silver","gold","diamond"].map(t => {
                      const tc = TIER_CONFIG[t];
                      return (
                        <div key={t} style={{
                          flex:1, padding:"8px 6px", borderRadius:10, textAlign:"center",
                          background:"#151d16", border:"1px solid #303d31",
                          cursor:"pointer",
                        }} onClick={() => onOpenUpgrade?.()}>
                          <div style={{ fontSize:19, marginBottom:3 }}>{tc.emoji}</div>
                          <div style={{ fontSize:10, fontWeight:800, color:tc.color,
                            textTransform:"uppercase", letterSpacing:"0.05em" }}>
                            {t}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button className="sset-upgrade-btn" onClick={() => onOpenUpgrade?.()} style={{
                    background:"#6b5008",
                    border:"1px solid #b9972f",
                    color:"#fef3c7",
                    fontWeight:900,
                  }}>
                    👑 Upgrade Your Profile
                  </button>
                  <button className="sset-manage-btn" onClick={() => window.dispatchEvent(new CustomEvent("xeevia:profile-shortcut", { detail: { action: "manage-boost" } }))} style={{ marginTop: 8 }}>
                    <Zap size={13}/> Manage Profile Upgrade
                  </button>

                  <p style={{ fontSize:11, color:"#8f9b90", textAlign:"center", margin:"8px 0 0" }}>
                    $1 = 100 EP · Paid with EP · Cancel anytime
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Save ── */}
        <button
          className="sset-save"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving
            ? <><Loader size={15} style={{ animation:"ssSpin 1s linear infinite" }}/> Saving…</>
            : <><Save size={15}/> Save Settings</>
          }
        </button>

      </div>

      {/* ── Modals ── */}
      <StatusModal  {...statusModal}  onClose={hideSt} />
      <ConfirmModal {...confirmModal} onConfirm={() => confirmModal.action?.()} onCancel={hideCf} />

      <PhoneVerificationModal
        show={showPhone}
        onClose={() => setShowPhone(false)}
        userId={userId}
        currentPhone={phone}
        onSuccess={newPhone => {
          setPhone(newPhone);
          setPhoneVerified(true);
          showSt("success", "Phone number verified!");
        }}
      />

      <EmailVerificationModal
        show={showEmail}
        onClose={() => setShowEmail(false)}
        userId={userId}
        currentEmail={email}
        onSuccess={newEmail => {
          setEmail(newEmail);
          setEmailVerified(true);
          showSt("success", "Email updated!");
        }}
      />
    </>
  );
};

export default SettingsSection;