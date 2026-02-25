// src/components/wallet/tabs/SwapTab.jsx
import React, { useState } from "react";
import {
  ArrowLeft,
  Repeat,
  Flame,
  AlertCircle,
  CheckCircle,
  Zap,
  TrendingUp,
} from "lucide-react";
import { walletService } from "../../../services/wallet/walletService";

// Swap only between EP and XEV
const SWAP_RATE = 10; // 10 EP = 1 XEV (platform rate)
const EP_BURN_SWAP = 5; // 5 EP burned per swap (platform revenue)

const SwapTab = ({ setActiveTab, balance, userId, onRefresh }) => {
  const [direction, setDirection] = useState("EP_TO_XEV"); // EP_TO_XEV | XEV_TO_EP
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isEPtoXEV = direction === "EP_TO_XEV";

  const fromCurrency = isEPtoXEV ? "EP" : "XEV";
  const toCurrency = isEPtoXEV ? "XEV" : "EP";
  const fromBalance = isEPtoXEV ? balance?.points || 0 : balance?.tokens || 0;

  const computeOutput = () => {
    const a = parseFloat(amount) || 0;
    if (isEPtoXEV) return (a / SWAP_RATE).toFixed(4);
    return (a * SWAP_RATE).toFixed(0);
  };

  const outputAmount = computeOutput();
  const epRequired = isEPtoXEV
    ? (parseFloat(amount) || 0) + EP_BURN_SWAP
    : EP_BURN_SWAP;
  const insufficient =
    parseFloat(amount) > fromBalance || (balance?.points || 0) < epRequired;

  const handleSwap = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await walletService.swapTokens({
        userId,
        direction,
        amount: parseFloat(amount),
        epBurn: EP_BURN_SWAP,
      });
      if (result.success) {
        setDone(true);
        if (onRefresh) onRefresh();
      } else {
        setError(result.error || "Swap failed");
        setStep(1);
      }
    } catch {
      setError("Swap failed. Try again.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        className="view-enter"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 20px",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <CheckCircle size={30} color="var(--success)" />
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          Swapped!
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--text3)",
            textAlign: "center",
            marginBottom: 6,
            lineHeight: 1.6,
          }}
        >
          {amount} {fromCurrency} → {outputAmount} {toCurrency}
        </div>
        <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 30 }}>
          {EP_BURN_SWAP} EP burned
        </div>
        <button
          className="btn-xev"
          style={{ width: "100%", maxWidth: 320 }}
          onClick={() => {
            setDone(false);
            setStep(1);
            setAmount("");
            setActiveTab("overview");
          }}
        >
          Back to Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="view-enter">
      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="view-title">Swap</div>
          <div className="view-subtitle">EP ↔ $XEV · Internal exchange</div>
        </div>
      </div>

      <div className="swap-container">
        {/* From */}
        <div className="swap-box">
          <div className="swap-box-label">From</div>
          <div className="swap-row">
            <input
              className="swap-amount-input"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className={`token-pill ${isEPtoXEV ? "ep" : "xev"}`}>
              {isEPtoXEV ? <Zap size={14} /> : <TrendingUp size={14} />}
              {fromCurrency}
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--text3)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Available: {fromBalance.toLocaleString()} {fromCurrency}
          </div>
        </div>

        {/* Swap direction button */}
        <div className="swap-divider">
          <button
            className="swap-switch-btn"
            onClick={() =>
              setDirection((d) =>
                d === "EP_TO_XEV" ? "XEV_TO_EP" : "EP_TO_XEV",
              )
            }
          >
            <Repeat size={16} />
          </button>
        </div>

        {/* To */}
        <div className="swap-box">
          <div className="swap-box-label">To (estimated)</div>
          <div className="swap-row">
            <input
              className="swap-amount-input"
              type="number"
              placeholder="0"
              value={
                outputAmount !== "0.0000" && outputAmount !== "0"
                  ? outputAmount
                  : ""
              }
              readOnly
              style={{ color: "var(--text2)" }}
            />
            <div className={`token-pill ${isEPtoXEV ? "xev" : "ep"}`}>
              {isEPtoXEV ? <TrendingUp size={14} /> : <Zap size={14} />}
              {toCurrency}
            </div>
          </div>
        </div>

        {/* Rate info */}
        <div className="swap-rate-info" style={{ marginTop: 10 }}>
          <Repeat size={14} />
          <span>
            Rate: 1 XEV = <span className="highlight">{SWAP_RATE} EP</span>{" "}
            &nbsp;·&nbsp;{" "}
            <span style={{ color: "var(--danger)" }}>
              {EP_BURN_SWAP} EP burned per swap
            </span>
          </span>
        </div>

        {/* Notice */}
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.12)",
            borderRadius: "var(--radius-xs)",
            marginTop: 8,
            fontSize: 12,
            color: "var(--text3)",
            lineHeight: 1.5,
          }}
        >
          💡 Swap is only between EP and $XEV. $XEV can leave the platform; EP
          remains internal forever. Both conversions burn {EP_BURN_SWAP} EP as
          platform revenue.
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="ep-burn-notice" style={{ marginTop: 10 }}>
            <Flame size={14} color="#f87171" />
            <span>
              {isEPtoXEV
                ? `${parseFloat(amount)} EP + ${EP_BURN_SWAP} EP burn = ${epRequired} EP total deducted`
                : `${EP_BURN_SWAP} EP will be burned for this swap`}
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "12px",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: "var(--radius-xs)",
              marginTop: 10,
            }}
          >
            <AlertCircle size={15} color="var(--danger)" />
            <span style={{ fontSize: 13, color: "#f87171" }}>{error}</span>
          </div>
        )}
      </div>

      {/* Summary if amount set */}
      {amount && parseFloat(amount) > 0 && (
        <div className="summary-card" style={{ marginTop: 0 }}>
          <div className="summary-card-title">Swap Summary</div>
          <div className="summary-row">
            <span>You give</span>
            <strong>
              {amount} {fromCurrency}
            </strong>
          </div>
          <div className="summary-row">
            <span>You receive</span>
            <strong
              style={{
                color: toCurrency === "XEV" ? "var(--xev)" : "var(--ep)",
              }}
            >
              {outputAmount} {toCurrency}
            </strong>
          </div>
          <div className="summary-divider" />
          <div className="summary-row">
            <span>EP Burned</span>
            <strong style={{ color: "var(--danger)" }}>
              {EP_BURN_SWAP} EP
            </strong>
          </div>
        </div>
      )}

      <button
        className="btn-xev"
        disabled={!amount || parseFloat(amount) <= 0 || insufficient || loading}
        onClick={handleSwap}
      >
        {loading ? (
          "Swapping..."
        ) : (
          <>
            <Repeat size={16} /> Swap Now
          </>
        )}
      </button>
    </div>
  );
};

export default SwapTab;
