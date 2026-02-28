// src/components/Upgrade/UpgradeView.jsx
// Silver / Gold / Diamond profile boost tiers
// Each tier: avatar border, badge, benefits accordion, pricing
// UI only — no backend calls yet

import React, { useState } from "react";
import { Crown, Sparkles, Diamond, ChevronDown, Check, Zap, X } from "lucide-react";

const TIERS = [
  {
    id:      "silver",
    name:    "Silver Boost",
    tagline: "Stand out from the crowd",
    emoji:   "🥈",
    price:   { monthly: 4.99, yearly: 3.99 },
    color:   "#c0c0c0",
    glow:    "rgba(192,192,192,0.35)",
    grad:    ["#c0c0c0","#9ca3af"],
    icon:    Sparkles,
    border:  "2.5px solid #c0c0c0",
    ring:    "0 0 0 3px rgba(192,192,192,0.25), 0 0 18px rgba(192,192,192,0.35)",
    benefits: [
      "Silver border on your avatar everywhere",
      "🥈 Silver badge next to your name",
      "Priority placement in Explore",
      "Posts boosted to 15% more feeds",
      "Access to exclusive Silver community",
      "Custom silver profile frame",
    ],
  },
  {
    id:      "gold",
    name:    "Gold Boost",
    tagline: "Rise to creator status",
    emoji:   "🥇",
    price:   { monthly: 9.99, yearly: 7.99 },
    color:   "#fbbf24",
    glow:    "rgba(251,191,36,0.35)",
    grad:    ["#fbbf24","#d97706"],
    icon:    Crown,
    border:  "2.5px solid #fbbf24",
    ring:    "0 0 0 3px rgba(251,191,36,0.25), 0 0 24px rgba(251,191,36,0.4)",
    popular: true,
    benefits: [
      "Gold animated border on your avatar",
      "👑 Gold verified badge + shimmer effect",
      "Posts boosted to 35% more feeds",
      "Early access to new features",
      "Exclusive Gold creator lounge",
      "5% bonus EP on all earnings",
      "Monthly EP reward drops",
      "Priority creator support",
    ],
  },
  {
    id:      "diamond",
    name:    "Diamond Boost",
    tagline: "Elite. Exclusive. Iconic.",
    emoji:   "💎",
    price:   { monthly: 19.99, yearly: 15.99 },
    color:   "#a78bfa",
    glow:    "rgba(167,139,250,0.35)",
    grad:    ["#a78bfa","#7c3aed"],
    icon:    Sparkles,
    border:  "2.5px solid #a78bfa",
    ring:    "0 0 0 3px rgba(167,139,250,0.3), 0 0 32px rgba(167,139,250,0.5)",
    benefits: [
      "Diamond animated border — shifts & sparkles",
      "💎 Diamond elite badge with rainbow shimmer",
      "Posts boosted to 65% more feeds",
      "Top placement in Explore & trending",
      "15% bonus EP on ALL activity",
      "Access to Diamond private beta features",
      "Diamond-exclusive content toolkit",
      "Dedicated VIP support channel",
      "Free gift card every month (500 EP)",
      "Creator analytics — advanced metrics",
    ],
  },
];

// Animated avatar preview
const AvatarPreview = ({ tier, currentUser }) => {
  const letter = (currentUser?.fullName || currentUser?.name || "U").charAt(0).toUpperCase();
  return (
    <div className="up-avatar-preview" style={{ "--glow": tier.glow }}>
      <div className="up-avatar-ring"
        style={{ border: tier.border, boxShadow: tier.ring }}>
        <div className="up-avatar-inner"
          style={{ background: `linear-gradient(135deg,${tier.grad[0]},${tier.grad[1]})` }}>
          <span>{letter}</span>
        </div>
      </div>
      <div className="up-avatar-badge" style={{ background: `linear-gradient(135deg,${tier.grad[0]},${tier.grad[1]})` }}>
        <tier.icon size={10} color="#000"/>
      </div>
    </div>
  );
};

// Single tier card
const TierCard = ({ tier, billing, expanded, onExpand, onSelect, selected, currentUser }) => {
  const price = billing === "monthly" ? tier.price.monthly : tier.price.yearly;
  const save  = billing === "yearly" ? Math.round((1 - tier.price.yearly/tier.price.monthly)*100) : 0;

  return (
    <div className={`up-card${selected===tier.id?" is-selected":""}`}
      style={{ "--c":tier.color, "--glow":tier.glow, animationDelay:`${TIERS.indexOf(tier)*0.08}s` }}>

      {tier.popular && (
        <div className="up-popular-badge">⭐ Most Popular</div>
      )}

      {/* Header */}
      <div className="up-card-header" onClick={onExpand}>
        <div className="up-card-left">
          <AvatarPreview tier={tier} currentUser={currentUser}/>
          <div>
            <div className="up-tier-name" style={{ color: tier.color }}>{tier.emoji} {tier.name}</div>
            <div className="up-tier-tag">{tier.tagline}</div>
          </div>
        </div>
        <div className="up-card-right">
          <div className="up-price-wrap">
            <span className="up-price" style={{ color: tier.color }}>${price}</span>
            <span className="up-price-per">/mo</span>
          </div>
          {save > 0 && <div className="up-save">Save {save}%</div>}
          <ChevronDown size={14} color={tier.color} className={`up-chev${expanded?" open":""}`}/>
        </div>
      </div>

      {/* Benefits accordion */}
      <div className={`up-benefits${expanded?" open":""}`}>
        <div className="up-benefits-inner">
          {tier.benefits.map((b, i) => (
            <div key={i} className="up-benefit" style={{ animationDelay:`${i*0.04}s` }}>
              <div className="up-benefit-check" style={{ background:`${tier.color}18`, border:`1px solid ${tier.color}30` }}>
                <Check size={10} color={tier.color}/>
              </div>
              <span>{b}</span>
            </div>
          ))}
          <button className="up-select-btn"
            style={{ background:`linear-gradient(135deg,${tier.grad[0]},${tier.grad[1]})`,
              boxShadow:`0 6px 20px ${tier.glow}` }}
            onClick={() => onSelect(tier.id)}>
            {selected === tier.id ? "✓ Selected" : `Get ${tier.name}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const UpgradeView = ({ currentUser, onClose }) => {
  const [billing,  setBilling]  = useState("monthly");
  const [expanded, setExpanded] = useState("gold");  // default expand gold
  const [selected, setSelected] = useState(null);
  const [confirmed,setConfirmed]= useState(false);

  const selectedTier = TIERS.find(t => t.id === selected);

  return (
    <div className="up-root">
      <style>{`
        @keyframes upFadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes upGlow{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes upShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes upPop{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
        @keyframes upSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes upRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.5);opacity:0}}
        @keyframes upFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

        .up-root{
          position:fixed;inset:0;z-index:9500;
          background:#060606;overflow-y:auto;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* TOP BAR */
        .up-topbar{
          position:sticky;top:0;z-index:10;
          display:flex;align-items:center;gap:12px;
          padding:12px 16px;
          background:rgba(6,6,6,0.97);backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(251,191,36,0.12);
        }
        .up-back{
          width:34px;height:34px;border-radius:10px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;color:#737373;font-size:18px;transition:all .18s;
        }
        .up-back:hover{background:rgba(255,255,255,0.1);color:#fff;}
        .up-title{font-size:17px;font-weight:900;color:#fff;flex:1;}
        .up-spark-icon{
          width:34px;height:34px;border-radius:10px;
          background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(251,191,36,0.05));
          border:1px solid rgba(251,191,36,0.25);
          display:flex;align-items:center;justify-content:center;
        }

        /* HERO */
        .up-hero{
          padding:32px 20px 24px;text-align:center;
          background:radial-gradient(ellipse at top,rgba(251,191,36,0.06) 0%,transparent 60%);
        }
        .up-hero-icon{
          width:72px;height:72px;border-radius:22px;margin:0 auto 18px;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,191,36,0.06));
          border:1px solid rgba(251,191,36,0.3);
          box-shadow:0 8px 32px rgba(251,191,36,0.2);
          animation:upFloat 3s ease-in-out infinite;
          font-size:34px;
        }
        .up-hero-title{font-size:24px;font-weight:900;color:#fff;margin:0 0 8px;}
        .up-hero-sub{font-size:14px;color:#525252;line-height:1.6;margin:0;}

        /* BILLING TOGGLE */
        .up-billing-wrap{display:flex;justify-content:center;padding:0 20px 20px;}
        .up-billing{
          display:flex;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:12px;padding:3px;gap:2px;
        }
        .up-bill-btn{
          padding:8px 20px;border-radius:9px;border:none;
          font-size:12.5px;font-weight:800;cursor:pointer;
          transition:all .22s;color:#525252;background:transparent;
          display:flex;align-items:center;gap:6px;
        }
        .up-bill-btn.active{
          background:rgba(251,191,36,0.12);
          border:1px solid rgba(251,191,36,0.25);
          color:#fbbf24;
        }
        .up-save-pill{
          padding:1px 6px;border-radius:5px;
          background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.25);
          color:#22c55e;font-size:9.5px;font-weight:800;
        }

        /* CARDS */
        .up-cards{display:flex;flex-direction:column;gap:10px;padding:0 14px 20px;}

        .up-card{
          background:rgba(255,255,255,0.025);
          border:1.5px solid rgba(255,255,255,0.07);
          border-radius:20px;overflow:hidden;
          position:relative;
          animation:upFadeUp .3s ease both;
          transition:border-color .25s,box-shadow .25s;
        }
        .up-card.is-selected{
          border-color:color-mix(in srgb,var(--c) 45%,transparent);
          box-shadow:0 8px 32px var(--glow);
        }

        .up-popular-badge{
          position:absolute;top:0;left:50%;transform:translateX(-50%);
          padding:3px 14px;border-radius:0 0 10px 10px;
          background:linear-gradient(90deg,#fbbf24,#d97706);
          font-size:10px;font-weight:800;color:#000;
          z-index:2;
        }

        .up-card-header{
          display:flex;align-items:center;justify-content:space-between;
          padding:16px;cursor:pointer;
          transition:background .18s;
          padding-top:22px;
        }
        .up-popular-badge ~ .up-card-header{padding-top:26px;}
        .up-card:hover .up-card-header{background:rgba(255,255,255,0.02);}
        .up-card-left{display:flex;align-items:center;gap:12px;}
        .up-card-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px;}

        /* Avatar preview */
        .up-avatar-preview{position:relative;flex-shrink:0;}
        .up-avatar-ring{
          width:42px;height:42px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          transition:box-shadow .3s;
        }
        .up-avatar-inner{
          width:36px;height:36px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;font-weight:900;color:#000;
        }
        .up-avatar-badge{
          position:absolute;bottom:-2px;right:-2px;
          width:16px;height:16px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          border:2px solid #060606;
        }

        .up-tier-name{font-size:14px;font-weight:900;line-height:1.1;}
        .up-tier-tag{font-size:11px;color:#525252;font-weight:500;margin-top:2px;}

        .up-price-wrap{display:flex;align-items:baseline;gap:2px;}
        .up-price{font-size:18px;font-weight:900;}
        .up-price-per{font-size:11px;color:#525252;font-weight:600;}
        .up-save{font-size:9.5px;font-weight:800;color:#22c55e;
          padding:1px 6px;background:rgba(34,197,94,0.1);
          border:1px solid rgba(34,197,94,0.2);border-radius:5px;}
        .up-chev{transition:transform .25s;flex-shrink:0;}
        .up-chev.open{transform:rotate(180deg);}

        /* Benefits accordion */
        .up-benefits{
          max-height:0;overflow:hidden;
          transition:max-height .35s cubic-bezier(.4,0,.2,1);
        }
        .up-benefits.open{max-height:600px;}
        .up-benefits-inner{padding:4px 16px 16px;}
        .up-benefit{
          display:flex;align-items:flex-start;gap:10px;
          padding:7px 0;
          border-bottom:1px solid rgba(255,255,255,0.04);
          font-size:13px;color:#c4c4c4;font-weight:500;
          animation:upFadeUp .25s ease both;
        }
        .up-benefit:last-of-type{border-bottom:none;}
        .up-benefit-check{
          width:20px;height:20px;border-radius:6px;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;margin-top:1px;
        }

        .up-select-btn{
          width:100%;margin-top:14px;padding:13px;
          border-radius:13px;border:none;
          color:#000;font-size:14px;font-weight:900;
          cursor:pointer;transition:all .2s;
        }
        .up-select-btn:hover{transform:translateY(-2px);filter:brightness(1.1);}
        .up-select-btn:active{transform:scale(0.97);}

        /* CONFIRM BAR */
        .up-confirm-bar{
          position:sticky;bottom:80px;left:0;right:0;z-index:20;
          margin:0 14px 10px;
          background:rgba(10,10,10,0.95);backdrop-filter:blur(20px);
          border:1px solid rgba(132,204,22,0.2);
          border-radius:18px;padding:14px 16px;
          animation:upFadeUp .3s cubic-bezier(.34,1.4,.64,1);
          box-shadow:0 8px 32px rgba(0,0,0,0.5);
        }
        .up-confirm-title{font-size:13px;font-weight:900;color:#fff;margin:0 0 2px;}
        .up-confirm-sub{font-size:11px;color:#525252;margin:0 0 12px;}
        .up-confirm-btn{
          width:100%;padding:13px;border-radius:12px;border:none;
          font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;
          background:linear-gradient(135deg,#84cc16,#4d7c0f);color:#000;
          box-shadow:0 6px 20px rgba(132,204,22,0.38);
        }
        .up-confirm-btn:hover{transform:translateY(-2px);}

        /* SUCCESS */
        .up-success{
          display:flex;flex-direction:column;align-items:center;
          text-align:center;padding:60px 24px;
        }
        .up-success-emoji{font-size:72px;margin-bottom:20px;animation:upPop .5s cubic-bezier(.34,1.56,.64,1);}
        .up-success-title{font-size:26px;font-weight:900;color:#fff;margin:0 0 8px;}
        .up-success-sub{font-size:14px;color:#525252;margin:0;line-height:1.6;}
      `}</style>

      {/* TOP BAR */}
      <div className="up-topbar">
        <button className="up-back" onClick={onClose}>‹</button>
        <span className="up-title">Upgrade</span>
        <div className="up-spark-icon"><Crown size={16} color="#fbbf24"/></div>
      </div>

      {confirmed && selectedTier ? (
        <div className="up-success">
          <div className="up-success-emoji">{selectedTier.emoji}</div>
          <h2 className="up-success-title">{selectedTier.name} Active!</h2>
          <p className="up-success-sub">
            Your profile has been boosted.<br/>
            Your {selectedTier.name} perks are now live across the platform.
          </p>
        </div>
      ) : (
        <>
          {/* HERO */}
          <div className="up-hero">
            <div className="up-hero-icon">👑</div>
            <h2 className="up-hero-title">Boost Your Profile</h2>
            <p className="up-hero-sub">
              Stand out with a shimmering border, earn more EP,<br/>
              and unlock exclusive creator perks.
            </p>
          </div>

          {/* BILLING TOGGLE */}
          <div className="up-billing-wrap">
            <div className="up-billing">
              <button className={`up-bill-btn${billing==="monthly"?" active":""}`}
                onClick={() => setBilling("monthly")}>Monthly</button>
              <button className={`up-bill-btn${billing==="yearly"?" active":""}`}
                onClick={() => setBilling("yearly")}>
                Yearly <span className="up-save-pill">Save ~20%</span>
              </button>
            </div>
          </div>

          {/* TIER CARDS */}
          <div className="up-cards">
            {TIERS.map(tier => (
              <TierCard
                key={tier.id} tier={tier} billing={billing}
                expanded={expanded===tier.id}
                onExpand={() => setExpanded(p => p===tier.id ? null : tier.id)}
                onSelect={setSelected}
                selected={selected}
                currentUser={currentUser}
              />
            ))}
          </div>

          {/* CONFIRM BAR */}
          {selected && (
            <div className="up-confirm-bar">
              <p className="up-confirm-title">
                {selectedTier?.emoji} {selectedTier?.name} — ${billing==="monthly"?selectedTier?.price.monthly:selectedTier?.price.yearly}/mo
              </p>
              <p className="up-confirm-sub">
                Billed {billing === "monthly" ? "monthly" : "annually"} · Cancel anytime
              </p>
              <button className="up-confirm-btn" onClick={() => setConfirmed(true)}>
                Activate Boost →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UpgradeView;