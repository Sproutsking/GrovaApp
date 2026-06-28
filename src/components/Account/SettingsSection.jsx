// src/components/Account/SettingsSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Unified: Pro subscription removed. Subscription card → Boost card.
// Boost button opens UpgradeView directly. Reads boost tier from profile_boosts.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Lock, User, Loader, Save, Mail, Phone,
  AlertTriangle, BadgeCheck, CheckCircle, ChevronDown, Zap,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import settingsService from "../../services/account/settingsService";
import StatusModal from "../Modals/StatusModal";
import ConfirmModal from "../Modals/ConfirmModal";
import PhoneVerificationModal from "../Modals/PhoneVerificationModal";
import EmailVerificationModal from "../Modals/EmailVerificationModal";

// Tier display config
const TIER_CONFIG = {
  silver:  { label: "Silver Boost",  emoji: "🥈", color: "#C0C0C0", grad: ["#C0C0C0","#808080"] },
  gold:    { label: "Gold Boost",    emoji: "🥇", color: "#FFD700", grad: ["#FFD700","#B8860B"] },
  diamond: { label: "Diamond Boost", emoji: "💎", color: "#00BFFF", grad: ["#00BFFF","#1e3a8a"] },
  none:    { label: "No Boost",      emoji: "👤", color: "#737373", grad: ["#444","#222"] },
};

// ─────────────────────────────────────────────────────────────────────────────
const S = `
@keyframes ssSpin { to { transform: rotate(360deg); } }
@keyframes ssShim {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes ssPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.4); }
  50%     { box-shadow: 0 0 0 5px rgba(34,197,94,.0); }
}
@keyframes ssFade { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
@keyframes ssGlow {
  0%,100% { box-shadow: 0 0 12px rgba(132,204,22,.2); }
  50%     { box-shadow: 0 0 24px rgba(132,204,22,.5); }
}

.sset { padding: 12px 14px 80px; animation: ssFade .3s ease; }

.sset-card {
  background: var(--surface-strong);
  border: 1px solid var(--surface-border);
  border-radius: 14px; padding: 14px; margin-bottom: 12px;
  position: relative; overflow: hidden;
}
.sset-card-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #84cc16, #65a30d);
}

.sset-ch {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; cursor: pointer; user-select: none;
}
.sset-ch-left { display: flex; align-items: center; gap: 10px; }
.sset-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(132,204,22,.15), rgba(132,204,22,.05));
  border: 1px solid rgba(132,204,22,.2);
  display: flex; align-items: center; justify-content: center; color: #84cc16;
}
.sset-title { font-size: 14px; font-weight: 800; color: var(--text); margin: 0; }
.sset-badge {
  padding: 2px 8px; background: rgba(132,204,22,.12);
  border-radius: 6px; color: #84cc16; font-size: 10px; font-weight: 700;
}
.sset-caret { color: #333; transition: transform .2s; flex-shrink: 0; }
.sset-caret.open { transform: rotate(180deg); }

.sset-toggle {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--surface-border);
}
.sset-toggle:last-child { border-bottom: none; padding-bottom: 0; }
.sset-toggle:first-child { padding-top: 0; }
.sset-tinfo { flex: 1; padding-right: 12px; }
.sset-tlabel { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 1px; }
.sset-tdesc  { font-size: 10.5px; color: var(--text-secondary); line-height: 1.4; }

.sset-sw {
  position: relative; width: 42px; height: 24px; flex-shrink: 0;
  background: var(--surface);
  border-radius: 12px;
  cursor: pointer; transition: all .25s;
  border: 1.5px solid var(--surface-border);
}
.sset-sw.on {
  background: linear-gradient(135deg, var(--accent), #65a30d);
  border-color: var(--accent);
}
.sset-sw-knob {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; background: var(--panel);
  border-radius: 50%; transition: transform .25s;
  box-shadow: 0 1px 4px rgba(0,0,0,.15);
}
.sset-sw.on .sset-sw-knob { transform: translateX(18px); }

.sset-contact {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.04);
}
.sset-contact:last-of-type { border-bottom: none; }
.sset-contact-body { flex: 1; min-width: 0; }
.sset-contact-label {
  font-size: 9.5px; color: var(--text-secondary); font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px;
}
.sset-contact-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sset-contact-val {
  font-size: 13px; color: var(--text); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;
}

.sset-vbadge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800;
  background: linear-gradient(135deg, rgba(34,197,94,.12), rgba(21,128,61,.12));
  border: 1px solid rgba(34,197,94,.3); color: #22c55e;
  position: relative; overflow: hidden; animation: ssPulse 3s ease infinite; flex-shrink: 0;
}
.sset-vbadge::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.1) 40%,
    rgba(255,255,255,.22) 50%, rgba(255,255,255,.1) 60%, transparent 100%);
  background-size: 200% 100%; animation: ssShim 2.4s ease infinite;
}
.sset-vbadge-ico  { position: relative; z-index: 1; flex-shrink: 0; }
.sset-vbadge-text { position: relative; z-index: 1; }

.sset-ubadge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
  background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.25); color: #fbbf24; flex-shrink: 0;
}

.sset-cbtn {
  padding: 6px 12px; border-radius: 8px; flex-shrink: 0;
  background: rgba(132,204,22,.08); border: 1px solid rgba(132,204,22,.25);
  color: #84cc16; font-size: 11.5px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 5px; transition: all .15s; white-space: nowrap;
}
.sset-cbtn:hover { background: rgba(132,204,22,.16); border-color: rgba(132,204,22,.45); transform: translateY(-1px); }

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
  background: linear-gradient(135deg, #FFD700, #B8860B);
  border: none; border-radius: 12px; color: #000;
  font-size: 14px; font-weight: 900; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .25s; box-shadow: 0 3px 16px rgba(255,215,0,.25);
  animation: ssGlow 3s ease infinite;
}
.sset-upgrade-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(255,215,0,.45); }

.sset-manage-btn {
  width: 100%; padding: 12px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px; color: #a3a3a3;
  font-size: 13px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .2s;
}
.sset-manage-btn:hover { background: rgba(255,255,255,.07); color: #fff; }

.sset-save {
  width: 100%; padding: 14px;
  background: linear-gradient(135deg, #84cc16, #65a30d);
  border: none; border-radius: 12px; color: #000;
  font-size: 14px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .25s; box-shadow: 0 3px 12px rgba(132,204,22,.3); margin-top: 6px;
}
.sset-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(132,204,22,.5); }
.sset-save:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }

.sset-banner {
  border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
  display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.5;
}
.sset-banner.warn  { background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.22);  color: #fbbf24; }
.sset-banner.info  { background: rgba(96,165,250,.08);  border: 1px solid rgba(96,165,250,.2); color: #60a5fa; }
.sset-banner.succ  { background: rgba(34,197,94,.08);   border: 1px solid rgba(34,197,94,.2);  color: #22c55e; }
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
  const [openSection, setOpenSection] = useState("notifications");

  // Notifications
  const [notifs, setNotifs] = useState({
    profileVisits: false, comments: false, likes: false,
    shares: false, newFollowers: false, storyUnlocks: false,
  });

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

      const [profileRes, boostRes] = await Promise.allSettled([
        supabase.from("profiles")
          .select("email,phone,phone_verified,is_private,show_email,show_phone,preferences")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("profile_boosts")
          .select("boost_tier,expires_at,status,is_system_grant")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
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
        <p style={{ color:"#555", fontSize:12 }}>Loading settings…</p>
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

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <div className="sset-card">
          <div className="sset-card-accent"/>
          <div className="sset-ch" onClick={() => togSection("notifications")}>
            <div className="sset-ch-left">
              <div className="sset-icon"><Bell size={16}/></div>
              <h3 className="sset-title">Notifications</h3>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="sset-badge">{enabledCount}/6</span>
              <ChevronDown size={14} className={`sset-caret ${openSection==="notifications"?"open":""}`}/>
            </div>
          </div>

          {openSection === "notifications" && (
            <>
              {[
                { key:"profileVisits", label:"Profile Visits",  desc:"When someone views your profile" },
                { key:"comments",      label:"Comments",         desc:"When someone comments on your content" },
                { key:"likes",         label:"Likes",            desc:"When someone likes your content" },
                { key:"shares",        label:"Shares",           desc:"When someone shares your content" },
                { key:"newFollowers",  label:"New Followers",    desc:"When someone follows you" },
                { key:"storyUnlocks",  label:"Story Unlocks",    desc:"When someone unlocks your story" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="sset-toggle">
                  <div className="sset-tinfo">
                    <div className="sset-tlabel">{label}</div>
                    <div className="sset-tdesc">{desc}</div>
                  </div>
                  <div className={`sset-sw ${notifs[key]?"on":""}`} onClick={() => toggleNotif(key)}>
                    <div className="sset-sw-knob"/>
                  </div>
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
              <div className="sset-icon" style={{ background: "linear-gradient(135deg, rgba(84,204,22,.15), rgba(84,204,22,.05))", borderColor: "rgba(132,204,22,.2)", color: "#84cc16" }}>
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
            background: hasBoost
              ? `linear-gradient(90deg, ${tierCfg.grad[0]}, ${tierCfg.grad[1]})`
              : "linear-gradient(90deg, #84cc16, #65a30d)",
          }}/>

          <div className="sset-ch" onClick={() => togSection("boost")}>
            <div className="sset-ch-left">
              <div className="sset-icon" style={{
                background: hasBoost ? `${tierCfg.color}18` : undefined,
                border:     hasBoost ? `1px solid ${tierCfg.color}30` : undefined,
                color:      hasBoost ? tierCfg.color : "#84cc16",
                fontSize:   hasBoost ? 18 : undefined,
              }}>
                {hasBoost ? tierCfg.emoji : <User size={16}/>}
              </div>
              <h3 className="sset-title">Profile Boost</h3>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {hasBoost && (
                <span style={{
                  padding:"2px 8px", borderRadius:6, fontSize:10, fontWeight:700,
                  background:`${tierCfg.color}18`, color:tierCfg.color,
                  border:`1px solid ${tierCfg.color}30`,
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
                    background:`${tierCfg.color}10`, border:`1px solid ${tierCfg.color}25`,
                  }}>
                    <span style={{ fontSize:28 }}>{tierCfg.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:900, color:tierCfg.color }}>
                        {tierCfg.label}
                      </div>
                      <div style={{ fontSize:11, color:"#737373", marginTop:2 }}>
                        {isSystemGrant ? "Complimentary · Admin grant · No EP charged" :
                          boostExpires ? `Expires in ${daysLeft} day${daysLeft!==1?"s":""}` : "Active"}
                      </div>
                    </div>
                    <div style={{
                      padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:800,
                      background: daysLeft <= 7 && !isSystemGrant
                        ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)",
                      color: daysLeft <= 7 && !isSystemGrant ? "#ef4444" : "#22c55e",
                      border: daysLeft <= 7 && !isSystemGrant
                        ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(34,197,94,0.25)",
                    }}>
                      {isSystemGrant ? "✓ Granted" : daysLeft <= 7 ? `⚠ ${daysLeft}d left` : "Active"}
                    </div>
                  </div>

                  {/* Perks reminder */}
                  <div style={{ fontSize:11, color:"#525252", marginBottom:12, lineHeight:1.6 }}>
                    Your boost includes exclusive profile themes, animated avatar ring,
                    and EP bonus on all earnings.
                  </div>

                  {/* Manage boost → opens UpgradeView */}
                  <button className="sset-manage-btn" onClick={() => onOpenUpgrade?.()}>
                    <Zap size={13}/> Manage Boost
                  </button>
                </div>
              ) : (
                /* ── No boost — upgrade CTA ── */
                <div className="sset-boost-none">
                  <p style={{ fontSize:12, color:"#525252", lineHeight:1.6, margin:"0 0 14px" }}>
                    Unlock a stunning animated profile, exclusive themes, and earn more EP.
                    Choose from <strong style={{ color:"#C0C0C0" }}>Silver</strong>,{" "}
                    <strong style={{ color:"#FFD700" }}>Gold</strong>, or{" "}
                    <strong style={{ color:"#00BFFF" }}>Diamond</strong> boost.
                  </p>

                  {/* Tier preview pills */}
                  <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                    {["silver","gold","diamond"].map(t => {
                      const tc = TIER_CONFIG[t];
                      return (
                        <div key={t} style={{
                          flex:1, padding:"8px 6px", borderRadius:10, textAlign:"center",
                          background:`${tc.color}10`, border:`1px solid ${tc.color}25`,
                          cursor:"pointer",
                        }} onClick={() => onOpenUpgrade?.()}>
                          <div style={{ fontSize:18, marginBottom:3 }}>{tc.emoji}</div>
                          <div style={{ fontSize:9, fontWeight:800, color:tc.color,
                            textTransform:"uppercase", letterSpacing:"0.05em" }}>
                            {t}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button className="sset-upgrade-btn" onClick={() => onOpenUpgrade?.()}>
                    👑 Upgrade Your Profile
                  </button>

                  <p style={{ fontSize:10, color:"#383838", textAlign:"center", margin:"8px 0 0" }}>
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