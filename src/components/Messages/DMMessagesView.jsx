// ============================================================================
// components/Messages/DMMessagesView.jsx — NOVA HUB v11 FINAL
// ============================================================================
// FIXED vs v10:
//  [FIX-PAD]  Header (.dmhub-hdr) padding increased to 14px left/right so
//             the × close button, title, and action buttons have proper
//             breathing room and don't look cramped against the edges.
//             Also added explicit min-width:0 on .dmhub-hdr-title so long
//             titles never push buttons off screen.
//  [FIX-GRP]  localStorage parsing guarded — corrupt entries silently skipped.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import dmMessageService from "../../services/messages/dmMessageService";
import onlineStatusService from "../../services/messages/onlineStatusService";
import conversationState from "../../services/messages/ConversationStateManager";
import mediaUrlService from "../../services/shared/mediaUrlService";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import UserSearchModal from "./UserSearchModal";
import UpdatesView from "./UpdatesView";
import CallsView from "./CallsView";
import ActiveCall from "./ActiveCall";
import GroupChatView from "./GroupChatView";

/* ─── Icons ─── */
const IChat    = ({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"#84cc16":"currentColor"} strokeWidth={a?2.5:1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const IUpdates = ({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"#84cc16":"currentColor"} strokeWidth={a?2.5:1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>;
const ICalls   = ({a})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?"#84cc16":"currentColor"} strokeWidth={a?2.5:1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
const IClose   = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IPlus    = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IGroup   = ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;

const NAV = [
  { id:"chats",   label:"Chats",   Icon: IChat    },
  { id:"updates", label:"Updates", Icon: IUpdates },
  { id:"calls",   label:"Calls",   Icon: ICalls   },
];

/* ─── Contact avatar ─── */
const ContactAv = ({ user, size = 42 }) => {
  const [err, setErr] = useState(false);
  const id  = user?.avatar_id || user?.avatarId;
  const url = !err && id ? mediaUrlService.getAvatarUrl(id, 200) : null;
  const ini = (user?.full_name || user?.name || "?").charAt(0).toUpperCase();
  return (
    <div className="cgm-uav" style={{ width: size, height: size, fontSize: size * 0.38, flexShrink: 0 }}>
      {url
        ? <img src={url} alt={user?.full_name || "?"} onError={() => setErr(true)}
            style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }}/>
        : <span style={{ fontWeight:800, color:"#84cc16" }}>{ini}</span>
      }
    </div>
  );
};

/* ─── Create Group Modal ─── */
const CreateGroupModal = ({ currentUser, onClose, onCreate }) => {
  const [step,     setStep]     = useState("name");
  const [name,     setName]     = useState("");
  const [sel,      setSel]      = useState([]);
  const [search,   setSearch]   = useState("");
  const [contacts, setContacts] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    import("../../services/messages/ConversationStateManager").then(m => {
      const convs = m.default.getConversations?.() || [];
      const seen = new Set(); const people = [];
      convs.forEach(c => {
        const o = c.user1_id === currentUser?.id ? (c.user2 || c.otherUser) : (c.user1 || c.otherUser);
        if (o?.id && !seen.has(o.id)) { seen.add(o.id); people.push(o); }
      });
      setContacts(people);
    }).catch(() => {});
  }, [currentUser?.id]);

  const toggle   = u => setSel(p => p.some(x => x.id === u.id) ? p.filter(x => x.id !== u.id) : [...p, u]);
  const filtered = contacts.filter(c => (c?.full_name || c?.name || "").toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!name.trim() || sel.length < 1 || creating) return;
    setCreating(true);
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const allMembers = [
      {
        id:        currentUser?.id,
        full_name: currentUser?.fullName || currentUser?.full_name || currentUser?.name || "You",
        avatar_id: currentUser?.avatarId || currentUser?.avatar_id,
        is_admin:  true,
      },
      ...sel.map(u => ({ id: u.id, full_name: u.full_name || u.name, avatar_id: u.avatar_id || u.avatarId })),
    ];
    const group = { id: groupId, name: name.trim(), icon: "👥", members: allMembers };
    localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(group));
    onCreate(group);
    onClose();
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
              <input className="cgm-inp" placeholder="Group name…" value={name}
                onChange={e => setName(e.target.value)} maxLength={60} autoFocus/>
              <p className="cgm-hint">Name your group then add members</p>
            </div>
          </>
        ) : (
          <>
            <div className="cgm-hd">
              <button className="cgm-cancel" onClick={() => setStep("name")}>← Back</button>
              <span className="cgm-title">Add Members</span>
              <button className="cgm-next cgm-create" onClick={handleCreate} disabled={sel.length < 1 || creating}>
                {creating ? "…" : "Create"}
              </button>
            </div>
            {sel.length > 0 && (
              <div className="cgm-chips">
                {sel.map(u => (
                  <div key={u.id} className="cgm-chip" onClick={() => toggle(u)}>
                    <ContactAv user={u} size={22}/>
                    <span>{(u.full_name||u.name||"").split(" ")[0]}</span>
                    <span style={{opacity:.6}}>×</span>
                  </div>
                ))}
              </div>
            )}
            <div className="cgm-sw">
              <input className="cgm-search" placeholder="Search contacts…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="cgm-list">
              {filtered.length === 0 && <div className="cgm-empty">No contacts found</div>}
              {filtered.map(c => {
                if (!c) return null;
                const on = sel.some(u => u.id === c.id);
                return (
                  <div key={c.id} className={`cgm-row${on ? " cgm-on" : ""}`} onClick={() => toggle(c)}>
                    <ContactAv user={c} size={42}/>
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

/* ════════════════════════════════════════════════════
   MAIN DM MESSAGES VIEW
════════════════════════════════════════════════════ */
const DMMessagesView = ({ currentUser, onClose, initialOtherUserId }) => {
  const [tab,           setTab]           = useState("chats");
  const [view,          setView]          = useState("list");
  const [selectedConv,  setSelectedConv]  = useState(null);
  const [activeCall,    setActiveCall]    = useState(null);
  const [activeGroup,   setActiveGroup]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [showSearch,    setShowSearch]    = useState(false);
  const [showCreateGrp, setShowCreateGrp] = useState(false);
  const [groups,        setGroups]        = useState([]);
  const [navBadges,     setNavBadges]     = useState({ chats: 0, updates: 0, calls: 0 });

  const initialized = useRef(false);
  const unsubList   = useRef(null);

  // Load persisted groups from localStorage — safely
  useEffect(() => {
    const stored = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith("gc_meta_")) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const g = JSON.parse(raw);
          if (!g?.id || !g?.name || !Array.isArray(g?.members)) continue;
          if (g.members.some(m => m?.id === currentUser?.id)) stored.push(g);
        } catch { /* corrupt entry — skip */ }
      }
    } catch { /* localStorage unavailable */ }
    setGroups(stored);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    onlineStatusService.start(currentUser.id);
    dmMessageService.init(currentUser.id).then(() => setLoading(false));
    unsubList.current = dmMessageService.subscribeToConversationList?.();

    const syncBadges = () => {
      try {
        const total = conversationState.getTotalUnreadCount?.() ?? 0;
        setNavBadges(prev => ({ ...prev, chats: total }));
      } catch {}
    };
    syncBadges();
    const unsubConv = conversationState.subscribe?.(syncBadges);

    return () => {
      unsubList.current?.();
      dmMessageService.cleanup?.();
      unsubConv?.();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!initialOtherUserId || !currentUser?.id || initialized.current) return;
    initialized.current = true;
    dmMessageService.createConversation(currentUser.id, initialOtherUserId)
      .then(conv => {
        const o = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
        setSelectedConv({ ...conv, otherUser: o, lastMessage: null, unreadCount: 0 });
        setTab("chats"); setView("chat");
      }).catch(e => console.error("❌ [DM] Init:", e));
  }, [initialOtherUserId, currentUser?.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const openChat = useCallback((conv) => {
    setSelectedConv(conv); setTab("chats"); setView("chat"); setActiveGroup(null);
  }, []);

  const openGroupChat = useCallback((g) => {
    const key = `gc_meta_${g.id}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(g));
    setGroups(prev => prev.some(x => x.id === g.id) ? prev : [...prev, g]);
    setActiveGroup(g); setTab("chats"); setView("group"); setSelectedConv(null);
  }, []);

  const openCall  = useCallback((info) => { setActiveCall(info); setView("call"); }, []);
  const endCall   = useCallback(() => { setActiveCall(null); setView("list"); }, []);

  const backToList = useCallback(() => {
    setSelectedConv(null); setActiveCall(null); setActiveGroup(null); setView("list");
  }, []);

  const switchTab = useCallback((id) => {
    setTab(id);
    setNavBadges(prev => ({ ...prev, [id]: 0 }));
    if (view === "call") { setActiveCall(null); setView("list"); }
    else if (view === "chat" || view === "group") setView("list");
  }, [view]);

  const handleUserSelect = useCallback(async (user) => {
    try {
      const conv = await dmMessageService.createConversation(currentUser.id, user.id);
      const o = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
      setSelectedConv({ ...conv, otherUser: o, lastMessage: null, unreadCount: 0 });
      setTab("chats"); setView("chat"); setShowSearch(false);
    } catch(e) { console.error("❌ [DM] select:", e); }
  }, [currentUser?.id]);

  const handleStoryReply = useCallback(async (story, text) => {
    if (!currentUser?.id || !story?.user_id || !text?.trim()) return;
    if (story.user_id === currentUser.id) return;
    try {
      const conv = await dmMessageService.createConversation(currentUser.id, story.user_id);
      const o = conv.user1_id === currentUser.id ? conv.user2 : conv.user1;
      await dmMessageService.sendMessage(conv.id, text.trim(), currentUser.id);
      setSelectedConv({ ...conv, otherUser: o, lastMessage: null, unreadCount: 0 });
      setTab("chats"); setView("chat");
    } catch(e) { console.error("❌ story reply:", e); }
  }, [currentUser?.id]);

  const handlePlus = useCallback(() => {
    if (tab === "chats")   { setShowSearch(true); return; }
    if (tab === "updates") { document.dispatchEvent(new CustomEvent("dm:addStory")); return; }
    if (tab === "calls")   { document.dispatchEvent(new CustomEvent("dm:openNewCall")); return; }
  }, [tab]);

  const isDetail = view === "chat" || view === "call" || view === "group";
  const tabTitle = { chats:"Messages", updates:"Updates", calls:"Calls" }[tab];

  const currentUserNorm = {
    id:        currentUser?.id,
    name:      currentUser?.name     || currentUser?.fullName || currentUser?.full_name || "User",
    fullName:  currentUser?.fullName || currentUser?.full_name || currentUser?.name     || "User",
    username:  currentUser?.username || "user",
    avatar:    currentUser?.avatar,
    avatarId:  currentUser?.avatarId || currentUser?.avatar_id,
    avatar_id: currentUser?.avatar_id || currentUser?.avatarId,
    verified:  currentUser?.verified || false,
  };

  return (
    <>
      <div className="dmhub-bd" onClick={onClose}/>
      <div className="dmhub-panel">

        {/* ═══ DESKTOP LEFT RAIL ═══ */}
        {!isDetail && (
          <nav className="dmhub-rail">
            <div className="dmhub-rail-logo"><div className="dmhub-rail-dot"/></div>
            {NAV.map(({ id, label, Icon }) => (
              <button key={id} className={`dmhub-rail-btn${tab===id?" dmhub-rail-active":""}`}
                onClick={() => switchTab(id)} aria-label={label}>
                <div className="dmhub-rail-icon-wrap">
                  <Icon a={tab===id}/>
                  {navBadges[id] > 0 && (
                    <span className="dmhub-rail-badge">
                      {navBadges[id] > 99 ? "99+" : navBadges[id]}
                    </span>
                  )}
                </div>
                <span className="dmhub-rail-lbl">{label}</span>
              </button>
            ))}
            <div className="dmhub-rail-spacer"/>
            <button className="dmhub-rail-btn dmhub-rail-close" onClick={onClose}>
              <IClose/><span className="dmhub-rail-lbl">Close</span>
            </button>
          </nav>
        )}

        {/* ═══ BODY ═══ */}
        <div className={`dmhub-body${isDetail?" dmhub-body-full":""}`}>

          {/* Call */}
          {view === "call" && activeCall && (
            <div className="dmhub-fullscreen">
              <ActiveCall call={activeCall} onEnd={endCall} currentUser={currentUserNorm}/>
            </div>
          )}

          {/* Chat */}
          {view === "chat" && selectedConv && (
            <div className="dmhub-fullscreen">
              <ChatView
                conversation={selectedConv}
                currentUser={currentUserNorm}
                onBack={backToList}
                onStartCall={(type) => openCall({
                  name:    selectedConv.otherUser?.full_name || "Call",
                  type, outgoing: true,
                  callId:  `call_${currentUserNorm.id}_${selectedConv.otherUser?.id}_${Date.now()}`,
                  user:    selectedConv.otherUser,
                })}
              />
            </div>
          )}

          {/* Group chat */}
          {view === "group" && activeGroup && (
            <div className="dmhub-fullscreen">
              <GroupChatView group={activeGroup} currentUser={currentUserNorm}
                onBack={backToList} onStartCall={openCall}/>
            </div>
          )}

          {/* LIST */}
          {view === "list" && (
            <div className="dmhub-list-wrap">

              {/* ── Header ── [FIX-PAD] proper 16px horizontal padding */}
              <div className="dmhub-hdr">
                <button className="dmhub-hdr-close" onClick={onClose} aria-label="Close">
                  <IClose/>
                </button>
                <span className="dmhub-hdr-title">{tabTitle}</span>
                <div className="dmhub-hdr-right">
                  {tab === "chats" && (
                    <button className="dmhub-hdr-btn dmhub-btn-grp" onClick={() => setShowCreateGrp(true)} title="New group">
                      <IGroup/>
                    </button>
                  )}
                  <button className="dmhub-hdr-btn" onClick={handlePlus} title="New">
                    <IPlus/>
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div className="dmhub-tab-body">
                {tab === "chats" && (
                  <>
                    {groups.length > 0 && (
                      <div className="dmhub-groups-section">
                        {groups.map(g => (
                          <div key={g.id} className="dmhub-group-row" onClick={() => openGroupChat(g)}>
                            <div className="dmhub-group-av">{g.icon||"👥"}</div>
                            <div className="dmhub-group-info">
                              <div className="dmhub-group-name">{g.name}</div>
                              <div className="dmhub-group-sub">Group · {g.members?.length||0} members</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <ConversationList
                      currentUserId={currentUserNorm.id}
                      onSelect={openChat}
                      onNewChat={() => setShowSearch(true)}
                      onClose={onClose}
                      loading={loading}
                      activeConversationId={selectedConv?.id}
                      hideHeader
                    />
                  </>
                )}
                {tab === "updates" && <UpdatesView currentUser={currentUserNorm} onReplyAsDM={handleStoryReply}/>}
                {tab === "calls"   && <CallsView onStartCall={openCall} currentUser={currentUserNorm}/>}
              </div>

              {/* Mobile bottom nav */}
              <nav className="dmhub-bnav">
                {NAV.map(({ id, label, Icon }) => (
                  <button key={id} className={`dmhub-bnav-btn${tab===id?" dmhub-bnav-active":""}`}
                    onClick={() => switchTab(id)}>
                    <div className="dmhub-bnav-icon-wrap">
                      <Icon a={tab===id}/>
                      {navBadges[id] > 0 && (
                        <span className="dmhub-bnav-badge">
                          {navBadges[id] > 99 ? "99+" : navBadges[id]}
                        </span>
                      )}
                    </div>
                    <span className="dmhub-bnav-lbl">{label}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>

      {showSearch    && <UserSearchModal currentUser={currentUserNorm} onClose={() => setShowSearch(false)} onSelect={handleUserSelect}/>}
      {showCreateGrp && <CreateGroupModal currentUser={currentUserNorm} onClose={() => setShowCreateGrp(false)} onCreate={openGroupChat}/>}

      <style>{HUB_CSS}</style>
    </>
  );
};

const HUB_CSS = `
  .dmhub-bd { position:fixed;inset:0;z-index:9990;background:transparent; }
  .dmhub-panel { position:fixed;inset:0;z-index:9999;display:flex;flex-direction:row;background:#000;overflow:hidden; }

  /* ── Rail (desktop) ── */
  .dmhub-rail { display:none;flex-direction:column;align-items:center;padding:16px 6px;border-right:1px solid rgba(132,204,22,.1);background:rgba(4,4,4,.99);width:70px;flex-shrink:0;gap:2px; }
  .dmhub-rail-logo { width:38px;height:38px;border-radius:12px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;margin-bottom:16px;flex-shrink:0; }
  .dmhub-rail-dot { width:11px;height:11px;border-radius:50%;background:#84cc16;box-shadow:0 0 10px rgba(132,204,22,.7); }
  .dmhub-rail-btn { display:flex;flex-direction:column;align-items:center;gap:4px;width:56px;padding:9px 4px;border-radius:12px;background:transparent;border:none;color:#444;cursor:pointer;transition:background .15s,color .15s; }
  .dmhub-rail-btn:hover { background:rgba(255,255,255,.04);color:#777; }
  .dmhub-rail-active { background:rgba(132,204,22,.1)!important;color:#84cc16!important; }
  .dmhub-rail-lbl { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px; }
  .dmhub-rail-icon-wrap { position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px; }
  .dmhub-rail-badge {
    position:absolute;top:-6px;right:-10px;
    min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;
    border-radius:8px;background:#ef4444;color:#fff;
    font-size:9px;font-weight:800;line-height:1;
    display:flex;align-items:center;justify-content:center;
    border:1.5px solid rgba(4,4,4,.99);
    animation:badgePop .3s cubic-bezier(.34,1.56,.64,1) both;
    white-space:nowrap;
  }
  @keyframes badgePop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  .dmhub-rail-spacer { flex:1; }
  .dmhub-rail-close { color:#333; }
  .dmhub-rail-close:hover { color:#84cc16;background:rgba(132,204,22,.07)!important; }

  /* ── Body ── */
  .dmhub-body { flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;position:relative; }
  .dmhub-body-full { flex:1; }
  .dmhub-fullscreen { position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;overflow:hidden; }
  .dmhub-list-wrap { display:flex;flex-direction:column;height:100%;overflow:hidden; }
  .dmhub-tab-body { flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0; }

  /* ── Header — [FIX-PAD] 16px left/right padding, proper alignment ── */
  .dmhub-hdr {
    display:flex;
    align-items:center;
    padding:calc(env(safe-area-inset-top,0px)+12px) 16px 12px;
    border-bottom:1px solid rgba(132,204,22,.1);
    background:rgba(0,0,0,.98);
    flex-shrink:0;
    gap:10px;
    min-height:56px;
  }
  .dmhub-hdr-close {
    width:36px;height:36px;border-radius:10px;
    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
    display:flex;align-items:center;justify-content:center;
    color:#84cc16;cursor:pointer;flex-shrink:0;
    transition:background .15s;
  }
  .dmhub-hdr-close:hover { background:rgba(132,204,22,.1); }
  /* [FIX-PAD] Title: flex:1 + min-width:0 so it never pushes right-side buttons off screen */
  .dmhub-hdr-title {
    flex:1;min-width:0;
    text-align:center;
    font-size:17px;font-weight:800;color:#fff;letter-spacing:-.3px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .dmhub-hdr-right { display:flex;align-items:center;gap:8px;flex-shrink:0; }
  .dmhub-hdr-btn {
    width:36px;height:36px;border-radius:10px;
    background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);
    display:flex;align-items:center;justify-content:center;
    color:#84cc16;cursor:pointer;transition:all .15s;
  }
  .dmhub-hdr-btn:hover { background:rgba(132,204,22,.2);transform:translateY(-1px); }
  .dmhub-btn-grp { background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.25);color:#60a5fa; }
  .dmhub-btn-grp:hover { background:rgba(96,165,250,.2)!important; }

  /* ── Group rows ── */
  .dmhub-groups-section { border-bottom:1px solid rgba(255,255,255,.04);padding:4px 0; }
  .dmhub-group-row { display:flex;align-items:center;gap:14px;padding:11px 16px;cursor:pointer;transition:background .15s; }
  .dmhub-group-row:hover { background:rgba(255,255,255,.03); }
  .dmhub-group-av { width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0d1a00,#1a3300);border:2px solid rgba(132,204,22,.2);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0; }
  .dmhub-group-info { flex:1;min-width:0; }
  .dmhub-group-name { font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .dmhub-group-sub { font-size:12px;color:#555;margin-top:2px; }

  /* ── Mobile bottom nav ── */
  .dmhub-bnav { display:flex;border-top:1px solid rgba(132,204,22,.1);background:rgba(4,4,4,.99);padding-bottom:env(safe-area-inset-bottom,0px);flex-shrink:0; }
  .dmhub-bnav-btn { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 6px;background:transparent;border:none;color:#444;cursor:pointer;transition:color .15s;position:relative; }
  .dmhub-bnav-active { color:#84cc16; }
  .dmhub-bnav-active::after { content:'';position:absolute;top:0;left:20%;right:20%;height:2.5px;border-radius:0 0 4px 4px;background:#84cc16; }
  .dmhub-bnav-icon-wrap { position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px; }
  .dmhub-bnav-badge {
    position:absolute;top:-6px;right:-12px;
    min-width:17px;height:17px;padding:0 4px;box-sizing:border-box;
    border-radius:9px;background:#ef4444;color:#fff;
    font-size:9px;font-weight:800;line-height:1;
    display:flex;align-items:center;justify-content:center;
    border:2px solid rgba(4,4,4,.99);
    animation:badgePop .3s cubic-bezier(.34,1.56,.64,1) both;
    white-space:nowrap;
  }
  .dmhub-bnav-lbl { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px; }

  /* ── Create Group Modal ── */
  .cgm-ov { position:fixed;inset:0;z-index:20002;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;backdrop-filter:blur(4px); }
  .cgm-modal { width:100%;max-height:88vh;background:#080808;border:1px solid rgba(132,204,22,.15);border-radius:24px 24px 0 0;overflow:hidden;display:flex;flex-direction:column;animation:cgmUp .3s cubic-bezier(.34,1.4,.64,1); }
  @keyframes cgmUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  .cgm-pill { width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:12px auto 0;flex-shrink:0; }
  .cgm-hd { display:flex;align-items:center;justify-content:space-between;padding:14px 20px 12px;flex-shrink:0; }
  .cgm-title { font-size:16px;font-weight:800;color:#fff; }
  .cgm-cancel { background:none;border:none;color:#84cc16;font-size:13px;font-weight:700;cursor:pointer; }
  .cgm-next { padding:7px 16px;border-radius:12px;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:13px;font-weight:700;cursor:pointer; }
  .cgm-next:disabled { opacity:.35;cursor:not-allowed; }
  .cgm-create { background:rgba(132,204,22,.2);border-color:rgba(132,204,22,.5); }
  .cgm-body { display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px; }
  .cgm-icon-wrap { width:80px;height:80px;border-radius:50%;background:rgba(132,204,22,.1);border:2px solid rgba(132,204,22,.25);display:flex;align-items:center;justify-content:center;font-size:40px; }
  .cgm-inp { width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:#fff;font-size:16px;padding:14px 16px;outline:none;caret-color:#84cc16;text-align:center;font-weight:600;box-sizing:border-box; }
  .cgm-inp:focus { border-color:rgba(132,204,22,.35); }
  .cgm-inp::placeholder { color:#333; }
  .cgm-hint { font-size:12px;color:#444;text-align:center;margin:0; }
  .cgm-chips { display:flex;gap:8px;flex-wrap:wrap;padding:4px 20px 8px;flex-shrink:0; }
  .cgm-chip { display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:20px;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.3);color:#84cc16;font-size:12px;font-weight:600;cursor:pointer; }
  .cgm-sw { padding:0 20px 8px;flex-shrink:0; }
  .cgm-search { width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#fff;font-size:14px;padding:10px 14px;outline:none;box-sizing:border-box; }
  .cgm-search::placeholder { color:#333; }
  .cgm-list { flex:1;overflow-y:auto;padding:4px 0 16px; }
  .cgm-row { display:flex;align-items:center;gap:12px;padding:10px 20px;cursor:pointer;transition:background .15s; }
  .cgm-row:hover { background:rgba(255,255,255,.03); }
  .cgm-on { background:rgba(132,204,22,.06); }
  .cgm-uav { border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0d0d0d,#1c1c1c);border:1.5px solid rgba(132,204,22,.2); }
  .cgm-rn { flex:1;font-size:14px;font-weight:600;color:#fff; }
  .cgm-ck { width:24px;height:24px;border-radius:50%;border:1.5px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:12px;color:transparent;flex-shrink:0; }
  .cgm-ck-on { background:#84cc16;border-color:#84cc16;color:#000;font-weight:800; }
  .cgm-empty { text-align:center;padding:24px;color:#444;font-size:13px; }

  /* ── Desktop ── */
  @media (min-width:769px) {
    .dmhub-panel { left:auto;right:0;width:420px;height:100vh;border-left:1px solid rgba(132,204,22,.12);box-shadow:-24px 0 72px rgba(0,0,0,.7);animation:dmSlide .28s cubic-bezier(.22,1,.36,1); }
    @keyframes dmSlide { from{transform:translateX(100%)} to{transform:translateX(0)} }
    .dmhub-rail { display:flex; }
    .dmhub-bnav { display:none!important; }
    .dmhub-fullscreen { position:absolute;inset:0; }
    /* On desktop the rail handles close, so hide the in-header close btn */
    .dmhub-hdr-close { display:none; }
    /* On desktop with no close btn, left-align the title */
    .dmhub-hdr-title { text-align:left; }
    .dmhub-hdr { padding-left:16px; }
  }
`;

export default DMMessagesView;