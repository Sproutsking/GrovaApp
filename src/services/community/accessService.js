import { supabase } from "../config/supabase";

export const targetKey = (type, id) => `${type}:${id}`;

export function resolveAccessForRole({ roleId, channel, categoryId, rules = [], defaultOpen = true }) {
  const normalizedRules = Array.isArray(rules) ? rules : [];
  const channelId = channel?.id ?? channel?.channel_id ?? null;
  const effectiveCategoryId = categoryId ?? channel?.category_id ?? channel?.category ?? null;

  const channelTargetRules = normalizedRules.filter((rule) => {
    return String(rule.target_type || "") === "channel" && String(rule.target_id ?? "") === String(channelId ?? "");
  });

  const categoryTargetRules = normalizedRules.filter((rule) => {
    return String(rule.target_type || "") === "category" && String(rule.target_id ?? "") === String(effectiveCategoryId ?? "");
  });

  const targetRules = channelTargetRules.length ? channelTargetRules : categoryTargetRules;
  const matchingRule = targetRules.find((rule) => String(rule.role_id ?? "") === String(roleId ?? ""));

  if (!targetRules.length) {
    return {
      canView: Boolean(defaultOpen),
      canSend: Boolean(defaultOpen),
      restricted: false,
      inherited: false,
      source: null,
    };
  }

  if (!matchingRule) {
    return {
      canView: false,
      canSend: false,
      restricted: true,
      inherited: !channelTargetRules.length && categoryTargetRules.length > 0,
      source: channelTargetRules.length ? "channel" : "category",
    };
  }

  return {
    canView: matchingRule.can_view === true,
    canSend: matchingRule.can_send === true,
    restricted: true,
    inherited: !channelTargetRules.length && categoryTargetRules.length > 0,
    source: channelTargetRules.length ? "channel" : "category",
  };
}

export async function fetchStructure(communityId) {
  const [cats, chans, rules] = await Promise.all([
    supabase.from("community_channel_categories").select("id,name,position").eq("community_id", communityId).order("position", { ascending: true }),
    supabase.from("community_channels").select("id,name,icon,type,category,category_id,position,deleted_at").eq("community_id", communityId).is("deleted_at", null).order("position", { ascending: true }),
    supabase.from("community_access_rules").select("*").eq("community_id", communityId),
  ]);
  const err = cats.error || chans.error || rules.error;
  if (err) throw err;
  return { categories: cats.data || [], channels: chans.data || [], rules: rules.data || [] };
}

export function groupRules(rules = []) {
  const map = new Map();
  rules.forEach((rule) => {
    const key = targetKey(rule.target_type, rule.target_id);
    map.set(key, [...(map.get(key) || []), rule]);
  });
  return map;
}

export function categoryIdOf(channel, categories = []) {
  return channel.category_id || categories.find((category) => category.name === channel.category)?.id || null;
}

export function isChannelRestricted(structure, channelId) {
  const channel = structure.channels.find((item) => item.id === channelId);
  if (!channel) return false;
  const map = groupRules(structure.rules);
  if ((map.get(targetKey("channel", channelId)) || []).length) return true;
  const categoryId = categoryIdOf(channel, structure.categories);
  return Boolean(categoryId && (map.get(targetKey("category", categoryId)) || []).length);
}

export async function upsertRules(communityId, targetType, targetId, rows) {
  if (!rows.length) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("community_access_rules").upsert(
    rows.map((row) => ({ community_id: communityId, target_type: targetType, target_id: targetId, role_id: row.roleId, can_view: row.canView, can_send: row.canView && row.canSend, updated_at: now })),
    { onConflict: "target_type,target_id,role_id" },
  );
  if (error) throw error;
}

export async function openTarget(targetType, targetId) {
  const { error } = await supabase.from("community_access_rules").delete().eq("target_type", targetType).eq("target_id", targetId);
  if (error) throw error;
}

export const notifyAccessChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("community:channels-changed"));
  }
};

export default {
  fetchStructure,
  groupRules,
  categoryIdOf,
  isChannelRestricted,
  upsertRules,
  openTarget,
  notifyAccessChanged,
  targetKey,
  resolveAccessForRole,
};
