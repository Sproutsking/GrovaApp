export function isPlaceholderValue(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return true;

  const placeholders = [
    'demo-anon-key',
    'example.supabase.co',
    'example.com',
    'your-project-ref',
    'replace-me',
    'changeme',
    'localhost',
    '127.0.0.1',
  ];

  return placeholders.some((candidate) =>
    normalized.toLowerCase() === candidate || normalized.toLowerCase().includes(candidate),
  );
}

export function getSafeEnvValue(env, fallback = '') {
  const value = env ?? fallback;
  if (typeof value !== 'string') return fallback;
  if (isPlaceholderValue(value)) return fallback;
  return value;
}

export function hasSafeBrowserConfig(url, anonKey) {
  return Boolean(url && anonKey && !isPlaceholderValue(url) && !isPlaceholderValue(anonKey));
}
