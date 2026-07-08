import { applyThemeMode } from './theme';

describe('applyThemeMode', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.className = '';
    window.localStorage.clear();
  });

  it('applies the light theme classes and stores the preference', () => {
    applyThemeMode('light');

    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
    expect(window.localStorage.getItem('xv_theme_mode')).toBe('light');
  });

  it('applies the dark theme classes and stores the preference', () => {
    applyThemeMode('dark');

    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(window.localStorage.getItem('xv_theme_mode')).toBe('dark');
  });
});
