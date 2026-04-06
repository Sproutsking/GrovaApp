// components/Community/modals/InviteModal.jsx
// Unique codes via communityService._generateInviteCode (base62 timestamp + entropy)
import React, { useState, useEffect } from "react";
import { X, Copy, CheckCircle, Link2, RefreshCw, Clock, Users, Share2 } from "lucide-react";
import communityService from "../../../services/community/communityService";

const EXPIRY_OPTIONS = [
  { label:"Never",   value:null },
  { label:"1 hour",  value:60*60*1000 },
  { label:"12 hours",value:12*60*60*1000 },
  { label:"7 days",  value:7*24*60*60*1000 },
];

const USE_OPTIONS = [
  { label:"Unlimited",value:null },
  { label:"1 use",    value:1 },
  { label:"5 uses",   value:5 },
  { label:"25 uses",  value:25 },
  { label:"100 uses", value:100 },
];

const InviteModal = ({ community, userId, onClose }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState(null);
  const [maxUses, setMaxUses] = useState(null);
  const [error, setError] = useState("");

  const APP_URL = window.location.origin;

  useEffect(() => { generateInvite(); }, []);

  const generateInvite = async () => {
    setLoading(true);
    setError("");
    try {
      const inv = await communityService.createInvite(community.id, userId, { expiresIn: expiry, maxUses });
      setInvite(inv);
    } catch (err) {
      setError(err.message || "Failed to generate invite. Check Supabase community_invites table exists.");
    } finally {
      setLoading(false);
    }
  };

  const inviteLink = invite ? `${APP_URL}/?invite=${invite.code}` : "";

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      await navigator.share({ title: `Join ${community.name} on Xeevia`, text: `You're invited to join ${community.name}!`, url: inviteLink });
    } else {
      copyLink();
    }
  };

  const icon = community?.icon;

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv-head">
          <div className="inv-title"><Link2 size={16} color="#9cff00"/>Invite to {community?.name}</div>
          <button className="inv-close" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Community pill */}
        <div className="community-pill">
          <div className="pill-icon" style={{ background: community?.banner_gradient || "linear-gradient(135deg,#667eea,#764ba2)" }}>
            {icon?.startsWith("http")
              ? <img src={icon} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"9px"}}/>
              : icon || "🌟"
            }
          </div>
          <div className="pill-info">
            <div className="pill-name">{community?.name}</div>
            <div className="pill-count">
              {(community?.member_count||0).toLocaleString()} members · {(community?.online_count||0).toLocaleString()} online
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="inv-options">
          <div className="opt-group">
            <div className="opt-label"><Clock size={12}/> Expires after</div>
            <div className="opt-pills">
              {EXPIRY_OPTIONS.map(o=>(
                <button key={o.label} className={`opt-pill${expiry===o.value?" active":""}`} onClick={()=>setExpiry(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="opt-group">
            <div className="opt-label"><Users size={12}/> Max uses</div>
            <div className="opt-pills">
              {USE_OPTIONS.map(o=>(
                <button key={o.label} className={`opt-pill${maxUses===o.value?" active":""}`} onClick={()=>setMaxUses(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>

        <button className="gen-btn" onClick={generateInvite} disabled={loading}>
          <RefreshCw size={13} className={loading?"spinning":""}/> {loading?"Generating…":"Generate New Link"}
        </button>

        {error && <div className="inv-error">{error}</div>}

        {invite && (
          <>
            {/* Code display */}
            <div className="code-section">
              <div className="code-label">Invite Code</div>
              <div className="code-value">{invite.code}</div>
            </div>

            {/* Link box */}
            <div className="link-box">
              <div className="link-text">{inviteLink}</div>
              <button className={`copy-btn${copied?" copied":""}`} onClick={copyLink}>
                {copied ? <><CheckCircle size={14}/> Copied!</> : <><Copy size={14}/> Copy</>}
              </button>
            </div>

            {invite.expires_at && (
              <div className="inv-meta">Expires {new Date(invite.expires_at).toLocaleDateString()} · {invite.max_uses ? `Max ${invite.max_uses} uses` : "Unlimited uses"}</div>
            )}
          </>
        )}

        <button className="share-btn" onClick={shareLink} disabled={!invite}>
          <Share2 size={15}/> Share Invite Link
        </button>

        <p className="inv-note">Anyone with this link joins the community immediately.</p>
      </div>

      <style>{`
        .inv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(10px);z-index:50000;display:flex;align-items:center;justify-content:center;padding:20px}
        .inv-modal{width:100%;max-width:420px;background:#0c0c0c;border:1.5px solid rgba(156,255,0,.18);border-radius:18px;padding:20px;animation:modalIn .3s cubic-bezier(.4,0,.2,1)}
        @keyframes modalIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .inv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .inv-title{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:800;color:#fff}
        .inv-close{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.05);border:none;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .inv-close:hover{background:rgba(255,100,100,.12);color:#ff6b6b}
        .community-pill{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);margin-bottom:14px}
        .pill-icon{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden}
        .pill-name{font-size:13px;font-weight:800;color:#fff}
        .pill-count{font-size:10px;color:#666;margin-top:2px}
        .inv-options{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
        .opt-label{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
        .opt-pills{display:flex;gap:5px;flex-wrap:wrap}
        .opt-pill{padding:5px 10px;border-radius:7px;font-size:11px;font-weight:700;background:rgba(18,18,18,.95);border:1.5px solid rgba(42,42,42,.9);color:#888;cursor:pointer;transition:all .16s}
        .opt-pill.active{border-color:rgba(156,255,0,.45);color:#9cff00;background:rgba(156,255,0,.08)}
        .gen-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px;border-radius:9px;background:rgba(18,18,18,.95);border:1.5px solid rgba(42,42,42,.9);color:#888;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;margin-bottom:10px}
        .gen-btn:hover:not(:disabled){border-color:rgba(156,255,0,.35);color:#9cff00}
        .gen-btn:disabled{opacity:.5;cursor:not-allowed}
        .spinning{animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .inv-error{padding:9px 12px;border-radius:8px;background:rgba(255,100,100,.08);border:1px solid rgba(255,100,100,.25);color:#ff6b6b;font-size:11px;margin-bottom:10px}
        .code-section{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:rgba(18,18,18,.95);border:1px solid rgba(40,40,40,.8);margin-bottom:8px}
        .code-label{font-size:10px;color:#555;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
        .code-value{font-size:16px;font-weight:900;color:#9cff00;letter-spacing:2px;font-family:monospace}
        .link-box{display:flex;gap:8px;align-items:center;padding:10px 12px;background:rgba(156,255,0,.05);border:1.5px solid rgba(156,255,0,.18);border-radius:10px;margin-bottom:6px}
        .link-text{flex:1;font-size:11px;color:#9cff00;word-break:break-all;font-family:monospace}
        .copy-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:7px;background:rgba(156,255,0,.12);border:1.5px solid rgba(156,255,0,.25);color:#9cff00;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0}
        .copy-btn.copied{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.35);color:#10b981}
        .inv-meta{font-size:10px;color:#555;margin-bottom:10px;padding-left:2px}
        .share-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:13px;border-radius:11px;background:linear-gradient(135deg,#9cff00,#667eea);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer;transition:all .25s;box-shadow:0 4px 16px rgba(156,255,0,.25);margin-bottom:10px}
        .share-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(156,255,0,.4)}
        .share-btn:disabled{opacity:.4;cursor:not-allowed}
        .inv-note{font-size:10px;color:#555;text-align:center;margin:0}
      `}</style>
    </div>
  );
};

export default InviteModal;