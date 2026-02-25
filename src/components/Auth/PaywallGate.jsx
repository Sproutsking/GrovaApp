// ============================================================================
// src/components/Auth/PaywallGate.jsx — v14 METAMASK HARDENED
// ============================================================================
//
// CHANGES FROM v13:
//   • WalletConnector.connect() now catches MetaMask-specific error codes:
//       - code 4001 = user rejected → friendly message, not a crash
//       - code -32002 = already pending → tell user to check MetaMask
//       - All other MetaMask errors → surfaced cleanly without escaping
//   • EVM connect wrapped in its own nested try/catch so secondary async
//     errors from the extension don't escape into React's error boundary.
//   • Wallet detect() no longer auto-connects on render — only on click.
//   • No other logic changes — all payment/chain/UI code is identical to v13.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { usePayment } from "../../hooks/usePayment";
import { isPaidProfile } from "../../services/auth/paymentGate";
import {
  fetchPaymentProducts,
  fetchInviteCodeDetails,
  clearIdempotencyKey,
} from "../../services/auth/paymentService";

// ── Chain registry ────────────────────────────────────────────────────────────

const CHAINS = [
  {
    id: "polygon",
    ecosystem: "EVM",
    label: "Polygon",
    emoji: "💜",
    fee: "~$0.01",
    group: "EVM Compatible",
  },
  {
    id: "base",
    ecosystem: "EVM",
    label: "Base",
    emoji: "🔵",
    fee: "~$0.01",
    group: "EVM Compatible",
  },
  {
    id: "arbitrum",
    ecosystem: "EVM",
    label: "Arbitrum",
    emoji: "🔷",
    fee: "~$0.02",
    group: "EVM Compatible",
  },
  {
    id: "ethereum",
    ecosystem: "EVM",
    label: "Ethereum",
    emoji: "⬡",
    fee: "~$2–5",
    group: "EVM Compatible",
  },
  {
    id: "bnb",
    ecosystem: "EVM",
    label: "BNB Chain",
    emoji: "🟡",
    fee: "~$0.05",
    group: "EVM Compatible",
  },
  {
    id: "avalanche",
    ecosystem: "EVM",
    label: "Avalanche",
    emoji: "🔺",
    fee: "~$0.05",
    group: "EVM Compatible",
  },
  {
    id: "optimism",
    ecosystem: "EVM",
    label: "Optimism",
    emoji: "🔴",
    fee: "~$0.01",
    group: "EVM Compatible",
  },
  {
    id: "solana",
    ecosystem: "SOLANA",
    label: "Solana",
    emoji: "◎",
    fee: "~$0.001",
    group: "Solana",
  },
  {
    id: "cardano",
    ecosystem: "CARDANO",
    label: "Cardano",
    emoji: "₳",
    fee: "~$0.17",
    group: "Cardano",
  },
];

const TREASURY = {
  EVM: process.env.REACT_APP_TREASURY_WALLET ?? "",
  SOLANA: process.env.REACT_APP_TREASURY_WALLET_SOL ?? "",
  CARDANO: process.env.REACT_APP_TREASURY_WALLET_ADA ?? "",
};

const TOKENS = {
  EVM: "USDT or USDC",
  SOLANA: "USDC (SPL)",
  CARDANO: "USDC (native asset)",
};

const WALLET_EXTENSIONS = {
  EVM: [
    {
      id: "metamask",
      label: "MetaMask",
      icon: "🦊",
      detect: () => {
        try {
          return !!window.ethereum?.isMetaMask;
        } catch {
          return false;
        }
      },
    },
    {
      id: "coinbase",
      label: "Coinbase",
      icon: "🔵",
      detect: () => {
        try {
          return !!window.ethereum?.isCoinbaseWallet;
        } catch {
          return false;
        }
      },
    },
    {
      id: "trustwallet",
      label: "Trust",
      icon: "🛡️",
      detect: () => {
        try {
          return !!window.ethereum?.isTrust;
        } catch {
          return false;
        }
      },
    },
  ],
  SOLANA: [
    {
      id: "phantom",
      label: "Phantom",
      icon: "👻",
      detect: () => {
        try {
          return !!(window.phantom?.solana ?? window.solana?.isPhantom);
        } catch {
          return false;
        }
      },
    },
    {
      id: "solflare",
      label: "Solflare",
      icon: "☀️",
      detect: () => {
        try {
          return !!window.solflare?.isSolflare;
        } catch {
          return false;
        }
      },
    },
  ],
  CARDANO: [
    {
      id: "eternl",
      label: "Eternl",
      icon: "∞",
      detect: () => {
        try {
          return !!window.cardano?.eternl;
        } catch {
          return false;
        }
      },
    },
    {
      id: "nami",
      label: "Nami",
      icon: "🌊",
      detect: () => {
        try {
          return !!window.cardano?.nami;
        } catch {
          return false;
        }
      },
    },
    {
      id: "flint",
      label: "Flint",
      icon: "🔥",
      detect: () => {
        try {
          return !!window.cardano?.flint;
        } catch {
          return false;
        }
      },
    },
  ],
};

const ANIM = `
  @keyframes xvSpin  { to { transform: rotate(360deg); } }
  @keyframes xvUp    { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
  @keyframes xvSlide { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
  @keyframes xvPulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }
`;

// ── Atoms ─────────────────────────────────────────────────────────────────────

const Spin = ({ s = 18 }) => (
  <div
    style={{
      width: s,
      height: s,
      border: "2px solid rgba(132,204,22,.1)",
      borderTop: "2px solid #84cc16",
      borderRadius: "50%",
      animation: "xvSpin .6s linear infinite",
      flexShrink: 0,
    }}
  />
);

const PrimaryBtn = ({ onClick, disabled, busy, children }) => (
  <button
    onClick={onClick}
    disabled={disabled || busy}
    style={{
      width: "100%",
      padding: "12px",
      borderRadius: 11,
      border: "none",
      background:
        disabled || busy
          ? "rgba(255,255,255,.04)"
          : "linear-gradient(135deg,#a3e635,#5c9b0a)",
      color: disabled || busy ? "#252525" : "#071200",
      fontWeight: 800,
      fontSize: 13,
      cursor: disabled || busy ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow:
        !disabled && !busy ? "0 3px 18px rgba(132,204,22,.18)" : "none",
      transition: "all .14s",
    }}
  >
    {busy && <Spin s={15} />}
    {children}
  </button>
);

const GhostBtn = ({ onClick, disabled, children, accent = "#84cc16" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%",
      padding: "10px",
      borderRadius: 10,
      border: `1px solid ${accent}33`,
      background: "transparent",
      color: accent,
      fontWeight: 700,
      fontSize: 12,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      transition: "all .13s",
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </button>
);

const ErrBox = ({ msg }) => (
  <div
    style={{
      background: "rgba(239,68,68,.07)",
      border: "1px solid rgba(239,68,68,.18)",
      borderRadius: 9,
      color: "#fca5a5",
      fontSize: 12,
      padding: "9px 11px",
      display: "flex",
      gap: 7,
      lineHeight: 1.55,
      animation: "xvUp .3s ease",
    }}
  >
    <span>⚠️</span>
    <span>{msg}</span>
  </div>
);

const InfoBox = ({ children, accent = "#84cc16" }) => (
  <div
    style={{
      background: `${accent}08`,
      border: `1px solid ${accent}18`,
      borderRadius: 9,
      color: "#3a3a3a",
      fontSize: 11,
      padding: "9px 11px",
      lineHeight: 1.65,
    }}
  >
    {children}
  </div>
);

// ── Price Card ────────────────────────────────────────────────────────────────

function PriceCard({ effectivePrice, inviteDetails, loading }) {
  const isInvite = !!inviteDetails;
  const tierLabel = isInvite
    ? inviteDetails.tier === "whitelist"
      ? "Whitelist"
      : inviteDetails.tier === "vip"
        ? "VIP"
        : "Early Access"
    : "Standard";
  const accent = isInvite
    ? inviteDetails.tier === "whitelist"
      ? "#84cc16"
      : inviteDetails.tier === "vip"
        ? "#f59e0b"
        : "#60a5fa"
    : "#60a5fa";

  if (loading) {
    return (
      <div
        style={{
          background: `${accent}07`,
          border: `1px solid ${accent}14`,
          borderRadius: 12,
          padding: "14px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Spin s={20} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: `${accent}07`,
        border: `1px solid ${accent}14`,
        borderRadius: 12,
        padding: "10px 14px 9px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: accent,
            background: `${accent}18`,
            border: `1px solid ${accent}28`,
            borderRadius: 20,
            padding: "2px 9px",
          }}
        >
          {isInvite ? `✦ ${tierLabel}` : "Public"}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: accent,
            letterSpacing: "-1.5px",
            lineHeight: 1,
          }}
        >
          $
          {typeof effectivePrice === "number"
            ? effectivePrice.toFixed(0)
            : effectivePrice}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#3a3a3a",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {isInvite
          ? `${tierLabel} Access — Invite Price`
          : "Standard Access · One-time"}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 7,
          padding: "4px 9px",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>
          300 EP
        </span>
        <span
          style={{ width: 1, height: 10, background: "rgba(255,255,255,.08)" }}
        />
        <span style={{ fontSize: 10, color: "#2a2a2a" }}>
          100 EP per dollar spent
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <div style={{ fontSize: 10, color: "#1e1e1e" }}>
          {isInvite ? "Exclusive invite · One-time" : "Full access · One-time"}
        </div>
        {isInvite && inviteDetails.is_full && inviteDetails.enable_waitlist && (
          <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>
            ⚠️ Waitlist Active
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 5,
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 10,
        padding: 3,
      }}
    >
      {[
        { id: "paystack", label: "🏦  Card / Bank" },
        { id: "web3", label: "🪙  Crypto" },
      ].map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            flex: 1,
            padding: "8px 5px",
            borderRadius: 8,
            border: "none",
            background: active === id ? "rgba(132,204,22,.09)" : "transparent",
            color: active === id ? "#84cc16" : "#282828",
            fontWeight: 700,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow:
              active === id ? "inset 0 0 0 1px rgba(132,204,22,.2)" : "none",
            transition: "all .13s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Chain dropdown ────────────────────────────────────────────────────────────

function ChainDropdown({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groups = CHAINS.reduce((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.1)",
          background: "rgba(255,255,255,.03)",
          color: "#e8e8e8",
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>
          {selected.emoji} {selected.label}{" "}
          <span style={{ color: "#2a2a2a", fontSize: 11, fontWeight: 400 }}>
            ({selected.fee})
          </span>
        </span>
        <span style={{ color: "#2a2a2a", fontSize: 11 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#0e1208",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,.6)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {Object.entries(groups).map(([group, chains]) => (
            <div key={group}>
              <div
                style={{
                  padding: "7px 12px 4px",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "#2a2a2a",
                  borderBottom: "1px solid rgba(255,255,255,.05)",
                }}
              >
                {group}
              </div>
              {chains.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "none",
                    background:
                      selected.id === c.id
                        ? "rgba(132,204,22,.08)"
                        : "transparent",
                    color: selected.id === c.id ? "#84cc16" : "#ccc",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                    borderLeft:
                      selected.id === c.id
                        ? "2px solid #84cc16"
                        : "2px solid transparent",
                    transition: "all .1s",
                  }}
                >
                  <span>
                    {c.emoji} {c.label}
                  </span>
                  <span style={{ fontSize: 10, color: "#2a2a2a" }}>
                    {c.fee}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wallet connector ──────────────────────────────────────────────────────────
// v14: Each ecosystem's connect() is wrapped in its own nested try/catch.
// MetaMask error codes are handled explicitly so they never escape to React.

function WalletConnector({ ecosystem, onAddressDetected }) {
  const wallets = WALLET_EXTENSIONS[ecosystem] ?? [];
  const [connecting, setConnecting] = useState(null);
  const [connErr, setConnErr] = useState("");

  useEffect(() => {
    setConnErr("");
    setConnecting(null);
  }, [ecosystem]);

  const connect = async (wallet) => {
    setConnecting(wallet.id);
    setConnErr("");
    try {
      let address = "";

      // ── EVM (MetaMask, Coinbase, Trust) ───────────────────────────────────
      if (ecosystem === "EVM") {
        if (!window.ethereum) {
          throw new Error(
            `${wallet.label} not installed. Install the browser extension and refresh.`,
          );
        }
        // Nested try/catch: MetaMask fires secondary async errors that can
        // escape the outer try/catch. This catches them before they reach React.
        try {
          const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          });
          address = accounts?.[0] ?? "";
        } catch (metamaskErr) {
          // Handle MetaMask-specific error codes gracefully
          const code = metamaskErr?.code;
          if (code === 4001) {
            throw new Error(
              "Connection rejected. Please approve the request in your wallet.",
            );
          } else if (code === -32002) {
            throw new Error(
              "A connection request is already pending. Open MetaMask and approve it.",
            );
          } else if (code === -32603) {
            throw new Error(
              "Wallet internal error. Try refreshing the page and connecting again.",
            );
          } else {
            throw new Error(
              `${wallet.label} error: ${metamaskErr?.message ?? "Connection failed. Try again."}`,
            );
          }
        }
      }

      // ── Solana (Phantom, Solflare) ─────────────────────────────────────────
      if (ecosystem === "SOLANA") {
        let provider = null;
        if (wallet.id === "phantom") {
          provider =
            window.phantom?.solana ??
            (window.solana?.isPhantom ? window.solana : null);
        }
        if (wallet.id === "solflare") {
          provider = window.solflare?.isSolflare ? window.solflare : null;
        }
        if (!provider) {
          throw new Error(
            `${wallet.label} not installed. Install the browser extension and refresh.`,
          );
        }
        try {
          await provider.connect();
          address = provider.publicKey?.toString() ?? "";
        } catch (solErr) {
          // code 4001 = user rejected in Phantom too
          if (solErr?.code === 4001) {
            throw new Error(
              "Connection rejected. Please approve in your wallet.",
            );
          }
          throw new Error(
            `${wallet.label}: ${solErr?.message ?? "Connection failed."}`,
          );
        }
      }

      // ── Cardano (Eternl, Nami, Flint) ─────────────────────────────────────
      if (ecosystem === "CARDANO") {
        let cardanoWallet = null;
        try {
          cardanoWallet = window.cardano?.[wallet.id];
        } catch {
          // window.cardano access can throw in some browsers
        }
        if (!cardanoWallet) {
          throw new Error(
            `${wallet.label} not installed. Install the browser extension and refresh.`,
          );
        }
        try {
          const api = await cardanoWallet.enable();
          const addrs = await api.getUsedAddresses();
          address = addrs?.[0] ?? "";
        } catch (cardanoErr) {
          throw new Error(
            `${wallet.label}: ${cardanoErr?.message ?? "Connection failed."}`,
          );
        }
      }

      if (!address) {
        throw new Error("No address returned. Try entering it manually below.");
      }
      onAddressDetected(address);
    } catch (e) {
      // All errors from all ecosystems land here — display cleanly
      setConnErr(e?.message ?? "Wallet connection failed. Try again.");
    } finally {
      setConnecting(null);
    }
  };

  if (!wallets.length) return null;

  return (
    <div>
      <div
        style={{
          color: "#252525",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Connect wallet (auto-fills address)
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {wallets.map((w) => {
          // Safe detect — won't throw even if extension is broken
          let detected = false;
          try {
            detected = w.detect();
          } catch {
            detected = false;
          }

          return (
            <button
              key={w.id}
              onClick={() => connect(w)}
              disabled={!!connecting}
              title={
                !detected ? `${w.label} not detected` : `Connect ${w.label}`
              }
              style={{
                flex: 1,
                minWidth: 80,
                padding: "8px 10px",
                borderRadius: 9,
                border: `1px solid ${detected ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)"}`,
                background: detected
                  ? "rgba(255,255,255,.02)"
                  : "rgba(255,255,255,.01)",
                color:
                  connecting === w.id ? "#84cc16" : detected ? "#aaa" : "#333",
                fontFamily: "inherit",
                cursor: connecting ? "wait" : detected ? "pointer" : "default",
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                opacity: detected ? 1 : 0.4,
                transition: "all .15s",
              }}
            >
              {connecting === w.id ? <Spin s={13} /> : <span>{w.icon}</span>}
              {w.label}
              {!detected && (
                <span style={{ fontSize: 8, color: "#333" }}>↗</span>
              )}
            </button>
          );
        })}
      </div>
      {connErr && (
        <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 6 }}>
          ⚠️ {connErr}
        </div>
      )}
    </div>
  );
}

// ── Address / Tx validation ───────────────────────────────────────────────────

function validateInputs(ecosystem, wallet, txHash) {
  switch (ecosystem) {
    case "EVM":
      return {
        walletOk: /^0x[0-9a-fA-F]{40}$/.test(wallet),
        txOk: /^0x[0-9a-fA-F]{64}$/.test(txHash),
        walletPh: "0x… wallet address (42 chars)",
        txPh: "0x… transaction hash (66 chars)",
      };
    case "SOLANA":
      return {
        walletOk: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet),
        txOk: /^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(txHash),
        walletPh: "Solana wallet address",
        txPh: "Solana transaction signature",
      };
    case "CARDANO":
      return {
        walletOk: wallet.startsWith("addr1") && wallet.length > 50,
        txOk: txHash.length === 64 && /^[0-9a-fA-F]+$/.test(txHash),
        walletPh: "addr1… Cardano address",
        txPh: "Cardano transaction hash (64 hex chars)",
      };
    default:
      return {
        walletOk: false,
        txOk: false,
        walletPh: "Wallet address",
        txPh: "Transaction hash",
      };
  }
}

// ── Web3 panel ────────────────────────────────────────────────────────────────

function Web3Panel({ product, onVerify, loading, error, reset }) {
  const [chain, setChain] = useState(CHAINS[0]);
  const [wallet, setWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);

  const treasury = TREASURY[chain.ecosystem] ?? "";
  const { walletOk, txOk, walletPh, txPh } = validateInputs(
    chain.ecosystem,
    wallet,
    txHash,
  );
  const canSubmit = walletOk && txOk;
  const treasuryMissing = !treasury;

  const copy = () => {
    if (!treasury) return;
    navigator.clipboard.writeText(treasury).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleChainChange = (c) => {
    if (c.ecosystem !== chain.ecosystem) {
      setWallet("");
      setTxHash("");
      reset();
    }
    setChain(c);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div>
        <div
          style={{
            color: "#252525",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Select blockchain network
        </div>
        <ChainDropdown selected={chain} onChange={handleChainChange} />
      </div>

      <div
        style={{
          background: "rgba(0,0,0,.28)",
          border: "1px solid rgba(132,204,22,.1)",
          borderRadius: 10,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            color: "#2a2a2a",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 1 — Send exactly ${product?.amount_usd ?? "—"}{" "}
          {TOKENS[chain.ecosystem]} to:
        </div>
        {treasuryMissing ? (
          <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>
            ⚠️ Treasury wallet not configured for {chain.label}. Add
            REACT_APP_TREASURY_WALLET
            {chain.ecosystem !== "EVM" ? `_${chain.ecosystem}` : ""} to your
            .env
          </div>
        ) : (
          <div
            onClick={copy}
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              color: "#84cc16",
              wordBreak: "break-all",
              cursor: "pointer",
              background: "rgba(132,204,22,.04)",
              border: "1px solid rgba(132,204,22,.09)",
              borderRadius: 7,
              padding: "7px 9px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>{treasury}</span>
            <span style={{ flexShrink: 0, fontSize: 14 }}>
              {copied ? "✓" : "⎘"}
            </span>
          </div>
        )}
      </div>

      <InfoBox accent="#f87171">
        <strong style={{ color: "#fca5a5" }}>🔒 Anti-fraud: </strong>
        Your wallet address is verified on-chain. Someone copying your hash
        cannot claim your payment.
      </InfoBox>

      <WalletConnector
        ecosystem={chain.ecosystem}
        onAddressDetected={(addr) => {
          setWallet(addr);
          reset();
        }}
      />

      <div>
        <div
          style={{
            color: "#252525",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Step 2 — Enter your details after sending
        </div>
        {[
          {
            val: wallet,
            set: (v) => {
              setWallet(v);
              reset();
            },
            ph: walletPh,
            ok: walletOk,
          },
          {
            val: txHash,
            set: (v) => {
              setTxHash(v);
              reset();
            },
            ph: txPh,
            ok: txOk,
          },
        ].map(({ val, set, ph, ok }, i) => (
          <input
            key={i}
            value={val}
            onChange={(e) => set(e.target.value.trim())}
            placeholder={ph}
            style={{
              width: "100%",
              background: "rgba(255,255,255,.03)",
              border: `1px solid ${val && ok ? "rgba(132,204,22,.3)" : val ? "rgba(239,68,68,.25)" : "rgba(255,255,255,.07)"}`,
              borderRadius: 9,
              padding: "10px 11px",
              color: "#e8e8e8",
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              outline: "none",
              boxSizing: "border-box",
              caretColor: "#84cc16",
              marginBottom: i === 0 ? 6 : 0,
            }}
          />
        ))}
      </div>

      {error && <ErrBox msg={error} />}

      <PrimaryBtn
        onClick={() => {
          if (!canSubmit || loading || treasuryMissing) return;
          reset();
          onVerify({
            chainType: chain.ecosystem,
            chain: chain.id,
            txHash: txHash.trim(),
            walletAddress: wallet.trim(),
          });
        }}
        disabled={!canSubmit || treasuryMissing}
        busy={loading}
      >
        {loading ? "Verifying on blockchain…" : "Verify & Activate →"}
      </PrimaryBtn>
    </div>
  );
}

// ── Paystack panel ────────────────────────────────────────────────────────────

function PaystackPanel({
  effectivePrice,
  product,
  onPay,
  loading,
  error,
  status,
}) {
  const displayPrice = effectivePrice ?? product?.amount_usd ?? 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <p
        style={{
          color: "#2a2a2a",
          fontSize: 11,
          lineHeight: 1.7,
          margin: 0,
          textAlign: "center",
        }}
      >
        Pay with debit/credit card, bank transfer, or mobile money. You'll be
        redirected to Paystack's secure checkout and brought back automatically.
      </p>
      {error && <ErrBox msg={error} />}
      {status === "creating" ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0",
          }}
        >
          <Spin s={22} />
        </div>
      ) : (
        <PrimaryBtn
          onClick={onPay}
          disabled={!product}
          busy={loading && status === "creating"}
        >
          Pay $
          {typeof displayPrice === "number"
            ? displayPrice.toFixed(0)
            : displayPrice}{" "}
          with Paystack →
        </PrimaryBtn>
      )}
    </div>
  );
}

// ── Success ───────────────────────────────────────────────────────────────────

const Success = () => (
  <div
    style={{
      textAlign: "center",
      padding: "24px 12px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
      animation: "xvUp .5s ease",
    }}
  >
    <style>{ANIM}</style>
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "rgba(132,204,22,.1)",
        border: "2px solid #84cc16",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        color: "#84cc16",
      }}
    >
      ✓
    </div>
    <div>
      <div
        style={{
          color: "#f2f2f2",
          fontSize: 18,
          fontWeight: 800,
          marginBottom: 4,
        }}
      >
        Account Activated!
      </div>
      <div style={{ color: "#2e2e2e", fontSize: 12 }}>
        Welcome to Xeevia. Loading your experience…
      </div>
    </div>
    <Spin s={20} />
  </div>
);

const Pending = ({ info, onRetry }) => {
  const wait = Math.ceil((info?.estimatedWaitSeconds ?? 60) / 60);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "xvUp .4s ease",
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontSize: 28,
          animation: "xvPulse 2s ease infinite",
        }}
      >
        ⏳
      </div>
      <div
        style={{
          background: "rgba(132,204,22,.03)",
          border: "1px solid rgba(132,204,22,.1)",
          borderRadius: 10,
          padding: "11px 13px",
        }}
      >
        <div
          style={{
            color: "#e8e8e8",
            fontWeight: 700,
            marginBottom: 4,
            fontSize: 13,
          }}
        >
          Transaction found — waiting for confirmations
        </div>
        {info && (
          <div style={{ color: "#2e2e2e", fontSize: 12, lineHeight: 1.65 }}>
            <span style={{ color: "#84cc16", fontWeight: 700 }}>
              {info.confirmations}/{info.required}
            </span>{" "}
            confirmations · ~{wait} min remaining
          </div>
        )}
      </div>
      <GhostBtn onClick={onRetry}>Try Again Now</GhostBtn>
    </div>
  );
};

// ── Paystack return poller ────────────────────────────────────────────────────

function PaystackReturnPoller({ refreshProfile }) {
  const [checking, setChecking] = useState(false);
  const [tries, setTries] = useState(0);
  const [manualMsg, setManualMsg] = useState("");

  const handleManualCheck = useCallback(async () => {
    setChecking(true);
    setManualMsg("");
    try {
      await refreshProfile();
      setTries((t) => t + 1);
      setManualMsg(
        "Still processing — your bank may take a few minutes. Try again shortly.",
      );
    } catch {
      setManualMsg("Could not reach server. Please check your connection.");
    } finally {
      setChecking(false);
    }
  }, [refreshProfile]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "28px 8px",
        animation: "xvUp .4s ease",
      }}
    >
      <style>{ANIM}</style>
      <Spin s={28} />
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: "#e8e8e8",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 5,
          }}
        >
          Confirming your payment…
        </div>
        <div style={{ color: "#2e2e2e", fontSize: 12, lineHeight: 1.7 }}>
          This usually takes a few seconds. If you paid successfully
          <br />
          but this screen persists, click the button below.
        </div>
      </div>
      {manualMsg && (
        <div
          style={{
            color: "#fbbf24",
            fontSize: 11,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {manualMsg}
        </div>
      )}
      <GhostBtn onClick={handleManualCheck} disabled={checking}>
        {checking ? (
          <>
            <Spin s={13} /> Checking…
          </>
        ) : tries > 0 ? (
          "Check again"
        ) : (
          "I already paid — check now"
        )}
      </GhostBtn>
      <div
        style={{
          color: "#181818",
          fontSize: 10,
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        Waiting for Paystack confirmation · Do not close this tab
        <br />
        If your account isn't activated within 5 minutes, contact support.
      </div>
    </div>
  );
}

// ── Main PaywallGate ──────────────────────────────────────────────────────────

export default function PaywallGate() {
  const { user, profile, profileLoading, refreshProfile } = useAuth();
  const {
    loading,
    error,
    status,
    pendingInfo,
    initiatePayment,
    applyCode,
    reset,
  } = usePayment();

  const [products, setProducts] = useState([]);
  const [prodLoad, setProdLoad] = useState(true);
  const [tab, setTab] = useState("paystack");
  const [code, setCode] = useState("");
  const [codeLoad, setCodeLoad] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [inviteDetails, setInviteDetails] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [paystackReturn, setPaystackReturn] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Refresh profile when payment completes
  useEffect(() => {
    if (status === "completed") refreshProfile();
  }, [status, refreshProfile]);

  // Load products
  useEffect(() => {
    fetchPaymentProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => {
        if (mounted.current) setProdLoad(false);
      });
  }, []);

  // Read ?code= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    // Only treat as invite code if it's NOT a Supabase OAuth code (OAuth codes are UUIDs)
    const isOAuthCode =
      codeParam && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(codeParam);
    if (!codeParam || isOAuthCode) return;
    setCode(codeParam.toUpperCase());
    setInviteLoading(true);
    fetchInviteCodeDetails(codeParam)
      .then((details) => {
        if (mounted.current) setInviteDetails(details);
      })
      .catch(() => {
        if (mounted.current) setInviteDetails(null);
      })
      .finally(() => {
        if (mounted.current) setInviteLoading(false);
      });
  }, []);

  // Handle Paystack return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref =
      params.get("ref") || params.get("reference") || params.get("trxref");
    if (!ref) return;
    window.history.replaceState({}, "", window.location.pathname);
    const pid = sessionStorage.getItem("xv_pending_product");
    if (pid) {
      clearIdempotencyKey(pid);
      sessionStorage.removeItem("xv_pending_product");
    }
    setPaystackReturn(true);
    refreshProfile();
  }, [refreshProfile]);

  const product =
    products.find((p) => p.tier === "whitelist" && p.is_active) ??
    products.find((p) => p.tier === "standard" && p.is_active) ??
    products[0] ??
    null;

  const effectivePrice = inviteDetails
    ? (inviteDetails.price_override ?? inviteDetails.entry_price ?? 4)
    : (product?.amount_usd ?? 4);

  const amountOverrideCents =
    inviteDetails && effectivePrice !== (product?.amount_usd ?? 4)
      ? Math.round(effectivePrice * 100)
      : null;

  const handlePaystack = useCallback(() => {
    if (!product || loading) return;
    reset();
    initiatePayment({
      productId: product.id,
      provider: "paystack",
      amountOverrideCents,
    });
  }, [product, loading, initiatePayment, reset, amountOverrideCents]);

  const handleWeb3 = useCallback(
    ({ chainType, chain, txHash, walletAddress }) => {
      if (!product || loading) return;
      initiatePayment({
        productId: product.id,
        provider: "web3",
        chainType,
        chain,
        txHash,
        walletAddress,
        onSuccess: refreshProfile,
      });
    },
    [product, loading, initiatePayment, refreshProfile],
  );

  const handleCode = useCallback(async () => {
    if (!code.trim() || codeLoad) return;
    setCodeLoad(true);
    setCodeErr("");
    try {
      await applyCode({
        code,
        userId: user?.id,
        products,
        onSuccess: refreshProfile,
      });
    } catch (e) {
      if (mounted.current) setCodeErr(e?.message ?? "Invalid code");
    } finally {
      if (mounted.current) setCodeLoad(false);
    }
  }, [code, codeLoad, applyCode, user?.id, products, refreshProfile]);

  // ── Render guards ─────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}
      >
        <style>{ANIM}</style>
        <Spin s={26} />
      </div>
    );
  }

  if (isPaidProfile(profile) || status === "completed") return <Success />;

  if (status === "pending_confirmations") {
    return <Pending info={pendingInfo} onRetry={reset} />;
  }

  if (status === "redirecting") {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "32px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 11,
        }}
      >
        <style>{ANIM}</style>
        <Spin s={26} />
        <div style={{ color: "#2e2e2e", fontSize: 12 }}>
          Redirecting to Paystack…
        </div>
        <div style={{ color: "#181818", fontSize: 11 }}>
          Do not close this tab.
        </div>
      </div>
    );
  }

  if (paystackReturn) {
    return (
      <div style={{ width: "100%" }}>
        <style>{ANIM}</style>
        <PaystackReturnPoller refreshProfile={refreshProfile} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
      }}
    >
      <style>{ANIM}</style>

      {prodLoad || inviteLoading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0",
          }}
        >
          <Spin s={22} />
        </div>
      ) : (
        <PriceCard
          effectivePrice={effectivePrice}
          inviteDetails={inviteDetails}
          loading={false}
        />
      )}

      <TabBar
        active={tab}
        onChange={(t) => {
          setTab(t);
          reset();
        }}
      />

      <div style={{ animation: "xvUp .25s ease" }}>
        {tab === "paystack" ? (
          <PaystackPanel
            effectivePrice={effectivePrice}
            product={product}
            onPay={handlePaystack}
            loading={loading}
            error={error}
            status={status}
          />
        ) : (
          <Web3Panel
            product={product}
            onVerify={handleWeb3}
            loading={loading}
            error={error}
            reset={reset}
          />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{ flex: 1, height: 1, background: "rgba(255,255,255,.05)" }}
        />
        <span
          style={{
            color: "#1c1c1c",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "2px",
          }}
        >
          OR
        </span>
        <div
          style={{ flex: 1, height: 1, background: "rgba(255,255,255,.05)" }}
        />
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setCodeErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCode()}
          placeholder="Invite or VIP code"
          style={{
            flex: 1,
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 9,
            padding: "10px 12px",
            color: "#e8e8e8",
            fontFamily: "inherit",
            fontSize: 12,
            outline: "none",
            letterSpacing: "1.5px",
            caretColor: "#84cc16",
          }}
        />
        <button
          onClick={handleCode}
          disabled={codeLoad || !code.trim()}
          style={{
            padding: "10px 13px",
            borderRadius: 9,
            border: "1px solid rgba(132,204,22,.2)",
            background: "transparent",
            color: "#84cc16",
            fontWeight: 700,
            fontSize: 12,
            cursor: codeLoad || !code.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          {codeLoad ? "…" : "Apply"}
        </button>
      </div>
      {codeErr && <ErrBox msg={codeErr} />}

      <p
        style={{
          color: "#181818",
          fontSize: 10,
          textAlign: "center",
          margin: "1px 0 0",
          lineHeight: 1.75,
        }}
      >
        One-time payment · No hidden fees · Instant activation · 300 EP minted
        to your wallet
      </p>
    </div>
  );
}
