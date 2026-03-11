// src/components/Auth/PaywallPayment.jsx — v3 FREE-GATE-FIX
// ============================================================================
// FIXES vs v2:
//  [1] isFree is no longer re-derived here — it's passed as `isFreeAccess`
//      prop from PaywallGate (the authoritative source). This prevents the
//      situation where a standard-type code with price=0 was not recognized
//      as free because isWLInvite was false.
//
//  [2] isApprovedAccess prop replaces local isUserWhitelistedFromWaitlist
//      re-computation — same authoritative-prop pattern.
//
//  [3] Payment tabs (EVM/SOL/Cardano) are hidden whenever isFreeAccess OR
//      isApprovedAccess is true — no wallet needed.
//
//  [4] The "Activate Free Access" button is shown whenever isFreeAccess OR
//      isApprovedAccess, regardless of invite type.
//
// Everything else unchanged from v2.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../services/config/supabase";
import {
  verifyWeb3Payment,
  requestWalletPayment,
  requestSolanaPayment,
  requestCardanoPayment,
  detectAvailableWallet,
  detectSolanaWallet,
  detectCardanoWallet,
  connectWallet,
  activateFreeCode,
  clearIdempotencyKey,
} from "../../services/auth/paymentService";
import {
  saveConnectedWallet,
  fetchInviteCodeDetails,
  buildERC20TransferData,
} from "../../services/auth/paywallDataService";

// ─── Chain registries ──────────────────────────────────────────────────────────
export const EVM_CHAINS = [
  {
    id: "polygon",
    label: "Polygon",
    emoji: "💜",
    fee: "~$0.01",
    chainId: 137,
    color: "#8b5cf6",
    tokens: [
      {
        symbol: "USDT",
        address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
        decimals: 6,
      },
      {
        symbol: "USDC",
        address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        decimals: 6,
      },
    ],
  },
  {
    id: "base",
    label: "Base",
    emoji: "🔵",
    fee: "~$0.01",
    chainId: 8453,
    color: "#3b82f6",
    tokens: [
      {
        symbol: "USDC",
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
      },
      {
        symbol: "USDT",
        address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
        decimals: 6,
      },
    ],
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    emoji: "🔷",
    fee: "~$0.02",
    chainId: 42161,
    color: "#06b6d4",
    tokens: [
      {
        symbol: "USDT",
        address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        decimals: 6,
      },
      {
        symbol: "USDC",
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        decimals: 6,
      },
    ],
  },
  {
    id: "optimism",
    label: "Optimism",
    emoji: "🔴",
    fee: "~$0.01",
    chainId: 10,
    color: "#ef4444",
    tokens: [
      {
        symbol: "USDT",
        address: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
        decimals: 6,
      },
      {
        symbol: "USDC",
        address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
        decimals: 6,
      },
    ],
  },
  {
    id: "ethereum",
    label: "Ethereum",
    emoji: "⬡",
    fee: "~$2-5",
    chainId: 1,
    color: "#a78bfa",
    tokens: [
      {
        symbol: "USDT",
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        decimals: 6,
      },
      {
        symbol: "USDC",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
      },
    ],
  },
  {
    id: "bnb",
    label: "BNB Chain",
    emoji: "🟡",
    fee: "~$0.05",
    chainId: 56,
    color: "#eab308",
    tokens: [
      {
        symbol: "USDT",
        address: "0x55d398326f99059ff775485246999027b3197955",
        decimals: 18,
      },
      {
        symbol: "USDC",
        address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        decimals: 18,
      },
    ],
  },
  {
    id: "avalanche",
    label: "Avalanche C",
    emoji: "🔺",
    fee: "~$0.05",
    chainId: 43114,
    color: "#e84142",
    tokens: [
      {
        symbol: "USDT",
        address: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
        decimals: 6,
      },
      {
        symbol: "USDC",
        address: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
        decimals: 6,
      },
    ],
  },
  {
    id: "zksync",
    label: "zkSync Era",
    emoji: "⚡",
    fee: "~$0.01",
    chainId: 324,
    color: "#60a5fa",
    tokens: [
      {
        symbol: "USDT",
        address: "0x493257fd37edb34451f62edf8d2a0c418852ba4c",
        decimals: 6,
      },
      {
        symbol: "USDC",
        address: "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4",
        decimals: 6,
      },
    ],
  },
];

const SOL_TOKENS = [
  {
    symbol: "USDC",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
];

const MOBILE_EVM_WALLETS = [
  { id: "metamask", label: "MetaMask", emoji: "🦊", color: "#f6851b" },
  { id: "trust", label: "Trust Wallet", emoji: "🛡️", color: "#3375bb" },
  { id: "coinbase", label: "Coinbase Wallet", emoji: "🔵", color: "#0052ff" },
];

function isMobileBrowser() {
  return /iPhone|iPad|iPod|Android/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );
}

function getMobileWalletDeepLink(walletId, dappUrl) {
  const encoded = encodeURIComponent(dappUrl);
  const links = {
    metamask: `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, "")}`,
    trust: `https://link.trustwallet.com/open_url?coin_id=60&url=${encoded}`,
    phantom: `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`,
    coinbase: `https://go.cb-wallet.io/dapp?url=${encoded}`,
  };
  return links[walletId] ?? null;
}

const fmt = (n) =>
  typeof n === "number" && !isNaN(n)
    ? n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(2)
    : "—";
const mono = { fontFamily: "'JetBrains Mono', monospace" };

function safePrice(value, fallback = 4) {
  const n = Number(value);
  return n > 0 ? n : fallback;
}

// ─── Primitives ───────────────────────────────────────────────────────────────
const Spin = ({ size = 18, color = "#a3e635" }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: "50%",
      border: `2px solid rgba(163,230,53,.12)`,
      borderTopColor: color,
      animation: "xvSpin .6s linear infinite",
    }}
  />
);

const Label = ({ children }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "1.8px",
      textTransform: "uppercase",
      color: "#666",
      marginBottom: 8,
    }}
  >
    {children}
  </div>
);

const ErrBox = ({ msg }) => {
  if (!msg) return null;
  const isSrv = /server config|contact support/i.test(msg);
  return (
    <div
      style={{
        background: isSrv ? "rgba(245,158,11,.07)" : "rgba(239,68,68,.07)",
        border: `1px solid ${isSrv ? "rgba(245,158,11,.28)" : "rgba(239,68,68,.22)"}`,
        borderRadius: 11,
        padding: "11px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        animation: "xvFadeIn .2s",
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>
        {isSrv ? "🔧" : "⚠️"}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: isSrv ? "#fcd34d" : "#fca5a5",
          lineHeight: 1.65,
        }}
      >
        {msg}
      </span>
    </div>
  );
};

const InfoBox = ({ icon, children }) => (
  <div
    style={{
      background: "rgba(163,230,53,.04)",
      border: "1px solid rgba(163,230,53,.1)",
      borderRadius: 11,
      padding: "10px 13px",
      display: "flex",
      gap: 9,
      alignItems: "flex-start",
    }}
  >
    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: 11.5, color: "#999", lineHeight: 1.65 }}>
      {children}
    </span>
  </div>
);

const Divider = ({ label }) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}
  >
    <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
    {label && (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "2.5px",
          color: "#555",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    )}
    <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
  </div>
);

const StepRow = ({ step, active, label, sub }) => {
  const state = active > step ? "done" : active === step ? "act" : "idle";
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        opacity: state === "idle" ? 0.32 : 1,
        transition: "opacity .3s",
      }}
    >
      <div className={`xv-dot ${state}`}>
        {state === "done" ? (
          "✓"
        ) : state === "act" ? (
          <Spin size={12} color="#a3e635" />
        ) : (
          step
        )}
      </div>
      <div style={{ paddingTop: 5 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: state === "idle" ? "#555" : "#e4e4e4",
          }}
        >
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  );
};

const WalletBadge = ({ wallet, accentColor = "#a3e635" }) => {
  if (!wallet) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#111",
        border: "1px solid #1e1e1e",
        borderRadius: 11,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          flexShrink: 0,
          background: wallet.connected ? accentColor : "#2a2a2a",
          boxShadow: wallet.connected ? `0 0 8px ${accentColor}90` : "none",
          transition: "all .3s",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#d8d8d8" }}>
          {wallet.label}
        </div>
        {wallet.address && (
          <div
            style={{
              fontSize: 10,
              color: "#666",
              ...mono,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {wallet.address.slice(0, 10)}…{wallet.address.slice(-6)}
          </div>
        )}
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: wallet.connected ? accentColor : "#555",
          background: wallet.connected ? `${accentColor}15` : "#1a1a1a",
          border: `1px solid ${wallet.connected ? `${accentColor}30` : "#222"}`,
          borderRadius: 6,
          padding: "3px 8px",
          whiteSpace: "nowrap",
        }}
      >
        {wallet.connected ? "Connected" : "Detected"}
      </span>
    </div>
  );
};

const ModeControl = ({ isManual, onChange }) => (
  <div className="xv-seg">
    <button
      className={`xv-seg-btn smart ${!isManual ? "on" : ""}`}
      onClick={() => isManual && onChange(false)}
    >
      <span>✨</span> Smart Pay{" "}
      {!isManual && (
        <span
          style={{
            fontSize: 9,
            background: "rgba(163,230,53,.15)",
            color: "#a3e635",
            border: "1px solid rgba(163,230,53,.25)",
            borderRadius: 4,
            padding: "1px 5px",
            fontWeight: 800,
          }}
        >
          ON
        </span>
      )}
    </button>
    <button
      className={`xv-seg-btn manual ${isManual ? "on" : ""}`}
      onClick={() => !isManual && onChange(true)}
    >
      <span>🔧</span> Manual{" "}
      {isManual && (
        <span
          style={{
            fontSize: 9,
            background: "rgba(148,163,184,.12)",
            color: "#94a3b8",
            border: "1px solid rgba(148,163,184,.2)",
            borderRadius: 4,
            padding: "1px 5px",
            fontWeight: 800,
          }}
        >
          ON
        </span>
      )}
    </button>
  </div>
);

const ChainDropdown = ({ selected, onChange, chains }) => (
  <div>
    <Label>Network</Label>
    <div className="xv-select-wrap">
      <select
        className="xv-chain-sel"
        value={selected.id}
        onChange={(e) => {
          const c = chains.find((x) => x.id === e.target.value);
          if (c) onChange(c);
        }}
      >
        {chains.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.label} — {c.fee}
          </option>
        ))}
      </select>
    </div>
    <div
      style={{
        marginTop: 6,
        height: 2,
        borderRadius: 1,
        background: `linear-gradient(90deg,${selected.color}80,${selected.color})`,
        transition: "background .3s",
      }}
    />
  </div>
);

const TokenRow = ({ tokens, selected, onChange }) => (
  <div>
    <Label>Token</Label>
    <div className="xv-token-row">
      {tokens.map((t) => (
        <button
          key={t.symbol}
          className={`xv-token-btn ${selected?.symbol === t.symbol ? "on" : ""}`}
          onClick={() => onChange(t)}
        >
          {t.symbol}
        </button>
      ))}
    </div>
  </div>
);

const CopyAddress = ({ label, address, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!address) return;
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
    onCopy?.();
  };
  if (!address)
    return (
      <div
        style={{
          background: "#110900",
          border: "1px solid rgba(245,158,11,.22)",
          borderRadius: 11,
          padding: "11px 13px",
          fontSize: 12,
          color: "#fbbf24",
        }}
      >
        ⚠️ {label} treasury wallet not configured. Contact support.
      </div>
    );
  return (
    <div
      onClick={copy}
      style={{
        background: "#111",
        border: `1.5px solid ${copied ? "rgba(163,230,53,.38)" : "#222"}`,
        borderRadius: 11,
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        transition: "border-color .2s",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#c8f56a",
          ...mono,
          wordBreak: "break-all",
          lineHeight: 1.5,
        }}
      >
        {address}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          color: copied ? "#a3e635" : "#555",
          background: copied ? "rgba(163,230,53,.08)" : "#1a1a1a",
          border: `1px solid ${copied ? "rgba(163,230,53,.22)" : "#282828"}`,
          borderRadius: 7,
          padding: "5px 10px",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </span>
    </div>
  );
};

function MobileWalletSelector({ effectivePrice, token }) {
  const dappUrl = typeof window !== "undefined" ? window.location.href : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          background: "rgba(163,230,53,.04)",
          border: "1px solid rgba(163,230,53,.12)",
          borderRadius: 11,
          padding: "11px 14px",
          fontSize: 12,
          color: "#999",
          lineHeight: 1.65,
        }}
      >
        📱 Open this page inside your mobile wallet's browser, or tap a wallet
        below to open it.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MOBILE_EVM_WALLETS.map((w) => (
          <a
            key={w.id}
            href={getMobileWalletDeepLink(w.id, dappUrl) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 16px",
              borderRadius: 12,
              border: `1px solid ${w.color}33`,
              background: `${w.color}0a`,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 22 }}>{w.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>
                Open in {w.label}
              </div>
              <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                Pay ${fmt(effectivePrice)} {token?.symbol ?? "USDC"}
              </div>
            </div>
            <span style={{ fontSize: 16, color: "#555" }}>→</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── EVM Panels ───────────────────────────────────────────────────────────────
function SmartEVM({ product, effectivePrice, onSuccess, userId }) {
  const [chain, setChain] = useState(EVM_CHAINS[0]);
  const [token, setToken] = useState(EVM_CHAINS[0].tokens[0]);
  const [wallet, setWallet] = useState(null);
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState("");
  const [txHash, setTxHash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [onMobile] = useState(() => isMobileBrowser());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    detectAvailableWallet()
      .then((w) => {
        if (mounted.current) setWallet(w);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);

  const changeChain = useCallback((c) => {
    setChain(c);
    setToken(c.tokens[0]);
    setErr("");
    setStep(0);
  }, []);

  const pay = useCallback(async () => {
    if (busy || !wallet || !product) return;
    setErr("");
    setBusy(true);
    setStep(1);
    setStepMsg("Connecting…");
    try {
      const r = await requestWalletPayment({
        productId: product.id,
        amountUSD: effectivePrice,
        chainId: chain.chainId,
        chainName: chain.id,
        tokenAddress: token.address,
        tokenDecimals: token.decimals,
        onStep: (s) => {
          if (!mounted.current) return;
          setStepMsg(s.message);
          if (s.type === "connecting" || s.type === "switching_chain")
            setStep(1);
          else if (s.type === "sending") setStep(2);
          else if (s.type === "sent") {
            setStep(3);
            setTxHash(s.txHash);
          } else if (s.type === "confirming") setStep(3);
        },
      });
      if (!mounted.current) return;
      if (r.success) {
        if (wallet.address && userId)
          await saveConnectedWallet(
            userId,
            "EVM",
            wallet.address,
            wallet.label,
          );
        setStep(4);
        onSuccess?.(r);
      } else if (r.pending) {
        setErr(r.message);
        setStep(0);
      }
    } catch (e) {
      if (!mounted.current) return;
      setErr(e?.message ?? "Payment failed.");
      setStep(0);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, wallet, product, effectivePrice, chain, token, onSuccess, userId]);

  const idle = step === 0;
  if (onMobile && !wallet)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "xvFadeIn .2s",
        }}
      >
        <MobileWalletSelector effectivePrice={effectivePrice} token={token} />
        <Divider label="or manual" />
        <div style={{ fontSize: 12, color: "#888", textAlign: "center" }}>
          Already inside a wallet browser?{" "}
          <button
            onClick={() =>
              detectAvailableWallet()
                .then(setWallet)
                .catch(() => {})
            }
            style={{
              color: "#a3e635",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Tap to detect
          </button>
        </div>
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "xvFadeIn .2s",
      }}
    >
      {wallet ? (
        <WalletBadge wallet={wallet} />
      ) : (
        <div
          style={{
            background: "#110c00",
            border: "1px solid rgba(245,158,11,.22)",
            borderRadius: 11,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>🏦</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fbbf24",
                marginBottom: 3,
              }}
            >
              No wallet detected
            </div>
            <div style={{ fontSize: 11, color: "#9a8050", lineHeight: 1.65 }}>
              Install MetaMask, Coinbase, or Trust Wallet. Or switch to{" "}
              <strong style={{ color: "#94a3b8" }}>Manual</strong>.
            </div>
          </div>
        </div>
      )}
      {idle && (
        <>
          <ChainDropdown
            selected={chain}
            onChange={changeChain}
            chains={EVM_CHAINS}
          />
          <TokenRow
            tokens={chain.tokens}
            selected={token}
            onChange={setToken}
          />
        </>
      )}
      {!idle && (
        <div
          className="xv-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <StepRow
            step={1}
            active={step}
            label="Connect wallet"
            sub="Approve in your extension"
          />
          <StepRow
            step={2}
            active={step}
            label="Sign transaction"
            sub={`$${fmt(effectivePrice)} ${token.symbol} on ${chain.label}`}
          />
          <StepRow
            step={3}
            active={step}
            label="Blockchain confirmation"
            sub={
              txHash
                ? `TX: ${txHash.slice(0, 14)}…`
                : "Waiting for confirmation"
            }
          />
          <StepRow
            step={4}
            active={step}
            label="Account activated ✓"
            sub="Welcome to Xeevia!"
          />
          {stepMsg && (
            <div
              style={{
                fontSize: 11,
                color: "#a3e635",
                fontStyle: "italic",
                textAlign: "center",
                paddingTop: 4,
              }}
            >
              {stepMsg}
            </div>
          )}
        </div>
      )}
      <ErrBox msg={err} />
      {idle ? (
        <button
          className="xv-btn-lime"
          onClick={pay}
          disabled={!wallet || !product || busy}
        >
          {wallet ? (
            <>
              {wallet.label} → Pay ${fmt(effectivePrice)} {token.symbol}
            </>
          ) : (
            "Install a wallet to continue"
          )}
        </button>
      ) : (
        step < 4 && (
          <button
            className="xv-btn-danger"
            onClick={() => {
              setBusy(false);
              setStep(0);
              setStepMsg("");
            }}
          >
            Cancel payment
          </button>
        )
      )}
    </div>
  );
}

function ManualEVM({ effectivePrice, onVerify, loading, error, reset }) {
  const [chain, setChain] = useState(EVM_CHAINS[0]);
  const [wallet, setWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET ?? "";
  const okTx = /^0x[0-9a-fA-F]{64}$/.test(txHash);
  const okWal = /^0x[0-9a-fA-F]{40}$/.test(wallet);
  const can = okTx && okWal && !!treasury && !loading;
  const autoFill = async () => {
    setFilling(true);
    try {
      const a = await connectWallet("EVM");
      setWallet(a);
      reset();
    } catch (e) {
      alert(e.message);
    } finally {
      setFilling(false);
    }
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "xvFadeIn .2s",
      }}
    >
      <ChainDropdown
        selected={chain}
        onChange={(c) => {
          setChain(c);
          reset();
        }}
        chains={EVM_CHAINS}
      />
      <div>
        <Label>Step 1 — Send ${fmt(effectivePrice)} USDT/USDC to</Label>
        <CopyAddress address={treasury} label="EVM" />
      </div>
      <div>
        <Label>Step 2 — Your sending wallet address</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className={`xv-input ${wallet ? (okWal ? "ok" : "err") : ""}`}
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value.trim());
              reset();
            }}
            placeholder="0x… wallet address"
            style={{ flex: 1 }}
          />
          <button
            className="xv-btn-outline"
            onClick={autoFill}
            disabled={filling}
            style={{
              width: "auto",
              padding: "0 14px",
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontSize: 12,
            }}
          >
            {filling ? <Spin size={13} /> : "🦊 Auto-fill"}
          </button>
        </div>
        {wallet && !okWal && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
            Must be a valid 0x address
          </div>
        )}
      </div>
      <div>
        <Label>Step 3 — Transaction hash</Label>
        <input
          className={`xv-input ${txHash ? (okTx ? "ok" : "err") : ""}`}
          value={txHash}
          onChange={(e) => {
            setTxHash(e.target.value.trim());
            reset();
          }}
          placeholder="0x… tx hash (66 characters)"
        />
        {txHash && !okTx && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
            Must be 0x + 64 hex characters
          </div>
        )}
      </div>
      <InfoBox icon="🔒">
        Your wallet and amount are verified directly on-chain. No one can fake
        this.
      </InfoBox>
      <ErrBox msg={error} />
      <button
        className="xv-btn-lime"
        onClick={() =>
          can &&
          onVerify({
            chainType: chain.ecosystem ?? "EVM",
            chain: chain.id,
            txHash: txHash.trim(),
            claimedSenderWallet: wallet.trim(),
          })
        }
        disabled={!can}
      >
        {loading ? (
          <>
            <Spin size={16} color="#061000" />
            Verifying on blockchain…
          </>
        ) : (
          "Verify & Activate Account →"
        )}
      </button>
    </div>
  );
}

function EVMPanel({
  product,
  effectivePrice,
  onSmartSuccess,
  onVerify,
  loading,
  error,
  reset,
  userId,
}) {
  const [isManual, setIsManual] = useState(false);
  return (
    <div>
      <ModeControl isManual={isManual} onChange={setIsManual} />
      {isManual ? (
        <ManualEVM
          effectivePrice={effectivePrice}
          onVerify={onVerify}
          loading={loading}
          error={error}
          reset={reset}
        />
      ) : (
        <SmartEVM
          product={product}
          effectivePrice={effectivePrice}
          onSuccess={onSmartSuccess}
          userId={userId}
        />
      )}
    </div>
  );
}

function SmartSolana({ effectivePrice, onSuccess, userId, product }) {
  const [detWallet, setDetWallet] = useState(null);
  const [detecting, setDetecting] = useState(true);
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [token, setToken] = useState(SOL_TOKENS[0]);
  const [onMobile] = useState(() => isMobileBrowser());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    detectSolanaWallet()
      .then((w) => {
        if (mounted.current) {
          setDetWallet(w);
          setDetecting(false);
        }
      })
      .catch(() => {
        if (mounted.current) setDetecting(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  const pay = useCallback(async () => {
    if (busy) return;
    setErr("");
    setBusy(true);
    setStep(1);
    setStepMsg("Connecting Solana wallet…");
    try {
      const r = await requestSolanaPayment({
        productId: product.id,
        amountUSD: effectivePrice,
        tokenSymbol: token.symbol,
        onStep: (s) => {
          if (!mounted.current) return;
          setStepMsg(s.message);
          if (s.type === "connecting") setStep(1);
          else if (s.type === "sending") setStep(2);
          else if (s.type === "sent") setStep(3);
          else if (s.type === "confirming") setStep(3);
        },
      });
      if (!mounted.current) return;
      if (r.success) {
        const addr = detWallet?.address;
        if (addr && userId)
          await saveConnectedWallet(
            userId,
            "SOLANA",
            addr,
            detWallet?.label ?? "Solana Wallet",
          );
        setStep(4);
        onSuccess?.(r);
      }
    } catch (e) {
      if (!mounted.current) return;
      const msg = e?.message ?? "Payment failed.";
      setErr(
        msg.includes("Manual") || msg.includes("library")
          ? msg + " Use Manual mode below."
          : msg,
      );
      setStep(0);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, product, effectivePrice, token, onSuccess, userId, detWallet]);

  const idle = step === 0;
  if (onMobile && !detWallet && !detecting)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "xvFadeIn .2s",
        }}
      >
        <a
          href={`https://phantom.app/ul/browse/${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}?ref=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(153,69,255,.3)",
            background: "rgba(153,69,255,.07)",
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 22 }}>🏦</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>
              Open in Phantom
            </div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
              Pay ${fmt(effectivePrice)} {token.symbol}
            </div>
          </div>
          <span style={{ fontSize: 16, color: "#555", marginLeft: "auto" }}>
            →
          </span>
        </a>
        <div style={{ fontSize: 11, color: "#777", textAlign: "center" }}>
          Or open this page inside Phantom / Solflare browser
        </div>
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "xvFadeIn .2s",
      }}
    >
      {detecting ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0",
            color: "#777",
            fontSize: 13,
          }}
        >
          <Spin size={14} color="#9945ff" /> Detecting Solana wallets…
        </div>
      ) : detWallet ? (
        <WalletBadge
          wallet={{ ...detWallet, connected: !!detWallet.address }}
          accentColor="#9945ff"
        />
      ) : (
        <div
          style={{
            background: "rgba(153,69,255,.06)",
            border: "1px solid rgba(153,69,255,.2)",
            borderRadius: 11,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>◎</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#a78bfa",
                marginBottom: 3,
              }}
            >
              No Solana wallet detected
            </div>
            <div style={{ fontSize: 11, color: "#8a7aaa", lineHeight: 1.65 }}>
              Install Phantom, Solflare, or Backpack then refresh. Or use{" "}
              <strong style={{ color: "#94a3b8" }}>Manual</strong>.
            </div>
          </div>
        </div>
      )}
      {idle && (
        <TokenRow tokens={SOL_TOKENS} selected={token} onChange={setToken} />
      )}
      {!idle && (
        <div
          className="xv-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <StepRow
            step={1}
            active={step}
            label="Connect Solana wallet"
            sub="Approve in Phantom / Solflare / Backpack"
          />
          <StepRow
            step={2}
            active={step}
            label="Build & sign transaction"
            sub={`$${fmt(effectivePrice)} ${token.symbol} on Solana`}
          />
          <StepRow
            step={3}
            active={step}
            label="Broadcast & confirm"
            sub="Submitting to Solana network"
          />
          <StepRow
            step={4}
            active={step}
            label="Account activated ✓"
            sub="Welcome to Xeevia!"
          />
          {stepMsg && (
            <div
              style={{
                fontSize: 11,
                color: "#9945ff",
                fontStyle: "italic",
                textAlign: "center",
                paddingTop: 4,
              }}
            >
              {stepMsg}
            </div>
          )}
        </div>
      )}
      <ErrBox msg={err} />
      {idle ? (
        <button
          className="xv-btn-sol"
          onClick={pay}
          disabled={!product || busy || detecting}
        >
          {detWallet
            ? `${detWallet.label} → Pay $${fmt(effectivePrice)} ${token.symbol}`
            : detecting
              ? "Detecting wallet…"
              : "Connect Solana Wallet"}
        </button>
      ) : (
        step < 4 && (
          <button
            className="xv-btn-danger"
            onClick={() => {
              setBusy(false);
              setStep(0);
              setStepMsg("");
            }}
          >
            Cancel
          </button>
        )
      )}
    </div>
  );
}

function ManualSolana({
  effectivePrice,
  onVerify,
  loading,
  error,
  reset,
  userId,
}) {
  const [wallet, setWallet] = useState("");
  const [txSig, setTxSig] = useState("");
  const [token, setToken] = useState(SOL_TOKENS[0]);
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET_SOL ?? "";
  const okSig = /^[1-9A-HJ-NP-Za-km-z]{87,90}$/.test(txSig);
  const okWal = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
  const can = okSig && okWal && !!treasury && !loading;
  const autoFill = async () => {
    setFilling(true);
    try {
      const a = await connectWallet("SOLANA");
      setWallet(a);
      if (userId)
        await saveConnectedWallet(userId, "SOLANA", a, "Solana Wallet");
      reset();
    } catch (e) {
      alert(e.message);
    } finally {
      setFilling(false);
    }
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "xvFadeIn .2s",
      }}
    >
      <TokenRow tokens={SOL_TOKENS} selected={token} onChange={setToken} />
      <div>
        <Label>
          Step 1 — Send ${fmt(effectivePrice)} {token.symbol} to
        </Label>
        <CopyAddress address={treasury} label="SOL" />
      </div>
      <div>
        <Label>Step 2 — Your Solana wallet address</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className={`xv-input ${wallet ? (okWal ? "ok" : "err") : ""}`}
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value.trim());
              reset();
            }}
            placeholder="Solana address (base58)"
            style={{ flex: 1 }}
          />
          <button
            className="xv-btn-outline"
            onClick={autoFill}
            disabled={filling}
            style={{
              width: "auto",
              padding: "0 14px",
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontSize: 12,
            }}
          >
            {filling ? <Spin size={13} /> : "◎ Auto-fill"}
          </button>
        </div>
        {wallet && !okWal && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
            Enter a valid base58 Solana address
          </div>
        )}
      </div>
      <div>
        <Label>Step 3 — Transaction signature</Label>
        <input
          className={`xv-input ${txSig ? (okSig ? "ok" : "err") : ""}`}
          value={txSig}
          onChange={(e) => {
            setTxSig(e.target.value.trim());
            reset();
          }}
          placeholder="Transaction signature (87–90 chars)"
        />
        {txSig && !okSig && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
            Enter a valid Solana transaction signature
          </div>
        )}
      </div>
      <ErrBox msg={error} />
      <button
        className="xv-btn-lime"
        onClick={() =>
          can &&
          onVerify({
            chainType: "SOLANA",
            chain: "solana",
            txHash: txSig.trim(),
            claimedSenderWallet: wallet.trim(),
          })
        }
        disabled={!can}
      >
        {loading ? (
          <>
            <Spin size={16} color="#061000" />
            Verifying…
          </>
        ) : (
          "Verify Solana Payment →"
        )}
      </button>
    </div>
  );
}

function SolanaPanel({
  product,
  effectivePrice,
  onSmartSuccess,
  onVerify,
  loading,
  error,
  reset,
  userId,
}) {
  const [isManual, setIsManual] = useState(false);
  return (
    <div>
      <ModeControl isManual={isManual} onChange={setIsManual} />
      {isManual ? (
        <ManualSolana
          effectivePrice={effectivePrice}
          onVerify={onVerify}
          loading={loading}
          error={error}
          reset={reset}
          userId={userId}
        />
      ) : (
        <SmartSolana
          effectivePrice={effectivePrice}
          onSuccess={onSmartSuccess}
          userId={userId}
          product={product}
        />
      )}
    </div>
  );
}

function SmartCardano({ effectivePrice, onSuccess, userId, product }) {
  const [detWallet, setDetWallet] = useState(null);
  const [detecting, setDetecting] = useState(true);
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    detectCardanoWallet()
      .then((w) => {
        if (mounted.current) {
          setDetWallet(w);
          setDetecting(false);
        }
      })
      .catch(() => {
        if (mounted.current) setDetecting(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  const pay = useCallback(async () => {
    if (busy) return;
    setErr("");
    setBusy(true);
    setStep(1);
    setStepMsg("Connecting Cardano wallet…");
    try {
      const r = await requestCardanoPayment({
        productId: product.id,
        amountUSD: effectivePrice,
        onStep: (s) => {
          if (!mounted.current) return;
          setStepMsg(s.message);
          if (s.type === "connecting") setStep(1);
          else if (s.type === "sending") setStep(2);
          else if (s.type === "confirming") setStep(3);
        },
      });
      if (!mounted.current) return;
      if (r.success) {
        const addr = detWallet?.address;
        if (addr && userId)
          await saveConnectedWallet(
            userId,
            "CARDANO",
            addr,
            detWallet?.label ?? "Cardano Wallet",
          );
        setStep(4);
        onSuccess?.(r);
      }
    } catch (e) {
      if (!mounted.current) return;
      const msg = e?.message ?? "Payment failed.";
      setErr(
        msg.includes("Manual")
          ? msg
          : msg + " If issue persists, try Manual mode.",
      );
      setStep(0);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, product, effectivePrice, onSuccess, userId, detWallet]);
  const idle = step === 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "xvFadeIn .2s",
      }}
    >
      {detecting ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0",
            color: "#777",
            fontSize: 13,
          }}
        >
          <Spin size={14} color="#0057ff" /> Detecting Cardano wallets…
        </div>
      ) : detWallet ? (
        <WalletBadge
          wallet={{ ...detWallet, connected: !!detWallet.address }}
          accentColor="#0057ff"
        />
      ) : (
        <div
          style={{
            background: "rgba(0,51,173,.06)",
            border: "1px solid rgba(0,51,173,.2)",
            borderRadius: 11,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>🏦</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#60a5fa",
                marginBottom: 3,
              }}
            >
              No Cardano wallet detected
            </div>
            <div style={{ fontSize: 11, color: "#6a8aaa", lineHeight: 1.65 }}>
              Install Nami, Eternl, Flint, Lace, or Yoroi then refresh. Or use{" "}
              <strong style={{ color: "#94a3b8" }}>Manual</strong>.
            </div>
          </div>
        </div>
      )}
      {!idle && (
        <div
          className="xv-card"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <StepRow
            step={1}
            active={step}
            label="Connect Cardano wallet"
            sub="Approve in Nami / Eternl / Flint / Lace"
          />
          <StepRow
            step={2}
            active={step}
            label="Build & sign transaction"
            sub={`~$${fmt(effectivePrice)} ADA equivalent`}
          />
          <StepRow
            step={3}
            active={step}
            label="Submit & verify"
            sub="Checking on Cardano chain"
          />
          <StepRow
            step={4}
            active={step}
            label="Account activated ✓"
            sub="Welcome to Xeevia!"
          />
          {stepMsg && (
            <div
              style={{
                fontSize: 11,
                color: "#0057ff",
                fontStyle: "italic",
                textAlign: "center",
                paddingTop: 4,
              }}
            >
              {stepMsg}
            </div>
          )}
        </div>
      )}
      <ErrBox msg={err} />
      {idle ? (
        <button
          className="xv-btn-ada"
          onClick={pay}
          disabled={!product || busy || detecting}
        >
          {detWallet
            ? `${detWallet.label} → Pay $${fmt(effectivePrice)} ADA`
            : detecting
              ? "Detecting wallet…"
              : "Connect Cardano Wallet"}
        </button>
      ) : (
        step < 4 && (
          <button
            className="xv-btn-danger"
            onClick={() => {
              setBusy(false);
              setStep(0);
              setStepMsg("");
            }}
          >
            Cancel
          </button>
        )
      )}
    </div>
  );
}

function ManualCardano({
  effectivePrice,
  onVerify,
  loading,
  error,
  reset,
  userId,
}) {
  const [wallet, setWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET_ADA ?? "";
  const okTx = /^[0-9a-fA-F]{64}$/.test(txHash);
  const okWal =
    wallet.length >= 59 &&
    (wallet.startsWith("addr1") || wallet.startsWith("addr_test1"));
  const can = okTx && okWal && !!treasury && !loading;
  const autoFill = async () => {
    setFilling(true);
    try {
      const a = await connectWallet("CARDANO");
      setWallet(a);
      if (userId)
        await saveConnectedWallet(userId, "CARDANO", a, "Cardano Wallet");
      reset();
    } catch (e) {
      alert(e.message);
    } finally {
      setFilling(false);
    }
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "xvFadeIn .2s",
      }}
    >
      <div
        style={{
          background: "rgba(0,51,173,.06)",
          border: "1px solid rgba(0,51,173,.2)",
          borderRadius: 12,
          padding: "11px 14px",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 18 }}>🏦</span>
        <span style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>
          Send{" "}
          <strong style={{ color: "#a3e635" }}>
            ${fmt(effectivePrice)} ADA equivalent
          </strong>
          . ADA/USD rate is fetched at verification time.
        </span>
      </div>
      <div>
        <Label>Step 1 — Send to this Cardano address</Label>
        <CopyAddress address={treasury} label="ADA" />
      </div>
      <div>
        <Label>Step 2 — Your Cardano address (addr1…)</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className={`xv-input ${wallet ? (okWal ? "ok" : "err") : ""}`}
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value.trim());
              reset();
            }}
            placeholder="addr1… (Shelley address)"
            style={{ flex: 1 }}
          />
          <button
            className="xv-btn-outline"
            onClick={autoFill}
            disabled={filling}
            style={{
              width: "auto",
              padding: "0 14px",
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontSize: 12,
            }}
          >
            {filling ? <Spin size={13} /> : "🦊 Auto-fill"}
          </button>
        </div>
        {wallet && !okWal && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
            Must be a valid Shelley address starting with addr1
          </div>
        )}
      </div>
      <div>
        <Label>Step 3 — Transaction ID (TxHash)</Label>
        <input
          className={`xv-input ${txHash ? (okTx ? "ok" : "err") : ""}`}
          value={txHash}
          onChange={(e) => {
            setTxHash(e.target.value.trim());
            reset();
          }}
          placeholder="64-character transaction ID"
        />
        {txHash && !okTx && (
          <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
            Must be exactly 64 hex characters
          </div>
        )}
      </div>
      <InfoBox icon="ℹ️">
        Send ~2% extra to account for ADA price movement between send and
        verify.
      </InfoBox>
      <ErrBox msg={error} />
      <button
        className="xv-btn-lime"
        onClick={() =>
          can &&
          onVerify({
            chainType: "CARDANO",
            chain: "cardano",
            txHash: txHash.trim(),
            claimedSenderWallet: wallet.trim(),
          })
        }
        disabled={!can}
      >
        {loading ? (
          <>
            <Spin size={16} color="#061000" />
            Verifying…
          </>
        ) : (
          "Verify Cardano Payment →"
        )}
      </button>
    </div>
  );
}

function CardanoPanel({
  product,
  effectivePrice,
  onSmartSuccess,
  onVerify,
  loading,
  error,
  reset,
  userId,
}) {
  const [isManual, setIsManual] = useState(false);
  return (
    <div>
      <ModeControl isManual={isManual} onChange={setIsManual} />
      {isManual ? (
        <ManualCardano
          effectivePrice={effectivePrice}
          onVerify={onVerify}
          loading={loading}
          error={error}
          reset={reset}
          userId={userId}
        />
      ) : (
        <SmartCardano
          effectivePrice={effectivePrice}
          onSuccess={onSmartSuccess}
          userId={userId}
          product={product}
        />
      )}
    </div>
  );
}

function InviteInput({ onApply, loading }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const apply = async () => {
    const trimmed = val.trim().toUpperCase();
    if (!trimmed) return;
    setErr("");
    const result = await onApply(trimmed);
    if (result?.error) setErr(result.error);
    else setVal("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Label>Have an invite code?</Label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className={`xv-input ${val ? "ok" : ""}`}
          value={val}
          onChange={(e) => {
            setVal(e.target.value.toUpperCase());
            setErr("");
          }}
          placeholder="INVITE-CODE"
          style={{ flex: 1, textTransform: "uppercase", letterSpacing: "1px" }}
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
        <button
          className="xv-btn-outline"
          onClick={apply}
          disabled={!val.trim() || loading}
          style={{
            width: "auto",
            padding: "0 16px",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? <Spin size={13} /> : "Apply"}
        </button>
      </div>
      <ErrBox msg={err} />
    </div>
  );
}

function PaystackSoonModal({ onClose }) {
  return (
    <div className="xv-overlay" onClick={onClose}>
      <div className="xv-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "3px",
            color: "#b45309",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Coming Soon
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#fff",
            margin: "0 0 12px",
            lineHeight: 1.2,
            letterSpacing: "-0.5px",
          }}
        >
          Card & Bank Payment
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "#888",
            lineHeight: 1.8,
            margin: "0 0 28px",
          }}
        >
          Finalising Paystack integration — cards, bank transfers, and mobile
          money.
          <br />
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>
            Join our community to get access instantly.
          </span>
        </p>
        <a
          href="https://chat.whatsapp.com/IH3TJof1nRx3sRU9Inm2jr?mode=gi_t"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "16px 20px",
            borderRadius: 14,
            background: "linear-gradient(135deg,#25d366,#128c7e)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            textDecoration: "none",
            boxShadow: "0 4px 22px rgba(37,211,102,.35)",
            marginBottom: 12,
          }}
        >
          💬 Join WhatsApp Group
        </a>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 11,
            border: "1px solid #222",
            background: "transparent",
            color: "#666",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function PaywallPayment({
  user,
  paywallConfig,
  inviteDetails,
  setInviteDetails,
  inviteLoading,
  setInviteLoading,
  verifying,
  verifyError,
  resetVerify,
  onVerify,
  onSmartPaySuccess,
  onFreeActivate,
  freeActivating,
  // [FIX v3] Authoritative free-access signals from PaywallGate
  isFreeAccess = false,
  isApprovedAccess = false,
  showPaystack,
  setShowPaystack,
  tab,
  setTab,
}) {
  const userId = user?.id;

  const productPrice = safePrice(paywallConfig?.product_price, 4);
  const product = paywallConfig
    ? { id: paywallConfig.product_id ?? "xeevia-access", price: productPrice }
    : null;

  const resolvePrice = (invite, fallback = 4) => {
    const fb = safePrice(fallback, 4);
    if (!invite) return fb;
    const po = invite.price_override;
    if (po != null && !isNaN(Number(po))) return Number(po);
    const meta = invite?.metadata ?? {};
    if (
      meta.entry_price_cents != null &&
      !isNaN(Number(meta.entry_price_cents))
    )
      return Number(meta.entry_price_cents) / 100;
    const ep = invite.entry_price;
    if (ep != null && !isNaN(Number(ep))) return Number(ep);
    return fb;
  };

  const effectivePrice = resolvePrice(inviteDetails, productPrice);

  const isWLInvite =
    inviteDetails &&
    (inviteDetails.type === "whitelist" ||
      inviteDetails.metadata?.invite_type === "whitelist" ||
      inviteDetails.metadata?.invite_category === "whitelist");
  const isFull = isWLInvite && !!inviteDetails?.is_full;
  const hasWL = !!(isWLInvite && inviteDetails?.enable_waitlist !== false);

  // [FIX v3]: Use authoritative props from PaywallGate — no re-derivation
  // isFreeAccess = true whenever any applied invite resolves to price === 0
  // isApprovedAccess = true when user is in whitelisted_user_ids
  const showFreeButton =
    (isFreeAccess || isApprovedAccess) && !!inviteDetails?.code;
  const showPaymentTabs = !showFreeButton && !isFull;

  const applyInvite = async (code) => {
    setInviteLoading(true);
    try {
      const details = await fetchInviteCodeDetails(code);
      if (!details) return { error: "Invalid or expired invite code." };
      setInviteDetails(details);
      return {};
    } catch (e) {
      return { error: e?.message ?? "Failed to apply invite." };
    } finally {
      setInviteLoading(false);
    }
  };

  const clearInvite = () => setInviteDetails(null);

  const TABS = [
    { id: "evm", label: "EVM", emoji: "⬡", cls: "off" },
    { id: "solana", label: "Solana", emoji: "◎", cls: "off" },
    { id: "cardano", label: "Cardano", emoji: "🔵", cls: "off" },
    { id: "paystack", label: "Card", emoji: "🏦", cls: "soon" },
  ];

  return (
    <>
      {/* ── [FIX v3] Free / approved access button — shown instead of payment tabs ── */}
      {showFreeButton && (
        <div style={{ marginBottom: 16 }}>
          {isApprovedAccess && (
            <div
              style={{
                background: "rgba(163,230,53,.06)",
                border: "1px solid rgba(163,230,53,.2)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <span style={{ fontSize: 16 }}>🎉</span>
              <div>
                <div
                  style={{ fontSize: 12, fontWeight: 800, color: "#a3e635" }}
                >
                  You've been approved!
                </div>
                <div style={{ fontSize: 10, color: "#5a8a35", marginTop: 2 }}>
                  Your waitlist spot is whitelisted — activate free access
                  below.
                </div>
              </div>
            </div>
          )}
          <button
            className="xv-btn-lime"
            onClick={() => onFreeActivate(inviteDetails.code)}
            disabled={freeActivating}
          >
            {freeActivating ? (
              <>
                <Spin size={16} color="#061000" /> Activating…
              </>
            ) : (
              "🎉 Activate Free Access →"
            )}
          </button>
        </div>
      )}

      {/* Waitlist when full */}
      {isFull && hasWL && !showFreeButton && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: "#888",
              lineHeight: 1.6,
              marginBottom: 10,
            }}
          >
            The whitelist is currently full. Join the waitlist — we'll notify
            you when a spot opens.
          </div>
        </div>
      )}

      {/* ── [FIX v3] Payment tabs only shown when NOT free and NOT full ── */}
      {showPaymentTabs && (
        <>
          <div className="xv-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`xv-tab ${tab === t.id ? "on" : t.cls}`}
                onClick={() => {
                  if (t.id === "paystack") {
                    setShowPaystack(true);
                    return;
                  }
                  setTab(t.id);
                }}
              >
                <span>{t.emoji}</span>
                {t.label}
                {t.cls === "soon" && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      color: "#888",
                      letterSpacing: "0.5px",
                    }}
                  >
                    SOON
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === "evm" && (
            <EVMPanel
              product={product}
              effectivePrice={effectivePrice}
              onSmartSuccess={onSmartPaySuccess}
              onVerify={onVerify}
              loading={verifying}
              error={verifyError}
              reset={resetVerify}
              userId={userId}
            />
          )}
          {tab === "solana" && (
            <SolanaPanel
              product={product}
              effectivePrice={effectivePrice}
              onSmartSuccess={onSmartPaySuccess}
              onVerify={onVerify}
              loading={verifying}
              error={verifyError}
              reset={resetVerify}
              userId={userId}
            />
          )}
          {tab === "cardano" && (
            <CardanoPanel
              product={product}
              effectivePrice={effectivePrice}
              onSmartSuccess={onSmartPaySuccess}
              onVerify={onVerify}
              loading={verifying}
              error={verifyError}
              reset={resetVerify}
              userId={userId}
            />
          )}
        </>
      )}

      {/* Invite code input */}
      {!inviteDetails && (
        <div style={{ marginTop: 16 }}>
          <Divider label="or apply invite code" />
          <div style={{ marginTop: 12 }}>
            <InviteInput onApply={applyInvite} loading={inviteLoading} />
          </div>
        </div>
      )}

      {/* Applied invite badge */}
      {inviteDetails && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#0e0e0e",
              border: "1px solid #1e1e1e",
              borderRadius: 10,
              padding: "9px 13px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13 }}>🎫</span>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#666",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  Invite Applied
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#a3e635",
                    fontWeight: 800,
                    ...mono,
                  }}
                >
                  {inviteDetails.code}
                </div>
              </div>
            </div>
            <button
              onClick={clearInvite}
              style={{
                background: "transparent",
                border: "1px solid #252525",
                borderRadius: 7,
                color: "#555",
                fontSize: 11,
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {showPaystack && (
        <PaystackSoonModal onClose={() => setShowPaystack(false)} />
      )}
    </>
  );
}
