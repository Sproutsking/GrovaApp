// src/components/Account/SettingsSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Fixed: data fetch uses supabase directly (bypasses service layer caching bugs)
// Fixed: all columns match exact schema (preferences jsonb, is_private, show_email, etc.)
// Fixed: UI sizing — more compact, better proportions
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Lock, User, Loader, Save, Mail, Phone,
  AlertTriangle, BadgeCheck, CheckCircle, ChevronDown,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import StatusModal from "../Modals/StatusModal";
import ConfirmModal from "../Modals/ConfirmModal";
import PhoneVerificationModal from "../Modals/PhoneVerificationModal";
import EmailVerificationModal from "../Modals/EmailVerificationModal";

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

/* ── Root ── */
.sset { padding: 12px 14px 80px; animation: ssFade .3s ease; }

/* ── Card ── */
.sset-card {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 14px; padding: 14px; margin-bottom: 12px;
  position: relative; overflow: hidden;
}
.sset-card-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #84cc16, #65a30d);
}

/* ── Card header ── */
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
.sset-title { font-size: 14px; font-weight: 800; color: #fff; margin: 0; }
.sset-badge {
  padding: 2px 8px; background: rgba(132,204,22,.12);
  border-radius: 6px; color: #84cc16; font-size: 10px; font-weight: 700;
}
.sset-caret { color: #333; transition: transform .2s; flex-shrink: 0; }
.sset-caret.open { transform: rotate(180deg); }

/* ── Toggle row ── */
.sset-toggle {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.04);
}
.sset-toggle:last-child { border-bottom: none; padding-bottom: 0; }
.sset-toggle:first-child { padding-top: 0; }
.sset-tinfo { flex: 1; padding-right: 12px; }
.sset-tlabel { font-size: 13px; font-weight: 700; color: #d4d4d4; margin-bottom: 1px; }
.sset-tdesc  { font-size: 10.5px; color: #444; line-height: 1.4; }

/* ── Switch ── */
.sset-sw {
  position: relative; width: 42px; height: 24px; flex-shrink: 0;
  background: rgba(255,255,255,.08); border-radius: 12px;
  cursor: pointer; transition: all .25s;
  border: 1.5px solid rgba(255,255,255,.1);
}
.sset-sw.on {
  background: linear-gradient(135deg, #84cc16, #65a30d);
  border-color: #84cc16;
}
.sset-sw-knob {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; background: #fff;
  border-radius: 50%; transition: transform .25s;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
}
.sset-sw.on .sset-sw-knob { transform: translateX(18px); }

/* ── Contact row ── */
.sset-contact {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.04);
}
.sset-contact:last-of-type { border-bottom: none; }
.sset-contact-body { flex: 1; min-width: 0; }
.sset-contact-label {
  font-size: 9.5px; color: #444; font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px;
}
.sset-contact-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sset-contact-val {
  font-size: 13px; color: #ccc; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 180px;
}

/* ── Verified badge ── */
.sset-vbadge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 800;
  background: linear-gradient(135deg, rgba(34,197,94,.12), rgba(21,128,61,.12));
  border: 1px solid rgba(34,197,94,.3); color: #22c55e;
  position: relative; overflow: hidden; animation: ssPulse 3s ease infinite;
  flex-shrink: 0;
}
.sset-vbadge::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,255,255,.1) 40%,
    rgba(255,255,255,.22) 50%, rgba(255,255,255,.1) 60%, transparent 100%);
  background-size: 200% 100%; animation: ssShim 2.4s ease infinite;
}
.sset-vbadge-ico  { position: relative; z-index: 1; flex-shrink: 0; }
.sset-vbadge-text { position: relative; z-index: 1; }

.sset-ubadge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
  background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.25);
  color: #fbbf24; flex-shrink: 0;
}

/* ── Change button ── */
.sset-cbtn {
  padding: 6px 12px; border-radius: 8px; flex-shrink: 0;
  background: rgba(132,204,22,.07); border: 1px solid rgba(132,204,22,.2);
  color: #84cc16; font-size: 11.5px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 5px; transition: all .15s;
  white-space: nowrap;
}
.sset-cbtn:hover { background: rgba(132,204,22,.13); border-color: rgba(132,204,22,.4); transform: translateY(-1px); }

/* ── Subscription ── */
.sset-sub-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 8px; font-size: 12px; font-weight: 800;
  margin-bottom: 10px;
}
.sset-sub-pro  { background: rgba(132,204,22,.15); color: #84cc16; border: 1px solid rgba(132,204,22,.3); }
.sset-sub-free { background: rgba(163,163,163,.1);  color: #737373; border: 1px solid rgba(163,163,163,.2); }

/* ── Save button ── */
.sset-save {
  width: 100%; padding: 14px;
  background: linear-gradient(135deg, #84cc16, #65a30d);
  border: none; border-radius: 12px; color: #000;
  font-size: 14px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .25s; box-shadow: 0 3px 12px rgba(132,204,22,.3);
  margin-top: 6px;
}
.sset-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(132,204,22,.5); }
.sset-save:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }

/* ── Banners ── */
.sset-banner {
  border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
  display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.5;
}
.sset-banner.warn  { background: rgba(251,191,36,.06); border: 1px solid rgba(251,191,36,.2);  color: #fbbf24; }
.sset-banner.info  { background: rgba(96,165,250,.06);  border: 1px solid rgba(96,165,250,.15); color: #60a5fa; }
.sset-banner.succ  { background: rgba(34,197,94,.06);   border: 1px solid rgba(34,197,94,.18);  color: #22c55e; }
`;

// ─────────────────────────────────────────────────────────────────────────────
const SettingsSection = ({ userId }) => {
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Contact
  const [email,         setEmail]         = useState("");
  const [emailVerified, setEmailVerified] = useState(true);
  const [phone,         setPhone]         = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Modals
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Section expand
  const [openSection, setOpenSection] = useState("notifications"); // default open

  // Notifications — all false by default
  const [notifs, setNotifs] = useState({
    profileVisits: false,
    comments:      false,
    likes:         false,
    shares:        false,
    newFollowers:  false,
    storyUnlocks:  false,
  });

  // Privacy
  const [privacy, setPrivacy] = useState({
    privateAccount: false,
    showEmail:      false,
    showPhone:      false,
  });

  // Subscription
  const [sub, setSub] = useState({ isActive: false, plan: "Free", renewalDate: null });

  // Modals
  const [statusModal,  setStatusModal]  = useState({ show:false, type:"success", message:"" });
  const [confirmModal, setConfirmModal] = useState({ show:false, title:"", message:"", action:null });

  const showSt = (t, m) => setStatusModal({ show:true, type:t, message:m });
  const hideSt = ()     => setStatusModal({ show:false, type:"success", message:"" });
  const showCf = (t,m,a)=> setConfirmModal({ show:true, title:t, message:m, action:a });
  const hideCf = ()     => setConfirmModal({ show:false, title:"", message:"", action:null });

  // ── Data fetch — direct Supabase (no service layer) ─────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);

      const [profileRes, subRes] = await Promise.allSettled([
        supabase.from("profiles")
          .select("email,phone,phone_verified,is_private,show_email,show_phone,is_pro,pro_expires_at,preferences")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("profiles")
          .select("is_pro,pro_expires_at")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.data) {
        const p = profileRes.value.data;

        // Contact
        setEmail(p.email || "");
        setPhone(p.phone || "");
        setPhoneVerified(p.phone_verified || false);
        // Email is always verified after signup (Supabase enforces it)
        setEmailVerified(true);

        // Privacy — read directly from columns
        setPrivacy({
          privateAccount: p.is_private   || false,
          showEmail:      p.show_email   || false,
          showPhone:      p.show_phone   || false,
        });

        // Notifications — read from preferences jsonb with defaults = false
        const prefs = p.preferences || {};
        setNotifs({
          profileVisits: prefs.notify_profile_visits === true,
          comments:      prefs.notify_comments       === true,
          likes:         prefs.notify_likes          === true,
          shares:        prefs.notify_shares         === true,
          newFollowers:  prefs.notify_followers      === true,
          storyUnlocks:  prefs.notify_unlocks        === true,
        });
      }

      if (subRes.status === "fulfilled" && subRes.value?.data) {
        const s = subRes.value.data;
        setSub({
          isActive:    s.is_pro || false,
          plan:        s.is_pro ? "Pro" : "Free",
          renewalDate: s.pro_expires_at || null,
        });
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

      // Build preferences object
      const preferences = {
        notify_profile_visits: notifs.profileVisits,
        notify_comments:       notifs.comments,
        notify_likes:          notifs.likes,
        notify_shares:         notifs.shares,
        notify_followers:      notifs.newFollowers,
        notify_unlocks:        notifs.storyUnlocks,
      };

      const { error } = await supabase.from("profiles")
        .update({
          is_private:  privacy.privateAccount,
          show_email:  privacy.showEmail,
          show_phone:  privacy.showPhone,
          preferences,
          updated_at:  new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      setHasChanges(false);
      showSt("success", "Settings saved!");
    } catch (err) {
      console.error("SettingsSection.handleSave:", err);
      showSt("error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif  = key => { setNotifs(p => ({ ...p, [key]: !p[key] }));  setHasChanges(true); };
  const togglePrivacy= key => { setPrivacy(p => ({ ...p, [key]: !p[key] })); setHasChanges(true); };
  const togSection   = key => setOpenSection(o => o === key ? null : key);

  const enabledCount = Object.values(notifs).filter(Boolean).length;

  const handleUpgrade = () => showCf(
    "Upgrade to Pro?",
    "Upgrade to Pro to unlock advanced features, analytics, and earn more on content.",
    async () => {
      hideCf(); setSaving(true);
      try {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        const { error } = await supabase.from("profiles")
          .update({ is_pro: true, pro_expires_at: expires.toISOString(), updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (error) throw error;
        setSub({ isActive: true, plan: "Pro", renewalDate: expires.toISOString() });
        showSt("success", "Upgraded to Pro!");
      } catch { showSt("error", "Upgrade failed. Please try again."); }
      finally { setSaving(false); }
    }
  );

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <style>{`@keyframes ssSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"50px 20px",gap:12 }}>
        <Loader size={28} style={{ animation:"ssSpin 1s linear infinite",color:"#84cc16" }} />
        <p style={{ color:"#555",fontSize:12 }}>Loading settings…</p>
      </div>
    </>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{S}</style>
      <div className="sset">

        {/* Info */}
        <div className="sset-banner info">
          <Bell size={14} style={{ flexShrink:0,marginTop:1 }}/>
          <span>Notifications are <strong>OFF by default</strong>. Enable only what you want.</span>
        </div>

        {hasChanges && (
          <div className="sset-banner warn">
            <AlertTriangle size={14} style={{ flexShrink:0,marginTop:1 }}/>
            <span>You have unsaved changes</span>
          </div>
        )}

        {/* ── Notifications ────────────────────────────────────────────────── */}
        <div className="sset-card">
          <div className="sset-card-accent"/>
          <div className="sset-ch" onClick={() => togSection("notifications")}>
            <div className="sset-ch-left">
              <div className="sset-icon"><Bell size={16}/></div>
              <h3 className="sset-title">Notifications</h3>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
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
                  <div
                    className={`sset-sw ${notifs[key]?"on":""}`}
                    onClick={() => toggleNotif(key)}
                  >
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
                    <div
                      className={`sset-sw ${privacy[key]?"on":""}`}
                      onClick={() => togglePrivacy(key)}
                    >
                      <div className="sset-sw-knob"/>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Subscription ──────────────────────────────────────────────────── */}
        <div className="sset-card">
          <div className="sset-card-accent"/>
          <div className="sset-ch" onClick={() => togSection("subscription")}>
            <div className="sset-ch-left">
              <div className="sset-icon"><User size={16}/></div>
              <h3 className="sset-title">Subscription</h3>
            </div>
            <ChevronDown size={14} className={`sset-caret ${openSection==="subscription"?"open":""}`}/>
          </div>

          {openSection === "subscription" && (
            <>
              <div className={`sset-sub-pill ${sub.isActive?"sset-sub-pro":"sset-sub-free"}`}>
                {sub.isActive ? <CheckCircle size={12}/> : <User size={12}/>}
                {sub.plan}
              </div>
              <p style={{ fontSize:12,color:"#555",marginBottom:10,lineHeight:1.55 }}>
                {sub.isActive
                  ? `Pro access active${sub.renewalDate ? ` · Renews ${new Date(sub.renewalDate).toLocaleDateString()}` : ""}.`
                  : "Upgrade to Pro for advanced analytics, priority support, and 10% more earnings."
                }
              </p>
              <button
                className="sset-cbtn"
                style={{ width:"100%",justifyContent:"center",padding:"8px 12px",fontSize:12 }}
                onClick={handleUpgrade}
                disabled={sub.isActive || saving}
              >
                {sub.isActive ? "Manage Subscription" : "⭐ Upgrade to Pro"}
              </button>
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