export function getChannelDraft(drafts, channelId) {
  if (channelId == null) return "";
  return drafts[String(channelId)] || "";
}

export function setChannelDraft(drafts, channelId, value) {
  if (channelId == null) return drafts;

  const key = String(channelId);
  const nextValue = value || "";
  if ((drafts[key] || "") === nextValue) return drafts;

  const nextDrafts = { ...drafts };
  if (nextValue) {
    nextDrafts[key] = nextValue;
  } else {
    delete nextDrafts[key];
  }
  return nextDrafts;
}
