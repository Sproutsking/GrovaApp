// paywave/tabs/WithdrawTab.jsx ── v1 COMPLETE EDITION
// Wire bank withdrawals + OPay wallet withdrawals
// Links to real edge functions for withdrawal processing
import React, { useState, useCallback, useEffect } from "react";
import {
  ArrowUp, Banknote, Smartphone, Check, AlertCircle,
  ChevronRight, X, RefreshCw, CreditCard, Bank,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { opayService } from "../../../../services/wallet/opayService";
import { useAuth } from "../../../../components/Auth/AuthContext";
import TransactionPinModal from "../../../Modals/TransactionPinModal";
import TwoFAModal from "../../../Modals/TwoFAModal";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Header ──────────────────────────────────────────────────────
function Header({ title, onBack, icon: Icon }) {
  return (
    <div className="pw-hdr">
      <button className="pw-back-btn" onClick={onBack}><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg></button>
      {Icon && <Icon size={14} color="var(--lime)" />}
      <span className="pw-hdr-title">{title}</span>
    </div>
  );
}

// ── WITHDRAWAL METHOD SELECTOR ──────────────────────────────────
function WithdrawMethodSelector({ onSelect, pwBalance, loading }) {
  const methods = [
    { 
      id: "bank", 
      label: "To Bank Account", 
      sublabel: "1-2 hours (NIBSS)", 
      icon: Bank, 
      color: "#3B82F6",
      minAmount: 500,
    },
    { 
      id: "opay", 
      label: "OPay Wallet", 
      sublabel: "Instant transfer", 
      icon: Smartphone, 
      color: "#10B981",
      minAmount: 100,
    },
  ];

  return (
    <div className="xf-section xf-stack">
      <Header title="Withdraw Money" onBack={() => {}} />
      
      <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
        <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 2 }}>Available Balance</div>
        <div style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 800 }}>₦{fmtNGN(pwBalance)}</div>
      </div>

      {methods.map(m => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          disabled={loading || pwBalance < m.minAmount}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 13px",
            background: "var(--s1)",
            border: "1px solid var(--b1)",
            borderRadius: "var(--r2)",
            cursor: (loading || pwBalance < m.minAmount) ? "not-allowed" : "pointer",
            transition: "all .18s",
            opacity: (loading || pwBalance < m.minAmount) ? 0.5 : 1,
          }}
          onMouseOver={e => !loading && pwBalance >= m.minAmount && (e.currentTarget.style.borderColor = "var(--lime-ring)")}
          onMouseOut={e => !loading && pwBalance >= m.minAmount && (e.currentTarget.style.borderColor = "var(--b1)")}
        >
          <div style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${m.color}22`,
            borderRadius: "var(--r1)",
            color: m.color,
          }}>
            <m.icon size={20} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ color: "var(--t1)", fontFamily: "var(--fd)", fontSize: 13, fontWeight: 700 }}>{m.label}</div>
            <div style={{ color: "var(--t2)", fontSize: 11.5, marginTop: 1 }}>{m.sublabel}</div>
          </div>
          {pwBalance < m.minAmount && (
            <div style={{ fontSize: 10, color: "var(--t3)", textAlign: "right" }}>Min ₦{fmtNGN(m.minAmount)}</div>
          )}
          <ChevronRight size={14} color="var(--t2)" />
        </button>
      ))}
    </div>
  );
}

// ── BANK WITHDRAWAL ─────────────────────────────────────────────
function BankWithdraw({ onBack, onSuccess, onRefresh, pwBalance }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const parsedAmt = parseFloat(amount) || 0;
  const canWithdraw = accountNumber && accountName && bankName && parsedAmt >= 500 && parsedAmt <= pwBalance;

  const handleWithdraw = () => {
    if (!canWithdraw) return;
    setShowPinModal(true);
  };

  const executeWithdraw = async () => {
    if (!profile?.id || !canWithdraw) return;
    setLoading(true);
    try {
      const result = await opayService.withdrawToBank({
        userId: profile.id,
        accountNumber,
        accountName,
        bankName,
        amount: parsedAmt,
      });

      if (result.success) {
        onRefresh?.();
        onSuccess(`₦${fmtNGN(parsedAmt)} withdrawal initiated to ${accountName}. Expected in 1-2 hours.`);
        onBack();
      } else {
        alert(result.error || "Withdrawal failed");
      }
    } catch (err) {
      console.error("Bank withdrawal error:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyAccount = async () => {
    if (!accountNumber || !bankName) {
      alert("Please enter account number and bank name");
      return;
    }
    setVerifying(true);
    try {
      // OPay API will verify the account name
      const result = await opayService.verifyAccountName({
        accountNumber,
        bankName,
      });
      if (result.success) {
        setAccountName(result.accountName);
      } else {
        alert(result.error || "Account verification failed");
      }
    } catch (err) {
      console.error("Verification error:", err);
      alert("Could not verify account. Please check details and try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="pw-scroll">
      <Header title="Withdraw to Bank" icon={Bank} onBack={onBack} />
      
      <div className="xf-section xf-stack">
        <div style={{
          background: "rgba(59, 130, 246, 0.055)",
          border: "1px solid rgba(59, 130, 246, 0.16)",
          borderRadius: "var(--r2)",
          padding: "9px 11px",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}>
          <AlertCircle size={14} color="#3B82F6" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>
            Withdrawals are processed via NIBSS. Funds typically arrive in 1-2 hours. Minimum ₦500.
          </div>
        </div>

        <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
          <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>Amount to Withdraw</div>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--lime)",
              fontFamily: "var(--fd)",
              fontSize: 28,
              fontWeight: 800,
              textAlign: "center",
              outline: "none",
            }}
            min="500"
            max={pwBalance}
          />
          <div style={{ color: "var(--t2)", fontSize: 10, marginTop: 8 }}>Max ₦{fmtNGN(pwBalance)}</div>
        </div>

        <div>
          <label style={{ color: "var(--t2)", fontSize: 11, display: "block", marginBottom: 4 }}>Bank Name</label>
          <select
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 11px",
              background: "var(--s1)",
              border: "1px solid var(--b1)",
              borderRadius: "var(--r2)",
              color: "var(--t1)",
              fontSize: 12,
              fontFamily: "var(--fb)",
              boxSizing: "border-box",
            }}
          >
            <option value="">Select Bank</option>
            <option value="GTB">Guaranty Trust Bank (GTB)</option>
            <option value="ACCESS">Access Bank</option>
            <option value="FIRSTBANK">First Bank of Nigeria</option>
            <option value="ZENITH">Zenith Bank</option>
            <option value="UBA">United Bank for Africa (UBA)</option>
            <option value="FCMB">FCMB Group</option>
            <option value="STANBIC">Stanbic IBTC Bank</option>
            <option value="WEMA">Wema Bank</option>
            <option value="UNION">Union Bank of Nigeria</option>
            <option value="OTHER">Other Banks</option>
          </select>
        </div>

        <div>
          <label style={{ color: "var(--t2)", fontSize: 11, display: "block", marginBottom: 4 }}>Account Number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="1234567890"
            maxLength="10"
            style={{
              width: "100%",
              padding: "8px 11px",
              background: "var(--s1)",
              border: "1px solid var(--b1)",
              borderRadius: "var(--r2)",
              color: "var(--t1)",
              fontSize: 12,
              fontFamily: "var(--fb)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={verifyAccount}
          disabled={!accountNumber || !bankName || verifying}
          style={{
            width: "100%",
            padding: "8px 11px",
            background: "rgba(163, 230, 53, 0.055)",
            border: "1px dashed rgba(163, 230, 53, 0.25)",
            borderRadius: "var(--r2)",
            color: accountName ? "var(--lime)" : "var(--t2)",
            fontSize: 11,
            fontFamily: "var(--fd)",
            fontWeight: 600,
            cursor: verifying ? "not-allowed" : "pointer",
            opacity: verifying ? 0.5 : 1,
          }}
        >
          {verifying ? "Verifying…" : accountName ? `✓ Verified: ${accountName}` : "Verify Account Name"}
        </button>

        <button
          className="btn-p full"
          onClick={handleWithdraw}
          disabled={!canWithdraw || loading}
          style={{ opacity: (canWithdraw && !loading) ? 1 : 0.5 }}
        >
          {loading ? "Processing…" : <><Banknote size={12} /> Withdraw to Bank</>}
        </button>
      </div>

      {showPinModal && (
        <TransactionPinModal
          amount={parsedAmt}
          recipient={accountName || "Bank Account"}
          transactionType="withdrawal"
          description={`Withdraw ₦${fmtNGN(parsedAmt)} to ${accountName}`}
          onConfirm={executeWithdraw}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

// ── OPAY WALLET WITHDRAWAL ──────────────────────────────────────
function OPayWithdraw({ onBack, onSuccess, onRefresh, pwBalance }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const parsedAmt = parseFloat(amount) || 0;
  const cleanPhone = phone.replace(/\D/g, "");
  const canWithdraw = cleanPhone.length >= 10 && parsedAmt >= 100 && parsedAmt <= pwBalance;

  const handleWithdraw = () => {
    if (!canWithdraw) return;
    setShowPinModal(true);
  };

  const executeWithdraw = async () => {
    if (!profile?.id || !canWithdraw) return;
    setLoading(true);
    try {
      const result = await opayService.withdrawToOPayWallet({
        userId: profile.id,
        opayPhone: cleanPhone,
        amount: parsedAmt,
      });

      if (result.success) {
        onRefresh?.();
        onSuccess(`₦${fmtNGN(parsedAmt)} transferred to OPay wallet instantly!`);
        onBack();
      } else {
        alert(result.error || "Withdrawal failed");
      }
    } catch (err) {
      console.error("OPay withdrawal error:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pw-scroll">
      <Header title="Withdraw to OPay" icon={Smartphone} onBack={onBack} />
      
      <div className="xf-section xf-stack">
        <div style={{
          background: "rgba(16, 185, 129, 0.055)",
          border: "1px solid rgba(16, 185, 129, 0.16)",
          borderRadius: "var(--r2)",
          padding: "9px 11px",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}>
          <AlertCircle size={14} color="#10B981" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>
            Instant transfer to your OPay wallet. Funds arrive immediately. Minimum ₦100.
          </div>
        </div>

        <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
          <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>Amount to Withdraw</div>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--lime)",
              fontFamily: "var(--fd)",
              fontSize: 28,
              fontWeight: 800,
              textAlign: "center",
              outline: "none",
            }}
            min="100"
            max={pwBalance}
          />
          <div style={{ color: "var(--t2)", fontSize: 10, marginTop: 8 }}>Max ₦{fmtNGN(pwBalance)}</div>
        </div>

        <div>
          <label style={{ color: "var(--t2)", fontSize: 11, display: "block", marginBottom: 4 }}>OPay Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="08012345678"
            style={{
              width: "100%",
              padding: "8px 11px",
              background: "var(--s1)",
              border: "1px solid var(--b1)",
              borderRadius: "var(--r2)",
              color: "var(--t1)",
              fontSize: 12,
              fontFamily: "var(--fb)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          className="btn-p full"
          onClick={handleWithdraw}
          disabled={!canWithdraw || loading}
          style={{ opacity: (canWithdraw && !loading) ? 1 : 0.5 }}
        >
          {loading ? "Processing…" : <><Smartphone size={12} /> Withdraw to OPay</>}
        </button>
      </div>

      {showPinModal && (
        <TransactionPinModal
          amount={parsedAmt}
          recipient="OPay Wallet"
          transactionType="withdrawal"
          description={`Transfer ₦${fmtNGN(parsedAmt)} to OPay`}
          onConfirm={executeWithdraw}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

// ── MAIN WITHDRAW TAB ───────────────────────────────────────────
export default function WithdrawTab({ onBack, onSuccess, onRefresh, pwBalance }) {
  const [view, setView] = useState("methods");
  const [loading, setLoading] = useState(false);

  return (
    <>
      {view === "methods" && (
        <WithdrawMethodSelector 
          onSelect={m => setView(m)} 
          pwBalance={pwBalance}
          loading={loading}
        />
      )}
      {view === "bank" && (
        <BankWithdraw 
          onBack={() => setView("methods")} 
          onSuccess={onSuccess}
          onRefresh={onRefresh}
          pwBalance={pwBalance}
        />
      )}
      {view === "opay" && (
        <OPayWithdraw 
          onBack={() => setView("methods")} 
          onSuccess={onSuccess}
          onRefresh={onRefresh}
          pwBalance={pwBalance}
        />
      )}
    </>
  );
}
