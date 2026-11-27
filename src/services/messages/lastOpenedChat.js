const getStorageKey = (userId) => `xeevia:last-opened-dm:${userId}`;

export const getLastOpenedChat = (userId) => {
  if (!userId) return null;

  try {
    const stored = JSON.parse(localStorage.getItem(getStorageKey(userId)) || "null");
    if (
      !stored
      || !["direct", "group"].includes(stored.type)
      || typeof stored.id !== "string"
      || !stored.id
    ) {
      return null;
    }

    return { type: stored.type, id: stored.id };
  } catch (error) {
    console.warn("[DM] Could not read last opened chat:", error);
    return null;
  }
};

export const saveLastOpenedChat = (userId, chat) => {
  if (
    !userId
    || !chat
    || !["direct", "group"].includes(chat.type)
    || typeof chat.id !== "string"
    || !chat.id
  ) {
    return false;
  }

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify({
      type: chat.type,
      id: chat.id,
    }));
    return true;
  } catch (error) {
    console.warn("[DM] Could not save last opened chat:", error);
    return false;
  }
};
