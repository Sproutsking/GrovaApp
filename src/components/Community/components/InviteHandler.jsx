// components/Community/components/InviteHandler.jsx
// Fixed: auto-join + immediate navigation into community
import React, { useState, useEffect } from "react";
import { UserPlus, CheckCircle, X, AlertCircle, ArrowRight } from "lucide-react";
import communityService from "../../../services/community/communityService";

const InviteHandler = ({ inviteCode, userId, onSuccess, onError, onClose }) => {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying invite…");
  const [communityName, setCommunityName] = useState("");
  const [communityId, setCommunityId] = useState(null);

  useEffect(() => {
    if (inviteCode && userId) handleInvite();
  }, [inviteCode, userId]);

  const handleInvite = async () => {
    try {
      setStatus("loading");
      setMessage("Joining community…");

      const community = await communityService.joinCommunityViaInvite(inviteCode, userId);

      setCommunityName(community.name);
      setCommunityId(community.id);
      setStatus("success");
      setMessage(`You're now a member of ${community.name}!`);

      // Auto-navigate after a short celebration delay
      setTimeout(() => {
        if (onSuccess) onSuccess(community.id);
      }, 1600);
    } catch (error) {
      console.error("Invite handler error:", error);
      setStatus("error");
      setMessage(error.message || "Failed to join community");
    }
  };

  const handleGoNow = () => {
    if (communityId && onSuccess) onSuccess(communityId);
  };

  return (
    <>
      <div className="inv-overlay" onClick={status === "error" ? onClose : undefined}>
        <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
          {status !== "loading" && (
            <button className="close-x" onClick={onClose}><X size={16} /></button>
          )}

          <div className="inv-body">
            {status === "loading" && (
              <>
                <div className="inv-spinner-wrap">
                  <div className="inv-spinner-ring" />
                  <div className="inv-spinner-icon"><UserPlus size={22} /></div>
                </div>
                <h3 className="inv-title">Joining Community</h3>
                <p className="inv-msg">{message}</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="inv-icon success">
                  <CheckCircle size={40} />
                </div>
                <h3 className="inv-title">Welcome!</h3>
                <p className="inv-msg">{message}</p>
                <p className="inv-sub">
                  You&apos;ve been assigned the Novis role. Complete verification in
                  the #verification channel to unlock full access.
                </p>
                <button className="go-btn" onClick={handleGoNow}>
                  Go to community <ArrowRight size={16} />
                </button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="inv-icon error">
                  <AlertCircle size={40} />
                </div>
                <h3 className="inv-title">Could not join</h3>
                <p className="inv-msg">{message}</p>
                <div className="err-actions">
                  <button className="retry-btn" onClick={handleInvite}>Try Again</button>
                  <button className="dismiss-btn" onClick={onClose}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .inv-overlay {
          position:fixed; inset:0;
          background:rgba(0,0,0,.8); backdrop-filter:blur(10px);
          z-index:100000; display:flex; align-items:center; justify-content:center;
          padding:20px;
        }
        .inv-modal {
          width:100%; max-width:380px;
          background:#0c0c0c; border:1.5px solid rgba(156,255,0,.2);
          border-radius:20px; padding:32px 28px;
          position:relative;
          animation:modalIn .3s cubic-bezier(.4,0,.2,1);
          box-shadow:0 24px 64px rgba(0,0,0,.9), 0 0 0 1px rgba(156,255,0,.06);
        }
        @keyframes modalIn {
          from{opacity:0;transform:translateY(24px) scale(.96)}
          to  {opacity:1;transform:translateY(0)    scale(1)  }
        }
        .close-x {
          position:absolute; top:14px; right:14px;
          width:28px; height:28px; border-radius:7px;
          background:rgba(255,255,255,.06); border:none;
          color:#888; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:all .2s;
        }
        .close-x:hover { background:rgba(255,100,100,.15); color:#ff6b6b; }

        .inv-body { text-align:center; }

        /* Spinner */
        .inv-spinner-wrap {
          width:80px; height:80px; margin:0 auto 20px;
          position:relative; display:flex; align-items:center; justify-content:center;
        }
        .inv-spinner-ring {
          position:absolute; inset:0; border-radius:50%;
          border:3px solid rgba(156,255,0,.15);
          border-top-color:#9cff00;
          animation:spin 1s linear infinite;
        }
        .inv-spinner-icon { color:#9cff00; }
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Icons */
        .inv-icon {
          width:80px; height:80px; border-radius:50%;
          margin:0 auto 20px;
          display:flex; align-items:center; justify-content:center;
        }
        .inv-icon.success {
          background:rgba(16,185,129,.15); color:#10b981;
          animation:pop .4s cubic-bezier(.4,0,.2,1);
        }
        .inv-icon.error {
          background:rgba(255,107,107,.15); color:#ff6b6b;
          animation:shake .4s;
        }
        @keyframes pop{
          0%{transform:scale(0)}50%{transform:scale(1.1)}100%{transform:scale(1)}
        }
        @keyframes shake{
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-8px)}75%{transform:translateX(8px)}
        }

        .inv-title { font-size:22px; font-weight:900; color:#fff; margin:0 0 8px; }
        .inv-msg   { font-size:14px; color:#999; line-height:1.5; margin:0 0 8px; }
        .inv-sub   { font-size:12px; color:#555; font-style:italic; margin:0 0 20px; }

        .go-btn {
          display:inline-flex; align-items:center; gap:7px;
          padding:12px 24px; border-radius:10px;
          background:linear-gradient(135deg,#9cff00,#667eea);
          border:none; color:#000; font-size:14px; font-weight:800;
          cursor:pointer; transition:all .25s;
          box-shadow:0 4px 16px rgba(156,255,0,.3);
        }
        .go-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(156,255,0,.45); }

        .err-actions { display:flex; flex-direction:column; gap:8px; margin-top:16px; }
        .retry-btn {
          padding:11px; border-radius:10px;
          background:rgba(18,18,18,.95); border:1.5px solid rgba(156,255,0,.35);
          color:#9cff00; font-size:14px; font-weight:700; cursor:pointer;
          transition:all .2s;
        }
        .retry-btn:hover { background:rgba(156,255,0,.1); }
        .dismiss-btn {
          padding:11px; border-radius:10px;
          background:transparent; border:1.5px solid rgba(42,42,42,.8);
          color:#666; font-size:14px; font-weight:700; cursor:pointer;
          transition:all .2s;
        }
        .dismiss-btn:hover { border-color:rgba(255,107,107,.4); color:#ff6b6b; }
      `}</style>
    </>
  );
};

export default InviteHandler;