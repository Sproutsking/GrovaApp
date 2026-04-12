// paywave/tabs/BillsTab.jsx  ── v3 REFINED EDITION
// Pure UI redesign. No backend changes. No test data.
import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Smartphone, Wifi, Tv, Zap, Gift, LayoutGrid,
  ChevronDown, CheckCircle2, Plus, Trash2,
  RefreshCw, AlertCircle, X, FileText,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Network SVG Logos ─────────────────────────────────────────
const NETWORK_LOGOS = {
  MTN: (<svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}><rect width="120" height="40" fill="#FFCB05" rx="6"/><text x="60" y="28" textAnchor="middle" fill="#000" fontSize="18" fontWeight="900" fontFamily="Arial Black,sans-serif">MTN</text></svg>),
  GLO: (<svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}><rect width="120" height="40" fill="#43B02A" rx="6"/><text x="60" y="28" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Arial Black,sans-serif">GLO</text></svg>),
  Airtel: (<svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}><rect width="120" height="40" fill="#ED1C24" rx="6"/><text x="60" y="28" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900" fontFamily="Arial Black,sans-serif">AIRTEL</text></svg>),
  "9mobile": (<svg viewBox="0 0 120 40" style={{ width: "100%", height: "100%" }}><rect width="120" height="40" fill="#006633" rx="6"/><text x="60" y="28" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="900" fontFamily="Arial Black,sans-serif">9mobile</text></svg>),
};

const NETWORKS = [
  { id: "mtn",     name: "MTN",     logo: "MTN"      },
  { id: "glo",     name: "GLO",     logo: "GLO"      },
  { id: "airtel",  name: "Airtel",  logo: "Airtel"   },
  { id: "9mobile", name: "9mobile", logo: "9mobile"  },
];

// ── Shared Header ─────────────────────────────────────────────
function Header({ title, onBack, icon: Icon }) {
  return (
    <div className="pw-hdr">
      <button className="pw-back-btn" onClick={onBack}><ArrowLeft size={12} /></button>
      {Icon && <Icon size={14} color="var(--lime)" />}
      <span className="pw-hdr-title">{title}</span>
    </div>
  );
}

// ── Network Dropdown ──────────────────────────────────────────
function NetworkDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = NETWORKS.find(n => n.id === value) || null;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 9,
        background: "var(--s1)",
        border: open ? "1px solid var(--lime-ring)" : "1px solid var(--b1)",
        borderRadius: "var(--r2)", padding: "8px 11px",
        cursor: "pointer", color: "var(--t1)",
        transition: "border-color .14s", boxSizing: "border-box",
      }}>
        {sel ? (
          <>
            <div style={{ width: 48, height: 20, flexShrink: 0, borderRadius: 4, overflow: "hidden" }}>
              {NETWORK_LOGOS[sel.logo]}
            </div>
            <span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 13 }}>{sel.name}</span>
          </>
        ) : (
          <span style={{ color: "var(--t4)", fontSize: 12.5, fontFamily: "var(--fb)" }}>Select Network</span>
        )}
        <ChevronDown size={12} style={{
          marginLeft: "auto", color: "var(--t2)",
          transition: "transform .18s", transform: open ? "rotate(180deg)" : "none",
        }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0,
          background: "#0e1209", border: "1px solid rgba(163,230,53,0.16)",
          borderRadius: 11, zIndex: 50, overflow: "hidden",
          boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
        }}>
          {NETWORKS.map(n => (
            <button key={n.id} onClick={() => { onChange(n.id); setOpen(false); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 11,
              padding: "9px 13px",
              background: n.id === value ? "rgba(163,230,53,0.055)" : "transparent",
              border: "none", borderBottom: "1px solid rgba(255,255,255,0.035)",
              cursor: "pointer", transition: "background .11s",
            }}>
              <div style={{ width: 55, height: 22, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                {NETWORK_LOGOS[n.logo]}
              </div>
              <span style={{ fontFamily: "var(--fd)", fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{n.name}</span>
              {n.id === value && <CheckCircle2 size={12} color="var(--lime)" style={{ marginLeft: "auto" }} />}
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
  const [network, setNetwork] = useState("");
  const [phone,   setPhone]   = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const QUICK = [100, 200, 500, 1000, 2000];
  const parsed = parseFloat(amount) || 0;
  const canBuy = network && phone.replace(/\D/g, "").length >= 10 && parsed >= 50;

  const handleBuy = async () => {
    if (!canBuy) return;
    setLoading(true);
    try {
      await supabase.from("bill_payments").insert({
        user_id:   profile.id,
        bill_type: "airtime",
        provider:  network,
        recipient: phone,
        amount:    parsed,
        status:    "success",
        meta:      { network, phone },
      });
      onSuccess(`₦${fmtNGN(parsed)} airtime sent to ${phone} (${network.toUpperCase()})`);
    } catch { alert("Airtime purchase failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Buy Airtime" onBack={onBack} icon={Smartphone} />
      <div className="xf-section xf-stack">
        <div style={{
          borderRadius: 9, padding: "8px 11px",
          background: "rgba(163,230,53,0.055)", border: "1px solid rgba(163,230,53,0.13)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>💰</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", fontFamily: "var(--fb)" }}>
            Cashback <span style={{ color: "var(--lime)", fontWeight: 700 }}>₦1–₦30</span> on every purchase
          </span>
        </div>
        <div>
          <label className="xf-lbl">Network</label>
          <NetworkDropdown value={network} onChange={setNetwork} />
        </div>
        <div>
          <label className="xf-lbl">Phone Number</label>
          <div className="xf-wrap">
            <input type="tel" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="08012345678" className="xf-in"
              style={{ fontFamily: "var(--fm)", letterSpacing: "0.04em" }} />
          </div>
          <button style={{
            marginTop: 4, background: "none", border: "none",
            cursor: "pointer", color: "var(--lime)", fontSize: "10.5px",
            fontFamily: "var(--fb)", padding: 0,
          }} onClick={() => setPhone(profile?.phone || "")}>Use my number</button>
        </div>
        <div>
          <label className="xf-lbl">Amount (₦)</label>
          <div className="xf-wrap" style={{ padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--t2)", fontSize: 18 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" className="xf-in-lg" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {QUICK.map(a => (
            <button key={a} className={`amt-btn ${amount === String(a) ? "sel" : ""}`}
              onClick={() => setAmount(String(a))}
              style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>
        <button className="btn-p full" disabled={!canBuy || loading} onClick={handleBuy}>
          {loading ? "Processing…" : <><Smartphone size={12} /> Buy Airtime</>}
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
    { id: "glo-1g",  label: "1GB",  validity: "1 Day",   price: 200  },
    { id: "glo-3g",  label: "3GB",  validity: "7 Days",  price: 500  },
    { id: "glo-5g",  label: "5GB",  validity: "30 Days", price: 1500 },
    { id: "glo-10g", label: "10GB", validity: "30 Days", price: 2500 },
    { id: "glo-25g", label: "25GB", validity: "30 Days", price: 5000 },
    { id: "glo-50g", label: "50GB", validity: "30 Days", price: 9000 },
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
  const canBuy = network && phone.replace(/\D/g, "").length >= 10 && selPlan;

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
    } catch { alert("Data purchase failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Buy Data" onBack={onBack} icon={Wifi} />
      <div className="xf-section xf-stack">
        <div style={{
          borderRadius: 9, padding: "8px 11px",
          background: "rgba(163,230,53,0.055)", border: "1px solid rgba(163,230,53,0.13)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>💰</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", fontFamily: "var(--fb)" }}>
            Earn up to <span style={{ color: "var(--lime)", fontWeight: 700 }}>₦30</span> cashback on data purchases
          </span>
        </div>
        <div>
          <label className="xf-lbl">Network</label>
          <NetworkDropdown value={network} onChange={n => { setNetwork(n); setSelPlan(null); }} />
        </div>
        <div>
          <label className="xf-lbl">Phone Number</label>
          <div className="xf-wrap">
            <input type="tel" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="08012345678" className="xf-in"
              style={{ fontFamily: "var(--fm)", letterSpacing: "0.04em" }} />
          </div>
          <button style={{
            marginTop: 4, background: "none", border: "none",
            cursor: "pointer", color: "var(--lime)", fontSize: "10.5px",
            fontFamily: "var(--fb)", padding: 0,
          }} onClick={() => setPhone(profile?.phone || "")}>Use my number</button>
        </div>
        {network && (
          <div>
            <label className="xf-lbl">Data Plans</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {plans.map(plan => (
                <button key={plan.id} onClick={() => setSelPlan(plan)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  background: selPlan?.id === plan.id ? "rgba(163,230,53,0.065)" : "var(--s1)",
                  border: selPlan?.id === plan.id ? "1px solid rgba(163,230,53,0.26)" : "1px solid var(--b1)",
                  transition: "all .13s", boxSizing: "border-box",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: selPlan?.id === plan.id ? "rgba(163,230,53,0.1)" : "rgba(255,255,255,0.035)",
                      border: "1px solid rgba(255,255,255,0.055)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontFamily: "var(--fd)", fontSize: 10, fontWeight: 800,
                        color: selPlan?.id === plan.id ? "var(--lime)" : "var(--t2)",
                      }}>{plan.label}</span>
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--fd)", fontSize: 12.5, fontWeight: 700, color: "var(--t1)" }}>{plan.label}</div>
                      <div style={{ fontSize: 10.5, color: "var(--t2)" }}>{plan.validity}</div>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "var(--fd)", fontWeight: 800, fontSize: 13,
                    color: selPlan?.id === plan.id ? "var(--lime)" : "var(--t1)",
                  }}>₦{plan.price.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="btn-p full" disabled={!canBuy || loading} onClick={handleBuy}>
          {loading ? "Processing…" : selPlan ? `Buy ${selPlan.label} — ₦${selPlan.price.toLocaleString()}` : "Select a Plan"}
        </button>
      </div>
    </div>
  );
}

// ── ELECTRICITY VIEW ──────────────────────────────────────────
const DISCO_PROVIDERS = [
  { id: "ekedc",  name: "EKEDC (Eko)",    area: "Lagos Island, Lekki, V/I"   },
  { id: "ikedc",  name: "IKEDC (Ikeja)",  area: "Ikeja, Agege, Ikorodu"      },
  { id: "aedc",   name: "AEDC (Abuja)",   area: "Abuja, Nasarawa, Niger"     },
  { id: "enugu",  name: "EEDC (Enugu)",   area: "Enugu, Ebonyi, Abia"        },
  { id: "phedc",  name: "PHEDC (PH)",     area: "Port Harcourt, Rivers"      },
  { id: "ibadan", name: "IBEDC (Ibadan)", area: "Oyo, Ogun, Ondo, Osun"      },
  { id: "kano",   name: "KEDCO (Kano)",   area: "Kano, Katsina, Jigawa"      },
];

function ElectricityView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [provider,  setProvider]  = useState("");
  const [meterNum,  setMeterNum]  = useState("");
  const [meterType, setMeterType] = useState("prepaid");
  const [amount,    setAmount]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const parsed = parseFloat(amount) || 0;
  const canPay = provider && meterNum.length >= 11 && parsed >= 500;

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
    } catch { alert("Payment failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Electricity" onBack={onBack} icon={Zap} />
      <div className="xf-section xf-stack">
        <div>
          <label className="xf-lbl">Distribution Company</label>
          <select value={provider} onChange={e => setProvider(e.target.value)} className="bank-sel">
            <option value="">— Select your DISCO —</option>
            {DISCO_PROVIDERS.map(d => (
              <option key={d.id} value={d.id}>{d.name} · {d.area}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="xf-lbl">Meter Type</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {["prepaid", "postpaid"].map(t => (
              <button key={t} className={`amt-btn ${meterType === t ? "sel" : ""}`}
                onClick={() => setMeterType(t)} style={{ textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="xf-lbl">Meter Number</label>
          <div className="xf-wrap">
            <input type="text" value={meterNum}
              onChange={e => setMeterNum(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="Enter meter number" className="xf-in"
              style={{ fontFamily: "var(--fm)", letterSpacing: "0.04em" }} />
          </div>
        </div>
        <div>
          <label className="xf-lbl">Amount (₦) — Min ₦500</label>
          <div className="xf-wrap" style={{ padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--t2)", fontSize: 18 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="xf-in-lg" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {[500, 1000, 2000, 5000].map(a => (
            <button key={a} className={`amt-btn ${amount === String(a) ? "sel" : ""}`}
              onClick={() => setAmount(String(a))} style={{ flex: 1, fontSize: 11 }}>
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>
        <button className="btn-p full" disabled={!canPay || loading} onClick={handlePay}>
          {loading ? "Processing…" : <><Zap size={12} /> Pay ₦{parsed > 0 ? fmtNGN(parsed) : ""}</>}
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
      { id: "dstv-padi",    name: "Padi",         price: 2950  },
      { id: "dstv-yanga",   name: "Yanga",        price: 3990  },
      { id: "dstv-confam",  name: "Confam",       price: 6200  },
      { id: "dstv-compact", name: "Compact",      price: 10500 },
      { id: "dstv-complus", name: "Compact Plus", price: 16600 },
      { id: "dstv-premium", name: "Premium",      price: 24500 },
    ],
  },
  {
    id: "gotv", name: "GOtv",
    plans: [
      { id: "gotv-lite",  name: "Lite",  price: 410  },
      { id: "gotv-jinja", name: "Jinja", price: 1640 },
      { id: "gotv-jolli", name: "Jolli", price: 2460 },
      { id: "gotv-max",   name: "Max",   price: 4150 },
      { id: "gotv-supa",  name: "Supa",  price: 6400 },
    ],
  },
  {
    id: "startimes", name: "StarTimes",
    plans: [
      { id: "st-nova",    name: "Nova",    price: 1200 },
      { id: "st-basic",   name: "Basic",   price: 2000 },
      { id: "st-smart",   name: "Smart",   price: 3800 },
      { id: "st-classic", name: "Classic", price: 5000 },
    ],
  },
];

function CableTVView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [provider,  setProvider]  = useState(null);
  const [selPlan,   setSelPlan]   = useState(null);
  const [smartCard, setSmartCard] = useState("");
  const [loading,   setLoading]   = useState(false);
  const prov   = TV_PROVIDERS.find(p => p.id === provider);
  const canPay = provider && selPlan && smartCard.replace(/\D/g, "").length >= 10;

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
    } catch { alert("Payment failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Cable TV" onBack={onBack} icon={Tv} />
      <div className="xf-section xf-stack">
        <div>
          <label className="xf-lbl">Provider</label>
          <div style={{ display: "flex", gap: 6 }}>
            {TV_PROVIDERS.map(p => (
              <button key={p.id} className={`amt-btn ${provider === p.id ? "sel" : ""}`}
                onClick={() => { setProvider(p.id); setSelPlan(null); }}
                style={{ flex: 1, fontSize: 12, padding: "8px 5px" }}>{p.name}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="xf-lbl">Smart Card / IUC Number</label>
          <div className="xf-wrap">
            <input type="text" value={smartCard}
              onChange={e => setSmartCard(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="Enter smart card number" className="xf-in"
              style={{ fontFamily: "var(--fm)", letterSpacing: "0.04em" }} />
          </div>
        </div>
        {prov && (
          <div>
            <label className="xf-lbl">{prov.name} Plans</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {prov.plans.map(plan => (
                <button key={plan.id} onClick={() => setSelPlan(plan)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                  background: selPlan?.id === plan.id ? "rgba(163,230,53,0.065)" : "var(--s1)",
                  border: selPlan?.id === plan.id ? "1px solid rgba(163,230,53,0.26)" : "1px solid var(--b1)",
                  transition: "all .13s", boxSizing: "border-box",
                }}>
                  <span style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 12.5, color: "var(--t1)" }}>
                    {plan.name}
                  </span>
                  <span style={{
                    fontFamily: "var(--fd)", fontWeight: 800, fontSize: 13,
                    color: selPlan?.id === plan.id ? "var(--lime)" : "var(--t1)",
                  }}>₦{plan.price.toLocaleString()}/mo</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="btn-p full" disabled={!canPay || loading} onClick={handlePay}>
          {loading ? "Processing…" : selPlan ? `Pay ₦${selPlan.price.toLocaleString()} — ${prov?.name} ${selPlan.name}` : "Select a Plan"}
        </button>
      </div>
    </div>
  );
}

// ── BILLS PLANNER ─────────────────────────────────────────────
const BILL_CATEGORIES = [
  { id: "rent",        name: "Rent",            emoji: "🏠" },
  { id: "electricity", name: "Electricity",     emoji: "⚡" },
  { id: "water",       name: "Water",           emoji: "💧" },
  { id: "internet",    name: "Internet",        emoji: "📡" },
  { id: "cable",       name: "Cable TV",        emoji: "📺" },
  { id: "phone",       name: "Phone / Airtime", emoji: "📱" },
  { id: "insurance",   name: "Insurance",       emoji: "🛡️" },
  { id: "loan",        name: "Loan Payment",    emoji: "🏦" },
  { id: "school",      name: "School Fees",     emoji: "📚" },
  { id: "other",       name: "Other",           emoji: "📋" },
];

const FREQUENCY_LABELS = {
  once:      "One-time",
  weekly:    "Weekly",
  monthly:   "Monthly",
  quarterly: "Quarterly",
  yearly:    "Yearly",
};

function BillsView({ onBack }) {
  const { profile } = useAuth();
  const [bills,    setBills]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", amount: "", dueDay: "", frequency: "monthly", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("bill_schedule").select("*")
        .eq("user_id", profile.id).order("due_day", { ascending: true });
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
    } catch { alert("Failed to add bill. Try again."); }
    finally { setSaving(false); }
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

  const totalMonthly = bills.filter(b => b.frequency === "monthly").reduce((s, b) => s + Number(b.amount), 0);
  const unpaidCount  = bills.filter(b => !b.is_paid).length;
  const today        = new Date().getDate();
  const dueSoon      = bills.filter(b => { const d = b.due_day - today; return !b.is_paid && d >= 0 && d <= 5; });

  return (
    <div className="pw-scroll">
      <Header title="Bills Planner" onBack={onBack} icon={FileText} />
      <div className="xf-section">
        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[
            { label: "Monthly",  val: `₦${fmtNGN(totalMonthly)}`, color: "var(--t1)"   },
            { label: "Unpaid",   val: String(unpaidCount),          color: unpaidCount > 0 ? "#f59e0b" : "var(--lime)" },
            { label: "Due Soon", val: String(dueSoon.length),       color: dueSoon.length > 0 ? "#f87171" : "var(--t2)" },
          ].map((s, i) => (
            <div key={i} style={{
              borderRadius: 9, padding: "9px 8px",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.055)",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--fd)", fontSize: 14, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: "9.5px", color: "var(--t2)", marginTop: 2, fontFamily: "var(--fb)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {dueSoon.length > 0 && (
          <div style={{
            borderRadius: 9, padding: "9px 11px",
            background: "rgba(248,113,113,0.045)", border: "1px solid rgba(248,113,113,0.13)",
            marginBottom: 11, display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <AlertCircle size={12} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "var(--fb)", lineHeight: 1.6 }}>
              <span style={{ color: "#f87171", fontWeight: 700 }}>
                {dueSoon.length} bill{dueSoon.length > 1 ? "s" : ""} due soon:{" "}
              </span>
              {dueSoon.map(b => b.name).join(", ")}
            </div>
          </div>
        )}

        <button className="btn-p full" style={{ marginBottom: 11 }} onClick={() => setShowAdd(true)}>
          <Plus size={12} /> Add a Bill
        </button>

        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--t2)", fontSize: 12 }}>
            Loading your bills…
          </div>
        )}

        {!loading && bills.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🧾</div>
            <div style={{ fontFamily: "var(--fd)", fontSize: 13.5, fontWeight: 700 }}>No bills added yet</div>
            <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 5, lineHeight: 1.6 }}>
              Track rent, utilities, subscriptions — never miss a payment.
            </div>
          </div>
        )}

        {!loading && bills.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {bills.map(bill => {
              const cat     = BILL_CATEGORIES.find(c => c.id === bill.category);
              const dayDiff = bill.due_day - today;
              const isDue   = !bill.is_paid && dayDiff >= 0 && dayDiff <= 5;
              return (
                <div key={bill.id} style={{
                  borderRadius: 11, padding: "10px 11px",
                  background:  bill.is_paid ? "rgba(255,255,255,0.012)" : "var(--s1)",
                  border:      bill.is_paid ? "1px solid rgba(255,255,255,0.035)" : isDue ? "1px solid rgba(248,113,113,0.18)" : "1px solid var(--b1)",
                  opacity:     bill.is_paid ? 0.5 : 1,
                  transition:  "all .14s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.055)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                      }}>{cat?.emoji || "📋"}</div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontFamily: "var(--fd)", fontSize: 12.5, fontWeight: 700, color: bill.is_paid ? "var(--t2)" : "var(--t1)" }}>
                            {bill.name}
                          </span>
                          {bill.is_paid && (
                            <span style={{ fontSize: "8.5px", padding: "1.5px 5px", borderRadius: 20, background: "rgba(163,230,53,0.09)", color: "var(--lime)", fontWeight: 700 }}>PAID</span>
                          )}
                          {isDue && !bill.is_paid && (
                            <span style={{ fontSize: "8.5px", padding: "1.5px 5px", borderRadius: 20, background: "rgba(248,113,113,0.09)", color: "#f87171", fontWeight: 700 }}>DUE SOON</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--t2)", marginTop: 1 }}>
                          {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
                          {bill.due_day ? ` · Day ${bill.due_day}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: "var(--fd)", fontSize: 13, fontWeight: 800 }}>₦{fmtNGN(bill.amount)}</div>
                      <button onClick={() => togglePaid(bill)} title={bill.is_paid ? "Mark unpaid" : "Mark paid"} style={{
                        width: 26, height: 26, borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: bill.is_paid ? "rgba(163,230,53,0.09)" : "rgba(255,255,255,0.025)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        color: bill.is_paid ? "var(--lime)" : "var(--t2)",
                      }}>
                        <CheckCircle2 size={12} />
                      </button>
                      <button onClick={() => deleteBill(bill.id)} style={{
                        width: 26, height: 26, borderRadius: 6,
                        border: "1px solid rgba(248,113,113,0.12)",
                        background: "rgba(248,113,113,0.04)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171",
                      }}>
                        {deleting === bill.id
                          ? <RefreshCw size={10} style={{ animation: "pw-spin 0.7s linear infinite" }} />
                          : <Trash2 size={10} />}
                      </button>
                    </div>
                  </div>
                  {bill.notes && (
                    <div style={{ marginTop: 6, fontSize: 10.5, color: "rgba(255,255,255,0.24)", fontFamily: "var(--fb)", lineHeight: 1.5, paddingLeft: 40 }}>
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
          <div onClick={() => setShowAdd(false)} style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", zIndex: 998,
          }} />
          <div style={{
            position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "100%", maxWidth: 440, zIndex: 999,
            background: "#0b0e0c", borderRadius: "18px 18px 0 0",
            border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none",
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 -16px 50px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 32, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 0" }}>
              <span style={{ fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700 }}>Add New Bill</span>
              <button onClick={() => setShowAdd(false)} style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 7, width: 25, height: 25, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.38)",
              }}>
                <X size={11} />
              </button>
            </div>
            <div style={{ padding: "14px 16px 28px", display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label className="xf-lbl">Bill Name</label>
                <div className="xf-wrap">
                  <input type="text" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. EKEDC Electricity" className="xf-in" />
                </div>
              </div>
              <div>
                <label className="xf-lbl">Category</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {BILL_CATEGORIES.map(c => (
                    <button key={c.id}
                      className={`amt-btn ${form.category === c.id ? "sel" : ""}`}
                      onClick={() => setForm({ ...form, category: c.id })}
                      style={{ fontSize: 10.5, padding: "6px 9px", display: "flex", alignItems: "center", gap: 4 }}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div>
                  <label className="xf-lbl">Amount (₦)</label>
                  <div className="xf-wrap">
                    <input type="number" value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00" className="xf-in" />
                  </div>
                </div>
                <div>
                  <label className="xf-lbl">Due Day</label>
                  <div className="xf-wrap">
                    <input type="number" min="1" max="31" value={form.dueDay}
                      onChange={e => setForm({ ...form, dueDay: e.target.value })}
                      placeholder="e.g. 15" className="xf-in" />
                  </div>
                </div>
              </div>
              <div>
                <label className="xf-lbl">Frequency</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <button key={k} className={`amt-btn ${form.frequency === k ? "sel" : ""}`}
                      onClick={() => setForm({ ...form, frequency: k })}
                      style={{ fontSize: 10.5, padding: "6px 9px" }}>{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="xf-lbl">Notes (optional)</label>
                <div className="xf-wrap">
                  <input type="text" value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. EKEDC account #12345" className="xf-in" />
                </div>
              </div>
              <button className="btn-p full"
                disabled={!form.name || !form.amount || !form.category || saving}
                onClick={addBill}>
                {saving ? "Saving…" : <><Plus size={12} /> Add Bill</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── ALL SERVICES PANEL ────────────────────────────────────────
const ALL_SERVICES = [
  {
    category: "Top Up & Pay",
    items: [
      { icon: "📱", name: "Airtime",       page: "airtime",     color: "#a855f7" },
      { icon: "📶", name: "Data",          page: "data",        color: "#3b82f6" },
      { icon: "⚡", name: "Electricity",   page: "electricity", color: "#f59e0b" },
      { icon: "📺", name: "Cable TV",      page: "tv",          color: "#ef4444" },
    ],
  },
  {
    category: "Gaming & Entertainment",
    items: [
      { icon: "🎮", name: "Betting",       page: "betting",     color: "#10b981" },
      { icon: "🎁", name: "Gift Cards",    page: "giftcards",   color: "#ec4899" },
      { icon: "🎵", name: "Streaming",     page: "streaming",   color: "#f97316", soon: true },
      { icon: "🎯", name: "Gaming Credit", page: "gaming",      color: "#a3e635", soon: true },
    ],
  },
  {
    category: "Finance & Growth",
    items: [
      { icon: "⚡", name: "Stake-2-Earn",  page: "invest",       color: "#a855f7" },
      { icon: "🐷", name: "Savings",       page: "save",         color: "#06b6d4" },
      { icon: "💳", name: "Cards",         page: "cards",        color: "#f87171" },
      { icon: "🎓", name: "Scholarships",  page: "scholarships", color: "#60a5fa" },
    ],
  },
  {
    category: "Bills & Planning",
    items: [
      { icon: "🧾", name: "Bills Planner", page: "bills",      color: "#10b981" },
      { icon: "💧", name: "Water Bill",    page: "water",      color: "#38bdf8", soon: true },
      { icon: "📡", name: "Internet",      page: "internet",   color: "#8b5cf6", soon: true },
      { icon: "🏦", name: "Insurance",     page: "insurance",  color: "#d4a847", soon: true },
    ],
  },
];

function MoreView({ onBack, setPage }) {
  return (
    <div className="pw-scroll">
      <Header title="All Services" onBack={onBack} icon={LayoutGrid} />
      <div className="xf-section">
        <div style={{ fontSize: 11.5, color: "var(--t2)", fontFamily: "var(--fb)", lineHeight: 1.6, marginBottom: 14 }}>
          Every service on PayWave — tap any to get started.
        </div>
        {ALL_SERVICES.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: "var(--fd)", fontSize: "9.5px", fontWeight: 700,
              color: "rgba(255,255,255,0.2)", textTransform: "uppercase",
              letterSpacing: "0.07em", marginBottom: 9,
            }}>{cat.category}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {cat.items.map((item, ii) => (
                <button key={ii} onClick={() => !item.soon && setPage(item.page)} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "10px 11px", borderRadius: 11,
                  cursor: item.soon ? "default" : "pointer",
                  background: "var(--s1)", border: "1px solid var(--b1)",
                  opacity: item.soon ? 0.42 : 1,
                  transition: "all .13s", textAlign: "left", boxSizing: "border-box",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: `${item.color}16`, border: `1px solid ${item.color}28`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  }}>{item.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--fd)", fontSize: 12.5, fontWeight: 700, color: "var(--t1)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{item.name}</div>
                    {item.soon && (
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.24)", fontFamily: "var(--fb)", marginTop: 1 }}>
                        Coming soon
                      </div>
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

// ── MAIN EXPORT ───────────────────────────────────────────────
export default function BillsTab({ view, onBack, onSuccess, setPage }) {
  if (view === "airtime")     return <AirtimeView     onBack={onBack} onSuccess={onSuccess} />;
  if (view === "data")        return <DataView        onBack={onBack} onSuccess={onSuccess} />;
  if (view === "electricity") return <ElectricityView onBack={onBack} onSuccess={onSuccess} />;
  if (view === "tv")          return <CableTVView     onBack={onBack} onSuccess={onSuccess} />;
  if (view === "bills")       return <BillsView       onBack={onBack} />;
  if (view === "services")    return <MoreView        onBack={onBack} setPage={setPage} />;

  // Betting / Gift Cards — coming soon stubs
  const titles = {
    betting:   { icon: "🎮", name: "Betting",    msg: "Fund SportyBet, 1xBet, Betking, and more." },
    giftcards: { icon: "🎁", name: "Gift Cards", msg: "Buy iTunes, Amazon, Google Play cards and more." },
  };
  const info = titles[view] || { icon: "🔧", name: "Coming Soon", msg: "This service is being set up. Check back soon." };

  return (
    <div className="pw-scroll">
      <Header title={info.name} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>{info.icon}</div>
        <div style={{ fontFamily: "var(--fd)", fontSize: 16, fontWeight: 800 }}>{info.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65, maxWidth: 260 }}>{info.msg}</div>
        <div style={{
          padding: "5px 14px", borderRadius: 20,
          background: "rgba(163,230,53,0.07)", border: "1px solid rgba(163,230,53,0.14)",
          fontSize: 10.5, color: "var(--lime)", fontWeight: 700,
        }}>COMING SOON</div>
      </div>
    </div>
  );
}