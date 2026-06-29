// paywave/tabs/DepositTab.jsx ── v1 COMPLETE EDITION
// Wire Paystack + OPay + Flutterwave deposits
// Links to real edge functions for payment processing
import React, { useState, useCallback, useEffect } from "react";
import {
  ArrowDown, CreditCard, Smartphone, Globe, Check, AlertCircle,
  ChevronRight, X, RefreshCw, Lock, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import { opayService } from "../../../../services/wallet/opayService";
import { flutterwaveService } from "../../../../services/wallet/flutterwaveService";
import { paystackService } from "../../../../services/wallet/paystackService";
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

// ── DEPOSIT METHOD SELECTOR ─────────────────────────────────────
function DepositMethodSelector({ onSelect, loading }) {
  const methods = [
    { id: "paystack", label: "Debit Card", sublabel: "Visa, Mastercard", icon: CreditCard, color: "#0EA5E9" },
    { id: "opay", label: "OPay Wallet", sublabel: "Request-to-Pay", icon: Smartphone, color: "#10B981" },
    { id: "flutterwave", label: "Mobile Money", sublabel: "MTN, M-Pesa, Airtel", icon: Globe, color: "#8B5CF6" },
  ];

  return (
    <div className="xf-section xf-stack">
      <Header title="Choose Deposit Method" onBack={() => {}} />
      {methods.map(m => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 13px",
            background: "var(--s1)",
            border: "1px solid var(--b1)",
            borderRadius: "var(--r2)",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all .18s",
            opacity: loading ? 0.6 : 1,
          }}
          onMouseOver={e => !loading && (e.currentTarget.style.borderColor = "var(--lime-ring)")}
          onMouseOut={e => !loading && (e.currentTarget.style.borderColor = "var(--b1)")}
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
          <ChevronRight size={14} color="var(--t2)" />
        </button>
      ))}
    </div>
  );
}

// ── PAYSTACK DEPOSIT ────────────────────────────────────────────
function PaystackDeposit({ onBack, onSuccess, onRefresh }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(profile?.email || "");
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const parsedAmt = parseFloat(amount) || 0;
  const canDeposit = email && parsedAmt >= 100;

  const handleDeposit = async () => {
    if (!canDeposit) return;
    setShowPinModal(true);
  };

  const executeDeposit = async () => {
    if (!profile?.id || !canDeposit) return;
    setLoading(true);
    try {
      const result = await paystackService.initializePayment({
        userId: profile.id,
        amount: parsedAmt,
        email,
      });

      if (result.success && result.authorization_url) {
        window.location.href = result.authorization_url;
      } else {
        alert(result.error || "Failed to initialize payment");
      }
    } catch (err) {
      console.error("Paystack deposit error:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pw-scroll">
      <Header title="Deposit via Card" icon={CreditCard} onBack={onBack} />
      
      <div className="xf-section xf-stack">
        <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
          <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>Amount to Deposit</div>
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
          />
          <div style={{ color: "var(--t2)", fontSize: 10, marginTop: 8 }}>Minimum ₦100</div>
        </div>

        <div>
          <label style={{ color: "var(--t2)", fontSize: 11, display: "block", marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
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
            placeholder="you@example.com"
          />
        </div>

        <button
          className="btn-p full"
          onClick={handleDeposit}
          disabled={!canDeposit || loading}
          style={{ opacity: (canDeposit && !loading) ? 1 : 0.5 }}
        >
          {loading ? "Processing…" : <><CreditCard size={12} /> Continue to Paystack</>}
        </button>
      </div>

      {showPinModal && (
        <TransactionPinModal
          amount={parsedAmt}
          recipient="Card Deposit"
          transactionType="deposit"
          description={`Deposit ₦${fmtNGN(parsedAmt)} via Paystack`}
          onConfirm={executeDeposit}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

// ── OPAY DEPOSIT ────────────────────────────────────────────────
function OPayDeposit({ onBack, onSuccess, onRefresh }) {
  const { profile } = useAuth();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const parsedAmt = parseFloat(amount) || 0;
  const cleanPhone = phone.replace(/\D/g, "");
  const canDeposit = cleanPhone.length >= 10 && parsedAmt >= 100;

  const handleDeposit = () => {
    if (!canDeposit) return;
    setShowPinModal(true);
  };

  const executeDeposit = async () => {
    if (!profile?.id || !canDeposit) return;
    setLoading(true);
    try {
      const result = await opayService.depositViaOPayWallet({
        userId: profile.id,
        opayPhone: cleanPhone,
        ngnAmount: parsedAmt,
      });

      if (result.success) {
        onRefresh?.();
        onSuccess(`OPay deposit of ₦${fmtNGN(parsedAmt)} initiated! Check your OPay app for approval.`);
        onBack();
      } else {
        alert(result.error || "Deposit initiation failed");
      }
    } catch (err) {
      console.error("OPay deposit error:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pw-scroll">
      <Header title="Deposit via OPay" icon={Smartphone} onBack={onBack} />
      
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
          <AlertCircle size={14} color="var(--lime)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>
            You'll receive a push notification in your OPay app. Approve the payment there to complete the deposit.
          </div>
        </div>

        <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
          <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>Amount</div>
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
          />
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
          onClick={handleDeposit}
          disabled={!canDeposit || loading}
          style={{ opacity: (canDeposit && !loading) ? 1 : 0.5 }}
        >
          {loading ? "Processing…" : <><Smartphone size={12} /> Initiate OPay Deposit</>}
        </button>
      </div>

      {showPinModal && (
        <TransactionPinModal
          amount={parsedAmt}
          recipient="OPay Deposit"
          transactionType="deposit"
          description={`Deposit ₦${fmtNGN(parsedAmt)} via OPay wallet`}
          onConfirm={executeDeposit}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

// ── FLUTTERWAVE DEPOSIT ─────────────────────────────────────────
function FlutterwaveDeposit({ onBack, onSuccess, onRefresh }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("all");
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const parsedAmt = parseFloat(amount) || 0;
  const canDeposit = parsedAmt >= 100;

  const handleDeposit = () => {
    if (!canDeposit) return;
    setShowPinModal(true);
  };

  const executeDeposit = async () => {
    if (!profile?.id || !canDeposit) return;
    setLoading(true);
    try {
      const result = await flutterwaveService.depositViaFlutterwave({
        userId: profile.id,
        amount: parsedAmt,
        currency: "NGN",
        paymentMethod: method,
      });

      if (result.success && result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        alert(result.error || "Checkout initiation failed");
      }
    } catch (err) {
      console.error("Flutterwave deposit error:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pw-scroll">
      <Header title="Deposit via Mobile Money" icon={Globe} onBack={onBack} />
      
      <div className="xf-section xf-stack">
        <div style={{
          background: "rgba(139, 92, 246, 0.055)",
          border: "1px solid rgba(139, 92, 246, 0.16)",
          borderRadius: "var(--r2)",
          padding: "9px 11px",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}>
          <AlertCircle size={14} color="#8B5CF6" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.4 }}>
            Pay with MTN MoMo, M-Pesa, or Airtel Money across Africa. Also accepts international cards.
          </div>
        </div>

        <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
          <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 4 }}>Amount</div>
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
          />
        </div>

        <div>
          <label style={{ color: "var(--t2)", fontSize: 11, display: "block", marginBottom: 4 }}>Payment Method</label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
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
            <option value="all">All Methods Available</option>
            <option value="card">Debit/Credit Card</option>
            <option value="mobile_money">Mobile Money (MTN, M-Pesa, Airtel)</option>
          </select>
        </div>

        <button
          className="btn-p full"
          onClick={handleDeposit}
          disabled={!canDeposit || loading}
          style={{ opacity: (canDeposit && !loading) ? 1 : 0.5 }}
        >
          {loading ? "Processing…" : <><Globe size={12} /> Continue to Flutterwave</>}
        </button>
      </div>

      {showPinModal && (
        <TransactionPinModal
          amount={parsedAmt}
          recipient="Mobile Money"
          transactionType="deposit"
          description={`Deposit ₦${fmtNGN(parsedAmt)} via Flutterwave`}
          onConfirm={executeDeposit}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

// ── MAIN DEPOSIT TAB ────────────────────────────────────────────
export default function DepositTab({ onBack, onSuccess, onRefresh, pwBalance }) {
  const [view, setView] = useState("methods");
  const [loading, setLoading] = useState(false);

  return (
    <>
      {view === "methods" && (
        <DepositMethodSelector 
          onSelect={m => setView(m)} 
          loading={loading}
        />
      )}
      {view === "paystack" && (
        <PaystackDeposit 
          onBack={() => setView("methods")} 
          onSuccess={onSuccess}
          onRefresh={onRefresh}
        />
      )}
      {view === "opay" && (
        <OPayDeposit 
          onBack={() => setView("methods")} 
          onSuccess={onSuccess}
          onRefresh={onRefresh}
        />
      )}
      {view === "flutterwave" && (
        <FlutterwaveDeposit 
          onBack={() => setView("methods")} 
          onSuccess={onSuccess}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
