// paywave/tabs/NotificationsTab.jsx  ── v3 REFINED EDITION
import React, { useState, useEffect, useCallback, memo } from "react";
import {
  Bell, CheckCheck, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Shield, Zap, PiggyBank,
  CreditCard, GraduationCap, Smartphone,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

export const PW_NOTIF_TYPES = {
  transfer_sent:      { Icon:ArrowUpRight,  color:"#f87171", bg:"rgba(248,113,113,0.11)", label:"Sent"        },
  transfer_received:  { Icon:ArrowDownLeft, color:"#a3e635", bg:"rgba(163,230,53,0.11)",  label:"Received"    },
  deposit:            { Icon:ArrowDownLeft, color:"#a3e635", bg:"rgba(163,230,53,0.11)",  label:"Deposit"     },
  withdrawal:         { Icon:ArrowUpRight,  color:"#d4a847", bg:"rgba(212,168,71,0.11)",  label:"Withdrawal"  },
  security_alert:     { Icon:Shield,        color:"#ef4444", bg:"rgba(239,68,68,0.12)",   label:"Security"    },
  stake_update:       { Icon:Zap,           color:"#a855f7", bg:"rgba(168,85,247,0.11)",  label:"Stake"       },
  savings_update:     { Icon:PiggyBank,     color:"#60a5fa", bg:"rgba(96,165,250,0.11)",  label:"Savings"     },
  card_activity:      { Icon:CreditCard,    color:"#f59e0b", bg:"rgba(245,158,11,0.11)",  label:"Card"        },
  scholarship_update: { Icon:GraduationCap, color:"#10b981", bg:"rgba(16,185,129,0.11)",  label:"Scholarship" },
  bill_payment:       { Icon:Smartphone,    color:"#8b5cf6", bg:"rgba(139,92,246,0.11)",  label:"Bills"       },
};

const FILTER_TABS = [
  { id:"all",      label:"All",       types:null },
  { id:"transfer", label:"Transfers", types:["transfer_sent","transfer_received"] },
  { id:"money",    label:"Money",     types:["deposit","withdrawal","stake_update","savings_update","scholarship_update"] },
  { id:"security", label:"Security",  types:["security_alert"] },
  { id:"services", label:"Services",  types:["card_activity","bill_payment"] },
];

const EMPTY = {
  all:      { emoji:"🔔", title:"No notifications yet",     hint:"Transfers and alerts appear here" },
  transfer: { emoji:"↕️",  title:"No transfers yet",          hint:"Send or receive ₦ to see activity" },
  money:    { emoji:"💰", title:"No money activity",         hint:"Deposits and stakes appear here" },
  security: { emoji:"🛡️", title:"All clear",                 hint:"Security events show here" },
  services: { emoji:"⚡", title:"No service activity",       hint:"Card and bill events appear here" },
};

export async function createPayWaveNotif({ userId, pwType, title, body="" }) {
  if (!userId||!pwType||!title) return;
  try {
    await supabase.from("notifications").insert({
      recipient_user_id:userId,
      actor_user_id:userId,
      type:"payment_confirmed",
      message:body?`${title}\n${body}`:title,
      is_read:false,
      metadata:{ category:"paywave", pw_type:pwType },
    });
  } catch(err) { console.warn("[PayWave] notif insert failed:",err?.message); }
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d>0) return `${d}d`;
  if (h>0) return `${h}h`;
  if (m>1) return `${m}m`;
  return "Now";
}

const TypeBadge = memo(({ pwType }) => {
  const def = PW_NOTIF_TYPES[pwType] || { Icon:Bell, color:"#6b7280", bg:"rgba(255,255,255,0.07)" };
  const { Icon, color, bg } = def;
  return (
    <div style={{
      width:36, height:36, borderRadius:"50%", flexShrink:0,
      background:bg, border:`1px solid ${color}33`,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <Icon size={15} color={color} strokeWidth={2.2} />
    </div>
  );
});
TypeBadge.displayName = "TypeBadge";

const NotifCard = memo(({ notif, onRead }) => {
  const pwType = notif.metadata?.pw_type;
  const def    = PW_NOTIF_TYPES[pwType] || {};
  const lines  = (notif.message||"").split("\n");
  const title  = lines[0] || "PayWave Notification";
  const body   = lines.slice(1).join(" ").trim();
  const unread = !notif.is_read;

  return (
    <div
      onClick={() => unread && onRead(notif.id)}
      style={{
        position:"relative",
        display:"flex", alignItems:"flex-start", gap:9,
        padding:"10px 11px 9px",
        borderRadius:11, marginBottom:4,
        background:unread?"rgba(163,230,53,0.035)":"rgba(255,255,255,0.015)",
        border:`1px solid ${unread?"rgba(163,230,53,0.15)":"rgba(255,255,255,0.048)"}`,
        cursor:"pointer", transition:"background .14s, border-color .14s",
        overflow:"hidden",
      }}>
      {unread && (
        <div style={{
          position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
          width:2.5, height:"50%", minHeight:16,
          background:"linear-gradient(180deg,#a3e635,#65a30d)",
          borderRadius:"0 2px 2px 0",
        }} />
      )}
      <TypeBadge pwType={pwType} />
      <div style={{ flex:1, minWidth:0, paddingLeft:unread?2:0 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:5, marginBottom:2 }}>
          <div style={{
            fontFamily:"var(--fm)", fontSize:12, lineHeight:1.4,
            fontWeight:unread?700:400,
            color:unread?"var(--t1)":"var(--t2)",
          }}>{title}</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, marginTop:1 }}>
            {unread && (
              <div style={{ width:5.5, height:5.5, borderRadius:"50%",
                background:"#a3e635", boxShadow:"0 0 5px rgba(163,230,53,0.65)" }} />
            )}
            <span style={{ fontSize:"9.5px", color:"var(--t4)" }}>{timeAgo(notif.created_at)}</span>
          </div>
        </div>
        {body && (
          <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.5, marginBottom:4, wordBreak:"break-word" }}>
            {body}
          </div>
        )}
        {def.label && (
          <span style={{
            padding:"1.5px 7px", borderRadius:20, fontSize:"9px", fontWeight:700,
            background:def.bg||"rgba(255,255,255,0.05)",
            border:`1px solid ${(def.color||"#555")}2a`,
            color:def.color||"#888",
          }}>{def.label}</span>
        )}
      </div>
    </div>
  );
});
NotifCard.displayName = "NotifCard";

function SkeletonLoader() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, padding:"4px 0" }}>
      {[1,2,3,4,5].map(i=>(
        <div key={i} style={{ height:64, borderRadius:11,
          background:"rgba(255,255,255,0.02)",
          animation:`pw-shimmer 1.4s ease-in-out ${i*0.06}s infinite` }} />
      ))}
    </div>
  );
}

function EmptyState({ filter }) {
  const m = EMPTY[filter] || EMPTY.all;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      padding:"48px 20px", textAlign:"center", gap:9 }}>
      <div style={{ fontSize:36, opacity:.1, filter:"grayscale(1)" }}>{m.emoji}</div>
      <div style={{ fontFamily:"var(--fm)", fontSize:12.5, fontWeight:700, color:"var(--t3)" }}>{m.title}</div>
      <div style={{ fontSize:11, color:"var(--t4)", lineHeight:1.65, maxWidth:220 }}>{m.hint}</div>
    </div>
  );
}

export default function NotificationsTab() {
  const { profile } = useAuth();
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = useCallback(async (quiet=false) => {
    if (!profile?.id) return;
    if (!quiet) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications").select("id,message,is_read,created_at,metadata")
        .eq("recipient_user_id",profile.id)
        .contains("metadata",{category:"paywave"})
        .order("created_at",{ascending:false}).limit(100);
      if (!error) setNotifs(data||[]);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [profile?.id]);

  useEffect(()=>{ fetchNotifs(); },[fetchNotifs]);

  useEffect(()=>{
    if (!profile?.id) return;
    const ch = supabase.channel(`pw-notifs:${profile.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",
        filter:`recipient_user_id=eq.${profile.id}`},
        payload=>{
          if (payload.new?.metadata?.category==="paywave")
            setNotifs(prev=>[payload.new,...prev]);
        }).subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[profile?.id]);

  const markRead = useCallback(async id=>{
    await supabase.from("notifications").update({is_read:true}).eq("id",id);
    setNotifs(prev=>prev.map(n=>n.id===id?{...n,is_read:true}:n));
  },[]);

  const markAll = useCallback(async()=>{
    const ids = notifs.filter(n=>!n.is_read).map(n=>n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({is_read:true}).in("id",ids);
    setNotifs(prev=>prev.map(n=>({...n,is_read:true})));
  },[notifs]);

  const refresh = useCallback(async()=>{ setRefreshing(true); await fetchNotifs(true); },[fetchNotifs]);

  const unread = notifs.filter(n=>!n.is_read).length;

  const tabCounts = Object.fromEntries(
    FILTER_TABS.map(t=>[t.id,
      t.types ? notifs.filter(n=>!n.is_read&&t.types.includes(n.metadata?.pw_type)).length : unread
    ])
  );

  const filtered = filter==="all" ? notifs
    : notifs.filter(n=>(FILTER_TABS.find(t=>t.id===filter)?.types||[]).includes(n.metadata?.pw_type));

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg)" }}>
      {/* Header */}
      <div style={{ padding:"0 var(--px)", borderBottom:"1px solid var(--b1)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"var(--hdr-h)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <Bell size={13} color="#a3e635" />
            <span style={{ fontFamily:"var(--fd)", fontSize:14, fontWeight:700 }}>Notifications</span>
            {unread > 0 && (
              <span style={{ padding:"1.5px 7px",
                background:"rgba(163,230,53,0.1)", border:"1px solid rgba(163,230,53,0.25)",
                borderRadius:20, fontSize:"9px", fontWeight:700, color:"#a3e635" }}>
                {unread>99?"99+":unread}
              </span>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            {unread > 0 && (
              <button onClick={markAll} style={{
                display:"flex", alignItems:"center", gap:3, padding:"4px 9px",
                background:"rgba(163,230,53,0.07)", border:"1px solid rgba(163,230,53,0.18)",
                borderRadius:7, color:"#a3e635", fontSize:"10.5px", fontWeight:600, cursor:"pointer",
              }}>
                <CheckCheck size={10} /> Read all
              </button>
            )}
            <button onClick={refresh} style={{
              width:26, height:26, borderRadius:7,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.065)",
              color:"var(--t3)", cursor:"pointer",
            }}>
              <RefreshCw size={10} style={{ animation:refreshing?"pw-spin 0.7s linear infinite":"none" }} />
            </button>
          </div>
        </div>

        {/* Filter strip */}
        <div style={{ display:"flex", gap:4, paddingBottom:9, overflowX:"auto", scrollbarWidth:"none" }}>
          {FILTER_TABS.map(tab=>{
            const cnt = tabCounts[tab.id]||0;
            const on  = filter===tab.id;
            return (
              <button key={tab.id} onClick={()=>setFilter(tab.id)} style={{
                display:"flex", alignItems:"center", gap:4,
                flexShrink:0, padding:"4px 10px",
                borderRadius:20, fontSize:"10.5px", fontWeight:600, cursor:"pointer",
                transition:"all .13s",
                background:on?"rgba(163,230,53,0.1)":"rgba(255,255,255,0.035)",
                border:`1px solid ${on?"rgba(163,230,53,0.28)":"rgba(255,255,255,0.065)"}`,
                color:on?"#a3e635":"var(--t3)",
              }}>
                {tab.label}
                {cnt>0 && (
                  <span style={{ padding:"0.5px 4px", borderRadius:10, fontSize:"8.5px", fontWeight:700,
                    background:on?"rgba(163,230,53,0.22)":"rgba(255,255,255,0.08)",
                    color:on?"#a3e635":"var(--t3)" }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px var(--px2) 20px", scrollbarWidth:"none" }}>
        {loading ? <SkeletonLoader />
          : filtered.length===0 ? <EmptyState filter={filter} />
          : filtered.map(n=><NotifCard key={n.id} notif={n} onRead={markRead} />)
        }
      </div>
    </div>
  );
}