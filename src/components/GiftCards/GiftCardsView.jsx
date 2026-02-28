// src/components/GiftCards/GiftCardsView.jsx
import React, { useState } from "react";
import { ChevronDown, Gift, Send, Tag, CheckCircle, Copy, Sparkles, Zap, Crown, Heart } from "lucide-react";

const CARDS = [
  { id:"gc1", name:"Starter Spark",  value:500,  price:5,   color:["#84cc16","#4d7c0f"], emoji:"⚡", badge:"Popular",  desc:"Perfect for gifting a friend their first EP boost." },
  { id:"gc2", name:"Creator Fuel",   value:1500, price:15,  color:["#60a5fa","#2563eb"], emoji:"🚀", badge:"Best Value",desc:"Give the gift of engagement. 1,500 EP to spend freely." },
  { id:"gc3", name:"Gold Rush",      value:3000, price:28,  color:["#fbbf24","#d97706"], emoji:"👑", badge:"Fan Fave",  desc:"A golden gift. 3,000 EP plus a special gold frame effect for 7 days." },
  { id:"gc4", name:"Diamond Drop",   value:6000, price:50,  color:["#a78bfa","#7c3aed"], emoji:"💎", badge:"Premium",  desc:"The ultimate gift. 6,000 EP + diamond badge for recipient for 14 days." },
  { id:"gc5", name:"Custom Spark",   value:null, price:null,color:["#f472b6","#be185d"], emoji:"✨", badge:"Custom",   desc:"Choose your own EP amount. Set your own value from $1 to $500." },
];

const OCCASIONS = ["Birthday 🎂","Thank You 🙏","Congrats 🎉","Just Because 💚","Apology 😅","Celebration 🥂"];

const GiftCardsView = ({ currentUser, onClose }) => {
  const [tab,       setTab]       = useState("buy");       // buy | redeem | history
  const [selected,  setSelected]  = useState(null);
  const [occasion,  setOccasion]  = useState("");
  const [recipient, setRecipient] = useState("");
  const [message,   setMessage]   = useState("");
  const [customAmt, setCustomAmt] = useState("");
  const [redeemCode,setRedeemCode]= useState("");
  const [phase,     setPhase]     = useState("browse");    // browse | configure | confirm | success
  const [copied,    setCopied]    = useState(false);

  // Demo generated code
  const DEMO_CODE = "GC-X4K2-9M7R-GROVA";

  const copyCode = () => {
    navigator.clipboard?.writeText(DEMO_CODE).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  const handleBuy = () => {
    if (!selected) return;
    if (phase === "browse")   { setPhase("configure"); return; }
    if (phase === "configure"){ setPhase("confirm");   return; }
    if (phase === "confirm")  { setPhase("success");   return; }
  };

  const reset = () => { setPhase("browse"); setSelected(null); setOccasion(""); setRecipient(""); setMessage(""); };

  const card = CARDS.find(c => c.id === selected);

  return (
    <div className="gc-root">
      <style>{`
        @keyframes gcSlideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes gcGlow{0%,100%{box-shadow:0 0 20px rgba(132,204,22,0.25);}50%{box-shadow:0 0 40px rgba(132,204,22,0.5);}}
        @keyframes gcShimmer{0%{left:-100%;}100%{left:100%;}}
        @keyframes gcPop{0%{transform:scale(0.8);opacity:0;}60%{transform:scale(1.08);}100%{transform:scale(1);opacity:1;}}
        @keyframes gcFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}

        .gc-root {
          position:fixed;inset:0;z-index:9500;
          background:#060606;overflow-y:auto;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* ── TOP BAR ── */
        .gc-topbar {
          position:sticky;top:0;z-index:10;
          display:flex;align-items:center;gap:12px;
          padding:12px 16px;
          background:rgba(6,6,6,0.97);backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .gc-back {
          width:34px;height:34px;border-radius:10px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#737373;transition:all 0.18s;
          font-size:18px;line-height:1;
        }
        .gc-back:hover{background:rgba(255,255,255,0.1);color:#fff;}
        .gc-title-wrap{flex:1;}
        .gc-title{font-size:17px;font-weight:900;color:#fff;}
        .gc-sub{font-size:11px;color:#525252;font-weight:500;}

        /* Tabs */
        .gc-tabs {
          display:flex;margin:16px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:13px;padding:3px;gap:2px;
        }
        .gc-tab {
          flex:1;padding:9px;border-radius:10px;border:none;
          font-size:12.5px;font-weight:800;cursor:pointer;
          transition:all 0.22s;color:#525252;background:transparent;
        }
        .gc-tab.active{
          background:rgba(132,204,22,0.1);border:1px solid rgba(132,204,22,0.22);
          color:#84cc16;box-shadow:0 2px 10px rgba(132,204,22,0.15);
        }

        /* ── BUY FLOW ── */
        .gc-body{padding:0 16px 100px;}

        /* Card grid */
        .gc-cards{display:flex;flex-direction:column;gap:12px;}
        .gc-card{
          border-radius:20px;overflow:hidden;cursor:pointer;
          border:1.5px solid rgba(255,255,255,0.07);
          transition:all 0.26s cubic-bezier(0.34,1.4,0.64,1);
          animation:gcSlideUp 0.3s ease both;
          position:relative;
        }
        .gc-card:hover,.gc-card.sel{
          transform:translateY(-4px) scale(1.02);
          border-color:rgba(132,204,22,0.3);
          box-shadow:0 12px 32px rgba(0,0,0,0.4);
        }
        .gc-card.sel{border-width:2px;}
        .gc-card-inner{
          display:flex;align-items:center;gap:14px;
          padding:16px;background:rgba(255,255,255,0.025);
        }
        .gc-card-emoji-wrap{
          width:56px;height:56px;border-radius:16px;
          display:flex;align-items:center;justify-content:center;
          font-size:26px;flex-shrink:0;position:relative;overflow:hidden;
        }
        .gc-card-emoji-wrap::after{
          content:'';position:absolute;inset:0;
          background:linear-gradient(45deg,transparent,rgba(255,255,255,0.15),transparent);
          transform:translateX(-100%);transition:transform 0.5s;
        }
        .gc-card:hover .gc-card-emoji-wrap::after{transform:translateX(100%);}
        .gc-card-info{flex:1;min-width:0;}
        .gc-card-name{font-size:15px;font-weight:900;color:#fff;margin:0 0 3px;}
        .gc-card-desc{font-size:11.5px;color:#525252;margin:0 0 7px;line-height:1.4;}
        .gc-card-price-row{display:flex;align-items:center;gap:8px;}
        .gc-card-badge{
          padding:2px 8px;border-radius:6px;
          font-size:9.5px;font-weight:800;
        }
        .gc-card-price{font-size:15px;font-weight:900;}
        .gc-card-ep{font-size:11px;color:#525252;font-weight:600;}
        .gc-sel-check{flex-shrink:0;animation:gcPop 0.3s ease;}

        /* Configure */
        .gc-config-section{margin-bottom:20px;}
        .gc-config-label{font-size:11px;font-weight:800;color:#525252;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:block;}
        .gc-occasions{display:flex;flex-wrap:wrap;gap:6px;}
        .gc-occ{
          padding:7px 13px;border-radius:9px;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
          color:#525252;font-size:12px;font-weight:700;cursor:pointer;
          transition:all 0.18s;
        }
        .gc-occ.sel{background:rgba(132,204,22,0.1);border-color:rgba(132,204,22,0.3);color:#84cc16;}
        .gc-input{
          width:100%;padding:12px 14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.09);
          border-radius:12px;color:#fff;font-size:14px;
          outline:none;caret-color:#84cc16;
          transition:border-color 0.2s;box-sizing:border-box;
        }
        .gc-input:focus{border-color:rgba(132,204,22,0.38);}
        textarea.gc-input{resize:none;height:80px;line-height:1.5;}

        /* Preview card */
        .gc-preview{
          border-radius:20px;overflow:hidden;margin-bottom:20px;
          position:relative;padding:24px;
        }
        .gc-preview-shine{
          position:absolute;inset:0;
          background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,0.06) 50%,transparent 70%);
          animation:gcShimmer 3s ease-in-out infinite;pointer-events:none;
          overflow:hidden;
        }
        .gc-preview-emoji{font-size:40px;margin-bottom:12px;display:block;animation:gcFloat 3s ease-in-out infinite;}
        .gc-preview-name{font-size:22px;font-weight:900;color:#fff;margin:0 0 4px;}
        .gc-preview-val{font-size:14px;font-weight:700;color:rgba(255,255,255,0.7);margin:0 0 12px;}
        .gc-preview-msg{font-size:13px;color:rgba(255,255,255,0.6);font-style:italic;line-height:1.5;}
        .gc-preview-code{
          margin-top:16px;padding:10px 14px;
          background:rgba(0,0,0,0.3);border-radius:10px;
          font-size:13px;font-weight:800;color:rgba(255,255,255,0.9);
          letter-spacing:1px;text-align:center;
        }

        /* Success */
        .gc-success{
          display:flex;flex-direction:column;align-items:center;
          text-align:center;padding:40px 24px;
        }
        .gc-success-icon{font-size:72px;margin-bottom:20px;animation:gcPop 0.5s cubic-bezier(0.34,1.56,0.64,1);}
        .gc-success-title{font-size:26px;font-weight:900;color:#fff;margin:0 0 8px;}
        .gc-success-sub{font-size:14px;color:#525252;margin:0 0 28px;line-height:1.6;}
        .gc-code-box{
          width:100%;background:rgba(132,204,22,0.06);
          border:1px solid rgba(132,204,22,0.2);
          border-radius:14px;padding:16px;margin-bottom:24px;
          position:relative;cursor:pointer;transition:background 0.2s;
        }
        .gc-code-box:hover{background:rgba(132,204,22,0.1);}
        .gc-code-label{font-size:10px;font-weight:800;color:#525252;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
        .gc-code-val{font-size:18px;font-weight:900;color:#84cc16;letter-spacing:2px;}
        .gc-copy-hint{font-size:10.5px;color:#525252;margin-top:6px;}

        /* Redeem */
        .gc-redeem{padding:20px 0;}
        .gc-redeem-hero{text-align:center;margin-bottom:28px;}
        .gc-redeem-icon{font-size:56px;margin-bottom:14px;animation:gcFloat 3s ease-in-out infinite;}
        .gc-redeem-title{font-size:22px;font-weight:900;color:#fff;margin:0 0 8px;}
        .gc-redeem-sub{font-size:13px;color:#525252;line-height:1.6;}

        /* CTA button */
        .gc-btn{
          width:100%;padding:14px;border-radius:13px;
          font-size:14px;font-weight:900;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:8px;
          border:none;transition:all 0.2s;margin-top:12px;
        }
        .gc-btn-primary{
          background:linear-gradient(135deg,#84cc16,#4d7c0f);color:#000;
          box-shadow:0 6px 20px rgba(132,204,22,0.38);
          animation:gcGlow 3s ease-in-out infinite;
        }
        .gc-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(132,204,22,0.55);}
        .gc-btn-ghost{
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09)!important;
          color:#737373;
        }
        .gc-btn-ghost:hover{background:rgba(255,255,255,0.08);color:#a3a3a3;}
      `}</style>

      {/* ── TOP BAR ── */}
      <div className="gc-topbar">
        <button className="gc-back" onClick={onClose}>‹</button>
        <div className="gc-title-wrap">
          <div className="gc-title">Gift Cards</div>
          <div className="gc-sub">Buy, send & redeem EP gift cards</div>
        </div>
        <Gift size={20} color="#34d399"/>
      </div>

      {/* ── TABS ── */}
      <div className="gc-tabs">
        {[["buy","Buy & Send"],["redeem","Redeem"],["history","History"]].map(([k,l]) => (
          <button key={k} className={`gc-tab${tab===k?" active":""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="gc-body">

        {/* ══ BUY ══ */}
        {tab === "buy" && (
          <>
            {phase === "browse" && (
              <>
                <p style={{ fontSize:12,color:"#525252",fontWeight:600,marginBottom:14,paddingLeft:4 }}>
                  Choose a gift card — recipient gets EP instantly
                </p>
                <div className="gc-cards">
                  {CARDS.map((c, i) => (
                    <div key={c.id} className={`gc-card${selected===c.id?" sel":""}`}
                      style={{ animationDelay:`${i*0.06}s`, borderColor: selected===c.id ? c.color[0]+"66" : undefined }}
                      onClick={() => setSelected(c.id)}>
                      <div className="gc-card-inner">
                        <div className="gc-card-emoji-wrap"
                          style={{ background:`linear-gradient(135deg,${c.color[0]}22,${c.color[1]}11)`, border:`1px solid ${c.color[0]}33` }}>
                          {c.emoji}
                        </div>
                        <div className="gc-card-info">
                          <p className="gc-card-name">{c.name}</p>
                          <p className="gc-card-desc">{c.desc}</p>
                          <div className="gc-card-price-row">
                            <span className="gc-card-badge"
                              style={{ background:`${c.color[0]}18`,color:c.color[0],border:`1px solid ${c.color[0]}30` }}>
                              {c.badge}
                            </span>
                            {c.price
                              ? <span className="gc-card-price" style={{ color:c.color[0] }}>${c.price}</span>
                              : <span className="gc-card-price" style={{ color:c.color[0] }}>Custom</span>
                            }
                            {c.value && <span className="gc-card-ep">{c.value.toLocaleString()} EP</span>}
                          </div>
                        </div>
                        {selected === c.id && <CheckCircle size={20} color={c.color[0]} className="gc-sel-check"/>}
                      </div>
                    </div>
                  ))}
                </div>

                <button className="gc-btn gc-btn-primary" onClick={handleBuy} disabled={!selected}
                  style={{ marginTop:20 }}>
                  <Send size={15}/> Continue to Personalise
                </button>
              </>
            )}

            {phase === "configure" && card && (
              <>
                <p style={{ fontSize:11,color:"#525252",fontWeight:700,marginBottom:16,letterSpacing:".3px" }}>
                  PERSONALISE YOUR GIFT CARD
                </p>

                {/* Custom amount */}
                {card.value === null && (
                  <div className="gc-config-section">
                    <span className="gc-config-label">EP Amount</span>
                    <input className="gc-input" type="number" placeholder="e.g. 2000 EP"
                      value={customAmt} onChange={e => setCustomAmt(e.target.value)}/>
                  </div>
                )}

                <div className="gc-config-section">
                  <span className="gc-config-label">Occasion</span>
                  <div className="gc-occasions">
                    {OCCASIONS.map(o => (
                      <button key={o} className={`gc-occ${occasion===o?" sel":""}`} onClick={() => setOccasion(o)}>{o}</button>
                    ))}
                  </div>
                </div>

                <div className="gc-config-section">
                  <span className="gc-config-label">Recipient Username (optional)</span>
                  <input className="gc-input" placeholder="@username" value={recipient} onChange={e => setRecipient(e.target.value)}/>
                </div>

                <div className="gc-config-section">
                  <span className="gc-config-label">Personal Message</span>
                  <textarea className="gc-input" placeholder="Write a heartfelt note…"
                    value={message} onChange={e => setMessage(e.target.value)}/>
                </div>

                <button className="gc-btn gc-btn-primary" onClick={handleBuy}>
                  Preview Gift Card →
                </button>
                <button className="gc-btn gc-btn-ghost" onClick={() => setPhase("browse")}>← Back</button>
              </>
            )}

            {phase === "confirm" && card && (
              <>
                {/* Visual preview */}
                <div className="gc-preview"
                  style={{ background:`linear-gradient(135deg,${card.color[0]}20,${card.color[1]}12)`,
                    border:`1px solid ${card.color[0]}35` }}>
                  <div className="gc-preview-shine"/>
                  <span className="gc-preview-emoji">{card.emoji}</span>
                  <p className="gc-preview-name">{card.name}</p>
                  <p className="gc-preview-val">
                    {card.value ? `${card.value.toLocaleString()} EP` : `${customAmt} EP`}
                    {card.price ? ` · $${card.price}` : ""}
                  </p>
                  {occasion && <p className="gc-preview-val" style={{ fontSize:12 }}>{occasion}</p>}
                  {message && <p className="gc-preview-msg">"{message}"</p>}
                  <div className="gc-preview-code">Gift Code: {DEMO_CODE}</div>
                </div>

                <button className="gc-btn gc-btn-primary" onClick={handleBuy}
                  style={{ background:`linear-gradient(135deg,${card.color[0]},${card.color[1]})` }}>
                  <Gift size={15}/> Purchase & Send — ${card.price || "Custom"}
                </button>
                <button className="gc-btn gc-btn-ghost" onClick={() => setPhase("configure")}>← Edit</button>
              </>
            )}

            {phase === "success" && card && (
              <div className="gc-success">
                <div className="gc-success-icon">{card.emoji}</div>
                <h2 className="gc-success-title">Gift Sent! 🎉</h2>
                <p className="gc-success-sub">
                  Your {card.name} gift card is ready.<br/>
                  Share the code below.
                </p>
                <div className="gc-code-box" onClick={copyCode}>
                  <p className="gc-code-label">Gift Code</p>
                  <p className="gc-code-val">{DEMO_CODE}</p>
                  <p className="gc-copy-hint">{copied ? "✓ Copied!" : "Tap to copy"}</p>
                </div>
                <button className="gc-btn gc-btn-primary" onClick={reset}>Buy Another Gift Card</button>
              </div>
            )}
          </>
        )}

        {/* ══ REDEEM ══ */}
        {tab === "redeem" && (
          <div className="gc-redeem">
            <div className="gc-redeem-hero">
              <div className="gc-redeem-icon">🎁</div>
              <h2 className="gc-redeem-title">Redeem a Gift Card</h2>
              <p className="gc-redeem-sub">
                Enter your gift code to instantly<br/>add EP to your wallet.
              </p>
            </div>
            <span className="gc-config-label" style={{ display:"block",marginBottom:8 }}>Your Gift Code</span>
            <input className="gc-input" placeholder="GC-XXXX-XXXX-GROVA"
              value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              style={{ letterSpacing:"1.5px",fontWeight:800 }}/>
            <button className="gc-btn gc-btn-primary" disabled={!redeemCode.trim()}
              onClick={() => alert("Redemption coming soon! EP will be credited to your wallet.")}>
              <Zap size={15}/> Redeem EP Now
            </button>
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {tab === "history" && (
          <div style={{ padding:"32px 0",textAlign:"center" }}>
            <div style={{ fontSize:52,marginBottom:16 }}>📜</div>
            <p style={{ fontSize:16,fontWeight:900,color:"#fff",margin:"0 0 8px" }}>No gift card history yet</p>
            <p style={{ fontSize:13,color:"#525252",lineHeight:1.6,marginBottom:24 }}>
              Gift cards you buy or receive will appear here.
            </p>
            <button className="gc-btn gc-btn-primary" onClick={() => setTab("buy")} style={{ maxWidth:200,margin:"0 auto" }}>
              Buy Your First Gift Card
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default GiftCardsView;