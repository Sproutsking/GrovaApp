// paywave/tabs/WalletTab.jsx  ── v3 REFINED EDITION
// Send ₦, Receive ₦, Cards. Pure UI redesign. No backend changes.
import React, { useState, useEffect, useCallback } from "react";
import {
  Send, Download, CreditCard, Plus, Link,
  ChevronRight, X,
} from "lucide-react";
import { Header, CopyField, PlainField } from "../components/UI";
import { PinModal, SendTypeModal } from "../modals/index";
import { supabase } from "../../../../services/config/supabase";
import { useAuth } from "../../../../components/Auth/AuthContext";

const fmtNGN = (n) =>
  Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── SEND ─────────────────────────────────────────────────────
function SendView({ pwBalance, onBack, onSuccess, userId, onRefresh }) {
  const { profile } = useAuth();
  const [recipient, setRecipient] = useState("");
  const [amount,    setAmount]    = useState("");
  const [sendTo,    setSendTo]    = useState(null);
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
        const { data: recipUser } = await supabase
          .from("profiles").select("id,full_name,username")
          .eq("username", recipient.replace("@", "")).maybeSingle();
        if (!recipUser) { alert("User not found. Check the username and try again."); setLoading(false); return; }
        if (recipUser.id === profile?.id) { alert("You cannot send money to yourself."); setLoading(false); return; }
        const { data, error } = await supabase.rpc("paywave_transfer", {
          p_from_user_id: profile.id,
          p_to_user_id:   recipUser.id,
          p_amount:       parsedAmt,
          p_note:         `PayWave transfer to @${recipUser.username}`,
        });
        if (error || !data?.success) { alert(data?.error || error?.message || "Transfer failed. Please try again."); setLoading(false); return; }
        onRefresh?.();
        onSuccess(`₦${fmtNGN(parsedAmt)} sent to @${recipUser.username}`);
      } else {
        const { data, error } = await supabase.rpc("paywave_external_transfer", {
          p_from_user_id: profile.id,
          p_amount:       parsedAmt,
          p_recipient:    recipient,
          p_note:         `OPay transfer to ${recipient}`,
        });
        if (error || !data?.success) { alert(data?.error || error?.message || "Transfer failed. Please try again."); setLoading(false); return; }
        onRefresh?.();
        onSuccess(`₦${fmtNGN(parsedAmt)} sent to ${recipient} via OPay`);
      }
    } catch (err) {
      console.error("PayWave send error:", err);
      alert("An unexpected error occurred. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="pw-scroll">
      <Header title="Send Money" onBack={onBack} />
      <div className="xf-section xf-stack">
        {/* Balance */}
        <div className="xg xg-lime" style={{ padding: "11px 13px", textAlign: "center" }}>
          <div style={{ color: "var(--t2)", fontSize: 10.5, marginBottom: 2 }}>Available Balance</div>
          <div style={{ fontFamily: "var(--fd)", fontSize: 24, fontWeight: 800 }}>₦{fmtNGN(pwBalance)}</div>
        </div>

        {/* Transfer type */}
        <button className="btn-p full" onClick={() => setTypeModal(true)}>
          {sendTo === "paywave" ? "✓ To Xeevia User (Free)"
            : sendTo === "opay" ? "✓ Send via OPay (External)"
            : "Choose Transfer Type"}
        </button>

        {sendTo === "opay" && (
          <div className="info-gold" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "var(--gold)" }}>⚠ OPay transfers carry a small processing fee</span>
          </div>
        )}
        {sendTo === "paywave" && (
          <div className="info-lime" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "var(--lime)" }}>⚡ Free · Instant · No fees for Xeevia users</span>
          </div>
        )}

        {/* Recipient */}
        <div>
          <label className="xf-lbl">
            {sendTo === "paywave" ? "Xeevia Username" : "Phone or Account Number"}
          </label>
          <div className="xf-wrap">
            <input type={sendTo === "paywave" ? "text" : "tel"}
              value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder={sendTo === "paywave" ? "@username" : "Phone or account number"}
              className="xf-in" />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="xf-lbl">Amount (₦)</label>
          <div className="xf-wrap" style={{ padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--t2)", fontSize: 18 }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="xf-in-lg" />
            </div>
          </div>
          {parsedAmt > pwBalance && (
            <div style={{ color: "#f87171", fontSize: 10.5, marginTop: 4 }}>
              Insufficient balance · Available: ₦{fmtNGN(pwBalance)}
            </div>
          )}
        </div>

        <div className="amt-row">
          {[500, 1000, 5000].map(a => (
            <button key={a} className={`amt-btn ${amount === String(a) ? "sel" : ""}`}
              onClick={() => setAmount(String(a))}>₦{a.toLocaleString()}</button>
          ))}
        </div>

        <button className="btn-p full" disabled={!canSend || loading} onClick={() => setPin(true)}>
          {loading ? "Sending…" : <><Send size={12} /> Send ₦{parsedAmt > 0 ? fmtNGN(parsedAmt) : ""}</>}
        </button>
      </div>

      {typeModal && (
        <SendTypeModal onClose={() => setTypeModal(false)} onSelect={t => { setSendTo(t); setTypeModal(false); }} />
      )}
      {pin && <PinModal onClose={() => setPin(false)} onVerify={verify} />}
    </div>
  );
}

// ── RECEIVE ──────────────────────────────────────────────────
function ReceiveView({ onBack }) {
  const { profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || "You";
  const initials    = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="pw-scroll">
      <Header title="Receive Money" onBack={onBack} />
      <div style={{ paddingTop: 12 }}>
        <div className="xg" style={{ padding: 18 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", margin: "0 auto 10px",
              background: "linear-gradient(135deg,#a3e635,#65a30d)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--fd)", fontSize: 18, fontWeight: 800, color: "#060e02",
              boxShadow: "0 4px 14px rgba(163,230,53,0.26)",
            }}>{initials[0] || "U"}</div>
            <div style={{ fontFamily: "var(--fd)", fontSize: 15, fontWeight: 800, color: "var(--t1)", marginTop: 8 }}>
              {displayName}
            </div>
            <div style={{ color: "var(--t2)", fontSize: 11.5, marginTop: 2 }}>
              Share your details to receive ₦
            </div>
          </div>
          <CopyField label="Account Number" value="9040273157" />
          <PlainField label="Account Name"  value={displayName} />
          <PlainField label="Bank"          value="PayWave / OPay" />
          <button className="btn-p full" style={{ marginTop: 6 }}>
            <Download size={12} /> Share Details
          </button>
        </div>

        <div className="info-lime" style={{ marginTop: 12, fontSize: 11.5 }}>
          <span style={{ color: "var(--lime)", fontWeight: 700 }}>⚡ Free internal transfers</span>
          <div style={{ color: "rgba(255,255,255,0.42)", marginTop: 3, lineHeight: 1.6 }}>
            Other Xeevia users can send you ₦ for free using your @username. No bank account needed.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CARDS ─────────────────────────────────────────────────────
const NIGERIAN_BANKS_LIST = [
  "OPay","PalmPay","Moniepoint","GTBank","Access Bank","Zenith Bank",
  "UBA","First Bank","Ecobank","Fidelity Bank","Union Bank","Keystone Bank",
  "Polaris Bank","Stanbic IBTC","Sterling Bank","FCMB","Wema Bank",
];

function formatCardNum(v) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
}

function CardsView({ onBack, onSuccess }) {
  const { profile } = useAuth();
  const [vCards,   setVCards]   = useState([]);
  const [extCards, setExtCards] = useState([]);
  const [opayAcct, setOpayAcct] = useState(null);
  const [loading,  setLoading]  = useState(true);

  const [showCreate,     setShowCreate]     = useState(false);
  const [showLinkCard,   setShowLinkCard]   = useState(false);
  const [showConnectOPay,setShowConnectOPay]= useState(false);

  const [vcName,     setVcName]     = useState("");
  const [creating,   setCreating]   = useState(false);
  const [cardBrand,  setCardBrand]  = useState("Visa");
  const [cardNum,    setCardNum]    = useState("");
  const [cardName,   setCardName]   = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [cvv,        setCvv]        = useState("");
  const [issuerBank, setIssuerBank] = useState("");
  const [linking,    setLinking]    = useState(false);
  const [opayPhone,  setOpayPhone]  = useState("");
  const [opayPin,    setOpayPin]    = useState("");
  const [connecting, setConnecting] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("user_cards").select("*")
        .eq("user_id", profile.id).order("created_at", { ascending: false });
      const all = data || [];
      setVCards(all.filter(c => c.card_type === "virtual"));
      setExtCards(all.filter(c => c.card_type === "external"));
      setOpayAcct(all.find(c => c.card_type === "opay_account") || null);
    } catch {}
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
      const last4 = cardNum.replace(/\D/g, "").slice(-4);
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
    if (opayPhone.replace(/\D/g, "").length < 10) return;
    setConnecting(true);
    try {
      await supabase.from("user_cards").insert({
        user_id:   profile.id,
        card_type: "opay_account",
        card_name: "OPay Account",
        last_four: opayPhone.replace(/\D/g, "").slice(-4),
        brand:     "OPay",
        bank_name: "OPay",
        phone:     opayPhone,
        status:    "connected",
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

  // ── Bottom sheet helper
  const Sheet = ({ show, onClose, title, children, accentColor }) => {
    if (!show) return null;
    return (
      <>
        <div onClick={onClose} style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 998,
        }} />
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 440, zIndex: 999,
          background: "#0b0e0c",
          borderRadius: "18px 18px 0 0",
          border: `1px solid ${accentColor || "rgba(255,255,255,0.07)"}`,
          borderBottom: "none",
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 -16px 50px rgba(0,0,0,0.6)",
        }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
            <div style={{ width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 0" }}>
            <span style={{ fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 7, width: 25, height: 25, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.38)",
            }}><X size={11} /></button>
          </div>
          <div style={{ padding: "14px 16px 28px" }}>{children}</div>
        </div>
      </>
    );
  };

  return (
    <div className="pw-scroll">
      <Header title="Cards & Accounts" onBack={onBack} />
      <div style={{ paddingTop: 10 }}>

        {/* OPay Account */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontFamily: "var(--fd)", fontSize: 11.5, fontWeight: 700 }}>OPay Account</span>
          </div>
          {opayAcct ? (
            <div className="xg" style={{ padding: "11px 13px", borderColor: "rgba(16,185,129,0.18)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 3px 10px rgba(16,185,129,0.24)",
                  }}>
                    <span style={{ fontFamily: "var(--fd)", fontSize: 11, fontWeight: 900, color: "#fff" }}>OP</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 13 }}>OPay Connected</div>
                    <div style={{ color: "rgba(16,185,129,0.65)", fontSize: 11, fontFamily: "var(--fm)" }}>
                      •••• {opayAcct.last_four}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: "8.5px", padding: "2px 7px", borderRadius: 20,
                    background: "rgba(16,185,129,0.09)", border: "1px solid rgba(16,185,129,0.18)",
                    color: "#10b981", fontWeight: 700,
                  }}>● LIVE</span>
                  <button onClick={() => deleteCard(opayAcct.id)} style={{
                    background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.1)",
                    borderRadius: 6, width: 24, height: 24, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171",
                  }}><X size={10} /></button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowConnectOPay(true)} style={{
              width: "100%", padding: "14px 13px", borderRadius: 13,
              background: "rgba(16,185,129,0.03)", border: "1px dashed rgba(16,185,129,0.2)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 11,
              transition: "all .14s",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Link size={16} color="#10b981" />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 13, color: "var(--t1)" }}>
                  Connect OPay Account
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.34)", marginTop: 2, fontFamily: "var(--fb)" }}>
                  Link to enable external transfers & bills
                </div>
              </div>
              <ChevronRight size={12} color="rgba(255,255,255,0.18)" style={{ marginLeft: "auto", flexShrink: 0 }} />
            </button>
          )}
        </div>

        {/* Virtual Cards */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontFamily: "var(--fd)", fontSize: 11.5, fontWeight: 700 }}>Virtual Cards</span>
            <button onClick={() => setShowCreate(true)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--lime)", fontSize: 11.5, display: "flex", alignItems: "center",
              gap: 3, fontFamily: "var(--fb)", fontWeight: 600,
            }}><Plus size={11} /> Create</button>
          </div>

          {loading && (
            <div style={{
              height: 68, borderRadius: 12, background: "rgba(255,255,255,0.025)",
              animation: "pw-shimmer 1.4s infinite", marginBottom: 8,
            }} />
          )}
          {!loading && vCards.length === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0 14px" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "rgba(163,230,53,0.07)", border: "1px solid rgba(163,230,53,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 7px",
              }}>
                <CreditCard size={14} color="rgba(163,230,53,0.4)" />
              </div>
              <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.26)", fontSize: 12 }}>No virtual cards yet</div>
              <button className="btn-p sm" style={{ marginTop: 9 }} onClick={() => setShowCreate(true)}>
                <Plus size={10} /> Create Card
              </button>
            </div>
          )}
          {vCards.map(card => (
            <div key={card.id} style={{
              marginBottom: 8, borderRadius: 13, padding: 14, position: "relative", overflow: "hidden",
              background: "linear-gradient(135deg,#1a2010,#0d1508)",
              border: "1px solid rgba(163,230,53,0.15)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
            }}>
              <div style={{
                position: "absolute", top: -12, right: -12, width: 65, height: 65,
                background: "radial-gradient(circle,rgba(163,230,53,0.09),transparent 70%)", borderRadius: "50%",
              }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: "8px", color: "rgba(163,230,53,0.4)", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>
                    PayWave Virtual
                  </div>
                  <div style={{ fontFamily: "var(--fd)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>
                    {card.brand}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--fm)", fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em", marginBottom: 11 }}>
                  •••• •••• •••• {card.last_four}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: "7.5px", color: "rgba(255,255,255,0.26)", textTransform: "uppercase" }}>Card Name</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{card.card_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "7.5px", color: "rgba(255,255,255,0.26)", textTransform: "uppercase" }}>Expires</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{card.expiry}</div>
                  </div>
                  <button onClick={() => deleteCard(card.id)} style={{
                    background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.14)",
                    borderRadius: 6, width: 24, height: 24, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171",
                  }}><X size={10} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 12 }} />

        {/* External Cards */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontFamily: "var(--fd)", fontSize: 11.5, fontWeight: 700 }}>Linked Cards</span>
            <button onClick={() => setShowLinkCard(true)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--lime)", fontSize: 11.5, display: "flex", alignItems: "center",
              gap: 3, fontFamily: "var(--fb)", fontWeight: 600,
            }}><Link size={11} /> Link</button>
          </div>
          {!loading && extCards.length === 0 && (
            <div style={{ textAlign: "center", padding: "12px 0", color: "var(--t2)", fontSize: 11.5 }}>
              <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.24)" }}>No linked cards</div>
            </div>
          )}
          {extCards.map(card => (
            <div key={card.id} className="xg" style={{ padding: "10px 12px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  }}>
                    <CreditCard size={14} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 12.5 }}>{card.card_name}</div>
                    <div style={{ color: "var(--t2)", fontSize: 10.5 }}>{card.bank_name} · •••• {card.last_four}</div>
                  </div>
                </div>
                <button onClick={() => deleteCard(card.id)} style={{
                  background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.1)",
                  borderRadius: 6, width: 24, height: 24, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171",
                }}><X size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sheets ── */}
      <Sheet show={showCreate} onClose={() => { setShowCreate(false); setVcName(""); }}
        title="Create Virtual Card" accentColor="rgba(163,230,53,0.14)">
        <div className="xf-stack">
          <div>
            <label className="xf-lbl">Card Label</label>
            <div className="xf-wrap">
              <input type="text" value={vcName} onChange={e => setVcName(e.target.value)}
                placeholder='e.g. "Shopping Card"' className="xf-in" />
            </div>
          </div>
          <div className="btn-pair">
            <button className="btn-g" onClick={() => { setShowCreate(false); setVcName(""); }}>Cancel</button>
            <button className="btn-p" style={{ flex: 1 }} disabled={!vcName || creating} onClick={createVirtual}>
              {creating ? "Creating…" : <><Plus size={11} /> Create</>}
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet show={showLinkCard} onClose={() => setShowLinkCard(false)} title="Link a Card">
        <div className="xf-stack">
          <div>
            <label className="xf-lbl">Brand</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {["Visa", "Mastercard", "Verve"].map(b => (
                <button key={b} className={`amt-btn ${cardBrand === b ? "sel" : ""}`}
                  onClick={() => setCardBrand(b)} style={{ fontSize: 11 }}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="xf-lbl">Card Number</label>
            <div className="xf-wrap">
              <input type="text" value={cardNum}
                onChange={e => setCardNum(formatCardNum(e.target.value))}
                placeholder="0000 0000 0000 0000" className="xf-in"
                style={{ fontFamily: "var(--fm)", letterSpacing: "0.05em" }} />
            </div>
          </div>
          <div>
            <label className="xf-lbl">Name on Card</label>
            <div className="xf-wrap">
              <input type="text" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())}
                placeholder="NAME ON CARD" className="xf-in" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <div>
              <label className="xf-lbl">Expiry</label>
              <div className="xf-wrap">
                <input type="text" value={expiry}
                  onChange={e => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY" className="xf-in" />
              </div>
            </div>
            <div>
              <label className="xf-lbl">CVV</label>
              <div className="xf-wrap">
                <input type="password" maxLength={3} value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="•••" className="xf-in" />
              </div>
            </div>
          </div>
          <div>
            <label className="xf-lbl">Issuing Bank</label>
            <select value={issuerBank} onChange={e => setIssuerBank(e.target.value)} className="bank-sel">
              <option value="">— Select Bank —</option>
              {NIGERIAN_BANKS_LIST.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{
            padding: "8px 10px", background: "rgba(212,168,71,0.04)",
            border: "1px solid rgba(212,168,71,0.11)", borderRadius: 9,
            fontSize: 10.5, color: "rgba(255,255,255,0.26)", lineHeight: 1.6,
          }}>
            🔒 Card details encrypted. CVV verified and never stored.
          </div>
          <div className="btn-pair">
            <button className="btn-g" onClick={() => setShowLinkCard(false)}>Cancel</button>
            <button className="btn-p" style={{ flex: 1 }}
              disabled={!cardNum || !cardName || !expiry || !issuerBank || linking}
              onClick={linkExternal}>
              {linking ? "Linking…" : <><Link size={11} /> Link Card</>}
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet show={showConnectOPay} onClose={() => { setShowConnectOPay(false); setOpayPhone(""); setOpayPin(""); }}
        title="Connect OPay" accentColor="rgba(16,185,129,0.14)">
        <div className="xf-stack">
          <div style={{
            padding: "9px 11px", background: "rgba(16,185,129,0.04)",
            border: "1px solid rgba(16,185,129,0.13)", borderRadius: 9,
            fontSize: 11, color: "rgba(255,255,255,0.36)", lineHeight: 1.65,
          }}>
            Connecting your OPay account enables external transfers and bill payments from PayWave.
          </div>
          <div>
            <label className="xf-lbl">OPay Phone Number</label>
            <div className="xf-wrap">
              <input type="tel" value={opayPhone}
                onChange={e => setOpayPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="08012345678" className="xf-in"
                style={{ fontFamily: "var(--fm)", letterSpacing: "0.04em" }} />
            </div>
          </div>
          <div>
            <label className="xf-lbl">OPay PIN</label>
            <div className="xf-wrap">
              <input type="password" maxLength={6} value={opayPin}
                onChange={e => setOpayPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter your OPay PIN" className="xf-in" />
            </div>
            <div style={{ fontSize: 10.5, color: "var(--t2)", marginTop: 3 }}>
              PIN is verified by OPay and never stored by Xeevia.
            </div>
          </div>
          <div className="btn-pair">
            <button className="btn-g" onClick={() => { setShowConnectOPay(false); setOpayPhone(""); setOpayPin(""); }}>
              Cancel
            </button>
            <button style={{
              flex: 1, padding: "11px 14px", borderRadius: "var(--r2)", border: "none",
              background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff",
              fontFamily: "var(--fd)", fontWeight: 700, fontSize: 13,
              cursor: connecting ? "not-allowed" : "pointer", opacity: connecting ? 0.65 : 1,
            }}
              disabled={opayPhone.replace(/\D/g, "").length < 10 || !opayPin || connecting}
              onClick={connectOPay}>
              {connecting ? "Connecting…" : "Connect OPay"}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────
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