// paywave/tabs/ServicesTab.jsx  ── v3 REFINED EDITION
import React, { useState } from "react";
import {
  Smartphone, Wifi, Tv, Zap, Gift, LayoutGrid,
  PiggyBank, CreditCard, GraduationCap, ChevronRight,
  CheckCircle, BookOpen, Award, X,
} from "lucide-react";

export default function ServicesTab({ setPage }) {
  const billItems = [
    { icon:Smartphone, label:"Airtime",    page:"airtime",     cls:"g-purple" },
    { icon:Wifi,        label:"Data",       page:"data",        cls:"g-blue"   },
    { icon:Tv,          label:"Cable TV",   page:"tv",          cls:"g-orange" },
    { icon:Zap,         label:"Electricity",page:"electricity", cls:"g-amber"  },
    { icon:LayoutGrid,  label:"Betting",    page:"betting",     cls:"g-green"  },
    { icon:Gift,        label:"Gift Cards", page:"giftcards",   cls:"g-pink"   },
    { icon:Zap,         label:"Bills",      page:"bills",       cls:"g-teal"   },
    { icon:LayoutGrid,  label:"More",       page:"services",    cls:"g-indigo" },
  ];

  const financial = [
    { icon:Zap,           label:"Stake-2-Earn",  sub:"Earn from platform growth",    page:"invest",       cls:"g-indigo" },
    { icon:PiggyBank,     label:"Savings",        sub:"Build discipline, grow ₦",     page:"save",         cls:"g-teal"   },
    { icon:CreditCard,    label:"Cards",          sub:"Virtual & linked cards",        page:"cards",        cls:"g-rose"   },
    { icon:GraduationCap, label:"Scholarships",   sub:"Fund your education",           page:"scholarships", cls:"g-blue2"  },
  ];

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop:14, paddingBottom:12 }}>
        <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:800, letterSpacing:"-0.025em" }}>
          Services
        </div>
      </div>

      {/* Bills & Payments */}
      <div style={{ fontFamily:"var(--fd)", fontSize:"9.5px", fontWeight:700,
        color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:9 }}>
        Bills & Payments
      </div>
      <div className="srv-grid mb-4">
        {billItems.map((item,i) => (
          <button key={i} className="srv-item" onClick={() => setPage(item.page)}>
            <div className={`srv-icon ${item.cls}`}><item.icon size={18} color="#fff" /></div>
            <span className="srv-lbl">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Financial Services */}
      <div style={{ fontFamily:"var(--fd)", fontSize:"9.5px", fontWeight:700,
        color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:9 }}>
        Financial Services
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {financial.map((item,i) => (
          <div key={i} className="xg xg-click" style={{ padding:"11px 12px" }} onClick={() => setPage(item.page)}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div className={`quick-icon ${item.cls}`}
                  style={{ width:38, height:38, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <item.icon size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:13, fontWeight:800 }}>{item.label}</div>
                  <div style={{ color:"var(--t2)", fontSize:11 }}>{item.sub}</div>
                </div>
              </div>
              <ChevronRight size={12} color="var(--t4)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SCHOLARSHIPS VIEW ──────────────────────────────────────────
export function ScholarshipsView({ pwBalance, onBack }) {
  const [view,     setView]     = useState("home");
  const [selTier,  setSelTier]  = useState(null);
  const [step,     setStep]     = useState(1);
  const [submitted,setSubmitted]= useState(false);
  const [loading,  setLoading]  = useState(false);
  const [formData, setFormData] = useState({
    fullName:"",institution:"",course:"",level:"",
    cgpa:"",tuitionAmt:"",semester:"",evidence:"",statement:"",sponsorEmail:"",
  });

  const TIERS = [
    { id:"quarter", name:"Quarter Scholar", pct:25, color:"#a3e635", icon:"🌱", maxAmt:75000,
      desc:"25% of verified tuition, up to ₦75,000 per semester",
      conditions:["Minimum CGPA: 3.0 / 5.0","No failed courses in previous semester","Duration: 1 semester, renewable","Community contribution: 2 hrs/month"],
      renewable:"Each semester with continued performance",
      disbursement:"Direct to school portal or student account",
    },
    { id:"half", name:"Half Scholar", pct:50, color:"#d4a847", icon:"🌟", maxAmt:150000,
      desc:"50% of verified tuition, up to ₦150,000 per semester",
      conditions:["Minimum CGPA: 3.5 / 5.0","Top 20% of department","No carryover courses","Recommendation letter required","Community contribution: 4 hrs/month"],
      renewable:"Annually with CGPA maintenance",
      disbursement:"Direct to institution — invoices only",
    },
    { id:"full", name:"Full Scholar", pct:100, color:"#a855f7", icon:"🎓", maxAmt:300000,
      desc:"100% of verified tuition, up to ₦300,000 per semester",
      conditions:["Minimum CGPA: 4.0 / 5.0","Top 5% of institution","Proven financial hardship","Full-degree program","Platform ambassador: 8 hrs/month"],
      renewable:"Annually — most stringent review",
      disbursement:"Quarterly after result confirmation",
    },
  ];

  const LEVELS = ["100 Level","200 Level","300 Level","400 Level","500 Level","Postgraduate"];
  const tier = selTier ? TIERS.find(t=>t.id===selTier) : null;

  const handleApply = async () => {
    setLoading(true);
    await new Promise(r=>setTimeout(r,1500));
    setLoading(false);
    setSubmitted(true);
  };

  function Header({ title, onBack:_onBack }) {
    return (
      <div className="pw-hdr">
        <button className="pw-back-btn" onClick={_onBack}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="pw-hdr-title">{title}</span>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="pw-scroll">
        <Header title="Scholarships" onBack={onBack} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          minHeight:380, textAlign:"center", gap:14, padding:24 }}>
          <div style={{ width:56, height:56, borderRadius:"50%",
            background:"rgba(163,230,53,0.1)", border:"2px solid var(--lime)",
            display:"flex", alignItems:"center", justifyContent:"center",
            animation:"pw-pulse 2s infinite" }}>
            <CheckCircle size={24} color="var(--lime)" />
          </div>
          <div style={{ fontFamily:"var(--fd)", fontSize:17, fontWeight:800 }}>Application Submitted!</div>
          <div style={{ color:"var(--t2)", fontSize:12, lineHeight:1.7, maxWidth:280 }}>
            Your <strong style={{ color:tier?.color }}>{tier?.name}</strong> application is received. Review takes <strong style={{ color:"var(--t1)" }}>5–7 working days</strong>.
          </div>
          <button className="btn-p full" onClick={onBack}>Back to Services</button>
          <div style={{ fontSize:10.5, color:"var(--t2)" }}>No student should have to drop out.</div>
        </div>
      </div>
    );
  }

  if (view === "apply" && tier) {
    return (
      <div className="pw-scroll">
        <Header title={`Apply — ${tier.name}`} onBack={()=>{setView("home");setStep(1);}} />
        <div className="xf-section xf-stack">
          <div style={{ borderRadius:10, padding:"10px 12px",
            background:`${tier.color}16`, border:`1px solid ${tier.color}30`,
            display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ fontSize:20 }}>{tier.icon}</div>
            <div>
              <div style={{ fontFamily:"var(--fd)", fontSize:13, fontWeight:800, color:tier.color }}>{tier.name} · {tier.pct}%</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)" }}>{tier.desc}</div>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            {[1,2].map(s=>(
              <React.Fragment key={s}>
                <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700,
                  background:step>=s?"var(--lime)":"rgba(255,255,255,0.055)",
                  color:step>=s?"#060e02":"var(--t2)",
                  border:step>=s?"none":"1px solid var(--b1)" }}>{s}</div>
                {s<2 && <div style={{ flex:1, height:1, background:step>=2?"var(--lime)":"rgba(255,255,255,0.055)" }} />}
              </React.Fragment>
            ))}
            <div style={{ marginLeft:6, fontSize:10.5, color:"var(--t2)" }}>Step {step} of 2</div>
          </div>

          {step===1 && (
            <>
              {[
                { label:"Full Legal Name",           key:"fullName",     placeholder:"As on your school ID" },
                { label:"Institution",               key:"institution",  placeholder:"University / Polytechnic" },
                { label:"Course of Study",           key:"course",       placeholder:"e.g. Computer Science" },
                { label:"Current CGPA",              key:"cgpa",         placeholder:"e.g. 3.8 out of 5.0" },
                { label:"Total Semester Tuition (₦)",key:"tuitionAmt",   placeholder:"From school invoice", type:"number" },
                { label:"School / Sponsor Email",    key:"sponsorEmail", placeholder:"email@university.edu.ng" },
              ].map(f=>(
                <div key={f.key}>
                  <label className="xf-lbl">{f.label}</label>
                  <div className="xf-wrap">
                    <input type={f.type||"text"} value={formData[f.key]}
                      onChange={e=>setFormData({...formData,[f.key]:e.target.value})}
                      placeholder={f.placeholder} className="xf-in" />
                  </div>
                </div>
              ))}
              <div>
                <label className="xf-lbl">Current Level</label>
                <select value={formData.level} onChange={e=>setFormData({...formData,level:e.target.value})} className="bank-sel">
                  <option value="">— Select Level —</option>
                  {LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <button className="btn-p full"
                disabled={!formData.fullName||!formData.institution||!formData.course||!formData.cgpa||!formData.tuitionAmt||!formData.level}
                onClick={()=>setStep(2)}>
                Next: Supporting Statement →
              </button>
            </>
          )}

          {step===2 && (
            <>
              <div style={{ borderRadius:10, padding:"11px 12px", background:"rgba(255,255,255,0.02)", border:"1px solid var(--b1)" }}>
                <div style={{ fontFamily:"var(--fd)", fontSize:12, fontWeight:700, marginBottom:7, color:tier.color }}>
                  Eligibility Requirements
                </div>
                {tier.conditions.map((c,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:4 }}>
                    <CheckCircle size={10} color={tier.color} style={{ flexShrink:0, marginTop:2 }} />
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.42)", lineHeight:1.5 }}>{c}</span>
                  </div>
                ))}
              </div>
              <div>
                <label className="xf-lbl">Why do you deserve this scholarship?</label>
                <div className="xf-wrap">
                  <textarea value={formData.statement}
                    onChange={e=>setFormData({...formData,statement:e.target.value})}
                    placeholder="Tell us your story. Your background, ambitions, how this changes your trajectory…"
                    className="xf-in" style={{ minHeight:100, resize:"vertical", lineHeight:1.6 }} />
                </div>
                <div style={{ fontSize:10.5, color:"var(--t2)", marginTop:3 }}>Minimum 100 characters.</div>
              </div>
              <div>
                <label className="xf-lbl">School Fee Invoice Reference</label>
                <div className="xf-wrap">
                  <input type="text" value={formData.evidence}
                    onChange={e=>setFormData({...formData,evidence:e.target.value})}
                    placeholder="Invoice number or payment reference" className="xf-in" />
                </div>
              </div>
              <div className="btn-pair">
                <button className="btn-g" onClick={()=>setStep(1)}>← Back</button>
                <button className="btn-p" style={{ flex:1 }}
                  disabled={!formData.statement||formData.statement.length<100||!formData.evidence||loading}
                  onClick={handleApply}>
                  {loading?"Submitting…":"Submit Application"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function Header2({ title, onBack:_onBack }) {
    return (
      <div className="pw-hdr">
        <button className="pw-back-btn" onClick={_onBack}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="pw-hdr-title">{title}</span>
      </div>
    );
  }

  return (
    <div className="pw-scroll">
      <Header2 title="Scholarships" onBack={onBack} />
      <div className="xf-section xf-stack">
        <div style={{ borderRadius:13, padding:"14px 13px",
          background:"linear-gradient(140deg,rgba(59,130,246,0.09),rgba(168,85,247,0.06))",
          border:"1px solid rgba(59,130,246,0.18)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-15, right:-15, width:80, height:80,
            background:"radial-gradient(circle,rgba(168,85,247,0.1),transparent 70%)",
            borderRadius:"50%", filter:"blur(12px)" }} />
          <div style={{ position:"relative" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:8 }}>
              <div style={{ width:38, height:38, borderRadius:10,
                background:"linear-gradient(135deg,#3b82f6,#6366f1)",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 3px 12px rgba(59,130,246,0.28)" }}>
                <GraduationCap size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:800 }}>Xeevia Scholarships</div>
                <div style={{ color:"#60a5fa", fontSize:11 }}>No student should drop out</div>
              </div>
            </div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.38)", lineHeight:1.65 }}>
              PayWave funds verified tuition directly — no loans, no debt, no strings except academic excellence.
            </div>
          </div>
        </div>

        {TIERS.map(t=>(
          <div key={t.id} className="xg xg-click" style={{ padding:"13px 12px", borderColor:`${t.color}1e` }}
            onClick={()=>{setSelTier(t.id);setView("apply");setStep(1);}}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ fontSize:24, lineHeight:1 }}>{t.icon}</div>
                <div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:14, fontWeight:800, color:t.color }}>{t.name}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:1 }}>{t.desc}</div>
                </div>
              </div>
              <div style={{ flexShrink:0, padding:"4px 10px",
                background:`${t.color}16`, border:`1px solid ${t.color}30`,
                borderRadius:20, fontFamily:"var(--fd)", fontWeight:800, fontSize:14, color:t.color }}>
                {t.pct}%
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
              {t.conditions.slice(0,3).map((c,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:3, height:3, borderRadius:"50%", background:t.color, flexShrink:0 }} />
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.33)" }}>{c}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:10.5, color:"rgba(255,255,255,0.22)" }}>Max: ₦{t.maxAmt.toLocaleString()} / semester</div>
              <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:11.5, fontWeight:600, color:t.color }}>
                Apply <ChevronRight size={11}/>
              </div>
            </div>
          </div>
        ))}

        <div style={{ borderRadius:10, padding:"11px 12px",
          background:"rgba(255,255,255,0.015)", border:"1px dashed rgba(255,255,255,0.065)",
          fontSize:11, color:"rgba(255,255,255,0.26)", lineHeight:1.7 }}>
          <div style={{ fontWeight:700, color:"rgba(255,255,255,0.4)", marginBottom:3 }}>How it works</div>
          Applications reviewed in 5–7 days. Approved scholarships go direct to your institution. No repayment — this is a grant. Funded by Xeevia Global Impact Fund (5% of platform revenue).
        </div>
      </div>
    </div>
  );
}