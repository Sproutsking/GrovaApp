// src/components/wallet/tabs/SettingsTab.jsx
import React, { useState } from "react";
import {
  ArrowLeft, Lock, Shield, Bell, Key,
  ChevronRight, Eye, EyeOff, CheckCircle, Globe,
} from "lucide-react";
import { useCurrency, CURRENCIES } from "../../../contexts/CurrencyContext";
import CurrencyPicker from "../components/CurrencyPicker";

const SettingsTab = ({ setActiveTab, userId }) => {
  const [subView,    setSubView]    = useState(null);
  const [pinForm,    setPinForm]    = useState({ old: "", new: "", confirm: "" });
  const [showPhrase, setShowPhrase] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [txAlerts,   setTxAlerts]   = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [currPicker, setCurrPicker] = useState(false);

  const { currency, setCurrency, getCurrencyObj } = useCurrency();
  const cur = getCurrencyObj();

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 700));
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setSubView(null); }, 1200);
  };

  const Toggle = ({ on, onToggle }) => (
    <button
      onClick={onToggle}
      style={{
        width: 40, height: 22, borderRadius: 100,
        background: on ? "var(--lime)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${on ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.08)"}`,
        position: "relative", cursor: "pointer",
        transition: "all 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: on ? 20 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: on ? "#0c1800" : "#555",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </button>
  );

  /* ── Change PIN sub-view ── */
  if (subView === "changePin") return (
    <div className="view-enter">
      <div className="view-header">
        <button className="back-btn" onClick={() => setSubView(null)}><ArrowLeft size={18} /></button>
        <div>
          <div className="view-title">Change PIN</div>
          <div className="view-subtitle">Update your wallet PIN</div>
        </div>
      </div>
      <div className="form-body">
        {["old","new","confirm"].map(f => (
          <div className="field-group" key={f}>
            <label className="field-label">
              {f === "old" ? "Current PIN" : f === "new" ? "New PIN" : "Confirm PIN"}
            </label>
            <input
              type="password"
              className="field-input"
              placeholder="••••"
              maxLength={6}
              value={pinForm[f]}
              onChange={e => setPinForm(p => ({ ...p, [f]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {saved && (
        <div style={{ margin:"0 22px 16px", padding:"12px 14px", background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.16)", borderRadius:8, display:"flex", gap:8, alignItems:"center" }}>
          <CheckCircle size={15} color="#22c55e" />
          <span style={{ fontSize:13, color:"#22c55e", fontWeight:600 }}>PIN updated successfully</span>
        </div>
      )}
      <button
        className="btn-lime"
        disabled={saving || !pinForm.old || !pinForm.new || pinForm.new !== pinForm.confirm}
        onClick={handleSave}
      >
        {saving ? "Saving…" : <><Lock size={15} /> Update PIN</>}
      </button>
    </div>
  );

  /* ── Recovery sub-view ── */
  if (subView === "recovery") return (
    <div className="view-enter">
      <div className="view-header">
        <button className="back-btn" onClick={() => setSubView(null)}><ArrowLeft size={18} /></button>
        <div>
          <div className="view-title">Recovery Phrase</div>
          <div className="view-subtitle">Keep this absolutely secret</div>
        </div>
      </div>
      <div style={{ padding:"0 22px" }}>
        <div style={{ padding:"13px 15px", background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.13)", borderRadius:8, marginBottom:16, fontSize:12, color:"#f87171", lineHeight:1.6 }}>
          ⚠️ Never share your recovery phrase. Anyone with it has full access to your wallet.
        </div>
        {!showPhrase ? (
          <button className="btn-lime" onClick={() => setShowPhrase(true)}>
            <Eye size={15} /> Reveal Phrase
          </button>
        ) : (
          <>
            <div style={{ background:"var(--b2)", border:"1px solid var(--br1)", borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                {Array.from({length:12},(_,i) => `word${i+1}`).map((w,i) => (
                  <div key={w} style={{ padding:"7px 10px", background:"var(--black)", borderRadius:7, fontSize:11, color:"var(--t2)", fontFamily:"JetBrains Mono,monospace" }}>
                    <span style={{ color:"var(--t3)", fontSize:9 }}>{i+1}. </span>{w}
                  </div>
                ))}
              </div>
            </div>
            <button className="btn-ghost" onClick={() => setShowPhrase(false)}>
              <EyeOff size={15} /> Hide Phrase
            </button>
          </>
        )}
      </div>
    </div>
  );

  /* ── Main settings view ── */
  return (
    <div className="view-enter">
      <CurrencyPicker open={currPicker} onClose={() => setCurrPicker(false)} />

      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}><ArrowLeft size={18} /></button>
        <div>
          <div className="view-title">Wallet Settings</div>
          <div className="view-subtitle">Security & preferences</div>
        </div>
      </div>

      <div className="settings-list">

        {/* ── DISPLAY SECTION ── */}
        <div className="settings-group-title">Display</div>

        {/* Currency selector row */}
        <button className="settings-item" onClick={() => setCurrPicker(true)}>
          <div className="settings-item-icon" style={{ fontSize:18 }}>{cur.flag}</div>
          <div className="settings-item-info">
            <div className="settings-item-title">Display Currency</div>
            <div className="settings-item-sub">{cur.name} · {cur.symbol} ({cur.code})</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:10, color:"var(--lime)", letterSpacing:"0.1em", padding:"2px 7px", border:"1px solid rgba(132,204,22,0.22)", borderRadius:4, background:"rgba(132,204,22,0.06)" }}>
              {cur.code}
            </span>
            <ChevronRight size={15} color="var(--t3)" />
          </div>
        </button>

        <div style={{ padding:"8px 4px" }}>
          <div style={{ fontFamily:"JetBrains Mono,monospace", fontSize:9, color:"var(--t3)", lineHeight:1.6 }}>
            Fiat values are displayed as a reference equivalent. Auto-detected from your region — you can always change it above.
          </div>
        </div>

        {/* ── SECURITY ── */}
        <div className="settings-group-title">Security</div>

        <button className="settings-item" onClick={() => setSubView("changePin")}>
          <div className="settings-item-icon"><Lock size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Change PIN</div>
            <div className="settings-item-sub">Update your transaction PIN</div>
          </div>
          <ChevronRight size={15} color="var(--t3)" />
        </button>

        <div className="settings-item" style={{ cursor:"default" }}>
          <div className="settings-item-icon"><Shield size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Biometrics</div>
            <div className="settings-item-sub">Fingerprint / Face ID</div>
          </div>
          <Toggle on={biometrics} onToggle={() => setBiometrics(b => !b)} />
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div className="settings-group-title">Notifications</div>

        <div className="settings-item" style={{ cursor:"default" }}>
          <div className="settings-item-icon"><Bell size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Transaction Alerts</div>
            <div className="settings-item-sub">Notify on every transaction</div>
          </div>
          <Toggle on={txAlerts} onToggle={() => setTxAlerts(t => !t)} />
        </div>

        {/* ── ADVANCED ── */}
        <div className="settings-group-title">Advanced</div>

        <button className="settings-item" onClick={() => setSubView("recovery")}>
          <div className="settings-item-icon"><Key size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Recovery Phrase</div>
            <div className="settings-item-sub">Backup your wallet</div>
          </div>
          <ChevronRight size={15} color="var(--t3)" />
        </button>

      </div>
    </div>
  );
};

export default SettingsTab;