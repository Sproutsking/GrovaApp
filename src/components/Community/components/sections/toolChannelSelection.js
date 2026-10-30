export function getSelectedToolChannelIds(row = {}) {
  const configuredIds = Array.isArray(row.config?.channel_ids)
    ? row.config.channel_ids.filter(Boolean).map(String)
    : [];
  if (configuredIds.length) return new Set(configuredIds);
  return row.channel_id ? new Set([String(row.channel_id)]) : new Set();
}
