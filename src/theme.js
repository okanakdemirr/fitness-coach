// Theme handling: 'dark' | 'light' | 'system'
import { store } from './store.js';

const THEME_COLORS = { dark: '#0b0c10', light: '#f4f5f8' };
const media = window.matchMedia('(prefers-color-scheme: light)');

function resolveTheme(pref) {
  if (pref === 'system') return media.matches ? 'light' : 'dark';
  return pref === 'light' ? 'light' : 'dark';
}

export function applyTheme(pref = store.getSettings().theme) {
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

media.addEventListener?.('change', () => {
  if (store.getSettings().theme === 'system') applyTheme('system');
});
