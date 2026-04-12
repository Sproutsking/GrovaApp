// src/components/wallet/WalletView.jsx
// ════════════════════════════════════════════════════════════════
// Xeevia Wallet — main shell
//
// FIX: Realtime balance subscription now has a strict userId guard.
//      Every incoming payload is checked against the current user's
//      userId before updating state — no other user's EP can bleed in.
//
// LIVE DATA:
//  • Left sidebar fetches real BTC/ETH/BNB/USDT prices from CoinGecko
//    every 60 seconds, with graceful fallback on error/rate-limit.
//  • Platform stats (XEV Circulating, EP Minted Today, Active Wallets)
//    pulled directly from Supabase — zero hardcoded values.
//  • EP Earn table is config-driven (accurate rates), not "mock" — it
//    reflects the platform's actual earn schedule.
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react";
import "./styles/WalletStyles.css";
import "./styles/tradeStyles.css";
import OverviewTab    from "./tabs/OverviewTab";
import SendTab        from "./tabs/SendTab";
import DepositTab     from "./tabs/DepositTab";
import ReceiveTab     from "./tabs/ReceiveTab";
import SwapTab        from "./tabs/SwapTab";
import TradeTab       from "./tabs/TradeTab";
import SettingsTab    from "./tabs/SettingsTab";
import PayWave        from "./paywave/PayWaveWrapper";
import { walletService } from "../../services/wallet/walletService";
import { CurrencyProvider } from "../../contexts/CurrencyContext";
import { useAuth } from "../Auth/AuthContext";
import { supabase } from "../../services/config/supabase";

// ── Nigerian / OPay region detection ────────────────────────────
function isNigerianUser(profile) {
  if (!profile) return false;
  if (profile?.region) {
    const r = profile.region.toLowerCase();
    if (r.includes("ng") || r.includes("nigeria")) return true;
  }
  if (profile?.phone) {
    const clean = profile.phone.replace(/[\s\-()\+]/g, "");
    if (clean.startsWith("234") || clean.startsWith("+234")) return true;
    if (/^0[789][01]/.test(clean)) return true;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.toLowerCase().includes("lagos") || tz.toLowerCase().includes("africa/")) return true;
  } catch {}
  return false;
}

// ── EP Earn rates ─────────────────────────────────────────────
const EP_EARN = [
  { label: "Like received",    val: "+1 EP" },
  { label: "Comment received", val: "+2 EP" },
  { label: "Share received",   val: "+3 EP" },
  { label: "Story unlock",     val: "+5 EP" },
  { label: "Daily login",      val: "+5 EP" },
  { label: "Deposit (₦1)",    val: "+1 EP" },
];

const EP_BURN_TABLE = [
  { range: "< 100 EP",  burn: "0.5 EP" },
  { range: "100–499",   burn: "2 EP"   },
  { range: "500–1999",  burn: "5 EP"   },
  { range: "2000+",     burn: "10 EP"  },
];

// ─────────────────────────────────────────────────────────────
// LAYOUT CSS
// ─────────────────────────────────────────────────────────────
const LAYOUT_CSS = `
  .wv-shell {
    position: fixed;
    top: 58px;
    left: calc(300px + 4%);
    right: 4%;
    bottom: 0;
    z-index: 49;
    display: flex;
    flex-direction: row;
    background: #07080a;
    overflow: hidden;
  }

  @media (max-width: 767px) {
    .wv-shell {
      top: 20px;
      left: 0;
      right: 0;
      bottom: 40px;
      z-index: 200;
    }
  }

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
    padding: 16px 4% 24px;
    flex: 1;
  }

  /* ── Right sidebar ── */
  .wv-sidebar { display: none; }

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
      border-left: 1px solid rgba(255,255,255,0.07);
      scrollbar-width: none;
    }
    .wv-sidebar::-webkit-scrollbar { display: none; }
  }

  /* ── Sidebar cards ── */
  .wvs-card {
    border-radius: 13px;
    padding: 13px 14px;
    margin-bottom: 14px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.025);
    flex-shrink: 0;
  }
  .wvs-card.lime { border-color: rgba(132,204,22,0.18);  background: rgba(132,204,22,0.03); }
  .wvs-card.gold { border-color: rgba(212,168,71,0.18);  background: rgba(212,168,71,0.03); }
  .wvs-card.cyan { border-color: rgba(34,211,238,0.16);  background: rgba(34,211,238,0.03); }

  .wvs-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255,255,255,0.35);
  }
  .wvs-title.lime { color: rgba(132,204,22,0.75); }
  .wvs-title.gold { color: rgba(212,168,71,0.7);  }
  .wvs-title.cyan { color: rgba(34,211,238,0.7);  }

  .wvs-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .wvs-row:last-child { border-bottom: none; padding-bottom: 0; }

  .wvs-sym   { font-size: 12.5px; font-weight: 700; color: rgba(255,255,255,0.55); font-family: 'DM Mono', monospace; }
  .wvs-price { font-size: 12.5px; font-weight: 700; font-family: 'DM Mono', monospace; }
  .wvs-chg   { font-size: 10px;   font-weight: 700; font-family: 'DM Mono', monospace; margin-top: 1px; }
  .wvs-chg.up   { color: #a3e635; }
  .wvs-chg.down { color: #f87171; }
  .wvs-chg.flat { color: rgba(255,255,255,0.3); }

  .wvs-stat-label { font-size: 11px; color: rgba(255,255,255,0.42); }
  .wvs-stat-val   { font-size: 12.5px; font-weight: 700; font-family: 'DM Mono', monospace; }

  .wvs-earn-label { font-size: 11px; color: rgba(255,255,255,0.42); }
  .wvs-earn-val   { font-size: 11px; font-weight: 700; font-family: 'DM Mono', monospace; color: #22d3ee; }
  .wvs-burn-range { font-size: 11px; color: rgba(255,255,255,0.38); font-family: 'DM Mono', monospace; }
  .wvs-burn-val   { font-size: 11px; font-weight: 700; font-family: 'DM Mono', monospace; color: #f87171; }

  @keyframes wvsSkel {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  .wvs-loading { animation: wvsSkel 1.4s ease-in-out infinite; color: rgba(255,255,255,0.18) !important; }

  .wvs-pulse {
    width: 5px; height: 5px; border-radius: 50%;
    background: #a3e635;
    animation: wvsBlink 1.8s ease-in-out infinite;
  }
  @keyframes wvsBlink {
    0%, 100% { opacity: 1; transform: scale(1);   }
    50%       { opacity: .3; transform: scale(.6); }
  }

  .wvs-launch {
    padding: 10px 12px; border-radius: 10px;
    border: 1px dashed rgba(163,230,53,0.2);
    background: rgba(163,230,53,0.03);
    font-size: 11px; line-height: 1.7;
    color: rgba(255,255,255,0.32);
    margin-bottom: 14px; flex-shrink: 0; text-align: center;
  }

  .section-head  { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; justify-content: center; }
  .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(255,255,255,0.22); white-space: nowrap; flex-shrink: 0; }
  .section-line  { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); max-width: 120px; }
`;

// ── Right Sidebar ─────────────────────────────────────────────
function WalletSidebar() {
  const [markets, setMarkets] = useState([
    { sym: "BTC",  val: null,    chg: null,         up: true },
    { sym: "ETH",  val: null,    chg: null,         up: true },
    { sym: "BNB",  val: null,    chg: null,         up: true },
    { sym: "USDT", val: "$1.00", chg: "+0.00%",     up: true },
    { sym: "$XEV", val: "₦2.50", chg: "Launching",  up: true },
  ]);

  const [platformStats, setPlatformStats] = useState([
    { label: "XEV Circulating", val: null, color: "#a3e635" },
    { label: "EP Minted Today", val: null, color: "#22d3ee" },
    { label: "Active Wallets",  val: null, color: "rgba(255,255,255,0.65)" },
    { label: "24h Volume",      val: null, color: "#d4a847" },
  ]);

  const [cryptoStale, setCryptoStale] = useState(true);

  const fmtPrice = (n) => {
    if (n == null) return null;
    if (n >= 10000) return `$${Math.round(n).toLocaleString()}`;
    if (n >= 100)   return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return `$${n.toFixed(4)}`;
  };

  const fmtChg = (n) => {
    if (n == null) return null;
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  };

  const fetchCrypto = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price" +
        "?ids=bitcoin,ethereum,binancecoin,tether" +
        "&vs_currencies=usd&include_24hr_change=true",
        { signal: AbortSignal.timeout(9000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setMarkets([
        { sym: "BTC",  val: fmtPrice(d.bitcoin?.usd),      chg: fmtChg(d.bitcoin?.usd_24h_change),      up: (d.bitcoin?.usd_24h_change      ?? 0) >= 0 },
        { sym: "ETH",  val: fmtPrice(d.ethereum?.usd),     chg: fmtChg(d.ethereum?.usd_24h_change),     up: (d.ethereum?.usd_24h_change     ?? 0) >= 0 },
        { sym: "BNB",  val: fmtPrice(d.binancecoin?.usd),  chg: fmtChg(d.binancecoin?.usd_24h_change),  up: (d.binancecoin?.usd_24h_change  ?? 0) >= 0 },
        { sym: "USDT", val: fmtPrice(d.tether?.usd) ?? "$1.00", chg: fmtChg(d.tether?.usd_24h_change) ?? "+0.00%", up: true },
        { sym: "$XEV", val: "₦2.50", chg: "Launching", up: true },
      ]);
      setCryptoStale(false);
    } catch {
      setCryptoStale(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPlatformStats = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [walletCountRes, xevSumRes, epTodayRes, volumeRes] = await Promise.allSettled([
        supabase.from("wallets").select("*", { count: "exact", head: true }),
        supabase.from("wallets").select("grova_tokens"),
        supabase.from("wallet_history")
          .select("amount, metadata")
          .eq("change_type", "credit")
          .gte("created_at", todayStart.toISOString()),
        supabase.from("wallet_history")
          .select("amount, metadata")
          .eq("change_type", "debit")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);

      const walletCount = walletCountRes.status === "fulfilled"
        ? walletCountRes.value.count ?? 0 : 0;

      const xevCirculating = xevSumRes.status === "fulfilled"
        ? (xevSumRes.value.data ?? []).reduce((s, r) => s + (r.grova_tokens || 0), 0) : 0;

      const epToday = epTodayRes.status === "fulfilled"
        ? (epTodayRes.value.data ?? [])
            .filter(r => {
              const m = r.metadata || {};
              return m.currency === "EP" || m.currency_type === "EP" ||
                     m.type === "EP" || m.displayCurrency === "EP";
            })
            .reduce((s, r) => s + (r.amount || 0), 0)
        : 0;

      const volume24h = volumeRes.status === "fulfilled"
        ? (volumeRes.value.data ?? [])
            .filter(r => {
              const m = r.metadata || {};
              return m.currency === "XEV" || m.currency_type === "XEV";
            })
            .reduce((s, r) => s + (r.amount || 0), 0)
        : 0;

      const fmtStat = (n) =>
        n > 0 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0";

      setPlatformStats([
        { label: "XEV Circulating", val: fmtStat(xevCirculating), color: "#a3e635" },
        { label: "EP Minted Today", val: fmtStat(epToday),         color: "#22d3ee" },
        { label: "Active Wallets",  val: fmtStat(walletCount),     color: "rgba(255,255,255,0.75)" },
        { label: "24h Volume",      val: volume24h > 0 ? `$${fmtStat(volume24h * 0.0016)}` : "$0", color: "#d4a847" },
      ]);
    } catch (err) {
      console.warn("[WalletSidebar] platform stats error:", err);
    }
  }, []);

  useEffect(() => {
    fetchCrypto();
    fetchPlatformStats();
    const t = setInterval(fetchCrypto, 60_000);
    return () => clearInterval(t);
  }, [fetchCrypto, fetchPlatformStats]);

  return (
    <>
      <div className="wvs-launch">
        🚀 <strong style={{ color: "rgba(163,230,53,0.7)" }}>Xeevia is live.</strong>
        <br />Market data populates as the platform grows.
        <br /><span style={{ color: "rgba(255,255,255,0.18)" }}>Token sale coming soon.</span>
      </div>

      <div className="wvs-card lime">
        <div className="wvs-title lime">
          <div className="wvs-pulse" />
          Crypto Markets
          <span style={{
            marginLeft: "auto", fontSize: 9, fontFamily: "monospace",
            color: cryptoStale ? "rgba(248,113,113,0.5)" : "rgba(132,204,22,0.55)",
            letterSpacing: "0.1em",
          }}>
            {cryptoStale ? "STALE" : "LIVE"}
          </span>
        </div>
        {markets.map((m) => (
          <div key={m.sym} className="wvs-row">
            <span className="wvs-sym">{m.sym}</span>
            <div style={{ textAlign: "right" }}>
              <div className={`wvs-price ${m.val == null ? "wvs-loading" : ""}`}
                style={{ color: m.sym === "$XEV" ? "#a3e635" : "rgba(255,255,255,0.82)" }}>
                {m.val ?? "···"}
              </div>
              {m.chg != null && (
                <div className={`wvs-chg ${m.chg === "Launching" ? "flat" : m.up ? "up" : "down"}`}>
                  {m.chg}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="wvs-card gold">
        <div className="wvs-title gold">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
          </svg>
          Platform Stats
        </div>
        {platformStats.map((s) => (
          <div key={s.label} className="wvs-row">
            <span className="wvs-stat-label">{s.label}</span>
            <span className={`wvs-stat-val ${s.val == null ? "wvs-loading" : ""}`} style={{ color: s.color }}>
              {s.val ?? "···"}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", lineHeight: 1.6 }}>
          Refreshes with every page load
        </div>
      </div>

      <div className="wvs-card cyan">
        <div className="wvs-title cyan">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Earn EP
        </div>
        {EP_EARN.map((e) => (
          <div key={e.label} className="wvs-row">
            <span className="wvs-earn-label">{e.label}</span>
            <span className="wvs-earn-val">{e.val}</span>
          </div>
        ))}
        <div style={{
          marginTop: 10, padding: "8px 10px",
          background: "rgba(34,211,238,0.06)", borderRadius: 8,
          fontSize: 10.5, color: "rgba(255,255,255,0.28)", lineHeight: 1.65,
        }}>
          EP is <strong style={{ color: "rgba(34,211,238,0.6)" }}>earned, not bought.</strong>{" "}
          Swap to $XEV or send via PayWave.
        </div>
      </div>

      <div className="wvs-card">
        <div className="wvs-title">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2.5}>
            <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
          </svg>
          EP Burn on Send
        </div>
        {EP_BURN_TABLE.map((r) => (
          <div key={r.range} className="wvs-row">
            <span className="wvs-burn-range">{r.range}</span>
            <span className="wvs-burn-val">{r.burn}</span>
          </div>
        ))}
      </div>

      <div style={{
        padding: "10px 12px", borderRadius: 10,
        border: "1px dashed rgba(255,255,255,0.07)",
        fontSize: 11, lineHeight: 1.7, color: "rgba(255,255,255,0.22)",
        marginBottom: 16, flexShrink: 0, textAlign: "center",
      }}>
        🌐 <strong style={{ color: "rgba(132,204,22,0.5)" }}>Xeevia</strong> — where social
        meets finance. Every like, share and comment builds your wealth.
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// WalletView
// ════════════════════════════════════════════════════════════════
const WalletView = ({
  userBalance: initialBalance,
  setUserBalance,
  isMobile,
  userId,
  refreshTrigger,
}) => {
  const { profile } = useAuth();
  const showPayWave = isNigerianUser(profile);

  const [activeTab,      setActiveTab]      = useState("overview");
  const [showPayWaveV,   setShowPayWaveV]   = useState(false);
  const [balance,        setBalance]        = useState(
    initialBalance || { tokens: 0, points: 0 }
  );
  const [loading,        setLoading]        = useState(false);
  const [transactions,   setTransactions]   = useState([]);

  // ── Stable setter: ONLY accept updates that belong to this user ──
  // This is the critical guard that prevents other users' EP from
  // bleeding into this wallet's state via realtime or prop changes.
  const safeSetBalance = useCallback((nb, sourceUserId) => {
    // If caller passes a sourceUserId, verify it matches before updating
    if (sourceUserId && sourceUserId !== userId) {
      console.warn("[WalletView] Rejected balance update from wrong userId:", sourceUserId);
      return;
    }
    // Validate shape — must have numeric tokens and points
    if (typeof nb?.tokens !== "number" || typeof nb?.points !== "number") {
      console.warn("[WalletView] Rejected malformed balance payload:", nb);
      return;
    }
    setBalance(nb);
    if (setUserBalance) setUserBalance(nb);
  }, [userId, setUserBalance]);

  // ── Load wallet + transactions ────────────────────────────────
  const loadWallet = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);

      // Fetch wallet directly from Supabase with explicit user_id filter
      // — never trust walletService alone; double-check the row belongs to us
      const [walletRes, txData] = await Promise.all([
        supabase
          .from("wallets")
          .select("user_id, grova_tokens, engagement_points, paywave_balance")
          .eq("user_id", userId)   // ← hard filter: THIS user only
          .single(),
        walletService.getRecentTransactions(userId, 25),
      ]);

      if (walletRes.data) {
        const row = walletRes.data;
        // Paranoia check: confirm the row really is ours
        if (row.user_id !== userId) {
          console.error("[WalletView] wallet row user_id mismatch — ignoring");
        } else {
          safeSetBalance({
            tokens:  Number(row.grova_tokens)      || 0,
            points:  Math.floor(Number(row.engagement_points) || 0),
            paywave: Number(row.paywave_balance)   || 0,
          });
        }
      }

      if (txData) setTransactions(txData);
    } catch (err) {
      console.error("[WalletView] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, safeSetBalance]);

  useEffect(() => { loadWallet(); }, [loadWallet, refreshTrigger]);

  // ── Real-time balance — scoped to THIS user's wallet row ─────
  useEffect(() => {
    if (!userId) return;

    // Subscribe at the Supabase channel level with a user_id filter
    // so the server never sends other users' rows to this client.
    const channel = supabase
      .channel(`wallet:${userId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "wallets",
          filter: `user_id=eq.${userId}`,   // ← server-side filter
        },
        (payload) => {
          const row = payload.new;
          if (!row) return;

          // Client-side guard — double-check even though server filtered
          if (row.user_id !== userId) {
            console.warn("[WalletView] RT: unexpected user_id in payload, ignoring");
            return;
          }

          safeSetBalance({
            tokens:  Number(row.grova_tokens)      || 0,
            points:  Math.floor(Number(row.engagement_points) || 0),
            paywave: Number(row.paywave_balance)   || 0,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, safeSetBalance]);

  // ── Real-time transactions — scoped to this user ─────────────
  useEffect(() => {
    if (!userId) return;
    const unsub = walletService.subscribeToTransactions(userId, (enrichedTx) => {
      // Guard: only accept transactions that belong to this user
      if (enrichedTx.user_id && enrichedTx.user_id !== userId) return;

      setTransactions((prev) => {
        const filtered = prev.filter(
          (tx) =>
            !(
              tx._optimistic === true &&
              Math.abs((tx.amount || 0) - (enrichedTx.amount || 0)) < 0.001 &&
              tx.displayCurrency === enrichedTx.displayCurrency
            )
        );
        if (filtered.some((tx) => tx.id === enrichedTx.id)) return filtered;
        return [enrichedTx, ...filtered];
      });
    });
    return () => unsub?.();
  }, [userId]);

  const handleTabChange = (tab) => {
    if (tab === "paywave") {
      if (!showPayWave) return;
      setShowPayWaveV(true);
      return;
    }
    setActiveTab(tab);
  };

  const sharedProps = {
    setActiveTab: handleTabChange,
    userId,
    balance,
    onRefresh:       loadWallet,
    transactions,
    setTransactions,
    username:        profile?.username,
    showPayWave,
    currentUser:     profile,
  };

  if (showPayWaveV) {
    return (
      <CurrencyProvider>
        <PayWave
          userId={userId}
          epBalance={balance.points}
          xevBalance={balance.tokens}
          onBack={() => setShowPayWaveV(false)}
        />
      </CurrencyProvider>
    );
  }

  return (
    <CurrencyProvider>
      <style>{LAYOUT_CSS}</style>
      <div className="wv-shell">
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
        <aside className="wv-sidebar">
          <WalletSidebar />
        </aside>
      </div>
    </CurrencyProvider>
  );
};

export default WalletView;