// src/components/wallet/tabs/ReceiveTab.jsx
import React, { useState } from "react";
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Shield,
  QrCode,
  Zap,
} from "lucide-react";
import { useAuth } from "../../Auth/AuthContext";

const ReceiveTab = ({ setActiveTab, userId }) => {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);

  const walletAddress =
    "0x" + (userId || "").replace(/-/g, "").slice(0, 40).padEnd(40, "0");
  const username = profile?.username || "yourhandle";

  const copyAddress = async (text, setFlag) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch {}
  };

  return (
    <div className="view-enter">
      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="view-title">Receive</div>
          <div className="view-subtitle">Share to receive $XEV or EP</div>
        </div>
      </div>

      {/* QR */}
      <div className="qr-section">
        <div className="qr-frame">
          <QrCode size={100} strokeWidth={1} color="var(--xev)" />
        </div>
        <div className="qr-label">Scan to send $XEV to this wallet</div>
      </div>

      {/* Username receive */}
      <div className="address-card">
        <div className="address-label-sm">Platform Username</div>
        <div className="address-row">
          <span className="address-text">@{username}</span>
          <button
            className={`copy-btn ${copiedUser ? "copied" : ""}`}
            onClick={() => copyAddress(`@${username}`, setCopiedUser)}
          >
            {copiedUser ? <CheckCircle size={15} /> : <Copy size={15} />}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
          Other users on the platform can send $XEV or EP directly to your
          username.
        </div>
      </div>

      {/* Wallet address */}
      <div className="address-card">
        <div className="address-label-sm">On-chain Wallet Address</div>
        <div className="address-row">
          <code className="address-text">{walletAddress}</code>
          <button
            className={`copy-btn ${copied ? "copied" : ""}`}
            onClick={() => copyAddress(walletAddress, setCopied)}
          >
            {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
          For receiving from external wallets or exchanges (USDT/ETH network).
        </div>
      </div>

      <div className="info-box">
        <Shield size={16} />
        <div>
          <h4>Secure & Verified</h4>
          <p>
            Always verify the sender before accepting. Internal transfers
            (username) are instant and free. On-chain deposits require 1–3
            confirmations.
          </p>
        </div>
      </div>

      <div
        className="info-box"
        style={{
          background: "rgba(245,158,11,0.05)",
          borderColor: "rgba(245,158,11,0.12)",
        }}
      >
        <Zap size={16} color="var(--xev)" />
        <div>
          <h4 style={{ color: "var(--xev)" }}>EP is earned, not received</h4>
          <p>
            EP accumulates from post engagement, likes, shares, and gifts.
            Deposit $XEV or NGN to also receive EP at 1:1 ratio.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReceiveTab;
