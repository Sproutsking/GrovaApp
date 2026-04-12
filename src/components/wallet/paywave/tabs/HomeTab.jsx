// paywave/tabs/HomeTab.jsx  ── v3 REFINED EDITION
// Obsidian hero card. Surgical spacing. Lime signal.
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Eye, EyeOff, Send, Download,
  Smartphone, Wifi, Tv, Zap, FileText,
  ChevronRight, ArrowLeft, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Wallet,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});

const iconFor = (reason="") => {
  const r = reason.toLowerCase();
  if (r.includes("airtime"))                          return Smartphone;
  if (r.includes("data"))                             return Wifi;
  if (r.includes("tv")||r.includes("cable"))          return Tv;
  if (r.includes("electric")||r.includes("bill"))     return FileText;
  if (r.includes("received")||r.includes("credit"))   return ArrowDownLeft;
  return ArrowUpRight;
};

const CSS = `
  @keyframes ht-live { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.18)} }
  @keyframes ht-glow { 0%,100%{box-shadow:0 0 28px rgba(163,230,53,0.05),0 20px 50px rgba(0,0,0,0.5)} 50%{box-shadow:0 0 48px rgba(163,230,53,0.12),0 20px 50px rgba(0,0,0,0.5)} }
  @keyframes ht-orb  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.05)} }
  @keyframes ht-sweep { 0%{left:-100%} 100%{left:160%} }
  @keyframes ht-up   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .ht-card { animation: ht-glow 4.5s ease-in-out infinite; }
  .ht-orb1 { animation: ht-orb 7s ease-in-out infinite; }
  .ht-orb2 { animation: ht-orb 9s ease-in-out 1.8s infinite reverse; }
  .ht-row  { animation: ht-up .28s ease both; }
  .ht-sweep {
    position:absolute; top:0; left:-100%; width:50%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.028),transparent);
    transform:skewX(-18deg);
    animation: ht-sweep 6s ease-in-out 2.5s infinite;
    pointer-events:none;
  }
`;

export default function HomeTab({
  pwBalance, showBalance, setShowBalance,
  notifications, setPage, onBack, onRefresh,
}) {
  const { profile } = useAuth();
  const [recentTxs, setRecentTxs]   = useState([]);
  const [loading, setLoading]        = useState(true);
  const [refreshing, setRefreshing]  = useState(false);
  const [unreadCount, setUnreadCount]= useState(0);

  const fetchUnread = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { count } = await supabase
        .from("notifications")
        .select("id",{count:"exact",head:true})
        .eq("recipient_user_id", profile.id)
        .eq("is_read", false)
        .contains("metadata",{category:"paywave"});
      setUnreadCount(count ?? 0);
    } catch {
      setUnreadCount((notifications||[]).filter(n=>!n.read).length);
    }
  }, [profile?.id, notifications]);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase.channel(`hw_unread:${profile.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",
        filter:`recipient_user_id=eq.${profile.id}`}, () => fetchUnread())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.id, fetchUnread]);

  const fetchRecent = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("wallet_history")
        .select("id,change_type,reason,amount,created_at,wallet_type")
        .eq("user_id", profile.id)
        .in("wallet_type",["paywave","naira",null])
        .order("created_at",{ascending:false})
        .limit(5);
      setRecentTxs((data||[]).map(tx=>({
        id:    tx.id,
        type:  tx.change_type,
        title: tx.reason||(tx.change_type==="credit"?"Received ₦":"Sent ₦"),
        amount:Number(tx.amount),
        date:  new Date(tx.created_at).toLocaleDateString("en-NG",{month:"short",day:"numeric"}),
      })));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [profile?.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecent();
    fetchUnread();
    onRefresh?.();
  };

  const displayName = profile?.full_name || profile?.username || "User";
  const initials    = displayName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const QUICK = [
    { icon:Smartphone, label:"Airtime",  page:"airtime",     grad:"linear-gradient(145deg,#9333ea,#6d28d9)", glow:"rgba(147,51,234,0.4)"  },
    { icon:Wifi,        label:"Data",     page:"data",        grad:"linear-gradient(145deg,#2563eb,#1d4ed8)", glow:"rgba(37,99,235,0.4)"   },
    { icon:Tv,          label:"TV",       page:"tv",          grad:"linear-gradient(145deg,#ea580c,#c2410c)", glow:"rgba(234,88,12,0.4)"   },
    { icon:FileText,    label:"Bills",    page:"bills",       grad:"linear-gradient(145deg,#d4a847,#b45309)", glow:"rgba(212,168,71,0.4)"  },
  ];

  return (
    <div className="pw-scroll-px">
      <style>{CSS}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        paddingTop:12, paddingBottom:10,
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <button className="pw-back-btn" onClick={onBack} title="Back">
          <ArrowLeft size={12} />
        </button>

        {/* Brand */}
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <div style={{
              width:22, height:22, borderRadius:6,
              background:"linear-gradient(135deg,#a3e635,#65a30d)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 3px 10px rgba(163,230,53,0.3)", flexShrink:0,
            }}>
              <Zap size={11} color="#060e02" strokeWidth={2.5} />
            </div>
            <span style={{
              fontFamily:"var(--fd)", fontSize:15, fontWeight:800, letterSpacing:"-0.04em",
              background:"linear-gradient(135deg,#c8f564 0%,#a3e635 50%,#65a30d 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
            }}>PayWave</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button className="ic-chip" onClick={handleRefresh} title="Refresh"
            style={{ opacity:refreshing ? 0.45 : 1 }}>
            <RefreshCw size={11} style={{ animation:refreshing?"pw-spin 0.8s linear infinite":"none" }} />
          </button>
          <button className="ic-chip" onClick={() => setPage("notifications")}>
            <Bell size={12} />
            {unreadCount > 0 && <div className="notif-pip">{unreadCount > 9 ? "9+" : unreadCount}</div>}
          </button>
        </div>
      </div>

      {/* ── HERO BALANCE CARD ── */}
      <div className="ht-card" style={{
        borderRadius:20, marginBottom:12, position:"relative",
        overflow:"hidden",
        background:"linear-gradient(158deg,#0e1c0a 0%,#0b1509 40%,#060d05 100%)",
        border:"1px solid rgba(163,230,53,0.17)",
      }}>
        {/* Lime top strip */}
        <div style={{
          position:"absolute", top:0, left:0, right:0, height:2,
          background:"linear-gradient(90deg,transparent,#84cc16 25%,#a3e635 50%,#65a30d 80%,transparent)",
        }} />
        {/* Orbs */}
        <div className="ht-orb1" style={{
          position:"absolute", top:-45, right:-35, width:170, height:170,
          borderRadius:"50%",
          background:"radial-gradient(circle,rgba(163,230,53,0.07) 0%,transparent 70%)",
          filter:"blur(24px)", pointerEvents:"none",
        }} />
        <div className="ht-orb2" style={{
          position:"absolute", bottom:-35, left:5, width:130, height:130,
          borderRadius:"50%",
          background:"radial-gradient(circle,rgba(212,168,71,0.06) 0%,transparent 70%)",
          filter:"blur(20px)", pointerEvents:"none",
        }} />
        <div className="ht-sweep" />

        <div style={{ position:"relative", padding:"16px 16px 14px" }}>
          {/* Meta row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{
                width:28, height:28, borderRadius:7,
                background:"linear-gradient(135deg,#a3e635,#65a30d)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"var(--fd)", fontSize:10, fontWeight:800, color:"#060e02",
                flexShrink:0, boxShadow:"0 3px 9px rgba(163,230,53,0.28)",
              }}>{initials[0]||"U"}</div>
              <div>
                <span style={{
                  fontSize:"9px", color:"rgba(163,230,53,0.6)",
                  fontFamily:"var(--fd)", fontWeight:700,
                  letterSpacing:"0.07em", textTransform:"uppercase", display:"block",
                }}>Naira Balance</span>
                <span style={{ fontSize:"8.5px", color:"var(--t3)", display:"block", marginTop:"1px" }}>
                  {displayName}
                </span>
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {/* Live indicator */}
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{
                  width:5, height:5, borderRadius:"50%",
                  background:"#a3e635",
                  boxShadow:"0 0 5px rgba(163,230,53,0.9)",
                  animation:"ht-live 2.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize:"8.5px", color:"rgba(163,230,53,0.5)",
                  fontFamily:"var(--fd)", fontWeight:700, letterSpacing:"0.07em" }}>
                  LIVE
                </span>
              </div>
              {/* Eye toggle */}
              <button onClick={() => setShowBalance(!showBalance)} style={{
                background:"rgba(255,255,255,0.045)",
                border:"1px solid rgba(255,255,255,0.09)",
                borderRadius:6, width:25, height:25,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                color:"var(--t3)", transition:"all .14s",
              }}>
                {showBalance ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            </div>
          </div>

          {/* Balance */}
          <div style={{ marginBottom:12 }}>
            <div style={{
              fontFamily:"var(--fd)", fontSize:36, fontWeight:800,
              letterSpacing:"-0.05em", lineHeight:1, color:"#fff",
              textShadow:showBalance?"0 2px 12px rgba(255,255,255,0.06)":"none",
              WebkitTextStroke:showBalance?"0px":"2px rgba(255,255,255,0.1)",
              transition:"all .28s",
            }}>
              {showBalance ? `₦${fmtNGN(pwBalance)}` : "₦ ••••••"}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:7 }}>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:3,
                padding:"2px 8px", borderRadius:20,
                background:"rgba(163,230,53,0.09)", border:"1px solid rgba(163,230,53,0.18)",
              }}>
                <Zap size={8} color="#a3e635" />
                <span style={{ fontSize:"8.5px", fontWeight:700, color:"rgba(163,230,53,0.75)",
                  letterSpacing:"0.05em", fontFamily:"var(--fd)" }}>ZERO FEES</span>
              </div>
              <button onClick={() => setPage("transactions")} style={{
                background:"transparent", border:"none", cursor:"pointer",
                color:"var(--t3)", fontSize:"10.5px", fontFamily:"var(--fb)",
                display:"flex", alignItems:"center", gap:2, padding:0, transition:"color .14s",
              }}>
                View history <ChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="btn-pair">
            <button className="btn-p" onClick={() => setPage("send")}>
              <Send size={12} /> Send ₦
            </button>
            <button className="btn-dk" onClick={() => setPage("receive")}>
              <Download size={12} /> Receive
            </button>
          </div>
        </div>
      </div>

      {/* ── ANNOUNCE STRIP ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"8px 11px", borderRadius:10,
        background:"rgba(163,230,53,0.04)",
        border:"1px solid rgba(163,230,53,0.09)",
        marginBottom:16,
      }}>
        <div style={{
          width:22, height:22, borderRadius:6, flexShrink:0,
          background:"rgba(163,230,53,0.11)", border:"1px solid rgba(163,230,53,0.18)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <Zap size={10} color="#a3e635" />
        </div>
        <span style={{ fontSize:"10.5px", color:"var(--t2)", fontFamily:"var(--fb)", lineHeight:1.5 }}>
          Send ₦ to any Xeevia user —{" "}
          <strong style={{ color:"var(--lime)" }}>completely free</strong>.
          Only OPay external sends carry a fee.
        </span>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="quick-grid">
        {QUICK.map((item,i) => (
          <button key={i} className="quick-btn" onClick={() => setPage(item.page)}>
            <div className="quick-icon" style={{
              background:item.grad, width:50, height:50,
              boxShadow:`0 7px 20px ${item.glow},0 3px 7px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.14)`,
            }}>
              <item.icon size={21} color="#fff" strokeWidth={1.8} />
            </div>
            <span className="quick-lbl">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div style={{
        background:"rgba(255,255,255,0.016)",
        border:"1px solid rgba(255,255,255,0.052)",
        borderRadius:16, overflow:"hidden", marginBottom:6,
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"11px 13px 10px",
          borderBottom:"1px solid rgba(255,255,255,0.048)",
        }}>
          <div className="xsec-t">Recent Activity</div>
          <button className="xsec-link" onClick={() => setPage("transactions")}>
            View all
          </button>
        </div>

        <div style={{ padding:"9px 11px 11px" }}>
          {/* Loading */}
          {loading && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  height:50, borderRadius:10,
                  background:"rgba(255,255,255,0.025)",
                  animation:`pw-shimmer 1.4s ease-in-out ${i*0.08}s infinite`,
                }} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && recentTxs.length === 0 && (
            <div style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:9, padding:"24px 0", textAlign:"center",
            }}>
              <div style={{
                width:40, height:40, borderRadius:"50%",
                background:"rgba(163,230,53,0.05)",
                border:"1px solid rgba(163,230,53,0.1)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <Wallet size={15} color="rgba(163,230,53,0.4)" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--fd)", fontWeight:700, fontSize:12.5,
                  color:"var(--t3)", marginBottom:2 }}>No transactions yet</div>
                <div style={{ fontSize:11, color:"var(--t4)", lineHeight:1.5 }}>
                  Send or receive ₦ to see activity
                </div>
              </div>
            </div>
          )}

          {/* List */}
          {!loading && recentTxs.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {recentTxs.map((tx, idx) => {
                const Icon    = iconFor(tx.title);
                const isCredit = tx.type === "credit";
                return (
                  <div key={tx.id} className="ht-row xg xg-click"
                    style={{ padding:"9px 11px", animationDelay:`${idx*0.04}s` }}>
                    <div className="tx-row">
                      <div className="tx-left">
                        <div className={`tx-ic ${isCredit ? "cr" : ""}`}>
                          <Icon size={12}
                            color={isCredit ? "var(--lime)" : "rgba(255,255,255,0.36)"}
                            strokeWidth={2.2} />
                        </div>
                        <div>
                          <div className="tx-name">{tx.title}</div>
                          <div className="tx-date">{tx.date}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div className={`tx-amt ${isCredit ? "cr" : ""}`}>
                          {isCredit ? "+" : "−"}₦{fmtNGN(tx.amount)}
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

      <div style={{ height:6 }} />
    </div>
  );
}