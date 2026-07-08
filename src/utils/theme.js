export function applyThemeMode(mode) {
  const normalized = mode === 'light' ? 'light' : 'dark';
  if (typeof document === 'undefined') return normalized;

  const root = document.documentElement;
  const body = document.body;

  root.classList.toggle('theme-light', normalized === 'light');
  root.classList.toggle('theme-dark', normalized === 'dark');
  body.classList.toggle('theme-light', normalized === 'light');
  body.classList.toggle('theme-dark', normalized === 'dark');

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('xv_theme_mode', normalized);
  }

  return normalized;
}
