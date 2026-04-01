// src/components/Upgrade/UpgradeView.jsx
// ============================================================================
// Boost Upgrade — EP payment + theme picker + live preview.
// Economy: $1 = 100 EP.
//   Silver:  200 EP/mo  | 1,800 EP/yr   ($2/$18)   +1% EP bonus
//   Gold:    500 EP/mo  | 5,000 EP/yr   ($5/$50)   +3% EP bonus
//   Diamond: 1,100 EP/mo| 10,000 EP/yr  ($11/$100) +10% EP bonus
//
// PC LAYOUT: max-width 900px centered, two-column on ≥700px
//   Left  col: tier cards + billing toggle
//   Right col: sticky live preview + confirm sheet
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown, Check, X, RefreshCw,
  AlertCircle, Zap, ToggleLeft, ToggleRight, Info, Shield,
} from "lucide-react";
import { useBoost } from "../../hooks/useBoost";
import { BOOST_TIERS, BOOST_VISUAL } from "../../services/account/profileTierService";
import { THEMES_BY_TIER, getDefaultTheme } from "../../services/boost/boostThemes";
import BoostThemePicker from "../Boost/BoostThemePicker";
import BoostProfileCard from "../Boost/BoostProfileCard";

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtEP   = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);
const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString("en-US",{ month:"short", day:"numeric", year:"numeric" })
  : "—";
const daysUntil = (iso) => iso
  ? Math.max(0, Math.ceil((new Date(iso)-Date.now())/86_400_000)) : 0;

// Corrected EP bonus by tier
const EP_BONUS = { silver: 1, gold: 3, diamond: 10 };

const TIERS = [
  { id:"silver",  popular:false },
  { id:"gold",    popular:true  },
  { id:"diamond", popular:false },
];

// ── Responsive hook ───────────────────────────────────────────────────────
const useIsWide = () => {
  const [wide, setWide] = useState(() => window.innerWidth >= 700);
  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= 700);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return wide;
};

// ── Live avatar preview inside a themed card ──────────────────────────────
const LivePreview = ({ tierId, themeId, currentUser }) => {
  const v      = BOOST_VISUAL[tierId];
  const themes = THEMES_BY_TIER[tierId] ?? [];
  const theme  = themes.find(t => t.id === themeId) ?? themes[0];
  const letter = (currentUser?.fullName || "U").charAt(0).toUpperCase();
  const avatarAnim = theme?.avatar.animation ?? (v?.animStyle ?? "none");

  return (
    <BoostProfileCard tier={tierId} themeId={theme?.id} style={{
      borderRadius:20, padding:"20px 24px",
      display:"flex", flexDirection:"column", alignItems:"center", gap:16,
    }}>
      <div style={{ position:"relative" }}>
        <div style={{
          width:72, height:72, borderRadius:"50%",
          border:  theme?.avatar.border  ?? v?.border,
          boxShadow: theme?.avatar.boxShadow ?? v?.boxShadow,
          animation: avatarAnim,
          display:"flex", alignItems:"center", justifyContent:"center",
          background: v ? `linear-gradient(135deg,${v.grad[0]},${v.grad[1]})` : "#222",
          fontSize:28, fontWeight:900, color:"#000",
        }}>
          {letter}
        </div>
        {v && (
          <div style={{
            position:"absolute", bottom:-2, right:-2,
            width:22, height:22, borderRadius:"50%",
            background:`linear-gradient(135deg,${v.grad[0]},${v.grad[1]})`,
            border:"2px solid #060606",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, boxShadow:`0 2px 8px ${v.glow}`,
          }}>{v.badge}</div>
        )}
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:15, fontWeight:900, color:"#fff", marginBottom:2 }}>
          {currentUser?.fullName ?? "Your Name"}
          <span style={{ marginLeft:6, fontSize:13 }}>{v?.badge}</span>
        </div>
        <div style={{ fontSize:12, color: v?.color ?? "#737373" }}>
          @{currentUser?.username ?? "username"}
        </div>
        {theme && (
          <div style={{
            marginTop:6, padding:"2px 10px", borderRadius:10, display:"inline-block",
            background:`${v?.color ?? "#fff"}18`, border:`1px solid ${v?.color ?? "#fff"}30`,
            fontSize:10, fontWeight:700, color: v?.color ?? "#fff",
          }}>
            {theme.emoji} {theme.name}
          </div>
        )}
        {/* EP bonus pill */}
        <div style={{
          marginTop:6, padding:"2px 10px", borderRadius:10, display:"inline-block",
          background:"rgba(132,204,22,0.12)", border:"1px solid rgba(132,204,22,0.25)",
          fontSize:10, fontWeight:800, color:"#84cc16", marginLeft:6,
        }}>
          +{EP_BONUS[tierId]}% EP
        </div>
      </div>
    </BoostProfileCard>
  );
};

// ── System grant banner ───────────────────────────────────────────────────
const SystemGrantBanner = ({ boost, userId }) => {
  const v  = BOOST_VISUAL[boost.tier];
  const isCeo = boost.grant_reason === "ceo_role_grant";
  return (
    <div style={{
      margin:"16px 0 0", padding:16, borderRadius:18,
      background:`${v.color}10`, border:`1.5px solid ${v.color}38`,
      boxShadow:`0 4px 24px ${v.glow}`,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <Shield size={18} color={v.color} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:900, color:v.color }}>
            {boost.tier.charAt(0).toUpperCase()+boost.tier.slice(1)} Boost
            {isCeo ? " — CEO Grant" : " — Admin Grant"}
          </div>
          <div style={{ fontSize:11, color:"#737373", marginTop:1 }}>
            Complimentary · No EP charged · Permanent
          </div>
        </div>
        <div style={{
          padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:800,
          background:"rgba(132,204,22,0.12)", color:"#84cc16",
          border:"1px solid rgba(132,204,22,0.25)",
        }}>Active</div>
      </div>
      <div style={{ marginTop:12 }}>
        <BoostThemePicker tier={boost.tier} activeId={boost.active_theme_id} userId={userId} />
      </div>
    </div>
  );
};

// ── Active paid boost banner ──────────────────────────────────────────────
const ActiveBoostBanner = ({ boost, userId, onToggleAutoRenew, working, onCancelRequest }) => {
  const v    = BOOST_VISUAL[boost.tier];
  const days = daysUntil(boost.expires_at);
  return (
    <div style={{
      margin:"16px 0 0", padding:16, borderRadius:18,
      background:`${v.color}10`, border:`1.5px solid ${v.color}38`,
      boxShadow:`0 4px 24px ${v.glow}`,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <span style={{ fontSize:22 }}>{v.badge}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:900, color:v.color }}>
            {boost.tier.charAt(0).toUpperCase()+boost.tier.slice(1)} Boost Active
          </div>
          <div style={{ fontSize:11, color:"#737373", marginTop:1 }}>
            {boost.billing==="yearly"?"Annual":"Monthly"} plan · {fmtEP(boost.ep_cost)} EP paid · +{EP_BONUS[boost.tier]}% EP bonus
          </div>
        </div>
        <div style={{
          padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:800,
          background: days<=7 ? "rgba(239,68,68,0.15)" : "rgba(132,204,22,0.12)",
          color:      days<=7 ? "#ef4444"               : "#84cc16",
          border:     days<=7 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(132,204,22,0.25)",
        }}>
          {days<=7 ? `⚠ ${days}d left` : `${days} days`}
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0",
        borderTop:"1px solid rgba(255,255,255,0.05)", marginBottom:12,
        fontSize:12, color:"#a3a3a3",
      }}>
        <span><strong style={{ color:"#fff" }}>Expires:</strong> {fmtDate(boost.expires_at)}</span>
        <span style={{
          fontSize:10, fontWeight:800, color:"#84cc16",
          background:"rgba(132,204,22,0.1)", padding:"2px 8px",
          borderRadius:10, border:"1px solid rgba(132,204,22,0.2)",
        }}>+{EP_BONUS[boost.tier]}% EP bonus active</span>
      </div>
      <div style={{ marginBottom:12 }}>
        <BoostThemePicker tier={boost.tier} activeId={boost.active_theme_id} userId={userId} />
      </div>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 12px", borderRadius:12, marginBottom:10,
        background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
      }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>Auto-Renew</div>
          <div style={{ fontSize:10, color:"#525252", marginTop:2 }}>
            {boost.auto_renew
              ? `Renews ${fmtDate(boost.expires_at)} — EP deducted automatically`
              : "Off — renew manually before it expires"}
          </div>
        </div>
        <button onClick={() => onToggleAutoRenew(!boost.auto_renew)} disabled={working}
          style={{ background:"none", border:"none", cursor:working?"default":"pointer",
            color:boost.auto_renew?"#84cc16":"#525252", opacity:working?0.5:1,
            transition:"color 0.2s",
          }}>
          {boost.auto_renew ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
        </button>
      </div>
      <button onClick={onCancelRequest} disabled={working} style={{
        width:"100%", padding:10, borderRadius:12,
        border:"1px solid rgba(239,68,68,0.25)",
        background:"rgba(239,68,68,0.06)", color:"#ef4444",
        fontSize:12, fontWeight:700, cursor:working?"default":"pointer",
        opacity:working?0.5:1,
      }}>Cancel Boost</button>
    </div>
  );
};

// ── Tier card ─────────────────────────────────────────────────────────────
const TierCard = ({
  tierId, billing, expanded, onExpand, onSelect, selected,
  currentUser, epBalance, activeTierId, isSystemGrant,
  previewThemeId, onPreviewTheme, isWide,
}) => {
  const v         = BOOST_VISUAL[tierId];
  const cfg       = BOOST_TIERS[tierId];
  const epCost    = cfg.ep_price[billing];
  const canAfford = epBalance >= epCost;
  const isActive  = activeTierId === tierId;
  const isSel     = selected === tierId;
  const themes    = THEMES_BY_TIER[tierId] ?? [];
  const tier      = TIERS.find(t => t.id === tierId);
  const savings   = billing === "yearly"
    ? Math.round(cfg.ep_price.monthly * 12 - cfg.ep_price.yearly) : 0;
  const bonus     = EP_BONUS[tierId];

  return (
    <div style={{
      background:   isSel ? `${v.color}08` : "rgba(255,255,255,0.025)",
      border:       `1.5px solid ${isSel ? v.color+"50" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 20, overflow:"hidden", position:"relative",
      transition:   "border-color 0.25s, box-shadow 0.25s",
      boxShadow:    isSel ? `0 8px 32px ${v.glow}` : "none",
      animation:    "cardIn 0.3s ease both",
      animationDelay: `${TIERS.indexOf(tier)*0.07}s`,
    }}>
      {tier?.popular && (
        <div style={{
          position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          padding:"3px 14px", borderRadius:"0 0 10px 10px",
          background:`linear-gradient(90deg,${v.grad[0]},${v.grad[1]})`,
          fontSize:10, fontWeight:800, color:"#000", zIndex:2,
        }}>⭐ Most Popular</div>
      )}
      {isActive && !isSystemGrant && (
        <div style={{
          position:"absolute", top:0, right:0,
          padding:"4px 10px", borderRadius:"0 18px 0 10px",
          background:`linear-gradient(135deg,${v.grad[0]},${v.grad[1]})`,
          fontSize:9, fontWeight:800, color:"#000", zIndex:2,
        }}>ACTIVE</div>
      )}

      {/* Header row */}
      <div onClick={onExpand} style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:`${tier?.popular?26:16}px 16px 16px`,
        cursor:"pointer",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:48, height:48, borderRadius:14, flexShrink:0,
            background:`${v.color}18`, border:`1px solid ${v.color}30`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:22, boxShadow: isSel ? `0 0 20px ${v.glow}` : "none",
          }}>{v.badge}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:v.color, lineHeight:1.1 }}>
              {cfg.name}
            </div>
            <div style={{ fontSize:11, color:"#525252", marginTop:2 }}>
              {cfg.theme_count === 1 ? "1 exclusive design"
                : `${cfg.theme_count} exclusive designs`} · <span style={{ color:"#84cc16" }}>+{bonus}% EP</span>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
          <div style={{
            display:"flex", alignItems:"baseline", gap:2,
            padding:"4px 10px", borderRadius:20,
            background: canAfford ? `${v.color}15` : "rgba(239,68,68,0.1)",
            border:     canAfford ? `1px solid ${v.color}35` : "1px solid rgba(239,68,68,0.3)",
          }}>
            <span style={{ fontSize:16, fontWeight:900, color:canAfford?v.color:"#ef4444" }}>
              {fmtEP(epCost)}
            </span>
            <span style={{ fontSize:10, color:"#737373", fontWeight:700 }}>
              EP/{billing==="yearly"?"yr":"mo"}
            </span>
          </div>
          <div style={{ fontSize:9, color:"#525252" }}>
            ≡ ${cfg.usd_display[billing]}{billing==="yearly"?"/yr":"/mo"}
          </div>
          {billing==="yearly" && savings>0 && (
            <div style={{ fontSize:9, color:"#22c55e", fontWeight:800 }}>
              Save {fmtEP(savings)} EP/yr
            </div>
          )}
          {!canAfford && (
            <div style={{ fontSize:9, color:"#ef4444", fontWeight:700 }}>
              Need {fmtEP(epCost-epBalance)} more EP
            </div>
          )}
          <ChevronDown size={14} color={v.color}
            style={{ transform:expanded?"rotate(180deg)":"none", transition:"transform 0.25s" }}/>
        </div>
      </div>

      {/* Expanded */}
      <div style={{
        maxHeight:expanded?900:0, overflow:"hidden",
        transition:"max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ padding:"4px 16px 16px" }}>

          {/* Live preview — only in single-column (mobile) mode */}
          {expanded && !isWide && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#525252",
                textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8,
              }}>Live Preview</div>
              <LivePreview tierId={tierId} themeId={previewThemeId} currentUser={currentUser} />
            </div>
          )}

          {/* Theme mini-picker */}
          {themes.length > 1 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#525252",
                textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8,
              }}>Choose Your Design</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {themes.map(t => {
                  const isP = (previewThemeId ?? themes[0]?.id) === t.id;
                  return (
                    <button key={t.id} onClick={() => onPreviewTheme(tierId, t.id)}
                      style={{
                        display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                        padding:"8px 10px", borderRadius:12, border:"none",
                        background: isP ? `${v.color}15` : "rgba(255,255,255,0.04)",
                        outline: isP ? `2px solid ${v.color}50` : "1px solid rgba(255,255,255,0.07)",
                        outlineOffset:0, cursor:"pointer", transition:"all 0.18s",
                      }}>
                      <div style={{
                        width:36, height:36, borderRadius:10, background:t.preview,
                        border: isP ? `2px solid ${v.color}60` : "1px solid rgba(255,255,255,0.1)",
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                      }}>{t.emoji}</div>
                      <span style={{ fontSize:9, fontWeight:700, color:isP?v.color:"#525252",
                        whiteSpace:"nowrap", maxWidth:56, overflow:"hidden", textOverflow:"ellipsis",
                      }}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Benefits */}
          {cfg.benefits.map((b, i) => (
            <div key={i} style={{
              display:"flex", alignItems:"flex-start", gap:10, padding:"7px 0",
              borderBottom:"1px solid rgba(255,255,255,0.04)",
              fontSize:13, color:"#c4c4c4", fontWeight:500,
            }}>
              <div style={{
                width:20, height:20, borderRadius:6, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:`${v.color}18`, border:`1px solid ${v.color}30`,
              }}>
                <Check size={10} color={v.color}/>
              </div>
              <span>{b}</span>
            </div>
          ))}

          {/* EP bonus benefit row */}
          <div style={{
            display:"flex", alignItems:"flex-start", gap:10, padding:"7px 0",
            borderBottom:"1px solid rgba(255,255,255,0.04)",
            fontSize:13, color:"#c4c4c4", fontWeight:500,
          }}>
            <div style={{
              width:20, height:20, borderRadius:6, flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(132,204,22,0.15)", border:"1px solid rgba(132,204,22,0.3)",
            }}>
              <Check size={10} color="#84cc16"/>
            </div>
            <span>+{bonus}% EP on all earnings</span>
          </div>

          {!canAfford && !isSystemGrant && (
            <div style={{
              display:"flex", alignItems:"center", gap:8, marginTop:12, padding:"10px 12px",
              borderRadius:10, background:"rgba(239,68,68,0.07)",
              border:"1px solid rgba(239,68,68,0.2)",
            }}>
              <AlertCircle size={14} color="#ef4444"/>
              <span style={{ fontSize:11, color:"#ef4444" }}>
                Need <strong>{fmtEP(epCost-epBalance)} more EP</strong>. Top up in Wallet.
              </span>
            </div>
          )}

          <button
            onClick={() => !isSystemGrant && canAfford && !isActive && onSelect(tierId)}
            disabled={isSystemGrant || !canAfford || isActive}
            style={{
              width:"100%", marginTop:14, padding:13, borderRadius:13, border:"none",
              background: isSystemGrant
                ? "rgba(255,255,255,0.04)"
                : isActive ? "rgba(132,204,22,0.15)"
                : canAfford
                  ? `linear-gradient(135deg,${v.grad[0]},${v.grad[1]})`
                  : "rgba(255,255,255,0.05)",
              color: isSystemGrant ? "#525252" : isActive ? "#84cc16" : canAfford ? "#000" : "#525252",
              fontSize:14, fontWeight:900,
              cursor:(!isSystemGrant && canAfford && !isActive)?"pointer":"default",
              boxShadow:(!isSystemGrant && canAfford && !isActive)?`0 6px 20px ${v.glow}`:"none",
            }}
          >
            {isSystemGrant ? "Provided by your role"
              : isActive ? "✓ Currently Active"
              : isSel ? `✓ Selected — ${fmtEP(epCost)} EP`
              : canAfford ? `Get ${cfg.name} — ${fmtEP(epCost)} EP`
              : `Insufficient EP (have ${fmtEP(epBalance)})`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Confirm sheet ─────────────────────────────────────────────────────────
const ConfirmSheet = ({
  tierId, billing, epCost, epBalance, autoRenew, pickedThemeId,
  onAutoRenewChange, onConfirm, onCancel, working,
}) => {
  const v   = BOOST_VISUAL[tierId];
  const cfg = BOOST_TIERS[tierId];
  const canAfford  = epBalance >= epCost;
  const newBalance = epBalance - epCost;

  return (
    <div style={{
      background:"rgba(10,10,10,0.97)", backdropFilter:"blur(20px)",
      border:`1px solid ${v.color}30`, borderRadius:20, padding:16,
      boxShadow:"0 -4px 32px rgba(0,0,0,0.6)",
      animation:"cardIn 0.3s cubic-bezier(0.34,1.4,0.64,1)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
        <span style={{ fontSize:26 }}>{v.badge}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:900, color:"#fff" }}>
            {cfg.name} — {billing}
          </div>
          <div style={{ fontSize:11, color:"#737373" }}>
            {fmtEP(epCost)} EP · Balance after: {fmtEP(Math.max(0,newBalance))} EP
          </div>
        </div>
        <div style={{ fontSize:11, fontWeight:800, color:canAfford?"#22c55e":"#ef4444" }}>
          {canAfford ? "✓ Ready" : "⚠ Low EP"}
        </div>
      </div>

      {pickedThemeId && (() => {
        const t = (THEMES_BY_TIER[tierId]??[]).find(x=>x.id===pickedThemeId);
        return t ? (
          <div style={{
            display:"flex", alignItems:"center", gap:8, marginBottom:12,
            padding:"8px 12px", borderRadius:10,
            background:`${v.color}10`, border:`1px solid ${v.color}25`,
          }}>
            <div style={{ width:28, height:28, borderRadius:8, background:t.preview,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
            }}>{t.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontWeight:800, color:v.color }}>{t.name}</div>
              <div style={{ fontSize:9, color:"#525252" }}>Design selected</div>
            </div>
            <Check size={12} color={v.color}/>
          </div>
        ) : null;
      })()}

      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 12px", borderRadius:12, marginBottom:12,
        background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
      }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", gap:6 }}>
            <RefreshCw size={11} color="#84cc16"/> Auto-Renew
          </div>
          <div style={{ fontSize:10, color:"#525252", marginTop:1 }}>
            {autoRenew
              ? `Deducts ${fmtEP(epCost)} EP automatically when boost expires`
              : "Manual — you decide when to pay next"}
          </div>
        </div>
        <button onClick={() => onAutoRenewChange(!autoRenew)} style={{
          background:"none", border:"none", cursor:"pointer",
          color:autoRenew?"#84cc16":"#525252", transition:"color 0.2s",
        }}>
          {autoRenew ? <ToggleRight size={30}/> : <ToggleLeft size={30}/>}
        </button>
      </div>

      <div style={{
        display:"flex", gap:8, marginBottom:12, padding:"8px 10px",
        borderRadius:10, background:"rgba(251,191,36,0.06)",
        border:"1px solid rgba(251,191,36,0.15)",
      }}>
        <Info size={13} color="#fbbf24" style={{ flexShrink:0, marginTop:1 }}/>
        <div style={{ fontSize:10, color:"#a3a3a3", lineHeight:1.5 }}>
          Instant EP payment — $1 = 100 EP, your ecosystem currency.
          No card needed. Top up EP in Wallet anytime.
        </div>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onCancel} disabled={working} style={{
          padding:"12px 16px", borderRadius:12,
          border:"1px solid rgba(255,255,255,0.1)",
          background:"rgba(255,255,255,0.04)", color:"#737373",
          fontSize:13, fontWeight:700, cursor:"pointer",
        }}>Back</button>
        <button onClick={onConfirm} disabled={working || !canAfford} style={{
          flex:1, padding:13, borderRadius:12, border:"none",
          background:canAfford?`linear-gradient(135deg,${v.grad[0]},${v.grad[1]})`:"rgba(255,255,255,0.05)",
          color:canAfford?"#000":"#525252", fontSize:14, fontWeight:900,
          cursor:(canAfford&&!working)?"pointer":"default",
          boxShadow:canAfford?`0 6px 20px ${v.glow}`:"none",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          opacity:working?0.7:1,
        }}>
          {working
            ? <><RefreshCw size={14} style={{ animation:"spin 0.8s linear infinite" }}/> Processing…</>
            : `⚡ Activate — ${fmtEP(epCost)} EP`}
        </button>
      </div>
    </div>
  );
};

// ── Success screen ────────────────────────────────────────────────────────
const SuccessScreen = ({ tierId, billing, result, pickedThemeId, currentUser, onClose }) => {
  const v   = BOOST_VISUAL[tierId];
  const cfg = BOOST_TIERS[tierId];
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      textAlign:"center", padding:"40px 24px",
    }}>
      <div style={{ marginBottom:24, width:"100%", maxWidth:360 }}>
        <LivePreview tierId={tierId} themeId={pickedThemeId} currentUser={currentUser}/>
      </div>
      <div style={{ fontSize:64, marginBottom:16, animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
        {v.badge}
      </div>
      <h2 style={{ fontSize:26, fontWeight:900, color:"#fff", margin:"0 0 8px" }}>
        {cfg.name} Active!
      </h2>
      <p style={{ fontSize:13, color:"#737373", lineHeight:1.7, margin:"0 0 24px" }}>
        Your boost is now live everywhere on the platform.<br/>
        <span style={{ color:v.color, fontWeight:700 }}>{fmtEP(result.ep_cost)} EP deducted.</span>
        <br/>+{EP_BONUS[tierId]}% EP bonus is now active.
        <br/>Expires: {fmtDate(result.expires_at)}
      </p>
      <button onClick={onClose} style={{
        padding:"14px 32px", borderRadius:14, border:"none",
        background:`linear-gradient(135deg,${v.grad[0]},${v.grad[1]})`,
        color:"#000", fontSize:15, fontWeight:900, cursor:"pointer",
        boxShadow:`0 8px 24px ${v.glow}`,
      }}>Back to Profile ✓</button>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
const UpgradeView = ({ currentUser, userId: userIdProp, onClose }) => {
  const userId  = userIdProp || currentUser?.id;
  const isWide  = useIsWide();

  const { boost, loading, epBalance, working,
          activateBoost, cancelBoost, toggleAutoRenew } = useBoost(userId);

  const [billing,       setBilling]       = useState("monthly");
  const [expanded,      setExpanded]      = useState("gold");
  const [selected,      setSelected]      = useState(null);
  const [autoRenew,     setAutoRenew]     = useState(false);
  const [success,       setSuccess]       = useState(null);
  const [error,         setError]         = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [themePreview,  setThemePreview]  = useState({});

  // On wide screens, right panel shows preview for the expanded tier
  const previewTierId  = selected ?? expanded ?? "gold";
  const pickedThemeId  = selected
    ? (themePreview[selected] ?? getDefaultTheme(selected)?.id ?? null)
    : null;
  const rightThemeId   = themePreview[previewTierId] ?? getDefaultTheme(previewTierId)?.id;

  useEffect(() => { if (boost?.billing) setBilling(boost.billing); }, [boost?.billing]);

  const isSystemGrant = boost?.is_system_grant === true;
  const epCost        = selected ? BOOST_TIERS[selected]?.ep_price[billing] ?? 0 : 0;

  const handlePreviewTheme = useCallback((tierId, themeId) => {
    setThemePreview(p => ({ ...p, [tierId]: themeId }));
  }, []);

  const handleActivate = useCallback(async () => {
    if (!selected || working) return;
    setError(null);
    const result = await activateBoost(selected, billing, autoRenew, pickedThemeId);
    if (result.success) setSuccess(result);
    else setError(result.error || "Activation failed. Please try again.");
  }, [selected, billing, autoRenew, pickedThemeId, working, activateBoost]);

  const handleCancel = useCallback(async () => {
    setError(null);
    const r = await cancelBoost();
    if (!r.success) setError(r.error || "Could not cancel boost.");
    setCancelConfirm(false);
  }, [cancelBoost]);

  const handleToggleAutoRenew = useCallback(async (val) => {
    const r = await toggleAutoRenew(val);
    if (!r.success) setError(r.error);
  }, [toggleAutoRenew]);

  if (loading) return (
    <div style={{
      position:"fixed", inset:0, zIndex:9500, background:"#060606",
      display:"flex", alignItems:"center", justifyContent:"center",
      flexDirection:"column", gap:16,
    }}>
      <div style={{
        width:48, height:48, borderRadius:"50%",
        border:"3px solid rgba(251,191,36,0.2)", borderTop:"3px solid #fbbf24",
        animation:"spin 0.8s linear infinite",
      }}/>
      <div style={{ color:"#737373", fontSize:13 }}>Loading…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9500, background:"#060606", overflowY:"auto",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes cardIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn   { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{
        position:"sticky", top:0, zIndex:10,
        display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
        background:"rgba(6,6,6,0.97)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(251,191,36,0.12)",
      }}>
        <button onClick={onClose} style={{
          width:34, height:34, borderRadius:10,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", color:"#737373", fontSize:18,
        }}>‹</button>
        <span style={{ fontSize:17, fontWeight:900, color:"#fff", flex:1 }}>
          {boost ? "Manage Boost" : "Boost Your Profile"}
        </span>
        <div style={{
          display:"flex", alignItems:"center", gap:5, padding:"4px 10px",
          borderRadius:20, background:"rgba(251,191,36,0.1)",
          border:"1px solid rgba(251,191,36,0.25)",
        }}>
          <Zap size={12} color="#fbbf24"/>
          <span style={{ fontSize:12, fontWeight:800, color:"#fbbf24" }}>{fmtEP(epBalance)} EP</span>
        </div>
      </div>

      {/* ── SUCCESS ─────────────────────────────────────────────────────── */}
      {success ? (
        <div style={{ maxWidth:520, margin:"0 auto" }}>
          <SuccessScreen tierId={selected} billing={billing} result={success}
            pickedThemeId={pickedThemeId} currentUser={currentUser} onClose={onClose}/>
        </div>
      ) : (
        /* ── PAGE BODY — max-width container ────────────────────────────── */
        <div style={{
          maxWidth: isWide ? 920 : "100%",
          margin:"0 auto",
          padding: isWide ? "0 24px 40px" : "0 0 40px",
        }}>

          {/* ── TWO-COLUMN WRAPPER ────────────────────────────────────── */}
          <div style={{
            display: isWide ? "grid" : "block",
            gridTemplateColumns: isWide ? "1fr 340px" : undefined,
            gap: isWide ? 24 : 0,
            alignItems:"start",
          }}>

            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div>
              {/* System grant banner */}
              {boost && isSystemGrant && (
                <SystemGrantBanner boost={boost} userId={userId}/>
              )}

              {/* Paid boost banner */}
              {boost && !isSystemGrant && !cancelConfirm && (
                <ActiveBoostBanner boost={boost} userId={userId}
                  onToggleAutoRenew={handleToggleAutoRenew}
                  working={working} onCancelRequest={() => setCancelConfirm(true)}/>
              )}

              {/* Cancel confirm */}
              {cancelConfirm && (
                <div style={{
                  margin:"16px 0 0", padding:16, borderRadius:18,
                  background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.25)",
                }}>
                  <p style={{ color:"#fff", fontSize:13, fontWeight:700, margin:"0 0 6px" }}>
                    Cancel your boost?
                  </p>
                  <p style={{ color:"#737373", fontSize:11, margin:"0 0 14px" }}>
                    Boost ends immediately. No EP refund.
                  </p>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setCancelConfirm(false)} style={{
                      flex:1, padding:10, borderRadius:10,
                      background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                      color:"#a3a3a3", fontSize:13, fontWeight:600, cursor:"pointer",
                    }}>Keep Boost</button>
                    <button onClick={handleCancel} disabled={working} style={{
                      flex:1, padding:10, borderRadius:10,
                      background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.4)",
                      color:"#ef4444", fontSize:13, fontWeight:800, cursor:"pointer",
                      opacity:working?0.5:1,
                    }}>
                      {working ? "Cancelling…" : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              )}

              {/* Hero (no boost yet) */}
              {!boost && (
                <div style={{
                  padding:"32px 20px 24px", textAlign:"center",
                  background:"radial-gradient(ellipse at top,rgba(251,191,36,0.06) 0%,transparent 60%)",
                }}>
                  <div style={{
                    width:72, height:72, borderRadius:22, margin:"0 auto 18px",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background:"linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,191,36,0.06))",
                    border:"1px solid rgba(251,191,36,0.3)",
                    boxShadow:"0 8px 32px rgba(251,191,36,0.2)",
                    animation:"float 3s ease-in-out infinite", fontSize:34,
                  }}>👑</div>
                  <h2 style={{ fontSize:24, fontWeight:900, color:"#fff", margin:"0 0 8px" }}>
                    Boost Your Profile
                  </h2>
                  <p style={{ fontSize:13, color:"#525252", lineHeight:1.7, margin:"0 0 4px" }}>
                    Unlock a stunning profile design, animated avatar ring,<br/>
                    and exclusive creator perks.
                  </p>
                  <p style={{ fontSize:11, color:"#383838", margin:0 }}>
                    Economy: $1 = 100 EP · Secure instant payment · Cancel anytime
                  </p>
                </div>
              )}

              {/* Billing toggle */}
              <div style={{ display:"flex", justifyContent:"center", padding:"16px 20px" }}>
                <div style={{
                  display:"flex", background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:3, gap:2,
                }}>
                  {["monthly","yearly"].map(b => (
                    <button key={b} onClick={() => setBilling(b)} style={{
                      padding:"8px 20px", borderRadius:9,
                      border: billing===b ? "1px solid rgba(251,191,36,0.25)" : "none",
                      fontSize:12, fontWeight:800, cursor:"pointer",
                      background: billing===b ? "rgba(251,191,36,0.12)" : "transparent",
                      color:      billing===b ? "#fbbf24" : "#525252",
                      display:"flex", alignItems:"center", gap:6, transition:"all 0.22s",
                    }}>
                      {b.charAt(0).toUpperCase()+b.slice(1)}
                      {b==="yearly" && (
                        <span style={{
                          padding:"1px 6px", borderRadius:5, fontSize:9, fontWeight:800,
                          background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.25)",
                          color:"#22c55e",
                        }}>Up to ~2mo free</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier cards */}
              <div style={{ display:"flex", flexDirection:"column", gap:10, padding:"0 14px 20px" }}>
                {TIERS.map(tier => (
                  <TierCard
                    key={tier.id}
                    tierId={tier.id}
                    billing={billing}
                    expanded={expanded === tier.id}
                    onExpand={() => {
                      setExpanded(p => p===tier.id ? null : tier.id);
                    }}
                    onSelect={id => { setSelected(id); setExpanded(id); }}
                    selected={selected}
                    currentUser={currentUser}
                    epBalance={epBalance}
                    activeTierId={boost?.tier ?? null}
                    isSystemGrant={isSystemGrant}
                    previewThemeId={themePreview[tier.id] ?? getDefaultTheme(tier.id)?.id}
                    onPreviewTheme={handlePreviewTheme}
                    isWide={isWide}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  margin:"0 14px 12px", padding:"12px 14px", borderRadius:12,
                  background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)",
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <AlertCircle size={14} color="#ef4444"/>
                  <div style={{ fontSize:12, color:"#ef4444", flex:1 }}>{error}</div>
                  <button onClick={() => setError(null)} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer" }}>
                    <X size={14}/>
                  </button>
                </div>
              )}

              {/* Mobile confirm sheet (inside left col, bottom) */}
              {!isWide && selected && !isSystemGrant && (!boost || selected !== boost.tier) && (
                <div style={{ margin:"0 14px 10px", position:"sticky", bottom:80, zIndex:20 }}>
                  <ConfirmSheet
                    tierId={selected} billing={billing}
                    epCost={epCost} epBalance={epBalance}
                    autoRenew={autoRenew} pickedThemeId={pickedThemeId}
                    onAutoRenewChange={setAutoRenew}
                    onConfirm={handleActivate}
                    onCancel={() => setSelected(null)}
                    working={working}
                  />
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (desktop only) ──────────────────────────── */}
            {isWide && (
              <div style={{ position:"sticky", top:70, display:"flex", flexDirection:"column", gap:16 }}>

                {/* Live preview panel */}
                <div style={{
                  background:"rgba(255,255,255,0.02)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:20, overflow:"hidden",
                }}>
                  <div style={{
                    padding:"12px 16px 8px",
                    fontSize:10, fontWeight:700, color:"#525252",
                    textTransform:"uppercase", letterSpacing:"0.08em",
                    borderBottom:"1px solid rgba(255,255,255,0.05)",
                  }}>
                    Live Preview
                  </div>
                  <div style={{ padding:16 }}>
                    <LivePreview
                      tierId={previewTierId}
                      themeId={rightThemeId}
                      currentUser={currentUser}
                    />
                  </div>
                  {/* Tier switcher dots */}
                  <div style={{
                    display:"flex", justifyContent:"center", gap:8, paddingBottom:14,
                  }}>
                    {TIERS.map(t => {
                      const v = BOOST_VISUAL[t.id];
                      const active = previewTierId === t.id;
                      return (
                        <button key={t.id}
                          onClick={() => setExpanded(t.id)}
                          style={{
                            padding:"4px 10px", borderRadius:20, border:"none",
                            background: active ? `${v.color}20` : "rgba(255,255,255,0.05)",
                            color: active ? v.color : "#525252",
                            fontSize:10, fontWeight:800, cursor:"pointer",
                            outline: active ? `1px solid ${v.color}40` : "none",
                            transition:"all 0.18s",
                          }}>
                          {v.badge} {t.id.charAt(0).toUpperCase()+t.id.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop confirm sheet */}
                {selected && !isSystemGrant && (!boost || selected !== boost.tier) && (
                  <ConfirmSheet
                    tierId={selected} billing={billing}
                    epCost={epCost} epBalance={epBalance}
                    autoRenew={autoRenew} pickedThemeId={pickedThemeId}
                    onAutoRenewChange={setAutoRenew}
                    onConfirm={handleActivate}
                    onCancel={() => setSelected(null)}
                    working={working}
                  />
                )}

                {/* EP economy note */}
                <div style={{
                  padding:"12px 14px", borderRadius:14,
                  background:"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.12)",
                  fontSize:11, color:"#737373", lineHeight:1.6,
                }}>
                  <div style={{ fontWeight:800, color:"#fbbf24", marginBottom:4 }}>💡 EP Economy</div>
                  $1 = 100 EP · No card stored · Cancel anytime · EP refills in Wallet
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradeView;