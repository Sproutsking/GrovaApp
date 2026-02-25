// src/components/wallet/tabs/DepositTab.jsx
import React, { useState } from "react";
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Shield,
  Zap,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { walletService } from "../../../services/wallet/walletService";
import { epService } from "../../../services/wallet/epService";

const METHODS = [
  { id: "crypto", icon: "🔗", name: "Crypto", sub: "USDT / ETH" },
  { id: "transfer", icon: "🏦", name: "Transfer", sub: "Bank" },
  { id: "atm", icon: "💳", name: "ATM", sub: "Cash" },
];

const CRYPTO_TOKENS = [
  {
    id: "usdt_trc20",
    label: "USDT (TRC-20)",
    network: "Tron",
    address: "TQVxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    id: "usdt_erc20",
    label: "USDT (ERC-20)",
    network: "Ethereum",
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
  },
  {
    id: "eth",
    label: "ETH",
    network: "Ethereum",
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
  },
];

const BANK_DETAILS = {
  bank: "Providus Bank",
  accountName: "XEV Platform Wallets",
  accountNumber: "5200123456",
  note: "Use your username as reference",
};

const ATM_CODES = [
  { bank: "OPay", code: "*955#" },
  { bank: "Palmpay", code: "*914#" },
  { bank: "GTBank", code: "*737#" },
  { bank: "Access Bank", code: "*901#" },
  { bank: "First Bank", code: "*894#" },
];

const XEV_RATE = 2.5; // 1 XEV = ₦2.50

const DepositTab = ({ setActiveTab, userId, balance, onRefresh }) => {
  const [method, setMethod] = useState("crypto");
  const [cryptoToken, setCryptoToken] = useState(CRYPTO_TOKENS[0]);
  const [amount, setAmount] = useState("");
  const [nairaAmount, setNairaAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [txRef, setTxRef] = useState("");
  const [step, setStep] = useState(1); // 1=method, 2=details, 3=verify
  const [verifyStatus, setVerifyStatus] = useState(null); // null|'pending'|'success'|'failed'

  const copyAddress = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const xevAmount = nairaAmount
    ? (parseFloat(nairaAmount) / XEV_RATE).toFixed(2)
    : "";
  const epToMint = nairaAmount
    ? Math.floor(parseFloat(nairaAmount) / XEV_RATE)
    : 0; // 1:1 EP per XEV

  const handleVerifyDeposit = async () => {
    if (!txRef.trim()) return;
    setVerifying(true);
    setVerifyStatus("pending");
    try {
      const result = await walletService.verifyDeposit({
        userId,
        txReference: txRef,
        method,
        amount: parseFloat(nairaAmount || xevAmount),
        currency: method === "crypto" ? cryptoToken.id : "NGN",
      });
      if (result.success) {
        setVerifyStatus("success");
        if (onRefresh) onRefresh();
      } else {
        setVerifyStatus("failed");
      }
    } catch {
      setVerifyStatus("failed");
    } finally {
      setVerifying(false);
    }
  };

  const epBurn = Math.max(
    1,
    Math.min(10, Math.floor((parseFloat(xevAmount) || 0) * 0.002)),
  );

  return (
    <div className="view-enter">
      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="view-title">Deposit</div>
          <div className="view-subtitle">Fund your $XEV wallet</div>
        </div>
      </div>

      {/* Method selector */}
      <div className="method-grid">
        {METHODS.map((m) => (
          <button
            key={m.id}
            className={`method-card ${method === m.id ? "active" : ""}`}
            onClick={() => {
              setMethod(m.id);
              setStep(1);
            }}
          >
            <div className="method-icon">{m.icon}</div>
            <div className="method-name">{m.name}</div>
            <div style={{ fontSize: 10, color: "var(--text3)" }}>{m.sub}</div>
          </button>
        ))}
      </div>

      {/* ── CRYPTO METHOD ── */}
      {method === "crypto" && (
        <>
          {/* Token selector */}
          <div className="form-body">
            <div className="field-group">
              <label className="field-label">Select Token</label>
              {CRYPTO_TOKENS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCryptoToken(t)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "12px 14px",
                    marginBottom: 8,
                    background:
                      cryptoToken.id === t.id
                        ? "var(--xev-dim)"
                        : "var(--w-surface)",
                    border: `1px solid ${cryptoToken.id === t.id ? "rgba(245,158,11,0.3)" : "var(--w-border)"}`,
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    color: "var(--text)",
                    fontFamily: "var(--font-display)",
                    transition: "all 0.15s",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>
                      Network: {t.network}
                    </div>
                  </div>
                  {cryptoToken.id === t.id && (
                    <CheckCircle size={16} color="var(--xev)" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Deposit address */}
          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Send {cryptoToken.label} to this address</h4>
                <p>
                  Copy the address below and send from your external wallet or
                  exchange.
                </p>
              </div>
            </div>
            <div className="crypto-address-box">
              <div className="crypto-address-label">
                Deposit Address ({cryptoToken.network})
              </div>
              <div className="address-row" style={{ marginTop: 6 }}>
                <code className="address-text">{cryptoToken.address}</code>
                <button
                  className={`copy-btn ${copied ? "copied" : ""}`}
                  onClick={() => copyAddress(cryptoToken.address)}
                >
                  {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Enter transaction hash</h4>
                <p>
                  After sending, paste the transaction hash to verify instantly.
                </p>
              </div>
            </div>
            <input
              type="text"
              className="field-input"
              style={{ marginTop: 12 }}
              placeholder="0x... or txid..."
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
            />
          </div>

          <div className="info-box">
            <Zap size={16} />
            <div>
              <h4>Instant Credit</h4>
              <p>
                Once your transaction is confirmed on-chain (1–3 confirmations),
                your $XEV and EP will be credited instantly.
              </p>
            </div>
          </div>

          {verifyStatus === "success" && (
            <div
              style={{
                margin: "0 20px 16px",
                padding: "14px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <CheckCircle size={18} color="var(--success)" />
              <div
                style={{
                  fontSize: 13,
                  color: "var(--success)",
                  fontWeight: 600,
                }}
              >
                Deposit verified! Your wallet has been credited.
              </div>
            </div>
          )}

          {verifyStatus === "failed" && (
            <div
              style={{
                margin: "0 20px 16px",
                padding: "14px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <AlertCircle size={18} color="var(--danger)" />
              <div style={{ fontSize: 13, color: "#f87171" }}>
                Could not verify transaction. Check the hash and try again.
              </div>
            </div>
          )}

          <button
            className="btn-xev"
            disabled={!txRef.trim() || verifying}
            onClick={handleVerifyDeposit}
          >
            {verifying ? (
              <RefreshCw
                size={16}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Shield size={16} />
            )}
            {verifying ? "Verifying..." : "Verify Deposit"}
          </button>
        </>
      )}

      {/* ── BANK TRANSFER METHOD ── */}
      {method === "transfer" && (
        <>
          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Transfer to our account</h4>
                <p>
                  Make a bank transfer to the account below. Use your{" "}
                  <strong style={{ color: "var(--xev)" }}>username</strong> as
                  the transfer reference.
                </p>
              </div>
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {[
                { label: "Bank", value: BANK_DETAILS.bank },
                { label: "Account Name", value: BANK_DETAILS.accountName },
                { label: "Account Number", value: BANK_DETAILS.accountNumber },
                { label: "Reference", value: "Your username" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>
                    {row.label}
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      {row.value}
                    </span>
                    {row.label === "Account Number" && (
                      <button
                        className={`copy-btn ${copied ? "copied" : ""}`}
                        onClick={() => copyAddress(BANK_DETAILS.accountNumber)}
                      >
                        {copied ? (
                          <CheckCircle size={13} />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Enter amount sent (₦)</h4>
                <p>
                  We'll credit{" "}
                  {XEV_RATE > 0 ? `${(1 / XEV_RATE).toFixed(2)}` : ""} $XEV per
                  ₦1 deposited, plus equal EP.
                </p>
              </div>
            </div>
            <div className="amount-field" style={{ marginTop: 12 }}>
              <input
                className="amount-input-big"
                type="number"
                placeholder="0"
                value={nairaAmount}
                onChange={(e) => setNairaAmount(e.target.value)}
              />
              <div className="amount-ticker-row">
                <span className="amount-ticker">NGN</span>
                {nairaAmount && (
                  <span className="amount-fiat-display">
                    ≈ {xevAmount} $XEV + {epToMint} EP
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Enter transfer reference / session ID</h4>
                <p>
                  Paste the session ID or reference number from your banking
                  app.
                </p>
              </div>
            </div>
            <input
              type="text"
              className="field-input"
              style={{ marginTop: 12 }}
              placeholder="Session ID / Reference"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
            />
          </div>

          {verifyStatus === "success" && (
            <div
              style={{
                margin: "0 20px 16px",
                padding: "14px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <CheckCircle size={18} color="var(--success)" />
              <div
                style={{
                  fontSize: 13,
                  color: "var(--success)",
                  fontWeight: 600,
                }}
              >
                Transfer verified! ₦{nairaAmount} → {xevAmount} $XEV +{" "}
                {epToMint} EP credited.
              </div>
            </div>
          )}

          {verifyStatus === "failed" && (
            <div
              style={{
                margin: "0 20px 16px",
                padding: "14px",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <AlertCircle size={18} color="var(--danger)" />
              <div style={{ fontSize: 13, color: "#f87171" }}>
                Reference not found. It may take a few minutes to reflect. Try
                again shortly.
              </div>
            </div>
          )}

          <button
            className="btn-xev"
            disabled={!txRef.trim() || !nairaAmount || verifying}
            onClick={handleVerifyDeposit}
          >
            {verifying ? (
              <RefreshCw
                size={16}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Shield size={16} />
            )}
            {verifying ? "Verifying..." : "Verify Transfer"}
          </button>
        </>
      )}

      {/* ── ATM METHOD ── */}
      {method === "atm" && (
        <>
          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Deposit cash at any ATM</h4>
                <p>
                  Use your mobile banking USSD code to deposit cash, then verify
                  with the receipt reference.
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: "0 20px", marginBottom: 16 }}>
            <div className="section-label">USSD Codes</div>
            {ATM_CODES.map((c) => (
              <div
                key={c.bank}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 14px",
                  background: "var(--w-surface)",
                  border: "1px solid var(--w-border)",
                  borderRadius: "var(--radius-xs)",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text)" }}>
                  {c.bank}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "var(--xev)",
                  }}
                >
                  {c.code}
                </span>
              </div>
            ))}
          </div>

          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Transfer to our account after depositing</h4>
                <p>
                  Account:{" "}
                  <strong style={{ color: "var(--xev)" }}>
                    {BANK_DETAILS.accountNumber}
                  </strong>{" "}
                  ({BANK_DETAILS.bank})
                </p>
              </div>
            </div>
          </div>

          <div className="deposit-step">
            <div className="step-row">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Enter the amount & receipt reference</h4>
              </div>
            </div>
            <div className="amount-field" style={{ marginTop: 12 }}>
              <input
                className="amount-input-big"
                type="number"
                placeholder="0"
                value={nairaAmount}
                onChange={(e) => setNairaAmount(e.target.value)}
              />
              <div className="amount-ticker-row">
                <span className="amount-ticker">NGN</span>
                {nairaAmount && (
                  <span className="amount-fiat-display">
                    ≈ {xevAmount} $XEV + {epToMint} EP
                  </span>
                )}
              </div>
            </div>
            <input
              type="text"
              className="field-input"
              style={{ marginTop: 10 }}
              placeholder="Receipt / Reference number"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
            />
          </div>

          <button
            className="btn-xev"
            disabled={!txRef.trim() || !nairaAmount || verifying}
            onClick={handleVerifyDeposit}
          >
            {verifying ? <RefreshCw size={16} /> : <Shield size={16} />}
            {verifying ? "Verifying..." : "Verify Deposit"}
          </button>
        </>
      )}

      <div className="info-box" style={{ marginTop: 0 }}>
        <Shield size={16} />
        <div>
          <h4>Instant EP minting</h4>
          <p>
            Every ₦1 deposited = {(1 / XEV_RATE).toFixed(2)} $XEV + equal EP. EP
            is burned on transactions to sustain the ecosystem.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DepositTab;
