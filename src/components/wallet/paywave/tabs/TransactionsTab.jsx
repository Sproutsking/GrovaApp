// paywave/tabs/TransactionsTab.jsx  ── v3 REFINED EDITION
import React, { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownLeft, Smartphone, Wifi, Tv, Zap, RefreshCw } from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});

const iconFor = (reason="") => {
  const r = reason.toLowerCase();
  if (r.includes("airtime"))                                    return Smartphone;
  if (r.includes("data"))                                      return Wifi;
  if (r.includes("tv")||r.includes("cable"))                   return Tv;
  if (r.includes("electric")||r.includes("bill"))              return Zap;
  if (r.includes("received")||r.includes("credit")||r.includes("deposit")) return ArrowDownLeft;
  return ArrowUpRight;
};

export default function TransactionsTab({ setPage }) {
  const { profile } = useAuth();
  const [txs,     setTxs]    = useState([]);
  const [loading, setLoading]= useState(true);
  const [error,   setError]  = useState(null);
  const [summary, setSummary]= useState({ in:0, out:0 });
  const [filter,  setFilter] = useState("all");

  const fetchTxs = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true); setError(null);
    try {
      const { data, error:err } = await supabase
        .from("wallet_history").select("*")
        .eq("user_id",profile.id)
        .order("created_at",{ascending:false}).limit(50);
      if (err) throw err;
      const mapped = (data||[]).map(tx=>({
        id:    tx.id,
        type:  tx.change_type,
        title: tx.reason||(tx.change_type==="credit"?"Received ₦":"Sent ₦"),
        amount:Number(tx.amount),
        date:  new Date(tx.created_at).toLocaleDateString("en-NG",{
          month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",
        }),
      }));
      setTxs(mapped);
      const totalIn  = mapped.filter(t=>t.type==="credit").reduce((s,t)=>s+t.amount,0);
      const totalOut = mapped.filter(t=>t.type==="debit").reduce((s,t)=>s+t.amount,0);
      setSummary({in:totalIn,out:totalOut});
    } catch(err) {
      setError("Could not load transactions.");
    } finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(()=>{ fetchTxs(); },[fetchTxs]);

  const visible = filter==="all" ? txs : txs.filter(t=>t.type===filter);

  const FILTERS = [
    { key:"all",    label:"All"      },
    { key:"credit", label:"Received" },
    { key:"debit",  label:"Sent"     },
  ];

  return (
    <div className="pw-scroll">
      {/* Header */}
      <div className="pw-hdr">
        <button className="pw-back-btn" onClick={()=>setPage("home")}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="pw-hdr-title" style={{ flex:1 }}>Transactions</span>
        <button onClick={fetchTxs} style={{ background:"transparent", border:"none",
          cursor:"pointer", color:"var(--t2)", display:"flex", alignItems:"center", padding:4 }}>
          <RefreshCw size={12} style={{ animation:loading?"pw-spin 1s linear infinite":"none" }} />
        </button>
      </div>

      <div style={{ paddingTop:12 }}>
        {/* Summary */}
        <div className="xg" style={{ padding:"12px 14px", marginBottom:12,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ color:"var(--t3)", fontSize:"9.5px", fontWeight:600, letterSpacing:"0.05em",
              textTransform:"uppercase", marginBottom:3 }}>Money In</div>
            <div style={{ fontFamily:"var(--fd)", fontWeight:800, fontSize:16, color:"var(--lime)" }}>
              +₦{fmtNGN(summary.in)}
            </div>
          </div>
          <div style={{ width:1, height:28,
            background:"linear-gradient(to bottom,transparent,rgba(212,168,71,0.3),transparent)" }} />
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"var(--t3)", fontSize:"9.5px", fontWeight:600, letterSpacing:"0.05em",
              textTransform:"uppercase", marginBottom:3 }}>Money Out</div>
            <div style={{ fontFamily:"var(--fd)", fontWeight:800, fontSize:16 }}>
              −₦{fmtNGN(summary.out)}
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display:"flex", gap:5, marginBottom:12 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={()=>setFilter(f.key)} style={{
              padding:"5px 12px", borderRadius:100, border:"1px solid",
              fontSize:"10.5px", fontWeight:600, fontFamily:"var(--fb)", cursor:"pointer",
              background:filter===f.key?"rgba(163,230,53,0.09)":"transparent",
              borderColor:filter===f.key?"rgba(163,230,53,0.25)":"rgba(255,255,255,0.065)",
              color:filter===f.key?"var(--lime)":"var(--t2)",
              transition:"all .14s",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height:50, borderRadius:10,
                background:"rgba(255,255,255,0.025)",
                animation:`pw-shimmer 1.4s ease-in-out ${i*0.07}s infinite` }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign:"center", padding:"36px 0", color:"#f87171", fontSize:12 }}>
            {error}
            <div style={{ marginTop:10 }}>
              <button className="btn-p sm" onClick={fetchTxs}>Retry</button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visible.length === 0 && (
          <div style={{ textAlign:"center", padding:"50px 0", color:"var(--t2)", fontSize:12 }}>
            <div style={{ width:38, height:38, borderRadius:"50%",
              background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.065)",
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
              <ArrowUpRight size={15} style={{ opacity:0.3 }} />
            </div>
            <div style={{ fontWeight:600, color:"var(--t3)", fontSize:12 }}>No transactions yet</div>
            <div style={{ fontSize:10.5, marginTop:3, opacity:.5 }}>
              {filter!=="all" ? `No ${filter==="credit"?"incoming":"outgoing"} transactions` : "Send or receive ₦ to get started"}
            </div>
          </div>
        )}

        {/* List */}
        {!loading && !error && visible.length > 0 && (
          <div className="sp-y">
            {visible.map(tx => {
              const Icon     = iconFor(tx.title);
              const isCredit = tx.type === "credit";
              return (
                <div key={tx.id} className="xg xg-click" style={{ padding:"9px 11px" }}>
                  <div className="tx-row">
                    <div className="tx-left">
                      <div className={`tx-ic ${isCredit?"cr":""}`}>
                        <Icon size={12} color={isCredit?"var(--lime)":"var(--t2)"} />
                      </div>
                      <div>
                        <div className="tx-name">{tx.title}</div>
                        <div className="tx-date">{tx.date}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div className={`tx-amt ${isCredit?"cr":""}`}>
                        {isCredit?"+":"−"}₦{fmtNGN(tx.amount)}
                      </div>
                      <div className="tx-stat">DONE</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}