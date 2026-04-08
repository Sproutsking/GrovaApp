// src/constants/rates.js
// ════════════════════════════════════════════════════════════════
// XEEVIA CANONICAL EXCHANGE RATES — single source of truth
// Import from here in ALL UI components.
// ════════════════════════════════════════════════════════════════

export const EP_PER_USD  = 100;    // 1 USD  = 100 EP
export const EP_PER_XEV  = 10;     // 1 $XEV = 10 EP
export const USD_PER_XEV = 0.10;   // 1 $XEV = $0.10 USD

// ── Conversion helpers ────────────────────────────────────────────
export const toUsd = {
  fromEp:  (ep)  => ep  / EP_PER_USD,          // 100 EP  → $1.00
  fromXev: (xev) => xev * USD_PER_XEV,         //   1 XEV → $0.10
};

export const toEp = {
  fromUsd: (usd) => usd * EP_PER_USD,           //   $1    → 100 EP
  fromXev: (xev) => xev * EP_PER_XEV,           //   1 XEV → 10 EP
};

export const toXev = {
  fromEp:  (ep)  => ep  / EP_PER_XEV,           //  10 EP  → 1 XEV
  fromUsd: (usd) => usd / USD_PER_XEV,          //  $0.10  → 1 XEV
};

// ── UI display formatters ─────────────────────────────────────────
export function formatUsd(value, decimals = 2) {
  return `$${parseFloat(value).toFixed(decimals)}`;
}

export function formatEP(value, decimals = 2) {
  return parseFloat(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatXEV(value, decimals = 4) {
  return parseFloat(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/*
 * ════════════════════════════════════════════════════════════════
 * UI FIX GUIDE — what to change in wallet components
 * ════════════════════════════════════════════════════════════════
 *
 * PROBLEM SEEN IN SCREENSHOT:
 *   • Balance card top     → shows "0 $XEV  EP 407"  ✓ counts are right
 *   • "≈ $8 USD" line      → WRONG  (was using XEV_TO_NGN = 2.5 multiplier)
 *   • EP Balance stat row  → shows "407"  but assets row shows "245.4969"
 *     → Two different wallet fields were being read (profiles.engagement_points
 *       vs wallets.engagement_points). Always read from `wallets` table only.
 *
 * ROOT CAUSES:
 *   1. Old files had XEV_TO_NGN = 2.5 used as the USD rate — WRONG.
 *      The USD display value of XEV is: xev * 0.10  (not xev * 2.5)
 *   2. EP was displayed from two sources that had drifted apart.
 *   3. No authoritative swap rate existed — swap UI could use any number.
 *
 * FIXES TO APPLY IN YOUR WALLET COMPONENT:
 *
 *   // ✗ OLD (wrong)
 *   const usdValue = xevBalance * 2.5;
 *   const epDisplay = profile.engagement_points;
 *
 *   // ✓ NEW (correct)
 *   import { toUsd } from "@/constants/rates";
 *   const usdValue  = toUsd.fromXev(wallet.grova_tokens);   // xev * 0.10
 *   const epDisplay = wallet.engagement_points;              // always from wallets table
 *
 * SWAP UI:
 *   // Swap preview: entering 10 EP → show 1 XEV
 *   import { toXev, toEp, EP_PER_XEV } from "@/constants/rates";
 *   const xevOut = toXev.fromEp(epInput);    // 10 → 1
 *   const epOut  = toEp.fromXev(xevInput);   // 1  → 10
 *
 * STAT ROW ("EP BALANCE"):
 *   Display wallet.engagement_points directly.
 *   Show USD equivalent as: toUsd.fromEp(wallet.engagement_points)
 *   Show XEV equivalent as: toXev.fromEp(wallet.engagement_points)
 *
 * DEPOSIT MINTING:
 *   NGN  deposit: 1 EP per ₦1    (not changed — NGN peg stays 1:1)
 *   USD  deposit: 100 EP per $1
 *   XEV  deposit: 10 EP per XEV
 *
 * ════════════════════════════════════════════════════════════════
 */