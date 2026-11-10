const MAX_CONTENT_LENGTH = 20000;
const MAX_ATTACHMENTS = 10;

const normalizedAttachments = (items) => (Array.isArray(items) ? items : []).slice(0, MAX_ATTACHMENTS).map((item) => ({
  name: String(item?.name || item?.file_name || item?.filename || "Attachment").slice(0, 256),
  type: String(item?.content_type || item?.mime_type || item?.type || "file").slice(0, 128),
  url: typeof item?.url === "string" && /^https:\/\//i.test(item.url) ? item.url : null,
  fileId: item?.file_id ? String(item.file_id).slice(0, 256) : null,
}));

export function normalizeDiscordMessage(message) {
  if (!message?.id || !message?.channel_id || message.author?.bot) return null;
  const guildId = message.guild_id || message.guildId;
  if (!guildId) return null;
  const attachments = normalizedAttachments(message.attachments);
  return {
    provider: "discord",
    external_message_id: String(message.id),
    external_channel_id: String(message.channel_id),
    parent_external_id: String(guildId),
    external_author_id: message.author?.id ? String(message.author.id) : null,
    external_author_name: String(message.member?.nick || message.author?.global_name || message.author?.username || "Discord member").slice(0, 256),
    external_author_avatar: message.author?.avatar && message.author?.id
      ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`
      : null,
    content: String(message.content || "").slice(0, MAX_CONTENT_LENGTH),
    attachments,
    external_url: `https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`,
    sent_at: message.timestamp || new Date().toISOString(),
  };
}

export function normalizeTelegramUpdate(update) {
  const message = update?.channel_post || update?.message;
  const chatId = message?.chat?.id;
  if (!message?.message_id || chatId == null || message.from?.is_bot) return null;
  const media = [];
  for (const photo of message.photo || []) media.push({ ...photo, type: "photo", file_name: "Photo" });
  for (const item of [message.document, message.video, message.audio, message.voice]) {
    if (item) media.push({ ...item, type: item.mime_type || item.type || "file" });
  }
  const username = message.chat?.username;
  return {
    provider: "telegram",
    external_message_id: `${chatId}:${message.message_id}`,
    external_channel_id: String(chatId),
    parent_external_id: null,
    external_author_id: message.from?.id != null ? String(message.from.id) : null,
    external_author_name: String(message.from?.first_name
      ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
      : message.sender_chat?.title || message.chat?.title || username || "Telegram member").slice(0, 256),
    external_author_avatar: null,
    content: String(message.text || message.caption || "").slice(0, MAX_CONTENT_LENGTH),
    attachments: normalizedAttachments(media),
    external_url: username ? `https://t.me/${username}/${message.message_id}` : null,
    sent_at: Number.isFinite(Number(message.date)) ? new Date(Number(message.date) * 1000).toISOString() : new Date().toISOString(),
  };
}
