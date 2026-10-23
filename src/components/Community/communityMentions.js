export const COMMUNITY_MENTION_PATTERN = /(@&[^\s@#]+|#[^\s@#]+|@[^\s@#]+)/g;

export const toMentionSlug = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[@#]/g, "");

export function createCommunityMention(item, trigger) {
  const label = item?.type === "user"
    ? item.username || item.full_name
    : item?.name;
  const prefix = item?.type === "role" ? "@&" : trigger;
  return `${prefix}${toMentionSlug(label)} `;
}

export function resolveCommunityMention(token, { members = [], roles = [], channels = [] } = {}) {
  if (token.startsWith("#")) {
    const slug = token.slice(1);
    const channel = channels.find((item) => toMentionSlug(item.name) === slug);
    return { type: "channel", slug, entity: channel || null, label: channel ? `#${channel.name}` : token };
  }
  if (token.startsWith("@&")) {
    const slug = token.slice(2);
    const role = roles.find((item) => toMentionSlug(item.name) === slug);
    return { type: "role", slug, entity: role || null, label: role ? `@${role.name}` : `@${slug.replace(/-/g, " ")}` };
  }
  if (!token.startsWith("@")) return null;

  const slug = token.slice(1);
  if (slug === "everyone" || slug === "here") return { type: "everyone", slug, entity: null, label: token };
  const member = members.find((entry) => {
    const user = entry.user || entry;
    return toMentionSlug(user.username) === slug || toMentionSlug(user.full_name) === slug;
  });
  const user = member?.user || member;
  if (user?.id) {
    return {
      type: "user",
      slug,
      entity: user,
      label: `@${user.full_name || user.username || slug.replace(/-/g, " ")}`,
    };
  }
  const role = roles.find((item) => toMentionSlug(item.name) === slug);
  if (role) return { type: "role", slug, entity: role, label: `@${role.name}` };
  return { type: "unknown", slug, entity: null, label: token };
}
