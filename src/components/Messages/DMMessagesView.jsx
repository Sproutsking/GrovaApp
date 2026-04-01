// components/Messages/DMMessagesView.jsx
// ============================================================================
// IMMERSIVE MESSAGING HUB — v5
// ============================================================================
// When a chat/call/update is selected it opens FULL SCREEN with zero nav clutter.
// The left rail is hidden the moment you enter a detail view.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import UserSearchModal from "./UserSearchModal";
import UpdatesView from "./UpdatesView";
import CallsView from "./CallsView";
import ActiveCall from "./ActiveCall";

/* ═══════════════════════════════════════════════════
   NAV ICONS — crisp, consistent stroke weight
═══════════════════════════════════════════════════ */
const NavIc = {
  Chat: ({ a }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={a ? "#84cc16" : "currentColor"} strokeWidth={a ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Updates: ({ a }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={a ? "#84cc16" : "currentColor"} strokeWidth={a ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="7"/>
      <line x1="12" y1="2" x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="22" y2="12"/>
    </svg>
  ),
  Calls: ({ a }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={a ? "#84cc16" : "currentColor"} strokeWidth={a ? 2.5 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Close: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════ */
const DMMessagesView = ({ currentUser, onClose, initialOtherUserId }) => {
  const [tab,          setTab]          = useState("chats");
  // view: "list" | "chat" | "call"
  const [view,         setView]         = useState("list");
  const [selectedConv, setSelectedConv] = useState(null);
  const [activeCall,   setActiveCall]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showSearch,   setShowSearch]   = useState(false);

  const initialized     = useRef(false);
  const unsubscribeList = useRef(null);

  /* ── Init services ── */
  useEffect(() => {
    if (!currentUser?.id) return;
    onlineStatusService.start(currentUser.id);
    dmMessageService.init(currentUser.id).then(() => setLoading(false));
    unsubscribeList.current = dmMessageService.subscribeToConversationList();
    return () => {
      if (unsubscribeList.current) unsubscribeList.current();
      dmMessageService.cleanup();
    };
  }, [currentUser?.id]);

  /* ── Deep-link to specific conversation ── */
  useEffect(() => {
    if (!initialOtherUserId || !currentUser?.id || initialized.current) return;
    initialized.current = true;
    dmMessageService.createConversation(currentUser.id, initialOtherUserId)
      .then(conv => {
        const otherUser = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
        setSelectedConv({ ...conv, otherUser, lastMessage: null, unreadCount: 0 });
        setTab("chats");
        setView("chat");
      })
      .catch(e => console.error("❌ [DM] Init:", e));
  }, [initialOtherUserId, currentUser?.id]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Navigation helpers ── */
  const openChat = (conv) => {
    setSelectedConv(conv);
    setTab("chats");
    setView("chat");
  };

  const openCall = (info) => {
    setActiveCall(info);
    setView("call");
  };

  const endCall = () => {
    setActiveCall(null);
    setView("list");
  };

  const backToList = () => {
    setSelectedConv(null);
    setActiveCall(null);
    setView("list");
  };

  const switchTab = (id) => {
    setTab(id);
    if (view !== "list") backToList();
  };

  const handleUserSelect = async (user) => {
    try {
      const conv = await dmMessageService.createConversation(currentUser.id, user.id);
      const otherUser = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
      setSelectedConv({ ...conv, otherUser, lastMessage: null, unreadCount: 0 });
      setTab("chats");
      setView("chat");
      setShowSearch(false);
    } catch (e) { console.error("❌ [DM] User select:", e); }
  };

  const handleStoryReplyAsDM = (story, text) => {
    switchTab("chats");
    console.log("DM reply to story:", story.name, text);
  };

  const navItems = [
    { id: "chats",   label: "Chats",   Icon: NavIc.Chat },
    { id: "updates", label: "Updates", Icon: NavIc.Updates },
    { id: "calls",   label: "Calls",   Icon: NavIc.Calls },
  ];

  const tabTitles = { chats: "Messages", updates: "Updates", calls: "Calls" };

  // Whether we're in a full-screen detail view (hide left rail)
  const isDetailView = view === "chat" || view === "call";

  return (
    <>
      {/* Transparent backdrop */}
      <div className="dm-bd" onClick={onClose} />

      <div className="dm-panel">

        {/* ── LEFT RAIL — hidden when in detail view ── */}
        {!isDetailView && (
          <nav className="dm-rail">
            <div className="dm-rail-logo">
              <div className="rail-logo-dot" />
            </div>
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`rail-btn${tab === id ? " active" : ""}`}
                onClick={() => switchTab(id)}
                aria-label={label}
              >
                <Icon a={tab === id} />
                <span className="rail-lbl">{label}</span>
              </button>
            ))}
            <div className="rail-spacer" />
            <button className="rail-btn rail-close" onClick={onClose} aria-label="Close">
              <NavIc.Close />
            </button>
          </nav>
        )}

        {/* ── CONTENT ── */}
        <div className={`dm-body${isDetailView ? " dm-body-full" : ""}`}>

          {/* ══ ACTIVE CALL — absolute full-screen ══ */}
          {view === "call" && activeCall && (
            <div className="dm-detail-full">
              <ActiveCall call={activeCall} onEnd={endCall} currentUser={currentUser} />
            </div>
          )}

          {/* ══ CHAT DETAIL — absolute full-screen ══ */}
          {view === "chat" && selectedConv && (
            <div className="dm-detail-full">
              <ChatView
                conversation={selectedConv}
                currentUser={currentUser}
                onBack={backToList}
              />
            </div>
          )}

          {/* ══ LIST VIEW — tab content ══ */}
          {view === "list" && (
            <div className="dm-list-wrap">

              {/* Shared header */}
              <div className="dm-list-header">
                <button className="dm-hdr-close" onClick={onClose} aria-label="Close">
                  <NavIc.Close />
                </button>
                <h2 className="dm-hdr-title">{tabTitles[tab]}</h2>
                <div className="dm-hdr-right">
                  {tab === "chats" && (
                    <button className="dm-hdr-action" onClick={() => setShowSearch(true)}>
                      <NavIc.Plus />
                    </button>
                  )}
                  {tab === "updates" && (
                    <button className="dm-hdr-action" onClick={() => {
                      document.dispatchEvent(new CustomEvent("dm:addStory"));
                    }}>
                      <NavIc.Plus />
                    </button>
                  )}
                </div>
              </div>

              {/* Tab body */}
              <div className="dm-list-body">
                {tab === "chats" && (
                  <ConversationList
                    currentUserId={currentUser?.id}
                    onSelect={openChat}
                    onNewChat={() => setShowSearch(true)}
                    onClose={onClose}
                    loading={loading}
                    activeConversationId={selectedConv?.id}
                    hideHeader
                  />
                )}
                {tab === "updates" && (
                  <UpdatesView
                    currentUser={currentUser}
                    onReplyAsDM={handleStoryReplyAsDM}
                  />
                )}
                {tab === "calls" && (
                  <CallsView onStartCall={openCall} />
                )}
              </div>

              {/* Mobile bottom nav — ONLY in list view */}
              <nav className="dm-bnav">
                {navItems.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`bnav-btn${tab === id ? " active" : ""}`}
                    onClick={() => switchTab(id)}
                  >
                    <Icon a={tab === id} />
                    <span className="bnav-lbl">{label}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>

      {showSearch && (
        <UserSearchModal
          currentUser={currentUser}
          onClose={() => setShowSearch(false)}
          onSelect={handleUserSelect}
        />
      )}

      <style>{`
        /* ── Backdrop ── */
        .dm-bd {
          position: fixed; inset: 0; z-index: 9990;
          background: transparent;
        }

        /* ── Panel: mobile = full screen ── */
        .dm-panel {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: row;
          background: #000; overflow: hidden;
        }

        /* ══ LEFT RAIL ══ */
        .dm-rail {
          display: none;
          flex-direction: column; align-items: center;
          padding: 16px 6px 16px;
          border-right: 1px solid rgba(132,204,22,0.1);
          background: rgba(4,4,4,0.99);
          width: 68px; flex-shrink: 0;
          gap: 2px;
        }
        .dm-rail-logo {
          width: 36px; height: 36px; border-radius: 12px;
          background: rgba(132,204,22,0.12); border: 1px solid rgba(132,204,22,0.25);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .rail-logo-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #84cc16;
          box-shadow: 0 0 8px rgba(132,204,22,0.6);
        }
        .rail-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          width: 54px; padding: 9px 4px; border-radius: 12px;
          background: transparent; border: none; color: #444; cursor: pointer;
          transition: background 0.15s, color 0.15s; -webkit-tap-highlight-color: transparent;
        }
        .rail-btn:hover  { background: rgba(255,255,255,0.04); color: #777; }
        .rail-btn.active { background: rgba(132,204,22,0.1); color: #84cc16; }
        .rail-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .rail-spacer { flex: 1; }
        .rail-close { color: #333; }
        .rail-close:hover { color: #84cc16; background: rgba(132,204,22,0.08); }

        /* ══ BODY ══ */
        .dm-body {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; min-width: 0; position: relative;
        }
        /* When in detail view, body takes everything */
        .dm-body-full { flex: 1; }

        /* ══ FULL-SCREEN DETAIL ══ */
        .dm-detail-full {
          position: absolute; inset: 0; z-index: 10;
          display: flex; flex-direction: column; overflow: hidden;
        }

        /* ══ LIST WRAP ══ */
        .dm-list-wrap {
          display: flex; flex-direction: column; height: 100%; overflow: hidden;
        }
        .dm-list-body {
          flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;
        }

        /* ── List header ── */
        .dm-list-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(env(safe-area-inset-top,0px) + 12px) 16px 10px;
          border-bottom: 1px solid rgba(132,204,22,0.1);
          background: rgba(0,0,0,0.98); flex-shrink: 0;
        }
        .dm-hdr-title {
          font-size: 17px; font-weight: 800; color: #fff;
          margin: 0; flex: 1; text-align: center; letter-spacing: -0.3px;
        }
        .dm-hdr-close, .dm-hdr-action {
          width: 34px; height: 34px; border-radius: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          color: #84cc16; cursor: pointer; transition: background 0.15s; flex-shrink: 0;
        }
        .dm-hdr-close:hover, .dm-hdr-action:hover { background: rgba(132,204,22,0.1); }
        .dm-hdr-right { width: 34px; display: flex; justify-content: flex-end; }

        /* ── Mobile bottom nav ── */
        .dm-bnav {
          display: flex;
          border-top: 1px solid rgba(132,204,22,0.1);
          background: rgba(4,4,4,0.99);
          padding-bottom: env(safe-area-inset-bottom,0px);
          flex-shrink: 0;
        }
        .bnav-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; padding: 9px 6px; background: transparent; border: none;
          color: #444; cursor: pointer; transition: color 0.15s;
          -webkit-tap-highlight-color: transparent; position: relative;
        }
        .bnav-btn.active { color: #84cc16; }
        .bnav-btn.active::after {
          content: ''; position: absolute; top: 0; left: 20%; right: 20%;
          height: 2px; border-radius: 0 0 3px 3px; background: #84cc16;
        }
        .bnav-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

        /* ══ DESKTOP: right-side drawer ══ */
        @media (min-width: 769px) {
          .dm-bd { background: transparent; }
          .dm-panel {
            left: auto; right: 0;
            width: 420px; height: 100vh;
            border-left: 1px solid rgba(132,204,22,0.12);
            box-shadow: -20px 0 60px rgba(0,0,0,0.6);
          }
          .dm-rail { display: flex; }
          .dm-bnav { display: none !important; }

          /* On desktop, detail view expands to fill the whole drawer */
          .dm-detail-full {
            position: absolute; inset: 0;
          }
        }
      `}</style>
    </>
  );
};

export default DMMessagesView;