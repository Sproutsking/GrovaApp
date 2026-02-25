// paywave/tabs/HomeTab.jsx
import React from "react";
import { Bell, Eye, EyeOff, Send, Download, Smartphone, Wifi, Tv, Zap, TrendingUp, ChevronRight, ArrowLeft } from "lucide-react";
import { Avatar } from "../components/UI";

const TRANSACTIONS = [
  { id:1, type:"credit", title:"OWealth Interest", amount:0.09,  date:"Jan 9, 02:33" },
  { id:2, type:"debit",  title:"Airtime Purchase", amount:100.0, date:"Jan 6, 02:31" },
  { id:3, type:"credit", title:"Money Received",   amount:500.0, date:"Jan 5, 14:20" },
  { id:4, type:"debit",  title:"Data Purchase",    amount:250.0, date:"Jan 4, 09:15" },
];

// Extra CSS injected once — mobile-only back button
const HOME_STYLE = `
  .pw-home-back { display: none !important; }
  @media (max-width: 767px) {
    .pw-home-back { display: flex !important; }
  }
`;

export default function HomeTab({ balance, showBalance, setShowBalance, notifications, setPage, onBack }) {
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="pw-scroll-px">
      <style>{HOME_STYLE}</style>

      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={{ paddingTop: 15, paddingBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Back button visible only on mobile */}
          {onBack && (
            <button className="pw-home-back pw-back" onClick={onBack}>
              <ArrowLeft size={13} />
            </button>
          )}

          <button
            onClick={() => setPage("account")}
            style={{ display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            <Avatar letter="E" size="sm" />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 9.5, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Welcome back</div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Emmanuel</div>
            </div>
          </button>
        </div>

        <button className="ic-chip" onClick={() => setPage("notifications")}>
          <Bell size={13} />
          {unread > 0 && <div className="notif-pip">{unread}</div>}
        </button>
      </div>

      {/* ── Balance card ────────────────────────────────── */}
      <div className="glass" style={{ padding: 17, marginBottom: 14, position: "relative", overflow: "hidden" }}>
        {/* Lime glow */}
        <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, background: "radial-gradient(circle, rgba(163,230,53,0.1) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none" }} />
        {/* Gold sparkle dot */}
        <div style={{ position: "absolute", top: 14, right: 18, width: 5, height: 5, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 8px var(--gold)", opacity: 0.6 }} />

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 11.5 }}>Total Balance</span>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-soft)", display: "flex" }} onClick={() => setShowBalance(!showBalance)}>
                {showBalance ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
            </div>
            <button className="sec-link" style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={() => setPage("transactions")}>
              History <ChevronRight size={11} />
            </button>
          </div>

          <div style={{ fontFamily: "var(--font-d)", fontSize: 32, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.025em", margin: "6px 0 15px" }}>
            {showBalance ? `₦${balance.toFixed(2)}` : "••••••"}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-lime" style={{ flex: 1 }} onClick={() => setPage("send")}>
              <Send size={13} /> Send
            </button>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setPage("receive")}>
              <Download size={13} /> Receive
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────── */}
      <div className="quick-grid">
        {[
          { icon: Smartphone, label: "Airtime",  page: "airtime",     cls: "g-purple" },
          { icon: Wifi,       label: "Data",     page: "data",        cls: "g-blue"   },
          { icon: Tv,         label: "TV",       page: "tv",          cls: "g-orange" },
          { icon: Zap,        label: "Bills",    page: "electricity", cls: "g-yellow" },
        ].map((item, i) => (
          <button key={i} className="quick-btn" onClick={() => setPage(item.page)}>
            <div className={`quick-icon ${item.cls}`}><item.icon size={20} color="#fff" /></div>
            <span className="quick-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Recent activity ──────────────────────────────── */}
      <div className="sec-hd">
        <span className="sec-title">Recent Activity</span>
        <button className="sec-link" onClick={() => setPage("transactions")}>View all</button>
      </div>

      <div className="space-y">
        {TRANSACTIONS.slice(0, 3).map(tx => {
          const IconComp = (
            tx.title.includes("Interest") ? TrendingUp :
            tx.title.includes("Airtime")  ? Smartphone :
            tx.title.includes("Received") ? Download   : Wifi
          );
          return (
            <div className="glass" key={tx.id} style={{ padding: "10px 13px" }}>
              <div className="tx-row">
                <div className="tx-left">
                  <div className={`tx-icon ${tx.type === "credit" ? "cr" : ""}`}>
                    <IconComp size={13} color={tx.type === "credit" ? "var(--lime)" : "var(--text-soft)"} />
                  </div>
                  <div>
                    <div className="tx-title">{tx.title}</div>
                    <div className="tx-date">{tx.date}</div>
                  </div>
                </div>
                <div className={`tx-amt ${tx.type === "credit" ? "cr" : ""}`}>
                  {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}