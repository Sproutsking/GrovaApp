const PROMPT_STORAGE_KEY = "xv_prompt_state_v1";
const REMIND_OPTIONS_HOURS = [12, 24, 48];

export function getPromptPriority({ installReady, updateReady, pushReady, isInstalled = false }) {
  if (isInstalled) return null;
  if (installReady) return "install";
  if (updateReady) return "update";
  if (pushReady) return "push";
  return null;
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
  const nextAt = Number(state?.[type] || 0);
  return !nextAt || Date.now() >= nextAt;
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
