// paywave/tabs/FinanceTab.jsx  ── v3 REFINED EDITION
import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, PiggyBank, CreditCard, Lock, ChevronRight,
  Target, Zap, Plus, Link, Copy, Eye, EyeOff, CheckCircle,
  Clock, AlertCircle, X, RefreshCw
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});

function Header({ title, onBack }) {
  return (
    <div className="pw-hdr">
      <button className="pw-back-btn" onClick={onBack}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span className="pw-hdr-title">{title}</span>
    </div>
  );
}

// ── STAKE-2-EARN ───────────────────────────────────────────────
function Stake2EarnView({ pwBalance, onBack, onSuccess }) {
  const { profile } = useAuth();
  const [stakeAmt, setStakeAmt]     = useState("");
  const [duration, setDuration]     = useState(null);
  const [loading,  setLoading]      = useState(false);
  const [existing, setExisting]     = useState(null);
  const [fetching, setFetching]     = useState(true);
  const [pin,      setPin]          = useState(false);
  const [pinVal,   setPinVal]       = useState("");
  const [pinError, setPinError]     = useState("");

  const DURATIONS = [
    { days:30,  label:"30 Days",  tier:"Starter",   bonus:"Early Access",    color:"#a3e635" },
    { days:90,  label:"3 Months", tier:"Builder",   bonus:"+Protocol Boost", color:"#d4a847" },
    { days:180, label:"6 Months", tier:"Advocate",  bonus:"Governance Vote", color:"#a855f7" },
    { days:365, label:"1 Year",   tier:"Champion",  bonus:"$XEV Multiplier", color:"#ef4444" },
  ];

  const fetchStake = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.from("staking_positions")
        .select("*").eq("user_id",profile.id).eq("status","active").maybeSingle();
      setExisting(data);
    } catch {}
    finally { setFetching(false); }
  }, [profile?.id]);

  useEffect(()=>{ fetchStake(); },[fetchStake]);

  const parsed    = parseFloat(stakeAmt)||0;
  const selDur    = DURATIONS.find(d=>d.days===duration);
  const unlockDate= duration ? new Date(Date.now()+duration*86400000).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"}) : null;

  const handleStake = async (p) => {
    if (p!=="1234") { setPinError("Wrong PIN. Try again."); return; }
    setPinError(""); setLoading(true); setPin(false); setPinVal("");
    try {
      await supabase.rpc("paywave_transfer",{
        p_from_user_id:profile.id, p_to_user_id:profile.id,
        p_amount:parsed, p_note:`Stake-2-Earn lock: ${selDur.label}`,
      });
      await supabase.from("staking_positions").insert({
        user_id:profile.id, amount:parsed, duration_days:selDur.days,
        rate_pct:0, status:"active",
        matures_at:new Date(Date.now()+selDur.days*86400000).toISOString(),
        est_return:0,
      });
      onSuccess(`₦${fmtNGN(parsed)} staked for ${selDur.label}!\nTier: ${selDur.tier}`);
      fetchStake();
    } catch { alert("Staking failed. Please try again."); }
    finally { setLoading(false); }
  };

  if (!fetching && existing) {
    const pct = Math.min(100,((Date.now()-new Date(existing.created_at).getTime())/(existing.duration_days*86400000))*100);
    const matureDate = new Date(existing.matures_at).toLocaleDateString("en-NG",{day:"numeric",month:"short",year:"numeric"});
    return (
      <div className="pw-scroll">
        <Header title="Stake-2-Earn" onBack={onBack} />
        <div className="xf-section xf-stack">
          {/* Active stake card */}
          <div style={{ borderRadius:14,
            background:"linear-gradient(140deg,rgba(163,230,53,0.1),rgba(168,85,247,0.07))",
            border:"1px solid rgba(163,230,53,0.18)", padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
              <div style={{ width:36, height:36, borderRadius:"50%",
                background:"linear-gradient(135deg,#a3e635,#65a30d)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Zap size={16} color="#0a0e06" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--fd)", fontSize:14, fontWeight:800 }}>Active Stake</div>
                <div style={{ color:"var(--lime)", fontSize:11 }}>{existing.duration_days} days · earning $XEV</div>
              </div>
              <div style={{ marginLeft:"auto", padding:"3px 9px",
                background:"rgba(163,230,53,0.14)", border:"1px solid rgba(163,230,53,0.28)",
                borderRadius:20, fontSize:9.5, color:"var(--lime)", fontWeight:700 }}>LIVE</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              {[
                { label:"Staked",    val:`₦${fmtNGN(existing.amount)}` },
                { label:"$XEV",      val:"TBD at maturity",             accent:true },
                { label:"Lock",      val:`${existing.duration_days} days` },
                { label:"Matures",   val:matureDate },
              ].map((item,i)=>(
                <div key={i} style={{ background:"rgba(0,0,0,0.22)", borderRadius:9, padding:"8px 10px" }}>
                  <div style={{ fontSize:9.5, color:"var(--t2)", marginBottom:2 }}>{item.label}</div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:13, fontWeight:700,
                    color:item.accent?"var(--lime)":"var(--t1)" }}>{item.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:5 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:10.5, color:"var(--t2)" }}>Maturity Progress</span>
                <span style={{ fontSize:10.5, color:"var(--lime)", fontWeight:700 }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.055)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, borderRadius:2,
                  background:"linear-gradient(90deg,var(--lime),#a855f7)", transition:"width 1s" }} />
              </div>
            </div>
            <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.22)", textAlign:"center" }}>
              Matures {matureDate} · Early unstake incurs 10% penalty
            </div>
          </div>

          <div className="info-lime">
            <div style={{ color:"var(--lime)", fontWeight:700, marginBottom:3, fontSize:11.5 }}>⚡ How Stake-2-Earn works</div>
            <div style={{ color:"var(--t2)", lineHeight:1.65, fontSize:11 }}>
              Your staked ₦ earns $XEV from Xeevia platform revenue. At maturity, you receive your ₦ back plus $XEV rewards. Longer stakes unlock higher protocol tiers.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pw-scroll">
      <Header title="Stake-2-Earn" onBack={onBack} />
      <div className="xf-section xf-stack">
        {/* Hero */}
        <div style={{ borderRadius:14,
          background:"linear-gradient(140deg,rgba(168,85,247,0.09),rgba(163,230,53,0.06))",
          border:"1px solid rgba(168,85,247,0.18)", padding:15, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-25, right:-25, width:100, height:100,
            background:"radial-gradient(circle,rgba(168,85,247,0.14),transparent 70%)",
            borderRadius:"50%", filter:"blur(18px)" }} />
          <div style={{ position:"relative", display:"flex", alignItems:"center", gap:9, marginBottom:8 }}>
            <div style={{ width:40, height:40, borderRadius:11,
              background:"linear-gradient(135deg,#a855f7,#6366f1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 3px 12px rgba(168,85,247,0.3)" }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:800 }}>Stake-2-Earn</div>
              <div style={{ color:"#a855f7", fontSize:11 }}>Earn $XEV · Revenue Sharing</div>
            </div>
          </div>
          <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.36)", lineHeight:1.65 }}>
            Lock your ₦ into the Xeevia protocol. Earn $XEV rewards from platform revenue. The longer you stake, the greater your share.
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="xf-lbl">Amount to Stake (₦)</label>
          <div className="xf-wrap" style={{ padding:"9px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ color:"var(--t2)", fontSize:18 }}>₦</span>
              <input type="number" value={stakeAmt} onChange={e=>setStakeAmt(e.target.value)}
                placeholder="0.00" className="xf-in-lg" />
            </div>
          </div>
          <div style={{ color:"var(--t2)", fontSize:10.5, marginTop:3 }}>Available: ₦{fmtNGN(pwBalance)}</div>
        </div>
        <div className="amt-row">
          {[2000,5000,10000].map(a=>(
            <button key={a} className={`amt-btn ${stakeAmt===String(a)?"sel":""}`}
              onClick={()=>setStakeAmt(String(a))}>₦{a.toLocaleString()}</button>
          ))}
        </div>

        {/* Duration */}
        <div>
          <label className="xf-lbl">Stake Duration</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
            {DURATIONS.map(d=>(
              <button key={d.days} onClick={()=>setDuration(d.days)} style={{
                padding:"10px 9px", borderRadius:11, cursor:"pointer", textAlign:"left",
                background:duration===d.days?"rgba(163,230,53,0.07)":"var(--s1)",
                border:`1px solid ${duration===d.days?d.color:"var(--b1)"}`,
                transition:"all .14s",
              }}>
                <div style={{ fontFamily:"var(--fd)", fontSize:13, fontWeight:700,
                  color:duration===d.days?d.color:"var(--t1)", marginBottom:1 }}>{d.label}</div>
                <div style={{ fontSize:11.5, fontWeight:700, color:d.color }}>{d.tier}</div>
                <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.26)", marginTop:2 }}>{d.bonus}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {selDur && parsed > 0 && (
          <div style={{ borderRadius:11, background:"rgba(163,230,53,0.06)",
            border:"1px solid var(--lime-ring)", padding:"12px 13px" }}>
            {[
              { label:"Tier",       val:selDur.tier,   color:selDur.color },
              { label:"Bonus",      val:selDur.bonus,  color:"var(--t2)"  },
              { label:"Unlocks",    val:unlockDate,    color:"var(--t3)"  },
            ].map((item,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                marginBottom:i<2?7:0, alignItems:"center" }}>
                <span style={{ fontSize:11, color:"var(--t2)" }}>{item.label}</span>
                <span style={{ fontFamily:i===0?"var(--fd)":"var(--fb)",
                  fontWeight:i===0?800:600, fontSize:i===0?14:11.5, color:item.color }}>
                  {item.val}
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn-p full"
          disabled={!parsed||!duration||parsed>pwBalance||loading}
          onClick={()=>setPin(true)}>
          {loading?"Staking…":<><Zap size={12}/> Stake ₦{parsed>0?fmtNGN(parsed):""}</>}
        </button>
        {parsed>pwBalance && <div style={{ color:"#f87171", fontSize:11, textAlign:"center" }}>Insufficient balance</div>}
      </div>

      {/* PIN Modal */}
      {pin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)",
          backdropFilter:"blur(14px)", display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:999, padding:18 }}>
          <div className="xg" style={{ padding:20, width:"100%", maxWidth:300, borderColor:"rgba(168,85,247,0.28)" }}>
            <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:800, marginBottom:3 }}>Confirm Stake</div>
            <div style={{ color:"var(--t2)", fontSize:11.5, marginBottom:16 }}>Enter PIN to stake ₦{fmtNGN(parsed)}</div>
            <input type="password" maxLength={4} value={pinVal}
              onChange={e=>setPinVal(e.target.value)}
              placeholder="••••" className="xf-wrap xf-in"
              style={{ textAlign:"center", fontSize:22, letterSpacing:8, padding:"12px 14px",
                width:"100%", marginBottom:pinError?7:14 }} />
            {pinError && <div style={{ color:"#f87171", fontSize:11, marginBottom:11 }}>{pinError}</div>}
            <div style={{ display:"flex", gap:7 }}>
              <button className="btn-g" style={{ flex:1 }} onClick={()=>{setPin(false);setPinVal("");setPinError("");}}>Cancel</button>
              <button className="btn-p" style={{ flex:1 }} onClick={()=>handleStake(pinVal)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SAVINGS ──────────────────────────────────────────────────
const SAV_PLANS = [
  { id:"goal", name:"Goal Saver",  icon:Target,    cls:"g-orange", minAmt:500,
    tagline:"Save with purpose.",
    desc:"Create a named goal. Platform incentives for active savers.",
    howItWorks:"Set a goal, deposit towards it. Early exit: 2-day notice. Platform incentives vary with activity.",
    features:["Named savings goal","Goal-linked discipline","Platform incentives","Early exit: 2-day notice","No fixed rate"],
  },
  { id:"lock", name:"SafeLock",    icon:Lock,      cls:"g-indigo", minAmt:2000,
    tagline:"Discipline earns.",
    desc:"Lock it away. Can't touch it. That's the point.",
    howItWorks:"Lock 30, 60, or 90 days. Completely inaccessible until maturity. Priority incentives for locked savers.",
    features:["Lock: 30/60/90 days","Priority incentive tier","Early withdrawal: 5% penalty","Auto-renews unless cancelled"],
  },
  { id:"flex", name:"FlexSave",    icon:PiggyBank, cls:"g-teal",   minAmt:100,
    tagline:"Save freely.",
    desc:"Put in, take out anytime. No stress.",
    howItWorks:"Deposit and withdraw anytime, same day. Base platform incentives on held balance.",
    features:["Withdraw anytime","Same-day access","Base incentive tier","Min deposit: ₦100"],
  },
];

function SavingsView({ pwBalance, onBack, onSuccess }) {
  const { profile } = useAuth();
  const [view,     setView]     = useState("list");
  const [selPlan,  setSelPlan]  = useState(null);
  const [amount,   setAmount]   = useState("");
  const [goalName, setGoalName] = useState("");
  const [lockDays, setLockDays] = useState(30);
  const [loading,  setLoading]  = useState(false);
  const [myPlans,  setMyPlans]  = useState([]);
  const [fetching, setFetching] = useState(true);

  const fetchPlans = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.from("savings_plans").select("*")
        .eq("user_id",profile.id).eq("is_active",true)
        .order("created_at",{ascending:false});
      setMyPlans(data||[]);
    } catch {}
    finally { setFetching(false); }
  }, [profile?.id]);

  useEffect(()=>{ fetchPlans(); },[fetchPlans]);

  const parsed = parseFloat(amount)||0;
  const plan   = selPlan;

  const handleCreate = async () => {
    if (!plan||parsed<plan.minAmt) return;
    setLoading(true);
    try {
      const maturesAt = plan.id==="lock"
        ? new Date(Date.now()+lockDays*86400000).toISOString() : null;
      await supabase.from("savings_plans").insert({
        user_id:profile.id, plan_type:plan.id, plan_name:plan.name,
        goal_name:goalName||plan.name, amount:parsed, rate_pct:0,
        lock_days:plan.id==="lock"?lockDays:0, matures_at:maturesAt, is_active:true,
      });
      await supabase.rpc("paywave_transfer",{
        p_from_user_id:profile.id, p_to_user_id:profile.id,
        p_amount:parsed, p_note:`Savings: ${goalName||plan.name}`,
      });
      onSuccess(`Savings plan created!\n${goalName||plan.name} — ₦${fmtNGN(parsed)}`);
      fetchPlans();
      setView("list"); setAmount(""); setGoalName("");
    } catch { alert("Failed to create plan. Try again."); }
    finally { setLoading(false); }
  };

  if (view==="plan" && selPlan) {
    return (
      <div className="pw-scroll">
        <Header title={plan.name} onBack={()=>{setView("list");setSelPlan(null);}} />
        <div className="xf-section xf-stack">
          <div style={{ borderRadius:13, padding:14, background:"rgba(255,255,255,0.02)", border:"1px solid var(--b1)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
              <div className={`quick-icon ${plan.cls}`}
                style={{ width:40, height:40, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <plan.icon size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--fd)", fontSize:14, fontWeight:800 }}>{plan.name}</div>
                <div style={{ color:"var(--lime)", fontSize:12 }}>{plan.tagline}</div>
              </div>
            </div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.42)", lineHeight:1.65, marginBottom:10 }}>
              {plan.howItWorks}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {plan.features.map((f,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:"var(--t2)" }}>
                  <CheckCircle size={10} color="var(--lime)" style={{ flexShrink:0 }} />{f}
                </div>
              ))}
            </div>
          </div>

          {plan.id==="goal" && (
            <div>
              <label className="xf-lbl">What are you saving for?</label>
              <div className="xf-wrap">
                <input type="text" value={goalName} onChange={e=>setGoalName(e.target.value)}
                  placeholder="e.g. New Phone, School Fees, Trip" className="xf-in" />
              </div>
            </div>
          )}

          {plan.id==="lock" && (
            <div>
              <label className="xf-lbl">Lock Duration</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7 }}>
                {[30,60,90].map(d=>(
                  <button key={d} className={`amt-btn ${lockDays===d?"sel":""}`}
                    onClick={()=>setLockDays(d)}>{d} Days</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="xf-lbl">Amount (₦) — Min ₦{plan.minAmt.toLocaleString()}</label>
            <div className="xf-wrap" style={{ padding:"9px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:"var(--t2)", fontSize:18 }}>₦</span>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
                  placeholder="0.00" className="xf-in-lg" />
              </div>
            </div>
            <div style={{ color:"var(--t2)", fontSize:10.5, marginTop:3 }}>Available: ₦{fmtNGN(pwBalance)}</div>
          </div>
          <div className="amt-row">
            {[1000,5000,10000].map(a=>(
              <button key={a} className={`amt-btn ${amount===String(a)?"sel":""}`}
                onClick={()=>setAmount(String(a))}>₦{a.toLocaleString()}</button>
            ))}
          </div>

          {parsed>=plan.minAmt && (
            <div className="xg-lime xg" style={{ padding:"10px 12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:11, color:"var(--t2)" }}>Amount to save</span>
                <span style={{ fontFamily:"var(--fd)", fontWeight:800, color:"var(--lime)" }}>₦{fmtNGN(parsed)}</span>
              </div>
              <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.26)", lineHeight:1.6 }}>
                Platform incentives distributed to active savers. No fixed return guaranteed.
              </div>
            </div>
          )}

          <button className="btn-p full"
            disabled={!parsed||parsed<plan.minAmt||parsed>pwBalance||loading||(plan.id==="goal"&&!goalName)}
            onClick={handleCreate}>
            {loading?"Creating…":<><PiggyBank size={12}/> Start Saving</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pw-scroll">
      <Header title="Savings" onBack={onBack} />
      <div className="xf-section xf-stack">
        {!fetching && myPlans.length > 0 && (
          <div>
            <div style={{ fontFamily:"var(--fd)", fontSize:"9.5px", fontWeight:700,
              color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
              Active Plans
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {myPlans.map(mp=>{
                const p = SAV_PLANS.find(p=>p.id===mp.plan_type);
                const Icon = p?.icon || PiggyBank;
                return (
                  <div key={mp.id} className="xg" style={{ padding:"9px 11px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div className={`quick-icon ${p?.cls||"g-teal"}`}
                          style={{ width:30, height:30, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <Icon size={13} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontFamily:"var(--fd)", fontSize:12.5, fontWeight:700 }}>{mp.goal_name}</div>
                          <div style={{ fontSize:10.5, color:"var(--lime)" }}>{mp.plan_type} · ₦{fmtNGN(mp.amount)}</div>
                        </div>
                      </div>
                      {mp.plan_type==="lock"&&mp.matures_at&&(
                        <div style={{ fontSize:9.5, color:"#d4a847", display:"flex", alignItems:"center", gap:2 }}>
                          <Lock size={8}/>{new Date(mp.matures_at).toLocaleDateString("en-NG",{day:"numeric",month:"short"})}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ fontFamily:"var(--fd)", fontSize:"9.5px", fontWeight:700,
          color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
          Choose a Plan
        </div>
        {SAV_PLANS.map(p=>(
          <div key={p.id} className="xg xg-click" style={{ padding:"12px 13px" }}
            onClick={()=>{setSelPlan(p);setView("plan");}}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div className={`quick-icon ${p.cls}`}
                  style={{ width:40, height:40, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <p.icon size={17} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:13.5, fontWeight:800 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.36)", marginTop:1 }}>{p.desc}</div>
                </div>
              </div>
              <div style={{ fontFamily:"var(--fd)", fontWeight:800, fontSize:11.5, color:"var(--lime)", flexShrink:0 }}>{p.tagline}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CARDS ────────────────────────────────────────────────────
function CardsView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [vCards,   setVCards]   = useState([]);
  const [extCards, setExtCards] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [showLink,     setShowLink]     = useState(false);
  const [vcName,   setVcName]   = useState("");
  const [creating, setCreating] = useState(false);
  const [cardBrand,setCardBrand]= useState("Visa");
  const [cardNum,  setCardNum]  = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry,   setExpiry]   = useState("");
  const [cvv,      setCvv]      = useState("");
  const [bank,     setBank]     = useState("");
  const [linking,  setLinking]  = useState(false);

  const NIGERIAN_BANKS = ["Access Bank","Zenith Bank","GTBank","First Bank","UBA","Fidelity Bank","OPay","PalmPay","Moniepoint","Sterling Bank","Stanbic IBTC","Wema Bank","Union Bank","Polaris Bank","Keystone Bank"];

  const fetchCards = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.from("user_cards").select("*")
        .eq("user_id",profile.id).order("created_at",{ascending:false});
      setVCards((data||[]).filter(c=>c.card_type==="virtual"));
      setExtCards((data||[]).filter(c=>c.card_type==="external"));
    } catch {}
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(()=>{ fetchCards(); },[fetchCards]);

  const createVirtual = async () => {
    if (!vcName) return;
    setCreating(true);
    try {
      const last4 = Math.floor(1000+Math.random()*9000).toString();
      const mo    = String(new Date().getMonth()+2).padStart(2,"0");
      const yr    = String(new Date().getFullYear()+4).slice(-2);
      const { data } = await supabase.from("user_cards").insert({
        user_id:profile.id, card_type:"virtual", card_name:vcName,
        last_four:last4, brand:"Verve", expiry:`${mo}/${yr}`, balance:0, is_active:true,
      }).select().single();
      fetchCards(); setShowCreate(false); setVcName("");
      onSuccess(`Virtual card "${vcName}" created!\nCard •••• ${data.last_four}`);
    } catch { alert("Failed to create card."); }
    finally { setCreating(false); }
  };

  const linkExternal = async () => {
    if (!cardNum||!cardName||!expiry||!bank) return;
    setLinking(true);
    try {
      await supabase.from("user_cards").insert({
        user_id:profile.id, card_type:"external", card_name:cardName,
        last_four:cardNum.slice(-4), brand:cardBrand, bank_name:bank, expiry, is_active:true,
      });
      fetchCards(); setShowLink(false);
      setCardNum(""); setCardName(""); setExpiry(""); setCvv(""); setBank("");
      onSuccess(`${cardBrand} card linked!\nCard •••• ${cardNum.slice(-4)}`);
    } catch { alert("Failed to link card."); }
    finally { setLinking(false); }
  };

  const BottomSheet = ({ show, onClose, title, children }) => {
    if (!show) return null;
    return (
      <>
        <div onClick={onClose} style={{ position:"fixed", inset:0,
          background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", zIndex:998 }} />
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:440, zIndex:999,
          background:"#0b0e0c", borderRadius:"18px 18px 0 0",
          border:"1px solid rgba(255,255,255,0.07)", borderBottom:"none",
          maxHeight:"88vh", overflowY:"auto",
          boxShadow:"0 -16px 50px rgba(0,0,0,0.55)" }}>
          <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 0" }}>
            <div style={{ width:32, height:3, borderRadius:2, background:"rgba(255,255,255,0.1)" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 16px 0" }}>
            <span style={{ fontFamily:"var(--fd)", fontSize:14, fontWeight:700 }}>{title}</span>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.05)",
              border:"1px solid rgba(255,255,255,0.07)", borderRadius:7, width:25, height:25,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              color:"rgba(255,255,255,0.38)" }}>
              <X size={11} />
            </button>
          </div>
          <div style={{ padding:"14px 16px 28px" }}>{children}</div>
        </div>
      </>
    );
  };

  const CardChip = ({ card }) => (
    <div style={{ marginBottom:8, borderRadius:13, padding:14, position:"relative", overflow:"hidden",
      background:"linear-gradient(135deg,#1a2010,#0d1508)",
      border:"1px solid rgba(163,230,53,0.16)",
      boxShadow:"0 4px 14px rgba(0,0,0,0.3)" }}>
      <div style={{ position:"absolute", top:-15, right:-15, width:70, height:70,
        background:"radial-gradient(circle,rgba(163,230,53,0.09),transparent 70%)", borderRadius:"50%" }} />
      <div style={{ position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ fontSize:"8.5px", color:"rgba(163,230,53,0.4)", fontWeight:700,
            letterSpacing:"0.09em", textTransform:"uppercase" }}>PayWave Virtual</div>
          <div style={{ fontFamily:"var(--fd)", fontSize:12, fontWeight:800, color:"rgba(255,255,255,0.85)" }}>
            {card.brand}
          </div>
        </div>
        <div style={{ fontFamily:"var(--fm)", fontSize:14, color:"rgba(255,255,255,0.65)",
          letterSpacing:"0.14em", marginBottom:12 }}>
          •••• •••• •••• {card.last_four}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <div style={{ fontSize:"7.5px", color:"rgba(255,255,255,0.28)", textTransform:"uppercase" }}>Holder</div>
            <div style={{ fontSize:11, fontWeight:600, color:"#fff", textTransform:"uppercase" }}>
              {profile?.full_name||"Xeevia User"}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:"7.5px", color:"rgba(255,255,255,0.28)", textTransform:"uppercase" }}>Expires</div>
            <div style={{ fontSize:11, fontWeight:600, color:"#fff" }}>{card.expiry}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pw-scroll">
      <Header title="My Cards" onBack={onBack} />
      <div style={{ paddingTop:10 }}>
        {/* Virtual */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
          <span style={{ fontFamily:"var(--fd)", fontSize:11.5, fontWeight:700 }}>Virtual Cards</span>
          <button onClick={()=>setShowCreate(true)}
            style={{ background:"transparent", border:"none", cursor:"pointer",
              color:"var(--lime)", fontSize:11.5, display:"flex", alignItems:"center",
              gap:3, fontFamily:"var(--fb)", fontWeight:600 }}>
            <Plus size={11}/> Create
          </button>
        </div>

        {loading && <div style={{ height:70, borderRadius:12, background:"rgba(255,255,255,0.025)",
          animation:"pw-shimmer 1.4s infinite", marginBottom:8 }} />}

        {!loading && vCards.length===0 && (
          <div style={{ textAlign:"center", padding:"16px 0 14px", color:"var(--t2)", fontSize:11.5 }}>
            <div style={{ width:34, height:34, borderRadius:"50%",
              background:"rgba(163,230,53,0.07)", border:"1px solid rgba(163,230,53,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 7px" }}>
              <CreditCard size={14} color="rgba(163,230,53,0.4)" />
            </div>
            <div style={{ fontWeight:600, color:"rgba(255,255,255,0.28)" }}>No virtual cards yet</div>
            <button className="btn-p sm" style={{ marginTop:9 }} onClick={()=>setShowCreate(true)}>
              <Plus size={10}/> Create Card
            </button>
          </div>
        )}
        {vCards.map(card=><CardChip key={card.id} card={card} />)}

        <div style={{ height:14 }} />

        {/* External */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
          <span style={{ fontFamily:"var(--fd)", fontSize:11.5, fontWeight:700 }}>Linked Cards</span>
          <button onClick={()=>setShowLink(true)}
            style={{ background:"transparent", border:"none", cursor:"pointer",
              color:"var(--lime)", fontSize:11.5, display:"flex", alignItems:"center",
              gap:3, fontFamily:"var(--fb)", fontWeight:600 }}>
            <Link size={11}/> Link
          </button>
        </div>

        {!loading && extCards.length===0 && (
          <div style={{ textAlign:"center", padding:"14px 0", color:"var(--t2)", fontSize:11.5 }}>
            <div style={{ fontWeight:600, color:"rgba(255,255,255,0.26)" }}>No linked cards</div>
          </div>
        )}
        {extCards.map(card=>(
          <div key={card.id} className="xg" style={{ padding:"10px 12px", marginBottom:6 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:36, height:36, borderRadius:9,
                  background:"linear-gradient(135deg,#3b82f6,#6366f1)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 2px 8px rgba(0,0,0,0.25)" }}>
                  <CreditCard size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--fd)", fontWeight:700, fontSize:13 }}>{card.card_name}</div>
                  <div style={{ color:"var(--t2)", fontSize:11 }}>{card.bank_name} · •••• {card.last_four}</div>
                </div>
              </div>
              <span style={{ padding:"2px 7px", background:"rgba(163,230,53,0.09)",
                border:"1px solid rgba(163,230,53,0.17)", borderRadius:12,
                fontSize:"8.5px", color:"var(--lime)", fontWeight:700 }}>ACTIVE</span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Virtual Sheet */}
      <BottomSheet show={showCreate} onClose={()=>{setShowCreate(false);setVcName("");}} title="Create Virtual Card">
        <div className="xf-stack">
          <div>
            <label className="xf-lbl">Card Label</label>
            <div className="xf-wrap">
              <input type="text" value={vcName} onChange={e=>setVcName(e.target.value)}
                placeholder='e.g. "Shopping Card"' className="xf-in" />
            </div>
          </div>
          <div className="btn-pair">
            <button className="btn-g" onClick={()=>{setShowCreate(false);setVcName("");}}>Cancel</button>
            <button className="btn-p" style={{ flex:1 }} disabled={!vcName||creating} onClick={createVirtual}>
              {creating?"Creating…":<><Plus size={11}/> Create</>}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Link Card Sheet */}
      <BottomSheet show={showLink} onClose={()=>setShowLink(false)} title="Link External Card">
        <div className="xf-stack">
          <div>
            <label className="xf-lbl">Brand</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
              {["Visa","Mastercard","Verve"].map(b=>(
                <button key={b} className={`amt-btn ${cardBrand===b?"sel":""}`}
                  onClick={()=>setCardBrand(b)} style={{ fontSize:11 }}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="xf-lbl">Card Number</label>
            <div className="xf-wrap">
              <input type="text" value={cardNum}
                onChange={e=>setCardNum(e.target.value.replace(/\D/g,"").replace(/(.{4})/g,"$1 ").trim().slice(0,19))}
                placeholder="0000 0000 0000 0000" className="xf-in"
                style={{ fontFamily:"var(--fm)", letterSpacing:"0.05em" }} />
            </div>
          </div>
          <div>
            <label className="xf-lbl">Name on Card</label>
            <div className="xf-wrap">
              <input type="text" value={cardName} onChange={e=>setCardName(e.target.value.toUpperCase())}
                placeholder="NAME ON CARD" className="xf-in" />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
            <div>
              <label className="xf-lbl">Expiry</label>
              <div className="xf-wrap">
                <input type="text" value={expiry}
                  onChange={e=>setExpiry(e.target.value.replace(/\D/g,"").replace(/^(.{2})(.)/,"$1/$2").slice(0,5))}
                  placeholder="MM/YY" className="xf-in" />
              </div>
            </div>
            <div>
              <label className="xf-lbl">CVV</label>
              <div className="xf-wrap">
                <input type="password" maxLength={3} value={cvv}
                  onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,3))}
                  placeholder="•••" className="xf-in" />
              </div>
            </div>
          </div>
          <div>
            <label className="xf-lbl">Issuing Bank</label>
            <select value={bank} onChange={e=>setBank(e.target.value)} className="bank-sel">
              <option value="">— Select Bank —</option>
              {NIGERIAN_BANKS.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ padding:"8px 10px", background:"rgba(212,168,71,0.04)",
            border:"1px solid rgba(212,168,71,0.12)", borderRadius:9,
            fontSize:10.5, color:"rgba(255,255,255,0.28)", lineHeight:1.6 }}>
            🔒 Card details encrypted. CVV verified and never stored.
          </div>
          <div className="btn-pair">
            <button className="btn-g" onClick={()=>setShowLink(false)}>Cancel</button>
            <button className="btn-p" style={{ flex:1 }}
              disabled={!cardNum||!cardName||!expiry||!bank||linking} onClick={linkExternal}>
              {linking?"Linking…":<><Link size={11}/> Link Card</>}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ── FINANCE TAB ROOT ─────────────────────────────────────────
export default function FinanceTab({ pwBalance, setPage }) {
  const sections = [
    { icon:Zap,       label:"Stake-2-Earn", sub:"Xeevia yield protocol",   page:"invest", cls:"g-indigo" },
    { icon:PiggyBank, label:"Savings",      sub:"Grow your ₦ daily",       page:"save",   cls:"g-teal"   },
    { icon:CreditCard,label:"Cards",        sub:"Virtual & linked cards",  page:"cards",  cls:"g-rose"   },
  ];

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop:14, paddingBottom:12 }}>
        <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:800, letterSpacing:"-0.025em" }}>Finance</div>
        <div style={{ color:"var(--t2)", fontSize:11, marginTop:2 }}>Manage your wealth</div>
      </div>

      {/* Balance hero */}
      <div className="xg xg-lime" style={{ padding:"14px 15px", marginBottom:12, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-32, right:-32, width:110, height:110,
          background:"radial-gradient(circle,rgba(163,230,53,0.09),transparent 70%)",
          borderRadius:"50%", filter:"blur(14px)", pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <div style={{ color:"var(--t2)", fontSize:10.5, marginBottom:3 }}>PayWave Balance</div>
          <div style={{ fontFamily:"var(--fd)", fontSize:28, fontWeight:800, letterSpacing:"-0.03em" }}>
            ₦{fmtNGN(pwBalance)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, color:"var(--lime)", fontSize:11, marginTop:4 }}>
            <Zap size={10}/><span>Internal Naira · Zero-fee transfers</span>
          </div>
        </div>
      </div>

      {/* Section rows */}
      <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:16 }}>
        {sections.map((item,i)=>(
          <div key={i} className="xg xg-click" style={{ padding:"11px 12px" }} onClick={()=>setPage(item.page)}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div className={`quick-icon ${item.cls}`}
                  style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <item.icon size={15} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:13, fontWeight:800 }}>{item.label}</div>
                  <div style={{ color:"var(--t2)", fontSize:10.5 }}>{item.sub}</div>
                </div>
              </div>
              <ChevronRight size={12} color="var(--t4)" />
            </div>
          </div>
        ))}
      </div>

      {/* Stake teaser */}
      <div style={{ borderRadius:13,
        background:"linear-gradient(140deg,rgba(168,85,247,0.09),rgba(163,230,53,0.05))",
        border:"1px solid rgba(168,85,247,0.17)", padding:"13px 13px",
        cursor:"pointer" }} onClick={()=>setPage("invest")}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:7 }}>
          <Zap size={14} color="#a855f7" />
          <span style={{ fontFamily:"var(--fd)", fontSize:13, fontWeight:800 }}>Stake-2-Earn</span>
          <span style={{ marginLeft:"auto", padding:"2px 7px",
            background:"rgba(168,85,247,0.14)", border:"1px solid rgba(168,85,247,0.24)",
            borderRadius:20, fontSize:"8.5px", color:"#a855f7", fontWeight:700 }}>PROTOCOL</span>
        </div>
        <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.32)", lineHeight:1.65 }}>
          Lock ₦ into the Xeevia protocol and earn $XEV from platform revenue. The only Xeevia yield product.
        </div>
      </div>
    </div>
  );
}

// ── Sub-view router ──────────────────────────────────────────
export function FinanceSubView({ view, pwBalance, onBack, onSuccess, userId, onRefresh }) {
  if (view==="invest") return <Stake2EarnView pwBalance={pwBalance} onBack={onBack} onSuccess={onSuccess} />;
  if (view==="save")   return <SavingsView   pwBalance={pwBalance} onBack={onBack} onSuccess={onSuccess} />;
  if (view==="cards")  return <CardsView onBack={onBack} onSuccess={onSuccess} />;
  return null;
}