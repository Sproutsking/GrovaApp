// src/components/wallet/WalletView.jsx
// ════════════════════════════════════════════════════════════════
// Xeevia Wallet — main shell
//
// FIXES in this version:
//  • useMobileTop() hook measures the real fixed-header height at
//    runtime and sets --wv-top-offset / --wv-bottom-offset on :root
//    so the wallet shell is NEVER hidden behind the mobile header.
//  • WithdrawTab imported and wired (unchanged from previous)
//  • Realtime balance subscription has strict userId guard (unchanged)
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react";
import "./styles/WalletStyles.css";
import "./styles/tradeStyles.css";
import OverviewTab    from "./tabs/OverviewTab";
import SendTab        from "./tabs/SendTab";
import DepositTab     from "./tabs/DepositTab";
import ReceiveTab     from "./tabs/ReceiveTab";
import SettingsTab    from "./tabs/SettingsTab";
import WithdrawTab    from "./tabs/WithdrawTab";
import PayWave        from "./paywave/PayWaveWrapper";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { walletService } from "../../services/wallet/walletService";
import { CurrencyProvider } from "../../contexts/CurrencyContext";
import { useAuth } from "../Auth/AuthContext";
import { supabase } from "../../services/config/supabase";
import useTrinitylens from "../../hooks/useTrinitylens";

// ── Nigerian / OPay region detection ────────────────────────────
function isNigerianUser(profile) {
  if (!profile) return false;
  if (profile?.region) {
    const r = profile.region.toLowerCase();
    if (r === "ng" || r.includes("nigeria")) return true;
  }
  if (profile?.phone) {
    const clean = profile.phone.replace(/[\s\-()\+]/g, "");
    if (clean.startsWith("234")) return true;
    if (/^0[789][01]/.test(clean)) return true;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.toLowerCase().includes("lagos")) return true;
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

const WALLET_MARKET_TTL = 300_000;
let walletMarketCache = { data: null, updatedAt: 0 };

// ── useMobileTop ─────────────────────────────────────────────────
// Measures the tallest fixed/sticky top bar and tallest bottom bar
// then writes --wv-top-offset / --wv-bottom-offset to :root so the
// wallet shell can position itself correctly on every device.
function useMobileTop(shellRef) {
  useEffect(() => {
    function measure() {
      let topBarBottom    = 0;
      let bottomBarHeight = 0;

      document.querySelectorAll("*").forEach(el => {
        if (!el.isConnected) return;
        // Skip anything inside the wallet shell itself
        if (shellRef?.current && shellRef.current.contains(el)) return;

        const style = getComputedStyle(el);
        if (style.position !== "fixed" && style.position !== "sticky") return;
        // Must span at least 40% of the viewport width to count as a bar
        const rect = el.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.4 || rect.height < 2) return;

        // Top bars — bottom edge within the top 25% of the screen
        if (rect.top <= 2 && rect.bottom < window.innerHeight * 0.25) {
          topBarBottom = Math.max(topBarBottom, rect.bottom);
        }
        // Bottom bars — top edge within the bottom 20% of the screen
        if (rect.top > window.innerHeight * 0.8) {
          bottomBarHeight = Math.max(bottomBarHeight, window.innerHeight - rect.top);
        }
      });

      // Write to CSS vars on :root for any descendant to read
      document.documentElement.style.setProperty("--wv-top-offset",    `${topBarBottom}px`);
      document.documentElement.style.setProperty("--wv-bottom-offset",  `${Math.max(bottomBarHeight, 48)}px`);
    }

    measure();
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 600);
    window.addEventListener("resize",            measure, { passive: true });
    window.addEventListener("orientationchange", measure, { passive: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize",            measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [shellRef]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT CSS
// ─────────────────────────────────────────────────────────────────────────────
const LAYOUT_CSS = `
  /* ─────────────────────────────────────────────────────────────
     Shell — desktop opens flush against the sidebar with no gutter
     and runs fully to the right screen edge, top to bottom, right
     under the header with no gap. --edge-left carries no gutter
     (unlike --layout-left, which is for main-content-desktop and
     deliberately leaves breathing room) and right is a hard 0, not
     --layout-right, since Wallet has no reason to reserve space for
     the trending sidebar it doesn't sit next to. Top is 56px to
     match .desktop-header's actual height exactly — it was 58px
     before, which left a 2px sliver of empty space under the header.
     Mobile uses the measured CSS vars so we NEVER overlap the
     top/bottom bars.
  ───────────────────────────────────────────────────────────── */
  .wv-shell {
    position: fixed;
    top: 56px;
    left: var(--edge-left, 300px);
    right: var(--app-frame-left, 0px);
    bottom: 0;
    z-index: 49;
    display: flex;
    flex-direction: row;
    background: #07080a;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .wv-shell {
      /* Fall back to the measured header height; default 0 so it's
         not worse than before if the hook hasn't run yet */
      top:    var(--wv-top-offset, 0px) !important;
      bottom: var(--wv-bottom-offset, 56px) !important;
      left:   0;
      right:  0;
      z-index: 200;
    }
  }

  /* Tablet (769–1024px): no override needed here — --edge-left is
     defined purely off --sidebar-w in global.css, so when that
     media query collapses --sidebar-w to 260px, .wv-shell picks it
     up automatically. Same single-source-of-truth guarantee as
     CommunityView.css. */

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

  /* Tab sections own their spacing; the shell contributes none. */
  .wv-content-pad { padding: 0; flex: 1; min-width: 0; }

  /* ── Right sidebar ── */
  .wv-sidebar { display: none; }

  @media (min-width: 1120px) {
    .wv-sidebar {
      display: flex;
      flex-direction: column;
      width: clamp(256px, 24vw, 320px);
      flex-shrink: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 18px 14px 24px;
      gap: 18px;
      background: linear-gradient(180deg, rgba(8,11,8,.99), rgba(5,6,5,.99));
      border-left: 1px solid rgba(198,255,0,.12);
      scrollbar-width: none;
    }
    .wv-sidebar::-webkit-scrollbar { display: none; }
  }

  .wvs-head{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .wvs-kicker{font-size:9px;font-weight:800;letter-spacing:.15em;color:rgba(198,255,0,.66);}
  .wvs-heading{margin-top:5px;color:#f2f5ef;font-size:18px;font-weight:750;}
  .wvs-secure{display:flex;align-items:center;gap:5px;color:rgba(198,255,0,.74);font-size:9px;font-weight:700;}
  .wvs-summary{padding:15px;border:1px solid rgba(198,255,0,.2);border-radius:12px;background:radial-gradient(ellipse at 90% 0%,rgba(198,255,0,.09),transparent 58%),linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.012));}
  .wvs-summary-label{font-size:9px;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.42);}
  .wvs-summary-balance{display:flex;align-items:baseline;gap:8px;margin-top:8px;color:#f7f9f3;}
  .wvs-summary-balance strong{font-size:30px;font-weight:750;line-height:1;}
  .wvs-summary-balance span{color:#c6ff00;font-size:12px;font-weight:800;}
  .wvs-summary-secondary{display:flex;justify-content:space-between;gap:8px;margin-top:13px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:10px;color:rgba(255,255,255,.45);}
  .wvs-summary-secondary strong{color:rgba(255,255,255,.8);font-weight:700;}
  .wvs-section{flex-shrink:0;}
  .wvs-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
  .wvs-section-title{color:#e9ede7;font-size:12px;font-weight:750;}
  .wvs-section-meta{margin-top:3px;color:rgba(255,255,255,.34);font-size:9px;}
  .wvs-refresh{width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.035);color:rgba(255,255,255,.55);cursor:pointer;}
  .wvs-refresh:hover:not(:disabled){border-color:rgba(198,255,0,.28);color:#c6ff00;}
  .wvs-refresh:disabled{opacity:.45;cursor:wait;}
  .wvs-refreshing{animation:wvsSpin 1s linear infinite;}
  @keyframes wvsSpin{to{transform:rotate(360deg)}}
  .wvs-market-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055);}
  .wvs-market-row:last-child{border-bottom:0;}
  .wvs-market-name{display:flex;align-items:center;gap:8px;min-width:0;}
  .wvs-market-icon{width:25px;height:25px;display:grid;place-items:center;flex-shrink:0;border-radius:8px;background:rgba(255,255,255,.055);color:#c6ff00;font-size:9px;font-weight:800;}
  .wvs-sym{color:rgba(255,255,255,.72);font-size:11px;font-weight:700;}
  .wvs-price{color:#f0f2ee;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;}
  .wvs-chg{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;}
  .wvs-chg.up   { color: #a3e635; }
  .wvs-chg.down { color: #f87171; }
  .wvs-chg.flat { color: rgba(255,255,255,0.36); }
  .wvs-activity-row{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.055);font-size:10px;}
  .wvs-activity-row:last-child{border-bottom:0;}
  .wvs-activity-label{color:rgba(255,255,255,.5);}
  .wvs-activity-value{color:#a3e635;font-weight:750;font-variant-numeric:tabular-nums;}
  .wvs-burn-note{margin-top:10px;padding:9px 10px;border-left:2px solid rgba(212,175,55,.55);background:rgba(212,175,55,.055);color:rgba(255,255,255,.48);font-size:9px;line-height:1.5;}
  .wvs-burn-details{margin-top:8px;color:rgba(255,255,255,.58);font-size:10px;}
  .wvs-burn-details summary{width:max-content;color:rgba(212,175,55,.8);cursor:pointer;}
  .wvs-burn-details[open] summary{margin-bottom:5px;}

  @keyframes wvsSkel {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  .wvs-loading { color: rgba(255,255,255,0.25) !important; }

  .wvs-pulse {
    width: 5px; height: 5px; border-radius: 50%;
    background: #a3e635;
    animation: wvsBlink 1.8s ease-in-out infinite;
  }
  @keyframes wvsBlink {
    0%, 100% { opacity: 1; transform: scale(1);   }
    50%       { opacity: .3; transform: scale(.6); }
  }

  .wv-shell { padding-left: 0 !important; padding-right: 0 !important; }
`;

// ── Right Sidebar ─────────────────────────────────────────────
function WalletSidebar({ balance }) {
  const { activeTrinityLens } = useTrinitylens();
  const [markets, setMarkets] = useState([
    { sym: "BTC",  val: null,    chg: null,        up: true },
    { sym: "ETH",  val: null,    chg: null,        up: true },
    { sym: "BNB",  val: null,    chg: null,        up: true },
    { sym: "USDT", val: "$1.00", chg: "+0.00%",    up: true },
  ]);

  const [cryptoStale, setCryptoStale] = useState(true);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketUpdatedAt, setMarketUpdatedAt] = useState(walletMarketCache.updatedAt);
  const sidebarMarkets = activeTrinityLens === "gaming"
    ? [
        { sym: "XP", val: "0", chg: "Player XP", up: true },
        { sym: "COINS", val: "0", chg: "Virtual coins", up: true },
        { sym: "ITEMS", val: "0", chg: "Game assets", up: true },
        { sym: "ESCROW", val: "0", chg: "Protected", up: true },
      ]
    : markets;
  const modeRail = activeTrinityLens === "gaming"
    ? {
        title: "Gaming Economy",
        rows: [["Game assets", "Ready"], ["Escrow", "Protected"], ["Player tips", "Instant"]],
      }
    : activeTrinityLens === "web3"
      ? {
          title: "On-chain Pulse",
          rows: [["Network", "XRC"], ["Signatures", "Secure"], ["Staking", "Available"]],
        }
      : null;

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

  const fetchCrypto = useCallback(async (force = false) => {
    const cacheIsFresh = walletMarketCache.data && Date.now() - walletMarketCache.updatedAt < WALLET_MARKET_TTL;
    if (!force && cacheIsFresh) {
      setMarkets(walletMarketCache.data);
      setMarketUpdatedAt(walletMarketCache.updatedAt);
      setCryptoStale(false);
      return;
    }

    setMarketLoading(true);
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price" +
        "?ids=bitcoin,ethereum,binancecoin,tether" +
        "&vs_currencies=usd&include_24hr_change=true",
        { signal: AbortSignal.timeout(9000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const nextMarkets = [
        { sym: "BTC",  val: fmtPrice(d.bitcoin?.usd),      chg: fmtChg(d.bitcoin?.usd_24h_change),      up: (d.bitcoin?.usd_24h_change      ?? 0) >= 0 },
        { sym: "ETH",  val: fmtPrice(d.ethereum?.usd),     chg: fmtChg(d.ethereum?.usd_24h_change),     up: (d.ethereum?.usd_24h_change     ?? 0) >= 0 },
        { sym: "BNB",  val: fmtPrice(d.binancecoin?.usd),  chg: fmtChg(d.binancecoin?.usd_24h_change),  up: (d.binancecoin?.usd_24h_change  ?? 0) >= 0 },
        { sym: "USDT", val: fmtPrice(d.tether?.usd) ?? "$1.00", chg: fmtChg(d.tether?.usd_24h_change) ?? "+0.00%", up: true },
      ];
      walletMarketCache = { data: nextMarkets, updatedAt: Date.now() };
      setMarkets(nextMarkets);
      setMarketUpdatedAt(walletMarketCache.updatedAt);
      setCryptoStale(false);
    } catch {
      setCryptoStale(true);
    } finally {
      setMarketLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1120px)");
    let refreshTimer = null;
    const syncMarketUpdates = () => {
      clearInterval(refreshTimer);
      refreshTimer = null;
      if (desktopQuery.matches && activeTrinityLens !== "gaming") {
        void fetchCrypto();
        refreshTimer = setInterval(() => fetchCrypto(), WALLET_MARKET_TTL);
      }
    };
    syncMarketUpdates();
    desktopQuery.addEventListener("change", syncMarketUpdates);
    return () => {
      clearInterval(refreshTimer);
      desktopQuery.removeEventListener("change", syncMarketUpdates);
    };
  }, [activeTrinityLens, fetchCrypto]);

  return (
    <>
      <header className="wvs-head">
        <div>
          <div className="wvs-kicker">WALLET / PULSE</div>
          <div className="wvs-heading">Your money space</div>
        </div>
        <div className="wvs-secure"><ShieldCheck size={13} /> PRIVATE</div>
      </header>

      <section className="wvs-summary" aria-label="Wallet balance summary">
        <div className="wvs-summary-label">AVAILABLE BALANCE</div>
        <div className="wvs-summary-balance">
          <strong>{Math.floor(Number(balance?.points) || 0).toLocaleString()}</strong>
          <span>EP</span>
        </div>
        <div className="wvs-summary-secondary">
          <span>Token balance</span>
          <strong>{Number(balance?.tokens || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} XEV</strong>
        </div>
        {balance?.paywave != null && Number(balance.paywave) > 0 && (
          <div className="wvs-summary-secondary">
            <span>PayWave</span>
            <strong>{Number(balance.paywave).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>
        )}
      </section>

      {modeRail && (
        <section className="wvs-section wvs-mode-strip">
          <div className="wvs-section-head">
            <div>
              <div className="wvs-section-title">{modeRail.title}</div>
              <div className="wvs-section-meta">Wallet tools for this mode</div>
            </div>
          </div>
          {modeRail.rows.map(([label, value]) => (
            <div className="wvs-activity-row" key={label}>
              <span className="wvs-activity-label">{label}</span>
              <span className="wvs-activity-value">{value}</span>
            </div>
          ))}
        </section>
      )}

      <section className="wvs-section" aria-label="Market watch">
        <div className="wvs-section-head">
          <div>
            <div className="wvs-section-title">Market watch</div>
            <div className="wvs-section-meta">
              {marketUpdatedAt
                ? `Updated ${new Date(marketUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : cryptoStale ? "Public quotes unavailable" : "Public market quotes"}
            </div>
          </div>
          <button className="wvs-refresh" type="button" onClick={() => fetchCrypto(true)} disabled={marketLoading || activeTrinityLens === "gaming"} title="Refresh market quotes" aria-label="Refresh market quotes">
            <RefreshCw size={13} className={marketLoading ? "wvs-refreshing" : ""} />
          </button>
        </div>
        <div className="wvs-market-list">
          {sidebarMarkets.map((market) => (
            <div key={market.sym} className="wvs-market-row">
              <div className="wvs-market-name">
                <span className="wvs-market-icon">{market.sym.slice(0, 1)}</span>
                <span className="wvs-sym">{market.sym}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={`wvs-price ${market.val == null ? "wvs-loading" : ""}`}>
                  {market.val ?? "···"}
                </div>
                {market.chg != null && (
                  <div className={`wvs-chg ${market.chg === "Launching" ? "flat" : market.up ? "up" : "down"}`}>
                    {market.chg}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="wvs-section" aria-label="EP activity guide">
        <div className="wvs-section-head">
          <div>
            <div className="wvs-section-title">EP activity</div>
            <div className="wvs-section-meta">Earn through participation</div>
          </div>
        </div>
        {EP_EARN.map((activity) => (
          <div key={activity.label} className="wvs-activity-row">
            <span className="wvs-activity-label">{activity.label}</span>
            <span className="wvs-activity-value">{activity.val}</span>
          </div>
        ))}
        <div className="wvs-burn-note">
          Sending EP uses a small tiered burn. Review the amount before confirming a transfer.
        </div>
        <details className="wvs-burn-details">
          <summary>View send tiers</summary>
          {EP_BURN_TABLE.map((tier) => (
            <div key={tier.range} className="wvs-activity-row">
              <span className="wvs-activity-label">{tier.range}</span>
              <span className="wvs-activity-value">{tier.burn}</span>
            </div>
          ))}
        </details>
      </section>
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

  const shellRef = useRef(null);           // ← for useMobileTop
  useMobileTop(shellRef);                  // ← measures real header height

  const [activeTab,      setActiveTab]      = useState("overview");
  const [showPayWaveV,   setShowPayWaveV]   = useState(false);
  const [walletNotice,   setWalletNotice]   = useState("");
  const [balance,        setBalance]        = useState(
    initialBalance || { tokens: 0, points: 0 }
  );
  const [loading,        setLoading]        = useState(false);
  const [transactions,   setTransactions]   = useState([]);

  // ── Stable setter: ONLY accept updates that belong to this user ──
  const safeSetBalance = useCallback((nb, sourceUserId) => {
    if (sourceUserId && sourceUserId !== userId) {
      console.warn("[WalletView] Rejected balance update from wrong userId:", sourceUserId);
      return;
    }
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

      const [walletRes, txData] = await Promise.all([
        supabase
          .from("wallets")
          .select("user_id, xev_tokens, engagement_points, paywave_balance")
          .eq("user_id", userId)
          .single(),
        walletService.getRecentTransactions(userId, 25),
      ]);

      if (walletRes.data) {
        const row = walletRes.data;
        if (row.user_id !== userId) {
          console.error("[WalletView] wallet row user_id mismatch — ignoring");
        } else {
          safeSetBalance({
            tokens:  Number(row.xev_tokens)      || 0,
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

    const channel = supabase
      .channel(`wallet:${userId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          if (row.user_id !== userId) {
            console.warn("[WalletView] RT: unexpected user_id in payload, ignoring");
            return;
          }
          safeSetBalance({
            tokens:  Number(row.xev_tokens)      || 0,
            points:  Math.floor(Number(row.engagement_points) || 0),
            paywave: Number(row.paywave_balance)   || 0,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, safeSetBalance]);

  // ── Real-time transactions ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const unsub = walletService.subscribeToTransactions(userId, (enrichedTx) => {
      if (enrichedTx.user_id && enrichedTx.user_id !== userId) return;
      setTransactions((prev) => {
        const filtered = prev.filter(
          (tx) =>
            !(tx._optimistic === true &&
              Math.abs((tx.amount || 0) - (enrichedTx.amount || 0)) < 0.001 &&
              tx.displayCurrency === enrichedTx.displayCurrency)
        );
        if (filtered.some((tx) => tx.id === enrichedTx.id)) return filtered;
        return [enrichedTx, ...filtered];
      });
    });
    return () => unsub?.();
  }, [userId]);

  const handleTabChange = (tab) => {
    if (["swap", "trade"].includes(tab)) {
      setWalletNotice("Token swap and trading are hidden to keep Wallet focused on EP.");
      return;
    }
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
      {walletNotice && (
        <div role="status" style={{ margin: "0 20px 10px", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(163,230,53,.22)", background: "rgba(163,230,53,.06)", color: "#a3e635", fontSize: 12, fontWeight: 700 }}>
          {walletNotice}
          <button type="button" onClick={() => setWalletNotice("")} style={{ float: "right", border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}>Dismiss</button>
        </div>
      )}
      {/* shellRef is used by useMobileTop to exclude its own children from measurement */}
      <div className="wv-shell" ref={shellRef}>
        <div className="wv-center">
          <div className="wv-content-pad">
            {activeTab === "overview"  && <OverviewTab  {...sharedProps} loading={loading} />}
            {activeTab === "send"      && <SendTab      {...sharedProps} />}
            {activeTab === "deposit"   && <DepositTab   {...sharedProps} />}
            {activeTab === "receive"   && <ReceiveTab   {...sharedProps} />}
            {/* Swap/trade UI intentionally hidden: Wallet focuses on EP. */}
            {activeTab === "settings"  && <SettingsTab  {...sharedProps} />}
            {activeTab === "withdraw"  && (
              <WithdrawTab
                userId={userId}
                balance={balance}
                currentUser={profile}
                setActiveTab={handleTabChange}
              />
            )}
          </div>
        </div>
        <aside className="wv-sidebar">
          <WalletSidebar balance={balance} />
        </aside>
      </div>
    </CurrencyProvider>
  );
};

export default WalletView;