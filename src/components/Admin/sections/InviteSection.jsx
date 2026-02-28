// =============================================================================
// src/components/Admin/sections/InviteSection.jsx — v6 PRICE SYNC + 3-TIER
// =============================================================================
//
//  PRICE SYNC — HOW IT WORKS END TO END:
//  ──────────────────────────────────────────────────────────────────────────
//  Admin changes price in InviteCard (inline editor) or PublicPlanPanel.
//
//  PublicPlanPanel writes:
//    payment_products.amount_usd  ← PaywallGate reads this for public users
//    triggers realtime UPDATE → PaywallGate receives it instantly
//
//  InviteCard.handlePriceSave writes ALL THREE atomically:
//    invite_codes.entry_price     = cents/100   ← real column
//    invite_codes.price_override  = cents/100   ← PaywallGate reads this FIRST
//    invite_codes.metadata.entry_price_cents    ← belt-and-suspenders
//    invite_codes.metadata.last_price_update    ← forces realtime broadcast
//
//  PaywallGate realtime handler:
//    Receives UPDATE, re-resolves price with same priority:
//      1. price_override  (if != null)
//      2. metadata.entry_price_cents (if != null)
//      3. entry_price
//    → PaywallGate price updates instantly, zero page reload needed.
//
//  PRICE HERO SLIDES — 3 TIERS:
//  ──────────────────────────────────────────────────────────────────────────
//  Slide 0: Public   — lime green  — always shown
//  Slide 1: Whitelist — amber/gold — shown when invite has active whitelist
//  Slide 2: Waitlist  — sky blue   — shown when invite.is_full = true AND waitlist on
//
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../../services/config/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month:"short", day:"numeric", year:"numeric",
    hour:"2-digit", minute:"2-digit",
  });
}

function fmtCents(cents) {
  if (cents == null) return "—";
  if (cents === 0)   return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

const CATEGORY_OPTIONS = [
  { value:"community", label:"Community" },
  { value:"user",      label:"User" },
  { value:"vip",       label:"VIP" },
];

// ── PublicPlanPanel ───────────────────────────────────────────────────────────
function PublicPlanPanel() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg,     setMsg]     = useState(null);
  const [form,    setForm]    = useState({ amount_usd:4, name:"", description:"" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadProduct();
    return () => { mounted.current = false; };
  }, []);

  async function loadProduct() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_products")
        .select("id,name,description,amount_usd,is_active,tier,metadata")
        .eq("tier","standard")
        .eq("is_active",true)
        .order("created_at",{ ascending:true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProduct(data);
        setForm({ amount_usd:data.amount_usd, name:data.name, description:data.description??"" });
      } else {
        const { data:created, error:createErr } = await supabase
          .from("payment_products")
          .insert({
            name:"Standard Access",
            description:"Full platform access — one time payment",
            type:"one_time", tier:"standard", amount_usd:4.00, currency:"USD",
            is_active:true, metadata:{ ep_grant:300, ep_reason:"Standard access grant" },
          })
          .select().single();
        if (createErr) throw createErr;
        setProduct(created);
        setForm({ amount_usd:created.amount_usd, name:created.name, description:created.description??"" });
      }
    } catch (e) {
      setMsg({ type:"error", text:e.message });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function handleSave() {
    if (!product) return;
    const amount = parseFloat(String(form.amount_usd));
    if (isNaN(amount) || amount < 0.50) {
      setMsg({ type:"error", text:"Price must be at least $0.50" });
      return;
    }
    const prev = { ...product };
    // OPTIMISTIC UPDATE
    setProduct(p => ({ ...p, amount_usd:amount, name:form.name||"Standard Access", description:form.description }));
    setEditing(false);
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("payment_products")
        .update({
          amount_usd:  amount,
          name:        form.name.trim()||"Standard Access",
          description: form.description.trim(),
          updated_at:  new Date().toISOString(),
        })
        .eq("id", product.id);
      if (error) throw error;
      // Realtime broadcasts UPDATE to PaywallGate automatically
      setMsg({ type:"success", text:"✓ Public plan updated. Synced to paywall instantly." });
    } catch (e) {
      // ROLLBACK
      setProduct(prev);
      setForm({ amount_usd:prev.amount_usd, name:prev.name, description:prev.description??"" });
      setEditing(true);
      setMsg({ type:"error", text:e.message });
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  if (loading) return (
    <div className="xv-public-panel xv-loading">
      <div className="xv-pub-spinner"/><span>Loading public plan…</span>
    </div>
  );

  return (
    <div className="xv-public-panel">
      <div className="xv-pub-hdr">
        <div>
          <div className="xv-pub-badge">🌐 Public Plan</div>
          <h3 className="xv-pub-title">Default Access Pricing</h3>
          <p className="xv-pub-sub">
            All users without an invite code pay this price.
            Changes reflect on paywall <strong style={{color:"#84cc16"}}>instantly</strong>.
          </p>
        </div>
        {!editing && <button className="xv-btn xv-outline xv-sm" onClick={()=>setEditing(true)}>✏️ Edit</button>}
      </div>

      {editing ? (
        <div className="xv-pub-form">
          <div className="xv-2col">
            <div className="xv-fcol">
              <label className="xv-lbl">Plan Name</label>
              <input className="xv-inp" value={form.name}
                onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="Standard Access"/>
            </div>
            <div className="xv-fcol">
              <label className="xv-lbl">Price (USD)</label>
              <input type="number" min="0.50" step="0.50" className="xv-inp"
                value={form.amount_usd}
                onChange={e=>setForm(f=>({...f,amount_usd:e.target.value}))}/>
              <span className="xv-hint xv-lime-text">
                ${parseFloat(String(form.amount_usd)||"0").toFixed(2)} · charged at signup
              </span>
            </div>
          </div>
          <div className="xv-fcol">
            <label className="xv-lbl">Description <span className="xv-optional">(optional)</span></label>
            <input className="xv-inp" value={form.description}
              onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder="Full platform access — one time payment"/>
          </div>
          {msg && <div className={`xv-msg ${msg.type}`}>{msg.text}</div>}
          <div className="xv-form-actions">
            <button className="xv-btn xv-ghost" onClick={()=>{setEditing(false);setMsg(null);}}>Cancel</button>
            <button className="xv-btn xv-lime" onClick={handleSave} disabled={saving}>
              {saving?"Saving…":"Save & Sync to Paywall"}
            </button>
          </div>
        </div>
      ) : (
        <div className="xv-pub-stats">
          <div className="xv-pub-stat">
            <span className="xv-pub-stat-l">Current Price</span>
            <span className="xv-pub-stat-v xv-lime-text">${product?.amount_usd?.toFixed(2)??"4.00"}</span>
          </div>
          <div className="xv-pub-stat">
            <span className="xv-pub-stat-l">Plan Name</span>
            <span className="xv-pub-stat-v">{product?.name??"Standard Access"}</span>
          </div>
          <div className="xv-pub-stat">
            <span className="xv-pub-stat-l">EP Reward</span>
            <span className="xv-pub-stat-v" style={{color:"#a5b4fc"}}>300 EP per signup</span>
          </div>
          <div className="xv-pub-stat">
            <span className="xv-pub-stat-l">Status</span>
            <span className="xv-pub-stat-v" style={{color:"#84cc16"}}>✓ Active</span>
          </div>
          {msg && <div className={`xv-msg ${msg.type}`} style={{gridColumn:"1 / -1"}}>{msg.text}</div>}
        </div>
      )}
    </div>
  );
}

// ── WaitlistModal ─────────────────────────────────────────────────────────────
function WaitlistModal({ invite, getDisplayName, getWaitlistEntries, promoteWaitlist, updateWaitlistOpenTime, onClose }) {
  const [entries,      setEntries]      = useState([]);
  const [loadingWL,    setLoadingWL]    = useState(true);
  const [promoting,    setPromoting]    = useState(false);
  const [promoteCount, setPromoteCount] = useState("");
  const [opensAt,      setOpensAt]      = useState(
    invite.metadata?.whitelist_opens_at ? invite.metadata.whitelist_opens_at.slice(0,16) : ""
  );
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoadingWL(true);
    try { setEntries(await getWaitlistEntries(invite.id)); }
    catch (e) { setMsg({ type:"error", text:e.message }); }
    finally { setLoadingWL(false); }
  }, [invite.id, getWaitlistEntries]);

  useEffect(() => { load(); }, [load]);

  const waiting     = entries.filter(e => e.status === "waiting");
  const whitelisted = entries.filter(e => e.status === "whitelisted");
  const wlPrice     = invite.whitelist_price_cents ?? 0;
  const isFree      = wlPrice === 0;

  async function handlePromote(rawN) {
    const n = Number(rawN);
    if (!n || n < 1) { setMsg({ type:"error", text:"Enter a valid count." }); return; }
    setPromoting(true); setMsg(null);
    try {
      let adminId = null;
      try { const { data:{user} } = await supabase.auth.getUser(); adminId = user?.id??null; } catch (_) {}
      const count = await promoteWaitlist(invite.id, n, adminId);
      setMsg({ type:"success", text:`✓ Promoted ${count} user${count!==1?"s":""}.` });
      setPromoteCount("");
      await load();
    } catch (e) { setMsg({ type:"error", text:e.message }); }
    finally { setPromoting(false); }
  }

  async function handleSaveTime() {
    setMsg(null);
    try {
      await updateWaitlistOpenTime(invite.id, opensAt ? new Date(opensAt).toISOString() : null);
      setMsg({ type:"success", text:"Open time saved." });
    } catch (e) { setMsg({ type:"error", text:e.message }); }
  }

  return (
    <div className="xv-overlay" onClick={onClose}>
      <div className="xv-modal" onClick={e=>e.stopPropagation()}>
        <div className="xv-modal-hdr">
          <div>
            <h2 className="xv-modal-ttl">Waitlist Control Panel</h2>
            <div className="xv-modal-meta">
              <code className="xv-chip">{invite.code}</code>
              {invite.invite_name && <span className="xv-modal-name">{invite.invite_name}</span>}
              <span className="xv-modal-cat">{getDisplayName(invite)}</span>
              <span className="xv-modal-price">WL price: <strong style={{color:isFree?"#84cc16":"#a5b4fc"}}>{fmtCents(wlPrice)}</strong></span>
            </div>
          </div>
          <button className="xv-close" onClick={onClose}>✕</button>
        </div>

        <div className="xv-stats-row">
          {[
            {n:waiting.length,     l:"Waiting",     c:"#f59e0b"},
            {n:whitelisted.length, l:"Whitelisted",  c:"#84cc16"},
            {n:entries.length,     l:"Total",        c:"#64748b"},
          ].map(({n,l,c}) => (
            <div key={l} className="xv-stat-card" style={{borderTopColor:c}}>
              <span className="xv-stat-n" style={{color:c}}>{n}</span>
              <span className="xv-stat-l">{l}</span>
            </div>
          ))}
        </div>

        {waiting.length > 0 && (
          <div className="xv-box">
            <h3 className="xv-box-ttl">Promote Users</h3>
            {isFree
              ? <p className="xv-muted" style={{color:"#84cc16"}}>✓ Free whitelist — promoted users activate immediately.</p>
              : <p className="xv-muted">Promoted users pay <strong style={{color:"#84cc16"}}>{fmtCents(wlPrice)}</strong> on their next visit.</p>
            }
            <div className="xv-promote-row">
              <button className="xv-btn xv-lime" disabled={promoting} onClick={()=>handlePromote(waiting.length)}>
                {promoting?"Promoting…":`Whitelist All (${waiting.length})`}
              </button>
              <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                <input type="number" min="1" max={waiting.length} placeholder="N" value={promoteCount}
                  onChange={e=>setPromoteCount(e.target.value)} className="xv-inp-sm" style={{width:64}}/>
                <button className="xv-btn xv-outline" disabled={promoting||!promoteCount} onClick={()=>handlePromote(promoteCount)}>
                  Whitelist {promoteCount||"N"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="xv-box">
          <h3 className="xv-box-ttl">Estimated Re-open Time</h3>
          <p className="xv-muted">Shown to waitlisted users while they wait.</p>
          <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
            <input type="datetime-local" value={opensAt} onChange={e=>setOpensAt(e.target.value)} className="xv-inp-sm"/>
            <button className="xv-btn xv-outline" onClick={handleSaveTime}>Save</button>
          </div>
        </div>

        {msg && <div className={`xv-msg ${msg.type}`}>{msg.text}</div>}

        <div>
          <h3 className="xv-box-ttl">Waiting Queue ({waiting.length})</h3>
          {loadingWL ? <p className="xv-muted">Loading…</p> :
           waiting.length === 0 ? <p className="xv-muted" style={{color:"#334155"}}>No users in queue.</p> : (
            <div className="xv-tbl-wrap">
              <table className="xv-tbl">
                <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Authenticated</th><th>Joined</th></tr></thead>
                <tbody>
                  {waiting.map((e,i) => (
                    <tr key={e.id}>
                      <td className="xv-td-pos">{e.position??i+1}</td>
                      <td>{e.full_name||"—"}</td>
                      <td className="xv-td-mono">{e.email||"—"}</td>
                      <td className={e.authenticated_at?"xv-yes":"xv-no"}>
                        {e.authenticated_at?`✓ ${fmtDate(e.authenticated_at)}`:"Pending sign-in"}
                      </td>
                      <td style={{fontSize:".78rem",color:"#64748b"}}>{fmtDate(e.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {whitelisted.length > 0 && (
            <>
              <h3 className="xv-box-ttl" style={{marginTop:"1.5rem"}}>Whitelisted ({whitelisted.length})</h3>
              <div className="xv-tbl-wrap">
                <table className="xv-tbl">
                  <thead><tr><th>Name</th><th>Email</th><th>Activated</th><th>Promoted At</th></tr></thead>
                  <tbody>
                    {whitelisted.map(e => (
                      <tr key={e.id} className="xv-wl-row">
                        <td>{e.full_name||"—"}</td>
                        <td className="xv-td-mono">{e.email||"—"}</td>
                        <td className={e.account_activated?"xv-yes":"xv-no"}>{e.account_activated?"✓ Active":"Pending payment"}</td>
                        <td style={{fontSize:".78rem",color:"#64748b"}}>{fmtDate(e.whitelisted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="xv-modal-footer">
          <button className="xv-btn xv-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <style>{MODAL_CSS}</style>
    </div>
  );
}

// ── CreateInviteForm ──────────────────────────────────────────────────────────
function CreateInviteForm({ onCreate, onCancel }) {
  const [inviteName,          setInviteName]          = useState("");
  const [category,            setCategory]            = useState("community");
  const [customLabel,         setCustomLabel]         = useState("");
  const [showCustomInput,     setShowCustomInput]     = useState(false);
  const [code,                setCode]                = useState("");
  const [maxUses,             setMaxUses]             = useState(100);
  const [entryPriceCents,     setEntryPriceCents]     = useState(400);
  const [expiresAt,           setExpiresAt]           = useState("");
  const [saving,              setSaving]              = useState(false);
  const [error,               setError]               = useState(null);
  const [enableWhitelist,     setEnableWhitelist]     = useState(false);
  const [whitelistPriceCents, setWhitelistPriceCents] = useState(0);
  const [whitelistOpensAt,    setWhitelistOpensAt]    = useState("");
  const [enableWaitlist,      setEnableWaitlist]      = useState(true);
  const [batchSize,           setBatchSize]           = useState(50);

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random()*chars.length)];
    setCode(c);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) { setError("Enter or generate an invite code."); return; }
    setSaving(true); setError(null);
    try {
      await onCreate({
        invite_name:           inviteName.trim(),
        code:                  code.trim().toUpperCase(),
        invite_category:       showCustomInput?"custom":category,
        invite_label_custom:   showCustomInput?customLabel.trim():null,
        max_uses:              Number(maxUses),
        entry_price_cents:     Number(entryPriceCents),
        whitelist_price_cents: enableWhitelist?Number(whitelistPriceCents):null,
        whitelist_opens_at:    enableWhitelist&&whitelistOpensAt?new Date(whitelistOpensAt).toISOString():null,
        enable_waitlist:       enableWaitlist,
        waitlist_batch_size:   enableWaitlist?Number(batchSize):null,
        expires_at:            expiresAt?new Date(expiresAt).toISOString():null,
      });
      onCancel();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="xv-create-wrap">
      <h3 className="xv-form-ttl">Create New Invite</h3>
      <div className="xv-info-box">
        <span style={{color:"#84cc16"}}>⚡</span>&nbsp;
        <strong style={{color:"#e2ffa0"}}>Live sync:</strong>&nbsp;
        <span style={{color:"#94a3b8"}}>Price appears on paywall <em style={{color:"#e2e8f0"}}>instantly</em> for users with this link.</span>
      </div>
      <form onSubmit={handleSubmit} className="xv-form">
        {/* SECTION 1: BASICS */}
        <div className="xv-form-section">
          <div className="xv-form-section-hdr">
            <span className="xv-form-section-num">1</span>
            <span className="xv-form-section-title">Basic Details</span>
          </div>
          <div className="xv-frow">
            <label className="xv-lbl">Invite Name <span className="xv-optional">(helps you identify it)</span></label>
            <input className="xv-inp" value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="e.g. Lagos Community Wave 1"/>
          </div>
          <div className="xv-frow">
            <label className="xv-lbl">Invite Code</label>
            <div style={{display:"flex",gap:".5rem"}}>
              <input className="xv-inp" value={code}
                onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}
                placeholder="e.g. XEEVIA24" required maxLength={20}/>
              <button type="button" className="xv-btn xv-ghost xv-sm" onClick={generateCode}>Generate</button>
            </div>
          </div>
          <div className="xv-frow">
            <label className="xv-lbl">Category</label>
            <div className="xv-cat-row">
              {CATEGORY_OPTIONS.map(opt=>(
                <button key={opt.value} type="button"
                  className={`xv-cat ${!showCustomInput&&category===opt.value?"active":""}`}
                  onClick={()=>{setCategory(opt.value);setShowCustomInput(false);}}>
                  {opt.label}
                </button>
              ))}
              <button type="button" className={`xv-cat xv-cat-dashed ${showCustomInput?"active":""}`}
                onClick={()=>setShowCustomInput(true)}>＋ Custom</button>
            </div>
            {showCustomInput && (
              <input className="xv-inp" style={{marginTop:".5rem"}} value={customLabel}
                onChange={e=>setCustomLabel(e.target.value)}
                placeholder="Custom category name…" required={showCustomInput} autoFocus/>
            )}
          </div>
          <div className="xv-2col">
            <div className="xv-fcol">
              <label className="xv-lbl">Max Public Entries</label>
              <input type="number" min="1" className="xv-inp" value={maxUses}
                onChange={e=>setMaxUses(Math.max(1,parseInt(e.target.value)||1))}/>
              <span className="xv-hint">Spots before waitlist activates</span>
            </div>
            <div className="xv-fcol">
              <label className="xv-lbl">Entry Price <span className="xv-optional">(cents)</span></label>
              <input type="number" min="0" step="1" className="xv-inp" value={entryPriceCents}
                onChange={e=>setEntryPriceCents(Math.max(0,parseInt(e.target.value)||0))}/>
              <span className="xv-hint"><span className="xv-lime-text">{fmtCents(Number(entryPriceCents))}</span> · shown on paywall</span>
            </div>
          </div>
          <div className="xv-fcol">
            <label className="xv-lbl">Expires At <span className="xv-optional">(optional)</span></label>
            <input type="datetime-local" className="xv-inp" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/>
          </div>
        </div>

        {/* SECTION 2: WHITELIST */}
        <div className="xv-form-section">
          <div className="xv-form-section-hdr">
            <span className="xv-form-section-num">2</span>
            <span className="xv-form-section-title">Whitelist Settings</span>
            <span className="xv-form-section-sub">Promoted users who bypass the public queue</span>
          </div>
          <div className="xv-toggle-row">
            <label className="xv-toggle-lbl">
              <div>
                <div style={{fontWeight:700,color:"#e2e8f0",fontSize:".88rem"}}>Enable Whitelist Tier</div>
                <div style={{color:"#64748b",fontSize:".78rem",marginTop:2}}>Specific users can be manually promoted</div>
              </div>
              <div className={`xv-toggle ${enableWhitelist?"on":""}`} onClick={()=>setEnableWhitelist(v=>!v)}>
                <div className="xv-toggle-knob"/>
              </div>
            </label>
          </div>
          {enableWhitelist && (
            <div className="xv-subsection">
              <div className="xv-2col">
                <div className="xv-fcol">
                  <label className="xv-lbl">Whitelist Price <span className="xv-optional">(cents)</span></label>
                  <input type="number" min="0" step="1" className="xv-inp" value={whitelistPriceCents}
                    onChange={e=>setWhitelistPriceCents(Math.max(0,parseInt(e.target.value)||0))}/>
                  <span className="xv-hint"><span className="xv-lime-text">{fmtCents(Number(whitelistPriceCents))}</span></span>
                </div>
                <div className="xv-fcol">
                  <label className="xv-lbl">Opens At <span className="xv-optional">(optional)</span></label>
                  <input type="datetime-local" className="xv-inp" value={whitelistOpensAt} onChange={e=>setWhitelistOpensAt(e.target.value)}/>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: WAITLIST */}
        <div className="xv-form-section">
          <div className="xv-form-section-hdr">
            <span className="xv-form-section-num">3</span>
            <span className="xv-form-section-title">Waitlist Settings</span>
            <span className="xv-form-section-sub">What happens when public entries are full</span>
          </div>
          <div className="xv-toggle-row">
            <label className="xv-toggle-lbl">
              <div>
                <div style={{fontWeight:700,color:"#e2e8f0",fontSize:".88rem"}}>Auto-enable Waitlist When Full</div>
                <div style={{color:"#64748b",fontSize:".78rem",marginTop:2}}>New users join a queue instead of being blocked</div>
              </div>
              <div className={`xv-toggle ${enableWaitlist?"on":""}`} onClick={()=>setEnableWaitlist(v=>!v)}>
                <div className="xv-toggle-knob"/>
              </div>
            </label>
          </div>
          {enableWaitlist && (
            <div className="xv-subsection">
              <div className="xv-fcol">
                <label className="xv-lbl">Default Promotion Batch</label>
                <input type="number" min="1" className="xv-inp" value={batchSize}
                  onChange={e=>setBatchSize(Math.max(1,parseInt(e.target.value)||1))}/>
                <span className="xv-hint">Suggested count when promoting users in Waitlist Panel</span>
              </div>
            </div>
          )}
        </div>

        {error && <div className="xv-err">{error}</div>}
        <div className="xv-form-actions">
          <button type="button" className="xv-btn xv-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="xv-btn xv-lime" disabled={saving}>{saving?"Creating…":"Create Invite"}</button>
        </div>
      </form>
    </div>
  );
}

// ── InviteCard ────────────────────────────────────────────────────────────────
function InviteCard({ invite:inviteProp, displayName, onWaitlistClick, onToggle, onDelete, onPriceUpdate }) {
  const [invite,       setInvite]       = useState(inviteProp);
  const [toggling,     setToggling]     = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput,   setPriceInput]   = useState("");
  const [priceSaving,  setPriceSaving]  = useState(false);
  const [priceErr,     setPriceErr]     = useState("");

  useEffect(()=>{ setInvite(inviteProp); }, [inviteProp]);

  const uses   = invite.uses_count ?? 0;
  const max    = invite.max_uses   ?? 1;
  const isFull = uses >= max;
  const isActive = invite.is_active;
  const pct    = Math.min(100, max>0?(uses/max)*100:0);

  const waitlistCount  = invite.metadata?.waitlist_count ?? 0;
  const meta           = invite.metadata ?? {};

  // ── PRICE DISPLAY — same priority as PaywallGate & fetchInviteCodeDetails ──
  // 1. price_override  (if != null)   ← PaywallGate reads this FIRST
  // 2. metadata.entry_price_cents     ← belt-and-suspenders
  // 3. entry_price                    ← real column fallback
  const displayedCents =
    invite.price_override != null
      ? Math.round(Number(invite.price_override) * 100)
      : meta.entry_price_cents != null
        ? Number(meta.entry_price_cents)
        : Math.round((Number(invite.entry_price) || 4) * 100);

  const wlPriceCents = invite.whitelist_price_cents ?? 0;
  const inviteName   = invite.invite_name ?? "";
  const progColor    = pct >= 100 ? "#ef4444" : pct > 75 ? "#f59e0b" : "#84cc16";

  async function handleToggle() {
    setToggling(true);
    try { await onToggle(invite.id, !isActive); }
    catch (e) { alert(e.message); }
    finally { setToggling(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete invite "${invite.code}"${inviteName?` (${inviteName})`:""}? Cannot be undone.`)) return;
    setDeleting(true);
    try { await onDelete(invite.id); }
    catch (e) { alert(e.message); setDeleting(false); }
  }

  // ── THE CRITICAL PRICE SAVE — writes ALL THREE fields atomically ──────────
  // This is what was broken in v5: price_override was NOT updated.
  // PaywallGate reads price_override FIRST, so the price never changed.
  // Now we write entry_price + price_override + metadata all in one call.
  async function handlePriceSave() {
    const dollars = parseFloat(priceInput);
    if (isNaN(dollars) || dollars < 0) { setPriceErr("Enter a valid price (0 for free)."); return; }

    const cents         = Math.round(dollars * 100);
    const prevEntry     = invite.entry_price;
    const prevOverride  = invite.price_override;
    const prevMeta      = invite.metadata;

    // OPTIMISTIC UPDATE — UI updates instantly
    const newMeta = {
      ...(invite.metadata||{}),
      entry_price_cents:  cents,
      last_price_update:  new Date().toISOString(),
    };
    setInvite(prev => ({
      ...prev,
      entry_price:    cents/100,
      price_override: cents/100,  // ← CRITICAL: keep in sync so display is consistent
      metadata:       newMeta,
    }));
    setEditingPrice(false);
    setPriceErr("");
    setPriceSaving(true);

    try {
      // Write ALL THREE price fields in one atomic DB call
      const { error } = await supabase
        .from("invite_codes")
        .update({
          entry_price:    cents/100,   // ← real column — primary
          price_override: cents/100,   // ← real column — PaywallGate priority-1
          metadata:       newMeta,     // ← belt-and-suspenders + triggers realtime broadcast
          updated_at:     new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (error) throw error;
      onPriceUpdate?.(invite.id, cents);
    } catch (e) {
      // ROLLBACK on failure
      setInvite(prev => ({
        ...prev,
        entry_price:    prevEntry,
        price_override: prevOverride,
        metadata:       prevMeta,
      }));
      setPriceErr(`Failed: ${e.message}`);
    } finally {
      setPriceSaving(false);
    }
  }

  return (
    <div className={`xv-card ${!isActive?"xv-card-off":""}`}>
      <div className="xv-card-hdr">
        <div className="xv-card-left">
          <code className="xv-code-chip">{invite.code}</code>
          {inviteName && <span className="xv-invite-name">{inviteName}</span>}
          <span className={`xv-catbadge xv-cat-${invite.invite_category??"standard"}`}>{displayName}</span>
          {isFull    && <span className="xv-pill xv-pill-full">Full</span>}
          {invite.enable_waitlist && <span className="xv-pill xv-pill-wl">Waitlist On</span>}
          {!isActive && <span className="xv-pill xv-pill-off">Inactive</span>}
          {invite.expires_at && new Date(invite.expires_at)<new Date() && <span className="xv-pill xv-pill-exp">Expired</span>}
        </div>
        <div style={{display:"flex",gap:".2rem",flexShrink:0}}>
          <button className="xv-icon-btn" title={isActive?"Deactivate":"Activate"} onClick={handleToggle} disabled={toggling}>
            {toggling?"…":isActive?"⏸":"▶"}
          </button>
          <button className="xv-icon-btn xv-danger-icon" title="Delete" disabled={deleting} onClick={handleDelete}>🗑</button>
        </div>
      </div>

      <div className="xv-card-stats">
        {/* Entries */}
        <div className="xv-s">
          <span className="xv-sl">Entries</span>
          <span className="xv-sv">{uses}&nbsp;<span style={{color:"#334155"}}>/</span>&nbsp;{max}</span>
          <div className="xv-prog-bar"><div className="xv-prog-fill" style={{width:`${pct}%`,background:progColor}}/></div>
          <span style={{fontSize:".68rem",color:progColor,fontWeight:700,marginTop:"2px"}}>{pct.toFixed(0)}%</span>
        </div>

        {/* Entry price — inline editor */}
        <div className="xv-s">
          <span className="xv-sl">Entry Price</span>
          {editingPrice ? (
            <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:2}}>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{color:"#64748b",fontSize:11}}>$</span>
                <input type="number" min="0" step="0.01" value={priceInput}
                  onChange={e=>{setPriceInput(e.target.value);setPriceErr("");}}
                  onKeyDown={e=>{if(e.key==="Enter")handlePriceSave();if(e.key==="Escape"){setEditingPrice(false);setPriceErr("");}}}
                  className="xv-inp-sm" style={{width:72}} autoFocus/>
                <button className="xv-btn xv-lime xv-sm" onClick={handlePriceSave} disabled={priceSaving} style={{padding:"3px 8px",fontSize:10}}>
                  {priceSaving?"…":"✓"}
                </button>
                <button className="xv-icon-btn" onClick={()=>{setEditingPrice(false);setPriceErr("");}} style={{fontSize:10}}>✕</button>
              </div>
              {priceErr && <div style={{color:"#fca5a5",fontSize:10,lineHeight:1.4}}>{priceErr}</div>}
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span className={`xv-sv ${priceSaving?"":"xv-lime-text"}`}>
                {priceSaving?"Saving…":fmtCents(displayedCents)}
              </span>
              <button className="xv-icon-btn" title="Edit price — syncs to paywall instantly"
                onClick={()=>{setPriceInput((displayedCents/100).toFixed(2));setEditingPrice(true);setPriceErr("");}}
                style={{fontSize:9,padding:"1px 5px",opacity:.55}}>✏️</button>
              {priceSaving && <span style={{fontSize:9,color:"#64748b",animation:"xvSpin .6s linear infinite",display:"inline-block"}}>↻</span>}
            </div>
          )}
        </div>

        <div className="xv-s">
          <span className="xv-sl">WL Price</span>
          <span className="xv-sv" style={{color:wlPriceCents===0?"#84cc16":"#a5b4fc"}}>{fmtCents(wlPriceCents)}</span>
        </div>
        <div className="xv-s">
          <span className="xv-sl">Expires</span>
          <span className="xv-sv" style={{fontSize:".78rem",color:"#64748b"}}>{fmtDate(invite.expires_at)}</span>
        </div>
      </div>

      <div className="xv-card-wl">
        <button className={`xv-wl-btn ${waitlistCount>0?"xv-wl-active":""}`} onClick={()=>onWaitlistClick(invite)}>
          <span>⏳</span>
          <span className="xv-wl-n">{waitlistCount}</span>
          <span>on waitlist</span>
          <span className="xv-wl-arrow">→</span>
        </button>
        {invite.metadata?.whitelist_opens_at && (
          <span style={{fontSize:".74rem",color:"#475569"}}>Opens: {fmtDate(invite.metadata.whitelist_opens_at)}</span>
        )}
      </div>
    </div>
  );
}

// ── InviteSection ─────────────────────────────────────────────────────────────
export default function InviteSection({ invitesHook }) {
  const {
    invites, loading, error, reload:refetch,
    createInvite, toggleInvite, deleteInvite,
    getWaitlistEntries, promoteWaitlist, updateWaitlistOpenTime,
    getInviteDisplayName,
  } = invitesHook;

  const [showCreate,     setShowCreate]     = useState(false);
  const [waitlistTarget, setWaitlistTarget] = useState(null);
  const [search,         setSearch]         = useState("");
  const [filter,         setFilter]         = useState("all");

  const filtered = invites.filter(inv => {
    const q = search.toLowerCase();
    if (q && !((inv.code??"").toLowerCase().includes(q)||
               (inv.invite_name??"").toLowerCase().includes(q)||
               getInviteDisplayName(inv).toLowerCase().includes(q))) return false;
    if (filter==="active")   return inv.is_active && !inv.is_full;
    if (filter==="inactive") return !inv.is_active;
    if (filter==="full")     return inv.is_full;
    return true;
  });

  const totalWaiting = invites.reduce((s,inv)=>s+(inv.metadata?.waitlist_count??0),0);

  const handlePriceUpdate = useCallback(()=>{
    setTimeout(()=>refetch(), 1200);
  },[refetch]);

  return (
    <div className="xv-section">
      <div style={{marginBottom:"1.75rem"}}>
        <div style={{fontSize:".7rem",fontWeight:800,color:"#334155",textTransform:"uppercase",letterSpacing:".08em",marginBottom:".6rem"}}>Built-in Plan</div>
        <PublicPlanPanel/>
      </div>

      <div style={{height:1,background:"rgba(255,255,255,.05)",marginBottom:"1.5rem"}}/>

      <div className="xv-section-hdr">
        <div>
          <h2 className="xv-section-ttl">Invite Codes</h2>
          <p className="xv-section-sub">
            {invites.length===0?"No invite codes yet — create your first one below":`${invites.length} invite${invites.length!==1?"s":""}`}
            {totalWaiting>0 && <span className="xv-waiting-badge">⏳ {totalWaiting} waiting</span>}
          </p>
        </div>
        <div style={{display:"flex",gap:".5rem",alignItems:"center"}}>
          <button className="xv-btn xv-ghost xv-sm" onClick={refetch} title="Refresh">⟳ Refresh</button>
          <button className={`xv-btn ${showCreate?"xv-ghost":"xv-lime"}`} onClick={()=>setShowCreate(v=>!v)}>
            {showCreate?"✕ Cancel":"＋ New Invite"}
          </button>
        </div>
      </div>

      {showCreate && <CreateInviteForm onCreate={createInvite} onCancel={()=>setShowCreate(false)}/>}

      <div className="xv-filterbar">
        <input className="xv-inp xv-srch" placeholder="Search code, name or category…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{display:"flex",gap:".3rem"}}>
          {["all","active","inactive","full"].map(f=>(
            <button key={f} className={`xv-ftab ${filter===f?"active":""}`} onClick={()=>setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="xv-state">Loading invites…</div>}
      {error   && <div className="xv-state xv-state-err">{error}</div>}

      {!loading && invites.length===0 && (
        <div className="xv-empty-state">
          <div className="xv-empty-icon">🎟</div>
          <div className="xv-empty-title">No invite codes yet</div>
          <div className="xv-empty-sub">Create your first invite code to give users special access, pricing, or whitelist spots.</div>
          <button className="xv-btn xv-lime" onClick={()=>setShowCreate(true)}>＋ Create First Invite</button>
        </div>
      )}

      {!loading && invites.length>0 && filtered.length===0 && (
        <div className="xv-state xv-state-empty">No invites match your search or filter.</div>
      )}

      <div className="xv-list">
        {filtered.map(inv=>(
          <InviteCard
            key={inv.id}
            invite={inv}
            displayName={getInviteDisplayName(inv)}
            onWaitlistClick={setWaitlistTarget}
            onToggle={toggleInvite}
            onDelete={deleteInvite}
            onPriceUpdate={handlePriceUpdate}
          />
        ))}
      </div>

      {waitlistTarget && (
        <WaitlistModal
          invite={waitlistTarget}
          getDisplayName={getInviteDisplayName}
          getWaitlistEntries={getWaitlistEntries}
          promoteWaitlist={promoteWaitlist}
          updateWaitlistOpenTime={updateWaitlistOpenTime}
          onClose={()=>setWaitlistTarget(null)}
        />
      )}

      <style>{SECTION_CSS}</style>
    </div>
  );
}

const SECTION_CSS = `
  .xv-section   { padding:1.5rem; max-width:1100px; margin:0 auto; font-family:'DM Sans','Outfit',system-ui,sans-serif; color:#e2e8f0; }
  .xv-public-panel { background:rgba(132,204,22,.03); border:1px solid rgba(132,204,22,.15); border-radius:14px; padding:1.25rem 1.5rem; }
  .xv-public-panel.xv-loading { display:flex; align-items:center; gap:.75rem; color:#334155; font-size:.84rem; min-height:80px; }
  .xv-pub-spinner { width:20px;height:20px;border:2px solid rgba(132,204,22,.1);border-top:2px solid #84cc16;border-radius:50%;animation:xvSpin .6s linear infinite;flex-shrink:0; }
  @keyframes xvSpin{to{transform:rotate(360deg)}}
  .xv-pub-hdr  { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem; }
  .xv-pub-badge { display:inline-flex;align-items:center;gap:.3rem;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);border-radius:20px;padding:.15rem .6rem;font-size:.7rem;font-weight:800;color:#84cc16;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem; }
  .xv-pub-title { font-size:1rem;font-weight:800;color:#f1f5f9;margin:0 0 .2rem; }
  .xv-pub-sub   { font-size:.78rem;color:#64748b;margin:0; }
  .xv-pub-stats { display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-top:.25rem; }
  .xv-pub-stat  { display:flex;flex-direction:column;gap:.2rem; }
  .xv-pub-stat-l { font-size:.65rem;color:#475569;text-transform:uppercase;letter-spacing:.06em;font-weight:700; }
  .xv-pub-stat-v { font-size:.9rem;font-weight:700;color:#e2e8f0; }
  .xv-pub-form  { display:flex;flex-direction:column;gap:.75rem;margin-top:.5rem; }
  .xv-section-hdr { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem; }
  .xv-section-ttl { font-size:1.3rem;font-weight:800;color:#f1f5f9;margin:0;letter-spacing:-.3px; }
  .xv-section-sub { font-size:.84rem;color:#475569;margin-top:.25rem;display:flex;align-items:center;gap:.5rem; }
  .xv-waiting-badge { background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);color:#f59e0b;border-radius:20px;padding:.1rem .55rem;font-size:.75rem;font-weight:700; }
  .xv-empty-state { display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:3.5rem 2rem;text-align:center; }
  .xv-empty-icon { font-size:2.5rem; }
  .xv-empty-title { font-size:1.1rem;font-weight:800;color:#94a3b8; }
  .xv-empty-sub { font-size:.84rem;color:#475569;max-width:360px;line-height:1.65; }
  .xv-btn { padding:.5rem 1.1rem;border-radius:10px;font-size:.88rem;font-weight:700;cursor:pointer;border:none;transition:all .15s;font-family:inherit;line-height:1; }
  .xv-lime { background:linear-gradient(135deg,#a3e635,#5c9b0a);color:#071200;box-shadow:0 3px 14px rgba(132,204,22,.18); }
  .xv-lime:hover:not(:disabled) { background:linear-gradient(135deg,#bef264,#72b811); }
  .xv-outline { background:transparent;color:#84cc16;border:1px solid rgba(132,204,22,.35); }
  .xv-outline:hover:not(:disabled) { background:rgba(132,204,22,.06); }
  .xv-ghost { background:transparent;color:#64748b;border:1px solid rgba(255,255,255,.08); }
  .xv-ghost:hover { background:rgba(255,255,255,.04);color:#94a3b8; }
  .xv-sm { padding:.35rem .7rem;font-size:.8rem; }
  .xv-btn:disabled { opacity:.45;cursor:not-allowed; }
  .xv-inp { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);color:#f1f5f9;border-radius:10px;padding:.52rem .8rem;font-size:.88rem;width:100%;box-sizing:border-box;font-family:inherit;transition:border-color .15s; }
  .xv-inp:focus { outline:none;border-color:rgba(132,204,22,.5);box-shadow:0 0 0 2px rgba(132,204,22,.08); }
  .xv-inp::placeholder { color:#3a3a3a; }
  .xv-inp-sm { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);color:#f1f5f9;border-radius:8px;padding:.4rem .6rem;font-size:.84rem;font-family:inherit; }
  .xv-filterbar { display:flex;gap:.75rem;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap; }
  .xv-srch { max-width:280px; }
  .xv-ftab { padding:.28rem .8rem;border-radius:20px;font-size:.78rem;font-weight:700;cursor:pointer;background:rgba(255,255,255,.03);color:#475569;border:1px solid rgba(255,255,255,.07);font-family:inherit;transition:all .15s; }
  .xv-ftab.active { background:rgba(132,204,22,.1);color:#84cc16;border-color:rgba(132,204,22,.35); }
  .xv-create-wrap { background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1.5rem;margin-bottom:1.5rem; }
  .xv-form-ttl { font-size:1rem;font-weight:800;color:#f1f5f9;margin:0 0 .6rem; }
  .xv-info-box { background:rgba(132,204,22,.04);border:1px solid rgba(132,204,22,.14);border-radius:9px;padding:.65rem .9rem;font-size:.8rem;line-height:1.6;margin-bottom:1rem; }
  .xv-form { display:flex;flex-direction:column;gap:0; }
  .xv-form-section { border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:1.25rem;margin-bottom:1rem;background:rgba(255,255,255,.01); }
  .xv-form-section-hdr { display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:1px solid rgba(255,255,255,.05); }
  .xv-form-section-num { width:22px;height:22px;border-radius:50%;background:rgba(132,204,22,.15);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:.72rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
  .xv-form-section-title { font-size:.9rem;font-weight:800;color:#f1f5f9; }
  .xv-form-section-sub { font-size:.75rem;color:#475569;margin-left:.2rem; }
  .xv-subsection { background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:1rem;margin-top:.75rem;display:flex;flex-direction:column;gap:.75rem; }
  .xv-toggle-row { margin-bottom:.25rem; }
  .xv-toggle-lbl { display:flex;justify-content:space-between;align-items:center;gap:1rem;cursor:pointer; }
  .xv-toggle { width:40px;height:22px;border-radius:11px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);position:relative;cursor:pointer;transition:all .2s;flex-shrink:0; }
  .xv-toggle.on { background:rgba(132,204,22,.35);border-color:rgba(132,204,22,.5); }
  .xv-toggle-knob { width:16px;height:16px;border-radius:50%;background:#64748b;position:absolute;top:2px;left:2px;transition:all .2s; }
  .xv-toggle.on .xv-toggle-knob { background:#84cc16;transform:translateX(18px); }
  .xv-frow { display:flex;flex-direction:column;gap:.38rem;margin-bottom:.75rem; }
  .xv-2col { display:grid;grid-template-columns:1fr 1fr;gap:1rem; }
  .xv-fcol { display:flex;flex-direction:column;gap:.3rem; }
  .xv-lbl { font-size:.73rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.07em; }
  .xv-optional { color:#334155;font-weight:400;text-transform:none;letter-spacing:0;font-size:.78em; }
  .xv-hint { font-size:.72rem;color:#475569;line-height:1.45; }
  .xv-lime-text { color:#84cc16;font-weight:700; }
  .xv-err { background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);color:#fca5a5;padding:.6rem .9rem;border-radius:9px;font-size:.84rem; }
  .xv-form-actions { display:flex;gap:.7rem;justify-content:flex-end;padding-top:.5rem; }
  .xv-cat-row { display:flex;gap:.4rem;flex-wrap:wrap; }
  .xv-cat { padding:.32rem .85rem;border-radius:20px;font-size:.82rem;font-weight:700;cursor:pointer;background:rgba(255,255,255,.03);color:#475569;border:1px solid rgba(255,255,255,.08);font-family:inherit;transition:all .15s; }
  .xv-cat.active { background:rgba(132,204,22,.1);color:#84cc16;border-color:rgba(132,204,22,.35); }
  .xv-cat-dashed { border-style:dashed; }
  .xv-list { display:flex;flex-direction:column;gap:.9rem; }
  .xv-card { background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1.15rem 1.35rem;transition:border-color .2s,background .2s; }
  .xv-card:hover { border-color:rgba(132,204,22,.2);background:rgba(132,204,22,.02); }
  .xv-card-off { opacity:.45; }
  .xv-card-hdr { display:flex;justify-content:space-between;align-items:center;margin-bottom:.85rem;gap:.5rem; }
  .xv-card-left { display:flex;align-items:center;gap:.45rem;flex-wrap:wrap; }
  .xv-code-chip { font-family:'DM Mono',monospace;font-size:1rem;font-weight:700;color:#e2ffa0;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.2);padding:.18rem .55rem;border-radius:7px;letter-spacing:1.5px; }
  .xv-invite-name { font-size:.82rem;font-weight:600;color:#94a3b8;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);padding:.15rem .5rem;border-radius:6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .xv-icon-btn { background:transparent;border:none;cursor:pointer;font-size:.95rem;padding:.28rem .4rem;border-radius:7px;color:#475569;transition:all .15s; }
  .xv-icon-btn:hover { background:rgba(255,255,255,.06);color:#94a3b8; }
  .xv-danger-icon:hover { background:rgba(239,68,68,.1)!important;color:#fca5a5!important; }
  .xv-icon-btn:disabled { opacity:.35;cursor:not-allowed; }
  .xv-catbadge { font-size:.68rem;font-weight:800;padding:.15rem .5rem;border-radius:20px;text-transform:uppercase;letter-spacing:.06em; }
  .xv-cat-community { background:rgba(14,165,233,.12);color:#38bdf8;border:1px solid rgba(14,165,233,.2); }
  .xv-cat-user { background:rgba(132,204,22,.1);color:#84cc16;border:1px solid rgba(132,204,22,.2); }
  .xv-cat-vip { background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.2); }
  .xv-cat-custom { background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.2); }
  .xv-cat-standard { background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.2); }
  .xv-pill { font-size:.66rem;font-weight:800;padding:.12rem .45rem;border-radius:20px;text-transform:uppercase;letter-spacing:.04em; }
  .xv-pill-full { background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2); }
  .xv-pill-wl { background:rgba(14,165,233,.1);color:#38bdf8;border:1px solid rgba(14,165,233,.2); }
  .xv-pill-off { background:rgba(71,85,105,.2);color:#64748b;border:1px solid rgba(71,85,105,.2); }
  .xv-pill-exp { background:rgba(239,68,68,.06);color:#f87171;border:1px solid rgba(239,68,68,.15); }
  .xv-card-stats { display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:.85rem; }
  .xv-s { display:flex;flex-direction:column;gap:.12rem;min-width:82px; }
  .xv-sl { font-size:.65rem;color:#475569;text-transform:uppercase;letter-spacing:.06em;font-weight:700; }
  .xv-sv { font-size:.9rem;font-weight:700;color:#e2e8f0; }
  .xv-prog-bar { height:3px;background:rgba(255,255,255,.06);border-radius:3px;margin-top:4px;width:82px;overflow:hidden; }
  .xv-prog-fill { height:100%;border-radius:3px;transition:width .4s; }
  .xv-card-wl { display:flex;align-items:center;gap:1rem;border-top:1px solid rgba(255,255,255,.05);padding-top:.75rem;flex-wrap:wrap; }
  .xv-wl-btn { display:flex;align-items:center;gap:.4rem;padding:.35rem .75rem;background:transparent;border:1px solid rgba(255,255,255,.07);border-radius:8px;color:#475569;cursor:pointer;font-size:.8rem;font-family:inherit;transition:all .15s; }
  .xv-wl-active { border-color:rgba(132,204,22,.25)!important;color:#84cc16!important;background:rgba(132,204,22,.04)!important; }
  .xv-wl-btn:hover { border-color:rgba(132,204,22,.3);color:#84cc16; }
  .xv-wl-n { font-weight:800;font-size:.95rem; }
  .xv-wl-arrow { margin-left:.1rem;opacity:.6; }
  .xv-state { text-align:center;padding:3rem;color:#334155;font-size:.88rem; }
  .xv-state-err { color:#fca5a5; }
  .xv-state-empty { color:#1e293b; }
  .xv-msg { padding:.65rem 1rem;border-radius:9px;font-size:.84rem;font-weight:600; }
  .xv-msg.success { background:rgba(132,204,22,.06);border:1px solid rgba(132,204,22,.2);color:#84cc16; }
  .xv-msg.error { background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.18);color:#fca5a5; }
  @media (max-width:640px) {
    .xv-2col { grid-template-columns:1fr; }
    .xv-card-stats { gap:1rem; }
    .xv-filterbar { flex-direction:column;align-items:stretch; }
    .xv-srch { max-width:100%; }
    .xv-pub-stats { grid-template-columns:1fr 1fr; }
    .xv-form-section-sub { display:none; }
  }
`;

const MODAL_CSS = `
  .xv-overlay { position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;backdrop-filter:blur(6px); }
  .xv-modal { background:#020403;border:1px solid rgba(132,204,22,.15);border-radius:16px;width:100%;max-width:820px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:1.2rem;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.6); }
  .xv-modal-hdr { display:flex;justify-content:space-between;align-items:flex-start; }
  .xv-modal-ttl { font-size:1.2rem;font-weight:800;color:#f1f5f9;margin:0;letter-spacing:-.2px; }
  .xv-modal-meta { display:flex;align-items:center;gap:.5rem;margin-top:.3rem;flex-wrap:wrap; }
  .xv-modal-name { font-size:.8rem;color:#94a3b8;font-weight:600; }
  .xv-modal-cat { font-size:.73rem;color:#64748b; }
  .xv-modal-price { font-size:.8rem;color:#64748b; }
  .xv-close { background:transparent;border:none;font-size:1rem;color:#475569;cursor:pointer;padding:.25rem .45rem;border-radius:6px;line-height:1; }
  .xv-close:hover { background:rgba(255,255,255,.06);color:#94a3b8; }
  .xv-modal-footer { display:flex;justify-content:flex-end;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.05); }
  .xv-chip { font-family:'DM Mono',monospace;background:rgba(132,204,22,.08);border:1px solid rgba(132,204,22,.18);padding:.12rem .45rem;border-radius:5px;color:#e2ffa0;font-size:.82rem;letter-spacing:1px; }
  .xv-stats-row { display:flex;gap:.75rem; }
  .xv-stat-card { flex:1;background:rgba(255,255,255,.025);border-radius:10px;padding:1rem;text-align:center;border-top:2px solid transparent; }
  .xv-stat-n { display:block;font-size:1.9rem;font-weight:900;line-height:1; }
  .xv-stat-l { font-size:.68rem;color:#475569;text-transform:uppercase;letter-spacing:.06em;display:block;margin-top:.3rem;font-weight:700; }
  .xv-box { background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:1rem 1.2rem; }
  .xv-box-ttl { font-size:.85rem;font-weight:800;color:#cbd5e1;margin:0 0 .65rem;text-transform:uppercase;letter-spacing:.04em; }
  .xv-muted { font-size:.78rem;color:#475569;margin:0 0 .7rem;line-height:1.6; }
  .xv-promote-row { display:flex;gap:.75rem;align-items:center;flex-wrap:wrap; }
  .xv-tbl-wrap { overflow-x:auto;border-radius:9px;border:1px solid rgba(255,255,255,.06);margin-top:.5rem; }
  .xv-tbl { width:100%;border-collapse:collapse;font-size:.82rem; }
  .xv-tbl th { background:rgba(255,255,255,.03);color:#475569;font-weight:800;text-transform:uppercase;font-size:.65rem;letter-spacing:.07em;padding:.55rem .75rem;text-align:left;white-space:nowrap; }
  .xv-tbl td { padding:.6rem .75rem;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,.04); }
  .xv-tbl tr:last-child td { border-bottom:none; }
  .xv-tbl tr:hover td { background:rgba(132,204,22,.02); }
  .xv-wl-row td { color:#84cc16; }
  .xv-td-pos { color:#84cc16;font-weight:800;width:2rem; }
  .xv-td-mono { font-family:'DM Mono',monospace;font-size:.77rem;color:#64748b; }
  .xv-yes { color:#84cc16!important;font-size:.78rem; }
  .xv-no { color:#334155!important;font-size:.78rem; }
`;