export function isChunkLoadError(error) {
  const message = String(error ?? "");
  return /chunk/i.test(message) || /dynamically imported module/i.test(message) || /loading chunk/i.test(message);
}

export function buildRecoveryUrl(targetUrl = window.location.href) {
  try {
    const url = new URL(targetUrl);
    url.searchParams.set('v', String(Date.now()));
    return url.toString();
  } catch {
    return `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
  }
}
