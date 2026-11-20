// src/components/wallet/tabs/SettingsTab.jsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Lock, Shield, Bell, Key, ChevronRight,
} from "lucide-react";
import { useCurrency } from "../../../contexts/CurrencyContext";
import { supabase } from "../../../services/config/supabase";
import PinSetupModal from "../../Modals/PinSetupModal";
import CurrencyPicker from "../components/CurrencyPicker";

const SettingsTab = ({ setActiveTab, onNativeCurrencyChange, userId }) => {
  const [pinStatus, setPinStatus] = useState(null);
  const [pinError, setPinError] = useState("");
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [currPicker, setCurrPicker] = useState(false);

  const { currency, getCurrencyObj } = useCurrency();
  const cur = getCurrencyObj();

  const loadPinStatus = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_transaction_pin_status");
    if (error) {
      setPinError(error.message || "Could not load transaction PIN status.");
      return;
    }
    setPinError("");
    setPinStatus(data || { has_pin: false, pin_length: 6 });
  }, [userId]);

  useEffect(() => {
    loadPinStatus();
  }, [loadPinStatus]);

  /* ── Main settings view ── */
  return (
    <div className="view-enter">
      <CurrencyPicker open={currPicker} onClose={() => setCurrPicker(false)} onSelect={onNativeCurrencyChange} />
      {pinModalOpen && pinStatus && (
        <PinSetupModal
          userId={userId}
          hasPin={Boolean(pinStatus.has_pin)}
          currentPinLength={pinStatus.pin_length}
          onClose={() => setPinModalOpen(false)}
          onSuccess={loadPinStatus}
        />
      )}

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
          <div className="settings-item-icon" style={{ fontSize:19 }}>{cur.flag}</div>
          <div className="settings-item-info">
            <div className="settings-item-title">Native Currency</div>
            <div className="settings-item-sub">{cur.name} · {cur.symbol} ({cur.code})</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:"JetBrains Mono,monospace", fontSize:11, color:"var(--lime)", letterSpacing:"0.1em", padding:"2px 7px", border:"1px solid rgba(132,204,22,0.22)", borderRadius:4, background:"rgba(132,204,22,0.06)" }}>
              {cur.code}
            </span>
            <ChevronRight size={15} color="var(--t3)" />
          </div>
        </button>

        {/* ── SECURITY ── */}
        <div className="settings-group-title">Security</div>

        <button className="settings-item" onClick={() => setPinModalOpen(true)} disabled={!pinStatus}>
          <div className="settings-item-icon"><Lock size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">{pinStatus?.has_pin ? "Change PIN" : "Set transaction PIN"}</div>
            <div className="settings-item-sub">{pinStatus?.has_pin ? `${pinStatus.pin_length}-digit PIN` : "Required for protected transactions"}</div>
          </div>
          <ChevronRight size={15} color="var(--t3)" />
        </button>
        {pinError && <div role="alert" style={{ padding: "0 22px 10px", color: "#f87171", fontSize: 12 }}>{pinError}</div>}

        <div className="settings-item" style={{ cursor:"default" }} aria-disabled="true">
          <div className="settings-item-icon"><Shield size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Biometrics</div>
            <div className="settings-item-sub">Not available for wallet authorization</div>
          </div>
          <span style={{ color: "var(--t3)", fontSize: 11 }}>Unavailable</span>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div className="settings-group-title">Notifications</div>

        <div className="settings-item" style={{ cursor:"default" }} aria-disabled="true">
          <div className="settings-item-icon"><Bell size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Transaction Alerts</div>
            <div className="settings-item-sub">Transaction notifications are not configured</div>
          </div>
          <span style={{ color: "var(--t3)", fontSize: 11 }}>Unavailable</span>
        </div>

        {/* ── ADVANCED ── */}
        <div className="settings-group-title">Advanced</div>

        <div className="settings-item" style={{ cursor:"default" }} aria-disabled="true">
          <div className="settings-item-icon"><Key size={17} /></div>
          <div className="settings-item-info">
            <div className="settings-item-title">Recovery phrase</div>
            <div className="settings-item-sub">This in-app wallet has no self-custody recovery phrase</div>
          </div>
          <span style={{ color: "var(--t3)", fontSize: 11 }}>Not applicable</span>
        </div>

      </div>
    </div>
  );
};

export default SettingsTab;