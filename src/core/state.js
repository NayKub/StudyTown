// The single place where the app's mutable state lives.
// Rule of thumb: modules read and write `G`, but only main.js replaces `G.state` wholesale.
import { cityAt } from './city.js';

export const G = {
  /** Everything that must survive a restart (saved on the device, backed up to the account). */
  state: {
    totalSec: 0,
    days: {}, // dayKey -> seconds studied
    sessions: [],
    timer: null,
    choices: {}, // plot index -> kind the player chose to build
    chooseFrom: null, // first plot index that waits for a choice (null until set at first launch)
    badges: {}, // achievement id -> when it was earned
    goalMin: 60, // daily goal in minutes
    goalHitDay: '', // last day the "goal reached" celebration was shown
    flags: {}, // one-off things the player has done, e.g. { visited: true }
    v: 3,
  },
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
    plotsAtStart: null,
  },
  /** Which town is on screen: your own, a "peek ahead" preview, or a friend's. */
  preview: false,
  previewMin: 600,
  visit: null, // { name, totalMin, choices, chooseFrom } while looking at a friend's town
  replayMin: null, // minutes shown by the time-lapse while it plays
  /** plot index -> start time of its "just built" animation */
  anims: {},
};

/** Your own total study minutes. */
export const realMin = () => Math.floor(G.state.totalSec / 60);

/** Minutes of the town currently on screen (friend's, time-lapse, preview or your own). */
export function curMin() {
  if (G.visit) return G.visit.totalMin;
  if (G.replayMin != null) return G.replayMin;
  return G.preview ? G.previewMin : realMin();
}

/** Your own buildings: what you chose, and how many plots you have unlocked. */
export const ownTown = () => ({
  choices: G.state.choices,
  chooseFrom: G.state.chooseFrom == null ? Infinity : G.state.chooseFrom,
  unlocked: cityAt(realMin()).n,
});

/** The buildings of the town currently on screen. */
export function shownTown() {
  if (!G.visit) return ownTown();
  const { choices, chooseFrom } = G.visit;
  return { choices: choices || {}, chooseFrom: chooseFrom == null ? Infinity : chooseFrom, unlocked: Infinity };
}
