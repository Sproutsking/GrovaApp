import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, Search, Send, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "../../../services/config/supabase";
import { epTreasuryService } from "../../../services/wallet/epTreasuryService";
import TransactionPinModal from "../../Modals/TransactionPinModal";
import TwoFAModal from "../../Modals/TwoFAModal";
import { C } from "../AdminUI.jsx";

const PARTITIONS = ["operations", "growth", "xev_rewards", "reserve", "unallocated"];
const fmt = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function TreasuryWalletPanel({ adminData }) {
  const adminId = adminData?.user_id || adminData?.id;
  const [balances, setBalances] = useState({});
  const [ledger, setLedger] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState("");
  const [partition, setPartition] = useState("operations");
  const [notes, setNotes] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [pendingPin, setPendingPin] = useState("");
  const [hasTwoFa, setHasTwoFa] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      const [nextBalances, nextLedger, profile, wallet] = await Promise.all([
        epTreasuryService.getBalances(true),
        epTreasuryService.getLedger({ limit: 12 }),
        supabase.from("profiles").select("require_2fa").eq("id", adminId).maybeSingle(),
        supabase.from("wallets").select("withdrawal_pin_hash").eq("user_id", adminId).maybeSingle(),
      ]);
      setBalances(nextBalances || {});
      setLedger(nextLedger || []);
      setHasTwoFa(Boolean(profile.data?.require_2fa));
      setHasPin(Boolean(wallet.data?.withdrawal_pin_hash));
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const term = query.replace(/^@/, "").trim();
    if (recipient || term.length < 2) { setResults([]); return undefined; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("profiles")
        .select("id, username, full_name, account_status, avatar_url, avatar, profile_image_url")
        .eq("account_status", "active")
        .ilike("username", `${term}%`)
        .neq("id", adminId)
        .limit(8);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, recipient, adminId]);

  const submitSend = () => {
    const value = Number(amount);
    if (!recipient) return setMessage({ ok: false, text: "Select an active recipient." });
    if (!Number.isFinite(value) || value <= 0) return setMessage({ ok: false, text: "Enter a positive EP amount." });
    if (!hasPin) return setMessage({ ok: false, text: "Set your transaction PIN before using the treasury wallet." });
    if (!hasTwoFa) return setMessage({ ok: false, text: "Enable 2FA on the CEO account before sending treasury funds." });
    setMessage(null);
    setPinOpen(true);
  };

  const confirmPin = async (pin) => {
    setPendingPin(pin);
    setPinOpen(false);
    setTwoFaOpen(true);
  };

  const completeSecurity = async () => {
    setTwoFaOpen(false);
    setBusy(true);
    try {
      await epTreasuryService.sendToUser({
        recipientId: recipient.id,
        amount: Number(amount),
        pin: pendingPin,
        partition,
        notes,
      });
      setMessage({ ok: true, text: `Sent ${fmt(amount)} EP to @${recipient.username}.` });
      setRecipient(null); setQuery(""); setAmount(""); setNotes(""); setPendingPin("");
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const total = Object.values(balances).reduce((sum, row) => sum + Number(row?.balance || 0), 0);
  const getProfileImage = (user) => user?.avatar_url || user?.avatar || user?.profile_image_url || user?.profileImageUrl || user?.image_url || user?.imageUrl || null;

  return (
    <section style={{ marginTop: 22, padding: 18, border: "1px solid #202820", borderRadius: 16, background: "#0b0f0b" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.text, fontWeight: 900 }}><Wallet size={17} color={C.accent} /> Platform treasury wallet</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Protocol fees and platform commissions are partitioned here. Balances can only move through audited server RPCs.</div>
        </div>
        <div style={{ color: C.accent, fontWeight: 900, whiteSpace: "nowrap" }}>{fmt(total)} EP</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 7, marginBottom: 18 }}>
        {PARTITIONS.map((name) => <div key={name} style={{ padding: "10px 8px", border: "1px solid #182018", borderRadius: 9 }}><div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase" }}>{name.replace("_", " ")}</div><strong style={{ color: C.text, fontSize: 13 }}>{fmt(balances[name]?.balance)} EP</strong></div>)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.info, fontSize: 10, marginBottom: 12 }}><ShieldCheck size={14} /> CEO-only sending requires transaction PIN and enabled 2FA.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: C.muted }} />
          <input value={recipient ? `@${recipient.username}` : query} onChange={(event) => { setRecipient(null); setQuery(event.target.value); }} placeholder="Search active user" style={{ width: "100%", padding: "9px 10px 9px 30px", background: "#080a08", color: C.text, border: "1px solid #252d25", borderRadius: 8 }} />
          {!recipient && results.length > 0 && <div style={{ position: "absolute", zIndex: 4, top: 42, left: 0, right: 0, background: "#111611", border: "1px solid #273527", borderRadius: 8, overflow: "hidden" }}>{results.map((user) => { const avatar = getProfileImage(user); return (<button key={user.id} type="button" onClick={() => { setRecipient(user); setResults([]); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", textAlign: "left", background: "transparent", border: 0, color: C.text, cursor: "pointer" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", background: "#1d2b1d", border: "1px solid #2f4332", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {avatar ? <img src={avatar} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, fontWeight: 800, color: C.accent }}>{(user.username || user.full_name || "U").slice(0, 1).toUpperCase()}</span>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, color: C.text, lineHeight: 1.2 }}>@{user.username}</div>
              <div style={{ color: C.muted, fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.full_name || "Active user"}</div>
            </div>
          </button>); })}</div>}
        </div>
        <input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="EP amount" style={{ padding: "9px 10px", background: "#080a08", color: C.text, border: "1px solid #252d25", borderRadius: 8 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr auto", gap: 8, marginTop: 8 }}>
        <select value={partition} onChange={(event) => setPartition(event.target.value)} style={{ padding: "9px 10px", background: "#080a08", color: C.text, border: "1px solid #252d25", borderRadius: 8 }}>{PARTITIONS.map((name) => <option key={name} value={name}>{name.replace("_", " ")}</option>)}</select>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Audit note (required by policy)" style={{ padding: "9px 10px", background: "#080a08", color: C.text, border: "1px solid #252d25", borderRadius: 8 }} />
        <button type="button" disabled={busy} onClick={submitSend} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", border: 0, borderRadius: 8, background: C.accent, color: "#071007", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}><Send size={14} /> Send EP</button>
      </div>
      {message && <div style={{ marginTop: 10, color: message.ok ? C.success : C.danger, fontSize: 11 }}>{message.text}</div>}

      <div style={{ marginTop: 18, borderTop: "1px solid #182018", paddingTop: 12 }}>
        <div style={{ color: C.text, fontSize: 11, fontWeight: 800, marginBottom: 8 }}>Recent treasury activity</div>
        {ledger.map((row) => <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", color: C.muted, fontSize: 10 }}><span>{row.reason} · {row.partition}</span><strong style={{ color: row.direction === "credit" ? C.success : C.warn }}>{row.direction === "credit" ? "+" : "-"}{fmt(row.amount)} EP</strong></div>)}
        {!ledger.length && <div style={{ color: C.muted, fontSize: 10 }}>No treasury ledger entries yet.</div>}
      </div>

      {pinOpen && <TransactionPinModal amount={amount} recipient={recipient?.username} transactionType="transfer" title="Authorize treasury send" description={`Send ${fmt(amount)} EP to @${recipient?.username}`} onConfirm={confirmPin} onClose={() => setPinOpen(false)} />}
      <TwoFAModal show={twoFaOpen} context="sensitive" userId={adminId} onClose={() => setTwoFaOpen(false)} onSuccess={completeSecurity} />
    </section>
  );
}
