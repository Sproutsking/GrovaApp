// paywave/tabs/TransactionsTab.jsx
import React from "react";
import { TrendingUp, Smartphone, Download, Wifi, Zap } from "lucide-react";
import { Header } from "../components/UI";
import { TRANSACTIONS } from "../constants";

const iconFor = (tx) => {
  if (tx.title.includes("Interest"))  return TrendingUp;
  if (tx.title.includes("Airtime"))   return Smartphone;
  if (tx.title.includes("Received"))  return Download;
  if (tx.title.includes("Data"))      return Wifi;
  return Zap;
};

export default function TransactionsTab({ setPage }) {
  return (
    <div className="pw-scroll">
      <Header title="Transactions" onBack={() => setPage("home")} />

      <div style={{ padding: "0 15px" }}>
        {/* ── Summary bar ──────────────────────────────────── */}
        <div className="glass" style={{ padding: "13px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "var(--text-soft)", fontSize: 11.5 }}>Total In</div>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 17, color: "var(--lime)" }}>+₦500.09</div>
          </div>
          {/* Gold divider line — small gold touch */}
          <div style={{ width: 1, height: 32, background: "linear-gradient(to bottom, transparent, var(--gold), transparent)", opacity: 0.4 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--text-soft)", fontSize: 11.5 }}>Total Out</div>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 17, color: "var(--text)" }}>-₦350.00</div>
          </div>
        </div>

        {/* ── List ─────────────────────────────────────────── */}
        <div className="space-y">
          {TRANSACTIONS.map(tx => {
            const Icon = iconFor(tx);
            return (
              <div key={tx.id} className="glass click" style={{ padding: "11px 13px" }}
                onClick={() => alert(`${tx.title}\n₦${tx.amount}\n${tx.date}\n${tx.status}`)}>
                <div className="tx-row">
                  <div className="tx-left">
                    <div className={`tx-icon ${tx.type === "credit" ? "cr" : ""}`}>
                      <Icon size={13} color={tx.type === "credit" ? "var(--lime)" : "var(--text-soft)"} />
                    </div>
                    <div>
                      <div className="tx-title">{tx.title}</div>
                      <div className="tx-date">{tx.date}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className={`tx-amt ${tx.type === "credit" ? "cr" : ""}`}>
                      {tx.type === "credit" ? "+" : "-"}₦{tx.amount.toFixed(2)}
                    </div>
                    <div className="tx-status">{tx.status}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}