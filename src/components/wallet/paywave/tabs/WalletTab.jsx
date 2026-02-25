// paywave/tabs/WalletTab.jsx
// Wallet-action views: Send, Receive, Invest, Save, Cards.
// Rendered based on `view` prop passed from parent router.

import React, { useState } from "react";
import { Send, Download, TrendingUp, Lock, DollarSign, PiggyBank, Target, CreditCard, Plus, Link, ChevronRight } from "lucide-react";
import { Header, Avatar, CopyField, PlainField, PlanCard, PlanIcon, StatBox } from "../components/UI";
import { PinModal, SendTypeModal } from "../modals/index";
import { BANKS } from "../constants";

// ── SEND ──────────────────────────────────────────────────
function SendView({ balance, onBack, onSuccess }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount]       = useState("");
  const [sendTo, setSendTo]       = useState(null);
  const [selBank, setSelBank]     = useState(null);
  const [typeModal, setTypeModal] = useState(false);
  const [pin, setPin]             = useState(false);

  const canSend = recipient && amount && parseFloat(amount) <= balance && sendTo && (sendTo !== "other" || selBank);

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Transfer successful!\nTo: ${recipient}\nAmount: ₦${parseFloat(amount).toLocaleString()}`);
  };

  return (
    <div className="pw-scroll">
      <Header title="Send Money" onBack={onBack} />
      <div className="f-section f-stack">

        {/* Balance banner */}
        <div className="glass glass-lime" style={{ padding: "13px 15px", textAlign: "center" }}>
          <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginBottom: 3 }}>Available Balance</div>
          <div style={{ fontFamily: "var(--font-d)", fontSize: 24, fontWeight: 800 }}>₦{balance.toFixed(2)}</div>
        </div>

        <button className="btn-lime full" onClick={() => setTypeModal(true)}>
          {sendTo ? (sendTo === "paywave" ? "✓ To Paywave User" : "✓ To Other Bank") : "Choose Transfer Type"}
        </button>

        {sendTo === "other" && (
          <div>
            <label className="f-label">Select Bank</label>
            <select value={selBank || ""} onChange={e => setSelBank(e.target.value)} className="bank-sel">
              <option value="">— Select Bank —</option>
              {BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="f-label">Recipient</label>
          <div className="f-card">
            <input type="tel" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Phone or account number" className="f-input" />
          </div>
        </div>

        <div>
          <label className="f-label">Amount</label>
          <div className="f-card" style={{ padding: "11px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 20 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="f-input-lg" />
            </div>
          </div>
        </div>

        <div className="amt-grid">
          {[100, 500, 1000].map(a => (
            <button key={a} className="amt-btn" onClick={() => setAmount(a.toString())}>₦{a}</button>
          ))}
        </div>

        <button className="btn-lime full" disabled={!canSend} onClick={() => setPin(true)}>
          <Send size={14} /> Send Money
        </button>
      </div>

      {typeModal && <SendTypeModal onClose={() => setTypeModal(false)} onSelect={t => { setSendTo(t); setTypeModal(false); }} />}
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

// ── RECEIVE ───────────────────────────────────────────────
function ReceiveView({ onBack }) {
  return (
    <div className="pw-scroll">
      <Header title="Receive Money" onBack={onBack} />
      <div style={{ padding: 15 }}>
        <div className="glass" style={{ padding: 22 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <Avatar letter="E" size="lg" />
            <div style={{ fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)", marginTop: 10 }}>Emmanuel Walker</div>
            <div style={{ color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>Share your account details to receive money</div>
          </div>
          <CopyField label="Account Number" value="9040273157" />
          <PlainField label="Account Name" value="Emmanuel Walker" />
          <PlainField label="Bank" value="PayWave Bank" />
          <button className="btn-lime full" style={{ marginTop: 8 }}>
            <Download size={13} /> Share Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ── INVEST ────────────────────────────────────────────────
const INV_PLANS = [
  { id:1, name:"OWealth",       rate:"10%", min:100,   desc:"Daily interest, withdraw anytime", icon:TrendingUp, cls:"g-inv1" },
  { id:2, name:"Fixed Deposit", rate:"15%", min:5000,  desc:"Lock for 90 days, higher returns", icon:Lock,       cls:"g-inv2" },
  { id:3, name:"Mutual Funds",  rate:"18%", min:10000, desc:"Diversified portfolio",             icon:DollarSign, cls:"g-inv3" },
];

function InvestView({ onBack, onSuccess }) {
  const [selPlan, setSelPlan] = useState(null);
  const [amount, setAmount]   = useState("");
  const [pin, setPin]         = useState(false);

  if (!selPlan) return (
    <div className="pw-scroll">
      <Header title="Invest" onBack={onBack} />
      <div className="f-section f-stack">
        {/* Hero */}
        <div className="glass glass-lime" style={{ padding: "15px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(163,230,53,0.12)", border: "1px solid var(--lime-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} color="var(--lime)" />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Grow Your Wealth</div>
              <div style={{ color: "var(--lime)", fontSize: 12 }}>Up to 18% annual returns</div>
            </div>
          </div>
        </div>
        <div className="space-y">
          {INV_PLANS.map(plan => (
            <PlanCard key={plan.id} icon={plan.icon} cls={plan.cls} name={plan.name} desc={plan.desc}
              meta={<div style={{ display: "flex", gap: 6 }}><span style={{ color: "var(--lime)", fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 13 }}>{plan.rate} p.a.</span><span style={{ color: "var(--text-soft)", fontSize: 12 }}>• Min ₦{plan.min.toLocaleString()}</span></div>}
              onClick={() => setSelPlan(plan)} />
          ))}
        </div>
      </div>
    </div>
  );

  const plan = selPlan;
  const est = amount && parseFloat(amount) >= plan.min
    ? (parseFloat(amount) * parseFloat(plan.rate) / 100).toFixed(2)
    : null;

  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Investment created!\n${plan.name}\nAmount: ₦${parseFloat(amount).toLocaleString()}\nEst. Returns: ₦${est}`);
    setSelPlan(null); setAmount("");
  };

  return (
    <div className="pw-scroll">
      <Header title={plan.name} onBack={() => { setSelPlan(null); setAmount(""); }} />
      <div className="f-section f-stack">
        {/* Detail hero */}
        <div className="glass glass-lime" style={{ padding: "17px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 13 }}>
            <PlanIcon cls={plan.cls} size={52}><plan.icon size={24} color="#fff" /></PlanIcon>
            <div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{plan.name}</div>
              <div style={{ color: "var(--text-soft)", fontSize: 13 }}>{plan.desc}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatBox label="Annual Return" value={plan.rate} accent />
            <StatBox label="Minimum" value={`₦${plan.min.toLocaleString()}`} />
          </div>
        </div>

        <div>
          <label className="f-label">Amount to Invest</label>
          <div className="f-card" style={{ padding: "11px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 20 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="f-input-lg" />
            </div>
          </div>
        </div>

        <div className="amt-grid">
          {[1000, 5000, 10000].map(a => (
            <button key={a} className="amt-btn" onClick={() => setAmount(a.toString())}>₦{a.toLocaleString()}</button>
          ))}
        </div>

        {est && (
          <div className="glass glass-lime" style={{ padding: "13px 15px" }}>
            <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginBottom: 4 }}>Estimated Returns (1 year)</div>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 26, fontWeight: 800, color: "var(--lime)" }}>₦{est}</div>
          </div>
        )}

        <button className="btn-lime full" disabled={!amount || parseFloat(amount) < plan.min} onClick={() => setPin(true)}>Invest Now</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

// ── SAVE ──────────────────────────────────────────────────
const SAV_PLANS = [
  { id:1, name:"Target Savings", rate:"12%", desc:"Save towards a goal",      icon:Target,   cls:"g-sav1" },
  { id:2, name:"SafeLock",       rate:"13%", desc:"Lock away for discipline", icon:Lock,     cls:"g-sav2" },
  { id:3, name:"Flex Save",      rate:"8%",  desc:"Save and withdraw freely", icon:PiggyBank,cls:"g-sav3" },
];

function SaveView({ onBack, onSuccess }) {
  const [selPlan, setSelPlan] = useState(null);
  const [amount, setAmount]   = useState("");
  const [goal, setGoal]       = useState("");
  const [pin, setPin]         = useState(false);

  if (!selPlan) return (
    <div className="pw-scroll">
      <Header title="Savings" onBack={onBack} />
      <div className="f-section f-stack">
        <div style={{ padding: "15px 14px", borderRadius: "var(--r-lg)", background: "linear-gradient(140deg,rgba(59,130,246,0.07),rgba(168,85,247,0.07))", border: "1px solid rgba(59,130,246,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#60a5fa,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PiggyBank size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Build Your Future</div>
              <div style={{ color: "#60a5fa", fontSize: 12 }}>Automated savings plans</div>
            </div>
          </div>
        </div>
        <div className="space-y">
          {SAV_PLANS.map(plan => (
            <PlanCard key={plan.id} icon={plan.icon} cls={plan.cls} name={plan.name} desc={plan.desc}
              meta={<span style={{ color: "#60a5fa", fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 13 }}>{plan.rate} p.a.</span>}
              onClick={() => setSelPlan(plan)} />
          ))}
        </div>
      </div>
    </div>
  );

  const plan = selPlan;
  const verify = (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    onSuccess(`Savings plan created!\nGoal: ${goal}\nPlan: ${plan.name}\nAmount: ₦${parseFloat(amount).toLocaleString()}`);
    setSelPlan(null); setAmount(""); setGoal("");
  };

  return (
    <div className="pw-scroll">
      <Header title={plan.name} onBack={() => { setSelPlan(null); setAmount(""); setGoal(""); }} />
      <div className="f-section f-stack">
        <div style={{ padding: "17px 15px", borderRadius: "var(--r-lg)", background: "linear-gradient(140deg,rgba(59,130,246,0.07),rgba(168,85,247,0.07))", border: "1px solid rgba(59,130,246,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 13 }}>
            <PlanIcon cls={plan.cls} size={52}><plan.icon size={24} color="#fff" /></PlanIcon>
            <div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{plan.name}</div>
              <div style={{ color: "var(--text-soft)", fontSize: 13 }}>{plan.desc}</div>
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.22)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
            <div style={{ color: "var(--text-soft)", fontSize: 11, marginBottom: 2 }}>Interest Rate</div>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 15, color: "#60a5fa" }}>{plan.rate} per annum</div>
          </div>
        </div>

        <div>
          <label className="f-label">Savings Goal</label>
          <div className="f-card"><input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. New Laptop" className="f-input" /></div>
        </div>

        <div>
          <label className="f-label">Amount</label>
          <div className="f-card" style={{ padding: "11px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 20 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="f-input-lg" />
            </div>
          </div>
        </div>

        <div className="amt-grid">
          {[500, 1000, 5000].map(a => (
            <button key={a} className="amt-btn" onClick={() => setAmount(a.toString())}>₦{a.toLocaleString()}</button>
          ))}
        </div>

        <button className="btn-lime full" disabled={!amount || !goal} onClick={() => setPin(true)}>Start Saving</button>
      </div>
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

// ── CARDS ─────────────────────────────────────────────────
function CardsView({ onBack, onSuccess }) {
  const [cards, setCards]     = useState([{ id:1, last4:"5532", brand:"Verve", name:"Virtual Card 1", balance:0 }]);
  const [extCards, setExtCards] = useState([{ id:1, last4:"4242", brand:"Visa", bank:"Access Bank", name:"Salary Card" }]);

  return (
    <div className="pw-scroll">
      <Header title="My Cards" onBack={onBack} />
      <div style={{ padding: 15 }}>
        {/* Virtual */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span className="sec-title">Virtual Cards</span>
          <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--lime)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-b)" }}
            onClick={() => {
              const nc = { id: cards.length + 1, last4: Math.floor(1000 + Math.random() * 9000).toString(), brand: "Verve", name: `Virtual Card ${cards.length + 1}`, balance: 0 };
              setCards([...cards, nc]); onSuccess("Virtual card created successfully!");
            }}>
            <Plus size={12} /> Create
          </button>
        </div>
        <div className="space-y mb-4">
          {cards.map(card => (
            <div key={card.id} className="glass click" style={{ padding: "13px 14px", borderColor: "var(--lime-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "linear-gradient(135deg, var(--lime), var(--lime-dim))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(163,230,53,0.22)" }}>
                    <CreditCard size={18} color="#0a0e06" />
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{card.name}</div>
                    <div style={{ color: "var(--text-soft)", fontSize: 12, fontFamily: "var(--font-m)" }}>•••• {card.last4}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>₦{card.balance}</div>
                  <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{card.brand}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* External */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span className="sec-title">External Cards</span>
          <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--lime)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-b)" }}
            onClick={() => {
              const n = prompt("Last 4 digits:");
              if (n && n.length === 4) { setExtCards([...extCards, { id: extCards.length + 1, last4: n, brand: "Visa", bank: "External Bank", name: "New Card" }]); onSuccess("Card linked!"); }
            }}>
            <Link size={12} /> Link Card
          </button>
        </div>
        <div className="space-y">
          {extCards.map(card => (
            <div key={card.id} className="glass click" style={{ padding: "13px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "linear-gradient(135deg,rgba(59,130,246,0.18),rgba(168,85,247,0.18))", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CreditCard size={18} color="#60a5fa" />
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{card.name}</div>
                    <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{card.bank} • •••• {card.last4}</div>
                  </div>
                </div>
                <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{card.brand}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────
const VIEW_MAP = {
  send:    SendView,
  receive: ReceiveView,
  invest:  InvestView,
  save:    SaveView,
  cards:   CardsView,
};

export default function WalletTab({ view, balance, onBack, onSuccess }) {
  const View = VIEW_MAP[view];
  if (!View) return null;
  return <View balance={balance} onBack={onBack} onSuccess={onSuccess} />;
}