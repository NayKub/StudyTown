// Light or dark theme. "System" follows the phone or computer setting and changes along with it.
import { G } from '../core/state.js';
import * as native from '../platform/native.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_COLOR = { light: '#fdf3e7', dark: '#1c1922' };

export const THEMES = ['system', 'light', 'dark'];

export function applyTheme() {
  const choice = G.settings.theme || 'system';
  const dark = choice === 'dark' || (choice === 'system' && media.matches);
  const name = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = name;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[name];
  native.setBarsDark(dark);
}

export function initTheme() {
  media.addEventListener('change', () => {
    if ((G.settings.theme || 'system') === 'system') applyTheme();
  });
  applyTheme();
}
