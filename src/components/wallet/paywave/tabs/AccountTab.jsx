// paywave/tabs/AccountTab.jsx
// Renders REAL user data from Supabase profiles table.
// Incomplete fields show motivating CTAs to encourage completion.
// Tier system: Tier 1 (basic) → Tier 2 (verified)
import React, { useState, useEffect, useCallback } from "react";
import {
  User, Phone, Mail, Calendar, MapPin, Shield, Lock,
  Bell, HelpCircle, FileText, LogOut, ChevronRight,
  Copy, CheckCircle, Star, Zap, Edit3, AlertCircle,
  Award, TrendingUp,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const MOTIVATIONS = {
  phone: {
    icon: "📱",
    cta: "Add phone number",
    why: "Enable OTP security & faster transfers",
    color: "#a3e635",
    points: 50,
  },
  dob: {
    icon: "🎂",
    cta: "Add date of birth",
    why: "Required for KYC & Tier 2 upgrade",
    color: "#d4a847",
    points: 25,
  },
  address: {
    icon: "🏠",
    cta: "Add home address",
    why: "Unlock higher transaction limits",
    color: "#60a5fa",
    points: 50,
  },
  bio: {
    icon: "✍️",
    cta: "Write a short bio",
    why: "Let people know who you are on Xeevia",
    color: "#a855f7",
    points: 10,
  },
};

function ProfileCompletion({ profile }) {
  const fields = [
    { key: "phone",    done: !!profile?.phone         },
    { key: "dob",      done: !!profile?.date_of_birth },
    { key: "address",  done: !!profile?.home_address   },
    { key: "bio",      done: !!profile?.bio            },
  ];
  const done  = fields.filter(f=>f.done).length + 2; // +2 for name + email always present
  const total = fields.length + 2;
  const pct   = Math.round((done/total)*100);

  return (
    <div style={{ borderRadius:12, overflow:"hidden", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.055)", padding:"12px 13px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
        <div style={{ fontSize:12, fontFamily:"var(--font-b)", color:"rgba(255,255,255,0.5)" }}>Profile Completeness</div>
        <div style={{ fontFamily:"var(--font-d)", fontSize:14, fontWeight:800, color:pct===100?"var(--lime)":"var(--gold)" }}>{pct}%</div>
      </div>
      <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:6 }}>
        <div style={{ height:"100%", width:`${pct}%`, borderRadius:3, background:pct===100?"var(--lime)":"linear-gradient(90deg,var(--gold),var(--lime))", transition:"width 0.8s ease" }} />
      </div>
      {pct < 100 && (
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
          Complete your profile to unlock higher transfer limits & Tier 2 benefits
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, onEdit, isSet, motivation }) {
  return (
    <button
      onClick={onEdit}
      style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:isSet?"transparent":"rgba(255,255,255,0.01)", border:"none", borderBottom:"1px solid rgba(255,255,255,0.04)", cursor:"pointer", textAlign:"left", transition:"background .15s" }}
      onMouseEnter={e=>{ if(!isSet) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background=isSet?"transparent":"rgba(255,255,255,0.01)"; }}>
      <div style={{ display:"flex", alignItems:"center", gap:11 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:isSet?"rgba(255,255,255,0.04)":"rgba(163,230,53,0.06)", border:`1px solid ${isSet?"rgba(255,255,255,0.055)":"rgba(163,230,53,0.12)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Icon size={14} color={isSet?"rgba(255,255,255,0.35)":"rgba(163,230,53,0.6)"} />
        </div>
        <div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.28)", marginBottom:1, fontFamily:"var(--font-b)" }}>{label}</div>
          {isSet ? (
            <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.65)", fontFamily:"var(--font-b)", fontWeight:500 }}>{value}</div>
          ) : (
            <div style={{ fontSize:13, color:"rgba(163,230,53,0.65)", fontFamily:"var(--font-b)", fontWeight:600 }}>
              {motivation?.cta || `Set ${label}`}
            </div>
          )}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        {!isSet && motivation?.points && (
          <div style={{ padding:"2px 7px", background:"rgba(163,230,53,0.1)", border:"1px solid rgba(163,230,53,0.18)", borderRadius:10, fontSize:9.5, color:"var(--lime)", fontWeight:700 }}>
            +{motivation.points} EP
          </div>
        )}
        <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
      </div>
    </button>
  );
}

// Edit modal
function EditModal({ field, label, value, onClose, onSave }) {
  const [val, setVal] = useState(value || "");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(18px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:999 }}>
      <div className="glass" style={{ padding:20, width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", borderBottomColor:"transparent", borderColor:"rgba(163,230,53,0.18)" }}>
        <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800, marginBottom:4 }}>Edit {label}</div>
        {MOTIVATIONS[field] && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14, padding:"8px 11px", background:"rgba(163,230,53,0.06)", border:"1px solid rgba(163,230,53,0.12)", borderRadius:9 }}>
            <span style={{ fontSize:14 }}>{MOTIVATIONS[field].icon}</span>
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.5 }}>{MOTIVATIONS[field].why}</span>
          </div>
        )}
        <div className="f-card" style={{ marginBottom:16 }}>
          {field === "address" || field === "bio" ? (
            <textarea value={val} onChange={e=>setVal(e.target.value)} placeholder={`Enter your ${label.toLowerCase()}`} className="f-input" style={{ minHeight:80, resize:"none" }} />
          ) : (
            <input type={field==="dob"?"date":field==="phone"?"tel":"text"} value={val} onChange={e=>setVal(e.target.value)} placeholder={`Enter your ${label.toLowerCase()}`} className="f-input" />
          )}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn-lime" style={{ flex:1 }} disabled={!val} onClick={()=>onSave(val)}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function AccountTab({ setPage, onSuccess }) {
  const { profile, signOut } = useAuth();
  const [userData,    setUserData]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [editField,   setEditField]   = useState(null);
  const [copied,      setCopied]      = useState(false);
  const [savingField, setSavingField] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, email, phone, bio, date_of_birth, home_address, payment_status, created_at, verified, is_pro")
        .eq("id", profile.id)
        .maybeSingle();
      setUserData(data);
    } catch { }
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const displayName  = userData?.full_name || profile?.full_name || "Xeevia User";
  const initials     = displayName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const email        = userData?.email || profile?.email || "";
  const maskedEmail  = email ? email.replace(/(.)(.*?)(@.*)/, (_, f, m, d) => f + "*".repeat(Math.min(m.length,4)) + d) : "";
  const accountNo    = "9040" + Math.floor(100000 + parseInt((profile?.id || "0").replace(/-/g,"").slice(-6), 16) % 899999);

  const tier = userData?.payment_status === "vip" ? 2 : userData?.payment_status === "paid" ? 2 : 1;

  const copyAccount = () => {
    navigator.clipboard.writeText(accountNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const saveField = async (field, val) => {
    setSavingField(true);
    try {
      const update = {
        phone:        field==="phone"    ? val : undefined,
        date_of_birth:field==="dob"      ? val : undefined,
        home_address: field==="address"  ? val : undefined,
        bio:          field==="bio"      ? val : undefined,
      };
      // Remove undefined keys
      Object.keys(update).forEach(k => update[k]===undefined && delete update[k]);
      await supabase.from("profiles").update(update).eq("id", profile.id);
      await fetchUser();
      setEditField(null);
      onSuccess?.(`${editFieldLabel(field)} saved!`);
    } catch { alert("Save failed. Try again."); }
    finally { setSavingField(false); }
  };

  const editFieldLabel = (f) => ({ phone:"Phone Number", dob:"Date of Birth", address:"Home Address", bio:"Bio" }[f] || f);

  const settings = [
    { icon: Shield,    label: "Security",        sub: "PIN, biometrics, 2FA",   page: null },
    { icon: Lock,      label: "Change Password",  sub: "Update your password",   page: null },
    { icon: Bell,      label: "Notifications",    sub: "Manage alerts",          page: "notifications" },
    { icon: HelpCircle,label: "Help & Support",   sub: "24/7 support",           page: null },
    { icon: FileText,  label: "Terms & Privacy",  sub: "Legal information",      page: null },
  ];

  if (loading) {
    return (
      <div className="pw-scroll">
        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
          {[100,60,80,60,80].map((w,i)=>(
            <div key={i} style={{ height:w==="100"?100:48, borderRadius:12, background:"rgba(255,255,255,0.03)", animation:"pw-shimmer 1.4s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pw-scroll">
      <div style={{ paddingTop:0, flexShrink:0, display:"flex", alignItems:"center", height:50, gap:10, padding:"0 var(--pw-pad-left)", borderBottom:"1px solid var(--border)" }}>
        <span style={{ fontFamily:"var(--font-d)", fontSize:15, fontWeight:700 }}>Account</span>
      </div>

      <div style={{ padding:"15px 15px 0" }}>
        {/* Profile hero */}
        <div className="glass" style={{ padding:"18px 16px", marginBottom:12, textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:60, background:"linear-gradient(180deg,rgba(163,230,53,0.05),transparent)" }} />
          <div style={{ position:"relative" }}>
            <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,var(--lime),#65a30d)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", fontFamily:"var(--font-d)", fontWeight:800, fontSize:22, color:"#0a0e06", boxShadow:"0 4px 16px rgba(163,230,53,0.25)" }}>
              {initials}
            </div>
            <div style={{ fontFamily:"var(--font-d)", fontSize:18, fontWeight:800, marginBottom:3 }}>{displayName}</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <div style={{ padding:"3px 10px", background:`rgba(${tier===2?"163,230,53":"212,168,71"},0.12)`, border:`1px solid rgba(${tier===2?"163,230,53":"212,168,71"},0.25)`, borderRadius:20, fontSize:11, fontWeight:700, color:tier===2?"var(--lime)":"var(--gold)" }}>
                Tier {tier} Account
              </div>
              {userData?.verified && <div style={{ padding:"3px 10px", background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.25)", borderRadius:20, fontSize:11, fontWeight:700, color:"#60a5fa" }}>✓ Verified</div>}
            </div>

            {/* Account number */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:12, padding:"8px 14px", background:"rgba(0,0,0,0.2)", borderRadius:9 }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontFamily:"var(--font-b)" }}>Account No.</span>
              <span style={{ fontFamily:"var(--font-m)", fontSize:14, color:"rgba(255,255,255,0.7)" }}>{accountNo}</span>
              <button style={{ background:"transparent", border:"none", cursor:"pointer", color:copied?"var(--lime)":"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", padding:0, transition:"color .2s" }} onClick={copyAccount}>
                {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
              </button>
            </div>

            {/* Tier upgrade CTA */}
            {tier < 2 && (
              <button className="btn-lime full" style={{ marginTop:12 }}>
                <Award size={13}/> Upgrade to Tier 2
              </button>
            )}
          </div>
        </div>

        {/* Profile completion */}
        <ProfileCompletion profile={userData} />

        {/* Personal Information */}
        <div style={{ fontFamily:"var(--font-d)", fontSize:13.5, fontWeight:800, marginBottom:10, color:"var(--text)" }}>Personal Information</div>
        <div className="glass" style={{ padding:0, marginBottom:14, overflow:"hidden" }}>
          <InfoRow icon={User}     label="Full Name"    value={displayName}   isSet={true}   onEdit={()=>{}} />
          <InfoRow icon={Phone}    label="Phone Number" value={userData?.phone} isSet={!!userData?.phone} motivation={MOTIVATIONS.phone} onEdit={()=>setEditField("phone")} />
          <InfoRow icon={Mail}     label="Email Address" value={maskedEmail}   isSet={true}   onEdit={()=>{}} />
          <InfoRow icon={Calendar} label="Date of Birth" value={userData?.date_of_birth ? new Date(userData.date_of_birth).toLocaleDateString("en-NG",{day:"numeric",month:"long",year:"numeric"}) : null} isSet={!!userData?.date_of_birth} motivation={MOTIVATIONS.dob} onEdit={()=>setEditField("dob")} />
          <InfoRow icon={MapPin}   label="Home Address"  value={userData?.home_address}  isSet={!!userData?.home_address} motivation={MOTIVATIONS.address} onEdit={()=>setEditField("address")} style={{ borderBottom:"none" }} />
        </div>

        {/* Bio CTA if not set */}
        {!userData?.bio && (
          <button className="btn-ghost full" style={{ marginBottom:14, fontSize:12.5 }} onClick={()=>setEditField("bio")}>
            <Edit3 size={13}/> Write a short bio — tell people who you are ✨
          </button>
        )}

        {/* Incomplete fields reminder */}
        {(!userData?.phone || !userData?.date_of_birth || !userData?.home_address) && (
          <div style={{ borderRadius:12, padding:"12px 13px", background:"rgba(163,230,53,0.04)", border:"1px solid rgba(163,230,53,0.1)", marginBottom:14, fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:1.65 }}>
            <div style={{ color:"rgba(163,230,53,0.7)", fontWeight:700, marginBottom:4 }}>Complete your profile for more 🚀</div>
            {!userData?.phone      && <div>📱 Add phone → enable PIN-free transfers</div>}
            {!userData?.date_of_birth && <div>🎂 Add date of birth → unlock KYC & Tier 2</div>}
            {!userData?.home_address && <div>🏠 Add address → higher transaction limits</div>}
          </div>
        )}

        {/* Settings */}
        <div style={{ fontFamily:"var(--font-d)", fontSize:13.5, fontWeight:800, marginBottom:10, color:"var(--text)" }}>Settings</div>
        <div className="glass" style={{ padding:0, marginBottom:14, overflow:"hidden" }}>
          {settings.map((s,i)=>(
            <button key={i} onClick={()=>s.page&&setPage(s.page)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:"transparent", border:"none", borderBottom:i<settings.length-1?"1px solid rgba(255,255,255,0.04)":"none", cursor:"pointer", textAlign:"left", transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.025)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.055)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <s.icon size={14} color="rgba(255,255,255,0.35)" />
                </div>
                <div>
                  <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.7)", fontFamily:"var(--font-b)", fontWeight:500 }}>{s.label}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.28)", fontFamily:"var(--font-b)" }}>{s.sub}</div>
                </div>
              </div>
              <ChevronRight size={13} color="rgba(255,255,255,0.15)" />
            </button>
          ))}
        </div>

        {/* Sign out */}
        <button onClick={signOut} style={{ width:"100%", padding:"13px 0", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:12, color:"#f87171", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:24, transition:"all .15s", fontFamily:"var(--font-b)" }}
          onMouseEnter={e=>{ e.currentTarget.style.background="rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor="rgba(239,68,68,0.25)"; }}
          onMouseLeave={e=>{ e.currentTarget.style.background="rgba(239,68,68,0.06)"; e.currentTarget.style.borderColor="rgba(239,68,68,0.15)"; }}>
          <LogOut size={14}/> Sign Out
        </button>
      </div>

      {/* Edit modal */}
      {editField && (
        <EditModal
          field={editField}
          label={editFieldLabel(editField)}
          value={editField==="phone"?userData?.phone:editField==="dob"?userData?.date_of_birth:editField==="address"?userData?.home_address:userData?.bio}
          onClose={()=>setEditField(null)}
          onSave={(val)=>saveField(editField,val)}
        />
      )}
    </div>
  );
}