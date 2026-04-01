// ============================================================================
// src/components/Auth/AuthWall.jsx — v19 LEFT_PANEL_PLATFORM_DATA
// ============================================================================
//
// WHAT CHANGED FROM v18:
//   [FIX-1] AuthWall is shown to UNAUTHENTICATED users. Supabase RLS blocks
//           anonymous reads on profiles, posts, live_sessions. v18 fetched
//           those tables and got 0 for everything, making stats look broken.
//           Fix: only fetch platform_settings (publicly readable — no auth
//           required) which stores the admin-set member_count inside
//           paywall_config. All other "stats" use real platform copy instead.
//
//   [DESIGN-1] Left panel rebuilt around Xeevia's actual value proposition
//           taken from the landing page (index.html):
//             • "Your Actions Are Currency / Own What You Build"
//             • EP + XEV dual token economy
//             • $1 = 100 EP fixed rate
//             • 84% creator share
//             • XRC protocol
//             • Real member count from platform_settings.paywall_config
//             • 3 value props with icons (matches landing page sections)
//             • Bottom stat row: EP Rate · Creator Share · Token Supply
//
//   Everything else (LoginView, SuccessScreen, DeclinedScreen, Splash,
//   ProviderBtn, Grain, Corners, ScanLine) UNCHANGED from v16.
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import authService from "../../services/auth/authService";
import PaywallGate from "./PaywallGate";
import { supabase } from "../../services/config/supabase";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg:    #050706;
    --lime:  #a8e63d;
    --lime2: #c8f56a;
    --red:   #e05252;
    --text:  #dde8dd;
    --dim:   #2a3a2a;
  }

  @keyframes S_letter {
    0%   { opacity:0; transform:translateY(-52px) scaleY(1.22); filter:blur(10px); }
    50%  { opacity:1; transform:translateY(5px) scaleY(0.96);   filter:blur(0); }
    75%  { transform:translateY(-2px) scaleY(1.01); }
    100% { opacity:1; transform:translateY(0) scaleY(1); }
  }
  @keyframes S_tagline { from{opacity:0;letter-spacing:18px} to{opacity:0.55;letter-spacing:6px} }
  @keyframes S_arc { 0%{stroke-dashoffset:251;opacity:0.1} 45%{stroke-dashoffset:35;opacity:1} 100%{stroke-dashoffset:251;opacity:0.1} }
  @keyframes S_scan   { from{top:-1px} to{top:100vh} }
  @keyframes S_glow   { 0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} }
  @keyframes XV_fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes XV_riseIn { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes XV_spin   { to{transform:rotate(360deg)} }
  @keyframes B_sweep   { from{transform:scaleX(0)} to{transform:scaleX(1)} }
  @keyframes CK_ring   { from{stroke-dashoffset:289} to{stroke-dashoffset:0} }
  @keyframes CK_tick   { from{stroke-dashoffset:90;opacity:0} 8%{opacity:1} to{stroke-dashoffset:0;opacity:1} }
  @keyframes CK_disc   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes CK_pulse  { 0%{transform:scale(1);filter:drop-shadow(0 0 0px rgba(168,230,61,0))} 40%{transform:scale(1.12);filter:drop-shadow(0 0 28px rgba(168,230,61,.7))} 100%{transform:scale(1);filter:drop-shadow(0 0 8px rgba(168,230,61,.25))} }
  @keyframes CK_halo   { 0%{transform:translate(-50%,-50%) scale(.8);opacity:0} 30%{opacity:1} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
  @keyframes XK_ring   { from{stroke-dashoffset:289} to{stroke-dashoffset:0} }
  @keyframes XK_line   { from{stroke-dashoffset:80;opacity:0} 8%{opacity:1} to{stroke-dashoffset:0;opacity:1} }
  @keyframes XK_disc   { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }

  /* ── Left panel ── */
  @keyframes LP_orb1    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(26px,-20px)} }
  @keyframes LP_orb2    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,16px)} }
  @keyframes LP_pulse   { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.55)} }
  @keyframes LP_shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes LP_rise    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes LP_countUp { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

  .xv, .xv * { box-sizing:border-box; }
  .xv { font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }

  .lp-value-row {
    display:flex;align-items:flex-start;gap:14px;
    padding:14px 16px;
    background:rgba(255,255,255,.02);
    border:1px solid rgba(168,230,61,.08);
    border-radius:14px;
    transition:border-color .22s,background .22s,transform .2s;
    cursor:default;
  }
  .lp-value-row:hover {
    border-color:rgba(168,230,61,.2);
    background:rgba(168,230,61,.03);
    transform:translateX(3px);
  }
  .lp-icon-box {
    width:36px;height:36px;border-radius:10px;
    background:rgba(168,230,61,.08);border:1px solid rgba(168,230,61,.14);
    display:flex;align-items:center;justify-content:center;
    font-size:17px;flex-shrink:0;
    transition:background .22s,border-color .22s;
  }
  .lp-value-row:hover .lp-icon-box {
    background:rgba(168,230,61,.14);border-color:rgba(168,230,61,.28);
  }
  .lp-stat-box {
    flex:1;background:rgba(255,255,255,.022);border:1px solid rgba(168,230,61,.09);
    border-radius:12px;padding:12px 14px;text-align:center;
    position:relative;overflow:hidden;
    transition:border-color .22s,transform .2s;
  }
  .lp-stat-box::before {
    content:"";position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(168,230,61,.2),transparent);
  }
  .lp-stat-box:hover { border-color:rgba(168,230,61,.22); transform:translateY(-2px); }
  .lp-shimmer {
    background:linear-gradient(90deg,#a8e63d 0%,#d4fc72 25%,#5a9a10 50%,#d4fc72 75%,#a8e63d 100%);
    background-size:200% auto;
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    animation:LP_shimmer 4s linear infinite;
  }
  .lp-avatar {
    width:27px;height:27px;border-radius:50%;border:2px solid #050706;
    display:flex;align-items:center;justify-content:center;
    font-size:9px;font-weight:900;color:#040a00;flex-shrink:0;overflow:hidden;
  }

  @media (max-width:768px) {
    .xv-left  { display:none !important; }
    .xv-right { flex:1 1 100% !important; padding:48px 24px !important; }
  }
`;

// ─── Shared atoms ─────────────────────────────────────────────────────────────
const Grain = () => (
  <svg aria-hidden style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0,opacity:0.04}}>
    <filter id="xvg">
      <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#xvg)"/>
  </svg>
);

const Corners = ({ color = "rgba(168,230,61,0.35)" }) => (
  <div aria-hidden style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1}}>
    {[
      {s:{top:16,left:16},   p:"M0 26 L0 0 L26 0"},
      {s:{top:16,right:16},  p:"M0 0 L26 0 L26 26"},
      {s:{bottom:16,left:16},p:"M0 0 L0 26 L26 26"},
      {s:{bottom:16,right:16},p:"M0 26 L26 26 L26 0"},
    ].map((c,i)=>(
      <svg key={i} style={{position:"absolute",...c.s,width:26,height:26}} viewBox="0 0 26 26" fill="none">
        <path d={c.p} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ))}
  </div>
);

const ScanLine = () => (
  <div aria-hidden style={{position:"absolute",left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(168,230,61,.04),rgba(168,230,61,.13),rgba(168,230,61,.04),transparent)",animation:"S_scan 8s linear infinite",pointerEvents:"none",zIndex:1}}/>
);

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────
export function SuccessScreen({ provider }) {
  const name = provider ? provider[0].toUpperCase()+provider.slice(1) : "";
  const R=46,C=2*Math.PI*R;
  return (
    <div style={{position:"fixed",inset:0,background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,overflow:"hidden",animation:"XV_fadeIn .3s ease"}} className="xv">
      <style>{CSS}</style><Grain/><Corners/><ScanLine/>
      <div aria-hidden style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.09) 0%,transparent 65%)",animation:"S_glow 5s ease-in-out infinite",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"relative",marginBottom:44,zIndex:2}}>
        {[0,1,2].map(i=><div key={i} aria-hidden style={{position:"absolute",top:"50%",left:"50%",width:120,height:120,borderRadius:"50%",border:"1.5px solid rgba(168,230,61,.35)",animation:`CK_halo 2s ease ${1.4+i*.55}s infinite`,pointerEvents:"none"}}/>)}
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden style={{animation:"CK_pulse .55s ease 1.25s 1 both",position:"relative",zIndex:2}}>
          <circle cx="60" cy="60" r="44" fill="rgba(168,230,61,.08)" style={{animation:"CK_disc .35s cubic-bezier(.34,1.56,.64,1) .78s both",opacity:0,transformOrigin:"60px 60px"}}/>
          <circle cx="60" cy="60" r={R} stroke="rgba(168,230,61,.07)" strokeWidth="2" fill="none"/>
          <circle cx="60" cy="60" r={R} stroke="var(--lime)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} style={{animation:`CK_ring .72s cubic-bezier(.4,0,.2,1) .1s forwards`,transformOrigin:"60px 60px",transform:"rotate(-90deg)"}}/>
          <path d="M37 60 L52 75 L83 40" stroke="var(--lime2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="90" strokeDashoffset="90" style={{animation:"CK_tick .42s cubic-bezier(.4,0,.2,1) .82s forwards",opacity:0}}/>
        </svg>
      </div>
      <div style={{textAlign:"center",zIndex:2,maxWidth:300,padding:"0 24px",animation:"XV_riseIn .6s ease 1.4s both",opacity:0}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(28px,5vw,36px)",fontWeight:700,color:"var(--text)",letterSpacing:"-0.5px",lineHeight:1.2,marginBottom:10}}>You're in.</div>
        <div style={{fontSize:14,color:"var(--dim)",lineHeight:1.8}}>Signed in via <span style={{color:"var(--lime)",fontWeight:600}}>{name}</span><br/>Taking you to Xeevia…</div>
      </div>
      <div aria-hidden style={{position:"absolute",bottom:28,fontFamily:"'Bebas Neue',sans-serif",fontSize:11,letterSpacing:"8px",color:"#111a11",animation:"XV_fadeIn 1s ease 2s both",opacity:0}}>XEEVIA</div>
    </div>
  );
}

// ─── DECLINED SCREEN ──────────────────────────────────────────────────────────
export function DeclinedScreen({ message, onRetry }) {
  const R=46,C=2*Math.PI*R;
  return (
    <div style={{position:"fixed",inset:0,background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,overflow:"hidden",padding:"0 24px",animation:"XV_fadeIn .3s ease"}} className="xv">
      <style>{CSS}</style><Grain/><Corners color="rgba(224,82,82,.28)"/><ScanLine/>
      <div aria-hidden style={{position:"absolute",top:"38%",left:"50%",transform:"translate(-50%,-50%)",width:380,height:380,borderRadius:"50%",background:"radial-gradient(circle,rgba(224,82,82,.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div style={{position:"relative",marginBottom:44,zIndex:2}}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
          <circle cx="60" cy="60" r="44" fill="rgba(224,82,82,.07)" style={{animation:"XK_disc .35s cubic-bezier(.34,1.56,.64,1) .76s both",opacity:0,transformOrigin:"60px 60px"}}/>
          <circle cx="60" cy="60" r={R} stroke="rgba(224,82,82,.07)" strokeWidth="2" fill="none"/>
          <circle cx="60" cy="60" r={R} stroke="var(--red)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} style={{animation:`XK_ring .68s cubic-bezier(.4,0,.2,1) .1s forwards`,transformOrigin:"60px 60px",transform:"rotate(-90deg)"}}/>
          <path d="M38 38 L82 82" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="80" style={{animation:"XK_line .26s ease .8s forwards",opacity:0}}/>
          <path d="M82 38 L38 82" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="80" style={{animation:"XK_line .26s ease .98s forwards",opacity:0}}/>
        </svg>
      </div>
      <div style={{textAlign:"center",zIndex:2,maxWidth:300,animation:"XV_riseIn .55s ease 1.2s both",opacity:0}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(24px,4vw,30px)",fontWeight:700,color:"var(--text)",letterSpacing:"-0.3px",marginBottom:10}}>Sign-in cancelled</div>
        <p style={{fontSize:14,color:"#4a2a2a",lineHeight:1.8,marginBottom:32}}>{message||"The sign-in was cancelled or couldn't be completed."}</p>
        <button onClick={onRetry} style={{width:"100%",maxWidth:260,padding:"15px 0",borderRadius:100,border:"none",background:"rgba(224,82,82,.12)",color:"#e05252",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.2px",transition:"background .2s",outline:"1.5px solid rgba(224,82,82,.25)"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(224,82,82,.2)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(224,82,82,.12)"}
        >Try again</button>
      </div>
    </div>
  );
}

// ─── [DESIGN-1] LEFT PANEL ────────────────────────────────────────────────────
// Only fetches platform_settings (readable without auth — no RLS block).
// All other content is real platform copy from the Xeevia landing page.
function LeftPanel() {
  // member_count is stored by the admin in platform_settings.paywall_config
  const [memberCount, setMemberCount] = useState(null);
  const [epGrant, setEpGrant] = useState(300);

  useEffect(() => {
    // platform_settings is publicly readable (same query PaywallGate uses)
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paywall_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          if (data.value.member_count != null) setMemberCount(data.value.member_count);
          if (data.value.ep_grant != null) setEpGrant(data.value.ep_grant);
        }
      })
      .catch(() => {});
  }, []);

  // Format: 1200 → "1.2K", 12847 → "12.8K"
  const fmtCount = (n) => {
    if (n == null) return null;
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString();
  };

  // Value propositions — from Xeevia landing page copy
  const VALUE_PROPS = [
    {
      icon: "⚡",
      title: "Engagement Has Weight",
      body: "Every action costs something and means something. No bots. No fake reach. Your attention is too valuable to waste.",
    },
    {
      icon: "💸",
      title: "Creators Keep 84%",
      body: "Tips go directly to creators. 84% of every EP tip lands in your wallet — not the platform's pocket.",
    },
    {
      icon: "⛓",
      title: "XRC Protocol",
      body: "Every like, post, and transaction is cryptographically recorded. Your content and earnings are yours permanently.",
    },
  ];

  // Bottom economy stats — real platform numbers, not from DB
  const ECO_STATS = [
    { value: "$1 = 100 EP", label: "Fixed EP Rate", note: "transparent & stable" },
    { value: "84%",         label: "Creator Share", note: "of every tip" },
    { value: "1T XEV",      label: "Token Supply",  note: "hard cap, forever" },
  ];

  return (
    <div style={{
      width:"100%",height:"100%",position:"relative",overflow:"hidden",
      display:"flex",flexDirection:"column",
      padding:"44px 48px",
      background:"#020804",
    }}>
      {/* Background orbs */}
      <div aria-hidden style={{position:"absolute",top:-110,left:-90,width:480,height:480,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.11) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"LP_orb1 20s ease-in-out infinite"}}/>
      <div aria-hidden style={{position:"absolute",bottom:-150,right:-90,width:520,height:520,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.07) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"LP_orb2 26s ease-in-out infinite"}}/>
      {/* Dot grid */}
      <div aria-hidden style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,opacity:.016,backgroundImage:"radial-gradient(rgba(168,230,61,.9) 1px,transparent 1px)",backgroundSize:"26px 26px"}}/>
      {/* Vertical separator */}
      <div aria-hidden style={{position:"absolute",right:0,top:"8%",bottom:"8%",width:1,background:"linear-gradient(to bottom,transparent,rgba(168,230,61,.1) 30%,rgba(168,230,61,.1) 70%,transparent)",zIndex:2}}/>

      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>

        {/* ── Logo ── */}
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:32}}>
          <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#a8e63d,#4d7c0f)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 22px rgba(168,230,61,.26)",flexShrink:0}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,color:"#040a00",lineHeight:1}}>X</span>
          </div>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:"6px",color:"#4a7a1a",lineHeight:1}}>XEEVIA</div>
            <div style={{fontSize:8,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"#2a4a1a",marginTop:1}}>The First True SocialFi Economy</div>
          </div>
        </div>

        {/* ── Headline — from landing page ── */}
        <div style={{marginBottom:16}}>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(22px,2.5vw,38px)",fontWeight:900,lineHeight:1.06,letterSpacing:"-2px",margin:"0 0 10px",color:"#edf5ed"}}>
            Your actions<br/>
            are{" "}<span className="lp-shimmer">currency.</span><br/>
            Own what you build.
          </h1>
          <p style={{fontSize:12.5,color:"#365236",lineHeight:1.8,maxWidth:340,margin:0}}>
            A real digital economy — not a reward system bolted onto a social app.
            Every engagement costs something. Every creator earns something real.
          </p>
        </div>

        {/* ── Live member count badge — only real DB data ── */}
        <div style={{
          display:"inline-flex",alignItems:"center",gap:10,
          background:"rgba(168,230,61,.055)",border:"1px solid rgba(168,230,61,.16)",
          borderRadius:100,padding:"7px 14px",marginBottom:22,
          alignSelf:"flex-start",
          animation:"LP_rise .5s ease .2s both",opacity:0,
        }}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#a8e63d",flexShrink:0,boxShadow:"0 0 7px rgba(168,230,61,.7)",animation:"LP_pulse 2s ease-in-out infinite"}}/>
          {memberCount != null ? (
            <span style={{fontSize:11,fontWeight:700,color:"#8abe3a"}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:13}}>{fmtCount(memberCount)}</span>
              {" "}members in the economy
            </span>
          ) : (
            <span style={{fontSize:11,fontWeight:700,color:"#4a6a2a"}}>Join the economy today</span>
          )}
          <span style={{fontSize:9,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",color:"#2a4a1a"}}>LIVE</span>
        </div>

        {/* ── 3 value propositions ── */}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {VALUE_PROPS.map(({icon,title,body})=>(
            <div key={title} className="lp-value-row">
              <div className="lp-icon-box">{icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:800,color:"#b8d870",marginBottom:3,lineHeight:1.3}}>{title}</div>
                <div style={{fontSize:11,color:"#2e4a2e",lineHeight:1.6}}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Economy stat row — real platform numbers ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:"auto"}}>
          {ECO_STATS.map(({value,label,note})=>(
            <div key={label} className="lp-stat-box">
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(11px,1.2vw,15px)",fontWeight:900,color:"#a8e63d",letterSpacing:"-0.3px",lineHeight:1,marginBottom:4,animation:"LP_countUp .5s ease both"}}>
                {value}
              </div>
              <div style={{fontSize:9,fontWeight:800,color:"#7aaa4a",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>{label}</div>
              <div style={{fontSize:9,color:"#2a3a2a"}}>{note}</div>
            </div>
          ))}
        </div>

        {/* ── Bottom: trust row ── */}
        <div style={{borderTop:"1px solid rgba(168,230,61,.07)",paddingTop:16,marginTop:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          {/* Quote from landing page */}
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:10.5,color:"#2e4a2e",lineHeight:1.7,fontStyle:"italic",margin:0}}>
              "The next social protocol won't be owned by a company.<br/>
              It'll be owned by the people who showed up first."
            </p>
          </div>
          {/* Trust badges */}
          <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
            {[["⛓","Web3"],["🏦","Paystack"],["🔐","Encrypted"]].map(([ic,lb])=>(
              <div key={lb} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:8.5,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",color:"#2a4a1a",background:"rgba(168,230,61,.04)",border:"1px solid rgba(168,230,61,.1)",borderRadius:100,padding:"3px 8px",whiteSpace:"nowrap"}}>
                <span>{ic}</span><span>{lb}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Provider icons ───────────────────────────────────────────────────────────
const GI = () => <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
const XII = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="#ccc" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const FbI = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="#1877F2" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const DcI = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="#5865F2" aria-hidden><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>;

// ─── Provider button ──────────────────────────────────────────────────────────
function ProviderBtn({ icon, label, rgb, delay, state, onClick }) {
  const [hov, setHov] = useState(false);
  const [vis, setVis] = useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVis(true),delay);return()=>clearTimeout(t);},[delay]);
  const sel=state==="selected",other=state==="other";
  const short=label.replace("Continue with ","");
  return (
    <button onClick={!sel&&!other?onClick:undefined} disabled={other}
      onMouseEnter={()=>!sel&&!other&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"block",width:"100%",border:"none",background:"none",padding:0,marginBottom:10,cursor:sel||other?"default":"pointer",fontFamily:"'DM Sans',sans-serif",opacity:vis?(other?.18:1):0,transform:vis?"translateY(0)":"translateY(18px)",transition:`opacity .5s ease ${delay}ms,transform .5s cubic-bezier(.23,1,.32,1) ${delay}ms`}}
    >
      <div style={{position:"relative",overflow:"hidden",display:"grid",gridTemplateColumns:"50px 1fr 34px",alignItems:"center",padding:"14px 16px",borderRadius:14,border:sel?`1.5px solid rgba(${rgb},.65)`:hov?`1.5px solid rgba(${rgb},.38)`:"1.5px solid rgba(255,255,255,.055)",background:sel?`rgba(${rgb},.09)`:hov?`rgba(${rgb},.05)`:"rgba(255,255,255,.02)",boxShadow:sel?`0 0 36px rgba(${rgb},.18),inset 0 1px 0 rgba(255,255,255,.04)`:hov?"0 8px 32px rgba(0,0,0,.5)":"none",transform:hov&&!sel?"translateY(-2px)":"none",transition:"all .2s ease"}}>
        {sel&&<div style={{position:"absolute",inset:0,transformOrigin:"left",background:`linear-gradient(90deg,rgba(${rgb},.13),rgba(${rgb},.03))`,animation:"B_sweep .55s cubic-bezier(.23,1,.32,1) forwards"}}/>}
        <span style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
          {sel?<div style={{width:20,height:20,border:`2px solid rgba(${rgb},.2)`,borderTopColor:`rgb(${rgb})`,borderRadius:"50%",animation:"XV_spin .7s linear infinite"}}/>:icon}
        </span>
        <span style={{fontSize:14,fontWeight:500,textAlign:"center",position:"relative",zIndex:1,transition:"color .2s",color:sel?"var(--text)":hov?"#a0b4a0":"#485848"}}>
          {sel?`Opening ${short}…`:label}
        </span>
        <span style={{display:"flex",alignItems:"center",justifyContent:"flex-end",position:"relative",zIndex:1}}>
          {sel&&<div style={{width:6,height:6,borderRadius:"50%",background:`rgb(${rgb})`,boxShadow:`0 0 8px rgba(${rgb},1)`,animation:"XV_spin 2s ease infinite"}}/>}
          {!sel&&!other&&hov&&<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden><path d="M2.5 6.5h8M7 4l3 2.5L7 9" stroke={`rgb(${rgb})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.65"/></svg>}
        </span>
      </div>
    </button>
  );
}

// ─── LOGIN VIEW ───────────────────────────────────────────────────────────────
function LoginView() {
  const [status,setStatus]=useState("idle");
  const [provider,setProvider]=useState(null);
  const [errMsg,setErrMsg]=useState("");
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

  const go=useCallback(async(p)=>{
    if(status==="loading")return;
    setErrMsg("");setProvider(p);setStatus("loading");
    try{
      await authService.signInOAuth(p);
    }catch(e){
      if(!mounted.current)return;
      const msg=(e?.message||"");
      if(/cancel|denied|access_denied|closed|popup/i.test(msg)){setErrMsg(msg);setStatus("declined");}
      else{setErrMsg(msg||"Sign-in failed. Please try again.");setStatus("idle");setProvider(null);}
    }
  },[status]);

  const retry=useCallback(()=>{setStatus("idle");setProvider(null);setErrMsg("");},[]);

  if(status==="declined")return <DeclinedScreen message={errMsg} onRetry={retry}/>;

  const PROVIDERS=[
    {id:"google",  icon:<GI/>, label:"Continue with Google",  rgb:"66,133,244", delay:0},
    {id:"x",       icon:<XII/>,label:"Continue with X",        rgb:"210,210,210",delay:65},
    {id:"facebook",icon:<FbI/>,label:"Continue with Facebook", rgb:"24,119,242", delay:130},
    {id:"discord", icon:<DcI/>,label:"Continue with Discord",  rgb:"88,101,242", delay:195},
  ];

  return (
    <div style={{width:"100%"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(32px,5vw,46px)",letterSpacing:"2px",lineHeight:1,color:"var(--text)",animation:"XV_riseIn .65s ease .05s both",opacity:0}}>WELCOME BACK</div>
        <div style={{fontSize:13,fontWeight:400,color:"var(--dim)",marginTop:8,animation:"XV_riseIn .65s ease .14s both",opacity:0}}>Sign in to continue to Xeevia</div>
        <div style={{width:34,height:2,marginTop:13,background:"linear-gradient(90deg,var(--lime),transparent)",animation:"XV_fadeIn .8s ease .22s both",opacity:0}}/>
      </div>
      {errMsg&&status==="idle"&&(
        <div style={{marginBottom:12,padding:"11px 14px",borderRadius:11,border:"1px solid rgba(224,82,82,.2)",background:"rgba(224,82,82,.05)",color:"#a06060",fontSize:13,display:"flex",gap:9,animation:"XV_riseIn .3s ease"}}>
          <span>⚠</span><span>{errMsg}</span>
        </div>
      )}
      <div>
        {PROVIDERS.map(p=>(
          <ProviderBtn key={p.id} icon={p.icon} label={p.label} rgb={p.rgb} delay={p.delay}
            state={status==="loading"?(provider===p.id?"selected":"other"):"idle"}
            onClick={()=>go(p.id)}
          />
        ))}
      </div>
      <div style={{marginTop:18,fontSize:11,color:"#192019",lineHeight:2,animation:"XV_fadeIn 1s ease .55s both",opacity:0}}>
        By continuing you agree to our{" "}
        <span style={{color:"#253025",textDecoration:"underline",cursor:"pointer"}}>Terms</span>{" & "}
        <span style={{color:"#253025",textDecoration:"underline",cursor:"pointer"}}>Privacy</span>
      </div>
    </div>
  );
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
export function Splash() {
  return (
    <div style={{minHeight:"100dvh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}} className="xv">
      <style>{CSS}</style><Grain/><Corners/><ScanLine/>
      <div aria-hidden style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:740,height:740,borderRadius:"50%",background:"radial-gradient(circle,rgba(168,230,61,.08) 0%,transparent 65%)",animation:"S_glow 5.5s ease-in-out infinite",pointerEvents:"none",zIndex:0}}/>
      <div style={{textAlign:"center",position:"relative",zIndex:2}}>
        <div style={{display:"flex",justifyContent:"center",gap:"0.01em",marginBottom:18}} aria-label="XEEVIA">
          {"XEEVIA".split("").map((ch,i)=>(
            <span key={i} aria-hidden style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(84px,17vw,146px)",letterSpacing:"5px",lineHeight:1,backgroundImage:"linear-gradient(175deg,#e8ff9a 0%,#a8e63d 38%,#5a9a10 100%)",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",display:"inline-block",animation:`S_letter .9s cubic-bezier(.23,1,.32,1) ${i*.18}s both`}}>{ch}</span>
          ))}
        </div>
        <div style={{fontSize:10,letterSpacing:"5px",textTransform:"uppercase",fontWeight:500,color:"var(--lime)",animation:"S_tagline 1.1s ease 2.0s forwards",opacity:0}}>Own Your Social Capital</div>
        <div style={{marginTop:56,display:"flex",justifyContent:"center",animation:"XV_fadeIn .7s ease 2.25s both",opacity:0}}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
            <circle cx="22" cy="22" r="18" stroke="rgba(168,230,61,.07)" strokeWidth="2"/>
            <circle cx="22" cy="22" r="18" stroke="url(#arcg)" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="251" style={{animation:"S_arc 2.1s ease-in-out infinite",transformOrigin:"22px 22px",transform:"rotate(-90deg)"}}/>
            <circle cx="22" cy="22" r="2.8" fill="rgba(168,230,61,.55)" style={{animation:"S_glow 2.1s ease-in-out infinite"}}/>
            <defs><linearGradient id="arcg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="rgba(168,230,61,0)"/><stop offset="55%" stopColor="rgba(168,230,61,.6)"/><stop offset="100%" stopColor="#a8e63d"/></linearGradient></defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── AUTH WALL — root export ──────────────────────────────────────────────────
export default function AuthWall({ paywall = false }) {
  if (paywall) return <PaywallGate/>;
  return (
    <div style={{minHeight:"100dvh",background:"var(--bg)",display:"flex",alignItems:"stretch",position:"relative",overflow:"hidden"}} className="xv">
      <style>{CSS}</style>
      <Grain/><Corners/><ScanLine/>

      {/* Left panel */}
      <div className="xv-left" style={{flex:"0 0 46%",position:"relative",overflow:"hidden"}}>
        <LeftPanel/>
      </div>

      {/* Right panel */}
      <div className="xv-right" style={{flex:"1 1 54%",display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 28px",position:"relative",zIndex:2}}>
        <div style={{width:"100%",maxWidth:375}}>
          <LoginView/>
        </div>
      </div>
    </div>
  );
}