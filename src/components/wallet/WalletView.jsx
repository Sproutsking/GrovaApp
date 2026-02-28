// src/components/wallet/WalletView.jsx
// ════════════════════════════════════════════════════════════════
// Full-viewport wallet — mirrors PayWave's fixed layout exactly.
// position: fixed, top: 56px (header height), left: left-sidebar-width.
// Right sidebar: crypto/platform data on ≥1200px screens.
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import "./styles/WalletStyles.css";
import "./styles/tradeStyles.css";
import OverviewTab  from "./tabs/OverviewTab";
import SendTab      from "./tabs/SendTab";
import DepositTab   from "./tabs/DepositTab";
import ReceiveTab   from "./tabs/ReceiveTab";
import SwapTab      from "./tabs/SwapTab";
import TradeTab     from "./tabs/TradeTab";
import SettingsTab  from "./tabs/SettingsTab";
import PayWave      from "./paywave/PayWaveWrapper";
import { walletService } from "../../services/wallet/walletService";
import { CurrencyProvider } from "../../contexts/CurrencyContext";
import { useAuth } from "../Auth/AuthContext";

/* ── Static sidebar data ─────────────────────────────────── */
const CRYPTO_MARKETS = [
  { sym: "BTC",  val: "$97,420", chg: "+2.4%", up: true  },
  { sym: "ETH",  val: "$3,820",  chg: "+1.1%", up: true  },
  { sym: "BNB",  val: "$548",    chg: "-0.8%", up: false },
  { sym: "USDT", val: "$1.00",   chg: "+0.0%", up: true  },
  { sym: "$XEV", val: "₦2.50",  chg: "+5.2%", up: true  },
];
const PLATFORM_STATS = [
  { label: "XEV Circulating", val: "4.2M",   color: "#a3e635" },
  { label: "EP Minted Today",  val: "128K",   color: "#22d3ee" },
  { label: "Active Wallets",   val: "3,841",  color: "rgba(255,255,255,0.5)" },
  { label: "24h Volume",       val: "$42.1K", color: "#d4a847" },
];
const EP_INFO = [
  { label: "Like received",    val: "+1 EP" },
  { label: "Comment received", val: "+2 EP" },
  { label: "Share received",   val: "+3 EP" },
  { label: "Story unlock",     val: "+5 EP" },
  { label: "Daily login",      val: "+5 EP" },
  { label: "Deposit (₦1)",    val: "+1 EP" },
];

// ── Global layout CSS ─────────────────────────────────────────
// .wv-shell mirrors .pw-layout exactly:
//   fixed, top:56px, left = app's left-sidebar width, right:0
// The left-sidebar is ~280px on desktop (from Sidebar.jsx / App.jsx)
// We use the same CSS var the app already defines, with a safe fallback.
const WALLET_LAYOUT_CSS = `
  .wv-shell {
    position: fixed;
    top: 56px;
    /* Match whatever the app's left sidebar occupies */
    left: var(--sidebar-w, 280px);
    right: 0;
    bottom: 0;
    z-index: 49;
    display: flex;
    flex-direction: row;
    background: #07080a;
    overflow: hidden;
  }

  /* Mobile: respect host header (47px) and host bottom nav (~60px) */
  @media (max-width: 767px) {
    .wv-shell {
      top: 47px; left: 0;
      right: 0; bottom: 60px;
      z-index: 200;
    }
  }

  /* Tablet: left sidebar collapsed (~72px) */
  @media (min-width: 768px) and (max-width: 1099px) {
    .wv-shell {
      left: var(--sidebar-collapsed-w, 72px);
    }
  }

  .wv-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }
  .wv-center::-webkit-scrollbar { display: none; }

  .wv-content-pad {
    padding: 0 4%;
    flex: 1;
  }

  /* ── Right sidebar ── */
  .wv-sidebar {
    display: none;
  }
  @media (min-width: 1200px) {
    .wv-sidebar {
      display: flex;
      flex-direction: column;
      width: 280px;
      flex-shrink: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px 16px;
      background: rgba(4,5,6,0.97);
      border-left: 1px solid rgba(255,255,255,0.06);
      scrollbar-width: none;
    }
    .wv-sidebar::-webkit-scrollbar { display: none; }
  }

  /* ── Sidebar card atoms ── */
  .wvs-card {
    border-radius: 13px; padding: 13px 14px;
    margin-bottom: 14px;
    border: 1px solid rgba(255,255,255,0.055);
    background: rgba(255,255,255,0.02);
    flex-shrink: 0;
  }
  .wvs-card.lime { border-color: rgba(132,204,22,0.14); background: rgba(132,204,22,0.025); }
  .wvs-card.gold { border-color: rgba(212,168,71,0.16);  background: rgba(212,168,71,0.025); }
  .wvs-card.cyan { border-color: rgba(34,211,238,0.13);  background: rgba(34,211,238,0.025); }

  .wvs-title {
    font-family: 'Syne', sans-serif; font-size: 11.5px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
    color: rgba(255,255,255,0.25);
  }
  .wvs-title.lime { color: rgba(132,204,22,0.6); }
  .wvs-title.gold { color: rgba(212,168,71,0.55); }
  .wvs-title.cyan { color: rgba(34,211,238,0.55); }

  .wvs-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.035);
  }
  .wvs-row:last-child { border-bottom: none; padding-bottom: 0; }

  .wvs-pulse {
    width: 5px; height: 5px; border-radius: 50%; background: #a3e635;
    animation: wvs-blink 1.8s ease-in-out infinite;
  }
  @keyframes wvs-blink {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.3; transform:scale(0.6); }
  }
`;

// ── Right Sidebar ─────────────────────────────────────────────
function WalletSidebar() {
  return (
    <>
      <div className="wvs-card lime">
        <div className="wvs-title lime">
          <div className="wvs-pulse" />
          Crypto Markets
          <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "monospace", color: "rgba(132,204,22,0.4)", letterSpacing: "0.12em" }}>LIVE</span>
        </div>
        {CRYPTO_MARKETS.map(m => (
          <div key={m.sym} className="wvs-row">
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", fontFamily: "DM Mono, monospace" }}>{m.sym}</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: m.sym === "$XEV" ? "#a3e635" : "rgba(255,255,255,0.6)", fontFamily: "DM Mono, monospace" }}>{m.val}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: m.up ? "#a3e635" : "#f87171" }}>{m.chg}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="wvs-card gold">
        <div className="wvs-title gold">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          Platform Stats
        </div>
        {PLATFORM_STATS.map(s => (
          <div key={s.label} className="wvs-row">
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: "DM Sans, sans-serif" }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "DM Mono, monospace" }}>{s.val}</span>
          </div>
        ))}
      </div>

      <div className="wvs-card cyan">
        <div className="wvs-title cyan">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Earn EP
        </div>
        {EP_INFO.map(e => (
          <div key={e.label} className="wvs-row">
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "DM Sans, sans-serif" }}>{e.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22d3ee", fontFamily: "DM Mono, monospace" }}>{e.val}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(34,211,238,0.05)", borderRadius: 8, fontSize: 10.5, color: "rgba(255,255,255,0.2)", lineHeight: 1.6, fontFamily: "DM Sans, sans-serif" }}>
          EP is <strong style={{ color: "rgba(34,211,238,0.5)" }}>earned, not bought.</strong> Send it via PayWave (1 EP = ₦1) or swap to $XEV.
        </div>
      </div>

      <div className="wvs-card">
        <div className="wvs-title">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2.5}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
          EP Burn on Send
        </div>
        {[
          { range: "< 100 EP",  burn: "0.5 EP" },
          { range: "100–499",   burn: "2 EP"   },
          { range: "500–1999",  burn: "5 EP"   },
          { range: "2000+",     burn: "10 EP"  },
        ].map(r => (
          <div key={r.range} className="wvs-row">
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "DM Mono, monospace" }}>{r.range}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", fontFamily: "DM Mono, monospace" }}>{r.burn}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.06)", fontSize: 11, lineHeight: 1.65, color: "rgba(255,255,255,0.15)", fontFamily: "DM Sans, sans-serif", marginBottom: 16, flexShrink: 0 }}>
        🌐 <strong style={{ color: "rgba(132,204,22,0.4)" }}>Xeevia</strong> — where social meets finance. Every like, share and comment builds your wealth.
      </div>
    </>
  );
}

// ── WalletView ────────────────────────────────────────────────
const WalletView = ({
  userBalance: initialBalance,
  setUserBalance,
  isMobile,
  userId,
  refreshTrigger,
}) => {
  const { profile } = useAuth();

  const [activeTab,    setActiveTab]    = useState("overview");
  const [showPayWave,  setShowPayWave]  = useState(false);
  const [balance,      setBalance]      = useState(initialBalance || { tokens: 0, points: 0 });
  const [loading,      setLoading]      = useState(false);
  const [transactions, setTransactions] = useState([]);

  const loadWallet = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [walletData, txData] = await Promise.all([
        walletService.getWallet(userId),
        walletService.getRecentTransactions(userId, 20),
      ]);
      if (walletData) {
        const nb = {
          tokens: walletData.grova_tokens      ?? 0,  // ✅ correct column
          points: walletData.engagement_points ?? 0,
        };
        setBalance(nb);
        if (setUserBalance) setUserBalance(nb);
      }
      if (txData) setTransactions(txData);
    } catch (err) {
      console.error("Wallet load error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, setUserBalance]);

  useEffect(() => { loadWallet(); }, [loadWallet, refreshTrigger]);

  useEffect(() => {
    if (!userId) return;
    const unsub = walletService.subscribeToBalance(userId, (nb) => {
      setBalance(nb);
      if (setUserBalance) setUserBalance(nb);
    });
    return () => unsub?.();
  }, [userId, setUserBalance]);

  const handleTabChange = (tab) => {
    if (tab === "paywave") { setShowPayWave(true); return; }
    setActiveTab(tab);
  };

  const sharedProps = {
    setActiveTab:    handleTabChange,
    userId,
    balance,
    onRefresh:       loadWallet,
    transactions,
    setTransactions,
    username:        profile?.username,
  };

  // ── PayWave overlay ─────────────────────────────────────────
  if (showPayWave) {
    return (
      <CurrencyProvider>
        <PayWave
          userId={userId}
          epBalance={balance.points}
          xevBalance={balance.tokens}
          onBack={() => setShowPayWave(false)}
        />
      </CurrencyProvider>
    );
  }

  return (
    <CurrencyProvider>
      <style>{WALLET_LAYOUT_CSS}</style>

      {/* Full-viewport shell — mirrors PayWave exactly */}
      <div className="wv-shell">

        {/* Scrollable center content */}
        <div className="wv-center">
          <div className="wv-content-pad">
            {activeTab === "overview"  && <OverviewTab  {...sharedProps} loading={loading} />}
            {activeTab === "send"      && <SendTab      {...sharedProps} />}
            {activeTab === "deposit"   && <DepositTab   {...sharedProps} />}
            {activeTab === "receive"   && <ReceiveTab   {...sharedProps} />}
            {activeTab === "swap"      && <SwapTab      {...sharedProps} />}
            {activeTab === "trade"     && <TradeTab     {...sharedProps} />}
            {activeTab === "settings"  && <SettingsTab  {...sharedProps} />}
          </div>
        </div>

        {/* Right sidebar — desktop only */}
        <aside className="wv-sidebar">
          <WalletSidebar />
        </aside>

      </div>
    </CurrencyProvider>
  );
};

export default WalletView;