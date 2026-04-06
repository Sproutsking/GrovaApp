// components/Messages/CallsView.jsx
// ============================================================================
// GROVA CALLS — PRODUCTION v7
// ============================================================================
// v7 changes:
//   • Removed "New Call" quick-launch button — the "+" in the panel header
//     handles new calls. The 3 buttons (Voice · Video · Group) now fill the
//     full width evenly, giving a cleaner, less cluttered layout.
//   • Voice and Video buttons open NewCallModal (contact search).
//   • Group button opens GroupPicker.
//   • Listens for `dm:openNewCall` custom event so the "+" header button
//     in DMMessagesView can trigger the modal from outside.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../services/config/supabase";
import onlineStatusService from "../../services/messages/onlineStatusService";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── ICONS ─── */
const Ic = {
  Phone:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Video:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Users:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Incoming:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 19 19 12"/></svg>,
  Outgoing:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/></svg>,
  Missed:    () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 19 19 12"/></svg>,
  Close:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:     () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  ChevRight: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevDown:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Back:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Search:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

/* ─── QUALITY PRESETS ─── */
const QUALITY_PRESETS = [
  { id: "whisper", label: "Whisper", icon: "🍃", color: "#22c55e", est: "~45 KB/min",  badge: "95% less data" },
  { id: "crystal", label: "Crystal", icon: "💎", color: "#84cc16", est: "~180 KB/min", badge: "Best voice"    },
  { id: "vision",  label: "Vision",  icon: "👁️",  color: "#60a5fa", est: "~1.4 MB/min", badge: "Smart video"  },
  { id: "vivid",   label: "Vivid",   icon: "✨",  color: "#c084fc", est: "~3.2 MB/min", badge: "Pro quality"  },
];

/* ─── HELPERS ─── */
const fmtDuration = (secs) => {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  const now  = new Date();
  const diff = now - date;
  if (diff < 86400000)  return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diff < 172800000) return `Yesterday, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

const getInitial = (name) => (name || "?").charAt(0).toUpperCase();

/* ─── AVATAR ─── */
const Avatar = ({ user, size = 44, online = false, ringColor = null }) => {
  const url = user?.avatar_id ? mediaUrlService.getAvatarUrl(user.avatar_id, 200) : null;
  const dotSize = Math.max(10, Math.round(size * 0.26));
  return (
    <div className="cv-av-wrap" style={{ width: size, height: size, flexShrink: 0, position: "relative", display: "inline-flex" }}>
      <div className="cv-av" style={{ width: size, height: size, fontSize: size * 0.38, borderColor: ringColor || undefined }}>
        {url
          ? <img src={url} alt={user?.full_name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          : getInitial(user?.full_name)
        }
      </div>
      <span
        className={`cv-online-dot${online ? " cv-online-dot--on" : ""}`}
        style={{ width: dotSize, height: dotSize, bottom: Math.round(dotSize * 0.05), right: Math.round(dotSize * 0.05), borderWidth: Math.max(2, Math.round(dotSize * 0.22)) }}
      />
    </div>
  );
};

/* ─── CALL TYPE CHOOSER ─── */
const CallTypeChooser = ({ target, onChoose, onClose }) => {
  const types = [
    { id: "audio", icon: "🎙️", label: "Voice Call",      desc: "Crystal-clear · starts in Crystal mode", color: "#84cc16" },
    { id: "video", icon: "📹", label: "Video Call",       desc: "Smart video · VP9 adaptive · low data",  color: "#60a5fa" },
    { id: "group", icon: "👥", label: "Start Group Call", desc: "Add more people · audio or video",        color: "#c084fc" },
  ];
  return (
    <div className="chooser-overlay" onClick={onClose}>
      <div className="chooser-sheet" onClick={e => e.stopPropagation()}>
        <div className="chooser-drag" />
        <div className="chooser-head">
          <div className="chooser-target-row">
            <Avatar user={target} size={42} online={target?._online} />
            <div>
              <div className="chooser-target-name">{target?.full_name || "Unknown"}</div>
              <div className="chooser-target-sub">Select call type</div>
            </div>
          </div>
          <button className="chooser-close" onClick={onClose}><Ic.Close /></button>
        </div>
        <div className="chooser-types">
          {types.map(t => (
            <button key={t.id} className="ct-btn" onClick={() => onChoose(t.id)}>
              <span className="ct-icon">{t.icon}</span>
              <div className="ct-info">
                <span className="ct-label" style={{ color: t.color }}>{t.label}</span>
                <span className="ct-desc">{t.desc}</span>
              </div>
              <Ic.ChevRight />
            </button>
          ))}
        </div>
        <div className="chooser-data-row">
          <span className="chooser-data-label">⚡ Up to 95% less data than WhatsApp, Instagram & Facebook</span>
          <div className="chooser-data-pills">
            {QUALITY_PRESETS.map(p => (
              <span key={p.id} className="chooser-data-pill" style={{ borderColor: p.color + "44", color: p.color }}>
                {p.icon} {p.est}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── NEW CALL MODAL ─── */
const NewCallModal = ({ contacts, onCall, onClose }) => {
  const [query,    setQuery]    = useState("");
  const [searching, setSearching] = useState(false);
  const [results,  setResults]  = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults(contacts); return; }
    const q = query.toLowerCase();
    setResults(contacts.filter(c =>
      (c.full_name || "").toLowerCase().includes(q) || (c.username || "").toLowerCase().includes(q)
    ));
  }, [query, contacts]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_id, verified")
          .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
          .limit(20);
        if (data) {
          const localIds = new Set(contacts.map(c => c.id));
          const extras = (data || []).filter(u => !localIds.has(u.id));
          setResults(prev => {
            const existing = prev.filter(c => contacts.some(lc => lc.id === c.id));
            return [...existing, ...extras];
          });
        }
      } catch (_) {}
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, contacts]);

  return (
    <div className="chooser-overlay" onClick={onClose}>
      <div className="chooser-sheet chooser-sheet-tall" onClick={e => e.stopPropagation()}>
        <div className="chooser-drag" />
        <div className="chooser-head">
          <h3 className="chooser-target-name" style={{ flex: 1, textAlign: "center" }}>New Call</h3>
          <button className="chooser-close" onClick={onClose}><Ic.Close /></button>
        </div>
        <div className="nc-search">
          <Ic.Search />
          <input
            ref={inputRef}
            className="nc-search-input"
            placeholder="Search by name or username…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searching && <div className="nc-search-spin" />}
          {query && !searching && (
            <button className="nc-search-clear" onClick={() => setQuery("")}><Ic.Close /></button>
          )}
        </div>
        <div className="nc-list">
          {results.length === 0 && (
            <div className="cv-empty">
              <div className="cv-empty-icon">🔍</div>
              <p>{query ? "No users found" : "No contacts yet"}</p>
              <span>{query ? "Try a different name" : "Start messaging someone first"}</span>
            </div>
          )}
          {results.map(user => (
            <div key={user.id} className="nc-user-row" onClick={() => onCall(user)}>
              <Avatar user={user} size={46} online={user._online} />
              <div className="nc-user-info">
                <span className="nc-user-name">{user.full_name}</span>
                <span className="nc-user-sub">
                  {user._online ? <><span className="nc-online-dot" />Online</> : `@${user.username}`}
                </span>
              </div>
              <div className="nc-user-actions" onClick={e => e.stopPropagation()}>
                <button className="nc-call-btn nc-voice" title="Voice call" onClick={() => onCall(user, "audio")}><Ic.Phone /></button>
                <button className="nc-call-btn nc-video" title="Video call" onClick={() => onCall(user, "video")}><Ic.Video /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── GROUP PICKER ─── */
const GroupPicker = ({ contacts, onStart, onBack }) => {
  const [selected, setSelected] = useState([]);
  const [query,    setQuery]    = useState("");
  const MAX = 7;

  const toggle = id => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX ? prev : [...prev, id]
  );

  const filtered = contacts.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (c.full_name || "").toLowerCase().includes(q) || (c.username || "").toLowerCase().includes(q);
  });

  const selectedContacts = contacts.filter(c => selected.includes(c.id));

  const buildInfo = (type) => ({
    name: selectedContacts.length === 1
      ? selectedContacts[0]?.full_name || "Group"
      : `Group · ${selectedContacts.length + 1} people`,
    initial: "G", type, outgoing: true,
    participants: selectedContacts.map(c => ({ id: c.id, name: c.full_name, initial: getInitial(c.full_name), muted: false })),
  });

  return (
    <div className="chooser-overlay" onClick={onBack}>
      <div className="chooser-sheet chooser-sheet-tall" onClick={e => e.stopPropagation()}>
        <div className="chooser-drag" />
        <div className="chooser-head">
          <button className="chooser-back" onClick={onBack}><Ic.Back /></button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div className="chooser-target-name">Add Participants</div>
            <div className="chooser-target-sub">{selected.length}/{MAX} selected</div>
          </div>
          <div style={{ width: 34 }} />
        </div>
        <div className="nc-search" style={{ margin: "8px 16px" }}>
          <Ic.Search />
          <input className="nc-search-input" placeholder="Search contacts…" value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button className="nc-search-clear" onClick={() => setQuery("")}><Ic.Close /></button>}
        </div>
        {selected.length > 0 && (
          <div className="gp-chips">
            {selectedContacts.map(c => (
              <div key={c.id} className="gp-chip" onClick={() => toggle(c.id)}>
                <span className="gp-chip-av">{getInitial(c.full_name)}</span>
                <span>{(c.full_name || "").split(" ")[0]}</span>
                <span className="gp-chip-x">×</span>
              </div>
            ))}
          </div>
        )}
        <div className="gp-list">
          {filtered.length === 0 && <div className="cv-empty-small">No contacts found</div>}
          {filtered.map(c => {
            const sel = selected.includes(c.id);
            return (
              <div key={c.id} className={`gp-row${sel ? " gp-sel" : ""}`} onClick={() => toggle(c.id)}>
                <Avatar user={c} size={42} online={c._online} />
                <div className="gp-info">
                  <span className="gp-name">{c.full_name}</span>
                  <span className="gp-status">{c._online ? "Online" : `@${c.username || ""}`}</span>
                </div>
                <div className={`gp-check${sel ? " gp-check-on" : ""}`}>{sel && <Ic.Check />}</div>
              </div>
            );
          })}
          {contacts.length === 0 && <div className="cv-empty-small">Start a conversation first to add participants</div>}
        </div>
        {selected.length > 0 && (
          <div className="gp-actions">
            <button className="gp-start gp-audio" onClick={() => onStart(buildInfo("group"))}><Ic.Phone /> Group Voice</button>
            <button className="gp-start gp-video" onClick={() => onStart(buildInfo("group-video"))}><Ic.Video /> Group Video</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── DATA INFO PANEL ─── */
const DataInfoPanel = () => (
  <div className="cv-data-panel">
    <div className="cv-data-panel-title">Audio call data comparison</div>
    <div className="cv-compare-list">
      {[
        { name: "Our Whisper",  val: "45 KB/min",  pct: "5%",   color: "#22c55e" },
        { name: "Telegram",     val: "~350 KB/min", pct: "25%",  color: "#60a5fa" },
        { name: "WhatsApp",     val: "~780 KB/min", pct: "55%",  color: "#f59e0b" },
        { name: "Instagram",    val: "~1.4 MB/min", pct: "100%", color: "#ef4444" },
      ].map(r => (
        <div key={r.name} className="cv-compare-row">
          <span className="cv-compare-name">{r.name}</span>
          <div className="cv-compare-bar-wrap"><div className="cv-compare-bar" style={{ width: r.pct, background: r.color }} /></div>
          <span className="cv-compare-val" style={{ color: r.color }}>{r.val}</span>
        </div>
      ))}
    </div>
    <div className="cv-tech-tags">
      {["Opus DTX", "VP9 SVC", "RED+FEC", "DSCP QoS", "GCC BWE"].map(b => (
        <span key={b} className="cv-tech-tag">{b}</span>
      ))}
    </div>
  </div>
);

/* ─── CALLS VIEW ─── */
const CallsView = ({ onStartCall, currentUser }) => {
  const [callLog,         setCallLog]         = useState([]);
  const [contacts,        setContacts]        = useState([]);
  const [statusMap,       setStatusMap]       = useState(new Map());
  const [loadingLog,      setLoadingLog]      = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [chooserTarget,   setChooserTarget]   = useState(null);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showNewCall,     setShowNewCall]     = useState(false);
  const [showDataInfo,    setShowDataInfo]    = useState(false);
  const [tableError,      setTableError]      = useState(false);
  const mounted = useRef(true);

  /* ── Listen for header "+" button trigger ── */
  useEffect(() => {
    const handler = () => setShowNewCall(true);
    document.addEventListener("dm:openNewCall", handler);
    return () => document.removeEventListener("dm:openNewCall", handler);
  }, []);

  /* ── Contacts ── */
  useEffect(() => {
    if (!currentUser?.id) return;
    mounted.current = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("conversations")
          .select(`
            id,
            user1:profiles!conversations_user1_id_fkey(id, full_name, username, avatar_id, verified),
            user2:profiles!conversations_user2_id_fkey(id, full_name, username, avatar_id, verified)
          `)
          .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
          .order("last_message_at", { ascending: false });
        if (error) throw error;
        const seen = new Set();
        const people = [];
        (data || []).forEach(conv => {
          const other = conv.user1?.id === currentUser.id ? conv.user2 : conv.user1;
          if (other?.id && !seen.has(other.id)) { seen.add(other.id); people.push(other); }
        });
        if (!mounted.current) return;
        setContacts(people);
        setLoadingContacts(false);
        if (people.length > 0) {
          try {
            const statusResults = await onlineStatusService.fetchStatuses?.(people.map(p => p.id)) || new Map();
            if (mounted.current) setStatusMap(statusResults);
          } catch (_) {}
        }
      } catch (err) {
        console.error("[CallsView] contacts:", err);
        if (mounted.current) setLoadingContacts(false);
      }
    })();
    const unsub = onlineStatusService.subscribe?.((uid, st) => {
      if (!mounted.current) return;
      setStatusMap(prev => { const n = new Map(prev); n.set(uid, st); return n; });
    });
    return () => { mounted.current = false; unsub?.(); };
  }, [currentUser?.id]);

  /* ── Call log ── */
  useEffect(() => {
    if (!currentUser?.id) return;
    mounted.current = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("call_logs")
          .select(`
            id, type, status, duration_secs, quality, created_at,
            caller:profiles!call_logs_caller_id_fkey(id, full_name, username, avatar_id, verified),
            callee:profiles!call_logs_callee_id_fkey(id, full_name, username, avatar_id, verified)
          `)
          .or(`caller_id.eq.${currentUser.id},callee_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false })
          .limit(60);
        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) setTableError(true);
          else throw error;
        } else {
          if (mounted.current) setCallLog(data || []);
        }
      } catch (err) {
        console.error("[CallsView] call log:", err);
      } finally {
        if (mounted.current) setLoadingLog(false);
      }
    })();
  }, [currentUser?.id]);

  /* ── Log call ── */
  const logCall = useCallback(async (calleeId, type, status) => {
    if (!currentUser?.id || !calleeId || tableError) return;
    try {
      const { data, error } = await supabase.from("call_logs").insert({
        caller_id: currentUser.id, callee_id: calleeId, type, status, duration_secs: 0,
      }).select().single();
      if (!error && data && mounted.current) {
        setCallLog(prev => [data, ...prev].slice(0, 60));
      }
    } catch (err) { console.warn("[CallsView] logCall:", err); }
  }, [currentUser?.id, tableError]);

  /* ── Start call ── */
  const startCall = useCallback((user, type = null) => {
    if (!type) {
      setChooserTarget({ ...user, _online: statusMap.get(user.id)?.online || false });
      setShowNewCall(false);
      return;
    }
    setChooserTarget(null);
    setShowNewCall(false);
    onStartCall({ name: user.full_name || "Unknown", initial: getInitial(user.full_name), type, outgoing: true, calleeId: user.id, user });
    if (user.id) logCall(user.id, type, "answered");
  }, [statusMap, onStartCall, logCall]);

  const handleTypeChosen = useCallback((type) => {
    if (type === "group") { setChooserTarget(null); setShowGroupPicker(true); return; }
    if (chooserTarget) startCall(chooserTarget, type);
  }, [chooserTarget, startCall]);

  const handleGroupStart = useCallback((info) => {
    setShowGroupPicker(false);
    onStartCall(info);
  }, [onStartCall]);

  const enriched = contacts.map(c => ({ ...c, _online: statusMap.get(c.id)?.online || false }));

  return (
    <div className="cv-root">

      {/* ── QUICK LAUNCH — 3 equal buttons, no "New Call" clutter ── */}
      <div className="cv-quick">
        <button className="cv-qbtn cv-qbtn-voice" onClick={() => setShowNewCall(true)}>
          <Ic.Phone /><span>Voice</span>
        </button>
        <button className="cv-qbtn cv-qbtn-video" onClick={() => setShowNewCall(true)}>
          <Ic.Video /><span>Video</span>
        </button>
        <button className="cv-qbtn cv-qbtn-group" onClick={() => setShowGroupPicker(true)}>
          <Ic.Users /><span>Group</span>
        </button>
      </div>

      {/* ── DATA BANNER ── */}
      <button className="cv-data-banner" onClick={() => setShowDataInfo(p => !p)}>
        <div className="cv-data-banner-left">
          <span className="cv-data-banner-icon">⚡</span>
          <div>
            <div className="cv-data-banner-title">Data-Efficient Calls</div>
            <div className="cv-data-banner-sub">Up to 95% less data than competitors</div>
          </div>
        </div>
        <div className="cv-data-banner-arrow" style={{ transform: showDataInfo ? "rotate(180deg)" : "none" }}>
          <Ic.ChevDown />
        </div>
      </button>
      {showDataInfo && <DataInfoPanel />}

      {/* ── CONTACTS STRIP ── */}
      {!loadingContacts && enriched.length > 0 && (
        <>
          <div className="cv-section-label">Contacts</div>
          <div className="cv-contacts-scroll">
            {enriched.map(c => (
              <div key={c.id} className="cv-contact-item" onClick={() => startCall(c)}>
                <Avatar user={c} size={50} online={c._online} />
                <span className="cv-contact-name">{(c.full_name || "").split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── RECENT CALLS ── */}
      <div className="cv-section-label">
        Recent
        {tableError && <span className="cv-section-hint"> · Run setup.sql to track history</span>}
      </div>

      {loadingLog && (
        <div className="cv-skeletons">
          {[0,1,2,3].map(i => <div key={i} className="cv-skel" style={{ animationDelay: `${i*0.1}s` }} />)}
        </div>
      )}

      {!loadingLog && (tableError || callLog.length === 0) && (
        <div className="cv-empty">
          <div className="cv-empty-icon">📞</div>
          <p>{tableError ? "Call history coming soon" : "No calls yet"}</p>
          <span>{tableError ? "Your log will appear once set up" : "Start a call from contacts above"}</span>
          <button className="cv-new-call-cta" onClick={() => setShowNewCall(true)}>
            Start a Call
          </button>
        </div>
      )}

      {!loadingLog && !tableError && callLog.map(call => {
        const isOut  = call.caller?.id === currentUser?.id;
        const other  = isOut ? call.callee : call.caller;
        const preset = QUALITY_PRESETS.find(p => p.id === call.quality);
        const online = statusMap.get(other?.id)?.online || false;
        return (
          <div key={call.id} className="cv-call-row">
            <Avatar user={other} size={46} online={online} />
            <div className="cv-call-body">
              <div className="cv-call-top">
                <span className={`cv-call-name${call.status === "missed" ? " cv-missed" : ""}`}>{other?.full_name || "Unknown"}</span>
                {preset && (
                  <span className="cv-quality-pill" style={{ color: preset.color, borderColor: preset.color + "44" }}>
                    {preset.icon} {preset.label}
                  </span>
                )}
              </div>
              <div className="cv-call-meta">
                {call.status === "missed" ? <Ic.Missed /> : isOut ? <Ic.Outgoing /> : <Ic.Incoming />}
                <span>{call.status === "missed" ? "Missed · " : isOut ? "Outgoing · " : "Incoming · "}{fmtTime(call.created_at)}</span>
                {fmtDuration(call.duration_secs) && <span>· {fmtDuration(call.duration_secs)}</span>}
                {call.type === "video" && <span>· 📹</span>}
                {(call.type === "group" || call.type === "group-video") && <span>· 👥</span>}
              </div>
            </div>
            <div className="cv-call-btns">
              <button className="cv-call-btn cv-btn-voice" title="Voice call" onClick={() => other && startCall(other, "audio")}><Ic.Phone /></button>
              <button className="cv-call-btn cv-btn-video-sm" title="Video call" onClick={() => other && startCall(other, "video")}><Ic.Video /></button>
            </div>
          </div>
        );
      })}

      {/* ── MODALS ── */}
      {showNewCall && (
        <NewCallModal
          contacts={enriched}
          onCall={(user, type) => { if (type) startCall(user, type); else startCall(user); }}
          onClose={() => setShowNewCall(false)}
        />
      )}
      {chooserTarget && (
        <CallTypeChooser target={chooserTarget} onChoose={handleTypeChosen} onClose={() => setChooserTarget(null)} />
      )}
      {showGroupPicker && (
        <GroupPicker contacts={enriched} onStart={handleGroupStart} onBack={() => setShowGroupPicker(false)} />
      )}

      <style>{cvStyles}</style>
    </div>
  );
};

/* ─── STYLES ─── */
const cvStyles = `
  .cv-root { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; background: #000; padding-bottom: 20px; }
  .cv-root::-webkit-scrollbar { width: 3px; }
  .cv-root::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.15); border-radius: 2px; }

  .cv-av-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
  .cv-av { border-radius: 50%; background: linear-gradient(135deg, #141414, #1e1e1e); border: 2.5px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #84cc16; overflow: hidden; box-sizing: border-box; }
  .cv-online-dot { position: absolute; bottom: 0; right: 0; border-radius: 50%; border-style: solid; border-color: #000; background: #333; box-sizing: border-box; pointer-events: none; transition: background 0.3s; z-index: 2; }
  .cv-online-dot--on { background: #22c55e; }

  /* Quick launch — 3 equal buttons, full width */
  .cv-quick { display: flex; gap: 8px; padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .cv-qbtn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 13px 4px; border-radius: 14px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; border: 1px solid; }
  .cv-qbtn-voice { background: rgba(132,204,22,0.09); border-color: rgba(132,204,22,0.25); color: #84cc16; }
  .cv-qbtn-voice:hover { background: rgba(132,204,22,0.17); }
  .cv-qbtn-video { background: rgba(96,165,250,0.09); border-color: rgba(96,165,250,0.25); color: #60a5fa; }
  .cv-qbtn-video:hover { background: rgba(96,165,250,0.17); }
  .cv-qbtn-group { background: rgba(192,132,252,0.09); border-color: rgba(192,132,252,0.25); color: #c084fc; }
  .cv-qbtn-group:hover { background: rgba(192,132,252,0.17); }

  .cv-data-banner { display: flex; align-items: center; justify-content: space-between; margin: 10px 16px; padding: 13px 14px; background: rgba(132,204,22,0.04); border: 1px solid rgba(132,204,22,0.14); border-radius: 16px; cursor: pointer; text-align: left; width: calc(100% - 32px); transition: background 0.15s; }
  .cv-data-banner:hover { background: rgba(132,204,22,0.08); }
  .cv-data-banner-left { display: flex; align-items: center; gap: 10px; }
  .cv-data-banner-icon { font-size: 22px; }
  .cv-data-banner-title { font-size: 13px; font-weight: 700; color: #84cc16; }
  .cv-data-banner-sub { font-size: 11px; color: #555; margin-top: 1px; }
  .cv-data-banner-arrow { color: #84cc16; transition: transform 0.2s; flex-shrink: 0; }

  .cv-data-panel { margin: 0 16px 10px; padding: 13px; background: rgba(0,0,0,0.5); border: 1px solid rgba(132,204,22,0.1); border-top: none; border-radius: 0 0 16px 16px; animation: cvPanelIn 0.18s ease-out; }
  @keyframes cvPanelIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .cv-data-panel-title { font-size: 10px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 10px; }
  .cv-compare-list { display: flex; flex-direction: column; gap: 8px; }
  .cv-compare-row { display: flex; align-items: center; gap: 8px; }
  .cv-compare-name { font-size: 11px; color: #555; width: 100px; flex-shrink: 0; }
  .cv-compare-bar-wrap { flex: 1; height: 5px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; }
  .cv-compare-bar { height: 100%; border-radius: 3px; }
  .cv-compare-val { font-size: 11px; font-weight: 700; width: 76px; text-align: right; flex-shrink: 0; }
  .cv-tech-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .cv-tech-tag { padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; background: rgba(132,204,22,0.08); border: 1px solid rgba(132,204,22,0.2); color: #84cc16; }

  .cv-contacts-scroll { display: flex; gap: 16px; padding: 10px 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .cv-contacts-scroll::-webkit-scrollbar { display: none; }
  .cv-contact-item { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; flex-shrink: 0; transition: transform 0.15s; }
  .cv-contact-item:hover { transform: translateY(-1px); }
  .cv-contact-item:active { transform: scale(0.94); }
  .cv-contact-name { font-size: 10px; color: #777; max-width: 56px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .cv-section-label { padding: 10px 16px 4px; font-size: 10px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.7px; }
  .cv-section-hint { font-size: 9px; color: #222; text-transform: none; letter-spacing: 0; }

  .cv-skeletons { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
  .cv-skel { height: 62px; border-radius: 12px; background: rgba(255,255,255,0.03); animation: cvSkelPulse 1.4s ease-in-out infinite; }
  @keyframes cvSkelPulse { 0%,100%{opacity:.5} 50%{opacity:.15} }

  .cv-empty { display: flex; flex-direction: column; align-items: center; padding: 44px 20px; gap: 9px; text-align: center; }
  .cv-empty-icon { font-size: 40px; }
  .cv-empty p { margin: 0; font-size: 14px; font-weight: 700; color: #555; }
  .cv-empty span { font-size: 12px; color: #333; }
  .cv-empty-small { padding: 20px; text-align: center; font-size: 13px; color: #444; }
  .cv-new-call-cta { display: flex; align-items: center; gap: 7px; margin-top: 8px; padding: 10px 20px; border-radius: 22px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.3); color: #84cc16; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
  .cv-new-call-cta:hover { background: rgba(132,204,22,0.18); }

  .cv-call-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.15s; }
  .cv-call-row:hover { background: rgba(255,255,255,0.02); }
  .cv-call-body { flex: 1; min-width: 0; }
  .cv-call-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
  .cv-call-name { font-size: 14px; font-weight: 700; color: #fff; }
  .cv-missed { color: #ef4444 !important; }
  .cv-quality-pill { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px; border: 1px solid; flex-shrink: 0; }
  .cv-call-meta { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #444; }
  .cv-call-btns { display: flex; gap: 8px; }
  .cv-call-btn { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
  .cv-btn-voice { background: rgba(132,204,22,0.07); border: 1px solid rgba(132,204,22,0.18); color: #84cc16; }
  .cv-btn-voice:hover { background: rgba(132,204,22,0.16); }
  .cv-btn-video-sm { background: rgba(96,165,250,0.07); border: 1px solid rgba(96,165,250,0.18); color: #60a5fa; }
  .cv-btn-video-sm:hover { background: rgba(96,165,250,0.16); }

  /* Chooser */
  .chooser-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.65); z-index: 50; display: flex; align-items: flex-end; animation: cvBackdropIn 0.2s ease; }
  @keyframes cvBackdropIn { from{opacity:0} to{opacity:1} }
  .chooser-sheet { background: #080808; border: 1px solid rgba(132,204,22,0.14); border-radius: 22px 22px 0 0; padding: 0 0 calc(env(safe-area-inset-bottom,0px) + 20px); width: 100%; animation: cvSheetUp 0.26s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes cvSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  .chooser-sheet-tall { max-height: 86vh; overflow: hidden; display: flex; flex-direction: column; }
  .chooser-drag { width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.12); margin: 12px auto 0; flex-shrink: 0; }
  .chooser-head { display: flex; align-items: center; gap: 12px; padding: 14px 20px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .chooser-target-row { display: flex; align-items: center; gap: 10px; flex: 1; }
  .chooser-target-name { font-size: 15px; font-weight: 800; color: #fff; }
  .chooser-target-sub { font-size: 12px; color: #444; margin-top: 1px; }
  .chooser-close, .chooser-back { width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: center; color: #555; cursor: pointer; flex-shrink: 0; }
  .chooser-types { padding: 10px 16px 4px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .ct-btn { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); color: #ccc; cursor: pointer; text-align: left; width: 100%; transition: all 0.15s; }
  .ct-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); transform: translateX(2px); }
  .ct-icon { font-size: 24px; flex-shrink: 0; }
  .ct-info { flex: 1; }
  .ct-label { display: block; font-size: 14px; font-weight: 700; }
  .ct-desc { display: block; font-size: 11px; color: #555; margin-top: 2px; }
  .chooser-data-row { margin: 8px 16px 4px; padding: 11px 13px; border-radius: 12px; background: rgba(132,204,22,0.04); border: 1px solid rgba(132,204,22,0.1); flex-shrink: 0; }
  .chooser-data-label { font-size: 11px; color: #555; display: block; margin-bottom: 8px; }
  .chooser-data-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .chooser-data-pill { padding: 3px 8px; border-radius: 8px; border: 1px solid; font-size: 10px; font-weight: 700; }

  /* New Call Modal */
  .nc-search { display: flex; align-items: center; gap: 8px; margin: 8px 16px; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; flex-shrink: 0; }
  .nc-search svg { color: #555; flex-shrink: 0; }
  .nc-search-input { flex: 1; background: transparent; border: none; color: #fff; font-size: 14px; outline: none; caret-color: #84cc16; }
  .nc-search-input::placeholder { color: #444; }
  .nc-search-clear { background: none; border: none; color: #555; cursor: pointer; display: flex; align-items: center; padding: 0; }
  .nc-search-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(132,204,22,0.2); border-top-color: #84cc16; animation: ncSpin 0.6s linear infinite; flex-shrink: 0; }
  @keyframes ncSpin { to { transform: rotate(360deg); } }
  .nc-list { flex: 1; overflow-y: auto; }
  .nc-list::-webkit-scrollbar { width: 3px; }
  .nc-list::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.15); }
  .nc-user-row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.15s; }
  .nc-user-row:hover { background: rgba(255,255,255,0.03); }
  .nc-user-info { flex: 1; min-width: 0; }
  .nc-user-name { display: block; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nc-user-sub { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #555; margin-top: 2px; }
  .nc-online-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block; }
  .nc-user-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .nc-call-btn { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; border: 1px solid; flex-shrink: 0; }
  .nc-voice { background: rgba(132,204,22,0.08); border-color: rgba(132,204,22,0.2); color: #84cc16; }
  .nc-voice:hover { background: rgba(132,204,22,0.18); }
  .nc-video { background: rgba(96,165,250,0.08); border-color: rgba(96,165,250,0.2); color: #60a5fa; }
  .nc-video:hover { background: rgba(96,165,250,0.18); }

  /* Group Picker */
  .gp-chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
  .gp-chip { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 20px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.25); cursor: pointer; font-size: 12px; font-weight: 600; color: #84cc16; }
  .gp-chip-av { width: 18px; height: 18px; border-radius: 50%; background: rgba(132,204,22,0.2); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; }
  .gp-chip-x { font-size: 14px; opacity: 0.6; }
  .gp-list { flex: 1; overflow-y: auto; }
  .gp-list::-webkit-scrollbar { width: 3px; }
  .gp-list::-webkit-scrollbar-thumb { background: rgba(132,204,22,0.15); }
  .gp-row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.15s; }
  .gp-row:hover { background: rgba(255,255,255,0.03); }
  .gp-sel { background: rgba(132,204,22,0.05); }
  .gp-info { flex: 1; }
  .gp-name { display: block; font-size: 14px; font-weight: 700; color: #fff; }
  .gp-status { display: block; font-size: 11px; color: #444; margin-top: 1px; }
  .gp-check { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: transparent; flex-shrink: 0; }
  .gp-check-on { background: #84cc16; border-color: #84cc16; color: #000; }
  .gp-actions { padding: 12px 16px calc(env(safe-area-inset-bottom,0px) + 12px); display: flex; gap: 10px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .gp-start { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
  .gp-audio { background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.3); color: #84cc16; }
  .gp-audio:hover { background: rgba(132,204,22,0.18); }
  .gp-video { background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3); color: #60a5fa; }
  .gp-video:hover { background: rgba(96,165,250,0.18); }
`;

export default CallsView;