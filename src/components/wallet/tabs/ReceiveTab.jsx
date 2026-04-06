// src/components/wallet/tabs/ReceiveTab.jsx
// ════════════════════════════════════════════════════════════════
// RECEIVE TAB — Real on-chain wallet addresses from wallet_addresses
// table. Supports EVM, Cardano, Solana, Tron.
// Addresses are generated on first use and persisted.
// EP cannot be received on-chain — EP is internal only.
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Copy, CheckCircle, Shield, Zap,
  QrCode, RefreshCw, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../Auth/AuthContext";
import { walletService } from "../../../services/wallet/walletService";

// ── Chain config ──────────────────────────────────────────────────
const CHAIN_CONFIG = [
  {
    id:       "cardano",
    label:    "Cardano",
    symbol:   "ADA / CNT",
    icon:     "🔷",
    color:    "#0033ad",
    dim:      "rgba(0,51,173,0.1)",
    ring:     "rgba(0,51,173,0.35)",
    note:     "Receive ADA and Cardano Native Tokens (CNT). 1–3 confirmations.",
    explorer: "https://cardanoscan.io/address/",
    primary:  true,
  },
  {
    id:       "evm",
    label:    "Ethereum / EVM",
    symbol:   "ETH / USDT / ERC-20",
    icon:     "⟠",
    color:    "#627eea",
    dim:      "rgba(98,126,234,0.1)",
    ring:     "rgba(98,126,234,0.35)",
    note:     "Receive ETH, USDT, and any ERC-20 token on Ethereum, BNB Chain, Polygon.",
    explorer: "https://etherscan.io/address/",
    primary:  false,
  },
  {
    id:       "solana",
    label:    "Solana",
    symbol:   "SOL / SPL",
    icon:     "◎",
    color:    "#9945ff",
    dim:      "rgba(153,69,255,0.1)",
    ring:     "rgba(153,69,255,0.35)",
    note:     "Receive SOL and SPL tokens. Near-instant finality.",
    explorer: "https://solscan.io/account/",
    primary:  false,
  },
  {
    id:       "tron",
    label:    "Tron",
    symbol:   "TRX / USDT TRC-20",
    icon:     "🔴",
    color:    "#ef0027",
    dim:      "rgba(239,0,39,0.08)",
    ring:     "rgba(239,0,39,0.28)",
    note:     "Receive TRX and USDT (TRC-20). Low fees.",
    explorer: "https://tronscan.org/#/address/",
    primary:  false,
  },
];

const CSS = `
.rcv-shell {
  color: #edf1fa;
  padding-bottom: 50px;
}

/* ── Chain selector tabs ── */
.rcv-chain-bar {
  display: flex;
  gap: 7px;
  padding: 0 20px 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.rcv-chain-bar::-webkit-scrollbar { display: none; }

.rcv-chain-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 11px 16px;
  border-radius: 13px;
  flex-shrink: 0;
  border: 1.5px solid #252c3d;
  background: #11141d;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
  min-width: 72px;
  position: relative;
}
.rcv-chain-btn:hover { background: #181d2a; border-color: #303852; }
.rcv-chain-btn.on { background: rgba(0,51,173,0.08); border-color: rgba(0,51,173,0.42); }
.rcv-chain-em { font-size: 20px; line-height: 1; }
.rcv-chain-lb { font-size: 11px; font-weight: 700; color: #68748e; }
.rcv-chain-btn.on .rcv-chain-lb { color: #627eea; }
.rcv-chain-primary-badge {
  position: absolute;
  top: -5px; right: -5px;
  padding: 1px 5px;
  border-radius: 100px;
  font-size: 8px; font-weight: 800;
  background: #0033ad; color: #fff;
  letter-spacing: .06em;
}

/* ── Address card ── */
.rcv-addr-card {
  margin: 0 20px 14px;
  border-radius: 14px;
  border: 1.5px solid #252c3d;
  background: #11141d;
  overflow: hidden;
}
.rcv-addr-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 15px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.rcv-chain-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.rcv-chain-name { font-size: 14px; font-weight: 800; color: #edf1fa; }
.rcv-chain-sym  { font-size: 11px; color: #68748e; margin-top: 2px; }

.rcv-addr-body { padding: 14px 15px; }
.rcv-addr-lbl {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #3c4460;
  margin-bottom: 10px;
  font-family: 'DM Mono', monospace;
}
.rcv-addr-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.rcv-addr-text {
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 12.5px;
  color: rgba(255,255,255,0.72);
  word-break: break-all;
  line-height: 1.6;
  flex: 1;
}
.rcv-addr-loading {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.2);
  animation: rcvPulse 1.4s ease-in-out infinite;
}
@keyframes rcvPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.rcv-copy-btn {
  width: 36px; height: 36px;
  border-radius: 9px;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.09);
  color: rgba(255,255,255,0.35);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: all .18s;
  margin-top: 2px;
}
.rcv-copy-btn:hover  { background: rgba(163,230,53,.1); border-color: rgba(163,230,53,.35); color: #a3e635; }
.rcv-copy-btn.ok { background: rgba(34,197,94,.1);  border-color: rgba(34,197,94,.35);  color: #22c55e; }

.rcv-addr-note {
  margin-top: 10px;
  font-size: 11.5px;
  color: rgba(255,255,255,0.25);
  line-height: 1.65;
}
.rcv-warn {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 13px;
  border-radius: 9px;
  margin-top: 11px;
  background: rgba(248,114,114,0.06);
  border: 1px solid rgba(248,114,114,0.18);
  font-size: 11px;
  color: #f87272;
  line-height: 1.6;
}
.rcv-explorer-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: #68748e;
  cursor: pointer;
  transition: color .15s;
  background: none; border: none; font-family: inherit; padding: 0;
}
.rcv-explorer-link:hover { color: #a3e635; }

/* ── QR section ── */
.rcv-qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 20px 16px;
  gap: 10px;
}
.rcv-qr-frame {
  width: 148px; height: 148px;
  border-radius: 16px;
  border: 1.5px solid rgba(163,230,53,0.2);
  background: rgba(255,255,255,0.03);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  box-shadow: 0 0 0 4px rgba(163,230,53,0.04), 0 8px 32px rgba(0,0,0,.4);
}
.rcv-qr-frame::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 17px;
  background: linear-gradient(135deg, rgba(163,230,53,0.25), transparent 50%, rgba(34,211,238,0.15));
  z-index: -1;
}
.rcv-qr-label {
  font-size: 11px;
  color: rgba(255,255,255,0.28);
  font-family: 'DM Mono', monospace;
  text-align: center;
}

/* ── Platform username card ── */
.rcv-username-card {
  margin: 0 20px 14px;
  background: rgba(163,230,53,0.03);
  border: 1.5px solid rgba(163,230,53,0.14);
  border-radius: 14px;
  padding: 14px 15px;
}

/* ── Info boxes ── */
.rcv-info {
  margin: 0 20px 12px;
  padding: 13px 15px;
  border-radius: 12px;
  display: flex; gap: 12px; align-items: flex-start;
  font-size: 12px; line-height: 1.6;
}
.rcv-info.cyan {
  background: rgba(34,211,238,0.05);
  border: 1px solid rgba(34,211,238,0.18);
}
.rcv-info.amber {
  background: rgba(245,158,11,0.05);
  border: 1px solid rgba(245,158,11,0.18);
}
.rcv-info.ep {
  background: rgba(163,230,53,0.04);
  border: 1px solid rgba(163,230,53,0.15);
}
.rcv-info svg { flex-shrink: 0; margin-top: 1px; }
.rcv-info h4 { font-size: 12.5px; font-weight: 700; margin: 0 0 3px; }
.rcv-info.cyan  h4 { color: #22d3ee; }
.rcv-info.amber h4 { color: #f59e0b; }
.rcv-info.ep    h4 { color: #a3e635; }
.rcv-info p { margin: 0; color: rgba(255,255,255,0.35); }

/* ── Refresh button ── */
.rcv-refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.3);
  font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: all .15s;
  margin: 0 auto 4px;
}
.rcv-refresh-btn:hover { border-color: rgba(163,230,53,0.25); color: #a3e635; }
@keyframes rcvSpin { to { transform: rotate(360deg); } }
.rcv-spinning { animation: rcvSpin .8s linear infinite; }

/* ── EP internal badge ── */
.rcv-ep-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 100px;
  background: rgba(34,211,238,0.08);
  border: 1px solid rgba(34,211,238,0.22);
  font-size: 9px; font-weight: 800;
  color: #22d3ee;
  letter-spacing: .08em;
  margin-left: 6px;
}
`;

const ReceiveTab = ({ setActiveTab, userId }) => {
  const { profile } = useAuth();
  const [activeChain,  setActiveChain]  = useState("cardano");
  const [addresses,    setAddresses]    = useState({});
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [copied,       setCopied]       = useState(null); // key = 'username' | chain id
  const [copiedUser,   setCopiedUser]   = useState(false);

  const username = profile?.username || "yourhandle";
  const chain    = CHAIN_CONFIG.find((c) => c.id === activeChain) || CHAIN_CONFIG[0];

  // ── Load all addresses ────────────────────────────────────────
  const loadAddresses = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      // Load existing stored addresses
      const stored = await walletService.getAllAddresses(userId);
      setAddresses(stored);

      // Generate any missing chain addresses
      const missing = CHAIN_CONFIG.filter((c) => !stored[c.id]);
      if (missing.length > 0) {
        const generated = {};
        await Promise.all(
          missing.map(async (c) => {
            const addr = await walletService.getOrCreateAddress(userId, c.id);
            generated[c.id] = addr;
          })
        );
        setAddresses((prev) => ({ ...prev, ...generated }));
      }
    } catch (err) {
      console.error("[ReceiveTab] loadAddresses error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAddresses();
    setRefreshing(false);
  };

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2400);
    } catch {}
  };

  const currentAddress = addresses[activeChain];

  return (
    <div className="rcv-shell view-enter">
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="view-title">Receive</div>
          <div className="view-subtitle">Share your address to receive $XEV</div>
        </div>
      </div>

      {/* ── QR Code ── */}
      <div className="rcv-qr-section">
        <div className="rcv-qr-frame">
          <QrCode size={96} strokeWidth={1} color={chain.color + "cc"} />
        </div>
        <div className="rcv-qr-label">
          Scan to send {chain.symbol} to this wallet
        </div>
      </div>

      {/* ── Chain selector ── */}
      <div className="rcv-chain-bar">
        {CHAIN_CONFIG.map((c) => (
          <button
            key={c.id}
            className={`rcv-chain-btn${activeChain === c.id ? " on" : ""}`}
            style={activeChain === c.id ? {
              background: c.dim,
              borderColor: c.ring,
            } : {}}
            onClick={() => setActiveChain(c.id)}
          >
            {c.primary && <span className="rcv-chain-primary-badge">PRIMARY</span>}
            <span className="rcv-chain-em">{c.icon}</span>
            <span className="rcv-chain-lb" style={activeChain === c.id ? { color: c.color } : {}}>
              {c.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Chain address card ── */}
      <div className="rcv-addr-card">
        <div className="rcv-addr-head">
          <div className="rcv-chain-icon" style={{ background: chain.dim }}>
            {chain.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div className="rcv-chain-name">{chain.label}</div>
            <div className="rcv-chain-sym">{chain.symbol}</div>
          </div>
          <button className="rcv-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={12} className={refreshing ? "rcv-spinning" : ""} />
            {refreshing ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="rcv-addr-body">
          <div className="rcv-addr-lbl">Your {chain.label} Address</div>

          {loading ? (
            <div className="rcv-addr-loading">Generating address…</div>
          ) : (
            <>
              <div className="rcv-addr-row">
                <code className="rcv-addr-text">
                  {currentAddress || "Address not available"}
                </code>
                <button
                  className={`rcv-copy-btn${copied === activeChain ? " ok" : ""}`}
                  onClick={() => currentAddress && copyText(currentAddress, activeChain)}
                  disabled={!currentAddress}
                >
                  {copied === activeChain
                    ? <CheckCircle size={15} />
                    : <Copy size={15} />
                  }
                </button>
              </div>

              {currentAddress && (
                <button
                  className="rcv-explorer-link"
                  onClick={() => window.open(chain.explorer + currentAddress, "_blank")}
                >
                  View on explorer <ExternalLink size={10} />
                </button>
              )}
            </>
          )}

          <div className="rcv-addr-note">{chain.note}</div>

          <div className="rcv-warn">
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Only send <strong>{chain.symbol}</strong> to this address.
              Sending unsupported tokens to the wrong network results in{" "}
              <strong>permanent loss of funds.</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Platform username card ── */}
      <div className="rcv-username-card">
        <div className="rcv-addr-lbl">Platform Username (EP &amp; $XEV — Internal)</div>
        <div className="rcv-addr-row">
          <span className="rcv-addr-text" style={{ color: "#a3e635" }}>
            @{username}
          </span>
          <button
            className={`rcv-copy-btn${copiedUser ? " ok" : ""}`}
            onClick={() => { copyText(`@${username}`, "username"); setCopiedUser(true); setTimeout(() => setCopiedUser(false), 2400); }}
          >
            {copiedUser ? <CheckCircle size={15} /> : <Copy size={15} />}
          </button>
        </div>
        <div className="rcv-addr-note">
          Xeevia users can send $XEV or EP directly to your username — instant, free, no confirmations.
          <span className="rcv-ep-badge">INTERNAL ONLY</span>
        </div>
      </div>

      {/* ── Info boxes ── */}
      <div className="rcv-info cyan">
        <Shield size={16} color="#22d3ee" />
        <div>
          <h4>Secure &amp; Non-Custodial</h4>
          <p>
            Your on-chain addresses are derived from your account and stored securely.
            Internal transfers (username) are instant and free.
            On-chain deposits require 1–3 confirmations before $XEV is credited.
          </p>
        </div>
      </div>

      <div className="rcv-info amber">
        <Zap size={16} color="#f59e0b" />
        <div>
          <h4>EP is earned, not received on-chain</h4>
          <p>
            EP accumulates from social engagement — likes, shares, comments, gifts.
            You also earn 1 EP per ₦1 deposited. EP lives only inside Xeevia.
          </p>
        </div>
      </div>

      <div className="rcv-info ep">
        <div style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🔷</div>
        <div>
          <h4>Cardano is our primary chain</h4>
          <p>
            $XEV is being built on Cardano. Use your Cardano address above for the best experience.
            EVM, Solana and Tron addresses support USDT and other tokens during the pre-launch phase.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReceiveTab;