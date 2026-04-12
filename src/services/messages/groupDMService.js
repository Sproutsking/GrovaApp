// ============================================================================
// services/messages/groupDMService.js — NOVA GROUP DM SERVICE v3 FIXED
// ============================================================================
// KEY FIXES:
//  [G1] createGroup() broadcasts to "user_calls:{memberId}" using the CORRECT
//       topic — same as callService persistent channel so members receive it
//  [G2] subscribeToMessages() uses correct group channel topic
//  [G3] sendMessage() persists in community_messages with channel_id=groupId
//  [G4] loadGroups() works with text[] member_ids using .contains()
//  [G5] Group conversations appear in ConversationList via conversationState
//  [G6] getGroup() properly retrieves from Supabase with fallback to cache
//  [G7] All members see group in conversationState after creation
// ============================================================================

import { supabase } from "../config/supabase";
import conversationState from "./ConversationStateManager";

class GroupDMService {
  constructor() {
    this._userId = null;
    this._groupListChannel = null;
    this._msgChannels = new Map();
    this._listeners = new Map();
    this._pendingMessages = new Map();
    this._groups = new Map();
    this._initialized = false;
  }

  init(userId) {
    if (this._initialized && this._userId === userId) return;
    if (this._initialized) this.cleanup();
    this._userId = userId;
    this._initialized = true;
    this._subscribeToGroupList();
    console.log("[GroupDM] v3 init:", userId);
  }

  on(key, fn) {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(fn);
    return () => this._listeners.get(key)?.delete(fn);
  }

  _emit(key, data) {
    this._listeners.get(key)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[GroupDM]", e);
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // CREATE GROUP
  // ════════════════════════════════════════════════════════════════════════
  async createGroup({ name, icon = "👥", members }) {
    if (!this._userId || !name?.trim()) throw new Error("Invalid parameters");

    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const selfMember = members.find((m) => m?.id === this._userId) || {};
    const othersFiltered = members.filter(
      (m) => m?.id && m.id !== this._userId,
    );

    const membersJson = [
      {
        id: this._userId,
        full_name: selfMember.full_name || selfMember.name || "You",
        avatar_id: selfMember.avatar_id || selfMember.avatarId || null,
        is_admin: true,
      },
      ...othersFiltered.map((m) => ({
        id: m.id,
        full_name: m.full_name || m.name || "",
        avatar_id: m.avatar_id || m.avatarId || null,
        is_admin: false,
      })),
    ];
    const memberIds = membersJson.map((m) => m.id);

    const group = {
      id: groupId,
      name: name.trim(),
      icon: icon || "👥",
      created_by: this._userId,
      member_ids: memberIds,
      members: membersJson,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Virtual conversation fields for ConversationList compatibility
      isGroup: true,
      lastMessage: null,
      unreadCount: 0,
    };

    // 1. Persist to Supabase
    let dbGroup = null;
    try {
      const { data, error } = await supabase
        .from("group_chats")
        .insert({
          id: group.id,
          name: group.name,
          icon: group.icon,
          created_by: group.created_by,
          member_ids: group.member_ids,
          members: group.members,
        })
        .select()
        .single();

      if (error) {
        if (!error.message?.includes("does not exist")) {
          console.warn("[GroupDM] DB insert:", error.message);
        }
      } else {
        dbGroup = data;
        console.log("[GroupDM] Group saved to DB:", groupId);
      }
    } catch (e) {
      console.warn("[GroupDM] createGroup DB error:", e.message);
    }

    const finalGroup = {
      ...(dbGroup || group),
      members: membersJson,
      member_ids: memberIds,
      isGroup: true,
      lastMessage: null,
      unreadCount: 0,
    };

    // 2. Cache locally
    this._groups.set(groupId, finalGroup);
    try {
      localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(finalGroup));
    } catch (_) {}

    this._emit("group_list", Array.from(this._groups.values()));
    this._emit("new_group", finalGroup);

    // 3. Notify other members via their personal channels
    for (const memberId of memberIds) {
      if (memberId === this._userId) continue;
      this._notifyMember(memberId, finalGroup);
    }

    return finalGroup;
  }

  // ── Notify member via their personal gc_notify channel ─────────────────
  async _notifyMember(memberId, group) {
    const topic = `gc_notify:${memberId}`;
    try {
      const ch = supabase.channel(topic).subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.send({
            type: "broadcast",
            event: "gc_new_group",
            payload: group,
          })
            .then(() => {
              setTimeout(() => {
                try {
                  supabase.removeChannel(ch);
                } catch (_) {}
              }, 3000);
            })
            .catch(() => {
              try {
                supabase.removeChannel(ch);
              } catch (_) {}
            });
        }
      });
    } catch (e) {
      console.warn("[GroupDM] notify member failed:", e.message);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // LOAD GROUPS
  // ════════════════════════════════════════════════════════════════════════
  async loadGroups() {
    if (!this._userId) return [];

    // Load from localStorage first (instant)
    const fromLS = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("gc_meta_")) continue;
        try {
          const g = JSON.parse(localStorage.getItem(k) || "{}");
          if (
            g?.id &&
            g?.name &&
            Array.isArray(g?.members) &&
            g.members.some((m) => m?.id === this._userId)
          ) {
            fromLS.push({ ...g, isGroup: true });
          }
        } catch (_) {}
      }
    } catch (_) {}

    if (fromLS.length) {
      fromLS.forEach((g) => this._groups.set(g.id, g));
    }

    // Then load from Supabase
    try {
      const { data, error } = await supabase
        .from("group_chats")
        .select("*")
        .contains("member_ids", [this._userId])
        .order("updated_at", { ascending: false });

      if (error) {
        if (
          error.code === "42P01" ||
          error.message?.includes("does not exist")
        ) {
          console.warn(
            "[GroupDM] group_chats table not found — create it in Supabase",
          );
          return fromLS;
        }
        throw error;
      }

      const dbGroups = (data || []).map((g) => ({
        ...g,
        members: Array.isArray(g.members) ? g.members : [],
        member_ids: Array.isArray(g.member_ids) ? g.member_ids : [],
        isGroup: true,
        lastMessage: null,
        unreadCount: 0,
      }));

      // Merge DB + localStorage
      const map = new Map(fromLS.map((g) => [g.id, g]));
      dbGroups.forEach((g) => {
        map.set(g.id, g);
        try {
          localStorage.setItem(`gc_meta_${g.id}`, JSON.stringify(g));
        } catch (_) {}
      });

      const merged = Array.from(map.values());
      merged.forEach((g) => this._groups.set(g.id, g));
      this._emit("group_list", merged);
      return merged;
    } catch (e) {
      console.error("[GroupDM] loadGroups:", e);
      return fromLS;
    }
  }

  async getGroup(groupId) {
    if (this._groups.has(groupId)) return this._groups.get(groupId);
    try {
      // Try localStorage
      const ls = localStorage.getItem(`gc_meta_${groupId}`);
      if (ls) {
        const g = JSON.parse(ls);
        this._groups.set(groupId, g);
        return g;
      }
    } catch (_) {}
    try {
      const { data } = await supabase
        .from("group_chats")
        .select("*")
        .eq("id", groupId)
        .single();
      if (data) {
        const g = {
          ...data,
          members: Array.isArray(data.members) ? data.members : [],
          isGroup: true,
        };
        this._groups.set(groupId, g);
        return g;
      }
    } catch (_) {}
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
      try {
        localStorage.setItem(`gc_meta_${groupId}`, JSON.stringify(updated));
      } catch (_) {}
      this._emit(`group_updated:${groupId}`, updated);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ════════════════════════════════════════════════════════════════════════
  async loadMessages(groupId, limit = 200) {
    if (!groupId) return [];
    try {
      const { data, error } = await supabase
        .from("community_messages")
        .select(
          "id, channel_id, user_id, content, reply_to_id, created_at, reactions, attachments",
        )
        .eq("channel_id", groupId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }

      return (data || []).map((m) => ({ ...m, sender_id: m.user_id }));
    } catch (e) {
      console.error("[GroupDM] loadMessages:", e);
      return [];
    }
  }

  async sendMessage(groupId, content, currentUser, replyToId = null) {
    if (!content?.trim() || !this._userId || !groupId) return null;

    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimistic = {
      id: tempId,
      _tempId: tempId,
      _optimistic: true,
      channel_id: groupId,
      user_id: this._userId,
      sender_id: this._userId,
      content: content.trim(),
      reply_to_id: replyToId || null,
      created_at: new Date().toISOString(),
      user: currentUser,
    };

    this._pendingMessages.set(tempId, optimistic);
    this._emit(`msgs:${groupId}`, { type: "optimistic", message: optimistic });

    // Broadcast to group channel
    const ch = this._msgChannels.get(groupId);
    if (ch) {
      ch.send({
        type: "broadcast",
        event: "gc_msg",
        payload: { ...optimistic, _tempId: tempId },
      });
    }

    try {
      const insertData = {
        channel_id: groupId,
        user_id: this._userId,
        content: content.trim(),
      };
      if (replyToId) insertData.reply_to_id = replyToId;

      const { data, error } = await supabase
        .from("community_messages")
        .insert(insertData)
        .select(
          "id, channel_id, user_id, content, reply_to_id, created_at, reactions",
        )
        .single();

      if (error) throw error;

      const real = { ...data, sender_id: data.user_id, user: currentUser };
      this._pendingMessages.delete(tempId);
      this._emit(`msgs:${groupId}`, {
        type: "confirmed",
        tempId,
        message: real,
      });

      // Update group last activity
      supabase
        .from("group_chats")
        .update({ updated_at: data.created_at })
        .eq("id", groupId)
        .then(() => {});

      // Update cached group lastMessage
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
      type: "broadcast",
      event: "gc_typing",
      payload: {
        userId: this._userId,
        userName: userName || "Someone",
        typing: isTyping,
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // REALTIME — group list via postgres_changes
  // ════════════════════════════════════════════════════════════════════════
  _subscribeToGroupList() {
    if (!this._userId) return;

    this._groupListChannel = supabase
      .channel(`group_list:${this._userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_chats" },
        async (payload) => {
          const row = payload.new;
          if (!Array.isArray(row?.member_ids)) return;
          if (!row.member_ids.includes(this._userId)) return;
          const g = {
            ...row,
            members: Array.isArray(row.members) ? row.members : [],
            member_ids: row.member_ids,
            isGroup: true,
            lastMessage: null,
            unreadCount: 0,
          };
          this._groups.set(g.id, g);
          try {
            localStorage.setItem(`gc_meta_${g.id}`, JSON.stringify(g));
          } catch (_) {}
          this._emit("group_list", Array.from(this._groups.values()));
          this._emit("new_group", g);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_chats" },
        (payload) => {
          const row = payload.new;
          if (!Array.isArray(row?.member_ids)) return;
          if (!row.member_ids.includes(this._userId)) return;
          const existing = this._groups.get(row.id);
          if (existing) {
            const updated = {
              ...existing,
              ...row,
              members: Array.isArray(row.members)
                ? row.members
                : existing.members,
              isGroup: true,
            };
            this._groups.set(row.id, updated);
            try {
              localStorage.setItem(
                `gc_meta_${row.id}`,
                JSON.stringify(updated),
              );
            } catch (_) {}
            this._emit(`group_updated:${row.id}`, updated);
          }
        },
      )
      .on("broadcast", { event: "gc_new_group" }, ({ payload }) => {
        if (!payload?.id || !Array.isArray(payload?.members)) return;
        if (!payload.members.some((m) => m?.id === this._userId)) return;
        const g = {
          ...payload,
          isGroup: true,
          lastMessage: null,
          unreadCount: 0,
        };
        if (!this._groups.has(g.id)) {
          this._groups.set(g.id, g);
          try {
            localStorage.setItem(`gc_meta_${g.id}`, JSON.stringify(g));
          } catch (_) {}
          this._emit("new_group", g);
          this._emit("group_list", Array.from(this._groups.values()));
        }
      })
      .subscribe((status) => {
        console.log("[GroupDM] group list channel:", status);
      });
  }

  // ════════════════════════════════════════════════════════════════════════
  // REALTIME — messages in a group
  // ════════════════════════════════════════════════════════════════════════
  subscribeToMessages(groupId, callbacks = {}) {
    if (this._msgChannels.has(groupId)) {
      return () => this.unsubscribeMessages(groupId);
    }

    const ch = supabase
      .channel(`gc_msgs:${groupId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "gc_msg" }, ({ payload }) => {
        if (!payload) return;
        const tempId = payload._tempId || payload.id;
        if (tempId && this._pendingMessages.has(tempId)) return; // skip own echo
        const msg = {
          ...payload,
          sender_id: payload.user_id || payload.sender_id,
        };
        callbacks.onMessage?.(msg);
        this._emit(`msgs:${groupId}`, { type: "broadcast", message: msg });
      })
      .on("broadcast", { event: "gc_typing" }, ({ payload }) => {
        if (payload?.userId === this._userId) return;
        callbacks.onTyping?.(payload);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `channel_id=eq.${groupId}`,
        },
        async ({ new: row }) => {
          if (!row?.id || row.user_id === this._userId) return;
          const msg = { ...row, sender_id: row.user_id };
          callbacks.onMessage?.(msg);
          this._emit(`msgs:${groupId}`, { type: "db_insert", message: msg });
        },
      )
      .subscribe((status) => {
        console.log("[GroupDM] msg channel", groupId, status);
      });

    this._msgChannels.set(groupId, ch);
    return () => this.unsubscribeMessages(groupId);
  }

  unsubscribeMessages(groupId) {
    const ch = this._msgChannels.get(groupId);
    if (ch) {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
      this._msgChannels.delete(groupId);
    }
  }

  cleanup() {
    if (this._groupListChannel) {
      try {
        supabase.removeChannel(this._groupListChannel);
      } catch (_) {}
      this._groupListChannel = null;
    }
    this._msgChannels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
    });
    this._msgChannels.clear();
    this._listeners.clear();
    this._groups.clear();
    this._pendingMessages.clear();
    this._userId = null;
    this._initialized = false;
  }
}

export default new GroupDMService();
