// components/Messages/DMMessagesView.jsx — NOVA HUB v21 FULL FIX
// ============================================================================
// v21 FIXES:
//  [CRASH-FIX-1]  canShowChat now deep-checks otherUser shape before render
//  [CRASH-FIX-2]  selectedConv cleared atomically on tab switch (never stale)
//  [CALLS-FIX]    CallsView + CallsTab wired; openNewCall event handled
//  [GROUP-FIX]    Groups visible to all members; groupDMService reloads on notify
//  [BADGE-FIX]    All three badges working correctly
//  [INCOMING]     IncomingCallPopup shown over everything
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../services/config/supabase";
import dmMessageService from "../../services/messages/dmMessageService";
import groupDMService from "../../services/messages/groupDMService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import conversationState from "../../services/messages/ConversationStateManager";
import callService from "../../services/messages/callService";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import UserSearchModal from "./UserSearchModal";
import UpdatesView, { registerUpdatesBadgeSetter } from "./UpdatesView";
import CallsView from "./CallsView";
import ActiveCall from "./ActiveCall";
import GroupChatView from "./GroupChatView";
import IncomingCallPopup from "./IncomingCallPopup";

/* ─── Icons ─── */
const IChat = ({ a }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#84cc16" : "currentColor"} strokeWidth={a ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);
const IUpdates = ({ a }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#84cc16" : "currentColor"} strokeWidth={a ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/>
  </svg>
);
const ICalls = ({ a }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "#84cc16" : "currentColor"} strokeWidth={a ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>
);
const IClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IGroup = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const NAV = [
  { id: "chats",   label: "Chats",   Icon: IChat    },
  { id: "updates", label: "Updates", Icon: IUpdates },
  { id: "calls",   label: "Calls",   Icon: ICalls   },
];

/* ─── Create Group Modal ─── */
const CreateGroupModal = ({ currentUser, onClose, onCreate }) => {
  const [step,     setStep]     = useState("name");
  const [name,     setName]     = useState("");
  const [sel,      setSel]      = useState([]);
  const [search,   setSearch]   = useState("");
  const [contacts, setContacts] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    try {
      const convs = conversationState.getConversations?.() || [];
      const seen = new Set();
      const people = [];
      convs.forEach(c => {
        const o = c.user1_id === currentUser?.id ? (c.user2 || c.otherUser) : (c.user1 || c.otherUser);
        if (o?.id && !seen.has(o.id)) { seen.add(o.id); people.push(o); }
      });
      setContacts(people);
    } catch (_) {}
  }, [currentUser?.id]);

  const toggle = u => setSel(p => p.some(x => x.id === u.id) ? p.filter(x => x.id !== u.id) : [...p, u]);
  const filtered = contacts.filter(c => (c?.full_name || c?.name || "").toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!name.trim() || sel.length < 1 || creating) return;
    setCreating(true);
    try {
      const allMembers = [
        { id: currentUser?.id, full_name: currentUser?.fullName || currentUser?.full_name || "You", avatar_id: currentUser?.avatarId || currentUser?.avatar_id },
        ...sel,
      ];
      const group = await groupDMService.createGroup({ name: name.trim(), icon: "👥", members: allMembers });
      onCreate(group); onClose();
    } catch (e) {
      console.error("[CreateGroup]", e);
      const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const members = [
        { id: currentUser?.id, full_name: currentUser?.fullName || "You", avatar_id: currentUser?.avatarId, is_admin: true },
        ...sel.map(u => ({ id: u.id, full_name: u.full_name || u.name, avatar_id: u.avatar_id || u.avatarId })),
      ];
      const fallbackGroup = { id: groupId, name: name.trim(), icon: "👥", members, member_ids: members.map(m => m.id), isGroup: true };
      try { localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(fallbackGroup)); } catch (_) {}
      onCreate(fallbackGroup); onClose();
    } finally { setCreating(false); }
  };

  return (
    <div className="cgm-ov" onClick={onClose}>
      <div className="cgm-modal" onClick={e => e.stopPropagation()}>
        <div className="cgm-pill"/>
        {step === "name" ? (
          <>
            <div className="cgm-hd">
              <button className="cgm-cancel" onClick={onClose}>Cancel</button>
              <span className="cgm-title">New Group</span>
              <button className="cgm-next" onClick={() => name.trim() && setStep("members")} disabled={!name.trim()}>Next</button>
            </div>
            <div className="cgm-body">
              <div className="cgm-icon-wrap">👥</div>
              <input className="cgm-inp" placeholder="Group name…" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus/>
              <p className="cgm-hint">Name your group then add members</p>
            </div>
          </>
        ) : (
          <>
            <div className="cgm-hd">
              <button className="cgm-cancel" onClick={() => setStep("name")}>← Back</button>
              <span className="cgm-title">Add Members</span>
              <button className="cgm-next cgm-create" onClick={handleCreate} disabled={sel.length < 1 || creating}>{creating ? "…" : "Create"}</button>
            </div>
            {sel.length > 0 && (
              <div className="cgm-chips">
                {sel.map(u => (
                  <div key={u.id} className="cgm-chip" onClick={() => toggle(u)}>
                    <span style={{ fontSize: 16 }}>{(u.full_name || u.name || "?").charAt(0)}</span>
                    <span>{(u.full_name || u.name || "").split(" ")[0]}</span>
                    <span style={{ opacity: 0.6 }}>×</span>
                  </div>
                ))}
              </div>
            )}
            <div className="cgm-sw">
              <input className="cgm-search" placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="cgm-list">
              {filtered.length === 0 && <div className="cgm-empty">No contacts found</div>}
              {filtered.map(c => {
                if (!c) return null;
                const on = sel.some(u => u.id === c.id);
                return (
                  <div key={c.id} className={`cgm-row${on ? " cgm-on" : ""}`} onClick={() => toggle(c)}>
                    <div className="cgm-uav">{(c.full_name || c.name || "?").charAt(0)}</div>
                    <span className="cgm-rn">{c.full_name || c.name}</span>
                    <div className={`cgm-ck${on ? " cgm-ck-on" : ""}`}>{on && "✓"}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN DMMessagesView
// ════════════════════════════════════════════════════════════════════════════
const DMMessagesView = ({ currentUser, onClose, initialOtherUserId }) => {
  const [tab,           setTab]           = useState("chats");
  const [view,          setView]          = useState("list");
  const [selectedConv,  setSelectedConv]  = useState(null);
  const [activeCall,    setActiveCall]    = useState(null);
  const [activeGroup,   setActiveGroup]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [showSearch,    setShowSearch]    = useState(false);
  const [showCreateGrp, setShowCreateGrp] = useState(false);
  const [incomingCall,  setIncomingCall]  = useState(null);

  // [BADGES] Per-tab badge counts
  const [chatsBadge,   setChatsBadge]   = useState(0);
  const [updatesBadge, setUpdatesBadge] = useState(0);
  const [callsBadge,   setCallsBadge]   = useState(0);

  // tabRef lets badge callbacks read current tab without stale closures
  const tabRef = useRef("chats");
  useEffect(() => { tabRef.current = tab; }, [tab]);

  const initialized = useRef(false);
  const unsubList   = useRef(null);
  const notifyCh    = useRef(null);

  const uid   = currentUser?.id       || "";
  const uName = currentUser?.fullName || currentUser?.full_name || currentUser?.name || "User";
  const uAvId = currentUser?.avatarId || currentUser?.avatar_id || null;

  const norm = {
    id: uid, name: uName, fullName: uName,
    username: currentUser?.username || "user",
    avatar: currentUser?.avatar, avatarId: uAvId, avatar_id: uAvId,
    verified: currentUser?.verified || false,
  };

  // Total badge → app header
  const totalBadge = chatsBadge + updatesBadge + callsBadge;
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent("dm:badge_count", { detail: totalBadge })); } catch (_) {}
  }, [totalBadge]);

  // Init callService
  useEffect(() => {
    if (uid) callService.init(uid, uName, uAvId);
  }, [uid, uName, uAvId]);

  // INCOMING CALL LISTENER
  useEffect(() => {
    if (!uid) return;
    const unsubIn   = callService.on("incoming_call", callData => {
      // Only show popup if not already in a call
      setIncomingCall(prev => prev ? prev : callData);
    });
    const unsubEnd  = callService.on("call_ended", ({ callId }) => {
      setIncomingCall(prev => (prev?.callId === callId ? null : prev));
    });
    const unsubMiss = callService.on("missed_call", () => {
      setIncomingCall(null);
      if (tabRef.current !== "calls") setCallsBadge(p => p + 1);
    });
    return () => { unsubIn(); unsubEnd(); unsubMiss(); };
  }, [uid]);

  // Wire updates badge from UpdatesView
  // [BADGE-FIX] Use setUpdatesBadge(count) directly instead of accumulating
  // with prev + count — prevents badge inflating on every loadStatuses call.
  useEffect(() => {
    registerUpdatesBadgeSetter(count => {
      if (tabRef.current !== "updates") {
        setUpdatesBadge(count);  // ← FIX: set directly, not prev + count
      }
    });
    return () => registerUpdatesBadgeSetter(null);
  }, []);

  // Listen for dm:openNewCall event (from calls tab + button)
  useEffect(() => {
    const h = () => setShowSearch(true);
    document.addEventListener("dm:openNewCall", h);
    return () => document.removeEventListener("dm:openNewCall", h);
  }, []);

  // Init groupDMService + personal gc_notify channel
  useEffect(() => {
    if (!uid) return;
    groupDMService.init(uid);
    groupDMService.loadGroups();

    const nc = supabase
      .channel(`gc_notify:${uid}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "gc_new_group" }, ({ payload }) => {
        if (!payload?.id || !Array.isArray(payload?.members)) return;
        if (!payload.members.some(m => m?.id === uid)) return;
        try { localStorage.setItem(`gc_meta_${payload.id}`, JSON.stringify({ ...payload, isGroup: true })); } catch (_) {}
        groupDMService.loadGroups();
      })
      .subscribe();
    notifyCh.current = nc;
    return () => {
      if (notifyCh.current) { try { supabase.removeChannel(notifyCh.current); } catch (_) {} notifyCh.current = null; }
    };
  }, [uid]);

  // Init DM service + conversation badges
  useEffect(() => {
    if (!uid) return;
    onlineStatusService.start?.(uid);
    dmMessageService.init(uid).then(() => setLoading(false)).catch(() => setLoading(false));
    unsubList.current = dmMessageService.subscribeToConversationList?.();

    const syncChatBadge = () => {
      try { setChatsBadge(conversationState.getTotalUnreadCount?.() ?? 0); } catch (_) {}
    };
    syncChatBadge();
    const unsub = conversationState.subscribe?.(syncChatBadge);
    return () => { unsubList.current?.(); dmMessageService.cleanup?.(); unsub?.(); };
  }, [uid]);

  // Auto-open conversation from initialOtherUserId
  useEffect(() => {
    if (!initialOtherUserId || !uid || initialized.current) return;
    initialized.current = true;
    dmMessageService.createConversation(uid, initialOtherUserId)
      .then(conv => {
        const o = conv.user1_id === uid ? conv.user2 : conv.user1;
        if (!o?.id) return;
        setSelectedConv({ ...conv, otherUser: o, lastMessage: null, unreadCount: 0 });
        setTab("chats"); setView("chat");
      })
      .catch(e => console.error("[DM] init:", e));
  }, [initialOtherUserId, uid]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Navigation ── */
  const openChat = useCallback(conv => {
    // [CRASH-FIX] validate conv fully before opening
    if (!conv?.id || typeof conv.id !== "string") return;
    const otherUser = conv.otherUser || conv.user1 || conv.user2;
    if (!otherUser?.id) return;
    const safeConv = { ...conv, otherUser };
    setActiveGroup(null);
    setActiveCall(null);
    setSelectedConv(safeConv);
    setTab("chats");
    setView("chat");
  }, []);

  const openGroupChat = useCallback(g => {
    if (!g?.id) return;
    try { localStorage.setItem(`gc_meta_${g.id}`, JSON.stringify({ ...g, isGroup: true })); } catch (_) {}
    setSelectedConv(null);
    setActiveCall(null);
    setActiveGroup(g);
    setTab("chats");
    setView("group");
  }, []);

  const openCall = useCallback(callInfo => {
    if (!callInfo) return;
    setActiveCall(callInfo);
    setView("call");
  }, []);

  const endCall    = useCallback(() => {
    setActiveCall(null);
    setView("list");
  }, []);

  const backToList = useCallback(() => {
    setSelectedConv(null);
    setActiveCall(null);
    setActiveGroup(null);
    setView("list");
  }, []);

  // switchTab ALWAYS resets view and detail state to prevent stale renders
  const switchTab = useCallback(id => {
    // Clear detail state BEFORE switching tab — prevents ChatView from
    // briefly receiving a stale selectedConv on re-render
    setSelectedConv(null);
    setActiveCall(null);
    setActiveGroup(null);
    setView("list");
    setTab(id);
    if (id === "chats")   setChatsBadge(0);
    if (id === "updates") setUpdatesBadge(0);
    if (id === "calls")   setCallsBadge(0);
  }, []);

  const handleUserSelect = useCallback(async user => {
    if (!user?.id || !uid) return;
    try {
      const conv = await dmMessageService.createConversation(uid, user.id);
      // Build otherUser from whichever side is not us
      const rawOther = conv.user1_id === uid ? conv.user2 : conv.user1;
      const otherUser = rawOther || user; // fall back to searched user
      if (!otherUser?.id) return;
      setSelectedConv({ ...conv, otherUser, lastMessage: null, unreadCount: 0 });
      setTab("chats");
      setView("chat");
      setShowSearch(false);
    } catch (e) { console.error("[DM] select:", e); }
  }, [uid]);

  const handleStoryReply = useCallback(async ctx => {
    if (!uid) return;
    const targetId   = ctx?.userId || ctx?.user_id;
    const statusText = ctx?.replyToStatus?.text || ctx?.text || "";
    if (!targetId || targetId === uid) return;
    try {
      const conv = await dmMessageService.createConversation(uid, targetId);
      const rawOther = conv.user1_id === uid ? conv.user2 : conv.user1;
      if (!rawOther?.id) return;
      setSelectedConv({ ...conv, otherUser: rawOther, lastMessage: null, unreadCount: 0 });
      setTab("chats"); setView("chat");
      if (statusText?.trim()) {
        await new Promise(r => setTimeout(r, 350));
        await dmMessageService.sendMessage(conv.id, `↩ Replying to status: "${statusText.slice(0, 60)}${statusText.length > 60 ? "…" : ""}"`, uid);
      }
    } catch (e) { console.error("[DM] story reply:", e); }
  }, [uid]);

  const handlePlus = useCallback(() => {
    if (tab === "chats")   { setShowSearch(true); return; }
    if (tab === "updates") { document.dispatchEvent(new CustomEvent("dm:addStory")); return; }
    if (tab === "calls")   { setShowSearch(true); return; } // reuse user search to start a call
  }, [tab]);

  // Start outgoing call via callService
  const handleStartCall = useCallback(async (callInfo) => {
    if (!callInfo) return;
    const calleeId = callInfo.user?.id || callInfo.calleeId;
    if (calleeId) {
      const callId = callInfo.callId || `call_${uid}_${calleeId}_${Date.now()}`;
      callService.startCall({
        callId,
        calleeId,
        callType: callInfo.type || "audio",
        callerProfile: norm,
      }).catch(e => console.warn("[DM] startCall:", e));
      openCall({ ...callInfo, callId });
    } else {
      openCall(callInfo);
    }
  }, [uid, norm, openCall]);

  // Accept incoming call
  const handleAcceptIncoming = useCallback(({ callId, callerId, callerName, callType, caller }) => {
    setIncomingCall(null);
    openCall({
      callId,
      name: callerName || caller?.full_name || "Caller",
      type: callType || "audio",
      outgoing: false,
      user: caller || { id: callerId, full_name: callerName },
    });
  }, [openCall]);

  const isDetail = view === "chat" || view === "call" || view === "group";
  const tabTitle = { chats: "Messages", updates: "Updates", calls: "Calls" }[tab];

  // [CRASH-FIX] Multi-layer guard — conv must exist, have string id, AND have a valid otherUser with id
  const canShowChat = (
    view === "chat" &&
    selectedConv !== null &&
    typeof selectedConv === "object" &&
    typeof selectedConv.id === "string" &&
    selectedConv.id.length > 0 &&
    selectedConv.otherUser !== null &&
    typeof selectedConv.otherUser === "object" &&
    typeof selectedConv.otherUser.id === "string" &&
    selectedConv.otherUser.id.length > 0
  );

  return (
    <>
      <div className="dmh-bd" onClick={onClose}/>
      <div className="dmh-panel">

        {/* INCOMING CALL POPUP — renders over everything */}
        {incomingCall && (
          <IncomingCallPopup
            call={incomingCall}
            onAccept={handleAcceptIncoming}
            onDecline={() => setIncomingCall(null)}
          />
        )}

        {/* Desktop sidebar rail */}
        {!isDetail && (
          <nav className="dmh-rail">
            <div className="dmh-rail-logo"><div className="dmh-rail-dot"/></div>
            {NAV.map(({ id, label, Icon }) => {
              const badge = id === "chats" ? chatsBadge : id === "updates" ? updatesBadge : callsBadge;
              return (
                <button key={id} className={`dmh-rail-btn${tab === id ? " dmh-rail-on" : ""}`} onClick={() => switchTab(id)} aria-label={label}>
                  <div className="dmh-rail-iw">
                    <Icon a={tab === id}/>
                    {badge > 0 && <span className="dmh-rail-badge">{badge > 99 ? "99+" : badge}</span>}
                  </div>
                  <span className="dmh-rail-lbl">{label}</span>
                </button>
              );
            })}
            <div style={{ flex: 1 }}/>
            <button className="dmh-rail-btn dmh-rail-close" onClick={onClose}>
              <IClose/><span className="dmh-rail-lbl">Close</span>
            </button>
          </nav>
        )}

        <div className={`dmh-body${isDetail ? " dmh-full" : ""}`}>
          {/* Active call */}
          {view === "call" && activeCall && (
            <div className="dmh-screen">
              <ActiveCall call={activeCall} onEnd={endCall} currentUser={norm}/>
            </div>
          )}

          {/* DM chat — strict multi-layer guard */}
          {canShowChat && (
            <div className="dmh-screen">
              <ChatView
                key={selectedConv.id}
                conversation={selectedConv}
                currentUser={norm}
                onBack={backToList}
                onStartCall={type => handleStartCall({
                  name: selectedConv.otherUser?.full_name || "Call",
                  type,
                  outgoing: true,
                  callId: `call_${uid}_${selectedConv.otherUser?.id}_${Date.now()}`,
                  user: selectedConv.otherUser,
                })}
              />
            </div>
          )}

          {/* Group chat */}
          {view === "group" && activeGroup?.id && (
            <div className="dmh-screen">
              <GroupChatView group={activeGroup} currentUser={norm} onBack={backToList} onStartCall={openCall}/>
            </div>
          )}

          {/* List view */}
          {view === "list" && (
            <div className="dmh-list-wrap">
              <div className="dmh-hdr">
                <button className="dmh-hdr-x" onClick={onClose}><IClose/></button>
                <span className="dmh-hdr-title">{tabTitle}</span>
                <div className="dmh-hdr-right">
                  {tab === "chats" && (
                    <button className="dmh-hdr-btn dmh-btn-grp" onClick={() => setShowCreateGrp(true)} title="New group"><IGroup/></button>
                  )}
                  <button className="dmh-hdr-btn" onClick={handlePlus} title="New"><IPlus/></button>
                </div>
              </div>

              <div className="dmh-tab-body">
                {tab === "chats" && (
                  <ConversationList
                    currentUserId={uid}
                    onSelect={openChat}
                    onSelectGroup={openGroupChat}
                    onNewChat={() => setShowSearch(true)}
                    onClose={onClose}
                    loading={loading}
                    activeConversationId={selectedConv?.id}
                    activeGroupId={activeGroup?.id}
                    hideHeader
                  />
                )}
                {tab === "updates" && (
                  <UpdatesView currentUser={norm} userId={uid} onOpenDM={handleStoryReply}/>
                )}
                {tab === "calls" && (
                  <CallsView
                    onStartCall={(callInfo) => handleStartCall(callInfo)}
                    currentUser={norm}
                  />
                )}
              </div>

              {/* Mobile bottom nav */}
              <nav className="dmh-bnav">
                {NAV.map(({ id, label, Icon }) => {
                  const badge = id === "chats" ? chatsBadge : id === "updates" ? updatesBadge : callsBadge;
                  return (
                    <button key={id} className={`dmh-bnav-btn${tab === id ? " dmh-bnav-on" : ""}`} onClick={() => switchTab(id)}>
                      <div className="dmh-bnav-iw">
                        <Icon a={tab === id}/>
                        {badge > 0 && <span className="dmh-bnav-badge">{badge > 99 ? "99+" : badge}</span>}
                      </div>
                      <span className="dmh-bnav-lbl">{label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>

      {showSearch    && <UserSearchModal currentUser={norm} onClose={() => setShowSearch(false)} onSelect={handleUserSelect}/>}
      {showCreateGrp && <CreateGroupModal currentUser={norm} onClose={() => setShowCreateGrp(false)} onCreate={openGroupChat}/>}

      <style>{CSS}</style>
    </>
  );
};

const CSS = `
.dmh-bd{position:fixed;inset:0;z-index:9990;background:transparent;}
.dmh-panel{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:row;background:#000;overflow:hidden;}
.dmh-rail{display:none;flex-direction:column;align-items:center;padding:16px 6px;border-right:1px solid rgba(132,204,22,.1);background:rgba(4,4,4,.99);width:70px;flex-shrink:0;gap:2px;}
.dmh-rail-logo{width:38px;height:38px;border-radius:12px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;margin-bottom:16px;}
.dmh-rail-dot{width:11px;height:11px;border-radius:50%;background:#84cc16;box-shadow:0 0 10px rgba(132,204,22,.7);}
.dmh-rail-btn{display:flex;flex-direction:column;align-items:center;gap:4px;width:56px;padding:9px 4px;border-radius:12px;background:transparent;border:none;color:#444;cursor:pointer;transition:background .15s,color .15s;}
.dmh-rail-btn:hover{background:rgba(255,255,255,.04);color:#777;}
.dmh-rail-on{background:rgba(132,204,22,.1)!important;color:#84cc16!important;}
.dmh-rail-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.dmh-rail-iw{position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;}
.dmh-rail-badge{position:absolute;top:-6px;right:-10px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:#ef4444;color:#fff;font-size:9px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(4,4,4,.99);white-space:nowrap;animation:bdgPop .3s cubic-bezier(.34,1.56,.64,1);}
@keyframes bdgPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
.dmh-rail-close{color:#333;}.dmh-rail-close:hover{color:#84cc16;background:rgba(132,204,22,.07)!important;}
.dmh-body{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;position:relative;}
.dmh-full{flex:1;}
.dmh-screen{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;overflow:hidden;}
.dmh-list-wrap{display:flex;flex-direction:column;height:100%;overflow:hidden;}
.dmh-tab-body{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;}
.dmh-hdr{display:flex;align-items:center;gap:10px;padding-top:calc(env(safe-area-inset-top,0px)+12px);padding-bottom:12px;padding-left:16px;padding-right:16px;border-bottom:1px solid rgba(132,204,22,.1);background:rgba(0,0,0,.98);flex-shrink:0;min-height:56px;box-sizing:border-box;}
.dmh-hdr-x{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;flex-shrink:0;transition:background .15s;}
.dmh-hdr-x:hover{background:rgba(132,204,22,.1);}
.dmh-hdr-title{flex:1;min-width:0;text-align:center;font-size:17px;font-weight:800;color:#fff;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dmh-hdr-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.dmh-hdr-btn{width:34px;height:34px;border-radius:10px;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;color:#84cc16;cursor:pointer;transition:background .15s;}
.dmh-hdr-btn:hover{background:rgba(132,204,22,.2);}
.dmh-btn-grp{background:rgba(96,165,250,.1)!important;border-color:rgba(96,165,250,.25)!important;color:#60a5fa!important;}
.dmh-bnav{display:flex;border-top:1px solid rgba(132,204,22,.1);background:rgba(4,4,4,.99);padding-bottom:env(safe-area-inset-bottom,0px);flex-shrink:0;}
.dmh-bnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 6px;background:transparent;border:none;color:#444;cursor:pointer;transition:color .15s;position:relative;}
.dmh-bnav-on{color:#84cc16;}
.dmh-bnav-on::after{content:'';position:absolute;top:0;left:20%;right:20%;height:2.5px;border-radius:0 0 4px 4px;background:#84cc16;}
.dmh-bnav-iw{position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;}
.dmh-bnav-badge{position:absolute;top:-6px;right:-12px;min-width:17px;height:17px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#ef4444;color:#fff;font-size:9px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;border:2px solid rgba(4,4,4,.99);white-space:nowrap;}
.dmh-bnav-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.cgm-ov{position:fixed;inset:0;z-index:20002;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;backdrop-filter:blur(4px);}
.cgm-modal{width:100%;max-height:88vh;background:#080808;border:1px solid rgba(132,204,22,.15);border-radius:24px 24px 0 0;overflow:hidden;display:flex;flex-direction:column;animation:cgmUp .3s cubic-bezier(.34,1.4,.64,1);}
@keyframes cgmUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.cgm-pill{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:12px auto 0;flex-shrink:0;}
.cgm-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 12px;flex-shrink:0;}
.cgm-title{font-size:16px;font-weight:800;color:#fff;}
.cgm-cancel{background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer;}
.cgm-next{padding:7px 16px;border-radius:12px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:13px;font-weight:700;cursor:pointer;}
.cgm-next:disabled{opacity:.35;cursor:not-allowed;}
.cgm-create{background:rgba(132,204,22,.2)!important;border-color:rgba(132,204,22,.5)!important;}
.cgm-body{display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;}
.cgm-icon-wrap{width:80px;height:80px;border-radius:50%;background:rgba(132,204,22,.1);border:2px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;font-size:40px;}
.cgm-inp{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#fff;font-size:16px;padding:14px 16px;outline:none;caret-color:#84cc16;text-align:center;font-weight:600;box-sizing:border-box;}
.cgm-inp:focus{border-color:rgba(132,204,22,.35);}.cgm-inp::placeholder{color:#333;}
.cgm-hint{font-size:12px;color:#444;text-align:center;margin:0;}
.cgm-chips{display:flex;gap:8px;flex-wrap:wrap;padding:4px 20px 8px;flex-shrink:0;}
.cgm-chip{display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:20px;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:12px;font-weight:600;cursor:pointer;}
.cgm-sw{padding:0 20px 8px;flex-shrink:0;width:100%;box-sizing:border-box;}
.cgm-search{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#fff;font-size:14px;padding:10px 14px;outline:none;box-sizing:border-box;}
.cgm-search::placeholder{color:#333;}
.cgm-list{flex:1;overflow-y:auto;padding:4px 0 16px;}
.cgm-row{display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;transition:background .15s;}
.cgm-row:hover{background:rgba(255,255,255,.03);}.cgm-on{background:rgba(132,204,22,.06);}
.cgm-uav{width:36px;height:36px;border-radius:50%;background:rgba(132,204,22,.1);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#84cc16;flex-shrink:0;}
.cgm-rn{flex:1;font-size:14px;font-weight:600;color:#fff;}
.cgm-ck{width:24px;height:24px;border-radius:50%;border:1.5px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:12px;color:transparent;flex-shrink:0;}
.cgm-ck-on{background:#84cc16!important;border-color:#84cc16!important;color:#000!important;font-weight:800;}
.cgm-empty{text-align:center;padding:24px;color:#444;font-size:13px;}
@media(min-width:769px){
  .dmh-panel{left:auto;right:0;width:420px;height:100vh;border-left:1px solid rgba(132,204,22,.12);box-shadow:-24px 0 72px rgba(0,0,0,.7);animation:dmhSlide .28s cubic-bezier(.22,1,.36,1);}
  @keyframes dmhSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
  .dmh-rail{display:flex;}
  .dmh-bnav{display:none!important;}
  .dmh-screen{position:absolute;inset:0;}
  .dmh-hdr-x{display:none;}
  .dmh-hdr-title{text-align:left;}
}
`;

export default DMMessagesView;