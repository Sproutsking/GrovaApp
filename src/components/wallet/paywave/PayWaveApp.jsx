// paywave/PayWaveApp.jsx
// ─────────────────────────────────────────────────────────────
// Root orchestrator for PayWave — PURE ₦ NAIRA SYSTEM.
//
// PayWave = closed-loop Naira payment network.
// Source of truth: wallets.paywave_balance column.
//
// NO EP. NO XEV. No token references.
// The only wallet connection: TradeTab P2P (separate wallet tab).
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { Home, Zap, TrendingUp, History, User, ArrowLeft } from "lucide-react";

import HomeTab          from "./tabs/HomeTab";
import ServicesTab      from "./tabs/ServicesTab";
import FinanceTab       from "./tabs/FinanceTab";
import TransactionsTab  from "./tabs/TransactionsTab";
import AccountTab       from "./tabs/AccountTab";
import BillsTab         from "./tabs/BillsTab";
import WalletTab        from "./tabs/WalletTab";
import NotificationsTab from "./tabs/NotificationsTab";
import { SuccessModal } from "./modals/index";
import { supabase } from "../../../services/config/supabase";
import { useAuth } from "../../Auth/AuthContext";

// ── Global CSS (unchanged from before, no EP references in styles) ──
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           #07080a;
    --surface:      rgba(255,255,255,0.03);
    --surface-h:    rgba(255,255,255,0.055);
    --border:       rgba(255,255,255,0.072);
    --lime:         #a3e635;
    --lime-dim:     #84cc16;
    --lime-glow:    rgba(163,230,53,0.13);
    --lime-border:  rgba(163,230,53,0.22);
    --gold:         #d4a847;
    --gold-dim:     rgba(212,168,71,0.15);
    --gold-border:  rgba(212,168,71,0.25);
    --text:         #eef0ee;
    --text-soft:    #7a8a80;
    --text-muted:   #3d4a40;
    --font-d: 'Syne', sans-serif;
    --font-b: 'DM Sans', sans-serif;
    --font-m: 'DM Mono', monospace;
    --r-xs: 8px; --r-sm: 11px; --r: 15px; --r-lg: 20px;
    --nav-h: 66px; --side-w: 70px; --header-h: 50px;
    --pw-pad-left: 4%;
    --pw-pad-right: 4%;
  }

  html, body { height: 100%; }
  body { background: var(--bg); color: var(--text); font-family: var(--font-b); -webkit-font-smoothing: antialiased; }

  .pw-shell {
    position: absolute; inset: 0;
    background: var(--bg);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .pw-shell {
      position: absolute; inset: 0; z-index: auto;
      flex-direction: row; background: #080b09; align-items: stretch;
    }
  }

  .pw-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

  .pw-scroll, .pw-scroll-px {
    flex: 1; width: 100%; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    padding-bottom: 16px;
    scrollbar-width: none;
    padding-left: var(--pw-pad-left);
    padding-right: var(--pw-pad-right);
  }
  .pw-scroll::-webkit-scrollbar, .pw-scroll-px::-webkit-scrollbar { display: none; }

  .glass { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); position: relative; overflow: hidden; }
  .glass::before { content: ''; position: absolute; inset: 0; background: linear-gradient(140deg, rgba(255,255,255,0.03) 0%, transparent 55%); pointer-events: none; border-radius: inherit; }
  .glass.click { cursor: pointer; transition: background .18s, border-color .15s, transform .12s; }
  .glass.click:hover { background: var(--surface-h); border-color: rgba(255,255,255,0.1); }
  .glass.click:active { transform: scale(0.985); }
  .glass-lime { background: linear-gradient(140deg, rgba(163,230,53,0.07) 0%, rgba(132,204,22,0.04) 100%); border-color: var(--lime-border); }
  .glass-gold { background: linear-gradient(140deg, rgba(212,168,71,0.08) 0%, rgba(212,168,71,0.03) 100%); border-color: var(--gold-border); }

  .btn-lime { background: var(--lime); color: #0a0e06; font-family: var(--font-d); font-weight: 700; font-size: 13.5px; letter-spacing: 0.01em; padding: 11px 22px; border-radius: var(--r-sm); border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all .18s; box-shadow: 0 6px 20px rgba(163,230,53,0.22), inset 0 1px 0 rgba(255,255,255,0.18); }
  .btn-lime:hover { background: #b5f015; box-shadow: 0 8px 28px rgba(163,230,53,0.32); transform: translateY(-1px); }
  .btn-lime:active { transform: scale(0.97) translateY(0); }
  .btn-lime:disabled { opacity: 0.28; cursor: not-allowed; transform: none; }
  .btn-lime.full { width: 100%; }
  .btn-lime.sm { padding: 8px 14px; font-size: 12.5px; }
  .btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--text); font-family: var(--font-b); font-weight: 500; font-size: 13.5px; padding: 11px 22px; border-radius: var(--r-sm); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all .18s; }
  .btn-ghost:hover { background: var(--surface-h); border-color: rgba(255,255,255,0.11); }
  .btn-ghost:active { transform: scale(0.97); }

  .pw-header { position: sticky; top: 0; height: var(--header-h); background: rgba(7,8,10,0.88); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border-bottom: 1px solid var(--border); padding: 0 var(--pw-pad-left); display: flex; align-items: center; gap: 10px; z-index: 10; flex-shrink: 0; }
  .pw-back { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
  .pw-back:hover { background: var(--surface-h); border-color: rgba(163,230,53,0.25); }
  .pw-header-title { font-family: var(--font-d); font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }

  .pw-nav { position: sticky; bottom: 0; height: var(--nav-h); background: rgba(7,8,10,0.97); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border-top: 1px solid var(--border); padding: 8px 4px; z-index: 20; flex-shrink: 0; }
  .pw-nav-inner { display: flex; align-items: center; justify-content: space-around; height: 100%; }
  .pw-nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 14px; border-radius: var(--r-sm); border: none; background: transparent; color: var(--text-soft); cursor: pointer; transition: all .18s; font-family: var(--font-b); font-size: 9.5px; font-weight: 500; letter-spacing: 0.03em; }
  .pw-nav-btn:hover { color: rgba(255,255,255,0.55); }
  .pw-nav-btn.active { background: rgba(163,230,53,0.1); border: 1px solid var(--lime-border); color: var(--lime); }
  @media (min-width: 768px) { .pw-nav { display: none; } }

  .pw-sidenav { display: none; }
  @media (min-width: 768px) {
    .pw-sidenav { display: flex; flex-direction: column; width: var(--side-w); flex-shrink: 0; min-height: 0; background: rgba(5,6,7,0.98); border-right: 1px solid var(--border); z-index: 20; padding: 10px 0; overflow: hidden; }
    .pw-side-back { width: 38px; height: 38px; margin: 0 auto 8px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0; }
    .pw-side-back:hover { background: var(--surface-h); border-color: rgba(163,230,53,0.25); color: var(--lime); }
    .pw-side-divider { width: 32px; height: 1px; background: var(--border); margin: 4px auto 8px; }
    .pw-side-items { flex: 1; display: flex; flex-direction: column; }
    .pw-side-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border: none; background: transparent; color: var(--text-soft); cursor: pointer; transition: all .18s; font-family: var(--font-b); font-size: 9px; font-weight: 500; letter-spacing: 0.04em; width: 100%; position: relative; }
    .pw-side-btn::before { content: ''; position: absolute; left: 0; top: 20%; bottom: 20%; width: 2px; border-radius: 0 2px 2px 0; background: transparent; transition: background .18s; }
    .pw-side-btn:hover { color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.02); }
    .pw-side-btn.active { color: var(--lime); background: rgba(163,230,53,0.06); }
    .pw-side-btn.active::before { background: var(--lime); }
    .pw-side-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: background .18s; }
    .pw-side-btn.active .pw-side-icon { background: rgba(163,230,53,0.12); box-shadow: 0 2px 12px rgba(163,230,53,0.12); }
    .pw-side-label { text-align: center; line-height: 1.2; }
  }

  .f-section { padding: 15px var(--pw-pad-left); }
  .f-stack { display: flex; flex-direction: column; gap: 14px; }
  .f-label { font-family: var(--font-b); color: var(--text-soft); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 6px; }
  .f-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 11px 13px; transition: border-color .18s; }
  .f-card:focus-within { border-color: var(--lime-border); }
  .f-input { width: 100%; background: transparent; color: var(--text); border: none; outline: none; font-family: var(--font-b); font-size: 14px; }
  .f-input::placeholder { color: var(--text-muted); }
  .f-input-lg { width: 100%; background: transparent; color: var(--text); border: none; outline: none; font-family: var(--font-d); font-size: 24px; font-weight: 700; }
  .f-input-lg::placeholder { color: var(--text-muted); }

  .amt-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
  .amt-btn { padding: 9px 6px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--border); color: var(--text); font-family: var(--font-b); font-weight: 600; font-size: 12.5px; cursor: pointer; transition: all .15s; text-align: center; }
  .amt-btn.sel { background: rgba(163,230,53,0.12); border-color: var(--lime-border); color: var(--lime); }
  .amt-btn:hover:not(.sel) { background: var(--surface-h); }

  .net-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 7px; }
  .prov-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
  .net-btn { aspect-ratio: 1; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-d); font-weight: 700; font-size: 11.5px; border: 2px solid transparent; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.28); transition: transform .15s; }
  .net-btn:hover { transform: scale(1.04); }
  .net-btn.sel { border-color: var(--lime); box-shadow: 0 0 0 3px rgba(163,230,53,0.15); transform: scale(0.96); }
  .prov-btn { aspect-ratio: 16/9; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-d); font-weight: 700; font-size: 11.5px; border: 2px solid transparent; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.28); transition: transform .15s; }
  .prov-btn:hover { transform: scale(1.04); }
  .prov-btn.sel { border-color: var(--lime); transform: scale(0.96); }

  .plan-btn { width: 100%; padding: 12px 13px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--border); color: var(--text); text-align: left; cursor: pointer; transition: all .15s; }
  .plan-btn.sel { background: rgba(163,230,53,0.09); border-color: var(--lime-border); box-shadow: 0 4px 20px rgba(163,230,53,0.08); }
  .plan-btn:hover:not(.sel) { background: var(--surface-h); }

  .sec-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .sec-title { font-family: var(--font-d); font-size: 13.5px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
  .sec-link { color: var(--lime); font-size: 11.5px; font-weight: 500; background: transparent; border: none; cursor: pointer; transition: opacity .15s; }
  .sec-link:hover { opacity: .7; }

  .tx-row { display: flex; align-items: center; justify-content: space-between; }
  .tx-left { display: flex; align-items: center; gap: 10px; }
  .tx-icon { width: 34px; height: 34px; border-radius: var(--r-xs); display: flex; align-items: center; justify-content: center; background: var(--surface); border: 1px solid var(--border); flex-shrink: 0; }
  .tx-icon.cr { background: rgba(163,230,53,0.12); border-color: var(--lime-border); }
  .tx-title { font-family: var(--font-b); color: var(--text); font-size: 13.5px; font-weight: 500; }
  .tx-date { color: var(--text-soft); font-size: 11.5px; }
  .tx-amt { font-family: var(--font-d); font-weight: 700; font-size: 13.5px; color: var(--text); }
  .tx-amt.cr { color: var(--lime); }
  .tx-status { color: var(--lime); font-size: 9.5px; }

  .info-lime { background: rgba(163,230,53,0.07); border: 1px solid var(--lime-border); border-radius: var(--r); padding: 12px 14px; }
  .info-gold { background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--r); padding: 12px 14px; }
  .c-lime { color: var(--lime); } .c-gold { color: var(--gold); } .c-red { color: #f87171; } .c-muted { color: var(--text-soft); }

  .av { border-radius: 50%; background: linear-gradient(135deg, var(--lime) 0%, #65a30d 100%); display: flex; align-items: center; justify-content: center; color: #0a0e06; font-family: var(--font-d); font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 14px rgba(163,230,53,0.25); }
  .av-sm { width: 34px; height: 34px; font-size: 13px; }
  .av-lg { width: 54px; height: 54px; font-size: 20px; }

  .ic-chip { width: 31px; height: 31px; border-radius: var(--r-xs); background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-soft); position: relative; transition: all .15s; }
  .ic-chip:hover { background: var(--surface-h); border-color: var(--lime-border); }
  .notif-pip { position: absolute; top: -3px; right: -3px; width: 14px; height: 14px; background: var(--lime); border: 1.5px solid var(--bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #0a0e06; }

  .tog { width: 38px; height: 20px; border-radius: 10px; position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0; }
  .tog.on { background: var(--lime); } .tog.off { background: #1c2018; border: 1px solid rgba(255,255,255,0.07); }
  .tog-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; position: absolute; top: 3px; transition: all .2s; }
  .tog.on .tog-thumb { right: 3px; left: auto; background: #0a0e06; } .tog.off .tog-thumb { left: 3px; }

  .copy-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--border); }
  .copy-val { color: var(--text); font-family: var(--font-m); font-size: 14px; }
  .copy-ic { padding: 5px; border-radius: 6px; background: rgba(163,230,53,0.1); border: none; cursor: pointer; display: flex; color: var(--lime); transition: background .15s; }
  .copy-ic:hover { background: rgba(163,230,53,0.18); }

  .bank-sel { width: 100%; background: var(--surface); padding: 11px 13px; border-radius: var(--r-sm); color: var(--text); outline: none; border: 1px solid var(--border); font-size: 14px; font-family: var(--font-b); cursor: pointer; }
  .bank-sel:focus { border-color: var(--lime-border); }
  .bank-sel option { background: #0c0f0a; }

  .g-purple{background:linear-gradient(135deg,#a855f7,#ec4899)} .g-blue{background:linear-gradient(135deg,#3b82f6,#06b6d4)} .g-orange{background:linear-gradient(135deg,#f97316,#ef4444)} .g-yellow{background:linear-gradient(135deg,#eab308,#f97316)} .g-green{background:linear-gradient(135deg,#22c55e,#10b981)} .g-pink{background:linear-gradient(135deg,#ec4899,#f43f5e)} .g-indigo{background:linear-gradient(135deg,#6366f1,#a855f7)} .g-teal{background:linear-gradient(135deg,#14b8a6,#06b6d4)} .g-lime{background:linear-gradient(135deg,#a3e635,#65a30d)} .g-blue2{background:linear-gradient(135deg,#3b82f6,#6366f1)} .g-rose{background:linear-gradient(135deg,#f43f5e,#ec4899)} .g-red2{background:linear-gradient(135deg,#ef4444,#f97316)} .g-inv1{background:linear-gradient(135deg,#a3e635,#65a30d)} .g-inv2{background:linear-gradient(135deg,#3b82f6,#6366f1)} .g-inv3{background:linear-gradient(135deg,#a855f7,#ec4899)} .g-sav1{background:linear-gradient(135deg,#f97316,#ef4444)} .g-sav2{background:linear-gradient(135deg,#6366f1,#a855f7)} .g-sav3{background:linear-gradient(135deg,#ec4899,#f43f5e)}
  .net-mtn{background:linear-gradient(135deg,#eab308,#ca8a04)} .net-glo{background:linear-gradient(135deg,#22c55e,#16a34a)} .net-airtel{background:linear-gradient(135deg,#ef4444,#dc2626)} .net-9mobile{background:linear-gradient(135deg,#10b981,#059669)}
  .prov-dstv{background:linear-gradient(135deg,#ef4444,#dc2626)} .prov-gotv{background:linear-gradient(135deg,#22c55e,#16a34a)} .prov-startimes{background:linear-gradient(135deg,#3b82f6,#2563eb)} .prov-ikeja{background:linear-gradient(135deg,#eab308,#ca8a04)} .prov-eko{background:linear-gradient(135deg,#3b82f6,#2563eb)} .prov-abuja{background:linear-gradient(135deg,#22c55e,#16a34a)} .prov-bet9ja{background:linear-gradient(135deg,#eab308,#ca8a04)} .prov-sportybet{background:linear-gradient(135deg,#22c55e,#16a34a)} .prov-nairabet{background:linear-gradient(135deg,#ef4444,#dc2626)}

  .row{display:flex;align-items:center;gap:8px} .row-sb{display:flex;align-items:center;justify-content:space-between} .col{display:flex;flex-direction:column} .f1{flex:1}
  .space-y > * + * { margin-top: 8px; }
  .mb-2{margin-bottom:8px} .mb-3{margin-bottom:13px} .mb-4{margin-bottom:18px} .mt-3{margin-top:13px}

  .quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px}
  .quick-btn{display:flex;flex-direction:column;align-items:center;gap:6px;background:transparent;border:none;cursor:pointer}
  .quick-icon{width:50px;height:50px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.32);transition:transform .15s}
  .quick-btn:hover .quick-icon{transform:scale(1.07) translateY(-1px)} .quick-btn:active .quick-icon{transform:scale(0.93)}
  .quick-label{color:var(--text-soft);font-size:9.5px;font-weight:500}
  .srv-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .srv-item{display:flex;flex-direction:column;align-items:center;gap:6px;background:transparent;border:none;cursor:pointer}
  .srv-icon{width:50px;height:50px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.32);transition:transform .15s}
  .srv-item:hover .srv-icon{transform:scale(1.07) translateY(-1px)} .srv-item:active .srv-icon{transform:scale(0.93)}
  .srv-label{color:var(--text-soft);font-size:9.5px;font-weight:500;text-align:center;line-height:1.3}
`;

const MAIN_TABS    = new Set(["home", "services", "finance", "transactions", "account"]);
const BILLS_VIEWS  = new Set(["airtime", "data", "tv", "electricity", "betting", "giftcards", "bills", "services"]);
const WALLET_VIEWS = new Set(["send", "receive", "invest", "save", "cards"]);

const BACK_MAP = {
  airtime: "home", data: "home", tv: "services",
  electricity: "home", betting: "services",
  giftcards: "services", bills: "services",
  loans: "finance", send: "home", receive: "home",
  invest: "finance", save: "finance", cards: "finance",
  notifications: "home", transactions: "home",
};

const NAV_TABS = [
  { id: "home",         label: "Home",    icon: Home       },
  { id: "services",     label: "Services",icon: Zap        },
  { id: "finance",      label: "Finance", icon: TrendingUp },
  { id: "transactions", label: "History", icon: History    },
  { id: "account",      label: "Account", icon: User       },
];

export default function PayWaveApp({ onBack, userId }) {
  const { profile } = useAuth();
  const [page, setPage]               = useState("home");
  const [showBalance, setShowBalance] = useState(true);
  const [successMsg, setSuccessMsg]   = useState(null);

  // ── PayWave Naira balance — fetched from wallets.paywave_balance ──
  const [pwBalance, setPwBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("wallets")
        .select("paywave_balance")
        .eq("user_id", profile.id)
        .maybeSingle();
      setPwBalance(data?.paywave_balance ?? 0);
    } catch (err) {
      console.error("PayWave balance fetch:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Real-time balance updates
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`pw_bal:${profile.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "wallets",
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        if (payload.new?.paywave_balance != null) {
          setPwBalance(payload.new.paywave_balance);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.id]);

  // PayWave notifications state — used to pass into NotificationsTab
  // The unread count displayed on the bell is fetched directly from DB in HomeTab.
  // This array is kept as a local cache for the NotificationsTab display.
  const [notifications, setNotifications] = useState([]);

  const goBack = () => {
    const dest = BACK_MAP[page];
    if (dest)            { setPage(dest); return; }
    if (page === "home") { onBack?.(); return; }
    setPage("home");
  };

  const handleSuccess = (msg) => setSuccessMsg(msg);
  const clearSuccess  = () => { setSuccessMsg(null); setPage("home"); };

  const isMainTab   = MAIN_TABS.has(page);
  const activeNavId = isMainTab ? page : (BACK_MAP[page] ?? "home");

  const renderPage = () => {
    // All tabs receive pwBalance — the PayWave Naira balance.
    // No EP or XEV props exist in PayWave components.
    if (page === "home")
      return (
        <HomeTab
          pwBalance={pwBalance}
          showBalance={showBalance}
          setShowBalance={setShowBalance}
          notifications={notifications}
          setPage={setPage}
          onBack={onBack}
          onRefresh={fetchBalance}
        />
      );
    if (page === "services")
      return <ServicesTab setPage={setPage} />;
    if (page === "finance")
      return <FinanceTab pwBalance={pwBalance} setPage={setPage} />;
    if (page === "transactions")
      return <TransactionsTab setPage={setPage} userId={profile?.id} onRefresh={fetchBalance} />;
    if (page === "account")
      return <AccountTab setPage={setPage} onSuccess={handleSuccess} />;
    if (BILLS_VIEWS.has(page))
      return <BillsTab view={page} onBack={goBack} onSuccess={handleSuccess} setPage={setPage} />;
    if (WALLET_VIEWS.has(page))
      return <WalletTab view={page} pwBalance={pwBalance} onBack={goBack} onSuccess={handleSuccess} userId={profile?.id} onRefresh={fetchBalance} />;
    if (page === "notifications")
      return <NotificationsTab notifications={notifications} setNotifications={setNotifications} onBack={goBack} />;

    // Fallback — coming soon
    return (
      <div className="pw-scroll" style={{ display:"flex", flexDirection:"column" }}>
        <div style={{ padding:`0 var(--pw-pad-left)`, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10, height:50, flexShrink:0 }}>
          <button className="pw-back" onClick={goBack}><ArrowLeft size={14} /></button>
          <span style={{ fontFamily:"var(--font-d)", fontSize:15, fontWeight:700 }}>
            {page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g," ")}
          </span>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:13, padding:30 }}>
          <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(163,230,53,0.1)", border:"1px solid var(--lime-border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Zap size={26} color="var(--lime)" />
          </div>
          <div style={{ fontFamily:"var(--font-d)", fontSize:16, fontWeight:700 }}>Coming Soon</div>
          <div style={{ color:"var(--text-soft)", fontSize:13, textAlign:"center" }}>This feature is under development</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div className="pw-shell">
        <nav className="pw-sidenav">
          <button className="pw-side-back" onClick={onBack} title="Back to Wallet">
            <ArrowLeft size={15} />
          </button>
          <div className="pw-side-divider" style={{ background: "rgba(212,168,71,0.25)" }} />
          <div className="pw-side-items">
            {NAV_TABS.map(tab => (
              <button key={tab.id} className={`pw-side-btn ${activeNavId === tab.id ? "active" : ""}`} onClick={() => setPage(tab.id)} title={tab.label}>
                <div className="pw-side-icon"><tab.icon size={18} /></div>
                <span className="pw-side-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="pw-content">
          {renderPage()}
          {isMainTab && (
            <nav className="pw-nav">
              <div className="pw-nav-inner">
                {NAV_TABS.map(tab => (
                  <button key={tab.id} className={`pw-nav-btn ${page === tab.id ? "active" : ""}`} onClick={() => setPage(tab.id)}>
                    <tab.icon size={19} /><span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>
        {successMsg && <SuccessModal message={successMsg} onClose={clearSuccess} />}
      </div>
    </>
  );
}