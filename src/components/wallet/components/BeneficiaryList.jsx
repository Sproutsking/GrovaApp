// src/components/wallet/components/BeneficiaryList.jsx
// ─────────────────────────────────────────────────────────────
// Beneficiary system:
//   • Shows top 3 most-used as clickable avatar chips
//   • "View all" opens full-page list
//   • Full page: avatar, name, handle, last used, delete button
//   • Data persisted in localStorage per userId via walletService
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { X, Clock, ChevronRight, Users, ArrowLeft } from "lucide-react";
import WalletAvatar from "./WalletAvatar";
import { walletService } from "../../../services/wallet/walletService";

const CSS = `
.bene-section-head{
  display:flex;align-items:center;gap:10px;margin:20px 0 12px;justify-content:center;
}
.bene-section-line{
  flex:1;height:1px;max-width:80px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);
}
.bene-section-title{
  font-size:10.5px;font-weight:700;letter-spacing:0.1em;
  text-transform:uppercase;color:rgba(255,255,255,0.2);white-space:nowrap;flex-shrink:0;
}

.bene-chips-row{
  display:flex;align-items:center;gap:10px;padding:0 0 4px;
  flex-wrap:wrap;
}

/* Quick chip */
.bene-chip{
  display:flex;flex-direction:column;align-items:center;gap:5px;
  cursor:pointer;transition:all .18s;padding:10px 12px;border-radius:14px;
  background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
  min-width:60px;
}
.bene-chip:hover{background:rgba(163,230,53,0.06);border-color:rgba(163,230,53,0.2);}
.bene-chip-name{
  font-size:11px;font-weight:600;color:rgba(255,255,255,0.55);
  max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;
}

/* View all chip */
.bene-view-all{
  display:flex;flex-direction:column;align-items:center;gap:5px;
  cursor:pointer;transition:all .18s;padding:10px 12px;border-radius:14px;
  background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.08);
  min-width:60px;
}
.bene-view-all:hover{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.15);}
.bene-view-all-icon{
  width:40px;height:40px;border-radius:50%;
  background:rgba(255,255,255,0.06);
  display:flex;align-items:center;justify-content:center;
  color:rgba(255,255,255,0.3);
}
.bene-view-all-label{
  font-size:11px;font-weight:600;color:rgba(255,255,255,0.3);text-align:center;
}

/* ── Full page ── */
.bene-page{
  display:flex;flex-direction:column;
  animation:benePageIn .22s ease;
}
@keyframes benePageIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}

.bene-full-row{
  display:flex;align-items:center;gap:12px;padding:12px 14px;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.055);
  border-radius:13px;margin-bottom:8px;transition:background .15s;
}
.bene-full-row:hover{background:rgba(255,255,255,0.04);}
.bene-full-name{font-size:14px;font-weight:700;color:rgba(255,255,255,0.85);}
.bene-full-handle{font-size:11.5px;color:rgba(255,255,255,0.3);font-family:"DM Mono",monospace;margin-top:2px;}
.bene-full-meta{font-size:10.5px;color:rgba(255,255,255,0.2);margin-top:3px;display:flex;align-items:center;gap:4px;}
.bene-del-btn{
  margin-left:auto;width:30px;height:30px;border-radius:8px;border:none;
  background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2);
  display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;
}
.bene-del-btn:hover{background:rgba(239,68,68,0.1);color:#f87171;}
.bene-use-btn{
  padding:6px 12px;border-radius:100px;border:1px solid rgba(163,230,53,0.2);
  background:rgba(163,230,53,0.07);color:#a3e635;font-size:11px;font-weight:600;
  cursor:pointer;transition:all .15s;white-space:nowrap;margin-right:6px;
}
.bene-use-btn:hover{background:rgba(163,230,53,0.14);border-color:rgba(163,230,53,0.35);}

.bene-empty{
  display:flex;flex-direction:column;align-items:center;
  padding:32px 20px;color:rgba(255,255,255,0.18);
}
`;

function timeAgo(ts) {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 60_000)           return "just now";
  if (d < 3_600_000)        return `${Math.floor(d/60_000)}m ago`;
  if (d < 86_400_000)       return `${Math.floor(d/3_600_000)}h ago`;
  if (d < 7 * 86_400_000)   return `${Math.floor(d/86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

// ── Full beneficiaries page ─────────────────────────────────
function BeneficiaryFullPage({ userId, onSelect, onBack }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    setList(walletService.getBeneficiaries(userId));
  }, [userId]);

  const remove = (username) => {
    const updated = walletService.deleteBeneficiary(userId, username);
    setList(updated);
  };

  return (
    <div className="bene-page">
      <style>{CSS}</style>
      <div className="view-header" style={{ marginBottom: 16 }}>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={18} /></button>
        <div>
          <div className="view-title">Saved People</div>
          <div className="view-subtitle">{list.length} saved {list.length === 1 ? "person" : "people"}</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bene-empty">
          <Users size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No saved people yet</div>
          <div style={{ fontSize: 12 }}>People you send to will appear here</div>
        </div>
      ) : list.map(b => (
        <div key={b.username} className="bene-full-row">
          <WalletAvatar avatarId={b.avatarId} avatarUrl={b.avatarUrl} name={b.fullName || b.username} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bene-full-name">
              {b.fullName || b.username}
              {b.verified && (
                <span style={{ marginLeft: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: "50%", background: "#a3e635", verticalAlign: "middle" }}>
                  <svg width={8} height={7} viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              )}
            </div>
            <div className="bene-full-handle">@{b.username}</div>
            <div className="bene-full-meta">
              <Clock size={10} />
              {timeAgo(b.lastUsed)}
              {b.useCount > 1 && <span style={{ marginLeft: 4, color: "rgba(163,230,53,0.5)", fontWeight: 700 }}>· {b.useCount}×</span>}
            </div>
          </div>
          <button className="bene-use-btn" onClick={() => onSelect(b)}>
            Send
          </button>
          <button className="bene-del-btn" onClick={() => remove(b.username)} title="Remove">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main export — chips row + view all ─────────────────────
export default function BeneficiaryList({ userId, onSelect, onViewAll, compact = false }) {
  const [top, setTop] = useState([]);

  useEffect(() => {
    setTop(walletService.getTopBeneficiaries(userId, 3));
    // Refresh when localStorage changes (e.g. after send)
    const handler = () => setTop(walletService.getTopBeneficiaries(userId, 3));
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [userId]);

  if (top.length === 0) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="bene-section-head">
        <div className="bene-section-line" />
        <span className="bene-section-title">Recent People</span>
        <div className="bene-section-line" />
      </div>
      <div className="bene-chips-row">
        {top.map(b => (
          <div key={b.username} className="bene-chip" onClick={() => onSelect(b)} title={`@${b.username}`}>
            <WalletAvatar
              avatarId={b.avatarId}
              avatarUrl={b.avatarUrl}
              name={b.fullName || b.username}
              size={40}
            />
            <span className="bene-chip-name">{(b.fullName || b.username).split(" ")[0]}</span>
          </div>
        ))}
        <div className="bene-view-all" onClick={onViewAll}>
          <div className="bene-view-all-icon"><Users size={16} /></div>
          <span className="bene-view-all-label">All</span>
        </div>
      </div>
    </>
  );
}

export { BeneficiaryFullPage };