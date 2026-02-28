// src/components/Account/ConnectedWalletsSection.jsx — v1 NEW
// ─────────────────────────────────────────────────────────────────────────────
//  Shows all wallets a user has connected through Smart Pay.
//  Also allows manual add / disconnect of any wallet.
//  Lives inside the Account section (e.g. alongside ProfileSection + SettingsSection).
//  Connected wallets are saved to the `connected_wallets` table via saveConnectedWallet().
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../Auth/AuthContext";
import { supabase, detectAvailableWallet, detectSolanaWallet, detectCardanoWallet, saveConnectedWallet } from "../../services/auth/paymentService";

const ECOSYSTEM_META = {
  EVM:     { label: "EVM",     icon: "🔗", color: "#a3e635", bg: "rgba(163,230,53,.08)",  border: "rgba(163,230,53,.2)"  },
  SOLANA:  { label: "Solana",  icon: "◎",  color: "#9945ff", bg: "rgba(153,69,255,.08)",  border: "rgba(153,69,255,.2)"  },
  CARDANO: { label: "Cardano", icon: "🔵", color: "#0057ff", bg: "rgba(0,87,255,.08)",    border: "rgba(0,87,255,.2)"    },
};

const S = `
  @keyframes cwIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes cwSpin{ to{transform:rotate(360deg)} }
  .cw-spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(163,230,53,.15);border-top-color:#a3e635;animation:cwSpin .6s linear infinite;flex-shrink:0}
  .cw-btn-out{padding:9px 14px;border-radius:10px;border:1.5px solid rgba(163,230,53,.3);background:rgba(163,230,53,.05);color:#a3e635;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px;transition:all .15s;white-space:nowrap}
  .cw-btn-out:hover:not(:disabled){border-color:rgba(163,230,53,.5);background:rgba(163,230,53,.09)}
  .cw-btn-out:disabled{opacity:.35;cursor:not-allowed}
  .cw-btn-ghost{padding:8px 12px;border-radius:9px;border:1px solid #252525;background:transparent;color:#555;font-weight:600;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
  .cw-btn-ghost:hover{color:#888;border-color:#333}
  .cw-btn-danger{padding:8px 12px;border-radius:9px;border:1.5px solid rgba(239,68,68,.2);background:rgba(239,68,68,.04);color:#f87171;font-weight:600;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
  .cw-btn-danger:hover{border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.08)}
  .cw-wallet-row{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #161616;animation:cwIn .25s ease;transition:background .15s}
  .cw-wallet-row:hover{background:#0f0f0f}
  .cw-wallet-row:last-child{border-bottom:none}
`;

const Spin = () => <div className="cw-spin" />;
const mono = { fontFamily: "'JetBrains Mono', monospace" };

function truncate(addr, start = 10, end = 6) {
  if (!addr || addr.length < start + end + 3) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

// ── Single wallet row ─────────────────────────────────────────────────────────
function WalletRow({ wallet, onDisconnect }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = ECOSYSTEM_META[wallet.ecosystem] ?? ECOSYSTEM_META.EVM;

  const copy = () => {
    navigator.clipboard.writeText(wallet.address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  const disconnect = async () => {
    setDisconnecting(true);
    await onDisconnect(wallet.id);
    setDisconnecting(false);
  };

  return (
    <div className="cw-wallet-row">
      {/* Ecosystem badge */}
      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: meta.bg, border: `1px solid ${meta.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
        {meta.icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#d8d8d8" }}>{wallet.label || meta.label + " Wallet"}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 20, padding: "2px 8px" }}>
            {meta.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#444", ...mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{truncate(wallet.address)}</span>
          <button onClick={copy} style={{ background: "transparent", border: "none", cursor: "pointer", color: copied ? "#a3e635" : "#333", fontSize: 11, padding: 0, flexShrink: 0, transition: "color .2s" }}>
            {copied ? "✓" : "⎘"}
          </button>
        </div>
        {wallet.connected_at && (
          <div style={{ fontSize: 10, color: "#292929", marginTop: 3 }}>
            Connected {new Date(wallet.connected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
      </div>

      {/* Disconnect */}
      <button className="cw-btn-danger" onClick={disconnect} disabled={disconnecting} style={{ flexShrink: 0 }}>
        {disconnecting ? <Spin /> : "Remove"}
      </button>
    </div>
  );
}

// ── Connect new wallet row ────────────────────────────────────────────────────
function ConnectRow({ label, icon, onConnect, connecting }) {
  return (
    <button className="cw-btn-out" onClick={onConnect} disabled={connecting} style={{ width: "100%", justifyContent: "center", padding: "11px 16px" }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      {connecting ? <><Spin />Detecting…</> : `Connect ${label} Wallet`}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConnectedWalletsSection() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingEVM, setConnectingEVM] = useState(false);
  const [connectingSOL, setConnectingSOL] = useState(false);
  const [connectingADA, setConnectingADA] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("connected_wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("connected_at", { ascending: false });
      if (error) throw new Error(error.message);
      setWallets(data ?? []);
    } catch (e) {
      setErr(e?.message ?? "Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const disconnect = async (walletId) => {
    try {
      const { error } = await supabase
        .from("connected_wallets")
        .update({ is_active: false, disconnected_at: new Date().toISOString() })
        .eq("id", walletId);
      if (error) throw new Error(error.message);
      setWallets(prev => prev.filter(w => w.id !== walletId));
    } catch (e) {
      setErr(e?.message ?? "Failed to remove wallet.");
    }
  };

  const connectEVM = async () => {
    setConnectingEVM(true); setErr("");
    try {
      const w = await detectAvailableWallet();
      if (!w) { setErr("No EVM wallet found. Install MetaMask or Coinbase Wallet."); return; }
      let address = w.address;
      if (!address) {
        if (!window.ethereum) { setErr("No EVM wallet detected."); return; }
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        address = accounts?.[0];
      }
      if (!address) { setErr("No account returned from wallet."); return; }
      await saveConnectedWallet(userId, "EVM", address, w.label);
      await load();
    } catch (e) {
      setErr(e?.code === 4001 ? "Connection rejected in wallet." : e?.message ?? "Failed to connect EVM wallet.");
    } finally {
      setConnectingEVM(false);
    }
  };

  const connectSOL = async () => {
    setConnectingSOL(true); setErr("");
    try {
      const detected = await detectSolanaWallet();
      if (!detected) { setErr("No Solana wallet found. Install Phantom, Solflare, or Backpack."); return; }
      await detected.obj.connect();
      const address = detected.obj.publicKey?.toString();
      if (!address) { setErr("Could not get Solana address."); return; }
      await saveConnectedWallet(userId, "SOLANA", address, detected.label);
      await load();
    } catch (e) {
      setErr(e?.code === 4001 ? "Connection rejected in wallet." : e?.message ?? "Failed to connect Solana wallet.");
    } finally {
      setConnectingSOL(false);
    }
  };

  const connectADA = async () => {
    setConnectingADA(true); setErr("");
    try {
      if (typeof window === "undefined" || !window.cardano) { setErr("No Cardano wallet found. Install Nami, Eternl, Flint, or Lace."); return; }
      const detected = await detectCardanoWallet();
      if (!detected) { setErr("No Cardano wallet found. Install Nami, Eternl, or Lace."); return; }
      const api = await detected.walletObj.enable();
      const addrs = await api.getUsedAddresses().catch(() => []);
      const address = addrs?.[0];
      if (!address) { setErr("No address returned from Cardano wallet."); return; }
      await saveConnectedWallet(userId, "CARDANO", address, detected.label);
      await load();
    } catch (e) {
      setErr(e?.code === 2 ? "Connection rejected in wallet." : e?.message ?? "Failed to connect Cardano wallet.");
    } finally {
      setConnectingADA(false);
    }
  };

  // Group by ecosystem
  const evmWallets = wallets.filter(w => w.ecosystem === "EVM");
  const solWallets = wallets.filter(w => w.ecosystem === "SOLANA");
  const adaWallets = wallets.filter(w => w.ecosystem === "CARDANO");

  const hasAny = wallets.length > 0;
  const anyConnecting = connectingEVM || connectingSOL || connectingADA;

  return (
    <>
      <style>{S}</style>
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: 520 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 3, letterSpacing: "-0.3px" }}>Connected Wallets</div>
            <div style={{ fontSize: 12, color: "#3a3a3a", lineHeight: 1.6 }}>Wallets you've used to pay or connect to Xeevia.</div>
          </div>
          {hasAny && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: "#a3e635", background: "rgba(163,230,53,.08)", border: "1px solid rgba(163,230,53,.18)", borderRadius: 20, padding: "4px 12px" }}>
            {wallets.length} wallet{wallets.length !== 1 ? "s" : ""}
          </span>}
        </div>

        {/* Error */}
        {err && (
          <div style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#fca5a5", lineHeight: 1.6, marginBottom: 16 }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>{err}
          </div>
        )}

        {/* Wallet list */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 10, color: "#444", fontSize: 13 }}>
            <Spin /> Loading wallets…
          </div>
        ) : hasAny ? (
          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            {wallets.map(w => <WalletRow key={w.id} wallet={w} onDisconnect={disconnect} />)}
          </div>
        ) : (
          <div style={{ background: "#0e0e0e", border: "1px dashed #1e1e1e", borderRadius: 14, padding: "28px 20px", textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔗</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 6 }}>No wallets connected</div>
            <div style={{ fontSize: 12, color: "#252525", lineHeight: 1.75 }}>Connect a crypto wallet to manage your Web3 identity on Xeevia.</div>
          </div>
        )}

        {/* Connect new */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.8px", textTransform: "uppercase", color: "#333", marginBottom: 12 }}>
            Connect a wallet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ConnectRow label="EVM" icon="🔗" onConnect={connectEVM} connecting={connectingEVM} />
            <ConnectRow label="Solana" icon="◎" onConnect={connectSOL} connecting={connectingSOL} />
            <ConnectRow label="Cardano" icon="🔵" onConnect={connectADA} connecting={connectingADA} />
          </div>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 16, fontSize: 11, color: "#252525", lineHeight: 1.75 }}>
          Connecting a wallet does not give Xeevia access to your funds. We only read your address for identity purposes.
        </div>
      </div>
    </>
  );
}