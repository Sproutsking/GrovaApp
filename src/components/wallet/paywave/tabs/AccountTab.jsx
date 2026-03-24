// paywave/tabs/AccountTab.jsx
// ─────────────────────────────────────────────────────────────
// PayWave Account tab — profile, KYC, security, settings.
// Uses pw-scroll-px so horizontal padding comes from CSS class.
// All action buttons use btn-lime full / btn-ghost — no inline padding.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  User, Phone, Mail, Shield, Bell, HelpCircle, LogOut,
  ChevronRight, Copy, Check, Camera, Lock, FileText,
  Star, Zap, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="xpw__copy-ic">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function ListRow({ icon: Icon, label, sub, right, onClick, accent }) {
  return (
    <div
      className="xpw__glass xpw__click"
      style={{ padding: "12px 14px" }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: accent ? "rgba(163,230,53,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${accent ? "rgba(163,230,53,0.15)" : "rgba(255,255,255,0.06)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={15} color={accent ? "var(--lime)" : "var(--text-soft)"} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{label}</div>
            {sub && <div style={{ fontSize: 11.5, color: "var(--text-soft)", marginTop: 1 }}>{sub}</div>}
          </div>
        </div>
        {right || <ChevronRight size={14} color="rgba(255,255,255,0.18)" />}
      </div>
    </div>
  );
}

export default function AccountTab({ setPage, onSuccess }) {
  const { profile, signOut } = useAuth();
  const [pwBalance, setPwBalance] = useState(0);
  const [epBalance, setEpBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notifOn, setNotifOn] = useState(true);
  const [showAccNum, setShowAccNum] = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("wallets")
        .select("paywave_balance, engagement_points")
        .eq("user_id", profile.id)
        .maybeSingle();
      setPwBalance(data?.paywave_balance ?? 0);
      setEpBalance(data?.engagement_points ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const displayName = profile?.full_name || profile?.username || "Xeevia User";
  const initials = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const username = profile?.username || "";
  const email = profile?.email || "";
  const phone = profile?.phone || "";
  const tier = profile?.tier || "Tier 1";
  const accountNo = profile?.account_number || profile?.id?.slice(0, 10) || "——";

  // Profile completeness calc
  const fields = [displayName, email, phone, profile?.avatar_id];
  const filled = fields.filter(Boolean).length;
  const completeness = Math.round((filled / fields.length) * 100);

  const tierColor = tier === "Tier 2" ? "#a3e635" : tier === "Tier 3" ? "#d4a847" : "rgba(255,255,255,0.38)";

  const handleSignOut = async () => {
    try { await signOut?.(); } catch { /* ignore */ }
  };

  return (
    <div className="pw-scroll-px">

      {/* ── Page title ── */}
      <div style={{ paddingTop: 20, paddingBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em" }}>
          Account
        </div>
      </div>

      {/* ── Avatar Hero Card ── */}
      <div className="xpw__glass" style={{
        marginBottom: 14,
        background: "linear-gradient(150deg, rgba(10,14,8,1) 0%, rgba(15,22,10,1) 100%)",
        border: "1px solid rgba(163,230,53,0.12)",
        borderRadius: 18,
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(163,230,53,0.5),transparent)" }} />

        <div style={{ padding: "24px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {/* Avatar */}
          <div style={{ position: "relative" }}>
            {profile?.avatar_metadata?.publicUrl || profile?.avatar_metadata?.url ? (
              <img
                src={profile.avatar_metadata.publicUrl || profile.avatar_metadata.url}
                alt={displayName}
                style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(163,230,53,0.3)", boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}
              />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(135deg,#a3e635,#65a30d)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-d)", fontSize: 26, fontWeight: 800, color: "#080e03",
                boxShadow: "0 6px 20px rgba(163,230,53,0.28)",
                border: "2px solid rgba(163,230,53,0.3)",
              }}>
                {initials}
              </div>
            )}
          </div>

          {/* Name */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, marginBottom: 5 }}>{displayName}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 12px", borderRadius: 20,
              background: `${tierColor}18`, border: `1px solid ${tierColor}40`,
              fontSize: 11, fontWeight: 700, color: tierColor,
              fontFamily: "var(--font-d)",
            }}>
              <Star size={9} fill={tierColor} color={tierColor} />
              {tier} Account
            </div>
          </div>

          {/* Account number */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            width: "100%", justifyContent: "center",
          }}>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "var(--font-b)" }}>Account No.</span>
            <span style={{ fontFamily: "var(--font-m)", fontSize: 14, color: "var(--text)", letterSpacing: "0.04em" }}>
              {showAccNum ? accountNo : "••••••••••"}
            </span>
            <CopyBtn value={accountNo} />
          </div>

          {/* EP balance badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.15)" }}>
              <Zap size={10} color="#22d3ee" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#22d3ee", fontFamily: "var(--font-d)" }}>{epBalance.toLocaleString()} EP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "rgba(163,230,53,0.07)", border: "1px solid rgba(163,230,53,0.15)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--lime)", fontFamily: "var(--font-d)" }}>₦{fmtNGN(pwBalance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Completeness ── */}
      <div className="xpw__glass" style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-b)", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
            Profile Completeness
          </span>
          <span style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 800, color: "#d4a847" }}>{completeness}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            height: "100%", width: `${completeness}%`, borderRadius: 3,
            background: completeness >= 80 ? "var(--lime)" : completeness >= 50 ? "#d4a847" : "#f59e0b",
            transition: "width 1s ease",
          }} />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-soft)", fontFamily: "var(--font-b)" }}>
          Complete your profile to unlock higher transfer limits & {tier === "Tier 1" ? "Tier 2" : "Tier 3"} benefits
        </div>
      </div>

      {/* ── Personal Information ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Personal Information
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <ListRow
            icon={User}
            label="Full Name"
            sub={displayName}
            accent
          />
          <ListRow
            icon={Phone}
            label="Phone Number"
            sub={phone || "Add phone number"}
            accent={!!phone}
            right={
              !phone ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ padding: "3px 8px", borderRadius: 20, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", fontSize: 10, color: "#22d3ee", fontWeight: 700 }}>
                    +50 EP
                  </div>
                  <ChevronRight size={14} color="rgba(255,255,255,0.18)" />
                </div>
              ) : undefined
            }
          />
          <ListRow
            icon={Mail}
            label="Email Address"
            sub={email || "Not set"}
            accent={!!email}
          />
        </div>
      </div>

      {/* ── Security ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Security
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <ListRow icon={Lock} label="Transaction PIN" sub="Set or change your 4-digit PIN" />
          <ListRow icon={Shield} label="KYC Verification" sub={tier === "Tier 1" ? "Verify ID to upgrade tier" : "Verified ✓"} accent={tier !== "Tier 1"} />
          <ListRow icon={FileText} label="Account Limits" sub="View transfer & balance limits" />
        </div>
      </div>

      {/* ── Preferences ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Preferences
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <ListRow
            icon={Bell}
            label="Notifications"
            sub={notifOn ? "Push alerts enabled" : "Push alerts disabled"}
            right={
              <div
                className={`xpw__tog ${notifOn ? "xpw__on" : "xpw__off"}`}
                onClick={(e) => { e.stopPropagation(); setNotifOn(!notifOn); }}
              >
                <div className="xpw__tog-thumb" />
              </div>
            }
          />
          <ListRow icon={HelpCircle} label="Help & Support" sub="FAQs, contact us" />
        </div>
      </div>

      {/* ── Sign Out ── */}
      <button
        className="xpw__btn-secondary xpw__full"
        onClick={handleSignOut}
        style={{ marginBottom: 8 }}
      >
        <LogOut size={14} />
        Sign Out
      </button>

      <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 4 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-b)" }}>
          Xeevia PayWave · Built with ♥ in Nigeria
        </span>
      </div>
    </div>
  );
}