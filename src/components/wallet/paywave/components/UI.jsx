// paywave/components/UI.jsx  ── v3 REFINED EDITION
// Pure UI components. No backend changes.
import React from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";

export const Header = ({ title, onBack, right }) => (
  <div className="pw-hdr">
    {onBack && (
      <button className="pw-back-btn" onClick={onBack}>
        <ArrowLeft size={12} />
      </button>
    )}
    <h1 className="pw-hdr-title" style={{ flex: 1 }}>{title}</h1>
    {right && right}
  </div>
);

export const Toggle = ({ on, onClick }) => (
  <div className={`xtog ${on ? "on" : "off"}`} onClick={onClick}>
    <div className="xtog-thumb" />
  </div>
);

export const Avatar = ({ letter, size = "sm" }) => (
  <div className={`xav xav-${size}`}>{letter}</div>
);

export const PlanIcon = ({ cls, children, size = 34 }) => (
  <div className={cls} style={{
    width: size, height: size, borderRadius: 9,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  }}>
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
    <div style={{ marginBottom: 9 }}>
      {label && (
        <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>{label}</div>
      )}
      <div className="copy-row">
        <span className="copy-val">{value}</span>
        <button className="copy-ic" onClick={copy}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
    </div>
  );
};

export const PlainField = ({ label, value }) => (
  <div style={{ marginBottom: 9 }}>
    {label && (
      <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>{label}</div>
    )}
    <div style={{
      padding: "9px 11px", borderRadius: "var(--r2)",
      background: "var(--s1)", border: "1px solid var(--b1)",
      color: "var(--t1)", fontSize: 13,
    }}>{value}</div>
  </div>
);

export const StatBox = ({ label, value, accent }) => (
  <div style={{
    background: "rgba(0,0,0,0.2)", border: "1px solid var(--b1)",
    borderRadius: "var(--r2)", padding: "9px 11px",
  }}>
    <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 2 }}>{label}</div>
    <div style={{
      fontFamily: "var(--fd)", fontWeight: 700, fontSize: 14,
      color: accent ? "var(--lime)" : "var(--t1)",
    }}>{value}</div>
  </div>
);

export const ListRow = ({ icon: Icon, label, sub, right, onClick, goldAccent }) => (
  <div className={`xg xg-click ${goldAccent ? "xg-gold" : ""}`}
    style={{ padding: "10px 12px" }} onClick={onClick}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1 }}>
        {Icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: goldAccent ? "var(--gold-d)" : "rgba(163,230,53,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon size={13} color={goldAccent ? "var(--gold)" : "var(--lime)"} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--fd)", fontSize: 12.5, fontWeight: 600, color: "var(--t1)" }}>{label}</div>
          {sub && <div style={{ color: "var(--t2)", fontSize: 10.5, marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  </div>
);

export const PlanCard = ({ icon: Icon, cls, name, desc, meta, onClick }) => (
  <div className="xg xg-click" style={{ padding: "11px 12px" }} onClick={onClick}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <PlanIcon cls={cls} size={36}><Icon size={16} color="#fff" /></PlanIcon>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 13, color: "var(--t1)", marginBottom: 1 }}>{name}</div>
        <div style={{ color: "var(--t2)", fontSize: 11, marginBottom: meta ? 3 : 0 }}>{desc}</div>
        {meta}
      </div>
      <div style={{ color: "var(--t4)", flexShrink: 0, fontSize: 14 }}>›</div>
    </div>
  </div>
);