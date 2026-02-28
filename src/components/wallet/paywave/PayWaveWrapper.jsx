// paywave/PayWaveWrapper.jsx
// ─────────────────────────────────────────────────────────────
// Fixed-position shell for PayWave — pure ₦ Naira layout.
// Left sidebar: PayWave navigation
// Right sidebar: Nigerian financial data (NGN rates, OPay, quick banks)
//
// NO EP. NO XEV. No token data in this component.
// The right sidebar only shows Naira-world data.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import PayWaveApp from "./PayWaveApp";
import { supabase } from "../../../services/config/supabase";
import { useAuth } from "../../../components/Auth/AuthContext";

const WRAPPER_CSS = `
  /* ── Hide host UI while PayWave is active ── */
  body.paywave-open .mbn,
  body.paywave-open .mbn-fab { display: none !important; }

  .pw-layout {
    position: fixed;
    top: 56px;
    left: calc(6% + 5px + 280px);
    right: 4%;
    bottom: 0;
    z-index: 49;
    display: flex;
    flex-direction: row;
    background: #07080a;
    overflow: hidden;
  }

  /* ── Mobile: below host top header, full to bottom (host nav hidden via body class) ── */
  @media (max-width: 768px) {
    .pw-layout {
      top: 47px;
      left: 0;
      right: 0;
      bottom: 0;
      height: calc(100vh - 47px);
      z-index: 49;
      align-items: stretch;
    }
  }

  .pw-left {
    width: 300px; flex-shrink: 0;
    display: flex; flex-direction: column;
    padding: 18px 12px; gap: 4px;
    overflow-y: auto; overflow-x: hidden;
    scrollbar-width: none;
    background: rgba(4,5,6,0.98);
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .pw-left::-webkit-scrollbar { display: none; }

  .pw-center {
    flex: 1; min-width: 0;
    height: 100%;
    min-height: 0;
    display: flex; flex-direction: column;
    overflow: hidden; position: relative;
    box-shadow: inset 1px 0 0 rgba(163,230,53,0.04);
  }

  .pw-right {
    width: 300px; flex-shrink: 0;
    display: flex; flex-direction: column;
    overflow-y: auto; overflow-x: hidden;
    padding: 12px;
    scrollbar-width: none;
    background: rgba(4,5,6,0.95);
    border-left: 1px solid rgba(255,255,255,0.06);
  }
  .pw-right::-webkit-scrollbar { display: none; }

  /* Left sidebar */
  .sb-logo {
    font-family: 'Syne', sans-serif;
    font-size: 17px; font-weight: 800; letter-spacing: -0.04em;
    background: linear-gradient(135deg, #a3e635, #65a30d);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    padding: 0 4px 12px;
    border-bottom: 1px solid rgba(212,168,71,0.18);
    margin-bottom: 18px;
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  }
  .sb-logo-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #d4a847; box-shadow: 0 0 8px rgba(212,168,71,0.5);
    flex-shrink: 0;
  }

  .sb-nav-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 10px;
    border: none; background: transparent;
    color: rgba(255,255,255,0.28);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 500;
    width: 100%; text-align: left;
    cursor: pointer; transition: all .15s; flex-shrink: 0;
  }
  .sb-nav-btn:hover { color: rgba(255,255,255,0.58); background: rgba(255,255,255,0.03); }
  .sb-nav-btn.active {
    color: #a3e635;
    background: rgba(163,230,53,0.07);
    border: 1px solid rgba(163,230,53,0.16);
  }
  .sb-nav-ic {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background .15s;
  }
  .sb-nav-btn.active .sb-nav-ic { background: rgba(163,230,53,0.12); }
  .sb-section-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.1em; color: rgba(255,255,255,0.15);
    padding: 0 4px; margin: 14px 0 5px; flex-shrink: 0;
  }
  .sb-user {
    margin-top: auto; padding: 10px; border-radius: 12px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.055);
    display: flex; align-items: center; gap: 9px;
    transition: border-color .15s; flex-shrink: 0;
  }
  .sb-user:hover { border-color: rgba(163,230,53,0.14); }
  .sb-av {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #a3e635, #65a30d);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Syne', sans-serif; font-weight: 800;
    font-size: 13px; color: #0a0e06; flex-shrink: 0;
    box-shadow: 0 2px 10px rgba(163,230,53,0.2);
  }

  /* Right sidebar widgets */
  .rw-card {
    border-radius: 14px; padding: 14px; margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.055);
    background: rgba(255,255,255,0.02); flex-shrink: 0;
  }
  .rw-card.lime { border-color: rgba(163,230,53,0.13); background: rgba(163,230,53,0.03); }
  .rw-card.gold { border-color: rgba(212,168,71,0.18); background: rgba(212,168,71,0.03); }
  .rw-card.green { border-color: rgba(34,197,94,0.18); background: rgba(34,197,94,0.03); }

  .rw-card-title {
    font-family: 'Syne', sans-serif;
    font-size: 12.5px; font-weight: 700; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .rw-card-title.lime { color: rgba(163,230,53,0.7); }
  .rw-card-title.gold { color: rgba(212,168,71,0.7); }
  .rw-card-title.green { color: rgba(34,197,94,0.7); }

  .market-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .market-row:last-child { border-bottom: none; padding-bottom: 0; }

  .stat-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 9px;
  }
  .stat-row:last-child { margin-bottom: 0; }

  .rw-tip {
    font-size: 11px; line-height: 1.65;
    color: rgba(255,255,255,0.16);
    font-family: 'DM Sans', sans-serif;
    padding: 10px 12px; border-radius: 10px;
    border: 1px dashed rgba(255,255,255,0.06);
    flex-shrink: 0; margin-bottom: 16px;
  }
  .rw-tip span { color: rgba(163,230,53,0.45); }

  .opay-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 20px;
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.2);
    font-size: 10px; color: #10b981;
    font-family: 'DM Sans', sans-serif; font-weight: 600;
  }

  @media (max-width: 767px) {
    .pw-left, .pw-right { display: none; }
  }
  @media (min-width: 768px) and (max-width: 1099px) {
    .pw-left {
      width: 58px; padding: 18px 8px; align-items: center;
    }
    .sb-logo { font-size: 0; border: none; padding: 0; margin: 0 0 16px; justify-content: center; }
    .sb-logo::after { content: "X"; font-size: 18px; font-family: Syne, sans-serif; font-weight: 800; color: #a3e635; -webkit-text-fill-color: #a3e635; }
    .sb-logo-dot { display: none; }
    .sb-nav-btn { width: 40px; padding: 0; justify-content: center; border-radius: 10px; }
    .sb-nav-btn span.nav-label { display: none; }
    .sb-section-label { display: none; }
    .sb-user { padding: 8px; justify-content: center; }
    .sb-user-name { display: none; }
    .pw-right { display: none; }
  }
`;

// OPay ecosystem services
const OPAY_SERVICES = [
  { name: "Airtime",     emoji: "📱", desc: "All networks" },
  { name: "Data",        emoji: "📶", desc: "4G/5G plans"  },
  { name: "Electricity", emoji: "⚡", desc: "NEPA units"   },
  { name: "Cable TV",    emoji: "📺", desc: "DSTV/GOTV"    },
];

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayWaveWrapper({ onBack, userId }) {
  const { profile } = useAuth();

  // ── Live NGN Exchange Rates ──────────────────────────────
  const [rates,       setRates]       = useState([
    { sym: "USD/NGN",  val: "—",     chg: "—",     up: true  },
    { sym: "EUR/NGN",  val: "—",     chg: "—",     up: false },
    { sym: "GBP/NGN",  val: "—",     chg: "—",     up: true  },
    { sym: "USDT/NGN", val: "—",     chg: "—",     up: true  },
  ]);
  const [rateLoading,  setRateLoading]  = useState(false);
  const [rateLastFetch, setRateLastFetch] = useState(null);

  const fetchRates = useCallback(async () => {
    setRateLoading(true);
    try {
      // Open.er-API — free, no key required
      const res  = await fetch("https://open.er-api.com/v6/latest/NGN");
      const json = await res.json();
      if (json.result === "success" && json.rates) {
        const r = json.rates;
        const toNGN = (code) => {
          const rate = r[code];
          if (!rate) return { val: "—", chg: "—", up: true };
          const ngn = (1 / rate);
          return { val: `₦${ngn.toLocaleString("en-NG", { maximumFractionDigits: 0 })}` };
        };

        // We need prev snapshot to compute change — store in state
        setRates(prev => {
          const update = (sym, code) => {
            const cur = 1 / (r[code] || 1);
            const old = prev.find(x => x.sym === sym);
            // Parse previous numeric value
            const prevNum = old ? parseFloat((old.val || "0").replace(/[₦,]/g, "")) : cur;
            const diff = cur - prevNum;
            const pct  = prevNum > 0 ? ((diff / prevNum) * 100).toFixed(2) : "0.00";
            return {
              sym,
              val: `₦${cur.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`,
              chg: (diff >= 0 ? "+" : "") + pct + "%",
              up:  diff >= 0,
            };
          };
          return [
            update("USD/NGN",  "USD"),
            update("EUR/NGN",  "EUR"),
            update("GBP/NGN",  "GBP"),
            update("USDT/NGN", "USDT"),
          ];
        });
        setRateLastFetch(new Date());
      }
    } catch (_) {
      /* keep previous values on error */
    } finally {
      setRateLoading(false);
    }
  }, []);

  // Fetch on mount + every 60 seconds
  useEffect(() => {
    fetchRates();
    const t = setInterval(fetchRates, 60_000);
    return () => clearInterval(t);
  }, [fetchRates]);

  // ── Real Naira Activity from Supabase ────────────────────
  const [activity, setActivity] = useState({
    transfersToday: "—",
    received:       "—",
    cashback:       "—",
    billsMonth:     "—",
  });
  const [actLoading, setActLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!profile?.id) return;
    setActLoading(true);
    try {
      const today     = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Transfers sent today
      const { count: txToday } = await supabase
        .from("paywave_transfers")
        .select("id", { count: "exact", head: true })
        .eq("from_user_id", profile.id)
        .gte("created_at", today.toISOString());

      // Total received this month
      const { data: recvData } = await supabase
        .from("paywave_transfers")
        .select("amount")
        .eq("to_user_id", profile.id)
        .gte("created_at", monthStart.toISOString());
      const totalReceived = (recvData || []).reduce((s, r) => s + Number(r.amount), 0);

      // Cashback earned this month
      const { data: cbData } = await supabase
        .from("cashback_transactions")
        .select("amount")
        .eq("user_id", profile.id)
        .gte("created_at", monthStart.toISOString());
      const totalCashback = (cbData || []).reduce((s, r) => s + Number(r.amount), 0);

      // Bills paid this month (bill_payments table)
      const { data: billData } = await supabase
        .from("bill_payments")
        .select("amount")
        .eq("user_id", profile.id)
        .gte("created_at", monthStart.toISOString());
      const totalBills = (billData || []).reduce((s, r) => s + Number(r.amount), 0);

      setActivity({
        transfersToday: String(txToday ?? 0),
        received:       totalReceived > 0 ? `₦${fmtNGN(totalReceived)}` : "₦0.00",
        cashback:       totalCashback > 0 ? `₦${fmtNGN(totalCashback)}` : "₦0.00",
        billsMonth:     totalBills    > 0 ? `₦${fmtNGN(totalBills)}`    : "₦0.00",
      });
    } catch (_) {
      /* keep dashes */
    } finally {
      setActLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Real-time subscription for new transfers
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`pw_activity:${profile.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "paywave_transfers",
      }, () => fetchActivity())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.id, fetchActivity]);

  // ── Hide host bottom nav while PayWave is open ───────────────────────
  useEffect(() => {
    document.body.classList.add("paywave-open");
    return () => document.body.classList.remove("paywave-open");
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        ${WRAPPER_CSS}
        @keyframes rw-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <div className="pw-layout">

        {/* CENTER — PayWave App */}
        <main className="pw-center">
          <PayWaveApp onBack={onBack} userId={userId} />
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="pw-right">

          {/* OPay ecosystem */}
          <div className="rw-card green" style={{ marginBottom: 14 }}>
            <div className="rw-card-title green">
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              OPay Ecosystem
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.38)", fontFamily:"DM Sans, sans-serif" }}>Status</span>
              <span className="opay-badge">● Connected</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:6 }}>
              {OPAY_SERVICES.map(s => (
                <div key={s.name}
                  style={{ padding:"7px 9px", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.055)", borderRadius:8, cursor:"pointer", transition:"all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(16,185,129,0.25)"; e.currentTarget.style.background="rgba(16,185,129,0.07)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.055)"; e.currentTarget.style.background="rgba(255,255,255,0.025)"; }}>
                  <div style={{ fontSize:14, marginBottom:2 }}>{s.emoji}</div>
                  <div style={{ fontFamily:"DM Sans, sans-serif", fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.65)" }}>{s.name}</div>
                  <div style={{ fontFamily:"DM Sans, sans-serif", fontSize:9.5, color:"rgba(255,255,255,0.25)" }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* NGN Live Rates — auto-refreshes every 60s */}
          <div className="rw-card lime">
            <div className="rw-card-title lime" style={{ position:"relative" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              NGN Exchange Rates
              <span style={{ marginLeft:"auto", fontFamily:"DM Sans, sans-serif", fontSize:9, color:"rgba(163,230,53,0.35)", letterSpacing:"0.08em" }}>
                {rateLastFetch ? "LIVE" : "—"}
              </span>
              {/* Hard refresh button */}
              <button
                onClick={fetchRates}
                title="Refresh rates"
                style={{
                  background: "rgba(163,230,53,0.07)", border: "1px solid rgba(163,230,53,0.15)",
                  borderRadius: 6, width: 22, height: 22, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(163,230,53,0.6)", marginLeft: 6, flexShrink: 0,
                  transition: "all .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(163,230,53,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(163,230,53,0.07)"}
              >
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  style={{ animation: rateLoading ? "rw-spin 0.8s linear infinite" : "none" }}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>
            {rates.map(item => (
              <div key={item.sym} className="market-row">
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.38)", fontFamily:"DM Sans, sans-serif" }}>{item.sym}</span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:"rgba(255,255,255,0.7)", fontFamily:"DM Sans, sans-serif" }}>{item.val}</div>
                  <div style={{ fontSize:10.5, fontWeight:600, color: item.up ? "#a3e635" : "#f87171" }}>{item.chg}</div>
                </div>
              </div>
            ))}
            {rateLastFetch && (
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.15)", fontFamily:"DM Sans, sans-serif", marginTop:6, textAlign:"right" }}>
                Updated {rateLastFetch.toLocaleTimeString("en-NG", { hour:"2-digit", minute:"2-digit" })} · auto-refresh 1min
              </div>
            )}
          </div>

          {/* Your Activity — real Supabase data */}
          <div className="rw-card gold">
            <div className="rw-card-title gold" style={{ display:"flex", alignItems:"center" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Your Activity
              <button
                onClick={fetchActivity}
                title="Refresh activity"
                style={{
                  marginLeft: "auto", background: "rgba(212,168,71,0.08)", border: "1px solid rgba(212,168,71,0.18)",
                  borderRadius: 6, width: 22, height: 22, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(212,168,71,0.6)",
                }}
              >
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  style={{ animation: actLoading ? "rw-spin 0.8s linear infinite" : "none" }}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>
            {[
              { label:"Transfers Today",    val: activity.transfersToday, color:"rgba(255,255,255,0.55)" },
              { label:"Money Received",      val: activity.received,       color:"#a3e635"                },
              { label:"Cashback Earned",     val: activity.cashback,       color:"#d4a847"                },
              { label:"Bills This Month",    val: activity.billsMonth,     color:"rgba(255,255,255,0.4)"  },
            ].map(({ label, val, color }) => (
              <div key={label} className="stat-row">
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.24)", fontFamily:"DM Sans, sans-serif" }}>{label}</span>
                <span style={{ fontSize:12, fontWeight:700, color, fontFamily:"DM Sans, sans-serif" }}>
                  {actLoading ? "…" : val}
                </span>
              </div>
            ))}
          </div>

          {/* Quick bank transfer */}
          <div className="rw-card" style={{ marginBottom: 0 }}>
            <div className="rw-card-title" style={{ color:"rgba(255,255,255,0.35)" }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="rgba(212,168,71,0.6)" strokeWidth={2.5}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              Quick Bank Transfer
            </div>
            {[
              { name:"OPay",       color:"#10b981" },
              { name:"PalmPay",    color:"#f59e0b" },
              { name:"Moniepoint", color:"#6366f1" },
              { name:"GTBank",     color:"#ef4444" },
            ].map(b => (
              <div key={b.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:b.color }} />
                  <span style={{ fontFamily:"DM Sans, sans-serif", fontSize:12, color:"rgba(255,255,255,0.5)" }}>{b.name}</span>
                </div>
                <span style={{ fontFamily:"DM Sans, sans-serif", fontSize:10, color:"rgba(255,255,255,0.2)" }}>Tap to send →</span>
              </div>
            ))}
          </div>

        </aside>
      </div>
    </>
  );
}