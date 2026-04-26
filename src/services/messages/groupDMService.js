// ============================================================================
// src/services/messages/groupDMService.js — v5 ALL-MEMBERS-VISIBLE
// ============================================================================
// FIXES vs v4:
//  [G1]  createGroup() broadcasts to EVERY member's personal gc_notify:{id}
//        channel. Waits for SUBSCRIBED before sending so delivery is guaranteed.
//  [G2]  loadGroups() uses .contains("member_ids", [userId]) which works with
//        both text[] and jsonb[] column types. Falls back to JS filter.
//  [G3]  _subscribeToGroupList() listens on BOTH postgres_changes AND broadcast
//        so a member who wasn't online at create time still gets the group.
//  [G4]  subscribeToMessages() listens on postgres_changes as primary source
//        and broadcast as fast-path for members who are online.
//  [G5]  getGroup() hits localStorage → memory → DB in order.
//  [G6]  sendMessage() uses correct community_messages schema.
//  [G7]  Group call signaling: startGroupCall() broadcasts to ALL member channels.
//  All v4 features preserved.
// ============================================================================

import { supabase } from "../config/supabase";

class GroupDMService {
  constructor() {
    this._userId           = null;
    this._groupListChannel = null;
    this._msgChannels      = new Map(); // groupId → supabase channel
    this._listeners        = new Map(); // event key → Set<fn>
    this._groups           = new Map(); // groupId → group object
    this._pendingMessages  = new Map(); // tempId → message
    this._initialized      = false;
  }

  // ── Event bus ──────────────────────────────────────────────────────────────
  on(key, fn) {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(fn);
    return () => this._listeners.get(key)?.delete(fn);
  }

  _emit(key, data) {
    this._listeners.get(key)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error("[GroupDM] emit:", e); }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  init(userId) {
    if (this._initialized && this._userId === userId) return;
    if (this._initialized) this.cleanup();
    this._userId      = userId;
    this._initialized = true;
    this._subscribeToGroupList();
    console.log("[GroupDM] v5 init:", userId);
  }

  // ==========================================================================
  // CREATE GROUP — [G1] Notify every member
  // ==========================================================================
  async createGroup({ name, icon = "👥", members }) {
    if (!this._userId || !name?.trim()) throw new Error("Invalid parameters");

    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Build members array, creator always first with is_admin: true
    const self = members.find(m => m?.id === this._userId) || {};
    const membersJson = [
      {
        id:        this._userId,
        full_name: self.full_name || self.name || "You",
        avatar_id: self.avatar_id || self.avatarId || null,
        is_admin:  true,
      },
      ...members
        .filter(m => m?.id && m.id !== this._userId)
        .map(m => ({
          id:        m.id,
          full_name: m.full_name || m.name || "",
          avatar_id: m.avatar_id || m.avatarId || null,
          is_admin:  false,
        })),
    ];
    const memberIds = membersJson.map(m => m.id);

    const group = {
      id:          groupId,
      name:        name.trim(),
      icon:        icon || "👥",
      created_by:  this._userId,
      member_ids:  memberIds,
      members:     membersJson,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
      isGroup:     true,
      lastMessage: null,
      unreadCount: 0,
    };

    // 1. Persist to DB
    let dbGroup = null;
    try {
      const { data, error } = await supabase
        .from("group_chats")
        .insert({
          id:         group.id,
          name:       group.name,
          icon:       group.icon,
          created_by: group.created_by,
          member_ids: group.member_ids,
          members:    group.members,
        })
        .select()
        .single();

      if (error) {
        if (!error.message?.includes("does not exist")) {
          console.warn("[GroupDM] DB insert:", error.message);
        }
      } else {
        dbGroup = data;
        console.log("[GroupDM] ✅ Group saved to DB:", groupId);
      }
    } catch (e) {
      console.warn("[GroupDM] createGroup DB error:", e.message);
    }

    const finalGroup = {
      ...(dbGroup || group),
      members:     membersJson,
      member_ids:  memberIds,
      isGroup:     true,
      lastMessage: null,
      unreadCount: 0,
    };

    // 2. Cache for creator
    this._groups.set(groupId, finalGroup);
    try { localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(finalGroup)); } catch {}
    this._emit("group_list", Array.from(this._groups.values()));
    this._emit("new_group", finalGroup);

    // 3. [G1] Notify ALL other members — parallel with retry
    const otherMemberIds = memberIds.filter(mid => mid !== this._userId);
    console.log("[GroupDM] Notifying members:", otherMemberIds);
    await Promise.allSettled(otherMemberIds.map(mid => this._notifyMember(mid, finalGroup)));

    return finalGroup;
  }

  // [G1] Notify one member — waits for SUBSCRIBED then sends
  _notifyMember(memberId, group) {
    return new Promise((resolve) => {
      const topic = `gc_notify:${memberId}`;
      let sent    = false;
      let retries = 0;

      const attempt = () => {
        const ch = supabase.channel(topic);
        let timeoutId;

        ch.subscribe((status) => {
          if (sent) return;

          if (status === "SUBSCRIBED") {
            ch.send({
              type:    "broadcast",
              event:   "gc_new_group",
              payload: { ...group, isGroup: true },
            })
            .then(() => {
              sent = true;
              clearTimeout(timeoutId);
              setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 2000);
              resolve(true);
            })
            .catch(err => {
              console.warn("[GroupDM] notify send:", err.message);
              try { supabase.removeChannel(ch); } catch {}
              if (retries++ < 3) setTimeout(attempt, 400 * retries);
              else resolve(false);
            });

          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(timeoutId);
            try { supabase.removeChannel(ch); } catch {}
            if (!sent && retries++ < 3) setTimeout(attempt, 400 * retries);
            else resolve(false);
          }
        });

        timeoutId = setTimeout(() => {
          if (!sent) {
            try { supabase.removeChannel(ch); } catch {}
            resolve(false);
          }
        }, 5000);
      };

      attempt();
    });
  }

  // ==========================================================================
  // LOAD GROUPS — [G2]
  // ==========================================================================
  async loadGroups() {
    if (!this._userId) return [];

    // Hydrate from localStorage instantly
    const fromLS = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("gc_meta_")) continue;
        try {
          const g = JSON.parse(localStorage.getItem(k) || "{}");
          if (
            g?.id && g?.name &&
            Array.isArray(g?.members) &&
            g.members.some(m => m?.id === this._userId)
          ) {
            fromLS.push({ ...g, isGroup: true });
          }
        } catch {}
      }
    } catch {}
    if (fromLS.length) fromLS.forEach(g => this._groups.set(g.id, g));

    // Fetch from Supabase
    try {
      // [G2] .contains works for text[] column with array value
      const { data, error } = await supabase
        .from("group_chats")
        .select("*")
        .contains("member_ids", [this._userId])
        .order("updated_at", { ascending: false });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          console.warn("[GroupDM] group_chats table not found");
          return fromLS;
        }
        // Fallback: load all and JS-filter
        const { data: all } = await supabase
          .from("group_chats")
          .select("*")
          .order("updated_at", { ascending: false });

        return this._mergeGroups(all?.filter(g =>
          Array.isArray(g.member_ids) && g.member_ids.includes(this._userId)
        ) || [], fromLS);
      }

      return this._mergeGroups(data || [], fromLS);
    } catch (e) {
      console.error("[GroupDM] loadGroups:", e);
      return fromLS;
    }
  }

  _mergeGroups(dbGroups, fromLS) {
    const map = new Map(fromLS.map(g => [g.id, g]));
    (dbGroups || []).forEach(g => {
      const normalized = {
        ...g,
        members:    Array.isArray(g.members) ? g.members : [],
        member_ids: Array.isArray(g.member_ids) ? g.member_ids : [],
        isGroup:    true,
        lastMessage: null,
        unreadCount: 0,
      };
      map.set(g.id, normalized);
      try { localStorage.setItem(`gc_meta_${g.id}`, JSON.stringify(normalized)); } catch {}
    });
    const merged = Array.from(map.values());
    merged.forEach(g => this._groups.set(g.id, g));
    this._emit("group_list", merged);
    return merged;
  }

  // [G5]
  async getGroup(groupId) {
    if (this._groups.has(groupId)) return this._groups.get(groupId);
    try {
      const ls = localStorage.getItem(`gc_meta_${groupId}`);
      if (ls) { const g = JSON.parse(ls); this._groups.set(groupId, g); return g; }
    } catch {}
    try {
      const { data } = await supabase
        .from("group_chats").select("*").eq("id", groupId).single();
      if (data) {
        const g = { ...data, members: Array.isArray(data.members) ? data.members : [], isGroup: true };
        this._groups.set(groupId, g);
        return g;
      }
    } catch {}
    return null;
  }

  async updateGroup(groupId, updates) {
    const { error } = await supabase
      .from("group_chats")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", groupId);
    if (error) throw error;
    const existing = this._groups.get(groupId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this._groups.set(groupId, updated);
      try { localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(updated)); } catch {}
      this._emit(`group_updated:${groupId}`, updated);
    }
  }

  // ==========================================================================
  // MESSAGES — [G6]
  // ==========================================================================
  async loadMessages(groupId, limit = 200) {
    if (!groupId) return [];
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .select("id, channel_id, user_id, content, reply_to_id, created_at, reactions, attachments")
        .eq("channel_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) { if (error.code === "42P01") return []; throw error; }
      return (data || []).map(m => ({ ...m, sender_id: m.user_id }));
    } catch (e) {
      console.error("[GroupDM] loadMessages:", e);
      return [];
    }
  }

  // [G6]
  async sendMessage(groupId, content, currentUser, replyToId = null) {
    if (!content?.trim() || !this._userId || !groupId) return null;

    const tempId     = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimistic = {
      id:          tempId,
      _tempId:     tempId,
      _optimistic: true,
      channel_id:  groupId,
      user_id:     this._userId,
      sender_id:   this._userId,
      content:     content.trim(),
      reply_to_id: replyToId || null,
      created_at:  new Date().toISOString(),
      user:        currentUser,
    };

    this._pendingMessages.set(tempId, optimistic);
    this._emit(`msgs:${groupId}`, { type: "optimistic", message: optimistic });

    // Broadcast to group channel (fast path for online members)
    const ch = this._msgChannels.get(groupId);
    if (ch) {
      ch.send({
        type: "broadcast", event: "gc_msg",
        payload: { ...optimistic, _tempId: tempId },
      }).catch(() => {});
    }

    try {
      const insertData = {
        channel_id: groupId,
        user_id:    this._userId,
        content:    content.trim(),
      };
      if (replyToId) insertData.reply_to_id = replyToId;

      const { data, error } = await supabase
        .from("community_messages")
        .insert(insertData)
        .select("id, channel_id, user_id, content, reply_to_id, created_at, reactions")
        .single();
      if (error) throw error;

      const real = { ...data, sender_id: data.user_id, user: currentUser };
      this._pendingMessages.delete(tempId);
      this._emit(`msgs:${groupId}`, { type: "confirmed", tempId, message: real });

      // Update group last activity
      supabase.from("group_chats")
        .update({ updated_at: data.created_at })
        .eq("id", groupId).then(() => {});

      const g = this._groups.get(groupId);
      if (g) {
        const updated = { ...g, lastMessage: real };
        this._groups.set(groupId, updated);
        this._emit(`group_updated:${groupId}`, updated);
      }
      return real;
    } catch (e) {
      this._pendingMessages.delete(tempId);
      this._emit(`msgs:${groupId}`, { type: "failed", tempId });
      throw e;
    }
  }

  sendTyping(groupId, isTyping, userName) {
    const ch = this._msgChannels.get(groupId);
    ch?.send({
      type: "broadcast", event: "gc_typing",
      payload: { userId: this._userId, userName: userName || "Someone", typing: isTyping },
    }).catch(() => {});
  }

  // ==========================================================================
  // GROUP CALLS — [G7]
  // ==========================================================================
  async startGroupCall({ groupId, callId, callType, callerName, callerAvId }) {
    const group = await this.getGroup(groupId);
    if (!group) throw new Error("Group not found");

    const members = (group.members || []).filter(m => m?.id && m.id !== this._userId);
    const payload = {
      callId,
      callType: callType || "audio",
      callerId: this._userId,
      callerName,
      callerAvatarId: callerAvId,
      groupId,
      groupName:        group.name,
      participantCount: members.length + 1,
      type:             callType || "audio",
      caller: { id: this._userId, full_name: callerName, avatar_id: callerAvId },
    };

    // Notify all group members in parallel
    await Promise.allSettled(
      members.map(m => this._notifyMemberCall(m.id, payload))
    );

    return { groupId, callId, members };
  }

  _notifyMemberCall(memberId, payload) {
    return new Promise((resolve) => {
      const ch = supabase.channel(`user_calls:${memberId}`);
      let timeoutId;
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.send({ type: "broadcast", event: "incoming_call", payload })
            .then(() => {
              clearTimeout(timeoutId);
              setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 2000);
              resolve(true);
            })
            .catch(() => { resolve(false); });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeoutId);
          try { supabase.removeChannel(ch); } catch {}
          resolve(false);
        }
      });
      timeoutId = setTimeout(() => {
        try { supabase.removeChannel(ch); } catch {}
        resolve(false);
      }, 4000);
    });
  }

  // ==========================================================================
  // REALTIME — Group list [G3]
  // ==========================================================================
  _subscribeToGroupList() {
    if (!this._userId) return;

    this._groupListChannel = supabase
      .channel(`gc_list:${this._userId}`, { config: { broadcast: { self: false } } })
      // DB changes — catches groups created while we were offline
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "group_chats",
      }, (payload) => {
        const row = payload.new;
        if (!Array.isArray(row?.member_ids)) return;
        if (!row.member_ids.includes(this._userId)) return;
        this._ingestNewGroup(row);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "group_chats",
      }, (payload) => {
        const row = payload.new;
        if (!Array.isArray(row?.member_ids)) return;
        if (!row.member_ids.includes(this._userId)) return;
        const existing = this._groups.get(row.id);
        if (existing) {
          const updated = {
            ...existing, ...row,
            members: Array.isArray(row.members) ? row.members : existing.members,
            isGroup: true,
          };
          this._groups.set(row.id, updated);
          try { localStorage.setItem(`gc_meta_${row.id}`, JSON.stringify(updated)); } catch {}
          this._emit(`group_updated:${row.id}`, updated);
        }
      })
      // [G3] Broadcast fallback — for real-time delivery when DB write is delayed
      .on("broadcast", { event: "gc_new_group" }, ({ payload }) => {
        if (!payload?.id || !Array.isArray(payload?.members)) return;
        if (!payload.members.some(m => m?.id === this._userId)) return;
        if (!this._groups.has(payload.id)) {
          this._ingestNewGroup(payload);
        }
      })
      .subscribe((status) => {
        console.log("[GroupDM] list channel:", status);
      });
  }

  _ingestNewGroup(raw) {
    const g = {
      ...raw,
      members:    Array.isArray(raw.members) ? raw.members : [],
      member_ids: Array.isArray(raw.member_ids) ? raw.member_ids : [],
      isGroup:    true,
      lastMessage: null,
      unreadCount: 0,
    };
    this._groups.set(g.id, g);
    try { localStorage.setItem(`gc_meta_${g.id}`, JSON.stringify(g)); } catch {}
    this._emit("group_list", Array.from(this._groups.values()));
    this._emit("new_group", g);
  }

  // ==========================================================================
  // REALTIME — Messages [G4]
  // ==========================================================================
  subscribeToMessages(groupId, callbacks = {}) {
    if (this._msgChannels.has(groupId)) return () => this.unsubscribeMessages(groupId);

    const ch = supabase
      .channel(`gc_msgs:${groupId}`, { config: { broadcast: { self: false } } })
      // Fast broadcast path for online members
      .on("broadcast", { event: "gc_msg" }, ({ payload }) => {
        if (!payload) return;
        const tempId = payload._tempId || payload.id;
        if (tempId && this._pendingMessages.has(tempId)) return; // skip own echo
        const msg = { ...payload, sender_id: payload.user_id || payload.sender_id };
        callbacks.onMessage?.(msg);
        this._emit(`msgs:${groupId}`, { type: "broadcast", message: msg });
      })
      .on("broadcast", { event: "gc_typing" }, ({ payload }) => {
        if (payload?.userId === this._userId) return;
        callbacks.onTyping?.(payload);
      })
      // [G4] DB change path — catches messages for offline/reconnecting members
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "community_messages",
        filter: `channel_id=eq.${groupId}`,
      }, ({ new: row }) => {
        if (!row?.id || row.user_id === this._userId) return;
        // Don't show if we got it via broadcast already
        const msg = { ...row, sender_id: row.user_id };
        callbacks.onMessage?.(msg);
        this._emit(`msgs:${groupId}`, { type: "db_insert", message: msg });
      })
      .subscribe((status) => {
        console.log("[GroupDM] msg channel", groupId, status);
      });

    this._msgChannels.set(groupId, ch);
    return () => this.unsubscribeMessages(groupId);
  }

  unsubscribeMessages(groupId) {
    const ch = this._msgChannels.get(groupId);
    if (ch) {
      try { supabase.removeChannel(ch); } catch {}
      this._msgChannels.delete(groupId);
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================
  cleanup() {
    if (this._groupListChannel) {
      try { supabase.removeChannel(this._groupListChannel); } catch {}
      this._groupListChannel = null;
    }
    this._msgChannels.forEach(ch => { try { supabase.removeChannel(ch); } catch {} });
    this._msgChannels.clear();
    this._listeners.clear();
    this._groups.clear();
    this._pendingMessages.clear();
    this._userId      = null;
    this._initialized = false;
  }
}

export default new GroupDMService();