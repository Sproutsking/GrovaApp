// paywave/tabs/ServicesTab.jsx
import React from "react";
import { Smartphone, Wifi, Tv, Zap, Building2, Gift, CreditCard, Wallet, TrendingUp, PiggyBank, DollarSign, ChevronRight } from "lucide-react";
import { PlanIcon } from "../components/UI";

export default function ServicesTab({ setPage }) {
  const bills = [
    { icon: Smartphone, label: "Airtime",     page: "airtime",     cls: "g-purple" },
    { icon: Wifi,       label: "Data",        page: "data",        cls: "g-blue"   },
    { icon: Tv,         label: "Cable TV",    page: "tv",          cls: "g-orange" },
    { icon: Zap,        label: "Electricity", page: "electricity", cls: "g-yellow" },
    { icon: Building2,  label: "Betting",     page: "betting",     cls: "g-green"  },
    { icon: Gift,       label: "Gift Cards",  page: "giftcards",   cls: "g-pink"   },
    { icon: CreditCard, label: "Bills",       page: "bills",       cls: "g-indigo" },
    { icon: Wallet,     label: "More",        page: "services",    cls: "g-teal"   },
  ];

  const financial = [
    { icon: TrendingUp, label: "Investments", desc: "Grow your wealth",     page: "invest", cls: "g-inv1" },
    { icon: PiggyBank,  label: "Savings",     desc: "Automated savings",    page: "save",   cls: "g-inv2" },
    { icon: CreditCard, label: "Cards",       desc: "Manage your cards",    page: "cards",  cls: "g-rose" },
    { icon: DollarSign, label: "Loans",       desc: "Quick credit access",  page: "loans",  cls: "g-red2" },
  ];

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop: 16, paddingBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.025em" }}>Services</div>
        <div style={{ color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>All your financial services</div>
      </div>

      {/* ── Bills & Payments ───────────────────────────────── */}
      <div className="sec-hd" style={{ marginBottom: 11 }}>
        <span className="sec-title">Bills & Payments</span>
      </div>
      <div className="srv-grid mb-4">
        {bills.map((item, i) => (
          <button key={i} className="srv-item" onClick={() => setPage(item.page)}>
            <div className={`srv-icon ${item.cls}`}><item.icon size={20} color="#fff" /></div>
            <span className="srv-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Financial Services ─────────────────────────────── */}
      <div className="sec-hd" style={{ marginBottom: 11 }}>
        <span className="sec-title">Financial Services</span>
      </div>
      <div className="space-y">
        {financial.map((item, i) => (
          <div key={i} className="glass click" style={{ padding: "12px 14px" }} onClick={() => setPage(item.page)}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <PlanIcon cls={item.cls} size={38}><item.icon size={17} color="#fff" /></PlanIcon>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-d)", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{item.label}</div>
                <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{item.desc}</div>
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}