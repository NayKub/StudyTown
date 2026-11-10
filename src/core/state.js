// The single place where the app's mutable state lives.
// Rule of thumb: modules read and write `G`, but only main.js replaces `G.state` wholesale.

export const G = {
  /** Everything that must survive a restart (saved on the device, backed up to the account). */
  state: { totalSec: 0, days: {}, sessions: [], timer: null, v: 2 },
  settings: { lang: null, keepAwake: false, sound: true, haptics: true, notify: true },
  /** The study session in progress. `before` = seconds counted before the last resume. */
  timer: {
    dur: 25 * 60,
    running: false,
    startedAt: 0,
    before: 0,
    credited: 0,
    active: false,
    sessionStart: 0,
  },
  /** Which town is on screen: your own, a "peek ahead" preview, or a friend's. */
  preview: false,
  previewMin: 600,
  visit: null, // { name, totalMin } while looking at a friend's town
  /** plot index -> start time of its "just built" animation */
  anims: {},
};

/** Your own total study minutes. */
export const realMin = () => Math.floor(G.state.totalSec / 60);

/** Minutes of the town currently on screen (friend's, preview or your own). */
export const curMin = () => (G.visit ? G.visit.totalMin : G.preview ? G.previewMin : realMin());
