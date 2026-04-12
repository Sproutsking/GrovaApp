// paywave/tabs/AccountTab.jsx  ── v3 REFINED EDITION
import React, { useState, useEffect, useCallback } from "react";
import {
  User, Phone, Mail, Shield, Bell, HelpCircle, LogOut,
  ChevronRight, Copy, Check, Lock, FileText, Star, Zap, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <button onClick={copy} className="copy-ic">
      {copied ? <Check size={11}/> : <Copy size={11}/>}
    </button>
  );
}

function ListRow({ icon:Icon, label, sub, right, onClick, accent }) {
  return (
    <div className="xg xg-click" style={{ padding:"10px 12px" }} onClick={onClick}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, flex:1 }}>
          <div style={{
            width:30, height:30, borderRadius:8, flexShrink:0,
            background:accent?"rgba(163,230,53,0.07)":"rgba(255,255,255,0.035)",
            border:`1px solid ${accent?"rgba(163,230,53,0.14)":"rgba(255,255,255,0.055)"}`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Icon size={13} color={accent?"var(--lime)":"var(--t2)"} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"var(--fd)", fontSize:12.5, fontWeight:600, color:"var(--t1)" }}>{label}</div>
            {sub && <div style={{ fontSize:10.5, color:"var(--t2)", marginTop:1 }}>{sub}</div>}
          </div>
        </div>
        {right || <ChevronRight size={12} color="rgba(255,255,255,0.15)" />}
      </div>
    </div>
  );
}

export default function AccountTab({ setPage, onSuccess }) {
  const { profile, signOut } = useAuth();
  const [pwBalance, setPwBalance] = useState(0);
  const [epBalance, setEpBalance] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [notifOn,   setNotifOn]   = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("wallets").select("paywave_balance,engagement_points")
        .eq("user_id",profile.id).maybeSingle();
      setPwBalance(data?.paywave_balance??0);
      setEpBalance(data?.engagement_points??0);
    } catch {}
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const displayName = profile?.full_name || profile?.username || "Xeevia User";
  const initials    = displayName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const email       = profile?.email || "";
  const phone       = profile?.phone || "";
  const tier        = profile?.tier || "Tier 1";
  const accountNo   = profile?.account_number || profile?.id?.slice(0,10) || "——";

  const fields     = [displayName, email, phone, profile?.avatar_id];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const tierColor  = tier==="Tier 2"?"#a3e635":tier==="Tier 3"?"#d4a847":"rgba(255,255,255,0.35)";

  const SectionLabel = ({ children }) => (
    <div style={{ fontFamily:"var(--fd)", fontSize:9.5, fontWeight:700,
      color:"rgba(255,255,255,0.22)", textTransform:"uppercase",
      letterSpacing:"0.07em", marginBottom:8, marginTop:16 }}>
      {children}
    </div>
  );

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop:14, paddingBottom:12 }}>
        <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:800, letterSpacing:"-0.025em" }}>
          Account
        </div>
      </div>

      {/* Hero Card */}
      <div style={{
        marginBottom:12, borderRadius:18, overflow:"hidden", position:"relative",
        background:"linear-gradient(150deg,#0a0e08 0%,#0f1608 100%)",
        border:"1px solid rgba(163,230,53,0.12)",
      }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
          background:"linear-gradient(90deg,transparent,rgba(163,230,53,0.45),transparent)" }} />
        <div style={{ padding:"20px 16px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:9 }}>
          {/* Avatar */}
          {profile?.avatar_metadata?.publicUrl ? (
            <img src={profile.avatar_metadata.publicUrl} alt={displayName}
              style={{ width:60, height:60, borderRadius:"50%", objectFit:"cover",
                border:"2px solid rgba(163,230,53,0.28)", boxShadow:"0 5px 16px rgba(0,0,0,0.4)" }} />
          ) : (
            <div style={{
              width:60, height:60, borderRadius:"50%",
              background:"linear-gradient(135deg,#a3e635,#65a30d)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"var(--fd)", fontSize:22, fontWeight:800, color:"#060e02",
              boxShadow:"0 5px 16px rgba(163,230,53,0.26)", border:"2px solid rgba(163,230,53,0.28)",
            }}>{initials}</div>
          )}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"var(--fd)", fontSize:16, fontWeight:800, marginBottom:5 }}>{displayName}</div>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:4,
              padding:"3px 10px", borderRadius:20,
              background:`${tierColor}18`, border:`1px solid ${tierColor}38`,
              fontSize:"9.5px", fontWeight:700, color:tierColor, fontFamily:"var(--fd)",
            }}>
              <Star size={8} fill={tierColor} color={tierColor} />
              {tier} Account
            </div>
          </div>
          {/* Account number */}
          <div style={{
            display:"flex", alignItems:"center", gap:7,
            padding:"7px 12px", borderRadius:9,
            background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.065)",
            width:"100%", justifyContent:"center",
          }}>
            <span style={{ color:"var(--t3)", fontSize:"10.5px", fontFamily:"var(--fb)" }}>Acct No.</span>
            <span style={{ fontFamily:"var(--fm)", fontSize:13, color:"var(--t1)", letterSpacing:"0.04em" }}>
              {accountNo}
            </span>
            <CopyBtn value={accountNo} />
          </div>
          {/* Badges */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20,
              background:"rgba(34,211,238,0.07)", border:"1px solid rgba(34,211,238,0.14)" }}>
              <Zap size={9} color="#22d3ee" />
              <span style={{ fontSize:"10px", fontWeight:700, color:"#22d3ee", fontFamily:"var(--fd)" }}>
                {epBalance.toLocaleString()} EP
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20,
              background:"rgba(163,230,53,0.07)", border:"1px solid rgba(163,230,53,0.14)" }}>
              <span style={{ fontSize:"10px", fontWeight:700, color:"var(--lime)", fontFamily:"var(--fd)" }}>
                ₦{fmtNGN(pwBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Completeness */}
      <div className="xg" style={{ padding:"11px 13px", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
          <span style={{ fontFamily:"var(--fb)", fontSize:11.5, fontWeight:600, color:"var(--t1)" }}>
            Profile Completeness
          </span>
          <span style={{ fontFamily:"var(--fd)", fontSize:12, fontWeight:800, color:"#d4a847" }}>
            {completeness}%
          </span>
        </div>
        <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.055)", overflow:"hidden", marginBottom:6 }}>
          <div style={{
            height:"100%", width:`${completeness}%`, borderRadius:2,
            background:completeness>=80?"var(--lime)":completeness>=50?"#d4a847":"#f59e0b",
            transition:"width 1s ease",
          }} />
        </div>
        <div style={{ fontSize:"10.5px", color:"var(--t2)", fontFamily:"var(--fb)" }}>
          Complete profile to unlock higher limits & {tier==="Tier 1"?"Tier 2":"Tier 3"} benefits
        </div>
      </div>

      <SectionLabel>Personal Information</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        <ListRow icon={User} label="Full Name" sub={displayName} accent />
        <ListRow icon={Phone} label="Phone Number" sub={phone||"Add phone number"} accent={!!phone}
          right={!phone ? (
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ padding:"2px 7px", borderRadius:20, background:"rgba(34,211,238,0.09)",
                border:"1px solid rgba(34,211,238,0.18)", fontSize:"9px", color:"#22d3ee", fontWeight:700 }}>
                +50 EP
              </div>
              <ChevronRight size={12} color="rgba(255,255,255,0.15)" />
            </div>
          ) : undefined}
        />
        <ListRow icon={Mail} label="Email Address" sub={email||"Not set"} accent={!!email} />
      </div>

      <SectionLabel>Security</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        <ListRow icon={Lock}     label="Transaction PIN"  sub="Set or change your 4-digit PIN" />
        <ListRow icon={Shield}   label="KYC Verification" sub={tier==="Tier 1"?"Verify ID to upgrade":"Verified ✓"} accent={tier!=="Tier 1"} />
        <ListRow icon={FileText} label="Account Limits"   sub="View transfer & balance limits" />
      </div>

      <SectionLabel>Preferences</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        <ListRow icon={Bell} label="Notifications" sub={notifOn?"Push alerts enabled":"Disabled"}
          right={
            <div className={`xtog ${notifOn?"on":"off"}`}
              onClick={e=>{e.stopPropagation();setNotifOn(!notifOn);}}>
              <div className="xtog-thumb" />
            </div>
          }
        />
        <ListRow icon={HelpCircle} label="Help & Support" sub="FAQs, contact us" />
      </div>

      <div style={{ height:12 }} />
      <button className="btn-g full" onClick={()=>signOut?.()}>
        <LogOut size={13} /> Sign Out
      </button>
      <div style={{ textAlign:"center", paddingTop:10, paddingBottom:4 }}>
        <span style={{ fontSize:"9.5px", color:"rgba(255,255,255,0.14)", fontFamily:"var(--fb)" }}>
          Xeevia PayWave · Built with ♥ in Nigeria
        </span>
      </div>
    </div>
  );
}