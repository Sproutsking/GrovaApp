// src/components/wallet/tabs/OverviewTab.jsx
import React, { useState } from "react";
import {
  ArrowUpRight,
  Download,
  ArrowDownLeft,
  MoreHorizontal,
  TrendingUp,
  Repeat,
  Settings,
  Wifi,
  Coins,
  Zap,
  ChevronRight,
  Flame,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import BalanceCard from "../components/BalanceCard";
import { useCurrency } from "../../../contexts/CurrencyContext";

export default function OverviewTab({ balance, setActiveTab, loading, transactions = [], userId, username }) {
  const [showMore,     setShowMore]  = useState(false);
  const [hideBalance,  setHide]      = useState(false);

  const { format } = useCurrency();

  const xev = balance?.tokens ?? 0;
  const ep  = balance?.points ?? 0;

  const navigate = (tab) => setActiveTab(tab);

  return (
    <div className="view-enter">

      {/* ═══════════ BALANCE CARD ═══════════ */}
      <BalanceCard
        balance={balance}
        loading={loading}
        hideBalance={hideBalance}
        onToggleHide={() => setHide(h => !h)}
        username={username}
      />

      {/* actions start right below the card's stats strip */}

      {/* ═══════════ QUICK ACTIONS — 4-col ═══════════ */}
      <div className="actions-row">
        <button className="act-btn primary" onClick={() => navigate("send")}>
          <div className="act-icon"><ArrowUpRight size={18} /></div>
          <span className="act-label">Send</span>
        </button>

        <button className="act-btn" onClick={() => navigate("deposit")}>
          <div className="act-icon"><Download size={18} /></div>
          <span className="act-label">Deposit</span>
        </button>

        <button className="act-btn" onClick={() => navigate("receive")}>
          <div className="act-icon"><ArrowDownLeft size={18} /></div>
          <span className="act-label">Receive</span>
        </button>

        <button className="act-btn" onClick={() => setShowMore(m => !m)}>
          <div className="act-icon">
            <MoreHorizontal size={18} />
          </div>
          <span className="act-label">More</span>
        </button>
      </div>

      {/* More panel */}
      {showMore && (
        <div className="more-panel">
          <button className="act-btn" onClick={() => { navigate("swap"); setShowMore(false); }}>
            <div className="act-icon"><Repeat size={16} /></div>
            <span className="act-label">Swap</span>
          </button>
          <button className="act-btn" onClick={() => { navigate("trade"); setShowMore(false); }}>
            <div className="act-icon"><TrendingUp size={16} /></div>
            <span className="act-label">Trade</span>
          </button>
          <button className="act-btn" onClick={() => { navigate("paywave"); setShowMore(false); }}>
            <div className="act-icon"><Wifi size={16} /></div>
            <span className="act-label">PayWave</span>
          </button>
          <button className="act-btn" onClick={() => { navigate("settings"); setShowMore(false); }}>
            <div className="act-icon"><Settings size={16} /></div>
            <span className="act-label">Settings</span>
          </button>
        </div>
      )}

      {/* ═══════════ YOUR ASSETS ═══════════ */}
      <div className="section-wrap">
        <div className="section-head">
          <span className="section-title">Your Assets</span>
          <div className="section-line" />
        </div>

        {/* $XEV */}
        <div className="asset-row xev-row">
          <div className="asset-icon-box xev">
            <Coins size={18} />
          </div>
          <div>
            <div className="asset-name">$XEV Token</div>
            <div className="asset-desc">Transferable · On-chain</div>
          </div>
          <div className="asset-val-wrap">
            <span className="asset-val">
              {loading ? "—" : xev.toLocaleString()}
            </span>
            <span className="asset-fiat-val">
              ≈ {loading ? "—" : format(xev, false)}
            </span>
          </div>
        </div>

        {/* EP */}
        <div className="asset-row">
          <div className="asset-icon-box ep">
            <Zap size={18} />
          </div>
          <div>
            <div className="asset-name">Engagement Points</div>
            <div className="asset-desc">Platform currency · Internal only</div>
          </div>
          <div className="asset-val-wrap">
            <span className="asset-val">
              {loading ? "—" : ep.toLocaleString()}
            </span>
            <span className="asset-chip">INTERNAL</span>
          </div>
        </div>
      </div>

      {/* ═══════════ PAYWAVE — full-width card ═══════════ */}
      <div
        className="paywave-card"
        onClick={() => navigate("paywave")}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && navigate("paywave")}
      >
        <div className="pw-logo">
          <Wifi size={22} color="#fff" />
        </div>
        <div className="pw-text">
          <h3>PayWave</h3>
          <p>Send money · Zero fees · Instant</p>
        </div>
        <ChevronRight size={18} className="pw-arrow" />
      </div>

      {/* ═══════════ TRANSACTIONS ═══════════ */}
      <div className="tx-section">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <span className="section-title">Recent Activity</span>
          <div className="section-line" />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} className="skel" style={{ height: 52, borderRadius: 10 }} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--t3)" }}>
            <Zap size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>No transactions yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Your activity will show here</div>
          </div>
        ) : (
          <div className="tx-list">
            {transactions.map(tx => {
              const isIn      = tx.type === "receive" || tx.type === "deposit";
              const isPending = tx._optimistic;
              const isEp      = tx.currency === "EP";

              return (
                <div
                  key={tx.id || tx._tempId}
                  className={`tx-row${isPending ? " pending" : ""}`}
                >
                  <div className={`tx-icon-box ${isIn ? "in" : "out"}`}>
                    {isIn ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                  </div>
                  <div>
                    <div className="tx-label" style={{ display: "flex", alignItems: "center" }}>
                      {tx.description || (isIn ? "Received" : "Sent")}
                      {isPending && <span className="pending-tag">SENDING</span>}
                    </div>
                    <div className="tx-date">
                      {isPending
                        ? "Processing…"
                        : tx.created_at
                          ? new Date(tx.created_at).toLocaleString("en-NG", {
                              month: "short", day: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })
                          : "Just now"}
                    </div>
                  </div>
                  <div className={`tx-amount ${isIn ? "in" : "out"}`}
                    style={{ paddingRight: isPending ? 20 : 0 }}
                  >
                    {isIn ? "+" : "−"}
                    {tx.amount?.toLocaleString()} {isEp ? "EP" : "$XEV"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EP burn info strip */}
      <div className="burn-strip" style={{ marginTop: 18 }}>
        <Flame size={14} color="rgba(248,113,113,0.7)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          EP transactions under 100 EP cost only <strong style={{ color: "rgba(248,113,113,0.9)" }}>0.5 EP</strong> burn fee.
          Min send: 5 EP.
        </span>
      </div>

    </div>
  );
}