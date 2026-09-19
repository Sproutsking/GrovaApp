export function getVisibleUnreadNotifications(notifications = [], clearedAtIso = null) {
  if (!Array.isArray(notifications)) return [];

  const clearedMs = clearedAtIso ? new Date(clearedAtIso).getTime() : 0;

  return notifications.filter((item) => {
    if (item?.is_read) return false;
    if (!item?.created_at) return true;
    const createdMs = new Date(item.created_at).getTime();
    return Number.isFinite(createdMs) ? createdMs >= clearedMs : true;
  });
}

export function getVisibleCommunityUnreadCounts(channelCounts = {}, lastClearedBySource = {}) {
  const next = { ...channelCounts };
  Object.keys(next).forEach((channelId) => {
    const clearedAt = lastClearedBySource[channelId];
    if (!clearedAt) return;
    const clearedMs = new Date(clearedAt).getTime();
    const count = Number(next[channelId] || 0);
    next[channelId] = Number.isFinite(clearedMs) ? Math.max(0, count) : count;
  });
  return next;
}
