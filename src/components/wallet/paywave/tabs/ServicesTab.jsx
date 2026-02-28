// paywave/tabs/ServicesTab.jsx  (v2 — Student Scholarships replaces Loans)
import React, { useState } from "react";
import {
  Smartphone, Wifi, Tv, Zap, Gift, LayoutGrid,
  PiggyBank, CreditCard, GraduationCap,
  ChevronRight, BookOpen, Award, Star, AlertCircle,
  CheckCircle, Clock, Info,
} from "lucide-react";

export default function ServicesTab({ setPage }) {
  const billItems = [
    { icon: Smartphone, label: "Airtime",     page: "airtime",     cls: "g-purple"  },
    { icon: Wifi,       label: "Data",         page: "data",        cls: "g-blue"    },
    { icon: Tv,         label: "Cable TV",     page: "tv",          cls: "g-orange"  },
    { icon: Zap,        label: "Electricity",  page: "electricity", cls: "g-yellow"  },
    { icon: LayoutGrid, label: "Betting",      page: "betting",     cls: "g-green"   },
    { icon: Gift,       label: "Gift Cards",   page: "giftcards",   cls: "g-pink"    },
    { icon: Zap,        label: "Bills",        page: "bills",       cls: "g-teal"    },
    { icon: LayoutGrid, label: "More",         page: "services",    cls: "g-indigo"  },
  ];

  const financialServices = [
    { icon: Zap,          label: "Stake-2-Earn",  sub: "Earn from platform growth",       page: "invest",       cls: "g-indigo" },
    { icon: PiggyBank,    label: "Savings",        sub: "Build discipline, grow ₦",        page: "save",         cls: "g-teal"   },
    { icon: CreditCard,   label: "Cards",          sub: "Virtual & linked cards",          page: "cards",        cls: "g-rose"   },
    { icon: GraduationCap,label: "Scholarships",   sub: "Fund your education",             page: "scholarships", cls: "g-blue2"  },
  ];

  return (
    <div className="pw-scroll-px">
      <div style={{ paddingTop: 16, paddingBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.025em" }}>Services</div>
        <div style={{ color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>All your financial services</div>
      </div>

      {/* Bills & Payments */}
      <div className="sec-hd"><span className="sec-title">Bills & Payments</span></div>
      <div className="srv-grid mb-4">
        {billItems.map((item, i) => (
          <button key={i} className="srv-item" onClick={() => setPage(item.page)}>
            <div className={`srv-icon ${item.cls}`}><item.icon size={20} color="#fff" /></div>
            <span className="srv-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Financial Services */}
      <div className="sec-hd"><span className="sec-title">Financial Services</span></div>
      <div className="space-y">
        {financialServices.map((item, i) => (
          <div key={i} className="glass click" style={{ padding: "13px 14px" }} onClick={() => setPage(item.page)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className={`quick-icon ${item.cls}`} style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.3)", flexShrink: 0 }}>
                  <item.icon size={19} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-d)", fontSize: 14, fontWeight: 800 }}>{item.label}</div>
                  <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{item.sub}</div>
                </div>
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SCHOLARSHIPS VIEW ──────────────────────────────────────
// The best possible scholarship model for Nigerian students.
// 25% | 50% | 100% tuition support tiers.
// Conditions: academic merit + duration + verification.
export function ScholarshipsView({ pwBalance, onBack }) {
  const [view, setView]       = useState("home"); // home | apply | status
  const [selTier, setSelTier] = useState(null);
  const [step, setStep]       = useState(1);
  const [formData, setFormData] = useState({
    fullName: "", institution: "", course: "", level: "",
    cgpa: "", tuitionAmt: "", semester: "", evidence: "",
    statement: "", sponsorEmail: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]    = useState(false);

  const TIERS = [
    {
      id: "quarter",
      name: "Quarter Scholar",
      pct: 25,
      color: "#a3e635",
      icon: "🌱",
      maxAmt: 75000,
      desc: "25% of verified tuition, up to ₦75,000 per semester",
      conditions: [
        "Minimum CGPA: 3.0 / 5.0",
        "Must not have failed any course in previous semester",
        "Duration: 1 semester, renewable",
        "Verification: Student ID + School invoice required",
        "Community contribution: 2 hours/month Xeevia social tasks",
      ],
      renewable: "Each semester with continued academic performance",
      disbursement: "Direct to school's payment portal or student account",
    },
    {
      id: "half",
      name: "Half Scholar",
      pct: 50,
      color: "#d4a847",
      icon: "🌟",
      maxAmt: 150000,
      desc: "50% of verified tuition, up to ₦150,000 per semester",
      conditions: [
        "Minimum CGPA: 3.5 / 5.0",
        "Top 20% of your department",
        "No failed or carryover courses",
        "Duration: 1 academic year, renewable",
        "Letter of recommendation from academic advisor",
        "Community contribution: 4 hours/month Xeevia social tasks",
      ],
      renewable: "Annually with CGPA maintenance and performance review",
      disbursement: "Direct to institution — school invoices only",
    },
    {
      id: "full",
      name: "Full Scholar",
      pct: 100,
      color: "#a855f7",
      icon: "🎓",
      maxAmt: 300000,
      desc: "100% of verified tuition, up to ₦300,000 per semester",
      conditions: [
        "Minimum CGPA: 4.0 / 5.0",
        "Top 5% of your institution or department",
        "Proven financial hardship (family income documentation)",
        "Academic excellence track record",
        "Duration: Full degree program, renewable per year",
        "Mentorship: Participate in Xeevia Student Leader program",
        "Community contribution: 8 hours/month platform ambassador",
      ],
      renewable: "Annually — most stringent review, most powerful impact",
      disbursement: "Direct to institution — quarterly disbursement after result confirmation",
    },
  ];

  const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "Postgraduate"];
  const tier    = selTier ? TIERS.find(t => t.id === selTier) : null;

  const handleApply = async () => {
    setLoading(true);
    // Simulate application submission
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
  };

  const fields = [
    { label: "Full Legal Name",    key: "fullName",     placeholder: "As on your school ID" },
    { label: "Institution",        key: "institution",  placeholder: "University / Polytechnic / College" },
    { label: "Course of Study",    key: "course",       placeholder: "e.g. Computer Science, Medicine, Law" },
    { label: "Current Semester CGPA", key: "cgpa",     placeholder: "e.g. 3.8 out of 5.0" },
    { label: "Total Semester Tuition (₦)", key: "tuitionAmt", placeholder: "School fee from invoice", type: "number" },
    { label: "School Email / Sponsor Email", key: "sponsorEmail", placeholder: "email@university.edu.ng" },
  ];

  // ── Submitted view ──
  if (submitted) {
    return (
      <div className="pw-scroll">
        <Header title="Scholarships" onBack={onBack} />
        <div className="f-section" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, textAlign:"center", gap:16 }}>
          <div style={{ width:68, height:68, borderRadius:"50%", background:"rgba(163,230,53,0.12)", border:"2px solid var(--lime)", display:"flex", alignItems:"center", justifyContent:"center", animation:"pw-pulse 2s infinite" }}>
            <CheckCircle size={30} color="var(--lime)" />
          </div>
          <div style={{ fontFamily:"var(--font-d)", fontSize:20, fontWeight:800 }}>Application Submitted!</div>
          <div style={{ color:"var(--text-soft)", fontSize:13, lineHeight:1.7, maxWidth:300 }}>
            Your <strong style={{ color:tier?.color }}>{tier?.name}</strong> application has been received. Our team reviews applications within <strong style={{ color:"var(--text)" }}>5–7 working days</strong>.
          </div>
          <div style={{ width:"100%", borderRadius:12, background:"rgba(255,255,255,0.02)", border:"1px solid var(--border)", padding:"14px 16px" }}>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.35)", lineHeight:1.8 }}>
              You'll receive an email notification once your application is reviewed. Keep your school invoice and academic record ready for verification.
            </div>
          </div>
          <button className="btn-lime full" onClick={onBack}>Back to Services</button>
          <div style={{ fontSize:11, color:"var(--text-soft)" }}>No student should have to drop out.</div>
        </div>
        <style>{`@keyframes pw-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(163,230,53,0.2)} 50%{box-shadow:0 0 0 12px rgba(163,230,53,0)} }`}</style>
      </div>
    );
  }

  // ── Application form ──
  if (view === "apply" && tier) {
    return (
      <div className="pw-scroll">
        <Header title={`Apply — ${tier.name}`} onBack={()=>{setView("home");setStep(1);}} />
        <div className="f-section f-stack">
          {/* Tier badge */}
          <div style={{ borderRadius:12, padding:"12px 14px", background:`${tier.color}18`, border:`1px solid ${tier.color}33`, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:24 }}>{tier.icon}</div>
            <div>
              <div style={{ fontFamily:"var(--font-d)", fontSize:14, fontWeight:800, color:tier.color }}>{tier.name} · {tier.pct}%</div>
              <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.4)" }}>{tier.desc}</div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            {[1,2].map(s=>(
              <React.Fragment key={s}>
                <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, background:step>=s?"var(--lime)":"rgba(255,255,255,0.06)", color:step>=s?"#0a0e06":"var(--text-soft)", border:step>=s?"none":"1px solid var(--border)" }}>{s}</div>
                {s<2 && <div style={{ flex:1, height:1, background:step>=2?"var(--lime)":"rgba(255,255,255,0.06)" }} />}
              </React.Fragment>
            ))}
            <div style={{ marginLeft:6, fontSize:11, color:"var(--text-soft)" }}>Step {step} of 2</div>
          </div>

          {step === 1 && (
            <>
              {fields.map(f=>(
                <div key={f.key}>
                  <label className="f-label">{f.label}</label>
                  <div className="f-card">
                    <input type={f.type||"text"} value={formData[f.key]} onChange={e=>setFormData({...formData,[f.key]:e.target.value})} placeholder={f.placeholder} className="f-input" />
                  </div>
                </div>
              ))}
              <div>
                <label className="f-label">Current Level</label>
                <select value={formData.level} onChange={e=>setFormData({...formData,level:e.target.value})} className="bank-sel">
                  <option value="">— Select Level —</option>
                  {LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <button className="btn-lime full"
                disabled={!formData.fullName||!formData.institution||!formData.course||!formData.cgpa||!formData.tuitionAmt||!formData.level}
                onClick={()=>setStep(2)}>
                Next: Supporting Statement →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Eligibility recap */}
              <div style={{ borderRadius:11, padding:"13px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid var(--border)" }}>
                <div style={{ fontFamily:"var(--font-d)", fontSize:13, fontWeight:700, marginBottom:8, color:tier.color }}>Eligibility Requirements</div>
                {tier.conditions.map((c,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:5 }}>
                    <CheckCircle size={11} color={tier.color} style={{ flexShrink:0, marginTop:2 }} />
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.5 }}>{c}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="f-label">Why do you deserve this scholarship?</label>
                <div className="f-card">
                  <textarea value={formData.statement} onChange={e=>setFormData({...formData,statement:e.target.value})} placeholder="Tell us your story. Your background, your ambitions, how this scholarship changes your trajectory…" className="f-input" style={{ minHeight:120, resize:"vertical", lineHeight:1.6 }} />
                </div>
                <div style={{ fontSize:11, color:"var(--text-soft)", marginTop:4 }}>Minimum 100 characters. Be honest. Be specific.</div>
              </div>

              <div>
                <label className="f-label">School Fee Invoice Reference</label>
                <div className="f-card">
                  <input type="text" value={formData.evidence} onChange={e=>setFormData({...formData,evidence:e.target.value})} placeholder="Invoice number or payment reference from school" className="f-input" />
                </div>
              </div>

              {/* Disbursement info */}
              <div style={{ borderRadius:10, padding:"11px 13px", background:"rgba(168,85,247,0.06)", border:"1px solid rgba(168,85,247,0.15)", fontSize:12, lineHeight:1.65, color:"rgba(255,255,255,0.38)" }}>
                <div style={{ color:"#a855f7", fontWeight:700, marginBottom:3 }}>💸 Disbursement</div>
                {tier.disbursement}
              </div>

              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost" onClick={()=>setStep(1)}>← Back</button>
                <button className="btn-lime" style={{ flex:1 }}
                  disabled={!formData.statement||formData.statement.length<100||!formData.evidence||loading}
                  onClick={handleApply}>
                  {loading ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Home view ──
  return (
    <div className="pw-scroll">
      <Header title="Scholarships" onBack={onBack} />
      <div className="f-section f-stack">

        {/* Mission statement */}
        <div style={{ borderRadius:14, padding:"16px 15px", background:"linear-gradient(140deg,rgba(59,130,246,0.1),rgba(168,85,247,0.07))", border:"1px solid rgba(59,130,246,0.2)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, background:"radial-gradient(circle,rgba(168,85,247,0.12),transparent 70%)", borderRadius:"50%", filter:"blur(14px)" }} />
          <div style={{ position:"relative" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:42, height:42, borderRadius:11, background:"linear-gradient(135deg,#3b82f6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(59,130,246,0.3)" }}>
                <GraduationCap size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800 }}>Xeevia Scholarships</div>
                <div style={{ color:"#60a5fa", fontSize:12 }}>No student should drop out</div>
              </div>
            </div>
            <div style={{ fontSize:12.5, color:"rgba(255,255,255,0.4)", lineHeight:1.7 }}>
              Bright students shouldn't have to choose between education and survival. PayWave funds verified tuition directly — no loans, no debt, no strings except academic excellence.
            </div>
          </div>
        </div>

        {/* Tier cards */}
        {TIERS.map(t => (
          <div key={t.id} className="glass click" style={{ padding:"15px 14px", borderColor:`${t.color}22` }}
            onClick={()=>{setSelTier(t.id);setView("apply");setStep(1);}}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:28, lineHeight:1 }}>{t.icon}</div>
                <div>
                  <div style={{ fontFamily:"var(--font-d)", fontSize:15, fontWeight:800, color:t.color }}>{t.name}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{t.desc}</div>
                </div>
              </div>
              <div style={{ flexShrink:0, padding:"5px 11px", background:`${t.color}18`, border:`1px solid ${t.color}33`, borderRadius:20, fontFamily:"var(--font-d)", fontWeight:800, fontSize:15, color:t.color }}>{t.pct}%</div>
            </div>

            {/* Key conditions preview */}
            <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:12 }}>
              {t.conditions.slice(0,3).map((c,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{ width:4, height:4, borderRadius:"50%", background:t.color, flexShrink:0 }} />
                  <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.35)" }}>{c}</span>
                </div>
              ))}
              {t.conditions.length > 3 && (
                <div style={{ fontSize:11, color:`${t.color}88`, paddingLeft:11 }}>+{t.conditions.length-3} more conditions</div>
              )}
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)" }}>Max: ₦{t.maxAmt.toLocaleString()} / semester</div>
              <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:t.color }}>
                Apply <ChevronRight size={12}/>
              </div>
            </div>
          </div>
        ))}

        {/* Info footer */}
        <div style={{ borderRadius:12, padding:"13px 14px", background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.07)", fontSize:12, color:"rgba(255,255,255,0.28)", lineHeight:1.7 }}>
          <div style={{ fontWeight:700, color:"rgba(255,255,255,0.45)", marginBottom:4 }}>How it works</div>
          Applications are reviewed in 5–7 days. Approved scholarships are disbursed directly to your institution. No repayment required — this is a grant, not a loan. Funds come from the Xeevia Global Impact Fund (5% of platform revenue).
        </div>
      </div>
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div style={{ flexShrink:0, display:"flex", alignItems:"center", height:50, gap:10, padding:"0 var(--pw-pad-left)", borderBottom:"1px solid var(--border)" }}>
      <button className="pw-back" onClick={onBack} style={{ width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span style={{ fontFamily:"var(--font-d)", fontSize:15, fontWeight:700 }}>{title}</span>
    </div>
  );
}