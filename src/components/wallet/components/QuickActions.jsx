// src/components/wallet/components/QuickActions.jsx
// ─────────────────────────────────────────────────────────────
// Pay Wave button is region-locked — only rendered for users
// in Nigeria or OPay-supported regions.
//
// Detection order:
//   1. profile.region field  (e.g. "NG", "nigeria")
//   2. phone prefix          (+234 or 070/080/090 local format)
//   3. Browser timezone      (Africa/Lagos fallback)
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Repeat,
  Settings,
  TrendingUp,
  Wifi,
} from "lucide-react";
import { useAuth } from "../../Auth/AuthContext";

// Regions where OPay/PayWave operates
const OPAY_REGIONS = ["NG", "nigeria", "ng"];

function isPayWaveRegion(profile) {
  // 1. Check explicit region field on profile
  if (profile?.region) {
    return OPAY_REGIONS.some(r => profile.region.toLowerCase().includes(r));
  }

  // 2. Check phone number prefix — +234 is Nigeria
  if (profile?.phone) {
    const clean = profile.phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
    if (clean.startsWith("+234") || clean.startsWith("234")) return true;
    // Local Nigerian format — 070, 080, 090, 081, 091
    if (/^0[789][01]/.test(clean)) return true;
  }

  // 3. Check locale / timezone as fallback
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.toLowerCase().includes("lagos") || tz.toLowerCase().includes("africa")) return true;
  } catch {}

  return false;
}

const QuickActions = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const showPayWave = useMemo(() => isPayWaveRegion(profile), [profile]);

  const primaryActions = [
    { icon: ArrowUpRight,  label: "Send",    tab: "send"    },
    { icon: Download,      label: "Deposit", tab: "deposit" },
    { icon: ArrowDownLeft, label: "Receive", tab: "receive" },
  ];

  const secondaryActions = [
    { icon: Repeat,     label: "Swap",     tab: "swap"  },
    { icon: TrendingUp, label: "Trade",    tab: "trade" },
    ...(showPayWave ? [{ icon: Wifi, label: "Pay Wave", tab: "paywave" }] : []),
    { icon: Settings,   label: "Settings", tab: "settings" },
  ];

  return (
    <div className="quick-actions">
      {primaryActions.map(({ icon: Icon, label, tab }) => (
        <button
          key={tab}
          className="quick-action-btn primary"
          onClick={() => setActiveTab(tab)}
        >
          <div className="button-icon">
            <Icon size={20} />
          </div>
          <span>{label}</span>
        </button>
      ))}

      {secondaryActions.map(({ icon: Icon, label, tab }) => (
        <button
          key={tab}
          className={`quick-action-btn ${tab === "paywave" ? "paywave" : "secondary"}`}
          onClick={() => setActiveTab(tab)}
        >
          <div className="button-icon">
            <Icon size={20} />
          </div>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;