// Shared mutable game state. Everything that must survive a restart lives in G.state.
export const G = {
  state: { totalSec: 0, days: {}, sessions: [], timer: null, v: 2 },
  settings: { lang: null, keepAwake: false, sound: true, haptics: true, notify: true },
  timer: { dur: 25 * 60, running: false, startedAt: 0, before: 0, credited: 0, active: false, sessionStart: 0 },
  preview: false,
  previewMin: 600,
  anims: {},
  city: null,
};
export const realMin = () => Math.floor(G.state.totalSec / 60);
export const curMin = () => (G.preview ? G.previewMin : realMin());
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const todayKey = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
