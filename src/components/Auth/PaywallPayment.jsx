// src/components/Auth/PaywallPayment.jsx — v5 PRODUCT_ID_NULL_FIX
// ============================================================================
// CHANGES vs v4:
//  [FIX-1] handlePaystack: after exhausting the 10-iteration wait loop against
//          platform_settings (which has product_id=null), now falls back to
//          querying payment_products directly for the first active product UUID.
//          This is the same fallback as PaywallGate.jsx resolveProductIdFromDB.
//          Before this fix, the button always showed "Payment config unavailable"
//          when platform_settings.paywall_config.product_id was null.
//  All other v4 logic is UNCHANGED — zero functional regressions.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchInviteCodeDetails } from "../../services/auth/paywallDataService";
import {
  activateFreeCode,
  createPaystackTransaction,
  detectAvailableWallet,
  detectSolanaWallet,
  detectCardanoWallet,
  connectWallet,
  connectSolanaWallet,
  connectCardanoWalletCIP30,
  getOrCreateIdempotencyKey,
  clearIdempotencyKey,
} from "../../services/auth/paymentService";
import { supabase } from "../../services/config/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  typeof n === "number" && !isNaN(n)
    ? n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(2)
    : "—";

function safePrice(value, fallback = 4) {
  const n = Number(value);
  return n > 0 ? n : fallback;
}

function resolvePrice(invite, fallback = 4) {
  const fb = safePrice(fallback, 4);
  if (!invite) return fb;
  const po = invite.price_override;
  if (po != null && !isNaN(Number(po))) return Number(po);
  const meta = invite?.metadata ?? {};
  if (meta.entry_price_cents != null && !isNaN(Number(meta.entry_price_cents)))
    return Number(meta.entry_price_cents) / 100;
  const ep = invite.entry_price;
  if (ep != null && !isNaN(Number(ep))) return Number(ep);
  return fb;
}

// ── Spin primitive ────────────────────────────────────────────────────────────
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

// ── EVM chains config ─────────────────────────────────────────────────────────
const EVM_CHAINS = [
  {
    id: "polygon",
    name: "Polygon",
    emoji: "💜",
    fee: "~$0.01",
    chainId: 137,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  },
  {
    id: "polygon",
    name: "Polygon",
    emoji: "💜",
    fee: "~$0.01",
    chainId: 137,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
  },
  {
    id: "base",
    name: "Base",
    emoji: "🔵",
    fee: "~$0.01",
    chainId: 8453,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  },
  {
    id: "base",
    name: "Base",
    emoji: "🔵",
    fee: "~$0.01",
    chainId: 8453,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    emoji: "🔷",
    fee: "~$0.02",
    chainId: 42161,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    emoji: "🔷",
    fee: "~$0.02",
    chainId: 42161,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  },
  {
    id: "optimism",
    name: "Optimism",
    emoji: "🔴",
    fee: "~$0.01",
    chainId: 10,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
  },
  {
    id: "optimism",
    name: "Optimism",
    emoji: "🔴",
    fee: "~$0.01",
    chainId: 10,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    emoji: "⬡",
    fee: "~$2-5",
    chainId: 1,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    emoji: "⬡",
    fee: "~$2-5",
    chainId: 1,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    emoji: "🟡",
    fee: "~$0.05",
    chainId: 56,
    token: "USDT",
    decimals: 18,
    tokenAddress: "0x55d398326f99059ff775485246999027b3197955",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    emoji: "🟡",
    fee: "~$0.05",
    chainId: 56,
    token: "USDC",
    decimals: 18,
    tokenAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
  },
  {
    id: "avalanche",
    name: "Avalanche C",
    emoji: "🔺",
    fee: "~$0.05",
    chainId: 43114,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
  },
  {
    id: "avalanche",
    name: "Avalanche C",
    emoji: "🔺",
    fee: "~$0.05",
    chainId: 43114,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
  },
  {
    id: "zksync",
    name: "zkSync Era",
    emoji: "⚡",
    fee: "~$0.01",
    chainId: 324,
    token: "USDT",
    decimals: 6,
    tokenAddress: "0x493257fd37edb34451f62edf8d2a0c418852ba4c",
  },
  {
    id: "zksync",
    name: "zkSync Era",
    emoji: "⚡",
    fee: "~$0.01",
    chainId: 324,
    token: "USDC",
    decimals: 6,
    tokenAddress: "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4",
  },
];

// ── ManualSolanaInline ────────────────────────────────────────────────────────
function ManualSolanaInline({
  effectivePrice,
  solToken,
  onVerify,
  loading,
  error,
  reset,
}) {
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState("");
  const [txSig, setTxSig] = useState("");
  const [filling, setFilling] = useState(false);
  const treasury = process.env.REACT_APP_TREASURY_WALLET_SOL ?? "";
  const okSig = /^[1-9A-HJ-NP-Za-km-z]{87,90}$/.test(txSig);
  const okWal = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
  const can = okSig && okWal && !!treasury && !loading;

  const autoFill = async () => {
    setFilling(true);
    try {
      const { connectWallet } =
        await import("../../services/auth/paymentService");
      const a = await connectWallet("SOLANA");
      setWallet(a);
      reset?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setFilling(false);
    }
  };

  const CopyAddr = ({ addr }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
      if (!addr) return;
      navigator.clipboard
        .writeText(addr)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    };
    if (!addr)
      return (
        <div
          style={{
            background: "#110900",
            border: "1px solid rgba(245,158,11,.22)",
            borderRadius: 11,
            padding: "10px 13px",
            fontSize: 12,
            color: "#fbbf24",
          }}
        >
          ⚠️ SOL treasury wallet not configured. Contact support.
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
            fontFamily: "monospace",
            wordBreak: "break-all",
            lineHeight: 1.5,
          }}
        >
          {addr}
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

  return (
    <div
      style={{ marginTop: 12, borderTop: "1px solid #1a1a1a", paddingTop: 12 }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent",
          border: "1px solid #252525",
          borderRadius: 8,
          color: "#666",
          fontSize: 11,
          padding: "6px 12px",
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: 600,
          width: "100%",
          textAlign: "left",
        }}
      >
        {open ? "▲ Hide" : "▼ Already sent? Enter transaction manually"}
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 12,
            animation: "xvFadeIn .2s",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 6,
              }}
            >
              Step 1 — Send $
              {effectivePrice?.toFixed
                ? effectivePrice.toFixed(2)
                : effectivePrice}{" "}
              {solToken} to
            </div>
            <CopyAddr addr={treasury} />
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 6,
              }}
            >
              Step 2 — Your Solana wallet address
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={wallet}
                onChange={(e) => {
                  setWallet(e.target.value.trim());
                  reset?.();
                }}
                placeholder="Solana address (base58)"
                style={{
                  flex: 1,
                  background: "#0f0f0f",
                  border: `1.5px solid ${wallet ? (okWal ? "#a3e63550" : "#f8717150") : "#1e1e1e"}`,
                  borderRadius: 10,
                  padding: "11px 13px",
                  color: "#e4e4e4",
                  fontSize: 12,
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
              <button
                onClick={autoFill}
                disabled={filling}
                style={{
                  flexShrink: 0,
                  width: "auto",
                  padding: "0 14px",
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: 10,
                  color: "#888",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {filling ? "…" : "◎ Auto-fill"}
              </button>
            </div>
            {wallet && !okWal && (
              <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
                Enter a valid base58 Solana address
              </div>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 6,
              }}
            >
              Step 3 — Transaction signature
            </div>
            <input
              value={txSig}
              onChange={(e) => {
                setTxSig(e.target.value.trim());
                reset?.();
              }}
              placeholder="Transaction signature (87–90 chars)"
              style={{
                width: "100%",
                background: "#0f0f0f",
                border: `1.5px solid ${txSig ? (okSig ? "#a3e63550" : "#f8717150") : "#1e1e1e"}`,
                borderRadius: 10,
                padding: "11px 13px",
                color: "#e4e4e4",
                fontSize: 12,
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {txSig && !okSig && (
              <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
                Enter a valid Solana transaction signature (87–90 chars)
              </div>
            )}
          </div>
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,.07)",
                border: "1px solid rgba(239,68,68,.22)",
                borderRadius: 11,
                padding: "11px 14px",
                fontSize: 12.5,
                color: "#fca5a5",
                lineHeight: 1.65,
              }}
            >
              ⚠️ {error}
            </div>
          )}
          <button
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
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: can
                ? "linear-gradient(135deg,#a3e635,#65a30d)"
                : "#1c1c1c",
              color: can ? "#061000" : "#333",
              fontWeight: 800,
              fontSize: 14,
              cursor: can ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? "Verifying…" : "Verify Solana Payment →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ManualCardanoInline ───────────────────────────────────────────────────────
function ManualCardanoInline({
  effectivePrice,
  onVerify,
  loading,
  error,
  reset,
}) {
  const [open, setOpen] = useState(false);
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
      const { connectWallet } =
        await import("../../services/auth/paymentService");
      const a = await connectWallet("CARDANO");
      setWallet(a);
      reset?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setFilling(false);
    }
  };

  const CopyAddr = ({ addr }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
      if (!addr) return;
      navigator.clipboard
        .writeText(addr)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    };
    if (!addr)
      return (
        <div
          style={{
            background: "#110900",
            border: "1px solid rgba(245,158,11,.22)",
            borderRadius: 11,
            padding: "10px 13px",
            fontSize: 12,
            color: "#fbbf24",
          }}
        >
          ⚠️ ADA treasury wallet not configured. Contact support.
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
            fontFamily: "monospace",
            wordBreak: "break-all",
            lineHeight: 1.5,
          }}
        >
          {addr}
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

  return (
    <div
      style={{ marginTop: 12, borderTop: "1px solid #1a1a1a", paddingTop: 12 }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent",
          border: "1px solid #252525",
          borderRadius: 8,
          color: "#666",
          fontSize: 11,
          padding: "6px 12px",
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: 600,
          width: "100%",
          textAlign: "left",
        }}
      >
        {open ? "▲ Hide" : "▼ Already sent? Enter transaction manually"}
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 12,
            animation: "xvFadeIn .2s",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 6,
              }}
            >
              Step 1 — Send to this Cardano address
            </div>
            <CopyAddr addr={treasury} />
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 6,
              }}
            >
              Step 2 — Your Cardano address (addr1…)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={wallet}
                onChange={(e) => {
                  setWallet(e.target.value.trim());
                  reset?.();
                }}
                placeholder="addr1… (Shelley address)"
                style={{
                  flex: 1,
                  background: "#0f0f0f",
                  border: `1.5px solid ${wallet ? (okWal ? "#a3e63550" : "#f8717150") : "#1e1e1e"}`,
                  borderRadius: 10,
                  padding: "11px 13px",
                  color: "#e4e4e4",
                  fontSize: 12,
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
              <button
                onClick={autoFill}
                disabled={filling}
                style={{
                  flexShrink: 0,
                  width: "auto",
                  padding: "0 14px",
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: 10,
                  color: "#888",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {filling ? "…" : "🦊 Auto-fill"}
              </button>
            </div>
            {wallet && !okWal && (
              <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
                Must be a valid Shelley address starting with addr1
              </div>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "#666",
                marginBottom: 6,
              }}
            >
              Step 3 — Transaction ID (TxHash)
            </div>
            <input
              value={txHash}
              onChange={(e) => {
                setTxHash(e.target.value.trim());
                reset?.();
              }}
              placeholder="64-character transaction ID"
              style={{
                width: "100%",
                background: "#0f0f0f",
                border: `1.5px solid ${txHash ? (okTx ? "#a3e63550" : "#f8717150") : "#1e1e1e"}`,
                borderRadius: 10,
                padding: "11px 13px",
                color: "#e4e4e4",
                fontSize: 12,
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {txHash && !okTx && (
              <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>
                Must be exactly 64 hex characters
              </div>
            )}
          </div>
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
            <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
            <span style={{ fontSize: 11.5, color: "#999", lineHeight: 1.65 }}>
              Send ~2% extra to account for ADA price movement between send and
              verify.
            </span>
          </div>
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,.07)",
                border: "1px solid rgba(239,68,68,.22)",
                borderRadius: 11,
                padding: "11px 14px",
                fontSize: 12.5,
                color: "#fca5a5",
                lineHeight: 1.65,
              }}
            >
              ⚠️ {error}
            </div>
          )}
          <button
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
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: can
                ? "linear-gradient(135deg,#a3e635,#65a30d)"
                : "#1c1c1c",
              color: can ? "#061000" : "#333",
              fontWeight: 800,
              fontSize: 14,
              cursor: can ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? "Verifying…" : "Verify Cardano Payment →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── [FIX-1] Helper: fetch product_id directly from payment_products ───────────
// Called as a last resort when platform_settings.product_id is null after
// all normal polling attempts. Returns a valid UUID v4 or null.
async function fetchProductIdFromPaymentProducts() {
  try {
    const { data, error } = await supabase
      .from("payment_products")
      .select("id, name, amount_usd")
      .eq("is_active", true)
      .order("amount_usd", { ascending: true })
      .limit(1);

    if (error || !data?.length) return null;
    return data[0].id ?? null;
  } catch {
    return null;
  }
}

// ── PaywallPayment ────────────────────────────────────────────────────────────
export default function PaywallPayment({
  user,
  paywallConfig,
  configLoading = false,
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
  isFreeAccess,
  isApprovedAccess,
  showPaystack,
  setShowPaystack,
  tab,
  setTab,
}) {
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteApplied, setInviteApplied] = useState(false);

  // EVM state
  const [evmChainIdx, setEvmChainIdx] = useState(0);
  const [evmWallet, setEvmWallet] = useState(null);
  const [evmTxHash, setEvmTxHash] = useState("");
  const [evmStep, setEvmStep] = useState("idle");
  const [evmMsg, setEvmMsg] = useState("");

  // Solana state
  const [solWallet, setSolWallet] = useState(null);
  const [solStep, setSolStep] = useState("idle");
  const [solMsg, setSolMsg] = useState("");
  const [solToken, setSolToken] = useState("USDC");

  // Cardano state
  const [adaWallet, setAdaWallet] = useState(null);
  const [adaStep, setAdaStep] = useState("idle");
  const [adaMsg, setAdaMsg] = useState("");

  // Paystack state
  const [psStep, setPsStep] = useState("idle");
  const [psMsg, setPsMsg] = useState("");

  // Manual Web3 state
  const [manualChain, setManualChain] = useState("polygon");
  const [manualChainType, setManualChainType] = useState("EVM");
  const [manualTxHash, setManualTxHash] = useState("");
  const [manualWallet, setManualWallet] = useState("");
  const [manualMode, setManualMode] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const productPrice = safePrice(paywallConfig?.product_price, 4);
  const effectivePrice = resolvePrice(inviteDetails, productPrice);
  const productId = paywallConfig?.product_id ?? null;

  // ── Auto-detect Paystack return on mount ─────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const returnPid = params.get("product_id");
    if (ref && returnPid) {
      verifyPaystackReturn(ref, returnPid);
    }
  }, []); // eslint-disable-line

  // ── Lazy wallet detection ─────────────────────────────────────────────────
  const evmDetected = useRef(false);
  const solDetected = useRef(false);
  const adaDetected = useRef(false);

  useEffect(() => {
    if (tab === "evm" && !evmDetected.current) {
      evmDetected.current = true;
      detectAvailableWallet()
        .then((w) => {
          if (w && mountedRef.current) setEvmWallet(w);
        })
        .catch(() => {});
    }
    if (tab === "solana" && !solDetected.current) {
      solDetected.current = true;
      detectSolanaWallet()
        .then((w) => {
          if (w && mountedRef.current) setSolWallet(w);
        })
        .catch(() => {});
    }
    if (tab === "cardano" && !adaDetected.current) {
      adaDetected.current = true;
      detectCardanoWallet()
        .then((w) => {
          if (w && mountedRef.current) setAdaWallet(w);
        })
        .catch(() => {});
    }
  }, [tab]);

  // ── Invite code apply ─────────────────────────────────────────────────────
  const handleApplyInvite = useCallback(async () => {
    const code = inviteInput.trim().toUpperCase();
    if (!code) {
      setInviteError("Enter an invite code");
      return;
    }
    setInviteLoading(true);
    setInviteError("");
    try {
      const details = await fetchInviteCodeDetails(code);
      if (!details) {
        setInviteError("Invalid or expired invite code");
        return;
      }
      if (details.status !== "active") {
        setInviteError("This invite code is no longer active");
        return;
      }
      setInviteDetails(details);
      setInviteApplied(true);
      setInviteError("");
    } catch (e) {
      setInviteError(e?.message ?? "Failed to apply invite code");
    } finally {
      setInviteLoading(false);
    }
  }, [inviteInput, setInviteDetails, setInviteLoading]);

  const handleRemoveInvite = useCallback(() => {
    setInviteDetails(null);
    setInviteApplied(false);
    setInviteInput("");
    setInviteError("");
  }, [setInviteDetails]);

  // ── [FIX-1] Paystack flow with payment_products fallback ──────────────────
  const handlePaystack = useCallback(async () => {
    let resolvedProductId = productId;

    // If productId not in props yet, poll platform_settings up to 5s
    if (!resolvedProductId) {
      setPsStep("loading");
      setPsMsg("Loading payment config…");
      for (let _w = 0; _w < 10; _w++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const { data: cfgRow } = await supabase
            .from("platform_settings")
            .select("value")
            .eq("key", "paywall_config")
            .maybeSingle();
          resolvedProductId = cfgRow?.value?.product_id ?? null;
          if (resolvedProductId) break;
        } catch {
          /* keep waiting */
        }
      }
    }

    // [FIX-1] Final fallback: query payment_products directly.
    // This handles the case where platform_settings.product_id is null
    // even though a product exists in the payment_products table.
    if (!resolvedProductId) {
      setPsMsg("Resolving payment product…");
      resolvedProductId = await fetchProductIdFromPaymentProducts();
      if (resolvedProductId) {
        console.log(
          "[PaywallPayment] Resolved product_id from payment_products:",
          resolvedProductId,
        );
      }
    }

    if (!resolvedProductId) {
      setPsStep("error");
      setPsMsg(
        "No active payment product found. Please contact support or refresh the page.",
      );
      return;
    }

    setPsStep("loading");
    setPsMsg("Initializing payment…");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email ?? user?.email ?? "";
      if (!email)
        throw new Error("No email on account. Please update your profile.");

      getOrCreateIdempotencyKey();

      const result = await createPaystackTransaction({
        productId: resolvedProductId,
        amountUSD: effectivePrice,
        inviteCodeId: inviteDetails?.id ?? null,
        email,
      });

      if (!result?.authorization_url)
        throw new Error("No payment URL returned from server");

      setPsStep("redirect");
      setPsMsg("Redirecting to payment page…");

      window.location.href = result.authorization_url;
    } catch (e) {
      setPsStep("error");
      setPsMsg(e?.message ?? "Payment initialization failed");
    }
  }, [user, productId, effectivePrice, inviteDetails]);

  // ── Paystack return verification ──────────────────────────────────────────
  const verifyPaystackReturn = useCallback(
    async (reference, returnProductId) => {
      setPsStep("verifying");
      setTab("paystack");
      setPsMsg("Verifying your payment…");

      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("ref");
        url.searchParams.delete("product_id");
        window.history.replaceState({}, "", url.toString());
      } catch {}

      try {
        await new Promise((r) => setTimeout(r, 3000));
        await onVerify({
          _paystackReturn: true,
          reference,
          productId: returnProductId,
        });
        setPsStep("done");
        setPsMsg("Payment confirmed! Activating your account…");
      } catch (e) {
        setPsStep("error");
        setPsMsg(
          "Payment received but activation is pending. Please refresh in a moment.",
        );
      }
    },
    [onVerify, setTab],
  );

  // ── EVM Smart Pay ─────────────────────────────────────────────────────────
  const handleEvmSmartPay = useCallback(async () => {
    setEvmStep("connecting");
    setEvmMsg("Connecting wallet…");
    try {
      const chain = EVM_CHAINS[evmChainIdx];
      const address = await connectWallet("EVM");
      setEvmWallet({ address, label: "EVM Wallet", connected: true });
      setEvmStep("sending");
      setEvmMsg(`Sending $${fmt(effectivePrice)} on ${chain.name}…`);

      const { requestWalletPayment } =
        await import("../../services/auth/paymentService");
      const result = await requestWalletPayment({
        productId,
        amountUSD: effectivePrice,
        chainId: chain.chainId,
        chainName: chain.id,
        tokenAddress: chain.tokenAddress,
        tokenDecimals: chain.decimals,
        onStep: ({ message }) => setEvmMsg(message),
      });

      if (result?.success) {
        setEvmStep("done");
        setEvmMsg("Payment confirmed! Activating account…");
        await onSmartPaySuccess(result);
        await onVerify({
          chainType: "EVM",
          chain: chain.id,
          txHash: result.txHash,
          claimedSenderWallet: address,
          productId,
          amountOverrideUSD: effectivePrice,
          inviteCodeId: inviteDetails?.id ?? null,
        });
      } else if (result?.pending) {
        setEvmStep("idle");
        setEvmMsg(
          result.message ??
            "Transaction pending confirmation. We'll activate your account once confirmed.",
        );
      }
    } catch (e) {
      setEvmStep("error");
      setEvmMsg(e?.message ?? "Transaction failed");
    }
  }, [
    evmChainIdx,
    effectivePrice,
    productId,
    inviteDetails,
    onVerify,
    onSmartPaySuccess,
  ]);

  // ── EVM Manual verify ─────────────────────────────────────────────────────
  const handleEvmManualVerify = useCallback(async () => {
    if (!evmTxHash.trim() || !evmWallet?.address) {
      setEvmMsg("Enter your transaction hash and connect your wallet first");
      return;
    }
    setEvmStep("verifying");
    setEvmMsg("Verifying transaction…");
    try {
      const chain = EVM_CHAINS[evmChainIdx];
      await onVerify({
        chainType: "EVM",
        chain: chain.id,
        txHash: evmTxHash.trim(),
        claimedSenderWallet: evmWallet.address,
        productId,
        amountOverrideUSD: effectivePrice,
        inviteCodeId: inviteDetails?.id ?? null,
      });
      setEvmStep("done");
      setEvmMsg("Verified! Account activating…");
    } catch (e) {
      setEvmStep("error");
      setEvmMsg(e?.message ?? "Verification failed");
    }
  }, [
    evmTxHash,
    evmWallet,
    evmChainIdx,
    effectivePrice,
    productId,
    inviteDetails,
    onVerify,
  ]);

  // ── Solana Smart Pay ──────────────────────────────────────────────────────
  const handleSolanaPay = useCallback(async () => {
    setSolStep("connecting");
    setSolMsg("Connecting Solana wallet…");
    try {
      const conn = await connectSolanaWallet();
      setSolWallet({
        address: conn.address,
        connected: true,
        label: "Solana Wallet",
      });
      setSolStep("sending");
      setSolMsg(`Sending $${fmt(effectivePrice)} USDC on Solana…`);

      const { requestSolanaPayment } =
        await import("../../services/auth/paymentService");
      const result = await requestSolanaPayment({
        productId,
        amountUSD: effectivePrice,
        tokenSymbol: "USDC",
        onStep: ({ message }) => setSolMsg(message),
      });

      if (result?.success) {
        setSolStep("done");
        setSolMsg("Solana payment confirmed! Activating account…");
        await onVerify({
          chainType: "SOLANA",
          chain: "solana",
          txHash: result.txHash,
          claimedSenderWallet: conn.address,
          productId,
          amountOverrideUSD: effectivePrice,
          inviteCodeId: inviteDetails?.id ?? null,
        });
      }
    } catch (e) {
      setSolStep("error");
      setSolMsg(e?.message ?? "Solana payment failed");
    }
  }, [effectivePrice, productId, inviteDetails, onVerify]);

  // ── Cardano Smart Pay ─────────────────────────────────────────────────────
  const handleCardanoPay = useCallback(async () => {
    setAdaStep("connecting");
    setAdaMsg("Connecting Cardano wallet…");
    try {
      const conn = await connectCardanoWalletCIP30();
      setAdaWallet({
        address: conn.address,
        connected: true,
        label: "Cardano Wallet",
      });
      setAdaStep("sending");
      setAdaMsg(`Sending $${fmt(effectivePrice)} in ADA…`);

      const { requestCardanoPayment } =
        await import("../../services/auth/paymentService");
      const result = await requestCardanoPayment({
        productId,
        amountUSD: effectivePrice,
        onStep: ({ message }) => setAdaMsg(message),
      });

      if (result?.success) {
        setAdaStep("done");
        setAdaMsg("Cardano payment confirmed! Activating account…");
        await onVerify({
          chainType: "CARDANO",
          chain: "cardano",
          txHash: result.txHash,
          claimedSenderWallet: conn.address,
          productId,
          amountOverrideUSD: effectivePrice,
          inviteCodeId: inviteDetails?.id ?? null,
        });
      }
    } catch (e) {
      setAdaStep("error");
      setAdaMsg(e?.message ?? "Cardano payment failed");
    }
  }, [effectivePrice, productId, inviteDetails, onVerify]);

  // ── Manual Web3 verify ────────────────────────────────────────────────────
  const handleManualVerify = useCallback(async () => {
    if (!manualTxHash.trim() || !manualWallet.trim()) {
      resetVerify();
      return;
    }
    await onVerify({
      chainType: manualChainType,
      chain: manualChain,
      txHash: manualTxHash.trim(),
      claimedSenderWallet: manualWallet.trim(),
      productId,
      amountOverrideUSD: effectivePrice,
      inviteCodeId: inviteDetails?.id ?? null,
    });
  }, [
    manualTxHash,
    manualWallet,
    manualChain,
    manualChainType,
    productId,
    effectivePrice,
    inviteDetails,
    onVerify,
    resetVerify,
  ]);

  const showFreeButton =
    (isFreeAccess || isApprovedAccess) && inviteDetails?.id;

  // ── Render ────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: "#141414",
    border: "1px solid #1e1e1e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  };
  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: "#555",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: 8,
    display: "block",
  };
  const inputStyle = {
    width: "100%",
    background: "#0e0e0e",
    border: "1.5px solid #232323",
    borderRadius: 11,
    padding: "12px 14px",
    color: "#f0f0f0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    outline: "none",
    boxSizing: "border-box",
    caretColor: "#a3e635",
  };
  const btnLime = {
    width: "100%",
    padding: "15px 20px",
    borderRadius: 13,
    border: "none",
    background: "linear-gradient(135deg,#a3e635,#65a30d)",
    color: "#061000",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 20px rgba(163,230,53,.3)",
  };
  const btnOutline = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1.5px solid rgba(163,230,53,.3)",
    background: "rgba(163,230,53,.05)",
    color: "#a3e635",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  };
  const btnGray = {
    ...btnOutline,
    border: "1.5px solid #2a2a2a",
    background: "transparent",
    color: "#666",
    marginTop: 0,
  };

  const stepMsg = (msg, step, resetFn, retryFn) => (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          background:
            step === "error" ? "rgba(239,68,68,.06)" : "rgba(163,230,53,.04)",
          border: `1px solid ${step === "error" ? "rgba(239,68,68,.2)" : "rgba(163,230,53,.12)"}`,
          borderRadius: 10,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {step !== "error" && step !== "done" && (
          <Spin size={14} color={step === "error" ? "#f87171" : "#a3e635"} />
        )}
        {step === "done" && <span style={{ color: "#a3e635" }}>✓</span>}
        {step === "error" && <span style={{ color: "#f87171" }}>✕</span>}
        <span
          style={{
            fontSize: 12,
            color: step === "error" ? "#f87171" : "#a3e635",
            lineHeight: 1.5,
          }}
        >
          {msg}
        </span>
      </div>
      {step === "error" && retryFn && (
        <button
          style={{ ...btnGray, marginTop: 8 }}
          onClick={() => {
            resetFn();
            retryFn();
          }}
        >
          Try again
        </button>
      )}
    </div>
  );

  return (
    <div>
      {/* ── Invite Code Section ─────────────────────────────────────────── */}
      <div style={cardStyle}>
        <span style={labelStyle}>🎫 Invite Code</span>
        {inviteApplied && inviteDetails ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(163,230,53,.06)",
              border: "1px solid rgba(163,230,53,.2)",
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#a3e635" }}>
                {inviteDetails.code}
              </div>
              <div style={{ fontSize: 10, color: "#5a7a35", marginTop: 2 }}>
                {resolvePrice(inviteDetails, productPrice) === 0
                  ? "Free access unlocked"
                  : `$${fmt(resolvePrice(inviteDetails, productPrice))} entry price`}
              </div>
            </div>
            <button
              onClick={handleRemoveInvite}
              style={{
                background: "transparent",
                border: "none",
                color: "#555",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="ENTER CODE"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleApplyInvite()}
            />
            <button
              onClick={handleApplyInvite}
              disabled={inviteLoading}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: inviteLoading ? "#1c1c1c" : "rgba(163,230,53,.15)",
                color: inviteLoading ? "#444" : "#a3e635",
                fontWeight: 700,
                fontSize: 12,
                cursor: inviteLoading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              {inviteLoading ? <Spin size={14} /> : "Apply"}
            </button>
          </div>
        )}
        {inviteError && (
          <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>
            {inviteError}
          </div>
        )}
      </div>

      {/* ── Free Access Button ────────────────────────────────────────────── */}
      {showFreeButton && (
        <div style={{ marginBottom: 12 }}>
          <button
            style={{ ...btnLime, opacity: freeActivating ? 0.7 : 1 }}
            onClick={() => onFreeActivate(inviteDetails?.code)}
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

      {/* ── Payment tabs ─────────────────────────────────────────────────── */}
      {!showFreeButton && (
        <>
          <div
            style={{
              display: "flex",
              gap: 3,
              background: "#0d0d0d",
              border: "1px solid #1a1a1a",
              borderRadius: 14,
              padding: 4,
              marginBottom: 16,
            }}
          >
            {[
              { key: "paystack", label: "💳 Card / Bank", color: "#38bdf8" },
              { key: "evm", label: "⛓ EVM", color: "#a3e635" },
              { key: "solana", label: "◎ Solana", color: "#9945ff" },
              { key: "cardano", label: "₳ Cardano", color: "#0057ff" },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  borderRadius: 10,
                  border: "none",
                  background:
                    tab === key ? "rgba(255,255,255,.04)" : "transparent",
                  color: tab === key ? color : "#555",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all .18s",
                  boxShadow:
                    tab === key ? `inset 0 0 0 1.5px ${color}30` : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Paystack Tab ─────────────────────────────────────────────── */}
          {tab === "paystack" && (
            <div style={cardStyle}>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#e0e0e0",
                    marginBottom: 4,
                  }}
                >
                  Pay with Card or Bank Transfer
                </div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6 }}>
                  Powered by Paystack · Visa, Mastercard, bank transfer, USSD
                </div>
              </div>

              <div
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1e1e1e",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#666" }}>Amount</span>
                <span
                  style={{ fontSize: 18, fontWeight: 900, color: "#a3e635" }}
                >
                  ${fmt(effectivePrice)}
                </span>
              </div>

              {psStep === "idle" && (
                <button
                  style={{ ...btnLime, opacity: configLoading ? 0.6 : 1 }}
                  onClick={handlePaystack}
                  disabled={configLoading}
                >
                  {configLoading
                    ? "Loading…"
                    : `💳 Pay $${fmt(effectivePrice)} with Paystack →`}
                </button>
              )}
              {psStep === "loading" &&
                stepMsg(psMsg, "loading", () => setPsStep("idle"), null)}
              {psStep === "redirect" &&
                stepMsg(
                  "Redirecting to Paystack…",
                  "loading",
                  () => setPsStep("idle"),
                  null,
                )}
              {psStep === "verifying" &&
                stepMsg(
                  "Verifying your payment…",
                  "loading",
                  () => setPsStep("idle"),
                  null,
                )}
              {psStep === "done" &&
                stepMsg(
                  "Payment confirmed! Welcome to Xeevia ✓",
                  "done",
                  () => setPsStep("idle"),
                  null,
                )}
              {psStep === "error" &&
                stepMsg(
                  psMsg,
                  "error",
                  () => setPsStep("idle"),
                  handlePaystack,
                )}

              {psStep === "idle" && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 10,
                    color: "#3a3a3a",
                    textAlign: "center",
                    lineHeight: 1.6,
                  }}
                >
                  🔒 Secured by Paystack · No card details stored on our servers
                </div>
              )}
            </div>
          )}

          {/* ── EVM Tab ──────────────────────────────────────────────────── */}
          {tab === "evm" && (
            <div style={cardStyle}>
              <div style={{ marginBottom: 14 }}>
                <span style={labelStyle}>Chain & Token</span>
                <select
                  style={{
                    width: "100%",
                    appearance: "none",
                    background: "#0e0e0e",
                    border: "1.5px solid #252525",
                    borderRadius: 11,
                    color: "#e8e8e8",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "11px 14px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  value={evmChainIdx}
                  onChange={(e) => setEvmChainIdx(Number(e.target.value))}
                >
                  {EVM_CHAINS.map((c, i) => (
                    <option key={i} value={i} style={{ background: "#141414" }}>
                      {c.name} — {c.token}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1e1e1e",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#666" }}>Amount</span>
                <span
                  style={{ fontSize: 18, fontWeight: 900, color: "#a3e635" }}
                >
                  ${fmt(effectivePrice)} {EVM_CHAINS[evmChainIdx]?.token}
                </span>
              </div>

              {evmWallet?.address && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#4a5a4a",
                    marginBottom: 10,
                    fontFamily: "monospace",
                  }}
                >
                  Wallet: {evmWallet.address.slice(0, 8)}…
                  {evmWallet.address.slice(-6)}
                </div>
              )}

              {evmStep === "idle" && (
                <>
                  <button style={btnLime} onClick={handleEvmSmartPay}>
                    ⚡ Smart Pay — auto send & verify →
                  </button>
                  <button
                    style={btnGray}
                    onClick={() => setManualMode(!manualMode)}
                  >
                    {manualMode ? "Hide" : "Manual"} — already sent? enter tx
                    hash
                  </button>
                </>
              )}
              {evmStep !== "idle" &&
                stepMsg(
                  evmMsg,
                  evmStep,
                  () => setEvmStep("idle"),
                  handleEvmSmartPay,
                )}

              {manualMode && evmStep === "idle" && (
                <div style={{ marginTop: 12 }}>
                  <input
                    style={{ ...inputStyle, marginBottom: 8 }}
                    placeholder="Transaction hash (0x...)"
                    value={evmTxHash}
                    onChange={(e) => setEvmTxHash(e.target.value)}
                  />
                  {!evmWallet?.address && (
                    <button
                      style={{ ...btnGray, marginBottom: 8 }}
                      onClick={() =>
                        connectWallet("EVM")
                          .then((a) =>
                            setEvmWallet({ address: a, connected: true }),
                          )
                          .catch(() => {})
                      }
                    >
                      Connect wallet to verify
                    </button>
                  )}
                  <button
                    style={btnOutline}
                    onClick={handleEvmManualVerify}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <>
                        <Spin size={14} /> Verifying…
                      </>
                    ) : (
                      "Verify transaction →"
                    )}
                  </button>
                  {verifyError && (
                    <div
                      style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}
                    >
                      {verifyError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Solana Tab ───────────────────────────────────────────────── */}
          {tab === "solana" && (
            <div style={cardStyle}>
              <div
                style={{
                  marginBottom: 14,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#e0e0e0",
                }}
              >
                Pay with Solana
              </div>
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "#666",
                    marginBottom: 6,
                  }}
                >
                  Token
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["USDC", "USDT"].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => setSolToken(sym)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: 9,
                        border: `1.5px solid ${solToken === sym ? "#9945ff" : "#1e1e1e"}`,
                        background:
                          solToken === sym ? "rgba(153,69,255,.1)" : "#111",
                        color: solToken === sym ? "#c084fc" : "#555",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1e1e1e",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#666" }}>Amount</span>
                <span
                  style={{ fontSize: 18, fontWeight: 900, color: "#9945ff" }}
                >
                  ${fmt(effectivePrice)} {solToken}
                </span>
              </div>
              {solWallet?.address && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#4a3a6a",
                    marginBottom: 10,
                    fontFamily: "monospace",
                  }}
                >
                  Wallet: {solWallet.address.slice(0, 8)}…
                  {solWallet.address.slice(-6)}
                </div>
              )}
              {solStep === "idle" && (
                <button
                  style={{
                    ...btnLime,
                    background: "linear-gradient(135deg,#9945ff,#7c3aed)",
                    boxShadow: "0 4px 20px rgba(153,69,255,.3)",
                    marginBottom: 8,
                  }}
                  onClick={handleSolanaPay}
                >
                  ◎ Smart Pay with Solana →
                </button>
              )}
              {solStep !== "idle" &&
                stepMsg(
                  solMsg,
                  solStep,
                  () => setSolStep("idle"),
                  handleSolanaPay,
                )}
              <ManualSolanaInline
                effectivePrice={effectivePrice}
                solToken={solToken}
                onVerify={onVerify}
                loading={verifying}
                error={verifyError}
                reset={resetVerify}
              />
            </div>
          )}

          {/* ── Cardano Tab ──────────────────────────────────────────────── */}
          {tab === "cardano" && (
            <div style={cardStyle}>
              <div
                style={{
                  marginBottom: 14,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#e0e0e0",
                }}
              >
                Pay with Cardano (ADA)
              </div>
              <div
                style={{
                  background: "rgba(0,51,173,.06)",
                  border: "1px solid rgba(0,51,173,.2)",
                  borderRadius: 12,
                  padding: "11px 14px",
                  marginBottom: 14,
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
                  . ADA/USD rate is fetched at verify time. Send ~2% extra to
                  cover price movement.
                </span>
              </div>
              {adaWallet?.address && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#1a2a4a",
                    marginBottom: 10,
                    fontFamily: "monospace",
                  }}
                >
                  Wallet: {adaWallet.address.slice(0, 10)}…
                </div>
              )}
              {adaStep === "idle" && (
                <button
                  style={{
                    ...btnLime,
                    background: "linear-gradient(135deg,#0033ad,#0057ff)",
                    boxShadow: "0 4px 20px rgba(0,51,173,.3)",
                    marginBottom: 8,
                  }}
                  onClick={handleCardanoPay}
                >
                  ₳ Smart Pay with Cardano →
                </button>
              )}
              {adaStep !== "idle" &&
                stepMsg(
                  adaMsg,
                  adaStep,
                  () => setAdaStep("idle"),
                  handleCardanoPay,
                )}
              <ManualCardanoInline
                effectivePrice={effectivePrice}
                onVerify={onVerify}
                loading={verifying}
                error={verifyError}
                reset={resetVerify}
              />
            </div>
          )}

          {/* ── Price summary ─────────────────────────────────────────────── */}
          {!showFreeButton && (
            <div
              style={{
                fontSize: 10,
                color: "#3a3a3a",
                textAlign: "center",
                lineHeight: 1.7,
                padding: "8px 0",
              }}
            >
              One-time payment · Lifetime access · ${fmt(effectivePrice)} USD
              {inviteDetails && effectivePrice < productPrice && (
                <span style={{ color: "#a3e635", marginLeft: 6 }}>
                  (invite price — ${fmt(productPrice - effectivePrice)} off)
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}