// paywave/tabs/AccountTab.jsx
import React, { useState } from "react";
import { User, Phone, Mail, Calendar, MapPin, Shield, Lock, Bell, HelpCircle, FileText, ChevronRight, LogOut, Copy, Check, Fingerprint, Key, AlertTriangle, FileWarning, Info } from "lucide-react";
import { Header, Avatar, Toggle, CopyField, ListRow } from "../components/UI";
import { DocUploadModal, ReviewModal, SuccessModal, CodeModal } from "../modals/index";

// ── Edit field sub-page ────────────────────────────────────
function EditFieldPage({ field, onBack, onSuccess, setDocUpload }) {
  const needsVerif = ["Full Name", "Phone Number", "Email Address"].includes(field.label);
  const [val, setVal] = useState(field.value);

  return (
    <div className="pw-scroll">
      <Header title={`Edit ${field.label}`} onBack={onBack} />
      <div className="f-section f-stack">
        <div>
          <label className="f-label">{field.label}</label>
          <div className="f-card"><input type="text" value={val} onChange={e => setVal(e.target.value)} className="f-input" /></div>
        </div>
        {needsVerif && (
          <div className="info-gold" style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
            <Info size={14} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: "var(--gold)", fontSize: 12 }}>This field requires document verification.</span>
          </div>
        )}
        <button className="btn-lime full" onClick={() => {
          if (needsVerif) { onBack(); setDocUpload(true); }
          else { onSuccess(`${field.label} updated successfully!`); onBack(); }
        }}>Save Changes</button>
      </div>
    </div>
  );
}

// ── Security settings sub-page ─────────────────────────────
function SecurityPage({ onBack }) {
  const items = [
    { icon: Fingerprint, label: "Biometric Login",    desc: "Fingerprint or face ID",       on: true  },
    { icon: Key,         label: "Two-Factor Auth",    desc: "Extra layer for every login",   on: true  },
    { icon: Lock,        label: "Transaction PIN",    desc: "Required on all payments",      on: true  },
    { icon: Shield,      label: "Login Alerts",       desc: "Notify me of new logins",       on: false },
  ];
  return (
    <div className="pw-scroll">
      <Header title="Security" onBack={onBack} />
      <div style={{ padding: 15 }}>
        {/* Hero — lime accent */}
        <div className="glass glass-lime" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(163,230,53,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={20} color="var(--lime)" />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Account is secure</div>
            <div style={{ color: "var(--lime)", fontSize: 12 }}>All security features active</div>
          </div>
        </div>
        <div className="space-y">
          {items.map((item, i) => (
            <ListRow key={i} icon={item.icon} label={item.label} sub={item.desc}
              right={<Toggle on={item.on} />} onClick={() => {}} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Change password sub-page ───────────────────────────────
function ChangePasswordPage({ onBack }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cn, setCn] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [done, setDone] = useState(false);

  const handle = () => {
    if (!cur || !nw || !cn) return alert("Fill all fields");
    if (nw !== cn) return alert("Passwords don't match");
    if (nw.length < 8) return alert("Min 8 characters");
    setCodeOpen(true);
  };

  if (done) return <SuccessModal message="Password changed successfully!" onClose={onBack} />;

  return (
    <div className="pw-scroll">
      <Header title="Change Password" onBack={onBack} />
      <div className="f-section f-stack">
        <div className="info-lime" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Info size={13} color="var(--lime)" /><span style={{ color: "var(--lime)", fontSize: 12 }}>Minimum 8 characters required</span>
        </div>
        {[["Current Password", cur, setCur], ["New Password", nw, setNw], ["Confirm New Password", cn, setCn]].map(([label, val, setter], i) => (
          <div key={i}>
            <label className="f-label">{label}</label>
            <div className="f-card"><input type="password" value={val} onChange={e => setter(e.target.value)} placeholder={`Enter ${label.toLowerCase()}`} className="f-input" /></div>
          </div>
        ))}
        <button className="btn-lime full" disabled={!cur || !nw || !cn || nw !== cn} onClick={handle}>Update Password</button>
      </div>
      {codeOpen && <CodeModal onClose={() => setCodeOpen(false)} onVerify={code => { if (code === "123456") { setCodeOpen(false); setDone(true); } else alert("Wrong code"); }} />}
    </div>
  );
}

// ── Notification settings sub-page ────────────────────────
function NotifSettingsPage({ onBack }) {
  const items = [
    { label: "Transaction Alerts",  desc: "Notify on all transactions",  on: true  },
    { label: "Promotional Offers",  desc: "Special deals and cashback",   on: true  },
    { label: "Security Alerts",     desc: "Critical security notices",    on: true  },
    { label: "Payment Reminders",   desc: "Upcoming bill reminders",      on: false },
    { label: "Weekly Summary",      desc: "Spending summary every week",  on: false },
  ];
  return (
    <div className="pw-scroll">
      <Header title="Notifications" onBack={onBack} />
      <div style={{ padding: 15 }}>
        <div className="space-y">
          {items.map((item, i) => (
            <div key={i} className="glass click" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{item.label}</div>
                  <div style={{ color: "var(--text-soft)", fontSize: 11.5 }}>{item.desc}</div>
                </div>
                <Toggle on={item.on} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Help sub-page ──────────────────────────────────────────
function HelpPage({ onBack }) {
  const items = [
    { icon: Phone,       label: "Call Us",        desc: "+234 123 456 7890"         },
    { icon: Mail,        label: "Email Support",  desc: "support@paywave.com"       },
    { icon: HelpCircle,  label: "FAQs",           desc: "Common questions answered" },
    { icon: FileText,    label: "Report Issue",   desc: "Describe your problem"     },
  ];
  return (
    <div className="pw-scroll">
      <Header title="Help & Support" onBack={onBack} />
      <div style={{ padding: 15 }}>
        {/* Gold hero — the other gold touch */}
        <div className="glass glass-gold" style={{ padding: "16px 14px", textAlign: "center", marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 10px", borderRadius: "50%", background: "var(--gold-dim)", border: "1px solid var(--gold-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HelpCircle size={24} color="var(--gold)" />
          </div>
          <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>We're here to help</div>
          <div style={{ color: "var(--gold)", fontSize: 12, marginTop: 2 }}>24/7 customer support</div>
        </div>
        <div className="space-y">
          {items.map((item, i) => (
            <ListRow key={i} icon={item.icon} label={item.label} sub={item.desc}
              right={<ChevronRight size={13} color="var(--text-muted)" />}
              onClick={() => alert(`${item.label}\n${item.desc}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Terms sub-page ─────────────────────────────────────────
function TermsPage({ onBack }) {
  return (
    <div className="pw-scroll">
      <Header title="Terms & Privacy" onBack={onBack} />
      <div style={{ padding: 15 }}>
        <div className="info-gold" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
          <AlertTriangle size={14} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ color: "var(--gold)", fontSize: 12 }}>Please read carefully. By using this app you agree to our terms.</span>
        </div>
        {[
          ["Terms of Service", "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip."],
          ["Privacy Policy", "We take your privacy seriously. All personal data is encrypted at rest and in transit. We never sell your data to third parties. You may request deletion of your account and data at any time through the app settings."],
        ].map(([title, body], i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 6 }}>{title}</div>
            <p style={{ color: "var(--text-soft)", fontSize: 12.5, lineHeight: 1.75 }}>{body}</p>
          </div>
        ))}
        <div className="info-red" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <FileWarning size={14} color="var(--c-red, #f87171)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ color: "#f87171", fontSize: 12 }}>Disclaimer: This is a demo app. No real transactions occur.</span>
        </div>
      </div>
    </div>
  );
}

// ── Main AccountTab ────────────────────────────────────────
export default function AccountTab({ setPage, onSuccess }) {
  const [subPage, setSubPage] = useState(null);
  const [editField, setEditField] = useState(null);
  const [docUpload, setDocUpload] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const accountNumber = "9040273157";

  const copyAcct = () => { navigator.clipboard?.writeText(accountNumber); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // sub-page routing
  if (editField)   return <EditFieldPage field={editField} onBack={() => setEditField(null)} onSuccess={onSuccess} setDocUpload={setDocUpload} />;
  if (subPage === "security")         return <SecurityPage onBack={() => setSubPage(null)} />;
  if (subPage === "change-password")  return <ChangePasswordPage onBack={() => setSubPage(null)} />;
  if (subPage === "notif-settings")   return <NotifSettingsPage onBack={() => setSubPage(null)} />;
  if (subPage === "help")             return <HelpPage onBack={() => setSubPage(null)} />;
  if (subPage === "terms")            return <TermsPage onBack={() => setSubPage(null)} />;

  const personalFields = [
    { icon: User,     label: "Full Name",     value: "SUNDAY ALI"         },
    { icon: Phone,    label: "Phone Number",  value: "+2349040273157"     },
    { icon: Mail,     label: "Email Address", value: "d*@gmail.com"       },
    { icon: Calendar, label: "Date of Birth", value: "**-**-17"           },
    { icon: MapPin,   label: "Home Address",  value: "Not set"            },
  ];

  const settingsItems = [
    { icon: Shield,      label: "Security",         desc: "PIN, biometrics, 2FA",   key: "security"        },
    { icon: Lock,        label: "Change Password",  desc: "Update your password",   key: "change-password" },
    { icon: Bell,        label: "Notifications",    desc: "Manage alerts",          key: "notif-settings"  },
    { icon: HelpCircle,  label: "Help & Support",   desc: "24/7 support",           key: "help"            },
    { icon: FileText,    label: "Terms & Privacy",  desc: "Legal information",      key: "terms"           },
  ];

  return (
    <div className="pw-scroll">
      <Header title="Account" />
      <div style={{ padding: 15 }}>

        {/* ── Profile card ─────────────────────────────────── */}
        <div className="glass" style={{ padding: "17px 15px", marginBottom: 14 }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <Avatar letter="E" size="lg" style={{ margin: "0 auto 9px" }} />
            <div style={{ margin: "9px 0 0" }}>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Emmanuel Walker</div>
              <div style={{ color: "var(--lime)", fontSize: 12, marginTop: 2 }}>Tier 1 Account</div>
            </div>
          </div>

          {/* Account number row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", borderRadius: "var(--r-sm)", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 11 }}>
            <span style={{ color: "var(--text-soft)", fontSize: 12 }}>Account No.</span>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontFamily: "var(--font-m)", color: "var(--text)", fontSize: 14 }}>{accountNumber}</span>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-soft)", display: "flex" }} onClick={copyAcct}>
                {copied ? <Check size={12} color="var(--lime)" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Upgrade — gold accent for the "premium" cue */}
          <button className="btn-lime full sm" onClick={() => alert("Upgrade to Tier 2\n\nBenefits:\n- Higher transaction limits\n- International transfers\n- Priority support")}>
            Upgrade to Tier 2
          </button>
        </div>

        {/* ── Personal Information ──────────────────────────── */}
        <div className="sec-hd"><span className="sec-title">Personal Information</span></div>
        <div className="space-y mb-4">
          {personalFields.map((field, i) => (
            <div key={i} className="glass click" style={{ padding: "10px 13px" }} onClick={() => setEditField(field)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <field.icon size={13} color="var(--text-muted)" />
                  <span style={{ color: "var(--text-soft)", fontSize: 12 }}>{field.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text)", fontSize: 13.5 }}>{field.value}</span>
                  <ChevronRight size={12} color="var(--text-muted)" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Settings ──────────────────────────────────────── */}
        <div className="sec-hd"><span className="sec-title">Settings</span></div>
        <div className="space-y mb-4">
          {settingsItems.map((item, i) => (
            <ListRow key={i} icon={item.icon} label={item.label} sub={item.desc}
              right={<ChevronRight size={13} color="var(--text-muted)" />}
              onClick={() => setSubPage(item.key)} />
          ))}
        </div>

        {/* ── Sign out ───────────────────────────────────────── */}
        <div className="glass click" style={{ padding: "11px 14px", borderColor: "rgba(239,68,68,0.18)" }}
          onClick={() => { if (window.confirm("Sign out of PayWave?")) alert("Signed out."); }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "#f87171", fontFamily: "var(--font-d)", fontWeight: 600, fontSize: 14 }}>
            <LogOut size={14} /> Sign Out
          </div>
        </div>
      </div>

      {docUpload && <DocUploadModal onClose={() => setDocUpload(false)} onSubmit={() => { setDocUpload(false); setReviewOpen(true); }} />}
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} />}
    </div>
  );
}