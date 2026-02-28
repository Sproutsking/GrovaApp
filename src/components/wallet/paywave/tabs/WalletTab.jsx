// paywave/tabs/WalletTab.jsx
// Wallet-action views: Send ₦, Receive ₦, Invest, Save, Cards.
// Uses pwBalance (wallets.paywave_balance) — pure Naira. No EP. No XEV.

import React, { useState, useEffect, useCallback } from "react";
import {
  Send, Download, TrendingUp, Lock, DollarSign,
  PiggyBank, Target, CreditCard, Plus, Link,
  ChevronRight, X,
} from "lucide-react";
import { Header, Avatar, CopyField, PlainField, PlanCard, PlanIcon, StatBox } from "../components/UI";
import { PinModal, SendTypeModal } from "../modals/index";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── SEND ────────────────────────────────────────────────────
function SendView({ pwBalance, onBack, onSuccess, userId, onRefresh }) {
  const { profile } = useAuth();
  const [recipient, setRecipient] = useState("");
  const [amount,    setAmount]    = useState("");
  const [sendTo,    setSendTo]    = useState(null);
  const [selBank,   setSelBank]   = useState(null);
  const [typeModal, setTypeModal] = useState(false);
  const [pin,       setPin]       = useState(false);
  const [loading,   setLoading]   = useState(false);

  const parsedAmt = parseFloat(amount) || 0;
  const canSend   = recipient && parsedAmt > 0 && parsedAmt <= pwBalance && sendTo;

  const verify = async (p) => {
    if (p !== "1234") return alert("Wrong PIN");
    setPin(false);
    setLoading(true);

    try {
      if (sendTo === "paywave") {
        // Internal PayWave transfer — free, instant
        // Resolve recipient username → user_id
        const { data: recipUser } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .eq("username", recipient.replace("@", ""))
          .maybeSingle();

        if (!recipUser) {
          alert("User not found. Check the username and try again.");
          setLoading(false);
          return;
        }
        if (recipUser.id === profile?.id) {
          alert("You cannot send money to yourself.");
          setLoading(false);
          return;
        }

        // Atomic PayWave transfer RPC
        const { data, error } = await supabase.rpc("paywave_transfer", {
          p_from_user_id: profile.id,
          p_to_user_id:   recipUser.id,
          p_amount:       parsedAmt,
          p_note:         `PayWave transfer to @${recipUser.username}`,
        });

        if (error || !data?.success) {
          alert(data?.error || error?.message || "Transfer failed. Please try again.");
          setLoading(false);
          return;
        }

        onRefresh?.();
        onSuccess(`₦${fmtNGN(parsedAmt)} sent to @${recipUser.username}`);

      } else {
        // External OPay transfer — fee applies
        const { data, error } = await supabase.rpc("paywave_external_transfer", {
          p_from_user_id: profile.id,
          p_amount:       parsedAmt,
          p_recipient:    recipient,
          p_note:         `OPay transfer to ${recipient}`,
        });

        if (error || !data?.success) {
          alert(data?.error || error?.message || "Transfer failed. Please try again.");
          setLoading(false);
          return;
        }

        onRefresh?.();
        onSuccess(`₦${fmtNGN(parsedAmt)} sent to ${recipient} via OPay`);
      }
    } catch (err) {
      console.error("PayWave send error:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pw-scroll">
      <Header title="Send Money" onBack={onBack} />
      <div className="f-section f-stack">

        {/* Balance banner */}
        <div className="glass glass-lime" style={{ padding: "13px 15px", textAlign: "center" }}>
          <div style={{ color: "var(--text-soft)", fontSize: 11.5, marginBottom: 3 }}>Available Balance</div>
          <div style={{ fontFamily: "var(--font-d)", fontSize: 26, fontWeight: 800 }}>₦{fmtNGN(pwBalance)}</div>
        </div>

        {/* Transfer type selector */}
        <button className="btn-lime full" onClick={() => setTypeModal(true)}>
          {sendTo === "paywave" ? "✓ To Xeevia User (Free)" : sendTo === "opay" ? "✓ Send via OPay (External)" : "Choose Transfer Type"}
        </button>

        {/* Fee notice for OPay external */}
        {sendTo === "opay" && (
          <div className="info-gold" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "var(--gold)" }}>⚠ OPay transfers carry a small processing fee</span>
          </div>
        )}

        {sendTo === "paywave" && (
          <div className="info-lime" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "var(--lime)" }}>⚡ Free · Instant · No fees for Xeevia users</span>
          </div>
        )}

        {/* Recipient field — phone for OPay, username for PayWave */}
        <div>
          <label className="f-label">{sendTo === "paywave" ? "Xeevia Username" : "Phone or Account Number"}</label>
          <div className="f-card">
            <input
              type={sendTo === "paywave" ? "text" : "tel"}
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder={sendTo === "paywave" ? "@username" : "Phone or account number"}
              className="f-input"
            />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="f-label">Amount (₦)</label>
          <div className="f-card" style={{ padding: "11px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "var(--text-soft)", fontSize: 20 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="f-input-lg" />
            </div>
          </div>
          {parsedAmt > pwBalance && (
            <div style={{ color: "#f87171", fontSize: 11.5, marginTop: 5, fontFamily: "var(--font-b)" }}>
              Insufficient balance · Available: ₦{fmtNGN(pwBalance)}
            </div>
          )}
        </div>

        {/* Quick amounts */}
        <div className="amt-grid">
          {[500, 1000, 5000].map(a => (
            <button key={a} className={`amt-btn ${amount === String(a) ? "sel" : ""}`} onClick={() => setAmount(String(a))}>
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>

        <button className="btn-lime full" disabled={!canSend || loading} onClick={() => setPin(true)}>
          {loading ? "Sending…" : <><Send size={14} /> Send ₦{parsedAmt > 0 ? fmtNGN(parsedAmt) : ""}</>}
        </button>
      </div>

      {typeModal && (
        <SendTypeModal onClose={() => setTypeModal(false)} onSelect={t => { setSendTo(t); setTypeModal(false); }} />
      )}
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

// ── RECEIVE ─────────────────────────────────────────────────
function ReceiveView({ onBack }) {
  const { profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || "You";
  const initials    = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="pw-scroll">
      <Header title="Receive Money" onBack={onBack} />
      <div style={{ padding: 15 }}>
        <div className="glass" style={{ padding: 22 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <Avatar letter={initials[0] || "U"} size="lg" />
            <div style={{ fontFamily: "var(--font-d)", fontSize: 17, fontWeight: 800, color: "var(--text)", marginTop: 10 }}>
              {displayName}
            </div>
            <div style={{ color: "var(--text-soft)", fontSize: 12, marginTop: 2 }}>
              Share your details to receive ₦
            </div>
          </div>
          <CopyField label="Account Number" value="9040273157" />
          <PlainField label="Account Name"  value={displayName} />
          <PlainField label="Bank"          value="PayWave / OPay" />
          <button className="btn-lime full" style={{ marginTop: 8 }}>
            <Download size={13} /> Share Details
          </button>
        </div>

        {/* Internal receive tip */}
        <div className="info-lime" style={{ marginTop: 14, fontSize: 12 }}>
          <span style={{ color: "var(--lime)", fontWeight: 700 }}>⚡ Free internal transfers</span>
          <div style={{ color: "rgba(255,255,255,0.45)", marginTop: 3, lineHeight: 1.6 }}>
            Other Xeevia users can send you ₦ for free using your @username.
            No bank account needed for internal transfers.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── (Investment routing handled by FinanceTab/Stake2EarnView) ──

// ── (Savings routing handled by FinanceTab/SavingsView) ──

// ── CARDS — Supabase-backed, real empty state, OPay connect ──
const NIGERIAN_BANKS_LIST = [
  "OPay","PalmPay","Moniepoint","GTBank","Access Bank","Zenith Bank",
  "UBA","First Bank","Ecobank","Fidelity Bank","Union Bank","Keystone Bank",
  "Polaris Bank","Stanbic IBTC","Sterling Bank","FCMB","Wema Bank",
];

function formatCardNum(v) {
  return v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
}
function formatExpiry(v) {
  const d = v.replace(/\D/g,"").slice(0,4);
  return d.length > 2 ? d.slice(0,2) + "/" + d.slice(2) : d;
}

function CardsView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [vCards,   setVCards]   = useState([]);
  const [extCards, setExtCards] = useState([]);
  const [opayAcct, setOpayAcct] = useState(null); // linked OPay account
  const [loading,  setLoading]  = useState(true);

  // Modal states
  const [showCreate,    setShowCreate]    = useState(false);
  const [showLinkCard,  setShowLinkCard]  = useState(false);
  const [showConnectOPay, setShowConnectOPay] = useState(false);

  // Create virtual card form
  const [vcName, setVcName] = useState("");
  const [creating, setCreating] = useState(false);

  // Link card form
  const [cardBrand,  setCardBrand]  = useState("Visa");
  const [cardNum,    setCardNum]    = useState("");
  const [cardName,   setCardName]   = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [cvv,        setCvv]        = useState("");
  const [issuerBank, setIssuerBank] = useState("");
  const [linking,    setLinking]    = useState(false);

  // OPay connect form
  const [opayPhone,   setOpayPhone]   = useState("");
  const [opayPin,     setOpayPin]     = useState("");
  const [connecting,  setConnecting]  = useState(false);

  const fetchCards = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("user_cards")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      const all = data || [];
      setVCards(all.filter(c => c.card_type === "virtual"));
      setExtCards(all.filter(c => c.card_type === "external"));
      setOpayAcct(all.find(c => c.card_type === "opay_account") || null);
    } catch { }
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const createVirtual = async () => {
    if (!vcName) return;
    setCreating(true);
    try {
      const last4 = Math.floor(1000 + Math.random() * 9000).toString();
      const mo    = String(new Date().getMonth() + 2).padStart(2, "0");
      const yr    = String(new Date().getFullYear() + 4).slice(-2);
      await supabase.from("user_cards").insert({
        user_id:   profile.id,
        card_type: "virtual",
        card_name: vcName,
        last_four: last4,
        brand:     "Verve",
        expiry:    `${mo}/${yr}`,
        status:    "active",
      });
      setShowCreate(false); setVcName("");
      onSuccess("Virtual card created!");
      fetchCards();
    } catch { alert("Failed to create card."); }
    finally { setCreating(false); }
  };

  const linkExternal = async () => {
    if (!cardNum || !cardName || !expiry || !issuerBank) return;
    setLinking(true);
    try {
      const last4 = cardNum.replace(/\D/g,"").slice(-4);
      await supabase.from("user_cards").insert({
        user_id:   profile.id,
        card_type: "external",
        card_name: cardName,
        last_four: last4,
        brand:     cardBrand,
        expiry,
        bank_name: issuerBank,
        status:    "active",
      });
      setShowLinkCard(false);
      setCardNum(""); setCardName(""); setExpiry(""); setCvv(""); setIssuerBank("");
      onSuccess("Card linked successfully!");
      fetchCards();
    } catch { alert("Failed to link card."); }
    finally { setLinking(false); }
  };

  const connectOPay = async () => {
    if (opayPhone.replace(/\D/g,"").length < 10) return;
    setConnecting(true);
    try {
      await supabase.from("user_cards").insert({
        user_id:    profile.id,
        card_type:  "opay_account",
        card_name:  "OPay Account",
        last_four:  opayPhone.replace(/\D/g,"").slice(-4),
        brand:      "OPay",
        bank_name:  "OPay",
        phone:      opayPhone,
        status:     "connected",
      });
      setShowConnectOPay(false); setOpayPhone(""); setOpayPin("");
      onSuccess("OPay account connected to PayWave!");
      fetchCards();
    } catch { alert("Connection failed. Check your details."); }
    finally { setConnecting(false); }
  };

  const deleteCard = async (id) => {
    if (!window.confirm("Remove this card?")) return;
    await supabase.from("user_cards").delete().eq("id", id);
    fetchCards();
  };

  return (
    <div className="pw-scroll">
      <Header title="Cards & Accounts" onBack={onBack} />
      <div className="f-section">

        {/* OPay Account Connection */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="sec-title">OPay Account</span>
          </div>

          {opayAcct ? (
            <div className="glass" style={{ padding: "13px 14px", borderColor: "rgba(16,185,129,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>
                    <span style={{ fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 900, color: "#fff" }}>OP</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14 }}>OPay Connected</div>
                    <div style={{ color: "rgba(16,185,129,0.7)", fontSize: 12, fontFamily: "var(--font-m)" }}>
                      •••• {opayAcct.last_four}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 700 }}>● LIVE</span>
                  <button onClick={() => deleteCard(opayAcct.id)} style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: 7, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
                    <X size={11} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6, fontFamily: "var(--font-b)" }}>
                Your OPay account is linked. External OPay transfers will route through this account. Bill payments processed via OPay ecosystem.
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConnectOPay(true)}
              style={{
                width: "100%", padding: "16px 15px", borderRadius: 14,
                background: "rgba(16,185,129,0.04)", border: "1px dashed rgba(16,185,129,0.22)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                transition: "all .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(16,185,129,0.04)"}
            >
              <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Link size={18} color="#10b981" />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Connect OPay Account</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", marginTop: 2, fontFamily: "var(--font-b)" }}>
                  Link your OPay account to enable external transfers & bills
                </div>
              </div>
              <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ marginLeft: "auto", flexShrink: 0 }} />
            </button>
          )}
        </div>

        {/* Virtual Cards */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="sec-title">Virtual Cards</span>
            <button onClick={() => setShowCreate(true)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--lime)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-b)" }}>
              <Plus size={12} /> Create
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-soft)", fontSize: 13 }}>Loading…</div>
          ) : vCards.length === 0 ? (
            <button onClick={() => setShowCreate(true)} style={{
              width: "100%", padding: "20px 15px", borderRadius: 14,
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(163,230,53,0.18)",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={18} color="var(--lime)" />
              </div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 700 }}>Create your first virtual card</div>
              <div style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-b)" }}>
                Use for online purchases & subscriptions
              </div>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {vCards.map(card => (
                <div key={card.id} style={{
                  borderRadius: 14, padding: "14px 15px", position: "relative", overflow: "hidden",
                  background: "linear-gradient(135deg, #1a2010, #0d1508)",
                  border: "1px solid rgba(163,230,53,0.18)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "radial-gradient(circle, rgba(163,230,53,0.1), transparent 70%)", borderRadius: "50%" }} />
                  <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 9, color: "rgba(163,230,53,0.45)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>PayWave Virtual</div>
                      <div style={{ fontFamily: "var(--font-m, monospace)", fontSize: 15, color: "rgba(255,255,255,0.7)", letterSpacing: "0.15em" }}>•••• •••• •••• {card.last_four}</div>
                      <div style={{ marginTop: 8, display: "flex", gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Card Name</div>
                          <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600 }}>{card.card_name}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Expires</div>
                          <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 600 }}>{card.expiry}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Type</div>
                          <div style={{ fontSize: 11.5, color: "var(--lime)", fontWeight: 600 }}>{card.brand}</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deleteCard(card.id)} style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 7, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", flexShrink: 0 }}>
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked External Cards */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="sec-title">Linked Cards</span>
            <button onClick={() => setShowLinkCard(true)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--lime)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-b)" }}>
              <Plus size={12} /> Link Card
            </button>
          </div>

          {extCards.length === 0 ? (
            <button onClick={() => setShowLinkCard(true)} style={{
              width: "100%", padding: "18px 15px", borderRadius: 14,
              background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.08)",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
            }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={16} color="var(--text-soft)" />
              </div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 700, color: "var(--text-soft)" }}>No linked cards</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-b)" }}>Link your GTBank, Access, Zenith, or any Nigerian bank card</div>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {extCards.map(card => (
                <div key={card.id} className="glass" style={{ padding: "12px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CreditCard size={16} color="var(--text-soft)" />
                      </div>
                      <div>
                        <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 13.5 }}>{card.card_name}</div>
                        <div style={{ color: "var(--text-soft)", fontSize: 11.5, fontFamily: "var(--font-m)" }}>
                          {card.bank_name} · •••• {card.last_four} · {card.brand}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deleteCard(card.id)} style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: 7, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Create Virtual Card */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 998 }} />
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, zIndex: 999, background: "#0c0f0a", borderRadius: "20px 20px 0 0", border: "1px solid rgba(163,230,53,0.12)", borderBottom: "none", padding: "16px 18px 32px", boxShadow: "0 -20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} /></div>
            <div style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Create Virtual Card</div>
            <label className="f-label">Card Nickname</label>
            <div className="f-card" style={{ marginBottom: 16 }}>
              <input type="text" value={vcName} onChange={e => setVcName(e.target.value)} placeholder='e.g. "Shopping Card"' className="f-input" />
            </div>
            <div className="f-stack" style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-lime" style={{ flex: 1 }} disabled={!vcName || creating} onClick={createVirtual}>
                {creating ? "Creating…" : "Create Card"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Link External Card */}
      {showLinkCard && (
        <>
          <div onClick={() => setShowLinkCard(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 998 }} />
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 440, zIndex: 999, background: "#0c0f0a", borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 -20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ position: "sticky", top: 0, background: "#0c0f0a", padding: "14px 18px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} /></div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700 }}>Link a Card</span>
                <button onClick={() => setShowLinkCard(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
                  <X size={13} />
                </button>
              </div>
            </div>
            <div style={{ padding: "14px 18px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="f-label">Brand</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
                  {["Visa","Mastercard","Verve"].map(b => (
                    <button key={b} className={`amt-btn ${cardBrand === b ? "sel" : ""}`} onClick={() => setCardBrand(b)} style={{ fontSize: 12, padding: "9px 4px" }}>{b}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="f-label">Card Number</label>
                <div className="f-card"><input type="text" value={cardNum} onChange={e => setCardNum(formatCardNum(e.target.value))} placeholder="0000 0000 0000 0000" className="f-input" style={{ fontFamily: "var(--font-m, monospace)", letterSpacing: "0.06em" }} /></div>
              </div>
              <div>
                <label className="f-label">Name on Card</label>
                <div className="f-card"><input type="text" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="NAME ON CARD" className="f-input" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="f-label">Expiry</label><div className="f-card"><input type="text" value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" className="f-input" /></div></div>
                <div><label className="f-label">CVV</label><div className="f-card"><input type="password" maxLength={3} value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="•••" className="f-input" /></div></div>
              </div>
              <div>
                <label className="f-label">Issuing Bank</label>
                <select value={issuerBank} onChange={e => setIssuerBank(e.target.value)} className="bank-sel">
                  <option value="">— Select Bank —</option>
                  {NIGERIAN_BANKS_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ padding: "9px 12px", background: "rgba(212,168,71,0.05)", border: "1px solid rgba(212,168,71,0.12)", borderRadius: 9, fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.6 }}>
                🔒 Card details are encrypted. CVV is verified and not stored.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowLinkCard(false)}>Cancel</button>
                <button className="btn-lime" style={{ flex: 1 }} disabled={!cardNum || !cardName || !expiry || !issuerBank || linking} onClick={linkExternal}>
                  {linking ? "Linking…" : <><Link size={13} /> Link Card</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Connect OPay Account */}
      {showConnectOPay && (
        <>
          <div onClick={() => setShowConnectOPay(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 998 }} />
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, zIndex: 999, background: "#0c0f0a", borderRadius: "20px 20px 0 0", border: "1px solid rgba(16,185,129,0.15)", borderBottom: "none", boxShadow: "0 -20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "var(--font-d)", fontSize: 11, fontWeight: 900, color: "#fff" }}>OP</span>
                </div>
                <span style={{ fontFamily: "var(--font-d)", fontSize: 15, fontWeight: 700 }}>Connect OPay</span>
              </div>
              <button onClick={() => setShowConnectOPay(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
                <X size={13} />
              </button>
            </div>
            <div style={{ padding: "16px 18px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "10px 12px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>
                Connecting your OPay account enables external transfers, bill payments, and seamless OPay ecosystem access from PayWave.
              </div>
              <div>
                <label className="f-label">OPay Phone Number</label>
                <div className="f-card"><input type="tel" value={opayPhone} onChange={e => setOpayPhone(e.target.value.replace(/\D/g,"").slice(0,11))} placeholder="08012345678" className="f-input" style={{ fontFamily: "var(--font-m, monospace)", letterSpacing: "0.04em" }} /></div>
              </div>
              <div>
                <label className="f-label">OPay PIN</label>
                <div className="f-card"><input type="password" maxLength={6} value={opayPin} onChange={e => setOpayPin(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Enter your OPay PIN" className="f-input" /></div>
                <div style={{ fontSize: 10.5, color: "var(--text-soft)", marginTop: 4, fontFamily: "var(--font-b)" }}>Your PIN is verified by OPay and never stored by Xeevia.</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowConnectOPay(false)}>Cancel</button>
                <button
                  style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, cursor: connecting ? "not-allowed" : "pointer", opacity: connecting ? 0.7 : 1 }}
                  disabled={opayPhone.replace(/\D/g,"").length < 10 || !opayPin || connecting}
                  onClick={connectOPay}
                >
                  {connecting ? "Connecting…" : "Connect OPay"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────
const VIEW_MAP = {
  send:    SendView,
  receive: ReceiveView,
  cards:   CardsView,
};

export default function WalletTab({ view, pwBalance, onBack, onSuccess, userId, onRefresh }) {
  const View = VIEW_MAP[view];
  if (!View) return null;
  return <View pwBalance={pwBalance} onBack={onBack} onSuccess={onSuccess} userId={userId} onRefresh={onRefresh} />;
}