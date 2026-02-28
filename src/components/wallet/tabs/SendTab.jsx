// src/components/wallet/tabs/SendTab.jsx
// ════════════════════════════════════════════════════════════════════
// UNIFIED SEND — $XEV + EP
// Features:
//   • Live @ search — type to filter real users with avatars
//   • Recipient profile card — avatar, name, verified badge, "Profile" button
//   • Click any user → opens UserProfileModal inline (back returns to send)
//   • Wallet address (0x…) auto-detected, shown as on-chain card
//   • Optimistic UI — success screen in < 50ms, RPC confirms in bg
//   • XRC-ready metadata on every transaction row
// ════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft, Send, Flame, AlertCircle,
  CheckCircle, Zap, TrendingUp, X, Loader,
  Sparkles, Shield, ChevronRight,
} from "lucide-react";
import { walletService } from "../../../services/wallet/walletService";
import { supabase } from "../../../services/config/supabase";
import UserProfileModal from "../../Modals/UserProfileModal";

const XEV_RATE = 2.5;

// ── EP Burn ─────────────────────────────────────────────────────────
function computeEPBurn(currency, amount) {
  const a = parseFloat(amount) || 0;
  if (currency === "EP") {
    if (a < 100)  return 0.5;
    if (a < 500)  return 2;
    if (a < 2000) return 5;
    return 10;
  }
  const ngn = a * XEV_RATE;
  if (ngn < 250)   return 1;
  if (ngn < 1000)  return 2;
  if (ngn < 5000)  return 4;
  if (ngn < 25000) return 7;
  return 10;
}

function isWalletAddress(s) {
  return /^0x[a-fA-F0-9]{40,}$/.test((s || "").trim());
}

// ── Avatar ───────────────────────────────────────────────────────────
function Avatar({ avatarId, name, size = 40, style = {} }) {
  const [err, setErr] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();
  const base = (typeof window !== "undefined" && window.__SUPABASE_URL__)
    || (typeof process !== "undefined" && process.env?.REACT_APP_SUPABASE_URL)
    || "";
  const url = avatarId && !err && base
    ? `${base}/storage/v1/object/public/avatars/${avatarId}`
    : null;

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#a3e635 0%,#65a30d 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, color: "#000", fontSize: size * 0.4,
      overflow: "hidden", flexShrink: 0, ...style,
    }}>
      {url
        ? <img src={url} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={() => setErr(true)} />
        : initial}
    </div>
  );
}

// ── CSS ────────────────────────────────────────────────────────
const CSS = `
/* Currency switcher */
.cs-wrap{display:flex;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:100px;padding:4px;width:fit-content;margin:0 20px 24px;gap:2px;position:relative;}
.cs-pill{position:absolute;top:4px;left:4px;height:calc(100% - 8px);border-radius:100px;transition:transform .22s cubic-bezier(.4,0,.2,1),width .22s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:0;}
.cs-pill.xev{background:rgba(163,230,53,.1);border:1px solid rgba(163,230,53,.2);}
.cs-pill.ep{background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.18);}
.cs-btn{position:relative;display:flex;align-items:center;gap:7px;padding:9px 20px;border-radius:100px;border:none;background:transparent;font-size:13px;font-weight:600;cursor:pointer;color:rgba(255,255,255,.28);z-index:1;white-space:nowrap;}
.cs-btn.active-xev{color:#a3e635;}.cs-btn.active-ep{color:#22d3ee;}
.cs-divider{width:1px;height:16px;background:rgba(255,255,255,.08);flex-shrink:0;}

/* Search input */
.st-input-row{display:flex;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:visible;position:relative;transition:border-color .2s,box-shadow .2s;}
.st-input-row:focus-within{border-color:rgba(163,230,53,.35);box-shadow:0 0 0 3px rgba(163,230,53,.07);}
.st-prefix{padding:0 0 0 14px;font-size:16px;font-weight:700;color:#a3e635;user-select:none;}
.st-field{flex:1;padding:14px 12px;background:transparent;border:none;outline:none;font-size:15px;color:rgba(255,255,255,.85);font-weight:500;}
.st-field::placeholder{color:rgba(255,255,255,.2);}
.st-clear{width:34px;height:34px;margin-right:6px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:none;background:rgba(255,255,255,.05);color:rgba(255,255,255,.3);cursor:pointer;transition:all .15s;}
.st-clear:hover{background:rgba(239,68,68,.1);color:#f87171;}

/* Dropdown */
.st-dropdown{position:absolute;top:calc(100% + 8px);left:0;right:0;background:rgba(7,9,12,.98);border:1px solid rgba(163,230,53,.15);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.65);z-index:200;animation:ddIn .18s cubic-bezier(.34,1.56,.64,1);backdrop-filter:blur(24px);}
@keyframes ddIn{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.st-result{display:flex;align-items:center;gap:12px;padding:11px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;}
.st-result:last-child{border-bottom:none;}
.st-result:hover{background:rgba(163,230,53,.06);}
.st-result-name{font-size:14px;font-weight:700;color:rgba(255,255,255,.88);display:flex;align-items:center;gap:6px;}
.st-result-handle{font-size:11.5px;color:rgba(255,255,255,.3);font-family:"DM Mono",monospace;margin-top:2px;}
.st-empty{padding:20px 14px;text-align:center;font-size:13px;color:rgba(255,255,255,.2);}
.st-searching{padding:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,.25);}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

/* Selected user card */
.rcpt-card{display:flex;align-items:center;gap:12px;padding:13px 14px;background:rgba(163,230,53,.04);border:1px solid rgba(163,230,53,.18);border-radius:14px;animation:cardIn .25s cubic-bezier(.34,1.56,.64,1);}
@keyframes cardIn{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:scale(1) translateY(0)}}
.rcpt-name{font-size:15px;font-weight:700;color:rgba(255,255,255,.9);display:flex;align-items:center;gap:6px;}
.rcpt-handle{font-size:12px;color:#a3e635;font-family:"DM Mono",monospace;margin-top:3px;}
.rcpt-view-btn{display:flex;align-items:center;gap:4px;padding:6px 11px;border-radius:100px;background:rgba(163,230,53,.08);border:1px solid rgba(163,230,53,.2);font-size:11px;font-weight:600;color:#a3e635;cursor:pointer;transition:all .15s;white-space:nowrap;}
.rcpt-view-btn:hover{background:rgba(163,230,53,.14);}
.rcpt-chg-btn{display:flex;align-items:center;gap:4px;padding:6px 9px;border-radius:100px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:11px;font-weight:600;color:rgba(255,255,255,.3);cursor:pointer;transition:all .15s;}
.rcpt-chg-btn:hover{background:rgba(239,68,68,.07);color:#f87171;border-color:rgba(239,68,68,.15);}

/* Wallet address */
.waddr-card{display:flex;align-items:center;gap:12px;padding:13px 14px;background:rgba(34,211,238,.04);border:1px solid rgba(34,211,238,.15);border-radius:14px;animation:cardIn .25s cubic-bezier(.34,1.56,.64,1);}
.waddr-text{font-size:11px;font-family:"DM Mono",monospace;color:rgba(34,211,238,.65);word-break:break-all;line-height:1.6;}
.waddr-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:100px;background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.18);font-size:9px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.08em;}

/* Done screen */
.conf-bar{width:100%;height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-top:12px;}
.conf-bar-inner{height:100%;border-radius:2px;background:linear-gradient(90deg,#a3e635,#22d3ee);animation:confProg 2.2s ease-in-out forwards;}
@keyframes confProg{0%{width:0}60%{width:82%}100%{width:100%}}
@keyframes spulse{0%{box-shadow:0 0 0 0 rgba(163,230,53,.4)}70%{box-shadow:0 0 0 22px rgba(163,230,53,0)}100%{box-shadow:0 0 0 0 rgba(163,230,53,0)}}
.sring{animation:spulse .7s ease-out;}

/* Toast */
.st-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);display:flex;align-items:center;gap:10px;padding:11px 18px;border-radius:100px;background:rgba(7,9,12,.97);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(20px);font-size:13px;color:rgba(255,255,255,.8);white-space:nowrap;z-index:9999;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .3s;opacity:0;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,.5);}
.st-toast.show{transform:translateX(-50%) translateY(0);opacity:1;}
.td{width:6px;height:6px;border-radius:50%;background:#a3e635;flex-shrink:0;animation:tdPulse 1.4s ease-in-out infinite;}
.td.err{background:#f87171;animation:none;}
@keyframes tdPulse{0%,100%{opacity:1}50%{opacity:.3}}
`;

// ── Currency Switcher ────────────────────────────────────────────────
function CurrencySwitcher({ currency, onChange }) {
  const xevRef = useRef(null);
  const epRef  = useRef(null);
  const [pill, setPill] = useState({ width: 0, transform: "translateX(0px)" });
  useEffect(() => {
    const r = currency === "XEV" ? xevRef.current : epRef.current;
    if (r) setPill({ width: r.offsetWidth, transform: `translateX(${r.offsetLeft - 4}px)` });
  }, [currency]);
  return (
    <div className="cs-wrap">
      <div className={`cs-pill ${currency === "XEV" ? "xev" : "ep"}`} style={pill} />
      <button ref={xevRef} className={`cs-btn ${currency === "XEV" ? "active-xev" : ""}`} onClick={() => onChange("XEV")}>
        <span className="cs-icon"><TrendingUp size={11} /></span>$XEV
      </button>
      <div className="cs-divider" />
      <button ref={epRef} className={`cs-btn ${currency === "EP" ? "active-ep" : ""}`} onClick={() => onChange("EP")}>
        <span className="cs-icon"><Zap size={11} /></span>EP
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
const SendTab = ({
  setActiveTab, balance, userId, onRefresh,
  transactions, setTransactions, username: currentUsername,
}) => {
  const [currency,     setCurrency]     = useState("EP");
  const [rawInput,     setRawInput]     = useState("");
  const [selectedUser, setSelectedUser] = useState(null);   // { id, username, full_name, avatar_id, verified }
  const [walletAddr,   setWalletAddr]   = useState(null);
  const [amount,       setAmount]       = useState("");
  const [note,         setNote]         = useState("");
  const [step,         setStep]         = useState(1);

  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [showDrop,    setShowDrop]    = useState(false);

  const [rpcLoading,  setRpcLoading]  = useState(false);
  const [rpcDone,     setRpcDone]     = useState(false);
  const [txId,        setTxId]        = useState(null);
  const [error,       setError]       = useState("");
  const [toastMsg,    setToastMsg]    = useState("");
  const [toastType,   setToastType]   = useState("ok");
  const [toastShow,   setToastShow]   = useState(false);

  // Profile modal — set to a user object to open
  const [profileUser, setProfileUser] = useState(null);

  const inputRef    = useRef(null);
  const dropRef     = useRef(null);
  const toastTimer  = useRef(null);
  const searchTimer = useRef(null);
  const prevBal     = useRef(null);

  const epBurn       = computeEPBurn(currency, amount);
  const fiatValue    = currency === "XEV" ? (parseFloat(amount) || 0) * XEV_RATE : 0;
  const available    = currency === "XEV" ? (balance?.tokens || 0) : (balance?.points || 0);
  const parsed       = parseFloat(amount) || 0;
  const epMinFail    = currency === "EP" && parsed > 0 && parsed < 5;
  const hasRcpt      = !!(selectedUser || walletAddr);
  const tooLittle    = parsed > available ||
    (currency === "XEV" && (balance?.points || 0) < epBurn) ||
    (currency === "EP"  && (balance?.points || 0) < parsed + epBurn);

  // Toast
  const toast = useCallback((msg, type = "ok", ms = 3500) => {
    setToastMsg(msg); setToastType(type); setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), ms);
  }, []);

  // ── Live search ───────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (selectedUser) { setShowDrop(false); return; }

    if (isWalletAddress(rawInput)) {
      setWalletAddr(rawInput.trim());
      setSelectedUser(null);
      setShowDrop(false);
      return;
    }
    setWalletAddr(null);

    const q = rawInput.replace(/^@/, "").trim();
    if (q.length < 2) { setShowDrop(false); setResults([]); return; }

    setSearching(true);
    setShowDrop(true);

    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id,username,full_name,avatar_id,avatar_metadata,verified,account_status")
          .eq("account_status", "active")
          .ilike("username", `${q}%`)
          .neq("id", userId)
          .limit(7);
        setResults(data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 280);
  }, [rawInput, userId, selectedUser]);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const pickUser = (u) => {
    setSelectedUser(u); setRawInput(`@${u.username}`);
    setShowDrop(false); setResults([]); setError("");
  };

  const clearRcpt = () => {
    setSelectedUser(null); setWalletAddr(null); setRawInput(""); setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCurrencyChange = (c) => { setCurrency(c); setAmount(""); setError(""); };

  // ── Validate → step 2 ─────────────────────────────────────────
  const handleContinue = () => {
    setError("");
    if (!hasRcpt)                              return setError("Select a recipient first");
    if (walletAddr && currency === "EP")       return setError("Wallet addresses only support $XEV");
    if (!amount || parsed <= 0)                return setError("Enter a valid amount");
    if (currency === "EP" && parsed < 5)       return setError("Minimum EP send is 5 EP");
    if (parsed > available)                    return setError(`Insufficient ${currency} balance`);
    if (currency === "XEV" && (balance?.points || 0) < epBurn)
                                               return setError(`Need ${epBurn} EP for burn fee`);
    if (currency === "EP" && (balance?.points || 0) < parsed + epBurn)
                                               return setError(`Need ${parsed + epBurn} EP total`);
    setStep(2);
  };

  // ── OPTIMISTIC SEND ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    setError("");
    prevBal.current = { tokens: balance?.tokens || 0, points: balance?.points || 0 };

    if (balance) {
      if (currency === "XEV") {
        balance.tokens = Math.max(0, (balance.tokens || 0) - parsed);
        balance.points = Math.max(0, (balance.points || 0) - epBurn);
      } else {
        balance.points = Math.max(0, (balance.points || 0) - parsed - epBurn);
      }
    }
    const optTx = {
      id: `opt_${Date.now()}`, _optimistic: true, change_type: "debit",
      reason: `Sending to @${selectedUser?.username || walletAddr}`,
      amount: parsed, metadata: { currency, ep_burn: epBurn, note },
      created_at: new Date().toISOString(),
    };
    if (typeof setTransactions === "function")
      setTransactions(p => [optTx, ...(p || [])]);

    setStep(3); setRpcLoading(true); setRpcDone(false);
    toast(`Sending ${parsed} ${currency}…`);

    try {
      const toId = selectedUser ? `@${selectedUser.username}` : walletAddr;
      const result = await walletService.sendTokens({
        fromUserId: userId, toIdentifier: toId,
        amount: parsed, currency, note, epBurn,
      });
      if (result.success) {
        setTxId(result.transaction_id);
        setRpcLoading(false); setRpcDone(true);
        toast(`✓ Delivered to @${selectedUser?.username || walletAddr?.slice(0, 8) + "…"}`, "ok");
        if (typeof setTransactions === "function")
          setTransactions(p => p.filter(tx => tx.id !== optTx.id));
        if (onRefresh) onRefresh();
      } else {
        throw new Error(result.error || "Transaction failed");
      }
    } catch (err) {
      if (balance && prevBal.current) {
        balance.tokens = prevBal.current.tokens;
        balance.points = prevBal.current.points;
      }
      if (typeof setTransactions === "function")
        setTransactions(p => p.filter(tx => tx.id !== optTx.id));
      setRpcLoading(false);
      setError(err.message || "Transaction failed"); setStep(1);
      toast(`⚠ Failed — ${err.message || "balance restored"}`, "err", 4500);
    }
  }, [selectedUser, walletAddr, parsed, currency, epBurn, balance, note, userId, onRefresh, setTransactions, toast]);

  const resetForm = () => {
    setStep(1); setAmount(""); setRawInput(""); setSelectedUser(null);
    setWalletAddr(null); setNote(""); setError("");
    setTxId(null); setRpcDone(false); setRpcLoading(false);
  };

  // ── Profile modal overlay ─────────────────────────────────────
  if (profileUser) {
    return (
      <>
        <style>{CSS}</style>
        <UserProfileModal
          user={profileUser}
          currentUser={{ id: userId, username: currentUsername }}
          onClose={() => setProfileUser(null)}
          onAuthorClick={() => {}}
          onActionMenu={() => {}}
        />
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DONE SCREEN
  // ══════════════════════════════════════════════════════════════
  if (step === 3) {
    return (
      <div className="view-enter" style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 20px" }}>
        <style>{CSS}</style>

        <div
          className={rpcDone ? "sring" : ""}
          style={{
            width:72,height:72,borderRadius:"50%",
            background:"rgba(163,230,53,.06)",
            border:`2px solid ${rpcDone ? "#a3e635" : "rgba(163,230,53,.25)"}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            marginBottom:20,transition:"border-color .4s",
            boxShadow:rpcDone ? "0 0 40px rgba(163,230,53,.18)" : "none",
          }}
        >
          {rpcLoading
            ? <Loader size={30} color="#a3e635" style={{ animation:"spin .8s linear infinite" }} />
            : <CheckCircle size={32} color="#a3e635" />}
        </div>

        <div style={{ fontSize:24,fontWeight:800,color:"#fff",marginBottom:6 }}>
          {rpcLoading ? "Sending…" : "Sent!"}
        </div>
        <div style={{ fontSize:38,fontWeight:700,fontFamily:"var(--mono,'DM Mono',monospace)",color:currency==="EP"?"#22d3ee":"#a3e635",marginBottom:4,letterSpacing:"-0.04em" }}>
          {parsed.toLocaleString()} <span style={{ fontSize:18 }}>{currency}</span>
        </div>
        {fiatValue > 0 && (
          <div style={{ fontSize:13,color:"rgba(255,255,255,.3)",fontFamily:"var(--mono,'DM Mono',monospace)",marginBottom:8 }}>
            ≈ ₦{fiatValue.toLocaleString()}
          </div>
        )}

        {/* Recipient on done screen — clickable to open profile */}
        {selectedUser ? (
          <div
            onClick={() => setProfileUser(selectedUser)}
            style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16,cursor:"pointer",padding:"9px 14px",borderRadius:100,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",transition:"all .15s" }}
          >
            <Avatar avatarId={selectedUser.avatar_id} name={selectedUser.full_name||selectedUser.username} size={32} />
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:"rgba(255,255,255,.85)",display:"flex",alignItems:"center",gap:5 }}>
                {selectedUser.full_name||selectedUser.username}
                {selectedUser.verified && <span className="vbadge"><Sparkles size={9} color="#000" /></span>}
              </div>
              <div style={{ fontSize:11,color:"#a3e635",fontFamily:"var(--mono,'DM Mono',monospace)" }}>@{selectedUser.username}</div>
            </div>
            <ChevronRight size={14} color="rgba(255,255,255,.2)" />
          </div>
        ) : (
          <div style={{ fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:16,fontFamily:"var(--mono,'DM Mono',monospace)" }}>
            to {walletAddr?.slice(0,10)}…{walletAddr?.slice(-6)}
          </div>
        )}

        <div style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.12)",borderRadius:100,fontSize:11,color:"#f87171",marginBottom:16 }}>
          <Flame size={11} />{epBurn} EP burned
        </div>

        {rpcLoading && (
          <div style={{ width:"100%",maxWidth:320,marginBottom:16 }}>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.18)",textAlign:"center",marginBottom:6,fontFamily:"var(--mono,'DM Mono',monospace)" }}>Confirming…</div>
            <div className="conf-bar"><div className="conf-bar-inner" /></div>
          </div>
        )}
        {rpcDone && txId && (
          <div className="conf-chip" style={{ marginBottom:20 }}>
            <CheckCircle size={11} />Confirmed · {txId.slice(0,8)}…
          </div>
        )}

        {!rpcLoading && (
          <div style={{ display:"flex",flexDirection:"column",width:"100%",maxWidth:320,marginTop:8 }}>
            <button className="btn-primary" onClick={() => { resetForm(); setActiveTab("overview"); }}>Back to Wallet</button>
            <button className="btn-ghost" onClick={resetForm}>Send Again</button>
          </div>
        )}
        <div className={`st-toast ${toastShow?"show":""}`}><div className={`td ${toastType==="err"?"err":""}`}/>{toastMsg}</div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CONFIRM SCREEN
  // ══════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <div className="view-enter">
        <style>{CSS}</style>
        <div className="view-header">
          <button className="back-btn" onClick={() => setStep(1)}><ArrowLeft size={18} /></button>
          <div><div className="view-title">Confirm</div><div className="view-subtitle">Review before sending</div></div>
        </div>

        {selectedUser && (
          <div
            onClick={() => setProfileUser(selectedUser)}
            style={{ display:"flex",alignItems:"center",gap:12,margin:"0 20px 20px",padding:"14px",background:"rgba(163,230,53,.04)",border:"1px solid rgba(163,230,53,.15)",borderRadius:16,cursor:"pointer",transition:"background .15s" }}
          >
            <Avatar avatarId={selectedUser.avatar_id} name={selectedUser.full_name||selectedUser.username} size={46} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15,fontWeight:700,color:"rgba(255,255,255,.9)",display:"flex",alignItems:"center",gap:6 }}>
                {selectedUser.full_name||selectedUser.username}
                {selectedUser.verified && <span className="vbadge"><Sparkles size={9} color="#000" /></span>}
              </div>
              <div style={{ fontSize:12,color:"#a3e635",fontFamily:"var(--mono,'DM Mono',monospace)",marginTop:2 }}>@{selectedUser.username}</div>
            </div>
            <span style={{ fontSize:11,color:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",gap:3 }}>
              View profile <ChevronRight size={13}/>
            </span>
          </div>
        )}

        {walletAddr && (
          <div className="waddr-card" style={{ margin:"0 20px 20px" }}>
            <div style={{ width:38,height:38,borderRadius:10,background:"rgba(34,211,238,.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <Shield size={18} color="#22d3ee" />
            </div>
            <div style={{ flex:1 }}>
              <div className="waddr-badge" style={{ marginBottom:5 }}><Shield size={8}/>On-chain</div>
              <div className="waddr-text">{walletAddr}</div>
            </div>
          </div>
        )}

        <div className="summary-card">
          <div className="summary-card-title">Transaction Details</div>
          <div className="summary-row"><span>Amount</span><strong style={{ color:currency==="EP"?"#22d3ee":"#a3e635" }}>{parsed.toLocaleString()} {currency}</strong></div>
          {fiatValue > 0 && <div className="summary-row"><span>Value</span><span>≈ ₦{fiatValue.toLocaleString()}</span></div>}
          {note && <div className="summary-row"><span>Note</span><span style={{ maxWidth:180,textAlign:"right",fontSize:12 }}>{note}</span></div>}
          <div className="summary-divider" />
          <div className="summary-row total"><span>EP Burn</span><strong style={{ color:"#f87171" }}>−{epBurn} EP</strong></div>
          {currency === "EP" && <div className="summary-row"><span>Total EP</span><strong style={{ color:"rgba(255,255,255,.5)" }}>{parsed + epBurn} EP</strong></div>}
        </div>

        <div className="ep-burn-notice" style={{ margin:"0 20px 20px" }}>
          <Flame size={13} color="#f87171" />
          <span>{epBurn} EP burned — sustains the platform, non-refundable.</span>
        </div>

        <button className="btn-primary" onClick={handleSend}><Send size={15}/>Confirm &amp; Send</button>
        <button className="btn-ghost" onClick={() => setStep(1)}>Cancel</button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FORM
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="view-enter">
      <style>{CSS}</style>

      <div className="view-header">
        <button className="back-btn" onClick={() => setActiveTab("overview")}><ArrowLeft size={18} /></button>
        <div><div className="view-title">Send</div><div className="view-subtitle">Transfer $XEV or EP instantly</div></div>
      </div>

      <CurrencySwitcher currency={currency} onChange={handleCurrencyChange} />

      <div className="form-body">

        {/* ── Recipient ── */}
        <div className="field-group">
          <label className="field-label">
            Recipient
            <span style={{ marginLeft:8,fontSize:10,color:"rgba(255,255,255,.2)",fontWeight:400,fontFamily:"var(--mono,'DM Mono',monospace)" }}>
              @username or 0x… address
            </span>
          </label>

          {selectedUser ? (
            /* ─ Confirmed user card ─ */
            <div className="rcpt-card">
              <Avatar avatarId={selectedUser.avatar_id} name={selectedUser.full_name||selectedUser.username} size={46} />
              <div style={{ flex:1,minWidth:0 }}>
                <div className="rcpt-name">
                  {selectedUser.full_name||selectedUser.username}
                  {selectedUser.verified && <span className="vbadge"><Sparkles size={9} color="#000"/></span>}
                </div>
                <div className="rcpt-handle">@{selectedUser.username}</div>
              </div>
              <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                <button className="rcpt-view-btn" onClick={() => setProfileUser(selectedUser)}>
                  Profile <ChevronRight size={10}/>
                </button>
                <button className="rcpt-chg-btn" onClick={clearRcpt}>
                  <X size={11}/> Change
                </button>
              </div>
            </div>

          ) : walletAddr ? (
            /* ─ Wallet address card ─ */
            <div className="waddr-card">
              <div style={{ width:40,height:40,borderRadius:10,background:"rgba(34,211,238,.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Shield size={20} color="#22d3ee"/>
              </div>
              <div style={{ flex:1 }}>
                <div className="waddr-badge" style={{ marginBottom:5 }}><Shield size={8}/>On-chain address detected</div>
                <div className="waddr-text">{walletAddr.slice(0,20)}…{walletAddr.slice(-8)}</div>
                {currency === "EP" && (
                  <div style={{ fontSize:10,color:"#f87171",marginTop:4 }}>Switch to $XEV for wallet address sends</div>
                )}
              </div>
              <button className="rcpt-chg-btn" onClick={clearRcpt} style={{ flexShrink:0 }}>
                <X size={11}/> Clear
              </button>
            </div>

          ) : (
            /* ─ Search input with dropdown ─ */
            <div style={{ position:"relative" }} ref={dropRef}>
              <div className="st-input-row">
                <span className="st-prefix">@</span>
                <input
                  ref={inputRef}
                  className="st-field"
                  placeholder="username or 0x wallet address"
                  value={rawInput}
                  onChange={e => { setRawInput(e.target.value); setError(""); }}
                  onFocus={() => { if (results.length > 0) setShowDrop(true); }}
                  autoComplete="off" autoCapitalize="none" spellCheck={false}
                />
                {rawInput && (
                  <button className="st-clear" onClick={clearRcpt}><X size={13}/></button>
                )}
              </div>

              {showDrop && (
                <div className="st-dropdown">
                  {searching ? (
                    <div className="st-loading-row">
                      <Loader size={14} color="rgba(163,230,53,.5)" style={{ animation:"spin .8s linear infinite",flexShrink:0 }}/>
                      Searching…
                    </div>
                  ) : results.length > 0 ? results.map(u => (
                    <div
                      key={u.id} className="st-result"
                      onClick={() => pickUser(u)}
                      tabIndex={0} onKeyDown={e => e.key==="Enter" && pickUser(u)}
                    >
                      <Avatar avatarId={u.avatar_id} name={u.full_name||u.username} size={38}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div className="st-result-name">
                          {u.full_name||u.username}
                          {u.verified && <span className="vbadge"><Sparkles size={9} color="#000"/></span>}
                        </div>
                        <div className="st-result-handle">@{u.username}</div>
                      </div>
                      <ChevronRight size={14} color="rgba(255,255,255,.15)"/>
                    </div>
                  )) : (
                    <div className="st-empty">No users found for "{rawInput.replace(/^@/,"")}"</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Amount ── */}
        <div className="field-group">
          <label className="field-label">
            Amount
            {currency === "EP" && <span style={{ marginLeft:8,color:"#22d3ee",fontWeight:700,fontSize:9,opacity:.7 }}>MIN 5 EP</span>}
          </label>
          <div className="amount-field">
            <input
              className="amount-input-big" type="number" placeholder="0"
              value={amount} onChange={e => { setAmount(e.target.value); setError(""); }}
              min={currency==="EP"?5:0} step={currency==="EP"?1:"any"}
            />
            <div className="amount-ticker-row">
              <span className="amount-ticker" style={{ color:currency==="EP"?"#22d3ee":"#a3e635" }}>
                {currency==="XEV"?"$XEV":"EP"}
              </span>
              {currency==="XEV" && parsed > 0 && <span className="amount-fiat-display">≈ ₦{fiatValue.toLocaleString()}</span>}
              {currency==="EP" && parsed > 0 && !epMinFail && (
                <span className="amount-fiat-display">{parsed<100?"0.5 EP fee":`${epBurn} EP fee`}</span>
              )}
            </div>
          </div>
          <div className="field-hint">
            Available: <strong style={{ color:"rgba(255,255,255,.5)" }}>{available.toLocaleString()}</strong> {currency}
          </div>
        </div>

        {/* ── Note ── */}
        <div className="field-group">
          <label className="field-label">Note <span style={{ color:"rgba(255,255,255,.2)",fontWeight:400 }}>(optional)</span></label>
          <input className="field-input" placeholder="What's this for?" value={note} onChange={e => setNote(e.target.value)} maxLength={120}/>
        </div>

        {parsed > 0 && !epMinFail && (
          <div className="ep-burn-notice" style={{ marginBottom:14 }}>
            <Flame size={13} color="#f87171"/>
            <span>{currency==="EP" && parsed < 100 ? "Micro-transfer: 0.5 EP fee only" : `${epBurn} EP will be burned`}</span>
          </div>
        )}

        {epMinFail && (
          <div style={{ display:"flex",gap:8,alignItems:"center",padding:"10px 14px",background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)",borderRadius:8,marginBottom:12 }}>
            <AlertCircle size={14} color="#f59e0b"/>
            <span style={{ fontSize:13,color:"#f59e0b" }}>Minimum send is 5 EP</span>
          </div>
        )}

        {error && (
          <div style={{ display:"flex",gap:8,alignItems:"center",padding:"12px 14px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.12)",borderRadius:8,marginBottom:14 }}>
            <AlertCircle size={15} color="#f87171"/>
            <span style={{ fontSize:13,color:"#f87171" }}>{error}</span>
          </div>
        )}
      </div>

      <button
        className="btn-primary"
        disabled={!hasRcpt || !amount || parsed <= 0 || tooLittle || epMinFail || (walletAddr && currency === "EP")}
        onClick={handleContinue}
      >
        <Send size={15}/>Continue
      </button>

      <div className={`st-toast ${toastShow?"show":""}`}><div className={`td ${toastType==="err"?"err":""}`}/>{toastMsg}</div>
    </div>
  );
};

export default SendTab;