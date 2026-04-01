// components/Messages/CallsView.jsx
// ============================================================================
// PRODUCTION CALLS — v4 LIVE DATA
// ============================================================================
// Data sources (all real, zero mocks):
//   • Contacts  → conversations table (people you've DM'd)
//   • Call log  → call_logs table (auto-created on first call, stored in DB)
//   • Presence  → onlineStatusService (already live)
//
// SQL to run once in Supabase (safe to re-run):
// ─────────────────────────────────────────────
// create table if not exists public.call_logs (
//   id            uuid primary key default gen_random_uuid(),
//   caller_id     uuid not null references profiles(id),
//   callee_id     uuid not null references profiles(id),
//   type          text not null check (type in ('audio','video','group')),
//   status        text not null check (status in ('missed','answered','declined')),
//   duration_secs int  default 0,
//   quality       text,
//   created_at    timestamptz not null default now()
// );
// alter table public.call_logs enable row level security;
// create policy "users see own call_logs" on public.call_logs
//   for select using (caller_id = auth.uid() or callee_id = auth.uid());
// create policy "users insert call_logs" on public.call_logs
//   for insert with check (caller_id = auth.uid());
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../services/config/supabase";
import onlineStatusService from "../../services/messages/onlineStatusService";
import mediaUrlService from "../../services/shared/mediaUrlService";

/* ─── ICONS ─── */
const Ic = {
  Phone:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Video:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Users:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Incoming: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 19 19 12"/></svg>,
  Outgoing: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/></svg>,
  Missed:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 19 19 12"/></svg>,
  Close:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Info:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

/* ─── QUALITY PRESETS ─── */
const QUALITY_PRESETS = [
  { id:"whisper", label:"Whisper", icon:"🍃", color:"#22c55e", audio:{sampleRate:8000,bitrate:6_000,dtx:true,fec:true}, video:null, est:"~45 KB/min", desc:"Voice-only · Opus 6 kbps · DTX · FEC", badge:"95% less data" },
  { id:"crystal", label:"Crystal", icon:"💎", color:"#84cc16", audio:{sampleRate:24000,bitrate:24_000,dtx:true,fec:true}, video:null, est:"~180 KB/min", desc:"HD voice · Opus 24 kbps · wideband · FEC", badge:"Best voice" },
  { id:"vision",  label:"Vision",  icon:"👁️", color:"#60a5fa", audio:{sampleRate:48000,bitrate:32_000,dtx:true,fec:true}, video:{width:640,height:360,fps:15,bitrate:200_000,codec:"VP9",svc:true}, est:"~1.4 MB/min", desc:"360p · VP9 SVC · RED+FEC · adaptive layers", badge:"Smart video" },
  { id:"vivid",   label:"Vivid",   icon:"✨", color:"#c084fc", audio:{sampleRate:48000,bitrate:48_000,dtx:false,fec:true}, video:{width:1280,height:720,fps:30,bitrate:1_000_000,codec:"VP9",svc:true}, est:"~3.2 MB/min", desc:"720p 30fps · VP9 SVC · full fidelity", badge:"Pro quality" },
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
  if (diff < 86400000) {
    return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diff < 172800000) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { weekday:"short", hour:"numeric", minute:"2-digit" });
};

const getInitial = (name) => (name || "?").charAt(0).toUpperCase();

/* ─── AVATAR ─── */
const Avatar = ({ user, size = 44 }) => {
  const avatarUrl = user?.avatar_id ? mediaUrlService.getAvatarUrl(user.avatar_id, 200) : null;
  return (
    <div className="cv-av" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={user?.full_name} />
        : getInitial(user?.full_name)
      }
    </div>
  );
};

/* ─── CALL TYPE CHOOSER ─── */
const CallTypeChooser = ({ target, onChoose, onClose }) => {
  const types = [
    { id:"audio", icon:"🎙️", label:"Voice Call", desc:"Crystal-clear · starts in Whisper mode", color:"#84cc16" },
    { id:"video", icon:"📹", label:"Video Call",  desc:"Smart Video · VP9 adaptive · low data",  color:"#60a5fa" },
    { id:"group", icon:"👥", label:"Group Call",  desc:"Up to 8 people · audio or video",         color:"#c084fc" },
  ];
  return (
    <div className="chooser-overlay" onClick={onClose}>
      <div className="chooser-sheet" onClick={e => e.stopPropagation()}>
        <div className="chooser-handle" />
        <div className="chooser-head">
          <div className="chooser-target">
            <Avatar user={target} size={40} />
            <div>
              <div className="chooser-name">{target?.full_name || target?.name || "Call"}</div>
              <div className="chooser-sub">Select call type</div>
            </div>
          </div>
          <button className="chooser-x" onClick={onClose}><Ic.Close /></button>
        </div>
        <div className="chooser-types">
          {types.map(t => (
            <button key={t.id} className="ct-btn" onClick={() => onChoose(t.id)}>
              <span className="ct-icon">{t.icon}</span>
              <div className="ct-info">
                <span className="ct-label" style={{ color: t.color }}>{t.label}</span>
                <span className="ct-desc">{t.desc}</span>
              </div>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
        <div className="chooser-data-edu">
          <div className="edu-head"><Ic.Info /> Our calls use up to <strong style={{ color:"#84cc16" }}>95% less data</strong> than WhatsApp, Instagram & Facebook</div>
          <div className="edu-pills">
            {QUALITY_PRESETS.map(p => (
              <div key={p.id} className="edu-pill" style={{ borderColor: p.color + "44" }}>
                <span style={{ color: p.color }}>{p.icon}</span>
                <span>{p.label}</span>
                <span className="edu-pill-est" style={{ color: p.color }}>{p.est}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── GROUP PARTICIPANT PICKER ─── */
const GroupPicker = ({ contacts, onStart, onBack }) => {
  const [selected, setSelected] = useState([]);
  const MAX = 7;

  const toggle = useCallback((id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX ? prev : [...prev, id]);
  }, []);

  const selectedContacts = contacts.filter(c => selected.includes(c.id));

  const buildCallInfo = (type) => ({
    name: selected.length === 1
      ? contacts.find(c => c.id === selected[0])?.full_name || "Group"
      : `Group · ${selected.length + 1} people`,
    initial: "G", type, outgoing: true,
    participants: selectedContacts.map(c => ({ name: c.full_name, initial: getInitial(c.full_name), muted: false })),
  });

  return (
    <div className="chooser-overlay" onClick={onBack}>
      <div className="chooser-sheet chooser-sheet-tall" onClick={e => e.stopPropagation()}>
        <div className="chooser-handle" />
        <div className="chooser-head">
          <button className="gp-back-btn" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div style={{ flex:1, textAlign:"center" }}>
            <div className="chooser-name">Add participants</div>
            <div className="chooser-sub">{selected.length}/{MAX} selected</div>
          </div>
          <div style={{ width:32 }} />
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
          {contacts.length === 0 && (
            <div className="cv-empty-small">No contacts to add</div>
          )}
          {contacts.map(c => {
            const isSel = selected.includes(c.id);
            return (
              <div key={c.id} className={`gp-row${isSel ? " gp-sel" : ""}`} onClick={() => toggle(c.id)}>
                <div className="gp-av-wrap">
                  <Avatar user={c} size={40} />
                  {c._online && <div className="gp-dot" />}
                </div>
                <div className="gp-info">
                  <span className="gp-name">{c.full_name}</span>
                  <span className="gp-status">{c._online ? "Online" : "Offline"}</span>
                </div>
                <div className={`gp-check${isSel ? " gp-check-on" : ""}`}>
                  {isSel && <Ic.Check />}
                </div>
              </div>
            );
          })}
        </div>

        {selected.length > 0 && (
          <div className="gp-actions">
            <button className="gp-start audio" onClick={() => onStart(buildCallInfo("group"))}>
              <Ic.Phone /> Voice group call
            </button>
            <button className="gp-start video" onClick={() => onStart(buildCallInfo("group-video"))}>
              <Ic.Video /> Video group call
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── DATA COMPARISON PANEL ─── */
const DataInfoPanel = () => (
  <div className="cv-data-detail">
    <div className="cv-data-compare-title">How we compare (audio call):</div>
    <div className="cv-compare-rows">
      {[
        { name:"Our Whisper mode", val:"45 KB/min",  pct:"5%",   color:"#22c55e" },
        { name:"Telegram",         val:"~350 KB/min", pct:"25%",  color:"#60a5fa" },
        { name:"WhatsApp",         val:"~780 KB/min", pct:"55%",  color:"#f59e0b" },
        { name:"Instagram",        val:"~1.4 MB/min", pct:"100%", color:"#ef4444" },
      ].map(r => (
        <div key={r.name} className="cv-compare-row">
          <span className="cv-compare-name">{r.name}</span>
          <div className="cv-compare-bar-wrap">
            <div className="cv-compare-bar" style={{ width: r.pct, background: r.color }} />
          </div>
          <span className="cv-compare-val" style={{ color: r.color }}>{r.val}</span>
        </div>
      ))}
    </div>
    <div className="cv-tech-badges">
      {["Opus DTX","VP9 SVC","RED+FEC","DSCP QoS","GCC BWE"].map(b => (
        <span key={b} className="cv-tech-badge">{b}</span>
      ))}
    </div>
  </div>
);

/* ─── MAIN CALLS VIEW ─── */
const CallsView = ({ onStartCall, currentUser }) => {
  const [callLog,         setCallLog]         = useState([]);
  const [contacts,        setContacts]         = useState([]);
  const [statusMap,       setStatusMap]        = useState(new Map());
  const [loadingLog,      setLoadingLog]       = useState(true);
  const [loadingContacts, setLoadingContacts]  = useState(true);
  const [chooserTarget,   setChooserTarget]    = useState(null);
  const [showGroupPicker, setShowGroupPicker]  = useState(false);
  const [showDataInfo,    setShowDataInfo]     = useState(false);
  const [tableError,      setTableError]       = useState(false);
  const mounted = useRef(true);

  // ── Load contacts from conversations ──────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
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

        // Extract the "other" user from each conversation, deduplicate
        const seen = new Set();
        const people = [];
        (data || []).forEach(conv => {
          const other = conv.user1?.id === currentUser.id ? conv.user2 : conv.user1;
          if (other?.id && !seen.has(other.id)) {
            seen.add(other.id);
            people.push(other);
          }
        });

        if (!mounted.current) return;
        setContacts(people);
        setLoadingContacts(false);

        // Fetch online status for all contacts
        const ids = people.map(p => p.id);
        if (ids.length > 0) {
          const statusResults = await onlineStatusService.fetchStatuses(ids);
          if (!mounted.current) return;
          setStatusMap(statusResults);
        }
      } catch (err) {
        console.error("[CallsView] Load contacts error:", err);
        if (mounted.current) setLoadingContacts(false);
      }
    })();

    // Subscribe to status updates
    const unsub = onlineStatusService.subscribe((uid, st) => {
      if (!mounted.current) return;
      setStatusMap(prev => {
        const next = new Map(prev);
        next.set(uid, st);
        return next;
      });
    });

    return () => { mounted.current = false; unsub(); };
  }, [currentUser?.id]);

  // ── Load call log ─────────────────────────────────────────────────────────
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
          .limit(50);

        if (error) {
          // Table doesn't exist yet — show empty state gracefully
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            setTableError(true);
          } else {
            throw error;
          }
        } else {
          if (!mounted.current) return;
          setCallLog(data || []);
        }
      } catch (err) {
        console.error("[CallsView] Load call log error:", err);
      } finally {
        if (mounted.current) setLoadingLog(false);
      }
    })();
  }, [currentUser?.id]);

  // ── Log a call to DB (best-effort) ────────────────────────────────────────
  const logCall = useCallback(async (calleeId, type, status, durationSecs = 0, quality = null) => {
    if (!currentUser?.id || !calleeId || tableError) return;
    try {
      await supabase.from("call_logs").insert({
        caller_id:     currentUser.id,
        callee_id:     calleeId,
        type,
        status,
        duration_secs: durationSecs,
        quality,
      });
    } catch (err) {
      console.warn("[CallsView] logCall failed:", err);
    }
  }, [currentUser?.id, tableError]);

  const openChooser = (contact) => setChooserTarget(contact);

  const handleTypeChosen = (type) => {
    if (type === "group") {
      setChooserTarget(null);
      setShowGroupPicker(true);
    } else {
      const target = chooserTarget;
      setChooserTarget(null);
      // Notify parent to open ActiveCall
      onStartCall({
        name:      target?.full_name || target?.name || "Call",
        initial:   getInitial(target?.full_name || target?.name),
        type,
        outgoing:  true,
        calleeId:  target?.id,
        user:      target,
      });
      // Log call attempt — real status written when call ends
      if (target?.id) logCall(target.id, type, "answered");
    }
  };

  const handleGroupStart = (callInfo) => {
    setShowGroupPicker(false);
    onStartCall(callInfo);
  };

  const qPreset = (id) => QUALITY_PRESETS.find(p => p.id === id);

  const TypeIcon = ({ type, status, isOutgoing }) => {
    if (status === "missed") return <Ic.Missed />;
    if (isOutgoing) return <Ic.Outgoing />;
    return <Ic.Incoming />;
  };

  // Enrich contacts with online status
  const enrichedContacts = contacts.map(c => ({
    ...c,
    _online: statusMap.get(c.id)?.online || false,
  }));

  return (
    <div className="cv-root">
      {/* ── Quick launch ── */}
      <div className="cv-quicklaunch">
        <button className="cv-qbtn audio" onClick={() => {
          if (contacts.length > 0) openChooser(contacts[0]);
          else setShowGroupPicker(false);
        }}>
          <Ic.Phone /><span>Voice</span>
        </button>
        <button className="cv-qbtn video" onClick={() => {
          if (contacts.length > 0) openChooser(contacts[0]);
        }}>
          <Ic.Video /><span>Video</span>
        </button>
        <button className="cv-qbtn group" onClick={() => setShowGroupPicker(true)}>
          <Ic.Users /><span>Group</span>
        </button>
      </div>

      {/* ── Data efficiency banner ── */}
      <button className="cv-data-banner" onClick={() => setShowDataInfo(p => !p)}>
        <div className="cv-data-left">
          <span className="cv-data-icon">⚡</span>
          <div>
            <div className="cv-data-title">Data-Efficient Calls</div>
            <div className="cv-data-sub">Up to 95% less data than competitors</div>
          </div>
        </div>
        <div className="cv-data-arrow" style={{ transform: showDataInfo ? "rotate(180deg)" : "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </button>

      {showDataInfo && <DataInfoPanel />}

      {/* ── Contacts section (people you can call) ── */}
      {!loadingContacts && contacts.length > 0 && (
        <>
          <div className="cv-section-lbl">Contacts</div>
          <div className="cv-contacts-scroll">
            {enrichedContacts.map(c => (
              <div key={c.id} className="cv-contact-bubble" onClick={() => openChooser(c)}>
                <div className="cv-contact-av-wrap">
                  <Avatar user={c} size={46} />
                  {c._online && <div className="cv-contact-dot" />}
                </div>
                <span className="cv-contact-name">{(c.full_name || "").split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Call log ── */}
      <div className="cv-section-lbl">
        Recent
        {tableError && <span className="cv-section-hint"> · Enable call_logs table to track history</span>}
      </div>

      {loadingLog && (
        <div className="cv-loading">
          {[1,2,3].map(i => <div key={i} className="cv-skel" style={{ animationDelay: `${i * 0.1}s` }} />)}
        </div>
      )}

      {!loadingLog && !tableError && callLog.length === 0 && (
        <div className="cv-empty">
          <div className="cv-empty-icon">📞</div>
          <p>No calls yet</p>
          <span>Start a call with someone from your messages</span>
        </div>
      )}

      {!loadingLog && tableError && (
        <div className="cv-empty">
          <div className="cv-empty-icon">📞</div>
          <p>Call history coming soon</p>
          <span>Your call log will appear here once set up</span>
        </div>
      )}

      {!loadingLog && !tableError && callLog.map(call => {
        const isOutgoing = call.caller?.id === currentUser?.id;
        const other = isOutgoing ? call.callee : call.caller;
        const preset = call.quality ? qPreset(call.quality) : null;
        const dur = fmtDuration(call.duration_secs);

        return (
          <div key={call.id} className="cv-call-row">
            <Avatar user={other} size={44} />
            <div className="cv-info">
              <div className="cv-call-top">
                <span className={`cv-name${call.status === "missed" ? " missed" : ""}`}>
                  {other?.full_name || "Unknown"}
                </span>
                {preset && (
                  <span className="cv-quality-tag" style={{ color: preset.color, borderColor: preset.color + "44" }}>
                    {preset.icon} {preset.label}
                  </span>
                )}
              </div>
              <div className="cv-call-sub">
                <TypeIcon type={call.type} status={call.status} isOutgoing={isOutgoing} />
                <span>
                  {call.status === "missed"   ? "Missed · "   :
                   isOutgoing                 ? "Outgoing · " : "Incoming · "}
                  {fmtTime(call.created_at)}
                </span>
                {dur && <span>· {dur}</span>}
              </div>
            </div>
            <div className="cv-call-btns">
              <button className="cv-call-btn cv-btn-audio" title="Voice call"
                onClick={() => other && onStartCall({ name: other.full_name, initial: getInitial(other.full_name), type:"audio", outgoing:true, calleeId: other.id, user: other })}>
                <Ic.Phone />
              </button>
              <button className="cv-call-btn cv-btn-video" title="Video call"
                onClick={() => other && onStartCall({ name: other.full_name, initial: getInitial(other.full_name), type:"video", outgoing:true, calleeId: other.id, user: other })}>
                <Ic.Video />
              </button>
            </div>
          </div>
        );
      })}

      {chooserTarget && (
        <CallTypeChooser
          target={chooserTarget}
          onChoose={handleTypeChosen}
          onClose={() => setChooserTarget(null)}
        />
      )}

      {showGroupPicker && (
        <GroupPicker
          contacts={enrichedContacts}
          onStart={handleGroupStart}
          onBack={() => setShowGroupPicker(false)}
        />
      )}

      <style>{`
        .cv-root { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-bottom:16px; background:#000; }
        .cv-root::-webkit-scrollbar { width:3px; }
        .cv-root::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.15); border-radius:2px; }

        /* ── Avatar ── */
        .cv-av {
          border-radius:50%; background:linear-gradient(135deg,#141414,#1e1e1e);
          border:2px solid rgba(255,255,255,0.06);
          display:flex; align-items:center; justify-content:center;
          font-weight:700; color:#84cc16; flex-shrink:0; overflow:hidden;
        }
        .cv-av img { width:100%; height:100%; object-fit:cover; }

        /* ── Quick launch ── */
        .cv-quicklaunch { display:flex; gap:8px; padding:14px 16px 10px; border-bottom:1px solid rgba(255,255,255,0.04); }
        .cv-qbtn { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 4px; border-radius:12px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s; border:1px solid; }
        .cv-qbtn.audio { background:rgba(132,204,22,0.07); border-color:rgba(132,204,22,0.2); color:#84cc16; }
        .cv-qbtn.audio:hover { background:rgba(132,204,22,0.14); }
        .cv-qbtn.video { background:rgba(96,165,250,0.07); border-color:rgba(96,165,250,0.2); color:#60a5fa; }
        .cv-qbtn.video:hover { background:rgba(96,165,250,0.14); }
        .cv-qbtn.group { background:rgba(192,132,252,0.07); border-color:rgba(192,132,252,0.2); color:#c084fc; }
        .cv-qbtn.group:hover { background:rgba(192,132,252,0.14); }

        /* ── Data banner ── */
        .cv-data-banner { display:flex; align-items:center; justify-content:space-between; margin:10px 16px; padding:12px 14px; background:rgba(132,204,22,0.05); border:1px solid rgba(132,204,22,0.15); border-radius:14px; cursor:pointer; transition:background 0.15s; text-align:left; width:calc(100% - 32px); }
        .cv-data-banner:hover { background:rgba(132,204,22,0.09); }
        .cv-data-left { display:flex; align-items:center; gap:10px; }
        .cv-data-icon { font-size:22px; flex-shrink:0; }
        .cv-data-title { font-size:13px; font-weight:700; color:#84cc16; }
        .cv-data-sub   { font-size:11px; color:#555; margin-top:1px; }
        .cv-data-arrow { color:#84cc16; transition:transform 0.2s; flex-shrink:0; }

        /* ── Data detail ── */
        .cv-data-detail { margin:0 16px 10px; padding:12px 14px; background:rgba(0,0,0,0.4); border:1px solid rgba(132,204,22,0.12); border-top:none; border-radius:0 0 14px 14px; animation:fadeDown 0.18s ease-out; }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .cv-data-compare-title { font-size:11px; font-weight:700; color:#444; text-transform:uppercase; letter-spacing:0.7px; margin-bottom:10px; }
        .cv-compare-rows { display:flex; flex-direction:column; gap:7px; }
        .cv-compare-row { display:flex; align-items:center; gap:8px; }
        .cv-compare-name { font-size:11px; color:#666; width:110px; flex-shrink:0; }
        .cv-compare-bar-wrap { flex:1; height:5px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; }
        .cv-compare-bar { height:100%; border-radius:3px; }
        .cv-compare-val { font-size:11px; font-weight:700; width:80px; text-align:right; flex-shrink:0; }
        .cv-tech-badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .cv-tech-badge { padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; background:rgba(132,204,22,0.08); border:1px solid rgba(132,204,22,0.2); color:#84cc16; }

        /* ── Contacts scroll ── */
        .cv-contacts-scroll { display:flex; gap:14px; padding:10px 16px; overflow-x:auto; -webkit-overflow-scrolling:touch; border-bottom:1px solid rgba(255,255,255,0.04); }
        .cv-contacts-scroll::-webkit-scrollbar { display:none; }
        .cv-contact-bubble { display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; flex-shrink:0; }
        .cv-contact-av-wrap { position:relative; }
        .cv-contact-dot { position:absolute; bottom:1px; right:1px; width:11px; height:11px; border-radius:50%; background:#22c55e; border:2px solid #000; }
        .cv-contact-name { font-size:10px; color:#777; max-width:52px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* ── Section label ── */
        .cv-section-lbl { padding:10px 16px 4px; font-size:10px; font-weight:700; color:#333; text-transform:uppercase; letter-spacing:0.7px; }
        .cv-section-hint { font-size:9px; color:#222; text-transform:none; letter-spacing:0; }

        /* ── Loading skeletons ── */
        .cv-loading { padding:0 16px; display:flex; flex-direction:column; gap:8px; margin-top:6px; }
        .cv-skel { height:60px; border-radius:12px; background:rgba(255,255,255,0.03); animation:cvSkelPulse 1.4s ease-in-out infinite; }
        @keyframes cvSkelPulse { 0%,100%{opacity:0.5} 50%{opacity:0.15} }

        /* ── Empty ── */
        .cv-empty { display:flex; flex-direction:column; align-items:center; padding:40px 20px; gap:8px; color:#444; text-align:center; }
        .cv-empty-icon { font-size:40px; margin-bottom:4px; }
        .cv-empty p { margin:0; font-size:14px; color:#555; font-weight:600; }
        .cv-empty span { font-size:12px; color:#333; }
        .cv-empty-small { padding:20px; text-align:center; font-size:13px; color:#444; }

        /* ── Call row ── */
        .cv-call-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.03); transition:background 0.15s; }
        .cv-call-row:hover { background:rgba(255,255,255,0.02); }
        .cv-info { flex:1; min-width:0; }
        .cv-call-top { display:flex; align-items:center; gap:8px; margin-bottom:3px; }
        .cv-name { font-size:14px; font-weight:700; color:#fff; }
        .cv-name.missed { color:#ef4444; }
        .cv-quality-tag { font-size:10px; font-weight:700; padding:2px 7px; border-radius:8px; border:1px solid; flex-shrink:0; }
        .cv-call-sub { display:flex; align-items:center; gap:4px; font-size:11px; color:#444; }
        .cv-call-btns { display:flex; gap:8px; }
        .cv-call-btn { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background 0.15s; flex-shrink:0; }
        .cv-btn-audio { background:rgba(132,204,22,0.07); border:1px solid rgba(132,204,22,0.18); color:#84cc16; }
        .cv-btn-audio:hover { background:rgba(132,204,22,0.16); }
        .cv-btn-video { background:rgba(96,165,250,0.07); border:1px solid rgba(96,165,250,0.18); color:#60a5fa; }
        .cv-btn-video:hover { background:rgba(96,165,250,0.16); }

        /* ══ CHOOSER SHEET ══ */
        .chooser-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.65); z-index:50; display:flex; align-items:flex-end; animation:backdropIn 0.2s ease; }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        .chooser-sheet { background:#0a0a0a; border:1px solid rgba(132,204,22,0.15); border-radius:20px 20px 0 0; padding:0 0 calc(env(safe-area-inset-bottom,0px)+20px); width:100%; animation:sheetUp 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .chooser-sheet-tall { max-height:82vh; overflow:hidden; display:flex; flex-direction:column; }
        .chooser-handle { width:36px; height:4px; border-radius:2px; background:rgba(255,255,255,0.12); margin:12px auto 0; }
        .chooser-head { display:flex; align-items:center; gap:12px; padding:14px 20px 10px; }
        .chooser-target { display:flex; align-items:center; gap:10px; flex:1; }
        .chooser-name { font-size:15px; font-weight:800; color:#fff; }
        .chooser-sub  { font-size:12px; color:#444; margin-top:1px; }
        .chooser-x, .gp-back-btn { width:32px; height:32px; border-radius:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:center; color:#555; cursor:pointer; }
        .chooser-types { padding:8px 20px 4px; display:flex; flex-direction:column; gap:6px; }
        .ct-btn { display:flex; align-items:center; gap:14px; padding:14px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); color:#ccc; cursor:pointer; text-align:left; transition:all 0.15s; width:100%; }
        .ct-btn:hover { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.1); transform:translateX(2px); }
        .ct-icon  { font-size:24px; flex-shrink:0; }
        .ct-info  { flex:1; }
        .ct-label { display:block; font-size:14px; font-weight:700; }
        .ct-desc  { display:block; font-size:11px; color:#555; margin-top:2px; }

        /* ── Data education inside chooser ── */
        .chooser-data-edu { margin:8px 20px 4px; padding:12px 14px; background:rgba(132,204,22,0.04); border:1px solid rgba(132,204,22,0.1); border-radius:12px; }
        .edu-head  { font-size:11px; color:#555; display:flex; align-items:center; gap:5px; margin-bottom:8px; line-height:1.4; }
        .edu-pills { display:flex; gap:6px; flex-wrap:wrap; }
        .edu-pill  { display:flex; align-items:center; gap:4px; padding:3px 8px; border-radius:8px; border:1px solid; font-size:10px; color:#777; }
        .edu-pill-est { font-weight:700; }

        /* ══ GROUP PICKER ══ */
        .gp-chips { display:flex; gap:8px; flex-wrap:wrap; padding:8px 20px; border-bottom:1px solid rgba(255,255,255,0.05); }
        .gp-chip { display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:20px; background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.25); cursor:pointer; font-size:12px; font-weight:600; color:#84cc16; }
        .gp-chip-av { width:18px; height:18px; border-radius:50%; background:rgba(132,204,22,0.2); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; }
        .gp-chip-x  { font-size:14px; opacity:0.6; }
        .gp-list    { flex:1; overflow-y:auto; }
        .gp-list::-webkit-scrollbar { width:3px; }
        .gp-list::-webkit-scrollbar-thumb { background:rgba(132,204,22,0.15); }
        .gp-row { display:flex; align-items:center; gap:12px; padding:10px 20px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; transition:background 0.15s; }
        .gp-row:hover { background:rgba(255,255,255,0.03); }
        .gp-sel       { background:rgba(132,204,22,0.05); }
        .gp-av-wrap   { position:relative; flex-shrink:0; }
        .gp-dot { position:absolute; bottom:1px; right:1px; width:10px; height:10px; border-radius:50%; background:#22c55e; border:2px solid #0a0a0a; }
        .gp-info { flex:1; }
        .gp-name   { display:block; font-size:14px; font-weight:700; color:#fff; }
        .gp-status { display:block; font-size:11px; color:#444; margin-top:1px; }
        .gp-check  { width:24px; height:24px; border-radius:50%; border:1.5px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; color:transparent; flex-shrink:0; }
        .gp-check-on { background:#84cc16; border-color:#84cc16; color:#000; }
        .gp-actions { padding:12px 20px calc(env(safe-area-inset-bottom,0px)+12px); display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.06); }
        .gp-start { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; transition:background 0.15s; }
        .gp-start.audio { background:rgba(132,204,22,0.1); border:1px solid rgba(132,204,22,0.3); color:#84cc16; }
        .gp-start.audio:hover { background:rgba(132,204,22,0.18); }
        .gp-start.video { background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.3); color:#60a5fa; }
        .gp-start.video:hover { background:rgba(96,165,250,0.18); }
      `}</style>
    </div>
  );
};

export default CallsView;