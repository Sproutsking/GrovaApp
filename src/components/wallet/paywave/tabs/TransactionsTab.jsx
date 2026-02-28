// paywave/tabs/TransactionsTab.jsx
// ─────────────────────────────────────────────────────────────
// PayWave Naira transaction history.
// Source: wallet_history table — change_type credit/debit.
// NO EP. NO XEV. This is pure ₦ ledger history.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowUpRight, ArrowDownLeft, Smartphone, Wifi, Tv, Zap, RefreshCw,
} from "lucide-react";
import { Header } from "../components/UI";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const iconFor = (reason = "") => {
  const r = reason.toLowerCase();
  if (r.includes("airtime"))                                   return Smartphone;
  if (r.includes("data"))                                     return Wifi;
  if (r.includes("tv") || r.includes("cable"))                return Tv;
  if (r.includes("electric") || r.includes("bill") || r.includes("zap")) return Zap;
  if (r.includes("received") || r.includes("credit") || r.includes("deposit")) return ArrowDownLeft;
  return ArrowUpRight;
};

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function TransactionsTab({ setPage }) {
  const { profile } = useAuth();
  const [txs,     setTxs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [summary, setSummary] = useState({ in: 0, out: 0 });
  const [filter,  setFilter]  = useState("all"); // all | credit | debit

  const fetch = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("wallet_history")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (err) throw err;

      const mapped = (data || []).map(tx => ({
        id:     tx.id,
        type:   tx.change_type,
        title:  tx.reason || (tx.change_type === "credit" ? "Received ₦" : "Sent ₦"),
        amount: Number(tx.amount),
        date:   new Date(tx.created_at).toLocaleDateString("en-NG", {
          month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
      }));

      setTxs(mapped);

      const totalIn  = mapped.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
      const totalOut = mapped.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
      setSummary({ in: totalIn, out: totalOut });
    } catch (err) {
      console.error("PayWave tx fetch error:", err);
      setError("Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const visible = filter === "all" ? txs : txs.filter(t => t.type === filter);

  return (
    <div className="pw-scroll">
      <Header
        title="Transactions"
        onBack={() => setPage("home")}
        right={
          <button
            onClick={fetch}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-soft)", display: "flex", alignItems: "center", padding: 6 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        }
      />

      <div style={{ padding: "0 15px" }}>

        {/* ── Summary bar ── */}
        <div className="glass" style={{ padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "var(--text-soft)", fontSize: 11 }}>Money In</div>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 17, color: "var(--lime)" }}>
              +₦{fmtNGN(summary.in)}
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: "linear-gradient(to bottom, transparent, var(--gold), transparent)", opacity: 0.35 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--text-soft)", fontSize: 11 }}>Money Out</div>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 17, color: "var(--text)" }}>
              −₦{fmtNGN(summary.out)}
            </div>
          </div>
        </div>

        {/* ── Filter pills ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { key: "all",    label: "All" },
            { key: "credit", label: "Received" },
            { key: "debit",  label: "Sent" },
          ].map(f => (
            <button key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 14px", borderRadius: 100, border: "1px solid",
                fontSize: 11.5, fontWeight: 600,
                fontFamily: "var(--font-b)", cursor: "pointer",
                background: filter === f.key ? "rgba(163,230,53,0.1)" : "transparent",
                borderColor: filter === f.key ? "rgba(163,230,53,0.3)" : "rgba(255,255,255,0.07)",
                color: filter === f.key ? "var(--lime)" : "var(--text-soft)",
                transition: "all .15s",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                height: 58, borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                animation: "pw-shimmer 1.4s ease-in-out infinite",
              }} />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#f87171", fontSize: 13 }}>
            {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn-lime sm" onClick={fetch}>Retry</button>
            </div>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-soft)", fontSize: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <ArrowUpRight size={18} style={{ opacity: 0.3 }} />
            </div>
            <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No transactions yet</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.5 }}>
              {filter !== "all" ? `No ${filter === "credit" ? "incoming" : "outgoing"} transactions` : "Send or receive ₦ to get started"}
            </div>
          </div>
        )}

        {/* ── Transaction list ── */}
        {!loading && !error && visible.length > 0 && (
          <div className="space-y">
            {visible.map(tx => {
              const Icon = iconFor(tx.title);
              const isCredit = tx.type === "credit";
              return (
                <div key={tx.id} className="glass click" style={{ padding: "11px 13px" }}>
                  <div className="tx-row">
                    <div className="tx-left">
                      <div className={`tx-icon ${isCredit ? "cr" : ""}`}>
                        <Icon size={13} color={isCredit ? "var(--lime)" : "var(--text-soft)"} />
                      </div>
                      <div>
                        <div className="tx-title">{tx.title}</div>
                        <div className="tx-date">{tx.date}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className={`tx-amt ${isCredit ? "cr" : ""}`}>
                        {isCredit ? "+" : "−"}₦{fmtNGN(tx.amount)}
                      </div>
                      <div className="tx-status">Completed</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pw-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      `}</style>
    </div>
  );
}