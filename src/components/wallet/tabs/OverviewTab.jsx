// src/components/wallet/tabs/OverviewTab.jsx
// ════════════════════════════════════════════════════════════════
// FIXES:
//  • Section headings (YOUR ASSETS, RECENT ACTIVITY) are centred
//  • Transaction rows use displayLabel from walletService — so sender
//    sees "Sent" and receiver sees "Received" correctly
//  • PayWave card only rendered when showPayWave prop is true
//  • Beautiful section divider lines
//  • Smooth animations on tx rows
// ════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  ArrowUpRight, Download, ArrowDownLeft, MoreHorizontal,
  TrendingUp, Repeat, Settings, Wifi, Coins, Zap,
  ChevronRight, Flame, ArrowUp, ArrowDown, Clock,
} from "lucide-react";
import BalanceCard from "../components/BalanceCard";
import { useCurrency } from "../../../contexts/CurrencyContext";

const CSS = `
  /* ── Section heading — centred with gradient lines ── */
  .ov-section-head {
    display:flex;align-items:center;gap:10px;
    margin:24px 0 14px;justify-content:center;
  }
  .ov-section-title {
    font-size:10.5px;font-weight:700;letter-spacing:0.1em;
    text-transform:uppercase;color:rgba(255,255,255,0.2);
    white-space:nowrap;flex-shrink:0;
  }
  .ov-section-line {
    flex:1;height:1px;max-width:100px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);
  }

  /* ── Actions row ── */
  .ov-actions {
    display:grid;grid-template-columns:repeat(4,1fr);gap:8px;
    margin:0;
    margin-top: 10px;
  }
  .ov-act-btn {
    display:flex;flex-direction:column;align-items:center;gap:7px;
    padding:14px 8px;border-radius:14px;border:1px solid rgba(255,255,255,0.07);
    background:rgba(255,255,255,0.03);cursor:pointer;transition:all .18s;
    color:rgba(255,255,255,0.55);font-size:11.5px;font-weight:600;
  }
  .ov-act-btn:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.12);color:rgba(255,255,255,0.85);transform:translateY(-1px);}
  .ov-act-btn.primary{background:rgba(163,230,53,0.08);border-color:rgba(163,230,53,0.22);color:#a3e635;}
  .ov-act-btn.primary:hover{background:rgba(163,230,53,0.13);border-color:rgba(163,230,53,0.35);}
  .ov-act-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);}
  .ov-act-btn.primary .ov-act-icon{background:rgba(163,230,53,0.12);}

  /* ── More panel ── */
  .ov-more-panel {
    display:grid;grid-template-columns:repeat(4,1fr);gap:8px;
    margin-bottom:6px;
    animation:moreIn .2s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes moreIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

  /* ── Asset rows ── */
  .ov-asset-card {
    display:flex;align-items:center;gap:13px;
    padding:14px 16px;border-radius:15px;margin-bottom:8px;
    background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);
    transition:background .18s;
  }
  .ov-asset-card:hover{background:rgba(255,255,255,0.04);}
  .ov-asset-card.xev{border-color:rgba(163,230,53,0.12);background:rgba(163,230,53,0.03);}
  .ov-asset-card.ep{border-color:rgba(34,211,238,0.1);background:rgba(34,211,238,0.025);}

  .ov-asset-icon {
    width:42px;height:42px;border-radius:12px;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  }
  .ov-asset-icon.xev{background:rgba(163,230,53,0.1);color:#a3e635;}
  .ov-asset-icon.ep{background:rgba(34,211,238,0.1);color:#22d3ee;}

  .ov-asset-name{font-size:14px;font-weight:700;color:rgba(255,255,255,0.85);line-height:1.3;}
  .ov-asset-desc{font-size:11px;color:rgba(255,255,255,0.28);margin-top:2px;}
  .ov-asset-right{margin-left:auto;text-align:right;}
  .ov-asset-amount{font-size:19px;font-weight:800;font-family:"DM Mono",monospace;letter-spacing:-0.04em;}
  .ov-asset-amount.xev{color:#a3e635;}
  .ov-asset-amount.ep{color:#22d3ee;}
  .ov-asset-fiat{font-size:11px;color:rgba(255,255,255,0.25);margin-top:3px;font-family:"DM Mono",monospace;}
  .ov-asset-chip{
    display:inline-block;padding:2px 7px;border-radius:100px;
    background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.2);
    font-size:9px;font-weight:800;color:#22d3ee;letter-spacing:0.08em;margin-top:4px;
  }

  /* ── PayWave card ── */
  .ov-paywave-card {
    display:flex;align-items:center;gap:14px;padding:16px;
    border-radius:16px;background:linear-gradient(135deg,rgba(34,211,238,0.07) 0%,rgba(59,130,246,0.05) 100%);
    border:1px solid rgba(34,211,238,0.15);cursor:pointer;
    transition:all .2s;margin-bottom:0;
  }
  .ov-paywave-card:hover{background:linear-gradient(135deg,rgba(34,211,238,0.11) 0%,rgba(59,130,246,0.08) 100%);border-color:rgba(34,211,238,0.28);transform:translateY(-1px);}
  .ov-pw-logo{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#0ea5e9,#3b82f6);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 16px rgba(14,165,233,0.3);}
  .ov-pw-name{font-size:16px;font-weight:800;color:rgba(255,255,255,0.9);}
  .ov-pw-desc{font-size:12px;color:rgba(255,255,255,0.32);margin-top:2px;}
  .ov-pw-arrow{margin-left:auto;opacity:0.3;transition:all .2s;}
  .ov-paywave-card:hover .ov-pw-arrow{opacity:0.7;transform:translateX(3px);}

  /* ── Transaction rows ── */
  .ov-tx-list{display:flex;flex-direction:column;gap:6px;}
  .ov-tx-row {
    display:flex;align-items:center;gap:12px;
    padding:12px 14px;border-radius:13px;
    background:rgba(255,255,255,0.022);border:1px solid rgba(255,255,255,0.05);
    transition:background .15s;animation:txIn .3s ease both;
  }
  .ov-tx-row:hover{background:rgba(255,255,255,0.04);}
  .ov-tx-row.pending{opacity:0.65;border-style:dashed;}
  @keyframes txIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

  .ov-tx-icon {
    width:36px;height:36px;border-radius:10px;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  }
  .ov-tx-icon.in{background:rgba(163,230,53,0.1);color:#a3e635;}
  .ov-tx-icon.out{background:rgba(248,113,113,0.1);color:#f87171;}
  .ov-tx-icon.pending-icon{background:rgba(245,158,11,0.1);color:#f59e0b;}

  .ov-tx-label{font-size:13.5px;font-weight:700;color:rgba(255,255,255,0.82);display:flex;align-items:center;gap:6px;}
  .ov-tx-sub{font-size:11px;color:rgba(255,255,255,0.25);margin-top:2px;}
  .ov-tx-counterparty{font-size:10.5px;color:rgba(255,255,255,0.3);margin-top:1px;font-family:"DM Mono",monospace;}
  .ov-pending-tag{
    display:inline-block;padding:2px 7px;border-radius:100px;
    background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);
    font-size:9px;font-weight:700;color:#f59e0b;letter-spacing:0.06em;
  }
  .ov-tx-amount{margin-left:auto;font-size:14px;font-weight:800;font-family:"DM Mono",monospace;white-space:nowrap;letter-spacing:-0.02em;}
  .ov-tx-amount.in{color:#a3e635;}
  .ov-tx-amount.out{color:#f87171;}

  /* ── Avatar chip in tx ── */
  .ov-tx-avatar{width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#000;}

  /* ── Burn strip ── */
  .ov-burn-strip{
    display:flex;align-items:flex-start;gap:8px;
    padding:11px 14px;border-radius:10px;margin-top:18px;margin-bottom:24px;
    background:rgba(248,113,113,0.04);border:1px solid rgba(248,113,113,0.1);
    font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;
  }

  /* ── Empty state ── */
  .ov-empty{
    display:flex;flex-direction:column;align-items:center;
    padding:40px 20px;color:rgba(255,255,255,0.2);
  }
  .ov-empty-icon{opacity:0.15;margin-bottom:12px;}
  .ov-empty-title{font-size:14px;font-weight:700;margin-bottom:4px;}
  .ov-empty-sub{font-size:12px;}

  /* skeleton */
  .ov-skel{background:rgba(255,255,255,0.04);border-radius:12px;animation:ovSkel 1.5s ease-in-out infinite;}
  @keyframes ovSkel{0%,100%{opacity:1}50%{opacity:0.4}}
`;

// ── Small avatar component ─────────────────────────────────────
function TxAvatar({ avatarUrl, name, size = 32 }) {
  const [err, setErr] = React.useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();
  const hash = name ? name.charCodeAt(0) % 6 : 0;
  const colors = ["#a3e635","#22d3ee","#f59e0b","#a855f7","#ec4899","#38bdf8"];
  const bg = colors[hash];

  return (
    <div className="ov-tx-avatar" style={{ background: bg }}>
      {avatarUrl && !err
        ? <img src={avatarUrl} alt={name} style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={() => setErr(true)} />
        : initial}
    </div>
  );
}

export default function OverviewTab({ balance, setActiveTab, loading, transactions = [], userId, username, showPayWave }) {
  const [showMore, setShowMore] = useState(false);
  const [hideBalance, setHide]  = useState(false);
  const { format } = useCurrency();

  const xev = balance?.tokens ?? 0;
  const ep  = balance?.points ?? 0;

  return (
    <div className="view-enter">
      <style>{CSS}</style>

      {/* ══ BALANCE CARD ══ */}
      <BalanceCard
        balance={balance}
        loading={loading}
        hideBalance={hideBalance}
        onToggleHide={() => setHide(h => !h)}
        username={username}
      />

      {/* ══ QUICK ACTIONS ══ */}
      <div className="ov-actions">
        <button className="ov-act-btn primary" onClick={() => setActiveTab("send")}>
          <div className="ov-act-icon"><ArrowUpRight size={18} /></div>
          Send
        </button>
        <button className="ov-act-btn" onClick={() => setActiveTab("deposit")}>
          <div className="ov-act-icon"><Download size={18} /></div>
          Deposit
        </button>
        <button className="ov-act-btn" onClick={() => setActiveTab("receive")}>
          <div className="ov-act-icon"><ArrowDownLeft size={18} /></div>
          Receive
        </button>
        <button className="ov-act-btn" onClick={() => setShowMore(m => !m)}>
          <div className="ov-act-icon"><MoreHorizontal size={18} /></div>
          More
        </button>
      </div>

      {showMore && (
        <div className="ov-more-panel">
          {[
            { icon: Repeat,     label: "Swap",     tab: "swap"     },
            { icon: TrendingUp, label: "Trade",    tab: "trade"    },
            ...(showPayWave ? [{ icon: Wifi, label: "PayWave", tab: "paywave" }] : []),
            { icon: Settings,   label: "Settings", tab: "settings" },
          ].map(({ icon: Icon, label, tab }) => (
            <button key={tab} className="ov-act-btn" onClick={() => { setActiveTab(tab); setShowMore(false); }}>
              <div className="ov-act-icon"><Icon size={16} /></div>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ══ YOUR ASSETS ══ */}
      <div className="ov-section-head">
        <div className="ov-section-line" />
        <span className="ov-section-title">Your Assets</span>
        <div className="ov-section-line" />
      </div>

      <div className="ov-asset-card xev">
        <div className="ov-asset-icon xev"><Coins size={20} /></div>
        <div>
          <div className="ov-asset-name">$XEV Token</div>
          <div className="ov-asset-desc">Transferable · On-chain</div>
        </div>
        <div className="ov-asset-right">
          <div className="ov-asset-amount xev">{loading ? "—" : xev.toLocaleString()}</div>
          <div className="ov-asset-fiat">≈ {loading ? "—" : format(xev, false)}</div>
        </div>
      </div>

      <div className="ov-asset-card ep">
        <div className="ov-asset-icon ep"><Zap size={20} /></div>
        <div>
          <div className="ov-asset-name">Engagement Points</div>
          <div className="ov-asset-desc">Platform currency · Internal only</div>
        </div>
        <div className="ov-asset-right">
          <div className="ov-asset-amount ep">{loading ? "—" : ep.toLocaleString()}</div>
          <div className="ov-asset-chip">INTERNAL</div>
        </div>
      </div>

      {/* ══ PAYWAVE (region-gated) ══ */}
      {showPayWave && (
        <>
          <div className="ov-section-head" style={{ marginTop: 8 }}>
            <div className="ov-section-line" />
            <span className="ov-section-title">Quick Pay</span>
            <div className="ov-section-line" />
          </div>
          <div className="ov-paywave-card" onClick={() => setActiveTab("paywave")} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && setActiveTab("paywave")}>
            <div className="ov-pw-logo"><Wifi size={22} color="#fff" /></div>
            <div>
              <div className="ov-pw-name">PayWave</div>
              <div className="ov-pw-desc">Send money · Zero fees · Instant</div>
            </div>
            <ChevronRight size={18} className="ov-pw-arrow" />
          </div>
        </>
      )}

      {/* ══ RECENT ACTIVITY ══ */}
      <div className="ov-section-head" style={{ marginTop: 24 }}>
        <div className="ov-section-line" />
        <span className="ov-section-title">Recent Activity</span>
        <div className="ov-section-line" />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} className="ov-skel" style={{ height: 60 }} />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="ov-empty">
          <Zap size={32} className="ov-empty-icon" />
          <div className="ov-empty-title">No activity yet</div>
          <div className="ov-empty-sub">Your transactions will appear here</div>
        </div>
      ) : (
        <div className="ov-tx-list">
          {transactions.map((tx, idx) => {
            const isPending  = tx._optimistic === true;
            const isSent     = tx.change_type === "debit";
            const isReceived = tx.change_type === "credit";
            const currency   = tx.displayCurrency || tx.metadata?.currency || "EP";
            const label      = tx.displayLabel || (isSent ? "Sent" : "Received");
            const color      = tx.displayColor  || (isSent ? "#f87171" : "#a3e635");
            const cp         = tx.counterparty;

            const dateStr = tx.created_at
              ? new Date(tx.created_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Just now";

            return (
              <div
                key={tx.id || `opt-${idx}`}
                className={`ov-tx-row${isPending ? " pending" : ""}`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Icon or counterparty avatar */}
                {cp?.avatarUrl || cp?.avatarId ? (
                  <TxAvatar avatarUrl={cp.avatarUrl} name={cp.fullName || cp.username} size={36} />
                ) : (
                  <div className={`ov-tx-icon ${isPending ? "pending-icon" : isReceived ? "in" : "out"}`}>
                    {isPending ? <Clock size={15} /> : isReceived ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ov-tx-label">
                    {label}
                    {isPending && <span className="ov-pending-tag">SENDING</span>}
                  </div>
                  {cp && (
                    <div className="ov-tx-counterparty">
                      {isSent ? "to" : "from"} @{cp.username}
                    </div>
                  )}
                  {tx.note && (
                    <div className="ov-tx-sub" style={{ fontStyle: "italic" }}>"{tx.note}"</div>
                  )}
                  <div className="ov-tx-sub">{isPending ? "Processing…" : dateStr}</div>
                </div>

                <div className="ov-tx-amount" style={{ color }}>
                  {tx.displaySign || (isSent ? "−" : "+")}{(tx.amount || 0).toLocaleString()} <span style={{ fontSize: 10, opacity: 0.7 }}>{currency}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ BURN STRIP ══ */}
      <div className="ov-burn-strip">
        <Flame size={14} color="rgba(248,113,113,0.6)" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          EP sends under 100 EP cost only <strong style={{ color: "rgba(248,113,113,0.85)" }}>0.5 EP</strong> burn fee.
          Minimum send: <strong style={{ color: "rgba(255,255,255,0.4)" }}>5 EP</strong>.
        </span>
      </div>
    </div>
  );
}