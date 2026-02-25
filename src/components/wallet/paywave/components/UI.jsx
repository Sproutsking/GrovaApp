// paywave/components/UI.jsx
// Tiny reusable building blocks — Header, Toggle, Avatar, etc.

import React from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";

export const Header = ({ title, onBack, right }) => (
  <div className="pw-header">
    {onBack && (
      <button className="pw-back" onClick={onBack}>
        <ArrowLeft size={14} />
      </button>
    )}
    <h1 className="pw-header-title" style={{ flex: 1 }}>{title}</h1>
    {right && right}
  </div>
);

export const Toggle = ({ on }) => (
  <div className={`tog ${on ? "on" : "off"}`}>
    <div className="tog-thumb" />
  </div>
);

export const Avatar = ({ letter, size = "sm" }) => (
  <div className={`av av-${size}`}>{letter}</div>
);

export const PlanIcon = ({ cls, children, size = 38 }) => (
  <div
    className={cls}
    style={{
      width: size, height: size, borderRadius: 9,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}
  >
    {children}
  </div>
);

export const CopyField = ({ label, value }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginBottom: 5 }}>{label}</div>
      )}
      <div className="copy-row">
        <span className="copy-val">{value}</span>
        <button className="copy-ic" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
};

export const PlainField = ({ label, value }) => (
  <div style={{ marginBottom: 10 }}>
    {label && (
      <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginBottom: 5 }}>{label}</div>
    )}
    <div style={{ padding: "10px 13px", borderRadius: "var(--r-sm)", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}>
      {value}
    </div>
  </div>
);

// Stat box used in invest / save detail heroes
export const StatBox = ({ label, value, accent }) => (
  <div style={{ background: "rgba(0,0,0,0.28)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
    <div style={{ color: "var(--text-soft)", fontSize: 11, marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 15, color: accent ? "var(--lime)" : "var(--text)" }}>{value}</div>
  </div>
);

// A full-width list item row (used in account settings, help, etc.)
export const ListRow = ({ icon: Icon, label, sub, right, onClick, goldAccent }) => (
  <div
    className={`glass click ${goldAccent ? "glass-gold" : ""}`}
    style={{ padding: "11px 13px" }}
    onClick={onClick}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: goldAccent ? "var(--gold-dim)" : "rgba(163,230,53,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={15} color={goldAccent ? "var(--gold)" : "var(--lime)"} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{label}</div>
          {sub && <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  </div>
);

// Clickable plan card (invest / save list)
export const PlanCard = ({ icon: Icon, cls, name, desc, meta, onClick }) => (
  <div className="glass click" style={{ padding: "13px 14px" }} onClick={onClick}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <PlanIcon cls={cls} size={40}><Icon size={19} color="#fff" /></PlanIcon>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 2 }}>{name}</div>
        <div style={{ color: "var(--text-soft)", fontSize: 12, marginBottom: 3 }}>{desc}</div>
        {meta}
      </div>
      <div style={{ color: "var(--text-muted)", flexShrink: 0 }}>›</div>
    </div>
  </div>
);