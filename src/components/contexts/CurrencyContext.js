// src/contexts/CurrencyContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────
   SUPPORTED CURRENCIES
   symbol   — short prefix shown in UI
   name     — full label
   rate     — XEV → fiat rate (update from your price feed)
   locales  — Intl locale strings used for auto-detection
   regions  — ISO 3166-1 alpha-2 country codes for Intl detection
───────────────────────────────────────────────────────────── */
export const CURRENCIES = [
  { code: "NGN", symbol: "₦",  name: "Nigerian Naira",      rate: 2500,    flag: "🇳🇬", regions: ["NG"] },
  { code: "USD", symbol: "$",  name: "US Dollar",           rate: 1.55,    flag: "🇺🇸", regions: ["US"] },
  { code: "GBP", symbol: "£",  name: "British Pound",       rate: 1.22,    flag: "🇬🇧", regions: ["GB"] },
  { code: "EUR", symbol: "€",  name: "Euro",                rate: 1.42,    flag: "🇪🇺", regions: ["DE","FR","IT","ES","NL","PT","BE","AT","FI","IE"] },
  { code: "GHS", symbol: "₵",  name: "Ghanaian Cedi",       rate: 22.5,    flag: "🇬🇭", regions: ["GH"] },
  { code: "KES", symbol: "KSh",name: "Kenyan Shilling",     rate: 200,     flag: "🇰🇪", regions: ["KE"] },
  { code: "ZAR", symbol: "R",  name: "South African Rand",  rate: 28.5,    flag: "🇿🇦", regions: ["ZA"] },
  { code: "CAD", symbol: "CA$",name: "Canadian Dollar",     rate: 2.12,    flag: "🇨🇦", regions: ["CA"] },
  { code: "AUD", symbol: "A$", name: "Australian Dollar",   rate: 2.38,    flag: "🇦🇺", regions: ["AU"] },
  { code: "INR", symbol: "₹",  name: "Indian Rupee",        rate: 129,     flag: "🇮🇳", regions: ["IN"] },
];

const STORAGE_KEY = "xeevia_currency";
const DEFAULT     = "NGN";

/* ── detect region via Intl ── */
function detectRegion() {
  try {
    const tz       = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const locale   = navigator.language || navigator.languages?.[0] || "";
    const region   = locale.split("-")[1]?.toUpperCase() || "";

    // match region code against currencies
    for (const c of CURRENCIES) {
      if (c.regions.includes(region)) return c.code;
    }

    // fallback: try timezone-based guess
    if (tz.startsWith("Africa/Lagos") || tz.startsWith("Africa/Abuja")) return "NGN";
    if (tz.startsWith("America/"))    return "USD";
    if (tz.startsWith("Europe/London")) return "GBP";
    if (tz.startsWith("Europe/"))    return "EUR";
    if (tz.startsWith("Africa/Accra")) return "GHS";
    if (tz.startsWith("Africa/Nairobi")) return "KES";
    if (tz.startsWith("Africa/Johannesburg")) return "ZAR";
    if (tz.startsWith("Australia/")) return "AUD";
    if (tz.startsWith("Asia/Kolkata")) return "INR";
  } catch {}
  return DEFAULT;
}

/* ── format number compactly ── */
export function compactFiat(amount, currency) {
  const c = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const v = amount * c.rate;
  if (v >= 1_000_000) return `${c.symbol}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${c.symbol}${(v / 1_000).toFixed(1)}K`;
  return `${c.symbol}${v.toLocaleString("en", { maximumFractionDigits: 0 })}`;
}

export function fullFiat(amount, currency) {
  const c = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const v = amount * c.rate;
  return `${c.symbol}${v.toLocaleString("en", { maximumFractionDigits: 0 })}`;
}

/* ─────────────────────────────────────────────────────────────
   CONTEXT
───────────────────────────────────────────────────────────── */
const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, _setCurrency] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CURRENCIES.find(c => c.code === saved)) return saved;
    } catch {}
    return detectRegion();
  });

  const setCurrency = useCallback((code) => {
    _setCurrency(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  const getCurrencyObj = useCallback(
    () => CURRENCIES.find(c => c.code === currency) || CURRENCIES[0],
    [currency]
  );

  const format = useCallback(
    (xevAmount, compact = true) =>
      compact ? compactFiat(xevAmount, currency) : fullFiat(xevAmount, currency),
    [currency]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, getCurrencyObj, CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be inside <CurrencyProvider>");
  return ctx;
}

export default CurrencyContext;