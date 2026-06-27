export function getPromptPriority({ installReady, updateReady, pushReady, isInstalled = false }) {
  if (isInstalled) return null;
  if (installReady) return "install";
  if (updateReady) return "update";
  if (pushReady) return "push";
  return null;
}
