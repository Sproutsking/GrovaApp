// src/components/Auth/PaywallGate.jsx
// ============================================================================
// PAYWALL GATE — Shown only when profile.account_activated is false.
// Once the user pays (any provider), the Edge Function sets account_activated=true.
// AuthContext picks this up on the next profile refresh.
// This component never renders again for that user — ever.
//
// CRA compatible: process.env.REACT_APP_ prefix (no Vite imports)
// Supports: Paystack (card/bank/mobile money) + Web3 (EVM stablecoins)
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth }      from "./AuthContext";
import { usePayment }   from "../../hooks/usePayment";
import {
  fetchPaymentProducts,
  clearIdempotencyKey,
} from "../../services/wallet/paymentService";

// ── Supported Web3 chains ─────────────────────────────────────────────────────
const WEB3_CHAINS = [
  { id: "polygon",  label: "Polygon",  chainType: "EVM", emoji: "💜", note: "Cheapest fees ~$0.01" },
  { id: "base",     label: "Base",     chainType: "EVM", emoji: "🔵", note: "Cheap & fast" },
  { id: "arbitrum", label: "Arbitrum", chainType: "EVM", emoji: "🔷", note: "Low fees, Ethereum security" },
  { id: "ethereum", label: "Ethereum", chainType: "EVM", emoji: "⬡",  note: "Higher fees" },
  { id: "bnb",      label: "BNB Chain",chainType: "EVM", emoji: "🟡", note: "Fast & cheap" },
];

// Treasury wallet from CRA env var — never hardcoded
const TREASURY_WALLET = process.env.REACT_APP_TREASURY_WALLET ?? "";

// ── Keyframe CSS (injected once) ──────────────────────────────────────────────
const STYLES = `
  @keyframes xvSpin    { to { transform: rotate(360deg); } }
  @keyframes xvFadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes xvPulse   { 0%,100% { opacity:1; } 50% { opacity:.5; } }
`;

// ── Design tokens (matches AuthWall.jsx style) ────────────────────────────────
const C = {
  green:     "#84cc16",
  greenDim:  "rgba(132,204,22,0.08)",
  greenBord: "rgba(132,204,22,0.22)",
  border:    "rgba(255,255,255,0.07)",
  surface:   "rgba(255,255,255,0.02)",
  text:      "#e8e8e8",
  muted:     "#3a3a3a",
  err:       "#fca5a5",
  errBg:     "rgba(239,68,68,0.07)",
  errBord:   "rgba(239,68,68,0.2)",
};

// ── Small UI atoms ────────────────────────────────────────────────────────────

function Spinner({ size = 22 }) {
  return (
    <div style={{
      width:    size, height:    size,
      border:   `2.5px solid rgba(132,204,22,0.12)`,
      borderTop:`2.5px solid ${C.green}`,
      borderRadius: "50%",
      animation:"xvSpin .6s linear infinite",
      flexShrink: 0,
    }} />
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{
      display:"flex", gap:10, alignItems:"flex-start",
      background: C.errBg, border:`1px solid ${C.errBord}`,
      borderRadius:10, color: C.err, fontSize:13,
      padding:"11px 14px", lineHeight:1.55,
      animation:"xvFadeUp .3s ease both",
    }}>
      <span style={{ flexShrink:0, marginTop:1 }}>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize:9, color: C.green, letterSpacing:"3.5px",
      textTransform:"uppercase", fontWeight:700, textAlign:"center",
    }}>
      {children}
    </div>
  );
}

function PrimaryButton({ onClick, disabled, loading, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width:"100%", padding:"15px 20px", borderRadius:13, border:"none",
        background: (disabled || loading)
          ? "rgba(255,255,255,0.04)"
          : "linear-gradient(135deg, #a3e635 0%, #5c9b0a 100%)",
        color:      (disabled || loading) ? "#2a2a2a" : "#071200",
        fontWeight: 800, fontSize:15, cursor:(disabled||loading)?"not-allowed":"pointer",
        fontFamily:"inherit", boxSizing:"border-box", transition:"all .15s",
        boxShadow:  (disabled||loading) ? "none" : "0 4px 28px rgba(132,204,22,0.25)",
        display:"flex", alignItems:"center", justifyContent:"center", gap:10,
      }}
    >
      {loading ? <Spinner size={20} /> : null}
      {children}
    </button>
  );
}

// ── Success Screen ─────────────────────────────────────────────────────────────
function SuccessScreen() {
  return (
    <div style={{ textAlign:"center", padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:18, animation:"xvFadeUp .5s ease both" }}>
      <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(132,204,22,0.1)", border:`2px solid ${C.green}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30 }}>
        ✓
      </div>
      <h2 style={{ color:"#f2f2f2", fontSize:22, fontWeight:800, margin:0 }}>
        Account Activated!
      </h2>
      <p style={{ color: C.muted, fontSize:14, margin:0 }}>
        Welcome to Xeevia. Setting up your experience…
      </p>
      <Spinner size={24} />
    </div>
  );
}

// ── Pending Confirmations Screen ───────────────────────────────────────────────
function PendingScreen({ info, onRetry }) {
  const waitMin = info ? Math.ceil((info.estimatedWaitSeconds ?? 60) / 60) : 1;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"xvFadeUp .4s ease both" }}>
      <div style={{ textAlign:"center", padding:"24px 0 8px" }}>
        <div style={{ fontSize:32, animation:"xvPulse 2s ease infinite" }}>⏳</div>
      </div>
      <div style={{ background:"rgba(132,204,22,0.03)", border:`1px solid ${C.greenBord}`, borderRadius:12, padding:"16px 18px" }}>
        <div style={{ color: C.text, fontWeight:700, marginBottom:8 }}>Transaction Found — Waiting for Confirmations</div>
        <div style={{ color: C.muted, fontSize:13, lineHeight:1.65 }}>
          Your transaction is on-chain and being confirmed.
          {info && (
            <><br/>Confirmations: <span style={{ color: C.green, fontWeight:700 }}>{info.confirmations}/{info.required}</span></>
          )}
          <br/>Estimated wait: <span style={{ color: C.text }}>~{waitMin} minute{waitMin !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <p style={{ color: C.muted, fontSize:12, textAlign:"center", margin:0, lineHeight:1.65 }}>
        This page will not automatically update. Once the wait time passes,
        paste your transaction hash again and click Verify to complete activation.
      </p>
      <button
        onClick={onRetry}
        style={{ background:"none", border:`1px solid ${C.greenBord}`, borderRadius:10, color: C.green, fontWeight:700, fontSize:13, padding:"11px", cursor:"pointer", fontFamily:"inherit" }}
      >
        Try Again Now
      </button>
    </div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({ product, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(product)}
      style={{
        flex:1, padding:"12px 14px", borderRadius:12, border:`1.5px solid ${selected ? C.greenBord : C.border}`,
        background: selected ? C.greenDim : C.surface, cursor:"pointer", fontFamily:"inherit",
        display:"flex", justifyContent:"space-between", alignItems:"center", transition:"all .15s",
      }}
    >
      <div style={{ textAlign:"left" }}>
        <div style={{ color:"#ccc", fontSize:13, fontWeight:600 }}>{product.name}</div>
        {product.type === "subscription" && (
          <div style={{ color: C.muted, fontSize:11, marginTop:2 }}>per {product.interval}</div>
        )}
        {product.description && (
          <div style={{ color: C.muted, fontSize:11, marginTop:2 }}>{product.description}</div>
        )}
      </div>
      <span style={{ color: C.green, fontWeight:900, fontSize:20, flexShrink:0, marginLeft:12 }}>
        ${product.amount_usd}
      </span>
    </button>
  );
}

// ── Provider Tab ───────────────────────────────────────────────────────────────
function ProviderTab({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        flex:1, padding:"10px 8px", borderRadius:10,
        border:`1px solid ${active ? C.greenBord : C.border}`,
        background: active ? C.greenDim : "transparent",
        color: active ? C.green : C.muted,
        cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700,
        transition:"all .15s",
      }}
    >
      {label}
    </button>
  );
}

// ── Web3 Panel ────────────────────────────────────────────────────────────────
function Web3Panel({ product, onSubmit, loading, error, reset }) {
  const [selectedChain, setSelectedChain] = useState(WEB3_CHAINS[0]);
  const [walletAddress, setWalletAddress] = useState("");
  const [txHash,        setTxHash]        = useState("");
  const [copied,        setCopied]        = useState(false);

  const copyTreasury = () => {
    if (!TREASURY_WALLET) return;
    navigator.clipboard.writeText(TREASURY_WALLET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canSubmit =
    walletAddress.startsWith("0x") && walletAddress.length === 42 &&
    txHash.startsWith("0x")        && txHash.length === 66;

  const handleSubmit = () => {
    if (!canSubmit || loading) return;
    reset();
    onSubmit({
      chainType:    selectedChain.chainType,
      chain:        selectedChain.id,
      txHash:       txHash.trim(),
      walletAddress: walletAddress.trim(),
    });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Step 1: Send payment */}
      <div style={{ background: C.surface, border:`1px solid ${C.greenBord}`, borderRadius:12, padding:"14px 16px" }}>
        <div style={{ color: C.muted, fontSize:11, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:10 }}>
          Step 1 — Send Payment
        </div>
        <div style={{ color:"#bbb", fontSize:13, lineHeight:1.65, marginBottom:10 }}>
          Send exactly{" "}
          <span style={{ color: C.green, fontWeight:800 }}>
            ${product?.amount_usd ?? "—"} USDT or USDC
          </span>{" "}
          to this address on your chosen chain:
        </div>
        <div
          onClick={copyTreasury}
          style={{
            background:"rgba(0,0,0,0.5)", border:`1px solid ${C.greenBord}`, borderRadius:8,
            padding:"10px 12px", fontFamily:"'DM Mono','Fira Mono',monospace",
            fontSize:11, color: C.green, wordBreak:"break-all", cursor:"pointer",
            userSelect:"all", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
          }}
        >
          <span>{TREASURY_WALLET || "REACT_APP_TREASURY_WALLET not configured"}</span>
          <span style={{ flexShrink:0, color: copied ? "#a3e635" : C.muted, fontSize:13 }}>
            {copied ? "✓" : "⎘"}
          </span>
        </div>
        <div style={{ color: C.muted, fontSize:11, marginTop:8 }}>
          ⚠️ Only send USDT or USDC — no other tokens accepted. Send the exact amount.
        </div>
      </div>

      {/* Step 2: Select chain */}
      <div>
        <div style={{ color: C.muted, fontSize:11, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:8 }}>
          Step 2 — Select Chain
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {WEB3_CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c)}
              style={{
                padding:"10px 12px", borderRadius:10, fontFamily:"inherit",
                border:`1px solid ${selectedChain.id === c.id ? C.greenBord : C.border}`,
                background: selectedChain.id === c.id ? C.greenDim : "transparent",
                color: selectedChain.id === c.id ? C.text : C.muted,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between",
                transition:"all .15s",
              }}
            >
              <span style={{ fontWeight:600, fontSize:13 }}>{c.emoji} {c.label}</span>
              <span style={{ fontSize:11, color: C.muted }}>{c.note}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Enter details */}
      <div>
        <div style={{ color: C.muted, fontSize:11, fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:8 }}>
          Step 3 — Enter Transaction Details
        </div>
        <input
          placeholder="Your sending wallet address (0x...)"
          value={walletAddress}
          onChange={(e) => { setWalletAddress(e.target.value.trim()); reset(); }}
          style={{
            width:"100%", background:"rgba(255,255,255,0.03)", border:`1px solid ${C.border}`,
            borderRadius:10, padding:"12px 14px", color: C.text, fontFamily:"'DM Mono','Fira Mono',monospace",
            fontSize:12, outline:"none", boxSizing:"border-box", marginBottom:10, caretColor: C.green,
          }}
        />
        <input
          placeholder="Transaction hash (0x... — 66 characters)"
          value={txHash}
          onChange={(e) => { setTxHash(e.target.value.trim()); reset(); }}
          style={{
            width:"100%", background:"rgba(255,255,255,0.03)", border:`1px solid ${C.border}`,
            borderRadius:10, padding:"12px 14px", color: C.text, fontFamily:"'DM Mono','Fira Mono',monospace",
            fontSize:12, outline:"none", boxSizing:"border-box", caretColor: C.green,
          }}
        />
      </div>

      {error && <ErrorBox message={error} />}

      <PrimaryButton onClick={handleSubmit} disabled={!canSubmit} loading={loading}>
        {loading ? "Verifying on blockchain…" : "Verify & Activate Account →"}
      </PrimaryButton>
    </div>
  );
}

// ── Main PaywallGate ───────────────────────────────────────────────────────────
export default function PaywallGate() {
  const { user, profile, refreshProfile } = useAuth();
  const { loading, error, status, pendingInfo, initiatePayment, applyCode, reset } = usePayment();

  const [products,        setProducts]        = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [provider,        setProvider]        = useState("paystack");
  const [inviteCode,      setInviteCode]      = useState("");
  const [inviteLoading,   setInviteLoading]   = useState(false);
  const [inviteError,     setInviteError]     = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load products
  useEffect(() => {
    fetchPaymentProducts()
      .then((data) => {
        if (!mountedRef.current) return;
        setProducts(data);
        setSelectedProduct(data[0] ?? null);
      })
      .catch((e) => console.error("[PaywallGate] Products:", e))
      .finally(() => { if (mountedRef.current) setProductsLoading(false); });
  }, []);

  // ── Handle Paystack callback return ─────────────────────────────────────────
  // When Paystack redirects back to our app after payment, we poll the profile
  // until account_activated is true (set by the webhook) or we time out.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref    = params.get("ref") || params.get("reference") || params.get("trxref");
    if (!ref) return;

    // Clear the URL params — don't leave payment refs in the browser history
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    // Clear the pending keys from sessionStorage
    const pendingProductId = sessionStorage.getItem("xv_pending_product");
    if (pendingProductId) {
      clearIdempotencyKey(pendingProductId);
      sessionStorage.removeItem("xv_pending_product");
      sessionStorage.removeItem("xv_pending_ref");
    }

    // Poll profile until activated or 60 seconds elapsed
    let attempts = 0;
    const maxAttempts = 30;
    const poll = setInterval(async () => {
      await refreshProfile();
      attempts++;
      if (attempts >= maxAttempts) clearInterval(poll);
    }, 2000);

    return () => clearInterval(poll);
  }, [refreshProfile]);

  const handlePaystackPay = useCallback(() => {
    if (!selectedProduct || loading) return;
    reset();
    initiatePayment({ productId: selectedProduct.id, provider: "paystack" });
  }, [selectedProduct, loading, initiatePayment, reset]);

  const handleWeb3Submit = useCallback(({ chainType, chain, txHash, walletAddress }) => {
    if (!selectedProduct || loading) return;
    initiatePayment({
      productId: selectedProduct.id,
      provider:  "web3",
      chainType,
      chain,
      txHash,
      walletAddress,
      onSuccess: refreshProfile,
    });
  }, [selectedProduct, loading, initiatePayment, refreshProfile]);

  const handleInvite = useCallback(async () => {
    if (!inviteCode.trim() || inviteLoading) return;
    if (!mountedRef.current) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      await applyCode({
        code: inviteCode,
        userId: user?.id,
        products,
        onSuccess: refreshProfile,
      });
    } catch (e) {
      if (mountedRef.current) setInviteError(e?.message ?? "Invalid code");
    } finally {
      if (mountedRef.current) setInviteLoading(false);
    }
  }, [inviteCode, inviteLoading, applyCode, user?.id, products, refreshProfile]);

  // ── Render states ─────────────────────────────────────────────────────────

  // Already paid — this check is also the guard in AuthWall, but belt-and-suspenders
  if (profile?.account_activated) {
    return <SuccessScreen />;
  }

  if (status === "completed") {
    // Trigger profile refresh then show success
    refreshProfile();
    return <SuccessScreen />;
  }

  if (status === "pending_confirmations") {
    return <PendingScreen info={pendingInfo} onRetry={reset} />;
  }

  if (status === "redirecting") {
    return (
      <div style={{ textAlign:"center", padding:"40px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <Spinner size={30} />
        <p style={{ color: C.muted, fontSize:14, margin:0 }}>Redirecting to Paystack…</p>
        <p style={{ color:"#1a1a1a", fontSize:12, margin:0 }}>
          Do not close this tab. You will be redirected back automatically after payment.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%" }}>
      <style>{STYLES}</style>

      <SectionLabel>Activate Your Account</SectionLabel>

      {/* Product selection */}
      {productsLoading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:"16px 0" }}>
          <Spinner size={28} />
        </div>
      ) : products.length === 0 ? (
        <div style={{ color: C.muted, fontSize:13, textAlign:"center", padding:"16px 0" }}>
          No products available. Please contact support.
        </div>
      ) : (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              selected={selectedProduct?.id === p.id}
              onSelect={(prod) => { setSelectedProduct(prod); clearIdempotencyKey(prod.id); reset(); }}
            />
          ))}
        </div>
      )}

      {/* Provider tabs */}
      <div style={{ display:"flex", gap:8 }}>
        <ProviderTab id="paystack" label="🏦 Card / Bank"  active={provider === "paystack"} onClick={(id) => { setProvider(id); reset(); }} />
        <ProviderTab id="web3"    label="🪙 Crypto (USDC/USDT)" active={provider === "web3"} onClick={(id) => { setProvider(id); reset(); }} />
      </div>

      {/* Provider content */}
      {provider === "paystack" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background: C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ color:"#bbb", fontSize:13, lineHeight:1.7 }}>
              Pay with your <strong style={{ color: C.text }}>debit/credit card</strong>, bank transfer,
              or mobile money via Paystack.
              You will be redirected to Paystack's secure checkout and brought back here automatically.
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {status === "creating" ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"16px" }}>
              <Spinner size={22} />
              <span style={{ color: C.muted, fontSize:13 }}>Creating secure session…</span>
            </div>
          ) : (
            <PrimaryButton
              onClick={handlePaystackPay}
              disabled={!selectedProduct || productsLoading}
              loading={loading && status === "creating"}
            >
              Pay ${selectedProduct?.amount_usd ?? "—"} with Paystack →
            </PrimaryButton>
          )}
        </div>
      )}

      {provider === "web3" && (
        <Web3Panel
          product={selectedProduct}
          onSubmit={handleWeb3Submit}
          loading={loading}
          error={error}
          reset={reset}
        />
      )}

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0" }}>
        <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.05)" }} />
        <span style={{ color:"#1c1c1c", fontSize:11, fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase" }}>or</span>
        <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.05)" }} />
      </div>

      {/* Invite code */}
      <div style={{ display:"flex", gap:10 }}>
        <input
          type="text"
          placeholder="Invite or VIP code"
          value={inviteCode}
          onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setInviteError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          style={{
            flex:1, background:"rgba(255,255,255,0.03)", border:`1px solid ${C.border}`,
            borderRadius:10, padding:"12px 14px", color: C.text, fontFamily:"inherit",
            fontSize:13, outline:"none", letterSpacing:"1.5px", caretColor: C.green,
          }}
        />
        <button
          onClick={handleInvite}
          disabled={inviteLoading || !inviteCode.trim()}
          style={{
            padding:"12px 18px", borderRadius:10, border:`1px solid ${C.greenBord}`,
            background:"transparent", color: C.green, fontWeight:700, fontSize:13,
            cursor:(inviteLoading || !inviteCode.trim()) ? "not-allowed" : "pointer",
            fontFamily:"inherit", whiteSpace:"nowrap",
          }}
        >
          {inviteLoading ? "…" : "Apply"}
        </button>
      </div>

      {inviteError && <ErrorBox message={inviteError} />}

      <p style={{ textAlign:"center", color:"#181818", fontSize:11, margin:"2px 0 0", lineHeight:1.7 }}>
        One-time payment. No hidden fees. Crypto fees are network fees, not ours.
        <br />Your account is activated instantly after payment confirmation.
      </p>
    </div>
  );
}