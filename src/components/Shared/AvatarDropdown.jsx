// ============================================================================
// src/components/Shared/AvatarDropdown.jsx — v2 WATER-FLOW
// ============================================================================
//
// CHANGES vs v1:
//   [A] Imports loadAccounts from AddAccountOverlay (single source of truth
//       for localStorage key — no more duplicated constants).
//   [B] onClose handler for AddAccountOverlay now reloads accounts from
//       localStorage so the switcher immediately reflects the new account.
//   [C] handleSwitchAccount properly saves a switch hint BEFORE signing out,
//       so the login screen can pre-select the right provider.
//   [D] Syncing current user into saved accounts now preserves all existing
//       fields (avatarId, isPro, verified) rather than overwriting them.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  User, LogOut, ChevronDown, Crown, Shield,
  Plus, Check, RefreshCw, Trash2,
} from "lucide-react";
import { supabase } from "../../services/config/supabase";
import AddAccountOverlay, {
  loadAccounts,
  saveAccountsToStorage,
} from "../Auth/AddAccountOverlay";

const MAX_ACCOUNTS = 3;

// ── Confirm Logout Dialog (portalled) ────────────────────────────────────────
const LogoutConfirm = ({ onConfirm, onCancel }) =>
  ReactDOM.createPortal(
    <>
      <div onClick={onCancel} style={{
        position:"fixed", inset:0,
        background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)",
        zIndex:999998, animation:"adFadeIn 0.15s ease",
      }}/>
      <div style={{
        position:"fixed", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        zIndex:999999, background:"#0d0d0d",
        border:"1px solid rgba(239,68,68,0.25)", borderRadius:"22px",
        padding:"28px 24px", width:"min(300px, calc(100vw - 32px))",
        boxShadow:"0 32px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(239,68,68,0.08)",
        animation:"adSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}>
        <div style={{ width:52,height:52, background:"radial-gradient(circle at 30% 30%,rgba(239,68,68,0.2),rgba(239,68,68,0.04))", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"16px", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:"0 4px 20px rgba(239,68,68,0.15)" }}>
          <LogOut size={22} color="#ef4444"/>
        </div>
        <p style={{ color:"#fff", fontSize:"17px", fontWeight:800, textAlign:"center", margin:"0 0 6px" }}>Sign out?</p>
        <p style={{ color:"#555", fontSize:"13px", textAlign:"center", margin:"0 0 22px", lineHeight:1.5 }}>You'll be returned to the sign-in screen.</p>
        <div style={{ display:"flex", gap:10 }}>
          <button
            onClick={onCancel}
            style={{ flex:1, padding:"12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"13px", color:"#a3a3a3", fontSize:"14px", fontWeight:700, cursor:"pointer", transition:"all 0.18s", fontFamily:"inherit" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.color="#fff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="#a3a3a3";}}>
            Stay
          </button>
          <button
            onClick={onConfirm}
            style={{ flex:1, padding:"12px", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.45)", borderRadius:"13px", color:"#ef4444", fontSize:"14px", fontWeight:800, cursor:"pointer", transition:"all 0.18s", fontFamily:"inherit" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.22)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(239,68,68,0.12)";}}>
            Sign Out
          </button>
        </div>
      </div>
    </>,
    document.body
  );

// ── Account row inside switcher ───────────────────────────────────────────────
const AccountRow = ({ account, isCurrent, onSwitch, onRemove, idx }) => (
  <div className="ad-acc-row" style={{ animationDelay: `${idx * 0.05}s` }}>
    <div
      className="ad-acc-avatar"
      style={{ background: "linear-gradient(135deg,#84cc16,#4d7c0f)" }}
    >
      {account.avatar
        ? <img src={account.avatar} alt="" crossOrigin="anonymous"/>
        : <span>{account.fullName?.charAt(0)?.toUpperCase() || "U"}</span>
      }
      {isCurrent && <div className="ad-acc-active-dot"/>}
    </div>
    <div className="ad-acc-info">
      <p className="ad-acc-name">{account.fullName || "User"}</p>
      <p className="ad-acc-user">@{account.username || "user"}</p>
    </div>
    <div className="ad-acc-actions">
      {isCurrent
        ? <div className="ad-acc-current-badge"><Check size={10} strokeWidth={3}/> Active</div>
        : <button className="ad-acc-switch-btn" onClick={() => onSwitch(account)}><RefreshCw size={11}/> Switch</button>
      }
      {!isCurrent && (
        <button className="ad-acc-remove-btn" onClick={() => onRemove(account.id)} title="Remove">
          <Trash2 size={11}/>
        </button>
      )}
    </div>
  </div>
);

// ── Portalled Dropdown Panel ──────────────────────────────────────────────────
const DropdownPortal = ({
  anchorRef, profile, avatarUrl, imageLoaded, imageError,
  isValidAvatar, fallbackLetter, onAccount, onLogout,
  savedAccounts, currentUserId, onSwitchAccount, onRemoveAccount, onAddAccount,
  canAddMore,
}) => {
  const [pos,           setPos]           = useState({ top:0, left:0 });
  const [accordionOpen, setAccordionOpen] = useState(false);

  const recalc = useCallback(() => {
    if (!anchorRef.current) return;
    const r      = anchorRef.current.getBoundingClientRect();
    const panelW = 240;
    const left   = Math.min(r.left, window.innerWidth - panelW - 8);
    setPos({ top: r.bottom + 8, left: Math.max(8, left) });
  }, [anchorRef]);

  useEffect(() => {
    recalc();
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  const otherAccounts = savedAccounts.filter(a => a.id !== currentUserId);

  return ReactDOM.createPortal(
    <div className="ad-panel" style={{ top: pos.top, left: pos.left }}>

      {/* ── Profile card / accordion trigger ── */}
      <button
        className={`ad-profile-card ad-profile-accordion${accordionOpen ? " open" : ""}`}
        onClick={() => setAccordionOpen(v => !v)}
        aria-expanded={accordionOpen}
      >
        <div className="ad-mini-avatar">
          <span className="ad-mini-fallback">{fallbackLetter}</span>
          {isValidAvatar && (
            <img src={avatarUrl} alt="" crossOrigin="anonymous"
              style={{ opacity: imageLoaded && !imageError ? 1 : 0 }}/>
          )}
        </div>
        <div className="ad-mini-info">
          <p className="ad-mini-name">{profile?.fullName || "User"}</p>
          <p className="ad-mini-user">@{profile?.username || "user"}</p>
          {(profile?.isPro || profile?.verified) && (
            <div className="ad-mini-badges">
              {profile.isPro    && <span className="ad-mini-badge pro"><Crown size={7}/> PRO</span>}
              {profile.verified && <span className="ad-mini-badge verified"><Shield size={7}/> Verified</span>}
            </div>
          )}
        </div>
        <div className={`ad-acc-chevron${accordionOpen ? " open" : ""}`}>
          <ChevronDown size={13} color="#737373"/>
        </div>
      </button>

      {/* ── Account switcher (accordion body) ── */}
      <div className={`ad-switcher${accordionOpen ? " open" : ""}`}>
        <div className="ad-switcher-inner">
          <p className="ad-switcher-title">
            <RefreshCw size={10}/>
            Switch Account
            <span className="ad-switcher-count">{savedAccounts.length}</span>
          </p>

          {savedAccounts.filter(a => a.id === currentUserId).map((acc, i) => (
            <AccountRow
              key={acc.id} account={acc} isCurrent={true}
              onSwitch={() => {}} onRemove={() => {}} idx={i}
            />
          ))}

          {otherAccounts.length > 0 && (
            <>
              <div className="ad-switcher-sep"/>
              {otherAccounts.map((acc, i) => (
                <AccountRow
                  key={acc.id} account={acc} isCurrent={false}
                  onSwitch={onSwitchAccount}
                  onRemove={onRemoveAccount}
                  idx={i + 1}
                />
              ))}
            </>
          )}

          <button
            className="ad-add-account"
            onClick={onAddAccount}
            disabled={!canAddMore}
          >
            <div className="ad-add-icon">
              <Plus size={13} color={canAddMore ? "#84cc16" : "#555"}/>
            </div>
            <span>
              {canAddMore
                ? `Add another account (${savedAccounts.length}/${MAX_ACCOUNTS})`
                : `Max ${MAX_ACCOUNTS} accounts reached`}
            </span>
          </button>
        </div>
      </div>

      <div className="ad-div-shimmer"/>

      <div className="ad-menu">
        <button className="ad-item account" onClick={onAccount}>
          <div className="ad-item-icon ad-icon-account"><User size={15} color="#84cc16"/></div>
          <span className="ad-item-label">Account</span>
          <span className="ad-item-arrow">›</span>
        </button>
        <div className="ad-div-danger">
          <div className="ad-div-danger-line"/>
          <div className="ad-div-danger-dot"/>
          <div className="ad-div-danger-line"/>
        </div>
        <button className="ad-item logout" onClick={onLogout}>
          <div className="ad-item-icon ad-icon-logout"><LogOut size={15} color="#ef4444"/></div>
          <span className="ad-item-label">Sign Out</span>
          <span className="ad-item-arrow">›</span>
        </button>
      </div>
    </div>,
    document.body
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AvatarDropdown = ({
  profile, userId, avatarUrl, fallbackLetter,
  isValidAvatar, imageLoaded, imageError,
  onImageLoad, onImageError,
  onOpenAccount, onSignOut,
  isMobile = false,
}) => {
  const [open,              setOpen]              = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAddOverlay,    setShowAddOverlay]    = useState(false);
  const [savedAccounts,     setSavedAccounts]     = useState(() => loadAccounts());

  const wrapRef = useRef(null);
  const btnRef  = useRef(null);

  // ── Sync current user into saved accounts ─────────────────────────────────
  useEffect(() => {
    if (!userId || !profile) return;
    const accounts = loadAccounts();
    const exists   = accounts.find(a => a.id === userId);

    const currentEntry = {
      id:       userId,
      fullName: profile.fullName || "User",
      username: profile.username || "user",
      avatar:   avatarUrl || null,
      isPro:    profile.isPro    || false,
      verified: profile.verified || false,
    };

    let updated;
    if (!exists) {
      updated = [currentEntry, ...accounts];
    } else {
      // Merge — preserve any fields the AddAccountOverlay stored (avatarId etc.)
      updated = accounts.map(a =>
        a.id === userId ? { ...a, ...currentEntry } : a
      );
    }

    saveAccountsToStorage(updated);
    setSavedAccounts(updated);
  }, [userId, profile?.fullName, profile?.username, avatarUrl]); // eslint-disable-line

  // Initial load
  useEffect(() => { setSavedAccounts(loadAccounts()); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (e.target.closest?.(".ad-panel")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    try { await supabase.auth.signOut(); } catch {}
    if (typeof onSignOut === "function") onSignOut();
  };

  const handleSwitchAccount = async (account) => {
    try {
      // Save hint before signing out so login screen can pre-fill
      localStorage.setItem(
        "grova_switch_hint",
        JSON.stringify({ id: account.id, username: account.username }),
      );
      await supabase.auth.signOut();
      if (typeof onSignOut === "function") onSignOut();
    } catch (err) { console.error(err); }
  };

  const handleRemoveAccount = (id) => {
    const updated = savedAccounts.filter(a => a.id !== id);
    saveAccountsToStorage(updated);
    setSavedAccounts(updated);
  };

  const handleAddAccount = () => {
    setOpen(false);
    setShowAddOverlay(true);
  };

  const handleAddOverlayClose = () => {
    setShowAddOverlay(false);
    // Reload from localStorage — overlay may have added new accounts
    setSavedAccounts(loadAccounts());
  };

  const canAddMore = savedAccounts.length < MAX_ACCOUNTS;
  const sz  = isMobile ? 34 : 44;
  const fSz = isMobile ? 14 : 17;

  return (
    <>
      <style>{`
        @keyframes adFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes adSlideUp {
          from { opacity:0; transform:translate(-50%,-46%) scale(0.93) }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1)    }
        }
        @keyframes adDropIn {
          0%   { opacity:0; transform:translateY(-12px) scale(0.94); }
          65%  { opacity:1; transform:translateY(2px)   scale(1.01); }
          100% { opacity:1; transform:translateY(0)     scale(1);    }
        }
        @keyframes adItemIn {
          from { opacity:0; transform:translateX(-8px); }
          to   { opacity:1; transform:translateX(0);    }
        }
        @keyframes adAccIn {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes adShimmer {
          0%   { background-position:-300% center; }
          100% { background-position: 300% center; }
        }
        @keyframes adDotPulse {
          0%,100% { opacity:0.25; transform:scale(0.7); }
          50%     { opacity:1;    transform:scale(1.3); }
        }

        .ad-wrap { position:relative; }

        .ad-avatar-btn {
          position:relative; border-radius:50%;
          border:2px solid #84cc16;
          background:linear-gradient(135deg,#84cc16 0%,#4d7c0f 100%);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
          transition:transform 0.2s, box-shadow 0.2s, border-color 0.2s;
          flex-shrink:0;
        }
        .ad-avatar-btn:hover  { transform:scale(1.07); box-shadow:0 0 24px rgba(132,204,22,0.55); border-color:#a3e635; }
        .ad-avatar-btn:active { transform:scale(0.95); }
        .ad-avatar-btn.open   { border-color:#a3e635; box-shadow:0 0 22px rgba(132,204,22,0.5); }
        .ad-avatar-inner { position:absolute; inset:0; border-radius:50%; overflow:hidden; }
        .ad-avatar-letter { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:800; color:#000; z-index:1; }
        .ad-avatar-inner img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:2; transition:opacity 0.35s; }
        .ad-chevron { position:absolute; bottom:-3px; right:-3px; width:15px; height:15px; background:#0a0a0a; border:1.5px solid rgba(132,204,22,0.55); border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10; transition:transform 0.25s; pointer-events:none; }
        .ad-chevron.open { transform:rotate(180deg); }

        .ad-panel {
          position:fixed; width:240px;
          background:#111;
          border:1px solid rgba(132,204,22,0.18);
          border-radius:18px; overflow:hidden;
          box-shadow: 0 24px 70px rgba(0,0,0,0.95), 0 0 0 1px rgba(132,204,22,0.06), inset 0 1px 0 rgba(255,255,255,0.04);
          animation:adDropIn 0.28s cubic-bezier(0.34,1.4,0.64,1) both;
          z-index:999990;
        }

        .ad-profile-card {
          width:100%; display:flex; align-items:center; gap:11px;
          padding:14px 14px 13px;
          background:linear-gradient(135deg,rgba(132,204,22,0.08) 0%,rgba(132,204,22,0.01) 100%);
          border:none; cursor:pointer; text-align:left;
          transition:background 0.2s; position:relative;
        }
        .ad-profile-card:hover { background:linear-gradient(135deg,rgba(132,204,22,0.13) 0%,rgba(132,204,22,0.04) 100%); }
        .ad-profile-card.open  { background:linear-gradient(135deg,rgba(132,204,22,0.14) 0%,rgba(132,204,22,0.05) 100%); }
        .ad-profile-card::after {
          content: 'tap to switch accounts';
          position:absolute; bottom:5px; right:34px;
          font-size:8px; color:rgba(132,204,22,0.35); font-weight:600;
          letter-spacing:0.3px; text-transform:uppercase; transition:opacity 0.2s;
        }
        .ad-profile-card.open::after { opacity:0; }

        .ad-mini-avatar { width:38px; height:38px; border-radius:11px; background:linear-gradient(135deg,#84cc16 0%,#4d7c0f 100%); border:1.5px solid rgba(132,204,22,0.4); overflow:hidden; flex-shrink:0; position:relative; display:flex; align-items:center; justify-content:center; }
        .ad-mini-fallback { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:#000; z-index:1; }
        .ad-mini-avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:2; transition:opacity 0.3s; }
        .ad-mini-info { flex:1; min-width:0; }
        .ad-mini-name { font-size:13px; font-weight:800; color:#fff; margin:0 0 1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px; }
        .ad-mini-user { font-size:11px; color:#84cc16; font-weight:600; margin:0; }
        .ad-mini-badges { display:flex; align-items:center; gap:4px; margin-top:3px; }
        .ad-mini-badge { display:inline-flex; align-items:center; gap:3px; padding:1px 6px; border-radius:5px; font-size:9px; font-weight:800; }
        .ad-mini-badge.pro      { background:rgba(251,191,36,0.14); border:1px solid rgba(251,191,36,0.35); color:#fbbf24; }
        .ad-mini-badge.verified { background:rgba(132,204,22,0.1);  border:1px solid rgba(132,204,22,0.28); color:#84cc16; }
        .ad-acc-chevron { flex-shrink:0; transition:transform 0.28s cubic-bezier(0.34,1.56,0.64,1); margin-left:2px; }
        .ad-acc-chevron.open { transform:rotate(180deg); }

        .ad-switcher { max-height:0; overflow:hidden; transition:max-height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.25s; opacity:0; background:rgba(0,0,0,0.4); border-top:1px solid transparent; }
        .ad-switcher.open { max-height:280px; opacity:1; border-top-color:rgba(132,204,22,0.1); }
        .ad-switcher-inner { padding:10px 10px 6px; }
        .ad-switcher-title { display:flex; align-items:center; gap:5px; font-size:9px; font-weight:800; color:#525252; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; padding:0 2px; }
        .ad-switcher-count { margin-left:auto; background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.2); color:#84cc16; border-radius:8px; padding:0 5px; font-size:9px; }
        .ad-switcher-sep { height:1px; background:rgba(255,255,255,0.05); margin:6px 0; }

        .ad-acc-row { display:flex; align-items:center; gap:9px; padding:8px 6px; border-radius:10px; transition:background 0.18s; animation:adAccIn 0.2s ease both; }
        .ad-acc-row:hover { background:rgba(255,255,255,0.04); }
        .ad-acc-avatar { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#000; flex-shrink:0; overflow:hidden; position:relative; border:1.5px solid rgba(132,204,22,0.25); }
        .ad-acc-avatar img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .ad-acc-avatar span { position:relative; z-index:1; }
        .ad-acc-active-dot { position:absolute; bottom:-2px; right:-2px; width:8px; height:8px; background:#84cc16; border-radius:50%; border:1.5px solid #0d0d0d; box-shadow:0 0 6px rgba(132,204,22,0.6); }
        .ad-acc-info { flex:1; min-width:0; }
        .ad-acc-name { font-size:12px; font-weight:700; color:#e5e5e5; margin:0 0 1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ad-acc-user { font-size:10px; color:#525252; font-weight:600; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ad-acc-actions { display:flex; align-items:center; gap:4px; flex-shrink:0; }
        .ad-acc-current-badge { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.25); border-radius:8px; font-size:9px; font-weight:800; color:#84cc16; }
        .ad-acc-switch-btn { display:inline-flex; align-items:center; gap:3px; padding:3px 8px; background:rgba(96,165,250,0.08); border:1px solid rgba(96,165,250,0.25); border-radius:8px; font-size:9px; font-weight:800; color:#60a5fa; cursor:pointer; transition:all 0.18s; }
        .ad-acc-switch-btn:hover { background:rgba(96,165,250,0.16); }
        .ad-acc-remove-btn { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); border-radius:7px; color:#ef444480; cursor:pointer; transition:all 0.18s; }
        .ad-acc-remove-btn:hover { background:rgba(239,68,68,0.14); color:#ef4444; }

        .ad-add-account { width:100%; display:flex; align-items:center; gap:8px; padding:8px 6px; border-radius:10px; border:1px dashed rgba(132,204,22,0.2); background:transparent; cursor:pointer; transition:all 0.2s; margin-top:4px; color:#525252; font-size:11px; font-weight:700; }
        .ad-add-account:hover:not(:disabled) { border-color:rgba(132,204,22,0.4); background:rgba(132,204,22,0.05); color:#84cc16; }
        .ad-add-account:disabled { opacity:0.3; cursor:not-allowed; }
        .ad-add-icon { width:22px; height:22px; border-radius:7px; background:rgba(132,204,22,0.08); border:1px solid rgba(132,204,22,0.2); display:flex; align-items:center; justify-content:center; }

        .ad-div-shimmer { position:relative; height:1px; background:linear-gradient(90deg,transparent 0%,rgba(132,204,22,0.08) 10%,rgba(132,204,22,0.55) 50%,rgba(132,204,22,0.08) 90%,transparent 100%); background-size:300% auto; animation:adShimmer 2.8s linear infinite; }
        .ad-div-shimmer::before,.ad-div-shimmer::after { content:''; position:absolute; top:50%; transform:translateY(-50%); width:4px; height:4px; border-radius:50%; background:#84cc16; box-shadow:0 0 8px 2px rgba(132,204,22,0.7); }
        .ad-div-shimmer::before { left:12px;  animation:adDotPulse 2s ease-in-out infinite 0s; }
        .ad-div-shimmer::after  { right:12px; animation:adDotPulse 2s ease-in-out infinite 1s; }

        .ad-menu { padding:8px; display:flex; flex-direction:column; gap:3px; }
        .ad-item { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.07); cursor:pointer; transition:all 0.18s; text-align:left; width:100%; animation:adItemIn 0.22s ease both; }
        .ad-item:nth-child(1) { animation-delay:0.04s; }
        .ad-item:nth-child(3) { animation-delay:0.09s; }
        .ad-item.account { background:rgba(132,204,22,0.07); border-color:rgba(132,204,22,0.18); }
        .ad-item.account:hover { background:rgba(132,204,22,0.14); border-color:rgba(132,204,22,0.4); transform:translateX(2px); box-shadow:0 4px 16px rgba(132,204,22,0.15); }
        .ad-item.logout  { background:rgba(239,68,68,0.07); border-color:rgba(239,68,68,0.18); }
        .ad-item.logout:hover { background:rgba(239,68,68,0.13); border-color:rgba(239,68,68,0.4); transform:translateX(2px); box-shadow:0 4px 16px rgba(239,68,68,0.12); }
        .ad-item-icon { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.18s; }
        .ad-icon-account { background:rgba(132,204,22,0.12); border:1px solid rgba(132,204,22,0.25); }
        .ad-icon-logout  { background:rgba(239,68,68,0.1);  border:1px solid rgba(239,68,68,0.25); }
        .ad-item:hover .ad-icon-account { background:rgba(132,204,22,0.22); }
        .ad-item:hover .ad-icon-logout  { background:rgba(239,68,68,0.18); }
        .ad-item-label { flex:1; font-size:13px; font-weight:800; letter-spacing:0.1px; }
        .ad-item.account .ad-item-label { color:#c4f07c; }
        .ad-item.logout  .ad-item-label { color:#f87171; }
        .ad-item-arrow { font-size:16px; line-height:1; font-weight:300; transition:transform 0.18s, opacity 0.18s; opacity:0.35; }
        .ad-item.account .ad-item-arrow { color:#84cc16; }
        .ad-item.logout  .ad-item-arrow { color:#ef4444; }
        .ad-item:hover .ad-item-arrow { opacity:1; transform:translateX(3px); }

        .ad-div-danger { display:flex; align-items:center; gap:6px; padding:1px 4px; }
        .ad-div-danger-line { flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(239,68,68,0.2),transparent); }
        .ad-div-danger-dot  { width:3px; height:3px; border-radius:50%; background:rgba(239,68,68,0.35); box-shadow:0 0 4px rgba(239,68,68,0.4); animation:adDotPulse 2.4s ease-in-out infinite; }
      `}</style>

      <div className="ad-wrap" ref={wrapRef}>
        <button
          ref={btnRef}
          className={`ad-avatar-btn${open ? " open" : ""}`}
          style={{
            width: sz, height: sz,
            boxShadow:`0 0 ${isMobile ? "12px" : "18px"} rgba(132,204,22,0.35)`,
          }}
          onClick={() => setOpen(v => !v)}
          aria-label="Account menu"
          aria-expanded={open}
        >
          <div className="ad-avatar-inner">
            <div className="ad-avatar-letter" style={{ fontSize: fSz }}>{fallbackLetter}</div>
            {isValidAvatar && (
              <img
                src={avatarUrl} alt="Profile"
                onLoad={onImageLoad} onError={onImageError}
                crossOrigin="anonymous"
                style={{ opacity: imageLoaded && !imageError ? 1 : 0 }}
              />
            )}
          </div>
          <div className={`ad-chevron${open ? " open" : ""}`}>
            <ChevronDown size={8} color="#84cc16" strokeWidth={3}/>
          </div>
        </button>

        {open && (
          <DropdownPortal
            anchorRef={btnRef}
            profile={profile}
            avatarUrl={avatarUrl}
            imageLoaded={imageLoaded}
            imageError={imageError}
            isValidAvatar={isValidAvatar}
            fallbackLetter={fallbackLetter}
            savedAccounts={savedAccounts}
            currentUserId={userId}
            canAddMore={canAddMore}
            onAccount={() => { setOpen(false); onOpenAccount?.(); }}
            onLogout={() => { setOpen(false); setShowLogoutConfirm(true); }}
            onSwitchAccount={handleSwitchAccount}
            onRemoveAccount={handleRemoveAccount}
            onAddAccount={handleAddAccount}
          />
        )}
      </div>

      {showLogoutConfirm && (
        <LogoutConfirm
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showAddOverlay && (
        <AddAccountOverlay
          onClose={handleAddOverlayClose}
          currentUserId={userId}
        />
      )}
    </>
  );
};

export default AvatarDropdown;