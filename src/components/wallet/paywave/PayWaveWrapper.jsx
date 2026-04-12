// paywave/PayWaveWrapper.jsx  ── v3 REFINED EDITION
// Desktop shell: tight left nav + center app + right data panel
import React, { useState, useEffect, useCallback } from "react";
import PayWaveApp from "./PayWaveApp";
import { supabase } from "../../../services/config/supabase";
import { useAuth } from "../../../components/Auth/AuthContext";

const WRAPPER_CSS = `
  body.paywave-open .mbn,
  body.paywave-open .mbn-fab { display:none !important; }

  .pw-layout {
    position:fixed;
    top:58px;
    left:calc(6% + 5px + 280px);
    right:4%;
    bottom:0;
    z-index:49;
    display:flex;
    flex-direction:row;
    background:#05070a;
    overflow:hidden;
  }
  @media (min-width:768px) and (max-width:1099px) {
    .pw-layout { left:var(--sidebar-collapsed-w,72px); }
  }
  @media (max-width:768px) {
    .pw-layout {
      top:44px; left:0; right:0; bottom:0;
      height:calc(100dvh - 44px);
      z-index:49; align-items:stretch;
    }
  }

  /* Center */
  .pw-center {
    flex:1; min-width:0;
    height:100%; min-height:0;
    display:flex; flex-direction:column;
    overflow:hidden; position:relative;
  }

  /* Right sidebar */
  .pw-right {
    width:252px; flex-shrink:0;
    display:flex; flex-direction:column;
    overflow-y:auto; overflow-x:hidden;
    padding:10px;
    scrollbar-width:none;
    background:rgba(4,5,8,0.96);
    border-left:1px solid rgba(255,255,255,0.055);
  }
  .pw-right::-webkit-scrollbar { display:none; }

  /* Right sidebar cards */
  .rw-card {
    border-radius:12px; padding:12px; margin-bottom:10px;
    border:1px solid rgba(255,255,255,0.052);
    background:rgba(255,255,255,0.018); flex-shrink:0;
  }
  .rw-card.lime  { border-color:rgba(163,230,53,0.12);  background:rgba(163,230,53,0.025); }
  .rw-card.gold  { border-color:rgba(212,168,71,0.16);  background:rgba(212,168,71,0.025); }
  .rw-card.green { border-color:rgba(16,185,129,0.16);  background:rgba(16,185,129,0.025); }

  .rw-title {
    font-family:'Syne',sans-serif;
    font-size:11px; font-weight:700; margin-bottom:9px;
    display:flex; align-items:center; gap:5px;
  }
  .rw-title.lime  { color:rgba(163,230,53,0.65); }
  .rw-title.gold  { color:rgba(212,168,71,0.65); }
  .rw-title.green { color:rgba(16,185,129,0.65); }

  .mkt-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.036);
  }
  .mkt-row:last-child { border-bottom:none; padding-bottom:0; }

  .stat-row {
    display:flex; justify-content:space-between; align-items:center;
    margin-bottom:7px;
  }
  .stat-row:last-child { margin-bottom:0; }

  .opay-badge {
    display:inline-flex; align-items:center; gap:3px;
    padding:2px 7px; border-radius:20px;
    background:rgba(16,185,129,0.09);
    border:1px solid rgba(16,185,129,0.18);
    font-size:9.5px; color:#10b981;
    font-family:'DM Sans',sans-serif; font-weight:600;
  }

  .srv-mini-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:4px; }
  .srv-mini {
    padding:6px 8px;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.048);
    border-radius:7px; cursor:pointer; transition:all .13s;
  }
  .srv-mini:hover { border-color:rgba(16,185,129,0.22); background:rgba(16,185,129,0.06); }
  .srv-mini-ico { font-size:12px; margin-bottom:2px; }
  .srv-mini-nm  { font-family:'DM Sans',sans-serif; font-size:10px; font-weight:600; color:rgba(255,255,255,0.6); }
  .srv-mini-sub { font-family:'DM Sans',sans-serif; font-size:8.5px; color:rgba(255,255,255,0.24); }

  .bank-row-r {
    display:flex; align-items:center; justify-content:space-between;
    padding:5.5px 0; border-bottom:1px solid rgba(255,255,255,0.036);
  }
  .bank-row-r:last-child { border-bottom:none; }

  @media (max-width:767px) { .pw-right { display:none; } }
  @media (min-width:768px) and (max-width:1099px) { .pw-right { display:none; } }

  @keyframes rw-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
`;

const OPAY_SERVICES = [
  { name:"Airtime",     emoji:"📱", desc:"All networks" },
  { name:"Data",        emoji:"📶", desc:"4G/5G plans"  },
  { name:"Electricity", emoji:"⚡", desc:"NEPA units"   },
  { name:"Cable TV",    emoji:"📺", desc:"DSTV/GOTV"    },
];

const fmtNGN = (n) =>
  Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function PayWaveWrapper({ onBack, userId }) {
  const { profile } = useAuth();

  const [rates, setRates] = useState([
    { sym:"USD/NGN", val:"—", chg:"—", up:true  },
    { sym:"EUR/NGN", val:"—", chg:"—", up:false },
    { sym:"GBP/NGN", val:"—", chg:"—", up:true  },
    { sym:"USDT/NGN",val:"—", chg:"—", up:true  },
  ]);
  const [rateLoading,  setRateLoading]  = useState(false);
  const [rateLastFetch,setRateLastFetch]= useState(null);

  const fetchRates = useCallback(async () => {
    setRateLoading(true);
    try {
      const res  = await fetch("https://open.er-api.com/v6/latest/NGN");
      const json = await res.json();
      if (json.result === "success" && json.rates) {
        const r = json.rates;
        setRates(prev => {
          const update = (sym, code) => {
            const cur    = 1/(r[code]||1);
            const old    = prev.find(x=>x.sym===sym);
            const prevNum= old ? parseFloat((old.val||"0").replace(/[₦,]/g,"")) : cur;
            const diff   = cur - prevNum;
            const pct    = prevNum > 0 ? ((diff/prevNum)*100).toFixed(2) : "0.00";
            return {
              sym,
              val:`₦${cur.toLocaleString("en-NG",{maximumFractionDigits:0})}`,
              chg:(diff>=0?"+":"")+pct+"%",
              up:diff>=0,
            };
          };
          return [
            update("USD/NGN","USD"),
            update("EUR/NGN","EUR"),
            update("GBP/NGN","GBP"),
            update("USDT/NGN","USDT"),
          ];
        });
        setRateLastFetch(new Date());
      }
    } catch {}
    finally { setRateLoading(false); }
  }, []);

  useEffect(() => {
    fetchRates();
    const t = setInterval(fetchRates, 60_000);
    return () => clearInterval(t);
  }, [fetchRates]);

  const [activity, setActivity]     = useState({ transfersToday:"—",received:"—",cashback:"—",billsMonth:"—" });
  const [actLoading, setActLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!profile?.id) return;
    setActLoading(true);
    try {
      const today      = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(today.getFullYear(),today.getMonth(),1);

      const { count:txToday } = await supabase
        .from("paywave_transfers").select("id",{count:"exact",head:true})
        .eq("from_user_id",profile.id).gte("created_at",today.toISOString());

      const { data:recvData } = await supabase
        .from("paywave_transfers").select("amount")
        .eq("to_user_id",profile.id).gte("created_at",monthStart.toISOString());
      const totalReceived = (recvData||[]).reduce((s,r)=>s+Number(r.amount),0);

      const { data:cbData } = await supabase
        .from("cashback_transactions").select("amount")
        .eq("user_id",profile.id).gte("created_at",monthStart.toISOString());
      const totalCashback = (cbData||[]).reduce((s,r)=>s+Number(r.amount),0);

      const { data:billData } = await supabase
        .from("bill_payments").select("amount")
        .eq("user_id",profile.id).gte("created_at",monthStart.toISOString());
      const totalBills = (billData||[]).reduce((s,r)=>s+Number(r.amount),0);

      setActivity({
        transfersToday:String(txToday??0),
        received:totalReceived>0?`₦${fmtNGN(totalReceived)}`:"₦0.00",
        cashback:totalCashback>0?`₦${fmtNGN(totalCashback)}`:"₦0.00",
        billsMonth:totalBills>0?`₦${fmtNGN(totalBills)}`:"₦0.00",
      });
    } catch {}
    finally { setActLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase.channel(`pw_activity:${profile.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"paywave_transfers"},
        () => fetchActivity()).subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.id, fetchActivity]);

  useEffect(() => {
    document.body.classList.add("paywave-open");
    return () => document.body.classList.remove("paywave-open");
  }, []);

  const RefreshBtn = ({ onClick, loading, color = "rgba(163,230,53,0.55)" }) => (
    <button onClick={onClick} style={{
      marginLeft:"auto", background:"rgba(255,255,255,0.04)",
      border:"1px solid rgba(255,255,255,0.07)", borderRadius:5,
      width:19, height:19, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center",
      color, transition:"all .13s",
    }}>
      <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
        style={{ animation:loading?"rw-spin 0.8s linear infinite":"none" }}>
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        ${WRAPPER_CSS}
      `}</style>

      <div className="pw-layout">
        {/* CENTER */}
        <main className="pw-center">
          <PayWaveApp onBack={onBack} userId={userId} />
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="pw-right">

          {/* OPay ecosystem */}
          <div className="rw-card green" style={{ marginBottom:10 }}>
            <div className="rw-title green">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              OPay Ecosystem
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
              <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.35)", fontFamily:"DM Sans,sans-serif" }}>Status</span>
              <span className="opay-badge">● Connected</span>
            </div>
            <div className="srv-mini-grid">
              {OPAY_SERVICES.map(s => (
                <div key={s.name} className="srv-mini">
                  <div className="srv-mini-ico">{s.emoji}</div>
                  <div className="srv-mini-nm">{s.name}</div>
                  <div className="srv-mini-sub">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* NGN Live Rates */}
          <div className="rw-card lime">
            <div className="rw-title lime">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
              NGN Live Rates
              <span style={{ marginLeft:"auto", fontSize:"8px", color:"rgba(163,230,53,0.3)",
                letterSpacing:"0.07em", fontWeight:700 }}>
                {rateLastFetch ? "LIVE" : "—"}
              </span>
              <RefreshBtn onClick={fetchRates} loading={rateLoading} color="rgba(163,230,53,0.55)" />
            </div>
            {rates.map(item => (
              <div key={item.sym} className="mkt-row">
                <span style={{ fontSize:"10.5px", color:"var(--t2)", fontFamily:"DM Mono,monospace" }}>
                  {item.sym}
                </span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"11px", fontWeight:600, color:"rgba(255,255,255,0.65)",
                    fontFamily:"DM Mono,monospace" }}>{item.val}</div>
                  <div style={{ fontSize:"9.5px", fontWeight:600, color:item.up?"#a3e635":"#f87171" }}>
                    {item.chg}
                  </div>
                </div>
              </div>
            ))}
            {rateLastFetch && (
              <div style={{ fontSize:"8.5px", color:"rgba(255,255,255,0.14)",
                fontFamily:"DM Sans,sans-serif", marginTop:5, textAlign:"right" }}>
                {rateLastFetch.toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"})} · auto 1min
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="rw-card gold">
            <div className="rw-title gold">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Your Activity
              <RefreshBtn onClick={fetchActivity} loading={actLoading} color="rgba(212,168,71,0.55)" />
            </div>
            {[
              { label:"Transfers Today", val:activity.transfersToday, color:"rgba(255,255,255,0.5)" },
              { label:"Money Received",  val:activity.received,       color:"#a3e635" },
              { label:"Cashback Earned", val:activity.cashback,       color:"#d4a847" },
              { label:"Bills Month",     val:activity.billsMonth,     color:"rgba(255,255,255,0.38)" },
            ].map(({label,val,color}) => (
              <div key={label} className="stat-row">
                <span style={{ fontSize:"10.5px", color:"rgba(255,255,255,0.24)",
                  fontFamily:"DM Sans,sans-serif" }}>{label}</span>
                <span style={{ fontSize:"11px", fontWeight:700, color,
                  fontFamily:"DM Mono,monospace" }}>
                  {actLoading ? "…" : val}
                </span>
              </div>
            ))}
          </div>

          {/* Quick transfer */}
          <div className="rw-card" style={{ marginBottom:0 }}>
            <div className="rw-title" style={{ color:"rgba(255,255,255,0.32)" }}>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="rgba(212,168,71,0.55)" strokeWidth={2.5}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Quick Transfer
            </div>
            {[
              { name:"OPay",       color:"#10b981" },
              { name:"PalmPay",    color:"#f59e0b" },
              { name:"Moniepoint", color:"#6366f1" },
              { name:"GTBank",     color:"#ef4444" },
            ].map(b => (
              <div key={b.name} className="bank-row-r">
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:b.color }} />
                  <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"11px",
                    color:"rgba(255,255,255,0.46)" }}>{b.name}</span>
                </div>
                <span style={{ fontFamily:"DM Sans,sans-serif", fontSize:"9.5px",
                  color:"rgba(255,255,255,0.18)" }}>Send →</span>
              </div>
            ))}
          </div>

        </aside>
      </div>
    </>
  );
}