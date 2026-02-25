// paywave/tabs/FinanceTab.jsx
import React from "react";
import { TrendingUp, PiggyBank, CreditCard, Lock, DollarSign, ChevronRight } from "lucide-react";
import { PlanIcon } from "../components/UI";

const INV_PLANS = [
  { id:1, name:"OWealth",       rate:"10% p.a.", desc:"Daily interest, withdraw anytime", icon:TrendingUp, cls:"g-inv1" },
  { id:2, name:"Fixed Deposit", rate:"15% p.a.", desc:"Lock 90 days, higher returns",     icon:Lock,       cls:"g-inv2" },
];

export default function FinanceTab({ balance, setPage }) {
  const items = [
    { icon: TrendingUp, label: "Investments", amount: "0.00",              page: "invest", cls: "g-inv1" },
    { icon: PiggyBank,  label: "Savings",     amount: balance.toFixed(2),  page: "save",   cls: "g-inv2" },
    { icon: CreditCard, label: "Cards",       amount: "0.00",              page: "cards",  cls: "g-rose" },
  ];

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop: 16, paddingBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.025em" }}>Finance</div>
        <div style={{ color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>Manage your wealth</div>
      </div>

      {/* ── Portfolio hero ─────────────────────────────────── */}
      <div className="glass glass-lime" style={{ padding: 17, marginBottom: 14, position: "relative", overflow: "hidden" }}>
        {/* Gold accent dot — subtle compliment */}
        <div style={{ position: "absolute", bottom: 14, right: 16, width: 4, height: 4, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 7px var(--gold)", opacity: 0.55 }} />
        <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, background: "radial-gradient(circle, rgba(163,230,53,0.1) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(16px)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginBottom: 4 }}>Total Portfolio</div>
          <div style={{ fontFamily: "var(--font-d)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>₦{balance.toFixed(2)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--lime)", fontSize: 12, marginTop: 4 }}>
            <TrendingUp size={12} /><span>+₦0.09 today</span>
          </div>
        </div>
      </div>

      {/* ── Overview rows ──────────────────────────────────── */}
      <div className="space-y mb-4">
        {items.map((item, i) => (
          <div key={i} className="glass click" style={{ padding: "12px 14px" }} onClick={() => setPage(item.page)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PlanIcon cls={item.cls} size={36}><item.icon size={16} color="#fff" /></PlanIcon>
                <span style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 700 }}>{item.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>₦{item.amount}</span>
                <ChevronRight size={13} color="var(--text-muted)" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick invest actions ───────────────────────────── */}
      <div className="sec-hd">
        <span className="sec-title">Quick Invest</span>
        <button className="sec-link" onClick={() => setPage("invest")}>See all</button>
      </div>
      <div className="space-y">
        {INV_PLANS.map(plan => (
          <div key={plan.id} className="glass click" style={{ padding: "12px 14px" }} onClick={() => setPage("invest")}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PlanIcon cls={plan.cls} size={34}><plan.icon size={15} color="#fff" /></PlanIcon>
                <div>
                  <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 700 }}>{plan.name}</div>
                  <div style={{ color: "var(--text-soft)", fontSize: 11.5 }}>{plan.desc}</div>
                </div>
              </div>
              <span style={{ color: "var(--lime)", fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 13.5 }}>{plan.rate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}