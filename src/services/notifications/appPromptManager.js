const PROMPT_STORAGE_KEY = "xv_prompt_state_v1";
const REMIND_OPTIONS_HOURS = [12, 24, 48];

export function getPromptPriority({ installReady, updateReady, pushReady, isInstalled = false }) {
  // An update is more important than an install invitation once the app is
  // already running as an installed experience.
  if (updateReady) return "update";
  if (isInstalled) return null;
  if (installReady) return "install";
  if (pushReady) return "push";
  return null;
}

export function shouldSuppressInstallPrompt(storage = window.localStorage, installedOverride = null) {
  if (installedOverride !== null) return !!installedOverride;

  try {
    if (typeof window !== "undefined") {
      const displayMode = window.matchMedia && window.matchMedia("(display-mode: standalone)");
      if (displayMode?.matches) return true;
      if (window.navigator?.standalone === true) return true;
    }
  } catch {}

  if (!storage) return false;
  try {
    if (storage.getItem("xv_pwa_installed") === "1") return true;
  } catch {}

  const state = readPromptState(storage);
  return !!state?.never?.install;
}

export function readPromptState(storage = window.localStorage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PROMPT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writePromptState(state, storage = window.localStorage) {
  if (!storage) return;
  try {
    storage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function isPromptDue(type, storage = window.localStorage) {
  const state = readPromptState(storage);
  if (state?.never?.[type]) return false;
  const nextAt = Number(state?.[type] || 0);
  return !nextAt || Date.now() >= nextAt;
}

export function setPromptNever(type, storage = window.localStorage) {
  const state = readPromptState(storage);
  state.never = { ...(state.never || {}), [type]: true };
  writePromptState(state, storage);
}

export function isPromptNever(type, storage = window.localStorage) {
  return !!readPromptState(storage)?.never?.[type];
}

export function schedulePrompt(type, hours, storage = window.localStorage) {
  const state = readPromptState(storage);
  state[type] = Date.now() + hours * 60 * 60 * 1000;
  writePromptState(state, storage);
}

export function clearPromptSchedule(type, storage = window.localStorage) {
  const state = readPromptState(storage);
  delete state[type];
  writePromptState(state, storage);
}

export function getReminderOptions() {
  return REMIND_OPTIONS_HOURS;
}
