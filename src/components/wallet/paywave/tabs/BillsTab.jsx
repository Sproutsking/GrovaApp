// paywave/tabs/BillsTab.jsx
// Houses all purchase/service forms — Airtime, Data, TV, Electricity,
// Betting, Gift Cards, Bills, Loans. Rendered via internal `view` state.

import React, { useState } from "react";
import { Smartphone, Wifi, Tv, Zap, Building2, Gift, CreditCard, DollarSign } from "lucide-react";
import { Header, PlanIcon } from "../components/UI";
import { PinModal } from "../modals/index";
import { NETWORKS, DATA_PLANS, TV_PROVS, TV_PLANS, ELEC_PROVS, BET_PROVS, GIFT_CARDS, BILL_TYPES, LOAN_PLANS } from "../constants";

// ── Reusable small pieces ─────────────────────────────────
const NetGrid = ({ selected, onSelect }) => (
  <div className="net-grid">
    {NETWORKS.map(n => (
      <button key={n.id} className={`net-btn ${n.cls} ${selected === n.id ? "sel" : ""}`} onClick={() => onSelect(n.id)}>{n.name}</button>
    ))}
  </div>
);

const ProvGrid = ({ provs, selected, onSelect }) => (
  <div className="prov-grid">
    {provs.map(p => (
      <button key={p.id} className={`prov-btn ${p.cls} ${selected === p.id ? "sel" : ""}`} onClick={() => onSelect(p.id)}>{p.name}</button>
    ))}
  </div>
);

const AmtChips = ({ values, selected, onSelect }) => (
  <div className={`amt-grid${values.length === 6 ? "-6" : ""} amt-grid`} style={{ marginBottom: 8 }}>
    {values.map(a => (
      <button key={a} className={`amt-btn ${selected === a ? "sel" : ""}`} onClick={() => onSelect(a)}>₦{a.toLocaleString()}</button>
    ))}
  </div>
);

const FieldInput = ({ label, value, onChange, type = "text", placeholder }) => (
  <div>
    <label className="f-label">{label}</label>
    <div className="f-card"><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="f-input" /></div>
  </div>
);

// ── Individual forms ──────────────────────────────────────
function AirtimeForm({ onBack, onSuccess }) {
  const [network, setNetwork] = useState(null);
  const [phone, setPhone] = useState("");
  const [selAmt, setSelAmt] = useState(null);
  const [custAmt, setCustAmt] = useState("");
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Airtime purchased!\nNetwork: ${NETWORKS.find(n => n.id === network)?.name}\nAmount: ₦${(selAmt || custAmt).toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Buy Airtime" onBack={onBack} />
      <div className="f-section f-stack">
        <div><label className="f-label">Network</label><NetGrid selected={network} onSelect={setNetwork} /></div>
        <FieldInput label="Phone Number" value={phone} onChange={setPhone} type="tel" placeholder="08012345678" />
        <div>
          <label className="f-label">Amount</label>
          <AmtChips values={[50, 100, 200, 500, 1000, 2000]} selected={selAmt} onSelect={v => { setSelAmt(v); setCustAmt(""); }} />
          <div className="f-card"><input type="number" value={custAmt} onChange={e => { setCustAmt(e.target.value); setSelAmt(null); }} placeholder="Custom amount" className="f-input" /></div>
        </div>
        <button className="btn-lime full" disabled={!network || !phone || (!selAmt && !custAmt)} onClick={() => setPin(true)}>Purchase Airtime</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function DataForm({ onBack, onSuccess }) {
  const [network, setNetwork] = useState(null);
  const [phone, setPhone] = useState("");
  const [selPlan, setSelPlan] = useState(null);
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    const pl = DATA_PLANS.find(d => d.id === selPlan);
    onSuccess(`Data purchased!\n${pl.size} • ${pl.dur}\n₦${pl.price.toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Buy Data" onBack={onBack} />
      <div className="f-section f-stack">
        {/* Lime cashback banner */}
        <div className="info-lime" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--lime)", fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 12 }}>Cashback 💰</span>
          <span style={{ color: "var(--text)", fontSize: 12 }}>Earn up to ₦30 on data purchases</span>
        </div>
        <div><label className="f-label">Network</label><NetGrid selected={network} onSelect={setNetwork} /></div>
        <FieldInput label="Phone Number" value={phone} onChange={setPhone} type="tel" placeholder="08012345678" />
        <div>
          <label className="f-label">Data Plans</label>
          <div className="space-y">
            {DATA_PLANS.map(plan => (
              <button key={plan.id} className={`plan-btn ${selPlan === plan.id ? "sel" : ""}`} onClick={() => setSelPlan(plan.id)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 15 }}>{plan.size}</div>
                    <div style={{ fontSize: 12, color: selPlan === plan.id ? "rgba(163,230,53,0.7)" : "var(--text-soft)" }}>{plan.dur}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700 }}>₦{plan.price.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: selPlan === plan.id ? "rgba(163,230,53,0.7)" : "var(--lime)" }}>+₦{plan.back} back</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-lime full" disabled={!network || !phone || !selPlan} onClick={() => setPin(true)}>Purchase Data</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function TVForm({ onBack, onSuccess }) {
  const [prov, setProv] = useState(null);
  const [card, setCard] = useState("");
  const [selPlan, setSelPlan] = useState(null);
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    const pl = TV_PLANS.find(t => t.id === selPlan);
    onSuccess(`Cable TV subscribed!\n${TV_PROVS.find(t => t.id === prov)?.name} • ${pl.name}\n₦${pl.price.toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Cable TV" onBack={onBack} />
      <div className="f-section f-stack">
        <div><label className="f-label">Provider</label><ProvGrid provs={TV_PROVS} selected={prov} onSelect={setProv} /></div>
        <FieldInput label="Smart Card Number" value={card} onChange={setCard} placeholder="Enter smart card number" />
        <div>
          <label className="f-label">Plans</label>
          <div className="space-y">
            {TV_PLANS.map(pl => (
              <button key={pl.id} className={`plan-btn ${selPlan === pl.id ? "sel" : ""}`} onClick={() => setSelPlan(pl.id)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>{pl.name}</div>
                  <div style={{ fontFamily: "var(--font-d)", fontWeight: 700 }}>₦{pl.price.toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-lime full" disabled={!prov || !card || !selPlan} onClick={() => setPin(true)}>Subscribe</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function ElectricityForm({ onBack, onSuccess }) {
  const [prov, setProv] = useState(null);
  const [meter, setMeter] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState(false);
  const [token, setToken] = useState("");

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    const tok = "1234-5678-9012-3456";
    setToken(tok);
    onSuccess(`Electricity purchased!\n${ELEC_PROVS.find(e => e.id === prov)?.name}\nAmount: ₦${parseFloat(amount).toLocaleString()}\nToken: ${tok}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Electricity" onBack={onBack} />
      <div className="f-section f-stack">
        <div><label className="f-label">Provider</label><ProvGrid provs={ELEC_PROVS} selected={prov} onSelect={setProv} /></div>
        <FieldInput label="Meter Number" value={meter} onChange={setMeter} placeholder="Enter meter number" />
        <FieldInput label="Amount (₦)" value={amount} onChange={setAmount} type="number" placeholder="Enter amount" />
        <button className="btn-lime full" disabled={!prov || !meter || !amount} onClick={() => setPin(true)}>Purchase Units</button>
        {token && (
          <div className="glass glass-lime" style={{ padding: 14 }}>
            <div style={{ color: "var(--lime)", fontFamily: "var(--font-d)", fontWeight: 700, marginBottom: 4, fontSize: 12 }}>Token Generated</div>
            <div style={{ fontFamily: "var(--font-m)", color: "var(--text)", fontSize: 17, letterSpacing: "0.08em" }}>{token}</div>
          </div>
        )}
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function BettingForm({ onBack, onSuccess }) {
  const [prov, setProv] = useState(null);
  const [acct, setAcct] = useState("");
  const [selAmt, setSelAmt] = useState(null);
  const [custAmt, setCustAmt] = useState("");
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Betting funded!\n${BET_PROVS.find(b => b.id === prov)?.name}\nAmount: ₦${(selAmt || custAmt).toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Betting" onBack={onBack} />
      <div className="f-section f-stack">
        <div><label className="f-label">Provider</label><ProvGrid provs={BET_PROVS} selected={prov} onSelect={setProv} /></div>
        <FieldInput label="Account ID" value={acct} onChange={setAcct} placeholder="Enter your betting account ID" />
        <div>
          <label className="f-label">Amount</label>
          <AmtChips values={[500, 1000, 2000]} selected={selAmt} onSelect={v => { setSelAmt(v); setCustAmt(""); }} />
          <div className="f-card"><input type="number" value={custAmt} onChange={e => { setCustAmt(e.target.value); setSelAmt(null); }} placeholder="Custom amount" className="f-input" /></div>
        </div>
        <button className="btn-lime full" disabled={!prov || !acct || (!selAmt && !custAmt)} onClick={() => setPin(true)}>Fund Account</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function GiftCardsForm({ onBack, onSuccess }) {
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Gift card purchased!\n${GIFT_CARDS.find(g => g.id === sel)?.name} — ₦${parseFloat(amount).toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Gift Cards" onBack={onBack} />
      <div className="f-section f-stack">
        <div>
          <label className="f-label">Select Card</label>
          <div className="space-y">
            {GIFT_CARDS.map(card => (
              <button key={card.id} className={`plan-btn ${sel === card.id ? "sel" : ""}`} onClick={() => setSel(card.id)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>{card.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)" }}>Min: ₦{card.min.toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <FieldInput label="Amount (₦)" value={amount} onChange={setAmount} type="number" placeholder="Enter amount" />
        <button className="btn-lime full" disabled={!sel || !amount} onClick={() => setPin(true)}>Purchase</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function BillsForm({ onBack, onSuccess }) {
  const [selBill, setSelBill] = useState(null);
  const [ref, setRef] = useState("");
  const [selAmt, setSelAmt] = useState(null);
  const [custAmt, setCustAmt] = useState("");
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Bill paid!\n${BILL_TYPES.find(b => b.id === selBill)?.name}\nAmount: ₦${(selAmt || custAmt).toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Pay Bills" onBack={onBack} />
      <div className="f-section f-stack">
        <div>
          <label className="f-label">Bill Type</label>
          <div className="space-y">
            {BILL_TYPES.map(bill => (
              <button key={bill.id} className={`plan-btn ${selBill === bill.id ? "sel" : ""}`} onClick={() => setSelBill(bill.id)}>
                <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>{bill.name}</div>
              </button>
            ))}
          </div>
        </div>
        <FieldInput label="Reference Number" value={ref} onChange={setRef} placeholder="Enter reference" />
        <div>
          <label className="f-label">Amount</label>
          <AmtChips values={[1000, 2000, 5000]} selected={selAmt} onSelect={v => { setSelAmt(v); setCustAmt(""); }} />
          <div className="f-card"><input type="number" value={custAmt} onChange={e => { setCustAmt(e.target.value); setSelAmt(null); }} placeholder="Custom amount" className="f-input" /></div>
        </div>
        <button className="btn-lime full" disabled={!selBill || !ref || (!selAmt && !custAmt)} onClick={() => setPin(true)}>Pay Bill</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

function LoansForm({ onBack, onSuccess }) {
  const [selPlan, setSelPlan] = useState(null);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState(false);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Loan applied!\n${LOAN_PLANS.find(l => l.id === selPlan)?.name}\nAmount: ₦${parseFloat(amount).toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Loans" onBack={onBack} />
      <div className="f-section f-stack">
        <div>
          <label className="f-label">Select Plan</label>
          <div className="space-y">
            {LOAN_PLANS.map(plan => (
              <button key={plan.id} className={`plan-btn ${selPlan === plan.id ? "sel" : ""}`} onClick={() => setSelPlan(plan.id)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>{plan.name}</div>
                    <div style={{ fontSize: 12, color: selPlan === plan.id ? "rgba(163,230,53,0.6)" : "var(--text-soft)" }}>{plan.desc}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, color: selPlan === plan.id ? "var(--lime)" : "var(--text)" }}>{plan.rate}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-soft)" }}>Max ₦{plan.max.toLocaleString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <FieldInput label="Loan Amount (₦)" value={amount} onChange={setAmount} type="number" placeholder="Enter amount" />
        <button className="btn-lime full" disabled={!selPlan || !amount} onClick={() => setPin(true)}>Apply for Loan</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

// ── Router: which form to show ────────────────────────────
const FORM_MAP = {
  airtime:     AirtimeForm,
  data:        DataForm,
  tv:          TVForm,
  electricity: ElectricityForm,
  betting:     BettingForm,
  giftcards:   GiftCardsForm,
  bills:       BillsForm,
  loans:       LoansForm,
};

export default function BillsTab({ view, onBack, onSuccess }) {
  const Form = FORM_MAP[view];
  if (!Form) return null;
  return <Form onBack={onBack} onSuccess={onSuccess} />;
}