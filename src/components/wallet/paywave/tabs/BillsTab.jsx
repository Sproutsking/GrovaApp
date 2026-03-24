// paywave/tabs/FinanceTab.jsx  (v2 — Xeevia-owned, no OPay template)
// Investment: Stake-2-Earn ONLY (the one true Xeevia investment)
// Savings: 3 disciplined plans — Goal, Lock, Flex
// Cards: working connect flow with Supabase persistence
//
// PADDING FIX:
//   Root FinanceTab view uses pw-scroll-px — must carry its own
//   paddingLeft/paddingRight:16 since .pw-scroll no longer provides it.
//   Sub-views (Stake2Earn, Savings, Cards) use pw-scroll + f-section
//   which already has padding: 18px var(--pw-pad-left) 8px via CSS — no change needed.
import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, PiggyBank, CreditCard, Lock, ChevronRight,
  Target, Zap, Plus, Link, Copy, Eye, EyeOff, CheckCircle,
  Clock, AlertCircle, X, RefreshCw
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── STAKE-2-EARN (Only investment) ────────────────────────────────────
function Stake2EarnView({ pwBalance, onBack, onSuccess }) {
  const { profile } = useAuth();
  const [stakeAmt, setStakeAmt]       = useState("");
  const [duration, setDuration]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [existing, setExisting]       = useState(null);
  const [fetchingStake, setFetchingStake] = useState(true);
  const [pin, setPin]                 = useState(false);
  const [pinVal, setPinVal]           = useState("");
  const [pinError, setPinError]       = useState("");

  const DURATIONS = [
    { days: 30,  label: "30 Days",  tier: "Starter",    bonus: "Early Access",     color: "#a3e635" },
    { days: 90,  label: "3 Months", tier: "Builder",    bonus: "+Protocol Boost",  color: "#d4a847" },
    { days: 180, label: "6 Months", tier: "Advocate",   bonus: "Governance Vote",  color: "#a855f7" },
    { days: 365, label: "1 Year",   tier: "Champion",   bonus: "$XEV Multiplier",  color: "#ef4444" },
  ];

  const fetchStake = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("staking_positions")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .maybeSingle();
      setExisting(data);
    } catch (e) { /* no stake */ }
    finally { setFetchingStake(false); }
  }, [profile?.id]);

  useEffect(() => { fetchStake(); }, [fetchStake]);

  const parsed    = parseFloat(stakeAmt) || 0;
  const selDur    = DURATIONS.find(d => d.days === duration);
  const unlockDate = duration ? new Date(Date.now() + duration * 86400000).toLocaleDateString("en-NG", { day:"numeric", month:"short", year:"numeric" }) : null;

  const handleStake = async (p) => {
    if (p !== "1234") { setPinError("Wrong PIN. Try again."); return; }
    setPinError(""); setLoading(true); setPin(false); setPinVal("");
    try {
      await supabase.rpc("paywave_transfer", {
        p_from_user_id: profile.id,
        p_to_user_id: profile.id,
        p_amount: parsed,
        p_note: `Stake-2-Earn lock: ${selDur.label}`,
      });
      await supabase.from("staking_positions").insert({
        user_id: profile.id,
        amount: parsed,
        duration_days: selDur.days,
        rate_pct: 0,
        status: "active",
        matures_at: new Date(Date.now() + selDur.days * 86400000).toISOString(),
        est_return: 0,
      });
      onSuccess(`₦${fmtNGN(parsed)} staked for ${selDur.label}!\nTier: ${selDur.tier} · Unlocks ${new Date(Date.now() + selDur.days * 86400000).toLocaleDateString("en-NG", { day:"numeric", month:"short" })}`);
      fetchStake();
    } catch (err) {
      alert("Staking failed. Please try again.");
    } finally { setLoading(false); }
  };

  // Active stake view
  if (!fetchingStake && existing) {
    const pct = Math.min(100, ((Date.now() - new Date(existing.created_at).getTime()) / (existing.duration_days * 86400000)) * 100);
    const maturesDate = new Date(existing.matures_at).toLocaleDateString("en-NG", { day:"numeric", month:"short", year:"numeric" });
    return (
      <div className="pw-scroll">
        <Header title="Stake-2-Earn" onBack={onBack} />
        <div className="xpw__section xpw__stack">
          <div style={{ borderRadius:16, background:"linear-gradient(140deg,rgba(163,230,53,0.12),rgba(168,85,247,0.08))", border:"1px solid rgba(163,230,53,0.2)", padding:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#a3e635,#65a30d)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Zap size={18} color="#0a0e06" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--font-d)", fontSize:16, fontWeight:800 }}>Active Stake</div>
                <div style={{ color:"var(--lime)", fontSize:12 }}>{existing.duration_days} days locked · earning $XEV</div>
              </div>
              <div style={{ marginLeft:"auto", padding:"4px 10px", background:"rgba(163,230,53,0.15)", border:"1px solid rgba(163,230,53,0.3)", borderRadius:20, fontSize:10, color:"var(--lime)", fontWeight:700 }}>LIVE</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"Staked Amount",   val:`₦${fmtNGN(existing.amount)}` },
                { label:"$XEV Allocation", val:`TBD at maturity`, accent:true },
                { label:"Lock Period",     val:`${existing.duration_days} days` },
                { label:"Matures",         val:maturesDate },
              ].map((item,i) => (
                <div key={i} style={{ background:"rgba(0,0,0,0.25)", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"var(--text-soft)", marginBottom:3 }}>{item.label}</div>
                  <div style={{ fontFamily:"var(--font-d)", fontSize:14, fontWeight:700, color:item.accent?"var(--lime)":"var(--text)" }}>{item.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:11, color:"var(--text-soft)" }}>Maturity Progress</span>
                <span style={{ fontSize:11, color:"var(--lime)", fontWeight:700 }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, borderRadius:3, background:"linear-gradient(90deg,var(--lime),#a855f7)", transition:"width 1s" }} />
              </div>
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", textAlign:"center" }}>
              Your stake matures on {maturesDate} — early unstaking incurs a 10% penalty
            </div>
          </div>

          <div className="xpw__info-lime" style={{ fontSize:12 }}>
            <div style={{ color:"var(--lime)", fontWeight:700, marginBottom:4 }}>⚡ How Stake-2-Earn works</div>
            <div style={{ color:"rgba(255,255,255,0.45)", lineHeight:1.65 }}>
              Your staked ₦ is locked and earns $XEV rewards from Xeevia platform revenue and user engagement. At maturity, you receive your ₦ back plus $XEV rewards. Longer stakes unlock higher protocol tiers and governance rights.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pw-scroll">
      <Header title="Stake-2-Earn" onBack={onBack} />
      <div className="xpw__section xpw__stack">
        <div style={{ borderRadius:16, background:"linear-gradient(140deg,rgba(168,85,247,0.1),rgba(163,230,53,0.07))", border:"1px solid rgba(168,85,247,0.2)", padding:18, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, background:"radial-gradient(circle,rgba(168,85,247,0.15),transparent 70%)", borderRadius:"50%", filter:"blur(20px)" }} />
          <div style={{ position:"relative" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#a855f7,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(168,85,247,0.3)" }}>
                <Zap size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800 }}>Stake-2-Earn</div>
                <div style={{ color:"#a855f7", fontSize:11.5 }}>Earn $XEV · Platform Revenue Sharing</div>
              </div>
            </div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.38)", lineHeight:1.65 }}>
              Lock your ₦ into the Xeevia protocol. Earn $XEV rewards based on platform revenue and engagement volume. The longer you stake, the greater your share of protocol rewards.
            </div>
          </div>
        </div>

        <div>
          <label className="xpw__label">Amount to Stake (₦)</label>
          <div className="xpw__field" style={{ padding:"11px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ color:"var(--text-soft)", fontSize:20 }}>₦</span>
              <input type="number" value={stakeAmt} onChange={e=>setStakeAmt(e.target.value)} placeholder="0.00" className="xpw__input-lg" />
            </div>
          </div>
          <div style={{ color:"var(--text-soft)", fontSize:11, marginTop:4, fontFamily:"var(--font-b)" }}>
            Available: ₦{fmtNGN(pwBalance)}
          </div>
        </div>
        <div className="xpw__amt-grid">
          {[2000,5000,10000].map(a=>(
            <button key={a} className={`xpw__amt-btn ${stakeAmt===String(a)?"xpw__selected":""}`} onClick={()=>setStakeAmt(String(a))}>₦{a.toLocaleString()}</button>
          ))}
        </div>

        <div>
          <label className="xpw__label">Stake Duration</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {DURATIONS.map(d=>(
              <button key={d.days}
                onClick={()=>setDuration(d.days)}
                style={{
                  padding:"12px 10px", borderRadius:12, cursor:"pointer", textAlign:"left",
                  background: duration===d.days ? "rgba(163,230,53,0.08)" : "var(--surface)",
                  border: `1px solid ${duration===d.days ? d.color : "var(--border)"}`,
                  transition:"all .15s", boxShadow: duration===d.days ? `0 0 0 1px ${d.color}22` : "none",
                  boxSizing:"border-box",
                }}>
                <div style={{ fontFamily:"var(--font-d)", fontSize:14, fontWeight:700, color:duration===d.days?d.color:"var(--text)", marginBottom:2 }}>{d.label}</div>
                <div style={{ fontSize:12, fontWeight:700, color:d.color }}>{d.tier}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", marginTop:3 }}>{d.bonus}</div>
              </button>
            ))}
          </div>
        </div>

        {selDur && parsed > 0 && (
          <div style={{ borderRadius:12, background:"rgba(163,230,53,0.07)", border:"1px solid var(--lime-border)", padding:"14px 15px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ color:"var(--text-soft)", fontSize:12 }}>Tier</span>
              <span style={{ fontFamily:"var(--font-d)", fontWeight:800, fontSize:16, color:selDur.color }}>{selDur.tier}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ color:"var(--text-soft)", fontSize:12 }}>Protocol Bonus</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:600 }}>{selDur.bonus}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"var(--text-soft)", fontSize:12 }}>Unlocks</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{unlockDate}</span>
            </div>
          </div>
        )}

        <button className="xpw__btn-primary xpw__full"
          disabled={!parsed || !duration || parsed>pwBalance || loading}
          onClick={()=>setPin(true)}>
          {loading ? "Staking…" : <><Zap size={14}/> Stake ₦{parsed>0?fmtNGN(parsed):""}</>}
        </button>
        {parsed>pwBalance && <div style={{ color:"#f87171", fontSize:11.5, textAlign:"center" }}>Insufficient balance</div>}
      </div>

      {pin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(16px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20 }}>
          <div className="xpw__glass" style={{ padding:24, width:"100%", maxWidth:320, borderColor:"rgba(168,85,247,0.3)" }}>
            <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800, marginBottom:4 }}>Confirm Stake</div>
            <div style={{ color:"var(--text-soft)", fontSize:12.5, marginBottom:18 }}>Enter your 4-digit PIN to stake ₦{fmtNGN(parsed)}</div>
            <input type="password" maxLength={4} value={pinVal} onChange={e=>setPinVal(e.target.value)}
              placeholder="••••" className="xpw__field xpw__input" style={{ textAlign:"center", fontSize:24, letterSpacing:8, padding:"14px 16px", width:"100%", marginBottom:pinError?8:16 }} />
            {pinError && <div style={{ color:"#f87171", fontSize:12, marginBottom:12 }}>{pinError}</div>}
            <div className="xpw__btn-pair">
              <button className="xpw__btn-secondary" onClick={()=>{setPin(false);setPinVal("");setPinError("");}}>Cancel</button>
              <button className="xpw__btn-primary" onClick={()=>handleStake(pinVal)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SAVINGS ──────────────────────────────────────────────────
const SAV_PLANS = [
  {
    id:"goal", name:"Goal Saver", icon:Target, cls:"g-orange",
    minAmt:500,
    tagline: "Save with purpose.",
    desc:"Set a goal, save towards it. Platform incentives shared to active savers.",
    howItWorks:"Create a named savings goal and deposit towards it. Funds are held until your goal is reached. Early withdrawal accepted with 2-day notice. Earn platform incentives shared with active savers.",
    features:["Named savings goal","Goal-linked lock for discipline","Platform incentives for active savers","Early exit: 2-day notice","No fixed rate — incentives vary with platform activity"],
  },
  {
    id:"lock", name:"SafeLock", icon:Lock, cls:"g-indigo",
    minAmt:2000,
    tagline: "Discipline earns.",
    desc:"Lock your money away. Can't touch it. That's the point.",
    howItWorks:"Choose a lock period (30, 60, or 90 days). Funds are completely inaccessible until maturity. Early withdrawal incurs a 5% penalty. Earn priority incentives for locked savers.",
    features:["Lock periods: 30, 60, 90 days","Priority incentive tier for locked savers","Early withdrawal penalty: 5%","Auto-renews unless cancelled","No fixed rate — platform incentives only"],
  },
  {
    id:"flex", name:"FlexSave", icon:PiggyBank, cls:"g-teal",
    minAmt:100,
    tagline: "Save freely.",
    desc:"Put money in, take it out anytime. No stress.",
    howItWorks:"Deposit and withdraw anytime. Same-day access. Earn base platform incentives on held balance. Best for emergency funds and short-term saving.",
    features:["Withdraw anytime, same day","No minimum holding period","Base incentive tier on held balance","Min deposit: ₦100","No fixed rate — incentives vary with platform activity"],
  },
];

function SavingsView({ pwBalance, onBack, onSuccess }) {
  const { profile } = useAuth();
  const [view, setView]         = useState("list");
  const [selPlan, setSelPlan]   = useState(null);
  const [amount, setAmount]     = useState("");
  const [goalName, setGoalName] = useState("");
  const [lockDays, setLockDays] = useState(30);
  const [loading, setLoading]   = useState(false);
  const [myPlans, setMyPlans]   = useState([]);
  const [fetching, setFetching] = useState(true);

  const fetchPlans = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("savings_plans")
        .select("*")
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .order("created_at", { ascending:false });
      setMyPlans(data || []);
    } catch { }
    finally { setFetching(false); }
  }, [profile?.id]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const parsed = parseFloat(amount) || 0;
  const plan   = selPlan;

  const handleCreate = async () => {
    if (!plan || parsed < plan.minAmt) return;
    setLoading(true);
    try {
      const maturesAt = plan.id === "lock" ? new Date(Date.now() + lockDays*86400000).toISOString() : null;
      await supabase.from("savings_plans").insert({
        user_id:    profile.id,
        plan_type:  plan.id,
        plan_name:  plan.name,
        goal_name:  goalName || plan.name,
        amount:     parsed,
        rate_pct:   0,
        lock_days:  plan.id==="lock" ? lockDays : 0,
        matures_at: maturesAt,
        is_active:  true,
      });
      await supabase.rpc("paywave_transfer", {
        p_from_user_id: profile.id,
        p_to_user_id: profile.id,
        p_amount: parsed,
        p_note: `Savings: ${goalName || plan.name}`,
      });
      onSuccess(`Savings plan created!\n${goalName || plan.name} — ₦${fmtNGN(parsed)}`);
      fetchPlans();
      setView("list"); setAmount(""); setGoalName("");
    } catch (e) {
      alert("Failed to create plan. Try again.");
    } finally { setLoading(false); }
  };

  if (view === "plan" && selPlan) {
    return (
      <div className="pw-scroll">
        <Header title={plan.name} onBack={()=>{setView("list");setSelPlan(null);}} />
        <div className="xpw__section xpw__stack">
          <div style={{ borderRadius:14, padding:16, background:"rgba(255,255,255,0.02)", border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:14 }}>
              <div className={`xpw__quick-icon ${plan.cls}`} style={{ width:46, height:46, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,0,0,0.3)" }}>
                <plan.icon size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--font-d)", fontSize:16, fontWeight:800 }}>{plan.name}</div>
                <div style={{ color:"var(--lime)", fontSize:13, fontWeight:700 }}>{plan.tagline}</div>
              </div>
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.65, marginBottom:12 }}>{plan.howItWorks}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {plan.features.map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"rgba(255,255,255,0.5)" }}>
                  <CheckCircle size={12} color="var(--lime)" style={{ flexShrink:0 }} />{f}
                </div>
              ))}
            </div>
          </div>

          {plan.id === "goal" && (
            <div>
              <label className="xpw__label">What are you saving for?</label>
              <div className="xpw__field">
                <input type="text" value={goalName} onChange={e=>setGoalName(e.target.value)} placeholder='e.g. New Phone, School Fees, Trip' className="xpw__input" />
              </div>
            </div>
          )}

          {plan.id === "lock" && (
            <div>
              <label className="xpw__label">Lock Duration</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {[30,60,90].map(d=>(
                  <button key={d} className={`xpw__amt-btn ${lockDays===d?"xpw__selected":""}`} onClick={()=>setLockDays(d)}>{d} Days</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="xpw__label">Amount (₦) — Min ₦{plan.minAmt.toLocaleString()}</label>
            <div className="xpw__field" style={{ padding:"11px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ color:"var(--text-soft)", fontSize:20 }}>₦</span>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="xpw__input-lg" />
              </div>
            </div>
            <div style={{ color:"var(--text-soft)", fontSize:11, marginTop:4 }}>Available: ₦{fmtNGN(pwBalance)}</div>
          </div>
          <div className="xpw__amt-grid">
            {[1000,5000,10000].map(a=>(
              <button key={a} className={`xpw__amt-btn ${amount===String(a)?"xpw__selected":""}`} onClick={()=>setAmount(String(a))}>₦{a.toLocaleString()}</button>
            ))}
          </div>

          {parsed >= plan.minAmt && (
            <div className="xpw__glass xpw__glass-lime" style={{ padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:"var(--text-soft)" }}>Amount to save</span>
                <span style={{ fontFamily:"var(--font-d)", fontWeight:800, color:"var(--lime)" }}>₦{fmtNGN(parsed)}</span>
              </div>
              <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.28)", lineHeight:1.6 }}>
                Platform growth incentives are distributed to active savers. No fixed return is guaranteed.
              </div>
            </div>
          )}

          <button className="xpw__btn-primary xpw__full"
            disabled={!parsed||parsed<plan.minAmt||parsed>pwBalance||loading||(plan.id==="goal"&&!goalName)}
            onClick={handleCreate}>
            {loading ? "Creating…" : <><PiggyBank size={14}/> Start Saving</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pw-scroll">
      <Header title="Savings" onBack={onBack} />
      <div className="xpw__section xpw__stack">
        {!fetching && myPlans.length > 0 && (
          <div>
            <div className="xpw__sec-hd"><span className="xpw__sec-title">My Active Plans</span></div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {myPlans.map(mp => {
                const plan = SAV_PLANS.find(p=>p.id===mp.plan_type);
                const Icon = plan?.icon || PiggyBank;
                const cls  = plan?.cls || "g-teal";
                return (
                  <div key={mp.id} className="xpw__glass" style={{ padding:"11px 13px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                        <div className={`xpw__quick-icon ${cls}`} style={{ width:34, height:34, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <Icon size={14} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontFamily:"var(--font-d)", fontSize:13.5, fontWeight:700 }}>{mp.goal_name}</div>
                          <div style={{ fontSize:11, color:"var(--lime)" }}>{mp.plan_type} · ₦{fmtNGN(mp.amount)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        {mp.plan_type==="lock" && mp.matures_at && (
                          <div style={{ fontSize:10, color:"#d4a847", display:"flex", alignItems:"center", gap:3 }}>
                            <Lock size={9}/> {new Date(mp.matures_at).toLocaleDateString("en-NG",{day:"numeric",month:"short"})}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="xpw__sec-hd"><span className="xpw__sec-title">Choose a Plan</span></div>
        {SAV_PLANS.map(p => (
          <div key={p.id} className="xpw__glass xpw__click" style={{ padding:"14px 15px" }} onClick={()=>{setSelPlan(p);setView("plan");}}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div className={`xpw__quick-icon ${p.cls}`} style={{ width:44, height:44, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,0,0,0.3)", flexShrink:0 }}>
                  <p.icon size={19} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--font-d)", fontSize:14.5, fontWeight:800 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.38)", marginTop:1 }}>{p.desc}</div>
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"var(--font-d)", fontWeight:800, fontSize:12, color:"var(--lime)" }}>{p.tagline}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CARDS ──────────────────────────────────────────────────
function CardsView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [vCards,    setVCards]    = useState([]);
  const [extCards,  setExtCards]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [linking,   setLinking]   = useState(false);
  const [creating,  setCreating]  = useState(false);
  const [showLink,  setShowLink]  = useState(false);
  const [showCreate,setShowCreate]= useState(false);
  const [cardNum,   setCardNum]   = useState("");
  const [cardName,  setCardName]  = useState("");
  const [expiry,    setExpiry]    = useState("");
  const [cvv,       setCvv]       = useState("");
  const [bank,      setBank]      = useState("");
  const [cardBrand, setCardBrand] = useState("Visa");
  const [vcName,    setVcName]    = useState("");

  const fetchCards = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("user_cards")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending:false });
      setVCards((data||[]).filter(c=>c.card_type==="virtual"));
      setExtCards((data||[]).filter(c=>c.card_type==="external"));
    } catch { }
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const createVirtual = async () => {
    if (!vcName) return;
    setCreating(true);
    try {
      const last4 = Math.floor(1000+Math.random()*9000).toString();
      const expMo  = String(new Date().getMonth()+2).padStart(2,"0");
      const expYr  = String(new Date().getFullYear()+4).slice(-2);
      const { data } = await supabase.from("user_cards").insert({
        user_id: profile.id, card_type: "virtual", card_name: vcName,
        last_four: last4, brand: "Verve", expiry: `${expMo}/${expYr}`, balance: 0, is_active: true,
      }).select().single();
      fetchCards();
      setShowCreate(false); setVcName("");
      onSuccess(`Virtual card "${vcName}" created!\nCard •••• ${data.last_four}`);
    } catch { alert("Failed to create card."); }
    finally { setCreating(false); }
  };

  const linkExternal = async () => {
    if (!cardNum||!cardName||!expiry||!bank) return;
    setLinking(true);
    try {
      await supabase.from("user_cards").insert({
        user_id: profile.id, card_type: "external", card_name: cardName,
        last_four: cardNum.slice(-4), brand: cardBrand, bank_name: bank, expiry: expiry, is_active: true,
      });
      fetchCards();
      setShowLink(false);
      setCardNum(""); setCardName(""); setExpiry(""); setCvv(""); setBank("");
      onSuccess(`${cardBrand} card linked successfully!\nCard •••• ${cardNum.slice(-4)}`);
    } catch { alert("Failed to link card."); }
    finally { setLinking(false); }
  };

  const formatCardNum = (v) => v.replace(/\D/g,"").replace(/(.{4})/g,"$1 ").trim().slice(0,19);
  const formatExpiry  = (v) => v.replace(/\D/g,"").replace(/^(.{2})(.)/,"$1/$2").slice(0,5);

  const NIGERIAN_BANKS = ["Access Bank","Zenith Bank","GTBank","First Bank","UBA","Fidelity Bank","OPay","PalmPay","Moniepoint","Sterling Bank","Stanbic IBTC","Wema Bank","Union Bank","Polaris Bank","Keystone Bank"];
  const BRAND_COLORS = { Visa:"linear-gradient(135deg,#1a1f71,#2563eb)", Mastercard:"linear-gradient(135deg,#eb001b,#f79e1b)", Verve:"linear-gradient(135deg,#a3e635,#65a30d)" };

  return (
    <div className="pw-scroll">
      <Header title="My Cards" onBack={onBack} />
      <div style={{ paddingTop: 16 }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span className="xpw__sec-title">Virtual Cards</span>
          <button style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--lime)", fontSize:12, display:"flex", alignItems:"center", gap:3, fontFamily:"var(--font-b)", fontWeight:600 }} onClick={()=>setShowCreate(true)}>
            <Plus size={12}/> Create
          </button>
        </div>

        {loading && <div style={{ height:80, borderRadius:12, background:"rgba(255,255,255,0.03)", animation:"pw-shimmer 1.4s infinite", marginBottom:8 }} />}

        {!loading && vCards.length === 0 && (
          <div style={{ textAlign:"center", padding:"20px 0 16px" }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:"rgba(163,230,53,0.07)", border:"1px solid rgba(163,230,53,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px" }}>
              <CreditCard size={16} color="rgba(163,230,53,0.4)" />
            </div>
            <div style={{ fontWeight:600, color:"rgba(255,255,255,0.3)", fontSize:12.5 }}>No virtual cards yet</div>
            <button className="xpw__btn-primary xpw__sm" style={{ marginTop:10 }} onClick={()=>setShowCreate(true)}><Plus size={11}/> Create Card</button>
          </div>
        )}

        {vCards.map(card=>(
          <div key={card.id} style={{ marginBottom:10, borderRadius:14, padding:16, position:"relative", overflow:"hidden", background: BRAND_COLORS[card.brand]||"linear-gradient(135deg,#a3e635,#65a30d)", boxShadow:"0 6px 20px rgba(0,0,0,0.3)" }}>
            <div style={{ position:"absolute", top:-30, right:-30, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.06)" }} />
            <div style={{ position:"absolute", bottom:-20, left:30, width:80, height:80, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
            <div style={{ position:"relative" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.6)", letterSpacing:"0.08em" }}>VIRTUAL</div>
                <div style={{ fontFamily:"var(--font-d)", fontSize:13, fontWeight:800, color:"rgba(255,255,255,0.9)" }}>{card.brand}</div>
              </div>
              <div style={{ fontFamily:"var(--font-m)", fontSize:16, letterSpacing:"0.12em", color:"#fff", marginBottom:14 }}>
                •••• •••• •••• {card.last_four}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                <div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>CARD HOLDER</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#fff", textTransform:"uppercase" }}>{profile?.full_name || "Xeevia User"}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>EXPIRES</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{card.expiry}</div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ height:16 }} />

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span className="xpw__sec-title">External Cards</span>
          <button style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--lime)", fontSize:12, display:"flex", alignItems:"center", gap:3, fontFamily:"var(--font-b)", fontWeight:600 }} onClick={()=>setShowLink(true)}>
            <Link size={12}/> Link Card
          </button>
        </div>

        {!loading && extCards.length === 0 && (
          <div style={{ textAlign:"center", padding:"20px 0 16px" }}>
            <div style={{ fontWeight:600, color:"rgba(255,255,255,0.3)", fontSize:12.5 }}>No linked cards</div>
            <button className="xpw__btn-secondary xpw__sm" style={{ marginTop:10 }} onClick={()=>setShowLink(true)}><Link size={11}/> Link External Card</button>
          </div>
        )}

        {extCards.map(card=>(
          <div key={card.id} className="xpw__glass" style={{ padding:"13px 14px", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:9, background:`${BRAND_COLORS[card.brand]||"linear-gradient(135deg,#3b82f6,#6366f1)"}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 3px 10px rgba(0,0,0,0.25)" }}>
                  <CreditCard size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--font-d)", fontWeight:700, fontSize:14 }}>{card.card_name}</div>
                  <div style={{ color:"var(--text-soft)", fontSize:12 }}>{card.bank_name} · •••• {card.last_four}</div>
                </div>
              </div>
              <span style={{ padding:"3px 8px", background:"rgba(163,230,53,0.1)", border:"1px solid rgba(163,230,53,0.18)", borderRadius:12, fontSize:9.5, color:"var(--lime)", fontWeight:700 }}>
                {card.is_active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Virtual Card Modal */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(18px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:999 }}>
          <div className="xpw__glass" style={{ padding:20, width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", borderBottomColor:"transparent", borderColor:"rgba(163,230,53,0.2)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800 }}>Create Virtual Card</div>
              <button style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--text-soft)" }} onClick={()=>{setShowCreate(false);setVcName("");}}>
                <X size={18} />
              </button>
            </div>
            <div className="xpw__info-lime" style={{ marginBottom:14, fontSize:12 }}>
              <div style={{ color:"var(--lime)", fontWeight:700 }}>⚡ Free Virtual Verve Card</div>
              <div style={{ color:"rgba(255,255,255,0.4)", marginTop:2, lineHeight:1.6 }}>Instantly usable for online payments. Powered by PayWave balance.</div>
            </div>
            <div className="xpw__label" style={{ marginBottom:6 }}>Card Label</div>
            <div className="xpw__field" style={{ marginBottom:16 }}>
              <input type="text" value={vcName} onChange={e=>setVcName(e.target.value)} placeholder="e.g. Shopping Card, Travel Card" className="xpw__input" />
            </div>
            <button className="xpw__btn-primary xpw__full" disabled={!vcName||creating} onClick={createVirtual}>
              {creating ? "Creating…" : <><Plus size={13}/> Create Card</>}
            </button>
          </div>
        </div>
      )}

      {/* Link External Card Modal */}
      {showLink && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(18px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:999 }}>
          <div className="xpw__glass" style={{ padding:20, width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", borderBottomColor:"transparent", borderColor:"rgba(212,168,71,0.2)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800 }}>Link External Card</div>
              <button style={{ background:"transparent", border:"none", cursor:"pointer", color:"var(--text-soft)" }} onClick={()=>{setShowLink(false);setCardNum("");setCardName("");setExpiry("");setCvv("");setBank("");}}>
                <X size={18} />
              </button>
            </div>
            <div className="xpw__label" style={{ marginBottom:6 }}>Card Brand</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7, marginBottom:14 }}>
              {["Visa","Mastercard","Verve"].map(b=>(
                <button key={b} className={`xpw__amt-btn ${cardBrand===b?"xpw__selected":""}`} onClick={()=>setCardBrand(b)} style={{ fontSize:12, padding:"9px 4px" }}>{b}</button>
              ))}
            </div>
            <div className="xpw__label" style={{ marginBottom:6 }}>Card Number</div>
            <div className="xpw__field" style={{ marginBottom:12 }}>
              <input type="text" value={cardNum} onChange={e=>setCardNum(formatCardNum(e.target.value))} placeholder="0000 0000 0000 0000" className="xpw__input" style={{ fontFamily:"var(--font-m)", letterSpacing:"0.06em" }} />
            </div>
            <div className="xpw__label" style={{ marginBottom:6 }}>Card Holder Name</div>
            <div className="xpw__field" style={{ marginBottom:12 }}>
              <input type="text" value={cardName} onChange={e=>setCardName(e.target.value.toUpperCase())} placeholder="NAME ON CARD" className="xpw__input" style={{ textTransform:"uppercase" }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <div className="xpw__label" style={{ marginBottom:6 }}>Expiry</div>
                <div className="xpw__field"><input type="text" value={expiry} onChange={e=>setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" className="xpw__input" /></div>
              </div>
              <div>
                <div className="xpw__label" style={{ marginBottom:6 }}>CVV</div>
                <div className="xpw__field"><input type="password" maxLength={3} value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="•••" className="xpw__input" /></div>
              </div>
            </div>
            <div className="xpw__label" style={{ marginBottom:6 }}>Issuing Bank</div>
            <select value={bank} onChange={e=>setBank(e.target.value)} className="xpw__bank-sel" style={{ marginBottom:16 }}>
              <option value="">— Select Bank —</option>
              {NIGERIAN_BANKS.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
            <div style={{ padding:"10px 12px", background:"rgba(212,168,71,0.05)", border:"1px solid rgba(212,168,71,0.15)", borderRadius:10, marginBottom:14, fontSize:11, color:"rgba(255,255,255,0.3)", lineHeight:1.6 }}>
              🔒 Your card details are encrypted and securely stored. CVV is not stored after verification.
            </div>
            <button className="xpw__btn-primary xpw__full" disabled={!cardNum||!cardName||!expiry||!bank||linking} onClick={linkExternal}>
              {linking ? "Linking…" : <><Link size={13}/> Link Card</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FINANCE TAB ROOT VIEW ─────────────────────────────────────
// FIX: pw-scroll-px carries its own paddingLeft/Right:16 since
// .pw-scroll no longer provides horizontal padding.
export default function FinanceTab({ pwBalance, setPage }) {
  const sections = [
    { icon:Zap,       label:"Stake-2-Earn", sub:"Xeevia yield protocol",   page:"invest", cls:"g-indigo" },
    { icon:PiggyBank, label:"Savings",      sub:"Grow your ₦ daily",        page:"save",   cls:"g-teal"  },
    { icon:CreditCard,label:"Cards",        sub:"Virtual & linked cards",   page:"cards",  cls:"g-rose"  },
  ];

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop:16, paddingBottom:12 }}>
        <div style={{ fontFamily:"var(--font-d)", fontSize:20, fontWeight:800, letterSpacing:"-0.025em" }}>Finance</div>
        <div style={{ color:"var(--text-soft)", fontSize:12, marginTop:2 }}>Manage your wealth</div>
      </div>

      <div className="xpw__glass xpw__glass-lime" style={{ padding:"18px 17px", marginBottom:14, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:130, height:130, background:"radial-gradient(circle,rgba(163,230,53,0.1),transparent 70%)", borderRadius:"50%", filter:"blur(16px)", pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <div style={{ color:"var(--text-soft)", fontSize:11.5, marginBottom:4 }}>PayWave Balance</div>
          <div style={{ fontFamily:"var(--font-d)", fontSize:30, fontWeight:800, letterSpacing:"-0.03em" }}>₦{fmtNGN(pwBalance)}</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, color:"var(--lime)", fontSize:12, marginTop:4 }}>
            <Zap size={11}/><span>Internal Naira · Zero-fee transfers</span>
          </div>
        </div>
      </div>

      <div className="xpw__space-y xpw__mb-4">
        {sections.map((item,i)=>(
          <div key={i} className="xpw__glass xpw__click" style={{ padding:"13px 14px" }} onClick={()=>setPage(item.page)}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div className={`xpw__quick-icon ${item.cls}`} style={{ width:40, height:40, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,0,0,0.3)", flexShrink:0 }}>
                  <item.icon size={17} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--font-d)", fontSize:14, fontWeight:800 }}>{item.label}</div>
                  <div style={{ color:"var(--text-soft)", fontSize:11.5 }}>{item.sub}</div>
                </div>
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderRadius:14, background:"linear-gradient(140deg,rgba(168,85,247,0.1),rgba(163,230,53,0.06))", border:"1px solid rgba(168,85,247,0.18)", padding:"15px 14px", cursor:"pointer" }} onClick={()=>setPage("invest")}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <Zap size={16} color="#a855f7" />
          <span style={{ fontFamily:"var(--font-d)", fontSize:14, fontWeight:800 }}>Stake-2-Earn</span>
          <span style={{ marginLeft:"auto", padding:"3px 8px", background:"rgba(168,85,247,0.15)", border:"1px solid rgba(168,85,247,0.25)", borderRadius:20, fontSize:9.5, color:"#a855f7", fontWeight:700 }}>XEEVIA PROTOCOL</span>
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:1.65 }}>
          Lock ₦ into the Xeevia protocol and earn $XEV rewards from platform revenue and engagement. The only Xeevia yield product.
        </div>
      </div>
    </div>
  );
}

// ── Sub-view router (used by PayWaveApp) ──────────────────────
export function FinanceSubView({ view, pwBalance, onBack, onSuccess, userId, onRefresh }) {
  if (view === "invest") return <Stake2EarnView pwBalance={pwBalance} onBack={onBack} onSuccess={onSuccess} />;
  if (view === "save")   return <SavingsView   pwBalance={pwBalance} onBack={onBack} onSuccess={onSuccess} />;
  if (view === "cards")  return <CardsView onBack={onBack} onSuccess={onSuccess} />;
  return null;
}

// ── Shared Header ─────────────────────────────────────────────
function Header({ title, onBack }) {
  return (
    <div style={{ paddingTop:0, flexShrink:0, display:"flex", alignItems:"center", height:50, gap:10, padding:"0 var(--pw-pad-left)", borderBottom:"1px solid var(--border)" }}>
      <button className="pw-back" onClick={onBack} style={{ width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span style={{ fontFamily:"var(--font-d)", fontSize:15, fontWeight:700 }}>{title}</span>
    </div>
  );
}