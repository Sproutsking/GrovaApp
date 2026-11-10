export function buildTelegramMessage(content, url, maxLength = 4096) {
  const text = String(content || "").trim();
  const link = String(url || "").trim();
  const suffix = link ? `\n\n${link}` : "";
  if (suffix.length >= maxLength) return suffix.trim().slice(0, maxLength);
  return `${text.slice(0, maxLength - suffix.length)}${suffix}`;
}

export function getBotProviderError(result, provider) {
  if (provider === "telegram") return result?.description || result?.message || "Telegram delivery failed.";
  return result?.message || result?.error?.message || "Discord delivery failed.";
}
