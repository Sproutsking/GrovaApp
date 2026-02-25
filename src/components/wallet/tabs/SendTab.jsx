// src/components/wallet/tabs/SendTab.jsx
// ══════════════════════════════════════════════════════════════
// UNIFIED SEND — $XEV + EP in one smart system
// Optimistic UI: balance deducted instantly, tx shown immediately,
// confirmed or rolled back silently in the background.
// EP rules: min 5 EP | <100 EP = 0.5 EP burn | ≥100 EP = tiered burn
// ══════════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Send,
  Search,
  Flame,
  AlertCircle,
  CheckCircle,
  Zap,
  TrendingUp,
  X,
  Loader,
} from "lucide-react";
import { walletService } from "../../../services/wallet/walletService";

const XEV_RATE = 2.5;

// ── EP Burn Rules (unified) ─────────────────────────────────
function computeEPBurn(currency, amount) {
  const a = parseFloat(amount) || 0;
  if (currency === "EP") {
    // Special EP micro-burn rules
    if (a < 100) return 0.5;
    if (a < 500) return 2;
    if (a < 2000) return 5;
    return 10;
  }
  // XEV: NGN-value based
  const ngn = a * XEV_RATE;
  if (ngn < 250) return 1;
  if (ngn < 1000) return 2;
  if (ngn < 5000) return 4;
  if (ngn < 25000) return 7;
  return 10;
}

// ── Optimistic Transaction Manager ─────────────────────────
let optimisticIdCounter = 0;
function makeOptimisticTx(recipient, amount, currency, epBurn) {
  return {
    id: `opt_${++optimisticIdCounter}_${Date.now()}`,
    _optimistic: true,
    type: "debit",
    description: `Sending to ${recipient}`,
    amount: parseFloat(amount),
    currency,
    created_at: new Date().toISOString(),
  };
}

// ── SEND TAB ────────────────────────────────────────────────
const SendTab = ({ setActiveTab, balance, userId, onRefresh, transactions, setTransactions }) => {
  const [currency, setCurrency]       = useState("XEV");
  const [recipient, setRecipient]     = useState("");
  const [amount, setAmount]           = useState("");
  const [note, setNote]               = useState("");
  const [step, setStep]               = useState(1); // 1=form 2=confirm 3=done
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg]       = useState("");
  const toastTimer                    = useRef(null);
  const recipientRef                  = useRef(null);

  // Auto-focus recipient on mount
  useEffect(() => {
    setTimeout(() => recipientRef.current?.focus(), 200);
  }, []);

  const epBurn        = computeEPBurn(currency, amount);
  const fiatValue     = currency === "XEV" ? (parseFloat(amount) || 0) * XEV_RATE : 0;
  const available     = currency === "XEV" ? (balance?.tokens || 0) : (balance?.points || 0);
  const parsedAmount  = parseFloat(amount) || 0;

  // EP min amount enforcement
  const epMinViolation = currency === "EP" && parsedAmount > 0 && parsedAmount < 5;
  const insufficient   = parsedAmount > available || (balance?.points || 0) < epBurn;

  const showToast = useCallback((msg, duration = 3500) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), duration);
  }, []);

  const handleContinue = () => {
    setError("");
    if (!recipient.trim()) { setError("Enter a recipient username or wallet address"); return; }
    if (!amount || parsedAmount <= 0) { setError("Enter a valid amount"); return; }
    if (currency === "EP" && parsedAmount < 5) { setError("Minimum EP send is 5 EP"); return; }
    if (parsedAmount > available) { setError(`Insufficient ${currency} balance`); return; }
    if ((balance?.points || 0) < epBurn) { setError(`Need ${epBurn} EP to cover burn (you have ${balance?.points || 0} EP)`); return; }
    setStep(2);
  };

  // ── OPTIMISTIC SEND ─────────────────────────────────────
  const handleSend = useCallback(async () => {
    setLoading(true);
    setError("");

    // 1. Build optimistic tx
    const optTx = makeOptimisticTx(recipient, amount, currency, epBurn);

    // 2. Immediately update UI — balance and tx list
    const prevBalance = { ...balance };
    if (balance && currency === "XEV") balance.tokens = Math.max(0, (balance.tokens || 0) - parsedAmount);
    if (balance && currency === "EP")  balance.points = Math.max(0, (balance.points || 0) - parsedAmount);
    if (balance) balance.points = Math.max(0, (balance.points || 0) - epBurn);

    // Inject optimistic tx at top of list
    if (typeof setTransactions === "function") {
      setTransactions(prev => [optTx, ...(prev || [])]);
    }

    // 3. Show instant success to user
    setStep(3);
    showToast(`Sending ${amount} ${currency} to ${recipient}…`);

    try {
      // 4. Fire actual request (non-blocking from user perspective)
      const result = await walletService.sendTokens({
        fromUserId: userId,
        toIdentifier: recipient.trim(),
        amount: parsedAmount,
        currency,
        note,
        epBurn,
      });

      if (result.success) {
        showToast(`✓ Sent! ${amount} ${currency} delivered to ${recipient}`);
        if (onRefresh) onRefresh(); // sync real balance
        // Remove optimistic tx (real one will come from refresh)
        if (typeof setTransactions === "function") {
          setTransactions(prev => prev.filter(tx => tx.id !== optTx.id));
        }
      } else {
        // ROLLBACK
        throw new Error(result.error || "Send failed");
      }
    } catch (err) {
      // Rollback optimistic state
      if (balance) {
        balance.tokens = prevBalance.tokens;
        balance.points = prevBalance.points;
      }
      if (typeof setTransactions === "function") {
        setTransactions(prev => prev.filter(tx => tx.id !== optTx.id));
      }
      setError(err.message || "Transaction failed. Please try again.");
      setStep(1);
      showToast("⚠ Send failed — balance restored");
    } finally {
      setLoading(false);
    }
  }, [recipient, amount, currency, epBurn, balance, note, userId, onRefresh, parsedAmount, setTransactions, showToast]);

  // ── DONE STATE ──────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="view-enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
        {/* Success Animation */}
        <div className="send-success-enter" style={{
          width: 72, height: 72,
          borderRadius: "50%",
          background: "var(--lime-dim)",
          border: "2px solid var(--lime-mid)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24,
          boxShadow: "0 0 40px var(--lime-glow)",
        }}>
          {loading
            ? <Loader size={30} color="var(--lime)" style={{ animation: "spin 0.8s linear infinite" }} />
            : <CheckCircle size={32} color="var(--lime)" />
          }
        </div>

        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
          {loading ? "Sending…" : "Sent!"}
        </div>

        <div style={{ fontSize: 38, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--lime)", marginBottom: 4, letterSpacing: "-0.04em" }}>
          {amount} <span style={{ fontSize: 18 }}>{currency}</span>
        </div>

        {fiatValue > 0 && (
          <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "var(--mono)", marginBottom: 8 }}>
            ≈ ₦{fiatValue.toLocaleString()}
          </div>
        )}

        <div style={{ fontSize: 14, color: "var(--text3)", marginBottom: 6 }}>
          to <strong style={{ color: "var(--text)" }}>{recipient}</strong>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.12)",
          borderRadius: "var(--r-pill)",
          fontSize: 11, color: "#f87171",
          marginBottom: 36,
        }}>
          <Flame size={11} /> {epBurn} EP burned
        </div>

        {!loading && (
          <>
            <button
              className="btn-primary"
              style={{ width: "100%", maxWidth: 320 }}
              onClick={() => {
                setStep(1); setAmount(""); setRecipient(""); setNote("");
                setActiveTab("overview");
              }}
            >
              Back to Wallet
            </button>
            <button
              className="btn-ghost"
              style={{ width: "100%", maxWidth: 320, marginTop: 0 }}
              onClick={() => { setStep(1); setAmount(""); setRecipient(""); setNote(""); }}
            >
              Send Again
            </button>
          </>
        )}

        {/* Optimistic Toast */}
        <div className={`optimistic-toast ${toastVisible ? "show" : ""}`}>
          <div className="toast-dot" />
          <div>
            <div className="toast-text">{toastMsg}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── CONFIRM STATE ────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="view-enter">
        <div className="view-header">
          <button className="back-btn" onClick={() => setStep(1)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="view-title">Confirm</div>
            <div className="view-subtitle">Review & fire</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-title">Transaction Details</div>
          <div className="summary-row">
            <span>To</span>
            <strong style={{ color: "var(--text)" }}>{recipient}</strong>
          </div>
          <div className="summary-row">
            <span>Amount</span>
            <strong>{amount} {currency}</strong>
          </div>
          {currency === "XEV" && (
            <div className="summary-row">
              <span>Value</span>
              <span>≈ ₦{fiatValue.toLocaleString()}</span>
            </div>
          )}
          {note && (
            <div className="summary-row">
              <span>Note</span>
              <span style={{ maxWidth: 180, textAlign: "right", fontSize: 12 }}>{note}</span>
            </div>
          )}
          <div className="summary-divider" />
          <div className="summary-row total">
            <span>EP Burn</span>
            <strong style={{ color: "var(--danger)" }}>−{epBurn} EP</strong>
          </div>
        </div>

        <div className="ep-burn-notice" style={{ margin: "0 20px 20px" }}>
          <Flame size={13} color="#f87171" />
          <span>{epBurn} EP will be burned — non-refundable, sustains the platform.</span>
        </div>

        <button className="btn-primary" disabled={loading} onClick={handleSend}>
          {loading
            ? <><Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Sending…</>
            : <><Send size={15} /> Confirm &amp; Send</>
          }
        </button>
        <button className="btn-ghost" onClick={() => setStep(1)}>Cancel</button>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── FORM STATE ───────────────────────────────────────────
  return (
    <div className="view-enter">
      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="view-title">Send</div>
          <div className="view-subtitle">Transfer $XEV or EP instantly</div>
        </div>
      </div>

      {/* Currency Switcher */}
      <div className="currency-switcher">
        {[
          { key: "XEV", label: "$XEV", Icon: TrendingUp },
          { key: "EP",  label: "EP",   Icon: Zap        },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`currency-tab ${currency === key ? (key === "XEV" ? "active-xev" : "active-ep") : ""}`}
            onClick={() => { setCurrency(key); setAmount(""); setError(""); }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="form-body">
        {/* Recipient */}
        <div className="field-group">
          <label className="field-label">Recipient</label>
          <div className="field-wrap">
            <input
              ref={recipientRef}
              className="field-input"
              placeholder="@username or wallet address"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              style={{ paddingRight: 44 }}
            />
            {recipient
              ? <X
                  size={15}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", cursor: "pointer" }}
                  onClick={() => setRecipient("")}
                />
              : <Search
                  size={15}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }}
                />
            }
          </div>
        </div>

        {/* Amount */}
        <div className="field-group">
          <label className="field-label">
            Amount
            {currency === "EP" && (
              <span style={{ marginLeft: 8, color: "var(--ep)", fontWeight: 700, fontSize: 9 }}>
                MIN 5 EP
              </span>
            )}
          </label>
          <div className="amount-field">
            <input
              className="amount-input-big"
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={currency === "EP" ? 5 : 0}
              step={currency === "EP" ? 1 : "any"}
            />
            <div className="amount-ticker-row">
              <span
                className="amount-ticker"
                style={{ color: currency === "EP" ? "var(--ep)" : "var(--lime)" }}
              >
                {currency === "XEV" ? "$XEV" : "EP"}
              </span>
              {currency === "XEV" && amount && (
                <span className="amount-fiat-display">≈ ₦{fiatValue.toLocaleString()}</span>
              )}
              {currency === "EP" && amount && parsedAmount > 0 && (
                <span className="amount-fiat-display">
                  {parsedAmount < 100 ? "0.5 EP fee" : `${epBurn} EP fee`}
                </span>
              )}
            </div>
          </div>

          <div className="field-hint">
            Available: {available.toLocaleString()} {currency}
          </div>

          {/* Quick amounts for EP */}
          {currency === "EP" && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {[5, 10, 25, 50, 100].map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  style={{
                    flex: 1,
                    padding: "7px 4px",
                    background: amount === String(a) ? "var(--ep-mid)" : "var(--surface)",
                    border: `1px solid ${amount === String(a) ? "rgba(34,211,238,0.25)" : "var(--border)"}`,
                    borderRadius: "var(--r-xs)",
                    color: amount === String(a) ? "var(--ep)" : "var(--text3)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font)",
                    transition: "all 0.12s",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="field-group">
          <label className="field-label">Note <span style={{ color: "var(--text4)", fontWeight: 400 }}>(optional)</span></label>
          <input
            className="field-input"
            placeholder="What's this for?"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {/* EP Burn preview */}
        {amount && parsedAmount > 0 && !epMinViolation && (
          <div className="ep-burn-notice" style={{ marginBottom: 16 }}>
            <Flame size={13} color="#f87171" />
            <span>
              {currency === "EP" && parsedAmount < 100
                ? `Micro-transfer: only 0.5 EP fee (under 100 EP)`
                : `${epBurn} EP will be burned for this transaction`
              }
            </span>
          </div>
        )}

        {/* EP Min violation */}
        {epMinViolation && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "10px 14px",
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: "var(--r-xs)",
            marginBottom: 14,
          }}>
            <AlertCircle size={14} color="var(--warn)" />
            <span style={{ fontSize: 13, color: "var(--warn)" }}>Minimum send is 5 EP</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            padding: "12px 14px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.12)",
            borderRadius: "var(--r-xs)",
            marginBottom: 16,
          }}>
            <AlertCircle size={15} color="var(--danger)" />
            <span style={{ fontSize: 13, color: "#f87171" }}>{error}</span>
          </div>
        )}
      </div>

      <button
        className="btn-primary"
        disabled={!recipient || !amount || parsedAmount <= 0 || insufficient || epMinViolation}
        onClick={handleContinue}
      >
        <Send size={15} />
        Continue
      </button>

      {/* Toast */}
      <div className={`optimistic-toast ${toastVisible ? "show" : ""}`}>
        <div className="toast-dot" />
        <div>
          <div className="toast-text">{toastMsg}</div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SendTab;