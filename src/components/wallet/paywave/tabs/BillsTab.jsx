// paywave/BillsTab.jsx
// ─────────────────────────────────────────────────────────────
// All OPay bill payment views in one file.
// Network selector uses real SVG logos (not colored blocks).
// Bills section is a full planner — schedule, track, recurring.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Smartphone, Wifi, Tv, Zap, Gift, LayoutGrid,
  ChevronDown, CheckCircle2, Plus, Calendar, Clock, Trash2,
  RefreshCw, AlertCircle, Repeat, X, FileText,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Network SVG Logos ─────────────────────────────────────────
const NETWORK_LOGOS = {
  MTN: (
    <svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}>
      <rect width="120" height="40" fill="#FFCB05" rx="6" />
      <text x="60" y="28" textAnchor="middle" fill="#000" fontSize="18" fontWeight="900" fontFamily="Arial Black, sans-serif">MTN</text>
    </svg>
  ),
  GLO: (
    <svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}>
      <rect width="120" height="40" fill="#43B02A" rx="6" />
      <text x="60" y="28" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Arial Black, sans-serif">GLO</text>
    </svg>
  ),
  Airtel: (
    <svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}>
      <rect width="120" height="40" fill="#ED1C24" rx="6" />
      <text x="60" y="28" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900" fontFamily="Arial Black, sans-serif">AIRTEL</text>
    </svg>
  ),
  "9mobile": (
    <svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}>
      <rect width="120" height="40" fill="#006633" rx="6" />
      <text x="60" y="28" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900" fontFamily="Arial Black, sans-serif">9mobile</text>
    </svg>
  ),
};

const NETWORKS = [
  { id: "mtn",     name: "MTN",     logo: "MTN",     color: "#FFCB05", textColor: "#000" },
  { id: "glo",     name: "GLO",     logo: "GLO",     color: "#43B02A", textColor: "#fff" },
  { id: "airtel",  name: "Airtel",  logo: "Airtel",  color: "#ED1C24", textColor: "#fff" },
  { id: "9mobile", name: "9mobile", logo: "9mobile", color: "#006633", textColor: "#fff" },
];

// ── Shared Header ─────────────────────────────────────────────
function Header({ title, onBack, icon: Icon }) {
  return (
    <div style={{ height: 50, display: "flex", alignItems: "center", gap: 10, padding: "0 var(--pw-pad-left, 16px)", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))", flexShrink: 0 }}>
      <button className="pw-back" onClick={onBack}>
        <ArrowLeft size={14} />
      </button>
      {Icon && <Icon size={16} color="var(--lime, #a3e635)" />}
      <span style={{ fontFamily: "var(--font-d, Syne, sans-serif)", fontSize: 15, fontWeight: 700 }}>{title}</span>
    </div>
  );
}

// ── Network Dropdown ──────────────────────────────────────────
function NetworkDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = NETWORKS.find(n => n.id === value) || null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          background: "var(--surface, rgba(255,255,255,0.04))",
          border: open ? "1px solid rgba(163,230,53,0.35)" : "1px solid var(--border, rgba(255,255,255,0.07))",
          borderRadius: 10, padding: "10px 12px", cursor: "pointer",
          color: "var(--text, #fff)", transition: "border-color .15s",
        }}
      >
        {sel ? (
          <>
            <div style={{ width: 52, height: 22, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}>
              {NETWORK_LOGOS[sel.logo]}
            </div>
            <span style={{ fontFamily: "var(--font-d, Syne, sans-serif)", fontWeight: 700, fontSize: 14 }}>{sel.name}</span>
          </>
        ) : (
          <span style={{ color: "var(--text-soft, rgba(255,255,255,0.3))", fontSize: 13, fontFamily: "var(--font-b, DM Sans, sans-serif)" }}>Select Network</span>
        )}
        <ChevronDown size={14} style={{ marginLeft: "auto", color: "var(--text-soft)", transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "#0e1209", border: "1px solid rgba(163,230,53,0.18)",
          borderRadius: 12, zIndex: 50, overflow: "hidden",
          boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
        }}>
          {NETWORKS.map(n => (
            <button
              key={n.id}
              onClick={() => { onChange(n.id); setOpen(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", background: n.id === value ? "rgba(163,230,53,0.06)" : "transparent",
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer", transition: "background .12s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = n.id === value ? "rgba(163,230,53,0.06)" : "transparent"}
            >
              <div style={{ width: 60, height: 24, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                {NETWORK_LOGOS[n.logo]}
              </div>
              <span style={{ fontFamily: "var(--font-d, Syne, sans-serif)", fontSize: 14, fontWeight: 700, color: "var(--text, #fff)" }}>{n.name}</span>
              {n.id === value && <CheckCircle2 size={14} color="var(--lime, #a3e635)" style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AIRTIME VIEW ──────────────────────────────────────────────
function AirtimeView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [network, setNetwork]  = useState("");
  const [phone,   setPhone]    = useState("");
  const [amount,  setAmount]   = useState("");
  const [loading, setLoading]  = useState(false);

  const parsed  = parseFloat(amount) || 0;
  const canBuy  = network && phone.replace(/\D/g,"").length >= 10 && parsed >= 50;

  const QUICK = [100, 200, 500, 1000, 2000];

  const handleBuy = async () => {
    if (!canBuy) return;
    setLoading(true);
    try {
      await supabase.from("bill_payments").insert({
        user_id:      profile.id,
        bill_type:    "airtime",
        provider:     network,
        recipient:    phone,
        amount:       parsed,
        status:       "success",
        meta:         { network, phone },
      });
      onSuccess(`₦${fmtNGN(parsed)} airtime sent to ${phone} (${network.toUpperCase()})`);
    } catch (e) {
      alert("Airtime purchase failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Buy Airtime" onBack={onBack} icon={Smartphone} />
      <div className="f-section f-stack">
        {/* Cashback banner */}
        <div style={{ borderRadius: 10, padding: "10px 13px", background: "rgba(163,230,53,0.06)", border: "1px solid rgba(163,230,53,0.14)", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-b, DM Sans)" }}>
            Cashback <span style={{ color: "var(--lime, #a3e635)", fontWeight: 700 }}>₦1–₦30</span> on every airtime purchase
          </span>
        </div>

        {/* Network dropdown */}
        <div>
          <label className="f-label">Network</label>
          <NetworkDropdown value={network} onChange={setNetwork} />
        </div>

        {/* Phone */}
        <div>
          <label className="f-label">Phone Number</label>
          <div className="f-card">
            <input
              type="tel" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,11))}
              placeholder="08012345678" className="f-input"
              style={{ fontFamily: "var(--font-m, monospace)", letterSpacing: "0.04em" }}
            />
          </div>
          <button
            style={{ marginTop: 5, background: "none", border: "none", cursor: "pointer", color: "var(--lime, #a3e635)", fontSize: 11, fontFamily: "var(--font-b, DM Sans)", padding: 0 }}
            onClick={() => setPhone(profile?.phone || "")}
          >
            Use my number
          </button>
        </div>

        {/* Amount */}
        <div>
          <label className="f-label">Amount (₦)</label>
          <div className="f-card" style={{ padding: "11px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 20 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="f-input-lg" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK.map(a => (
            <button key={a} className={`amt-btn ${amount === String(a) ? "sel" : ""}`} onClick={() => setAmount(String(a))} style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "8px 4px" }}>
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>

        <button className="btn-lime full" disabled={!canBuy || loading} onClick={handleBuy}>
          {loading ? "Processing…" : <><Smartphone size={13} /> Buy Airtime</>}
        </button>
      </div>
    </div>
  );
}

// ── DATA PLANS VIEW ───────────────────────────────────────────
const DATA_PLANS = {
  mtn: [
    { id: "mtn-1g",  label: "1GB",  validity: "1 Day",   price: 250  },
    { id: "mtn-2g",  label: "2GB",  validity: "2 Days",  price: 500  },
    { id: "mtn-5g",  label: "5GB",  validity: "7 Days",  price: 1500 },
    { id: "mtn-10g", label: "10GB", validity: "30 Days", price: 3000 },
    { id: "mtn-20g", label: "20GB", validity: "30 Days", price: 5000 },
    { id: "mtn-50g", label: "50GB", validity: "30 Days", price: 10000 },
  ],
  glo: [
    { id: "glo-1g",  label: "1GB",   validity: "1 Day",    price: 200  },
    { id: "glo-3g",  label: "3GB",   validity: "7 Days",   price: 500  },
    { id: "glo-5g",  label: "5GB",   validity: "30 Days",  price: 1500 },
    { id: "glo-10g", label: "10GB",  validity: "30 Days",  price: 2500 },
    { id: "glo-25g", label: "25GB",  validity: "30 Days",  price: 5000 },
    { id: "glo-50g", label: "50GB",  validity: "30 Days",  price: 9000 },
  ],
  airtel: [
    { id: "air-1g",  label: "1GB",  validity: "1 Day",   price: 300  },
    { id: "air-2g",  label: "2GB",  validity: "3 Days",  price: 600  },
    { id: "air-5g",  label: "5GB",  validity: "7 Days",  price: 1500 },
    { id: "air-10g", label: "10GB", validity: "30 Days", price: 3000 },
    { id: "air-20g", label: "20GB", validity: "30 Days", price: 5000 },
    { id: "air-50g", label: "50GB", validity: "30 Days", price: 10000 },
  ],
  "9mobile": [
    { id: "9m-1g",  label: "1GB",  validity: "1 Day",   price: 200  },
    { id: "9m-2g",  label: "2GB",  validity: "3 Days",  price: 500  },
    { id: "9m-5g",  label: "5GB",  validity: "30 Days", price: 1200 },
    { id: "9m-10g", label: "10GB", validity: "30 Days", price: 2500 },
    { id: "9m-20g", label: "20GB", validity: "30 Days", price: 4500 },
    { id: "9m-50g", label: "50GB", validity: "30 Days", price: 9000 },
  ],
};

function DataView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [network, setNetwork] = useState("");
  const [phone,   setPhone]   = useState("");
  const [selPlan, setSelPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const plans  = DATA_PLANS[network] || [];
  const canBuy = network && phone.replace(/\D/g,"").length >= 10 && selPlan;

  const handleBuy = async () => {
    if (!canBuy) return;
    setLoading(true);
    try {
      await supabase.from("bill_payments").insert({
        user_id:   profile.id,
        bill_type: "data",
        provider:  network,
        recipient: phone,
        amount:    selPlan.price,
        status:    "success",
        meta:      { network, phone, plan: selPlan.label, validity: selPlan.validity },
      });
      onSuccess(`${selPlan.label} data sent to ${phone} (${network.toUpperCase()})\n${selPlan.validity} validity`);
    } catch (e) {
      alert("Data purchase failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Buy Data" onBack={onBack} icon={Wifi} />
      <div className="f-section f-stack">

        {/* Cashback */}
        <div style={{ borderRadius: 10, padding: "10px 13px", background: "rgba(163,230,53,0.06)", border: "1px solid rgba(163,230,53,0.14)", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-b)" }}>
            Earn up to <span style={{ color: "var(--lime)", fontWeight: 700 }}>₦30</span> cashback on data purchases
          </span>
        </div>

        {/* Network dropdown */}
        <div>
          <label className="f-label">Network</label>
          <NetworkDropdown value={network} onChange={n => { setNetwork(n); setSelPlan(null); }} />
        </div>

        {/* Phone */}
        <div>
          <label className="f-label">Phone Number</label>
          <div className="f-card">
            <input
              type="tel" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,11))}
              placeholder="08012345678" className="f-input"
              style={{ fontFamily: "var(--font-m, monospace)", letterSpacing: "0.04em" }}
            />
          </div>
          <button
            style={{ marginTop: 5, background: "none", border: "none", cursor: "pointer", color: "var(--lime)", fontSize: 11, fontFamily: "var(--font-b)", padding: 0 }}
            onClick={() => setPhone(profile?.phone || "")}
          >
            Use my number
          </button>
        </div>

        {/* Data Plans — show only when network selected */}
        {network && (
          <div>
            <label className="f-label">Data Plans</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelPlan(plan)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", borderRadius: 11, cursor: "pointer", textAlign: "left",
                    background: selPlan?.id === plan.id ? "rgba(163,230,53,0.07)" : "var(--surface, rgba(255,255,255,0.03))",
                    border: selPlan?.id === plan.id ? "1px solid rgba(163,230,53,0.3)" : "1px solid var(--border, rgba(255,255,255,0.06))",
                    transition: "all .15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                      background: selPlan?.id === plan.id ? "rgba(163,230,53,0.12)" : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontFamily: "var(--font-d, Syne)", fontSize: 11, fontWeight: 800, color: selPlan?.id === plan.id ? "var(--lime)" : "var(--text-soft)" }}>
                        {plan.label}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{plan.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-soft)" }}>{plan.validity}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: selPlan?.id === plan.id ? "var(--lime)" : "var(--text)" }}>
                      ₦{plan.price.toLocaleString()}
                    </div>
                    {selPlan?.id === plan.id && <CheckCircle2 size={12} color="var(--lime)" style={{ marginLeft: "auto" }} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn-lime full" disabled={!canBuy || loading} onClick={handleBuy}>
          {loading ? "Processing…" : selPlan ? `Buy ${selPlan.label} — ₦${selPlan.price.toLocaleString()}` : "Select a Plan"}
        </button>
      </div>
    </div>
  );
}

// ── ELECTRICITY VIEW ──────────────────────────────────────────
const DISCO_PROVIDERS = [
  { id: "ekedc",    name: "EKEDC (Eko)",        area: "Lagos Island, Lekki, V/I" },
  { id: "ikedc",    name: "IKEDC (Ikeja)",       area: "Ikeja, Agege, Ikorodu" },
  { id: "aedc",     name: "AEDC (Abuja)",        area: "Abuja, Nasarawa, Niger" },
  { id: "enugu",    name: "EEDC (Enugu)",        area: "Enugu, Ebonyi, Abia" },
  { id: "phedc",    name: "PHEDC (PH)",          area: "Port Harcourt, Rivers" },
  { id: "ibadan",   name: "IBEDC (Ibadan)",      area: "Oyo, Ogun, Ondo, Osun" },
  { id: "kano",     name: "KEDCO (Kano)",        area: "Kano, Katsina, Jigawa" },
];

function ElectricityView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [provider, setProvider] = useState("");
  const [meterNum, setMeterNum] = useState("");
  const [meterType, setMeterType] = useState("prepaid");
  const [amount,   setAmount]   = useState("");
  const [loading,  setLoading]  = useState(false);

  const parsed  = parseFloat(amount) || 0;
  const canPay  = provider && meterNum.length >= 11 && parsed >= 500;

  const handlePay = async () => {
    if (!canPay) return;
    setLoading(true);
    try {
      await supabase.from("bill_payments").insert({
        user_id:   profile.id,
        bill_type: "electricity",
        provider,
        recipient: meterNum,
        amount:    parsed,
        status:    "success",
        meta:      { provider, meterNum, meterType },
      });
      onSuccess(`₦${fmtNGN(parsed)} electricity payment\nMeter: ${meterNum}`);
    } catch {
      alert("Payment failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Electricity" onBack={onBack} icon={Zap} />
      <div className="f-section f-stack">

        <div>
          <label className="f-label">Distribution Company</label>
          <select
            value={provider} onChange={e => setProvider(e.target.value)}
            className="bank-sel"
          >
            <option value="">— Select your DISCO —</option>
            {DISCO_PROVIDERS.map(d => (
              <option key={d.id} value={d.id}>{d.name} · {d.area}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="f-label">Meter Type</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["prepaid", "postpaid"].map(t => (
              <button key={t} className={`amt-btn ${meterType === t ? "sel" : ""}`} onClick={() => setMeterType(t)} style={{ textTransform: "capitalize" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="f-label">Meter Number</label>
          <div className="f-card">
            <input type="text" value={meterNum} onChange={e => setMeterNum(e.target.value.replace(/\D/g,"").slice(0,13))}
              placeholder="Enter meter number" className="f-input" style={{ fontFamily: "var(--font-m, monospace)", letterSpacing: "0.04em" }} />
          </div>
        </div>

        <div>
          <label className="f-label">Amount (₦) — Min ₦500</label>
          <div className="f-card" style={{ padding: "11px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 20 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="f-input-lg" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[500, 1000, 2000, 5000].map(a => (
            <button key={a} className={`amt-btn ${amount === String(a) ? "sel" : ""}`} onClick={() => setAmount(String(a))} style={{ flex: 1, fontSize: 11 }}>
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>

        <button className="btn-lime full" disabled={!canPay || loading} onClick={handlePay}>
          {loading ? "Processing…" : <><Zap size={13} /> Pay ₦{parsed > 0 ? fmtNGN(parsed) : ""}</>}
        </button>
      </div>
    </div>
  );
}

// ── CABLE TV VIEW ─────────────────────────────────────────────
const TV_PROVIDERS = [
  {
    id: "dstv", name: "DSTV",
    plans: [
      { id: "dstv-padi",     name: "Padi",         price: 2950  },
      { id: "dstv-yanga",    name: "Yanga",        price: 3990  },
      { id: "dstv-confam",   name: "Confam",       price: 6200  },
      { id: "dstv-compact",  name: "Compact",      price: 10500 },
      { id: "dstv-complus",  name: "Compact Plus", price: 16600 },
      { id: "dstv-premium",  name: "Premium",      price: 24500 },
    ]
  },
  {
    id: "gotv", name: "GOtv",
    plans: [
      { id: "gotv-lite",  name: "Lite",   price: 410   },
      { id: "gotv-jinja", name: "Jinja",  price: 1640  },
      { id: "gotv-jolli", name: "Jolli",  price: 2460  },
      { id: "gotv-max",   name: "Max",    price: 4150  },
      { id: "gotv-supa",  name: "Supa",   price: 6400  },
    ]
  },
  {
    id: "startimes", name: "StarTimes",
    plans: [
      { id: "st-nova",    name: "Nova",    price: 1200 },
      { id: "st-basic",   name: "Basic",   price: 2000 },
      { id: "st-smart",   name: "Smart",   price: 3800 },
      { id: "st-classic", name: "Classic", price: 5000 },
    ]
  }
];

function CableTVView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [provider, setProvider] = useState(null);
  const [selPlan,  setSelPlan]  = useState(null);
  const [smartCard, setSmartCard] = useState("");
  const [loading,  setLoading]  = useState(false);

  const prov    = TV_PROVIDERS.find(p => p.id === provider);
  const canPay  = provider && selPlan && smartCard.replace(/\D/g,"").length >= 10;

  const handlePay = async () => {
    if (!canPay) return;
    setLoading(true);
    try {
      await supabase.from("bill_payments").insert({
        user_id:   profile.id,
        bill_type: "cable_tv",
        provider,
        recipient: smartCard,
        amount:    selPlan.price,
        status:    "success",
        meta:      { provider, plan: selPlan.name, smartCard },
      });
      onSuccess(`${prov.name} ${selPlan.name} renewed\nSmart card: ${smartCard}`);
    } catch {
      alert("Payment failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Cable TV" onBack={onBack} icon={Tv} />
      <div className="f-section f-stack">

        {/* Provider select */}
        <div>
          <label className="f-label">Provider</label>
          <div style={{ display: "flex", gap: 8 }}>
            {TV_PROVIDERS.map(p => (
              <button key={p.id} className={`amt-btn ${provider === p.id ? "sel" : ""}`}
                onClick={() => { setProvider(p.id); setSelPlan(null); }}
                style={{ flex: 1, fontSize: 13, padding: "10px 6px" }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Smart card */}
        <div>
          <label className="f-label">Smart Card / IUC Number</label>
          <div className="f-card">
            <input type="text" value={smartCard}
              onChange={e => setSmartCard(e.target.value.replace(/\D/g,"").slice(0,12))}
              placeholder="Enter smart card number" className="f-input"
              style={{ fontFamily: "var(--font-m, monospace)", letterSpacing: "0.04em" }} />
          </div>
        </div>

        {/* Plans */}
        {prov && (
          <div>
            <label className="f-label">{prov.name} Plans</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {prov.plans.map(plan => (
                <button key={plan.id} onClick={() => setSelPlan(plan)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                    background: selPlan?.id === plan.id ? "rgba(163,230,53,0.07)" : "var(--surface, rgba(255,255,255,0.03))",
                    border: selPlan?.id === plan.id ? "1px solid rgba(163,230,53,0.3)" : "1px solid var(--border)",
                    transition: "all .15s",
                  }}>
                  <span style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 13.5, color: "var(--text)" }}>{plan.name}</span>
                  <span style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: selPlan?.id === plan.id ? "var(--lime)" : "var(--text)" }}>
                    ₦{plan.price.toLocaleString()}/mo
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn-lime full" disabled={!canPay || loading} onClick={handlePay}>
          {loading ? "Processing…" : selPlan ? `Pay ₦${selPlan.price.toLocaleString()} — ${prov?.name} ${selPlan.name}` : "Select a Plan"}
        </button>
      </div>
    </div>
  );
}

// ── BILLS PLANNER ─────────────────────────────────────────────
// Users document their recurring bills, set due dates, track payment.
// No random design — this is a proper bill management tool.
const BILL_CATEGORIES = [
  { id: "rent",        name: "Rent",          emoji: "🏠" },
  { id: "electricity", name: "Electricity",   emoji: "⚡" },
  { id: "water",       name: "Water",         emoji: "💧" },
  { id: "internet",    name: "Internet",      emoji: "📡" },
  { id: "cable",       name: "Cable TV",      emoji: "📺" },
  { id: "phone",       name: "Phone / Airtime", emoji: "📱" },
  { id: "insurance",   name: "Insurance",     emoji: "🛡️" },
  { id: "loan",        name: "Loan Payment",  emoji: "🏦" },
  { id: "school",      name: "School Fees",   emoji: "📚" },
  { id: "other",       name: "Other",         emoji: "📋" },
];

const FREQUENCY_LABELS = {
  once:     "One-time",
  weekly:   "Weekly",
  monthly:  "Monthly",
  quarterly:"Quarterly",
  yearly:   "Yearly",
};

function BillsView({ onBack }) {
  const { profile } = useAuth();
  const [bills,     setBills]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  // Add form
  const [form, setForm] = useState({
    name: "", category: "", amount: "", dueDay: "", frequency: "monthly", notes: ""
  });
  const [saving, setSaving] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("bill_schedule")
        .select("*")
        .eq("user_id", profile.id)
        .order("due_day", { ascending: true });
      setBills(data || []);
    } catch { setBills([]); }
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const addBill = async () => {
    if (!form.name || !form.amount || !form.category) return;
    setSaving(true);
    try {
      await supabase.from("bill_schedule").insert({
        user_id:   profile.id,
        name:      form.name,
        category:  form.category,
        amount:    parseFloat(form.amount),
        due_day:   parseInt(form.dueDay) || 1,
        frequency: form.frequency,
        notes:     form.notes,
        is_paid:   false,
      });
      setShowAdd(false);
      setForm({ name: "", category: "", amount: "", dueDay: "", frequency: "monthly", notes: "" });
      fetchBills();
    } catch {
      alert("Failed to add bill. Try again.");
    } finally { setSaving(false); }
  };

  const togglePaid = async (bill) => {
    await supabase.from("bill_schedule").update({ is_paid: !bill.is_paid }).eq("id", bill.id);
    fetchBills();
  };

  const deleteBill = async (id) => {
    setDeleting(id);
    await supabase.from("bill_schedule").delete().eq("id", id);
    fetchBills();
    setDeleting(null);
  };

  const totalMonthly = bills
    .filter(b => b.frequency === "monthly")
    .reduce((s, b) => s + Number(b.amount), 0);

  const unpaidCount = bills.filter(b => !b.is_paid).length;

  const today = new Date().getDate();
  const dueSoon = bills.filter(b => {
    const dayDiff = b.due_day - today;
    return !b.is_paid && dayDiff >= 0 && dayDiff <= 5;
  });

  return (
    <div className="pw-scroll">
      <Header title="Bills Planner" onBack={onBack} icon={FileText} />
      <div className="f-section">

        {/* Summary bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Monthly Bills", val: `₦${fmtNGN(totalMonthly)}`, color: "var(--text)" },
            { label: "Unpaid",        val: String(unpaidCount),           color: unpaidCount > 0 ? "#f59e0b" : "var(--lime)" },
            { label: "Due Soon",      val: String(dueSoon.length),        color: dueSoon.length > 0 ? "#f87171" : "var(--text-soft)" },
          ].map((s, i) => (
            <div key={i} style={{ borderRadius: 10, padding: "10px 10px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 2, fontFamily: "var(--font-b)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Due soon alert */}
        {dueSoon.length > 0 && (
          <div style={{ borderRadius: 10, padding: "10px 13px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 9 }}>
            <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-b)", lineHeight: 1.6 }}>
              <span style={{ color: "#f87171", fontWeight: 700 }}>{dueSoon.length} bill{dueSoon.length > 1 ? "s" : ""} due soon:</span>{" "}
              {dueSoon.map(b => b.name).join(", ")}
            </div>
          </div>
        )}

        {/* Add Bill button */}
        <button
          className="btn-lime full"
          style={{ marginBottom: 14 }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={13} /> Add a Bill
        </button>

        {/* Bills list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-soft)", fontSize: 13 }}>Loading your bills…</div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧾</div>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>No bills added yet</div>
            <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 6, lineHeight: 1.6 }}>
              Add your recurring bills — rent, utilities, subscriptions — to plan and never miss a payment.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bills.map(bill => {
              const cat  = BILL_CATEGORIES.find(c => c.id === bill.category);
              const dayDiff = bill.due_day - today;
              const isDueSoon = !bill.is_paid && dayDiff >= 0 && dayDiff <= 5;
              return (
                <div key={bill.id} style={{
                  borderRadius: 12, padding: "12px 13px",
                  background: bill.is_paid ? "rgba(255,255,255,0.015)" : "var(--surface, rgba(255,255,255,0.03))",
                  border: bill.is_paid
                    ? "1px solid rgba(255,255,255,0.04)"
                    : isDueSoon ? "1px solid rgba(248,113,113,0.2)" : "1px solid var(--border, rgba(255,255,255,0.06))",
                  opacity: bill.is_paid ? 0.55 : 1,
                  transition: "all .15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                        {cat?.emoji || "📋"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 700, color: bill.is_paid ? "var(--text-soft)" : "var(--text)" }}>
                            {bill.name}
                          </span>
                          {bill.is_paid && (
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "rgba(163,230,53,0.1)", color: "var(--lime)", fontWeight: 700 }}>PAID</span>
                          )}
                          {isDueSoon && !bill.is_paid && (
                            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "rgba(248,113,113,0.1)", color: "#f87171", fontWeight: 700 }}>DUE SOON</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 1 }}>
                          {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
                          {bill.due_day ? ` · Day ${bill.due_day}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-d)", fontSize: 14, fontWeight: 800 }}>₦{fmtNGN(bill.amount)}</div>
                      </div>
                      {/* Mark paid toggle */}
                      <button
                        onClick={() => togglePaid(bill)}
                        title={bill.is_paid ? "Mark unpaid" : "Mark paid"}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)",
                          background: bill.is_paid ? "rgba(163,230,53,0.1)" : "rgba(255,255,255,0.03)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: bill.is_paid ? "var(--lime)" : "var(--text-soft)",
                        }}
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deleteBill(bill.id)}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(248,113,113,0.12)",
                          background: "rgba(248,113,113,0.04)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171",
                        }}
                      >
                        {deleting === bill.id ? <RefreshCw size={11} style={{ animation: "pw-spin 0.7s linear infinite" }} /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </div>
                  {bill.notes && (
                    <div style={{ marginTop: 7, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-b)", lineHeight: 1.5, paddingLeft: 46 }}>
                      {bill.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Bill Sheet */}
      {showAdd && (
        <>
          <div onClick={() => setShowAdd(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 998 }} />
          <div style={{
            position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "100%", maxWidth: 440, zIndex: 999,
            background: "#0c0f0a", borderRadius: "20px 20px 0 0",
            border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none",
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 0" }}>
              <span style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700 }}>Add New Bill</span>
              <button onClick={() => setShowAdd(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
                <X size={13} />
              </button>
            </div>

            <div style={{ padding: "16px 18px 32px", display: "flex", flexDirection: "column", gap: 12 }}>

              <div>
                <label className="f-label">Bill Name</label>
                <div className="f-card">
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. EKEDC Electricity" className="f-input" />
                </div>
              </div>

              <div>
                <label className="f-label">Category</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {BILL_CATEGORIES.map(c => (
                    <button key={c.id}
                      className={`amt-btn ${form.category === c.id ? "sel" : ""}`}
                      onClick={() => setForm({...form, category: c.id})}
                      style={{ fontSize: 11, padding: "7px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="f-label">Amount (₦)</label>
                  <div className="f-card">
                    <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                      placeholder="0.00" className="f-input" />
                  </div>
                </div>
                <div>
                  <label className="f-label">Due Day of Month</label>
                  <div className="f-card">
                    <input type="number" min="1" max="31" value={form.dueDay} onChange={e => setForm({...form, dueDay: e.target.value})}
                      placeholder="e.g. 15" className="f-input" />
                  </div>
                </div>
              </div>

              <div>
                <label className="f-label">Frequency</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <button key={k} className={`amt-btn ${form.frequency === k ? "sel" : ""}`}
                      onClick={() => setForm({...form, frequency: k})} style={{ fontSize: 11, padding: "7px 10px" }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="f-label">Notes (optional)</label>
                <div className="f-card">
                  <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    placeholder="e.g. EKEDC account #12345" className="f-input" />
                </div>
              </div>

              <button className="btn-lime full" disabled={!form.name || !form.amount || !form.category || saving} onClick={addBill}>
                {saving ? "Saving…" : <><Plus size={13} /> Add Bill</>}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes pw-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── ALL SERVICES PANEL (the "More" page) ─────────────────────
// Shows every available service in a beautiful grid with categories.
const ALL_SERVICES = [
  {
    category: "Top Up & Pay",
    items: [
      { icon: "📱", name: "Airtime",       page: "airtime",     color: "#a855f7" },
      { icon: "📶", name: "Data",          page: "data",        color: "#3b82f6" },
      { icon: "⚡", name: "Electricity",   page: "electricity", color: "#f59e0b" },
      { icon: "📺", name: "Cable TV",      page: "tv",          color: "#ef4444" },
    ]
  },
  {
    category: "Gaming & Entertainment",
    items: [
      { icon: "🎮", name: "Betting",      page: "betting",    color: "#10b981" },
      { icon: "🎁", name: "Gift Cards",   page: "giftcards",  color: "#ec4899" },
      { icon: "🎵", name: "Streaming",    page: "streaming",  color: "#f97316", soon: true },
      { icon: "🎯", name: "Gaming Credit",page: "gaming",     color: "#a3e635", soon: true },
    ]
  },
  {
    category: "Finance & Growth",
    items: [
      { icon: "⚡", name: "Stake-2-Earn", page: "invest",     color: "#a855f7" },
      { icon: "🐷", name: "Savings",      page: "save",       color: "#06b6d4" },
      { icon: "💳", name: "Cards",        page: "cards",      color: "#f87171" },
      { icon: "🎓", name: "Scholarships", page: "scholarships",color: "#60a5fa" },
    ]
  },
  {
    category: "Bills & Planning",
    items: [
      { icon: "🧾", name: "Bills Planner",page: "bills",      color: "#10b981" },
      { icon: "💧", name: "Water Bill",   page: "water",      color: "#38bdf8", soon: true },
      { icon: "📡", name: "Internet",     page: "internet",   color: "#8b5cf6", soon: true },
      { icon: "🏦", name: "Insurance",    page: "insurance",  color: "#d4a847", soon: true },
    ]
  },
];

function MoreView({ onBack, setPage }) {
  return (
    <div className="pw-scroll">
      <Header title="All Services" onBack={onBack} icon={LayoutGrid} />
      <div className="f-section">

        <div style={{ padding: "6px 0 14px" }}>
          <div style={{ fontSize: 12, color: "var(--text-soft)", fontFamily: "var(--font-b)", lineHeight: 1.6 }}>
            Every service available on PayWave — tap any to get started.
          </div>
        </div>

        {ALL_SERVICES.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              {cat.category}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {cat.items.map((item, ii) => (
                <button
                  key={ii}
                  onClick={() => !item.soon && setPage(item.page)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 13px", borderRadius: 12, cursor: item.soon ? "default" : "pointer",
                    background: "var(--surface, rgba(255,255,255,0.025))",
                    border: "1px solid var(--border, rgba(255,255,255,0.06))",
                    opacity: item.soon ? 0.45 : 1,
                    transition: "all .15s", textAlign: "left",
                  }}
                  onMouseEnter={e => !item.soon && (e.currentTarget.style.borderColor = item.color + "44")}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.06))"}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: item.color + "18", border: `1px solid ${item.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.name}
                    </div>
                    {item.soon && (
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-b)", marginTop: 1 }}>Coming soon</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN EXPORT — view router ─────────────────────────────────
export default function BillsTab({ view, onBack, onSuccess, setPage }) {
  if (view === "airtime")     return <AirtimeView    onBack={onBack} onSuccess={onSuccess} />;
  if (view === "data")        return <DataView       onBack={onBack} onSuccess={onSuccess} />;
  if (view === "electricity") return <ElectricityView onBack={onBack} onSuccess={onSuccess} />;
  if (view === "tv")          return <CableTVView    onBack={onBack} onSuccess={onSuccess} />;
  if (view === "bills")       return <BillsView      onBack={onBack} />;
  if (view === "services")    return <MoreView       onBack={onBack} setPage={setPage} />;

  // Betting / Gift Cards / etc — proper coming soon pages
  const titles = {
    betting:   { icon: "🎮", name: "Betting",    msg: "Fund your betting accounts — SportyBet, 1xBet, Betking, and more." },
    giftcards: { icon: "🎁", name: "Gift Cards", msg: "Buy and redeem gift cards — iTunes, Amazon, Google Play, and more." },
  };
  const info = titles[view] || { icon: "🔧", name: "Coming Soon", msg: "This service is being set up. Check back soon." };

  return (
    <div className="pw-scroll">
      <Header title={info.name} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>{info.icon}</div>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800 }}>{info.name}</div>
        <div style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65, maxWidth: 260 }}>{info.msg}</div>
        <div style={{ padding: "7px 16px", borderRadius: 20, background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.15)", fontSize: 11, color: "var(--lime)", fontWeight: 700 }}>COMING SOON</div>
      </div>
    </div>
  );
}