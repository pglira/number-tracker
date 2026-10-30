import { useEffect, useState } from 'react';

export type Theme = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'number-tracker.theme';
const ORDER: Theme[] = ['auto', 'light', 'dark'];

export function loadTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ORDER.includes(value as Theme) ? (value as Theme) : 'auto';
  } catch {
    return 'auto';
  }
}

const LIGHT_QUERY = '(prefers-color-scheme: light)';

// Set the effective theme on the root element and match the browser UI color
// to the page background. 'auto' follows the color scheme of the system.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme === 'auto' ? (matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark') : theme;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The theme stays for this session only.
    }
    if (theme !== 'auto') return;
    const query = matchMedia(LIGHT_QUERY);
    const onChange = () => applyTheme('auto');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const next = () => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);
  return [theme, next];
}
